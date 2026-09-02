CREATE TABLE "card_events" (
	"id" text PRIMARY KEY,
	"cardId" text NOT NULL,
	"runId" text,
	"fromLaneId" text,
	"toLaneId" text,
	"note" text DEFAULT '' NOT NULL,
	"actor" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "verdict" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
CREATE INDEX "card_deps_depends_idx" ON "card_deps" ("dependsOnCardId");--> statement-breakpoint
CREATE INDEX "card_events_card_idx" ON "card_events" ("cardId");--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_cardId_cards_id_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_runId_runs_id_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_fromLaneId_lanes_id_fkey" FOREIGN KEY ("fromLaneId") REFERENCES "lanes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_toLaneId_lanes_id_fkey" FOREIGN KEY ("toLaneId") REFERENCES "lanes"("id") ON DELETE SET NULL;--> statement-breakpoint
-- `blocked` is gone as a status. It was written once, when a card was first passed over, and
-- never revisited — so a card whose dependency finished long ago is still sitting here saying
-- it is waiting. What it waits on is read off the cards around it now, and the answer is right
-- every time it is asked. `error` carried the same staleness as `waiting on: …` text.
UPDATE "cards" SET "status" = 'idle', "error" = '' WHERE "status" = 'blocked';
