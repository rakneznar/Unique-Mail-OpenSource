function escapePrintHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function printableEmailDocument(payload) {
  const subject = escapePrintHtml(payload?.subject || '(Kein Betreff)');
  const metadata = [
    ['Von', payload?.from],
    ['An', payload?.to],
    ['CC', payload?.cc],
    ['BCC', payload?.bcc],
    ['Datum', payload?.date]
  ].filter(([, value]) => String(value || '').trim());
  const attachments = Array.isArray(payload?.attachments)
    ? payload.attachments.map(item => String(item || '').trim()).filter(Boolean)
    : [];
  const metadataHtml = metadata.map(([label, value]) => `<div class="meta-row"><strong>${escapePrintHtml(label)}:</strong><span>${escapePrintHtml(value)}</span></div>`).join('');
  const attachmentHtml = attachments.length > 0
    ? `<section class="attachments"><strong>Anlagen:</strong> ${attachments.map(escapePrintHtml).join(', ')}</section>`
    : '';
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:">
<title>${subject}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; color: #111827; background: #fff; font: 10.5pt/1.5 Arial, sans-serif; }
  header { border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 18px; }
  h1 { margin: 0 0 10px; font-size: 18pt; line-height: 1.25; overflow-wrap: anywhere; }
  .meta-row { display: grid; grid-template-columns: 52px 1fr; gap: 8px; margin: 2px 0; overflow-wrap: anywhere; }
  .attachments { margin-top: 10px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9pt; overflow-wrap: anywhere; }
  #message-body { min-width: 0; overflow-wrap: anywhere; }
  #message-body img { max-width: 100% !important; height: auto !important; }
  #message-body table { max-width: 100% !important; }
  #message-body pre { white-space: pre-wrap; overflow-wrap: anywhere; }
  #message-body a { color: #005a9e; text-decoration: underline; }
</style></head><body>
<header><h1>${subject}</h1>${metadataHtml}${attachmentHtml}</header>
<main id="message-body">${String(payload?.bodyHtml || '')}</main>
</body></html>`;
}

module.exports = { escapePrintHtml, printableEmailDocument };
