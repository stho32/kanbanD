// R00242 (Karte #264, C2 „Pfade“): Wurzeln aus dem Auftragskopf, Marke am Pfad, Links nach VS Code aus Nachrichten, Pfadfeld und
// `<persisted-output>` — reine Bausteine aus web/lauf-satz.js und web/markdown.js, dazu die ganze Insel von T14 aus web/lauf.js.
// Proben aus ADR-0041 N4 „Durchsetzung“ (soweit Pfade), AK 1, 3, 4, 6, 9 und die Rechenbeispiele von R00242.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const satz = require('../../web/lauf-satz.js');
const lauf = require('../../web/lauf.js');
const { markdownInline, markdownHtml } = require('../../web/markdown.js');
const { vscodeLink } = require('../../web/review-uebersicht.js');
const { sichtbarText } = require('../../web/diff.js');
const t14 = require('../tests/laufansicht-t14.js');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const zeile = t => esc(sichtbarText(t));
const ent = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/** Die Links eines HTML-Stücks als `{href, title, label, text}` (Attribute entmaskiert, Text ohne Tags). */
function links(html) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, innen]) => {
    const attr = name => {
      const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
      if (m === null) return null;
      return ent(m[1]);
    };
    return { href: attr('href'), title: attr('title'), label: attr('aria-label'), text: ent(innen.replace(/<[^>]+>/g, '')) };
  });
}
/** Sichtbarer Text eines Stücks: eine Marke zeigt `data-marke`, ihr verborgener Anfang zählt nicht. */
function sichtbar(html) {
  return ent(html.replace(/<span class="lv-mk" data-marke="([^"]*)"><span class="vh">[^<]*<\/span><\/span>/g, '$1')
    .replace(/<span class="lv-anf"><span class="vh">[^<]*<\/span><\/span>/g, '').replace(/<[^>]+>/g, ''));
}
const wurzelnT14 = () => satz.pfadMarken(t14.KOPF);
const alsZeilen = eintraege => eintraege.map((e, i) => ({ nr: i + 1, eintrag: { name: null, ...e } }));
const pfadeT14 = (ergebnis = null) => ({ wurzeln: wurzelnT14(), ergebnis });

/* ── AK 1: Wurzeln aus dem Auftragskopf ── */

test('AK 1: pfadMarken(Nr 1 von T14) ergibt genau die drei Wurzeln des Rechenbeispiels, /w/fab (Factory) ist keine', () => {
  const paare = wurzelnT14().map(w => [w.wurzel, w.marke]).sort();
  assert.deepStrictEqual(paare, [['/w/demo', '‹demo›'], ['/w/fab/ablage/plan-7', '‹Ablage›'], ['/w/wt/demo/karte-7', '‹Worktree #7›']]);
});

test('AK 1: Arbeitsort ohne karte-<n> heißt ‹Arbeitsort›; längster Treffer, nur an der Grenze /', () => {
  assert.deepStrictEqual(satz.pfadMarken('Arbeitsort: /w/arbeit').map(w => w.marke), ['‹Arbeitsort›']);
  const w = satz.pfadMarken('Projekt: /a/b\nArbeitsort: /a/b/wt/karte-3');
  const kurz = pfad => sichtbar(satz.pfadLinkHtml(pfad, null, w, false, zeile));
  assert.strictEqual(kurz('/a/b/wt/karte-3/x'), '‹Worktree #3›/x');
  assert.strictEqual(kurz('/a/b/y'), '‹b›/y');
  assert.strictEqual(kurz('/a/bc/z'), '/a/bc/z');
  assert.strictEqual(kurz('/a/b'), '‹b›', 'Pfad gleich der Wurzel: nur die Marke');
  assert.strictEqual(sichtbar(satz.pfadLinkHtml('/w/fab/ablage/plan-70/x', null, wurzelnT14(), false, zeile)), '/w/fab/ablage/plan-70/x');
});

