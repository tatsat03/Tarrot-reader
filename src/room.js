import * as THREE from 'three';
import { scene, envTex, HIGH } from './engine.js';
import { glow } from './util.js';
import { radialTexture, sparkleTexture, flameTexture, runeRingTexture, makeTableTexture, makeRugTexture } from './textures.js';

export const TABLE_Y = 0.9, TABLE_R = 1.42;
export const BALL_POS = new THREE.Vector3(0, TABLE_Y + 0.27, -0.85);
export const goldMat = new THREE.MeshStandardMaterial({ color: 0xd2a75a, metalness: 0.85, roughness: 0.3, envMap: envTex, envMapIntensity: 1.1 });
export const softTex = radialTexture();
export const sparkTex = sparkleTexture();
const flameTex = flameTexture();
const woodMat = new THREE.MeshStandardMaterial({ color: 0x1c0f14, roughness: 0.65, metalness: 0.1 });

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0x4a3480, 0x120608, 0.55));
scene.add(new THREE.AmbientLight(0x2a1a40, 0.35));
const key = new THREE.DirectionalLight(0xffd9a8, 0.35);
key.position.set(1.5, 4, 5);
scene.add(key);
const rim = new THREE.PointLight(0x7a4cff, 6, 6, 2);
rim.position.set(0, 2.7, -3.0);
scene.add(rim);
const topSpot = new THREE.SpotLight(0xb48cff, 18, 9, 0.5, 1, 2);
topSpot.position.set(0, 5.2, -0.6);
topSpot.target.position.set(0, 1.4, -1.6);
scene.add(topSpot, topSpot.target);
if (HIGH) {
  topSpot.castShadow = true;
  topSpot.shadow.mapSize.set(2048, 2048);
  topSpot.shadow.bias = -0.0005;
  topSpot.shadow.radius = 4;
}
const faceFill = new THREE.PointLight(0xd8a8ff, 1.6, 2.6, 2); // keeps Seraphine readable from the front
faceFill.position.set(0, 2.15, -0.7);
scene.add(faceFill);
for (const s of [-1, 1]) { // soft wash across the curtain
  const wash = new THREE.SpotLight(0xff6a9a, 14, 8, 0.7, 1, 2);
  wash.position.set(s * 3.2, 0.3, -2.4);
  wash.target.position.set(s * 1.2, 3.2, -3.9);
  scene.add(wash, wash.target);
}

/* ---------- floor, walls, curtain ---------- */
{
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x0f0810, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  const rug = new THREE.Mesh(new THREE.CircleGeometry(3.2, 96), new THREE.MeshStandardMaterial({ map: makeRugTexture(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x0c0714, roughness: 1, side: THREE.BackSide }));
  wall.position.y = 5;
  scene.add(floor, rug, wall);

  const geo = new THREE.PlaneGeometry(16, 7.5, 320, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 5) * 0.16 + Math.sin(x * 13.7) * 0.04); }
  geo.computeVertexNormals();
  const curtain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x6a1a44, roughness: 0.85 }));
  curtain.position.set(0, 3.6, -3.9);
  scene.add(curtain);
}

/* ---------- table ---------- */
{
  const clothGeo = new THREE.CylinderGeometry(TABLE_R + 0.02, 1.62, TABLE_Y, 128, 6, true);
  const p = clothGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x), drop = 0.5 - y / TABLE_Y;
    const k = 1 + Math.sin(a * 26) * 0.025 * drop;
    p.setX(i, x * k); p.setZ(i, z * k);
  }
  clothGeo.computeVertexNormals();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ color: 0x3a1250, roughness: 0.95 }));
  cloth.position.y = TABLE_Y / 2;
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x2a0d3a, roughness: 0.9 });
  const topMat = new THREE.MeshStandardMaterial({ map: makeTableTexture(), roughness: 0.85 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(TABLE_R, TABLE_R, 0.04, 128), [sideMat, topMat, sideMat]);
  top.position.y = TABLE_Y - 0.02;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(TABLE_R, 0.018, 12, 160),
    new THREE.MeshStandardMaterial({ color: 0x9a7a40, metalness: 0.8, roughness: 0.55, envMap: envTex, envMapIntensity: 0.35 }));
  trim.rotation.x = Math.PI / 2; trim.position.y = TABLE_Y;
  // a gold-tasselled hem around the cloth
  const hem = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.012, 8, 160), goldMat);
  hem.rotation.x = Math.PI / 2; hem.position.y = 0.06;
  scene.add(cloth, top, trim, hem);
}

