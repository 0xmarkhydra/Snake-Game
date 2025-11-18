CREATE TYPE "transaction_type" AS ENUM (
  'deposit',
  'withdraw',
  'reward',
  'penalty',
  'system_adjust'
);

CREATE TYPE "transaction_status" AS ENUM (
  'pending',
  'confirmed',
  'failed',
  'reversed'
);

CREATE TYPE "room_type" AS ENUM (
  'free',
  'vip'
);

CREATE TYPE "ticket_status" AS ENUM (
  'issued',
  'consumed',
  'expired'
);

CREATE TYPE "game_session_status" AS ENUM (
  'active',
  'completed',
  'aborted'
);

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "wallet_address" varchar(64) UNIQUE NOT NULL,
  "display_name" varchar(64),
  "avatar_url" text,
  "last_login_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()',
  "deleted_at" timestamptz
);

CREATE TABLE "user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "user_id" uuid NOT NULL,
  "jwt_id" uuid NOT NULL,
  "refresh_token" text,
  "user_agent" text,
  "ip_address" varchar(64),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()',
  "deleted_at" timestamptz
);

CREATE TABLE "wallet_balances" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "user_id" uuid UNIQUE NOT NULL,
  "available_amount" numeric(18,6) NOT NULL DEFAULT 0,
  "locked_amount" numeric(18,6) NOT NULL DEFAULT 0,
  "last_transaction_id" uuid,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()'
);

CREATE TABLE "transactions" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "user_id" uuid NOT NULL,
  "webhook_event_id" uuid,
  "type" transaction_type NOT NULL,
  "status" transaction_status NOT NULL DEFAULT 'pending',
  "amount" numeric(18,6) NOT NULL,
  "fee_amount" numeric(18,6) DEFAULT 0,
  "signature" varchar(128) UNIQUE,
  "reference_code" varchar(64) UNIQUE,
  "metadata" jsonb,
  "processed_at" timestamptz,
  "occurred_at" timestamptz DEFAULT 'now()',
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()'
);

CREATE TABLE "webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "external_signature" varchar(128) UNIQUE NOT NULL,
  "event_type" varchar(64) NOT NULL,
  "status" transaction_status NOT NULL DEFAULT 'pending',
  "payload" jsonb NOT NULL,
  "user_id" uuid,
  "processed_at" timestamptz,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()'
);

CREATE TABLE "game_sessions" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "room_type" room_type NOT NULL,
  "status" game_session_status NOT NULL DEFAULT 'active',
  "max_players" int NOT NULL DEFAULT 8,
  "started_at" timestamptz DEFAULT 'now()',
  "ended_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()'
);

CREATE TABLE "game_session_players" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "game_session_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "ticket_id" uuid,
  "joined_at" timestamptz DEFAULT 'now()',
  "left_at" timestamptz,
  "starting_credit" numeric(18,6),
  "ending_credit" numeric(18,6),
  "kill_count" int DEFAULT 0,
  "death_count" int DEFAULT 0,
  "is_winner" boolean DEFAULT false,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()'
);

CREATE TABLE "kill_logs" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "game_session_id" uuid,
  "killer_id" uuid NOT NULL,
  "victim_id" uuid NOT NULL,
  "transaction_id" uuid,
  "room_type" room_type NOT NULL,
  "amount_earned" numeric(18,6) NOT NULL DEFAULT 0,
  "occurred_at" timestamptz DEFAULT 'now()',
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()'
);

CREATE TABLE "game_tickets" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "user_id" uuid NOT NULL,
  "room_type" room_type NOT NULL,
  "ticket_code" varchar(64) UNIQUE NOT NULL,
  "status" ticket_status NOT NULL DEFAULT 'issued',
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "metadata" jsonb,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()'
);

CREATE TABLE "admin_configs" (
  "id" uuid PRIMARY KEY DEFAULT 'gen_random_uuid()',
  "key" varchar(64) UNIQUE NOT NULL,
  "value" text,
  "data" jsonb,
  "created_at" timestamptz DEFAULT 'now()',
  "updated_at" timestamptz DEFAULT 'now()',
  "deleted_at" timestamptz
);

COMMENT ON COLUMN "users"."wallet_address" IS 'Solana wallet address';

COMMENT ON COLUMN "user_sessions"."jwt_id" IS 'jti claim for revocation';

COMMENT ON COLUMN "wallet_balances"."locked_amount" IS 'Funds reserved for pending withdraws';

ALTER TABLE "user_sessions" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "wallet_balances" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "wallet_balances" ADD FOREIGN KEY ("last_transaction_id") REFERENCES "transactions" ("id");

ALTER TABLE "transactions" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "transactions" ADD FOREIGN KEY ("webhook_event_id") REFERENCES "webhook_events" ("id");

ALTER TABLE "webhook_events" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "game_session_players" ADD FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id");

ALTER TABLE "game_session_players" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "game_session_players" ADD FOREIGN KEY ("ticket_id") REFERENCES "game_tickets" ("id");

ALTER TABLE "kill_logs" ADD FOREIGN KEY ("game_session_id") REFERENCES "game_sessions" ("id");

ALTER TABLE "kill_logs" ADD FOREIGN KEY ("killer_id") REFERENCES "users" ("id");

ALTER TABLE "kill_logs" ADD FOREIGN KEY ("victim_id") REFERENCES "users" ("id");

ALTER TABLE "kill_logs" ADD FOREIGN KEY ("transaction_id") REFERENCES "transactions" ("id");

ALTER TABLE "game_tickets" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");
