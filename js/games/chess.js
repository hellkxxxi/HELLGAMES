import { drawIcons } from '../util.js';
import { KING, bestMove, fromFEN, inCheck, kingOf, legalMoves, notation, play, positionKey, standing } from '../chess.js';

// The rules and the computer are in js/chess.js; this is the board on the page.
// The pieces are drawn here, each in a box of 100 by 100: closed shapes, so that a white piece is white
// all over and a black one black, whatever the colour of the square under it.
const FOOT = '<path d="M20 80h60a4 4 0 0 1 4 4v6H16v-6a4 4 0 0 1 4-4z"/>';
const SHAPES = [null,
  '<path d="M41 42h18c0 14 12 20 14 38H27c2-18 14-24 14-38z"/><circle cx="50" cy="30" r="13"/><path d="M26 80h48a4 4 0 0 1 4 4v6H22v-6a4 4 0 0 1 4-4z"/>',
  `<path d="M30 80c0-16 10-24 12-34l-12 8-8-10 16-22-2-10 10 6c22 0 32 22 28 62z"/><circle class="cut" cx="40" cy="31" r="2.6"/>${FOOT}`,
  `<circle cx="50" cy="13" r="6"/><path d="M50 19c14 9 20 24 10 37H40c-10-13-4-28 10-37z"/><path class="cut" d="M56 31l-7 11"/><path d="M36 56h28v7H36z"/><path d="M40 63h20l10 17H30z"/>${FOOT}`,
  `<path d="M26 14h11v8h8v-8h10v8h8v-8h11v20l-8 8v28l8 10H26l8-10V42l-8-8z"/>${FOOT}`,
  `<path d="M18 34l12 30h40l12-30-9 12-7-20-8 18-8-22-8 22-8-18-7 20z"/><circle cx="18" cy="31" r="4.5"/><circle cx="34" cy="23" r="4.5"/><circle cx="50" cy="19" r="4.5"/><circle cx="66" cy="23" r="4.5"/><circle cx="82" cy="31" r="4.5"/><path d="M30 64h40l4 16H26z"/>${FOOT}`,
  `<path d="M46 6h8v7h7v8h-7v9h-8v-9h-7v-8h7z"/><path d="M50 30c10-8 34-2 30 16-2 8-8 12-12 18H32c-4-6-10-10-12-18-4-18 20-24 30-16z"/><path d="M32 64h36l4 16H28z"/>${FOOT}`,
];
const pieceHTML = (piece) => `<svg class="ch-piece ${piece > 0 ? 'w' : 'b'}" viewBox="0 0 100 100" aria-hidden="true">${SHAPES[Math.abs(piece)]}</svg>`;
const NAME = [null, 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const WORTH = [0, 1, 3, 3, 5, 9, 0];
const ENDS = { stalemate: ['Stalemate', 'No move left and no check: a draw.'], fifty: ['A draw', 'Fifty moves without a pawn move or a capture.'], repeat: ['A draw', 'The same position for the third time.'], bare: ['A draw', 'Too little is left to give mate with.'] };
const saved = {
  get(key) { try { return localStorage.getItem('arcade:chess:' + key); } catch { return null; } },
  set(key, v) { try { if (v === null) localStorage.removeItem('arcade:chess:' + key); else localStorage.setItem('arcade:chess:' + key, v); } catch { /* private mode */ } },
};
const code = (m) => `${m.from}-${m.to}-${m.promo}`; // a move, written so that it can be saved and found again

export default {
  id: 'chess', name: 'Chess', icon: 'chess-knight', color: '#eab308', tag: 'Tabletop', since: '1.1',
  desc: 'The real game with all its rules. Against the computer on three levels, or two players at one board.',
  help: 'Click a piece, then the square it should go to · U takes a move back · F turns the board · a game you leave is still there when you come back',
  scoreLabel: 'Streak',
  variants: { easy: 'Easy', normal: 'Normal', hard: 'Hard', duo: '2 players' },
  create(stage, api) {
    const { variants } = this;
    stage.innerHTML = `
      <div class="chess">
        <div class="mn-top">
          <div class="seg" id="ch-mode">${Object.entries(variants).map(([id, name]) => `<button data-m="${id}">${name}</button>`).join('')}</div>
        </div>
        <div class="ch-taken" id="ch-top"></div>
        <div class="ch-wrap">
          <div class="ch-board" id="ch-board"></div>
          <div class="ch-promo" id="ch-promo" hidden></div>
        </div>
        <div class="ch-taken" id="ch-bottom"></div>
        <div class="sb-bar">
          <button class="bt-tool" id="ch-undo" title="Take a move back (U)"><i data-lucide="undo-2"></i><span>Undo</span></button>
          <button class="bt-tool" id="ch-side" title="Play the other colour"><i data-lucide="arrow-left-right"></i><span id="ch-side-text"></span></button>
          <button class="bt-tool" id="ch-flip" title="Turn the board (F)"><i data-lucide="rotate-cw"></i><span>Turn</span></button>
        </div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const boardEl = $('ch-board'), promoEl = $('ch-promo'), modeBtns = [...stage.querySelectorAll('#ch-mode button')];
    let mode, pos, log, seen, human, turned, picked = -1, options = [], over = '', thinking = false, timer = null, alive = true, wanted = null;
    let helped = false; // a move was taken back in this game: it is played for fun then, not for the streak

    const streakKey = () => 'streak:' + mode;
    const streak = () => Number(saved.get(streakKey())) || 0;
    const mine = () => mode === 'duo' || pos.white === human; // may the person at the screen move now?
    const keep = () => saved.set('game:' + mode, over ? null : JSON.stringify({ human, helped, moves: log.map((entry) => entry.code) }));

    // ---- drawing
    function draw() {
      const last = log[log.length - 1], check = !over || over === 'mate' ? (inCheck(pos) ? kingOf(pos, pos.white) : -1) : -1;
      const targets = new Map(options.map((m) => [m.to, m]));
      let html = '';
      for (let k = 0; k < 64; k++) {
        const s = turned ? 63 - k : k, piece = pos.b[s], row = s >> 3, col = s & 7;
        const cls = ['ch-sq', (row + col) & 1 ? 'dark' : 'light'];
        if (s === picked) cls.push('picked');
        if (last && (s === last.from || s === last.to)) cls.push('last');
        if (s === check) cls.push('check');
        if (targets.has(s)) cls.push(piece || targets.get(s).kind === 'ep' ? 'take' : 'go');
        const label = `${'abcdefgh'[col]}${8 - row}${piece ? `, ${piece > 0 ? 'white' : 'black'} ${NAME[Math.abs(piece)]}` : ''}`;
        const marks = (k % 8 === 0 ? `<em class="rank">${8 - row}</em>` : '') + (k >= 56 ? `<em class="file">${'abcdefgh'[col]}</em>` : '');
        html += `<button class="${cls.join(' ')}" data-s="${s}" aria-label="${label}">${marks}${piece ? pieceHTML(piece) : ''}</button>`;
      }
      boardEl.innerHTML = html;
      // what each side has taken, and who is how much ahead
      const left = { 1: [], '-1': [] };
      for (const piece of pos.b) if (piece && Math.abs(piece) !== KING) left[Math.sign(piece)].push(Math.abs(piece));
      const start = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
      const lost = (sign) => { const rest = left[sign].slice(), gone = []; for (const kind of start) { const at = rest.indexOf(kind); if (at >= 0) rest.splice(at, 1); else gone.push(kind); } return gone.sort((a, b) => a - b); };
      const sum = (sign) => left[sign].reduce((n, kind) => n + WORTH[kind], 0), lead = sum(1) - sum(-1);
      const row = (sign) => { // the pieces this side has taken from the other, and its lead in pawns
        const ahead = sign * lead;
        return lost(-sign).map((kind) => pieceHTML(-sign * kind)).join('') + (ahead > 0 ? `<b>+${ahead}</b>` : '');
      };
      const below = turned ? -1 : 1;
      $('ch-bottom').innerHTML = row(below); $('ch-top').innerHTML = row(-below);
      $('ch-undo').disabled = thinking || !log.length;
      $('ch-side').hidden = mode === 'duo';
      $('ch-side-text').textContent = human ? 'Play Black' : 'Play White';
    }
    function say() {
      const n = Math.ceil((log.length + 1) / 2), who = pos.white ? 'White' : 'Black';
      if (over) { api.status(''); return; }
      const check = inCheck(pos) ? ' · check!' : '';
      api.status(mode === 'duo' ? `Move ${n} · ${who} to move${check}` : mine() ? `Move ${n} · your move${check}` : `Move ${n} · the computer thinks…`);
    }

    // ---- the game
    function end(state) {
      over = state; keep();
      if (state === 'mate') {
        const winner = pos.white ? 'Black' : 'White', moves = Math.ceil(log.length / 2);
        if (mode === 'duo') { api.finish(null, { title: `Checkmate: ${winner} wins`, text: `In ${moves} moves`, icon: 'trophy' }); return; }
        const won = pos.white !== human;
        if (won && helped) { api.finish(null, { title: 'Checkmate: you win', text: `In ${moves} moves. With moves taken back it does not count for the streak.`, icon: 'trophy' }); return; }
        const now = won ? streak() + 1 : 0;
        saved.set(streakKey(), String(now));
        api.score(now);
        api.finish(now, { title: won ? 'Checkmate: you win' : 'Checkmate', text: won ? `In ${moves} moves · ${now} ${now === 1 ? 'win' : 'wins'} in a row` : 'The computer wins. The streak starts again.', icon: won ? 'trophy' : 'flag' });
        return;
      }
      api.finish(null, { title: ENDS[state][0], text: ENDS[state][1], icon: 'handshake' });
    }
    function make(m) {
      const text = notation(pos, m);
      play(pos, m);
      log.push({ code: code(m), from: m.from, to: m.to, text }); seen.push(positionKey(pos));
      picked = -1; options = []; promoEl.hidden = true; wanted = null;
      const state = standing(pos, seen);
      draw(); keep(); say();
      if (state && state !== 'check') { end(state); return; }
      if (!mine()) think();
    }
    function think() {
      thinking = true; draw(); say();
      timer = setTimeout(() => { // a breath, so that the move just made is seen before the computer answers
        if (!alive) return;
        const m = bestMove(pos, mode);
        thinking = false;
        if (m) make(m);
      }, 260);
    }
    // Sets the pieces up and plays the saved moves again, all of them or all but the last few.
    function replay(codes) {
      pos = fromFEN(); log = []; seen = [positionKey(pos)]; over = ''; picked = -1; options = [];
      for (const c of codes) {
        const m = legalMoves(pos).find((x) => code(x) === c);
        if (!m) break; // a saved game that does not make sense: play on from where it still does
        const text = notation(pos, m);
        play(pos, m); log.push({ code: c, from: m.from, to: m.to, text }); seen.push(positionKey(pos));
      }
    }
    function open(fresh = false) {
      clearTimeout(timer); thinking = false; api.hideOverlay(); promoEl.hidden = true;
      mode = variants[api.variant()] ? api.variant() : 'easy';
      modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
      let codes = [];
      human = saved.get('side') !== 'black'; helped = false;
      try { const was = !fresh && JSON.parse(saved.get('game:' + mode) || 'null'); if (was && Array.isArray(was.moves)) { codes = was.moves; helped = !!was.helped; if (mode !== 'duo') human = was.human !== false; } } catch { /* start a new game */ }
      replay(codes);
      turned = mode !== 'duo' && !human;
      api.score(mode === 'duo' ? '–' : streak());
      const state = standing(pos, seen);
      draw(); keep(); say();
      if (state && state !== 'check') end(state); else if (!mine()) think();
    }
    function undo() {
      if (thinking || !log.length) return;
      api.hideOverlay();
      // Against the computer a move back goes back to one's own last move: the answer to it goes too.
      let n = log.length - 1;
      if (mode !== 'duo') { helped = true; while (n > 0 && (n % 2 === 0) !== human) n--; }
      replay(log.slice(0, n).map((entry) => entry.code));
      draw(); keep(); say();
      if (!mine()) think();
    }
    function click(s) {
      if (over || thinking || !mine()) return;
      const move = options.filter((m) => m.to === s);
      if (move.length > 1) { // a pawn on the last row: which piece is it to become?
        wanted = move;
        promoEl.innerHTML = move.map((m) => `<button data-p="${m.promo}" aria-label="${NAME[m.promo]}">${pieceHTML(pos.white ? m.promo : -m.promo)}</button>`).join('');
        promoEl.hidden = false;
        return;
      }
      if (move.length === 1) { make(move[0]); return; }
      const own = pos.b[s] !== 0 && pos.b[s] > 0 === pos.white;
      picked = own && s !== picked ? s : -1;
      options = picked >= 0 ? legalMoves(pos).filter((m) => m.from === picked) : [];
      promoEl.hidden = true; wanted = null;
      draw();
    }

    boardEl.addEventListener('click', (e) => { const b = e.target.closest('.ch-sq'); if (b) { b.blur(); click(Number(b.dataset.s)); } });
    promoEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && wanted) make(wanted.find((m) => m.promo === Number(b.dataset.p))); });
    $('ch-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); if (b.dataset.m !== mode) { api.variant(b.dataset.m); open(); } } });
    $('ch-undo').addEventListener('click', (e) => { e.currentTarget.blur(); undo(); });
    $('ch-flip').addEventListener('click', (e) => { e.currentTarget.blur(); turned = !turned; draw(); });
    $('ch-side').addEventListener('click', (e) => { // the other colour: a new game, with the board the right way round
      e.currentTarget.blur();
      saved.set('side', human ? 'black' : 'white'); saved.set('game:' + mode, null);
      open(true);
    });
    open();
    return {
      // Restart sets the pieces up again. A game against the computer that is given up in the middle ends the streak.
      restart() {
        if (mode !== 'duo' && !over && log.length > 1) { saved.set(streakKey(), '0'); }
        saved.set('game:' + mode, null);
        open(true);
      },
      key(e) {
        if (e.key === 'u') { if (!e.repeat) undo(); return true; }
        if (e.key === 'f') { if (!e.repeat) { turned = !turned; draw(); } return true; }
        if (wanted && 'qrbn'.includes(e.key)) { make(wanted.find((m) => m.promo === { q: 5, r: 4, b: 3, n: 2 }[e.key])); return true; }
      },
      destroy() { alive = false; clearTimeout(timer); },
    };
  },
};
