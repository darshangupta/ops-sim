import { MessageEnvelope, MessageType, ChaosConfig, MessageStats } from './types';
import { KafkaProducer } from './kafka-producer';
import { KafkaConsumer, MessageHandler } from './kafka-consumer';

export class ChaosProxy {
  private config: ChaosConfig;
  private stats: MessageStats;
  private random: () => number;
  private messageBuffer: MessageEnvelope[] = [];

  constructor(config: Partial<ChaosConfig> = {}) {
    this.config = {
      dropRate: 0.1,
      duplicateRate: 0.05,
      maxDelayMs: 1000,
      reorderWindow: 5,
      seed: 12345,
      enabled: true,
      ...config
    };

    this.stats = {
      sent: 0,
      received: 0,
      dropped: 0,
      duplicated: 0,
      delayed: 0,
      reordered: 0
    };

    // Seeded random number generator for deterministic chaos
    this.random = this.createSeededRandom(this.config.seed);
  }

  // Wrap a producer to inject chaos on send
  wrapProducer(producer: KafkaProducer): ChaoticProducer {
    return new ChaoticProducer(producer, this);
  }

  // Wrap a consumer to inject chaos on receive
  wrapConsumer(consumer: KafkaConsumer): ChaoticConsumer {
    return new ChaoticConsumer(consumer, this);
  }

  // Apply chaos to a message during send
  async processSendMessage<T>(
    tempEnvelope: { messageType: MessageType; payload: T; messageId?: string },
    sendFn: () => Promise<MessageEnvelope<T>>
  ): Promise<MessageEnvelope<T> | null> {
    this.stats.sent++;

    if (!this.config.enabled) {
      return sendFn();
    }

    // Drop message?
    if (this.random() < this.config.dropRate) {
      this.stats.dropped++;
      console.log(`🔥 [CHAOS] Dropped message (${tempEnvelope.messageType})`);
      return null; // Message dropped, don't send
    }

    // Send original message
    const result = await sendFn();

    // Duplicate message?
    if (this.random() < this.config.duplicateRate) {
      this.stats.duplicated++;
      console.log(`🔄 [CHAOS] Duplicating message ${result.messageId}`);
      
      // Send duplicate after a small delay
      const duplicateDelay = Math.max(1, 50 + Math.random() * 200); // Ensure positive timeout
      setTimeout(async () => {
        try {
          await sendFn();
          console.log(`🔄 [CHAOS] Duplicate sent for ${result.messageId}`);
        } catch (error) {
          console.error(`❌ [CHAOS] Failed to send duplicate:`, error);
        }
      }, duplicateDelay);
    }

    return result;
  }

  // Apply chaos to a message during receive
  async processReceiveMessage<T>(
    envelope: MessageEnvelope<T>,
    handler: MessageHandler<T>
  ): Promise<void> {
    this.stats.received++;

    if (!this.config.enabled) {
      await handler(envelope);
      return;
    }

    // Add to reorder buffer if reordering is enabled
    if (this.config.reorderWindow > 0) {
      this.messageBuffer.push(envelope);
      
      // Process buffer when it reaches window size
      if (this.messageBuffer.length >= this.config.reorderWindow) {
        await this.flushReorderBuffer(handler);
      }
    } else {
      // No reordering, apply delay and process immediately
      const delay = this.calculateDelay();
      if (delay > 0) {
        this.stats.delayed++;
        console.log(`⏰ [CHAOS] Delaying message ${envelope.messageId} by ${delay}ms`);
        setTimeout(() => handler(envelope), Math.max(1, delay)); // Ensure positive timeout
      } else {
        await handler(envelope);
      }
    }
  }

  private async flushReorderBuffer<T>(handler: MessageHandler<T>): Promise<void> {
    if (this.messageBuffer.length === 0) return;

    // Randomly shuffle messages in buffer (simple reordering)
    const shuffled = [...this.messageBuffer];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp!;
    }

    // Check if order actually changed
    const reordered = shuffled.some((msg, idx) => 
      msg.messageId !== this.messageBuffer[idx]?.messageId
    );

    if (reordered) {
      this.stats.reordered += shuffled.length;
      console.log(`🔀 [CHAOS] Reordering ${shuffled.length} messages`);
    }

    // Process all messages with potential delays
    for (const envelope of shuffled) {
      const delay = this.calculateDelay();
      if (delay > 0) {
        this.stats.delayed++;
        setTimeout(() => handler(envelope), Math.max(1, delay)); // Ensure positive timeout
      } else {
        await handler(envelope);
      }
    }

    this.messageBuffer = [];
  }

  private calculateDelay(): number {
    if (this.config.maxDelayMs <= 0) return 0;
    
    // 30% chance of delay, exponential distribution
    if (this.random() < 0.3) {
      const delay = Math.floor(this.random() * this.config.maxDelayMs);
      // Ensure delay is never negative
      return Math.max(0, delay);
    }
    
    return 0;
  }

  private createSeededRandom(seed: number): () => number {
    let state = seed;
    return function() {
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    };
  }

  getStats(): MessageStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      sent: 0,
      received: 0,
      dropped: 0,
      duplicated: 0,
      delayed: 0,
      reordered: 0
    };
  }

  updateConfig(newConfig: Partial<ChaosConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.seed !== undefined) {
      this.random = this.createSeededRandom(newConfig.seed);
    }
  }

  getConfig(): ChaosConfig {
    return { ...this.config };
  }
}

class ChaoticProducer {
  constructor(private producer: KafkaProducer, private chaos: ChaosProxy) {}

  async connect(): Promise<void> {
    return this.producer.connect();
  }

  async disconnect(): Promise<void> {
    return this.producer.disconnect();
  }

  async sendMessage<T>(
    topic: string,
    messageType: MessageType,
    payload: T,
    destinationNode?: string
  ): Promise<MessageEnvelope<T> | null> {
    return this.chaos.processSendMessage(
      { messageType, payload },
      async () => {
        return this.producer.sendMessage(topic, messageType, payload, destinationNode);
      }
    );
  }

  getNodeId(): string {
    return this.producer.getNodeId();
  }
}

class ChaoticConsumer {
  constructor(private consumer: KafkaConsumer, private chaos: ChaosProxy) {}

  async connect(config: any): Promise<void> {
    return this.consumer.connect(config);
  }

  async disconnect(): Promise<void> {
    return this.consumer.disconnect();
  }

  onMessage<T>(messageType: MessageType, handler: MessageHandler<T>): void {
    this.consumer.onMessage(messageType, async (envelope: MessageEnvelope<T>) => {
      await this.chaos.processReceiveMessage(envelope, handler);
    });
  }

  getNodeId(): string {
    return this.consumer.getNodeId();
  }
}