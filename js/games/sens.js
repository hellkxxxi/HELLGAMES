import { copyText, drawIcons } from '../util.js';

// ---------------------------------------------------------------- the numbers (nothing is shown here)
// Every game turns the view by a fixed angle for one count of the mouse at sensitivity 1: its yaw, in
// degrees. Two settings feel the same when a full turn takes the same way on the mouse pad, so
//   new sensitivity = old sensitivity × old yaw ÷ new yaw.
// The yaw values are the ones published at sensitivitymatch.com/methodology (as reviewed in October
// 2026); `measured` marks those that the page calls community-measured.
//   digits  how fine the setting can be typed in the game itself
//   same    games of that table that count in the very same way, so they share the row; a name that
//           ends in ≈ is one whose number was measured by players
//   note    which setting is meant
//   words   more words the search box should find the row by
// The first ten are the ones most people ask for; the rest are in the order of the alphabet.
export const POPULAR = 10;
export const GAMES = [
  { id: 'valorant', name: 'Valorant', yaw: 0.07, digits: 3 },
  { id: 'cs2', name: 'Counter-Strike 2', yaw: 0.022, digits: 3, same: ['CS:GO', 'CS: Source', 'CS 1.6', 'CS: Condition Zero'], words: 'CS2 Counter-Strike Global Offensive' },
  { id: 'apex', name: 'Apex Legends', yaw: 0.022, digits: 3 },
  { id: 'fortnite', name: 'Fortnite', yaw: 0.005555, digits: 1, unit: '%', note: 'X and Y sensitivity' },
  { id: 'overwatch', name: 'Overwatch 2', yaw: 0.0066, digits: 2, words: 'OW2' },
  { id: 'cod', name: 'Call of Duty', yaw: 0.0066, digits: 2, same: ['Warzone', 'Call of Duty BO6', 'Call of Duty BO7 ≈', 'Call of Duty MW2 (2022)', 'Call of Duty MW3', 'Call of Duty MW4 ≈'], words: 'CoD Black Ops Modern Warfare' },
  { id: 'r6', name: 'Rainbow Six Siege', yaw: 0.00572957795, digits: 0, note: 'multiplier left at 0.02', words: 'R6 R6S' },
  { id: 'rivals', name: 'Marvel Rivals', yaw: 0.0175, digits: 2, measured: true },
  { id: 'deadlock', name: 'Deadlock', yaw: 0.022, digits: 3 },
  { id: 'finals', name: 'THE FINALS', yaw: 0.001, digits: 1, measured: true },
  { id: 'aimlabs', name: 'Aimlabs', yaw: 0.05, digits: 3, words: 'Aim Lab' },
  { id: 'arc', name: 'ARC Raiders', yaw: 0.00136101, digits: 1, measured: true },
  { id: 'bf6', name: 'Battlefield 6', yaw: 0.00405121, digits: 1, measured: true, words: 'BF6' },
  { id: 'dods', name: 'Day of Defeat: Source', yaw: 0.022, digits: 3, words: 'DoD' },
  { id: 'destiny', name: 'Destiny 2', yaw: 0.0066, digits: 0 },
  { id: 'tarkov', name: 'Escape from Tarkov', yaw: 0.125, digits: 2, measured: true, words: 'EFT' },
  { id: 'farlight', name: 'Farlight 84', yaw: 0.022, digits: 2, measured: true },
  { id: 'gmod', name: 'Garry’s Mod', yaw: 0.022, digits: 3, words: 'GMod' },
  { id: 'halflife', name: 'Half-Life 2', yaw: 0.022, digits: 3, same: ['Half-Life', 'Black Mesa'], words: 'HL2' },
  { id: 'halo', name: 'Halo Infinite', yaw: 0.02222, digits: 1, measured: true },
  { id: 'kovaaks', name: 'KovaaK’s', yaw: 0.022, digits: 3 },
  { id: 'l4d2', name: 'Left 4 Dead 2', yaw: 0.022, digits: 3, same: ['Left 4 Dead'], words: 'L4D2' },
  { id: 'portal', name: 'Portal 2', yaw: 0.022, digits: 3 },
  { id: 'quake', name: 'Quake Champions', yaw: 0.022, digits: 3, same: ['Quake Live', 'Quake III Arena'], words: 'Quake 3' },
  { id: 'roblox', name: 'Roblox', yaw: 0.39783, digits: 3, measured: true },
  { id: 'robloxrivals', name: 'Roblox RIVALS', yaw: 0.005, digits: 2, measured: true },
  { id: 'rust', name: 'Rust', yaw: 0.1125, digits: 2, measured: true },
  { id: 'tf2', name: 'Team Fortress 2', yaw: 0.022, digits: 3, words: 'TF2' },
  { id: 'titanfall', name: 'Titanfall 2', yaw: 0.022, digits: 3, same: ['Titanfall'] },
];
// Games people look for that the same page leaves out, and why: one number does not carry over to them.
export const MISSING = [
  { name: 'PUBG', why: 'how far it turns depends on the field of view', words: 'PlayerUnknown Battlegrounds' },
  { name: 'Paladins', why: 'how far it turns depends on the field of view' },
  { name: 'Minecraft', why: 'it follows a curve, not one number' },
  { name: 'Delta Force', why: 'its number is not confirmed yet' },
];

