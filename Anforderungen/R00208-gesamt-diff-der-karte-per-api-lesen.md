---
id: R00208
status: Erledigt
datum: 2026-11-20
---

# R00208: Gesamt-Diff der Karte per API lesen

## Beschreibung

Karte #214 (Scheibe A4 des Feinschnitts), Auftrag des Betreibers vom 2026-11-19 (Karte #207, Nachtrag N1).

**Umfang:** `GET /api/aufgaben/{nr}/diff` **ohne** `commit` liefert alle Änderungen der Karte für eine Anwendung: je Datei **netto** (ein Diff von der Basis bis zum letzten Kartencommit), wo kein fremder Commit dieselben Pfade berührt, sonst als **Folge** der Kartenschritte. Nie erscheint eine geänderte Zeile aus einem fremden Commit. Gelesen wird live aus dem Arbeits-Repository des Registers, **nur lesend**, ohne die Sperre des Board-Ordners, mit den Grenzen und dem Antwortbudget des Diffs je Commit ([R00206](R00206-diff-eines-commits-per-api-lesen.md)). **Keine Oberfläche** (B3 #215), kein Nachfolgervorschlag (A5 #220), kein neues Dateiformat, keine neue Zugriffsgrenze.

Technik nach [ADR-0032](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) Punkt 7 mit N1.5 und **Nachtrag N6** (Basis, Spanne, Einteilung je Datei, Merges, Antwortform, Grenzen, Prozesszahl, `datei=`, `format=patch`, `ETag`, Startort); sie wird hier nicht wiederholt, nur in Beispiele übersetzt. Produktentscheidungen: po-entscheidungen Z. 426 („nie fremd“ heißt keine `+`/`−`-Zeile aus einem fremden Commit; Kontextzeilen eines Kartenschritts dürfen fremden Text zeigen) und Z. 427 (Merges an der Karte fallen mit Hinweis `merge_ausgelassen` aus dem Gesamt-Diff).

**Ersetzt in R00206 „ohne `commit` 400“** (FA 11 und der erste Satz von AK 3): Ohne `commit` antwortet die Route ab dieser Anforderung mit dem Gesamt-Diff. R00206 selbst bleibt unverändert; der betroffene Test (`tests/akzeptanz_r00206.rs`, Fall „ohne commit“) wird in Bubble B1028 auf diese Anforderung umgestellt. Alles andere an `?commit=` bleibt, wie R00206 es festlegt.

**Abnahme-Probe der Karte (Feinschnitt A4, „nie fremd“ nach PO Z. 426):** „K1, fremd F an derselben Datei, K2: die Datei erscheint als Folge K1, K2 mit Hinweis, keine `+`/`−`-Zeile von F in irgendeinem `patch`, Summe = Summe der Schritte; ohne F bytegleich zu `git diff K1^ K2`; mit einem verwaisten Zwilling K1' an der Karte bleibt das Ergebnis gleich, und der Hinweis nennt K1'.“ — sie steckt in AK 1.

> **Nie fremd: Keine `+`/`−`-Zeile eines fremden Commits steht in irgendeinem `patch` (netto oder Schritt, JSON oder `format=patch`) und in keiner Summe, außer der Kartenschritt löscht oder schreibt sie selbst um (ADR-0032 N7.1: das ist Arbeit der Karte) — auch nicht über eine Umbenennung, einen fremden Merge oder einen abgeschnittenen Lauf (AK 1 bis 4). Lässt sich das nicht sicher feststellen, erscheint alles als Folge, nie netto (AK 4).**

> **Schutz des Arbeits-Repositorys und des Servers wie A3: Der Gesamt-Diff führt im Repository nichts aus und ändert nichts (AK 9); er startet höchstens 15 Git-Prozesse, gleich viele bei 10 wie bei 30 Kartencommits (AK 5), und hält die Grenzen, die Gesamtgrenze und das Antwortbudget des Diffs je Commit (AK 8).**

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112: „die Änderungen als Diff aus dem Arbeits-Repository, je Commit oder für die ganze Karte“) und Nicht-Ziel „Kein Git-Client“ (Z. 193: im Arbeits-Repository nur lesen).

