CREATE TABLE "notes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"reset_token" varchar(255),
	"reset_token_expiry" timestamp,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
