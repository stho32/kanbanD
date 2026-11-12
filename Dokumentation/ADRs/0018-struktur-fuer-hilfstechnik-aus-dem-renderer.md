# ADR-0018: Struktur für Hilfstechnik aus dem Renderer — Karte als Listeneintrag mit abgeleitetem Namen, eine h1 je Route an einer Stelle

**Status**: Akzeptiert
**Datum**: 2026-11-08
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #13 „Struktur für Hilfstechnik ergänzen“ (UX-Durchsicht mit Material 3, 2026-10-31, Sollte); Anforderung und WBS-Knoten folgen über den planer
**Erprobt durch**: Probe 2026-11-08 in headless Chromium über Playwright (`e2e/node_modules`, unter `nice -n 10`). Die Probe nutzt nachgebautes Markup, nicht die laufende Anwendung:
- Ein `div` mit `role=listitem`, `tabindex=0`, `aria-label="#22 Titel der Karte, Fehler"` und `draggable` in einem `role=list` erscheint im Baum als `listitem "#22 Titel der Karte, Fehler"`. Darunter bleiben der Text, ein `button` und ein `link` mit Rolle und Namen erhalten. `getByRole('listitem', { name: /^#22 / })` findet die Karte, und darin finden `getByRole('button')` und `getByRole('link')` die Kinder.
- Eine visuell verborgene `h1` (`clip-path:inset(50%)`) und eine verborgene `h2` mit dem Spaltennamen zählen als `heading [level=1]` bzw. `[level=2]`.
- `getByRole('button', { name: 'Zu erledigen zuklappen', expanded: true })` findet den Klapp-Knopf.
- Landmarks aus `header`/`nav`/`main`/`footer`: je genau eine Fundstelle `banner`, `navigation`, `main`, `contentinfo`.
- Gegenprobe Option B: Unter einer `option` zeigt Chromium die Kinder ebenfalls. Die Spezifikation (ARIA 1.2, „Children Presentational: True“) und Screenreader behandeln sie dagegen als Text. Dieses Screenreader-Verhalten ist nicht gemessen.

