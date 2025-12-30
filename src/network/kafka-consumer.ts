import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { MessageEnvelope, MessageType } from './types';
import { MessageUtils } from './message-utils';

export type MessageHandler<T = any> = (envelope: MessageEnvelope<T>) => Promise<void> | void;

export interface ConsumerConfig {
  groupId: string;
  topics: string[];
  fromBeginning?: boolean;
  autoCommit?: boolean;
}

export class KafkaConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private nodeId: string;
  private isConnected: boolean = false;
  private messageHandlers = new Map<MessageType, MessageHandler>();
  private seenMessageIds = new Set<string>();
  private maxSeenIds = 10000; // Prevent memory leak

  constructor(nodeId: string, config: ConsumerConfig, brokers: string[] = ['localhost:9092']) {
    this.nodeId = nodeId;
    this.kafka = new Kafka({
      clientId: `${nodeId}-consumer`,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
    });
    
    this.consumer = this.kafka.consumer({ 
      groupId: config.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async connect(config: ConsumerConfig): Promise<void> {
    if (!this.isConnected) {
      await this.consumer.connect();
      await this.consumer.subscribe({ 
        topics: config.topics, 
        fromBeginning: config.fromBeginning || false 
      });
      
      await this.consumer.run({
        eachMessage: this.handleMessage.bind(this),
        autoCommit: config.autoCommit !== false
      });

      this.isConnected = true;
      console.log(`📥 Consumer ${this.nodeId} connected to topics: ${config.topics.join(', ')}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.consumer.disconnect();
      this.isConnected = false;
      console.log(`📥 Consumer ${this.nodeId} disconnected`);
    }
  }

  onMessage<T>(messageType: MessageType, handler: MessageHandler<T>): void {
    this.messageHandlers.set(messageType, handler);
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    try {
      const messageStr = payload.message.value?.toString();
      if (!messageStr) return;

      const envelope: MessageEnvelope = JSON.parse(messageStr);
      
      // Validate message envelope
      if (!MessageUtils.validateMessage(envelope)) {
        console.warn(`⚠️ [${this.nodeId}] Invalid message received, skipping`);
        return;
      }

      // Check for duplicate messages
      if (MessageUtils.isDuplicateMessage(envelope.messageId, this.seenMessageIds)) {
        console.log(`🔄 [${this.nodeId}] Duplicate message ${envelope.messageId}, skipping`);
        return;
      }

      // Add to seen messages (with size limit)
      this.seenMessageIds.add(envelope.messageId);
      if (this.seenMessageIds.size > this.maxSeenIds) {
        // Simple cleanup: remove first 1000 entries
        const toDelete = Array.from(this.seenMessageIds).slice(0, 1000);
        toDelete.forEach(id => this.seenMessageIds.delete(id));
      }

      console.log(`📥 [${this.nodeId}] Received ${envelope.messageType} seq=${envelope.sequenceNumber} from ${envelope.sourceNode}`);

      // Find and call handler
      const handler = this.messageHandlers.get(envelope.messageType);
      if (handler) {
        await handler(envelope);
      } else {
        console.warn(`⚠️ [${this.nodeId}] No handler for message type: ${envelope.messageType}`);
      }

    } catch (error) {
      console.error(`❌ [${this.nodeId}] Error processing message:`, error);
    }
  }

  getNodeId(): string {
    return this.nodeId;
  }

  getSeenMessageCount(): number {
    return this.seenMessageIds.size;
  }
}