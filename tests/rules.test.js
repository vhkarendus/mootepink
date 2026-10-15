/* Mänguloogika testid: node tests/rules.test.js */
const assert = require('assert');
const Meters = require('../js/meters.js');
const Engine = require('../js/engine.js');
const Levels = require('../js/levels.js');
const Rules = require('../js/rules.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function setup(meterId, posId, red, black, tipR, tipB, cond, mode) {
  const M = Meters.get(meterId);
  const ms = Meters.newState(M);
  ms.dial = M.positions.findIndex(function (p) { return p.id === posId; });
  if (mode) ms.modeSel[ms.dial] = mode;
  return { meterId: meterId, ms: ms, plugs: { red: red, black: black }, tips: { red: tipR, black: tipB }, cond: cond || {} };
}
function rec(circuit, a, n) {
  const res = Engine.measure(Object.assign({ circuit: circuit }, a));
  return Rules.makeRecord(n || 1, Object.assign({ circuit: circuit }, a), res);
}

const T1 = Levels.get('T1'), c1 = T1.build(Engine.rng(1)).circuit;
console.log('Ülesannete kontroll');
t('T1: aku pinge sobib, vale piirkond (OL) ei sobi', function () {
  const r = rec(c1, setup('m1', 'v20', 'VOMA', 'COM', 'BP', 'BN'));
  assert(Rules.matchSpec(T1.tasks[0].spec, r, c1).ok, JSON.stringify(r.flags));
  const r2 = rec(c1, setup('m1', 'v2', 'VOMA', 'COM', 'BP', 'BN'));
  assert(!Rules.matchSpec(T1.tasks[0].spec, r2, c1).ok);
});
t('T1: negatiivne näit annab märkuse', function () {
  const r = rec(c1, setup('m1', 'v20', 'VOMA', 'COM', 'BN', 'BP'));
  const m = Rules.matchSpec(T1.tasks[0].spec, r, c1);
  assert(!m.ok && m.note, JSON.stringify(m));
});
t('T1: R1 ja LED sobivad (LED-i sondid R1b–BN)', function () {
  const r = rec(c1, setup('m1', 'v20', 'VOMA', 'COM', 'SWb', 'R1b'));
  assert(Rules.matchSpec(T1.tasks[1].spec, r, c1).ok, JSON.stringify(r.acrossElems));
  const r2 = rec(c1, setup('m1', 'v20', 'VOMA', 'COM', 'R1b', 'BN'));
  assert(Rules.matchSpec(T1.tasks[2].spec, r2, c1).ok, JSON.stringify(r2.acrossElems));
});
t('T1: trafo vahelduvpinge ainult V~ režiimis', function () {
  const ok = rec(c1, setup('m1', 'a200', 'VOMA', 'COM', 'TRa', 'TRb'));
  assert(Rules.matchSpec(T1.tasks[3].spec, ok, c1).ok, JSON.stringify(ok.flags));
  const dc = rec(c1, setup('m1', 'v20', 'VOMA', 'COM', 'TRa', 'TRb'));
  assert(!Rules.matchSpec(T1.tasks[3].spec, dc, c1).ok);
});

const T2 = Levels.get('T2'), c2 = T2.build(Engine.rng(1)).circuit;
t('T2: takistus vooluta, dioodirežiim anoodil', function () {
  const live = rec(c2, setup('m1', 'o2k', 'VOMA', 'COM', 'SWb', 'R1b'));
  assert(!Rules.matchSpec(T2.tasks[0].spec, live, c2).ok, 'toitega ei tohi sobida');
  const off = rec(c2, setup('m1', 'o2k', 'VOMA', 'COM', 'SWb', 'R1b', { switches: { SW: false } }));
  assert(Rules.matchSpec(T2.tasks[0].spec, off, c2).ok, JSON.stringify(off.flags) + off.reading);
  const d = rec(c2, setup('m1', 'diode', 'VOMA', 'COM', 'LEDa', 'LEDk', { switches: { SW: false } }));
  assert(Rules.matchSpec(T2.tasks[1].spec, d, c2).ok, d.reading + JSON.stringify(d.flags));
  const dr = rec(c2, setup('m1', 'diode', 'VOMA', 'COM', 'LEDk', 'LEDa', { switches: { SW: false } }));
  const m = Rules.matchSpec(T2.tasks[1].spec, dr, c2);
  assert(!m.ok && m.note);
});

