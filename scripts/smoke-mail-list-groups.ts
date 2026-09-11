import assert from 'node:assert/strict';
import { mailDateGroup, sortEmailsForDisplay } from '../src/components/ItemList';
import type { Email } from '../src/types';

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

const email = (id: string, days: number, isPinned = false): Email => ({
  id,
  sender: id,
  senderEmail: `${id}@example.com`,
  subject: id,
  date: daysAgo(days),
  body: '',
  preview: '',
  isRead: true,
  isFlagged: false,
  isPinned,
  hasAttachment: false,
  importance: 'normal',
  category: '',
  folder: 'inbox'
});
const ordered = sortEmailsForDisplay([
  email('today', 0),
  email('old-pin', 20, true),
  email('yesterday', 1),
  email('new-pin', 3, true)
]);
assert.deepEqual(ordered.map(item => item.id), ['new-pin', 'old-pin', 'today', 'yesterday']);

console.log('Mail list date group smoke test passed.');
