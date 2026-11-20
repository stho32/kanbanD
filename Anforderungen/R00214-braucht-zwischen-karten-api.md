---
id: R00214
status: Neu
datum: 2026-11-20
---

# R00214: Braucht zwischen Karten — Deutung, Prüfung an der Tür und Lesefeld in der API

## Beschreibung

Karte #228 „Braucht zwischen Karten“, Scheibe **S1 API** von [ADR-0035](../Dokumentation/ADRs/0035-braucht-zwischen-karten-als-label.md) (Entscheidung L, Punkte 1–6 und 8, Schnitt S1). Produktvorgabe po-entscheidungen Z. 431 („ein Träger, nicht zwei“) und Z. 445 (#228 kommt nach #226 und vor die Factory-Sperre).

Das Label `braucht:<n>` an einer Aufgabe ist der eine Träger einer Abhängigkeit: „diese Aufgabe wartet auf #n“. kanbanD deutet es danach selbst:

- **Lesen**: jede Aufgabe trägt in der API das abgeleitete, nur lesbare Feld `braucht: [{nummer, titel, erledigt}]`; der Filter `wartet=ja|nein` findet Aufgaben mit mindestens einer offenen Abhängigkeit.
- **Schreiben**: neu hinzukommende `braucht:`-Labels prüft kanbanD an der Tür (Form, Selbstbezug, unbekannte Nummer, Kreis); jeder Fehler ergibt 400, und nichts wird geschrieben. Unverändert mitgeschickte Labels werden nicht geprüft.

