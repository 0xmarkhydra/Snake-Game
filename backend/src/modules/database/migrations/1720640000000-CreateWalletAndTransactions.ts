import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWalletAndTransactions1720640000000
  implements MigrationInterface
{
  name = 'CreateWalletAndTransactions1720640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(
      "CREATE TYPE \"public\".\"transactions_type_enum\" AS ENUM('deposit', 'withdraw', 'reward', 'penalty', 'system_adjust')",
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"transactions_status_enum\" AS ENUM('pending', 'confirmed', 'failed', 'reversed')",
    );

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "user_id" uuid NOT NULL,
        "type" "public"."transactions_type_enum" NOT NULL,
        "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'pending',
        "amount" numeric(18,6) NOT NULL,
        "fee_amount" numeric(18,6) NOT NULL DEFAULT 0,
        "signature" character varying,
        "reference_code" character varying,
        "metadata" jsonb,
        "webhook_event_id" uuid,
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_transactions_signature" UNIQUE ("signature"),
        CONSTRAINT "UQ_transactions_reference_code" UNIQUE ("reference_code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "wallet_balances" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "user_id" uuid NOT NULL,
        "available_amount" numeric(18,6) NOT NULL DEFAULT 0,
        "locked_amount" numeric(18,6) NOT NULL DEFAULT 0,
        "last_transaction_id" uuid,
        CONSTRAINT "PK_wallet_balances_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_wallet_balances_user_id" UNIQUE ("user_id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "IDX_transactions_user_id" ON "transactions" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_transactions_webhook_event_id" ON "transactions" ("webhook_event_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_wallet_balances_user_id" ON "wallet_balances" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_wallet_balances_last_transaction_id" ON "wallet_balances" ("last_transaction_id")',
    );

    await queryRunner.query(`
      ALTER TABLE "transactions"
      ADD CONSTRAINT "FK_transactions_user_id" FOREIGN KEY ("user_id")
      REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "wallet_balances"
      ADD CONSTRAINT "FK_wallet_balances_user_id" FOREIGN KEY ("user_id")
      REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "wallet_balances" DROP CONSTRAINT "FK_wallet_balances_user_id"',
    );
    await queryRunner.query(
      'ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_user_id"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_wallet_balances_last_transaction_id"',
    );
    await queryRunner.query('DROP INDEX "IDX_wallet_balances_user_id"');
    await queryRunner.query('DROP INDEX "IDX_transactions_webhook_event_id"');
    await queryRunner.query('DROP INDEX "IDX_transactions_user_id"');
    await queryRunner.query('DROP TABLE "wallet_balances"');
    await queryRunner.query('DROP TABLE "transactions"');
    await queryRunner.query('DROP TYPE "public"."transactions_status_enum"');
    await queryRunner.query('DROP TYPE "public"."transactions_type_enum"');
  }
}
