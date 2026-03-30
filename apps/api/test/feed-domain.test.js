const test = require('node:test');
const assert = require('node:assert/strict');

const {
  authorizeFeedRequest,
  buildLiveSnapshot,
  compareVersions,
  publishGroup,
  publishSet,
  publishStory,
  resolveFeed,
  resolveSet,
  validatePublishCandidate,
} = require('../src/domain/feed');

function createSet(overrides = {}) {
  return {
    id: overrides.id || 'set-default',
    isFallback: false,
    platformTargets: [{ platform: 'ios', minAppVersion: '1.0.0' }],
    segments: [],
    groups: [],
    ...overrides,
  };
}

test('targeting resolution: platform breadth, min version and segment priority are applied', () => {
  const sets = [
    createSet({
      id: 'all-platform-default',
      platformTargets: [
        { platform: 'ios', minAppVersion: '1.0.0' },
        { platform: 'android', minAppVersion: '1.0.0' },
      ],
      segments: [],
    }),
    createSet({
      id: 'ios-vip',
      platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
      segments: ['vip', 'beta'],
    }),
    createSet({
      id: 'ios-default-high-min',
      platformTargets: [{ platform: 'ios', minAppVersion: '6.0.0' }],
      segments: [],
    }),
  ];

  const resolved = resolveSet(sets, {
    platform: 'ios',
    appVersion: '6.1.0',
    userSegments: ['vip'],
  });

  assert.equal(resolved.id, 'ios-vip');
});

test('targeting resolution: fallback is used when no normal set matches', () => {
  const sets = [
    createSet({
      id: 'ios-only',
      platformTargets: [{ platform: 'ios', minAppVersion: '5.2.0' }],
      segments: ['vip'],
    }),
    createSet({
      id: 'fallback',
      isFallback: true,
      platformTargets: [],
      segments: [],
    }),
  ];

  const resolved = resolveSet(sets, {
    platform: 'android',
    appVersion: '9.0.0',
    userSegments: ['vip'],
  });

  assert.equal(resolved.id, 'fallback');
});

test('publish validation: catches ambiguity across overlapping platform/version/segment rules', () => {
  const existing = [
    createSet({
      id: 'existing-ios-vip',
      platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0', maxAppVersion: '9.0.0' }],
      segments: ['vip'],
    }),
  ];

  const candidate = createSet({
    id: 'candidate',
    platformTargets: [{ platform: 'ios', minAppVersion: '7.0.0', maxAppVersion: '10.0.0' }],
    segments: ['vip'],
  });

  const errors = validatePublishCandidate(existing, candidate);

  assert.deepEqual(errors.sort(), [
    'AMBIGUOUS_WITH_existing-ios-vip',
  ]);
});

test('publish validation: catches invalid min-max version range', () => {
  const errors = validatePublishCandidate([], createSet({
    id: 'invalid-range',
    platformTargets: [{ platform: 'ios', minAppVersion: '10.0.0', maxAppVersion: '9.0.0' }],
  }));

  assert.deepEqual(errors, ['INVALID_MIN_MAX_FOR_IOS']);
});

test('publish validation: enforces fallback uniqueness and fallback targeting constraints', () => {
  const existing = [
    createSet({
      id: 'existing-fallback',
      isFallback: true,
      platformTargets: [],
      segments: [],
    }),
  ];

  const candidate = createSet({
    id: 'candidate-fallback',
    isFallback: true,
    platformTargets: [{ platform: 'ios', minAppVersion: '1.0.0' }],
    segments: ['vip'],
  });

  const errors = validatePublishCandidate(existing, candidate);

  assert.deepEqual(errors.sort(), [
    'FALLBACK_SET_CANNOT_HAVE_TARGETING',
    'FALLBACK_SET_MUST_BE_UNIQUE',
  ]);
});

test('child filtering: unpublished and archived children are removed, empty primary falls back', () => {
  const primary = createSet({
    id: 'primary',
    platformTargets: [{ platform: 'ios', minAppVersion: '1.0.0' }],
    groups: [
      {
        id: 'group-a',
        isPublished: true,
        isArchived: false,
        stories: [
          { id: 'story-1', isPublished: false, isArchived: false },
          { id: 'story-2', isPublished: true, isArchived: true },
        ],
      },
    ],
  });

  const fallback = createSet({
    id: 'fallback',
    isFallback: true,
    platformTargets: [],
    groups: [
      {
        id: 'group-fallback',
        isPublished: true,
        isArchived: false,
        stories: [{ id: 'story-f1', isPublished: true, isArchived: false }],
      },
    ],
  });

  const feed = resolveFeed([primary, fallback], {
    platform: 'ios',
    appVersion: '1.2.3',
    userSegments: [],
  });

  assert.equal(feed.setId, 'fallback');
  assert.equal(feed.groups.length, 1);
  assert.equal(feed.groups[0].stories.length, 1);
  assert.equal(feed.groups[0].stories[0].id, 'story-f1');
});

