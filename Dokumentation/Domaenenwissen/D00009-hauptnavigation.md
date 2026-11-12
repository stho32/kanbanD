---
id: D00009
name: Hauptnavigation
status: Aktiv
sprache: de
verwandt: [D00004]
gebiet: Oberfläche
synonyme: [Navigationsleiste, Leiste, Seitenmenü, Menü „Mehr“]
code: [vNavigation, vSeitenKnopf, vSeitenPop, vMehrPop, "nav.kz-nav", "#t-seite", "#t-mehr"]
---

# Hauptnavigation

## Definition

Die Hauptnavigation ist der Teil der Kopfzeile, über den man die sechs Ansichten des Boards erreicht und der zum Filtern und Kartenziehen nicht gebraucht wird. Sie sieht je Breite anders aus: ab 600 px trägt die Leiste die zwei häufigen Ziele Board und Berichte ▾, unter 600 px öffnet der Seitenknopf „Seite: <Seite> ▾“ das Seitenmenü mit denselben zwei Zielen; die vier selteneren Ziele Aufgaben, Personen, WBS und Einrichten liegen im Menü „…“, das bei jeder Breite vorhanden ist (bestätigt, R00101, R00140).

## ELI14

Die Zeile ganz oben, mit der man von einer Ansicht zur anderen springt — Board, Berichte und der Rest.

## Bestandteile

- Leiste `nav.kz-nav` (ab 600 px): die zwei häufigen Ziele Board und Berichte ▾; „Berichte ▾“ öffnet das Untermenü der Berichte
- Seitenknopf „Seite: <Seite> ▾“ (`#t-seite`, unter 600 px): nennt die aktuelle Seite und öffnet das Seitenmenü mit denselben zwei Zielen (Board, Berichte ▾)
- Menü „…“ (`#t-mehr`, bei jeder Breite): die vier selteneren Ziele als erste Gruppe — Aufgaben, Personen, WBS (je gebundener Anwendung, mit Kürzel „WBS · <Kürzel>“ bei mehreren), Einrichten —, darunter genau ein Trenner, dann die Werkzeuge der Kopfzeile

## Beziehungen

- ist der Navigations-Teil der Kopfzeile (`header.kz`); was je Breite in Leiste, Zeilen oder Menü steht, wählt `kopfPlaetze` (`web/kopfzeile.js`)
- führt die sechs Ansichten: Board, Aufgaben, Personen, Berichte, WBS, Einrichten
- im [schmalen Layout](D00004-schmales-layout.md) trägt der Seitenknopf die Navigation anstelle der Leiste
- der Auslöser „Berichte ▾“ führt das Untermenü der Berichte (R00100)

## Wechselwirkungen

- [Schmales Layout](D00004-schmales-layout.md) ersetzt die Leiste durch den Seitenknopf; das Menü „…“ bleibt bestehen (R00101, R00140)
- die aktuelle Ansicht markiert genau einen Eintrag mit `an` und `aria-current="page"` — den Leistenlink, den Seitenmenü-Eintrag oder den Menüeintrag „…“; der Auslöser „…“ selbst bleibt unmarkiert (ADR-0018 Regel 5, geweitet R00140)
- das Menü „…“ folgt dem Muster von R00106: `role=menu`, Öffnen per Klick/Enter/Leertaste, Pfeile durch die Einträge, Esc schließt und gibt den Fokus an den Auslöser zurück

## Vorkommen in Anforderungen

- [R00140](../../Anforderungen/R00140-navigation-seltene-ziele-im-mehr-menue.md) — Leiste auf die zwei häufigen Ziele gekürzt, die vier seltenen ins Menü „…“ (Zeilen 11, 28–37); Domänenbezug [Schmales Layout](D00004-schmales-layout.md) (Zeile 18)
- [R00101](../../Anforderungen/R00101-kopfzeile-auf-jeder-breite-bedienbar.md) — Kopfzeile je M3-Stufe; unter 600 px Seitenknopf statt wischbarer Leiste, Menü „Mehr“ (Zeilen 28–33)
- [R00113](../../Anforderungen/R00113-struktur-fuer-hilfstechnik.md) — `an` und `aria-current="page"` aus demselben Wahrheitswert (ADR-0018 Regel 5)
- [R00106](../../Anforderungen/R00106-fokus-in-fenstern-und-menues.md) — Fokus und Tastaturführung in den Menüs
- [R00100](../../Anforderungen/R00100-bericht-bestand-nach-labels.md) — ein Bericht im Menü „Berichte“ (Zeile 11)

## Notizen / Quellen

- Definition nach R00140 (Leiste zwei Ziele, die vier im Menü „…“) und R00101:28–33 (Kopfzeile je M3-Stufe, Seitenknopf unter 600 px) — bestätigt.
- Die Leitform „Hauptnavigation“ ist der Vorschlag aus R00140:195 (Missing-Docs); „Leiste“, „Seitenmenü“ und „Menü „…““ sind die Namen ihrer Teile, nicht eigener Begriffe.
- Code (beobachtet, Stand c55e92d): `vNavigation` (`web/ansicht.js:84–88`), `vSeitenKnopf` (`:91–94`), `vSeitenPop` (`:99–108`), `vMehrPop` (`:126–147`); die Breitenzusammensetzung `kopfPlaetze` (`web/kopfzeile.js:17–29`); Auslöser `#t-seite` (`web/ansicht.js:93`) und `#t-mehr` (`:69`); Gestaltung `nav.kz-nav` (`web/kd-app.css:15, 31–33`), `.kz-mehr` (`:34–35`), `.kz-menue [role="separator"]` (`:52`).
- Oberfläche (de): Leiste „Board“, „Berichte ▾“; Seitenknopf „Seite: <Seite> ▾“; Menü „…“ mit „Aufgaben“, „Personen“, „WBS“ (bzw. „WBS · <Kürzel>“), „Einrichten“ und den Werkzeugen („Signale oben“, „Spalten einrichten“, „Darstellung“; unter 600 px zusätzlich „Läuft gerade“ und „Ich bin …“).
- „Menü „…““ und „Menü Mehr“ meinen dasselbe; der zugängliche Name des Auslösers ist „Mehr“ (`aria-label="Mehr"`, `web/ansicht.js:69`).
- Die Grenze der Kopfzeile ist 600 px (M3, `web/kopfzeile.js:9`), nicht die 640 px des [schmalen Layouts](D00004-schmales-layout.md) — bei 600–640 px zeigt die Kopfzeile weiterhin die Leiste.
- Nicht zu verwechseln mit der [Seitenleiste](D00003-seitenleiste.md), der Feldspalte rechts im Aufgabenfenster — trotz ähnlichen Namens eine andere Sache.
- Nicht verwenden: „wischbare Leiste“ — bis R00101 war die compact-Navigation eine wischbare Leiste (R00101:30 nennt sie ausdrücklich als abgelöst); seit R00101 ist sie der Seitenknopf mit Menü.
