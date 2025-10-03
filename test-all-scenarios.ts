#!/usr/bin/env node
/**
 * Run multiple test scenarios to find optimal settings
 */

import { runTest } from './test-azure-limits';
import type { TestConfig, TestResult } from './test-azure-limits';

const scenarios: TestConfig[] = [
  // Conservative
  { concurrency: 10, batchSize: 5, duration: 30, questionsPerBatch: 5 },
  { concurrency: 15, batchSize: 5, duration: 30, questionsPerBatch: 5 },
  
  // Balanced
  { concurrency: 20, batchSize: 5, duration: 30, questionsPerBatch: 5 },
  { concurrency: 25, batchSize: 5, duration: 30, questionsPerBatch: 5 },
  { concurrency: 30, batchSize: 5, duration: 30, questionsPerBatch: 5 },
  
  // Aggressive
  { concurrency: 35, batchSize: 5, duration: 30, questionsPerBatch: 5 },
  { concurrency: 40, batchSize: 5, duration: 30, questionsPerBatch: 5 },
  
  // Maximum
  { concurrency: 50, batchSize: 5, duration: 30, questionsPerBatch: 5 },
];

async function main() {
  console.log('\n🧪 Running Multiple Test Scenarios');
  console.log('━'.repeat(60));
  console.log(`📊 ${scenarios.length} scenarios queued\n`);
  
  const results: TestResult[] = [];
  
  for (let i = 0; i < scenarios.length; i++) {
    console.log(`\n[${i + 1}/${scenarios.length}] Starting scenario...`);
    
    try {
      const result = await runTest(scenarios[i]);
      results.push(result);
      
      // Wait 5 seconds between tests to avoid sustained rate limiting
      if (i < scenarios.length - 1) {
        console.log('\n⏳ Waiting 5s before next test...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error: any) {
      console.error(`\n❌ Scenario ${i + 1} failed:`, error.message);
    }
  }
  
  // Find optimal configuration
  console.log('\n\n📊 All Results Summary:');
  console.log('━'.repeat(80));
  console.log('Concurrency | Success | Rate Limited | Avg Time | RPM   | TPM    | Status');
  console.log('━'.repeat(80));
  
  let bestConfig: TestResult | null = null;
  let bestScore = 0;
  
  for (const result of results) {
    const status = result.rateLimited > 0 ? '❌ Throttled' : 
                   result.failed > 2 ? '⚠️ Errors' : '✅ Good';
    
    // Score = successful requests with penalties for rate limiting and failures
    const score = result.successful - (result.rateLimited * 10) - (result.failed * 5);
    
    if (score > bestScore && result.rateLimited === 0) {
      bestScore = score;
      bestConfig = result;
    }
    
    console.log(
      `${String(result.config.concurrency).padStart(11)} | ` +
      `${String(result.successful).padStart(7)} | ` +
      `${String(result.rateLimited).padStart(12)} | ` +
      `${(result.avgResponseTime / 1000).toFixed(1).padStart(8)}s | ` +
      `${String(Math.round(result.rpm)).padStart(5)} | ` +
      `${String(Math.round(result.tpm)).padStart(6)} | ` +
      status
    );
  }
  
  console.log('━'.repeat(80));
  
  // Print recommendation
  if (bestConfig) {
    console.log('\n🎯 OPTIMAL CONFIGURATION FOUND:');
    console.log('━'.repeat(60));
    console.log(`✅ Concurrency:  ${bestConfig.config.concurrency}`);
    console.log(`✅ Batch Size:   ${bestConfig.config.questionsPerBatch} questions`);
    console.log(`📈 RPM:          ${bestConfig.rpm.toFixed(0)} requests/min`);
    console.log(`🔢 TPM:          ${bestConfig.tpm.toFixed(0)} tokens/min`);
    console.log(`⏱️  Avg Response: ${(bestConfig.avgResponseTime / 1000).toFixed(2)}s`);
    
    // Calculate time for 196 questions
    const totalBatches = Math.ceil(196 / bestConfig.config.questionsPerBatch);
    const waves = Math.ceil(totalBatches / bestConfig.config.concurrency);
    const estimatedTime = waves * (bestConfig.avgResponseTime / 1000);
    
    console.log(`\n⏱️  For 196 questions:`);
    console.log(`   - Total batches: ${totalBatches}`);
    console.log(`   - Waves needed: ${waves}`);
    console.log(`   - Estimated time: ${estimatedTime.toFixed(0)}s (~${(estimatedTime / 60).toFixed(1)}min)`);
    console.log(`   - Estimated cost: $${(bestConfig.costUSD / bestConfig.successful / bestConfig.config.questionsPerBatch * 196).toFixed(4)}`);
    
    console.log(`\n📝 Update your code:`);
    console.log(`   const CONCURRENCY = ${bestConfig.config.concurrency};`);
    console.log(`   const BATCH_SIZE = ${bestConfig.config.questionsPerBatch};`);
  } else {
    console.log('\n⚠️  No optimal configuration found without rate limiting.');
    console.log('    Try running with lower concurrency values (5-15).');
  }
  
  // Save comprehensive results
  const fs = await import('fs/promises');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await fs.writeFile(
    `all-scenarios-${timestamp}.json`,
    JSON.stringify({ scenarios: results, bestConfig }, null, 2)
  );
  
  console.log(`\n💾 Full results saved to: all-scenarios-${timestamp}.json`);
}

main().catch(console.error);
