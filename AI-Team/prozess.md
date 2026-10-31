# Prozess

Je Spalte des Boards: Art (`Team` bearbeitet der Director mit der Rolle, `Manuell` gehört dem Menschen), Rolle (nur bei Team), Phase der Phasen-Datei (falls die Spalte eine darstellt) und was in der Spalte getan wird. `python3 werkzeuge/board_aus_prozess.py <projekt>/AI-Team` schreibt die Spalten mit dieser Beschreibung als Notiz aufs Board.

| Spalte | Art | Rolle | Phase | Was hier getan wird |
|---|---|---|---|---|
| Ohne Mensch nicht lösbar | Manuell | — | — | Schleifen und Entscheidungen, die der Betreiber treffen muss |
| Backlog | Manuell | — | — | Sammlung; der Betreiber gibt frei, indem er Karten nach „Architektur“ legt; hier liegen auch die Karten „Besprechen: …“ aus PO und realist-consultant |
| Architektur | Team | architekt | — | prüfen, ob die Karte eine Technikfrage aufwirft; wenn ja entscheiden und als ADR festhalten, sonst sofort weiter; die erste Karte bringt das Architektur-Modell |
| Detailplanung | Team | planer, ux-reviewer | — | WBS-Knoten anlegen bzw. Interaction bis Bubble verfeinern, Anforderung schreiben oder abgleichen; ux-reviewer nur als Vorprüfung bei Oberfläche; fachspezialist auf Abruf bei neuen Begriffen |
| Entwicklung | Team | entwickler | Entwicklung | bauen, Test zuerst, Gate (`cargo test`, `node --test e2e/einheit/`, betroffene Playwright-Specs; volle Suite am Kartenende) |
| Nacharbeit | Team | entwickler | — | Muss-Befunde aus Auto-Reviews und Entwicklertest beheben (`entw2`, Worktree `kanbanD-entw2`, Zweig `nacharbeit/<nr>`), danach zurück in die Auto-Reviews, nur Rollen mit Befund wiederholen |
| Auto-Reviews | Team | code-reviewer, security-reviewer, ux-reviewer, rechtschreib-reviewer, architektur-reviewer, legacy-reviewer, observability-reviewer | — | Reviews parallel am selben Stand, je Rolle eine Teilaufgabe; code-reviewer immer, die übrigen nur, wenn die Karte ihr Thema berührt (Auswahl im Kommentar des Directors beim Zug) |
| Entwicklertest | Team | entwicklertester | Entwicklertest | User Story wörtlich im echten Programm auf einer Wegwerf-Instanz |
| Erledigt | Manuell | — | — | fertig: nach bestandenem Entwicklertest direkt hierher, ohne Abnahme-Spalte; beim Zug installiert der Director kanbanD neu und startet das Board neu (siehe „Auslieferung“); letzte Spalte, Abschlussspalte der Berichte |

Schleifen an den Menschen: Ohne Mensch nicht lösbar

## Sparbetrieb (Betreiber 2026-10-31)

Ein Wochenlimit für Tokens steht bevor. Ziel ist, möglichst viele Karten **ganz** fertigzustellen, bevor es greift, denn was begonnen und nicht abgeschlossen ist, bleibt bis zum Reset offen.

- **Nacheinander**: Es ist höchstens eine Karte zwischen „Architektur“ und „Entwicklertest“ unterwegs. Die nächste Karte wird erst freigegeben und gezogen, wenn die vorige in „Erledigt“ oder „Ohne Mensch nicht lösbar“ liegt. Es gibt keinen Vorlauf und keinen Puffer, und `entw2` baut nur, während `entw1` nicht baut.
- **Sparsam prüfen**: In den Auto-Reviews läuft `code-reviewer` immer, jede andere Rolle nur, wenn die Karte ihr Thema nachweislich berührt. Eine Wiederholung gibt es nur für Rollen mit Befund. Befunde, die nur über künstliche Fehlerinjektion erreichbar sind, gelten als `Sollte` und gehen auf eine Härtungskarte, nicht in die Nacharbeit.
- **Knappe Aufträge**: Der Director nennt jeder Rolle die Dateien und Abschnitte, die sie braucht, statt sie suchen zu lassen. Die Berichte bleiben im Berichtsformat, ohne Wiederholungen.
- **Rollen fortsetzen statt neu starten** (Betreiber 2026-10-31): planer, architekt, product-owner und entwickler werden für die nächste verwandte Karte bzw. für Nachträge per SendMessage fortgesetzt, solange ihr Kontext unter etwa 150.000 Tokens liegt (Wert aus der letzten Abschlussmeldung); darüber und bei fremdem Codebereich frisch starten. Prüfende Rollen (Reviews, Entwicklertest) starten je Karte frisch — der unabhängige Blick ist gewollt; nur ihre Wiederholung nach Nacharbeit an derselben Karte wird fortgesetzt. Die Agent-ID je Rolle hält der Director in der Logbuchzeile fest.
- **Reihenfolge der Karten** (Betreiber 2026-10-31, nach der UX-Durchsicht): erst #7/#14 (R00101), dann R00095 → R00096 → R00097 → R00098 → R00099 → R00100, danach die übrigen UX-Karten (#8–#13, #15, #16); Features der Wartungsfabrik bringen den größten Nutzen je Token.