test('AK 1: Wurzel mit Bidi- oder Steuerzeichen ergibt keine Marke; ohne die drei Schlüssel keine Wurzel', () => {
  assert.deepStrictEqual(satz.pfadMarken('Projekt: /w/de‮mo'), []);
  assert.deepStrictEqual(satz.pfadMarken('Projekt: /w/de\u001Bmo'), []);
  assert.deepStrictEqual(satz.pfadMarken('Bitte /w/demo/a.js prüfen.\nFactory: /w/fab'), []);
});

test('AK 1: Kopf eines echten Auftrags der Factory ergibt ‹kanbanD›, ‹Worktree #264› und ‹Ablage›', () => {
  const kopf = 'Projekt: /p/kanbanD  ·  Factory: /p/fab\nArbeitsort: Worktree /p/.worktrees/kanbanD/karte-264, Zweig karte/264. Arbeite nur dort.\nAblage: /p/fab/gemeinsam/scratchpad/plan-264/ (nur dieser Ordner)';
  assert.deepStrictEqual(satz.pfadMarken(kopf).map(w => [w.wurzel, w.marke]).sort(),
    [['/p/.worktrees/kanbanD/karte-264', '‹Worktree #264›'], ['/p/fab/gemeinsam/scratchpad/plan-264', '‹Ablage›'], ['/p/kanbanD', '‹kanbanD›']]);
});

test('AK 1: laufAuswerten liest die Wurzeln nur aus der ersten Nachricht von mensch', () => {
  assert.strictEqual(lauf.laufAuswerten(alsZeilen(t14.T14), false).wurzeln.length, 3);
  const spaeter = alsZeilen([{ zeit: null, art: 'nachricht', wer: 'mensch', text: 'Los.' }, { zeit: null, art: 'nachricht', wer: 'mensch', text: 'Projekt: /w/demo' }]);
  assert.deepStrictEqual(lauf.laufAuswerten(spaeter, false).wurzeln, []);
  assert.deepStrictEqual(lauf.laufAuswerten(alsZeilen(t14.T14O), false).wurzeln, []);
});

/* ── AK 3: Links in Nachrichten (Option `pfade` an markdownInline) ── */

const nachrichtPfade = wurzeln => ({ sichtbar: sichtbarText, finden: roh => satz.pfadeFinden(roh, wurzeln, zeile), code: roh => satz.pfadImCodeHtml(roh, wurzeln, zeile) });

test('AK 3: Nr 16 trägt genau vier Links mit den href des Rechenbeispiels, der erste mit code „web/a.js“, title voller Pfad', () => {
  const html = markdownInline(t14.NACHRICHT_16, { pfade: nachrichtPfade(wurzelnT14()) });
  const l = links(html);
  assert.deepStrictEqual(l.map(x => x.href), ['vscode://file/w/wt/demo/karte-7/web/a.js', 'vscode://file/w/demo/src/b.rs:42', 'vscode://file/w/demo/a%26b.js', 'vscode://file/w/demox/c.rs']);
  assert.deepStrictEqual(l.map(x => x.title), ['/w/wt/demo/karte-7/web/a.js', '/w/demo/src/b.rs:42', '/w/demo/a&b.js', '/w/demox/c.rs']);
  assert.match(html, /<a [^>]*><code>[\s\S]*web\/a\.js<\/code><\/a>/);
  assert.match(html, /<code>cat web\/a\.js<\/code>/, 'Code mit Text daneben bleibt Code');
  assert.ok(sichtbar(html).includes('‹demo›/src/b.rs:42'), sichtbar(html));
  assert.ok(sichtbar(html).includes('nicht ../x/y.js'));
  assert.ok(html.includes('/w/demo/⟨U+202E⟩d.rs'), 'U+202E sichtbar gemacht, ohne Link');
});

test('AK 3: Nr 1 trägt Links auf Projekt, Factory, Arbeitsort, Ablage und auftrag.md (Punkt am Ende nicht im Pfad), karte/7 keinen', () => {
  const html = markdownHtml(t14.KOPF, 1, { pfade: nachrichtPfade(wurzelnT14()) });
  assert.deepStrictEqual(links(html).map(x => x.href), ['vscode://file/w/demo', 'vscode://file/w/fab', 'vscode://file/w/wt/demo/karte-7', 'vscode://file/w/fab/ablage/plan-7', 'vscode://file/w/fab/ablage/plan-7/auftrag.md']);
  assert.ok(sichtbar(html).startsWith('Projekt: ‹demo›  ·  Factory: /w/fab'), sichtbar(html));
  assert.ok(sichtbar(html).includes('auftrag.md.'), 'der Punkt steht als Text hinter dem Link');
});

