---
id: R00249
status: Neu
datum: 2026-11-23
---

# R00249: Review-Seite — Ansicht nebeneinander

## Beschreibung

Karte #260, Scheibe S7 nach ADR-0042 Punkt 8 („Nebeneinander“ ist ein zweiter Zeichenweg, Paarung wie Punkt 4, ungepaarte Zeilen gegenüber leer, das Budget zählt dieselben Zeilen), Reihenfolge 6 von 6 (PO Z. 538, „nach S5, nutzt deren Paarung“), und der freigegebenen Nachzeichnung D0009 `#review-uebersicht` Bild 8 (PO Z. 539; Wortlaut des Schalters PO Z. 537). Wer auf der Review-Seite eine geänderte Datei prüft, sieht heute gelöschte und hinzugefügte Zeilen untereinander und scrollt zwischen alter und neuer Fassung hin und her. In der Kopfzeile der Seite steht ein zweiter Schalter **„Nebeneinander“** (neben „Umbrechen“, R00248): ist er an, steht in jeder Datei die alte Fassung links und die neue rechts, Zeile gegen Zeile; unveränderte Zeilen stehen in beiden Spalten, gelöschte nur links, hinzugefügte nur rechts, und wo die Gegenseite fehlt, steht eine leere Zelle. Der Schalter gilt in „Ein Commit“ und in „Alle Änderungen“, für alle Dateien der Seite, und wird im Browser gemerkt. Er ändert nur die Anordnung: Text, Zeilennummern, Wortmarke (R00247), Syntaxfarbe (R00217), der Sprung der Nummer nach VS Code (R00236) und das Zeichenbudget bleiben, wie sie sind.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme eine Änderung prüft, liest alt und neu auf einer Höhe.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md)

## Geschäftlicher Nutzen

Wirkungskette: sechs Zeilen werden geändert (6 gelöscht, 6 hinzugefügt) → untereinander stehen 12 Zeilen, die alte Fassung ganz oben, die neue darunter → der Prüfer hält die sechs alten Zeilen im Kopf, scrollt, und vergleicht Zeile i der neuen mit Zeile i der alten aus dem Gedächtnis → eine vertauschte oder vergessene Zeile geht durch. Nebeneinander stehen 6 Zeilen, jede alte neben ihrer neuen, und die Wortmarke (R00247) zeigt in beiden den Unterschied. Wer lieber untereinander liest (schmales Fenster, lange Zeilen), lässt den Schalter aus (Voreinstellung).

## Funktionale Anforderungen

