import { $, el } from './util.js';
import { state } from './state.js';
import { DECK, SUITS } from '../data/deck.js';
import { cardThumb } from './textures.js';
import { groupFor, inPlay, ensureFront, focusPose, moveCard, stackDeck } from './cards.js';
import { showOverlay, cardSubtitle } from './ui.js';
import { O, setOracleColor } from './oracle.js';
import { ball } from './room.js';
import { voice, sfx } from './audio.js';
import { askAboutCard, agentStatus } from './agent.js';
import { currentProfile, profileBrief } from './profiles.js';
import { historyFor } from './journal.js';

const GUIDE = [
  ['What is tarot?', "Tarot is a deck of 78 illustrated cards. It began in fifteenth-century Italy as a card game called tarocchi; only in the 1700s did people start reading the cards for meaning. Most modern decks follow the Rider–Waite–Smith cards, painted by Pamela Colman Smith in 1909. In this chamber, the cards are a mirror: each one is a prompt to notice something about yourself, not a prediction."],
  ['The Major Arcana', "Twenty-two cards, numbered 0 to XXI, for the big themes and turning points of a life. Read in order, they tell the Fool's journey: The Fool sets out, meets teachers (the Magician, the High Priestess), structures (the Emperor, the Hierophant), trials (Death, the Tower), and finally arrives at wholeness in The World."],
  ['The Minor Arcana', "Fifty-six cards in four suits — the everyday weather of life. Each suit has ten numbered cards (Ace to Ten) and four court cards. Aces are pure potential, the middle numbers develop the story, and Tens complete it."],
  ['Suits and elements', "Wands are Fire: passion, will, creativity and action. Cups are Water: feelings, love, intuition and relationships. Swords are Air: thought, truth, communication and conflict. Pentacles are Earth: the body, work, money and home."],
  ['Court cards', "Pages are students and messengers — curiosity and new beginnings. Knights are movement and pursuit, sometimes too much of it. Queens hold their suit's energy inwardly and nurture it. Kings express it outwardly, with authority. Court cards often stand for a person, or a part of yourself."],
  ['Reversed cards', "When a card lands upside down it is 'reversed'. A reversal isn't bad news: it's the same energy blocked, turned inward, overdone, or asking for a different kind of attention. You can switch reversals on or off when you set up a reading."],
  ['Reading a spread', "A spread gives each card a position — past, present, future; you, them, the bond. Read the card through the lens of its position, then notice how the cards speak to each other: repeated suits, many Major Arcana, a story running left to right. Your first gut reaction usually matters most."],
];
const SUGGEST = [
  'What does this card mean in love?',
  'What does it mean reversed?',
  'Tell me about the imagery.',
  'How can I work with this energy today?',
];
const FILTERS = [
  ['all', 'All 78'], ['major', 'Major Arcana'], ['wands', 'Wands'], ['cups', 'Cups'], ['swords', 'Swords'], ['pentacles', 'Pentacles'], ['guide', 'Learn the basics'],
];

let filter = 'all', query = '', current = null, onExit = null;
const chats = new Map(); // card id → [{role, content}]

const root = $('library');
const browse = root.querySelector('.lib-browse');
const detail = root.querySelector('.lib-detail');
const grid = $('lib-grid');
const guide = $('lib-guide');

/* ---------- browse ---------- */
function renderTabs() {
  $('lib-tabs').replaceChildren(...FILTERS.map(([id, label]) => {
    const b = el('button', 'tab' + (id === filter ? ' on' : ''), label);
    b.onclick = () => { filter = id; renderTabs(); renderGrid(); };
    return b;
  }));
}
function matches(card) {
  if (filter === 'major' && card.arcana !== 'major') return false;
  if (SUITS[filter] && card.suit !== filter) return false;
  if (!query) return true;
  const hay = `${card.name} ${card.keys.join(' ')} ${card.meaning} ${card.reversed} ${card.astro}`.toLowerCase();
  return query.split(/\s+/).every((w) => hay.includes(w));
}
function renderGrid() {
  const showGuide = filter === 'guide';
  guide.hidden = !showGuide;
  grid.hidden = showGuide;
  $('lib-search').hidden = showGuide;
  if (showGuide) {
    guide.replaceChildren(...GUIDE.map(([h, p]) => { const s = el('section'); s.append(el('h3', '', h), el('p', '', p)); return s; }));
    return;
  }
  const cards = DECK.filter(matches);
  grid.replaceChildren(...(cards.length ? cards.map((card) => {
    const b = el('button', 'lib-card');
    const img = el('img'); img.loading = 'lazy'; img.alt = ''; img.src = cardThumb(card);
    b.append(img, el('span', 'n', card.name), el('span', 's', card.keys.slice(0, 2).join(' · ')));
    b.onclick = () => openCard(card);
    return b;
  }) : [el('p', 'empty', 'No card answers to that. Try another word.')]));
}
$('lib-search').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); renderGrid(); });

/* ---------- one card ---------- */
function section(title, text) { const s = el('section'); s.append(el('h4', '', title), el('p', '', text)); return s; }