test('AK 3: ohne Arbeitsort kein relativer Link; ohne Option pfade unverändert, auch eine Kartenbeschreibung mit Pfad', () => {
  const html = markdownInline('Bitte /w/demo/a.js und `web/a.js` prüfen.', { pfade: nachrichtPfade([]) });
  assert.deepStrictEqual(links(html).map(x => x.href), ['vscode://file/w/demo/a.js']);
  assert.match(html, /<code>web\/a\.js<\/code>/);
  for (const text of [t14.NACHRICHT_16, t14.KOPF, 'siehe /w/demo/a.js', '**fett** [x](https://a.b/c) `c` https://d.e/f']) {
    assert.strictEqual(markdownInline(text), markdownInline(text, {}), text);
    assert.doesNotMatch(markdownHtml(text), /vscode:/);
  }
});

test('AK 3: Pfade in Überschrift, Liste, Zitat und Tabelle einer Nachricht; Markdown-Link bleibt einer', () => {
  const pfade = nachrichtPfade(wurzelnT14());
  const html = markdownHtml('# Titel /w/demo/a.js\n- Punkt /w/demo/b.js\n> Zitat /w/demo/c.js\n\n| A | B |\n|---|---|\n| /w/demo/d.js | x |\n\n[Text](https://a.b/w/demo/e.js)', 1, { pfade });
  assert.deepStrictEqual(links(html).map(x => x.href), ['vscode://file/w/demo/a.js', 'vscode://file/w/demo/b.js', 'vscode://file/w/demo/c.js', 'vscode://file/w/demo/d.js', 'https://a.b/w/demo/e.js']);
});

test('AK 3: ein Pfad aus einem Teil ist kein Link, ein Code mit Satzzeichen am Ende bleibt Code, die Adresse eines Markdown-Links bleibt eine', () => {
  const pfade = nachrichtPfade(wurzelnT14());
  assert.deepStrictEqual(links(markdownInline('siehe /etc und /w/x', { pfade })).map(l => l.href), ['vscode://file/w/x']);
  const code = markdownInline('`/w/demo/a.js.` und `web/a.js:`', { pfade });
  assert.deepStrictEqual(links(code), []);
  assert.match(code, /<code>\/w\/demo\/a\.js\.<\/code> und <code>web\/a\.js:<\/code>/);
  const md = markdownInline('[Text](/w/demo/a.js)', { pfade });
  assert.strictEqual(md, markdownInline('[Text](/w/demo/a.js)'), 'die Adresse in ](…) ist kein Pfad');
});

/* ── AK 4: Pfadfeld im Aufruf ── */

test('AK 4: Read an offset, Edit an der ersten Zeile der Form cat -n, Write und NotebookEdit ohne Zeile', () => {
  const fall = (nr, ergebnis = null) => links(satz.aufrufSatz(t14.T14[nr - 1].name, t14.T14[nr - 1].text, zeile, pfadeT14(ergebnis)));
  assert.deepStrictEqual(fall(2), [{ href: 'vscode://file/w/wt/demo/karte-7/web/a.js:10', title: '/w/wt/demo/karte-7/web/a.js:10', label: '/w/wt/demo/karte-7/web/a.js:10', text: '/w/wt/demo/karte-7/web/a.js' }]);
  assert.deepStrictEqual(fall(4, t14.ERGEBNIS_5), [{ href: 'vscode://file/w/wt/demo/karte-7/web/a%20b%3Fc%23d%25e%3A12.js:42', title: `${t14.EDIT_PFAD}:42`, label: `${t14.EDIT_PFAD}:42`, text: t14.EDIT_PFAD }]);
  assert.deepStrictEqual(fall(6), [{ href: 'vscode://file/w/fab/ablage/plan-7/notiz.md', title: '/w/fab/ablage/plan-7/notiz.md', label: null, text: '/w/fab/ablage/plan-7/notiz.md' }]);
  assert.deepStrictEqual(fall(12), [{ href: 'vscode://file/w/demo/n.ipynb', title: '/w/demo/n.ipynb', label: null, text: '/w/demo/n.ipynb' }]);
  assert.strictEqual(sichtbar(satz.aufrufSatz('Read', t14.T14[1].text, zeile, pfadeT14())).includes('‹Worktree #7›/web/a.js'), true);
});

