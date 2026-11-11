import { drawIcons, fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- tuning
const KEYS = ['d', 'f', 'j', 'k'];
const ARROWS = { ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
export const WINDOWS = { perfect: 0.05, great: 0.095, good: 0.14 }; // how many seconds early or late still counts
const WEIGHT = { perfect: 1, great: 0.75, good: 0.4, miss: 0 };     // share of a note's points
const RELEASE_SLACK = 0.14;                                         // a long note may be let go this much before its end
export const MAX_SCORE = 100000;
const VOLUME = 0.6;
// bpm: tempo · bars: length of the tune · approach: seconds a note takes to fall to the line
// doubles: chance of two notes at once on the first beat of a bar
const MODES = {
  easy: { bpm: 96, bars: 20, approach: 1.3, doubles: 0 },
  normal: { bpm: 122, bars: 24, approach: 1.05, doubles: 0.3 },
  hard: { bpm: 146, bars: 32, approach: 0.85, doubles: 0.55 },
};
// One bar is 16 steps; x marks a note of the melody. A bar from ENDINGS closes every eight-bar part.
const RHYTHMS = {
  easy: ['x...x...x...x...', 'x...x...x.x.x...', 'x.x.x...x...x...', 'x...x.x.x...x...', 'x.......x...x...', 'x.x.x.x.x...x...'],
  normal: ['x.x.x.x.x.x.x...', 'x...x.x.x.xxx...', 'x.xxx...x.x.x.x.', 'x.x...x.x.x.x...', 'x..x..x.x..x..x.', 'x.......x.x.x.x.', 'x.x.xxx.x.x.x...'],
  hard: ['x.xxx.xxx.xxx.x.', 'xxxxx.x.xxxxx.x.', 'x.x.xxxxx.x.xxxx', 'x..x..x.x..x..xx', 'xxx.xxx.xxx.x.x.', 'x.xxx.x.x.xxx.x.', 'x.xxx.xxx.x.xxxx'],
};
const ENDINGS = {
  easy: ['x...x...x.......', 'x.x.x...x.......'],
  normal: ['x.x.x.x.x.......', 'x.xxx.x.x.......'],
  hard: ['xxxxx.xxx.......', 'x.xxxxxxx.......'],
};
const DRUMS = {
  easy: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  normal: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  hard: { kick: 'x.....x.x.x.....', snare: '....x.......x...', hat: 'x.x.x.xxx.x.x.xx' },
};
const BASS = { easy: 'r.......r.....r.', normal: 'r.r.r.r.r.r.r.5.', hard: 'r.r.o.r.r.r.o.5.' }; // r root, o an octave up, 5 the fifth
const SCALE = [0, 2, 3, 5, 7, 8, 10];                                                          // natural minor
const CHORDS = [[0, 5, 2, 6], [0, 3, 5, 4], [0, 6, 5, 6], [5, 6, 0, 0], [0, 2, 6, 5], [0, 5, 3, 6]]; // one chord per bar
const semitones = (degree) => 12 * Math.floor(degree / 7) + SCALE[((degree % 7) + 7) % 7];

// ---------------------------------------------------------------- composing a tune (nothing is played or drawn here)
// Returns the notes to hit and every sound of the backing track, both made from the same melody, so
// the notes always land exactly on the music. `random` decides the tune: same numbers, same tune.
export function makeSong(modeId, random = Math.random) {
  const mode = MODES[modeId], beat = 60 / mode.bpm, step = beat / 4, bar = beat * 4, start = 0.5;
  const pick = (list) => list[Math.floor(random() * list.length)];
  const bassRoot = 33 + Math.floor(random() * 8), leadRoot = bassRoot + 24;
  const sounds = [], notes = [];
  const sound = (t, kind, extra) => sounds.push({ t, kind, vel: 1, ...extra });
  const hits = (pattern) => [...pattern].map((c, i) => (c === '.' ? -1 : i)).filter((i) => i >= 0);

  // A melody shape for one bar: steps up and down the scale, landing on chord notes on the strong beats.
  function contour(pattern) {
    let d = pick([0, 2, 4]), dir = random() < 0.5 ? 1 : -1;
    return hits(pattern).map((st, k) => {
      if (k) {
        if (random() < 0.3) dir = -dir;
        d += dir * (random() < 0.75 ? 1 : 2);
        if (st % 8 === 0) d = [0, 2, 4, 7].reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a));
        if (d > 8) { d -= 2; dir = -1; }
        if (d < -1) { d += 2; dir = 1; }
      }
      return d;
    });
  }
  // Two parts (A and B), each with its own chords and three bar patterns that keep coming back.
  const parts = [0, 1].map(() => {
    const pool = RHYTHMS[modeId].slice(), bars = [];
    for (let i = 0; i < 3; i++) bars.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    bars.push(pick(ENDINGS[modeId]));
    return { chords: pick(CHORDS), bars, shapes: bars.map(contour) };
  });

  for (let b = 0; b < 4; b++) sound(start + b * beat, 'tick', { vel: b ? 0.7 : 1 }); // one bar to count in

  const freeAt = [0, 0, 0, 0];
  let lane = 1 + Math.floor(random() * 2), prevPitch = null;
  // Puts a note into the wanted lane, or into the nearest lane where it is not too close to the note before.
  function place(t, want, len) {
    const order = [want, want + 1, want - 1, want + 2, want - 2, want + 3, want - 3].filter((l) => l >= 0 && l < 4);
    const l = order.find((x) => freeAt[x] <= t + 1e-6);
    if (l === undefined) return -1;
    freeAt[l] = len ? t + len + 0.4 : t + 0.19;
    notes.push({ t, lane: l, len });
    return l;
  }

  for (let i = 0; i < mode.bars; i++) {
    const T = start + (i + 1) * bar, part = parts[Math.floor(i / 8) % 2], pos = i % 8, last = i === mode.bars - 1;
    const which = last || pos === 7 ? 3 : [0, 1, 0, 2, 0, 1, 0][pos];
    const root = part.chords[i % 4], bassNote = bassRoot + semitones(root) - (semitones(root) > 7 ? 12 : 0);

    const d = DRUMS[modeId], fill = pos === 7 || last;
    for (const s of hits(d.kick)) sound(T + s * step, 'kick');
    for (const s of hits(fill ? '....x.......xxxx' : d.snare)) sound(T + s * step, 'snare', { vel: s > 12 ? 0.55 + (s - 12) * 0.15 : 1 });
    for (const s of hits(d.hat)) sound(T + s * step, 'hat', { vel: s % 4 === 0 ? 1 : 0.6 });
    if (pos === 0) sound(T, 'crash');

    const bassHits = hits(BASS[modeId]);
    bassHits.forEach((s, k) => {
      const gap = (bassHits[k + 1] ?? 16) - s, c = BASS[modeId][s];
      sound(T + s * step, 'bass', { midi: bassNote + (c === 'o' ? 12 : c === '5' ? 7 : 0), dur: Math.min(0.5, gap * step * 0.85) });
    });
    for (const tone of [0, 2, 4]) sound(T, 'pad', { midi: bassRoot + 12 + semitones(root + tone) - (root > 3 ? 12 : 0), dur: bar * 0.95 });

    // the melody of this bar: what you hear and what you have to hit
    const steps = hits(part.bars[which]), shape = part.shapes[which];
    const high = Math.max(...shape) + root, low = Math.min(...shape) + root;
    const octave = high > 11 ? -7 : low < -1 ? 7 : 0;
    steps.forEach((s, k) => {
      const t = T + s * step, gap = (steps[k + 1] ?? 16) - s;
      const pitch = leadRoot + semitones(root + shape[k] + octave);
      const len = gap >= 6 ? (gap - 2) * step : 0; // a long gap makes a long note
      sound(t, 'lead', { midi: pitch, dur: len || Math.min(gap, 2) * step * 0.92 });
      if (prevPitch !== null && pitch !== prevPitch) { // higher notes go to the right, lower ones to the left, round and round
        const jump = Math.sign(pitch - prevPitch) * (Math.abs(pitch - prevPitch) > 4 ? 2 : 1);
        lane = (lane + jump + 4) % 4;
      }
      prevPitch = pitch;
      const got = place(t, lane, len);
      if (got >= 0) lane = got;
      const chance = s === 0 ? mode.doubles : s === 8 && modeId === 'hard' ? mode.doubles / 2 : 0;
      if (got >= 0 && random() < chance) place(t, 3 - got, 0);
    });
  }

  // the last chord
  const end = start + (mode.bars + 1) * bar, home = parts[0].chords[0];
  sound(end, 'kick'); sound(end, 'crash');
  sound(end, 'bass', { midi: bassRoot + semitones(home), dur: beat * 2 });
  for (const tone of [0, 2, 4]) sound(end, 'pad', { midi: bassRoot + 12 + semitones(home + tone), dur: beat * 2 });
  sound(end, 'lead', { midi: leadRoot + semitones(home + 7), dur: beat * 1.5 });
  const a = place(end, modeId === 'easy' ? 1 + Math.floor(random() * 2) : 0, 0);
  if (modeId !== 'easy' && a >= 0) place(end, 3 - a, 0);

  sounds.sort((x, y) => x.t - y.t);
  notes.sort((x, y) => x.t - y.t || x.lane - y.lane);
  return { mode: modeId, bpm: mode.bpm, beat, approach: mode.approach, firstBar: start + bar, notes, sounds, length: end + 2.2 };
}

// ---------------------------------------------------------------- judging (nothing is drawn here either)
// Keeps track of which notes were hit and how well. All times are seconds on the song clock.
// A long note is judged twice: when it is pressed and when it has been held to its end.
export function createRun(chart) {
  const notes = chart.map((n) => ({ ...n, state: 'wait' })); // wait → held → done, or missed / dropped
  const lanes = [0, 1, 2, 3].map((l) => notes.filter((n) => n.lane === l));
  const next = [0, 0, 0, 0];
  // events: everything that was judged since the screen last looked ({ kind, lane, tail? })
  const run = { notes, events: [], score: 0, combo: 0, maxCombo: 0, judged: 0, total: notes.reduce((a, n) => a + (n.len ? 2 : 1), 0), accuracy: 1, counts: { perfect: 0, great: 0, good: 0, miss: 0 } };
  let weights = 0;
  function judge(kind, lane, tail) {
    run.counts[kind]++; run.judged++; weights += WEIGHT[kind];
    run.combo = kind === 'miss' ? 0 : run.combo + 1;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.accuracy = weights / run.judged;
    run.score = Math.round(MAX_SCORE * (0.8 * weights + 0.2 * run.maxCombo) / run.total);
    const event = { kind, lane, tail: !!tail };
    run.events.push(event);
    return event;
  }
  // Notes that slipped past without being pressed, and long notes that were held all the way.
  run.update = (t) => {
    for (let l = 0; l < 4; l++) {
      for (let n = lanes[l][next[l]]; n; n = lanes[l][next[l]]) {
        if (n.state === 'wait' && t > n.t + WINDOWS.good) {
          n.state = 'missed'; judge('miss', l);
          if (n.len) judge('miss', l, true);
        } else if (n.state === 'held' && t >= n.t + n.len) {
          n.state = 'done'; judge('perfect', l, true);
        } else break;
        next[l]++;
      }
    }
  };
  // A key goes down. Returns how good the hit was, or null when there was nothing to hit.
  run.press = (lane, t) => {
    run.update(t);
    const n = lanes[lane][next[lane]];
    if (!n || n.state !== 'wait' || t < n.t - WINDOWS.good) return null;
    const off = Math.abs(t - n.t), kind = off <= WINDOWS.perfect ? 'perfect' : off <= WINDOWS.great ? 'great' : 'good';
    if (n.len) n.state = 'held'; else { n.state = 'done'; next[lane]++; }
    return judge(kind, lane);
  };
  // A key goes up. Only matters while a long note is being held.
  run.release = (lane, t) => {
    run.update(t);
    const n = lanes[lane][next[lane]];
    if (!n || n.state !== 'held') return null;
    const kept = t >= n.t + n.len - RELEASE_SLACK;
    n.state = kept ? 'done' : 'dropped'; next[lane]++;
    return judge(kept ? 'perfect' : 'miss', lane, true);
  };
  return run;
}
export const grade = (accuracy) => (accuracy >= 1 ? 'SS' : accuracy >= 0.95 ? 'S' : accuracy >= 0.9 ? 'A' : accuracy >= 0.8 ? 'B' : accuracy >= 0.7 ? 'C' : 'D');

