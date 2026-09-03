ALTER TABLE "agents" ADD COLUMN "contextLength" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "contextLength" integer DEFAULT 0 NOT NULL;