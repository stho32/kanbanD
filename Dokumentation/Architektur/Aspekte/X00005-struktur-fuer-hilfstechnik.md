---
id: X00005
name: Struktur für Hilfstechnik
art: Aspekt
geltung: Makro
befund: Uneinheitlich
hausantwort: "ADR-0018 (Akzeptiert): Landmarks im Rahmen, eine h1 je Route nur in vHaupt(), Abschnitte h2, Karte listitem in list mit Namen aus kartenName(), aria-current wie die Klasse an, aria-expanded am Klapp-Knopf; Probe über alle Routen"
betrifft:
  - A00009
herkunft: code
quellen:
  - web/index.html
  - web/app.js
  - web/ansicht.js
  - web/markdown.js
  - web/kd-app.css
  - e2e/tests/ziele.spec.js
  - e2e/tests/r00065-mehrfachauswahl.spec.js
  - Anforderungen/R00000-vision.md
---

# Struktur für Hilfstechnik

## Hausantwort

Soll nach [ADR-0018](../../ADRs/0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md) (Akzeptiert, Karte #13), aus der Leitplanke „per Tastatur bedienbar und folgt gewohnten Konventionen“ (`Anforderungen/R00000-vision.md:104`):

- **Landmarks im Rahmen:**
  - `header.kz` (aus `vKopf()`), `main#main` und `footer#stat` gibt es je einmal.
  - Höchstens eine `nav.kz-nav`. Unter 600 px, im Einrichtungsmodus und im ersten Start gibt es keine.
  - Fenster, Menüs und Hinweise liegen in `#over` mit eigener Rolle.
  - Sichten setzen keine weiteren Landmarks.
- **Überschriften:**
  - Genau eine `h1` je Route. Sie entsteht nur in `vHaupt()`, ist visuell verborgen und beginnt mit `seitenName()`.
  - Abschnitte der Route sind `h2`: auf dem Board je Spalte eine, in den Berichten `h2.dtitel`.
  - Darunter folgt `h3`, ohne Sprung.
  - Markdown in `#main` erzeugt nie eine `h1`.
  - Die Gestaltung hängt an Klassen, nicht an Tags.
- **Karte:**
  - `.flaeche` ist `role=list`, jede `.ka` ist `role=listitem` (auch defekt und fehlt). `.leer` und `.nach` sind ebenfalls Listeneinträge.
  - Den Namen bildet die reine Funktion `kartenName`: `#<nr> <Titel>[, <Klasse>][, ausgewählt]`, ohne Datum.
  - Erweitert nach [ADR-0019](../../ADRs/0019-vergessene-timer-sind-anzeige.md) (Karte #15): läuft an der Karte ein Timer über der Schwelle, steht `, Timer läuft seit <Dauer>` **vor** `, ausgewählt`; die Reihenfolge ist `#<nr> <Titel>[, <Klasse>][, Timer läuft seit <Dauer>][, ausgewählt]`, fehlende Teile fallen samt Komma weg. Belegt: `web/kartenname.js:17–19` und `e2e/einheit/kartenname.test.js:44–50` (Bau `3ef1977`, seit dem 2026-11-10 auf `main` gemergt, Commit `fec6ba5`). Der Chip im Inneren trägt kein eigenes `aria-label`, weil der Name des `listitem` das Innere ersetzt.
  - Kein `aria-selected` an der Karte.
  - Tastatur, Öffnen, Ziehen und Fokusführung bleiben unverändert.
- **Name aus dem Renderer:** Den Namen schreibt nur das Zeichnen (`vKarte`, `vDefekt`, `vFehlt`). Ein Live-Ereignis erneuert ihn über `render()` nach ADR-0014, es gibt keinen Nachführer.
- **Zustände:**
  - `aria-current="page"` steht unter derselben Bedingung wie die Klasse `an`: in der Navigation genau einmal, im Seitenmenü am Eintrag mit `an`.
  - `aria-expanded` am Klapp-Knopf der Spalte steht statisch im Markup: `.bk-name` true, `.zu-streifen` false.
- **Menüs:** In keinem Element mit `role="menu"` steht ein `h1`–`h6`; die vier Menüköpfe „SEITE" (`vSeitenPop`), „MEHR" (`vMehrPop`), „#n AUF BOARD LEGEN" (`vLegenPop`) und „STATUS <Knoten>" (`vWbsStatusPop`) sind klassen-gestaltete Nicht-Überschrift-Elemente (`.pop-kopf`), die Gestaltung hängt an der Klasse. Erweitert nach I0125/R00136 (Karte #109): `web/ansicht.js` (die vier Renderer, dazu tragen die `h4` der Pop-Fenster dieselbe Klasse) und `web/kd-app.css:244–245`; Probe `e2e/tests/r00136-menuekoepfe.spec.js` (kein `h1`–`h6` in `[role=menu]`, Name und Kopftext, berechnete Werte, Mutante „h4 zurück ins Menü").

Durchsetzung:
- E2E-Probe über alle Routen nach dem Muster von `e2e/tests/ziele.spec.js`, mit Mutante. Die Routenliste wird gegen die Verzweigungen von `vHaupt()` abgeglichen.
- Unit-Test `kartenName` in `e2e/einheit/`.

## Systemantwort

Ist 2026-11-08 (kanbanD `b17c412`, gelesen, vor dem Bau):

- **Landmarks:** schon vorhanden. `web/index.html:12` hat `main#main` und `footer#stat`, `vKopf()` liefert `header.kz` (`web/ansicht.js:36–45`), die Navigation ist `nav.kz-nav` (`:76`).
- **Überschriften:**
  - In `#main` gibt es keine `h1`.
  - Das Board hat keine Überschrift.
  - Die Berichte beginnen mit `h3.dtitel` (`web/ansicht.js:932`, `:1070`, `:1173–1174`, `:1272`).
  - Eine `h2` haben schon WBS (`:1294`), erster Start (`:1423`) und defektes Board (`:713`).
- **Karte:** `div.ka` mit `tabindex=0`, ohne Rolle und Namen. Bei Auswahl trägt sie `aria-selected="true"` (`:529`), was eine Rolle voraussetzt. Defekte und fehlende Karten liegen bei `:537` und `:640`.
- **Zustände:**
  - `aria-current` fehlt, die aktuelle Seite ist nur die Klasse `an` (`:76`, Seitenmenü `:97–100`).
  - `aria-expanded` gibt es an Pop-Auslösern (`ausloeserMarkieren`, `web/app.js:707–711`) und an den WBS-Knöpfen (`web/ansicht.js:1310`), nicht am Klapp-Knopf der Spalte (`:693`, `:708`).

## Abweichungen

- Bis zum Bau von #13 weicht jede Route von der Hausantwort ab (siehe Systemantwort).

## Offene Fragen

- Erneute Ansage der fokussierten Karte bei jedem Neuzeichnen (ADR-0018, Offene Fragen; gleiche Klasse wie ADR-0015).

## Notizen / Quellen

- Probe 2026-11-08 (headless Chromium, nachgebautes Markup): `listitem` mit `aria-label` behält Knopf und Link als Kinder mit Rolle und Namen. Die verborgene `h1`/`h2` zählt als Überschrift, `expanded` ist über `getByRole` prüfbar. Belege stehen in ADR-0018, „Erprobt durch“.
- angelegt 2026-11-08 nach #13 (ADR-0018)
- erweitert 2026-11-10 nach #15 (ADR-0019): vierter Teil des Kartennamens für einen vergessenen Timer; die Durchsetzung ist der E2E der Karte #15 über Rolle und Namen, nicht eine zweite Probe über alle Routen
- nachgeführt 2026-11-10 (arev Karte #15, S3): der Zusatz steht **vor** „, ausgewählt“ — hier stand „am Ende des Namens“; der Bau folgt ADR-0019 und R00114 FA 9, der Aspekttext war veraltet
- erweitert 2026-11-12 nach I0125/R00136 (Karte #109): kein `h1`–`h6` in `role=menu`; die vier Menüköpfe sind klassen-gestaltete Nicht-Überschrift-Elemente (`.pop-kopf`), die Gestaltung an der Klasse; die „Offene Fragen"-Zeile ist damit geschlossen
