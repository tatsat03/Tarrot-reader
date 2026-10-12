import * as THREE from 'three';
import { $, el, sleep, updateTweens, nowS, store } from './util.js';
import { state, settings, saveSettings } from './state.js';
import { renderer, scene, camera, camBase, camTarget, camAnchor, composer, renderPass, grade, resizeEngine, layoutCamera, GPU, HIGH } from './engine.js';
import { updateRoom, constellation } from './room.js';
import { O, updateOracle } from './oracle.js';
import { deck, setInPlay, stackDeck, updateCards, layoutFan } from './cards.js';
import { sfx, voice } from './audio.js';
import { typing, abortFlow, Aborted, beginFlow, say, showOverlay, hideOverlays, hideDialogue } from './ui.js';
import { parallax } from './input.js';
import { runReading, INTRO, requestSkipIntro } from './reading.js';
import { openLibrary, closeLibrary } from './library.js';
import { renderJournal, downloadJournal, listHistory, deleteHistory, who } from './journal.js';
import { checkAgent, agentStatus } from './agent.js';
import { village, camp, updateVillage, flyTo, arrive, placeAt, spotById, showLabels, setSub } from './village.js';
import { SPREADS, MAJORS, DECK } from '../data/deck.js';

const hudBack = $('btn-menu'), hudSkip = $('btn-skip');
let lastDeck = 'major';

/* =====================================================================
   Moving between the camp and Seraphine's chamber
   ===================================================================== */
function fade(on) {
  $('fade').classList.toggle('on', on);
  return sleep(650);
}
function campCamera() {
  camera.fov = innerWidth / innerHeight < 0.9 ? 64 : 50;
  camera.updateProjectionMatrix();
}
function setScene(name) {
  state.scene = name;
  document.body.dataset.scene = name;
  renderPass.scene = name === 'camp' ? village : scene;
  sfx.setScene(name);
  if (name === 'camp') campCamera(); else layoutCamera();
}

async function toChamber() {
  if (state.scene === 'chamber') return;
  camp.interactive = false;
  showLabels(false);
  await fade(true);
  setScene('chamber');
  camAnchor.copy(camBase);
  camera.position.copy(camBase);
  camera.lookAt(camTarget);
  await sleep(120);
  fade(false);
}

// Back out to the camp; `from` is the spot the camera starts at (so you step out of that tent).
async function toCamp(from = null) {
  abortFlow();
  hideOverlays();
  hudSkip.hidden = true;
  hudBack.hidden = true;
  state.view = 'camp';
  state.mode = 'idle';
  state.focus = null;
  if (state.scene !== 'camp') {
    await fade(true);
    setScene('camp');
    placeAt(from || 'overview');
    camera.position.copy(camp.camPos);
    camera.lookAt(camp.camLook);
    setInPlay(lastDeck === 'full' ? DECK : MAJORS);
    stackDeck(true);
    constellation.clear();
    await sleep(120);
    fade(false);
  }
  refreshCampLabels();
  await flyTo('overview', from ? 1.8 : 1.2);
  if (state.view !== 'camp') return;
  camp.interactive = true;
  showLabels(true);
}
function refreshCampLabels() {
  const n = listHistory().length;
  setSub('memories', n ? `${n} saved reading${n === 1 ? '' : 's'}` : 'Past readings');
  agentChip();
}
function agentChip() {
  const st = agentStatus();
  const chip = $('agent-chip');
  chip.classList.toggle('on', st.online);
  chip.textContent = st.online ? 'Seraphine is awake · Claude connected' : st.reason === 'no-server' ? 'Offline — start the game with start.bat' : 'Scripted mode — add a Claude API key to converse';
}

// Walking up to a tent.
camp.onEnter = async (spot) => {
  camp.interactive = false;
  showLabels(false);
  hideDialogue();
  await flyTo(spot, 1.4);
  hudBack.hidden = false;
  if (spot.id === 'oracle') { await toChamber(); openSetup(); }
  else if (spot.id === 'library') { await toChamber(); state.view = 'library'; openLibrary(() => toCamp(spotById('library'))); }
  else if (spot.id === 'memories') openHistory();
  else if (spot.id === 'settings') openSettings();
  else if (spot.id === 'intro') playIntro();
};
// Closing a camp-side panel (history, settings, the fire).
function backToCamp() {
  abortFlow();
  hideOverlays();
  hudBack.hidden = true;
  state.view = 'camp';
  refreshCampLabels();
  flyTo('overview', 1.4).then(() => { if (state.view === 'camp') { camp.interactive = true; showLabels(true); } });
}

