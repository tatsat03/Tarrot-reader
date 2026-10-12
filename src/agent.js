import { SUITS } from '../data/deck.js';
import { pickFrom } from './util.js';
import { voice } from './audio.js';

/* =====================================================================
   Seraphine's mind. Requests go to the local server (/api/oracle), which
   adds the API key and forwards them to Claude. With no key or no server,
   every function here falls back to scripted answers built from the card data.
   ===================================================================== */
let status = { checked: false, online: false, reason: '' };
export const agentStatus = () => status;

export async function checkAgent() {
  try {
    const r = await fetch('/api/status', { cache: 'no-store' });
    const j = await r.json();
    status = { checked: true, online: !!j.agent, reason: j.reason || '', model: j.model, tts: !!j.tts };
    voice.setPremium(!!j.tts);
  } catch {
    status = { checked: true, online: false, reason: 'no-server' };
  }
  return status;
}

const PERSONA = `You are Seraphine, Keeper of the Veil — the fortune teller in "The Oracle's Chamber", a candlelit tarot game about self-exploration. You speak to the player through a dialogue box and aloud through text-to-speech.

How you see tarot:
- The cards are a mirror for reflection, not a way to see the future. Never claim to predict events, read minds, or know hidden facts about anyone. When asked "will X happen?", gently turn it into what the person can notice, choose or do.
- You know tarot well: Rider–Waite–Smith imagery, the Major and Minor Arcana, the suits and elements, reversals, spreads, and tarot's real history (Italian card games of the 15th century; occult interpretation from the 18th century onward). Answer such questions accurately.

How you speak:
- Warm, a little theatrical, but plain and clear. Address the person directly. Use their name when you know it.
- Keep replies short: 2–4 sentences (under about 80 words) unless they ask for more.
- Plain text only — no markdown, lists, headings, asterisks or emoji. It is read aloud.
- Ask at most one question back, and only when it helps them reflect.

Care:
- Don't give medical, legal or financial directives; for serious matters, suggest talking to someone qualified.
- If someone mentions wanting to harm themselves or being in danger, drop the role-play tone, respond with care, and encourage them to reach out to someone they trust or a local emergency or crisis line.
- In two-player readings, be fair and kind to both people; never take sides or stir conflict between them.

Knowing your visitor:
- You may be given a traveler's profile: name, pronouns, age, sun sign, life path number, tarot birth cards, what they hope to explore, and their recent readings. Weave these in lightly and naturally, the way a perceptive host remembers a regular — never recite them back like a file, and never treat astrology or numerology as fact about their character or fate.
- Use their pronouns when referring to them.
- If a card has appeared in their earlier readings, or is their birth card, you may notice it.
- If the traveler is under 18, keep everything age-appropriate.`;

function cardBrief(card, reversed) {
  const lines = [
    `${card.name}${reversed ? ' — drawn REVERSED' : ''}`,
    card.arcana === 'major' ? `Major Arcana ${card.num}; associated with ${card.astro}.` : `Minor Arcana, suit of ${SUITS[card.suit].name} (${SUITS[card.suit].element}: ${SUITS[card.suit].domain}).`,
    `Keywords: ${card.keys.join(', ')}.`,
    `Upright: ${card.meaning}`,
    `Reversed: ${card.reversed}`,
    `Imagery: ${card.symbols}`,
    `Reflection question: ${card.question}`,
  ];
  return lines.join('\n');
}

