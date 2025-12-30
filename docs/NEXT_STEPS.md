# Next Steps: Architecture & Implementation Plan

## Phase 1: Architecture Planning (Day 1 - No Code)

### 1. Finalized Technology Stack
- **Language**: TypeScript/Node.js
- **Transport**: Kafka + ChaosProxy layer
- **Kafka Client**: KafkaJS
- **Containers**: Docker Compose (Kafka cluster)
- **Message Format**: JSON (start simple, upgrade to protobuf later)
- **Storage**: SQLite for command ledger persistence
- **Testing**: Jest with Docker integration

### 2. Component Architecture Design

#### A. Kafka + Chaos Transport Layer

ChaosProxy wraps KafkaJS client calls as an application-level interceptor pattern (not a separate service):

- **Producer side**: `producer.send()` → `ChaosProxy.send()` → (failure injection) → `kafka.producer.send()`
- **Consumer side**: `kafka.consumer.run()` → (message received) → `ChaosProxy.intercept()` → handler
- **Implementation**: Application-level wrapper/interceptor pattern wrapping KafkaJS producer and consumer
- **Failure injection**: Occurs before messages reach Kafka (producer side) and after messages leave Kafka (consumer side)

```
Kafka Cluster (reliable baseline)
├── Producer → Topic → Consumer
├── ChaosProxy (failure injection wrapper)
├── MessageEnvelope (app-level protocol)
└── DeterministicChaos (seeded failures)
```

#### B. Satellite Component
```
SatelliteNode
├── TelemetryEmitter (periodic health/position data)
├── CommandReceiver (idempotent execution engine)
├── LocalState (persist across reboots)
└── SequenceManager (monotonic counters)
```

#### C. Ground Control Component  
```
GroundControl
├── TelemetryAggregator (staleness filtering)
├── CommandDispatcher (retry logic)
├── StateReconciler (partition recovery)
└── OperatorInterface (UNKNOWN state visibility)
```

#### D. Sensor Network Component
```
SensorNetwork
├── TrackingObserver (multi-sensor input)
├── ConflictDetector (disagreement handling)
├── FusionEngine (best-track estimation)
└── UncertaintyManager (confidence tracking)
```

### 3. System Guarantees & Non-Guarantees

#### Guarantees
- **At-most-once command execution**: Commands are executed at most once via idempotent execution ledger (commandId deduplication)
- **Monotonic telemetry sequence per satellite**: Ground control maintains monotonic sequence numbers per satellite; stale telemetry (older sequence) never overwrites fresh state
- **Command state persistence across satellite reboots**: SQLite command ledger persists command execution state; satellite can recover and replay command history on restart
- **Duplicate message detection**: All messages include unique messageId; duplicate messages are detected and handled idempotently via messageId deduplication cache

#### Non-Guarantees
- **Message delivery ordering**: Messages may arrive out of sequence; application-level sequence numbers required for ordering
- **Message delivery latency**: No SLA on message delivery time; messages may be delayed arbitrarily by network conditions
- **Delivery reliability**: Messages may be dropped by ChaosProxy or network conditions; no guaranteed delivery semantics
- **Global clock synchronization**: No synchronized clocks assumed; all timestamps are local/monotonic per node
- **Real-time processing**: No timing guarantees on processing speed; system prioritizes correctness over latency

### 4. Protocol Specifications

#### Message Envelope Standard
```typescript
interface MessageEnvelope {
  messageId: string;        // UUID for deduplication
  sequenceNumber: number;   // Monotonic per-sender --> our ordering type
  sourceNode: string;       // Sender identification
  destinationNode?: string; // Optional targeting
  messageType: MessageType;
  payload: any;
  checksum: string;         // Integrity validation
}
```

#### Telemetry Protocol
```typescript
interface TelemetryMessage {
  satelliteId: string;
  localSequence: number;
  timestamp: number;        // Local monotonic time
  position: Vector3D;
  velocity: Vector3D;
  systemHealth: HealthStatus;
  batteryLevel: number;
  thermalStatus: ThermalData;
}
```

#### Command Protocol
```typescript
interface CommandMessage {
  commandId: string;        // Deterministic UUID
  targetSatellite: string;
  issuedSequence: number;
  commandType: CommandType;
  parameters: CommandParams;
  retryPolicy: RetryConfig;
}

interface CommandAck {
  commandId: string;
  executionStatus: 'EXECUTED' | 'FAILED' | 'QUEUED';
  executionTime?: number;
  errorDetails?: string;
}
```

#### Tracking Protocol
```typescript
interface TrackObservation {
  sensorId: string;
  objectId: string;
  observationSequence: number;
  timestamp: number;
  observedState: ObjectState;
  confidence: number;       // 0.0 - 1.0
  sensorType: SensorType;
}
```

### 5. State Machine Definitions

#### Satellite Command State Machine
```
States: UNKNOWN → PENDING → EXECUTING → EXECUTED
                           ↓
                         FAILED

Transitions:
- Command received → PENDING (if valid, idempotent check via commandId)
- Execution start → EXECUTING  
- Success → EXECUTED
- Error → FAILED
- Duplicate → No transition (idempotent - commandId already in ledger)
```

