/* Mõõtepink – mängu liides: menüü, laud, juhtmed, mõõtja, ülesanded, rikkeotsing. */
(function () {
  'use strict';
  const D = Draw;
  const KEY = 'mootepink-v1';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const MQ = window.matchMedia ? window.matchMedia('(max-width: 1000px)') : { matches: false, addEventListener: function () {} };

  /* ---------------------------------------------------------------- abi */
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v === false || v === null || v === undefined) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  /* ---------------------------------------------------------------- salvestus */
  let prog = { stars: {}, sound: false };
  try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && typeof raw === 'object') prog = Object.assign(prog, raw); } catch (e) { /* ilma salvestuseta ka töötab */ }
  if (!prog.stars) prog.stars = {};
  function saveProg() { try { localStorage.setItem(KEY, JSON.stringify(prog)); } catch (e) { /* ignoreeri */ } }

  const urlSeedRaw = new URLSearchParams(location.search).get('seed');
  const urlSeed = (urlSeedRaw !== null && /^\d+$/.test(urlSeedRaw)) ? parseInt(urlSeedRaw, 10) : null;

  /* ---------------------------------------------------------------- heli */
  const Sound = (function () {
    let ctx = null;
    function ensure() {
      if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) ctx = new C(); }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tone(f, d, type, v, t0) {
      if (!prog.sound) return;
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      const t = c.currentTime + (t0 || 0);
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.03);
    }
    return {
      ok: function () { tone(880, 0.12, 'sine'); tone(1320, 0.16, 'sine', 0.07, 0.1); },
      bad: function () { tone(190, 0.28, 'square', 0.05); },
      pop: function () { tone(90, 0.3, 'sawtooth', 0.1); tone(55, 0.25, 'square', 0.08, 0.05); },
      tick: function () { tone(1500, 0.03, 'square', 0.025); },
      beep: function () { tone(2200, 0.2, 'square', 0.04); }
    };
  })();

  let toastTimer = null;
  function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 5200);
  }

  /* ---------------------------------------------------------------- olek */
  let S = null;       /* ühe taseme olek */
  let ctl = {};       /* lava viited */
  let ignoreClickUntil = 0;
  let lastBeep = false;
  const seenMeters = {};

  function args() {
    return {
      circuit: S.circuit,
      cond: { links: S.cond.links, switches: S.cond.switches, fault: S.fault ? { mods: S.fault.mods } : null },
      meterId: S.meterId, ms: S.ms, plugs: S.plugs, tips: S.tips
    };
  }
  function isTrain() { return S.level.kind === 'train'; }
  function meterNow() { return Meters.get(S.meterId); }
  function hashStr(s) { let x = 7; for (let i = 0; i < s.length; i++) x = (Math.imul(x, 31) + s.charCodeAt(i)) | 0; return x >>> 0; }

  function initialMeterState(level, meterId, seed) {
    const M = Meters.get(meterId);
    const ms = Meters.newState(M);
    const plugs = { red: null, black: null };
    const st = level.start || { mode: 'clean' };
    if (st.mode === 'fixed' && st.fixed && st.fixed[meterId]) {
      const f = st.fixed[meterId];
      ms.dial = Math.max(0, M.positions.findIndex(function (p) { return p.id === f.dial; }));
      plugs.red = f.red || null; plugs.black = f.black || null;
    } else if (st.mode === 'random') {
      const r = Engine.rng(seed * 13 + hashStr(meterId));
      ms.dial = 1 + Math.floor(r() * (M.positions.length - 1));
      M.positions.forEach(function (p, i) { if (p.modes.length > 1) ms.modeSel[i] = Math.floor(r() * p.modes.length); });
      const nonCom = M.jacks.filter(function (j) { return j.kinds.indexOf('COM') < 0; });
      plugs.red = nonCom[Math.floor(r() * nonCom.length)].id;
      plugs.black = (r() < 0.55) ? M.jacks.find(function (j) { return j.kinds.indexOf('COM') >= 0; }).id : M.jacks[Math.floor(r() * M.jacks.length)].id;
      if (plugs.black === plugs.red) plugs.black = M.jacks.find(function (j) { return j.kinds.indexOf('COM') >= 0; }).id;
    }
    return { ms: ms, plugs: plugs };
  }

  /* ---------------------------------------------------------------- vaated */
  function showView(name) {
    $('#view-menu').classList.toggle('hidden', name !== 'menu');
    $('#view-game').classList.toggle('hidden', name !== 'game');
    $('#btn-home').classList.toggle('hidden', name === 'menu');
    if (name === 'menu') { S = null; renderMenu(); window.scrollTo(0, 0); }
  }
  function goMenu() {
    ['dlg-pred', 'dlg-diag', 'dlg-result', 'dlg-quiz', 'dlg-meter'].forEach(function (id) { const d = $('#' + id); if (d.open) d.close(); });
    showView('menu');
  }

  function starsHtml(n) {
    let s = '';
    for (let i = 0; i < 3; i++) s += (i < n) ? '★' : '☆';
    return s;
  }

  function renderMenu() {
    const root = $('#view-menu');
    root.innerHTML = '';
    root.appendChild(h('h2', { text: 'Vali ülesanne' }));
    root.appendChild(h('p', { class: 'lead', text: 'Mõõtja seadistad ise: pistikud pesadesse, valikulüliti õigesse asendisse, sondid mõõtepunktidele. Alguses harjutad mõõtmist, hiljem otsid vooluringist rikkeid.' }));

    const firstUse = {};
    Levels.list.forEach(function (l) { l.meters.forEach(function (m) { if (!firstUse[m]) firstUse[m] = l.id; }); });
    function section(title, intro, kind) {
      root.appendChild(h('h3', { text: title }));
      root.appendChild(h('p', { class: 'small', text: intro, style: 'margin:0 0 6px;color:var(--ink-dim)' }));
      const ul = h('ul', { class: 'joblist' });
      Levels.list.filter(function (l) { return l.kind === kind; }).forEach(function (l) {
        const n = prog.stars[l.id] || 0;
        const chips = h('div', { class: 'meters' }, l.meters.map(function (m) {
          return h('span', { class: 'chip' + (firstUse[m] === l.id ? ' new' : ''), text: Meters.get(m).name, title: firstUse[m] === l.id ? 'Uus mõõtja' : '' });
        }));
        const st = h('div', { class: 'stars', 'aria-label': n + ' tärni kolmest' });
        st.innerHTML = '<b>' + starsHtml(n).slice(0, n) + '</b>' + starsHtml(n).slice(n);
        const li = h('li', { class: 'job', tabindex: '0', role: 'button', 'aria-label': l.id + ' ' + l.title }, [
          h('div', { class: 'id', text: l.id }),
          h('div', null, [h('div', { class: 'title', text: l.title }), h('div', { class: 'sub', text: l.summary })]),
          chips, st
        ]);
        li.addEventListener('click', function () { startLevel(l.id); });
        li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startLevel(l.id); } });
        ul.appendChild(li);
      });
      root.appendChild(ul);
    }
    section('Mõõtmise alused', 'Ekraan näitab kohe, mida mõõtja tegelikult mõõdab. Salvesta õiged näidud ja vasta küsimustele.', 'train');
    section('Rikkeotsing', 'Rike on igal mängukorral teine. Ekraan näitab väärtust alles pärast nuppu MÕÕDA ja enne seda ennustad, mida terves vooluringis näeksid.', 'fault');

    const foot = h('div', { class: 'foot' });
    foot.appendChild(h('p', { html: 'Õpetajale: lisa aadressi lõppu <b>?seed=123</b>, et kõik õpilased saaksid ühe taseme sama rikke (ja sama juhuslikud takistid). Edusammud jäävad selle brauseri kohalikku mällu.' }));
    foot.appendChild(h('button', { class: 'btn ghost small', text: 'Nulli edusammud', onclick: function () {
      if (confirm('Kustutan selle brauseri tärnid. Kas jätkan?')) { prog.stars = {}; saveProg(); renderMenu(); }
    } }));
    root.appendChild(foot);
  }

  /* ---------------------------------------------------------------- taseme algus */
  function startLevel(id, keep) {
    const level = Levels.get(id);
    const idx = Levels.list.indexOf(level);
    let seed;
    if (urlSeed !== null) seed = urlSeed;
    else if (keep && S && S.level.id === id) seed = S.seed;
    else seed = 10000 + Math.floor(Math.random() * 89999);
    const rand = Engine.rng(seed * 31 + idx * 7 + 1);
    const built = level.build(rand);
    const fault = level.kind === 'fault' ? Levels.activeFault(level, rand) : null;
    S = {
      level: level, seed: seed, circuit: built.circuit, params: built.params, fault: fault,
      meterId: level.meters[0], ms: null, plugs: { red: null, black: null }, tips: { red: null, black: null },
      cond: { links: {}, switches: {} },
      records: [], log: [], nrec: 0, held: null, res: null,
      armed: null, drag: null,
      taskDone: {}, errors: 0, setupErrors: 0, hints: 0, hintIdx: 0, elimUsed: false, elim: null,
      budgetLeft: level.budget || 0, predTotal: 0, predRight: 0, attempts: 2, wrongTries: 0,
      finished: false, quizDone: false, ctx: null, struck: {}
    };
    if (level.kind === 'train') S.ctx = Object.assign({ params: built.params }, Rules.trainContext(built.circuit));
    const st = initialMeterState(level, S.meterId, seed);
    S.ms = st.ms; S.plugs = st.plugs;
    showView('game');
    renderSide();
    buildStage();
    refresh();
    renderLog();
    const firstSeen = !seenMeters[S.meterId];
    seenMeters[S.meterId] = true;
    if (firstSeen && level.id !== 'T1') openMeterInfo(S.meterId);
  }

  function switchMeter(id) {
    if (!S || S.level.meters.indexOf(id) < 0 || id === S.meterId) return;
    S.meterId = id;
    const st = initialMeterState(S.level, id, S.seed);
    S.ms = st.ms; S.plugs = st.plugs; S.held = null; S.armed = null;
    buildStage(); refresh();
    if (!seenMeters[id]) { seenMeters[id] = true; openMeterInfo(id); }
    else toast(Meters.get(id).name + ' on lauale tõstetud. Pistikud on tagasi alusel.');
  }

  /* ---------------------------------------------------------------- külgpaneel */
  function renderSide() {
    const L = S.level, side = $('#side');
    side.innerHTML = '';
    side.appendChild(h('button', { class: 'backlink', text: '← Ülesanded', onclick: goMenu }));
    side.appendChild(h('div', { class: 'tag', text: L.id + ' · ' + (isTrain() ? 'Mõõtmise alused' : 'Rikkeotsing') }));
    side.appendChild(h('h2', { text: L.title }));
    const story = h('div', { class: 'story' });
    L.story(S.params).forEach(function (p) { story.appendChild(h('p', { text: p })); });
    side.appendChild(story);
    side.appendChild(h('p', { class: 'small', text: 'Variant ' + S.seed }));

    if (isTrain()) {
      side.appendChild(h('h3', { text: 'Ülesanded' }));
      const ul = h('ul', { class: 'tasks', id: 'tasks' });
      L.tasks.forEach(function (t) {
        const li = h('li', { 'data-task': t.id }, [
          h('div', { class: 'mark', text: '✓', 'aria-hidden': 'true' }),
          h('div', null, [h('div', { class: 'ttext', text: t.text })])
        ]);
        if (t.answer) {
          const inp = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Vastus (' + t.answer.unit + ')', id: 'ans-' + t.id });
          const btn = h('button', { class: 'btn small', text: 'Kontrolli', onclick: function () { checkAnswerTask(t); } });
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') checkAnswerTask(t); });
          li.lastChild.appendChild(h('div', { class: 'ans' }, [inp, h('span', { text: t.answer.unit }), btn]));
          li.lastChild.appendChild(h('div', { class: 'small', id: 'fb-' + t.id }));
        }
        ul.appendChild(li);
      });
      side.appendChild(ul);
    } else {
      side.appendChild(h('h3', { text: 'Seis' }));
      side.appendChild(h('div', { class: 'stats' }, [
        h('div', { class: 'stat', id: 'st-left' }, [h('b', { text: '0' }), h('span', { text: 'mõõtmist järel' })]),
        h('div', { class: 'stat' }, [h('b', { text: String(L.par), style: 'color:var(--ink)' }), h('span', { text: 'sihtmärk' })]),
        h('div', { class: 'stat', id: 'st-hints' }, [h('b', { text: '0' }), h('span', { text: 'vihjet' })])
      ]));
      side.appendChild(h('div', { class: 'row' }, [
        h('button', { class: 'btn', id: 'btn-diag', text: 'Tee diagnoos', onclick: openDiagnosis }),
        h('button', { class: 'btn ghost', id: 'btn-hint', text: 'Vihje', onclick: giveHint })
      ]));
    }
    if (isTrain()) side.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn ghost small', id: 'btn-hint', text: 'Vihje', onclick: giveHint })]));
    side.appendChild(h('div', { id: 'hintbox', class: 'small', style: 'margin-top:8px' }));
    side.appendChild(h('div', { id: 'endbox' }));
    side.appendChild(h('h3', { text: 'Mõõtmised' }));
    side.appendChild(h('ol', { class: 'log', id: 'log', style: 'list-style:none' }));
    updateStats();
    updateTaskMarks();
  }

  function updateStats() {
    if (!S || isTrain()) return;
    const left = $('#st-left'), hints = $('#st-hints');
    if (left) { left.firstChild.textContent = String(S.budgetLeft); left.classList.toggle('low', S.budgetLeft <= 2); }
    if (hints) hints.firstChild.textContent = String(S.hints);
    const d = $('#btn-diag');
    if (d) d.textContent = 'Tee diagnoos (' + S.attempts + (S.attempts === 1 ? ' katse' : ' katset') + ')';
  }
  function updateTaskMarks() {
    if (!S || !isTrain()) return;
    S.level.tasks.forEach(function (t) {
      const li = $('#tasks [data-task="' + t.id + '"]');
      if (!li) return;
      li.classList.toggle('done', !!S.taskDone[t.id]);
      const inp = li.querySelector('input');
      if (inp) { inp.disabled = !!S.taskDone[t.id]; li.querySelector('button').disabled = !!S.taskDone[t.id]; }
    });
  }

  /* ---------------------------------------------------------------- logi */
  function setupText(rec) {
    const M = Meters.get(rec.meterId);
    const jk = function (id) { const j = M.jacks.find(function (x) { return x.id === id; }); return j ? j.label : '–'; };
    const m = M.positions[rec.ms.dial].modes[(rec.ms.modeSel && rec.ms.modeSel[rec.ms.dial]) || 0];
    const range = rec.disp && rec.disp.fs ? ' ' + rec.disp.fs : '';
    return M.name + ' · ' + (m.tag || '') + (M.auto ? '' : range) + ' · punane ' + jk(rec.plugs.red) + ', must ' + jk(rec.plugs.black);
  }
  function renderLog() {
    const ol = $('#log');
    if (!ol) return;
    ol.innerHTML = '';
    if (!S.log.length) {
      ol.appendChild(h('li', { class: 'empty', text: isTrain() ? 'Salvestatud näidud ilmuvad siia.' : 'Siia ilmuvad sinu mõõtmised.' }));
      return;
    }
    S.log.forEach(function (e) {
      const li = h('li');
      if (e.type === 'event') {
        li.appendChild(h('div', { class: 'what ' + (e.bad ? 'event' : ''), text: e.text }));
      } else {
        const r = e.rec;
        li.appendChild(h('div', { class: 'l1' }, [
          h('span', { class: 'n', text: String(r.n) }),
          h('span', { class: 'reading', text: r.reading || '–' }),
          h('span', { class: 'what', text: r.what })
        ]));
        li.appendChild(h('div', { class: 'setup', text: setupText(r) }));
        if (r.pred) {
          if (r.pred.ok === true) li.appendChild(h('div', { class: 'verdict v-ok', text: 'Ennustasid ' + r.pred.text + ' – õige. Terves ahelas näitaks sama seadistus ' + r.pred.expectedText + '.' }));
          else if (r.pred.ok === false) li.appendChild(h('div', { class: 'verdict v-warn', text: 'Ennustasid ' + r.pred.text + '. Terves ahelas näitaks sama seadistus ' + r.pred.expectedText + '.' }));
          else li.appendChild(h('div', { class: 'verdict', style: 'color:var(--ink-dim)', text: 'Ennustus: ' + r.pred.text + ' (seadistuse tõttu ei hinnatud).' }));
        }
        r.flags.forEach(function (f) { li.appendChild(h('div', { class: 'flag ' + f.severity, text: f.text })); });
        (r.doneTexts || []).forEach(function (t) { li.appendChild(h('div', { class: 'verdict v-ok', text: '✓ ' + t })); });
        (r.notes || []).forEach(function (t) { li.appendChild(h('div', { class: 'verdict v-warn', text: t })); });
      }
      ol.appendChild(li);
    });
  }
  function addEvent(text, bad) { S.log.unshift({ type: 'event', text: text, bad: !!bad }); renderLog(); }

  /* ---------------------------------------------------------------- lava */
  function layout(circuit, narrow) {
    const MW = 300, MH = 640;
    const slots = function (y, x0) {
      return { red: { tip: { x: x0 + 90, y: y }, plug: { x: x0 + 250, y: y } }, black: { tip: { x: x0 + 490, y: y }, plug: { x: x0 + 650, y: y } } };
    };
    if (!narrow) {
      const W = 1170, H = 700;
      return { narrow: false, W: W, H: H, schem: { x: 10, y: 10 }, meter: { x: 850, y: 30 }, tray: { x: 10, y: 548, w: 810, h: 142 }, slots: slots(620, 10), labelY: 574 };
    }
    const schH = D.OY + (circuit.rows - 1) * D.G + 60;
    const trayY = schH + 6;
    const slotsN = function (y) {
      return { red: { tip: { x: 90, y: y }, plug: { x: 270, y: y } }, black: { tip: { x: 490, y: y }, plug: { x: 670, y: y } } };
    };
    return { narrow: true, W: 830, H: trayY + 160 + MH + 30, schem: { x: 10, y: 0 }, meter: { x: 265, y: trayY + 160 }, tray: { x: 10, y: trayY, w: 810, h: 142 }, slots: slotsN(trayY + 90), labelY: trayY + 30 };
  }

  const LEAD = {
    red: { col: '#E5484D', rim: '#FFD3CF', name: 'punane' },
    black: { col: '#16161A', rim: '#DDE7E0', name: 'must' }
  };

  function buildStage() {
    const svg = $('#stage');
    svg.innerHTML = '';
    const M = meterNow();
    const L = layout(S.circuit, MQ.matches);
    svg.setAttribute('viewBox', '0 0 ' + L.W + ' ' + L.H);
    ctl = { svg: svg, L: L };

    const defs = D.el('defs', null, svg);
    const rg = D.el('radialGradient', { id: 'ledGlow' }, defs);
    D.el('stop', { offset: '0%', 'stop-color': '#fff1b8', 'stop-opacity': '1' }, rg);
    D.el('stop', { offset: '45%', 'stop-color': '#ff6a3d', 'stop-opacity': '.85' }, rg);
    D.el('stop', { offset: '100%', 'stop-color': '#ff3d2e', 'stop-opacity': '0' }, rg);
    const pat = D.el('pattern', { id: 'matdots', x: D.OX - D.G / 2, y: D.OY - D.G / 2, width: D.G, height: D.G, patternUnits: 'userSpaceOnUse' }, defs);
    D.el('circle', { cx: D.G / 2, cy: D.G / 2, r: 1.5, class: 'mat-dot' }, pat);

    /* skeem */
    const gS = D.el('g', { transform: 'translate(' + L.schem.x + ' ' + L.schem.y + ')' }, svg);
    D.el('rect', { x: 0, y: 0, width: D.OX + circuit_w(S.circuit), height: D.OY + (S.circuit.rows) * D.G, fill: 'url(#matdots)', 'pointer-events': 'none' }, gS);
    ctl.schem = D.schematic(gS, S.circuit);

    /* alus juhtmetele */
    const gT = D.el('g', { class: 'tray' }, svg);
    D.el('rect', { x: L.tray.x, y: L.tray.y, width: L.tray.w, height: L.tray.h, rx: 14, class: 'tray-bg tray-box', fill: 'rgba(0,0,0,.16)', stroke: '#1C6A52', 'stroke-width': 1.5 }, gT);
    D.el('text', { x: L.tray.x + 16, y: L.labelY, class: 'tray-label' }, gT, 'JUHTMED');
    ['red', 'black'].forEach(function (lead) {
      ['tip', 'plug'].forEach(function (end) {
        const p = L.slots[lead][end];
        D.el('circle', { cx: p.x, cy: p.y, r: 20, class: 'tray-slot tray-bg' }, gT);
        D.el('text', { x: p.x, y: p.y + 44, 'text-anchor': 'middle', class: 'tray-label' }, gT, LEAD[lead].name + (end === 'tip' ? ' sond' : ' pistik'));
      });
    });

    /* mõõtja */
    const gM = D.el('g', { transform: 'translate(' + L.meter.x + ' ' + L.meter.y + ')' }, svg);
    ctl.mctl = D.meter(gM, M);
    ctl.mctl.setDial(S.ms.dial, true);

    /* juhtmed */
    const gL = D.el('g', { class: 'leads' }, svg);
    ctl.gL = gL;
    ctl.leads = {};
    ['red', 'black'].forEach(function (lead) {
      const g = D.el('g', { class: 'lead lead-' + lead }, gL);
      const out = D.el('path', { class: 'cable-out', stroke: LEAD[lead].rim, 'stroke-width': 9.5, opacity: 0.55 }, g);
      const cab = D.el('path', { class: 'cable', stroke: LEAD[lead].col, 'stroke-width': 5.5 }, g);
      ctl.leads[lead] = { out: out, cab: cab };
    });
    ['red', 'black'].forEach(function (lead) {
      ctl.leads[lead].plug = mkHandle(lead, 'plug', gL);
      ctl.leads[lead].tip = mkHandle(lead, 'tip', gL);
    });
    updateLeads();
  }
  function circuit_w(c) { return (c.cols - 1) * D.G + 40; }

  function mkHandle(lead, end, parent) {
    const col = LEAD[lead].col;
    const label = (lead === 'red' ? 'Punase' : 'Musta') + ' juhtme ' + (end === 'tip' ? 'sond' : 'pistik');
    const g = D.el('g', { class: 'handle handle-' + end, 'data-lead': lead, 'data-end': end, tabindex: '0', role: 'button', 'aria-label': label }, parent);
    if (end === 'plug') {
      D.el('circle', { class: 'h-ring', r: 23 }, g);
      D.el('circle', { r: 14, fill: col, stroke: lead === 'black' ? '#E8EEE9' : '#FFD3CF', 'stroke-width': 2.5 }, g);
      D.el('circle', { r: 5, fill: lead === 'black' ? '#E8EEE9' : '#3a0d0d', opacity: 0.85 }, g);
      D.el('circle', { class: 'h-hit', r: 22, fill: 'transparent' }, g);
    } else {
      D.el('circle', { class: 'h-ring', cx: 14, cy: -19, r: 26 }, g);
      D.el('line', { x1: 0, y1: 0, x2: 8, y2: -11, stroke: '#D6DDD9', 'stroke-width': 3.2, 'stroke-linecap': 'round' }, g);
      D.el('line', { x1: 8, y1: -11, x2: 24, y2: -33, stroke: col, 'stroke-width': 12, 'stroke-linecap': 'round' }, g);
      D.el('line', { x1: 8, y1: -11, x2: 24, y2: -33, stroke: lead === 'black' ? '#E8EEE9' : '#FFD3CF', 'stroke-width': 12, 'stroke-linecap': 'round', opacity: 0.22 }, g);
      D.el('circle', { class: 'h-hit', cx: 19, cy: -26, r: 16, fill: 'transparent' }, g);
    }
    return g;
  }

  function jackWorld(id) {
    const M = meterNow();
    const j = M.jacks.find(function (x) { return x.id === id; });
    return { x: ctl.L.meter.x + j.x, y: ctl.L.meter.y + j.y };
  }
  function pointWorld(id) {
    const q = ctl.schem.pts[id];
    return { x: ctl.L.schem.x + q.x, y: ctl.L.schem.y + q.y };
  }
  function leadPos(lead, end) {
    if (S.drag && S.drag.moved && S.drag.lead === lead && S.drag.end === end) return S.drag.pos;
    if (end === 'plug') return S.plugs[lead] ? jackWorld(S.plugs[lead]) : ctl.L.slots[lead].plug;
    if (S.tips[lead]) {
      const p = pointWorld(S.tips[lead]);
      if (lead === 'black' && S.tips.red === S.tips.black && !(S.drag && S.drag.moved && S.drag.lead === 'red' && S.drag.end === 'tip')) return { x: p.x + 24, y: p.y + 6 };
      return p;
    }
    return ctl.L.slots[lead].tip;
  }
  function updateLeads() {
    if (!ctl.leads) return;
    ['red', 'black'].forEach(function (lead) {
      const lp = ctl.leads[lead];
      const pp = leadPos(lead, 'plug'), tp = leadPos(lead, 'tip');
      lp.plug.setAttribute('transform', 'translate(' + pp.x + ' ' + pp.y + ')');
      lp.tip.setAttribute('transform', 'translate(' + tp.x + ' ' + tp.y + ')');
      const d = D.cablePath(pp, { x: tp.x + 24, y: tp.y - 33 });
      lp.out.setAttribute('d', d); lp.cab.setAttribute('d', d);
      const armedP = S.armed && S.armed.lead === lead && S.armed.end === 'plug';
      const armedT = S.armed && S.armed.lead === lead && S.armed.end === 'tip';
      lp.plug.classList.toggle('armed', !!armedP);
      lp.tip.classList.toggle('armed', !!armedT);
    });
  }

  /* ---------------------------------------------------------------- uuendus */
  function blowFuse(kind) {
    const M = meterNow();
    S.ms.fuses[kind] = 'blown';
    if (isTrain()) S.errors++; else S.setupErrors++;
    S.held = null;
    S.log.unshift({ type: 'event', bad: true, text: 'Kaitse (' + M.fuseLabel[kind] + ') põles läbi: vool oli suurem, kui see pesa talub. Vaheta kaitse (nupp lava kohal), et edasi mõõta.' });
    Sound.pop();
    toast('Kaitse põles läbi! Voolupesa on peaaegu lühis: voolumõõtja ühendatakse ahelasse jadas, pinget mõõdetakse rööbiti.', true);
    renderLog();
  }
  function replaceFuse() {
    const M = meterNow();
    ['mA', 'A10'].forEach(function (k) { S.ms.fuses[k] = 'ok'; });
    S.log.unshift({ type: 'event', text: 'Kaitse vahetatud (' + M.name + ').' });
    S.held = null;
    renderLog(); refresh();
  }

  function idleDisp(M, m) {
    if (m.fn === 'OHM' || m.fn === 'CONT' || m.fn === 'DIODE') return { text: M.olText, unit: m.ranges[0].unit, ol: true };
    return Meters.display(M, m, S.ms, 0);
  }
  function lcdContent(M, m, res) {
    if (m.fn === 'OFF') return { blank: true };
    const ann = m.tag || '';
    const ann2 = M.auto ? (S.ms.range === null || S.ms.range === undefined ? 'AUTO' : 'MAN') : '';
    function fromDisp(d, flags) {
      if (flags && flags.some(function (f) { return f.code === 'lead_alert'; })) return { text: 'LEAd', unit: '', ann: ann, ann2: ann2 };
      return { text: d.text, unit: d.unit, ol: d.ol, olText: M.olText, ann: ann, ann2: ann2 };
    }
    if (!isTrain()) {
      if (S.held && S.held.meterId === S.meterId && S.held.disp) return fromDisp(S.held.disp, S.held.flags);
      return { text: '----', unit: '', ann: ann, ann2: ann2 };
    }
    if (res.state === 'ok' && res.disp) return fromDisp(res.disp, res.flags);
    return fromDisp(idleDisp(M, m), null);
  }

  function refresh() {
    if (!S || !ctl.svg) return;
    const M = meterNow();
    let res = Engine.measure(args());
    if (res.fuseBlown && S.ms.fuses[res.fuseBlown] !== 'blown') {
      blowFuse(res.fuseBlown);
      res = Engine.measure(args());
    }
    S.res = res;
    ctl.schem.refresh({ cond: S.cond, sol: res.live, model: res.model, probes: S.tips, armedTip: !!(S.armed && S.armed.end === 'tip') });
    const m = Meters.currentMode(M, S.ms);
    ctl.mctl.markActive(S.ms.dial);
    ctl.mctl.lcd.show(lcdContent(M, m, res));
    /* piiksumine järjepidevuse režiimis */
    if (isTrain() && res.beep && !lastBeep) Sound.beep();
    lastBeep = !!res.beep;
    /* mõõtmisnupp */
    let disabled = S.finished;
    if (!isTrain() && S.budgetLeft <= 0) disabled = true;
    ctl.mctl.measureBtn.classList.toggle('disabled', disabled);
    ctl.mctl.measureBtn.setAttribute('aria-disabled', String(disabled));
    ctl.mctl.measureText.textContent = isTrain() ? 'SALVESTA' : ('MÕÕDA' + (S.budgetLeft > 0 ? ' (' + S.budgetLeft + ')' : ''));
    const blown = Object.keys(S.ms.fuses).filter(function (k) { return S.ms.fuses[k] === 'blown'; });
    ctl.mctl.fuseTxt.textContent = blown.length ? 'KAITSE LÄBI: ' + blown.map(function (k) { return M.fuseLabel[k]; }).join(', ') : '';
    updateLeads();
    updateStageTop(blown.length > 0);
  }

  function updateStageTop(fuseBlown) {
    $('#btn-fuse').classList.toggle('hidden', !fuseBlown);
    document.querySelectorAll('.mtab').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.meter === S.meterId));
      b.disabled = S.level.meters.indexOf(b.dataset.meter) < 0;
    });
    let msg = 'Lohista juhtme otsi või klõpsa otsal ja seejärel pesal või mõõtepunktil.';
    if (S.armed) {
      const nm = LEAD[S.armed.lead].name + (S.armed.end === 'tip' ? ' sond' : ' pistik');
      msg = S.armed.end === 'tip' ? 'Valitud: ' + nm + '. Klõpsa mõõtepunktil (või tühjal alusel, et ots ära panna).' : 'Valitud: ' + nm + '. Klõpsa mõõtja pesal.';
    } else if (!isTrain() && S.res && S.res.state === 'ok') {
      msg = 'Kõik paigas? Vajuta mõõtjal MÕÕDA.';
    }
    $('#status').textContent = msg;
  }

  /* ---------------------------------------------------------------- juhtmete käsitlus */
  function setTargets(end) {
    ctl.svg.querySelectorAll('.tp').forEach(function (e) { e.classList.toggle('target', end === 'tip'); });
    ctl.svg.querySelectorAll('.jack').forEach(function (e) { e.classList.toggle('target', end === 'plug'); });
  }
  function disarm() { S.armed = null; setTargets(null); }
  function arm(lead, end) {
    if (S.armed && S.armed.lead === lead && S.armed.end === end) { disarm(); }
    else { S.armed = { lead: lead, end: end }; setTargets(end); }
    refresh();
  }
  function changed() { S.held = null; refresh(); }

  function placeTip(lead, pt) {
    S.tips[lead] = pt; Sound.tick(); disarm(); changed();
  }
  function placePlug(lead, jack) {
    const other = lead === 'red' ? 'black' : 'red';
    const prev = S.plugs[lead];
    if (S.plugs[other] === jack) S.plugs[other] = prev;   /* vahetus: teine pistik saab selle pesa, kust see tuli (või läheb alusele) */
    S.plugs[lead] = jack; Sound.tick(); disarm(); changed();
  }
  function toTray(lead, end) {
    if (end === 'tip') S.tips[lead] = null; else S.plugs[lead] = null;
    disarm(); changed();
  }

  function nearest(end, p) {
    let best = null, bd = end === 'tip' ? 38 : 48;
    if (end === 'tip') {
      Object.keys(S.circuit.points).forEach(function (id) {
        const q = pointWorld(id), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bd) { bd = d; best = id; }
      });
    } else {
      meterNow().jacks.forEach(function (j) {
        const q = jackWorld(j.id), d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bd) { bd = d; best = j.id; }
      });
    }
    return best;
  }
  function toSvg(ev) {
    const svg = ctl.svg, pt = svg.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function onHandleClick(hEl) {
    const lead = hEl.getAttribute('data-lead'), end = hEl.getAttribute('data-end');
    if (S.armed && S.armed.end === end && S.armed.lead !== lead) {
      /* teine sama liiki ots: pane valitud ots selle koha peale (vahetus) */
      const target = end === 'tip' ? S.tips[lead] : S.plugs[lead];
      if (target) {
        const a = S.armed;
        if (end === 'tip') { const prev = S.tips[a.lead]; S.tips[lead] = prev; placeTip(a.lead, target); }
        else placePlug(a.lead, target);
        return;
      }
    }
    arm(lead, end);
  }

  function onPointerDown(ev) {
    const hEl = ev.target.closest && ev.target.closest('.handle');
    if (hEl) {
      ev.preventDefault();
      const lead = hEl.getAttribute('data-lead'), end = hEl.getAttribute('data-end');
      const p0 = toSvg(ev), cur = leadPos(lead, end);
      S.drag = { lead: lead, end: end, el: hEl, sx: ev.clientX, sy: ev.clientY, moved: false, pid: ev.pointerId, pos: null, grab: { x: p0.x - cur.x, y: p0.y - cur.y } };
      return;
    }
    const knob = ev.target.closest && ev.target.closest('.knob');
    if (knob) {
      ev.preventDefault();
      const M = meterNow();
      S.dial = { cx: ctl.L.meter.x + M.dial.cx, cy: ctl.L.meter.y + M.dial.cy, pid: ev.pointerId, sx: ev.clientX, sy: ev.clientY, moved: false };
    }
  }
  function onPointerMove(ev) {
    const d = S && S.drag;
    if (d && ev.pointerId === d.pid) {
      if (!d.moved && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 6) {
        d.moved = true;
        try { ctl.svg.setPointerCapture(ev.pointerId); } catch (e) { /* pole oluline */ }
        ctl.gL.appendChild(d.el);
        disarm(); setTargets(d.end);
        d.el.classList.add('dragging');
      }
      if (d.moved) { const q = toSvg(ev); d.pos = { x: q.x - d.grab.x, y: q.y - d.grab.y }; updateLeads(); }
      return;
    }
    const kd = S && S.dial;
    if (kd && ev.pointerId === kd.pid) {
      if (!kd.moved && Math.hypot(ev.clientX - kd.sx, ev.clientY - kd.sy) > 5) kd.moved = true;
      if (kd.moved) {
        const p = toSvg(ev);
        let a = Math.atan2(p.x - kd.cx, -(p.y - kd.cy)) * 180 / Math.PI;
        if (a < 0) a += 360;
        const M = meterNow();
        let best = 0, bd = 999;
        M.positions.forEach(function (pos, i) {
          const diff = Math.abs(((pos.angle - a + 540) % 360) - 180);
          if (diff < bd) { bd = diff; best = i; }
        });
        if (best !== S.ms.dial) setDial(best);
      }
    }
  }
  function onPointerUp(ev) {
    const d = S && S.drag;
    if (d && ev.pointerId === d.pid) {
      S.drag = null;
      d.el.classList.remove('dragging');
      if (d.moved) {
        ignoreClickUntil = performance.now() + 120;
        const q = toSvg(ev);
        const target = nearest(d.end, { x: q.x - d.grab.x, y: q.y - d.grab.y });
        setTargets(null);
        if (target) { if (d.end === 'tip') placeTip(d.lead, target); else placePlug(d.lead, target); }
        else toTray(d.lead, d.end);
      }
      return;
    }
    const kd = S && S.dial;
    if (kd && ev.pointerId === kd.pid) { S.dial = null; if (kd.moved) ignoreClickUntil = performance.now() + 120; }
  }
  function onPointerCancel(ev) {
    if (S && S.drag && ev.pointerId === S.drag.pid) { S.drag.el.classList.remove('dragging'); S.drag = null; setTargets(null); updateLeads(); }
    if (S && S.dial && ev.pointerId === S.dial.pid) S.dial = null;
  }

  /* ---------------------------------------------------------------- mõõtja juhtimine */
  function setDial(i) {
    S.ms.dial = i; S.ms.range = null;
    ctl.mctl.setDial(i);
    Sound.tick();
    changed();
  }
  function pressButton(id) {
    const M = meterNow();
    if (id === 'select') {
      if (!Meters.cycleMode(M, S.ms)) toast('Selles asendis pole valikut: SELECT vahetab ainult nendes asendites, kus on mitu funktsiooni (nt V⎓ / V~ või Ω / piiks / diood).');
    } else if (id === 'range') {
      if (!Meters.stepRange(M, S.ms)) toast('Piirkonna käsitsi valik töötab V, A ja Ω asendis. Pärast viimast piirkonda tuleb uuesti AUTO.');
    }
    Sound.tick();
    changed();
  }

  function onClick(ev) {
    if (!S) return;
    const t = ev.target;
    if (!t.closest) return;
    if (performance.now() < ignoreClickUntil && (t === ctl.svg || t.closest('.handle'))) return;
    const hEl = t.closest('.handle');
    if (hEl) { onHandleClick(hEl); return; }
    const tp = t.closest('.tp');
    if (tp) {
      const pt = tp.getAttribute('data-pt');
      if (S.armed) {
        if (S.armed.end === 'tip') placeTip(S.armed.lead, pt);
        else toast('Pistik läheb mõõtja pessa. Sondi otsa pane mõõtepunktile.');
      } else if (S.tips.red === pt) arm('red', 'tip');
      else if (S.tips.black === pt) arm('black', 'tip');
      else toast('Vali enne juhtme ots (sond), siis klõpsa mõõtepunktil.');
      return;
    }
    const jk = t.closest('.jack');
    if (jk) {
      const id = jk.getAttribute('data-jack');
      if (S.armed) {
        if (S.armed.end === 'plug') placePlug(S.armed.lead, id);
        else toast('Sondi ots läheb mõõtepunktile. Pesadesse käivad pistikud.');
      } else if (S.plugs.red === id) arm('red', 'plug');
      else if (S.plugs.black === id) arm('black', 'plug');
      else toast('Vali enne juhtme pistik, siis klõpsa pesal.');
      return;
    }
    const dp = t.closest('.dpos');
    if (dp) { setDial(parseInt(dp.getAttribute('data-i'), 10)); return; }
    const mb = t.closest('.mbtn');
    if (mb) { pressButton(mb.getAttribute('data-btn')); return; }
    const me = t.closest('.measure-btn');
    if (me) { onMeasure(); return; }
    const tsw = t.closest('[data-toggle-sw]');
    if (tsw) {
      const id = tsw.getAttribute('data-toggle-sw');
      const el = S.circuit.elems.find(function (e) { return e.id === id; });
      const cur = (S.cond.switches[id] !== undefined) ? S.cond.switches[id] : (el.closed !== false);
      S.cond.switches[id] = !cur; Sound.tick(); changed(); return;
    }
    const tl = t.closest('[data-toggle-link]');
    if (tl) {
      const id = tl.getAttribute('data-toggle-link');
      const cur = (S.cond.links[id] !== undefined) ? S.cond.links[id] : true;
      S.cond.links[id] = !cur; Sound.tick(); changed(); return;
    }
    if (t.closest('.tray-bg') && S.armed) { toTray(S.armed.lead, S.armed.end); return; }
    if (S.armed) { disarm(); refresh(); }
  }
  function onKey(ev) {
    if (!S) return;
    const t = ev.target;
    if (!t.closest) return;
    if (ev.key === 'Enter' || ev.key === ' ') {
      const b = t.closest('.tp, .jack, .dpos, .mbtn, .measure-btn, .toggle-hit, .lab-pill, .handle');
      if (b && ctl.svg.contains(b)) { ev.preventDefault(); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      return;
    }
    if (t.closest('.knob') && (ev.key === 'ArrowRight' || ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      const n = meterNow().positions.length;
      const dir = (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? 1 : -1;
      setDial((S.ms.dial + dir + n) % n);
    }
  }

  /* ---------------------------------------------------------------- mõõtmine */
  function elName(id) { const e = S.circuit.elems.find(function (x) { return x.id === id; }); return e ? (e.name || e.id) : id; }
  function whatText(res, a) {
    const nums = ctl.schem.nums;
    const pts = 'punktide ' + nums[a.tips.red] + '–' + nums[a.tips.black] + ' vahel';
    const names = res.acrossElems.map(elName);
    const on = names.length ? names.join(' / ') + ' peal' : pts;
    if (res.fn === 'V') return 'Pinge ' + on;
    if (res.fn === 'OHM') return 'Takistus ' + on;
    if (res.fn === 'CONT') return 'Piiks ' + on;
    if (res.fn === 'DIODE') return 'Dioodirežiim ' + on;
    if (res.fn === 'A') {
      const at = S.circuit.elems.find(function (e) { return (e.type === 'link' || e.type === 'switch') && ((e.a === a.tips.red && e.b === a.tips.black) || (e.a === a.tips.black && e.b === a.tips.red)); });
      return 'Vool ' + (at ? at.name + ' kohal' : pts);
    }
    return pts;
  }
  function guardMeasure() {
    const res = S.res;
    if (S.finished) return false;
    if (res.state === 'off') { toast('Mõõtja on välja lülitatud. Pööra valikulülitit.'); return false; }
    if (res.state === 'blocked') {
      toast(res.block === 'plug' ? 'Pane mõlemad pistikud mõõtja pesadesse.' : 'Aseta mõlemad sondid mõõtepunktidele.');
      return false;
    }
    return true;
  }
  function onMeasure() {
    if (!S || S.finished) return;
    if (isTrain()) { saveReading(); return; }
    if (S.budgetLeft <= 0) { toast('Mõõtmised said otsa. Tee diagnoos.'); return; }
    if (!guardMeasure()) return;
    openPrediction();
  }

  function saveReading() {
    if (!guardMeasure()) return;
    const a = args(), res = S.res;
    S.nrec++;
    const rec = Rules.makeRecord(S.nrec, a, res, { what: whatText(res, a), doneTexts: [], notes: [] });
    if (res.quality === 'bad') { S.errors++; Sound.bad(); } else Sound.ok();
    S.level.tasks.forEach(function (t) {
      if (S.taskDone[t.id] || !t.spec) return;
      const m = Rules.matchSpec(t.spec, rec, S.circuit);
      if (m.ok) { S.taskDone[t.id] = true; rec.doneTexts.push(t.text); }
      else if (m.note) rec.notes.push(m.note);
    });
    S.records.push(rec);
    S.log.unshift({ type: 'rec', rec: rec });
    renderLog(); updateTaskMarks(); refresh();
    checkTrainDone();
  }
  function checkAnswerTask(t) {
    if (S.taskDone[t.id]) return;
    const inp = $('#ans-' + t.id), fb = $('#fb-' + t.id);
    const r = Rules.checkAnswer(t.answer, inp.value, S.ctx);
    if (r.ok) {
      S.taskDone[t.id] = true; fb.textContent = ''; Sound.ok();
      updateTaskMarks(); checkTrainDone();
    } else {
      fb.textContent = r.bad || 'Ei klapi. Vaata mõõdetud väärtused ja arvutus uuesti üle.';
      fb.style.color = 'var(--warn)';
      if (!r.bad) S.errors++;
      Sound.bad();
    }
  }
  function checkTrainDone() {
    if (S.quizDone || S.finished) return;
    const all = S.level.tasks.every(function (t) { return S.taskDone[t.id]; });
    if (all) setTimeout(openQuiz, 450);
  }

  /* ---------------------------------------------------------------- ennustus (rikkeotsing) */
  function defaultUnit(fn, M) {
    if (fn === 'V') return 'V';
    if (fn === 'A') return S.plugs.red && S.plugs.red === (M.jacks.find(function (j) { return j.kinds.indexOf('A10') >= 0; }) || {}).id ? 'A' : 'mA';
    if (fn === 'OHM') return 'kΩ';
    if (fn === 'CONT') return 'Ω';
    return 'V';
  }
  function openPrediction() {
    const M = meterNow(), m = Meters.currentMode(M, S.ms), res = S.res, a = args();
    const dlg = $('#dlg-pred');
    const nums = ctl.schem.nums;
    const units = Rules.UNITS_FOR[m.fn] || ['V'];
    const def = defaultUnit(m.fn, M);
    const canOL = (m.fn === 'OHM' || m.fn === 'DIODE' || m.fn === 'CONT');
    const fnName = { V: 'pinge', A: 'vool', OHM: 'takistus', DIODE: 'dioodi päripinge', CONT: 'järjepidevus' }[m.fn] || m.fn;
    dlg.innerHTML = '';
    dlg.classList.add('pred');
    dlg.appendChild(h('h2', { text: 'Enne mõõtmist' }));
    dlg.appendChild(h('p', { html: 'Mida näitaks mõõtja <b>terves</b> vooluringis, kui mõõdad täpselt nii? Kirjuta oma ennustus.' }));
    const dl = h('dl', { class: 'grid' }, [
      h('dt', { text: 'Mõõtja' }), h('dd', { text: M.name + ' · ' + (m.tag || '') }),
      h('dt', { text: 'Sondid' }), h('dd', { text: 'punane punktis ' + nums[a.tips.red] + ', must punktis ' + nums[a.tips.black] }),
      h('dt', { text: 'Mõõdad' }), h('dd', { text: whatText(res, a) })
    ]);
    dlg.appendChild(dl);
    const inp = h('input', { type: 'text', id: 'pred-num', inputmode: 'decimal', autocomplete: 'off', 'aria-label': 'Ennustatud väärtus' });
    const sel = h('select', { id: 'pred-unit', 'aria-label': 'Ühik' }, units.map(function (u) { return h('option', { value: u, text: u, selected: u === def }); }));
    const inputs = h('div', { class: 'inputs' }, [inp, sel]);
    let olBox = null;
    if (canOL) {
      olBox = h('input', { type: 'checkbox', id: 'pred-ol' });
      inputs.appendChild(h('label', { class: 'chk' }, [olBox, document.createTextNode(' OL (lõpmatu)')]));
      olBox.addEventListener('change', function () { inp.disabled = olBox.checked; sel.disabled = olBox.checked; });
    }
    dlg.appendChild(inputs);
    const err = h('div', { class: 'small', style: 'color:var(--warn);min-height:20px' });
    dlg.appendChild(err);
    dlg.appendChild(h('p', { class: 'small', text: 'Pärast seda jääb ' + (S.budgetLeft - 1) + ' mõõtmist. Valesti seadistatud mõõtmine kulub samuti ära.' }));
    const go = function () {
      const pred = { num: Rules.parseNum(inp.value), unit: sel.value, ol: !!(olBox && olBox.checked) };
      if (!pred.ol && !isFinite(pred.num)) { err.textContent = 'Kirjuta ennustus arvuna (nt 7,2) või märgi OL.'; inp.focus(); return; }
      dlg.close();
      commitMeasurement(pred);
    };
    dlg.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn', text: 'Mõõda', onclick: go }),
      h('button', { class: 'btn ghost', text: 'Tühista', onclick: function () { dlg.close(); } })
    ]));
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    dlg.showModal();
    inp.focus();
  }

  function commitMeasurement(pred) {
    const a = args();
    const res = Engine.measure(a);
    const expected = Engine.healthy(a);
    S.budgetLeft--; S.nrec++;
    let pj = { ok: null, expectedText: null };
    if (res.quality === 'good') pj = Rules.judgePrediction(pred, expected);
    if (pj.ok !== null) { S.predTotal++; if (pj.ok) S.predRight++; }
    const predText = pred.ol ? 'OL' : (Rules.comma(pred.num) + ' ' + pred.unit);
    const rec = Rules.makeRecord(S.nrec, a, res, { what: whatText(res, a), pred: { text: predText, ok: pj.ok, expectedText: pj.expectedText } });
    if (res.quality === 'bad') { S.setupErrors++; Sound.bad(); } else Sound.ok();
    S.records.push(rec);
    S.log.unshift({ type: 'rec', rec: rec });
    S.held = rec;
    renderLog(); updateStats(); refresh();
    if (S.budgetLeft <= 0) toast('Mõõtmised said otsa. Tee diagnoos.');
  }

  /* ---------------------------------------------------------------- vihjed */
  function giveHint() {
    if (!S || S.finished) return;
    const L = S.level, box = $('#hintbox');
    if (S.hintIdx < L.hints.length) {
      box.appendChild(h('p', { text: 'Vihje ' + (S.hintIdx + 1) + ': ' + L.hints[S.hintIdx], style: 'border-left:3px solid var(--gold);padding-left:10px;color:var(--ink)' }));
      S.hintIdx++; S.hints++;
    } else if (!isTrain()) {
      S.elimUsed = true; S.hints++;
      updateElimination();
      const left = S.elim.map(function (g) { return Object.keys(g).length; });
      const txt = S.level.groups
        ? 'Sinu mõõtmiste põhjal on LED-haru jaoks veel ' + left[0] + ' ja anduri haru jaoks ' + left[1] + ' varianti võimalik. Mittesobivad on diagnoosi aknas maha tõmmatud.'
        : 'Sinu mõõtmiste põhjal on veel ' + left[0] + ' varianti võimalik (alguses ' + S.level.faults.length + '). Mittesobivad on diagnoosi aknas maha tõmmatud.';
      box.appendChild(h('p', { text: txt, style: 'border-left:3px solid var(--gold);padding-left:10px;color:var(--ink)' }));
    } else {
      toast('Rohkem vihjeid pole. Proovi mõõta ja võrrelda.');
      return;
    }
    if (!isTrain()) updateStats();
  }
  function updateElimination() {
    S.elim = Rules.possible(S.level, S.circuit, S.records);
  }

  /* ---------------------------------------------------------------- diagnoos */
  function openDiagnosis() {
    if (!S || S.finished) return;
    const dlg = $('#dlg-diag');
    const groups = Rules.groupsOf(S.level);
    if (S.elimUsed) updateElimination();
    dlg.innerHTML = '';
    dlg.appendChild(h('h2', { text: 'Diagnoos' }));
    dlg.appendChild(h('p', { text: groups.length > 1 ? 'Vali kummastki harust, mis on katki. Sul on ' + S.attempts + (S.attempts === 1 ? ' katse.' : ' katset.') : 'Mis on katki? Sul on ' + S.attempts + (S.attempts === 1 ? ' katse.' : ' katset.') }));
    const picks = [];
    groups.forEach(function (g, gi) {
      const fs = h('fieldset', { style: 'border:none;padding:0;margin:8px 0 0' });
      if (g.label) fs.appendChild(h('legend', { text: g.label, style: 'font-family:var(--font-head);font-size:19px;font-weight:700;padding:0;margin-bottom:4px' }));
      g.faults.forEach(function (f) {
        const struck = (S.struck[f.id]) || (S.elimUsed && S.elim && !S.elim[gi][f.id]);
        const inp = h('input', { type: 'radio', name: 'diag' + gi, value: f.id, disabled: !!S.struck[f.id] });
        inp.addEventListener('change', function () { picks[gi] = f.id; });
        fs.appendChild(h('label', { class: 'opt' + (struck ? ' struck' : '') }, [inp, document.createTextNode(f.label)]));
      });
      dlg.appendChild(fs);
    });
    const msg = h('div', { class: 'small', style: 'min-height:22px;color:var(--warn);margin-top:6px' });
    dlg.appendChild(msg);
    dlg.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'btn', text: 'Kinnita diagnoos', onclick: function () {
        if (groups.some(function (g, gi) { return !picks[gi]; })) { msg.textContent = 'Vali igast loendist üks variant.'; return; }
        const right = groups.map(function (g, gi) { return picks[gi] === S.fault.picks[gi].id; });
        if (right.every(Boolean)) { dlg.close(); finishFault(true); return; }
        S.attempts--; S.wrongTries++;
        Sound.bad();
        if (S.attempts <= 0) { dlg.close(); finishFault(false); return; }
        if (groups.length === 1) S.struck[picks[0]] = true;
        updateStats();
        dlg.close();
        toast(groups.length > 1 ? 'Vähemalt üks vastus on vale. Üks katse on veel.' : 'See ei ole õige. Üks katse on veel.', true);
      } }),
      h('button', { class: 'btn ghost', text: 'Tagasi mõõtma', onclick: function () { dlg.close(); } })
    ]));
    dlg.showModal();
  }

  /* ---------------------------------------------------------------- tulemus */
  function bestStars(n) {
    const id = S.level.id;
    if ((prog.stars[id] || 0) < n) { prog.stars[id] = n; saveProg(); }
  }
  function finishFault(solved) {
    S.finished = true;
    const used = S.level.budget - S.budgetLeft;
    const stars = Rules.starsFault({ solved: solved, firstTry: S.wrongTries === 0, measurements: used, par: S.level.par, setupErrors: S.setupErrors, predRight: S.predRight, predTotal: S.predTotal, hints: S.hints, minMeas: S.level.groups ? 3 : 2 });
    bestStars(stars);
    refresh(); updateStats();
    const dlg = $('#dlg-result');
    dlg.innerHTML = ''; dlg.classList.add('result');
    dlg.appendChild(h('h2', { text: solved ? 'Rike leitud' : 'Rike jäi leidmata' }));
    dlg.appendChild(h('div', { class: 'bigstars', text: starsHtml(stars), 'aria-label': stars + ' tärni kolmest' }));
    dlg.appendChild(h('h3', { text: solved ? 'Mis oli katki' : 'Õige vastus' }));
    S.fault.picks.forEach(function (p) {
      dlg.appendChild(h('p', null, [h('b', { text: p.label + '. ' }), document.createTextNode(p.explain)]));
    });
    const tbl = h('table');
    [
      ['Mõõtmisi', used + ' (sihtmärk ' + S.level.par + ', eelarve ' + S.level.budget + ')'],
      ['Seadistusvigu', String(S.setupErrors)],
      ['Õigeid ennustusi', S.predTotal ? S.predRight + ' / ' + S.predTotal : '–'],
      ['Vihjeid', String(S.hints)],
      ['Vigaseid diagnoosikatseid', String(S.wrongTries)]
    ].forEach(function (r) { tbl.appendChild(h('tr', null, [h('td', { text: r[0] }), h('td', { text: r[1] })])); });
    dlg.appendChild(tbl);
    if (stars < 3 && solved) dlg.appendChild(h('p', { class: 'small', text: 'Kolm tärni: õige diagnoos esimesel katsel, vähemalt ' + (S.level.groups ? 3 : 2) + ' mõõtmist (arvamine ei loe), sihtmärgi piires, kuni üks seadistusviga, pool ennustustest õiged ja ilma vihjeteta.' }));
    addEndButtons(dlg);
    dlg.showModal();
  }
  function addEndButtons(dlg) {
    const idx = Levels.list.indexOf(S.level);
    const next = Levels.list[idx + 1];
    const row = h('div', { class: 'row' });
    if (next) row.appendChild(h('button', { class: 'btn', text: 'Järgmine: ' + next.id, onclick: function () { dlg.close(); startLevel(next.id); } }));
    row.appendChild(h('button', { class: 'btn ghost', text: S.level.kind === 'fault' ? 'Uus rike' : 'Uuesti', onclick: function () { dlg.close(); startLevel(S.level.id); } }));
    row.appendChild(h('button', { class: 'btn ghost', text: 'Ülesanded', onclick: function () { dlg.close(); goMenu(); } }));
    dlg.appendChild(row);
    const end = $('#endbox');
    if (end) {
      end.innerHTML = '';
      end.appendChild(h('h3', { text: 'Tase on lõppenud' }));
      end.appendChild(h('div', { class: 'row' }, [
        next ? h('button', { class: 'btn', text: 'Järgmine: ' + next.id, onclick: function () { startLevel(next.id); } }) : null,
        h('button', { class: 'btn ghost', text: S.level.kind === 'fault' ? 'Uus rike' : 'Uuesti', onclick: function () { startLevel(S.level.id); } })
      ]));
    }
  }

  function openQuiz() {
    if (!S || S.quizDone) return;
    const q = S.level.quiz, dlg = $('#dlg-quiz');
    dlg.innerHTML = '';
    dlg.appendChild(h('h2', { text: 'Lõpuküsimus' }));
    dlg.appendChild(h('p', { text: q.q }));
    const radios = [];
    q.options.forEach(function (o, i) {
      const r = h('input', { type: 'radio', name: 'quiz', value: String(i) });
      radios.push(r);
      dlg.appendChild(h('label', { class: 'opt' }, [r, document.createTextNode(o)]));
    });
    const fb = h('div', { style: 'min-height:24px;margin:6px 0' });
    dlg.appendChild(fb);
    const row = h('div', { class: 'row' });
    const go = h('button', { class: 'btn', text: 'Vasta' });
    let answered = false;
    go.addEventListener('click', function () {
      if (answered) { dlg.close(); finishTrain(); return; }
      const sel = radios.find(function (r) { return r.checked; });
      if (!sel) { fb.textContent = 'Vali üks vastus.'; fb.style.color = 'var(--warn)'; return; }
      if (parseInt(sel.value, 10) === q.correct) {
        answered = true; S.quizDone = true; Sound.ok();
        fb.style.color = 'var(--ok)'; fb.textContent = 'Õige. ' + q.explain;
        radios.forEach(function (r) { r.disabled = true; });
        go.textContent = 'Edasi';
      } else {
        S.errors++; Sound.bad();
        fb.style.color = 'var(--warn)'; fb.textContent = 'See ei ole õige. Mõtle veel ja proovi uuesti.';
      }
    });
    row.appendChild(go);
    dlg.appendChild(row);
    dlg.showModal();
  }
  function finishTrain() {
    S.finished = true;
    const stars = Rules.starsTrain(S.errors);
    bestStars(stars);
    refresh();
    const dlg = $('#dlg-result');
    dlg.innerHTML = ''; dlg.classList.add('result');
    dlg.appendChild(h('h2', { text: 'Ülesanne tehtud' }));
    dlg.appendChild(h('div', { class: 'bigstars', text: starsHtml(stars), 'aria-label': stars + ' tärni kolmest' }));
    const tbl = h('table');
    [['Salvestatud mõõtmisi', String(S.records.length)], ['Vigu', String(S.errors)]].forEach(function (r) { tbl.appendChild(h('tr', null, [h('td', { text: r[0] }), h('td', { text: r[1] })])); });
    dlg.appendChild(tbl);
    dlg.appendChild(h('p', { class: 'small', text: 'Viga on vale vastus, vale seadistusega salvestatud näit või läbipõlenud kaitse. Kuni kaks viga annab kolm tärni.' }));
    addEndButtons(dlg);
    dlg.showModal();
  }

  /* ---------------------------------------------------------------- mõõtja info */
  const METER_NOTES = {
    m1: [
      'Piirkond tuleb valikulülitiga ise valida. Kui näit on valitud piirkonnast suurem, on ekraani vasakus servas ainult 1 (ületäitumine).',
      'Pingeks, takistuseks ja väikesteks vooludeks kasutatakse sama punast pesa (VΩmA). 10A-pesa on ainult suurte voolude jaoks.',
      'Funktsiooni (V⎓, V~, Ω, →|, A⎓) valid ainult valikulülitiga. Nuppe pole.'
    ],
    m2: [
      'Piirkond valitakse ise (AUTO), sul tuleb valida ainult funktsioon.',
      'Valikulüliti ühes asendis on mitu funktsiooni: nupp SELECT vahetab V⎓ ja V~ või Ω, piiks ja diood.',
      'Voolul on kaks eraldi pesa: mA µA (väikesed voolud) ja 10A (suured voolud). Mõlemal on oma kaitse.'
    ],
    m3: [
      'Pesad on teises järjekorras kui teistel mõõtjatel: loe sildid, ära tugine harjumusele.',
      'Piirkond on AUTO, aga nupp RANGE lubab selle käsitsi valida. Iga vajutus läheb ühe piirkonna võrra edasi ja pärast viimast tuleb uuesti AUTO.',
      'Kui juhe on valitud funktsiooni jaoks vales pesas, näitab ekraan LEAd. SELECT vahetab asendis olevat funktsiooni.'
    ]
  };
  function jackRole(M, j) {
    const k = j.kinds;
    if (k.indexOf('COM') >= 0) return 'ühine pesa, siia käib alati must juhe';
    if (k.indexOf('V') >= 0 && k.indexOf('mA') >= 0) return 'pinge, takistus ja voolud kuni ' + M.fuseLabel.mA + ' (kaitse ' + M.fuseLabel.mA + ')';
    if (k.indexOf('V') >= 0) return 'pinge ja takistus';
    if (k.indexOf('mA') >= 0) return 'väikesed voolud (kaitse ' + M.fuseLabel.mA + ')';
    return 'suured voolud (kaitse ' + M.fuseLabel.A10 + ')';
  }
  function openMeterInfo(id) {
    const M = Meters.get(id), dlg = $('#dlg-meter');
    dlg.innerHTML = '';
    dlg.appendChild(h('h2', { text: M.name + ' · ' + M.kind.toLowerCase() }));
    dlg.appendChild(h('h3', { text: 'Pesad vasakult paremale' }));
    const ul = h('ul', { class: 'plain' });
    M.jacks.forEach(function (j) { ul.appendChild(h('li', null, [h('b', { text: j.label + (j.sub ? ' (' + j.sub + ')' : '') }), document.createTextNode(' – ' + jackRole(M, j))])); });
    dlg.appendChild(ul);
    dlg.appendChild(h('h3', { text: 'Mille poolest see erineb' }));
    const ul2 = h('ul', { class: 'plain' });
    METER_NOTES[id].forEach(function (t) { ul2.appendChild(h('li', { text: t })); });
    dlg.appendChild(ul2);
    dlg.appendChild(h('div', { class: 'row' }, [h('button', { class: 'btn', text: 'Selge', onclick: function () { dlg.close(); } })]));
    dlg.showModal();
  }

  /* ---------------------------------------------------------------- käivitus */
  function init() {
    const svg = $('#stage');
    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerCancel);
    svg.addEventListener('click', onClick);
    svg.addEventListener('keydown', onKey);
    $('#btn-home').addEventListener('click', goMenu);
    $('#btn-fuse').addEventListener('click', replaceFuse);
    $('#btn-clear').addEventListener('click', function () { if (!S) return; S.tips = { red: null, black: null }; S.plugs = { red: null, black: null }; disarm(); changed(); });
    $('#btn-info').addEventListener('click', function () { if (S) openMeterInfo(S.meterId); });
    const sb = $('#btn-sound');
    function paintSound() { sb.setAttribute('aria-pressed', String(!!prog.sound)); sb.textContent = prog.sound ? 'Heli: sees' : 'Heli: väljas'; }
    sb.addEventListener('click', function () { prog.sound = !prog.sound; saveProg(); paintSound(); Sound.ok(); });
    paintSound();
    document.querySelectorAll('.mtab').forEach(function (b) { b.addEventListener('click', function () { switchMeter(b.dataset.meter); }); });
    const relayout = function () { if (S && ctl.svg) { const was = ctl.L && ctl.L.narrow; if (was !== MQ.matches) { buildStage(); refresh(); } } };
    if (MQ.addEventListener) MQ.addEventListener('change', relayout); else if (MQ.addListener) MQ.addListener(relayout);
    document.querySelectorAll('dialog').forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d && d.id !== 'dlg-result' && d.id !== 'dlg-quiz') d.close(); });
    });
    showView('menu');
  }

  window.__game = { state: function () { return S; }, ctl: function () { return ctl; }, start: startLevel, prog: prog };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
