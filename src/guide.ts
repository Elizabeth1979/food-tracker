// The guide's articles are Markdown files in src/articles/. This reads the small part of Markdown they use:
// "# " title, "## " headings, "- " list items, paragraphs, and inline **bold** and [text](https://…) links.
// No data-layer imports, so tests can run it directly.
export type Inline = { text: string; bold?: boolean; href?: string };
export type Block = { kind: 'h' | 'p'; parts: Inline[] } | { kind: 'ul'; items: Inline[][] };
export type Article = { slug: string; title: string; lede: string; minutes: number; blocks: Block[] };

const INLINE = /\*\*(.+?)\*\*|\[(.+?)\]\((https:\/\/[^)\s]+)\)/g;
export function inline(s: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index > at) out.push({ text: s.slice(at, m.index) });
    out.push(m[1] ? { text: m[1], bold: true } : { text: m[2], href: m[3] });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ text: s.slice(at) });
  return out;
}

// Reading time at about 180 words a minute (Hebrew packs more into a word than English).
const minutesOf = (md: string) => Math.max(1, Math.round(md.split(/\s+/).length / 180));

export function parseArticle(slug: string, md: string): Article {
  const lines = md.split('\n');
  const title = lines.find((l) => l.startsWith('# '))?.slice(2).trim() ?? slug;
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) blocks.push({ kind: 'p', parts: inline(para.join(' ')) }); para = []; };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith('# ')) { flush(); continue; }
    if (l.startsWith('## ')) { flush(); blocks.push({ kind: 'h', parts: inline(l.slice(3)) }); }
    else if (l.startsWith('- ')) {
      flush();
      const last = blocks.at(-1);
      if (last?.kind === 'ul') last.items.push(inline(l.slice(2))); else blocks.push({ kind: 'ul', items: [inline(l.slice(2))] });
    }
    else para.push(l);
  }
  flush();
  const first = blocks.find((b) => b.kind === 'p');
  const lede = first?.kind === 'p' ? first.parts.map((p) => p.text).join('') : '';
  return { slug, title, lede, minutes: minutesOf(md), blocks };
}

// File name → article, in file-name order (the files start with a number).
export const articlesOf = (files: Record<string, string>) =>
  Object.keys(files).sort().map((path) => parseArticle(path.replace(/^.*\/|\.md$/g, ''), files[path]));
