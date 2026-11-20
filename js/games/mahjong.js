import { drawIcons } from '../util.js';

// ---------------------------------------------------------------- rules (nothing is drawn here)
// Places are measured in half tiles: a tile covers two by two of them, so a tile can also lie half-way
// between two others. z is the layer, counted from the table up.
const block = (z, x0, y0, cols, rows) => Array.from({ length: cols * rows }, (_, k) => ({ x: 2 * (x0 + k % cols), y: 2 * (y0 + Math.floor(k / cols)), z }));
const row = (y, from, to) => block(0, from, y, to - from + 1, 1);
export const LAYOUTS = {
  pyramid: { name: 'Pyramid', places: [...block(0, 0, 0, 6, 8), ...block(1, 1, 1, 4, 6), ...block(2, 2, 2, 2, 4)] },
  turtle: {
    name: 'Turtle',
    places: [
      ...row(0, 1, 12), ...row(1, 3, 10), ...row(2, 2, 11), ...row(3, 1, 12), ...row(4, 1, 12), ...row(5, 2, 11), ...row(6, 3, 10), ...row(7, 1, 12),
      { x: 0, y: 7, z: 0 }, { x: 26, y: 7, z: 0 }, { x: 28, y: 7, z: 0 },
      ...block(1, 4, 1, 6, 6), ...block(2, 5, 2, 4, 4), ...block(3, 6, 3, 2, 2), { x: 13, y: 7, z: 4 },
    ],
  },
};
// The 36 faces. A real set has four of each, and so does a full board here.
export const FACES = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((n) => ['d' + n, 'b' + n, 'c' + n]), // dots, bamboo, flames
  'wN', 'wE', 'wS', 'wW', 'gR', 'gG', 'gW', 'fl', 'su',                        // winds, dragons, the flower and the sun
];

const at = (x, y, z) => (z * 64 + y) * 64 + x;
// The tiles that can be taken: nothing lies on them, and their left or their right side is open.
// `tiles` is a list of { x, y, z, gone }; the answer is a list of positions in it.
export function freeTiles(tiles) {
  const there = new Set();
  for (const t of tiles) if (!t.gone) there.add(at(t.x, t.y, t.z));
  const any = (x, y, z) => there.has(at(x, y - 1, z)) || there.has(at(x, y, z)) || there.has(at(x, y + 1, z));
  const free = [];
  tiles.forEach((t, i) => {
    if (t.gone) return;
    if (any(t.x - 1, t.y, t.z + 1) || any(t.x, t.y, t.z + 1) || any(t.x + 1, t.y, t.z + 1)) return; // something lies on it
    if (!any(t.x - 2, t.y, t.z) || !any(t.x + 2, t.y, t.z)) free.push(i);
  });
  return free;
}

