/**
 * 🎯 COMPREHENSIVE AI ENRICHMENT OPTIMIZER
 * 
 * This script uses the EXACT production setup to test different configurations:
 * - Same Azure endpoint, deployment, API version
 * - Same system prompts (MCQ and QROC)
 * - Same batch processing logic
 * - Same Excel file structure
 * 
 * Tests all combinations of:
 * - BATCH_SIZE: 3, 5, 7, 10
 * - CONCURRENCY: 5, 8, 10, 12, 15
 * - INTER_WAVE_DELAY: 0s, 2s, 3s, 5s
 * 
 * Usage: node test-optimal-config.js
 */

require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');

// ============================================================================
// EXACT PRODUCTION AZURE CONFIGURATION
// ============================================================================

const AZURE_CONFIG = {
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_TARGET || process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT_NAME || process.env.AZURE_OPENAI_DEPLOYMENT,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview'
};

const EXCEL_FILE = 'Copy of DCEM 2.xlsx';

// Validate configuration
if (!AZURE_CONFIG.apiKey || !AZURE_CONFIG.endpoint || !AZURE_CONFIG.deployment) {
  console.error('❌ Missing Azure configuration! Check your .env file:');
  console.error('   - AZURE_OPENAI_API_KEY');
  console.error('   - AZURE_OPENAI_TARGET (or AZURE_OPENAI_ENDPOINT)');
  console.error('   - AZURE_OPENAI_CHAT_DEPLOYMENT (or AZURE_OPENAI_DEPLOYMENT_NAME)');
  process.exit(1);
}

if (!fs.existsSync(EXCEL_FILE)) {
  console.error(`❌ File not found: ${EXCEL_FILE}`);
  console.error('   Please ensure "Copy of DCEM 2.xlsx" is in the project root');
  process.exit(1);
}

console.log('✅ Configuration loaded:');
console.log(`   Endpoint: ${AZURE_CONFIG.endpoint}`);
console.log(`   Deployment: ${AZURE_CONFIG.deployment}`);
console.log(`   API Version: ${AZURE_CONFIG.apiVersion}`);
console.log(`   Excel File: ${EXCEL_FILE}\n`);

// ============================================================================
// EXACT PRODUCTION SYSTEM PROMPTS
// ============================================================================

const MCQ_SYSTEM_PROMPT = `Tu es un assistant pédagogique expert pour les étudiants en médecine.

Pour chaque QCM (Question à Choix Multiples), tu dois analyser minutieusement:
1. La question médicale et son contexte clinique
2. Chaque option de réponse (A, B, C, D, E)
3. Identifier toutes les réponses correctes (peut être 0, 1, ou plusieurs)
4. Fournir une explication globale du concept médical
5. Expliquer pourquoi chaque option est correcte ou incorrecte

Format de sortie JSON STRICT uniquement:
{
  "results": [
    {
      "id": "<id de la question>",
      "status": "ok",
      "correctAnswers": [0, 2],  // indices des réponses correctes (0=A, 1=B, etc.)
      "noAnswer": false,  // true si aucune réponse n'est correcte
      "globalExplanation": "Explication générale du concept médical (3-6 phrases)",
      "optionExplanations": [
        "Explication option A (2-4 phrases)",
        "Explication option B (2-4 phrases)",
        "Explication option C (2-4 phrases)",
        "Explication option D (2-4 phrases)",
        "Explication option E (2-4 phrases)"
      ]
    }
  ]
}

IMPORTANT: 
- Chaque explication doit être de niveau professoral, détaillée et pédagogique
- Les explications doivent aider l'étudiant à comprendre le POURQUOI
- Utilise un langage médical précis mais accessible
- JSON strict uniquement, pas de prose additionnelle`;

