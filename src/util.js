import * as THREE from 'three';

export const $ = (id) => document.getElementById(id);
export const nowS = () => performance.now() / 1000;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const pickFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const glow = (hex, s) => new THREE.Color(hex).multiplyScalar(s); // >1 blooms

export function hexA(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Small promise-based tween engine, driven from the render loop.
const tweens = new Set();
export function tween({ duration, delay = 0, ease = easeInOut, onStart, onUpdate }) {
  return new Promise((resolve) => {
    tweens.add({ start: nowS() + delay, duration, ease, onStart, onUpdate, resolve, started: false });
  });
}
export function updateTweens(t) {
  for (const tw of tweens) {
    if (t < tw.start) continue;
    if (!tw.started) { tw.started = true; tw.onStart && tw.onStart(); }
    const p = Math.min(1, (t - tw.start) / tw.duration);
    tw.onUpdate(tw.ease(p), p);
    if (p >= 1) { tweens.delete(tw); tw.resolve(); }
  }
}

// localStorage that never throws (private windows, blocked storage).
export const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  },
};
