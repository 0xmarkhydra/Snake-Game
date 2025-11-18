import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import {
  QuestionWebhookDto,
  QuestionWebhookResponseDto,
} from '@/api/dtos';
import { ResponseMessage } from '@/shared/decorators/response-message.decorator';
import { QuestionWebhookLogRepository } from '@/database/repositories';
import {
  WebhookEventType,
  WebhookProcessingStatus,
} from '@/database/entities';

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  private readonly webhookSecret?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly questionWebhookLogRepository: QuestionWebhookLogRepository,
  ) {
    this.webhookSecret = this.configService.get<string>('question.webhookSecret');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive task webhook from web3-tasks-api',
    description:
      'Receives webhooks for TaskCompleted, TaskFailed, and ReferralCompleted events',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: QuestionWebhookResponseDto,
    description: 'Webhook processed successfully',
  })
  @ResponseMessage('Webhook processed successfully')
  async handleQuestionWebhook(
    @Body() payload: QuestionWebhookDto,
    @Headers('x-webhook-secret') secret?: string,
  ): Promise<QuestionWebhookResponseDto> {
    // Validate webhook secret if configured
    if (this.webhookSecret && secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    const { eventType, data, timestamp, source } = payload;
    const walletAddress = data?.wallet_address || data?.referrer_wallet_address;
    const taskId = data?.task_id;

    // Create webhook log entry
    const webhookLog = this.questionWebhookLogRepository.create({
      eventType: eventType as WebhookEventType,
      taskId: taskId || undefined,
      walletAddress: walletAddress || undefined,
      taskType: data?.task_type || undefined,
      source: source || undefined,
      webhookTimestamp: timestamp || undefined,
      payload: payload as Record<string, any>,
      processingStatus: WebhookProcessingStatus.PENDING,
      metadata: {
        hasSecret: !!secret,
        receivedAt: new Date().toISOString(),
      },
    });

    try {
      // Save webhook log to database
      await this.questionWebhookLogRepository.save(webhookLog);

      // Structured logging
      console.log('Received task webhook:', {
        logId: webhookLog.id,
        eventType,
        taskId,
        walletAddress,
        taskType: data?.task_type,
        timestamp,
        source,
      });

      // Route to appropriate handler based on event type
      let processingError: string | undefined;
      try {
        switch (eventType) {
          case 'TaskCompleted':
            await this.handleTaskCompleted(data);
            break;
          case 'TaskFailed':
            await this.handleTaskFailed(data);
            break;
          case 'ReferralCompleted':
            await this.handleReferralCompleted(data);
            break;
          default:
            console.warn(`Unknown event type: ${eventType}`);
        }

        // Update log status to processed
        webhookLog.processingStatus = WebhookProcessingStatus.PROCESSED;
        webhookLog.processedAt = new Date();
      } catch (error) {
        processingError = error instanceof Error ? error.message : String(error);
        webhookLog.processingStatus = WebhookProcessingStatus.FAILED;
        webhookLog.errorMessage = processingError;
        throw error;
      } finally {
        // Update log status
        await this.questionWebhookLogRepository.save(webhookLog);
      }

      return {
        processed: true,
        message: `Webhook ${eventType} processed successfully`,
      };
    } catch (error) {
      // Update log with error if not already updated
      if (webhookLog.processingStatus === WebhookProcessingStatus.PENDING) {
        webhookLog.processingStatus = WebhookProcessingStatus.FAILED;
        webhookLog.errorMessage =
          error instanceof Error ? error.message : String(error);
        await this.questionWebhookLogRepository.save(webhookLog);
      }
      throw error;
    }
  }

  private async handleTaskCompleted(data: Record<string, any>): Promise<void> {
    // TODO: Implement TaskCompleted logic
    // - Verify task completion
    // - Award rewards/credits to user
    // - Update user progress
    // - Send notifications
    console.log('Processing TaskCompleted:', {
      walletAddress: data.wallet_address,
      taskId: data.task_id,
      taskType: data.task_type,
      verified: data.verify_result?.verified,
    });
  }

  private async handleTaskFailed(data: Record<string, any>): Promise<void> {
    // TODO: Implement TaskFailed logic
    // - Log failure reason
    // - Update task status
    // - Notify user if needed
    console.log('Processing TaskFailed:', {
      walletAddress: data.wallet_address,
      taskId: data.task_id,
      taskType: data.task_type,
      error: data.verify_result?.error,
    });
  }

  private async handleReferralCompleted(
    data: Record<string, any>,
  ): Promise<void> {
    // TODO: Implement ReferralCompleted logic
    // - Award referral rewards
    // - Update referral stats
    // - Notify referrer
    console.log('Processing ReferralCompleted:', {
      referrerWallet: data.referrer_wallet_address,
      refereeWallet: data.referee_wallet_address,
      referralCode: data.referral_code,
      totalCompleted: data.referral_stats?.total_completed,
    });
  }
}