- FA 1: In der Kopfzeile der Review-Seite (die Zeile mit der Summe „<n> Dateien · +<a> −<b>“, „Alle einklappen“ und „Umbrechen“) steht rechts neben „Umbrechen“ ein Umschaltknopf **„Nebeneinander“**, in „Ein Commit“ und in „Alle Änderungen“, jeweils nur, wo auch „Alle einklappen“ steht (es gibt Dateien). Er ist ein `button` mit `aria-pressed` (`false` aus, `true` an); sein Name bleibt „Nebeneinander“ in beiden Zuständen. Er trägt dieselbe Form und Mindesthöhe wie „Umbrechen“ (R00248 FA 1). Die Zeichnung D0009 zeigt beide Schalter als Kästchen mit `role="switch"`; gebaut wird wie R00248 festgelegt, ein Knopf mit `aria-pressed`, damit beide Schalter gleich aussehen und gleich heißen (eine Benennung je Ding, PO Z. 399). **Aus** (Voreinstellung) ist die heutige Darstellung.
- FA 2: **An** zeichnet jede offene Datei mit Patch als Tabelle mit vier Spalten je Zeile: Nummer alt, Code alt, Nummer neu, Code neu (D0009 Bild 8). Die Zeilen der Liste (`patchZeilen`) werden so gegenübergestellt: eine unveränderte Zeile steht links und rechts, mit beiden Nummern; in einem Lauf aufeinanderfolgender gelöschter Zeilen, dem direkt ein Lauf hinzugefügter folgt, steht die i-te gelöschte links gegenüber der i-ten hinzugefügten rechts; der Überhang des längeren Laufs steht gegenüber einer leeren Zelle; ein Lauf nur gelöschter Zeilen steht links mit leerer Gegenseite, ein Lauf nur hinzugefügter rechts. Die Zahl der Tabellenzeilen eines Laufs ist also die Länge des längeren (2 gelöschte gegen 3 hinzugefügte ergeben 3 Tabellenzeilen, nicht 5). Eine leere Zelle trägt keinen Text und keine Nummer, ist für Bildschirmleser verborgen und hat die Fläche `--kd-sunken` (D0009 `.ru-nb`). Der Kopf eines Hunks („@@ … @@ <Funktion>“) steht über allen vier Spalten. Ein Hinweis „\ No newline at end of file“ bleibt als gedämpfte Zeile mit unverändertem Text erhalten. Ausrichtung ungleich langer Läufe und Lage des Hinweises sind Frage 2 an den architekt, Geltung bis zur Antwort wie hier.
- FA 3: Zeichen „+“ und „−“ entfallen (die Seite trägt die Aussage); die Lesetexte „entfernt: “ und „hinzugefügt: “ stehen weiter am Anfang der jeweiligen Zelle (nur für Bildschirmleser), Nummer und Zellen einer Seite sind `aria-hidden` wie heute bei „aus“. Die Lesereihenfolge ist zeilenweise: erst die alte, dann die neue Zelle der Zeile.
- FA 4: Die Wortmarke (R00247) steht in beiden Spalten genau dort, wo sie bei „aus“ steht, aus **derselben** Paarung, nicht aus einer zweiten Rechnung (R00247 FA 9). Die Syntaxfarbe (R00217) liegt in beiden Spalten auf, jedes Zeichen behält seine Farbe, auch wenn die Farbe erst nach dem Zeichnen kommt und auch nach dem Umschalten.
- FA 5: Das Umschalten ändert nur die Anordnung der Code-Bereiche der offenen Dateien: keine Anfrage an den Server, kein Neuladen der Seite, und kein Zustand der Seite ändert sich (offene und geschlossene Dateien und Gruppen, „Gesehen“ und „k von n gesehen“, Blätterstand, Dateikopf mit seinen Knöpfen, Fokus bleibt auf dem Schalter). Die Leseposition bleibt (Domäne Leseposition): die Datei, deren Kopf oder Körper oben im Bild steht, steht nach dem Umschalten noch im Fenster. Wie umgezeichnet und nachgeführt wird, ist Frage 1 an den architekt. Beim Wechsel zurück auf „aus“ sieht jede Datei aus wie vor dem Einschalten.
- FA 6: Der Zustand wird im Browser gemerkt, **ein** Wert für alle Karten und beide Ansichten, nach dem Muster von R00248 FA 4 und ADR-0042 N5.1 (`localStorage`, Schlüssel `kanbanD.nebeneinander`, `1` an, alles andere und fehlend aus; Annahme, Frage 4 an den architekt). Er gilt beim Laden, beim Blättern zu einem anderen Commit und beim Wechsel zwischen „Ein Commit“ und „Alle Änderungen“. Ist der Speicher gesperrt, gilt der Zustand bis zum Neuladen, ohne Fehler und ohne Meldung.
- FA 7: Lange Zeilen gehen nie verloren. Bei „Umbrechen“ **aus** ist nichts abgeschnitten: der Code-Bereich der Datei scrollt quer, jede Zeile ist eine Textzeile hoch (D0009 zeichnet `overflow: hidden` ohne Hinweis; das ist ein stiller Verlust und gilt nicht, Frage 1 an den product-owner, Empfehlung hier). Bei „Umbrechen“ **an** (R00248) brechen beide Code-Spalten um, `scrollWidth ≤ clientWidth`; die Tabellenzeile ist so hoch wie die höhere Seite, Nummern und leere Zellen stehen oben, die beiden Code-Spalten sind gleich breit.
- FA 8: Budget und Blöcke: Das Zeichenbudget (ADR-0033 Punkt 5) zählt weiter die Zeilen der Liste, nicht die Tabellenzeilen („das Budget zählt dieselben Zeilen“, ADR-0042 Punkt 8); dieselben Dateien beginnen offen, dieselben zu wie bei „aus“. Die Gegenüberstellung läuft vorab über die ganze Zeilenliste einer Datei, ein Lauf über die Blockgrenze bleibt gepaart (R00247 FA 7). Zuschnitt der Blöcke, Breite und Höhenschätzung: Frage 3 an den architekt.
- FA 9: Nur die Nummer der neuen Seite (rechts) springt nach VS Code (`data-vsc`, Tooltip „In VS Code an Zeile <z> öffnen“, R00236 FA 7); die Nummer der alten Seite nie. Auswählen und Kopieren einer Zelle gibt den Text der Zeile ohne Nummer und ohne Zusatz. Eine Auswahl über beide Spalten gibt die Zellen zeilenweise hintereinander (Inkauf, Frage 3 an den product-owner).

## Nicht-funktionale Anforderungen

