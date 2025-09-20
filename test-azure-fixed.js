// Simple test for Azure OpenAI with Node.js
require('dotenv').config();

function getEnv(name, fallback = '') {
  return process.env[name] ?? fallback;
}

function isAzureConfigured() {
  const key = getEnv('AZURE_OPENAI_API_KEY');
  const endpoint = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME') || getEnv('AZURE_OPENAI_DEPLOYMENT');
  return Boolean(key && endpoint && deployment);
}

async function chatCompletion(messages, options = {}) {
  if (!isAzureConfigured()) {
    return { content: '', finishReason: 'azure-not-configured' };
  }

  const apiKey = getEnv('AZURE_OPENAI_API_KEY');
  const endpoint = getEnv('AZURE_OPENAI_TARGET') || getEnv('AZURE_OPENAI_ENDPOINT');
  const deployment = getEnv('AZURE_OPENAI_CHAT_DEPLOYMENT') || getEnv('AZURE_OPENAI_DEPLOYMENT_NAME') || getEnv('AZURE_OPENAI_DEPLOYMENT');
  const apiVersion = getEnv('AZURE_OPENAI_API_VERSION') || '2024-05-01-preview';

  const normalizedEndpoint = endpoint.replace(/\/$/, '');
  const url = `${normalizedEndpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  
  const hasJson = messages.some(m => /json/i.test(String(m.content || '')));
  const prepend = hasJson ? [] : [{ role: 'system', content: 'Return a strict JSON object only. Reply in json. No prose.' }];
  const allMessages = [...prepend, ...messages];

  const body = {
    messages: allMessages,
    response_format: { type: 'json_object' },
    max_completion_tokens: options.maxTokens ?? 8000
  };

  console.log(`[AzureAI] Direct REST call to: ${url}`);
  console.log(`[AzureAI] Deployment: ${deployment}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Azure REST API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content || '';
  const finishReason = json?.choices?.[0]?.finish_reason || '';

  return { content, finishReason };
}

async function testAzure() {
  console.log('Testing Azure configuration...');
  console.log('Azure configured:', isAzureConfigured());
  
  if (!isAzureConfigured()) {
    console.log('Azure not configured, skipping test');
    return;
  }

  try {
    console.log('Testing chat completion...');
    const messages = [
      { role: 'user', content: 'Return a simple JSON object with just {"status": "working"}' }
    ];
    
    const result = await chatCompletion(messages, { maxTokens: 100 });
    console.log('Result:', result);
    console.log('Success! Azure is working with the new implementation.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAzure();