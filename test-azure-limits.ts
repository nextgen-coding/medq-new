#!/usr/bin/env node
/**
 * Azure OpenAI Rate Limits Testing Tool
 * Tests RPM, TPM, concurrency, and finds optimal batch settings
 */

import 'dotenv/config';
import axios from 'axios';

interface TestConfig {
  concurrency: number;
  batchSize: number;
  duration: number;
  questionsPerBatch: number;
}

interface TestResult {
  config: TestConfig;
  successful: number;
  failed: number;
  rateLimited: number;
  avgResponseTime: number;
  totalTokens: number;
  rpm: number;
  tpm: number;
  costUSD: number;
  recommendation: string;
}

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || process.env.AZURE_OPENAI_DEPLOYMENT;

if (!AZURE_ENDPOINT || !AZURE_KEY || !AZURE_DEPLOYMENT) {
  console.error('❌ Missing environment variables:');
  console.error('   AZURE_OPENAI_ENDPOINT');
  console.error('   AZURE_OPENAI_API_KEY');
  console.error('   AZURE_OPENAI_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT_NAME');
  process.exit(1);
}

// Simulate MCQ questions for testing
const generateMockMCQ = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    question: `Question médicale ${i + 1}: Quelle est la cause la plus fréquente de céphalées ?`,
    options: [
      'A. Migraine',
      'B. Tension artérielle élevée',
      'C. Tumeur cérébrale',
      'D. Stress',
      'E. Déshydratation'
    ],
    correctAnswer: 'A'
  }));
};

// Call Azure OpenAI API
async function callAzureAPI(questions: any[], attempt = 0): Promise<{ tokens: number; responseTime: number; rateLimited: boolean }> {
  const startTime = Date.now();
  
  const systemPrompt = `Tu es un assistant médical. Génère une explication courte (2-3 phrases) pour chaque question.`;
  const userContent = JSON.stringify({ task: 'analyze', questions });

  try {
    const response = await axios.post(
      `${AZURE_ENDPOINT}/openai/deployments/${AZURE_DEPLOYMENT}/chat/completions?api-version=2024-08-01-preview`,
      {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'api-key': AZURE_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const responseTime = Date.now() - startTime;
    const tokens = (response.data.usage?.total_tokens || 0);
    
    return { tokens, responseTime, rateLimited: false };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
      console.log(`⏳ Rate limited (429), retry after ${retryAfter}s`);
      
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return callAzureAPI(questions, attempt + 1);
      }
      
      return { tokens: 0, responseTime, rateLimited: true };
    }
    
    throw error;
  }
}