/* =====================================================================
   Reading setup
   ===================================================================== */
const setupState = { mode: 'solo', players: ['', ''], forEach: true, spread: 'mirror', deck: 'major', reversals: false, ...store.get('oracle.setup', {}) };

function renderSetup() {
  for (const b of document.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === setupState.mode);
  for (const b of document.querySelectorAll('[data-deck]')) b.classList.toggle('on', b.dataset.deck === setupState.deck);
  $('setup-duo').hidden = setupState.mode !== 'duo';
  $('p1').value = setupState.players[0];
  $('p2').value = setupState.players[1];
  $('foreach').checked = setupState.forEach;
  $('reversals').checked = setupState.reversals;
  $('spreads').replaceChildren(...SPREADS.map((s) => {
    const b = el('button', 'spread' + (s.id === setupState.spread ? ' on' : ''));
    b.type = 'button';
    const head = el('div', 'spread-head');
    head.append(el('span', 'spread-name', s.name), el('span', 'spread-count', `${s.positions.length} card${s.positions.length > 1 ? 's' : ''}`));
    b.append(head, el('span', 'spread-blurb', s.blurb));
    if (s.duo) b.append(el('span', 'badge', 'Best for two'));
    b.onclick = () => { setupState.spread = s.id; renderSetup(); };
    return b;
  }));
  const s = SPREADS.find((x) => x.id === setupState.spread);
  $('spread-positions').textContent = s.positions.map((p) => p.title).join(' · ');
}
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => {
  setupState.mode = b.dataset.mode;
  if (setupState.mode === 'duo' && setupState.spread === 'mirror') setupState.spread = 'relationship';
  renderSetup();
}));
document.querySelectorAll('[data-deck]').forEach((b) => (b.onclick = () => { setupState.deck = b.dataset.deck; renderSetup(); }));
$('p1').oninput = (e) => (setupState.players[0] = e.target.value);
$('p2').oninput = (e) => (setupState.players[1] = e.target.value);
$('foreach').onchange = (e) => (setupState.forEach = e.target.checked);
$('reversals').onchange = (e) => (setupState.reversals = e.target.checked);
$('setup-back').onclick = () => toCamp(spotById('oracle'));
$('setup-form').onsubmit = (e) => {
  e.preventDefault();
  const cfg = { ...setupState, players: setupState.players.map((p, i) => p.trim() || (i ? 'Player two' : 'Player one')) };
  if (cfg.mode === 'duo' && cfg.players[0].toLowerCase() === cfg.players[1].toLowerCase()) cfg.players[1] += ' II';
  store.set('oracle.setup', setupState);
  startReading(cfg);
};
function openSetup() {
  hideDialogue();
  state.view = 'setup';
  hudBack.hidden = false;
  renderSetup();
  showOverlay('setup');
}

/* =====================================================================
   Reading
   ===================================================================== */
async function startReading(cfg) {
  hideOverlays();
  state.view = 'reading';
  lastDeck = cfg.deck;
  hudBack.hidden = false;
  try {
    const record = await runReading(cfg, { onIntro: (on) => (hudSkip.hidden = !on) });
    openJournal(record, 'reading');
  } catch (e) {
    if (!(e instanceof Aborted)) { console.error(e); toCamp(spotById('oracle')); }
  } finally {
    hudSkip.hidden = true;
  }
}
hudSkip.onclick = () => { requestSkipIntro(); voice.stop(); const d = $('dialogue'); d.click(); d.click(); };

let leaveArmed = 0;
hudBack.onclick = () => {
  if (state.view === 'reading' && nowS() - leaveArmed > 3) {
    leaveArmed = nowS();
    hudBack.textContent = 'Leave this reading?';
    setTimeout(() => (hudBack.textContent = '‹ Camp'), 3000);
    return;
  }
  hudBack.textContent = '‹ Camp';
  leaveArmed = 0;
  if (state.view === 'library') closeLibrary();
  else if (state.scene === 'chamber') toCamp(spotById('oracle'));
  else backToCamp();
};

/* =====================================================================
   The Storyteller's Fire
   ===================================================================== */
async function playIntro() {
  state.view = 'intro';
  const F = beginFlow();
  try {
    for (const line of INTRO) await say(line);
    state.introHeard = true;
    F.check();
    backToCamp();
  } catch (e) { if (!(e instanceof Aborted)) throw e; }
}

/* =====================================================================
   Journal & history
   ===================================================================== */
