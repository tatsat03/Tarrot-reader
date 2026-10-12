import * as THREE from 'three';
import { HIGH, envTex } from './engine.js';
import { glow } from './util.js';
import { canvas, toTex, makeBack, makeRugTexture, flameTexture } from './textures.js';
import { softTex } from './room.js';
import { stripeTexture } from './village.js';
import { createHub } from './hub.js';
import { spreadById } from '../data/deck.js';

/* =====================================================================
   Inside Seraphine's tent: a big top full of reading stalls.
   Each stall is one kind of reading; her great table at the back holds the Celtic Cross.
   ===================================================================== */
export const bazaar = new THREE.Scene();
bazaar.background = new THREE.Color(0x0d0610);
bazaar.fog = new THREE.FogExp2(0x1a0c18, 0.035);

const R = 7.2; // stalls stand on this circle, facing the middle of the ring
export const STALLS = [
  { id: 'daily',      spread: 'single',       name: 'The Daily Draw',          sub: 'One card · guidance',              angle: -100, colors: ['#7a2a1e', '#f0d9a8'], prop: 'card' },
  { id: 'hourglass',  spread: 'ppf',          name: 'The Hourglass',           sub: 'Past · Present · Future',          angle: -64,  colors: ['#1e3f6e', '#e9dcc0'], prop: 'hourglass' },
  { id: 'mirror',     spread: 'mirror',       name: 'The Mirror Booth',        sub: 'What you carry, face, become',     angle: -30,  colors: ['#3d1d5c', '#d9b46a'], prop: 'mirror' },
  { id: 'table',      spread: 'celtic',       name: "Seraphine's Great Table", sub: 'The Celtic Cross · ten cards',     angle: 0 },
  { id: 'lanterns',   spread: 'mbs',          name: 'The Three Lanterns',      sub: 'Mind · Body · Spirit',             angle: 30,   colors: ['#1d5a50', '#efe2c4'], prop: 'lanterns' },
  { id: 'crossroads', spread: 'crossroads',   name: 'The Crossroads',          sub: 'A choice between two paths',       angle: 64,   colors: ['#5a4a1a', '#efe2c4'], prop: 'signpost' },
  { id: 'lovers',     spread: 'relationship', name: "The Lovers' Booth",       sub: 'For two · the bond between you',   angle: 100,  colors: ['#7a1f3c', '#f6d6dc'], prop: 'hearts', duo: true },
];
for (const s of STALLS) s.spreadObj = spreadById(s.spread);

function overview() {
  const asp = innerWidth / innerHeight;
  const k = asp < 1.2 ? 1 + (1.2 - asp) * 0.8 : 1;
  return { pos: new THREE.Vector3(0, 3.6 * k, 10.2 * k), look: new THREE.Vector3(0, 1.5, -2.6) };
}