const QROC_SYSTEM_PROMPT = `Tu aides des étudiants en médecine. Pour chaque question QROC:
1. Si la réponse est vide: PRODUIS une réponse brève plausible ET une explication; status="ok" (jamais "error").
2. Sinon, génère UNE explication claire (3-6 phrases): idée clé, justification, mini repère clinique; pas d'intro/conclusion globales.
3. Sortie JSON STRICT uniquement.
Format:
{
  "results": [ { "id": "<id>", "status": "ok", "answer": "...", "fixedQuestionText": "...", "explanation": "..." } ]
}`;

// ============================================================================
// EXACT PRODUCTION API CALL LOGIC
// ============================================================================

async function callAzureAPI(messages, maxTokens = 8000) {
  const url = `${AZURE_CONFIG.endpoint}/openai/deployments/${encodeURIComponent(AZURE_CONFIG.deployment)}/chat/completions?api-version=${encodeURIComponent(AZURE_CONFIG.apiVersion)}`;
  
  const body = {
    messages,
    response_format: { type: 'json_object' },
    max_completion_tokens: maxTokens
  };

  const attempts = 5;
  let lastErr = null;

  for (let i = 1; i <= attempts; i++) {
    const attemptStart = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000); // 2 min timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_CONFIG.apiKey
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);
      const apiCallDuration = ((Date.now() - attemptStart) / 1000).toFixed(1);

      if (!response.ok) {
        const text = await response.text();
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const retryAfterMs = response.headers.get('retry-after-ms');
          const retryAfterMsValue = retryAfterMs ? parseInt(retryAfterMs) : null;
          
          let waitTime;
          if (retryAfterMsValue && !isNaN(retryAfterMsValue)) {
            waitTime = retryAfterMsValue;
          } else if (retryAfter) {
            waitTime = parseInt(retryAfter) * 1000;
          } else {
            waitTime = Math.min(2000 * Math.pow(2, i - 1), 60000); // 2s, 4s, 8s, 16s, 32s
          }
          
          console.warn(`   ⚠️  Rate Limited (429) after ${apiCallDuration}s, waiting ${(waitTime/1000).toFixed(1)}s...`);
          lastErr = { type: 'rate_limit', attempt: i, waitTime };
          
          if (i < attempts) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          } else {
            throw new Error(`Rate limit exceeded after ${attempts} attempts`);
          }
        }
        
        throw new Error(`Azure API error ${response.status}: ${text.substring(0, 200)}`);
      }

      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content || '';
      
      return { 
        content, 
        duration: parseFloat(apiCallDuration), 
        attempt: i,
        rateLimited: i > 1 
      };
    } catch (err) {
      lastErr = err;
      const msg = err.message || String(err);
      console.warn(`   ❌ Attempt ${i}/${attempts} failed: ${msg.substring(0, 100)}`);
      
      if (i < attempts && /fetch failed|ECONNRESET|ETIMEDOUT/i.test(msg)) {
        const backoff = 400 * i;
        console.warn(`   ⏳ Retrying in ${backoff}ms...`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      break;
    }
  }

  // Enhanced error with full details
  const enhancedError = new Error(lastErr?.message || 'API call failed after all retries');
  enhancedError.name = lastErr?.name || 'APIError';
  enhancedError.code = lastErr?.code;
  enhancedError.statusCode = lastErr?.statusCode;
  enhancedError.cause = lastErr?.cause;
  enhancedError.stack = lastErr?.stack;
  
  throw enhancedError;
}

// ============================================================================
// EXACT PRODUCTION MCQ PROCESSING
// ============================================================================

