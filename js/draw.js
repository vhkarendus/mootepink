/* Mõõtepink – SVG joonistamine: skeem (sümbolid, mõõtepunktid) ja multimeeter (LCD, valikulüliti, pesad). */
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const G = 44, OX = 46, OY = 50;

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
    if (text !== undefined && text !== null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function pxy(c) { return { x: OX + c[0] * G, y: OY + c[1] * G }; }
  function f(n) { return Math.round(n * 100) / 100; }

  /* ====================== SKEEM ====================== */
  const SYM_LEN = { res: 56, bat: 30, ac: 40, led: 40, switch: 60, link: 34, fuse: 56, motor: 46, adc: 56, ldr: 56, conn: 36 };

  function schematic(parent, circuit, opts) {
    opts = opts || {};
    const pts = {};
    Object.keys(circuit.points).forEach(function (id) { pts[id] = pxy(circuit.points[id]); });
    const gRoot = el('g', { class: 'schematic' }, parent);
    const gWires = el('g', { class: 'sch-wires' }, gRoot);
    const gSyms = el('g', { class: 'sch-syms' }, gRoot);
    const gLabels = el('g', { class: 'sch-labels' }, gRoot);
    const gDeco = el('g', { class: 'sch-deco' }, gRoot);
    const gTps = el('g', { class: 'sch-tps' }, gRoot);
    const out = { root: gRoot, pts: pts, tps: {}, toggles: {}, leds: {}, motors: {}, adcs: {}, switches: {}, links: {}, labelsByEl: {} };
    const cxm = (circuit.cols + 1) / 2, cym = (circuit.rows + 1) / 2;

    /* punktide numbrid */
    const nums = {};
    let ni = 1;
    Object.keys(circuit.points).forEach(function (id) { nums[id] = (circuit.labels && circuit.labels[id]) || String(ni); ni++; });
    out.nums = nums;

    /* ühenduste arv (sõlmepunktide jaoks) */
    const deg = {};
    circuit.elems.forEach(function (e) { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });

    circuit.elems.forEach(function (e) {
      const a = pts[e.a], b = pts[e.b];
      if (e.type === 'wire') {
        const d = ['M', a.x, a.y];
        (e.via || []).forEach(function (v) { const p = pxy(v); d.push('L', p.x, p.y); });
        d.push('L', b.x, b.y);
        el('path', { d: d.join(' '), class: 'wire' }, gWires);
        return;
      }
      const sym = (e.type === 'bat' && e.ac) ? 'ac' : (e.type === 'res' && e.sym) ? e.sym : e.type === 'motor' ? 'motor' : e.type;
      const L = SYM_LEN[sym] || 50;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const ang = Math.atan2(dy, dx) * 180 / Math.PI;
      const horizontal = Math.abs(dy) < 1;
      /* juhtmed sümbolini kohale */
      if (len > L) {
        el('path', { d: 'M' + a.x + ' ' + a.y + ' L' + f(cx - ux * L / 2) + ' ' + f(cy - uy * L / 2), class: 'wire' }, gWires);
        el('path', { d: 'M' + f(cx + ux * L / 2) + ' ' + f(cy + uy * L / 2) + ' L' + b.x + ' ' + b.y, class: 'wire' }, gWires);
      }
      const g = el('g', { class: 'sym sym-' + sym, 'data-el': e.id, transform: 'translate(' + f(cx) + ' ' + f(cy) + ') rotate(' + f(ang) + ')' }, gSyms);
      drawSymbol(g, e, sym, out, horizontal);

      /* sildid */
      const tx = e.lab === 'below' ? 1 : -1;
      let lx, ly, anchor = 'middle';
      if (horizontal) {
        const row = (cy - OY) / G;
        const above = e.lab ? (e.lab === 'above') : (row < (circuit.rows - 1) / 2);
        lx = cx; ly = above ? cy - 34 : cy + 36; anchor = 'middle';
      } else {
        const left = (e.lab === 'left');
        lx = left ? cx - 30 : cx + 30; ly = cy - 2; anchor = left ? 'end' : 'start';
      }
      void tx; void cxm;
      const gl = el('g', { class: 'elabel', 'data-el': e.id }, gLabels);
      const nm = e.name || e.id;
      if (sym === 'link') {
        /* jumperi lüliti-nupp: asub sondidest eemal (horisontaalsel all, vertikaalsel vasakul) */
        const pw = 14 + 8.5 * nm.length;
        const px = horizontal ? cx : cx - 14 - pw / 2;
        const py = horizontal ? cy + 32 : cy;
        const pill = el('g', { class: 'lab-pill', 'data-toggle-link': e.id, tabindex: '0', role: 'button', 'aria-label': 'Jumper ' + nm + ': ava või sulge' }, gl);
        el('rect', { x: f(px - pw / 2), y: f(py - 12), width: f(pw), height: 24, rx: 12, class: 'pill-bg' }, pill);
        el('text', { x: f(px), y: f(py + 5), class: 'pill-text' }, pill, nm);
        out.links[e.id].pill = pill;
      } else if (sym === 'adc') {
        /* A0-sisendi silt joonistatakse sümboli sisse */
      } else {
        const t1 = el('text', { x: f(lx), y: f(ly), 'text-anchor': anchor, class: 'lab-name' }, gl, nm);
        const vtxt = e.hideVal ? '?' : (e.val || '');
        if (vtxt) el('text', { x: f(lx), y: f(ly + 15), 'text-anchor': anchor, class: 'lab-val' }, gl, vtxt);
        void t1;
      }
      if (sym === 'bat') {
        const nx = -uy, ny = ux;
        el('text', { x: f(cx - ux * (L / 2 + 10) + nx * 16), y: f(cy - uy * (L / 2 + 10) + ny * 16 + 5), class: 'pol', 'text-anchor': 'middle' }, gLabels, '+');
        el('text', { x: f(cx + ux * (L / 2 + 10) + nx * 16), y: f(cy + uy * (L / 2 + 10) + ny * 16 + 5), class: 'pol', 'text-anchor': 'middle' }, gLabels, '\u2212');
      }
    });

    /* maandus */
    (circuit.deco || []).forEach(function (d) {
      if (d.t === 'gnd') {
        const p = pts[d.at];
        const g = el('g', { class: 'gnd', transform: 'translate(' + p.x + ' ' + (p.y + 12) + ')' }, gDeco);
        el('path', { d: 'M0 0 V10 M-14 10 H14 M-9 15 H9 M-4 20 H4', class: 'gnd-line' }, g);
      } else if (d.t === 'dot') {
        const q = pxy(d.xy);
        el('circle', { cx: q.x, cy: q.y, r: 4, class: 'junction' }, gDeco);
      }
    });

    /* sõlmepunktid (juhtmete ühendused) */
    Object.keys(pts).forEach(function (id) {
      if ((deg[id] || 0) >= 3) el('circle', { cx: pts[id].x, cy: pts[id].y, r: 4, class: 'junction' }, gDeco);
    });

    /* mõõtepunktid */
    Object.keys(pts).forEach(function (id) {
      const p = pts[id];
      const g = el('g', { class: 'tp', 'data-pt': id, tabindex: '0', role: 'button', 'aria-label': 'Mõõtepunkt ' + nums[id] }, gTps);
      el('circle', { cx: p.x, cy: p.y, r: 17, class: 'tp-hit' }, g);
      el('circle', { cx: p.x, cy: p.y, r: 10, class: 'tp-halo' }, g);
      el('circle', { cx: p.x, cy: p.y, r: 5.5, class: 'tp-dot' }, g);
      el('text', { x: p.x + 10, y: p.y - 9, class: 'tp-num' }, g, nums[id]);
      out.tps[id] = g;
    });

    /* uuendamine: olekud (lülitid, jumperid, LED, mootor, ADC) */
    out.refresh = function (view) {
      const cond = view.cond || {};
      Object.keys(out.switches).forEach(function (id) {
        const e = circuit.elems.find(function (x) { return x.id === id; });
        const closed = (cond.switches && cond.switches[id] !== undefined) ? cond.switches[id] : (e.closed !== false);
        out.switches[id].blade.setAttribute('x2', closed ? 24 : 15);
        out.switches[id].blade.setAttribute('y2', closed ? 0 : -19);
        out.switches[id].g.classList.toggle('is-open', !closed);
        out.switches[id].g.setAttribute('aria-pressed', String(closed));
        out.switches[id].text.textContent = closed ? 'SEES' : 'VÄLJAS';
      });
      Object.keys(out.links).forEach(function (id) {
        const closed = (cond.links && cond.links[id] !== undefined) ? cond.links[id] : true;
        out.links[id].g.classList.toggle('is-open', !closed);
        out.links[id].g.setAttribute('aria-pressed', String(closed));
        if (out.links[id].pill) { out.links[id].pill.classList.toggle('is-open', !closed); out.links[id].pill.setAttribute('aria-pressed', String(closed)); }
      });
      const sol = view.sol, model = view.model;
      Object.keys(out.leds).forEach(function (id) {
        let k = 0;
        if (sol && model && model.byId[id]) {
          const I = Math.abs(sol.I[id] || 0);
          k = Math.min(1, I / 0.012);
          if (I < 2e-4) k = 0;
          out.leds[id].overdrive = I > 0.05;
        }
        out.leds[id].glow.style.opacity = String(f(k));
        out.leds[id].glow.setAttribute('r', String(f(14 + 16 * k)));
        out.leds[id].g.classList.toggle('lit', k > 0.04);
        out.leds[id].g.classList.toggle('overdrive', !!out.leds[id].overdrive);
      });
      Object.keys(out.motors).forEach(function (id) {
        let I = 0;
        if (sol && sol.I[id] !== undefined) I = Math.abs(sol.I[id]);
        const m = out.motors[id];
        if (I < 0.05) { m.rotor.style.animationPlayState = 'paused'; m.rotor.style.opacity = '0.45'; }
        else {
          m.rotor.style.opacity = '1';
          m.rotor.style.animationPlayState = 'running';
          m.rotor.style.animationDuration = f(Math.max(0.25, 2.4 / (I / 2))) + 's';
        }
      });
      Object.keys(out.adcs).forEach(function (id) {
        if (!sol || !model) return;
        const e = model.byId[id];
        const v = sol.V[model.netOf[e.a]] - sol.V[model.netOf[e.b]];
        const cnt = Math.max(0, Math.min(1023, Math.round(v / 5 * 1023)));
        out.adcs[id].text.textContent = String(cnt);
      });
      /* sondid mõõtepunktidel */
      Object.keys(out.tps).forEach(function (id) {
        const g = out.tps[id];
        g.classList.toggle('has-red', view.probes && view.probes.red === id);
        g.classList.toggle('has-black', view.probes && view.probes.black === id);
        g.classList.toggle('target', !!view.armedTip);
      });
    };
    return out;
  }

  function drawSymbol(g, e, sym, out, horizontal) {
    switch (sym) {
      case 'res': el('rect', { x: -27, y: -9, width: 54, height: 18, rx: 2, class: 'body' }, g); break;
      case 'conn': {
        el('rect', { x: -17, y: -7, width: 34, height: 14, rx: 7, class: 'body' }, g);
        el('path', { d: 'M0 -7 V7', class: 'body-line' }, g);
        break;
      }
      case 'ldr': {
        el('rect', { x: -27, y: -9, width: 54, height: 18, rx: 2, class: 'body' }, g);
        el('path', { d: 'M-14 -26 L-5 -14 M-5 -14 L-10 -14 M-5 -14 L-5 -19 M-2 -28 L7 -16 M7 -16 L2 -16 M7 -16 L7 -21', class: 'arrow' }, g);
        break;
      }
      case 'bat': {
        el('path', { d: 'M-5 -17 V17', class: 'plate-long' }, g);
        el('path', { d: 'M6 -9 V9', class: 'plate-short' }, g);
        el('path', { d: 'M-15 0 H-5 M6 0 H15', class: 'wire' }, g);
        break;
      }
      case 'ac': {
        el('circle', { cx: 0, cy: 0, r: 17, class: 'body' }, g);
        el('path', { d: 'M-10 0 q5 -11 10 0 t10 0', class: 'sine' }, g);
        break;
      }
      case 'led': {
        const glow = el('circle', { cx: 0, cy: 0, r: 14, class: 'led-glow', style: 'opacity:0' }, g);
        el('path', { d: 'M-10 -11 L-10 11 L11 0 Z', class: 'body' }, g);
        el('path', { d: 'M12 -12 V12', class: 'body-line' }, g);
        el('path', { d: 'M3 -17 L12 -26 M9 -14 L18 -23 M12 -26 L8 -25 M12 -26 L13 -22 M18 -23 L14 -22 M18 -23 L19 -19', class: 'arrow' }, g);
        out.leds[e.id] = { g: g, glow: glow };
        break;
      }
      case 'switch': {
        el('circle', { cx: -24, cy: 0, r: 3.4, class: 'pivot' }, g);
        el('circle', { cx: 24, cy: 0, r: 3.4, class: 'pivot' }, g);
        const blade = el('line', { x1: -24, y1: 0, x2: 24, y2: 0, class: 'blade' }, g);
        el('path', { d: 'M-30 0 H-24 M24 0 H30', class: 'wire' }, g);
        const hit = el('rect', { x: -32, y: -22, width: 64, height: 44, class: 'toggle-hit', tabindex: '0', role: 'button', 'data-toggle-sw': e.id }, g);
        void hit;
        const tgt = el('text', { x: 0, y: 24, 'text-anchor': 'middle', class: 'sw-state', transform: 'rotate(' + 0 + ')' }, g, 'SEES');
        out.switches[e.id] = { g: g, blade: blade, text: tgt };
        out.toggles[e.id] = g;
        break;
      }
      case 'link': {
        el('path', { d: 'M-17 0 Q0 -16 17 0', class: 'jumper' }, g);
        el('path', { d: 'M-17 0 H-9 M9 0 H17', class: 'jumper-stub' }, g);
        el('rect', { x: -22, y: -12, width: 44, height: 40, class: 'toggle-hit', tabindex: '0', role: 'button', 'data-toggle-link': e.id }, g);
        out.links[e.id] = { g: g };
        out.toggles[e.id] = g;
        break;
      }
      case 'fuse': {
        el('rect', { x: -26, y: -8, width: 52, height: 16, rx: 3, class: 'body' }, g);
        el('path', { d: 'M-26 0 H26', class: 'body-line' }, g);
        break;
      }
      case 'motor': {
        el('circle', { cx: 0, cy: 0, r: 22, class: 'body' }, g);
        const rotorWrap = el('g', { class: 'rotor-wrap' }, g);
        const rotor = el('g', { class: 'rotor' }, rotorWrap);
        el('circle', { cx: 0, cy: 0, r: 15, class: 'rotor-ring' }, rotor);
        out.motors[e.id] = { rotor: rotor };
        el('text', { x: 0, y: 5, 'text-anchor': 'middle', class: 'motor-m', transform: 'rotate(0)' }, g, 'M');
        break;
      }
      case 'adc': {
        el('rect', { x: -28, y: -19, width: 56, height: 38, rx: 4, class: 'body adc-box' }, g);
        break;
      }
      default: break;
    }
    if (sym === 'adc') {
      /* tekst väljaspool pööret, et jääks loetavaks */
      const parent = g.parentNode;
      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform'));
      const cx = parseFloat(m[1]), cy = parseFloat(m[2]);
      el('text', { x: cx, y: cy - 3, 'text-anchor': 'middle', class: 'adc-name' }, parent, 'A0');
      const v = el('text', { x: cx, y: cy + 14, 'text-anchor': 'middle', class: 'adc-val' }, parent, '0');
      out.adcs[e.id] = { text: v };
    }
  }

  /* ====================== 7-SEGMENT LCD ====================== */
  const SEGS = {
    '0': 'ABCDEF', '1': 'BC', '2': 'ABDEG', '3': 'ABCDG', '4': 'BCFG', '5': 'ACDFG', '6': 'ACDEFG', '7': 'ABC', '8': 'ABCDEFG', '9': 'ABCDFG',
    '-': 'G', 'O': 'ABCDEF', 'L': 'DEF', 'E': 'ADEFG', 'r': 'EG', ' ': '', 'd': 'BCDEG', 'A': 'ABCEFG', 'F': 'AEFG', 'U': 'BCDEF', 'P': 'ABEFG', 'n': 'CEG', 't': 'DEFG'
  };
  function hseg(x0, x1, y, t) { return [x0, y, x0 + t / 2, y - t / 2, x1 - t / 2, y - t / 2, x1, y, x1 - t / 2, y + t / 2, x0 + t / 2, y + t / 2].join(' '); }
  function vseg(x, y0, y1, t) { return [x, y0, x + t / 2, y0 + t / 2, x + t / 2, y1 - t / 2, x, y1, x - t / 2, y1 - t / 2, x - t / 2, y0 + t / 2].join(' '); }
  function digitGeom(w, h, t) {
    const m = h / 2;
    return {
      A: hseg(4, w - 4, 3, t), G: hseg(4, w - 4, m, t), D: hseg(4, w - 4, h - 3, t),
      F: vseg(3, 5, m - 1, t), B: vseg(w - 3, 5, m - 1, t), E: vseg(3, m + 1, h - 5, t), C: vseg(w - 3, m + 1, h - 5, t)
    };
  }

  function lcd(parent, M, rect) {
    const g = el('g', { class: 'lcd' }, parent);
    el('rect', { x: rect.x - 8, y: rect.y - 8, width: rect.w + 16, height: rect.h + 16, rx: 12, class: 'lcd-bezel' }, g);
    el('rect', { x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: 6, class: 'lcd-glass', fill: M.look.lcdBg }, g);
    const cellW = 36, cellH = 58, t = 6;
    const geom = digitGeom(cellW - 6, cellH, t);
    const cells = [];
    const startX = rect.x + 12;
    const digitsY = rect.y + 24;
    const skew = el('g', { transform: 'skewX(-5)' }, g);
    for (let i = 0; i < 5; i++) {
      const cg = el('g', { transform: 'translate(' + (startX + i * cellW + (i === 0 ? 0 : 0)) + ' ' + digitsY + ')' }, skew);
      const segs = {};
      Object.keys(geom).forEach(function (k) { segs[k] = el('polygon', { points: geom[k], class: 'seg' }, cg); });
      const dp = el('circle', { cx: cellW - 3, cy: cellH - 3, r: 3, class: 'seg dp' }, cg);
      cells.push({ segs: segs, dp: dp });
    }
    const ann = el('text', { x: rect.x + 10, y: rect.y + 16, class: 'lcd-ann' }, g, '');
    const ann2 = el('text', { x: rect.x + rect.w - 10, y: rect.y + 16, 'text-anchor': 'end', class: 'lcd-ann' }, g, '');
    const unit = el('text', { x: rect.x + rect.w - 10, y: rect.y + rect.h - 12, 'text-anchor': 'end', class: 'lcd-unit' }, g, '');
    const msg = el('text', { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 + 6, 'text-anchor': 'middle', class: 'lcd-msg' }, g, '');

    function setCells(input) {
      /* input: tekst 'M.mmm' või massiiv [{c,dp}] – 5 positsiooni (miinus + 4 numbrit) */
      let arr = [];
      if (typeof input === 'string') {
        for (let i = 0; i < input.length; i++) {
          const c = input[i];
          if (c === '.') { if (arr.length) arr[arr.length - 1].dp = true; }
          else arr.push({ c: c, dp: false });
        }
        while (arr.length < 5) arr.unshift({ c: ' ', dp: false });
      } else arr = input;
      for (let i = 0; i < 5; i++) {
        const ch = arr[i] || { c: ' ', dp: false };
        const on = SEGS[ch.c] || '';
        Object.keys(cells[i].segs).forEach(function (k) { cells[i].segs[k].classList.toggle('on', on.indexOf(k) >= 0); });
        cells[i].dp.classList.toggle('on', !!ch.dp);
      }
    }
    return {
      g: g,
      show: function (o) {
        o = o || {};
        msg.textContent = o.msg || '';
        if (o.blank) { setCells('  '); unit.textContent = ''; ann.textContent = o.ann || ''; ann2.textContent = ''; g.classList.toggle('dim', true); return; }
        g.classList.toggle('dim', false);
        if (o.ol && o.olText === '1') setCells([{ c: ' ' }, { c: '1' }, { c: ' ' }, { c: ' ' }, { c: ' ' }]);
        else if (o.ol) setCells('  OL');
        else setCells(o.text || '');
        unit.textContent = o.unit || '';
        ann.textContent = o.ann || '';
        ann2.textContent = o.ann2 || '';
      }
    };
  }

  /* ====================== MULTIMEETER ====================== */
  function meter(parent, M) {
    const W = M.look.w, H = M.look.h;
    const root = el('g', { class: 'meter meter-' + M.id }, parent);
    /* korpus */
    el('rect', { x: 0, y: 0, width: W, height: H, rx: 34, class: 'm-shadow', transform: 'translate(5 7)' }, root);
    el('rect', { x: 0, y: 0, width: W, height: H, rx: 34, fill: M.look.body, class: 'm-body' }, root);
    if (M.id === 'm1') {
      el('rect', { x: 10, y: 10, width: W - 20, height: H - 20, rx: 26, fill: 'none', stroke: M.look.bodyDark, 'stroke-width': 3 }, root);
    } else if (M.id === 'm2') {
      el('rect', { x: 0, y: 0, width: W, height: 150, rx: 34, fill: M.look.bodyDark }, root);
      el('rect', { x: 0, y: 100, width: W, height: 50, fill: M.look.bodyDark }, root);
      el('path', { d: 'M0 150 H' + W, stroke: '#E9B72A', 'stroke-width': 3 }, root);
    } else {
      el('rect', { x: 0, y: 0, width: W, height: 26, rx: 34, fill: M.look.accent }, root);
      el('rect', { x: 0, y: 14, width: W, height: 12, fill: M.look.accent }, root);
      el('rect', { x: 0, y: H - 30, width: W, height: 30, rx: 30, fill: M.look.accent }, root);
      el('rect', { x: 0, y: H - 30, width: W, height: 14, fill: M.look.accent }, root);
    }
    /* nimi */
    el('text', { x: W / 2, y: M.id === 'm3' ? 20 : 18, 'text-anchor': 'middle', class: 'm-name', fill: M.look.ink }, root, M.name);
    const lc = lcd(root, M, M.lcd);

    /* valikulüliti */
    const d = M.dial;
    const dialG = el('g', { class: 'dial' }, root);
    const hits = [];
    const rl = d.rLabel;
    M.positions.forEach(function (p, i) {
      const a = p.angle * Math.PI / 180;
      const sx = Math.sin(a), cy_ = -Math.cos(a);
      const x = d.cx + rl * sx, y = d.cy + rl * cy_;
      const col = (M.groups[p.group] && M.groups[p.group].color) || M.look.ink;
      const anchor = sx > 0.35 ? 'start' : sx < -0.35 ? 'end' : 'middle';
      const dx = anchor === 'start' ? 5 : anchor === 'end' ? -5 : 0;
      const dy = cy_ > 0.6 ? 11 : cy_ < -0.6 ? -4 : 4;
      const pg = el('g', { class: 'dpos', 'data-i': i, tabindex: '0', role: 'button', 'aria-label': M.name + ' valikulüliti: ' + p.label }, dialG);
      el('circle', { cx: x + (anchor === 'middle' ? 0 : dx * 3), cy: y + (dy < 0 ? -2 : 0) - (dy > 5 ? 4 : 0), r: 15, class: 'dpos-hit' }, pg);
      el('text', { x: x + dx, y: y + dy, 'text-anchor': anchor, class: 'dpos-label', fill: col }, pg, p.label);
      /* tick */
      el('line', { x1: d.cx + (d.r + 5) * sx, y1: d.cy + (d.r + 5) * cy_, x2: d.cx + (d.r + 11) * sx, y2: d.cy + (d.r + 11) * cy_, stroke: col, 'stroke-width': 2, 'stroke-linecap': 'round' }, dialG);
      hits.push(pg);
    });
    /* rühmasildid (ainult MM-100) */
    if (M.id === 'm1') {
      const byGroup = {};
      M.positions.forEach(function (p) { (byGroup[p.group] = byGroup[p.group] || []).push(p.angle); });
      Object.keys(byGroup).forEach(function (gk) {
        const grp = M.groups[gk];
        if (!grp || !grp.name) return;
        const angs = byGroup[gk];
        const mid = (angs[0] + angs[angs.length - 1]) / 2 * Math.PI / 180;
        el('text', { x: d.cx + (d.r + 24) * Math.sin(mid), y: d.cy - (d.r + 24) * Math.cos(mid) + 4, 'text-anchor': 'middle', class: 'dgroup', fill: grp.color }, dialG, grp.name);
      });
    }
    const knob = el('g', { class: 'knob', tabindex: '0', role: 'slider', 'aria-label': M.name + ' valikulüliti' }, dialG);
    el('circle', { cx: d.cx, cy: d.cy, r: d.r + 3, fill: M.look.knobRing }, knob);
    el('circle', { cx: d.cx, cy: d.cy, r: d.r, fill: M.look.knob, class: 'knob-face' }, knob);
    for (let k = 0; k < 24; k++) {
      const a = k * 15 * Math.PI / 180;
      el('line', { x1: d.cx + (d.r - 3) * Math.sin(a), y1: d.cy - (d.r - 3) * Math.cos(a), x2: d.cx + d.r * Math.sin(a), y2: d.cy - d.r * Math.cos(a), stroke: 'rgba(255,255,255,.18)', 'stroke-width': 2 }, knob);
    }
    el('path', { d: 'M' + d.cx + ' ' + (d.cy - 10) + ' L' + (d.cx - 6) + ' ' + (d.cy - d.r + 6) + ' L' + (d.cx + 6) + ' ' + (d.cy - d.r + 6) + ' Z', fill: M.id === 'm3' ? '#D13F3A' : '#F2F2F2' }, knob);
    el('circle', { cx: d.cx, cy: d.cy, r: 7, fill: 'rgba(255,255,255,.12)' }, knob);

    /* nupud */
    const buttons = {};
    (M.buttons || []).forEach(function (b) {
      const bg = el('g', { class: 'mbtn', 'data-btn': b.id, tabindex: '0', role: 'button', 'aria-label': b.label }, root);
      el('rect', { x: b.x - b.w / 2, y: b.y - b.h / 2, width: b.w, height: b.h, rx: 9, fill: b.fill, class: 'mbtn-bg' }, bg);
      el('text', { x: b.x, y: b.y + 5, 'text-anchor': 'middle', class: 'mbtn-label', fill: b.text }, bg, b.label);
      buttons[b.id] = bg;
    });
    /* MÕÕDA / SALVESTA */
    const mb = el('g', { class: 'measure-btn', tabindex: '0', role: 'button' }, root);
    const mbY = M.id === 'm1' ? 478 : 505;
    el('rect', { x: W / 2 - 78, y: mbY - 19, width: 156, height: 38, rx: 19, class: 'measure-bg' }, mb);
    const mbText = el('text', { x: W / 2, y: mbY + 6, 'text-anchor': 'middle', class: 'measure-label' }, mb, 'MÕÕDA');

    /* pesad */
    const jacks = {};
    M.jacks.forEach(function (j) {
      const jg = el('g', { class: 'jack', 'data-jack': j.id, tabindex: '0', role: 'button', 'aria-label': 'Pesa ' + j.label }, root);
      el('circle', { cx: j.x, cy: j.y, r: 27, class: 'jack-hit' }, jg);
      el('circle', { cx: j.x, cy: j.y, r: 18, fill: '#161616', stroke: j.ring, 'stroke-width': 4, class: 'jack-ring' }, jg);
      el('circle', { cx: j.x, cy: j.y, r: 8, fill: '#050505' }, jg);
      /* sildid pesa kohal, et allapoole rippuvad juhtmed neid ei kataks */
      el('text', { x: j.x, y: j.y - 41, 'text-anchor': 'middle', class: 'jack-label', fill: M.look.ink }, jg, j.label);
      if (j.sub) el('text', { x: j.x, y: j.y - 27, 'text-anchor': 'middle', class: 'jack-sub', fill: M.look.ink }, jg, j.sub);
      jacks[j.id] = jg;
    });

    /* kaitse hoiatused */
    const fuseTxt = el('text', { x: W / 2, y: H - 8, 'text-anchor': 'middle', class: 'fuse-msg' }, root, '');

    let curAngle = 0, tween = null;
    function setAngle(a) {
      curAngle = a;
      knob.setAttribute('transform', 'rotate(' + f(a) + ' ' + d.cx + ' ' + d.cy + ')');
    }
    return {
      root: root, lcd: lc, knob: knob, dposEls: hits, jacks: jacks, buttons: buttons, measureBtn: mb, measureText: mbText, fuseTxt: fuseTxt,
      W: W, H: H,
      setDial: function (idx, instant) {
        const target = M.positions[idx].angle;
        let from = curAngle;
        /* lühim tee */
        let delta = ((target - from + 540) % 360) - 180;
        const to = from + delta;
        if (tween) cancelAnimationFrame(tween);
        if (instant) { setAngle(target); return; }
        const t0 = performance.now(), dur = 170;
        const step = function (now) {
          const k = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - k, 3);
          setAngle(from + (to - from) * e);
          if (k < 1) tween = requestAnimationFrame(step); else { setAngle(target); tween = null; }
        };
        tween = requestAnimationFrame(step);
      },
      markActive: function (idx) {
        hits.forEach(function (h, i) { h.classList.toggle('active', i === idx); });
      }
    };
  }

  /* kaabel: kahe punkti vahel longus ots */
  function cablePath(p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const sag = Math.min(24 + dist * 0.1, 60);
    const c1 = { x: p1.x + dx * 0.15, y: Math.max(p1.y, p2.y) + sag * 0.55 + (p1.y > p2.y ? 0 : 0) };
    const c2 = { x: p2.x - dx * 0.15, y: Math.max(p1.y, p2.y) + sag };
    return 'M' + f(p1.x) + ' ' + f(p1.y) + ' C' + f(c1.x) + ' ' + f(c1.y) + ' ' + f(c2.x) + ' ' + f(c2.y) + ' ' + f(p2.x) + ' ' + f(p2.y);
  }

  root.Draw = { NS: NS, el: el, G: G, OX: OX, OY: OY, pxy: pxy, schematic: schematic, meter: meter, cablePath: cablePath };
})(typeof self !== 'undefined' ? self : this);
