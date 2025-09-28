// Shared in-memory store for classic validation generated files.
// NOTE: For production, replace with Redis/File storage with TTL.

type StoredValidationFiles = {
  goodFileBuffer: Buffer;
  errorFileBuffer: Buffer;
  reportBuffer: Buffer;
  fileName: string;
  createdAt: number;
};

const validationFiles = new Map<string, StoredValidationFiles>();

// Default TTL: 1 hour
const VALIDATION_FILES_TTL_MS = 60 * 60 * 1000;

export function storeValidationFiles(sessionId: string, data: {
  goodFileBuffer: Buffer;
  errorFileBuffer: Buffer;
  reportBuffer: Buffer;
  fileName: string;
}): void {
  console.log('Storing validation files for sessionId:', sessionId, 'fileName:', data.fileName);
  validationFiles.set(sessionId, { ...data, createdAt: Date.now() });
  console.log('Total sessions in store:', validationFiles.size);
  // Schedule cleanup
  setTimeout(() => {
    console.log('Cleaning up validation files for sessionId:', sessionId);
    validationFiles.delete(sessionId);
  }, VALIDATION_FILES_TTL_MS).unref?.();
}

export function getValidationFiles(sessionId: string): StoredValidationFiles | null {
  console.log('Getting validation files for sessionId:', sessionId);
  console.log('Available sessions:', Array.from(validationFiles.keys()));
  const v = validationFiles.get(sessionId) || null;
  console.log('Found validation files:', !!v);
  return v;
}

// Optional manual cleanup (e.g., on logout or admin action)
export function deleteValidationFiles(sessionId: string): void {
  validationFiles.delete(sessionId);
}
