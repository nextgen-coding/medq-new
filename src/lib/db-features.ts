import { prisma } from '@/lib/prisma';

// Simple cached feature detection for DB schema differences
let cache: {
  hasIsAnonymous: boolean | null;
  hasQuestionRappelMedia: boolean | null;
  checkedAt: number;
} = {
  hasIsAnonymous: null,
  hasQuestionRappelMedia: null,
  checkedAt: 0,
};

const TTL_MS = 60_000; // 1 minute cache

export async function questionCommentsSupportsAnonymous(): Promise<boolean> {
  const now = Date.now();
  if (cache.hasIsAnonymous !== null && now - cache.checkedAt < TTL_MS) {
    return cache.hasIsAnonymous;
  }
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: number }>>`
      SELECT 1 as exists
      FROM information_schema.columns
      WHERE table_name = 'question_comments' AND column_name = 'is_anonymous'
      LIMIT 1;
    `;
    const supported = Array.isArray(rows) && rows.length > 0;
    cache = { ...cache, hasIsAnonymous: supported, checkedAt: now };
    return supported;
  } catch {
    // If introspection fails, assume not supported to stay safe
    cache = { ...cache, hasIsAnonymous: false, checkedAt: now };
    return false;
  }
}

export function invalidateDbFeaturesCache() {
  cache = { hasIsAnonymous: null, hasQuestionRappelMedia: null, checkedAt: 0 };
}

export async function questionsSupportsRappelMedia(): Promise<boolean> {
  const now = Date.now();
  if (cache.hasQuestionRappelMedia !== null && now - cache.checkedAt < TTL_MS) {
    return cache.hasQuestionRappelMedia;
  }
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: number }>>`
      SELECT 1 as exists
      FROM information_schema.columns
      WHERE table_name = 'questions' AND column_name = 'course_reminder_media_url'
      LIMIT 1;
    `;
    const supported = Array.isArray(rows) && rows.length > 0;
    cache = { ...cache, hasQuestionRappelMedia: supported, checkedAt: now };
    return supported;
  } catch {
    cache = { ...cache, hasQuestionRappelMedia: false, checkedAt: now };
    return false;
  }
}
