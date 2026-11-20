// ---------------------------------------------------------------- the rules (nothing is shown here)
export const SECONDS = 30, PENALTY = 3; // a round lasts this long; a wrong tile costs this many seconds
// Letters and digits that are easy to take for each other.
export const PAIRS = ['O0', 'bd', 'pq', 'EF', 'MW', '69', 'CG', 'Il', 'nu', 'S5', 'B8', 'Z2', 'VU', 'XK', 'QO', 'hn', 'ij', 'RP', 'mn', 'vy'];
// How many tiles there are to a side on a level: 2, 3, 3, 4, 4, … up to 8.
export const sideOf = (level) => Math.min(8, 2 + Math.ceil(level / 2));
// How far the odd colour is from the others, in per cent of lightness: less on every level, never under 3.
export const contrast = (level) => Math.max(3, 24 - level * 1.4);

// A level: `side` tiles to a side, all alike except the one at `odd`.
export function makeLevel(level, kind, rnd = Math.random) {
  const side = sideOf(level), odd = Math.floor(rnd() * side * side);
  if (kind === 'letters') {
    const pair = PAIRS[Math.floor(rnd() * PAIRS.length)], flip = rnd() < 0.5;
    return { side, odd, kind, most: pair[flip ? 1 : 0], other: pair[flip ? 0 : 1] };
  }
  const hue = Math.floor(rnd() * 360), sat = 55 + Math.floor(rnd() * 25), light = 42 + Math.floor(rnd() * 16);
  const delta = contrast(level) * (rnd() < 0.5 ? -1 : 1); // lighter or darker; either way it stays well inside 0…100
  return { side, odd, kind, most: `hsl(${hue} ${sat}% ${light}%)`, other: `hsl(${hue} ${sat}% ${Math.round((light + delta) * 10) / 10}%)` };
}

export default {
  id: 'odd', name: 'Odd One Out', icon: 'scan-search', color: '#2dd4bf', tag: 'Skill', since: '1.1',
  desc: 'One tile is not like the others. Find it, and the next field is bigger and the difference smaller. 30 seconds.',
  help: 'Click or tap the tile that differs · a wrong one costs 3 seconds · Colours: one shade is off · Letters: one sign is another · the first tile starts the clock',
  variants: { colors: 'Colours', letters: 'Letters' },
  create(stage, api) {
    stage.innerHTML = `
      <div class="odd">
        <div class="mn-top"><div class="seg" id="od-kind">${Object.entries(this.variants).map(([id, name]) => `<button data-k="${id}">${name}</button>`).join('')}</div></div>
        <div class="timebar wide"><div id="od-bar" style="width:100%"></div></div>
        <div class="od-grid" id="od-grid"></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const grid = $('od-grid'), bar = $('od-bar'), kindBtns = [...stage.querySelectorAll('#od-kind button')];
    let kind = api.variant(), running = false, over = false, level = 0, now = null, left = SECONDS, last = 0, ticker = null, slips = 0;

    function draw() {
      grid.style.setProperty('--n', now.side);
      grid.className = 'od-grid ' + now.kind;
      grid.innerHTML = Array.from({ length: now.side * now.side }, (_, i) => {
        const what = i === now.odd ? now.other : now.most;
        return now.kind === 'letters' ? `<button data-i="${i}">${what}</button>` : `<button data-i="${i}" style="background:${what}" aria-label="Tile ${i + 1}"></button>`;
      }).join('');
    }
    function next() { now = makeLevel(level, kind === 'letters' ? 'letters' : 'colors'); draw(); }
    function tick() {
      const t = performance.now();
      left -= (t - last) / 1000; last = t;
      bar.style.width = Math.max(0, left / SECONDS * 100) + '%';
      api.status(`${Math.max(0, Math.ceil(left))}s left`);
      if (left <= 0) end();
    }
    // The first field waits for as long as it takes: the clock starts with the first tile that is touched.
    function ready() {
      running = false; clearInterval(ticker);
      kindBtns.forEach((b) => b.classList.toggle('on', b.dataset.k === kind));
      level = 0; slips = 0; left = SECONDS; next();
      bar.style.width = '100%'; api.score(0); api.status(`${SECONDS} seconds`);
    }
    function begin() { running = true; last = performance.now(); ticker = setInterval(tick, 100); tick(); }
    function end() {
      running = false; over = true; clearInterval(ticker);
      api.finish(level, { endTitle: 'Time is up', text: `${level} found${slips ? ` · ${slips} wrong` : ', not one wrong'}` });
    }
    grid.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button');
      if (!b || over) return;
      e.preventDefault();
      if (!running) begin();
      if (Number(b.dataset.i) === now.odd) { level++; api.score(level); next(); }
      else { slips++; left -= PENALTY; b.classList.add('wrong'); grid.classList.remove('shake'); void grid.offsetWidth; grid.classList.add('shake'); tick(); }
    });
    $('od-kind').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.k === kind) return;
      b.blur(); kind = b.dataset.k; api.variant(kind); ready();
    });
    ready();
    return { destroy() { running = false; clearInterval(ticker); } };
  },
};
