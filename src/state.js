import { store } from './util.js';

// Shared, mutable game state.
export const state = {
  view: 'title',      // title | camp | setup | reading | library | journal | history | settings | intro
  scene: 'camp',      // which 3D world is showing: camp | chamber
  mode: 'idle',       // what the 3D table is doing: idle | busy | picking | reveal | inspect
  hovered: null,      // card under the pointer while picking
  focus: null,        // card Seraphine is looking at
  introHeard: false,
};

const DEFAULTS = { voice: true, voiceName: '', voiceRate: 1, sound: true, quality: 'auto', autoAdvance: true, autoDelay: 2.5 };
export const settings = { ...DEFAULTS, ...store.get('oracle.settings', {}) };
export function saveSettings() { store.set('oracle.settings', settings); }
