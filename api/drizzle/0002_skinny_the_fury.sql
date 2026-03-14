ALTER TABLE "notes" ALTER COLUMN "content" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "deleted_at" timestamp;