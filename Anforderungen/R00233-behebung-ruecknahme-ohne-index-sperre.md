---
id: R00233
status: Erledigt
datum: 2026-11-22
ursprung: Bug-Report
ursprungslauf: R00149
---

# R00233: Behebung — die Rücknahme nach einem gescheiterten Commit lässt den Arbeitsbaum auch bei gehaltener Index-Sperre sauber

## Beschreibung

Karte #244, gefunden in der Nacharbeit an #208 (Lauf 208-entwickler-2) und vorher im Observability-Review. Hält jemand außerhalb von kanbanD `.git/index.lock` (ein `git status` des Menschen im Ordner, ein Editor, ein abgestürzter Git-Prozess), scheitert jeder Schreibweg mit 500 — das ist richtig. Falsch ist der Zustand danach: Die Rücknahme in `git::committen` braucht selbst die Sperre und lässt geänderte und gelöschte Dateien stehen.

Reproduktion (Probe der Karte): `touch <ordner>/.git/index.lock`, dann ein schreibender Aufruf, etwa `PATCH /api/aufgaben/1 {titel: "neu"}` → 500. Sperre entfernen, `git status --porcelain` aufrufen.

- **Erwartet** (ADR-0005 N1 Punkt 2, N2 Punkt 1): leere Ausgabe — der Ordner steht auf HEAD.
- **Tatsächlich**: ` M aufgaben/0001-….md`; bei einer Aktion, die eine Datei entfernt, zusätzlich ` D <pfad>`. Der nächste Schreibweg auf denselben Pfad committet den Rest der gescheiterten Aktion mit.

Das ist **falsch gebaut**: R00149 („Eine gescheiterte Aktion lässt nichts liegen“) sagt zu, dass `git status` nach einem gescheiterten Commit leer ist; die gehaltene Sperre ist ein Weg, auf dem die Zusage nicht hält.

Zahlt ein auf: [Vision](R00000-vision.md) — Git ist die Wahrheit des Ordners: jede Aktion ist ein Commit oder gar nichts, auch wenn Mensch und Agent im selben Ordner arbeiten.

## Ursachenanalyse

### Root Cause

Belegt in [ADR-0005](../Dokumentation/ADRs/0005-zusammengesetzte-aktionen-in-einem-commit.md) Nachtrag N4 (Commit `2d24a27d`), Code-Stand `96b1fc19`:

- Alle Schreibwege enden in `git::committen` (`src/git.rs:49`): `Kanban::aktion` (`src/dienst/mod.rs:227`, Aufruf `:250`) und der direkte Weg `Kanban::committen` (`:218`) für `anhaenge` und `fieber`.
- Bei gehaltener Sperre scheitert `committen_und_pruefen` schon an `git add` (`src/git.rs:92`); der Index ist unverändert.
- `zuruecknehmen` (`src/git.rs:143`) setzt erst den Index zurück (`index_zuruecksetzen`, `:126`, `git reset`) und stellt dann bekannte Pfade mit `git checkout -q HEAD -- <pfad>` her (`:151`). **Beide** Befehle brauchen `index.lock` und scheitern — die Dateien bleiben im Zustand der gescheiterten Aktion.
- Neue Pfade entfernt `remove_file` (`:158`) ohne Git; das gelingt schon heute.
- Die Meldung ist ehrlich: „Rücknahme unvollständig: … ließ sich nicht wiederherstellen“ (`:77`), Antwort 500 (`src/web/mod.rs:149`). Nur der Zustand ist falsch.
- kanbanD hält die Sperre selbst nicht nebenbei (lesende Aufrufe mit `GIT_OPTIONAL_LOCKS=0`, `src/git/arbeitsrepo.rs:695`); die Sperre kommt von außen — im Betrieb erreichbar.

Ausgeschlossen: ein Fehler in der Meldung (N2 Punkt 4 hält) und ein Fehler im Hook-Fall (dort gelingen `reset` und `checkout`, Test `gescheiterter_commit_nimmt_seine_pfade_zurueck`).

### Betroffene Komponenten

