import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVipGameTables1721100000000 implements MigrationInterface {
  name = 'CreateVipGameTables1721100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(
      "CREATE TYPE \"public\".\"vip_ticket_status_enum\" AS ENUM('issued', 'consumed', 'cancelled', 'expired')",
    );
    await queryRunner.query(
      'CREATE TYPE "public"."vip_room_type_enum" AS ENUM(\'snake_game_vip\')',
    );

    await queryRunner.query(
      'ALTER TABLE "transactions" ADD "reference_id" uuid',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_transactions_reference_id" ON "transactions" ("reference_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "vip_room_config" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "room_type" "public"."vip_room_type_enum" NOT NULL DEFAULT 'snake_game_vip',
        "entry_fee" numeric(18,6) NOT NULL DEFAULT 0,
        "reward_rate_player" numeric(18,6) NOT NULL DEFAULT 0.9,
        "reward_rate_treasury" numeric(18,6) NOT NULL DEFAULT 0.1,
        "respawn_cost" numeric(18,6) NOT NULL DEFAULT 0,
        "max_clients" integer NOT NULL DEFAULT 20,
        "tick_rate" integer NOT NULL DEFAULT 60,
        "is_active" boolean NOT NULL DEFAULT true,
        "metadata" jsonb,
        CONSTRAINT "PK_vip_room_config_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vip_room_config_room_type" UNIQUE ("room_type")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "vip_tickets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "user_id" uuid NOT NULL,
        "ticket_code" character varying(64) NOT NULL,
        "room_type" "public"."vip_room_type_enum" NOT NULL DEFAULT 'snake_game_vip',
        "entry_fee" numeric(18,6) NOT NULL DEFAULT 0,
        "room_instance_id" character varying(64),
        "status" "public"."vip_ticket_status_enum" NOT NULL DEFAULT 'issued',
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "consumed_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        CONSTRAINT "PK_vip_tickets_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vip_tickets_ticket_code" UNIQUE ("ticket_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "kill_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "room_instance_id" character varying(64) NOT NULL,
        "room_type" "public"."vip_room_type_enum" NOT NULL DEFAULT 'snake_game_vip',
        "killer_user_id" uuid,
        "victim_user_id" uuid,
        "killer_ticket_id" uuid,
        "victim_ticket_id" uuid,
        "reward_amount" numeric(18,6) NOT NULL DEFAULT 0,
        "fee_amount" numeric(18,6) NOT NULL DEFAULT 0,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "metadata" jsonb,
        "kill_reference" character varying(64) NOT NULL,
        CONSTRAINT "PK_kill_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_kill_logs_kill_reference" UNIQUE ("kill_reference")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_vip_tickets_user_id" ON "vip_tickets" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_vip_tickets_room_instance_id" ON "vip_tickets" ("room_instance_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_vip_tickets_status" ON "vip_tickets" ("status")',
    );

    await queryRunner.query(
      'CREATE INDEX "IDX_kill_logs_room_instance_id" ON "kill_logs" ("room_instance_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_kill_logs_killer_user_id" ON "kill_logs" ("killer_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_kill_logs_victim_user_id" ON "kill_logs" ("victim_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_kill_logs_killer_ticket_id" ON "kill_logs" ("killer_ticket_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_kill_logs_victim_ticket_id" ON "kill_logs" ("victim_ticket_id")',
    );

    await queryRunner.query(`
      ALTER TABLE "vip_tickets"
      ADD CONSTRAINT "FK_vip_tickets_user_id" FOREIGN KEY ("user_id")
      REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "kill_logs"
      ADD CONSTRAINT "FK_kill_logs_killer_user_id" FOREIGN KEY ("killer_user_id")
      REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "kill_logs"
      ADD CONSTRAINT "FK_kill_logs_victim_user_id" FOREIGN KEY ("victim_user_id")
      REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "kill_logs"
      ADD CONSTRAINT "FK_kill_logs_killer_ticket_id" FOREIGN KEY ("killer_ticket_id")
      REFERENCES "vip_tickets" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "kill_logs"
      ADD CONSTRAINT "FK_kill_logs_victim_ticket_id" FOREIGN KEY ("victim_ticket_id")
      REFERENCES "vip_tickets" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "kill_logs" DROP CONSTRAINT "FK_kill_logs_victim_ticket_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "kill_logs" DROP CONSTRAINT "FK_kill_logs_killer_ticket_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "kill_logs" DROP CONSTRAINT "FK_kill_logs_victim_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "kill_logs" DROP CONSTRAINT "FK_kill_logs_killer_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "vip_tickets" DROP CONSTRAINT "FK_vip_tickets_user_id"
    `);

    await queryRunner.query('DROP INDEX "IDX_kill_logs_victim_ticket_id"');
    await queryRunner.query('DROP INDEX "IDX_kill_logs_killer_ticket_id"');
    await queryRunner.query('DROP INDEX "IDX_kill_logs_victim_user_id"');
    await queryRunner.query('DROP INDEX "IDX_kill_logs_killer_user_id"');
    await queryRunner.query('DROP INDEX "IDX_kill_logs_room_instance_id"');

    await queryRunner.query('DROP INDEX "IDX_vip_tickets_status"');
    await queryRunner.query('DROP INDEX "IDX_vip_tickets_room_instance_id"');
    await queryRunner.query('DROP INDEX "IDX_vip_tickets_user_id"');

    await queryRunner.query('DROP TABLE "kill_logs"');
    await queryRunner.query('DROP TABLE "vip_tickets"');
    await queryRunner.query('DROP TABLE "vip_room_config"');

    await queryRunner.query('DROP INDEX "IDX_transactions_reference_id"');
    await queryRunner.query(
      'ALTER TABLE "transactions" DROP COLUMN "reference_id"',
    );

    await queryRunner.query('DROP TYPE "public"."vip_room_type_enum"');
    await queryRunner.query('DROP TYPE "public"."vip_ticket_status_enum"');
  }
}
