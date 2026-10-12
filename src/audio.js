import { settings } from './state.js';

// Ambient sound — synthesised with Web Audio, no files. Two beds: the chamber's low drone,
// and the camp at night (crickets, a crackling fire).
export const sfx = (() => {
  let ctx = null, master = null, fx = null, droneBus = null, campBus = null, scene = 'camp';
  const level = () => (settings.sound ? 0.5 : 0);

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function buildDrone() {
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 520; dlp.connect(droneBus);
    [[55, 'sine', 0.22], [82.41, 'sine', 0.12], [110.3, 'triangle', 0.06], [164.8, 'sine', 0.03]].forEach(([f, type, amp], i) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = amp;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.037;
      const lg = ctx.createGain(); lg.gain.value = amp * 0.6;
      lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(dlp);
      o.start(); lfo.start();
    });
  }
  function buildCamp() {
    // crickets: a high tone gated into fast pulses, grouped into chirps
    [[4300, 0.6, 21], [4700, 0.83, 25]].forEach(([f, groupHz, pulseHz]) => {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const pulse = ctx.createGain(); pulse.gain.value = 0.5;
      const pl = ctx.createOscillator(); pl.type = 'square'; pl.frequency.value = pulseHz;
      const plg = ctx.createGain(); plg.gain.value = 0.5; pl.connect(plg); plg.connect(pulse.gain);
      const group = ctx.createGain(); group.gain.value = 0.5;
      const gl = ctx.createOscillator(); gl.type = 'square'; gl.frequency.value = groupHz;
      const glg = ctx.createGain(); glg.gain.value = 0.5; gl.connect(glg); glg.connect(group.gain);
      const out = ctx.createGain(); out.gain.value = 0.012;
      o.connect(pulse); pulse.connect(group); group.connect(out); out.connect(campBus);
      o.start(); pl.start(); gl.start();
    });
    // the fire: a low rumble plus random crackles
    const rumble = ctx.createBufferSource(); rumble.buffer = noiseBuffer(2); rumble.loop = true;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 300;
    const rg = ctx.createGain(); rg.gain.value = 0.05;
    rumble.connect(rlp); rlp.connect(rg); rg.connect(campBus); rumble.start();
    const crackle = noiseBuffer(0.05);
    setInterval(() => {
      if (!ctx || scene !== 'camp' || Math.random() > 0.4) return;
      const s = ctx.createBufferSource(); s.buffer = crackle;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 2500;
      const g = ctx.createGain(); const t = ctx.currentTime;
      g.gain.setValueAtTime(0.05 + Math.random() * 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      s.connect(hp); hp.connect(g); g.connect(campBus); s.start(t);
    }, 110);
  }
  function applyScene(ramp = 1.5) {
    if (!ctx) return;
    const t = ctx.currentTime;
    droneBus.gain.setTargetAtTime(scene === 'chamber' ? 1 : 0.25, t, ramp);
    campBus.gain.setTargetAtTime(scene === 'camp' ? 1 : 0, t, ramp);
  }
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      fx = ctx.createGain();
      const delay = ctx.createDelay(); delay.delayTime.value = 0.33;
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      fx.connect(master); fx.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(master);
      droneBus = ctx.createGain(); droneBus.gain.value = 0; droneBus.connect(master);
      campBus = ctx.createGain(); campBus.gain.value = 0; campBus.connect(master);
      buildDrone();
      buildCamp();
      applyScene(0.5);
      master.gain.linearRampToValueAtTime(level(), ctx.currentTime + 4);
    } catch (e) { ctx = null; }
  }
  function tone(f, t0, dur, amp, type = 'sine') {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(amp, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(fx); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  return {
    init,
    get context() { return ctx; },
    setScene(name) { scene = name; applyScene(); },
    refresh() { if (ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4); },
    chime() { if (!ctx) return; const t = ctx.currentTime; [523.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => tone(f, t + i * 0.075, 2.4, 0.12)); },
    tick() { if (ctx) tone(1320, ctx.currentTime, 0.25, 0.08, 'triangle'); },
    hover() { if (ctx) tone(880 + Math.random() * 220, ctx.currentTime, 0.6, 0.035); },
    star() { if (!ctx) return; const t = ctx.currentTime; [1567.98, 2093].forEach((f, i) => tone(f, t + i * 0.12, 1.8, 0.07)); },
    whoosh(dur = 1) {
      if (!ctx) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      const t = ctx.currentTime;
      bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.5); bp.frequency.exponentialRampToValueAtTime(400, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(bp); bp.connect(g); g.connect(master); src.start(t);
    },
  };
})();

/* =====================================================================
   Seraphine's voice.
   - Premium: an ElevenLabs voice, synthesised by the local server (/api/tts) when a key is set.
   - Otherwise the browser's own speech, choosing the most natural voice available
     (Microsoft "Natural" voices in Edge are the best free option on Windows).
   speak() resolves when she has finished (or was interrupted), so lines can follow on naturally.
   ===================================================================== */