**Beispiel-Aufruf** (Ausgangslage unten, Karte #2: K1, fremd F, K2):

```
GET /api/aufgaben/2/diff
→ 200
{"anwendung": "kd",
 "spanne": {"basis": "<A0>", "letzter": "<K2>"},
 "commits": [{"verweis": "kd:<K1>", …, "plus": 3, "minus": 1, "dateien": 2},
             {"verweis": "kd:<K2>", …, "plus": 2, "minus": 1, "dateien": 2}],
 "dateien": [
   {"pfad": "a.txt", "plus": 2, "minus": 2, "binaer": false,
    "schritte": [{"commit": "kd:<K1>", "alt": "a.txt", "neu": "a.txt", "status": "M", "plus": 1, "minus": 1, …, "patch": "@@ -1,5 +1,5 @@\n z1\n-z2\n+K1\n …"},
                 {"commit": "kd:<K2>", "alt": "a.txt", "neu": "a.txt", "status": "M", "plus": 1, "minus": 1, …, "patch": "@@ -8,5 +8,5 @@\n …\n-z11\n+K2\n z12\n"}]},
   {"neu": "k.txt", "status": "A", "plus": 3, "minus": 0, "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false,
    "patch": "@@ -0,0 +1,3 @@\n+k1\n+k2\n+k3\n"}],
 "hinweise": [{"art": "fremd_dazwischen", "commits": 1, "dateien": 1}]}
```

### Domänenbezug

**Anwendung**, **Register**, **Standardanwendung**, **Commit-Verweis**, **Zustand**, **verwaist**, **Hunk**, **Patch-Text** und **nachladen** wie in R00202 bis R00206; im Glossar (`Dokumentation/Domaenenwissen/`) fehlen sie weiterhin. Neu sind **Gesamt-Diff** (alle Änderungen der Karte in einer Antwort), **Spanne** (Basis bis letzter Kartencommit auf der Erst-Eltern-Linie), **fremder Commit** (ein Commit der Spanne, der nicht an der Karte hängt), **netto** (eine Datei als ein Diff von der Basis zum letzten) und **Folge** (eine Datei als Reihe der Kartenschritte); sie gehören ins Glossar, sobald der `fachspezialist` es pflegt.

## Geschäftlicher Nutzen

Ein Reviewer-Agent will wissen, was eine Karte als Ganzes geändert hat, nicht nur ein einzelner Commit. Heute muss er dafür jeden Commit einzeln lesen und selbst zusammensetzen, und dazwischen liegende fremde Commits (etwa eine andere Karte, die auf `main` gelandet ist) könnte er nicht sicher heraushalten. Mit dem Gesamt-Diff bekommt er mit einem Aufruf das Gesamtbild — netto, wo es eindeutig ist, sonst als Folge der Kartenschritte — und kann sich darauf verlassen, dass nie fremde Arbeit als Arbeit der Karte erscheint. Die Ansicht „Alle Änderungen der Karte“ (B3) bekommt damit ihre Daten.

## Funktionale Anforderungen

1. `GET /api/aufgaben/{nr}/diff` **ohne `commit`** antwortet mit `{anwendung, spanne, commits, dateien, hinweise}` für **eine** Anwendung (ADR-0032 N6.6). Lesen darf jeder, ohne `X-KanbanD-Wer`. `Content-Type: application/json`, `X-Content-Type-Options: nosniff`.
2. **Anwendung:** `anwendung=<kürzel>` wählt sie (leer = Standardanwendung). Ohne den Parameter gilt die erste Anwendung in der Reihenfolge der Verweise an der Karte; die übrigen Anwendungen mit Verweisen an der Karte nennt der Hinweis `weitere_anwendungen {anwendungen}`. Keine Verweise dieser Anwendung (oder keine an der Karte) → 404 `{fehler}`; `repository_fehlt` → 404 wie R00206. `anwendung=` zusammen mit `commit=` → 400.
3. **Einbezogen** werden die Verweise der Anwendung im Zustand `auf_zweig` (derselbe Helfer wie die Liste, R00204), **ohne** Merge-Commits. Verwaiste, Merges der Karte und Verweise in `fehlt`, `unlesbar`, `anwendung_unbekannt` stehen nur in `hinweise` (`verwaist`, `merge_ausgelassen`, `ausgelassen` mit `zustand`). Hat die Anwendung Verweise, aber keinen einbezogenen, ist die Antwort 200 mit `spanne null`, `commits []`, `dateien []` und den Hinweisen.
4. **Spanne und Basis** nach ADR-0032 N6.1: der letzte Kartencommit ist der einzige Kopf der einbezogenen; die Basis ist der erste Elternteil des ältesten auf der Erst-Eltern-Linie des letzten (beim Wurzel-Commit der leere Baum, `basis null`). `spanne` ist `{basis, letzter}` mit vollen Hashes, bei „ganz als Folge“ `null`.
5. **Netto oder Folge je Datei** nach N6.3: Eine Datei ist netto, wenn kein fremder Commit der Spanne (auch kein fremder Merge, gegen seinen ersten Elternteil gelesen, und kein Merge der Karte) einen ihrer Pfade berührt — bei einer Umbenennung beide Pfade. Alle anderen Dateien der Kartencommits sind Folge-Dateien.
6. **Ganz als Folge** nach N6.4 mit Hinweis `ganz_als_folge {grund}`: `nicht_linear` (mehr als ein Kopf oder ein Kartencommit nicht auf der Erst-Eltern-Linie), `fremd_zu_viele` (mehr als 1.000 fremde Commits in der Spanne), `fremd_zu_gross` (Namenslauf an seiner Grenze `GRENZE_NAMEN` abgeschnitten oder Pfadangabe der Kartenpfade über 1 MB). Dann gibt es keinen Netto-Eintrag.
7. **Antwortform** nach N6.6: `commits` in der Reihenfolge der Schritte (auf der Linie vom ältesten zum letzten; ganz als Folge wie die Liste), je Eintrag wie in R00206 FA 4. `dateien` nach dem Namen in Bytefolge, Netto- und Folge-Einträge gemischt. Ein **Netto-Eintrag** ist eine Datei wie in R00206 FA 5. Ein **Folge-Eintrag** ist `{pfad, plus, minus, binaer, schritte: [{commit, <Felder der Datei aus R00206 FA 5>}]}`; `commit` ist der Verweis wörtlich wie in der Datei der Karte. `plus`/`minus` eines Folge-Eintrags ist die **Summe der Schritte**, `binaer` ist wahr, wenn ein Schritt binär ist; eine Netto-Zahl für Folge-Dateien gibt es nicht.
8. **`hinweise`** in dieser Reihenfolge vor den Arten aus R00206 FA 7 (N6.7): `ganz_als_folge`, `fremd_dazwischen {commits, dateien}` (nur, wenn es Folge-Dateien gibt), `weitere_anwendungen`, `verwaist {verweis}`, `merge_ausgelassen {verweis}`, `ausgelassen {verweis, zustand}`; danach `dateien_gekappt` und `zu_gross_zum_anzeigen`. Kein Hinweis je Folge-Datei.
9. **`datei=<pfad>`** ohne `commit`: dieselbe Antwortform mit genau diesem Eintrag; bei einer Folge-Datei alle Schritte, Patch bis 8 MB über alle Schritte zusammen. Der Pfad muss ein Pfad der Kartencommits sein, sonst 404 `{fehler}`; nur solche Pfade erreichen Git. Ein einzelner Schritt bleibt über `?commit=<verweis>&datei=<pfad>` (R00206) ladbar.
10. **`format=patch`** ohne `commit` (N6.9): oben je Hinweis eine Zeile `# kanbanD: <art> …`; Netto-Dateien als Patch von Git; vor jedem Schritt einer Folge-Datei `# kanbanD: Folge <pfad> — Schritt i von n, Commit <verweis>`; fehlende Patches wie R00206 FA 9. Ohne Hinweise und ohne Folge ist der Text **bytegleich** zu `git diff --full-index -M50% -l1000 --submodule=short <basis> <letzter>`.
11. **Grenzen** wie R00206 (N6.8): je Netto-Datei und je Schritt 256 KB / 3.000 Zeilen → `gross`; **4 MB für Netto- und Folge-Patch zusammen** (der Folge-Lauf bekommt den Rest, ohne Rest sind alle Schritte `nachladen`); Kappe 2.000 Einträge (ein Folge-Eintrag zählt einmal und erscheint nur mit allen Schritten); Gesamtgrenze 10 s, Antwort ≤ 15 s, keine Teilantwort; Antwortbudget 64 MB mit 503 `Antwortbudget …`.
12. **`ETag`** nach N6.10 aus den Verweisen der Anwendung (wörtlich, in Reihenfolge), dem Fingerabdruck der Zweigspitzen, `anwendung`, `datei`, `format` und der Version der Grenzen; `If-None-Match` gleich → 304 ohne Rumpf nach zwei Git-Prozessen (Wurzel, Zweigspitzen).
13. Endpunktliste, OpenAPI-Beschreibung und README „Für Agenten“ beschreiben den Gesamt-Diff (Parameter `anwendung`, `datei`, `format`, Antwortform, Folge-Einträge, Arten von `hinweise`, Statuscodes).

## Nicht-funktionale Anforderungen

- **Prozesse:** höchstens **15 Git-Prozesse** je Anfrage, unabhängig von der Zahl der Kartencommits (N6.2: Namen und Folge über `diff-tree --stdin`, nie je Commit ein Prozess).
- **Lastprofil:** Gesamt-Diff von 30 Kartencommits, gestreut zwischen 1.000 Commits eines Repositorys mit rund 20.000 Commits, kalt **p95 < 500 ms** über die API (Herleitung: Ziel aus ADR-0032 N6.2; gemessen im Messskript des architekt etwa 230 ms kalt bei Last 1,3 — über die API **nicht gemessen, Hypothese**). `GET /api/aufgaben/{nr}`, `GET /api/aufgaben` und `/api/zustand` starten weiter kein Git.
- **`GRENZE_NAMEN` 4 MB** (Startwert, Hypothese, etwa 40.000 Einträge; N6.8) — wird in der Lastprobe gemessen.
- **Nur lesend und Startort:** `kommando()` bleibt der eine Startort; neu `merge-base` (nur `--independent`, ohne Schalter, liefert keinen Teil) und eine Eingabe für `git_teil` (für `diff-tree --stdin`); kein Befehl `diff` (N6.11). Lesen nimmt die Sperre des Board-Ordners nie.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API; Arbeits-Repository R, Board-Ordner, Anwendung `kd` als Standardanwendung und Schreibweise wie in R00206):

