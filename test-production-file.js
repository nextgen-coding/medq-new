#!/usr/bin/env node
/**
 * Production File Concurrency Test
 * Tests using actual "Copy of DCEM 2.xlsx" file
 */

require('dotenv/config');
const XLSX = require('xlsx');

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT;
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';

console.log('\n🧪 Production File Concurrency Test');
console.log('━'.repeat(60));
console.log(`📁 File: Copy of DCEM 2.xlsx`);
console.log(`🔧 Deployment: ${AZURE_DEPLOYMENT}\n`);

// Read actual production file
console.log('📖 Reading production file...');
const workbook = XLSX.readFile('Copy of DCEM 2.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet);

console.log(`✅ Loaded ${rows.length} rows from sheet "${sheetName}"\n`);

// Extract MCQ questions from qcm sheet (use all 49 rows)
const mcqQuestions = rows
  .filter(row => row['texte de la question'] && row['option A'])
  .map((row, idx) => ({
    id: String(idx),
    question: row['texte de la question'],
    options: [
      row['option A'] || '',
      row['option B'] || '',
      row['option C'] || '',
      row['option D'] || '',
      row['option E'] || ''
    ].filter(Boolean),
    correctAnswer: row['reponse'] || 'A'
  }));

console.log(`🔢 Extracted ${mcqQuestions.length} MCQ questions for testing\n`);

// Test with specific concurrency
async function testConcurrency(concurrency, batchSize = 5) {
  console.log(`🧪 Testing CONCURRENCY=${concurrency}, BATCH_SIZE=${batchSize}`);
  console.log('━'.repeat(60));
  
  const url = `${AZURE_ENDPOINT}/openai/deployments/${encodeURIComponent(AZURE_DEPLOYMENT)}/chat/completions?api-version=${encodeURIComponent(AZURE_API_VERSION)}`;
  
  const startTime = Date.now();
  let successful = 0;
  let failed = 0;
  let rateLimited = 0;
  let totalTokens = 0;
  
  // Create batches
  const batches = [];
  for (let i = 0; i < mcqQuestions.length; i += batchSize) {
    batches.push(mcqQuestions.slice(i, i + batchSize));
  }
  
  console.log(`📦 Processing ${batches.length} batches...`);
  
  // Process in waves
  for (let i = 0; i < batches.length; i += concurrency) {
    const wave = Math.floor(i / concurrency) + 1;
    const batchesToProcess = batches.slice(i, i + concurrency);
    
    const promises = batchesToProcess.map(async (batch, idx) => {
      const batchNum = i + idx + 1;
      const batchStart = Date.now();
      
      try {
        const systemPrompt = `Tu es un expert médical. Pour chaque question, génère une explication détaillée (3-5 phrases) en JSON strict.`;
        const userContent = JSON.stringify({
          task: 'analyze_mcq',
          questions: batch
        });
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'api-key': AZURE_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: systemPrompt + ' Reply in json format.' },
              { role: 'user', content: userContent }
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: 800
          })
        });
        
        const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
        
        if (response.status === 429) {
          rateLimited++;
          console.log(`🚫 Batch ${batchNum}/${batches.length}: Rate limited (${elapsed}s)`);
          return { rateLimited: true, elapsed: parseFloat(elapsed) };
        }
        
        if (!response.ok) {
          failed++;
          const error = await response.text();
          console.log(`❌ Batch ${batchNum}/${batches.length}: Failed (${elapsed}s)`);
          return { failed: true, elapsed: parseFloat(elapsed) };
        }
        
        const data = await response.json();
        const tokens = data.usage?.total_tokens || 0;
        totalTokens += tokens;
        successful++;
        
        console.log(`✅ Batch ${batchNum}/${batches.length}: Success (${elapsed}s, ${tokens} tokens)`);
        return { success: true, tokens, elapsed: parseFloat(elapsed) };
        
      } catch (error) {
        failed++;
        const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
        console.log(`❌ Batch ${batchNum}/${batches.length}: Error - ${error.message}`);
        return { failed: true, elapsed: parseFloat(elapsed) };
      }
    });
    
    await Promise.all(promises);
    
    console.log(`🌊 Wave ${wave} complete\n`);
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('📊 Results:');
  console.log('━'.repeat(60));
  console.log(`✅ Successful:     ${successful}/${batches.length} batches`);
  console.log(`🚫 Rate Limited:   ${rateLimited} batches`);
  console.log(`❌ Failed:         ${failed} batches`);
  console.log(`⏱️  Total Time:     ${totalTime}s`);
  console.log(`🔢 Total Tokens:   ${totalTokens}`);
  
  // Calculate for 196 questions (98 MCQ + 98 QROC)
  const questionsProcessed = successful * batchSize;
  const avgTimePerBatch = parseFloat(totalTime) / batches.length;
  const totalBatchesFor196 = Math.ceil(196 / batchSize);
  const wavesNeeded = Math.ceil(totalBatchesFor196 / concurrency);
  const estimatedTime = wavesNeeded * avgTimePerBatch * concurrency;
  
  console.log(`\n🎯 Projection for 196 questions (98 MCQ + 98 QROC):`);
  console.log(`   Total batches needed: ${totalBatchesFor196}`);
  console.log(`   Waves needed: ${wavesNeeded}`);
  console.log(`   Estimated time: ${Math.round(estimatedTime)}s (~${(estimatedTime / 60).toFixed(1)}min)`);
  
  let recommendation;
  if (rateLimited > 0) {
    recommendation = `❌ Rate limited! Reduce concurrency to ${Math.floor(concurrency * 0.7)}`;
  } else if (failed > 0) {
    recommendation = `⚠️ ${failed} batches failed - investigate errors`;
  } else {
    recommendation = `✅ Perfect! No rate limiting, all batches successful`;
  }
  
  console.log(`\n💡 ${recommendation}`);
  console.log('━'.repeat(60) + '\n');
  
  return {
    concurrency,
    successful,
    rateLimited,
    failed,
    totalTime: parseFloat(totalTime),
    estimatedTimeFor196: Math.round(estimatedTime),
    recommendation
  };
}

