// The rules of chess and a computer that plays it. Nothing is drawn here.
//
// A square is a number: 0 is a8, 7 is h8, 56 is a1 and 63 is h1, the way White sees the board. A piece
// is a number too: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king, and the same below zero for Black.
// A position is { b: the 64 squares, white: whose move it is, castle: who may still castle
// (1 White short, 2 White long, 4 Black short, 8 Black long), ep: the square a pawn has just jumped
// over (or -1), half: moves since a pawn moved or something was taken, full: the number of the move }.
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
const LETTER = '.pnbrqk';
const KNIGHT_TO = [], KING_TO = [], RAYS = []; // where a knight and a king can go from every square, and the eight rays of the long-range pieces
for (let s = 0; s < 64; s++) {
  const r = s >> 3, c = s & 7, on = (dr, dc) => r + dr >= 0 && r + dr < 8 && c + dc >= 0 && c + dc < 8;
  KNIGHT_TO.push([[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].filter(([dr, dc]) => on(dr, dc)).map(([dr, dc]) => s + dr * 8 + dc));
  KING_TO.push([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].filter(([dr, dc]) => on(dr, dc)).map(([dr, dc]) => s + dr * 8 + dc));
  RAYS.push([[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dr, dc]) => { const ray = []; for (let k = 1; on(dr * k, dc * k); k++) ray.push(s + (dr * 8 + dc) * k); return ray; })); // the first four are the rook's
}
export const squareName = (s) => 'abcdefgh'[s & 7] + (8 - (s >> 3));
export const squareOf = (name) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

// ---------------------------------------------------------------- positions written down (FEN)
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
export function fromFEN(fen = START) {
  const [rows, turn, castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/), b = new Int8Array(64);
  let s = 0;
  for (const ch of rows) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) { s += Number(ch); continue; }
    const kind = LETTER.indexOf(ch.toLowerCase());
    b[s++] = ch === ch.toLowerCase() ? -kind : kind;
  }
  return { b, white: turn !== 'b', castle: [...'KQkq'].reduce((n, ch, i) => n | (castle.includes(ch) ? 1 << i : 0), 0), ep: ep === '-' ? -1 : squareOf(ep), half: Number(half), full: Number(full) };
}
export function toFEN(p) {
  let rows = '';
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const piece = p.b[r * 8 + c];
      if (!piece) { empty++; continue; }
      if (empty) { rows += empty; empty = 0; }
      rows += piece > 0 ? LETTER[piece].toUpperCase() : LETTER[-piece];
    }
    rows += (empty || '') + (r < 7 ? '/' : '');
  }
  const castle = [...'KQkq'].filter((_, i) => p.castle & (1 << i)).join('') || '-';
  return `${rows} ${p.white ? 'w' : 'b'} ${castle} ${p.ep < 0 ? '-' : squareName(p.ep)} ${p.half} ${p.full}`;
}
// What makes two positions the same for the rule of the threefold repetition.
const sameKey = (p) => toFEN(p).split(' ').slice(0, 4).join(' ');

// ---------------------------------------------------------------- attacks and moves
// Is the square attacked by the given side?
export function attacked(p, s, byWhite) {
  const b = p.b, sign = byWhite ? 1 : -1, r = s >> 3, c = s & 7;
  const pr = r + sign; // a pawn of that side stands one row behind the square it attacks
  if (pr >= 0 && pr < 8) {
    if (c > 0 && b[pr * 8 + c - 1] === sign * PAWN) return true;
    if (c < 7 && b[pr * 8 + c + 1] === sign * PAWN) return true;
  }
  for (const t of KNIGHT_TO[s]) if (b[t] === sign * KNIGHT) return true;
  for (const t of KING_TO[s]) if (b[t] === sign * KING) return true;
  for (let d = 0; d < 8; d++) {
    for (const t of RAYS[s][d]) {
      const piece = b[t];
      if (!piece) continue;
      if (piece === sign * QUEEN || piece === sign * (d < 4 ? ROOK : BISHOP)) return true;
      break;
    }
  }
  return false;
}
export const kingOf = (p, white) => p.b.indexOf(white ? KING : -KING);
export const inCheck = (p, white = p.white) => attacked(p, kingOf(p, white), !white);

