const test = require('node:test');
const assert = require('node:assert/strict');

const {
  compareDottedVersion,
  getPublishedPlacementCandidates,
  pickBestMatchingSet,
  resolveSdkFeedSet,
} = require('./resolver');

test('compareDottedVersion compares dotted numeric versions', () => {
  assert.equal(compareDottedVersion('5.2.1', '5.2.0'), 1);
  assert.equal(compareDottedVersion('5.2', '5.2.0'), 0);
  assert.equal(compareDottedVersion('5.1.9', '5.2.0'), -1);
});

test('getPublishedPlacementCandidates returns only placement-bound published sets', () => {
  const result = getPublishedPlacementCandidates(
    [
      { id: 'a', placementKey: 'home', publishedRevisionId: 'r1' },
      { id: 'b', placementKey: 'home', publishedRevisionId: null },
      { id: 'c', placementKey: 'discover', publishedRevisionId: 'r2' },
    ],
    'home',
  );

  assert.deepEqual(result.map((it) => it.id), ['a']);
});

test('pickBestMatchingSet applies priority chain', () => {
  const selected = pickBestMatchingSet(
    [
      {
        id: 'broad-default',
        placementKey: 'home',
        publishedRevisionId: 'r1',
        platformTargets: [
          { platform: 'ios', minAppVersion: '5.0.0' },
          { platform: 'android', minAppVersion: '8.0.0' },
        ],
        segments: [],
      },
      {
        id: 'ios-5-2-vip',
        placementKey: 'home',
        publishedRevisionId: 'r2',
        platformTargets: [{ platform: 'ios', minAppVersion: '5.2.0' }],
        segments: ['vip'],
      },
      {
        id: 'ios-5-2-vip-beta',
        placementKey: 'home',
        publishedRevisionId: 'r3',
        platformTargets: [{ platform: 'ios', minAppVersion: '5.2.0' }],
        segments: ['vip', 'beta'],
      },
      {
        id: 'ios-5-1-vip',
        placementKey: 'home',
        publishedRevisionId: 'r4',
        platformTargets: [{ platform: 'ios', minAppVersion: '5.1.0' }],
        segments: ['vip'],
      },
    ],
    { platform: 'ios', appVersion: '5.2.1', userSegments: ['vip'] },
  );

  assert.equal(selected?.id, 'ios-5-2-vip');
});

test('resolveSdkFeedSet falls back when targeted set is empty after runtime child filtering', () => {
  const result = resolveSdkFeedSet({
    placementKey: 'home',
    platform: 'ios',
    appVersion: '5.2.1',
    userSegments: ['vip'],
    allSets: [
      {
        id: 'targeted',
        placementKey: 'home',
        publishedRevisionId: 'r1',
        platformTargets: [{ platform: 'ios', minAppVersion: '5.0.0' }],
        segments: ['vip'],
        groups: [
          {
            id: 'g1',
            publishedRevisionId: 'gr1',
            archived: false,
            stories: [{ id: 's1', publishedRevisionId: null, archived: false }],
          },
        ],
      },
      {
        id: 'fallback',
        isFallback: true,
        placementKey: 'home',
        publishedRevisionId: 'r2',
        groups: [
          {
            id: 'g2',
            publishedRevisionId: 'gr2',
            archived: false,
            stories: [{ id: 's2', publishedRevisionId: 'sr2', archived: false }],
          },
        ],
      },
    ],
  });

  assert.equal(result.source, 'fallback');
  assert.equal(result.resolvedSet?.id, 'fallback');
  assert.equal(result.resolvedSet?.groups.length, 1);
});
