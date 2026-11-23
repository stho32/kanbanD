---
id: R00250
status: Neu
datum: 2026-11-23
ursprung: Bug-Report
ursprungslauf: R00010
---

# R00250: Behebung — „Speichern“ ändert in kanbanD.md nur die Zeilen, die sich ändern

## Beschreibung

Karte #248, entstanden im Entwicklertest von #218 (R00220, PO Z. 492). Technik: ADR-0043 „`kanbanD.md` zeilengenau je Abschnitt schreiben“ (akzeptiert), Entscheidungen des product-owner Z. 665–668.

**Reproduktion (Probe der Karte):** Gegeben eine `kanbanD.md` mit `# von Hand`, `eigener-schluessel: 1` vor den bekannten Schlüsseln und eigenem Textkörper. `sh` benennt in „Einrichten“ eine Person um und drückt „Speichern“. **Erwartet:** `git show HEAD -- kanbanD.md` zeigt nur die geänderte Zeile; Kommentar, fremder Schlüssel, Reihenfolge und Textkörper bleiben zeichengleich. **Tatsächlich:** Die Datei wird aus dem Modell neu geschrieben. Kommentar und fremder Schlüssel verschwinden, der Textkörper wird durch den Standardtext ersetzt. Dasselbe gilt für jeden Schreibweg über `einstellungen_aendern`: `PUT /api/einstellungen`, `POST /api/personen`, `PATCH /api/personen/{kürzel}`, Stilllegen.

Das ist **falsch gebaut** (PO Z. 665): Die Vision verlangt schon heute, dass sich die Dateien nur dort ändern, wo sich etwas ändert, und `kanbanD.md` ist die Einstellungsdatei, die Menschen von Hand pflegen (Z. 492). Der echte Bestand zeigt den Fehler heute: In `kanbanD-Kanbanboard` steht `record-transcripts: true` hinter `sources`, und das nächste „Speichern“ verschiebt die Zeile ohne Anlass.

Zahlt ein auf: [Vision](R00000-vision.md) — „Git-freundliche Form“ (Z. 172) und „Die Dateien sind der einzige Speicher“ (Z. 165): Wer in „Einrichten“ speichert, sieht im Git-Verlauf genau seine Änderung, und was ein Mensch von Hand in `kanbanD.md` geschrieben hat, geht nie still verloren.

### Domänenbezug

Der Schalter `record-transcripts` ist die [Vorgabe des Ordners](../Dokumentation/Domaenenwissen/D00011-vorgabe-des-ordners.md). Die Klassen des Ordners sind der [Klassenvorrat](../Dokumentation/Domaenenwissen/D00010-klassenvorrat.md). „Normalform“, „Handform“ und „alte Registerform“ sind die Begriffe aus ADR-0043 Regel 6 und ADR-0034 N2. Im Glossar haben sie keinen eigenen Eintrag.

## Ursachenanalyse

### Root Cause

Belegt am Stand `0dbdfffd` (`karte/248` nach dem Rebase auf `main`):

- `src/dienst/einstellungen.rs:172–189` (`einstellungen_aendern`): Modell lesen, ändern, normalisieren, prüfen, und bei einer Änderung schreibt `:187` `einstellungen::schreiben(&neu)` als **ganze Datei**.
- `src/format/einstellungen.rs:115–142` (`schreiben`): erzeugt `people`, `classes`, `signals` (nur wenn nicht leer), `record-transcripts`, `sources` in fester Reihenfolge und danach den Standard-Textkörper. Das Modell `Einstellungen` (`src/modell/einstellungen.rs:88–97`) kennt nur diese Felder. Kommentare, fremde Schlüssel, die Reihenfolge und den Textkörper gibt es darin nicht.
- Den Schalter setzt `schreiben` **vor** `sources` (`:135–137`). `schalter_im_text` (`src/format/board.rs:102–135`) fügt ihn bei fehlender Zeile aber vor dem schließenden `---` ein, also **hinter** `sources`. Deshalb verschiebt das nächste „Speichern“ diese Zeile.
- Beim Schalter scheitert das Rücklesen heute mit `Fehler::Intern` (500), nicht mit 409 (`src/dienst/schalter.rs:64–69`).