/* ---------- the big top ---------- */
const brass = new THREE.MeshStandardMaterial({ color: 0xd2a75a, metalness: 0.75, roughness: 0.32, envMap: envTex, envMapIntensity: 0.8 });
const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.8 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x24160f, roughness: 0.9 });
const lampMat = new THREE.MeshBasicMaterial({ color: glow(0xffc070, 2.4) });
const lampLights = [];
{
  bazaar.add(new THREE.HemisphereLight(0x9a6ab8, 0x2a140c, 0.9));
  bazaar.add(new THREE.AmbientLight(0x3a2030, 0.5));
  const top = new THREE.SpotLight(0xffd8a0, 40, 30, 0.75, 0.7, 1.6);
  top.position.set(0, 11, 0); top.target.position.set(0, 0, -1);
  if (HIGH) { top.castShadow = true; top.shadow.mapSize.set(2048, 2048); top.shadow.bias = -0.0006; }
  bazaar.add(top, top.target);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(12.5, 96), new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = HIGH;
  const rug = new THREE.Mesh(new THREE.CircleGeometry(5.2, 96), new THREE.MeshStandardMaterial({ map: makeRugTexture(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.01; rug.receiveShadow = HIGH;
  const sawdust = new THREE.Mesh(new THREE.RingGeometry(5.2, 5.4, 96), new THREE.MeshStandardMaterial({ color: 0x6a4a24, metalness: 0.4, roughness: 0.6 }));
  sawdust.rotation.x = -Math.PI / 2; sawdust.position.y = 0.012;
  bazaar.add(floor, rug, sawdust);

  const wallTex = stripeTexture('#4a1a62', '#c9a24e', 40);
  const walls = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 6.5, 80, 1, true), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, side: THREE.BackSide }));
  walls.position.y = 3.25;
  const roofTex = stripeTexture('#4a1a62', '#c9a24e', 32);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(12.1, 6.5, 80, 1, true), new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.8, side: THREE.BackSide }));
  roof.position.y = 6.5 + 3.25;
  bazaar.add(walls, roof);

  // a brass chandelier ring of candles, and strings of bulbs from the peak to the walls
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.05, 8, 48), brass);
  ring.rotation.x = Math.PI / 2; ring.position.y = 8.2;
  bazaar.add(ring);
  const chandelierLight = new THREE.PointLight(0xffb070, 8, 22, 1.5);
  chandelierLight.position.y = 7.8;
  bazaar.add(chandelierLight);
  const bulbs = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; bulbs.push(new THREE.Vector3(Math.cos(a) * 1.5, 8.32, Math.sin(a) * 1.5)); }
  const apex = new THREE.Vector3(0, 12.4, 0), lineMat = new THREE.LineBasicMaterial({ color: 0x120a08 });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2, end = new THREE.Vector3(Math.cos(a) * 11.7, 6.4, Math.sin(a) * 11.7);
    const pts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3().lerpVectors(apex, end, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.9, 0))); }
    bazaar.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    for (let i = 2; i < 20; i += 2) bulbs.push(pts[i].clone().add(new THREE.Vector3(0, -0.07, 0)));
  }
  const pal = [0xffd27a, 0xffa860, 0xff7aa8, 0xc79bff, 0xffe9b0];
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial(), bulbs.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  bulbs.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m); inst.setColorAt(i, c.set(pal[i % pal.length]).multiplyScalar(2.4)); });
  bazaar.add(inst);

  // barrels and crates between stalls
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 });
  for (const a of [-118, -82, -47, 47, 82, 118]) {
    const rad = (a * Math.PI) / 180, x = Math.sin(rad) * (R + 0.8), z = -Math.cos(rad) * (R + 0.8);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.8, 16), barrelMat);
    b.position.set(x, 0.4, z);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 6, 24), brass);
    hoop.rotation.x = Math.PI / 2; hoop.position.set(x, 0.62, z);
    bazaar.add(b, hoop);
  }
}

