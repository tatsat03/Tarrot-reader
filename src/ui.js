import { $, el, sleep } from './util.js';
import { settings } from './state.js';
import { voice, sfx } from './audio.js';
import { O } from './oracle.js';
import { SUITS } from '../data/deck.js';

/* =====================================================================
   Flows: a reading is a long chain of awaits. Leaving it (back to the
   menu) must unblock every pending wait, so they all register here.
   ===================================================================== */
export class Aborted extends Error {}
let flowId = 0;
const pending = new Set();
export function beginFlow() {
  abortFlow();
  const id = flowId;
  return { id, check() { if (id !== flowId) throw new Aborted(); }, get alive() { return id === flowId; } };
}
export function abortFlow() {
  flowId++;
  for (const reject of pending) reject(new Aborted());
  pending.clear();
  advanceResolve = null;
  clearAuto();
  if (typing) typing.finish();
  voice.stop();
  O.thinking = false;
  hideDialogue();
  setPrompt('');
  hideCardPanel();
}
// A promise that rejects with Aborted if the current flow is abandoned.
export function waitable(executor) {
  return new Promise((resolve, reject) => {
    pending.add(reject);
    executor((v) => { pending.delete(reject); resolve(v); });
  });
}

/* =====================================================================
   Dialogue box
   ===================================================================== */
const dlg = $('dialogue'), dlgText = $('dlg-text'), dlgNext = $('dlg-next');
const dlgAsk = $('dlg-ask'), dlgInput = $('dlg-input'), dlgAskQ = $('dlg-askq');
export let typing = null;
let advanceResolve = null;
let autoTimer = 0;

function typeText(text) {
  return new Promise((resolve) => {
    let i = 0;
    dlgText.textContent = '';
    dlgText.classList.remove('thinking');
    const done = () => { clearTimeout(typing && typing.timer); dlgText.textContent = text; typing = null; resolve(); };
    typing = { finish: done, timer: 0 };
    const step = () => {
      i++;
      dlgText.textContent = text.slice(0, i);
      if (i >= text.length) return done();
      const ch = text[i - 1];
      typing.timer = setTimeout(step, /[.?!…]/.test(ch) ? 240 : /[,—]/.test(ch) ? 130 : 22);
    };
    step();
  });
}
function clearAuto() {
  clearTimeout(autoTimer);
  autoTimer = 0;
  dlg.classList.remove('counting');
}
export const showDialogue = () => dlg.classList.add('show');
export const hideDialogue = () => { clearAuto(); dlg.classList.remove('show'); };
export function advance() {
  if (typing) { typing.finish(); return; }
  if (advanceResolve) { clearAuto(); const r = advanceResolve; advanceResolve = null; dlgNext.hidden = true; r(); }
}

// Show a line. Unless the player moves on first (click, Enter or Space), it advances by itself a
// moment after Seraphine finishes speaking it.
export async function say(text, { wait = true, auto = true } = {}) {
  const id = flowId;
  showDialogue();
  dlgAsk.hidden = true; dlgNext.hidden = true;
  clearAuto();
  // resolves when she finishes speaking; capped in case the browser never reports the end
  const spoken = Promise.race([voice.speak(text), sleep(4000 + text.length * 90)]);
  await typeText(text);
  if (id !== flowId) throw new Aborted();
  if (!wait) return;
  dlgNext.hidden = false;
  await waitable((r) => {
    advanceResolve = r;
    if (!auto || !settings.autoAdvance) return;
    spoken.then(() => {
      if (advanceResolve !== r) return;
      // with her voice off, allow a little extra reading time for long lines
      const ms = settings.autoDelay * 1000 + (voice.on ? 0 : Math.min(2500, text.length * 12));
      dlg.style.setProperty('--auto-ms', `${ms}ms`);
      dlg.classList.add('counting');
      autoTimer = setTimeout(() => { if (advanceResolve === r) advance(); }, ms);
    });
  });
}

