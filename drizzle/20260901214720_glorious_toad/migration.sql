CREATE TABLE "board_templates" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"description" text DEFAULT '' NOT NULL,
	"lanes" jsonb NOT NULL,
	"createdAt" timestamp with time zone NOT NULL
);
