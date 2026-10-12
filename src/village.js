import * as THREE from 'three';
import { HIGH } from './engine.js';
import { glow } from './util.js';
import { createHub } from './hub.js';
import { canvas, toTex, seeded, flameTexture } from './textures.js';
import { softTex, sparkTex } from './room.js';

/* =====================================================================
   The camp — a moonlit carnival where each tent is a place to go.
   ===================================================================== */
export const village = new THREE.Scene();
village.background = new THREE.Color(0x090b1a);
village.fog = new THREE.FogExp2(0x0c0f22, 0.026);

export const SPOTS = [
  { id: 'oracle',   kind: 'tent',     name: "Seraphine's Tent",       sub: 'Begin a reading',               x: 0,    z: -10,  r: 3.3, sides: 48, colors: ['#4e1a6e', '#e2bd62'], flag: '#b48cff', emblem: 'moon',  light: 0xc8a0ff },
  { id: 'library',  kind: 'tent',     name: 'The Library Pavilion',  sub: 'Learn all 78 cards',            x: -8.2, z: -5.2, r: 2.3, sides: 6,  colors: ['#1d3a6b', '#efe2c4'], flag: '#6fb8ff', emblem: 'book',  light: 0x9cc8ff },
  { id: 'memories', kind: 'tent',     name: 'The Hall of Memories',  sub: 'Past readings',                 x: 8.2,  z: -5.2, r: 2.1, sides: 32, colors: ['#145a5a', '#f2e6cc'], flag: '#6fe3c8', emblem: 'glass', light: 0x9ff0d8 },
  { id: 'settings', kind: 'wagon',    name: "The Tinker's Wagon",    sub: 'Voice · sound · graphics',      x: 5.4,  z: 1.4,  r: 1.6,                                        flag: '#ff8a5c', emblem: 'gear',  light: 0xffb070 },
  { id: 'intro',    kind: 'fire',     name: "The Storyteller's Fire", sub: 'What is tarot?',               x: 0,    z: 0,    r: 1.3,                                        emblem: null,    light: 0xff8a3a },
];

const OVERVIEW = { pos: new THREE.Vector3(0, 6.2, 14.5), look: new THREE.Vector3(0, 1.6, -3) };
function overview() {
  const asp = innerWidth / innerHeight;
  const k = asp < 1.2 ? 1 + (1.2 - asp) * 0.9 : 1;
  return { pos: new THREE.Vector3(0, 6.2 * k, 14.5 * k), look: OVERVIEW.look.clone() };
}