test('child filtering: returns empty feed when selected and fallback sets become empty', () => {
  const set = createSet({
    id: 'primary',
    groups: [
      {
        id: 'group-a',
        isPublished: true,
        isArchived: true,
        stories: [{ id: 'story-1', isPublished: true, isArchived: false }],
      },
    ],
  });
  const fallback = createSet({
    id: 'fallback',
    isFallback: true,
    platformTargets: [],
    groups: [
      {
        id: 'fallback-group',
        isPublished: true,
        isArchived: false,
        stories: [{ id: 'story-f', isPublished: false, isArchived: false }],
      },
    ],
  });

  const feed = resolveFeed([set, fallback], {
    platform: 'ios',
    appVersion: '3.0.0',
    userSegments: [],
  });

  assert.deepEqual(feed, { setId: null, groups: [] });
});

test('revision publish behavior: story publish updates live revision without group or set republish', () => {
  const stories = {
    story1: { id: 'story1', draftRevisionId: 's1-r2', publishedRevisionId: 's1-r1' },
  };
  const groups = {
    group1: {
      id: 'group1',
      draftRevisionId: 'g1-r1',
      publishedRevisionId: 'g1-r1',
      draftStoryIds: ['story1'],
      publishedStoryIds: ['story1'],
    },
  };
  const set = {
    id: 'set1',
    draftRevisionId: 'set-r1',
    publishedRevisionId: 'set-r1',
    draftGroupIds: ['group1'],
    publishedGroupIds: ['group1'],
  };

  stories.story1 = publishStory(stories.story1);
  const live = buildLiveSnapshot({ set, groupsById: groups, storiesById: stories });

  assert.equal(live[0].groupRevisionId, 'g1-r1');
  assert.deepEqual(live[0].storyRevisionIds, ['s1-r2']);
});

test('revision publish behavior: group and set composition updates require their own republish', () => {
  const stories = {
    story1: { id: 'story1', draftRevisionId: 's1-r1', publishedRevisionId: 's1-r1' },
    story2: { id: 'story2', draftRevisionId: 's2-r1', publishedRevisionId: 's2-r1' },
  };
  let group = {
    id: 'group1',
    draftRevisionId: 'g1-r2',
    publishedRevisionId: 'g1-r1',
    draftStoryIds: ['story1', 'story2'],
    publishedStoryIds: ['story1'],
  };
  let set = {
    id: 'set1',
    draftRevisionId: 'set-r2',
    publishedRevisionId: 'set-r1',
    draftGroupIds: ['group1', 'group2'],
    publishedGroupIds: ['group1'],
  };

  let live = buildLiveSnapshot({
    set,
    groupsById: { group1: group },
    storiesById: stories,
  });
  assert.deepEqual(live[0].storyIds, ['story1']);

  group = publishGroup(group);
  live = buildLiveSnapshot({
    set,
    groupsById: { group1: group },
    storiesById: stories,
  });
  assert.deepEqual(live[0].storyIds, ['story1', 'story2']);

  set = publishSet(set);
  assert.deepEqual(set.publishedGroupIds, ['group1', 'group2']);
});

test('token auth/revoke: allows only active token that belongs to requested client', () => {
  const client = { id: 'client-public', isActive: true };
  const tokens = [
    { value: 'active-token', clientId: 'client-public', isActive: true },
    { value: 'revoked-token', clientId: 'client-public', isActive: false },
    { value: 'other-client-token', clientId: 'client-other', isActive: true },
  ];

  assert.deepEqual(
    authorizeFeedRequest({ clientId: 'client-public', tokenValue: 'active-token', client, tokens }),
    { allowed: true },
  );

  assert.deepEqual(
    authorizeFeedRequest({ clientId: 'client-public', tokenValue: 'revoked-token', client, tokens }),
    { allowed: false, reason: 'TOKEN_REVOKED' },
  );

  assert.deepEqual(
    authorizeFeedRequest({ clientId: 'client-public', tokenValue: 'other-client-token', client, tokens }),
    { allowed: false, reason: 'TOKEN_CLIENT_MISMATCH' },
  );
});

test('version comparison: dotted numeric rules with missing parts defaulting to zero', () => {
  assert.equal(compareVersions('5.2', '5.2.0'), 0);
  assert.equal(compareVersions('5.2.1', '5.2.0'), 1);
  assert.equal(compareVersions('5.1.9', '5.2.0'), -1);
});
