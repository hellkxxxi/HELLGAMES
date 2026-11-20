import { drawIcons } from '../util.js';
import { createBet, createTable, souls, wallet } from '../casino.js';
import { SUITS, cardHTML } from '../cards.js';

// ---------------------------------------------------------------- the rules (nothing is shown here)
// Closest to 21 without going over wins. Pictures count 10, an ace 11 or 1. The dealer draws up to
// 17 and then stands. Twenty-one with the first two cards is a blackjack and pays three to two.
// Cards come from a shoe that never runs low: every card is as likely as any other, every time.
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const draw = (rnd = Math.random) => ({ rank: RANKS[Math.floor(rnd() * RANKS.length)], suit: SUITS[Math.floor(rnd() * SUITS.length)] });
const worth = (rank) => (rank === 'A' ? 11 : 'JQK'.includes(rank) || rank === '10' ? 10 : Number(rank));
// What a hand counts: its sum, and whether an ace in it still counts 11 ("soft").
export function total(cards) {
  let sum = cards.reduce((n, c) => n + worth(c.rank), 0), aces = cards.filter((c) => c.rank === 'A').length;
  while (sum > 21 && aces > 0) { sum -= 10; aces--; }
  return { sum, soft: aces > 0 };
}
export const isBlackjack = (cards) => cards.length === 2 && total(cards).sum === 21;
// The dealer's turn: cards are added to the hand until it counts 17 or more.
export function dealerPlays(cards, rnd = Math.random) {
  while (total(cards).sum < 17) cards.push(draw(rnd));
  return cards;
}
// How a finished round went for the player: 'blackjack', 'win', 'push' (a draw), 'lose' or 'bust'.
export function outcome(player, dealer) {
  const mine = total(player).sum, theirs = total(dealer).sum;
  if (mine > 21) return 'bust';
  if (isBlackjack(player)) return isBlackjack(dealer) ? 'push' : 'blackjack';
  if (isBlackjack(dealer)) return 'lose';
  if (theirs > 21 || mine > theirs) return 'win';
  return mine === theirs ? 'push' : 'lose';
}
// What comes back to the player for a stake, the stake itself included.
export const payout = (result, stake) => ({ blackjack: stake + Math.floor(stake * 3 / 2), win: stake * 2, push: stake }[result] || 0);

// ---------------------------------------------------------------- the game on the page
const WORDS = { blackjack: 'Blackjack!', win: 'You win', push: 'A draw: the bet comes back', lose: 'The dealer wins', bust: 'Over 21: bust' };
const PAUSE = 420; // between one card and the next