/* ---------- textures ---------- */
export function stripeTexture(a, b, n) {
  const [c, ctx] = canvas(1024, 64);
  const w = 1024 / n;
  for (let i = 0; i < n; i++) {
    const g = ctx.createLinearGradient(i * w, 0, (i + 1) * w, 0);
    const col = i % 2 ? b : a;
    g.addColorStop(0, col); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = col; ctx.fillRect(i * w, 0, w, 64);
    ctx.fillStyle = g; ctx.globalAlpha = 0.5; ctx.fillRect(i * w, 0, w, 64); ctx.globalAlpha = 1;
  }
  const t = toTex(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
function archTexture() {
  const [c, ctx] = canvas(128, 256);
  ctx.beginPath(); ctx.moveTo(8, 256); ctx.lineTo(8, 64); ctx.arc(64, 64, 56, Math.PI, 0); ctx.lineTo(120, 256); ctx.closePath();
  const g = ctx.createRadialGradient(64, 170, 10, 64, 150, 140);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.5, 'rgba(255,170,80,0.95)'); g.addColorStop(1, 'rgba(160,60,30,0.9)');
  ctx.fillStyle = g; ctx.fill();
  return toTex(c);
}
function emblemTexture(kind) {
  const S = 256, h = S / 2, [c, ctx] = canvas(S, S);
  ctx.fillStyle = '#1a0f22'; ctx.beginPath(); ctx.arc(h, h, h - 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e2bd62'; ctx.lineWidth = 8; ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h, h, h - 20, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#f6dc9c'; ctx.strokeStyle = '#f6dc9c'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
  if (kind === 'moon') {
    ctx.beginPath(); ctx.arc(h - 6, h, 62, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(h + 22, h - 14, 56, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1a0f22'; ctx.beginPath(); ctx.arc(h + 22, h - 14, 56, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6dc9c';
    for (const [x, y, r] of [[h + 34, h - 30, 14], [h + 56, h + 18, 8]]) {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 4, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.fill();
    }
  } else if (kind === 'book') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(h, h - 40); ctx.quadraticCurveTo(h + s * 40, h - 58, h + s * 74, h - 44);
      ctx.lineTo(h + s * 74, h + 44); ctx.quadraticCurveTo(h + s * 40, h + 30, h, h + 48); ctx.closePath(); ctx.stroke();
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(h + s * 16, h - 22 + i * 18); ctx.lineTo(h + s * 58, h - 28 + i * 18); ctx.lineWidth = 3; ctx.stroke(); }
      ctx.lineWidth = 7;
    }
  } else if (kind === 'glass') {
    ctx.beginPath(); ctx.moveTo(h - 50, h - 70); ctx.lineTo(h + 50, h - 70); ctx.lineTo(h + 8, h); ctx.lineTo(h + 50, h + 70); ctx.lineTo(h - 50, h + 70); ctx.lineTo(h - 8, h); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(h - 30, h + 62); ctx.lineTo(h + 30, h + 62); ctx.lineTo(h, h + 28); ctx.closePath(); ctx.fill();
    ctx.fillRect(h - 66, h - 80, 132, 9); ctx.fillRect(h - 66, h + 72, 132, 9);
  } else if (kind === 'gear') {
    ctx.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 58 : 76; ctx.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a0f22'; ctx.beginPath(); ctx.arc(h, h, 26, 0, Math.PI * 2); ctx.fill();
  }
  return toTex(c);
}
function groundTexture() {
  const S = 2048, [c, ctx] = canvas(S, S), W = 60;
  const px = (v) => ((v + W / 2) / W) * S;
  ctx.fillStyle = '#141c10'; ctx.fillRect(0, 0, S, S);
  const r = seeded(7);
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = `rgba(${40 + r() * 40},${55 + r() * 50},${25 + r() * 25},${0.25 + r() * 0.35})`;
    ctx.fillRect(r() * S, r() * S, 2 + r() * 3, 2 + r() * 5);
  }
  ctx.strokeStyle = '#3b2d1f'; ctx.lineCap = 'round'; ctx.shadowColor = '#3b2d1f'; ctx.shadowBlur = 30;
  for (const s of SPOTS) {
    if (s.kind === 'fire') continue;
    ctx.lineWidth = (S / W) * 1.7;
    ctx.beginPath(); ctx.moveTo(px(0), px(0)); ctx.lineTo(px(s.x), px(s.z)); ctx.stroke();
  }
  ctx.lineWidth = (S / W) * 2; ctx.beginPath(); ctx.moveTo(px(0), px(0)); ctx.lineTo(px(0), px(20)); ctx.stroke();
  const plaza = ctx.createRadialGradient(px(0), px(0), 10, px(0), px(0), (S / W) * 4.5);
  plaza.addColorStop(0, '#46352a'); plaza.addColorStop(0.75, '#3b2d1f'); plaza.addColorStop(1, 'rgba(59,45,31,0)');
  ctx.shadowBlur = 0; ctx.fillStyle = plaza; ctx.beginPath(); ctx.arc(px(0), px(0), (S / W) * 4.5, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 4000; i++) { // pebbles on the paths
    ctx.fillStyle = `rgba(120,100,80,${r() * 0.25})`;
    ctx.beginPath(); ctx.arc(px((r() - 0.5) * 9), px((r() - 0.5) * 9), 1 + r() * 2, 0, Math.PI * 2); ctx.fill();
  }
  return toTex(c);
}
function moonTexture() {
  const S = 256, h = S / 2, [c, ctx] = canvas(S, S);
  const halo = ctx.createRadialGradient(h, h, 30, h, h, h);
  halo.addColorStop(0, 'rgba(220,230,255,0.9)'); halo.addColorStop(0.3, 'rgba(160,180,255,0.25)'); halo.addColorStop(1, 'rgba(120,140,255,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#eef0ff'; ctx.beginPath(); ctx.arc(h, h, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(160,170,210,0.5)';
  for (const [x, y, r] of [[-10, -8, 8], [12, 6, 6], [-4, 14, 5], [10, -14, 4]]) { ctx.beginPath(); ctx.arc(h + x, h + y, r, 0, Math.PI * 2); ctx.fill(); }
  return toTex(c);
}

/* ---------- sky, light, ground ---------- */
{
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; void main(){
      float h = normalize(vP).y;
      vec3 hor = vec3(0.20, 0.08, 0.24), mid = vec3(0.07, 0.05, 0.16), top = vec3(0.012, 0.018, 0.06);
      vec3 c = mix(hor, mid, smoothstep(-0.02, 0.22, h));
      c = mix(c, top, smoothstep(0.22, 0.85, h));
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  village.add(sky);

  const N = 1600, pos = new Float32Array(N * 3), r = seeded(3);
  for (let i = 0; i < N; i++) {
    const th = r() * Math.PI * 2, ph = Math.acos(0.08 + r() * 0.92), R = 80;
    pos.set([Math.sin(ph) * Math.cos(th) * R, Math.cos(ph) * R, Math.sin(ph) * Math.sin(th) * R], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  village.add(new THREE.Points(sg, new THREE.PointsMaterial({ map: softTex, size: 0.55, color: 0xdfe6ff, transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })));

  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), color: glow(0xffffff, 1.4), transparent: true, fog: false, depthWrite: false }));
  moon.position.set(-26, 30, -60); moon.scale.setScalar(16);
  village.add(moon);

  village.add(new THREE.HemisphereLight(0x6a78c8, 0x2a1c12, 1.15));
  village.add(new THREE.AmbientLight(0x30284a, 0.6));
  const moonLight = new THREE.DirectionalLight(0xaab8ff, 1.25);
  moonLight.position.set(-14, 22, -10);
  if (HIGH) {
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    Object.assign(moonLight.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
    moonLight.shadow.bias = -0.0008;
  }
  village.add(moonLight);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = HIGH;
  const outer = new THREE.Mesh(new THREE.CircleGeometry(90, 48), new THREE.MeshStandardMaterial({ color: 0x0c120a, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02;
  village.add(ground, outer);
}

/* ---------- building blocks ---------- */
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.85 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.9 });
const brass = new THREE.MeshStandardMaterial({ color: 0xd2a75a, metalness: 0.7, roughness: 0.35 });
const lanternMat = new THREE.MeshBasicMaterial({ color: glow(0xffc070, 2.2) });
const archTex = archTexture();
const flameTex = flameTexture();
const flags = [];
const lanterns = [];

function lanternPost(x, z, h = 1.9) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 8), darkWood);
  post.position.set(x, h / 2, z);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), darkWood);
  arm.position.set(x + 0.18, h - 0.08, z);
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), lanternMat);
  lamp.position.set(x + 0.34, h - 0.28, z); lamp.scale.set(1, 1.4, 1);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xffb060, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.copy(lamp.position); halo.scale.setScalar(1.3);
  village.add(post, arm, lamp, halo);
  lanterns.push({ halo, phase: Math.random() * 10 });
}
function flagOn(parent, y, color, size = 1) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.3 * size, 8), brass);
  pole.position.y = y + 0.6 * size;
  const geo = new THREE.PlaneGeometry(0.9 * size, 0.42 * size, 10, 1).translate(0.45 * size, 0, 0);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15 }));
  flag.position.set(0.03, y + 1.05 * size, 0);
  parent.add(pole, flag);
  flags.push({ geo, base: geo.attributes.position.array.slice(), phase: Math.random() * 6 });
}