## Auslieferung bei „Erledigt“ (Betreiber 2026-10-31)

Das Board, das der Betreiber für das Projekt beobachtet, ist zugleich die Instanz, auf der er die neuen Features sieht. Nach jedem Zug nach „Erledigt“:

1. `cargo install --path /home/shoff/Projekte/kanbanD --locked` (installiert nach `~/.cargo/bin/kanbanD`);
2. die Board-Instanz neu starten: alte PID beenden, `~/.cargo/bin/kanbanD /home/shoff/Projekte/Kanban-Boards/kanbanD-Kanbanboard --port 7422 --kein-browser` neu starten (losgelöst, PID in `.claude/factory/board.pid` des Projekts), `GET /api/zustand` muss antworten;
3. eine Logbuchzeile mit Version bzw. Commit. Schlägt die Installation fehl, bleibt die alte Instanz laufen, und die Karte wird eine Befundkarte.

Rückmeldungen gibt der Betreiber von sich aus („wenn ich was zu nörgeln habe, sage ich es“). Sie werden über den PO zu Karten im Backlog.

## Signal „Ich habe Fragen“ (Betreiber 2026-10-31)

Hat der Director eine Frage, die der Betreiber entscheiden muss (richtungsweisend laut product-owner, Freigabe einer Skizze, Konflikt mit der Vision), setzt er auf der betroffenen Karte das Signal `frage` („Ich habe Fragen“, orange; steht in der Reihenfolge der Signale vorn, die Karte trägt also seine Farbe) und schreibt die Frage als Kartenkommentar: ein Satz Kontext, nummerierte Optionen, Empfehlung zuerst. Dieselbe Frage stellt er auch in der Session. Ist sie beantwortet, nimmt er das Signal zurück und vermerkt die Antwort als Kommentar. Fragen ohne Karte bekommen eine Karte „Frage: …“ oben im Backlog.

## Token-Kosten je Karte (Betreiber 2026-10-31)

Nach jedem Rollenauftrag notiert der Director das Token-Volumen aus der Abschlussmeldung des Subagents; beim Zug nach „Erledigt“ steht auf der Karte ein Kommentar „Token-Kosten der Karte“ mit einer Zeile je Rollenauftrag und der Summe. Der Anteil des Directors ist nicht messbar und wird nicht geschätzt. Einmalige Aufträge für das ganze Board (z. B. eine Durchsicht) werden getrennt genannt, nicht auf eine Karte gerechnet. Die Logbuchzeile je Auftrag nennt die Tokens in der Notiz.

## Preisetikett je Karte (Betreiber 2026-10-31)

Sobald kanbanD ein Preisetikett an Aufgaben kennt (Wunsch des Betreibers vom 2026-10-31, beim product-owner in Klärung), stattet der Director **jede** Karte damit aus: beim Zug nach „Erledigt“ den Preis, der den API-Kosten entsprochen hätte (Grundlage: die Token-Kosten der Karte, Preise des verwendeten Modells, Annahme zur Aufteilung genannt). Bis dahin stehen Token-Kosten **und Preis** als Kartenkommentar (Betreiber 2026-10-31): Preis als API-Gegenwert mit Modellpreisen; lässt er sich nicht genau sagen, als Spanne von–bis (Betreiber 2026-10-31), mit der Annahme dahinter (heute: plausibel 85 % Cache-Lesen / 10 % Input / 5 % Output, Spanne alles-Cache bis alles-Output).