Die Darstellung („wartet auf #n“ auf Karte und im Aufgabenfenster) ist **nicht** Teil dieser Anforderung; sie folgt als eigene Karte (Scheibe S2) und braucht die Artboards D0002/D0003. Bis dahin bleibt das Label als gewöhnlicher Chip sichtbar wie heute. Board-übergreifend über Ordner hinweg gilt die Abhängigkeit nicht (ADR-0035 Punkt 6).

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Aufgaben sind der Stand“: „`Braucht`-Beziehungen bleiben echte Abhängigkeiten zwischen Karten“ (Vision Z. 106–107).

### Domänenbezug

Begriffe: Aufgabe, Board, Spalte, Label, archiviert. „Erledigt“ hat denselben Sinn wie bei `POST /api/aufgaben/erledigen`: in der letzten Spalte oder archiviert. Ein Glossar-Eintrag für „Abhängigkeit (braucht)“ fehlt (Missing-Docs).

## Geschäftlicher Nutzen

Seit #226 gibt es kein „wartet auf“ mehr; die Abhängigkeiten stehen nur noch als stummer Text an den Karten (Stand 2026-11-20: 47 Labels `braucht:<Zahl>` in 41 Aufgabendateien der Ordner kanbanD und JoinPuyaApp, gezählt vom planer mit `grep` über das Frontmatter). Mit dieser Anforderung kann ein Agent per API fragen, worauf eine Karte wartet und ob das erledigt ist, und er kann keine kaputte Abhängigkeit mehr schreiben. Die Factory und alle Bestandsdateien laufen unverändert weiter, weil der Träger derselbe bleibt.

## Funktionale Anforderungen

**Deutung**
- Ein Label ist eine Abhängigkeit, wenn es ohne Groß/Klein `braucht:<n>` lautet, `<n>` eine ganze Zahl ≥ 1 ohne führende Null und ohne Leerzeichen (nach dem heutigen Trimmen der Labels).
- Ein Label mit dem Präfix `braucht:` in anderer Form (`braucht:abc`, `braucht:kd#12`, `braucht:012`, `braucht:0`, `braucht: 3`) bleibt beim Lesen ein gewöhnliches Label ohne Bedeutung.
- Mehrere Labels ergeben mehrere Abhängigkeiten in der Reihenfolge der Labels; dieselbe Nummer erscheint einmal (beim ersten Vorkommen).
- **Erledigt** ist die gebrauchte Aufgabe, wenn sie archiviert ist oder auf einem ihrer Boards in dessen letzter Spalte liegt; liegt sie auf keinem Board und ist nicht archiviert, ist sie offen. Die Entscheidung teilt sich die Funktion mit `erledigen` (ADR-0035 Pre-Mortem c).

**Lesen**
- `GET /api/aufgaben` und `GET /api/aufgaben/{nr}` liefern je Aufgabe `braucht: [{nummer, titel, erledigt}]`; ohne Abhängigkeit `[]`.
- Fehlt die Aufgabendatei zu einer Nummer, steht dort `titel: null, erledigt: false`.
- Ein Feld `braucht` im Rumpf von `POST /api/aufgaben`, `POST /api/aufgaben/mehrere`, `PATCH /api/aufgaben/{nr}` oder `PATCH /api/aufgaben/mehrere` ergibt 400 „braucht über labels setzen (braucht:<nr>)“; nichts wird geschrieben.

**Filter**
- `GET /api/aufgaben?wartet=ja` liefert die Aufgaben mit mindestens einer Abhängigkeit, die nicht erledigt ist (auch eine mit fehlender Datei); `wartet=nein` die übrigen. Andere Werte → 400. Wie jeder Filter gilt er mit den übrigen Parametern UND und setzt `archivierte=nein` voraus, wenn nichts anderes genannt ist.
- `label=braucht:226` und `label=braucht:*` bleiben unverändert.

**Prüfung an der Tür** (`POST /api/aufgaben`, `POST /api/aufgaben/mehrere`, `PATCH /api/aufgaben/{nr}`, `PATCH /api/aufgaben/mehrere`)
- Geprüft wird nur ein `braucht:`-Label, das in der gespeicherten Liste der Aufgabe noch nicht steht (Vergleich ohne Groß/Klein); unverändert mitgeschickte Labels nie.
- Fehler und Meldungen (je 400, kein Commit, keine Datei geändert):
  - andere Form mit dem Präfix: „braucht: erwartet eine Kartennummer (braucht:12)“;
  - Selbstbezug: „#n kann nicht auf sich selbst warten“;
  - Nummer ohne Aufgabendatei im Ordner (archivierte zählen als vorhanden): „#n gibt es nicht (braucht:n)“ — Wortlaut Vorschlag, Frage an den PO;
  - Kreis über die gedeuteten Labels aller Aufgaben des Ordners nach dem Schreiben: „braucht:n schlösse einen Kreis: #a → #b → #a“ — Kreis in Pfeilform nach ADR-0035, übriger Wortlaut Vorschlag, Frage an den PO.
- Bei mehreren Fehlern nennt die Meldung den ersten in der Reihenfolge der Labels (bei `mehrere`: der Änderungen) mit dem Vorsatz `#<nummer>: ` wie die heutigen Meldungen von `PATCH /api/aufgaben/mehrere`.
- In `PATCH /api/aufgaben/mehrere` gilt die Kreisprüfung gegen den Stand nach allen Änderungen des Aufrufs.
- `POST /api/aufgaben/{nr}/duplizieren` übernimmt die Labels unverändert und prüft sie nicht (sie sind für die Kopie mitgeschickter Bestand, nicht neu eingegeben).

**Beschreibung der API**
- `/api/openapi.json` beschreibt `braucht` als nur lesbares Feld der Aufgabe (`readOnly`, Elemente `nummer`, `titel` nullable, `erledigt`) und den Parameter `wartet` mit den Werten `ja`, `nein`; `/api/endpunkte` nennt Filter, Feld und die vier Abweisungen an `POST` und `PATCH`.

## Nicht-funktionale Anforderungen

- Verträglichkeit: kein Formatwechsel; kein Start und kein Lesen schreibt eine Datei oder einen Commit. Die Werkzeuge der Factory bleiben unverändert (0 Änderungen in `werkzeuge/`).
- Leistung: Die Kreisprüfung liest die Labels aller Aufgaben des ohnehin geladenen Ordners einmal je Schreibaufruf (linear, ADR-0035 Konsequenzen). Keine eigene Zeitgrenze.
- Sicherheit: Labels sind Eingaben von außen; die Meldungen nennen nur Nummern und den festen Text, nie den Rest eines abgewiesenen Labels.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API, Fälle „von Hand“ mit Git): Ordner mit Board `e` und den Spalten „Offen“, „In Arbeit“, „Fertig“ (letzte). Aufgaben #1 „Gerüst“ in Offen, #2 „Bau“ in Offen, #3 „Doku“ in In Arbeit, #4 „Alt“ archiviert, #5 „Frei“ in Offen ohne Labels. Am Stand vor der Karte kennt die Antwort kein Feld `braucht`, `wartet=ja` ergibt 400 (unbekannter Filter) und `braucht:999` wird angenommen.

