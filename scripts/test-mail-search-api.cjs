const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const email = 'search-test@example.test';
const folder = 'Kunden/2026/Rechnungen';
const uidValidity = '123';
const uid = 42;
const id = `imap-${email}-${folder}-${uid}`;
const segment = value => Buffer.from(String(value).toLowerCase(), 'utf8').toString('base64url');

const reservePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close(error => error ? reject(error) : resolve(port));
  });
});

const requestJson = (url, options = {}, payload) => new Promise((resolve, reject) => {
  const request = http.request(url, {
    method: options.method || 'GET',
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    agent: false
  }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        json: () => JSON.parse(text || '{}')
      });
    });
  });
  request.once('error', reject);
  if (payload) request.write(JSON.stringify(payload));
  request.end();
});

const waitForServer = async (url, child, diagnostics) => {
  const deadline = Date.now() + 12_000;
  let lastError = '';
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Search test server exited early.\n${diagnostics.join('')}`);
    try {
      const response = await requestJson(`${url}/api/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error?.stack || error?.message || String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Search test server did not start.\n${diagnostics.join('')}\n${lastError}`);
};

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'unique-mail-search-'));
  const cacheDir = path.join(root, 'cache');
  const storeDir = path.join(root, 'store');
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const diagnostics = [];
  let child;

  try {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(path.join(storeDir, segment(email), segment(folder), segment(uidValidity)), { recursive: true });
  await fs.writeFile(path.join(cacheDir, `${segment(email)}.json`), JSON.stringify({
    emails: [{
      id,
      sender: 'Archiv Kunde',
      senderEmail: 'kunde@example.test',
      subject: 'Monatsunterlagen',
      date: new Date().toISOString(),
      body: '',
      bodyLoaded: false,
      preview: 'Metadaten ohne Suchbegriff',
      folder,
      imapFolder: folder,
      accountEmail: email,
      imapUid: uid,
      imapUidValidity: uidValidity
    }],
    folders: [{ path: folder, id: folder, flags: [], status: { messages: 1 } }]
  }), 'utf8');
  await fs.writeFile(
    path.join(storeDir, segment(email), segment(folder), segment(uidValidity), `${uid}.json`),
    JSON.stringify({ body: '<p>Verdeckter Volltext Fundstellenbegriff</p>', attachments: [{ filename: 'Beleg.pdf' }] }),
    'utf8'
  );

  child = spawn(process.execPath, ['dist/server.cjs'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      UNIQUE_MAIL_CACHE_DIR: cacheDir,
      UNIQUE_MAIL_STORE_DIR: storeDir
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => diagnostics.push(chunk.toString()));
  child.stderr.on('data', chunk => diagnostics.push(chunk.toString()));
  await waitForServer(baseUrl, child, diagnostics);

  const response = await requestJson(`${baseUrl}/api/mail/search`, { method: 'POST' }, {
    email, query: 'Fundstellenbegriff', folders: [folder]
  });
  assert.equal(response.ok, true);
  const result = response.json();
  assert.deepEqual(result.ids, [id]);
  assert.equal(result.complete, true);

  const parentResponse = await requestJson(`${baseUrl}/api/mail/search`, { method: 'POST' }, {
    email, query: 'Fundstellenbegriff', folders: ['Kunden/2026']
  });
  assert.equal(parentResponse.ok, true);
  assert.deepEqual(parentResponse.json().ids, []);
  console.log('Mail search API finds permanent content in an exact nested folder.');
  } finally {
    child?.kill();
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
