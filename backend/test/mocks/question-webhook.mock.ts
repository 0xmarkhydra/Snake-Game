/**
 * Mock data for Question Webhook API tests
 */

export const mockTaskCompletedPayload = {
  eventType: 'TaskCompleted',
  data: {
    wallet_address: '6WP8YL4FRQhFK1Yui5SXKYxHrkmcVMTiF9unaYCApDA7',
    task_id: '550e8400-e29b-41d4-a716-446655440000',
    task_title: 'Like our announcement tweet',
    task_type: 'twitter_like',
    completed_at: '2025-01-15T10:30:00.000Z',
    verify_result: {
      verified: true,
      details: {
        tweet_id: '1234567890',
        verified_at: '2025-01-15T10:30:00.000Z',
      },
    },
  },
  timestamp: 1736938200000,
  source: 'web3-tasks-api',
};

export const mockTaskFailedPayload = {
  eventType: 'TaskFailed',
  data: {
    wallet_address: '6WP8YL4FRQhFK1Yui5SXKYxHrkmcVMTiF9unaYCApDA7',
    task_id: '550e8400-e29b-41d4-a716-446655440000',
    task_title: 'Like our announcement tweet',
    task_type: 'twitter_like',
    failed_at: '2025-01-15T10:35:00.000Z',
    verify_result: {
      verified: false,
      error: 'User has not liked the tweet yet',
      details: {
        tweet_id: '1234567890',
        attempted_at: '2025-01-15T10:35:00.000Z',
      },
    },
  },
  timestamp: 1736938500000,
  source: 'web3-tasks-api',
};

export const mockReferralCompletedPayload = {
  eventType: 'ReferralCompleted',
  data: {
    referrer_wallet_address: '6WP8YL4FRQhFK1Yui5SXKYxHrkmcVMTiF9unaYCApDA7',
    referee_wallet_address: '7XQ9ZM5GSRhGLZvj6TYXJYxIsknDWNjF0xvbzZDBqEBE8',
    wallet_address: '6WP8YL4FRQhFK1Yui5SXKYxHrkmcVMTiF9unaYCApDA7',
    task_id: '550e8400-e29b-41d4-a716-446655440001',
    task_title: 'Share your referral link',
    task_type: 'telegram_share_link',
    completed_at: '2025-01-15T11:00:00.000Z',
    referral_code: 'REF123456',
    referral_stats: {
      total_completed: 5,
      min_required: 3,
    },
    verify_result: {
      verified: true,
      details: {
        completedReferrals: 5,
        minReferrals: 3,
      },
    },
  },
  timestamp: 1736940000000,
  source: 'web3-tasks-api',
};

export const mockWebhookSecret = 'lynx_ai_1999';

export const mockTaskTypes = [
  'twitter_like',
  'twitter_follow',
  'twitter_retweet',
  'telegram_join',
  'telegram_comment',
  'telegram_share_link',
];

/**
 * Generate mock payload for a specific event type
 */
export function generateMockPayload(
  eventType: 'TaskCompleted' | 'TaskFailed' | 'ReferralCompleted',
  overrides?: Partial<any>,
) {
  const basePayloads = {
    TaskCompleted: mockTaskCompletedPayload,
    TaskFailed: mockTaskFailedPayload,
    ReferralCompleted: mockReferralCompletedPayload,
  };

  return {
    ...basePayloads[eventType],
    ...overrides,
    data: {
      ...basePayloads[eventType].data,
      ...(overrides?.data || {}),
    },
  };
}

/**
 * Generate mock payload with custom task type
 */
export function generateTaskPayload(
  taskType: string,
  eventType: 'TaskCompleted' | 'TaskFailed' = 'TaskCompleted',
) {
  return generateMockPayload(eventType, {
    data: {
      task_type: taskType,
      task_id: `550e8400-e29b-41d4-a716-44665544000${Math.floor(Math.random() * 10)}`,
    },
  });
}

