const TOKEN_RE = /\s+|'[^']*'?|"(?:[^"\\]|\\.)*"?|\\.|[^\s'"\\]+/g;

export function parse(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(input)) !== null) {
    const token = match[0];

    if (/^\s/.test(token)) {
      if (current) args.push(current);
      current = '';
    } else if (token.charCodeAt(0) === 0x27) {
      current += token.length > 1 && token.charCodeAt(token.length - 1) === 0x27
        ? token.slice(1, -1)
        : token.slice(1);
    } else if (token.charCodeAt(0) === 0x22) {
      const inner = token.length > 1 && token.charCodeAt(token.length - 1) === 0x22
        ? token.slice(1, -1)
        : token.slice(1);
      current += inner.replace(/\\(["\\$`\n])/g, '$1');
    } else if (token.charCodeAt(0) === 0x5c) {
      current += token[1] ?? '';
    } else {
      current += token;
    }
  }

  if (current) args.push(current);
  return args;
}
