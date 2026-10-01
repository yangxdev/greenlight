/**
 * The house-style guard, run by `npm run lint`. CLAUDE.md → "Look & feel" explains the style; this script fails the
 * build on the habits that make a generated page look generated: rounded cards, drop shadows, gradients, frosted
 * glass, spinners, hardcoded colours and emoji. Deterministic on purpose: no judgement, just the hard rules.
 *
 * A line that genuinely needs an exception carries `style-guard-ignore: <reason>` in a comment on it or on the
 * line above.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface Violation {
  file: string;
  line: number;
  found: string;
  rule: string;
}

interface Rule {
  rule: string;
  /** Tests one utility with its variants (`hover:`, `md:`) and important marks already removed. */
  test: (utility: string) => boolean;
  /** Bare words like `rounded` or `shadow` also occur in prose; only flag them inside a class list. */
  classListOnly?: boolean;
}

const RULES: Rule[] = [
  {
    rule: 'square corners: only status dots are round (rounded-full)',
    test: (u) => /^rounded-/.test(u) && !/^rounded-(full|none)$/.test(u),
  },
  {
    rule: 'square corners: only status dots are round (rounded-full)',
    test: (u) => u === 'rounded',
    classListOnly: true,
  },
  {
    rule: 'no shadows: separate with hairlines (border-line); only a dialog or drawer uses shadow-(--shadow-panel)',
    test: (u) => /^shadow-/.test(u) && !/^shadow-(none|\(--shadow-panel\))$/.test(u),
  },
  {
    rule: 'no shadows: separate with hairlines (border-line)',
    test: (u) => u === 'shadow',
    classListOnly: true,
  },
  { rule: 'no gradients', test: (u) => /^(bg-(linear|radial|conic|gradient)|from|via)-/.test(u) },
  {
    rule: 'no gradient or clipped text',
    test: (u) => u === 'bg-clip-text' || u === 'text-transparent',
  },
  {
    rule: 'no blur or frosted glass: the header is solid canvas',
    test: (u) => /^(backdrop-)?blur-/.test(u),
  },
  {
    rule: 'no blur or frosted glass',
    test: (u) => u === 'blur' || u === 'backdrop-blur',
    classListOnly: true,
  },
  {
    rule: 'no spinners or bouncing: a Skeleton (animate-pulse) is the one loading state',
    test: (u) => /^animate-/.test(u) && u !== 'animate-pulse',
  },
  {
    rule: 'colours come from the tokens in src/index.css',
    test: (u) => /\[\s*(#|rgba?\(|hsla?\(|oklch\(|oklab\(|color\()/i.test(u),
  },
  { rule: 'no serif type', test: (u) => u === 'font-serif' },
];

const COLOUR_LITERAL = /^\s*(#[0-9a-f]{3,8}|(rgba?|hsla?|oklch|oklab)\(.*\))\s*$/i;
/** Pictographs, minus the typographic ones that happen to be in the emoji set: © ® ™ and arrows (↗ for external links). */
const EMOJI = /(?![©®™←-⇿])\p{Extended_Pictographic}|️/u;
const IGNORE = 'style-guard-ignore';

interface Literal {
  text: string;
  line: number;
}

/** String and template literals (template expressions blanked out), and the code with comments removed. */
function scan(source: string): { literals: Literal[]; code: string } {
  const literals: Literal[] = [];
  let code = '';
  let line = 1;
  let i = 0;
  while (i < source.length) {
    const c = source[i] as string;
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      const skipped = source.slice(i, stop);
      const newlines = skipped.split('\n').length - 1;
      line += newlines;
      code += '\n'.repeat(newlines);
      i = stop;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const start = line;
      let text = '';
      let depth = 0;
      i++;
      while (i < source.length) {
        const d = source[i] as string;
        if (d === '\n') line++;
        if (depth === 0 && d === '\\') {
          text += source.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c === '`' && depth === 0 && d === '$' && source[i + 1] === '{') {
          depth = 1;
          text += ' ';
          i += 2;
          continue;
        }
        if (depth > 0) {
          if (d === '{') depth++;
          if (d === '}') depth--;
          i++;
          continue;
        }
        if (d === c || (c !== '`' && d === '\n')) break;
        text += d;
        i++;
      }
      i++;
      literals.push({ text, line: start });
      code += c + text + c;
      continue;
    }
    if (c === '\n') line++;
    code += c;
    i++;
  }
  return { literals, code };
}

/** `hover:md:!rounded-lg` → `rounded-lg`; brackets may contain colons. */
function utilityOf(token: string): string {
  let depth = 0;
  let start = 0;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) start = i + 1;
  }
  return token.slice(start).replace(/^!|!$/g, '');
}

/** Heuristic: every word looks like a utility, and at least one has a dash, a colon or a bracket. */
function isClassList(words: string[]): boolean {
  return (
    words.length > 0 &&
    words.every((w) => /^[!-]?[a-z0-9@*[(][^\sA-Z]*$/.test(w) || /[[(]/.test(w)) &&
    words.some((w) => /[-:[]/.test(w))
  );
}

export function findViolations(source: string, file: string): Violation[] {
  const lines = source.split('\n');
  const ignored = (line: number) =>
    (lines[line - 1] ?? '').includes(IGNORE) || (lines[line - 2] ?? '').includes(IGNORE);
  const { literals, code } = scan(source);
  const found: Violation[] = [];

  for (const { text, line } of literals) {
    if (ignored(line)) continue;
    if (COLOUR_LITERAL.test(text)) {
      found.push({
        file,
        line,
        found: text.trim(),
        rule: 'colours come from the tokens in src/index.css',
      });
      continue;
    }
    const words = text.split(/\s+/).filter(Boolean);
    const classList = isClassList(words);
    for (const word of words) {
      const utility = utilityOf(word);
      const rule = RULES.find((r) => (!r.classListOnly || classList) && r.test(utility));
      if (rule) found.push({ file, line, found: word, rule: rule.rule });
    }
  }

  code.split('\n').forEach((text, index) => {
    const match = EMOJI.exec(text);
    if (match && !ignored(index + 1)) {
      found.push({
        file,
        line: index + 1,
        found: match[0],
        rule: 'no emoji in the UI: words or a Lucide icon',
      });
    }
  });
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'test' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function main(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const violations = sourceFiles(join(root, 'src')).flatMap((path) =>
    findViolations(readFileSync(path, 'utf8'), relative(root, path)),
  );
  for (const v of violations) console.error(`${v.file}:${v.line}  ${v.found}  ${v.rule}`);
  if (violations.length > 0) {
    console.error(
      `\nHouse-style guard: ${violations.length} problem(s). See CLAUDE.md → "Look & feel". ` +
        `A real exception takes a "${IGNORE}: <reason>" comment.`,
    );
    process.exit(1);
  }
  console.log('House-style guard: clean.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
