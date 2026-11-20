---
id: R00211
status: Erledigt
datum: 2026-11-20
ursprung: Bug-Report
ursprungslauf: R00206
---

# R00211: Behebung — Diff je Commit: Pfadangabe bei Typwechsel Datei ↔ Verzeichnis ergibt 500

## Beschreibung

Im Diff je Commit (`GET /api/aufgaben/{nr}/diff?commit=…`, [R00206](R00206-diff-eines-commits-per-api-lesen.md), Karte #213, ausgeliefert) steckt dieselbe Neupaarung, die #214 im Gesamt-Diff behoben hat (ADR-0032 N7.2): Eine Pfadangabe `d/x` trifft in Git auch `d/x/…`, auch mit `--literal-pathspecs`, und Git paart Umbenennungen unter den getroffenen Einträgen neu. Die Zuordnung von Zählern und Stücken passt dann nicht mehr zur Dateiliste, und die API antwortet mit 500. Ein fremder Patch erscheint dabei nicht; die Antwort fällt aus.

R00206 sagt zu: `&datei=<pfad>` liefert genau diese eine Datei mit ihrem Patch (AK 8, FA 8), Typwechsel in beiden Richtungen mit `datei=` und in der Liste ergeben 200 (AK 20 c), im nicht abgeschnittenen Lauf hat jede Datei alle ihre Stücke (FA 13). Das hält der Code bei einem Typwechsel mit gleichem Blob nicht — **falsch gebaut**, kein neuer Umfang.

Reproduziert am fertigen Programm vom Stand `main` `77b46481` (planer, 2026-11-20, Proben `gemeinsam/scratchpad/entw1-214/a3b.py` und `gemeinsam/scratchpad/plan-229/faelle.py` der Factory):

| Fall | Anfrage | heute | Soll |
|---|---|---|---|
| (a) Datei → Verzeichnis | `?commit=kd:<K>&datei=d/x`, JSON und `format=patch` | 500 „git: Zähler passen nicht zur Datei“ | 200, genau `d/x` |
| (b) Verzeichnis → Datei | `?commit=kd:<K>&datei=d/x`, JSON und `format=patch` | 500 „git: Zähler passen nicht zur Datei“ | 200, genau `d/x` |
| (d) Liste mit Pfadangabe | `?commit=kd:<K>` (Kappe 2.000) | 500 „git: Patch-Lauf: „d/x“ (D) hat 0 von 1 Stücken“ | 200, `d/x` mit eigenem Patch |
| (c) Zwilling | Liste und `datei=` auf jeden Namen | 200 | 200 (bleibt) |

Herkunft: Befund des entwicklers in der Nacharbeit von #214 (Karte #229), Entscheidung des architekten in [ADR-0032 N7.7](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) (`8c5391c6`): N7.2 gilt unverändert auch für den Diff je Commit, für **beide** Pfadangaben, mit einer Regel für den abgeschnittenen Bezug. R00206 bleibt erledigt und unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112: „die Änderungen als Diff aus dem Arbeits-Repository, je Commit oder für die ganze Karte“).

## Ursachenanalyse

### Root Cause

Belegt am Stand `77b46481`, `src/dienst/diff.rs`:

- **`datei=`** (`datei_lesen`, `:71–91`): Die Pfadangabe für Zähler- und Patch-Lauf sind nur die Pfade der Treffer (`:79–80`). `d/x` trifft im Lauf auch `d/x/inner`; Git sieht `D d/x` und `A d/x/inner` und paart sie als Umbenennung (10 von 11 Zeilen gleich, über 50 %), während die ungekappte Liste `D d/x` und `R100 b → d/x/inner` zeigt. Der Zähler-Eintrag hat dann die Pfade `[d/x, d/x/inner]` statt `[d/x]`, und `:85` antwortet „Zähler passen nicht zur Datei“ (500). Die Stücke ordnet `:89` mit `patches_zuordnen` nur über die angefragten Einträge zu, nicht über den Bezug.
- **Liste mit Pfadangabe** (`liste_lesen`, `:58–63`): Liefert `lauf_der_liste` `true` (eine Datei `gross`, `nachladen` oder die Liste über der Kappe), nennt der Patch-Lauf nur die Pfade der Dateien im Lauf. Liegt der Umbenennungspartner hinter der Kappe (oder ist er `gross`), paart Git `d/x → d/x/inner` neu, `D d/x` bekommt kein Stück, und `patches_zuordnen` meldet „hat 0 von 1 Stücken“ (500).

Ausgeschlossen: der Gesamt-Diff (#214, `abschliessen` und `patches_zuordnen_im_bezug` in `src/dienst/gesamt_diff.rs`, `src/modell/commit_diff.rs:345–375`, gemessen: `datei=d/x` ohne `commit` 200); die Liste ohne Pfadangabe (alle Dateien im Lauf, Git läuft ohne Pfade, Fall (a) als Liste 200); Namen, die in der Liste nicht stehen (404 wie R00206 AK 8, etwa `datei=b` als `alt` einer Umbenennung).

Eingetreten, nicht latent: die Antworten sind am Programm gemessen. Schaden: ein Reviewer-Agent kann die gelöschte oder neu angelegte Datei an einem Typwechsel nicht lesen; die Liste eines großen Commits mit Typwechsel fällt ganz aus.

### Betroffene Komponenten

- `src/dienst/diff.rs` — `liste_lesen`, `datei_lesen` (A00004 Dienste).
- `src/modell/gesamt_diff.rs:276` `abschliessen`, `src/modell/commit_diff.rs` `getroffen`, `patches_zuordnen_im_bezug` — werden mitbenutzt, nicht neu geschrieben (A00006 Modell).
- Tests: neue Datei `tests/akzeptanz_r00211.rs`; Modultests in `src/modell/commit_diff.rs`.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0032 N7.7, ohne neue Technikfrage — dieselbe Regel wie im Gesamt-Diff:

1. **`datei=`**: Die Pfadangabe für Zähler- und Patch-Lauf wird mit `abschliessen` gegen die Roh-Liste bis 20 MB (`GRENZE_DATEILISTE_EINZELN`) abgeschlossen. Die Zähler werden nur über die getroffenen Einträge des Bezugs verbunden (`getroffen`), die Stücke über `patches_zuordnen_im_bezug`; erst danach bekommt nur der angefragte Eintrag sein Ergebnis.
2. **Liste mit Pfadangabe**: Bezug ist die gelesene Liste (vor der Kappe). Die Pfadangabe des Patch-Laufs wird gegen sie abgeschlossen, die Zuordnung läuft über `patches_zuordnen_im_bezug`.
3. **Abgeschnittener Bezug** (Liste über 1 MB, Roh-Liste von `datei=` über 20 MB): Scheitert die Zuordnung **nur** deshalb, gibt es kein 500 — in der Liste werden die Dateien des Laufs `nachladen`, bei `datei=` gilt 404 „Dateiliste zu groß“ wie `DateiFehlt { liste_abgeschnitten: true }`. Ist der Bezug vollständig, bleibt die Zählprüfung streng (500 wie R00206 FA 13).
4. `format=patch` geht über dieselbe Zuordnung (`Fassung::Stuecke`) und braucht nichts Eigenes.

`abschliessen` bleibt **eine** Funktion für beide Dienste (Pre-Mortem N7 (f): eine neue Pfadangabe ohne `abschliessen` macht die Probe rot); wohin sie im Modell gehört, entscheidet der entwickler.

### Alternative Ansätze

- **Ohne Pfadangabe laufen und die eine Datei aus dem ganzen Patch schneiden**: liest bei `datei=` bis zu 8 MB fremder Stücke, wo heute nur die Datei gelesen wird; widerspricht R00206 FA 8 („nur Pfade aus der Dateiliste erreichen Git“) nicht, kehrt aber N4.3 um und kostet bei großen Commits jede Einzelanfrage den vollen Patch.
- **`--no-renames` im Lauf mit Pfadangabe**: zerlegt die Umbenennung in `D` und `A`, die Stücke passen nicht mehr zur Liste mit `-M50%`; verworfen schon in N7.1 für den Gesamt-Diff.
- **Neupaarung als 404 oder `nachladen` melden statt sie zu verhindern**: macht eine lesbare Datei unlesbar; R00206 AK 20 c sagt 200 zu.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm, `tests/akzeptanz_r00211.rs` (Helfer wie `tests/akzeptanz_r00206.rs` und `tests/akzeptanz_r00208.rs`, `b2_typwechsel_mit_gleichem_blob`): AK 1 (a), (b) und AK 2 als erste Tests, **rot ohne Fix** mit den gemessenen Meldungen aus der Tabelle oben; die Antworten stehen im Commit der ersten Bubble. (c) ist heute grün und hält fest, dass der Fix den Zwilling nicht vertauscht.

### Code-Extraktion für isoliertes Testing

Nicht nötig für die Zuordnung (`patches_zuordnen_im_bezug`, `getroffen`, `abschliessen` sind rein und schon im Modell). Nötig für den abgeschnittenen Bezug von `datei=` (AK 3): 20 MB Roh-Liste sind im Integrationstest zu teuer; die Entscheidung „scheitert nur wegen des Schnitts → `DateiFehlt { liste_abgeschnitten: true }`“ wird als reine Funktion über Roh-Liste, Abschnittsmerkmal und Zuordnungsergebnis geprüft.

### Regressionstests

Ohne geänderte Erwartung grün: `tests/akzeptanz_r00206.rs` (darin AK 6, 8, 11, 13 und 20 a–c), `tests/diff_inhalt.rs`, `tests/arbeitsrepo_diff.rs`, `tests/arbeitsrepo_diff_spur.rs`, `tests/akzeptanz_r00208.rs` (B2, B2-Rest), `tests/lastprobe_r00206.rs`.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, wie R00206): Arbeits-Repository R einer Anwendung im Register, Aufgabe #1 mit genau dem Verweis `kd:<K>` auf den Commit des jeweiligen Falls. `X` sind die zehn Zeilen `x0` … `x9`. **Orakel „bytegleich“**: Der Patch einer Datei ist derselbe wie ihr Stück aus `git diff-tree -p --full-index -M50% -l1000 --no-ext-diff --no-textconv <Elternteil> <K>` **ohne Pfadangabe** — im JSON die Hunks, im `format=patch`-Text Kopfzeilen und Hunks.

**Fälle** (Abnahme-Probe der Karte, ADR-0032 N7.7, wörtlich übernommen und in Beispiele übersetzt):

- **(a) Typwechsel Datei → Verzeichnis mit gleichem Blob**: Vorgänger mit `b` = X und `d/x` = X plus Zeile `y`; K löscht beide und legt `d/x/inner` = X an. Liste: `D d/x` (plus 0, minus 11) und `R b → d/x/inner` (Ähnlichkeit 100, ohne Patch).
- **(b) die Umkehrung**: Vorgänger mit `d/x/inner` = X; K benennt `d/x/inner` nach `b` um und legt die Datei `d/x` = X plus `y` an. Liste: `R d/x/inner → b` und `A d/x` (plus 11, minus 0).
- **(c) Zwilling**: Vorgänger mit `b` = X, `d/x` = X und `g` = eine Zeile; K löscht `b`, ersetzt das Verzeichnis `d` durch die Datei `d` („datei d“, „ganz anders“) und schreibt `g` mit 3.001 Zeilen neu. Liste: `D b`, `A d`, `D d/x` (gleicher Blob wie `b`), `M g` `gross` — die Liste läuft mit Pfadangabe.
- **(d) Liste über der Kappe**: wie (a), dazu im selben K 2.000 neue Dateien `d/x/a0000` … `d/x/a1999` mit je einer Zeile. Rechenbeispiel: 1 + 2.000 + 1 = 2.002 Einträge; gezeigt die ersten 2.000 (`d/x` und `d/x/a0000` … `d/x/a1998`); hinter der Kappe `d/x/a1999` und `R b → d/x/inner`.

### Bug behoben

- [x] **AK 1 `datei=` auf jeden Namen, JSON und `format=patch`** (Fälle a–c): Für jeden Namen der Liste (`neu`, bei gelöschten `alt`) ergibt `?commit=kd:<K>&datei=<name>` 200 mit genau diesem einen Eintrag — `status`, `alt`, `neu`, `plus`, `minus` gleich dem Eintrag der Liste —, und der Patch ist bytegleich; dasselbe mit `&format=patch`, ohne Abbruch. Beispiel (a): `datei=d/x` → eine Datei `D`, minus 11, Patch `@@ -1,11 +0,0 @@` mit elf `-`-Zeilen (`-x0` … `-x9`, `-y`); `datei=d/x/inner` → `R` aus `b`, Ähnlichkeit 100, ohne Patch. Heute (a) und (b) mit `datei=d/x`: 500 „git: Zähler passen nicht zur Datei“.
- [x] **AK 2 Liste mit Pfadangabe** (Fälle c und d): `?commit=kd:<K>` ohne `datei=` ergibt 200, als JSON und mit `format=patch`; jede Datei mit Patch trägt den eigenen, bytegleich (in (c) hat `b` den Kopf `diff --git a/b b/b`, `d/x` den Kopf `diff --git a/d/x b/d/x`). (d): `d/x` trägt minus 11 und den Patch aus AK 1, der Hinweis `dateien_gekappt` nennt `gezeigt 2000, gesamt 2002`. Heute (d): 500 „git: Patch-Lauf: „d/x“ (D) hat 0 von 1 Stücken“.
- [x] **AK 3 Abgeschnittener Bezug ohne 500**: Fall (a), dazu im selben K so viele neue Dateien `d/x/a<nnnn>` mit Namen von 200 Zeichen, dass die Roh-Liste 1 MB überschreitet (Hypothese: etwa 3.500 bei rund 300 Byte je Eintrag; die Zahl stellt der Test über die gemessene Länge ein) und `R b → d/x/inner` hinter dem Schnitt liegt. Die Liste ergibt 200, `d/x` steht `nachladen` ohne Patch, nie 500; `datei=d/x` (Roh-Liste bis 20 MB vollständig) ergibt 200 nach AK 1. Für die Roh-Liste von `datei=` über 20 MB gilt dasselbe im Modultest: scheitert die Zuordnung nur wegen des Schnitts → 404 „Dateiliste zu groß“; bei vollständigem Bezug und fehlendem Stück → Fehler (500), wie heute.
- [x] **AK 4 Zufallsprobe über `?commit=`**: Die Zufallsprobe `probe_b2rest.py` (#214) sinngemäß für den Diff je Commit — Zwillinge in Verzeichnissen, Typwechsel Verzeichnis ↔ Datei in beiden Richtungen, Umbenennungen —, je Seed die Liste und `datei=` auf jeden Namen, JSON und `format=patch`, über **1.200 Seeds**: 0 Antworten 500, 0 Abweichungen vom Orakel „bytegleich“. Seeds, die vor dem Fix rot waren, gehen als feste Fälle in `tests/akzeptanz_r00211.rs` (höchstens drei); die Zahlen vor und nach dem Fix stehen in der Commit-Nachricht.
- [x] **AK 5 Mutanten**: Je von einem benannten Test getötet — (m1) `abschliessen` in `datei_lesen` weg → AK 1 rot; (m2) `abschliessen` in `liste_lesen` weg → AK 2 (d) rot; (m3) Stücke von `datei=` mit `patches_zuordnen` statt `patches_zuordnen_im_bezug`; (m4) Zähler über alle Einträge der Zählerausgabe statt über die getroffenen des Bezugs; (m5) Ausnahme für den abgeschnittenen Bezug auch bei vollständigem Bezug → Modultest aus AK 3 rot. Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung, statt den Code zu behalten.
- [x] **AK 6 Bug-Vorlage**: Der Reproduktionstest (AK 1 a, b und AK 2 d) ist ohne Fix rot und mit Fix grün; der Fehler der Karte tritt im Szenario der User Story nicht mehr auf; alle Tests aller Ebenen grün, darin die Regressionstests oben ohne geänderte Erwartung und die Lastprobe von R00206 (AK 15: p95 unter 500 ms, auch für `datei=`).

## Implementierungshinweise

- Der Lauf von `datei=` liest heute die Roh-Liste, verwirft sie vor dem Patch-Lauf (`drop(roh)`, N5.1 Regel 6). Für den Bezug werden nur die Pfade und Merkmale der getroffenen Einträge gebraucht — sie vor dem `drop` herausziehen, nicht die ganze Liste behalten.
- Abgeschlossene Pfadangaben lassen den Lauf fremde Stücke lesen, die verworfen werden; ihre Bytes zählen gegen die Grenze des Laufs (4 MB Liste, 8 MB einzeln). Inkauf nach N7 „Konsequenzen“. Die Grenze von 1 MB für die Pfadangabe (N5.5 S1) gilt für die abgeschlossene Angabe.
- Startort, Schalter (`--literal-pathspecs`, `-M50% -l1000`, `--full-index`, `--` hinter den Revisionen) und Grenzen bleiben unverändert.

## Offene Fragen

- keine — Technik in ADR-0032 N7.7 entschieden; kein Wortlaut neu (404 „Dateiliste zu groß“ ist der bestehende Satz aus `src/dienst/diff.rs:275`).

## Warum löst diese Anforderung das Problem? (Pflicht)

Eine Pfadangabe `d/x` lässt Git auch `d/x/…` sehen → Git paart Einträge anders als die Liste → Zähler und Stücke passen nicht, 500. Abgeschlossen gegen den Bezugslauf enthält die Angabe jeden getroffenen Eintrag ganz → Git sieht dieselben Paare wie in der Liste → die Zuordnung im Bezug findet jedes Stück an seinem Eintrag, auch beim Zwilling → `datei=` und die Liste antworten mit 200 und bytegleichem Patch. Wo der Bezug selbst abgeschnitten ist, kann das nicht gelingen; dort steht der bestehende, erklärte Ausweg (`nachladen`, 404 „Dateiliste zu groß“) statt eines 500. Der Hebel ist derselbe wie in #214, deshalb belegt die Zufallsprobe über 1.200 Seeds dort (0 mal 500) auch die Regel hier.

## Notizen

- Priorität: Hoch (Vorrang-Karte, Label `sicherheit`: Verfügbarkeit der Antwort; kein fremder Inhalt sichtbar)
- Betroffene Nutzer/Systeme: Reviewer-Agenten der Factory über `?commit=`; die Review-Seite eines Commits (R00207) lädt große Dateien über `datei=` nach
- Workaround: den Gesamt-Diff mit `datei=` lesen (ohne `commit`, schon behoben), wenn der Commit der einzige Schritt der Karte an dieser Datei ist
- Proben: `gemeinsam/scratchpad/entw1-214/a3b.py` (Fall a), `gemeinsam/scratchpad/plan-229/faelle.py` (Fälle b–d), `gemeinsam/scratchpad/entw1-214/probe_b2rest.py` (Vorlage AK 4), alle im Factory-Repo
