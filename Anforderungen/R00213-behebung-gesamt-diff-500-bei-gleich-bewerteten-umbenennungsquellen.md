---
id: R00213
status: In Arbeit
datum: 2026-11-20
ursprung: Bug-Report
ursprungslauf: R00208
---

# R00213: Behebung — Gesamt-Diff: 500 bei gleich bewerteten Umbenennungsquellen

## Beschreibung

Der Gesamt-Diff der Karte (`GET /api/aufgaben/{nr}/diff` ohne `commit`, [R00208](R00208-gesamt-diff-der-karte-per-api-lesen.md), Karte #214, ausgeliefert) ordnet die Stücke der Netto- und Folge-Läufe mit Pfadangabe streng zu (`patches_zuordnen_im_bezug`, ADR-0032 N7.2). Git paart gleich bewertete Umbenennungsquellen in einem Lauf mit Pfadangabe aber abhängig von der Größe der Matrix anders als im Bezugslauf (ADR-0032 N7.8, im rohen Git 14 von 60 Varianten). Einem Eintrag fehlt dann sein Stück, und die API antwortet mit 500 für die ganze Karte. Fremder Inhalt erscheint dabei nicht; die Antwort fällt aus.

R00208 sagt mit Nacharbeit 1 zu: Typwechsel und sehr große Karten ergeben keine 500 (AK 2 Typwechsel mit gleichem Blob, ADR-0032 N7 „Konsequenzen“); 500 ist dort nur für einen nicht abgeschnittenen Lauf mit fehlendem Stück vorgesehen, nicht für eine abweichende Paarung. Das hält der Code bei gleich bewerteten Quellen nicht — **falsch gebaut**, kein neuer Umfang. Dieselbe Ursache hat #229 im Diff je Commit behoben ([R00211](R00211-behebung-diff-je-commit-pfadangabe-bei-typwechsel-500.md), N7.8, N7.9).

Gemessen vom architekten am Release-Build von `main` `b6bd9231` (Probe `gemeinsam/scratchpad/arch-230/tie_gesamt.py` der Factory, je Fall 40 Varianten mit 2–4 gleichwertigen Quellen):

| Fall | Aufbau | Liste und `format=patch` | `datei=` |
|---|---|---|---|
| N | Kartencommit K1 löscht `s0…` und `gross`, legt `dst` und `dst2` an | 16 von 40 mit 500 | 40 von 40 mit 200 |
| F | wie N, dann fremder Commit F (hängt `FREMD` an `dst2`) und Kartencommit K2 | 16 von 40 mit 500 | 40 von 40 mit 200 |
| G, H | große Folge-Datei im selben oder im nächsten Kartencommit | 0 von 40 | 40 von 40 |

Die Meldung ist stets „Patch-Lauf: „dst“ (R) hat 0 von 1 Stücken“, im Netto-Lauf. Eine Zeile mit `FREMD` erschien nie.

Herkunft: Befund des architekten in den Auto-Reviews von #229 (ADR-0032 N7.8 „Gesamt-Diff“), Karte #230; Entscheidung in [ADR-0032 N7.10](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) (`564a776c`). R00208 bleibt erledigt und unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112: „die Änderungen als Diff aus dem Arbeits-Repository, je Commit oder für die ganze Karte“).

## Ursachenanalyse

### Root Cause

Belegt am Stand `b6bd9231`, `src/dienst/gesamt_diff.rs`:

- **Netto-Lauf der Liste** (`:355`): `patches_zuordnen_im_bezug` gegen die Netto-Liste mit der Angabe der Dateien im Lauf (ohne `gross`). Diese Angabe ist kleiner als die des Bezugs (`D_karte` bzw. keine), die Matrix der Umbenennungserkennung also eine andere, und Git paart `s<i> → dst` anders. `dst` bekommt kein Stück, die strenge Zählprüfung meldet 500.
- **Folge-Läufe der Liste** (`:495`): dieselbe strenge Zuordnung, sobald die Angabe kleiner ist als die der Folge-Liste des Commits; in den Fällen G und H nicht gemessen, nach dem Mechanismus möglich (N7.10).
- **Argumentgrenze** (N7.9): Die Vorabgrenze am Startort wirkt schon für den Gesamt-Diff, aber `ArgumenteZuLang` wird über `abbruch` (`:7`, aus `diff.rs`) zu 500.

Ausgeschlossen: `datei=` des Gesamt-Diffs (40 von 40 mit 200, Angabe des Bezugs); „nie fremd“ (in keiner Antwort eine `FREMD`-Zeile); der Diff je Commit (#229, behoben).

Eingetreten, nicht latent: am Programm gemessen. Schaden: Ein Reviewer-Agent bekommt für die ganze Karte keine Antwort, sobald ein Kartencommit gleich gute Umbenennungsquellen und eine große Datei hat.

### Betroffene Komponenten

- `src/dienst/gesamt_diff.rs` — Netto-Patch der Liste, `folge_patches`, `datei=`, Abbildung von `ArgumenteZuLang` (A00004 Dienste).
- `src/modell/commit_diff.rs` — `nicht_zugeordnet_im_bezug` aus #229 wird mitbenutzt, nicht neu geschrieben (A00006 Modell).
- Tests: neue Datei `tests/akzeptanz_r00213.rs`; Modultests in `src/dienst/gesamt_diff.rs`.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0032 N7.10 — **Grundregel**: Streng (500) ist ein Patch-Lauf nur, wenn er **dieselbe Pfadangabe wie sein Bezugslauf** hat, einschließlich „keine“. Jede andere Angabe ist eine Abkürzung.

1. **Liste**: Ein Netto-Eintrag ohne Stück wird `nachladen`. Fehlt einem Folge-Eintrag das Stück eines Schritts, wird der ganze Folge-Eintrag `nachladen`. Nie 500; die übrigen behalten ihren Patch (`nicht_zugeordnet_im_bezug`).
2. **`datei=`**: Fehlt das Stück, folgt ein Rückfall mit **genau der Angabe des Bezugslaufs** — Netto mit `D_karte` (ohne Angabe nur, wenn die Spanne keine fremden Commits hat), Folge mit der Angabe des Folge-Laufs; bis 8 MB, zugeordnet über den ganzen Bezug, streng. Hinter 8 MB: `gross` und `zu_gross_zum_anzeigen`. Gelesene fremde Stücke werden verworfen, nie ausgegeben.
3. **`ArgumenteZuLang`** an vier Stellen statt 500:

| Stelle | zu lang → |
|---|---|
| Netto-Liste (Angabe `D_karte`) | wie `pfadangabe_zu_lang`: `ganz_als_folge` mit Grund `fremd_zu_gross` |
| Folge-Liste eines Commits | wie ein abgeschnittener Folge-Lauf: die Einträge fallen weg, Hinweis `dateien_gekappt` |
| Patch-Lauf der Liste (Netto oder Folge) | seine Einträge `nachladen` |
| `datei=` | Rückfall nach Punkt 2; ist auch er zu lang: 404 mit dem Text aus N7.3 (Verweis auf `commit=` und `datei=`) |

4. Grenzen unverändert: 64 MB Antwortbudget, 10 s, höchstens 15 Git-Prozesse; der Rückfall kostet einen Prozess nur bei `datei=` und nur im Fehlschlag.

### Alternative Ansätze

Nach N7.10 Punkt 4 verworfen: Netto-Eintrag als Folge zeigen (falsche Aussage, mehr Prozesse); `ganz_als_folge` für die ganze Antwort (eine Datei verschlechtert alles); Rückfall ohne Angabe über die Spanne (liest alle fremden Änderungen gegen das Budget, „nie fremd“ hinge allein an der Zuordnung); Bezugsangabe auch für den Patch-Lauf der Liste (große Dateien und Folge-Pfade verbrauchen die 4 MB).

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm, `tests/akzeptanz_r00213.rs` (Helfer wie `tests/akzeptanz_r00208.rs`, Muster `ak7_ak8_gleich_bewertete_quellen_in_40_varianten` aus `tests/akzeptanz_r00211.rs`): AK 1 als erster Test, **rot ohne Fix** (16 von 40 je Fall mit 500); die Zahlen stehen im Commit der ersten Bubble.

### Code-Extraktion für isoliertes Testing

Nicht nötig für die Zuordnung (`nicht_zugeordnet_im_bezug` ist rein). Für AK 3 (Folge-Eintrag ohne Stück) und die Strenge am Aufrufort wird der Ausfall mit einem Git-Skript hergestellt, das im Patch-Lauf ein Stück weglässt (wie R00206 AK 9, R00211 AK 10).

### Regressionstests

Ohne geänderte Erwartung grün: `tests/akzeptanz_r00208.rs` (B1–B5, S1, S2, „nie fremd“), `tests/lastprobe_r00208.rs`, `tests/akzeptanz_r00211.rs`, `tests/akzeptanz_r00206.rs`, Modultests in `src/modell/gesamt_diff.rs`.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, wie R00208): Arbeits-Repository R einer Anwendung im Register, Aufgabe mit den Verweisen der Kartencommits des Falls. Vorgänger A legt `s0` … `s<n-1>` (n = 2 bis 4, aus dem Seed) mit je den Zeilen `l0 l1 l2 l3` plus einer eigenen Zeile `x<i>` an, dazu `gross` mit 3.010 Zeilen.
- **Fall N**: Kartencommit K1 löscht alle `s<i>` und `gross` und legt `dst` = `l0..l3` + `neu` und `dst2` = `l0..l3` + `neu2` an; Karte = K1.
- **Fall F**: wie N, dann fremder Commit F hängt die Zeile `FREMD` an `dst2`, dann Kartencommit K2 legt `k2` an; Karte = K1, K2.

**Orakel „bytegleich netto“**: Der Patch eines Netto-Eintrags ist derselbe wie sein Stück aus `git diff-tree -r -p --full-index -M50% -l1000 <basis> <letzter> -- <D_karte>` (im JSON die Hunks, im `format=patch`-Text Kopfzeilen und Hunks).

### Bug behoben

- [x] **AK 1 Abnahme-Probe der Karte (architekt, ADR-0032 N7.10, wörtlich):** Fälle N und F, **Seeds 0–39**, je die Varianten Liste, `format=patch`, `datei=dst`, `datei=dst2`. Erwartet: immer 200, keine Zeile `FREMD` (kein `+`/`-` mit `FREMD` in einem `patch` oder im Text); jeder Netto-Patch bytegleich nach dem Orakel; jeder Eintrag ohne Patch steht auf `nachladen` und gibt per `datei=` 200. Heute: je Fall 16 von 40 mit 500 „Patch-Lauf: „dst“ (R) hat 0 von 1 Stücken“.
- [x] **AK 2 `datei=` mit Rückfall über die Angabe des Bezugs:** In jeder Variante aus AK 1 ergibt `datei=` auf jeden `nachladen`-Eintrag 200 mit genau diesem Eintrag und bytegleichem Patch. Fehlt im ersten Lauf das Stück, zeigt die Git-Spur genau einen weiteren `diff-tree`-Lauf mit der Angabe des Bezugs: in Fall F mit `D_karte`, in Fall N (Spanne ohne fremde Commits) ohne Angabe — **nie** einen Lauf ohne Angabe über eine Spanne mit fremden Commits. Liegt das Stück hinter 8 MB: 200 mit `gross` und `zu_gross_zum_anzeigen`. In Fall F enthält auch `datei=dst2` keine `FREMD`-Zeile.
- [x] **AK 3 Folge-Eintrag ohne Stück, Strenge nur bei gleicher Angabe:** Fehlt im Folge-Lauf **mit** einer Angabe, die kleiner ist als die der Folge-Liste, einem Schritt sein Stück (Git-Skript lässt es weg), steht der **ganze** Folge-Eintrag `nachladen` ohne Schritt-Patches, die übrigen Einträge behalten ihre, Antwort 200; `datei=` auf ihn ergibt 200. Derselbe Ausfall in einem Lauf **mit derselben Angabe wie sein Bezug** (auch „keine“) ergibt weiter 500 (Test am Aufrufort, Netto und Folge).
- [x] **AK 4 `ArgumenteZuLang` an vier Stellen, nie 500 (N7.10 Punkt 3):** Integrationstest mit kleiner Vorabgrenze (im Test verkleinerbar wie in R00211 AK 12), je Stelle eine Karte, deren Angabe genau dort über der Grenze liegt:
  - Netto-Liste → 200 mit Hinweis `{art: "ganz_als_folge", grund: "fremd_zu_gross"}`;
  - Folge-Liste → 200, die Einträge des Commits fehlen, Hinweis `dateien_gekappt`;
  - Patch-Lauf der Liste, Netto und Folge → 200, seine Einträge `nachladen`, je per `datei=` 200;
  - `datei=` → 200 über den Rückfall; ist auch der Rückfall zu lang → 404 mit dem Text aus N7.3 (verweist auf `commit=` und `datei=`).
  Je als JSON und mit `format=patch`. Heute: 500 über `abbruch`. Kein Git-Prozess für einen abgewiesenen Lauf (Zähler der Starts).
- [x] **AK 5 Zufallsprobe:** `probe_b2rest.py` (#214) mit dem Erzeuger `tie` (gleich bewertete Quellen mit anderem Blob, aus #229 B1069) und einer Datei `gross`, über den Gesamt-Diff mit und ohne fremde Commits, je Seed Liste, `format=patch` und `datei=` auf jeden Namen, über **1.200 Seeds**: 0 mal 500, 0 `FREMD`-Zeilen außer der Kartenschritt löscht sie selbst (R00208 AK 2), 0 Abweichungen vom Orakel, `datei=` auf jede `nachladen`-Datei 200. Vorher/nachher-Zahlen in der Commit-Nachricht; rote Seeds (höchstens drei) als feste Fälle.
- [x] **AK 6 Mutanten:** Je von einem benannten Test getötet — (m1) Netto-Lauf der Liste wieder streng → AK 1 rot (Pre-Mortem N7.10 (i)); (m2) Folge-Lauf mit kleinerer Angabe streng → AK 3 rot; (m3) Folge-Eintrag nur teilweise `nachladen` (Schritt statt Eintrag) → AK 3 rot; (m4) `datei=`-Rückfall ohne Angabe statt mit `D_karte` → AK 2 (Git-Spur) rot; (m5) Lauf mit gleicher Angabe nicht mehr streng → AK 3 rot; (m6) je eine der vier Stellen bildet `ArgumenteZuLang` wieder über `abbruch` ab → AK 4 rot. Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [ ] **AK 7 Bug-Vorlage:** Der Reproduktionstest (AK 1) ist ohne Fix rot und mit Fix grün; der Fehler der Karte tritt im Szenario der User Story nicht mehr auf; alle Tests aller Ebenen grün, darin die Regressionstests oben ohne geänderte Erwartung, die Lastprobe von R00208 (p95 unter 500 ms) und die Prozessgrenze (höchstens 15 Git-Prozesse).

## Implementierungshinweise

- Werkzeuge aus #229 mitbenutzen: `nicht_zugeordnet_im_bezug`, Vorabgrenze am Startort, die verkleinerbare Grenze für Tests. `patches_zuordnen_im_bezug` bleibt für Läufe mit der Angabe des Bezugs streng.
- Der Rückfall von `datei=` liest nur, was die Liste schon gelesen hat (gleiche Angabe); die Bytes verworfener fremder Stücke zählen gegen die 8 MB (N7 „Konsequenzen“).
- Unter Linux erreicht der Gesamt-Diff die Argumentgrenze praktisch nicht (der Namenslauf kappt bei 4 MB, N7.3); AK 4 ist deshalb nur mit kleiner Grenze prüfbar, unter Windows reichen etwa 300 Kartenpfade.

## Offene Fragen

- keine — Technik in ADR-0032 N7.10 entschieden; kein neuer Wortlaut (404-Text aus N7.3, Hinweise bestehend).

## Warum löst diese Anforderung das Problem? (Pflicht)

Ein Lauf mit kleinerer Pfadangabe als sein Bezug sieht eine andere Umbenennungsmatrix → Git paart gleich gute Quellen anders → einem Eintrag fehlt das Stück → strenge Zuordnung, 500. Ist die Strenge auf Läufe mit derselben Angabe wie der Bezug beschränkt, wird ein solcher Eintrag `nachladen` statt die Antwort zu kippen; der Einzelabruf läuft mit genau der Angabe des Bezugs, sieht also dieselbe Matrix und paart wie die Liste → 200 mit bytegleichem Patch. Weil der Rückfall nie ohne Angabe über eine Spanne mit fremden Commits liest, bleibt „nie fremd“ unberührt. Derselbe Hebel hat #229 im Diff je Commit belegt (1.200 Seeds, 0 mal 500).

## Notizen

- Priorität: Hoch (Vorrang-Karte, Label `sicherheit`: verworfene fremde Stücke, „nie fremd“)
- Betroffene Nutzer/Systeme: Reviewer-Agenten der Factory über den Gesamt-Diff; die Review-Seite „Alle Änderungen“ (R00210)
- Workaround: Diff je Commit (`?commit=`, seit #229 ohne 500)
- Proben: `gemeinsam/scratchpad/arch-230/tie_gesamt.py` (Fälle N, F, G, H), `gemeinsam/scratchpad/crev-229/tie2f.py`, `gemeinsam/scratchpad/entw1-214/probe_b2rest.py`, alle im Factory-Repo
