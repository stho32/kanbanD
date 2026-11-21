# ADR-0036: Transkripte der Agentenläufe — gzip unversioniert unter `transkripte/<nr>/`, Dateiname aus der Kennung, Eintrag `transcripts` an der Karte, Schalter `record-transcripts`, Lesen im Antwortbudget

**Status**: Akzeptiert
**Datum**: 2026-11-21
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #208, Lauf 208-architekt-1)
**Kontext-Anforderung**: — (Karte #208, Scheibe C1 „Transkripte der Agentenläufe ablegen (API und Schalter in der Datei)“; Anforderung und WBS-Knoten folgen über den planer). Bezug: po-entscheidungen Z. 370–381, 387; ADR-0003, ADR-0006, ADR-0008, ADR-0024, ADR-0028, ADR-0031, ADR-0032 (Punkt 10, N2.2, N5.1)
**Erprobt durch**: Probe 2026-11-21 in einem Wegwerf-Repository: ein Ordner `transkripte/` mit `.gitignore` = `*` erscheint weder in `git status --porcelain --untracked-files=all` noch in `git add -A`. Alles Übrige am Code gelesen, nicht gefahren (Stand `5e418f13`).

## Kontext

- **Betreiber 2026-11-19** (Kartenkommentar, po-entscheidungen Z. 381): Transkripte liegen gezippt und unversioniert im Board-Ordner (`.gitignore`), die Karte trägt den versionierten Eintrag. Vision Leitplanke (Z. 169, `9c6b91f5`): „Sie reisen nicht mit dem Repository und lassen sich vollständig löschen.“
- **PO entschieden**: Kennung `role@at` wie Kosteneinträge, ein Transkript ohne Kosteneintrag ist erlaubt (Z. 370); neutrales JSON-Lines-Format, die Factory wandelt selbst um (Z. 371); Upload schon gezippt, Prüfung von Kennbytes und Größe, 10 MB gezippt, kein Entpacken auf dem Server, Ausgabe `application/gzip` ohne `Content-Encoding` (Z. 375, 387); Schalter je Board mit Vorgabe des Ordners, ohne beides „aus“, Aufgabe auf mehreren Boards nur bei „alle an“, auf keinem Board die Vorgabe (Z. 377); bei „aus“ keine Erfolgsantwort, Kennzeichen `erfassung: "aus"` und die Boards, Zustand vorher lesbar (Z. 378); Ausschalten lässt Vorhandenes stehen (Z. 379). Umschalten in Einrichten mit 403 für Agenten kommt mit #218 (C2), nicht hier.
- **Belegt (Code)**:
  - Anhänge liegen versioniert unter `aufgaben/<nr>-<slug>/` (`Aufgabe::anhangordner`, `src/modell/aufgabe.rs:458`); `anhaenge()` listet jede Datei dieses Ordners (`src/dienst/anhaenge.rs:39`); der Ordnername folgt dem Slug des Titels.
  - Endgültiges Löschen gibt Nummer und Slug frei (ADR-0024, „die Nummer und der Slug werden frei“) und räumt nur die Dateien des Anhangsordners (`src/dienst/archiv.rs:46–90`).
  - kanbanD committet nur benannte Pfade: `git add -A -- <pfade>` (`src/git.rs:90–91`). Ein unversionierter Ordner gerät nie in einen Commit von kanbanD.
  - Der Wächter meldet jede Datei außer `.git/` und `*.kanbanD-tmp` (`src/waechter.rs:44–46`); nicht gemerkte Pfade gelten als „extern“ und laden offene Sichten neu.
  - Die Rolle eines Kosteneintrags ist freier Text bis 60 Zeichen ohne `@` (`src/modell/kosteneintrag.rs:82–85`) — sie darf `/`, `..`, `\` und Leerzeichen enthalten und ist **kein** sicherer Dateiname.
  - Board-Datei und `kanbanD.md` schreiben nur benannte Schlüssel (ADR-0031, Kontext); ein unbekannter Schlüssel der Aufgabe übersteht das Schreiben, bei genau einem Listeneintrag nur über die Heilung `yaml_heilen` (ADR-0032 N2.2).
  - `Antwortbudget` (64 MB, `src/dienst/antwortbudget.rs`) mit Auslieferung in kopierten 64-KB-Stücken und Schreibfrist-Wache (ADR-0032 N5.1); N5.1 nennt `anhang_lesen` als Kandidaten für „dieselben Teile“.
  - axum 0.8.9 liefert einen Multipart-Teil stückweise (`Field::chunk`); die Route der Anhänge setzt ihre eigene Körpergrenze (`src/web/mod.rs:126–127`).
- **Lastprofil** (`AI-Team/factory.md`, „Wissen“): bis 10 Agenten, schreibend inkl. Commit p95 < 500 ms, lesend p95 < 200 ms bei 5.000 Aufgaben.

Qualitätsziele: (Q1) kein Transkript gerät je in einen Commit; (Q2) eine Anfrage oder eine von Hand geänderte Datei kann keinen Pfad außerhalb von `transkripte/<nr>/` erreichen; (Q3) Speicher bleibt beim Hoch- und Herunterladen begrenzt, unabhängig von der Zahl der Agenten; (Q4) Bestand und ältere Versionen lesen die Dateien ohne Verlust; (Q5) nichts verschwindet still, Löschen löscht wirklich.

## Optionen

### Ablage

| Option | Stärke | Schwäche |
|---|---|---|
| **A — `<ordner>/transkripte/<nr>/`, darin einmal `transkripte/.gitignore` = `*`** (gewählt, wie ADR-0032 Punkt 10) | unabhängig vom Slug und vom Anhangsordner; selbst-ignorierend, die `.gitignore` des Menschen bleibt unberührt (Probe); Aufräumen ist ein Ordner | ein zweiter Ort je Aufgabe neben dem Anhangsordner |
| B — Unterordner im Anhangsordner `aufgaben/<nr>-<slug>/transkripte/` + Zeile in der Wurzel-`.gitignore` | alles einer Aufgabe an einem Ort | Ordnername wechselt mit dem Titel; `anhaenge()` und das Löschen sehen Unterordner nicht; fremde `.gitignore` wird geschrieben |
| C — außerhalb des Board-Ordners (Datenordner des Benutzers) | kein Weg, sie je zu committen | widerspricht der Betreiber-Entscheidung „im Board-Ordner“; ein Umzug per Kopie verliert sie |

### Dateiname

| Option | Stärke | Schwäche |
|---|---|---|
| **N1 — aus der Kennung abgeleitet, Rolle auf `[a-z0-9-]` gefaltet; Kollision → 409** (gewählt) | kein Pfad in Datei oder Anfrage; ohne kanbanD lesbar (`zcat`) | zwei Rollen, die gleich falten („Code Reviewer“, „code-reviewer“), kollidieren in derselben Minute |
| N2 — vom Server vergeben, als `file` im Eintrag gespeichert | jede Kollision lösbar | die Datei der Aufgabe trägt einen Pfad — eine handbearbeitete Datei wird zur Angriffsfläche und muss bei jedem Lesen geprüft werden |
| N3 — Prüfsumme/Hash der Kennung | feste Länge, kollisionsarm | ohne Abhängigkeit kein stabiler Hash; für Menschen unlesbar |

### Hochladen

| Option | Stärke | Schwäche |
|---|---|---|
| **U1 — multipart wie Anhänge, Felder `at`, `role`, `column`, Datei `datei`; die Datei wird stückweise in eine Zwischendatei geschrieben** (gewählt) | eine vorhandene Form; konstanter Speicher je Upload; kein Kodieren von `+` in der Adresse | der Client braucht multipart |
| U2 — roher Körper `application/gzip`, Metadaten in der Abfrage | für `curl --data-binary` am einfachsten | `+` im Zeitpunkt wird ohne Kodierung zum Leerzeichen — eine Falle für jeden Agenten |
| U3 — JSON mit Base64 | Form wie Kosteneinträge | +33 % Größe, ganzer Körper im Speicher |

### Lesen

| Option | Stärke | Schwäche |
|---|---|---|
| **L1 — im Antwortbudget von ADR-0032 N5.1: Platz nach Dateigröße belegen, dann lesen, in kopierten Stücken ausliefern, Schreibfrist-Wache** (gewählt) | eine gemeinsame Obergrenze für alle großen Antworten; erprobte Teile | ein volles Budget macht Transkripte bis zur Frist zu 503 |
| L2 — Strom direkt aus der Datei | konstanter Speicher ohne Budget | neues Teil (Dateistrom) und eigene Frist-Wache; offene Dateihandles bei langsamen Clients |
| L3 — ganz lesen wie `anhang_lesen` | am kleinsten | 10 Agenten × 10 MB ungezählt im Speicher |

## Entscheidung

**Gewählt: A, N1, U1, L1.** Akzeptierte Schwäche: ein zweiter Ort je Aufgabe; seltene Namenskollision als 409; ein volles Antwortbudget gilt auch für Transkripte.

1. **Ablage.** `<ordner>/transkripte/<nr>/<name>.jsonl.gz`, `<nr>` vierstellig wie der Dateiname der Aufgabe (`0208`). Vor der ersten Datei legt kanbanD `transkripte/.gitignore` mit dem Inhalt `*` an, falls sie fehlt; eine vorhandene wird nie geändert. Kein Pfad unter `transkripte/` steht je in einem Commit. Beim Start wird nichts angelegt.
2. **Dateiname** `<rolle>@<JJJJ-MM-TT>T<HHMM><±HHMM>.jsonl.gz`, z. B. `entwickler@2026-11-13T1034+0100.jsonl.gz`. `<rolle>`: Rolle der Kennung kleingeschrieben, jede Folge von Zeichen außerhalb `[a-z0-9]` wird ein `-`, `-` am Rand entfällt, leer → `lauf`. Der Name entsteht **nur** aus einer gültigen Kennung (Regeln von ADR-0028 Punkt 2) — weder Anfrage noch Aufgabendatei nennen je einen Pfad. Ergibt ein neuer Eintrag denselben Namen wie ein **anderer** Eintrag derselben Aufgabe: 409 `{fehler, kennung}`, nichts geschrieben. Eine Datei dieses Namens ohne Eintrag (Rest einer gelöschten Aufgabe mit derselben Nummer) wird überschrieben.
3. **Eintrag an der Karte** — Schlüssel `transcripts` oben im Frontmatter, hinter `commits`, je Eintrag eine Flusszeile in der Reihenfolge des Hochladens:
   ```yaml
   transcripts:
     - {at: 2026-11-13 10:34+01:00, role: entwickler, column: Entwicklung, bytes: 281234}
   ```
   `at`, `role`, `column` nach ADR-0028 Punkt 2 und 3 (dieselben Prüfungen, Spalte eines Boards der Aufgabe); `bytes` = Größe der gz-Datei. Kennung `role@at` wie Kosteneinträge; sie verknüpft mit dem Kosteneintrag gleicher Kennung, ohne Fremdschlüssel. Höchstens 1000 Einträge je Aufgabe. Ein formwidriger Eintrag macht die Aufgabe **nicht** defekt: er bleibt wörtlich stehen und hat den Zustand `unlesbar`. Unbekannte Schlüssel eines Eintrags bleiben in der Datei. Duplizieren nimmt `transcripts` nicht mit.
4. **Schalter** `record-transcripts: true|false` (YAML-Wahrheitswert) im Frontmatter der Board-Datei; Vorgabe des Ordners als gleicher Schlüssel in `kanbanD.md`. Wirksam für ein Board: eigener Wert, sonst Vorgabe, sonst `false`. Wirksam für eine Aufgabe: `true` nur, wenn **alle** Boards, auf denen sie liegt (auch archivierte), wirksam `true` sind; auf keinem Board die Vorgabe. Board- und Einstellungs-Schreiber lesen und schreiben den Schlüssel bei **jedem** Schreiben mit (Karte ziehen, Einstellungen speichern). `PUT /api/einstellungen` und die Board-Routen nehmen ihn in C1 **nicht** an und lassen den gespeicherten Wert unverändert — sonst schaltete ein Agent über eine Hintertür ein, bevor #218 die 403 bringt.
5. **API** (Mensch und Agent über `X-KanbanD-Wer`, keine Spaltenregel; Fehler nach ADR-0003, nie 422):
   - `POST /api/aufgaben/{nr}/transkripte` — multipart, Felder `at`, `role`, `column`, Datei `datei`. Reihenfolge: 404 unbekannte Nummer → 423 defekte Datei → **409 `{fehler, erfassung: "aus", boards: [slug…]}`, bevor der Körper gelesen wird** → Datei stückweise in `transkripte/<nr>/<…>.kanbanD-tmp` (ohne Sperre), dabei 413 `{fehler}` ab 10.485.760 Byte und 400, wenn die ersten drei Byte nicht `1f 8b 08` sind → unter `gesperrt()` erneut Schalter (409), Kennung (409 bei gleicher Kennung), Spalte und Felder (400), Namenskollision (409) → Zwischendatei umbenennen, Eintrag schreiben, **ein Commit nur mit der Aufgabendatei** → 201 mit dem Eintrag. Jeder Fehler entfernt die Zwischendatei; scheitert der Commit, wird die umbenannte Datei entfernt. Körpergrenze der Route 10 MB + 64 KB.
   - `GET /api/aufgaben/{nr}/transkripte` → `{erfassen: bool, boards_aus: [slug], transkripte: [{kennung, at, role, column, bytes, zustand}]}`; `zustand` ∈ `vorhanden`, `fehlt` („liegt nicht auf diesem Rechner“), `abweichend` (Größe ≠ `bytes`), `unlesbar` (Eintrag formwidrig, keine reguläre Datei, Symlink, über 10 MB, Kennbytes falsch). Je Eintrag ein `symlink_metadata` und das Lesen von drei Byte — kein Entpacken.
   - `GET /api/aufgaben/{nr}/transkripte/{kennung}` → 200 `application/gzip`, ohne `Content-Encoding`, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`. Kennung unbekannt → 404; Zustand ≠ `vorhanden` → 404 `{fehler, zustand}`.
   - `DELETE /api/aufgaben/{nr}/transkripte/{kennung}` → Eintrag entfernen, ein Commit, danach die Datei löschen; 404 bei unbekannter Kennung. Geht auch, wenn die Datei fehlt oder „aus“ gilt.
   - `GET /api/aufgaben/{nr}` und `/api/zustand` liefern nur die gespeicherten Einträge (`transkripte: [{kennung, at, role, column, bytes}]`), **ohne Dateisystemzugriff** (Lastprofil). `GET /api/boards[/{slug}]` liefert `transkripte_erfassen: true|false|null` (eigener Wert des Boards).
6. **Lesen im Antwortbudget** (ADR-0032 N5.1): Platz nach der Dateigröße belegen, **bevor** gelesen wird (`try`, ohne Warten); passt es nicht, sofort 503 `{fehler: "Antwortbudget …"}`. Ausliefern in kopierten 64-KB-Stücken mit derselben Schreibfrist-Wache. Die größte Antwort (10 MB) passt sechsmal ins Budget. Keine Lesegrenze (kein Git-Prozess).
7. **Pfadschutz** (zweite Linie wie ADR-0008): der Zielpfad wird aus `nr` (u32 der Route) und dem Namen nach Regel 2 gebaut und vor jedem Öffnen, Umbenennen und Löschen geprüft — der Name passt auf `^[a-z0-9-]{1,60}@\d{4}-\d{2}-\d{2}T\d{4}[+-]\d{4}\.jsonl\.gz$`, `transkripte/` und `transkripte/<nr>/` sind keine Symlinks. Die Kennung der Adresse wird nur mit Einträgen verglichen, nie zu einem Pfad.
8. **Wächter**: Pfade unter `transkripte/` sind nicht relevant (`waechter::relevant`). Die Sichten laden über den Commit der Aufgabendatei neu, nicht über eine 10-MB-Datei.
9. **Archivieren, Löschen, Boards**:
   - Archivieren und Zurückholen ändern nichts an Einträgen und Dateien (wie Anhänge).
   - **Endgültig löschen** (ADR-0024): nach dem erfolgreichen Commit wird `transkripte/<nr>/` ganz entfernt. Scheitert das, eine Warnzeile im Protokoll (X00002); die Reste haben keinen Eintrag, werden nie gezeigt und beim nächsten gleichnamigen Upload überschrieben (Regel 2). Damit erbt eine neue Aufgabe mit derselben Nummer nie ein fremdes Transkript.
   - Board löschen oder archivieren berührt keine Transkripte; eine Aufgabe ohne Board fällt unter die Vorgabe des Ordners.
   - Ausschalten lässt Vorhandenes stehen und lesbar (Z. 379).
10. **Bestand und ältere Versionen**: Ohne `transcripts` und `record-transcripts` bleibt jede Datei zeichengleich. Eine Vorversion trägt `transcripts` als unbekannten Schlüssel mit, schreibt die Einträge aber in Blockform zurück (Inhalt gleich, wie ADR-0028); bei genau einem Eintrag gilt ADR-0032 N2.2 (Zeilenform, von der neuen Version geheilt). Eine Vorversion verliert `record-transcripts` beim Schreiben von Board oder `kanbanD.md` — der Schalter fällt auf „aus“, die sichere Richtung; Einträge und Dateien bleiben.

## Konsequenzen

**Positiv:** Kein Transkript gerät in Git, und Löschen löscht wirklich. Kein Pfad aus Anfrage oder Datei erreicht das Dateisystem. Der Speicher bleibt beim Hochladen konstant und beim Lesen im gemeinsamen Budget. Die Aufgabe trägt nur kleine Zeilen, also bleibt das Lastprofil für Lesen und Schreiben unberührt. Für ältere Versionen ist nichts verloren außer dem Schalter, und der fällt sicher auf „aus“.

**Negativ / Inkauf:**
- Ein frischer Klon oder ein anderer Rechner zeigt „fehlt“; es gibt keine Sicherung über Push/Pull (Betreiber-Entscheidung).
- Zwei Rollen mit gleich gefaltetem Namen kollidieren in derselben Minute (409); der Aufrufer trägt eine Minute später ein (wie ADR-0028 Punkt 4).
- Eine Datei gleicher Größe, aber anderen Inhalts erkennt die Liste nicht; die Ansicht (#210) merkt defekten Inhalt beim Entpacken (gzip-CRC).
- Keine Plattenquote: 1000 Einträge × 10 MB je Aufgabe sind möglich. Eine volle Platte ist ein Fehler 500 beim Hochladen, die Zwischendatei wird entfernt.
- Eine Vorversion kennt die Routen nicht (404); die Factory nimmt das hin wie 409.

**Durchsetzung:**
- Format-Test: Aufgabe mit `cost-entries`, `commits`, `transcripts` (0, 1, 2 Einträge, ein formwidriger) liest und schreibt sich zeichengleich und ist nicht defekt; Board und `kanbanD.md` mit `record-transcripts` übersteht Karte ziehen und `PUT /api/einstellungen`.
- API-Test: „aus“ → 409 mit `erfassung` und `boards`, kein Commit, keine Datei unter `transkripte/`; Aufgabe auf zwei Boards, eines „aus“ → 409; ein Upload bei „an“ → genau ein Commit, `git ls-files` enthält nichts unter `transkripte/`, `git status --porcelain` ist leer; 10.485.760 Byte → 201, ein Byte mehr → 413; falsche Kennbytes → 400; gleiche Kennung → 409.
- Pfad-Probe: Rolle `../../x`, `a/b`, `..`, `C:\x` → Datei liegt unter `transkripte/<nr>/` mit gefaltetem Namen; `transkripte/<nr>` als Symlink nach außen → `unlesbar`, nichts gelesen, geschrieben oder gelöscht außerhalb.
- Budget-Probe: Budget im Test auf 12 MB verkleinert, zwei Lesungen à 10 MB → die zweite 503; nach dem Lesen der ersten 200. Mutant „belegen nach dem Lesen“ macht einen Zähler-Test rot (Lehre „Grenzen, die Arbeit begrenzen“).
- Lösch-Probe: Aufgabe mit Transkript endgültig löschen, neue Aufgabe mit derselben Nummer → `GET …/transkripte` ist leer, `transkripte/<nr>/` fehlt.
- Review-Punkt `security-reviewer` und `architektur-reviewer`: Dateipfade unter `transkripte/` entstehen an genau einer Funktion aus Nummer und Kennung.

## Folgeentscheidungen / Aufgaben

- [ ] Anforderung über den planer: Regeln 1–10 (Scheibe C1).
- [ ] #210 (D1/D2): Liste und Laufansicht lesen `zustand` und entpacken mit `DecompressionStream`.
- [ ] #218 (C2): Umschalten in Einrichten, `PUT` nur für Menschen, Agent 403 (ADR-0006); löst Regel 4 letzter Satz ab.
- [ ] Factory (E2, `/factory lehren`): multipart-Upload je Lauf, 409 `erfassung` und 404 hinnehmen.
- [ ] Modell nach dem Bau nachführen (A00003, A00004, A00005, A00008).

## Quellen / Bezuege

- Karte #208 mit Kommentaren 2026-11-19; po-entscheidungen Z. 370–381, 387; Vision Z. 169
- ADR-0003, ADR-0006, ADR-0008, ADR-0024, ADR-0028, ADR-0031, ADR-0032 (Punkt 10 — Ablage und Schalter hier entschieden, N2.2, N5.1)
- `src/modell/aufgabe.rs:458`, `src/modell/kosteneintrag.rs:82–103`, `src/dienst/anhaenge.rs`, `src/dienst/archiv.rs:46–90`, `src/dienst/antwortbudget.rs`, `src/git.rs:90–91`, `src/waechter.rs:44–46`, `src/web/mod.rs:126–127`, `:1336–1353`
