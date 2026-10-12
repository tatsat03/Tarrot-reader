import * as THREE from 'three';
import { renderer } from './engine.js';
import { hexA } from './util.js';
import { SUITS } from '../data/deck.js';

/* ---------- canvas helpers ---------- */
export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
export function toTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
export function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
function sprinkleStars(ctx, w, h, count, seed, color = '#f5e6c0', x0 = 0, y0 = 0) {
  const r = seeded(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.6;
    ctx.beginPath();
    ctx.arc(x0 + r() * w, y0 + r() * h, r() * 1.6 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function starPath(ctx, cx, cy, points, outer, inner, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}
const SYMBOL_FONT = '"Segoe UI Symbol", "Noto Sans Symbols 2", "Apple Symbols", serif';

/* ---------- generic glow textures ---------- */
export function radialTexture(size = 128) {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return toTex(c);
}
export function sparkleTexture() {
  const s = 128, [c, ctx] = canvas(s, s);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  starPath(ctx, 64, 64, 4, 62, 4, 0); ctx.fill();
  return toTex(c);
}
export function flameTexture() {
  const [c, ctx] = canvas(64, 128);
  ctx.save(); ctx.translate(32, 80); ctx.scale(1, 2.1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.25, 'rgba(255,214,120,0.95)');
  g.addColorStop(0.6, 'rgba(255,120,30,0.35)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  return toTex(c);
}
// A ring of celestial glyphs that floats around the crystal ball.
export function runeRingTexture() {
  const S = 1024, h = S / 2, [c, ctx] = canvas(S, S);
  ctx.strokeStyle = 'rgba(255,230,170,0.9)';
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h, h, h * 0.96, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h, h, h * 0.78, 0, Math.PI * 2); ctx.stroke();
  const glyphs = '☉☽☿♀♁♂♃♄♅♆✶✧☉☽☿♀♁♂♃♄♅♆✶✧';
  ctx.fillStyle = 'rgba(255,235,190,0.95)';
  ctx.font = `64px ${SYMBOL_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < glyphs.length; i++) {
    const a = (i / glyphs.length) * Math.PI * 2;
    ctx.save(); ctx.translate(h + Math.cos(a) * h * 0.87, h + Math.sin(a) * h * 0.87); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(glyphs[i] + '︎', 0, 0); ctx.restore();
  }
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, r1 = h * 0.78, r2 = h * (i % 6 ? 0.74 : 0.7);
    ctx.beginPath(); ctx.moveTo(h + Math.cos(a) * r1, h + Math.sin(a) * r1); ctx.lineTo(h + Math.cos(a) * r2, h + Math.sin(a) * r2); ctx.stroke();
  }
  return toTex(c);
}

/* ---------- card art ---------- */
export const CW = 448, CH = 768;

function cardFrame(ctx, accent) {
  ctx.strokeStyle = '#d9b46a';
  ctx.lineWidth = 3; rrect(ctx, 18, 18, CW - 36, CH - 36, 20); ctx.stroke();
  ctx.lineWidth = 1; rrect(ctx, 30, 30, CW - 60, CH - 60, 12); ctx.stroke();
  ctx.fillStyle = '#d9b46a';
  for (const [x, y] of [[30, 30], [CW - 30, 30], [30, CH - 30], [CW - 30, CH - 30]]) {
    ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 9, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 9, y); ctx.fill();
  }
  if (accent) {
    ctx.strokeStyle = hexA(accent, 0.5); ctx.lineWidth = 1;
    rrect(ctx, 38, 130, CW - 76, CH - 300, 10); ctx.stroke();
  }
}
function cardTitle(ctx, num, name, sub) {
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ecd08a';
  ctx.font = '600 40px Cinzel, serif';
  let ns = 40;
  while (ctx.measureText(num).width > CW - 120 && ns > 22) { ns -= 2; ctx.font = `600 ${ns}px Cinzel, serif`; }
  ctx.fillText(num, CW / 2, 96);
  ctx.strokeStyle = 'rgba(217,180,106,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(CW / 2 - 60, 114); ctx.lineTo(CW / 2 + 60, 114); ctx.stroke();
  let size = 34;
  ctx.font = `600 ${size}px Cinzel, serif`;
  while (ctx.measureText(name.toUpperCase()).width > CW - 90 && size > 18) { size -= 2; ctx.font = `600 ${size}px Cinzel, serif`; }
  ctx.fillStyle = '#f0d391';
  ctx.fillText(name.toUpperCase(), CW / 2, CH - 124);
  ctx.font = 'italic 400 24px "Cormorant Garamond", serif';
  ctx.fillStyle = '#cdb88a';
  let sub2 = sub;
  while (ctx.measureText(sub2).width > CW - 90 && sub2.includes(' · ')) sub2 = sub2.slice(0, sub2.lastIndexOf(' · '));
  ctx.fillText(sub2, CW / 2, CH - 84);
}
function mountains(ctx, x0, y0, w, h, seed, color, jag = 1) {
  const r = seeded(seed);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(x0, y0 + h);
  let x = x0;
  while (x < x0 + w) {
    const peak = y0 + h * (0.15 + r() * 0.6);
    const step = 30 + r() * 60 * jag;
    ctx.lineTo(x + step / 2, peak); ctx.lineTo(x + step, y0 + h * (0.55 + r() * 0.3));
    x += step;
  }
  ctx.lineTo(x0 + w, y0 + h); ctx.closePath(); ctx.fill();
}

// Major Arcana: a small painted world — sky, landscape, a celestial emblem.
function drawMajor(ctx, a) {
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#1f1036'); bg.addColorStop(1, '#0c0616');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);

  // window into the card's sky
  ctx.save();
  rrect(ctx, 38, 130, CW - 76, CH - 300, 10); ctx.clip();
  const sky = ctx.createLinearGradient(0, 130, 0, CH - 170);
  sky.addColorStop(0, hexA(a.color, 0.08)); sky.addColorStop(0.55, hexA(a.color, 0.32)); sky.addColorStop(1, '#120820');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, CH);
  sprinkleStars(ctx, CW - 76, 300, 70, a.n * 13 + 7, '#fff3d0', 38, 130);
  const cx = CW / 2, cy = 330;
  const sun = ctx.createRadialGradient(cx, cy, 10, cx, cy, 230);
  sun.addColorStop(0, hexA(a.color, 0.75)); sun.addColorStop(0.4, hexA(a.color, 0.22)); sun.addColorStop(1, hexA(a.color, 0));
  ctx.fillStyle = sun; ctx.fillRect(0, 0, CW, CH);
  mountains(ctx, 38, 430, CW - 76, 120, a.n * 31 + 5, 'rgba(30,14,50,0.85)', 1.2);
  mountains(ctx, 38, 480, CW - 76, 120, a.n * 17 + 2, 'rgba(14,6,26,0.95)', 0.8);
  // a winding path, like the Fool's road
  ctx.strokeStyle = hexA(a.color, 0.35); ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - 10, CH - 172); ctx.bezierCurveTo(cx + 70, 560, cx - 70, 540, cx + 8, 500); ctx.stroke();
  ctx.restore();

  // emblem
  ctx.save(); ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(232,200,126,0.45)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 48; i++) {
    const ang = (i / 48) * Math.PI * 2, r2 = i % 2 ? 150 : 178;
    ctx.beginPath(); ctx.moveTo(Math.cos(ang) * 118, Math.sin(ang) * 118); ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(12,6,22,0.55)'; ctx.beginPath(); ctx.arc(0, 0, 108, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#d9b46a';
  ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 110, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 98, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f6dc9c'; ctx.shadowColor = a.color; ctx.shadowBlur = 34;
  ctx.font = `118px ${SYMBOL_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(a.glyph + '︎', 0, 6);
  ctx.restore();

  cardFrame(ctx, a.color);
  cardTitle(ctx, a.num, a.name, a.keys.join(' · '));
}

/* suit icons, drawn centred at (0,0) with height ~s */
function wandIcon(ctx, s) {
  ctx.save(); ctx.rotate(-0.32);
  const g = ctx.createLinearGradient(-s * 0.05, 0, s * 0.05, 0);
  g.addColorStop(0, '#6e3f1e'); g.addColorStop(0.5, '#c98d52'); g.addColorStop(1, '#5e3418');
  ctx.fillStyle = g; rrect(ctx, -s * 0.045, -s * 0.5, s * 0.09, s, s * 0.04); ctx.fill();
  ctx.fillStyle = '#e8c46a'; ctx.beginPath(); ctx.arc(0, -s * 0.5, s * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8fd18b';
  for (const [y, side] of [[-0.3, 1], [-0.08, -1], [0.16, 1]]) {
    ctx.save(); ctx.translate(side * s * 0.05, y * s); ctx.rotate(side * -0.7);
    ctx.beginPath(); ctx.ellipse(side * s * 0.07, 0, s * 0.08, s * 0.03, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function cupIcon(ctx, s) {
  const g = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
  g.addColorStop(0, '#9a7432'); g.addColorStop(0.45, '#f4d78c'); g.addColorStop(1, '#8a6428');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.42);
  ctx.quadraticCurveTo(-s * 0.3, s * 0.02, 0, s * 0.06);
  ctx.quadraticCurveTo(s * 0.3, s * 0.02, s * 0.3, -s * 0.42);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(-s * 0.04, s * 0.04, s * 0.08, s * 0.28);
  ctx.beginPath(); ctx.ellipse(0, s * 0.36, s * 0.2, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(110,184,255,0.85)';
  ctx.beginPath(); ctx.ellipse(0, -s * 0.42, s * 0.29, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f8e2a6'; ctx.lineWidth = Math.max(1, s * 0.015); ctx.stroke();
}
function swordIcon(ctx, s) {
  const g = ctx.createLinearGradient(-s * 0.06, 0, s * 0.06, 0);
  g.addColorStop(0, '#8d97b8'); g.addColorStop(0.5, '#f2f5ff'); g.addColorStop(1, '#7c86a8');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-s * 0.075, s * 0.22); ctx.lineTo(-s * 0.06, -s * 0.4); ctx.lineTo(0, -s * 0.52); ctx.lineTo(s * 0.06, -s * 0.4); ctx.lineTo(s * 0.075, s * 0.22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(90,100,140,0.6)'; ctx.lineWidth = Math.max(1, s * 0.01); ctx.beginPath(); ctx.moveTo(0, s * 0.2); ctx.lineTo(0, -s * 0.45); ctx.stroke();
  ctx.fillStyle = '#d9b46a'; rrect(ctx, -s * 0.2, s * 0.21, s * 0.4, s * 0.05, s * 0.02); ctx.fill();
  ctx.fillStyle = '#5a3a28'; ctx.fillRect(-s * 0.03, s * 0.26, s * 0.06, s * 0.17);
  ctx.fillStyle = '#d9b46a'; ctx.beginPath(); ctx.arc(0, s * 0.46, s * 0.045, 0, Math.PI * 2); ctx.fill();
}
function pentacleIcon(ctx, s) {
  const r = s * 0.42;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fbe6a2'); g.addColorStop(1, '#a87d2c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b4a14'; ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI * 2) / 5;
    i ? ctx.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78) : ctx.moveTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
  }
  ctx.closePath(); ctx.stroke();
}
const SUIT_ICON = { wands: wandIcon, cups: cupIcon, swords: swordIcon, pentacles: pentacleIcon };
export function drawSuitIcon(ctx, suit, x, y, s) { ctx.save(); ctx.translate(x, y); SUIT_ICON[suit](ctx, s); ctx.restore(); }

// Pip positions in a -1..1 box, like the faces of playing cards.
const PIPS = {
  1: [[0, 0]],
  2: [[0, -0.5], [0, 0.5]],
  3: [[0, -0.62], [0, 0], [0, 0.62]],
  4: [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]],
  5: [[-0.45, -0.5], [0.45, -0.5], [0, 0], [-0.45, 0.5], [0.45, 0.5]],
  6: [[-0.45, -0.62], [0.45, -0.62], [-0.45, 0], [0.45, 0], [-0.45, 0.62], [0.45, 0.62]],
  7: [[-0.45, -0.62], [0.45, -0.62], [0, -0.31], [-0.45, 0], [0.45, 0], [-0.45, 0.62], [0.45, 0.62]],
  8: [[-0.45, -0.66], [0.45, -0.66], [0, -0.33], [-0.45, 0], [0.45, 0], [0, 0.33], [-0.45, 0.66], [0.45, 0.66]],
  9: [[-0.45, -0.7], [0.45, -0.7], [-0.45, -0.23], [0.45, -0.23], [0, 0], [-0.45, 0.23], [0.45, 0.23], [-0.45, 0.7], [0.45, 0.7]],
  10: [[-0.45, -0.72], [0.45, -0.72], [0, -0.48], [-0.45, -0.24], [0.45, -0.24], [-0.45, 0.24], [0.45, 0.24], [0, 0.48], [-0.45, 0.72], [0.45, 0.72]],
};
const COURT_GLYPH = { 11: '♙', 12: '♘', 13: '♕', 14: '♔' };

function drawMinor(ctx, c) {
  const suit = SUITS[c.suit];
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#1c1030'); bg.addColorStop(1, '#0b0614');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
  const cx = CW / 2, cy = 360;

  ctx.save();
  rrect(ctx, 38, 130, CW - 76, CH - 300, 10); ctx.clip();
  const wash = ctx.createRadialGradient(cx, cy, 10, cx, cy, 300);
  wash.addColorStop(0, hexA(suit.color, 0.35)); wash.addColorStop(1, hexA(suit.color, 0.02));
  ctx.fillStyle = wash; ctx.fillRect(0, 0, CW, CH);
  sprinkleStars(ctx, CW - 76, CH - 300, 50, c.rank * 7 + c.suit.length * 19, '#fff3d0', 38, 130);
  // faint elemental motif behind the pips
  ctx.strokeStyle = hexA(suit.color, 0.18); ctx.lineWidth = 2;
  if (c.suit === 'cups') for (let i = 0; i < 6; i++) { ctx.beginPath(); for (let x = 38; x <= CW - 38; x += 8) ctx.lineTo(x, 500 + i * 22 + Math.sin(x / 26 + i) * 6); ctx.stroke(); }
  if (c.suit === 'wands') for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(60 + i * 42, 600); ctx.quadraticCurveTo(50 + i * 42, 520, 70 + i * 42, 470 - (i % 3) * 30); ctx.stroke(); }
  if (c.suit === 'swords') for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(38, 160 + i * 60); ctx.bezierCurveTo(160, 140 + i * 60, 260, 190 + i * 60, CW - 38, 150 + i * 60); ctx.stroke(); }
  if (c.suit === 'pentacles') mountains(ctx, 38, 500, CW - 76, 100, c.rank * 11, hexA('#2a1a10', 0.7), 1.4);
  ctx.restore();

  if (c.rank <= 10) {
    const tall = (c.suit === 'swords' || c.suit === 'wands') && (c.rank === 2 || c.rank === 3);
    const pts = tall ? (c.rank === 2 ? [[-0.42, 0], [0.42, 0]] : [[-0.62, 0.06], [0, -0.06], [0.62, 0.06]]) : PIPS[c.rank];
    const size = c.rank === 1 ? 260 : tall ? 230 : c.rank <= 3 ? 150 : c.rank <= 6 ? 122 : 96;
    if (c.rank === 1) {
      const halo = ctx.createRadialGradient(cx, cy, 10, cx, cy, 170);
      halo.addColorStop(0, hexA(suit.color, 0.55)); halo.addColorStop(1, hexA(suit.color, 0));
      ctx.fillStyle = halo; ctx.fillRect(0, 0, CW, CH);
    }
    ctx.shadowColor = suit.color; ctx.shadowBlur = 18;
    for (const [px, py] of pts) drawSuitIcon(ctx, c.suit, cx + px * 120, cy + py * 190, size);
    ctx.shadowBlur = 0;
  } else {
    // court: a crowned figure-glyph over the suit emblem, framed by an arch
    ctx.strokeStyle = 'rgba(217,180,106,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(110, 560); ctx.lineTo(110, 270); ctx.arc(cx, 270, cx - 110, Math.PI, 0); ctx.lineTo(CW - 110, 560); ctx.stroke();
    const halo = ctx.createRadialGradient(cx, 300, 10, cx, 300, 160);
    halo.addColorStop(0, hexA(suit.color, 0.5)); halo.addColorStop(1, hexA(suit.color, 0));
    ctx.fillStyle = halo; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#f6dc9c'; ctx.shadowColor = suit.color; ctx.shadowBlur = 26;
    ctx.font = `170px ${SYMBOL_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(COURT_GLYPH[c.rank] + '︎', cx, 300);
    ctx.shadowBlur = 14;
    drawSuitIcon(ctx, c.suit, cx, 490, 110);
    ctx.shadowBlur = 0;
  }
  cardFrame(ctx, suit.color);
  cardTitle(ctx, c.num, c.name, c.keys.join(' · '));
}

// Draws a card face onto a canvas of any size (scaled from the 448×768 design grid).
export function drawCardFace(card, width = CW) {
  const scale = width / CW;
  const [c, ctx] = canvas(Math.round(CW * scale), Math.round(CH * scale));
  ctx.scale(scale, scale);
  if (card.arcana === 'major') drawMajor(ctx, card); else drawMinor(ctx, card);
  return c;
}
export const makeFront = (card) => toTex(drawCardFace(card));
const thumbs = new Map();
export function cardThumb(card) {
  if (!thumbs.has(card.id)) thumbs.set(card.id, drawCardFace(card, 180).toDataURL('image/jpeg', 0.85));
  return thumbs.get(card.id);
}

export function makeBack() {
  const [c, ctx] = canvas(CW, CH);
  const bg = ctx.createLinearGradient(0, 0, CW, CH);
  bg.addColorStop(0, '#1d0e33'); bg.addColorStop(1, '#0a0513');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = 'rgba(217,180,106,0.09)'; ctx.lineWidth = 1;
  for (let i = -CH; i < CW + CH; i += 30) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + CH, CH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - CH, CH); ctx.stroke();
  }
  sprinkleStars(ctx, CW, CH, 70, 99);
  const cx = CW / 2, cy = CH / 2;
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200);
  rg.addColorStop(0, 'rgba(140,100,255,0.35)'); rg.addColorStop(1, 'rgba(140,100,255,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, CW, CH);
  ctx.strokeStyle = '#d9b46a';
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 150, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 138, 0, Math.PI * 2); ctx.stroke();
  starPath(ctx, cx, cy, 8, 132, 60); ctx.stroke();
  starPath(ctx, cx, cy, 8, 132, 60, -Math.PI / 2 + Math.PI / 8); ctx.stroke();
  ctx.fillStyle = 'rgba(240,211,145,0.9)';
  ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#150a26';
  ctx.beginPath(); ctx.arc(cx + 14, cy - 6, 30, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#d9b46a';
  for (const y of [110, CH - 110]) { starPath(ctx, cx, y, 4, 18, 4); ctx.fill(); }
  cardFrame(ctx);
  return toTex(c);
}

export function makeTableTexture() {
  const S = 1024, [c, ctx] = canvas(S, S), h = S / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, '#2e1142'); g.addColorStop(1, '#14071f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(217,180,106,0.55)';
  ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h, h, h * 0.93, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(h, h, h * 0.8, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(h, h, h * 0.42, 0, Math.PI * 2); ctx.stroke();
  const zodiac = '♈♉♊♋♌♍♎♏♐♑♒♓';
  ctx.fillStyle = 'rgba(217,180,106,0.6)';
  ctx.font = `44px ${SYMBOL_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save(); ctx.translate(h + Math.cos(a) * h * 0.865, h + Math.sin(a) * h * 0.865); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(zodiac[i] + '︎', 0, 0); ctx.restore();
    ctx.strokeStyle = 'rgba(217,180,106,0.35)';
    const b = a + Math.PI / 12;
    ctx.beginPath(); ctx.moveTo(h + Math.cos(b) * h * 0.8, h + Math.sin(b) * h * 0.8); ctx.lineTo(h + Math.cos(b) * h * 0.93, h + Math.sin(b) * h * 0.93); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(217,180,106,0.18)';
  starPath(ctx, h, h, 6, h * 0.78, h * 0.42); ctx.stroke();
  sprinkleStars(ctx, S, S, 160, 5, 'rgba(240,220,170,0.6)');
  return toTex(c);
}
export function makeRugTexture() {
  const S = 1024, [c, ctx] = canvas(S, S), h = S / 2;
  ctx.fillStyle = '#1c0710'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = i % 2 ? 'rgba(150,60,70,0.5)' : 'rgba(200,150,80,0.25)';
    ctx.lineWidth = i % 3 ? 4 : 10;
    ctx.beginPath(); ctx.arc(h, h, h * (0.97 - i * 0.1), 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200,150,80,0.18)';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    starPath(ctx, h + Math.cos(a) * h * 0.85, h + Math.sin(a) * h * 0.85, 4, 22, 6, a); ctx.fill();
  }
  return toTex(c);
}