- Auf `main` von R der Commit **A0** mit `a.txt` (zwölf Zeilen `z1` … `z12`) und `r.txt` (zehn Zeilen `r1` … `r10`).
- **#2 (Folge):** danach auf `main` **K1** (Zeile 2 von `a.txt` wird `K1`, legt `k.txt` mit `k1`, `k2` an), **F** (fremd, nicht an einer Karte: Zeile 6 von `a.txt` wird `FREMD-6`, legt `f.txt` an), **K2** (Zeile 11 von `a.txt` wird `K2`, hängt `k3` an `k.txt`). #2 trägt `kd:<K1>`, `kd:<K2>`.
- **#3 (ohne fremd):** danach auf `main` **L1** (legt `l.txt` mit drei Zeilen an) und direkt darauf **L2** (ändert Zeile 2 von `l.txt`, legt die Binärdatei `bild2.bin` an). #3 trägt `kd:<L1>`, `kd:<L2>`.
- **Probe „nie fremd“** (PO Z. 426): Jede Zeile, die ein fremder Commit schreibt, enthält `FREMD`; kein Kartencommit ändert eine solche Zeile. Die Probe ist erfüllt (außer der Kartenschritt löscht oder schreibt eine solche Zeile selbst um, ADR-0032 N7.1), wenn in keinem `patch` der JSON-Antwort und in keiner Zeile des `format=patch`-Textes eine Zeile mit `+` oder `-` beginnt und `FREMD` enthält, und wenn `plus`/`minus` jedes Folge-Eintrags gleich der Summe über seine `schritte` ist.
- Weitere Karten stellt das Kriterium selbst her; „Git-Spur“, „Git-Skript“ und „Marke“ wie in R00206.

