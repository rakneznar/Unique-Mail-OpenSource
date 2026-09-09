export type RecipientToken = {
  email: string;
  displayName: string;
  raw: string;
};

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function splitRecipientEntries(value: string): string[] {
  const entries: string[] = [];
  let current = '';
  let angleDepth = 0;
  let quote = '';
  for (const character of String(value || '')) {
    if ((character === '"' || character === "'") && (!quote || quote === character)) quote = quote ? '' : character;
    if (!quote && character === '<') angleDepth += 1;
    if (!quote && character === '>') angleDepth = Math.max(0, angleDepth - 1);
    if (!quote && angleDepth === 0 && (character === ',' || character === ';' || character === '\r' || character === '\n')) {
      if (current.trim()) entries.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) entries.push(current.trim());
  return entries;
}

export function recipientTokenFromText(value: string): RecipientToken | null {
  const raw = String(value || '').trim().replace(/[;,]+$/, '').trim();
  if (!raw) return null;
  const bracketMatch = raw.match(/^(.*?)\s*<([^<>]+)>$/);
  const email = (bracketMatch?.[2] || raw).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return null;
  const displayName = (bracketMatch?.[1] || '').trim().replace(/^["']|["']$/g, '');
  const serializedName = /[,;]/.test(displayName) ? `"${displayName.replace(/"/g, '')}"` : displayName;
  return {
    email,
    displayName,
    raw: displayName ? `${serializedName} <${email}>` : email,
  };
}

export function parseRecipientTokens(value: string): RecipientToken[] {
  const seen = new Set<string>();
  return String(value || '')
    ? splitRecipientEntries(value)
    .map(recipientTokenFromText)
    .filter((token): token is RecipientToken => {
      if (!token || seen.has(token.email)) return false;
      seen.add(token.email);
      return true;
    })
    : [];
}

export function serializeRecipientTokens(tokens: RecipientToken[], draft = ''): string {
  return [...tokens.map(token => token.raw), draft.trim()].filter(Boolean).join('; ');
}
