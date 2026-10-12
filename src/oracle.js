import * as THREE from 'three';
import { scene, Y_AXIS } from './engine.js';
import { glow } from './util.js';
import { goldMat } from './room.js';

// Seraphine, Keeper of the Veil.
export const O = (() => {
  const g = new THREE.Group();
  g.position.set(0, 0, -1.85);
  scene.add(g);

  const robeMat = new THREE.MeshStandardMaterial({ color: 0x2c1554, roughness: 0.8, side: THREE.DoubleSide });
  const pts = [[0, 0], [0.6, 0], [0.62, 0.25], [0.56, 0.6], [0.5, 0.9], [0.47, 1.15], [0.43, 1.38], [0.36, 1.56], [0.22, 1.67], [0.1, 1.71], [0, 1.72]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const robeGeo = new THREE.LatheGeometry(pts, 96);
  const rp = robeGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i), y = rp.getY(i), z = rp.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.035 * Math.sin(a * 11 + y * 3) * (1.2 - y / 1.72);
    rp.setX(i, x * k); rp.setZ(i, z * k);
  }
  robeGeo.computeVertexNormals();
  g.add(new THREE.Mesh(robeGeo, robeMat));

  // embroidered panel down the front of the robe
  const panel = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.5, 24, 1, true, Math.PI * 0.42, Math.PI * 0.16),
    new THREE.MeshStandardMaterial({ color: 0x4a1f6a, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }));
  panel.position.y = 1.02; panel.scale.setScalar(1.025);
  g.add(panel);

  const mantleGeo = new THREE.CylinderGeometry(0.2, 0.56, 0.45, 72, 4, true);
  const mp = mantleGeo.attributes.position;
  for (let i = 0; i < mp.count; i++) {
    const x = mp.getX(i), z = mp.getZ(i), a = Math.atan2(z, x);
    const k = 1 + 0.04 * Math.sin(a * 9);
    mp.setX(i, x * k); mp.setZ(i, z * k);
  }
  mantleGeo.computeVertexNormals();
  const mantle = new THREE.Mesh(mantleGeo, new THREE.MeshStandardMaterial({ color: 0x5c1d50, roughness: 0.9, side: THREE.DoubleSide }));
  mantle.position.y = 1.48;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.012, 8, 96), goldMat);
  trim.rotation.x = Math.PI / 2; trim.position.y = 1.257;
  const trim2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.008, 8, 96), goldMat);
  trim2.rotation.x = Math.PI / 2; trim2.position.y = 0.92;
  g.add(mantle, trim, trim2);
  // tiny gold beads along the mantle hem
  const beadGeo = new THREE.SphereGeometry(0.009, 8, 6);
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const b = new THREE.Mesh(beadGeo, goldMat);
    b.position.set(Math.cos(a) * 0.565, 1.235, Math.sin(a) * 0.565);
    g.add(b);
  }

  const amulet = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 10, 40), goldMat);
  amulet.position.set(0, 1.36, 0.5);
  const gemMat = new THREE.MeshBasicMaterial({ color: glow(0x8a6cff, 2.2) });
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14), gemMat);
  gem.position.copy(amulet.position);
  g.add(amulet, gem);

  // head & hood
  const head = new THREE.Group();
  head.position.set(0, 1.86, 0.04);
  g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 24), new THREE.MeshStandardMaterial({ color: 0x07040c, roughness: 1 })));
  const hoodMat = new THREE.MeshStandardMaterial({ color: 0x2a1350, roughness: 0.8, side: THREE.DoubleSide });
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.265, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.76), hoodMat);
  hood.rotation.x = -0.85;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 24), hoodMat);
  tip.position.set(0, 0.2, -0.13); tip.rotation.x = -0.65;
  head.add(hood, tip);

  // circlet with a glowing brow-jewel
  const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.198, 0.007, 8, 64, Math.PI * 1.1), goldMat);
  circlet.rotation.set(Math.PI / 2 + 0.15, 0, -0.05 * Math.PI); // arc wraps the front of the brow, dipping slightly
  circlet.position.set(0, 0.1, 0);
  const browMat = new THREE.MeshBasicMaterial({ color: glow(0x8a6cff, 2.4) });
  const brow = new THREE.Mesh(new THREE.OctahedronGeometry(0.02), browMat);
  brow.position.set(0, 0.075, 0.205); brow.scale.set(0.8, 1.3, 0.6);
  head.add(circlet, brow);

  const eyeColor = new THREE.Color(0xffcf7a);
  const thinkColor = new THREE.Color(0xb48cff);
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor.clone().multiplyScalar(3) });
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), eyeMat);
    e.position.set(s * 0.068, 0.015, 0.174);
    e.scale.set(1.3, 1, 0.6);
    head.add(e);
    return e;
  });
  const mouthMat = new THREE.MeshBasicMaterial({ color: glow(0xb48cff, 1.4), transparent: true, opacity: 0.8 });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 8), mouthMat);
  mouth.position.set(0, -0.075, 0.17);
  mouth.scale.set(1.6, 0.25, 0.5);
  head.add(mouth);

  const coinGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.004, 16).rotateX(Math.PI / 2);
  for (let k = 0; k < 11; k++) {
    const a = (k / 10 - 0.5) * 1.8, drop = k % 2 ? 0.02 : 0;
    const coin = new THREE.Mesh(coinGeo, goldMat);
    coin.position.set(Math.sin(a) * 0.205, 0.045 - drop - Math.abs(a) * 0.03, Math.cos(a) * 0.205);
    coin.rotation.y = a;
    head.add(coin);
  }

  // hands and sleeves
  const skin = new THREE.MeshStandardMaterial({ color: 0xb59ac4, roughness: 0.55, emissive: 0x2a1840, emissiveIntensity: 0.6 });
  const fingerGeo = new THREE.CapsuleGeometry(0.011, 0.05, 4, 8);
  function makeHand(side) {
    const h = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), skin);
    palm.scale.set(0.05, 0.022, 0.06);
    h.add(palm);
    for (let f = 0; f < 4; f++) {
      const fg = new THREE.Mesh(fingerGeo, skin);
      fg.rotation.x = Math.PI / 2 + 0.5 + f * 0.05;
      fg.position.set((f - 1.5) * 0.022, -0.02, 0.07 - Math.abs(f - 1.5) * 0.008);
      h.add(fg);
    }
    const thumb = new THREE.Mesh(fingerGeo, skin);
    thumb.position.set(-side * 0.048, -0.008, 0.025);
    thumb.rotation.set(Math.PI / 2, 0, side * 0.9);
    const ringBand = new THREE.Mesh(new THREE.TorusGeometry(0.013, 0.004, 6, 16), goldMat);
    ringBand.position.set(-0.011 * side, -0.026, 0.06);
    ringBand.rotation.x = 0.5;
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24), goldMat);
    cuff.position.set(0, 0.005, -0.055);
    h.add(thumb, ringBand, cuff);
    g.add(h);
    return h;
  }
  const sleeveGeo = new THREE.CylinderGeometry(0.085, 0.07, 1, 20, 1, true).translate(0, 0.5, 0);
  const hands = [-1, 1].map((side) => {
    const hand = makeHand(side);
    const sleeve = new THREE.Mesh(sleeveGeo, robeMat);
    g.add(sleeve);
    return { side, hand, sleeve, shoulder: new THREE.Vector3(side * 0.37, 1.5, 0.08) };
  });

  // throne
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x1c0f14, roughness: 0.65, metalness: 0.1 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.5, 0.12), woodMat);
  back.position.set(0, 1.25, -0.55);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.12, 48, 1, false, Math.PI / 2, Math.PI), woodMat);
  arch.rotation.x = Math.PI / 2; arch.position.set(0, 2.5, -0.55);
  const archTrim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 8, 64, Math.PI), goldMat);
  archTrim.position.set(0, 2.5, -0.48);
  const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 12, 64, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: glow(0xf0d391, 2.0) }));
  crescent.position.set(0, 2.62, -0.47);
  crescent.rotation.z = -Math.PI * 0.15 - Math.PI / 2;
  for (const s of [-1, 1]) { // finials
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), goldMat);
    f.position.set(s * 0.65, 2.55, -0.5);
    g.add(f);
  }
  g.add(back, arch, archTrim, crescent);

  return {
    g, head, eyes, eyeMat, eyeColor, thinkColor, mouth, mouthMat, gemMat, browMat, hands,
    talk: 0, raise: 0, raiseAmt: 0, thinking: false, thinkAmt: 0,
  };
})();

