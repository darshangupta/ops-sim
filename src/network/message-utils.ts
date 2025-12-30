import { v4 as uuidv4 } from 'uuid';
import { MessageEnvelope, MessageType } from './types';

export class MessageUtils {
  private static sequenceCounters = new Map<string, number>();

  static createMessage<T>(
    sourceNode: string,
    messageType: MessageType,
    payload: T,
    destinationNode?: string
  ): MessageEnvelope<T> {
    // Get or initialize sequence counter for this source node
    const currentSeq = this.sequenceCounters.get(sourceNode) || 0;
    const sequenceNumber = currentSeq + 1;
    this.sequenceCounters.set(sourceNode, sequenceNumber);

    const envelope: MessageEnvelope<T> = {
      messageId: uuidv4(),
      sequenceNumber,
      sourceNode,
      destinationNode: destinationNode || '',
      messageType,
      timestamp: Date.now(),
      payload,
      checksum: this.calculateChecksum(payload)
    };

    return envelope;
  }

  static validateMessage<T>(envelope: MessageEnvelope<T>): boolean {
    // Basic validation checks
    if (!envelope.messageId || !envelope.sourceNode || !envelope.messageType) {
      return false;
    }

    if (envelope.sequenceNumber <= 0) {
      return false;
    }

    // Verify checksum
    const expectedChecksum = this.calculateChecksum(envelope.payload);
    if (envelope.checksum !== expectedChecksum) {
      return false;
    }

    return true;
  }

  static calculateChecksum(payload: any): string {
    // Simple checksum - in production, use proper hashing
    const payloadStr = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < payloadStr.length; i++) {
      const char = payloadStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  static isStaleMessage(
    newMessage: MessageEnvelope,
    currentMaxSeq: number,
    windowSize: number = 100
  ): boolean {
    // Message is stale if sequence is too far behind current max
    return newMessage.sequenceNumber < (currentMaxSeq - windowSize);
  }

  static isDuplicateMessage(
    messageId: string,
    seenMessageIds: Set<string>
  ): boolean {
    return seenMessageIds.has(messageId);
  }

  static resetSequenceCounter(sourceNode: string): void {
    this.sequenceCounters.delete(sourceNode);
  }

  static getSequenceCounter(sourceNode: string): number {
    return this.sequenceCounters.get(sourceNode) || 0;
  }
}