---
id: R00236
status: Neu
datum: 2026-11-22
---

# R00236: Review-Seite — Pfad kopieren, in VS Code öffnen und Patch je Datei

## Beschreibung

Karte #255, Scheibe S4 nach ADR-0042 Punkte 6 und 7 mit Nachtrag N1.3 (`bc0578fd`) und der freigegebenen Nachzeichnung D0009 `#review-uebersicht` (PO Z. 539). Wer auf der Review-Seite einen Commit oder alle Änderungen einer Aufgabe prüft, findet am Kopf jeder Datei drei Knöpfe. „Pfad“ kopiert den vollständigen Pfad der Datei auf dem Rechner des Boards. „VS Code“ öffnet die Datei in VS Code an der ersten hinzugefügten Zeile. „Patch“ lädt den Patch dieser einen Datei herunter. Jede Zeilennummer der neuen Seite öffnet VS Code an genau dieser Zeile. Damit das geht, nennt die Diff-Antwort die Wurzel des Arbeits-Repositorys im neuen Feld `wurzel`.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): Wer in der Abnahme eine Stelle genauer lesen will, springt aus dem Diff in seinen Editor, ohne den Pfad abzutippen. Einen Diff in VS Code gibt es nicht. Das hat der Betreiber entschieden (ADR-0042 N1.3, PO Z. 533).

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Heute zeigt die Review-Seite den Pfad relativ zur Wurzel des Repositorys. Wer die Datei im Editor öffnen will, sucht sie dort von Hand und scrollt zur Stelle. Den Patch einer einzelnen Datei gibt es nur über die API. Nach S4 sind es ein Klick zur Datei an der richtigen Zeile, ein Klick für den Pfad in der Zwischenablage und ein Klick für den Patch, aus beiden Ansichten der Review-Seite.

## Funktionale Anforderungen

