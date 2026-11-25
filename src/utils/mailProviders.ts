export type MailProviderSettings = {
  imapServer: string;
  imapPort: number;
  smtpServer: string;
  smtpPort: number;
  provider: string;
  confidence: 'preset' | 'fallback';
};

type MailProviderPreset = Omit<MailProviderSettings, 'confidence'> & {
  matches: (domain: string) => boolean;
};

const exactDomains = (...domains: string[]) => {
  const supported = new Set(domains);
  return (domain: string) => supported.has(domain);
};

const PROVIDER_PRESETS: MailProviderPreset[] = [
  { matches: exactDomains('gmail.com', 'googlemail.com'), imapServer: 'imap.gmail.com', imapPort: 993, smtpServer: 'smtp.gmail.com', smtpPort: 465, provider: 'Google Workspace / Gmail' },
  { matches: exactDomains('gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch'), imapServer: 'imap.gmx.net', imapPort: 993, smtpServer: 'mail.gmx.net', smtpPort: 587, provider: 'GMX Freemail' },
  { matches: exactDomains('web.de'), imapServer: 'imap.web.de', imapPort: 993, smtpServer: 'smtp.web.de', smtpPort: 587, provider: 'WEB.DE Freemail' },
  { matches: exactDomains('arcor.de'), imapServer: 'imap.vodafonemail.de', imapPort: 993, smtpServer: 'smtp.vodafonemail.de', smtpPort: 465, provider: 'Vodafone / Arcor Mail' },
  { matches: exactDomains('mail.de'), imapServer: 'imap.mail.de', imapPort: 993, smtpServer: 'smtp.mail.de', smtpPort: 587, provider: 'mail.de' },
  { matches: domain => domain.includes('outlook.com') || domain.includes('hotmail.') || domain.includes('live.') || domain.includes('msn.'), imapServer: 'outlook.office365.com', imapPort: 993, smtpServer: 'smtp-mail.outlook.com', smtpPort: 587, provider: 'Microsoft Live / Outlook.com' },
  { matches: domain => domain.includes('office365.') || domain.includes('microsoft365.') || domain.includes('onmicrosoft.com'), imapServer: 'outlook.office365.com', imapPort: 993, smtpServer: 'smtp.office365.com', smtpPort: 587, provider: 'Microsoft 365 / Exchange Online' },
  { matches: exactDomains('icloud.com', 'me.com', 'mac.com'), imapServer: 'imap.mail.me.com', imapPort: 993, smtpServer: 'smtp.mail.me.com', smtpPort: 587, provider: 'Apple iCloud Mail' },
  { matches: domain => domain.includes('yahoo.'), imapServer: 'imap.mail.yahoo.com', imapPort: 993, smtpServer: 'smtp.mail.yahoo.com', smtpPort: 465, provider: 'Yahoo Mail' },
  { matches: domain => domain.includes('aol.'), imapServer: 'imap.aol.com', imapPort: 993, smtpServer: 'smtp.aol.com', smtpPort: 465, provider: 'AOL Mail' },
  { matches: domain => domain.includes('t-online.de') || domain.includes('magenta.de'), imapServer: 'secureimap.t-online.de', imapPort: 993, smtpServer: 'securesmtp.t-online.de', smtpPort: 465, provider: 'Telekom / T-Online' },
  { matches: domain => domain.includes('freenet.'), imapServer: 'mx.freenet.de', imapPort: 993, smtpServer: 'mx.freenet.de', smtpPort: 587, provider: 'freenet Mail' },
  { matches: exactDomains('posteo.de'), imapServer: 'posteo.de', imapPort: 993, smtpServer: 'posteo.de', smtpPort: 587, provider: 'Posteo' },
  { matches: exactDomains('mailbox.org'), imapServer: 'imap.mailbox.org', imapPort: 993, smtpServer: 'smtp.mailbox.org', smtpPort: 465, provider: 'mailbox.org' },
  { matches: domain => domain.includes('ionos.') || domain.includes('1und1.') || domain.includes('1and1.'), imapServer: 'imap.ionos.de', imapPort: 993, smtpServer: 'smtp.ionos.de', smtpPort: 587, provider: 'IONOS / 1&1 Mail' },
  { matches: domain => domain.includes('strato.'), imapServer: 'imap.strato.de', imapPort: 993, smtpServer: 'smtp.strato.de', smtpPort: 465, provider: 'STRATO Mail' },
  { matches: domain => domain.includes('zoho.'), imapServer: 'imap.zoho.eu', imapPort: 993, smtpServer: 'smtp.zoho.eu', smtpPort: 465, provider: 'Zoho Mail' },
  { matches: domain => domain.includes('fastmail.'), imapServer: 'imap.fastmail.com', imapPort: 993, smtpServer: 'smtp.fastmail.com', smtpPort: 465, provider: 'Fastmail' },
  { matches: domain => domain.includes('yandex.'), imapServer: 'imap.yandex.com', imapPort: 993, smtpServer: 'smtp.yandex.com', smtpPort: 465, provider: 'Yandex Mail' },
  { matches: domain => domain.includes('proton.') || domain.includes('pm.me'), imapServer: '127.0.0.1', imapPort: 1143, smtpServer: '127.0.0.1', smtpPort: 1025, provider: 'Proton Mail Bridge' },
  { matches: domain => domain.includes('mail.com'), imapServer: 'imap.mail.com', imapPort: 993, smtpServer: 'smtp.mail.com', smtpPort: 587, provider: 'mail.com' },
  { matches: domain => domain === 'inbox.lv' || domain === 'inbox.eu' || domain.endsWith('.inbox.lv') || domain.endsWith('.inbox.eu'), imapServer: 'mail.inbox.lv', imapPort: 993, smtpServer: 'mail.inbox.lv', smtpPort: 587, provider: 'Inbox.lv / Inbox.eu' },
  { matches: domain => domain.includes('hostinger.'), imapServer: 'imap.hostinger.com', imapPort: 993, smtpServer: 'smtp.hostinger.com', smtpPort: 465, provider: 'Hostinger Email' },
  { matches: domain => domain.includes('privateemail.') || domain.includes('namecheap.'), imapServer: 'mail.privateemail.com', imapPort: 993, smtpServer: 'mail.privateemail.com', smtpPort: 465, provider: 'Namecheap Private Email' },
  { matches: domain => domain === 'spacemail.com' || domain.endsWith('.spacemail.com') || domain === 'spaceship.com' || domain.endsWith('.spaceship.com'), imapServer: 'mail.spacemail.com', imapPort: 993, smtpServer: 'smtp.spacemail.com', smtpPort: 465, provider: 'Spaceship Spacemail' }
];

