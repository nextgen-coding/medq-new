# 🚀 AI Processing Optimization: 5 Questions Per Call

## 📊 Configuration Summary

```typescript
OPTIMAL CONFIGURATION (October 2025)

Batch Size:    5 questions per API call
Concurrency:   100 parallel API calls
Rate Limit:    7000 requests/minute (Azure OpenAI)
Estimated RPM: 6000 (14% safety margin)
Capacity:      500 questions per wave
```

---

## 🎯 Why This Configuration?

### **1. Rate Limit Analysis**

```
Azure OpenAI Rate Limit: 7000 requests/minute
                       = 116.67 requests/second

Safe operating limit (15% buffer): 
  116.67 × 0.85 = 99 requests/second

Chosen concurrency: 100 parallel API calls
Actual RPM: 100 × 60 = 6000 RPM ✅

Safety margin: 1000 RPM (14% under limit)
```

### **2. Performance vs Cost Trade-off**

| Configuration | API Calls (2749Q) | Time | Cost | Error Impact |
|--------------|-------------------|------|------|--------------|
| **1 Q/call** | 2749 | ~34s | $0.096 | Lose 1Q/fail ✅ |
| **5 Q/call** ✅ | 550 | ~10-12s | $0.063 | Lose 5Q/fail ✅ |
| **10 Q/call** | 275 | ~8-10s | $0.045 | Lose 10Q/fail ⚠️ |
| **50 Q/call** (old) | 55 | ~3-4s | $0.014 | Lose 50Q/fail ❌ |

**Why 5 Q/call wins:**
- ✅ **Fast**: 3x faster than old config for large files
- ✅ **Affordable**: 34% cheaper than 1 Q/call
- ✅ **Reliable**: Minimal data loss on failures
- ✅ **Scalable**: Process up to 500 questions in single wave

---

## ⚡ Performance Metrics

### **Processing Times** (Including AI + Network)

| File Size | API Calls Needed | Waves | Estimated Time | Questions/Wave |
|-----------|------------------|-------|----------------|----------------|
| **50 Q** | 10 | 1 | **1-2s** ⚡ | 50 |
| **100 Q** | 20 | 1 | **2-3s** ⚡ | 100 |
| **200 Q** | 40 | 1 | **2-3s** ⚡ | 200 |
| **500 Q** | 100 | 1 | **2-3s** ⚡ | 500 |
| **1000 Q** | 200 | 2 | **4-5s** 🚀 | 500 + 500 |
| **2749 Q** | 550 | 6 | **10-12s** 🚀 | 6×500, 1×250 |
| **5000 Q** | 1000 | 10 | **20-25s** 🚀 | 10×500 |

**Key Insight**: Files with ≤500 questions complete in a **single wave** (near-instant)!

---

## 🌊 Wave-Based Processing Explained

### **What is a Wave?**

A "wave" is a batch of API calls executed in parallel. With 100 concurrency, each wave can handle up to 100 API calls simultaneously.

```
Wave = Group of parallel API calls
Concurrency = 100 means:
  ├─ Wave 1: Launch 100 calls  // All run simultaneously
  ├─ Wait for all to complete
  ├─ Wave 2: Launch next 100   // All run simultaneously
  └─ Continue until all calls done
```

### **Example 1: Small File (100 Questions)**

```
Total: 100 questions
Per call: 5 questions
Calls needed: 100 ÷ 5 = 20 API calls

Wave 1: [Call 1, Call 2, ..., Call 20] // 20 calls in parallel
        ├─ Call 1: Questions 1-5     (5Q)
        ├─ Call 2: Questions 6-10    (5Q)
        ├─ ...
        └─ Call 20: Questions 96-100 (5Q)

Total waves: 1
Total time: ~2-3 seconds ⚡
```

### **Example 2: Medium File (500 Questions)**

```
Total: 500 questions
Per call: 5 questions
Calls needed: 500 ÷ 5 = 100 API calls

Wave 1: [Call 1, Call 2, ..., Call 100] // 100 calls in parallel
        ├─ All 100 calls start together
        ├─ Each call processes 5 questions
        └─ All complete in parallel

Total waves: 1
Total time: ~2-3 seconds ⚡
Efficiency: 500 questions processed simultaneously!
```

