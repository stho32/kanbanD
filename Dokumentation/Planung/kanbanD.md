---
application: kanbanD
system: kanbanD
vision: Anforderungen/R00000-vision.md
wireframes: Dokumentation/Wireframes/
sprache: de
zuletzt: 2026-10-18
---

# WBS — kanbanD

## Knoten

| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A0001 | Application | — | kanbanD | gelb | alle Dialogs gruen |  |  |  |  |  |  |
| D0001 | Dialog | A0001 | Start und Einrichtung | gelb | alle Interactions gruen |  |  |  |  | R00001 |  |
| D0002 | Dialog | A0001 | Board | gelb | alle Interactions gruen |  |  |  |  | R00004 |  |
| D0003 | Dialog | A0001 | Aufgabe | rot | alle Interactions gruen |  |  |  |  |  |  |
| D0004 | Dialog | A0001 | Aufgabenliste | rot | alle Interactions gruen |  |  |  |  |  |  |
| D0005 | Dialog | A0001 | Personen | rot | alle Interactions gruen |  |  |  |  |  |  |
| D0006 | Dialog | A0001 | Berichte | rot | alle Interactions gruen |  |  |  |  |  |  |
| D0007 | Dialog | A0001 | Agenten-Schnittstelle | rot | alle Interactions gruen |  |  |  |  |  | ohne eigenen Bildschirm ausser der API-Beschreibung |
| I0001 | Interaction | D0001 | Ordner öffnen | gruen | US-1..US-3 |  |  |  |  | R00001 | kanbanD <ordner> startet, legt Struktur und Git an, öffnet Browser |
| B0001 | Bubble | I0001 | Startargumente lesen | gruen | Test gruen | argv → Startauftrag (Ordner, Port, Host, Browser ja/nein) | 0,5-1 |  |  |  |  |
| B0002 | Bubble | I0001 | Ordner vorbereiten | gruen | Test gruen | Startauftrag → Ordner vorhanden, Git-Repository vorhanden | 0,5-1 |  |  |  |  |
| B0003 | Bubble | I0001 | Server starten | gruen | Test gruen | Startauftrag → lauschender Server auf freiem Port, URL | 0,5-1 |  |  |  |  |
| B0004 | Bubble | I0001 | Oberfläche ausliefern und Browser öffnen | gruen | Test gruen | URL → Seite und /api/zustand, Browserfenster | 0,5-1 |  |  |  |  |
| I0002 | Interaction | D0001 | Erster Start einrichten | gruen | US-1..US-3 |  |  |  | I0001 | R00002 | Ordner ohne kanbanD.md: ich, Agenten, Spalten des ersten Boards |
| B0005 | Bubble | I0002 | Einstellungen lesen und schreiben | gruen | Test gruen | kanbanD.md ⇄ Einstellungen (Personen, Klassen, Quellen) | 0,5-1 |  |  |  |  |
| B0006 | Bubble | I0002 | Board-Datei lesen und schreiben | gruen | Test gruen | boards/<slug>.md ⇄ Board (Titel, Spalten, Aufgabenzeilen, Grenzen) | 0,5-1 |  |  |  |  |
| B0007 | Bubble | I0002 | Aktion committen | gruen | Test gruen | Pfade + Person + Nachricht → Commit mit Person als Autor | 0,5-1 |  |  |  |  |
| B0008 | Bubble | I0002 | Einrichten | gruen | Test gruen | Einrichtung → kanbanD.md, boards/<slug>.md, ein Commit | 0,5-1 |  |  |  |  |
| B0009 | Bubble | I0002 | Einrichtungsseite | gruen | Test gruen | Formular mit Vorschau → POST /api/einrichten → Board | 0,5-1 |  |  |  |  |
| I0003 | Interaction | D0001 | Identität wählen | gruen | US-1..US-3 |  |  |  | I0002 | R00003 | „Ich bin …“ je Tab; schreibende Aktionen verlangen eine Identität |
| B0010 | Bubble | I0003 | Handelnden bestimmen | gruen | Test gruen | Header X-KanbanD-Wer + Einstellungen → aktive Person oder Fehler; GET /api/wer | 0,5-1 |  |  |  |  |
| B0011 | Bubble | I0003 | Ich-bin-Auswahl | gruen | Test gruen | Klick in der Kopfzeile → Mensch gewählt, je Tab in sessionStorage | 0,5-1 |  |  |  |  |
| I0004 | Interaction | D0002 | Board ansehen | gruen | US-1..US-3 |  |  |  | I0002 | R00004 | Spalten aus der Board-Datei, Karten aus den Aufgaben |
| B0012 | Bubble | I0004 | Aufgabendatei lesen und schreiben | gruen | Test gruen | aufgaben/0012-x.md ⇄ Aufgabe (Frontmatter, Beschreibung, Teilaufgaben, kanbanD-time, kanbanD-comments) | 1-2 |  |  |  |  |
| B0013 | Bubble | I0004 | Aufgaben des Ordners lesen | gruen | Test gruen | aufgaben/*.md → Aufgaben + defekte Dateien (doppelte Nummern); GET /api/aufgaben | 0,5-1 |  |  |  |  |
| B0014 | Bubble | I0004 | Board mit Karten zeigen | gruen | Test gruen | Board + Aufgaben → Bahnen mit Karten, fehlende Aufgaben als Platzhalter | 1-2 |  |  |  |  |
| I0005 | Interaction | D0002 | Aufgabe anlegen | gruen | US-1..US-3 |  |  |  | I0003, I0004 | R00005 | + Karte in einer Spalte |
| B0015 | Bubble | I0005 | Nächste Nummer vergeben | gruen | Test gruen | Dateinamen unter aufgaben/ → nächste freie Nummer | 0,5-1 |  |  |  |  |
| B0016 | Bubble | I0005 | Aufgabe anlegen | gruen | Test gruen | Titel, Board, Spalte, Person → Aufgabendatei + Board-Zeile, ein Commit; POST /api/aufgaben | 1-2 |  |  |  |  |
| B0017 | Bubble | I0005 | Karte in der Bahn anlegen | gruen | Test gruen | + Karte, Titel, Enter → neue Karte unten in der Bahn; ohne Identität Ich-bin-Hinweis | 0,5-1 |  |  |  |  |
| I0006 | Interaction | D0002 | Aufgabe bewegen | gruen | US-1..US-3 |  |  |  | I0005 | R00006 | Ziehen und Tastatur; ändert nur die Board-Datei |
| B0018 | Bubble | I0006 | Position im Board ändern | gruen | Test gruen | Board, Nummer, Zielspalte, Index → Board | 0,5-1 |  |  |  |  |
| B0019 | Bubble | I0006 | Bewegen über die API | gruen | Test gruen | POST /api/boards/<slug>/bewegen → nur Board-Datei, ein Commit | 0,5-1 |  |  |  |  |
| B0020 | Bubble | I0006 | Karten ziehen | gruen | Test gruen | Ziehen mit Einfügelinie → Bewegen | 1-2 |  |  |  |  |
| I0007 | Interaction | D0002 | Live-Aktualisierung | rot | US der Anforderung |  |  |  | I0004 |  | Dateiwächter und Ereignisstrom, Marke extern |
| I0008 | Interaction | D0002 | Boards wechseln und anlegen | rot | US der Anforderung |  |  |  | I0003, I0004 |  |  |
| I0009 | Interaction | D0002 | Spalten einrichten | rot | US der Anforderung |  |  |  | I0008 |  | anlegen, umbenennen, umsortieren, leere entfernen, Grenze |
| I0010 | Interaction | D0001 | Personen und Klassen pflegen | rot | US der Anforderung |  |  |  | I0003 |  | stilllegen statt entfernen |
| I0011 | Interaction | D0003 | Aufgabe ansehen und bearbeiten | rot | US der Anforderung |  |  |  | I0005 |  | Titel, Beschreibung, Klasse, Zuständige, Labels, Fälligkeit |
| I0012 | Interaction | D0003 | Teilaufgaben abhaken | rot | US der Anforderung |  |  |  | I0011 |  |  |
| I0013 | Interaction | D0003 | Kommentieren | rot | US der Anforderung |  |  |  | I0011 |  |  |
| I0014 | Interaction | D0003 | Timer starten und stoppen | rot | US der Anforderung |  |  |  | I0011 |  | mehrere gleichzeitig, fremde stoppbar, Kopfzeile N laufen |
| I0015 | Interaction | D0003 | Zeiten nachtragen und korrigieren | rot | US der Anforderung |  |  |  | I0014 |  |  |
| I0016 | Interaction | D0003 | Anhänge verwalten | rot | US der Anforderung |  |  |  | I0011 |  |  |
| I0017 | Interaction | D0003 | Archivieren und zurückholen | rot | US der Anforderung |  |  |  | I0011 |  |  |
| I0018 | Interaction | D0003 | Herkunft und Abhängigkeiten | rot | US der Anforderung |  |  |  | I0011 |  | origins mit Editor-Link, WBS-Braucht als wartet auf |
| I0019 | Interaction | D0002 | Filtern | rot | US der Anforderung |  |  |  | I0005, I0010 |  | Text, class:, origin:, @person, is:archived |
| I0020 | Interaction | D0004 | Aufgabenliste und Board-Zuordnung | rot | US der Anforderung |  |  |  | I0008, I0017 |  | alle Aufgaben, ohne Board, Archiv; auf Board legen und abnehmen |
| I0021 | Interaction | D0005 | Personenübersicht | rot | US der Anforderung |  |  |  | I0014 |  |  |
| I0022 | Interaction | D0006 | Stundenzettel und CSV | rot | US der Anforderung |  |  |  | I0014 |  |  |
| I0023 | Interaction | D0006 | Burndown und Durchlaufzeit | rot | US der Anforderung |  |  |  | I0006 |  | aus der Git-Geschichte |
| I0024 | Interaction | D0007 | Agent arbeitet über die API | rot | US der Anforderung |  |  |  | I0005 |  | Beschreibung unter /api, Identität je Aufruf |
| I0025 | Interaction | D0002 | Defekte Dateien zeigen | rot | US der Anforderung |  |  |  | I0004 |  |  |
| I0026 | Interaction | D0002 | Tastaturbedienung | rot | US der Anforderung |  |  |  | I0006 |  |  |

## Offene Fragen

## Notizen / Quellen

- Zielbild: Anforderungen/R00000-vision.md (Stand 2026-10-18)
- Gestaltung: Dokumentation/Wireframes/ (Prototyp und Token-Sheet)
- Angelegt im Lauf `/anwendung` ohne Interview (Anmerkungen in kanbanD-anmerkungen.md)
