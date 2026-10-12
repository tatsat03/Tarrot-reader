# The Oracle's Chamber

A 3D tarot game about self-exploration. You wander a moonlit carnival — the Midnight Fair — and
step into its tents, where Seraphine, Keeper of the Veil, reads the cards with you.

## Play

Double-click **start.bat**. It starts a small local server (keep its window open) and opens
http://localhost:5173 — in Microsoft Edge when it's installed, because Edge has the best free voices.

The camp:

| Place | What it does |
| --- | --- |
| Seraphine's Tent | A big top full of reading stalls — pick a stall to start that reading, alone or with a companion |
| The Library Pavilion | Browse all 78 cards, learn the basics, and ask Seraphine about any card |
| The Hall of Memories | Your past readings, saved on this device |
| The Tinker's Wagon | Settings: Major Arcana or all 78 cards, reversed cards, voice, auto-advance, sound, graphics |
| The Storyteller's Fire | Seraphine's introduction to tarot |

Click a tent, or use ← → and Enter. Inside the big top:

| Stall | Reading |
| --- | --- |
| The Daily Draw | One card for guidance |
| The Hourglass | Past · Present · Future |
| The Mirror Booth | What you carry, what you face, what you may become |
| The Three Lanterns | Mind · Body · Spirit |
| The Crossroads | A decision between two paths |
| The Lovers' Booth | The relationship spread, for two |
| Seraphine's Great Table | The ten-card Celtic Cross |

Dialogue moves on by itself a moment after Seraphine finishes a line (adjustable in the Wagon); Enter,
Space or a click moves on sooner.

## Travelers

When you enter the fair you choose who's visiting, create a new traveler, or continue as a guest. A traveler
has a name, birthdate, pronouns, what they'd like to explore and anything Seraphine should know. From the
birthdate the game works out age, sun sign, life path number and tarot birth card(s) (Mary K. Greer's
method). Seraphine greets travelers by name, notices when their birth card or sun-sign card appears or a
card keeps returning across readings, and keeps a journal of their readings in the Hall of Memories.
With Claude connected she also gets the profile and recent readings as context.

Profiles live only in this browser. Guests leave no trace: their readings aren't saved. Deleting a traveler
also deletes their readings. Switch travelers any time from the name chip in the top-right corner.

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
| `src/village.js` | The camp: tents, fire, lights |
| `src/bazaar.js` | The big top and its reading stalls |
| `src/hub.js` | Shared hub behaviour: floating labels, hover, keyboard, camera moves |
| `src/profiles.js` | Travelers: storage, guest mode, sun sign, life path, birth cards |
| `src/reading.js` | The reading flow |
| `src/library.js` | The Library of Cards and per-card chat |
| `src/agent.js` | Seraphine's persona prompt for Claude, plus offline fallbacks |
| `src/audio.js` | Ambient sound and Seraphine's voice |
| `src/ui.js` | Dialogue (auto-advance, Enter to continue), panels |
| `src/textures.js` | Procedurally painted card art |
| `src/room.js`, `src/oracle.js`, `src/cards.js` | The chamber, Seraphine, and the cards |
| `serve.ps1` | Static file server + Claude and ElevenLabs proxy (PowerShell, no installs needed) |
