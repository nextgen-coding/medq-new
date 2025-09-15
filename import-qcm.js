const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, index) => {
      row[header.trim()] = values[index] || '';
    });
    return row;
  });
}

async function importQCM() {
  try {
    console.log('📚 Starting QCM import...');
    
    const csvContent = fs.readFileSync('data\\PCEM 2 Sample  - qcm.csv', 'utf-8');
    const questions = parseCSV(csvContent);
    
    console.log(`Found ${questions.length} questions to import`);
    
    // Get PCEM2 niveau
    let niveau = await prisma.niveau.findFirst({
      where: { name: { contains: 'PCEM' } }
    });
    
    if (!niveau) {
      niveau = await prisma.niveau.create({
        data: { name: 'PCEM2', order: 2 }
      });
      console.log('✅ Created PCEM2 niveau');
    }
    
    let imported = 0;
    let skipped = 0;
    
    for (const q of questions) {
      try {
        // Skip empty rows
        if (!(q.matiere || q.specialite || q.specialty) || !(q.cours || q.lecture || q.course) || !q['texte de la question']) {
          skipped++;
          continue;
        }

        // Normalized helpers
        const trimLower = v => (v||'').toString().trim();
        const specialtyName = trimLower(q.matiere || q.specialite || q.specialty);
        const lectureTitle = trimLower(q.cours || q.lecture || q.course);
        const rawNiveau = trimLower(q.niveau || q.level || q.NIVEAU);
        const rawSemestre = trimLower(q.semestre || q.semester || q.SEMESTRE || q['semestre '] || q['SEMESTRE ']);
        const rawReminder = trimLower(q.rappel || q['rappel du cours'] || q['rappel_cours'] || q['course reminder']);

        // Resolve / create niveau (if provided), else fallback existing PCEM/ DCEM as before
        let niveau;
        if (rawNiveau) {
          niveau = await prisma.niveau.findFirst({ where: { name: { equals: rawNiveau, mode: 'insensitive' } } });
          if (!niveau) {
            // Try to extract order if pattern like PCEM2 or DCEM 1
            const m = rawNiveau.match(/(pcem|dcem)\s?(\d)/i);
            const orderGuess = m ? parseInt(m[2],10) : undefined;
            niveau = await prisma.niveau.create({ data: { name: rawNiveau.toUpperCase(), order: orderGuess || Date.now()%1000 } });
            console.log(`  ✅ Created niveau: ${niveau.name}`);
          }
        } else {
          // previous fallback strategy
          niveau = await prisma.niveau.findFirst({ where: { name: { contains: 'PCEM' } } });
          if (!niveau) {
            niveau = await prisma.niveau.create({ data: { name: 'PCEM2', order: 2 } });
            console.log('✅ Created PCEM2 niveau (fallback)');
          }
        }

        // Resolve / create semester if provided
        let semester = null;
        if (rawSemestre) {
            // Extract digit for order
            const m = rawSemestre.match(/(s|semestre)?\s*(\d)/i);
            const order = m ? parseInt(m[2],10) : undefined;
            semester = await prisma.semester.findFirst({ where: { niveauId: niveau.id, ...(order? { order } : {}) } });
            if (!semester) {
              semester = await prisma.semester.create({ data: { name: rawSemestre.toUpperCase() || (order? `S${order}`:'SEM'), order: order || ((Date.now()%1000)+10), niveauId: niveau.id } });
              console.log(`  ✅ Created semester: ${semester.name}`);
            }
        }

        // Get or create specialty (attach niveau / semester if resolvable)
        let specialty = await prisma.specialty.findFirst({
          where: { name: specialtyName }
        });
        
        if (!specialty) {
          specialty = await prisma.specialty.create({
            data: {
              name: specialtyName,
              description: `Spécialité ${specialtyName}`,
              niveauId: niveau?.id,
              semesterId: semester?.id,
              isFree: true
            }
          });
          console.log(`  ✅ Created specialty: ${specialty.name}`);
        }
        
        // Get or create lecture
        let lecture = await prisma.lecture.findFirst({
          where: { 
            title: lectureTitle,
            specialtyId: specialty.id
          }
        });
        
        if (!lecture) {
          lecture = await prisma.lecture.create({
            data: {
              title: lectureTitle,
              description: `Cours: ${lectureTitle}`,
              specialtyId: specialty.id,
              isFree: true
            }
          });
        }
        
        // Check if question exists
  const questionText = q['texte de la question'].trim();
        const existingQuestion = await prisma.question.findFirst({
          where: {
            text: questionText,
            lectureId: lecture.id
          }
        });
        
        if (existingQuestion) {
          skipped++;
          continue;
        }
        
        // Create question options - handle CSV columns properly
        const optionsRaw = [
          ['A', q['option A']],
          ['B', q['option B']], 
          ['C', q['option C']],
          ['D', q['option D']],
          ['E', q['option E']]
        ].filter(([,opt]) => opt && opt.trim() && opt.trim() !== '');
        const optionTexts = optionsRaw.map(([,opt]) => opt.trim());

        // Collect per-option explanations if columns like Explication A / explication A etc
        const expFor = letter => q[`explication ${letter}`] || q[`Explication ${letter}`] || q[`explication${letter}`] || q[`Explication${letter}`];
        const perOptionExplanations = optionsRaw.map(([letter]) => {
          const v = expFor(letter);
          return v ? v.toString().trim() : undefined;
        });
        
        // Parse correct answers (A, B, C, D, E -> "0", "1", "2", "3", "4")
        let correctAnswers = [];
        const rawAnswer = q.reponse || q['réponse'] || q['Reponse'];
        if (rawAnswer && rawAnswer.trim() && 
            !/pas de re?ponse/i.test(rawAnswer) &&
            !/aucune re?ponse n'?est juste/i.test(rawAnswer)) {
          correctAnswers = rawAnswer.trim().split('').map(letter => {
            const index = letter.toUpperCase().charCodeAt(0) - 65; // A=0
            return index >= 0 && index < optionTexts.length ? index.toString() : null;
          }).filter(i => i !== null);
        }

        // Build combined explanation: original source + per option explanations neatly
        let combinedExplanation = '';
        if (q.source) combinedExplanation += q.source.trim();
        const explanationLines = [];
        perOptionExplanations.forEach((exp, idx) => {
          if (exp) explanationLines.push(`(${String.fromCharCode(65+idx)}) ${exp}`);
        });
        if (explanationLines.length) {
          if (combinedExplanation) combinedExplanation += '\n\n';
          combinedExplanation += 'Explications:\n' + explanationLines.join('\n');
        }

  // Image / media detection (columns: image, image_url, media, media_url, illustration)
  const rawImage = (q.image || q.image_url || q.media || q.media_url || q.illustration || '').toString().trim();
  const isLikelyImage = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(rawImage) || rawImage.startsWith('http') || rawImage.startsWith('data:image/');
  const mediaUrlValue = rawImage && isLikelyImage ? rawImage : null;

        // Store per-option explanations structured if present
        let storedOptions;
        if (perOptionExplanations.some(e => e)) {
          storedOptions = optionTexts.map((text, i) => ({ text, explanation: perOptionExplanations[i] || null }));
        } else {
          storedOptions = optionTexts; // keep legacy format
        }
        
        await prisma.question.create({
          data: {
            text: questionText,
            type: 'MCQ',
            options: storedOptions,
            correctAnswers: correctAnswers,
            explanation: combinedExplanation,
            lectureId: lecture.id,
            courseReminder: rawReminder || null,
            mediaUrl: mediaUrlValue,
            mediaType: mediaUrlValue ? 'image' : null,
            // optional: attach media if columns exist later
          }
        });
        
        imported++;
        if (imported % 50 === 0) {
          console.log(`  📝 ${imported} questions imported...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importing question ${imported + skipped + 1}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Import complete!`);
    console.log(`  ✅ Imported: ${imported} questions`);
    console.log(`  ⏭️  Skipped: ${skipped} duplicates`);
    
    const totalQuestions = await prisma.question.count();
    console.log(`\n📊 Total questions in database: ${totalQuestions}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importQCM();
