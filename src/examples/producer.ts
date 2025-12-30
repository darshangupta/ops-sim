import { KafkaProducer } from '../network/kafka-producer';
import { ChaosProxy } from '../network/chaos-proxy';
import { MessageType, TOPICS } from '../network/types';

interface TelemetryPayload {
  satelliteId: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  batteryLevel: number;
  systemHealth: 'NOMINAL' | 'DEGRADED' | 'CRITICAL';
}

async function runProducerExample(): Promise<void> {
  const producer = new KafkaProducer('satellite-001');
  
  // Create chaos proxy with moderate chaos settings
  const chaos = new ChaosProxy({
    dropRate: 0.1,        // 10% drop rate
    duplicateRate: 0.05,  // 5% duplicate rate
    maxDelayMs: 2000,     // Up to 2s delays
    reorderWindow: 3,     // Reorder within 3 messages
    seed: 12345,          // Deterministic for testing
    enabled: true
  });

  const chaoticProducer = chaos.wrapProducer(producer);

  try {
    console.log('🚀 Starting producer example...');
    await chaoticProducer.connect();

    // Send telemetry messages every 2 seconds
    let messageCount = 0;
    const interval = setInterval(async () => {
      messageCount++;
      
      const telemetry: TelemetryPayload = {
        satelliteId: 'SAT-001',
        position: {
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          z: Math.random() * 100
        },
        velocity: {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
          z: (Math.random() - 0.5) * 2
        },
        batteryLevel: Math.max(20, 100 - messageCount * 2), // Simulate battery drain
        systemHealth: messageCount > 15 ? 'DEGRADED' : 'NOMINAL'
      };

      try {
        const result = await chaoticProducer.sendMessage(
          TOPICS.TELEMETRY,
          MessageType.TELEMETRY,
          telemetry,
          'ground-control'
        );

        if (result) {
          console.log(`✅ Telemetry ${messageCount} sent successfully`);
        } else {
          console.log(`❌ Telemetry ${messageCount} was dropped by chaos proxy`);
        }
      } catch (error) {
        console.error(`💥 Failed to send telemetry ${messageCount}:`, error);
      }

      // Stop after 20 messages
      if (messageCount >= 20) {
        clearInterval(interval);
        
        // Print chaos stats
        const stats = chaos.getStats();
        console.log('\n📊 Chaos Proxy Statistics:');
        console.log(`  Messages sent: ${stats.sent}`);
        console.log(`  Messages dropped: ${stats.dropped} (${((stats.dropped/stats.sent)*100).toFixed(1)}%)`);
        console.log(`  Messages duplicated: ${stats.duplicated}`);
        console.log(`  Messages delayed: ${stats.delayed}`);
        console.log(`  Messages reordered: ${stats.reordered}`);

        setTimeout(async () => {
          await chaoticProducer.disconnect();
          console.log('👋 Producer example completed');
          process.exit(0);
        }, 3000); // Wait 3s for any delayed messages
      }
    }, 2000);

  } catch (error) {
    console.error('💥 Producer example failed:', error);
    await chaoticProducer.disconnect();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  runProducerExample().catch(console.error);
}