import test from 'node:test';
import assert from 'node:assert/strict';

import {
  sampleSdkFeedRequest,
  sampleSdkFeedResponse,
  sdkFeedRequestSchema,
  sdkFeedResponseSchema,
} from '../index.ts';

test('sample SDK fixtures stay aligned with request and response schemas', () => {
  const request = sdkFeedRequestSchema.parse(sampleSdkFeedRequest);
  const response = sdkFeedResponseSchema.parse(sampleSdkFeedResponse);

  assert.equal(request.platform, 'android');
  assert.equal(response.resolved_set?.groups.length, 2);
  assert.equal(response.resolved_set?.groups[0]?.stories[1]?.media_type, 'video');
});
