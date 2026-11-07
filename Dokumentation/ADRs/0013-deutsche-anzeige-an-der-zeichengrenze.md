# ADR-0013: Deutsche Anzeige an der Zeichengrenze — Daten bleiben ISO und englische Schlüssel, ein reines Modul formt Datum und Feldnamen, eine Probe über alle Ansichten

**Status**: Akzeptiert
**Datum**: 2026-11-06
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #11 „Sichtbare Feldbeschriftungen und Datumsangaben eindeutschen“; Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: — (getragen von der Systemantwort: ADR-0009 Regel 6 formt Geldwerte erst beim Anzeigen in einem reinen Modul; `vollDatum`/`deDatum` zeigen in Diagrammen und Terminen schon `TT.MM.JJJJ`, R00073)
**Nachträge**: 2026-11-07 — Schlüssel unter der Beschriftung statt daneben (Karte #11, R00109, product-owner `AI-Team/po-entscheidungen.md:156`), siehe [Nachtrag N1](#nachtrag-2026-11-07-schlüssel-unter-der-beschriftung-r00109). Der Text oberhalb des Nachtrags ist der Stand der Annahme und bleibt unverändert; Marken *(→ N1)* zeigen, wo der Nachtrag gilt.

## Kontext

Die Leitplanke „Eine festgelegte Kultur“ (`Anforderungen/R00000-vision.md:164–165`) verlangt: Die Oberfläche ist deutsch, Datumsangaben stehen im deutschen Format, Tage und Zeiten gelten in Ortszeit. Die Karte #11 (UX-Durchsicht 2026-10-31, Schweregrad Muss) findet englische Feldnamen und ISO-Daten auf Karte und im Aufgabenfenster. Am Code (kanbanD `d056623`) ist das breiter und uneinheitlich:

- **Fünf Datumsformer, drei Ergebnisse.** `deTag` (`web/ansicht.js:617`, Text → `28.10.2026`), `vollDatum` (`web/berichte.js:453`, ms → `28.10.2026`), `deDatum` (`web/ansicht.js:1021`, ms → `Mi 28.10.2026`), dazu `isoD` zweimal (`web/ansicht.js:370`, `web/berichte.js:353`) und `ortszeit` (`web/zeiten.js:11`), die beide ISO liefern und trotzdem zur Anzeige benutzt werden.
- **ISO sichtbar** an rund 15 Stellen: Karte (`web/ansicht.js:492`), Schnellvorschau (`:164`), Archivleiste (`:255`), Durchläufe (`:282`, `10-28 14:05`), Kommentare (`:295`), Zeiten (`:312`), Reservierungen (`:572`), Personen (`:761`), Stundenzettel (`:820`), Tabellenansichten von Burndown (`:874`), Wie lange noch (`:1104`) und Fever-Chart (`:1214`).
- **Englische Feldnamen** im Aufgabenfenster (`:262–270`: `column`, `class`, `origins`, `assignees`, `labels`, `due`; dazu `wbs-effects` `:407`, `phases` `:414`, `reservation` `:566`) und im Fenster „Neue Aufgabe“ (`:180–186`). Die `aria-label` sind schon deutsch; sichtbarer Text und Name passen nicht zusammen (WCAG 2.5.3).
- **„thin air“** ist ein Wert der Datei (`src/modell/aufgabe.rs:480` `OHNE_HERKUNFT`), der Filtersprache (`web/filter.js:52`) und der CSV-Ausleitung (`src/berichte.rs:48`); sichtbar wird er im Chip (`web/ansicht.js:385`, `:453`) und im Hinweis des Eingabefelds (`:264`).
- **Vorbild im Haus:** „Einrichten“ zeigt schon deutsche Überschrift plus Schlüssel klein in Mono (`PERSONEN <span class="mono">people:</span>`, `web/ansicht.js:1307`) — genau der Vorschlag der Karte.

Die API, die Dateien und die Ausleitung behalten ISO-Daten und englische Schlüssel (Karte; Leitplanke „Git-freundliche Form“; die Factory und Agenten lesen sie maschinell).

## Optionen

### Option A: Ein reines Modul `web/kultur.js` formt an der Zeichengrenze; Daten und Rechnung bleiben ISO
Datumsformen (`TT.MM.JJJJ`, `TT.MM.`, `TT.MM.JJJJ HH:MM`, mit Wochentag) und die Tabelle Frontmatter-Schlüssel → deutsche Beschriftung stehen in einem Modul im Stil von `web/zeiten.js`/`web/kosten.js`, getestet mit `node --test`. Jede Ansicht ruft es beim Zeichnen; Vergleiche, Schlüssel, `data-*`, `value` von `<input type=date>` und alles an die API bleiben ISO.
- Vorteile: Eine Stelle für die Leitplanke, ein Unit-Test für jede Form; die drei vorhandenen Former fallen zusammen; Probe und Bau lesen dieselbe Schlüsseltabelle. Gleiche Linie wie ADR-0009 Regel 6.
- Nachteile: Rund 15 Aufrufstellen und drei Former werden angefasst, auch außerhalb der Karte. Schwäche: Ein neuer Ort, der `esc(a.faellig)` direkt zeichnet, umgeht das Modul still — dagegen hilft nur die Probe (Regel 5).

### Option B: Je Ansicht nachbessern (Status quo der Former)
Die sichtbaren Stellen der Karte rufen `deTag` bzw. `vollDatum`; Beschriftungen als Literale direkt im Markup.
- Vorteile: Kleinster Eingriff, nur die Stellen der Karte; keine Verschiebung bestehender Funktionen.
- Nachteile: Fünf Former bleiben, jeder mit eigener Eingabe (Text, ms, Ortszeit-Text); die nächste Ansicht erfindet den sechsten. Die Probe der Karte hat keine Liste, gegen die sie die Beschriftungen prüft. Schwäche: Die Leitplanke gilt dann nur, wo zuletzt jemand hingesehen hat — wie heute.

### Option C: `Intl.DateTimeFormat('de-DE')` bzw. `toLocaleDateString` direkt an jeder Stelle
- Vorteile: Standard des Browsers, kein eigener Formatcode, Wochentags- und Monatsnamen gratis.
- Nachteile: `new Date('2026-10-28')` liest ISO-Tage als UTC und verschiebt westlich von UTC um einen Tag; jede Stelle braucht deshalb dieselbe Umwandlung, also doch einen Helfer. Ausgabe hängt an der ICU-Version von Browser und Node (Tests gegen Zeichenketten). Schwäche: verteilt dieselbe Regel auf viele Aufrufe wie B.

### Option D: Der Server liefert Anzeigetexte mit (`faellig_anzeige: "28.10.2026"`)
- Vorteile: Eine Stelle in Rust, auch für spätere Clients.
- Nachteile: Die API bekommt abgeleitete Anzeigewerte, die ein `GET` → `PATCH` in die Datei tragen könnte (dieselbe Gefahr, die ADR-0009 Regel 6 ausschließt); Ortszeit ist die des Browsers (`web/zeiten.js:10`), nicht die des Servers. Schwäche: verletzt „die API behält ISO“ der Karte im Geist.

## Entscheidung

**Gewählt: Option A.**

1. **Grenze.** Dateien, API, Ausleitung (CSV), Filtersprache und Schnelleingabe bleiben bei ISO-Daten, englischen Schlüsseln und dem Wert `thin air`. Deutsch wird erst beim Zeichnen. Nicht sichtbare Träger (`data-*`, `value` eines `<input type=date>`, Vergleiche wie `a.faellig <= heute`) bleiben ISO.
2. **Ein Modul.** `web/kultur.js` (rein, im Browser und in Node, wie `web/zeiten.js`) enthält:
   - die Datumsformen aus einem ISO-Tag oder einem Zeitpunkt der Datei: lang `28.10.2026`, kurz `28.10.`, Zeitpunkt `28.10.2026 14:05` (über `ortszeit`), mit Wochentag `Mi 28.10.2026`; gebaut aus Zahlen ohne `Intl` und ohne `new Date(iso)`, damit Node und Browser gleich ausgeben und kein UTC-Versatz entsteht;
   - die Tabelle `FELDER`: Frontmatter-Schlüssel → sichtbare Beschriftung (`column` Spalte, `class` Klasse, `origins` Herkunft, `assignees` Zuständig, `labels` Labels, `due` Fällig, `wbs-effects`, `phases`, `reservation`, `board` …) und den Anzeigetext für `thin air` („ohne Herkunft“).
   `deTag`, `vollDatum` und `deDatum` werden zu Aufrufen dieses Moduls oder entfallen; `isoD` bleibt nur für Schlüssel und Vergleiche.
3. **Wo ISO sichtbar bleiben darf.** Nur, wo die Datei selbst gezeigt wird: Reiter „Datei“, YAML-Vorschau in „Einrichten“ und beim ersten Start, und der Schlüssel als Hilfstext in Mono. Tooltips (`title`) und zugängliche Namen sind sichtbarer Text im Sinne der Leitplanke und folgen Regel 2. Das native `<input type=date>` bleibt: Sein Wert ist nach HTML-Standard ISO, die Anzeige folgt der Browsersprache (E2E läuft mit `locale: 'de-DE'`, `e2e/playwright.config.js:9`); Eingabe deutscher Daten ohne Feld deckt `due:28.10.` der Schnelleingabe (`web/eingabe.js:24`).
4. **Beschriftung und Hilfstext getrennt.** Die Beschriftung ist das Element, das den Namen des Felds gibt (sichtbar „Spalte“, Name enthält „Spalte“); der Schlüssel `column` steht daneben in einem eigenen Element und nie im Text der Beschriftung, sonst enthielte der sichtbare Labeltext „column“ und die Probe der Karte schlüge fehl. Wie das Feld seinen Namen bekommt (`<label for>` oder `aria-label` gleich der Beschriftung), entscheidet die Anforderung. *(→ N1: „daneben“ heißt unter der Beschriftung, als zweite Zeile in eigenem Element; der Kern — eigenes Element, nie im Text der Beschriftung — gilt unverändert)*
5. **Durchsetzung (Makro, Aspekt [X00004](../Architektur/Aspekte/X00004-kultur.md)).** Eine E2E-Probe über alle Ansichten und offenen Fenster nach dem Muster von `e2e/tests/ziele.spec.js` (ADR-0012): kein sichtbarer Textknoten und kein `title` passt auf `/\d{4}-\d{2}-\d{2}/`, ausgenommen Regel 3; je Feld in Aufgabenfenster und „Neue Aufgabe“ enthält der zugängliche Name die Beschriftung aus `FELDER`, und keine Beschriftung ist ein Schlüssel. Dazu ein Unit-Test für `web/kultur.js`. Eine Ausnahmeliste der Probe ist erlaubt, je Eintrag mit Karte, und schrumpft nur.

Was überwiegt: Die Leitplanke ist eine Regel über die ganze Oberfläche; sie lässt sich nur an einer Stelle formen und nur über alle Ansichten prüfen. Bewusst in Kauf genommen: Die Karte wird breiter als ihr Text (Fundstellen außerhalb von Karte und Fenster), und das native Datumsfeld zeigt bei einem Browser in anderer Sprache dessen Format — kanbanD erzwingt die Kultur dort nicht.

## Konsequenzen

**Positiv:**
- Ein Ort für Datumsform und Feldnamen; die Probe der Karte wird aus derselben Tabelle gespeist, die der Bau benutzt.
- API, Dateien, CSV und Filtersprache ändern sich nicht; kein Agent und kein Test an der API ist betroffen.
- Die drei vorhandenen deutschen Former und ihre Tests (R00073) bleiben als Verhalten erhalten.

**Negativ / Inkauf zu nehmen:**
- E2E-Tests, die heute ISO-Text oder englische Beschriftungen auf der Oberfläche erwarten, müssen mitgeändert werden.
- Der Filter `origin:"thin air"` heißt weiter so, während der Chip „ohne Herkunft“ zeigt; zwei Wörter für einen Wert, eines für Menschen, eines für die Sprache der Filter.
- Kurzform `28.10.` gegen Langform: Welche Stelle welche Form zeigt, ist eine Gestaltungsregel und nicht hier entschieden.

**Folgeentscheidungen / Aufgaben:**
- [ ] Umfang an den planer: Karte und Fenster allein oder alle Fundstellen aus dem Kontext (Empfehlung: alle, weil Regel 2 sie ohnehin berührt und die Probe sonst mit langer Ausnahmeliste startet).
- [ ] Regel Kurz- gegen Langform an den product-owner (Vorschlag: Karte und Tabellen mit Jahr im Kopf `28.10.`, sonst und in Name und Tooltip `28.10.2026`; Diagramme bleiben nach R00073 mit Jahr).
- [ ] Ob das Eingabefeld der Herkunft „ohne Herkunft“ als Eingabe annimmt (heute nur `thin air`, `web/app.js:1150`), entscheidet die Anforderung.

## Nachtrag 2026-11-07: Schlüssel unter der Beschriftung (R00109)

**Anlass**: Bei der Freigabe der Artboards „Beschriftung mit Schlüssel“ hat der product-owner die Lage des Schlüssels festgelegt (`AI-Team/po-entscheidungen.md:155–156`). Regel 4 sagt „steht daneben“; das war Wortlaut ohne Prüfung — keine Probe misst die Lage (PO Z. 156). Die Wahl (Option A) und der Kern von Regel 4 gelten unverändert, der Status bleibt Akzeptiert. Der Nachtrag ändert nur, wo das eigene Element des Schlüssels steht.

**Belegt (Dialog und Entwurf)**: PO Z. 155–158 (2026-11-07); Artboards D0003 und D0001, Zustand `#beschriftung-schluessel` (kanbanD `5a1c49c`, erster Start mit `requirements` in `634097c`); R00109 FA 11 nachgezogen in `171e7fe`. **Belegt (Code, Ist)**: `.felder` teilt die Zeile in Beschriftungsspalte 84 px und Wert (`web/kd-app.css:332`), die Beschriftung ist `.felder .k` (`web/kd-app.css:334`).

### N1 Regel 4: Lage des Schlüssels

**Entschieden** (product-owner, `AI-Team/po-entscheidungen.md:156`):

1. **Unter der Beschriftung.** Der Schlüssel steht als zweite Zeile unter der Beschriftung, in eigenem Element außerhalb von `.k`, nie im Element der Beschriftung. Die Beschriftungsspalte bleibt 84 px (D0003) bzw. 110 px (D0001), die Feldzeile ist mindestens 38 px hoch. Gilt für alle Feldzeilen mit Schlüssel in kanbanD.
2. **Warum nicht daneben.** Daneben bräuchte die Spalte rund 150 px; bei 320 px blieben dem Wert rund 140 px, gegen den Geist von PO Z. 98 (bei 320 px scrollt nichts quer). Material 3 Lists setzt unterstützenden Text unter die Überschrift.
3. **Nur Feldzeilen.** Die Abschnittsköpfe in „Einrichten“ bleiben beim Hausmuster `QUELLEN sources:` (Kontext Z. 17, PO Z. 155). Felder ohne Schlüssel bleiben einzeilig (PO Z. 157).

**Durchsetzung**: unverändert Regel 5 — die Probe prüft, dass der Schlüssel in eigenem Element außerhalb von `.k` steht und keine Beschriftung ein Schlüssel ist. Die Lage misst kein Test; sie steht auf den Bildschirmfotos des Abnahmezettels (PO Z. 158).

**Bezug**: Karte #11, I0098 Datumsangaben und Feldbeschriftungen deutsch, R00109 FA 11 und AK 1; Folgekarte #87 für die Felder ohne Schlüssel (`reporting`, `signals`, `key`; PO Z. 157, `AI-Team/logbuch.md:364`).
