// Quick script to check test progress
const fs = require('fs');

if (!fs.existsSync('test-results.json')) {
  console.log('❌ test-results.json not found yet. Tests still running...');
  process.exit(0);
}

const data = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));

console.log('\n📊 TEST PROGRESS SUMMARY');
console.log('═'.repeat(80));
console.log(`Timestamp: ${data.timestamp}`);
console.log(`Tests Completed: ${data.totalTests || data.results?.length || 0}/13`);
console.log(`Total Errors: ${data.totalErrors || 0}`);

if (data.results && data.results.length > 0) {
  console.log('\n🏆 TOP 5 CONFIGURATIONS (by score):');
  console.log('┌─────┬─────────┬─────────────┬───────────┬─────────┬────────────┐');
  console.log('│ Rank│  Score  │  Time (s)   │ Batch Size│  Conc.  │   Delay    │');
  console.log('├─────┼─────────┼─────────────┼───────────┼─────────┼────────────┤');
  
  const sorted = [...data.results].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  sorted.slice(0, 5).forEach((result, idx) => {
    const rank = `${idx + 1}`.padStart(4);
    const score = `${(result.score || 0).toFixed(1)}`.padStart(6);
    const time = `${result.totalTime?.toFixed(1) || '999'}`.padStart(10);
    const batchSize = `${result.config.BATCH_SIZE}`.padStart(9);
    const conc = `${result.config.CONCURRENCY}`.padStart(7);
    const delay = `${result.config.INTER_WAVE_DELAY}s`.padStart(9);
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  ';
    const errors = result.errorCount || 0;
    const errIcon = errors > 0 ? ` (${errors} errors)` : '';
    
    console.log(`│ ${rank}│ ${score}  │  ${time}   │   ${batchSize}    │  ${conc}   │   ${delay}   │ ${medal}${errIcon}`);
  });
  
  console.log('└─────┴─────────┴─────────────┴───────────┴─────────┴────────────┘');
  
  // Best so far
  const best = sorted[0];
  console.log(`\n🎯 BEST SO FAR:`);
  console.log(`   Configuration: BATCH_SIZE=${best.config.BATCH_SIZE}, CONCURRENCY=${best.config.CONCURRENCY}, DELAY=${best.config.INTER_WAVE_DELAY}s`);
  console.log(`   Time: ${best.totalTime}s (${(best.totalTime / 60).toFixed(2)} minutes)`);
  console.log(`   Score: ${best.score.toFixed(2)}/100`);
  console.log(`   Errors: ${best.errorCount || 0}`);
}

console.log('\n═'.repeat(80));
