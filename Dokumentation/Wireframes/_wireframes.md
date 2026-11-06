---
application: kanbanD
wbs: Dokumentation/Planung/kanbanD.md
betrieb: lokal
canvas:
seed: .claude/wireframes/kanbanD.html
art: prototyp
richtung: Blaugrau, eckig, dicht — IBM Plex Sans/Mono, dunkle Kopfzeile, Zeile 28 px (kd-tokens.css)
stand: 2026-11-06
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
| 2026-10-18 | Artboard D0007 Agenten-Schnittstelle | Seite /api: Satz zur Identität, Beispiel, Tabelle Methode · Pfad · Wer · Zweck nach Themen | Dialog ohne Vorbild im Prototyp |
| 2026-10-18 | „Kein Git in der Oberfläche“ | bleibt für Pull/Push/Merge; kanbanD committet jede eigene Aktion, ohne Git-Bedienung in der Oberfläche | Vision-Fortschreibung 2026-10-18 |
| 2026-11-01 | D0002 Zustand „Spalten mit Eigentümer“ (R00097, F0015) | angehängt unter dem Board, Hell und Dunkel: Kopfzeichen Mensch (Person, `--kd-mensch`) und Agent (Roboterkopf, `--kd-agent-ink`), 14 px SVG im Stil `svg.i` hinter dem Namen-Knopf vor ⓘ; zugeklappte Mensch-Spalte mit Zeichen über dem gedrehten Namen; „Spalten einrichten“ mit Auswahl „Eigentümer“, Hinweissatz (11 px, `--kd-muted`), unbekanntem Rohwert und Vorschau `column-owner` | Vorgabe vor B0297; PO-Entscheidungen #3 Z. 50–54; Kontrast ≥ 3:1 gegen `--kd-sunken` und `.bahn-kopf.ueber` in beiden Themen gerechnet |
| 2026-11-06 | D0006 Zustand „Bestand nach Labels“ (R00100, I0092) | angehängt unter den Berichten, Hell und Dunkel: Menügruppe BESTAND mit Tabellensymbol (Raster 3 × 3); Kopfleiste, Filterbox ohne Zeitraum, Achsenzeile „Zeilen“/„Spalten“/„⇄ Achsen tauschen“; Tabelle mit Eckzelle, sticky Köpfen, Summen wie die Kreuztabelle, Zelle `--c` mit Zellmarke `inset 3px` in `--cl`, Zahl als Link in `--kd-accent-ink` mit Fokusring in derselben Farbe; Legende ohne Filterwirkung, Erklärsatz; Ränder leer (mit/ohne Zurücksetzen), zu wenige Präfixe, ohne Person, Speicherfehler; Telefon 375 px mit Querscrollen nur der Tabelle | Vorgabe vor dem Bau von I0092, PO-Entscheidungen Z. 75–78; Daten aus dem Grundbestand von R00100, Klassenfarben der Beispiele gewählt (red, magenta, blue); Kontraste in beiden Themen gerechnet |
| 2026-11-06 | D0002 Zustand „Preisetikett“ (R00105, I0093) | angehängt unter dem Board, Hell und Dunkel: Etikett „≈ 1,10 $“ in r3 vor „Σ“ wie `.sum` (Plex Mono 11 px, `--kd-muted`, ohne Rahmen und Grund); Fälle Spanne, Einzelbetrag, EUR, ohne Etikett, volle r3-Zeile mit Umbruch bei 375 und 320 px (`.r3 .rechts` mit `flex-wrap`); Hinweis „0,60–1,60 $ · geschätzte API-Kosten“ als natives `title`; zugänglicher Name als visuell versteckter Text, „≈ …“ `aria-hidden`; auf eigener Klassenfarbe trägt das Etikett `--kd-text` | Vorgabe vor dem Bau von I0093; Kontrast `--kd-muted` auf `--kd-sunken` 5,48:1 hell / 8,30:1 dunkel, auf den 16 Klassengründen mindestens 5,40:1 / 5,60:1, mit Signal mindestens 4,60:1 / 4,73:1; auf hellen eigenen Farben fiele `--kd-muted` dunkel auf 2,57:1, `--kd-text` hält dort mindestens 4,68:1 |
| 2026-11-06 | D0003 Zustand „Reiter Kosten“ (R00105, I0093) | angehängt unter dem Aufgabenfenster, Hell und Dunkel: Reiterleiste Inhalt · Datei · Kosten im Aussehen von `.seg` als `tablist`, Fokusring 2 px `--kd-accent-ink`; Panel in voller Breite mit Tabelle bis 640 px: caption „Geschätzte API-Kosten (USD)“, Position · Tokens · niedrig · hoch, „—“ für fehlende Tokens, Summenzeile sticky unten, darunter Basis und „liest nur · gesetzt über die API“; Fälle ohne Tokens, Gesamt als Spanne, Gesamt als Betrag, EUR, 100 Positionen (Kopf und Summe bleiben stehen), ohne Etikett zwei Reiter; bei 320/375/414 px Kopf ohne Pfad, Klasse, Zähler und ↗, Knöpfe 32 px, Reiter-Polster 6 px | Vorgabe vor dem Bau von I0093; Kopf in allen gezeichneten Breiten ohne waagrechtes Scrollen gemessen; Kontrast Reiter 16,21:1 / 12,63:1, Fokusring auf `--kd-sunken` 8,48:1 / 11,73:1 und auf Klassen mindestens 8,36:1 / 7,91:1, caption und Köpfe `--kd-muted` auf `--kd-sunken` 5,48:1 / 8,30:1 |
| 2026-11-06 | D0006 Zustand „Bericht Kosten“ (R00105, I0094) | angehängt unter den Berichten, Hell und Dunkel: Menüeintrag „Kosten“ in BESTAND hinter „Bestand nach Labels“ mit Etikett-Symbol; Kopfleiste „Kosten · geschätzte API-Kosten · liest nur“, Filterbox ohne Zeitraum; Summenzeilen je Währung (USD, dann ISO-Code), Betrag in Plex Mono 15 px, Umfang in `--kd-muted`, kein „≈“; Ränder Filter aufgeklappt, Einzelbetrag, beide Leerzustände mit und ohne „Zurücksetzen“ (ohne Zahl), Board ohne Aufgaben, nur gespeicherter Zeitraum; Link „API für Agenten“ unterstrichen; Telefone 320/375/414 px | Vorgabe vor dem Bau von I0094; Texte wörtlich aus den Akzeptanzkriterien; ganze Fläche in allen drei Breiten ohne waagrechtes Scrollen gemessen; Kontrast Text auf `--kd-surface` 16,21:1 / 12,63:1, `--kd-muted` 6,44:1 / 6,94:1, Link `--kd-accent-ink` 9,97:1 / 9,81:1 |

## Offene Fragen
