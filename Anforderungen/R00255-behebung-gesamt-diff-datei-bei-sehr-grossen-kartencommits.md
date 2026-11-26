---
id: R00255
status: Neu
datum: 2026-11-26
ursprung: Bug-Report
ursprungslauf: R00213
---

# R00255: Behebung — Gesamt-Diff: `datei=` bei sehr großen Kartencommits meldet 404 statt der Datei

## Beschreibung

Befund der Karte #230 (Probe `et230_lang.py`, 2026-11-23), Karte #236. Eine Karte, deren Commits sehr viele Pfade anlegen, hat im Gesamt-Diff ([R00208](R00208-gesamt-diff-der-karte-per-api-lesen.md)) Dateien, die der Leser mit `&datei=<pfad>` nicht bekommt, obwohl der Pfad in einem Kartencommit steht. Der Leser ist ein Reviewer-Agent der Factory (oder der Mensch `sh` über dieselbe API). Das ist der Rest von [R00213](R00213-behebung-gesamt-diff-500-bei-gleich-bewerteten-umbenennungsquellen.md) US-3 („ein zu langer Lauf wird zur Lücke mit Hinweis“): R00213 hat das 500 beseitigt und ein 404 mit Hinweis auf `commit=` und `datei=` gelassen. Das genügt dort, wo kein anderer Weg zur Datei führt. Hier führt einer: dieselbe Auswertung wäre ohne weiteren Git-Prozess möglich.

Drei Wege derselben Klasse (eine Grenze entscheidet über einen Pfad, den sie nicht betrifft), alle in [ADR-0032 Nachtrag N10](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) belegt:

- **E1, Folge-Liste mit `datei=`.** Steht die Datei in einem späteren Kartencommit hinter dem 1-MB-Schnitt der Folge-Liste, ergibt `datei=` 404 („die Liste der Änderungen ist aber zu groß …“). Netto-Läufe mit `datei=` laufen seit N8.6 bis 20 MB, Folge-Läufe nicht.
- **E2, `fremd_zu_gross` ohne fremden Pfad.** Die Pfadangabe zählt nach 1 MB als „zu lang“ auch dann, wenn gar keine fremden Pfade da sind und die Angabe deshalb nie läuft. Die Karte fällt in `ganz_als_folge`, obwohl sie netto lesbar wäre.
- **E3, `datei_fehlt` bei abgeschnittenen Namen.** Bei einem Kartencommit mit über 4 MB Namen kappt der Namenslauf. Ein Pfad hinter dem Schnitt ergibt 404 „die Datei steht in keinem Kartencommit“ — wörtlich falsch, es ist der Titel der Karte.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112). Eine Aussage „steht in keinem Kartencommit“, die nicht stimmt, und eine Datei, die der Agent nicht bekommt, obwohl sie lesbar wäre, beides führt den Reviewer in die Irre.

