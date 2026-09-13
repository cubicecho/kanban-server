ALTER TABLE "mcp_servers" ADD COLUMN "hiddenTools" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "mcp_servers" ADD COLUMN "hooks" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "hooks" jsonb DEFAULT '[]' NOT NULL;