/* Mõõtepink – mänguloogika ilma liideseta: ülesannete kontroll, ennustuse hindamine, variantide kõrvaldamine, tähed.
   Eraldi fail, et seda saaks Node'is testida. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./meters.js'), require('./engine.js'), require('./levels.js'));
  else root.Rules = factory(root.Meters, root.Engine, root.Levels);
})(typeof self !== 'undefined' ? self : this, function (Meters, Engine, Levels) {
  'use strict';

  /* ---------- väikesed abid ---------- */
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function comma(s) { return String(s).replace('.', ','); }
  function parseNum(str) {
    if (typeof str === 'number') return str;
    const s = String(str || '').trim().replace(/\s+/g, '').replace(',', '.').replace('−', '-');
    if (s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
    return parseFloat(s);
  }
  const UNIT_FACTOR = { 'V': 1, 'mV': 1e-3, 'A': 1, 'mA': 1e-3, 'µA': 1e-6, 'Ω': 1, 'kΩ': 1e3, 'MΩ': 1e6 };
  const UNITS_FOR = {
    V: ['V', 'mV'], A: ['A', 'mA', 'µA'], OHM: ['Ω', 'kΩ', 'MΩ'], DIODE: ['V'], CONT: ['Ω']
  };

  /* näidu tekst, nagu see ekraanil paistab */
  function fmtDisp(M, disp) {
    if (!disp) return '';
    if (disp.ol) return 'OL';
    return comma(String(disp.text).trim()) + ' ' + disp.unit;
  }
  /* ilma ühikuta arv inimese jaoks, nt "7,2 V" (SI väärtusest) */
  function fmtSI(v, fn) {
    const a = Math.abs(v);
    let x, u;
    if (fn === 'OHM' || fn === 'CONT') {
      if (a >= 1e6) { x = v / 1e6; u = 'MΩ'; } else if (a >= 1e3) { x = v / 1e3; u = 'kΩ'; } else { x = v; u = 'Ω'; }
    } else if (fn === 'A') {
      if (a >= 1) { x = v; u = 'A'; } else if (a >= 1e-3) { x = v * 1e3; u = 'mA'; } else { x = v * 1e6; u = 'µA'; }
    } else {
      if (a >= 1 || a === 0) { x = v; u = 'V'; } else { x = v * 1e3; u = 'mV'; }
    }
    const r = Math.abs(x) >= 100 ? Math.round(x) : Math.abs(x) >= 10 ? Math.round(x * 10) / 10 : Math.round(x * 100) / 100;
    return comma(r) + ' ' + u;
  }

  /* ---------- tulemuse kirje (salvestatud mõõtmine) ---------- */
  function makeRecord(n, a, res, extra) {
    const M = Meters.get(a.meterId);
    const rec = {
      n: n, meterId: a.meterId, fn: res.fn, tag: res.tag, ac: !!res.modeAc,
      tips: { red: a.tips.red, black: a.tips.black }, plugs: { red: a.plugs.red, black: a.plugs.black },
      ms: clone(a.ms), cond: { links: clone(a.cond.links || {}), switches: clone(a.cond.switches || {}) },
      disp: res.disp ? { text: res.disp.text, unit: res.disp.unit, ol: !!res.disp.ol, neg: !!res.disp.neg, fs: res.disp.fs } : null,
      value: res.value, trueValue: res.trueValue,
      flags: res.flags.map(function (f) { return { code: f.code, severity: f.severity, text: f.text }; }),
      quality: res.quality, fuseBlown: res.fuseBlown,
      acrossElems: res.acrossElems.slice(), seriesElems: res.seriesElems.slice(),
      ptAct: res.ptAct, ptCom: res.ptCom
    };
    rec.reading = fmtDisp(M, rec.disp);
    return Object.assign(rec, extra || {});
  }

  /* ---------- treeningülesande kontroll ---------- */
  function elemOf(circuit, id) { return circuit.elems.find(function (e) { return e.id === id; }); }

  function matchSpec(spec, rec, circuit) {
    const no = { ok: false, note: null };
    if (!spec) return no;
    if (rec.quality !== 'good') return no;
    const kind = spec.kind;
    if (kind === 'V') {
      if (rec.fn !== 'V' || rec.ac !== !!spec.ac) return no;
      if (rec.acrossElems.indexOf(spec.across) < 0) return no;
      if (spec.positive && !(rec.value > 0)) return { ok: false, note: 'Õige koht, aga näit on negatiivne: punane sond peab olema suurema potentsiaaliga (+) poolel. Vaheta sondid ja salvesta uuesti.' };
      return { ok: true, note: null };
    }
    if (kind === 'R') {
      if (rec.fn !== 'OHM' || rec.acrossElems.indexOf(spec.across) < 0) return no;
      if (rec.disp && rec.disp.ol) return no;
      return { ok: true, note: null };
    }
    if (kind === 'DIODE') {
      if (rec.fn !== 'DIODE' || rec.acrossElems.indexOf(spec.across) < 0) return no;
      if (spec.nonOL && rec.disp && rec.disp.ol) return { ok: false, note: 'Dioodirežiimis on OL: LED ei juhi selles suunas. Vaheta sondid: punane sond peab olema anoodil.' };
      return { ok: true, note: null };
    }
    if (kind === 'I') {
      if (rec.fn !== 'A') return no;
      if (spec.through && rec.seriesElems.indexOf(spec.through) < 0) return no;
      if (spec.at) {
        const at = elemOf(circuit, spec.at);
        if (!at) return no;
        const opened = (rec.cond.links && rec.cond.links[spec.at] === false) || (rec.cond.switches && rec.cond.switches[spec.at] === false);
        const tipsOK = (rec.tips.red === at.a && rec.tips.black === at.b) || (rec.tips.red === at.b && rec.tips.black === at.a);
        if (!opened || !tipsOK) return no;
      }
      if (spec.positive && !(rec.value > 0)) return { ok: false, note: 'Õige koht, aga näit on negatiivne: punane sond peab olema poolel, kust vool tuleb (aku + poolelt). Vaheta sondid ja salvesta uuesti.' };
      return { ok: true, note: null };
    }
    return no;
  }

  /* arvuline vastus: ctx = {params, vAcross(id), iThrough(id)} */
  function checkAnswer(ans, input, ctx) {
    const x = parseNum(input);
    if (!isFinite(x)) return { ok: false, bad: 'Sisesta arv (komaga või punktiga).' };
    const expect = ans.expect(ctx);
    let tol = ans.abs !== undefined ? ans.abs : Math.abs(expect) * (ans.rel || 0.05);
    return { ok: Math.abs(x - expect) <= tol, expect: expect };
  }

  function trainContext(circuit) {
    const model = Engine.buildModel(circuit, {});
    const sol = Engine.solve(model, {});
    return {
      vAcross: function (id) { const e = model.byId[id]; return Math.abs(sol.V[model.netOf[e.a]] - sol.V[model.netOf[e.b]]); },
      iThrough: function (id) { return Math.abs(sol.I[id] || 0); }
    };
  }

  /* ---------- ennustuse hindamine ---------- */
  /* pred = {num, unit, ol}; expected = Engine.healthy(...) tulemus */
  function judgePrediction(pred, expected) {
    if (!expected || expected.state !== 'ok' || expected.quality !== 'good' || !expected.disp) return { ok: null, expectedText: null };
    const M = Meters.get(expected.meterId);
    const expText = fmtDisp(M, expected.disp);
    const fn = expected.fn;
    const eOL = !!expected.disp.ol || (fn === 'OHM' && expected.trueValue > 1e9);
    if (pred.ol) return { ok: eOL, expectedText: expText };
    if (eOL) return { ok: false, expectedText: expText };
    if (!isFinite(pred.num)) return { ok: null, expectedText: expText };
    const p = Math.abs(pred.num * (UNIT_FACTOR[pred.unit] || 1));
    const a = Math.abs(expected.trueValue);
    let tol;
    if (fn === 'V') tol = Math.max(0.12, 0.12 * a);
    else if (fn === 'A') tol = Math.max(0.15 * a, 0.1e-3);
    else if (fn === 'DIODE') tol = 0.25;
    else tol = Math.max(0.12 * a, 3);
    return { ok: Math.abs(p - a) <= tol, expectedText: expText };
  }

  /* ---------- kandidaadid ja variantide kõrvaldamine ---------- */
  function groupsOf(level) {
    if (level.groups) return level.groups.map(function (g) { return { id: g.id, label: g.label, faults: g.faults }; });
    return [{ id: 'main', label: '', faults: level.faults }];
  }

  function replayText(circuit, rec, mods) {
    const r = Engine.measure({
      circuit: circuit, cond: { links: rec.cond.links, switches: rec.cond.switches, fault: mods && mods.length ? { mods: mods } : null },
      meterId: rec.meterId, ms: clone(rec.ms), plugs: rec.plugs, tips: rec.tips
    });
    if (r.fuseBlown && !rec.fuseBlown) return '#fuse';
    return r.disp ? r.disp.text + '|' + r.disp.unit : '#none';
  }

  /* tagastab {gi: {faultId: true}} – variandid, mis ei räägi ühegi mõõtmisega vastu */
  function possible(level, circuit, records) {
    const groups = groupsOf(level);
    const good = records.filter(function (r) { return r.quality === 'good' && !r.fuseBlown; });
    const combos = [[]];
    groups.forEach(function (g, gi) {
      const len = combos.length;
      for (let c = 0; c < len; c++) {
        const base = combos.shift();
        g.faults.forEach(function (f) { combos.push(base.concat([{ gi: gi, f: f }])); });
      }
    });
    const out = groups.map(function () { return {}; });
    combos.forEach(function (combo) {
      const mods = combo.reduce(function (acc, p) { return acc.concat(p.f.mods); }, []);
      const consistent = good.every(function (rec) {
        return replayText(circuit, rec, mods) === (rec.disp ? rec.disp.text + '|' + rec.disp.unit : '#none');
      });
      if (consistent) combo.forEach(function (p) { out[p.gi][p.f.id] = true; });
    });
    return out;
  }

  /* ---------- tähed ---------- */
  function starsTrain(errors) { return errors <= 2 ? 3 : errors <= 5 ? 2 : 1; }
  function starsFault(o) {
    /* o: {solved, firstTry, measurements, par, setupErrors, predRight, predTotal, hints} */
    if (!o.solved) return 0;
    let s = 1;
    if (o.firstTry) s = 2;
    const predOK = o.predTotal === 0 ? true : (o.predRight / o.predTotal) >= 0.5;
    if (o.firstTry && o.measurements <= o.par && o.setupErrors <= 1 && predOK && o.hints === 0) s = 3;
    if (o.hints > 0) s = Math.min(s, 2);
    /* arvamine ilma mõõtmata ei anna rohkem kui ühe tärni */
    if (o.minMeas !== undefined && o.measurements < o.minMeas) s = 1;
    return s;
  }

  return {
    clone: clone, comma: comma, parseNum: parseNum, UNIT_FACTOR: UNIT_FACTOR, UNITS_FOR: UNITS_FOR,
    fmtDisp: fmtDisp, fmtSI: fmtSI, makeRecord: makeRecord, matchSpec: matchSpec, checkAnswer: checkAnswer,
    trainContext: trainContext, judgePrediction: judgePrediction, groupsOf: groupsOf, possible: possible,
    starsTrain: starsTrain, starsFault: starsFault
  };
});
