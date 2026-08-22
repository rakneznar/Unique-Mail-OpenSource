import assert from 'node:assert/strict';
import { addEmailsToDragData, emailToEmlAttachment, emailToEmlText, readEmlAttachmentsFromDrop } from '../src/utils/eml';
import type { Email } from '../src/types';

const mail: Email = {
  id: 'mail-1',
  sender: 'Jörg Beispiel',
  senderEmail: 'joerg@example.test',
  recipientEmail: 'team@example.test',
  ccEmail: 'cc@example.test',
  bccEmail: 'bcc@example.test',
  subject: 'Prüfung: Angebot / August',
  date: '2026-08-22T10:00:00.000Z',
  body: '<p>Grüße aus Köln</p>',
  bodyLoaded: true,
  preview: 'Grüße aus Köln',
  isRead: true,
  isFlagged: false,
  hasAttachment: true,
  importance: 'normal',
  attachments: [{
    filename: 'Übersicht.pdf',
    contentType: 'application/pdf',
    contentBase64: Buffer.from('pdf-test').toString('base64')
  }]
};

const eml = emailToEmlText(mail);
assert.match(eml, /^From: =\?UTF-8\?B\?/);
assert.match(eml, /To: team@example\.test/);
assert.match(eml, /Cc: cc@example\.test/);
assert.match(eml, /Bcc: bcc@example\.test/);
assert.match(eml, /Subject: =\?UTF-8\?B\?/);
assert.match(eml, /Content-Type: multipart\/mixed/);
assert.match(eml, /Content-Type: text\/html; charset=UTF-8/);
assert.match(eml, /filename\*=UTF-8''%C3%9Cbersicht\.pdf/);
assert.ok(eml.includes(Buffer.from('<p>Grüße aus Köln</p>').toString('base64')));
assert.ok(eml.includes(Buffer.from('pdf-test').toString('base64')));

const attachment = emailToEmlAttachment(mail);
assert.equal(attachment.contentType, 'message/rfc822');
assert.equal(attachment.filename, 'Prüfung_ Angebot _ August.eml');
const decodedAttachment = Buffer.from(attachment.contentBase64, 'base64').toString('utf8');
assert.match(decodedAttachment, /Content-Type: multipart\/mixed/);
assert.ok(decodedAttachment.includes(Buffer.from('<p>Grüße aus Köln</p>').toString('base64')));

const transferStore = new Map<string, string>();
const transfer = {
  setData: (type: string, value: string) => transferStore.set(type, value),
  getData: (type: string) => transferStore.get(type) || '',
  items: { add: () => undefined }
} as unknown as DataTransfer;
addEmailsToDragData(transfer, [mail]);
const roundTrip = readEmlAttachmentsFromDrop(transfer);
assert.equal(roundTrip.length, 1);
assert.equal(roundTrip[0].filename, attachment.filename);
assert.equal(roundTrip[0].contentType, 'message/rfc822');
assert.match(Buffer.from(roundTrip[0].contentBase64, 'base64').toString('utf8'), /Subject: =\?UTF-8\?B\?/);

console.log('EML attachment smoke test passed.');