export const gameOf = (id) => GAMES.find((g) => g.id === id);
// Every name that can be picked as the game to come from: the games themselves and those that count the same way.
export const NAMES = GAMES.flatMap((game) => [{ key: game.id, name: game.name, game, measured: !!game.measured },
  ...(game.same || []).map((text) => { const name = text.replace(/ ≈$/, ''); return { key: `${game.id}/${name}`, name, game, measured: name !== text }; })]);
export const convert = (sens, from, to) => sens * from.yaw / to.yaw;
// How far the mouse travels for a full turn, in centimetres.
export const turn = (sens, game, dpi) => 360 / (sens * game.yaw * dpi) * 2.54;
// A sensitivity the way the game shows it: no more digits than the game takes, no zeros at the end.
export const show = (value, game) => String(Number(value.toFixed(game.digits)));

// What the search box goes by: the words of every name a row stands for, and each name written in one piece,
// so that "csgo", "cs go" and "CS:GO" all find the same row. A typed word has to begin one of them: "eft" is
// Escape from Tarkov, not Left 4 Dead.
const tokens = (text) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const keysOf = (entry) => [entry.name, ...(entry.same || []), ...tokens(entry.words || '')].flatMap((name) => [...tokens(name), tokens(name).join('')]);
// The games that go by every word that was typed.
export function find(text) {
  const wanted = tokens(text);
  return GAMES.filter((g) => { const keys = keysOf(g); return wanted.every((w) => keys.some((k) => k.startsWith(w))); });
}
// The game that was looked for in vain, when it is one of those left out on purpose.
export function missing(text) {
  const wanted = tokens(text).join('');
  return wanted.length < 3 ? undefined : MISSING.find((m) => keysOf(m).some((k) => k.startsWith(wanted)) || wanted.includes(tokens(m.name).join('')));
}

// ---------------------------------------------------------------- the page
const KEY = 'arcade:sens';
const number = (text) => { const n = Number(String(text).replace(',', '.').trim()); return Number.isFinite(n) && n > 0 ? n : null; };