function buildTent(s) {
  const g = new THREE.Group();
  const r = s.r, wallH = r * 0.82, roofH = r * 1.15;
  const wallMat = new THREE.MeshStandardMaterial({ map: stripeTexture(s.colors[0], s.colors[1], s.sides === 6 ? 12 : 24), roughness: 0.8, side: THREE.DoubleSide });
  const roofMat = new THREE.MeshStandardMaterial({ map: stripeTexture(s.colors[0], s.colors[1], s.sides === 6 ? 12 : 20), roughness: 0.75, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wallH, s.sides, 1, true), wallMat);
  wall.position.y = wallH / 2;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.12, roofH, s.sides, 1, true), roofMat);
  roof.position.y = wallH + roofH / 2;
  g.add(wall, roof);
  // scalloped valance around the roof's edge
  const n = s.sides === 6 ? 18 : 26;
  const scallopA = new THREE.MeshStandardMaterial({ color: s.colors[1], roughness: 0.7, side: THREE.DoubleSide });
  const scallopB = new THREE.MeshStandardMaterial({ color: s.colors[0], roughness: 0.7, side: THREE.DoubleSide });
  const scallopGeo = new THREE.CircleGeometry(r * 0.17, 12, Math.PI, Math.PI);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const m = new THREE.Mesh(scallopGeo, i % 2 ? scallopA : scallopB);
    m.position.set(Math.sin(a) * r * 1.125, wallH + 0.01, Math.cos(a) * r * 1.125);
    m.rotation.y = a;
    g.add(m);
  }
  const trim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.12, 0.03, 6, s.sides === 6 ? 6 : 64), brass);
  trim.rotation.x = Math.PI / 2; trim.position.y = wallH + 0.02;
  if (s.sides === 6) trim.rotation.z = Math.PI / 6;
  g.add(trim);
  flagOn(g, wallH + roofH - 0.1, s.flag, r > 3 ? 1.3 : 1);

  // glowing entrance with drawn-back flaps
  const doorW = Math.min(1.7, r * 0.6), doorH = wallH * 0.9;
  const glowMat = new THREE.MeshBasicMaterial({ map: archTex, color: glow(0xffd8a0, 1.5), transparent: true, depthWrite: false });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(doorW, doorH), glowMat);
  door.position.set(0, doorH / 2, r + 0.02);
  g.add(door);
  for (const side of [-1, 1]) {
    const flap = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, doorH, 0), new THREE.Vector3(side * doorW * 0.5, 0, 0), new THREE.Vector3(side * doorW * 0.15, 0, 0),
    ]), new THREE.MeshStandardMaterial({ color: s.colors[0], roughness: 0.8, side: THREE.DoubleSide }));
    flap.geometry.computeVertexNormals();
    flap.position.set(side * doorW * 0.5, 0, r + 0.05);
    flap.rotation.y = side * 0.5;
    g.add(flap);
  }
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(r * 0.24, 40), new THREE.MeshBasicMaterial({ map: emblemTexture(s.emblem), color: glow(0xffffff, 1.05), transparent: true }));
  emblem.position.set(0, wallH + r * 0.32, r * 0.86 + 0.08);
  emblem.rotation.x = -0.35;
  g.add(emblem);
  return { g, glowMat, emblem, top: new THREE.Vector3(0, wallH + roofH + 0.4, 0), doorY: doorH * 0.6 };
}

