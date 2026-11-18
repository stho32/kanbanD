/* kanbanD — Preisetikett (R00105, ADR-0009): geschätzte API-Kosten in ganzen Cent rechnen; rein, im Browser und in Node nutzbar.
   Jeder Geldwert aus GET (Dollar als JSON-Zahl) wird genau einmal hier in Cent gewandelt; formatiert wird erst beim Anzeigen. */
(function (ziel) {
  const inCent = dollar => Math.round(dollar * 100);

  /** Grenzen eines Werts {amount} oder {min, max} in Cent; ein Betrag zählt als min = max. */
  function grenzenInCent(wert) {
    if (wert.amount != null) return { min: inCent(wert.amount), max: inCent(wert.amount) };
    return { min: inCent(wert.min), max: inCent(wert.max) };
  }

  /** cost aus GET → {waehrung, min, max, mitte, basis, positionen: [{text, tokens, min, max}]} in Cent; Gesamt aus
      Positionen als Summe der Unter- bzw. Obergrenzen, Mitte kaufmännisch gerundet. */
  function kostenInCent(cost) {
    const positionen = (cost.items || []).map(p => ({ text: p.text, tokens: p.tokens ?? null, ...grenzenInCent(p) }));
    const gesamt = positionen.length
      ? { min: positionen.reduce((s, p) => s + p.min, 0), max: positionen.reduce((s, p) => s + p.max, 0) }
      : grenzenInCent(cost);
    return { waehrung: cost.currency, ...gesamt, mitte: Math.floor((gesamt.min + gesamt.max + 1) / 2), basis: cost.basis ?? null, positionen };
  }

  /** Cent als Text der Währung: „1,63 $“, „25,55 €“, „2,00 CHF“ — immer zwei Nachkommastellen. */
  function geld(cent, waehrung) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: waehrung, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);
  }

  const zahl = cent => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);

  /** Grenzen als Text mit einem Währungszeichen am Ende: „0,60–1,60 $“, bei gleichen Grenzen ein Betrag „1,63 $“. */
  function spanne(min, max, waehrung, zwischen) {
    if (min === max) return geld(max, waehrung);
    return `${zahl(min)}${zwischen}${geld(max, waehrung)}`;
  }

  /** Kosten in Cent → Texte des Preisetiketts der Karte: sichtbar die Mitte, Hinweis und zugänglicher Name mit den Grenzen. */
  function preisetikett(k) {
    return {
      sichtbar: `≈ ${geld(k.mitte, k.waehrung)}`,
      hinweis: `${spanne(k.min, k.max, k.waehrung, '–')} · geschätzte API-Kosten`,
      name: `Preisetikett: geschätzt ${spanne(k.min, k.max, k.waehrung, ' bis ')}, API-Kosten`,
    };
  }

  /** Kosten in Cent → Zeilen des Reiters „Kosten“: Positionen in Dateireihenfolge mit Summenzeile, ohne Positionen eine
      Zeile „Gesamt“ ohne Summe; die Spalte Tokens nur, wenn eine Position Tokens trägt. Beträge bleiben Cent. */
  function kostentabelle(k) {
    const zeilen = k.positionen.length
      ? k.positionen.map(p => ({ text: p.text, tokens: p.tokens, niedrig: p.min, hoch: p.max }))
      : [{ text: 'Gesamt', tokens: null, niedrig: k.min, hoch: k.max }];
    const mitTokens = zeilen.filter(z => z.tokens != null);
    const summe = k.positionen.length
      ? { tokens: mitTokens.length ? mitTokens.reduce((s, z) => s + z.tokens, 0) : null, niedrig: k.min, hoch: k.max }
      : null;
    return { beschriftung: `Geschätzte API-Kosten (${k.waehrung})`, spalteTokens: mitTokens.length > 0, zeilen, summe, basis: k.basis };
  }

  /** Reihenfolge der Währungszeilen: USD zuerst, dann alphabetisch nach ISO-Code. */
  const waehrungVor = (a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b));

  /** Alte Posten (cost.items) zählen als angefallen (R00165); ein cost ohne Posten ist eine Schätzung und zählt nie. */
  const hatAltePosten = a => Boolean(a.cost) && (a.cost.items || []).length > 0;
  const hatEintraege = a => (a.kosteneintraege || []).length > 0;
  const nurSchaetzung = a => Boolean(a.cost) && !hatAltePosten(a) && !hatEintraege(a);

  /** Kosteneinträge aus GET → [{waehrung, cent}] je Währung des Eintrags, USD zuerst. Die eine Summe der Einträge —
      der Bericht und die Ansicht „Kosten“ rechnen beide hiermit. */
  function summenDerEintraege(eintraege) {
    const summen = new Map();
    for (const e of eintraege) summen.set(e.currency, (summen.get(e.currency) || 0) + inCent(e.amount));
    return [...summen].map(([waehrung, cent]) => ({ waehrung, cent })).sort((a, b) => waehrungVor(a.waehrung, b.waehrung));
  }

  /** Kosteneinträge aus GET → Zeilen der Ansicht „Kosten“ (R00165 AK 10): neueste oben, bei gleichem Moment in
      Dateireihenfolge; je Währung eine Summe, die Tokens-Summe aller Einträge nur in der ersten; die Spalte Tokens nur,
      wenn ein Eintrag Tokens trägt. Beträge bleiben Cent, der Zeitpunkt bleibt in Dateiform. */
  function kosteneintragstabelle(eintraege) {
    const { zeitMs } = typeof module !== 'undefined' ? require('./zeiten.js') : window;
    const neuesteZuerst = [...eintraege].sort((a, b) => zeitMs(b.at) - zeitMs(a.at));
    const zeilen = neuesteZuerst.map(e => ({ zeitpunkt: e.at, rolle: e.role, spalte: e.column, tokens: e.tokens ?? null, cent: inCent(e.amount), waehrung: e.currency }));
    const mitTokens = zeilen.filter(z => z.tokens != null);
    let alleTokens = null;
    if (mitTokens.length) alleTokens = mitTokens.reduce((summe, z) => summe + z.tokens, 0);
    const summen = summenDerEintraege(eintraege).map((s, stelle) => ({ ...s, tokens: stelle === 0 ? alleTokens : null }));
    return { spalteTokens: mitTokens.length > 0, zeilen, summen };
  }

  /** Ob im Kostenbericht ein Bereich gewählt ist — dann steht „Zurücksetzen“ in der Bereichszeile; auch eine gespeicherte
      Spaltengrenze, die es nicht mehr gibt, ist eine Wahl. */
  const kostenbereichGewaehlt = f => f.zeitraum !== 'alles' || Boolean(f.kostenVonSpalte) || Boolean(f.kostenBisSpalte);

  /** Spaltenabschnitt (ADR-0028 N1 Punkt 4): Stellen {von, bis} in der Spaltenfolge des Boards, beide einschließlich und
      unabhängig von der Reihenfolge der Angabe; eine Grenze allein ist offen bis zum Rand; ohne Grenze auf dem Board null. */
  function spaltenabschnitt(spalten, vonSpalte, bisSpalte) {
    const von = spalten.indexOf(vonSpalte), bis = spalten.indexOf(bisSpalte);
    if (von < 0 && bis < 0) return null;
    if (von < 0) return { von: 0, bis };
    if (bis < 0) return { von, bis: spalten.length - 1 };
    return { von: Math.min(von, bis), bis: Math.max(von, bis) };
  }
  /** Die Auswahlen „Spalte von“ und „Spalte bis“ → {von, bis: [{name, gewaehlt, gesperrt}]} in der Spaltenfolge des
      Boards: gesperrt ist, was die andere Grenze ausschließt — in „von“ alles rechts von „bis“, in „bis“ alles links von „von“. */
  function kostenSpaltenwahl(board, f) {
    const spalten = board.spalten.map(sp => sp.name), von = spalten.indexOf(f.kostenVonSpalte), bis = spalten.indexOf(f.kostenBisSpalte);
    return {
      von: spalten.map((name, stelle) => ({ name, gewaehlt: stelle === von, gesperrt: bis >= 0 && stelle > bis })),
      bis: spalten.map((name, stelle) => ({ name, gewaehlt: stelle === bis, gesperrt: von >= 0 && stelle < von })),
    };
  }
  /** Bereich des Kostenberichts (R00171): der Zeitraum des Berichtsfilters als Grenzen [von, bis) in der Ortszeit des
      Betrachters und der Spaltenabschnitt; die Grenzen kommen unverändert aus `zeitraumGrenzen`. `gesetzt` heißt: es zählen nur noch Einträge im Bereich, alte Posten stehen daneben. */
  function kostenbereich(board, f, jetzt) {
    const { zeitraumGrenzen } = typeof module !== 'undefined' ? require('./berichte.js') : window;
    const spalten = board.spalten.map(sp => sp.name), abschnitt = spaltenabschnitt(spalten, f.kostenVonSpalte, f.kostenBisSpalte);
    return { gesetzt: f.zeitraum !== 'alles' || abschnitt !== null, zeit: zeitraumGrenzen(f, jetzt), spalten, abschnitt };
  }
  /** Gespeicherte Grenzen des Abschnitts, die das Board nicht (mehr) führt → [{seite: 'von' | 'bis', name}]; sie gelten
      als nicht gesetzt und werden genannt (ADR-0028 N1 Punkt 4). */
  function verschwundeneGrenzen(board, f) {
    const spalten = board.spalten.map(sp => sp.name);
    return [{ seite: 'von', name: f.kostenVonSpalte }, { seite: 'bis', name: f.kostenBisSpalte }].filter(g => g.name && !spalten.includes(g.name));
  }
  /** Wohin ein Eintrag im Bereich fällt: 'zaehlt' (Zeitpunkt im Zeitraum und Spalte im Abschnitt), 'fremdeSpalte' (im
      Zeitraum, aber bei gewähltem Abschnitt aus einer Spalte, die das Board nicht führt — ADR-0028 N1 Punkt 5) oder
      'ausserhalb'. */
  function einordnung(e, bereich) {
    const { zeitMs } = typeof module !== 'undefined' ? require('./zeiten.js') : window;
    const moment = zeitMs(e.at);
    if (moment < bereich.zeit.von || moment >= bereich.zeit.bis) return 'ausserhalb';
    if (!bereich.abschnitt) return 'zaehlt';
    const stelle = bereich.spalten.indexOf(e.column);
    if (stelle < 0) return 'fremdeSpalte';
    if (stelle < bereich.abschnitt.von || stelle > bereich.abschnitt.bis) return 'ausserhalb';
    return 'zaehlt';
  }
  /** Die Einträge einer Aufgabe mit dieser Einordnung; ohne gesetzten Bereich zählen alle. */
  function eintraegeMit(art, a, bereich) {
    const eintraege = a.kosteneintraege || [];
    if (bereich.gesetzt) return eintraege.filter(e => einordnung(e, bereich) === art);
    if (art === 'zaehlt') return eintraege;
    return [];
  }
  const zaehlendeEintraege = (a, bereich) => eintraegeMit('zaehlt', a, bereich);
  /** Spanne der alten Posten einer Aufgabe in Cent {waehrung, niedrig, hoch}; ohne alte Posten null. */
  function altePosten(a) {
    if (!hatAltePosten(a)) return null;
    const k = kostenInCent(a.cost);
    return { waehrung: k.waehrung, niedrig: k.min, hoch: k.max };
  }

  /** Angefallene Kosten einer Aufgabe → [{waehrung, eintraege, posten}] in Cent: je Währung die Summe ihrer zählenden
      Einträge (ohne Eintrag null) und die Spanne ihrer alten Posten {niedrig, hoch} (ohne Posten null). Mit gesetztem
      Bereich zählen alte Posten nicht — ohne Datum und Spalte sind sie keinem Bereich zuzuordnen. */
  function angefalleneKosten(a, bereich) {
    const teile = summenDerEintraege(zaehlendeEintraege(a, bereich)).map(s => ({ waehrung: s.waehrung, eintraege: s.cent, posten: null }));
    const alt = altePosten(a);
    if (!alt || bereich.gesetzt) return teile;
    const posten = { niedrig: alt.niedrig, hoch: alt.hoch };
    const gleicheWaehrung = teile.find(t => t.waehrung === alt.waehrung);
    if (!gleicheWaehrung) return [...teile, { waehrung: alt.waehrung, eintraege: null, posten }];
    return teile.map(t => (t === gleicheWaehrung ? { ...t, posten } : t));
  }

  /** null heißt „kommt nicht vor“ und bleibt es, bis ein Wert dazukommt — so trägt eine Gruppe nur die Zeilen, die es gibt. */
  function plus(summe, wert) {
    if (wert == null) return summe;
    return (summe || 0) + wert;
  }
  const spannePlus = (summe, spanne) => ({ niedrig: plus(summe && summe.niedrig, spanne.niedrig), hoch: plus(summe && summe.hoch, spanne.hoch) });
  function gruppeMitAufgabe(gruppe, teil) {
    let posten = gruppe.posten;
    if (teil.posten) posten = spannePlus(posten, teil.posten);
    return { ...gruppe, n: gruppe.n + 1, eintraege: plus(gruppe.eintraege, teil.eintraege), posten };
  }
  /** „Summe“ der Gruppe: Einträge zählen in Unter- und Obergrenze, alte Posten mit ihrer Spanne. */
  function mitSumme(gruppe) {
    const eintraege = gruppe.eintraege || 0, posten = gruppe.posten || { niedrig: 0, hoch: 0 };
    return { ...gruppe, niedrig: eintraege + posten.niedrig, hoch: eintraege + posten.hoch };
  }

  /** Angefallene Kosten einer Aufgabe → Texte der Karte im Board (R00196): je Währung ein Betrag oder eine Spanne, USD
      zuerst, und der Name für Hilfstechnik; ohne angefallene Kosten keine Beträge und kein Name. Die Karte zählt immer
      alles — Zeitraum und Spaltenabschnitt des Berichts wirken auf sie nicht. */
  function angefallenAufKarte(a) {
    const ohneBereich = { gesetzt: false };
    const summen = angefalleneKosten(a, ohneBereich).map(mitSumme).sort((x, y) => waehrungVor(x.waehrung, y.waehrung));
    if (!summen.length) return { betraege: [], name: '' };
    const texte = zwischen => summen.map(s => spanne(s.niedrig, s.hoch, s.waehrung, zwischen));
    return { betraege: texte('–'), name: `Angefallene Kosten: ${texte(' bis ').join(', ')}` };
  }

  /** Die Aufgaben, die der Bericht zählt: alle in den Spalten des Boards (samt archivierter), die zum Filter passen —
      `gezaehlt` mit Lücken für Nummern ohne lesbare Datei, `lesbar` ohne sie. */
  function aufgabenImBericht(board, aufgaben, f) {
    const { aufgabePasst } = typeof module !== 'undefined' ? require('./berichte.js') : window;
    const nachNummer = new Map(aufgaben.map(a => [a.nummer, a]));
    const gezaehlt = board.spalten.filter(sp => !f.ohneSpalten.includes(sp.name))
      .flatMap(sp => sp.aufgaben.map(nr => nachNummer.get(nr)))
      .filter(a => aufgabePasst(f, a));
    return { gezaehlt, lesbar: gezaehlt.filter(Boolean) };
  }

  /** Board (Spalten samt archivierter Aufgaben) + Aufgaben + Filter der Berichte + Uhr des Betrachters →
      {m, nurSchaetzung, jeWaehrung: [{waehrung, n, eintraege, posten, niedrig, hoch}]} in Cent (R00165 AK 9). m zählt alle
      passenden Aufgaben in den Spalten, n die davon mit zählenden Einträgen oder alten Posten in dieser Währung,
      nurSchaetzung die mit Schätzung, aber ohne beides; der Filter wirkt über Spalten, Klasse, Zuständige und Labels wie
      in den übrigen Berichten. Zeitraum und Spaltenabschnitt (R00171) lassen nur die Einträge darin zählen; ohne beide bleibt
      jede Zahl. */
  function kostenbericht(board, aufgaben, f, jetzt) {
    const { gezaehlt, lesbar } = aufgabenImBericht(board, aufgaben, f), bereich = kostenbereich(board, f, jetzt);
    const gruppen = new Map();
    for (const teil of lesbar.flatMap(a => angefalleneKosten(a, bereich))) {
      const bisher = gruppen.get(teil.waehrung) || { waehrung: teil.waehrung, n: 0, eintraege: null, posten: null };
      gruppen.set(teil.waehrung, gruppeMitAufgabe(bisher, teil));
    }
    const jeWaehrung = [...gruppen.values()].map(mitSumme).sort((a, b) => waehrungVor(a.waehrung, b.waehrung));
    return { m: gezaehlt.length, nurSchaetzung: lesbar.filter(nurSchaetzung).length, jeWaehrung };
  }

  /** Ab welcher Spalte eine Aufgabe „erledigt“ heißt (ADR-0028 N1 Punkt 7) → {spalte, grund}: die Bis-Spalte des
      Abschnitts ('bis'), ohne sie die Zielspalte des Boards ('ziel'), sonst die letzte Spalte ('letzte'). */
  function erledigtAbSpalte(board, f) {
    const spalten = board.spalten.map(sp => sp.name);
    if (spalten.includes(f.kostenBisSpalte)) return { spalte: f.kostenBisSpalte, grund: 'bis' };
    const zielspalte = board.fieber && board.fieber.zielspalte;
    if (spalten.includes(zielspalte)) return { spalte: zielspalte, grund: 'ziel' };
    let letzte = null;
    if (spalten.length) letzte = spalten[spalten.length - 1];
    return { spalte: letzte, grund: 'letzte' };
  }
  /** Kennzeichen einer Aufgabe aus dem heutigen Stand auf diesem Board, nie gespeichert; der Vorrang ist die Reihenfolge. */
  function kennzeichenDerAufgabe(a, stehtAbErledigt) {
    if (a.archiviert) return 'archiviert';
    if (stehtAbErledigt) return 'erledigt';
    if (a.reservierung) return 'in Arbeit';
    return 'offen';
  }
  /** Board → Funktion Aufgabe → Kennzeichen: „erledigt“ ist, was in `erledigtAb.spalte` oder rechts davon steht. */
  function kennzeichenLeser(board, erledigtAb) {
    const abStelle = board.spalten.findIndex(sp => sp.name === erledigtAb.spalte);
    const stelleNachNummer = new Map(board.spalten.flatMap((sp, stelle) => sp.aufgaben.map(nr => [nr, stelle])));
    return a => kennzeichenDerAufgabe(a, abStelle >= 0 && stelleNachNummer.get(a.nummer) >= abStelle);
  }

  /** Was der Bericht „Kosten“ zeichnet (R00171): die Summen von kostenbericht() und je Währung die Aufgaben dahinter →
      {m, nurSchaetzung, bereich, erledigtAb, grenzenWeg, gruppen: [{waehrung, summe, aufgaben: [{nummer, titel, cent,
      kennzeichen}], altePostenAussen, fremdeSpalte}]}. `aufgaben` nennt jede Aufgabe mit zählendem Eintrag nach Nummer
      samt Kennzeichen (`erledigtAb` sagt, ab welcher Spalte „erledigt“ gilt); alte Posten stehen nie in der Liste. Mit
      gesetztem Bereich trägt `altePostenAussen` ihre Spanne neben der Summe, mit Abschnitt `fremdeSpalte` die Cent der
      Einträge aus Spalten, die das Board nicht führt — eine Währung, in der nur solches steht, hat `summe` null.
      `grenzenWeg` nennt gespeicherte Grenzen, die es nicht mehr gibt. `rollen` (R00172) verteilt dieselben zählenden
      Einträge, aus denen `summe.eintraege` entsteht, auf ihre Rollen: [{rolle, cent, aufgaben: [{nummer, titel, cent,
      eintraege: [{at, spalte, cent, tokens}]}]}] — Rollen in der Schreibweise wie gespeichert und alphabetisch, Aufgaben
      nach Nummer, Einträge zeitlich aufsteigend. Die Summe der Rollen ist in jedem Zustand `summe.eintraege`; alte
      Posten tragen keine Rolle und stehen nie darin. */
  function kostenaufstellung(board, aufgaben, f, jetzt) {
    const bericht = kostenbericht(board, aufgaben, f, jetzt), bereich = kostenbereich(board, f, jetzt);
    const { lesbar } = aufgabenImBericht(board, aufgaben, f);
    const nachNummer = [...lesbar].sort((a, b) => a.nummer - b.nummer);
    const erledigtAb = erledigtAbSpalte(board, f), kennzeichen = kennzeichenLeser(board, erledigtAb);
    const gruppen = new Map(bericht.jeWaehrung.map(summe => [summe.waehrung, { waehrung: summe.waehrung, summe, aufgaben: [], altePostenAussen: null, fremdeSpalte: null, rollen: new Map() }]));
    const gruppe = waehrung => {
      if (!gruppen.has(waehrung)) gruppen.set(waehrung, { waehrung, summe: null, aufgaben: [], altePostenAussen: null, fremdeSpalte: null, rollen: new Map() });
      return gruppen.get(waehrung);
    };
    for (const a of nachNummer) {
      for (const e of zaehlendeEintraege(a, bereich)) rolleMitEintrag(gruppe(e.currency).rollen, a, e);
      for (const s of summenDerEintraege(zaehlendeEintraege(a, bereich))) gruppe(s.waehrung).aufgaben.push({ nummer: a.nummer, titel: a.titel, cent: s.cent, kennzeichen: kennzeichen(a) });
      for (const s of summenDerEintraege(eintraegeMit('fremdeSpalte', a, bereich))) gruppe(s.waehrung).fremdeSpalte = plus(gruppe(s.waehrung).fremdeSpalte, s.cent);
      const alt = altePosten(a);
      if (alt && bereich.gesetzt) gruppe(alt.waehrung).altePostenAussen = spannePlus(gruppe(alt.waehrung).altePostenAussen, alt);
    }
    return { m: bericht.m, nurSchaetzung: bericht.nurSchaetzung, bereich: bereich.gesetzt, erledigtAb, grenzenWeg: verschwundeneGrenzen(board, f), gruppen: [...gruppen.values()].map(g => ({ ...g, rollen: rollenAlphabetisch(g.rollen) })).sort((a, b) => waehrungVor(a.waehrung, b.waehrung)) };
  }
  /** Zählt einen Eintrag der Aufgabe `a` in seine Rolle und dort in die Aufgabe; `rollen` ist die Sammlung einer
      Währungsgruppe im Aufbau (Rolle → {rolle, cent, aufgaben: Nummer → {nummer, titel, cent, eintraege}}). */
  function rolleMitEintrag(rollen, a, e) {
    if (!rollen.has(e.role)) rollen.set(e.role, { rolle: e.role, cent: 0, aufgaben: new Map() });
    const rolle = rollen.get(e.role), cent = inCent(e.amount);
    if (!rolle.aufgaben.has(a.nummer)) rolle.aufgaben.set(a.nummer, { nummer: a.nummer, titel: a.titel, cent: 0, eintraege: [] });
    const aufgabe = rolle.aufgaben.get(a.nummer);
    rolle.cent += cent;
    aufgabe.cent += cent;
    aufgabe.eintraege.push({ at: e.at, spalte: e.column, cent, tokens: e.tokens ?? null });
  }
  /** Rollen alphabetisch nach deutscher Sortierung; Schreibweisen, die sie gleich einordnet, nach Zeichenfolge — die
      Folge hängt so nie von der Reihenfolge der Einträge ab. Aufgaben stehen in der Folge, in der sie gezählt wurden
      (nach Nummer), ihre Einträge zeitlich aufsteigend. */
  function rollenAlphabetisch(rollen) {
    const { zeitMs } = typeof module !== 'undefined' ? require('./zeiten.js') : window;
    const zeitlich = eintraege => [...eintraege].sort((a, b) => zeitMs(a.at) - zeitMs(b.at));
    return [...rollen.values()].sort((a, b) => rolleVor(a.rolle, b.rolle))
      .map(rolle => ({ ...rolle, aufgaben: [...rolle.aufgaben.values()].map(aufgabe => ({ ...aufgabe, eintraege: zeitlich(aufgabe.eintraege) })) }));
  }
  function rolleVor(a, b) {
    const nachAlphabet = a.localeCompare(b, 'de');
    if (nachAlphabet !== 0) return nachAlphabet;
    if (a < b) return -1;
    return Number(a > b);
  }

  /** Der Berichtsfilter ohne seinen Zeitraum: für „Bestand nach Labels“ (ein Bestand ist keine Bewegung, der Zeitraum
      gilt dort nicht) und für die Frage, ob im Kostenbericht ein Filter der Box wirkt — der Zeitraum steht dort seit
      R00171 in der Bereichszeile. Er bleibt für die übrigen Berichte unverändert gespeichert. */
  const filterOhneZeitraum = f => ({ ...f, zeitraum: 'alles', von: '', bis: '' });

  /** Umfangstext der Summenzeile: „alle Spalten“ nur, wenn ohne Zeitraum kein Filter wirkt — und nie im gewählten
      Bereich, dort zählen gerade nicht alle. */
  function kostenUmfang(f, imBereich = false) {
    const { filterAnzahl } = typeof module !== 'undefined' ? require('./berichte.js') : window;
    if (filterAnzahl(filterOhneZeitraum(f)) > 0) return 'nach Filter, auch archivierte';
    if (imBereich) return 'auch archivierte';
    return 'alle Spalten, auch archivierte';
  }

  /** Rückfall (R00105 B0376, generisch R00145 FA 2): führt die offene Aufgabe den gemerkten Anzeigeschlüssel nicht
   *  (`tab ∉ schluessel`), gilt „Inhalt“. Die Regel selbst steht einmal in `rueckfallAnsicht` (web/reiter.js); hier kommt
   *  nur der Fokus hinzu: der Ansichts-Auslöser, wenn er auf dem Auslöser, im Ansichtsmenü oder im gezeichneten Panel lag —
   *  sonst bleibt der Fokus, wo er ist (ADR-0010). */
  function reiterRueckfall(lage) {
    const { rueckfallAnsicht } = typeof module !== 'undefined' ? require('./reiter.js') : window;
    if (rueckfallAnsicht(lage.schluessel, lage.tab) === lage.tab) return null;
    return { tab: 'inhalt', fokus: lage.fokusBeiReiter ? '#fenster [data-act="fenster-menue"][data-arg="ansicht"]' : null };
  }

  Object.assign(ziel, { kostenInCent, geld, spanne, preisetikett, angefallenAufKarte, reiterRueckfall, kostentabelle, hatAltePosten, kosteneintragstabelle, kostenbericht, kostenaufstellung, kostenbereichGewaehlt, kostenSpaltenwahl, filterOhneZeitraum, kostenUmfang });
})(typeof module !== 'undefined' ? module.exports : window);
