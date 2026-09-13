CREATE TABLE "artifacts" (
	"id" text PRIMARY KEY,
	"projectId" text NOT NULL,
	"cardId" text,
	"runId" text,
	"location" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"mediaType" text,
	"action" text DEFAULT 'created' NOT NULL,
	"source" text DEFAULT 'declared' NOT NULL,
	"serverId" text,
	"serverSlug" text DEFAULT '' NOT NULL,
	"serverLabel" text DEFAULT '' NOT NULL,
	"transport" text DEFAULT '' NOT NULL,
	"tool" text DEFAULT '' NOT NULL,
	"sizeBytes" integer,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "artifacts_project_idx" ON "artifacts" ("projectId","createdAt");--> statement-breakpoint
CREATE INDEX "artifacts_card_idx" ON "artifacts" ("cardId");--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_projectId_projects_id_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_cardId_cards_id_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_runId_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_serverId_mcp_servers_id_fkey" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE SET NULL;