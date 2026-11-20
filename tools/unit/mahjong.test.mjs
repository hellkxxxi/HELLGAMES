// Mahjong solitaire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FACES, LAYOUTS, countMoves, createBoard, findPair, freeTiles, reshuffle } from '../../js/games/mahjong.js';
import { seeded } from './seeded.mjs';

// Plays a board by taking pairs at random, again and again, until one of the games clears it.
function canBeCleared(board, rnd, games = 500) {
  for (let n = 0; n < games; n++) {
    const tiles = board.map((t) => ({ ...t }));
    for (;;) {
      const byFace = {};
      for (const i of freeTiles(tiles)) (byFace[tiles[i].face] ||= []).push(i);
      const pairs = Object.values(byFace).filter((list) => list.length >= 2);
      if (!pairs.length) break;
      const list = pairs[Math.floor(rnd() * pairs.length)];
      const a = list.splice(Math.floor(rnd() * list.length), 1)[0], b = list[Math.floor(rnd() * list.length)];
      tiles[a].gone = tiles[b].gone = true;
    }
    if (tiles.every((t) => t.gone)) return true;
  }
  return false;
}
const faceCounts = (tiles) => { const c = {}; for (const t of tiles) if (!t.gone) c[t.face] = (c[t.face] || 0) + 1; return c; };

test('Mahjong: the layouts can be built from real tiles', () => {
  assert.equal(FACES.length, 36);
  assert.equal(new Set(FACES).size, 36, 'no face twice');
  assert.equal(LAYOUTS.turtle.places.length, 144, 'the turtle uses a whole set');
  for (const [id, { places }] of Object.entries(LAYOUTS)) {
    assert.equal(places.length % 2, 0, `${id}: an even number of tiles`);
    assert.ok(places.length <= FACES.length * 4, `${id}: no more tiles than a set has`);
    for (const a of places) {
      // a tile covers two by two half steps: two tiles of one layer must not share any of them
      assert.equal(places.filter((b) => b.z === a.z && Math.abs(b.x - a.x) < 2 && Math.abs(b.y - a.y) < 2).length, 1, `${id}: tile ${JSON.stringify(a)} overlaps another`);
      if (a.z === 0) continue;
      for (const [qx, qy] of [[a.x, a.y], [a.x + 1, a.y], [a.x, a.y + 1], [a.x + 1, a.y + 1]]) {
        assert.ok(places.some((b) => b.z === a.z - 1 && qx >= b.x && qx <= b.x + 1 && qy >= b.y && qy <= b.y + 1), `${id}: tile ${JSON.stringify(a)} hangs in the air`);
      }
    }
  }
});

test('Mahjong: which tiles are free', () => {
  const row = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }];
  assert.deepEqual(freeTiles(row), [0, 2], 'the middle of a row is shut in');
  assert.deepEqual(freeTiles([...row, { x: 3, y: 0, z: 1 }]), [0, 3], 'a tile lying across two others covers both');
  assert.deepEqual(freeTiles([{ x: 0, y: 1, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 1, z: 0 }]), [0, 2], 'a neighbour half a step up or down still blocks the side');
  assert.deepEqual(freeTiles([{ x: 0, y: 2, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 2, z: 0 }]), [0, 1, 2], 'a whole step away it does not');
  assert.deepEqual(freeTiles([{ ...row[0], gone: true }, row[1], row[2]]), [1, 2], 'a tile that was taken blocks nothing');
});

test('Mahjong: every deal has four of each face and can be cleared', () => {
  for (const id of Object.keys(LAYOUTS)) {
    for (const seed of [1, 2, 3, 4]) {
      const rnd = seeded(seed), board = createBoard(id, rnd);
      assert.equal(board.length, LAYOUTS[id].places.length);
      assert.ok(Object.values(faceCounts(board)).every((n) => n === 4), `${id} ${seed}: four of every face`);
      assert.ok(Object.keys(faceCounts(board)).every((f) => FACES.includes(f)));
      assert.ok(countMoves(board) > 0, `${id} ${seed}: there is a first move`);
      assert.ok(canBeCleared(board, rnd), `${id} ${seed}: can be cleared`);
    }
  }
});

test('Mahjong: the hint shows a pair that can be taken', () => {
  const board = createBoard('pyramid', seeded(7));
  for (let pair = findPair(board); pair; pair = findPair(board)) {
    const free = freeTiles(board);
    assert.ok(pair[0] !== pair[1] && free.includes(pair[0]) && free.includes(pair[1]), 'both tiles are free');
    assert.equal(board[pair[0]].face, board[pair[1]].face, 'and show the same face');
    assert.ok(countMoves(board) > 0);
    board[pair[0]].gone = board[pair[1]].gone = true;
  }
  assert.equal(countMoves(board), 0, 'no hint means no move');
});

test('Mahjong: a shuffle keeps the tiles, mixes their faces and leaves a board that can be cleared', () => {
  const rnd = seeded(9), board = createBoard('turtle', rnd);
  for (let n = 0; n < 20; n++) { const pair = findPair(board); board[pair[0]].gone = board[pair[1]].gone = true; }
  const before = board.map((t) => ({ ...t }));
  assert.equal(reshuffle(board, rnd), true);
  assert.deepEqual(board.map((t) => [t.x, t.y, t.z, !!t.gone]), before.map((t) => [t.x, t.y, t.z, !!t.gone]), 'no tile moved or came back');
  assert.deepEqual(faceCounts(board), faceCounts(before), 'the same faces as before');
  assert.notDeepEqual(board.map((t) => t.face), before.map((t) => t.face), 'in other places');
  assert.ok(canBeCleared(board, rnd));

  const stack = [{ x: 0, y: 0, z: 0, face: 'd1', gone: false }, { x: 0, y: 0, z: 1, face: 'd1', gone: false }];
  assert.equal(reshuffle(stack, rnd), false, 'two tiles on top of each other cannot be saved by any shuffle');
});
