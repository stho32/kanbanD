---
id: R00248
status: Neu
datum: 2026-11-23
---

# R00248: Review-Seite — lange Zeilen umbrechen

## Beschreibung

Karte #259, Scheibe S6 nach ADR-0042 Punkt 8, Reihenfolge 5 von 6 (PO Z. 538), und der freigegebenen Nachzeichnung D0009 `#review-uebersicht` Bild 9 (PO Z. 539, Änderung 1: „Quer scrollt nur der Code einer Datei, solange ‚Umbrechen‘ aus ist“). Wer auf der Review-Seite eine Zeile liest, die breiter ist als das Fenster, muss heute je Datei quer scrollen und verliert dabei Zeilennummer und Anfang der Zeile. In der Kopfzeile der Seite steht ein Schalter „Umbrechen“ (neben „Alle einklappen“): ist er an, bricht jede Zeile in der Spalte des Codes um, Zeilennummer und Zeichen „+“ / „−“ bleiben oben an der Zeile, und nichts im Code scrollt quer. Der Schalter gilt in „Ein Commit“ und in „Alle Änderungen“, für alle Dateien der Seite, und er wird im Browser gemerkt. Der Umbruch ändert nur die Darstellung: Text, Zeilennummern, Wortmarke (R00247) und Syntaxfarbe bleiben, wie sie sind, und Kopieren ergibt den Text ohne eingefügte Umbrüche.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme Zeilen prüft, liest sie ganz, ohne an jeder langen Zeile quer zu scrollen.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wirkungskette: lange Zeile (Zeichenkette, Kommentar, Markdown-Absatz, minimierte Datei) → der Diffbereich scrollt quer → auf dem Telefon (320 px bleiben rund 30 Zeichen sichtbar, Hypothese: Monospace 12 px) ist von einer 400-Zeichen-Zeile nur ein Fenster zu sehen und die Zeilennummer läuft nach links aus dem Bild → der Prüfer liest die Zeile in Stücken oder gar nicht → eine Änderung am Zeilenende geht durch. Mit dem Umbruch steht die ganze Zeile da, die Nummer bleibt oben an der Zeile, und wer lieber quer scrollt (lange Tabellen, Spalten), schaltet aus. Der Umbruch ist reines Stilmittel an einer Klasse (ADR-0042 Punkt 8): kein Neuaufbau, kein Server, keine neue Rechnung je Zeile.

## Funktionale Anforderungen

