import { clamp, fitCanvas, loop, noScroll } from '../util.js';

// ---------------------------------------------------------------- the rules (nothing is drawn here)
// A puzzle is a handful of points on a field 1 wide and 1 high, and lines between some of them.
// It is solved when no two lines cross.
export const LEVELS = { easy: 7, medium: 10, hard: 14 }; // how many points
const side = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); // on which side of the line a→b the point c lies
// Do the lines a–b and c–d cross? Lines that merely share an end do not.
export const cross = (a, b, c, d) => side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
// The lines that cross another one, as a list of their places in `lines`.
export function tangled(points, lines) {
  const bad = new Set();
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const [a, b] = lines[i], [c, d] = lines[j];
    if (a !== c && a !== d && b !== c && b !== d && cross(points[a], points[b], points[c], points[d])) { bad.add(i); bad.add(j); }
  }
  return [...bad];
}

// Makes a puzzle that can be solved: the points are scattered and joined by lines that do not cross,
// the shortest first; some lines are then taken away again; and at last the points are put on a
// circle in another order, which tangles everything up.
export function makePuzzle(n, rnd = Math.random) {
  for (;;) {
    const home = [];
    while (home.length < n) { // scattered, but not too close to one another
      const p = [0.08 + rnd() * 0.84, 0.08 + rnd() * 0.84];
      if (home.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.5 / Math.sqrt(n))) home.push(p);
    }
    const pairs = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) pairs.push([a, b]);
    pairs.sort((p, q) => Math.hypot(home[p[0]][0] - home[p[1]][0], home[p[0]][1] - home[p[1]][1]) - Math.hypot(home[q[0]][0] - home[q[1]][0], home[q[0]][1] - home[q[1]][1]));
    let lines = [];
    for (const [a, b] of pairs) if (!lines.some(([c, d]) => a !== c && a !== d && b !== c && b !== d && cross(home[a], home[b], home[c], home[d]))) lines.push([a, b]);
    // thin the web out: down to about two lines a point, as long as every point keeps two lines and all stay joined
    const want = Math.round(n * 1.9), degree = (list, p) => list.filter(([a, b]) => a === p || b === p).length;
    const joined = (list) => { const seen = new Set([0]); for (const stack = [0]; stack.length;) { const p = stack.pop(); for (const [a, b] of list) { const q = a === p ? b : b === p ? a : -1; if (q >= 0 && !seen.has(q)) { seen.add(q); stack.push(q); } } } return seen.size === n; };
    for (let tries = 0; lines.length > want && tries < 200; tries++) {
      const k = Math.floor(rnd() * lines.length), rest = lines.filter((_, i) => i !== k);
      if (degree(rest, lines[k][0]) >= 2 && degree(rest, lines[k][1]) >= 2 && joined(rest)) lines = rest;
    }
    const order = [...Array(n).keys()];
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const points = order.map((_, i) => { const at = order.indexOf(i), angle = at / n * Math.PI * 2 - Math.PI / 2; return [0.5 + Math.cos(angle) * 0.4, 0.5 + Math.sin(angle) * 0.4]; });
    if (tangled(points, lines).length >= Math.min(lines.length, n)) return { points, lines, home }; // properly tangled: otherwise once more
  }
}

