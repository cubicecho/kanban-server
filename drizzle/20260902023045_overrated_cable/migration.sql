ALTER TABLE "cards" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "lanes" ADD COLUMN "maxAttempts" integer DEFAULT 0 NOT NULL;