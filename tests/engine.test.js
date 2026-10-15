/* Mootori testid: node tests/engine.test.js */
const assert = require('assert');
const Meters = require('../js/meters.js');
const Engine = require('../js/engine.js');
const Circuits = require('../js/circuits.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
function near(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error((msg || '') + ' ootasin ' + b + ', sain ' + a + ' (lubatud viga ' + tol + ')');
}
function setupMeter(id, posId, red, black, tipR, tipB, mode) {
  const M = Meters.get(id);
  const ms = Meters.newState(M);
  ms.dial = M.positions.findIndex(function (p) { return p.id === posId; });
  if (ms.dial < 0) throw new Error('puudub positsioon ' + posId);
  if (mode) ms.modeSel[ms.dial] = mode;
  return { meterId: id, ms: ms, plugs: { red: red, black: black }, tips: { red: tipR, black: tipB } };
}
function run(circuit, cond, mset) {
  return Engine.measure(Object.assign({ circuit: circuit, cond: cond }, mset));
}

const C = Circuits.led();
console.log('Lahendaja (C1: 9 V, 470 Ω, LED 1,8 V)');

t('vool ahelas ~ 14,97 mA', function () {
  const model = Engine.buildModel(C, {});
  const sol = Engine.solve(model, {});
  near(sol.I.R1, (9 - 1.8) / (470 + 10 + 1 + 0.02), 2e-4, 'R1 vool');
  assert(sol.ledOn.LED1, 'LED peab põlema');
});

t('M1: aku pinge V⎓ 20 V piirkonnas ~ 9 V (koormuseta ~ 9 - I*r)', function () {
  const m = setupMeter('m1', 'v20', 'VOMA', 'COM', 'BP', 'BN');
  const r = run(C, {}, m);
  assert.strictEqual(r.state, 'ok');
  near(r.value, 8.98 * 1.004, 0.08, 'U_aku');
  assert.strictEqual(r.quality, 'good', JSON.stringify(r.flags));
  assert(r.acrossElems.indexOf('BAT') >= 0);
});

t('M1: pinge R1 peal õige märk, ± vahetamisel negatiivne', function () {
  const m = setupMeter('m1', 'v20', 'VOMA', 'COM', 'SWb', 'R1b');
  const r = run(C, {}, m);
  near(r.value, 14.97e-3 * 470 * 1.004, 0.1);
  const m2 = setupMeter('m1', 'v20', 'VOMA', 'COM', 'R1b', 'SWb');
  const r2 = run(C, {}, m2);
  assert(r2.value < 0 && r2.flags.some(function (f) { return f.code === 'reverse'; }), 'peab olema negatiivne');
});

t('M1: 2 V piirkond ja 7 V -> OL (viga)', function () {
  const m = setupMeter('m1', 'v2', 'VOMA', 'COM', 'SWb', 'R1b');
  const r = run(C, {}, m);
  assert(r.disp.ol && r.quality === 'bad');
});

t('M1: 200 V piirkond on liiga suur (hoiatus)', function () {
  const m = setupMeter('m1', 'v200', 'VOMA', 'COM', 'SWb', 'R1b');
  const r = run(C, {}, m);
  assert(r.flags.some(function (f) { return f.code === 'range_big'; }), JSON.stringify(r.flags));
});

t('M1: vool jumperi J1 avamisel 200 mA piirkonnas ~ 14,9 mA', function () {
  const m = setupMeter('m1', 'i200m', 'VOMA', 'COM', 'J1a', 'J1b');
  const r = run(C, { links: { J1: false } }, m);
  assert.strictEqual(r.state, 'ok');
  near(r.value, 14.9e-3, 0.4e-3, 'vool');
  assert(r.seriesElems.indexOf('R1') >= 0, 'R1 on seerias: ' + r.seriesElems);
});

t('M1: 20 mA piirkond sobib, 2 mA piirkonnas OL (viga), 200 µA OL', function () {
  const m2 = setupMeter('m1', 'i20m', 'VOMA', 'COM', 'J1a', 'J1b');
  const r2 = run(C, { links: { J1: false } }, m2);
  assert.strictEqual(r2.quality, 'good', JSON.stringify(r2.flags));
  const m3 = setupMeter('m1', 'i2m', 'VOMA', 'COM', 'J1a', 'J1b');
  const r3 = run(C, { links: { J1: false } }, m3);
  assert(r3.disp.ol && r3.quality === 'bad', JSON.stringify(r3.flags));
});

t('M1: ampermeeter jumperi suletuna -> sondid samas sõlmes (viga)', function () {
  const m = setupMeter('m1', 'i200m', 'VOMA', 'COM', 'J1a', 'J1b');
  const r = run(C, { links: { J1: true } }, m);
  assert(r.flags.some(function (f) { return f.code === 'same_net_a'; }));
});

t('M1: voolumõõtmine vales pesas (10A pesa, 200m piirkond) -> viga', function () {
  const m = setupMeter('m1', 'i200m', 'A10', 'COM', 'J1a', 'J1b');
  const r = run(C, { links: { J1: false } }, m);
  assert(r.flags.some(function (f) { return f.code === 'wrong_jack_current'; }));
});

t('pinge mõõtmine voolupesast üle aku: vale näit (M1 10A) ja kaitse põleb (M2 mA-pesa)', function () {
  const m = setupMeter('m1', 'v20', 'A10', 'COM', 'BP', 'BN');
  const r = run(C, {}, m);
  assert(r.flags.some(function (f) { return f.code === 'volt_in_current_jack'; }), JSON.stringify(r.flags));
  assert(Math.abs(r.value) < 1, 'näit peab olema vale (~0): ' + r.value);
  const m2 = setupMeter('m2', 'v', 'MA', 'COM', 'BP', 'BN');
  const r2 = run(C, {}, m2);
  assert.strictEqual(r2.fuseBlown, 'mA');
  const m3 = setupMeter('m1', 'v20', 'VOMA', 'COM', 'BP', 'BN');
  assert(!run(C, {}, m3).fuseBlown);
});

t('M1: takistus R1 toide väljas (lüliti avatud) 2k piirkonnas = 470 Ω', function () {
  const m = setupMeter('m1', 'o2k', 'VOMA', 'COM', 'SWb', 'R1b');
  const r = run(C, { switches: { SW: false } }, m);
  near(r.trueValue, 470, 0.5);
  assert.strictEqual(r.quality, 'good', JSON.stringify(r.flags));
  assert(r.disp.text.indexOf('0.47') === 0 || r.disp.text === '0.472' || /0\.4/.test(r.disp.text), r.disp.text);
});

t('M1: takistus pinge all -> viga', function () {
  const m = setupMeter('m1', 'o2k', 'VOMA', 'COM', 'SWb', 'R1b');
  const r = run(C, {}, m);
  assert(r.flags.some(function (f) { return f.code === 'ohm_powered'; }));
});

t('M1: LED takistusrežiimis = OL, dioodirežiimis ~ 1,8 V (õige suund) ja OL (vale suund)', function () {
  const m = setupMeter('m1', 'diode', 'VOMA', 'COM', 'LEDa', 'LEDk');
  const r = run(C, { switches: { SW: false } }, m);
  near(r.trueValue, 1.81, 0.05);
  const m2 = setupMeter('m1', 'diode', 'VOMA', 'COM', 'LEDk', 'LEDa');
  const r2 = run(C, { switches: { SW: false } }, m2);
  assert(r2.disp.ol, 'vastupidi peab olema OL');
});

console.log('Rikked');
const faultR = { id: 'r_open', mods: [{ el: 'R1', set: { open: true } }] };
t('R1 katki: LED ei põle; pinge R1 peal ~ 7,2 V (LED sulgeb ahela voltmeetri kaudu), LED peal ~0 V', function () {
  const model = Engine.buildModel(C, { fault: faultR });
  const sol = Engine.solve(model, {});
  assert(!sol.ledOn.LED1 || Math.abs(sol.I.LED1) < 1e-5);
  const m = setupMeter('m2', 'v', 'VO', 'COM', 'SWb', 'R1b');
  const r = run(C, { fault: faultR }, m);
  near(r.value, 7.2, 0.3, 'pinge katkise R1 peal');
  const m2 = setupMeter('m2', 'v', 'VO', 'COM', 'LEDa', 'LEDk');
  const r2 = run(C, { fault: faultR }, m2);
  near(r2.value, 0, 0.05, 'LED peal 0');
});

t('LED vastupidi: vool puudub; dioodirežiim näitab OL õiges suunas', function () {
  const f = { id: 'led_rev', mods: [{ el: 'LED1', set: { reversed: true } }] };
  const model = Engine.buildModel(C, { fault: f });
  const sol = Engine.solve(model, {});
  assert(!sol.ledOn.LED1);
  const m = setupMeter('m1', 'diode', 'VOMA', 'COM', 'LEDa', 'LEDk');
  const r = run(C, { switches: { SW: false }, fault: f }, m);
  assert(r.disp.ol, 'vastupidine LED + õige sondisuund = OL');
});

t('lühis üle R1: LED põleb väga eredalt, vool > 100 mA', function () {
  const f = { id: 'r_short', mods: [{ el: 'R1', set: { short: true } }] };
  const model = Engine.buildModel(C, { fault: f });
  const sol = Engine.solve(model, {});
  assert(sol.ledOn.LED1 && sol.I.LED1 > 0.1, 'vool ' + sol.I.LED1);
});

t('tühi aku: pinge 1,4 V -> LED ei põle, aku klemmipinge ~ 1,4 V', function () {
  const f = { id: 'bat_dead', mods: [{ el: 'BAT', set: { V: 1.4, r: 8 } }] };
  const model = Engine.buildModel(C, { fault: f });
  const sol = Engine.solve(model, {});
  assert(!sol.ledOn.LED1);
  const m = setupMeter('m2', 'v', 'VO', 'COM', 'BP', 'BN');
  const r = run(C, { fault: f }, m);
  near(r.value, 1.4, 0.1);
});

console.log('M2 / M3');
t('M2 auto: 9 V -> 40 V piirkond ("8.98"), vool 10A pesas, SELECT AC', function () {
  const m = setupMeter('m2', 'v', 'VO', 'COM', 'BP', 'BN');
  const r = run(C, {}, m);
  assert.strictEqual(r.disp.unit, 'V');
  assert(/^8\.9/.test(r.disp.text), r.disp.text);
  const m2 = setupMeter('m2', 'v', 'VO', 'COM', 'BP', 'BN', 1); /* AC */
  const r2 = run(C, {}, m2);
  assert(r2.flags.some(function (f) { return f.code === 'ac_dc'; }), JSON.stringify(r2.flags));
});

t('M2: vool mA-pesas, auto-piirkond (40 mA)', function () {
  const m = setupMeter('m2', 'ma', 'MA', 'COM', 'J1a', 'J1b');
  const r = run(C, { links: { J1: false } }, m);
  assert.strictEqual(r.state, 'ok'); assert.strictEqual(r.disp.unit, 'mA');
  near(r.value, 14.9e-3, 0.4e-3);
  assert(/^1[45]\./.test(r.disp.text), r.disp.text);
});

t('M3: pesa alert (LEAd) kui punane mA-pesas ja dial V; kaitse põleb', function () {
  const m = setupMeter('m3', 'vdc', 'MA', 'COM', 'BP', 'BN');
  const r = run(C, {}, m);
  assert(r.flags.some(function (f) { return f.code === 'lead_alert'; }));
  assert.strictEqual(r.fuseBlown, 'mA');
});

t('M3: VΩ-pesa on teises kohas kui M2-l (paigutus erineb)', function () {
  const j2 = Meters.get('m2').jacks.map(function (j) { return j.id; }).join(',');
  const j3 = Meters.get('m3').jacks.map(function (j) { return j.id; }).join(',');
  assert.notStrictEqual(j2, j3);
});

t('musta juhtme puudumine COM-ist -> no_com', function () {
  const m = setupMeter('m2', 'v', 'VO', 'MA', 'BP', 'BN');
  const r = run(C, {}, m);
  assert(r.flags.some(function (f) { return f.code === 'no_com'; }));
});

console.log('\n' + pass + ' läbi, ' + fail + ' ebaõnnestus');
process.exit(fail ? 1 : 0);
