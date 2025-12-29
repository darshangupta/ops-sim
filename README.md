# Ops-Sim: Resilient Space Command, Telemetry, and Tracking System

A distributed space operations system practice project designed to simulate real-world challenges faced in space domain awareness and satellite operations.

## 🎯 Project Overview

This project implements a distributed space operations system consisting of:
- **Orbital Nodes** (satellites)
- **Ground Control Systems** 
- **Tracking Sensors** (SDANet-like observers)

All components communicate over unreliable, high-latency networks and must maintain correctness under adverse conditions.

## 🚀 Mission Statement

Build application-level protocols and state machines that remain correct under:
- Message loss
- Reordering  
- Duplication
- Long partitions
- Node restarts

**Key Constraint**: No TCP guarantees assumed, even if transport uses TCP underneath.

## 📋 System Requirements

### Part A: Transport Model
- Unreliable message bus with arbitrary delays, drops, duplicates, and reordering
- No global clock assumption
- Explicit message envelopes with IDs and sequence numbers
- Idempotency built-in

### Part B: Orbital Telemetry (Timeliness > Reliability)
```
Telemetry {
  satellite_id
  local_seq  
  local_time
  position
  velocity
  system_health
}
```

**Requirements:**
- Monotonic view per satellite at ground control
- Stale telemetry never overwrites fresh state
- Safe duplicate handling
- Acceptable loss, expected reordering

### Part C: Command & Control (Correctness > Latency)
```
Command {
  command_id
  target_satellite
  issued_seq
  payload
}
```

**Requirements:**
- At-most-once execution
- Survive retransmission and satellite reboot
- Clear command state classification: EXECUTED, PENDING, UNKNOWN

### Part D: SDANet Multi-Sensor Object Tracking
```
TrackObservation {
  sensor_id
  object_id
  local_seq
  observed_state
  confidence
}
```

**Requirements:**
- Handle sensor disagreement
- Late/out-of-order reports
- Best-current track production
- Explicit conflict visibility

### Part E: Partition Scenario
Simulate 90-second satellite partition with:
- Continued local telemetry
- 2 commands received during partition
- Reconnection and reconciliation

## 📅 7-Day Execution Plan

### Day 1: System Design (No Code)
- [ ] Component diagram
- [ ] Message formats  
- [ ] State machines (satellite/ground/sensor)
- [ ] Written guarantees

### Day 2: Unreliable Network Simulator
- [ ] Message bus with drop/delay/duplicate/reorder
- [ ] Deterministic test seeds

### Day 3: Telemetry Pipeline  
- [ ] Satellite telemetry sender
- [ ] Ground telemetry handler
- [ ] Staleness rejection logic
- [ ] Reordering & duplication tests

### Day 4: Command Execution
- [ ] Durable command ledger
- [ ] Idempotent execution
- [ ] ACK + retry logic
- [ ] Reboot recovery tests

### Day 5: SDANet Tracking
- [ ] Multi-sensor ingestion
- [ ] Conflict detection
- [ ] Track merging logic
- [ ] Uncertainty exposure

### Day 6: Partition & Recovery
- [ ] Full partition simulation
- [ ] Reconnection reconciliation
- [ ] Behavioral analysis

### Day 7: Review & Refinement
- [ ] Failure mode table
- [ ] Explicit non-guarantees
- [ ] Design choice documentation
- [ ] Complexity reduction

## 🔍 Review Criteria (Anduril-Calibrated)

### 🔴 Red Flags (Fail)
- Hand-wavy guarantees
- Implicit TCP ordering reliance
- Silent state overwrites
- No reboot/restart story
- Undefined "eventual consistency"

### 🟡 Baseline (Meets Expectations)
- Explicit message IDs
- Idempotent handlers  
- Correct monotonic counter usage
- Clear degraded-mode behavior
- Written guarantee explanations

### 🟢 Strong (Hire-Level)
- Clear telemetry vs command separation
- Thoughtful staleness handling
- Explicit UNKNOWN states
- Honest tradeoffs
- Clean state machines

### 🔵 Exceptional (Staff-Caliber)
- Causal reasoning
- Operator-focused correctness
- Failure mode tables
- Simple reconciliation logic
- Clear uncertainty reasoning

## 🛠️ Technology Stack

TBD - Will be determined during architecture phase

## 📁 Project Structure

```
ops-sim/
├── README.md
├── CLAUDE.md
├── docs/
│   ├── architecture/
│   ├── protocols/
│   └── failure-modes/
├── src/
│   ├── network/
│   ├── satellite/
│   ├── ground/
│   └── sensors/
└── tests/
    ├── integration/
    └── scenarios/
```

## 🚦 Getting Started

1. Read through the complete requirements
2. Review the 7-day execution plan
3. Start with Day 1: System Design
4. Follow the structured approach - no scope creep!

## 🎯 Success Criteria

Upon completion, you should be able to:
- Explain distributed systems challenges under pressure
- Understand when/why TCP/UDP knowledge matters
- Operate at production-level distributed systems thinking
- Handle real-world space operations complexity

---

**Note**: This project is designed as preparation for Anduril engineering challenges. Focus on correctness over cleverness.