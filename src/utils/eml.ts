import type { Email } from '../types';
import type { ComposeAttachmentPayload } from '../components/ReadingPane';

export const UNIQUE_MAIL_EML_DRAG_TYPE = 'application/x-unique-mail-eml-attachments';

const encodeUtf8Base64 = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const normalizeHeader = (value: unknown) => String(value || '').replace(/[\r\n]+/g, ' ').trim();
const isHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const safeFilename = (value: string) => {
  const cleaned = value.normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 120);
  return `${cleaned || 'Nachricht'}.eml`;
};

const encodeHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  return /[^\x20-\x7e]/.test(normalized) ? `=?UTF-8?B?${encodeUtf8Base64(normalized)}?=` : normalized;
};

const formatAddress = (name: unknown, address: unknown) => {
  const safeName = normalizeHeader(name);
  const safeAddress = normalizeHeader(address);
  if (!safeAddress) return safeName;
  return safeName && safeName.toLowerCase() !== safeAddress.toLowerCase()
    ? `${encodeHeader(safeName)} <${safeAddress}>`
    : safeAddress;
};

const wrapBase64 = (value: string) => value.replace(/\s+/g, '').match(/.{1,76}/g)?.join('\r\n') || '';

export const emailToEmlText = (email: Email) => {
  const body = email.body || email.preview || '';
  const bodyType = isHtml(body) ? 'text/html' : 'text/plain';
  const attachments = (email.attachments || []).filter(attachment => attachment.contentBase64);
  const boundary = `----=_UniqueMail_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const headers = [
    `From: ${formatAddress(email.sender, email.senderEmail)}`,
    email.recipientEmail ? `To: ${normalizeHeader(email.recipientEmail)}` : '',
    email.ccEmail ? `Cc: ${normalizeHeader(email.ccEmail)}` : '',
    email.bccEmail ? `Bcc: ${normalizeHeader(email.bccEmail)}` : '',
    `Subject: ${encodeHeader(email.subject || '(Kein Betreff)')}`,
    `Date: ${new Date(email.date || Date.now()).toUTCString()}`,
    'MIME-Version: 1.0'
  ].filter(Boolean);

  if (attachments.length === 0) {
    return [...headers, `Content-Type: ${bodyType}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', wrapBase64(encodeUtf8Base64(body)), ''].join('\r\n');
  }

  const parts = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: ${bodyType}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(encodeUtf8Base64(body)),
    ''
  ];
  attachments.forEach(attachment => {
    const filename = normalizeHeader(attachment.filename || 'Anlage');
    parts.push(
      `--${boundary}`,
      `Content-Type: ${normalizeHeader(attachment.contentType) || 'application/octet-stream'}; name="${filename.replace(/"/g, "'")}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      '',
      wrapBase64(attachment.contentBase64 || ''),
      ''
    );
  });
  parts.push(`--${boundary}--`, '');
  return parts.join('\r\n');
};

export const emailToEmlAttachment = (email: Email): ComposeAttachmentPayload => ({
  filename: safeFilename(email.subject || 'Nachricht'),
  contentType: 'message/rfc822',
  contentBase64: encodeUtf8Base64(emailToEmlText(email))
});

export const addEmailsToDragData = (dataTransfer: DataTransfer, emails: Email[]) => {
  const attachments = emails.map(emailToEmlAttachment);
  dataTransfer.setData(UNIQUE_MAIL_EML_DRAG_TYPE, JSON.stringify(attachments));
  attachments.forEach(attachment => {
    try {
      const bytes = Uint8Array.from(atob(attachment.contentBase64), char => char.charCodeAt(0));
      dataTransfer.items?.add(new File([bytes], attachment.filename, { type: attachment.contentType }));
    } catch {
      // The private MIME payload remains available if synthetic files are unsupported.
    }
  });
};

export const readEmlAttachmentsFromDrop = (dataTransfer: DataTransfer): ComposeAttachmentPayload[] => {
  try {
    const raw = dataTransfer.getData(UNIQUE_MAIL_EML_DRAG_TYPE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.filename === 'string' && typeof item.contentBase64 === 'string')
      .map(item => ({ filename: item.filename, contentType: 'message/rfc822', contentBase64: item.contentBase64 }));
  } catch {
    return [];
  }
};
