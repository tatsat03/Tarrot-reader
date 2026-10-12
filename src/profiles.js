import { store } from './util.js';
import { MAJORS, cardById } from '../data/deck.js';

/* =====================================================================
   Traveler profiles — kept only in this browser's storage.
   A guest has no profile: nothing about them is saved.
   ===================================================================== */
const KEY = 'oracle.profiles', ACTIVE = 'oracle.activeProfile';

export const FOCUS = ['Love & relationships', 'Work & purpose', 'Healing & growth', 'Creativity', 'Family & home', 'Spirit & meaning', 'Money & security'];
export const PRONOUNS = ['', 'she/her', 'he/him', 'they/them'];

export const listProfiles = () => store.get(KEY, []);
export const getProfile = (id) => listProfiles().find((p) => p.id === id) || null;
export function saveProfile(p) {
  const profile = { ...p, id: p.id || `p${Date.now().toString(36)}`, updated: new Date().toISOString() };
  const all = listProfiles().filter((q) => q.id !== profile.id);
  store.set(KEY, [...all, profile]);
  return profile;
}
export function deleteProfile(id) {
  store.set(KEY, listProfiles().filter((p) => p.id !== id));
  if (store.get(ACTIVE, null) === id) store.set(ACTIVE, null);
}

// Who is at the fair right now: a profile, or null for a guest.
let current = null;
export const currentProfile = () => current;
export function setCurrent(id) {
  current = id ? getProfile(id) : null;
  store.set(ACTIVE, id || 'guest');
  return current;
}
export const lastActiveId = () => store.get(ACTIVE, null);
export const displayName = (p) => (p ? p.name : 'Guest');

/* ---------- what a birthdate says ---------- */
const SIGNS = [
  // name, glyph, element, start month, start day, Major Arcana card (Golden Dawn)
  ['Capricorn', '♑', 'Earth', 12, 22, 15], ['Aquarius', '♒', 'Air', 1, 20, 17], ['Pisces', '♓', 'Water', 2, 19, 18],
  ['Aries', '♈', 'Fire', 3, 21, 4], ['Taurus', '♉', 'Earth', 4, 20, 5], ['Gemini', '♊', 'Air', 5, 21, 6],
  ['Cancer', '♋', 'Water', 6, 21, 7], ['Leo', '♌', 'Fire', 7, 23, 8], ['Virgo', '♍', 'Earth', 8, 23, 9],
  ['Libra', '♎', 'Air', 9, 23, 11], ['Scorpio', '♏', 'Water', 10, 23, 13], ['Sagittarius', '♐', 'Fire', 11, 22, 14],
];
function parse(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
function sunSign({ m, d }) {
  const md = m * 100 + d;
  // Capricorn wraps the new year; otherwise the latest sign whose start date has passed
  const sign = md >= 1222 || md < 120 ? SIGNS[0] : [...SIGNS.slice(1)].reverse().find((s) => md >= s[3] * 100 + s[4]);
  const [name, glyph, element, , , card] = sign;
  return { name, glyph, element, card: MAJORS[card] };
}
const digitSum = (n) => String(n).split('').reduce((a, c) => a + +c, 0);
function lifePath({ y, m, d }) {
  let n = digitSum(`${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`);
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) n = digitSum(n);
  return n;
}
// Tarot birth cards (after Mary K. Greer): month + day + year, reduced until it is 22 or less;
// a two-digit result also gives its digit sum as a companion card. 22 is The Fool.
function birthCards({ y, m, d }) {
  let n = m + d + y;
  while (n > 22) n = digitSum(n);
  const cards = [MAJORS[n === 22 ? 0 : n]];
  if (n >= 10 && n !== 22) cards.push(MAJORS[digitSum(n)]);
  return cards;
}
function ageOn({ y, m, d }, now = new Date()) {
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

// Everything the game derives from a profile. Fields are null when there is no birthdate.
export function astro(p) {
  const b = p && parse(p.birthdate);
  if (!b) return { age: null, sign: null, lifePath: null, birthCards: [] };
  return { age: ageOn(b), sign: sunSign(b), lifePath: lifePath(b), birthCards: birthCards(b) };
}
export function isBirthday(p) {
  const b = p && parse(p.birthdate), now = new Date();
  return !!b && b.m === now.getMonth() + 1 && b.d === now.getDate();
}

/* ---------- for Seraphine's mind (sent to Claude only when it is connected) ---------- */
export function profileBrief(p, history = []) {
  if (!p) return 'A guest — no personal details shared.';
  const a = astro(p);
  const lines = [`Name: ${p.name}.`];
  if (p.pronouns) lines.push(`Pronouns: ${p.pronouns}.`);
  if (a.age != null) lines.push(`Age: ${a.age}.`);
  if (a.sign) lines.push(`Sun sign: ${a.sign.name} (${a.sign.element}); its Major Arcana card is ${a.sign.card.name}.`);
  if (a.lifePath) lines.push(`Life path number: ${a.lifePath}.`);
  if (a.birthCards.length) lines.push(`Tarot birth card${a.birthCards.length > 1 ? 's' : ''}: ${a.birthCards.map((c) => c.name).join(' and ')}.`);
  if (p.focus && p.focus.length) lines.push(`Hoping to explore: ${p.focus.join(', ')}.`);
  if (p.notes) lines.push(`In their own words: "${p.notes}"`);
  if (isBirthday(p)) lines.push('Today is their birthday.');
  const mine = history.filter((r) => (r.profileIds || []).includes(p.id)).slice(0, 4);
  if (mine.length) {
    lines.push('Their recent readings:');
    for (const r of mine) {
      const date = new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      lines.push(`- ${date}, ${r.spreadName}${r.intent ? ` (intention: "${r.intent}")` : ''}: ${r.entries.map((e) => e.name + (e.reversed ? ' reversed' : '')).join(', ')}.`);
    }
  }
  return lines.join('\n');
}

// How many times a card has appeared in this traveler's earlier readings.
export function timesDrawn(p, cardId, history) {
  if (!p) return 0;
  return history.filter((r) => (r.profileIds || []).includes(p.id))
    .reduce((n, r) => n + r.entries.filter((e) => e.cardId === cardId).length, 0);
}
export const birthCardIds = (p) => astro(p).birthCards.map((c) => c.id);
export { cardById };