test('AK 4: command, path von Grep und ein file_path mit U+202E tragen keinen Link; Marken in command und path', () => {
  const bash = satz.aufrufSatz('Bash', t14.T14[7].text, zeile, pfadeT14());
  assert.deepStrictEqual(links(bash), []);
  assert.strictEqual(sichtbar(bash), 'cat ‹demo›/README.md &&\n ls ‹Worktree #7›/web');
  const grep = satz.aufrufSatz('Grep', t14.T14[9].text, zeile, pfadeT14());
  assert.deepStrictEqual(links(grep), []);
  assert.ok(sichtbar(grep).includes('path:‹demo›/src'), sichtbar(grep));
  const bidi = satz.aufrufSatz('Read', t14.T14[13].text, zeile, pfadeT14());
  assert.deepStrictEqual(links(bidi), []);
  assert.doesNotMatch(bidi, /lv-mk/, 'ein Pfad mit U+202E steht als Text wie heute, ohne Marke (FA 6)');
  assert.ok(bidi.includes('/w/demo/⟨U+202E⟩evil.js'));
  assert.doesNotMatch(satz.markenImText('cat /w/demo/\u202Ex.js', wurzelnT14(), zeile), /lv-mk/);
});

test('AK 4: Read ohne offset, Edit mit Ergebnis ohne cat -n und Edit ohne Ergebnis ergeben einen Link ohne Zeile', () => {
  assert.deepStrictEqual(links(satz.aufrufSatz('Read', '{"file_path":"/w/x.js"}', zeile, pfadeT14())).map(l => l.href), ['vscode://file/w/x.js']);
  const edit = '{"file_path":"/w/x.js","old_string":"a","new_string":"b"}';
  assert.deepStrictEqual(links(satz.aufrufSatz('Edit', edit, zeile, pfadeT14('The file /w/x.js has been updated successfully.'))).map(l => l.href), ['vscode://file/w/x.js']);
  assert.deepStrictEqual(links(satz.aufrufSatz('Edit', edit, zeile, pfadeT14(null))).map(l => l.href), ['vscode://file/w/x.js']);
  assert.deepStrictEqual(links(satz.aufrufSatz('Edit', edit, zeile, pfadeT14('Zeile 7 von 9\n  3\tb'))).map(l => l.href), ['vscode://file/w/x.js:3'], 'cat -n mit Tabulator');
});

test('AK 4: ohne Pfade (Vorgabe) setzt aufrufSatz wie bisher, ohne Link und ohne Marke', () => {
  assert.doesNotMatch(satz.aufrufSatz('Read', t14.T14[1].text, zeile), /<a |lv-mk/);
});

/* ── AK 5: Pfad aus <persisted-output> ── */

test('AK 5: Marke von Nr 9 wörtlich, Pfad als Link mit Marke, Vorschau ohne Link und ohne Marke', () => {
  const { html } = satz.ergebnisSatz(t14.ERGEBNIS_9, zeile, pfadeT14());
  const marke = /<p class="lv-cc">[\s\S]*?<\/p>/.exec(html)[0];
  assert.strictEqual(sichtbar(marke), 'Von Claude Code gekürzt (12,0 KB): Der Agent sah nur diese Vorschau. Vollständig: ‹Ablage›/tool-results/b1.txt');
  assert.deepStrictEqual(links(html).map(l => l.href), ['vscode://file/w/fab/ablage/plan-7/tool-results/b1.txt']);
  assert.ok(html.slice(marke.length).includes('ok /w/demo/y.txt'));
  assert.doesNotMatch(html.slice(marke.length), /lv-mk|<a /);
  const ohneForm = satz.ergebnisSatz('<persisted-output>\nkaputt\n</persisted-output>', zeile, pfadeT14()).html;
  assert.doesNotMatch(ohneForm, /<a |lv-mk/);
});