**Erwartet** (Karte #236, PO Z. 673–675, Zuschnitt E1–E3; F-d „Folge-Grenze allgemein anheben“ nicht jetzt): `datei=` liefert 200, wo die Datei mit denselben Schaltern und ohne zusätzlichen Prozess lesbar ist, und sonst den richtigen 404.

## Ursachenanalyse

### Root Cause

Belegt am Stand von `main` `22967bb8` (ADR-0032 N10.1, am Code nachvollzogen) und durch die Proben des entwicklers (Lauf 236-entwickler-1, am Stand von `main`: P1, P3, P4 heute rot, wie vorhergesagt).

- **E1** `src/dienst/gesamt_diff.rs:450–451`: `folge_listen` liest Roh- und Zähler-Lauf immer mit `GRENZE_DATEILISTE` (1 MB). Die 20 MB mit `datei=` (`:218`, `grenze_netto_datei`) gelten nur für den Netto-Lauf. Im Fall `ganz_als_folge` läuft gar kein Netto-Lauf, also greift sie nie.
- **E2** `:201` (`Einteilung::pfadangabe_zu_lang`, `src/modell/gesamt_diff.rs:304`): die Bedingung prüft die Länge der Pfadangabe `D_karte`, nicht ob es fremde Pfade gibt. Ohne `D_fremd` läuft der Netto-Lauf ohne Angabe (`:213`, N7.3 erster Punkt), die Grenze schützt einen Lauf, der nicht stattfindet.
- **E3** `:274`: `datei_fehlt` steht, sobald der Pfad nicht in `D_karte` steht, auch wenn `D_karte` aus abgeschnittenen Namen gebildet ist. Die Bedingung `!namen_vollstaendig` steht schon in `:336` (N8.6 (d)), nicht aber hier.

Ausgeschlossen: ein Fehler in der Paarung der Umbenennungen (R00213) und ein Fehler der Oberfläche; die Review-Seite lädt `datei=` nur für Einträge der Liste (ADR-0033), sie ändert sich nicht.

Der Fehler ist eingetreten, nicht latent: die Probe der Karte #230 zeigt ihn im echten Programm. Schaden: ein Agent, der eine Datei einer sehr großen Karte lesen will, bekommt 404 mit falscher oder unnötiger Aussage und muss jeden Schritt über `commit=` einzeln laden.

### Betroffene Komponenten

- `src/dienst/gesamt_diff.rs`: `folge_listen`, Einteilung der Pfadangabe, `datei_fehlt` (A00004 Dienste)
- `src/modell/gesamt_diff.rs`: `EINTEILUNG_VERSION` 2 → 3 (Antworten ohne `datei=` ändern sich durch E2, also wechselt der `ETag`)
- `README.md` „Für Agenten“, Gesamt-Diff, Satz zu `datei=` (Z. 246); API-Beschreibung `DIFF_LESEN` (`src/web/endpunkte.rs`)
- Tests: neue Datei `tests/akzeptanz_r00255.rs`, Modultests in `src/dienst/gesamt_diff.rs`
- **Nicht** betroffen: Oberfläche (`web/`), `format=patch` ohne `datei=`, Antwortform und Texte der 404

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0032 N10.3 (Entscheidung, Wortlaut für den entwickler):

1. **E1**: `folge_listen` nimmt mit `datei=` für Roh- und Zähler-Lauf die Grenze `grenze_netto_datei` (20 MB), ohne `datei=` weiter 1 MB als internes Feld (z. B. `grenze_folge_liste`, Startwert 1 MB), damit ein Modultest sie verkleinern kann. Pfadangabe, Prozesszahl und Patch-Lauf bleiben.
2. **E2**: `pfadangabe_zu_lang` führt nur zu `fremd_zu_gross`, wenn die Angabe auch läuft, also `D_fremd` nicht leer ist (dieselbe Bedingung wie `:213`). Ohne fremden Pfad läuft der Netto-Lauf ohne Angabe.
3. **E3**: `datei_fehlt` nur bei vollständigen Namen (`namen_vollstaendig`). Bei unvollständigen entscheiden die Läufe; bleibt die Auswahl leer, folgt `datei_hinter_dem_schnitt` (N8.6 (d)).
4. **`ETag`**: `EINTEILUNG_VERSION` 3.

Akzeptierte Schwäche (N10.3): Die Liste ohne `datei=` bleibt bei großen Kartencommits leer (`dateien_gekappt {gezeigt: 0}`), nur `datei=` sieht mehr — dieselbe Asymmetrie wie N8.6 D-b.

### Alternative Ansätze

Verworfen nach ADR-0032 N10.2:
- **F-a, `datei=` sucht gezielt mit Pfadangabe nur dieser Datei**: eine kleinere Angabe ändert die Paarung der Umbenennungen (N7.8, N7.10; Pre-Mortem (o) aus N8.6).
- **F-b, nur eine eigene 404**: steht schon (N8.6 (d)); 200 ist ohne Prozess möglich.
- **F-d, Folge-Grenze allgemein anheben**: ändert Antworten der Liste und das Lastprofil über den Bug hinaus; PO Z. 673–675: nicht jetzt.
- **F-e, Ausgabe des zweiten Namenslaufs wiederverwenden**: Optimierung, kein Fix.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Die Fälle der Akzeptanzkriterien kommen als erste Tests und sind **rot ohne Fix** (P1, P3, P4 heute rot, belegt vom entwickler). Integrationstest im echten Programm (`tests/akzeptanz_r00255.rs`, Helfer wie `tests/akzeptanz_r00208.rs`); die großen Fälle (17.000 bzw. 45.000 Pfade) als Tagprobe, kleine Spiegelfälle als Modultest mit verkleinerten Grenzen (`grenze_folge_liste`, `grenze_namen`, `grenze_netto_datei`). Die gemessenen Werte stehen in der Commit-Nachricht der ersten Bubble.

### Code-Extraktion für isoliertes Testing

Nicht nötig: die Grenzen sind interne Felder der Konfiguration des Dienstes (wie `grenze_namen`, `:193`).

### Regressionstests

Ohne geänderte Erwartung grün:
- `tests/akzeptanz_r00225.rs` (G1, G2, D1, D2 aus N8.6), `tests/akzeptanz_r00213.rs` (AK 1–4), `tests/akzeptanz_r00208.rs`, `tests/akzeptanz_r00206.rs`
- `tests/lastprobe_r00208.rs`; höchstens 15 Git-Prozesse ohne `datei=`

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API wie R00208; Arbeits-Repository R, Anwendung `kd`, Probeprogramm der Factory `gemeinsam/scratchpad/etst-230/et230_lang.py <programm> 17000 <fall>` und `gemeinsam/scratchpad/entw1-236/p4.py`):
- **Fall kfk**: Vorgänger `a.txt`; K1 legt 17.000 Dateien mit je 127 Byte Pfad an (`<erster K1-Pfad>` … `<letzter K1-Pfad>`); F (fremd) ändert `a.txt`; K2 legt `k2.txt` an. Die Aufgabe trägt `kd:<K1>`, `kd:<K2>`.
- **Fall kk**: nur K1 (17.000 Pfade), kein fremder Commit.
- **Fall d45**: ein Kartencommit mit 45.000 kurzen Pfaden `d/000000` … `d/044999` (Namenslauf über 4 MB).

