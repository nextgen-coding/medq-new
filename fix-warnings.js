const fs = require('fs');
const path = require('path');

// List of files and their fixes
const fixes = [
  // API Routes - Non-null assertions
  {
    file: 'src/app/api/questions/[questionId]/route.ts',
    search: /const userId = request\.user!\.userId;/g,
    replace: `const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }`
  },
  {
    file: 'src/app/api/reports/route.ts',
    search: /const userId = request\.user!\.userId;/g,
    replace: `const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }`
  },
  {
    file: 'src/app/api/specialties/route.ts',
    search: /const userId = request\.user!\.userId;/g,
    replace: `const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }`
  },
  {
    file: 'src/app/api/specialties/[specialtyId]/route.ts',
    search: /const userId = request\.user!\.userId;/g,
    replace: `const userId = request.user?.userId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }`
  },
  // Remove unused imports
  {
    file: 'src/app/auth/page.tsx',
    search: /const { t } = useTranslation\(\);/g,
    replace: '// const { t } = useTranslation();'
  },
  {
    file: 'src/app/pinned/page.tsx',
    search: /const { t } = useTranslation\(\);/g,
    replace: '// const { t } = useTranslation();'
  },
  // Fix unescaped entities
  {
    file: 'src/app/page.tsx',
    search: /'/g,
    replace: '&apos;'
  },
  {
    file: 'src/app/page.tsx',
    search: /"/g,
    replace: '&quot;'
  }
];

// Apply fixes
fixes.forEach(fix => {
  const filePath = path.join(__dirname, fix.file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(fix.search, fix.replace);
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${fix.file}`);
  }
});

console.log('All fixes applied!');
