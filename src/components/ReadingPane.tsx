/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Paperclip, Mail, Phone, MapPin, Building, Briefcase, Calendar, 
  Clock, CheckSquare, Code, Check, Send, Copy, FileText, ShieldAlert
} from 'lucide-react';
import { Email, Contact, Task, CalendarItem, CalendarItemDraft } from '../types';

export interface ComposeAttachmentPayload {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface ComposeMailPayload {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  attachments: ComposeAttachmentPayload[];
  accountEmail?: string;
  sourceId?: string;
}

export type ComposeMode = 'new' | 'reply' | 'replyAll' | 'forward' | 'draft' | 'outbox';

interface ReadingPaneProps {
  currentPage: 'mail' | 'calendar' | 'contacts' | 'crm' | 'tasks' | 'notes' | 'dev';
  emails: Email[];
  selectedEmailId: string | null;
  contacts: Contact[];
  selectedContactId: string | null;
  tasks: Task[];
  selectedTaskId: string | null;
  onChangeTaskPercent: (id: string, newPercent: number) => void;
  onMarkEmailAsRead: (id: string) => void;
  autoMarkAsReadOnOpen?: boolean;
  calendarItems: CalendarItem[];
  selectedCalendarId: string | null;
  isWritingEmail: boolean;
  setIsWritingEmail: (val: boolean) => void;
  composeMode: ComposeMode;
  onSendEmail: (message: ComposeMailPayload) => Promise<void> | void;
  onSaveDraft: (message: ComposeMailPayload) => void;
  onRetryOutboxEmail?: (id: string) => Promise<void> | void;
  onEditStoredEmail?: (id: string, mode: 'draft' | 'outbox') => void;
  onAddContact?: (contact: Contact) => void;
  onSetReminder?: (id: string) => void;
  onOpenEmailAttachment?: (id: string) => void;
  onToggleFlagCompleted?: (id: string) => void;
  onCreateCalendarItemForDate?: (date: Date, draft?: CalendarItemDraft) => void;
  signatureActive?: boolean;
  signatureText?: string;
  imageDownloadAllowList?: string[];
  imageDownloadDenyList?: string[];
  blockedSenderList?: string[];
  onAllowImagesForSender?: (sender: string) => void;
  onDenyImagesForSender?: (sender: string) => void;
  onBlockSender?: (sender: string) => void;
  attachmentDownloadDirectory?: string;
  accounts?: any[];
  activeAccountEmail?: string;
}

export default function ReadingPane({
  currentPage,
  emails,
  selectedEmailId,
  contacts,
  selectedContactId,
  tasks,
  selectedTaskId,
  onChangeTaskPercent,
  onMarkEmailAsRead,
  autoMarkAsReadOnOpen = true,
  calendarItems,
  selectedCalendarId,
  isWritingEmail,
  setIsWritingEmail,
  composeMode,
  onSendEmail,
  onSaveDraft,
  onRetryOutboxEmail,
  onEditStoredEmail,
  onAddContact,
  onSetReminder,
  onOpenEmailAttachment,
  onToggleFlagCompleted,
  onCreateCalendarItemForDate,
  signatureActive = false,
  signatureText = '',
  imageDownloadAllowList = [],
  imageDownloadDenyList = [],
  blockedSenderList = [],
  onAllowImagesForSender,
  onDenyImagesForSender,
  onBlockSender,
  attachmentDownloadDirectory = '',
  accounts = [],
  activeAccountEmail = ''
}: ReadingPaneProps) {
  // Local state for mail editor inputs
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [composeAccountEmail, setComposeAccountEmail] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subjectInput, setSubjectInput] = useState('');
  const [bodyInput, setBodyInput] = useState('');
  
  // Clipboard copy helper
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleCopyAddress = (address: string, id: string) => {
    if (!address) return;
    handleCopyCode(address, id);
  };

  // State to track hover actions toolbar coordinates
  const [imageActionPopup, setImageActionPopup] = useState<{
    url: string;
    x: number;
    y: number;
  } | null>(null);

  // State for right-click image operations context menu
  const [imageContextMenu, setImageContextMenu] = useState<{
    url: string;
    x: number;
    y: number;
  } | null>(null);
  const [manualImageLoadEmailIds, setManualImageLoadEmailIds] = useState<string[]>([]);

  const [calendarDraft, setCalendarDraft] = useState<{
    date: string;
    title: string;
    time: string;
    duration: string;
    location: string;
    description: string;
  } | null>(null);