### Bug behoben

- [ ] **AK 1 Folge-Liste, `datei=` (Abnahme-Probe P1, wörtlich aus N10.4):** Fall kfk: `…&datei=k2.txt` ergibt 200 mit einem Folge-Eintrag `k2.txt`, Schritt K2 `A`, Patch mit `+k2`. `…&datei=<erster K1-Pfad>` und `…&datei=<letzter K1-Pfad>` ergeben 200 mit Schritt K1. Heute: `datei=k2.txt` 404 „… die Liste der Änderungen ist aber zu groß …“.
- [ ] **AK 2 Gegenprobe zu AK 1:** Fall kfk: `…&datei=a.txt` bleibt 404 mit „in keinem Kartencommit“ (der Pfad steht nur im fremden Commit). Die Liste ohne `datei=` bleibt unverändert: `ganz_als_folge` mit `fremd_zu_gross`, `dateien: []`, `dateien_gekappt`.
- [ ] **AK 3 Pfadangabe nur mit fremden Pfaden (P3):** Fall kk: die Liste ergibt 200 **ohne** `ganz_als_folge`, mit Netto-Einträgen und `dateien_gekappt {gezeigt: 2000, gesamt: 17000}`; `…&datei=<letzter K1-Pfad>` (hinter dem Schnitt der Liste) ergibt 200 mit Netto-Eintrag `A`. Heute: `ganz_als_folge` mit `fremd_zu_gross`. **Gegenprobe** Fall kfk: bleibt `ganz_als_folge`/`fremd_zu_gross` (AK 2).
- [ ] **AK 4 `datei_fehlt` nur bei vollständigen Namen (P4):** Fall d45: `…&datei=d/044999` ergibt 200 mit Netto-Eintrag `A` innerhalb der Frist von 10 s. `…&datei=nicht/da` ergibt 404 mit dem Text von `datei_hinter_dem_schnitt` (N8.6 (d), PO Z. 514), dessen `fehler` **nicht** „in keinem Kartencommit“ enthält und `commit=` nennt. Heute: `datei=d/044999` 404 „steht in keinem Kartencommit“.
- [ ] **AK 5 Vollständige Namen behalten den Text:** Ist der Namenslauf vollständig (kleine Karte, Fall D2 aus R00225 AK 6), ergibt `…&datei=nicht/da.txt` weiter 404 mit „in keinem Kartencommit“. Als Modultest im Kleinen (60 Dateien `d/00…d/59`, `grenze_namen` so klein, dass der Namenslauf nach etwa 20 Einträgen kappt): `datei=d/59` 200 netto `A`, `datei=nicht/da` 404 `datei_hinter_dem_schnitt`.
- [ ] **AK 6 Liste ohne `datei=` wird nicht größer (Modultest, N10.3 Punkt 1):** Mit kleiner `grenze_folge_liste` und `ganz_als_folge` über einen nicht-linearen Verlauf (K1 auf einem Seitenzweig, K2 auf `main`) liefert die Liste ohne `datei=` weiter `dateien: []` mit `dateien_gekappt`; `datei=<Pfad aus K2>` ergibt 200 (Folge). Mit zusätzlich kleiner `grenze_netto_datei` ergibt `datei=` 404 hinter dem Schnitt, nicht „in keinem Kartencommit“.
- [ ] **AK 7 `ETag`:** Der `ETag` einer Antwort ohne `datei=` wechselt mit dem Fix: ein `If-None-Match` mit dem `ETag` der Antwort vor dem Fix ergibt 200, nicht 304 (Modultest: `EINTEILUNG_VERSION` 3 ergibt einen anderen `ETag` als 2).
- [ ] **AK 8 Mutanten:** Jeder Mutant wird von einem benannten Test getötet.
  - (m1) Folge-Liste mit `datei=` weiter 1 MB → AK 1, AK 6 rot.
  - (m2) Folge-Grenze auch ohne `datei=` 20 MB → AK 6 (Liste) rot.
  - (m3) `pfadangabe_zu_lang` ohne Bedingung `D_fremd` → AK 3 rot.
  - (m4) Bedingung `D_fremd` auch mit fremdem Commit weg → Gegenprobe AK 3 (kfk) rot.
  - (m5) `datei_fehlt` ohne `namen_vollstaendig` → AK 4 rot.

  Mutanten laufen in einer eigenen Kopie, nicht im Worktree der Karte. Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [ ] **AK 9 README und API-Beschreibung:** Der Satz zu `datei=` im Abschnitt Gesamt-Diff (README „Für Agenten“, Z. 246) sagt in einem Halbsatz, dass `datei=` auch hinter dem Schnitt der Liste und bei sehr großen Kartencommits 200 liefert, solange die Liste der Änderungen mit `datei=` (bis 20 MB) lesbar ist, und sonst 404 mit Hinweis auf `commit=`; die Zeile `DIFF_LESEN` bleibt dazu stimmig.