// While Claude composes a reply: Seraphine gazes into the ball, the dialogue shows a soft ellipsis.
export async function think(fn) {
  showDialogue();
  dlgAsk.hidden = true; dlgNext.hidden = true;
  dlgText.textContent = 'Seraphine gazes into the glass';
  dlgText.classList.add('thinking');
  O.thinking = true;
  try {
    const p = Promise.resolve().then(fn).catch(() => null);
    return await waitable((r) => p.then(r));
  } finally {
    O.thinking = false;
    dlgText.classList.remove('thinking');
  }
}

// Ask the player something. With onQuestion, they may instead put a question to Seraphine first.
export async function ask(text, placeholder, { onQuestion } = {}) {
  let prompt = text;
  const id = flowId;
  for (;;) {
    showDialogue();
    dlgAsk.hidden = true; dlgNext.hidden = true;
    voice.speak(prompt);
    await typeText(prompt);
    if (id !== flowId) throw new Aborted();
    dlgInput.value = '';
    dlgInput.placeholder = placeholder;
    dlgAskQ.hidden = !onQuestion;
    dlgAsk.hidden = false;
    setTimeout(() => dlgInput.focus({ preventScroll: true }), 50);
    const { kind, value } = await waitable((resolve) => {
      dlgAsk.onsubmit = (e) => { e.preventDefault(); resolve({ kind: 'answer', value: dlgInput.value.trim() }); };
      dlgAskQ.onclick = () => {
        const v = dlgInput.value.trim();
        if (!v) { dlgInput.placeholder = 'Type your question for Seraphine, then press Ask her…'; dlgInput.focus(); return; }
        resolve({ kind: 'question', value: v });
      };
    });
    dlgAsk.onsubmit = null; dlgAskQ.onclick = null;
    dlgAsk.hidden = true;
    dlgInput.blur();
    sfx.tick();
    if (kind === 'answer') return value;
    const reply = await think(() => onQuestion(value));
    await say(reply || "The glass is cloudy just now. Hold your question a while longer — and answer mine.");
    prompt = `So — ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }
}

dlg.addEventListener('click', (e) => { if (!dlgAsk.contains(e.target)) advance(); });
addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (!dlg.classList.contains('show') || !dlgAsk.hidden) return;   // typing an answer: Enter submits it instead
  if (!typing && !advanceResolve) return;                     // nothing to move on from (e.g. a passing greeting)
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  e.preventDefault();                                     // don't also "press" whichever button still has focus
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  advance();
});

/* =====================================================================
   Prompt line and the card meaning panel
   ===================================================================== */
const promptEl = $('prompt');
export function setPrompt(txt) {
  if (txt) { promptEl.textContent = txt; promptEl.classList.add('show'); } else promptEl.classList.remove('show');
}

const panel = $('cardpanel');
export function cardSubtitle(card) {
  return card.arcana === 'major' ? `Major Arcana · ${card.num}` : `${SUITS[card.suit].name} · ${SUITS[card.suit].element}`;
}
export function showCardPanel(card, position, reversed) {
  panel.querySelector('.pos').textContent = position ? `${position} · ${cardSubtitle(card)}` : cardSubtitle(card);
  panel.querySelector('.cname').textContent = card.name + (reversed ? ' (reversed)' : '');
  panel.querySelector('.chips').replaceChildren(...card.keys.map((k) => el('span', '', k)));
  panel.querySelector('.meaning').textContent = reversed ? card.reversed : card.meaning;
  panel.classList.add('show');
}
export const hideCardPanel = () => panel.classList.remove('show');

/* =====================================================================
   Overlays
   ===================================================================== */
const OVERLAYS = ['setup', 'library', 'journal', 'history', 'settings'];
export function showOverlay(id) {
  for (const o of OVERLAYS) $(o).classList.toggle('show', o === id);
}
export const hideOverlays = () => showOverlay(null);
