# Reihenfolge der 39 Karten in „Architektur“ — product-owner, Lauf 155-product-owner-1 (2026-11-15)

Auftrag des Betreibers 2026-11-15: alle Karten der Spalte „Architektur“ nacheinander bis
„Erledigt“, Sparbetrieb, immer eine Karte. #155 läuft. Unten die Reihenfolge der übrigen 39;
die Karten der Gruppe (d) stehen getrennt am Ende (sie zieht der Director nach
„Ohne Mensch nicht lösbar“, der Betreiber entscheidet).

Maßstab: (1) Fehler gegen eine abgenommene Zusage und Karten, die der Betreiber schon
entschieden hat, zuerst (Z. 217); (2) „braucht:<nr>“ vorher; (3) der Auftrag des Betreibers
#161 vor der Berichtskette #154 → #156 → #157 (Z. 217, relativer Ablauf bleibt); (4) ein
rotes oder wackliges Gate vor weiterem Bau (gemeinsam/gelerntes.md „Wacklige E2E-Tests …“);
(5) Karten ohne Nutzerwirkung ans Ende (Auftrag Betreiber 2026-11-15).

| # | Karte | Kurzgrund |
|---|---|---|
| 1 | #39 | Bruch des API-Kontrakts: 422 statt 400 `{fehler}` (ADR-0003), klein |
| 2 | #54 | sichtbarer Bedienfehler: Esc im Titelfeld speichert |
| 3 | #44 | ungültiger Schlüssel: Karte fällt aus der Suche, Dubletten möglich |
| 4 | #45 | Betreiber hat am 13.11. entschieden (alte Board-Zeile entfernen); Karte läge auf zwei Boards |
| 5 | #121 | entschieden (Z. 188: 423 einheitlich); heute antwortet der Code 403 — Fehler gegen R00120 AK 6 |
| 6 | #57 | Betreiber hat am 13.11. entschieden: gedämpfte Namen lesbar (≥ 4,5:1) |
| 7 | #87 | Betreiber hat am 13.11. entschieden: nur `reporting`, `signals`, `key` mit Dateischlüssel |
| 8 | #89 | Testfehler: `kultur.spec.js:193` ist jeden Sonntag rot, klein |
| 9 | #163 | Wackler `tests/live.rs:57` (Frist des Datei-Watchers), klein (Rust, kein Produktivcode) |
| 10 | #161 | Betreiber-Auftrag, tägliche Reibung; von hier an bleibt #161 vor #154 (Z. 217) |
| 11 | #162 | E2E-Wackler Teil 2; enthält `r00044-burndown:12/:37` — dieselbe Spec, die #154 anfasst (Z. 88), also vorher |
| 12 | #154 | Berichtskette, Kern des Betreiber-Auftrags (braucht #155, läuft) |
| 13 | #156 | Zielspalte „Erledigt heißt“ je Board (braucht #154) |
| 14 | #157 | Durchsatz: Von-Spalte + Zugangsbalken (braucht #154, #156) |
| 15 | #159 | Durchlaufzeit/CFD folgen der Zielspalte (braucht #156) — sonst bleibt der Widerspruch stehen, den #156 erzeugt |
| 16 | #158 | „Wie lange noch“: Hinweis Zugang ≥ Abgang (braucht #154) |
| 17 | #147 | Betreiber-Auftrag 13.11.: `GET /api/instanz`; die Factory wartet darauf, klein |
| 18 | #153 | Betreiber-Wunsch (Direktlinks auf Aufgaben), klein |
| 19 | #148 | sichtbarer Stillstand ohne Meldung: eine hängende Anfrage legt Aktionen und Live still |
| 20 | #149 | sichtbarer Fehler: gescheiterte eigene Anfrage vom Board meldet nichts, Haken bleibt |
| 21 | #150 | sichtbare Falschaussage „nichts geändert“, obwohl gespeichert (Fensterfall) |
| 22 | #141 | Tastatur: Fokus beim Öffnen, jedes Bedienelement erreichbar (Sammelkarte) |
| 23 | #140 | 320–414 px ohne Querscrollen, nichts abgeschnitten (Sammelkarte) |
| 24 | #59 | Fokusring im Kopf hell und dunkel sichtbar |
| 25 | #68 | Fehlerzeile im Bearbeitungsmodus wird gekürzt |
| 26 | #96 | Titelfeld ohne `aria-invalid` bei abgelehntem Titel |
| 27 | #93 | „Zeit nachtragen“ verliert die abgelehnte Eingabe |
| 28 | #97 | Bildschirmtastatur beim Laden verdeckt die Fenstermeldung |
| 29 | #102 | Herkunft entfernen mit Rückgängig (braucht #12, gebaut) |
| 30 | #108 | Rückgängig auf gelöschte Aufgabe, fremde Fußmeldung gelöscht |
| 31 | #111 | Barrierefreiheit: Nachzügler aus R00113 |
| 32 | #114 | vergessene Timer: Hinweis bei mehreren Timern, veraltetes `aria-label` |
| 33 | #55 | kleine sichtbare Mängel aus #6/#8/#18; rein optionale Punkte fallen nach dem Auftrag vom 15.11. weg |
| 34 | #151 | Sperrform: Fokusverlust am Anhang-✕ (ADR-0010) bleibt; Flackern/`aria-busy` sind Feinschliff |
| 35 | #86 | Wiederansage der Fenstermeldung prüfen (kleine Probe mit festgelegtem Ausgang) |

## Gruppe (d) — dem Betreiber zum Archivieren bzw. Besprechen (getrennt, mit Grund)

| # | Karte | Vorschlag und Grund |
|---|---|---|
| (d) | #160 | Geparkt; wartet auf #154 und braucht vor jedem Bau eine neue Entscheidung. Vorschlag: geparkt lassen und nach #154 neu entscheiden |
| (d) | #152 | in #162 aufgegangen (Kommentar des Directors). Vorschlag: archivieren |
| (d) | #69 | optionaler Randabstand 2,99 → 3:1; der Zustand ist schon durch „!“ und Text getragen, kein erkanntes WCAG-Maß. Vorschlag: archivieren |
| (d) | #143 | „kein beobachteter Fehler“ — nur unbelegte Kriterien/Testabdeckung. Vorschlag: archivieren |

## Nicht in der Liste, aber auf dem Board in „Architektur“

- **#33** (Verlauf je Karte in der Oberfläche, `archived: 2026-11-11`) und **#77**
  (ohne gewählte Identität geht beim schnellen Tippen die erste Teilaufgabe verloren,
  `archived: 2026-11-13`) stehen in `boards/entwicklung.md` noch unter „## Architektur“,
  tragen aber ein Archivdatum. Der Auftrag nennt 39 Karten, die Liste des Boards 41.
  Beide sind nicht Teil meiner Reihenfolge; der Director klärt, ob die Board-Zeilen
  veraltet sind.
