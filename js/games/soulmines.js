import { createBet, createTable, souls } from '../casino.js';
import { drawIcons, shuffle } from '../util.js';

// A 5 by 5 field hides some skulls. Every safe tile the player opens raises the prize, and the player
// may take the prize at any moment. A skull takes the bet.
export const TILES = 25;
export const EDGE = 0.99;                  // the house keeps 1% of what a fair game would pay
export const MINE_CHOICES = [1, 3, 5, 10, 24];
// How many bets the prize is worth after `opened` safe tiles with `mines` skulls on the field:
// one over the chance of getting that far, less the house's share.
export function multiplier(opened, mines) {
  let x = EDGE;
  for (let i = 0; i < opened; i++) x *= (TILES - i) / (TILES - mines - i);
  return x;
}
// The prize in whole souls, rounded down. It is counted in whole numbers from start to end: with
// ordinary fractions a prize of exactly 33 can come out as 32.999… and lose a soul in the rounding.
export function prize(bet, opened, mines) {
  let top = BigInt(Math.round(bet)) * BigInt(Math.round(EDGE * 100)), bottom = 100n;
  for (let i = 0; i < opened; i++) { top *= BigInt(TILES - i); bottom *= BigInt(TILES - mines - i); }
  return Number(top / bottom);
}
const times = (x) => (x >= 100 ? Math.round(x).toLocaleString('en-US') : x >= 10 ? x.toFixed(1) : x.toFixed(2));

export default {
  id: 'soulmines', name: 'Soul Mines', icon: 'gem', color: '#fbbf24', tag: 'Casino', since: '1.1',
  desc: 'Open tiles and watch the prize grow. Take it in time: one skull and the bet is gone.',
  help: 'Click or tap the tiles · Space starts a round · C cashes out · souls are play money',
  scoreLabel: 'Souls', bestLabel: 'Top win', format: souls,
  create(stage, api) {
    stage.innerHTML = `
      <div class="smines">
        <div class="sm-top"><span>Skulls</span><div class="seg" id="sm-count">${MINE_CHOICES.map((m) => `<button data-m="${m}">${m}</button>`).join('')}</div></div>
        <div class="sm-grid" id="sm-grid">${Array.from({ length: TILES }, (_, i) => `<button data-i="${i}" aria-label="Tile ${i + 1}"></button>`).join('')}</div>
        <p class="cz-msg" id="sm-msg" role="status"></p>
        <div class="cz-bar"><div id="sm-bet"></div><button class="btn-primary" id="sm-go"></button></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const tiles = [...stage.querySelectorAll('#sm-grid button')], msg = $('sm-msg'), go = $('sm-go'), counts = [...stage.querySelectorAll('#sm-count button')];
    let mines = 3, playing = false, skull = [], opened = 0, stake = 0;
    try { const m = Number(localStorage.getItem('arcade:soulmines:mines')); if (MINE_CHOICES.includes(m)) mines = m; } catch { /* the default will do */ }
    const bet = createBet($('sm-bet'), 'soulmines', () => showIdle());
    const table = createTable(api, bet);

    const say = (text, mood = '') => { msg.textContent = text; msg.className = 'cz-msg ' + mood; };
    function showIdle() {
      if (playing) return;
      counts.forEach((b) => b.classList.toggle('on', Number(b.dataset.m) === mines));
      go.textContent = 'Start';
    }
    function showRound() {
      go.textContent = opened ? `Cash out ${souls(prize(stake, opened, mines))}` : 'Pick a tile';
      go.disabled = !opened;
      const left = TILES - mines - opened;
      say(left ? `Next tile makes it ×${times(multiplier(opened + 1, mines))} · ${left} safe ${left === 1 ? 'tile' : 'tiles'} left` : '');
    }
    const face = (tile, icon, ...kinds) => { tile.innerHTML = `<i data-lucide="${icon}"></i>`; tile.classList.add(...kinds); };

    function begin() {
      if (playing) return;
      stake = bet.value;
      if (!table.stake(stake)) { table.settle(); return; }
      playing = true; opened = 0;
      skull = shuffle(Array.from({ length: TILES }, (_, i) => i < mines));
      tiles.forEach((t) => { t.className = ''; t.innerHTML = ''; t.disabled = false; });
      stage.querySelector('#sm-grid').classList.add('live');
      bet.lock(true); counts.forEach((b) => { b.disabled = true; });
      showRound();
    }
    // Ends the round: every tile shows what it hid, the ones the player never opened in a dim colour.
    function end() {
      playing = false;
      tiles.forEach((t, i) => { if (!t.classList.contains('safe') && !t.classList.contains('boom')) face(t, skull[i] ? 'skull' : 'gem', skull[i] ? 'skull' : 'safe', 'late'); t.disabled = true; });
      stage.querySelector('#sm-grid').classList.remove('live');
      drawIcons();
      bet.lock(false); counts.forEach((b) => { b.disabled = false; });
      go.disabled = false;
      table.show(); showIdle();
      table.settle();
    }
    function cashOut() {
      if (!playing || !opened) return;
      const won = prize(stake, opened, mines);
      table.credit(won); table.won(won - stake);
      say(`You took ${souls(won)}: +${souls(won - stake)}`, 'good');
      end();
    }
    function open(i) {
      const tile = tiles[i];
      if (!playing || tile.classList.contains('safe')) return;
      if (skull[i]) {
        face(tile, 'skull', 'boom');
        say(opened ? `A skull. The ${souls(prize(stake, opened, mines))} you could have taken are gone` : 'A skull on the first tile', 'bad');
        end();
        return;
      }
      face(tile, 'gem', 'safe'); tile.disabled = true; opened++;
      drawIcons();
      if (opened === TILES - mines) cashOut(); else showRound();
    }

    stage.querySelector('#sm-grid').addEventListener('click', (e) => { const t = e.target.closest('button'); if (t) { t.blur(); open(Number(t.dataset.i)); } });
    $('sm-count').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || playing) return;
      b.blur(); mines = Number(b.dataset.m);
      try { localStorage.setItem('arcade:soulmines:mines', String(mines)); } catch { /* not vital */ }
      showIdle(); say(`${mines} ${mines === 1 ? 'skull' : 'skulls'}: the first safe tile pays ×${times(multiplier(1, mines))}`);
    });
    go.addEventListener('click', () => { go.blur(); if (playing) cashOut(); else begin(); });
    showIdle(); say('Choose how many skulls hide in the field, then start');
    return {
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat && !playing) begin(); return true; }
        if (e.key === 'c') { cashOut(); return true; }
        if (!playing && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { bet.step(e.key === 'ArrowUp' ? 1 : -1); return true; }
      },
      // Leaving in the middle of a round takes the prize as it stands; with no tile opened yet, the bet comes back.
      destroy() { if (playing) table.credit(opened ? prize(stake, opened, mines) : stake); },
    };
  },
};
