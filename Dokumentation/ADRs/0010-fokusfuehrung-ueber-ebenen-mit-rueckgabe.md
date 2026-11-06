# ADR-0010: Fokusführung über Ebenen — eine Stelle nach dem Neuzeichnen führt Fokusfalle, Menüfokus und Rückgabe an den Auslöser

**Status**: Akzeptiert
**Datum**: 2026-11-06
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #8)
**Kontext-Anforderung**: — (Karte #8 „Fokus in Fenstern und Menüs führen und nach jeder Aktion halten“, Anforderung folgt über den planer)
**Erprobt durch**: headless Chromium-Probe 2026-11-06 (Scratchpad, nicht versioniert): `inert` gegen natives `<dialog>.showModal()` unter `innerHTML`-Neuzeichnen, siehe Kontext

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

- `ebenen(ui)` → Liste der offenen Ebenen von unten nach oben, je Ebene `{ art, selektor, rueckgabe }` (Arten: `fenster`, `defekt`, `neu`, `hilfe`, `zuweisen`, `pop`, `kmenue`);
- `fallenSchritt(anzahl, index, rueckwaerts)` → Index des nächsten tabbaren Elements mit Umlauf;
- `fokusZiel(lage)` → das eine Ziel nach `render()` aus `{ ausdruecklich, gesichert, gesichertInOberster, geschlossen, geoeffnet }`.

Rangfolge am Ende von `render()`:

1. ausdrückliches `S.ui.fokus` der Aktion;
2. der Sicherer nach ADR-0007 — **nur**, wenn das wiedergefundene Element in der obersten Ebene liegt;
3. wurde eine Ebene geschlossen: ihr Rückgabeziel — für Aufgaben- und Defekt-Fenster die Karte bzw. Zeile der zuletzt gezeigten Aufgabe (`fokusKarte`/`fokusZeile`), sonst der beim Öffnen gespeicherte Schlüssel des Auslösers (`sichtzustand.schluessel`), sonst `#main`;
4. wurde eine Ebene geöffnet: ihr Startziel — für das Aufgabenfenster **der Dialog selbst** (`tabindex="-1"`, `aria-labelledby`), nicht das Titelfeld, sonst greifen die Fensterkürzel `e`/`s`/`k` und ↑↓ nicht (`ueberallTaste` kehrt in Eingabefeldern zurück); für Menüs der erste wählbare Eintrag;
5. `fokusKarte`/`fokusZeile` wie heute;
6. Fokus auf `BODY` oder in einem `inert`-Bereich: erstes tabbares Element der obersten Ebene.

Regeln für die Bausteine der Oberfläche:

- **Menüs** (`#kmenue`, alle `role=menu` im `#pop`): echter DOM-Fokus, roving `tabindex`, Pfeile über `menueSchritt` (`web/menue.js`; DOM-Einträge abgebildet auf `{ aktuell: aria-disabled }`), Home/End, Esc schließt mit Rückgabe, Tab schließt. Auslöser tragen `aria-haspopup="menu"` und `aria-expanded`.
- **Ein `#pop` ist entweder Menü oder nicht-modaler Dialog**: `role=menu` enthält nur menuitems; was Eingabefelder oder Knöpfe in Zeilen enthält (Board-Pop, Lauf-Pop), ist `role=dialog` ohne Pfeilnavigation. Die Einordnung je Pop ist eine UX-Frage des planers.
- **Radiogruppen**: roving `tabindex` (ein Tab-Halt je Gruppe), Pfeile in alle vier Richtungen mit Umlauf über eine reine Funktion in `web/tastatur.js`; `naechsterReiter` bleibt als Export und darf darauf aufsetzen.
- **Fokus nach Aktionen halten**: Gegenstücke teilen einen `data-halt`-Schlüssel (z. B. `data-halt="klapp:<spalte>"` auf `.bk-name` und `.zu-streifen`), dann findet der Sicherer das Gegenstück ohne neuen Mechanismus; ohne Gegenstück setzt die Aktion `S.ui.fokus`.

## Konsequenzen

### Positiv

- Eine Rangfolge für alle Fokusentscheidungen nach dem Neuzeichnen; Live-Ereignisse ändern den Fokus nicht mehr zufällig.
- ADR-0007 bleibt der eine Wiederfinde-Mechanismus; ADR-0010 sagt nur, **ob** sein Treffer gilt und was gilt, wenn er nichts findet.
- Die Entscheidungen sind reine Funktionen: erster Test `e2e/einheit/fokus.test.js` — Eingabe `S.ui`-Ausschnitt bzw. Lage, Ausgabe Ebenenliste bzw. Ziel, kein DOM, kein Server.

### Negativ

- `#kmenue` wird vom virtuellen Index auf DOM-Fokus umgebaut — die E2E-Tests des Kontextmenüs sind anzupassen.
- `inert` und der Tab-Umlauf sind eigener Code; Browser ohne `inert` (vor 2023) bleiben ungefangen — die Vision fordert keine Altbrowser.
- Das Aufgabenfenster startet auf dem Dialog statt im Titelfeld: ein Tab mehr bis zum ersten Feld. Gewollt, damit die Fensterkürzel greifen.

### Durchsetzung (Makro-Regel)

- **Invariante**: Ist eine Ebene offen, liegt `document.activeElement` nach jedem `render()` in ihr und nie auf `BODY`; ist keine offen, nie auf `BODY`, wenn vorher ein Element fokussiert war.
- E2E-Proben der Karte: 30× Tab und 30× Umschalt+Tab je Dialog bleiben in ihm; Esc gibt an den Auslöser zurück; dieselben Proben mit fremdem Schreibaufruf während des Laufs.
- Review-Punkt für architektur-reviewer und code-reviewer: `.focus()` außerhalb der Fokusführung und der Aktionen über `S.ui.fokus` ist ein Befund. Erkennen: `grep -n "\.focus(" web/*.js` — jede Fundstelle außer `fokusSetzen` (`web/sichtzustand.js`), dem Kleber in `render()` und dem keydown-Zweig der Fokusführung steht als Abweichung in A00009 oder ist ein Befund.

### Folgeentscheidungen

- **Entschieden** 2026-11-06 durch den product-owner (`AI-Team/po-entscheidungen.md:107–108`, Commit `679216a`): Ich-Pop ist Menü (`menuitemradio` mit `aria-checked`); Board-, Lauf- und Defekte-Dateien-Pop sind nicht-modale Fenster (`role=dialog` ohne `aria-modal`). Für diese gilt in der Fokusführung: Ebene ohne Falle und **ohne `inert`** darunter, Startziel erstes tabbares Element, Tab hinter dem letzten bzw. Umschalt+Tab vor dem ersten schließt den Pop (weiter hinter bzw. auf den Auslöser), Esc schließt mit Rückgabe an den Auslöser, Live-Ereignis lässt den Fokus im Pop. Regel für künftige `#pop`: nur Einträge ⇒ Menü, sonst nicht-modales Fenster.
- Ob Hilfe und Zuweisen über dem Fenster das Fenster schließen oder stapeln — heute stapeln sie; die Fokusführung trägt beides.

## Quellen / Bezüge

- [ADR-0007: Sichtzustand übersteht das Neuzeichnen](0007-sichtzustand-uebersteht-das-neuzeichnen.md)
- Modell: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
- WAI-ARIA Authoring Practices: Dialog (Modal), Menu Button, Radio Group, Tabs
- `web/app.js:431–498`, `:514`, `:1079–1080`, `:1281–1400`, `:1456–1463`; `web/ansicht.js` wie im Kontext; `web/menue.js` (`menueSchritt`); `web/tastatur.js` (`naechsterReiter`); `web/sichtzustand.js`
