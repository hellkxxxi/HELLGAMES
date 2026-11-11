import { randInt } from '../util.js';

const DURATION = 30000;
const CRITTER = `<svg viewBox="0 0 100 100"><path d="M10 100 C10 40 25 18 50 18 C75 18 90 40 90 100Z" fill="#a16207"/>
<ellipse cx="50" cy="70" rx="24" ry="22" fill="#ca8a04"/><circle cx="38" cy="45" r="6" fill="#1c1917"/><circle cx="62" cy="45" r="6" fill="#1c1917"/>
<circle cx="40" cy="43" r="2" fill="#fff"/><circle cx="64" cy="43" r="2" fill="#fff"/><ellipse cx="50" cy="57" rx="7" ry="5" fill="#f472b6"/>
<rect x="45" y="62" width="10" height="9" rx="2" fill="#fafaf9"/></svg>`;
const KEYMAP = '789456123';

export default {
  id: 'whack', name: 'Whack-a-Mole', icon: 'hammer', color: '#fb923c', tag: 'Reflex',
  desc: 'Bop as many moles as you can in 30 seconds. They speed up.',
  help: 'Click or tap moles · number keys 1–9 work too',
  create(stage, api) {
    stage.innerHTML = `<div class="timebar"><div id="tb" style="width:100%"></div></div>
      <div class="wgrid">${Array.from({ length: 9 }, (_, i) => `<div class="hole" data-i="${i}"><div class="critter">${CRITTER}</div></div>`).join('')}</div>`;
    const holes = [...stage.querySelectorAll('.hole')];
    const bar = stage.querySelector('#tb');
    let score = 0, running = false, t0 = 0, spawnT = null, tickT = null;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

    function spawn() {
      if (!running) return;
      const progress = (performance.now() - t0) / DURATION;
      const free = holes.filter((h) => !h.classList.contains('up'));
      if (free.length) {
        const h = free[randInt(free.length)];
        h.classList.add('up'); h.classList.remove('hit');
        h._t = later(() => h.classList.remove('up'), Math.max(450, 1000 - progress * 550));
      }
      spawnT = later(spawn, Math.max(300, 750 - progress * 450) * (0.7 + Math.random() * 0.6));
    }
    function whack(h) {
      if (!running || !h.classList.contains('up') || h.classList.contains('hit')) return;
      clearTimeout(h._t); timers.delete(h._t);
      h.classList.add('hit'); score++; api.score(score);
      later(() => h.classList.remove('up', 'hit'), 140);
    }
    function begin() {
      running = true; t0 = performance.now(); score = 0; api.score(0);
      spawn();
      tickT = setInterval(() => {
        const left = Math.max(0, DURATION - (performance.now() - t0));
        bar.style.width = (left / DURATION * 100) + '%';
        api.status(`${Math.ceil(left / 1000)}s left`);
        if (left <= 0) end();
      }, 100);
    }
    function end() {
      running = false; clearInterval(tickT);
      timers.forEach(clearTimeout); timers.clear();
      holes.forEach((h) => h.classList.remove('up', 'hit'));
      api.finish(score);
    }

    holes.forEach((h) => h.addEventListener('pointerdown', (e) => { e.preventDefault(); whack(h); }));
    api.overlay({ title: 'Whack-a-Mole', text: '30 seconds. Hit every mole you see.', icon: 'hammer', button: 'Start', onClick: begin });
    api.status('30s');
    return {
      key(e) { const k = KEYMAP.indexOf(e.key); if (k >= 0) { whack(holes[k]); return true; } },
      destroy() { running = false; clearInterval(tickT); timers.forEach(clearTimeout); },
    };
  },
};
