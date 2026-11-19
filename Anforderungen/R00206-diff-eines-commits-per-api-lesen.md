---
id: R00206
status: Neu
datum: 2026-11-19
---

# R00206: Diff eines Commits per API lesen

## Beschreibung

Auftrag des Betreibers (2026-11-19, Karte #207, Nachtrag N1) und Karte #213.

**Umfang (Scheibe A3 des Feinschnitts, baut auf [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md)):** `GET /api/aufgaben/{nr}/diff?commit=<verweis>` liefert, was ein einzelner Commit der Karte geändert hat: je Datei Pfad, Status, Zähler, Merkmale (binär, groß, umbenannt, Modus, nicht UTF-8) und den Patch-Text; `?format=patch` liefert dieselbe Auswahl als Text, `&datei=<pfad>` lädt eine große Datei einzeln nach. Gelesen wird live aus dem Arbeits-Repository des Registers, **nur lesend**, ohne die Sperre des Board-Ordners. **Keine Oberfläche** (B2), kein Gesamt-Diff der Karte (A4), kein Nachfolgervorschlag (A5), kein neues Dateiformat, keine neue Zugriffsgrenze.

Form, Befehlsliste, Grenzen und Härtung stehen in [ADR-0032](../Dokumentation/ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) Punkte 3, 6, 8 und 9, N1.6, N2.3 und N3.1 und werden hier nicht wiederholt, nur in Beispiele übersetzt. Was der ADR offen lässt, entscheidet diese Anforderung mit Empfehlung (Abschnitt „Offene Fragen“): die Gesamtgrenze des Diffs (N3.1 verlangt sie in A3), die Zählweise der Grenzen, die Zahl der Dateien und die Form von `hinweise`.

**Abnahme-Probe der Karte (Feinschnitt A3, wörtlich):** „Diff eines Commits mit Textdatei, Binärdatei und Umbenennung liefert drei Dateien mit richtigen Merkmalen; mit gesetztem `diff.external` im Repository entsteht keine Markerdatei.“ — sie steckt in AK 1 und AK 16.

> **Schutz des Arbeits-Repositorys: Ein Diff führt dort nichts aus und ändert nichts. Weder `diff.external`, `textconv`, `.gitattributes`, Farb- oder Pager-Einstellungen noch Pfadangaben der Anfrage bringen Git dazu, ein Programm zu starten oder etwas anderes als den einen Commit zu lesen (AK 16, AK 17). Fremder Inhalt — Dateinamen mit Steuerzeichen, Bytes, die kein UTF-8 sind, sehr lange Zeilen — kommt nur als Daten in die Antwort (AK 6, AK 18).**

> **Schutz des Nutzers: Größe und Zahl sind begrenzt, und die Grenze gilt schon beim Lesen der Git-Ausgabe, nicht erst beim Kürzen der fertigen Antwort: Der Prozess wird beendet, sobald die Grenze erreicht ist (AK 9, AK 10). Nichts wird still gekürzt — jede Grenze ist ein sichtbares Merkmal oder ein Hinweis (AK 7 bis 11). Lesen hält die Sperre des Board-Ordners nie und schreibt nie (AK 14); ein hängendes Git antwortet spätestens nach 15 s mit 503 (AK 13).**

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110) und Nicht-Ziel „Kein Git-Client“ (Z. 194: im Arbeits-Repository nur lesen).

