# Logbuch — Director

Eine Zeile je Auftrag an eine Rolle und je Retrospektive.

| Datum | Karte | Phase | Rolle | Ergebnis | Dauer | Notiz |
|---|---|---|---|---|---|---|
| 2026-10-31 | — | Start | director | Auftrag eingerichtet: 15 Rollen, 9 Spalten, Board http://127.0.0.1:7422 (entwicklung), 6 Karten R00095–R00100 im Backlog; Sparbetrieb; UX-Durchsicht mit Material 3 läuft | — | Board-Ordner neu unter ~/Projekte/Kanban-Boards/kanbanD-Kanbanboard |
| 2026-10-31 | — | Start | ux-reviewer | befund: UX-Durchsicht mit Material 3, 10 Überarbeitungskarten #7–#16 oben ins Backlog (6 Muss, 3 Sollte, 1 Optional); #7 freigegeben | — | Screenshots im Scratchpad der Start-Session |
| 2026-10-31 | #7 | Architektur | architekt | bestanden: keine Technikfrage; Startmodell (A00001–A00009, X00001, X00002), ADR-0001 vorgeschlagen, be67b45 | 3 min | Gelesen-Zeile ohne gemeinsam/regeln.md und Rollenindex (Sparbetrieb) — hingenommen, weil die Arbeit nicht davon abhing |
| 2026-10-31 | #7 #14 | Detailplanung | planer, product-owner | bestanden: I0083/R00101, 6 Bubbles; PO 3 Fragen entschieden; Skizze vom Betreiber freigegeben; Reihenfolge: Features vor übrigen UX-Karten | — | |
| 2026-10-31 | #7 #14 | Entwicklung | entwickler | bestanden: 6 Bubbles, 9 Commits aea9362–ddeb2a5; Gate nachgefahren 347/113/227 grün; WBS B0263–B0268 grün | 18 min | Vertragsänderung ältere Specs (Menü „Mehr“) angenommen |
| 2026-10-31 | #7 #14 | Auto-Reviews | code-reviewer, ux-reviewer, rechtschreib-reviewer | bestanden: 0 Muss; Sollte/Optional auf Härtungskarte, Tastatur-Funde an #8 | — | ux auf Anweisung des Betreibers auf eigenes headless Chromium umgestellt |
| 2026-10-31 | #7 #14 | Entwicklertest | entwicklertester | bestanden: US-1–US-5, kein Befund; gepusht c4cab25; Erledigt; cargo install + Board 7422 neu gestartet | — | |
| 2026-10-31 | #7 #14 | Retrospektive | director | Lehren ins Projekt (headless per Skript, Mindest-Leseliste im Sparbetrieb, Token je Karte); keine allgemeine Lehre neu | — | |
| 2026-10-31 | #1–#6 | Architektur | architekt (fortgesetzt) | bestanden: Technikfrage bei #2 #3 #4 #5, ADR-0002–0005 akzeptiert, 4e7fd1a | — | +30.651 Tokens (fortgesetzt, 96.476 → 127.127), ≈ 5.100 je Karte |
| 2026-10-31 | #1 | Detailplanung | planer (frisch), product-owner (fortgesetzt) | bestanden: I0084, 5 Bubbles; PO 2 Fragen entschieden | — | planer 86.397 Tokens; PO +16.000 (73.200 → 89.421) für Preisetikett und R00095 |
| 2026-10-31 | #18 | Backlog | realist-consultant, product-owner | Preisetikett entschieden (PO 25ea662), Karte #18 angelegt | — | realist 67.924 Tokens |
| 2026-10-31 | #1 | Entwicklung | entwickler (entw1) | bestanden: B0269–B0273 grün, d831a6f–c966c7b; Gate 359/113/227 grün | 10 min | nachgetragen 2026-11-01 aus den Kartenkommentaren (Session-Abbruch 20:21) |
| 2026-10-31 | #1 | Auto-Reviews | code-reviewer | bestanden: 0 Muss; 2 Sollte als kleine Nacharbeit an entw1 (a9aad18, 360/0) | 2 min | nachgetragen; Optionales nicht übernommen (siehe Kartenkommentar) |
| 2026-10-31 | #1 | Entwicklertest | entwicklertester | bestanden: US-1–US-4, kein Befund; Zug nach Erledigt 20:21 ohne Push und Auslieferung (Abbruch) | 2 min | nachgetragen |
| 2026-11-01 | — | Fortsetzen | director | Board-Instanz 7422 neu gestartet; keine Timer offen, keine Worktrees; Gate a9aad18 nachgefahren vor Push von #1 | — | |
| 2026-11-01 | #1 | Auslieferung | director | Gate a9aad18 grün (360/113/227 ×2), gepusht origin 18b91d1, cargo install, Board 7422 neu (PID 35456), Probe label=UX/pr* ok | — | github-Remote unverändert (ed79243), wie bisher nur origin |
| 2026-11-01 | #1 | Retrospektive | director | Lehre ins Projekt: Zug nach Erledigt erst nach Push und Auslieferung; Neustart über PID-Datei. Keine allgemeine Lehre neu (Push-Regel steht schon in regeln.md) | — | Entwicklung 10 min, Nacharbeit 1 min |
| 2026-11-01 | #2 | Detailplanung | planer (frisch) | bestanden: I0085, F0005–F0009, B0274–B0284 (11 Bubbles, 8–16 h Hypothese), bace4a0; kein Schnitt, keine UX-Vorprüfung nötig; 2 Fragen an PO | 4 min | 119.449 Tokens; Agent a4384186 |
| 2026-11-01 | #2 | Detailplanung | product-owner (frisch) | bestanden: Frage 1 Warnung nur bei Zügen, Frage 2 erste Verletzung (links nach rechts, Board-Reihenfolge), 7e6591a; nichts richtungsweisend | 2 min | Agent a4ac9fec |
| 2026-11-01 | #2 | Detailplanung | planer (fortgesetzt) | bestanden: Nachtrag PO-Entscheidung in F0007–F0009, B0283, B0284, 34565e7 | 1 min | Agent a4384186, gesamt 124.583 Tokens |
| 2026-11-01 | #2 | Entwicklung | entwickler entw1 (frisch) | läuft: I0085 ab F0005 Walking Slice, Nachtbetrieb (nice 19, Job-Grenze 1) | — | — |
| 2026-11-01 | #18 | Backlog | realist-consultant, product-owner (frisch) | Auftraggeber-Wunsch Reiter „Kosten“ eingearbeitet: Schlüssel `cost` mit Positionen, Tokens nur Anzeige, Mitte auf der Karte, d83f29c; Währung an den Auftraggeber | 3 min | 74.518 + PO; Agents ae6b8408, a1ae8799 |
| 2026-11-01 | #18 | Backlog | product-owner (fortgesetzt) | Währung vom Auftraggeber entschieden: Dollar überall; Euro-Fassung (Z. 36–44, 2792e92) durch Korrektur gekippt (Z. 45–46, 3532694); keine Vision-Änderung | 2 min | Agent a1ae8799 |
| 2026-11-01 | #2 | Entwicklung | entwickler entw1 | bestanden: 11 Bubbles auf karte/2 (d65dc16…15312b7), I0085 grün, Gate laut Rolle 388/113/228; Director-Gegenprobe läuft | 21 min | 108.736 Tokens; Agent a0620a1e |
| 2026-11-01 | #2 | Auto-Reviews | code-reviewer (frisch) | läuft: main d263215 (Gegenprobe 388/113/228×2 grün); danach architektur-, rechtschreib-reviewer | — | — |
