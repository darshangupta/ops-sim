# Claude Development Guidelines

## Project Context
This is a practice project for distributed space operations systems, designed to prepare for Anduril engineering challenges. The focus is on building resilient protocols under unreliable network conditions.

## Key Development Commands

### Testing Commands
```bash
# Run all tests
npm test

# Run integration tests  
npm run test:integration

# Run scenario tests (partition simulations)
npm run test:scenarios

# Run tests with coverage
npm run test:coverage
```

### Build Commands
```bash
# Build the project
npm run build

# Development build with watch
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Format code
npm run format
```

### Simulation Commands
```bash
# Start network simulator
npm run sim:network

# Run telemetry simulation
npm run sim:telemetry

# Run command simulation  
npm run sim:commands

# Run partition scenario
npm run sim:partition

# Run full system simulation
npm run sim:full
```

## Architecture Principles

### 1. No TCP Guarantees
- Never rely on message ordering from transport layer
- Always implement application-level sequence numbers
- Handle duplicates, drops, and reordering explicitly

### 2. Idempotency First
- Every operation must be safely repeatable
- Use deterministic IDs for all messages
- Implement proper deduplication logic

### 3. Explicit State Management
- Clear separation between EXECUTED, PENDING, UNKNOWN states
- Monotonic counters for freshness
- Never silent overwrites

### 4. Partition Tolerance
- Assume network splits will happen
- Design for graceful degradation
- Clear reconciliation strategies

## Code Organization

### Message Protocols (`src/network/`)
- Message envelope definitions
- Sequence number management
- Network simulator implementation
- Transport abstraction

### Satellite Systems (`src/satellite/`)
- Telemetry generation
- Command execution ledger
- Reboot recovery logic
- Local state management

### Ground Control (`src/ground/`)
- Telemetry aggregation
- Command dispatch
- State reconciliation
- Operator interfaces

### Sensor Network (`src/sensors/`)
- Track observation generation
- Multi-sensor fusion
- Conflict detection
- Uncertainty management

## Testing Strategy

### Unit Tests
- Message protocol correctness
- State machine transitions
- Idempotency validation
- Sequence number handling

### Integration Tests
- Cross-component message flow
- Network partition scenarios
- Reboot recovery sequences
- Multi-sensor fusion logic

### Scenario Tests
- 90-second partition simulation
- Command execution under failures
- Telemetry reordering stress tests
- Sensor disagreement handling

## Review Checkpoints

### Daily Reviews
- Check against red flags (hand-wavy guarantees, TCP assumptions)
- Validate explicit state handling
- Ensure idempotency implementation
- Review failure mode coverage

### Weekly Milestones
- Day 1: Design completeness
- Day 2: Network simulator reliability  
- Day 3: Telemetry correctness
- Day 4: Command safety
- Day 5: Sensor fusion robustness
- Day 6: Partition tolerance
- Day 7: Overall system coherence

## Common Pitfalls to Avoid

### ❌ Silent Failures
- Never drop messages without logging
- Always surface UNKNOWN states to operators
- Make uncertainty explicit

### ❌ Clever Solutions
- Prefer simple, understandable logic
- Avoid complex reconciliation algorithms
- Clear beats clever

### ❌ TCP Assumptions
- Don't rely on message ordering
- Don't assume reliable delivery
- Don't trust connection state

## Debugging Guidelines

### Network Issues
- Use deterministic test seeds for reproducible failures
- Log all message drops, delays, duplicates
- Trace sequence numbers through system

### State Inconsistencies  
- Always log state transitions
- Track source of truth for each data element
- Validate monotonic properties

### Timing Problems
- Use logical clocks, not wall-clock time
- Log all timestamp decisions
- Test with extreme clock skew

## Performance Considerations

### Telemetry (Optimize for Latency)
- Accept message loss for timeliness
- Batch processing where appropriate
- Efficient staleness detection

### Commands (Optimize for Correctness)
- Durable storage for command ledger
- Careful retry backoff strategies
- Clear timeout handling

### Tracking (Optimize for Accuracy)
- Efficient conflict detection algorithms
- Smart fusion strategies
- Bounded memory usage

## Documentation Requirements

### For Each Component
- Clear state machine diagrams
- Message flow documentation
- Failure mode analysis
- Recovery procedures

### For Each Protocol
- Message format specifications
- Sequence number semantics
- Idempotency guarantees
- Timing assumptions

## Success Metrics

### Technical Correctness
- All tests pass under network failures
- No silent state corruption
- Proper UNKNOWN state handling
- Clear operator visibility

### Engineering Quality
- Simple, maintainable code
- Clear separation of concerns
- Comprehensive test coverage
- Honest documentation of limitations

### Anduril Readiness
- Can explain design decisions under pressure
- Understands distributed systems fundamentals
- Demonstrates production-level thinking
- Shows comfort with uncertainty