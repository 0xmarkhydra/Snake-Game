import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuestionWebhookLogs1737000000000 implements MigrationInterface {
  name = 'CreateQuestionWebhookLogs1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "webhook_event_type_enum" AS ENUM (
        'TaskCompleted',
        'TaskFailed',
        'ReferralCompleted'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "webhook_processing_status_enum" AS ENUM (
        'pending',
        'processed',
        'failed'
      );
    `);

    // Create question_webhook_logs table
    await queryRunner.query(`
      CREATE TABLE "question_webhook_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        "event_type" "webhook_event_type_enum" NOT NULL,
        "task_id" UUID,
        "wallet_address" VARCHAR(64),
        "task_type" VARCHAR(64),
        "processing_status" "webhook_processing_status_enum" NOT NULL DEFAULT 'pending',
        "source" VARCHAR(64),
        "webhook_timestamp" BIGINT,
        "payload" JSONB NOT NULL,
        "metadata" JSONB,
        "error_message" TEXT,
        "processed_at" TIMESTAMPTZ
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_question_webhook_logs_event_type" ON "question_webhook_logs"("event_type");
      CREATE INDEX "IDX_question_webhook_logs_task_id" ON "question_webhook_logs"("task_id");
      CREATE INDEX "IDX_question_webhook_logs_wallet_address" ON "question_webhook_logs"("wallet_address");
      CREATE INDEX "IDX_question_webhook_logs_task_type" ON "question_webhook_logs"("task_type");
      CREATE INDEX "IDX_question_webhook_logs_processing_status" ON "question_webhook_logs"("processing_status");
      CREATE INDEX "IDX_question_webhook_logs_created_at" ON "question_webhook_logs"("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_webhook_logs_created_at";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_webhook_logs_processing_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_webhook_logs_task_type";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_webhook_logs_wallet_address";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_webhook_logs_task_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_question_webhook_logs_event_type";`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "question_webhook_logs";`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "webhook_processing_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "webhook_event_type_enum";`);
  }
}

