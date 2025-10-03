#!/usr/bin/env node
/**
 * Simple Azure OpenAI Concurrency Test
 * Tests different concurrency levels to find optimal settings
 */

require('dotenv/config');

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';

if (!AZURE_ENDPOINT || !AZURE_KEY || !AZURE_DEPLOYMENT) {
  console.error('❌ Missing environment variables in .env file');
  process.exit(1);
}

console.log('\n🧪 Azure OpenAI Concurrency Test');
console.log('━'.repeat(60));
console.log(`📍 Endpoint:  ${AZURE_ENDPOINT}`);
console.log(`🔧 Deployment: ${AZURE_DEPLOYMENT}`);
console.log(`📅 API Version: ${AZURE_API_VERSION}\n`);

// Mock MCQ question
function generateMockQuestion(id) {
  return {
    id: String(id),
    question: `Question médicale ${id}: Quelle est la cause principale d'une pathologie cardiaque?`,
    options: ['A. Hypertension', 'B. Diabète', 'C. Obésité', 'D. Tabagisme', 'E. Sédentarité'],
    correctAnswer: 'A'
  };
}

// Call Azure OpenAI API
async function callAzure(questions, retries = 0) {
  const startTime = Date.now();
  
  const url = `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=${AZURE_API_VERSION}`;
  
  const systemPrompt = `Tu es un assistant médical. Génère une courte explication (1-2 phrases) pour chaque question.`;
  const userContent = JSON.stringify({ task: 'analyze', questions });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': AZURE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
      
      if (retries < 3) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return callAzure(questions, retries + 1);
      }
      
      return { success: false, rateLimited: true, responseTime, tokens: 0 };
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const tokens = data.usage?.total_tokens || 0;
    
    return { success: true, rateLimited: false, responseTime, tokens };
  } catch (error) {
    return { success: false, rateLimited: false, responseTime: Date.now() - startTime, tokens: 0, error: error.message };
  }
}

// Test with specific concurrency
async function testConcurrency(concurrency, duration = 60) {
  console.log(`\n🧪 Testing CONCURRENCY=${concurrency} for ${duration}s`);
  console.log('━'.repeat(60));
  
  const startTime = Date.now();
  const endTime = startTime + (duration * 1000);
  
  let successful = 0;
  let failed = 0;
  let rateLimited = 0;
  let totalTokens = 0;
  let totalResponseTime = 0;
  let activeBatches = [];
  
  while (Date.now() < endTime || activeBatches.length > 0) {
    // Launch new batches up to concurrency limit
    while (activeBatches.length < concurrency && Date.now() < endTime) {
      const questions = Array.from({ length: 5 }, (_, i) => generateMockQuestion(i));
      
      const batchPromise = callAzure(questions)
        .then((result) => {
          if (result.success) {
            successful++;
            totalTokens += result.tokens;
            totalResponseTime += result.responseTime;
          } else if (result.rateLimited) {
            rateLimited++;
          } else {
            failed++;
          }
          
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`\r✅ ${successful} | 🚫 ${rateLimited} | ❌ ${failed} | ⏱️ ${elapsed}s | 🔢 ${totalTokens} tokens   `);
        })
        .catch(() => {
          failed++;
        })
        .finally(() => {
          const index = activeBatches.indexOf(batchPromise);
          if (index > -1) activeBatches.splice(index, 1);
        });
      
      activeBatches.push(batchPromise);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Wait for at least one batch to complete
    if (activeBatches.length > 0) {
      await Promise.race(activeBatches);
    }
  }
  
  console.log('\n');
  
  const totalTime = (Date.now() - startTime) / 1000;
  const avgResponseTime = successful > 0 ? totalResponseTime / successful : 0;
  const rpm = (successful / totalTime) * 60;
  const tpm = (totalTokens / totalTime) * 60;
  
  // Calculate for 196 questions
  const questionsPerSecond = rpm / 60 * 5; // 5 questions per batch
  const estimatedTime = questionsPerSecond > 0 ? 196 / questionsPerSecond : Infinity;
  
  console.log('📊 Results:');
  console.log('━'.repeat(60));
  console.log(`✅ Successful:     ${successful} requests`);
  console.log(`🚫 Rate Limited:   ${rateLimited} requests`);
  console.log(`❌ Failed:         ${failed} requests`);
  console.log(`⏱️  Avg Response:   ${(avgResponseTime / 1000).toFixed(2)}s`);
  console.log(`📈 RPM:            ${rpm.toFixed(0)} requests/min`);
  console.log(`🔢 TPM:            ${tpm.toFixed(0)} tokens/min`);
  console.log(`\n🎯 For 196 questions:`);
  console.log(`   Estimated time: ${estimatedTime.toFixed(0)}s (~${(estimatedTime / 60).toFixed(1)}min)`);
  
  let recommendation;
  if (rateLimited > 0) {
    recommendation = `❌ Rate limited! Reduce to ${Math.floor(concurrency * 0.7)}`;
  } else if (failed > successful * 0.1) {
    recommendation = '⚠️ High failure rate';
  } else {
    recommendation = '✅ Good configuration!';
  }
  
  console.log(`\n💡 ${recommendation}`);
  console.log('━'.repeat(60));
  
  return {
    concurrency,
    successful,
    rateLimited,
    failed,
    avgResponseTime: avgResponseTime / 1000,
    rpm,
    tpm,
    estimatedTime,
    recommendation
  };
}

