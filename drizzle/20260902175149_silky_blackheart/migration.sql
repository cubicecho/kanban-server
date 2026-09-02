ALTER TABLE "projects" DROP CONSTRAINT "projects_decomposeAgentId_agents_id_fkey";--> statement-breakpoint
ALTER TABLE "settings" DROP CONSTRAINT "settings_decomposeAgentId_agents_id_fkey";--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "parentId" text;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "decomposeAgentId";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "decomposeAgentId";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN "error";--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_parentId_cards_id_fkey" FOREIGN KEY ("parentId") REFERENCES "cards"("id") ON DELETE SET NULL;