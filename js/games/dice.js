import { createBet, createTable, souls } from '../casino.js';
import { clamp } from '../util.js';

// The roll is a number from 0.00 to 99.99, each as likely as any other. The player picks a line and bets
// that the roll lands under it or at it and over. The smaller the chance, the more a win pays.
export const EDGE = 0.99;                 // the house keeps 1%: a fair game would pay 100 / chance
export const MIN_LINE = 2, MAX_LINE = 98;
export const chanceOf = (line, over) => (over ? 100 - line : line);          // in percent
export const multiplier = (chance) => EDGE * 100 / chance;
export const wins = (roll, line, over) => (over ? roll >= line : roll < line);
export const payout = (bet, chance) => Math.floor(bet * Math.round(EDGE * 100) / chance); // whole numbers until the last step, so nothing is lost in rounding
const times = (x) => (x >= 10 ? x.toFixed(1) : x.toFixed(2));

export default {
  id: 'dice', name: 'Soul Dice', icon: 'dices', color: '#8b5cf6', tag: 'Casino', since: '1.1',
  desc: 'Pick your odds, from a safe 98% to a 2% long shot that pays almost fifty times the bet, and roll.',
  help: 'Space or Enter rolls · left and right move the line · up and down change the bet · souls are play money',
  scoreLabel: 'Souls', bestLabel: 'Top win', format: souls,
  create(stage, api) {
    stage.innerHTML = `
      <div class="dice">
        <div class="seg" id="dc-side"><button data-o="0">Roll under</button><button data-o="1">Roll over</button></div>
        <div class="dc-roll" id="dc-roll">50.00</div>
        <div class="dc-track" id="dc-track">
          <div class="dc-mark" id="dc-mark"></div>
          <input type="range" id="dc-line" min="${MIN_LINE}" max="${MAX_LINE}" step="1" aria-label="The line the roll has to beat">
          <div class="dc-scale"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>
        </div>
        <div class="dc-stats">
          <div><span>Line</span><b id="dc-at"></b></div>
          <div><span>Chance</span><b id="dc-chance"></b></div>
          <div><span>Pays</span><b id="dc-times"></b></div>
          <div><span>You win</span><b id="dc-win"></b></div>
        </div>
        <p class="cz-msg" id="dc-msg" role="status">Move the line to set your odds</p>
        <div class="cz-bar"><div id="dc-bet"></div><button class="btn-primary" id="dc-go">Roll</button></div>
        <div class="dc-past" id="dc-past" aria-label="Earlier rolls"></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const slider = $('dc-line'), track = $('dc-track'), mark = $('dc-mark'), rollEl = $('dc-roll'), msg = $('dc-msg'), go = $('dc-go'), past = $('dc-past');
    const sides = [...stage.querySelectorAll('#dc-side button')];
    let line = 50, over = false, busy = false, timer = null;
    try {
      line = clamp(Number(localStorage.getItem('arcade:dice:line')) || 50, MIN_LINE, MAX_LINE);
      over = localStorage.getItem('arcade:dice:over') === '1';
    } catch { /* the defaults will do */ }

    const bet = createBet($('dc-bet'), 'dice', () => showOdds());
    const table = createTable(api, bet);

    function showOdds() {
      const chance = chanceOf(line, over);
      slider.value = line;
      track.style.setProperty('--k', String(line / 100));
      track.classList.toggle('over', over);
      sides.forEach((b) => b.classList.toggle('on', (b.dataset.o === '1') === over));
      $('dc-at').textContent = over ? `${line} or more` : `under ${line}`;
      $('dc-chance').textContent = chance + '%';
      $('dc-times').textContent = '×' + times(multiplier(chance));
      $('dc-win').textContent = '+' + souls(payout(bet.value, chance) - bet.value);
    }
    function setLine(v) {
      if (busy) return;
      line = clamp(Math.round(v), MIN_LINE, MAX_LINE);
      try { localStorage.setItem('arcade:dice:line', String(line)); } catch { /* not vital */ }
      showOdds();
    }
    function setSide(o) {
      if (busy) return;
      over = o;
      try { localStorage.setItem('arcade:dice:over', over ? '1' : '0'); } catch { /* not vital */ }
      showOdds();
    }

    function roll() {
      if (busy) return;
      const stake = bet.value, chance = chanceOf(line, over);
      if (!table.stake(stake)) { table.settle(); return; }
      busy = true; bet.lock(true); go.disabled = true; slider.disabled = true;
      const value = Math.floor(Math.random() * 10000) / 100;
      const won = wins(value, line, over), prize = won ? payout(stake, chance) : 0;
      table.credit(prize);
      msg.textContent = 'Rolling…'; msg.className = 'cz-msg';
      rollEl.className = 'dc-roll rolling';
      mark.style.setProperty('--v', String(value / 100)); mark.className = 'dc-mark on';
      const started = performance.now();
      timer = setInterval(() => {
        const done = performance.now() - started > 520;
        rollEl.textContent = (done ? value : Math.random() * 100).toFixed(2);
        if (!done) return;
        clearInterval(timer); timer = null;
        rollEl.className = 'dc-roll ' + (won ? 'good' : 'bad');
        mark.className = 'dc-mark on ' + (won ? 'good' : 'bad');
        msg.textContent = won ? `${value.toFixed(2)} wins: +${souls(prize - stake)}` : `${value.toFixed(2)} loses`;
        msg.className = 'cz-msg ' + (won ? 'good' : 'bad');
        const chip = document.createElement('span');
        chip.textContent = value.toFixed(2); chip.className = won ? 'good' : 'bad';
        past.prepend(chip);
        while (past.children.length > 10) past.lastChild.remove();
        if (won) table.won(prize - stake);
        busy = false; bet.lock(false); go.disabled = false; slider.disabled = false;
        table.show(); showOdds();
        table.settle();
      }, 40);
    }

    slider.addEventListener('input', () => setLine(Number(slider.value)));
    slider.addEventListener('change', () => slider.blur()); // the arrow keys then belong to the game again
    $('dc-side').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); setSide(b.dataset.o === '1'); } });
    go.addEventListener('click', () => { go.blur(); roll(); });
    showOdds();
    return {
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) roll(); return true; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { setLine(line + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1)); return true; }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { bet.step(e.key === 'ArrowUp' ? 1 : -1); return true; }
        if (e.key === 'o' || e.key === 'u') { setSide(e.key === 'o'); return true; }
      },
      destroy() { clearInterval(timer); },
    };
  },
};