- FA 1: `GET …/diff` liefert in beiden Formen („Ein Commit“ und „Alle Änderungen“) neben `anwendung` das Feld `wurzel`. Es ist der absolute Pfad aus `git rev-parse --show-toplevel`, den der Dienst schon bestimmt, nicht der Text des Registers. Es gibt keinen neuen Git-Prozess. `format=patch` bleibt bytegleich (ADR-0042 Punkt 6).
- FA 2: Eine Antwort mit alter Wurzel wird nie per 304 bestätigt. Im Gesamt-Diff geht `wurzel` in den `ETag` ein (ADR-0042 Punkt 6). Im Ein-Commit-Diff geht der Startordner des Registers ein, damit 304 weiter ohne Git bleibt. Ein Rumpf, der vor dieser Karte ohne `wurzel` zwischengespeichert wurde, bekommt 200 statt 304.
- FA 3: Jede Datei trägt im Kopf „Pfad“, „VS Code“ und „Patch“, in dieser Reihenfolge, mit den Tooltips „Vollständigen Pfad kopieren“, „In VS Code an Zeile <z> öffnen“ und „Patch dieser Datei herunterladen“ (PO Z. 537). Das gilt in „Ein Commit“ und in „Alle Änderungen“, auch bei eingeklappten Dateien.
- FA 4: „VS Code“ ist `vscode://file` + Wurzel + `/` + Pfad, jeder Teil mit `encodeURIComponent` kodiert, `/` bleibt, dann `:<zeile>`. Die Zeile ist die erste hinzugefügte Zeile der Datei (Nummer der neuen Seite). Ohne hinzugefügte Zeile ist es die erste Zeile der neuen Seite im ersten Hunk (ADR-0042 N1.3, PO Z. 545).
- FA 5: Ohne Zeile steht der Link ohne `:<zeile>`. Das gilt für eine Datei ohne Hunk (reine Umbenennung, Binärdatei), wie N1.3 es nennt, und für eine Datei, deren `patch` noch nicht geladen ist (`gross`, `nachladen`). Nach dem Nachladen bekommt sie die Zeile. Der Tooltip lautet dann „In VS Code öffnen“, wie am Knopf des Aufgabenfensters (`web/ansicht.js:392`).
- FA 6: Gelöschte Dateien bekommen kein „VS Code“, aber „Pfad“ (alter Pfad) und „Patch“. Eine Datei, deren Wurzel oder Pfad sich durch das Sichtbarmachen (ADR-0033 Punkt 8, `sichtbarTeile`) ändern würde, bekommt ebenfalls kein „VS Code“, auch keinen Sprung an ihren Zeilennummern. „Pfad“ und „Patch“ bleiben (ADR-0042 Punkt 6).
- FA 7: Ein Klick auf eine Zeilennummer der neuen Seite öffnet denselben Link mit dieser Zahl. Die Nummer trägt den Tooltip „In VS Code an Zeile <z> öffnen“ (PO Z. 540 (b)). Nummern der alten Seite springen nicht. Die Nummern bleiben `aria-hidden` und werden nicht zu je einem `<a>`. Über die Tastatur führt der Knopf „VS Code“ (ADR-0042 Punkt 6).
- FA 8: „Pfad“ kopiert `<wurzel>/<pfad>` roh, mit Bidi- und Steuerzeichen, wie sie im Commit stehen. Bei `D` ist es der alte Pfad, sonst der angezeigte. Danach steht „Pfad kopiert“ als Auflage unter dem Knopf. Die Auflage wird vorgelesen (`role="status"`), die Nachbarknöpfe verschieben sich nicht, und sie verschwindet beim nächsten Klick oder von selbst (PO Z. 541).
- FA 9: Fehlt die Zwischenablage (kein sicherer Kontext, etwa `http://<ip>:7422`) oder verweigert der Browser das Schreiben, dann steht der Pfad in einem schreibgeschützten Feld unter dem Kopf der Datei. Der Text ist ganz markiert, und daneben steht „Pfad markiert — mit Strg + C kopieren“ (PO Z. 537). Eine stille Fehlanzeige gibt es nicht.
- FA 10: „Patch“ ist ein Download über die bestehende Route `…/diff?…&datei=<pfad>&format=patch`, alle Adressteile mit `encodeURIComponent`. In „Ein Commit“ gehört `commit=<verweis>` dazu. In „Alle Änderungen“ gehört `anwendung=<kürzel>` des Abschnitts dazu, ohne `commit=`. Der Dateiname ist `<letzter Pfadteil>.patch`, wenn der letzte Pfadteil nur aus `[A-Za-z0-9._-]` besteht, sonst `datei.patch`. Eine Datei mit dem Hinweis `zu_gross_zum_anzeigen` bekommt keinen Patch-Link (ADR-0042 Punkt 7).
- FA 11: In „Alle Änderungen“ gilt die Wurzel des Abschnitts. Bei einer Folge-Datei kommt die Sprungzeile des Knopfs aus dem letzten Schritt mit `patch`. Die Nummern eines Schritts springen mit der Nummer der neuen Seite dieses Schritts.

## Nicht-funktionale Anforderungen

- Sicherheit: Es gibt keinen neuen Prozessaufruf und keinen schreibenden Weg am Server. Kein `spawn` und kein `Command::new` außer `git` kommen neu in den Diff. Kein Text aus einem Commit lenkt einen Link auf ein anderes Ziel als `vscode://file/<wurzel>/<pfad>[:<zeile>]` bzw. auf eine andere Datei der Patch-Route (ADR-0042 Q3). `wurzel` ist ein weiterer absoluter Serverpfad, nach ADR-0032 S2 erlaubt, mit derselben Grenze wie `ordner` und `repository` (ADR-0042 Punkt 6). Der security-reviewer prüft Pfad in der Antwort, Kodierung und Bidi.
- Benutzerfreundlichkeit: Bei 320 px scrollt die Seite nicht quer, quer scrollt nur der Code einer Datei (PO Z. 539, Änderung 1). Die Knöpfe sind mit der Tastatur erreichbar.
- Performance: Das DOM wächst je Datei um drei Bedienelemente, nicht je Zeile. Das Zeichenbudget bleibt (ADR-0033 Punkt 5).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `e2e/tests/review-hilfen.js`): Wegwerf-Repository in einem Ordner mit Leerzeichen, `W` = `<tmp>/R x`. Im Register steht als `repository` der Unterordner `W/plan` (wie der Bestand `kd`, dessen Repository `…/Dokumentation/Planung` ist). Anwendung `kd`, Mensch `sh`, Browser headless.