// ---------------------------------------------------------------- sound
// A tiny synthesizer: drums, bass, soft chords and a lead voice. Returns null where sound is not available;
// the game then simply runs silently.
function createSynth() {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac;
  try { ac = new AC(); } catch { return null; }
  const master = ac.createGain(), limiter = ac.createDynamicsCompressor();
  // the limiter only catches the loudest peaks, so the drums do not push the melody down
  limiter.threshold.value = -8; limiter.knee.value = 6; limiter.ratio.value = 8; limiter.attack.value = 0.003; limiter.release.value = 0.12;
  master.gain.value = VOLUME; master.connect(limiter); limiter.connect(ac.destination);
  const bus = (cutoff) => { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.connect(master); return f; };
  const leadBus = bus(2800), bassBus = bus(480), padBus = bus(1400);
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

  function tone(out, type, freq, when, dur, peak, attack = 0.006, release = 0.07) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + attack);
    g.gain.linearRampToValueAtTime(peak * 0.75, when + attack + Math.min(0.09, dur));
    g.gain.setValueAtTime(peak * 0.75, when + attack + dur);
    g.gain.linearRampToValueAtTime(0.0001, when + attack + dur + release);
    o.connect(g); g.connect(out);
    o.start(when); o.stop(when + attack + dur + release + 0.02);
  }
  function burst(when, dur, peak, type, freq) { // a short piece of filtered noise
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noise; src.loop = true; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(peak, when); g.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(when, Math.random() * 0.5); src.stop(when + dur + 0.02);
  }
  function play(s, when) {
    const v = s.vel;
    if (s.kind === 'kick') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(165, when); o.frequency.exponentialRampToValueAtTime(46, when + 0.11);
      g.gain.setValueAtTime(0.8 * v, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.27);
      o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.3);
    } else if (s.kind === 'snare') { burst(when, 0.17, 0.42 * v, 'highpass', 1600); tone(master, 'triangle', 190, when, 0.03, 0.3 * v, 0.002, 0.06); }
    else if (s.kind === 'hat') burst(when, 0.045, 0.2 * v, 'highpass', 8000);
    else if (s.kind === 'crash') burst(when, 1.1, 0.24 * v, 'highpass', 4500);
    else if (s.kind === 'tick') tone(master, 'square', 1100, when, 0.02, 0.16 * v, 0.002, 0.03);
    else if (s.kind === 'bass') tone(bassBus, 'sawtooth', hz(s.midi), when, s.dur, 0.34 * v, 0.008, 0.06);
    else if (s.kind === 'pad') tone(padBus, 'triangle', hz(s.midi), when, s.dur, 0.085 * v, 0.06, 0.25);
    else if (s.kind === 'lead') tone(leadBus, 'square', hz(s.midi), when, s.dur, 0.2 * v);
  }

  let next = 0, gapToWall = null;
  return {
    // Hands the sounds that are due in the next moments to the browser. The game runs on its own clock;
    // the sound follows it, so a hiccup in the audio can never freeze the notes.
    feed(sounds, songNow) {
      if (ac.state !== 'running') return;
      const wall = performance.now() / 1000, gap = wall - ac.currentTime;
      gapToWall = gapToWall === null || Math.abs(gap - gapToWall) > 0.06 ? gap : gapToWall + (gap - gapToWall) * 0.03;
      const audioNow = wall - gapToWall, lag = Math.min(0.35, ac.outputLatency || ac.baseLatency || 0); // time the sound needs to reach the ears
      while (next < sounds.length && sounds[next].t < songNow + 0.2 + lag) {
        const s = sounds[next++], when = audioNow + (s.t - songNow) - lag;
        if (when > ac.currentTime - 0.04) play(s, Math.max(when, ac.currentTime));
      }
    },
    mute(on) { master.gain.value = on ? 0 : VOLUME; },
    wake() { if (ac.state !== 'running') ac.resume().catch(() => {}); },
    pause() { ac.suspend().catch(() => {}); },
    resume() { gapToWall = null; ac.resume().catch(() => {}); },
    close() { ac.close().catch(() => {}); },
    get running() { return ac.state === 'running'; },
  };
}

