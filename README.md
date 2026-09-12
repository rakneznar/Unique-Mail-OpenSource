# Unique Mail

Unique Mail is a local-first Windows desktop mail client built with Electron, React, ImapFlow, Nodemailer, and MailParser. It connects directly to configured IMAP and SMTP servers, keeps a local on-disk mail cache, and stores account credentials through Electron's operating-system-backed `safeStorage` integration.

## Development

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
```

Type-check and build:

```powershell
npm run lint
npm run build
```

Build the Windows installer and portable executable:

```powershell
npm run dist:all
```

Core mail functionality does not require Gemini. Copy `.env.example` to `.env.local` only when optional AI or feedback SMTP features are needed.

See `PRIVACY.md`, `SECURITY.md`, and `COMPLIANCE_CHECKLIST.md`. The legal checklist is an engineering audit, not legal advice; publisher-specific details must be completed before commercial distribution.

Unique Mail is licensed under Apache License 2.0. Third-party software retains its own licenses; see `THIRD_PARTY_NOTICES.txt` and the license files included with Electron.
