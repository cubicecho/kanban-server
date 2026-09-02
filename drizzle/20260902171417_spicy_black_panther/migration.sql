ALTER TABLE "agents" DROP CONSTRAINT "agents_roleId_roles_id_fkey";--> statement-breakpoint
ALTER TABLE "roles" RENAME COLUMN "stage" TO "contract";--> statement-breakpoint
ALTER TABLE "roles" RENAME COLUMN "systemPrompt" TO "prompt";--> statement-breakpoint
ALTER TABLE "lanes" ADD COLUMN "roleId" text;--> statement-breakpoint
ALTER TABLE "lanes" ADD COLUMN "prompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "refineAgentId" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "decomposeAgentId" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "refinePrompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
--
-- The job moves from the agent to the lane, and everything below here has to happen while both
-- ends of that move still exist: `agents.roleId` is read for the last time, and `readVerdict`
-- is what decides which roles were really judging. The two DROPs are at the bottom for that
-- reason, and the order of these statements is not drizzle-kit's.
--
UPDATE "lanes" SET "roleId" = a."roleId" FROM "agents" a WHERE "lanes"."agentId" = a."id";--> statement-breakpoint
--
-- Refining and decomposing are not stations, so after this there is no way to ask which agent
-- can do them. Freeze the answer `resolveStage` would have given, before the join that computes
-- it is gone: the first enabled agent holding a role for that stage, by name.
--
UPDATE "settings" SET "refineAgentId" = (
  SELECT a."id" FROM "agents" a JOIN "roles" r ON a."roleId" = r."id"
  WHERE r."contract" = 'refine' AND a."enabled" ORDER BY a."name" LIMIT 1
) WHERE "id" = 'default';--> statement-breakpoint
UPDATE "settings" SET "decomposeAgentId" = (
  SELECT a."id" FROM "agents" a JOIN "roles" r ON a."roleId" = r."id"
  WHERE r."contract" = 'decompose' AND a."enabled" ORDER BY a."name" LIMIT 1
) WHERE "id" = 'default';--> statement-breakpoint
--
-- The refiner's prompt has to reach settings before the row it lives on is deleted, or a
-- customised refiner is lost. Empty means "use REFINE_SYSTEM", which is also what a server
-- that never edited it wants.
--
UPDATE "settings" SET "refinePrompt" = COALESCE(
  (SELECT "prompt" FROM "roles" WHERE "contract" = 'refine' ORDER BY "name" LIMIT 1), ''
) WHERE "id" = 'default';--> statement-breakpoint
--
-- A role served by both a judging and a working lane becomes two roles. Repointing every lane
-- at one of them would silently turn a working station into a judging one, or the other way
-- about, which is exactly the kind of quiet wedge this board refuses everywhere else.
--
INSERT INTO "roles" ("id", "name", "description", "contract", "prompt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, r."name" || ' (review)', r."description", 'verdict', r."prompt", now(), now()
FROM "roles" r
WHERE EXISTS (SELECT 1 FROM "lanes" l WHERE l."roleId" = r."id" AND l."readVerdict")
  AND EXISTS (SELECT 1 FROM "lanes" l WHERE l."roleId" = r."id" AND NOT l."readVerdict");--> statement-breakpoint
UPDATE "lanes" l SET "roleId" = c."id"
FROM "roles" c JOIN "roles" r ON c."name" = r."name" || ' (review)'
WHERE l."readVerdict" AND l."roleId" = r."id";--> statement-breakpoint
--
-- What is left maps straight across: a role only ever on judging lanes judges, every other
-- card role works, and the decomposer becomes the kind of lane that expands a card.
--
UPDATE "roles" SET "contract" = 'verdict' WHERE "contract" = 'card'
  AND EXISTS (SELECT 1 FROM "lanes" l WHERE l."roleId" = "roles"."id" AND l."readVerdict");--> statement-breakpoint
UPDATE "roles" SET "contract" = 'work' WHERE "contract" = 'card';--> statement-breakpoint
--
-- The seeded reviewer with no lane behind it — a fresh database, or a server whose boards never
-- used it — has nothing to read its contract off. It is the one role whose job is known from
-- here, having been written by a migration rather than by a person, and a server that landed
-- with no judging kind at all could draw no Review lane.
--
UPDATE "roles" SET "contract" = 'verdict' WHERE "name" = 'reviewer' AND "contract" = 'work'
  AND NOT EXISTS (SELECT 1 FROM "lanes" l WHERE l."roleId" = "roles"."id");--> statement-breakpoint
UPDATE "roles" SET "contract" = 'expand' WHERE "contract" = 'decompose';--> statement-breakpoint
DELETE FROM "roles" WHERE "contract" = 'refine';--> statement-breakpoint
--
-- The three seeded roles are named after the stations they staff now, not after the workers
-- that used to hold them. Only where the name is untouched, and only where the new one is
-- free: a renamed role belongs to whoever renamed it.
--
UPDATE "roles" SET "name" = 'Doing' WHERE "name" = 'executor'
  AND NOT EXISTS (SELECT 1 FROM "roles" r WHERE r."name" = 'Doing');--> statement-breakpoint
UPDATE "roles" SET "name" = 'Review' WHERE "name" = 'reviewer'
  AND NOT EXISTS (SELECT 1 FROM "roles" r WHERE r."name" = 'Review');--> statement-breakpoint
UPDATE "roles" SET "name" = 'Intake' WHERE "name" = 'decomposer'
  AND NOT EXISTS (SELECT 1 FROM "roles" r WHERE r."name" = 'Intake');--> statement-breakpoint
ALTER TABLE "lanes" DROP COLUMN "readVerdict";--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "roleId";--> statement-breakpoint
ALTER TABLE "roles" ALTER COLUMN "contract" SET DEFAULT 'work';--> statement-breakpoint
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_roleId_roles_id_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_refineAgentId_agents_id_fkey" FOREIGN KEY ("refineAgentId") REFERENCES "agents"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_decomposeAgentId_agents_id_fkey" FOREIGN KEY ("decomposeAgentId") REFERENCES "agents"("id") ON DELETE SET NULL;