const T3 = Levels.get('T3'), c3 = T3.build(Engine.rng(1)).circuit;
t('T3: vool J1 ja J2 kohalt, märk', function () {
  const a = setup('m1', 'i20m', 'VOMA', 'COM', 'J1a', 'J1b', { links: { J1: false } });
  const r = rec(c3, a);
  assert(Rules.matchSpec(T3.tasks[0].spec, r, c3).ok, r.reading + JSON.stringify(r.flags));
  const b = setup('m1', 'i20m', 'VOMA', 'COM', 'J2a', 'J2b', { links: { J2: false } });
  assert(Rules.matchSpec(T3.tasks[1].spec, rec(c3, b), c3).ok);
  const wrong = setup('m1', 'i20m', 'VOMA', 'COM', 'J1b', 'J1a', { links: { J1: false } });
  const m = Rules.matchSpec(T3.tasks[0].spec, rec(c3, wrong), c3);
  assert(!m.ok && m.note);
  const noOpen = setup('m1', 'i20m', 'VOMA', 'COM', 'J1a', 'J1b', {});
  assert(!Rules.matchSpec(T3.tasks[0].spec, rec(c3, noOpen), c3).ok, 'jumper kinni ei sobi');
});

const T4 = Levels.get('T4');
t('T4: arvutus kΩ', function () {
  const b = T4.build(Engine.rng(5));
  const ctx = Object.assign({ params: b.params }, Rules.trainContext(b.circuit));
  const ans = T4.tasks[2].answer;
  assert(Rules.checkAnswer(ans, String(b.params.R / 1000).replace('.', ','), ctx).ok);
  assert(!Rules.checkAnswer(ans, '9', ctx).ok);
  assert(!Rules.checkAnswer(ans, 'abc', ctx).ok);
});
const T5 = Levels.get('T5');
t('T5: pingete summa ~ toitepinge', function () {
  const b = T5.build(Engine.rng(2));
  const ctx = Object.assign({ params: b.params }, Rules.trainContext(b.circuit));
  assert(Rules.checkAnswer(T5.tasks[4].answer, '12', ctx).ok);
  assert(!Rules.checkAnswer(T5.tasks[4].answer, '11', ctx).ok);
});
const T6 = Levels.get('T6');
t('T6: harude voolud ja peaharu', function () {
  const b = T6.build(Engine.rng(3)), c = b.circuit;
  const mk = function (link, a, bb) { const o = {}; o[link] = false; return rec(c, setup('m1', 'i200m', 'VOMA', 'COM', a, bb, { links: o })); };
  const r1 = mk('J1', 'T1', 'J1b');
  assert(Rules.matchSpec(T6.tasks[0].spec, r1, c).ok, r1.reading + r1.seriesElems);
  const r2 = mk('J2', 'T2', 'J2b'), r3 = mk('J3', 'T3', 'J3b');
  assert(Rules.matchSpec(T6.tasks[1].spec, r2, c).ok);
  assert(Rules.matchSpec(T6.tasks[2].spec, r3, c).ok);
  const rm = mk('Jm', 'SWb', 'Jmb');
  assert(Rules.matchSpec(T6.tasks[3].spec, rm, c).ok, rm.reading + rm.seriesElems);
  const ctx = Object.assign({ params: b.params }, Rules.trainContext(c));
  const sum = (ctx.iThrough('R1') + ctx.iThrough('R2') + ctx.iThrough('R3')) * 1000;
  assert(Rules.checkAnswer(T6.tasks[4].answer, String(sum.toFixed(1)), ctx).ok);
});

