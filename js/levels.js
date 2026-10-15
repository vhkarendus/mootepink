/* Mõõtepink – tasemed (õppeülesanded ja rikkeotsing). Tekst eesti keeles.
   Treeningtasemed (T): mõõtmisülesanded + vastused. Rikketasemed (F): ennusta, mõõda, diagnoosi. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./circuits.js'));
  else root.Levels = factory(root.Circuits);
})(typeof self !== 'undefined' ? self : this, function (Circuits) {
  'use strict';

  function pick(rand, arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; }
  function kohm(R) { return Circuits.fmtR(R); }
  function fmtN(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ','); }

  const LEVELS = [];

  /* ======================================================= T1 ======================================================= */
  LEVELS.push({
    id: 'T1', kind: 'train', title: 'Pinge mõõtmine',
    summary: 'Aku, takisti ja LED: kuhu panna punane ja kuhu must sond?',
    meters: ['m1'],
    start: { mode: 'clean' },
    build: function () { return { circuit: Circuits.led({ acLoop: true, R: 470 }), params: {} }; },
    story: function () {
      return [
        'Laual on 9 V aku, lüliti, takisti ja LED ning eraldi väike trafo. Pinge on kahe punkti potentsiaalide vahe, seepärast ühendad pingemõõtja mõõdetava osaga rööbiti – vooluringi katkestama ei pea.',
        'Seadista mõõtja ise: punane juhe ja must juhe õigetesse pesadesse, valikulüliti õigesse asendisse ja piirkond nii, et näit mahub ära, aga numbreid on võimalikult palju.',
        'Lohista sondid mõõtepunktidele (või klõpsa sondil ja seejärel mõõtepunktil). Punane sond läheb + poolele, must madalama potentsiaaliga poolele.'
      ];
    },
    tasks: [
      { id: 't1', text: 'Mõõda aku pinge (alalispinge V⎓).', spec: { kind: 'V', across: 'BAT', positive: true } },
      { id: 't2', text: 'Mõõda pinge takisti R1 peal.', spec: { kind: 'V', across: 'R1', positive: true } },
      { id: 't3', text: 'Mõõda pinge LED-i peal.', spec: { kind: 'V', across: 'LED1', positive: true } },
      { id: 't4', text: 'Mõõda trafo vahelduvpinge (V~).', spec: { kind: 'V', across: 'TR', ac: true } }
    ],
    hints: [
      'Kui näit on negatiivne, on punane sond madalama potentsiaaliga punktis kui must. Vaheta sondid.',
      'Piirkond: vali väikseim, kuhu mõõdetav pinge veel mahub. 9 V jaoks sobib 20 V piirkond (2 V piirkonnas oleks OL).'
    ],
    quiz: {
      q: 'Miks ühendatakse pingemõõtja mõõdetava osaga rööbiti?',
      options: [
        'Sest siis läbib mõõtjat kogu vooluringi vool.',
        'Sest pinge on kahe punkti vahe: mõõtja tuleb panna just nende kahe punkti vahele ja ahelat pole vaja lahti võtta.',
        'Sest siis on näit alati positiivne.'
      ],
      correct: 1,
      explain: 'Pingemõõtja sisetakistus on väga suur (siin 10 MΩ), nii et tema kaudu läheb peaaegu null voolu ja vooluring ei muutu. Seetõttu saab pinget mõõta töötavas vooluringis.'
    }
  });

  /* ======================================================= T2 ======================================================= */
  LEVELS.push({
    id: 'T2', kind: 'train', title: 'Takistuse mõõtmine',
    summary: 'Takistust mõõdetakse alati vooluta. Mida näitab dioodirežiim?',
    meters: ['m1'],
    start: { mode: 'clean' },
    build: function () { return { circuit: Circuits.led({ R: 470 }), params: {} }; },
    story: function () {
      return [
        'Takistust mõõdab multimeeter ise: ta saadab väikese voolu läbi mõõdetava osa ja arvutab takistuse. Seepärast peab vooluring olema vooluta – lülita toide lülitiga välja (klõpsa lülitil).',
        'Kui vooluringis on pinge, on näit vale. Kui mõõdetava takisti kõrval on teised teed, loeb mõõtja neid ka kaasa.',
        'Dioodirežiimis (→|) saadab mõõtja 1 mA voolu ja näitab pingelangu. LED-i puhul on see ligikaudu LED-i päripinge. Vastupidi ühendatud LED-i puhul näitab mõõtja ületäitumist.'
      ];
    },
    tasks: [
      { id: 't1', text: 'Mõõda takisti R1 takistus.', spec: { kind: 'R', across: 'R1' } },
      { id: 't2', text: 'Mõõda LED-i päripinge dioodirežiimis (→|). Punane sond läheb anoodile, see on kolmnurga lai külg.', spec: { kind: 'DIODE', across: 'LED1', nonOL: true } }
    ],
    hints: [
      'Lülita enne mõõtmist toide välja: klõpsa lülitil, kuni sellel on kirjas VÄLJAS.',
      'Takistuse piirkond peab olema suurem kui mõõdetav takistus. 470 Ω jaoks sobib 2k piirkond.'
    ],
    quiz: {
      q: 'Miks tohib takistust mõõta ainult vooluta vooluringis?',
      options: [
        'Sest vooluga on takistus teistsugune.',
        'Sest mõõtja saadab ise voolu ja vooluringi enda pinge moonutab tulemust (ja võib mõõtjat rikkuda).',
        'Sest siis tuleb näit alati negatiivne.'
      ],
      correct: 1,
      explain: 'Takistus ei sõltu vooluringi pingest, aga mõõtja arvutab selle ise tekitatud voolust. Kõrvaline pinge lisab voolu ja näit läheb valeks.'
    }
  });

  /* ======================================================= T3 ======================================================= */
  LEVELS.push({
    id: 'T3', kind: 'train', title: 'Voolu mõõtmine',
    summary: 'Ahel tuleb avada ja mõõtja panna jadas. Eelmine kasutaja jättis mõõtja valesti.',
    meters: ['m1'],
    start: { mode: 'fixed', fixed: { m1: { dial: 'v20', red: 'A10', black: 'COM' } } },
    build: function () { return { circuit: Circuits.led({ R: 470 }), params: {} }; },
    story: function () {
      return [
        'Voolu mõõtmiseks peab kogu vool läbima mõõtjat: ava ahel ja pane mõõtja ahelasse jadas.',
        'Ahela saad avada jumperist (J1 või J2) või lülitist: klõpsa sellel. Siis tekib kaks mõõtepunkti. Pane punane sond sinna, kust vool tuleb (aku + poolelt), must sond teisele poole.',
        'Eelmine kasutaja jättis mõõtja pooleli. Kontrolli enne mõõtmist pesasid ja valikulülitit. Voolu mõõdetakse voolupesa kaudu, pinget aga pingepesa kaudu.'
      ];
    },
    tasks: [
      { id: 't1', text: 'Mõõda vool, mis läbib takistit R1 (ava jumper J1).', spec: { kind: 'I', through: 'R1', at: 'J1', positive: true } },
      { id: 't2', text: 'Mõõda sama vool jumperi J2 kohalt. Võrdle kahte näitu.', spec: { kind: 'I', through: 'R1', at: 'J2', positive: true } }
    ],
    hints: [
      'Voolu mõõtmiseks vali valikulülitil A⎓ piirkond ja pane punane juhe pessa VΩmA (see on kuni 200 mA jaoks).',
      'LED-i vool on mõne mA kuni mõne kümne mA. 20m piirkond annab täpsema näidu kui 200m.'
    ],
    quiz: {
      q: 'Miks on vool jadaahelas igas kohas sama?',
      options: [
        'Sest laengud ei kao ega teki: mis ühest otsast sisse läheb, tuleb teisest välja (Kirchhoffi vooluseadus).',
        'Sest takistid kulutavad voolu ära.',
        'Sest aku annab alati ühesuguse voolu.'
      ],
      correct: 0,
      explain: 'Igasse sõlme sissevoolavate voolude summa võrdub väljavoolavate summaga. Jadaahelas on igas sõlmes üks sisse- ja üks väljavool, seega on need võrdsed.'
    }
  });

  /* ======================================================= T4 ======================================================= */
  LEVELS.push({
    id: 'T4', kind: 'train', title: 'Ohmi seadus',
    summary: 'Tundmatu takisti: mõõda U ja I, arvuta R = U ÷ I ning kontrolli.',
    meters: ['m1', 'm2'],
    start: { mode: 'clean' },
    build: function (rand) {
      const R = pick(rand, [1000, 1200, 1500, 1800, 2200, 2700, 3300]);
      return { circuit: Circuits.ohm({ R: R, V: 12 }), params: { R: R } };
    },
    story: function () {
      return [
        'Takisti R1 väärtus on sul teadmata. Mõõda pinge selle peal ja vool selle kaudu, siis arvuta takistus Ohmi seaduse järgi: R = U ÷ I.',
        'Lõpuks kontrolli tulemust otse takistusrežiimis (toide väljas).',
        'Selles tasemes võid valida ka teise mõõtja (automaatne piirkond).'
      ];
    },
    tasks: [
      { id: 't1', text: 'Mõõda pinge R1 peal.', spec: { kind: 'V', across: 'R1', positive: true } },
      { id: 't2', text: 'Mõõda vool R1 kaudu.', spec: { kind: 'I', through: 'R1', positive: true } },
      { id: 't3', text: 'Arvuta takistus R1 = U ÷ I.', answer: { unit: 'kΩ', expect: function (c) { return c.params.R / 1000; }, rel: 0.06 } },
      { id: 't4', text: 'Kontrolli: mõõda R1 takistusrežiimis (toide väljas).', spec: { kind: 'R', across: 'R1' } }
    ],
    hints: [
      'Voolu mõõtmiseks ava jumper J1 või J2 ja pane mõõtja selle asemele. Pinget ja voolu saab mõõta kordamööda.',
      'Näites: U = 12 V ja I = 8 mA annab R = 12 V ÷ 0,008 A = 1500 Ω = 1,5 kΩ.'
    ],
    quiz: {
      q: 'Takisti pinge kahekordistub (takistus jääb samaks). Mis juhtub vooluga?',
      options: ['Vool kahekordistub.', 'Vool poolitub.', 'Vool jääb samaks.'],
      correct: 0,
      explain: 'Ohmi seadus: I = U ÷ R. Kui R ei muutu, on vool pingega otse võrdeline.'
    }
  });

  /* ======================================================= T5 ======================================================= */
  LEVELS.push({
    id: 'T5', kind: 'train', title: 'Kirchhoffi pingeseadus',
    summary: 'Jadaühendus: pingelangud takistitel annavad kokku toitepinge.',
    meters: ['m1', 'm2'],
    start: { mode: 'clean' },
    build: function (rand) {
      const set = pick(rand, [[1000, 2200, 3300], [1200, 1800, 2700], [680, 1500, 2200], [1500, 1500, 3900]]);
      return { circuit: Circuits.series3({ V: 12, R1: set[0], R2: set[1], R3: set[2] }), params: { set: set } };
    },
    story: function () {
      return [
        'Kolm takistit on jadas. Igaühel on oma pingelang, aga vool on sama. Kirchhoffi pingeseadus: kinnises ahelas on pingelangude summa võrdne toitepingega.',
        'Mõõda pinge iga takisti peal ja aku klemmidel. Seejärel liida takistite pinged kokku.'
      ];
    },
    tasks: [
      { id: 't1', text: 'Mõõda pinge R1 peal.', spec: { kind: 'V', across: 'R1', positive: true } },
      { id: 't2', text: 'Mõõda pinge R2 peal.', spec: { kind: 'V', across: 'R2', positive: true } },
      { id: 't3', text: 'Mõõda pinge R3 peal.', spec: { kind: 'V', across: 'R3', positive: true } },
      { id: 't4', text: 'Mõõda aku pinge.', spec: { kind: 'V', across: 'BAT', positive: true } },
      { id: 't5', text: 'Liida kokku U1 + U2 + U3.', answer: { unit: 'V', expect: function (c) { return c.vAcross('R1') + c.vAcross('R2') + c.vAcross('R3'); }, abs: 0.3 } }
    ],
    hints: [
      'Pinget ei pea ahelat avamata mõõtma: pane sondid takisti kummalegi otsale.',
      'Mõõdetud pingete summa võib toitepingest veidi erineda mõõtja täpsuse ja ümardamise tõttu.'
    ],
    quiz: {
      q: 'Kolm takistit on jadas. Mis juhtub R3 pingelanguga, kui R3 takistust suurendada?',
      options: ['Suureneb: R3 saab suurema osa toitepingest.', 'Väheneb.', 'Jääb samaks.'],
      correct: 0,
      explain: 'Jadaahelas jaguneb toitepinge takistuste vahekorras. Suurem takistus tähendab suuremat pingelangu, sest vool on kõigil sama (U = I · R).'
    }
  });

  /* ======================================================= T6 ======================================================= */
  LEVELS.push({
    id: 'T6', kind: 'train', title: 'Kirchhoffi vooluseadus',
    summary: 'Rööpühendus: harude voolud annavad kokku peaharu voolu.',
    meters: ['m1', 'm2'],
    start: { mode: 'clean' },
    build: function (rand) {
      const set = pick(rand, [[1000, 680, 470], [1200, 820, 560], [1500, 1000, 680], [820, 1200, 560]]);
      return { circuit: Circuits.parallel3({ V: 9, R1: set[0], R2: set[1], R3: set[2] }), params: { set: set } };
    },
    story: function () {
      return [
        'Kolm takistit on rööbiti. Igaühel on sama pinge, aga vool jaguneb. Kirchhoffi vooluseadus: sõlme sissevoolavate voolude summa on võrdne väljavoolavate voolude summaga.',
        'Iga haru ja peaharu juures on jumper (J1, J2, J3 ja Jm). Ava üks jumper korraga ja pane mõõtja selle asemele.',
        'Teised harud töötavad edasi, kui mõõtja on ühes harus.'
      ];
    },
    tasks: [
      { id: 't1', text: 'Mõõda vool läbi R1 (jumper J1).', spec: { kind: 'I', through: 'R1', at: 'J1', positive: true } },
      { id: 't2', text: 'Mõõda vool läbi R2 (jumper J2).', spec: { kind: 'I', through: 'R2', at: 'J2', positive: true } },
      { id: 't3', text: 'Mõõda vool läbi R3 (jumper J3).', spec: { kind: 'I', through: 'R3', at: 'J3', positive: true } },
      { id: 't4', text: 'Mõõda peaharu vool (jumper Jm).', spec: { kind: 'I', through: 'SW', at: 'Jm', positive: true } },
      { id: 't5', text: 'Liida kokku I1 + I2 + I3.', answer: { unit: 'mA', expect: function (c) { return (c.iThrough('R1') + c.iThrough('R2') + c.iThrough('R3')) * 1000; }, rel: 0.06 } }
    ],
    hints: [
      'Ammeeter käib alati jadas. Kui jumper on kinni, läheb vool jumperi kaudu mõõtjast mööda. Ava see enne.',
      'Peaharu vool on suurem kui iga haru vool. Kui ületad piirkonna (OL), vali suurem piirkond.'
    ],
    quiz: {
      q: 'Jumper J2 avatakse (haru 2 katkeb). Mis juhtub peaharu vooluga?',
      options: ['Väheneb haru 2 voolu võrra.', 'Ei muutu.', 'Suureneb.'],
      correct: 0,
      explain: 'Peaharu vool on harude voolude summa. Kui üks haru katkeb, kaob selle vool ja kogu vool väheneb sama palju.'
    }
  });

  /* ============================================= RIKKETASEMED ============================================= */

  /* ---------- F1: LED ei põle ---------- */
  LEVELS.push({
    id: 'F1', kind: 'fault', title: 'LED ei põle',
    summary: 'Seitse võimalikku riket. Ennusta, mõõda ja leia õige.',
    meters: ['m1', 'm2'],
    start: { mode: 'random' },
    budget: 8, par: 4,
    build: function () { return { circuit: Circuits.led({ R: 470 }), params: {} }; },
    story: function () {
      return [
        'Klient tõi lauale väikese vooluringi: 9 V aku, lüliti, 470 Ω takisti ja punane LED. Lüliti on sees, aga LED ei põle.',
        'Sinu ülesanne: leia rike. Enne iga mõõtmist ennusta, mida terves vooluringis näeksid. Kui näit erineb, oled rikkele jälil.',
        'Mõõtja on eelmise kasutaja järgi suvalises seisus: kontrolli seadistus.'
      ];
    },
    hints: [
      'Alusta toitest: kas aku klemmidel on üldse pinge? Pinget saab mõõta ahelat avamata.',
      'Kui pinge on olemas, aga LED ei põle, on ahel kuskilt katki või LED ei juhi. Otsi, kus pingelang on ootamatult suur või null.',
      'Kui kogu pinge on LED-i peal, aga ahel on mujal terve, proovi LED-i dioodirežiimis (→|, toide väljas) mõlemas sondisuunas.'
    ],
    observables: function (sol) { return [Math.abs(sol.I.LED1 || 0) * 1000]; },
    faults: [
      { id: 'led_rev', label: 'LED on valepidi ühendatud', mods: [{ el: 'LED1', set: { reversed: true } }],
        explain: 'LED on diood: see juhib voolu ainult ühes suunas. Valepidi ühendatud LED-i kaudu vool ei liigu, nii et kogu aku pinge langeb selle peale. Läbi põlenud LED-ist eristab seda dioodirežiim: valepidi LED juhib ühes sondisuunas (näit ligikaudu 1,8 V) ja teises mitte, katkine LED ei juhi kummaski suunas (OL).' },
      { id: 'led_open', label: 'LED on läbi põlenud', mods: [{ el: 'LED1', set: { open: true } }],
        explain: 'Läbi põlenud LED on katkestus: vool puudub, ahel on katkine just LED-i kohalt ja kogu pinge langeb selle peale. Dioodirežiimis näitab mõõtja mõlemas sondisuunas OL.' },
      { id: 'r_open', label: 'Takisti R1 on katki', mods: [{ el: 'R1', set: { open: true } }],
        explain: 'Katkine takisti katkestab ahela. Vool puudub ja LED-i pingelang on null, sest LED-i kaudu vool ei liigu.' },
      { id: 'bat_dead', label: 'Aku on tühi', mods: [{ el: 'BAT', set: { V: 1.3, r: 6 } }],
        explain: 'Tühja aku pinge on LED-i päripingest väiksem: vool ei hakka voolama. Rike paistab juba aku klemmidelt mõõtes.' },
      { id: 'sw_bad', label: 'Lüliti ei sulgu (halb kontakt)', mods: [{ el: 'SW', set: { open: true } }],
        explain: 'Kui lüliti kontakt ei sulgu, langeb kogu pinge lüliti peale. Lüliti sisse- ja väljundi vahel mõõdetud pinge on aku pinge.' },
      { id: 'wire_cut', label: 'Juhe LED-i ja jumperi J2 vahel on katki', mods: [{ el: 'W3', set: { open: true } }],
        explain: 'Katkine juhe käitub nagu avatud lüliti: pingelang on juhtme kohal, mitte ühegi osa peal. Kui jumper J2 ei ole vea koht, mõõda pinget mööda voolu teed ja otsi lõiku, kus kahe punkti vahel on kogu aku pinge, kuigi seal on ainult juhe.' },
      { id: 'jumper_loose', label: 'Jumper J1 ei ühenda (halb kontakt)', mods: [{ el: 'J1', set: { open: true } }],
        explain: 'Halb jumper katkestab ahela nagu lüliti. Selle kohal mõõdetav pinge on aku pinge, kuigi jumper näib kinni olevat.' }
    ]
  });

  /* ---------- F2: pingejagur ---------- */
  LEVELS.push({
    id: 'F2', kind: 'fault', title: 'Pingejagur A0 sisendis',
    summary: 'Arduino A0 näitab valet. Kaks 10 kΩ takistit peaksid andma 512.',
    meters: ['m1', 'm2'],
    start: { mode: 'random' },
    budget: 8, par: 4,
    build: function () { return { circuit: Circuits.divider({}), params: {} }; },
    story: function () {
      return [
        'Arduino analoogsisend A0 on ühendatud pingejagurisse: kaks 10 kΩ takistit jagavad 5 V pooleks. Seega peaks A0 näitama umbes 512 (A0 = U ÷ 5 V × 1023).',
        'Skeemil näed A0 hetkenäitu, ja see ei ole 512. Leia rike.',
        'USB-lüliti lülitab Arduino toite välja. Takistuse mõõtmiseks vajad seda.'
      ];
    },
    hints: [
      'Muuda A0 näit pingeks (näit ÷ 1023 × 5 V) ja kontrolli mõõtjaga, kas see pinge on punktis A0 päriselt olemas.',
      'Võrdle takistite pingelangusid: kus on pinge ootamatult 0 V või 5 V?'
    ],
    observables: function (sol, model) { return [sol.V[model.netOf.N] - sol.V[model.netOf.BN]]; },
    faults: [
      { id: 'r1_open', label: 'R1 on katki', mods: [{ el: 'R1', set: { open: true } }],
        explain: 'Kui R1 on katki, ei jõua 5 V A0 punkti ja A0 jääb 0 V peale. R1 peal on kogu toitepinge.' },
      { id: 'r2_open', label: 'R2 on katki', mods: [{ el: 'R2', set: { open: true } }],
        explain: 'Kui R2 on katki, pole A0 punktist maandusse teed ja A0 tõuseb peaaegu 5 V peale (1023). R2 peal on pinge peaaegu 5 V.' },
      { id: 'r1_short', label: 'Jooteämbritsus lühistab R1', mods: [{ el: 'R1', set: { short: true } }],
        explain: 'Lühistatud R1 peal pole pinget. A0 saab peaaegu terve toitepinge. Takistuse mõõtmisel näitaks R1 peal ligikaudu 0 Ω.' },
      { id: 'r2_short', label: 'Jooteämbritsus lühistab R2', mods: [{ el: 'R2', set: { short: true } }],
        explain: 'Lühistatud R2 peal pole pinget: A0 on 0 V peal. R1 peal on kogu toitepinge ja vool kasvab.' },
      { id: 'r1_wrong', label: 'R1 asemel on 100 kΩ takisti', mods: [{ el: 'R1', set: { R: 100000 } }],
        explain: 'Takisti värvikoodi segiajamine on tavaline viga. Vale väärtus nihutab jagajat: R1 peale jääb suurem osa pingest ja A0 on madal. Siin aitab takistuse mõõtmine toide väljas.' },
      { id: 'gnd_cut', label: 'Maandusjuhe on katki', mods: [{ el: 'W4', set: { open: true } }],
        explain: 'Ilma maanduseta pole vooluringil suletud teed. Vool ei liigu, A0 tõuseb toite väärtusele, aga takistitel pole pingelangu.' },
      { id: 'vcc_cut', label: '5 V juhe on katki', mods: [{ el: 'W1', set: { open: true } }],
        explain: 'Kui 5 V juhe on katki, ei jõua toide jagurini: kõik pinged jagurini on 0 V.' }
    ]
  });

  /* ---------- F3: valgusandur (MM-700) ---------- */
  LEVELS.push({
    id: 'F3', kind: 'fault', title: 'Valgusandur',
    summary: 'Uus mõõtja: MM-700. Andur ja 10 kΩ takisti moodustavad A0 sisendi jagaja.',
    meters: ['m3'],
    start: { mode: 'random' },
    budget: 8, par: 4,
    build: function (rand) {
      const Rs = pick(rand, [2200, 4700, 10000, 22000]);
      return { circuit: Circuits.divider({ sensor: true, R1: Rs }), params: { Rs: Rs } };
    },
    story: function (p) {
      return [
        'Valgusandur (fototransistor) ja 10 kΩ takisti moodustavad A0 sisendi jagaja. Anduri takistus on praeguse valguse juures ' + kohm(p.Rs) + '.',
        'Arvuta, mis A0 näitu see annab, kui kõik on terve. Skeemil näed tegelikku A0 näitu. Leia, mis on viga.',
        'Sul on ainult uus mõõtja MM-700: pesad on teises järjekorras kui varem. Loe sildid üle.'
      ];
    },
    hints: [
      'A0 = U ÷ 5 V × 1023. Esmalt arvuta, mis pinge peaks A0 punktis olema.',
      'Mõõda pinge anduri peal ja 10 kΩ peal eraldi. Kumb on ootamatu?'
    ],
    observables: function (sol, model) { return [sol.V[model.netOf.N] - sol.V[model.netOf.BN]]; },
    faults: [
      { id: 'r2_open', label: '10 kΩ takisti on katki', mods: [{ el: 'R2', set: { open: true } }],
        explain: 'Ilma 10 kΩ takistita puudub A0 punktist maandusse tee. A0 tõuseb toitepingele (1023). Andurile ei voola voolu.' },
      { id: 's_open', label: 'Andur on katki', mods: [{ el: 'R1', set: { open: true } }],
        explain: 'Katkine andur ei lase 5 V A0 punkti. A0 jääb nulli, ja anduri peal on kogu toitepinge.' },
      { id: 's_short', label: 'Andur on lühises', mods: [{ el: 'R1', set: { short: true } }],
        explain: 'Lühises anduri peal pole pinget, A0 saab peaaegu terve 5 V (1023). Vool on suurem, kui peaks.' },
      { id: 'r2_100', label: '10 kΩ asemel on 100 Ω takisti', mods: [{ el: 'R2', set: { R: 100 } }],
        explain: 'Väike takisti maanduse poolel tõmbab A0 alla. Pinge langeb peamiselt andurile ja A0 on väga madal.' },
      { id: 'a0_short', label: 'Jooteämbritsus lühistab A0 ja GND', mods: [{ add: { type: 'wire', a: 'N', b: 'G' } }],
        explain: 'A0 on otse maandusega ühendatud: A0 = 0. Anduri peal on kogu toitepinge, aga 10 kΩ takistil pinge puudub.' },
      { id: 'gnd_cut', label: 'Maandusjuhe on katki', mods: [{ el: 'W4', set: { open: true } }],
        explain: 'Maandus ei ühendu: vooluring pole suletud. Vool puudub ja A0 ujub toitepingele (1023).' },
      { id: 'vcc_cut', label: '5 V juhe on katki', mods: [{ el: 'W1', set: { open: true } }],
        explain: 'Toide ei jõua jagajani. Kõik jagaja pinged on null.' }
    ]
  });

  /* ---------- F4: kolm LED-i ---------- */
  LEVELS.push({
    id: 'F4', kind: 'fault', title: 'Kolm LED-i',
    summary: 'Rööpühendus: kasuta Kirchhoffi vooluseadust, et leida kadunud vool.',
    meters: ['m1'],
    start: { mode: 'random' },
    budget: 10, par: 5,
    build: function () { return { circuit: Circuits.leds3({ V: 5 }), params: {} }; },
    story: function () {
      return [
        'Kolm LED-i on rööbiti 5 V toite küljes ja igaühel on oma 330 Ω takisti. Terves vooluringis voolab igas harus umbes 9 mA ja kokku umbes 28 mA.',
        'Mõni LED ei põle või põleb valesti. Kogu vool peab võrduma harude voolude summaga: kui peaharu vool on väiksem, siis on mõni haru välja langenud.',
        'Sul on ainult odav MM-100. Vool tuleb mõõta piirkonnast, kuhu see ära mahub.'
      ];
    },
    hints: [
      'Mõõda peaharu vool (jumper Jm). Võrdle terve vooluringi 28 mA-ga. Kui puudu on umbes 9 mA, on üks haru kadunud.',
      'Kui haru on kadunud, mõõda pinge selle haru takistil ja LED-il. Katkestuse kohal on kogu pinge.'
    ],
    observables: function (sol) { return [Math.abs(sol.I.LED1 || 0) * 1000, Math.abs(sol.I.LED2 || 0) * 1000, Math.abs(sol.I.LED3 || 0) * 1000]; },
    faults: [
      { id: 'led2_open', label: 'LED2 on läbi põlenud', mods: [{ el: 'LED2', set: { open: true } }],
        explain: 'Haru 2 on katkenud LED-i kohalt. Haru vool puudub ja peaharu vool on 9 mA võrra väiksem. LED2 peal on pinge, R2 peal pole.' },
      { id: 'r3_open', label: 'R3 on katki', mods: [{ el: 'R3', set: { open: true } }],
        explain: 'Haru 3 on katkenud takisti kohalt. Haru vool puudub; LED3 jääb pimedaks.' },
      { id: 'led1_rev', label: 'LED1 on valepidi', mods: [{ el: 'LED1', set: { reversed: true } }],
        explain: 'Valepidi LED ei juhi: haru 1 vool on null. Pinge langeb LED1 peale.' },
      { id: 'r2_wrong', label: 'R2 asemel on 33 kΩ takisti', mods: [{ el: 'R2', set: { R: 33000 } }],
        explain: 'Väga suure takisti tõttu on haru 2 vool alla 0,1 mA ja LED2 on peaaegu pime. Takisti R2 peal on peaaegu kõik haru pingest.' },
      { id: 'w5_cut', label: 'Haru 3 maandusjuhe on katki', mods: [{ el: 'W5', set: { open: true } }],
        explain: 'Maandusjuhe katkestab haru 3 tagasitee. Vool puudub; katkestuse kohal on kogu pinge.' },
      { id: 'j2_loose', label: 'Jumper J2 ei ühenda (halb kontakt)', mods: [{ el: 'J2', set: { open: true } }],
        explain: 'Halb jumper katkestab haru 2 nagu avatud lüliti. Jumperi kohal on kogu haru pinge.' },
      { id: 'bat_low', label: 'Toide on nõrk (aku tühjenemas)', mods: [{ el: 'BAT', set: { V: 2.6, r: 2 } }],
        explain: 'Tühjenev toide annab LED-i päripingest vaevalt rohkem: kõik haruvoolud on väikesed ja peaharu vool on tühine.' }
    ]
  });

  /* ---------- F5: GreenPower mootor ---------- */
  LEVELS.push({
    id: 'F5', kind: 'fault', title: 'Vormeliauto mootor on loid',
    summary: 'Suur vool: 24 V, 4 A. Ära kasuta mA-pesa!',
    meters: ['m2', 'm3'],
    start: { mode: 'random' },
    budget: 9, par: 5,
    build: function () { return { circuit: Circuits.motor({ Rm: 6 }), params: {} }; },
    story: function () {
      return [
        'VHK GreenPoweri vormeliauto mootor ei kiirenda nii hästi kui peaks. Süsteem: 24 V aku, 15 A kaitse, kontaktor, klemm ja mootor (ligikaudu 6 Ω). Terves vooluringis voolab umbes 4 A.',
        'Siin on voolud suured. Kaitsmed on mõõtjates, mille pesadel on kindlad piirid. Loe sildid ja vali pesa mõistlikult.',
        'Vali MM-400 või MM-700. Need erinevad pesade järjekorra ja kaitsmete poolest.'
      ];
    },
    hints: [
      'Mõõda kõigepealt aku pinge koormuse all. Kui see on tunduvalt väiksem kui 24 V, siis on tegemist nõrga akuga või suure kaoga mujal.',
      'Mõõda pinge kaitsel, kontaktoril ja klemmil. Terves ahelas on need peaaegu 0 V: ootamatu pingelang näitab halba kontakti.'
    ],
    observables: function (sol) { return [Math.abs(sol.I.M || 0)]; },
    faults: [
      { id: 'fuse_open', label: 'Kaitse F1 on läbi põlenud', mods: [{ el: 'F1', set: { open: true } }],
        explain: 'Läbi põlenud kaitse katkestab ahela: vool on null ja kaitse peal on kogu aku pinge.' },
      { id: 'k_worn', label: 'Kontaktori kontaktid on kulunud', mods: [{ el: 'K1', set: { R: 2.5 } }],
        explain: 'Kulunud kontakt tekitab suure üleminekutakistuse: osa aku pingest langeb kontaktori peal ja mootor saab vähem. Kontaktori kohal on mõõdetav pingelang.' },
      { id: 'bat_low', label: 'Aku on tühjenenud (suur sisetakistus)', mods: [{ el: 'BAT', set: { V: 20, r: 1.6 } }],
        explain: 'Tühja aku pinge on väiksem ja koormuse all langeb veel rohkem. Aku klemmidel mõõdetud pinge koormuse all on tunduvalt alla 24 V.' },
      { id: 'x_loose', label: 'Klemm X1 on lahti (halb kontakt)', mods: [{ el: 'X1', set: { R: 2 } }],
        explain: 'Lahtine klemm käitub nagu lisatakisti: selle peal on mõõdetav pingelang, mootori pinge väheneb.' },
      { id: 'motor_open', label: 'Mootori mähis on katki', mods: [{ el: 'M', set: { open: true } }],
        explain: 'Katkine mootor ei juhi voolu, ahel on lahti. Mootori peal on peaaegu kogu aku pinge, vool on null.' },
      { id: 'wire_cut', label: 'Juhe mootori ja jumperi J1 vahel on katki', mods: [{ el: 'W3', set: { open: true } }],
        explain: 'Katkine juhe katkestab ahela nagu avatud lüliti. Pinge langeb juhtme kohale, mitte ühelegi komponendile.' }
    ]
  });

  /* ---------- F6: kaks rikket ---------- */
  LEVELS.push({
    id: 'F6', kind: 'fault', title: 'Kaks rikket korraga',
    summary: 'Lõppkatse: LED-indikaator ja valgusandur. Kumbki haru on katki.',
    meters: ['m1', 'm2', 'm3'],
    start: { mode: 'random' },
    budget: 14, par: 9,
    build: function () { return { circuit: Circuits.board({ Rs: 4700 }), params: {} }; },
    story: function () {
      return [
        'Arduino plaadil on kaks haru: LED-indikaator (330 Ω + LED) ja valgusandur A0 sisendiga (andur ~4,7 kΩ ja 10 kΩ). Mõlemas harus on üks rike.',
        'Leia mõlemad. Valida võid ükskõik millise mõõtja: iga mõõtja ootab sinult teistsugust seadistust.',
        'Plaadi USB-lüliti lülitab toite välja.'
      ];
    },
    hints: [
      'Mõõda kõigepealt toitepinge. Seejärel vaata haru kaupa: kas LED-i haru ja anduri haru on mõlemad töövalmis? Tegele kummagi haruga eraldi.',
      'Iga haru jaoks: võrdle pingeid sõlmede vahel. Seal, kus pinge on ootamatult 0 V või täisväärtuses 5 V, on midagi katki.'
    ],
    observables: function (sol, model) {
      return [Math.abs(sol.I.LED1 || 0) * 1000, sol.V[model.netOf.A0] - sol.V[model.netOf.B2]];
    },
    groups: [
      { id: 'led', label: 'LED-indikaatori haru',
        faults: [
          { id: 'led_rev', label: 'LED on valepidi', mods: [{ el: 'LED1', set: { reversed: true } }], explain: 'Valepidi LED ei juhi voolu, kogu haru pinge langeb LED-i peale.' },
          { id: 'led_open', label: 'LED on läbi põlenud', mods: [{ el: 'LED1', set: { open: true } }], explain: 'Läbi põlenud LED on katkestus: LED-i peal on kogu pinge.' },
          { id: 'r1_open', label: 'R1 (330 Ω) on katki', mods: [{ el: 'R1', set: { open: true } }], explain: 'Katkine takisti katkestab haru: R1 kohal on pingelang, LED-i peal on pinge null.' },
          { id: 'j1_loose', label: 'Jumper J1 ei ühenda', mods: [{ el: 'J1', set: { open: true } }], explain: 'Halb jumper katkestab haru toitest: jumperi kohal on pinge.' }
        ] },
      { id: 'sensor', label: 'Anduri haru',
        faults: [
          { id: 's_open', label: 'Andur on katki', mods: [{ el: 'S1', set: { open: true } }], explain: 'Katkine andur: A0 jääb nulli ja anduri peal on kogu pinge.' },
          { id: 's_short', label: 'Andur on lühises', mods: [{ el: 'S1', set: { short: true } }], explain: 'Lühises anduri peal pole pinget ja A0 saab peaaegu terve toitepinge.' },
          { id: 'r2_open', label: '10 kΩ takisti on katki', mods: [{ el: 'R2', set: { open: true } }], explain: 'Ilma 10 kΩ takistita on A0 maandusest lahti ja ujub toitele (1023).' },
          { id: 'r2_bridge', label: 'Jooteämbritsus lühistab 10 kΩ takisti', mods: [{ add: { type: 'wire', a: 'A0', b: 'B2' } }], explain: 'Jooteämbritsus tõmbab A0 maanduse külge: A0 = 0. Anduri peal on kogu pinge, 10 kΩ peal null.' },
          { id: 'j2_loose', label: 'Jumper J2 ei ühenda', mods: [{ el: 'J2', set: { open: true } }], explain: 'Halb jumper katkestab anduri haru toitest: A0 jääb nulli, jumperi kohal on pinge.' }
        ] }
    ]
  });

  /* ----------------- abi: aktiivne rike ----------------- */
  function activeFault(level, rand) {
    if (level.groups) {
      const picks = level.groups.map(function (g) { return pick(rand, g.faults); });
      return {
        id: picks.map(function (p) { return p.id; }).join('+'),
        picks: picks,
        mods: picks.reduce(function (a, p) { return a.concat(p.mods); }, []),
        label: picks.map(function (p) { return p.label; }).join(' + ')
      };
    }
    const f = pick(rand, level.faults);
    return { id: f.id, picks: [f], mods: f.mods, label: f.label };
  }

  function byId(id) { return LEVELS.find(function (l) { return l.id === id; }); }

  return { list: LEVELS, get: byId, activeFault: activeFault, pick: pick, fmtN: fmtN };
});