### Deutung und Lesefeld

- [ ] **AK 1** Gegeben #2 mit Labels `[feature, braucht:1]`. Wenn ein Agent `GET /api/aufgaben/2` und `GET /api/aufgaben` liest, dann trägt #2 in beiden `braucht: [{nummer: 1, titel: "Gerüst", erledigt: false}]`, und #5 trägt `braucht: []`.
- [ ] **AK 2** Gegeben #2 mit `braucht:1` und #3 mit `braucht:4`. Wenn #1 nach „Fertig“ gezogen wird, dann zeigt #2 `erledigt: true`; zurück nach „Offen“ wieder `false`; nach Archivieren von #1 `true`. #3 zeigt für #4 (archiviert) `erledigt: true`. Rechenbeispiel: „erledigt“ = archiviert ODER letzte Spalte — #1 in „In Arbeit“, nicht archiviert → `false`.
- [ ] **AK 3** Gegeben #2, von Hand mit den Labels `[BRAUCHT:3, braucht:1, Braucht:1, braucht:abc, braucht:kd#12, braucht:012, braucht:0, braucht:999]` committet (zu 999 gibt es keine Datei). Wenn ein Agent #2 liest, dann ist die Antwort 200 mit `braucht: [{nummer: 3, …}, {nummer: 1, …}, {nummer: 999, titel: null, erledigt: false}]` in dieser Reihenfolge, `labels` enthält alle acht Einträge unverändert, und die Datei ist bytegleich.
- [ ] **AK 4** Gegeben die Ausgangslage. Wenn ein Agent `PATCH /api/aufgaben/5` mit `{"braucht": [{"nummer": 1}]}` schickt, dann ist die Antwort 400 „braucht über labels setzen (braucht:<nr>)“, kein Commit entsteht und die Datei ist bytegleich; ebenso `POST /api/aufgaben` mit `braucht` (keine neue Datei) und `PATCH /api/aufgaben/mehrere` mit `braucht` in einer Änderung.

### Filter

- [ ] **AK 5** Gegeben #2 mit `braucht:1`, #3 mit `braucht:4`, #1 in „Offen“. Wenn ein Agent `wartet=ja` abfragt, dann liefert die Liste genau #2; `wartet=nein` genau #1, #3, #5 (#4 als archivierte nicht). Nach dem Zug von #1 nach „Fertig“ liefert `wartet=ja` keine Aufgabe. `wartet=ja&board=e` verknüpft UND; `wartet=vielleicht` ergibt 400; `label=braucht:1` liefert weiter genau #2.
- [ ] **AK 6** Gegeben #5, von Hand mit `braucht:999` committet (keine Datei 999). Wenn ein Agent `wartet=ja` abfragt, dann ist #5 in der Liste.

### Prüfung an der Tür

