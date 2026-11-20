import { drawIcons, clamp } from '../util.js';
import { createSynth } from '../synth.js';

// ---------------------------------------------------------------- the song (nothing is played or drawn here)
// One bar of sixteen steps. Every row is one sound; a song says which steps of each row are on.
export const STEPS = 16, MIN_BPM = 60, MAX_BPM = 180;
// The melody and the bass use the five notes of A minor pentatonic, which sound right in any order.
export const ROWS = [
  { id: 'm6', group: 'lead', name: 'A', midi: 81 }, { id: 'm5', group: 'lead', name: 'G', midi: 79 }, { id: 'm4', group: 'lead', name: 'E', midi: 76 },
  { id: 'm3', group: 'lead', name: 'D', midi: 74 }, { id: 'm2', group: 'lead', name: 'C', midi: 72 }, { id: 'm1', group: 'lead', name: 'A', midi: 69 },
  { id: 'b4', group: 'bass', name: 'E', midi: 52 }, { id: 'b3', group: 'bass', name: 'D', midi: 50 }, { id: 'b2', group: 'bass', name: 'C', midi: 48 }, { id: 'b1', group: 'bass', name: 'A', midi: 45 },
  { id: 'hat', group: 'drum', name: 'Hat' }, { id: 'clap', group: 'drum', name: 'Clap' }, { id: 'snare', group: 'drum', name: 'Snare' }, { id: 'kick', group: 'drum', name: 'Kick' },
];
const GROUPS = { lead: 'Melody', bass: 'Bass', drum: 'Drums' };
// What a row sounds like when a step lasts `step` seconds.
export function soundOf(row, step) {
  if (row.group === 'lead') return { kind: 'lead', midi: row.midi, dur: step * 0.9, vel: 0.8 };
  if (row.group === 'bass') return { kind: 'bass', midi: row.midi, dur: step * 1.7, vel: 1 };
  return { kind: row.id, vel: row.id === 'hat' ? 0.7 : 1 };
}

const steps = (pattern) => [...pattern.padEnd(STEPS, '.')].slice(0, STEPS).map((c) => c !== '.');
const empty = () => Object.fromEntries(ROWS.map((r) => [r.id, steps('')]));
// A song from its written form: { bpm, rows: { kick: 'x...x...x...x...', … } }. Rows that are not named stay silent.
export function readSong(written) {
  const song = { bpm: clamp(Math.round(Number(written?.bpm) || 110), MIN_BPM, MAX_BPM), rows: empty() };
  for (const r of ROWS) if (typeof written?.rows?.[r.id] === 'string') song.rows[r.id] = steps(written.rows[r.id]);
  return song;
}
export const writeSong = (song) => ({ bpm: song.bpm, rows: Object.fromEntries(ROWS.map((r) => [r.id, song.rows[r.id].map((on) => (on ? 'x' : '.')).join('')])) });

// The beat a new player finds on the board.
export const DEMO = {
  bpm: 112,
  rows: {
    m6: '..............x.', m5: '......x.........', m4: 'x.......x.......', m3: '...x.......x....', m2: '..........x.....', m1: '....x...........',
    b4: '..........x.....', b3: '', b2: '......x.......x.', b1: 'x..x....x..x....',
    hat: 'x.x.x.x.x.x.x.xx', clap: '....x.......x...', snare: '', kick: 'x.....x.x.......',
  },
};

// A new beat that is worth listening to: a drum pattern from a small stock, a bass line that follows
// the kick, and a melody that walks up and down the scale.
export function randomSong(rnd = Math.random) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const rows = Object.fromEntries(ROWS.map((r) => [r.id, Array(STEPS).fill('.')]));
  const put = (id, pattern) => { rows[id] = [...pattern]; };
  put('kick', pick(['x...x...x...x...', 'x.....x.x.......', 'x..x..x.x..x....', 'x.......x.x.....', 'x...x..xx...x...', 'x.x...x.x.....x.']));
  put(rnd() < 0.5 ? 'snare' : 'clap', pick(['....x.......x...', '....x.......x..x', '....x..x....x...']));
  put('hat', pick(['x.x.x.x.x.x.x.x.', '..x...x...x...x.', 'xxxxxxxxxxxxxxxx', 'x.xxx.xxx.xxx.xx', 'x.x.x.x.x.x.x.xx']));
  const bass = ['b1', 'b2', 'b3', 'b4'];
  rows.kick.forEach((c, s) => { if (c === 'x' || (s % 4 === 2 && rnd() < 0.35)) rows[s < 8 || rnd() < 0.5 ? 'b1' : pick(bass)][s] = 'x'; });
  const lead = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
  let at = 2 + Math.floor(rnd() * 3);
  [...pick(['x..x..x.x..x..x.', 'x.x...x.x.x...x.', 'x...x.x...x.x.x.', '..x.x.x...x.x.xx', 'x.xx..x.x.xx..x.'])].forEach((c, s) => {
    if (c !== 'x') return;
    rows[lead[at]][s] = 'x';
    at = clamp(at + pick([-2, -1, -1, 1, 1, 2]), 0, lead.length - 1);
  });
  return readSong({ bpm: 90 + Math.floor(rnd() * 9) * 5, rows: Object.fromEntries(Object.entries(rows).map(([id, r]) => [id, r.join('')])) });
}

