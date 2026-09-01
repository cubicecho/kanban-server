CREATE TABLE "agent_servers" (
	"id" text PRIMARY KEY,
	"agentId" text NOT NULL,
	"serverId" text NOT NULL,
	CONSTRAINT "agent_servers_pair" UNIQUE("agentId","serverId")
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"role" text DEFAULT 'execute' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"baseUrl" text DEFAULT '' NOT NULL,
	"apiKey" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"systemPrompt" text DEFAULT '' NOT NULL,
	"maxTokens" integer DEFAULT 0 NOT NULL,
	"temperature" real DEFAULT -1 NOT NULL,
	"maxToolIterations" integer DEFAULT 0 NOT NULL,
	"toolDiscovery" text DEFAULT 'inherit' NOT NULL,
	"requestTimeoutSeconds" integer DEFAULT 0 NOT NULL,
	"maxRetries" integer DEFAULT -1 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_deps" (
	"id" text PRIMARY KEY,
	"cardId" text NOT NULL,
	"dependsOnCardId" text NOT NULL,
	CONSTRAINT "card_deps_pair" UNIQUE("cardId","dependsOnCardId")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" text PRIMARY KEY,
	"projectId" text NOT NULL,
	"taskId" text,
	"laneId" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"acceptance" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lanes" (
	"id" text PRIMARY KEY,
	"projectId" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"intake" boolean DEFAULT false NOT NULL,
	"agentId" text,
	"onSuccessLaneId" text,
	"onFailureLaneId" text,
	"wipLimit" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" text PRIMARY KEY,
	"slug" text NOT NULL UNIQUE,
	"label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"transport" text DEFAULT 'stdio' NOT NULL,
	"command" text DEFAULT '' NOT NULL,
	"args" jsonb,
	"env" jsonb,
	"url" text DEFAULT '' NOT NULL,
	"headers" jsonb
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY,
	"taskId" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"autoRun" boolean DEFAULT false NOT NULL,
	"refineAgentId" text,
	"decomposeAgentId" text,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" text PRIMARY KEY,
	"projectId" text NOT NULL,
	"agentId" text,
	"kind" text DEFAULT 'card' NOT NULL,
	"taskId" text,
	"cardId" text,
	"laneId" text,
	"status" text DEFAULT 'running' NOT NULL,
	"startedAt" timestamp with time zone NOT NULL,
	"finishedAt" timestamp with time zone,
	"output" text DEFAULT '' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"toolCalls" jsonb,
	"promptTokens" integer DEFAULT 0 NOT NULL,
	"completionTokens" integer DEFAULT 0 NOT NULL,
	"totalTokens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'default',
	"baseUrl" text DEFAULT 'http://localhost:11434/v1' NOT NULL,
	"apiKey" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"maxTokens" integer DEFAULT 4096 NOT NULL,
	"temperature" real DEFAULT 0.7 NOT NULL,
	"maxToolIterations" integer DEFAULT 20 NOT NULL,
	"toolDiscovery" text DEFAULT 'eager' NOT NULL,
	"toolSelectModel" text DEFAULT '' NOT NULL,
	"requestTimeoutSeconds" integer DEFAULT 120 NOT NULL,
	"maxRetries" integer DEFAULT 2 NOT NULL,
	"runRetentionDays" integer DEFAULT 0 NOT NULL,
	"workerIntervalSeconds" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY,
	"projectId" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "agent_servers_agent_idx" ON "agent_servers" ("agentId");--> statement-breakpoint
CREATE INDEX "card_deps_card_idx" ON "card_deps" ("cardId");--> statement-breakpoint
CREATE INDEX "cards_project_idx" ON "cards" ("projectId");--> statement-breakpoint
CREATE INDEX "cards_lane_idx" ON "cards" ("laneId");--> statement-breakpoint
CREATE INDEX "lanes_project_idx" ON "lanes" ("projectId");--> statement-breakpoint
CREATE INDEX "messages_task_idx" ON "messages" ("taskId");--> statement-breakpoint
CREATE INDEX "runs_project_idx" ON "runs" ("projectId");--> statement-breakpoint
CREATE INDEX "runs_card_idx" ON "runs" ("cardId");--> statement-breakpoint
CREATE INDEX "runs_started_idx" ON "runs" ("startedAt");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" ("projectId");--> statement-breakpoint
ALTER TABLE "agent_servers" ADD CONSTRAINT "agent_servers_agentId_agents_id_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "agent_servers" ADD CONSTRAINT "agent_servers_serverId_mcp_servers_id_fkey" FOREIGN KEY ("serverId") REFERENCES "mcp_servers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "card_deps" ADD CONSTRAINT "card_deps_cardId_cards_id_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "card_deps" ADD CONSTRAINT "card_deps_dependsOnCardId_cards_id_fkey" FOREIGN KEY ("dependsOnCardId") REFERENCES "cards"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_projectId_projects_id_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_taskId_tasks_id_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_laneId_lanes_id_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_projectId_projects_id_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_agentId_agents_id_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_onSuccessLaneId_lanes_id_fkey" FOREIGN KEY ("onSuccessLaneId") REFERENCES "lanes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_onFailureLaneId_lanes_id_fkey" FOREIGN KEY ("onFailureLaneId") REFERENCES "lanes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_taskId_tasks_id_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_refineAgentId_agents_id_fkey" FOREIGN KEY ("refineAgentId") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_decomposeAgentId_agents_id_fkey" FOREIGN KEY ("decomposeAgentId") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_projectId_projects_id_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_agentId_agents_id_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_taskId_tasks_id_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_cardId_cards_id_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_laneId_lanes_id_fkey" FOREIGN KEY ("laneId") REFERENCES "lanes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_projects_id_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE;