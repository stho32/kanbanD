# ADR-0004: Schlüsselsuche unter der Sperre durch Lesen des Ordners, ohne Index

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00098 (genutzt von R00099)
**Erprobt durch**: —

## Kontext

Anlegen mit `key` muss idempotent sein: zwei Sensoren mit demselben Schlüssel dürfen nie zwei Karten erzeugen. Archivierte Karten zählen mit; doppelte Schlüssel (nach einem Merge) sollen gemeldet und nicht defekt werden. Die Dateien sind die Wahrheit, sie ändern sich auch von außen (Editor, `git pull`), der [Wächter](../Architektur/A00008-waechter.md) sieht das nur verzögert. Archivierte Aufgaben liegen im selben Ordner `aufgaben/` mit Feld `archived`.

## Optionen

### Option A: Suche über `ordner().aufgaben()` unter derselben Sperre wie das Anlegen
- Vorteile: immer der Stand auf der Platte; kein zweiter Zustand; Rennen zwischen zwei Anfragen ausgeschlossen, weil Suche und Anlegen unter `gesperrt()` liegen.
- Nachteile: jedes Anlegen mit `key` liest alle Aufgabendateien (O(n)); bei vielen tausend Karten spürbar.

### Option B: Schlüssel-Index im Speicher, gepflegt über eigene Schreibvorgänge und den Wächter
- Vorteile: Nachschlagen O(1).
- Nachteile: Änderungen von außen kommen erst nach Bündelung (150 ms) an — genau dann entsteht die Doppelte; zweiter Zustand mit eigener Fehlerklasse.

### Option C: Schlüssel im Dateinamen
- Vorteile: Suche über Verzeichnisliste.
- Nachteile: ändert das Dateiformat und bestehende Links; Schlüssel bis 200 Zeichen mit beliebigen Zeichen passen nicht in Dateinamen.

## Entscheidung

**Gewählt: Option A**

Korrektheit gegen Änderungen von außen wiegt schwerer als die Kosten; `aufgaben_anlegen` liest den Ordner ohnehin unter der Sperre (`naechste_nummer`). Bei `…/mehrere` wird **einmal** je Anfrage gesucht, nicht je Eintrag; doppelte Schlüssel innerhalb der Anfrage werden im Speicher zusammengeführt. Wird das Lesen messbar zu langsam, ist Option B mit Abgleich gegen die Platte der nächste Schritt (neue ADR).

## Konsequenzen

**Positiv:**
- Die Suche ist eine reine Funktion über `&[Aufgabe]` im [Modell](../Architektur/A00006-modell.md) (`key → Treffer 0|1|n`); der Filter `?key=` und R00099 nutzen dieselbe.
- Doppelte Schlüssel bleiben lesbare Aufgaben; `Kanban::zustand` meldet sie in einer eigenen Liste neben `defekte`.

**Negativ / Inkauf zu nehmen:**
- O(n) Dateilesen je Anlegen mit Schlüssel.

**Folgeentscheidungen / Aufgaben:**
- [ ] Lastprobe beim Bau: 2 000 Aufgaben, Anlegen mit `key` unter 200 ms (Abnahme-Idee, keine Anforderung).

## Quellen / Bezuege

- `src/dienst/aufgabe_anlegen.rs:66–80`, `src/ablage.rs:75` (`aufgaben`), `:113` (`naechste_nummer`)
