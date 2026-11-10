# ADR-0019: Vergessene Timer sind Anzeige, nicht Datenbestand — Schwelle als reine Regel, ein Neuzeichnen an der Kante, Erinnerung je Tab

**Status**: Akzeptiert
**Datum**: 2026-11-10
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #15)
**Kontext-Anforderung**: Karte #15 „Vergessene Timer sichtbar machen“ (Label `ux`, UX-Durchsicht); Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: — (getragen von der Systemantwort: reine Module mit Unit-Test, der Sekundentakt als einziger Zeitgeber, der gebaute Sicherer aus ADR-0007 N1; Belege im Kontext)

## Kontext

Die Karte beschreibt einen Zustand, den die Oberfläche heute zeigt, ohne ihn zu bewerten: Drei Timer laufen seit 143 Stunden; die Karte auf dem Board zeigt den laufenden Chip `143:10:23`, die Seite Personen in derselben Lage „Woche 137:25“. Verlangt ist eine Schwelle (Vorschlag 10 h), ab der der Chip als Störung lesbar wird („läuft seit 6 Tagen“, Fläche/Schrift in einer Fehlerrolle), dazu ein Hinweis mit der Aktion „Zeit korrigieren“.

Belegt im Code (gelesen, Stand `9bc9c21`):

- **Der laufende Timer wird an sechs Stellen gezeichnet**, fünf davon mit eigener Laufzeitrechnung: Karte `span.lauf` mit `data-since`/`data-fmt="s"` (`web/ansicht.js:535`), Fensterblock „LÄUFT GERADE“ (`:322`), Zeile der Zeittabelle samt vorhandenem Korrigieren-Knopf `data-act="zeit-edit"` (`:330`), Zeile der Seite Personen (`:826`), Pop „Läuft gerade“ (`vLaufPop`, `:158`); der Zähler im Kopf `#t-lauf` (`:153`) zählt nur. Die Laufzeitbasis ist überall `laufBeginn(a,z) = max(Datei-Minute, lokale Startsekunde)` (`:379–380`).
- **Die Datei kennt nur Minuten** (`JJJJ-MM-TT HH:MM`, `web/zeiten.js:3–9`). Die Startsekunde merkt sich der Browser in `localStorage` und wirft sie nach einem Tag weg (`web/app.js:18–24`). Der Server hält eine `Instant` nur im Speicher und nur für Timer, die über ihn gestartet wurden; sie steht nicht in der API und ist nach einem Neustart fort (`src/dienst/timer.rs:7–13`, `:21–30`).
- **Ein Zeitgeber existiert schon**: der Sekundentakt `setInterval(…, 1000)` (`web/app.js:2469–2479`). Er schreibt heute **nur Text** fort (`[data-since]`, `[data-summe-basis]`, `[data-ext]`) und löst ein Neuzeichnen nur aus, wenn er **Zustand** ändert (Ablauf von `extern`-Markierungen und des Hinweises, `:2472–2473`), dann genau einmal und hinter dem Tor `zug == null && !S.ui.neu` (`:2477`).
- **Gezeichnet wird aus dem Zustand**: `render()` ersetzt `#kopf`, `#main` und `#over` per `innerHTML` (ADR-0007); was ein Mensch gerade tippt, rettet der Sicherer aus ADR-0007 (Nachtrag N1 gebaut). Ein Live-Ereignis zeichnet nach ADR-0014 nur aus einem übernommenen Stand neu.
- **Der Hinweis (Toast) kennt heute genau eine Aktion**: `S.ui.hinweis.undo`, gezeichnet als Knopf „rückgängig“ (`web/ansicht.js:772–776`), gebunden an Strg+Z (`web/app.js:1907`) und nach ADR-0017 im obersten modalen Dialog verankert (`web/ansicht.js:747–765`).
- **Der Kartenname wird an einer Stelle gebildet**: `kartenName()` (`web/kartenname.js:14–20`), Ergebnis am `listitem` (`web/ansicht.js:537`), Aspekt [X00005](../Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md)/ADR-0018. Beim Anspringen der Karte zählt dieser Name, nicht der innere Text; ein `aria-label` an einem `span` ohne benennbare Rolle ist nach ARIA 1.2 wirkungslos (Regelwerk, nicht mit echter Hilfstechnik gemessen).
- **Hausform für Schwellen**: R00068 legt `MINDESTLAUF` als Konstante neben die Regel und prüft die Grenze (19 s/20 s) als Unit-Test (`src/dienst/timer.rs:7–13`, `:54–62`). Der Chip `span.lauf` hat heute **keine** Gestaltung (`grep lauf web/kd-app.css` → nur `#t-lauf .lang`, `#durchlauf`); eine Fehlerfläche braucht ein Token-Paar nach ADR-0011.
- **Die Wochensumme ist richtig, nicht falsch**: laufende Einträge zählen bis jetzt (`web/zeiten.js:18–20`, `:47–48`; R00021), ein seit Montag laufender Eintrag füllt also die Woche.