/* ---------- stall pieces ---------- */
function signTexture(text) {
  const [cv, ctx] = canvas(640, 140);
  ctx.fillStyle = '#1a0f22'; ctx.fillRect(0, 0, 640, 140);
  ctx.strokeStyle = '#e2bd62'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 624, 124);
  ctx.lineWidth = 1.5; ctx.strokeRect(20, 20, 600, 100);
  ctx.fillStyle = '#f6dc9c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 50; ctx.font = `600 ${size}px Cinzel, serif`;
  while (ctx.measureText(text.toUpperCase()).width > 560 && size > 24) { size -= 2; ctx.font = `600 ${size}px Cinzel, serif`; }
  ctx.fillText(text.toUpperCase(), 320, 74);
  return toTex(cv);
}
function backdropTexture(color) {
  const [cv, ctx] = canvas(256, 256);
  const g = ctx.createRadialGradient(128, 110, 10, 128, 128, 180);
  g.addColorStop(0, color); g.addColorStop(1, '#0d0610');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(255,235,190,0.6)';
  for (let i = 0; i < 60; i++) { ctx.globalAlpha = Math.random() * 0.7; ctx.beginPath(); ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 1.6 + 0.3, 0, Math.PI * 2); ctx.fill(); }
  return toTex(cv);
}
const cardBack = makeBack();
const flameTex = flameTexture();
function candle(x, z, parent) {
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0xeadcc0, emissive: 0x3a2008, emissiveIntensity: 0.6 }));
  wax.position.set(x, 0.09, z);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: glow(0xffc070, 2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  f.position.set(x, 0.23, z); f.scale.set(0.05, 0.1, 1);
  parent.add(wax, f);
}
function prop(kind, color) {
  const g = new THREE.Group();
  if (kind === 'card') {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.58), new THREE.MeshStandardMaterial({ map: cardBack, emissive: 0xffffff, emissiveMap: cardBack, emissiveIntensity: 0.5, side: THREE.DoubleSide }));
    card.position.y = 0.33; card.rotation.x = -0.2;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.16), brass);
    stand.position.y = 0.02;
    g.add(card, stand);
    candle(0.4, 0, g); candle(-0.42, 0.05, g);
  } else if (kind === 'hourglass') {
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.35, roughness: 0.05, envMap: envTex });
    const sand = new THREE.MeshStandardMaterial({ color: 0xe8c47a, emissive: 0x6a4a10, emissiveIntensity: 0.6 });
    for (const s of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.26, 20, 1, true), glass);
      cone.position.y = 0.3 + s * 0.13; cone.rotation.x = s > 0 ? 0 : Math.PI;
      g.add(cone);
    }
    const pile = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 20), sand); pile.position.y = 0.21;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.07, 20), sand); top.position.y = 0.37; top.rotation.x = Math.PI;
    g.add(pile, top);
    for (const y of [0.03, 0.58]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 24), wood); d.position.y = y; g.add(d); }
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.56, 6), brass); const a = (i / 3) * Math.PI * 2; p.position.set(Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17); g.add(p); }
  } else if (kind === 'mirror') {
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.035, 10, 40), brass);
    frame.scale.set(1, 1.3, 1); frame.position.y = 0.48;
    const glassMesh = new THREE.Mesh(new THREE.CircleGeometry(0.27, 40), new THREE.MeshStandardMaterial({ color: 0xc8c8ff, metalness: 1, roughness: 0.04, envMap: envTex, envMapIntensity: 1.6 }));
    glassMesh.scale.set(1, 1.3, 1); glassMesh.position.set(0, 0.48, -0.01);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.12, 16), brass); foot.position.y = 0.06;
    g.add(frame, glassMesh, foot);
  } else if (kind === 'lanterns') {
    [[-0.38, 0x8fb8ff], [0, 0xff8a6a], [0.38, 0xffd27a]].forEach(([x, col]) => {
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2a18, wireframe: true }));
      cage.position.set(x, 0.18, 0);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: glow(col, 2.6) }));
      core.position.set(x, 0.18, 0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 6), brass); cap.position.set(x, 0.38, 0);
      g.add(cage, core, cap);
    });
  } else if (kind === 'signpost') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.8, 8), wood); pole.position.y = 0.4;
    g.add(pole);
    [[0.6, 0.35], [0.45, -0.4]].forEach(([y, rot], i) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.03), new THREE.MeshStandardMaterial({ color: i ? 0x8a6a3a : 0xa07a42, roughness: 0.8 }));
      board.position.set(Math.cos(rot) * 0.16 * (i ? -1 : 1), y, 0); board.rotation.y = rot;
      g.add(board);
    });
  } else if (kind === 'hearts') {
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.12); heart.bezierCurveTo(-0.2, 0.02, -0.12, 0.17, 0, 0.08); heart.bezierCurveTo(0.12, 0.17, 0.2, 0.02, 0, -0.12);
    const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xd0405a, emissive: 0x80142a, emissiveIntensity: 0.9, roughness: 0.4 }));
    hm.position.y = 0.32; hm.scale.setScalar(1.3);
    g.add(hm);
    candle(-0.3, 0.05, g); candle(0.3, 0.05, g);
  }
  return g;
}

