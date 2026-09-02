CREATE TABLE "card_notes" (
	"id" text PRIMARY KEY,
	"cardId" text NOT NULL,
	"runId" text,
	"kind" text DEFAULT 'note' NOT NULL,
	"author" text DEFAULT 'user' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL,
	"updatedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "card_notes_card_idx" ON "card_notes" ("cardId");--> statement-breakpoint
ALTER TABLE "card_notes" ADD CONSTRAINT "card_notes_cardId_cards_id_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "card_notes" ADD CONSTRAINT "card_notes_runId_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "card_events" ADD COLUMN "noteId" text;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_noteId_card_notes_id_fkey" FOREIGN KEY ("noteId") REFERENCES "card_notes"("id") ON DELETE SET NULL;--> statement-breakpoint
INSERT INTO "card_notes" ("id", "cardId", "runId", "kind", "author", "body", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", NULL, 'report', 'agent', "result", "updatedAt", "updatedAt"
FROM "cards" WHERE "result" <> '';--> statement-breakpoint
INSERT INTO "card_notes" ("id", "cardId", "runId", "kind", "author", "body", "createdAt", "updatedAt")
SELECT "id", "cardId", "runId",
       CASE WHEN "actor" = 'agent' THEN 'verdict' ELSE 'note' END,
       CASE WHEN "actor" = 'agent' THEN 'agent' ELSE 'user' END,
       "note", "createdAt", "createdAt"
FROM "card_events" WHERE "note" <> '';--> statement-breakpoint
UPDATE "card_events" SET "noteId" = "id" WHERE "note" <> '';--> statement-breakpoint
ALTER TABLE "card_events" DROP COLUMN "note";--> statement-breakpoint
ALTER TABLE "cards" DROP COLUMN "result";
