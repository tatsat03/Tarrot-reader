# The Oracle's Chamber

A 3D tarot game about self-exploration. You wander a moonlit carnival — the Midnight Fair — and
step into its tents, where Seraphine, Keeper of the Veil, reads the cards with you.

## Play

Double-click **start.bat**. It starts a small local server (keep its window open) and opens
http://localhost:5173 — in Microsoft Edge when it's installed, because Edge has the best free voices.

The camp:

| Place | What it does |
| --- | --- |
| Seraphine's Tent | Begin a reading — alone or as two players, 7 spreads, Major Arcana or all 78 cards, optional reversals |
| The Library Pavilion | Browse all 78 cards, learn the basics, and ask Seraphine about any card |
| The Hall of Memories | Your past readings, saved on this device |
| The Tinker's Wagon | Settings: voice, speaking speed, auto-advance, sound, graphics |
| The Storyteller's Fire | Seraphine's introduction to tarot |

Click a tent, or use ← → and Enter. Dialogue moves on by itself a moment after Seraphine finishes a
line (adjustable in the Wagon); Enter, Space or a click moves on sooner.

## Seraphine's voice

From best to simplest:

1. **ElevenLabs character voice** — add to `.env`:
   ```
   ELEVENLABS_API_KEY=your-key
   ELEVENLABS_VOICE_ID=voice-id-from-the-voice-library   # optional
   ```
   Her mouth then moves with the actual audio.
2. **Microsoft Edge "Natural" voices** — free and very good. Open the game in Edge and pick a voice
   marked "Natural" (for example *Sonia* or *Aria*) in the Tinker's Wagon.
3. **Any other browser** — uses the best voice the browser offers.

## Let Seraphine converse (Claude)

Without an API key, Seraphine runs every reading with scripted replies. With a key she answers your
questions about any card, responds to what you share, and closes each reading with a reflection,
using Claude (`claude-opus-5-5`). Add to `.env`:

```
ANTHROPIC_API_KEY=your-key
```

Restart start.bat; the camp shows **Seraphine is awake · Claude connected**. Keys stay on your machine:
the browser only talks to the local server, which adds them to outgoing requests and never serves
`.env`. `.env` is git-ignored.

## What's inside

| Path | What it holds |
| --- | --- |
| `data/deck.js` | All 78 cards (meanings, reversals, imagery, questions) and the seven spreads |
| `src/village.js` | The camp: tents, fire, lights, labels, camera moves |
| `src/reading.js` | The reading flow |
| `src/library.js` | The Library of Cards and per-card chat |
| `src/agent.js` | Seraphine's persona prompt for Claude, plus offline fallbacks |
| `src/audio.js` | Ambient sound and Seraphine's voice |
| `src/ui.js` | Dialogue (auto-advance, Enter to continue), panels |
| `src/textures.js` | Procedurally painted card art |
| `src/room.js`, `src/oracle.js`, `src/cards.js` | The chamber, Seraphine, and the cards |
| `serve.ps1` | Static file server + Claude and ElevenLabs proxy (PowerShell, no installs needed) |