function renderInfo(card) {
  $('lib-sub').textContent = cardSubtitle(card);
  $('lib-name').textContent = card.name;
  $('lib-chips').replaceChildren(...card.keys.map((k) => el('span', '', k)));
  const suit = card.suit ? SUITS[card.suit] : null;
  $('lib-sections').replaceChildren(
    section('Upright', card.meaning),
    section('Reversed', card.reversed),
    section('In the imagery', card.symbols),
    section(suit ? 'Element' : 'Correspondence', suit ? `${suit.element} — ${suit.domain}.` : card.astro),
    section('A question to sit with', card.question),
  );
}

function renderChat(card) {
  const log = $('lib-log');
  const hist = chats.get(card.id) || [];
  log.replaceChildren(...hist.map((m) => el('div', `msg ${m.role === 'user' ? 'me' : 'her'}`, m.content)));
  if (!hist.length) log.append(el('div', 'msg her', `Ask me anything about ${card.name} — what it means, what it might say about your situation, or why it looks the way it does.`));
  $('lib-suggest').replaceChildren(...SUGGEST.map((s) => { const b = el('button', 'chip', s); b.onclick = () => send(s); return b; }));
  const st = agentStatus();
  $('lib-agent').textContent = st.online ? '' : 'Seraphine is answering from her notes. Connect Claude for real conversation — see Settings.';
  $('lib-agent').hidden = st.online;
  log.scrollTop = log.scrollHeight;
}

async function send(text) {
  const q = text.trim();
  if (!q || !current) return;
  const card = current, hist = chats.get(card.id) || [];
  chats.set(card.id, hist);
  $('lib-input').value = '';
  const log = $('lib-log');
  log.append(el('div', 'msg me', q));
  const wait = el('div', 'msg her thinking', 'Seraphine gazes into the glass');
  log.append(wait);
  log.scrollTop = log.scrollHeight;
  $('lib-send').disabled = true;
  O.thinking = true;
  sfx.tick();
  let reply;
  const me = currentProfile();
  try { reply = await askAboutCard(card, hist.slice(-12), q, me ? profileBrief(me, historyFor(me.id)) : ''); }
  finally { O.thinking = false; $('lib-send').disabled = false; }
  hist.push({ role: 'user', content: q }, { role: 'assistant', content: reply });
  if (current !== card) return;
  wait.classList.remove('thinking');
  wait.textContent = reply;
  log.scrollTop = log.scrollHeight;
  voice.speak(reply);
}
$('lib-form').addEventListener('submit', (e) => { e.preventDefault(); send($('lib-input').value); });

async function openCard(card) {
  if (current) await putBack();
  current = card;
  browse.hidden = true;
  detail.hidden = false;
  root.classList.add('detail');
  renderInfo(card);
  renderChat(card);
  $('lib-rev').textContent = 'Show reversed';
  detail.scrollTop = 0;

  const g = groupFor(card);
  g.visible = true;
  ensureFront(g);
  g.userData.state = 'inspect';
  g.userData.spin = 0;
  state.mode = 'inspect';
  state.focus = g;
  ball.target.set(card.color);
  setOracleColor(card.color);
  sfx.whoosh(0.9);
  const fp = focusPose(-0.62);
  await moveCard(g, { pos: fp.pos, quat: fp.quat, scale: 0.95, flip: 0, rev: 0 }, { duration: 1.0, arc: 0.2 });
  if (current === card) { g.userData.haloTarget = 1; sfx.chime(); }
}

// Return the inspected card to the deck (or out of sight if it isn't in the current deck).
async function putBack() {
  const card = current;
  if (!card) return;
  current = null;
  const g = groupFor(card);
  g.userData.haloTarget = 0;
  g.userData.spin = 0;
  state.focus = null;
  state.mode = 'idle';
  if (inPlay.includes(g)) {
    await stackDeck(false);
  } else {
    await moveCard(g, { pos: g.userData.pos.clone().add({ x: 0, y: -1.5, z: 0 }), scale: 0.4 }, { duration: 0.6 });
    if (g.userData.state === 'inspect' && state.focus !== g) { g.visible = false; g.userData.state = 'out'; }
  }
}

function showBrowse() {
  browse.hidden = false;
  detail.hidden = true;
  root.classList.remove('detail');
}

$('lib-back').onclick = () => { putBack(); showBrowse(); };
$('lib-flip').onclick = () => { if (!current) return; const g = groupFor(current); moveCard(g, { flip: g.userData.flip > 1 ? 0 : Math.PI }, { duration: 0.8 }); sfx.tick(); };
$('lib-rev').onclick = () => {
  if (!current) return;
  const g = groupFor(current), toRev = g.userData.rev < 1;
  moveCard(g, { rev: toRev ? Math.PI : 0, flip: 0 }, { duration: 0.8 });
  $('lib-rev').textContent = toRev ? 'Show upright' : 'Show reversed';
  sfx.tick();
};
root.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => closeLibrary()));

export function openLibrary(exit) {
  onExit = exit;
  state.view = 'library';
  showOverlay('library');
  showBrowse();
  renderTabs();
  renderGrid();
}
export async function closeLibrary() {
  putBack();
  $('lib-rev').textContent = 'Show reversed';
  showBrowse();
  onExit && onExit();
}
