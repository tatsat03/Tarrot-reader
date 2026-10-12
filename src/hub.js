import * as THREE from 'three';
import { renderer, camera } from './engine.js';
import { tween, easeInOut, el } from './util.js';
import { state } from './state.js';
import { sfx } from './audio.js';

/**
 * A walkable hub: places you can hover and enter (the camp's tents, the big top's stalls).
 * Each spot needs: id, name, sub, g (Group), top (local Vector3 for its label), view {pos, look},
 * hits (meshes to raycast), and optionally onGlow(amount, t) for its own hover effect.
 * The hub owns the floating HTML labels, pointer/keyboard picking and the camera path.
 */
export function createHub({ name, spots, overview, order = spots.map((s) => s.id) }) {
  const box = el('div', 'hub-labels');
  box.setAttribute('aria-label', 'Places you can go');
  document.body.append(box);
  const hub = {
    name, spots,
    camPos: overview().pos.clone(),
    camLook: overview().look.clone(),
    hovered: null,
    interactive: false,
    onEnter: null,
  };
  const hits = [];
  for (const s of spots) {
    s.glow = 0;
    for (const h of s.hits) { h.userData.spot = s; hits.push(h); }
    const b = el('button', 'camp-label');
    b.append(el('span', 'cl-name', s.name), el('span', 'cl-sub', s.sub));
    b.onclick = () => enter(s);
    b.onmouseenter = () => setHover(s);
    b.onmouseleave = () => setHover(null);
    b.onfocus = () => setHover(s);
    b.onblur = () => setHover(null);
    box.append(b);
    s.label = b;
  }
  const active = () => state.scene === name && hub.interactive;
  function setHover(s) {
    if (hub.hovered === s) return;
    hub.hovered = s;
    if (s) sfx.hover();
    for (const q of spots) q.label.classList.toggle('hover', q === s);
  }
  function enter(s) {
    if (!active()) return;
    sfx.tick();
    hub.onEnter && hub.onEnter(s);
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), cv = renderer.domElement;
  const pick = (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits, false)[0];
    return h ? h.object.userData.spot : null;
  };
  cv.addEventListener('pointermove', (e) => {
    if (!active()) return;
    const s = pick(e);
    setHover(s);
    cv.style.cursor = s ? 'pointer' : 'default';
  });
  cv.addEventListener('click', (e) => { if (active()) { const s = pick(e); if (s) enter(s); } });
  addEventListener('keydown', (e) => {
    if (!active() || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    const list = order.map((id) => hub.spot(id));
    const i = list.indexOf(hub.hovered);
    const step = e.key === 'ArrowRight' ? 1 : -1;
    const next = list[i < 0 ? 0 : (i + step + list.length) % list.length];
    next.label.focus();
    e.preventDefault();
  });

  Object.assign(hub, {
    spot: (id) => spots.find((s) => s.id === id),
    showLabels(on) { box.classList.toggle('show', on); if (!on) setHover(null); },
    setSub(id, text) { const s = hub.spot(id); if (s) s.label.querySelector('.cl-sub').textContent = text; },
    flyTo(target, duration = 1.6) {
      const to = target === 'overview' ? overview() : target.view;
      const p0 = hub.camPos.clone(), l0 = hub.camLook.clone();
      return tween({ duration, ease: easeInOut, onUpdate: (k) => { hub.camPos.lerpVectors(p0, to.pos, k); hub.camLook.lerpVectors(l0, to.look, k); } });
    },
    placeAt(target) {
      const to = target === 'overview' ? overview() : target.view;
      hub.camPos.copy(to.pos);
      hub.camLook.copy(to.look);
    },
    update(t, dt) {
      const p = new THREE.Vector3();
      for (const s of spots) {
        s.glow += ((hub.hovered === s ? 1 : 0) - s.glow) * Math.min(1, dt * 6);
        s.onGlow && s.onGlow(s.glow, t);
        s.g.localToWorld(p.copy(s.top)).project(camera);
        const vis = p.z < 1 && Math.abs(p.x) < 1.15 && Math.abs(p.y) < 1.15;
        s.label.style.opacity = vis ? '' : '0';
        s.label.style.transform = `translate(${((p.x + 1) / 2) * innerWidth}px, ${((1 - p.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
      }
    },
  });
  return hub;
}
