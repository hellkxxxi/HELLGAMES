// Hell Run, Brimstone and Labyrinth. Chance is fixed in each of them, so the test knows what is coming:
// which obstacles, where the souls fall, how the maze is built.
import { sleep } from '../lib.mjs';
import { DEVIL, createRun } from '../../js/games/run.js';

// What a careful runner does on the course that chance 0 lays out (flames first, low fireballs later):
// the points at which to jump, to duck and to get up again, for the first `count` obstacles. After
// those the runner does nothing more, and `end` is the score at which the next obstacle stops the run.
function runPlan(count) {
  const run = createRun(() => 0), plan = [], met = new Set();
  let ducking = false;
  run.jump(); // the key that starts the run is a jump as well
  for (let t = 0; t < 60 && !run.dead; t += 1 / 120) {
    const ahead = run.obstacles.filter((o) => o.x + o.w > DEVIL.x).sort((a, b) => a.x - b.x)[0];
    let duck = false;
    if (ahead && (met.has(ahead) || met.size < count)) {
      const gap = ahead.x - (DEVIL.x + DEVIL.w);
      if (ahead.kind === 'low') { duck = gap < run.speed * 0.2; if (duck) met.add(ahead); }
      else if (gap <= run.speed * 0.2 && !met.has(ahead) && run.y === 0) { met.add(ahead); run.jump(); plan.push({ at: run.score, what: 'jump', kind: ahead.kind }); }
    }
    if (duck !== ducking) { ducking = duck; run.duck(duck); plan.push({ at: run.score, what: duck ? 'duck' : 'rise', kind: 'low' }); }
    run.step(1 / 120);
  }
  return { plan, end: run.score, kinds: [...met].map((o) => o.kind) };
}

