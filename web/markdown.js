/* kanbanD — kleines, sicheres Markdown: erst maskieren, dann formatieren. Im Browser und in Node nutzbar. */
(function (ziel) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /** Positivliste (ADR-0030 Punkt 4): kein Zeichen ≤ U+0020 und kein U+007F (der Browser überliest solche Zeichen vor dem Schema), dazu http, https, mailto, vscode oder ohne Schema (relativ). */
  const erlaubt = url => !/[\u0000-\u0020\u007f]/.test(url) && (/^(https?|mailto|vscode):/i.test(url) || !/^[a-z][a-z0-9+.-]*:/i.test(url));

  /** Inline: Code, Links, nackte Adressen, fett, kursiv — auf bereits maskiertem Text. Jede fertige Marke wird sofort durch
   *  einen Platzhalter (U+0000 Nummer U+0000) ersetzt: keine spätere Stufe greift in die Ausgabe einer früheren, und eine
   *  Adresse wird nie formatiert (ADR-0030 Punkt 5). U+0000 aus dem Text wird vorher entfernt, sonst ließe sich der Platzhalter fälschen. */
  function inline(text) {
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

  /** Markdown → HTML. Überschriften werden um `stufe` verschoben (# → h(1+stufe)). */
  function markdownHtml(md, stufe = 2) {
    const zeilen = (md || '').replace(/\r\n/g, '\n').split('\n');
    const aus = [];
    let absatz = [], liste = null;
    const absatzEnde = () => { if (absatz.length) { aus.push(`<p>${absatz.map(inline).join('<br>')}</p>`); absatz = []; } };
    const listeEnde = () => { if (liste) { aus.push(`<${liste.art}>${liste.punkte.map(p => `<li>${inline(p)}</li>`).join('')}</${liste.art}>`); liste = null; } };
    for (let i = 0; i < zeilen.length; i++) {
      const z = zeilen[i];
      if (/^```/.test(z)) {
        absatzEnde(); listeEnde();
        const code = [];
        for (i++; i < zeilen.length && !/^```/.test(zeilen[i]); i++) code.push(zeilen[i]);
        aus.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
        continue;
      }
      let m;
      if ((m = /^(#{1,3})\s+(.*)$/.exec(z))) { absatzEnde(); listeEnde(); const h = Math.min(6, m[1].length + stufe); aus.push(`<h${h}>${inline(m[2])}</h${h}>`); }
      else if ((m = /^\s*[-*+]\s+(.*)$/.exec(z)) || (m = /^\s*\d+[.)]\s+(.*)$/.exec(z))) {
        absatzEnde();
        const art = /^\s*\d/.test(z) ? 'ol' : 'ul';
        if (liste && liste.art !== art) listeEnde();
        if (!liste) liste = { art, punkte: [] };
        liste.punkte.push(m[1]);
      } else if ((m = /^>\s?(.*)$/.exec(z))) { absatzEnde(); listeEnde(); aus.push(`<blockquote>${inline(m[1])}</blockquote>`); }
      else if (!z.trim()) { absatzEnde(); listeEnde(); }
      else { listeEnde(); absatz.push(z); }
    }
    absatzEnde(); listeEnde();
    return aus.join('');
  }

  Object.assign(ziel, { markdownHtml });
})(typeof module !== 'undefined' ? module.exports : window);