// ---------------------------------------------------------------- the game on screen
const HEAD = ['#818cf8', '#22d3ee', '#22d3ee', '#818cf8'];  // colour of the notes in each lane
const BODY = ['#3f4494', '#0e6a7c', '#0e6a7c', '#3f4494'];  // the tail of a long note
const JUDGE = { perfect: ['PERFECT', '#fde047'], great: ['GREAT', '#4ade80'], good: ['GOOD', '#60a5fa'], miss: ['MISS', '#f87171'] };
const LINE = 0.84;                                          // where the hit line sits, as a share of the height
const wall = () => performance.now() / 1000;
const MUTE_KEY = 'arcade:mute';

export default {
  id: 'mania', name: 'Key Mania', icon: 'keyboard-music', color: '#818cf8', tag: 'Rhythm',
  desc: 'Notes fall down four lanes: hit each one right on the beat. A new tune every round.',
  help: 'D F J K or the arrow keys · on a phone tap the lanes · keep long notes held · P to pause',
  variants: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="mn-top">
        <div class="seg" id="mn-mode">${Object.entries(this.variants).map(([id, name]) => `<button data-m="${id}">${name}</button>`).join('')}</div>
        <button class="btn-icon" id="mn-snd" aria-label="Sound on or off"></button>
      </div>
      <canvas class="mania" id="mn-c"></canvas>`;
    const cv = stage.querySelector('#mn-c'), ctx = cv.getContext('2d'), sndBtn = stage.querySelector('#mn-snd');
    const modeBtns = [...stage.querySelectorAll('#mn-mode button')];
    const font = getComputedStyle(document.body).fontFamily;
    let W = 1, H = 1;
    let song, run, state, t0 = 0, frozen = 0, synth = null, endTimer = null, shown = '';
    let muted = false;
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode: sound simply stays on */ }
    const down = [new Set(), new Set(), new Set(), new Set()]; // what is holding each lane: the keyboard or a finger
    let sparks = [], verdict = null, comboAt = 0;

    const now = () => (state === 'play' ? wall() - t0 : frozen);

    function reset() {
      clearTimeout(endTimer); api.hideOverlay();
      if (synth) { synth.close(); synth = null; }
      const mode = MODES[api.variant()] ? api.variant() : 'easy';
      song = makeSong(mode); run = createRun(song.notes);
      state = 'idle'; frozen = 0; sparks = []; verdict = null; shown = '';
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      api.score(0);
      api.status(`${song.bpm} BPM · ${song.notes.length} notes`);
    }
    function begin() {
      if (state !== 'idle') return;
      state = 'play'; t0 = wall();
      synth = createSynth();
      if (synth) { synth.mute(muted); synth.wake(); }
    }
    function pause() {
      if (state !== 'play') return;
      frozen = now(); state = 'paused';
      if (synth) synth.pause();
      api.overlay({ title: 'Paused', text: 'Enter or Space to continue', icon: 'pause', button: 'Resume', onClick: () => {
        t0 = wall() - frozen; state = 'play';
        if (synth) synth.resume();
        for (let l = 0; l < 4; l++) if (!down[l].size) run.release(l, frozen); // a long note that was let go meanwhile
      } });
    }
    function press(lane, source) {
      down[lane].add(source);
      if (synth) synth.wake();
      if (state === 'idle' && typeof source === 'string') begin(); // a key starts the tune; a finger does it with a whole tap
      else if (state === 'play') run.press(lane, now());
    }
    function release(lane, source) {
      if (!down[lane].delete(source) || down[lane].size) return;
      if (state === 'play') run.release(lane, now());
    }
    function showSound() {
      sndBtn.innerHTML = `<i data-lucide="${muted ? 'volume-x' : 'volume-2'}"></i>`;
      sndBtn.title = muted ? 'Sound is off' : 'Sound is on';
      drawIcons();
    }

    // ---- drawing
    function box(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
    function label(text, x, y, size, color, weight = 700) {
      ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color; ctx.fillText(text, x, y);
    }
    function draw() {
      const t = now(), w = wall(), lw = W / 4, y0 = H * LINE, nh = Math.max(8, Math.round(H * 0.032)), speed = y0 / song.approach;
      const yOf = (time) => y0 - (time - t) * speed;
      ctx.fillStyle = '#11141c'; ctx.fillRect(0, 0, W, H);

      for (let l = 0; l < 4; l++) { // a glow in the lanes that are held down
        if (!down[l].size) continue;
        const g = ctx.createLinearGradient(0, y0, 0, y0 - H * 0.45);
        g.addColorStop(0, HEAD[l] + '38'); g.addColorStop(1, HEAD[l] + '00');
        ctx.fillStyle = g; ctx.fillRect(l * lw, y0 - H * 0.45, lw, H * 0.45 + (H - y0));
      }
      ctx.fillStyle = '#1c2130';
      for (let l = 1; l < 4; l++) ctx.fillRect(Math.round(l * lw) - 1, 0, 2, H);
      if (state !== 'idle') { // a faint line at every bar
        ctx.fillStyle = '#1a1f2c';
        const bar = song.beat * 4, first = Math.max(0, Math.ceil((t - 0.3 - song.firstBar) / bar));
        for (let k = first; ; k++) { const y = yOf(song.firstBar + k * bar); if (y < 0 || song.firstBar + k * bar > song.length - 2) break; ctx.fillRect(0, Math.round(y) - 1, W, 2); }
      }

      // combo, verdict and count-in sit behind the notes so they never hide one
      if (run.combo >= 5) {
        const pop = 1 + Math.max(0, 0.12 - (w - comboAt)) * 1.4;
        label(String(run.combo), W / 2, H * 0.3, H * 0.11 * pop, '#262c3d', 800);
        label('COMBO', W / 2, H * 0.3 + H * 0.075, H * 0.026, '#262c3d', 700);
      }
      if (verdict && w - verdict.at < 0.55) {
        const age = w - verdict.at, [text, color] = JUDGE[verdict.kind];
        ctx.globalAlpha = Math.min(1, (0.55 - age) / 0.25);
        label(text, W / 2, H * 0.52 - Math.min(age, 0.1) * H * 0.12, H * 0.05, color, 800);
        ctx.globalAlpha = 1;
      }
      if (state !== 'idle' && t < song.firstBar - 0.05) {
        const n = Math.ceil((song.firstBar - t) / song.beat);
        if (n <= 4) label(String(n), W / 2, H * 0.4, H * 0.16, '#3a4258', 800);
      }

      // the hit line with one pad per lane
      for (let l = 0; l < 4; l++) {
        const x = l * lw + lw * 0.08, on = down[l].size > 0;
        box(x, y0 - nh / 2, lw * 0.84, nh, nh * 0.4);
        ctx.fillStyle = on ? HEAD[l] + '55' : '#161a24'; ctx.fill();
        ctx.lineWidth = Math.max(1.5, H * 0.004); ctx.strokeStyle = on ? HEAD[l] : '#39415a'; ctx.stroke();
        label('DFJK'[l], (l + 0.5) * lw, y0 + (H - y0) * 0.56, H * 0.042, on ? '#e4e4e7' : '#5b6378', 700);
      }
      sparks = sparks.filter((s) => w - s.at < 0.28);
      for (const s of sparks) { // a ring that opens up where a note was hit
        if (s.kind === 'miss') continue;
        const k = (w - s.at) / 0.28, grow = lw * 0.16 * k;
        ctx.globalAlpha = 1 - k; ctx.lineWidth = Math.max(2, H * 0.006); ctx.strokeStyle = JUDGE[s.kind][1];
        box(s.lane * lw + lw * 0.08 - grow, y0 - nh / 2 - grow, lw * 0.84 + grow * 2, nh + grow * 2, nh * 0.4 + grow); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // the notes
      for (const n of run.notes) {
        if (n.t - t > song.approach + 0.1) break;
        if (n.state === 'done' || n.t + n.len - t < -0.45) continue;
        const lost = n.state === 'missed' || n.state === 'dropped';
        const x = n.lane * lw + lw * 0.08, wd = lw * 0.84;
        const yHead = n.state === 'held' ? y0 : yOf(n.t);
        if (n.len) {
          const yTail = Math.min(yHead, yOf(n.t + n.len));
          ctx.fillStyle = lost ? '#2a3040' : BODY[n.lane];
          box(x + wd * 0.13, yTail - nh / 2, wd * 0.74, yHead - yTail + nh / 2, nh * 0.4); ctx.fill();
        }
        if (n.state === 'dropped') continue;
        ctx.fillStyle = lost ? '#3b4257' : HEAD[n.lane];
        box(x, yHead - nh / 2, wd, nh, nh * 0.4); ctx.fill();
      }

      if (state === 'idle') {
        ctx.fillStyle = 'rgba(17,20,28,.55)'; ctx.fillRect(0, 0, W, y0 - nh);
        label('Press D, F, J or K', W / 2, H * 0.36, H * 0.05, '#e4e4e7', 700);
        label('or tap here to start', W / 2, H * 0.36 + H * 0.062, H * 0.036, '#8f98ad', 500);
      } else { // how far into the tune we are
        ctx.fillStyle = '#242a3a'; ctx.fillRect(0, 0, W, Math.max(2, H * 0.006));
        ctx.fillStyle = '#818cf8'; ctx.fillRect(0, 0, W * Math.min(1, t / song.length), Math.max(2, H * 0.006));
      }
    }

    function frame() {
      if (state === 'play') {
        const t = now();
        if (synth) synth.feed(song.sounds, t);
        run.update(t);
        if (t >= song.length) {
          state = 'done'; frozen = song.length;
          const c = run.counts;
          endTimer = setTimeout(() => api.finish(run.score, {
            endTitle: 'Song finished',
            text: `Grade ${grade(run.accuracy)} · ${(run.accuracy * 100).toFixed(1)}% · best combo ${run.maxCombo} · ${c.miss} missed`,
          }), 300);
        }
      }
      for (const ev of run.events.splice(0)) { // show what was judged since the last frame
        sparks.push({ lane: ev.lane, kind: ev.kind, at: wall() });
        verdict = { kind: ev.kind, at: wall() };
        if (ev.kind !== 'miss') comboAt = wall();
      }
      const line = `${run.score}|${run.combo}|${run.judged}|${state}`;
      if (line !== shown && state !== 'idle') {
        shown = line; api.score(run.score);
        api.status(run.judged ? `Combo ${run.combo} · ${(run.accuracy * 100).toFixed(1)}%` : 'Get ready…');
      }
      draw();
    }

    // ---- input
    const laneAt = (e) => { const r = cv.getBoundingClientRect(); return Math.max(0, Math.min(3, Math.floor((e.clientX - r.left) / r.width * 4))); };
    const fingers = new Map();
    cv.addEventListener('pointerdown', (e) => {
      const lane = laneAt(e);
      fingers.set(e.pointerId, lane);
      try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ }
      press(lane, e.pointerId);
      e.preventDefault();
    });
    const lift = (e) => {
      if (!fingers.has(e.pointerId)) return;
      release(fingers.get(e.pointerId), e.pointerId); fingers.delete(e.pointerId);
      if (synth) synth.wake();
    };
    cv.addEventListener('pointerup', lift);
    cv.addEventListener('pointercancel', lift);
    cv.addEventListener('click', begin); // a whole tap starts the tune (phones only allow sound after one)
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    noScroll(cv);
    stage.querySelector('#mn-mode').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      if (b.dataset.m !== api.variant() || state !== 'idle') { api.variant(b.dataset.m); reset(); }
    });
    sndBtn.addEventListener('click', () => {
      muted = !muted; sndBtn.blur();
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* fine */ }
      if (synth) synth.mute(muted);
      showSound();
    });
    const onBlur = () => { pause(); down.forEach((set) => set.clear()); fingers.clear(); };
    const onHide = () => { if (document.hidden) onBlur(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onHide);

    reset(); showSound();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(frame);

    const laneOf = (e) => (KEYS.includes(e.key) ? KEYS.indexOf(e.key) : ARROWS[e.key]);
    return {
      key(e) {
        if (e.key === 'p') { if (!e.repeat) pause(); return true; }
        if ((e.key === ' ' || e.key === 'Enter') && state === 'idle') { begin(); return true; }
        const lane = laneOf(e);
        if (lane === undefined) return;
        if (!e.repeat) press(lane, 'key:' + e.key);
        return true;
      },
      keyup(e) { const lane = laneOf(e); if (lane !== undefined) release(lane, 'key:' + e.key); },
      restart: reset,
      destroy() {
        stopFit(); stopLoop(); clearTimeout(endTimer);
        if (synth) synth.close();
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('visibilitychange', onHide);
      },
    };
  },
};
