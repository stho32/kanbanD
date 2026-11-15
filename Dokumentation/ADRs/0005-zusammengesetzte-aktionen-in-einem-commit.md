# ADR-0005: Zusammengesetzte Aktionen in einem Commit — Teilschritte liefern Änderungen, `aktion()` committet einmal; eigener Endpunkt „erledigen“

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00098 (Wiederöffnen), R00099 (Befund erledigt sich)
**Nachträge**: 2026-11-13 — eine gescheiterte Aktion hinterlässt nichts, und die Commit-Nachricht ist abgeleiteter Text (Karte #43), siehe [Nachtrag N1](#nachtrag-2026-11-13-n1-eine-gescheiterte-aktion-hinterlässt-nichts-die-nachricht-ist-abgeleiteter-text-karte-43); 2026-11-14 — die Rücknahme stellt den Stand von HEAD her, die Pfadprüfung gilt auch in `committen` (Karte #43, Bauversuch), siehe [Nachtrag N2](#nachtrag-2026-11-14-n2-rücknahme-auf-den-stand-von-head-die-pfadprüfung-gilt-auch-in-committen-karte-43-bauversuch); 2026-11-15 — **zurückgezogen (Betreiber 2026-11-15), nie gebaut**: Wiederöffnen mit `board` ist ein Umzug: die Zeilen der anderen Boards gehen im selben Commit (Karte #45), siehe [Nachtrag N3](#nachtrag-2026-11-15-n3-wiederöffnen-mit-board-ist-ein-umzug--die-zeilen-der-anderen-boards-gehen-im-selben-commit-karte-45) — es gilt die dort vorangestellte Regel „Archiviert ist eine Eigenschaft der Karte“. Der Text oberhalb der Nachträge ist der Stand der Annahme und bleibt unverändert.
**Erprobt durch**: —

## Kontext

Wiederöffnen (R00098) ist Zurückholen + aufs Board legen + Kommentar, Erledigen (R00099) ist Schlüssel suchen + Kommentar + Signal oder Bewegen + Reservierung entfernen — jeweils **ein** Commit unter **einer** Sperre. Die vorhandenen Methoden (`zurueckholen`, `bewegen`, Kommentar, Signal) sperren und committen je selbst; sie lassen sich nicht schachteln (`Mutex` ist nicht reentrant). Ein Sensor könnte die Schritte auch über die API nacheinander rufen.

## Optionen

### Option A: Clientseitig aus bestehenden Endpunkten zusammensetzen
- Vorteile: kein neuer Code im Server.
- Nachteile: mehrere Commits, kein atomarer Ablauf; zwischen den Aufrufen kann ein Mensch die Karte bewegen; die Fallunterscheidung aus R00099 wiederholt jeder Sensor.

### Option B: Teilschritte als Funktionen ohne Sperre und ohne Commit, die geänderte Aufgabe/Board im Speicher liefern; die öffentliche Methode sperrt, ruft sie, prüft Zugregeln (ADR-0002), ruft einmal `aktion()`
- Vorteile: atomar; die bestehenden Methoden werden zu dünnen Hüllen derselben Teilschritte, keine Logik doppelt.
- Nachteile: Umbau von `zurueckholen` und der Kommentar-/Signal-Wege in Kern + Hülle.

### Option C: Neue Methoden schreiben die Schritte eigenständig neu
- Vorteile: kein Eingriff in Bestehendes.
- Nachteile: doppelte Fachlogik (Zurückholen, Reservierung entfernen), die auseinanderläuft.

## Entscheidung

**Gewählt: Option B**, und für R00099 ein eigener Endpunkt `POST /api/aufgaben/erledigen` mit Dienstmethode in `src/dienst/erledigen.rs`.

Nur der Server kann Suche, Fallunterscheidung und Schreiben unter einer Sperre halten; die Anforderung verlangt einen Commit. Der Umbau in Kern + Hülle geschieht nur für die Teilschritte, die gebraucht werden (Zurückholen, Kommentar, Signal setzen, oben einordnen, Reservierung entfernen), im Slice, der sie zuerst braucht.

## Konsequenzen

**Positiv:**
- R00098 und R00099 teilen sich Kerne; Grenze und Eigentümer gelten über ADR-0002 ohne Sonderweg.

**Negativ / Inkauf zu nehmen:**
- Bestehende Tests der umgebauten Methoden müssen grün bleiben (Refactoring vor Feature, eigener Commit).

**Folgeentscheidungen / Aufgaben:**
- [ ] Regel in [X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md): eine öffentliche Methode = eine Sperre = ein `aktion()`.

## Nachtrag 2026-11-13 N1: Eine gescheiterte Aktion hinterlässt nichts, die Nachricht ist abgeleiteter Text (Karte #43)

**Anlass**: Karte #43 („Titel mit NUL oder Überlänge lässt Karte uncommittet liegen", aus dem Entwickler- und Security-Review #4, vorbestehend). Die Entscheidung oben verspricht „**ein** Commit je Aktion"; im Fehlerfall hält sie das nicht. Der Status bleibt `Akzeptiert`; der Nachtrag macht die Zusage auch dort wahr, wo der Commit selbst scheitert.

**Belegt (Code)**, kanbanD `cc9e553` (gelesen 2026-11-13):
- `Kanban::aktion` (`src/dienst/mod.rs:191–213`) ruft die Schritte der Reihe nach: erst `ordner.schreib(…)` bzw. `remove_file`, dann `git::committen`.
- `git::committen` (`src/git.rs:31–48`) macht `git add -A -- <pfade>`, prüft `git diff --cached` und ruft `git commit -q -m <nachricht> -- <pfade>`.
- Die Nachricht entsteht aus dem Titel (`src/dienst/aufgabe_anlegen.rs`, Anlegeweg). Ein NUL-Byte lässt `git commit` mit „nul byte found in provided data" scheitern, ein ~1 MB langer Titel sprengt die Argumentlänge (`MAX_ARG_STRLEN`); in beiden Fällen ist die Datei **geschrieben und vorgemerkt**, aber ohne Commit.
- Der zweite `POST` mit demselben `key` findet die Datei und antwortet `200`/`neu: false` (R00098) — für eine Karte, die in keiner Git-Historie steht. Die Dateien sind der einzige Speicher; hier steht einer, den niemand erzeugt zu haben glaubt.

### Entschieden

1. **Die Commit-Nachricht ist abgeleiteter Text.** Sie wird aus den Fachdaten gebaut, aber nie roh: erste Zeile, Steuerzeichen (NUL, Zeilenumbrüche, Steuerbereich) durch ein Leerzeichen ersetzt, Länge begrenzt (eine Zeile, rund 120 Zeichen, Rest als `…`). Die **Fachdaten** (Titel in der Datei) bleiben unverändert und werden für die Nachricht nie abgewiesen — das Format trägt sie (YAML-sicher, `yaml::skalar`), die Nachricht ist der einzige Ort, der sie nicht tragen kann.
2. **Eine Aktion ist ganz oder gar nicht.** Scheitert der Commit, nimmt `committen` seine Pfade aus dem Index zurück (`git reset -- <pfade>`), stellt geänderte Dateien aus dem Index wieder her und **entfernt** Dateien, die diese Aktion neu angelegt hat. Danach ist `git status --porcelain` so wie vor der Aktion.
3. **Ein Fehlschlag ist sichtbar.** Die Aktion endet mit `Fehler::Intern`, die Meldung nennt die betroffenen Pfade; die Oberfläche zeigt sie im Fuß (ADR-0015). Keine Erfolgsantwort auf eine Aktion ohne Commit.
4. **Die Nachricht wird an einer Stelle gebaut.** Was in eine Nachricht geht (Titel, Board-Titel, Person, Kommentar-Auszug), läuft durch dieselbe Funktion, nicht durch `format!` je Schreibweg.

**Verworfen**:
- **Titel mit Steuerzeichen am Eingang abweisen (400)**: Das Format trägt den Titel, die Datei schreibt und liest ihn; die Grenze wäre erfunden und träfe Importe und Handeingaben. Der Mangel liegt allein in der Nachricht.
- **Nur die Nachricht kürzen, die Halbaktion lassen**: Dann bleibt eine uncommittete Karte liegen und `key`/`neu: false` lügt weiter — der teurere Teil des Fehlers.
- **In einem temporären Arbeitsbaum committen und danach verschieben**: ein zweiter Schreibweg neben `aktion()`; Pfadprüfung (ADR-0008) und Wächter-Merkung (A00008) gingen daran vorbei.
- **Ein eigener ADR-Satz**: Die Frage ist die Durchsetzung der Entscheidung oben, kein neuer Gegenstand (Skill `adr-vorlage`, Hausbrauch N1).

### Durchsetzung (Fitness-Funktion)

- **Test NUL**: `POST /api/aufgaben` mit Titel `a\u0000b` → 201, genau ein Commit, `git log -1 --format=%s` ohne Steuerzeichen, die Datei trägt den Titel.
- **Test Überlänge**: Titel mit ~1 MB → 201, genau ein Commit.
- **Test Rücknahme**: Commit künstlich scheitern lassen (etwa ein scheiternder `pre-commit`-Hook in der Testkopie) → 500, `git status --porcelain` unverändert, die neu anzulegende Datei existiert nicht, kein Commit; derselbe `key` danach → 201 (nicht `200`/`neu: false`).
- **Review-Punkt für `code-reviewer`**: eine Commit-Nachricht, die aus einem Feld mit `format!` gebaut wird, ohne die gemeinsame Funktion, ist ein Befund.

**Grenze**: Länge und Wortlaut der gekürzten Nachricht, die Zahl der Zeichen und die Form der Rücknahme (Git-Befehle gegen gemerkten Vorher-Inhalt) sind Sache des `entwickler`. Ob eine gescheiterte Aktion zusätzlich protokolliert wird, regelt ADR-0001.

## Nachtrag 2026-11-14 N2: Rücknahme auf den Stand von HEAD, die Pfadprüfung gilt auch in `committen` (Karte #43, Bauversuch)

**Anlass**: Karte #43 kommt als Befundkarte zur Architektur-Vorprüfung. N1 entscheidet, **dass** eine gescheiterte Aktion nichts hinterlässt; der uncommittete Bauversuch im Zweig `karte/43` zeigt, **wie** die Rücknahme aussieht, und legt eine Lücke in N1 offen: der Satz „Danach ist `git status --porcelain` so wie vor der Aktion" ist für Pfade nicht erreichbar, die **vor** der Aktion schon uncommittete Änderungen trugen. Der Status bleibt `Akzeptiert`; N2 schärft N1 Punkt 2 und 3 und lässt Punkt 1 (Nachricht) und Punkt 4 (eine Stelle) unberührt.

**Belegt (Code, Bauversuch uncommittet, Zeilenstand 2026-11-14)**:
- `src/git.rs:39–51` `committen` ruft `committen_und_pruefen`; bei Fehler `zuruecknehmen` (`:85–102`): `git reset -q -- <pfade>`, je Pfad `git checkout -q HEAD -- <pfad>`, für Pfade, die `in_head` (`:71–83`, `git ls-tree -r --name-only -z HEAD -- <pfade>`) nicht kennt, `std::fs::remove_file(wurzel.join(pfad))` (`:95`).
- **Probe** (2026-11-14, Wegwerf-Repo): Datei mit uncommitteter Änderung (` M bleibt.md`), dann `git add -A --` → `reset -q --` → `checkout -q HEAD --` wie in `zuruecknehmen` ⇒ `git status --porcelain` leer, Inhalt `alt`. Die Änderung ist weg.
- Die Rücknahme löscht in `src/git.rs`, also außerhalb `src/dienst/`; `Kanban::committen` (`src/dienst/mod.rs:183`) — der Weg von `anhaenge.rs:66`/`:87` und `fieber.rs:115` — prüft keine Pfade. Die zweite Linie aus ADR-0008 sitzt heute allein in `aktion()` (`src/dienst/mod.rs:193`).

### Entschieden

1. **Die Rücknahme stellt den Stand von HEAD her**, für genau die Pfade der Aktion. Ein Pfad, den HEAD nicht kennt, gilt als von dieser Aktion angelegt und verschwindet.
2. **Ein Pfad, der vor der Aktion uncommittete Änderungen trug, verliert sie.** Das ist bewusst: (a) auch im Erfolgsfall gilt Last-Writer-Wins — eine Änderung von außen zwischen Lesen und Schreiben überlebt keine Aktion, die Rücknahme ist nicht der einzige Ort, an dem sie verloren geht; (b) „gemerkter Vorher-Inhalt" (N1, Grenze) verlangt Lesen jeder Datei vor jedem Schreiben und eine zusätzliche Übergabe durch alle Aufrufer (`aktion`, `anhaenge`, `fieber`); (c) uncommittete Reste im Ordner sind **heute** der Rest einer gescheiterten Aktion (genau dieser Mangel), sie zu entfernen ist gewollt. Wer Handarbeit schützt, committet sie vorher.
3. **Die Pfadprüfung der zweiten Linie (ADR-0008) gilt auch in `committen`.** Die Rücknahme ist eine Löschstelle; `git::committen` prüft seine Pfade (`ablage::pfade_pruefen`, `src/ablage.rs:185`) vor `add` und vor jedem Zugriff der Rücknahme, weil direkte Aufrufer nicht durch `aktion()` gehen. Verstoß ⇒ `Fehler::Intern`, Index und Arbeitsbaum unberührt.
4. **Die Meldung sagt, was geschah.** `Fehler::Intern` nennt die Pfade (N1 Punkt 3); die Rücknahme meldet ihren eigenen Fehlschlag (Datei ließ sich nicht entfernen oder wiederherstellen), statt „zurückgenommen" zu behaupten, wenn sie es nicht ist.

**Verworfen**:
- **Vorher-Inhalt merken und byte-genau zurücklegen**: hält N1 wörtlich, kostet aber Lesen jeder Datei vor jedem Schreiben und eine Übergabe an `committen`; der Gewinn tritt nur bei Änderungen ein, die außerhalb kanbanD uncommittet entstehen — die akzeptierte Schwäche oben.
- **Rücknahme in `aktion()` statt in `committen`**: ließe die direkten Commit-Wege (`anhaenge.rs`, `fieber.rs`) halb; N1 legt sie bewusst in `committen`.
- **Nur die Nachricht bereinigen, die Halbaktion lassen**: in N1 verworfen, bleibt verworfen.

### Durchsetzung (Fitness-Funktion)

- Die drei Proben aus N1 bleiben (NUL, Überlänge, gescheiterter Commit mit leerem Status und `key` → 201).
- **Vorher schmutzig**: Datei mit uncommitteter Änderung, Commit scheitert (Hook) ⇒ die Datei hat den Stand von HEAD, `git status --porcelain` ist leer — der Test hält die akzeptierte Schwäche fest, damit sie nicht unbemerkt kippt.
- **Pfad außerhalb**: `committen` mit `../x.md` ⇒ `Fehler::Intern`, Index und Arbeitsbaum unberührt (zweite Linie in `committen`).
- **Review-Punkt** (`code-reviewer`): eine Rücknahme, die einen Pfad außerhalb von `pfade` anfasst, oder eine Meldung, die „zurückgenommen" ohne Prüfung behauptet, ist ein Befund.

**Grenze**: ob `committen` die Prüfung selbst ruft oder ein gemeinsamer Helfer sie für `aktion` und `committen` bereitstellt, ist Sache des `entwickler`; Länge und Wortlaut der Nachricht bleiben bei N1.

## Nachtrag 2026-11-15 N3: Wiederöffnen mit `board` ist ein Umzug — die Zeilen der anderen Boards gehen im selben Commit (Karte #45)

**Status des Nachtrags**: Zurückgezogen (Betreiber 2026-11-15) — nie gebaut; Karte #45 wird ohne Bau geschlossen, R00158 zurückgezogen, I0145 verworfen. Der Status des ADR bleibt `Akzeptiert`; N1 und N2 gelten unverändert. Der Text ab „Anlass“ ist der Stand vor dem Rückzug und bleibt als Geschichte unverändert stehen — er ist **kein Soll** mehr.

**Grund** (Betreiber 2026-11-15, wörtlich): „Archiviert bedeutet archiviert, mit Blick auf alle Boards auf denen sie ist, ist die Karte im Archiv. Wird sie aus dem Archiv geholt, dann ist sie wieder auf allen Boards auf denen sie vorher auch war.“ Für den Fall der Karte (ein Agent öffnet eine archivierte Karte über ihren Schlüssel wieder und nennt ein Board, auf dem sie vorher nicht lag) hat er gewählt: Sie liegt wieder auf allen früheren Boards und zusätzlich auf dem genannten Board — das heutige Verhalten; #45 ist damit kein Fehler. Seine Entscheidung vom 2026-11-13 („alte Board-Zeile entfernen; eine Karte liegt auf genau einem Board“), auf der dieser Nachtrag und die Entscheidungen des `product-owner` #45 A1–A6 beruhen, ist aufgehoben.

Es gilt weiter das Verhalten von R00098: Wiederöffnen über `key` nimmt `archived` zurück; die Karte liegt wieder auf allen Boards, auf denen sie vorher lag, und mit `board` zusätzlich oben auf dem genannten Board. Kein Umzug, keine neue 423 auf diesem Weg, die Rückkehr-Grenze (409) bleibt wie in `tests/fremdschluessel.rs` (Test `grenze_auf_dem_zweiten_board_beim_wiederoeffnen`) festgehalten.

### Geltende Regel: „Archiviert“ ist eine Eigenschaft der Karte (Betreiber 2026-11-15)

1. **„Archiviert“ gehört der Karte, nicht einem Board.** Es steht als `archived` in der Aufgabendatei und gilt damit für alle Boards, auf denen die Karte liegt; einen Archivstand je Board gibt es nicht.
2. **Archivieren und Zurückholen ändern keine Board-Zeile.** Beide schreiben nur die Aufgabendatei; die Zeilen der Karte bleiben in jeder Board-Datei stehen und zählen nur nicht, solange sie archiviert ist. Nach dem Zurückholen liegt die Karte wieder auf allen Boards, auf denen sie vorher lag.
3. **Wiederöffnen über `key` ist Zurückholen plus Kommentar** (Entscheidung oben, „aus den Kernen“). Nennt die Anfrage ein `board`, kommt ein **Hineinlegen** auf dieses Board dazu (oben in die Spalte; lag die Karte dort schon in einer anderen Spalte, wechselt sie auf diesem Board die Spalte). Die Zeilen der übrigen Boards bleiben; „mehrere Boards je Aufgabe“ (Vision) gilt auch hier.
4. **Abgrenzung**: Eine Board-Zeile entfernen nur „vom Board nehmen“ (`von_board_nehmen`) und „endgültig löschen“ (ADR-0024, alle Zeilen samt Datei) — beide sind ausdrücklich etwas anderes als Archivieren. Das Archivieren eines **Boards** (ADR-0022, `archived` im Frontmatter der Board-Datei) ist eine Eigenschaft des Boards und berührt den Archivstand seiner Karten nicht.

**Belegt (Code)**, kanbanD `ab06049` (gelesen 2026-11-15, nicht neu geprobt — getragen von der bestehenden Suite):
- `archivieren` (`src/dienst/archiv.rs:7–28`): „Setzt `archived` auf heute und beendet laufende Timer; Datei und Board-Zeile bleiben“; geschrieben wird über `aufgabe_schreiben` genau ein Schritt, die Aufgabendatei (`src/dienst/aufgabe_aendern.rs:9–16`).
- `zurueckholen` (`src/dienst/archiv.rs:31–37`) und der Kern `zurueckgeholt` (`:152–159`): die Aufgabe verliert `archived`, derselbe eine Schritt. `mehrere_archivieren` (`:107–148`) sammelt für beide Richtungen nur Aufgabendateien (`:131`).
- Zählung: „sie stehen weiter in der Board-Datei, zählen aber nicht“ (`src/dienst/zugregeln.rs:11–14`); Prüfung der Rückkehr auf **jedem** Board der Karte in `zurueckholen_pruefen` (`:116`) und beim Wiederöffnen in `rueckkehr_pruefen` (`src/dienst/aufgabe_anlegen.rs:233–240`, Aufruf `:203`).
- Wiederöffnen: `wieder_geoeffnet` (`src/dienst/aufgabe_anlegen.rs:285–289`) ruft `zurueckgeholt` und kommentiert; `schreiben` (`:191–229`) schreibt nur mit `board` eine Board-Datei, und zwar allein die genannte (`:204–225`, `oben_einordnen` `:214`).
- Festgehalten durch `tests/fremdschluessel.rs:477` (`grenze_auf_dem_zweiten_board_beim_wiederoeffnen`: die Rückkehr auf dem früheren Board zählt mit, Agent 409, nichts geschrieben) und die Angriffsmatrix `Dokumentation/Sicherheit/angriffsmatrix-R00158-wiederoeffnen-mit-board.md` (geprobter Beleg des heutigen Verhaltens).

**Durchsetzung**: Review-Punkt (`architektur-reviewer`, `code-reviewer`) — ein Board-Schritt in `archivieren`, `zurueckholen` oder `mehrere_archivieren`, ein Archivstand je Board oder das Entfernen einer Zeile von einem nicht genannten Board im Wiederöffnen ist ein Befund.

### Zurückgezogener Text (Stand vor dem 2026-11-15, kein Soll)

**Anlass**: Karte #45 („Wiederöffnen auf anderem Board lässt Karte im alten ‚Fertig‘“, aus Code-Review #4). Betreiber-Entscheidung 2026-11-13 (Kartenkommentar): die alte Board-Zeile wird entfernt, im selben Commit wie die neue. Der Status bleibt `Akzeptiert`; der Nachtrag sagt, **wie** der Schritt in die Entscheidung oben passt und welche Regeln an den verlassenen Boards gelten. **Entscheider**: Claude (autonom, architekt, Auftrag des Directors); Geltungsbereich, Sperren an den verlassenen Boards, Commit-Nachricht und geänderte Testerwartung hat der `product-owner` am 2026-11-15 entschieden (`AI-Team/po-entscheidungen.md`, #45 A1–A6) — der Nachtrag trägt keine offene Frage.

**Belegt (Code)**, kanbanD `54cbe00` (gelesen 2026-11-15):
- Wiederöffnen läuft im Anlegeweg: `anlegen_gesperrt` (`src/dienst/aufgabe_anlegen.rs:122`) findet den Schlüssel an einer archivierten Karte (`:145`), `wieder_geoeffnet` (`:285`) nimmt `archived` zurück und kommentiert; `schreiben` (`:191`) liest **nur** das Board der Anfrage (`:205`), legt die Karte dort mit `Board::oben_einordnen` oben ein (`:214`) und ruft einmal `aktion()` (`:228`).
- `oben_einordnen` (`src/modell/board.rs:388`) nimmt die Karte aus jeder anderen Spalte **dieses** Boards (`abnehmen`, `:400`); die Dateien der übrigen Boards fasst niemand an. Dort steht die Zeile weiter — archivierte Karten bleiben in der Board-Datei stehen und zählen nur nicht (`archivieren`, `src/dienst/archiv.rs:7`; `zugregeln.rs:11`). Hier entsteht „auf zwei Boards zugleich“.
- Der Bestand weiß das: `rueckkehr_pruefen` (`aufgabe_anlegen.rs:233`) zählt die Karte auf den übrigen Boards wieder mit (409 für Agenten), `tests/fremdschluessel.rs:477` hält es fest.
- **Mehrere Boards sind gewollt**: Vision Z. 74–76 („Dieselbe Aufgabe darf auf mehreren Boards liegen“), `README.md:49`, R00020, R00123 (Verlauf je Board), `zuordnung.rs::auf_board_legen`. Eine Invariante „eine Karte liegt auf genau einem Board“ gibt es im Modell nicht und darf es ohne Fortschreibung der Vision nicht geben.
- Das Muster „Zeile aus mehreren Board-Dateien in einem `aktion()`“ ist gebaut: `endgueltig_loeschen` (`src/dienst/archiv.rs:54–60`, ADR-0024). `von_board_nehmen` (`src/dienst/zuordnung.rs:56`) sperrt und committet selbst und ist deshalb nicht schachtelbar (Kontext oben).
- R00098 FA (Z. 37): „Das Wiederöffnen ist kein Herausnehmen im Sinne von R00097 … auch mit `board`“; `schreiben` prüft entsprechend nur die Grenze (`zug_mit_rueckkehr_pruefen`, `:217`), keine Entnahmesperre.

### Optionen

| | Weg | Stärke | Schwäche |
|---|---|---|---|
| A | `schreiben` nimmt die Karte im Speicher von jedem anderen Board (`Board::abnehmen`) und hängt je Board einen Schreib-Schritt an dasselbe `aktion()` | ein Commit, eine Sperre, kein neuer Schreibweg; Kern und Muster vorhanden (ADR-0024) | der Anlegeweg liest die ganze Boardliste; ein unlesbares Board macht die Zusage unprüfbar (siehe 4) |
| B | `von_board_nehmen` wiederverwenden (Kern + Hülle oder zwei Aufrufe) | ein Name für „vom Board nehmen“, 403-Regel inklusive | zwei Commits oder Umbau einer Hülle, deren Kern (`abnehmen`) schon frei liegt; die 403 widerspräche R00098 FA Z. 37 |
| C | Abweisen mit 409, solange die Karte auf einem anderen Board liegt | nichts verschwindet still von einem fremden Board | widerspricht der Betreiber-Entscheidung; jeder Sensor müsste erst aufräumen (Option A des ADR, verworfen) |

### Entschieden (Option A)

1. **Wiederöffnen mit `board` ist ein Umzug.** Nach der Aktion liegt die wieder geöffnete Karte auf **genau dem Board der Anfrage**; ihre Zeile verschwindet aus **jedem** anderen Board des Ordners (auch aus einem archivierten Board, auch wenn sie dort mehrfach steht — `abnehmen` nimmt alle Vorkommen). Ohne `board` bleibt alles wie bisher: die Karte kehrt dorthin zurück, wo sie liegt, auch auf mehreren Boards.
2. **Die Regel gilt für diesen Weg, nicht für das Modell** (entschieden, `product-owner` 2026-11-15, #45 A1: enge Lesart der Betreiber-Entscheidung vom 2026-11-13). „Genau ein Board“ gilt nur nach dem Wiederöffnen mit `board`. „Dieselbe Aufgabe darf auf mehreren Boards liegen“ (Vision) bleibt; Auflegen, Bewegen, Archivieren, Zurückholen und das Wiederöffnen ohne `board` ändern sich nicht. Die allgemeine Invariante wäre eine Fortschreibung der Vision, keine Auslegung dieser Karte.
3. **Ein Commit, ein `aktion()`**: Aufgabendatei, Zielboard und jedes verlassene Board sind Schritte derselben Aktion; jede Board-Datei kommt **genau einmal** vor (das Zielboard nie zusätzlich als verlassenes — `aktion()` weist doppelte Pfade ab, `mod.rs:193`), auch bei `mehrere` mit Karten von verschiedenen Boards. Scheitert der Commit, stellt die Rücknahme (N1/N2) alle Dateien her.
4. **Unlesbares Board ⇒ 423, nichts geschrieben.** Ist beim Wiederöffnen mit `board` eine Board-Datei des Ordners defekt, ist nicht bestimmbar, ob die Karte dort liegt; die Zusage aus 1 wäre unprüfbar. Die Aktion endet mit `Fehler::Defekt` (Meldung nennt die Datei) — für **jede** Art, weil der Grund die Zusage ist, nicht eine Sperre. Ordnung nach ADR-0003 N2: 423 vor 409. **Die 423 gilt nur auf diesem Weg** (#45 A4, Kriterium 6): in derselben Lage laufen das Anlegen mit unbekanntem Schlüssel (201), der Schlüssel an einer offenen Karte (200 ohne Commit) und das Wiederöffnen ohne `board` wie heute — eine defekte Board-Datei hält nicht alle Sensoren des Ordners an.
5. **Keine Entnahmesperre an den verlassenen Boards.** Wie im selben Board (R00098 FA Z. 37, AK „Eigentümer“) ist das Wiederöffnen kein Herausnehmen: ein Agent bekommt keine 403, auch wenn die archivierte Karte auf dem anderen Board in einer Menschen-Spalte liegt, **und auch bei board-weiter Sperre (fail-safe, R00120)** — entschieden, `product-owner` 2026-11-15, #45 A2: die board-weite Sperre ist dieselbe Entnahmeregel für eine nicht bestimmbare Spalte; was die bestimmbare Menschen-Spalte nicht sperrt, sperrt sie auch nicht. Die Karte ist dort archiviert, zählt nicht und geht nicht verloren — sie liegt offen auf dem Zielboard. Am Zielboard gelten Grenze und Eigentümer wie bei jedem Hineinlegen.
6. **Grenzen**: geprüft wird das Zielboard wie bisher (`zug_mit_rueckkehr_pruefen`, Agent 409, Mensch ohne Warnung). Die verlassenen Boards verlieren die Karte und brauchen keine Grenzprüfung; `rueckkehr_pruefen` gilt nur noch ohne `board`. Der bisherige Fall „volle alte Spalte auf dem anderen Board ⇒ 409“ (`grenze_auf_dem_zweiten_board_beim_wiederoeffnen`, `tests/fremdschluessel.rs:477`) kehrt sich um: die Karte zieht um, 200. Das ist die **einzige** geänderte Erwartung der bestehenden Suite und ausdrückliches Kriterium (#45 A6); die Rückkehr-Grenze (409) bleibt für das Wiederöffnen ohne `board` durch einen Test gedeckt.
7. **Die Commit-Nachricht bleibt unverändert** „#n erneut gefunden: wieder geöffnet“ (R00098) und nennt die verlassenen Boards nicht (#45 A3): der Commit trägt die geänderten Board-Dateien selbst. Gebaut wird sie über die gemeinsame Funktion (N1 Punkt 4).

**Akzeptierte Schwäche**: Eine Karte, die ein Mensch bewusst auf zwei Boards gelegt hat, liegt nach einem Wiederöffnen mit `board` nur noch auf einem — still, sichtbar nur im Verlauf (ADR-0021) und im Commit. Und ein defektes Board, das mit der Karte nichts zu tun hat, hält das Wiederöffnen mit `board` auf, bis es repariert ist.

**Verworfen**: B und C (Tabelle); **clientseitig** erst `DELETE …/boards/{slug}/aufgaben/{nr}`, dann anlegen — zwei Commits, dazwischen ein fremder Zug (Option A des ADR).

### Durchsetzung (Fitness-Funktion)

- **Umzug**: #7 archiviert in „Fertig“ auf `fabrik`, `POST /api/aufgaben {key, board: "zweit", spalte: "Eingang"}` ⇒ 200, #7 oben in „Eingang“ von `zweit`, in **keiner** Spalte von `fabrik`, genau ein Commit mit Aufgabendatei und beiden Board-Dateien, `git status --porcelain` leer.
- **Drei Boards / mehrfach**: #7 auf `fabrik` in zwei Spalten und auf `privat` ⇒ danach nur auf `zweit`; drittes, unbeteiligtes Board byteweise unverändert.
- **Gleiches Board, ohne `board`**: Verhalten wie R00098 (ein Board-Schritt bzw. keiner); mit `board` = Board der Karte bleibt die Zeile auf weiteren Boards **nicht** stehen, ohne `board` bleibt sie.
- **Defekt**: defekte Board-Datei im Ordner, Wiederöffnen mit `board` ⇒ 423 (Mensch und Agent), #7 bleibt archiviert, kein Commit. **Nur dieser Weg**: in derselben Lage Anlegen mit unbekanntem Schlüssel ⇒ 201, Schlüssel an einer offenen Karte ⇒ 200 ohne Commit, Wiederöffnen ohne `board` ⇒ wie bisher.
- **Grenze am Ziel**: Agent über der Grenze der Zielspalte ⇒ 409, auch die Zeile auf dem alten Board steht noch, kein Commit.
- **Keine 403 an verlassenen Boards**: Agent, #7 archiviert in einer Menschen-Spalte von `fabrik` ⇒ 200 mit Umzug; ebenso bei board-weiter Sperre von `fabrik` (R00120).
- **Geänderte Erwartung**: `grenze_auf_dem_zweiten_board_beim_wiederoeffnen` (`tests/fremdschluessel.rs:477`) erwartet statt 409 jetzt 200, #7 auf `zweit`, nicht mehr in „Fertig“ von `fabrik` — die einzige geänderte Erwartung der bestehenden Suite. **Rückkehr-Grenze**: Wiederöffnen **ohne** `board` in eine volle Spalte ⇒ Agent 409, nichts geschrieben; ein Test hält `rueckkehr_pruefen` weiter fest.
- **Nachricht**: `git log -1 --format=%s` nach dem Umzug ist „#7 erneut gefunden: wieder geöffnet“.
- **Review-Punkt** (`architektur-reviewer`, `code-reviewer`): ein zweites `aktion()`/`committen` im Wiederöffnen, ein Aufruf einer öffentlichen, selbst sperrenden Methode aus `schreiben`, oder das Entfernen der Zeile auch **ohne** `board` ist ein Befund.

**Grenze**: Nicht Gegenstand dieses Nachtrags sind die allgemeine Regel „genau ein Board“, das Aufräumen bestehender Doppellagen im Bestand, ein neues Feld in der Antwort (verlassene Boards) und die Oberfläche (#45 A4, „Nicht hinein“). Wie `schreiben` die Boardliste liest und die Schritte ordnet, ist Sache des `entwickler`.

## Quellen / Bezuege

- `src/dienst/archiv.rs` (`zurueckholen`), `src/dienst/mod.rs` (`aktion`, `gesperrt`)
- ADR-0002, ADR-0004
- Nachtrag N1: Karte #43 (Review #4); `src/dienst/mod.rs:191–213`, `src/git.rs:31–48`, `src/dienst/aufgabe_anlegen.rs` (Nachricht aus dem Titel); R00098 (`key`, `neu: false`); ADR-0001, ADR-0008, ADR-0015
- Nachtrag N2: Karte #43 (Architektur-Vorprüfung 2026-11-14, uncommitteter Bauversuch `karte/43`); `src/git.rs:39–51, 71–102`, `src/dienst/mod.rs:183/193`, `src/ablage.rs:185`, `src/dienst/anhaenge.rs:66/87`, `src/dienst/fieber.rs:115`; Probe 2026-11-14 (Wegwerf-Repo); ADR-0008, ADR-0015
- Nachtrag N3: Karte #45 (Code-Review #4, Betreiber-Entscheidung 2026-11-13); `AI-Team/po-entscheidungen.md` Z. 277–282 (#45 A1–A6, 2026-11-15); `src/dienst/aufgabe_anlegen.rs:122/145/191–229/233/285`, `src/modell/board.rs:388/400`, `src/dienst/archiv.rs:7/54–60`, `src/dienst/zuordnung.rs:56`, `src/dienst/zugregeln.rs:11/102`, `src/dienst/mod.rs:193`, `tests/fremdschluessel.rs:477`; Vision Z. 74–76, R00098 FA Z. 37, R00120; ADR-0003 N2, ADR-0021, ADR-0024
- Rückzug von N3 und Regel „Archiviert ist eine Eigenschaft der Karte“: Betreiber-Entscheidung 2026-11-15 (Auftrag des Directors zu Karte #45); `src/dienst/archiv.rs:7–37/107–148/152–159`, `src/dienst/aufgabe_aendern.rs:9–16`, `src/dienst/zugregeln.rs:11–14/116`, `src/dienst/aufgabe_anlegen.rs:191–229/233–240/285–289`, `tests/fremdschluessel.rs:477`; ADR-0022, ADR-0024, R00017, R00098
