// Preloaded before any test file (see bunfig.toml).
//
// `bun test` forces NODE_ENV=test, and Bun intentionally does NOT load
// .env.local in test mode. So provide the env the app needs to boot here.
// Real environment variables (e.g. in CI) take precedence — we only fill gaps.
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-jwt-secret';
}
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgres://user:password@localhost:5433/notesdb';
}
if (!process.env.GOOGLE_API_KEY) {
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
}