- FA 1: In der Kopfzeile der Review-Seite (die Zeile mit der Summe „<n> Dateien · +<a> −<b>“ und „Alle einklappen“/„Alle aufklappen“) steht rechts neben diesem Knopf ein Umschaltknopf **„Umbrechen“**, in „Ein Commit“ und in „Alle Änderungen“, jeweils nur, wo auch „Alle einklappen“ steht (es gibt Dateien). Der Knopf ist ein `button` mit `aria-pressed` (`false` aus, `true` an); sein Name bleibt „Umbrechen“ in beiden Zuständen, den Zustand sagt `aria-pressed`. Er trägt dieselbe Form und Mindesthöhe wie „Alle einklappen“ (D0009 Bild 1, 9). „Nebeneinander“ (S7, #260) gehört nicht zu dieser Karte.
- FA 2: **Aus** (Voreinstellung) ist die heutige Darstellung: eine Zeile bleibt eine Zeile, der Code einer Datei scrollt quer. **An** setzt `white-space: pre-wrap` und `overflow-wrap: anywhere` an den Codezellen der ganzen Seite (D0009 Z. 887) und lässt die Tabellenbreite 100 % der Spalte sein (die geschätzte Breite der Blöcke entfällt, ADR-0042 Punkt 8); auch der Hunk-Kopf („@@ … @@ <Funktion>“) bricht um. Zeilennummer und das Zeichen „+“ / „−“ bleiben oben an der Zeile (kein Umbruch dort, keine Nummer je Fragment); Folgezeilen sind nicht eingerückt.
- FA 3: Das Umschalten ändert nur eine Klasse am Diffbereich der Seite: kein Neuzeichnen, kein Neuladen, keine Anfrage an den Server, kein Zustand der Seite ändert sich (offene und geschlossene Dateien und Gruppen, „Gesehen“, Blätterstand, Fokus). Die Zeilen sind dieselben Knoten wie vorher.
- FA 4: Der Zustand wird im Browser gemerkt, **ein** Wert für alle Karten und beide Ansichten (Empfehlung an den architekt, siehe „Offene Fragen“: `localStorage` unter `kanbanD.umbrechen`, `1` / `0`, wie die übrigen Einstellungen der Oberfläche; ADR-0042 Punkt 8 nennt `sessionStorage`). Er gilt beim Laden der Seite, beim Blättern zu einem anderen Commit und beim Wechsel zwischen „Ein Commit“ und „Alle Änderungen“. Ist der Speicher gesperrt (wirft beim Lesen oder Schreiben), gilt der Zustand bis zum Neuladen, ohne Fehler und ohne Meldung.
- FA 5: Der Umbruch fügt dem Text nichts hinzu: Kopieren einer Auswahl ergibt den Text der Zeile wie bei „aus“, ohne Zeilenumbruch mitten in der Zeile, und ohne Zeilennummern und „+“ / „−“ (wie heute, `user-select: none`). Die Zeilennummer bleibt ein Eintrag je Zeile; der Sprung nach VS Code an der Nummer (R00236) bleibt.
- FA 6: Die Wortmarke (R00247) bricht mit dem Text um; ihre Unterkante steht auf jedem Fragment (R00247 „Abhängigkeiten“, Hinweis für #259). Die Syntaxfarbe (R00217) bleibt je Zeichen gleich; sie liegt auch auf umgebrochenen Zeilen auf.
- FA 7: Die Zeilenzahl und das Zeichenbudget (ADR-0033 Punkt 5, „das Budget zählt dieselben Zeilen“, ADR-0042 Punkt 8) ändern sich durch den Umbruch nicht: dieselben Dateien beginnen offen, dieselben zu.

## Nicht-funktionale Anforderungen

- Performance: Das Umschalten und das Scrollen bei 10.000 geänderten Zeilen blockiert den Hauptfaden nie länger als 150 ms (ADR-0042 Q2). Der heutige Messwert fehlt (Hypothese: weit darunter, weil nur die Blöcke im Bild neu gesetzt werden, `content-visibility: auto`); der entwickler misst ihn in B1304, bevor er die Grenze festschreibt (Abstand ≥ 30 %, `rollen/planer/zeitkriterien.md`).
- Benutzerfreundlichkeit: Bei 320 px scrollt die Seite nie quer; bei „an“ scrollt auch der Code nicht quer (PO Z. 539, Änderung 1). Tastatur und Bildschirmleser: FA 1, AK 8.
- Sicherheit: kein neuer Endpunkt, kein neues Feld, kein Prozess; es entsteht keine neue Stelle, an der fremder Text als HTML gelesen wird.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `uebersichtRepository` in `e2e/tests/review-hilfen.js`): Repository R mit Anwendung `kd` und `wb`, Aufgabe #9; Mensch `sh`, Browser headless. Commit U1 in `kd` ändert `src/u.rs` und `src/kurz.rs`:

- **K-Lang** (in `src/u.rs`, je Fall durch unveränderte Zeilen getrennt, hinzugefügt): (a) `// ` + 80 × `wort ` + `ende` (407 Zeichen, mit Leerzeichen) · (b) `let u = "` + 400 × `x` + `";` (411 Zeichen, ohne Leerzeichen) · (c) ein Hunk, dessen Kopf eine Funktionszeile mit 80 Zeichen nennt (git kürzt dort auf 80).
- **K-Kurz** (in `src/kurz.rs`): `let a = 1;` → `let a = 2;` (mit Wortmarke, R00247 K-Wort (a)) und die unveränderten Zeilen darum; sie bleibt in beiden Zuständen eine Zeile.
- **K-Zwei**: Aufgabe #9 hat in `kd` U1 und in `wb` den Commit U2 mit Fall (a) in `docs/u.md`.
- **K-Last**: Commit U3 in `kd`, Datei `src/gross.rs` (Status M) mit 10.000 geänderten Zeilen (5.000 gelöscht, 5.000 hinzugefügt, gleich lange Läufe) zu je etwa 200 Zeichen mit Leerzeichen, wie R00247 K-Last mit längeren Zeilen.

Heute (Stand `68a71996`) gibt es den Schalter nicht, AK 1–9 sind deshalb rot (AK 10 hält den Bestand).

### Schalter und Wirkung

- [ ] **AK 1 Schalter und Zustand:** Gegeben U1 (und U2 in „Alle Änderungen“), wenn `sh` die Review-Seite öffnet, dann steht in der Kopfzeile neben „Alle einklappen“ ein Knopf „Umbrechen“ mit `aria-pressed="false"`, in beiden Ansichten und nicht auf einer Seite ohne Dateien („Dieser Commit ändert keine Dateien.“). Ein Klick setzt `aria-pressed="true"`; es geht dabei keine Anfrage an den Server (Zähler der Anfragen bleibt), die offenen und geschlossenen Dateien und Gruppen, „k von n gesehen“ und der Blätterstand bleiben gleich, die Zeilenknoten sind dieselben (an einer Zeile vorab gesetzte Eigenschaft ist danach noch da), und der Fokus bleibt auf dem Knopf. Ein zweiter Klick setzt ihn zurück. Heute rot.
- [ ] **AK 2 Wirkung:** Gegeben K-Lang bei 980 px, dann ist bei „aus“ der Diffbereich von `src/u.rs` quer scrollbar (`scrollWidth > clientWidth`) und Fall (a) eine Zeile hoch (`offsetHeight` 18 px). Bei „an“ gilt: `scrollWidth ≤ clientWidth`; Fall (a) und Fall (b) (kein Leerzeichen, `overflow-wrap: anywhere`) sind mehr als eine Zeile hoch, und ihre Höhe ist die Zahl der Textzeilen mal 18 px (Rechnung: die Textzeilen zählen aus den verschiedenen Oberkanten von `Range.getClientRects()` über den Text; zwei Textzeilen ergeben 36 px); kein Zeichen ist abgeschnitten (der Text ist vollständig im Sichtbereich der Zelle: rechte Kante jedes Rechtecks ≤ rechte Kante der Zelle). Die Zelle der Zeilennummer und die des Zeichens „+“ stehen mit ihrer Oberkante an der Oberkante der Zeile, und es gibt je Zeile genau eine Nummer (Zahl der `td.n` gleich wie bei „aus“). Der Hunk-Kopf aus (c) bricht bei 320 px um (kein Quer-Scrollen des Diffbereichs). Die kurze Zeile aus K-Kurz bleibt in beiden Zuständen eine Zeile hoch. Heute rot.
- [ ] **AK 3 Merken:** Gegeben „an“, dann ist er nach dem Neuladen im selben Tab und in einem neuen Tab desselben Browsers noch an; blättert `sh` zu einem anderen Commit, wechselt zwischen „Ein Commit“ und „Alle Änderungen“ oder öffnet eine andere Aufgabe, bleibt er an. In einem neuen Browser-Kontext ist er aus. Gegeben „aus“ gesetzt, ist er nach dem Neuladen aus. Wirft `localStorage` beim Lesen oder Schreiben, ist die Seite ohne Konsolenfehler bedienbar, der Schalter wirkt bis zum Neuladen, und es steht keine Meldung da. Heute rot.
- [ ] **AK 4 Kopieren und Zeilenzahl:** Gegeben „an“ und Fall (a) umgebrochen, wenn `sh` den Text der Zeile auswählt und `window.getSelection().toString()` liest, dann ist er gleich dem bei „aus“ (407 Zeichen, `//` bis `ende`, kein `\n`, kein zusätzliches Leerzeichen) und enthält weder die Nummer noch „+“. Die Zahl der Zeilenelemente (`tr`) und der Nummern je Datei ist bei „an“ und „aus“ gleich, dieselben Dateien beginnen offen (FA 7), und der Sprung der Nummer nach VS Code ist unverändert (`data-vsc` und Tooltip „In VS Code an Zeile <z> öffnen“ an derselben Nummer). Heute rot.
- [ ] **AK 5 Marke und Farbe über den Umbruch:** Gegeben R00247 ist gebaut, K-Wort (a) auf 120 Zeichen verlängert mit der Änderung in Spalte 60 in `src/u.rs`, dann bricht sie bei 320 px und „an“ in mindestens zwei Textzeilen um, `mark.wm.getClientRects().length ≥ 2`, die untersten 2 px jedes Rechtecks tragen die Kantenfarbe (Pixelprobe wie R00247 AK 4), die Fragmente haben keine Seitenränder an der Bruchstelle, und der Text der Zeile ist gleich dem bei „aus“. Die berechnete Farbe jedes Zeichens (`tk-…`) ist bei „an“ gleich der bei „aus“. Die Probe ersetzt die Stilprobe von R00247 AK 8. Heute rot (kein Schalter).

### Breite und Bedienung

- [ ] **AK 6 Breiten:** Gegeben K-Lang, Breiten 320, 414, 980 und 1280 px, hell und dunkel, dann gilt bei „aus“ und bei „an“ `document.documentElement.scrollWidth ≤ clientWidth`. Bei „aus“ scrollt nur der Diffbereich der Datei quer (Seite nicht), bei „an“ auch der Diffbereich nicht (`scrollWidth ≤ clientWidth` jedes `.df-sc`), auch mit Fall (b) (411 Zeichen ohne Leerzeichen). Der Knopf „Umbrechen“ ist bei grobem Zeiger mindestens so hoch wie „Alle einklappen“ (≥ `--kd-ziel`) und bricht in der Kopfzeile bei 320 px mit den übrigen Knöpfen um, ohne die Seite zu verbreitern. Heute rot.
- [ ] **AK 7 Tempo und kein Neuaufbau:** Gegeben K-Last bei 980 px, dann gibt es beim Umschalten von „aus“ auf „an“ und zurück und beim Scrollen von oben bis zum Ende der Datei bei „an“ keinen `longtask` über 150 ms (`PerformanceObserver`, ereignisgenau, ohne Polling im Raster des Testwerkzeugs). Das Umschalten legt keine Zeilenknoten neu an (Eigenschaft vorab an der ersten und an der letzten gezeichneten Zeile gesetzt, danach noch da). Der heutige Messwert (Umschalten und Scrollen) steht im Bericht des entwicklers; die Grenze wird erst danach festgeschrieben (Abstand ≥ 30 %). Heute rot (kein Schalter).
- [ ] **AK 8 Tastatur und Ansage:** Gegeben U1, dann erreicht Tab den Knopf „Umbrechen“ direkt nach „Alle einklappen“ (bzw. „Alle aufklappen“); Enter und Leertaste schalten um; der Name bleibt „Umbrechen“, `aria-pressed` wechselt; nach dem Schalten steht der Fokus auf dem Knopf, der Fokusring ist ganz sichtbar (nicht beschnitten). Ohne Dateien steht der Knopf nicht da (kein Tab-Stopp ins Leere). Heute rot.
- [ ] **AK 9 Stelle im Text bleibt:** Gegeben U1 mit `src/u.rs` (Fälle (a) und (b) je 30-mal wiederholt) und `src/kurz.rs`, die Seite bei 980 px so weit gescrollt, dass der Kopf der zweiten Datei am oberen Rand steht, wenn `sh` „Umbrechen“ ein- und wieder ausschaltet, dann steht der Kopf dieser Datei danach noch im Fenster (`0 ≤ top < innerHeight`). Heute rot (kein Schalter).

### Bestand und Mutanten

- [ ] **AK 10 Bestand und Mutanten:** Bei „aus“ verhält sich die Seite wie vor der Karte: Gruppen, Größenbalken, Aufklapper „Dateien (<n>) und Commits“, „Pfad“, „VS Code“, „Patch“, Commit-Leiste, „Gesehen“, Wortmarke und Syntaxfarbe, soweit sie dann auf main stehen; bestehende Tests behalten ihre Erwartungen, jede geänderte Erwartung nennt der entwickler im Bericht mit Grund. Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie (`mutanteEinsetzen` nur mit Pfaden unter `/web/…`):
  - (m1) `overflow-wrap: anywhere` fehlt (nur `pre-wrap`) → AK 2 rot (Fall (b)), AK 6 rot
  - (m2) die geschätzte Breite der Blöcke (`contain-intrinsic-inline-size`) bleibt bei „an“ → AK 6 rot
  - (m3) der Zustand wird nicht gemerkt → AK 3 rot
  - (m4) der Schalter gilt nur in „Ein Commit“ → AK 1 rot (Alle Änderungen)
  - (m5) das Umschalten zeichnet die Seite neu (Knoten neu, Fokus weg) → AK 1 rot, AK 7 rot, AK 8 rot
  - (m6) der Hunk-Kopf bricht nicht um → AK 2 rot
  - (m7) der Umbruch entsteht durch eingefügte Zeichen (`\n`, U+200B) statt durch Stil → AK 4 rot
  - (m8) Nummer und „+“ stehen mittig statt oben (`vertical-align`) → AK 2 rot
  - (m9) `aria-pressed` fehlt oder bleibt stehen → AK 8 rot
  - (m10) ein werfender `localStorage` bricht die Seite → AK 3 rot
  - (m11) die Kante der Marke steht nur am ersten Fragment (`box-decoration-break`) → AK 5 rot

## Betroffene Verzeichnisstruktur

- Zustand des Schalters (lesen, schreiben, Wurf abfangen) wie die übrigen Einstellungen in `web/app.js` (Muster `kanbanD.signale-oben`, `kanbanD.berichtsfilter-offen`, Zeilen 28 und 36) oder in `web/review-uebersicht.js` (Node-tauglich, ADR-0042 N1), Wahl des entwicklers.
- Schalter in der Kopfzeile: `web/app.js` an den beiden Stellen, wo „Alle einklappen“ gebaut wird (`review-alle`, Zeilen 1958 und 2037); Klasse am Diffbereich der Seite; Gesamtansicht über `web/gesamt.js`, falls dort ein eigener Rahmen steht.
- Stil: `web/kd-app.css` (`.dz`, `.dz .c`, `tr.hk`, `.dz-b`, Zeilen 1578–1587) und `web/diff.js` `blockBreite` / `codeHtml` (die Breite als Eigenschaft statt fester Angabe im `style`, damit die Klasse sie überstimmen kann — Wahl des entwicklers); nur Tokens.
- Tests: `e2e/einheit/` (Node, Zustand) und `e2e/tests/r00248-review-umbrechen.spec.js`; Ausgangslage in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1301 Zustand des Schalters, rein**: lesen und schreiben, Wurf abfangen, Voreinstellung aus (FA 4; AK 3, m3, m10). Einheitentests zuerst.
2. **B1302 Schalter in beiden Kopfzeilen und Klasse**: Knopf mit `aria-pressed`, Klasse am Diffbereich ohne Neuzeichnen, Fokus bleibt (FA 1, 3; AK 1, 8; m4, m5, m9).
3. **B1303 Stil**: `pre-wrap`, `overflow-wrap`, Breite 100 %, Hunk-Kopf, Nummern oben, Kopieren, Marke und Farbe, Breiten (FA 2, 5, 6, 7; AK 2, 4, 5, 6; m1, m2, m6, m7, m8, m11).
4. **B1304 Tempo und Stelle**: 10.000 Zeilen, `longtask`, Knotenidentität, Fensterstand nach dem Umschalten (AK 7, 9). Vorprüfung durch den ux-reviewer vor B1303.
5. **B1305 Probe im echten Programm**, Mutanten m1–m11, Gate, Anforderung abschließen.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht` Bild 1 (Schalter in der Kopfzeile) und Bild 9 (Umbrechen aus und an, 640 px); CSS Z. 886–888 (`.dz.ru-umb`). Die Zeichnung ist Anhalt, nicht Vertrag; der Hunk-Kopf und die Wortmarke sind dort nicht gezeigt (AK 2, 5 messen sie).

## Tests

- **Unit** (Node, rein): Zustand lesen und schreiben, ungültiger Wert ergibt aus, werfender Speicher.
- **Integration**: keine neue, der Server bleibt unverändert.
- **E2E**: AK 1–10 im gestarteten Programm gegen echtes Git. Höhe, Rechtecke und Lage mit `getBoundingClientRect` und `Range.getClientRects`, `longtask` über `PerformanceObserver`; Verneinungen („keine Anfrage“, „keine neuen Knoten“) erst nach einem sichtbaren Signal (Zeile steht, `aria-pressed` gewechselt).

## Abhängigkeiten

- Abhängig von: R00207 (I0197 Review-Seite eines Commits, grün), R00210 (I0200 Alle Änderungen, grün), R00235 (I0225 Gruppen, grün; Kopfzeile mit „Alle einklappen“), R00247 (I0237 Wortmarke) für AK 5 und FA 6, ADR-0042 Punkt 8.
- Blockiert: Folgekarte S7 „Ansicht nebeneinander“ (#260) lässt den Schalter dort offen; ob „Umbrechen“ auch die Spalten von „Nebeneinander“ erfasst (D0009 `.ru-nb`: feste Spalten), entscheidet #260.
- Berührt `web/app.js`, `web/diff.js` und `web/kd-app.css` wie I0235–I0237: Rebase auf main, kein Konflikt in der Logik.

## Offene Fragen

- Frage an den **architekt** (1, Speicherort): ADR-0042 Punkt 8 nennt `sessionStorage`; seit N1.4 liegt „Gesehen“ in `localStorage`, und die übrigen Einstellungen der Oberfläche auch (`kanbanD.signale-oben`, `kanbanD.thema`). Empfehlung: `localStorage` unter `kanbanD.umbrechen` (`1` / `0`), ein Wert für alle Karten, als Nachtrag zu Punkt 8. Bis zur Antwort gilt die Empfehlung in FA 4 und AK 3; bei `sessionStorage` entfällt dort der Satz „neuer Tab“ und „neuer Browser-Kontext“ ist unverändert aus.
- Frage an den **architekt** (2, Breite und Höhe): Umbruch als Klasse an `.dz` mit CSS (`pre-wrap`, `overflow-wrap: anywhere`), **keine** Neuberechnung der Blöcke und kein Neuzeichnen (ADR-0042 Punkt 8, D0009 Z. 887). Dazu zwei Punkte: die Breite der Blöcke (`blockBreite`) steht heute als `contain-intrinsic-inline-size` im `style` jedes Blocks und kann von einer Klasse nicht überstimmt werden — Empfehlung: als Eigenschaft (`--bb`) im `style`, in der Regel `contain-intrinsic-inline-size: var(--bb)` und bei „an“ `none`; und die Höhenschätzung `auto <Zeilen> × 18 px` unterschätzt umgebrochene Blöcke — Empfehlung: so lassen (ADR: „die Schätzung bleibt, `auto` merkt sich die echte“), AK 9 prüft nur, dass die Stelle im Text bleibt; springt sie, setzt der entwickler den Kopf nach dem Umschalten zurück (Browser-Anker oder `scrollIntoView`).
- Frage an den **product-owner** (3, Voreinstellung): Soll „Umbrechen“ auf schmalen Breiten (unter 641 px) standardmäßig an sein? Empfehlung: nein, **aus überall**; ein Zustand, den der Prüfer kennt, und PO Z. 539 setzt „aus“ voraus („Quer scrollt nur der Code einer Datei, solange ‚Umbrechen‘ aus ist“).
- Frage an den **product-owner** (4, Hunk-Kopf): Bricht der Hunk-Kopf („@@ … @@ <Funktion>“) bei „an“ mit um? Empfehlung: ja; sonst scrollte bei „an“ noch etwas quer, was Z. 539 ausschließt. D0009 zeichnet nur die Codezellen.
- Frage an den **product-owner** (5, Reihenfolge): AK 5 braucht die Wortmarke (R00247, Karte #258). Empfehlung: Label `braucht:258` an #259, damit AK 5 am Stand mit Marke geprüft wird; die Reihenfolge der Folgekarten (S5 vor S6, PO Z. 538) ist ohnehin so.

## Notizen

- Optionen für den Umbruch (ADR-0042 Punkt 8, D0009): (U1) CSS `pre-wrap` mit `overflow-wrap: anywhere` an einer Klasse — gewählt, kein Neuaufbau, Kopieren und Marke bleiben von selbst richtig; (U2) Umbruch per Skript (Zeilen nach n Zeichen teilen) — verworfen, verfälscht Kopieren, Farbstücke und Marke und müsste bei jeder Breite neu rechnen (10.000 Zeilen); (U3) feste Spaltenzahl und Höhen vorab berechnen — verworfen, die Breite der Spalte ändert sich mit Fenster und Aufklapper.
- Nicht Teil: „Nebeneinander“ (S7, #260), Einrückung der Folgezeilen (nicht gezeichnet), Tastenkürzel für den Schalter, Umbruch der Dateiliste, des Commit-Kopfs oder der Läufe (dort bricht schon alles um, D0009 `.lv-…`).
