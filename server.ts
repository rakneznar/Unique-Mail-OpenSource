import express from "express";
import fs from "fs/promises";
import path from "path";
import { resolveMx } from "dns/promises";
import { GoogleGenAI } from "@google/genai";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

type SyncInboxRequest = {
  email: string;
  password: string;
  imapServer: string;
  imapPort: number;
};

type MailActionRequest = SyncInboxRequest & {
  folder: string;
  uids: number[];
  isRead?: boolean;
  destinationFolder?: string;
};

type MailBodyRequest = SyncInboxRequest & {
  folder: string;
  uid: number;
};

type SendMailRequest = SyncInboxRequest & {
  smtpServer: string;
  smtpPort: number;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  html: string;
  text?: string;
  sentFolder?: string;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    contentBase64: string;
  }>;
};

function repairDecodedText(value: string) {
  if (!value) return value;
  return value.replace(/[ÃÂâðï][\u0080-\uFFFF]{1,12}/g, (run) => {
    const cp1252: Record<string, number> = {
      '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
      'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
      '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
      '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f
    };
    const bytes: number[] = [];
    for (const char of run) {
      const code = char.codePointAt(0) || 0;
      if (code <= 0xff) bytes.push(code);
      else if (cp1252[char] !== undefined) bytes.push(cp1252[char]);
      else return run;
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
    } catch {
      return run;
    }
  });
}

async function parseMessageSource(source: any) {
  const parsed = await simpleParser(source);
  const bodyProbe = `${parsed.subject || ""} ${parsed.text || ""} ${typeof parsed.html === "string" ? parsed.html : ""}`;
  if (!bodyProbe.includes("�")) return parsed;

  const sourceBuffer = Buffer.isBuffer(source) ? source : Buffer.from(String(source || ""));
  const fallbackSource = new TextDecoder("windows-1252").decode(sourceBuffer);
  const fallbackParsed = await simpleParser(fallbackSource);
  const replacementCount = (value: string) => (value.match(/�/g) || []).length;
  const originalBad = replacementCount(bodyProbe);
  const fallbackProbe = `${fallbackParsed.subject || ""} ${fallbackParsed.text || ""} ${typeof fallbackParsed.html === "string" ? fallbackParsed.html : ""}`;
  return replacementCount(fallbackProbe) < originalBad ? fallbackParsed : parsed;
}

function toTextPreview(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function firstAddress(addresses: any, fallbackName: string, fallbackEmail: string) {
  const first = Array.isArray(addresses) ? addresses[0] : addresses?.value?.[0];
  return {
    name: first?.name || fallbackName || fallbackEmail,
    email: first?.address || fallbackEmail,
  };
}

function jsonSafe(value: any): any {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Set) return Array.from(value).map(jsonSafe);
  if (value instanceof Map) return Array.from(value.entries()).map(([key, val]) => [jsonSafe(key), jsonSafe(val)]);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, jsonSafe(val)]));
  }
  return value;
}

function normalizeFolderStatus(status: any) {
  if (!status) return null;
  return jsonSafe({
    messages: status.messages,
    unseen: status.unseen,
    uidNext: status.uidNext,
    uidValidity: status.uidValidity,
    highestModseq: status.highestModseq,
  });
}

function makeImapEmailId(email: string, folderPath: string, uid: number) {
  return `imap-${email}-${folderPath}-${uid}`;
}

