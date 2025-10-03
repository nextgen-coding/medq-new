#!/usr/bin/env node
/**
 * Quick Concurrency Test - Based on actual working code
 */

require('dotenv/config');

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';

console.log('\n🧪 Quick Azure Concurrency Test');
console.log('━'.repeat(60));
console.log(`Endpoint: ${AZURE_ENDPOINT}`);
console.log(`Deployment: ${AZURE_DEPLOYMENT}\n`);

// Test single concurrency level
async function testConcurrency(concurrency) {
  console.log(`Testing CONCURRENCY=${concurrency}...`);
  
  const url = `${AZURE_ENDPOINT}/openai/deployments/${encodeURIComponent(AZURE_DEPLOYMENT)}/chat/completions?api-version=${encodeURIComponent(AZURE_API_VERSION)}`;
  
  const startTime = Date.now();
  let successful = 0;
  let failed = 0;
  let rateLimited = 0;
  
  const calls = [];
  
  for (let i = 0; i < concurrency; i++) {
    const call = fetch(url, {
      method: 'POST',
      headers: {
        'api-key': AZURE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Return strict JSON only. Reply in json format.' },
          { role: 'user', content: JSON.stringify({ task: 'Explain hypertension in 2 sentences' }) }
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 500
      })
    })
    .then(async (res) => {
      if (res.status === 429) {
        rateLimited++;
        return { rateLimited: true };
      }
      if (!res.ok) {
        failed++;
        const error = await res.text();
        return { error };
      }
      successful++;
      const data = await res.json();
      return { tokens: data.usage?.total_tokens || 0 };
    })
    .catch((err) => {
      failed++;
      return { error: err.message };
    });
    
    calls.push(call);
  }
  
  await Promise.all(calls);
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`✅ Success: ${successful} | 🚫 Rate limited: ${rateLimited} | ❌ Failed: ${failed} | ⏱️ ${elapsed}s`);
  
  return { concurrency, successful, rateLimited, failed, elapsed };
}

// Run tests
async function main() {
  const levels = [10, 15, 20, 25, 30, 35, 40];
  const results = [];
  
  for (const level of levels) {
    const result = await testConcurrency(level);
    results.push(result);
    
    if (result.rateLimited > 0) {
      console.log(`\n⚠️  Rate limiting at ${level}. Stopping.\n`);
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('━'.repeat(60));
  console.log('Concurrency | Success | Rate Limited | Status');
  console.log('━'.repeat(60));
  
  let best = null;
  
  for (const r of results) {
    const status = r.rateLimited > 0 ? '❌ Throttled' : r.successful === r.concurrency ? '✅ Perfect' : '⚠️ Some failed';
    console.log(`${String(r.concurrency).padStart(11)} | ${String(r.successful).padStart(7)} | ${String(r.rateLimited).padStart(12)} | ${status}`);
    
    if (r.rateLimited === 0 && r.successful === r.concurrency) {
      best = r;
    }
  }
  
  console.log('━'.repeat(60));
  
  if (best) {
    console.log(`\n🎯 OPTIMAL: CONCURRENCY=${best.concurrency}`);
    console.log(`   Estimated time for 196 questions: ~${Math.ceil(196 / (best.concurrency * 5) * parseFloat(best.elapsed) * 1.2)}s\n`);
  }
}

main().catch(console.error);
