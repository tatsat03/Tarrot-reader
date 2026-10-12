import * as THREE from 'three';
import { $, el, sleep, updateTweens, nowS } from './util.js';
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
import { renderJournal, downloadJournal, listHistory, deleteHistory, forgetProfile, who } from './journal.js';
import { checkAgent, agentStatus } from './agent.js';
import { village, camp, updateVillage, arrive } from './village.js';
import { bazaar, bigTop, updateBazaar, enterBigTop } from './bazaar.js';
import { listProfiles, getProfile, saveProfile, deleteProfile, currentProfile, setCurrent, lastActiveId, displayName, astro, isBirthday, FOCUS } from './profiles.js';
import { MAJORS, DECK } from '../data/deck.js';
import { cardThumb } from './textures.js';

const hudBack = $('btn-menu'), hudSkip = $('btn-skip');
const setBack = (label) => { hudBack.textContent = label; hudBack.hidden = !label; };

/* =====================================================================
   Worlds: the camp, the big top (inside Seraphine's tent), the chamber
   ===================================================================== */
const hubs = { camp, bazaar: bigTop };
function fade(on) {
  $('fade').classList.toggle('on', on);
  return sleep(650);
}
function hubCamera() {
  camera.fov = innerWidth / innerHeight < 0.9 ? 64 : state.scene === 'bazaar' ? 54 : 50;
  camera.updateProjectionMatrix();
}
function setScene(name) {
  state.scene = name;
  document.body.dataset.scene = name;
  renderPass.scene = name === 'camp' ? village : name === 'bazaar' ? bazaar : scene;
  sfx.setScene(name);
  if (name === 'chamber') layoutCamera(); else hubCamera();
  camp.showLabels(false);
  bigTop.showLabels(false);
}
function openHub(hub) {
  hub.interactive = true;
  hub.showLabels(true);
}
function closeHubs() {
  for (const h of Object.values(hubs)) { h.interactive = false; h.showLabels(false); }
}
function resetTable() {
  setInPlay(settings.deck === 'full' ? DECK : MAJORS);
  stackDeck(true);
  constellation.clear();
}

async function toChamber() {
  closeHubs();
  await fade(true);
  setScene('chamber');
  camAnchor.copy(camBase);
  camera.position.copy(camBase);
  camera.lookAt(camTarget);
  await sleep(120);
  fade(false);
}

// Back out to the camp; `fromId` is the tent you step out of.
async function toCamp(fromId = null) {
  abortFlow();
  hideOverlays();
  closeHubs();
  hudSkip.hidden = true;
  setBack('');
  state.view = 'camp';
  state.mode = 'idle';
  state.focus = null;
  const from = fromId ? camp.spot(fromId) : null;
  if (state.scene !== 'camp') {
    await fade(true);
    setScene('camp');
    camp.placeAt(from || 'overview');
    camera.position.copy(camp.camPos);
    camera.lookAt(camp.camLook);
    resetTable();
    await sleep(120);
    fade(false);
  }
  refreshHud();
  await camp.flyTo('overview', from ? 1.8 : 1.2);
  if (state.view === 'camp') openHub(camp);
}

// Into the big top, among the reading stalls (from the camp, or back from a reading).
async function toBigTop(fromStall = null) {
  abortFlow();
  hideOverlays();
  closeHubs();
  hudSkip.hidden = true;
  state.view = 'bazaar';
  state.mode = 'idle';
  await fade(true);
  setScene('bazaar');
  if (fromStall) bigTop.placeAt(fromStall); else { bigTop.camPos.set(0, 2.2, 13.5); bigTop.camLook.set(0, 1.5, -2.6); }
  camera.position.copy(bigTop.camPos);
  camera.lookAt(bigTop.camLook);
  resetTable();
  await sleep(120);
  fade(false);
  setBack('‹ Camp');
  refreshHud();
  await (fromStall ? bigTop.flyTo('overview', 1.6) : enterBigTop());
  if (state.view === 'bazaar') openHub(bigTop);
}

function refreshHud() {
  const p = currentProfile();
  const n = p ? listHistory(p.id).length : 0;
  camp.setSub('memories', p ? (n ? `${n} saved reading${n === 1 ? '' : 's'}` : 'Your readings will gather here') : 'Guests leave no trace');
  const a = astro(p);
  $('player-chip').textContent = p ? `${a.sign ? a.sign.glyph + '︎ ' : ''}${p.name}` : 'Guest';
  const st = agentStatus();
  const chip = $('agent-chip');
  chip.classList.toggle('on', st.online);
  chip.textContent = st.online ? 'Seraphine is awake · Claude connected' : st.reason === 'no-server' ? 'Offline — start the game with start.bat' : 'Scripted mode — add a Claude API key to converse';
}