- Performance: Das Umschalten und das Scrollen bei 10.000 geänderten Zeilen blockiert den Hauptfaden nie länger als 150 ms (ADR-0042 Q2). Der heutige Messwert fehlt. Hypothese: das Umschalten ist der teuerste Zug, weil die Zeichenkette aller offenen Blöcke neu entsteht und nicht nur die im Bild (die Blöcke außerhalb tragen `content-visibility: auto`, die Zeichenkette entsteht trotzdem); der entwickler misst ihn in B1312 vor der Grenze (Abstand ≥ 30 %, `rollen/planer/zeitkriterien.md`).
- Benutzerfreundlichkeit: Bei 320 px scrollt die Seite nie quer (PO Z. 539, Änderung 1); Schalter und Bedienung per Tastatur wie „Umbrechen“; Kontrast ≥ 4,5:1 (Text) in beiden Themen. Die Spalten sind bei 320 px sehr schmal (Hypothese: etwa 100 px je Code-Spalte, rund 14 Zeichen, bei 58 px Nummernspalten); der Schalter bleibt dort sichtbar und aus (Frage 2 an den product-owner).
- Sicherheit: kein neuer Endpunkt, kein neues Feld, kein Prozess; fremder Text bleibt Text und wird nie als HTML gelesen (die Leerzelle trägt keinen Text, die Marke ist die von R00247).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `uebersichtRepository` in `e2e/tests/review-hilfen.js`): Repository R mit Anwendung `kd` und `wb`, Aufgabe #9; Mensch `sh`, Browser headless. Commit N1 in `kd`:

- **K-Lauf** (in `src/n.rs`, jeder Fall durch mindestens sieben unveränderte Zeilen vom nächsten getrennt, damit jeder Fall ein eigener Hunk ist): (a) `let a = 1;` → `let a = 2;` · (b) gelöscht `p = 10;`, `q = 20;` gegen hinzugefügt `p = 11;`, `q = 21;`, `r = 31;` · (c) eine nur hinzugefügte Zeile `z = 0;` · (d) eine nur gelöschte Zeile `y = 0;`.
- **K-Datei**: `src/neu.rs` (Status `A`, vier hinzugefügte Zeilen), `src/weg.rs` (Status `D`, drei gelöschte Zeilen), `src/ende.rs` (letzte Zeile ohne Zeilenumbruch am Dateiende geändert, git schreibt „\ No newline at end of file“).
- **K-Lang** (in `src/l.rs`): eine gelöschte Zeile `// kurz` gegen eine hinzugefügte (a) `// ` + 80 × `wort ` + `ende` (407 Zeichen, mit Leerzeichen); an anderer Stelle (b) `let u = "` + 400 × `x` + `";` (411 Zeichen, ohne Leerzeichen) gegen `let u = "";`.
- **K-Block**: Commit N2 in `kd`, Datei `src/g.rs`, ein Lauf aus 3 gelöschten und 3 hinzugefügten Zeilen, dessen Blockgrenze (Index 500 der Zeilenliste von `patchZeilen`) zwischen der zweiten und dritten gelöschten Zeile liegt; der entwickler prüft den Index im Test vorab (wie R00247 K-Block).
- **K-Zwei**: Aufgabe #9 hat in `kd` N1 und in `wb` den Commit N3 mit Fall (a) in `docs/n.md`.
- **K-Last**: Commit N4 in `kd`, Datei `src/gross.rs` (Status `M`) mit 10.000 geänderten Zeilen (5.000 gelöscht, 5.000 hinzugefügt, gleich lange Läufe) zu je etwa 200 Zeichen mit Leerzeichen (wie R00248 K-Last).

Heute (Stand `e4ec76d7`) gibt es den Schalter nicht, AK 1–9 sind deshalb rot (AK 10 hält den Bestand).

### Schalter und Anordnung

