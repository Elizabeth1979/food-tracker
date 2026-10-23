import { useState } from 'react';
import { articlesOf, type Article, type Inline } from './guide';
import { Group, Modal } from './ui';
import { Icon } from './icons';

const ARTICLES = articlesOf(import.meta.glob<string>('./articles/*.md', { query: '?raw', import: 'default', eager: true }));

// Sources open in a new tab, so the article stays where it was; screen readers are told so.
const Text = ({ parts }: { parts: Inline[] }) => parts.map((p, i) =>
  p.href ? <a key={i} href={p.href} target="_blank" rel="noopener">{p.text}<span className="sr-only"> (נפתח בלשונית חדשה)</span></a>
    : p.bold ? <b key={i}>{p.text}</b> : p.text);

function Read({ a, onClose }: { a: Article; onClose: () => void }) {
  return (
    <Modal title={a.title} onClose={onClose}>
      <article>
        {a.blocks.map((b, i) => b.kind === 'ul' ? <ul key={i}>{b.items.map((it, j) => <li key={j}><Text parts={it} /></li>)}</ul>
          : b.kind === 'h' ? <h3 key={i}><Text parts={b.parts} /></h3> : <p key={i}><Text parts={b.parts} /></p>)}
      </article>
    </Modal>
  );
}

// "מדריך": short articles on calories and macros, tied to what the app does. Opened from Settings.
export default function Guide() {
  const [open, setOpen] = useState<Article | null>(null);
  return (
    <div className="stack">
      <h1 className="page-title">מדריך</h1>
      <Group title="כתבות קצרות על קלוריות ותזונה" body="">
        {ARTICLES.map((a) => (
          <button key={a.slug} className="row" onClick={() => setOpen(a)}>
            <span className="grow"><b>{a.title}</b><small className="muted">{a.lede} · {a.minutes} דק׳ קריאה</small></span>
            <Icon name="chevron-left" />
          </button>
        ))}
      </Group>
      {open && <Read a={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