- **K-Pfad**: ein Commit mit diesen Dateien, in der Reihenfolge der API:
  - `src/a.rs` M, ein Hunk `@@ -10,7 +10,7 @@` mit drei Kontextzeilen, einer entfernten und einer hinzugefügten Zeile. Die erste hinzugefügte Zeile ist 13, der Hunk beginnt bei 10.
  - `src/nur-weg.rs` M, ein Hunk `@@ -20,4 +20,3 @@` nur mit einer entfernten Zeile. Die erste Zeile der neuen Seite ist 20.
  - `a/b?c#d%e:12.rs` A +2
  - `alt.rs` → `neu.rs` R 100 %, ohne Hunk
  - `bild.png` A, binär
  - `weg.rs` D −3
  - `bidi-‮datei.dat` A +1 (mit U+202E im Namen)
  - `ä.rs` A +1
- **K-Gross**: eine Datei `src/gross.rs` M mit über 3.000 Zeilen Patch, also `gross` ohne `patch`.
- **Aufgabe #4**: Commits in `kd` und in einer zweiten Anwendung `wb` mit eigenem Repository `V`. In `wb` steht `b.js` M (erste hinzugefügte Zeile 5). In `kd` steht `src/f.rs` als Folge-Datei (ein fremder Commit dazwischen). Ihr letzter Schritt hat die erste hinzugefügte Zeile 31.

Heute (Stand `263b4c81`) gibt es weder `wurzel` noch die Knöpfe. AK 1–9 sind deshalb rot.

### Antwort der API

- [ ] **AK 1 Wurzel in der Antwort** (ADR-0042 Punkt 6): Gegeben K-Pfad, wenn `GET /api/aufgaben/<nr>/diff?commit=<verweis>` und `GET /api/aufgaben/<nr>/diff` gelesen werden, dann trägt jede Antwort `"wurzel": "<W>"`, gleich der Ausgabe von `git -C <W>/plan rev-parse --show-toplevel`, nicht `<W>/plan`. In Aufgabe #4 trägt der Gesamt-Diff mit `anwendung=wb` `"wurzel": "<V>"`. `…&format=patch` ist bytegleich zur Antwort vor der Karte. Die OpenAPI-Beschreibung nennt `wurzel` in den Schemas `Diff` und `Gesamtdiff` und im Text von `GET …/diff`. Heute rot: das Feld fehlt.
- [ ] **AK 2 Keine alte Wurzel per 304** (ADR-0042 Punkt 6, „Durchsetzung“): Gegeben eine Antwort 200 mit ETag `E` in beiden Formen.
  - Wird danach das Register so geändert, dass `kd` auf eine Kopie des Repositorys unter `<tmp>/R2` zeigt (dieselben Commits), dann gibt die Anfrage mit `If-None-Match: E` 200 mit `"wurzel": "<tmp>/R2"`, nicht 304.
  - Ohne Änderung des Registers bleibt es bei 304, im Ein-Commit-Diff ohne Git-Prozess (Zähler `arbeitsrepo::aufrufe()` unverändert).
  - Gegeben ein ETag, wie das Programm vor dieser Karte ihn zur selben Anfrage gebildet hat, dann gibt die Anfrage 200 mit `wurzel`, nicht 304.

  Heute rot: Der Ein-Commit-ETag hängt nur am Verweis (`src/dienst/diff.rs:388`), der Gesamt-ETag nicht an der Wurzel (`src/dienst/gesamt_diff.rs:700`).

### Sprung in VS Code