- [ ] **AK 1 Schalter, Umschalten und Rundlauf:** Gegeben N1 und N3, eine Datei als gesehen markiert („1 von <n> gesehen“), eine zugeklappt, die Seite so weit gescrollt, dass der Kopf der zweiten Datei oben steht, wenn `sh` die Review-Seite öffnet, dann steht in der Kopfzeile rechts neben „Umbrechen“ ein Knopf „Nebeneinander“ mit `aria-pressed="false"`, in „Ein Commit“ und in „Alle Änderungen“, und nicht auf einer Seite ohne Dateien („Dieser Commit ändert keine Dateien.“). Ein Klick setzt `aria-pressed="true"`; es geht dabei keine Anfrage an den Server (Zähler bleibt), offene und geschlossene Dateien und Gruppen, „1 von <n> gesehen“ und der Blätterstand bleiben gleich, ein vorab am Dateikopf und am Kästchen „Gesehen“ gesetzter Marker ist danach noch da, der Kopf der zweiten Datei steht im Fenster (`0 ≤ top < innerHeight`), und der Fokus bleibt auf dem Knopf. Ein zweiter Klick setzt ihn zurück; danach haben alle Tabellen die gleiche Zahl `tr` und den gleichen `innerText` wie vor dem ersten Klick. Heute rot.
- [ ] **AK 2 Gegenüberstellung:** Gegeben K-Lauf bei „an“, dann hat jede Tabellenzeile vier Zellen (Nummer alt, Code alt, Nummer neu, Code neu). (a) steht in **einer** Zeile: links `let a = 1;` mit Nummer alt, rechts `let a = 2;` mit Nummer neu. (b) steht in **drei** Zeilen (Rechnung: Lauf 2 gegen 3, längerer Lauf 3): `p = 10;` | `p = 11;`, `q = 20;` | `q = 21;`, leer | `r = 31;`. (c) steht in einer Zeile mit leerer linker Zelle, (d) in einer Zeile mit leerer rechter Zelle. Der Hunk von (b) hat bei drei Kontextzeilen davor und danach 3 + 3 + 3 = 9 Tabellenzeilen und einen Kopf (bei „aus“ 3 + 5 + 3 = 11 Zeilen und einen Kopf). Eine unveränderte Zeile steht links und rechts mit demselben Text und beiden Nummern. Der Hunk-Kopf steht über allen vier Spalten (`colspan 4`). Eine leere Zelle hat keinen Text und keine Nummer, ist `aria-hidden` und hat eine andere Hintergrundfarbe als eine Zelle von `del` und `add`. Gegeben K-Datei: `src/neu.rs` hat eine ganz leere linke Seite (vier Zeilen), `src/weg.rs` eine ganz leere rechte (drei Zeilen); `src/ende.rs` zeigt den Hinweis „\ No newline at end of file“ mit unverändertem Text als gedämpfte Zeile, nicht als Code. Heute rot.
- [ ] **AK 3 Marke und Farbe:** Gegeben K-Lauf (a) in `src/n.rs` (Rust, von der Auflage gefärbt), dann trägt die linke Zelle genau ein `mark.wm` mit dem Text „1“ und die rechte genau eins mit „2“, und die Bereiche sind die gleichen wie bei „aus“ (Vergleich der Marken beider Darstellungen: Text und Lage in der Zeile); (b) trägt keine Marke (ungleich lange Läufe, R00247 FA 1). Die berechnete Farbe jedes Zeichens (`tk-…`) ist bei „an“ gleich der bei „aus“, auch wenn die Farbauflage erst nach dem Umschalten fertig wird und auch in einer Datei ohne bekannte Endung (dort ohne Farbe, mit Marke). Heute rot.
- [ ] **AK 4 Text, Sprung, Ansage:** Gegeben K-Lauf bei „an“, wenn `sh` den Text der linken Zelle von (a) auswählt und `window.getSelection().toString()` liest, dann ist er `let a = 1;` ohne Nummer, ohne „+“ und „−“, ohne Zeilenumbruch; für die rechte Zelle `let a = 2;`. Der Lesetext „entfernt: “ steht am Anfang der linken, „hinzugefügt: “ am Anfang der rechten Zelle (`ariaSnapshot` zeigt je Zeile erst alt, dann neu); leere Zellen und Nummern kommen im Zugänglichkeitsbaum nicht vor. Die Nummer der neuen Seite trägt `data-vsc` und den Tooltip „In VS Code an Zeile <z> öffnen“; die Nummer der alten Seite trägt keinen Sprung. Heute rot.

### Zustand, lange Zeilen, Breiten