function buildStall(s) {
  const g = new THREE.Group();
  const clothTex = stripeTexture(s.colors[0], s.colors[1], 10);
  const cloth = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.8 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.95, 0.75), [cloth, cloth, wood, wood, cloth, cloth]);
  counter.position.y = 0.475;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.06, 0.86), wood);
  top.position.y = 0.98;
  g.add(counter, top);
  for (const x of [-1.02, 1.02]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 2.7, 8), darkWood);
    post.position.set(x, 1.35, -0.32);
    g.add(post);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.6), new THREE.MeshStandardMaterial({ map: backdropTexture(s.colors[0]), roughness: 0.9 }));
  back.position.set(0, 1.8, -0.36);
  g.add(back);
  // striped awning tipping toward the visitor, with a scalloped edge
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.0), new THREE.MeshStandardMaterial({ map: stripeTexture(s.colors[0], s.colors[1], 12), roughness: 0.8, side: THREE.DoubleSide }));
  awning.position.set(0, 2.62, 0.05); awning.rotation.x = -1.05;
  g.add(awning);
  const scallopGeo = new THREE.CircleGeometry(0.15, 10, Math.PI, Math.PI);
  const sA = new THREE.MeshStandardMaterial({ color: s.colors[0], side: THREE.DoubleSide }), sB = new THREE.MeshStandardMaterial({ color: s.colors[1], side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(scallopGeo, i % 2 ? sA : sB);
    m.position.set(-1.0 + i * 0.286, 2.38, 0.5);
    g.add(m);
  }
  const signMat = new THREE.MeshBasicMaterial({ map: signTexture(s.name), color: glow(0xffffff, 1.0) });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.37), signMat);
  sign.position.set(0, 3.1, -0.2);
  g.add(sign);
  const item = prop(s.prop, s.colors[0]);
  item.position.set(0, 1.01, 0.05);
  g.add(item);
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), lampMat);
  lamp.position.set(0.78, 2.15, 0.25); lamp.scale.set(1, 1.4, 1);
  const light = new THREE.PointLight(0xffb070, 1.6, 5.5, 2);
  light.position.set(0.3, 2.0, 0.9);
  g.add(lamp, light);
  lampLights.push(light);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 1.8), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 1.7;
  g.add(hit);
  return {
    g, hits: [hit], top: new THREE.Vector3(0, 3.55, -0.2),
    onGlow: (k, t) => { light.intensity = 1.6 * (1 + k * 1.4) * (0.94 + Math.sin(t * 5 + s.angle) * 0.06); signMat.color.copy(glow(0xffffff, 1 + k * 0.5)); },
  };
}

