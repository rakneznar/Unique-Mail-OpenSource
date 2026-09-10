import assert from 'node:assert/strict';
import { looksLikeHtmlMailBody } from '../src/utils/mailBody';

assert.equal(looksLikeHtmlMailBody('Hallo\n\nVon: Stefan <stefan@example.com>\nBetreff: Test'), false);
assert.equal(looksLikeHtmlMailBody('Bitte an <info@premio-saeckingen.de> antworten.'), false);
assert.equal(looksLikeHtmlMailBody('<div>Hallo<br>zweite Zeile</div>'), true);
assert.equal(looksLikeHtmlMailBody('<!doctype html><html><body><p>Hallo</p></body></html>'), true);

console.log('Mail body format smoke test passed.');
