import { drawIcons } from '../util.js';
import { cardHTML, cardName, deckOf } from '../cards.js';

// ---------------------------------------------------------------- the rules (nothing is shown here)
// Durak, the fool, for two: 36 cards, six in each hand, and the last card of the deck names the trump
// suit. The attacker leads a card; the defender beats it with a higher card of its suit or with a
// trump, or takes everything that is on the table. Cards of a rank that is already on the table may be
// thrown in. Whoever is left holding cards when the deck is gone is the fool.
export const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const HAND = 6;
const rank = (card) => RANKS.indexOf(card.rank);
// Does `card` beat `target`? A higher card of the same suit does, and any trump beats any other suit.
export const beats = (card, target, trump) => (card.suit === target.suit ? rank(card) > rank(target) : card.suit === trump);
// How dear a card is to its owner: trumps are worth more than any plain card.
export const worth = (card, trump) => rank(card) + (card.suit === trump ? RANKS.length : 0);

// A game. Player 0 is the one at the screen, player 1 the devil. The table is a list of
// { attack, defence } pairs; `attacker` says who leads, `taking` that the defender has given up on
// this bout, and `turn` who has to do something now.
export function createGame(rnd = Math.random) {
  const deck = deckOf(RANKS, rnd); // cards are drawn from the end; the first one lies open under the deck and is drawn last
  const g = { deck, trump: deck[0].suit, hands: [[], []], table: [], attacker: 0, taking: false, turn: 0, limit: HAND, gone: 0, over: false, fool: null };
  for (let n = 0; n < HAND; n++) for (const p of [0, 1]) g.hands[p].push(deck.pop());
  // the one with the lowest trump leads first; with no trump in either hand, the player does
  const lowest = (p) => Math.min(...g.hands[p].filter((c) => c.suit === g.trump).map(rank), 99);
  g.attacker = lowest(1) < lowest(0) ? 1 : 0;
  g.turn = g.attacker;

  const defender = () => 1 - g.attacker;
  const open = () => g.table.find((pair) => !pair.defence); // the attack card that is not beaten yet
  // What the given player may do now: { type: 'attack' | 'defend', card } or { type: 'take' | 'done' }.
  g.options = (p) => {
    if (g.over || p !== g.turn) return [];
    if (p === g.attacker) {
      const ranksOut = new Set(g.table.flatMap((pair) => [pair.attack.rank, pair.defence?.rank]));
      const room = g.table.length < g.limit; // no more attack cards than the defender held when the bout began, and never more than six
      const cards = g.hands[p].filter((c) => room && (!g.table.length || ranksOut.has(c.rank)));
      return [...cards.map((card) => ({ type: 'attack', card })), ...(g.table.length ? [{ type: 'done' }] : [])];
    }
    return [...g.hands[p].filter((c) => beats(c, open().attack, g.trump)).map((card) => ({ type: 'defend', card })), { type: 'take' }];
  };
  const refill = (p) => { while (g.hands[p].length < HAND && g.deck.length) g.hands[p].push(g.deck.pop()); };
  // The bout is over: the cards go to the defender or out of the game, both draw (the attacker first), and the next bout begins.
  function close() {
    const lead = g.attacker;
    if (g.taking) g.hands[defender()].push(...g.table.flatMap((pair) => [pair.attack, pair.defence].filter(Boolean)));
    else { g.gone += g.table.reduce((n, pair) => n + 2, 0); g.attacker = defender(); } // beaten: the defender leads next
    g.table = []; g.taking = false;
    refill(lead); refill(1 - lead);
    const empty = [0, 1].filter((p) => !g.hands[p].length);
    if (empty.length) { g.over = true; g.fool = empty.length === 2 ? null : 1 - empty[0]; return; } // the deck is gone and somebody has no cards left
    g.turn = g.attacker; g.limit = Math.min(HAND, g.hands[defender()].length);
  }
  g.act = (p, action) => {
    const allowed = g.options(p).find((o) => o.type === action.type && (!o.card || (o.card.rank === action.card.rank && o.card.suit === action.card.suit)));
    if (!allowed) return false;
    const hand = g.hands[p];
    if (allowed.card) hand.splice(hand.indexOf(allowed.card), 1);
    if (allowed.type === 'attack') { g.table.push({ attack: allowed.card, defence: null }); if (!g.taking) g.turn = defender(); }
    else if (allowed.type === 'defend') { open().defence = allowed.card; g.turn = g.attacker; }
    else if (allowed.type === 'take') { g.taking = true; g.turn = g.attacker; }
    else close();
    return true;
  };
  // True when nothing more can happen in this bout: every card on the table is answered (or taken) and
  // the attacker has no card to add, or no room for one, or the defender has no cards left to answer with.
  g.stuck = () => !g.over && g.table.length > 0 && g.turn === g.attacker && (!g.options(g.attacker).some((o) => o.type === 'attack') || (!g.taking && !g.hands[defender()].length));
  g.endBout = () => { if (!g.over && g.table.length && g.turn === g.attacker) close(); };
  return g;
}

