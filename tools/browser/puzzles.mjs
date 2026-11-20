// Lava Pipes, Untangle and Hellgems. Each puzzle is made a second time with the same chance, so the test
// knows the answer and can play it.
import { sleep } from '../lib.mjs';

// Fixes chance, starts the game over so that it builds its puzzle from this chance, and hands the same
// chance to `make`, which builds the puzzle again inside the page and returns what the test needs.
const seeded = `(s) => () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }`;
const again = (page, seed, make) => page.evaluate(new Function('seed', `const chance = ${seeded}; Math.random = chance(seed); document.querySelector('#g-restart').click(); return (${make})(chance(seed));`), seed);

export default async function ({ t, open }) {
  const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
  const overlay = async (page) => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text(page, '#ov-title'), await text(page, '#ov-text')];
  const centre = (page, sel, n = 0) => page.evaluate((s, k) => { const r = document.querySelectorAll(s)[k].getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width]; }, sel, n);

  // ---------------------------------------------------------------- Lava Pipes
  let page = await open('#pipes');
  await sleep(500);
  t.equal([await text(page, '#g-status'), await page.$$eval('.pp-tile', (l) => l.length), await page.$$eval('.pp-tile.well', (l) => l.map((b) => b.dataset.i))], ['5 × 5 pieces', 25, ['12']], 'Pipes: five by five to begin with, the well in the middle');
  // how many quarter turns every piece needs to lie as it was laid
  const turns = await again(page, 21, `async (chance) => {
    const { layPipes, makePuzzle, turned } = await import('./js/games/pipes.js');
    const puzzle = makePuzzle(5, chance), laid = layPipes(5, (${seeded})(21));
    return [...puzzle.tiles].map((tile, i) => [0, 1, 2, 3].find((k) => turned(tile, k) === laid.tiles[i]));
  }`);
  const lit = () => page.$$eval('.pp-tile.lit', (l) => l.map((b) => Number(b.dataset.i)));
  const start = await lit();
  t.check(turns.length === 25 && turns.some((k) => k > 0) && start.includes(12) && start.length < 25, `Pipes: the puzzle starts with the lava in ${start.length} of 25 pieces`);
  const first = turns.findIndex((k) => k > 0);
  await page.click(`.pp-tile[data-i="${first}"]`);
  t.equal(await text(page, '#g-status'), '1 turn', 'Pipes: a click turns a piece');
  await page.click(`.pp-tile[data-i="${first}"]`, { button: 'right' });
  t.equal([await text(page, '#g-status'), await lit()], ['2 turns', start], 'Pipes: a right-click turns it back');
  let clicks = 2;
  for (const [i, k] of turns.entries()) for (let n = 0; n < k; n++) { await page.click(`.pp-tile[data-i="${i}"]`); clicks++; }
  await sleep(700);
  const flowing = await overlay(page);
  t.check((await lit()).length === 25 && flowing && flowing[0] === 'The lava flows' && new RegExp(`^0:0\\d · ${clicks} turns$`).test(flowing[1]), `Pipes: every piece turned the way it was laid lets the lava through (${flowing})`);
  t.check(/^0:0[1-9]$/.test(await text(page, '#g-best')), 'Pipes: the time is kept as the best');
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(200);
  await page.click('#pp-size button[data-s="medium"]');
  await sleep(200);
  t.equal([await page.$$eval('.pp-tile', (l) => l.length), await text(page, '#g-best')], [49, '–'], 'Pipes: the medium field is seven by seven and has a best time of its own');
  t.problems(page, 'pipes');
  await page.close();

  // ---------------------------------------------------------------- Untangle
  page = await open('#untangle');
  await sleep(500);
  const web = await again(page, 22, `async (chance) => { const { makePuzzle, tangled } = await import('./js/games/untangle.js'); const p = makePuzzle(7, chance); return { points: p.points, home: p.home, tangled: tangled(p.points, p.lines).length }; }`);
  await sleep(200);
  t.equal(await text(page, '#g-status'), `7 knots · ${web.tangled} tangled`, 'Untangle: seven knots in a tangle');
  const box = await (await page.$('#ut-c')).boundingBox();
  const at = (p) => [box.x + p[0] * box.width, box.y + p[1] * box.height];
  await page.mouse.click(box.x + 4, box.y + 4);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score')], [`7 knots · ${web.tangled} tangled`, '0:00'], 'Untangle: a click on nothing moves nothing');
  // every knot is dragged to the place it has in the layout without crossings
  for (let i = 0; i < 7 && !(await overlay(page)); i++) {
    await page.mouse.move(...at(web.points[i]));
    await page.mouse.down();
    await page.mouse.move(...at(web.home[i]), { steps: 4 });
    await page.mouse.up();
    if (i === 0) t.check(/^\d+ lines? tangled$|^Not a line crosses$/.test(await text(page, '#g-status')), `Untangle: dragging a knot counts the crossings anew (${await text(page, '#g-status')})`);
  }
  await sleep(700);
  const free = await overlay(page);
  t.check(free && free[0] === 'Untangled' && /^0:0\d · [1-7] moves?$/.test(free[1]) && await text(page, '#g-status') === 'Not a line crosses', `Untangle: with every knot in its place no line crosses another (${free})`);
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(200);
  await page.click('#ut-level button[data-l="hard"]');
  await sleep(200);
  t.check(/^14 knots · \d+ tangled$/.test(await text(page, '#g-status')), 'Untangle: the hard web has fourteen knots');
  t.problems(page, 'untangle');
  await page.close();

  // ---------------------------------------------------------------- Hellgems
  page = await open('#gems');
  await sleep(500);
  await page.evaluate(() => { const real = performance.now.bind(performance); window.ahead = 0; performance.now = () => real() + window.ahead; });
  // The board as the page shows it: the kind of gem in every place, read from its colour.
  const board = () => page.evaluate(() => {
    const colours = ['#ef4444', '#fb923c', '#facc15', '#22c55e', '#3b82f6', '#a855f7'], out = Array(64).fill(-1);
    for (const el of document.querySelectorAll('#gm-board .gm-gem')) out[Number(el.style.getPropertyValue('--y')) * 8 + Number(el.style.getPropertyValue('--x'))] = colours.indexOf(el.querySelector('.gm-body').getAttribute('fill'));
    return out;
  });
  const gemAt = (cell) => page.evaluate((c) => { const el = [...document.querySelectorAll('#gm-board .gm-gem')].find((g) => Number(g.style.getPropertyValue('--y')) * 8 + Number(g.style.getPropertyValue('--x')) === c), r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2, r.width]; }, cell);
  const plan = (cells) => page.evaluate(async (b) => {
    const { findMove, canSwap, matches } = await import('./js/games/gems.js');
    const move = findMove(b);
    let dud = null;
    for (let i = 0; i < 63 && !dud; i++) if (i % 8 < 7 && b[i] !== b[i + 1] && !canSwap(b, i, i + 1)) dud = [i, i + 1];
    return { move, dud, calm: matches(b).length === 0 };
  }, cells);
  // Waits until everything has burst and fallen and the board lies still, and a little longer for the game to take the next swap.
  const calm = async () => {
    for (let k = 0, still = 0; k < 60 && still < 2; k++) { await sleep(250); const now = await board(); still = now.every((kind) => kind >= 0) && (await plan(now)).calm && !(await page.$('.gm-gem.pop')) ? still + 1 : 0; }
    await sleep(350);
  };
  let b = await board();
  let p = await plan(b);
  t.check(b.every((k) => k >= 0) && p.calm && p.move && p.dud, 'Gems: a full board with nothing lined up and a swap to make');
  t.equal([await text(page, '#g-status'), await text(page, '#g-score')], ['30 moves left', '0'], 'Gems: thirty moves to begin with');
  // a swap that lines up nothing is taken back and costs no move
  await page.mouse.click(...(await gemAt(p.dud[0])).slice(0, 2));
  t.equal(await page.$$eval('.gm-gem.picked', (l) => l.length), 1, 'Gems: a click picks a gem');
  await page.mouse.click(...(await gemAt(p.dud[1])).slice(0, 2));
  await sleep(600);
  t.equal([await board(), await text(page, '#g-status'), await text(page, '#g-score')], [b, '30 moves left', '0'], 'Gems: a swap that lines up nothing is undone and costs nothing');
  // a swap that lines up three, made by clicking one gem and then its neighbour
  await page.mouse.click(...(await gemAt(p.move[0])).slice(0, 2));
  await page.mouse.click(...(await gemAt(p.move[1])).slice(0, 2));
  await calm();
  let score = Number(await text(page, '#g-score'));
  b = await board();
  t.check(score >= 30 && score % 10 === 0 && await text(page, '#g-status') === '29 moves left', `Gems: three in a row burst and bring points (${score})`);
  p = await plan(b);
  t.check(b.every((k) => k >= 0) && p.calm, 'Gems: the gems above fall, new ones drop in, and the board is full and calm again');
  // the same by dragging a gem onto its neighbour
  const [x0, y0, size] = await gemAt(p.move[0]), [x1, y1] = await gemAt(p.move[1]);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + (x1 - x0) * 0.6, y0 + (y1 - y0) * 0.6, { steps: 4 });
  await page.mouse.up();
  await calm();
  t.check(Number(await text(page, '#g-score')) >= score + 30 && await text(page, '#g-status') === '28 moves left' && size > 30, 'Gems: dragging a gem onto its neighbour swaps them too');

  // against the clock
  await page.click('#gm-mode button[data-m="time"]');
  await sleep(200);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await text(page, '#g-best')], ['60s left', '0', '–'], 'Gems: sixty seconds, with a best score of their own');
  await page.evaluate((ms) => { window.ahead += ms; }, 90000);
  await sleep(400);
  t.equal([await overlay(page), await text(page, '#g-status')], [false, '60s left'], 'Gems: the clock waits for the first swap');
  p = await plan(await board());
  await page.mouse.click(...(await gemAt(p.move[0])).slice(0, 2));
  await page.mouse.click(...(await gemAt(p.move[1])).slice(0, 2));
  await calm();
  await sleep(1500); // long enough for the clock to show a second less
  score = Number(await text(page, '#g-score'));
  t.check(score >= 30 && /^[45]\ds left$/.test(await text(page, '#g-status')), `Gems: the first swap starts it (${await text(page, '#g-status')})`);
  await page.evaluate((ms) => { window.ahead += ms; }, 61000);
  await sleep(900);
  t.equal(await overlay(page), ['New best!', `Score: ${score}`], 'Gems: when the time is up the game is over');
  t.problems(page, 'gems');
  await page.close();

  // ---------------------------------------------------------------- on a phone
  const phone = await open('', { mobile: true });
  for (const [id, sel] of [['pipes', '#pp-grid'], ['untangle', '#ut-c'], ['gems', '#gm-board']]) {
    await phone.evaluate((h) => { location.hash = h; }, id);
    await sleep(500);
    const r = await (await phone.$(sel)).boundingBox();
    t.check(r.x >= 0 && r.x + r.width <= 390 && r.y + r.height <= 780 && r.width > 300, `phone, ${id}: the field fits the screen (${Math.round(r.width)}x${Math.round(r.height)})`);
  }
  // a tap turns a pipe; a finger drags a gem
  await phone.evaluate(() => { location.hash = 'pipes'; });
  await sleep(500);
  await phone.touchscreen.tap(...(await centre(phone, '.pp-tile', 3)).slice(0, 2));
  t.equal(await text(phone, '#g-status'), '1 turn', 'phone, pipes: a tap turns a piece');
  t.problems(phone, 'phone');
  await phone.close();
}