export const normalizeProviderDomain = (domain: string) => {
  const normalized = String(domain || '').trim().toLowerCase();
  if (normalized === 'mailde') return 'mail.de';
  if (normalized === 'webde') return 'web.de';
  if (normalized === 'gmxde') return 'gmx.de';
  if (normalized === 'arcorde') return 'arcor.de';
  return normalized;
};

export const normalizeEmailAddressForProvider = (email: string) => {
  const trimmed = String(email || '').trim();
  const separator = trimmed.lastIndexOf('@');
  if (separator <= 0 || separator === trimmed.length - 1) return trimmed;
  return `${trimmed.slice(0, separator)}@${normalizeProviderDomain(trimmed.slice(separator + 1))}`;
};

export const resolveMailProviderSettings = (email: string): MailProviderSettings => {
  const normalizedEmail = normalizeEmailAddressForProvider(email);
  const domain = normalizeProviderDomain(normalizedEmail.slice(normalizedEmail.lastIndexOf('@') + 1));
  const preset = PROVIDER_PRESETS.find(item => item.matches(domain));
  if (preset) {
    const { matches: _matches, ...settings } = preset;
    return { ...settings, confidence: 'preset' };
  }

  const providerName = (domain.split('.')[0] || 'Web').toUpperCase();
  return {
    imapServer: `imap.${domain}`,
    imapPort: 993,
    smtpServer: `smtp.${domain}`,
    smtpPort: 465,
    provider: `${providerName} Mail-Dienst (Auto-Discovered)`,
    confidence: 'fallback'
  };
};
