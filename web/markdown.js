/* kanbanD — kleines, sicheres Markdown: erst maskieren, dann formatieren. Im Browser und in Node nutzbar. */
(function (ziel) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** Positivliste (ADR-0030 Punkt 4): kein Zeichen ≤ U+0020 und kein U+007F (der Browser überliest solche Zeichen vor dem Schema), dazu http, https, mailto, vscode oder ohne Schema (relativ). */
  const erlaubt = url => !/[\u0000-\u0020\u007f]/.test(url) && (/^(https?|mailto|vscode):/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url));

  /** `__fett__`, `~~durchgestrichen~~` und `_kursiv_` nur an Wortgrenzen (ADR-0030 Punkt 6, R00178 AK 2): davor und danach
   *  steht weder Buchstabe, Ziffer noch Unterstrich — und kein Zeichen, das einen Bezeichner fortsetzt (`__init__.py`,
   *  `obj.__dict__`, `__init__()`). Der Inhalt beginnt und endet ohne Leerraum und trägt das eigene Zeichen nicht: so endet
   *  jede Suche am nächsten Zeichen derselben Art, ohne Rücklauf über die Zeile. */
  const WORT = '[\\p{L}\\p{N}_]', KLEBT = '[.\\-/:@\\\\]';
  const inhalt = zeichen => `([^${zeichen}\\s](?:[^${zeichen}]*[^${zeichen}\\s])?)`;
  const AN_WORTGRENZEN = new RegExp(`(?<!${WORT}|${WORT}${KLEBT})(?:__${inhalt('_')}__|~~${inhalt('~')}~~|_${inhalt('_')}_)(?!${WORT}|${KLEBT}${WORT}|\\()`, 'gu');

  /** Ersetzt jedes `[Text](Adresse)` durch `ersatz(text, adresse)` — in einem Durchlauf von links nach rechts, mit der
   *  Rechenzeit linear in der Länge (ADR-0030 Punkt 9, Karte #186 Befund M1). Es findet dieselben Stellen wie das Muster
   *  `\[([^\]]+)\]\(([^)\s]+)\)`, das von jeder öffnenden Klammer bis zum Zeilenende suchte: der Text reicht von einem `[`
   *  bis zum nächsten `]`, die Adresse danach in runden Klammern ohne Leerraum. Scheitert ein `[`, scheitern alle weiteren
   *  vor demselben `]` ebenso — die Suche geht dahinter weiter; das Ende einer Adresse wird je Strecke nur einmal gesucht. */
  function ersetzeLinks(s, ersatz) {
    const ADRESSENDE = /[)\s]/g;
    const stuecke = [];
    /** Für jeden Beginn zwischen `endeGesuchtAb` und `adressende` endet die Adresse bei `adressende` (Länge von `s`: nirgends). */
    let endeGesuchtAb = -1, adressende = -1;
    let uebernommen = 0, sucheAb = 0;
    while (sucheAb < s.length) {
      const auf = s.indexOf('[', sucheAb);
      if (auf < 0) break;
      const zu = s.indexOf(']', auf + 1);
      if (zu < 0) break;
      const beginn = zu + 2;
      let istLink = false;
      if (zu > auf + 1 && s[zu + 1] === '(') {
        if (beginn < endeGesuchtAb || beginn > adressende) {
          ADRESSENDE.lastIndex = beginn;
          const fund = ADRESSENDE.exec(s);
          endeGesuchtAb = beginn;
          adressende = s.length;
          if (fund) adressende = fund.index;
        }
        istLink = adressende > beginn && s[adressende] === ')';
      }
      if (istLink) {
        stuecke.push(s.slice(uebernommen, auf), ersatz(s.slice(auf + 1, zu), s.slice(beginn, adressende)));
        uebernommen = sucheAb = adressende + 1;
      } else sucheAb = zu + 1;
    }
    stuecke.push(s.slice(uebernommen));
    return stuecke.join('');
  }

  /** Eine Zeile ohne Blöcke (ADR-0030 Punkt 7): Code, Links, nackte Adressen, fett, kursiv, durchgestrichen — jede neue Form
   *  der Zeile entsteht hier und gilt damit für beide Einstiege, `markdownInline` und `markdownHtml`. Jede fertige Marke wird
   *  sofort durch einen Platzhalter (U+0000 Nummer U+0000) ersetzt: keine spätere Stufe greift in die Ausgabe einer früheren, und
   *  eine Adresse wird nie formatiert (ADR-0030 Punkt 5). U+0000 aus dem Text wird vorher entfernt, sonst ließe sich der Platzhalter fälschen.
   *  Mit der Option `pfade` (R00242 FA 3, Vorgabe aus) ist `text` roh: Pfade und Code entstehen vor `pfade.sichtbar` und `esc`. */
  function markdownInline(text, optionen = {}) {
    const fertig = [];
    const schuetze = html => `\u0000${fertig.push(html) - 1}\u0000`;
    /** Ein Platzhalter kann in einer geschützten Marke stehen (Link in kursivem Text): eingesetzt wird bis in die Tiefe. */
    const einsetzen = s => {
      // U+0000 steht nur um die Nummern der Platzhalter: jedes zweite Stück ist eine Nummer.
      const stuecke = s.split('\u0000');
      for (let i = 1; i < stuecke.length; i += 2) {
        const marke = fertig[+stuecke[i]];
        if (marke.includes('\u0000')) stuecke[i] = einsetzen(marke);
        else stuecke[i] = marke;
      }
      return stuecke.join('');
    };
    const sterne = s => (s.includes('*') ? s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>') : s);
    /** Die Formen an Wortgrenzen zuerst, jede samt Inhalt geschützt: die Sterne danach schließen nie über ihre Marke hinweg. */
    const hervorheben = s => {
      if (!/[*_~]/.test(s)) return s;
      return sterne(s.replace(AN_WORTGRENZEN, (m, fett, durch, kursiv) => {
        if (fett !== undefined) return schuetze(`<strong>${hervorheben(fett)}</strong>`);
        if (durch !== undefined) return schuetze(`<del>${hervorheben(durch)}</del>`);
        return schuetze(`<em>${hervorheben(kursiv)}</em>`);
      }));
    };
    const link = (u, innen) => schuetze(`<a href="${u}" target="_blank" rel="noopener">${innen}</a>`);
    const gueltig = u => erlaubt(u.replace(/&amp;/g, '&'));
    let s;
    if (optionen.pfade) s = pfadeUndCode(String(text), optionen.pfade, schuetze);
    else s = esc(String(text).replace(/\u0000/g, '')).replace(/`([^`]+)`/g, (m, c) => schuetze(`<code>${c}</code>`));
    s = ersetzeLinks(s, (t, u) => (gueltig(u) ? link(u, einsetzen(hervorheben(t))) : t));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)\u0000]+)/g, (m, vor, u) => gueltig(u) ? vor + link(u, u) : m);
    s = hervorheben(s);
    if (!fertig.length) return s;
    return einsetzen(s);
  }

  /** Roher Text → maskierter, sichtbar gemachter Text, in dem Code und die Links der Pfade geschützt stehen (R00242 FA 3): `pfade.code`
   *  setzt einen Inline-Code, den ein Pfad ganz füllt, `pfade.finden` liefert die Pfade eines Textstücks; ein Durchlauf. */
  function pfadeUndCode(roh, pfade, schuetze) {
    const sichtbar = t => esc(pfade.sichtbar(t).replace(/\u0000/g, ''));
    /* Der Text eines Markdown-Links `[text](adresse)` wird nie verlinkt: ein Link im Link gibt es nicht. */
    const imLinkText = von => linkTexte.some(([a, b]) => von >= a && von < b);
    const linkTexte = [...roh.matchAll(/\[[^\]]*\]\([^)\s]*\)/g)].map(m => [m.index, m.index + m[0].indexOf('](')]);
    const textMitPfaden = (stueck, versatz) => {
      let aus = '', ab = 0;
      for (const fund of pfade.finden(stueck)) {
        if (imLinkText(versatz + fund.von)) continue;
        aus += sichtbar(stueck.slice(ab, fund.von)) + schuetze(fund.html);
        ab = fund.bis;
      }
      return aus + sichtbar(stueck.slice(ab));
    };
    let s = '', ab = 0;
    for (const m of roh.matchAll(/`([^`]+)`/g)) {
      let code = imLinkText(m.index) ? null : pfade.code(m[1]);
      if (code === null) code = `<code>${sichtbar(m[1])}</code>`;
      s += textMitPfaden(roh.slice(ab, m.index), ab) + schuetze(code);
      ab = m.index + m[0].length;
    }
    return s + textMitPfaden(roh.slice(ab), ab);
  }

  /** Der Text einer Zeile ohne Markdown-Zeichen, maskiert wie die Ausgabe von `markdownInline` — für zugängliche Namen;
   *  in einem Attribut braucht er kein weiteres `esc()`. Jede Marke stammt aus dem Renderer, im Text selbst steht kein `<`. */
  const markdownOhneMarken = text => markdownInline(text).replace(/<[^>]*>/g, '');

  /** Zerlegt eine ROHE Zeile an `|` in Zellen (GFM): ein Strich am Rand zählt nicht, `\|` trennt nicht und bleibt ein `|`.
   *  Ein unmaskierter Strich trennt auch mitten in Code oder einer Adresse. Zerlegt wird nie fertiges HTML: erst die
   *  Zelle läuft durch `markdownInline()`, jede mit eigenen Platzhaltern (ADR-0030 Punkte 1 und 5). */
  function zellen(zeile) {
    const teile = [];
    const roh = zeile.trim();
    let zelle = '';
    for (let i = 0; i < roh.length; i++) {
      if (roh[i] === '\\' && roh[i + 1] === '|') { zelle += '|'; i++; }
      else if (roh[i] === '|') { teile.push(zelle); zelle = ''; }
      else zelle += roh[i];
    }
    teile.push(zelle);
    if (teile.length > 1 && !teile[0].trim()) teile.shift();
    if (teile.length > 1 && !teile[teile.length - 1].trim()) teile.pop();
    return teile.map(teil => teil.trim());
  }

  /** Die Klasse einer Spalte kommt aus dieser festen Liste, nie aus dem Text (ADR-0030 Punkt 3). */
  function ausrichtung(trennzelle) {
    const links = trennzelle.startsWith(':'), rechts = trennzelle.endsWith(':');
    if (links && rechts) return ' class="ta-c"';
    if (links) return ' class="ta-l"';
    if (rechts) return ' class="ta-r"';
    return '';
  }

  /** Obergrenzen (ADR-0030 Punkt 9): kurze Zeilen werden auf die Spaltenzahl des Kopfs aufgefüllt, die Ausgabe wüchse sonst
   *  mit Spalten × Zeilen statt mit der Eingabe. Höchstens MAX_SPALTEN je Tabelle und MAX_ZELLEN je Aufruf des Renderers
   *  (alle Tabellen eines Textes zusammen, Kopfzeilen mitgezählt); was darüber liegt, bleibt als ganzer Block Text. */
  const MAX_SPALTEN = 50, MAX_ZELLEN = 5000;

  /** Die Klassen je Spalte, wenn auf `kopfzeile` eine gültige Trennzeile folgt (GFM: mindestens ein `|`, je Zelle nur
   *  `-` mit `:` am Rand, so viele Zellen wie der Kopf) — sonst null, und beide Zeilen bleiben Text. */
  function tabellenSpalten(kopfzeile, trennzeile) {
    if (trennzeile === undefined || !kopfzeile.includes('|') || !trennzeile.includes('|')) return null;
    // Eine gültige Trennzeile hat höchstens einen Strich mehr als Spalten: zu breite Tabellen fallen vor dem Zerlegen heraus.
    if (trennzeile.split('|').length - 2 > MAX_SPALTEN) return null;
    const trennzellen = zellen(trennzeile);
    if (trennzellen.length > MAX_SPALTEN || trennzellen.length !== zellen(kopfzeile).length || !trennzellen.every(t => /^:?-+:?$/.test(t))) return null;
    return trennzellen.map(ausrichtung);
  }

  /** Die Hülle zum Scrollen trägt ihre drei Attribute fest: sie macht die Tabelle mit der Tastatur erreichbar (R00176). */
  function tabelleHtml(kopfzeile, spalten, zeilen, zelle) {
    const zeile = (marke, texte) => `<tr>${spalten.map((klasse, i) => `<${marke}${klasse}>${zelle(texte[i] || '')}</${marke}>`).join('')}</tr>`;
    let rumpf = '';
    if (zeilen.length) rumpf = `<tbody>${zeilen.map(z => zeile('td', zellen(z))).join('')}</tbody>`;
    return `<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table><thead>${zeile('th', zellen(kopfzeile))}</thead>${rumpf}</table></div>`;
  }

  const UEBERSCHRIFT = /^(#{1,4})\s+(.*)$/, PUNKT = /^(\s*)[-*+]\s+(.*)$/, NUMMER = /^(\s*)\d+[.)]\s+(.*)$/, ZITAT = /^>\s?(.*)$/, ZAUN = /^```/;
  /** Die Trennlinie (R00178 AK 4): nur Minuszeichen, mindestens drei, allein auf der Zeile — `***` und `___` bleiben Text. */
  const LINIE = /^ {0,3}-{3,}[ \t]*$/;
  const blockBeginn = z => ZAUN.test(z) || LINIE.test(z) || UEBERSCHRIFT.test(z) || PUNKT.test(z) || NUMMER.test(z) || ZITAT.test(z);

  /** Geschachtelte Listen (R00178 AK 3): höchstens MAX_EBENEN ineinander, darüber bleibt die Einrückung flach — so wächst die
   *  Ausgabe mit der Zahl der Zeilen, nie mit der Tiefe (ADR-0030 Punkt 9). Ein Tabulator rückt um TAB_BREITE Zeichen ein. */
  const MAX_EBENEN = 8, TAB_BREITE = 4;
  const einrueckung = leerraum => leerraum.length + (TAB_BREITE - 1) * (leerraum.split('\t').length - 1);

  /** Markdown → HTML. Überschriften werden um `stufe` verschoben (# → h(1+stufe)). Mit der Option `pfade` (R00242 FA 3) ist `md` roh:
   *  die Blöcke erkennt der sichtbar gemachte Text wie ohne Option, den Inhalt einer Zeile setzt `markdownInline` aus dem rohen. */
  function markdownHtml(md, stufe = 2, optionen = {}) {
    const roh = (md || '').replace(/\r\n/g, '\n').split('\n');
    let zeilen = roh;
    if (optionen.pfade) zeilen = roh.map(optionen.pfade.sichtbar);
    /** Inhalt `rest` am Ende der Zeile `i`: ein Präfix aus Block-Zeichen trägt nie ein sichtbar gemachtes Zeichen, also ist er roh gleich lang. */
    const inline = (i, rest) => {
      if (!optionen.pfade) return markdownInline(rest);
      return markdownInline(roh[i].slice(zeilen[i].length - rest.length), optionen);
    };
    let tabelle = { zeilen, zelle: markdownInline };
    if (optionen.pfade) tabelle = { zeilen: roh, zelle: t => markdownInline(t, optionen) };
    const aus = [];
    let absatz = [];
    /** Die offenen Listen von außen nach innen, je mit Art und Einrückung; der letzte Punkt jeder Ebene ist noch offen. */
    const ebenen = [];
    /** Bis zu dieser Zeile (ausschließlich) wird keine Tabelle gesucht: der Block war zu groß und bleibt Text. */
    let textBis = 0, zellenFrei = MAX_ZELLEN;
    const absatzEnde = () => { if (absatz.length) { aus.push(`<p>${absatz.map(i => inline(i, zeilen[i])).join('<br>')}</p>`); absatz = []; } };
    const ebeneZu = () => aus.push(`</li></${ebenen.pop().art}>`);
    const ebeneAuf = (art, breite) => { aus.push(`<${art}><li>`); ebenen.push({ art, breite }); };
    const listeEnde = () => { while (ebenen.length) ebeneZu(); };
    /** Ein Punkt gehört zur innersten Ebene, die nicht tiefer eingerückt ist als er; mindestens zwei Zeichen mehr öffnen eine
     *  neue Ebene in ihrem offenen Punkt, eine andere Art (Punkt statt Nummer) beginnt auf gleicher Ebene eine neue Liste. */
    const listenpunkt = (art, breite, html) => {
      while (ebenen.length > 1 && ebenen[ebenen.length - 1].breite > breite) ebeneZu();
      const innen = ebenen[ebenen.length - 1];
      // nur die äußerste Ebene kann tiefer eingerückt sein als der Punkt: sie rückt mit ihm nach links
      if (innen && innen.breite > breite) innen.breite = breite;
      if (!innen || (breite > innen.breite + 1 && ebenen.length < MAX_EBENEN)) ebeneAuf(art, breite);
      else if (innen.art === art) aus.push('</li><li>');
      else { ebeneZu(); ebeneAuf(art, innen.breite); }
      aus.push(html);
    };
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (ZAUN.test(z)) {
        absatzEnde(); listeEnde();
        const code = [];
        for (i++; i < zeilen.length && !ZAUN.test(zeilen[i]); i++) code.push(zeilen[i]);
        aus.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
        continue;
      }
      // Vor Überschrift und Tabelle: eine Zeile nur aus Minuszeichen ist nie Kopf- oder Trennzeile (die trägt einen Strich).
      if (LINIE.test(z)) { absatzEnde(); listeEnde(); aus.push('<hr>'); continue; }
      let spalten = null;
      if (i >= textBis) spalten = tabellenSpalten(z, zeilen[i + 1]);
      if (spalten) {
        // Die Tabelle reicht bis zur Leerzeile oder zum nächsten Block; sie beendet Absatz und Liste (R00176 AK 5).
        let ende = i + 2;
        while (ende < zeilen.length && zeilen[ende].trim() && !blockBeginn(zeilen[ende])) ende++;
        const zellenzahl = spalten.length * (ende - i - 1);
        if (zellenzahl > zellenFrei) textBis = ende;
        else {
          zellenFrei -= zellenzahl;
          absatzEnde(); listeEnde();
          aus.push(tabelleHtml(tabelle.zeilen[i], spalten, tabelle.zeilen.slice(i + 2, ende), tabelle.zelle));
          i = ende - 1;
          continue;
        }
      }
      let m;
      if ((m = UEBERSCHRIFT.exec(z))) { absatzEnde(); listeEnde(); const h = Math.min(6, m[1].length + stufe); aus.push(`<h${h}>${inline(i, m[2])}</h${h}>`); }
      else if ((m = PUNKT.exec(z)) || (m = NUMMER.exec(z))) {
        absatzEnde();
        let art = 'ul';
        if (NUMMER.test(z)) art = 'ol';
        listenpunkt(art, einrueckung(m[1]), inline(i, m[2]));
      } else if ((m = ZITAT.exec(z))) { absatzEnde(); listeEnde(); aus.push(`<blockquote>${inline(i, m[1])}</blockquote>`); }
      else if (!z.trim()) { absatzEnde(); listeEnde(); }
      else { listeEnde(); absatz.push(i); }
    }
    absatzEnde(); listeEnde();
    return aus.join('');
  }

  Object.assign(ziel, { markdownHtml, markdownInline, markdownOhneMarken });
})(typeof module !== 'undefined' ? module.exports : window);