- [ ] **AK 7** Gegeben die Ausgangslage. Wenn ein Agent an #5 je einzeln `labels: [braucht:x]`, `[braucht:012]`, `[braucht:0]`, `[braucht: 1]` und `[BRAUCHT:kd#12]` schickt, dann ist jede Antwort 400 „braucht: erwartet eine Kartennummer (braucht:12)“, kein Commit, Datei bytegleich. `labels: [braucht]` und `[brauchtnix]` (ohne Präfix `braucht:`) ergeben 200 als gewöhnliche Labels.
- [ ] **AK 8** Gegeben die Ausgangslage. Wenn ein Agent an #5 `labels: [braucht:5]` schickt, dann ist die Antwort 400 „#5 kann nicht auf sich selbst warten“, kein Commit.
- [ ] **AK 9** Gegeben die Ausgangslage. Wenn ein Agent an #5 `labels: [braucht:999]` schickt, dann ist die Antwort 400, die Meldung nennt `#999`, kein Commit; `labels: [braucht:4]` (archiviert) ergibt 200 mit genau einem Commit.
- [ ] **AK 10** Gegeben #2 mit `braucht:1`. Wenn ein Agent an #1 `labels: [braucht:2]` schickt, dann ist die Antwort 400, die Meldung enthält den Kreis `#1 → #2 → #1`, kein Commit. Längerer Kreis: mit #3 `braucht:2` und #2 `braucht:1` ergibt `braucht:3` an #1 eine Meldung mit `#1 → #3 → #2 → #1`. Im selben Aufruf: `PATCH /api/aufgaben/mehrere` mit #1 `[braucht:5]` und #5 `[braucht:1]` ergibt 400, keine der beiden Dateien ist geändert.
- [ ] **AK 11** Gegeben #3, von Hand mit `[braucht:abc, braucht:888]` committet (keine Datei 888). Wenn ein Agent an #3 `labels: [braucht:abc, braucht:888, prio]` schickt, dann ist die Antwort 200 und die Datei trägt die drei Labels (unverändert mitgeschickt wird nicht geprüft); `labels: [braucht:abc, braucht:888, braucht:777]` ergibt 400 mit `#777` und ohne Nennung von `abc` oder `888`. Gegenprobe ADR-0035 Pre-Mortem d: #2 mit `braucht:1`, #1 per `DELETE` gelöscht → `labels: [braucht:1, ui]` an #2 ergibt 200.
- [ ] **AK 12** Gegeben die Ausgangslage. Wenn ein Agent `POST /api/aufgaben` mit `{titel: "Neu", labels: [braucht:1]}` schickt, dann ist die Antwort 201 und die neue Aufgabe trägt `braucht: [{nummer: 1, titel: "Gerüst", erledigt: false}]`; mit `labels: [braucht:999]` ergibt es 400, es entsteht keine Aufgabendatei und kein Commit; `POST /api/aufgaben/mehrere` mit einem solchen Eintrag legt keinen der Einträge an. `POST /api/aufgaben/3/duplizieren` mit #3 aus AK 11 ergibt 201, die Kopie trägt `braucht:888` unverändert.

### Beschreibung der API

- [ ] **AK 13** Gegeben das gestartete Programm. Wenn ein Agent `/api/openapi.json` liest, dann hat das Schema der Aufgabe die Eigenschaft `braucht` mit `readOnly: true` und den Elementen `nummer`, `titel` (nullable), `erledigt`, und `GET /api/aufgaben` hat den Parameter `wartet` mit den Werten `ja`, `nein`. `GET /api/endpunkte` nennt bei `GET /api/aufgaben` den Filter `wartet` und bei `POST`/`PATCH` die Abweisungen Form, Selbstbezug, unbekannte Nummer, Kreis und das Feld `braucht`.

### Bestand und Factory

- [ ] **AK 14** Gegeben Kopien der Ordner `~/Projekte/Kanban-Boards/kanbanD-Kanbanboard` und `JoinPuyaApp-Kanbanboard` in der eigenen Ablage (Stand 2026-11-20: 41 Aufgabendateien mit 47 Labels `braucht:<Zahl>`; beim Bau neu zählen). Wenn das Programm darauf startet und `GET /api/aufgaben?archivierte=ja` gelesen wird, dann ist die Antwort 200, jede Aufgabe mit einem solchen Label trägt dieselben Nummern in `braucht` wie in `labels` (Zahl der Einträge gleich der Zählung), die Zahl der Commits bleibt gleich, alle Dateien sind bytegleich (SHA-256 über `git ls-files`), und im Log steht keine Fehler- oder Warnzeile.
- [ ] **AK 15** Gegeben eine Instanz mit dem Stand der Karte auf freiem Port. Wenn die Proben der Factory (`proben/alle.sh` im Factory-Repo) gegen diese Instanz laufen, dann sind sie grün, ohne Änderung an `werkzeuge/`.

## Betroffene Verzeichnisstruktur