// Finds an order in which the tiles that are left can all be taken off in pairs: [a, b, c, d, …] means
// a with b, then c with d. Null if no such order turned up, which is certain when none exists.
function takeOrder(tiles, rnd) {
  const left = tiles.filter((t) => !t.gone).length;
  for (let attempt = 0; attempt < 400; attempt++) {
    const copy = tiles.map((t) => ({ ...t })), order = [];
    while (order.length < left) {
      const free = freeTiles(copy);
      if (free.length < 2) break;
      const a = free.splice(Math.floor(rnd() * free.length), 1)[0], b = free[Math.floor(rnd() * free.length)];
      copy[a].gone = copy[b].gone = true;
      order.push(a, b);
    }
    if (order.length === left) return order;
  }
  return null;
}
// Gives every tile that is left a face, so that the board can be cleared: the faces are handed out in
// pairs along an order in which the tiles can be taken off. `faces` holds one face for every pair.
// Says false, and changes nothing, if the tiles cannot be cleared whatever their faces.
export function dealFaces(tiles, faces, rnd = Math.random) {
  const order = takeOrder(tiles, rnd);
  if (!order) return false;
  for (let k = 0; k < order.length; k += 2) tiles[order[k]].face = tiles[order[k + 1]].face = faces[k / 2];
  return true;
}
// A free pair with the same face, or null.
export function findPair(tiles) {
  const seen = {};
  for (const i of freeTiles(tiles)) {
    const face = tiles[i].face;
    if (face in seen) return [seen[face], i];
    seen[face] = i;
  }
  return null;
}
// How many pairs can be taken right now.
export function countMoves(tiles) {
  const count = {};
  for (const i of freeTiles(tiles)) count[tiles[i].face] = (count[tiles[i].face] || 0) + 1;
  return Object.values(count).reduce((sum, n) => sum + n * (n - 1) / 2, 0);
}
// A fresh board that can always be cleared.
export function createBoard(layout, rnd = Math.random) {
  const tiles = LAYOUTS[layout].places.map((p) => ({ ...p, face: '', gone: false }));
  const kinds = FACES.slice();
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const faces = Array.from({ length: tiles.length / 2 }, (_, k) => kinds[Math.floor(k / 2) % kinds.length]); // two pairs of a kind
  for (let i = faces.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [faces[i], faces[j]] = [faces[j], faces[i]]; }
  if (!dealFaces(tiles, faces, rnd)) throw new Error('this layout cannot be cleared');
  return tiles;
}
// Mixes the faces of the tiles that are left, again so that the board can be cleared. False if it cannot be.
export function reshuffle(tiles, rnd = Math.random) {
  const left = tiles.filter((t) => !t.gone), faces = [], odd = {};
  for (const t of left) { if (odd[t.face]) { faces.push(t.face); odd[t.face] = false; } else odd[t.face] = true; }
  for (let i = faces.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [faces[i], faces[j]] = [faces[j], faces[i]]; }
  return dealFaces(tiles, faces, rnd);
}

