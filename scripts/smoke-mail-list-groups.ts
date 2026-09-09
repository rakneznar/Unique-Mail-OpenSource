import assert from 'node:assert/strict';
import { mailDateGroup } from '../src/components/ItemList';

const now = new Date(2026, 8, 9, 12, 0, 0);
const daysAgo = (days: number) => new Date(2026, 8, 9 - days, 8, 30, 0).toISOString();

assert.equal(mailDateGroup(daysAgo(0), now), 'today');
assert.equal(mailDateGroup(daysAgo(1), now), 'yesterday');
assert.equal(mailDateGroup(daysAgo(2), now), 'dayBeforeYesterday');
assert.equal(mailDateGroup(daysAgo(3), now), 'lastWeek');
assert.equal(mailDateGroup(daysAgo(7), now), 'lastWeek');
assert.equal(mailDateGroup(daysAgo(8), now), 'twoWeeksAgo');
assert.equal(mailDateGroup(daysAgo(14), now), 'twoWeeksAgo');
assert.equal(mailDateGroup(daysAgo(15), now), 'older');
assert.equal(mailDateGroup('invalid', now), 'older');

console.log('Mail list date group smoke test passed.');