### **Example 3: Large File (2749 Questions)**

```
Total: 2749 questions
Per call: 5 questions  
Calls needed: 2749 ÷ 5 = 550 API calls

Wave 1: Calls 1-100    → 500 questions // In parallel
Wave 2: Calls 101-200  → 500 questions // In parallel
Wave 3: Calls 201-300  → 500 questions // In parallel
Wave 4: Calls 301-400  → 500 questions // In parallel
Wave 5: Calls 401-500  → 500 questions // In parallel
Wave 6: Calls 501-550  → 250 questions // In parallel (partial wave)

Total waves: 6
Total time: ~10-12 seconds 🚀
Average: ~2 seconds per wave
```

### **Visual Timeline**

```
T=0s:   📦 Wave 1 starts (100 calls // in parallel)
T=2s:   ✅ Wave 1 done → 📦 Wave 2 starts (100 calls // in parallel)
T=4s:   ✅ Wave 2 done → 📦 Wave 3 starts (100 calls // in parallel)
T=6s:   ✅ Wave 3 done → 📦 Wave 4 starts (100 calls // in parallel)
T=8s:   ✅ Wave 4 done → 📦 Wave 5 starts (100 calls // in parallel)
T=10s:  ✅ Wave 5 done → 📦 Wave 6 starts (50 calls // in parallel)
T=11s:  ✅ Wave 6 done → 🎉 All complete!

Total: ~11 seconds for 2749 questions
```

---

## 💰 Cost Analysis

### **Token Usage Comparison**

#### **1 Question per Call** (High Cost)
```
System Prompt:     ~200 tokens
Question:          ~50 tokens
Response:          ~150 tokens (1 explanation)
─────────────────────────────
Total per call:    ~400 tokens

Cost per 100Q:  100 calls × 400 = 40,000 tokens ≈ $0.004
Cost per 2749Q: 2749 calls × 400 = 1,099,600 tokens ≈ $0.110
```

#### **5 Questions per Call** ✅ (Optimal)
```
System Prompt:     ~400 tokens (shared across 5Q)
5 Questions:       ~250 tokens (5 × 50)
5 Responses:       ~750 tokens (5 × 150 explanations)
─────────────────────────────
Total per call:    ~1400 tokens

Cost per 100Q:  20 calls × 1400 = 28,000 tokens ≈ $0.0028
Cost per 2749Q: 550 calls × 1400 = 770,000 tokens ≈ $0.077

Savings vs 1 Q/call: 30% cheaper! 💰
```

#### **50 Questions per Call** (Old Config)
```
System Prompt:     ~1850 tokens (shared across 50Q)
50 Questions:      ~2500 tokens (50 × 50)
50 Responses:      ~7500 tokens (50 × 150 explanations)
─────────────────────────────
Total per call:    ~11,850 tokens

Cost per 100Q:  2 calls × 11,850 = 23,700 tokens ≈ $0.0024
Cost per 2749Q: 55 calls × 11,850 = 651,750 tokens ≈ $0.065

Note: Cheapest but SLOW and loses 50Q on failure!
```

### **Monthly Cost Projection**

Assuming **10,000 questions processed per day**:

| Config | Daily Cost | Monthly Cost | Savings |
|--------|-----------|--------------|---------|
| 1 Q/call | $0.40 | $12.00 | Baseline |
| **5 Q/call** ✅ | **$0.28** | **$8.40** | **-30%** |
| 50 Q/call | $0.24 | $7.20 | -40% |

**5 Q/call = Perfect balance between speed, cost, and reliability!**

---

## 🔧 Technical Implementation

### **Backend Configuration** (route.ts)

```typescript
// Optimal configuration active by default
const BATCH_SIZE = 5;        // 5 questions per API call
const CONCURRENCY = 100;     // 100 parallel calls

// Environment variable overrides (optional)
const envBatchSize = process.env.AI_IMPORT_BATCH_SIZE;
const envConcurrency = process.env.AI_IMPORT_CONCURRENCY;

const actualBatchSize = envBatchSize ? Number(envBatchSize) : BATCH_SIZE;
const actualConcurrency = envConcurrency ? Number(envConcurrency) : CONCURRENCY;

console.log(`[AI] 🎯 Configuration:`);
console.log(`[AI]    Batch: ${actualBatchSize} Q/call`);
console.log(`[AI]    Parallel: ${actualConcurrency} calls`);
console.log(`[AI]    RPM: ${actualConcurrency * 60} (limit: 7000)`);
```