function buildWagon(s) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ map: stripeTexture('#7a1f24', '#9c2c2c', 10), roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 1.6), [bodyMat, bodyMat, woodMat, woodMat, bodyMat, bodyMat]);
  body.position.y = 1.25;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3.0, 24, 1, false, -Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2c4a3a, roughness: 0.8 }));
  roof.rotation.z = Math.PI / 2; roof.position.y = 1.95; roof.scale.set(1, 1, 0.9);
  const trimTop = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.08, 1.7), brass);
  trimTop.position.y = 1.95;
  g.add(body, roof, trimTop);
  for (const [x, z] of [[-1, -0.85], [1, -0.85], [-1, 0.85], [1, 0.85]]) {
    const wheel = new THREE.Group();
    wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 24), darkWood));
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.8, 0.03), woodMat);
      sp.rotation.z = (i / 6) * Math.PI;
      wheel.add(sp);
    }
    wheel.position.set(x, 0.45, z);
    g.add(wheel);
  }
  const glowMat = new THREE.MeshBasicMaterial({ map: archTex, color: glow(0xffd8a0, 1.5), transparent: true, depthWrite: false });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.05), glowMat);
  door.position.set(0, 1.18, 0.81);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.4), woodMat);
  steps.position.set(0, 0.35, 1.05);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.6, 10), darkWood);
  chimney.position.set(-0.9, 2.75, 0);
  g.add(door, steps, chimney);
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.32, 40), new THREE.MeshBasicMaterial({ map: emblemTexture(s.emblem), color: glow(0xffffff, 1.05), transparent: true }));
  emblem.position.set(0.95, 1.4, 0.81);
  g.add(emblem);
  flagOn(g, 2.7, s.flag, 0.8);
  g.children.at(-1).position.x = 1.0; g.children.at(-2).position.x = 1.0;
  return { g, glowMat, emblem, top: new THREE.Vector3(0, 3.4, 0), doorY: 1.2 };
}