- Modell und Deutung: `src/modell/aufgabe.rs` (Labels → Nummern als reine Funktion; Feld `braucht` in der Antwort), die Erledigt-Entscheidung aus `src/dienst/erledigen.rs:145–152` herausgelöst und geteilt.
- Dienste: `src/dienst/aufgabe_anlegen.rs`, `src/dienst/aufgabe_aendern.rs` (Prüfung an der Tür, Vorbild „unverändert mitgeschickt wird nicht geprüft“ bei `klasse`, R00195), `src/dienst/aufgabenfilter.rs` (`wartet`; `passt` sieht heute nur eine Aufgabe und ein Board, braucht für `wartet` die Lage aller Aufgaben).
- Web: `src/web/endpunkte.rs:70`, `:71`, `:72`, `:75`, `:80`, OpenAPI über `#[utoipa::path]` und `ToSchema` (`src/web/openapi.rs`).
- Doku: Architektur `Dokumentation/Architektur/A00005-format.md` (Label `braucht:<n>` mit Bedeutung, kein neuer Schlüssel), `A00006-modell.md` (abgeleitetes Feld, Erledigt-Funktion); README, falls es Filter aufzählt.
- Tests: neu `tests/akzeptanz_r00214.rs`; Unit-Tests an Deutung, Erledigt und Kreissuche.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1083 Abnahme-Proben rot**: `tests/akzeptanz_r00214.rs` mit AK 1, 5, 7–12 am heutigen Stand (Feld fehlt, `wartet` 400, `braucht:999` 200).
2. **B1084 Deutung und Erledigt als reine Funktionen**: Labels → Nummern (Form, Groß/Klein, Dubletten, Reihenfolge); Erledigt-Entscheidung aus `erledigen` herausgelöst, beide Aufrufer nutzen sie.
3. **B1085 Lesefeld `braucht`** in Einzel- und Listenantwort; `braucht` im Rumpf → 400.
4. **B1086 Filter `wartet=ja|nein`**.
5. **B1087 Prüfung an der Tür ohne Kreis**: Form, Selbstbezug, unbekannte Nummer; nur neue Labels; `POST`, `mehrere`, `PATCH`; Duplizieren prüft nicht.
6. **B1088 Kreisprüfung** über die gedeuteten Labels aller Aufgaben nach dem Schreiben, Meldung mit dem Kreis.
7. **B1089 Beschreibung**: OpenAPI, `/api/endpunkte`, A00005/A00006.
8. **B1090 Legacy-Probe, Factory-Proben, Probe im echten Programm, Gate, Anforderung abschließen** (AK 14, AK 15).

### Grobentwurf

- `braucht_nummern(labels) -> Vec<u32>` (reine Funktion) — gedeutete Nummern in Label-Reihenfolge, ohne Dubletten.
- `ist_erledigt(aufgabe, boards) -> bool` (reine Funktion) — archiviert oder auf einem Board in dessen letzter Spalte; von `erledigen` und dem Lesefeld geteilt.
- `kreis_suchen(kanten, neue_kanten) -> Option<Vec<u32>>` (reine Funktion) — erster Kreis, der durch die neuen Kanten entsteht, als Folge `[a, b, …, a]`.
- `Abhaengigkeit { nummer, titel: Option<String>, erledigt }` (DTO, nur Antwort, `ToSchema` mit `readOnly`).

### Hinweise

- Der Name `braucht` im Rumpf ist heute ein unbekannter Schlüssel und wird überlesen (`src/web/koerper.rs:420`); die 400 ist eine bewusste Ausnahme wie bei `key`. Weil `key` schon so abgewiesen wird, schickt kein Client die ganze Aufgabe zurück; die Factory-Proben (AK 15) bestätigen das.
- Grenze zu S2: keine Änderung an `web/`. Der Label-Chip bleibt bis S2 wie heute.

## Tests

