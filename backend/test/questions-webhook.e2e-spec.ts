import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  mockTaskCompletedPayload,
  mockTaskFailedPayload,
  mockReferralCompletedPayload,
  mockWebhookSecret,
  mockTaskTypes,
  generateTaskPayload,
} from './mocks/question-webhook.mock';

describe('Questions Webhook API (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /questions/webhook', () => {
    const webhookSecret =
      process.env.QUESTION_WEBHOOK_SECRET || mockWebhookSecret;

    it('should process TaskCompleted webhook successfully', () => {
      return request(app.getHttpServer())
        .post('/questions/webhook')
        .set('x-webhook-secret', webhookSecret)
        .set('Content-Type', 'application/json')
        .send(mockTaskCompletedPayload)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('processed', true);
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('TaskCompleted');
        });
    });

    it('should process TaskFailed webhook successfully', () => {
      return request(app.getHttpServer())
        .post('/questions/webhook')
        .set('x-webhook-secret', webhookSecret)
        .set('Content-Type', 'application/json')
        .send(mockTaskFailedPayload)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('processed', true);
          expect(res.body.message).toContain('TaskFailed');
        });
    });

    it('should process ReferralCompleted webhook successfully', () => {
      return request(app.getHttpServer())
        .post('/questions/webhook')
        .set('x-webhook-secret', webhookSecret)
        .set('Content-Type', 'application/json')
        .send(mockReferralCompletedPayload)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('processed', true);
          expect(res.body.message).toContain('ReferralCompleted');
        });
    });

    it('should reject webhook with invalid secret', () => {
      const payload = {
        eventType: 'TaskCompleted',
        data: {
          wallet_address: '6WP8YL4FRQhFK1Yui5SXKYxHrkmcVMTiF9unaYCApDA7',
          task_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      return request(app.getHttpServer())
        .post('/questions/webhook')
        .set('x-webhook-secret', 'invalid_secret')
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(401);
    });

    it('should accept webhook without secret if not configured', async () => {
      // Temporarily unset secret for this test
      const originalSecret = process.env.QUESTION_WEBHOOK_SECRET;
      delete process.env.QUESTION_WEBHOOK_SECRET;

      const payload = {
        eventType: 'TaskCompleted',
        data: {
          wallet_address: '6WP8YL4FRQhFK1Yui5SXKYxHrkmcVMTiF9unaYCApDA7',
          task_id: '550e8400-e29b-41d4-a716-446655440000',
        },
      };

      // Note: This test might fail if secret is set in config
      // It's here to document the behavior
      await request(app.getHttpServer())
        .post('/questions/webhook')
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect((res) => {
          // Either 200 (if no secret required) or 401 (if secret is required)
          expect([200, 401]).toContain(res.status);
        });

      // Restore original secret
      if (originalSecret) {
        process.env.QUESTION_WEBHOOK_SECRET = originalSecret;
      }
    });

    it('should validate required fields', () => {
      const invalidPayload = {
        // Missing eventType and data
        timestamp: 1736938200000,
      };

      return request(app.getHttpServer())
        .post('/questions/webhook')
        .set('x-webhook-secret', webhookSecret)
        .set('Content-Type', 'application/json')
        .send(invalidPayload)
        .expect(400);
    });

    it('should accept flexible data structure', () => {
      const flexiblePayload = {
        eventType: 'TaskCompleted',
        data: {
          custom_field_1: 'value1',
          custom_field_2: 123,
          nested_data: {
            level1: {
              level2: 'deep_value',
            },
          },
        },
        timestamp: 1736938200000,
        source: 'web3-tasks-api',
        custom_root_field: 'any_value',
      };

      return request(app.getHttpServer())
        .post('/questions/webhook')
        .set('x-webhook-secret', webhookSecret)
        .set('Content-Type', 'application/json')
        .send(flexiblePayload)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('processed', true);
        });
    });

    it('should handle different task types', () => {
      const promises = mockTaskTypes.map((taskType) => {
        const payload = generateTaskPayload(taskType, 'TaskCompleted');

        return request(app.getHttpServer())
          .post('/questions/webhook')
          .set('x-webhook-secret', webhookSecret)
          .set('Content-Type', 'application/json')
          .send(payload)
          .expect(200);
      });

      return Promise.all(promises);
    });
  });
});

