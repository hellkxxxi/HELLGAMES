import { randInt } from '../util.js';

const COLORS = {
  0: ['#231615', '#231615'], 2: ['#321f1e', '#e8e3e3'], 4: ['#3c2525', '#f6f4f3'], 8: ['#365314', '#ecfccb'], 16: ['#3f6212', '#ecfccb'],
  32: ['#4d7c0f', '#f7fee7'], 64: ['#65a30d', '#f7fee7'], 128: ['#0e7490', '#ecfeff'], 256: ['#0891b2', '#ecfeff'],
  512: ['#7c3aed', '#f5f3ff'], 1024: ['#a21caf', '#fdf4ff'], 2048: ['#eab308', '#1c1917'],
};
const KEYS = { ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };

export default {
  id: '2048', name: '2048', icon: 'grid-2x2', color: '#eab308', tag: 'Puzzle',
  desc: 'Slide and merge matching tiles. Can you reach 2048?',
  help: 'Arrow keys / WASD or swipe to slide tiles',
  swipe: true,
  create(stage, api) {
    stage.innerHTML = `<div class="b2048" id="b"></div>`;
    const el = stage.querySelector('#b');
    const grid = Array(16).fill(0);
    let score = 0, won = false, over = false;
    const fresh = new Set(), merged = new Set();

    function add() {
      const empty = grid.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (!empty.length) return;
      const i = empty[randInt(empty.length)];
      grid[i] = Math.random() < 0.9 ? 2 : 4; fresh.add(i);
    }
    function render() {
      el.innerHTML = grid.map((v, i) => {
        const [bg, fg] = COLORS[v] || ['#f59e0b', '#1c1917'];
        const d = String(v).length;
        const cls = ['t2048', d >= 3 ? 'd' + Math.min(d, 5) : '', fresh.has(i) ? 'new' : '', merged.has(i) ? 'merged' : ''].join(' ');
        return `<div class="${cls}" data-v="${v}" style="background:${bg};color:${fg}">${v || ''}</div>`;
      }).join('');
      fresh.clear(); merged.clear();
    }
    function lineIdx(dir, k) {
      const r = [];
      for (let j = 0; j < 4; j++) {
        if (dir === 'left') r.push(k * 4 + j);
        if (dir === 'right') r.push(k * 4 + 3 - j);
        if (dir === 'up') r.push(j * 4 + k);
        if (dir === 'down') r.push((3 - j) * 4 + k);
      }
      return r;
    }
    function move(dir) {
      if (over) return;
      let moved = false;
      for (let k = 0; k < 4; k++) {
        const idx = lineIdx(dir, k);
        const vals = idx.map((i) => grid[i]).filter(Boolean);
        const out = [], mergedAt = [];
        for (let j = 0; j < vals.length; j++) {
          if (vals[j] === vals[j + 1]) { out.push(vals[j] * 2); score += vals[j] * 2; mergedAt.push(out.length - 1); j++; }
          else out.push(vals[j]);
        }
        while (out.length < 4) out.push(0);
        idx.forEach((i, j) => { if (grid[i] !== out[j]) moved = true; grid[i] = out[j]; });
        mergedAt.forEach((j) => merged.add(idx[j]));
      }
      if (!moved) return;
      add(); api.score(score); render();
      if (!won && grid.includes(2048)) {
        won = true;
        api.overlay({ title: 'You made 2048!', text: 'Keep going for a higher score.', icon: 'trophy', button: 'Keep playing', onClick: () => {} });
      } else if (!canMove()) {
        over = true;
        setTimeout(() => api.finish(score), 250);
      }
    }
    function canMove() {
      for (let i = 0; i < 16; i++) {
        if (!grid[i]) return true;
        if (i % 4 < 3 && grid[i] === grid[i + 1]) return true;
        if (i < 12 && grid[i] === grid[i + 4]) return true;
      }
      return false;
    }

    add(); add(); render();
    return {
      key(e) { const d = KEYS[e.key] || KEYS[e.key.toLowerCase()]; if (d) { move(d); return true; } },
      swipe: move,
    };
  },
};