- [ ] **AK 10 Bug-Vorlage:** Die Reproduktionstests (AK 1–4) sind ohne Fix rot und mit Fix grün. Die Regressionstests oben bleiben grün ohne geänderte Erwartung (G1/G2/D1/D2, R00213 AK 1–4), ebenso die Lastprobe von R00208 und die Prozessgrenze (höchstens 15 Git-Prozesse ohne `datei=`). Der Fehler der Karte tritt im Szenario der User Story nicht mehr auf.

## Implementierungshinweise

- Zähler-Lauf und `folge_patches` sind vom planer nicht gelesen: der entwickler prüft, ob dort eine eigene 1-MB-Grenze liegt, die E1 noch aushebelt (die Auswahl bliebe leer), und meldet das.
- P4 als Modultest über ein kleines internes `grenze_namen` (60 Dateien `d/00…d/59`, Schnitt nach etwa 20 Einträgen); die 45.000-Pfade-Probe ist die Tagprobe im echten Programm (heute rund 2,5 s je Aufruf, Frist 10 s, Last ≤ 6, 8–21 Uhr).
- Unverändert: Antwortform, Texte, 1 MB für Listen ohne `datei=`, 4 MB Namen, höchstens 15 Git-Prozesse, Antwortbudget 64 MB, Frist 10 s.
- Die ADR-0032 N11 (Karte #233, Diff je Commit) berührt `src/dienst/` parallel: nur im Kopf behalten, keine Abhängigkeit in der Reihenfolge (ADR N10.5).

## Offene Fragen

Keine hält den Bau auf.

1. **Folge-Grenze ohne `datei=` allgemein anheben (F-d)?** Entschieden: nicht jetzt (PO Z. 673–675). Empfehlung des planers: nur auf Betreiberwunsch, als eigene Karte, weil `ETag`, Lastprofil R00208 und Patch-Budget mitziehen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Eine Karte legt in K1 17.000 Dateien an, ein fremder Commit liegt dazwischen, K2 legt `k2.txt` an. Der Agent fragt `datei=k2.txt` und bekommt 404, obwohl die Datei lesbar ist. Die Folge-Liste liest ihre Läufe mit 1 MB, K1 füllt sie, K2 steht hinter dem Schnitt, die Auswahl bleibt leer. Hebt `datei=` die Grenze der Folge-Läufe wie schon die der Netto-Läufe auf 20 MB, steht `k2.txt` in der Auswahl und die Antwort ist 200. Dieselbe Hebung gilt für `datei_fehlt` und `pfadangabe_zu_lang` nur dort, wo ihre Aussage auch stimmt (vollständige Namen, vorhandene fremde Pfade); die Wirkungskette: Grenze nur für den Lauf, den sie schützt → keine falsche Aussage und kein vermeidbares 404 → der Agent liest die Datei, ohne jeden Schritt einzeln zu laden.

## Notizen

- Priorität: Mittel. Die Antwort ist 404 mit Hinweis, nicht 500; betroffen sind nur Karten mit Tausenden Pfaden in einem Commit.
- Betroffene Nutzer und Systeme: Reviewer-Agenten der Factory über den Gesamt-Diff (R00208); die Review-Seite ändert sich nicht (ADR-0033).
- Workaround: Schritte einzeln über `?commit=` lesen.
- Heimat: I0245 unter D0009, eigene Interaction statt Bubble an I0203 oder I0215 (Lehre #17/#80, R00213 US-3).
- Proben: `gemeinsam/scratchpad/etst-230/et230_lang.py`, `gemeinsam/scratchpad/entw1-236/p4.py`, beide im Factory-Repo.
- Label-Vorschlag: `bug`, `fehlerpfad`, `braucht:230`, dazu `datenformat` (Antworten und `ETag` der API ändern sich); `sicherheit` nicht (keine neue Grenze, die 20 MB gelten schon für Netto-Läufe mit `datei=`).
