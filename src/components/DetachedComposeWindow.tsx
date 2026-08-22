import React from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Mail, Paperclip, Send, PanelTopClose, Trash2 } from 'lucide-react';
import type { ComposeMailPayload } from './ReadingPane';
import { useComposePastePrompt } from './ComposePastePrompt';
import { readEmlAttachmentsFromDrop } from '../utils/eml';

type Account = { email: string; displayName?: string; senderName?: string; name?: string };
type StoredContact = { email?: string; firstName?: string; lastName?: string };
type StoredRecipient = { email?: string; displayName?: string };

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const fileToPayload = (file: File) => new Promise<{ filename: string; contentType: string; contentBase64: string }>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const value = String(reader.result || '');
    resolve({ filename: file.name, contentType: file.type || 'application/octet-stream', contentBase64: value.includes(',') ? value.split(',').pop() || '' : value });
  };
  reader.onerror = () => reject(reader.error || new Error('Anlage konnte nicht gelesen werden.'));
  reader.readAsDataURL(file);
});

export default function DetachedComposeWindow() {
  const [payload, setPayload] = React.useState<ComposeMailPayload>({ to: '', cc: '', bcc: '', subject: '', body: '', attachments: [] });
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const editorRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const payloadRef = React.useRef(payload);
  const { handlePaste, pastePrompt } = useComposePastePrompt(
    editorRef,
    React.useCallback((html: string) => setPayload(previous => ({ ...previous, body: html })), [])
  );
  const nativeApi = (window as any).uniqueMailNative;
  const accounts = readJson<Account[]>('outlook_accounts', []);
  const contacts = readJson<StoredContact[]>('outlook_contacts', []);
  const history = readJson<StoredRecipient[]>('uniquemail_recipient_history', []);
  const suggestions = React.useMemo(() => {
    const values = new Map<string, string>();
    contacts.forEach(contact => {
      const email = String(contact.email || '').trim().toLowerCase();
      const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
      if (email) values.set(email, name ? `${name} <${email}>` : email);
    });
    history.forEach(item => {
      const email = String(item.email || '').trim().toLowerCase();
      if (email && !values.has(email)) values.set(email, item.displayName ? `${item.displayName} <${email}>` : email);
    });
    return Array.from(values.entries()).map(([email, value]) => ({ email, value }));
  }, [contacts, history]);

  React.useEffect(() => {
    let active = true;
    void nativeApi?.getDetachedComposeState?.().then((result: any) => {
      if (!active) return;
      const initial = result?.payload || {};
      setPayload(previous => ({ ...previous, ...initial, attachments: Array.isArray(initial.attachments) ? initial.attachments : [] }));
      setLoaded(true);
    });
    const unsubscribe = nativeApi?.onDetachedComposeReplace?.((next: ComposeMailPayload) => {
      setPayload(previous => ({ ...previous, ...next, attachments: Array.isArray(next?.attachments) ? next.attachments : [] }));
    });
    const unsubscribeClose = nativeApi?.onDetachedComposeCloseRequest?.(() => {
      void nativeApi?.dockDetachedCompose?.({ ...payloadRef.current, body: editorRef.current?.innerHTML || payloadRef.current.body });
    });
    return () => { active = false; unsubscribe?.(); unsubscribeClose?.(); };
  }, []);

  React.useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  React.useEffect(() => {
    if (!loaded || !editorRef.current) return;
    editorRef.current.innerHTML = payload.body || '';
  }, [loaded]);

  React.useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      const current = { ...payload, body: editorRef.current?.innerHTML || payload.body };
      localStorage.setItem('uniquemail_active_compose_draft', JSON.stringify(current));
      void nativeApi?.updateDetachedComposeState?.(current);
      nativeApi?.persistRendererStorage?.();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [payload, loaded]);

  React.useEffect(() => {
    const dark = localStorage.getItem('uniquemail_darkmode') === 'true';
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const currentPayload = (): ComposeMailPayload => ({ ...payload, body: editorRef.current?.innerHTML || payload.body });
  const update = (field: keyof ComposeMailPayload, value: any) => setPayload(previous => ({ ...previous, [field]: value }));
  const applyFormat = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    update('body', editorRef.current?.innerHTML || '');
  };
  const addFiles = async (files: FileList | File[]) => {
    const next = await Promise.all(Array.from(files).map(fileToPayload));
    setPayload(previous => ({ ...previous, attachments: [...previous.attachments, ...next] }));
  };
  const addDrop = async (dataTransfer: DataTransfer) => {
    const messageAttachments = readEmlAttachmentsFromDrop(dataTransfer);
    if (messageAttachments.length > 0) {
      setPayload(previous => ({ ...previous, attachments: [...previous.attachments, ...messageAttachments] }));
      return;
    }
    if (dataTransfer.files?.length) await addFiles(dataTransfer.files);
  };
  const dock = async () => {
    setBusy(true);
    const result = await nativeApi?.dockDetachedCompose?.(currentPayload());
    if (!result?.ok) {
      alert(result?.error || 'Das Fenster konnte nicht angedockt werden.');
      setBusy(false);
    }
  };
  const send = async () => {
    const current = currentPayload();
    if (!current.to.trim()) {
      alert('Bitte mindestens einen Empfänger eintragen.');
      return;
    }
    setBusy(true);
    const result = await nativeApi?.sendDetachedCompose?.(current);
    if (!result?.ok) {
      alert(result?.error || 'Die Nachricht konnte nicht an den Postausgang übergeben werden.');
      setBusy(false);
    }
  };

  if (!loaded) return <div className="flex h-screen items-center justify-center bg-slate-50 text-sm font-semibold text-slate-500">Entwurf wird geladen...</div>;

  const accountLabel = (account: Account) => {
    const name = account.displayName || account.senderName || account.name;
    return name ? `${name} <${account.email}>` : account.email;
  };

  return (
    <div className="flex h-screen min-h-0 flex-col bg-white text-slate-800 dark:bg-[#0f172a] dark:text-slate-100">
      {pastePrompt}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-[#111827]">
        <div>
          <h1 className="text-sm font-extrabold">Neue E-Mail</h1>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Abgekoppeltes Verfassenfenster</p>
        </div>
        <button type="button" onClick={dock} disabled={busy} className="inline-flex items-center gap-2 border border-[#0078d4] bg-white px-3 py-1.5 text-xs font-bold text-[#0078d4] hover:bg-blue-50 disabled:opacity-50 dark:bg-slate-900">
          <PanelTopClose className="h-4 w-4" /> Andocken
        </button>
      </header>

      <section className="shrink-0 space-y-2 border-b border-slate-200 p-4 dark:border-slate-700">
        <label className="grid grid-cols-[62px_1fr] items-center gap-2 text-xs"><span className="font-bold text-slate-500">VON</span>
          <select value={payload.accountEmail || accounts[0]?.email || ''} onChange={event => update('accountEmail', event.target.value)} className="border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-800">
            {accounts.map(account => <option key={account.email} value={account.email}>{accountLabel(account)}</option>)}
          </select>
        </label>
        {(['to', 'cc', 'bcc'] as const).map(field => (
          <label key={field} className="grid grid-cols-[62px_1fr] items-center gap-2 text-xs"><span className="font-bold uppercase text-slate-500">{field === 'to' ? 'An' : field}</span>
            <input list="detached-recipient-suggestions" value={payload[field]} onChange={event => update(field, event.target.value)} autoComplete="off" placeholder="Name oder E-Mail-Adresse" className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-[#0078d4] dark:border-slate-600 dark:bg-slate-800" />
          </label>
        ))}
        <datalist id="detached-recipient-suggestions">{suggestions.map(item => <option key={item.email} value={item.value}>{item.email}</option>)}</datalist>
        <label className="grid grid-cols-[62px_1fr] items-center gap-2 text-xs"><span className="font-bold text-slate-500">BETREFF</span>
          <input value={payload.subject} onChange={event => update('subject', event.target.value)} className="border border-slate-300 bg-white px-3 py-2 outline-none focus:border-[#0078d4] dark:border-slate-600 dark:bg-slate-800" />
        </label>
      </section>

      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-[#111827]">
        <button type="button" onClick={() => applyFormat('bold')} title="Fett" className="h-8 w-8 border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"><Bold className="m-auto h-4 w-4" /></button>
        <button type="button" onClick={() => applyFormat('italic')} title="Kursiv" className="h-8 w-8 border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"><Italic className="m-auto h-4 w-4" /></button>
        <button type="button" onClick={() => applyFormat('underline')} title="Unterstrichen" className="h-8 w-8 border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"><Underline className="m-auto h-4 w-4" /></button>
        <span className="mx-2 h-6 w-px bg-slate-300 dark:bg-slate-600" />
        <button type="button" onClick={() => applyFormat('insertUnorderedList')} title="Aufzählung" className="h-8 w-8 border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"><List className="m-auto h-4 w-4" /></button>
        <button type="button" onClick={() => applyFormat('insertOrderedList')} title="Nummerierung" className="h-8 w-8 border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"><ListOrdered className="m-auto h-4 w-4" /></button>
      </div>

      <div ref={editorRef} contentEditable suppressContentEditableWarning onPaste={handlePaste} onInput={event => update('body', event.currentTarget.innerHTML)} className="min-h-0 flex-1 overflow-y-auto p-5 text-sm leading-6 outline-none" />

      <div onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }} onDrop={event => { event.preventDefault(); void addDrop(event.dataTransfer); }} className="mx-4 mb-3 shrink-0 border border-dashed border-slate-300 p-2 dark:border-slate-600">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-slate-500">Dateien oder E-Mails hier ablegen</span>
          <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"><Paperclip className="h-3.5 w-3.5" /> Anlage</button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={event => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }} />
        </div>
        {payload.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{payload.attachments.map((attachment, index) => <span key={`${attachment.filename}-${index}`} className="inline-flex max-w-[260px] items-center gap-1 border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] dark:border-slate-600 dark:bg-slate-800">{attachment.contentType === 'message/rfc822' && <Mail className="h-3.5 w-3.5 shrink-0 text-[#0078d4]" />}<span className="truncate">{attachment.filename}</span><button type="button" onClick={() => update('attachments', payload.attachments.filter((_, itemIndex) => itemIndex !== index))} title="Anlage entfernen"><Trash2 className="h-3 w-3 text-red-500" /></button></span>)}</div>}
      </div>

      <footer className="flex h-14 shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 dark:border-slate-700 dark:bg-[#111827]">
        <button type="button" onClick={dock} disabled={busy} className="border border-slate-300 bg-white px-4 py-2 text-xs font-bold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800">Andocken</button>
        <button type="button" onClick={send} disabled={busy} className="inline-flex items-center gap-2 bg-[#0078d4] px-5 py-2 text-xs font-bold text-white hover:bg-[#005a9e] disabled:opacity-50"><Send className="h-4 w-4" />{busy ? 'Bitte warten...' : 'Senden'}</button>
      </footer>
    </div>
  );
}