function clean(text) {
  return text.replace(/\*\*?|__|`|^#+\s*/gm, '').replace(/^\s*[-•]\s+/gm, '').replace(/\n{2,}/g, '\n').trim();
}

async function call(system, messages) {
  if (!status.online) return null;
  try {
    const r = await fetch('/api/oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, messages }),
    });
    const j = await r.json();
    if (!r.ok) {
      if (j && j.error === 'no-key') status = { ...status, online: false, reason: 'no-key' };
      return null;
    }
    return j.text ? clean(j.text) : null;
  } catch {
    return null;
  }
}

/* ---------- Library: open conversation about one card ---------- */
export async function askAboutCard(card, history, question, traveler = '') {
  const system = `${PERSONA}\n\nRight now the player is studying one card in the Library of Cards:\n${cardBrief(card, false)}${traveler ? `\n\nAbout the traveler:\n${traveler}` : ''}`;
  const messages = [...history, { role: 'user', content: question }];
  return (await call(system, messages)) || offlineCardAnswer(card, question);
}

/* ---------- During a reading ---------- */
function readingContext(r) {
  const who = r.players && r.players.length === 2 ? `Two players: ${r.players[0]} and ${r.players[1]}.` : 'One player, reading for themselves.';
  const briefs = r._ctx && r._ctx.briefs && r._ctx.briefs.length ? `\n\nAbout the travelers:\n${r._ctx.briefs.join('\n\n')}` : '';
  return `${who}\nSpread: ${r.spreadName}.\nTheir intention: ${r.intent ? `"${r.intent}"` : '(left unspoken)'}${briefs}`;
}

export async function askDuringReading(r, card, reversed, position, question, asker) {
  const system = `${PERSONA}\n\nYou are in the middle of a reading.\n${readingContext(r)}\nThe card on the table now, in the position "${position}":\n${cardBrief(card, reversed)}`;
  const content = `${asker ? `${asker} asks` : 'The player asks'}: ${question}`;
  return (await call(system, [{ role: 'user', content }])) || offlineCardAnswer(card, question, reversed);
}

export async function reflectOnAnswers(r, card, reversed, position, answers) {
  const system = `${PERSONA}\n\nYou are in the middle of a reading.\n${readingContext(r)}\nThe card just revealed, in the position "${position}":\n${cardBrief(card, reversed)}`;
  const said = answers.map((a) => `${a.who ? a.who : 'The player'}${a.about ? ` (speaking about ${a.about})` : ''}: ${a.text || '(chose to stay silent)'}`).join('\n');
  const content = `They answered the card's question.\n${said}\n\nRespond to what they shared in 1–3 sentences: reflect it back with care, connect it to the card if it fits, and don't ask a new question. If they stayed silent, honour the silence briefly.`;
  return call(system, [{ role: 'user', content }]);
}

export async function closingWords(r) {
  const system = `${PERSONA}\n\nThe reading is complete.\n${readingContext(r)}`;
  const cards = r.entries.map((e) => {
    const said = e.answers.map((a) => `${a.who || 'They'}${a.about ? ` (about ${a.about})` : ''}: ${a.text || '(silence)'}`).join(' | ');
    return `- ${e.position}: ${e.name}${e.reversed ? ' (reversed)' : ''}. Answers — ${said}`;
  }).join('\n');
  const content = `The cards and their answers:\n${cards}\n\nClose the reading in 3–5 sentences: name the thread you see running through the cards and what they shared, and leave them with one gentle thing to carry. No predictions.`;
  return call(system, [{ role: 'user', content }]);
}

/* ---------- offline answers ---------- */
export function offlineCardAnswer(card, question, reversed = false) {
  const q = question.toLowerCase();
  const suit = card.suit ? SUITS[card.suit] : null;
  if (/revers|upside/.test(q)) return `Reversed, ${card.name} turns inward: ${card.reversed.charAt(0).toLowerCase()}${card.reversed.slice(1)} A reversal isn't a curse — it's the same energy, blocked or asking for a different kind of attention.`;
  if (/symbol|image|picture|look|see|drawn|art/.test(q)) return `Look closely at the imagery: ${card.symbols.charAt(0).toLowerCase()}${card.symbols.slice(1)} Every detail is there to start a conversation with you.`;
  if (/love|relationship|partner|crush|date|heart|marri/.test(q)) return `In matters of the heart, ${card.name} speaks of ${card.keys.map((k) => k.toLowerCase()).join(', ')}. Ask yourself: ${card.question.charAt(0).toLowerCase()}${card.question.slice(1)}`;
  if (/work|job|career|money|business|study|exam/.test(q)) return `For work and the practical world, ${card.name} points to ${card.keys[0].toLowerCase()} and ${card.keys[1].toLowerCase()}. ${reversed ? card.reversed : card.meaning}`;
  if (/will |going to|future|predict|happen|yes or no|should i/.test(q)) return `The cards don't decide for you, and I won't pretend they can see what hasn't happened. What ${card.name} can do is hold up a mirror: ${card.question.charAt(0).toLowerCase()}${card.question.slice(1)}`;
  if (/element|astrolog|planet|zodiac|sign|suit/.test(q)) return suit
    ? `${card.name} belongs to the suit of ${suit.name}, the element of ${suit.element} — ${suit.domain}.`
    : `${card.name} is associated with ${card.astro}. Its number in the Major Arcana is ${card.num}.`;
  if (/history|origin|old|where.*come/.test(q)) return "Tarot began as a card game in fifteenth-century Italy, the tarocchi. Only in the eighteenth century did people begin reading the cards for meaning — and the pictures most of us know were painted by Pamela Colman Smith in 1909.";
  return pickFrom([
    `${card.name}: ${reversed ? card.reversed : card.meaning} If you sit with it, ask yourself — ${card.question.charAt(0).toLowerCase()}${card.question.slice(1)}`,
    `This card carries ${card.keys.map((k) => k.toLowerCase()).join(', ')}. ${reversed ? card.reversed : card.meaning}`,
  ]);
}