/* ── AK 6: Kodierung und Maskieren ── */

test('AK 6: jedes href ist vscodeLink des rohen Pfads; a&b ergibt %26, nie %26amp%3B', () => {
  for (const pfad of ['/w/demo/a&b.js', t14.EDIT_PFAD, '/w/demo/"><img src=x onerror=alert(1)>.js', '/w/demo/ä ö.js']) {
    const schnitt = pfad.lastIndexOf('/');
    const erwartet = vscodeLink(pfad.slice(0, schnitt), pfad.slice(schnitt + 1), null);
    assert.deepStrictEqual(links(satz.pfadLinkHtml(pfad, null, wurzelnT14(), true, zeile)).map(l => l.href), [erwartet], pfad);
  }
  assert.ok(markdownInline('siehe /w/demo/a&b.js', { pfade: nachrichtPfade([]) }).includes('href="vscode://file/w/demo/a%26b.js"'));
});

test('AK 6: "><img …> in file_path und in einer Nachricht ergibt kein img und kein weiteres Attribut', () => {
  const boese = '/w/demo/"><img src=x onerror=alert(1)>.js';
  const auf = satz.aufrufSatz('Read', JSON.stringify({ file_path: boese }), zeile, pfadeT14());
  const nach = markdownInline(`siehe ${boese} hier`, { pfade: nachrichtPfade(wurzelnT14()) });
  for (const html of [auf, nach]) {
    assert.doesNotMatch(html, /<img/);
    for (const [, attrs] of html.matchAll(/<a\b([^>]*)>/g)) {
      const ATTRIBUT = /\s([a-z-]+)="[^"]*"/g;
      assert.strictEqual(attrs.replace(ATTRIBUT, ''), '', attrs);
      assert.deepStrictEqual([...attrs.matchAll(ATTRIBUT)].map(m => m[1]).filter(n => !['class', 'href', 'title', 'aria-label'].includes(n)), []);
    }
  }
  assert.match(satz.pfadLinkHtml('/w/demo/"x".js', null, wurzelnT14(), false, zeile), /title="\/w\/demo\/&quot;x&quot;\.js"/);
  assert.doesNotMatch(satz.pfadLinkHtml('/w/q/a.js', null, satz.pfadMarken('Projekt: /w/q"><b>'), false, zeile), /data-marke="[^"]*"[^>]*"/);
});

test('AK 6: U+202E, U+001B oder ein Teil .. ergibt keinen Link, absolut wie relativ', () => {
  const w = wurzelnT14();
  for (const pfad of ['/w/demo/‮x.js', '/w/demo/\u001Bx.js', '/w/demo/../etc/x.js']) {
    assert.doesNotMatch(satz.pfadLinkHtml(pfad, null, w, true, zeile), /<a /, pfad);
    assert.doesNotMatch(markdownInline(`siehe ${pfad} hier`, { pfade: nachrichtPfade(w) }), /<a /, pfad);
  }
  for (const rel of ['../x/y.js', 'web/../x.js']) assert.doesNotMatch(markdownInline(`siehe ${rel} hier`, { pfade: nachrichtPfade(w) }), /<a /, rel);
});

test('AK 6: Projekt: /w/<b>x</b> ergibt kein Element b', () => {
  const w = satz.pfadMarken('Projekt: /w/<b>x</b>');
  assert.strictEqual(w.length, 1, 'die Wurzel mit Tags wird gelesen, sonst prüfte der Test nichts');
  assert.strictEqual(w[0].wurzel, '/w/<b>x</b>');
  const html = satz.pfadLinkHtml('/w/<b>x</b>/a.js', null, w, true, zeile);
  assert.match(html, /data-marke="‹b&gt;›"/, 'die Marke ist der letzte Teil der Wurzel, maskiert');
  assert.doesNotMatch(html, /<b>|<\/b>/);
  assert.ok(html.includes('/w/&lt;b&gt;x&lt;/b&gt;'), 'der volle Anfang steht maskiert im DOM');
  assert.ok(sichtbar(html).startsWith('‹b>›/a.js'), sichtbar(html));
});