**Nachträge**: 2026-11-12 — Leiste auf zwei Ziele, die vier seltenen Ziele im Menü „…“, daraus geweitete Regel 5 (R00140/I0126, Karte #105), siehe [Nachtrag N1](#nachtrag-2026-11-12-n1-leiste-auf-zwei-ziele-vier-seltene-ziele-im-menü-geweitete-regel-5-r00140). Der Text oberhalb des Nachtrags ist der Stand der Annahme und bleibt unverändert; Marken *(→ N1)* zeigen, wo der Nachtrag gilt.

Ist im Code (gelesen, kanbanD `b17c412`):
- Die Karte ist `div.ka` mit `tabindex=0`, ohne Rolle und Namen, mit `aria-selected="true"` bei Auswahl (`web/ansicht.js:529`). Defekte und fehlende Karten liegen bei `:537` und `:640`.
- Der Spaltenname ist ein Knopf `.bk-name` „<Spalte> zuklappen“ (`:708`) bzw. `.zu-streifen` „<Spalte> aufklappen“ (`:693`), beide ohne `aria-expanded`.
- Die Navigation `nav.kz-nav` markiert die aktuelle Seite nur mit der Klasse `an` (`:76`). Unter 600 px ersetzt sie der Seitenknopf `#t-seite` mit dem Seitenmenü (`:80–103`).
- `#main` hat keine `h1`. Die Berichte beginnen mit `h3.dtitel` (`:932`, `:1070`, `:1173–1174`, `:1272`).
- Die Landmarks stehen schon: `header.kz` aus `vKopf()` (`:36–45`), `main#main` und `footer#stat` in `web/index.html:12`.

## Kontext

Die Karte nennt vier Lücken: keine Überschriften auf dem Board, Berichte ab `h3`, Karten ohne Rolle und Namen, fehlendes `aria-current` und `aria-expanded`. Gefragt ist eine Struktur, die künftige Seiten erben. Drei Eigenheiten der Oberfläche machen das zu einer Technikfrage und nicht nur zu einer Markup-Ergänzung:

1. **Die Karte ist dreifach bedienbar.** Pfeile, Ziffern und Buchstaben bewegen sie (`brettTaste`, ADR-0010). Enter oder Klick öffnet sie (`data-act="oeffnen"`). Ziehen bewegt sie (`draggable`, Drop-Rechnung `web/app.js:2329–2331`). Außerdem enthält sie eigene Bedienelemente: Signal-Knopf, Stopp-Knopf, Herkunfts-Link `a.org`, im Umbenennen ein Eingabefeld. Die Rolle muss alle vier Wege tragen. Mit Kindern, die die Spezifikation als bloßen Text darstellt, ginge das nicht.
2. **Alles wird neu gezeichnet.** `render()` ersetzt `#kopf`, `#main` und `#over` per `innerHTML` (ADR-0007). Ein Name, der an einem Knoten gepflegt würde, überlebt das nicht. Ein Live-Ereignis zeichnet nach ADR-0014 nur aus einem übernommenen Stand neu.
3. **Seiten entstehen fortlaufend** (Kosten, WBS, Berichte). Eine Regel, die jede Sicht selbst einhalten muss, wird bei der nächsten Sicht vergessen. ADR-0012 und ADR-0013 haben dafür das Muster „eine Stelle plus Probe über alle Ansichten“ gesetzt.

### Qualitätsziele und Szenarien

- **Bedienbarkeit mit Hilfstechnik** (Vision Z. 104: „per Tastatur bedienbar und folgt gewohnten Konventionen“):
  - Wer mit einem Screenreader auf eine Route kommt, findet mit der Überschriftennavigation genau eine `h1`. Auf dem Board ist jede Spalte als `h2` erreichbar.
  - Fokus auf einer Karte liest zuerst `#<nr> <Titel>`, dann die Klasse.
  - Maß: die Abnahme-Probe der Karte auf allen Routen ohne Ausnahme.
- **Aktualität:** Nach einem Live-Ereignis stimmen Name und sichtbarer Text der Karte überein, im selben `render()`. Das Lastprofil verlangt < 1 s für die Live-Änderung, und es entsteht kein zweiter Zeitpunkt.
- **Änderbarkeit:** Eine neue Sicht erbt `h1`, Landmarks und `aria-current`, ohne selbst Code dafür zu haben. Weicht sie ab, schlägt die Probe fehl.
- **Rückwärtsverträglichkeit:**
  - Bestehende E2E-Selektoren nach Rolle und Name brechen nicht unbemerkt. Jede Änderung eines Namens oder einer Rolle steht hier als Fallstrick.
  - Die Tastatursteuerung von ADR-0010 bleibt unverändert.

## Optionen

Entscheidung 1 betrifft die Rolle der Karte. Die Entscheidungen 2 (Name) und 3 (Überschriften-Regel) folgen danach mit je eigenen Varianten.

### Option A: Karte als `listitem`, Spaltenfläche als `list` (gewählt)

- `.flaeche` wird `role="list"`, jede `.ka` wird `role="listitem"` mit `aria-label`.
- Pro:
  - Die Kinder behalten ihre Rollen. Signal-Knopf, Stopp-Knopf, Herkunfts-Link und Umbenennen-Feld bleiben echte Bedienelemente (Probe).
  - Screenreader sagen „Liste, 5 Einträge“ und damit die Kartenzahl je Spalte an.
  - Tastatur, Klick und Ziehen bleiben unberührt, denn keine Rolle ändert, wie der Browser Tasten oder Drag-Ereignisse zustellt.
- Contra:
  - `listitem` ist keine Widget-Rolle. Im Lesemodus von NVDA/JAWS bleibt der Screenreader auf einer fokussierten Karte im Lesemodus und fängt Pfeile und Einzelbuchstaben selbst ab. Die Karten-Kürzel wirken erst im Fokusmodus (NVDA+Leertaste). Wege ohne Fokusmodus: Enter löst den Klick aus und öffnet die Karte, Menütaste bzw. Umschalt+F10 öffnet das Kartenmenü mit „Verschieben nach“ (`web/menue.js`). Das Menü hat `role=menu` und schaltet selbst in den Fokusmodus. Gemessen ist das nicht.
  - `aria-selected` ist an `listitem` nicht erlaubt. Die Auswahl muss anders hörbar werden (Regel 3).

### Option B: Spalte als `listbox` (`aria-multiselectable`), Karte als `option`

- Pro:
  - Widget-Rolle: Screenreader schalten beim Fokus selbst in den Fokusmodus, Pfeile und Kürzel kommen an.
  - `aria-selected` ist dort erlaubt und passt zur Mehrfachauswahl (R00065).
- Contra:
  - `option` hat „Children Presentational“. Signal-Knopf, Stopp-Knopf, Herkunfts-Link und Umbenennen-Feld wären für Hilfstechnik bloßer Text, aber weiter per Tab erreichbar: ein fokussierbares Element ohne Rolle (axe `nested-interactive`).
  - Man müsste diese Bedienelemente aus der Karte nehmen und ins Menü verlegen. Das ändert R00076 (Signal per Klick zurücknehmen) und R00018 (Herkunfts-Link).
  - `listbox` ist eindimensional, der Sprung ← → in die Nachbarspalte verlässt das Widget.
- Verworfen: Der Preis ist ein Verhaltensumbau an zwei gebauten Anforderungen für einen Vorteil, den Option A über das Kartenmenü teilweise einholt.

### Option C: Karte als `button` (bzw. Titel als Link `article > a`)

- Pro: „Karte öffnen“ ist die erste Aktion. Ein Knopf ist die vertrauteste Rolle und schaltet in den Fokusmodus.
- Contra:
  - Auch `button` hat „Children Presentational“ und damit dieselbe Schachtelungsfrage wie B.
  - Ein Knopf, der mit Pfeilen bewegt und gezogen wird, widerspricht der Konvention.
  - Die Variante `article` mit innerem Link löst das Fokusziel nicht: die Tastatur hängt an der `.ka`, nicht am Link (ADR-0010, `fokusKarte`).
- Verworfen.

### Option D: Board als `grid`, Karte als `gridcell`

- Pro:
  - Zweidimensionale Pfeilnavigation ist die eingebaute Bedeutung.
  - Widget-Rolle, und Bedienelemente in Zellen sind erlaubt.
- Contra:
  - Ein `grid` braucht Zeilen (`row`). Ein Board ist spaltenweise, und eine „Zeile 3“ quer über Spalten mit ungleich vielen Karten bedeutet fachlich nichts.
  - Spaltenköpfe, zugeklappte Spalten und Drop-Flächen müssten als leere Zellen nachgebildet werden.
  - Das ist der größte Umbau an Markup und Sichtzustand (ADR-0007 sichert nach Selektoren).
- Verworfen: zu teuer für eine falsche Bedeutung.

### Entscheidung 2: Woher kommt der Name?

- **2a (gewählt)**: Der Renderer leitet den Namen beim Zeichnen ab, als Zeichenkette aus demselben `a`, aus dem die Karte entsteht. Ein Name kann nie veralten, weil es keinen zweiten Schreibweg gibt. Schwäche: Der Text existiert zweimal, als sichtbarer Inhalt und als `aria-label`. Das deckt die Probe ab.
- **2b**: `aria-labelledby` auf die sichtbaren Teile `.id` und `.t`, damit der Name automatisch gleich dem Sichtbaren ist. Verworfen:
  - Je Karte wären eindeutige `id`s nötig, die die Mehrfachauswahl und den Sicherer (ADR-0007, Schlüssel `id` vor `data-act`) berühren.
  - Die Klasse ist nur Farbe (`data-c`) und bräuchte ein verstecktes Element.
  - Im Umbenennen ersetzt ein Eingabefeld `.t`, und der Name folgte dann jedem Tastendruck.
- **2c**: einen Namen beim Live-Ereignis gezielt nachführen (Knoten suchen, `setAttribute`). Verworfen: Das wäre ein zweiter Schreibweg neben `render()`, der ADR-0007 und ADR-0014 unterläuft und bei jedem neuen Ereignis vergessen wird.

### Entscheidung 3: Wo entsteht die Struktur je Route?

- **3a (gewählt)**:
  - Eine Stelle für alle Sichten: `vHaupt()` (`web/app.js:136`) ist der einzige Verteiler aller Sichten in `#main`. Davor setzt sie eine visuell verborgene `h1` aus dem Seitennamen.
  - `aria-current` entsteht dort, wo heute die Klasse `an` gesetzt wird, mit derselben Bedingung.
  - Die Landmarks bleiben im Rahmen `web/index.html` und `vKopf()`.
- **3b**: Jede Sicht schreibt ihre `h1` selbst. Verworfen, weil die nächste Sicht sie vergisst und nur die Probe sie fängt.
- **3c**: eine feste `h1` in `web/index.html` außerhalb von `#main`, deren Text `render()` setzt. Verworfen: Das wäre ein zweiter Schreibweg neben dem `innerHTML`-Modell. Weil die `h1` nicht live angesagt wird, bringt ein stabiler Knoten keinen Vorteil.

## Entscheidung

**Option A mit 2a und 3a.** Die Struktur entsteht im Renderer an genau den Stellen, an denen heute Sichten, Karten und Navigation gezeichnet werden. Sie hängt an keinem eigenen Zustand und an keinem eigenen Schreibweg. Die Durchsetzung ist eine Probe über alle Routen nach dem Muster von ADR-0012 und ADR-0013. Die Regel ist systemweit und wird Aspekt [X00005 Struktur für Hilfstechnik](../Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md).

### Regeln

1. **Landmarks**:
   - Je Route genau einmal `banner` (`header.kz` aus `vKopf()`), `main` (`#main`) und `contentinfo` (`footer#stat`).
   - Höchstens eine `navigation`: `nav.kz-nav`. Unter 600 px, im Einrichtungsmodus und im ersten Start gibt es keine.
   - Fenster, Menüs, Pop und Hinweis liegen in `#over` außerhalb der Landmarks und tragen ihre eigene Rolle (`dialog`, `menu`, `status`).
   - Keine Sicht setzt ein weiteres `header`, `nav`, `main` oder `footer` und kein `role=region` ohne Anlass.
2. **Überschriften in `#main`**:
   - Genau eine `h1` je Route. Sie entsteht nur in `vHaupt()` vor der Sicht, visuell verborgen (`.vh`), und beginnt mit dem Seitennamen aus `seitenName()` (`web/ansicht.js:85`), z. B. „Board · <Boardtitel>“, „Berichte · <Bericht>“, „Einrichten“. Die Sichten selbst schreiben nie eine `h1`.
   - Die Abschnitte einer Route sind `h2`:
     - Board: je Spalte eine `h2` mit dem reinen Spaltennamen, als erstes Kind der `section.bahn`, visuell verborgen, offen wie zugeklappt.
     - Berichte: die heutigen `h3.dtitel` werden `h2.dtitel`.
     - WBS, erster Start und defektes Board haben ihre `h2` schon.
   - Darunter folgt `h3`. Innerhalb von `#main` werden keine Ebenen übersprungen.
   - Die Gestaltung hängt an der Klasse, nicht am Tag. Wer einen Tag ändert, zieht die Regel auf die Klasse (siehe Konsequenzen).
   - Markdown in `#main` erzeugt nie eine `h1` (`markdownHtml(md, stufe ≥ 1)`, Standard 2).
3. **Karte**:
   - `.flaeche` trägt `role="list"`. Ihre Kinder sind Listeneinträge: jede `.ka` (auch `.defekt` und `.fehlt`) `role="listitem"`, dazu `.leer` und `.nach` ebenfalls `role="listitem"`. Es gibt keine neue Hülle, damit Drop-Rechnung, CSS und Sicherer unverändert bleiben.
   - Jede `.ka` trägt `aria-label` aus einer reinen Funktion `kartenName(…)`:
     - Karte: `#<nr> <Titel>`, mit Klasse `, <Bezeichnung der Klasse>` (aus `kanbanD.md`, nie der Schlüssel, ADR-0013), bei Auswahl am Ende `, ausgewählt`.
     - Defekte Datei: `#<nr> Datei defekt, nur lesbar`.
     - Fehlende Aufgabe: `#<nr> Aufgabe fehlt`.
   - Der Name nennt weder Datum noch Zeit, weil die Kultur-Probe ISO und Kurzformen im Namen ablehnt. Datum, Signale und Zuständige liest der Inhalt.
   - `aria-selected` entfällt an der Karte, weil das Attribut an `listitem` nicht erlaubt ist. Die Auswahl bleibt als Klasse `.gewaehlt` und steht im Namen.
   - Tastatur (`brettTaste`), Öffnen (`data-act="oeffnen"`), Ziehen (`draggable`) und Fokusführung (`fokusKarte`, `.ka[data-id]`) bleiben unverändert.
4. **Name aus dem Renderer**:
   - `kartenName` wird in `vKarte`, `vDefekt` und `vFehlt` beim Zeichnen gerufen. Er liest nur `a` und `S.ui.auswahl`, also dasselbe, was die Karte sichtbar macht.
   - Es gibt keinen Name-Zustand, keinen Nachführer und kein `aria-live` an der Karte.
   - Ein Live-Ereignis erneuert den Namen über `laden()` → `uebernehmen()` → `render()` (ADR-0014). Ein verworfenes Laden zeichnet nicht und ändert daher auch den Namen nicht.
   - `kartenName` liegt in einem Modul, das im Browser und in Node lädt (Muster `web/uebernahme.js`), damit ein Unit-Test es ohne Browser prüft.
5. **Aktuelle Seite**:
   - Genau ein `nav a[aria-current="page"]`, gesetzt unter derselben Bedingung wie die Klasse `an` in `vNavigation()`. *(→ N1: höchstens ein `aria-current` in der Kopfzeile — der Eintrag der aktiven Seite in der Leiste oder im offenen Menü „…“)*
   - Auf einer Berichtsroute trägt es der Auslöser `a#t-ber`, auf der WBS der Link des aktiven Kürzels. *(→ N1: die WBS liegt jetzt als Menüeintrag im Menü „…“)*
   - Im Seitenmenü unter 600 px trägt der Eintrag mit `an` ebenfalls `aria-current="page"`. Der Seitenknopf nennt die Seite schon („Seite: …“). *(→ N1)*
6. **Klapp-Knopf**:
   - `.bk-name` trägt `aria-expanded="true"`, `.zu-streifen` trägt `aria-expanded="false"`, beide statisch im Markup. Der Zustand steht im Renderer (`spaltenZu()`), nicht in `ausloeserMarkieren()`, das nur Pop-Auslöser führt.
   - Die Namen „<Spalte> zuklappen“ und „<Spalte> aufklappen“ bleiben.
   - Die WBS-Knöpfe `button.klapp` haben das Attribut schon.

### Durchsetzung (Fitness-Funktion)

- **E2E-Probe über alle Routen**, nach dem Muster von `e2e/tests/ziele.spec.js` (Liste `ANSICHTEN`) bzw. `e2e/tests/kultur-hilfen.js`:
  - auf jeder Route genau eine `h1`;
  - auf dem Board je `section.bahn` genau eine `h2` mit dem Spaltennamen, offen und zugeklappt;
  - jede `.ka` mit Rolle `listitem` und einem Namen, der mit `#<nr>` beginnt;
  - bei ≥ 600 px genau ein `nav a[aria-current=page]`, unter 600 px keine `nav` und der Seitenknopf mit dem Seitennamen; *(→ N1: höchstens ein `aria-current` in der Kopfzeile — der Eintrag der aktiven Seite in der Leiste oder im offenen Menü „…“)*
  - Klapp-Knopf mit `aria-expanded` passend zu `spaltenZu()`;
  - je Landmark höchstens eine Fundstelle.
  - Nach der Lehre „Abnahme-Probe positiv und negativ“: Die Probe läuft einmal gegen eine Mutante (z. B. eine zweite `h1` in einer Sicht, eine Karte ohne Namen) und muss dort rot werden.
  - Die Liste der Routen gleicht die Probe gegen die Verzweigungen von `vHaupt()` ab, damit eine neue Sicht nicht ungeprüft durchrutscht. Vorbild ist der Vollständigkeitsabgleich `FENSTER_IM_MARKUP` in `e2e/tests/r00111-schmal-wie-breit.spec.js`.
- **Unit-Test** `kartenName` in `e2e/einheit/`: mit und ohne Klasse, Auswahl, defekt, fehlt, Titel mit Sonderzeichen. Unbekannter Klassenschlüssel: kein Zusatz, nie der rohe Schlüssel.
- **Live-Fall**: Ein Titel, der über die API geändert wird, erscheint nach `kdTest.gezeichnet()` im Namen der Karte, und zwar ohne Neuladen.

## Konsequenzen

- **Positiv:**
  - Die Struktur hat keinen eigenen Zustand und kann deshalb nicht veralten.
  - Eine neue Sicht bekommt `h1`, Landmarks und `aria-current` geschenkt. Eine Abweichung fängt die Probe.
  - Die Kartenzahl je Spalte wird hörbar.
- **Akzeptierte Schwächen:**
  - Im Lesemodus eines Screenreaders wirken die Einbuchstaben-Kürzel und Pfeile auf der Karte erst nach dem Wechsel in den Fokusmodus. Der Weg ohne Wechsel ist Enter (öffnen) und das Kartenmenü (verschieben).
  - Kartentitel und Name stehen doppelt im Markup.
  - Die Auswahl wird über den Namen statt über einen ARIA-Zustand angesagt.
- **Fallstricke für den Bau:**
  - **E2E, der bricht:** `e2e/tests/r00065-mehrfachauswahl.spec.js:35` prüft `aria-selected="true"` an der Karte. Die Prüfung wird auf `.gewaehlt` und den Namenssuffix `, ausgewählt` umgestellt. Sonst bricht nach heutigem Stand kein Selektor:
    - `getByRole('heading' | 'listitem' | 'list' | 'navigation')` kommt in `e2e/tests` nicht vor;
    - die Namen der Klapp-Knöpfe (`r00074-spalten-zuklappen.spec.js:23–46`, `r00054-wbs-sicht.spec.js`) bleiben;
    - `.ka`-Locators mit `hasText` und `toHaveText` lesen Text, nicht `aria-label`.
  - **Aria-Snapshots der Karte** (`e2e/tests/kultur.spec.js:132`, `:592–605`) enthalten künftig die Zeile `listitem "<Name>"` vor dem Inhalt. Die Kinder bleiben (Probe). `toContain(...)` hält, die negative Prüfung `:134` (keine Kurzform ohne Jahr) gilt jetzt auch für den Namen. Daher nennt der Name kein Datum.
  - **CSS hängt an Tags:** `.abs h3`, `.einr h3`, `.first-l h2`, `.first-r h3`, `.defektflaeche h2`, `.hilfe h3`, `.wl-phase h3` (`web/kd-app.css:310`, `:395`, `:500`, `:506`, `:590`, `:597`, `:743`). Ein Tag, der die Ebene wechselt, verliert seine Gestaltung.
    - `.dtitel` ist klassenbasiert (`:556`) und wechselt gefahrlos auf `h2`.
    - `.wl-phase h3` bleibt `h3` unter dem neuen `h2.dtitel`, deshalb hält `e2e/tests/r00058-phasen-spalten.spec.js:39`.
  - **Dialoge sind nicht Teil der Route:** Die `h3`/`h4` in Fenstern (`e2e/tests/r00110-neueste-antwort.spec.js:146` sucht `[role="dialog"] h3`) bleiben unverändert. Die Probe zählt die `h1` seitenweit; ein Fenster erzeugt keine.
  - **`.vh` braucht keinen positionierten Elternteil** zur Unsichtbarkeit (`clip-path`). In `section.bahn` darf sie aber keine Breite erzeugen. Die Breitenprobe von ADR-0015 und die Überlappungsprobe der Kopfzeile laufen mit.
  - **Kultur:** Zugängliche Namen zählen als sichtbarer Text (ADR-0013). Deshalb nennt `kartenName` die Bezeichnung der Klasse, nie ihren Schlüssel.
  - **Fokus nach Neuzeichnen:** ADR-0007 setzt den Fokus nach jedem `render()` auf den neuen Knoten. Ein Screenreader kann die fokussierte Karte dabei erneut ansagen. Das ist heute schon so und keine Folge dieser Entscheidung, wird aber mit einem Namen hörbarer (Offene Fragen).

### Pre-Mortem

- *„Die Kürzel gehen mit NVDA nicht“*: Das ist bekannt und akzeptiert (Option A, Contra). Fällt es in der Abnahme mit echter Hilfstechnik als Befund an, ist der nächste Zug eine Widget-Rolle mit Ausbau der inneren Bedienelemente (Option B) als eigene Anforderung, nicht ein Nachbessern an A.
- *„Eine neue Sicht hat zwei `h1`“*: Das fängt die Routenprobe, solange die Routenliste vollständig ist. Deshalb gehört der Abgleich gegen `vHaupt()` zur Durchsetzung.
- *„Der Name zeigt alten Titel“*: Das ist nur möglich, wenn jemand den Namen außerhalb von `vKarte` setzt. Regel 4 verbietet es, der Live-Fall prüft es.
- *„Berichte sehen anders aus“*: Das passiert, wenn ein Tag ohne Klasse gestaltet ist. Die Liste der Tag-Selektoren steht oben, die Kontrast- und Zielgrößen-Proben laufen mit.

## Offene Fragen

- Sagt ein Screenreader die fokussierte Karte bei jedem Live-Ereignis neu an, weil `render()` den Knoten ersetzt und der Fokus zurückgesetzt wird? Das ist dieselbe Klasse wie die offene Frage zu `role=alert` in ADR-0015 (kein stabiler Knoten). Sie ist nur mit echter Hilfstechnik messbar und nicht Teil von #13.
- Menüs (`role=menu`) enthielten eine `h4` als Kopf (`web/ansicht.js:103`, `:129`, `:359`). Erlaubte Kinder eines Menüs sind nur Einträge, Gruppen und Trenner. Den Namen tragen sie schon über `aria-label`. **Erledigt** mit I0125/R00136 (Karte #109, 2026-11-12): die vier Köpfe sind klassen-gestaltete Nicht-Überschrift-Elemente (`.pop-kopf`), die Gestaltung hängt an der Klasse; belegt durch `e2e/tests/r00136-menuekoepfe.spec.js`. Die Bereinigung war ein Vorschlag, nicht Teil von #13.

## Nachtrag 2026-11-12 N1: Leiste auf zwei Ziele, vier seltene Ziele im Menü, geweitete Regel 5 (R00140)

**Anlass**: Karte #105 (Betreiber, Board „entwicklung“), [R00140](../../Anforderungen/R00140-navigation-seltene-ziele-im-mehr-menue.md) (I0126). Der Architektur-Durchgang #105 vom 2026-11-11 hatte „keine Technikfrage“ ergeben; der Modell-Nachzug aus dem Architektur-Review #105 (S1/S2/O1/O2) holt die Modelle nach. Die Wahl dieser ADR — Struktur im Renderer, eine Stelle je Regel — gilt unverändert, der Status bleibt `Akzeptiert`. Geändert gegenüber dem Text oben werden die Zusammensetzung der Kopfzeile (Leiste und Menü „…“) und die Fassung von Regel 5 (der Eintrag mit `an`), beides am gebauten Code belegt. Gebaut und am 2026-11-12 auf `main` (Bau-Zweig `karte/105`, Karten-Nacharbeit „Wächter r00035 und r00010 auf das Menü „…“ ziehen“, `d0fa547`).

**Belegt (Code)**:
- `vNavigation()` (`web/ansicht.js:84–88`) trägt ab 600 px genau zwei Ziele: „Board“ (Leistenlink) und „Berichte ▾“ (`#t-ber`). Aufgaben, Personen, WBS und Einrichten stehen nicht mehr in der Leiste; der frühere WBS-Block `vWbsMenue` ist entfallen.
- `vSeitenPop()` (`:99–108`) trägt unter 600 px dieselben zwei Ziele; der Seitenknopf `#t-seite` (`:91–94`) nennt weiter die Seite („Seite: …“).
- `vMehrPop()` (`:126–147`) trägt als **erste Gruppe** die vier seltenen Ziele — Aufgaben, Personen, WBS (je gebundener Anwendung, `:133–136`) und Einrichten —, darunter genau ein `<div role="separator">` (`:146`), dann die Werkzeuge aus `kopfPlaetze(u.stufe, kopfAnsicht()).mehr` (`web/kopfzeile.js`). Jeder Eintrag entsteht in der Form von `vSeitenPop`: `<a class="iz" role="menuitem" tabindex="-1" data-act="seite">` (`:129–132`); der Trenner ist gestaltet in `web/kd-app.css:52`.
- Der Auslöser „…“ (`#t-mehr`, `kopfElemente().mehr`, `:69`) bleibt unmarkiert. Die Markierung (`an` + `aria-current="page"`) setzt derselbe Helfer `aktuelleSeite` (`:77–80`); für die vier seltenen Ziele liegt sie am Menüeintrag.
- Der Ist-Stand „Ist im Code (gelesen, kanbanD `b17c412`)“ oben beschreibt die Zeit **vor** dem Bau von #13. #13 ist gebaut und am 2026-11-10 auf `main` gemergt (`85dbc2e`, Probe `e2e/tests/r00113-struktur.spec.js`); die dortige Ist-Liste ist damit überholt, nicht falsch.

### Entschieden

1. **Die Leiste trägt zwei häufige Ziele** (Board, Berichte ▾); die vier seltenen Aufgaben, Personen, WBS und Einrichten liegen im bei jeder Breite vorhandenen Menü „…“. Der Auslöser „…“ bleibt unmarkiert.
2. **Regel 5 geweitet**: „Der Eintrag mit `an` trägt `aria-current="page"` — **höchstens ein** in der Kopfzeile, genau der Eintrag der aktiven Seite, sobald sein Menü offen ist.“ Sie umfasst die Leiste (Board, Berichte), das Seitenmenü unter 600 px und den Eintrag im Menü „…“ (Aufgaben, Personen, WBS, Einrichten), gesetzt unter derselben Bedingung wie die Klasse `an` (Helfer `aktuelleSeite`). Gewählt statt der engeren Fassung „genau ein `nav a[aria-current=page]`“, weil die aktuelle Seite bei vier der sechs Ansichten in einem Menü liegt, das erst beim Öffnen im DOM steht (NFA R00140 „höchstens ein“).
3. **Durchsetzung** (geweitete Probe): in der Kopfzeile **höchstens ein** Bedienelement mit `an` trägt `aria-current=page` — genau der Eintrag der aktiven Seite, sobald sein Menü offen ist (Leiste oder offenes Menü „…“); unter 600 px keine `nav` und der Seitenknopf mit dem Seitennamen. Geweitet in `e2e/tests/r00113-struktur.spec.js` (`aktuelleSeitePruefen`, Mutanten `OHNE_AKTUELL`), neue Probe `e2e/tests/r00140-navigation.spec.js` (AK 1–8, 11, 12).

**Verworfen**:
- Die in-place geänderte Fassung von Regel 5 stehen lassen: Eine akzeptierte ADR wird nicht umgeschrieben; die Weitung gehört als datierter Nachtrag hierher (Skill `adr-vorlage`; Hausbrauch ADR-0007 N1/ADR-0010 N1).
- Die Leiste weiter mit allen sechs Zielen führen (Status quo): die vier seltenen belegen bei jeder Breite Platz, der dem Filter fehlt — der Anlass der Karte.
- Ein neuer Zustand „Navigation eingeklappt“ (R00140, Option C): merkt einen Schalter, statt die Gewichtung der Ziele festzulegen; die Karte will es per Default weniger.

**Pre-Mortem**:
| Gescheitert, weil … | Gegenmaßnahme |
|---|---|
| Eine zweite Stelle markiert die Kopfzeile (etwa ein sichtbarer Punkt am „…“-Auslöser) | Regel 5 zählt die Markierung; die Mutante „zweiter Eintrag zusätzlich markiert“ (R00140 AK 9 M2) wird rot |
| Die aktuelle Seite im Menü bleibt unmarkiert, weil die Probe nur `nav a` prüft | die geweitete `r00113`-Probe prüft „der Eintrag mit `an`“, nicht `nav a` |
| Eine künftige Kopfzeilen-Sicht vergisst die Markierung | alle drei Stellen (`vNavigation`, `vSeitenPop`, `vMehrPop`) setzen sie über denselben Helfer `aktuelleSeite`; Probe über alle Routen |

**Durchsetzung** (ergänzt): Review-Punkt für `architektur-reviewer` und `code-reviewer`: eine Markierung der aktuellen Seite außerhalb von `aktuelleSeite` (ein zweiter `an`-Träger, ein Punkt am Auslöser) ist ein Befund. Jeder `role=menu`-Eintrag der Kopfzeile trägt `an` + `aria-current` über `aktuelleSeite`.

**Grenze**: Form, Reihenfolge, Beschriftung und Gestaltung des Menü „…“ (Material 3 „Menu“, Divider, Artboard D0002) sind Sache von UX und product-owner (R00140); dieser Nachtrag regelt nur die Markierung (Regel 5) und hält die gebaute Zusammensetzung fest.

## Quellen / Bezüge

- Karte #13; Material 3 „Structure“ (https://m3.material.io/foundations/designing/structure); WAI-ARIA 1.2 (`listitem`, `option` und `button` mit „Children Presentational“, `aria-selected`, `aria-current`, `aria-expanded`)
- [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [ADR-0013](0013-deutsche-anzeige-an-der-zeichengrenze.md), [ADR-0014](0014-nur-die-neueste-antwort-wird-uebernommen.md), [ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md)
- Baustein [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md), Aspekt [X00005 Struktur für Hilfstechnik](../Architektur/Aspekte/X00005-struktur-fuer-hilfstechnik.md)
- Nachtrag N1: Karte #105 (Betreiber), [R00140](../../Anforderungen/R00140-navigation-seltene-ziele-im-mehr-menue.md) (I0126, gebaut `d0fa547`); `web/ansicht.js:69`, `:77–88`, `:91–94`, `:99–108`, `:126–147`, `web/kd-app.css:52`, `web/kopfzeile.js` (kopfPlaetze); Proben `e2e/tests/r00113-struktur.spec.js`, `e2e/tests/r00140-navigation.spec.js`