### **Processing Flow**

```typescript
// 1. Split questions into batches of 5
const batches = [];
for (let i = 0; i < questions.length; i += 5) {
  batches.push(questions.slice(i, i + 5));
}

// 2. Process in waves of 100 parallel calls
for (let i = 0; i < batches.length; i += 100) {
  const wave = batches.slice(i, i + 100);
  
  // Launch all 100 API calls in parallel
  const promises = wave.map(batch => processAPICall(batch));
  
  // Wait for entire wave to complete
  const results = await Promise.all(promises);
  
  // Continue to next wave...
}
```

### **Log Output Example**

```
[AI] 🎯 Optimal Configuration Active:
[AI]    📦 Batch Size: 5 questions per API call
[AI]    🔄 Concurrency: 100 parallel API calls
[AI]    📊 Estimated RPM: 6000 ✅ (limit: 7000)
[AI]    ⚡ Processing capacity: 500 questions per wave
[AI]    🚀 Mode: OPTIMAL

[AI] 📦 Starting MCQ analysis
[AI] 📊 Configuration: 2749 questions, 5 Q/call, 100 parallel
[AI] 🎯 Rate limit safety: 6000 RPM (max: 7000 RPM)
[AI] 📦 Created 550 batches (5 questions each)
[AI] 🌊 Will process in 6 wave(s) (100 parallel calls per wave)

[AI] 🌊 Wave 1/6: Launching 100 API calls in parallel...
[AI] ✅ Wave 1/6: All 100 calls complete in 2.3s
[AI] 🌊 Wave 2/6: Launching 100 API calls in parallel...
[AI] ✅ Wave 2/6: All 100 calls complete in 2.1s
[AI] 🌊 Wave 3/6: Launching 100 API calls in parallel...
[AI] ✅ Wave 3/6: All 100 calls complete in 2.2s
[AI] 🌊 Wave 4/6: Launching 100 API calls in parallel...
[AI] ✅ Wave 4/6: All 100 calls complete in 2.0s
[AI] 🌊 Wave 5/6: Launching 100 API calls in parallel...
[AI] ✅ Wave 5/6: All 100 calls complete in 2.1s
[AI] 🌊 Wave 6/6: Launching 50 API calls in parallel...
[AI] ✅ Wave 6/6: All 50 calls complete in 1.1s

[AI] 🎉 All 550 batches completed successfully!
[AI] 📊 Results: 2742 OK, 7 errors
[AI] ✅ 2749 questions analyzed in 11.8s
```

---

## 🎯 Comparison with Old Configuration

### **Old Config (50 Q/call, 50 parallel)**

```
File: 2749 questions
Batches: 2749 ÷ 50 = 55 batches
Waves: 55 ÷ 50 = 2 waves (55 calls in wave 1, 5 in wave 2)

Wave 1: 50 calls × 50 Q = 2500 questions (~22s)
Wave 2: 5 calls × 50 Q = 249 questions (~3s)

Total time: ~25 seconds
If 1 call fails: Lose 50 questions ❌
RPM usage: 50 × 60 = 3000 (43% of limit - underutilized)
```

### **New Config (5 Q/call, 100 parallel)** ✅

```
File: 2749 questions
Batches: 2749 ÷ 5 = 550 batches
Waves: 550 ÷ 100 = 6 waves

Wave 1-5: 100 calls × 5 Q = 500 questions each (~2s each)
Wave 6: 50 calls × 5 Q = 250 questions (~1s)

Total time: ~11 seconds (2.3x faster!) 🚀
If 1 call fails: Lose 5 questions ✅ (10x better recovery)
RPM usage: 100 × 60 = 6000 (86% of limit - well optimized)
```

---

## 📈 Real-World Benefits

### **User Experience Improvements**

1. **Faster Results**
   ```
   Small files (≤500Q): Nearly instant (single wave)
   Medium files (1000Q): 4-5 seconds
   Large files (2749Q): 10-12 seconds (vs 25s before)
   ```