test('AK 6: in der ganzen Insel von T14 beginnt jedes href mit vscode://file/, http(s):// oder mailto:, kein summary und kein Ergebnis trägt ein a', () => {
  const zeilen = alsZeilen(t14.T14);
  const html = lauf.laufHtml(zeilen, false, esc, lauf.laufAuswerten(zeilen, false));
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
  assert.ok(hrefs.length >= 13, `${hrefs.length} Links`);
  for (const h of hrefs) assert.match(h, /^(vscode:\/\/file\/|https?:\/\/|mailto:)/);
  for (const [s] of html.matchAll(/<summary>[\s\S]*?<\/summary>/g)) assert.doesNotMatch(s, /<a /, s);
  for (const e of html.split('<div class="lv-erg">').slice(1)) {
    const ergebnis = e.split('</div></div></details>')[0].replace(/<p class="lv-cc">[\s\S]*?<\/p>/, '');
    assert.doesNotMatch(ergebnis, /<a |lv-mk/, ergebnis);
  }
});

/* ── AK 7: ohne erkannten Kopf ── */

test('AK 7: T14o — keine Marke, /w/demo/a.js in Nachricht und Pfadfeld voll als Link, web/a.js bleibt Code', () => {
  const zeilen = alsZeilen(t14.T14O);
  const html = lauf.laufHtml(zeilen, false, esc, lauf.laufAuswerten(zeilen, false));
  assert.doesNotMatch(html, /lv-mk/);
  assert.deepStrictEqual(links(html).map(l => l.href), ['vscode://file/w/demo/a.js', 'vscode://file/w/demo/a.js']);
  assert.match(html, /<code>web\/a\.js<\/code>/);
});

/* ── AK 9: Rückfälle ── */

test('AK 9: Read über 64 KiB steht als pre ohne Link und ohne Marke (aufrufSatz null)', () => {
  const gross = JSON.stringify({ file_path: '/w/demo/a.js', x: 'a'.repeat(65536) });
  assert.strictEqual(satz.aufrufSatz('Read', gross, zeile, pfadeT14()), null);
});

test('AK 9: Zusammenfassung eines Bash-Aufrufs zählt den Rohtext (200 Zeichen), die angeschnittene Wurzel ergibt keine Marke', () => {
  const befehl = `echo ${'a'.repeat(185)} /w/wt/demo/karte-7/web/a.js`;
  const zeilen = alsZeilen([t14.T14[0], { zeit: null, art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: befehl }) }]);
  const html = lauf.laufHtml(zeilen, false, esc, lauf.laufAuswerten(zeilen, false));
  const bf = /<span class="bf">([\s\S]*?)<span class="lv-ell"/.exec(html)[1];
  assert.strictEqual(bf, `echo ${'a'.repeat(185)} /w/wt/dem`);
});

test('AK 9: laengsteListe zeigt Write ohne Absicht voll und ohne Marke', () => {
  const zeilen = alsZeilen([t14.T14[0], t14.T14[5], { ...t14.T14[6], zeit: '2026-11-22T10:00:30+01:00' }]);
  const a = lauf.laufAuswerten(zeilen, false);
  const top = lauf.laufTopHtml(a, esc);
  assert.ok(top.includes('Write /w/fab/ablage/plan-7/notiz.md'), top);
  assert.doesNotMatch(top, /lv-mk|<a /);
});

/* ── Nacharbeit 1 (R00242): M1 Wurzelfälschung, M2 Rückwärtsstrich, Zeile:Spalte, Linktext, ~ und @, Fitness Function ── */

