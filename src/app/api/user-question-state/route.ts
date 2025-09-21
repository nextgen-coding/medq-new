import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// Helper function to validate UUID format
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Helper function to get question ID for SQL query
function getQuestionIdForQuery(questionId: string): string {
  if (isValidUUID(questionId)) {
    return questionId;
  }
  // Create a deterministic UUID from the string-based question ID
  return generateDeterministicUUID(questionId);
}

// Helper function to generate a deterministic UUID from a string
function generateDeterministicUUID(input: string): string {
  // Use a simple hash of the input to create a UUID-like string
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Convert hash to hex and ensure we have enough characters
  const hashStr = Math.abs(hash).toString(16).padStart(32, '0');

  // Create a valid UUID format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where y is one of 8, 9, a, b
  return `${hashStr.slice(0, 8)}-${hashStr.slice(8, 12)}-4${hashStr.slice(12, 15)}-a${hashStr.slice(15, 18)}-${hashStr.slice(18, 30)}`;
}

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
		const queryQuestionId = getQuestionIdForQuery(questionId);

		// Check if this is a clinical case or grouped question
		const isClinicalCase = questionId.startsWith('clinical-case-') ||
			questionId.startsWith('group-qroc-') ||
			questionId.startsWith('group-qcm-') ||
			questionId.startsWith('group-mcq-') ||
			questionId.startsWith('group-qcm-');

		if (isClinicalCase) {
			// For clinical cases, try to get the data directly
			console.log('GET /api/user-question-state - Handling as clinical case:', { userId, questionId, queryQuestionId });
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
 					WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid
 					LIMIT 1
 				`;
 				console.log('GET /api/user-question-state - Clinical case query result:', rows[0] ?? null);
 				console.log('GET /api/user-question-state - Clinical case query result details:', {
 					hasResult: rows.length > 0,
 					result: rows[0],
 					lastScore: rows[0]?.lastScore,
 					notes: rows[0]?.notes,
 					highlights: rows[0]?.highlights
 				});
 				return NextResponse.json(rows[0] ?? null);
 			} catch (sqlErr: any) {
 				console.warn('Clinical case notes query failed:', sqlErr?.message);
 				// Return null for clinical cases that don't have data yet
 				return NextResponse.json(null);
 			}
 		}

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
 				WHERE user_id = ${userId}::uuid AND question_id = ${queryQuestionId}::uuid
 				LIMIT 1
 			`;
 			console.log('GET /api/user-question-state - Query result:', rows[0] ?? null);
 			console.log('GET /api/user-question-state - Query result details:', {
 				hasResult: rows.length > 0,
 				result: rows[0],
 				lastScore: rows[0]?.lastScore,
 				notes: rows[0]?.notes,
 				highlights: rows[0]?.highlights
 			});
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
 				WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid
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

// Helper function to handle clinical case notes (since they don't have entries in questions table)
async function handleClinicalCaseNotes(userId: string, questionId: string, notes: string | null, highlights: any, attempts: number | null, lastScore: number | null, incrementAttempts: boolean, notesImageUrls: string[]) {
	// For clinical cases, we'll use a transaction to ensure both operations succeed
	const placeholderQuestionId = getQuestionIdForQuery(questionId);

	let nextAttempts = attempts;
	if (incrementAttempts) {
		try {
			// Try to get existing attempts
			const existing = await prisma.$queryRaw<Array<any>>`SELECT attempts FROM question_user_data WHERE user_id = ${userId}::uuid AND question_id = ${placeholderQuestionId}::uuid LIMIT 1`;
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

	// Serialize highlights as JSON
	const highlightsJson = highlights !== undefined ? JSON.stringify(highlights) : null;

	// Use a transaction to ensure both operations succeed
	console.log('handleClinicalCaseNotes - Starting transaction:', { userId, questionId, placeholderQuestionId, notes, lastScore });
	const result = await prisma.$transaction(async (tx) => {
		// First, ensure the placeholder question exists
		console.log('handleClinicalCaseNotes - Ensuring placeholder question exists');
		await tx.$executeRaw`
			INSERT INTO questions (id, text, type, options, correct_answers, created_at, updated_at)
			VALUES (
				${placeholderQuestionId}::uuid,
				${`Clinical Case Notes: ${questionId}`}::text,
				'open'::question_type,
				'[]'::jsonb,
				'[]'::jsonb,
				NOW(),
				NOW()
			)
			ON CONFLICT (id) DO NOTHING
		`;

		// Check if notes_image_urls column exists
		const hasImagesCol = await tx.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='question_user_data' AND column_name='notes_image_urls' LIMIT 1`;

		// Now insert/update the user data
		if (hasImagesCol.length > 0) {
			await tx.$executeRaw`
				INSERT INTO question_user_data (user_id, question_id, notes, highlights, attempts, "lastScore", notes_image_urls)
				VALUES (${userId}::uuid, ${placeholderQuestionId}::uuid, ${notes ?? null}, ${highlightsJson}::jsonb, ${(nextAttempts ?? 0)}, ${lastScore ?? null}, ${sanitizedImages}::text[])
				ON CONFLICT (user_id, question_id) DO UPDATE SET
					notes = ${notes ?? null},
					highlights = ${highlightsJson}::jsonb,
					attempts = ${(nextAttempts ?? 0)},
					"lastScore" = ${lastScore ?? null},
					notes_image_urls = ${sanitizedImages}::text[],
					updated_at = NOW()
			`;
		} else {
			await tx.$executeRaw`
				INSERT INTO question_user_data (user_id, question_id, notes, highlights, attempts, "lastScore")
				VALUES (${userId}::uuid, ${placeholderQuestionId}::uuid, ${notes ?? null}, ${highlightsJson}::jsonb, ${(nextAttempts ?? 0)}, ${lastScore ?? null})
				ON CONFLICT (user_id, question_id) DO UPDATE SET
					notes = ${notes ?? null},
					highlights = ${highlightsJson}::jsonb,
					attempts = ${(nextAttempts ?? 0)},
					"lastScore" = ${lastScore ?? null},
					updated_at = NOW()
			`;
		}

		// Return the updated/created row
		if (hasImagesCol.length > 0) {
			const row = await tx.$queryRaw<Array<any>>`
				SELECT user_id::text AS "userId", question_id::text AS "questionId", notes, highlights, attempts, "lastScore", notes_image_urls AS "notesImageUrls"
				FROM question_user_data
				WHERE user_id = ${userId}::uuid AND question_id = ${placeholderQuestionId}::uuid
				LIMIT 1
			`;
			console.log('handleClinicalCaseNotes - Final result (with images):', row[0]);
			return row[0];
		} else {
			const row = await tx.$queryRaw<Array<any>>`
				SELECT user_id::text AS "userId", question_id::text AS "questionId", notes, highlights, attempts, "lastScore"
				FROM question_user_data
				WHERE user_id = ${userId}::uuid AND question_id = ${placeholderQuestionId}::uuid
				LIMIT 1
			`;
			const result = row[0];
			if (result) result.notesImageUrls = [];
			console.log('handleClinicalCaseNotes - Final result (without images):', result);
			return result;
		}
	});

	return result;
}

// POST /api/user-question-state { userId, questionId, notes?, highlights?, attempts?, lastScore? }
export async function POST(req: Request) {
	try {
		const body = await req.json();
				 const { userId, questionId, notes, highlights, attempts, lastScore, incrementAttempts, notesImageUrls } = body || {};
				 console.log('POST /api/user-question-state payload:', {
					 userId,
					 questionId,
					 notes,
					 highlights,
					 highlightsType: typeof highlights,
					 highlightsIsArray: Array.isArray(highlights),
					 attempts,
					 lastScore,
					 incrementAttempts,
					 notesImageUrls
				 });

		const queryQuestionId = getQuestionIdForQuery(questionId);
		console.log('POST /api/user-question-state - Using questionId:', { questionId, queryQuestionId, isValidUUID: isValidUUID(questionId) });

		if (!userId || !questionId) {
			return NextResponse.json({ error: 'userId and questionId are required' }, { status: 400 });
		}

 		// Check if this is a clinical case or grouped question (non-UUID format)
 		const isClinicalCase = questionId.startsWith('clinical-case-') ||
 			questionId.startsWith('group-qroc-') ||
 			questionId.startsWith('group-qcm-') ||
 			questionId.startsWith('group-mcq-') ||
 			questionId.startsWith('group-qcm-') ||
 			!isValidUUID(questionId); // Also catch any non-UUID format

 		console.log('Is clinical case:', isClinicalCase, 'questionId:', questionId);

 		if (isClinicalCase) {
 			// For clinical cases and grouped questions, we need to handle them differently
 			// since they don't have entries in the questions table
 			console.log('POST /api/user-question-state - Handling as clinical case:', { userId, questionId, notes, highlights, lastScore });
 			try {
 				const result = await handleClinicalCaseNotes(userId, questionId, notes, highlights, attempts, lastScore, incrementAttempts, notesImageUrls);
 				console.log('POST /api/user-question-state - Clinical case result:', result);
 				return NextResponse.json(result);
 			} catch (sqlErr: any) {
 				console.error('POST clinical case notes error', sqlErr);
 				return NextResponse.json({ error: 'Database error', detail: sqlErr?.message || sqlErr }, { status: 500 });
 			}
 		}

		let nextAttempts = attempts;
		if (incrementAttempts) {
			try {
				// Try to get existing attempts
				const existing = await prisma.$queryRaw<Array<any>>`SELECT attempts FROM question_user_data WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid LIMIT 1`;
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
		   // Serialize highlights as a single JSON value (not array type)
		   const highlightsJson = highlights !== undefined ? JSON.stringify(highlights) : null;
		   console.log('POST /api/user-question-state - About to save:', {
		    userId,
		    questionId,
		    queryQuestionId,
		    notes,
		    highlights,
		    highlightsJson,
		    attempts: nextAttempts,
		    lastScore,
		    sanitizedImages
		   });
		   try {
		    const result = await prisma.$transaction(async (tx) => {
		     const existing = await tx.$queryRaw<Array<any>>`SELECT id FROM question_user_data WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid LIMIT 1`;

		     // Add logging to confirm notes field processing
		     console.log('POST /api/user-question-state - Transaction started, existing record:', existing.length > 0);
		     console.log('Inserting/Updating notes field:', { notes });

				   if (existing.length === 0) {
					   // Check if notes_image_urls column exists before including it
					   const hasImagesCol = await tx.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='question_user_data' AND column_name='notes_image_urls' LIMIT 1`;
                   
					   if (hasImagesCol.length > 0) {
					     await tx.$executeRaw`
					      INSERT INTO question_user_data (user_id, question_id, notes, highlights, attempts, "lastScore", notes_image_urls)
					      VALUES (${userId}::uuid, ${getQuestionIdForQuery(questionId)}::uuid, ${notes ?? null}, ${highlightsJson}::jsonb, ${(nextAttempts ?? 0)}, ${lastScore ?? null}, ${sanitizedImages}::text[])
					     `;
					    } else {
					     await tx.$executeRaw`
					      INSERT INTO question_user_data (user_id, question_id, notes, highlights, attempts, "lastScore")
					      VALUES (${userId}::uuid, ${getQuestionIdForQuery(questionId)}::uuid, ${notes ?? null}, ${highlightsJson}::jsonb, ${(nextAttempts ?? 0)}, ${lastScore ?? null})
					     `;
					    }
				   } else {
					   // Update existing
					   const hasImagesCol = await tx.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='question_user_data' AND column_name='notes_image_urls' LIMIT 1`;
                   
					   if (hasImagesCol.length > 0) {
					     await tx.$executeRaw`
					      UPDATE question_user_data
					      SET notes = ${notes ?? null}, highlights = ${highlightsJson}::jsonb, attempts = ${(nextAttempts ?? attempts ?? 0)}, "lastScore" = ${lastScore ?? null}, notes_image_urls = ${sanitizedImages}::text[], updated_at = NOW()
					      WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid
					     `;
					    } else {
					     await tx.$executeRaw`
					      UPDATE question_user_data
					      SET notes = ${notes ?? null}, highlights = ${highlightsJson}::jsonb, attempts = ${(nextAttempts ?? attempts ?? 0)}, "lastScore" = ${lastScore ?? null}, updated_at = NOW()
					      WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid
					     `;
					    }
				   }
				
				// Return the updated/created row
				const hasImagesCol = await tx.$queryRaw<Array<any>>`SELECT 1 FROM information_schema.columns WHERE table_name='question_user_data' AND column_name='notes_image_urls' LIMIT 1`;

				if (hasImagesCol.length > 0) {
					const row = await tx.$queryRaw<Array<any>>`
						SELECT user_id::text AS "userId", question_id::text AS "questionId", notes, highlights, attempts, "lastScore", notes_image_urls AS "notesImageUrls"
						FROM question_user_data
						WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid
						LIMIT 1
					`;
					console.log('POST /api/user-question-state - Transaction result (with images):', row[0]);
					return row[0];
				} else {
					const row = await tx.$queryRaw<Array<any>>`
						SELECT user_id::text AS "userId", question_id::text AS "questionId", notes, highlights, attempts, "lastScore"
						FROM question_user_data
						WHERE user_id = ${userId}::uuid AND question_id = ${getQuestionIdForQuery(questionId)}::uuid
						LIMIT 1
					`;
					const result = row[0];
					if (result) result.notesImageUrls = [];
					console.log('POST /api/user-question-state - Transaction result (without images):', result);
					return result;
				}
			});
			
			return NextResponse.json(result);
		   } catch (sqlErr: any) {
			   console.error('POST user-question-state SQL error', sqlErr);
			   return NextResponse.json({ error: 'Database error', detail: sqlErr?.message || sqlErr }, { status: 500 });
		   }
	} catch (e) {
		console.error('POST user-question-state error', e);
		return NextResponse.json({ error: 'Internal error' }, { status: 500 });
	}
}