#### Ground Control Telemetry State Machine
```
States: UNKNOWN → STALE → CURRENT → SUSPECT

Transitions:
- Fresh telemetry → CURRENT (log transition: UNKNOWN→CURRENT)
- Newer sequence → CURRENT (update, log sequence update)
- Older sequence → No change (reject, log as "STALE_REJECTED" event)
- Timeout → STALE (log transition: CURRENT→STALE, alert operator)
- Conflict → SUSPECT (log transition: CURRENT→SUSPECT, alert operator)

Staleness Handling Rules:
- **Sequence Window**: Accept sequences within window of current_max_seq (window_size = 100)
  - If sequence < (current_max_seq - 100): Reject, log as "STALE_REJECTED" (too old)
  - If sequence >= (current_max_seq - 100) and < current_max_seq: Log as gap detection, but reject (out-of-order but within window)
- **Gap Detection**: If seq N arrives then seq N-2 arrives (gap of 1 missing sequence):
  - Log gap detection event (missing sequence N-1)
  - Accept seq N-2 if within sequence window (seq N-2 >= current_max_seq - 100)
  - Do not update current_max_seq if accepting out-of-order sequence (maintain monotonic view)
- **Rejection Behavior**: Older sequences are logged with "STALE_REJECTED" event and state is not updated (monotonic guarantee preserved)
```

### 6. Failure Mode Analysis

#### Network Failures
| Failure Type | Detection | Recovery | Impact |
|-------------|-----------|----------|---------|
| Message Drop | Timeout/Missing Seq | Retry | Data loss |
| Message Delay | Out-of-order arrival | Sequence check | Stale data |
| Message Duplicate | Message ID cache | Idempotent handler | None |
| Partition | Heartbeat timeout (>30s), missing expected ACKs, sequence number gaps | Reconnect + reconcile | See details below |

**Partition Failure Details:**
- **Inconsistent State**: Ground control shows UNKNOWN command status for commands sent during partition; satellite may have executed commands but ground hasn't received ACK
- **Detection**: Heartbeat timeout (>30s), missing expected ACKs, sequence number gaps in telemetry stream
- **Duration**: Until partition resolves (reconnection established, bidirectional communication restored)
- **Reconciliation Process**:
  - Satellite replays command ledger on reconnection (all commands executed during partition)
  - Ground queries missing command IDs (commands with UNKNOWN status during partition)
  - Explicit state transitions: UNKNOWN → EXECUTED/PENDING/FAILED (logged for audit)
  - Telemetry sequence gaps filled where possible (out-of-order messages may arrive after partition)
- **Operator Visibility**: All UNKNOWN states surfaced in operator interface during partition; reconciliation process fully logged with state transitions

#### System Failures
| Failure Type | Detection | Recovery | Impact |
|-------------|-----------|----------|---------|
| Satellite Reboot | Missing heartbeat | State reload | Command replay needed |
| Ground Restart | Process monitoring | Persistent storage | Operator notification |
| Sensor Malfunction | Confidence degradation | Multi-sensor fusion | Reduced accuracy |

## Phase 2: Implementation Roadmap

### Week Structure
- **Day 1**: Complete architecture documents (this phase)
- **Day 2**: Network simulator + message protocols
- **Day 3**: Satellite telemetry + ground aggregation  
- **Day 4**: Command execution + persistence
- **Day 5**: Multi-sensor tracking + fusion
- **Day 6**: Partition scenarios + recovery
- **Day 7**: Integration + refinement

### Immediate Next Actions

1. **Day 2 Setup** (Tomorrow)
   - Create `package.json` and `docker-compose.yml`
   - Implement ChaosProxy with configurable failure modes
   - Create MessageEnvelope protocol
   - Set up deterministic testing with seeds

2. **Kafka Infrastructure**
   - Single-node Kafka cluster in Docker
   - Topics: `telemetry`, `commands`, `tracking`
   - ChaosProxy as middleware layer

3. **Core Implementation Order**
   - Day 2: Kafka + ChaosProxy + basic message envelope
   - Day 3: Satellite telemetry through chaos
   - Day 4: Command execution with durable ledger

## Key Architecture Decisions Made

1. **Kafka + ChaosProxy**: Real messaging infrastructure with controlled failure injection via application-level wrapper
2. **Sequence Numbers**: Use monotonic sequence numbers per sender for message ordering (no logical clocks)
3. **SQLite Persistence**: Command ledger survives satellite reboots
4. **UNKNOWN States**: Explicit operator visibility in all UIs
5. **Simple First**: JSON → Protobuf migration path, avoid premature optimization

## Implementation Checklist

### Day 2: Kafka + Chaos Foundation
- [ ] Docker Compose with Kafka
- [ ] ChaosProxy with drop/delay/duplicate/reorder
- [ ] MessageEnvelope with sequence numbers
- [ ] Deterministic failure seeds
- [ ] Basic producer/consumer examples

### Days 3-7: Component Implementation
- [ ] Day 3: Satellite telemetry emission + ground aggregation
- [ ] Day 4: Command dispatch + execution + ACKs
- [ ] Day 5: Multi-sensor track fusion
- [ ] Day 6: 90-second partition scenario
- [ ] Day 7: End-to-end integration testing

## ChaosProxy Configuration

```typescript
// Example chaos configuration
const chaosConfig = {
  dropRate: 0.1,           // 10% message drops
  duplicateRate: 0.05,     // 5% duplicates  
  maxDelayMs: 5000,        // Up to 5s delays
  reorderWindow: 10,       // Reorder within 10 messages
  seed: 12345              // Deterministic for tests
};
```

**Status: Architecture finalized, ready for Day 2 implementation.**