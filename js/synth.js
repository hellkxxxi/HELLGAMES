// A tiny synthesizer shared by the games that make music: drums, bass, soft chords and lead voices.
// A sound is { kind, vel } plus, for the voices with a pitch, { midi, dur }: the MIDI number of the note
// and its length in seconds.
//   drums   kick, snare, hat, openhat, clap, tom, crash, tick, hit
//   voices  bass, pad, lead, pluck
const VOLUME = 0.6;

// Returns null where sound is not available; the games then simply run silently.
export function createSynth() {
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
    else if (s.kind === 'openhat') burst(when, 0.32, 0.17 * v, 'highpass', 7000);
    else if (s.kind === 'clap') { for (const d of [0, 0.011, 0.023]) burst(when + d, 0.03, 0.26 * v, 'bandpass', 1500); burst(when + 0.034, 0.16, 0.3 * v, 'bandpass', 1300); }
    else if (s.kind === 'tom') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(s.hz || 150, when); o.frequency.exponentialRampToValueAtTime((s.hz || 150) * 0.55, when + 0.2);
      g.gain.setValueAtTime(0.6 * v, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
      o.connect(g); g.connect(master); o.start(when); o.stop(when + 0.32);
    }
    else if (s.kind === 'crash') burst(when, 1.1, 0.24 * v, 'highpass', 4500);
    else if (s.kind === 'tick') tone(master, 'square', 1100, when, 0.02, 0.16 * v, 0.002, 0.03);
    else if (s.kind === 'bass') tone(bassBus, 'sawtooth', hz(s.midi), when, s.dur, 0.34 * v, 0.008, 0.06);
    else if (s.kind === 'pad') tone(padBus, 'triangle', hz(s.midi), when, s.dur, 0.085 * v, 0.06, 0.25);
    else if (s.kind === 'lead') tone(leadBus, 'square', hz(s.midi), when, s.dur, 0.2 * v);
    else if (s.kind === 'pluck') tone(leadBus, 'triangle', hz(s.midi), when, s.dur, 0.34 * v, 0.004, 0.16);
    else if (s.kind === 'hit') { tone(master, 'sine', 880, when, 0.012, 0.22 * v, 0.001, 0.05); burst(when, 0.03, 0.1 * v, 'highpass', 5000); }
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
    // For games that keep their own time: the clock of the sound card, and a sound played at a moment on it
    // (straight away when no moment is given).
    get time() { return ac.currentTime; },
    play(sound, when = 0) { if (ac.state === 'running') play({ vel: 1, ...sound }, Math.max(when, ac.currentTime)); },
    mute(on) { master.gain.value = on ? 0 : VOLUME; },
    // Browsers keep sound off until the player has clicked or pressed something. The promise is kept once the sound is on.
    wake() { return ac.state === 'running' ? Promise.resolve() : ac.resume().catch(() => {}); },
    pause() { ac.suspend().catch(() => {}); },
    resume() { gapToWall = null; ac.resume().catch(() => {}); },
    close() { ac.close().catch(() => {}); },
    get running() { return ac.state === 'running'; },
  };
}
