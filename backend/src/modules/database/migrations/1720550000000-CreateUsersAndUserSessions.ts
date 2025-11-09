import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndUserSessions1720550000000 implements MigrationInterface {
  name = 'CreateUsersAndUserSessions1720550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "wallet_address" character varying(64) NOT NULL,
        "display_name" character varying(64),
        "avatar_url" text,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_wallet_address" UNIQUE ("wallet_address")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "jwt_id" uuid NOT NULL,
        "refresh_token" text,
        "user_agent" text,
        "ip_address" character varying(64),
        "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "revoked_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_user_sessions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_user_sessions_user_id" ON "user_sessions" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_sessions_jwt_id" ON "user_sessions" ("jwt_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_user_sessions_refresh_token" ON "user_sessions" ("refresh_token")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_users_wallet_address" ON "users" ("wallet_address")',
    );

    await queryRunner.query(`
      ALTER TABLE "user_sessions"
      ADD CONSTRAINT "FK_user_sessions_user_id" FOREIGN KEY ("user_id")
      REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_user_sessions_user_id"',
    );
    await queryRunner.query('DROP INDEX "IDX_users_wallet_address"');
    await queryRunner.query('DROP INDEX "IDX_user_sessions_jwt_id"');
    await queryRunner.query('DROP INDEX "IDX_user_sessions_user_id"');
    await queryRunner.query('DROP INDEX "IDX_user_sessions_refresh_token"');
    await queryRunner.query('DROP TABLE "user_sessions"');
    await queryRunner.query('DROP TABLE "users"');
  }
}
