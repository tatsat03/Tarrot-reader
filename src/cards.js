import * as THREE from 'three';
import { scene, camera, camBase, camTarget, HIGH, Y_AXIS, Z_AXIS, envTex } from './engine.js';
import { tween, easeInOut, clamp, shuffle, glow, nowS } from './util.js';
import { makeFront, makeBack } from './textures.js';
import { TABLE_Y, BALL_POS, softTex, sparkTex } from './room.js';
import { state } from './state.js';
import { DECK } from '../data/deck.js';

export const CARD_W = 0.5, CARD_H = 0.86, CARD_T = 0.004;

const cardShape = (() => {
  const s = new THREE.Shape(), w = CARD_W, h = CARD_H, r = 0.03, x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
})();
const faceGeo = new THREE.ShapeGeometry(cardShape, 6);
{
  const uv = faceGeo.attributes.uv, p = faceGeo.attributes.position;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / CARD_W + 0.5, p.getY(i) / CARD_H + 0.5);
}
const edgeGeo = new THREE.ExtrudeGeometry(cardShape, { depth: CARD_T, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -CARD_T / 2);
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.6, roughness: 0.4, envMap: envTex });
const haloGeo = new THREE.PlaneGeometry(1, 1);
const backTex = makeBack();
const backMat = new THREE.MeshStandardMaterial({ map: backTex, emissiveMap: backTex, emissive: 0xffffff, emissiveIntensity: 0.38, roughness: 0.55 });

export const deck = [];          // one 3D card per tarot card, all 78
const byId = new Map();
export const groupFor = (card) => byId.get(card.id);

// Card faces are painted lazily — the first time a card turns over — to keep GPU memory modest.
export function ensureFront(g) {
  const u = g.userData;
  if (u.frontLoaded) return;
  const tex = makeFront(u.card);
  const opts = { map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.45 };
  u.front.material = HIGH
    ? new THREE.MeshPhysicalMaterial({ ...opts, clearcoat: 0.35, clearcoatRoughness: 0.4, iridescence: 0.35, iridescenceIOR: 1.4, envMap: envTex, envMapIntensity: 0.5 })
    : new THREE.MeshStandardMaterial(opts);
  u.frontLoaded = true;
}

function buildCard(card) {
  const g = new THREE.Group();
  const front = new THREE.Mesh(faceGeo, backMat); // shows the veil until its face is painted
  front.position.z = CARD_T / 2 + 0.0006;
  const back = new THREE.Mesh(faceGeo, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -CARD_T / 2 - 0.0006;
  const edge = new THREE.Mesh(edgeGeo, edgeMat);
  const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ map: softTex, color: glow(card.color, 0.9), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(1.25, 1.65, 1);
  halo.position.z = -0.03;
  for (const m of [front, back, edge]) { m.castShadow = HIGH; m.receiveShadow = HIGH; m.userData.card = g; }
  g.add(halo, edge, front, back);
  g.visible = false;
  g.userData = {
    card, state: 'out', front, meshes: [front, back, edge], frontLoaded: false,
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), flip: Math.PI, rev: 0, spin: 0, scale: 0.8,
    hover: 0, halo, haloAmt: 0, haloTarget: 0, bob: false, phase: Math.random() * 6,
  };
  scene.add(g);
  deck.push(g);
  byId.set(card.id, g);
}
DECK.forEach(buildCard);

export let inPlay = [];
export function setInPlay(cards) {
  const ids = new Set(cards.map((c) => c.id));
  inPlay = deck.filter((g) => ids.has(g.userData.card.id));
  for (const g of deck) {
    const on = ids.has(g.userData.card.id);
    g.visible = on;
    g.userData.state = on ? 'stack' : 'out';
  }
}

/* ---------- poses ---------- */
const _d = new THREE.Object3D();
export function cameraFacing(pos) {
  _d.position.copy(pos);
  _d.lookAt(camBase);
  return _d.quaternion.clone();
}
export const viewDir = () => new THREE.Vector3().subVectors(camTarget, camBase).normalize();

function stackPose(i) {
  return {
    pos: new THREE.Vector3(0.46, TABLE_Y + 0.004 + i * 0.0024, -0.56),
    quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, (Math.random() - 0.5) * 0.1 + 0.15)),
  };
}

