import { noScroll } from '../util.js';

const PAPER = '#ffffff';
const COLORS = ['#111827', '#6b7280', '#ffffff', '#ef4444', '#f97316', '#facc15', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#92400e'];
const SIZES = [0.006, 0.014, 0.03, 0.065];   // brush width as a share of the picture's shorter side
const ERASER_WIDER = 1.8;                    // the eraser is this much wider than the brush
const MAX_STEPS = 60, MAX_BYTES = 64e6;      // how much undo history is kept
const TOLERANCE = 40;                        // fill: how different (0-255) a pixel may be and still belong to the area
const STORE = 'arcade:draw';                 // the picture is kept in the browser under this name
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- paint bucket (works on a plain list of pixels)
// data: RGBA bytes of a picture w pixels wide and h high. Fills the area around (x, y) with the colour
// [r, g, b] and returns the rectangle that changed, or null when there was nothing to do.
export function floodFill(data, w, h, x, y, [fr, fg, fb], tolerance = TOLERANCE) {
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const i0 = (y * w + x) * 4, sr = data[i0], sg = data[i0 + 1], sb = data[i0 + 2];
  if (sr === fr && sg === fg && sb === fb) return null;
  const away = (p) => Math.max(Math.abs(data[p * 4] - sr), Math.abs(data[p * 4 + 1] - sg), Math.abs(data[p * 4 + 2] - sb));
  const mark = new Uint8Array(w * h); // 1 = part of the area, 2 = on its edge
  const stack = [y * w + x];
  let x1 = x, x2 = x, y1 = y, y2 = y;
  while (stack.length) { // spread out row by row
    const p = stack.pop();
    if (mark[p] || away(p) > tolerance) continue;
    const row = Math.floor(p / w) * w;
    let l = p, r = p;
    while (l > row && !mark[l - 1] && away(l - 1) <= tolerance) l--;
    while (r < row + w - 1 && !mark[r + 1] && away(r + 1) <= tolerance) r++;
    mark.fill(1, l, r + 1);
    x1 = Math.min(x1, l - row); x2 = Math.max(x2, r - row); y1 = Math.min(y1, row / w); y2 = Math.max(y2, row / w);
    for (const next of [row - w, row + w]) {
      if (next < 0 || next >= w * h) continue;
      let open = false;
      for (let q = next + (l - row); q <= next + (r - row); q++) {
        const fits = !mark[q] && away(q) <= tolerance;
        if (fits && !open) stack.push(q);
        open = fits;
      }
    }
  }
  // Colour the area. The pixels just outside it are the soft edge of a neighbouring line: part line,
  // part old colour. The old colour's share is swapped for the new one, so no pale rim is left.
  const edge = [];
  for (let yy = y1; yy <= y2; yy++) for (let xx = x1; xx <= x2; xx++) {
    if (mark[yy * w + xx] !== 1) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = xx + dx, ny = yy + dy, q = ny * w + nx;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || mark[q]) continue;
      mark[q] = 2; edge.push(q);
    }
  }
  const share = edge.map((q) => { // how much of the old colour is in this pixel: 0 on the line itself
    const qx = q % w, qy = (q - qx) / w, own = away(q);
    let line = own;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = qx + dx, ny = qy + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && mark[ny * w + nx] !== 1) line = Math.max(line, away(ny * w + nx));
    }
    return 1 - own / line;
  });
  edge.forEach((q, n) => {
    const k = share[n], i = q * 4;
    data[i] = Math.max(0, Math.min(255, Math.round(data[i] + (fr - sr) * k)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] + (fg - sg) * k)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] + (fb - sb) * k)));
    data[i + 3] = 255;
  });
  for (let yy = y1; yy <= y2; yy++) for (let xx = x1; xx <= x2; xx++) {
    const p = yy * w + xx;
    if (mark[p] === 1) { data[p * 4] = fr; data[p * 4 + 1] = fg; data[p * 4 + 2] = fb; data[p * 4 + 3] = 255; }
  }
  x1 = Math.max(0, x1 - 1); y1 = Math.max(0, y1 - 1); x2 = Math.min(w - 1, x2 + 1); y2 = Math.min(h - 1, y2 + 1);
  return { x: x1, y: y1, w: x2 - x1 + 1, h: y2 - y1 + 1 };
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// ---------------------------------------------------------------- the sketchpad on screen
export default {
  id: 'draw', name: 'Sketchpad', icon: 'brush', color: '#e879f9', tag: 'Creative',
  desc: 'A blank page, a brush, a paint bucket and a handful of colours. Draw anything and save it.',
  help: 'B brush · E eraser · F fill · 1-4 brush size · Ctrl+Z undo · Ctrl+S save',
  noScore: true,
  create(stage, api) {
    stage.innerHTML = `
      <div class="dr-bar">
        <div class="seg" id="dr-tool">
          <button data-t="brush" title="Brush (B)" aria-label="Brush"><i data-lucide="brush"></i></button>
          <button data-t="eraser" title="Eraser (E)" aria-label="Eraser"><i data-lucide="eraser"></i></button>
          <button data-t="fill" title="Fill an area (F)" aria-label="Fill"><i data-lucide="paint-bucket"></i></button>
        </div>
        <div class="seg" id="dr-size">${SIZES.map((_, i) => `<button data-s="${i}" title="Brush size ${i + 1}" aria-label="Brush size ${i + 1}"><span class="dr-dot" style="width:${4 + i * 4}px;height:${4 + i * 4}px"></span></button>`).join('')}</div>
      </div>
      <canvas class="draw" id="dr-c"></canvas>
      <div class="dr-colors" id="dr-colors">
        ${COLORS.map((c) => `<button data-c="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}
        <label class="dr-custom" id="dr-custom" title="Any colour"><input type="color" id="dr-pick" value="#e879f9" aria-label="Pick any colour"></label>
      </div>
      <div class="dr-actions">
        <button id="dr-undo" title="Undo (Ctrl+Z)"><i data-lucide="undo-2"></i><span>Undo</span></button>
        <button id="dr-redo" title="Redo (Ctrl+Y)"><i data-lucide="redo-2"></i><span>Redo</span></button>
        <button id="dr-clear" title="Start a new page"><i data-lucide="trash-2"></i><span>Clear</span></button>
        <button id="dr-save" title="Save as a picture (Ctrl+S)"><i data-lucide="download"></i><span>Save</span></button>
      </div>`;
    const $ = (sel) => stage.querySelector(sel);
    const cv = $('#dr-c'), ctx = cv.getContext('2d', { willReadFrequently: true });
    // The picture gets as many pixels as the screen can show, and keeps them when the window changes.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(240, Math.min(stage.clientWidth || 600, 768)), cssH = Math.max(240, Math.min(560, window.innerHeight - 380));
    const W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    cv.width = W; cv.height = H; cv.style.maxWidth = `min(100%, ${cssW}px)`;
    // A second, hidden copy of the picture as it was before the stroke in progress: undo is made from it.
    const copy = document.createElement('canvas');
    copy.width = W; copy.height = H;
    const cctx = copy.getContext('2d', { willReadFrequently: true });

    let tool = 'brush', color = COLORS[0], sizeIx = 1, stroke = null, ready = false, saveTimer = null;
    let undo = [], redo = [];
    const width = () => Math.max(1.5, SIZES[sizeIx] * Math.min(W, H));

    function show() {
      for (const b of $('#dr-tool').children) b.classList.toggle('on', b.dataset.t === tool);
      for (const b of $('#dr-size').children) b.classList.toggle('on', +b.dataset.s === sizeIx);
      let listed = false;
      for (const b of $('#dr-colors').querySelectorAll('button')) { const on = b.dataset.c === color; b.classList.toggle('on', on); listed = listed || on; }
      $('#dr-custom').classList.toggle('on', !listed);
      if (!listed) $('#dr-custom').style.background = color; else $('#dr-custom').style.background = '';
      $('#dr-undo').disabled = !undo.length; $('#dr-redo').disabled = !redo.length;
      cv.style.cursor = tool === 'fill' ? 'cell' : 'crosshair';
    }
    const isBlank = () => { const d = cctx.getImageData(0, 0, W, H).data; for (let i = 0; i < d.length; i += 4) if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) return false; return true; };
    function saveNow() {
      clearTimeout(saveTimer); saveTimer = null;
      try { if (isBlank()) localStorage.removeItem(STORE); else localStorage.setItem(STORE, cv.toDataURL('image/png')); } catch { /* no room or private mode: the picture just is not kept */ }
    }
    function changed() { show(); clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 500); }

    // The picture changed inside this rectangle: remember how it looked before and after.
    function commit(x, y, w, h) {
      const x1 = Math.max(0, Math.floor(x)), y1 = Math.max(0, Math.floor(y)), x2 = Math.min(W, Math.ceil(x + w)), y2 = Math.min(H, Math.ceil(y + h));
      if (x2 <= x1 || y2 <= y1) return;
      const before = cctx.getImageData(x1, y1, x2 - x1, y2 - y1), after = ctx.getImageData(x1, y1, x2 - x1, y2 - y1);
      cctx.putImageData(after, x1, y1);
      undo.push({ x: x1, y: y1, before, after }); redo = [];
      let bytes = 0;
      for (let i = undo.length - 1; i >= 0; i--) { // forget the oldest steps when the history gets too heavy
        bytes += undo[i].before.data.length * 2;
        if (bytes > MAX_BYTES || undo.length - i > MAX_STEPS) { undo.splice(0, i + 1); break; }
      }
      changed();
    }
    function travel(from, to, which) {
      if (stroke) return;
      const s = from.pop();
      if (!s) return;
      ctx.putImageData(s[which], s.x, s.y); cctx.putImageData(s[which], s.x, s.y);
      to.push(s); changed();
    }
    const undoStep = () => travel(undo, redo, 'before'), redoStep = () => travel(redo, undo, 'after');
    function clear() {
      if (stroke || !ready || isBlank()) return;
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
      commit(0, 0, W, H);
    }
    function download() {
      cv.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = `drawing-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        api.status('Picture saved to your downloads');
      }, 'image/png');
    }

    // ---- drawing with a mouse, a finger or a pen
    function point(e) {
      const r = cv.getBoundingClientRect();
      return {
        x: (e.clientX - r.left - cv.clientLeft) * W / cv.clientWidth, y: (e.clientY - r.top - cv.clientTop) * H / cv.clientHeight,
        press: e.pointerType === 'pen' && e.pressure > 0 ? 0.3 + e.pressure * 1.2 : 1, // a pen draws thicker when pressed harder
      };
    }
    function reach(s, p) { s.box[0] = Math.min(s.box[0], p.x); s.box[1] = Math.min(s.box[1], p.y); s.box[2] = Math.max(s.box[2], p.x); s.box[3] = Math.max(s.box[3], p.y); }
    function extend(p) { // a smooth curve through the middle of every two points
      const s = stroke, mid = { x: (s.last.x + p.x) / 2, y: (s.last.y + p.y) / 2 };
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width * p.press; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(s.mid.x, s.mid.y); ctx.quadraticCurveTo(s.last.x, s.last.y, mid.x, mid.y); ctx.stroke();
      reach(s, p); s.last = p; s.mid = mid;
    }
    function fillAt(p) {
      const x = Math.floor(p.x), y = Math.floor(p.y);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const img = ctx.getImageData(0, 0, W, H), box = floodFill(img.data, W, H, x, y, rgb(color));
      if (!box) return;
      ctx.putImageData(img, 0, 0, box.x, box.y, box.w, box.h);
      commit(box.x, box.y, box.w, box.h);
    }
    cv.addEventListener('pointerdown', (e) => {
      if (stroke || !ready || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      const p = point(e);
      if (tool === 'fill') { fillAt(p); return; }
      try { cv.setPointerCapture(e.pointerId); } catch { /* not vital */ }
      const w = width() * (tool === 'eraser' ? ERASER_WIDER : 1);
      stroke = { id: e.pointerId, last: p, mid: p, width: w, color: tool === 'eraser' ? PAPER : color, box: [p.x, p.y, p.x, p.y] };
      ctx.fillStyle = stroke.color; ctx.beginPath(); ctx.arc(p.x, p.y, w * p.press / 2, 0, TAU); ctx.fill(); // a tap leaves a dot
    });
    cv.addEventListener('pointermove', (e) => {
      if (!stroke || e.pointerId !== stroke.id) return;
      const all = e.getCoalescedEvents ? e.getCoalescedEvents() : []; // every position of a fast movement, not just the last
      for (const ev of all.length ? all : [e]) extend(point(ev));
    });
    function finish(e, cancelled) {
      if (!stroke || e.pointerId !== stroke.id) return;
      const s = stroke;
      stroke = null;
      if (cancelled) { ctx.drawImage(copy, 0, 0); return; }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width * s.last.press; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.mid.x, s.mid.y); ctx.lineTo(s.last.x, s.last.y); ctx.stroke();
      const pad = s.width + 3;
      commit(s.box[0] - pad, s.box[1] - pad, s.box[2] - s.box[0] + pad * 2, s.box[3] - s.box[1] + pad * 2);
    }
    cv.addEventListener('pointerup', (e) => finish(e, false));
    cv.addEventListener('pointercancel', (e) => finish(e, true));
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    noScroll(cv);

    // ---- buttons
    const pickTool = (t) => { tool = t; show(); };
    const pickColor = (c) => { color = c; if (tool === 'eraser') tool = 'brush'; show(); };
    const chooser = (id, fn) => $(id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); fn(b); } });
    chooser('#dr-tool', (b) => pickTool(b.dataset.t));
    chooser('#dr-size', (b) => { sizeIx = +b.dataset.s; show(); });
    chooser('#dr-colors', (b) => pickColor(b.dataset.c));
    $('#dr-pick').addEventListener('input', (e) => pickColor(e.target.value));
    $('#dr-pick').addEventListener('click', (e) => pickColor(e.target.value));
    const button = (id, fn) => $(id).addEventListener('click', (e) => { e.currentTarget.blur(); fn(); });
    button('#dr-undo', undoStep); button('#dr-redo', redoStep); button('#dr-clear', clear); button('#dr-save', download);

    // ---- start with the picture from last time, if there is one
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    const begin = () => { cctx.drawImage(cv, 0, 0); ready = true; show(); };
    let saved = null;
    try { saved = localStorage.getItem(STORE); } catch { /* private mode */ }
    if (saved) {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, W / img.width, H / img.height); // a picture from a bigger window is shrunk to fit
        ctx.drawImage(img, Math.round((W - img.width * k) / 2), Math.round((H - img.height * k) / 2), img.width * k, img.height * k);
        begin();
      };
      img.onerror = begin;
      img.src = saved;
    } else begin();
    show();
    api.status('Saved in this browser as you draw');

    return {
      key(e) {
        const t = { b: 'brush', e: 'eraser', f: 'fill' }[e.key];
        if (t) { pickTool(t); return true; }
        if (/^[1-4]$/.test(e.key)) { sizeIx = +e.key - 1; show(); return true; }
      },
      shortcut(e) {
        if (!e.ctrlKey || e.altKey) return;
        if (e.key === 'z') { if (e.shiftKey) redoStep(); else undoStep(); return true; }
        if (e.key === 'y') { redoStep(); return true; }
        if (e.key === 's') { if (!e.repeat) download(); return true; }
      },
      restart: clear,
      destroy() { if (saveTimer) saveNow(); },
    };
  },
};
