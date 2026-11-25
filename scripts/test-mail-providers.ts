import assert from 'node:assert/strict';
import { normalizeEmailAddressForProvider, resolveMailProviderSettings } from '../src/utils/mailProviders';

const expected = [
  ['person@gmx.de', 'imap.gmx.net', 993, 'mail.gmx.net', 587, 'GMX Freemail'],
  ['person@gmx.net', 'imap.gmx.net', 993, 'mail.gmx.net', 587, 'GMX Freemail'],
  ['person@gmx.at', 'imap.gmx.net', 993, 'mail.gmx.net', 587, 'GMX Freemail'],
  ['person@gmx.ch', 'imap.gmx.net', 993, 'mail.gmx.net', 587, 'GMX Freemail'],
  ['person@web.de', 'imap.web.de', 993, 'smtp.web.de', 587, 'WEB.DE Freemail'],
  ['person@arcor.de', 'imap.vodafonemail.de', 993, 'smtp.vodafonemail.de', 465, 'Vodafone / Arcor Mail']
] as const;

for (const [email, imapServer, imapPort, smtpServer, smtpPort, provider] of expected) {
  const settings = resolveMailProviderSettings(email);
  assert.deepEqual(settings, { imapServer, imapPort, smtpServer, smtpPort, provider, confidence: 'preset' });
}

assert.equal(normalizeEmailAddressForProvider('person@GMXDE'), 'person@gmx.de');
assert.equal(normalizeEmailAddressForProvider('person@ARCORDE'), 'person@arcor.de');
assert.equal(resolveMailProviderSettings('person@example.org').confidence, 'fallback');

console.log('GMX, WEB.DE, and Arcor provider autodiscovery tests passed.');