// Main function
async function main() {
  const concurrencyLevels = [10, 15, 20, 25, 30, 35, 40];
  const results = [];
  
  console.log(`\n📋 Testing ${concurrencyLevels.length} concurrency levels...`);
  console.log('⏱️  Each test runs for 60 seconds\n');
  
  for (const level of concurrencyLevels) {
    try {
      const result = await testConcurrency(level, 60);
      results.push(result);
      
      // Stop if we hit rate limiting
      if (result.rateLimited > 0) {
        console.log(`\n⚠️  Rate limiting detected at ${level}. Stopping tests.`);
        break;
      }
      
      // Wait 5 seconds between tests
      if (concurrencyLevels.indexOf(level) < concurrencyLevels.length - 1) {
        console.log('\n⏳ Waiting 5s before next test...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`\n❌ Test failed for concurrency ${level}:`, error.message);
    }
  }
  
  // Find optimal
  console.log('\n\n📊 FINAL RESULTS:');
  console.log('━'.repeat(80));
  console.log('Concurrency | Success | Rate Limited | Est. Time | Recommendation');
  console.log('━'.repeat(80));
  
  let bestConfig = null;
  let bestScore = 0;
  
  for (const result of results) {
    const score = result.successful - (result.rateLimited * 10) - (result.failed * 5);
    
    if (score > bestScore && result.rateLimited === 0) {
      bestScore = score;
      bestConfig = result;
    }
    
    const status = result.rateLimited > 0 ? '❌ Throttled' : result.failed > 2 ? '⚠️ Errors' : '✅ Good';
    
    console.log(
      `${String(result.concurrency).padStart(11)} | ` +
      `${String(result.successful).padStart(7)} | ` +
      `${String(result.rateLimited).padStart(12)} | ` +
      `${String(Math.round(result.estimatedTime)) + 's'.padStart(9)} | ` +
      status
    );
  }
  
  console.log('━'.repeat(80));
  
  if (bestConfig) {
    console.log('\n🎯 OPTIMAL CONFIGURATION:');
    console.log('━'.repeat(60));
    console.log(`✅ CONCURRENCY: ${bestConfig.concurrency}`);
    console.log(`✅ BATCH_SIZE:  5 questions`);
    console.log(`⏱️  Expected time for 196 questions: ${Math.round(bestConfig.estimatedTime)}s (~${(bestConfig.estimatedTime / 60).toFixed(1)}min)`);
    console.log(`\n📝 Update your code:`);
    console.log(`   const CONCURRENCY = ${bestConfig.concurrency};`);
    console.log(`   const BATCH_SIZE = 5;`);
  } else {
    console.log('\n⚠️  No optimal configuration found. Try lower values (5-10).');
  }
}

main().catch(console.error);
