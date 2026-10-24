---
id: R00074
status: Erledigt
datum: 2026-10-21
---

# R00074: Spalten zusammenklappen

## Beschreibung

Ein Klick auf den Namen einer Spalte im Board klappt die Spalte zusammen. Übrig bleibt ein schmaler Streifen:

- Im Kopf steht nur noch die Zahl der Aufgaben, rot, wenn die Grenze der Spalte überschritten ist (dieselbe Regel wie im aufgeklappten Kopf).
- Der Name der Spalte steht um 90 Grad gedreht im Inhaltsbereich des Streifens, nicht im Kopf.
- Ein Klick auf den Streifen klappt die Spalte wieder auf; Karten, Kopf und alles andere sind wieder da.

Der Klappzustand gilt je Betrachter und Board, überdauert das Neuladen (Browser-Speicher) und ändert keine Datei — andere sehen ihre eigene Ansicht. Eine Karte, die auf einen Streifen gezogen wird, landet am Ende der Spalte.

Zahlt ein auf: [Vision](R00000-vision.md) — das Board zeigt, was gerade zählt.

## Geschäftlicher Nutzen

Spalten, die gerade nicht interessieren (etwa „Erledigt“ oder ein langer Backlog), nehmen keinen Platz weg; die Zahl ihrer Karten und die Grenze bleiben im Blick.

## Funktionale Anforderungen

- Der Spaltenname im Kopf ist ein Knopf (`aria-label="<Name> zuklappen"`) mit sichtbarem Klapp-Zeichen « daneben, damit der Klick auffindbar ist; das Kontextmenü des Kopfes bleibt.
- Zugeklappt: `section.bahn.zu`, Kopf nur mit der Zahl (`.n`, rot bei überschrittener Grenze), Streifen als Knopf `aria-label="<Name> aufklappen"` mit dem gedrehten Namen; Titel nennt Name, Zahl und ggf. die Grenze.
- Zustand je Board in `localStorage` unter `kanbanD.spalten-zu.<slug>`.
- Ziehen einer Karte auf den Streifen bewegt sie ans Ende der Spalte.

## Akzeptanzkriterien

- [x] Klick auf den Namen klappt zu: Kopf nur mit der Zahl, Name gedreht im Streifen, keine Karten sichtbar
- [x] Überschrittene Grenze: die Zahl im zugeklappten Kopf ist rot
- [x] Klick auf den Streifen klappt auf, die Karten sind wieder da
- [x] Der Zustand übersteht das Neuladen und gilt nur für dieses Board; die Board-Datei bleibt unverändert
- [x] Eine Karte auf den Streifen gezogen landet am Ende der Spalte

## Betroffene Verzeichnisstruktur

`web/ansicht.js`, `web/app.js`, `web/kd-app.css`; Test `e2e/tests/r00074-spalten-zuklappen.spec.js`.

## Abhängigkeiten
- Abhängig von: R00009 (Spalten und Grenzen)

## Offene Fragen
- keine