// ---------------------------------------------------------------- the game on the page
const SAVE = 'arcade:beats:song';

export default {
  id: 'beats', name: 'Beat Maker', icon: 'drum', color: '#ff7a3d', tag: 'Creative', since: '1.1', noScore: true,
  desc: 'Switch on squares to build a loop of drums, bass and melody. Every note fits, so nothing sounds wrong.',
  help: 'Click or drag across the squares · Space plays and stops · up and down change the tempo · Ctrl+Z undoes · your beat is saved in this browser',
  create(stage) {
    const label = (r) => (r.group === 'drum' ? r.name : `${r.name}<sub>${r.group === 'bass' ? (r.midi < 48 ? 2 : 3) : (r.midi < 72 ? 4 : 5)}</sub>`);
    stage.innerHTML = `
      <div class="beats">
        <div class="bt-bar">
          <button class="btn-primary" id="bt-play"></button>
          <div class="bt-tempo"><button data-d="-5" aria-label="Slower">&minus;</button><output id="bt-bpm"></output><button data-d="5" aria-label="Faster">+</button></div>
          <button class="bt-tool" id="bt-rand"><i data-lucide="shuffle"></i><span>Random</span></button>
          <button class="bt-tool" id="bt-undo"><i data-lucide="undo-2"></i><span>Undo</span></button>
          <button class="bt-tool" id="bt-clear"><i data-lucide="trash-2"></i><span>Clear</span></button>
        </div>
        <div class="bt-board" id="bt-board">
          ${ROWS.map((r, n) => `${n === 0 || ROWS[n - 1].group !== r.group ? `<div class="bt-group">${GROUPS[r.group]}</div>` : ''}
          <div class="bt-row" data-g="${r.group}"><span class="bt-name">${label(r)}</span>${Array.from({ length: STEPS }, (_, s) => `<button class="bt-cell" data-r="${r.id}" data-s="${s}" aria-label="${GROUPS[r.group]} ${r.name}, step ${s + 1}"></button>`).join('')}</div>`).join('')}
        </div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const board = $('bt-board'), playBtn = $('bt-play'), bpmOut = $('bt-bpm'), undoBtn = $('bt-undo');
    const cells = {}; // cells[row id][step]
    board.querySelectorAll('.bt-cell').forEach((c) => { (cells[c.dataset.r] ||= [])[Number(c.dataset.s)] = c; });
    const byId = Object.fromEntries(ROWS.map((r) => [r.id, r]));

    let song;
    try { song = readSong(JSON.parse(localStorage.getItem(SAVE)) || DEMO); } catch { song = readSong(DEMO); }
    const history = [];
    let synth = null, playing = false, timer = null, raf = 0, nextTime = 0, nextStep = 0, shownStep = -1;
    const queue = []; // the steps handed to the sound card that have not been shown yet

    const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(writeSong(song))); } catch { /* private mode: the beat lasts until the page is closed */ } };
    function show() {
      for (const r of ROWS) song.rows[r.id].forEach((on, s) => cells[r.id][s].classList.toggle('on', on));
      bpmOut.textContent = song.bpm + ' BPM';
      undoBtn.disabled = !history.length;
      playBtn.innerHTML = `<i data-lucide="${playing ? 'square' : 'play'}"></i>${playing ? 'Stop' : 'Play'}`;
      drawIcons();
    }
    // Remembers the song as it is, so that the change about to be made can be undone.
    function remember() { history.push(JSON.stringify(writeSong(song))); if (history.length > 50) history.shift(); undoBtn.disabled = false; }
    function undo() {
      if (!history.length) return;
      song = readSong(JSON.parse(history.pop()));
      save(); show();
    }

    function sound() {
      if (!synth) synth = createSynth();
      return synth;
    }
    // Hands the sound card every step that is due in the next moments. Its clock keeps the time, so the
    // beat stays even when the page itself is busy.
    function feed() {
      if (!synth || !synth.running) return;
      const step = 60 / song.bpm / 4;
      if (nextTime < synth.time) nextTime = synth.time + 0.06;
      while (nextTime < synth.time + 0.14) {
        for (const r of ROWS) if (song.rows[r.id][nextStep]) synth.play(soundOf(r, step), nextTime);
        queue.push({ step: nextStep, at: nextTime });
        nextTime += step; nextStep = (nextStep + 1) % STEPS;
      }
    }
    function head(step) {
      if (step === shownStep) return;
      if (shownStep >= 0) for (const r of ROWS) cells[r.id][shownStep].classList.remove('now');
      if (step >= 0) for (const r of ROWS) cells[r.id][step].classList.add('now');
      shownStep = step;
    }
    function frame() {
      if (!playing) return;
      let step = shownStep;
      while (queue.length && queue[0].at <= synth.time) step = queue.shift().step;
      head(step);
      raf = requestAnimationFrame(frame);
    }
    function play() {
      if (playing || !sound()) return;
      playing = true; nextStep = 0; nextTime = 0; queue.length = 0;
      synth.wake().then(() => { if (playing) feed(); });
      timer = setInterval(feed, 25);
      raf = requestAnimationFrame(frame);
      show();
    }
    function stop() {
      if (!playing) return;
      playing = false; clearInterval(timer); cancelAnimationFrame(raf); head(-1);
      show();
    }
    const tempo = (by) => { song.bpm = clamp(song.bpm + by, MIN_BPM, MAX_BPM); save(); show(); };

    // ---- painting: the first square decides whether the stroke switches squares on or off
    let paint = null;
    function touch(cell) {
      const row = cell.dataset.r, s = Number(cell.dataset.s);
      if (song.rows[row][s] === paint) return;
      song.rows[row][s] = paint;
      cell.classList.toggle('on', paint);
      if (paint && !playing && sound()) synth.wake().then(() => synth.play(soundOf(byId[row], 0.14)));
    }
    board.addEventListener('pointerdown', (e) => {
      const cell = e.target.closest('.bt-cell');
      if (!cell || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      remember();
      paint = !song.rows[cell.dataset.r][Number(cell.dataset.s)];
      touch(cell);
    });
    board.addEventListener('pointermove', (e) => {
      if (paint === null) return;
      const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.bt-cell');
      if (cell && board.contains(cell)) touch(cell);
    });
    const lift = () => { if (paint !== null) { paint = null; save(); } };
    window.addEventListener('pointerup', lift); window.addEventListener('pointercancel', lift);
    board.addEventListener('touchmove', (e) => { if (paint !== null && e.cancelable) e.preventDefault(); }, { passive: false });
    // the squares can also be switched with the keyboard: Tab to a square, then Enter
    board.addEventListener('keydown', (e) => {
      const cell = e.target.closest('.bt-cell');
      if (!cell || e.key !== 'Enter') return;
      e.preventDefault(); e.stopPropagation();
      remember(); paint = !song.rows[cell.dataset.r][Number(cell.dataset.s)]; touch(cell); lift();
    });

    playBtn.addEventListener('click', () => { playBtn.blur(); if (playing) stop(); else play(); });
    stage.querySelector('.bt-tempo').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); tempo(Number(b.dataset.d)); } });
    $('bt-rand').addEventListener('click', (e) => { e.currentTarget.blur(); remember(); song = randomSong(); save(); show(); });
    $('bt-clear').addEventListener('click', (e) => { e.currentTarget.blur(); remember(); song = readSong({ bpm: song.bpm }); save(); show(); });
    undoBtn.addEventListener('click', () => { undoBtn.blur(); undo(); });
    const onHide = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onHide);

    show();
    return {
      key(e) {
        if (e.key === ' ') { if (!e.repeat) { if (playing) stop(); else play(); } return true; }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { tempo(e.key === 'ArrowUp' ? 5 : -5); return true; }
      },
      shortcut(e) { if (e.key === 'z') { undo(); return true; } },
      // Restart brings back the beat the game came with.
      restart() { remember(); song = readSong(DEMO); save(); show(); },
      destroy() {
        stop();
        window.removeEventListener('pointerup', lift); window.removeEventListener('pointercancel', lift);
        document.removeEventListener('visibilitychange', onHide);
        if (synth) synth.close();
      },
    };
  },
};
