import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/user-question-state?userId=&questionId=
export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get('userId') as string | null;
		const questionId = searchParams.get('questionId') as string | null;
		if (!userId || !questionId) {
			return NextResponse.json({ error: 'userId and questionId are required' }, { status: 400 });
		}

		// Always use raw SQL for maximum compatibility
		try {
			const rows = await prisma.$queryRaw<Array<any>>`
				SELECT 
					user_id::text AS "userId", 
					question_id::text AS "questionId", 
					notes, 
					highlights, 
					attempts, 
					"lastScore",
					CASE 
						WHEN EXISTS (
							SELECT 1 FROM information_schema.columns 
							WHERE table_name='question_user_data' AND column_name='notes_image_urls'
						) THEN notes_image_urls
						ELSE ARRAY[]::text[]
					END AS "notesImageUrls"
				FROM question_user_data 
				WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid 
				LIMIT 1
			`;
			return NextResponse.json(rows[0] ?? null);
		} catch (sqlErr: any) {
			console.warn('Raw SQL fallback failed, using minimal query:', sqlErr?.message);
			// Even more basic fallback
			const basic = await prisma.$queryRaw<Array<any>>`
				SELECT 
					user_id::text AS "userId", 
					question_id::text AS "questionId", 
					notes, 
					highlights, 
					attempts, 
					"lastScore"
				FROM question_user_data 
				WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid 
				LIMIT 1
			`;
			const result = basic[0] ?? null;
			if (result) result.notesImageUrls = [];
			return NextResponse.json(result);
		}
	} catch (e) {
		console.error('GET user-question-state error', e);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}

// POST /api/user-question-state { userId, questionId, notes?, highlights?, attempts?, lastScore? }
export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { userId, questionId, notes, highlights, attempts, lastScore, incrementAttempts, notesImageUrls } = body || {};
		if (!userId || !questionId) {
			return NextResponse.json({ error: 'userId and questionId are required' }, { status: 400 });
		}

		let nextAttempts = attempts;
		if (incrementAttempts) {
			try {
				// Try to get existing attempts
				const existing = await prisma.$queryRaw<Array<any>>`SELECT attempts FROM question_user_data WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid LIMIT 1`;
				nextAttempts = (existing[0]?.attempts ?? 0) + 1;
			} catch {
				// If that fails, just increment from 0
				nextAttempts = 1;
			}
		}

		// Sanitize images
		const sanitizedImages = Array.isArray(notesImageUrls)
			? (notesImageUrls as any[])
				.filter(u => typeof u === 'string')
				.filter(u => {
					if (u.startsWith('data:image/')) return u.length < 200000; // ~200KB encoded
					return /^https?:\/\//i.test(u) || u.startsWith('/');
				})
				.slice(0,6)
			: [];

		// Always use raw SQL for maximum compatibility
		try {
			const result = await prisma.$transaction(async (tx) => {
				const existing = await tx.$queryRaw<Array<any>>`SELECT id FROM question_user_data WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid LIMIT 1`;
				
				if (existing.length === 0) {
					// Check if notes_image_urls column exists before including it
					const hasImagesCol = await tx.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='question_user_data' AND column_name='notes_image_urls' LIMIT 1`;
					
					if (hasImagesCol.length > 0) {
						await tx.$executeRaw`
							INSERT INTO question_user_data (user_id, question_id, notes, highlights, attempts, "lastScore", notes_image_urls) 
							VALUES (${userId}::uuid, ${questionId}::uuid, ${notes ?? null}, ${highlights ?? null}, ${(nextAttempts ?? 0)}, ${lastScore ?? null}, ${sanitizedImages}::text[])
						`;
					} else {
						await tx.$executeRaw`
							INSERT INTO question_user_data (user_id, question_id, notes, highlights, attempts, "lastScore") 
							VALUES (${userId}::uuid, ${questionId}::uuid, ${notes ?? null}, ${highlights ?? null}, ${(nextAttempts ?? 0)}, ${lastScore ?? null})
						`;
					}
				} else {
					// Update existing
					const hasImagesCol = await tx.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='question_user_data' AND column_name='notes_image_urls' LIMIT 1`;
					
					if (hasImagesCol.length > 0) {
						await tx.$executeRaw`
							UPDATE question_user_data 
							SET notes = ${notes ?? null}, highlights = ${highlights ?? null}, attempts = ${(nextAttempts ?? attempts ?? 0)}, "lastScore" = ${lastScore ?? null}, notes_image_urls = ${sanitizedImages}::text[], updated_at = NOW() 
							WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid
						`;
					} else {
						await tx.$executeRaw`
							UPDATE question_user_data 
							SET notes = ${notes ?? null}, highlights = ${highlights ?? null}, attempts = ${(nextAttempts ?? attempts ?? 0)}, "lastScore" = ${lastScore ?? null}, updated_at = NOW() 
							WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid
						`;
					}
				}
				
				// Return the updated/created row
				const hasImagesCol = await tx.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='question_user_data' AND column_name='notes_image_urls' LIMIT 1`;
				
				if (hasImagesCol.length > 0) {
					const row = await tx.$queryRaw<Array<any>>`
						SELECT user_id::text AS "userId", question_id::text AS "questionId", notes, highlights, attempts, "lastScore", notes_image_urls AS "notesImageUrls" 
						FROM question_user_data 
						WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid 
						LIMIT 1
					`;
					return row[0];
				} else {
					const row = await tx.$queryRaw<Array<any>>`
						SELECT user_id::text AS "userId", question_id::text AS "questionId", notes, highlights, attempts, "lastScore" 
						FROM question_user_data 
						WHERE user_id = ${userId}::uuid AND question_id = ${questionId}::uuid 
						LIMIT 1
					`;
					const result = row[0];
					if (result) result.notesImageUrls = [];
					return result;
				}
			});
			
			return NextResponse.json(result);
		} catch (sqlErr: any) {
			console.error('POST user-question-state SQL error', sqlErr?.message);
			return NextResponse.json({ error: 'Database error' }, { status: 500 });
		}
	} catch (e) {
		console.error('POST user-question-state error', e);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