// Seraphine's own table, for the great spread.
function buildTable() {
  const g = new THREE.Group();
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 0.9, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a1250, roughness: 0.95, side: THREE.DoubleSide }));
  cloth.position.y = 0.45;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.04, 64), new THREE.MeshStandardMaterial({ color: 0x2a0d3a, roughness: 0.85 }));
  top.position.y = 0.9;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.02, 8, 96), brass);
  trim.rotation.x = Math.PI / 2; trim.position.y = 0.92;
  const ballMat = new THREE.MeshBasicMaterial({ color: glow(0x9a7cff, 1.8), transparent: true, opacity: 0.85 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), ballMat);
  ball.position.set(0, 1.15, -0.2);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0x8a6cff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(ball.position); halo.scale.setScalar(1.6);
  const light = new THREE.PointLight(0x9a7cff, 4, 8, 2);
  light.position.set(0, 1.4, 0.4);
  const spot = new THREE.SpotLight(0xffd8a8, 18, 9, 0.45, 0.8, 1.6); // a pool of light on her table
  spot.position.set(0, 6, 1.5); spot.target.position.set(0, 1, -0.4);
  g.add(spot, spot.target);
  g.add(cloth, top, trim, ball, halo, light);
  // a hooded figure waiting behind the table
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 32), new THREE.MeshStandardMaterial({ color: 0x4a2a80, roughness: 0.75 }));
  robe.position.set(0, 0.85, -1.1);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), new THREE.MeshStandardMaterial({ color: 0x45257a, roughness: 0.75 }));
  hood.position.set(0, 1.85, -1.1);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), new THREE.MeshBasicMaterial({ color: 0x050308 }));
  face.position.set(0, 1.82, -0.96);
  const eyeMat = new THREE.MeshBasicMaterial({ color: glow(0xffcf7a, 3) });
  for (const x of [-0.065, 0.065]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeMat); e.position.set(x, 1.84, -0.79); e.scale.set(1.3, 1, 0.6); g.add(e); }
  g.add(robe, hood, face);
  const candles = new THREE.Group();
  candles.position.y = 0.92;
  candle(-0.8, 0.3, candles); candle(0.8, 0.3, candles);
  g.add(candles);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 16), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 1.3, -0.4);
  g.add(hit);
  return {
    g, hits: [hit], top: new THREE.Vector3(0, 2.6, -0.6),
    onGlow: (k, t) => { light.intensity = 3 * (1 + k * 1.2); halo.material.opacity = 0.5 + k * 0.3 + Math.sin(t * 1.7) * 0.08; eyeMat.color.copy(glow(0xffcf7a, 3 + k * 2)); },
  };
}

for (const s of STALLS) {
  Object.assign(s, s.id === 'table' ? buildTable() : buildStall(s));
  const rad = (s.angle * Math.PI) / 180;
  const radius = s.id === 'table' ? R - 1.6 : R;
  const x = Math.sin(rad) * radius, z = -Math.cos(rad) * radius;
  s.g.position.set(x, 0, z);
  s.g.lookAt(0, 0, 0);
  bazaar.add(s.g);
  const toward = new THREE.Vector3(-x, 0, -z).normalize();
  s.view = {
    pos: new THREE.Vector3(x, 0, z).addScaledVector(toward, s.id === 'table' ? 4.2 : 3.4).setY(s.id === 'table' ? 2.4 : 1.95),
    look: new THREE.Vector3(x, s.id === 'table' ? 1.3 : 1.45, z),
  };
}
if (HIGH) bazaar.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.some((m) => m.transparent || m.isMeshBasicMaterial || m.wireframe)) return;
  o.castShadow = true; o.receiveShadow = true;
});

// floating motes in the lamplight
const motes = (() => {
  const N = 500, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos.set([(Math.random() - 0.5) * 20, Math.random() * 8, (Math.random() - 0.5) * 20], i * 3); seed[i] = Math.random() * 100; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTex, color: 0xffdca0, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  bazaar.add(pts);
  return { pts, pos, seed, N };
})();

export const bigTop = createHub({ name: 'bazaar', spots: STALLS, overview, order: STALLS.map((s) => s.id) });
// Stepping in through the tent flap.
export function enterBigTop() {
  const o = overview();
  bigTop.camPos.set(0, 2.2, 13.5);
  bigTop.camLook.copy(o.look);
  return bigTop.flyTo('overview', 2.0);
}

export function updateBazaar(t, dt) {
  bigTop.update(t, dt);
  const p = motes.pos;
  for (let i = 0; i < motes.N; i++) {
    p[i * 3 + 1] += dt * (0.04 + (motes.seed[i] % 1) * 0.05);
    p[i * 3] += Math.sin(t * 0.3 + motes.seed[i]) * dt * 0.04;
    if (p[i * 3 + 1] > 8) p[i * 3 + 1] = 0;
  }
  motes.pts.geometry.attributes.position.needsUpdate = true;
}
