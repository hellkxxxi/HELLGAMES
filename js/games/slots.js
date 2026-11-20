import { createBet, createTable, souls } from '../casino.js';
import { drawIcons } from '../util.js';

// Every reel is a loop of 20 symbols and stops on any of them with the same chance. How often a symbol
// comes up is simply how many times it is on the loop.
const STRIP = ['cherry', 'citrus', 'grape', 'cherry', 'bell', 'citrus', 'cherry', 'grape', 'gem', 'cherry',
  'citrus', 'bell', 'grape', 'skull', 'cherry', 'citrus', 'grape', 'bell', 'gem', 'flame'];
export const REELS = [STRIP, [...STRIP.slice(7), ...STRIP.slice(0, 7)], [...STRIP].reverse()];
// What three of a kind pay, in bets. Any two of a kind give the bet back.
export const PAYS = { flame: 200, skull: 80, gem: 40, bell: 25, grape: 15, citrus: 12, cherry: 10 };
export const PAIR = 1;
const LOOK = {
  cherry: ['cherry', '#fb7185', 'cherries'], citrus: ['citrus', '#fde047', 'lemons'], grape: ['grape', '#c084fc', 'grapes'], bell: ['bell', '#fbbf24', 'bells'],
  gem: ['gem', '#22d3ee', 'gems'], skull: ['skull', '#e7e5e4', 'skulls'], flame: ['flame', '#ff5a2a', 'flames'],
};
const TURNS = 6; // copies of the loop in each reel on the page, enough room for a long spin

// How many bets the three symbols on the line pay.
export function payout([a, b, c]) {
  if (a === b && b === c) return PAYS[a];
  return a === b || b === c || a === c ? PAIR : 0;
}
// The share of all bets that the machine gives back in the long run, counted over every possible stop.
export function returnToPlayer() {
  let total = 0, count = 0;
  for (const a of REELS[0]) for (const b of REELS[1]) for (const c of REELS[2]) { total += payout([a, b, c]); count++; }
  return total / count;
}

export default {
  id: 'slots', name: 'Soul Slots', icon: 'cherry', color: '#f43f5e', tag: 'Casino', since: '1.1',
  desc: 'Three reels and a purse of souls. Three of a kind pay big, any pair gives your bet back.',
  help: 'Space or Enter spins · arrow keys change the bet · souls are play money and worth nothing',
  scoreLabel: 'Souls', bestLabel: 'Top win', format: souls,
  create(stage, api) {
    const n = STRIP.length;
    const cell = (s) => `<div class="sl-cell" data-s="${s}" style="--c:${LOOK[s][1]}"><i data-lucide="${LOOK[s][0]}"></i></div>`;
    stage.innerHTML = `
      <div class="slots">
        <div class="sl-reels">
          ${REELS.map((reel) => `<div class="sl-reel"><div class="sl-strip">${Array.from({ length: n * TURNS }, (_, i) => cell(reel[i % n])).join('')}</div></div>`).join('')}
          <div class="sl-line"></div>
        </div>
        <p class="cz-msg" id="sl-msg" role="status">Three of a kind on the line wins</p>
        <div class="cz-bar"><div id="sl-bet"></div><button class="btn-primary" id="sl-spin">Spin</button></div>
        <div class="sl-pays">
          ${Object.entries(PAYS).map(([s, x]) => `<div style="--c:${LOOK[s][1]}"><span>${`<i data-lucide="${LOOK[s][0]}"></i>`.repeat(3)}</span><b>&times;${x}</b></div>`).join('')}
          <div class="sl-pair"><span>Any pair</span><b>bet back</b></div>
        </div>
      </div>`;
    const strips = [...stage.querySelectorAll('.sl-strip')], msg = stage.querySelector('#sl-msg'), button = stage.querySelector('#sl-spin');
    const bet = createBet(stage.querySelector('#sl-bet'), 'slots');
    const table = createTable(api, bet);
    const home = n * (TURNS - 1); // a reel rests within its last copy of the loop and spins towards the first
    const stops = REELS.map(() => Math.floor(Math.random() * n));
    let spinning = false, timers = [];

    // Shows cell number `index` of a strip on the line. The cells above and below it peek in.
    const place = (i, index, ms = 0) => {
      strips[i].style.transition = ms ? `transform ${ms}ms cubic-bezier(.16,.62,.3,1.05)` : 'none';
      strips[i].style.transform = `translateY(${-(index - 0.55) / (n * TURNS) * 100}%)`;
    };
    stops.forEach((s, i) => place(i, home + s));

    function spin() {
      if (spinning) return;
      const stake = bet.value;
      if (!table.stake(stake)) { table.settle(); return; }
      spinning = true; bet.lock(true); button.disabled = true;
      stage.querySelectorAll('.sl-cell.win').forEach((c) => c.classList.remove('win'));
      msg.textContent = 'Good luck…'; msg.className = 'cz-msg';
      const next = REELS.map(() => Math.floor(Math.random() * n));
      const line = next.map((s, i) => REELS[i][s]);
      const win = payout(line) * stake;
      table.credit(win);
      next.forEach((s, i) => {
        const ms = 900 + i * 450;
        void strips[i].offsetHeight; // the reel starts from where it rests
        place(i, home - n * (2 + i) + s, ms);
        timers.push(setTimeout(() => { stops[i] = s; place(i, home + s); }, ms + 40));
      });
      timers.push(setTimeout(() => {
        spinning = false; timers = [];
        const kind = line[0] === line[1] || line[0] === line[2] ? line[0] : line[1];
        if (win) {
          strips.forEach((strip, i) => { if (line[i] === kind) strip.children[home + next[i]].classList.add('win'); });
          const three = line.every((s) => s === kind);
          msg.textContent = three ? `Three ${LOOK[kind][2]}! +${souls(win - stake)}` : `A pair of ${LOOK[kind][2]}: your bet is back`;
          msg.className = 'cz-msg ' + (three ? 'good' : '');
          table.won(win - stake);
        } else { msg.textContent = 'No match'; msg.className = 'cz-msg bad'; }
        table.show(); bet.lock(false); button.disabled = false;
        table.settle();
      }, 900 + 2 * 450 + 80));
    }

    button.addEventListener('click', () => { button.blur(); spin(); });
    drawIcons();
    return {
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) spin(); return true; }
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { bet.step(1); return true; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { bet.step(-1); return true; }
      },
      destroy() { timers.forEach(clearTimeout); },
    };
  },
};