Ausgeschlossen: `einrichten` (`src/dienst/einrichten.rs:108–121`) legt die Datei einmalig neu an. Dort ist das Erzeugen aus dem Modell richtig, und es bleibt so. Board-Dateien folgen weiter der Normalform (PO Z. 492) und sind nicht betroffen.

### Betroffene Komponenten

- `src/format/einstellungen.rs`: `schreiben` wird in Abschnittsschreiber zerlegt. Dazu kommen der Blockschreiber `abschnitt_im_text`, die Normalform-Prüfung je Abschnitt und ein Schreiber der **alten Registerform**, den es heute nicht gibt (Hinweis des architekt). Ohne ihn lässt sich der bisherige Block `sources` der sechs Bestände nicht mit seiner Form vergleichen.
- `src/format/board.rs` `schalter_im_text`: wird zu einem Aufruf von `abschnitt_im_text`. Seine Tests bleiben unverändert grün.
- `src/dienst/einstellungen.rs` `einstellungen_aendern`; `src/dienst/schalter.rs` `vorgabe_transkripte_setzen` (Regel 7).
- **Nicht** betroffen: `einrichten`, die Board-Dateien, die Oberfläche (`#einr-fehler` zeigt den Text schon heute, und der Entwurf bleibt stehen, R00209 AK 12).

## Lösungsvorschlag

### Langfristige Lösung

ADR-0043 **V4** mit Regel 6 nach PO Z. 666, Regeln 1–7:

1. Ein Abschnitt ist eine Zeile `<schluessel>:` in Spalte 0 im Frontmatter samt den folgenden Zeilen, die mit Leerzeichen oder Tab beginnen. `abschnitt_im_text(text, schluessel, Option<block>)` ersetzt ihn an Ort und Stelle, fügt ihn bei Fehlen vor dem schließenden `---` ein oder entfernt ihn. BOM und Zeilenende folgen der Datei.
2. Die Blöcke liefern die vorhandenen Schreiber in Normalform. `schreiben` setzt sie nur noch für `einrichten` zusammen.
3. Nur Abschnitte mit Unterschied zwischen `alt` und `neu` werden geschrieben, in der Reihenfolge `people`, `classes`, `signals`, `sources`. Die Umstellung der alten Registerform ist ein Unterschied in `sources`.
4. Textkörper, fremde Schlüssel, Kommentare außerhalb geänderter Abschnitte und die Reihenfolge erzeugt oder ändert kein Schreibweg außer `einrichten`.
5. Rücklese-Prüfung als zweite Sicherung. Liest sich der neue Text nicht zu `neu` zurück, gibt es keinen Commit, und kanbanD antwortet 409 mit dem Wortlaut unten.
6. Ein geänderter Abschnitt wird nur ersetzt, wenn sein bisheriger Text der Normalform seines bisherigen Werts entspricht. Bei `sources` gilt auch die alte Registerform. Verglichen wird ohne Zeilenende, und ein fehlender Abschnitt mit leerem Wert gilt als Normalform. Sonst wird nichts geschrieben, und kanbanD antwortet 409. Geprüft wird für alle geänderten Abschnitte, bevor einer geschrieben wird.
7. Das gilt für alle Schreibwege über `einstellungen_aendern`. Der Schalter nutzt dieselbe Funktion, aber ohne Regel 6. Scheitert bei ihm das Rücklesen, antwortet kanbanD 409 mit demselben Wortlaut.

**Wortlaut der 409** (PO Z. 667, wörtlich, im Feld `fehler`):
„Nicht gespeichert: Der Abschnitt „<schluessel>“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen.“
`<schluessel>` ist der erste betroffene Abschnitt in der Reihenfolge `people`, `classes`, `signals`, `sources`. Beim Schalter ist es `record-transcripts`. Lässt sich ein Rücklesefehler keinem Abschnitt zuordnen, steht dort der erste geänderte Abschnitt.

