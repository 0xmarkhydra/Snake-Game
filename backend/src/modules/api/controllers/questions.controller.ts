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

@ApiTags('Questions')
@Controller('questions')
export class QuestionsController {
  private readonly webhookSecret?: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookSecret = this.configService.get<string>('question.webhookSecret');
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive question data webhook' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: QuestionWebhookResponseDto,
    description: 'Question webhook processed successfully',
  })
  @ResponseMessage('Question webhook processed successfully')
  async handleQuestionWebhook(
    @Body() payload: QuestionWebhookDto,
    @Headers('x-webhook-secret') secret?: string,
  ): Promise<QuestionWebhookResponseDto> {
    // Validate webhook secret if configured
    if (this.webhookSecret && secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    // Log the received question data (full payload for flexibility)
    console.log('Received question webhook:', {
      ...payload,
      secret: secret ? '***' : undefined,
    });

    // TODO: Add your business logic here to process the question data
    // For example:
    // - Save to database
    // - Process question data
    // - Send notifications, etc.

    return {
      processed: true,
      message: 'Question received and processed successfully',
    };
  }
}

