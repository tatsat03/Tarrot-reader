import { $, el, store } from './util.js';
import { cardById } from '../data/deck.js';
import { cardThumb } from './textures.js';

const KEY = 'oracle.history';
export const listHistory = () => store.get(KEY, []);
export function saveHistory(record) {
  const all = [record, ...listHistory().filter((r) => r.id !== record.id)].slice(0, 50);
  return store.set(KEY, all);
}
export function deleteHistory(id) { store.set(KEY, listHistory().filter((r) => r.id !== id)); }

export function threadLine(r) {
  const k = r.entries.map((e) => cardById(e.cardId)?.keys[0].toLowerCase()).filter(Boolean);
  if (k.length === 1) return `One card, one word to carry: ${k[0]}.`;
  if (k.length === 2) return `From ${k[0]}, toward ${k[1]}.`;
  return `From ${k[0]}, through ${k.slice(1, -1).join(', ')}, toward ${k[k.length - 1]}.`;
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
export const who = (r) => (r.players && r.players.length === 2 ? `${r.players[0]} & ${r.players[1]}` : 'Solo');

export function renderJournal(r) {
  $('j-date').textContent = `${fmtDate(r.date)} · ${r.spreadName} · ${who(r)} · ${r.deck === 'full' ? 'Full deck' : 'Major Arcana'}`;
  $('j-title').textContent = r.players && r.players.length === 2 ? `${r.players[0]} & ${r.players[1]}'s Reflection` : 'Your Reflection';
  $('j-intent').textContent = r.intent ? `You came carrying: “${r.intent}”` : 'You came without naming what you carried.';
  $('j-entries').replaceChildren(...r.entries.map((e) => {
    const card = cardById(e.cardId);
    const box = el('div', 'entry');
    const img = el('img', 'thumb' + (e.reversed ? ' rev' : ''));
    img.src = cardThumb(card); img.alt = card.name;
    const body = el('div', 'entry-body');
    body.append(
      el('div', 'pos', e.position),
      el('h3', '', card.name + (e.reversed ? ' · reversed' : '')),
      el('div', 'keys', card.keys.join(' · ')),
      el('div', 'q', e.question),
    );
    for (const a of e.answers) {
      const line = el('div', a.text ? 'a' : 'a silent');
      if (a.who) line.append(el('b', '', a.about ? `${a.who}, about ${a.about}: ` : `${a.who}: `));
      line.append(document.createTextNode(a.text || 'Held in silence.'));
      body.append(line);
    }
    box.append(img, body);
    return box;
  }));
  $('j-synthesis').textContent = r.synthesis || '';
  $('j-synthesis').hidden = !r.synthesis;
  $('j-thread').textContent = threadLine(r);
}

export function journalText(r) {
  const lines = [`The Oracle's Chamber — ${fmtDate(r.date)}`, `${r.spreadName} · ${who(r)} · ${r.deck === 'full' ? 'Full deck' : 'Major Arcana'}`, ''];
  lines.push(`Intention: ${r.intent || '(unspoken)'}`, '');
  for (const e of r.entries) {
    lines.push(`${e.position.toUpperCase()} — ${e.name}${e.reversed ? ' (reversed)' : ''}`);
    lines.push(`  ${e.question}`);
    for (const a of e.answers) lines.push(`  ${a.who ? (a.about ? `${a.who}, about ${a.about}` : a.who) : 'You'}: ${a.text || '(silence)'}`);
    lines.push('');
  }
  if (r.synthesis) lines.push(`Seraphine: ${r.synthesis}`, '');
  lines.push(threadLine(r));
  return lines.join('\n');
}
export function downloadJournal(r) {
  const blob = new Blob([journalText(r)], { type: 'text/plain' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `oracle-reflection-${r.date.slice(0, 10)}.txt` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