// What the devil does: an option out of g.options(p). It parts with its cheapest cards first, keeps
// its trumps for later, and takes rather than spend a high trump while the deck is still thick.
export function devilMove(g, p = 1) {
  const options = g.options(p), cheapest = (list) => list.reduce((a, b) => (worth(b.card, g.trump) < worth(a.card, g.trump) ? b : a));
  const late = g.deck.length === 0;
  if (p === g.attacker) {
    const cards = options.filter((o) => o.type === 'attack');
    if (!g.table.length) return cheapest(cards);
    // Throwing in: small plain cards always, pictures only to press a defender who still fights, and
    // trumps and aces only when the deck is gone and the cards simply have to go.
    const top = RANKS.indexOf(g.taking ? '10' : 'Q');
    const fine = cards.filter((o) => late || (o.card.suit !== g.trump && rank(o.card) <= top));
    return fine.length ? cheapest(fine) : { type: 'done' };
  }
  const answers = options.filter((o) => o.type === 'defend');
  if (!answers.length) return { type: 'take' };
  const answer = cheapest(answers), target = g.table.find((pair) => !pair.defence).attack;
  const dear = answer.card.suit === g.trump && target.suit !== g.trump && rank(answer.card) >= RANKS.indexOf('Q');
  return dear && g.deck.length > 6 && g.table.length <= 2 ? { type: 'take' } : answer;
}

// ---------------------------------------------------------------- the game on the page
const WAIT = 720; // how long the devil takes over a move
const saved = {
  get(key) { try { return localStorage.getItem('arcade:durak:' + key); } catch { return null; } },
  set(key, v) { try { localStorage.setItem('arcade:durak:' + key, v); } catch { /* private mode */ } },
};
const SUIT_ICON = { spades: 'spade', hearts: 'heart', diamonds: 'diamond', clubs: 'club' };