const fire = { flames: [], embers: null, light: null };
function buildFire() {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4650, roughness: 0.95 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.06), stoneMat);
    st.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
    st.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(st);
  }
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.2, 8), darkWood);
    log.rotation.set(Math.PI / 2 - 0.5, (i / 4) * Math.PI * 2, 0, 'YXZ');
    log.position.y = 0.3;
    g.add(log);
  }
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: glow(i < 2 ? 0xffe0a0 : 0xff9a40, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    f.position.set((Math.random() - 0.5) * 0.35, 0.55, (Math.random() - 0.5) * 0.35);
    g.add(f);
    fire.flames.push({ f, phase: Math.random() * 10, s: 0.7 + Math.random() * 0.6 });
  }
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xff7a30, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.position.y = 0.7; aura.scale.setScalar(4);
  g.add(aura);
  fire.aura = aura;
  fire.light = new THREE.PointLight(0xff8a3a, 9, 16, 1.6);
  fire.light.position.y = 1.0;
  g.add(fire.light);
  // embers rising
  const N = 90, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { seed[i] = Math.random(); pos.set([(Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5], i * 3); }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  fire.embers = new THREE.Points(eg, new THREE.PointsMaterial({ map: sparkTex, color: glow(0xffa050, 2), size: 0.08, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fire.emberSeed = seed;
  g.add(fire.embers);
  // log benches, set back from the paths
  for (const a of [0.7, 2.45, 3.85, 5.55]) {
    const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.6, 10), woodMat);
    bench.rotation.z = Math.PI / 2;
    bench.rotation.y = -a + Math.PI / 2;
    bench.position.set(Math.cos(a) * 2.6, 0.2, Math.sin(a) * 2.6);
    g.add(bench);
  }
  return { g, glowMat: null, emblem: null, top: new THREE.Vector3(0, 2.3, 0), doorY: 0.8 };
}

/* ---------- place the spots ---------- */
for (const s of SPOTS) {
  const built = s.kind === 'tent' ? buildTent(s) : s.kind === 'wagon' ? buildWagon(s) : buildFire();
  Object.assign(s, built);
  s.g.position.set(s.x, 0, s.z);
  if (s.kind !== 'fire') s.g.lookAt(0, 0, 0);
  village.add(s.g);
  if (s.kind !== 'fire') {
    s.light = new THREE.PointLight(s.light, 2.2, 7, 2);
    const front = new THREE.Vector3(0, 1.3, (s.r || 1.5) + 0.8);
    s.light.position.copy(front);
    s.g.add(s.light);
  } else {
    s.light = fire.light;
  }
  s.baseLight = s.light.intensity;
  const hit = new THREE.Mesh(new THREE.CylinderGeometry((s.r || 1.5) * 1.2, (s.r || 1.5) * 1.2, s.top.y + 0.4, 16), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = (s.top.y + 0.4) / 2;
  s.g.add(hit);
  s.hits = [hit];
  s.onGlow = (g, t) => {
    s.light.intensity = s.baseLight * (1 + g * 0.9) * (s.kind === 'fire' ? 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07 : 1);
    if (s.glowMat) s.glowMat.color.copy(glow(0xffd8a0, 1.4 + g * 1.2 + Math.sin(t * 2 + s.x) * 0.08));
    if (s.emblem) s.emblem.scale.setScalar(1 + g * 0.12);
  };
  // camera stop in front of the entrance
  const dir = new THREE.Vector3(-s.x, 0, -s.z);
  if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
  dir.normalize();
  const reach = s.kind === 'fire' ? 5.2 : (s.r || 1.5) + 3.6;
  s.view = {
    pos: new THREE.Vector3(s.x, 0, s.z).addScaledVector(dir, reach).setY(s.kind === 'fire' ? 2.6 : 2.1),
    look: new THREE.Vector3(s.x, s.doorY + (s.kind === 'fire' ? 0.2 : 0.4), s.z),
  };
}

/* ---------- strings of bulbs between tent tops and poles ---------- */
{
  const poles = [[-4.8, 3.6], [4.4, 4.6]].map(([x, z]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4, 8), darkWood);
    p.position.set(x, 2, z);
    village.add(p);
    return new THREE.Vector3(x, 3.9, z);
  });
  const top = (id) => { const s = SPOTS.find((q) => q.id === id); return s.g.localToWorld(s.top.clone()).add(new THREE.Vector3(0, -0.45, 0)); };
  village.updateMatrixWorld(true);
  const pairs = [[top('oracle'), top('library')], [top('oracle'), top('memories')], [top('library'), poles[0]], [top('memories'), poles[1]],
    [poles[0], poles[1]], [top('settings'), poles[1]]];
  const bulbs = [];
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1410 });
  for (const [a, b] of pairs) {
    const len = a.distanceTo(b), sag = Math.min(1.4, len * 0.12), n = Math.max(8, Math.round(len / 0.55));
    const pts = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0))); }
    village.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    for (let i = 1; i < n; i++) { const t = i / n; bulbs.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t) - 0.06, 0))); }
  }
  const palette = [0xffd27a, 0xffa860, 0xff7aa8, 0x9ad7ff, 0xc79bff, 0xffe9b0];
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), bulbs.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  bulbs.forEach((p, i) => { m.makeTranslation(p.x, p.y, p.z); inst.setMatrixAt(i, m); inst.setColorAt(i, c.set(palette[i % palette.length]).multiplyScalar(2.6)); });
  village.add(inst);
}