- `src/git.rs`: `in_head` (liefert künftig den Modus je Pfad), `zuruecknehmen`, `index_zuruecksetzen`, `nach_gescheitertem_commit`
- `src/dienst/transkripte.rs`: Kommentar an `:233` und Test `gescheiterter_commit_laesst_eintrag_und_datei_zusammen` (`:727`) — er stellt „Rücknahme misslingt“ heute mit `.git/index.lock` her (`:729`, `:739`); nach dem Fix gelingt die Rücknahme mit Sperre, der Fall braucht einen anderen Auslöser
- `tests/git.rs`, `tests/aufgabe_anlegen.rs`: neue Proben
- **Nicht** betroffen: Oberfläche, Antwortcodes, Protokoll (#239)

## Lösungsvorschlag

### Langfristige Lösung

ADR-0005 N4 Option A, wörtlich dort entschieden:

1. Für jeden Pfad, den HEAD kennt, schreibt die Rücknahme die Bytes aus `git cat-file --filters HEAD:<pfad>` zurück, über eine Nachbardatei und Umbenennen (wie `Ordner::schreib`, `src/ablage.rs:64`), Elternordner bei Bedarf angelegt. Das gilt für geänderte und gelöschte Pfade. Kein `checkout`, `restore` oder `reset` mehr im Pfad des Arbeitsbaums.
2. Der Index-Reset ist ein eigener Schritt, zuerst, nach bestem Vermögen; sein Scheitern verhindert das Zurückschreiben nicht. Ein Fehlschlag der Rücknahme ist er nur, wenn der Index der Pfade danach von HEAD abweicht (`git diff --cached --quiet -- <pfade>`).
3. Pfade, die HEAD nicht kennt, entfernt die Rücknahme wie bisher; jeder Pfad wird für sich behandelt.
4. Zurückgeschrieben werden nur die Modi `100644` und `100755` (Ausführbit wie in HEAD); jede andere Art bleibt unberührt und wird als „<pfad> ließ sich nicht wiederherstellen: Art <modus>“ gemeldet.
5. Scheitert das Zurückschreiben, sammelt die Rücknahme den Grund je Pfad und macht mit den übrigen weiter; die Nachbardatei wird entfernt; die Meldung lautet „…; Rücknahme unvollständig: …“, nie „zurückgenommen:“.
6. Antwort unverändert 500, die Meldung beginnt mit dem Grund des Commits (Gits Text zu `index.lock`).

### Alternative Ansätze

Entschieden im ADR, hier nur benannt:

- **B Zweitindex** (`GIT_INDEX_FILE`, `read-tree HEAD`, `checkout-index -f`) — gleich richtig, aber eine zweite Indexdatei mit eigenem Aufräumpfad auf einem selten laufenden Weg; Ablösung, falls kanbanD eines Tages Verknüpfungen schreibt.
- **C Auf die Sperre warten** — eine verwaiste Sperre verschwindet nie, und Warten unter der Schreibsperre hält alle Schreibwege an.
- **D Vorprüfung auf `index.lock`** — Prüfen-dann-Handeln, die Sperre kann zwischen Prüfung und `add` entstehen; die Rücknahme muss trotzdem stimmen.

## Test-Strategie

### Test zur Bug-Reproduktion

Integrationstest gegen `git::committen` in einem Wegwerf-Repo, deterministisch, ohne Zeitfenster: die Sperre liegt vor dem Aufruf (`.git/index.lock` als leere Datei), sie wird erst nach dem Aufruf entfernt (AK 1). Heute rot mit ` M a.md` und ` D d.md`.

### Code-Extraktion für isoliertes Testing

Das Zurückschreiben eines Pfads aus HEAD (Bytes und Modus → Nachbardatei → Umbenennen, Fehler als Grund) ist für sich prüfbar; die Rücknahme ruft es je Pfad.

### Regressionstests

- die Proben aus N1 und N2 in `tests/git.rs` und `tests/aufgabe_anlegen.rs` ohne geänderte Erwartung (AK 4)
- `gescheiterter_commit_laesst_eintrag_und_datei_zusammen` mit neuem Auslöser für „Rücknahme misslingt“ (AK 7)
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage:** ein Wegwerf-Repo bzw. ein Wegwerf-Ordner mit `gemeinsam::eingerichtet`; „Sperre setzen“ heißt eine leere Datei `.git/index.lock` vor dem Aufruf, „Sperre entfernen“ heißt sie nach dem Aufruf löschen; „Status leer“ heißt `git status --porcelain` liefert nichts. Die Tests laufen nicht als root (AK 3 braucht wirksame Rechte).

### Abnahme-Proben aus ADR-0005 N4 (wörtlich), in Bubble 1 als Tests zuerst rot

- [x] **AK 1 Sperre gehalten, alle drei Arten** (Integrationstest gegen `git::committen`): HEAD kennt `a.md` (Inhalt `alt`) und `d.md`; die Aktion schreibt `a.md` = `neu`, entfernt `d.md`, legt `n.md` an; vor dem Aufruf `touch .git/index.lock` ⇒ `Err`, Meldung enthält „index.lock“ und „zurückgenommen:“, nicht „Rücknahme unvollständig“; nach dem Entfernen der Sperre `git status --porcelain` leer, `a.md` = `alt`, `d.md` da, `n.md` fehlt, kein neuer Commit. **Heute rot** (` M a.md`, ` D d.md`).
- [x] **AK 2 Über die API** (Probe der Karte): Sperre setzen, `PATCH` einer Aufgabe ⇒ 500; Sperre entfernen ⇒ `git status --porcelain` leer. Variante `POST /api/aufgaben` mit `key` ⇒ 500, danach ohne Sperre derselbe `key` ⇒ 201 (N1). **Heute rot** beim `PATCH` (` M aufgaben/0001-….md`); die Variante `POST` ist nicht geprobt und nach dem Codepfad schon heute grün (die neue Datei entfernt `remove_file`) — sie hält den Rückfall fest.
- [x] **AK 3 Zurückschreiben scheitert**: wie AK 1, zusätzlich der Elternordner von `a.md` nicht beschreibbar (`chmod 0555`, Test nicht als root) ⇒ Meldung „Rücknahme unvollständig“ mit `a.md`, ohne „zurückgenommen:“; `d.md`/`n.md` trotzdem zurückgenommen (die Rücknahme macht weiter); keine Nachbardatei `*.kanbanD-tmp` bleibt liegen. Damit der Elternordner von `a.md` nicht zugleich der von `d.md` und `n.md` ist, liegt `a.md` in einem Unterordner (etwa `zu/a.md`). **Heute rot** (`d.md` scheitert ebenfalls an der Sperre).
- [x] **AK 4 Bestehende Proben bleiben grün**: Hook-Fall aus N1 (`gescheiterter_commit_nimmt_seine_pfade_zurueck`, `gescheiterter_commit_laesst_keine_datei_und_keinen_git_rest`), „vorher schmutzig“ und „Pfad außerhalb“ aus N2 (`vorher_schmutziger_pfad_steht_nach_dem_fehlschlag_auf_head`, `pfad_ausserhalb_der_wurzel_bleibt_ohne_wirkung`, `pfad_ausserhalb_der_wurzel_und_doppelter_pfad_werden_abgewiesen`), „HEAD fehlt“ (`ohne_head_loescht_die_ruecknahme_nichts`, `ls_tree_scheitert_trotz_head_laesst_die_datei_stehen`) und `eine_gescheiterte_ruecknahme_steht_in_der_meldung` — ohne geänderte Erwartung. **Heute grün.**

### Weitere Kriterien aus N4 und dem Bau

- [x] **AK 5 Nur gewöhnliche Dateien** (N4 Punkt 4): Gegeben HEAD mit `x.sh` (Modus `100755`, Inhalt `alt`) und einer Verknüpfung `l.md` → `a.md` (Modus `120000`); die Aktion schreibt `x.sh` = `neu` und ersetzt `l.md` durch eine gewöhnliche Datei mit Inhalt `neu`; Sperre gesetzt ⇒ nach dem Entfernen der Sperre hat `x.sh` den Inhalt `alt` und ist ausführbar (`git status --porcelain -- x.sh` leer); `l.md` ist unverändert die gewöhnliche Datei mit `neu`, und die Meldung enthält „l.md ließ sich nicht wiederherstellen: Art 120000“ und „Rücknahme unvollständig“.
- [x] **AK 6 Kein Git-Befehl mit Sperre im Pfad des Arbeitsbaums** (Review-Punkt N4): `zuruecknehmen` und seine Helfer rufen für den Arbeitsbaum weder `checkout`, `restore`, `reset --hard`, `update-index` noch `stash`; jedes Zurückschreiben geht über Nachbardatei und Umbenennen. Prüfbar per Lesen und per `grep -nE '"(checkout|restore|update-index|stash)"' src/git.rs` (keine Zeile; heute trifft `:151`).
- [x] **AK 7 Transkripte: Eintrag und Datei bleiben zusammen**: `gescheiterter_commit_laesst_eintrag_und_datei_zusammen` (`src/dienst/transkripte.rs:727`) prüft drei Fälle: (a) Hook `pre-commit` → Rücknahme gelingt, alles wie vorher; (b) `.git/index.lock` → Rücknahme gelingt jetzt ebenfalls: kein Eintrag, keine Datei, keine Zwischendatei, Status leer; (c) Rücknahme misslingt über einen Auslöser ohne Sperre (etwa ein Hook, der `aufgaben/` auf `0555` setzt und `exit 1` liefert) → Eintrag und Datei bleiben zusammen, keine Zwischendatei. Der Kommentar an `:233` nennt nicht mehr `.git/index.lock` als Beispiel für eine misslingende Rücknahme. Heute: (b) erwartet das Gegenteil.
- [x] **AK 8 Mutanten**, jeder von einem benannten Test getötet, in einer eigenen Kopie, nicht im Worktree:
  - (m1) Rücknahme über `git checkout -q HEAD -- <pfad>` wie heute → AK 1 rot (Mutante der Karte).
  - (m2) Modus nicht geprüft: jede Art wird als gewöhnliche Datei aus `cat-file` zurückgeschrieben → AK 5 rot (`l.md` trägt den Text `a.md`, keine Meldung „Art 120000“).
  - (m3) Ausführbit nicht übernommen (immer `0644`) → AK 5 rot (` M x.sh`).
  - (m4) das Scheitern des Index-Resets zählt immer als Fehlschlag (ohne Vergleich Index ↔ HEAD) → AK 1 rot („Rücknahme unvollständig“ statt „zurückgenommen:“).
  - (m5) die Rücknahme bricht beim ersten gescheiterten Pfad ab → AK 3 rot (`d.md` fehlt bzw. `n.md` liegt noch).
  - (m6) die Nachbardatei bleibt liegen, wenn das Umbenennen scheitert → ein Test, in dem das Anlegen der Nachbardatei gelingt und das Umbenennen scheitert (etwa: an der Stelle von `a.md` steht ein nicht leerer Ordner), findet eine `*.kanbanD-tmp`. Im Aufbau von AK 3 kann die Nachbardatei gar nicht entstehen; ohne diesen Test wäre die Prüfung „keine Nachbardatei“ leer wahr.

  Lässt sich ein Mutant nicht töten, meldet der entwickler das mit Begründung.
- [x] **AK 9 Bug-Vorlage**: Die Tests aus AK 1–3 und AK 5 sind ohne Fix rot (AK 2 nur beim `PATCH`) und mit Fix grün; Antwortcodes und Oberfläche unverändert (500 wie bisher); alle Tests aller Ebenen grün.

## Nicht-Ziele

- Das Protokoll einer gescheiterten Aktion (Karte #239, ADR-0001).
- Ein eigener Statuscode für „Git gesperrt“ (etwa 503) — Frage der Abweisungen (ADR-0003).
- Eine Vorprüfung auf `index.lock` vor dem Schreiben (Option D als Zusatz).
- ` M` in `git status` nach nachträglich geänderten `eol`-Attributen bei leerem `git diff` (akzeptierte Schwäche N4).

## Implementierungshinweise

- `in_head` liest den Modus mit `git ls-tree -r -z HEAD -- <pfade>` (Zeile `<modus> <art> <objekt>\t<pfad>`) statt `--name-only`; die Menge wird eine Abbildung Pfad → Modus. Ob die Inhalte einzeln (`cat-file --filters HEAD:<pfad>`) oder gesammelt (`cat-file --batch --filters`) gelesen werden, entscheidet der entwickler (N4 „Grenze“).
- Die Nachbardatei wie `Ordner::schreib` (`ziel.with_extension("kanbanD-tmp")`); Ausführbit über `std::os::unix::fs::PermissionsExt` vor dem Umbenennen setzen.
- `git diff --cached --quiet -- <pfade>` gelingt bei gehaltener Sperre (Probe N4, 2026-11-22).
- Rechte im Test nach dem Aufruf wieder auf `0755` setzen, sonst räumt `tempfile` nicht auf.

## Offene Fragen

- keine, die den Bau aufhält.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ein Mensch hält mit `git status` für einen Augenblick `.git/index.lock` → kanbanD schreibt eine Aufgabendatei, `git add` scheitert → die Rücknahme ruft heute `checkout`, das an derselben Sperre scheitert → die Datei bleibt geändert und geht mit dem nächsten Commit mit. Liest die Rücknahme den alten Inhalt stattdessen aus dem Objekt von HEAD (`cat-file` braucht keine Sperre) und schreibt ihn selbst über Nachbardatei und Umbenennen zurück, hängt der Zustand des Arbeitsbaums nicht mehr an der Sperre. Der Index war bei gehaltener Sperre ohnehin unverändert, deshalb genügt es, sein Zurücksetzen nach bestem Vermögen zu versuchen und nur eine echte Abweichung zu melden. Beobachtbar: nach dem Entfernen der Sperre ist `git status --porcelain` leer.

## Notizen

- Priorität: Hoch (im Betrieb erreichbar; der Rest geht still in einen fremden Commit)
- Betroffene Nutzer/Systeme: jeder Schreibweg (Oberfläche und API), jeder Ordner, in dem auch ein Mensch oder ein Werkzeug Git benutzt
- Workaround: nach einer 500 mit „index.lock“ die Sperre entfernen und `git checkout HEAD -- <pfade aus der Meldung>` von Hand
- Grundlage: ADR-0005 Nachtrag N4 (`2d24a27d`), Kommentar des architekt auf Karte #244 vom 2026-11-22
- AK 5 (Modus), AK 7 (Transkripte-Test) und Mutant m6 ergänzt der planer zu den vier Proben aus N4 (Bericht Lauf 244-planer-1): AK 5 und m2/m3 setzen N4 Punkt 4 prüfbar um; AK 7, weil der bestehende Test `.git/index.lock` als Auslöser einer misslingenden Rücknahme nutzt und nach dem Fix sonst rot wird; m6, weil im Aufbau von AK 3 keine Nachbardatei entstehen kann.
