const MAIL_HTML_TAG_PATTERN = /<(?:!doctype|html|head|body|title|p|div|span|br|hr|table|thead|tbody|tfoot|tr|td|th|img|a|blockquote|ul|ol|li|h[1-6]|font|strong|em|b|i|u|s|pre|section|article|header|footer|main)(?:\s[^<>]*?)?\s*\/?\s*>/i;

export const looksLikeHtmlMailBody = (value: string) => MAIL_HTML_TAG_PATTERN.test(String(value || ''));
