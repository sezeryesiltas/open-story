import { describe, expect, it } from 'vitest';
import {
  enforceNoTargetingConflict,
  enforceSinglePublishedFallback,
  PublishConflictError,
  requireGroupRepublishForCompositionChange,
  requireSetRepublishForCompositionOrConfigChange,
  validateStoryGroupCountRange,
} from './publish-guards';

describe('publish guards', () => {
  it('validates min/max story group count', () => {
    expect(() => validateStoryGroupCountRange(1, 3)).not.toThrow();
    expect(() => validateStoryGroupCountRange(4, 2)).toThrow(PublishConflictError);
  });

  it('enforces single published fallback per placement', () => {
    expect(() =>
      enforceSinglePublishedFallback('placement-home', [
        {
          id: 'set-1',
          placementId: 'placement-home',
          isFallback: true,
          targeting: { platformTargets: [], userSegments: [] },
        },
      ]),
    ).toThrow(PublishConflictError);
  });

  it('blocks ambiguous targeting overlaps', () => {
    expect(() =>
      enforceNoTargetingConflict(
        'placement-home',
        {
          id: 'incoming',
          placementId: 'placement-home',
          isFallback: false,
          targeting: {
            platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
            userSegments: ['vip', 'beta'],
          },
        },
        [
          {
            id: 'live',
            placementId: 'placement-home',
            isFallback: false,
            targeting: {
              platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
              userSegments: ['vip', 'promo'],
            },
          },
        ],
      ),
    ).toThrow(PublishConflictError);
  });

  it('requires group republish when composition changed', () => {
    expect(() =>
      requireGroupRepublishForCompositionChange(
        { storyIds: ['story-1', 'story-2'] },
        { storyIds: ['story-2', 'story-1'] },
      ),
    ).toThrow(PublishConflictError);
  });

  it('requires set republish when config changed', () => {
    expect(() =>
      requireSetRepublishForCompositionOrConfigChange(
        {
          storyGroupIds: ['group-1'],
          platformTargets: [{ platform: 'ios', minAppVersion: '5.1.0' }],
          userSegments: ['vip'],
          isFallback: false,
        },
        {
          storyGroupIds: ['group-1'],
          platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
          userSegments: ['vip'],
          isFallback: false,
        },
      ),
    ).toThrow(PublishConflictError);
  });
});