export default {
  id: 'blackjack', name: 'Blackjack', icon: 'spade', color: '#34d399', tag: 'Casino', since: '1.1',
  desc: 'Closer to 21 than the dealer, but not over it. Blackjack pays three to two. Souls are play money.',
  help: 'Space deals · H or Space takes a card · S stands · D doubles the bet for one last card · arrow keys change the bet · the dealer stands on 17',
  scoreLabel: 'Souls', bestLabel: 'Top win', format: souls,
  create(stage, api) {
    stage.innerHTML = `
      <div class="bj">
        <div class="bj-table">
          <div class="bj-side"><span>Dealer</span><output id="bj-dealer-sum"></output></div>
          <div class="bj-hand" id="bj-dealer"></div>
          <div class="bj-hand" id="bj-player"></div>
          <div class="bj-side"><span>You</span><output id="bj-player-sum"></output></div>
        </div>
        <p class="cz-msg" id="bj-msg" role="status">Place your bet</p>
        <div class="cz-bar" id="bj-bet-bar"><div id="bj-bet"></div><button class="btn-primary" id="bj-deal">Deal</button></div>
        <div class="cz-bar bj-acts" id="bj-acts" hidden>
          <button class="btn-primary" id="bj-hit">Hit</button><button class="bj-btn" id="bj-stand">Stand</button><button class="bj-btn" id="bj-double">Double</button>
        </div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const msg = $('bj-msg'), dealerEl = $('bj-dealer'), playerEl = $('bj-player'), acts = $('bj-acts'), betBar = $('bj-bet-bar');
    const bet = createBet($('bj-bet'), 'blackjack'), table = createTable(api, bet);
    let player = [], dealer = [], stake = 0, state = 'bet', hidden = true, timers = [], alive = true; // bet → deal → play → dealer → bet
    let shown = { dealer: 0, player: 0, hidden: true }; // what is on the table already: only a card that is new slides in
    const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));

    function show() {
      const hand = (cards, hide, was, turned) => cards.map((c, i) => cardHTML(hide && i === 1 ? null : c, i >= was || (turned && i === 1) ? 'new' : '')).join('');
      dealerEl.innerHTML = hand(dealer, hidden, shown.dealer, shown.hidden && !hidden); playerEl.innerHTML = hand(player, false, shown.player, false);
      shown = { dealer: dealer.length, player: player.length, hidden };
      const sum = (cards) => { const t = total(cards); return cards.length ? (t.soft && t.sum < 21 ? `${t.sum - 10} or ${t.sum}` : String(t.sum)) : ''; };
      $('bj-player-sum').textContent = sum(player);
      $('bj-dealer-sum').textContent = hidden ? sum(dealer.slice(0, 1)) : sum(dealer);
      acts.hidden = state !== 'play'; betBar.hidden = state === 'play'; // while the dealer draws the bet stays where it is, switched off, so that nothing jumps
      $('bj-double').disabled = player.length !== 2 || stake > wallet.balance;
      $('bj-deal').disabled = state !== 'bet';
      drawIcons();
    }
    // The round is over: the cards are on the table, the money goes where it belongs.
    function settle() {
      hidden = false;
      const result = outcome(player, dealer), back = payout(result, stake);
      table.credit(back);
      if (back > stake) table.won(back - stake);
      state = 'bet'; bet.lock(false);
      msg.textContent = `${WORDS[result]}${back > stake ? ` +${souls(back - stake)}` : ''}`;
      msg.className = 'cz-msg ' + (back > stake ? 'good' : back < stake ? 'bad' : '');
      show(); table.show(); table.settle();
    }
    function deal() {
      if (state !== 'bet') return;
      if (!table.stake(bet.value)) { table.settle(); return; }
      stake = bet.value; state = 'deal'; hidden = true; bet.lock(true);
      player = []; dealer = []; shown = { dealer: 0, player: 0, hidden: true };
      msg.textContent = 'Dealing…'; msg.className = 'cz-msg';
      const order = [player, dealer, player, dealer];
      order.forEach((hand, k) => later(() => { hand.push(draw()); show(); }, k * 200));
      later(() => {
        if (isBlackjack(player) || isBlackjack(dealer)) { settle(); return; } // the dealer looks at the hidden card: a blackjack ends the round at once
        state = 'play'; msg.textContent = 'Hit or stand?'; show();
      }, order.length * 200 + 150);
      show();
    }
    function dealerTurn() {
      state = 'dealer'; hidden = false; msg.textContent = 'The dealer draws…'; msg.className = 'cz-msg';
      show();
      const step = () => {
        if (total(dealer).sum >= 17) { settle(); return; }
        dealer.push(draw()); show();
        later(step, PAUSE);
      };
      later(step, PAUSE);
    }
    function hit() {
      if (state !== 'play') return;
      player.push(draw());
      if (total(player).sum > 21) settle(); else if (total(player).sum === 21) dealerTurn(); else show();
    }
    function stand() { if (state === 'play') dealerTurn(); }
    function double() {
      if (state !== 'play' || player.length !== 2 || !table.stake(stake)) return;
      stake *= 2;
      player.push(draw());
      if (total(player).sum > 21) settle(); else dealerTurn();
    }

    $('bj-deal').addEventListener('click', (e) => { e.currentTarget.blur(); deal(); });
    $('bj-hit').addEventListener('click', (e) => { e.currentTarget.blur(); hit(); });
    $('bj-stand').addEventListener('click', (e) => { e.currentTarget.blur(); stand(); });
    $('bj-double').addEventListener('click', (e) => { e.currentTarget.blur(); double(); });
    show();
    return {
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) { if (state === 'bet') deal(); else hit(); } return true; }
        if (e.key === 'h') { if (!e.repeat) hit(); return true; }
        if (e.key === 's') { if (!e.repeat) stand(); return true; }
        if (e.key === 'd') { if (!e.repeat) double(); return true; }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { if (state === 'bet') bet.step(e.key === 'ArrowUp' ? 1 : -1); return true; }
      },
      // Leaving in the middle of a hand counts as standing: the dealer draws at once and the round is paid out.
      destroy() {
        alive = false; timers.forEach(clearTimeout);
        if (state === 'bet') return;
        while (player.length < 2) player.push(draw());
        while (dealer.length < 2) dealer.push(draw());
        if (total(player).sum <= 21 && !isBlackjack(player) && !isBlackjack(dealer)) dealerPlays(dealer);
        const back = payout(outcome(player, dealer), stake);
        table.credit(back);
        if (back > stake) table.won(back - stake);
      },
    };
  },
};