/* ---------- lantern posts, trees, Ferris wheel, fireflies ---------- */
for (const [x, z] of [[-1.4, 6.2], [1.4, 6.2], [-3.4, -2.2], [3.4, -2.2], [-5.2, -1.4], [6.4, -2.2], [1.4, -5.8], [-1.4, -5.8], [3.2, 3.2]]) lanternPost(x, z);
{
  const r = seeded(11);
  const needles = [new THREE.MeshStandardMaterial({ color: 0x0c1a12, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x0f2016, roughness: 1 })];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 17 + r() * 16;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (z > 8 && Math.abs(x) < 12) continue; // keep the view from the entrance open
    const h = 4 + r() * 5, tree = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(h * (0.32 - k * 0.07), h * 0.5, 9), needles[k % 2]);
      cone.position.y = h * (0.3 + k * 0.22);
      tree.add(cone);
    }
    tree.position.set(x, 0, z);
    village.add(tree);
  }
}
const wheel = new THREE.Group();
{
  const R = 6.5, rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.08, 6, 64), darkWood);
  wheel.add(rim, new THREE.Mesh(new THREE.TorusGeometry(R * 0.55, 0.05, 6, 48), darkWood));
  for (let i = 0; i < 16; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, R * 2, 0.06), darkWood);
    sp.rotation.z = (i / 16) * Math.PI;
    wheel.add(sp);
  }
  const N = 64, inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 5), new THREE.MeshBasicMaterial(), N);
  const m = new THREE.Matrix4(), c = new THREE.Color(), pal = [0xffd27a, 0xff7aa8, 0x9ad7ff];
  for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; m.makeTranslation(Math.cos(a) * R, Math.sin(a) * R, 0); inst.setMatrixAt(i, m); inst.setColorAt(i, c.set(pal[i % 3]).multiplyScalar(2.4)); }
  wheel.add(inst);
  const frame = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, R * 1.25, 0.12), darkWood);
    leg.position.set(s * R * 0.32, R * 0.55, 0); leg.rotation.z = s * 0.3;
    frame.add(leg);
  }
  frame.position.set(-19, 0, -27);
  wheel.position.set(-19, R + 1.2, -27);
  wheel.rotation.y = 0.5; frame.rotation.y = 0.5;
  village.add(wheel, frame);
}
const fireflies = (() => {
  const N = 160, pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) seed.set([Math.random() * 100, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 26 - 2], i * 3);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTex, color: glow(0xd8ff8a, 1.8), size: 0.16, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  village.add(pts);
  return { pts, pos, seed, N };
})();