export default {
  id: 'durak', name: 'Durak', icon: 'club', color: '#fb7185', tag: 'Tabletop', since: '1.1',
  desc: 'The card game of the fool, against the devil. Beat his cards or take them: do not be the last one holding any.',
  help: 'Click a card to play it · beat a card with a higher one of its suit or with a trump · Take picks the table up · Done ends your attack · T and D do the same',
  scoreLabel: 'Streak',
  create(stage, api) {
    stage.innerHTML = `
      <div class="durak">
        <div class="dk-row dk-devil" id="dk-devil"></div>
        <div class="dk-mid">
          <div class="dk-deck" id="dk-deck"></div>
          <div class="dk-table" id="dk-table"></div>
        </div>
        <p class="cz-msg" id="dk-msg" role="status"></p>
        <div class="dk-hand" id="dk-hand"></div>
        <div class="cz-bar"><button class="bj-btn" id="dk-take">Take</button><button class="btn-primary" id="dk-done">Done</button></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const handEl = $('dk-hand'), msg = $('dk-msg'), takeBtn = $('dk-take'), doneBtn = $('dk-done');
    let g = createGame(), timer = null, alive = true, flash = ''; // flash: a word about what has just happened, shown for a moment
    let laid = new Set(); // the cards that are on the table already
    const streak = () => Number(saved.get('streak')) || 0;
    const sorted = (hand) => hand.slice().sort((a, b) => worth(a, g.trump) - worth(b, g.trump) || a.suit.localeCompare(b.suit));
    const later = (fn, ms) => { timer = setTimeout(() => { if (alive) fn(); }, ms); };

    function telling() {
      if (g.over) return '';
      if (g.turn === 1) return 'The devil is thinking…';
      if (g.attacker === 1) return 'Beat the card, or take';
      if (g.taking) return 'The devil takes. Throw in more, or be done';
      return g.table.length ? 'Throw in a card of a rank that is on the table, or be done' : 'Your attack: lead a card';
    }
    function draw() {
      const mine = flash ? [] : g.options(0), playable = new Set(mine.filter((o) => o.card).map((o) => cardName(o.card)));
      $('dk-devil').innerHTML = g.hands[1].map(() => cardHTML(null)).join('') + `<span class="dk-count">${g.hands[1].length}</span>`;
      // the deck with the trump card beside it; once the deck is gone, a sign of the trump suit stays behind
      const red = g.trump === 'hearts' || g.trump === 'diamonds' ? ' red' : '';
      $('dk-deck').innerHTML = (g.deck.length ? cardHTML(g.deck[0], 'dk-trump') + (g.deck.length > 1 ? cardHTML(null, 'dk-stock') : '') : `<div class="dk-suit${red}"><i data-lucide="${SUIT_ICON[g.trump]}"></i></div>`)
        + `<span class="dk-count${red}"><i data-lucide="${SUIT_ICON[g.trump]}"></i>${g.deck.length ? `${g.deck.length} left` : 'trump'}</span>`;
      // only a card that has just been played slides in; the ones that lay there already stay still
      const fresh = (c) => (laid.has(cardName(c)) ? '' : ' new');
      $('dk-table').innerHTML = g.table.map((pair) => `<div class="dk-pair">${cardHTML(pair.attack, fresh(pair.attack))}${pair.defence ? cardHTML(pair.defence, 'dk-over' + fresh(pair.defence)) : ''}</div>`).join('');
      laid = new Set(g.table.flatMap((pair) => [pair.attack, pair.defence]).filter(Boolean).map(cardName));
      // the hand: so many cards to a row that each one can still be told and touched
      const cards = sorted(g.hands[0]), perRow = Math.ceil(cards.length / Math.ceil(cards.length / 12)) || 1, rows = [];
      for (let i = 0; i < cards.length; i += perRow) rows.push(cards.slice(i, i + perRow));
      handEl.innerHTML = rows.map((row) => `<div class="dk-row" style="--n:${row.length}">${row.map((c) => cardHTML(c, playable.has(cardName(c)) ? 'can' : '', 'button')).join('')}</div>`).join('');
      takeBtn.disabled = !mine.some((o) => o.type === 'take'); doneBtn.disabled = !mine.some((o) => o.type === 'done');
      msg.textContent = flash || telling();
      api.status(`Trump: ${g.trump} · ${g.deck.length}`);
      drawIcons();
    }
    function finish() {
      if (g.fool === null) { api.finish(null, { title: 'A draw', text: 'Both hands are empty at once. Nobody is the fool.', icon: 'handshake' }); return; }
      const won = g.fool === 1, now = won ? streak() + 1 : 0;
      saved.set('streak', String(now)); api.score(now);
      api.finish(now, { title: won ? 'The devil is the fool' : 'You are the fool', text: won ? `You got rid of your cards first · ${now} ${now === 1 ? 'win' : 'wins'} in a row` : 'The devil got rid of his cards first. The streak starts again.', icon: won ? 'trophy' : 'flag' });
    }
    // The end of a bout is shown for a moment before the table is cleared: who took, or that all was beaten.
    function bout(end) {
      flash = g.taking ? (g.attacker === 0 ? 'The devil takes the cards' : 'You take the cards') : 'Beaten';
      draw();
      later(() => { flash = ''; end(); next(); }, 900);
    }
    // After every move: show it, end the game if it is over, clear the table if the bout is, or let the devil have its turn.
    function next() {
      draw();
      if (g.over) { later(finish, 600); return; }
      if (g.stuck()) { bout(() => g.endBout()); return; }
      if (g.turn !== 1) return;
      later(() => {
        const move = devilMove(g);
        if (move.type === 'done') bout(() => g.act(1, move)); else { g.act(1, move); next(); }
      }, WAIT);
    }
    function act(action) {
      if (g.turn !== 0 || g.over || flash) return;
      clearTimeout(timer);
      if (g.act(0, action)) next();
    }
    handEl.addEventListener('click', (e) => {
      const b = e.target.closest('.pc');
      if (!b) return;
      b.blur();
      const card = { rank: b.dataset.rank, suit: b.dataset.suit }, option = g.options(0).find((o) => o.card && cardName(o.card) === cardName(card));
      if (option) act(option);
      else { b.classList.remove('no'); void b.offsetWidth; b.classList.add('no'); } // a card that cannot be played shakes its head
    });
    takeBtn.addEventListener('click', () => { takeBtn.blur(); act({ type: 'take' }); });
    doneBtn.addEventListener('click', () => { doneBtn.blur(); act({ type: 'done' }); });
    api.score(streak());
    next();
    return {
      key(e) {
        if (e.key === 't') { if (!e.repeat) act({ type: 'take' }); return true; }
        if (e.key === 'd' || e.key === ' ' || e.key === 'Enter') { if (!e.repeat) act({ type: 'done' }); return true; }
      },
      destroy() { alive = false; clearTimeout(timer); },
    };
  },
};
