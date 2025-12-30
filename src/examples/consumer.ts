import { KafkaConsumer } from '../network/kafka-consumer';
import { ChaosProxy } from '../network/chaos-proxy';
import { MessageType, TOPICS, MessageEnvelope } from '../network/types';

interface TelemetryPayload {
  satelliteId: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  batteryLevel: number;
  systemHealth: 'NOMINAL' | 'DEGRADED' | 'CRITICAL';
}

interface TelemetryState {
  lastSequence: number;
  messageCount: number;
  lastUpdate: number;
}

async function runConsumerExample(): Promise<void> {
  const consumer = new KafkaConsumer('ground-control', {
    groupId: 'ground-control-group',
    topics: [TOPICS.TELEMETRY],
    fromBeginning: true,
    autoCommit: true
  });

  // Create chaos proxy with same settings as producer
  const chaos = new ChaosProxy({
    dropRate: parseInt(process.env.CHAOS_DROP_RATE || '0.1', 10) || 0.1,
    duplicateRate: 0.05,
    maxDelayMs: 2000,
    reorderWindow: 3,
    seed: 12345,
    enabled: true
  });

  const chaoticConsumer = chaos.wrapConsumer(consumer);

  // Track telemetry state per satellite
  const satelliteStates = new Map<string, TelemetryState>();

  try {
    console.log('📡 Starting consumer example...');
    console.log(`🔥 Chaos drop rate: ${chaos.getConfig().dropRate * 100}%`);
    
    await chaoticConsumer.connect({
      groupId: 'ground-control-group',
      topics: [TOPICS.TELEMETRY],
      fromBeginning: true
    });

    // Handle telemetry messages
    chaoticConsumer.onMessage<TelemetryPayload>(MessageType.TELEMETRY, async (envelope: MessageEnvelope<TelemetryPayload>) => {
      const { satelliteId, position, batteryLevel, systemHealth } = envelope.payload;
      
      // Get or create satellite state
      let state = satelliteStates.get(satelliteId);
      if (!state) {
        state = { lastSequence: 0, messageCount: 0, lastUpdate: Date.now() };
        satelliteStates.set(satelliteId, state);
      }

      // Check for sequence ordering
      const isOutOfOrder = envelope.sequenceNumber <= state.lastSequence;
      const isStale = envelope.sequenceNumber < (state.lastSequence - 5); // 5 message window

      // Update state if not stale
      if (!isStale) {
        if (envelope.sequenceNumber > state.lastSequence) {
          state.lastSequence = envelope.sequenceNumber;
        }
        state.messageCount++;
        state.lastUpdate = Date.now();
      }

      // Log telemetry with status indicators
      const statusIcon = systemHealth === 'NOMINAL' ? '✅' : 
                        systemHealth === 'DEGRADED' ? '⚠️' : '🚨';
      const orderIcon = isStale ? '🗑️' : isOutOfOrder ? '🔄' : '📥';
      
      console.log(`${orderIcon} [${satelliteId}] ${statusIcon} Seq=${envelope.sequenceNumber} ` +
                 `Bat=${batteryLevel}% Pos=(${position.x.toFixed(1)},${position.y.toFixed(1)},${position.z.toFixed(1)}) ` +
                 `${isStale ? 'STALE' : isOutOfOrder ? 'OUT-OF-ORDER' : 'OK'}`);

      // Check for sequence gaps
      if (envelope.sequenceNumber > state.lastSequence + 1 && state.messageCount > 1) {
        const missing = envelope.sequenceNumber - state.lastSequence - 1;
        console.log(`⚠️  [${satelliteId}] Detected gap: missing ${missing} message(s) between seq ${state.lastSequence} and ${envelope.sequenceNumber}`);
      }
    });

    // Print periodic statistics
    const statsInterval = setInterval(() => {
      const stats = chaos.getStats();
      console.log('\n📊 Real-time Statistics:');
      console.log(`  📥 Messages received: ${stats.received}`);
      console.log(`  ⏰ Messages delayed: ${stats.delayed}`);
      console.log(`  🔀 Messages reordered: ${stats.reordered}`);
      
      console.log('\n🛰️  Satellite States:');
      for (const [satelliteId, state] of satelliteStates.entries()) {
        const timeSinceUpdate = Date.now() - state.lastUpdate;
        const staleness = timeSinceUpdate > 10000 ? '🔴 STALE' : timeSinceUpdate > 5000 ? '🟡 OLD' : '🟢 FRESH';
        console.log(`  [${satelliteId}] LastSeq=${state.lastSequence} Count=${state.messageCount} ${staleness}`);
      }
      console.log('');
    }, 10000); // Every 10 seconds

    // Handle graceful shutdown
    const shutdown = async () => {
      clearInterval(statsInterval);
      
      const finalStats = chaos.getStats();
      console.log('\n📊 Final Chaos Statistics:');
      console.log(`  📥 Total received: ${finalStats.received}`);
      console.log(`  ⏰ Delayed: ${finalStats.delayed} (${((finalStats.delayed/finalStats.received)*100).toFixed(1)}%)`);
      console.log(`  🔀 Reordered: ${finalStats.reordered}`);
      
      await chaoticConsumer.disconnect();
      console.log('👋 Consumer example completed');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Auto-shutdown after 2 minutes for demo
    setTimeout(shutdown, 120000);

  } catch (error) {
    console.error('💥 Consumer example failed:', error);
    await chaoticConsumer.disconnect();
    process.exit(1);
  }
}

if (require.main === module) {
  runConsumerExample().catch(console.error);
}