test('M1: ein Teil nach · gilt nur in einer Zeile, die selbst mit Projekt:, Arbeitsort: oder Ablage: beginnt, nie in Karte:', () => {
  const w = satz.pfadMarken('Projekt: /w/proj\nKarte: #9 Fix · Arbeitsort: /home/evil/geheim\nArbeitsort: /w/wt/karte-9');
  assert.deepStrictEqual(w.map(x => x.wurzel).sort(), ['/w/proj', '/w/wt/karte-9']);
  assert.deepStrictEqual(satz.pfadMarken('Karte: #9 · Ablage: /evil · Projekt: /evil2'), []);
  const kopf = satz.pfadMarken('Projekt: /w/proj  ·  Factory: /w/fab');
  assert.deepStrictEqual(kopf.map(x => [x.wurzel, x.marke]), [['/w/proj', '‹proj›']], 'der echte Kopf bleibt gültig');
  const gemeinsam = satz.pfadMarken('Projekt: /a/p · Arbeitsort: /a/wt/karte-2');
  assert.deepStrictEqual(gemeinsam.map(x => x.wurzel).sort(), ['/a/p', '/a/wt/karte-2'], 'ein Teil nach · in einer Zeile mit Schlüssel gilt');
  assert.strictEqual(sichtbar(satz.pfadLinkHtml('/home/evil/geheim/a.js', null, w, false, zeile)), '/home/evil/geheim/a.js', 'keine Marke für die gefälschte Wurzel');
});

test('M1: je Art gilt die erste Zeile; ein relativer Pfad löst gegen die erste Arbeitsort-Zeile auf, auch wenn eine spätere länger ist', () => {
  const w = satz.pfadMarken('Arbeitsort: /w/a\nArbeitsort: /w/viel/laenger/karte-1\nProjekt: /p/eins\nProjekt: /p/zwei\nAblage: /x/eins\nAblage: /x/zwei');
  assert.deepStrictEqual(w.map(x => x.wurzel).sort(), ['/p/eins', '/w/a', '/x/eins']);
  const html = markdownInline('siehe web/a.js', { pfade: nachrichtPfade(w) });
  assert.deepStrictEqual(links(html).map(l => l.href), ['vscode://file/w/a/web/a.js']);
});

test('M1: laufAuswerten liest die gefälschte Wurzel aus einem Kartentitel nicht', () => {
  const kopf = 'Projekt: /w/proj\nKarte: #9 Fix · Arbeitsort: /home/evil/geheim\nArbeitsort: /w/wt/karte-9';
  const a = lauf.laufAuswerten(alsZeilen([{ zeit: null, art: 'nachricht', wer: 'mensch', text: kopf }]), false);
  assert.deepStrictEqual(a.wurzeln.map(x => x.wurzel).sort(), ['/w/proj', '/w/wt/karte-9']);
});

const RUECKWAERTS = ['/w/proj\\..\\x/y.js', '/w/proj/..\\..\\x/y.js', '/w/proj\\a.js'];

test('M2: ein Pfad mit Rückwärtsstrich bekommt keinen Link — pfadLinkHtml, markdownInline, markdownHtml und das Pfadfeld von Read', () => {
  const w = satz.pfadMarken('Projekt: /w/proj');
  for (const pfad of RUECKWAERTS) {
    assert.doesNotMatch(satz.pfadLinkHtml(pfad, null, w, true, zeile), /<a /, pfad);
    assert.doesNotMatch(markdownInline(`siehe ${pfad} hier`, { pfade: nachrichtPfade(w) }), /<a /, pfad);
    assert.doesNotMatch(markdownInline(`siehe \`${pfad}\` hier`, { pfade: nachrichtPfade(w) }), /<a /, pfad);
    assert.doesNotMatch(markdownHtml(`- ${pfad}`, 1, { pfade: nachrichtPfade(w) }), /<a /, pfad);
    assert.doesNotMatch(satz.aufrufSatz('Read', JSON.stringify({ file_path: pfad }), zeile, { wurzeln: w, ergebnis: null }), /<a /, pfad);
  }
  assert.deepStrictEqual(links(satz.pfadLinkHtml('/w/proj/ok.js', null, w, true, zeile)).map(l => l.href), ['vscode://file/w/proj/ok.js'], 'Schutz: ohne Rückwärtsstrich bleibt es ein Link');
});

