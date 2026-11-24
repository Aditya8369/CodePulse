import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import {
  CreateWebhookSubscriptionDto,
  DispatchWebhookDto,
  UpdateWebhookSubscriptionDto,
} from './dto/webhook.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookDispatcherService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new webhook subscription' })
  @ApiResponse({ status: 201, description: 'Webhook subscription created' })
  async createWebhook(@Body() dto: CreateWebhookSubscriptionDto) {
    return this.webhookService.createSubscription(undefined, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all registered webhook subscriptions' })
  async listWebhooks() {
    return this.webhookService.listSubscriptions();
  }

  @Post(':id/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test webhook event to verify endpoint connectivity' })
  async testEndpoint(@Param('id') id: string) {
    return this.webhookService.testEndpoint(id);
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Register a new webhook subscription (alias)' })
  @ApiResponse({ status: 201, description: 'Webhook subscription created' })
  async createSubscription(@Body() dto: CreateWebhookSubscriptionDto) {
    return this.webhookService.createSubscription(undefined, dto);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'List all registered webhook subscriptions (alias)' })
  async listSubscriptions() {
    return this.webhookService.listSubscriptions();
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get details and delivery history for a webhook subscription' })
  async getSubscription(@Param('id') id: string) {
    return this.webhookService.getSubscription(id);
  }

  @Patch('subscriptions/:id')
  @ApiOperation({ summary: 'Update webhook subscription details or status' })
  async updateSubscription(
    @Param('id') id: string,
    @Body() dto: UpdateWebhookSubscriptionDto,
  ) {
    return this.webhookService.updateSubscription(id, dto);
  }

  @Delete('subscriptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  async deleteSubscription(@Param('id') id: string) {
    await this.webhookService.deleteSubscription(id);
  }

  @Post('dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a platform event dispatch to subscribed webhooks' })
  async dispatchEvent(@Body() dto: DispatchWebhookDto) {
    return this.webhookService.dispatchEvent(dto);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get developer webhook delivery logs for dashboard telemetry' })
  async getDeliveryLogs(
    @Query('subscriptionId') subscriptionId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.webhookService.getDeliveryLogs(subscriptionId, limit ? Number(limit) : 50);
  }

  @Get('dlq')
  @ApiOperation({ summary: 'Inspect Dead-Letter Queue (DLQ) exhausted deliveries' })
  async getDeadLetterQueue() {
    return this.webhookService.getDeadLetterQueue();
  }

  @Post('deliveries/:id/redeliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'One-click manual replay / redelivery of a failed or DLQ webhook delivery' })
  async redeliverWebhook(@Param('id') id: string) {
    return this.webhookService.redeliverWebhook(id);
  }
}