async function processMCQBatch(questions, batchSize = 5) {
  const batch = questions.slice(0, batchSize).map((q, idx) => ({
    id: String(idx),
    question: q.question,
    options: q.options
  }));

  const userMessage = JSON.stringify({
    task: 'mcq_analysis',
    questions: batch
  });

  const messages = [
    { role: 'system', content: MCQ_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  const result = await callAzureAPI(messages, 8000);
  
  try {
    const parsed = JSON.parse(result.content);
    return { 
      ...result, 
      results: Array.isArray(parsed?.results) ? parsed.results : [],
      success: true 
    };
  } catch (e) {
    console.error(`   [MCQ Parse Error] ${e.message}`);
    console.error(`   [MCQ Raw Response] ${result.content?.substring(0, 300)}...`);
    return { 
      ...result, 
      results: [], 
      success: false, 
      parseError: true,
      parseErrorMessage: e.message,
      rawContent: result.content?.substring(0, 500)
    };
  }
}

// ============================================================================
// EXACT PRODUCTION QROC PROCESSING
// ============================================================================

async function processQROCBatch(questions, batchSize = 5) {
  const batch = questions.slice(0, batchSize).map((q, idx) => ({
    id: String(idx),
    question: q.question,
    answer: q.answer || ''
  }));

  const userMessage = JSON.stringify({
    task: 'qroc_explanations',
    items: batch
  });

  const messages = [
    { role: 'system', content: QROC_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ];

  const result = await callAzureAPI(messages, 8000);
  
  try {
    const parsed = JSON.parse(result.content);
    return { 
      ...result, 
      results: Array.isArray(parsed?.results) ? parsed.results : [],
      success: true 
    };
  } catch (e) {
    console.error(`   [QROC Parse Error] ${e.message}`);
    console.error(`   [QROC Raw Response] ${result.content?.substring(0, 300)}...`);
    return { 
      ...result, 
      results: [], 
      success: false, 
      parseError: true,
      parseErrorMessage: e.message,
      rawContent: result.content?.substring(0, 500)
    };
  }
}

// ============================================================================
// EXCEL DATA EXTRACTION
// ============================================================================

function loadQuestionsFromExcel() {
  console.log(`📖 Reading ${EXCEL_FILE}...`);
  const workbook = XLSX.readFile(EXCEL_FILE);
  
  // Extract MCQ questions from 'qcm' sheet
  const mcqSheet = workbook.Sheets['qcm'];
  const mcqRows = XLSX.utils.sheet_to_json(mcqSheet);
  
  const mcqQuestions = mcqRows
    .filter(row => row['texte de la question'])
    .map((row, idx) => ({
      id: `mcq_${idx}`,
      question: row['texte de la question'],
      options: [
        row['option A'],
        row['option B'],
        row['option C'],
        row['option D'],
        row['option E']
      ].filter(Boolean)
    }));

  // Extract QROC questions from 'qroc' sheet
  const qrocSheet = workbook.Sheets['qroc'];
  const qrocRows = XLSX.utils.sheet_to_json(qrocSheet);
  
  const qrocQuestions = qrocRows
    .filter(row => row['texte de la question'])
    .map((row, idx) => ({
      id: `qroc_${idx}`,
      question: row['texte de la question'],
      answer: row['reponse'] || ''
    }));

  console.log(`✅ Loaded ${mcqQuestions.length} MCQ questions`);
  console.log(`✅ Loaded ${qrocQuestions.length} QROC questions\n`);

  return { mcqQuestions, qrocQuestions };
}

// ============================================================================
// PARALLEL PROCESSING WITH WAVES
// ============================================================================

async function testConfiguration(config) {
  const { BATCH_SIZE, CONCURRENCY, INTER_WAVE_DELAY, mcqQuestions, qrocQuestions } = config;
  
  console.log(`\n${'━'.repeat(80)}`);
  console.log(`🧪 Testing: BATCH_SIZE=${BATCH_SIZE}, CONCURRENCY=${CONCURRENCY}, DELAY=${INTER_WAVE_DELAY}s`);
  console.log(`${'━'.repeat(80)}`);

  const startTime = Date.now();
  const stats = {
    mcq: { batches: 0, success: 0, rateLimited: 0, failed: 0, totalTime: 0, tokens: 0 },
    qroc: { batches: 0, success: 0, rateLimited: 0, failed: 0, totalTime: 0, tokens: 0 },
    errors: []
  };

  // Create chunks for MCQ
  const mcqChunks = [];
  for (let i = 0; i < mcqQuestions.length; i += BATCH_SIZE) {
    mcqChunks.push(mcqQuestions.slice(i, i + BATCH_SIZE));
  }

  // Create chunks for QROC
  const qrocChunks = [];
  for (let i = 0; i < qrocQuestions.length; i += BATCH_SIZE) {
    qrocChunks.push(qrocQuestions.slice(i, i + BATCH_SIZE));
  }

  // Process MCQ and QROC in parallel (just like production)
  const processMCQ = async () => {
    console.log(`\n🔵 MCQ: Processing ${mcqQuestions.length} questions in ${mcqChunks.length} batches...`);
    
    for (let i = 0; i < mcqChunks.length; i += CONCURRENCY) {
      const wave = Math.floor(i / CONCURRENCY) + 1;
      const totalWaves = Math.ceil(mcqChunks.length / CONCURRENCY);
      const batch = mcqChunks.slice(i, i + CONCURRENCY);
      
      console.log(`   🌊 MCQ Wave ${wave}/${totalWaves}: ${batch.length} batches in parallel...`);
      const waveStart = Date.now();
      
      const promises = batch.map(async (chunk, localIndex) => {
        const batchNum = i + localIndex + 1;
        const batchStart = Date.now();
        
        try {
          const result = await processMCQBatch(chunk, BATCH_SIZE);
          const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
          
          stats.mcq.batches++;
          stats.mcq.totalTime += result.duration;
          stats.mcq.tokens += result.content?.length || 0;
          
          if (result.success) {
            stats.mcq.success++;
            console.log(`   ✅ MCQ Batch ${batchNum}/${mcqChunks.length}: ${elapsed}s${result.rateLimited ? ' (recovered from rate limit)' : ''}`);
          } else {
            stats.mcq.failed++;
            console.log(`   ❌ MCQ Batch ${batchNum}/${mcqChunks.length}: Failed (${elapsed}s)`);
            if (result.parseError) {
              console.log(`      └─ Parse Error: Invalid JSON response`);
              stats.errors.push({ 
                type: 'mcq', 
                batch: batchNum, 
                error: 'JSON Parse Error',
                details: result.content?.substring(0, 200) || 'No content'
              });
            }
          }
          
          if (result.rateLimited) {
            stats.mcq.rateLimited++;
          }
          
          return result;
        } catch (err) {
          stats.mcq.batches++;
          stats.mcq.failed++;
          const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
          
          // Extract detailed error information
          const errorDetails = {
            type: 'mcq',
            batch: batchNum,
            elapsed,
            message: err.message || String(err),
            stack: err.stack?.split('\n').slice(0, 5).join('\n') || '',
            name: err.name || 'Error',
            code: err.code || null,
            statusCode: err.statusCode || null
          };
          
          console.log(`   🚫 MCQ Batch ${batchNum}/${mcqChunks.length}: ERROR (${elapsed}s)`);
          console.log(`      └─ ${errorDetails.name}: ${errorDetails.message.substring(0, 150)}`);
          if (err.cause) {
            console.log(`      └─ Cause: ${err.cause}`);
          }
          
          stats.errors.push(errorDetails);
          return null;
        }
      });
      
      await Promise.all(promises);
      const waveDuration = ((Date.now() - waveStart) / 1000).toFixed(1);
      console.log(`   ✅ MCQ Wave ${wave}/${totalWaves} complete in ${waveDuration}s`);
      
      // Inter-wave delay
      if (wave < totalWaves && INTER_WAVE_DELAY > 0) {
        console.log(`   ⏸️  Cooling down ${INTER_WAVE_DELAY}s...`);
        await new Promise(resolve => setTimeout(resolve, INTER_WAVE_DELAY * 1000));
      }
    }
  };

  const processQROC = async () => {
    console.log(`\n🔷 QROC: Processing ${qrocQuestions.length} questions in ${qrocChunks.length} batches...`);
    
    for (let i = 0; i < qrocChunks.length; i += CONCURRENCY) {
      const wave = Math.floor(i / CONCURRENCY) + 1;
      const totalWaves = Math.ceil(qrocChunks.length / CONCURRENCY);
      const batch = qrocChunks.slice(i, i + CONCURRENCY);
      
      console.log(`   🌊 QROC Wave ${wave}/${totalWaves}: ${batch.length} batches in parallel...`);
      const waveStart = Date.now();
      
      const promises = batch.map(async (chunk, localIndex) => {
        const batchNum = i + localIndex + 1;
        const batchStart = Date.now();
        
        try {
          const result = await processQROCBatch(chunk, BATCH_SIZE);
          const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
          
          stats.qroc.batches++;
          stats.qroc.totalTime += result.duration;
          stats.qroc.tokens += result.content?.length || 0;
          
          if (result.success) {
            stats.qroc.success++;
            console.log(`   ✅ QROC Batch ${batchNum}/${qrocChunks.length}: ${elapsed}s${result.rateLimited ? ' (recovered from rate limit)' : ''}`);
          } else {
            stats.qroc.failed++;
            console.log(`   ❌ QROC Batch ${batchNum}/${qrocChunks.length}: Failed (${elapsed}s)`);
            if (result.parseError) {
              console.log(`      └─ Parse Error: Invalid JSON response`);
              stats.errors.push({ 
                type: 'qroc', 
                batch: batchNum, 
                error: 'JSON Parse Error',
                details: result.content?.substring(0, 200) || 'No content'
              });
            }
          }
          
          if (result.rateLimited) {
            stats.qroc.rateLimited++;
          }
          
          return result;
        } catch (err) {
          stats.qroc.batches++;
          stats.qroc.failed++;
          const elapsed = ((Date.now() - batchStart) / 1000).toFixed(1);
          
          // Extract detailed error information
          const errorDetails = {
            type: 'qroc',
            batch: batchNum,
            elapsed,
            message: err.message || String(err),
            stack: err.stack?.split('\n').slice(0, 5).join('\n') || '',
            name: err.name || 'Error',
            code: err.code || null,
            statusCode: err.statusCode || null
          };
          
          console.log(`   🚫 QROC Batch ${batchNum}/${qrocChunks.length}: ERROR (${elapsed}s)`);
          console.log(`      └─ ${errorDetails.name}: ${errorDetails.message.substring(0, 150)}`);
          if (err.cause) {
            console.log(`      └─ Cause: ${err.cause}`);
          }
          
          stats.errors.push(errorDetails);
          return null;
        }
      });
      
      await Promise.all(promises);
      const waveDuration = ((Date.now() - waveStart) / 1000).toFixed(1);
      console.log(`   ✅ QROC Wave ${wave}/${totalWaves} complete in ${waveDuration}s`);
      
      // Inter-wave delay
      if (wave < totalWaves && INTER_WAVE_DELAY > 0) {
        console.log(`   ⏸️  Cooling down ${INTER_WAVE_DELAY}s...`);
        await new Promise(resolve => setTimeout(resolve, INTER_WAVE_DELAY * 1000));
      }
    }
  };

  // Run MCQ and QROC in parallel (exact production behavior)
  await Promise.all([processMCQ(), processQROC()]);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(`\n📊 RESULTS:`);
  console.log(`${'─'.repeat(80)}`);
  console.log(`⏱️  Total Time: ${totalTime}s (${(totalTime / 60).toFixed(2)} minutes)`);
  console.log(`\n🔵 MCQ:`);
  console.log(`   Batches: ${stats.mcq.batches} | Success: ${stats.mcq.success} | Failed: ${stats.mcq.failed}`);
  console.log(`   Rate Limited: ${stats.mcq.rateLimited} | Avg Time: ${(stats.mcq.totalTime / stats.mcq.batches).toFixed(1)}s`);
  console.log(`\n🔷 QROC:`);
  console.log(`   Batches: ${stats.qroc.batches} | Success: ${stats.qroc.success} | Failed: ${stats.qroc.failed}`);
  console.log(`   Rate Limited: ${stats.qroc.rateLimited} | Avg Time: ${(stats.qroc.totalTime / stats.qroc.batches).toFixed(1)}s`);
  
  if (stats.errors.length > 0) {
    console.log(`\n❌ ERRORS DETECTED: ${stats.errors.length}`);
    console.log(`${'─'.repeat(80)}`);
    stats.errors.forEach((err, idx) => {
      console.log(`\n${idx + 1}. ${err.type.toUpperCase()} Batch #${err.batch}:`);
      console.log(`   Type: ${err.name || 'Error'}`);
      console.log(`   Message: ${err.message || err.error}`);
      if (err.elapsed) console.log(`   Duration: ${err.elapsed}s`);
      if (err.code) console.log(`   Code: ${err.code}`);
      if (err.statusCode) console.log(`   Status: ${err.statusCode}`);
      if (err.details) console.log(`   Details: ${err.details}`);
      if (err.stack) {
        console.log(`   Stack Trace:\n${err.stack.split('\n').map(line => '     ' + line).join('\n')}`);
      }
    });
    console.log(`\n${'─'.repeat(80)}`);
  }
  
  const score = calculateScore(totalTime, stats);
  console.log(`\n🎯 SCORE: ${score.toFixed(2)}/100`);
  console.log(`${'─'.repeat(80)}`);

  return { config, totalTime: parseFloat(totalTime), stats, score };
}

// ============================================================================
// SCORING FUNCTION
// ============================================================================

function calculateScore(totalTime, stats) {
  const timeSeconds = parseFloat(totalTime);
  const totalBatches = stats.mcq.batches + stats.qroc.batches;
  const successRate = ((stats.mcq.success + stats.qroc.success) / totalBatches) * 100;
  const rateLimitRate = ((stats.mcq.rateLimited + stats.qroc.rateLimited) / totalBatches) * 100;
  
  // Scoring:
  // - Speed: 0-50 points (faster = better, target 90-150s)
  // - Success rate: 0-30 points
  // - Rate limiting: -20 points max (less = better)
  
  let speedScore = 0;
  if (timeSeconds <= 90) speedScore = 50;
  else if (timeSeconds <= 150) speedScore = 50 - ((timeSeconds - 90) / 60) * 20;
  else if (timeSeconds <= 300) speedScore = 30 - ((timeSeconds - 150) / 150) * 20;
  else speedScore = Math.max(0, 10 - ((timeSeconds - 300) / 300) * 10);
  
  const successScore = (successRate / 100) * 30;
  const rateLimitPenalty = (rateLimitRate / 100) * 20;
  
  return Math.max(0, speedScore + successScore - rateLimitPenalty);
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.log('\n🚀 Starting Comprehensive Configuration Testing');
  console.log('═'.repeat(80));
  
  const { mcqQuestions, qrocQuestions } = loadQuestionsFromExcel();
  
  const configurations = [
    // Test different BATCH_SIZE values with CONCURRENCY=10 (our current setting)
    { BATCH_SIZE: 3, CONCURRENCY: 10, INTER_WAVE_DELAY: 3 },
    { BATCH_SIZE: 5, CONCURRENCY: 10, INTER_WAVE_DELAY: 3 },
    { BATCH_SIZE: 7, CONCURRENCY: 10, INTER_WAVE_DELAY: 3 },
    { BATCH_SIZE: 10, CONCURRENCY: 10, INTER_WAVE_DELAY: 3 },
    
    // Test different CONCURRENCY values with BATCH_SIZE=5 (our current setting)
    { BATCH_SIZE: 5, CONCURRENCY: 5, INTER_WAVE_DELAY: 3 },
    { BATCH_SIZE: 5, CONCURRENCY: 8, INTER_WAVE_DELAY: 3 },
    { BATCH_SIZE: 5, CONCURRENCY: 12, INTER_WAVE_DELAY: 3 },
    { BATCH_SIZE: 5, CONCURRENCY: 15, INTER_WAVE_DELAY: 3 },
    
    // Test different INTER_WAVE_DELAY values
    { BATCH_SIZE: 5, CONCURRENCY: 10, INTER_WAVE_DELAY: 0 },
    { BATCH_SIZE: 5, CONCURRENCY: 10, INTER_WAVE_DELAY: 2 },
    { BATCH_SIZE: 5, CONCURRENCY: 10, INTER_WAVE_DELAY: 5 },
    
    // Test some optimal combinations
    { BATCH_SIZE: 7, CONCURRENCY: 8, INTER_WAVE_DELAY: 3 },
    { BATCH_SIZE: 7, CONCURRENCY: 12, INTER_WAVE_DELAY: 2 },
  ];

  const results = [];

  for (let i = 0; i < configurations.length; i++) {
    console.log(`\n\n📍 Test ${i + 1}/${configurations.length}`);
    
    try {
      const result = await testConfiguration({
        ...configurations[i],
        mcqQuestions,
        qrocQuestions
      });
      results.push(result);
      
      // Wait 10 seconds between tests to avoid cumulative rate limiting
      if (i < configurations.length - 1) {
        console.log(`\n⏳ Waiting 10s before next test to clear Azure quotas...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    } catch (err) {
      console.error(`❌ Test failed:`, err);
      results.push({ 
        config: configurations[i], 
        error: err.message, 
        totalTime: 999, 
        score: 0 
      });
    }
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================

  console.log('\n\n');
  console.log('═'.repeat(80));
  console.log('🏆 FINAL RESULTS - RANKED BY SCORE');
  console.log('═'.repeat(80));

  results.sort((a, b) => (b.score || 0) - (a.score || 0));

  console.log('\n┌─────┬─────────┬─────────────┬───────────┬─────────┬────────────┐');
  console.log('│ Rank│  Score  │  Time (s)   │ Batch Size│  Conc.  │   Delay    │');
  console.log('├─────┼─────────┼─────────────┼───────────┼─────────┼────────────┤');
  
  results.forEach((result, idx) => {
    const rank = `${idx + 1}`.padStart(4);
    const score = `${(result.score || 0).toFixed(1)}`.padStart(6);
    const time = `${result.totalTime?.toFixed(1) || '999'}`.padStart(10);
    const batchSize = `${result.config.BATCH_SIZE}`.padStart(9);
    const conc = `${result.config.CONCURRENCY}`.padStart(7);
    const delay = `${result.config.INTER_WAVE_DELAY}s`.padStart(9);
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
    
    console.log(`│ ${rank}│ ${score}  │  ${time}   │   ${batchSize}    │  ${conc}   │   ${delay}   │ ${medal}`);
  });
  
  console.log('└─────┴─────────┴─────────────┴───────────┴─────────┴────────────┘');

  // Best configuration
  const best = results[0];
  console.log(`\n🎯 OPTIMAL CONFIGURATION:`);
  console.log(`${'═'.repeat(80)}`);
  console.log(`   BATCH_SIZE: ${best.config.BATCH_SIZE}`);
  console.log(`   CONCURRENCY: ${best.config.CONCURRENCY}`);
  console.log(`   INTER_WAVE_DELAY: ${best.config.INTER_WAVE_DELAY}s`);
  console.log(`   Total Time: ${best.totalTime}s (${(best.totalTime / 60).toFixed(2)} minutes)`);
  console.log(`   Score: ${best.score.toFixed(2)}/100`);
  
  if (best.stats) {
    const totalSuccess = best.stats.mcq.success + best.stats.qroc.success;
    const totalBatches = best.stats.mcq.batches + best.stats.qroc.batches;
    const totalRateLimited = best.stats.mcq.rateLimited + best.stats.qroc.rateLimited;
    
    console.log(`   Success Rate: ${((totalSuccess / totalBatches) * 100).toFixed(1)}%`);
    console.log(`   Rate Limited: ${totalRateLimited}/${totalBatches} batches (${((totalRateLimited / totalBatches) * 100).toFixed(1)}%)`);
  }
  
  console.log(`\n📝 Update your code:`);
  console.log(`   const BATCH_SIZE = ${best.config.BATCH_SIZE};`);
  console.log(`   const CONCURRENCY = ${best.config.CONCURRENCY};`);
  console.log(`   const INTER_WAVE_DELAY = ${best.config.INTER_WAVE_DELAY}; // seconds`);
  
  console.log(`\n✅ Testing complete! Results saved to test-results.json`);
  
  // Comprehensive error analysis
  const allErrors = results.flatMap(r => r.stats?.errors || []);
  if (allErrors.length > 0) {
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('🔍 COMPREHENSIVE ERROR ANALYSIS');
    console.log(`${'═'.repeat(80)}`);
    
    // Group errors by type
    const errorsByType = {};
    const errorsByMessage = {};
    
    allErrors.forEach(err => {
      const errType = err.name || 'Unknown';
      const errMsg = err.message?.substring(0, 100) || err.error?.substring(0, 100) || 'Unknown error';
      
      errorsByType[errType] = (errorsByType[errType] || 0) + 1;
      errorsByMessage[errMsg] = (errorsByMessage[errMsg] || 0) + 1;
    });
    
    console.log(`\n📊 Error Summary:`);
    console.log(`   Total Errors: ${allErrors.length}`);
    console.log(`\n🏷️  Errors by Type:`);
    Object.entries(errorsByType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count}x`);
      });
    
    console.log(`\n📝 Most Common Error Messages:`);
    Object.entries(errorsByMessage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([msg, count]) => {
        console.log(`   [${count}x] ${msg}`);
      });
    
    console.log(`\n🔴 First 3 Unique Errors (Full Details):`);
    const uniqueErrors = [];
    const seenMessages = new Set();
    
    allErrors.forEach(err => {
      const msg = err.message || err.error;
      if (!seenMessages.has(msg) && uniqueErrors.length < 3) {
        uniqueErrors.push(err);
        seenMessages.add(msg);
      }
    });
    
    uniqueErrors.forEach((err, idx) => {
      console.log(`\n${idx + 1}. ${err.type?.toUpperCase() || 'ERROR'} - Batch #${err.batch || 'N/A'}:`);
      console.log(`   Name: ${err.name || 'Error'}`);
      console.log(`   Message: ${err.message || err.error}`);
      if (err.elapsed) console.log(`   Duration: ${err.elapsed}s`);
      if (err.code) console.log(`   Code: ${err.code}`);
      if (err.statusCode) console.log(`   HTTP Status: ${err.statusCode}`);
      if (err.details) console.log(`   Details: ${err.details}`);
      if (err.stack) {
        console.log(`   Stack Trace (first 3 lines):`);
        console.log(err.stack.split('\n').slice(0, 3).map(line => '     ' + line).join('\n'));
      }
    });
  }
  
  // Save results to file
  const resultsWithTimestamp = {
    timestamp: new Date().toISOString(),
    totalTests: results.length,
    totalErrors: allErrors.length,
    results: results.map(r => ({
      ...r,
      errorCount: r.stats?.errors?.length || 0
    }))
  };
  
  fs.writeFileSync('test-results.json', JSON.stringify(resultsWithTimestamp, null, 2));
  console.log(`\n💾 Detailed results with ${allErrors.length} errors saved to test-results.json`);
}

// Run the tests
runAllTests().catch(err => {
  console.error('\n❌ FATAL ERROR - Test Runner Failed:');
  console.error('═'.repeat(80));
  console.error(`Name: ${err.name || 'Error'}`);
  console.error(`Message: ${err.message || String(err)}`);
  if (err.code) console.error(`Code: ${err.code}`);
  if (err.stack) {
    console.error(`\nStack Trace:`);
    console.error(err.stack);
  }
  console.error('═'.repeat(80));
  process.exit(1);
});