// Animate a card's pose. `arc` lifts it along world-up mid-flight.
export function moveCard(g, { pos, quat, flip, rev, scale }, { duration = 1, delay = 0, arc = 0, ease = easeInOut } = {}) {
  const u = g.userData;
  let p0, q0, f0, r0, s0;
  return tween({
    duration, delay, ease,
    onStart: () => { p0 = u.pos.clone(); q0 = u.quat.clone(); f0 = u.flip; r0 = u.rev; s0 = u.scale; },
    onUpdate: (k) => {
      if (pos) { u.pos.lerpVectors(p0, pos, k); if (arc) u.pos.y += Math.sin(k * Math.PI) * arc; }
      if (quat) u.quat.slerpQuaternions(q0, quat, k);
      if (flip !== undefined) u.flip = f0 + (flip - f0) * k;
      if (rev !== undefined) u.rev = r0 + (rev - r0) * k;
      if (scale !== undefined) u.scale = s0 + (scale - s0) * k;
    },
  });
}

export function stackDeck(instant, cards = inPlay) {
  return Promise.all(cards.map((g, i) => {
    const u = g.userData, p = stackPose(i);
    Object.assign(u, { state: 'stack', bob: false, haloTarget: 0, spin: 0 });
    if (instant) {
      Object.assign(u, { flip: Math.PI, rev: 0, scale: 0.8 });
      u.pos.copy(p.pos); u.quat.copy(p.quat);
      return Promise.resolve();
    }
    return moveCard(g, { ...p, flip: Math.PI, rev: 0, scale: 0.8 }, { duration: 1.1, delay: Math.min(i, 40) * 0.02, arc: 0.35 });
  }));
}

export const fanCards = () => inPlay.filter((g) => g.userData.state === 'fan');

function fanPoses(n, lowered) {
  const rows = n > 30 ? 2 : 1;
  const per = Math.ceil(n / rows);
  const dir = viewDir();
  const base = camBase.clone().addScaledVector(dir, rows > 1 ? 2.35 : 1.9);
  const q = cameraFacing(base);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const poses = [];
  for (let r = 0; r < rows; r++) {
    const count = Math.min(per, n - r * per);
    const center = base.clone()
      .addScaledVector(up, lowered ? -1.4 : rows === 1 ? -0.36 : r === 0 ? -0.3 : -0.6)
      .addScaledVector(dir, rows > 1 && r === 0 ? 0.1 : 0);
    const R = rows === 1 ? 1.9 : 3.2;
    const spread = (rows === 1 ? 0.62 : 0.42) * clamp(camera.aspect / 1.5, 0.42, 1) * Math.min(1, (count + 4) / 26);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const a = t * spread;
      const local = new THREE.Vector3(Math.sin(a) * R, Math.cos(a) * R - R, (r * per + i) * 0.004).applyQuaternion(q);
      poses.push({ pos: center.clone().add(local), quat: q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -a)) });
    }
  }
  return { poses, scale: rows > 1 ? 0.33 : 0.5 };
}
export function layoutFan(lowered = false) {
  const cards = fanCards();
  const { poses, scale } = fanPoses(cards.length, lowered);
  return Promise.all(cards.map((g, i) =>
    moveCard(g, { ...poses[i], flip: Math.PI, rev: 0, scale }, { duration: lowered ? 0.8 : 1.0, delay: Math.min(i, 40) * 0.01 })));
}

// Close to the camera, for reading a card. `side` shifts it left to make room for a panel.
export function focusPose(side = -0.42) {
  const dir = viewDir();
  const pos = camBase.clone().addScaledVector(dir, 2.0);
  const right = new THREE.Vector3().crossVectors(dir, Y_AXIS).normalize();
  if (innerWidth > 820) pos.addScaledVector(right, side).add(new THREE.Vector3(0, 0.08, 0));
  else pos.y += 0.12;
  return { pos, quat: cameraFacing(pos) };
}

// Where revealed cards rest on the table, per spread.
export function slotPoses(spread) {
  const n = spread.positions.length;
  const tilt = (x, rz = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.55, -x * 0.3, rz));
  if (spread.layout === 'celtic') {
    const cx = -0.4, cz = 0.3, dx = 0.42, dz = 0.36;
    const P = [[cx, cz], [cx, cz], [cx, cz + dz], [cx - dx, cz], [cx, cz - dz], [cx + dx, cz], [0.78, 0.64], [0.78, 0.37], [0.78, 0.1], [0.78, -0.17]];
    return P.map(([x, z], i) => ({
      pos: new THREE.Vector3(x, TABLE_Y + 0.14 + (0.64 - z) * 0.3 + (i === 1 ? 0.03 : 0), z + (i === 1 ? 0.02 : 0)),
      quat: tilt(x, i === 1 ? Math.PI / 2 : 0),
      scale: 0.4,
    }));
  }
  const spacing = n <= 3 ? 0.66 : 0.5, scale = n === 1 ? 0.8 : n <= 3 ? 0.72 : 0.56;
  return spread.positions.map((_, i) => {
    const o = i - (n - 1) / 2, x = o * spacing;
    return { pos: new THREE.Vector3(x, TABLE_Y + 0.16 + Math.abs(o) * 0.02, 0.45 - Math.abs(o) * 0.09), quat: tilt(x), scale };
  });
}

