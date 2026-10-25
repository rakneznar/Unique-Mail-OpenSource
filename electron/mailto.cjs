const crypto = require('crypto');

function parseMailtoRequest(
  rawValue,
  createId = () => `mailto-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
) {
  const raw = String(rawValue || '').trim().replace(/^['"]|['"]$/g, '');
  if (!/^mailto:/i.test(raw)) return null;

  try {
    const parsed = new URL(raw);
    const read = (key) => String(parsed.searchParams.get(key) || '').slice(0, 20_000);
    return {
      id: createId(),
      to: decodeURIComponent(parsed.pathname || '').slice(0, 20_000),
      cc: read('cc'),
      bcc: read('bcc'),
      subject: read('subject').slice(0, 2_000),
      body: read('body')
    };
  } catch {
    return null;
  }
}

function findMailtoRequest(commandLine, createId) {
  const args = Array.isArray(commandLine) ? commandLine : [];
  for (const argument of args) {
    const request = parseMailtoRequest(argument, createId);
    if (request) return request;
  }
  return null;
}

module.exports = { parseMailtoRequest, findMailtoRequest };
