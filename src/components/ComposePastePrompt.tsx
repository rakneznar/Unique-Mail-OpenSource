import React from 'react';
import { ClipboardPaste, FileType2, Paintbrush } from 'lucide-react';
import { createPortal } from 'react-dom';

type PendingPaste = {
  html: string;
  text: string;
  range: Range | null;
};

const sanitizeClipboardHtml = (html: string) => {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html');
  const styledElements = Array.from(documentFragment.body.querySelectorAll<HTMLElement>('*'));
  Array.from(documentFragment.styleSheets).forEach(styleSheet => {
    try {
      Array.from(styleSheet.cssRules).forEach(rule => {
        if (!(rule instanceof CSSStyleRule)) return;
        rule.selectorText.split(',').forEach(selector => {
          try {
            styledElements.filter(element => element.matches(selector.trim())).forEach(element => {
              const inlineStyle = element.getAttribute('style') || '';
              element.setAttribute('style', `${rule.style.cssText};${inlineStyle}`);
            });
          } catch {
            // Pseudo selectors and vendor-specific Office selectors cannot be applied inline.
          }
        });
      });
    } catch {
      // Invalid source styles must not prevent the actual clipboard content from being pasted.
    }
  });
  documentFragment.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form, input, button').forEach(node => node.remove());
  documentFragment.body.querySelectorAll<HTMLElement>('*').forEach(element => {
    Array.from(element.attributes).forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || name === 'contenteditable' || name === 'srcdoc') element.removeAttribute(attribute.name);
      if (['href', 'src', 'xlink:href', 'action', 'formaction'].includes(name) && /^(?:javascript|vbscript):/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
      if (name === 'style') {
        const safeStyle = value
          .replace(/(?:expression\s*\(|url\s*\(\s*['"]?(?:javascript|vbscript):)[^;]*(?:;|$)/gi, '')
          .replace(/(?:position\s*:\s*(?:fixed|absolute|sticky)|z-index\s*:\s*-?\d+|behavior\s*:|(?:-moz-)?binding\s*:)[^;]*(?:;|$)/gi, '')
          .trim();
        if (safeStyle) element.setAttribute('style', safeStyle);
        else element.removeAttribute('style');
      }
    });
  });
  return documentFragment.body.innerHTML;
};

const selectionRangeInside = (editor: HTMLElement) => {
  const selection = window.getSelection();
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) return range.cloneRange();
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
};

export function useComposePastePrompt(
  editorRef: React.RefObject<HTMLDivElement | null>,
  onContentChange: (html: string) => void
) {
  const [pendingPaste, setPendingPaste] = React.useState<PendingPaste | null>(null);

  const insertClipboardContent = React.useCallback((keepFormatting: boolean) => {
    const editor = editorRef.current;
    if (!editor || !pendingPaste) return setPendingPaste(null);

    editor.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    if (pendingPaste.range && editor.contains(pendingPaste.range.commonAncestorContainer)) {
      selection?.addRange(pendingPaste.range);
    } else {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection?.addRange(range);
    }

    const inserted = keepFormatting
      ? document.execCommand('insertHTML', false, sanitizeClipboardHtml(pendingPaste.html))
      : document.execCommand('insertText', false, pendingPaste.text);

    if (!inserted) {
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      if (range) {
        range.deleteContents();
        const content = keepFormatting
          ? range.createContextualFragment(sanitizeClipboardHtml(pendingPaste.html))
          : document.createTextNode(pendingPaste.text);
        range.insertNode(content);
        range.collapse(false);
      }
    }

    onContentChange(editor.innerHTML);
    setPendingPaste(null);
  }, [editorRef, onContentChange, pendingPaste]);

  const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData('text/html');
    if (!html.trim()) return;
    event.preventDefault();
    setPendingPaste({
      html,
      text: event.clipboardData.getData('text/plain'),
      range: selectionRangeInside(event.currentTarget)
    });
  }, []);

  React.useEffect(() => {
    if (!pendingPaste) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPendingPaste(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [pendingPaste]);

  const pastePrompt = pendingPaste ? createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/35 p-4" role="dialog" aria-modal="true" aria-labelledby="paste-format-title">
      <div className="w-full max-w-[480px] border border-slate-300 bg-white shadow-2xl dark:border-slate-600 dark:bg-[#111827]">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-[#0f172a]">
          <span className="flex h-9 w-9 items-center justify-center bg-[#0078d4] text-white"><ClipboardPaste className="h-5 w-5" /></span>
          <div>
            <h2 id="paste-format-title" className="text-sm font-extrabold text-slate-900 dark:text-white">Text einfügen</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Wie soll der kopierte Inhalt übernommen werden?</p>
          </div>
        </header>
        <div className="grid gap-2 p-5 sm:grid-cols-2">
          <button type="button" autoFocus onClick={() => insertClipboardContent(true)} className="flex min-h-[86px] items-start gap-3 border border-[#0078d4] bg-blue-50 p-3 text-left hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-950/50">
            <Paintbrush className="mt-0.5 h-5 w-5 shrink-0 text-[#0078d4]" />
            <span><strong className="block text-xs text-slate-900 dark:text-white">Formatierung beibehalten</strong><span className="mt-1 block text-[11px] leading-4 text-slate-600 dark:text-slate-300">Schrift, Farben, Links, Listen und Absatzformatierung der Quelle übernehmen.</span></span>
          </button>
          <button type="button" onClick={() => insertClipboardContent(false)} className="flex min-h-[86px] items-start gap-3 border border-slate-300 bg-white p-3 text-left hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700">
            <FileType2 className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <span><strong className="block text-xs text-slate-900 dark:text-white">Nur Text übernehmen</strong><span className="mt-1 block text-[11px] leading-4 text-slate-600 dark:text-slate-300">Formatierung entfernen und den Inhalt an die aktuelle E-Mail anpassen.</span></span>
          </button>
        </div>
        <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-[#0f172a]">
          <button type="button" onClick={() => setPendingPaste(null)} className="border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">Abbrechen</button>
        </footer>
      </div>
    </div>,
    document.body
  ) : null;

  return { handlePaste, pastePrompt };
}
