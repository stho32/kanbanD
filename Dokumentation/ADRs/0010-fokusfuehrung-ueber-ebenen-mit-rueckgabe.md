# ADR-0010: Fokusführung über Ebenen — eine Stelle nach dem Neuzeichnen führt Fokusfalle, Menüfokus und Rückgabe an den Auslöser

**Status**: Akzeptiert
**Datum**: 2026-11-06
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #8)
**Kontext-Anforderung**: — (Karte #8 „Fokus in Fenstern und Menüs führen und nach jeder Aktion halten“, Anforderung folgt über den planer)
**Erprobt durch**: headless Chromium-Probe 2026-11-06 (Scratchpad, nicht versioniert): `inert` gegen natives `<dialog>.showModal()` unter `innerHTML`-Neuzeichnen, siehe Kontext
**Nachträge**: 2026-11-06 — gebauter Stand nach [R00106](../../Anforderungen/R00106-fokus-in-fenstern-und-menues.md) (kanbanD `429c1e2`), siehe [Nachtrag N1–N6](#nachtrag-2026-11-06-gebauter-stand-r00106). Folgeentscheidungen zu N3 und N5 durch den product-owner (`AI-Team/po-entscheidungen.md:109–110`) stehen dort. Der Text oberhalb des Nachtrags ist der Stand der Annahme und bleibt unverändert; Marken *(→ Nn)* zeigen, wo der Bau abweicht.

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

- `ebenen(ui)` *(→ N1)* → Liste der offenen Ebenen von unten nach oben, je Ebene `{ art, selektor, rueckgabe }` (Arten: `fenster`, `defekt`, `neu`, `hilfe`, `zuweisen`, `pop`, `kmenue`);
- `fallenSchritt(anzahl, index, rueckwaerts)` → Index des nächsten tabbaren Elements mit Umlauf;
- `fokusZiel(lage)` → das eine Ziel nach `render()` aus `{ ausdruecklich, gesichert, gesichertInOberster, geschlossen, geoeffnet }`.

Rangfolge am Ende von `render()`:

1. ausdrückliches `S.ui.fokus` der Aktion;
2. der Sicherer nach ADR-0007 — **nur**, wenn das wiedergefundene Element in der obersten Ebene liegt;
3. wurde eine Ebene geschlossen: ihr Rückgabeziel — für Aufgaben- und Defekt-Fenster die Karte bzw. Zeile der zuletzt gezeigten Aufgabe (`fokusKarte`/`fokusZeile`), sonst der beim Öffnen gespeicherte Schlüssel des Auslösers (`sichtzustand.schluessel`), sonst `#main`; *(→ N3)*
4. wurde eine Ebene geöffnet: ihr Startziel — für das Aufgabenfenster **der Dialog selbst** (`tabindex="-1"`, `aria-labelledby`), nicht das Titelfeld, sonst greifen die Fensterkürzel `e`/`s`/`k` und ↑↓ nicht (`ueberallTaste` kehrt in Eingabefeldern zurück); für Menüs der erste wählbare Eintrag;
5. `fokusKarte`/`fokusZeile` wie heute; *(→ N2)*
6. Fokus auf `BODY` oder in einem `inert`-Bereich: erstes tabbares Element der obersten Ebene.

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

- **Invariante**: Ist eine Ebene offen, liegt `document.activeElement` nach jedem `render()` in ihr und nie auf `BODY`; ist keine offen, nie auf `BODY`, wenn vorher ein Element fokussiert war.
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

## Quellen / Bezüge

- [ADR-0007: Sichtzustand übersteht das Neuzeichnen](0007-sichtzustand-uebersteht-das-neuzeichnen.md)
- Modell: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
- WAI-ARIA Authoring Practices: Dialog (Modal), Menu Button, Radio Group, Tabs
- `web/app.js:431–498`, `:514`, `:1079–1080`, `:1281–1400`, `:1456–1463`; `web/ansicht.js` wie im Kontext; `web/menue.js` (`menueSchritt`); `web/tastatur.js` (`naechsterReiter`); `web/sichtzustand.js`
