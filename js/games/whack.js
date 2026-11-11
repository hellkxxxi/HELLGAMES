import { randInt } from '../util.js';

const DURATION = 30000;
// The critter is a little devil: head and shoulders, drawn as an SVG that rises out of a lava pit.
const CRITTER = `<svg viewBox="0 0 100 100" stroke="#3b0a0a" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
<path d="M8 104 C8 80 20 67 34 63 L66 63 C80 67 92 80 92 104Z" fill="#b91c1c"/>
<path d="M23 38 L3 27 L19 55Z M77 38 L97 27 L81 55Z" fill="#dc2626"/>
<path d="M27 25 C20 17 20 8 26 1 C28 10 35 15 43 18Z M73 25 C80 17 80 8 74 1 C72 10 65 15 57 18Z" fill="#fde68a"/>
<ellipse cx="50" cy="45" rx="31" ry="29" fill="#ef4444"/>
<ellipse cx="38" cy="26" rx="9" ry="4.5" transform="rotate(-18 38 26)" fill="#f87171" stroke="none"/>
<g class="eyes"><ellipse cx="38" cy="45" rx="8" ry="9" fill="#fff7ed"/><ellipse cx="62" cy="45" rx="8" ry="9" fill="#fff7ed"/>
<circle cx="40.5" cy="46" r="3.6" fill="#18090a" stroke="none"/><circle cx="59.5" cy="46" r="3.6" fill="#18090a" stroke="none"/></g>
<path class="eyes-hit" d="M32 39 L44 51 M44 39 L32 51 M56 39 L68 51 M68 39 L56 51" fill="none" stroke-width="3.4"/>
<path d="M25 32 L45 38 M75 32 L55 38" fill="none" stroke-width="3.6"/>
<path d="M33 58 Q50 77 67 58 Q50 65 33 58Z" fill="#450a0a"/>
<path d="M39 61.5 L44.5 63 L42 68.5Z M61 61.5 L55.5 63 L58 68.5Z" fill="#fff7ed" stroke-width="1.2"/></svg>`;
const KEYMAP = '789456123';

export default {
  id: 'whack', name: 'Whack-a-Mole', icon: 'hammer', color: '#fb923c', tag: 'Reflex',
  desc: 'Little devils pop out of the lava pits. Bop as many as you can in 30 seconds.',
  help: 'Click or tap the devils · number keys 1–9 work too',
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
    api.overlay({ title: 'Whack-a-Mole', text: '30 seconds. Smack every little devil you see.', icon: 'hammer', button: 'Start', onClick: begin });
    api.status('30s');
    return {
      key(e) { const k = KEYMAP.indexOf(e.key); if (k >= 0) { whack(holes[k]); return true; } },
      destroy() { running = false; clearInterval(tickT); timers.forEach(clearTimeout); },
    };
  },
};
