import { sdkFeedRequestSchema, sdkFeedResponseSchema } from './feed.ts';

export const sampleSdkFeedRequest = sdkFeedRequestSchema.parse({
  client_id: 'public-client-id',
  placement_key: 'home_top_story_bar',
  platform: 'android',
  app_version: '8.1.0',
  user_segments: ['beta', 'vip'],
});

export const sampleSdkFeedResponse = sdkFeedResponseSchema.parse({
  client_id: 'public-client-id',
  placement_key: 'home_top_story_bar',
  context: {
    platform: 'android',
    app_version: '8.1.0',
    user_segments: ['beta', 'vip'],
  },
  resolved_set: {
    id: '11111111-1111-4111-8111-111111111111',
    revision_id: '21111111-1111-4111-8111-111111111111',
    placement_key: 'home_top_story_bar',
    is_fallback: false,
    groups: [
      {
        id: '31111111-1111-4111-8111-111111111111',
        revision_id: '41111111-1111-4111-8111-111111111111',
        title: 'Spring Launch',
        logo_url: 'https://cdn.openstory.dev/groups/spring-launch-logo.png',
        badge: {
          type: 'svg',
          value: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" /></svg>',
        },
        stories: [
          {
            id: '51111111-1111-4111-8111-111111111111',
            revision_id: '61111111-1111-4111-8111-111111111111',
            title: 'Hero Image',
            media_type: 'image',
            image_duration_ms: 5000,
            asset: {
              id: '71111111-1111-4111-8111-111111111111',
              url: 'https://cdn.openstory.dev/stories/spring-launch.jpg',
              mime_type: 'image/jpeg',
              width: 1080,
              height: 1920,
            },
            cta: {
              label: 'Open campaign',
              type: 'deeplink',
              value: 'app://campaign/spring-launch',
            },
          },
          {
            id: '81111111-1111-4111-8111-111111111111',
            revision_id: '91111111-1111-4111-8111-111111111111',
            title: 'Launch Video',
            media_type: 'video',
            asset: {
              id: 'a1111111-1111-4111-8111-111111111111',
              url: 'https://cdn.openstory.dev/stories/spring-launch.mp4',
              mime_type: 'video/mp4',
              width: 1080,
              height: 1920,
              duration_ms: 17800,
            },
            poster_asset: {
              id: 'b1111111-1111-4111-8111-111111111111',
              url: 'https://cdn.openstory.dev/stories/spring-launch-poster.jpg',
              mime_type: 'image/jpeg',
              width: 1080,
              height: 1920,
            },
            cta: null,
          },
        ],
      },
      {
        id: 'c1111111-1111-4111-8111-111111111111',
        revision_id: 'd1111111-1111-4111-8111-111111111111',
        title: 'Editors Picks',
        logo_url: 'https://cdn.openstory.dev/groups/editors-picks-logo.png',
        badge: null,
        stories: [
          {
            id: 'e1111111-1111-4111-8111-111111111111',
            revision_id: 'f1111111-1111-4111-8111-111111111111',
            title: 'Editors Image',
            media_type: 'image',
            image_duration_ms: 6000,
            asset: {
              id: '12111111-1111-4111-8111-111111111111',
              url: 'https://cdn.openstory.dev/stories/editors-picks.jpg',
              mime_type: 'image/jpeg',
              width: 1080,
              height: 1920,
            },
            cta: {
              label: 'Read more',
              type: 'url',
              value: 'https://www.openstory.dev/editorial',
            },
          },
        ],
      },
    ],
  },
  generated_at: '2026-04-05T09:00:00.000Z',
});
