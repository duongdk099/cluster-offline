import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import 'dotenv/config';

const dbUser = process.env.POSTGRES_USER || 'postgres';
const dbPassword = encodeURIComponent(process.env.POSTGRES_PASSWORD || '');
const dbHost = process.env.DB_HOST || 'localhost';
const dbName = process.env.DB_NAME || 'notesdb';
const connectionFromDiscreteEnv = `postgres://${dbUser}:${dbPassword}@${dbHost}:5432/${dbName}`;
const shouldUseDiscreteEnv = Boolean(process.env.DB_HOST);

const connectionString =
  shouldUseDiscreteEnv
    ? connectionFromDiscreteEnv
    : process.env.DATABASE_URL || connectionFromDiscreteEnv;
export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