**Beispiel-Aufruf** (kein `X-KanbanD-Wer` nötig; an #1 steht `kd:<X1>`, der Commit X1 ändert `a.txt`, legt die Binärdatei `bild.bin` an und benennt `c.txt` unverändert in `c2.txt` um):

```
GET /api/aufgaben/1/diff?commit=kd:<X1>
→ 200
{"anwendung": "kd",
 "commits": [{"verweis": "kd:<X1>", "anwendung": "kd", "hash": "<X1>", "titel": "Text, Binär, Umbenennung",
              "autor": "Ada Autorin", "datum": "2026-03-05T09:00:00+00:00", "plus": 1, "minus": 1, "dateien": 3}],
 "dateien": [
   {"alt": "a.txt", "neu": "a.txt", "status": "M", "plus": 1, "minus": 1,
    "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false,
    "patch": "@@ -1,2 +1,2 @@\n eins\n-zwei\n+Zwei\n"},
   {"neu": "bild.bin", "status": "A", "plus": 0, "minus": 0,
    "binaer": true, "gross": false, "nachladen": false, "nicht_utf8": false},
   {"alt": "c.txt", "neu": "c2.txt", "status": "R", "aehnlichkeit": 100, "plus": 0, "minus": 0,
    "binaer": false, "gross": false, "nachladen": false, "nicht_utf8": false}],
 "hinweise": []}
```

### Domänenbezug

Die Begriffe **Anwendung**, **Register**, **Standardanwendung**, **Commit-Verweis**, **Zustand** und **verwaist** wie in R00202 bis R00204; im Glossar fehlen sie weiterhin (offene Frage dort). Neu sind **Hunk** (ein zusammenhängender Änderungsblock mit Kopfzeile `@@ -a,b +c,d @@`), **Patch-Text** (die Hunks einer Datei, ab der ersten `@@`-Zeile) und **nachladen** (eine Datei, deren Patch nicht mitkam, einzeln holen); sie gehören ins Glossar, sobald der `fachspezialist` es pflegt.

## Geschäftlicher Nutzen

Heute kann ein Reviewer-Agent einen Commit der Karte nur beurteilen, wenn er Zugriff auf das Arbeits-Repository hat. Mit dem Diff liest er die Änderung eines einzelnen Commits über die API, mit Dateiliste, Zählern und Hunks, und die Review-Seite (B2) bekommt ihre Daten, ohne selbst Git zu kennen. Weil Größe und Zahl an der Quelle begrenzt sind und kein Programm aus dem Repository läuft, kann weder ein Riesen-Commit noch ein feindliches Repository den Server beschäftigen oder etwas ausführen.

## Funktionale Anforderungen

1. `GET /api/aufgaben/{nr}/diff?commit=<verweis>` antwortet mit `{anwendung, commits, dateien, hinweise}` (Form F2 aus ADR-0032 Punkt 6). Lesen darf jeder (Mensch und Agent), ohne `X-KanbanD-Wer`. `Content-Type: application/json`, `X-Content-Type-Options: nosniff`.
2. **`commit`** nennt einen Verweis der Karte: wörtlich wie in der Datei (`kd:<voller Hash>`) oder mit einem an dieser Karte eindeutigen Hash-Präfix ab 7 Zeichen (wie beim Entfernen in R00202). Die Prüfung der Form, des Kürzels und der Eindeutigkeit läuft **vor** jedem Git-Aufruf; die Anfrage nennt nie einen Pfad zum Repository.
3. **Zulassung nach ADR-0032 N1.6:** Ein Diff gibt es für Commits im Zustand `auf_zweig` und `verwaist`. Weil beide dasselbe lesen, prüft der Diff nur, **dass das Objekt ein Commit ist** (`cat-file --batch-check`), und startet keine Zweigliste (kein `for-each-ref`, kein `rev-list`, kein Cache): Zustand und Zweige des Commits stehen in der Liste von R00204, nicht im Diff. Alle anderen Zustände (`fehlt`, `repository_fehlt`, `anwendung_unbekannt`, `unlesbar`) ergeben 404 `{fehler, zustand}`, bei `repository_fehlt` und `unlesbar` dazu `grund`.
4. **`commits`** trägt für diese Scheibe genau einen Eintrag mit den Feldern des Eintrags der Liste ohne Zustand und Zweige: `verweis` (wörtlich wie in der Datei), `anwendung`, `hash` (voll), `titel` (höchstens 500 Zeichen wie in R00204), `autor` (nur der Name), `datum`, `plus`, `minus`, `dateien` — mit denselben Werten wie die Liste (gerechnet gegen den ersten Elternteil, beim Wurzel-Commit gegen den leeren Baum).
5. **`dateien`** (Reihenfolge wie Git sie liefert, nach dem neuen Pfad, bei gelöschten nach dem alten): je Datei `{alt?, neu?, status, aehnlichkeit?, modus_alt?, modus_neu?, plus, minus, binaer, gross, nachladen, nicht_utf8, patch?}`.
   - `status` ist `A` (neu), `M` (geändert), `D` (gelöscht), `R` (umbenannt, Erkennung mit Git-Standard 50 %, ausdrücklich `-M50%` und `-l1000`, keine Kopie-Erkennung) oder `T` (Typwechsel, etwa Datei zu Symlink). `alt` fehlt bei `A`, `neu` bei `D` (nie `null`). `aehnlichkeit` (ganze Zahl 0–100, die Zahl, die `git diff -M50% --raw` nennt) nur bei `R`.
   - `modus_alt` und `modus_neu` (Text wie `100644`, `100755`, `120000` Symlink, `160000` Submodul) stehen, wenn sich der Modus ändert; bei `A` nur `modus_neu`, bei `D` nur `modus_alt`, bei `M`, `R`, `T` beide und nur wenn sie verschieden sind.
   - `plus` und `minus` zählen Zeilen; eine Binärdatei zählt als Datei, nicht als Zeile (`0`/`0`, wie in R00204 AK 6).
   - `binaer`, `gross`, `nachladen`, `nicht_utf8` sind immer da (Wahrheitswerte).
   - `patch` (Text) steht nur, wenn die Datei Hunks hat und weder `binaer` noch `gross` noch `nachladen` ist: der Patch-Text ab der ersten `@@`-Zeile (Kopfzeilen von Git wie `diff --git`, `index`, `---`, `+++` gehören nicht dazu, ihr Inhalt steht in `alt`, `neu`, `status`, `modus_*`).
6. **Grenzen** (Konstanten im Modul, Startwerte; KB und MB zählen binär: 1 KB = 1.024 Byte): Der Patch einer Datei über **256 KB (262.144 Byte, gezählt wird die Ausgabe von Git ab `@@`)** oder mit mehr als **3.000 Zeilen (`plus + minus`)** ist `gross: true` und ohne `patch`. Der Patch-Lauf liest höchstens **4 MB (4.194.304 Byte)** Ausgabe von Git (mit den Kopfzeilen, auch die Bytes großer Dateien zählen) und wird dann beendet; die Summe der `patch`-Texte einer Antwort bleibt damit darunter. Die Datei, die der Abbruch mitten im Patch trifft, und alle folgenden stehen mit `nachladen: true` ohne `patch` da, die getroffene mit `gross: true`, wenn schon mehr als 256 KB von ihr gelesen waren. Eine Datei, die auf Wunsch einzeln geladen wird, darf bis **20 MB (20.971.520 Byte Ausgabe von Git)** groß sein; darüber bleibt sie `gross: true` ohne `patch` und `hinweise` nennt sie. Mehr als **2.000 Dateien** werden nicht aufgeführt: die ersten 2.000 stehen da und `hinweise` nennt die Zahlen.
7. **`hinweise`** ist eine Liste von Objekten mit `art`: `dateien_gekappt` (`gezeigt`, `gesamt`) und `zu_gross_zum_anzeigen` (`datei`, wie `neu`, bei gelöschten wie `alt`). Ohne Anlass `[]`. A4 ergänzt weitere Arten.
8. **`&datei=<pfad>`** liefert dieselbe Antwortform mit genau dieser einen Datei in `dateien` und ihrem Patch bis zur Grenze für einzeln geladene Dateien. `<pfad>` ist `neu`, bei gelöschten `alt`, buchstäblich (kein Muster). Ein Pfad, der in der Dateiliste des Commits nicht steht, ergibt 404 `{fehler}`; **nur Pfade aus der Dateiliste erreichen Git**, und zwar als wörtliche Pfadangabe.
9. **`&format=patch`** liefert dieselbe Auswahl als Text: `Content-Type: text/x-diff; charset=utf-8`, `nosniff`; je Datei der Patch von Git mit seinen Kopfzeilen; für Dateien ohne `patch` (binär: die eigene Zeile von Git „Binary files … differ“; `gross` und `nachladen`: Kopfzeile von Git plus die Zeile `# kanbanD: Patch fehlt (gross)` bzw. `(nachladen), laden mit &datei=<neu>`); nicht UTF-8 ersatzweise dekodiert. Andere Werte von `format` sind 400. Der Text eignet sich zum Lesen, nicht für `git apply`.
10. **Nicht-UTF-8** (Pfad oder Inhalt) wird ersatzweise dekodiert (Ersatzzeichen U+FFFD) und die Datei trägt `nicht_utf8: true`; nie 500. Passen mehrere Dateien auf einen ersatzweise dekodierten Pfad, liefert `datei=` alle.
11. **Fehler und Statuscodes:** unbekannte Aufgabe 404 `{fehler}`; defekte Datei 423 wie `GET /api/aufgaben/{nr}`; `commit` fehlt 400 `{fehler}` (bis A4 den Gesamt-Diff liefert, der hier steht); Form falsch oder mehrdeutiger Präfix an der Karte 400 `{fehler, verweis}`; Verweis nicht an der Karte 404 `{fehler, verweis}` (ohne `zustand`); Zustand nach Punkt 3 404; Zeitgrenze 503 `{fehler}`.
12. **ETag** nach ADR-0032 Punkt 9 für Verweise mit vollem Hash an der Karte: ein Diff zu einem vollen Hash ändert sich nie. `ETag` aus Verweis, `datei`, `format` und der Version der Grenzen; `If-None-Match` mit demselben Wert ergibt 304 ohne Rumpf und **ohne Git-Aufruf**, nach den Prüfungen, die ohne Git gehen (Aufgabe, Verweis an der Karte, Form, Kürzel im Register). 304 gibt es nur zu einer früheren Antwort 200.
13. Die Route steht in Endpunktliste, OpenAPI-Beschreibung und README „Für Agenten“.

## Nicht-funktionale Anforderungen

- **Lastprofil:** `GET /api/aufgaben/{nr}`, `GET /api/aufgaben` und `/api/zustand` starten weiter kein Git; der Diff läuft auf Klick, nicht im Lastprofil. Ziel nach ADR-0032 Punkt 9: ein Commit bis 1 MB Patch kalt p95 < 500 ms (Herleitung: Ziel des ADR, **für diese Route nicht gemessen — Hypothese**; ein Aufruf braucht etwa fünf kurze Git-Prozesse, in R00204 kosteten `cat-file` und `log` für 30 Verweise zusammen 0,02 s).
- **Zeitgrenze:** je Git-Prozess höchstens 10 s, gekürzt auf `min(10 s, Rest der Gesamtgrenze)`; zusätzlich für den **ganzen Aufruf** 10 s ab Eingang der Anfrage (Wurzel, Prüfung, Dateiliste, Patch), danach werden alle laufenden Git-Prozesse samt ihren Kindern beendet, es werden keine weiteren gestartet, die Antwort ist 503. Antwort spätestens nach 15 s. Keine Teilantwort. (Festlegung nach ADR-0032 N3.1: „in A3 festzulegen“; Empfehlung des planers, gleich wie bei der Liste, siehe Offene Fragen.)
- **Ausgabe mit Abbruch:** Git-Ausgaben werden mit einer Obergrenze gelesen; wird sie erreicht, endet der Prozess samt Gruppe, und es wird nicht weitergelesen. Obergrenzen: Dateiliste bis 2.001 Dateien; Patch-Lauf 4 MB (4.194.304 Byte); einzeln geladene Datei 20 MB plus ein Byte.
- **Sperre:** Lesen nimmt die Sperre des Board-Ordners nie.
- **Nur lesend:** `kommando()` bleibt der eine Startort; neue Befehle `diff`, `diff-tree` stehen in der Liste von ADR-0032 Punkt 3 und erzeugen Diffs (`erzeugt_diffs`).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API; erweitert die von R00204):