if (HIGH) village.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (mats.some((m) => m.transparent || m.isMeshBasicMaterial || m.isShaderMaterial)) return;
  o.castShadow = true; o.receiveShadow = true;
});

/* =====================================================================
   The hub: labels, picking and camera moves (shared with the big top)
   ===================================================================== */
export const camp = createHub({ name: 'camp', spots: SPOTS, overview, order: ['library', 'oracle', 'memories', 'settings', 'intro'] });
// The first approach: from high above the treeline down to the camp.
export function arrive() {
  const o = overview();
  camp.camPos.set(o.pos.x, o.pos.y + 10, o.pos.z + 20);
  camp.camLook.copy(o.look);
  return camp.flyTo('overview', 4.2);
}

/* =====================================================================
   Per-frame
   ===================================================================== */
export function updateVillage(t, dt) {
  camp.update(t, dt);
  for (const f of fire.flames) {
    const k = 0.85 + Math.sin(t * 9 + f.phase) * 0.12 + Math.sin(t * 23 + f.phase) * 0.06;
    f.f.scale.set(0.55 * f.s * k, 1.2 * f.s * k, 1);
    f.f.position.y = 0.45 + f.s * 0.45 * k;
  }
  fire.aura.material.opacity = 0.4 + Math.sin(t * 11) * 0.05;
  const ep = fire.embers.geometry.attributes.position.array;
  for (let i = 0; i < fire.emberSeed.length; i++) {
    ep[i * 3 + 1] += dt * (0.6 + fire.emberSeed[i] * 0.9);
    ep[i * 3] += Math.sin(t * 2 + i) * dt * 0.15;
    if (ep[i * 3 + 1] > 3.2) { ep[i * 3 + 1] = 0.4; ep[i * 3] = (Math.random() - 0.5) * 0.4; ep[i * 3 + 2] = (Math.random() - 0.5) * 0.4; }
  }
  fire.embers.geometry.attributes.position.needsUpdate = true;
  for (const fl of flags) {
    const arr = fl.geo.attributes.position.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = fl.base[i];
      arr[i + 2] = Math.sin(t * 3 + fl.phase + x * 5) * 0.08 * x;
    }
    fl.geo.attributes.position.needsUpdate = true;
  }
  for (const l of lanterns) l.halo.material.opacity = 0.3 + Math.sin(t * 5 + l.phase) * 0.04;
  wheel.rotation.z = t * 0.05;
  const fp = fireflies.pos, fs = fireflies.seed;
  for (let i = 0; i < fireflies.N; i++) {
    const s = fs[i * 3];
    fp[i * 3] = fs[i * 3 + 1] + Math.sin(t * 0.3 + s) * 1.2;
    fp[i * 3 + 1] = 0.6 + Math.abs(Math.sin(t * 0.5 + s * 1.3)) * 2;
    fp[i * 3 + 2] = fs[i * 3 + 2] + Math.cos(t * 0.27 + s) * 1.2;
  }
  fireflies.pts.geometry.attributes.position.needsUpdate = true;
  fireflies.pts.material.opacity = 0.6 + Math.sin(t * 1.7) * 0.25;
}