- [ ] **AK 5 Merken:** Gegeben „an“, dann ist es nach dem Neuladen im selben Tab und in einem neuen Tab desselben Browsers noch an; blättert `sh` zu einem anderen Commit, wechselt zwischen „Ein Commit“ und „Alle Änderungen“ oder öffnet eine andere Aufgabe, bleibt es an. In einem neuen Browser-Kontext ist es aus. Gegeben „aus“ gesetzt, ist es nach dem Neuladen aus. Wirft `localStorage` beim Lesen oder Schreiben, ist die Seite ohne Konsolenfehler bedienbar, der Schalter wirkt bis zum Neuladen, und es steht keine Meldung da. Heute rot.
- [ ] **AK 6 Lange Zeilen:** Gegeben K-Lang bei 980 px und „an“. Bei „Umbrechen“ **aus**: der Code-Bereich von `src/l.rs` scrollt quer (`scrollWidth > clientWidth`), jede Zeile ist eine Textzeile hoch (18 px), und der Text beider langen Zeilen ist vollständig erreichbar (nach dem Querscrollen bis zum Ende liegt die rechte Kante des letzten Zeichens im Sichtbereich; nichts steht mit `overflow: hidden` ab). Bei „Umbrechen“ **an**: `scrollWidth ≤ clientWidth`, beide Code-Spalten sind gleich breit (±1 px), und die Zeile mit (a) ist so hoch wie die höhere Seite mal 18 px (Rechnung: links 1 Textzeile, rechts 3 → 54 px; die Textzeilen zählen aus den verschiedenen Oberkanten von `Range.getClientRects()`), (b) mit 411 Zeichen ohne Leerzeichen bricht rechts ebenfalls um und ist mehr als eine Zeile hoch; Nummern und leere Zellen stehen oben an der Zeile; der Text der Zeile ist gleich dem bei „aus“. Heute rot.
- [ ] **AK 7 Breiten und Kontrast:** Gegeben K-Lauf und K-Lang, Breiten 320, 414, 980 und 1280 px, hell und dunkel (Dunkel über `data-theme` und über `prefers-color-scheme` ohne `data-theme`), „an“ mit „Umbrechen“ aus und an, dann gilt `document.documentElement.scrollWidth ≤ clientWidth`; bei „Umbrechen“ aus scrollt nur der Code-Bereich der Datei quer. Der Text von `del` und `add` hat gegen seine Fläche mindestens 4,5:1 in allen vier Lagen. Der Knopf „Nebeneinander“ ist bei grobem Zeiger mindestens so hoch wie „Umbrechen“ (≥ `--kd-ziel`) und bricht bei 320 px mit den übrigen Knöpfen der Kopfzeile um, ohne die Seite zu verbreitern; Tab erreicht ihn direkt nach „Umbrechen“, Enter und Leertaste schalten um, der Fokusring ist ganz sichtbar. Heute rot.

### Budget, Blöcke, Tempo

- [ ] **AK 8 Budget, Alle Änderungen und Blockgrenze:** Gegeben K-Zwei, wenn `sh` „Alle Änderungen“ öffnet und „Nebeneinander“ einschaltet, dann stehen Fall (a) in `kd` und Fall (a) in `wb` je in einer Zeile mit Marke „1“ / „2“ in ihrem Abschnitt. Gegeben K-Block, dann stehen die drei gelöschten und die drei hinzugefügten Zeilen in genau drei Tabellenzeilen (Zeile i gegen Zeile i), alle sechs tragen eine Marke (Rechnung: 3 + 3 = 6), unabhängig davon, in welchem Block die Grenze liegt. Dieselben Dateien beginnen offen und dieselben zu wie bei „aus“ (R00235 FA 6, ADR-0033 Punkt 5: das Budget zählt die Zeilen der Liste); eine Datei mit 2.500 gelöschten und 2.500 hinzugefügten Zeilen zählt 5.000 für das Budget und hat bei „an“ 2.500 Tabellenzeilen. Heute rot.
- [ ] **AK 9 Tempo:** Gegeben K-Last bei 980 px, dann gibt es beim Umschalten von „aus“ auf „an“ und zurück und beim Scrollen von oben bis zum Ende der Datei bei „an“ keinen `longtask` über 150 ms (`PerformanceObserver`, ereignisgenau, ohne Polling im Raster des Testwerkzeugs); die Datei hat bei „an“ 5.000 Tabellenzeilen. Der Kopf der zweiten Datei bleibt beim Umschalten im Fenster (30 Wiederholungen, wie R00248 AK 9). Der heutige Messwert (Zeichnen und Umschalten) steht im Bericht des entwicklers; die Grenze wird erst danach festgeschrieben (Abstand ≥ 30 %). Heute rot (kein Schalter).

### Bestand und Mutanten

- [ ] **AK 10 Bestand und Mutanten:** Bei „aus“ verhält sich die Seite wie vor der Karte: Gruppen, Größenbalken, Aufklapper „Dateien (<n>) und Commits“, „Pfad“, „VS Code“, „Patch“, Commit-Leiste, „Gesehen“, „Umbrechen“, Wortmarke und Syntaxfarbe; bestehende Tests behalten ihre Erwartungen, jede geänderte Erwartung nennt der entwickler im Bericht mit Grund. Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie (`mutanteEinsetzen` nur mit Pfaden unter `/web/…`):
  - (m1) die j-te gelöschte steht gegenüber der falschen hinzugefügten Zeile (Versatz um eins) → AK 2 rot (b)
  - (m2) eine unveränderte Zeile steht nur in einer Spalte → AK 2 rot
  - (m3) die leere Zelle trägt Text oder Nummer oder ist nicht `aria-hidden` → AK 2, AK 4 rot
  - (m4) die Marke wird in „Nebeneinander“ neu gerechnet und weicht ab → AK 3 rot
  - (m5) die Farbauflage trifft die Tabellenzeile statt der Zeile der Liste → AK 3 rot (b)
  - (m6) der Zustand wird nicht gemerkt → AK 5 rot
  - (m7) ein werfender `localStorage` bricht die Seite → AK 5 rot
  - (m8) der Schalter gilt nur in „Ein Commit“ → AK 1, AK 8 rot
  - (m9) das Umschalten verliert offene Dateien, „Gesehen“ oder den Fokus → AK 1 rot
  - (m10) der Code ist bei „Umbrechen“ aus abgeschnitten (`overflow: hidden`) → AK 6 rot
  - (m11) die Zeilenhöhe folgt nur einer Seite (die Gegenseite bricht nicht mit) → AK 6 rot
  - (m12) die Nummer der alten Seite trägt den Sprung → AK 4 rot
  - (m13) ein Lauf wird an der Blockgrenze geteilt oder das Budget zählt Tabellenzeilen → AK 8 rot
  - (m14) die Leseposition wird nicht gehalten → AK 1, AK 9 rot (nur nötig, wenn die Messung ohne Nachführung einen Sprung zeigt)