- [ ] **AK 3 Sprungziel des Knopfs** (ADR-0042 N1.3, PO Z. 545): Gegeben K-Pfad auf der Review-Seite des Commits, dann zeigt „VS Code“ an:
  - `src/a.rs` auf `vscode://file<W kodiert>/src/a.rs:13` (erste hinzugefügte Zeile, nicht der Hunkanfang 10), Tooltip „In VS Code an Zeile 13 öffnen“
  - `src/nur-weg.rs` auf `…/src/nur-weg.rs:20`
  - `neu.rs` und `bild.png` auf `…/neu.rs` bzw. `…/bild.png` ohne `:<zeile>`, Tooltip „In VS Code öffnen“
  - `src/gross.rs` (K-Gross) vor dem Nachladen ohne `:<zeile>`. Nach „Änderungen anzeigen“ zeigt der Link die erste hinzugefügte Zeile.
  - in Aufgabe #4 `b.js` auf `vscode://file<V kodiert>/b.js:5` (Wurzel von `wb`) und `src/f.rs` auf `…/src/f.rs:31` (letzter Schritt)

  `<W kodiert>` ist jeder Teil von `W` mit `encodeURIComponent`, also `…/R%20x`. Heute rot.
- [ ] **AK 4 Kodierung** (ADR-0042 „Durchsetzung“): Gegeben K-Pfad, dann zeigt „VS Code“ an `a/b?c#d%e:12.rs` auf `vscode://file<W kodiert>/a/b%3Fc%23d%25e%3A12.rs:1`. In der Einheitenprobe ergibt der Pfad `a/b?c#d%e:12.rs` mit der Wurzel `/w x` und Zeile 7 den Link `vscode://file/w%20x/a/b%3Fc%23d%25e%3A12.rs:7`. Der Mutant „nur `esc`“ (heutiges Muster `web/ansicht.js:392`) wird rot. Heute rot.
- [ ] **AK 5 Kein Link, der täuschen könnte** (ADR-0042 Punkt 6): Gegeben K-Pfad, dann tragen `weg.rs` (D) und `bidi-‮datei.dat` kein „VS Code“, wohl aber „Pfad“ und „Patch“. Die Zeilennummern von `bidi-‮datei.dat` springen nicht und tragen keinen Tooltip. Auf der ganzen Seite zeigt kein `a[href^="vscode:"]` auf einen Pfad mit U+202E, roh oder kodiert (`%E2%80%AE`). Einheit: Eine Wurzel mit U+202E ergibt für keine Datei einen Link. Heute rot, weil es keine Knöpfe gibt. Danach ist es der Wächter gegen die Mutanten m4 und m5.
- [ ] **AK 6 Sprung an der Zeilennummer** (ADR-0042 Punkt 6, PO Z. 540 (b)): Gegeben K-Pfad mit `src/a.rs` offen.
  - Klickt `sh` auf die Nummer 13 der neuen Seite, dann wird `vscode://file<W kodiert>/src/a.rs:13` geöffnet. Probe: `location.href` vor dem Wechsel abgefangen. Die Nummer trägt „In VS Code an Zeile 13 öffnen“.
  - Die Kontextzeile 10 springt mit 10.
  - Ein Klick auf eine Nummer der alten Seite (die entfernte Zeile 13 alt) öffnet nichts.
  - Alle Nummern bleiben `aria-hidden="true"`. Die Zahl der `a[href^="vscode:"]` im Diffbereich ist gleich der Zahl der Dateien mit Knopf „VS Code“, also eins je Datei, nicht je Zeile.

  Heute rot.

### Pfad und Patch

- [ ] **AK 7 Pfad kopieren** (ADR-0042 Punkt 6, PO Z. 537, 541): Gegeben K-Pfad in einem sicheren Kontext (`http://127.0.0.1`, Zwischenablage erlaubt).
  - Drückt `sh` „Pfad“ an `src/a.rs`, dann liegt `<W>/src/a.rs` in der Zwischenablage.
  - An `weg.rs` liegt `<W>/weg.rs` darin, an `bidi-‮datei.dat` der Rohpfad mit U+202E (Länge in UTF-16 gleich `W.length + 1 + Länge des Namens`).
  - Unter dem Knopf steht „Pfad kopiert“ in einem Element mit `role="status"`. Die Knöpfe „VS Code“ und „Patch“ haben vor und nach dem Klick dieselbe `getBoundingClientRect()`, auf 0,5 px genau.
  - Die Auflage ist mindestens 2 s nach dem Kopieren noch da und spätestens 10 s danach weg, gemessen mit gestellter Uhr der Seite. Ein Klick an anderer Stelle nimmt sie sofort weg.

  Heute rot.