/* =====================================================================
   The camp's places
   ===================================================================== */
camp.onEnter = async (spot) => {
  closeHubs();
  hideDialogue();
  await camp.flyTo(spot, 1.4);
  if (spot.id === 'oracle') return toBigTop();
  setBack('‹ Camp');
  if (spot.id === 'library') { await toChamber(); state.view = 'library'; openLibrary(() => toCamp('library')); }
  else if (spot.id === 'memories') openHistory();
  else if (spot.id === 'settings') openSettings();
  else if (spot.id === 'intro') playIntro();
};
// Closing a camp-side panel (history, settings, the fire).
function backToCamp() {
  abortFlow();
  hideOverlays();
  setBack('');
  state.view = 'camp';
  refreshHud();
  camp.flyTo('overview', 1.4).then(() => { if (state.view === 'camp') openHub(camp); });
}

/* =====================================================================
   The big top's stalls
   ===================================================================== */
let stall = null, companion = null;
bigTop.onEnter = async (s) => {
  closeHubs();
  stall = s;
  companion = null;
  await bigTop.flyTo(s, 1.2);
  openStall(s);
};
function openStall(s) {
  state.view = 'stall';
  const sp = s.spreadObj;
  $('st-count').textContent = `${sp.positions.length} card${sp.positions.length > 1 ? 's' : ''} · ${settings.deck === 'full' ? 'full deck' : 'Major Arcana'}${settings.reversals ? ' · reversals' : ''}`;
  $('st-name').textContent = s.name;
  $('st-blurb').textContent = sp.blurb;
  $('st-positions').replaceChildren(...sp.positions.map((p) => el('li', '', p.title)));
  $('st-solo').hidden = !!s.duo;
  $('st-duo').hidden = !!s.duo;
  $('st-companion').hidden = !s.duo;
  if (s.duo) renderCompanions();
  setBack('‹ Stalls');
  showOverlay('stall');
}
function renderCompanions() {
  const me = currentProfile();
  $('st-myname-row').hidden = !!me;
  const others = listProfiles().filter((p) => !me || p.id !== me.id);
  $('st-people').replaceChildren(...others.map((p) => {
    const a = astro(p);
    const b = el('button', 'person' + (companion && companion.id === p.id ? ' on' : ''));
    b.type = 'button';
    b.append(el('span', 'person-glyph', a.sign ? a.sign.glyph + '︎' : '✦'), el('span', '', p.name));
    b.onclick = () => { companion = companion && companion.id === p.id ? null : p; $('st-guest').value = ''; renderCompanions(); };
    return b;
  }));
  if (!others.length) $('st-people').append(el('p', 'note', 'No other travelers yet — add a guest name below.'));
}
$('st-guest').oninput = () => { if (companion) { companion = null; renderCompanions(); } };
$('st-duo').onclick = () => { $('st-companion').hidden = false; renderCompanions(); };
$('st-back').onclick = () => leaveStall();
function leaveStall() {
  hideOverlays();
  state.view = 'bazaar';
  setBack('‹ Camp');
  bigTop.flyTo('overview', 1.2).then(() => { if (state.view === 'bazaar') openHub(bigTop); });
}
const meAsTraveler = () => {
  const p = currentProfile();
  return p ? { name: p.name, profile: p } : { name: $('st-myname').value.trim() || 'Traveler', profile: null };
};
$('st-solo').onclick = () => begin([meAsTraveler()]);
$('st-begin').onclick = () => {
  const guestName = $('st-guest').value.trim();
  if (!companion && !guestName) { $('st-guest').focus(); $('st-guest').placeholder = 'Choose someone above, or type a name'; return; }
  const me = meAsTraveler();
  const other = companion ? { name: companion.name, profile: companion } : { name: guestName, profile: null };
  if (other.name.toLowerCase() === me.name.toLowerCase()) other.name += ' II';
  begin([me, other], $('st-foreach').checked);
};

async function begin(travelers, forEach = true) {
  hideOverlays();
  await toChamber();
  state.view = 'reading';
  setBack('‹ Stalls');
  const cfg = { spread: stall.spread, deck: settings.deck, reversals: settings.reversals, forEach, travelers };
  try {
    const record = await runReading(cfg, { onIntro: (on) => (hudSkip.hidden = !on) });
    openJournal(record, 'reading');
  } catch (e) {
    if (!(e instanceof Aborted)) { console.error(e); toBigTop(stall); }
  } finally {
    hudSkip.hidden = true;
  }
}
hudSkip.onclick = () => { requestSkipIntro(); voice.stop(); const d = $('dialogue'); d.click(); d.click(); };

