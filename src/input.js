import * as THREE from 'three';
import { renderer, camera } from './engine.js';
import { state } from './state.js';
import { fanCards } from './cards.js';
import { waitable, advance } from './ui.js';
import { sfx } from './audio.js';

export const parallax = new THREE.Vector2();
const pointer = new THREE.Vector2(-9, -9);
const raycaster = new THREE.Raycaster();
const canvasEl = renderer.domElement;
let pickResolve = null;
let drag = null;

function hitFanCard() {
  if (state.mode !== 'picking') return null;
  raycaster.setFromCamera(pointer, camera);
  const meshes = fanCards().flatMap((g) => g.userData.meshes);
  const hit = raycaster.intersectObjects(meshes, false)[0];
  return hit ? hit.object.userData.card : null;
}
function setPointer(e) {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  parallax.copy(pointer);
}

canvasEl.addEventListener('pointerdown', (e) => {
  if (state.mode === 'inspect' && state.focus) {
    drag = { x: e.clientX, spin: state.focus.userData.spin, moved: false };
    canvasEl.setPointerCapture(e.pointerId);
  }
});
canvasEl.addEventListener('pointermove', (e) => {
  setPointer(e);
  if (drag && state.focus) {
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    state.focus.userData.spin = drag.spin + dx * 0.012;
    canvasEl.style.cursor = 'grabbing';
    return;
  }
  const h = hitFanCard();
  if (h !== state.hovered) state.hovered = h;
  canvasEl.style.cursor = h ? 'pointer' : state.mode === 'inspect' ? 'grab' : 'default';
});
canvasEl.addEventListener('pointerup', () => { if (drag) { drag = null; canvasEl.style.cursor = 'grab'; } });
canvasEl.addEventListener('pointerleave', () => { state.hovered = null; pointer.set(-9, -9); });
canvasEl.addEventListener('click', (e) => {
  setPointer(e);
  if (state.mode === 'picking') {
    const c = hitFanCard();
    if (c && pickResolve) { sfx.tick(); pickResolve(c); }
    return;
  }
  if (state.mode === 'inspect') return;
  advance();
});

export function pickCard() {
  state.mode = 'picking';
  return waitable((resolve) => {
    pickResolve = (c) => {
      pickResolve = null;
      state.mode = 'reveal';
      state.hovered = null;
      canvasEl.style.cursor = 'default';
      resolve(c);
    };
  });
}