let journalRecord = null, journalFrom = 'reading';
function openJournal(record, from) {
  journalRecord = record; journalFrom = from;
  renderJournal(record);
  $('j-again').hidden = from !== 'reading';
  $('j-delete').hidden = from !== 'history';
  $('j-menu').textContent = from === 'history' ? 'Back' : 'Back to camp';
  state.view = 'journal';
  hudBack.hidden = true;
  showOverlay('journal');
  $('journal').querySelector('.book').scrollTop = 0;
}
$('j-save').onclick = () => journalRecord && downloadJournal(journalRecord);
$('j-again').onclick = () => openSetup();
$('j-menu').onclick = () => (journalFrom === 'history' ? openHistory() : toCamp(spotById('oracle')));
$('j-delete').onclick = () => { if (journalRecord) deleteHistory(journalRecord.id); openHistory(); };

function openHistory() {
  state.view = 'history';
  hudBack.hidden = false;
  const items = listHistory();
  $('history-list').replaceChildren(...(items.length ? items.map((r) => {
    const b = el('button', 'hist-item');
    const date = new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    b.append(el('span', 'hist-date', date), el('span', 'hist-name', r.spreadName), el('span', 'hist-cards', r.entries.map((e) => e.name).join(' · ')), el('span', 'hist-who', who(r)));
    b.onclick = () => openJournal(r, 'history');
    return b;
  }) : [el('p', 'empty', 'Your readings will be kept here, on this device, once you finish one.')]));
  showOverlay('history');
}
$('history-back').onclick = () => backToCamp();

/* =====================================================================
   Settings (the Tinker's Wagon)
   ===================================================================== */
function renderVoices() {
  const sel = $('set-voice-name');
  const vs = voice.list();
  sel.replaceChildren(...vs.map((v) => { const o = el('option', '', `${v.name} (${v.lang})`); o.value = v.name; return o; }));
  if (voice.current) sel.value = voice.current.name;
  sel.disabled = !vs.length || voice.premium;
  $('set-voice-note').textContent = voice.premium
    ? 'Seraphine is using her ElevenLabs character voice.'
    : voice.natural
      ? `Using ${voice.description} — a natural neural voice.`
      : 'For a far more natural free voice, open the game in Microsoft Edge and pick a voice marked “Natural”. For a true character voice, add an ElevenLabs key (see README).';
}
voice.onChange(renderVoices);
function openSettings() {
  state.view = 'settings';
  hudBack.hidden = false;
  $('set-voice').checked = settings.voice;
  $('set-sound').checked = settings.sound;
  $('set-auto').checked = settings.autoAdvance;
  $('set-auto-delay').value = String(settings.autoDelay);
  $('set-rate').value = String(settings.voiceRate);
  $('set-quality').value = settings.quality;
  $('set-gpu').textContent = `${GPU.pretty} — currently ${HIGH ? 'high' : 'standard'} quality`;
  renderVoices();
  const st = agentStatus();
  $('set-agent').textContent = st.online
    ? `Connected. Seraphine is answering with Claude (${st.model}).`
    : st.reason === 'no-server'
      ? 'The local server is not running, so Seraphine can only use her scripted lines. Start the game with start.bat.'
      : 'No API key found, so Seraphine uses her scripted lines. To let her converse, create a file named .env in the game folder containing ANTHROPIC_API_KEY=your-key, then restart start.bat.';
  showOverlay('settings');
}
$('set-voice').onchange = (e) => { settings.voice = e.target.checked; if (!settings.voice) voice.stop(); saveSettings(); };
$('set-sound').onchange = (e) => { settings.sound = e.target.checked; sfx.refresh(); saveSettings(); };
$('set-auto').onchange = (e) => { settings.autoAdvance = e.target.checked; saveSettings(); };
$('set-auto-delay').onchange = (e) => { settings.autoDelay = Number(e.target.value); saveSettings(); };
$('set-rate').oninput = (e) => { settings.voiceRate = Number(e.target.value); saveSettings(); };
$('set-voice-name').onchange = (e) => { settings.voiceName = e.target.value; saveSettings(); voice.refresh(); voice.speak('This is how I sound, traveler.'); };
$('set-test').onclick = () => voice.speak('Welcome to the camp, traveler. Shall we see what the cards would like you to notice?');
$('set-quality').onchange = (e) => { settings.quality = e.target.value; saveSettings(); $('set-quality-note').hidden = false; };
$('set-reload').onclick = () => location.reload();
$('set-recheck').onclick = async () => { await checkAgent(); openSettings(); };
$('settings-back').onclick = () => backToCamp();

