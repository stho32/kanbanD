# ADR-0019: Vergessene Timer sind Anzeige, nicht Datenbestand — Schwelle als reine Regel, ein Neuzeichnen an der Kante, Erinnerung je Tab

**Status**: Akzeptiert
**Datum**: 2026-11-10
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #15)
**Kontext-Anforderung**: [R00114](../../Anforderungen/R00114-vergessene-timer-sichtbar-machen.md) (Karte #15 „Vergessene Timer sichtbar machen“, Label `ux`, WBS-Knoten I0103); zum Zeitpunkt der Entscheidung lag noch keine Anforderung vor, nachgetragen mit dem Nachtrag vom 2026-11-10
**Erprobt durch**: — (getragen von der Systemantwort: reine Module mit Unit-Test, der Sekundentakt als einziger Zeitgeber, der gebaute Sicherer aus ADR-0007 N1; Belege im Kontext)
**Nachträge**: 2026-11-10 — N1 Kurzform sichtbar, Vollform im Namen, Umbruch der Kopfzeile (R00114), siehe [Nachtrag N1](#nachtrag-2026-11-10-n1-kurzform-sichtbar-vollform-im-namen-umbruch-der-kopfzeile-r00114); N2 Erinnerungsschlüssel je Lauf (R00114, Bau), siehe [Nachtrag N2](#nachtrag-2026-11-10-n2-erinnerungsschlüssel-je-lauf-r00114-bau); N3 zweite Zeile in Pop und Fensterblock unter 640 px (R00114, Nacharbeit M2 / arev M1), siehe [Nachtrag N3](#nachtrag-2026-11-10-n3-zweite-zeile-in-pop-und-fensterblock-unter-640-px-r00114-nacharbeit-m2). Der Text oberhalb bleibt der Stand der Annahme; Marken *(→ N1)*, *(→ N2)* und *(→ N3)* zeigen, wo die Nachträge gelten.

## Kontext

Die Karte beschreibt einen Zustand, den die Oberfläche heute zeigt, ohne ihn zu bewerten: Drei Timer laufen seit 143 Stunden; die Karte auf dem Board zeigt den laufenden Chip `143:10:23`, die Seite Personen in derselben Lage „Woche 137:25“. Verlangt ist eine Schwelle (Vorschlag 10 h), ab der der Chip als Störung lesbar wird („läuft seit 6 Tagen“, Fläche/Schrift in einer Fehlerrolle), dazu ein Hinweis mit der Aktion „Zeit korrigieren“.

Belegt im Code (gelesen am Stand `9bc9c21`; die Zeilenverweise sind am 2026-11-10 auf den Bau `3ef1977` des Zweigs `karte/15` nachgeführt, siehe [Nachtrag N3](#nachtrag-2026-11-10-n3-zweite-zeile-in-pop-und-fensterblock-unter-640-px-r00114-nacharbeit-m2); die **Aussagen** dieses Abschnitts beschreiben den Stand der Annahme, den gebauten Stand beschreiben die Nachträge N1–N3; der Code ist noch nicht auf `main`):

- **Der laufende Timer wird an sechs Stellen gezeichnet**, fünf davon mit eigener Laufzeitrechnung: Karte `span.lauf` mit `data-since`/`data-fmt="s"` (`web/ansicht.js:558`), Fensterblock „LÄUFT GERADE“ (`:322`), Zeile der Zeittabelle samt vorhandenem Korrigieren-Knopf `data-act="zeit-edit"` (`:330`), Zeile der Seite Personen (`:861`), Pop „Läuft gerade“ (`vLaufPop`, `:158`); der Zähler im Kopf `#t-lauf` (`:153`) zählt nur. Die Laufzeitbasis ist überall `laufBeginn(a,z) = max(Datei-Minute, lokale Startsekunde)` (`:399–400`).
- **Die Datei kennt nur Minuten** (`JJJJ-MM-TT HH:MM`, `web/zeiten.js:11–17`). Die Startsekunde merkt sich der Browser in `localStorage` und wirft sie nach einem Tag weg (`web/app.js:18–24`). Der Server hält eine `Instant` nur im Speicher und nur für Timer, die über ihn gestartet wurden; sie steht nicht in der API und ist nach einem Neustart fort (`src/dienst/timer.rs:7–13`, `:21–30`).
- **Ein Zeitgeber existiert schon**: der Sekundentakt `setInterval(…, 1000)` (`web/app.js:2549–2571`). Er schreibt heute **nur Text** fort (`[data-since]`, `[data-summe-basis]`, `[data-ext]`) und löst ein Neuzeichnen nur aus, wenn er **Zustand** ändert (Ablauf von `extern`-Markierungen und des Hinweises, `:2554–2555`), dann genau einmal und hinter dem Tor `zug == null && !S.ui.neu` (`:2552`).
- **Gezeichnet wird aus dem Zustand**: `render()` ersetzt `#kopf`, `#main` und `#over` per `innerHTML` (ADR-0007); was ein Mensch gerade tippt, rettet der Sicherer aus ADR-0007 (Nachtrag N1 gebaut). Ein Live-Ereignis zeichnet nach ADR-0014 nur aus einem übernommenen Stand neu.
- **Der Hinweis (Toast) kennt heute genau eine Aktion**: `S.ui.hinweis.undo`, gezeichnet als Knopf „rückgängig“ (`web/ansicht.js:795–810`), gebunden an Strg+Z (`web/app.js:1928`) und nach ADR-0017 im obersten modalen Dialog verankert (`web/ansicht.js:771–789`).
- **Der Kartenname wird an einer Stelle gebildet**: `kartenName()` (`web/kartenname.js:14–20`), Ergebnis am `listitem` (`web/ansicht.js:560`), Aspekt [X00005](../Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md)/ADR-0018. Beim Anspringen der Karte zählt dieser Name, nicht der innere Text; ein `aria-label` an einem `span` ohne benennbare Rolle ist nach ARIA 1.2 wirkungslos (Regelwerk, nicht mit echter Hilfstechnik gemessen).
- **Hausform für Schwellen**: R00068 legt `MINDESTLAUF` als Konstante neben die Regel und prüft die Grenze (19 s/20 s) als Unit-Test (`src/dienst/timer.rs:7–13`, `:54–62`). Der Chip `span.lauf` ist heute gestaltet (`web/kd-base.css:39–41`: 18 px hoch, Mono 11 px, Fläche `--kd-agent-weak`, Schrift `--kd-agent-ink`, Punkt 6 × 6 px; `.lauf.eigen` in `--kd-accent`/`--kd-on-accent`); in `web/kd-app.css` steht keine Regel dazu. Eine Fehlerfläche braucht ein Token-Paar nach ADR-0011; die Form bleibt.
- **Die Wochensumme ist richtig, nicht falsch**: laufende Einträge zählen bis jetzt (`web/zeiten.js:25`, `:53–54`; R00021), ein seit Montag laufender Eintrag füllt also die Woche.

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
   - Der Chip der Karte ist `span.lauf.vergessen` (`vergessen` ist frei; nicht `leer`, Projektlehre 2026-11-06) und trägt sichtbar die **Kurzform** „seit 6 Tagen“ — ohne laufende Zahl und ohne `2×`-Präfix; dieselbe Entscheidung gilt für Fenster, Zeittabelle, Pop und Seite Personen, soweit die Karte sie verlangt — der Zähler im Kopf bleibt ein Zähler. *(→ N1: der erste Satz dieser ADR sagte „läuft seit 6 Tagen“ und ließ die Zahl daneben stehen; beides trägt die Karte nicht)*
   - Den Text der Dauer bildet `web/kultur.js` (ADR-0013), nicht `zeiten.js`: „seit 6 Tagen“, „seit 14 Stunden“ sind Anzeigekultur; `zeiten.js` liefert nur ms und Wahr/Falsch.
   - Der Kartenname wächst in `kartenName()` um den **vollen** Zusatz „Timer läuft seit 6 Tagen“ (X00005/ADR-0018: der Name des Listeneintrags ist die eine Stelle). Ein eigenes `aria-label` am Chip ist wirkungslos, weil der Name des `listitem` das Innere ersetzt; der Chip bleibt nicht fokussierbar.
   - Der laufende Sekundentext bleibt `[data-since]`: unter der Schwelle schreibt er die Zahl fort, über der Schwelle denselben Kurztext (`data-fmt="seit"`), beides ohne Zustandswechsel und ohne Neuzeichnen. *(→ N1)*
3. **Der Sekundentakt erkennt die Kante** — er entscheidet keinen Zustand:
   - Der Takt vergleicht je laufendem Timer „vergessen“ mit dem, was er zuletzt gesehen hat; beim Übergang falsch → wahr setzt er genau einmal ein Neuzeichnen an, im vorhandenen Tor (`zug == null && !S.ui.neu`, `web/app.js:2552`).
   - Kein Neuzeichnen je Sekunde; die Zahl beziehungsweise der Kurztext im Chip läuft weiter über `[data-since]`. Läuft bereits ein Zug oder steht „Neue Aufgabe“ offen, unterbleibt das Zeichnen und der Übergang wird beim nächsten Takt nachgeholt (kein Verlust, nur Verzug).
   - Der Übergang wahr → falsch (Timer gestoppt, gelöscht, korrigiert) entsteht durch die Aktion selbst und damit durch ihr eigenes Neuzeichnen; der Takt muss ihn nicht melden.
4. **Die Erinnerung ist Sichtzustand, kein Bestand**:
   - `S.ui` führt die Menge der bereits erinnerten Timer; der Schlüssel ist `nr|<Kennung>|<Identität des Tabs>`, wobei die Kennung des Eintrags `wer@JJJJ-MM-TTTHH:MM±HH:MM` lautet und damit Person **und Beginn** nennt (`Zeiteintrag::kennung`, R00090). Die Menge wird bei Übergang gefüllt und auf die gerade laufenden Einträge bereinigt. *(→ N1: die Identität gehört in den Schlüssel; ein knopfloser Hinweis zählt nicht als endgültig erinnert, und im verborgenen Tab entsteht keiner. → N2: der Beginn gehört hinein, sonst erinnert ein neuer Lauf nicht)*
   - Der Hinweis ist ein gewöhnlicher Eintrag `S.ui.hinweis` mit einer **benannten Aktion** neben dem vorhandenen `undo`: `{ text, aktion: { text: 'Zeit korrigieren', act: 'zeit-korrigieren', arg: '<nr>|<kennung>' }, at, dauer }`. Das Zeichnen des Toasts zeigt die Aktion als zweiten `lnk`-Knopf (ADR-0015: bricht um, bleibt in jeder Breite bedienbar; ADR-0017: Ort im obersten modalen Dialog). *(→ N1: nie zwei Aktionen — solange `undo` gesetzt ist, wartet die Erinnerung dessen Ablauf ab)*
   - **Die Ordnung, in der ein stehender Hinweis weicht** (`hinweisBleibtStehen`, `web/app.js:2518–2524`): ein Hinweis mit `undo` bleibt bis zu seinem Ablauf; ein gewöhnlicher Hinweis ohne `erinnerung` („#5 angelegt“ oder dergleichen) wird von der Erinnerung ersetzt; eine **knopflose** Erinnerung weicht einer Erinnerung **mit** Aktion, sonst bleibt sie stehen (der eigene zuerst, die fremden warten — FA 14, FA 18; M4 holt die Erinnerung nach der Identitätswahl nach). Ohne diesen Satz lebte die Hinweisdisziplin außerhalb der Entscheidung. *(→ arev 2026-11-10, S5; belegt durch `e2e/tests/r00114-vergessene-timer.spec.js:369–388`)*
   - **Strg+Z bleibt ausschließlich `undo`** (`web/app.js:1928` prüft `S.ui.hinweis.undo`). Eine Aktion wird nie per Tastenkürzel ausgelöst; sie ist kein Rückgängig und darf nicht so heißen.
   - Nichts wird in `boards/*.md`, `localStorage` oder `sessionStorage` geschrieben; ein Neuladen erinnert erneut (akzeptiert, siehe Konsequenzen).
5. **Die Aktion knüpft an den vorhandenen Editor an** — kein zweiter Editor, kein neuer Endpunkt:
   - `zeit-korrigieren` setzt `u.offen`, `u.tab = 'inhalt'`, wartet `dateiLaden()` ab, setzt **danach** `u.zeitEdit = kennung` und `u.fokus = '#z-beginn'` (der Fall `oeffnen` löscht `u.zeitEdit`, `web/app.js:580`; die Reihenfolge ist Teil der Regel).
   - Gezeichnet wird die vorhandene Bearbeitungszeile (`u.zeitEdit === z.kennung`, `web/ansicht.js:329`), gespeichert über den vorhandenen `zeit-ok`/PATCH-Weg (`web/app.js:1447–1453`). Ein Fehler (409/403) erscheint wie heute im Fensterfuß.
   - Fehlt die Person („Ich bin …“), gilt der vorhandene Weg (`ichNoetig()`), nicht ein Sonderfall. *(→ N1: die Aktion bietet nur der eigene Eintrag an; ohne gewählte Identität erscheint der Hinweis ohne Aktion und nennt den nächsten Schritt; ist der Eintrag inzwischen fort, öffnet die Aktion nur das Fenster und meldet es im Fuß)*
6. **Farbe nur als Paar** — die Fehlerfläche des Chips ist ein Token-Paar in `web/kd-tokens.css` in beiden Dunkelblöcken (Fläche + On-Farbe, ADR-0011), geprüft von der Kontrastprobe; ob das Paar nach Material 3 `error-container`/`on-error-container` heißt, entscheiden die UX-Rollen, nicht diese ADR. Kein Farbwert außerhalb der Tokens.
7. **Grenze dieser Entscheidung**: Sie sagt, *wo* der Zustand lebt und *wie* er auf den Schirm kommt. Sie sagt nicht, *wessen* Timer erinnert wird, *wie* der Satz lautet und *ob* Summen gekappt werden — das sind Anforderungs- und PO-Fragen (Offene Fragen). *(→ N1: „wessen“ ist mit PO Z. 182 entschieden, der Wortlaut sichtbar/Name mit R00114)*

### Durchsetzung (Fitness-Funktion)

- **Unit-Test der Grenze** in `e2e/einheit/zeiten.test.js`: 9:59:59 / 10:00:00 / 30 Tage; Dauer aus Datei-Minute und aus lokaler Startsekunde; Grenze als `VERGESSEN_MS`, nicht als Zahl im Test dupliziert.
- **E2E der Abnahme-Probe** nach dem Muster von `e2e/tests/ziele.spec.js`: ein Timer mit altem `beginn` (Fixture/API) zeigt `.lauf.vergessen` mit „seit 6 Tagen“ (Kurzform, ohne Zahl), der Name der Karte enthält „Timer läuft seit 6 Tagen“, und der Hinweis trägt die Aktion, die den Editor auf **diesem** Eintrag öffnet (`#z-beginn` hat den Fokus, die Zeile ist die des Eintrags). Gegenprobe: ein Timer unter der Schwelle trägt weder Klasse noch Text noch Aktion (Muster „Abnahme-Probe positiv und negativ“).
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
  - `oeffnen` löscht `u.zeitEdit` (`web/app.js:580`) — die Aktion muss ihn danach setzen, sonst öffnet sie nur das Fenster.
  - `kartenName` ist durch Unit-Test und Aria-Snapshots gedeckt (ADR-0018); der Zusatz ändert beide. Er nennt die Dauer in Worten, kein Datum, keine ISO-Form (Kulturprobe ADR-0013).
  - Der Chip `span.lauf` ist schon gestaltet (`web/kd-base.css:39–41`); die Fehlerrolle setzt nur Fläche, Schrift und Punkt neu. Ohne Token-Paar und Kontrastprobe bliebe „eigene Klasse“ unsichtbar.
  - Die Wochensumme der Seite Personen bleibt wie sie ist (`web/zeiten.js:25`, R00021): „Woche 137:25“ ist die Folge des vergessenen Timers, nicht ein Rechenfehler. Wer sie kappen will, braucht eine eigene Anforderung.

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

- **Wessen Timer?** Alle laufenden Timer erscheinen heute auf jeder Karte und auf der Seite Personen, auch fremde. Ob der Hinweis nur eigene nennt, und ob fremde Zeit überhaupt korrigiert werden darf (R00097 regelt Eigentümer nur für Zuständige, nicht für Zeiteinträge), ist eine Regel- und PO-Frage. Empfehlung: Hinweis für alle sichtbaren, Aktion für eigene; fremde bleiben bei Stopp und Korrektur wie heute. **Geschlossen** (PO Z. 182/183, 2026-11-10; R00114 FA 7, 15): Markierung für alle, Hinweis für alle, Aktion nur für den eigenen Eintrag, keine Eigentümerregel im Server.
- **Summen kappen?** Soll ein laufender Eintrag über der Schwelle in Tages-/Wochensummen nur bis zur Schwelle zählen (heute bis jetzt, R00021)? Das ist eine Budget-Entscheidung mit Folgen für Stundenzettel und Berichte — eigene Anforderung, nicht diese ADR.
- **Schwelle einstellbar?** Als Board-Einstellung berührt sie Dateiformat, API und Anzeige; dann eigene ADR, die additiv auf dieser aufbaut.
- **Für Agenten sichtbar?** Ein additives Feld in der Aufgabensicht (`seit`, `vergessen`) wäre möglich, ohne diese Entscheidung zu kippen; die Regel bliebe dieselbe, gespiegelt in Rust. Eigene Anforderung, weil sie OpenAPI und Tests nach sich zieht.

## Quellen / Bezüge

- Karte #15 „Vergessene Timer sichtbar machen“ (`ux`); Vorschlag der Karte: Schwelle 10 h, Chip in `error-container`/`on-error-container`, Hinweis mit „Zeit korrigieren“.
- [R00068](../../Anforderungen/R00068-kurze-timerlaeufe-verwerfen.md) (Schwelle als Konstante mit Grenz-Unit-Test), [R00021](../../Anforderungen/R00021-personenuebersicht.md) (laufende Einträge zählen bis jetzt), R00089 (Summe der gebuchten Zeit).
- [ADR-0002](0002-zugregeln-gemeinsam-vor-der-aktion.md) und [ADR-0005](0005-zusammengesetzte-aktionen-in-einem-commit.md) (ein Commit je Aktion), [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md) (Neuzeichnen und Sicherer, N1 gebaut), [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md) (Farbrollen als Paare), [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md) (`web/kultur.js`), [ADR-0014](0014-nur-die-neueste-antwort-wird-uebernommen.md) (Übernahme), [ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) (Hinweis und Aktionen in jeder Breite), [ADR-0017](0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) (Hinweisort, Undo, Strg+Z), [ADR-0018](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md) mit [X00005](../Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md) (Kartenname), [X00004](../Architektur/Aspekte/X00004-kultur.md) (deutsche Anzeige).
- Bausteine: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md) (primär); berührt `web/zeiten.js`, `web/kultur.js`, `web/kartenname.js`, `web/ansicht.js`, `web/app.js`, `web/kd-tokens.css`, `web/kd-app.css`.
- Material 3, „Color roles“ (`error-container`, `on-error-container`): https://m3.material.io/styles/color/roles (Abruf 2026-11-10) — nur als Rollenname, nicht als Farbquelle.

## Nachtrag 2026-11-10 N1: Kurzform sichtbar, Vollform im Namen, Umbruch der Kopfzeile (R00114)

**Status bleibt `Akzeptiert`.** Der Nachtrag ändert Regel 2 in zwei Sätzen und präzisiert die Regeln 3–5 um die Fälle, die die Detailplanung belegt hat; Regel 1, 6 und 7 bleiben in der Sache unverändert (Regel 7 trägt nur einen Verweis, Offene Frage 1 ist geschlossen). Anlass ist die Anforderung [R00114](../../Anforderungen/R00114-vergessene-timer-sichtbar-machen.md) (Commits `64dcd6d`, `c152e70`) mit der UX-Vorprüfung M1 und der PO-Entscheidung `AI-Team/po-entscheidungen.md` Z. 182–184 (`ad56896`).

### Anlass: die gemessene Breite

Gemessen in der laufenden Instanz (headless Chromium, Spalte 272 px, Karteninhalt 249 px, Karte mit Signal und eigenem Timer; UX-Vorprüfung, vom planer nachgemessen):

| Chipinhalt | Chip | verbleibender Titel | ≥ 90 px? |
|---|---|---|---|
| heute „143:10:23“ (Bestand) | 83 px | 75 px | nein |
| „läuft seit 6 Tagen“ + laufende Zahl | 216 px | 11 px, Karte wächst auf 336 px in 272 px | nein, Überlauf |
| „seit 6 Tagen“ (Kurzform) | 104 px | 54 px | nein |
| „seit 6 Tagen“, Kopfzeile bricht um | 104 px, eigene Zeile | 192/192 px (414 px: 168/196; 320 px: 212/102) | ja |

Damit trägt die Karte den vollen Satz **und** die laufende Zahl nicht: beides zusammen verdrängt den Titel und sprengt die Spalte. Die Zahl weicht dem Satz; der genaue Wert steht daneben in Zeittabelle, Fenster und Pop, und die Zeitrechnung selbst bleibt unverändert.

### Was der Nachtrag festlegt

1. **Sichtbar Kurzform, im Namen Vollform.**
   - Der Chip zeigt im vergessenen Zustand „seit 6 Tagen“ (Kurzform aus `web/kultur.js`, ohne laufende Zahl, auf der Karte ohne `2×`-Präfix).
   - Der zugängliche Name des Listeneintrags trägt weiter voll „Timer läuft seit 6 Tagen“, gestellt vor „ausgewählt“; fehlende Teile fallen samt Komma weg.
   - Kein laufender Sekundentext im vergessenen Chip: der Takt schreibt dort denselben Kurztext fort (`[data-since]` mit `data-fmt="seit"`), sodass der Tageswechsel „seit 6 Tagen“ → „seit 7 Tagen“ ohne Neuzeichnen und ohne Zustandswechsel erscheint. Der Kern von Regel 3 bleibt: ein Zeitgeber, ein Neuzeichnen je Übergang.
2. **Umbruch der Kopfzeile als Rückfall, nur an der vergessenen Karte.**
   - Reicht der Platz für einen Titel von 90 px nicht, bricht die Kopfzeile der Karte um: der Chip steht in einer eigenen Zeile unter dem Titel. Umgesetzt an der Karte selbst — `.ka.vergessen .r0 { flex-wrap: wrap }` und `.ka.vergessen .r0 .t { min-width: 90px }` (`web/kd-app.css`) —, nicht an `.lauf`, damit die Form des Chips unverändert bleibt.
   - Bedingung: Der Umbruch greift **nur** an Karten mit vergessenem Timer und nur, wenn die Kopfzeile den Titel sonst unter 90 px drückte; eine Karte ohne Signal und ohne Stopp-Knopf bleibt in einer Zeile.
   - Der Titel bleibt vollständig lesbar, der Chip liegt ganz im Kartenrechteck, die Karte bleibt im Rechteck ihrer Spalte; bei 320, 414 und 1280 px kein Querscrollen, mit einem und mit zwei laufenden Timern.
3. **Grenze.**
   - Lageänderungen sind genau **zwei** *(→ N3: der Bau hat eine zweite hinzugefügt; hier stand „die einzige“)*: (1) die neue Zeile in der Kopfzeile der **vergessenen Karte** (dieser Nachtrag), (2) die neue Zeile in **Pop „Läuft gerade“ und Fensterblock** unter 640 px (Nachtrag N3, Nacharbeit M2 der Karte #15). Beide sind Umbruch-Rückfälle, keine neuen Formen. Der Chip behält Form und Maße (Höhe, Polster, Schrift, Punkt); die Farbe bleibt ein Token-Paar nach ADR-0011 (Regel 6), die Tokennamen deutsch, die M3-Rolle als Kommentar dabei (R00114 FA 8).
   - Kein Artboard: Die Freigabe der Gestaltung läuft über Bildschirmfotos auf dem Abnahmezettel (1280/414/320 px, hell und dunkel; Board mit einem und zwei Timern, Aufgabenfenster, Pop, Hinweis, Personen-Seite), nicht über eine Zeichnung (PO Z. 184).
   - **Offen und vorzulegen** *(→ N3: für den Umbruch unter 640 px ist die Frage mit der Entscheidung des Directors geschlossen; offen bleibt allein diese Kopfzeile)*: Der Umbruch verschiebt den Chip in dieser Zeile — also eine *Lage*-Änderung, die PO Z. 184 Satz 1 („Form und Lage bleiben unverändert“) nicht vorsieht, während Satz 3 derselben Zeile verlangt, dass die UX-Vorprüfung so etwas vorlegt. Der planer folgt dem Muss-Kriterium M1, das den Umbruch ausdrücklich als Rückfall nennt, und bittet um Gegenlesen. Bleibt es bei „keine neue Lage“, fällt die 90-px-Grenze und mit ihr M1; dann ist der Weg eine neue ADR, die diese ablöst — nicht eine stille Änderung hier.
   - **Risiko und Früh-Indikator:** Der Umbruch greift auf einer Karte, die gar nicht vergessen ist (Indikator: `.ka` ohne `.vergessen` mit zweizeiliger Kopfzeile), oder die Karte wächst über ihre Spalte (Indikator: `ka.right > flaeche.right` bei 320 px). Beides fängt die E2E-Probe aus R00114 AK 12; die Breitenproben aus ADR-0015 und ADR-0012 laufen mit.


## Nachtrag 2026-11-10 N2: Erinnerungsschlüssel je Lauf (R00114, Bau)

**Status bleibt `Akzeptiert`.** Der Nachtrag ändert einen Satz der Regel 4 und trägt damit die begründete Abweichung des Baus beim Erinnerungsschlüssel nach (Zweig `karte/15`, 22 Commits, Gate 558/0 · 317/0 · 942/0). Er ist eine Verfeinerung, keine Ablösung: „einmal je Tab und Timer“ bleibt der Satz, nur heißt „Timer“ von jetzt an **Lauf**.

### Was der Bau zeigt (belegt)

- Der Schlüssel steht in `web/app.js` neben `erinnerungPruefen`/`erinnerungZeigen`:

  ```js
  const erinnerungsSchluessel = (a, z) => `${a.nummer}|${z.kennung}|${S.ich || ''}`;
  ```
- Die `kennung` eines Eintrags ist `wer@JJJJ-MM-TTTHH:MM±HH:MM` (`Zeiteintrag::kennung`, `src/modell/aufgabe.rs:55–58`, R00090) — Person **und Beginn**. Der Schlüssel ist damit genau `nr|wer@beginn|<Identität>`.
- Die Bereinigung läuft im Sekundentakt gegen die gerade laufenden Einträge (`web/app.js`, `taktVergessen`: `const erinnert = new Set(alleLaufenden().map(erinnerungsSchluessel)); … if (!erinnert.has(schluessel)) S.ui.erinnert.delete(schluessel)`).
- Probe: `e2e/tests/r00114-vergessene-timer.spec.js:286–292` — Stopp und Neustart derselben Person auf derselben Aufgabe, Uhr um zehn Stunden vorgestellt, Erwartung „der neue Lauf erinnert wieder“. Gegen den alten Schlüssel fällt sie (Mutante, festgehalten in `Dokumentation/Gelerntes.md`, Zeile 2026-11-10 R00114: „Probe US-9 ‚gestoppt und neuer Lauf' rot gegen den alten Schlüssel“). Die Identität im Schlüssel deckt `US-5` (Identitätswahl holt die Erinnerung mit Aktion nach).

### Warum der Beginn hineinmuss

Die Bereinigung sieht nur, was **jetzt** läuft. Liegen Stopp und Neustart zwischen zwei Takten, war der alte Lauf nie einen Takt lang „verschwunden“ — der Schlüssel `nr|wer|Identität` steht weiter in der Menge, und der neue Lauf gälte als bereits erinnert. Das ist keine Lücke der Bereinigung, sondern eine Grenze jeder Bereinigungsregel: **zwei Läufe derselben Person auf derselben Aufgabe sind mit einem Schlüssel aus Person und Aufgabe nicht unterscheidbar**, gleichgültig wann aufgeräumt wird. Die Lauf-Identität muss deshalb im Schlüssel stehen, und sie steht schon im Modell: die Kennung nennt Person und Beginn. Kein neuer Zustand, keine zweite Quelle.

### Entscheidung

**Der Schlüssel bleibt `nr|wer@beginn|<Identität des Tabs>`.** Bewusst in Kauf genommen: „einmal je Tab und Timer“ heißt jetzt „einmal je Tab, Identität und Lauf“ — ein neu gestarteter Timer ist ein neuer Timer und darf wieder erinnern; das ist die ehrliche Lesart von R00114 FA 18 und deckt den Fall, den die Karte ausgelöst hat (ein Timer, der tagelang läuft, dann gestoppt und neu gestartet wird, soll nicht still bleiben). Verworfen: am alten Schlüssel festhalten und beim Stopp aufräumen (erreicht den Fall nicht, s. o.) und ein zweites Merkmal „Lauf gesehen“ neben der Menge (dieselbe Information, doppelt gehalten).

### Was bleibt, was entfällt

- **Bleibt:** die Bereinigung auf die gerade laufenden Einträge. Sie hält die Menge klein und ist weiterhin richtig — sie trägt nur nicht mehr die Richtigkeit der Erinnerung; das leistet der Schlüssel.
- **Bleibt:** der Mengensatz für die Kante (`S.ui.vergessen`, Schlüssel `nr|wer`) getrennt vom Erinnerungsschlüssel. Er entscheidet nur, ob ein Neuzeichnen angesetzt wird; ein dort verpasster Stopp-und-Neustart kostet höchstens dieses Zeichnen, und die Erinnerung zieht es mit (`erinnerungPruefen` setzt `neu`).
- **Bleibt:** nichts wird gespeichert. Ein Neuladen leert die Menge und erinnert denselben Lauf erneut (Regel 4, Konsequenzen). Der knopflose Hinweis merkt sich den Schlüssel mit leerer Identität; die Wahl der Identität ändert den Schlüssel und holt die Erinnerung mit Aktion nach (N1) — dafür braucht es kein zweites Merkmal.
- **Grenze:** Der Beginn in der Kennung ist minutengenau. Ein Stopp und Neustart **innerhalb derselben Minute** ergibt denselben Lauf-Schlüssel; der neue Lauf erinnert dann nicht erneut. Hingenommen: er braucht ohnehin zehn Stunden bis zur Schwelle, ein Neuladen erinnert wieder, und die Adressierbarkeit zweier Einträge derselben Minute ist eine Eigenschaft der Kennung (R00090), nicht dieser Entscheidung.

### Prüfung

Die Erinnerung ist an drei Stellen geprüft: US-5 (Identität), US-9 „genau ein Hinweis je Übergang“ samt Stopp-und-Neustart und US-9 „im verborgenen Tab kein Hinweis, ein frischer Tab erinnert erneut“ (`e2e/tests/r00114-vergessene-timer.spec.js`). Wer den Schlüssel wieder auf `nr|wer` verkürzt, macht die Stopp-und-Neustart-Stelle rot; wer die Identität herausnimmt, US-5.

## Nachtrag 2026-11-10 N3: Zweite Zeile in Pop und Fensterblock unter 640 px (R00114, Nacharbeit M2)

**Status bleibt `Akzeptiert`.** Der Nachtrag trägt die zweite sichtbare Lageänderung nach, die der Architektur-Review der Karte #15 (arev, 2026-11-10, M1) und der M2-Fix der Nacharbeit (Commit `3fbff5d`) belegt haben. Der Director hat entschieden: **der Umbruch bleibt, und die ADR bekommt die Fundstelle.**

### Fundstelle und Wirkung

`web/kd-app.css:866–870`, innerhalb des Telefon-Blocks `@media (max-width:640px)` (ab `:844`):

```css
.pz2,.tz{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.pz2>.pk,.pz2>.id,.tz>.pk,.tz .lauf,.tz>b{flex:none}
.pz2 .t{flex:1 1 140px;min-width:0;white-space:normal;overflow:visible;text-overflow:clip}
```

Damit werden die Zeile des Fensterblocks „LÄUFT GERADE“ (`web/ansicht.js:322`, `.tz`) und die Zeile des Pop „Läuft gerade“ (`web/ansicht.js:158`, `.pz2`) schmale Flex-Zeilen mit Umbruch; Chip und Stopp-Knopf rücken in eine zweite Zeile. `.tz .lauf` und `.tz>b` sind `flex:none` — der Chip behält seine Maße, er schrumpft nicht.

### Grund (gemessen in der Nacharbeit)

Mit den 48-px-Zielen nach ADR-0012 sprengten die festen Spalten der Zeile den Telefonbetrieb: `.mod-body` 323 > 320, der Pop 326 > 310, der Stopp-Knopf ragte 11 px über den Rand (Commit `3fbff5d`). Das verletzt R00114 AK 13 und die Leitplanke „kein waagrechtes Scrollen“ (WCAG 1.4.10) — dieselbe Klasse Fehler, die ADR-0015 für die Füße und ADR-0012 für die Ziele geschlossen haben. Der Umbruch ist die Antwort: er tritt nur ein, wenn die Zeile nicht passt (`flex-wrap`), und sonst sieht niemand einen Unterschied.

### Abgrenzung

- **Nur ≤ 640 px**: die Regeln stehen im Telefon-Block; über 640 px ist die Geometrie unverändert (keine Regel außerhalb des Blocks nennt `.pz2`/`.tz`).
- **Form und Farbe unverändert**: Der Chip behält Form und Maße, das Token-Paar aus Regel 6 bleibt, es kommt kein neuer Zustand und keine neue Klasse hinzu. Der Umbruch gehört zur **Zeile**, nicht zum Chip — deshalb steht er in `kd-app.css` und nicht in `kd-base.css`.
- **Zuordnung**: ADR-0012 („Waagrechtes Scrollen bleibt verboten“, 24/48-px-Ziele) und ADR-0015 („nichts scrollt quer“, Umbruch als Antwort) — dieser Umbruch ist deren dritte Ausprägung, neben dem Fuß und der Kopfzeile der Karte aus N1.
- **N1 Punkt 3 ist richtiggestellt**: dort stand „das ist die **einzige** sichtbare Lageänderung“; es sind **zwei** — die Kopfzeile der vergessenen Karte (N1) und die Zeile von Pop und Fensterblock unter 640 px (dieser Nachtrag).

### Prüfung

Die Probe `e2e/tests/r00114-vergessene-timer.spec.js:661` („M2: Aufgabenfenster und Pop scrollen im Telefonbetrieb nicht waagrecht (AK 13)“) misst bei 320 px `scrollWidth ≤ clientWidth` an Fensterkörper, Pop und Seite und prüft, dass der Chip ganz sichtbar bleibt. Früh-Indikator, falls der Umbruch zu weit greift: eine zweizeilige Zeile bei 1280 px oder an einem Eintrag ohne vergessenen Timer — beides fängt die Breitenprobe der Karte und der Telefon-Block selbst.

### Stand der Zeilenverweise

Alle Codefundstellen dieser ADR sind auf den Bau `3ef1977` des Zweigs `karte/15` nachgeführt (Strg+Z `web/app.js:1928`, Tor `:2552`, Toast `web/ansicht.js:795–810`, Kartenchip `:558`/`:560`, Hinweisanker `:771–789`, `oeffnen`/`zeit-korrigieren`-Reihenfolge `:580`, `zeit-ok` `:1447–1453`, Takt `:2549–2571`, `laufBeginn` `:399–400`, Zeitrechnung `web/zeiten.js:11–17`/`:25`). **Der Code liegt noch nicht auf `main`** — der Merge der Karte #15 steht aus; die Aussagen des Kontext-Abschnitts beschreiben weiter den Stand der Annahme (`9bc9c21`).
