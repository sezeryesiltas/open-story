import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRelationalPostgresStringArray } from './relational-postgres-store.ts';

test('parseRelationalPostgresStringArray accepts pg array parser output', () => {
  assert.deepEqual(parseRelationalPostgresStringArray(['ios', 'android']), ['ios', 'android']);
});

test('parseRelationalPostgresStringArray parses custom enum array literals', () => {
  assert.deepEqual(parseRelationalPostgresStringArray('{ios,android}'), ['ios', 'android']);
  assert.deepEqual(parseRelationalPostgresStringArray('{ios}'), ['ios']);
});

test('parseRelationalPostgresStringArray parses quoted text array literals', () => {
  assert.deepEqual(parseRelationalPostgresStringArray('{"vip","beta users","comma,value"}'), [
    'vip',
    'beta users',
    'comma,value',
  ]);
});
