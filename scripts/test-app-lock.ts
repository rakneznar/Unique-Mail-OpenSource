import assert from 'node:assert/strict';
import { getAppLockDurationMs, normalizeAppLockConfig } from '../src/utils/appLock';

const legacy = normalizeAppLockConfig({ enabled: true, salt: 'salt', hash: 'hash' });
assert.ok(legacy);
assert.equal(legacy.autoLockEnabled, false, 'legacy configs must remain unlocked until the user enables the timer');
assert.equal(getAppLockDurationMs(legacy), null);

const seconds = normalizeAppLockConfig({
  enabled: true,
  salt: 'salt',
  hash: 'hash',
  autoLockEnabled: true,
  autoLockValue: 30,
  autoLockUnit: 'seconds'
});
assert.equal(getAppLockDurationMs(seconds), 30_000);

const minutes = normalizeAppLockConfig({
  enabled: true,
  salt: 'salt',
  hash: 'hash',
  autoLockEnabled: true,
  autoLockValue: 15,
  autoLockUnit: 'minutes'
});
assert.equal(getAppLockDurationMs(minutes), 900_000);

const invalid = normalizeAppLockConfig({ enabled: true, salt: 'salt', hash: 'hash', autoLockEnabled: true, autoLockValue: 0 });
assert.equal(invalid?.autoLockValue, 5);
assert.equal(getAppLockDurationMs(invalid), 300_000);
assert.equal(normalizeAppLockConfig({ enabled: true, salt: 'salt' }), null);

console.log('App-lock timer regression tests passed.');
