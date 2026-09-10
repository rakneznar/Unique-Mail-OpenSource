const assert = require('node:assert/strict');
const { printableEmailDocument } = require('../electron/print-email-document.cjs');

const documentHtml = printableEmailDocument({
  subject: 'Rechnung <September>',
  from: 'Absender <sender@example.com>',
  to: 'Empfänger <recipient@example.com>',
  date: '10.09.2026, 09:15:00',
  bodyHtml: '<p>Vollständiger <strong>Nachrichtentext</strong></p>',
  attachments: ['rechnung.pdf', 'daten & fakten.xlsx']
});

assert.match(documentHtml, /Rechnung &lt;September&gt;/);
assert.match(documentHtml, /sender@example\.com/);
assert.match(documentHtml, /Vollständiger <strong>Nachrichtentext<\/strong>/);
assert.match(documentHtml, /rechnung\.pdf/);
assert.match(documentHtml, /daten &amp; fakten\.xlsx/);
assert.match(documentHtml, /Content-Security-Policy/);
assert.match(documentHtml, /@page \{ size: A4/);

console.log('Email print document smoke test passed.');