let leaveArmed = 0;
hudBack.onclick = () => {
  const label = hudBack.textContent;
  if (state.view === 'reading' && nowS() - leaveArmed > 3) {
    leaveArmed = nowS();
    hudBack.textContent = 'Leave this reading?';
    setTimeout(() => { if (hudBack.textContent === 'Leave this reading?') hudBack.textContent = label; }, 3000);
    return;
  }
  leaveArmed = 0;
  if (state.view === 'reading') return toBigTop(stall);
  if (state.view === 'library') return closeLibrary();
  if (state.view === 'stall') return leaveStall();
  if (state.view === 'bazaar') return toCamp('oracle');
  backToCamp();
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
   Journal & the Hall of Memories
   ===================================================================== */
let journalRecord = null, journalFrom = 'reading';
function openJournal(record, from) {
  journalRecord = record; journalFrom = from;
  renderJournal(record);
  $('j-again').hidden = from !== 'reading';
  $('j-delete').hidden = from !== 'history';
  $('j-guest').hidden = !(from === 'reading' && !(record.profileIds && record.profileIds.length));
  $('j-menu').textContent = from === 'history' ? 'Back' : 'Back to camp';
  state.view = 'journal';
  setBack('');
  showOverlay('journal');
  $('journal').querySelector('.book').scrollTop = 0;
}
$('j-save').onclick = () => journalRecord && downloadJournal(journalRecord);
$('j-again').onclick = () => toBigTop(stall);
$('j-menu').onclick = () => (journalFrom === 'history' ? openHistory() : toCamp('oracle'));
$('j-delete').onclick = () => { if (journalRecord) deleteHistory(journalRecord.id); openHistory(); };

function openHistory() {
  state.view = 'history';
  setBack('‹ Camp');
  const me = currentProfile();
  const items = me ? listHistory(me.id) : [];
  $('history-title').textContent = me ? `${me.name}'s readings` : 'Past readings';
  $('history-list').replaceChildren(...(items.length ? items.map((r) => {
    const b = el('button', 'hist-item');
    const date = new Date(r.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    b.append(el('span', 'hist-date', date), el('span', 'hist-name', r.spreadName), el('span', 'hist-cards', r.entries.map((e) => e.name).join(' · ')), el('span', 'hist-who', who(r)));
    b.onclick = () => openJournal(r, 'history');
    return b;
  }) : [el('p', 'empty', me ? 'Your readings will gather here once you finish one.' : 'Guests leave no trace here. Choose or create a traveler to keep a journal of your readings.')]));
  showOverlay('history');
}
$('history-back').onclick = () => backToCamp();

/* =====================================================================
   Travelers
   ===================================================================== */
let afterChoose = null; // what to do once a traveler is chosen (the first time: walk into the camp)
function openProfiles(then = null) {
  afterChoose = then;
  const list = listProfiles();
  const active = currentProfile() ? currentProfile().id : lastActiveId();
  $('profile-list').replaceChildren(...list.map((p) => {
    const a = astro(p);
    const card = el('div', 'profile-card' + (p.id === active ? ' on' : ''));
    const pick = el('button', 'pc-main');
    pick.append(el('span', 'pc-glyph', a.sign ? a.sign.glyph + '︎' : '✦'), el('span', 'pc-name', p.name),
      el('span', 'pc-sub', [a.sign && a.sign.name, a.age != null && `${a.age}`].filter(Boolean).join(' · ') || 'No birthdate'));
    pick.onclick = () => choose(p.id);
    const edit = el('button', 'pc-edit', 'Edit');
    edit.onclick = () => openProfileEdit(p);
    card.append(pick, edit);
    return card;
  }));
  if (!list.length) $('profile-list').append(el('p', 'note', 'No travelers yet. Create one so Seraphine can get to know you — or wander in as a guest.'));
  showOverlay('profiles');
}
function choose(id) {
  setCurrent(id);
  refreshHud();
  hideOverlays();
  const then = afterChoose;
  afterChoose = null;
  if (then) then(); else greetTraveler();
}
$('profile-guest').onclick = () => choose(null);
$('profile-new').onclick = () => openProfileEdit(null);
$('player-chip').onclick = () => { if (state.view === 'camp' || state.view === 'bazaar') openProfiles(); };

let editing = null, focusPick = new Set(), deleteArmed = false;
function openProfileEdit(p) {
  editing = p;
  deleteArmed = false;
  $('pf-eyebrow').textContent = p ? 'A traveler' : 'A new traveler';
  $('pf-title').textContent = p ? `Edit ${p.name}` : 'Tell Seraphine about yourself';
  $('pf-name').value = p ? p.name : '';
  $('pf-birth').value = p ? p.birthdate || '' : '';
  $('pf-birth').max = new Date().toISOString().slice(0, 10);
  $('pf-pronouns').value = p ? p.pronouns || '' : '';
  $('pf-notes').value = p ? p.notes || '' : '';
  focusPick = new Set(p ? p.focus || [] : []);
  $('pf-delete').hidden = !p;
  $('pf-delete').textContent = 'Delete traveler';
  renderFocus();
  renderPreview();
  showOverlay('profile-edit');
  setTimeout(() => $('pf-name').focus(), 60);
}
function renderFocus() {
  $('pf-focus').replaceChildren(...FOCUS.map((f) => {
    const b = el('button', 'chip' + (focusPick.has(f) ? ' on' : ''), f);
    b.type = 'button';
    b.onclick = () => { focusPick.has(f) ? focusPick.delete(f) : focusPick.add(f); renderFocus(); };
    return b;
  }));
}
function renderPreview() {
  const draft = { name: $('pf-name').value.trim() || 'Traveler', birthdate: $('pf-birth').value };
  const a = astro(draft);
  const box = $('pf-preview');
  if (!a.sign) {
    box.replaceChildren(el('div', 'pv-empty', 'Add a birthdate and Seraphine will find your sun sign, life path number and tarot birth card.'));
    return;
  }
  const cards = el('div', 'pv-cards');
  for (const c of a.birthCards) { const img = el('img'); img.src = cardThumb(c); img.alt = c.name; cards.append(img); }
  box.replaceChildren(
    el('div', 'pv-glyph', a.sign.glyph + '︎'),
    el('div', 'pv-sign', `${a.sign.name} · ${a.sign.element}`),
    el('div', 'pv-line', `${a.age} years · life path ${a.lifePath}`),
    cards,
    el('div', 'pv-line', `Birth card${a.birthCards.length > 1 ? 's' : ''}: ${a.birthCards.map((c) => c.name).join(' & ')}`),
    el('div', 'pv-fine', `${a.sign.name}'s own card is ${a.sign.card.name}.`),
  );
}
$('pf-birth').oninput = renderPreview;
$('pf-name').oninput = renderPreview;
$('pf-cancel').onclick = () => openProfiles(afterChoose);
$('pf-form').onsubmit = (e) => {
  e.preventDefault();
  const name = $('pf-name').value.trim();
  if (!name) return $('pf-name').focus();
  const saved = saveProfile({
    ...(editing || {}), name, birthdate: $('pf-birth').value || '', pronouns: $('pf-pronouns').value,
    focus: [...focusPick], notes: $('pf-notes').value.trim(),
  });
  choose(saved.id);
};
$('pf-delete').onclick = () => {
  if (!editing) return;
  if (!deleteArmed) { deleteArmed = true; $('pf-delete').textContent = 'Delete them and their readings?'; return; }
  forgetProfile(editing.id);
  deleteProfile(editing.id);
  if (currentProfile() && currentProfile().id === editing.id) setCurrent(null);
  refreshHud();
  openProfiles(afterChoose);
};

function greetTraveler() {
  const p = currentProfile();
  const line = !p
    ? 'Welcome to the Midnight Fair, traveler. Wander where you like — my tent is the one with the moon above the door.'
    : isBirthday(p)
      ? `${p.name}! Happy birthday — the fair is lit for you tonight. My tent is the one with the moon above the door.`
      : `Welcome to the Midnight Fair, ${p.name}. Wander where you like — my tent is the one with the moon above the door.`;
  const F = beginFlow();
  say(line, { wait: false })
    .then(() => sleep(6500))
    .then(() => { if (F.alive && (state.view === 'camp' || state.view === 'bazaar')) hideDialogue(); })
    .catch((e) => { if (!(e instanceof Aborted)) throw e; });
}

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
function renderDeck() {
  for (const b of document.querySelectorAll('[data-deck]')) b.classList.toggle('on', b.dataset.deck === settings.deck);
  $('set-reversals').checked = settings.reversals;
}
document.querySelectorAll('[data-deck]').forEach((b) => (b.onclick = () => { settings.deck = b.dataset.deck; saveSettings(); renderDeck(); }));
$('set-reversals').onchange = (e) => { settings.reversals = e.target.checked; saveSettings(); };
function openSettings() {
  state.view = 'settings';
  setBack('‹ Camp');
  $('set-voice').checked = settings.voice;
  $('set-sound').checked = settings.sound;
  $('set-auto').checked = settings.autoAdvance;
  $('set-auto-delay').value = String(settings.autoDelay);
  $('set-rate').value = String(settings.voiceRate);
  $('set-quality').value = settings.quality;
  $('set-gpu').textContent = `${GPU.pretty} — currently ${HIGH ? 'high' : 'standard'} quality`;
  renderDeck();
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
$('set-test').onclick = () => voice.speak('Welcome to the fair, traveler. Shall we see what the cards would like you to notice?');
$('set-quality').onchange = (e) => { settings.quality = e.target.value; saveSettings(); $('set-quality-note').hidden = false; };
$('set-reload').onclick = () => location.reload();
$('set-recheck').onclick = async () => { await checkAgent(); openSettings(); };
$('settings-back').onclick = () => backToCamp();

/* =====================================================================
   Title → who's visiting → camp
   ===================================================================== */
$('begin').addEventListener('click', () => {
  sfx.init();
  $('title').classList.add('gone');
  state.view = 'entering';
  setScene('camp');
  openProfiles(async () => {
    await arrive();
    state.view = 'camp';
    refreshHud();
    openHub(camp);
    greetTraveler();
  });
});

/* =====================================================================
   Frame loop
   ===================================================================== */
const _v = new THREE.Vector3(), look = new THREE.Vector3();
let last = nowS();
function loop() {
  requestAnimationFrame(loop);
  const t = nowS(), dt = Math.min(0.05, t - last);
  last = t;
  updateTweens(t);
  const mouth = voice.level(dt);

  const hub = hubs[state.scene];
  if (hub) {
    if (state.scene === 'camp') updateVillage(t, dt); else updateBazaar(t, dt);
    const k = hub.interactive ? 1 : 0.3;
    _v.copy(hub.camPos).add({ x: parallax.x * 0.6 * k, y: parallax.y * 0.25 * k, z: 0 });
    camera.position.lerp(_v, Math.min(1, dt * 3));
    camera.lookAt(hub.camLook);
  } else {
    if (state.hovered) state.hovered.getWorldPosition(look);
    else if (state.focus) state.focus.getWorldPosition(look);
    else look.copy(camera.position);
    updateOracle(t, dt, { talking: !!typing || voice.speaking, lookTarget: look, mouth });
    updateCards(t, dt);
    updateRoom(t, dt, O);
    const k = state.mode === 'reveal' || state.mode === 'inspect' ? 0.25 : 1;
    _v.set(camAnchor.x + parallax.x * 0.28 * k, camAnchor.y + parallax.y * 0.12 * k, camAnchor.z);
    camera.position.lerp(_v, Math.min(1, dt * 2.5));
    camera.lookAt(camTarget);
  }

  grade.uniforms.uTime.value = t;
  grade.uniforms.uFocus.value += ((state.mode === 'reveal' || state.mode === 'inspect' ? 1 : 0) - grade.uniforms.uFocus.value) * Math.min(1, dt * 2);
  composer.render();
}

addEventListener('resize', () => {
  if (!resizeEngine()) return;
  const hub = hubs[state.scene];
  if (hub) { hubCamera(); if (hub.interactive) hub.placeAt('overview'); }
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
  const last = lastActiveId();
  if (last && last !== 'guest' && getProfile(last)) setCurrent(last);
  resetTable();
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
  camp.camPos.set(0, 16, 34);
  camera.position.copy(camp.camPos);
  camera.lookAt(camp.camLook);
  const badge = $('gpu');
  badge.textContent = HIGH ? `GPU · ${GPU.pretty} · high quality` : `GPU · ${GPU.pretty}`;
  if (!GPU.dedicated) {
    badge.classList.add('warn');
    badge.title = 'Running on integrated graphics. In Windows Settings → System → Display → Graphics, set your browser to "High performance" and restart it to use your dedicated GPU.';
  }
  // handy for poking at things from the devtools console; snap() returns the current frame as a PNG data URL
  window.__oracle = { state, deck, camera, GPU, settings, camp, bigTop, snap: () => { composer.render(); return renderer.domElement.toDataURL('image/png'); } };
  loop();
  $('loader').classList.add('gone');
  $('begin').disabled = false;
  checkAgent().then(refreshHud);
})();