- **Arbeits-Repository R** und **Board-Ordner** wie in R00204 (K1–K4, W1, V1, R1, V2, Anwendung `kd`, Karte #1 mit `kd:<K3>`, `kd:<W1>`, `kd:<V1>`, `kd:<V2>`, `kd:<R1>`); dazu auf `main` nach K4 der Commit **X1** „Text, Binär, Umbenennung“ (`2026-03-05T09:00:00+00:00`, Autor „Ada Autorin“): ändert `a.txt` (Zeile 2 „zwei“ wird „Zwei“), legt `bild.bin` an (Bytes `00 01 02 03`) und benennt `c.txt` unverändert in `c2.txt` um. #1 trägt zusätzlich `kd:<X1>`.
- **G1** (auf `main`): legt `gross.txt` (3.001 Zeilen zu je 50 `x`) und `klein.txt` (eine Zeile) an; auch an #1 hinterlegt.
- Weitere Commits stellt das Kriterium selbst her (ein Satz „Gegeben ein Commit …“); sie liegen auf `main` und sind an #1 hinterlegt.
- Schreibweise wie R00202 und R00204; „Marke“ ist eine Datei, die ein Skript des Tests anlegt, wenn es läuft; „Git-Spur“ die Datei, die der Server mit `GIT_TRACE=<datei>` schreibt; „Git-Skript“ ein Programm `git` vorn im `PATH` des Servers.

### Inhalt und Zulassung

- [ ] **AK 1 Text, Binär, Umbenennung (Abnahme-Probe der Karte):** `GET /api/aufgaben/1/diff?commit=kd:<X1>` ergibt 200 und genau drei Dateien in dieser Reihenfolge:
  - `a.txt`: `status M`, `plus 1`, `minus 1`, `alt` und `neu` beide `a.txt`, `patch` `"@@ -1,2 +1,2 @@\n eins\n-zwei\n+Zwei\n"`, alle vier Wahrheitswerte `false`;
  - `bild.bin`: `status A`, kein `alt`, `plus 0`, `minus 0`, `binaer true`, kein `patch`;
  - `c2.txt`: `status R`, `alt "c.txt"`, `aehnlichkeit 100`, `plus 0`, `minus 0`, kein `patch`.
  `commits` hat einen Eintrag, dessen `verweis`, `hash`, `titel`, `autor`, `datum`, `plus 1`, `minus 1` und `dateien 3` denen von `GET …/commits` zu `kd:<X1>` gleichen; `hinweise` ist `[]`. Der Aufruf ändert weder die Commit-Zahl des Board-Ordners noch die Datei von #1; die Git-Spur enthält weder `--contains` noch `for-each-ref` noch `rev-list`.
- [ ] **AK 2 Zulassung und Zustände:** Mit `commit=kd:<K3>` (auf `main`), `kd:<W1>` (nur auf `karte/1`) und `kd:<V1>` (verwaist) ergibt der Aufruf 200 mit der Datei des Commits (`c.txt`, `b.txt`, `v.txt`, je `status A`). `kd:<V2>` (gelöscht) ergibt 404 mit `zustand "fehlt"`. Stehen an #1 von Hand ein Verweis auf eine nicht registrierte Anwendung, einer auf einen Ordner, der kein Repository ist, und ein Kurz-Hash, der zu zwei Objekten passt, sind die Antworten 404 mit `zustand` `anwendung_unbekannt`, `repository_fehlt` (mit `grund`) und `unlesbar` (mit `grund`). `GET /api/aufgaben/999/diff?commit=kd:<K3>` → 404 `{fehler}` ohne `zustand`; eine Aufgabe mit defekter Datei → 423.
- [ ] **AK 3 Der Parameter `commit`:** Ohne `commit` → 400 `{fehler}`. `kd:<X1:7>` (7 Zeichen, eindeutig an der Karte) → 200, `verweis` im Eintrag lautet wörtlich wie in der Datei (`kd:<X1>`); `kd:<X1>` in Großbuchstaben ebenso; `kd:3f2a9c` (6 Zeichen), `kd:main`, `kd:--output=x`, `kd:<K1>^{tree}` → 400 `{fehler, verweis}`; ein Präfix, der zu zwei Verweisen der Karte passt → 400 `{fehler, verweis}`; `kd:<K1>` ist ein Commit, aber nicht an #1 hinterlegt → 404 `{fehler, verweis}` ohne `zustand`. `format=xyz` → 400. Bei jeder dieser Abweisungen ist die Git-Spur leer.
- [ ] **AK 4 Was verglichen wird:**
  - Gegeben ein Commit Z1, der `a.txt` ändert (3 Zeilen hinzu, 1 weg), `b.txt` mit 2 Zeilen anlegt und die Binärdatei `x.bin` ändert: `dateien` hat drei Einträge, `plus` 3 + 2 + 0 = 5 und `minus` 1 + 0 + 0 = 1, die Summen gleichen `plus 5`, `minus 1`, `dateien 3` in `commits`.
  - Ein Merge-Commit (`--no-ff`), der vom Seitenzweig `d.txt` mit 4 Zeilen auf `main` bringt: ein Eintrag `d.txt`, `status A`, `plus 4` — gegen den ersten Elternteil.
  - Der Wurzel-Commit K1 (2 Zeilen `a.txt`): ein Eintrag `status A`, `plus 2`, gegen den leeren Baum.
  - Ein leerer Commit (`--allow-empty`): 200, `dateien []`, `commits[0].dateien 0`, `hinweise []`.

### Merkmale und Ränder

- [ ] **AK 5 Merkmale je Datei:** Ein Commit mit allen folgenden Änderungen liefert je Datei diese Merkmale (jeweils ohne `patch`, wo „kein Patch“ steht):
  - gelöscht: `status D`, kein `neu`, `patch` mit nur `-`-Zeilen;
  - umbenannt **und** geändert (8 Zeilen, eine geändert): `status R`, `alt`, `neu`, `aehnlichkeit` gleich der Zahl in `git diff -M50% --raw`, `plus 1`, `minus 1`, `patch` da;
  - Modus 100644 → 100755 ohne Inhaltsänderung: `status M`, `modus_alt "100644"`, `modus_neu "100755"`, `plus 0`, `minus 0`, kein `patch`;
  - Datei wird zum Symlink: `status T`, `modus_alt "100644"`, `modus_neu "120000"`, der Patch zeigt das Ziel des Symlinks als Text, es wird nichts vom Dateisystem gelesen;
  - neuer Symlink: `status A`, `modus_neu "120000"`;
  - Submodul hinzugefügt oder verschoben (`160000`): `modus_neu "160000"` und ein Patch aus den zwei Zeilen `Subproject commit …`; die Antwort bleibt gleich, wenn im Repository `diff.submodule=log` gesetzt ist; das Submodul wird nie betreten;
  - leere Datei neu: `status A`, `plus 0`, `minus 0`, kein `patch`, `binaer false`;
  - Datei ohne Zeilenumbruch am Ende: die Zeile `\ No newline at end of file` steht im `patch`;
  - Datei mit NUL-Byte: `binaer true`, `plus 0`, `minus 0`, kein `patch`.
- [ ] **AK 6 Pfade und Zeichen:** Ein Commit legt Dateien an mit den Namen `ä ö.txt` (Umlaute), `mit Leerzeichen.txt`, `-x.txt` (beginnt mit Bindestrich), `a"b.txt`, `a\b.txt`, `t<TAB>b.txt`, `n<LF>diff --git a/y b/y.txt` (Zeilenumbruch und eine Zeile, die wie eine Git-Kopfzeile aussieht), `esc<ESC>.txt`, `<script>alert(1)</script>.txt` und `bidi<U+202E>.txt`. Dann stehen alle als `neu` zeichengleich als JSON-Text in der Antwort, jede Datei trägt den eigenen `patch`, und kein Eintrag verschiebt den Patch einer anderen Datei (ein Vergleich der Patches mit `git diff-tree -p` je Datei im Test). Zwei Dateien mit den Namen `a<0xE4>.txt` und `a<0xF6>.txt` (Latin-1-Bytes, kein UTF-8) stehen mit Ersatzzeichen im Namen und `nicht_utf8 true`; `datei=a�.txt` liefert beide (nie eine falsche allein).
- [ ] **AK 7 Grenze je Datei:** Eine neue Datei mit einer einzigen Zeile aus 262.128 `a` hat einen Patch-Text von 14 (`@@ -0,0 +1 @@\n`) + 1 (`+`) + 262.128 + 1 (`\n`) = **262.144 Byte**: `gross false`, `patch` da. Mit 262.129 `a` (262.145 Byte): `gross true`, kein `patch`, `plus 1`. Eine Datei mit einer Zeile aus 300.000 `a` ist `gross true`, obwohl sie nur eine Zeile hat. Eine neue Datei mit 3.000 Zeilen `x`: `patch` da; mit 3.001: `gross true`, `plus 3001`, kein `patch`. Eine umbenannte und geänderte große Datei bleibt `status R` mit `alt` und `aehnlichkeit`.
- [ ] **AK 8 Summe der Antwort:** Gegeben ein Commit mit 25 neuen Dateien, jede mit 2.000 Zeilen aus 99 `a` (Patch-Text je Datei 19 + 2.000 · 101 = 202.019 Byte, also weder `gross` noch über 4 MB einzeln). Dann haben die ersten 20 Dateien einen `patch` (20 · 202.019 = 4.040.380 Byte, mit den Kopfzeilen von Git, je rund 130 Byte, noch unter 4.194.304), und die Dateien 21 bis 25 stehen mit `nachladen true` und ohne `patch` da (21 · 202.019 = 4.242.399 Byte überschreiten 4.194.304). Die Dateiliste ist vollständig (25 Einträge, richtige `plus`/`minus`). Jede der fünf lässt sich mit `datei=` einzeln laden: 200, eine Datei, `patch` 202.019 Byte, `nachladen false`.
- [ ] **AK 9 Die Ausgabe wird mit Abbruch gelesen:** Gegeben ein Commit mit der Datei `riesig.txt` (3 Zeilen) und ein Git-Skript, das alle Aufrufe ans echte Git weitergibt, **außer** dem Lauf, der den Patch-Text liefert (Argumente ohne `--raw` und `--numstat`): der schreibt die Kopfzeilen für `riesig.txt` und danach **endlos** Zeilen `+aaaa…` und schreibt die Zahl der geschriebenen Bytes in eine Datei fort. Dann antwortet der Aufruf nach spätestens 15 s mit 200, die Datei ist `gross true` ohne `patch`, die Prozessgruppe des Skripts lebt nicht mehr, und die gezählten Bytes sind **höchstens 5 MB** (Grenze von 4 MB plus Puffer; ein Lesen bis zum Ende wäre unbegrenzt). Dasselbe mit `datei=riesig.txt` gegen die 20-MB-Grenze: 200, `gross true`, `hinweise [{art "zu_gross_zum_anzeigen", datei …}]`, gezählt höchstens 21 MB, Prozess tot. Im Test des Moduls: die Ausgabe von genau 20.971.520 Byte wird geliefert, die von 20.971.521 Byte bricht ab.
- [ ] **AK 10 Zahl der Dateien:** Ein Commit mit 2.000 neuen Dateien (je eine Zeile) liefert 2.000 Einträge und `hinweise []`. Mit 2.001 Dateien: 2.000 Einträge (die ersten in der Reihenfolge von Git), `commits[0].dateien 2001` und `hinweise [{art "dateien_gekappt", gezeigt 2000, gesamt 2001}]`. Zeilengrenze **vor** dem Patch-Lauf: `GET …/diff?commit=kd:<G1>` ergibt `gross.txt` mit `gross true`, `plus 3001`, ohne `patch`, und `klein.txt` mit `patch`; zählt ein Git-Skript, das alles ans echte Git weitergibt, die Ausgabebytes aller Läufe dieses Aufrufs, ist die Summe kleiner als die Hälfte des Patches von `gross.txt` (3.001 · 52 = 156.052 Byte), der Patch der großen Datei wurde also nie erzeugt.
- [ ] **AK 11 Nachladen einer Datei:** Gegeben G1: `datei=gross.txt` ergibt 200 mit genau einem Eintrag, `gross false`, `patch` da (nach der Grenze für einzeln geladene Dateien), `plus 3001`. Die gelöschte Datei wird über `alt` geladen. Gegeben die Dateien `a*b.txt` und `axb.txt` im Commit: `datei=a*b.txt` liefert nur `a*b.txt`. Bei einem Commit mit 2.001 Dateien ist auch eine Datei jenseits der ersten 2.000 per `datei=` ladbar. `datei=*`, `datei=:(top)a.txt`, `datei=../a.txt` und `datei=-x` ergeben 404 (nicht in der Dateiliste), `datei=a.txt%00` und ein Pfad mit 5.000 Zeichen 400; in keinem Fall zeigt die Git-Spur einen Lauf mit diesem Text als Pfadangabe.
- [ ] **AK 12 `?format=patch` und ETag:**
  - `GET …/diff?commit=kd:<X1>&format=patch` ergibt 200, `Content-Type: text/x-diff; charset=utf-8`, `X-Content-Type-Options: nosniff`; der Text hat für `a.txt` Git-Kopfzeilen und denselben Patch wie das JSON, für `bild.bin` die Zeile „Binary files … differ“, für `c2.txt` den Kopf der Umbenennung. Zu G1 stehen für `gross.txt` die Kopfzeile von Git und `# kanbanD: Patch fehlt (gross)`; zum Commit aus AK 8 für jede der Dateien 21 bis 25 die Kopfzeile und `# kanbanD: Patch fehlt (nachladen), laden mit &datei=<neu>` — nie still leer. Mit `datei=` nur diese Datei. Latin-1-Inhalt erscheint mit Ersatzzeichen, die Antwort ist gültiges UTF-8.
  - Jede Antwort 200 trägt einen `ETag`; der Aufruf mit `If-None-Match` desselben Werts ergibt 304 ohne Rumpf und mit **leerer Git-Spur**; derselbe Wert mit anderem `datei` oder `format` ergibt 200. Für einen Verweis, der nicht (mehr) an der Karte steht, ergibt der Aufruf mit `If-None-Match` 404 (kein 304).

### Zeitgrenze, Sperre, Last

- [ ] **AK 13 Zeitgrenze und 503:** Gegeben ein Git-Skript schläft 60 s und startet ein Kind (`sleep 300`). Dann antwortet der Aufruf nach mindestens 10 s und spätestens 15 s mit 503 und `{fehler}`; danach lebt weder das Skript noch sein Kind (`pgrep` auf das Kennzeichen, vom Test aus), es sind keine weiteren Git-Prozesse mehr gestartet worden, und es gibt keine Teilantwort (nie eine Dateiliste ohne Patch). **Zweiter Fall:** ein Git-Skript, das jeden Aufruf 4 s hält: Wurzel 4 s, `cat-file` 4 s, der nächste Prozess ist auf den Rest von 2 s gekürzt — die Antwort 503 kommt nach spätestens 15 s, kein Prozess läuft über das Ende der Gesamtgrenze hinaus. Nach Entfernen des Skripts ergibt derselbe Aufruf 200 mit der Antwort von AK 1.
- [ ] **AK 14 Lesen ohne Sperre und nur lesend:** Während ein Git-Skript, das vor jeder Antwort 5 s schläft, einen `GET …/diff` hält, ergibt `PATCH /api/aufgaben/1` (Titeländerung) 200 in unter 1 s; danach antwortet auch das `GET` mit dem Diff. Im Test des Moduls hält ein Schreiber die Sperre des Board-Ordners; der Diff antwortet, ohne auf ihn zu warten. Nach AK 1, 2, 4, 8, 11 und 12 ist die Commit-Zahl des Board-Ordners gleich und die Datei von #1 byte-gleich; in R ist `git status --porcelain` leer, keine Datei unter `R/.git` ist neuer als der Zeitpunkt vor dem Aufruf, und es gibt keine `index.lock`.
- [ ] **AK 15 Lastprobe (Hypothese, wird gemessen):** Gegeben ein Wegwerf-Repository mit rund 20.000 Commits (Erzeuger aus `tests/gemeinsam`, B0998) und ein Commit mit 10 Dateien zu je rund 100 KB Patch (zusammen rund 1 MB): 20 kalte Läufe (vor jedem Lauf ein Zweig bewegt), gemessen am Client von der Anfrage bis zum letzten Byte, im 95. Perzentil (dem 19. von 20 sortierten Werten) unter 500 ms, bei Rechnerlast unter 2; dasselbe für `datei=` auf eine Datei von 1 MB. Die Schwelle ändert niemand; wird sie verfehlt, meldet der entwickler `anforderung_falsch` mit den Messwerten. Die Werte stehen in der Commit-Nachricht.

### Sicherheit

- [ ] **AK 16 Härtung (ADR-0032 N2.3, Lehre aus #207 und #211):**
  - **(a) Konfiguration, Attribute, Umgebung:** In `R/.git/config` stehen `diff.external`, `diff.x.command`, `diff.x.textconv` (mit `.gitattributes` `* diff=x`), `core.pager`, `pager.diff`, `color.ui=always`, `color.diff=always`, `core.fsmonitor` und `core.hooksPath`, jedes auf ein Skript, das eine Marke anlegt; der Server läuft zusätzlich mit `GIT_EXTERNAL_DIFF`, `GIT_PAGER`, `PAGER` und `GIT_CONFIG_COUNT=1`, `GIT_CONFIG_KEY_0=diff.external`, `GIT_CONFIG_VALUE_0=<Skript>`. Dann ergibt `GET …/diff?commit=kd:<X1>` die Antwort von AK 1 **bytegleich** zu der im sauberen Repository, und **keine** Marke entsteht. **Gegenprobe:** derselbe Test legt mit `git diff` direkt in R (ohne die Schalter) die Marken von `diff.external` und `textconv` an — die Probe kann also rot werden.
  - **(b) Antwort hängt nicht von der Konfiguration ab:** Mit `diff.noprefix=true`, `diff.mnemonicPrefix=true`, `diff.renames=false`, `diff.renameLimit=1000000`, `diff.context=0`, `diff.algorithm=patience`, `diff.submodule=log`, `diff.ignoreSubmodules=all`, `diff.orderFile=<Datei>`, `core.quotepath=true` und `diff.wsErrorHighlight=all` im Repository ist die Antwort auf AK 1 und AK 5 bytegleich zu der im sauberen Repository (alle Schalter, die Form und Inhalt bestimmen, nennt das Modul selbst: Präfixe, Zeilen Kontext, Algorithmus, Erkennung der Umbenennungen mit `-M50% -l1000`, Submodule, Reihenfolge).
  - **(c) Schalter aus dem Befehl:** Im Test des Moduls trägt die Befehlszeile jedes Befehls, der Diffs erzeugen kann (`log`, `diff`, `diff-tree`), die Schalter `--no-ext-diff --no-textconv --no-color` und vor dem Befehl `-c core.quotepath=off`, soweit der Befehl sie kennt, ohne dass der Aufrufer sie nennt; der Aufrufer hat keinen Weg, sie wegzulassen oder `--ext-diff` oder `--textconv` zu nennen; die Befehle `diff` und `diff-tree` haben je einen Eintrag in `erzeugt_diffs` (ein neuer Befehl ohne Zuordnung bricht den Bau).
  - **(d) Die Mutanten „`--no-ext-diff` weg“ und „`--no-textconv` weg“ werden getötet:** Der entwickler entfernt jeden Schalter einzeln aus der Befehlszeile des Befehls, der den Patch erzeugt, lässt die Tests laufen, und mindestens ein Test wird rot; die Commit-Nachricht nennt je Mutant den roten Test. Überlebt ein Mutant, weil der gewählte Befehl den Schalter nicht braucht (A2: `log`), ist der Test der Befehlszeile (c) der Beleg, und die Commit-Nachricht sagt es.
  - **(e) Nur drei Orte:** Der Fitness-Test von R00204 (`Command::new("git")` nur in `src/git.rs`, `src/start/ordner.rs`, `src/git/arbeitsrepo.rs`) bleibt grün.
- [ ] **AK 17 Injection über die Anfrage:** Für `commit=` und `datei=` ergeben `kd:--output=x`, `kd:../x`, `kd:3f2a9c1;rm -rf x`, `kd:$(touch x)`, `kd:<X1>^{tree}`, `kd:<X1> ` (mit Leerzeichen), `kd:<X1>%0a<K1>`, `kd:<X1>%00` sowie `datei=--output=x`, `datei=$(touch x)`, `datei=a.txt;touch x`, `datei=:(glob)**` je 400 oder 404 mit `fehler`; danach liegt weder in R noch im Board-Ordner eine Datei `x`, `git status --porcelain` in R ist unverändert, die Git-Spur enthält keinen dieser Texte, und der Zähler der Git-Aufrufe für die Prüfung der Form steht auf 0.
- [ ] **AK 18 Feindlicher Inhalt:** Ein Commit mit dem Titel `<script>alert(1)</script> "x" \ y`, dem Autor `Mallory <img src=x>` und einer Datei, deren Inhalt `</script><img src=x onerror=alert(1)>`, `ESC[31m`, Tabulatoren, `\r\n`-Zeilenenden, U+2028, U+0085 und eine Zeile von 100.000 Zeichen (unter der Grenze) enthält: `titel`, `autor` und `patch` stehen zeichengleich als JSON-Text in der Antwort (`Content-Type: application/json`, `nosniff`); der Autor ohne E-Mail; `\r` bleibt im `patch` erhalten; die Antwort ist gültiges JSON und gültiges UTF-8. Ein Commit mit Nachricht und Datei in `latin1` ergibt 200, Ersatzzeichen und `nicht_utf8 true`, nie 500.

### Bestand und Beschreibung

- [ ] **AK 19 Legacy und Beschreibung:**
  - (a) `GET …/diff` schreibt nie: die Datei von #1 bleibt byte-gleich (auch die Zeilenform), und die Commit-Zahl des Board-Ordners bleibt gleich. `GET /api/aufgaben/1`, `GET /api/aufgaben` und `GET /api/zustand` liefern zeichengleich zu dem Stand vor dieser Karte (R00204) und mit leerer Git-Spur.
  - (b) Der Stand vor dieser Karte (`main` mit R00204 ohne R00206, gebaut) antwortet auf `GET /api/aufgaben/1/diff?commit=kd:<X1>` nicht mit 200 (Statuscode im Test festgehalten, kein Kriterium); die Dateien, die diese Karte liest, sind dieselben wie vorher (kein neues Dateiformat).
  - (c) Die Endpunktliste unter `/api` und die OpenAPI-Beschreibung nennen `GET /api/aufgaben/{nr}/diff` mit den Parametern `commit`, `datei`, `format`, den Feldern, den Grenzen (256 KB, 3.000 Zeilen, 4 MB, 20 MB, 2.000 Dateien), den Statuscodes 200, 304, 400, 404, 423 und 503, dem `ETag` und den Arten von `hinweise`; die README „Für Agenten“ hat einen Abschnitt „Diff eines Commits lesen“ mit dem Beispiel-Aufruf und sagt, dass `nachladen` und `gross` ein Merkmal sind (kein Fehler) und wie man sie einzeln holt. Die Vertragstests, die die Routen zählen, werden um genau diese Route erweitert (keine geänderte Erwartung sonst).

## Betroffene Verzeichnisstruktur

- `src/git/arbeitsrepo.rs` — Befehle `Diff` und `DiffTree` mit Schaltern je Befehl aus `Befehl`; `Lauf` mit Bytegrenze und gelieferter Teilausgabe (`abgeschnitten`); Dateiliste und Patch lesen und zerlegen; wörtliche Pfadangabe
- `src/modell/commit_diff.rs` (neu) — Antwortform F2, Datei, Merkmale, Hinweise
- `src/dienst/commits.rs` oder `src/dienst/diff.rs` (neu) — `diff_lesen` neben `commits_lesen`; Zulassung, Grenzen, ETag
- `src/web/mod.rs`, `src/web/endpunkte.rs`, `src/web/openapi.rs`, `README.md` — Route und Beschreibung
- Tests: neu `tests/akzeptanz_r00206.rs`; erweitert `tests/arbeitsrepo.rs`, `tests/arbeitsrepo_spur.rs`, `tests/gemeinsam/mod.rs` (Erzeuger für X1, Merge, Symlink, Submodul, Latin-1, 2.001 Dateien, `git`-Skripte mit Endlosausgabe und Zähler), Fitness-Test von R00204 bleibt

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1010 Startort für Diffs:** `Befehl::Diff` und `Befehl::DiffTree`, Schalter je Befehl (nur die, die der Befehl kennt), `Lauf` mit Bytegrenze und Teilausgabe, Prozessgruppe wie bei A2; Marken-Probe, Gleichheits-Probe und Mutanten (AK 16 a–d) zuerst.
2. **B1011 Dateiliste:** `diff --raw --numstat -z` (oder getrennte Läufe) → Dateien mit Status, Modus, Binär, Umbenennung, Zähler; Kappe bei 2.000; Pfade ohne Zitierung; nicht UTF-8 (AK 4–6, 10).
3. **B1012 Patch und Grenzen:** Zeilengrenze aus den Zählern, Patch-Lauf nur für die kleinen Dateien, Zuordnung in der Reihenfolge der Liste, Grenzen für Bytes, Summe und nachladen, `datei=` mit Prüfung gegen die Liste und wörtlicher Pfadangabe (AK 7–9, 11).
4. **B1013 Dienst, Route, Beschreibung:** Zulassung, 404/400, Gesamtgrenze, `format=patch`, ETag, Endpunktliste, OpenAPI, README (AK 2, 3, 12, 13, 14, 16, 18).
5. **B1014 Probe im echten Programm, Lastprobe, Gate, Anforderung abschließen.**

### Hinweise

- **Aus A2 wiederverwendet:** `arbeitsrepo::wurzel_bis`, `objekte_pruefen`, `metadaten`, `Lauf`, `git`, `grenze_bis`, `gruppe_beenden`, der Zähler, `Verweisform`, `verweis_lesen`, `repo_fehler`, die Testhelfer in `tests/gemeinsam` und der Erzeuger des 20.000er-Repositorys aus B0998.
- **Gemessen am 2026-11-19 (Git 2.48, Wegwerf-Repository in der Ablage des planers):** `git diff` (Porcelain) startet `diff.external` und `textconv` aus der Konfiguration und der `.gitattributes` des Repositorys (Marke entstand); das Plumbing `git diff-tree -p` startet sie **ohne** die Schalter **nicht** (keine Marke). Nimmt der entwickler `diff-tree`, kann die Marken-Probe den Mutanten „`--no-ext-diff` weg“ nicht töten — das tut dann nur der Test der Befehlszeile (AK 16 c); die Marken-Probe bleibt als Schutz gegen einen späteren Wechsel auf `diff` und wegen der Gegenprobe. Zweitens: `git diff --no-show-signature` bricht mit Ausstiegscode 128 ab, `git diff-tree --no-show-signature` läuft — `NACH_DIFF` in `arbeitsrepo.rs` führt `--no-show-signature` heute für jeden Befehl, der Diffs erzeugt; für `Diff` darf es nicht stehen (der Schalter gilt dem Befehl, der Signaturen kennt: `log`).
- **Reihenfolge, die die Grenzen vor den teuren Schritt legt:** (1) Prüfung ohne Git (Form, Register, Eindeutigkeit, ETag); (2) Wurzel und `cat-file --batch-check` (Typ `commit`); (3) Metadaten wie bei der Liste; (4) Dateiliste mit Abbruch bei 2.001 Dateien; (5) Zeilengrenze aus den Zählern entscheidet, welche Dateien einen Patch-Lauf bekommen; (6) ein Patch-Lauf mit Pfadliste (wörtlich) und Bytegrenze 4 MB plus eine Datei; (7) Zuordnung. Alle Schritte laufen unter der einen Gesamtgrenze.
- **Umbenennung und Pfadangabe:** begrenzt man einen Lauf auf `neu`, erkennt Git die Umbenennung nicht mehr (die Datei erscheint als `A`). Für eine umbenannte Datei beide Pfade nennen (`alt` und `neu`), sonst bleibt `status R` nicht erhalten (AK 7, 11). Wörtliche Pfadangabe über `--literal-pathspecs` (oder `GIT_LITERAL_PATHSPECS=1`), nach `--`; ein Ausschluss mit `:(exclude)` geht damit nicht.
- **Patch-Text ab `@@`:** die Kopfzeilen (`diff --git`, `index`, `---`, `+++`, `old mode` …) werden aus der Dateiliste gebildet; der Patch-Text ist der Rest. Eine Dateizuordnung über die Reihenfolge der Dateiliste, nicht über das Zerlegen der Namen in den Kopfzeilen (ADR-0032 Punkt 6); Git zitiert Namen mit Zeilenumbruch, Tabulator, Anführungszeichen und Backslash auch bei `core.quotepath=off`.
- **Bytegrenze:** `Lauf` kennt heute nur `hoechstzeilen` und liefert bei Überschreitung keine Ausgabe (`ZuvielAusgabe`). Der Diff braucht „bis zur Grenze lesen, Prozess samt Gruppe beenden, das Gelesene mit dem Merkmal `abgeschnitten` liefern“. Die Regel „ein abgebrochener Prozess liefert nie eine Teilausgabe“ bleibt für Zeitüberschreitungen; sie gilt nicht für die Bytegrenze des Diffs (ADR-0032 N3.2 betrifft die Liste, nicht den Diff).
- **Reihenfolge von `git diff --raw` bei Umbenennungen:** nach dem neuen Pfad; die Beispiele in AK 1 sind so gewählt, dass auch die Reihenfolge nach dem alten Pfad dasselbe ergäbe.
- **Zähler der Git-Aufrufe:** wie bei A2 über Threads hinweg.
- Tests zuerst: AK 1 mit X1, AK 16 a und c mit den Marken und der Gegenprobe, AK 9 mit dem Endlos-Skript (heute rot: es gibt keinen Diff).
- Mutationsproben: `--no-ext-diff` weggelassen; `--no-textconv` weggelassen; `-M50%` oder `-l1000` weggelassen (Antwort hängt von `diff.renameLimit` ab); `--literal-pathspecs` weggelassen (`datei=*` trifft mehrere); Pfad nicht gegen die Dateiliste geprüft; Grenze für Bytes nur nach dem Lesen der ganzen Ausgabe; Prozess bei der Grenze nicht beendet; nur Kind statt Gruppe beendet; Gesamtgrenze entfernt; Prozessgrenze nicht auf den Rest gekürzt; Zeilengrenze mit `>=` statt `>`; 256 KB mit 256.000 Byte; Abbruch bei 4 MB ohne `nachladen` für die folgenden Dateien; Zählung der Kappe um eins verschoben; Patch einer Datei der falschen Datei zugeordnet (Name mit Zeilenumbruch); `\r` entfernt; E-Mail im Autor; Sperre des Board-Ordners beim Lesen genommen; ETag ohne `datei` oder `format`; 304 ohne die Prüfung des Verweises; Zweigliste im Diff gestartet.

## Tests

- API-Tests gegen ein Wegwerf-Repository (X1, Merge, Symlink, Submodul, Latin-1, 25 Dateien, 2.001 Dateien) mit `git`-Skripten im `PATH` (AK 9, 10, 13, 14) und mit Marken und feindlicher Konfiguration (AK 16).
- Modultests für die Befehlszeile je Befehl, `Lauf` mit Bytegrenze, Zerlegen der Dateiliste, wörtliche Pfadangabe, Gleichheit von `datei=` mit dem Patch der Liste.
- Lastprobe als eigener Test, der nicht in jedem Lauf der Suite läuft; ihr Ergebnis steht im Commit (AK 15).
- Legacy-Probe gegen den gebauten Stand vor der Karte (AK 19 b).
- **Keine geänderte Erwartung** an bestehenden Tests außer der Befehlsliste (zwei neue Befehle) und der Zählung der Routen (eine mehr).

## Abhängigkeiten

- **Abhängig von:** [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md) (I0194, Karte #211, in den Reviews) — nicht nur A1: der Diff nutzt die Zustände, die Schalter aus dem Befehl, die Prozessgruppe, `metadaten` und den Zähler aus A2. Das Label der Karte #213 `braucht:207` nennt nur A1; richtig wäre `braucht:211`. [R00202](R00202-commit-verweise-an-der-karte-hinterlegen-und-entfernen.md) (Verweise) liegt auf `main`.
- **Berührt, ohne abzuhängen:** A1b #219 (R00203) und B1 #212 (R00205, I0195, B1004–B1009) ändern andere Dateien; in der WBS und in `src/web/mod.rs` sind Konflikte möglich (IDs getrennt vergeben: hier R00206, I0196, B1010–B1014).
- **Blockiert:** A4 #214 (Gesamt-Diff, nutzt Befehle, Grenzen und Form; ersetzt AK 3 „ohne `commit` 400“ und ergänzt Arten von `hinweise`), B2 #209 (Review-Seite, liest diese Antwort), B4 #216 (Hervorhebung, über B2).

## Offene Fragen

**Technikfragen (architekt, über den Director).** Der planer hat sie mit seiner Empfehlung beantwortet und in die Kriterien gesetzt; der architekt bestätigt oder ändert per Nachtrag:

1. **Gesamtgrenze des Diffs (ADR-0032 N3.1 verlangt sie in A3):** Empfehlung 10 s ab Eingang, Prozess `min(10 s, Rest)`, Antwort spätestens nach 15 s, keine Teilantwort (NFR, AK 13). Herleitung: Ziel des ADR p95 < 500 ms, also 20-facher Spielraum; dieselbe Zahl wie bei der Liste.
2. **Zulassung ohne Zweigliste:** Empfehlung: der Diff prüft nur „Objekt ist ein Commit“ (gleich `auf_zweig` oder `verwaist`, N1.6) und liefert `commits[0]` ohne `zustand` und `zweige` (FA 3, 4); B2 liest beides aus der Liste. Spart die Zweigliste und den Cache pro Diff.
3. **Zählweise und Startwerte der Grenzen:** KB/MB binär; „3.000 Zeilen“ als `plus + minus`; „256 KB“ als Byte des Patch-Texts ab `@@`; „4 MB“ als Summe der `patch`-Bytes; 2.000 Dateien (Herleitung: ein Eintrag etwa 300 Byte, 2.000 Einträge unter 1 MB, weit unter der Antwortgrenze; **nicht gemessen — Hypothese**, ADR-0032 Punkt 8 nennt keine Zahl); `-M50% -l1000` ausdrücklich, damit `diff.renameLimit` aus dem Repository nichts verlängert.
4. **Befehl für den Patch und Bytegrenze:** `diff` (Porcelain) oder `diff-tree -p` (Plumbing): beide mit Schaltern; gemessen startet `diff-tree` ohne Schalter weder `diff.external` noch `textconv` (Hinweise). Neuer Lauf-Modus „bis zur Bytegrenze lesen, beenden, Teil liefern“; er weicht für den Diff von „ein abgebrochener Prozess liefert nie eine Teilausgabe“ ab (Hinweise).
5. **Form von `hinweise`:** Objekte mit `art` (`dateien_gekappt`, `zu_gross_zum_anzeigen`); A4 ergänzt eigene Arten.

**Produktfrage (product-owner, über den Director):** 6. Mehr als 2.000 Dateien in einem Commit: Das Artboard D0009 (`#diff-raender`) sagt „die Dateiliste bleibt vollständig“; hier wird die Liste bei 2.000 gekappt und `hinweise` nennt die Zahlen (FA 6, 7, AK 10). Empfehlung: kappen (zwei Wege wären entweder eine unbegrenzte Liste, die Server und Oberfläche belastet, oder eine Abweisung, die den Review sperrt), der gestalter ergänzt die Hinweiszeile vor B2. Bis zur Antwort gilt die Empfehlung.

**Glossar:** an den fachspezialist (über den Director): die Begriffe Hunk, Patch-Text und nachladen (zusätzlich zu Zustand und verwaist aus R00204).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung sagen: Agenten können den Diff eines einzelnen Commits der Karte ab jetzt über die API lesen (`GET /api/aufgaben/{nr}/diff?commit=…`); der Gesamt-Diff (A4) und die Review-Seite (B2) folgen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Ein Reviewer-Agent sieht heute nur Hashes; um einen Commit zu beurteilen, braucht er Zugriff auf das Arbeits-Repository, und die Review-Seite im Board hätte nichts, was sie zeigen könnte. Ruft der Agent den Diff eines Commits ab (X), bekommt er Dateiliste, Zähler, Merkmale und Hunks in einer begrenzten, vollständig benannten Form, und große, binäre oder nicht lesbare Dateien stehen als Merkmal da statt als Lücke (Y), sodass Review und Review-Seite ohne eigenen Zugriff auf das Repository und ohne die Sorge arbeiten, dass ein Commit den Server füllt oder ein Repository ein Programm startet (Z). Weil jeder Schalter und jede Grenze an der Quelle sitzt (am Startort, beim Lesen der Ausgabe), bleibt der Schutz auch dann, wenn später ein Befehl oder eine Antwortform dazukommt.

## Notizen

- Heimat: I0196 unter D0009 „Arbeit hinter der Karte“, Geschwister von I0192 bis I0195.
- **Lehren aus den Reviews von #207 und #211, die hier als Kriterien stehen:** (1) `[diff] external` und `textconv` laufen bei `diff`, wenn die Schalter fehlen; bei A2 überlebte der Mutant, weil `log` den Schalter nicht braucht — AK 16 d verlangt, dass der Mutant gefahren und getötet wird, und die Messung (Hinweise) sagt, warum die Wahl des Befehls zählt. (2) Grenzen für Größe und Zahl gelten vor dem teuren Schritt und für die Ausgabe mit Abbruch (AK 9, 10). (3) Fremder Inhalt nur als Daten (AK 6, 17). (4) GET schreibt nie (AK 14, 18).
- **Zu B3 und A4 (Frage des gestalters, Punkt 9 „Summen der Folge-Dateien“):** berührt A3 nicht; die Datei der Form F2 trägt `plus`/`minus` des einen Patches. A4 legt fest, was eine Folge-Datei liefert; die Form lässt dafür Platz, ohne dass A3 etwas festlegt.
- **Herleitung der Zahlen:** 262.144 Byte = 256 · 1.024; 4.194.304 = 4 · 1.024 · 1.024; 20.971.520 = 20 · 1.024 · 1.024; 3.000 Zeilen, 256 KB, 4 MB, 20 MB aus ADR-0032 Punkt 8 (Startwerte); 2.000 Dateien ist Hypothese (siehe Offene Fragen 3); p95 < 500 ms aus ADR-0032 Punkt 9 (Ziel, nicht gemessen).
- **Hunk-Kopf einer neuen Datei mit einer Zeile:** `@@ -0,0 +1 @@` (13 Zeichen plus Zeilenumbruch = 14 Byte); bei mehr Zeilen `@@ -0,0 +1,2000 @@` (18 Zeichen plus Zeilenumbruch = 19 Byte). Die Rechenbeispiele in AK 7 und 8 beruhen darauf; stimmt die Git-Version in der Umgebung anders, rechnet der Test sie nach, und die Grenzen der Kriterien bleiben `262.144` und `4.194.304`.
- **Verworfene Alternativen:** (1) Zweigzustand im Diff mitliefern — bräuchte die Zweigliste samt Cache für jeden Klick; (2) F3 (Hunks und Zeilen als Objekte) — ADR-0032 Punkt 6 hat F2 gewählt; (3) die ganze Ausgabe lesen und danach kürzen — Speicher und Zeit wären unbegrenzt (Lehre aus #207); (4) Dateiliste unbegrenzt — siehe Produktfrage 6; (5) ein Prozess je Datei für den Patch — bis zu 2.000 Prozesse je Aufruf; (6) `?format=patch` mit 413 bei Überschreitung — sperrt den Agenten für den ganzen Commit wegen einer Datei.
