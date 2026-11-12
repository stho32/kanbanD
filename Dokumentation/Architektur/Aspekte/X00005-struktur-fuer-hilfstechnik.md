---
id: X00005
name: Struktur für Hilfstechnik
art: Aspekt
geltung: Makro
befund: Einheitlich
hausantwort: "ADR-0018 (Akzeptiert): Landmarks im Rahmen, eine h1 je Route nur in vHaupt(), Abschnitte h2, Karte listitem in list mit Namen aus kartenName(), aria-current wie die Klasse an (Leiste oder offenes Menü „…“, Nachtrag N1), aria-expanded am Klapp-Knopf, Ansichtswechsel des Aufgabenfensters als Menü mit aria-checked statt tablist (Nachtrag N2); Probe über alle Routen"
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
  - `aria-current="page"` steht unter derselben Bedingung wie die Klasse `an` (Helfer `aktuelleSeite`): in der Kopfzeile genau einmal — in der Leiste (Board, Berichte) bzw. im Seitenmenü unter 600 px; seit R00140 (I0126) auch am Eintrag im Menü „…“ (Aufgaben, Personen, WBS, Einrichten), der Auslöser „…“ bleibt unmarkiert.
  - `aria-expanded` am Klapp-Knopf der Spalte steht statisch im Markup: `.bk-name` true, `.zu-streifen` false.
