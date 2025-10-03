// Quick test to verify question filtering logic

const testRows = [
  // Should PASS - has stem
  { 'texte de la question': 'Quelle est la cause?', 'option a': '', 'option b': '' },
  
  // Should PASS - has 2+ options
  { 'texte de la question': '', 'option a': 'HTA', 'option b': 'Diabète', 'option c': '' },
  
  // Should FAIL - only 1 option, no stem
  { 'texte de la question': '', 'option a': 'HTA', 'option b': '', 'option c': '' },
  
  // Should FAIL - completely empty
  { 'texte de la question': '', 'option a': '', 'option b': '', 'option c': '' },
  
  // Should PASS - has cas text (stem)
  { 'texte de la question': '', 'texte du cas': 'Patient de 65 ans', 'option a': '', 'option b': '' },
  
  // Should PASS - has all 5 options
  { 'texte de la question': '', 'option a': 'A', 'option b': 'B', 'option c': 'C', 'option d': 'D', 'option e': 'E' }
];

console.log('Testing question filter logic:\n');

testRows.forEach((row, idx) => {
  const hasStem = ['texte de la question', 'texte question', 'texte du cas']
    .some(key => String(row[key] || '').trim() !== '');
  
  const optionCount = ['option a', 'option b', 'option c', 'option d', 'option e']
    .filter(key => String(row[key] || '').trim() !== '').length;
  
  const passes = hasStem || optionCount >= 2;
  
  console.log(`Row ${idx + 1}: ${passes ? '✅ PASS' : '❌ FAIL'} (stem: ${hasStem}, options: ${optionCount})`);
});

console.log('\nExpected results:');
console.log('Row 1: ✅ PASS (has stem)');
console.log('Row 2: ✅ PASS (2+ options)');
console.log('Row 3: ❌ FAIL (only 1 option, no stem)');
console.log('Row 4: ❌ FAIL (empty)');
console.log('Row 5: ✅ PASS (cas text is stem)');
console.log('Row 6: ✅ PASS (5 options)');
