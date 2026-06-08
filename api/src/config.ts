// api/src/config.ts
import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function optionalFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const port = optionalInt('PORT', 3001);

export const config = {
  // Server
  port,
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  trustProxyHeaders: process.env.TRUST_PROXY_HEADERS === 'true',
  apiUrl: optional('API_URL', `http://localhost:${port}`),

  // Security
  jwtSecret: required('JWT_SECRET'),
  jwtExpirySeconds: optionalInt('JWT_EXPIRY_SECONDS', 60 * 60 * 24 * 7), // 7 days

  // CORS
  corsOrigin: optional('CORS_ORIGIN', ''),

  // Database
  databaseUrl: optional('DATABASE_URL', 'postgres://user:password@localhost:5433/notesdb'),

  // Note limits
  maxTagsPerNote: optionalInt('MAX_TAGS_PER_NOTE', 20),
  maxTagLength: optionalInt('MAX_TAG_LENGTH', 100),
  maxFolderLength: optionalInt('MAX_FOLDER_LENGTH', 100),

  // File uploads (sizes given as MB in env, converted to bytes here)
  maxUploadFileBytes: optionalInt('MAX_UPLOAD_FILE_MB', 10) * 1024 * 1024,
  maxImportFileBytes: optionalInt('MAX_IMPORT_FILE_MB', 5) * 1024 * 1024,
  allowedUploadMimeTypes: optional('ALLOWED_UPLOAD_MIME_TYPES', 'image/jpeg,image/png,image/webp')
    .split(',').map((s) => s.trim()).filter(Boolean),

  // DeepSeek
  deepseek: {
    baseUrl: optional('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
    apiKey: optional('DEEPSEEK_API_KEY', ''),
    chatModel: optional('DEEPSEEK_MODEL', 'deepseek-chat'),
    temperature: optionalFloat('DEEPSEEK_TEMPERATURE', 0.2),
    maxTokens: optionalInt('DEEPSEEK_MAX_TOKENS', 1024),
  },

  // Google AI (Gemini + embeddings)
  google: {
    baseUrl: optional('GOOGLE_AI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta'),
    apiKey: optional('GOOGLE_API_KEY', ''),
    chatModel: optional('GEMINI_CHAT_MODEL', 'gemini-2.5-flash-lite'),
    embedModel: optional('GEMINI_EMBED_MODEL', 'text-embedding-004'),
    embedDimensions: optionalInt('GEMINI_EMBED_DIMENSIONS', 768),
    temperature: optionalFloat('GEMINI_TEMPERATURE', 0.2),
    maxTokens: optionalInt('GEMINI_MAX_TOKENS', 1024),
  },

  // RAG pipeline knobs
  rag: {
    chunkMaxChars: optionalInt('RAG_CHUNK_MAX_CHARS', 3200),
    retrieveTopK: optionalInt('RAG_RETRIEVE_TOP_K', 20),
    answerTopK: optionalInt('RAG_ANSWER_TOP_K', 8),
    rerankSnippetChars: optionalInt('RAG_RERANK_SNIPPET_CHARS', 800),
    summaryMaxInputChars: optionalInt('AI_SUMMARY_MAX_INPUT_CHARS', 8000),
    detectActionsMaxInputChars: optionalInt('AI_DETECT_ACTIONS_MAX_INPUT_CHARS', 8000),
  },
} as const;

export type AppConfig = typeof config;
