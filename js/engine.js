/* Mõõtepink – vooluringi lahendaja ja mõõtmise mudel.
   - sõlmepotentsiaalide meetod (Kirchhoff + Ohm) koos LED-i (tükiti lineaarne) mudeliga
   - rikete süstimine (katkestus, lühis, vale väärtus, tühi aku, vastupidine LED ...)
   - multimeetri mudel: pesad, valikulüliti, piirkonnad, kaitsmed, koormus vooluringile */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./meters.js'));
  else root.Engine = factory(root.Meters);
})(typeof self !== 'undefined' ? self : this, function (Meters) {
  'use strict';

  const GMIN = 1e-12;
  const LED_RD = 10;
  const SW_RON = 0.02;
  const FUSE_R = 0.05;
  const V_INPUT_R = 10e6;
  const BIG_R = 1e12;

  /* ----------------- juhuarvud (seemnega, et õpetaja saaks kõigile sama rikke anda) ----------------- */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ----------------- vooluringi mudel ----------------- */
  function buildModel(circuit, cond) {
    cond = cond || {};
    const fault = cond.fault || null;
    const elems = circuit.elems.map(function (e) { return Object.assign({}, e); });
    const byId = {};
    elems.forEach(function (e) { byId[e.id] = e; });
    if (fault) {
      fault.mods.forEach(function (m, i) {
        if (m.add) {
          const e = Object.assign({ id: '_X' + i, hidden: true }, m.add);
          elems.push(e); byId[e.id] = e;
        } else {
          const e = byId[m.el];
          if (!e) throw new Error('Rike viitab tundmatule elemendile: ' + m.el);
          Object.assign(e, m.set || {});
        }
      });
    }
    /* punktid -> sõlmed (union-find) */
    const pts = Object.keys(circuit.points);
    const parent = {};
    pts.forEach(function (p) { parent[p] = p; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    const links = cond.links || {};
    elems.forEach(function (e) {
      if (e.type === 'wire') { if (!e.open) union(e.a, e.b); }
      else if (e.type === 'link') {
        const closed = (links[e.id] === undefined) ? true : !!links[e.id];
        e._closed = closed;
        if (closed && !e.open) union(e.a, e.b);
      }
    });
    const netIndex = {};
    let n = 0;
    const netOf = {};
    pts.forEach(function (p) {
      const r = find(p);
      if (netIndex[r] === undefined) netIndex[r] = n++;
      netOf[p] = netIndex[r];
    });
    /* harud */
    const sw = cond.switches || {};
    const branches = [];
    elems.forEach(function (e) {
      const a = netOf[e.a], b = netOf[e.b];
      switch (e.type) {
        case 'res': case 'motor': case 'adc': case 'lamp':
          if (e.open) return;
          branches.push({ id: e.id, type: 'res', a: a, b: b, R: Math.max(e.short ? 0.01 : e.R, 1e-3), el: e });
          break;
        case 'fuse':
          if (e.open) return;
          branches.push({ id: e.id, type: 'res', a: a, b: b, R: e.R || FUSE_R, el: e });
          break;
        case 'switch': {
          const closed = (sw[e.id] === undefined) ? (e.closed !== false) : !!sw[e.id];
          e._closed = closed;
          if (!closed || e.open) return;
          branches.push({ id: e.id, type: 'res', a: a, b: b, R: e.R || SW_RON, el: e });
          break;
        }
        case 'bat':
          branches.push({ id: e.id, type: 'bat', a: a, b: b, V: e.V, r: Math.max(e.r || 0.1, 1e-3), ac: !!e.ac, el: e });
          break;
        case 'led':
          if (e.open) return;
          if (e.reversed) branches.push({ id: e.id, type: 'led', a: b, b: a, Vf: e.Vf || 1.8, el: e, flip: true });
          else branches.push({ id: e.id, type: 'led', a: a, b: b, Vf: e.Vf || 1.8, el: e, flip: false });
          break;
        default: break;
      }
    });
    /* viide: esimese aku miinus */
    let ref = 0;
    const firstBat = elems.find(function (e) { return e.type === 'bat'; });
    if (firstBat) ref = netOf[firstBat.b];
    return { circuit: circuit, elems: elems, byId: byId, netOf: netOf, nNets: n, branches: branches, ref: ref };
  }

  /* ----------------- lineaarvõrrandisüsteem ----------------- */
  function gauss(A, b) {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let piv = i, max = Math.abs(A[i][i]);
      for (let r = i + 1; r < n; r++) { const v = Math.abs(A[r][i]); if (v > max) { max = v; piv = r; } }
      if (piv !== i) { const t = A[i]; A[i] = A[piv]; A[piv] = t; const tb = b[i]; b[i] = b[piv]; b[piv] = tb; }
      const d = A[i][i];
      if (Math.abs(d) < 1e-300) continue;
      for (let r = i + 1; r < n; r++) {
        const f = A[r][i] / d;
        if (f === 0) continue;
        for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
        b[r] -= f * b[i];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = b[i];
      for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
      x[i] = Math.abs(A[i][i]) < 1e-300 ? 0 : s / A[i][i];
    }
    return x;
  }

  /* opts: { acMode, meter:{a,b,R}, inject:{from,to,I}, noSources, ledOff } */
  function solve(model, opts) {
    opts = opts || {};
    const n = model.nNets, ref = model.ref;
    const idx = new Array(n);
    let N = 0;
    for (let i = 0; i < n; i++) idx[i] = (i === ref) ? -1 : N++;
    const ledOn = {};
    model.branches.forEach(function (br) { if (br.type === 'led') ledOn[br.id] = false; });
    let Vn = new Array(n).fill(0);

    for (let iter = 0; iter < 60; iter++) {
      const A = [];
      for (let i = 0; i < N; i++) A.push(new Array(N).fill(0));
      const rhs = new Array(N).fill(0);
      for (let i = 0; i < n; i++) if (idx[i] >= 0) A[idx[i]][idx[i]] += GMIN;
      const stampG = function (a, b, g) {
        const ia = idx[a], ib = idx[b];
        if (ia >= 0) A[ia][ia] += g;
        if (ib >= 0) A[ib][ib] += g;
        if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
      };
      const stampI = function (a, b, i) { /* vool i siseneb sõlme a ja väljub sõlmest b */
        if (idx[a] >= 0) rhs[idx[a]] += i;
        if (idx[b] >= 0) rhs[idx[b]] -= i;
      };
      model.branches.forEach(function (br) {
        if (br.type === 'res') stampG(br.a, br.b, 1 / br.R);
        else if (br.type === 'bat') {
          let V = br.V;
          if (opts.noSources) V = 0;
          else if (opts.acMode) V = br.ac ? V : 0;
          else V = br.ac ? 0 : V;
          const g = 1 / br.r;
          stampG(br.a, br.b, g);
          stampI(br.a, br.b, g * V);
        } else if (br.type === 'led') {
          if (!opts.ledOff && ledOn[br.id]) {
            const g = 1 / LED_RD;
            stampG(br.a, br.b, g);
            stampI(br.a, br.b, g * br.Vf);
          }
        }
      });
      if (opts.meter) stampG(opts.meter.a, opts.meter.b, 1 / opts.meter.R);
      if (opts.inject) stampI(opts.inject.from, opts.inject.to, opts.inject.I);
      const x = gauss(A, rhs);
      Vn = new Array(n).fill(0);
      for (let i = 0; i < n; i++) if (idx[i] >= 0) Vn[i] = x[idx[i]];
      let changed = false;
      model.branches.forEach(function (br) {
        if (br.type !== 'led' || opts.ledOff) return;
        const vak = Vn[br.a] - Vn[br.b];
        if (ledOn[br.id]) { if (vak < br.Vf) { ledOn[br.id] = false; changed = true; } }
        else if (vak > br.Vf + 1e-9) { ledOn[br.id] = true; changed = true; }
      });
      if (!changed) break;
    }
    /* harude voolud (a -> b suunas; akul: väljuv vool + klemmilt) */
    const I = {};
    model.branches.forEach(function (br) {
      const vab = Vn[br.a] - Vn[br.b];
      if (br.type === 'res') I[br.id] = vab / br.R;
      else if (br.type === 'bat') {
        let V = br.V;
        if (opts.noSources) V = 0; else if (opts.acMode) V = br.ac ? V : 0; else V = br.ac ? 0 : V;
        I[br.id] = (V - vab) / br.r;
      } else if (br.type === 'led') {
        const cur = (!opts.ledOff && ledOn[br.id]) ? (vab - br.Vf) / LED_RD : 0;
        I[br.id] = br.flip ? -cur : cur; /* a->b suund elemendi enda definitsiooni järgi */
      }
    });
    return { V: Vn, I: I, ledOn: ledOn, ref: ref };
  }

  /* ----------------- abi: mõõtmise koormus ----------------- */
  function jackById(M, id) { return M.jacks.find(function (j) { return j.id === id; }) || null; }
  function jackKindsFor(M, id) { const j = id ? jackById(M, id) : null; return j ? j.kinds : null; }
  function currentKind(kinds) { /* milline vooluliik see pesa on */
    if (!kinds) return null;
    if (kinds.indexOf('A10') >= 0) return 'A10';
    if (kinds.indexOf('mA') >= 0) return 'mA';
    return null;
  }

  const FLAG = {
    fuse_blown: ['error', 'Kaitse põles läbi! Vool oli suurem, kui see pesa talub. Vooluring katkes ja see mõõtmine ei näita midagi.'],
    fuse_dead: ['error', 'Selle pesa kaitse on läbi põlenud, seetõttu ei jõua signaal mõõtjasse. Vaheta kaitse.'],
    volt_in_current_jack: ['error', 'Punane juhe oli voolupesas, kuigi mõõtja ei olnud voolurežiimis. Voolupesa on peaaegu lühis – pinget ja takistust mõõdetakse VΩ-pesast.'],
    wrong_jack_current: ['error', 'Voolu mõõtmiseks pole punane juhe õiges voolupesas, mõõtja pole vooluringiga ühendatud. Vaata, millise pesa juures on kirjas mA/µA või 10A.'],
    wrong_jack_other: ['error', 'Pinge ja takistuse mõõtmiseks kasuta VΩ-pesa.'],
    no_com: ['error', 'COM-pesas pole juhet – mõõteahel pole suletud, seetõttu see näit ei tähenda midagi.'],
    ohm_powered: ['error', 'Vooluringis oli pinge. Takistust mõõdetakse alati vooluta: lülita toide välja ja mõõda uuesti.'],
    ol: ['error', 'Näit ületab piirkonna (OL). Vali suurem piirkond.'],
    ol_open: ['info', 'OL: takistus on suurem kui mõõtja suurim piirkond – ahel on katki (praktiliselt lõpmatu takistus).'],
    range_big: ['warn', 'Piirkond on liiga suur – näidul on vähe numbreid. Vali väiksem piirkond, siis on näit täpsem.'],
    ac_dc: ['error', 'Mõõtja oli vales režiimis: alalispinge (⎓) ja vahelduvpinge (~) tuleb õigesti valida.'],
    reverse: ['info', 'Negatiivne märk: punane sond oli madalama potentsiaaliga punktis kui must.'],
    same_net: ['info', 'Mõlemad sondid on samas elektrilises punktis (nende vahel on ainult juhe või suletud jumper) – seal pole pinget.'],
    same_net_a: ['error', 'Mõlemad sondid on ühes elektrilises punktis: vool läheb jumperi kaudu mõõtjast mööda. Ava jumper ja ühenda mõõtja selle asemele.'],
    lead_alert: ['error', 'LEAd – mõõtja hoiatab: juhe on selle funktsiooni jaoks vales pesas.']
  };
  function mkFlag(code) { return { code: code, severity: FLAG[code][0], text: FLAG[code][1] }; }

  /* piirkonna sobivuse hindamine: kas leidub väiksem (täpsem) / suurem (mahutav) piirkond */
  function fits(M, r, value) {
    const counts = Math.round(Math.abs(value) * r.mult * Math.pow(10, r.dec));
    if (r.maxSI !== undefined) return Math.abs(value) <= r.maxSI * 1.0005;
    return counts <= M.cmax;
  }
  function familyRanges(M, ms, m) {
    const list = [];
    if (M.auto) { m.ranges.forEach(function (r) { list.push(r); }); return list; }
    const cur = M.positions[ms.dial];
    M.positions.forEach(function (p) {
      const pm = p.modes[0];
      if (!pm.ranges || p.group !== cur.group) return;
      if (pm.fn !== m.fn || !!pm.ac !== !!m.ac) return;
      pm.ranges.forEach(function (r) { list.push(r); });
    });
    return list;
  }
  function rangeInfo(M, ms, m, value, dispRange) {
    const fam = familyRanges(M, ms, m);
    const cur = dispRange;
    const counts = Math.round(Math.abs(value) * cur.mult * Math.pow(10, cur.dec));
    const curFits = fits(M, cur, value);
    let smaller = false, larger = false;
    fam.forEach(function (r) {
      if (r === cur) return;
      if (r.fs < cur.fs && fits(M, r, value)) smaller = true;
      if (r.fs > cur.fs && fits(M, r, value)) larger = true;
    });
    return { counts: counts, curFits: curFits, smallerBetter: curFits && counts < 100 && smaller, largerNeeded: !curFits && larger };
  }

  /* seadistuse kirjeldus (kas mõõtmine on üldse võimalik?) */
  function setup(a) {
    const M = Meters.get(a.meterId);
    const ms = a.ms;
    const m = Meters.currentMode(M, ms);
    const out = { M: M, m: m, state: 'ok' };
    if (m.fn === 'OFF') { out.state = 'off'; return out; }
    const plugs = a.plugs, tips = a.tips;
    if (!plugs.red || !plugs.black) { out.state = 'blocked'; out.block = 'plug'; return out; }
    if (!tips.red || !tips.black) { out.state = 'blocked'; out.block = 'tip'; return out; }
    const kindsRed = jackKindsFor(M, plugs.red), kindsBlack = jackKindsFor(M, plugs.black);
    let comLead = null, actLead = null;
    if (kindsRed.indexOf('COM') >= 0) { comLead = 'red'; actLead = 'black'; }
    else if (kindsBlack.indexOf('COM') >= 0) { comLead = 'black'; actLead = 'red'; }
    out.comLead = comLead; out.actLead = actLead;
    out.actJackId = comLead ? plugs[actLead] : null;
    out.noCom = !comLead;
    return out;
  }

  function acDcOther(model, netAct, netCom, mode) {
    const other = solve(model, { acMode: !mode.ac });
    return Math.abs(other.V[netAct] - other.V[netCom]);
  }

  /* Mõõtmine. a = {circuit, cond, meterId, ms, plugs:{red,black}, tips:{red,black}}
     Tagastab alati ka `live` (elav vooluring koos mõõtja koormusega) ja `model`. */
  function measure(a) {
    const S = setup(a);
    const M = S.M, m = S.m, ms = a.ms;
    const model = buildModel(a.circuit, a.cond);
    const res = { state: S.state, block: S.block || null, flags: [], fn: m.fn, tag: m.tag || '', modeAc: !!m.ac,
      value: 0, trueValue: 0, disp: null, quality: 'good', fuseBlown: null, beep: false, amp: null,
      acrossElems: [], seriesElems: [], netAct: null, netCom: null, ptAct: null, ptCom: null,
      meterId: a.meterId, model: model, live: null, rangeIdx: 0 };
    if (S.state !== 'ok') { res.live = solve(model, {}); return res; }

    const flags = res.flags;
    if (S.noCom) {
      flags.push(mkFlag('no_com'));
      res.disp = openDisplay(M, m, ms);
      res.live = solve(model, {});
      return done(res);
    }
    const netAct = model.netOf[a.tips[S.actLead]], netCom = model.netOf[a.tips[S.comLead]];
    res.netAct = netAct; res.netCom = netCom;
    res.ptAct = a.tips[S.actLead]; res.ptCom = a.tips[S.comLead];
    const actKinds = jackKindsFor(M, S.actJackId);
    const curKind = currentKind(actKinds);
    const jackOK = actKinds.indexOf(m.jack) >= 0;
    const ohmLike = (m.fn === 'OHM' || m.fn === 'CONT' || m.fn === 'DIODE');

    if (M.inputAlert && !jackOK) flags.push(mkFlag('lead_alert'));

    /* ---------- PINGE ---------- */
    if (m.fn === 'V') {
      let load = null, openInput = false;
      if (jackOK) load = { a: netAct, b: netCom, R: V_INPUT_R };
      else if (curKind) {
        if (ms.fuses[curKind] === 'blown') { openInput = true; flags.push(mkFlag('fuse_dead')); }
        else { load = { a: netAct, b: netCom, R: M.shunt[curKind] }; flags.push(mkFlag('volt_in_current_jack')); }
      } else { openInput = true; flags.push(mkFlag('wrong_jack_other')); }
      let sol = solve(model, { acMode: m.ac, meter: openInput ? null : load });
      let v = openInput ? 0 : sol.V[netAct] - sol.V[netCom];
      if (!openInput && !jackOK && curKind && netAct !== netCom) {
        if (Math.abs(v / load.R) > M.fuse[curKind]) {
          res.fuseBlown = curKind; flags.push(mkFlag('fuse_blown'));
          sol = solve(model, { acMode: m.ac }); v = 0;
        }
      }
      res.live = sol; res.sol = sol;
      res.trueValue = v;
      if (m.ac) v = Math.abs(v);
      res.value = v * (1 + M.gain);
      res.disp = Meters.display(M, m, ms, res.value);
      res.rangeIdx = res.disp.rangeIdx;
      if (!openInput && jackOK) {
        if (netAct === netCom) flags.push(mkFlag('same_net'));
        else {
          const ri = rangeInfo(M, ms, m, v, m.ranges[res.disp.rangeIdx]);
          if (res.disp.ol || ri.largerNeeded) flags.push(mkFlag('ol'));
          else if (ri.smallerBetter) flags.push(mkFlag('range_big'));
          const other = acDcOther(model, netAct, netCom, m);
          if (other > Math.max(0.05, Math.abs(v) * 0.2)) flags.push(mkFlag('ac_dc'));
          else if (res.disp.neg) flags.push(mkFlag('reverse'));
        }
      }
      res.acrossElems = describeNets(model, netAct, netCom);
      return done(res);
    }

    /* ---------- VOOL ---------- */
    if (m.fn === 'A') {
      if (!jackOK || ms.fuses[m.jack] === 'blown') {
        flags.push(mkFlag(jackOK ? 'fuse_dead' : 'wrong_jack_current'));
        res.live = solve(model, { acMode: m.ac });
        res.disp = Meters.display(M, m, ms, 0);
        return done(res);
      }
      if (netAct === netCom) {
        flags.push(mkFlag('same_net_a'));
        res.live = solve(model, { acMode: m.ac });
        res.disp = Meters.display(M, m, ms, 0);
        return done(res);
      }
      const autoMode = M.auto && (ms.range === null || ms.range === undefined);
      let rIdx = M.auto ? (autoMode ? m.ranges.length - 1 : ms.range) : 0;
      let sol = null, I = 0;
      for (let k = 0; k < 6; k++) {
        const R = m.ranges[rIdx].shunt || M.shunt[m.jack];
        sol = solve(model, { acMode: m.ac, meter: { a: netAct, b: netCom, R: R } });
        I = (sol.V[netAct] - sol.V[netCom]) / R;
        if (!autoMode) break;
        const want = Meters.pickRange(M, m, ms, I);
        if (want === rIdx) break;
        rIdx = want;
      }
      if (Math.abs(I) > M.fuse[m.jack]) {
        res.fuseBlown = m.jack; flags.push(mkFlag('fuse_blown'));
        sol = solve(model, { acMode: m.ac }); I = 0;
      }
      res.live = sol; res.sol = sol;
      res.trueValue = I; res.amp = I;
      const v = m.ac ? Math.abs(I) : I;
      res.value = v * (1 + M.gain);
      res.disp = Meters.display(M, m, ms, res.value);
      res.rangeIdx = res.disp.rangeIdx;
      if (!res.fuseBlown) {
        if (Math.abs(I) > 1e-7) {
          model.branches.forEach(function (br) {
            if (br.type === 'bat') return;
            const ci = sol.I[br.id];
            if (ci !== undefined && Math.abs(Math.abs(ci) - Math.abs(I)) <= 0.02 * Math.abs(I) + 1e-9) res.seriesElems.push(br.id);
          });
        }
        const ri = rangeInfo(M, ms, m, v, m.ranges[res.disp.rangeIdx]);
        if (res.disp.ol || ri.largerNeeded) flags.push(mkFlag('ol'));
        else if (ri.smallerBetter) flags.push(mkFlag('range_big'));
        if (!m.ac && res.disp.neg) flags.push(mkFlag('reverse'));
      }
      return done(res);
    }

    /* ---------- TAKISTUS / PIIKS / DIOOD ---------- */
    if (ohmLike) {
      if (!jackOK) {
        flags.push(mkFlag('wrong_jack_other'));
        res.live = solve(model, {});
        res.disp = openDisplay(M, m, ms);
        return done(res);
      }
      const base = solve(model, { acMode: false });
      const baseAc = solve(model, { acMode: true });
      res.live = base;
      const vlive = Math.max(Math.abs(base.V[netAct] - base.V[netCom]), Math.abs(baseAc.V[netAct] - baseAc.V[netCom]));
      const powered = vlive > 0.1;
      const It = (m.fn === 'DIODE') ? 1e-3 : 1e-4;
      const sol = solve(model, { noSources: true, ledOff: m.fn !== 'DIODE', inject: { from: netAct, to: netCom, I: It } });
      let val = (m.fn === 'DIODE') ? (sol.V[netAct] - sol.V[netCom]) : (sol.V[netAct] - sol.V[netCom]) / It;
      if (netAct === netCom) { val = 0; if (m.fn !== 'DIODE') flags.push(mkFlag('same_net')); }
      if (val > 1e11) val = 1e12;
      if (powered) {
        val = (m.fn === 'DIODE') ? (vlive + Math.abs(val)) : (vlive / It + Math.abs(val));
        flags.push(mkFlag('ohm_powered'));
      }
      res.trueValue = val;
      res.value = val * (1 + M.gain);
      res.disp = Meters.display(M, m, ms, res.value);
      res.rangeIdx = res.disp.rangeIdx;
      if (m.fn === 'CONT') res.beep = (!powered && val < 30);
      if (m.fn === 'DIODE') res.beep = (!powered && val < 0.05 && netAct !== netCom);
      if (!powered && m.fn === 'OHM') {
        const ri = rangeInfo(M, ms, m, val, m.ranges[res.disp.rangeIdx]);
        if (res.disp.ol || ri.largerNeeded) flags.push(mkFlag(ri.largerNeeded ? 'ol' : 'ol_open'));
        else if (ri.smallerBetter) flags.push(mkFlag('range_big'));
      }
      res.acrossElems = describeNets(model, netAct, netCom);
      return done(res);
    }
    return done(res);
  }

  function done(res) {
    res.quality = res.flags.some(function (f) { return f.severity === 'error'; }) ? 'bad' : 'good';
    return res;
  }

  function openDisplay(M, m, ms) {
    const open = (m.fn === 'OHM' || m.fn === 'CONT' || m.fn === 'DIODE');
    const d = Meters.display(M, m, ms, open ? 1e12 : 0);
    if (open) { d.ol = true; d.text = M.olText; }
    return d;
  }

  /* kirjeldab elemente, mille otsad on need sõlmed (kasutajale: "R2 peal") */
  function describeNets(model, netA, netB) {
    const ids = [];
    model.elems.forEach(function (e) {
      if (e.type === 'wire' || e.type === 'link' || e.hidden) return;
      const na = model.netOf[e.a], nb = model.netOf[e.b];
      if ((na === netA && nb === netB) || (na === netB && nb === netA)) ids.push(e.id);
    });
    return ids;
  }

  /* ADC väärtus 0..1023 (5 V viide) */
  function adcValue(model, sol, elId) {
    const e = model.byId[elId];
    const v = sol.V[model.netOf[e.a]] - sol.V[model.netOf[e.b]];
    return Math.max(0, Math.min(1023, Math.round(v / 5 * 1023)));
  }

  /* sama seadistus terves vooluringis (ennustuse hindamiseks) */
  function healthy(a) {
    return measure(Object.assign({}, a, { cond: Object.assign({}, a.cond, { fault: null }) }));
  }

  return {
    rng: rng, buildModel: buildModel, solve: solve, measure: measure,
    healthy: healthy, describeNets: describeNets, adcValue: adcValue, FLAG: FLAG,
    consts: { LED_RD: LED_RD, SW_RON: SW_RON, V_INPUT_R: V_INPUT_R }
  };
});
