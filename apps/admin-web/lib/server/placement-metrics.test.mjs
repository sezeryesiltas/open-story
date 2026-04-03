import assert from 'node:assert/strict';
import test from 'node:test';

import { attachConnectedSetCounts, countConnectedSetsByPlacement } from './placement-metrics.ts';

test('countConnectedSetsByPlacement counts both camelCase and snake_case placement ids', () => {
  const counts = countConnectedSetsByPlacement([
    { placementId: 'placement-home' },
    { placement_id: 'placement-home' },
    { placementId: 'placement-discover' },
    { placementId: '   ' },
    {},
  ]);

  assert.equal(counts.get('placement-home'), 2);
  assert.equal(counts.get('placement-discover'), 1);
  assert.equal(counts.has(''), false);
});

test('attachConnectedSetCounts fills placements without linked sets with zero', () => {
  const placements = [
    {
      id: 'placement-home',
      key: 'home_top_story_bar',
      name: 'Home',
      description: null,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
    {
      id: 'placement-discover',
      key: 'discover_story_bar',
      name: 'Discover',
      description: null,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    },
  ];

  const result = attachConnectedSetCounts(placements, [{ placementId: 'placement-home' }]);

  assert.deepEqual(
    result.map((placement) => ({
      id: placement.id,
      connectedSetCount: placement.connectedSetCount,
    })),
    [
      { id: 'placement-home', connectedSetCount: 1 },
      { id: 'placement-discover', connectedSetCount: 0 },
    ],
  );
});
