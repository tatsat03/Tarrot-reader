import { sleep, pickFrom } from './util.js';
import { state } from './state.js';
import { DECK, MAJORS, spreadById } from '../data/deck.js';
import { ball, constellation } from './room.js';
import { O, setOracleColor } from './oracle.js';
import { setInPlay, stackDeck, shuffleDeck, layoutFan, fanCards, focusPose, slotPoses, moveCard, burst, ensureFront } from './cards.js';
import { beginFlow, say, ask, think, hideDialogue, setPrompt, showCardPanel, hideCardPanel } from './ui.js';
import { pickCard } from './input.js';
import { sfx } from './audio.js';
import { askDuringReading, reflectOnAnswers, closingWords } from './agent.js';
import { saveHistory } from './journal.js';

export const INTRO = [
  "Ah… there you are. Come in, come in. Sit. The candles have been waiting for you.",
  "I am Seraphine, Keeper of the Veil. People have come to this table for a very long time, looking for answers.",
  "These are tarot cards. A full deck holds seventy-eight: twenty-two Major Arcana for the great turning points of a life, and fifty-six Minor Arcana for its everyday weather.",
  "The Major Arcana tell one story — the Fool's journey: a traveler who sets out knowing nothing, and meets every lesson life can teach. The Minor Arcana come in four suits: Wands for fire and will, Cups for feeling, Swords for thought, and Pentacles for body, work and home.",
  "Now, a secret most fortune tellers won't tell you. The cards do not see your future. They hold up a mirror. Whatever you notice in them is already stirring in you.",
  "So this is not a fortune. It is a journey — into yourself.",
];
const RETURNING = [
  "Back again? Good. The mirror shows something different every time you look into it.",
  "Welcome back. Sit — the cards are still warm from last time.",
];
const ACKS = [
  "Mm. I hear it. Let that settle in you for a moment.",
  "Thank you. It takes courage to say a true thing out loud.",
  "Yes… the card brightened as you spoke. It recognised you.",
  "Hold on to those words. You may need them later.",
];
const SILENT_ACKS = [
  "Silence is an answer too. Carry the question with you — it will keep.",
  "You needn't answer aloud. The question has already begun its work.",
];
let ackIndex = Math.floor(Math.random() * ACKS.length);
let skipIntro = false;
export const requestSkipIntro = () => { skipIntro = true; };

/**
 * cfg: { mode: 'solo'|'duo', players: [A, B], forEach: bool, spread: id, deck: 'major'|'full', reversals: bool }
 * Resolves with the finished journal record; rejects with Aborted if the player leaves.
 */