// Run test with specific configuration
async function runTest(config: TestConfig): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${config.concurrency} concurrent, ${config.questionsPerBatch} Q/batch, ${config.duration}s`);
  console.log('━'.repeat(60));
  
  const startTime = Date.now();
  const endTime = startTime + (config.duration * 1000);
  
  let successful = 0;
  let failed = 0;
  let rateLimited = 0;
  let totalTokens = 0;
  let totalResponseTime = 0;
  let totalRequests = 0;
  
  const activeBatches: Promise<void>[] = [];
  
  while (Date.now() < endTime || activeBatches.length > 0) {
    // Launch new batches up to concurrency limit
    while (activeBatches.length < config.concurrency && Date.now() < endTime) {
      const questions = generateMockMCQ(config.questionsPerBatch);
      
      const batchPromise = callAzureAPI(questions)
        .then((result) => {
          successful++;
          totalTokens += result.tokens;
          totalResponseTime += result.responseTime;
          totalRequests++;
          
          if (result.rateLimited) {
            rateLimited++;
          }
          
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`\r✅ ${successful} | ❌ ${failed} | ⏱️ ${elapsed}s | 🔢 ${totalTokens} tokens   `);
        })
        .catch((error) => {
          failed++;
          console.error(`\n❌ Error: ${error.message}`);
        })
        .finally(() => {
          const index = activeBatches.indexOf(batchPromise);
          if (index > -1) activeBatches.splice(index, 1);
        });
      
      activeBatches.push(batchPromise);
      
      // Small delay to prevent instant burst
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Wait for at least one batch to complete
    if (activeBatches.length > 0) {
      await Promise.race(activeBatches);
    }
  }
  
  // Wait for remaining batches
  await Promise.all(activeBatches);
  
  const totalTime = (Date.now() - startTime) / 1000;
  const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
  const rpm = (successful / totalTime) * 60;
  const tpm = (totalTokens / totalTime) * 60;
  
  // GPT-4o pricing: $5 per 1M tokens (input + output combined estimate)
  const costUSD = (totalTokens / 1_000_000) * 5;
  
  // Determine recommendation
  let recommendation = '';
  if (rateLimited > 0) {
    recommendation = '❌ Rate limited - reduce concurrency';
  } else if (failed > successful * 0.1) {
    recommendation = '⚠️ High failure rate - investigate errors';
  } else if (avgResponseTime > 10000) {
    recommendation = '⚠️ Slow responses - consider reducing concurrency';
  } else {
    recommendation = '✅ Good configuration - no issues detected';
  }
  
  console.log('\n');
  
  return {
    config,
    successful,
    failed,
    rateLimited,
    avgResponseTime,
    totalTokens,
    rpm,
    tpm,
    costUSD,
    recommendation
  };
}

// Print results
function printResults(result: TestResult) {
  console.log('\n📊 Test Results:');
  console.log('━'.repeat(60));
  console.log(`✅ Successful:     ${result.successful} requests`);
  console.log(`❌ Failed:         ${result.failed} requests`);
  console.log(`🚫 Rate Limited:   ${result.rateLimited} requests`);
  console.log(`⏱️  Avg Response:   ${(result.avgResponseTime / 1000).toFixed(2)}s`);
  console.log(`📈 RPM Achieved:   ${result.rpm.toFixed(0)} requests/min`);
  console.log(`🔢 TPM Achieved:   ${result.tpm.toFixed(0)} tokens/min`);
  console.log(`💰 Cost:           $${result.costUSD.toFixed(4)}`);
  console.log(`\n💡 ${result.recommendation}`);
  console.log('━'.repeat(60));
}

// Main test runner
async function main() {
  const args = process.argv.slice(2);
  const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '20', 10);
  const duration = parseInt(args.find(a => a.startsWith('--duration='))?.split('=')[1] || '60', 10);
  const batchSize = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] || '5', 10);
  
  console.log('\n🧪 Azure OpenAI Rate Limits Testing');
  console.log('━'.repeat(60));
  console.log(`📍 Endpoint:  ${AZURE_ENDPOINT}`);
  console.log(`🔧 Deployment: ${AZURE_DEPLOYMENT}`);
  console.log(`⚙️  Config:     ${concurrency} concurrent, ${batchSize} Q/batch, ${duration}s`);
  
  const config: TestConfig = {
    concurrency,
    batchSize,
    duration,
    questionsPerBatch: batchSize
  };
  
  try {
    const result = await runTest(config);
    printResults(result);
    
    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-results-${timestamp}.json`;
    const fs = await import('fs/promises');
    await fs.writeFile(filename, JSON.stringify(result, null, 2));
    console.log(`\n💾 Results saved to: ${filename}`);
    
    // Provide recommendations for 196 questions
    console.log('\n🎯 Recommendations for 196 questions:');
    console.log('━'.repeat(60));
    
    if (result.rateLimited === 0 && result.failed < 2) {
      const questionsPerSecond = result.rpm / 60 * batchSize;
      const estimatedTime = 196 / questionsPerSecond;
      console.log(`✅ This configuration can handle your workload!`);
      console.log(`⏱️  Estimated time: ${estimatedTime.toFixed(0)}s for 196 questions`);
      console.log(`💰 Estimated cost: $${(result.costUSD / result.successful / batchSize * 196).toFixed(4)}`);
    } else {
      console.log(`⚠️  Try reducing concurrency to ${Math.floor(concurrency * 0.7)}`);
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { runTest };
export type { TestConfig, TestResult };
