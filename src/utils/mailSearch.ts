type SearchAttachment = { filename?: string };

export type SearchableMail = {
  sender?: string;
  senderEmail?: string;
  recipientEmail?: string;
  recipientName?: string;
  ccEmail?: string;
  bccEmail?: string;
  subject?: string;
  body?: string;
  preview?: string;
  category?: string;
  folder?: string;
  imapFolder?: string;
  messageId?: string;
  attachments?: SearchAttachment[];
  draftAttachments?: SearchAttachment[];
};

export const normalizeMailSearchText = (value: unknown) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&(?:nbsp|#160);/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase();

export const mailSearchTokens = (query: string) => normalizeMailSearchText(query)
  .split(' ')
  .filter(Boolean)
  .slice(0, 12);

export const buildMailSearchDocument = (mail: SearchableMail) => normalizeMailSearchText([
  mail.sender,
  mail.senderEmail,
  mail.recipientEmail,
  mail.recipientName,
  mail.ccEmail,
  mail.bccEmail,
  mail.subject,
  mail.body,
  mail.preview,
  mail.category,
  mail.imapFolder || mail.folder,
  mail.messageId,
  ...(mail.attachments || []).map(attachment => attachment.filename),
  ...(mail.draftAttachments || []).map(attachment => attachment.filename)
].filter(Boolean).join(' '));

export const mailSearchDocumentMatches = (document: string, tokens: string[]) => (
  tokens.length === 0 || tokens.every(token => document.includes(token))
);

export const mailMatchesSearch = (mail: SearchableMail, query: string) => (
  mailSearchDocumentMatches(buildMailSearchDocument(mail), mailSearchTokens(query))
);

export const normalizeMailSearchFolder = (value: unknown) => String(value || 'inbox')
  .trim()
  .replace(/\\/g, '/')
  .replace(/\/{2,}/g, '/')
  .replace(/^\/+|\/+$/g, '')
  .toLocaleLowerCase();

export const mailSearchFolderMatches = (mailFolder: unknown, requestedFolder: unknown) => (
  normalizeMailSearchFolder(mailFolder) === normalizeMailSearchFolder(requestedFolder)
);