export async function shuffleDeck(onRaise) {
  shuffle(inPlay);
  const N = inPlay.length;
  const from = inPlay.map((g) => ({ pos: g.userData.pos.clone(), quat: g.userData.quat.clone() }));
  const center = new THREE.Vector3(BALL_POS.x, 1.75, BALL_POS.z + 0.15);
  const dur = 3.4, rp = new THREE.Vector3();
  const stagger = Math.min(0.05, 1.6 / N);
  onRaise && onRaise(0.6);
  await tween({
    duration: dur, ease: (k) => k,
    onUpdate: (k) => {
      const t = k * dur;
      inPlay.forEach((g, i) => {
        const u = g.userData;
        const p = easeInOut(clamp((t - i * stagger) / 0.9, 0, 1));
        const ang = (i / N) * Math.PI * 2 + t * 1.5 + t * t * 0.12;
        const ring = 1.25 + (N > 30 ? (i % 2) * 0.12 : 0);
        rp.set(center.x + Math.cos(ang) * ring, center.y + Math.sin(ang * 2 + t) * 0.09 + (N > 30 ? (i % 3) * 0.05 : 0), center.z + Math.sin(ang) * 0.6);
        _d.position.copy(rp);
        _d.lookAt(2 * rp.x - center.x, rp.y, 2 * rp.z - center.z); // backs face outward
        u.pos.lerpVectors(from[i].pos, rp, p);
        u.quat.slerpQuaternions(from[i].quat, _d.quaternion, p);
      });
    },
  });
  onRaise && onRaise(0);
  inPlay.forEach((g) => (g.userData.state = 'fan'));
  await layoutFan(false);
}

/* ---------- particles when a card turns ---------- */
const bursts = [];
export function burst(origin, color) {
  const N = HIGH ? 220 : 120, pos = new Float32Array(N * 3), vel = [];
  for (let i = 0; i < N; i++) {
    pos.set([origin.x, origin.y, origin.z], i * 3);
    const v = new THREE.Vector3().randomDirection().multiplyScalar(0.4 + Math.random() * 1.1);
    v.y += 0.3;
    vel.push(v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: sparkTex, color: glow(color, 2.2), size: 0.06, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(pts);
  bursts.push({ pts, pos, vel, born: nowS() });
}

const hoverGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xf0c870, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
scene.add(hoverGlow);

/* ---------- per-frame ---------- */
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
export function updateCards(t, dt) {
  for (const g of deck) {
    if (!g.visible) continue;
    const u = g.userData;
    u.hover += ((g === state.hovered ? 1 : 0) - u.hover) * Math.min(1, dt * 10);
    g.position.copy(u.pos);
    if (u.bob) g.position.y += Math.sin(t * 1.1 + u.phase) * 0.012;
    _v.set(0, 1, 0).applyQuaternion(u.quat);
    g.position.addScaledVector(_v, u.hover * 0.18 * u.scale);
    g.quaternion.copy(u.quat)
      .multiply(_q.setFromAxisAngle(Y_AXIS, u.flip + u.spin))
      .multiply(_q2.setFromAxisAngle(Z_AXIS, u.rev));
    g.scale.setScalar(u.scale * (1 + u.hover * 0.06));
    const faceUp = Math.max(0, Math.cos(u.flip + u.spin));
    u.haloAmt += (u.haloTarget * faceUp - u.haloAmt) * Math.min(1, dt * 3);
    u.halo.material.opacity = u.haloAmt * (0.75 + Math.sin(t * 2 + u.phase) * 0.15);
  }
  const h = state.hovered;
  hoverGlow.material.opacity += ((h ? 0.6 : 0) - hoverGlow.material.opacity) * Math.min(1, dt * 8);
  if (h) {
    hoverGlow.position.copy(h.position).addScaledVector(viewDir(), 0.06);
    hoverGlow.scale.set(h.userData.scale * 1.0, h.userData.scale * 1.45, 1);
  }
  for (let b = bursts.length - 1; b >= 0; b--) {
    const B = bursts[b], life = nowS() - B.born;
    for (let i = 0; i < B.vel.length; i++) {
      const v = B.vel[i];
      v.multiplyScalar(0.96); v.y -= dt * 0.25;
      B.pos[i * 3] += v.x * dt; B.pos[i * 3 + 1] += v.y * dt; B.pos[i * 3 + 2] += v.z * dt;
    }
    B.pts.geometry.attributes.position.needsUpdate = true;
    B.pts.material.opacity = Math.max(0, 1 - life / 1.8);
    if (life > 1.8) { scene.remove(B.pts); B.pts.geometry.dispose(); B.pts.material.dispose(); bursts.splice(b, 1); }
  }
}