- [ ] **AK 8 Ohne Zwischenablage** (ADR-0042 Punkt 6, PO Z. 537): Gegeben K-Pfad und eine Seite ohne `navigator.clipboard` (unsicherer Kontext, nachgestellt per Init-Skript), wenn `sh` „Pfad“ an `src/a.rs` drückt:
  - Unter dem Kopf der Datei steht ein schreibgeschütztes Feld mit `<W>/src/a.rs`. Es hat den Fokus, und der Text ist ganz markiert (`selectionStart` 0, `selectionEnd` gleich der Länge).
  - Daneben steht „Pfad markiert — mit Strg + C kopieren“.
  - Es gibt keinen Eintrag in der Konsole und keinen Seitenfehler.

  Dasselbe gilt, wenn `writeText` die Erlaubnis verweigert (abgewiesenes Promise). Heute rot.
- [ ] **AK 9 Patch je Datei** (ADR-0042 Punkt 7): Gegeben K-Pfad.
  - „Patch“ an `src/a.rs` ist ein Link `/api/aufgaben/<nr>/diff?commit=<verweis kodiert>&datei=src%2Fa.rs&format=patch` mit `download="a.rs.patch"`. Sein Inhalt ist bytegleich zur Antwort der Route und beginnt mit der Kopfzeile von Git.
  - An `a/b?c#d%e:12.rs` heißt die Datei `datei.patch`, `datei=` ist `a%2Fb%3Fc%23d%25e%3A12.rs`. An `ä.rs` heißt sie ebenfalls `datei.patch`.
  - In Aufgabe #4 zeigt „Patch“ an `b.js` im Abschnitt `wb` auf `…/diff?anwendung=wb&datei=b.js&format=patch` ohne `commit=`, und die Antwort ist 200 `text/x-diff`.
  - Eine Datei mit dem Hinweis `zu_gross_zum_anzeigen` hat keinen Patch-Link.

  Heute rot.

### Breite, Bestand

- [ ] **AK 10 Beide Ansichten, Breite, Tastatur, Bestand, Mutanten** (PO Z. 539 Änderung 1): Gegeben K-Pfad und Aufgabe #4 bei 320, 414, 980 und 1280 px, hell und dunkel.
  - Die Knöpfe stehen in „Ein Commit“ und in „Alle Änderungen“ im Kopf jeder Datei, auch bei eingeklappten Dateien in offenen Gruppen.
  - Die Seite scrollt nicht quer (`document.documentElement.scrollWidth ≤ clientWidth`), auch nicht mit offenem Feld aus AK 8. Jeder Knopf liegt ganz in der Breite.
  - Jeder Knopf ist mindestens 24 px hoch, bei `pointer: coarse` mindestens 44 px.
  - Die Tab-Folge im Kopf ist Klappknopf, „Pfad“, „VS Code“, „Patch“, und der Fokusring ist sichtbar.
  - Bestand: Was nicht S4 ist, bleibt wie nach R00235. Es gibt keine Commit-Leiste, kein „Gesehen“ und keine Wortmarke. Bestehende Tests behalten ihre Erwartungen. Wo eine Antwort als Ganzes verglichen wird, kommt nur `wurzel` dazu, und der entwickler nennt jede solche Stelle im Bericht.
  - Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie:
    - (m1) nur `esc` statt `encodeURIComponent` → AK 4 rot
    - (m2) Sprung an den Hunkanfang → AK 3 rot (`src/a.rs` 10 statt 13)
    - (m3) Datei ohne Hunk mit `:1` → AK 3 rot (`neu.rs`)
    - (m4) Prüfung auf Sichtbarmachen entfernt → AK 5 rot
    - (m5) gelöschte Datei mit „VS Code“ → AK 5 rot
    - (m6) Nummer der alten Seite springt → AK 6 rot
    - (m7) kein Ersatzfeld, stiller Fehlschlag → AK 8 rot
    - (m8) Patch in „Alle Änderungen“ ohne `anwendung=` → AK 9 rot (`wb`)
    - (m9) `wurzel` nicht im Gesamt-ETag → AK 2 rot
    - (m10) `wurzel` aus dem Text des Registers statt aus `rev-parse` → AK 1 rot

