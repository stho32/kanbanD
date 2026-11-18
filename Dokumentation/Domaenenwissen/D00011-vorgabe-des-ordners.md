---
id: D00011
name: Vorgabe des Ordners
status: Aktiv
sprache: de
verwandt: [D00010, D00012]
gebiet: Klassen
synonyme: [Vorgabe, Klassen des Ordners]
code: [Einstellungen.klassen, Klasse, classes]
---

# Vorgabe des Ordners

## Definition

Die Vorgabe des Ordners ist die Liste der Klassen in den Einstellungen des Ordners (`kanbanD.md`), die für jedes Board ohne eigene Klassen und für jede Aufgabe auf keinem Board gilt. Bis R00195 war sie die einzige Klassenliste und galt für alle Boards; seither ist sie der Rückfall, wenn ein Board nichts Eigenes festlegt (bestätigt, R00195:13, :15; Vision R00000:77–79).

## ELI14

Die Farben mit Namen, die jedes Board im Ordner bekommt, solange es sich keine eigenen aussucht.

## Bestandteile

- je Klasse: Schlüssel, Bezeichnung, Farbe (Palettenname oder `#rrggbb`)
- die Reihenfolge der Klassen (Dringlichkeit in den Berichten)
- Ort: `classes:` in `kanbanD.md`, je Zeile `<schlüssel>: {label, color}`

## Beziehungen

- genau eine je Ordner
- ist der [Klassenvorrat](D00010-klassenvorrat.md) jedes Boards ohne eigene Klassen
- ein Board mit eigenen Klassen nimmt nichts aus der Vorgabe; es wird nicht gemischt
- eine Klasse der Vorgabe, die ein Board mit eigenen Klassen nicht führt, ist dort eine [fremde Klasse](D00012-fremde-klasse.md)

## Wechselwirkungen

- „eigene Klassen“ beginnt in der Oberfläche mit einer Kopie der Vorgabe; danach sind beide Listen unabhängig, eine spätere Änderung der Vorgabe erreicht das Board nicht (R00195 AK 8)
- kehrt ein Board zur Vorgabe zurück, verliert es seine eigenen Klassen; Karten mit einem Schlüssel, den nur der eigene Satz kannte, zeigen danach eine [fremde Klasse](D00012-fremde-klasse.md), und davor steht die Hinweiszeile mit ihrer Zahl (R00195 AK 10)
- wird eine Klasse aus der Vorgabe gestrichen, zählt die Hinweiszeile nur Aufgaben auf Boards ohne eigene Klassen oder auf keinem Board (R00195, Zählregel Zeile 44)
- bestehende Ordner bleiben unverändert: ihre Klassen sind ohne Upgrade-Schritt die Vorgabe (R00195 AK 1, ADR-0031 Regel 4)

## Vorkommen in Anforderungen

- [R00195](../../Anforderungen/R00195-klassen-und-farben-je-board-mit-vorgabe-des-ordners.md) — benennt die Klassen des Ordners als Vorgabe (Zeilen 13, 15); Wahl „Vorgabe des Ordners“ beim Einrichten (AK 8), Rückkehr zur Vorgabe (AK 10)
- [R00010](../../Anforderungen/R00010-personen-und-klassen-pflegen.md) — Klassen des Ordners pflegen; laut R00195:15 ist dieser Satz jetzt die Vorgabe
- [R00000](../../Anforderungen/R00000-vision.md) — „ohne eigene gelten die Klassen des Ordners als Vorgabe“ (Zeilen 77–79)

## Notizen / Quellen

- Definition nach R00195:13, :15 und Vision R00000:77–79 (Ergänzung vom 2026-11-18) — bestätigt; ADR-0031 Regeln 2–4.
- Code (beobachtet, Stand 49489753): `Einstellungen.klassen: Vec<Klasse>` (`src/modell/einstellungen.rs:60`), `Klasse { schluessel, bezeichnung, farbe }` (`:21–25`); in der Oberfläche `S.zustand.einstellungen.klassen`; Frontmatter-Schlüssel `classes` in `kanbanD.md`. Die Bezeichner tragen das Wort „Vorgabe“ nicht — geduldet, `classes` ist Dateiformat.
- Oberfläche (de): „Vorgabe des Ordners“ als Wahl im Abschnitt „Klassen dieses Boards“ (R00195 AK 8); der Wortlaut im Klassen-Editor des Ordners („Einrichten“) ist der Zeichnung überlassen (R00195:60).
- Erlaubte Kurzform „Vorgabe“ im Zusammenhang der Klassen. „Klassen des Ordners“ ist der Name vor R00195 (R00010) und bleibt erlaubt, wo vom Pflegen im Ordner die Rede ist.
- Die Vorgabe umfasst nur Klassen. Personen gelten weiter für den ganzen Ordner und haben keine Fassung je Board (Vision R00000:77; R00195:61 „Nicht hinein“).
- Nicht verwenden: „Klassen der Instanz“ — das Wort der Karte #200; die Klassen gehören dem Ordner, nicht dem laufenden Programm.
- Nicht verwenden: „Standardklassen“, „Ordner-Satz“ (einmal in R00195:15) — Leitform ist „Vorgabe des Ordners“.
