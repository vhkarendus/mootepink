/* Mõõtepink – vooluringide kirjeldused (punktid ruudustikul + elemendid).
   Punktid on proovitavad mõõtepunktid; elemendid ühendavad punkte.
   type: bat (a = +), res, led (a = anood), switch, link (jumper), wire (via = nurgad), fuse, motor, adc
   Rikked EI ole siin – need lisatakse leveli kirjelduses (levels.js). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Circuits = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function trim(x) { return String(Math.round(x * 100) / 100).replace('.', ','); }
  function fmtR(R) {
    if (R >= 1e6) return trim(R / 1e6) + ' MΩ';
    if (R >= 1e3) return trim(R / 1e3) + ' kΩ';
    return trim(R) + ' Ω';
  }
  function wire(id, a, b, via) { return { id: id, type: 'wire', a: a, b: b, via: via || [] }; }
  function link(id, a, b) { return { id: id, type: 'link', a: a, b: b, name: id }; }
  function res(id, a, b, R, name, extra) {
    return Object.assign({ id: id, type: 'res', a: a, b: b, R: R, name: name || id, val: fmtR(R) }, extra || {});
  }

  /* ---- C1: aku + jumper + lüliti + takisti + LED + jumper (T1–T3, F1); acLoop lisab trafo ---- */
  function led(o) {
    o = o || {};
    const V = o.V || 9, R = o.R || 470;
    const c = {
      cols: 16, rows: o.acLoop ? 11 : 9,
      points: {
        BP: [2, 3], BN: [2, 6], J1a: [4, 2], J1b: [5, 2], SWb: [7, 2], R1b: [10, 2],
        LEDa: [14, 3], LEDk: [14, 6], J2a: [12, 7], J2b: [11, 7]
      },
      labels: {},
      deco: [{ t: 'gnd', at: 'BN' }],
      elems: [
        { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: V, r: o.r === undefined ? 1 : o.r, name: 'Aku', val: V + ' V' },
        wire('W1', 'BP', 'J1a', [[2, 2]]),
        link('J1', 'J1a', 'J1b'),
        { id: 'SW', type: 'switch', a: 'J1b', b: 'SWb', name: 'Lüliti', closed: true },
        res('R1', 'SWb', 'R1b', R, 'R1'),
        wire('W2', 'R1b', 'LEDa', [[14, 2]]),
        { id: 'LED1', type: 'led', a: 'LEDa', b: 'LEDk', Vf: o.Vf || 1.8, name: 'LED' },
        wire('W3', 'LEDk', 'J2a', [[14, 7]]),
        link('J2', 'J2a', 'J2b'),
        wire('W4', 'J2b', 'BN', [[2, 7]])
      ]
    };
    if (o.acLoop) {
      Object.assign(c.points, { TRa: [3, 9], TRb: [6, 9], RLa: [9, 9], RLb: [12, 9] });
      c.elems.push(
        { id: 'TR', type: 'bat', ac: true, V: 12, r: 2, a: 'TRa', b: 'TRb', name: 'Trafo', val: '12 V~', lab: 'above' },
        wire('W5', 'TRb', 'RLa'),
        Object.assign(res('R2', 'RLa', 'RLb', 100, 'R2'), { lab: 'above' }),
        wire('W6', 'RLb', 'TRa', [[12, 10], [3, 10]])
      );
    }
    return c;
  }

  /* ---- C2: aku + lüliti + tundmatu takisti (T4) ---- */
  function ohm(o) {
    o = o || {};
    const V = o.V || 12;
    return {
      cols: 16, rows: 9,
      points: { BP: [2, 3], BN: [2, 6], J1a: [4, 2], J1b: [5, 2], SWb: [8, 2], R1a: [12, 3], R1b: [12, 6], J2a: [9, 7], J2b: [8, 7] },
      labels: {}, deco: [{ t: 'gnd', at: 'BN' }],
      elems: [
        { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: V, r: 0.5, name: 'Aku', val: V + ' V' },
        wire('W1', 'BP', 'J1a', [[2, 2]]),
        link('J1', 'J1a', 'J1b'),
        { id: 'SW', type: 'switch', a: 'J1b', b: 'SWb', name: 'Lüliti', closed: true },
        wire('W2', 'SWb', 'R1a', [[12, 2]]),
        res('R1', 'R1a', 'R1b', o.R || 1500, 'R1', { val: '?', hideVal: true }),
        wire('W3', 'R1b', 'J2a', [[12, 7]]),
        link('J2', 'J2a', 'J2b'),
        wire('W4', 'J2b', 'BN', [[2, 7]])
      ]
    };
  }

  /* ---- C3: kolm takistit jadas (T5) ---- */
  function series3(o) {
    o = o || {};
    const V = o.V || 12;
    return {
      cols: 16, rows: 9,
      points: { BP: [2, 3], BN: [2, 6], SWa: [4, 2], SWb: [6, 2], N1: [9, 2], N2: [12, 2], R3a: [14, 3], R3b: [14, 6], J1a: [11, 7], J1b: [10, 7] },
      labels: {}, deco: [{ t: 'gnd', at: 'BN' }],
      elems: [
        { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: V, r: 0.5, name: 'Aku', val: V + ' V' },
        wire('W1', 'BP', 'SWa', [[2, 2]]),
        { id: 'SW', type: 'switch', a: 'SWa', b: 'SWb', name: 'Lüliti', closed: true },
        res('R1', 'SWb', 'N1', o.R1 || 1000, 'R1'),
        res('R2', 'N1', 'N2', o.R2 || 2200, 'R2'),
        wire('W2', 'N2', 'R3a', [[14, 2]]),
        res('R3', 'R3a', 'R3b', o.R3 || 3300, 'R3'),
        wire('W3', 'R3b', 'J1a', [[14, 7]]),
        link('J1', 'J1a', 'J1b'),
        wire('W4', 'J1b', 'BN', [[2, 7]])
      ]
    };
  }

  /* ---- C4: kolm takistit rööbiti, igaühel jumper + peajumper (T6) ---- */
  function parallel3(o) {
    o = o || {};
    const V = o.V || 9;
    const c = {
      cols: 17, rows: 9,
      points: {
        BP: [2, 2], BN: [2, 6], SWa: [4, 2], SWb: [6, 2], Jmb: [7, 2],
        T1: [9, 2], T2: [12, 2], T3: [15, 2],
        J1b: [9, 3], J2b: [12, 3], J3b: [15, 3],
        B1: [9, 6], B2: [12, 6], B3: [15, 6]
      },
      labels: {}, deco: [{ t: 'gnd', at: 'BN' }],
      elems: [
        { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: V, r: 1, name: 'Aku', val: V + ' V' },
        wire('W1', 'BP', 'SWa'),
        { id: 'SW', type: 'switch', a: 'SWa', b: 'SWb', name: 'Lüliti', closed: true },
        link('Jm', 'SWb', 'Jmb'),
        wire('W2', 'Jmb', 'T1'), wire('W3', 'T1', 'T2'), wire('W4', 'T2', 'T3'),
        link('J1', 'T1', 'J1b'), link('J2', 'T2', 'J2b'), link('J3', 'T3', 'J3b'),
        res('R1', 'J1b', 'B1', o.R1 || 1000, 'R1'),
        res('R2', 'J2b', 'B2', o.R2 || 680, 'R2'),
        res('R3', 'J3b', 'B3', o.R3 || 470, 'R3'),
        wire('W5', 'B3', 'B2'), wire('W6', 'B2', 'B1'), wire('W7', 'B1', 'BN')
      ]
    };
    return c;
  }

  /* ---- C5: pingejagur / valgusandur + 10 kΩ + Arduino A0 (F2, F3) ---- */
  function divider(o) {
    o = o || {};
    const sensor = !!o.sensor;
    const top = sensor
      ? { id: 'R1', type: 'res', a: 'J1b', b: 'N', R: o.R1 || 4700, name: 'Andur', val: 'valgusandur', sym: 'ldr' }
      : res('R1', 'J1b', 'N', o.R1 || 10000, 'R1');
    return {
      cols: 16, rows: 9, adc: 'ADC',
      points: { BP: [2, 2], BN: [2, 7], SWa: [4, 2], SWb: [6, 2], J1b: [7, 2], N: [10, 2], G: [10, 6], AD1: [13, 3], AD2: [13, 6] },
      labels: { N: 'A0', BN: 'GND', BP: '5V' }, deco: [{ t: 'gnd', at: 'BN' }, { t: 'dot', xy: [10, 7] }],
      elems: [
        { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: 5, r: 0.5, name: 'Arduino', val: '5 V' },
        wire('W1', 'BP', 'SWa'),
        { id: 'SW', type: 'switch', a: 'SWa', b: 'SWb', name: 'USB', closed: true },
        link('J1', 'SWb', 'J1b'),
        top,
        res('R2', 'N', 'G', o.R2 || 10000, 'R2'),
        wire('W2', 'N', 'AD1', [[13, 2]]),
        { id: 'ADC', type: 'adc', a: 'AD1', b: 'AD2', R: 1e8, name: 'A0-sisend', val: '' },
        wire('W3', 'AD2', 'BN', [[13, 7], [2, 7]]),
        wire('W4', 'G', 'BN', [[10, 7]])
      ]
    };
  }

  /* ---- C7: kolm LED-i rööbiti (takisti + LED igas harus), jumperid (F4) ---- */
  function leds3(o) {
    o = o || {};
    const V = o.V || 5;
    const pts = {
      BP: [2, 2], BN: [2, 7], SWa: [4, 2], SWb: [6, 2], Jmb: [7, 2],
      T1: [9, 2], T2: [12, 2], T3: [15, 2],
      J1b: [9, 3], J2b: [12, 3], J3b: [15, 3],
      M1: [9, 5], M2: [12, 5], M3: [15, 5],
      B1: [9, 7], B2: [12, 7], B3: [15, 7]
    };
    const elems = [
      { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: V, r: 0.5, name: 'Toide', val: V + ' V' },
      wire('W1', 'BP', 'SWa'),
      { id: 'SW', type: 'switch', a: 'SWa', b: 'SWb', name: 'Lüliti', closed: true },
      link('Jm', 'SWb', 'Jmb'),
      wire('W2', 'Jmb', 'T1'), wire('W3', 'T1', 'T2'), wire('W4', 'T2', 'T3')
    ];
    [1, 2, 3].forEach(function (k) {
      elems.push(link('J' + k, 'T' + k, 'J' + k + 'b'));
      elems.push(res('R' + k, 'J' + k + 'b', 'M' + k, (o['R' + k] || 330), 'R' + k));
      elems.push({ id: 'LED' + k, type: 'led', a: 'M' + k, b: 'B' + k, Vf: o.Vf || 1.8, name: 'LED' + k });
    });
    elems.push(wire('W5', 'B3', 'B2'), wire('W6', 'B2', 'B1'), wire('W7', 'B1', 'BN'));
    return { cols: 17, rows: 9, points: pts, labels: {}, deco: [{ t: 'gnd', at: 'BN' }], elems: elems };
  }

  /* ---- C8: GreenPower: aku 24 V, kaitse, kontaktor, klemm, mootor, jumper (F5) ---- */
  function motor(o) {
    o = o || {};
    return {
      cols: 16, rows: 9,
      points: { BP: [2, 2], BN: [2, 7], F1a: [4, 2], F1b: [7, 2], K1b: [10, 2], X1b: [12, 2], Ma: [14, 3], Mb: [14, 6], J1a: [11, 7], J1b: [10, 7] },
      labels: {}, deco: [{ t: 'gnd', at: 'BN' }],
      elems: [
        { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: 24, r: 0.06, name: 'Aku', val: '24 V' },
        wire('W1', 'BP', 'F1a'),
        { id: 'F1', type: 'fuse', a: 'F1a', b: 'F1b', R: 0.05, name: 'Kaitse', val: '15 A' },
        { id: 'K1', type: 'switch', a: 'F1b', b: 'K1b', name: 'Kontaktor', closed: true },
        { id: 'X1', type: 'res', a: 'K1b', b: 'X1b', R: 0.01, name: 'Klemm', val: '', sym: 'conn' },
        wire('W2', 'X1b', 'Ma', [[14, 2]]),
        { id: 'M', type: 'motor', a: 'Ma', b: 'Mb', R: o.Rm || 6, name: 'Mootor', val: '' },
        wire('W3', 'Mb', 'J1a', [[14, 7]]),
        link('J1', 'J1a', 'J1b'),
        wire('W4', 'J1b', 'BN')
      ]
    };
  }

  /* ---- C9: plaat: LED-indikaator + valgusandur (kaks haru), lõppkatse (F6) ---- */
  function board(o) {
    o = o || {};
    return {
      cols: 17, rows: 10, adc: 'ADC',
      points: {
        BP: [2, 2], BN: [2, 8], SWa: [4, 2], SWb: [6, 2],
        T1: [9, 2], T2: [13, 2], J1b: [9, 3], M1: [9, 5], B1: [9, 8],
        J2b: [13, 3], A0: [13, 5], B2: [13, 8], AD1: [15, 6], AD2: [15, 8]
      },
      labels: { A0: 'A0', BN: 'GND', BP: '5V' }, deco: [{ t: 'gnd', at: 'BN' }],
      elems: [
        { id: 'BAT', type: 'bat', a: 'BP', b: 'BN', V: 5, r: 0.5, name: 'Arduino', val: '5 V' },
        wire('W1', 'BP', 'SWa'),
        { id: 'SW', type: 'switch', a: 'SWa', b: 'SWb', name: 'USB', closed: true },
        wire('W2', 'SWb', 'T1'), wire('W3', 'T1', 'T2'),
        link('J1', 'T1', 'J1b'),
        res('R1', 'J1b', 'M1', 330, 'R1'),
        { id: 'LED1', type: 'led', a: 'M1', b: 'B1', Vf: 1.8, name: 'LED' },
        link('J2', 'T2', 'J2b'),
        { id: 'S1', type: 'res', a: 'J2b', b: 'A0', R: o.Rs || 4700, name: 'Andur', val: 'valgusandur', sym: 'ldr' },
        res('R2', 'A0', 'B2', 10000, 'R2'),
        wire('W4', 'A0', 'AD1', [[15, 5]]),
        { id: 'ADC', type: 'adc', a: 'AD1', b: 'AD2', R: 1e8, name: 'A0-sisend', val: '' },
        wire('W5', 'AD2', 'B2'), wire('W6', 'B2', 'B1'), wire('W7', 'B1', 'BN')
      ]
    };
  }

  return {
    fmtR: fmtR, led: led, ohm: ohm, series3: series3, parallel3: parallel3,
    divider: divider, leds3: leds3, motor: motor, board: board
  };
});