### Nie fremd

- [x] **AK 1 Folge, netto und verwaister Zwilling (Abnahme-Probe der Karte):**
  - `GET /api/aufgaben/2/diff` ergibt 200 wie im Beispiel-Aufruf: `a.txt` ist ein Folge-Eintrag mit den Schritten `kd:<K1>` und `kd:<K2>` (je `plus 1`, `minus 1`), `plus 2`, `minus 2`; `k.txt` ist netto (`status A`, `plus 3`); `f.txt` fehlt; `spanne` ist `{basis <A0>, letzter <K2>}`; `hinweise` ist `[{art "fremd_dazwischen", commits 1, dateien 1}]`. Die Probe „nie fremd“ ist erfüllt (JSON und `format=patch`).
  - Ohne fremden Commit: `GET /api/aufgaben/3/diff?format=patch` ist **bytegleich** zu `git diff --full-index -M50% -l1000 --submodule=short <L1>^ <L2>` in R; das JSON hat nur Netto-Einträge, `spanne {basis <L1^>, letzter <L2>}` und `hinweise []`.
  - Trägt #2 zusätzlich `kd:<K1'>` (derselbe Inhalt wie K1, vor einem Rebase entstanden, auf keinem Zweig: `verwaist` wie V1 in R00204), sind `spanne`, `commits` und `dateien` unverändert, und `hinweise` endet mit `{art "verwaist", verweis "kd:<K1'>"}`.
- [x] **AK 2 Umbenennung über einen fremden Commit:** Gegeben #4 mit **R1** (Zeile 1 von `r.txt` wird `R1`), fremd **FR** (Zeile 5 wird `FREMD-R`), **R2** (benennt `r.txt` in `s.txt` um und ändert Zeile 10), an #4 `kd:<R1>`, `kd:<R2>`. Dann stehen `r.txt` und `s.txt` nur in Folge-Einträgen (kein Netto-Eintrag mit `s.txt`), die Probe „nie fremd“ ist erfüllt, und der Schritt R2 trägt die Umbenennung (`status R`, `alt "r.txt"`, `neu "s.txt"`). Der Mutant „Pfadangabe des Netto-Laufs nur Netto-Pfade“ (ADR-0032 N6 Durchsetzung 2) macht einen benannten Test rot; die Commit-Nachricht nennt ihn.
  - **Umbenennungsgruppen der Karte (Nacharbeit, ADR-0032 N7.1, Test `b1_umbenennung_einer_fremd_angelegten_datei`):** (a) F legt `f1.txt` mit `FREMD`-Zeilen an, K2 benennt sie in `c.txt` um → `c.txt` ist Folge mit dem Schritt K2 `R f1.txt → c.txt`, 0/0, kein Netto-Eintrag mit `FREMD`-Zeilen; (b) F legt `x.txt` an, K1 benennt nach `y.txt` um → Folge; (c) Ziel netto gedeckt, Quelle Folge, weil F die Quelle stark umschreibt; (d) Kette über fremd angelegte Datei `u.txt → u1.txt → u2/inner`, danach angehängt; (e) Zwischenname ohne fremde Zeilen (`r.txt → m.txt → m.txt/inner`) ergibt eine Datei, einen Eintrag; (f) Zwischenname, den die Karte selbst anlegt (`n.txt → z.txt`) → netto `A z.txt`, `n.txt` erscheint nirgends. In allen Fällen gilt die Probe „nie fremd“ in JSON und `format=patch`.
  - **Typwechsel mit gleichem Blob (Nacharbeit, N7.2, Test `b2_typwechsel_mit_gleichem_blob`):** Kartenschritte ersetzen `d/x` durch `d/x/inner` und `b` durch `b/inner`, ohne und mit fremdem Commit auf `b`, dazu eine fremde Löschung von `d/x`: der Gesamt-Diff und `datei=` auf jeden Kartenpfad ergeben 200, nie 500.
  - **Tab im Dateinamen (Nacharbeit, Test `b5_dateiname_mit_tab_am_ende`):** eine Datei, deren Name auf Tab endet, in K1, F und K2 (auch umbenannt und binär) ergibt 200 mit einem Folge-Eintrag und beiden Schritten.
- [x] **AK 3 Merges:**
  - **Fremder Merge in der Spanne:** Gegeben #5 mit **M1** (ändert Zeile 1 von `m.txt`, 20 Zeilen), danach auf `main` mit `--no-ff` gemergt ein Seitenzweig, der Zeile 10 von `m.txt` zu `FREMD-M` macht (Merge **MF**, nicht an der Karte), danach **M2** (ändert Zeile 20). Dann ist `m.txt` ein Folge-Eintrag mit den Schritten M1 und M2, `fremd_dazwischen {commits 1, dateien 1}`, und die Probe „nie fremd“ ist erfüllt. Der Mutant „Merge ohne Elternzeile im Namenslauf“ (N6 Durchsetzung 3) macht einen benannten Test rot; die Commit-Nachricht nennt ihn.
  - **Merge an der Karte (PO Z. 427):** Gegeben #6 mit **N1** (ändert `n.txt`), danach auf `main` mit `--no-ff` gemergt ein Seitenzweig, der `y.txt` mit der Zeile `FREMD-Y` anlegt (Merge **MK**), danach **N2** (ändert `n.txt`); an #6 `kd:<N1>`, `kd:<MK>`, `kd:<N2>`. Dann nennt `commits` nur N1 und N2, `hinweise` enthält `{art "merge_ausgelassen", verweis "kd:<MK>"}`, `y.txt` steht nirgends in der Antwort, und die Probe „nie fremd“ ist erfüllt. `GET /api/aufgaben/6/diff?commit=kd:<MK>` ergibt weiter 200 mit `y.txt` (R00206 unverändert).