// Every move the side to move could make if its own king did not matter. A move is
// { from, to, promo: the piece a pawn turns into (or 0), kind: '' | 'two' (a pawn's first long step) |
// 'ep' (taking in passing) | 'short' | 'long' (castling) }. With `taking`, only moves that take something.
function moves(p, taking = false) {
  const b = p.b, sign = p.white ? 1 : -1, list = [];
  const add = (from, to, kind = '') => {
    if ((b[from] === sign * PAWN) && (to < 8 || to >= 56)) for (const promo of [QUEEN, KNIGHT, ROOK, BISHOP]) list.push({ from, to, promo, kind });
    else list.push({ from, to, promo: 0, kind });
  };
  for (let s = 0; s < 64; s++) {
    const piece = b[s] * sign;
    if (piece <= 0) continue;
    if (piece === PAWN) {
      const one = s - 8 * sign, c = s & 7, home = p.white ? 6 : 1;
      if (!taking && !b[one]) { add(s, one); if (s >> 3 === home && !b[one - 8 * sign]) add(s, one - 8 * sign, 'two'); }
      else if (taking && !b[one] && (one < 8 || one >= 56)) add(s, one); // a pawn that turns into a queen is worth looking at even when it takes nothing
      for (const dc of [-1, 1]) {
        if (c + dc < 0 || c + dc > 7) continue;
        const t = one + dc;
        if (b[t] * sign < 0) add(s, t); else if (t === p.ep) add(s, t, 'ep');
      }
    } else if (piece === KNIGHT || piece === KING) {
      for (const t of piece === KNIGHT ? KNIGHT_TO[s] : KING_TO[s]) if (b[t] * sign < 0 || (!taking && !b[t])) add(s, t);
    } else {
      for (let d = piece === BISHOP ? 4 : 0; d < (piece === ROOK ? 4 : 8); d++) {
        for (const t of RAYS[s][d]) {
          if (!b[t]) { if (!taking) add(s, t); continue; }
          if (b[t] * sign < 0) add(s, t);
          break;
        }
      }
    }
  }
  if (!taking) { // castling: king and rook have not moved, nothing stands between them, and the king is not in check and passes no attacked square
    const home = p.white ? 60 : 4, short = p.white ? 1 : 4, long = p.white ? 2 : 8;
    if (p.castle & (short | long) && b[home] === sign * KING && !attacked(p, home, !p.white)) {
      if (p.castle & short && !b[home + 1] && !b[home + 2] && b[home + 3] === sign * ROOK && !attacked(p, home + 1, !p.white)) add(home, home + 2, 'short');
      if (p.castle & long && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === sign * ROOK && !attacked(p, home - 1, !p.white)) add(home, home - 2, 'long');
    }
  }
  return list;
}
const RIGHTS = { 60: 3, 63: 1, 56: 2, 4: 12, 7: 4, 0: 8 }; // the castling rights that go when something leaves or reaches a king's square or a corner
// Makes a move on the position and returns what is needed to take it back with unplay().
export function play(p, m) {
  const b = p.b, sign = p.white ? 1 : -1, piece = b[m.from];
  const undo = { taken: b[m.to], castle: p.castle, ep: p.ep, half: p.half };
  b[m.to] = m.promo ? sign * m.promo : piece; b[m.from] = 0;
  if (m.kind === 'ep') b[m.to + 8 * sign] = 0;
  else if (m.kind === 'short') { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
  else if (m.kind === 'long') { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
  p.castle &= ~((RIGHTS[m.from] || 0) | (RIGHTS[m.to] || 0));
  p.ep = m.kind === 'two' ? m.from - 8 * sign : -1;
  p.half = piece * sign === PAWN || undo.taken ? 0 : p.half + 1;
  if (!p.white) p.full++;
  p.white = !p.white;
  return undo;
}
export function unplay(p, m, undo) {
  const b = p.b;
  p.white = !p.white;
  const sign = p.white ? 1 : -1;
  if (!p.white) p.full--;
  b[m.from] = m.promo ? sign * PAWN : b[m.to]; b[m.to] = undo.taken;
  if (m.kind === 'ep') b[m.to + 8 * sign] = -sign * PAWN;
  else if (m.kind === 'short') { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
  else if (m.kind === 'long') { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
  p.castle = undo.castle; p.ep = undo.ep; p.half = undo.half;
}
// The moves the rules allow: those that do not leave one's own king in check.
export function legalMoves(p) {
  const white = p.white;
  return moves(p).filter((m) => { const undo = play(p, m), ok = !attacked(p, kingOf(p, white), !white); unplay(p, m, undo); return ok; });
}
// How many ways there are to play on for so many moves: the standard test of a move generator.
export function perft(p, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(p)) { const undo = play(p, m); n += depth === 1 ? 1 : perft(p, depth - 1); unplay(p, m, undo); }
  return n;
}

// ---------------------------------------------------------------- how a game stands
// Kings alone, or with a single knight or bishop between them, or with bishops that all stand on
// squares of one colour: nobody can give mate with that.
function bare(p) {
  let knights = 0;
  const bishops = [];
  for (let s = 0; s < 64; s++) {
    const piece = Math.abs(p.b[s]);
    if (piece === PAWN || piece === ROOK || piece === QUEEN) return false;
    if (piece === KNIGHT) knights++;
    if (piece === BISHOP) bishops.push(((s >> 3) + (s & 7)) & 1);
  }
  return knights + bishops.length <= 1 || (knights === 0 && bishops.every((colour) => colour === bishops[0]));
}
// 'mate', 'stalemate', 'fifty' (fifty moves without a pawn move or a capture), 'repeat' (the same
// position for the third time; `seen` is the list of the positions so far, from positionKey),
// 'bare' (too little left to win with), 'check' or '' while the game goes on.
export function standing(p, seen = []) {
  const check = inCheck(p);
  if (!legalMoves(p).length) return check ? 'mate' : 'stalemate';
  if (p.half >= 100) return 'fifty';
  const key = sameKey(p);
  if (seen.filter((k) => k === key).length >= 3) return 'repeat';
  if (bare(p)) return 'bare';
  return check ? 'check' : '';
}
export const positionKey = sameKey;

// A move as it is written down: Nf3, exd5, O-O, e8=Q+, Qxf7#.
export function notation(p, m) {
  const piece = Math.abs(p.b[m.from]), takes = p.b[m.to] !== 0 || m.kind === 'ep';
  let text;
  if (m.kind === 'short') text = 'O-O';
  else if (m.kind === 'long') text = 'O-O-O';
  else if (piece === PAWN) text = (takes ? squareName(m.from)[0] + 'x' : '') + squareName(m.to) + (m.promo ? '=' + LETTER[m.promo].toUpperCase() : '');
  else {
    // when another piece of the kind could go to the same square, the file or the row says which one went
    const twins = legalMoves(p).filter((o) => o.to === m.to && o.from !== m.from && Math.abs(p.b[o.from]) === piece);
    const from = squareName(m.from), tell = !twins.length ? '' : twins.every((o) => squareName(o.from)[0] !== from[0]) ? from[0] : twins.every((o) => squareName(o.from)[1] !== from[1]) ? from[1] : from;
    text = LETTER[piece].toUpperCase() + tell + (takes ? 'x' : '') + squareName(m.to);
  }
  const undo = play(p, m), state = inCheck(p) ? (legalMoves(p).length ? '+' : '#') : '';
  unplay(p, m, undo);
  return text + state;
}

// ---------------------------------------------------------------- the computer
const WORTH = [0, 100, 320, 330, 500, 900, 0];
// Where each piece likes to stand, seen from White's side (a8 first): the tables of Tomasz Michniewski's
// "simplified evaluation function", which every beginner's chess program uses.
const PLACE = [null,
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];
const KING_LATE = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
const MATE = 100000;
// How good the position is for the side to move, in hundredths of a pawn.
export function evaluate(p) {
  const b = p.b;
  let score = 0, heavy = 0, whiteKing = 0, blackKing = 0, whiteStuff = 0, blackStuff = 0;
  for (let s = 0; s < 64; s++) {
    const piece = b[s];
    if (!piece) continue;
    if (piece > 0) {
      if (piece === KING) { whiteKing = s; continue; }
      score += WORTH[piece] + PLACE[piece][s]; whiteStuff += WORTH[piece];
      if (piece > PAWN) heavy += WORTH[piece];
    } else {
      if (piece === -KING) { blackKing = s; continue; }
      score -= WORTH[-piece] + PLACE[-piece][s ^ 56]; blackStuff += WORTH[-piece]; // the table upside down
      if (piece < -PAWN) heavy += WORTH[-piece];
    }
  }
  // The kings hide in the middlegame and come out when the heavy pieces are gone.
  const late = heavy <= 2600;
  score += (late ? KING_LATE : PLACE[KING])[whiteKing] - (late ? KING_LATE : PLACE[KING])[blackKing ^ 56];
  // With a won ending on the board, the lone king is driven to the edge and the other king comes closer.
  if (late && Math.abs(whiteStuff - blackStuff) >= 400) {
    const loser = whiteStuff > blackStuff ? blackKing : whiteKing, winner = whiteStuff > blackStuff ? whiteKing : blackKing;
    const edge = Math.max(Math.abs((loser >> 3) - 3.5), Math.abs((loser & 7) - 3.5)), apart = Math.abs((loser >> 3) - (winner >> 3)) + Math.abs((loser & 7) - (winner & 7));
    score += (whiteStuff > blackStuff ? 1 : -1) * (edge * 20 + (14 - apart) * 6);
  }
  return p.white ? score : -score;
}
// Captures first, the biggest catch by the smallest piece before the rest.
const order = (p, list) => list.sort((x, y) => rank(p, y) - rank(p, x));
const rank = (p, m) => (p.b[m.to] ? 10 * WORTH[Math.abs(p.b[m.to])] - WORTH[Math.abs(p.b[m.from])] + 10000 : 0) + (m.promo ? 8000 + WORTH[m.promo] : 0) + (m.kind === 'ep' ? 10000 : 0);

// The strength of the levels: how many moves ahead the computer looks, for how long at most, and how
// much it misjudges positions (in hundredths of a pawn), which is what makes the easy level easy.
export const LEVELS = { easy: { depth: 1, ms: 200, blur: 90 }, normal: { depth: 2, ms: 400, blur: 20 }, hard: { depth: 6, ms: 800, blur: 4 } };

// The move the computer plays at the given level, or null when there is none.
export function bestMove(p, level = 'normal', rnd = Math.random, clock = () => Date.now()) {
  const { depth: deepest, ms, blur } = LEVELS[level], started = clock();
  let nodes = 0, out = false;
  const white = () => p.white;
  // Only captures are played on until the dust has settled: a position in the middle of an exchange says nothing.
  function quiet(alpha, beta) {
    const stand = evaluate(p);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    for (const m of order(p, moves(p, true))) {
      const mine = white(), undo = play(p, m);
      if (attacked(p, kingOf(p, mine), !mine)) { unplay(p, m, undo); continue; }
      const score = -quiet(-beta, -alpha);
      unplay(p, m, undo);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }
  function search(depth, alpha, beta, ply) {
    if ((++nodes & 1023) === 0 && clock() - started > ms) out = true;
    if (out) return 0;
    if (depth <= 0) return quiet(alpha, beta);
    if (p.half >= 100) return 0;
    let any = false;
    for (const m of order(p, moves(p))) {
      const mine = white(), undo = play(p, m);
      if (attacked(p, kingOf(p, mine), !mine)) { unplay(p, m, undo); continue; }
      any = true;
      const score = -search(depth - 1, -beta, -alpha, ply + 1);
      unplay(p, m, undo);
      if (out) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    if (!any) return inCheck(p) ? -MATE + ply : 0; // mated, the sooner the worse; or stalemate
    return alpha;
  }
  const first = order(p, legalMoves(p));
  if (!first.length) return null;
  for (const m of first) { // a mate in one is played on every level: nobody likes to be kept waiting for the end
    const undo = play(p, m), mate = inCheck(p) && !legalMoves(p).length;
    unplay(p, m, undo);
    if (mate) return m;
  }
  let best = first[0];
  for (let depth = 1; depth <= deepest && !out; depth++) {
    let top = -Infinity, choice = null;
    for (const m of first) {
      const undo = play(p, m);
      // a move that cannot come within the blur of the best one so far is not looked at any closer
      let score = -search(depth - 1, -MATE, -Math.max(-MATE, top - 2 * blur - 1), 1);
      unplay(p, m, undo);
      if (out) break;
      if (Math.abs(score) < MATE - 100) score += (rnd() - 0.5) * 2 * blur; // a mate is never misjudged
      if (score > top) { top = score; choice = m; }
    }
    if (!out && choice) { best = choice; first.sort((x, y) => (y === choice) - (x === choice)); } // the best move so far is tried first on the next, deeper round
  }
  return best;
}