  const formatCalendarInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  };

  const openCalendarDraft = (date: Date) => {
    setCalendarDraft({
      date: formatCalendarInputDate(date),
      title: '',
      time: '09:00',
      duration: '60',
      location: '',
      description: ''
    });
  };

  const saveCalendarDraft = () => {
    if (!calendarDraft?.title.trim()) return;
    const safeTime = calendarDraft.time || '09:00';
    const localStartValue = `${calendarDraft.date}T${safeTime}:00`;
    const start = new Date(localStartValue);
    if (Number.isNaN(start.getTime())) {
      alert('Der Termin konnte nicht gespeichert werden, weil Datum oder Uhrzeit ungültig sind.');
      return;
    }
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + (Number(calendarDraft.duration) || 60));
    const endDate = formatCalendarInputDate(end);
    const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    onCreateCalendarItemForDate?.(start, {
      title: calendarDraft.title.trim(),
      start: localStartValue,
      end: `${endDate}T${endTime}:00`,
      location: calendarDraft.location.trim(),
      description: calendarDraft.description.trim()
    });
    setCalendarDraft(null);
  };

  const activeEmail = React.useMemo(() => emails.find(e => e.id === selectedEmailId), [emails, selectedEmailId]);
  const activeContact = React.useMemo(() => contacts.find(c => c.id === selectedContactId), [contacts, selectedContactId]);
  const activeTask = React.useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);
  const activeCalendar = React.useMemo(() => calendarItems.find(c => c.id === selectedCalendarId), [calendarItems, selectedCalendarId]);
  const accountOptions = Array.isArray(accounts) ? accounts : [];
  const defaultComposeAccountEmail = activeEmail?.accountEmail || activeAccountEmail || accountOptions[0]?.email || '';
  const activeComposeAccount = accountOptions.find(acc => String(acc.email).toLowerCase() === String(composeAccountEmail || defaultComposeAccountEmail).toLowerCase()) || accountOptions[0];

  const normalizeSenderAddress = (value?: string) => (value || '').trim().toLowerCase();
  const activeSenderKey = normalizeSenderAddress(activeEmail?.senderEmail);
  const senderImagesAllowed = !!activeSenderKey && imageDownloadAllowList.some(entry => normalizeSenderAddress(entry) === activeSenderKey);
  const senderImagesDenied = !!activeSenderKey && imageDownloadDenyList.some(entry => normalizeSenderAddress(entry) === activeSenderKey);
  const senderIsBlocked = !!activeSenderKey && blockedSenderList.some(entry => normalizeSenderAddress(entry) === activeSenderKey);
  const remoteImagePattern = /<img\b(?=[^>]*\bsrc\s*=\s*(?:"https?:\/\/|'https?:\/\/|https?:\/\/|"\/\/|'\/\/|\/\/))[^>]*>/i;
  const remoteImageReplacePattern = /<img\b(?=[^>]*\bsrc\s*=\s*(?:"https?:\/\/|'https?:\/\/|https?:\/\/|"\/\/|'\/\/|\/\/))[^>]*>/gi;
  const mailHasRemoteImages = !!activeEmail && remoteImagePattern.test(activeEmail.body || '');
  const imagesManuallyLoaded = !!activeEmail && manualImageLoadEmailIds.includes(activeEmail.id);
  const shouldRenderRemoteImages = mailHasRemoteImages && !senderIsBlocked && !senderImagesDenied && (senderImagesAllowed || imagesManuallyLoaded);
  const maskRemoteImages = (html: string) => html.replace(remoteImageReplacePattern, () =>
    '<div style="border:1px dashed #f59e0b;background:#fffbeb;color:#92400e;padding:10px 12px;border-radius:8px;font:12px sans-serif;margin:8px 0;">Externe Bilder und Inhalte wurden blockiert. Nutzen Sie oben die Bildfreigabe, wenn Sie diesem Absender vertrauen.</div>'
  );
  const sanitizeMailHtml = (html: string) => html
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/<\/?(?:html|body)\b[^>]*>/gi, '')
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\sstyle=("|')([\s\S]*?)\1/gi, (_match, quote, style) => {
      const cleanedStyle = String(style)
        .replace(/position\s*:\s*(fixed|absolute|sticky)\s*;?/gi, '')
        .replace(/z-index\s*:\s*\d+\s*;?/gi, '')
        .replace(/min-width\s*:\s*(?:\d{4,}px|100vw)\s*;?/gi, '')
        .replace(/width\s*:\s*100vw\s*;?/gi, '')
        .trim();
      return cleanedStyle ? ` style=${quote}${cleanedStyle}${quote}` : '';
    });
  const rawEmailBodyForDisplay = activeEmail && mailHasRemoteImages && !shouldRenderRemoteImages
    ? maskRemoteImages(activeEmail.body || '')
    : (activeEmail?.body || '');
  const rawEmailBodyLooksHtml = /^\\s*</.test(rawEmailBodyForDisplay) || /<[a-z][\\s\\S]*>/i.test(rawEmailBodyForDisplay);
  const activeEmailBodyForDisplay = rawEmailBodyLooksHtml
    ? sanitizeMailHtml(rawEmailBodyForDisplay)
    : rawEmailBodyForDisplay;
  const formatAddressList = (value?: string) => (value || '')
    .split(/[;,]/)
    .map(part => part.trim())
    .filter(Boolean)
    .join(', ');
  const deriveDisplayNameFromAddress = (value: string) => {
    const first = value.split(/[;,]/)[0]?.trim() || '';
    const bracketMatch = first.match(/^(.+?)\s*<[^>]+>$/);
    const rawName = bracketMatch?.[1]?.replace(/^["']|["']$/g, '').trim();
    if (rawName) return rawName;
    const addressOnly = first.match(/<([^>]+)>/)?.[1] || first;
    return addressOnly.includes('@') ? addressOnly.split('@')[0] : addressOnly;
  };
  const activeMailFolderKey = (activeEmail?.folder || activeEmail?.imapFolder || '').toLowerCase();
  const activeEmailIsOutgoing = /sent|gesendet|outbox|postausgang|draft|entwurf/.test(activeMailFolderKey);
  const activeRecipientEmail = formatAddressList(activeEmail?.recipientEmail)
    || (activeEmailIsOutgoing ? '' : formatAddressList(activeEmail?.accountEmail));
  const activeRecipientName = (activeEmail?.recipientName && activeEmail.recipientName !== activeRecipientEmail ? activeEmail.recipientName : '')
    || (activeRecipientEmail ? deriveDisplayNameFromAddress(activeRecipientEmail) : activeEmailIsOutgoing ? 'Kein Empfaenger' : 'Eigenes Konto');
  const activeRecipientLine = activeRecipientEmail ? activeRecipientName + ' <' + activeRecipientEmail + '>' : activeRecipientName;

  // Helper to copy dynamic image URL or blob to clipboard
  const triggerImageCopy = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      alert('Bild erfolgreich in Ihre Windows/Mac Zwischenablage kopiert! Sie können es nun mit Strg + V in Word, Outlook oder Paint einfügen.');
    } catch (e) {
      // Fallback: Copy Image URL if clipboard fetch blocks
      try {
        await navigator.clipboard.writeText(url);
        alert('Bild-Adresse kopiert! (Sicherheits-Fallback der Browser API)');
      } catch (err) {
        alert('Zwischenablage blockiert. Kopieren Sie das Bild manuell.');
      }
    }
  };

  // Helper to trigger save dialog
  const triggerImageSave = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unique_mail_saved_image.jpg';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Hook to bind event listeners on any rendered images within rich mail content
  React.useEffect(() => {
    setImageActionPopup(null);
    setImageContextMenu(null);

    // Timeout allows DOM parsing of dangerouslySetInnerHTML to complete
    const timeout = setTimeout(() => {
      const richBody = document.querySelector('.rich-email-content');
      if (!richBody) return;

      const links = richBody.querySelectorAll('a[href]');
      links.forEach((link) => {
        const handleLinkClick = (event: Event) => {
          const href = (link as HTMLAnchorElement).href;
          if (!href) return;
          event.preventDefault();
          event.stopPropagation();
          const nativeApi = (window as any).uniqueMailNative;
          if (nativeApi?.openExternal) nativeApi.openExternal(href);
          else window.open(href, '_blank', 'noopener,noreferrer');
        };
        link.addEventListener('click', handleLinkClick);
      });
      const imgs = richBody.querySelectorAll('img');
      imgs.forEach((img) => {
        // Style and configure image
        img.style.cursor = 'context-menu';
        img.style.outline = 'none';
        img.tabIndex = 0; // Enables keyboard focus and Ctrl+C capture

        const handleMouseEnter = (event: MouseEvent) => {
          const rect = img.getBoundingClientRect();
          const pane = document.getElementById('email-details-pane');
          if (pane) {
            const paneRect = pane.getBoundingClientRect();
            // Align relative to relative parent container 'email-details-pane'
            setImageActionPopup({
              url: img.src,
              x: rect.right - paneRect.left - 130,
              y: rect.top - paneRect.top + 10
            });
          }
        };

        const handleContextMenu = (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const pane = document.getElementById('email-details-pane');
          if (pane) {
            const paneRect = pane.getBoundingClientRect();
            setImageContextMenu({
              url: img.src,
              x: event.clientX - paneRect.left,
              y: event.clientY - paneRect.top
            });
            setImageActionPopup(null); // Clear hover toolbar
          }
        };

        const handleClick = (e: MouseEvent) => {
          e.stopPropagation();
          img.focus();
          // Visual selection ring indicator
          img.style.outline = '3px solid #0078d4';
          img.style.outlineOffset = '2px';
        };

        const handleBlur = () => {
          img.style.outline = 'none';
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          // Detect Ctrl+C or Cmd+C copy triggers
          if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            triggerImageCopy(img.src);
          }
        };

        img.addEventListener('mouseenter', handleMouseEnter);
        img.addEventListener('contextmenu', handleContextMenu);
        img.addEventListener('click', handleClick);
        img.addEventListener('blur', handleBlur);
        img.addEventListener('keydown', handleKeyDown);
      });
    }, 200);

    return () => clearTimeout(timeout);
  }, [activeEmailBodyForDisplay, selectedEmailId, currentPage]);

  // General click handler dismisses active contextual popup overlays
  React.useEffect(() => {
    const handleGlobalClick = () => {
      setImageContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Mark email as read once opened
  React.useEffect(() => {
    if (autoMarkAsReadOnOpen && currentPage === 'mail' && activeEmail && !activeEmail.isRead) {
      onMarkEmailAsRead(activeEmail.id);
    }
  }, [selectedEmailId, currentPage, autoMarkAsReadOnOpen]);

  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [composeAttachments, setComposeAttachments] = React.useState<File[]>([]);
  const [storedAttachmentPayloads, setStoredAttachmentPayloads] = React.useState<ComposeAttachmentPayload[]>([]);
  const [previewAttachment, setPreviewAttachment] = React.useState<{ name: string; type: string; size?: number; url: string } | null>(null);
  const [attachmentContextMenu, setAttachmentContextMenu] = React.useState<{ x: number; y: number; attachment: { filename: string; contentType?: string; size?: number; contentBase64?: string } } | null>(null);
  const [isSendingMessage, setIsSendingMessage] = React.useState(false);

  React.useEffect(() => {
    if (!previewAttachment) return;
    const handlePreviewKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewAttachment(null);
    };
    window.addEventListener('keydown', handlePreviewKeyDown);
    return () => window.removeEventListener('keydown', handlePreviewKeyDown);
  }, [previewAttachment]);

  const fileToAttachmentPayload = (file: File) => new Promise<ComposeAttachmentPayload>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        contentBase64: value.includes(',') ? value.split(',').pop() || '' : value,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Anlage konnte nicht gelesen werden.'));
    reader.readAsDataURL(file);
  });

  const base64ToBlobUrl = (contentBase64: string, contentType = 'application/octet-stream') => {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return URL.createObjectURL(new Blob([bytes], { type: contentType }));
  };

  const getAttachmentPreviewType = (filename: string, contentType?: string) => {
    const normalizedType = (contentType || '').toLowerCase();
    const lowerName = filename.toLowerCase();
    if (lowerName.endsWith('.pdf') || normalizedType.includes('pdf')) return 'application/pdf';
    if (lowerName.match(/\.(png|jpe?g|gif|webp|bmp)$/) || normalizedType.startsWith('image/')) return normalizedType || 'image/png';
    if (lowerName.match(/\.(docx?|rtf)$/)) return contentType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lowerName.match(/\.(xlsx?|csv)$/)) return contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return contentType || 'application/octet-stream';
  };

  const startAttachmentDragOut = (event: React.DragEvent, attachment: { filename: string; contentType?: string; size?: number; contentBase64?: string }) => {
    if (!attachment.contentBase64) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', attachment.filename);
    const nativeApi = (window as any).uniqueMailNative;
    nativeApi?.startAttachmentDrag?.({ attachment });
  };

  const saveAttachmentToDisk = async (attachment: { filename: string; contentType?: string; size?: number; contentBase64?: string }) => {
    if (!attachment.contentBase64) {
      alert('Diese Anlage ist noch nicht vollständig lokal geladen. Bitte Nachricht aktualisieren und erneut versuchen.');
      return;
    }
    const nativeApi = (window as any).uniqueMailNative;
    const result = await nativeApi?.saveAttachment?.({ attachment, directory: attachmentDownloadDirectory });
    if (result?.ok) alert(`Anlage gespeichert: ${result.filePath}`);
    else alert(result?.error || 'Anlage konnte nicht gespeichert werden.');
  };

  const saveAllAttachmentsToDisk = async () => {
    const attachments = (activeEmail?.attachments || []).filter(item => item.contentBase64);
    if (attachments.length === 0) {
      alert('Keine vollständig geladenen Anlagen zum Speichern gefunden. Bitte Nachricht aktualisieren und erneut versuchen.');
      return;
    }
    const nativeApi = (window as any).uniqueMailNative;
    const result = await nativeApi?.saveAttachments?.({ attachments, directory: attachmentDownloadDirectory });
    if (result?.ok) alert(`${result.filePaths.length} Anlage(n) gespeichert in: ${result.directory}`);
    else alert(result?.error || 'Anlagen konnten nicht gespeichert werden.');
  };
  const openFilePreview = (file: File) => {
    setPreviewAttachment({
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      url: URL.createObjectURL(file),
    });
  };

  const openPayloadPreview = (attachment: { filename: string; contentType?: string; size?: number; contentBase64?: string }) => {
    if (!attachment.contentBase64) {
      alert('Diese Anlage ist noch nicht vollständig lokal geladen. Bitte Nachricht aktualisieren und erneut versuchen.');
      return;
    }
    const contentType = getAttachmentPreviewType(attachment.filename, attachment.contentType);
    setPreviewAttachment({
      name: attachment.filename,
      type: contentType,
      size: attachment.size,
      url: base64ToBlobUrl(attachment.contentBase64, contentType),
    });
  };

  const addComposeFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList);
    setComposeAttachments(prev => {
      const existing = new Set(prev.map(file => `${file.name}-${file.size}-${file.lastModified}`));
      return [...prev, ...incoming.filter(file => !existing.has(`${file.name}-${file.size}-${file.lastModified}`))];
    });
  };

  const splitAddressList = (value?: string) => (value || '')
    .split(/[;,]/)
    .map(part => part.trim())
    .filter(Boolean);

  const normalizeAddress = (value?: string) => {
    const match = String(value || '').match(/<([^>]+)>/);
    return (match ? match[1] : String(value || '')).trim().toLowerCase();
  };

  const uniqueAddressList = (values: string[], ownAddress?: string) => {
    const own = normalizeAddress(ownAddress);
    const seen = new Set<string>();
    return values.filter(value => {
      const normalized = normalizeAddress(value);
      if (!normalized || normalized === own || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  };

  // Handle auto-population of replies, forwards, drafts and outbox messages.
  React.useEffect(() => {
    if (isWritingEmail) {
      setComposeAttachments([]);
      setStoredAttachmentPayloads([]);
      const signatureHtml = signatureActive && signatureText 
        ? `<br/><br/><div style="color:#222; font-family:sans-serif; font-size:12px;">${signatureText.replace(/\n/g, '<br/>')}</div>` 
        : '';

      if (activeEmail && (composeMode === 'draft' || composeMode === 'outbox')) {
        setToInput(activeEmail.recipientEmail || '');
        setCcInput(activeEmail.ccEmail || '');
        setBccInput(activeEmail.bccEmail || '');
        setShowCcBcc(!!(activeEmail.ccEmail || activeEmail.bccEmail));
        setSubjectInput(activeEmail.subject || '');
        setStoredAttachmentPayloads(activeEmail.draftAttachments || []);
        setBodyInput(activeEmail.body || '');
        if (editorRef.current) {
          editorRef.current.innerHTML = activeEmail.body || '';
        }
      } else if (activeEmail && composeMode === 'forward') {
        setToInput('');
        setCcInput('');
        setBccInput('');
        setShowCcBcc(false);
        setSubjectInput(activeEmail.subject.startsWith('FW:') ? activeEmail.subject : `FW: ${activeEmail.subject}`);
        const forwardTemplate = `<br/><br/>${signatureHtml}<br/><br/><div style="border-top:1px solid #e0e0e0; padding-top:10px; margin-top:20px; color:#555555; font-size:11px; font-family:sans-serif;"><b>Weitergeleitete Nachricht:</b><br/><b>Von:</b> ${activeEmail.sender} &lt;${activeEmail.senderEmail}&gt;<br/><b>Datum:</b> ${new Date(activeEmail.date).toLocaleString('de-DE')}<br/><b>Betreff:</b> ${activeEmail.subject}<br/><br/>${activeEmail.body.replace(/\n/g, '<br/>')}</div>`;
        setBodyInput(forwardTemplate);
        if (editorRef.current) {
          editorRef.current.innerHTML = forwardTemplate;
        }
      } else if (activeEmail && (composeMode === 'reply' || composeMode === 'replyAll')) {
        const ownAddress = activeEmail.accountEmail || defaultComposeAccountEmail;
        const replyAllRecipients = uniqueAddressList([
          activeEmail.senderEmail || activeEmail.sender,
          ...(composeMode === 'replyAll' ? splitAddressList(activeEmail.recipientEmail) : []),
        ], ownAddress);
        const replyAllCcRecipients = composeMode === 'replyAll'
          ? uniqueAddressList(splitAddressList(activeEmail.ccEmail), ownAddress).filter(address => !replyAllRecipients.some(toAddress => normalizeAddress(toAddress) === normalizeAddress(address)))
          : [];
        setToInput(replyAllRecipients.join(', '));
        setCcInput(replyAllCcRecipients.join(', '));
        setBccInput('');
        setShowCcBcc(replyAllCcRecipients.length > 0);
        setSubjectInput(activeEmail.subject.startsWith('RE:') ? activeEmail.subject : `RE: ${activeEmail.subject}`);
        const replyTemplate = `<br/><br/>${signatureHtml}<br/><br/><div style="border-top:1px solid #e0e0e0; padding-top:10px; margin-top:20px; color:#555555; font-size:11px; font-family:sans-serif;"><b>Ursprüngliche Nachricht:</b><br/><b>Von:</b> ${activeEmail.sender} &lt;${activeEmail.senderEmail}&gt;<br/><b>Datum:</b> ${new Date(activeEmail.date).toLocaleString('de-DE')}<br/><b>Betreff:</b> ${activeEmail.subject}<br/><br/>${activeEmail.body.replace(/\n/g, '<br/>')}</div>`;
        setBodyInput(replyTemplate);
        if (editorRef.current) {
          editorRef.current.innerHTML = replyTemplate;
        }
      } else {
        setToInput('');
        setCcInput('');
        setBccInput('');
        setShowCcBcc(false);
        setSubjectInput('');
        const initialComposeHtml = `<br/><br/>${signatureHtml}`;
        setBodyInput(initialComposeHtml);
        if (editorRef.current) {
          editorRef.current.innerHTML = initialComposeHtml;
        }
      }
    }
  }, [isWritingEmail, selectedEmailId, composeMode, signatureActive, signatureText, defaultComposeAccountEmail, accountOptions.length]);

  // Command executor for document design mode (Rich Text capabilities)
  const applyStyle = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setBodyInput(editorRef.current.innerHTML);
    }
  };

  // Helper detect HTML mail content
  const isHtml = (text: string) => {
    const trimmed = (text || '').trim();
    return trimmed.startsWith('<') || /<[a-z][\s\S]*>/i.test(trimmed);
  };

  // --- 1. NEW EMAIL WRITING PANEL ---
  if (isWritingEmail && currentPage === 'mail') {
    return (
      <div id="new-email-writer" className="flex-1 bg-white dark:bg-[#0f172a] flex flex-col h-full font-sans border-t md:border-t-0 select-none pb-4 overflow-y-auto">
        {/* Editor Ribbon Quick Action Menu */}
        <div className="bg-slate-50 dark:bg-[#0b0f19] border-b border-slate-200 dark:border-[#1e293b] px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 w-full shrink-0">
          <span className="tracking-wide text-[10.5px] uppercase">E-Mail verfassen (Classic Rich-Text)</span>
          <button 
            onClick={() => setIsWritingEmail(false)}
            className="text-slate-400 hover:text-red-500 dark:text-slate-450 font-mono font-bold text-sm transition-colors cursor-pointer"
          >
            x
          </button>
        </div>

        {/* Input fields */}
        <div className="p-5 space-y-4 border-b border-slate-200 dark:border-[#1e293b] bg-slate-50/35 dark:bg-[#0f172a]/50 shrink-0">
          {accountOptions.length > 1 && (
            <div className="grid grid-cols-[60px_1fr] items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Von:</span>
              <select
                value={composeAccountEmail || defaultComposeAccountEmail}
                onChange={(event) => setComposeAccountEmail(event.target.value)}
                className="px-3 py-1.5 border border-slate-200 dark:border-[#334155] rounded-xl bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-[11.5px] transition-all font-mono"
              >
                {accountOptions.map(account => (
                  <option key={account.email} value={account.email}>{account.displayName || account.senderName || account.email} &lt;{account.email}&gt;</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-[60px_1fr] items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">An:</span>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-slate-200 dark:border-[#334155] rounded-xl bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-[11.5px] transition-all font-mono"
                placeholder="empfaenger@domain.de"
              />
              <button
                type="button"
                onClick={() => setShowCcBcc(prev => !prev)}
                className="px-2.5 py-1.5 text-[10.5px] font-bold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                CC/BCC
              </button>
            </div>
          </div>
          {showCcBcc && (
            <>
              <div className="grid grid-cols-[60px_1fr] items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">CC:</span>
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-[#334155] rounded-xl bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-[11.5px] transition-all font-mono"
                  placeholder="kopie@domain.de"
                />
              </div>
              <div className="grid grid-cols-[60px_1fr] items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">BCC:</span>
                <input
                  type="text"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 dark:border-[#334155] rounded-xl bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-[11.5px] transition-all font-mono"
                  placeholder="blindkopie@domain.de"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-[60px_1fr] items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Betreff:</span>
            <input 
              type="text" 
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-[#334155] rounded-xl bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0078d4]/10 focus:border-[#0078d4] text-[11.5px] transition-all"
              placeholder="Betreffzeile"
            />
          </div>
        </div>

        {/* Dynamic Rich Text Format Bar inside compose area */}
        <div className="p-4 px-5 space-y-3 flex-1 flex flex-col bg-white dark:bg-[#0f172a] min-h-[350px]">
          {/* Classic Outlook Format Ribbon Toolbar */}
          <div className="bg-slate-50 dark:bg-[#1e293b]/70 border border-slate-220 dark:border-[#334155] rounded-t-xl p-2.5 flex flex-wrap items-center gap-1.5 select-none shrink-0 shadow-inner-sm">
            <span className="text-[9px] font-extrabold uppercase text-slate-400 px-1">Schrift</span>
            <button
              type="button"
              onClick={() => applyStyle('bold')}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#0b0f19] hover:bg-slate-200 dark:hover:bg-[#334155] rounded-lg font-bold text-xs shadow-xs text-slate-800 dark:text-slate-100 cursor-pointer transition-all border border-slate-200 dark:border-slate-800 active:scale-90"
              title="Fett (Strg+B)"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => applyStyle('italic')}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#0b0f19] hover:bg-slate-200 dark:hover:bg-[#334155] rounded-lg italic text-xs shadow-xs text-slate-800 dark:text-slate-100 cursor-pointer transition-all border border-slate-200 dark:border-slate-800 active:scale-90"
              title="Kursiv (Strg+I)"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => applyStyle('underline')}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#0b0f19] hover:bg-slate-200 dark:hover:bg-[#334155] rounded-lg underline text-xs shadow-xs text-slate-800 dark:text-slate-100 cursor-pointer transition-all border border-slate-200 dark:border-slate-800 active:scale-90"
              title="Unterstrichen (Strg+U)"
            >
              U
            </button>
            <button
              type="button"
              onClick={() => applyStyle('strikeThrough')}
              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-[#0b0f19] hover:bg-slate-200 dark:hover:bg-[#334155] rounded-lg text-slate-400 hover:text-slate-700 line-through text-xs shadow-xs cursor-pointer transition-all border border-slate-200 dark:border-slate-800 active:scale-90"
              title="Durchgestrichen"
            >
              ab
            </button>
            
            <span className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></span>
            <span className="text-[9px] font-extrabold uppercase text-slate-400 px-1">Absatz</span>

            {/* Paragraph alignments */}
            <button
              type="button"
              onClick={() => applyStyle('justifyLeft')}
              className="px-2 h-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#334155] rounded-md text-[10.5px] text-slate-600 dark:text-slate-350 cursor-pointer"
              title="Linksbündig"
            >
              L-Ausrichten
            </button>
            <button
              type="button"
              onClick={() => applyStyle('justifyCenter')}
              className="px-2 h-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#334155] rounded-md text-[10.5px] text-slate-600 dark:text-slate-350 cursor-pointer"
              title="Zentriert"
            >
              Zentriert
            </button>
            <button
              type="button"
              onClick={() => applyStyle('justifyRight')}
              className="px-2 h-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#334155] rounded-md text-[10.5px] text-slate-600 dark:text-slate-350 cursor-pointer"
              title="Rechtsbündig"
            >
              R-Ausrichten
            </button>

            <span className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></span>

            {/* Bullet lists */}
            <button
              type="button"
              onClick={() => applyStyle('insertUnorderedList')}
              className="px-2 h-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#334155] rounded-md text-[10.5px] text-slate-600 dark:text-slate-350 cursor-pointer"
              title="Aufzählung"
            >
              * Liste
            </button>
            <button
              type="button"
              onClick={() => applyStyle('insertOrderedList')}
              className="px-2 h-8 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-[#334155] rounded-md text-[10.5px] text-slate-600 dark:text-slate-350 cursor-pointer"
              title="Nummerierung"
            >
              1. Liste
            </button>

            <span className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></span>

            {/* Dynamic Font Sizes */}
            <select
              onChange={(e) => applyStyle('fontSize', e.target.value)}
              className="bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white border border-slate-200 dark:border-[#334155] text-[10.5px] p-1 h-8 rounded-lg max-w-[90px] font-bold focus:outline-none cursor-pointer"
              defaultValue="3"
            >
              <option value="1">Winzig</option>
              <option value="2">Klein</option>
              <option value="3">Normal</option>
              <option value="4">Mittel</option>
              <option value="5">Groß</option>
              <option value="6">Riesig</option>
            </select>

            {/* Solid Text Color Palette */}
            <div className="flex items-center space-x-1.5 pl-1.5 shrink-0">
              {[
                { color: '#000000', bg: 'bg-black' },
                { color: '#0078d4', bg: 'bg-[#0078d4]' },
                { color: '#dc2626', bg: 'bg-red-600' },
                { color: '#16a34a', bg: 'bg-green-600' },
                { color: '#7c3aed', bg: 'bg-purple-600' }
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => applyStyle('foreColor', c.color)}
                  className={`w-3.5 h-3.5 rounded-full ${c.bg} border border-slate-200/50 hover:scale-115 cursor-pointer`}
                  title={`Farbe: ${c.color}`}
                />
              ))}
            </div>

            <span className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></span>

            <button
              type="button"
              onClick={() => applyStyle('removeFormat')}
              className="px-2 h-8 text-[10.5px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-lg ml-auto cursor-pointer"
              title="Löscht alle Formatierungen"
            >
              Format aufheben
            </button>
          </div>

          {/* Interactive Composition Zone */}
          <div 
            ref={editorRef}
            contentEditable
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) {
                addComposeFiles(e.dataTransfer.files);
              }
            }}
            onBlur={() => {
              if (editorRef.current) {
                setBodyInput(editorRef.current.innerHTML);
              }
            }}
            className="w-full flex-1 p-5 border-x border-b border-slate-200 dark:border-[#334155] rounded-b-xl focus:outline-none focus:ring-1 focus:ring-[#0078d4] text-[12.5px] select-text font-sans bg-white dark:bg-[#1e293b] text-slate-800 dark:text-white overflow-y-auto leading-relaxed outline-none min-h-[300px]"
            style={{ minHeight: '300px' }}
            placeholder="Geben Sie Ihren E-Mail Nachrichtentext ein..."
          />

          <div className="border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-[#0b0f19]/70 rounded-xl p-3 text-[11px] text-slate-500 dark:text-slate-350">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  addComposeFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Anlagen hier ablegen oder Datei auswählen</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-white dark:bg-[#1e293b] border border-slate-250 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Anlage hinzufügen
              </button>
            </div>
            {(storedAttachmentPayloads.length > 0 || composeAttachments.length > 0) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {storedAttachmentPayloads.map((file) => (
                  <span key={`stored-${file.filename}-${file.contentBase64.length}`} className="inline-flex items-center gap-1.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold text-slate-700 dark:text-slate-200">
                    <span title="Gespeicherte Anlage">{file.filename}</span>
                    <button
                      type="button"
                      onClick={() => setStoredAttachmentPayloads(prev => prev.filter(item => item !== file))}
                      className="text-slate-400 hover:text-red-500 font-bold"
                    >
                      x
                    </button>
                  </span>
                ))}
                {composeAttachments.map((file) => (
                  <span key={`${file.name}-${file.size}-${file.lastModified}`} className="inline-flex items-center gap-1.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold text-slate-700 dark:text-slate-200">
                    <button
                      type="button"
                      onClick={() => openFilePreview(file)}
                      className="hover:text-[#0078d4] font-semibold"
                      title="Vorschau öffnen"
                    >
                      {file.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => setComposeAttachments(prev => prev.filter(item => item !== file))}
                      className="text-slate-400 hover:text-red-500 font-bold"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          {previewAttachment && (
            <div className="fixed inset-8 z-[9999] bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-xl flex flex-col overflow-hidden">
              <div className="h-10 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                <span>{previewAttachment.name}</span>
                <button type="button" onClick={() => setPreviewAttachment(null)} className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg leading-none text-slate-600 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm flex items-center justify-center font-black" title="Vorschau schliessen (Esc)">X</button>
              </div>
              <div className="flex-1 bg-slate-50 dark:bg-[#020617] p-4">
                {previewAttachment.type === 'application/pdf' || previewAttachment.type.startsWith('image/') ? (
                  <iframe title="Anlagenvorschau" src={previewAttachment.url} className="w-full h-full bg-white border border-slate-200 rounded-lg" />
                ) : (
                  <div className="h-full flex items-center justify-center text-center text-xs text-slate-500">
                    <div>
                      <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                      <p className="font-bold text-slate-700 dark:text-slate-200">{previewAttachment.name}</p>
                      <p className="mt-1">{Math.max(1, Math.round((previewAttachment.size || 0) / 1024))} KB</p>
                      <p className="mt-3 max-w-sm">Office-Dateien werden als Anlage erkannt. Eine echte Word-/Excel-Inhaltsvorschau braucht noch einen lokalen Konverter oder Office-WebView-Anbindung.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between mt-4 shrink-0">
            <div className="text-[10px] text-slate-400 font-mono font-semibold">
              OUTBOX-QUEUE: Bei Verbindungsstörungen automatisch gepuffert
            </div>
            <div className="flex space-x-2.5">
              <button 
                onClick={() => setIsWritingEmail(false)}
                disabled={isSendingMessage}
                className="px-4.5 py-2 border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1e293b] rounded-lg text-xs transition-colors font-semibold text-slate-650 dark:text-slate-300 cursor-pointer disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isSendingMessage}
                onClick={async () => {
                  const finalHtml = editorRef.current ? editorRef.current.innerHTML : bodyInput;
                  setIsSendingMessage(true);
                  try {
                    const freshAttachments = await Promise.all(composeAttachments.map(fileToAttachmentPayload));
                    onSaveDraft({
                      to: toInput,
                      cc: ccInput,
                      bcc: bccInput,
                      subject: subjectInput,
                      body: finalHtml,
                      attachments: [...storedAttachmentPayloads, ...freshAttachments],
                      accountEmail: composeAccountEmail || defaultComposeAccountEmail,
                      sourceId: activeEmail && (composeMode === 'draft' || composeMode === 'outbox') ? activeEmail.id : undefined,
                    });
                    setComposeAttachments([]);
                    setIsWritingEmail(false);
                  } catch (error: any) {
                    alert(`Entwurf konnte nicht gespeichert werden:\n\n${error?.message || error}`);
                  } finally {
                    setIsSendingMessage(false);
                  }
                }}
                className="px-4.5 py-2 border border-slate-200 dark:border-[#334155] hover:bg-slate-50 dark:hover:bg-[#1e293b] rounded-lg text-xs transition-colors font-semibold text-slate-650 dark:text-slate-300 cursor-pointer disabled:opacity-60"
              >
                Entwurf speichern
              </button>
              <button 
                disabled={isSendingMessage}
                onClick={async () => {
                  if (!toInput.trim()) {
                    alert('Bitte mindestens einen Empfänger eintragen.');
                    return;
                  }
                  const finalHtml = editorRef.current ? editorRef.current.innerHTML : bodyInput;
                  setIsSendingMessage(true);
                  try {
                    const freshAttachments = await Promise.all(composeAttachments.map(fileToAttachmentPayload));
                    await onSendEmail({
                      to: toInput,
                      cc: ccInput,
                      bcc: bccInput,
                      subject: subjectInput,
                      body: finalHtml,
                      attachments: [...storedAttachmentPayloads, ...freshAttachments],
                      accountEmail: composeAccountEmail || defaultComposeAccountEmail,
                      sourceId: activeEmail && (composeMode === 'draft' || composeMode === 'outbox') ? activeEmail.id : undefined,
                    });
                    setComposeAttachments([]);
                    setStoredAttachmentPayloads([]);
                    setIsWritingEmail(false);
                  } catch (error: any) {
                    alert(`Senden fehlgeschlagen:\n\n${error?.message || error}`);
                  } finally {
                    setIsSendingMessage(false);
                  }
                }}
                className="px-5.5 py-2 bg-[#0078d4] hover:bg-[#005a9e] text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingMessage ? 'Sende...' : 'Senden (SMTP TLS)'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- 2. EMAIL DETAILS PANEL ---
  if (currentPage === 'mail') {
    if (!activeEmail) {
      return (
        <div id="no-mail-pane" className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
          <Mail className="w-16 h-16 text-slate-300 stroke-1 mb-4" />
          <h3 className="text-sm font-bold text-slate-600">Keine E-Mail ausgewählt</h3>
          <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-5">
            Wählen Sie ein Mail-Element aus der Masterliste aus, um die Details anzusehen.
          </p>
        </div>
      );
    }

    return (
      <div id="mail-reading-pane" className="flex-1 bg-white flex flex-col h-full overflow-y-auto font-sans relative select-none">
        
        {/* Wiedervorlage Banner */}
        {activeEmail.isFlagged && (
          <div className={`mx-6 mt-6 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fade-in ${
            activeEmail.isFlagCompleted
              ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-300'
              : 'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20'
          }`}>
            <div className="flex items-start sm:items-center space-x-2.5">
              <button 
                onClick={() => onToggleFlagCompleted && onToggleFlagCompleted(activeEmail.id)}
                title={activeEmail.isFlagCompleted ? "Als unvollständig markieren" : "Als erledigt markieren"}
                className="text-base cursor-pointer hover:scale-120 transition-transform active:scale-90"
              >
                {activeEmail.isFlagCompleted ? 'OK' : 'Flag'}
              </button>
              <div>
                <p className={`font-extrabold ${activeEmail.isFlagCompleted ? 'text-emerald-900 dark:text-emerald-300' : 'text-amber-900 dark:text-amber-300'}`}>
                  {activeEmail.isFlagCompleted ? 'Nachverfolgung abgeschlossen (Erledigt)' : 'Nachverfolgung (Wiedervorlage)'}
                </p>
                <p className={`mt-1 ${activeEmail.isFlagCompleted ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {activeEmail.reminderDate ? (
                    <span>
                      Geplant für: <strong className={`font-mono bg-white/70 dark:bg-slate-950/60 px-1.5 py-0.5 rounded border ${activeEmail.isFlagCompleted ? 'border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200' : 'border-amber-200 dark:border-amber-800/50'}`}>{new Date(activeEmail.reminderDate).toLocaleDateString('de-DE')} um {new Date(activeEmail.reminderDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Uhr</strong>
                      {activeEmail.reminderNote && <span className={`block sm:inline sm:ml-2 ${activeEmail.isFlagCompleted ? 'text-emerald-600 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-300'}`}>| Notiz: <em>"{activeEmail.reminderNote}"</em></span>}
                    </span>
                  ) : (
                    "Noch keine Wiedervorlage-Uhrzeit oder Kalendersynchronisation eingerichtet."
                  )}
                </p>
              </div>
            </div>
            <button
              id="btn-reading-pane-wiedervorlage"
              onClick={() => onSetReminder && onSetReminder(activeEmail.id)}
              className={`px-3.5 py-1.8 font-extrabold rounded-lg transition-all flex items-center space-x-1.5 shadow-sm active:scale-97 cursor-pointer shrink-0 ${
                activeEmail.isFlagCompleted
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <span>Uhr</span>
              <span>{activeEmail.reminderDate ? 'Wiedervorlage ändern...' : 'Wiedervorlage einrichten'}</span>
            </button>
          </div>
        )}

        {/* Email Header bar */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/25">
          <h1 className="text-xl font-light text-slate-900 leading-snug mb-5">
            {activeEmail.subject}
          </h1>

          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              {/* Circular Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#0078d4]/10 text-[#0078d4] font-extrabold flex items-center justify-center text-sm border border-[#0078d4]/15">
                {activeEmail.sender[0]}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-950 flex items-center gap-1.5">
                  <span>{activeEmail.sender}</span>
                  <span className="font-mono text-[10px] text-slate-400 ml-1 font-bold">
                    &lt;{activeEmail.senderEmail}&gt;
                  </span>
                  <button
                    type="button"
                    title="Absenderadresse kopieren"
                    onClick={() => handleCopyAddress(activeEmail.senderEmail, 'sender-' + activeEmail.id)}
                    className="w-5 h-5 inline-flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-[#0078d4] hover:bg-white hover:border-[#0078d4]/30 transition-colors"
                  >
                    {copiedText === 'sender-' + activeEmail.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                  <span>An: <span className="text-slate-800">{activeRecipientLine}</span></span>
                  <button
                    type="button"
                    title="Empfaengeradresse kopieren"
                    onClick={() => handleCopyAddress(activeRecipientEmail, 'recipient-' + activeEmail.id)}
                    className="w-5 h-5 inline-flex items-center justify-center rounded border border-slate-200 text-slate-400 hover:text-[#0078d4] hover:bg-white hover:border-[#0078d4]/30 transition-colors"
                  >
                    {copiedText === 'recipient-' + activeEmail.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-right text-[10.5px] text-slate-400 font-mono font-bold mt-1">
              {new Date(activeEmail.date).toLocaleString('de-DE')}
            </div>
          </div>
        </div>

        {activeEmail && (mailHasRemoteImages || senderIsBlocked || senderImagesDenied || senderImagesAllowed) && (
          <div className={`mx-6 mt-4 rounded-xl border p-3 text-xs flex items-center justify-between gap-3 ${senderIsBlocked || senderImagesDenied ? 'border-red-200 bg-red-50' : senderImagesAllowed ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-start gap-2 min-w-0">
              <ShieldAlert className={`w-4 h-4 mt-0.5 shrink-0 ${senderIsBlocked || senderImagesDenied ? 'text-red-600' : senderImagesAllowed ? 'text-emerald-600' : 'text-amber-600'}`} />
              <div className="min-w-0">
                <p className="font-extrabold text-slate-800">Externe Bilder und Inhalte</p>
                <p className="text-[11px] text-slate-600 leading-4 truncate">
                  {senderIsBlocked
                    ? 'Dieser Absender ist gesperrt; externe Inhalte bleiben blockiert.'
                    : senderImagesAllowed
                      ? 'Bilder dieses Absenders werden automatisch geladen.'
                      : senderImagesDenied
                        ? 'Bilder dieses Absenders werden nie automatisch geladen.'
                        : 'Remote-Bilder wurden zum Schutz vor Tracking und Phishing blockiert.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              {mailHasRemoteImages && !shouldRenderRemoteImages && (
                <button type="button" onClick={() => setManualImageLoadEmailIds(prev => activeEmail ? Array.from(new Set([...prev, activeEmail.id])) : prev)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50">Bilder jetzt laden</button>
              )}
              <button type="button" onClick={() => onAllowImagesForSender?.(activeEmail.senderEmail)} className="px-3 py-1.5 bg-white border border-emerald-200 rounded-lg font-bold text-emerald-700 hover:bg-emerald-50">Immer laden</button>
              <button type="button" onClick={() => onDenyImagesForSender?.(activeEmail.senderEmail)} className="px-3 py-1.5 bg-white border border-amber-200 rounded-lg font-bold text-amber-700 hover:bg-amber-50">Nie laden</button>
              <button type="button" onClick={() => onBlockSender?.(activeEmail.senderEmail)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-extrabold hover:bg-red-700">Absender sperren</button>
            </div>
          </div>
        )}
        {(activeEmail.folder === 'outbox' || activeEmail.folder === 'drafts' || activeEmail.sendStatus === 'failed' || activeEmail.sendStatus === 'queued') && (
          <div className="mx-6 mt-4 p-3 border border-slate-200 bg-slate-50 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-extrabold text-slate-800">
                {activeEmail.folder === 'drafts' ? 'Entwurf' : activeEmail.sendStatus === 'failed' ? 'Postausgang: Versand fehlgeschlagen' : 'Postausgang'}
              </p>
              {activeEmail.sendError && <p className="text-[11px] text-red-600 mt-1">{activeEmail.sendError}</p>}
            </div>
            <div className="flex items-center gap-2">
              {activeEmail.folder === 'drafts' && (
                <button type="button" onClick={() => onEditStoredEmail?.(activeEmail.id, 'draft')} className="px-3 py-1.5 bg-white border border-slate-250 rounded-lg font-bold text-slate-700 hover:bg-slate-100">Entwurf bearbeiten</button>
              )}
              {activeEmail.folder === 'outbox' && (
                <>
                  <button type="button" onClick={() => onEditStoredEmail?.(activeEmail.id, 'outbox')} className="px-3 py-1.5 bg-white border border-slate-250 rounded-lg font-bold text-slate-700 hover:bg-slate-100">Bearbeiten</button>
                  <button type="button" onClick={() => onRetryOutboxEmail?.(activeEmail.id)} className="px-3 py-1.5 bg-[#0078d4] text-white rounded-lg font-bold hover:bg-[#005a9e]">Erneut senden</button>
                </>
              )}
            </div>
          </div>
        )}
        {/* Attachments panel if checked */}
        {activeEmail.hasAttachment && (
          <div className="px-6 py-2.5 border-b border-slate-200 bg-[#fbfbfb] flex items-center space-x-3 text-xs text-slate-600 relative">
            <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Anhänge:</span>
            <button
              type="button"
              onClick={saveAllAttachmentsToDisk}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[10px] font-extrabold text-slate-600 hover:bg-slate-100"
            >
              Alle herunterladen
            </button>
            <div className="flex flex-wrap gap-2">
              {(activeEmail.attachments || []).length > 0 ? activeEmail.attachments!.map((attachment, index) => (
                <button
                  key={`${attachment.filename}-${index}`}
                  type="button"
                  onClick={() => openPayloadPreview(attachment)}
                  draggable={!!attachment.contentBase64}
                  onDragStart={(event) => startAttachmentDragOut(event, attachment)}
                  onContextMenu={(event) => { event.preventDefault(); setAttachmentContextMenu({ x: event.clientX, y: event.clientY, attachment }); }}
                  className="bg-white border border-slate-200 hover:bg-slate-55 px-3 py-1 rounded-full text-[10.5px] cursor-pointer font-bold flex items-center text-[#0078d4] transition-all hover:shadow-xs max-w-[260px] truncate"
                  title={attachment.contentBase64 ? 'Vorschau öffnen' : 'Anlage nachladen, dann Vorschau öffnen'}
                >
                  {attachment.filename}{attachment.size ? ` (${Math.max(1, Math.round(attachment.size / 1024))} KB)` : ''}
                </button>
              )) : (
                <span className="bg-white border border-slate-200 px-3 py-1 rounded-full text-[10.5px] font-bold text-slate-500">
                  Anlage vorhanden, Dateidetails werden geladen...
                </span>
              )}
            </div>
          </div>
        )}
          {attachmentContextMenu && (
            <div
              className="fixed z-[10000] w-52 rounded-xl border border-slate-200 bg-white shadow-xl py-1.5 text-[11px] font-bold text-slate-700"
              style={{ top: attachmentContextMenu.y, left: attachmentContextMenu.x }}
              onMouseLeave={() => setAttachmentContextMenu(null)}
            >
              <button
                type="button"
                onClick={() => { openPayloadPreview(attachmentContextMenu.attachment); setAttachmentContextMenu(null); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50"
              >
                Vorschau öffnen
              </button>
              <button
                type="button"
                onClick={() => { saveAttachmentToDisk(attachmentContextMenu.attachment); setAttachmentContextMenu(null); }}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-[#0078d4]"
              >
                Anlage herunterladen
              </button>
            </div>
          )}
        {previewAttachment && (
          <div className="fixed inset-8 z-[10020] bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700 shadow-2xl rounded-xl flex flex-col overflow-hidden">
            <div className="h-10 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
              <span className="truncate pr-4">{previewAttachment.name}</span>
              <button type="button" onClick={() => setPreviewAttachment(null)} className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg leading-none text-slate-600 dark:text-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shadow-sm flex items-center justify-center font-black" title="Vorschau schliessen (Esc)">X</button>
            </div>
            <div className="flex-1 bg-slate-50 dark:bg-[#020617] p-4 min-h-0">
              {previewAttachment.type === 'application/pdf' ? (
                <object data={previewAttachment.url} type="application/pdf" className="w-full h-full bg-white border border-slate-200 rounded-lg">
                  <iframe title="Anlagenvorschau" src={previewAttachment.url} className="w-full h-full bg-white border border-slate-200 rounded-lg" />
                </object>
              ) : previewAttachment.type.startsWith('image/') ? (
                <img src={previewAttachment.url} alt={previewAttachment.name} className="max-w-full max-h-full object-contain mx-auto" />
              ) : (
                <div className="h-full flex items-center justify-center text-center text-xs text-slate-500">
                  <div>
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                    <p className="font-bold text-slate-700 dark:text-slate-200">{previewAttachment.name}</p>
                    <p className="mt-1">{Math.max(1, Math.round((previewAttachment.size || 0) / 1024))} KB</p>
                    <p className="mt-3 max-w-sm">Diese Datei wurde erkannt, kann aber nicht direkt als PDF/Bild gerendert werden.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}        {/* Email Rich Body text */}
        <div className="flex-1 p-6 text-xs text-slate-800 dark:text-slate-200 leading-6 border-b border-dashed border-slate-350 dark:border-slate-800 min-h-[300px]">
          {isHtml(activeEmailBodyForDisplay) ? (
            <div 
              className="rich-email-content font-sans select-text text-sm leading-relaxed text-slate-850 dark:text-slate-100"
              dangerouslySetInnerHTML={{ __html: activeEmailBodyForDisplay }}
            />
          ) : (
            <pre className="font-sans whitespace-pre-wrap select-text text-xs text-slate-700 dark:text-slate-300 leading-6">
              {activeEmailBodyForDisplay}
            </pre>
          )}
        </div>

        {false && (
        <>
        {/* WPF Architecture Integration Segment context */}
        <div className="p-6 bg-slate-50/50">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0078d4] mb-2 uppercase tracking-wide">
            <Code className="w-4 h-4" />
            <span>Zugeordnetes WPF UI & C# Konstrukt</span>
          </div>
          <p className="text-[11.5px] text-slate-500 mb-4 leading-5 font-medium">
            Dieses E-Mail-Datenpaket wird im WPF-Client über ein SQLite-Repository geladen und an ein hierarchisches <code className="bg-slate-100 p-0.5 px-1.5 rounded font-mono text-[10px] text-slate-700 font-bold">FolderViewModel</code> gebunden. 
            Mithilfe von DataTemplates lässt sich diese Visualisierung in XAML deklarieren:
          </p>

          <div className="relative bg-slate-950 rounded-xl p-4 overflow-hidden border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-2.5">
              <span>MailItemTemplate.xaml</span>
              <button 
                onClick={() => handleCopyCode(xamlSnippet, 'mail-xaml')}
                className="hover:text-white flex items-center space-x-1.5 cursor-pointer font-bold transition-all p-1 hover:bg-slate-800 rounded-md"
              >
                {copiedText === 'mail-xaml' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText === 'mail-xaml' ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-[#dadada] overflow-x-auto select-text leading-5 max-h-48">
              {xamlSnippet}
            </pre>
          </div>
        </div>
        </>
        )}

        {/* Floating save and copy image action shortcuts toolbar */}
        {imageActionPopup && (
          <div 
            id="image-hover-action-toolbar"
            className="absolute z-50 bg-[#1e293b] text-white border border-[#334155] shadow-xl rounded-xl p-1 flex items-center space-x-1 animate-fade-in"
            style={{ top: `${imageActionPopup.y}px`, left: `${imageActionPopup.x}px` }}
          >
            <button
              onClick={() => triggerImageSave(imageActionPopup.url)}
              className="px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-[10px] font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Dieses Bild herunterladen"
            >
              <span>Download Speichern unter...</span>
            </button>
            <span className="w-px h-3.5 bg-slate-700"></span>
            <button
              onClick={() => triggerImageCopy(imageActionPopup.url)}
              className="px-2.5 py-1.5 hover:bg-slate-800 rounded-lg text-[10px] font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Dieses Bild in Zwischenablage kopieren"
            >
              <span>Copy Kopieren (Strg+C)</span>
            </button>
          </div>
        )}

        {/* Custom Rich Image Context Menu Options popup */}
        {imageContextMenu && (
          <div 
            id="image-outlook-context-menu"
            className="absolute z-100 bg-white border border-slate-205 shadow-2xl rounded-xl p-1 w-56 animate-fade-in select-none font-sans"
            style={{ top: `${imageContextMenu.y}px`, left: `${imageContextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1 text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-100 mb-1">
              Bild-Aktionen (Outlook)
            </div>
            <button 
              onClick={() => { triggerImageSave(imageContextMenu.url); setImageContextMenu(null); }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-2 transition-all cursor-pointer text-[11px]"
            >
              <span className="text-blue-500 text-xs">Download</span>
              <span>Bild speichern unter...</span>
            </button>
            <button 
              onClick={() => { triggerImageCopy(imageContextMenu.url); setImageContextMenu(null); }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-2 transition-all cursor-pointer text-[11px]"
            >
              <span className="text-amber-500 text-xs">Copy</span>
              <span>Bild kopieren (Strg + C)</span>
            </button>
            <div className="h-px bg-slate-100/80 my-1"></div>
            <button 
              onClick={() => { window.open(imageContextMenu.url, '_blank'); setImageContextMenu(null); }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100/90 text-slate-700 font-bold flex items-center space-x-2 transition-all cursor-pointer text-[11px]"
            >
              <span className="text-emerald-500 text-xs">Web</span>
              <span>In neuem Tab öffnen</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- 3. CALENDAR PANELS ---
  if (currentPage === 'calendar') {
    const today = new Date();
    const selectedDate = activeCalendar?.start ? new Date(activeCalendar.start) : today;
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthLabel = monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const leadingDays = (monthStart.getDay() + 6) % 7;
    const calendarCells = [
      ...Array.from({ length: leadingDays }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => new Date(monthStart.getFullYear(), monthStart.getMonth(), index + 1)),
    ];

    const itemsForDay = (date: Date) => calendarItems.filter(item => {
      const itemDate = new Date(item.start);
      return itemDate.getFullYear() === date.getFullYear()
        && itemDate.getMonth() === date.getMonth()
        && itemDate.getDate() === date.getDate();
    });

    return (
      <div id="calendar-reading-pane" className="flex-1 bg-white flex flex-col h-full overflow-y-auto font-sans select-none">
        <div className="p-6 border-b border-slate-200 bg-slate-50/30">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-lg font-bold text-slate-800 flex items-center">
              <Calendar className="w-5 h-5 text-green-600 mr-2.5" />
              <span>Kalender</span>
            </h1>
            <span className="text-xs bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold capitalize">
              {monthLabel}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-5">
            Doppelklicken Sie auf einen Tag, um einen neuen Termin im angedockten Formular zu erfassen.
          </p>
        </div>

        <div className="p-6 bg-white">
          <div className="grid grid-cols-7 gap-2.5 text-center text-[10px] font-extrabold text-slate-550 uppercase mb-3.5 tracking-wider">
            <span>Mo</span><span>Di</span><span>Mi</span><span>Do</span><span>Fr</span><span>Sa</span><span>So</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 border border-slate-200 bg-slate-50 p-1.5 rounded-xl overflow-hidden">
            {calendarCells.map((date, i) => {
              if (!date) {
                return <div key={i} className="min-h-[74px] rounded-lg bg-slate-100/60 border border-transparent" />;
              }
              const dayItems = itemsForDay(date);
              const isToday = date.toDateString() === today.toDateString();
              const isSelectedDay = activeCalendar?.start && new Date(activeCalendar.start).toDateString() === date.toDateString();

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  title="Doppelklick: Termin an diesem Tag erfassen"
                  onClick={() => undefined}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openCalendarDraft(date);
                  }}
                  className={`min-h-[74px] bg-white p-2 text-left rounded-lg border transition-all cursor-pointer hover:bg-green-50 hover:border-green-300 hover:shadow-sm hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-green-500/30 ${
                    isSelectedDay ? 'bg-green-50/80 border-2 border-green-500 ring-2 ring-green-100' : 'border-slate-200/60'
                  }`}
                >
                  <span className={`text-[10px] font-extrabold ${isToday ? 'text-white bg-green-600 rounded-full px-1.5 py-0.5' : 'text-slate-500'}`}>
                    {date.getDate()}
                  </span>

                  <div className="mt-1 space-y-1">
                    {dayItems.slice(0, 2).map(item => (
                      <div
                        key={item.id}
                        className="text-[9px] bg-green-100 text-green-900 border border-green-200 px-1.5 py-0.5 rounded font-sans leading-tight truncate font-bold"
                        title={item.title}
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="text-[9px] text-slate-500 font-bold">+{dayItems.length - 2} weitere</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {calendarDraft && (
          <div className="mx-6 mb-6 rounded-xl border border-green-200 bg-green-50/80 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-green-200 bg-white/70 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-extrabold text-green-900 uppercase tracking-wider">
                <Calendar className="w-4 h-4 text-green-600" />
                <span>Neuer Termin</span>
              </div>
              <button type="button" onClick={() => setCalendarDraft(null)} className="text-slate-400 hover:text-red-500 text-sm font-black px-2">x</button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 text-xs">
              <label className="col-span-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Titel
                <input autoFocus value={calendarDraft.title} onChange={(e) => setCalendarDraft(prev => prev ? { ...prev, title: e.target.value } : prev)} className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500/20" />
              </label>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Datum
                <input type="date" value={calendarDraft.date} onChange={(e) => setCalendarDraft(prev => prev ? { ...prev, date: e.target.value } : prev)} className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500/20" />
              </label>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Uhrzeit
                <input type="time" value={calendarDraft.time} onChange={(e) => setCalendarDraft(prev => prev ? { ...prev, time: e.target.value } : prev)} className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500/20" />
              </label>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Dauer (Min.)
                <input type="number" min="15" step="15" value={calendarDraft.duration} onChange={(e) => setCalendarDraft(prev => prev ? { ...prev, duration: e.target.value } : prev)} className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500/20" />
              </label>
              <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Ort
                <input value={calendarDraft.location} onChange={(e) => setCalendarDraft(prev => prev ? { ...prev, location: e.target.value } : prev)} className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500/20" />
              </label>
              <label className="col-span-2 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Notiz
                <textarea value={calendarDraft.description} onChange={(e) => setCalendarDraft(prev => prev ? { ...prev, description: e.target.value } : prev)} className="mt-1 h-20 w-full resize-none rounded-lg border border-green-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-green-500/20" />
              </label>
              <div className="col-span-2 flex justify-end gap-2 border-t border-green-200 pt-3">
                <button type="button" onClick={() => setCalendarDraft(null)} className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50">Abbrechen</button>
                <button type="button" onClick={saveCalendarDraft} disabled={!calendarDraft.title.trim()} className="px-4 py-2 rounded-lg bg-green-600 text-white font-extrabold hover:bg-green-700 disabled:opacity-45 disabled:cursor-not-allowed">Speichern</button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 border-t border-slate-200 bg-slate-50/15">
          {activeCalendar ? (
            <div className="space-y-4">
              <div className="border-l-4 border-green-600 pl-4 py-1">
                <h2 className="text-base font-bold text-slate-900">{activeCalendar.title}</h2>
                <div className="text-xs text-[#0078d4] font-bold flex items-center mt-1.5">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-[#0078d4]" />
                  <span>
                    {new Date(activeCalendar.start).toLocaleDateString('de-DE')} von {new Date(activeCalendar.start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} bis {new Date(activeCalendar.end).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} Uhr
                  </span>
                </div>
              </div>

              {activeCalendar.location && (
                <div className="text-xs text-slate-650 flex items-center pl-4 font-medium">
                  <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                  <span>Ort: <strong className="text-slate-800">{activeCalendar.location}</strong></span>
                </div>
              )}

              {activeCalendar.description && (
                <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200/80 text-xs text-slate-700 leading-6 font-medium whitespace-pre-wrap">
                  {activeCalendar.description}
                </div>
              )}

              {activeCalendar.emailAttachmentId && (
                <div className="bg-blue-50/40 border border-blue-200/80 p-4.5 rounded-xl text-xs animate-fade-in shadow-xs">
                  <strong className="flex items-center text-[#0078d4] font-bold">
                    <Paperclip className="w-4 h-4 mr-1.5 text-blue-500" /> Verknuepfte E-Mail
                  </strong>
                  <div className="mt-2.5 bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between gap-2 shadow-xxs">
                    <div className="truncate pr-2">
                      <p className="font-bold text-slate-800 truncate">{activeCalendar.emailAttachmentSubject || "Verknuepfte E-Mail"}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">Attachment ID: {activeCalendar.emailAttachmentId}</p>
                    </div>
                    <button
                      id="btn-calendar-view-attachment-mail"
                      onClick={() => {
                        if (activeCalendar.emailAttachmentId && onOpenEmailAttachment) {
                          onOpenEmailAttachment(activeCalendar.emailAttachmentId);
                        }
                      }}
                      className="px-3 py-1.5 bg-[#0078d4] hover:bg-[#005a9e] text-white font-extrabold rounded-lg text-[10.5px] transition-all flex items-center space-x-1 shrink-0 cursor-pointer active:scale-97"
                    >
                      <span>Mail oeffnen</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400 font-medium">
              Noch kein Termin ausgewaehlt. Doppelklicken Sie auf einen Kalendertag, um einen neuen Eintrag zu erstellen.
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- 4. CONTACTS DETAILS PANEL ---
  if (currentPage === 'contacts' || currentPage === 'crm') {
    if (!activeContact) {
      return (
        <div id="no-contact-pane" className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
          <Briefcase className="w-16 h-16 text-slate-300 stroke-1 mb-4" />
          <h3 className="text-sm font-bold text-slate-600">Kein Kontakt ausgewählt</h3>
          <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-5">
            Wählen Sie ein Team-Mitglied aus, um die Rolle, E-Mail und WPF Kontaktkarte einzusehen.
          </p>
        </div>
      );
    }

    const initials = `${activeContact.firstName[0]}${activeContact.lastName[0]}`;

    return (
      <div id="contact-details-pane" className="flex-1 bg-white flex flex-col h-full overflow-y-auto font-sans select-none">
        
        {/* Contact Header Background with Card Visual representation */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/30 relative">
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-5">
            {/* Visual WPF Card Placeholder Avatar Circle */}
            <div className="w-16 h-16 rounded-full bg-[#0078d4]/10 border border-[#0078d4]/15 text-[#0078d4] font-extrabold text-xl flex items-center justify-center shadow-inner">
              {initials}
            </div>
            
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 leading-tight">
                {activeContact.firstName} {activeContact.lastName}
              </h1>
              <p className="text-xs text-[#0078d4] font-bold mt-1.5 flex items-center">
                <Briefcase className="w-4 h-4 mr-1.5" />
                <span>{activeContact.role}</span>
              </p>
              {activeContact.company && (
                <div className="text-xs text-slate-500 mt-1 flex items-center">
                  <Building className="w-3.5 h-3.5 mr-1.5" />
                  <span>{activeContact.company}</span>
                </div>
              )}

              {activeContact.id.startsWith('suggested-') && (
                <div id="suggested-contact-action-bar" className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="bg-purple-50 text-purple-700 text-[9.5px] px-2.5 py-1 rounded-lg font-bold border border-purple-200 flex items-center space-x-1.5 shadow-inner-sm animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                    <span>Automatisch erfasster Vorschlag</span>
                  </span>
                  {onAddContact && (
                    <button
                      onClick={() => onAddContact(activeContact)}
                      className="bg-[#0078d4] hover:bg-[#106ebe] text-white text-[10px] font-extrabold uppercase tracking-wide px-3 py-1 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      + Zu Kontakten hinzufügen
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Address list */}
        <div className="p-6 space-y-4.5 border-b border-slate-200 bg-white">
          <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Kontaktdaten (Outlook Schema)</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 text-xs">
            <div className="space-y-3">
              <div className="flex items-center text-slate-600">
                <Mail className="w-4 h-4 text-slate-400 mr-3" />
                <span>E-Mail: <span className="text-slate-950 font-bold font-mono text-[11px] bg-slate-100 py-0.5 px-1.5 rounded">{activeContact.email}</span></span>
              </div>
              {activeContact.phone && (
                <div className="flex items-center text-slate-600">
                  <Phone className="w-4 h-4 text-slate-400 mr-3" />
                  <span>Telefon: <span className="text-slate-950 font-bold font-mono text-[11px] bg-slate-100 py-0.5 px-1.5 rounded">{activeContact.phone}</span></span>
                </div>
              )}
            </div>
            {activeContact.address && (
              <div className="flex items-start text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 mr-3 mt-0.5" />
                <span>Adresse: <strong className="text-slate-800 block font-bold mt-0.5">{activeContact.address}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* WPF XAML User Contact Card Template Generator */}
        <div className="p-6 bg-slate-50 flex-1">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0078d4] mb-2 uppercase tracking-wide">
            <Code className="w-4 h-4" />
            <span>Zugeordnetes XAML Template: <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">ContactCard.xaml</code></span>
          </div>
          <p className="text-[11px] text-slate-500 mb-4 leading-5 font-medium">
            Dieses Template definiert die Benutzeroberfläche zur Visualisierung von Kontakten als Visitenkarten in WPF. Sie können es kopieren und in Ihr <code className="bg-slate-100 p-0.5 px-1 rounded text-slate-700 font-extrabold">UserControl</code> einbetten:
          </p>

          <div className="relative bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-2.5">
              <span>ContactCardItemTemplate.xaml</span>
              <button 
                onClick={() => handleCopyCode(contactCardXaml, 'contact-card')}
                className="hover:text-white flex items-center space-x-1.5 cursor-pointer font-bold transition-all p-1 hover:bg-slate-800 rounded-md"
              >
                {copiedText === 'contact-card' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText === 'contact-card' ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-[#dadada] overflow-x-auto select-text leading-5 max-h-48">
              {contactCardXaml}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  // --- 5. TASKS DETAILS PANEL ---
  if (currentPage === 'tasks') {
    if (!activeTask) {
      return (
        <div id="no-task-pane" className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
          <CheckSquare className="w-16 h-16 text-slate-300 stroke-1 mb-4" />
          <h3 className="text-sm font-bold text-slate-600">Keine Aufgabe ausgewählt</h3>
          <p className="text-xs text-slate-400 max-w-xs mt-1.5 leading-5">
            Wählen Sie ein To-Do-Element aus der Liste aus, um die Details, Fristen und den Code einzublenden.
          </p>
        </div>
      );
    }

    return (
      <div id="task-details-pane" className="flex-1 bg-white flex flex-col h-full overflow-y-auto font-sans select-none">
        
        {/* Task Title */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/25">
          <div className="flex items-center space-x-2 text-slate-400 text-[10px] font-extrabold uppercase tracking-widest mb-2.5">
            <CheckSquare className="w-3.5 h-3.5 text-amber-500" />
            <span>WPF To-Do Element</span>
          </div>
          
          <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
            {activeTask.title}
          </h1>

          <div className="flex items-center space-x-4.5 mt-3.5 text-xs">
            <div className="text-slate-500 font-medium">
              Fälligkeitsdatum: <strong className="text-slate-800 font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">{activeTask.dueDate}</strong>
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center">
              <span className="text-slate-500 mr-2 font-medium">Priorität:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold font-sans border uppercase tracking-wider ${
                activeTask.priority === 'High' ? 'bg-red-50 text-red-700 border-red-100' :
                activeTask.priority === 'Normal' ? 'bg-sky-50 text-blue-700 border-sky-100' :
                'bg-slate-55 text-slate-700 border-slate-200'
              }`}>{activeTask.priority === 'High' ? 'Hoch' : activeTask.priority}</span>
            </div>
          </div>
        </div>

        {/* Task completeness manager */}
        <div className="p-6 border-b border-slate-200 bg-white space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-bold">Fortschritt ändern:</span>
            <span className="font-mono font-bold text-slate-950 text-[13px] bg-slate-100 px-2.5 py-0.5 rounded-full">{activeTask.percentComplete}% abgeschlossen</span>
          </div>

          <div className="flex items-center space-x-4">
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5"
              value={activeTask.percentComplete}
              onChange={(e) => onChangeTaskPercent(activeTask.id, parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0078d4]"
            />
            
            <button
              onClick={() => onChangeTaskPercent(activeTask.id, activeTask.isCompleted ? 0 : 100)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border active:scale-95 cursor-pointer ${
                activeTask.isCompleted 
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200/50'
                  : 'bg-green-100 border-[#c3e1b0] text-green-900 hover:bg-green-200/80'
              }`}
            >
              {activeTask.isCompleted ? 'Als unvollständig markieren' : 'Als erledigt markieren ok'}
            </button>
          </div>
        </div>

        {/* Notes */}
        {activeTask.notes && (
          <div className="p-6 border-b border-slate-200 space-y-2.5 bg-white">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Beschreibung / Notizen:</h3>
            <p className="text-xs text-slate-700 leading-6 font-sans whitespace-pre-line p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              {activeTask.notes}
            </p>
          </div>
        )}

        {/* C# Tasks SQLite model definition script */}
        <div className="p-6 bg-slate-50 flex-1">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0078d4] mb-2 uppercase tracking-wide">
            <Code className="w-4 h-4" />
            <span>Zugehöriges C# SQLite Repository Datenmodell</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-3.5 leading-5 font-medium">
            Dieses Item wird in C# zur persistenten Synchronisation über ein Entity Framework Core Modell namens <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-700 font-bold">TaskItem</code> gemappt.
          </p>

          <div className="relative bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-md">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-2.5">
              <span>TaskItem.cs</span>
              <button 
                onClick={() => handleCopyCode(taskModelCode, 'task-cs')}
                className="hover:text-white flex items-center space-x-1.5 cursor-pointer font-bold transition-all p-1 hover:bg-slate-800 rounded-md"
              >
                {copiedText === 'task-cs' ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedText === 'task-cs' ? 'Kopiert' : 'Kopieren'}</span>
              </button>
            </div>
            <pre className="text-[11px] font-mono text-[#dadada] overflow-x-auto select-text leading-5 max-h-48">
              {taskModelCode}
            </pre>
          </div>
        </div>

      </div>
    );
  }

  // --- 6. DEFAULT BACKUP ---
  return null;
}

// Custom code snippets for quick copy
const xamlSnippet = `<DataTemplate DataType="{x:Type vm:MailItemViewModel}">
    <Border CornerRadius="8" BorderThickness="1" BorderBrush="#E2E8F0" Margin="0,0,0,8" Background="White" ToolTip="{Binding Subject}">
        <Grid Padding="14,10">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="Auto" />
                <ColumnDefinition Width="*" />
            </Grid.ColumnDefinitions>
            
            <!-- Unread Blue Dot Badge -->
            <Ellipse Grid.Column="0" Width="8" Height="8" Margin="0,0,10,0"
                     Fill="#0078D4" 
                     Visibility="{Binding IsRead, Converter={StaticResource InverseBooleanToVisibilityConverter}}" />
            
            <StackPanel Grid.Column="1">
                <Grid>
                    <TextBlock Text="{Binding Sender}" FontWeight="SemiBold" Foreground="#323130" />
                    <TextBlock Text="{Binding FriendlyDate}" HorizontalAlignment="Right" FontSize="11" Foreground="#797775" />
                </Grid>
                <TextBlock Text="{Binding Subject}" FontWeight="Medium" Foreground="Black" Margin="0,2" />
                <TextBlock Text="{Binding PreviewSnippet}" Foreground="#797775" MaxHeight="32" TextWrapping="Wrap" />
            </StackPanel>
        </Grid>
    </Border>
</DataTemplate>`;

const contactCardXaml = `<UserControl x:Class="OutlookWpfClassic.Views.ContactCard"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             Width="300" Height="150">
    <Border CornerRadius="8" BorderThickness="1" BorderBrush="#E2E8F0" Background="White" Padding="14" Margin="2">
        <Grid>
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="75" />
                <ColumnDefinition Width="*" />
            </Grid.ColumnDefinitions>
            
            <!-- Initiale Avatar Block -->
            <Border Grid.Column="0" CornerRadius="37" Width="55" Height="55" 
                    Background="#0078D4" BackgroundOpacity="0.1" VerticalAlignment="Top" HorizontalAlignment="Center" BorderBrush="#0078D4" BorderThickness="1">
                <TextBlock Text="{Binding Initials}" VerticalAlignment="Center" HorizontalAlignment="Center" 
                            FontWeight="Bold" FontSize="16" Foreground="#0078D4"/>
            </Border>
            
            <!-- Details -->
            <StackPanel Grid.Column="1" Margin="12,0,0,0">
                <TextBlock Text="{Binding FullName}" FontSize="14" FontWeight="Bold" Foreground="#0F172A"/>
                <TextBlock Text="{Binding Role}" FontSize="11" Foreground="#0078D4" FontWeight="SemiBold" Margin="0,2,0,4"/>
                <TextBlock Text="{Binding Company}" FontSize="11" Foreground="#64748B" Margin="0,0,0,6"/>
                
                <TextBlock Text="{Binding Email}" FontSize="11" Foreground="#0F172A" FontFamily="Consolas"/>
                <TextBlock Text="{Binding Phone}" FontSize="11" Foreground="#0F172A" Margin="0,2,0,0"/>
            </StackPanel>
        </Grid>
    </Border>
</UserControl>`;

const taskModelCode = `using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace OutlookWpfClassic.Models
{
    [Table("Tasks")]
    public class TaskItem
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(200)]
        public string Title { get; set; }

        public DateTime DueDate { get; set; }

        public bool IsCompleted { get; set; }

        [MaxLength(20)]
        public string Priority { get; set; } = "Normal"; // Low, Normal, High

        public int PercentComplete { get; set; }

        public string Notes { get; set; }

        public DateTime LastSynced { get; set; } = DateTime.UtcNow;
    }
}`;






