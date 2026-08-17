#!/usr/bin/env node
/**
 * Fails if a tracked text file contains characters that should never be in this
 * site's copy.
 *
 *   node scripts/check-text.mjs            report and exit non-zero on a hit
 *   node scripts/check-text.mjs --fix      strip or normalise them in place
 *
 * Two separate reasons for this to exist:
 *
 *   1. Invisible characters. Zero-width spaces, byte order marks, bidi controls
 *      and Unicode tag characters carry no meaning in prose. They arrive by
 *      copy-paste out of editors, PDFs, browsers and chat tools, they survive
 *      review because nobody can see them, and they break search matching and
 *      diffing. Tools like unixwzrd/UnicodeFix and spencermountain/out-of-character
 *      exist to strip exactly these. Running one is a no-op on a clean tree,
 *      which is the point of checking on every push instead.
 *
 *   2. House style. No em dashes and no en dashes in copy, ever.
 *
 * Deliberately NOT flagged: the middle dot U+00B7, which is this site's title
 * and meta separator, and curly quotes, which are correct typography.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IGNORED_DIRS = new Set(['.git', '.github', 'node_modules', 'katex', 'uploads']);
const EXTENSIONS = new Set(['.html', '.css', '.js', '.mjs', '.xml', '.txt', '.json', '.md']);

/**
 * Invisible characters are wrong in any file, source included.
 * codepoint -> [name, replacement]. An empty replacement means delete.
 */
const RULES = new Map([
  [0x200b, ['zero width space', '']],
  [0x200c, ['zero width non-joiner', '']],
  [0x200d, ['zero width joiner', '']],
  [0x2060, ['word joiner', '']],
  [0xfeff, ['byte order mark / zero width no-break space', '']],
  [0x00ad, ['soft hyphen', '']],
  [0x180e, ['mongolian vowel separator', '']],
  [0x061c, ['arabic letter mark', '']],
  [0x200e, ['left-to-right mark', '']],
  [0x200f, ['right-to-left mark', '']],
  [0x202a, ['left-to-right embedding', '']],
  [0x202b, ['right-to-left embedding', '']],
  [0x202c, ['pop directional formatting', '']],
  [0x202d, ['left-to-right override', '']],
  [0x202e, ['right-to-left override', '']],
  [0x00a0, ['no-break space', ' ']],
  [0x202f, ['narrow no-break space', ' ']],
  [0x2009, ['thin space', ' ']],
  [0x2007, ['figure space', ' ']],
  [0x2028, ['line separator', '\n']],
  [0x2029, ['paragraph separator', '\n']],
]);

/**
 * House style applies to copy, not to source comments, so the dash rules run on
 * the files a reader actually sees. A stray em dash in a CSS header comment is
 * nobody's problem; one in a note is.
 */
const COPY_EXTENSIONS = new Set(['.html', '.md']);
const COPY_RULES = new Map([
  [0x2014, ['em dash (house style: never in copy)', ', ']],
  [0x2013, ['en dash (house style: never in copy)', '-']],
]);

/** U+E0000..U+E007F, the tag block, used to hide data inside ordinary text. */
const isTagChar = (cp) => cp >= 0xe0000 && cp <= 0xe007f;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(extname(entry))) out.push(full);
  }
  return out;
}

const fix = process.argv.includes('--fix');
const files = walk(ROOT);
let findings = 0;
let changed = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let text = original;
  const hits = new Map();

  const isCopy = COPY_EXTENSIONS.has(extname(file));
  const rulesFor = (cp) => RULES.get(cp) ?? (isCopy ? COPY_RULES.get(cp) : undefined);

  for (const ch of original) {
    const cp = ch.codePointAt(0);
    if (rulesFor(cp) || isTagChar(cp)) hits.set(cp, (hits.get(cp) ?? 0) + 1);
  }

  if (!hits.size) continue;

  const rel = relative(ROOT, file);
  for (const [cp, count] of hits) {
    const name = rulesFor(cp)?.[0] ?? 'unicode tag character';
    // Line numbers make a hit actionable; an invisible character is otherwise
    // very hard to locate by hand.
    const lines = original.split('\n')
      .map((l, i) => (l.includes(String.fromCodePoint(cp)) ? i + 1 : 0))
      .filter(Boolean);
    console.log(
      `${rel}:${lines.slice(0, 5).join(',')}${lines.length > 5 ? ',…' : ''}  ` +
      `U+${cp.toString(16).toUpperCase().padStart(4, '0')}  ${name}  x${count}`
    );
    findings += count;
  }

  if (fix) {
    for (const [cp] of hits) {
      const replacement = rulesFor(cp)?.[1] ?? '';
      text = text.split(String.fromCodePoint(cp)).join(replacement);
    }
    if (text !== original) {
      writeFileSync(file, text);
      changed++;
    }
  }
}

if (!findings) {
  console.log(`No invisible or out-of-style characters in ${files.length} files.`);
  process.exit(0);
}

if (fix) {
  console.log(`\nFixed ${findings} occurrence(s) across ${changed} file(s).`);
  process.exit(0);
}

console.log(`\n${findings} occurrence(s). Run: node scripts/check-text.mjs --fix`);
process.exit(1);
