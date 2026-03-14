import { db } from './src/infrastructure/db';
import { sql } from 'drizzle-orm';

async function main() {
    await db.execute(sql`DROP TABLE IF EXISTS notes;`);
    console.log('Notes table dropped');
    process.exit(0);
}

main();