### Alternative Ansätze

Entschieden in ADR-0043 und PO Z. 666:

- **V1 ohne Verweigerung:** Eingerückte Kommentare und die Handform in einem geänderten Abschnitt gingen still verloren, also der Fehler dieser Karte im Kleinen. Verworfen.
- **V2 zeilengenau je Eintrag:** Das kostet etwa doppelt so viel Code und Tests, und kein echter Bestand braucht es. Es wird erst gebaut, wenn eine Verweigerung nach Regel 6 im Betrieb auftritt.
- **V3 Hinweis und Verweigerung bei jeder Abweichung:** „Einrichten“ würde gerade für die von Hand gepflegte Datei unbrauchbar, und schon der echte Bestand `kanbanD-Kanbanboard` würde verweigert. Verworfen.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Ein Rust-Test am Dienst mit einem Ordner aus Datei H (Ausgangslage) und echtem Git. Je Schreibweg wird eine Änderung gemacht, danach werden `git diff --numstat HEAD~1 HEAD -- kanbanD.md` und der Text außerhalb der erwarteten Zeilen verglichen. Heute rot sind AK 1, 2, 3, 5, 6 und 8 sowie der Teil von AK 9 zu `kanbanD-Kanbanboard`.

### Code-Extraktion für isoliertes Testing

Rein und je für sich testbar sind die Abschnittsschreiber, der Schreiber der alten Registerform, `abschnitt_im_text` und die Normalform-Prüfung, alle ohne Git und ohne Dienst. Der Dienst setzt sie nur noch zusammen.

### Regressionstests

- Die Tests von `schalter_im_text` und `einstellungen::schreiben` bleiben ohne geänderte Erwartung grün.
- `einrichten` schreibt eine neue `kanbanD.md` byte-gleich wie bisher.
- Die R00010-, R00091-, R00209- und R00220-Specs sind grün.
- Alle Tests aller Ebenen sind grün (Gate).

## Akzeptanzkriterien

**Ausgangslage:** Ordner F, eingerichtet durch `einrichten` mit den Personen `sh` (Mensch, Name „Sven“) und `ag` (Agent, Name „Agent A“), der Klasse `bug` (Bezeichnung „Fehler“), ohne Signale und mit `sources` in Normalform (`repository: ""`). Mensch `sh`, Git echt. **Datei H** ist die so geschriebene `kanbanD.md` mit vier Zusätzen von Hand:

1. `# von Hand` als erste Zeile nach dem öffnenden `---`;
2. `eigener-schluessel: 1` als Zeile danach, vor `people:`;
3. `# Klassen folgen` in Spalte 0 zwischen dem letzten Personeneintrag und `classes:`;
4. statt des Standard-Textkörpers der Text `# Unser Ordner`, eine Leerzeile und `Von Hand geschrieben.`.

H wird als „von Hand“ committet. **Diff** meint `git diff --numstat HEAD~1 HEAD -- kanbanD.md` (entfernt/hinzugefügt) nach dem Commit des Schreibwegs. **Zeichengleich** heißt: Alle Zeilen außerhalb der genannten Zeilen sind Byte für Byte gleich, samt BOM und Zeilenende. **Kein Commit** heißt: `HEAD` ist unverändert, und die Datei ist zeichengleich mit vorher.

**Rechenbeispiel:** `sh` heißt „Sven“, die Umbenennung macht daraus „Sven Hansen“. Erwartet ist `1  1` mit `-  sh: {name: Sven, kind: human}` und `+  sh: {name: Sven Hansen, kind: human}`. Heute entfernt der Diff zusätzlich `# von Hand`, `eigener-schluessel: 1`, `# Klassen folgen` und den Textkörper und fügt den Standard-Textkörper hinzu (rot).

### Bug behoben

