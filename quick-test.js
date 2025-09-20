require('dotenv').config();

async function testAzureQuick() {
  const messages = [{ role: 'user', content: 'Return JSON: {"status": "working", "message": "Azure GPT-5 is operational"}' }];
  
  const response = await fetch('https://nextgen-east-us2.openai.azure.com/openai/deployments/gpt-5-mini/chat/completions?api-version=2024-05-01-preview', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.AZURE_OPENAI_API_KEY
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'Return a strict JSON object only. Reply in json. No prose.' },
        ...messages
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 500
    })
  });
  
  const json = await response.json();
  console.log('Response:', JSON.stringify(json, null, 2));
}

testAzureQuick().catch(console.error);