export async function runReading(cfg, { onIntro } = {}) {
  const F = beginFlow();
  const spread = spreadById(cfg.spread);
  const duo = cfg.mode === 'duo';
  const [A, B] = duo ? cfg.players : [null, null];
  const n = spread.positions.length;
  const record = {
    id: Date.now().toString(36), date: new Date().toISOString(),
    mode: cfg.mode, players: duo ? [A, B] : [], spreadId: spread.id, spreadName: spread.name,
    deck: cfg.deck, reversals: cfg.reversals, forEach: !!cfg.forEach, intent: '', entries: [], synthesis: '',
  };
  const fill = (s) => s.replace(/\{A\}/g, A || 'you').replace(/\{B\}/g, B || 'them');

  // --- the table ---
  state.mode = 'busy';
  setInPlay(cfg.deck === 'full' ? DECK : MAJORS);
  await stackDeck(false);
  F.check();
  constellation.setup(n);
  ball.target.set(0x8a6cff);
  setOracleColor(0x8a6cff);

  // --- Seraphine sets the scene ---
  if (!state.introHeard) {
    skipIntro = false;
    onIntro && onIntro(true);
    for (const line of INTRO) { if (skipIntro) break; await say(line); }
    onIntro && onIntro(false);
    state.introHeard = true;
  } else {
    await say(pickFrom(RETURNING));
  }
  if (duo) {
    await say(`Two of you tonight — ${A} and ${B}. Good. The cards are often kinder when someone we trust sits beside us.`);
    if (cfg.forEach) await say("And you'll read for each other. When a card belongs to one of you, the other will say what they see in it first.");
  }
  await say(cfg.deck === 'full'
    ? "Tonight we use the whole deck, all seventy-eight — the great arcana and the four suits together."
    : "Tonight, only the twenty-two Major Arcana — the great cards, the big themes of a life.");
  if (cfg.reversals) await say("And I'll let the cards fall as they will. If one lands upside down — reversed — its energy is blocked, turned inward, or asking for a different kind of attention.");
  await say(n === 1
    ? `We'll draw ${spread.name}: a single card.`
    : `We'll lay ${spread.name}: ${spread.positions.map((p) => p.title.toLowerCase()).join(', ')}.`);

  record.intent = await ask(
    duo ? `${A}, ${B} — what brings you here together tonight? Either of you may answer for both.`
        : "Before we begin — what is on your mind tonight? A question, a feeling… even a single word is enough.",
    'Your intention, or leave it blank…'
  );
  await say(record.intent
    ? `“${record.intent}.” Good. Hold it gently — don't grip it. Now… watch the deck.`
    : "You'd rather not name it. That's alright — the cards will find it anyway. Now… watch the deck.");
  hideDialogue();

  sfx.whoosh(3.2);
  await shuffleDeck((r) => (O.raise = r));
  F.check();

  // --- each position ---
  const slots = slotPoses(spread);
  for (let i = 0; i < n; i++) {
    const pos = spread.positions[i];
    const owner = duo ? (pos.owner || (i % 2 ? 'b' : 'a')) : 'a';
    const picker = !duo ? null : owner === 'both' ? (i % 2 ? B : A) : owner === 'a' ? A : B;
    if (i > 0) { await layoutFan(false); F.check(); }
    if (i === 0) {
      await say(duo ? `${picker}, you choose first. Don't think too hard — let your hand decide.`
                    : "Now, choose. Don't think too hard — let your hand decide which card is calling to you.");
      hideDialogue();
    }
    setPrompt(`${picker ? `${picker} — choose` : 'Choose'} a card · ${i + 1} of ${n}`);
    const g = await pickCard();
    setPrompt('');
    const reversed = cfg.reversals && Math.random() < 0.3;
    const entry = await reveal(g, i, { pos, owner, reversed, slot: slots[i] });
    record.entries.push(entry);
  }

  // --- closing ---
  state.mode = 'busy';
  const rest = fanCards();
  await stackDeck(false, rest);
  F.check();
  constellation.connect();
  sfx.chime();
  await say(n === 1 ? "Look up. A star burns where there was none — for the truth you spoke tonight."
                    : "Look up. Stars burn where there were none — one for every truth spoken tonight.");
  record.synthesis = (await think(() => closingWords(record))) || '';
  if (record.synthesis) await say(record.synthesis);
  else if (n > 1) await say(`${record.entries.slice(0, -1).map((e) => e.name).join(', ')}… and ${record.entries[n - 1].name}. Together they make a sentence only you can finish.`);
  await say("Remember: the cards showed you nothing you didn't already know. They only held up the mirror. I've written it all down, so you can return to it.");
  hideDialogue();
  saveHistory(record);
  return record;

  // Reveal one card, hear the players, and lay it in its place.
  async function reveal(g, i, { pos, owner, reversed, slot }) {
    const u = g.userData, card = u.card;
    u.state = 'chosen';
    state.focus = g;
    ensureFront(g);
    layoutFan(true);
    sfx.whoosh(1.1);
    const fp = focusPose();
    await moveCard(g, { pos: fp.pos, quat: fp.quat, scale: 1, rev: reversed ? Math.PI : 0 }, { duration: 1.1, arc: 0.25 });
    F.check();
    O.raise = 1;
    await sleep(250);
    sfx.chime();
    const flipping = moveCard(g, { flip: 0 }, { duration: 1.0 });
    setTimeout(() => burst(u.pos.clone(), card.color), 480);
    ball.target.set(card.color);
    setOracleColor(card.color);
    await flipping;
    F.check();
    u.haloTarget = 1;
    O.raise = 0;
    showCardPanel(card, pos.title, reversed);

    await say(fill(duo && pos.duoIntro ? pos.duoIntro : pos.intro));
    await say(`${card.name}${reversed ? ', reversed' : ''}. ${reversed ? card.reversed : card.meaning}`);

    const answers = [];
    const onQuestion = (asker) => (q) => askDuringReading(record, card, reversed, pos.title, q, asker);
    const qa = async (whoName, text, about) => {
      const ph = whoName ? `${whoName}, answer honestly — or leave it blank…` : 'Answer honestly — or leave it blank…';
      const ans = await ask(text, ph, { onQuestion: onQuestion(whoName) });
      answers.push({ who: whoName, text: ans, about: about || null });
    };
    if (!duo) {
      await qa(null, card.question);
    } else if (owner === 'both') {
      const [first, second] = i % 2 ? [B, A] : [A, B]; // whoever drew the card answers first
      await qa(first, `${first}, you first. ${card.question}`);
      await qa(second, `And ${second}? ${card.question}`);
    } else {
      const X = owner === 'a' ? A : B, P = owner === 'a' ? B : A;
      if (record.forEach) await qa(P, `${P} — before ${X} answers: looking at ${card.name}, what do you see of this card in ${X}?`, X);
      await qa(X, `${X}: ${card.question}`);
    }

    constellation.light(i, card.color);
    sfx.star();
    hideCardPanel();
    const reply = await think(() => reflectOnAnswers(record, card, reversed, pos.title, answers));
    const anySaid = answers.some((a) => a.text);
    await say(reply || (anySaid ? ACKS[ackIndex++ % ACKS.length] : pickFrom(SILENT_ACKS)));
    hideDialogue();

    state.focus = null;
    u.state = 'slot';
    await moveCard(g, { pos: slot.pos, quat: slot.quat, scale: slot.scale }, { duration: 1.1, arc: 0.15 });
    F.check();
    u.bob = true;
    u.haloTarget = 0.45;
    return { cardId: card.id, name: card.name, num: card.num, reversed, position: pos.title, question: card.question, answers };
  }
}
