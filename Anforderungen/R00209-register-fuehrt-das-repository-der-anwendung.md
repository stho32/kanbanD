---
id: R00209
status: Erledigt
datum: 2026-11-20
---

# R00209: Register führt das Repository der Anwendung

## Beschreibung

Karte #225, Scheibe **S1** des Rückbaus der WBS (Auftrag des Betreibers 2026-11-20, #224). Technik nach [ADR-0034](../Dokumentation/ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) Regel 1 und 2 mit Nachträgen N1 und N2 (Übergangsform des Registers); Produktentscheidungen po-entscheidungen Z. 430–433.

Das Register in `kanbanD.md` nennt je Anwendung ihr **Repository** (`sources.applications.<kürzel>.repository`, für die Standardanwendung `sources.repository`): einen Ordner im Arbeits-Repository, absolut oder relativ zum kanbanD-Ordner. Von dort ermittelt kanbanD die Wurzel für Commit-Verweise, Commit-Liste und Diff. Fehlt `repository`, gilt ersatzweise der Ordner von `wbs`, sonst `requirements` — nur als Startpunkt; die Datei selbst öffnet kanbanD nie. Beim Start entsteht kein Commit; ein Altbestand öffnet ohne Fehler und ohne Warnung.

**Übergang bis S2 (#224):** Geschrieben wird je Anwendung immer `repository`. `wbs`/`requirements` schreibt kanbanD nur noch, wenn der Schreiber sie in derselben Anfrage mitschickt, und `GET` zeigt sie weiter, solange sie in der Datei stehen. Grund: Die heutige Factory (`werkzeuge/board_binden.py`) liest `a["wbs"]` und erkennt ihre Anwendung über diesen Pfad wieder. WBS-Sicht, Phasen und Herkunft lesen `wbs` bis S2–S4. Diese Anforderung setzt **keine Änderung der Factory voraus**. Wer nur `repository` schickt (Einrichten, eine umgestellte Factory), bekommt die neue Form allein. So entschieden in ADR-0034 N2 (ersetzt Regel 1 ab „Schreiben“).

**Abnahme-Probe der Karte (architekt, ADR-0034 N1):** „`kd:<hash>` zeigt denselben `zustand` mit neuem Register, mit nur `wbs` und mit nur `requirements`. Nach `PUT /api/einstellungen` steht `repository` in der Datei und `wbs` nicht mehr.“ Nach N2 gilt der zweite Satz für ein `PUT` **in neuer Form** (ohne `wbs`/`anforderungen`). Ein `PUT` der heutigen Factory reicht `wbs` durch (AK 5). Die Probe steckt in AK 2 und AK 4. Dazu kommt die Legacy-Probe mit einer Kopie des JoinPuya-Ordners (PO Z. 432, AK 8).

Ändert R00053 (Register mit Kürzel und Pfaden zu WBS und Anforderungen): Die Wurzel kommt aus `repository`, und eine Anwendung braucht keinen WBS-Pfad mehr. R00053 selbst bleibt unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Aufgaben sind der Stand“ (Z. 102–105: „Ein Board bindet keine bis mehrere Anwendungen (Kürzel und Repository, etwa für Commit-Verweise)“).

## Geschäftlicher Nutzen

Commit-Verweise, Commit-Liste und Diff (#207–#214) hängen heute am Pfad einer WBS-Datei, obwohl kanbanD die WBS künftig nicht mehr kennt. Mit `repository` sagt das Register, was es meint. S2–S4 können die WBS entfernen, ohne dass ein einziger Verweis seinen Zustand ändert. Bestehende Ordner und die laufende Factory merken davon nichts.

## Funktionale Anforderungen

- Der Startordner einer Anwendung ist `repository`, wenn es nach dem Trimmen nicht leer ist. Sonst ist es der Ordner von `wbs` (eine WBS ohne Ordneranteil gibt `.`), sonst `requirements`, sonst keiner.
- Ein gesetztes, aber unerreichbares `repository` fällt nie auf `wbs`/`requirements` zurück.
- Die Wurzel ist `git rev-parse --show-toplevel` im Startordner. Ohne Startordner gilt der `zustand` `repository_fehlt`. Die WBS-Datei und den Anforderungsordner öffnet kanbanD dafür nie.
- `PUT /api/einstellungen` nimmt je Anwendung und in `quellen` `repository` und/oder `wbs`/`anforderungen` an. Geschrieben wird `repository`: das mitgeschickte, sonst der Startordner. `wbs`/`requirements` werden nur geschrieben, wenn sie mitgeschickt und nicht leer sind.
- `GET /api/einstellungen` und `GET /api/anwendungen` liefern je Anwendung `repository` (gespeichert oder Startordner) und `wbs`/`anforderungen` so, wie sie gespeichert sind. Alle drei Schlüssel sind immer vorhanden, leer als `""`, nie weggelassen (ADR-0034 N2 Regel 2). `GET /api/anwendungen` liefert dazu `erreichbar.repository` (der Ordner ist vorhanden), neben `erreichbar.wbs`/`erreichbar.anforderungen`. `GET /api/einstellungen` liefert `erreichbar.repository` auch für `quellen`.
- Die Einstellungsseite zeigt je Anwendung und unter „Quellen“ das Repository mit einem sichtbaren Zustandswort: „erreichbar“, „nicht erreichbar“, „kein Repository“ (leeres Feld) oder „noch nicht geprüft“ (geänderter, noch nicht gespeicherter Pfad) (PO Z. 434). Eine Anwendung lässt sich mit nur einem Repository anlegen. Die Felder für WBS und Anforderungen bleiben bis S2, in der Reihenfolge Repository, WBS, Anforderungen.
- Die Vorschau der Einstellungen zeigt vor dem Speichern genau die Zeilen, die danach in `kanbanD.md` stehen.
- Scheitert das Speichern, bleibt der Entwurf stehen, und die Meldung ist sichtbar und erreichbar.
- Start und lesende Aufrufe schreiben nichts: kein Commit, `kanbanD.md` bleibt bytegleich.

## Nicht-funktionale Anforderungen

- Benutzerfreundlichkeit (UX-Vorprüfung Sollte 5, 6): Bei 375, 641, 768 und 980 px Breite gibt es in „Anwendungen“ und „Quellen“ kein Querscrollen. Bedienziele sind mindestens 24 px groß, bei Touch 44 px. Ein Pfad mit 120 Zeichen bleibt voll lesbar, über `title` oder Umbruch. Die Zustandswörter haben in Hell und Dunkel, auch im Hover, einen Kontrast von mindestens 4,5:1. Sie sind sichtbarer Text, nie in `.vh`, und werden mit dem Feld vorgelesen (Name oder `aria-describedby`).

- Sicherheit: Der Startordner wird nur an Git übergeben, gehärtet wie bisher (ADR-0032 N2.3). Die Erreichbarkeit prüft nur, ob der Ordner vorhanden ist, ohne Git-Aufruf. Kein neuer Prozess im Arbeits-Repository.
- Verträglichkeit: Die heutige Factory läuft gegen dieses Programm unverändert (ADR-0034 Q3). Eine ältere kanbanD-Version liest eine so geschriebene Datei ohne Fehler; ihr fehlt nur die Wurzel bei Anwendungen ohne `wbs` (bekannte Schwäche, ADR-0034 Option A).

## Akzeptanzkriterien

Ausgangslage (herstellbar mit Git und der API): Arbeits-Repository `R` (Git, Commit `C` auf `main`) mit den Ordnern `R/Dokumentation/Planung/` und `R/Anforderungen/`, die WBS-Datei `R/Dokumentation/Planung/kd.md`, dazu ein kanbanD-Ordner `K` außerhalb von `R`. Die Aufgabe #1 trägt den Verweis `kd:<C>`.

### Startordner

- [x] **AK 1** Gegeben je Zeile ein Registereintrag `kd`. Wenn `GET /api/einstellungen` gelesen wird, dann ist `repository` der Startordner aus dieser Tabelle (relative Pfade gelten ab `K`):

  | `repository` | `wbs` | `requirements` | Startordner (`repository` in der Antwort) |
  |---|---|---|---|
  | `/p/app` | `/p/app/Dokumentation/Planung/app.md` | `/p/app/Anforderungen` | `/p/app` |
  | — | `/p/app/Dokumentation/Planung/app.md` | `/p/app/Anforderungen` | `/p/app/Dokumentation/Planung` |
  | — | — | `/p/app/Anforderungen` | `/p/app/Anforderungen` |
  | `"  "` | `Dokumentation/Planung/app.md` | — | `Dokumentation/Planung` |
  | — | `app.md` | — | `.` |
  | `/p/fehlt` | `/p/app/Dokumentation/Planung/app.md` | — | `/p/fehlt` (kein Rückfall) |
  | — | — | — | `""` |

### Commit-Verweise

- [x] **AK 2** Gegeben ist `kd` einmal als `{repository: R}`, einmal als `{wbs: R/Dokumentation/Planung/kd.md, requirements: R/Anforderungen}` und einmal als `{requirements: R/Anforderungen}`. Wenn `GET /api/aufgaben/1/commits` gelesen wird, dann ist der Eintrag `kd:<C>` in allen drei Fällen gleich: `zustand: auf_zweig`, derselbe `hash`, `titel` und `zweige`. Ohne jeden Pfad ist er `repository_fehlt` mit Grund.
- [x] **AK 3** Gegeben ist `kd` als `{wbs: R/Dokumentation/Planung/kd.md}`, einmal mit `chmod 000` an `kd.md` und einmal ohne die Datei (der Ordner ist da). Wenn die Commit-Liste von #1 gelesen wird, dann ist das Ergebnis dasselbe wie mit lesbarer Datei (`auf_zweig`), ohne Fehlerzeile im Log.

### Schreiben

- [x] **AK 4** Gegeben `kd` als `{name: kanbanD, wbs: R/Dokumentation/Planung/kd.md, requirements: R/Anforderungen}`. Wenn `PUT /api/einstellungen` `kd` als `{kuerzel: kd, name: kanbanD, repository: R}` ohne `wbs`/`anforderungen` schickt, dann steht in `kanbanD.md` `kd: {name: kanbanD, repository: R}` ohne `wbs` und ohne `requirements`, es entsteht genau ein Commit, und `kd:<C>` bleibt `auf_zweig`. Danach liefern `GET /api/einstellungen` und `GET /api/anwendungen` für `kd` `repository: R`, `wbs: ""` und `anforderungen: ""`: Die Schlüssel sind vorhanden, nicht weggelassen (N2 Regel 2, wegen `board_binden.py:54`).
- [x] **AK 5** Gegeben ein leeres Register. Wenn `PUT /api/einstellungen` eine Anwendung wie die heutige Factory schickt, `{kuerzel: pa, name: Probe, wbs: R/Dokumentation/Planung/pa.md, anforderungen: R/Anforderungen}` ohne `repository`, dann antwortet kanbanD mit 200. In der Datei steht `pa: {name: Probe, repository: R/Dokumentation/Planung, wbs: R/Dokumentation/Planung/pa.md, requirements: R/Anforderungen}`. `GET /api/anwendungen` liefert für `pa` dieses `repository`, `wbs` unverändert und `erreichbar.repository: true`, und `pa:<C>` ist `auf_zweig`. Schickt dieselbe Anfrage zusätzlich `repository: R`, gilt `R`.
- [x] **AK 6** Gegeben ist das gebaute Programm. Wenn die heutige Factory ein Board bindet (`KANBAND=<build> python3 -m unittest tests.test_auftrag`, Fall `test_board_wird_an_die_anwendung_gebunden`), danach per `GET`→`PUT /api/einstellungen` ein Signal einträgt (wie `werkzeuge/board.py` `_einrichten`) und `board_binden.binde` erneut aufruft, dann ist der Test grün. Der zweite Aufruf liefert dasselbe Kürzel, das Register hat genau einen Eintrag, und kein Fehler „Kürzel … schon vergeben“ erscheint.

### Altbestand

- [x] **AK 7** Gegeben ein Ordner, dessen Register nur `wbs`/`requirements` kennt. Wenn kanbanD startet und `GET /api/zustand`, `/api/einstellungen` und `/api/anwendungen` gelesen werden, dann bleibt die Zahl der Commits (`git rev-list --count HEAD`) gleich, `kanbanD.md` ist bytegleich (SHA-256), und im Log steht keine Fehler- oder Warnzeile.
- [x] **AK 8** Gegeben ist eine Kopie von `~/Projekte/Kanban-Boards/JoinPuyaApp-Kanbanboard` (Register `jopu` mit `wbs`, Aufgaben mit `wbs-effects` und `phases`, Boards mit `column-phases`), in der einer Aufgabe der Verweis `jopu:<hash>` eines Commits auf `main` von JoinPuyaApp hinterlegt ist. Wenn das Programm vor der Karte und dieses Programm nacheinander darauf laufen, dann:
  - öffnet beim Start keine Datei defekt, und die Bedingungen von AK 7 gelten;
  - ist der Eintrag in `GET …/commits` in beiden Läufen gleich (`zustand`, `hash`, `titel`);
  - steht nach einem `PUT /api/einstellungen` mit `jopu` als `{kuerzel, name, repository: /home/shoff/Projekte/JoinPuyaApp}` `repository` und kein `wbs` in der Datei, und der Eintrag bleibt gleich.

### Einrichten

- [x] **AK 9** Gegeben ist das Register aus AK 8 vor dem `PUT`. Wenn der Betreiber die Einstellungen öffnet, dann zeigt die Anwendung `jopu` das Repository `/home/shoff/Projekte/JoinPuyaApp/Documentation/Planning` mit dem Zustandswort „erreichbar“. Die Felder stehen in der Reihenfolge Repository, WBS, Anforderungen. Das Feld heißt für Hilfstechnik „Repository jopu“. Unter dem gefüllten WBS-Feld steht ruhig und ohne Sperre der Hinweis „Die Factory erkennt die Anwendung an diesem Pfad. Leeren erst, wenn die Factory umgestellt ist.“ (PO Z. 435); bei leerem WBS-Feld fehlt er.
  - Speichert der Betreiber, ohne das Repository zu ändern, steht `repository: /home/shoff/Projekte/JoinPuyaApp/Documentation/Planning` in der Datei, und `wbs`/`requirements` bleiben unverändert stehen, weil die Seite sie mitsendet (N2 Regel 3).
  - Ändert er das Repository auf `/home/shoff/Projekte/JoinPuyaApp`, zeigt die Zeile bis zum Speichern „noch nicht geprüft“. Nach dem Speichern steht genau dieser Ordner als `repository` in der Datei (ein Commit), `wbs`/`requirements` bleiben stehen, die Zeile zeigt „erreichbar“, und `jopu:<hash>` bleibt gleich.
  - Ein Ordner, den es nicht gibt, zeigt nach dem Speichern „nicht erreichbar“, und ein leeres Feld zeigt „kein Repository“. Speichern geht in beiden Fällen, ohne Meldung, und Verweise der Anwendung sind dann `repository_fehlt`. Auch ein relativer Pfad erzeugt keine Meldung.
- [x] **AK 10** Gegeben sind geöffnete Einstellungen. Oben in „Anwendungen“ steht der Hinweis im Wortlaut von PO Z. 436: „Je Anwendung ein Kürzel und der Pfad ihres Repositorys; ein Ordner darin genügt. Daraus liest kanbanD die Commits zu Verweisen wie `kd:<hash>`. WBS und Anforderungen braucht nur noch die Factory; die Felder entfallen, sobald sie umgestellt ist. Aufgaben nennen ihre Herkunft als `kd:I0007`; Boards binden mit `applications: [kd]`.“ Wenn der Betreiber die Anwendung `lc` anlegt, dann steht der Fokus im Feld „Repository“ der neuen Zeile (Platzhalter `/voller/pfad/zum/Repository`).
  - Trägt er dort `R` und unter „Quellen“ ebenfalls `R` ein (Feld „Repository“) und speichert, dann stehen `lc: {name: …, repository: R}` und `sources.repository: R` in der Datei, ohne `wbs` und ohne `requirements`, mit genau einem Commit. `<C>` ohne Kürzel ist danach `auf_zweig` (Standardanwendung).
  - `GET /api/einstellungen` liefert für `quellen` `erreichbar.repository: true`, und die Quellen-Zeile zeigt „erreichbar“ wie die Zeile einer Anwendung. Nennt `sources.repository` einen Ordner, den es nicht gibt, steht dort „nicht erreichbar“, und Speichern bleibt möglich.
  - Entfernt er `lc` wieder, steht der Fokus auf der Nachbarzeile oder, wenn keine bleibt, im Feld „Neues Anwendungskürzel“.
- [x] **AK 11** Gegeben sind geöffnete Einstellungen mit `kd: {repository: R, wbs: W}`. Wenn der Betreiber das Repository ändert oder `wbs` leert, dann zeigt `#einr-vorschau` vor dem Speichern genau die Zeilen, die nach dem Speichern in `kanbanD.md` stehen (`repository` immer, `wbs`/`requirements` nur bei nicht leerem Feld). Probe: Der Text von `#einr-vorschau` ist gleich `kanbanD.md` nach dem Speichern, auch in den Fällen von AK 9 und AK 10.
- [x] **AK 12** Gegeben ein geänderter Entwurf in den Einstellungen. Wenn `PUT /api/einstellungen` fehlschlägt (z. B. 400 bei doppeltem Kürzel oder 500), dann bleibt der Entwurf mit allen Eingaben stehen. Die Fehlermeldung erscheint als `role=alert` über den Knöpfen, und der Fokus liegt auf der Meldung oder dem ersten fehlerhaften Feld, nie auf `body`. `kanbanD.md` bleibt unverändert.

## Betroffene Verzeichnisstruktur

- Format und Modell: `src/format/einstellungen.rs`, `src/modell/einstellungen.rs`, `src/modell/anwendungen.rs` (`Anwendungen::aus`).
- Dienste: `src/dienst/einstellungen.rs` (`normalisieren`), `src/dienst/einrichten.rs`, `src/dienst/anwendungen.rs`.
- Git: `src/git/arbeitsrepo.rs` (nur die Wahl des Startordners in `wurzel_bis`, `:148–153`).
- Web: `src/web/endpunkte.rs`, `src/web/openapi.rs`, README (Format von `kanbanD.md` und Endpunkte).
- Oberfläche: `web/ansicht.js` (Einrichten ab `:2264`), `web/app.js` (`:3253`, `:3666–3670`).
- Tests: Unit in den Modulen, `tests/akzeptanz_r00209.rs`, `e2e/tests/r00209-register-repository.spec.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1035 Startordner wählen, rein**: `(repository, wbs, requirements)` → `Option<Startordner>` nach AK 1, ohne Dateizugriff.
2. **B1036 Register lesen und schreiben**: `repository` lesen. Schreiben je Anwendung `{name, repository}` (leer → Startordner aus 1), `wbs`/`requirements` nur, wenn nicht leer; `sources` ebenso. Alle drei Pfade bekommen in serde die Vorgabe „leer“.
3. **B1037 Wurzel aus dem Startordner**: `wurzel`/`wurzel_bis` behalten ihre Signaturen (ADR-0034 N1), nur der Startordner kommt aus 1.
4. **B1038 API**: `PUT`/`GET /api/einstellungen`, `GET /api/anwendungen` mit `repository` und `erreichbar.repository`, je Anwendung und für `quellen`; Endpunktliste, OpenAPI und README.
5. **B1039 Einrichten**: Feld „Repository“ je Anwendung und unter „Quellen“ im vorhandenen Zeilenmuster (`vBeschriftung`, `mini-inp`, `vErreichbar`), vor WBS und Anforderungen. Zustandswörter nach PO Z. 434 (das heutige „—“ wird „noch nicht geprüft“), Hinweis am WBS-Feld (Z. 435), Hinweistext „Anwendungen“ (Z. 436), Vorschau nach derselben Schreibregel wie der Server (AK 11), Fehlerpfad und Fokus (AK 10, 12), Breiten und Kontrast nach NFA.
6. **B1040 Probe im echten Programm**, Legacy-Probe, Gate, Abschluss.

### Hinweise

- `Anwendung` behält `wbs`/`anforderungen` (ADR-0034 N1: erst nach #214 auf `main`, und die WBS-Funktionen brauchen sie bis S2). Neu ist das Feld `repository`.
- Der erste Start (`POST /api/einrichten`) behält sein Formular. Seine `quellen` laufen durch dieselbe Schreibregel: Mit WBS steht danach auch `sources.repository` in der Datei.
- Kein Artboard: `Dokumentation/Wireframes/D0001.dc.html` zeigt das Register nicht. Das neue Feld folgt dem vorhandenen Zeilenmuster und ist keine neue Anordnung.
- Die Legacy-Probe arbeitet nur in einer Kopie in der eigenen Ablage, nie im Board-Ordner selbst. JoinPuyaApp wird nur gelesen. Testsystem ohne echte Personendaten: Der Board-Ordner enthält Karten, keine Personendaten der Nutzer der App.

## Tests

- **Unit:** Startordner (AK 1, Tabelle je Zeile), Register-Rundlauf in drei Formen, Schreibregel „`wbs` nur, wenn mitgeschickt“.
- **Integration:** `tests/akzeptanz_r00209.rs` gegen echtes Git: AK 2–5 und 7. Dazu AK 6 gegen die Factory, die dabei nur gelesen wird, und AK 8 gegen die Kopie (`#[ignore]`, wenn der Ordner fehlt; in B1040 einmal von Hand gefahren und im Bericht belegt).
- **E2E:** AK 9 bis 12 über die Einstellungsseite.

## Abhängigkeiten

- **Abhängig von:** [R00208](R00208-gesamt-diff-der-karte-per-api-lesen.md) (I0198, Karte #214, `braucht:214`, rot) — gebaut wird nach dem Merge von #214 (ADR-0034 N1); [R00053](R00053-anwendungen-registrieren.md) (I0048, grün).
- **Blockiert:** #226 S4 „Herkunft als Text ohne Auflösung“ und #224 S2 „WBS-Sicht … entfernen“ (beide `braucht:225`).

## Offene Fragen

- Keine. Die Frage zur Übergangsform des Registers (Regel 1 gegen „ohne Factory-Sperre“) hat der architekt am 2026-11-20 entschieden: **ADR-0034 N2**, Option (a) wie empfohlen (4d2430d5). Durch die Einstellungsseite und an Factory-gebundenen Anwendungen entsteht die neue Form allein erst mit S2 (#224); vorher gibt es `PUT` in neuer Form nur in Proben auf Kopien (N2 Regel 3, 4).

## Manuelle Vorbereitungstätigkeiten

- Keine. Die Kopie des JoinPuya-Ordners legt die Probe selbst in ihrer Ablage an.

## Manuelle Nachbereitungstätigkeiten

- Nach der Auslieferung: keine Umstellung der Bestände nötig. Die Register gehen beim nächsten Speichern in die neue Form über.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Vision vom 2026-11-20: kanbanD kennt die WBS nicht mehr, aber Commit-Verweise, Liste und Diff finden ihr Repository heute über den WBS-Pfad (`arbeitsrepo.rs:148–153`). Ein Feld `repository` mit Rückfall auf den Ordner des alten Pfads ändert nur, woher der Startordner kommt. Die Wurzel bleibt für jeden Bestand dieselbe, also bleibt jeder `zustand` gleich (AK 2, 8). Weil `wbs` im Übergang nur durchgereicht wird, solange jemand es schickt, laufen die Factory und die WBS-Funktionen bis S2 unverändert weiter (AK 5, 6). Der Rückbau kann deshalb ohne Sperre beginnen. Der Hebel sitzt genau hier: S2–S4 entfernen nur noch Leser des WBS-Pfads, und keiner davon trägt die Wurzel.

## Missing-Docs

- Wie die Factory-Werkzeuge mit `GET /api/einstellungen` umgehen (Rundlauf über `GET`→`PUT`), steht nirgends in kanbanD. Ein Abschnitt „Clients der Einstellungen“ in A00003 hätte die Unverträglichkeit mit Regel 1 früher gezeigt.

## Notizen

**Verworfene Alternativen:**
- *Strikt nach ADR-0034 Regel 1* (nur `{name, repository}`, `wbs` beim `PUT` ignoriert): Damit bricht die unveränderte Factory beim nächsten Signal oder bei der nächsten Klasse, also ist es nur mit vorgezogener Factory-Sperre möglich. Verworfen in ADR-0034 N2.
- *In S1 nur lesen* (`repository` lesen, weiter die alte Form schreiben): Niemand könnte `repository` setzen, und die Scheibe brächte keinen Nutzen.
- *`wbs`/`requirements` immer erhalten* (auch wenn der Schreiber sie weglässt): Die Abnahme-Probe „nach `PUT` steht `wbs` nicht mehr“ wäre nie erfüllbar, und der WBS-Pfad bliebe ohne Ende in der Datei.
