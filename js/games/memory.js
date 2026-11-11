import { shuffle } from '../util.js';

const SYMBOLS = [
  ['star', '#facc15'], ['heart', '#f43f5e'], ['moon', '#a78bfa'], ['sun', '#fb923c'],
  ['cloud', '#38bdf8'], ['leaf', '#4ade80'], ['flame', '#f97316'], ['music', '#e879f9'],
];

export default {
  id: 'memory', name: 'Memory Match', icon: 'layers', color: '#a78bfa', tag: 'Memory',
  desc: 'Flip cards and find all eight pairs in as few moves as possible.',
  help: 'Click two cards to flip them · fewer moves is better',
  scoreLabel: 'Moves', lowerBetter: true,
  create(stage, api) {
    const deck = shuffle([...SYMBOLS, ...SYMBOLS].map(([icon, color], i) => ({ icon, color, id: i })));
    stage.innerHTML = `<div class="mgrid" id="mg">${deck.map((c, i) => `
      <button class="mcard" data-i="${i}" aria-label="Card" style="color:${c.color}">
        <div class="mcard-inner">
          <div class="mface mback"><i data-lucide="sparkle"></i></div>
          <div class="mface mfront"><i data-lucide="${c.icon}"></i></div>
        </div>
      </button>`).join('')}</div>`;
    const cards = [...stage.querySelectorAll('.mcard')];
    let open = [], moves = 0, found = 0, lock = false, start = 0, timer = null;

    function tick() { api.status(`${Math.floor((Date.now() - start) / 1000)}s · ${found}/8 pairs`); }

    cards.forEach((el) => el.addEventListener('click', () => {
      const i = +el.dataset.i;
      if (lock || el.classList.contains('flip') || el.classList.contains('done')) return;
      if (!start) { start = Date.now(); timer = setInterval(tick, 500); }
      el.classList.add('flip'); open.push(i);
      if (open.length < 2) return;
      moves++; api.score(moves);
      const [a, b] = open; open = [];
      if (deck[a].icon === deck[b].icon) {
        cards[a].classList.add('done'); cards[b].classList.add('done');
        found++; tick();
        if (found === 8) {
          clearInterval(timer);
          const secs = Math.floor((Date.now() - start) / 1000);
          setTimeout(() => api.finish(moves, { text: `Solved in ${moves} moves and ${secs}s` }), 400);
        }
      } else {
        lock = true;
        setTimeout(() => { cards[a].classList.remove('flip'); cards[b].classList.remove('flip'); lock = false; }, 700);
      }
    }));
    api.status('0/8 pairs');
    return { destroy() { clearInterval(timer); } };
  },
};