export function setOracleColor(hex) {
  O.gemMat.color.copy(glow(hex, 2.2));
  O.browMat.color.copy(glow(hex, 2.4));
}

const _d = new THREE.Object3D(), _v = new THREE.Vector3(), headWorld = new THREE.Vector3(), _c = new THREE.Color();
const WRIST = new THREE.Vector3(0, 0.012, -0.05);

export function updateOracle(t, dt, { talking, lookTarget, mouth = null }) {
  O.talk += ((talking ? 1 : 0) - O.talk) * Math.min(1, dt * 6);
  O.raiseAmt += (O.raise - O.raiseAmt) * Math.min(1, dt * 2.5);
  O.thinkAmt += ((O.thinking ? 1 : 0) - O.thinkAmt) * Math.min(1, dt * 3);

  O.g.position.y = Math.sin(t * 0.9) * 0.012;
  O.g.rotation.z = Math.sin(t * 0.5) * 0.012;

  O.head.getWorldPosition(headWorld);
  _d.position.copy(headWorld);
  _d.lookAt(lookTarget);
  _d.rotateX(Math.sin(t * 4.3) * 0.045 * O.talk + Math.sin(t * 0.7) * 0.03 - O.thinkAmt * 0.12);
  _d.rotateZ(Math.sin(t * 0.37) * 0.06 + O.thinkAmt * Math.sin(t * 0.9) * 0.08);
  O.head.quaternion.slerp(_d.quaternion, Math.min(1, dt * 3));

  const blink = (t % 4.7) < 0.13 ? 0.12 : 1;
  O.eyes.forEach((e) => (e.scale.y = blink * (1 - O.thinkAmt * 0.45)));
  _c.copy(O.eyeColor).lerp(O.thinkColor, O.thinkAmt);
  O.eyeMat.color.copy(_c).multiplyScalar(2.6 + O.talk * (1.2 + Math.sin(t * 11) * 0.6) + O.raiseAmt * 2 + O.thinkAmt * (1 + Math.sin(t * 4)));
  // mouth: real voice level when we have one, otherwise a soft murmur while text types out
  O.mouth.scale.y = 0.22 + (mouth != null && mouth > 0.01 ? mouth * 0.95 : O.talk * (0.55 + 0.45 * Math.sin(t * 17) * Math.sin(t * 6.1)));
  O.mouthMat.opacity = 0.35 + O.talk * 0.6;

  for (const H of O.hands) {
    const s = H.side, circ = 0.025 + 0.035 * O.talk + 0.03 * O.thinkAmt, r = O.raiseAmt;
    const speed = 1 + O.thinkAmt * 1.5;
    H.hand.position.set(
      s * 0.24 + Math.sin(t * 0.9 * speed + s) * circ + s * r * 0.2,
      1.33 + Math.cos(t * 1.2 * speed + s * 2) * circ * 0.7 + r * 0.36 - O.thinkAmt * 0.03,
      0.88 + Math.sin(t * 0.7 + s) * 0.02 - r * 0.18
    );
    H.hand.rotation.set(0.15 - r * 1.0, s * r * 0.3, s * (-0.25 - r * 0.5));
    _v.copy(H.hand.position).add(WRIST).sub(H.shoulder);
    const len = _v.length();
    H.sleeve.position.copy(H.shoulder);
    H.sleeve.quaternion.setFromUnitVectors(Y_AXIS, _v.normalize());
    H.sleeve.scale.set(1, len, 1);
  }
}