## Betroffene Verzeichnisstruktur

- Server: `src/dienst/diff.rs` (Ein Commit, ETag), `src/dienst/gesamt_diff.rs` (Alle Änderungen, ETag), Beschreibung `src/web/endpunkte.rs` (`DIFF_LESEN`) und `src/web/mod.rs` (OpenAPI am Handler `diff_lesen`). Integrationstests unter `tests/`.
- Oberfläche: reine Funktionen in `web/review-uebersicht.js` (Link, Sprungzeile, Patch-Adresse, Dateiname), Zeichnen in `web/diff.js` (`dateiHtml`, `zeileHtml`) und `web/gesamt.js` (`gesamtDateiHtml`, `schrittHtml`), Ereignisse in `web/app.js` (Klick auf `td.n`, „Pfad“, Ausnahme `a[href^="vscode:"]` bei `:4547`), Stil in `web/kd-app.css`, nur Tokens.
- Tests: `e2e/einheit/` (Node) und `e2e/tests/r00236-review-pfad-vscode-patch.spec.js`. Die Ausgangslage kommt in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1224 `wurzel` in der Antwort**: Das Feld kommt in `Diff` und `Gesamtdiff`, aus der schon bestimmten Wurzel (`src/dienst/diff.rs:315`, `gesamt_diff.rs:77`). Der Gesamt-ETag nimmt `wurzel` auf. Der Ein-Commit-ETag wird vor jedem Git-Aufruf gebildet (`diff.rs:307`). Er nimmt deshalb den Startordner des Registers auf (`Anwendung::startordner`, Text), nicht die Wurzel. Der Versionsteil wechselt (etwa `GRENZEN_VERSION` oder ein eigener Teil, Wahl des entwicklers), damit ein Rumpf ohne `wurzel` aus dem Zwischenspeicher des Browsers nicht per 304 weiterlebt. Beschreibung und Schemas werden nachgezogen.
2. **B1225 rein**: `vscodeLink(wurzel, pfad, zeile)`, `sprungZeile(datei)` über `patchZeilen` (erste `plus`, sonst erste Zeile mit `neu` nach dem ersten Kopf, sonst `null`), `linkErlaubt(wurzel, datei)` (Status ≠ `D`, `sichtbarTeile` lässt Wurzel und Pfad unverändert), `patchAdresse(…)` und `patchName(pfad)`.
3. **B1226 Ein Commit**: Knöpfe im Kopf neben dem Klappknopf (D0009 Bild 6: `.ru-k1`, `.ru-patch`, `.ru-tip`). Der Sprung an `td.n` der neuen Seite (zweite Nummernspalte) wird am Diffbereich delegiert. Nach dem Nachladen wird mit der Sprungzeile neu gezeichnet.
4. **B1227 Pfad kopieren**: Der Helfer `linkInDieZwischenablage` (`web/app.js:2330`) kommt wieder zum Einsatz. Die Auflage „Pfad kopiert“ ist `role="status"`, absolut unter dem Knopf, ohne Verschieben. Das Ersatzfeld ist `readonly`, mit `select()` und Fokus (D0009 `.ru-pf`, `.ru-pfin`).
5. **B1228 Alle Änderungen**: Knöpfe je Abschnitt mit der Wurzel der Antwort dieses Abschnitts. Patch mit `anwendung=`. Bei einer Folge-Datei kommt die Sprungzeile aus dem letzten Schritt mit `patch`.
6. **B1229 Breite, Themen, Tastatur**: messen und nachziehen (AK 10). Die Vorprüfung macht der ux-reviewer.
7. **B1230 Probe im echten Programm**, dann Mutanten m1–m10, Gate und Anforderung abschließen.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht`. Für S4 gilt Bild 6 a)–d) (Tooltips, „Pfad kopiert“, markiertes Feld) und Bild (1) (Tooltip an der Zeilennummer „Zeile 1311“ = erste hinzugefügte Zeile). Verbindlich sind die Wortlaute aus PO Z. 537 und 540 (b), die Auflage nach Z. 541 und die Sprungzeile nach Z. 545.

### Sicherheit (Prüfpunkte für den security-reviewer)

- `wurzel` nach ADR-0032 S2 und N2.4: kein neuer Informationstyp, derselbe Rahmen wie `ordner` und `repository`.
- Kodierung: `encodeURIComponent` je Pfadteil im Link und in der Patch-Adresse, danach `esc` für das HTML-Attribut. Pfade mit `?`, `#`, `%`, `:`, `"`, `<` und Leerzeichen dürfen weder Abfrage noch Fragment noch Zeile noch Attribut werden.
- Bidi und Steuerzeichen: Wo das Sichtbarmachen Wurzel oder Pfad verändert, gibt es keinen Link. Kopiert wird roh, angezeigt sichtbar gemacht.
- Kein neuer Prozess: `git grep -n "spawn\|Command::new"` im Diff der Karte zeigt nichts außer `git`.

