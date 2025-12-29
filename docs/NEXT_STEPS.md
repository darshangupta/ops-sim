# Next Steps: Architecture & Implementation Plan

## Phase 1: Architecture Planning (Day 1 - No Code)

### 1. Technology Stack Selection
**Decision Points:**
- **Language**: TypeScript/Node.js vs Go vs Rust vs Python
  - Consider: Type safety, async handling, ecosystem
  - Recommendation: TypeScript for rapid prototyping with strong types
- **Message Serialization**: Protocol Buffers vs JSON vs MessagePack
  - Need efficient, versioned message formats
- **Storage**: In-memory vs SQLite vs Redis for command ledger
- **Testing Framework**: Jest vs Vitest for scenario testing

### 2. Component Architecture Design

#### A. Message Transport Layer
```
UnreliableNetwork
├── MessageBus (core unreliable transport)
├── MessageEnvelope (ID, seq, timestamp, payload)
├── NetworkSimulator (controlled chaos)
└── FailureInjector (drops, delays, duplicates)
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

### 3. Protocol Specifications

#### Message Envelope Standard
```typescript
interface MessageEnvelope {
  messageId: string;        // UUID for deduplication
  sequenceNumber: number;   // Monotonic per-sender
  logicalClock: number;     // Vector/Lamport clock
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

### 4. State Machine Definitions

#### Satellite Command State Machine
```
States: IDLE → QUEUED → EXECUTING → COMPLETED
                ↓
              FAILED

Transitions:
- Command received → QUEUED (if valid, idempotent)
- Execution start → EXECUTING  
- Success → COMPLETED
- Error → FAILED
- Duplicate → No transition (idempotent)
```

#### Ground Control Telemetry State Machine
```
States: UNKNOWN → STALE → CURRENT → SUSPECT

Transitions:
- Fresh telemetry → CURRENT
- Newer sequence → CURRENT (update)
- Older sequence → No change (reject)
- Timeout → STALE
- Conflict → SUSPECT
```

### 5. Failure Mode Analysis

#### Network Failures
| Failure Type | Detection | Recovery | Impact |
|-------------|-----------|----------|---------|
| Message Drop | Timeout/Missing Seq | Retry | Data loss |
| Message Delay | Out-of-order arrival | Sequence check | Stale data |
| Message Duplicate | Message ID cache | Idempotent handler | None |
| Partition | Heartbeat timeout | Reconnect + reconcile | Temporary inconsistency |

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

1. **Technology Decision**
   - Choose language/framework
   - Set up package.json/project config
   - Initialize testing framework

2. **Architecture Validation**
   - Review message protocols for completeness
   - Validate state machines for correctness
   - Plan test scenarios for each component

3. **Begin Day 2 Implementation**
   - Start with network simulator
   - Implement basic message envelope
   - Create deterministic failure injection

## Architecture Review Questions

Before proceeding, consider:

1. **Message Ordering**: How do we handle causally related messages?
2. **Clock Synchronization**: Should we use vector clocks or logical timestamps?
3. **State Persistence**: What state must survive restarts?
4. **Operator Experience**: How do we surface UNKNOWN states clearly?
5. **Performance**: What are acceptable latency/throughput targets?
6. **Security**: Do we need message authentication?

## Risk Mitigation

### Technical Risks
- **Complexity Creep**: Stick to 7-day plan, resist feature additions
- **Over-Engineering**: Prefer simple solutions over clever ones
- **Testing Gaps**: Ensure each failure mode has explicit test coverage

### Schedule Risks  
- **Day 1 Scope**: Don't code today - design only
- **Integration Time**: Reserve Day 7 for system-level testing
- **Debug Time**: Build observability from the start

---

**Ready to proceed with technology selection and detailed architecture design.**