- [x] **AK 4 Ganz als Folge, nie netto:**
  - **Nicht linear:** Gegeben #7 mit **P1** auf `main` und **P2** auf dem Zweig `seite`, der vor P1 abzweigt und nicht gemergt ist: `hinweise` beginnt mit `{art "ganz_als_folge", grund "nicht_linear"}`, `spanne` ist `null`, jede Datei von P1 und P2 ist ein Folge-Eintrag, es gibt keinen Netto-Eintrag.
  - **Zu viele fremde:** Gegeben #8 mit **Q1**, danach genau **1.001** fremde Commits, danach **Q2**: `grund "fremd_zu_viele"`, kein Netto-Eintrag. Mit genau **1.000** fremden Commits dazwischen: kein `ganz_als_folge`, `spanne` gesetzt.
  - **Namenslauf abgeschnitten:** Gegeben #2 und `GRENZE_NAMEN` über einen internen Parameter auf 100 Byte verkleinert: `grund "fremd_zu_gross"`, `a.txt` **und** `k.txt` sind Folge-Einträge, kein Netto-Eintrag, und die Probe „nie fremd“ ist erfüllt.
  - **Namen über 4 MB (Nacharbeit, ADR-0032 N7.3, Test `b3_namen_der_kartencommits_ueber_vier_mb`):** Ein Kartencommit mit 1.000, 2.000, 2.001 oder 42.000 Dateien ohne fremde Commits ergibt 200, alles netto, höchstens 2.000 Einträge und bei mehr `dateien_gekappt`. Zwei Kartencommits zu je 21.000 Dateien mit einem fremden Commit dazwischen ergeben 200 mit `commits` vollständig, `dateien: []` und `{art "dateien_gekappt", gezeigt 0, gesamt <Obergrenze>}` (Summe der `dateien` der Kartenschritte); `datei=` ergibt dort 404 mit Verweis auf `commit=` und `datei=`. Nie 500.

### Antwort und Aufwand

- [x] **AK 5 Prozesse und `ETag`:**
  - Gegeben Karten mit 1, 10 und 30 Kartencommits, je in zwei Formen — linear ohne fremde Commits (alles netto) und abwechselnd mit fremden Commits auf denselben Dateien (Folge) —, und vor jeder Anfrage ein Zweig in R bewegt (kalt). Dann startet jede Anfrage **höchstens 15** Git-Prozesse (Zähler der Git-Aufrufe), und je Form ist die Zahl bei 10 und bei 30 Commits gleich. Rechenbeispiel der Obergrenze: 3 (Wurzel, Typ, Metadaten) + 3 (Zustand kalt) + 2 (letzter, Spanne) + 1 (Namen) + 3 (Netto) + 3 (Folge) = 15.
  - Dieselbe Anfrage mit `If-None-Match` ihres `ETag` → 304 ohne Rumpf nach genau **2** Git-Prozessen. Nach einem neuen Commit auf einem beliebigen Zweig von R (`nebenbei`) → 200 mit anderem `ETag`; ein anderer Wert von `anwendung`, `datei` oder `format` → 200.
  - Wird `main` in einer Kopie der Ausgangslage auf K1 zurückgesetzt (K2 wird `verwaist`), ergibt die Anfrage mit dem alten `ETag` 200 (kein 304): `commits` nennt nur K1, und `hinweise` enthält `{art "verwaist", verweis "kd:<K2>"}`.
- [x] **AK 6 Antwortform, Anwendungen, ersetzt „ohne `commit` 400“:**
  - `GET /api/aufgaben/2/diff` ohne `commit` ergibt 200 (nicht mehr 400 wie in R00206 FA 11 und AK 3); die Felder je Eintrag in `commits` gleichen denen von `GET /api/aufgaben/2/commits` ohne Zustand und Zweige; `dateien` steht nach dem Namen in Bytefolge.
  - Ist eine zweite Anwendung `zw` im Register auf ein Repository R2 eingetragen und trägt #2 zusätzlich `zw:<Z1>` (nach den `kd`-Verweisen), gilt ohne `anwendung` weiter `kd`, und `hinweise` enthält `{art "weitere_anwendungen", anwendungen ["zw"]}`; mit `anwendung=zw` kommt `anwendung "zw"` mit der Datei von Z1.
  - `anwendung=xx` (kein Verweis dieser Anwendung) und eine Karte ohne Verweise → 404 `{fehler}`; `anwendung=kd&commit=kd:<K1>` → 400. Stehen an #2 von Hand ein gelöschter Commit, ein Verweis auf eine nicht registrierte Anwendung und ein mehrdeutiger Kurz-Hash, bleibt die Antwort 200 mit denselben `dateien`, und `hinweise` nennt die drei als `ausgelassen` mit `zustand` `fehlt`, `anwendung_unbekannt` und `unlesbar`.
  - Endpunktliste, OpenAPI und README „Für Agenten“ (Abschnitt „Alle Änderungen der Karte lesen“ mit dem Beispiel-Aufruf) beschreiben den Gesamt-Diff mit Parametern, Folge-Einträgen, Arten von `hinweise` und Statuscodes; die Vertragstests zählen keine neue Route.
