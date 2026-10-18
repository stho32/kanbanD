---
application: kanbanD
wbs: Dokumentation/Planung/kanbanD.md
betrieb: lokal
canvas:
seed: .claude/wireframes/kanbanD.html
art: prototyp
richtung: Blaugrau, eckig, dicht — IBM Plex Sans/Mono, dunkle Kopfzeile, Zeile 28 px (kd-tokens.css)
stand: 2026-10-18
zurueckgeholt: 2026-09-26
---

# Wireframes — kanbanD

## Richtung

Die Richtung ist der gesehene Entwurf vom 2026-09-26 (`kanbanD Prototyp.html`,
`kanbanD Board.html`, `kanbanD Personen.html`): blaugrau, ohne Radius, auf Platz und
Nutzbarkeit optimiert. Alle Werte stehen in `kd-tokens.css`, Grundformen in
`kd-base.css`. Dunkle Kopfzeile 40 px mit drei Zonen (Ort · Navigation ·
Bedienung), Bahnen stoßen tabellenartig aneinander, Karten mit hell getöntem
Grund und Rand in Klassenfarbe. Ein Richtungsvergleich entfällt: es gibt ein
Design-System im Repository.

## Entscheidungen

| Datum | Frage | Entscheidung | Grund |
|---|---|---|---|
| 2026-09-26 | Richtung | Token-Sheet `kd-tokens.css` | im Entwurfsexport gesehen und abgelegt |
| 2026-10-18 | Betriebsart | `lokal` | kein Canvas veröffentlicht; Arbeitsdateien sind der einzige Ort |
| 2026-10-18 | Board-Datei statt `board.yaml` | Board ist Markdown im Boardverzeichnis, Einstellungen in `kanbanD.md`; die Ansichten bleiben | Vision-Fortschreibung 2026-10-18 |
| 2026-10-18 | Artboards D0002, D0003, D0005, D0006 | aus dem gesehenen Prototyp festgehalten (DOM-Abzug mit Token-CSS inline) | Richtung steht; kein Neuentwurf nötig. D0002 nachgereicht — S3 war in Runde I0004 übersprungen |
| 2026-10-18 | Artboard D0004 Aufgabenliste | Neuentwurf in der Richtung: Tabelle mit „Liegt auf“, Bereiche alle/ohne Board/archiviert | Dialog fehlte im Prototyp |
| 2026-10-18 | „Kein Git in der Oberfläche“ | bleibt für Pull/Push/Merge; kanbanD committet jede eigene Aktion, ohne Git-Bedienung in der Oberfläche | Vision-Fortschreibung 2026-10-18 |

## Offene Fragen