- [ ] **AK 1 Probe der Karte (heute rot):** Gegeben H. Wenn `sh` über `PUT /api/einstellungen` die Person `sh` in „Sven Hansen“ umbenennt, dann ist der Diff `1  1` (nur die Zeile von `sh`), und alles andere ist zeichengleich, auch Kommentar, fremder Schlüssel, Reihenfolge und Textkörper.
- [ ] **AK 2 Jeder Schreibweg ändert nur seine Zeilen:** Gegeben H, je Fall frisch:
  - `POST /api/personen` legt `ab` an → Diff `0  1`, die neue Zeile steht direkt hinter der Zeile von `ag`, also noch vor `# Klassen folgen`.
  - `PATCH /api/personen/ag` legt `ag` still → Diff `1  1` (`, active: false` an der Zeile von `ag`).
  - `PUT` legt das erste Signal `warten` an → Diff `0  2` (`signals:` und ein Eintrag), unmittelbar vor dem schließenden `---`, also hinter dem Block `sources` (Regel 1).
  - Danach entfernt `PUT` dieses Signal wieder → Diff `2  0`, und die Datei ist wieder zeichengleich mit H.
  - Ein zweites `PUT` mit unverändertem Rumpf → kein Commit.
- [ ] **AK 3 CRLF und BOM bleiben:** Gegeben H mit `\r\n` an jeder Zeile und BOM. Wenn AK 1 und der Fall „erstes Signal“ aus AK 2 laufen, dann sind die Diffs dieselben wie dort. Jede Zeile der Datei endet danach auf `\r\n` (Anzahl `\n` = Anzahl `\r\n`), und das erste Zeichen ist weiter die BOM. Gegenprobe: H mit `\n` ohne BOM bekommt weder BOM noch `\r`.
- [ ] **AK 4 Alte Form von `sources`:** Gegeben H, dessen Block `sources` in der alten Registerform steht (`wbs: ""`, `requirements: ""`, `applications:` mit `kd: {name: kanbanD, wbs: …, requirements: …}`, Form wie in den sechs Beständen). Wenn `PUT` die Person `sh` umbenennt, dann liegt jede geänderte Zeile in der Zeile von `sh` oder im Block `sources`. Dieser steht danach in der Form mit `repository` (ADR-0034 N2 Regel 2), alles andere ist zeichengleich, und nichts wird verweigert. Wenn statt dessen `PATCH /api/personen/sh` umbenennt, dann ist der Diff `1  1`, und `sources` bleibt in der alten Form.
- [ ] **AK 5 `record-transcripts` hinter `sources` bleibt dort (der echte Bestand, heute rot):** Gegeben H mit `record-transcripts: true` als letzter Zeile vor dem schließenden `---`, hinter `sources`. Wenn `PUT` den Namen der Anwendung `kd` im Register ändert, dann ändern sich nur Zeilen im Block `sources`, und `record-transcripts: true` bleibt die letzte Zeile des Frontmatters. Dasselbe gilt für die Umbenennung von `sh` (Diff `1  1`).
- [ ] **AK 6 Handform im geänderten Abschnitt wird verweigert (PO Z. 666, Probe 1):** Gegeben H mit der eingerückten Zeile `  # Vertretung` im Abschnitt `people`. Wenn `PUT` die Person `sh` umbenennt, dann antwortet kanbanD 409 mit `fehler` = „Nicht gespeichert: Der Abschnitt „people“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen.“, und es gibt keinen Commit. Dasselbe gilt über `PATCH /api/personen/sh` und beim Stilllegen. Dieselbe 409 kommt bei diesen Formen von `people`:
  - `sh` in Blockform über zwei Zeilen statt in Flussform;
  - `name: 'Sven'` in eigener Anführung;
  - eine Leerzeile zwischen `sh` und `ag`.
  Reihenfolge: Mit Handform in `classes` und in `sources`, wenn `PUT` beide ändert, nennt die 409 `classes`, und es gibt keinen Commit. Die Mutante „Normalform-Prüfung entfernt“ macht diesen Test rot.