- [x] **AK 7 `datei=` und `format=patch`:**
  - An #2: `datei=k.txt` ergibt genau den Netto-Eintrag aus AK 1; `datei=a.txt` genau den Folge-Eintrag mit beiden Schritten und ihren Patches. `datei=f.txt` (nur F hat sie berührt), `datei=*` und `datei=../a.txt` ergeben 404 `{fehler}`, und die Git-Spur zeigt keinen Lauf mit diesem Text als Pfadangabe.
  - `GET /api/aufgaben/2/diff?format=patch` ergibt 200, `Content-Type: text/x-diff; charset=utf-8`, `nosniff`; die erste Zeile ist `# kanbanD: fremd_dazwischen …`; vor den Patches von `a.txt` stehen `# kanbanD: Folge a.txt — Schritt 1 von 2, Commit kd:<K1>` und `… Schritt 2 von 2, Commit kd:<K2>`; `k.txt` steht als Patch von Git da.
- [x] **AK 8 Grenzen und Antwortbudget wie A3:**
  - **Kappe:** Eine Karte, deren einziger Commit 2.001 Dateien anlegt, liefert 2.000 Einträge und `{art "dateien_gekappt", gezeigt 2000, gesamt 2001}`.
  - **4 MB zusammen:** Gegeben #9 mit **S1** (25 neue Dateien zu je 2.000 Zeilen aus 99 `a` wie R00206 AK 8, dazu `t.txt`), fremd **FS** (ändert `t.txt`), **S2** (ändert `t.txt`). Dann haben die ersten 20 Netto-Dateien einen `patch`, die Dateien 21 bis 25 sind `nachladen`, beide Schritte von `t.txt` sind `nachladen` ohne `patch` (kein Rest), und die Git-Spur zeigt keinen Patch-Lauf für die Folge. `datei=t.txt` liefert beide Schritte mit `patch`.
  - **Gesamtgrenze:** Mit einem Git-Skript, das jeden Aufruf 4 s hält, antwortet der Gesamt-Diff nach spätestens 15 s mit 503 `{fehler}`, ohne Teilantwort, und danach läuft kein Git-Prozess mehr.
  - **Antwortbudget:** Die Probe von R00206 AK 20 (b) mit N = 30 über `GET …/diff?datei=gross1.txt` **ohne** `commit` ergibt höchstens ⌊64 MB / Antwortgröße⌋ Antworten 200, die übrigen 503 mit `fehler`, das mit `Antwortbudget` beginnt.
  - **Grenzen zusammen (Nacharbeit, Tests `b4a_vier_mb_zusammen`, `b4b_pfadangabe_ueber_ein_mb`, `b4c_folge_liste_abgeschnitten`):** (a) Netto 2 MB plus Folge 3 MB ergeben zusammen höchstens 4 MB Patch; (b) Pfadangabe der Kartenpfade über 1 MB → `ganz_als_folge` mit `fremd_zu_gross`; (c) Folge-Liste über 1 MB → ein Folge-Eintrag steht nur mit allen Schritten, der angefangene zählt in `dateien_gekappt`, und `fremd_dazwischen` steht auch, wenn alle Folge-Dateien verworfen sind.

### Sicherheit und Last

- [x] **AK 9 Feindliche Konfiguration und nur lesend:**
  - Mit Konfiguration, Attributen und Umgebung wie in R00206 AK 16 (a) (jede auf ein Skript, das eine Marke anlegt) und den Einstellungen aus R00206 AK 16 (b), dazu `diff.renames=false` und `diff.renameLimit=1`, sind die Antworten von AK 1 und AK 2 (JSON und `format=patch`) **bytegleich** zu denen im sauberen Repository, und **keine** Marke entsteht.
  - `anwendung=--output=x`, `datei=--output=x` und `datei=$(touch x)` ergeben 400 oder 404 mit `fehler`; danach liegt weder in R noch im Board-Ordner eine Datei `x`.
  - Nach allen Anfragen dieser Anforderung sind `git count-objects -v` und `git status --porcelain` in R unverändert, es gibt keine `index.lock`, die Commit-Zahl des Board-Ordners ist gleich und die Dateien der Karten sind bytegleich. Die Befehlszeilen von `merge-base --independent` und `diff-tree --stdin` laufen gegen echtes Git mit Ausstiegscode 0; der Fitness-Test „Git nur an drei Orten“ (R00204) bleibt grün.
  - **Mehrdeutige Namen (Nacharbeit, Security S1, ADR-0032 N7.4, Test `s1_dateien_mit_hash_namen`):** je eine getrackte und eine ungetrackte Datei mit dem Hash eines Kartencommits, seines Elternteils und der Basis als Namen → Gesamt-Diff, `format=patch`, `datei=` und die Commit-Liste antworten 200, bytegleich zur Antwort ohne diese Dateien (`--` steht hinter den Revisionen).
  - **Ersatzobjekte (Nacharbeit, Security S2, N7.4, Test `s2_replace_refs_schmuggeln_nichts`):** `git replace <K1> <evil>` in R → 200 ohne `FREMD`-Zeile, bytegleich zur Antwort ohne den Ref (`GIT_NO_REPLACE_OBJECTS=1`).