## Betroffene Verzeichnisstruktur

- Zustand des Schalters (lesen, schreiben, Wurf abfangen) wie `kanbanD.umbrechen` (R00248 B1301): bevorzugt dieselbe kleine Funktion für beide Schalter statt einer zweiten, in `web/app.js` oder `web/review-uebersicht.js` (Node-tauglich, ADR-0042 N1), Wahl des entwicklers.
- Gegenüberstellung der Zeilen: rein, Node-tauglich, in `web/review-uebersicht.js` oder `web/diff.js`; Zeichnen in `web/diff.js` (`codeHtml`, `zeileHtml`, `zelleHtml`, `bloecke`, `blockBreite`) als zweiter Zeichenweg neben dem heutigen.
- Schalter in der Kopfzeile: `web/app.js` an den beiden Stellen, wo „Alle einklappen“ und „Umbrechen“ gebaut werden (`review-alle`, R00248); Gesamtansicht über `web/gesamt.js`.
- Farbauflage: `web/farbschlange.js` (Zeile 192 nimmt heute je `tr` ein `td.c`; in „Nebeneinander“ hat eine Zeile zwei Code-Zellen und die Tabellenzeile ist nicht die Zeile der Liste, Frage 1 an den architekt).
- Stil: `web/kd-app.css` (`.dz`, `.dz-b`, `tr.hk`, Marke `mark.wm`), nur Tokens; Anhalt `D0009.dc.html` `.ru-nb` (Zeilen 889–897).
- Tests: `e2e/einheit/` (Node: Gegenüberstellung, Zustand) und `e2e/tests/r00249-review-nebeneinander.spec.js`; Ausgangslage in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1306 Gegenüberstellung der Zeilen, rein**: Zeilenliste → Tabellenzeilen links/rechts, Läufe, Überhang, Kopf- und Hinweiszeilen (FA 2; AK 2; m1, m2). Einheitentests zuerst.
2. **B1307 Zustand des Schalters, rein**: lesen, schreiben, Wurf abfangen, Voreinstellung aus (FA 6; AK 5; m6, m7); parallel zu B1306.
3. **B1308 Zeichnen der Tabelle**: vier Spalten, leere Zellen, Hunk-Kopf, Lesetexte, Nummer neu mit Sprung, Marke aus derselben Paarung (FA 2–4, 9; AK 2, 3, 4; m3, m4, m12).
4. **B1309 Einbau: Blöcke, Farbauflage, Alle Änderungen**: Gegenüberstellung vorab auf der ganzen Liste, Blöcke zu Tabellenzeilen, Budget nach Zeilen der Liste, Auflage adressiert die Zeile der Liste, „Alle Änderungen“ je Anwendung (FA 4, 8; AK 3, 8; m5, m13).
5. **B1310 Schalter in beiden Kopfzeilen, Umschalten**: Knopf mit `aria-pressed` neben „Umbrechen“, die Code-Bereiche der offenen Dateien neu zeichnen, Zustand der Seite, Fokus und Leseposition halten (FA 1, 5; AK 1; m8, m9, m14).
6. **B1311 Stil: Spalten, leere Zelle, Umbrechen, Breiten, Kontrast**: Spaltenbreiten, `--kd-sunken`, Querscrollen bei „aus“, Umbruch beider Spalten bei „an“, Zeilenhöhe der höheren Seite, 320–1280 px, hell und dunkel (FA 7; AK 6, 7; m10, m11). Vorprüfung durch den ux-reviewer vor B1311.
7. **B1312 Tempo**: 10.000 Zeilen, `longtask`, Leseposition (NFA Performance; AK 9; m14).
8. **B1313 Probe im echten Programm**, Mutanten m1–m14, Gate, Anforderung abschließen.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht` Bild 1 (Schalter in der Kopfzeile) und Bild 8 (Nebeneinander an, 1280 px, hell und dunkel); CSS Zeilen 889–897 (`.ru-nb`). Die Zeichnung ist Anhalt, nicht Vertrag: Sie zeigt den Hunk-Kopf, den Umbruch in den Spalten, schmale Breiten, die Wortmarke bei erzwungenen Farben und den Hinweis „\ No newline“ nicht (Lücken, nach Material 3 gefüllt), und sie schneidet lange Zeilen ab (FA 7).

## Tests

- **Unit** (Node, rein): Gegenüberstellung (Läufe 1/1, 2/3, 3/2, nur gelöscht, nur hinzugefügt, Kontext, Kopf, Hinweis, Lauf über die Blockgrenze), Zustand lesen und schreiben (ungültiger Wert ergibt aus, werfender Speicher).
- **Integration**: keine neue, der Server bleibt unverändert.
- **E2E**: AK 1–10 im gestarteten Programm gegen echtes Git. Höhe, Rechtecke und Lage mit `getBoundingClientRect` und `Range.getClientRects`, `longtask` über `PerformanceObserver`; Verneinungen („keine Anfrage“) erst nach einem sichtbaren Signal (Tabelle steht, `aria-pressed` gewechselt).

## Abhängigkeiten

- Abhängig von: R00207 (I0197 Review-Seite eines Commits, grün), R00210 (I0200 Alle Änderungen, grün), R00235 (I0225 Gruppen und Kopfzeile, grün), R00236 (I0226 Sprung der Nummer nach VS Code), **R00247** (I0237 Wortmarke und ihre Paarung, Karte #258: die Marke in „Nebeneinander“ nutzt dieselbe Paarung), **R00248** (I0238 Schalter „Umbrechen“ und Klasse am Diffbereich, Karte #259: Kopfzeile, Muster des Zustands, Breite der Blöcke als `--bb`, Zusammenspiel von „Umbrechen“ und Spalten), ADR-0042 Punkt 8 und N5.
- Karte #260 trägt `braucht:252`; empfohlen sind `braucht:258` und `braucht:259`: ohne #258 gibt es die Paarung nicht, ohne #259 gibt es „Umbrechen“ nicht (AK 6, 7) und `codeHtml` ändert seinen `style` (`--bb`, ADR-0042 N5.2), ein Bau davor müsste ihn danach umbauen.
- Blockiert: nichts.
- Berührt `web/app.js`, `web/diff.js`, `web/farbschlange.js` und `web/kd-app.css` wie I0235–I0238: Rebase auf main, kein Konflikt in der Logik erwartet.

## Offene Fragen

Keine hält den Bau auf; bis zur Antwort gilt die Empfehlung.

- **Frage 1 (architekt) — Zeichenweg beim Umschalten und Farbauflage.** `web/farbschlange.js:192` adressiert die Code-Zelle einer Zeile über `tr` und `td.c`; in „Nebeneinander“ ist eine Tabellenzeile nicht eine Zeile der Liste (2 gegen 3 ergeben 3 Tabellenzeilen für 5 Zeilen) und hat zwei Code-Zellen. Empfehlung: jede Code-Zelle trägt den Index ihrer Zeile in der Zeilenliste (`data-z`), die Auflage adressiert über ihn in beiden Darstellungen; das Umschalten zeichnet nur die Code-Bereiche (`.df-sc`) der offenen Dateien neu, nicht die Seite, mit `reviewLesepositionMerken/Halten` (ADR-0042 N5.3) und Anker wie dort; laufende Aufträge der Farbauflage der alten Zeichnung verfallen (`farbAuftraege`). Alternative: beide Tabellen im DOM, eine per CSS verborgen (verworfen: doppelte Knoten bei 10.000 Zeilen).
- **Frage 2 (architekt) — Ausrichtung ungleich langer Läufe und Hinweiszeile.** ADR-0042 Punkt 8 sagt „Paarung wie Punkt 4, ungepaarte Zeilen gegenüber leer“. Punkt 4 paart nur gleich lange Läufe für die **Marke**. Empfehlung: die **Ausrichtung** ist unabhängig davon, die i-te gelöschte steht gegenüber der i-ten hinzugefügten, der Überhang gegenüber leer (wie GitHub und GitLab); die Marke bleibt auf gleich lange Läufe beschränkt (R00247 FA 1). Alternative: ein ungleich langer Lauf steht ganz ungepaart (erst alle gelöschten links, dann alle hinzugefügten rechts, 5 Tabellenzeilen statt 3). Der Hinweis „\ No newline at end of file“: Empfehlung eigene gedämpfte Zeile unter der Zeile, zu der er gehört, in der Spalte ihrer Seite, die Gegenseite leer.
- **Frage 3 (architekt) — Blöcke, Breite, Höhe.** Empfehlung: geblockt wird **nach** der Gegenüberstellung in je 500 Tabellenzeilen (`BLOCK_ZEILEN`), das Budget zählt weiter die Zeilen der Liste; `--bb` ist die Breite beider Spalten (zwei Code-Spalten à längste Zeile × 8 px plus zwei Nummern), die Höhenschätzung `n × 18` zählt Tabellenzeilen. Die 500 als Blockgröße ist die Zahl des Budgets, nicht des Blocks (ADR-0033 Punkt 5); wird sie für Tabellenzeilen anders gebraucht, entscheidet der architekt.
- **Frage 4 (architekt) — Speicherort.** Annahme: wie ADR-0042 N5.1, `localStorage` `kanbanD.nebeneinander`, ein Wert für alle Karten und beide Ansichten; keine Meldung bei Wurf (Ansichtswahl, kein Fortschritt). Bitte bestätigen oder in einem Nachtrag N6 ändern.
- **Frage 1 (product-owner) — lange Zeilen bei „Umbrechen“ aus.** Die Zeichnung schneidet sie ab (`overflow: hidden`, ohne Hinweis); der Stand R00248 verlangt, dass nichts verloren geht, und PO Z. 539: „Quer scrollt nur der Code einer Datei, solange ‚Umbrechen‘ aus ist.“ Empfehlung: nicht abschneiden, der Code-Bereich der Datei scrollt quer (beide Spalten gemeinsam), „Umbrechen“ wirkt in beiden Spalten wie in R00248. Das weicht von der freigegebenen Zeichnung ab, nur im Verhalten bei langen Zeilen (FA 7, AK 6).
- **Frage 2 (product-owner) — schmale Breiten.** Bei 320 px bleiben je Code-Spalte rund 14 Zeichen (Hypothese: 58 px Nummern, Monospace 12 px). Empfehlung: der Schalter bleibt auf jeder Breite sichtbar, Voreinstellung aus wie bei „Umbrechen“ (PO Z. 650), kein Sperren; wer ihn bei 320 px einschaltet, bekommt zwei schmale Spalten. Alternative: unter 641 px erscheint er nicht (dann bräuchte die Zeichnung Bilder dazu).
- **Frage 3 (product-owner) — Kopieren über beide Spalten.** Eine Auswahl, die in der linken Spalte beginnt und in der rechten endet, gibt die Zellen zeilenweise hintereinander. Empfehlung: Inkauf, kein Kriterium in #260; wer eine Fassung kopiert, wählt in einer Spalte. Härtung später: nur die Spalte, in der die Auswahl beginnt, ist auswählbar (zusätzlicher Skriptzug, eigene Karte nur auf Wunsch).
- **Entschieden mit Empfehlung (Planer):** Schalter als Knopf mit `aria-pressed` wie R00248 statt Kästchen mit `role="switch"` wie D0009 (FA 1); Voreinstellung aus; Zeichen „+“ und „−“ entfallen in „Nebeneinander“ (die Seite trägt die Aussage; die Lesetexte bleiben). Vorprüfung durch ux-reviewer vor B1311: ja.

## Notizen

- Optionen für den Zeichenweg (ADR-0042 Punkt 8, D0009 Bild 8): (N1) zweiter Zeichenweg, Zeilen in Skript gegenübergestellt, eine Tabelle mit vier Spalten je Block — gewählt, die Ausrichtung ist nur so zu haben, Kopieren, Marke und Farbe bleiben Zellen wie heute; (N2) dieselbe Tabelle, gelöscht und hinzugefügt per CSS-Raster nach links und rechts gestellt — verworfen, Läufe ungleicher Länge und leere Gegenüber sind ohne Zeilenkenntnis nicht auszurichten; (N3) zwei Tabellen nebeneinander, je eine Seite — verworfen, bei „Umbrechen“ laufen die Zeilenhöhen auseinander, die Ausrichtung bricht.
- Zuschnitt: ein Slice mit acht Bubbles (Schwelle „etwa acht“). Erster Kandidat für einen Schnitt, wenn die Zählung wächst: „Alle Änderungen“ als Ausbaustufe nach „Ein Commit“ (B1309, AK 8, m8).
- Nicht Teil: Auswahl nur einer Spalte, Tastenkürzel für den Schalter, Einrückung, „Nebeneinander“ für die Läufe-Ansicht, ein Diff in VS Code (PO Z. 533), Synchronisieren des Querscrollens je Spalte.
