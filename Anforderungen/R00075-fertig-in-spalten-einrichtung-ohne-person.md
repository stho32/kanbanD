---
id: R00075
status: Erledigt
datum: 2026-10-21
typ: Bug
---

# R00075: „Fertig“ in „Spalten einrichten“ tut ohne gewählte Person nichts

## Beschreibung

Ist im Tab nicht gewählt, wer man ist, bleibt „Fertig“ in „Spalten einrichten“ wirkungslos: nichts wird gespeichert, keine Meldung erscheint, nur „Verwerfen“ führt heraus. Gemeldet beim Umbenennen von „Läuft Produktiv“ in „Läuft Produktiv/Erledigt“ — der Name ist nicht die Ursache, die API nimmt ihn an.

## Ursache

„Fertig“ verlangt eine gewählte Person (`ichNoetig`) und öffnet dazu die Auswahl „Ich bin …“. Diese hängt am Knopf `#t-ich` in der Kopfzeile. Im Modus „Spalten einrichten“ ersetzt eine eigene Kopfzeile die normale, ohne diesen Knopf; `popPlatzieren` findet den Anker nicht und entfernt die Auswahl stillschweigend.

## Lösung

Die Kopfzeile von „Spalten einrichten“ zeigt den Personen-Knopf rechts neben „Verwerfen“ und „Fertig“. Die Auswahl erscheint mit dem Hinweis „Für diese Aktion zuerst wählen, wer du bist.“; nach der Wahl speichert „Fertig“.

## Akzeptanzkriterien

- [x] Ohne gewählte Person öffnet „Fertig“ in „Spalten einrichten“ die Auswahl „Ich bin …“ mit Hinweis
- [x] Nach der Wahl speichert „Fertig“ die Spalten (auch Namen mit „/“) und führt zurück zum Board
- [x] Mit gewählter Person zeigt die Kopfzeile die Person

## Test-Strategie

E2E `e2e/tests/r00075-fertig-ohne-person.spec.js`: Tab ohne Person, Spalte in „Läuft Produktiv/Erledigt“ umbenennen, „Fertig“ → Auswahl sichtbar, Person wählen, „Fertig“ → Board mit der umbenannten Spalte, Datei geschrieben.

## Abhängigkeiten
- Abhängig von: R00009

## Offene Fragen
- keine