- **Unit:** `braucht_nummern` (alle Formen aus AK 3 und AK 7), `ist_erledigt` (Tabelle archiviert × letzte Spalte × kein Board × zwei Boards), `kreis_suchen` (Selbstkante ausgeschlossen, Kreis aus 2 und 3 Knoten, Kreis erst durch zwei neue Kanten im selben Aufruf, kein Kreis bei Bestandskreis ohne neue Kante).
- **Integration:** `tests/akzeptanz_r00214.rs`: AK 1–13 gegen das echte Programm; AK 14 `#[ignore]`, wenn die Ordner fehlen, in B1090 einmal gefahren und belegt.
- **E2E:** keine (keine Oberfläche); AK 15 läuft über die Proben der Factory.

## Abhängigkeiten

- **Abhängig von:** [R00212](R00212-herkunft-als-text-ohne-aufloesung.md) (I0202, Karte #226, erledigt) — „wartet auf“ aus der WBS ist entfernt; [R00195](R00195-klassen-und-farben-je-board-mit-vorgabe-des-ordners.md) als Vorbild der Prüfung nur geänderter Werte.
- **Blockiert:** Scheibe S2 „wartet auf #n“ auf Karte und im Aufgabenfenster (eigene Karte, `braucht:228`).

## Offene Fragen

- **Frage an den PO 1 (nicht blockierend, bis zur Antwort gilt der Vorschlag):** Liegt eine gebrauchte Aufgabe auf zwei Boards, in einem davon in der letzten Spalte — ist sie erledigt? Vorschlag: ja, wie `erledigen`, das sie auf einem Board in die letzte Spalte legt; sonst bliebe nach einem erfolgreichen `erledigen` ein „wartet“ stehen.
- **Frage an den PO 2 (nicht blockierend):** Wortlaut der Meldungen „#n gibt es nicht (braucht:n)“ und „braucht:n schlösse einen Kreis: #a → #b → #a“.

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine; Bestände bleiben, wie sie sind.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist #226: „wartet auf“ entstand nur aus der WBS und ist mit ihr gefallen, obwohl die Vision `Braucht`-Beziehungen zwischen Karten verspricht. Die Abhängigkeiten stehen schon heute als Labels `braucht:<n>` an den Karten, kanbanD liest sie nur als Text. Deutet kanbanD genau dieses Label (AK 1–3), braucht es keinen zweiten Träger, und jede Bestandskarte zeigt ihre Abhängigkeit sofort (AK 14), ohne dass die Factory etwas ändert (AK 15). Weil das Label freier Text ist, wäre ein Tippfehler stumm; die Prüfung an der Tür (AK 7–12) schließt das für jeden neuen Eintrag aus, ohne Bestand und mitgeschickte Altlabels zu brechen (AK 11). Damit hat S2 eine verlässliche Quelle für „wartet auf #n“, und Agenten finden Wartendes über `wartet=ja` (AK 5) statt über Textsuche.

## Missing-Docs

- Glossar: kein Eintrag „Abhängigkeit (braucht)“ und keiner für „erledigt“ in `Dokumentation/Domaenenwissen/`.
- Zählung des Bestands: ADR-0035 nennt 46 Dateien, der planer zählte am 2026-11-20 41 Dateien (kanbanD 31, JoinPuyaApp 10) mit 47 Labels; AK 14 zählt beim Bau neu.

## Notizen

- **Entschieden ohne Rückfrage (Empfehlung, Lauf 228-planer-1):** Dubletten einmal in `braucht`; „neu“ = nicht in der gespeicherten Liste ohne Groß/Klein; Kreisprüfung in `mehrere` gegen den Stand nach allen Änderungen; Duplizieren prüft nicht; eine Nummer mit defekter Aufgabendatei zählt als vorhanden (es gibt die Datei; `titel: null, erledigt: false`); fehlende Datei zählt bei `wartet` als offen.
- **Verworfene Alternativen** (ADR-0035): F — Feld `needs` (Formatwechsel, Übernahme der Labels, bis dahin zwei Träger); H — Feld mit gespiegeltem Label (zwei Träger).
- Nicht in dieser Anforderung: Darstellung auf Karte und im Fenster (S2), Abhängigkeiten über Ordner hinweg (ADR-0035 Punkt 6), Nutzung von `wartet=nein` durch `board.py naechste` (Vorschlag an den Director, ADR-0035 Punkt 8).
