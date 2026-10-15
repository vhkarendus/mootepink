/* Tasemete kontroll: node tests/levels.test.js
   - iga rike annab nähtava sümptomi
   - iga kaks rikkest on mõne mõõtmisega eristatavad
   - ahne otsingupuu: mitu mõõtmist kulub halvimal juhul (võrdle par ja eelarvega) */
const Meters = require('../js/meters.js');
const Engine = require('../js/engine.js');
const Circuits = require('../js/circuits.js');
const Levels = require('../js/levels.js');

let problems = 0;
function bad(msg) { problems++; console.log('  PROBLEEM ' + msg); }

function m2state(posId) {
  const M = Meters.get('m2');
  const ms = Meters.newState(M);
  ms.dial = M.positions.findIndex(function (p) { return p.id === posId; });
  return ms;
}
function meas(circuit, cond, posId, red, tipA, tipB) {
  const r = Engine.measure({ circuit: circuit, cond: cond, meterId: 'm2', ms: m2state(posId), plugs: { red: red, black: 'COM' }, tips: { red: tipA, black: tipB } });
  if (r.fuseBlown || r.state !== 'ok') return null;
  return r;
}

function closeEnough(kind, a, b) {
  const m = Math.max(Math.abs(a), Math.abs(b));
  if (kind === 'V') return Math.abs(a - b) <= Math.max(0.15, 0.08 * m);
  if (kind === 'I') return Math.abs(a - b) <= Math.max(0.1e-3, 0.05 * m);
  if (kind === 'D') { if (a > 100 && b > 100) return true; return Math.abs(a - b) <= 0.1; }
  if (a > 1e8 && b > 1e8) return true;
  return Math.abs(a - b) <= Math.max(2, 0.08 * m);
}

function enumerate(circuit, level) {
  const pts = Object.keys(circuit.points);
  const list = [];
  const adj = {};
  circuit.elems.forEach(function (e) { adj[e.a + '|' + e.b] = adj[e.b + '|' + e.a] = true; });
  const RESTRICT = !!process.env.RESTRICT;
  const okPair = function (a, b) { return !RESTRICT || adj[a + '|' + b]; };
  const bigI = (level.id === 'F5');
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    if (!okPair(pts[i], pts[j])) continue;
    (function (a, b) {
      list.push({ name: 'V ' + a + '–' + b, kind: 'V', run: function (fault) {
        const r = meas(circuit, { fault: fault }, 'v', 'VO', a, b); return r ? r.trueValue : null; } });
      list.push({ name: 'R ' + a + '–' + b, kind: 'R', run: function (fault) {
        const sw = {}; circuit.elems.forEach(function (e) { if (e.type === 'switch') sw[e.id] = false; });
        const r = meas(circuit, { fault: fault, switches: sw }, 'ohm', 'VO', a, b);
        return (r && r.flags.every(function (f) { return f.code !== 'ohm_powered'; })) ? r.trueValue : null; } });
    })(pts[i], pts[j]);
  }
  /* dioodirežiim (MM-400: ohm-asendi 3. režiim), mõlemad sondisuunad */
  pts.forEach(function (a) { pts.forEach(function (b) {
    if (a === b || !okPair(a, b)) return;
    list.push({ name: 'D ' + a + '→' + b, kind: 'D', run: function (fault) {
      const sw = {}; circuit.elems.forEach(function (e) { if (e.type === 'switch') sw[e.id] = false; });
      const ms = m2state('ohm'); ms.modeSel[ms.dial] = 2;
      const r = Engine.measure({ circuit: circuit, cond: { fault: fault, switches: sw }, meterId: 'm2', ms: ms, plugs: { red: 'VO', black: 'COM' }, tips: { red: a, black: b } });
      return (r.state === 'ok' && r.flags.every(function (f) { return f.code !== 'ohm_powered'; })) ? r.trueValue : null; } });
  }); });
  circuit.elems.forEach(function (e) {
    if (e.type !== 'link' && e.type !== 'switch') return;
    list.push({ name: 'I ' + e.id, kind: 'I', run: function (fault) {
      const cond = { fault: fault, links: {}, switches: {} };
      if (e.type === 'link') cond.links[e.id] = false; else cond.switches[e.id] = false;
      const r = meas(circuit, cond, bigI ? 'a' : 'ma', bigI ? 'A10' : 'MA', e.a, e.b);
      return r ? Math.abs(r.trueValue) : null; } });
  });
  return list;
}

function classes(kind, values) {
  /* values: [{f,v}] */
  const cl = [];
  values.forEach(function (x) {
    const hit = cl.find(function (c) { return (x.v === null && c.v === null) || (x.v !== null && c.v !== null && closeEnough(kind, c.v, x.v)); });
    if (hit) hit.items.push(x.f); else cl.push({ v: x.v, items: [x.f] });
  });
  return cl;
}