// Main function
async function main() {
  const tests = [
    { concurrency: 15, batchSize: 5 },
    { concurrency: 20, batchSize: 5 },
    { concurrency: 25, batchSize: 5 },
    { concurrency: 30, batchSize: 5 },
    { concurrency: 35, batchSize: 5 },
    { concurrency: 40, batchSize: 5 }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const result = await testConcurrency(test.concurrency, test.batchSize);
      results.push(result);
      
      // Stop if rate limiting detected
      if (result.rateLimited > 0) {
        console.log(`\n⚠️  Rate limiting detected. Stopping tests.\n`);
        break;
      }
      
      // Wait 5 seconds between tests
      if (tests.indexOf(test) < tests.length - 1) {
        console.log('⏳ Waiting 5s before next test...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`❌ Test failed:`, error.message);
    }
  }
  
  // Summary
  console.log('\n\n📊 FINAL SUMMARY:');
  console.log('━'.repeat(80));
  console.log('Concurrency | Success | Rate Limited | Est. Time (196Q) | Status');
  console.log('━'.repeat(80));
  
  let bestConfig = null;
  let bestTime = Infinity;
  
  for (const r of results) {
    const totalBatches = Math.ceil(mcqQuestions.length / 5);
    const status = r.rateLimited > 0 ? '❌ Throttled' : 
                   r.failed > 0 ? '⚠️ Some failed' : 
                   '✅ Perfect';
    
    console.log(
      `${String(r.concurrency).padStart(11)} | ` +
      `${String(r.successful).padStart(7)} | ` +
      `${String(r.rateLimited).padStart(12)} | ` +
      `${String(r.estimatedTimeFor196) + 's'.padStart(16)} | ` +
      status
    );
    
    if (r.rateLimited === 0 && r.failed === 0 && r.estimatedTimeFor196 < bestTime) {
      bestTime = r.estimatedTimeFor196;
      bestConfig = r;
    }
  }
  
  console.log('━'.repeat(80));
  
  if (bestConfig) {
    console.log('\n🎯 OPTIMAL CONFIGURATION:');
    console.log('━'.repeat(60));
    console.log(`✅ CONCURRENCY:  ${bestConfig.concurrency}`);
    console.log(`✅ BATCH_SIZE:   5 questions`);
    console.log(`⏱️  Expected time: ${bestConfig.estimatedTimeFor196}s (~${(bestConfig.estimatedTimeFor196 / 60).toFixed(1)}min) for 196 questions`);
    console.log(`💰 Improvement:  ${((692 / bestConfig.estimatedTimeFor196).toFixed(1))}x faster than current 11.5min`);
    console.log(`\n📝 Update your code:`);
    console.log(`   const CONCURRENCY = ${bestConfig.concurrency};`);
    console.log(`   const BATCH_SIZE = 5;`);
  } else {
    console.log('\n⚠️  No optimal configuration found without rate limiting.');
  }
}

main().catch(console.error);
