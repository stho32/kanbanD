# kanbanD — Neuentwurf (gilt vor allem Folgenden)
- Stil: blaugrau, **eckig (kein Radius)**, auf Platz und Nutzbarkeit optimiert, praktisch. Token-Sheet `kd-tokens.css` (IBM Plex Sans/Mono, dunkle Kopfzeile, Zeile 28px).
- **Genau ein Board** je Anwendung — keine Board-Übersicht (`kanbanD Board-Übersicht.html` verworfen).
- Board = **Ordner**; Karten = Markdown-Dateien mit Frontmatter, flach in einem Ordner; Spalte als Frontmatter-Feld `column:`; Spalten + Reihenfolge in einer Board-Datei (`board.yaml`/`board.md`). Git-kompatibel.
- Frontmatter-Schlüssel **englisch** (`title`, `column`, `id`, `assignees` (Liste, mehrere), `labels`, `due`). Erweiterte Daten (z. B. Zeiterfassung) als **Codeblock in festem Format** im Markdown-Körper.
- Karte: `id` = fortlaufender Zähler des Boards (Anzeige `#12`), **keine Klassen**. Teilaufgaben als Markdown-Checkboxen. Kommentare erlaubt (Codeblock `kanbanD-comments`). Zeiten als Codeblock `kanbanD-time` (Zeile: Beginn · Ende · wer; `...` = läuft). **Mehrere Timer gleichzeitig** je Karte (Mensch + Agent, mehrere Menschen); fremde stoppbar.
- **Speichern sofort** bei jeder Änderung; Board und Ordner immer im Sync (auch Änderungen von außen werden übernommen: still, mit kurzer Marke „extern · Datei · vor N Sek" an der Karte, ~10 s; keine Konfliktwarnung).
- Karte trägt `origins:` (Liste, mehrere möglich): WBS-Knoten (`I0001`), Anforderung (`R00014`) oder `thin air` (ohne Herkunft). Sichtbar auf der Karte. Klick öffnet die Quelldatei in **VS Code** (`vscode://file/…:zeile`); Pfade der Quellen (WBS, Anforderungen) stehen in `board.yaml`. Filterbar per `origin:I0023` bzw. `origin:"thin air"`.
- **Farbklassen**: in `board.yaml` unter `classes:` (Schlüssel → label + color, z. B. bug/gelb, critical/rot, feature/grün); Karte trägt höchstens eine `class:`. Karte = hell getönter Grund + Rand in Klassenfarbe. Filter `class:bug`.
- Spalten, Klassen und **Personen** (`people:` Schlüssel → name + kind human/agent) werden in einem **separaten Modus „Board einrichten"** gepflegt (schreibt `board.yaml`). „Ich bin …" wählt aus den Menschen in `people:`; Agenten nicht wählbar. Personen werden nicht entfernt, sondern **stillgelegt** (`active: false`): nicht wählbar/zuweisbar, Name bleibt überall lesbar, zurückholbar.
- Kopfzeile „N laufen" öffnet Liste aller laufenden Timer (Person, Karte, Dauer, Stopp; fremde stoppbar).
- Navigation: **Board · Personen · Berichte ▾**. „Personen" = Übersicht der aktiven Personen (läuft jetzt, Tagesleiste, heute/Woche, offene Zuweisungen). Rückblickendes (Stundenzettel, Karte × Person, CSV-Export) im Menü „Berichte"; Berichte lesen nur — Zeiten werden **nur an der Karte** nachgetragen/korrigiert (Stundenzettel verlinkt auf die Karte).
- **Archivieren** an der Karte (Modal): schreibt `archived: <datum>` ins Frontmatter, Datei bleibt liegen, laufende Timer werden gestoppt, Hinweis mit „rückgängig“. Archiv über `is:archived` bzw. Link „Archiv (N)“ in der Abschlussspalte; Zeiten zählen in Berichten weiter.
- **Erster Start** in einem Ordner ohne `board.yaml`: eine Seite mit Spalten (letzte = Abschluss), „ich“ (Kürzel + Name), optionalen Agenten und Origin-Pfaden, live-Vorschau der `board.yaml`; legt nur diese Datei an.
- **Kein Git in der Oberfläche** — kanbanD schreibt nur Dateien; Commits/Pull/Push außerhalb.
- Vorgehen: Elemente einzeln durchgehen, eins nach dem anderen, im Dialog (kein Formular).

# kanbanC — Designwissen (Herkunft) (Stand Export kanbanC main @ dca237c, 2026-09-26)

Quelle: `uploads/kanbanC-Design/`. Das ist maßgeblich — frühere Annahmen im Prototyp (`KanbanC Prototyp.html`) sind dort, wo sie abweichen, veraltet.

## Verbindlich
- Zieldesign = `1-Zieldesign/Wireframes/D0001…D0009.dc.html` (je Dialog der WBS ein Artboard) + `Main.dc.html` (Screen-Flow). Der ältere Satz (`kanbanc-wireframes.html`, 8 Schirme mit Varianten) ist nur noch Steinbruch.
- `_wireframes.md` trägt alle Entscheidungen + 35 offene Fragen. Vor jeder Änderung dort nachsehen.
- Token-Sheet `2-Umsetzung/wwwroot/gestaltung.css` (= Organic-Tokens, aber eigene Klassen): `.btn-haupt/-neben/-schlicht/-symbol/-breit`, `.input`, `.radio`, `.seg`, `.card`, `.tag-*`, `.table`, `.dialog`; dazu `oberflaeche.css`: `.seitenkopf`, `.meldung(-abweisung)`, `.kontrollfeld`, `.kuerzel-mensch/-agent/-abgebildet/-niemand`.
- Keine Literale in Komponenten-CSS, kein CSS-Framework, Fonts lokal (kein Google im Produkt).
- Haltung „Kanbanflow-dicht", aber warm/rund. Deutsch, echte Umlaute in UI-Texten.
- API kann alles, was die UI kann (Agent gleichberechtigt). Full-Trust im LAN, keine Anmeldung.

## Gebauter Stand (Blazor)
- Routen: `/boards`, `/boards/{id}`, `/boards/{id}/import`, `/karten/{id}`, `/auswertungen`, `/kontributoren`.
- **Kopfzeile, drei Zonen, keine Wortmarke:** Z1 Seitentitel bzw. Boardname mit Rückweg; Z2 Navigation Boards · Auswertungen · Kontributoren (Boards ausgeblendet, wenn Board offen); Z3 Board-Bedienung (Layout-Schalter, Kartenzahl-`.kontrollfeld`), Verbindungsmarke nur bei Abbruch („nicht live · Stand von …"), Laufzeit-Plakette nur wenn Timer laufen (Popover „Läuft gerade …", fremde stoppbar), Identität als Popover „Ich bin …" (Variante C; Text „nicht gewählt"; Timer erzwingt Wahl).
- **Board:** Bahnen 16rem, stoßen tabellenartig aneinander (gemeinsame Trennlinien, kein Gap, kein Radius), Bahn `--color-surface`, Karte `--color-bg`, Kartenradius `--radius-xs` 4px. Kopf: Bezeichnung (Caprasimo 15px), Abschluss mit ✓ (olive) + Vermerk „Grenze 20", Kartenzahl rechts. Fuß jeder Bahn: `+ Karte`. Abschlussbahn nach Datumsgruppen (Versal 11px), „Ältere nachladen" in der Fläche.
- **Karte:** ⋯-Menü (Details öffnen · Archivieren, mit Hinweiszeilen), Plakettenzeile (Nummer `.tag-neutral` links, Timer rechts: eigen = gefüllt Akzent, fremd = neutral), Titel als unterstrichener Link auf `/karten/{id}`, Einflugmarke bei fremder Bewegung (Akzentkante links + Fußzeile „Wer · Weg · wann", ~10 s). Drag: Einfügelinie 2px Akzent, obere/untere Hälfte = davor/dahinter.
- Avatar-Farben = Art: Mensch olive, Agent terrakotta, abgebildet neutral gestrichelt. „Für mich" nie über Farbton, sondern Füllung.

## Entschiedene Richtungen (weichen vom alten Prototyp ab)
- Kartendetail = **eigene Seite** (C), keine Schublade. Kein Verlauf (kein WBS-Knoten).
- Live: **keine** Aktivitätsspur, **kein** Laufband, kein dauerhaftes „● live". Stattdessen Einflugmarken; Angebot statt Austausch in offenen Feldern; Abbruch = Fläche gedämpft (`--filter-zurueckgenommen`), Dauern halten an; Aufschließen mit Band „Wieder verbunden · N Änderungen nachgeholt".
- Klassen: im Layout-Modus unter „neue Spalte"; Name + Nummernkreis-Präfix; kein Ändern/Entfernen.
- WBS-Import: Einstieg im Layout-Modus, dann `/boards/{id}/import` in 3 Schritten (Datei · Vorschau mit Baum links/Wirkung rechts + Regler **Schnittebene**, Vorgabe Interaction · Bericht). Zweiter Lauf: 4 Fächer, „nicht mehr in der Datei" wird gemeldet, nicht gelöscht. Titel `[I0001] Name`.
- Auswertungen: eigener Schirm, Variante B (Umschalter links, eine Auswertung groß, API-Pfad im Fuß). Burndown = offene Karten über Kalendertage, **ohne** Soll-/Prognoselinie. Soll-Spalte gestrichelt (kein Soll im Bestand). Puffer/Fieberkurve **nicht** gezeichnet (offene Frage). Export = CSV je Zeiteintrag.
- Zeiten: keine eigene Kreuztabelle als Schirm; Zeiterfassung sitzt auf der Kartenseite.
- Standardspalten neuer Boards: Zu erledigen · In Arbeit · Erledigt. Termine ISO `yyyy-MM-dd`.