export const voice = (() => {
  const browserOK = 'speechSynthesis' in window;
  let premium = false, chosen = null, current = null;
  let audioEl = null, analyser = null, samples = null;
  let level = 0, pulse = 0;
  const listeners = new Set();
  const cache = new Map();

  const isNatural = (v) => /natural|neural|online|google/i.test(v.name);
  function rank(v) {
    let s = 0;
    if (/natural|neural/i.test(v.name)) s += 100;
    if (/online/i.test(v.name)) s += 40;
    if (/google/i.test(v.name)) s += 30;
    if (/(aria|jenny|sonia|libby|ava|emma|michelle|serena|hazel|zira|samantha|moira|fiona|karen|female)/i.test(v.name)) s += 20;
    if (/en-(GB|IE)/i.test(v.lang)) s += 5;
    return s;
  }
  function englishVoices() {
    return browserOK ? speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => rank(b) - rank(a)) : [];
  }
  function choose() {
    const vs = englishVoices();
    chosen = vs.find((v) => v.name === settings.voiceName) || vs[0] || null;
    listeners.forEach((fn) => fn());
  }
  if (browserOK) { choose(); speechSynthesis.addEventListener('voiceschanged', choose); }

  const forSpeech = (text) => text.replace(/…/g, '...').replace(/—/g, ', ').replace(/[“”]/g, '"');
  const sentences = (text) => (forSpeech(text).match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [text]).map((s) => s.trim()).filter(Boolean);

  function speakBrowser(text, token) {
    if (!browserOK) return Promise.resolve();
    const parts = sentences(text);
    return new Promise((resolve) => {
      token.resolve = resolve;
      let i = 0;
      const next = () => {
        if (token.cancelled || i >= parts.length) return resolve();
        const u = new SpeechSynthesisUtterance(parts[i++]);
        if (chosen) u.voice = chosen;
        const natural = chosen && isNatural(chosen);
        u.rate = (natural ? 0.95 : 0.9) * settings.voiceRate;
        u.pitch = natural ? 1 : 0.9;           // pitch shifts make neural voices sound robotic
        u.onboundary = () => (pulse = 1);
        u.onend = () => setTimeout(next, 140);  // a breath between sentences
        u.onerror = () => next();
        speechSynthesis.speak(u);
      };
      next();
    });
  }

  function ensureAudio() {
    if (audioEl) return;
    audioEl = new Audio();
    const ctx = sfx.context;
    if (ctx) {
      const src = ctx.createMediaElementSource(audioEl);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      samples = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
      analyser.connect(ctx.destination);
    }
  }
  async function speakPremium(text, token) {
    let url = cache.get(text);
    if (!url) {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: forSpeech(text) }) });
      if (!r.ok) throw new Error(`tts ${r.status}`);
      url = URL.createObjectURL(await r.blob());
      cache.set(text, url);
      if (cache.size > 80) { const [k, v] = cache.entries().next().value; URL.revokeObjectURL(v); cache.delete(k); }
    }
    if (token.cancelled) return;
    ensureAudio();
    audioEl.src = url;
    audioEl.playbackRate = settings.voiceRate;
    await audioEl.play();
    await new Promise((resolve) => { token.resolve = resolve; audioEl.onended = resolve; audioEl.onpause = resolve; });
  }

  return {
    get supported() { return browserOK || premium; },
    get on() { return this.supported && settings.voice; },
    get premium() { return premium; },
    setPremium(v) { premium = !!v; listeners.forEach((fn) => fn()); },
    get description() { return premium ? 'ElevenLabs character voice' : chosen ? chosen.name : 'none'; },
    get natural() { return premium || (chosen && isNatural(chosen)); },
    list: englishVoices,
    get current() { return chosen; },
    onChange(fn) { listeners.add(fn); },
    refresh: choose,
    speak(text) {
      this.stop();
      if (!this.on || !text) return Promise.resolve();
      const token = { cancelled: false, resolve: null };
      current = token;
      if (premium) return speakPremium(text, token).catch(() => (token.cancelled ? undefined : speakBrowser(text, token)));
      return speakBrowser(text, token);
    },
    stop() {
      if (current) { current.cancelled = true; current.resolve && current.resolve(); current = null; }
      if (browserOK) speechSynthesis.cancel();
      if (audioEl && !audioEl.paused) audioEl.pause();
    },
    get speaking() {
      return (browserOK && speechSynthesis.speaking) || (!!audioEl && !audioEl.paused && !audioEl.ended);
    },
    // 0..1 mouth openness: real loudness for premium audio, word pulses for browser speech.
    level(dt) {
      let target = 0;
      if (audioEl && !audioEl.paused && analyser) {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) { const v = (samples[i] - 128) / 128; sum += v * v; }
        target = Math.min(1, Math.sqrt(sum / samples.length) * 5);
      } else if (browserOK && speechSynthesis.speaking) {
        pulse = Math.max(0, pulse - dt * 4);
        target = 0.25 + pulse * 0.6;
      }
      level += (target - level) * Math.min(1, dt * 18);
      return level;
    },
  };
})();