/* ---------- crystal ball ---------- */
export const ball = { target: new THREE.Color(0x8a6cff), speed: 1 };
{
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.07, 32), goldMat);
  stand.position.set(BALL_POS.x, TABLE_Y + 0.035, BALL_POS.z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 10, 48), goldMat);
  ring.rotation.x = Math.PI / 2; ring.position.set(BALL_POS.x, TABLE_Y + 0.085, BALL_POS.z);
  for (let i = 0; i < 3; i++) { // claw feet
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.09, 8), goldMat);
    const a = (i / 3) * Math.PI * 2;
    claw.position.set(BALL_POS.x + Math.cos(a) * 0.12, TABLE_Y + 0.11, BALL_POS.z + Math.sin(a) * 0.12);
    claw.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    scene.add(claw);
  }
  scene.add(stand, ring);

  ball.uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x8a6cff) }, uIntensity: { value: 1 } };
  const swirl = new THREE.Mesh(new THREE.SphereGeometry(0.19, 48, 32), new THREE.ShaderMaterial({
    uniforms: ball.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vP; varying vec3 vN;
      void main(){ vP = position; vN = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uIntensity;
      varying vec3 vP; varying vec3 vN;
      void main(){
        vec3 p = vP * 12.0;
        float n = sin(p.x + uTime*1.3) * sin(p.y*1.2 - uTime*1.1) * sin(p.z*1.1 + uTime*0.7);
        float sw = 0.5 + 0.5*sin(atan(vP.z, vP.x)*3.0 + vP.y*24.0 - uTime*1.8 + n*1.5);
        float fres = pow(1.0 - abs(vN.z), 2.0);
        float a = (0.25 + 0.55*sw*(0.7+0.3*n)) * uIntensity;
        vec3 col = uColor * (0.6 + 1.6*sw) + vec3(fres*0.4);
        gl_FragColor = vec4(col * a, a);
      }`,
  }));
  swirl.position.copy(BALL_POS);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.205, 48, 32), new THREE.MeshPhysicalMaterial({
    color: 0xd8ccff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, envMap: envTex, envMapIntensity: 1.6,
  }));
  shell.position.copy(BALL_POS);
  ball.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0x8a6cff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  ball.halo.scale.setScalar(1.1);
  ball.halo.position.copy(BALL_POS);
  ball.light = new THREE.PointLight(0x8a6cff, 2.2, 4, 2);
  ball.light.position.copy(BALL_POS);

  // two counter-rotating rings of celestial glyphs hovering around the ball
  const runeTex = runeRingTexture();
  ball.runes = [0.55, 0.42].map((size, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({
      map: runeTex, color: glow(0xf0d391, 1.3), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.position.set(BALL_POS.x, TABLE_Y + 0.12 + i * 0.32, BALL_POS.z);
    m.rotation.x = -Math.PI / 2;
    scene.add(m);
    return m;
  });
  scene.add(swirl, shell, ball.halo, ball.light);
}

/* ---------- candles ---------- */
const candles = [];
function addCandle(x, z, h, baseY, withLight) {
  const g = new THREE.Group();
  g.position.set(x, baseY, z);
  const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, h, 20), new THREE.MeshStandardMaterial({ color: 0xeadcc0, roughness: 0.6, emissive: 0x3a2008, emissiveIntensity: 0.6 }));
  wax.position.y = h / 2;
  const drip = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 6, 20), wax.material);
  drip.rotation.x = Math.PI / 2; drip.position.y = h - 0.01;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.015, 24), goldMat);
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: glow(0xffc070, 2.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.scale.set(0.05, 0.1, 1);
  flame.position.y = h + 0.045;
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color: 0xff9a40, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.scale.setScalar(0.45);
  aura.position.y = h + 0.05;
  g.add(wax, drip, dish, flame, aura);
  let light = null;
  if (withLight) {
    light = new THREE.PointLight(0xff9a48, 1.4, 4.5, 2);
    light.position.y = h + 0.08;
    if (HIGH && baseY === TABLE_Y) { // table candles throw flickering shadows of cards, hands and the ball
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.002;
      light.shadow.camera.near = 0.05;
    }
    g.add(light);
  }
  scene.add(g);
  candles.push({ flame, aura, light, base: light ? light.intensity : 0, phase: Math.random() * 10 });
}
addCandle(-1.05, -0.35, 0.22, TABLE_Y, true);
addCandle(-0.92, -0.55, 0.14, TABLE_Y, false);
addCandle(1.08, -0.5, 0.18, TABLE_Y, true);
addCandle(0.5, -1.15, 0.1, TABLE_Y, false);
for (const s of [-1, 1]) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.06, 1.7, 16), goldMat);
  pole.position.set(s * 2.5, 0.85, -2.2);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.05, 24), goldMat);
  foot.position.set(s * 2.5, 0.025, -2.2);
  scene.add(pole, foot);
  addCandle(s * 2.5, -2.2, 0.3, 1.7, true);
}

/* ---------- hanging stars and moons ---------- */
const ornaments = [];
{
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.035 : 0.09, a = Math.PI / 2 + (i / 10) * Math.PI * 2;
    i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.015, bevelEnabled: false });
  const moonGeo = new THREE.TorusGeometry(0.08, 0.018, 8, 32, Math.PI * 1.25);
  const ornMat = new THREE.MeshStandardMaterial({ color: 0xd9b46a, metalness: 0.7, roughness: 0.35, envMap: envTex, emissive: 0x5a3a10, emissiveIntensity: 0.5 });
  const strMat = new THREE.LineBasicMaterial({ color: 0x6a5030, transparent: true, opacity: 0.5 });
  const spots = [[-1.9, 3.1, -1.6], [-1.3, 3.5, -2.8], [1.4, 3.3, -2.6], [2.0, 2.9, -1.3], [-2.6, 2.7, -0.4], [2.7, 3.0, -0.2], [0.8, 3.7, -3.2], [-0.7, 3.8, -3.1]];
  spots.forEach(([x, y, z], i) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const m = new THREE.Mesh(i % 2 ? moonGeo : starGeo, ornMat);
    const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.08, 0), new THREE.Vector3(0, 6 - y, 0)]), strMat);
    g.add(m, str);
    scene.add(g);
    ornaments.push({ g, phase: i * 1.7 });
  });
}

/* ---------- light shafts from above ---------- */
const shafts = [];
{
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xb89cff) }, uStrength: { value: HIGH ? 0.085 : 0.06 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(vN, vV)), 1.6);                   // soft, solid-looking core
        float fall = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        float flick = 0.75 + 0.25 * sin(vUv.x * 40.0 + uTime * 0.6) * sin(vUv.x * 17.0 - uTime * 0.4);
        gl_FragColor = vec4(uColor * edge * fall * flick * uStrength, 1.0);
      }`,
  });
  for (const [x, z, r, tilt] of [[0, -1.6, 0.9, 0], [-0.9, -1.1, 0.45, 0.12], [0.95, -1.3, 0.5, -0.1]]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, r, 5.2, 48, 1, true), mat);
    m.position.set(x, 3.3, z);
    m.rotation.z = tilt;
    scene.add(m);
    shafts.push(m);
  }
  shafts.mat = mat;
}

