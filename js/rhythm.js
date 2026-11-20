// What the games played to music share: a tune from Key Mania's composer with its clock and its sound,
// and the way a run is scored.
import { drawIcons } from './util.js';
import { MAX_SCORE, grade, makeSong, semitones } from './games/mania.js';
import { createSynth } from './synth.js';

export { MAX_SCORE, grade, semitones };
const MUTE_KEY = 'arcade:mute'; // one switch for every game with music
const WEIGHT = { perfect: 1, great: 0.75, good: 0.4, miss: 0 }; // share of the points a hit is worth
const wall = () => performance.now() / 1000;

// Keeps the score of a run in which `total` things get judged. Four fifths of the score are for how
// well the notes were hit, one fifth for the longest unbroken chain of hits.
export function createTally(total) {
  const tally = { total, score: 0, combo: 0, maxCombo: 0, judged: 0, accuracy: 1, counts: { perfect: 0, great: 0, good: 0, miss: 0 } };
  let weights = 0;
  tally.add = (kind) => {
    tally.counts[kind]++; tally.judged++; weights += WEIGHT[kind];
    tally.combo = kind === 'miss' ? 0 : tally.combo + 1;
    tally.maxCombo = Math.max(tally.maxCombo, tally.combo);
    tally.accuracy = weights / tally.judged;
    tally.score = Math.round(MAX_SCORE * (0.8 * weights + 0.2 * tally.maxCombo) / total);
    return kind;
  };
  tally.summary = () => `Grade ${grade(tally.accuracy)} · ${(tally.accuracy * 100).toFixed(1)}% · best combo ${tally.maxCombo} · ${tally.counts.miss} missed`;
  return tally;
}

// The tune and its clock. The game asks now() for the time of the song in seconds and draws by it; the
// sound follows the same clock. `soundButton` becomes the switch for the sound.
export function createTransport(api, soundButton, onResume = () => {}) {
  let song = null, state = 'idle', t0 = 0, frozen = 0, synth = null, muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode: the sound simply stays on */ }
  function showSound() {
    soundButton.innerHTML = `<i data-lucide="${muted ? 'volume-x' : 'volume-2'}"></i>`;
    soundButton.title = muted ? 'Sound is off' : 'Sound is on';
    drawIcons();
  }
  soundButton.addEventListener('click', () => {
    muted = !muted; soundButton.blur();
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* fine */ }
    if (synth) synth.mute(muted);
    showSound();
  });
  showSound();

  const tr = {
    get song() { return song; },
    get state() { return state; }, // idle → play ⇄ paused → done
    now: () => (state === 'play' ? wall() - t0 : frozen),
    // Composes a new tune and waits for begin().
    load(mode, random) {
      tr.close();
      song = makeSong(mode, random); state = 'idle'; frozen = 0;
      return song;
    },
    // Starts the tune. Has to be called from a click or a key press: browsers allow sound only then.
    begin() {
      if (state !== 'idle') return false;
      state = 'play'; t0 = wall();
      synth = createSynth();
      if (synth) { synth.mute(muted); synth.wake(); }
      return true;
    },
    wake() { if (synth) synth.wake(); },
    // Call on every frame: hands the sound that is due to the sound card. True once the tune is over.
    tick() {
      if (state !== 'play') return false;
      const t = tr.now();
      if (synth) synth.feed(song.sounds, t);
      if (t < song.length) return false;
      state = 'done'; frozen = song.length;
      return true;
    },
    pause() {
      if (state !== 'play') return;
      frozen = tr.now(); state = 'paused';
      if (synth) synth.pause();
      api.overlay({ title: 'Paused', text: 'Enter or Space to continue', icon: 'pause', button: 'Resume', onClick: () => {
        t0 = wall() - frozen; state = 'play';
        if (synth) synth.resume();
        onResume();
      } });
    },
    close() { if (synth) { synth.close(); synth = null; } },
  };
  return tr;
}