export default {
  id: 'sens', name: 'Sens Converter', icon: 'mouse', color: '#f472b6', tag: 'Skill', since: '1.1', noScore: true, noRestart: true,
  desc: 'Carry your mouse sensitivity from one shooter to another: Valorant, CS2, Apex, Fortnite and 41 more.',
  help: 'Pick your game, type its sensitivity and the DPI of your mouse · click a result to copy it · the DPI is taken to stay the same · scopes have settings of their own',
  create(stage) {
    let was = {};
    try { was = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* nothing saved, or not allowed */ }
    const option = (n) => `<option value="${n.key}">${n.name}</option>`;
    const popular = NAMES.filter((n) => n.key === n.game.id && GAMES.indexOf(n.game) < POPULAR);
    const others = NAMES.filter((n) => !popular.includes(n)).sort((a, b) => a.name.localeCompare(b.name, 'en'));
    stage.innerHTML = `
      <div class="sens">
        <div class="sn-form">
          <label><span>Your game</span><select id="sn-game"><optgroup label="Most played">${popular.map(option).join('')}</optgroup><optgroup label="More games">${others.map(option).join('')}</optgroup></select></label>
          <label><span>Sensitivity</span><input id="sn-sens" inputmode="decimal" autocomplete="off" spellcheck="false"></label>
          <label><span>Mouse DPI</span><input id="sn-dpi" inputmode="numeric" autocomplete="off" spellcheck="false"></label>
        </div>
        <div class="sn-facts" id="sn-facts"></div>
        <label class="sn-find"><i data-lucide="search"></i><input id="sn-find" type="search" placeholder="Find a game among ${NAMES.length}" autocomplete="off" spellcheck="false" aria-label="Find a game"></label>
        <ul class="sn-list" id="sn-list"></ul>
        <p class="cz-msg" id="sn-msg" role="status"></p>
        <p class="sn-source">Numbers of the games from <a href="https://sensitivitymatch.com/methodology/" target="_blank" rel="noopener">sensitivitymatch.com</a> · ≈ marks those measured by players</p>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const gameEl = $('sn-game'), sensEl = $('sn-sens'), dpiEl = $('sn-dpi'), findEl = $('sn-find'), list = $('sn-list'), facts = $('sn-facts'), msg = $('sn-msg');
    gameEl.value = NAMES.some((n) => n.key === was.game) ? was.game : 'valorant';
    sensEl.value = number(was.sens) ? String(was.sens) : '0.4';
    dpiEl.value = number(was.dpi) ? String(was.dpi) : '800';
    let msgTimer = null;

    function update() {
      const picked = NAMES.find((n) => n.key === gameEl.value) || NAMES[0], from = picked.game, sens = number(sensEl.value), dpi = number(dpiEl.value);
      sensEl.classList.toggle('bad', !sens); dpiEl.classList.toggle('bad', !dpi);
      try { localStorage.setItem(KEY, JSON.stringify({ game: picked.key, sens: sensEl.value.trim(), dpi: dpiEl.value.trim() })); } catch { /* private mode */ }
      if (!sens) { facts.innerHTML = ''; list.innerHTML = '<li class="sn-empty">Type the sensitivity you play with.</li>'; return; }
      const cm = dpi ? turn(sens, from, dpi) : null;
      const fact = (value, label) => `<div><b>${value}</b><span>${label}</span></div>`;
      facts.innerHTML = cm
        ? fact(cm.toFixed(1) + ' cm', 'for a full turn') + fact((cm / 2.54).toFixed(1) + ' in', 'for a full turn') + fact(String(Math.round(sens * dpi * 100) / 100), 'eDPI in ' + picked.name)
        : '<div class="sn-empty">Type the DPI of your mouse to see how far it travels for a full turn.</div>';
      const row = (g) => {
        const exact = convert(sens, from, g), value = show(exact, g) + (g.unit || '');
        // where the game takes only round numbers, the exact one is shown beside them
        const rough = Math.abs(Number(show(exact, g)) - exact) > exact * 0.01 ? `exactly ${Number(exact.toPrecision(3))}` : '';
        // the games that share the row, without the words they share with its name
        const same = g.same ? 'also ' + g.same.map((name) => (name.startsWith(g.name + ' ') ? name.slice(g.name.length + 1) : name)).join(', ') : '';
        const note = [same, g.note, rough].filter(Boolean).join(' · ');
        return `<li class="${g === from ? 'from' : ''}"><button data-v="${value}" data-n="${g.name}" title="Copy"><span class="sn-name">${g.name}${g.measured ? '<abbr title="Measured by players">≈</abbr>' : ''}${note ? `<small>${note}</small>` : ''}</span><b>${value}</b><i data-lucide="copy"></i></button></li>`;
      };
      const typed = findEl.value.trim(), head = (title) => `<li class="sn-head">${title}</li>`;
      if (!typed) list.innerHTML = head('Most played') + GAMES.slice(0, POPULAR).map(row).join('') + head('More games') + GAMES.slice(POPULAR).map(row).join('');
      else {
        const left = missing(typed);
        list.innerHTML = find(typed).map(row).join('') || `<li class="sn-empty">${left ? `${left.name} is left out: ${left.why}.` : 'No game of that name here.'}</li>`;
      }
      drawIcons();
    }
    for (const el of [gameEl, sensEl, dpiEl, findEl]) el.addEventListener('input', update);
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const ok = await copyText(b.dataset.v.replace('%', ''));
      msg.textContent = ok ? `Copied ${b.dataset.v} for ${b.dataset.n}` : 'This browser does not let the page copy. Type the number by hand.';
      clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg.textContent = ''; }, 2200);
    });
    update();
    return { destroy() { clearTimeout(msgTimer); } };
  },
};