2. **Better Progress Feedback**
   ```
   Old: 2 progress updates (per wave)
   New: 6+ progress updates (more granular)
   User sees: More frequent "Processing batch X/Y" messages
   ```

3. **Improved Error Recovery**
   ```
   Old: Lose 50 questions if API call fails
   New: Lose only 5 questions if API call fails
   Result: 10x better data preservation
   ```

4. **Cost Efficiency**
   ```
   30% cheaper than 1 Q/call
   Only 15% more expensive than 50 Q/call
   Worth the speed and reliability gains!
   ```

---

## 🔍 Monitoring & Debugging

### **Environment Variables (Override Defaults)**

```bash
# Override batch size (default: 5)
AI_IMPORT_BATCH_SIZE=10

# Override concurrency (default: 100)
AI_IMPORT_CONCURRENCY=80

# Enable slow mode (20 batch, 30 concurrency)
AI_SLOW_MODE=1

# Enable single mode (1 batch, 1 concurrency - for debugging)
AI_QCM_SINGLE=1
```

### **Log Monitoring**

Watch for these key metrics in logs:

```bash
# Configuration confirmation
[AI] 🎯 Optimal Configuration Active
[AI]    📦 Batch Size: 5
[AI]    🔄 Concurrency: 100
[AI]    📊 Estimated RPM: 6000 ✅

# Rate limit warnings (if approaching limit)
[AI]    📊 Estimated RPM: 6900 ⚠️

# Wave processing times (should be ~2s each)
[AI] ✅ Wave 1/6: All 100 calls complete in 2.3s ✅ Good
[AI] ✅ Wave 2/6: All 100 calls complete in 15.8s ⚠️ Slow!

# Error rates (should be <1%)
[AI] 📊 Results: 2742 OK, 7 errors ✅ Good (0.25% error rate)
[AI] 📊 Results: 2500 OK, 249 errors ❌ Bad (9% error rate)
```

---

## 🚨 Troubleshooting

### **Problem: "429 Too Many Requests" Errors**

**Cause**: Exceeding rate limit (7000 RPM)

**Solution**:
```bash
# Reduce concurrency to 80
AI_IMPORT_CONCURRENCY=80

# Or enable slow mode
AI_SLOW_MODE=1
```

### **Problem: Slow Wave Processing (>5s per wave)**

**Cause**: Network latency or Azure throttling

**Solution**:
```bash
# Reduce concurrency for more stable processing
AI_IMPORT_CONCURRENCY=50

# Check network connection
# Check Azure OpenAI service health
```

### **Problem: High Error Rate (>5%)**

**Cause**: API instability or token limit issues

**Solution**:
```bash
# Reduce batch size to decrease complexity
AI_IMPORT_BATCH_SIZE=3

# Enable debugging with single mode
AI_QCM_SINGLE=1  # Process one at a time to isolate issue
```

---

## 🎓 Summary

### **Configuration**
- ✅ **5 questions per API call**
- ✅ **100 parallel API calls**
- ✅ **6000 RPM (14% under 7000 limit)**
- ✅ **500 questions per wave capacity**

### **Performance**
- ✅ **2.3x faster** than old config for large files
- ✅ **Near-instant** for files ≤500 questions
- ✅ **10-12 seconds** for 2749 questions

### **Cost**
- ✅ **30% cheaper** than 1 Q/call
- ✅ **$0.28/day** for 10,000 questions

### **Reliability**
- ✅ **10x better** error recovery (5Q vs 50Q loss)
- ✅ **86% rate limit utilization** (well optimized)
- ✅ **Scalable** up to 5000+ questions

---

## 📊 Quick Reference

| Metric | Value |
|--------|-------|
| **Batch Size** | 5 questions/call |
| **Concurrency** | 100 parallel calls |
| **Wave Capacity** | 500 questions |
| **Estimated RPM** | 6000 (86% of 7000) |
| **Time (100Q)** | 2-3s |
| **Time (500Q)** | 2-3s |
| **Time (1000Q)** | 4-5s |
| **Time (2749Q)** | 10-12s |
| **Cost per 2749Q** | $0.077 |
| **Error Impact** | Lose 5Q per failed call |

---

**Updated**: October 2, 2025  
**Status**: ✅ Production Ready  
**Version**: 2.0 (Optimal Configuration)

