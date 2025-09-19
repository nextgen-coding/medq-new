const { isAzureConfigured, chatCompletion } = require('./src/lib/ai/azureClient');

async function testAzure() {
  console.log('Testing Azure OpenAI configuration...');
  
  // Check configuration
  console.log('Is Azure configured?', isAzureConfigured());
  
  if (!isAzureConfigured()) {
    console.log('Azure OpenAI not configured');
    return;
  }
  
  // Test simple call
  try {
    console.log('Testing simple chat completion...');
    const result = await chatCompletion([
      { role: 'user', content: 'Test simple response. Reply with just {"status": "ok", "message": "test successful"}' }
    ], { maxTokens: 100 });
    
    console.log('Success! Response:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAzure();