CREATE TABLE "roles" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"description" text DEFAULT '' NOT NULL,
	"stage" text DEFAULT 'card' NOT NULL,
	"systemPrompt" text DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- The four roles that were an enum on `agents` become rows. Their prompts are left empty and
-- filled in on boot by `ensureSchema`, which is where the words live; nothing is lost by that,
-- because every agent that exists at this point carries its own copy of the prompt already.
INSERT INTO "roles" ("id", "name", "description", "stage", "systemPrompt", "createdAt", "updatedAt")
VALUES
	(gen_random_uuid()::text, 'refiner', 'Talks a rough request into a task worth working on', 'refine', '', now(), now()),
	(gen_random_uuid()::text, 'decomposer', 'Turns an accepted task into the cards that carry it out', 'decompose', '', now(), now()),
	(gen_random_uuid()::text, 'executor', 'Works a card using the tools it has been given', 'card', '', now(), now()),
	(gen_random_uuid()::text, 'reviewer', 'Checks a finished card against its acceptance criteria, PASS or FAIL', 'card', '', now(), now())
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "lanes" ADD COLUMN "readVerdict" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- A station that judged cards did so because its agent had the `review` role. Read that off the
-- board before the column it is read from goes away.
UPDATE "lanes" SET "readVerdict" = true
WHERE "agentId" IN (SELECT "id" FROM "agents" WHERE "role" = 'review');
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "roleId" text;--> statement-breakpoint
UPDATE "agents" SET "roleId" = (
	SELECT "id" FROM "roles" WHERE "roles"."name" = CASE "agents"."role"
		WHEN 'refine' THEN 'refiner'
		WHEN 'decompose' THEN 'decomposer'
		WHEN 'review' THEN 'reviewer'
		ELSE 'executor'
	END
);
--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "roleId" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_roleId_roles_id_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT;