/* =====================================================================
   Title → camp
   ===================================================================== */
$('begin').addEventListener('click', async () => {
  sfx.init();
  $('title').classList.add('gone');
  state.view = 'entering';
  setScene('camp');
  await arrive();
  state.view = 'camp';
  refreshCampLabels();
  camp.interactive = true;
  showLabels(true);
  const F = beginFlow();
  try {
    await say('Welcome to the Midnight Fair, traveler. Wander where you like — my tent is the one with the moon above the door.', { wait: false });
    await sleep(6500);
    if (F.alive && state.view === 'camp') hideDialogue();
  } catch (e) { if (!(e instanceof Aborted)) throw e; }
});

/* =====================================================================
   Frame loop
   ===================================================================== */
const _v = new THREE.Vector3(), look = new THREE.Vector3(), menuShift = new THREE.Vector3();
let last = nowS();
function loop() {
  requestAnimationFrame(loop);
  const t = nowS(), dt = Math.min(0.05, t - last);
  last = t;
  updateTweens(t);
  const mouth = voice.level(dt);

  if (state.scene === 'camp') {
    updateVillage(t, dt);
    const k = camp.interactive ? 1 : 0.3;
    _v.copy(camp.camPos).add({ x: parallax.x * 0.6 * k, y: parallax.y * 0.25 * k, z: 0 });
    camera.position.lerp(_v, Math.min(1, dt * 3));
    camera.lookAt(camp.camLook);
  } else {
    if (state.hovered) state.hovered.getWorldPosition(look);
    else if (state.focus) state.focus.getWorldPosition(look);
    else look.copy(camera.position);
    updateOracle(t, dt, { talking: !!typing || voice.speaking, lookTarget: look, mouth });
    updateCards(t, dt);
    updateRoom(t, dt, O);
    const sidePanel = state.view === 'setup' && innerWidth > 820;
    menuShift.lerp(_v.set(sidePanel ? -0.55 : 0, 0, 0), Math.min(1, dt * 2));
    const k = state.mode === 'reveal' || state.mode === 'inspect' ? 0.25 : 1;
    _v.set(camAnchor.x + parallax.x * 0.28 * k + menuShift.x, camAnchor.y + parallax.y * 0.12 * k, camAnchor.z);
    camera.position.lerp(_v, Math.min(1, dt * 2.5));
    camera.lookAt(camTarget.x + menuShift.x, camTarget.y, camTarget.z);
  }

  grade.uniforms.uTime.value = t;
  grade.uniforms.uFocus.value += ((state.mode === 'reveal' || state.mode === 'inspect' ? 1 : 0) - grade.uniforms.uFocus.value) * Math.min(1, dt * 2);
  composer.render();
}

addEventListener('resize', () => {
  if (!resizeEngine()) return;
  if (state.scene === 'camp') { campCamera(); if (state.view === 'camp') placeAt('overview'); }
  else if (state.view !== 'entering') camAnchor.copy(camBase);
  if (state.mode === 'picking') layoutFan(false);
});

/* =====================================================================
   Boot
   ===================================================================== */
(async () => {
  try {
    await Promise.race([
      Promise.all([document.fonts.load('600 40px Cinzel'), document.fonts.load('italic 400 24px "Cormorant Garamond"')]),
      sleep(3000),
    ]);
  } catch { /* fall back to system fonts */ }
  setInPlay(MAJORS);
  stackDeck(true);
  if (HIGH) {
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.card) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const glowy = mats.some((m) => m.transparent || m.isMeshBasicMaterial || m.isShaderMaterial);
      o.castShadow = !glowy;
      o.receiveShadow = !glowy;
    });
  }
  setScene('camp');
  camera.position.copy(camp.camPos);
  camera.lookAt(camp.camLook);
  const badge = $('gpu');
  badge.textContent = HIGH ? `GPU · ${GPU.pretty} · high quality` : `GPU · ${GPU.pretty}`;
  if (!GPU.dedicated) {
    badge.classList.add('warn');
    badge.title = 'Running on integrated graphics. In Windows Settings → System → Display → Graphics, set your browser to "High performance" and restart it to use your dedicated GPU.';
  }
  // handy for poking at things from the devtools console; snap() returns the current frame as a PNG data URL
  window.__oracle = { state, deck, camera, GPU, settings, camp, snap: () => { composer.render(); return renderer.domElement.toDataURL('image/png'); } };
  loop();
  $('loader').classList.add('gone');
  $('begin').disabled = false;
  checkAgent().then(agentChip);
})();