/* ---------- dust motes ---------- */
const dust = (() => {
  const N = HIGH ? 1400 : 500, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 10;
    pos[i * 3 + 1] = Math.random() * 4.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 7 - 0.5;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTex, color: 0xffdca0, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(pts);
  return { pts, pos, seed, N };
})();

/* ---------- constellation: one star per answered card ---------- */
export const constellation = (() => {
  const group = new THREE.Group();
  scene.add(group);
  let stars = [], line = null, lineTarget = 0, size = 1;
  function setup(n) {
    group.clear();
    stars = [];
    size = n > 5 ? 0.6 : 1;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const a = (t - 0.5) * Math.min(2.4, 0.5 + n * 0.32);
      const p = new THREE.Vector3(Math.sin(a) * 1.35, 2.55 + Math.cos(a) * 0.75 + (i % 2) * 0.06, -3.0 - Math.cos(a) * 0.1);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.position.copy(p);
      group.add(s);
      stars.push({ s, target: 0, amt: 0 });
      pts.push(p);
    }
    line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.length > 1 ? pts : [pts[0], pts[0]]),
      new THREE.LineBasicMaterial({ color: glow(0xf0d391, 1.6), transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
    group.add(line);
    lineTarget = 0;
  }
  return {
    setup,
    light(i, color) { const s = stars[i]; if (!s) return; s.s.material.color.copy(glow(color, 2)); s.target = 1; },
    connect() { lineTarget = 1; },
    clear() { stars.forEach((s) => (s.target = 0)); lineTarget = 0; },
    update(t, dt) {
      stars.forEach((s, i) => {
        s.amt += (s.target - s.amt) * Math.min(1, dt * 1.5);
        s.s.material.opacity = s.amt * (0.8 + Math.sin(t * 3 + i * 2) * 0.2);
        s.s.scale.setScalar((0.15 + s.amt * 0.22 + Math.sin(t * 2.3 + i) * 0.02) * size);
        s.s.material.rotation = t * 0.2 + i;
      });
      if (line) line.material.opacity += (lineTarget * 0.7 - line.material.opacity) * Math.min(1, dt * 1.2);
    },
  };
})();
constellation.setup(3);

