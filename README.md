# Mõõtepink

Brauserimäng Ohmi ja Kirchhoffi seaduse ning multimeetri kasutamise harjutamiseks (gümnaasium). Õpilane seadistab mõõtja ise: valib, millisesse pessa punane ja must juhe lähevad, keerab valikulüliti õigesse asendisse ja piirkonda ning paneb sondid mõõtepunktidele. Alguses harjutab ta mõõtmist (T1–T6), hiljem otsib vooluringist rikkeid (F1–F6): ennusta, mõõda, võrdle, diagnoosi.

Kolm mõõtjat (MM-100, MM-400, MM-700) erinevad pesade järjekorra, piirkonna valiku ja kaitsmete poolest. Kõrgematel tasemetel tuleb kasutada uut mõõtjat, mille pesad on teises järjekorras.

Ainult HTML, CSS ja JavaScript. Ehitamist ega serverit pole vaja.

## Avaldamine GitHub Pagesis

1. Tee GitHubis uus hoidla (näiteks `mootepink`).
2. Lae kõik selle kausta failid hoidla juurkausta (`index.html` peab olema juurkaustas, mitte alamkaustas).
3. Ava hoidla **Settings → Pages**. Vali **Deploy from a branch**, haru `main` ja kaust `/ (root)`. Salvesta.
4. Minuti pärast on mäng aadressil `https://KASUTAJA.github.io/mootepink/`.

Mängu saab avada ka otse failist: topeltklõps `index.html` peal.

## Õpetajale

- **Sama rike kõigile:** lisa aadressi lõppu `?seed=123` (suvaline arv). Siis saavad kõik õpilased igal tasemel sama rikke ja samad takistid, nii saab klassiga lahendust arutada. Ilma `?seed` osata on iga mängukord erinev (ekraanil on „Variant 12345“).
- **Tärnid:** treeningtasemel annavad kuni kaks viga kolm tärni. Rikketasemel annab kolm tärni õige diagnoos esimesel katsel, vähemalt kaks mõõtmist (F6-s kolm), sihtmärgi piires, kuni üks seadistusviga, pool ennustustest õiged ja ilma vihjeteta. Mõõtmata arvamine annab ühe tärni.
- **Edusammud** jäävad selle brauseri kohalikku mällu (`localStorage`). Menüü all on nupp „Nulli edusammud“. Ühise arvuti puhul nulli need tunni lõpus.
- **Kaitse läbipõlemine:** kui õpilane ühendab voolupesa (mA või 10A) pingeallika kõrvale, põleb mõõtja kaitse läbi. See loeb veaks, ja nupp „Vaheta kaitse“ annab mõõtjale uue kaitsme.
- **Juhtimine:** juhtmeotsi saab lohistada hiire või sõrmega. Alternatiiv: klõpsa otsal ja seejärel pesal või mõõtepunktil. Klaviatuuril liigu Tab-klahviga, Enter ja tühik valivad, valikulülitil töötavad nooleklahvid.
- **Ekraan:** kõige mugavam sülearvutis või tahvlis rõhtasendis. Telefonis töötab, aga mõõtja on väike.

## Failid

```
index.html        leht
css/style.css     kujundus
js/meters.js      kolme mõõtja andmed (pesad, asendid, piirkonnad, kaitsmed)
js/engine.js      vooluringi lahendaja, rikked, mõõtmise mudel
js/circuits.js    vooluringid
js/levels.js      tasemed, tekstid, rikete loend
js/rules.js       ülesannete kontroll, ennustuse hindamine, tähed
js/draw.js        skeemi ja mõõtja joonistamine
js/game.js        liides
fonts/            Atkinson Hyperlegible ja Barlow Condensed (litsentsid kaasas)
tests/            Node'i testid: `node tests/engine.test.js` jne (mängimiseks pole vaja)
```

## Tasemete muutmine

Uue rikke lisamiseks lisa `js/levels.js` vastava taseme `faults` loendisse kirje (`label`, `mods`, `explain`). Käivita seejärel `node tests/levels.test.js`: see kontrollib, et iga rike on mõõtmisega eristatav ja tase lahendatav piiratud mõõtmiste arvuga.
