import assert from 'node:assert/strict';
import {
  buildMailSearchDocument,
  mailMatchesSearch,
  mailSearchDocumentMatches,
  mailSearchFolderMatches,
  mailSearchTokens
} from '../src/utils/mailSearch';

const nestedMail = {
  sender: 'Mélanie Säckingen',
  senderEmail: 'melanie@example.test',
  subject: 'Projektabrechnung',
  body: '<p>Die finale Freigabe befindet sich im Unterordner.</p>',
  imapFolder: 'Kunden/2026/Rechnungen',
  attachments: [{ filename: 'Kostenübersicht.pdf' }]
};

assert.equal(mailMatchesSearch(nestedMail, 'melanie freigabe'), true);
assert.equal(mailMatchesSearch(nestedMail, 'sackingen kostenubersicht'), true);
assert.equal(mailMatchesSearch(nestedMail, 'nicht vorhanden'), false);
assert.equal(mailSearchFolderMatches('Kunden\\2026\\Rechnungen', 'Kunden/2026/Rechnungen'), true);
assert.equal(mailSearchFolderMatches('Kunden/2026', 'Kunden/2026/Rechnungen'), false);

const tokens = mailSearchTokens('  Projekt   Freigabe ');
assert.deepEqual(tokens, ['projekt', 'freigabe']);
assert.equal(mailSearchDocumentMatches(buildMailSearchDocument(nestedMail), tokens), true);

console.log('Mail full-text and nested-folder search tests passed.');
