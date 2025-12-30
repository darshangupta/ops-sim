export enum MessageType {
  TELEMETRY = 'TELEMETRY',
  COMMAND = 'COMMAND', 
  COMMAND_ACK = 'COMMAND_ACK',
  TRACK_OBSERVATION = 'TRACK_OBSERVATION',
  HEARTBEAT = 'HEARTBEAT'
}

export interface MessageEnvelope<T = any> {
  messageId: string;        // UUID for deduplication
  sequenceNumber: number;   // Monotonic per-sender for ordering
  sourceNode: string;       // Sender identification (e.g., "satellite-001", "ground-control")
  destinationNode?: string; // Optional targeting
  messageType: MessageType;
  timestamp: number;        // Local monotonic timestamp (Date.now())
  payload: T;
  checksum: string;         // Simple integrity check
}

export interface ChaosConfig {
  dropRate: number;         // 0.0 - 1.0 probability of dropping messages
  duplicateRate: number;    // 0.0 - 1.0 probability of duplicating messages  
  maxDelayMs: number;       // Maximum delay to introduce (0 = no delay)
  reorderWindow: number;    // Number of messages to potentially reorder (0 = no reorder)
  seed: number;             // Deterministic random seed for reproducible tests
  enabled: boolean;         // Master switch to disable all chaos
}

export interface MessageStats {
  sent: number;
  received: number;
  dropped: number;
  duplicated: number;
  delayed: number;
  reordered: number;
}

export interface KafkaTopics {
  TELEMETRY: 'telemetry';
  COMMANDS: 'commands'; 
  TRACKING: 'tracking';
}

export const TOPICS: KafkaTopics = {
  TELEMETRY: 'telemetry',
  COMMANDS: 'commands',
  TRACKING: 'tracking'
} as const;