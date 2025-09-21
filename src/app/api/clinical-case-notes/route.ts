import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/clinical-case-notes?userId=&questionId=
export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const userId = searchParams.get('userId') as string | null;
		const questionId = searchParams.get('questionId') as string | null;

		if (!userId || !questionId) {
			return NextResponse.json({ error: 'userId and questionId are required' }, { status: 400 });
		}

		// Check if notes_image_urls column exists
		const hasImagesCol = await prisma.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='clinical_case_notes' AND column_name='notes_image_urls' LIMIT 1`;

		let rows: any[];
		if (hasImagesCol.length > 0) {
			rows = await prisma.$queryRaw<Array<any>>`
				SELECT
					user_id::text AS "userId",
					question_id::text AS "questionId",
					notes,
					notes_image_urls AS "notesImageUrls"
				FROM clinical_case_notes
				WHERE user_id = ${userId}::uuid AND question_id = ${questionId}
				LIMIT 1
			`;
		} else {
			rows = await prisma.$queryRaw<Array<any>>`
				SELECT
					user_id::text AS "userId",
					question_id::text AS "questionId",
					notes,
					'[]'::text[] AS "notesImageUrls"
				FROM clinical_case_notes
				WHERE user_id = ${userId}::uuid AND question_id = ${questionId}
				LIMIT 1
			`;
		}
		console.log('GET clinical-case-notes - Found rows:', rows);
		// console.log('GET clinical-case-notes - Returning:', rows[0] ?? null);
		return NextResponse.json(rows[0] ?? null);
	} catch (e) {
		console.error('GET clinical-case-notes error', e);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}

// POST /api/clinical-case-notes { userId, questionId, notes?, highlights?, attempts?, lastScore?, imageUrls? }
export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { userId, questionId, notes, highlights, attempts, lastScore, imageUrls } = body || {};

		if (!userId || !questionId) {
			return NextResponse.json({ error: 'userId and questionId are required' }, { status: 400 });
		}

		// Sanitize imageUrls
		const sanitizedImages = Array.isArray(imageUrls)
			? (imageUrls as any[])
				.filter(u => typeof u === 'string')
				.filter(u => {
					if (u.startsWith('data:image/')) return u.length < 200000; // ~200KB encoded
					return /^https?:\/\//i.test(u) || u.startsWith('/');
				})
				.slice(0,6)
			: [];

		// Serialize highlights as JSON
		const highlightsJson = highlights !== undefined ? JSON.stringify(highlights) : null;

		console.log('POST clinical-case-notes - Request:', { userId, questionId, notes: notes?.substring(0, 100) + (notes && notes.length > 100 ? '...' : ''), imageUrls });

		// Check if notes_image_urls column exists
		const hasImagesCol = await prisma.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='clinical_case_notes' AND column_name='notes_image_urls' LIMIT 1`;

		let result: any;
		if (hasImagesCol.length > 0) {
			result = await prisma.$queryRaw<Array<any>>`
				INSERT INTO clinical_case_notes (user_id, question_id, notes, notes_image_urls, created_at, updated_at)
				VALUES (${userId}::uuid, ${questionId}, ${notes ?? null}, ${sanitizedImages}::text[], NOW(), NOW())
				ON CONFLICT (user_id, question_id) DO UPDATE SET
					notes = ${notes ?? null},
					notes_image_urls = ${sanitizedImages}::text[],
					updated_at = NOW()
				RETURNING user_id::text AS "userId", question_id::text AS "questionId", notes, notes_image_urls AS "notesImageUrls"
			`;
		} else {
			result = await prisma.$queryRaw<Array<any>>`
				INSERT INTO clinical_case_notes (user_id, question_id, notes, created_at, updated_at)
				VALUES (${userId}::uuid, ${questionId}, ${notes ?? null}, NOW(), NOW())
				ON CONFLICT (user_id, question_id) DO UPDATE SET
					notes = ${notes ?? null},
					updated_at = NOW()
				RETURNING user_id::text AS "userId", question_id::text AS "questionId", notes, '[]'::text[] AS "notesImageUrls"
			`;
		}
		console.log('POST clinical-case-notes - Saved result:', result[0]);
		return NextResponse.json(result[0]);
	} catch (e) {
		console.error('POST clinical-case-notes error', e);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}