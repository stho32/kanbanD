# ADR-0010: Fokusführung über Ebenen — eine Stelle nach dem Neuzeichnen führt Fokusfalle, Menüfokus und Rückgabe an den Auslöser

**Status**: Akzeptiert
**Datum**: 2026-11-06
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #8)
**Kontext-Anforderung**: — (Karte #8 „Fokus in Fenstern und Menüs führen und nach jeder Aktion halten“, Anforderung folgt über den planer)
**Erprobt durch**: headless Chromium-Probe 2026-11-06 (Scratchpad, nicht versioniert): `inert` gegen natives `<dialog>.showModal()` unter `innerHTML`-Neuzeichnen, siehe Kontext
**Nachträge**: 2026-11-15 — [N9](#nachtrag-2026-11-15-n9-esc-im-bearbeitungsmodus-eines-fensterfelds-verwirft-und-schreibt-nie): eine Esc-Regel für das Aufgabenfenster — Esc verwirft den Entwurf des fokussierten Textfelds (Titel, Beschreibung, Labels, Enter-Felder), schreibt nie und schließt erst beim zweiten Druck (Karte #54, product-owner 2026-11-15); gebaut mit [R00155](../../Anforderungen/R00155-behebung-aufgabenfenster-felder-und-fenstermeldung.md) (Zweig `karte/54`, `20cb14e`) und am selben Tag auf den gebauten Stand gesetzt: Ziffer 4 ergänzt und berichtigt, Ziffern 7 und 8 neu (Knopf „Eingabe verwerfen“ ohne Zeiger, Enter nach fremdem Neuzeichnen), Vorsorge in der Durchsetzungstabelle benannt. 2026-11-06 — gebauter Stand nach [R00106](../../Anforderungen/R00106-fokus-in-fenstern-und-menues.md) (kanbanD `429c1e2`), siehe [Nachtrag N1–N6](#nachtrag-2026-11-06-gebauter-stand-r00106). Folgeentscheidungen zu N3 und N5 durch den product-owner (`AI-Team/po-entscheidungen.md:109–110`) stehen dort. 2026-11-06 — [N7](#n7-rang-6-nur-bei-offener-ebene-rückfall-ohne-ebene-nie-auf-ein-fremdes-element): Rang 6 nur bei offener bzw. gerade geschlossener Ebene, neue Invariante (product-owner, `AI-Team/po-entscheidungen.md:111`); präzisiert in N7a: nur bei nach dem Neuzeichnen offener Ebene (`:113`). N7b: gebauter Stand (`f8e16e4`) — Leerfall ohne Auslöser, Pop ohne Element ist zu. Der Text oberhalb des Nachtrags ist der Stand der Annahme und bleibt unverändert; Marken *(→ Nn)* zeigen, wo der Bau abweicht.

## Kontext

- Vision `Anforderungen/R00000-vision.md:104`: die Oberfläche ist per Tastatur bedienbar und folgt gewohnten Konventionen. PO-Entscheidung `AI-Team/po-entscheidungen.md:88`: Fokusfalle, Menüs und `role=radio` bleiben auf Karte #8.
- Belegt (Code): `render()` ersetzt `#kopf`, `#main` und `#over` bei jedem Live-Ereignis per `innerHTML` (`web/app.js:431–476`); was das übersteht, regelt [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md) (Sicherer über stabile Schlüssel). Am Ende von `render()` greift entweder der Sicherer oder `fokusZurueckgeben()` (`web/app.js:479–483`: `S.ui.fokus`, sonst `fokusKarte`, sonst `fokusZeile`).
- Belegt (Code): **drei Menü-Mechanismen** nebeneinander:
  1. Kontextmenü `#kmenue` (`web/app.js:1332–1400`, `web/ansicht.js:485–491`): Index nur virtuell in `S.ui.menue.index`, der DOM-Fokus bleibt auf der Karte; Pfeile über `menueSchritt` (`web/menue.js`).
  2. `#pop`-Menüs (Mehr `web/ansicht.js:122–129`, Seite `:97–103`, Board `:280`, Ich `:300`, Lauf `:152`, Berichte `:717–724`, Legen `:686`, WBS-Status `:1102`): `role=menu`, aber ohne Pfeiltasten; Board- und Ich-Pop haben `div`-menuitems ohne `tabindex`; Board-Pop enthält ein Eingabefeld (`#board-neu`), Lauf-Pop Stop-Knöpfe — gemischt.
  3. Auslöser ohne `aria-expanded` (`#t-board`, `#t-mehr` `web/ansicht.js:69`, `#t-seite` `:82`); `#t-ber` ist ein `<a>` (`:76`).
- Belegt (Code): **Dialoge ohne Fokusfalle und ohne `aria-modal`**: Neu (`web/ansicht.js:188`), Aufgabenfenster (`:209–232`), Defekt-Fenster (`:455`), Hilfe (`:471`), Zuweisen (`:549`); dazu `role=dialog` im `#pop` (Reservierungen `:518`, WBS neu `:1110`, WBS verwerfen `:1118`). Esc-Kaskade in `web/app.js:1317–1324`; nur beim Pop wird der Fokus an den Auslöser zurückgegeben (`ausloeserDesMenues()` `:494–498`).
- Belegt (Code): **Radiogruppen ohne Tastatur**: `span role=radio` ohne `tabindex` (`web/ansicht.js:109`, `:666`, `:711`, `:764`), Chips als `button role=radio` alle tabbar (`:115`), `tm-ziel` (`:871`). Die Reiterleiste ist seit R00105 ein `tablist` mit Pfeilen (`naechsterReiter`, `web/tastatur.js`).
- Belegt (Code): Aktionen ohne Fokusziel — `spalte-zu` (`web/app.js:1079`) lässt den Fokus auf dem ersetzten Knopf, also auf `BODY`; `spalte-auf` (`:1080`) setzt ihn auf `.bk-name`.
- Beobachtet (Probe, headless Chromium, Gerüst wie `index.html` mit `#app` und `#over`):
  - `inert` auf `#app` allein: Tab-Folge `d1 d2 BODY d1 d2 BODY` — der Fokus verlässt das Dokument; nach dem Neuzeichnen (Fokus war auf `d2`) steht er auf `BODY`.
  - Natives `<dialog>` mit `showModal()`: das ersetzte Element trägt aus der Vorlage `open` ⇒ `InvalidStateError` („already open as a non-modal dialog“); ohne `open` und mit erneutem `showModal()` nach jedem Zeichnen: Tab-Folge `d2 BODY d1 d2 BODY d1`, nach dem Neuzeichnen springt der Fokus auf `d1` statt auf `d2`.
- Lastprofil (`AI-Team/architekt.md`): bis 5 Schreibaufrufe/s, also bis 5 Neuzeichnungen je Sekunde — eine Fokusführung, die je Neuzeichnen nicht deterministisch ist, flackert sichtbar.

## Optionen

### Option A: Einzellösungen je Stelle

Jeder Dialog bekommt seinen Tab-Handler, jedes Menü seine Pfeiltasten, jede Aktion ihr `S.ui.fokus`.

- Vorteil: kein neues Modul, kleinste Schritte.
- Nachteil: der Bestand zeigt, wohin das führt — drei Menü-Mechanismen, Rückgabe nur beim Pop. Die Reihenfolge, wer nach `render()` gewinnt (Sicherer, `S.ui.fokus`, Falle), ist dann je Stelle anders; unter Live-Ereignissen gewinnt der Zufall.

### Option B: eine Fokusführung über Ebenen am Ende von `render()`

Ein reines Modul bestimmt aus `S.ui` die **oberste offene Ebene** (Kontextmenü > Pop > Dialogstapel, Hilfe und Zuweisen über dem Aufgabenfenster) und daraus Startziel, Rückgabeziel und Tab-Umlauf. Ein Kleber am Ende von `render()` setzt `inert` auf alles unter der obersten Ebene, `aria-modal` auf sie und den Fokus nach einer festen Rangfolge; ein keydown-Zweig führt Tab an den Rändern um. Alle Menüs nutzen echten DOM-Fokus (roving) über `menueSchritt`.

- Vorteil: eine Stelle, eine Rangfolge, deterministisch je Neuzeichnen; baut auf ADR-0007 auf, statt daneben zu stehen; die Entscheidungen sind reine Funktionen und per Node-Unit testbar.
- Nachteil: `render()` bekommt eine weitere Pflicht; `#kmenue` muss vom virtuellen Index auf DOM-Fokus umgebaut werden; `inert` allein reicht nicht (Probe), der Tab-Umlauf ist eigener Code.

### Option C: native Plattform — `<dialog>.showModal()` und Popover-API

- Vorteil: Fokusfalle, Esc und Top-Layer vom Browser.
- Nachteil: unverträglich mit dem Zeichenmodell (Probe): die Vorlage darf `open` nicht tragen, nach jedem `render()` muss `showModal()` erneut laufen und setzt den Fokus auf das erste Element — der Sicherer müsste danach noch einmal greifen; Tab verlässt das Dokument trotzdem; ein Stapel (Hilfe über Fenster) braucht die Reihenfolge der `showModal()`-Aufrufe; Pfeiltasten in Menüs liefert keine der beiden APIs.

### Option D: DOM-Abgleich statt Ersetzen (Morphing)

Bereits in ADR-0007 verworfen (fremde Bibliothek oder eigener Abgleich ohne Build-Schritt); löst die Menü- und Radiofragen ohnehin nicht.

## Entscheidung

**Option B.** Neues reines Modul `web/fokus.js` (UMD wie `web/menue.js`, eingebunden vor `ansicht.js`) mit:

- `ebenen(ui)` *(→ N1)* → Liste der offenen Ebenen von unten nach oben, je Ebene `{ art, selektor, rueckgabe }` (Arten: `fenster`, `defekt`, `neu`, `hilfe`, `zuweisen`, `pop`, `kmenue`) *(→ N8: dazu `fenstermenue` und `aldialog`)*;
- `fallenSchritt(anzahl, index, rueckwaerts)` → Index des nächsten tabbaren Elements mit Umlauf;
- `fokusZiel(lage)` → das eine Ziel nach `render()` aus `{ ausdruecklich, gesichert, gesichertInOberster, geschlossen, geoeffnet }`.

Rangfolge am Ende von `render()`:

1. ausdrückliches `S.ui.fokus` der Aktion;
2. der Sicherer nach ADR-0007 — **nur**, wenn das wiedergefundene Element in der obersten Ebene liegt;
3. wurde eine Ebene geschlossen: ihr Rückgabeziel — für Aufgaben- und Defekt-Fenster die Karte bzw. Zeile der zuletzt gezeigten Aufgabe (`fokusKarte`/`fokusZeile`), sonst der beim Öffnen gespeicherte Schlüssel des Auslösers (`sichtzustand.schluessel`), sonst `#main`; *(→ N3)*
4. wurde eine Ebene geöffnet: ihr Startziel — für das Aufgabenfenster **der Dialog selbst** (`tabindex="-1"`, `aria-labelledby`), nicht das Titelfeld, sonst greifen die Fensterkürzel `e`/`s`/`k` und ↑↓ nicht (`ueberallTaste` kehrt in Eingabefeldern zurück); für Menüs der erste wählbare Eintrag;
5. `fokusKarte`/`fokusZeile` wie heute; *(→ N2)*
6. Fokus auf `BODY` oder in einem `inert`-Bereich: erstes tabbares Element der obersten Ebene. *(→ N7)*

Regeln für die Bausteine der Oberfläche:

- **Menüs** (`#kmenue`, alle `role=menu` im `#pop`): echter DOM-Fokus, roving `tabindex`, Pfeile über `menueSchritt` (`web/menue.js`; DOM-Einträge abgebildet auf `{ aktuell: aria-disabled }`), Home/End, Esc schließt mit Rückgabe, Tab schließt. Auslöser tragen `aria-haspopup="menu"` und `aria-expanded`. *(→ N4)*
- **Ein `#pop` ist entweder Menü oder nicht-modaler Dialog**: `role=menu` enthält nur menuitems; was Eingabefelder oder Knöpfe in Zeilen enthält (Board-Pop, Lauf-Pop), ist `role=dialog` ohne Pfeilnavigation. Die Einordnung je Pop ist eine UX-Frage des planers.
- **Radiogruppen**: roving `tabindex` (ein Tab-Halt je Gruppe), Pfeile in alle vier Richtungen mit Umlauf über eine reine Funktion in `web/tastatur.js`; `naechsterReiter` bleibt als Export und darf darauf aufsetzen. *(→ N1)*
- **Fokus nach Aktionen halten**: Gegenstücke teilen einen `data-halt`-Schlüssel (z. B. `data-halt="klapp:<spalte>"` auf `.bk-name` und `.zu-streifen`), dann findet der Sicherer das Gegenstück ohne neuen Mechanismus; ohne Gegenstück setzt die Aktion `S.ui.fokus`. *(→ N6)*

## Konsequenzen

### Positiv

- Eine Rangfolge für alle Fokusentscheidungen nach dem Neuzeichnen; Live-Ereignisse ändern den Fokus nicht mehr zufällig.
- ADR-0007 bleibt der eine Wiederfinde-Mechanismus; ADR-0010 sagt nur, **ob** sein Treffer gilt und was gilt, wenn er nichts findet.
- Die Entscheidungen sind reine Funktionen: erster Test `e2e/einheit/fokus.test.js` — Eingabe `S.ui`-Ausschnitt bzw. Lage, Ausgabe Ebenenliste bzw. Ziel, kein DOM, kein Server.

### Negativ

- `#kmenue` wird vom virtuellen Index auf DOM-Fokus umgebaut — die E2E-Tests des Kontextmenüs sind anzupassen. *(→ N4)*
- `inert` und der Tab-Umlauf sind eigener Code; Browser ohne `inert` (vor 2023) bleiben ungefangen — die Vision fordert keine Altbrowser.
- Das Aufgabenfenster startet auf dem Dialog statt im Titelfeld: ein Tab mehr bis zum ersten Feld. Gewollt, damit die Fensterkürzel greifen.

### Durchsetzung (Makro-Regel)

- **Invariante**: Ist eine Ebene offen, liegt `document.activeElement` nach jedem `render()` in ihr und nie auf `BODY`; ist keine offen, nie auf `BODY`, wenn vorher ein Element fokussiert war. *(→ N7: neu gefasst)*
- E2E-Proben der Karte: 30× Tab und 30× Umschalt+Tab je Dialog bleiben in ihm; Esc gibt an den Auslöser zurück; dieselben Proben mit fremdem Schreibaufruf während des Laufs.
- Review-Punkt für architektur-reviewer und code-reviewer: `.focus()` außerhalb der Fokusführung und der Aktionen über `S.ui.fokus` ist ein Befund. Erkennen: `grep -n "\.focus(" web/*.js` — jede Fundstelle außer `fokusSetzen` (`web/sichtzustand.js`), dem Kleber in `render()` und dem keydown-Zweig der Fokusführung steht als Abweichung in A00009 oder ist ein Befund. *(→ N5)*

### Folgeentscheidungen

- **Entschieden** 2026-11-06 durch den product-owner (`AI-Team/po-entscheidungen.md:107–108`, Commit `679216a`): Ich-Pop ist Menü (`menuitemradio` mit `aria-checked`); Board-, Lauf- und Defekte-Dateien-Pop sind nicht-modale Fenster (`role=dialog` ohne `aria-modal`). Für diese gilt in der Fokusführung: Ebene ohne Falle und **ohne `inert`** darunter, Startziel erstes tabbares Element, Tab hinter dem letzten bzw. Umschalt+Tab vor dem ersten schließt den Pop (weiter hinter bzw. auf den Auslöser), Esc schließt mit Rückgabe an den Auslöser, Live-Ereignis lässt den Fokus im Pop. Regel für künftige `#pop`: nur Einträge ⇒ Menü, sonst nicht-modales Fenster.
- Ob Hilfe und Zuweisen über dem Fenster das Fenster schließen oder stapeln — heute stapeln sie; die Fokusführung trägt beides.

## Nachtrag 2026-11-06: gebauter Stand (R00106)

**Anlass**: Karte #8 ist nach [R00106](../../Anforderungen/R00106-fokus-in-fenstern-und-menues.md) gebaut und reviewt (kanbanD `429c1e2`). Die Wahl — Option B, eine Fokusführung über Ebenen am Ende von `render()` — gilt unverändert, der Status bleibt `Akzeptiert`. Der Bau weicht in Einzelheiten vom Text der Entscheidung ab; sie stehen hier, belegt am Code, statt den Text oben umzuschreiben (Skill `adr-vorlage`: nicht überschreiben). Kontext-Anforderung ist damit R00106.

### N1 Modul `web/fokus.js` und Radiogruppen

- Eine Ebene ist `{ art, selektor, start, rueckgabe, modal, fenster }` (`web/fokus.js:1–2`): `start` ist ein Selektor oder eine Liste in Rangfolge (oder `null` — dann greift der Rückfall Rang 6), `rueckgabe` eine **Liste** von Selektoren, `modal` wahr nur für Dialoge, `fenster` wahr nur für die nicht-modalen Pop-Fenster (Board, Lauf, Defekte Dateien; `web/fokus.js:30`, `:35`).
- Signatur `ebenen(ui, gemerkt = {})` (`web/fokus.js:58`): `gemerkt` ordnet je `art` den Selektor des Auslösers beim Öffnen zu; der Kleber hält die Zuordnung (`gemerkteAusloeser`, `web/app.js:605`). Stapel von unten nach oben: `fenster`, `neu`, `defekt`, `zuweisen`, `hilfe`, darüber `pop`, darüber `kmenue` (`web/fokus.js:41–63`). Startziele: Fenster und Hilfe auf sich selbst, Menüs auf den ersten wählbaren Eintrag, das Ich-Menü zuerst auf den gewählten Menschen (`web/fokus.js:32`, `:36`), das Kontextmenü auf den aktiven Eintrag.
- Weitere Exporte: `fensterRand(anzahl, index, rueckwaerts)` → `'ausloeser' | 'nach-ausloeser' | 'weiter'` für Tab am Rand eines Pop-Fensters (`web/fokus.js:75–79`, angewandt in `fensterRandTaste`, `web/app.js:553–561`); `kmenueEintrag(menue)` → Selektor des aktiven Kontextmenü-Eintrags, im offenen Untermenü dessen Eintrag (`web/fokus.js:52–55`); `GESICHERT` als Platzhalter des Sicherers in der Zielliste.
- `fokusZiel(lage)` (`web/fokus.js:83–92`) liefert **eine Liste** von Zielen in Rangfolge, nicht ein Ziel; der Kleber setzt das erste, das sich setzen lässt (`fokusFuehren`, `web/app.js:644–648`). `lage` trägt zusätzlich `oberste` und `fuehrung`: nach dem Startziel der geöffneten Ebene steht das Startziel der obersten offenen Ebene (deckt den Wechsel zwischen zwei Pops, N3), und `fuehrung` (Rang 5) zählt nur, wenn keine Ebene offen ist.
- Radiogruppen: `radioSchritt(anzahl, index, taste)` in `web/tastatur.js:60–70` (→↓ vor, ←↑ zurück, Umlauf, ohne Wahl erstes bzw. letztes), angewandt in `radioTaste` (`web/app.js:510–523`); den Tab-Halt setzt der Kleber je Neuzeichnen (`radiogruppenFuehren`, `web/app.js:501–507`), den Fokus nach der Wahl `gewaehltesRadioFokussieren` (`web/app.js:526–530`). `naechsterReiter` ist davon unberührt.
- Die Zieltermin-Markierung `tm-ziel` (Fever Chart) ist kein Radio mehr, sondern ein Knopf mit `aria-pressed` (`web/ansicht.js:878`; R00106 Z. 96).

### N2 Rang 5: `fokusKarte`/`fokusZeile` folgen dem echten Fokus

- „Wie heute“ heißt im Bau: `fokusKarte`/`fokusZeile` ist die **zuletzt echt fokussierte** Karte bzw. Zeile — gleich ob per Tastatur, Tab, Klick oder Skript. Ziel daraus: `fuehrungsziel()` (`web/app.js:652–656`).
- **Zwei Schreibwege**: (1) Aktionen und Tastenzweige setzen den Wert ausdrücklich (z. B. `web/app.js:414`, `:1048`, `:1119`, `:1707`, `:1783`); (2) der `focusin`-Hörer `fuehrungNachziehen` zieht ihn bei jedem Fokuswechsel auf eine Karte oder Zeile nach (`web/app.js:1333–1340`). Steht der Fokus vor dem Neuzeichnen auf einer Karte oder Zeile, übergeht `render()` den Sicherer (`zielGefuehrt`, `web/app.js:450–452`) — dort ist die Führung das Ziel.
- Folge: ein Live-Ereignis führt nach einem Klick auf eine Karte auf diese Karte zurück, nicht auf die zuletzt per Pfeil geführte. Wer einen dritten Schreibweg einführt, muss ihn hier nennen.

### N3 Rang 3: Rückgabeziel und Ebenen-Identität

- Geöffnet und geschlossen wird über den Vergleich der **`art`** der Ebenen vor und nach dem Neuzeichnen (`fokusFuehren`, `web/app.js:631–637`). Für Fenster und Defekt-Fenster ist das Rückgabeziel die Karte bzw. Zeile der **offenen** Aufgabe (`ui.offen`, `ui.offenDefekt`; `ortDerAufgabe`, `web/fokus.js:9–13`), danach der gemerkte Auslöser — nicht `fokusKarte`/`fokusZeile`. Ein eigenes Ziel `#main` gibt es nicht; findet keine Rangstufe ein Ziel, setzt der Rückfall das erste tabbare Element der obersten Ebene bzw. von `#main` (`ersterTabbarer`, `web/app.js:680–684`).
- Wechselt ein offenes Pop in ein anderes (etwa Mehr → Boards), bleibt die `art` `pop`: für den Vergleich ist nichts geöffnet oder geschlossen. Der Kleber gleicht das aus: `popGewechseltDurch` (`web/app.js:607–616`) erkennt über `vorigerPop` den Wechsel durch den eigenen Auslöser des neuen Pops (`#pop[data-for]`) und merkt diesen als Rückgabeziel (`web/app.js:634–635`); das Startziel kommt über `oberste` (N1).
- **Offene Folgeentscheidung**: Identität einer Ebene als `art` + Pop-Name (`ui.pop`) in `web/fokus.js`, damit der Ausgleich im Kleber entfällt und rein testbar wird. Nicht entschieden; heute trägt der Ausgleich, abgesichert durch den E2E-Test „S2“ (`e2e/tests/r00106-fokus.spec.js:842`).
- **Folgeentscheidung, entschieden** 2026-11-06 durch den product-owner (`AI-Team/po-entscheidungen.md:110`): der Pop → Pop-Ausgleich bleibt im Kleber (`popGewechseltDurch`, `vorigerPop`), abgesichert durch den E2E-Test „S2“; keine eigene Karte. Die Umstellung der Identität auf `art` + Pop-Name in `web/fokus.js` wird erst Arbeit, wenn ein Befund am Pop-Wechsel auftritt oder eine neue Ebene einen zweiten Ausgleich im Kleber bräuchte — dann in der Karte, die das auslöst. Akzeptierte Schwäche: der Fall bleibt nur per E2E, nicht per Node-Unit prüfbar.

### N4 Menüs: Fokus per Skript, kein Tab-Halt

Statt roving `tabindex` gilt im Bau (R00106 „Menüs“, Z. 55–68; APG Menu Button: Einträge sind nicht in der Tab-Folge):

- Alle wählbaren Einträge tragen `tabindex="-1"`; der Fokus kommt nur per Skript dorthin (Startziel der Ebene, Pfeile). Das Menü hat **keinen Tab-Halt**: Tab schließt es, der Fokus steht vor der Standardaktion auf dem Auslöser und geht von dort weiter (`popZuMitTab`, `web/app.js:563–569`; Kontextmenü `web/app.js:1603`).
- `#pop`-Menüs: Pfeile, Pos1, Ende über `menueSchritt` auf echtem DOM-Fokus (`popMenueTaste`, `web/app.js:571–585`), Enter/Leertaste lösen Nicht-Knöpfe aus (`eintragAusloesen`, `:534–541`). Einträge mit `aria-disabled="true"` tragen **kein** `tabindex` und werden übersprungen (Ich-Menü, `web/ansicht.js:307`).
- Kontextmenü `#kmenue`: der Index bleibt Zustand in `S.ui.menue.index` bzw. `S.ui.menue.unter.index` (Maus, Kürzel, Untermenü), der DOM-Fokus folgt ihm — jede Taste und jedes Überfahren setzt `S.ui.fokus = kmenueEintrag(m)` und zeichnet neu (`web/app.js:1604–1617`, `:1643–1658`). Alle Einträge tragen `tabindex="-1"`, auch die nicht wählbaren (`aria-disabled`, „aktuell“); die überspringt `menueSchritt` (`web/ansicht.js:492`). Der befürchtete Umbau „vom virtuellen Index auf DOM-Fokus“ ist also ein Nachführen, kein Ersetzen.
- Radiogruppen bleiben roving (ein Tab-Halt je Gruppe, N1).

### N5 Durchsetzung: Wächtertest als Fitness Function

- Die Durchsetzung ist nicht mehr der `grep`, sondern der Wächtertest in `e2e/einheit/fokus.test.js:74–131` (Node-Unit, kein DOM): er ordnet jeden `.focus()`-Aufruf in `web/*.js` seiner umgebenden Funktion bzw. seinem Listener zu und schlägt fehl, wenn diese nicht in der Liste `ERLAUBT` steht (`:78`), oder wenn `.focus()` direkt hinter `render();` steht (`:103–112`); zwei Selbstproben zeigen, dass er beides erkennt (`:123–131`). Dazu prüft er, dass jeder wählbare Menüeintrag in `web/ansicht.js` `tabindex="-1"` trägt und jedes Menü einen Namen hat (`:158–198`). Stand 2026-11-06: 20 von 20 grün.
- `ERLAUBT` enthält neben dem Sicherer (`fokusSetzen`) und dem Kleber (`fokusVersuchen`, `ersterTabbarer`) die Tastenzweige der Fokusführung (`fallenTaste`, `popMenueTaste`, `gewaehltesRadioFokussieren`) **und** pauschal vier ältere Tastenzweige: `fensterTaste` (`web/app.js:1681`), `listenTaste` (`:1706`), `brettTaste` (`:1783`) und den `keydown`-Hörer mit `/` → Filterfeld (`:1534`).
- **Abweichung von R00106 Z. 110, offen**: die Anforderung nennt als erlaubt nur `fokusSetzen`, den Kleber am Ende von `render()` und den keydown-Zweig der Fokusführung. Die vier älteren Zweige sind dort nicht genannt; der Test erlaubt sie je Funktion, nicht je Aufruf, sodass ein neuer `.focus()` in einer dieser Funktionen unbemerkt durchgeht. Ob die Zweige als „keydown-Zweig“ gelten (dann Anforderungstext und ADR angleichen) oder ihr Fokus über `S.ui.fokus` in die Rangfolge gehen soll (dann Umbau und engere Liste), ist **nicht entschieden**.
- **Folgeentscheidung, entschieden** 2026-11-06 durch den product-owner (`AI-Team/po-entscheidungen.md:109`), Option „angleichen“: die vier Tastenzweige `fensterTaste`, `listenTaste`, `brettTaste` und der `/`-Zweig des `keydown`-Hörers (`/` → `#flt`) gelten als keydown-Zweige — sie setzen den Fokus unmittelbar auf eine Taste des Menschen hin, ohne Neuzeichnen dazwischen. R00106 Z. 110 und diese ADR nennen sie namentlich; kein Umbau über `S.ui.fokus`. Damit die Durchsetzung nicht verwässert, zählt der Wächtertest je erlaubter Funktion die `.focus()`-Aufrufe und hält die heutige Zahl fest (heute je einer: `web/app.js:1534`, `:1681`, `:1706`, `:1783`); ein zusätzlicher Aufruf in einer dieser Funktionen macht ihn rot. Umsetzung der Zählung folgt in #8 durch den entwickler; bis dahin prüft der Test je Funktion. Härtung erst, wenn ein Befund zeigt, dass einer dieser Zweige gegen die Rangfolge arbeitet.

### N6 `data-halt`-Schlüssel

Neben `klapp:<spalte>` (`.bk-name` ↔ `.zu-streifen`) und `spalte:<spalte>` (Fläche der Spalte) tragen jetzt `kopf:<spalte>` den Spaltenkopf `.bahn-kopf` (offen und zugeklappt) und `info:<spalte>` das Kommentarzeichen `.info` (`web/ansicht.js:614`, `:629`). Der Sicherer findet sie über `[data-halt=…]` (`web/sichtzustand.js:19–24`).

### N7 Rang 6 nur bei offener Ebene; Rückfall ohne Ebene nie auf ein fremdes Element

**Anlass**: Messung des realist-consultant auf Karte #8 (Kommentar 2026-11-06 06:42, Logbuch `847289a`). Ohne offene Ebene setzt der Rückfall den Fokus nach einem Live-Ereignis auf Einrichten ins Feld „Name“ und auf Personen auf ein Radio einer anderen Gruppe. Entschieden vom product-owner (`AI-Team/po-entscheidungen.md:111`, Commit `5783b4a`). Kriterium in R00106 Z. 101, neuer Wortlaut über den planer.

**Belegt (Code)**: Findet keine Rangstufe ein Ziel, ruft der Kleber `ersterTabbarer(oberste)` auch ohne offene Ebene auf, sobald der Fokus beim Neuzeichnen verloren ging (Bedingung `verloren || geschlossen.length || oberste`, `fokusFuehren`, `web/app.js:650`). Ohne Ebene nimmt `ersterTabbarer` das erste tabbare Element von `#main` (`web/app.js:680–684`, Kommentar „ohne Ebene des Hauptbereichs“). Dieser Fall ist das Feld „Name“ auf Einrichten.

**Warum**: Ein fremdes Eingabefeld schluckt Kürzel als Text. Ein fremdes Radio schaltet bei einer Pfeiltaste still einen Filter um. Beides wirkt auf etwas, das der Mensch nicht gewählt hat und oft nicht sieht (R00106 Z. 30), und beides ist schlimmer als `BODY`, wo nur die Kürzel ausfallen. WCAG 2.4.3 erlaubt keinen Sprung an eine sinnfremde Stelle. Die Ursache der meisten Verluste (Statuszeile und Navigationslinks ohne Schlüssel) behebt [ADR-0007 N1](0007-sichtzustand-uebersteht-das-neuzeichnen.md#nachtrag-2026-11-06-bereiche-umgekehrt-und-href-als-schlüssel-r00106). N7 regelt, was bleibt, wenn das Element wirklich fehlt.

**Entschieden**:

- **Rang 6** („erstes tabbares Element der obersten Ebene“) gilt nur, wenn eine Ebene **offen** ist oder mit diesem Neuzeichnen **geschlossen** wurde. Im zweiten Fall greift er erst, nachdem das Rückgabeziel nach Rang 3 gescheitert ist (N3). *(→ N7a: nur bei nach dem Neuzeichnen offener Ebene)*
- **Ohne offene Ebene** und ohne gerade geschlossene Ebene gilt nach Rang 1 (`S.ui.fokus`) diese Folge:
  1. dasselbe Element, sofern es noch da ist (Sicherer nach ADR-0007, Rang 2);
  2. fehlt es: die zuletzt geführte Karte bzw. Zeile (`fokusKarte`/`fokusZeile`, Rang 5, N2);
  3. sonst `BODY`. Nie ein Eingabefeld, Radio oder anderes Bedienelement, das mit dem vorigen nichts zu tun hat. `ersterTabbarer` wird ohne Ebene nicht mehr aufgerufen.
- „Dasselbe Element“ heißt: das Element mit demselben Schlüssel nach ADR-0007 im selben Bereich. Ein Gegenstück mit gemeinsamem `data-halt` zählt dazu (N6).

**Invariante, neu gefasst** (ersetzt den Satz unter „Durchsetzung“ oben):

> Ist eine Ebene offen, liegt `document.activeElement` nach jedem `render()` in ihr und nie auf `BODY`. Ist keine offen, steht er nach jedem `render()` auf demselben Element wie vorher, sofern es noch da ist; fehlt es, auf der zuletzt geführten Karte bzw. Zeile; sonst auf `BODY`, nie auf einem fremden Eingabefeld oder Bedienelement. Wurde mit diesem `render()` eine Ebene geschlossen, gilt deren Rückgabeziel (Rang 3), danach Rang 6. *(→ N7a: nur bei nach dem Neuzeichnen offener Ebene)*

**Verworfen**:
- Rang 6 unverändert lassen, Wortlaut „nie auf BODY“ behalten: führt nachweislich auf das Namensfeld und fremde Radios (Messung).
- Rückfall auf einen festen „neutralen“ Anker wie `#main` mit `tabindex="-1"`: Dann stünde der Fokus nicht auf `BODY`, aber auf einem Ziel, das der Mensch nicht gewählt hat. Außerdem braucht jede Sicht einen Anker. Nichts gewinnt gegenüber `BODY`, wo die globalen Kürzel ohnehin greifen.

**Testbarkeit**:
- Erster Test (Node-Unit, `e2e/einheit/fokus.test.js`): Der Rückfall geht als Entscheidung in die reine Funktion, etwa als Platzhalter wie `GESICHERT` in der Zielliste von `fokusZiel`. Eingabe ist eine `lage` ohne `oberste` und ohne `geschlossen`, mit `vorher.stand: 'verloren'`. Ausgabe ist eine Zielliste ohne Rückfall-Platzhalter. Mit `oberste` bzw. `geschlossen` steht der Platzhalter am Ende. *(→ N7a: nur bei nach dem Neuzeichnen offener Ebene)* Wie der entwickler das schneidet, ist seine Wahl. Die Bedingung im Kleber muss danach aus dieser Funktion kommen und nicht neben ihr stehen.
- Abnahme als **Abtastraster** statt Beispielen, gemeinsam mit ADR-0007 N1: jedes fokussierbare Element × fünf Sichten (Board, Aufgaben, Personen, Einrichten, Stundenzettel) × 1280 und 375 px, je Element ein fremder Schreibaufruf. Erwartet wird dasselbe Element. Entfernt der Schreibaufruf das Element, steht der Fokus auf der geführten Karte bzw. Zeile, sonst auf `BODY`. Fehlschlag ist jedes `activeElement`, das ein anderes Eingabefeld, Radio oder anderes Bedienelement ist. Einzelproben aus der PO-Entscheidung (Einrichten und Personen: gleiches Element; entfernt mit Führung; entfernt ohne Führung → `BODY`, nie `#name` oder fremdes Radio) sind Fälle dieses Rasters.

**Durchsetzung** (ergänzt): Review-Punkt für architektur-reviewer und code-reviewer: Aufruf von `ersterTabbarer` ohne offene oder gerade geschlossene Ebene ist ein Befund. *(→ N7a: nur bei nach dem Neuzeichnen offener Ebene)*

### N7a Präzisierung: Rang 6 nur bei nach dem Neuzeichnen offener Ebene

**Anlass**: Nachfrage des Directors zu N7 (`05c3d34`). N7 ließ Rang 6 auch für eine gerade geschlossene Ebene gelten, die PO-Entscheidung `AI-Team/po-entscheidungen.md:111` nur bei offener Ebene. Entschieden vom product-owner (`AI-Team/po-entscheidungen.md:113`, Commit `98ed11a`). N7a gilt vor den markierten Stellen in N7.

**Entschieden**:

- Rang 6 („erstes tabbares Element der obersten Ebene“) gilt nur, wenn **nach** dem Neuzeichnen noch eine Ebene offen ist. Er sucht dann in dieser obersten offenen Ebene. Beispiel: Pop über offenem Aufgabenfenster geschlossen, Rückgabe gescheitert → erstes tabbares Element des Fensters.
- Wird die **letzte** Ebene geschlossen und scheitert die Rückgabe an den Auslöser (Rang 3), folgt dieselbe Kette wie ohne offene Ebene: zuletzt geführte Karte bzw. Zeile (Rang 5), sonst `BODY`. Nie das erste tabbare Element der Seite bzw. von `#main`.
- Damit ruft der Kleber `ersterTabbarer` nur mit einer obersten offenen Ebene auf, nie mit `#main` als Bereich. Der Zweig „ohne Ebene des Hauptbereichs“ in `ersterTabbarer` (`web/app.js:680–684`) entfällt.

**Invariante, endgültig** (ersetzt die Fassung in N7):

> Ist nach `render()` eine Ebene offen, liegt `document.activeElement` in der obersten offenen Ebene und nie auf `BODY`. Ist keine offen, auch wenn gerade die letzte geschlossen wurde, steht er auf dem Ziel der ersten Stufe, die greift: ausdrückliches `S.ui.fokus`, dasselbe Element wie vorher, das Rückgabeziel der geschlossenen Ebene, die zuletzt geführte Karte bzw. Zeile; sonst auf `BODY`. Nie auf einem fremden Eingabefeld oder Bedienelement.

**Testbarkeit** (ersetzt die markierten Sätze in N7):
- Node-Unit `fokusZiel`: Rückfall-Platzhalter genau dann am Ende der Zielliste, wenn `lage.oberste` gesetzt ist. Mit `geschlossen` ohne `oberste` steht kein Platzhalter darin, die Liste endet mit Rückgabezielen und ggf. `fuehrung`.
- E2E-Probe aus `:113`: Einrichten bzw. Personen, ein Pop oder Fenster öffnen, den Auslöser während es offen ist entfernen (fremder Schreibaufruf), dann schließen → Fokus auf geführter Karte bzw. Zeile oder `BODY`, nie `#name` oder ein fremdes Radio. Dazu ein Fall mit zwei Ebenen: Pop über Aufgabenfenster, Auslöser entfernt, Pop schließen → Fokus im Fenster.
- Wenn die Führung (Rang 5) bisher nur bei `vorher.stand: 'verloren'` gilt (`fuehrungGilt`, `web/fokus.js:97–100`), muss sie nach dem Schließen der letzten Ebene ebenfalls gelten. Der Fokus lag dann in der Ebene, die entfernt wurde, ist also „verloren“. Das prüft der entwickler am ersten Test.

**Durchsetzung** (ersetzt den Review-Punkt in N7): Aufruf von `ersterTabbarer` ohne oberste offene Ebene ist ein Befund.

### N7b Gebauter Stand zu N7a: Leerfall ohne Auslöser, Pop ohne Element ist zu

**Anlass**: Nacharbeit 3 auf Karte #8 ist gebaut (kanbanD `f8e16e4`, davor `e9e50f5` `href` als Schlüssel und `fb8361c` Sicherer für alle Bereiche nach ADR-0007 N1). Der Bau präzisiert N7a an einer Stelle und schließt eine Geister-Ebene. Beides steht hier belegt am Code. N7a bleibt gültig, wo N7b nichts sagt.

**Belegt (Code)**:
- Rückfall im Kleber (`fokusFuehren`, `web/app.js:651–656`): `ersterTabbarer` sucht in der obersten offenen Ebene, wenn eine offen ist und der Fokus nicht schon in ihr sitzt (`:655`). Ohne offene Ebene sucht es in `#main` nur, wenn die zuletzt geschlossene Ebene eine **leere** `rueckgabe` hat (`ohneAusloeserGeschlossen`, `:654`, `:656`). `ersterTabbarer(bereich)` nimmt jetzt den Bereich statt der Ebene und hat keinen eigenen Rückfall auf `#main` mehr (`:708–711`).
- `rueckgabe` ist leer, wenn beim Öffnen kein Auslöser gemerkt wurde (`ausloeser(gemerkt, art)`, `web/fokus.js:16–19`), also wenn die Ebene aus `BODY` geöffnet wurde. Bei Fenster und Defekt-Fenster steht der Ort der offenen Aufgabe davor (`ortDerAufgabe`, `web/fokus.js:9–13`).
- `popPlatzieren` (`web/app.js:728–738`) läuft in `render()` vor der Fokusführung (`:477–478`). Zeichnet `vPop()` nichts (Lauf-Pop ohne laufenden Timer), setzt es `S.ui.pop = null` (`:732`). Fehlt der Auslöser `#pop[data-for]`, entfernt es zusätzlich den Pop aus dem DOM (`:734`).
- Proben: `e2e/tests/r00106-fokus-rueckfall.spec.js` (neu), `e2e/tests/r00106-fokus-raster.spec.js` (Abtastraster, erweitert).

**Entschieden (gebaut)**:

1. **Rang 6 ohne offene Ebene, Leerfall**: Ist nach dem Neuzeichnen keine Ebene offen, gilt das erste tabbare Element von `#main` nur, wenn die zuletzt geschlossene Ebene **nie einen Auslöser hatte**, also `rueckgabe` leer ist. Das ist der Leerfall aus R00106 Z. 142: Board frisch geladen, Fokus auf `BODY`, `n`, dann Esc → Fokus auf `#main` oder einem Element darin. Es gibt dort nichts zurückzugeben, und `BODY` wäre der Zustand vor dem Öffnen. Das Ziel stammt aus keiner früheren Lage und ist deshalb kein „fremdes“ Element im Sinn von N7.
2. **Rückgabe gescheitert, weil der Auslöser fort ist**: Hatte die Ebene einen Auslöser und ist er nach dem Neuzeichnen nicht mehr da, gilt die Kette aus N7a: zuletzt geführte Karte bzw. Zeile, sonst `BODY`, nie das erste tabbare Element von `#main` (PO `AI-Team/po-entscheidungen.md:113`).
3. **Pop ohne Element ist zu**: Ein Pop, für den `vPop()` nichts zeichnet oder dessen Auslöser fehlt, ist auch im Zustand geschlossen (`S.ui.pop = null`). Die Fokusführung rechnet dann nicht mit einer Ebene, die es auf dem Schirm nicht gibt. Sonst stünde Rang 6 „in der obersten Ebene“ ohne Element da, und Tab und Esc liefen ins Leere. Weil `popPlatzieren` vor `fokusFuehren` läuft, sieht die Fokusführung im selben `render()` schon den geschlossenen Zustand.

**Invariante** (ergänzt die Fassung in N7a um einen Satz): Wurde die letzte Ebene geschlossen und hatte sie nie einen Auslöser, steht der Fokus nach `render()` auf dem ersten tabbaren Element von `#main` bzw. in `#main`. Eine Ebene ohne gezeichnetes Element ist nicht offen.

**Abweichung von N7/N7a, offen**: Die Entscheidung über den Rückfall steht weiter im Kleber (`web/app.js:654–656`) und nicht als Platzhalter in der reinen Funktion `fokusZiel`, wie N7 und N7a vorschlugen. Sie ist damit nur per E2E prüfbar (`r00106-fokus-rueckfall.spec.js`), nicht per Node-Unit. Ob sie nach `web/fokus.js` wandert, ist nicht entschieden. Vorschlag: so lassen, bis ein Befund am Rückfall auftritt (gleiche Regel wie für die Ebenen-Identität in N3).

**Durchsetzung** (ersetzt den Review-Punkt in N7a): Aufruf von `ersterTabbarer` ohne oberste offene Ebene ist ein Befund, außer mit `#main` im Leerfall (`ohneAusloeserGeschlossen`). Ein Pop-Zustand ohne gezeichneten Pop ist ein Befund.

## Nachtrag 2026-11-12 N8: die Artenliste der Ebenen ist gewachsen (`fenstermenue`, `aldialog`)

**Anlass**: Modell-Nachzug aus dem Architektur-Review #144/#145 (S1/O3, 2026-11-12). Die Entscheidung oben zählt die Arten der Fokusebenen auf; zwei Arten sind seither dazugekommen, ohne dass es hier stand: `fenstermenue` mit dem Menü des Aufgabenfenster-Kopfes (R00144/R00145, [ADR-0018 N2](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md)) und `aldialog` mit dem geteilten Bestätigungsfenster für Board und Aufgabe (R00128/R00141). Die Wahl dieser ADR — Ebenen mit Startziel und Rückgabe, ein Modul `web/fokus.js` — gilt unverändert, der Status bleibt `Akzeptiert`. Der Text oben wird nicht umgeschrieben (Skill `adr-vorlage`); er trägt bei der Artenliste die Marke *(→ N8)*.

**Belegt (Code)**, kanbanD `b58a497` (gelesen 2026-11-12):
- `ebenen(ui, gemerkt)` baut den Stapel in `web/fokus.js:61–68`: zuerst der Dialogstapel `dialogstapel` (`:43–51`) mit `fenster`, `neu`, `defekt`, `zuweisen`, `hilfe`, danach `fenstermenue` (`:63`), `pop` (`:64`), `aldialog` (`:65`) und `kmenue` (`:66`). Von unten nach oben sind das neun Arten.
- `fenstermenue` steht nur, solange ein Kopf-Menü offen und das Fenster offen ist (`ui.fensterMenue && ui.offen && !ui.setup`); Selektor `#fenster [role="menu"]`, Startziel der gewählte Eintrag (`GEWAEHLTER_MENUEEINTRAG`), Rückgabe über `ausloeser(gemerkt, 'fenstermenue')`. Zustand `S.ui.fensterMenue` (`web/app.js:2`), gesetzt im Zweig `case 'fenster-menue'` und gelöst in `case 'fenster-ansicht'` (`:1340–1350`), Tasten in `fensterMenueTaste` (`:2464–2472`).
- `aldialog` ist das geteilte Bestätigungsfenster vor dem Archivieren bzw. endgültigen Löschen (`#al-dialog`, `role="alertdialog"`, `aria-modal`, `web/ansicht.js:444–448`; Startziel `#al-abbrechen`), für das Board (`boardAlDialog`, `web/app.js:1121–1136`) und das Aufgabenfenster (`dialogAufgabeLoeschen`, `:1188–1200`). Er liegt über `pop` und unter `kmenue`.
- N1 (`:107`) und N7 beschreiben den Stapel vom Stand 2026-11-06 und sind damit unvollständig, nicht falsch.

**Entschieden (festgehalten, nicht neu entschieden)**:

1. **Die Artenliste gilt fortgeschrieben**: `fenster`, `neu`, `defekt`, `zuweisen`, `hilfe`, `fenstermenue`, `pop`, `aldialog`, `kmenue` — in dieser Reihenfolge von unten nach oben, wie `ebenen()` sie baut. Maßgeblich bleibt der Code; diese Liste ist seine Lesefassung.
2. **`fenstermenue` ist ein Menü im Fenster, kein `#pop`.** Das ist [ADR-0018 N2](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md) Punkt 5; hier steht nur, wo die Art im Stapel liegt. Ein Kopf-Menü als `#pop` neben dem Dialog bleibt eine Abweichung.
3. **`aldialog` bleibt eine eigene Art** und keine Form von `fenster`: er ist modal, hat ein Bestätigungswort und liegt über dem Pop.

**Durchsetzung** (ergänzt): Review-Punkt für `architektur-reviewer` und `code-reviewer` — eine Art in `ebenen()` (`web/fokus.js`), die in dieser Liste fehlt, ist ein Befund; ebenso ein Kopf-Menü, das als `pop` statt als `fenstermenue` geführt wird. Die Probe der Karte #8 (`e2e/einheit/fokus.test.js`) zählt die Ebenen je Zustand; neue Proben der Karten #144/#145: `e2e/tests/r00144-kopf-aktionen.spec.js`, `e2e/tests/r00145-ansichtsmenue.spec.js`.

**Grenze**: Dieser Nachtrag hält nur den gebauten Stapel und die zwei gewachsenen Arten fest. Form, Beschriftung und Tasten der beiden Kopf-Menüs sind Sache der Anforderungen R00144/R00145; `aldialog` selbst ist mit R00128/R00141 gebaut und hier nur als Art benannt.

## Nachtrag 2026-11-15 N9: Esc im Bearbeitungsmodus eines Fensterfelds verwirft und schreibt nie

**Anlass**: Karte #54 (Paket „Aufgabenfenster: Felder und Fenstermeldung“), Entscheidung des Betreibers vom 2026-11-13: Esc verwirft die laufende Eingabe im Titelfeld, Enter speichert weiter.

**Belegt (Code, kanbanD `0f495c9`)**: Die Esc-Kaskade endet bei offenem Aufgabenfenster in `if (S.ui.offen) { … t.blur(); S.ui.offen = null; … }` (`web/app.js:2496`). `blur()` löst im geänderten Feld synchron `change` aus, der `change`-Hörer ruft `aufgabeAendern` (`web/app.js:2287–2296`), dazu trägt `focusout` einen zurückgesetzten Wert nach (`aenderungNachtragen`, `web/app.js:2206`, `web/sichtzustand.js:139–143`). Esc speichert also den Titel **und** schließt das Fenster. Die Stelle ist das Aufgabenfenster (`[data-af="titel"]` im Zustand `titelBearbeiten`, `web/ansicht.js:358–360`); das Umbenennen auf der Karte verwirft schon (`web/app.js:2493`, ohne `blur`). Vorbild im selben Fenster: die Teilaufgabe im Bearbeiten (`teilEdit`, `web/app.js:2494`) — Esc beendet nur den Modus und gibt den Fokus an den Text zurück. Nicht erprobt, nur gelesen.

**Gebaut** (R00155, I0142, Zweig `karte/54`, Code-Stand `20cb14e`; am 2026-11-15 am Code gegengelesen, nicht erneut erprobt — die Messungen stehen in den Bau-Commits `bff6f7f`, `fb8efa3`, `20cb14e`): Der Absatz „Belegt“ oben nennt den Stand vor dem Bau. Die Regel ist die reine Funktion `verwerfung(feld)` (`web/sichtzustand.js:183–195`, Enter-Felder `ENTER_FELDER` `:175`; Unit `e2e/einheit/entwurf.test.js`), angewandt in `verwerfbares` und `eingabeVerwerfen` (`web/app.js:799–827`). Der Esc-Zweig steht in der Kaskade vor dem Schließen (`web/app.js:2676`, Schließen `:2677`). Die Ziffern 1 bis 6 sind gebaut wie entschieden. Aus Bau und Nacharbeit stammen in Ziffer 4 der Punkt „Kein Entwurf“, das Feld `#km-inp` und die berichtigte Aussage zur Zeitkorrektur, dazu die Ziffern 7 und 8 und die Vermerke „Vorsorge“ in der Durchsetzungstabelle. Die Wahl ist unverändert, der Status bleibt `Akzeptiert`.

**Entschieden**:

1. **Der Bearbeitungsmodus des Titels ist für Esc die innerste Sache.** Esc im Titelfeld beendet `titelBearbeiten`, das Fenster bleibt offen, der Fokus geht an den Auslöser `[data-act="titel-bearbeiten"]` (Rang 1, `S.ui.fokus`). Erst ein zweites Esc schließt das Fenster. Der Zweig steht in der Kaskade vor `S.ui.offen`, wie `teilEdit`.
2. **Esc löst keinen Schreibweg aus.** Vor dem Verlassen wird der Feldwert auf den gezeichneten Stand zurückgesetzt und das Feld als gemeldet abgehakt (`aenderungGemeldet`), sodass weder das native `change` noch `aenderungNachtragen` feuert. Kein `PATCH`, kein Commit, „gespeichert …“ im Fuß bleibt, wie es war.
3. **Esc räumt den Entwurf des Felds** ([ADR-0015 N2](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md)): ein abgelehnter Titel und die an ihn gebundene Fenstermeldung verschwinden mit dem Verwerfen.
4. **Eine Esc-Regel für das ganze Aufgabenfenster** (product-owner 2026-11-15, `AI-Team/po-entscheidungen.md`, Fragen 1 und 2 zu #54; ersetzt die erste Fassung „Grenze: nur das Titelfeld“ vom selben Tag, vor dem Bau). Esc tut je Druck genau eines, das Innerste zuerst: Hat das fokussierte Textfeld einen **Entwurf** oder einen Bearbeitungsmodus, verwirft bzw. verlässt Esc ihn und das Fenster bleibt offen; sonst schließt Esc das Fenster wie bisher. Ziffer 2 und 3 gelten für jedes dieser Felder.
   - **Entwurf** heißt: der Feldwert weicht vom gezeichneten Stand ab (getippt, oder nach einem Neuzeichnen zurückgesetzt und noch `ungemeldet`, `web/sichtzustand.js:124–127`), oder das Feld trägt die abgelehnte Eingabe aus [ADR-0015 N2](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md).
   - **Kein Entwurf** ist eine abgeschickte, noch unbeantwortete Eingabe: Esc nimmt sie nicht zurück und schließt das Fenster wie ohne Eingabe (gebaut `4d8ffd9`, R00155 54-10; Zustand `abgeschickteFelder`, `web/app.js:770–780`, geprüft in `verwerfbares` `:819`). Der Zustand führt nur Feldnamen, keinen Wert. Ebenso wenig ist ein unveränderter Bearbeitungsmodus ein Entwurf: Esc verlässt ihn, der Knopf aus Ziffer 7 tut dort nichts.
   - **Felder, die beim Verlassen schreiben** (`data-af`, `change`-Hörer `web/app.js:2417–2468`): Titel (Modus `titelBearbeiten`, Ziffer 1), Beschreibung (`#beschreibung`; mit Modus `beschreibungBearbeiten`, wenn schon Text da ist — dann zurück ins Lesediv, Fokus auf `[data-act="beschreibung-bearbeiten"]`; ohne Text bleibt das Feld und behält den Fokus), Labels (kein Modus: Wert zurück, Fokus bleibt im Feld).
   - **Felder, die nur auf Enter schreiben** (Liste `ENTER_FELDER`, `web/sichtzustand.js:175`: `#herkunft-neu`, `#teil-neu`, `#zeit-neu` und „Neuer Kommentar“ `#km-inp` — das vierte nach R00155 54-15, product-owner 2026-11-15): ihr gezeichneter Stand ist leer; steht Text oder eine abgelehnte Eingabe darin, leert Esc das Feld und nimmt die an es gebundene Meldung mit, der Fokus bleibt. Sie schreiben bei Esc schon heute nicht; neu ist nur, dass das Fenster beim ersten Esc offen bleibt. Der product-owner nennt sie nicht einzeln, sein Satz „jedes Textfeld mit Entwurf“ schließt sie ein.
   - **Unberührt**: Spalte und Klasse (`<select>`, schreiben mit der Auswahl), Fällig (`<input type="date">`, schreibt mit jedem vollständigen Datum und über die Schnellknöpfe; ein halb getipptes Datum hat keinen Wert), „Geschätzt“ (nur Anzeige, `web/ansicht.js:376`) — kein Entwurf, Esc schließt. `teilEdit` behält seinen eigenen Zweig (`web/app.js:2674`).
   - **Zeitkorrektur, außerhalb dieses Pakets** (berichtigt; die erste Fassung sagte „`zeitEdit` behält seinen eigenen Zweig“): Der Tastenhörer hat keinen Esc-Zweig für die Zeitkorrektur (`#z-beginn`, `#z-ende`, `web/ansicht.js:443`). Die Felder stehen nicht in `ENTER_FELDER` und tragen kein `data-af`, also schließt dort das erste Esc das Fenster wie vor #54; der Fußtext stimmt an dieser Stelle nicht. Das ist Bestand und in R00155 in Kauf genommen. Der Umbau liegt bei Karte #141 „Tastatur und Fokus“ (Kommentar des product-owner 2026-11-15).
   - **Enter und das Verlassen des Felds speichern weiter.** Der Schließen-Zweig behält sein `blur()`. Er wird erreicht, wenn das fokussierte Feld keinen Entwurf hat oder seine Eingabe abgeschickt ist, und schreibt aus diesem Feld nichts mehr. Die eine Ausnahme steht in Ziffer 7: Ruht der Fokus auf „Eingabe verwerfen“, holt das Schließen das Verlassen des Felds davor nach.
5. **Verhältnis zu ADR-0015 N2 (ein Entwurf je Fenster)**: kein Widerspruch. N2 hält die *abgelehnte* Eingabe im Zustand, die Esc-Regel wirkt auf das *fokussierte* Feld. Nennt der Entwurf aus N2 dieses Feld, räumt Esc ihn samt Meldung (Ziffer 3); nennt er ein anderes Feld, bleiben Entwurf und Meldung stehen. Ein zweiter Zustand für „getippt, noch nicht gesendet“ entsteht nicht — das ist der Feldwert im DOM, den ADR-0007 über das Neuzeichnen trägt.
6. **Karte #161** (Stift an der Beschreibung) entscheidet die Regel nicht neu; sie ändert nur das Rückgabeziel der Beschreibung auf ihren neuen Einstieg.
7. **Das Verlassen eines Felds wirkt erst, wenn das Fokusziel feststeht** (gebaut `fb8efa3`, R00155 54-12 und 54-13; Muss des ux-reviewer, product-owner 2026-11-15). Der Fensterfuß trägt den Knopf „Eingabe verwerfen“ (`[data-act="eingabe-verwerfen"]`, `web/ansicht.js:343`) für alle, die keine Esc-Taste haben. Er geht denselben Weg wie Esc im selben Feld und schließt das Fenster nie. Er wirkt auch, wenn er ohne Zeiger ausgelöst wird, nachdem der Fokus auf ihn gewandert ist (so löst Hilfstechnik ihn aus). Dafür gilt:
   - Das `change`, das der Browser beim Verlassen eines Textfelds des Fensters meldet, speichert nicht selbst. Es kommt vor dem `focusout` und kennt das Fokusziel nicht, also wird es aufgeschoben (`meldetBeimVerlassen`, `web/app.js:2412–2420`; `aenderungAufschieben`, `web/sichtzustand.js:142–144`). Gespeichert wird erst im `focusout` danach (`feldVerlassen` ruft `aenderungNachtragen`, `web/app.js:2355–2368`, `web/sichtzustand.js:147–153`).
   - Geht der Fokus von einem Feld mit Entwurf auf den Knopf, gilt das Feld als **nicht verlassen** (`wartetAufVerwerfen`, `feldVorDemVerwerfen`, `web/app.js:832–842`). Sein Entwurf ist dann weder gespeichert noch verworfen. Löst der Knopf aus, verwirft er ihn wie Esc, und der Fokus steht am Ort wie nach Esc im selben Feld (`eingabeVerwerfenPerKnopf`, `:854–862`; `eingabeVerwerfen`, `:807–809`).
   - **Folge**: Ruht der Fokus mit Entwurf auf dem Knopf und das Fenster zeichnet neu oder wird geschlossen, wird der Entwurf gespeichert, nie still verloren. Dasselbe gilt, wenn der Fokus ohne Auslösen weitergeht. Das Verlassen wird in allen drei Fällen nachgeholt (`verlassenNachholen`, `:845–849`; Aufrufe in `render()` `:934`, im Schließen-Zweig `:2677` und im `focusout` des Knopfs `:2358–2362`). Kehrt der Fokus ins selbe Feld zurück, wurde es nie verlassen.
   - Mit Zeiger nimmt der Knopf dem Feld den Fokus gar nicht (`mousedown` mit `preventDefault`, `:2475–2477`).
   - `feldVorDemVerwerfen` ist ein Verweis auf ein Element, kein Wert. Der Entwurf bleibt der Feldwert im DOM (Ziffer 5), ein zweiter Halter entsteht nicht.
8. **Enter trägt die Änderung nach** (gebaut `e5a5c58`, R00155 54-14). Enter in `INPUT[data-af]` (Titel, Labels) ruft `aenderungNachtragen` (`web/app.js:2636`). Das gilt auch, wenn ein fremdes Neuzeichnen den getippten Wert in ein neues Feld gerettet hat und der Browser dafür kein `change` meldet. Trägt Enter nach, entfällt das eigene `change` des Browsers, sonst speicherte Enter zweimal. „Enter speichert weiter“ (Betreiber 2026-11-13) gilt damit auch nach einem Live-Ereignis. Ohne diese Regel verwürfe das folgende Esc, was Enter speichern sollte.

**Durchsetzung**: E2E am Aufgabenfenster — Titel ändern, Esc: Fenster offen, alter Titel sichtbar, Fokus auf „Titel bearbeiten“, Datei und `git log` unverändert, kein `PATCH` im Netzwerkprotokoll; zweites Esc schließt und gibt an die Karte zurück (Rang 3). Gegenprobe Enter speichert. Mutant, der am Titel rot werden muss: Zweig hinter `S.ui.offen` (Fenster schließt beim ersten Esc). Der Mutant „ohne Zurücksetzen des Werts“ wird am Titel nicht rot, nur an Labels (Tabelle unten).

**Durchsetzung je Feldart** (ergänzt nach Ziffer 4; alle Proben messen: Fenster offen, kein `PATCH`/`POST` im Netzwerkprotokoll, Datei und `git log` unverändert, Fokus am genannten Ort; danach schließt ein zweites Esc):

| Feldart | Probe | Mutant, der rot werden muss |
|---|---|---|
| Modusfeld (Titel; Beschreibung mit Text) | ändern, Esc → alter Text im Lesediv, Fokus auf dem Bearbeiten-Auslöser; unverändert im Modus, Esc → Modus zu, Fenster offen | Zweig hinter `S.ui.offen` (Fenster schließt; M-54b). Das Zurücksetzen des Werts ist hier **Vorsorge**, kein Mutant: der Modus endet, und `render()` ersetzt das Feld durch das Lesediv, ohne dass ein `change` entsteht. Gemessen am Titel (M-54a: 54-1 grün, `bff6f7f`); rot wird dort erst „`blur()` statt Zurücksetzen“ |
| Feld ohne Modus, schreibt beim Verlassen (Labels; Beschreibung ohne Text) | ändern, Esc → alter Wert im Feld, Fokus im Feld; unverändert, Esc → Fenster schließt; nach einem Live-Ereignis während des Tippens Esc, dann Tab → nichts geschrieben (54-5) | Zweig ohne Zurücksetzen des Werts (Esc speichert; M-54a, 54-4 rot). `aenderungGemeldet` nach dem Zurücksetzen ist **Vorsorge**, kein Mutant: `aenderungNachtragen` sendet nur, wenn der Wert noch vom gezeichneten Stand abweicht (`geaendert`, `web/sichtzustand.js:97–100`, `:147–153`), nach dem Zurücksetzen also ohnehin nichts. Gleichwertig gemessen (M-54c: 54-5 grün, `bff6f7f`, `20cb14e`) |
| Enter-Feld (`#herkunft-neu`, `#teil-neu`, `#zeit-neu`, `#km-inp`) | Text tippen, Esc → Feld leer, Fokus im Feld; leer, Esc → Fenster schließt; nach Ablehnung („X1“, „abc“), Esc → Feld leer, Meldung fort, `aria-invalid` fort | Entwurf aus ADR-0015 N2 bei Esc nicht geräumt (abgelehnter Wert steht nach dem Neuzeichnen wieder im Feld) |
| Feld ohne Entwurf (Spalte, Klasse, Fällig) | Fokus im Feld, Esc → Fenster schließt, nichts geschrieben | Esc-Regel greift für jedes `INPUT/SELECT` (Fenster bleibt offen) |
| Gegenprobe | Enter im Titel, Verlassen von Labels und Beschreibung speichern wie bisher | Verwerfen auch beim Verlassen |
| Knopf „Eingabe verwerfen“ ohne Zeiger (Ziffer 7; `e2e/tests/r00155-eingabe-verwerfen.spec.js:239`) | Entwurf in Labels, Titel, Beschreibung, „Neue Herkunft“; `knopf.focus(); knopf.click()` → wie Esc im selben Feld, nichts geschrieben. Gegenproben: Tab aus Labels speichert; Fokus ruht auf dem Knopf und das Fenster zeichnet neu, wird mit Esc geschlossen oder der Fokus geht weiter → Entwurf gespeichert | Knopf nimmt dem Feld den Fokus (echter Tipp; M-54g). Für das Auslösen ohne Zeiger kein eigener Mutant: der Stand vor dem Fix war rot (6 Proben, `fb8efa3`) |
| Enter nach fremdem Neuzeichnen (Ziffer 8; `e2e/tests/r00155-esc-verwirft.spec.js:136`) | Titel bzw. Labels tippen, fremde Änderung zeichnet neu, Enter → gespeichert, genau ein Commit; Esc danach verwirft nichts und schließt | kein eigener Mutant: der Stand vor dem Fix war rot (R00155 P-1) |

## Quellen / Bezüge

- [ADR-0007: Sichtzustand übersteht das Neuzeichnen](0007-sichtzustand-uebersteht-das-neuzeichnen.md)
- Modell: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
- WAI-ARIA Authoring Practices: Dialog (Modal), Menu Button, Radio Group, Tabs
- Nachtrag N8: Karten #144/#145 ([R00144](../../Anforderungen/R00144-aufgabenfenster-kopf-aktionen-im-menue.md), [R00145](../../Anforderungen/R00145-aufgabenfenster-ansichtsmenue-anhaenge-im-inhalt.md), gebaut `ef4249e`/`ffdcb91`), [ADR-0018 N2](0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md), R00128/R00141 (Bestätigungsfenster `aldialog`); `web/fokus.js:43–51`, `:61–68`, `web/app.js:1121–1136`, `:1340–1350`, `:2464–2472`, `web/ansicht.js:444–448`; Proben `e2e/tests/r00144-kopf-aktionen.spec.js`, `r00145-ansichtsmenue.spec.js`, `e2e/einheit/fokus.test.js`
- `web/app.js:431–498`, `:514`, `:1079–1080`, `:1281–1400`, `:1456–1463`; `web/ansicht.js` wie im Kontext; `web/menue.js` (`menueSchritt`); `web/tastatur.js` (`naechsterReiter`); `web/sichtzustand.js`