function parseUidFromEmailId(id: string) {
  const match = id.match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getMailUid(mail: any) {
  const value = Number(mail?.imapUid ?? parseUidFromEmailId(mail?.id || ""));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function sameFolder(a?: string, b?: string) {
  return (a || "").toLowerCase() === (b || "").toLowerCase();
}

function ensureUidList(value: any) {
  return Array.isArray(value)
    ? value.map(Number).filter(uid => Number.isFinite(uid) && uid > 0)
    : [];
}

function normalizeAddressList(value?: string) {
  return (value || "")
    .split(/[;,]/)
    .map(item => item.trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeProviderDomain(domain: string) {
  return (domain || "").trim().toLowerCase();
}

function localAutodiscoverSettings(email: string) {
  const domain = normalizeProviderDomain(email.split("@")[1] || "");
  if (domain === "spacemail.com" || domain.endsWith(".spacemail.com") || domain === "spaceship.com" || domain.endsWith(".spaceship.com")) {
    return {
      imapServer: "mail.spacemail.com",
      imapPort: 993,
      smtpServer: "smtp.spacemail.com",
      smtpPort: 465,
      provider: "Spaceship Spacemail",
      confidence: "preset",
    };
  }
  if (domain.includes("privateemail.") || domain.includes("namecheap.")) {
    return {
      imapServer: "mail.privateemail.com",
      imapPort: 993,
      smtpServer: "mail.privateemail.com",
      smtpPort: 465,
      provider: "Namecheap Private Email",
      confidence: "preset",
    };
  }
  return {
    imapServer: "imap." + domain,
    imapPort: 993,
    smtpServer: "smtp." + domain,
    smtpPort: 465,
    provider: (domain.split(".")[0] || "Web").toUpperCase() + " Mail-Dienst (Auto-Discovered)",
    confidence: "fallback",
  };
}

async function autodiscoverSettings(email: string) {
  const direct = localAutodiscoverSettings(email);
  const domain = normalizeProviderDomain(email.split("@")[1] || "");
  if (!domain || direct.confidence === "preset") return direct;

  try {
    const mxRecords = await resolveMx(domain);
    const mxNames = mxRecords.map(record => record.exchange.toLowerCase());
    const mxText = mxNames.join(" ");
    if (mxText.includes("spacemail.com") || mxText.includes("spaceship.com")) {
      return {
        imapServer: "mail.spacemail.com",
        imapPort: 993,
        smtpServer: "smtp.spacemail.com",
        smtpPort: 465,
        provider: "Spaceship Spacemail (MX erkannt)",
        confidence: "mx",
        mxRecords: mxNames,
      };
    }
    if (mxText.includes("privateemail.com")) {
      return {
        imapServer: "mail.privateemail.com",
        imapPort: 993,
        smtpServer: "mail.privateemail.com",
        smtpPort: 465,
        provider: "Namecheap Private Email (MX erkannt)",
        confidence: "mx",
        mxRecords: mxNames,
      };
    }
    return { ...direct, mxRecords: mxNames };
  } catch {
    return direct;
  }
}

function buildSmtpAttachments(attachments: SendMailRequest["attachments"]): Mail.Attachment[] {
  return (attachments || [])
    .filter(item => item?.filename && item?.contentBase64)
    .map(item => ({
      filename: item.filename,
      contentType: item.contentType || "application/octet-stream",
      content: Buffer.from(item.contentBase64, "base64"),
    }));
}

function createImapClient({ email, password, imapServer, imapPort }: SyncInboxRequest) {
  return new ImapFlow({
    host: imapServer,
    port: Number(imapPort),
    secure: Number(imapPort) !== 143,
    auth: {
      user: email,
      pass: password,
    },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
}

function updateEnvelopeFields(existing: any, message: any, folderPath: string, email: string, uidValidity: string) {
  const flags = message.flags || new Set();
  const from = message.envelope?.from?.[0];
  const to = message.envelope?.to?.[0];
  return {
    ...existing,
    id: makeImapEmailId(email, folderPath, Number(message.uid)),
    sender: from?.name || from?.address || existing.sender,
    senderEmail: from?.address || existing.senderEmail,
    subject: message.envelope?.subject || existing.subject || "(Kein Betreff)",
    date: (message.envelope?.date || existing.date ? new Date(message.envelope?.date || existing.date) : new Date()).toISOString(),
    isRead: flags.has("\\Seen"),
    isFlagged: flags.has("\\Flagged"),
    folder: folderPath,
    accountEmail: email,
    recipientEmail: to?.address || existing.recipientEmail,
    recipientName: to?.name || existing.recipientName,
    imapUid: Number(message.uid),
    imapFolder: folderPath,
    imapUidValidity: uidValidity,
  };
}

function buildEmailFromEnvelope(message: any, folderPath: string, email: string, uidValidity: string) {
  const flags = message.flags || new Set();
  const from = message.envelope?.from?.[0];
  const to = message.envelope?.to?.[0];
  const uid = Number(message.uid);
  const subject = message.envelope?.subject || "(Kein Betreff)";

  return {
    id: makeImapEmailId(email, folderPath, uid),
    sender: from?.name || from?.address || email,
    senderEmail: from?.address || email,
    subject,
    date: (message.envelope?.date || new Date()).toISOString(),
    body: "",
    preview: toTextPreview(subject),
    isRead: flags.has("\\Seen"),
    isFlagged: flags.has("\\Flagged"),
    hasAttachment: false,
    importance: "normal",
    folder: folderPath,
    accountEmail: email,
    recipientEmail: to?.address || email,
    recipientName: to?.name || "",
    imapUid: uid,
    imapFolder: folderPath,
    imapUidValidity: uidValidity,
  };
}

async function buildEmailFromSource(message: any, folderPath: string, email: string, uidValidity: string) {
  const parsed = await parseMessageSource(message.source);
  const sender = firstAddress(parsed.from, message.envelope?.from?.[0]?.name, message.envelope?.from?.[0]?.address || email);
  const recipient = firstAddress(parsed.to, "", email);
  const htmlBody = repairDecodedText(typeof parsed.html === "string" ? parsed.html : "");
  const textBody = repairDecodedText(parsed.text || "");
  const body = htmlBody || textBody || "";
  const subject = repairDecodedText(parsed.subject || "(Kein Betreff)");
  const preview = toTextPreview(textBody || htmlBody || subject || "");
  const flags = message.flags || new Set();
  const uid = Number(message.uid);

  const attachments = parsed.attachments.map((attachment: any, index: number) => {
    const fallbackExt = attachment.contentType === "application/pdf"
      ? ".pdf"
      : attachment.contentType?.includes("spreadsheet") || attachment.contentType?.includes("excel")
        ? ".xlsx"
        : attachment.contentType?.includes("word")
          ? ".docx"
          : "";
    const rawName = attachment.filename || attachment.contentDisposition?.params?.filename || attachment.cid || `anlage-${index + 1}${fallbackExt}`;
    const filename = repairDecodedText(String(rawName)).replace(/[\\/:*?"<>|]/g, "_").trim() || `anlage-${index + 1}${fallbackExt}`;
    return {
      filename,
      contentType: attachment.contentType || "application/octet-stream",
      size: attachment.size || attachment.content?.length || 0,
      contentBase64: attachment.content ? Buffer.from(attachment.content).toString("base64") : undefined,
    };
  });

  return {
    id: makeImapEmailId(email, folderPath, uid),
    sender: repairDecodedText(sender.name || sender.email),
    senderEmail: sender.email,
    subject,
    date: (parsed.date || message.envelope?.date || new Date()).toISOString(),
    body,
    preview,
    isRead: flags.has("\\Seen"),
    isFlagged: flags.has("\\Flagged"),
    hasAttachment: attachments.length > 0,
    attachments,
    importance: "normal",
    folder: folderPath,
    accountEmail: email,
    recipientEmail: recipient.email,
    recipientName: repairDecodedText(recipient.name),
    imapUid: uid,
    imapFolder: folderPath,
    imapUidValidity: uidValidity,
  };
}

function mailCacheDir() {
  return process.env.UNIQUE_MAIL_CACHE_DIR || path.join(process.cwd(), ".uniquemail-cache");
}

function mailCachePath(email: string) {
  const safeName = Buffer.from(email.toLowerCase(), "utf8").toString("base64url");
  return path.join(mailCacheDir(), `${safeName}.json`);
}

async function readMailCache(email: string) {
  try {
    const raw = await fs.readFile(mailCachePath(email), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeMailCache(email: string, payload: unknown) {
  await fs.mkdir(mailCacheDir(), { recursive: true });
  await fs.writeFile(mailCachePath(email), JSON.stringify(jsonSafe(payload)), "utf8");
}
let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isBuiltServer = path.basename(process.argv[1] || "").toLowerCase() === "server.cjs";
  const isProduction = process.env.NODE_ENV === "production" || isBuiltServer;

  // Middleware to parse json
  app.use(express.json({ limit: "50mb" }));

  // API Route: Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/autodiscover", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email.includes("@")) {
        return res.status(400).json({ error: "Gueltige E-Mail-Adresse erforderlich." });
      }
      res.json(await autodiscoverSettings(email));
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Autodiscovery fehlgeschlagen." });
    }
  });

  app.get("/api/mail/cache/:email", async (req, res) => {
    const cached = await readMailCache(req.params.email);
    if (!cached) {
      return res.status(404).json({ error: "Kein lokaler Mailcache vorhanden." });
    }
    res.json(cached);
  });

  app.post("/api/mail/sync-inbox", async (req, res) => {
    const { email, password, imapServer, imapPort } = req.body as SyncInboxRequest;

    if (!email || !password || !imapServer || !imapPort) {
      return res.status(400).json({
        error: "E-Mail, Passwort, IMAP-Server und IMAP-Port sind erforderlich.",
      });
    }

    const client = createImapClient({ email, password, imapServer, imapPort });


    try {
      await client.connect();
      const folders = [];
      for (const folder of await client.list({
        statusQuery: {
          messages: true,
          unseen: true,
          uidNext: true,
          uidValidity: true
        }
      })) {
        folders.push({
          id: folder.path,
          path: folder.path,
          pathAsListed: folder.pathAsListed,
          label: folder.name || folder.path,
          delimiter: folder.delimiter,
          parent: folder.parent || [],
          parentPath: folder.parentPath || "",
          depth: folder.parent?.length || 0,
          flags: Array.from(folder.flags || []),
          specialUse: folder.specialUse || null,
          listed: folder.listed,
          subscribed: folder.subscribed,
          status: normalizeFolderStatus(folder.status)
        });
      }

      const cachedPayload = await readMailCache(email);
      const cachedEmails = Array.isArray(cachedPayload?.emails) ? cachedPayload.emails : [];
      const fetchedEmails = [];
      const selectableFolders = folders.filter(folder => !folder.flags.some(flag => flag.toLowerCase() === "\\noselect"));

      for (const folderInfo of selectableFolders) {
        let lock;
        try {
          lock = await client.getMailboxLock(folderInfo.path);
          const mailbox = client.mailbox;
          const total = mailbox ? mailbox.exists || 0 : 0;
          if (total === 0) continue;

          const uidValidity = (mailbox as any)?.uidValidity?.toString() || folderInfo.status?.uidValidity?.toString() || "";
          const cachedByUid = new Map<number, any>();
          for (const cachedMail of cachedEmails) {
            const cachedUid = getMailUid(cachedMail);
            if (!cachedUid) continue;
            const sameMailbox = sameFolder(cachedMail.folder || cachedMail.imapFolder, folderInfo.path);
            const sameUidValidity = !cachedMail.imapUidValidity || !uidValidity || cachedMail.imapUidValidity === uidValidity;
            if (sameMailbox && sameUidValidity) {
              cachedByUid.set(cachedUid, cachedMail);
            }
          }

          for await (const message of client.fetch("1:*", {
            uid: true,
            envelope: true,
            flags: true,
          })) {
            const uid = Number(message.uid);
            const cachedMail = cachedByUid.get(uid);
            if (cachedMail?.body) {
              fetchedEmails.push(updateEnvelopeFields(cachedMail, message, folderInfo.path, email, uidValidity));
            } else {
              fetchedEmails.push(buildEmailFromEnvelope(message, folderInfo.path, email, uidValidity));
            }
          }
        } catch (folderError: any) {
          console.warn("IMAP folder sync skipped", {
            email,
            folder: folderInfo.path,
            message: folderError?.message,
          });
        } finally {
          if (lock) {
            lock.release();
          }
        }
      }

      fetchedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const syncPayload = {
        emails: fetchedEmails,
        folders,
        syncedAt: new Date().toISOString()
      };
      await writeMailCache(email, syncPayload).catch((cacheError: any) => {
        console.warn("Mail cache write skipped", {
          email,
          message: cacheError?.message,
        });
      });
      res.json(syncPayload);
    } catch (error: any) {
      console.error("IMAP Sync Error:", {
        email,
        imapServer,
        imapPort,
        message: error?.message,
      });

      res.status(502).json({
        error: error?.message || "IMAP-Synchronisation fehlgeschlagen.",
      });
    } finally {
      await client.logout().catch(() => undefined);
    }
  });

  app.post("/api/mail/message-body", async (req, res) => {
    const { email, password, imapServer, imapPort, folder, uid } = req.body as MailBodyRequest;
    const uidNumber = Number(uid);

    if (!email || !password || !imapServer || !imapPort || !folder || !Number.isFinite(uidNumber) || uidNumber <= 0) {
      return res.status(400).json({ error: "E-Mail, Passwort, IMAP-Daten, Ordner und UID sind erforderlich." });
    }

    const client = createImapClient({ email, password, imapServer, imapPort });
    let lock;
    try {
      await client.connect();
      lock = await client.getMailboxLock(folder);
      const mailbox = client.mailbox;
      const uidValidity = (mailbox as any)?.uidValidity?.toString() || "";
      let parsedEmail: any = null;

      for await (const message of client.fetch([uidNumber], {
        uid: true,
        envelope: true,
        flags: true,
        source: true,
      }, { uid: true })) {
        parsedEmail = await buildEmailFromSource(message, folder, email, uidValidity);
        break;
      }

      if (!parsedEmail) {
        return res.status(404).json({ error: "Nachricht wurde im IMAP-Ordner nicht gefunden." });
      }

      const cached = await readMailCache(email);
      if (cached?.emails) {
        let replaced = false;
        cached.emails = cached.emails.map((mail: any) => {
          const cachedUid = getMailUid(mail);
          if (sameFolder(mail.folder || mail.imapFolder, folder) && cachedUid === uidNumber) {
            replaced = true;
            return { ...mail, ...parsedEmail };
          }
          return mail;
        });
        if (!replaced) cached.emails.push(parsedEmail);
        cached.syncedAt = new Date().toISOString();
        await writeMailCache(email, cached).catch((cacheError: any) => {
          console.warn("Mail body cache write skipped", { email, message: cacheError?.message });
        });
      }

      res.json({ email: parsedEmail });
    } catch (error: any) {
      res.status(502).json({ error: error?.message || "Nachrichtentext konnte nicht vom IMAP-Server geladen werden." });
    } finally {
      if (lock) lock.release();
      await client.logout().catch(() => undefined);
    }
  });

  app.post("/api/mail/send", async (req, res) => {
    const {
      email,
      password,
      imapServer,
      imapPort,
      smtpServer,
      smtpPort,
      from,
      to,
      cc,
      bcc,
      subject,
      html,
      text,
      sentFolder,
      attachments,
    } = req.body as SendMailRequest;

    const normalizedTo = normalizeAddressList(to);
    const normalizedCc = normalizeAddressList(cc);
    const normalizedBcc = normalizeAddressList(bcc);

    if (!email || !password || !smtpServer || !smtpPort || !from || !normalizedTo || !subject) {
      return res.status(400).json({ error: "Absender, Empfänger, Betreff, SMTP-Server und Passwort sind erforderlich." });
    }

    const mailOptions: Mail.Options = {
      from,
      to: normalizedTo,
      cc: normalizedCc || undefined,
      bcc: normalizedBcc || undefined,
      subject,
      html: html || "",
      text: text || toTextPreview(html || ""),
      attachments: buildSmtpAttachments(attachments),
    };

    const smtpTransporter = nodemailer.createTransport({
      host: smtpServer,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      requireTLS: Number(smtpPort) === 587,
      auth: {
        user: email,
        pass: password,
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    });

    try {
      const smtpInfo = await smtpTransporter.sendMail(mailOptions);
      let sentAppend: { ok: boolean; error?: string; folder?: string } = { ok: false };

      if (imapServer && imapPort && sentFolder) {
        try {
          const rawTransporter = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
          const rawInfo = await rawTransporter.sendMail(mailOptions);
          const rawMessage = Buffer.isBuffer(rawInfo.message) ? rawInfo.message : Buffer.from(String(rawInfo.message || ""));
          const imapClient = createImapClient({ email, password, imapServer, imapPort });
          await imapClient.connect();
          try {
            await imapClient.append(sentFolder, rawMessage, ["\\Seen"], new Date());
            sentAppend = { ok: true, folder: sentFolder };
          } finally {
            await imapClient.logout().catch(() => undefined);
          }
        } catch (appendError: any) {
          sentAppend = { ok: false, folder: sentFolder, error: appendError?.message || String(appendError) };
        }
      }

      res.json({
        ok: true,
        messageId: smtpInfo.messageId,
        accepted: smtpInfo.accepted || [],
        rejected: smtpInfo.rejected || [],
        response: smtpInfo.response,
        sentAppend,
        sentAt: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(502).json({ error: error?.message || "SMTP-Versand fehlgeschlagen." });
    }
  });
  app.post("/api/feedback/send", async (req, res) => {
    const type = req.body?.type === "feature" ? "feature" : "bug";
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();

    if (!title || !body) {
      return res.status(400).json({ error: "Titel und Beschreibung sind erforderlich." });
    }

    const host = process.env.UNIQUE_MAIL_FEEDBACK_SMTP_HOST;
    const port = Number(process.env.UNIQUE_MAIL_FEEDBACK_SMTP_PORT || 465);
    const user = process.env.UNIQUE_MAIL_FEEDBACK_SMTP_USER;
    const pass = process.env.UNIQUE_MAIL_FEEDBACK_SMTP_PASS;
    const from = process.env.UNIQUE_MAIL_FEEDBACK_FROM;
    const to = process.env.UNIQUE_MAIL_FEEDBACK_TO;

    const subjectPrefix = type === "feature" ? "Feature Request" : "Bug Report";

    if (!host || !user || !pass || !from || !to) {
      const feedbackDir = path.join(mailCacheDir(), "feedback-outbox");
      await fs.mkdir(feedbackDir, { recursive: true });
      const safeStamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeType = type === "feature" ? "feature" : "bug";
      const feedbackPath = path.join(feedbackDir, `${safeStamp}-${safeType}.json`);
      await fs.writeFile(feedbackPath, JSON.stringify({ type: subjectPrefix, title, body, createdAt: new Date().toISOString(), status: "pending-local-feedback-configuration" }, null, 2), "utf8");
      return res.json({ ok: true, queued: true, path: feedbackPath, message: "Feedback wurde lokal gespeichert. Für automatischen Versand bitte SMTP-Feedback konfigurieren." });
    }

    const feedbackTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      auth: { user, pass },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    });

    const messageBody = [body, "", "---", `Typ: ${subjectPrefix}`, `Gesendet: ${new Date().toISOString()}`, "Quelle: Unique Mail Desktop Feedback"].join("\n");

    try {
      const info = await feedbackTransporter.sendMail({ from, to, subject: title, text: messageBody });
      res.json({ ok: true, messageId: info.messageId, sentAt: new Date().toISOString() });
    } catch (error: any) {
      res.status(502).json({ error: error?.message || "Feedback konnte nicht gesendet werden." });
    }
  });
  app.post("/api/mail/messages/read-state", async (req, res) => {
    const { email, password, imapServer, imapPort, folder, isRead } = req.body as MailActionRequest;
    const uids = ensureUidList((req.body as MailActionRequest).uids);

    if (!email || !password || !imapServer || !imapPort || !folder || uids.length === 0 || typeof isRead !== "boolean") {
      return res.status(400).json({ error: "E-Mail, Passwort, IMAP-Daten, Ordner, UID-Liste und Lesestatus sind erforderlich." });
    }

    const client = createImapClient({ email, password, imapServer, imapPort });
    let lock;
    try {
      await client.connect();
      lock = await client.getMailboxLock(folder);
      if (isRead) {
        await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
      } else {
        await client.messageFlagsRemove(uids, ["\\Seen"], { uid: true });
      }

      const cached = await readMailCache(email);
      if (cached?.emails) {
        cached.emails = cached.emails.map((mail: any) => {
          const uid = getMailUid(mail);
          if (sameFolder(mail.folder || mail.imapFolder, folder) && uid && uids.includes(uid)) {
            return { ...mail, isRead };
          }
          return mail;
        });
        cached.syncedAt = new Date().toISOString();
        await writeMailCache(email, cached);
      }

      res.json({ ok: true, updated: uids.length });
    } catch (error: any) {
      res.status(502).json({ error: error?.message || "Lesestatus konnte nicht zum IMAP-Server synchronisiert werden." });
    } finally {
      if (lock) lock.release();
      await client.logout().catch(() => undefined);
    }
  });

  app.post("/api/mail/messages/move", async (req, res) => {
    const { email, password, imapServer, imapPort, folder, destinationFolder } = req.body as MailActionRequest;
    const uids = ensureUidList((req.body as MailActionRequest).uids);

    if (!email || !password || !imapServer || !imapPort || !folder || !destinationFolder || uids.length === 0) {
      return res.status(400).json({ error: "E-Mail, Passwort, IMAP-Daten, Quellordner, Zielordner und UID-Liste sind erforderlich." });
    }

    const client = createImapClient({ email, password, imapServer, imapPort });
    let lock;
    try {
      await client.connect();
      lock = await client.getMailboxLock(folder);
      const moveResult: any = await client.messageMove(uids, destinationFolder, { uid: true });
      const uidMap = moveResult?.uidMap instanceof Map
        ? Array.from(moveResult.uidMap.entries()).map(([from, to]) => ({ from: Number(from), to: Number(to) }))
        : [];

      const cached = await readMailCache(email);
      if (cached?.emails) {
        cached.emails = cached.emails.map((mail: any) => {
          const uid = getMailUid(mail);
          if (!sameFolder(mail.folder || mail.imapFolder, folder) || !uid || !uids.includes(uid)) {
            return mail;
          }
          const mapped = uidMap.find(item => item.from === uid);
          const nextUid = mapped?.to || uid;
          return {
            ...mail,
            id: makeImapEmailId(email, destinationFolder, nextUid),
            folder: destinationFolder,
            imapFolder: destinationFolder,
            imapUid: nextUid,
            imapUidValidity: mapped?.to ? moveResult?.uidValidity?.toString?.() || mail.imapUidValidity : mail.imapUidValidity,
          };
        });
        cached.syncedAt = new Date().toISOString();
        await writeMailCache(email, cached);
      }

      res.json({ ok: true, moved: uids.length, destinationFolder, uidMap });
    } catch (error: any) {
      res.status(502).json({ error: error?.message || "Nachrichten konnten nicht auf dem IMAP-Server verschoben werden." });
    } finally {
      if (lock) lock.release();
      await client.logout().catch(() => undefined);
    }
  });
  // API Route: Optimize Vacation Message
  app.post("/api/ai/optimize-vacation", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text ist erforderlich." });
      }

      const aiInstance = getAI();
      const response = await aiInstance.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Du bist ein professioneller Kommunikations-Experte.
Optimiere die folgende Abwesenheitsnotiz (Vacation Message) so, dass sie professionell, höflich, grammatikalisch einwandfrei und gut formuliert ist.
Behalte alle Daten, Namen und Kontaktdaten (z.B. Stellvertretung, E-Mail, Telefonnummer) EXAKT so bei wie im Originaltext. Falls kein Start- oder Enddatum genannt ist, lass die Nachricht allgemein oder nutze das vorliegende Muster.
Gib AUSSCHLIESSLICH den optimierten deutschen Antworttext zurück. Schreibe keine Erklärungen, keinen Betreff ("Betreff:") und keine Einleitung.

Originaltext:
"${text}"`
      });

      res.json({ optimized: response.text });
    } catch (error: any) {
      console.error("AI Optimize Error:", error);
      res.status(500).json({ error: error.message || "Fehler bei der KI-Optimierung" });
    }
  });

  // API Route: Generate/Refine Email Signature
  app.post("/api/ai/generate-signature", async (req, res) => {
    try {
      const { currentSignature, prompt } = req.body;
      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Anweisung/Prompt ist erforderlich." });
      }

      const aiInstance = getAI();
      const response = await aiInstance.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Du bist ein Experte für professionelle E-Mail-Kommunikation.
Erstelle oder überarbeite eine professionelle E-Mail-Signatur basierend auf folgenden Vorgaben:
1. Benutzer-Vorgabe / Prompt: "${prompt}"
2. Derzeitige Signatur (falls vorhanden): "${currentSignature || ''}"

Achte darauf, dass die Signatur perfekt formatiert ist, mit einer professionellen Struktur, eleganten Abgrenzungen (z.B. "---" oder "|"), sozialen Links (als Platzhalter oder wie im Prompt), und typischen Firmendaten. Verwende Platzhalter wie [Name], [Position], [Telefon], falls im Prompt keine konkreten Angaben gemacht wurden.
Gib AUSSCHLIESSLICH den finalen deutschen Text der fertigen Signatur zurück. Schreibe KEINE Erklärungen drumherum, keine Anmerkungen und keinen Einleitungstext ("Hier ist deine Signatur:").`
      });

      res.json({ signature: response.text });
    } catch (error: any) {
      console.error("AI Signature Error:", error);
      res.status(500).json({ error: error.message || "Fehler bei der Signatur-Generierung" });
    }
  });

  // Vite integration
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "127.0.0.1", () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : PORT;
    console.log(`Server running on http://127.0.0.1:${actualPort}`);
  });
}

startServer();




