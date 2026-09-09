import React from 'react';
import { X } from 'lucide-react';
import { parseRecipientTokens, recipientTokenFromText, serializeRecipientTokens, type RecipientToken } from '../utils/recipients';

export type RecipientSuggestion = {
  email: string;
  displayName?: string;
  useCount?: number;
  lastUsedAt?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions?: RecipientSuggestion[];
  placeholder?: string;
  ariaLabel: string;
};

export default function RecipientChipInput({ value, onChange, suggestions = [], placeholder, ariaLabel }: Props) {
  const [tokens, setTokens] = React.useState<RecipientToken[]>(() => parseRecipientTokens(value));
  const [draft, setDraft] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(0);
  const emittedValueRef = React.useRef(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (value === emittedValueRef.current) return;
    setTokens(parseRecipientTokens(value));
    setDraft('');
    emittedValueRef.current = value;
  }, [value]);

  const emit = (nextTokens: RecipientToken[], nextDraft = '') => {
    const nextValue = serializeRecipientTokens(nextTokens, nextDraft);
    emittedValueRef.current = nextValue;
    onChange(nextValue);
  };

  const commitToken = (candidate?: RecipientSuggestion | string) => {
    const source = typeof candidate === 'string'
      ? candidate
      : candidate
        ? (candidate.displayName ? `${candidate.displayName} <${candidate.email}>` : candidate.email)
        : draft;
    const token = recipientTokenFromText(source);
    if (!token) return false;
    const nextTokens = tokens.some(existing => existing.email === token.email) ? tokens : [...tokens, token];
    setTokens(nextTokens);
    setDraft('');
    setHighlighted(0);
    emit(nextTokens);
    return true;
  };

  const visibleSuggestions = React.useMemo(() => {
    const query = draft.trim().toLowerCase();
    if (!query) return [];
    const selected = new Set(tokens.map(token => token.email));
    return suggestions
      .filter(candidate => !selected.has(candidate.email.toLowerCase()))
      .filter(candidate => candidate.email.toLowerCase().includes(query) || String(candidate.displayName || '').toLowerCase().includes(query))
      .sort((a, b) => {
        const aPrefix = a.email.toLowerCase().startsWith(query) || String(a.displayName || '').toLowerCase().startsWith(query) ? 1 : 0;
        const bPrefix = b.email.toLowerCase().startsWith(query) || String(b.displayName || '').toLowerCase().startsWith(query) ? 1 : 0;
        return bPrefix - aPrefix || (b.useCount || 0) - (a.useCount || 0) || String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || ''));
      })
      .slice(0, 8);
  }, [draft, suggestions, tokens]);

  const removeToken = (email: string) => {
    const nextTokens = tokens.filter(token => token.email !== email);
    setTokens(nextTokens);
    emit(nextTokens, draft);
    inputRef.current?.focus();
  };

  return (
    <div className="relative min-w-0 flex-1">
      <div
        className="flex min-h-[32px] w-full cursor-text flex-wrap items-center gap-1 border border-slate-200 bg-white px-1.5 py-1 text-[11.5px] transition-all focus-within:border-[#0078d4] focus-within:ring-2 focus-within:ring-[#0078d4]/10 dark:border-[#334155] dark:bg-[#1e293b]"
        onClick={() => inputRef.current?.focus()}
      >
        {tokens.map(token => (
          <span key={token.email} title={token.raw} className="inline-flex h-6 max-w-[240px] items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 font-semibold text-blue-900 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-100">
            <span className="truncate">{token.displayName || token.email}</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); removeToken(token.email); }} className="shrink-0 text-blue-600 hover:text-red-600 dark:text-blue-300" title={`${token.email} entfernen`} aria-label={`${token.email} entfernen`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => {
            const next = event.target.value;
            if (/[;,]/.test(next)) {
              const parts = next.split(/[;,]/);
              let nextTokens = tokens;
              parts.slice(0, -1).forEach(part => {
                const token = recipientTokenFromText(part);
                if (token && !nextTokens.some(existing => existing.email === token.email)) nextTokens = [...nextTokens, token];
              });
              const remainder = parts.at(-1) || '';
              setTokens(nextTokens);
              setDraft(remainder);
              emit(nextTokens, remainder);
            } else {
              setDraft(next);
              setHighlighted(0);
              emit(tokens, next);
            }
          }}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text');
            if (!/[;,\r\n]/.test(pasted)) return;
            event.preventDefault();
            const incoming = pasted.split(/[;,\r\n]+/).map(recipientTokenFromText).filter((token): token is RecipientToken => !!token);
            const nextTokens = [...tokens];
            incoming.forEach(token => { if (!nextTokens.some(existing => existing.email === token.email)) nextTokens.push(token); });
            setTokens(nextTokens);
            setDraft('');
            emit(nextTokens);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && visibleSuggestions.length > 0) {
              event.preventDefault();
              setHighlighted(index => (index + 1) % visibleSuggestions.length);
            } else if (event.key === 'ArrowUp' && visibleSuggestions.length > 0) {
              event.preventDefault();
              setHighlighted(index => (index - 1 + visibleSuggestions.length) % visibleSuggestions.length);
            } else if ((event.key === 'Enter' || event.key === 'Tab') && draft.trim()) {
              const suggestion = visibleSuggestions[Math.min(highlighted, visibleSuggestions.length - 1)];
              if (suggestion || recipientTokenFromText(draft)) {
                event.preventDefault();
                commitToken(suggestion || draft);
              }
            } else if (event.key === 'Backspace' && !draft && tokens.length > 0) {
              event.preventDefault();
              removeToken(tokens[tokens.length - 1].email);
            } else if (event.key === 'Escape') {
              setFocused(false);
              inputRef.current?.blur();
            }
          }}
          onBlurCapture={() => { if (recipientTokenFromText(draft)) commitToken(draft); }}
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={focused && visibleSuggestions.length > 0}
          autoComplete="off"
          placeholder={tokens.length === 0 ? placeholder : ''}
          className="h-6 min-w-[150px] flex-1 bg-transparent px-1 font-mono text-slate-800 outline-none dark:text-white"
        />
      </div>
      {focused && visibleSuggestions.length > 0 && (
        <div role="listbox" className="absolute left-0 right-0 top-full z-[10030] mt-1 max-h-64 overflow-y-auto rounded border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
          {visibleSuggestions.map((candidate, index) => (
            <button key={candidate.email} type="button" role="option" aria-selected={index === highlighted} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setHighlighted(index)} onClick={() => commitToken(candidate)} className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left ${index === highlighted ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
              <span className="min-w-0 truncate font-bold text-slate-800 dark:text-slate-100">{candidate.displayName || candidate.email}</span>
              <span className="shrink-0 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">{candidate.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