- [x] **AK 10 Lastprobe und `GRENZE_NAMEN` (Hypothese, wird gemessen):** Gegeben ein Wegwerf-Repository mit rund 20.000 Commits (Erzeuger aus B0998) und eine Karte mit 30 Kartencommits, gestreut zwischen 1.000 Commits (S3 aus ADR-0032 N6 „Belegt“): 20 kalte Läufe (vor jedem ein Zweig bewegt), gemessen am Client bis zum letzten Byte, im 95. Perzentil (19. von 20) **unter 500 ms** bei Rechnerlast unter 2. Gemessen werden auch die Bytes des Namenslaufs für eine Spanne mit genau 1.000 fremden Commits; sie liegen unter `GRENZE_NAMEN` (sonst griffe `fremd_zu_gross` vor `fremd_zu_viele`). Beide Werte stehen in der Commit-Nachricht. Die Schwellen ändert niemand; werden sie verfehlt, meldet der entwickler `anforderung_falsch` mit den Messwerten.

## Betroffene Verzeichnisstruktur

- `src/git/arbeitsrepo.rs` — `Befehl::MergeBase` (nur `--independent`), `git_teil` mit Eingabe auf `stdin`, Läufe für Spanne, Namen, Netto und Folge
- `src/modell/gesamt_diff.rs` (neu) — Einteilung netto/Folge, Folge-Einträge, Summen, Hinweise; `src/modell/commit_diff.rs` — Zerlegen und Zuordnen für Ausgaben vieler Commits
- `src/dienst/diff.rs` — ohne `commit` der Gesamt-Diff, `anwendung`, `datei`, `format`, `ETag`
- `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs`, `README.md` — Beschreibung
- Tests: neu `tests/akzeptanz_r00208.rs`, `tests/lastprobe_r00208.rs`; geändert `tests/akzeptanz_r00206.rs` (nur der Fall „ohne commit“); erweitert `tests/arbeitsrepo.rs`, `tests/gemeinsam/mod.rs`

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1025 Startort:** `merge-base --independent`, `git_teil` mit Eingabe; Befehlszeile gegen echtes Git.
2. **B1026 Spanne und Einteilung:** Merges der Karte aussondern, letzter Kopf, Spanne, Namenslauf über `--stdin` mit Elternzeile, `D_karte`/`D_fremd`, netto/Folge, Gründe für „ganz als Folge“ (AK 1–4).
3. **B1027 Netto- und Folge-Läufe:** Pfadangabe `D_karte` im Netto-Lauf, Folge über `--stdin`, Zerlegung nach Köpfen, Zuordnung über Blob-Hashes je Schritt, Summen, 4 MB zusammen, Kappe (AK 1, 2, 8).
4. **B1028 Dienst:** ohne `commit`, `anwendung`, `datei`, `format=patch`, `ETag`, Hinweise, Beschreibung; R00206-Test „ohne commit“ umstellen (AK 5–8).
5. **B1029 Probe im echten Programm:** Prozesszähler, Lastprobe, `GRENZE_NAMEN`, Gate, Anforderung abschließen (AK 5, 9, 10).

Bubbles mit `Eingabe → Ausgabe` stehen in der WBS (`Dokumentation/Planung/kanbanD.md`, I0198).

### Hinweise

- **Aus A2 und A3 wiederverwendet:** Zustandshelfer der Liste (Fingerabdruck, Cache, Z5), `metadaten` (Elternteile), `git_teil` und `Teil`, Grenzen und `GRENZEN_VERSION`, Zuordnung über Blob-Hashes (N5.2), Antwortbudget und Strom (N5.1), Testhelfer und Erzeuger in `tests/gemeinsam`.
- **Pre-Mortem aus ADR-0032 N6:** Pfadangabe nur aus Netto-Pfaden (AK 2); Namenslauf mit `log --name-only` (liest `diff.renames`, AK 9); abgeschnittener Namenslauf als vollständig behandelt (AK 4); Folge je Commit statt `--stdin` (AK 5).
- **Review-Punkt** für `security-reviewer` und `architektur-reviewer` (N6): Netto nur mit vollständiger Fremdmenge; jede Pfadangabe aus `D_karte`; neue Befehle nur im Startort.

## Tests