- [ ] **AK 7 Handform bleibt, wo nichts geändert wird (PO Z. 666, Probe 2):** Gegeben H mit der eingerückten Zeile `  # Farbe abgestimmt` im Abschnitt `classes`. Wenn `PUT` die Person `sh` umbenennt, dann gibt es einen Commit mit Diff `1  1`, und der Abschnitt `classes` ist samt Kommentar zeichengleich.
- [ ] **AK 8 Rücklese-Sicherung, auch beim Schalter (Regeln 5 und 7):** Gegeben H, und je Fall bleibt der Text danach zeichengleich, ohne Commit:
  - `people:` als `"people":` zitiert; `PUT` benennt `sh` um → 409 mit dem Wortlaut, `<schluessel>` = `people`.
  - H mit der Zeile `"signals": {}` (zitiert, leer); `PUT` legt das erste Signal `warten` an → 409 mit `<schluessel>` = `signals`, weil sich der Text mit zwei Schlüsseln `signals` nicht zurücklesen lässt. Die Mutante „Rücklese-Prüfung entfernt“ macht genau diesen Fall rot.
  - H mit `"record-transcripts": false`; `PUT /api/einstellungen/transkripte` mit `{erfassen: true}` → 409 mit `<schluessel>` = `record-transcripts` (heute 500).
- [ ] **AK 9 Kopien der sechs echten Bestände (Legacy):** Gegeben je eine Kopie der `kanbanD.md` aus `Entwicklungsprozess`, `goaltreetoolA`, `JoinPuyaApp`, `kanbanD-Demo`, `kanbanD` und `localchatA` (Stand 2026-11-23). Die Namen der Menschen sind durch Platzhalter ersetzt, Kürzel, Art, Zustand, Reihenfolge, Form und Bytes der Zeilen sonst unverändert. Je Datei:
  - `PUT` benennt die erste Person um → jede geänderte Zeile liegt in deren Zeile oder im Block `sources` (alte → neue Form), und nichts wird verweigert;
  - `PATCH /api/personen/{kürzel}` benennt sie um → Diff `1  1`.
  Für `kanbanD` bleibt `record-transcripts: true` die letzte Zeile des Frontmatters (heute rot).
- [ ] **AK 10 Oberfläche, Einrichten, Bug-Vorlage:**
  - Gegeben H mit `  # Vertretung` in `people`, im gestarteten Programm. Wenn `sh` in „Einrichten“ „Sven“ in „Sven Hansen“ ändert und „Speichern“ drückt, dann steht der Wortlaut aus AK 6 in `#einr-fehler`, das Feld zeigt weiter „Sven Hansen“, und es gibt keinen Commit.
  - Das Einrichten eines leeren Ordners schreibt `kanbanD.md` byte-gleich wie vor dem Fix.
  - `einstellungen::schreiben` wird nur noch aus `einrichten` aufgerufen.
  - Die Reproduktionstests sind ohne Fix rot und mit Fix grün, und alle Tests aller Ebenen sind grün.

## Implementierungshinweise

