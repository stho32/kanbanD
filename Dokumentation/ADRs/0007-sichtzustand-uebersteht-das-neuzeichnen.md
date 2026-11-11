# ADR-0007: Sichtzustand übersteht das Neuzeichnen — ein allgemeiner Sicherer über stabile Schlüssel statt Selektorliste und Feld-IDs

**Status**: Akzeptiert
**Datum**: 2026-11-05
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #19)
**Kontext-Anforderung**: — (Bug-Karte #19, Anforderung folgt)
**Erprobt durch**: headless Probe gegen `target/release/kanbanD` (Stand `6333800`), siehe Kontext
**Nachträge**: 2026-11-06 — Bereichsregel umgekehrt und `href` als Schlüssel (Karte #8, R00106), siehe [Nachtrag N1](#nachtrag-2026-11-06-bereiche-umgekehrt-und-href-als-schlüssel-r00106). 2026-11-10 — Titel des Fensters liest mehrzeilig, bearbeitet einzeilig (Karte #115), siehe [Nachtrag N2](#nachtrag-2026-11-10-n2-titel-des-fensters-liest-mehrzeilig-bearbeitet-einzeilig-115). 2026-11-11 — Listenzeilen und zerstörende Knöpfe tragen `data-halt` statt der Listenposition (Karte #40), siehe [Nachtrag N3](#nachtrag-2026-11-11-n3-listenzeilen-tragen-data-halt-statt-der-listenposition-karte-40). Der Text oberhalb der Nachträge ist der Stand der Annahme und bleibt unverändert; Marken *(→ N1)*, *(→ N2)* und *(→ N3)* zeigen, wo der jeweilige Nachtrag gilt.

## Kontext

- Belegt (Code): Die Oberfläche zeichnet bei jedem Live-Ereignis, das den Serverstand ändert, **alles** neu — `ereignis()` → `laden({ nurBeiAenderung: true })` → `render()` (`web/app.js:1756–1769`, `153–208`); `render()` ersetzt `#kopf`, `#main` und `#over` per `innerHTML` (`web/app.js:446–452`). Ein Kommentar an **irgendeine** Aufgabe ändert `S.aufgaben` und damit den Vergleichsstand (`web/app.js:150`).
- Belegt (Code): Was das Neuzeichnen überstehen soll, retten drei Einzelmechanismen: eine feste Selektorliste der Scrollflächen nur in `#main` (`rollpositionen()`, `web/app.js:467–479`), das fokussierte Eingabefeld nur, wenn es eine `id` trägt (`web/app.js:434–460`), der Fokus über einzelne Sonderfälle (`S.ui.fokus`, `fokusKarte`, `fokusZeile`, `web/app.js:462–464`).
- Belegt (Code): Das Aufgabenfenster liegt in `#over` (`web/ansicht.js:222–237`). Seine Scrollflächen sind im breiten Layout `.mod-main` und `.mod-side` (`web/kd-app.css:226–227`), erst bis 640 px `.mod-body` (`web/kd-app.css:710–714`). Die Felder `input.titel`, Labels, Fälligkeit, Spalte und Klasse tragen `data-af`, aber keine `id` (`web/ansicht.js:225–236`); sie speichern über `change` (`web/app.js:1165–1172`). 37 Eingabeelemente in `web/*.js` haben keine `id`. *(→ N2: Titel liest als `<div data-act>`, bearbeitet als `<input data-af>`)*
- Beobachtet (Probe, 1400 × 700 und 600 × 700, Aufgabe mit 40 Kommentaren, Kommentar per API): Scrollstand von `.mod-main` bzw. `.mod-body` nach dem Ereignis 0 statt 400, sowohl bei Kommentar an dieselbe wie an eine andere Aufgabe. Beim Tippen im Titel landet der Fokus auf `BODY`, **und der halb getippte Titel wird committet** („#1 geändert: Titel“ direkt nach dem fremden Kommentar). Das Kommentarfeld `#km-inp` (mit `id`) behält Inhalt und Fokus.
- Vermutung: Der Commit entsteht, weil das fokussierte, geänderte Feld beim Ersetzen seinen Knoten verliert und dabei `change` auslöst. Nicht im Einzelnen nachverfolgt; die Wirkung ist belegt.
- Ziel aus `AI-Team/umgebung.md` (Lastprofil): Live-Änderung in allen offenen Sichten < 1 s, bis 10 Agenten schreiben gleichzeitig — bei 5 Schreibaufrufen/s zeichnet die Oberfläche also bis zu fünfmal je Sekunde neu. Was ein Mensch gerade liest oder tippt, muss das überstehen, sonst ist das Fenster unter Agentenlast nicht benutzbar.

Die Klasse des Fehlers ist damit nicht „ein Selektor fehlt“, sondern „jede Fläche und jedes Feld, das niemand in eine Liste einträgt, verliert beim Neuzeichnen seinen Zustand“. Die Karte nennt `.mod-body`; das allein hilft nur bis 640 px und weder Fokus noch Titel.

## Optionen

### Option A: Liste erweitern, Feldern `id` geben
`.mod-main`, `.mod-side`, `.mod-body` in `rollpositionen()` aufnehmen, auch `#over` absuchen; jedem Feld des Fensters eine `id`.
- Vorteile: kleinste Änderung, folgt dem vorhandenen Muster; in einer Stunde gebaut.
- Nachteile: behebt diesen Fall, nicht die Klasse — die nächste neue Scrollfläche oder das nächste Feld ohne `id` (heute 37) fällt wieder heraus, und niemand merkt es vor dem Betreiber. Knöpfe und andere fokussierbare Elemente bleiben ungehalten. Der ungewollte Commit beim Ersetzen bleibt.

### Option B: allgemeiner Sicherer in `render()` über stabile Schlüssel
`render()` sichert vor dem Ersetzen **alle** Zustände in `#main` und `#over` und stellt sie danach über einen Schlüssel wieder her, statt Listen zu führen:
- Scrollstand jedes Elements mit `scrollTop`/`scrollLeft` ≠ 0, Fokus des aktiven Elements, Wert und Cursor eines fokussierten Feldes.
- Schlüssel eines Elements: `id`; sonst `data-halt="<name>"`; sonst ein Feldschlüssel (`data-af`, `data-nf`, `data-wf`, `data-wn`, `data-tf`, `data-fb`, `data-bf`, `data-dl`, `data-ef`, `data-sf`, `data-fr` samt Wert, bei Listenzeilen mit `data-i`); sonst `data-act` + `data-arg`; sonst die Klasse, wenn sie im Bereich eindeutig ist *(→ N1: `href` vor den Klassen)*. Ohne eindeutigen Schlüssel wird nichts zurückgesetzt (kein Raten an der falschen Stelle). *(→ N3: für Listenzeilen und zerstörende Knöpfe kommt der Schlüssel aus dem Inhalt — `data-halt` —, nie aus der Stelle)*
- Ein Element, das nur durch das Neuzeichnen seinen Knoten verliert, löst keine Speicheraktion aus (ein Merker um das Ersetzen verwirft das `change`, das währenddessen feuert — das Feld hängt dann noch im Dokument; beim Verlassen wird es genau einmal nachgetragen).
- Vorteile: deckt die Klasse ab, auch für künftige Flächen und Felder, ohne dass jemand eine Liste pflegt; ersetzt drei Einzelmechanismen durch einen; bleibt beim heutigen Zeichenmodell (Vorlagen als Zeichenketten, kein Build-Schritt, `A00009`).
- Nachteile: zeichnet weiter alles neu (Kosten je Ereignis unverändert); der Schlüssel aus Klasse oder `data-act` kann bei gleichartigen Elementen mehrdeutig sein — dann gilt die Regel „nichts zurücksetzen“, und es braucht `data-halt`. Restfälle (Textauswahl in Lesetext, aufgeklappte `<details>`) deckt er nicht.

### Option C: gezielt neu zeichnen, nur was sich geändert hat
Je Bereich (`#kopf`, `#main`, `#over`) prüfen, ob sich seine Eingangsdaten geändert haben; das Fenster nur neu zeichnen, wenn sich die offene Aufgabe ändert (Pfade aus dem Ereignis, `A00008`).
- Vorteile: weniger Arbeit je Ereignis; der häufigste Fall der Karte (Kommentar an eine **andere** Aufgabe) lässt das Fenster unberührt.
- Nachteile: löst den Fall „Kommentar an dieselbe Aufgabe“ nicht — dann wird das Fenster doch ersetzt und braucht B ohnehin. Führt Abhängigkeitswissen je Bereich ein (welcher Bereich liest welche Daten); vergisst man eine Abhängigkeit, zeigt die Sicht alten Stand — ein Fehler, der schwerer auffällt als ein Sprung.

### Option D: DOM-Abgleich statt Ersetzen (Morphing)
Neues Markup in einen losen Baum zeichnen und den lebenden DOM per Abgleich angleichen (eigene Funktion oder eingebettete Bibliothek nach dem Muster idiomorph/morphdom); Knoten bleiben erhalten, Scroll, Fokus, Cursor, Auswahl und `<details>` von selbst.
- Vorteile: die gründlichste Antwort — Zustand bleibt, weil Knoten bleiben, auch für Fälle, an die heute niemand denkt.
- Nachteile: tauscht den Zeichenkern der ganzen Oberfläche; Eigenheiten (Eigenschaft `value` gegen Attribut, fokussiertes Feld nicht überschreiben, Listen ohne Schlüssel werden falsch zugeordnet) verlangen selbst Schlüssel wie in B. Neue Abhängigkeit oder einige hundert Zeilen eigener Code ohne Build-Schritt; jeder E2E-Test der Oberfläche ist betroffen. Unverhältnismäßig für einen Fehler, den B ohne Umbau des Kerns schließt.

## Entscheidung

**Gewählt: Option B** — ein allgemeiner Sicherer in `render()`, Schlüsselregel wie oben, gilt für `#main` und `#over`. *(→ N1: gilt für alle Kinder von `#app`; nur `#main` und `#over` hinter Wächtern; → N2: Wahl der Elemente des Titelfelds bleibt unter dem Sicherer)*

B schließt die Fehlerklasse statt des Einzelfalls und ersetzt drei Sonderwege durch einen, ohne das Zeichenmodell anzufassen. Bewusst in Kauf genommen: Es wird weiter alles neu gezeichnet (C bleibt als spätere Lastmaßnahme möglich und baut auf B auf), und Elemente ohne eindeutigen Schlüssel brauchen `data-halt`. *(→ N3: die Stelle `data-arg`/`data-i` ist kein Schlüssel einer Liste; Listenzeilen und zerstörende Knöpfe tragen `data-halt` aus dem Inhalt)* D wird erst wieder Thema, wenn B an Restfällen (Textauswahl, `<details>`) mehrfach scheitert oder das Neuzeichnen unter dem Lastprofil messbar zu teuer wird — dann neue ADR, die diese ablöst.

## Konsequenzen

**Positiv:**
- Scroll, Fokus, Wert und Cursor im offenen Fenster überstehen Live-Ereignisse, auch für Felder ohne `id`.
- Kein halb getippter Wert wird mehr durch ein fremdes Ereignis committet.
- Neue Flächen und Felder sind ohne Zutun abgedeckt, solange ihr Schlüssel eindeutig ist.

**Negativ / In Kauf zu nehmen:**
- Rechenaufwand je Ereignis bleibt (volles Neuzeichnen).
- Gleichartige Elemente ohne eindeutigen Schlüssel werden nicht wiederhergestellt; das muss im Markup mit `data-halt` gelöst werden. *(→ N3: Listenzeilen und zerstörende Knöpfe tragen `data-halt` aus dem Inhalt; ein zerstörender Knopf wird nie über seine Stelle gehalten)*

**Durchsetzung** (Regel gilt für die ganze Oberfläche):
- E2E-Test „Live-Ereignis bei offenem Fenster“ (Abnahme-Probe der Karte #19) in breitem **und** schmalem Layout: misst `.mod-main` bzw. `.mod-body`, Fokus und Wert des Titelfelds, und dass kein Commit „geändert: Titel“ entsteht.
- Die vorhandenen Proben zur Leseposition (`e2e/tests/r00033-kontextmenue.spec.js:94–103`, `r00054-wbs-sicht.spec.js:106–115`) bleiben grün — sie sind die Regressionsprobe für `#main`.
- Review-Punkt `architektur-reviewer` und `code-reviewer`: keine neue Selektorliste und kein Sonderfall für Fokus neben dem Sicherer.

**Folgeentscheidungen / Aufgaben:**
- [ ] Anforderung aus Karte #19 nach dieser ADR (Vorschlag im Bericht an den Director).
- [ ] Option C prüfen, falls das Neuzeichnen unter dem Lastprofil (5 Schreibaufrufe/s) messbar ruckelt — eigene Karte, eigene ADR.

## Nachtrag 2026-11-06: Bereiche umgekehrt und `href` als Schlüssel (R00106)

**Anlass**: Karte #8 ([R00106](../../Anforderungen/R00106-fokus-in-fenstern-und-menues.md)), UX-Review Wiederholung 2 (`01aa78e`): Fokus auf „Tastenkürzel“ oder „API für Agenten“ in der Statuszeile und auf Navigationslinks geht beim Live-Ereignis verloren und wird auf Karte bzw. Spaltenkopf geführt; Enter öffnet danach Aufgabe #2 statt der Hilfe. Nach zwei Nacharbeiten derselben Klasse griff die Schleifenbremse; der realist-consultant riet zum Umsteuern an der Ursache (Kommentar auf Karte #8, 2026-11-06 06:42; Logbuch `847289a`). Die Wahl — Option B, ein allgemeiner Sicherer über stabile Schlüssel — gilt unverändert; der Status bleibt `Akzeptiert`. Geändert werden die Geltung der Bereiche und die Schlüsselregel.

**Belegt (Code)**:
- `render()` sichert `#kopf` immer, `#main` nur bei gleicher Sicht, `#over` nur bei gleicher offener Aufgabe (`web/app.js:446–448`). `#app` hat drei Kinder, `#kopf`, `#main` und `#stat` (`web/index.html:12`). `#stat` liegt außerhalb jedes gesicherten Bereichs und wird nach `rollstaendeSetzen` neu geschrieben (`web/app.js:474`).
- Navigationslinks tragen weder `id` noch `data-act`, nur `href` und die Klasse `an` (`web/ansicht.js:76`). Die Schlüsselregel kennt kein `href` (`web/sichtzustand.js:20–34`), und `schluesselIm` reicht nur `id`, `dataset` und `classList` weiter (`:44–47`).
- Schlüssel wie `[data-act="add"]` stehen in mehreren Sichten an verschiedenen Elementen: „+ Neue Aufgabe“ im Kopf (`web/ansicht.js:64`) und „+ Neue Aufgabe“ ohne Board in der Aufgabenliste (`:681`).

**Gemessen** (realist-consultant, headless Chromium, ein Live-Ereignis je fokussiertem Element): 34 von 110 fokussierbaren Elementen bei 1280 px und 16 von 92 bei 375 px verlieren den Fokus, nämlich Navigationslinks, Statuszeile und „CSV“ auf dem Stundenzettel. Auf Einrichten landet der Fokus im Namensfeld (Rückfall nach ADR-0010, dort N7). Probe mit beiden Änderungen unten: 110 von 110 und 92 von 92 gehalten.

### N1 Bereichsregel und Schlüsselkandidat `href`

**Entschieden**:

1. **Bereiche umgekehrt**: Gesichert werden **alle Kinder von `#app`**, heute `#kopf`, `#main` und `#stat`, und jedes künftige Kind ohne weiteres Zutun. Nur zwei Bereiche bleiben hinter Wächtern: `#main` (nur bei gleicher Sicht) und `#over` (nur bei gleicher offener Aufgabe). Begründung: In den ständigen Bereichen (Kopf, Statuszeile) bedeutet ein Schlüssel in jeder Sicht dasselbe Element. In `#main` und `#over` kann derselbe Schlüssel nach einem Wechsel ein anderes Element meinen, etwa `[data-act="add"]` (`web/ansicht.js:64`, `:681`). Dort würde der Sicherer an der falschen Stelle treffen. Die Regel „was nicht in einer Liste steht, fällt heraus“ war die Fehlerklasse dieser ADR. Die alte Bereichsliste wiederholte sie eine Ebene höher.
2. **Alles, was neu gezeichnet wird, liegt zwischen Sichern und Wiederherstellen**: Auch `#stat` wird im selben Block wie `#kopf`, `#main` und `#over` ersetzt, also vor `rollstaendeSetzen` und vor der Fokusführung. Ein Bereich, der danach noch geschrieben wird, verliert, was gerade wiederhergestellt wurde.
3. **Schlüsselkandidat `href`**: Die Vorrangfolge lautet jetzt `id` → `data-halt` → Feldschlüssel (samt `data-i`) → `data-act` (+ `data-arg`) → **`[href="…"]`** → einfache Klassen. Maßgeblich ist der Attributwert, wie er im Markup steht (`getAttribute('href')`), nicht die aufgelöste URL. Es gilt dieselbe Eindeutigkeitsregel wie für alle Kandidaten: Steht derselbe `href` mehrfach im Bereich (etwa `href="#"`), fällt er weg, und der nächste Kandidat prüft. `href` steht hinter `data-act`, weil Links mit Aktion (z. B. `#t-ber`, `href="#"`) über `id` oder Aktion eindeutiger sind. Vor den Klassen steht er, weil Klassen wie `an` den Zustand tragen und nicht das Ziel.

**Verworfen**:
- `#stat` als vierten Bereich in die Liste aufnehmen: behebt den Einzelfall. Das nächste Kind von `#app` fällt wieder heraus, und die Schleifenbremse hat genau diese Folge von Einzelfixes angehalten.
- `#main` und `#over` ebenfalls immer sichern: Der Sicherer würde nach einem Sichtwechsel gleichnamige, fremde Elemente treffen (`[data-act="add"]`). Das ist Raten an der falschen Stelle, das der Text oben ausschließt.
- Navigationslinks mit `data-halt` oder `id` versehen: geht, ist aber eine Liste im Markup. Jeder neue Link ohne Attribut fiele wieder heraus. `href` ist an jedem Link schon da.

**Pre-Mortem**: (a) Ein Element in Kopf oder Statuszeile wechselt je Sicht die Bedeutung, behält aber seinen Schlüssel. Dann hält der Sicherer den Fokus auf etwas anderem. Gegenmittel: Wer so ein Element in einen ständigen Bereich legt, gibt ihm einen sichtabhängigen `data-halt`; Review-Punkt unten. (b) `#stat` wird doch wieder nach dem Wiederherstellen geschrieben. Gegenmittel: Das Abtastraster deckt die Statuszeile ab. (c) Ein `href` mit Anführungszeichen oder Backslash bricht den Selektor. Gegenmittel: dieselbe Quotierung `zitiert()` wie für die übrigen Attribute (`web/sichtzustand.js:14–17`).

**Testbarkeit** (erster Test je Teil):
- Schlüsselregel, Node-Unit wie bisher rein: Eingabe `{ id: '', daten: {}, klassen: ['an'], href: '#/aufgaben' }` und eine Zählfunktion, die `[href="#/aufgaben"]` einmal zählt. Ausgabe `[href="#/aufgaben"]`. Zählt sie den `href` zweimal, ist die Ausgabe `.an`, sofern eindeutig, sonst `''`.
- Bereichsauswahl: am besten als reine Funktion über die Kinder von `#app` und die beiden Wächter (gleiche Sicht, gleiche offene Aufgabe), damit sie ohne DOM prüfbar ist. Die Wahl des Schnitts liegt beim entwickler.
- Abnahme ist **ein Abtastraster** statt Beispielen: jedes fokussierbare Element × fünf Sichten (Board, Aufgaben, Personen, Einrichten, Stundenzettel, die in Beratung und PO-Entscheidung genannten) × zwei Breiten (1280 und 375 px). Je Element: fokussieren, fremden Schreibaufruf über die API auslösen, danach dasselbe Element nach Schlüssel fokussiert. Soll: 110 von 110 und 92 von 92 bzw. die dann gezählte Gesamtzahl, null Verluste. Die Erwartung ohne gleiches Element regelt ADR-0010 N7.

**Durchsetzung** (ergänzt): Review-Punkt für architektur-reviewer und code-reviewer: keine neue Bereichsliste neben „alle Kinder von `#app`“. Kein `innerHTML` auf einen Bereich nach `rollstaendeSetzen`. Ein Element in einem ständigen Bereich, das je Sicht anderes bedeutet, trägt `data-halt`.

**Folgeentscheidung, offen**: keine. Gebaut wird als Nacharbeit 3 auf Karte #8 durch den entwickler.

## Nachtrag 2026-11-10 N2: Titel des Fensters liest mehrzeilig, bearbeitet einzeilig (#115)

**Anlass**: Karte #115 (Board „entwicklung", Folge aus #16/[R00115](../../Anforderungen/R00115-kartentext-lesbar-setzen.md)), Architektur-Phase 2026-11-10. Festgelegt in der Architektur-Phase, Bericht des Architekten; Entscheidung vom Director bestätigt. Der Sicherer aus N1 ändert sich nicht; der Status bleibt `Akzeptiert`. Gewählt wird nur die Elementwahl des Titelfelds.

**Sicherung unverändert (N1)**: Das lesende `<div data-act="titel-bearbeiten">` ist über seinen Aktions-Schlüssel gesichert (`web/sichtzustand.js`, `liste.push([data-act=…])`), das Bearbeitungs-`<input data-af="titel">` über seinen Feldschlüssel (der Sicherer sichert nur Eingabefelder, `EINGABEFELD`-Test) — beide Zustände überstehen das Neuzeichnen.

**Entschieden (Elementwahl)**: Der Titel steht im Lesen als mehrzeiliges `<div>` (`overflow-wrap:break-word`, Bruch zwischen Wörtern nach R00115 FA 1). Klick/Enter wechselt in den Bearbeitungszustand `S.ui.titelBearbeiten` mit einem einzeiligen `<input data-af="titel">` — nach dem Muster `besch-lesen`/`S.ui.beschreibungBearbeiten` (`web/ansicht.js`, `web/app.js`). Bewusst in Kauf genommen: Beim Eingeben scrollt ein langer Titel horizontal (heutiges Verhalten); die Karte verlangt Lesbarkeit, nicht mehrzeiliges Eingeben.

**Verworfen**:
- (a) `<textarea>` als einziges Element: Der Titel ist im Dateiformat eine Zeile; Enter fügte einen Umbruch ein und bräuchte Sonderregeln, die es im Haus nicht gibt.
- (b) `contenteditable`: kein Formularfeld, kein `change`; der Sicherer kennt Wert und Auswahl nicht; halb Getipptes fiele beim `innerHTML`-Ersetzen eines Live-Ereignisses — die Fehlerklasse dieser ADR.

**Fenstertasten (R00106)**: `e` öffnet den Bearbeitungszustand statt nur zu fokussieren (heute `fokus('[data-af="titel"]')`; Muster `'b' → act('beschreibung-bearbeiten')`). ↑/↓ blättern im Lesemodus weiter (der Guard greift nur auf Eingabefelder). Esc bleibt wie heute — „Esc im Titelfeld verwirft statt speichert" ist Karte #54, eigene Entscheidung.

**Grenze**: Der Umbruch des Fenstertitels ist die fünfte Ausprägung von „Umbruch als Antwort, kein Querscrollen" ([ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) N1, [ADR-0019](0019-vergessene-timer-sind-anzeige.md) N1/N3/N4); die Breitenproben (r00114, `ziele.spec.js`) laufen mit als Wächter. Form, Maße und Typografie des Titels (`kd-app.css` `.titel`) bleiben Detailplanung/UX.

## Nachtrag 2026-11-11 N3: Listenzeilen tragen `data-halt` statt der Listenposition (Karte #40)

**Anlass**: Karte #40 „Fokus nach Entfernen springt auf den nächsten Eintrag" (Board „entwicklung", aus Code-Review #19 A2). Die PO-Entscheidung vom 2026-11-08 (`AI-Team/po-entscheidungen.md:166`) nennt dieselbe Ursache für drei Karten — #40 (Fokus springt auf den Nachfolger), #65 (Doppeltipp hakt zwei ab) und #106 (Doppelklick auf ✕ löscht die nachgerückte): die **Adressierung über den Listenindex**. Sie gibt dem architekt auf, eine Lösung für alle drei zu wählen, und hält fest, dass #40 ein Fokus-Thema mit eigener Abnahme bleibt. Die Wahl dieser ADR — Option B, ein allgemeiner Sicherer über stabile Schlüssel — gilt unverändert; der Status bleibt `Akzeptiert`. Geändert wird nur, **womit** der Sicherer ein Listenelement wiederfindet. Die eigentliche DELETE-Adressierung (welche Stelle der Aufruf trifft) bleibt ein eigener Strang (#106/#65, ADR-0017 Konsequenz „Teilaufgaben-Index").

**Belegt (Code)**:
- Teilaufgaben: Die Zeile und ihre Bedienelemente tragen die Stelle `j` als `data-teil` bzw. `data-arg`; das zerstörende ✕ ist `data-act="teil-weg" data-arg="${j}"`, die Textbearbeitung `data-act="teil-bearbeiten" data-arg="${j}"` (`web/ansicht.js:324`).
- Herkunft: Das ✕ ist `data-act="herkunft-weg" data-arg="${j}"` (`web/ansicht.js:288`).
- Die Schlüsselregel findet ein Element über `id` → `data-halt` → Feldschlüssel (samt `data-i`) → `data-act`(+`data-arg`) → `href` → Klassen (`web/sichtzustand.js:20–34`). Ein ✕ ohne `id` und ohne `data-halt` fällt auf `[data-act="teil-weg"][data-arg="j"]` zurück — auf die Stelle, nicht auf den Inhalt.
- Der gezeigte Index verschiebt sich unter fremder Änderung: Entfernt ein Agent „Teilaufgabe eins" über die API, zeichnet `render()` die Liste neu; „zwei" steht jetzt an Stelle 0. Der gehaltene Schlüssel `[data-act="teil-weg"][data-arg="1"]` trifft danach „Teilaufgabe drei" — der Fokus steht auf einem fremden ✕, und der nächste Tastendruck löscht es. Genau die Abnahme-Probe der Karte #40 (heute rot).
- `nachbarArgument` (`web/app.js:482–489`) rechnet den Nachbarn aus der **gezeigten** Reihenfolge und den Stellen-Argumenten. Das trägt innerhalb der eigenen Aktion (R00112 FA 8, `fokusNachEntfernen` `web/app.js:493–498`), nicht bei fremder Änderung: es kennt den Inhalt nicht.
- Der Bestand kennt inhaltsbezogene `data-halt` schon: `kopf:<spalte>`, `klapp:<spalte>`, `info:<spalte>` (ADR-0010 N6, `web/ansicht.js:766`, `:781`). Der Sicherer findet Gegenstücke darüber, ohne neuen Mechanismus.

### Entschieden

1. **Eine Listenposition ist kein stabiler Schlüssel.** `data-arg` bzw. `data-i` einer Listenzeile ist ein **Aufrufargument** — an welcher Stelle zu wirken ist —, kein Identitätsmerkmal. Als Schlüssel des Sicherers taugt es nicht: Nach jeder fremden Listenänderung bezeichnet dieselbe Stelle ein anderes Element.
2. **Listenzeilen und zerstörende Knöpfe tragen `data-halt` aus dem Inhalt.** Jedes fokussierbare Element einer Listenzeile (Teilaufgabe, Herkunft und jede künftige Liste) bekommt einen inhaltsbezogenen, stabilen `data-halt`, z. B. `data-halt="teil:<text>"` aus dem Teilaufgabentext. Er steht in der Schlüsselregel vor `data-act`+`data-arg` (`web/sichtzustand.js:24` vor `:29`) und wird dort ohne Änderung gefunden.
3. **Eigener `data-halt` je fokussierbarem Teil, damit er eindeutig bleibt.** Tragen Zeile und ihr ✕ denselben Wert, zählt die Schlüsselregel den Selektor zweimal und verwirft ihn („genau einmal im Bereich", `web/sichtzustand.js:38–42`). Darum je Teil ein eigener, inhaltsbezogener Wert mit eigenem Präfix (`teil:<text>` für den Text, `teil-weg:<text>` für das ✕; sinngemäß für die anderen Listen).
4. **Ein zerstörender Knopf wird nie über seine Stelle gehalten.** Ist der `data-halt` eines ✕ im Bereich nicht eindeutig (derselbe Text zweimal), weicht der Sicherer für ein Element, das eine **entfernende** Aktion auslöst, **nicht** auf `[data-act][data-arg]` aus. Dann hält er nichts, und der Fokus fällt nach ADR-0010 N7a/N7b auf den Ort des Abschnitts (`#teil-neu`, `#zeit-neu`, das Fenster) — nie auf das ✕ eines fremden Eintrags. Begründung: der nächste Tastendruck löschte sonst den falschen Eintrag; ein Fokus, der auf den Abschnitt fällt, ist harmlos gegen Datenverlust. Den Schnitt (eigene Marke am zerstörenden Knopf oder Regel im Schlüsselmodul) wählt der `entwickler`.
5. **`data-arg` bleibt.** Der ✕-Knopf behält `data-arg` (die Stelle), damit die Aktion sie weiter adressiert (`web/app.js:1174`, `:1478`). Der Schlüssel des Sicherers kommt aus `data-halt`; der Aufrufweg selbst gehört nicht zu dieser ADR (siehe Grenze).

### Verworfen

- **Die Position als Schlüssel behalten und nur die Anzeige verbessern**: behebt den Einzelfall nicht — der Fokus folgt weiter dem Index, und jede fremde Löschung verschiebt ihn.
- **Zerstörende ✕ ganz aus dem Sichern nehmen** (über dem ✕ wird nie wiederhergestellt): verliert den R00112-Weg („✕ des Nachbarn", `web/app.js:493–498`) und die Rückgabe nach dem eigenen Entfernen. Der inhaltliche Schlüssel erhält beides: denselben Eintrag nach fremder Änderung und den Nachbarn nach eigener Aktion.
- **Den Fensterinhalt bei fremder Änderung nicht neu zeichnen** (Option C aus ADR-0007): löst den Fall „Änderung an derselben Aufgabe" nicht und braucht den Schlüssel ohnehin.
- **Ein Ordinal unter Gleichnamigen** (`teil-weg:2:<text>`): die Zahl ist wieder eine Stelle; ändert sich die Zahl der Gleichen, trifft sie ein anderes Element. Wenn der Inhalt nicht eindeutig ist, wird bewusst nicht gehalten (Regel 4).

### Pre-Mortem

| Gescheitert, weil … | Gegenmaßnahme |
|---|---|
| Zwei Teilaufgaben heißen gleich, ein Agent entfernt eine, der Fokus treibt auf das andere ✕ | Regel 4: nicht eindeutig ⇒ nichts halten, Fokus auf den Abschnitt; die Abnahme-Probe deckt den Doppeltext ab |
| Ein künftiger Listeneintrag bekommt `data-halt` nur auf der Zeile, nicht auf dem fokussierbaren ✕ | Review-Punkt unten: jedes fokussierbare Element der Zeile braucht einen eigenen stabilen `data-halt` |
| Ein Text ändert sich unter dem Menschen (ein Agent bearbeitet ihn) | Dann ist es inhaltlich ein anderes Element und wird nicht mehr gefunden — gewollt; der Fokus fällt auf den Abschnitt, nie auf ein fremdes ✕ |

### Testbarkeit (erster Test)

- **Node-Unit `web/sichtzustand.js`** (rein, kein DOM): Eingabe ein Element `{ id: '', daten: { halt: 'teil-weg:zwei', act: 'teil-weg', arg: '1' } }` und eine Zählfunktion, die `[data-halt="teil-weg:zwei"]` einmal und `[data-act="teil-weg"][data-arg="1"]` einmal zählt; Ausgabe ist `[data-halt="teil-weg:zwei"]`. Zählt die Funktion den `data-halt` **zweimal**, ist die Ausgabe `''` — nicht `[data-act…][data-arg…]` (Regel 4).
- **E2E-Abnahme (Karte #40)**: Fokus auf „Teilaufgabe zwei entfernen"; ein Agent entfernt „eins" über die API (`DELETE …/teilaufgaben/0`); danach steht der Fokus weiterhin auf dem ✕ **derselben** Teilaufgabe (heute Stelle 1), nicht auf „Teilaufgabe drei entfernen". Zweiter Fall (Doppeltext): zwei gleich benannte Teilaufgaben, ein Agent entfernt eine → Fokus auf `#teil-neu`, nie auf das ✕ der anderen. Dritter Fall: die eigene Aktion bleibt wie R00112 FA 8 (✕ des Nachbarn).

### Durchsetzung

- Review-Punkt für `architektur-reviewer` und `code-reviewer`: Ein fokussierbares Element in einer Liste, dessen einziger stabiler Schlüssel die Stelle (`data-arg`/`data-i`) ist, ist ein Befund. Jedes trägt einen inhaltsbezogenen `data-halt` — oder wird bewusst nicht gehalten (zerstörend und nicht eindeutig).
- Wächter: der Node-Unit-Test oben hält die Reihenfolge `data-halt` vor `data-act`+`data-arg` fest und das „nichts halten statt Stelle" für zerstörende Knöpfe.
- Die vorhandenen R00112-Fokusproben (`e2e/tests/r00112-rueckgaengig.spec.js`) bleiben grün (eigene Aktion); die Karte ergänzt den Fall der fremden Änderung.

### Grenze

Diese ADR regelt **nur, worüber der Sicherer ein Element wiederfindet** — die Oberfläche. Die **Adressierung des Löschens selbst** (welche Stelle der DELETE trifft, der Doppelklick-Fall) berührt den Schreibweg und die API und ist der eigene Strang #106 (Vorrang) und #65; ADR-0017 führt die Teilaufgaben-Indizierung ausdrücklich als in Kauf genommene Schwäche („Teilaufgaben-Index: Die Adressierung per Index bleibt"). Eine dort beschlossene stabile Adressierung baut auf dieser Regel auf, ersetzt sie aber nicht.

## Quellen / Bezüge

- Karte #19 (Betreiber, 2026-10-31); `AI-Team/umgebung.md`, Lastprofil
- Bausteine [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md), [A00008 Wächter](../Architektur/A00008-waechter.md) (Quelle der Ereignisse, unverändert)
- R00061 (zeichnet nur bei Änderung), R00033 (Leseposition unter dem Kontextmenü), R00085 (Live-Verbindung)
- Nachtrag N1: Karte #8 (Kommentare 2026-11-06 06:34 und 06:42), Logbuch `847289a`, [R00106](../../Anforderungen/R00106-fokus-in-fenstern-und-menues.md), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) N7; `web/app.js:446–474`, `web/index.html:12`, `web/ansicht.js:64`, `:76`, `:681`, `web/sichtzustand.js:14–47`
- Nachtrag N2: Karte #115 (Board „entwicklung", Folge aus #16), [R00115](../../Anforderungen/R00115-kartentext-lesbar-setzen.md) FA 1, [R00106](../../Anforderungen/R00106-fokus-in-fenstern-und-menues.md), [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) N1, [ADR-0019](0019-vergessene-timer-sind-anzeige.md) N1/N3/N4, Karte #54 (Esc im Titelfeld); `web/sichtzustand.js`, `web/ansicht.js`, `web/app.js`, `web/kd-app.css` `.titel`
- Nachtrag N3: Karte #40 (Kommentare 2026-11-08 09:12, 09:31, 2026-11-11 11:47), Karten #65, #106; PO-Entscheidung `AI-Team/po-entscheidungen.md:166`; [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) N6 (`data-halt`), N7a/N7b (Rückfall); [ADR-0017](0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) (Teilaufgaben-Index, in Kauf genommen); `web/ansicht.js:288`, `:324`, `web/app.js:482–489`, `:493–498`, `:1164–1176`, `:1475–1478`, `web/sichtzustand.js:20–34`, `:38–42`
