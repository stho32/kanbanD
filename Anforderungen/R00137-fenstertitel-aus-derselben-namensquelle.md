---
id: R00137
status: Neu
datum: 2026-11-11
---

# R00137: Fenstertitel aus derselben Namensquelle wie die Seitenüberschrift

## Beschreibung

Der Fenstertitel (der Text im Browser-Tab, `document.title`) nennt heute für die Berichte eigene Namen, die von den Namen im Menü „Berichte“ und in der Seitenüberschrift abweichen: „Zeiten“ statt „Zeiten nach Aufgabe und Person“, „Fever Chart“ statt „Projekt-Fever-Chart“, „Bestand“ statt „Bestand nach Labels“. Diese zweite Tabelle steht in `fenstertitel()` (`web/app.js:959–964`), während der Seitenknopf und die verborgene Seitenüberschrift (`h1`, R00113/ADR-0018 Regel 2) den Seitennamen aus `web/seitenname.js` nehmen. Nach dieser Anforderung nennt der Fenstertitel je Route denselben Namen wie die Seitenüberschrift; es gibt nur noch eine Namensquelle (Karte #112, Befund aus dem Rechtschreib-Review zu #13/R00113, PO-Entscheidung 2026-11-08).

Zahlt ein auf: [Vision](R00000-vision.md) — „folgt gewohnten Konventionen“ und Leitplanke „Eine festgelegte Kultur“: ein Name für eine Seite, an jeder Stelle derselbe.

## Geschäftlicher Nutzen

Wer mehrere Tabs offen hat, liest am Tab, auf welcher Seite er ist. Heute heißt derselbe Bericht im Tab „Zeiten“, im Menü und in der Überschrift aber „Zeiten nach Aufgabe und Person“ — zwei Namen für eine Sache. Mit einer Quelle zeigt der Tab denselben Namen wie Menü und Überschrift, und ein umbenannter Bericht muss nur an einer Stelle gepflegt werden. Der Befund ist ein Sonderfall der Regel „eine Regel an einem Ort“ (R00113, ADR-0018 Regel 2); die Namensliste existiert bereits in `web/seitenname.js`, sie wird nur nicht überall benutzt.

## Funktionale Anforderungen

### Eine Namensquelle
1. Der Fenstertitel bezieht den Seiten- und Berichtsnamen ausschließlich aus `web/seitenname.js` (ADR-0018 Regel 2, eine Regel an einem Ort wie in R00113); `web/app.js` führt **keine** eigene Tabelle der Seiten- und Berichtsnamen mehr (heute die Zuordnung in `fenstertitel()`, `web/app.js:959–964`).
2. Je Route ist der Namensteil des Fenstertitels **gleich der Seitenüberschrift** (`seitenUeberschrift`, dieselbe Zeichenkette wie die verborgene `h1`, R00113): „Aufgaben“, „Personen“, „Einrichten“, „Board · <Boardtitel>“, „Berichte · <Berichtsname>“, „WBS · <Anwendung>“.
3. Für alle acht Berichte stimmt der Name mit dem Menü „Berichte“ (`BERICHTSNAMEN`) überein, insbesondere „Zeiten nach Aufgabe und Person“ (kreuz), „Projekt-Fever-Chart“ (fieber) und „Bestand nach Labels“ (bestand) statt „Zeiten“, „Fever Chart“ und „Bestand“.

### Was wie heute bleibt
4. Der Zähler laufender Timer steht weiter vorn im Fenstertitel: `(n ▶) ` bei n laufenden Timern, sonst nichts.
5. Der Anwendungsname „ — kanbanD“ steht weiter am Ende.
6. Die WBS-Route behält ihren heutigen Fenstertitel `<Stand> % · WBS · <Anwendung> — kanbanD` (Sonderform, nicht die Seitenüberschrift).
7. Im Zustand des ersten Starts (noch nicht eingerichtet) behält der Fenstertitel „kanbanD“ wie heute.

## Nicht-funktionale Anforderungen

- **Nicht sichtbar**: die Änderung betrifft nur `document.title`; die gezeichnete Seite, die verborgene `h1` und der Seitenknopf bleiben unverändert. Kein Artboard (nichts wird neu sichtbar).
- **Rückwärtsverträglich**: keine bestehende Probe prüft `document.title`; Sichten und Überschrift bleiben unberührt.

## Akzeptanzkriterien

**Grundbestand**: die Routen der Anwendung — Board mit Boardtitel „Entwicklung“ (und ein defektes Board ohne Titel), WBS der Anwendung „kanbanD“, die acht Berichte, Aufgaben, Personen, Einrichten — wie in `web/seitenname.js` (`seitenNameVon`, `BERICHTSNAMEN`) und in `web/app.js` (`vHaupt()`).

Probe: Erweiterung von `e2e/einheit/seitenname.test.js` (`node --test`, Muster `e2e/einheit/kartenname.test.js`).

- [ ] **1. Ein Name je Route (Probe)**: Gegeben eine Route, wenn ich den Namens-Teil des Fenstertitels bilde, dann ist er gleich der Seitenüberschrift derselben Route — für jede Route; die Liste der Routen ist gegen die Verzweigungen von `vHaupt()` (`web/app.js`) und gegen `Object.keys(BERICHTSNAMEN)` abgeglichen.
- [ ] **2. Berichtsnamen wie im Menü**: Gegeben die Berichtsroute `berichte/kreuz`, wenn ich den Fenstertitel ohne Zähler und ohne „ — kanbanD“ ansehe, dann lautet er „Berichte · Zeiten nach Aufgabe und Person“; ebenso „Berichte · Projekt-Fever-Chart“ (`fieber`) und „Berichte · Bestand nach Labels“ (`bestand`).
- [ ] **3. Keine zweite Tabelle**: Gegeben `web/app.js`, wenn ich den Rumpf von `fenstertitel()` prüfe, dann enthält er kein Literal eines Seiten- oder Berichtsnamens (kein „Zeiten“, „Burndown“, „Aufgaben“……) und ruft die Namensfunktion aus `web/seitenname.js`; die Namensliste steht nur in `web/seitenname.js`.
- [ ] **4. Zähler und Anwendung wie heute**: Gegeben zwei laufende Timer, wenn ich den Fenstertitel ansehe, dann beginnt er mit „(2 ▶) “ und endet mit „ — kanbanD“.
- [ ] **5. WBS und erster Start unverändert**: Gegeben die WBS-Route mit Stand 63 %, wenn ich den Fenstertitel ansehe, dann lautet er „63 % · WBS · kanbanD — kanbanD“; im ersten Start lautet er „kanbanD“ (beides wie heute).
- [ ] **6. Mutante (rot)**: Gegeben eine Mutante, die in **einer** Quelle einen abweichenden Namen liefert (z. B. `berichte/kreuz` → „Zeiten“, sei es in `web/seitenname.js` oder als zweite Tabelle in `web/app.js`), wenn die Probe läuft, dann wird sie rot und nennt die betroffene Route.

## Betroffene Verzeichnisstruktur

```
web/
├── seitenname.js   # eine Namensquelle; liefert den Fenstertitel (neu, neben seitenUeberschrift; lädt in Browser und Node)
└── app.js          # fenstertitel() bezieht den Namen von dort, keine eigene Tabelle; erste-Start-, WBS-, Zähler-Zustand bleiben hier
e2e/
└── einheit/seitenname.test.js   # Probe über alle Routen und die Mutante (node --test)
```

Kein Server, kein Dateiformat, keine Migration, kein Commit-Schema.

## Technische Überlegungen

### Ablauf
1. `render()` setzt weiter `document.title = fenstertitel()` (`web/app.js:675`).
2. `fenstertitel()` in `web/app.js` prüft den ersten Start („kanbanD“) und bildet sonst die Seite `{ ansicht, boardTitel, anwendung }` sowie die Anwendungszustände (Zähler laufender Timer, WBS-Stand und -Anwendung).
3. Eine **reine Funktion** in `web/seitenname.js` setzt daraus den Titel zusammen: `[Zähler]seitenUeberschrift(seite) — kanbanD`, für die WBS `<Stand> % · WBS · <Anwendung> — kanbanD`. Sie ist ohne Browser prüfbar (Modul lädt in Browser und Node, Muster `web/seitenname.js`/`web/kartenname.js`, ADR-0018 Regel 4).

### Grobentwurf
- `web/seitenname.js`: `fenstertitelName(seite, { zaehler, wbsStand, wbsName })` (rein) — der Fenstertitel aus `seitenUeberschrift` (eine Namensquelle) plus Zähler vorn und „ — kanbanD“ hinten; WBS-Sonderform, wenn `ansicht === 'wbs'` und `wbsName` gesetzt ist; exportiert wie die übrigen Funktionen. **Keine** zweite Namensliste.
- `web/app.js`: `fenstertitel()` ruft `fenstertitelName` und behält nur, was Anwendungszustand ist (erster Start, `alleLaufenden().length`, `prozente(S.wbs.stand).gruen`, `S.wbs.name`, `boardTitelDerSeite()`, `anwendungDerSeite()`).

### Änderungen an bestehenden Klassen
- `web/app.js`: `fenstertitel()` verliert die `seiten`-Tabelle (`:961`) und ruft die neue reine Funktion; die WBS-Bedingung (`:960`) und der erste-Start-Rückfall (`:960`) bleiben dem Sinne nach erhalten.
- `web/seitenname.js`: neue reine Funktion neben `seitenNameVon`/`seitenUeberschrift`; `Object.assign`-Export erweitern.
- Kein Server (`src/`), kein Dateiformat.

## Tests

Nach Skill `test-pyramide`; jede Zusage wird eine Prüfung (Skill `test-ehrlichkeit`).

- **Unit (node --test)**: `e2e/einheit/seitenname.test.js` erweitert — für jede Route ist `fenstertitelName(...)` (ohne Zähler) gleich `seitenUeberschrift(seite) + ' — kanbanD'`; die drei genannten Berichtsnamen im Wortlaut; der Zähler-Zusatz „(2 ▶) “; die WBS-Sonderform; der Rumpf von `web/app.js` `fenstertitel()` ohne Namensliterale (Textprüfung der Quelldatei).
- **Mutante**: eine Quelle, die `berichte/kreuz` „Zeiten“ nennt (in `web/seitenname.js` oder als zweite Tabelle in `web/app.js`), macht die Probe rot und nennt die Route. Vorbild: die Mutanten der Routenprobe R00113.
- **Mitlaufend grün**: `node --test e2e/einheit/` (u. a. `seitenname.test.js`) und die bestehenden Sichten bleiben unberührt; keine Probe prüft heute `document.title`.

## Abhängigkeiten

- Abhängig von (grün): I0102 (R00113, `web/seitenname.js`, `h1`/ADR-0018 Regel 2). Keine offene Vorbedingung.
- ADR-0018 (Akzeptiert), Regel 2 (Seitenname aus `seitenName`) und Regel 4 (Modul in Browser und Node).
- Blockiert: keine Interaction.

## Offene Fragen

Keine, die den Bau blockieren. Empfehlungen des planers (Entscheidungen im Bericht):

1. **Umfang des Namens**: Der Fenstertitel trägt die **volle Seitenüberschrift** („Berichte · Burndown“, „Board · Entwicklung“) — dieselbe Zeichenkette wie die `h1`. Das ist die wörtliche Lesart von „der Name im Fenstertitel ist gleich dem Namen der Seitenüberschrift“ und macht die Probe einzeilig prüfbar. Präfix („Berichte · “) und Suffix („ — kanbanD“) sind Namensquelle bzw. Anwendungsname, keine zweite Benennung. Nur der Board- und Berichts-Tab gewinnt damit das Seitenpräfix.
2. **Erster Start**: unverändert „kanbanD“, weil kein Name der Einrichtungsseite heute einen Seitenknopf trägt; nicht Teil des Befunds.
3. **Kein Artboard**: nur `document.title` ändert sich; die Vision-Leitplanke „Jede Gestaltung wird freigegeben“ gilt für Sichtbares (R00113 führte die Regel analog ohne Artboard ein).

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist ein Widerspruch, den der Mensch bei offenen Tabs jeden Tag sieht: derselbe Bericht heißt im Tab „Zeiten“ und in Kopfzeile und Menü „Zeiten nach Aufgabe und Person“. Ursache ist eine zweite Namensliste in `fenstertitel()`, die seit der Umstellung auf `web/seitenname.js` (R00113) niemand mitgezogen hat. Die Änderung nimmt die zweite Liste weg und speist den Fenstertitel aus derselben Quelle wie die Seitenüberschrift. Die Wirkungskette: eine Namensquelle in `web/seitenname.js` → ein reiner Titel aus `seitenUeberschrift` → Tab, Menü und Überschrift nennen dieselbe Seite gleich → der Mensch erkennt die Seite am Tab, und ein künftig umbenannter Bericht wird an genau einer Stelle gepflegt, statt an zweien zu veralten. Der Hebel ist die Funktion `fenstertitel()` selbst und nicht eine vorgelagerte Stelle: die Namen liegen schon vor, es fehlt nur der Verzicht auf die eigene Tabelle.

## Missing-Docs

- Das Glossar hat keinen Eintrag für „Fenstertitel“ und „Seitenüberschrift/Seitenname“. Vorschlag: nach dem Bau ein Eintrag, der `web/seitenname.js` als die eine Namensquelle nennt (R00113/R00137).

## Notizen

**Eigene Interaction unter D0002.** Der Fenstertitel gilt quer über alle Routen, wie I0096 (Kontrast) und I0102 (Struktur für Hilfstechnik) unter D0002 hängen; er hängt am Renderer (`render()` → `fenstertitel()`), nicht an einer einzelnen Sicht. Muster: I0102/R00113 (Seitenüberschrift aus `web/seitenname.js`). Kein Feature, keine Bubbles vorgeplant: eine reine Funktion, ein Aufrufer, eine Probe (Sparbetrieb).

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — Fenstertitel = Abnehmer der Seitenüberschrift, eine reine Funktion in `web/seitenname.js`** (gewählt): eine Namensquelle, node-testbar, deckt die ganze Kette Zähler ↔ Zuweisung ab.
- **B — nur die Berichtsnamen in `app.js` auf `BERICHTSNAMEN` umstellen, Form sonst wie heute**: kleinster Eingriff, aber `app.js` bliebe ein zweiter Ort für die Zuordnung Route → Name und die WBS-Sonderform bliebe ungetestet; trägt den Befund nur halb.
- **C — den Fenstertitel je Sicht mit `seitenUeberschrift` bilden (kein gemeinsames Modul)**: mehrere Schreibwege, ein Unit-Test ohne Browser unmöglich; verworfen.

**Verwiesenes**
- Karte #112 „Fenstertitel aus derselben Namensquelle wie die Seitenüberschrift“ (Herkunft: Rechtschreib-Review #13/R00113, PO-Entscheidung 2026-11-08; Architektur bestanden 2026-11-11, keine Technikfrage).
- R00113 FA 2 / ADR-0018 Regel 2: die `h1` beginnt mit dem Seitennamen aus `seitenName()`; `web/seitenname.js` ist seit R00113 die eine Namensquelle.
