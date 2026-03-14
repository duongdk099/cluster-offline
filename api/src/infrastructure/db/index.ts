import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import 'dotenv/config';

const connectionString = 
  process.env.DATABASE_URL || 
  `postgres://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD}@${process.env.DB_HOST || 'localhost'}:5432/${process.env.DB_NAME || 'notesdb'}`;
export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
