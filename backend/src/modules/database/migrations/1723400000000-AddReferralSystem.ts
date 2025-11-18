import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralSystem1723400000000 implements MigrationInterface {
  name = 'AddReferralSystem1723400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add columns to users table
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN "referral_code" VARCHAR(16) UNIQUE,
      ADD COLUMN "referred_by_id" UUID REFERENCES "users"("id"),
      ADD COLUMN "referred_at" TIMESTAMPTZ;
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_referral_code" ON "users"("referral_code");
      CREATE INDEX "IDX_users_referred_by_id" ON "users"("referred_by_id");
    `);

    // Create referral_rewards table
    await queryRunner.query(`
      CREATE TYPE "referral_reward_type" AS ENUM (
        'game_commission'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "referral_reward_status" AS ENUM (
        'pending',
        'confirmed',
        'failed'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "referral_rewards" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "referrer_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "referee_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "reward_type" "referral_reward_type" NOT NULL,
        "amount" NUMERIC(18,6) NOT NULL,
        "transaction_id" UUID REFERENCES "transactions"("id"),
        "status" "referral_reward_status" DEFAULT 'pending',
        "metadata" JSONB,
        "created_at" TIMESTAMPTZ DEFAULT now(),
        "updated_at" TIMESTAMPTZ DEFAULT now(),
        "deleted_at" TIMESTAMPTZ
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_referral_rewards_referrer_id" ON "referral_rewards"("referrer_id");
      CREATE INDEX "IDX_referral_rewards_referee_id" ON "referral_rewards"("referee_id");
      CREATE INDEX "IDX_referral_rewards_transaction_id" ON "referral_rewards"("transaction_id");
      CREATE INDEX "IDX_referral_rewards_status" ON "referral_rewards"("status");
    `);

    // Generate referral codes for existing users
    await queryRunner.query(`
      UPDATE "users" 
      SET "referral_code" = UPPER(SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT) FROM 1 FOR 8))
      WHERE "referral_code" IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "referral_rewards";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "referral_reward_status";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "referral_reward_type";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_referred_by_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_referral_code";`);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referred_at";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referred_by_id";`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "referral_code";`);
  }
}