export default async function ({ t, open }) {
  const text = (page, sel) => page.$eval(sel, (e) => e.textContent);
  const overlay = async (page) => (await page.$eval('#overlay', (o) => !o.classList.contains('hidden'))) && [await text(page, '#ov-title'), await text(page, '#ov-text')];
  const untilOver = async (page, seconds) => { for (let k = 0; k < seconds * 10 && !(await overlay(page)); k++) await sleep(100); return overlay(page); };
  // Chance is whatever window.fate says; the game is started over so that it uses this chance from its first step.
  const fix = (page, value) => page.evaluate((v) => { window.fate = v; Math.random = () => window.fate; document.querySelector('#g-restart').click(); }, value);

  // ---------------------------------------------------------------- Hell Run
  let page = await open('#run');
  await sleep(500);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score'), await overlay(page)], ['Ready when you are', '0', false], 'Run: the devil waits for the first key');
  await sleep(600);
  t.equal(await text(page, '#g-score'), '0', 'Run: and does not set off by itself');

  // nobody at the keys: the first flame ends the run
  await fix(page, 0);
  await page.keyboard.press('Space');
  const idle = await untilOver(page, 6);
  const idleScore = Number(await text(page, '#g-score'));
  t.check(idle && idle[0] === 'New best!' && idleScore > 50 && idleScore < 100, `Run: left alone, the devil runs into the first flame (${idle}, ${idleScore} points)`);
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(200);

  // a runner who jumps the flames and ducks under the first fireball gets much further
  const { plan, end, kinds } = runPlan(6);
  t.check(kinds.filter((k) => k === 'flame').length >= 4 && kinds.includes('low') && plan.some((p) => p.what === 'duck'), `Run: the plan meets flames and a fireball (${kinds})`);
  await fix(page, 0);
  await page.evaluate((steps) => {
    const score = document.querySelector('#g-score');
    const key = (type, name, code) => document.dispatchEvent(new KeyboardEvent(type, { key: name, code, bubbles: true }));
    key('keydown', ' ', 'Space'); // sets off
    let k = 0;
    const watch = () => {
      for (; k < steps.length && Number(score.textContent) >= steps[k].at; k++) {
        if (steps[k].what === 'jump') key('keydown', ' ', 'Space');
        else key(steps[k].what === 'duck' ? 'keydown' : 'keyup', 'ArrowDown', 'ArrowDown');
      }
      if (k < steps.length) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  }, plan);
  const ran = await untilOver(page, 25);
  const score = Number(await text(page, '#g-score'));
  t.check(ran && Math.abs(score - end) <= 3 && score > idleScore * 3, `Run: six obstacles are cleared, the seventh ends the run where the rules say (${score} points, expected ${end}; ${ran})`);
  t.equal([ran[0], await text(page, '#g-best')], ['New best!', String(score)], 'Run: the longer run is the new best');
  t.problems(page, 'run');
  await page.close();

  // ---------------------------------------------------------------- Brimstone
  page = await open('#rain');
  await sleep(500);
  t.equal([await text(page, '#g-status'), await overlay(page)], ['Ready when you are', false], 'Brimstone: waits for the first key');
  // chance 0.5: nothing but souls, all of them falling in the middle, where the devil stands
  await fix(page, 0.5);
  await page.keyboard.press('Space');
  // waits, for a while at most, until the score has grown by so much
  const grows = async (by, seconds) => { const from = Number(await text(page, '#g-score')); for (let k = 0; k < seconds * 5 && Number(await text(page, '#g-score')) < from + by; k++) await sleep(200); return Number(await text(page, '#g-score')) - from; };
  const caught = await grows(2, 12);
  t.check(caught >= 2 && caught <= 3 && await text(page, '#g-status') === '♥♥♥', `Brimstone: souls that fall on the devil are caught (${caught})`);
  // the keys walk the devil away from under them
  await page.keyboard.down('ArrowLeft');
  await sleep(700);
  await page.keyboard.up('ArrowLeft');
  const atLeft = Number(await text(page, '#g-score'));
  await sleep(2500);
  t.check(Number(await text(page, '#g-score')) - atLeft <= 1, 'Brimstone: a devil that has walked to the left edge catches nothing in the middle');
  // and the mouse brings it back
  const box = await (await page.$('#ra-c')).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  t.check(await grows(2, 8) >= 2, 'Brimstone: the devil follows the mouse back under the souls');

  // chance 0.1: nothing but rocks, all of them falling on one spot near the left edge
  await fix(page, 0.1);
  await page.mouse.move(box.x + box.width * 0.144, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.up();
  const lost = await untilOver(page, 14);
  t.check(lost && lost[0] === 'Game over' && await text(page, '#g-status') === '♡♡♡' && await text(page, '#g-score') === '0', `Brimstone: three rocks end the game (${lost}, ${await text(page, '#g-status')})`);
  t.problems(page, 'rain');
  await page.close();

  // ---------------------------------------------------------------- Labyrinth
  page = await open('#maze');
  await sleep(500);
  t.equal([await text(page, '#g-status'), await page.$$eval('#mz-size button', (l) => l.map((b) => b.textContent)), await page.$eval('#mz-size .on', (b) => b.dataset.s)], ['10 × 10 cells', ['Small', 'Medium', 'Large'], 'small'], 'Labyrinth: a small maze to begin with');
  // The maze is built anew with chance of our own, and built a second time here to know the way out.
  const way = await page.evaluate(async (seed) => {
    const chance = (s) => () => { s = (s + 0x6D2B79F5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    const { makeMaze, solve, walk, DIRS } = await import('./js/games/maze.js');
    Math.random = chance(seed);
    document.querySelector('#g-restart').click();
    const maze = makeMaze(10, 10, chance(seed)), path = solve(maze), pushes = [];
    for (let at = maze.start, k = 0; at !== maze.exit;) {
      const dir = Object.keys(DIRS).find((name) => at + DIRS[name].dx + DIRS[name].dy * maze.cols === path[k]), ran = walk(maze, at, dir);
      pushes.push({ dir, cells: ran.length }); at = ran.at(-1); k += ran.length;
    }
    const wall = Object.keys(DIRS).find((name) => !(maze.open[0] & DIRS[name].bit) && DIRS[name].dx + DIRS[name].dy > 0); // a wall beside the start, if there is one
    return { pushes, wall, cells: path.length };
  }, 11);
  const KEY = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' }, LETTER = { up: 'w', right: 'd', down: 's', left: 'a' };
  await page.keyboard.press('ArrowUp'); // the start is in the top left corner: up is always a wall
  if (way.wall) await page.keyboard.press(KEY[way.wall]);
  await sleep(200);
  t.equal([await text(page, '#g-status'), await text(page, '#g-score')], ['10 × 10 cells', '0:00'], 'Labyrinth: a push against a wall moves nothing and does not start the clock');
  for (const [n, push] of way.pushes.entries()) {
    await page.keyboard.press(n % 2 ? LETTER[push.dir] : KEY[push.dir]);
    if (n === 0) { await sleep(60); t.equal(await text(page, '#g-status'), '1 move', 'Labyrinth: a push through an opening is a move'); }
    await sleep(push.cells / 26 * 1000 + 150);
  }
  const out = await untilOver(page, 10);
  const moves = way.pushes.length;
  t.check(out && out[0] === 'You are out' && new RegExp(`^0:0\\d · ${moves} moves$`).test(out[1]), `Labyrinth: following the way out leads out, in ${moves} moves for ${way.cells} cells (${out})`);
  t.check(/^0:0[1-9]$/.test(await text(page, '#g-best')), `Labyrinth: the time is the best one so far (${await text(page, '#g-best')})`);
  await sleep(700);
  await page.keyboard.press('Enter');
  await sleep(200);
  await page.click('#mz-size button[data-s="large"]');
  await sleep(200);
  t.equal([await text(page, '#g-status'), await text(page, '#g-best')], ['24 × 24 cells', '–'], 'Labyrinth: the large maze has a best time of its own');
  t.problems(page, 'maze');
  await page.close();

  // ---------------------------------------------------------------- on a phone
  const phone = await open('', { mobile: true });
  for (const [id, sel] of [['run', '#rn-c'], ['rain', '#ra-c'], ['maze', '#mz-c']]) {
    await phone.evaluate((h) => { location.hash = h; }, id);
    await sleep(500);
    const box = await (await phone.$(sel)).boundingBox();
    t.check(box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 780 && box.width > 280, `phone, ${id}: the picture fits the screen (${Math.round(box.width)}x${Math.round(box.height)})`);
    if (id === 'run') {
      t.check(await phone.$eval('#rn-jump', (b) => b.getClientRects().length > 0) && await phone.$eval('#rn-duck', (b) => b.getClientRects().length > 0), 'phone, run: buttons to jump and to duck');
      await phone.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      for (let k = 0; k < 40 && Number(await text(phone, '#g-score')) <= 5; k++) await sleep(150); // a slow machine draws few pictures a second, and the devil runs by the picture
      t.check(Number(await text(phone, '#g-score')) > 5, 'phone, run: a tap on the picture sets the devil off');
    }
    if (id === 'rain') {
      await phone.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(300);
      t.equal(await text(phone, '#g-status'), '♥♥♥', 'phone, rain: a tap starts the rain');
    }
    if (id === 'maze') {
      // a swipe downwards or to the right: one of the two is open at the start
      for (const [dx, dy] of [[0, 90], [90, 0]]) {
        await phone.touchscreen.touchStart(box.x + 150, box.y + 150);
        await phone.touchscreen.touchMove(box.x + 150 + dx / 2, box.y + 150 + dy / 2);
        await phone.touchscreen.touchMove(box.x + 150 + dx, box.y + 150 + dy);
        await phone.touchscreen.touchEnd();
        await sleep(400);
      }
      t.check(/^[12] moves?$/.test(await text(phone, '#g-status')), `phone, maze: a swipe moves the devil (${await text(phone, '#g-status')})`);
    }
  }
  t.problems(phone, 'phone');
  await phone.close();
}