// ---------------------------------------------------------------- the game on screen
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default {
  id: 'untangle', name: 'Untangle', icon: 'waypoints', color: '#38bdf8', tag: 'Puzzle', since: '1.1',
  desc: 'A web of lines in a tangle. Drag the knots about until no line crosses another.',
  help: 'Drag the knots with the mouse or a finger · red lines cross another line, green ones are free · the clock starts with the first move',
  scoreLabel: 'Time', lowerBetter: true,
  format: clock,
  variants: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="mn-top"><div class="seg" id="ut-level">${Object.entries(this.variants).map(([id, name]) => `<button data-l="${id}">${name}</button>`).join('')}</div></div>
      <canvas class="untangle" id="ut-c"></canvas>`;
    const cv = stage.querySelector('#ut-c'), ctx = cv.getContext('2d');
    const levelBtns = [...stage.querySelectorAll('#ut-level button')];
    let W = 1, H = 1, puzzle, bad = [], held = -1, moves = 0, t0 = 0, done = false, ticker = null, endTimer = null;
    const PAD = 0.06; // the knots stay this far inside the picture

    function reset() {
      api.hideOverlay(); clearInterval(ticker); clearTimeout(endTimer);
      const level = LEVELS[api.variant()] ? api.variant() : 'easy';
      puzzle = makePuzzle(LEVELS[level]);
      bad = tangled(puzzle.points, puzzle.lines); held = -1; moves = 0; t0 = 0; done = false;
      levelBtns.forEach((b) => b.classList.toggle('on', b.dataset.l === level));
      api.score(0); api.status(`${puzzle.points.length} knots · ${bad.length} tangled`);
    }
    function draw() {
      const X = (p) => p[0] * W, Y = (p) => p[1] * H, unit = Math.min(W, H);
      ctx.fillStyle = '#120a0a'; ctx.fillRect(0, 0, W, H);
      const wrong = new Set(bad);
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(2, unit * 0.008);
      puzzle.lines.forEach(([a, b], i) => {
        ctx.strokeStyle = done ? '#fde047' : wrong.has(i) ? '#ef4444' : '#34d399'; ctx.globalAlpha = wrong.has(i) ? 0.9 : 0.75;
        ctx.beginPath(); ctx.moveTo(X(puzzle.points[a]), Y(puzzle.points[a])); ctx.lineTo(X(puzzle.points[b]), Y(puzzle.points[b])); ctx.stroke();
      });
      ctx.globalAlpha = 1;
      puzzle.points.forEach((p, i) => {
        const r = unit * (i === held ? 0.036 : 0.028);
        ctx.fillStyle = i === held ? '#fff7ed' : '#ff7a3d'; ctx.strokeStyle = '#3b0a0a'; ctx.lineWidth = Math.max(1.5, unit * 0.006);
        ctx.beginPath(); ctx.arc(X(p), Y(p), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }
    function check() {
      bad = tangled(puzzle.points, puzzle.lines);
      api.status(bad.length ? `${bad.length} line${bad.length === 1 ? '' : 's'} tangled` : 'Not a line crosses');
    }
    // ---- input: a knot is taken by its nearest point within reach, a wide reach under a finger
    const at = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r]; };
    cv.addEventListener('pointerdown', (e) => {
      if (done) return;
      e.preventDefault();
      const [x, y, r] = at(e), reach = (e.pointerType === 'mouse' ? 22 : 34) / Math.min(r.width, r.height);
      let best = -1, bestGap = reach;
      puzzle.points.forEach((p, i) => { const gap = Math.hypot((p[0] - x) * r.width, (p[1] - y) * r.height) / Math.min(r.width, r.height); if (gap < bestGap) { best = i; bestGap = gap; } });
      if (best < 0) return;
      held = best;
      try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ }
      if (!t0) { t0 = performance.now(); ticker = setInterval(() => api.score(Math.floor((performance.now() - t0) / 1000)), 250); }
    });
    cv.addEventListener('pointermove', (e) => {
      if (held < 0) return;
      const [x, y] = at(e);
      puzzle.points[held] = [clamp(x, PAD, 1 - PAD), clamp(y, PAD, 1 - PAD)];
      check();
    });
    const drop = () => {
      if (held < 0) return;
      held = -1; moves++; check();
      if (bad.length) return;
      done = true; clearInterval(ticker);
      const seconds = Math.max(1, Math.round((performance.now() - t0) / 1000));
      api.score(seconds);
      endTimer = setTimeout(() => api.finish(seconds, { title: 'Untangled', text: `${clock(seconds)} · ${moves} move${moves === 1 ? '' : 's'}`, icon: 'sparkles' }), 500);
    };
    cv.addEventListener('pointerup', drop); cv.addEventListener('pointercancel', drop);
    noScroll(cv);
    stage.querySelector('#ut-level').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); api.variant(b.dataset.l); reset(); } });
    reset();
    const stopFit = fitCanvas(cv, (w, h) => { W = w; H = h; draw(); });
    const stopLoop = loop(draw);
    return { restart: reset, destroy() { stopFit(); stopLoop(); clearInterval(ticker); clearTimeout(endTimer); } };
  },
};