// ---------------------------------------------------------------- the faces, drawn in a box of 30 by 39
const PIPS = {
  1: [[15, 21.5]], 2: [[15, 14], [15, 29.5]], 3: [[8.5, 13], [15, 21.5], [21.5, 30]], 4: [[9.5, 14], [20.5, 14], [9.5, 29.5], [20.5, 29.5]],
  5: [[9, 13], [21, 13], [15, 21.5], [9, 30], [21, 30]], 6: [[9.5, 12.5], [20.5, 12.5], [9.5, 21.5], [20.5, 21.5], [9.5, 30.5], [20.5, 30.5]],
  7: [[9.5, 12.5], [20.5, 12.5], [8, 21.5], [15, 21.5], [22, 21.5], [9.5, 30.5], [20.5, 30.5]],
  8: [[9.5, 11.6], [20.5, 11.6], [9.5, 18.2], [20.5, 18.2], [9.5, 24.8], [20.5, 24.8], [9.5, 31.4], [20.5, 31.4]],
  9: [[8, 12.5], [15, 12.5], [22, 12.5], [8, 21.5], [15, 21.5], [22, 21.5], [8, 30.5], [15, 30.5], [22, 30.5]],
};
const RED_PIPS = { 1: [0], 5: [2], 7: [2, 3, 4], 9: [3, 4, 5] }; // which pips are red, as on a real set
const BLUE = '#1d5fbf', GREEN = '#15803d', RED = '#c81e1e', INK = '#1e293b';
const corner = (n) => `<text x="2.6" y="8.2" font-size="7.4" font-weight="700" fill="#6b5f52">${n}</text>`;
const big = (ch, y, size, fill) => `<text x="15" y="${y}" font-size="${size}" font-weight="800" text-anchor="middle" fill="${fill}">${ch}</text>`;
function faceSvg(face) {
  const kind = face[0], n = Number(face[1]);
  let art = '';
  if (kind === 'd') {
    const r = n === 1 ? 7.6 : n <= 3 ? 4.6 : n <= 5 ? 4.2 : n <= 7 ? 3.7 : 3.1;
    art = corner(n) + PIPS[n].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${RED_PIPS[n]?.includes(k) ? RED : BLUE}"/><circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="none" stroke="#fff" stroke-width="${r * 0.2}" opacity=".75"/>`).join('');
  } else if (kind === 'b') {
    const [w, h] = n === 1 ? [5.4, 18] : n <= 5 ? [3.4, 9.4] : n <= 7 ? [3.2, 7.4] : [3, 5.6];
    art = corner(n) + PIPS[n].map(([x, y], k) => `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="${w / 2}" fill="${RED_PIPS[n]?.includes(k) ? RED : GREEN}"/><path d="M${x - w / 2} ${y}h${w}" stroke="#fff" stroke-width=".8" opacity=".6"/>`).join('');
  } else if (kind === 'c') {
    art = big(n, 20.5, 19, RED) + `<path d="M15 23.5c2.9 2.4 4.6 4.7 4.6 7.1a4.6 4.6 0 0 1-9.2 0c0-1.7.9-3.1 2.1-4.2.2 1.3 1 2.1 2 2.3-.6-1.8-.4-3.6.5-5.2z" fill="#ea580c"/>`;
  } else if (kind === 'w') {
    art = big(face[1], 27.5, 22, INK) + `<path d="M8 33h14" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>`;
  } else if (face === 'gR') {
    art = `<rect x="8" y="13.5" width="14" height="11" rx="1.6" fill="none" stroke="${RED}" stroke-width="2.7"/><path d="M15 6.5v26" stroke="${RED}" stroke-width="2.7" stroke-linecap="round"/>`;
  } else if (face === 'gG') {
    art = `<path d="M15 6.5l8.8 13L15 32.5l-8.8-13z" fill="none" stroke="${GREEN}" stroke-width="2.6" stroke-linejoin="round"/><circle cx="15" cy="19.5" r="3" fill="${GREEN}"/>`;
  } else if (face === 'gW') {
    art = `<rect x="6" y="7" width="18" height="25" rx="2.4" fill="none" stroke="${BLUE}" stroke-width="2.3"/><rect x="10" y="11.2" width="10" height="16.6" rx="1.2" fill="none" stroke="${BLUE}" stroke-width="1.3"/>`;
  } else if (face === 'fl') {
    art = [0, 1, 2, 3, 4].map((k) => { const a = k * Math.PI * 2 / 5 - Math.PI / 2; return `<circle cx="${(15 + Math.cos(a) * 6.6).toFixed(2)}" cy="${(19.5 + Math.sin(a) * 6.6).toFixed(2)}" r="4.7" fill="#ec4899"/>`; }).join('') + '<circle cx="15" cy="19.5" r="3.4" fill="#fbbf24"/>';
  } else {
    art = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = k * Math.PI / 4; return `<path d="M${(15 + Math.cos(a) * 8.6).toFixed(2)} ${(19.5 + Math.sin(a) * 8.6).toFixed(2)}L${(15 + Math.cos(a) * 12).toFixed(2)} ${(19.5 + Math.sin(a) * 12).toFixed(2)}" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round"/>`; }).join('') + '<circle cx="15" cy="19.5" r="6.2" fill="#f59e0b"/>';
  }
  return `<svg viewBox="0 0 30 39" aria-hidden="true">${art}</svg>`;
}
const SUITS = { d: 'dots', b: 'bamboo', c: 'flames' }, WINDS = { N: 'North', E: 'East', S: 'South', W: 'West' };
const OTHERS = { gR: 'Red dragon', gG: 'Green dragon', gW: 'White dragon', fl: 'Flower', su: 'Sun' };
const faceName = (f) => (SUITS[f[0]] ? `${f[1]} of ${SUITS[f[0]]}` : f[0] === 'w' ? `${WINDS[f[1]]} wind` : OTHERS[f]);