- **Menüs:** In keinem Element mit `role="menu"` steht ein `h1`–`h6`; die vier Menüköpfe „SEITE" (`vSeitenPop`), „MEHR" (`vMehrPop`), „#n AUF BOARD LEGEN" (`vLegenPop`) und „STATUS <Knoten>" (`vWbsStatusPop`) sind klassen-gestaltete Nicht-Überschrift-Elemente (`.pop-kopf`), die Gestaltung hängt an der Klasse. Erweitert nach I0125/R00136 (Karte #109): `web/ansicht.js` (die vier Renderer, dazu tragen die `h4` der Pop-Fenster dieselbe Klasse) und `web/kd-app.css:244–245`; Probe `e2e/tests/r00136-menuekoepfe.spec.js` (kein `h1`–`h6` in `[role=menu]`, Name und Kopftext, berechnete Werte, Mutante „h4 zurück ins Menü").
- **Ansichtswechsel im Aufgabenfenster** (erweitert nach ADR-0018 Nachtrag N2, Karten #145/#144):
  - Er ist ein **Menü**, keine `tablist`: kein `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` oder `role="tabpanel"` im Fenster.
  - Die Einträge kommen aus der einen Liste `REITER`/`reiterDerAufgabe` (`web/reiter.js`), die Auswahl aus `S.ui.tab` mit dem Rückfall `tab ∉ reiterSchluessel(a)` → `inhalt`. Kein zweiter Zustand, keine zweite Liste.
  - Die gewählte Ansicht trägt `aria-checked="true"` am `menuitemradio`; der Auslöser nennt die Ansicht und trägt `aria-haspopup="menu"` und `aria-expanded`. **`aria-current` kommt im Fenster nicht vor** — es bleibt der Kopfzeile (Regel 5).
  - Genau eine Ansicht wird gezeichnet; der Bereich ist kein `tabpanel` (Benennung nötig: `role="group"` + `aria-label`, kein `role="region"`).
  - Das Menü ist eine **eigene Ebene** der Fokusführung (`fenstermenue` in `web/fokus.js` zwischen `fenster` und `pop`), wird im Fenster gezeichnet, `Esc`/`Tab` schließen es mit Rückgabe an den Auslöser; der `alertdialog` liegt darüber. Ein Fenstermenü als `#pop` neben dem Dialog oder ohne Ebene ist eine Abweichung.
  - „Anhänge“ ist keine Ansicht; die Liste steht im Inhalt nach den Teilaufgaben.
  - Dasselbe gilt für das Aktionsmenü des Fensterkopfs (#144): höchstens zwei Menü-Auslöser im Kopf (Ansicht, Aktionen), keine Blätterknöpfe.

Durchsetzung:
- E2E-Probe über alle Routen nach dem Muster von `e2e/tests/ziele.spec.js`, mit Mutante. Die Routenliste wird gegen die Verzweigungen von `vHaupt()` abgeglichen.
- Unit-Test `kartenName` in `e2e/einheit/`.
- E2E-Probe am Aufgabenfenster (Nachtrag N2): kein `[role="tablist"]` in `#fenster`; genau ein `aria-checked="true"` unter den Menüeinträgen und es ist die gezeichnete Ansicht; Auslöser mit `aria-haspopup="menu"` und `aria-expanded`; Pfeile/`Pos1`/`Ende`/`Enter`/`Esc` mit Rückgabe an den Auslöser; kein `aria-current` in `#fenster`; nach einem Live-Ereignis bleibt die Ansicht gewählt. Unit: `reiterSchluessel` ohne `anhaenge`, Rückfall für `anhaenge` und einen unbekannten Schlüssel.
- Review-Punkt für `architektur-reviewer` und `code-reviewer`: ein zweiter Ansichts-Zustand, eine zweite Ansichtsliste, eine eigene Umschaltung in einer Sicht oder ein Fenstermenü ohne Ebene in `web/fokus.js` ist ein Befund.

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

Gebaut 2026-11-12 (kanbanD `d0fa547`, gebaut): Die Hausantwort (ADR-0018) ist gebaut und mit #13 am 2026-11-10 auf `main` gemergt (`85dbc2e`, Probe `e2e/tests/r00113-struktur.spec.js`). Im Umfang von R00140/#105 trägt die Kopfzeile:

- **Leiste** (`vNavigation`, `web/ansicht.js:84–88`) ab 600 px genau zwei Ziele: „Board“ und „Berichte ▾“ (`#t-ber`); Aufgaben, Personen, WBS und Einrichten stehen dort nicht mehr (der frühere Block `vWbsMenue` ist entfallen).
- **Seitenmenü** unter 600 px (`vSeitenPop`, `:99–108`) dieselben zwei Ziele; der Seitenknopf `#t-seite` (`:91–94`) nennt weiter die Seite („Seite: …“).
- **Menü „…“** (`vMehrPop`, `:126–147`): als **erste Gruppe** die vier seltenen Ziele Aufgaben, Personen, WBS (je gebundener Anwendung, `:133–136`) und Einrichten, darunter genau ein `role="separator"` (`:146`), dann die Werkzeuge aus `kopfPlaetze(...).mehr` (`web/kopfzeile.js`). Jeder Eintrag in der Form von `vSeitenPop` (`role="menuitem" tabindex="-1" data-act="seite"`, `:129–132`); der Auslöser „…“ (`#t-mehr`, `:69`) bleibt unmarkiert.
- **Markierung:** `aria-current="page"` setzt derselbe Helfer `aktuelleSeite` (`:77–80`) wie die Klasse `an`; für die vier seltenen Ziele liegt sie am Menüeintrag. Der Trenner ist gestaltet in `web/kd-app.css:52`.
- Der Ist-Stand vom 2026-11-08 oben („vor dem Bau“) ist damit überholt; Karte, Überschriften, Landmarks und `aria-expanded` sind nach #13 gebaut (Beleg `e2e/tests/r00113-struktur.spec.js`), die Kopfzeile nach #105/R00140 geweitet.

Ist 2026-11-12 (kanbanD `99b6acc`, gelesen, vor dem Bau von #145/#144):

- **Ansichtswechsel:** Die sechs Ansichten stehen als Reiterleiste `span.seg` mit `role="tablist"` „Ansicht der Aufgabe“ im Fensterkopf (`vReiterleiste`, `web/ansicht.js:232–235`; je Reiter `role="tab"`, `aria-selected`, `aria-controls="reiterpanel-<k>"`, roving `tabindex`), genau ein `role="tabpanel"` wird gezeichnet (`:285–293`). Die Liste ist `REITER` (`web/reiter.js:7`), „kosten“ bedingt (`:9`), der Rückfall `tab ∉ reiterSchluessel(a)` → `inhalt` steht in `vFenster` (`web/ansicht.js:280`) und `reiterRueckfall` (`web/app.js:893`). Tasten `←`/`→`/`Pos1`/`Ende`/`Enter`/`d` über `naechsterReiter` (`web/tastatur.js:47`, `web/app.js:2424–2450`).
- **Kopf:** zusätzlich Zähler `i / n` (`:281`), Blätterknöpfe ↑/↓ (`data-act="blaettern"`), `↗`, Archiv `▭`, Trenner und **beschrifteter** Lösch-Auslöser (`el-ausloeser`), ✕.
- **Anhänge:** eigener Reiter (`:290`, `vAnhaenge` `:355–358`).
- **Menüs:** `vBoardDrei`/`vBoardMenue` (`:390–398`, R00128 M1) sind das gebaute Muster für einen ⋮-Auslöser mit `role="menu"`; Ebenen und Fokus in `web/fokus.js:52–63` und `web/app.js:768–777`, `:858`.
- Soll nach ADR-0018 Nachtrag N2: Ansichtsmenü statt `tablist`, Aktionsmenü im Kopf, Anhänge im Inhalt; der Ist-Stand oben ist damit der Ausgangspunkt, nicht mehr die Hausantwort.

## Abweichungen

- keine — die Hausantwort ist gebaut; die frühere Abweichung (Ist 2026-11-08, „vor dem Bau“) ist geschlossen. Die Weitung von Regel 5 im Umfang R00140/#105 (die aktuelle Seite kann im Menü „…“ liegen) steht in [ADR-0018 Nachtrag N1](../../ADRs/0018-struktur-fuer-hilfstechnik-aus-dem-renderer.md) und ist Hausantwort, keine Abweichung. Die frühere Architekt-Entscheidung „die Reiterleiste bleibt `tablist`“ ([R00127](../../../Anforderungen/R00127-kartendetails-mehr-tabs.md), Offene Frage 1) ist durch den Betreiber aufgehoben (Karte #145, 2026-11-12); die neue Hausantwort steht in ADR-0018 Nachtrag N2 und ist keine Abweichung, sondern eine Weitung.

## Offene Fragen

- Erneute Ansage der fokussierten Karte bei jedem Neuzeichnen (ADR-0018, Offene Fragen; gleiche Klasse wie ADR-0015).

## Notizen / Quellen

- Probe 2026-11-08 (headless Chromium, nachgebautes Markup): `listitem` mit `aria-label` behält Knopf und Link als Kinder mit Rolle und Namen. Die verborgene `h1`/`h2` zählt als Überschrift, `expanded` ist über `getByRole` prüfbar. Belege stehen in ADR-0018, „Erprobt durch“.
- angelegt 2026-11-08 nach #13 (ADR-0018)
- erweitert 2026-11-10 nach #15 (ADR-0019): vierter Teil des Kartennamens für einen vergessenen Timer; die Durchsetzung ist der E2E der Karte #15 über Rolle und Namen, nicht eine zweite Probe über alle Routen
- nachgeführt 2026-11-10 (arev Karte #15, S3): der Zusatz steht **vor** „, ausgewählt“ — hier stand „am Ende des Namens“; der Bau folgt ADR-0019 und R00114 FA 9, der Aspekttext war veraltet
- erweitert 2026-11-12 nach I0125/R00136 (Karte #109): kein `h1`–`h6` in `role=menu`; die vier Menüköpfe sind klassen-gestaltete Nicht-Überschrift-Elemente (`.pop-kopf`), die Gestaltung an der Klasse; die „Offene Fragen"-Zeile ist damit geschlossen
- nachgeführt 2026-11-12 nach R00140 (Karte #105, ADR-0018 Nachtrag N1): die Hausantwort ist gebaut (`85dbc2e`); die Kopfzeile trägt in der Leiste zwei Ziele (Board, Berichte ▾) und im Menü „…“ die vier seltenen Ziele (Aufgaben, Personen, WBS je gebundener Anwendung, Einrichten) als erste Gruppe, darunter ein Trenner, dann die Werkzeuge; die Systemantwort ist auf den gebauten Stand gezogen (`d0fa547`, `web/ansicht.js:84–147`, `web/kd-app.css:52`)
- nachgeführt 2026-11-12 nach ADR-0018 Nachtrag N2 (Karten #145, #144; **Soll, vor dem Bau**): der Ansichtswechsel des Aufgabenfensters ist ein Menü (`aria-checked` am `menuitemradio`) statt `tablist`, die Anhänge stehen im Inhalt, das Fenstermenü ist eine eigene Ebene `fenstermenue` in `web/fokus.js`; `aria-current` bleibt der Kopfzeile (Regel 5). Die frühere Entscheidung „bleibt `tablist`“ (R00127 Offene Frage 1) ist vom Betreiber aufgehoben; der Ist-Stand vom 2026-11-12 (`99b6acc`) steht als Ausgangspunkt in der Systemantwort.