## Tests

- **Unit** (Node, rein): Link (ADR-Beispiel, Leerzeichen, `%`, `:`, `#`, `?`, Umlaut, U+202E in Wurzel und Pfad), Sprungzeile (erste `plus`, nur `minus`, kein Hunk, kein `patch`, zwei Hunks, Hunk `+0,0`), Link erlaubt (A, M, R, D, Bidi), Patch-Adresse (Ein Commit, Alle Änderungen mit `anwendung`), Dateiname (`a.rs`, `kd-app.css`, `ä.rs`, `a:b`).
- **Integration** (Rust, echtes Git): `wurzel` in beiden Formen mit `repository` als Unterordner, ETag nach einer Änderung des Registers, 304 ohne Git im Ein-Commit-Diff, alter ETag ergibt 200, `format=patch` bytegleich, OpenAPI nennt `wurzel`.
- **E2E**: AK 3–10 im gestarteten Programm. `vscode:`-Navigation abfangen statt ausführen (Ereignis `click` mit `preventDefault` im Test, oder `page.route` bzw. `framenavigated`). Zwischenablage über die Rechte des Kontexts, der unsichere Kontext per Init-Skript. Lage mit `getBoundingClientRect`, Lebensdauer der Auflage mit `page.clock`.

## Abhängigkeiten