- API-Tests gegen Wegwerf-Repositories (Karten #2 bis #9 der Ausgangslage) mit Git-Spur und Git-Skripten (AK 1–9); Probe „nie fremd“ als gemeinsame Prüffunktion über JSON und `format=patch`.
- Modultests für die Befehlszeilen, `git_teil` mit Eingabe, die Zerlegung vieler Köpfe und die Einteilung netto/Folge (rein, ohne Git).
- Die zwei Mutanten aus AK 2 und AK 3 werden gefahren; die Commit-Nachricht nennt je Mutant den roten Test.
- Lastprobe als eigener Test mit `#[ignore]`, `--release` (AK 10).
- **Geänderte Erwartung an bestehenden Tests:** nur der Fall „ohne commit“ in `tests/akzeptanz_r00206.rs` (400 → Gesamt-Diff) und die Befehlsliste (ein Befehl mehr).

## Abhängigkeiten

- **Abhängig von:** [R00206](R00206-diff-eines-commits-per-api-lesen.md) (I0196, Karte #213, `braucht:213`) — Diff je Commit, `git_teil`, Grenzen, Antwortbudget, Zuordnung; [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md) (Zustände, Zweigliste, Zähler).
- **Berührt, ohne abzuhängen:** B2 #209 (R00207, I0197) liest nur `?commit=`; in der WBS sind Konflikte möglich (IDs getrennt: hier R00208, I0198, B1025–B1029). #224 stellt danach die Wurzel der Anwendung um; bis dahin bestimmt dieser Diff die Wurzel wie heute (PO Z. 429).
- **Blockiert:** B3 #215 („Alle Änderungen der Karte“ in der Review-Seite).

## Offene Fragen

**Keine, die den Bau aufhalten.** Technik entschieden (architekt, ADR-0032 N6), Produktfragen entschieden (PO Z. 426, 427).

- **Offen bis zur Lastprobe (AK 10):** p95 < 500 ms über die API und `GRENZE_NAMEN` 4 MB.
- **Glossar:** an den `fachspezialist` (über den Director): Gesamt-Diff, Spanne, fremder Commit, netto, Folge (dazu die offenen Begriffe aus R00204 und R00206).

## Bekannte Grenzen

- **Umbenennungspaare über `-l1000` (ADR-0032 N7.1, offen aus der Nacharbeit):** Hat ein Kartenschritt mehr als 1.000 Umbenennungskandidaten, hebt Git die unscharfe Erkennung auf; das Paar fehlt, die Umbenennungsgruppe zerfällt, und eine fremd angelegte, von der Karte umbenannte Datei kann dann netto mit fremden Zeilen erscheinen. Nicht abgedeckt, keine Probe; wie N4.3 für den Diff je Commit.
- **Kartenschritt ändert fremde Zeilen (N7.1):** Löscht oder schreibt ein Kartenschritt Zeilen eines fremden Commits selbst um, erscheinen sie als `-`-Zeilen dieses Schritts — das ist Arbeit der Karte.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: Agenten können alle Änderungen einer Karte mit einem Aufruf lesen (`GET /api/aufgaben/{nr}/diff` ohne `commit`); fremde Commits dazwischen bleiben draußen, betroffene Dateien kommen als Folge der Kartenschritte. Die Ansicht dazu (B3) folgt.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Zwischen den Commits einer Karte landen auf `main` fremde Commits (andere Karten, Merges); wer heute die Karte als Ganzes beurteilen will, liest jeden Commit einzeln oder rechnet `git diff` über die Spanne und bekäme dann fremde Zeilen als Arbeit der Karte. Fragt der Agent den Gesamt-Diff ab (X), teilt der Server jede Datei danach ein, ob ein fremder Commit sie berührt: unberührte netto, berührte als Folge der Kartenschritte, und bei Zweifel (nicht linear, zu viele, abgeschnitten) alles als Folge (Y). So sieht der Agent mit einem Aufruf das Gesamtbild, und keine Zeile fremder Arbeit wird der Karte zugeschrieben (Z). Weil die Fremdmenge vollständig sein muss, bevor irgendetwas netto erscheint, und Namen und Folge in einer festen Zahl von Prozessen laufen, bleibt das auch bei langen Karten und feindlichen Repositorys richtig und billig.

## Notizen

- Heimat: I0198 unter D0009 „Arbeit hinter der Karte“, Geschwister von I0192 bis I0197.
- **Optionen** stehen in ADR-0032 N6 und sind dort entschieden: Basis B1 (statt `merge-base` mit dem Zielzweig oder je Commit), Namen und Folge P2 über `diff-tree --stdin` (statt drei Läufe je Commit oder `log -p`), `ETag` E3 (statt keinem oder einem aus den Verweisen allein). Verworfen ist auch eine Netto-Zahl für Folge-Dateien (enthielte fremde Zeilen, N6.6).
- **Schlank arbeiten (A):** zehn Kriterien; Grenzfälle und Mutanten gehören dem entwickler. Die zwei Mutanten in AK 2 und AK 3 stehen ausdrücklich da, weil ADR-0032 N6 „Durchsetzung“ sie als Beleg für „nie fremd“ verlangt.
- **Inkauf (ADR-0032 N6):** Kontextzeilen eines Kartenschritts können fremden Text zeigen (PO Z. 426); eine Kopie oder schwache Umbenennung aus einer fremd geänderten Datei gilt als Kartenarbeit; die Konfliktauflösung eines Merges der Karte fehlt im Gesamtbild (sichtbar am Hinweis); der `ETag` wird bei jeder Zweigbewegung ungültig; Summen zählen später geänderte Zeilen doppelt.
- **Herleitung der Zahlen:** 15 Prozesse aus N6.2 (Rechenbeispiel AK 5); 1.000 fremde aus ADR-0032 Punkt 7.5; 4 MB, 8 MB, 256 KB, 3.000 Zeilen, 2.000 Einträge, 64 MB wie R00206; `GRENZE_NAMEN` 4 MB und 1 MB für die Pfadangabe Startwerte (Hypothese, N6.4, N6.8); p95 < 500 ms Ziel aus N6.2 (über die API nicht gemessen); 20 · 202.019 = 4.040.380 < 4.194.304 < 21 · 202.019 = 4.242.399 (AK 8, wie R00206 AK 8).
