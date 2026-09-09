import assert from 'node:assert/strict';
import { parseRecipientTokens, recipientTokenFromText, serializeRecipientTokens } from '../src/utils/recipients';

const tokens = parseRecipientTokens('Max Mustermann <MAX@example.com>; anna@example.net, Max Mustermann <max@example.com>');
assert.equal(tokens.length, 2);
assert.deepEqual(tokens[0], { email: 'max@example.com', displayName: 'Max Mustermann', raw: 'Max Mustermann <max@example.com>' });
assert.equal(tokens[1].email, 'anna@example.net');
assert.equal(serializeRecipientTokens(tokens), 'Max Mustermann <max@example.com>; anna@example.net');
assert.equal(serializeRecipientTokens(tokens, 'neu@example.org'), 'Max Mustermann <max@example.com>; anna@example.net; neu@example.org');
assert.equal(recipientTokenFromText('keine adresse'), null);
const commaName = parseRecipientTokens('"Mustermann, Max" <max@example.com>; anna@example.net');
assert.equal(commaName.length, 2);
assert.equal(commaName[0].displayName, 'Mustermann, Max');
assert.equal(commaName[0].raw, '"Mustermann, Max" <max@example.com>');

console.log('Recipient token smoke test passed.');