- Abhängig von: R00207 (I0197 Review-Seite eines Commits, grün), R00210 (I0200 Alle Änderungen, grün), R00235 (I0225 Dateien nach Art gruppiert, grün, #252 auf main), ADR-0042 Punkte 6, 7 und N1.3, ADR-0032 (S2, N2.4, N6), ADR-0033 Punkt 8
- Blockiert: keine. #256–#260 brauchen #252, nicht #255.

## Offene Fragen

Keine blockiert. Bis zur Antwort gilt jeweils die Empfehlung.

- An den product-owner: Wie lautet der Tooltip von „VS Code“ ohne Zeile (FA 5)? Empfehlung: „In VS Code öffnen“, wortgleich mit dem Knopf im Aufgabenfenster (`web/ansicht.js:392`, eine Benennung je Ding, Z. 399).
- An den architekt: Darf der Ein-Commit-ETag den Startordner des Registers aufnehmen (FA 2)? ADR-0042 Punkt 6 nennt `wurzel` im ETag nur für den Gesamt-Diff. Der Ein-Commit-ETag entsteht aber vor jedem Git-Aufruf (`src/dienst/diff.rs:307`), und ohne Änderung bestätigte ein 304 nach einer Änderung des Registers die alte Wurzel. Empfehlung: ja, als Text ohne Git, und dazu ein Versionswechsel für Rümpfe aus der Zeit vor der Karte.
- An den product-owner, über die UX-Vorprüfung: Wie lange bleibt das Ersatzfeld stehen (FA 9)? Empfehlung: bis zum nächsten Druck auf „Pfad“ einer Datei oder bis zum Blättern. Ein Neuzeichnen durch ein Live-Ereignis nimmt es nicht weg.

## Manuelle Vorbereitungstätigkeiten

- keine

## Manuelle Nachbereitungstätigkeiten

- Probe mit einem echten VS Code am Rechner des Boards: Ein Link aus AK 3 öffnet nach der Nachfrage von VS Code (`shouldBlockOpenable`) die Datei an der Zeile. Diese Probe läuft nicht im Gate, sie gehört zur Abnahme des Menschen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Entwurf des Betreibers zu #252, Punkt 8: Aus der Review-Seite soll man in VS Code an der geänderten Stelle weiterlesen und den Pfad kopieren können. Heute fehlt dafür die Wurzel, denn der Pfad im Diff ist relativ zum Repository, und das Register nennt einen Unterordner. Liefert die Diff-Antwort die Wurzel aus `rev-parse`, kann die Oberfläche den echten absoluten Pfad bilden, ohne zu raten. Kodiert sie jeden Teil und verzichtet sie auf Links bei Bidi-Pfaden, kann kein Dateiname aus einem Commit den Link auf ein anderes Ziel lenken. Springt der Link an die erste hinzugefügte Zeile, landet der Prüfer an der Änderung selbst und nicht drei Kontextzeilen davor. Der Patch je Datei ersetzt den Diff in VS Code ohne neuen Prozess am Server. Der Hebel ist das eine neue Feld: Alles andere sind reine Funktionen der Oberfläche über Daten, die es schon gibt.

## Missing-Docs

- VS Code 1.147.0: Verhalten von `vscode://file/<pfad>:<zeile>` bei kodierten Zeichen (`%3A` im Namen gegen `:` vor der Zeile). Im ADR gelesen ist nur `getWindowOpenableFromProtocolUrl`, und die Zerlegung der Zeile ist dort nicht belegt. Die Abnahme mit echtem VS Code (Nachbereitung) schließt die Lücke.

## Notizen

- **Wortlaute mitziehen (Kommentar an #255, 11:05):** ADR-0042 Punkt 3 und A00009 Z. 73 tragen noch „Test geändert, nicht neu“ und „Test entfernt“. Richtig sind nach PO Z. 537 „bestehender Test geändert“ und „Test gelöscht“. Das schreibt der architekt, nicht der planer und nicht der entwickler. Diese Anforderung ändert daran nichts.
- **Randfälle des planers**, als Kriterium aufgenommen:
  - Datei ohne geladenen `patch` ohne Zeile, bis sie nachgeladen ist (FA 5). N1.3 nennt nur „ohne Hunk“.
  - Patch in „Alle Änderungen“ mit `anwendung=` (FA 10). Ohne den Parameter nähme die Route die erste Anwendung, und in `wb` käme 404.
  - Folge-Datei aus dem letzten Schritt (FA 11).
  - Ein-Commit-ETag und Versionswechsel (FA 2).
  - Dateiname `datei.patch` für jeden letzten Pfadteil mit anderen Zeichen als `[A-Za-z0-9._-]` (FA 10). Gelesen ist das als „besteht nur aus“, nicht als „herausgefiltert“.
- **Entscheidung des planers**: Die Auflage „Pfad kopiert“ steht mindestens 2 s und höchstens 10 s (AK 7). Der PO sagt „verschwindet von selbst“, ohne Zahl. Die Spanne macht das prüfbar, ohne eine Dauer vorzuschreiben.
- Verworfene Alternativen: ADR-0042 D1/D2 (Diff in VS Code über einen lokalen Aufruf), endgültig verworfen durch N1.3. `<a>` je Zeilennummer, verworfen in ADR-0042 Punkt 6 (bis zu 200.000 Links).
- Bewusst nicht in S4: Commit-Leiste (#256), Gesehen (#257), Wortmarke (#258), Umbrechen (#259), Nebeneinander (#260).