Damit ist die Frage der Karte nicht „wie sieht der Chip aus“, sondern: **Wo lebt die Tatsache „dieser Timer ist vergessen“ — in der Anzeige, in der Datei oder im Server?** Sie ist eine Technikfrage, weil die Antwort bestimmt, ob ein passiver Betrachter Commits erzeugt, ob Agenten den Zustand sehen, und ob die Regel an sechs Stellen oder an einer steht.

### Qualitätsziele und Szenarien

- **Sichtbarkeit ohne Aufschreien** (Karte #15, Abnahme-Probe): Ein Timer über der Schwelle trägt eine eigene Klasse und einen Namen mit „läuft seit …“; der Hinweis bietet eine Aktion, die den vorhandenen Zeit-Editor auf dem richtigen Eintrag öffnet.
- **Ein Zeitgeber, kein zweiter**: Die Anzeige bleibt ohne Ereignis aktuell und löst höchstens **einmal je Überschreitung** ein Neuzeichnen aus — nicht einmal je Sekunde (Lastprofil `AI-Team/umgebung.md`: 10 Agenten, bis 5 Schreibzugriffe/s; heute zeichnet jedes Ereignis voll neu).
- **Kein Schreibräuschen**: Wer nur zusieht, schreibt nichts. Die Datei ist die Wahrheit, und jede Aktion ist ein Commit (ADR-0002, ADR-0005); ein Betrachter, der drei Tabs offen hat, darf aus Zeitablauf keine drei Commits machen.
- **Testbarkeit**: Die Grenze ist als reine Funktion mit Unit-Test prüfbar, nach dem Muster von R00068.
- **Reversibilität**: Die Schwelle ist heute eine Konstante; einstellbar machen ist später additiv (Board-Einstellung, Dateiformat), nicht Umbau.

## Optionen

### Option A: Die Anzeige rechnet — reine Regel im Zeitmodul, Neuzeichnen an der Kante, Erinnerung im Tab

Schwelle und Prädikat liegen als reine Funktion in `web/zeiten.js`; der Renderer entscheidet Klasse, Text und Name aus dem Zustand; der Sekundentakt erkennt nur den **Übergang** und bittet um ein Neuzeichnen; der Hinweis ist gewöhnlicher Sichtzustand (`S.ui`), die Aktion setzt den vorhandenen Zeit-Editor.

- Vorteile: eine Regel für alle Zeichenstellen, ein Unit-Test der Grenze; kein neuer Schreibweg, kein Dateiformat, keine API; folgt den vorhandenen Mustern (reine Module, Sekundentakt, ADR-0007-Sicherer, ADR-0017-Hinweis); die Anzeige kennt die Startsekunde genauer als Datei und Server.
- Nachteile: Der Zustand ist flüchtig — jedes Neuladen und jeder zweite Tab erinnert erneut; Agenten und API sehen „vergessen“ nicht; die Schwelle ist eine Konstante, ihre Änderung braucht eine Auslieferung; je Überschreitung entsteht ein volles Neuzeichnen.

### Option B: Der Zustand gehört in die Datei — Merkmal am Zeiteintrag

Ein laufender Eintrag über der Schwelle wird in `boards/*.md` markiert (z. B. `vergessen: true`, oder „erinnert am …“), geschrieben über einen neuen Schreibweg; die Oberfläche zeigt nur das Merkmal.

- Vorteile: Der Zustand überlebt Neuladen, Tabs und Neustarts; Agenten und CSV sehen ihn ohne neue Rechnung; die Datei bleibt die einzige Wahrheit.
- Nachteile: Ein **Betrachter** verursacht einen Commit, sobald eine Schwelle abläuft — mit drei offenen Tabs drei konkurrierende Schreiber auf derselben Datei (Sperre, 409, Rauschen in der Geschichte); das Dateiformat ist öffentlich (Agenten, Berichte, Export) und wird für einen Anzeigezustand erweitert; die Schwelle müsste zusätzlich im Server stehen, und nach einem Neustart wäre sie aus der Minute neu zu rechnen; Rücknahme später heißt Dateien migrieren.

### Option C: Der Server rechnet und liefert — Feld an jedem laufenden Timer in der API

`GET /api/zustand` (bzw. die Aufgabensicht) trägt je laufendem Eintrag `seit` bzw. `vergessen`; die Oberfläche zeigt nur.

- Vorteile: eine Regel in Rust, für Oberfläche und Agenten zugleich; kein Schreibzugriff; die Anzeige hat keine eigene Schwelle.
- Nachteile: Zwischen zwei Ereignissen müsste die Oberfläche den Wert trotzdem selbst fortschreiben (Sekundentakt) — es gäbe zwei Uhren mit zwei Grenzen; die `Instant` des Servers ist nach einem Neustart fort, er müsste aus der Minutenangabe rechnen und läge damit systematisch hinter der Anzeige; die Nutzlast wächst für alle laufenden Timer in jeder Antwort; eine reine Anzeigefrage zieht eine API-Zusage nach sich (OpenAPI, Tests, ADR-0003-Fehlerbilder).

### Option D: Der Takt schreibt in den DOM — der Chip steht immer im Markup

Der Renderer zeichnet den Chip immer, mit der Schwelle als Datenattribut; der Sekundentakt setzt Klasse und Text direkt am Knoten (wie heute schon den Text von `[data-since]`).

- Vorteile: kein einziges zusätzliches Neuzeichnen; der billigste Weg zur Laufzeit; die Textfortschreibung im Takt ist bereits Hausform.
- Nachteile: Die Regel stünde zweimal (Renderer: Text und Element; Takt: Klasse und Name) und driftet; das DOM wäre nicht mehr reine Projektion des Zustands, ein späterer `render()` müsste dieselbe Entscheidung erneut treffen; der Hinweis braucht ohnehin ein Neuzeichnen (er liegt in `#over`), der Vorteil schrumpft also auf den Chip; die Klasse überlebt kein Neuzeichnen, wenn der Takt sie nicht erneut setzt.

## Entscheidung

**Gewählt: Option A.** „Vergessen“ ist eine Aussage über die Anzeige, abgeleitet aus Zeit und Zustand — kein Bestand. Sie wird an einer Stelle gerechnet, an einer Stelle entschieden und an einer Kante gezeichnet. Bewusst in Kauf genommen: Die Erinnerung ist flüchtig (je Tab, überlebt kein Neuladen), Agenten sehen den Zustand nicht, und die Schwelle ist bis auf Weiteres eine Konstante.

Nicht betroffen: Dateiformat und Modell ([A00006](../Architektur/A00006-modell.md)), HTTP-Schicht und OpenAPI ([A00003](../Architektur/A00003-web-schicht.md)), Dienste ([A00004](../Architektur/A00004-dienste.md)).

### Regeln

1. **Schwelle und Prädikat an einer Stelle** — `web/zeiten.js` (reines Modul, im Browser und in Node geladen, `Object.assign` am Ende wie heute):
   - eine Konstante `VERGESSEN_MS = 10 * 3600e3` und eine reine Funktion, die aus Laufzeit in ms ein Wahr/Falsch macht;
   - Basis ist die Laufzeit aus `laufBeginn` (Datei-Minute, für hier gestartete Timer die lokale Startsekunde) — **nicht** die Server-`Instant` (nach Neustart fort, nicht in der API);
   - Grenz-Unit-Test nach dem Muster von R00068: 9:59:59 falsch, 10:00:00 wahr, weit darüber wahr; unbekannter Beginn zählt als nicht vergessen;
   - kein zweites `10 * 3600e3`, kein zweiter Vergleich in `web/ansicht.js`, `web/berichte.js` oder `web/app.js`.
2. **Der Zustand wird beim Zeichnen entschieden** — nicht im Takt, nicht am Knoten:
   - Der Chip der Karte ist `span.lauf.vergessen` (`vergessen` ist frei; nicht `leer`, Projektlehre 2026-11-06) und trägt den Text „läuft seit 6 Tagen“; dieselbe Entscheidung gilt für Fenster, Zeittabelle, Pop und Seite Personen, soweit die Karte sie verlangt — der Zähler im Kopf bleibt ein Zähler.
   - Den Text der Dauer bildet `web/kultur.js` (ADR-0013), nicht `zeiten.js`: „6 Tagen“, „14 Stunden“ sind Anzeigekultur; `zeiten.js` liefert nur ms und Wahr/Falsch.
   - Der Kartenname wächst in `kartenName()` um den Zusatz „Timer läuft seit 6 Tagen“ (X00005/ADR-0018: der Name des Listeneintrags ist die eine Stelle). Ein eigenes `aria-label` am Chip ist wirkungslos, weil der Name des `listitem` das Innere ersetzt; der Chip bleibt nicht fokussierbar.
   - Der laufende Sekundentext bleibt `[data-since]`; er ändert nur die Zahl, nicht den Zustand.
3. **Der Sekundentakt erkennt die Kante** — er entscheidet keinen Zustand:
   - Der Takt vergleicht je laufendem Timer „vergessen“ mit dem, was er zuletzt gesehen hat; beim Übergang falsch → wahr setzt er genau einmal ein Neuzeichnen an, im vorhandenen Tor (`zug == null && !S.ui.neu`, `web/app.js:2477`).
   - Kein Neuzeichnen je Sekunde; die Zahl im Chip läuft weiter über `[data-since]`. Läuft bereits ein Zug oder steht „Neue Aufgabe“ offen, unterbleibt das Zeichnen und der Übergang wird beim nächsten Takt nachgeholt (kein Verlust, nur Verzug).
   - Der Übergang wahr → falsch (Timer gestoppt, gelöscht, korrigiert) entsteht durch die Aktion selbst und damit durch ihr eigenes Neuzeichnen; der Takt muss ihn nicht melden.
4. **Die Erinnerung ist Sichtzustand, kein Bestand**:
   - `S.ui` führt die Menge der bereits erinnerten Timer (Schlüssel `nr|wer`, gepflegt auf die gerade laufenden); sie wird bei Übergang gefüllt und beim Verschwinden des Timers bereinigt.
   - Der Hinweis ist ein gewöhnlicher Eintrag `S.ui.hinweis` mit einer **benannten Aktion** neben dem vorhandenen `undo`: `{ text, aktion: { text: 'Zeit korrigieren', act: 'zeit-korrigieren', arg: '<nr>|<kennung>' }, at, dauer }`. Das Zeichnen des Toasts zeigt die Aktion als zweiten `lnk`-Knopf (ADR-0015: bricht um, bleibt in jeder Breite bedienbar; ADR-0017: Ort im obersten modalen Dialog).
   - **Strg+Z bleibt ausschließlich `undo`** (`web/app.js:1907` prüft `S.ui.hinweis.undo`). Eine Aktion wird nie per Tastenkürzel ausgelöst; sie ist kein Rückgängig und darf nicht so heißen.
   - Nichts wird in `boards/*.md`, `localStorage` oder `sessionStorage` geschrieben; ein Neuladen erinnert erneut (akzeptiert, siehe Konsequenzen).
5. **Die Aktion knüpft an den vorhandenen Editor an** — kein zweiter Editor, kein neuer Endpunkt:
   - `zeit-korrigieren` setzt `u.offen`, `u.tab = 'inhalt'`, wartet `dateiLaden()` ab, setzt **danach** `u.zeitEdit = kennung` und `u.fokus = '#z-beginn'` (der Fall `oeffnen` löscht `u.zeitEdit`, `web/app.js:1042`; die Reihenfolge ist Teil der Regel).
   - Gezeichnet wird die vorhandene Bearbeitungszeile (`u.zeitEdit === z.kennung`, `web/ansicht.js:329`), gespeichert über den vorhandenen `zeit-ok`/PATCH-Weg (`web/app.js:1430–1432`). Ein Fehler (409/403) erscheint wie heute im Fensterfuß.
   - Fehlt die Person („Ich bin …“), gilt der vorhandene Weg (`ichNoetig()`), nicht ein Sonderfall.
6. **Farbe nur als Paar** — die Fehlerfläche des Chips ist ein Token-Paar in `web/kd-tokens.css` in beiden Dunkelblöcken (Fläche + On-Farbe, ADR-0011), geprüft von der Kontrastprobe; ob das Paar nach Material 3 `error-container`/`on-error-container` heißt, entscheiden die UX-Rollen, nicht diese ADR. Kein Farbwert außerhalb der Tokens.
7. **Grenze dieser Entscheidung**: Sie sagt, *wo* der Zustand lebt und *wie* er auf den Schirm kommt. Sie sagt nicht, *wessen* Timer erinnert wird, *wie* der Satz lautet und *ob* Summen gekappt werden — das sind Anforderungs- und PO-Fragen (Offene Fragen).

### Durchsetzung (Fitness-Funktion)

- **Unit-Test der Grenze** in `e2e/einheit/zeiten.test.js`: 9:59:59 / 10:00:00 / 30 Tage; Dauer aus Datei-Minute und aus lokaler Startsekunde; Grenze als `VERGESSEN_MS`, nicht als Zahl im Test dupliziert.
- **E2E der Abnahme-Probe** nach dem Muster von `e2e/tests/ziele.spec.js`: ein Timer mit altem `beginn` (Fixture/API) zeigt `.lauf.vergessen` mit „läuft seit“, der Name der Karte enthält „läuft seit“, und der Hinweis trägt die Aktion, die den Editor auf **diesem** Eintrag öffnet (`#z-beginn` hat den Fokus, die Zeile ist die des Eintrags). Gegenprobe: ein Timer unter der Schwelle trägt weder Klasse noch Text noch Aktion (Muster „Abnahme-Probe positiv und negativ“).
- **Wächter gegen das Sekundenzeichnen**: mit laufendem, noch nicht vergessenem Timer steigt `kdTest.renders()` über mehrere Sekunden nicht; mit einer Überschreitung steigt es genau einmal.
- **Wächter gegen den zweiten Schreibweg**: kein Commit entsteht ohne Aktion; `git log` des Wegwerf-Ordners bleibt während des Zuschauens unverändert.
- **Wächter gegen die zweite Schwelle**: `grep -n "3600e3\|VERGESSEN" web/*.js` findet die Konstante nur in `zeiten.js`.

## Konsequenzen

- **Positiv:**
  - Eine Regel, alle Zeichenstellen; die Grenze ist ohne Browser prüfbar.
  - Kein Dateiformat, keine API, kein neuer Endpunkt, kein neuer Fehlerpfad — die Änderung bleibt in `web/`.
  - Der Zustand kann nicht veralten: er wird bei jedem Zeichnen aus Zeit und Stand neu entschieden.
  - Ein späterer Ausbau (einstellbare Schwelle, Sicht für Agenten) ist additiv und baut auf derselben reinen Regel auf.
- **Negativ / In Kauf zu nehmen:**
  - **Flüchtig**: Neuladen und jeder weitere Tab erinnern erneut; die Erinnerung gilt je Tab, nicht je Board.
  - **Nicht sichtbar für Agenten**: `GET /api/zustand` und die CSV-Ausgabe wissen nichts von „vergessen“.
  - **Konstante**: 10 h ändern heißt ausliefern (bis eine Board-Einstellung kommt).
  - **Ein volles Neuzeichnen je Überschreitung** — bei drei vergessenen Timern drei Zeichnungen, jeweils einmal, nicht je Sekunde.
- **Fallstricke für den Bau:**
  - Der Übergang kann während eines offenen Fensters eintreten; der Sicherer aus ADR-0007 N1 stellt Wert, Cursor und Fokus wieder her — es entsteht kein Commit (anders als im Befund von Karte #19 vor dem Bau). Das gehört in die Probe, nicht ins Vertrauen.
  - Das Tor `!S.ui.neu` verschiebt den Hinweis, solange „Neue Aufgabe“ offen ist; das ist gewollt und kein Fehler.
  - `oeffnen` löscht `u.zeitEdit` (`web/app.js:1042`) — die Aktion muss ihn danach setzen, sonst öffnet sie nur das Fenster.
  - `kartenName` ist durch Unit-Test und Aria-Snapshots gedeckt (ADR-0018); der Zusatz ändert beide. Er nennt die Dauer in Worten, kein Datum, keine ISO-Form (Kulturprobe ADR-0013).
  - Der Chip `span.lauf` ist heute ungestaltet; ohne Token-Paar und Kontrastprobe bliebe „eigene Klasse“ unsichtbar.
  - Die Wochensumme der Seite Personen bleibt wie sie ist (`web/zeiten.js:18–20`, R00021): „Woche 137:25“ ist die Folge des vergessenen Timers, nicht ein Rechenfehler. Wer sie kappen will, braucht eine eigene Anforderung.

### Pre-Mortem

- **F-1: „Der Hinweis kommt im Sekundentakt oder bei jedem Neuladen.“**
  Wahrscheinlichkeit mittel · Schaden mittel. Früh-Indikator: `kdTest.renders()` steigt ohne Ereignis jede Sekunde, oder derselbe Timer erinnert zweimal in einer Sitzung. Gegenmaßnahme vor Start: Kantenlogik plus der Render-Zähler-Wächter; das erneute Erinnern nach einem Neuladen ist ausdrücklich Regel 4 und kein Befund — es steht hier, damit es nicht als Fehler gemeldet wird.
- **F-2: „Die Schwelle steht an zwei Stellen und driftet.“**
  Wahrscheinlichkeit mittel · Schaden hoch. Früh-Indikator: ein zweiter Vergleich in `web/ansicht.js` oder eine Zahl in `web/app.js`. Gegenmaßnahme vor Start: die einzige Konstante in `zeiten.js`, der grep-Wächter; alle Zeichenstellen rufen nur das Prädikat.
- **F-3: „Der Chip ist für Hilfstechnik stumm.“**
  Wahrscheinlichkeit hoch · Schaden mittel. Früh-Indikator: der zugängliche Name der Karte ändert sich mit dem Zustand nicht. Gegenmaßnahme vor Start: der Zusatz in `kartenName` (Regel 2), geprüft über Rolle und Name im E2E; das `aria-label` am Chip ist bewusst nicht der Träger.
- **F-4: „Zuschauen erzeugt einen Commit.“**
  Wahrscheinlichkeit niedrig · Schaden hoch. Früh-Indikator: ein Commit im Wegwerf-Ordner, ohne dass jemand geklickt hat. Gegenmaßnahme vor Start: Regel 4 verbietet jeden Schreibweg; der Bau fügt keinen hinzu, und der Wächter prüft die Geschichte des Ordners.

## Offene Fragen

- **Wessen Timer?** Alle laufenden Timer erscheinen heute auf jeder Karte und auf der Seite Personen, auch fremde. Ob der Hinweis nur eigene nennt, und ob fremde Zeit überhaupt korrigiert werden darf (R00097 regelt Eigentümer nur für Zuständige, nicht für Zeiteinträge), ist eine Regel- und PO-Frage. Empfehlung: Hinweis für alle sichtbaren, Aktion für eigene; fremde bleiben bei Stopp und Korrektur wie heute.
- **Summen kappen?** Soll ein laufender Eintrag über der Schwelle in Tages-/Wochensummen nur bis zur Schwelle zählen (heute bis jetzt, R00021)? Das ist eine Budget-Entscheidung mit Folgen für Stundenzettel und Berichte — eigene Anforderung, nicht diese ADR.
- **Schwelle einstellbar?** Als Board-Einstellung berührt sie Dateiformat, API und Anzeige; dann eigene ADR, die additiv auf dieser aufbaut.
- **Für Agenten sichtbar?** Ein additives Feld in der Aufgabensicht (`seit`, `vergessen`) wäre möglich, ohne diese Entscheidung zu kippen; die Regel bliebe dieselbe, gespiegelt in Rust. Eigene Anforderung, weil sie OpenAPI und Tests nach sich zieht.

## Quellen / Bezüge

- Karte #15 „Vergessene Timer sichtbar machen“ (`ux`); Vorschlag der Karte: Schwelle 10 h, Chip in `error-container`/`on-error-container`, Hinweis mit „Zeit korrigieren“.
- [R00068](../../Anforderungen/R00068-kurze-timerlaeufe-verwerfen.md) (Schwelle als Konstante mit Grenz-Unit-Test), [R00021](../../Anforderungen/R00021-personenuebersicht.md) (laufende Einträge zählen bis jetzt), R00089 (Summe der gebuchten Zeit).
- [ADR-0002](0002-zugregeln-gemeinsam-vor-der-aktion.md) und [ADR-0005](0005-zusammengesetzte-aktionen-in-einem-commit.md) (ein Commit je Aktion), [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md) (Neuzeichnen und Sicherer, N1 gebaut), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md) (Farbrollen als Paare), [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md) (`web/kultur.js`), [ADR-0014](0014-nur-die-neueste-antwort-wird-uebernommen.md) (Übernahme), [ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) (Hinweis und Aktionen in jeder Breite), [ADR-0017](0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) (Hinweisort, Undo, Strg+Z), [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md) mit [X00005](../Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md) (Kartenname), [X00004](../Architektur/Aspekte/X00004-kultur.md) (deutsche Anzeige).
- Bausteine: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md) (primär); berührt `web/zeiten.js`, `web/kultur.js`, `web/kartenname.js`, `web/ansicht.js`, `web/app.js`, `web/kd-tokens.css`, `web/kd-app.css`.
- Material 3, „Color roles“ (`error-container`, `on-error-container`): https://m3.material.io/styles/color/roles (Abruf 2026-11-10) — nur als Rollenname, nicht als Farbquelle.
