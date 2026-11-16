/* kanbanD — kleines, sicheres Markdown: erst maskieren, dann formatieren. Im Browser und in Node nutzbar. */
(function (ziel) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** Positivliste (ADR-0030 Punkt 4): kein Zeichen ≤ U+0020 und kein U+007F (der Browser überliest solche Zeichen vor dem Schema), dazu http, https, mailto, vscode oder ohne Schema (relativ). */
  const erlaubt = url => !/[\u0000-\u0020\u007f]/.test(url) && (/^(https?|mailto|vscode):/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url));

  /** Eine Zeile ohne Blöcke (ADR-0030 Punkt 7): Code, Links, nackte Adressen, fett, kursiv — jede neue Form der Zeile
   *  entsteht hier und gilt damit für beide Einstiege, `markdownInline` und `markdownHtml`. Jede fertige Marke wird sofort durch
   *  einen Platzhalter (U+0000 Nummer U+0000) ersetzt: keine spätere Stufe greift in die Ausgabe einer früheren, und eine
   *  Adresse wird nie formatiert (ADR-0030 Punkt 5). U+0000 aus dem Text wird vorher entfernt, sonst ließe sich der Platzhalter fälschen. */
  function markdownInline(text) {
    const fertig = [];
    const schuetze = html => `\u0000${fertig.push(html) - 1}\u0000`;
    const einsetzen = s => s.replace(/\u0000(\d+)\u0000/g, (m, i) => fertig[+i]);
    const hervorheben = s => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    const link = (u, innen) => schuetze(`<a href="${u}" target="_blank" rel="noopener">${innen}</a>`);
    const gueltig = u => erlaubt(u.replace(/&amp;/g, '&'));
    let s = esc(String(text).replace(/\u0000/g, '')).replace(/`([^`]+)`/g, (m, c) => schuetze(`<code>${c}</code>`));
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => gueltig(u) ? link(u, einsetzen(hervorheben(t))) : t);
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)\u0000]+)/g, (m, vor, u) => gueltig(u) ? vor + link(u, u) : m);
    return einsetzen(hervorheben(s));
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
  function tabelleHtml(kopfzeile, spalten, zeilen) {
    const zeile = (marke, texte) => `<tr>${spalten.map((klasse, i) => `<${marke}${klasse}>${markdownInline(texte[i] || '')}</${marke}>`).join('')}</tr>`;
    let rumpf = '';
    if (zeilen.length) rumpf = `<tbody>${zeilen.map(z => zeile('td', zellen(z))).join('')}</tbody>`;
    return `<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table><thead>${zeile('th', zellen(kopfzeile))}</thead>${rumpf}</table></div>`;
  }

  const UEBERSCHRIFT = /^(#{1,3})\s+(.*)$/, PUNKT = /^\s*[-*+]\s+(.*)$/, NUMMER = /^\s*\d+[.)]\s+(.*)$/, ZITAT = /^>\s?(.*)$/, ZAUN = /^```/;
  const blockBeginn = z => ZAUN.test(z) || UEBERSCHRIFT.test(z) || PUNKT.test(z) || NUMMER.test(z) || ZITAT.test(z);

  /** Markdown → HTML. Überschriften werden um `stufe` verschoben (# → h(1+stufe)). */
  function markdownHtml(md, stufe = 2) {
    const zeilen = (md || '').replace(/\r\n/g, '\n').split('\n');
    const aus = [];
    let absatz = [], liste = null;
    /** Bis zu dieser Zeile (ausschließlich) wird keine Tabelle gesucht: der Block war zu groß und bleibt Text. */
    let textBis = 0, zellenFrei = MAX_ZELLEN;
    const absatzEnde = () => { if (absatz.length) { aus.push(`<p>${absatz.map(markdownInline).join('<br>')}</p>`); absatz = []; } };
    const listeEnde = () => { if (liste) { aus.push(`<${liste.art}>${liste.punkte.map(p => `<li>${markdownInline(p)}</li>`).join('')}</${liste.art}>`); liste = null; } };
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (ZAUN.test(z)) {
        absatzEnde(); listeEnde();
        const code = [];
        for (i++; i < zeilen.length && !ZAUN.test(zeilen[i]); i++) code.push(zeilen[i]);
        aus.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
        continue;
      }
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
          aus.push(tabelleHtml(z, spalten, zeilen.slice(i + 2, ende)));
          i = ende - 1;
          continue;
        }
      }
      let m;
      if ((m = UEBERSCHRIFT.exec(z))) { absatzEnde(); listeEnde(); const h = Math.min(6, m[1].length + stufe); aus.push(`<h${h}>${markdownInline(m[2])}</h${h}>`); }
      else if ((m = PUNKT.exec(z)) || (m = NUMMER.exec(z))) {
        absatzEnde();
        const art = /^\s*\d/.test(z) ? 'ol' : 'ul';
        if (liste && liste.art !== art) listeEnde();
        if (!liste) liste = { art, punkte: [] };
        liste.punkte.push(m[1]);
      } else if ((m = ZITAT.exec(z))) { absatzEnde(); listeEnde(); aus.push(`<blockquote>${markdownInline(m[1])}</blockquote>`); }
      else if (!z.trim()) { absatzEnde(); listeEnde(); }
      else { listeEnde(); absatz.push(z); }
    }
    absatzEnde(); listeEnde();
    return aus.join('');
  }

  Object.assign(ziel, { markdownHtml, markdownInline, markdownOhneMarken });
})(typeof module !== 'undefined' ? module.exports : window);