function analyse(level, seed) {
  const rand = Engine.rng(seed || 7);
  const built = level.build(rand);
  const circuit = built.circuit;
  /* kandidaadid */
  let cands;
  if (level.groups) {
    cands = [{ id: '', mods: [], label: '' }];
    level.groups.forEach(function (g) {
      const next = [];
      cands.forEach(function (c) { g.faults.forEach(function (f) { next.push({ id: (c.id ? c.id + '+' : '') + f.id, mods: c.mods.concat(f.mods), label: f.label }); }); });
      cands = next;
    });
  } else cands = level.faults;
  console.log('\n' + level.id + ' ' + level.title + ' – ' + cands.length + ' kandidaati, eelarve ' + level.budget + ', par ' + level.par);

  /* sümptom */
  const hModel = Engine.buildModel(circuit, {});
  const hSol = Engine.solve(hModel, {});
  const hObs = level.observables(hSol, hModel);
  cands.forEach(function (c) {
    const model = Engine.buildModel(circuit, { fault: { mods: c.mods } });
    const sol = Engine.solve(model, {});
    const obs = level.observables(sol, model);
    let diff = false;
    obs.forEach(function (o, i) {
      const h = hObs[i];
      if (Math.abs(o - h) > Math.max(0.15 * Math.abs(h), 1e-3 * (level.id === 'F5' ? 100 : 1))) diff = true;
    });
    if (!diff) bad(c.id + ': sümptom puudub (terve ' + hObs.map(function (x) { return x.toFixed(3); }) + ' vs ' + obs.map(function (x) { return x.toFixed(3); }) + ')');
  });

  /* eristatavus */
  const ms = enumerate(circuit, level);
  const table = ms.map(function (m) {
    return { m: m, vals: cands.map(function (c) { return { f: c.id, v: m.run({ mods: c.mods }) }; }) };
  });
  const sameSets = {};
  for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) {
    const diffAny = table.some(function (t) {
      const a = t.vals[i].v, b = t.vals[j].v;
      if (a === null || b === null) return false;
      return !closeEnough(t.m.kind, a, b);
    });
    if (!diffAny) bad(cands[i].id + ' ja ' + cands[j].id + ' pole ühegi mõõtmisega eristatavad');
  }

  /* ahne otsingupuu */
  function depth(set, path) {
    if (set.length <= 1) return { worst: 0, sum: 0, n: set.length };
    let best = null;
    table.forEach(function (t) {
      const vs = t.vals.filter(function (x) { return set.indexOf(x.f) >= 0; });
      if (vs.some(function (x) { return x.v === null; })) return;
      const cl = classes(t.m.kind, vs);
      if (cl.length < 2) return;
      const score = cl.length * 100 - Math.max.apply(null, cl.map(function (c) { return c.items.length; }));
      if (!best || score > best.score) best = { score: score, t: t, cl: cl };
    });
    if (!best) return { worst: 99, sum: 99 * set.length, n: set.length, stuck: set };
    let worst = 0, sum = 0;
    best.cl.forEach(function (c) {
      const d = depth(c.items);
      worst = Math.max(worst, d.worst + 1);
      sum += d.sum + c.items.length;
    });
    return { worst: worst, sum: sum, n: set.length, first: best.t.m.name };
  }
  const d = depth(cands.map(function (c) { return c.id; }));
  console.log('  ahne puu: halvim ' + d.worst + ' mõõtmist, keskmine ' + (d.sum / cands.length).toFixed(2) + ' (esimene: ' + d.first + ')');
  if (d.worst > level.par + 3) bad('halvim juhtum ületab par + 3');
  if (d.worst > level.budget) bad('halvim juhtum ületab eelarve');
  return table;
}

console.log('Tasemete kontroll');
Levels.list.forEach(function (lv) {
  /* ühised väljad */
  ['id', 'kind', 'title', 'summary', 'meters', 'start', 'build', 'story'].forEach(function (k) { if (!lv[k]) bad(lv.id + ': puudub ' + k); });
  const built = lv.build(Engine.rng(3));
  const ids = {};
  built.circuit.elems.forEach(function (e) { ids[e.id] = true; });
  Object.keys(built.circuit.points).forEach(function (p) { ids[p] = true; });
  built.circuit.elems.forEach(function (e) {
    if (!built.circuit.points[e.a] || !built.circuit.points[e.b]) bad(lv.id + ': element ' + e.id + ' viitab tundmatule punktile');
  });
  if (lv.kind === 'train') {
    (lv.tasks || []).forEach(function (t) {
      const s = t.spec;
      if (!s) return;
      ['across', 'through', 'at'].forEach(function (k) { if (s[k] && !ids[s[k]]) bad(lv.id + ' ' + t.id + ': tundmatu ' + k + '=' + s[k]); });
    });
  } else {
    const fl = lv.groups ? [].concat.apply([], lv.groups.map(function (g) { return g.faults; })) : lv.faults;
    fl.forEach(function (f) {
      f.mods.forEach(function (m) { if (m.el && !ids[m.el]) bad(lv.id + ' ' + f.id + ': tundmatu element ' + m.el); });
      if (!f.explain) bad(lv.id + ' ' + f.id + ': puudub selgitus');
    });
    (lv.id === 'F3' ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [7]).forEach(function (sd) { analyse(lv, sd); });
  }
});
console.log('\n' + (problems ? problems + ' probleemi' : 'Kõik korras'));
process.exit(problems ? 1 : 0);