/* ---------- per-frame ---------- */
export function updateRoom(t, dt, oracle) {
  const talk = oracle.talk, raise = oracle.raiseAmt, think = oracle.thinkAmt;
  ball.uniforms.uTime.value += dt * (1 + think * 2.5);
  ball.uniforms.uColor.value.lerp(ball.target, Math.min(1, dt * 1.5));
  ball.uniforms.uIntensity.value = 0.85 + Math.sin(t * 1.7) * 0.1 + talk * 0.25 + raise * 0.5 + think * 0.4;
  ball.light.color.copy(ball.uniforms.uColor.value);
  ball.light.intensity = 2 + talk * 0.8 + raise * 2.5 + think * 1.5;
  ball.halo.material.color.copy(ball.uniforms.uColor.value);
  ball.halo.material.opacity = 0.4 + talk * 0.12 + raise * 0.3 + think * 0.2;
  ball.runes.forEach((r, i) => {
    r.rotation.z = (i ? -1 : 1) * t * (0.15 + think * 0.6);
    r.material.opacity = 0.22 + raise * 0.4 + think * 0.35 + Math.sin(t * 1.3 + i) * 0.05;
    r.position.y = TABLE_Y + 0.12 + i * 0.32 + Math.sin(t * 0.8 + i) * 0.01;
  });

  for (const c of candles) {
    const n = Math.sin(t * 9 + c.phase) * 0.5 + Math.sin(t * 23 + c.phase * 2) * 0.3 + Math.sin(t * 3.1 + c.phase) * 0.2;
    c.flame.scale.set(0.05 + n * 0.004, 0.1 + n * 0.012, 1);
    c.aura.material.opacity = 0.22 + n * 0.04;
    if (c.light) c.light.intensity = c.base * (0.88 + n * 0.12);
  }
  for (const o of ornaments) {
    o.g.rotation.y = t * 0.3 + o.phase;
    o.g.rotation.z = Math.sin(t * 0.6 + o.phase) * 0.06;
  }
  shafts.mat.uniforms.uTime.value = t;
  const p = dust.pos;
  for (let i = 0; i < dust.N; i++) {
    const s = dust.seed[i];
    p[i * 3 + 1] += dt * (0.03 + (s % 1) * 0.04);
    p[i * 3] += Math.sin(t * 0.3 + s) * dt * 0.03;
    if (p[i * 3 + 1] > 4.6) p[i * 3 + 1] = 0;
  }
  dust.pts.geometry.attributes.position.needsUpdate = true;
  constellation.update(t, dt);
}
