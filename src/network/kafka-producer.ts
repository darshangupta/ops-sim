import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { MessageEnvelope, MessageType } from './types';
import { MessageUtils } from './message-utils';

export class KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private nodeId: string;
  private isConnected: boolean = false;

  constructor(nodeId: string, brokers: string[] = ['localhost:9092']) {
    this.nodeId = nodeId;
    this.kafka = new Kafka({
      clientId: `${nodeId}-producer`,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 5
      }
    });
    
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
    
    // Suppress KafkaJS partitioner warning
    process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.producer.connect();
      this.isConnected = true;
      console.log(`📤 Producer ${this.nodeId} connected`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.isConnected = false;
      console.log(`📤 Producer ${this.nodeId} disconnected`);
    }
  }

  async sendMessage<T>(
    topic: string,
    messageType: MessageType,
    payload: T,
    destinationNode?: string
  ): Promise<MessageEnvelope<T>> {
    if (!this.isConnected) {
      throw new Error(`Producer ${this.nodeId} not connected`);
    }

    const envelope = MessageUtils.createMessage(
      this.nodeId,
      messageType,
      payload,
      destinationNode
    );

    const record: ProducerRecord = {
      topic,
      messages: [{
        key: envelope.messageId,
        value: JSON.stringify(envelope),
        headers: {
          messageType: envelope.messageType,
          sourceNode: envelope.sourceNode,
          sequenceNumber: envelope.sequenceNumber.toString()
        }
      }]
    };

    try {
      const metadata = await this.producer.send(record);
      console.log(`📤 [${this.nodeId}] Sent ${messageType} seq=${envelope.sequenceNumber} to ${topic}`);
      return envelope;
    } catch (error) {
      console.error(`❌ [${this.nodeId}] Failed to send message:`, error);
      throw error;
    }
  }

  async sendBatch<T>(
    topic: string,
    messages: Array<{ messageType: MessageType; payload: T; destinationNode?: string }>
  ): Promise<MessageEnvelope<T>[]> {
    if (!this.isConnected) {
      throw new Error(`Producer ${this.nodeId} not connected`);
    }

    const envelopes = messages.map(msg => 
      MessageUtils.createMessage(this.nodeId, msg.messageType, msg.payload, msg.destinationNode)
    );

    const record: ProducerRecord = {
      topic,
      messages: envelopes.map(envelope => ({
        key: envelope.messageId,
        value: JSON.stringify(envelope),
        headers: {
          messageType: envelope.messageType,
          sourceNode: envelope.sourceNode,
          sequenceNumber: envelope.sequenceNumber.toString()
        }
      }))
    };

    try {
      await this.producer.send(record);
      console.log(`📤 [${this.nodeId}] Sent batch of ${envelopes.length} messages to ${topic}`);
      return envelopes;
    } catch (error) {
      console.error(`❌ [${this.nodeId}] Failed to send batch:`, error);
      throw error;
    }
  }

  getNodeId(): string {
    return this.nodeId;
  }
}