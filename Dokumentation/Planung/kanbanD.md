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
| D0001 | Dialog | A0001 | Start und Einrichtung | gruen | alle Interactions gruen |  |  |  |  | R00001 |  |
| D0002 | Dialog | A0001 | Board | gelb | alle Interactions gruen |  |  |  |  | R00004 |  |
| D0003 | Dialog | A0001 | Aufgabe | gruen | alle Interactions gruen |  |  |  |  | R00011 |  |
| D0004 | Dialog | A0001 | Aufgabenliste | gruen | alle Interactions gruen |  |  |  |  | R00020 |  |
| D0005 | Dialog | A0001 | Personen | gruen | alle Interactions gruen |  |  |  |  | R00021 |  |
| D0006 | Dialog | A0001 | Berichte | gruen | alle Interactions gruen |  |  |  |  | R00022 |  |
| D0007 | Dialog | A0001 | Agenten-Schnittstelle | gruen | alle Interactions gruen |  |  |  |  | R00024 | ohne eigenen Bildschirm ausser der API-Beschreibung |
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
| I0007 | Interaction | D0002 | Live-Aktualisierung | gruen | US-1..US-3 |  |  |  | I0004 | R00007 | Dateiwächter und Ereignisstrom, Marke extern |
| B0021 | Bubble | I0007 | Ordner beobachten | gruen | Test gruen | Dateiänderungen → gebündeltes Ereignis mit Pfaden, eigene oder extern | 1-2 |  |  |  |  |
| B0022 | Bubble | I0007 | Ereignisstrom | gruen | Test gruen | Ereignisse → GET /api/ereignisse (Server-Sent Events) | 0,5-1 |  |  |  |  |
| B0023 | Bubble | I0007 | Sichten nachziehen | gruen | Test gruen | Ereignis → neu laden, Marke extern 10 s, Verbindungsmarke | 1-2 |  |  |  |  |
| I0008 | Interaction | D0002 | Boards wechseln und anlegen | gruen | US-1..US-3 |  |  |  | I0003, I0004 | R00008 |  |
| B0024 | Bubble | I0008 | Board anlegen | gruen | Test gruen | Titel, Spalten, Person → boards/<slug>.md, ein Commit; POST /api/boards | 0,5-1 |  |  |  |  |
| B0025 | Bubble | I0008 | Board-Umschalter | gruen | Test gruen | Klick auf den Boardnamen → Liste der Boards, Wechsel, neues Board | 1-2 |  |  |  |  |
| I0009 | Interaction | D0002 | Spalten einrichten | gruen | US-1..US-3 |  |  |  | I0008 | R00009 | anlegen, umbenennen, umsortieren, leere entfernen, Grenze |
| B0026 | Bubble | I0009 | Spalten neu ordnen | gruen | Test gruen | Board + Spaltenliste (Name, alter Name, Grenze) → Board oder Fehler | 0,5-1 |  |  |  |  |
| B0027 | Bubble | I0009 | Spalten speichern | gruen | Test gruen | PUT /api/boards/<slug>/spalten → Board-Datei, ein Commit | 0,5-1 |  |  |  |  |
| B0028 | Bubble | I0009 | Einrichtemodus Spalten | gruen | Test gruen | Spalten bearbeiten, Vorschau, Fertig/Verwerfen; Grenze überschritten sichtbar | 1-2 |  |  |  |  |
| I0010 | Interaction | D0001 | Personen und Klassen pflegen | gruen | US-1..US-3 |  |  |  | I0003 | R00010 | stilllegen statt entfernen |
| B0029 | Bubble | I0010 | Einstellungen prüfen und speichern | gruen | Test gruen | Personen, Klassen, Quellen → kanbanD.md, ein Commit; PUT /api/einstellungen | 1-2 |  |  |  |  |
| B0030 | Bubble | I0010 | Seite Einrichten | gruen | Test gruen | Personen anlegen/umbenennen/stilllegen, Klassen mit Farbe → Speichern | 1-2 |  |  |  |  |
| I0011 | Interaction | D0003 | Aufgabe ansehen und bearbeiten | gruen | US-1..US-4 |  |  |  | I0005 | R00011 | Titel, Beschreibung, Klasse, Zuständige, Labels, Fälligkeit |
| B0031 | Bubble | I0011 | Aufgabe ändern | gruen | Test gruen | Aufgabe + Änderung (Titel, Beschreibung, Klasse, Zuständige, Labels, Fälligkeit) → Aufgabe oder Fehler | 0,5-1 |  |  |  |  |
| B0032 | Bubble | I0011 | Aufgabe lesen und ändern über die API | gruen | Test gruen | GET/PATCH /api/aufgaben/<nr> → Datei, ein Commit; defekt = nur lesbar | 1-2 |  |  |  |  |
| B0033 | Bubble | I0011 | Aufgabenfenster | gruen | Test gruen | Klick auf Karte → Fenster mit Inhalt/Datei, Feldern, Blättern, Esc | 2-3 |  |  |  |  |
| I0012 | Interaction | D0003 | Teilaufgaben abhaken | gruen | US-1..US-2 |  |  |  | I0011 | R00012 |  |
| B0034 | Bubble | I0012 | Teilaufgaben über die API | gruen | Test gruen | POST/PATCH/DELETE /api/aufgaben/<nr>/teilaufgaben[/<i>] → Checkbox-Zeilen, ein Commit | 0,5-1 |  |  |  |  |
| B0035 | Bubble | I0012 | Teilaufgaben im Fenster | gruen | Test gruen | Klick hakt ab, + Teilaufgabe · Enter, ✕ entfernt | 0,5-1 |  |  |  |  |
| I0013 | Interaction | D0003 | Kommentieren | gruen | US-1..US-2 |  |  |  | I0011 | R00013 |  |
| B0036 | Bubble | I0013 | Kommentar über die API | gruen | Test gruen | Text + Person + Uhrzeit → Zeile im Block kanbanD-comments, ein Commit | 0,5-1 |  |  |  |  |
| B0037 | Bubble | I0013 | Kommentare im Fenster | gruen | Test gruen | Liste mit Person und Zeit, + Kommentar · Enter | 0,5-1 |  |  |  |  |
| I0014 | Interaction | D0003 | Timer starten und stoppen | gruen | US-1..US-3 |  |  |  | I0011 | R00014 | mehrere gleichzeitig, fremde stoppbar, Kopfzeile N laufen |
| B0038 | Bubble | I0014 | Timer über die API | gruen | Test gruen | start/stop → laufende Zeile mit ... bzw. Ende, ein Commit je Aktion | 1-2 |  |  |  |  |
| B0039 | Bubble | I0014 | Timer im Fenster und auf der Karte | gruen | Test gruen | Läuft gerade, Start-Knopf, Plakette mit mitlaufender Dauer | 1-2 |  |  |  |  |
| B0040 | Bubble | I0014 | Laufende Timer in der Kopfzeile | gruen | Test gruen | N laufen → Liste aller laufenden Timer, fremde stoppbar | 0,5-1 |  |  |  |  |
| I0015 | Interaction | D0003 | Zeiten nachtragen und korrigieren | gruen | US-1..US-3 |  |  |  | I0014 | R00015 |  |
| B0041 | Bubble | I0015 | Dauer lesen | gruen | Test gruen | „0:45“, „1,5“, „90 min“ → Minuten | 0,5-1 |  |  |  |  |
| B0042 | Bubble | I0015 | Zeiten über die API | gruen | Test gruen | nachtragen, korrigieren, löschen → Zeile im Block kanbanD-time, ein Commit | 1-2 |  |  |  |  |
| B0043 | Bubble | I0015 | Zeiten im Fenster | gruen | Test gruen | Tabelle der Zeiten mit Summe, ✎ korrigieren, ✕ löschen, + Zeit nachtragen | 1-2 |  |  |  |  |
| I0016 | Interaction | D0003 | Anhänge verwalten | gruen | US-1..US-2 |  |  |  | I0011 | R00016 |  |
| B0044 | Bubble | I0016 | Anhangname bereinigen | gruen | Test gruen | Dateiname vom Browser → sicherer, freier Name im Anhangordner | 0,5-1 |  |  |  |  |
| B0045 | Bubble | I0016 | Anhänge über die API | gruen | Test gruen | hochladen, auflisten, ausliefern, entfernen → aufgaben/<stamm>/, ein Commit | 1-2 |  |  |  |  |
| B0046 | Bubble | I0016 | Anhänge im Fenster | gruen | Test gruen | Liste mit Link und Größe, Datei wählen oder hineinziehen, ✕ entfernt | 1-2 |  |  |  |  |
| I0017 | Interaction | D0003 | Archivieren und zurückholen | gruen | US-1..US-3 |  |  |  | I0011 | R00017 |  |
| B0047 | Bubble | I0017 | Archivieren über die API | gruen | Test gruen | archivieren (Datum, laufende Timer stoppen) / zurückholen → Aufgabendatei, ein Commit | 0,5-1 |  |  |  |  |
| B0048 | Bubble | I0017 | Archiv im Fenster und auf dem Board | gruen | Test gruen | ▭ im Fenster, Hinweis mit rückgängig, Archiv (N) in der Abschlussspalte, Archivansicht | 1-2 |  |  |  |  |
| I0018 | Interaction | D0003 | Herkunft und Abhängigkeiten | gruen | US-1..US-3 |  |  |  | I0011 | R00018 | origins mit Editor-Link, WBS-Braucht als wartet auf |
| B0049 | Bubble | I0018 | Herkunft ändern | gruen | Test gruen | Aufgabe + Herkunftsliste (I0001, R00014, thin air) → Aufgabe oder Fehler | 0,5-1 |  |  |  |  |
| B0050 | Bubble | I0018 | WBS und Anforderungen auflösen | gruen | Test gruen | Quellpfade + Herkunft → Datei, Zeile, Name, Status, Braucht; GET /api/herkunft | 1-2 |  |  |  |  |
| B0051 | Bubble | I0018 | Herkunft und Wartet-auf zeigen | gruen | Test gruen | Chips mit Editor-Link, hinzufügen/entfernen, wartet auf #n an Karte und Fenster | 1-2 |  |  |  |  |
| I0019 | Interaction | D0002 | Filtern | gruen | US-1..US-3 |  |  |  | I0005, I0010 | R00019 | Text, class:, origin:, @person, is:archived |
| B0052 | Bubble | I0019 | Filter auswerten | gruen | Test gruen | Filtertext + Aufgabe → passt/passt nicht (Text, #nr, @kürzel, class:, origin:, label:, is:archived) | 1-2 |  |  |  |  |
| B0053 | Bubble | I0019 | Filterleiste und Legende | gruen | Test gruen | Eingabe in der Kopfzeile, alle/meine/Agenten, Legende der Klassen mit Zahl, / setzt den Fokus | 1-2 |  |  |  |  |
| I0020 | Interaction | D0004 | Aufgabenliste und Board-Zuordnung | gruen | US-1..US-3 |  |  |  | I0008, I0017 | R00020 | alle Aufgaben, ohne Board, Archiv; auf Board legen und abnehmen |
| B0054 | Bubble | I0020 | Auf Board legen und abnehmen | gruen | Test gruen | Board + Nummer (+ Spalte) → Zeile anhängen bzw. entfernen, ein Commit | 1-2 |  |  |  |  |
| B0055 | Bubble | I0020 | Alle Boards liefern | gruen | Test gruen | boards/*.md → GET /api/boards mit Struktur | 0,5-1 |  |  |  |  |
| B0056 | Bubble | I0020 | Aufgabenliste | gruen | Test gruen | #/aufgaben: alle/ohne Board/archiviert, Liegt auf, auf Board legen, abnehmen, anlegen ohne Board | 2-3 |  |  |  |  |
| I0021 | Interaction | D0005 | Personenübersicht | gruen | US-1..US-2 |  |  |  | I0014 | R00021 |  |
| B0057 | Bubble | I0021 | Personenzahlen rechnen | gruen | Test gruen | Aufgaben, Personen, Jetzt, Board → je Person läuft, heute, Woche, Tagesleiste, offen, begonnen, Gruppe | 1-2 |  |  |  |  |
| B0058 | Bubble | I0021 | Seite Personen | gruen | Test gruen | #/personen nach D0005: Gruppen, Tagesleiste, Stopp, Klick filtert das Board | 1-2 |  |  |  |  |
| I0022 | Interaction | D0006 | Stundenzettel und CSV | gruen | US-1..US-3 |  |  |  | I0014 | R00022 |  |
| B0059 | Bubble | I0022 | Zeiten als CSV | gruen | Test gruen | Aufgaben + Personen → CSV je Zeiteintrag; GET /api/berichte/zeiten.csv | 0,5-1 |  |  |  |  |
| B0060 | Bubble | I0022 | Stundenzettel und Kreuztabelle rechnen | gruen | Test gruen | Aufgaben, Person, Woche → Aufgabe × Tag; Zeitraum → Aufgabe × Person | 1-2 |  |  |  |  |
| B0061 | Bubble | I0022 | Menü Berichte | gruen | Test gruen | Berichte ▾ → Stundenzettel, Zeiten nach Aufgabe und Person, CSV | 1-2 |  |  |  |  |
| I0023 | Interaction | D0006 | Burndown und Durchlaufzeit | gruen | US-1..US-2 |  |  |  | I0006 | R00023 | aus der Git-Geschichte |
| B0062 | Bubble | I0023 | Verlauf rechnen | gruen | Test gruen | Stände der Board-Datei mit Zeitpunkt → offen je Tag, Umfang, Durchlaufzeit je Aufgabe | 1-2 |  |  |  |  |
| B0063 | Bubble | I0023 | Stände aus Git lesen | gruen | Test gruen | git log + git cat-file --batch → Stände der Board-Datei; GET /api/berichte/verlauf | 1-2 |  |  |  |  |
| B0064 | Bubble | I0023 | Burndown und Durchlaufzeit zeigen | gruen | Test gruen | Linie offen je Tag mit Umfang, Hover, Tabelle der Durchlaufzeiten | 1-2 |  |  |  |  |
| I0024 | Interaction | D0007 | Agent arbeitet über die API | gruen | US-1..US-2 |  |  |  | I0005 | R00024 | Beschreibung unter /api, Identität je Aufruf |
| B0065 | Bubble | I0024 | Endpunkte beschreiben | gruen | Test gruen | Endpunkttabelle → GET /api (HTML) und GET /api/endpunkte (JSON) | 1-2 |  |  |  |  |
| B0066 | Bubble | I0024 | Agentenlauf Ende-zu-Ende | gruen | Test gruen | Agent legt an, bewegt, kommentiert, misst Zeit nur über die API → Commits unter seinem Namen | 1-2 |  |  |  |  |
| I0025 | Interaction | D0002 | Defekte Dateien zeigen | gruen | US-1..US-3 |  |  |  | I0004 | R00025 |  |
| B0067 | Bubble | I0025 | Defekte Aufgaben auf dem Board | gruen | Test gruen | defekte Aufgabendatei → Karte mit Fehlerzeile, Fenster nur lesbar mit Dateitext | 1-2 |  |  |  |  |
| B0068 | Bubble | I0025 | Defektes Board und defekte Einstellungen | gruen | Test gruen | Board-Datei oder kanbanD.md defekt → Hinweisfläche mit Fehler und Editor-Link; Liste aller defekten Dateien | 1-2 |  |  |  |  |
| I0026 | Interaction | D0002 | Tastaturbedienung | gruen | US-1..US-3 |  |  |  | I0006 | R00026 |  |
| B0069 | Bubble | I0026 | Tastaturziele rechnen | gruen | Test gruen | sichtbare Spalten, Karte, Richtung → Nachbarkarte bzw. Ziel zum Verschieben | 0,5-1 |  |  |  |  |
| B0070 | Bubble | I0026 | Tastaturkürzel auf dem Board | gruen | Test gruen | Pfeile, Umschalt+Pfeile, Enter, n, ? → Fokus, Bewegen, Öffnen, neue Karte, Hilfe | 1-2 |  |  |  |  |
| I0027 | Interaction | D0002 | Mehrere Aufgaben auf einmal anlegen | gruen | US-1..US-3 |  |  |  | I0005 | R00027 | UX-Überarbeitung: Mehrzeilig einfügen → je Zeile eine Aufgabe, ein Commit; auch Teilaufgaben und Aufgabenliste |
| B0071 | Bubble | I0027 | Zeilen aus eingefügtem Text | gruen | Test gruen | eingefügter Text → Titel je Zeile ohne Listenzeichen | 0,5-1 |  |  |  |  |
| B0072 | Bubble | I0027 | Mehrere anlegen über die API | gruen | Test gruen | Titelliste → Aufgaben bzw. Teilaufgaben, ein Commit | 1-2 |  |  |  |  |
| B0073 | Bubble | I0027 | Einfügen in Bahn, Liste und Teilaufgaben | gruen | Test gruen | Einfügen mehrzeiligen Texts → Rückfrage-freies Anlegen aller Zeilen | 1-2 |  |  |  |  |
| I0028 | Interaction | D0002 | Schnelleingabe mit Kürzeln | gruen | US-1..US-2 |  |  |  | I0027 | R00028 | UX-Überarbeitung: @kürzel, class:, label:, due:, I0001/R00001 im Titel setzen die Felder beim Anlegen |
| B0074 | Bubble | I0028 | Schnelleingabe auswerten | gruen | Test gruen | Titeltext + Personen/Klassen + heute → Titel und Felder | 1-2 |  |  |  |  |
| B0075 | Bubble | I0028 | Felder beim Anlegen | gruen | Test gruen | Titel + Felder → Aufgabe mit Klasse, Zuständigen, Labels, Fälligkeit, Herkunft; geprüft wie beim Ändern | 0,5-1 |  |  |  |  |
| B0076 | Bubble | I0028 | Vorschau beim Tippen | gruen | Test gruen | Eingabe → Vorschau der erkannten Felder unter dem Feld, Anlegen mit Feldern | 1-2 |  |  |  |  |
| I0029 | Interaction | D0002 | Karte direkt bedienen | gruen | US-1..US-3 |  |  |  | I0014 | R00029 | UX-Überarbeitung: Timer, mir zuweisen, umbenennen direkt an der Karte; Fälligkeit per Knopf |
| B0077 | Bubble | I0029 | Aktionen an der Karte | gruen | Test gruen | Zeigen/Fokus → Leiste mit Timer und mir zuweisen; Tasten t und m | 1-2 |  |  |  |  |
| B0078 | Bubble | I0029 | Umbenennen an der Karte | gruen | Test gruen | Doppelklick oder F2 → Titel im Feld, Enter speichert, Esc verwirft | 0,5-1 |  |  |  |  |
| B0079 | Bubble | I0029 | Fälligkeit per Knopf | gruen | Test gruen | heute, morgen, +1 Woche, entfernen im Fenster | 0,5-1 |  |  |  |  |
| I0030 | Interaction | D0003 | Beschreibung als Markdown lesen | gruen | US-1..US-2 |  |  |  | I0011 | R00030 | UX-Überarbeitung: gerendert lesen, Klick bearbeitet |
| B0080 | Bubble | I0030 | Markdown darstellen | gruen | Test gruen | Markdown-Text → sicheres HTML (Überschriften, Listen, Hervorhebung, Code, Links, Zitat) | 1-2 |  |  |  |  |
| B0081 | Bubble | I0030 | Lesen und Bearbeiten wechseln | gruen | Test gruen | Klick auf die gelesene Beschreibung → Textfeld, Verlassen speichert und zeigt wieder gelesen | 0,5-1 |  |  |  |  |
| I0031 | Interaction | D0002 | Rückgängig | gruen | US-1..US-3 |  |  |  | I0006 | R00031 | UX-Überarbeitung: Hinweis mit rückgängig nach Bewegen, Anlegen, Entfernen |
| B0082 | Bubble | I0031 | Rückgängig für Bewegen | gruen | Test gruen | Bewegung (Ziehen, Tastatur, Spaltenwahl) → Hinweis; rückgängig bewegt an die alte Stelle zurück | 1-2 |  |  |  |  |
| B0083 | Bubble | I0031 | Rückgängig für Anlegen und Strg+Z | gruen | Test gruen | Anlegen → Hinweis; rückgängig archiviert die neuen Aufgaben; Strg+Z löst den letzten Hinweis aus | 1-2 |  |  |  |  |
| I0032 | Interaction | D0002 | Sitzung und Verbindung | gruen | US-1..US-3 |  |  |  | I0007 | R00032 | UX-Überarbeitung: letztes Board merken, Wieder verbunden, Hinweise auf leeren Flächen |
| B0084 | Bubble | I0032 | Letztes Board und Fenstertitel | gruen | Test gruen | Boardwahl → im Browser gemerkt; Titel zeigt Board und laufende Timer | 0,5-1 |  |  |  |  |
| B0085 | Bubble | I0032 | Wieder verbunden und leere Flächen | gruen | Test gruen | Verbindung zurück → Hinweis; leeres Board → Hilfetext zu + Karte, n und Einfügen | 0,5-1 |  |  |  |  |
| I0033 | Interaction | D0002 | Kontextmenü der Karte | rot | US-1..US-3 |  |  |  | I0029 | R00033 | UX-Überarbeitung 2: Rechtsklick oder Menütaste: öffnen, Timer, mich, umbenennen, verschieben, Klasse, Fälligkeit, Board, archivieren |
| B0086 | Bubble | I0033 | Menü der Karte zusammenstellen | rot | Test gruen | Aufgabe + Board + Person → Menüeinträge mit Kürzeln und Untermenüs; Tastennavigation im Menü | 1-2 |  |  |  |  |
| B0087 | Bubble | I0033 | Kontextmenü zeigen und bedienen | rot | Test gruen | Rechtsklick, Menütaste oder Umschalt+F10 → Menü an der Karte, Maus und Tastatur, Untermenüs | 2-3 |  |  |  |  |
| B0088 | Bubble | I0033 | Neue Kartenkürzel | rot | Test gruen | a archivieren, 1–9 in Spalte n, c Verweis kopieren | 0,5-1 |  |  |  |  |
| I0034 | Interaction | D0002 | Kontextmenüs für Spalten und Listen | rot | US der Anforderung |  |  |  | I0033 |  | UX-Überarbeitung 2: Spaltenkopf: Karte hinzufügen, alle archivieren, Spalten einrichten; Zeilen der Aufgabenliste |
| I0035 | Interaction | D0002 | Tastenkürzel überall | rot | US der Anforderung |  |  |  | I0026 |  | UX-Überarbeitung 2: g-Folgen für Seiten, Kürzel im Fenster und in der Aufgabenliste, Hilfe je Ort |

## Offene Fragen

## Notizen / Quellen

- Zielbild: Anforderungen/R00000-vision.md (Stand 2026-10-18)
- Gestaltung: Dokumentation/Wireframes/ (Prototyp und Token-Sheet)
- Angelegt im Lauf `/anwendung` ohne Interview (Anmerkungen in kanbanD-anmerkungen.md)
