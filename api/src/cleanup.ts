/**
 * Cleanup script for auto-deleting notes older than 30 days
 * Run this periodically (e.g., daily cron job)
 */

import { db, client } from './infrastructure/db';
import { notes } from './infrastructure/db/schema';
import { sql } from 'drizzle-orm';

const DAYS_TO_KEEP = 30;

async function cleanup() {
    console.log(`[Cleanup] Starting cleanup of notes deleted more than ${DAYS_TO_KEEP} days ago...`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);

    // Find and delete old notes
    const result = await db.delete(notes)
        .where(sql`deleted_at < ${cutoffDate}`)
        .returning({ id: notes.id });

    const deletedCount = result.length;

    console.log(`[Cleanup] Deleted ${deletedCount} notes older than ${DAYS_TO_KEEP} days`);

    // Close database connection
    await client.end();

    process.exit(0);
}

cleanup().catch((err) => {
    console.error('[Cleanup] Error:', err);
    process.exit(1);
});
