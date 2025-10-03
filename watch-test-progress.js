// Continuous test progress monitor
const fs = require('fs');

let lastTestCount = 0;
let lastUpdate = new Date();

function checkProgress() {
  console.clear();
  console.log('🔄 TEST MONITOR - Auto-refreshing...\n');
  console.log(`Last Update: ${new Date().toLocaleTimeString()}\n`);
  
  if (!fs.existsSync('test-results.json')) {
    console.log('⏳ Waiting for test results...');
    console.log('   Test is still running, results file not created yet.\n');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
    const completed = data.results?.length || 0;
    
    console.log('═'.repeat(80));
    console.log(`📊 PROGRESS: ${completed}/13 tests completed`);
    console.log('═'.repeat(80));
    
    if (completed > lastTestCount) {
      lastTestCount = completed;
      lastUpdate = new Date();
    }
    
    if (data.results && data.results.length > 0) {
      console.log('\n🏆 TOP 5 CONFIGURATIONS SO FAR:\n');
      console.log('┌─────┬─────────┬─────────────┬───────────┬─────────┬────────────┬────────┐');
      console.log('│ Rank│  Score  │  Time (s)   │ Batch Size│  Conc.  │   Delay    │ Errors │');
      console.log('├─────┼─────────┼─────────────┼───────────┼─────────┼────────────┼────────┤');
      
      const sorted = [...data.results].sort((a, b) => (b.score || 0) - (a.score || 0));
      
      sorted.slice(0, 5).forEach((result, idx) => {
        const rank = `${idx + 1}`.padStart(4);
        const score = `${(result.score || 0).toFixed(1)}`.padStart(6);
        const time = `${result.totalTime?.toFixed(1) || '999'}`.padStart(10);
        const batchSize = `${result.config.BATCH_SIZE}`.padStart(9);
        const conc = `${result.config.CONCURRENCY}`.padStart(7);
        const delay = `${result.config.INTER_WAVE_DELAY}s`.padStart(9);
        const errors = `${result.errorCount || 0}`.padStart(6);
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
        
        console.log(`│ ${rank}│ ${score}  │  ${time}   │   ${batchSize}    │  ${conc}   │   ${delay}   │  ${errors}  │ ${medal}`);
      });
      
      console.log('└─────┴─────────┴─────────────┴───────────┴─────────┴────────────┴────────┘');
      
      // Winner so far
      const best = sorted[0];
      console.log(`\n🎯 BEST CONFIGURATION SO FAR:`);
      console.log(`   BATCH_SIZE: ${best.config.BATCH_SIZE}, CONCURRENCY: ${best.config.CONCURRENCY}, DELAY: ${best.config.INTER_WAVE_DELAY}s`);
      console.log(`   Time: ${best.totalTime?.toFixed(1)}s (${(best.totalTime / 60).toFixed(2)} minutes)`);
      console.log(`   Score: ${best.score?.toFixed(2)}/100`);
      console.log(`   Success Rate: ${best.stats ? ((best.stats.mcq.success + best.stats.qroc.success) / (best.stats.mcq.batches + best.stats.qroc.batches) * 100).toFixed(1) : 'N/A'}%`);
      console.log(`   Errors: ${best.errorCount || 0}`);
      
      // Progress estimate
      const avgTimePerTest = 90; // rough estimate
      const remainingTests = 13 - completed;
      const estimatedMinutes = (remainingTests * avgTimePerTest) / 60;
      
      console.log(`\n⏱️  ESTIMATED TIME REMAINING: ~${estimatedMinutes.toFixed(0)} minutes`);
      console.log(`   (${remainingTests} tests × ~90s each)\n`);
    }
    
    if (completed >= 13) {
      console.log('\n✅ ALL TESTS COMPLETE! Check test-results.json for full details.\n');
      process.exit(0);
    }
    
  } catch (err) {
    console.log(`⚠️  Error reading results: ${err.message}\n`);
  }
  
  console.log('═'.repeat(80));
  console.log('Press Ctrl+C to stop monitoring');
  console.log('═'.repeat(80));
}

// Initial check
checkProgress();

// Check every 15 seconds
const interval = setInterval(checkProgress, 15000);

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\n👋 Monitor stopped.');
  process.exit(0);
});
