import { Kafka } from 'kafkajs';

async function verifyKafkaConnection(): Promise<void> {
  const kafka = new Kafka({
    clientId: 'ops-sim-verify',
    brokers: ['localhost:9092'],
    retry: {
      initialRetryTime: 300,
      retries: 5
    }
  });

  const admin = kafka.admin();

  try {
    console.log('🔍 Connecting to Kafka...');
    await admin.connect();
    
    console.log('📋 Listing topics...');
    const topics = await admin.listTopics();
    
    console.log('✅ Kafka connection successful!');
    console.log(`📊 Available topics: ${topics.join(', ')}`);
    
    // Verify our expected topics exist
    const expectedTopics = ['telemetry', 'commands', 'tracking'];
    const missingTopics = expectedTopics.filter(topic => !topics.includes(topic));
    
    if (missingTopics.length > 0) {
      console.log(`⚠️  Missing topics: ${missingTopics.join(', ')}`);
      console.log('💡 Run: docker compose up -d to recreate topics');
    } else {
      console.log('🎯 All expected topics found');
    }
    
  } catch (error) {
    console.error('❌ Kafka connection failed:');
    console.error(error);
    process.exit(1);
  } finally {
    await admin.disconnect();
  }
}

verifyKafkaConnection();