- Bauen nach ADR-0043 Regeln 1–7. `schalter_im_text` wird ein Aufruf von `abschnitt_im_text` mit dem einzeiligen Block `record-transcripts: <wert>`. Regel 6 gilt für ihn nicht.
- Die Normalform-Prüfung von `sources` braucht einen Schreiber der alten Registerform (`quellen_altform_schreiben` o. ä.) aus dem Modell (`Quellen.wbs`, `.anforderungen`, `Anwendung.wbs`, `.anforderungen`, `src/modell/einstellungen.rs:42–76`). Maßstab ist der Block `sources` der sechs Bestände: `lesen` und danach dieser Schreiber ergeben ihn zeichengleich (ohne Zeilenende).
- `normalisieren` ergänzt `repository` auch in `neu` (`src/dienst/einstellungen.rs:154`). Bei `Altform::Stehenlassen` vergleicht der Abschnittsvergleich für `sources` deshalb gegen `vergleich` (`alt` mit `repository_ergaenzen`, `:180–183`), nicht gegen `alt`. Sonst gilt `sources` beim Stilllegen als geändert, und AK 4 (zweiter Teil) und AK 9 werden rot.
- Den Text der Datei liest `einstellungen_aendern` unter derselben Sperre wie das Modell (`self.ordner().lies(einstellungen::DATEI)`, Muster `schalter.rs:62`).
- Fixtures für AK 9 unter `tests/altbestaende/` (vorhandener Ordner), eine Datei je Bestand. Die Namen von Menschen werden durch Platzhalter ersetzt, Rollennamen von Agenten dürfen bleiben. Absolute Pfade bleiben wie im Bestand, denn sie sind keine Personendaten, und `repository` folgt aus ihnen.
- serde_yaml 0.9 weist doppelte Schlüssel beim Lesen ab. Darauf beruht der zweite Fall von AK 8.
- Review-Punkt (ADR-0043 „Durchsetzung“): kein Aufruf von `einstellungen::schreiben` außerhalb von `einrichten`.
- Nach dem Bau führt der architekt die Modelle A00004 und A00005 nach (ADR-0043 „Folgeentscheidungen“). Das ist nicht Teil dieser Anforderung.

## Offene Fragen

- Keine, die den Bau aufhalten. Zwei Abweichungen von den Abnahme-Ideen der ADR stehen in „Notizen“.

## Warum löst diese Anforderung das Problem? (Pflicht)

Handgepflegtes geht verloren, weil jeder Schreibweg die ganze Datei aus einem Modell erzeugt, das nur die bekannten Felder kennt. Wenn nur noch die Abschnitte ersetzt werden, deren Wert sich ändert, berührt kanbanD Kommentare, fremde Schlüssel, Reihenfolge und Textkörper gar nicht mehr. Die Umbenennung von „Sven“ ergibt dann im Git-Verlauf genau eine Zeile. Wo kanbanD einen geänderten Abschnitt nicht ersetzen kann, ohne Handform zu verlieren, verweigert es mit einem Satz, der sagt, was zu tun ist. So bleibt kein Weg mit stillem Verlust. Der Hebel ist der Schreiber, nicht das Modell: Ein Modell, das Kommentare und Textkörper trägt, wäre ein YAML-Rundlauf mit eigenem Fehlerbild.

## Notizen

- Priorität: Hoch (Datenverlust ohne Hinweis in der Datei, die Menschen von Hand pflegen; der echte Bestand ist betroffen)
- Betroffene Nutzer/Systeme: Menschen, die `kanbanD.md` von Hand pflegen und in „Einrichten“ speichern; die Factory, die über `GET`→`PUT` und `/api/personen` schreibt
- Workaround: Änderungen an Personen, Klassen, Signalen und am Register nur noch in der Datei vornehmen
- `ursprungslauf: R00010`, denn seit R00010 schreibt „Speichern“ `kanbanD.md` als ganze Datei. Entdeckt wurde der Fehler im Entwicklertest von R00220 (#218).
- **Zwei Abweichungen von den Abnahme-Ideen der ADR (planer):**
  1. Das erste Signal steht nach Regel 1 vor dem schließenden `---`, hinter `sources`, und nicht „hinter `eigener-schluessel`“, wie die Abnahme-Idee sagt. Die Regel geht vor.
  2. Die Abnahme-Idee „`"people":` zitiert, Mutant Rücklese-Prüfung entfernt“ trifft schon Regel 6: Der Abschnitt `people` fehlt dann, obwohl sein Wert nicht leer ist. Deshalb führt AK 8 als Mutantenprobe den Fall mit `"signals": {}`, an dem nur die Rücklese-Prüfung greift.
- **Herkunft der Zahlen:** Die Diffs in AK 1–3 und 5–7 sind aus der Ausgangslage gezählt. Die sechs Bestände und ihre Abweichungen stammen aus ADR-0043 „Kontext, Bestand“ und wurden am 2026-11-23 nur lesend nachgeprüft.
- Schlank arbeiten: zehn Kriterien.
