const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { findMailtoRequest, parseMailtoRequest } = require('../electron/mailto.cjs');

const request = parseMailtoRequest(
  'mailto:max%40example.com?cc=copy%40example.com&bcc=hidden%40example.com&subject=Hello%20World&body=Line%201%0ALine%202',
  () => 'test-id'
);

assert.deepEqual(request, {
  id: 'test-id',
  to: 'max@example.com',
  cc: 'copy@example.com',
  bcc: 'hidden@example.com',
  subject: 'Hello World',
  body: 'Line 1\nLine 2'
});
assert.equal(parseMailtoRequest('https://example.com'), null);
assert.equal(
  findMailtoRequest(['Unique Mail.exe', '--flag', 'mailto:team%40example.com'], () => 'second-instance').to,
  'team@example.com'
);

const installerPath = path.join(__dirname, '..', 'electron', 'installer.nsh');
const installer = fs.readFileSync(installerPath, 'utf8');
for (const expected of [
  'Software\\RegisteredApplications',
  'Software\\Unique Mail\\Capabilities\\URLAssociations',
  'UniqueMail.Url.mailto',
  'URL Protocol',
  'shell\\open\\command',
  '!macro customUnInstall'
]) {
  assert.ok(installer.includes(expected), `Installer registration is missing: ${expected}`);
}

console.log('Windows default-mail registration and mailto parsing passed.');
