/* Mõõtepink – multimeetrite mudelid (andmed + näidu vormindamine).
   Kolm erinevat mõõtjat: MM-100 (käsitsi piirkonnad), MM-400 (automaatne), MM-700 (pro). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Meters = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- väikesed abifunktsioonid positsioonide kirjeldamiseks ---------- */
  function range(unit, mult, dec, extra) {
    return Object.assign({ unit: unit, mult: mult, dec: dec }, extra || {});
  }
  function pos(id, label, group, modes, extra) {
    return Object.assign({ id: id, label: label, group: group, modes: modes }, extra || {});
  }
  function mode(fn, tag, jack, ranges, extra) {
    return Object.assign({ fn: fn, tag: tag, jack: jack, ranges: ranges, ac: false }, extra || {});
  }

  /* ======================= MM-100 : algaja, käsitsi piirkonnad ======================= */
  const m1 = {
    id: 'm1', name: 'MM-100', kind: 'Algaja mõõtja',
    blurb: 'Odav klassikaline multimeeter. Piirkond tuleb ise valida, 1 vasakul tähendab ületäitumist (OL).',
    cmax: 1999, olText: '1', gain: 0.004, auto: false, inputAlert: false,
    look: { body: '#EDBE2B', bodyDark: '#C99A12', ink: '#1d1a12', knob: '#20201c', knobRing: '#3a3a33', lcdBg: '#B9C79F', w: 300, h: 640 },
    lcd: { x: 28, y: 28, w: 244, h: 96 },
    dial: { cx: 150, cy: 276, r: 44, rLabel: 90 },
    jacks: [
      { id: 'A10', label: '10A', sub: 'MAX 10A', kinds: ['A10'], x: 62, y: 568, ring: '#B3261E' },
      { id: 'COM', label: 'COM', sub: '', kinds: ['COM'], x: 150, y: 568, ring: '#111111' },
      { id: 'VOMA', label: 'VΩmA', sub: 'MAX 200mA', kinds: ['V', 'mA'], x: 238, y: 568, ring: '#B3261E' }
    ],
    fuse: { mA: 0.2, A10: 10 },
    fuseLabel: { mA: '0,2 A', A10: '10 A' },
    shunt: { mA: 2, A10: 0.02 },
    buttons: [],
    groups: {
      dcv: { name: 'V⎓', color: '#0B4F8A' },
      acv: { name: 'V~', color: '#6A2C91' },
      diode: { name: '→|', color: '#444444' },
      ohm: { name: 'Ω', color: '#1B6B3A' },
      dca: { name: 'A⎓', color: '#A12A1F' },
      off: { name: '', color: '#1d1a12' }
    },
    positions: [
      pos('off', 'OFF', 'off', [{ fn: 'OFF' }]),
      pos('v200m', '200m', 'dcv', [mode('V', 'V⎓', 'V', [range('mV', 1e3, 1)])]),
      pos('v2', '2', 'dcv', [mode('V', 'V⎓', 'V', [range('V', 1, 3)])]),
      pos('v20', '20', 'dcv', [mode('V', 'V⎓', 'V', [range('V', 1, 2)])]),
      pos('v200', '200', 'dcv', [mode('V', 'V⎓', 'V', [range('V', 1, 1)])]),
      pos('v600', '600', 'dcv', [mode('V', 'V⎓', 'V', [range('V', 1, 0, { maxSI: 600 })])]),
      pos('a200', '200', 'acv', [mode('V', 'V~', 'V', [range('V', 1, 1)], { ac: true })]),
      pos('a600', '600', 'acv', [mode('V', 'V~', 'V', [range('V', 1, 0, { maxSI: 600 })], { ac: true })]),
      pos('diode', '→|', 'diode', [mode('DIODE', '→|', 'V', [range('V', 1, 3, { maxSI: 1.999 })])]),
      pos('o200', '200', 'ohm', [mode('OHM', 'Ω', 'V', [range('Ω', 1, 1)])]),
      pos('o2k', '2k', 'ohm', [mode('OHM', 'Ω', 'V', [range('kΩ', 1e-3, 3)])]),
      pos('o20k', '20k', 'ohm', [mode('OHM', 'Ω', 'V', [range('kΩ', 1e-3, 2)])]),
      pos('o200k', '200k', 'ohm', [mode('OHM', 'Ω', 'V', [range('kΩ', 1e-3, 1)])]),
      pos('o2m', '2M', 'ohm', [mode('OHM', 'Ω', 'V', [range('MΩ', 1e-6, 3)])]),
      pos('i200u', '200µ', 'dca', [mode('A', 'A⎓', 'mA', [range('µA', 1e6, 1, { shunt: 1000 })])]),
      pos('i2m', '2m', 'dca', [mode('A', 'A⎓', 'mA', [range('mA', 1e3, 3, { shunt: 100 })])]),
      pos('i20m', '20m', 'dca', [mode('A', 'A⎓', 'mA', [range('mA', 1e3, 2, { shunt: 10 })])]),
      pos('i200m', '200m', 'dca', [mode('A', 'A⎓', 'mA', [range('mA', 1e3, 1, { shunt: 1 })])]),
      pos('i10', '10', 'dca', [mode('A', 'A⎓', 'A10', [range('A', 1, 2, { maxSI: 10, shunt: 0.02 })])])
    ]
  };

  /* ======================= MM-400 : automaatne piirkond ======================= */
  const m2 = {
    id: 'm2', name: 'MM-400', kind: 'Automaatne mõõtja',
    blurb: 'Valib piirkonna ise. Funktsioonide vahel (⎓/~, Ω/piiks/diood) vahetab SELECT-nupp. Voolu jaoks on kaks eraldi pesa.',
    cmax: 3999, olText: 'OL', gain: -0.001, auto: true, inputAlert: false,
    look: { body: '#39434D', bodyDark: '#2A323A', ink: '#EDEFF1', knob: '#14181C', knobRing: '#4D5964', lcdBg: '#B9C79F', w: 300, h: 640 },
    lcd: { x: 28, y: 28, w: 244, h: 96 },
    dial: { cx: 150, cy: 272, r: 46, rLabel: 92 },
    jacks: [
      { id: 'COM', label: 'COM', sub: '', kinds: ['COM'], x: 52, y: 580, ring: '#111111' },
      { id: 'VO', label: 'VΩ', sub: '', kinds: ['V'], x: 118, y: 580, ring: '#C23B32' },
      { id: 'MA', label: 'mA µA', sub: 'F 0,5A', kinds: ['mA'], x: 184, y: 580, ring: '#D98A1B' },
      { id: 'A10', label: '10A', sub: 'F 10A', kinds: ['A10'], x: 250, y: 580, ring: '#D98A1B' }
    ],
    fuse: { mA: 0.5, A10: 10 },
    fuseLabel: { mA: '0,5 A', A10: '10 A' },
    shunt: { mA: 2, A10: 0.02 },
    buttons: [{ id: 'select', label: 'SELECT', x: 150, y: 452, w: 96, h: 30, fill: '#E9B72A', text: '#1b1b1b' }],
    groups: {
      v: { name: 'V', color: '#9CCBFF' }, mv: { name: 'mV', color: '#9CCBFF' },
      ohm: { name: 'Ω', color: '#8BE0A8' }, ma: { name: 'mA', color: '#FFB3A8' },
      a: { name: 'A', color: '#FFB3A8' }, off: { name: '', color: '#EDEFF1' }
    },
    positions: [
      pos('off', 'OFF', 'off', [{ fn: 'OFF' }]),
      pos('v', 'V ⎓ ~', 'v', [
        mode('V', 'V⎓', 'V', [range('V', 1, 3), range('V', 1, 2), range('V', 1, 1), range('V', 1, 0, { maxSI: 1000 })]),
        mode('V', 'V~', 'V', [range('V', 1, 3), range('V', 1, 2), range('V', 1, 1), range('V', 1, 0, { maxSI: 1000 })], { ac: true })
      ]),
      pos('mv', 'mV ⎓', 'mv', [mode('V', 'mV⎓', 'V', [range('mV', 1e3, 1)])]),
      pos('ohm', 'Ω ·))) →|', 'ohm', [
        mode('OHM', 'Ω', 'V', [range('Ω', 1, 1), range('kΩ', 1e-3, 3), range('kΩ', 1e-3, 2), range('kΩ', 1e-3, 1), range('MΩ', 1e-6, 3), range('MΩ', 1e-6, 2)]),
        mode('CONT', '·)))', 'V', [range('Ω', 1, 1, { maxSI: 400 })]),
        mode('DIODE', '→|', 'V', [range('V', 1, 3, { maxSI: 3 })])
      ]),
      pos('ma', 'µA mA', 'ma', [
        mode('A', 'µA/mA⎓', 'mA', [range('µA', 1e6, 1, { shunt: 1000 }), range('mA', 1e3, 3, { shunt: 100 }), range('mA', 1e3, 2, { shunt: 10 }), range('mA', 1e3, 1, { shunt: 1 })]),
        mode('A', 'µA/mA~', 'mA', [range('µA', 1e6, 1, { shunt: 1000 }), range('mA', 1e3, 3, { shunt: 100 }), range('mA', 1e3, 2, { shunt: 10 }), range('mA', 1e3, 1, { shunt: 1 })], { ac: true })
      ]),
      pos('a', 'A', 'a', [
        mode('A', 'A⎓', 'A10', [range('A', 1, 3, { shunt: 0.02 }), range('A', 1, 2, { maxSI: 10, shunt: 0.02 })]),
        mode('A', 'A~', 'A10', [range('A', 1, 3, { shunt: 0.02 }), range('A', 1, 2, { maxSI: 10, shunt: 0.02 })], { ac: true })
      ])
    ]
  };

  /* ======================= MM-700 : pro, teistsugune paigutus, sisendihoiatus ======================= */
  const m3 = {
    id: 'm3', name: 'MM-700', kind: 'Pro mõõtja',
    blurb: 'Täpsem TRMS-mõõtja. Pesad on teises järjekorras, RANGE-nupp lubab piirkonna käsitsi valida ja see hoiatab (LEAd), kui juhe on vales pesas.',
    cmax: 5999, olText: 'OL', gain: 0.0005, auto: true, inputAlert: true,
    look: { body: '#CBD0D5', bodyDark: '#9AA2AA', ink: '#1B2026', knob: '#E8EAEC', knobRing: '#7C858E', lcdBg: '#C4D0A8', accent: '#D13F3A', w: 300, h: 640 },
    lcd: { x: 28, y: 44, w: 244, h: 92 },
    dial: { cx: 150, cy: 282, r: 48, rLabel: 94 },
    jacks: [
      { id: 'A10', label: 'A', sub: '11A', kinds: ['A10'], x: 50, y: 584, ring: '#D13F3A' },
      { id: 'MA', label: 'mA µA', sub: '0,44A', kinds: ['mA'], x: 116, y: 584, ring: '#D13F3A' },
      { id: 'COM', label: 'COM', sub: '', kinds: ['COM'], x: 184, y: 584, ring: '#111111' },
      { id: 'VO', label: 'VΩ', sub: '', kinds: ['V'], x: 250, y: 584, ring: '#D13F3A' }
    ],
    fuse: { mA: 0.44, A10: 11 },
    fuseLabel: { mA: '0,44 A', A10: '11 A' },
    shunt: { mA: 2, A10: 0.02 },
    buttons: [
      { id: 'select', label: 'SELECT', x: 92, y: 458, w: 84, h: 30, fill: '#2E5FA8', text: '#ffffff' },
      { id: 'range', label: 'RANGE', x: 208, y: 458, w: 84, h: 30, fill: '#555E67', text: '#ffffff' }
    ],
    groups: {
      acv: { name: 'V~', color: '#6A2C91' }, dcv: { name: 'V⎓', color: '#0B4F8A' }, mv: { name: 'mV', color: '#0B4F8A' },
      ohm: { name: 'Ω', color: '#1B6B3A' }, ma: { name: 'mA', color: '#A12A1F' }, a: { name: 'A', color: '#A12A1F' },
      off: { name: '', color: '#1B2026' }
    },
    positions: [
      pos('off', 'OFF', 'off', [{ fn: 'OFF' }]),
      pos('vac', 'V~', 'acv', [mode('V', 'V~', 'V', [range('V', 1, 3), range('V', 1, 2), range('V', 1, 1), range('V', 1, 0, { maxSI: 1000 })], { ac: true })]),
      pos('vdc', 'V⎓', 'dcv', [mode('V', 'V⎓', 'V', [range('V', 1, 3), range('V', 1, 2), range('V', 1, 1), range('V', 1, 0, { maxSI: 1000 })])]),
      pos('mv', 'mV⎓', 'mv', [mode('V', 'mV⎓', 'V', [range('mV', 1e3, 1)])]),
      pos('ohm', 'Ω·)))→|', 'ohm', [
        mode('OHM', 'Ω', 'V', [range('Ω', 1, 1), range('kΩ', 1e-3, 3), range('kΩ', 1e-3, 2), range('kΩ', 1e-3, 1), range('MΩ', 1e-6, 3), range('MΩ', 1e-6, 2)]),
        mode('CONT', '·)))', 'V', [range('Ω', 1, 1, { maxSI: 600 })]),
        mode('DIODE', '→|', 'V', [range('V', 1, 3, { maxSI: 3 })])
      ]),
      pos('ma', 'µA mA', 'ma', [
        mode('A', 'µA/mA⎓', 'mA', [range('µA', 1e6, 1, { shunt: 1000 }), range('mA', 1e3, 3, { shunt: 100 }), range('mA', 1e3, 2, { shunt: 10 }), range('mA', 1e3, 1, { shunt: 1 })]),
        mode('A', 'µA/mA~', 'mA', [range('µA', 1e6, 1, { shunt: 1000 }), range('mA', 1e3, 3, { shunt: 100 }), range('mA', 1e3, 2, { shunt: 10 }), range('mA', 1e3, 1, { shunt: 1 })], { ac: true })
      ]),
      pos('a', 'A', 'a', [
        mode('A', 'A⎓', 'A10', [range('A', 1, 3, { shunt: 0.02 }), range('A', 1, 2, { maxSI: 10, shunt: 0.02 })]),
        mode('A', 'A~', 'A10', [range('A', 1, 3, { shunt: 0.02 }), range('A', 1, 2, { maxSI: 10, shunt: 0.02 })], { ac: true })
      ])
    ]
  };

  const METERS = { m1: m1, m2: m2, m3: m3 };

  /* nurgad: positsioonide nurgad (kraadid, päripäeva ülevalt) – ühtlaselt ringil */
  Object.keys(METERS).forEach(function (k) {
    const M = METERS[k];
    const n = M.positions.length;
    M.positions.forEach(function (p, i) { p.angle = i * 360 / n; });
    /* kasutaja nähtavad nimed */
    M.positions.forEach(function (p) {
      p.modes.forEach(function (m) {
        if (!m.ranges) return;
        m.ranges.forEach(function (r) {
          let fs = (r.maxSI !== undefined) ? r.maxSI * r.mult : (M.cmax + 1) / Math.pow(10, r.dec);
          fs = Math.round(fs * 1e6) / 1e6;
          r.fs = fs;
          r.fsLabel = String(fs).replace('.', ',') + ' ' + r.unit;
        });
      });
    });
  });

  /* ---------- oleku ja režiimi abifunktsioonid ---------- */
  function newState(M, opts) {
    opts = opts || {};
    return {
      dial: opts.dial || 0,
      modeSel: {},
      range: null,
      fuses: { mA: 'ok', A10: 'ok' }
    };
  }
  function currentMode(M, ms) {
    const p = M.positions[ms.dial];
    const mi = (ms.modeSel && ms.modeSel[ms.dial]) || 0;
    return p.modes[mi % p.modes.length];
  }
  function cycleMode(M, ms) {
    const p = M.positions[ms.dial];
    if (p.modes.length < 2) return false;
    ms.modeSel[ms.dial] = (((ms.modeSel[ms.dial] || 0) + 1) % p.modes.length);
    ms.range = null;
    return true;
  }
  function stepRange(M, ms) {
    const m = currentMode(M, ms);
    if (!m.ranges || m.ranges.length < 2 || !M.auto) return false;
    if (ms.range === null || ms.range === undefined) ms.range = 0;
    else { ms.range += 1; if (ms.range >= m.ranges.length) ms.range = null; }
    return true;
  }

  /* vali vahemik (auto: väikseim, kuhu väärtus mahub; käsitsi: üks fikseeritud) */
  function pickRange(M, m, ms, value) {
    const rs = m.ranges;
    if (!M.auto || (ms.range !== null && ms.range !== undefined)) {
      return Math.min(ms.range || 0, rs.length - 1);
    }
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      const counts = Math.round(Math.abs(value) * r.mult * Math.pow(10, r.dec));
      const limit = (r.maxSI !== undefined) ? Math.abs(value) <= r.maxSI * 1.0005 : counts <= M.cmax;
      if (limit && counts <= M.cmax) return i;
    }
    return rs.length - 1;
  }

  /* näit: { text, unit, ol, counts, rangeIdx, neg } */
  function display(M, m, ms, value) {
    const idx = pickRange(M, m, ms, value);
    const r = m.ranges[idx];
    const scale = Math.pow(10, r.dec);
    const shown = value * r.mult;
    const counts = Math.round(Math.abs(shown) * scale);
    let ol = false;
    if (r.maxSI !== undefined) ol = Math.abs(value) > r.maxSI * 1.0005;
    else ol = counts > M.cmax;
    if (ol) return { text: M.olText, unit: r.unit, ol: true, counts: counts, rangeIdx: idx, neg: false, fs: r.fsLabel };
    let txt = (counts / scale).toFixed(r.dec);
    const neg = shown < 0 && counts > 0 && !m.ac;
    return { text: (neg ? '-' : '') + txt, unit: r.unit, ol: false, counts: counts, rangeIdx: idx, neg: neg, fs: r.fsLabel };
  }

  return {
    list: ['m1', 'm2', 'm3'],
    get: function (id) { return METERS[id]; },
    all: METERS,
    newState: newState,
    currentMode: currentMode,
    cycleMode: cycleMode,
    stepRange: stepRange,
    pickRange: pickRange,
    display: display
  };
});