// ---------------------------------------------------------------- the game on the page
const HINT_COST = 15, SHUFFLE_COST = 60; // seconds added to the clock
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default {
  id: 'mahjong', name: 'Mahjong', icon: 'layers-3', color: '#10b981', tag: 'Puzzle', since: '1.1',
  desc: 'Mahjong solitaire: take the tiles off in matching pairs until the table is clear. Every deal can be won.',
  help: `Take two free tiles with the same picture · a tile is free when nothing lies on it and its left or right side is open · H hint (+${HINT_COST} s) · S shuffle (+${SHUFFLE_COST} s) · U undo`,
  scoreLabel: 'Time', lowerBetter: true, format: clock,
  variants: Object.fromEntries(Object.entries(LAYOUTS).map(([id, l]) => [id, l.name])),
  defaultVariant: () => (window.matchMedia('(max-width: 700px)').matches ? 'pyramid' : 'turtle'),
  create(stage, api) {
    stage.innerHTML = `
      <div class="mahjong">
        <div class="mj-bar">
          <div class="seg" id="mj-layout">${Object.entries(LAYOUTS).map(([id, l]) => `<button data-l="${id}">${l.name}</button>`).join('')}</div>
          <button class="bt-tool" id="mj-hint"><i data-lucide="lightbulb"></i><span>Hint</span></button>
          <button class="bt-tool" id="mj-shuffle"><i data-lucide="shuffle"></i><span>Shuffle</span></button>
          <button class="bt-tool" id="mj-undo"><i data-lucide="undo-2"></i><span>Undo</span></button>
        </div>
        <div class="mj-board" id="mj-board"></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const boardEl = $('mj-board'), undoBtn = $('mj-undo'), layoutBtns = [...stage.querySelectorAll('#mj-layout button')];
    let layout, tiles, els = [], chosen = -1, history = [], seconds = 0, startedAt = 0, extra = 0, ticker = null, done = false, hintTimer = null;

    const elapsed = () => Math.floor((startedAt ? (performance.now() - startedAt) / 1000 : 0) + extra);
    const showTime = () => api.score(elapsed());
    function startClock() {
      if (startedAt || done) return;
      startedAt = performance.now();
      ticker = setInterval(showTime, 500);
    }
    // Puts every tile where it belongs, as big as the room allows.
    function place() {
      const cols = Math.max(...tiles.map((t) => t.x)) + 2, rows = Math.max(...tiles.map((t) => t.y)) + 2, layers = Math.max(...tiles.map((t) => t.z)) + 1;
      const roomW = stage.clientWidth, roomH = Math.max(300, window.innerHeight - 250);
      const u = Math.max(8, Math.min(33, (roomW - 8) / (cols + layers * 0.24), (roomH - 8) / ((rows + layers * 0.24) * 1.3))); // half a tile's width
      const v = u * 1.3, lift = u * 0.24, edge = Math.max(2, u * 0.16);
      boardEl.style.width = `${cols * u + (layers - 1) * lift + edge}px`;
      boardEl.style.height = `${rows * v + (layers - 1) * lift + edge}px`;
      boardEl.style.setProperty('--edge', `${edge}px`);
      tiles.forEach((t, i) => {
        const s = els[i].style;
        s.width = `${2 * u - 1}px`; s.height = `${2 * v - 1}px`;
        s.left = `${t.x * u + (layers - 1 - t.z) * lift}px`; s.top = `${t.y * v + (layers - 1 - t.z) * lift}px`;
        s.zIndex = t.z * 2000 + t.y * 40 + t.x;
      });
    }
    function show() {
      const free = new Set(freeTiles(tiles)), left = tiles.filter((t) => !t.gone).length;
      tiles.forEach((t, i) => {
        els[i].classList.toggle('gone', t.gone);
        els[i].classList.toggle('stuck', !t.gone && !free.has(i));
        els[i].classList.toggle('sel', i === chosen);
        els[i].tabIndex = !t.gone && free.has(i) ? 0 : -1;
      });
      undoBtn.disabled = !history.length;
      const moves = countMoves(tiles);
      api.status(left ? `${left} tiles · ${moves} ${moves === 1 ? 'move' : 'moves'}` : '');
      return { left, moves };
    }
    function deal() {
      clearInterval(ticker); clearTimeout(hintTimer); api.hideOverlay();
      layout = LAYOUTS[api.variant()] ? api.variant() : 'pyramid';
      tiles = createBoard(layout);
      chosen = -1; history = []; startedAt = 0; extra = 0; done = false;
      boardEl.innerHTML = tiles.map((t, i) => `<button class="mj-tile" data-i="${i}" aria-label="${faceName(t.face)}">${faceSvg(t.face)}</button>`).join('');
      els = [...boardEl.children];
      layoutBtns.forEach((b) => b.classList.toggle('on', b.dataset.l === layout));
      place(); show(); showTime();
    }
    // Looks at the board after a change: is it cleared, or is the player stuck?
    function check() {
      const { left, moves } = show();
      if (!left) {
        done = true; clearInterval(ticker);
        const time = elapsed();
        api.score(time);
        api.finish(time, { endTitle: 'Table cleared', text: `Your time: ${clock(time)}` });
      } else if (!moves) {
        api.overlay({
          title: 'No moves left', text: `Shuffle the tiles that are left and carry on (+${SHUFFLE_COST} s), or press U to take a move back.`, icon: 'shuffle', button: 'Shuffle',
          onClick: () => shuffle(),
        });
      }
    }
    function setFaces() { tiles.forEach((t, i) => { if (!t.gone) { els[i].innerHTML = faceSvg(t.face); els[i].setAttribute('aria-label', faceName(t.face)); } }); }
    function shuffle() {
      if (done) return;
      api.hideOverlay(); startClock();
      if (!reshuffle(tiles)) { // the tiles that are left sit on top of each other: no order of faces can help
        done = true; clearInterval(ticker);
        api.finish(null, { title: 'No way out', text: 'The last tiles lie on top of each other. Try another deal.', icon: 'flag' });
        return;
      }
      extra += SHUFFLE_COST; chosen = -1; history = [];
      setFaces(); check(); showTime();
    }
    function hint() {
      if (done) return;
      const pair = findPair(tiles);
      if (!pair) { check(); return; }
      startClock(); extra += HINT_COST; showTime();
      clearTimeout(hintTimer);
      els.forEach((el) => el.classList.remove('hint'));
      pair.forEach((i) => els[i].classList.add('hint'));
      hintTimer = setTimeout(() => pair.forEach((i) => els[i].classList.remove('hint')), 1800);
    }
    function undo() {
      if (done || !history.length) return;
      api.hideOverlay();
      for (const i of history.pop()) tiles[i].gone = false;
      chosen = -1; show();
    }
    function pick(i) {
      if (done || tiles[i].gone) return;
      startClock();
      if (!freeTiles(tiles).includes(i)) { // a tile that cannot be taken shakes its head
        els[i].classList.remove('nope'); void els[i].offsetWidth; els[i].classList.add('nope');
        return;
      }
      if (chosen === i) { chosen = -1; show(); return; }
      if (chosen >= 0 && tiles[chosen].face === tiles[i].face) {
        tiles[chosen].gone = tiles[i].gone = true;
        history.push([chosen, i]); chosen = -1;
        els.forEach((el) => el.classList.remove('hint'));
        check();
        return;
      }
      chosen = i; show();
    }

    boardEl.addEventListener('click', (e) => { const el = e.target.closest('.mj-tile'); if (el) { el.blur(); pick(Number(el.dataset.i)); } });
    $('mj-layout').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); api.variant(b.dataset.l); deal(); } });
    $('mj-hint').addEventListener('click', (e) => { e.currentTarget.blur(); hint(); });
    $('mj-shuffle').addEventListener('click', (e) => { e.currentTarget.blur(); shuffle(); });
    undoBtn.addEventListener('click', () => { undoBtn.blur(); undo(); });
    const watcher = new ResizeObserver(() => { if (tiles) place(); });
    watcher.observe(stage);
    window.addEventListener('resize', place);

    deal();
    return {
      restart: deal,
      key(e) {
        if (e.key === 'h') { hint(); return true; }
        if (e.key === 's') { shuffle(); return true; }
        if (e.key === 'u') { undo(); return true; }
      },
      shortcut(e) { if (e.key === 'z') { undo(); return true; } },
      destroy() { clearInterval(ticker); clearTimeout(hintTimer); watcher.disconnect(); window.removeEventListener('resize', place); },
    };
  },
};
