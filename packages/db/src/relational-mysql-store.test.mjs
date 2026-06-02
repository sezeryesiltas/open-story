import test from 'node:test';
import assert from 'node:assert/strict';

import { parseRelationalMysqlStringArray } from './relational-mysql-store.ts';

test('parseRelationalMysqlStringArray parses JSON arrays', () => {
  assert.deepEqual(parseRelationalMysqlStringArray('["ios","android"]'), ['ios', 'android']);
});

test('parseRelationalMysqlStringArray accepts migrated postgres array literal text', () => {
  assert.deepEqual(parseRelationalMysqlStringArray('{vip,beta}'), ['vip', 'beta']);
});