console.log('Ennustus ja variandid');
t('Ennustuse hindamine: V ja OL', function () {
  const F1 = Levels.get('F1'), c = F1.build(Engine.rng(1)).circuit;
  const a = setup('m1', 'v20', 'VOMA', 'COM', 'SWb', 'R1b');
  const ex = Engine.healthy(Object.assign({ circuit: c }, a));
  assert(Rules.judgePrediction({ num: 7.0, unit: 'V' }, ex).ok === true);
  assert(Rules.judgePrediction({ num: 9, unit: 'V' }, ex).ok === false);
  assert(Rules.judgePrediction({ num: 7000, unit: 'mV' }, ex).ok === true);
  assert(Rules.judgePrediction({ ol: true }, ex).ok === false);
});
t('Variandid: õige rike jääb kõigi mõõtmiste järel alles, mõni langeb välja', function () {
  const F1 = Levels.get('F1'), c = F1.build(Engine.rng(1)).circuit;
  const fault = F1.faults.find(function (f) { return f.id === 'r_open'; });
  const a = setup('m1', 'v20', 'VOMA', 'COM', 'BP', 'BN', { fault: { mods: fault.mods } });
  const r = Rules.makeRecord(1, Object.assign({ circuit: c }, a), Engine.measure(Object.assign({ circuit: c }, a)));
  const b = setup('m1', 'v20', 'VOMA', 'COM', 'SWb', 'R1b', { fault: { mods: fault.mods } });
  const r2 = Rules.makeRecord(2, Object.assign({ circuit: c }, b), Engine.measure(Object.assign({ circuit: c }, b)));
  const p = Rules.possible(F1, c, [r, r2]);
  assert(p[0].r_open, 'õige rike peab alles jääma');
  assert(!p[0].bat_dead, 'tühi aku peab välja langema');
  assert(Object.keys(p[0]).length < F1.faults.length);
});
t('Variandid: kaks riket (F6) – kummastki grupist jääb õige alles', function () {
  const F6 = Levels.get('F6'), c = F6.build(Engine.rng(1)).circuit;
  const act = Levels.activeFault(F6, Engine.rng(9));
  const a = setup('m2', 'v', 'VO', 'COM', 'A0', 'BN', { fault: { mods: act.mods } });
  const r = Rules.makeRecord(1, Object.assign({ circuit: c }, a), Engine.measure(Object.assign({ circuit: c }, a)));
  const p = Rules.possible(F6, c, [r]);
  act.picks.forEach(function (pk, gi) { assert(p[gi][pk.id], 'puudub ' + pk.id); });
});
t('Tähed', function () {
  assert.strictEqual(Rules.starsFault({ solved: true, firstTry: true, measurements: 3, par: 4, setupErrors: 0, predRight: 2, predTotal: 3, hints: 0 }), 3);
  assert.strictEqual(Rules.starsFault({ solved: true, firstTry: true, measurements: 3, par: 4, setupErrors: 0, predRight: 2, predTotal: 3, hints: 1 }), 2);
  assert.strictEqual(Rules.starsFault({ solved: true, firstTry: false, measurements: 3, par: 4, setupErrors: 0, predRight: 2, predTotal: 3, hints: 0 }), 1);
  assert.strictEqual(Rules.starsFault({ solved: true, firstTry: true, measurements: 0, minMeas: 2, par: 4, setupErrors: 0, predRight: 0, predTotal: 0, hints: 0 }), 1, 'arvamine ilma mõõtmata');
  assert.strictEqual(Rules.starsFault({ solved: false }), 0);
  assert.strictEqual(Rules.starsTrain(1), 3);
});

console.log('\n' + pass + ' läbi, ' + fail + ' ebaõnnestus');
process.exit(fail ? 1 : 0);