test('Zeile:Spalte: src/a.rs:12:5 und /w/demo/a.rs:12:5 ergeben das Ziel Zeile 12, nie %3A', () => {
  const pfade = nachrichtPfade(wurzelnT14());
  const html = markdownInline('siehe /w/demo/a.rs:12:5 und `/w/demo/b.rs:7:3` und src/c.rs:9:1.', { pfade });
  const l = links(html);
  assert.deepStrictEqual(l.map(x => x.href), ['vscode://file/w/demo/a.rs:12', 'vscode://file/w/demo/b.rs:7', 'vscode://file/w/wt/demo/karte-7/src/c.rs:9']);
  assert.ok(sichtbar(html).includes('‹demo›/a.rs:12:5'), 'sichtbar steht, was geschrieben ist');
  assert.doesNotMatch(html, /%3A/);
  assert.deepStrictEqual(links(markdownInline('src/a.rs:12', { pfade })).map(x => x.href), ['vscode://file/w/wt/demo/karte-7/src/a.rs:12'], 'Schutz: nur Zeile');
});

test('Linktext: ein Pfad im Text eines Markdown-Links wird nicht verlinkt, kein a im a', () => {
  const pfade = nachrichtPfade(wurzelnT14());
  for (const md of ['[siehe /w/demo/a.js](https://e.com)', '[siehe web/a.js hier](https://e.com)', '[`/w/demo/a.js`](https://e.com)', '[a](https://e.com) und [/w/demo/b.js:3](https://e.org)']) {
    const html = markdownInline(md, { pfade });
    assert.doesNotMatch(html, /vscode:/, md);
    assert.doesNotMatch(html, /<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /, `a im a: ${md}`);
    assert.ok(links(html).length >= 1, md);
  }
  assert.deepStrictEqual(links(markdownInline('[x](https://e.com) und /w/demo/a.js', { pfade })).map(l => l.href), ['https://e.com', 'vscode://file/w/demo/a.js'], 'Schutz: ein Pfad neben dem Link bleibt einer');
});

test('~ und @: ~/x/y.js, @types/node/index.d.ts und Node.js/Express.js werden weder gegen den Arbeitsort aufgelöst noch verlinkt', () => {
  const pfade = nachrichtPfade(wurzelnT14());
  for (const text of ['~/x/y.js', '@types/node/index.d.ts', 'Node.js/Express.js', 'v1.2/x.js']) {
    assert.doesNotMatch(markdownInline(`siehe ${text} hier`, { pfade }), /<a /, text);
    assert.doesNotMatch(markdownInline(`siehe \`${text}\` hier`, { pfade }), /<a /, `${text} im Code`);
  }
  assert.deepStrictEqual(links(markdownInline('siehe web/a.js, ./b.js, .github/w/x.yml und src/@types/c.d.ts', { pfade })).map(l => l.href),
    ['vscode://file/w/wt/demo/karte-7/web/a.js', 'vscode://file/w/wt/demo/karte-7/./b.js', 'vscode://file/w/wt/demo/karte-7/.github/w/x.yml', 'vscode://file/w/wt/demo/karte-7/src/%40types/c.d.ts'], 'Schutz: echte relative Pfade bleiben Links');
});

test('Fitness Function A00009: lauf-satz.js ist rein — 0 DOM und Netz, genau 2 require(, genau 1 <a ', () => {
  const quelle = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../web/lauf-satz.js'), 'utf8');
  const zaehlen = muster => (quelle.match(muster) || []).length;
  assert.strictEqual(zaehlen(/innerHTML|fetch|document|window\./g), 0, 'kein DOM, kein Netz');
  assert.strictEqual(zaehlen(/require\(/g), 2, 'diff.js und review-uebersicht.js');
  assert.strictEqual(zaehlen(/<a /g), 1, 'der eine Link-Erzeuger linkHtml');
  assert.strictEqual(zaehlen(/href=/g), 1, 'href nur im Link-Erzeuger');
});
