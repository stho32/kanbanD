---
id: A00011
name: Arbeits-Repository (lesend)
code: git/arbeitsrepo
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/git/arbeitsrepo.rs
verwandt:
  - A00007
domaene: []
blackbox: Gebaut ist der Startpunkt mit Wurzel und Commit-Auflösung (A1); die Lese-Scheiben (Zustände, Diff) kommen mit den Karten #207ff und verfeinern den Baustein dann.
---

# Arbeits-Repository (lesend)

## Verantwortung

Das Arbeits-Repository (lesend) startet Git in den Arbeits-Repositories des Registers, ausschließlich lesend, mit gehärteter Umgebung und Zeitgrenze.

## Schnittstellen

- eingehend: `arbeitsrepo::wurzel(board_ordner, anwendung)` (Repository-Wurzel aus dem Register), `arbeitsrepo::commit_aufloesen(wurzel, hash)` (Kurz-Hash zum vollen Commit-Hash), `arbeitsrepo::laufen(kommando, zeitgrenze)`, Zähler `arbeitsrepo::aufrufe()` für Proben
- ausgehend: Kindprozess `git -C <wurzel> -c core.fsmonitor=false -c core.hooksPath=/dev/null <befehl> …`, Argumentliste ohne Shell, Befehl nur aus der abschließenden Liste `Befehl` (heute `rev-parse`)

## Abhaengigkeiten

- [A00006 Modell](A00006-modell.md) (`Anwendung` aus dem Register)
- [A00007 Git](A00007-git.md) — Nachbar, bewusst getrennt: A00007 schreibt im Board-Repository, dieser Baustein liest in Arbeits-Repositories und kennt kein `add`, `commit`, `checkout`, `fetch`, `gc`
- extern: `git` im Pfad

## Entscheidungen

- [ADR-0032: Commit-Verweise an der Karte, Diff live und nur lesend](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) — gebaut (#207, R00202, Punkt 3): einziger Ort, der Git in Arbeits-Repositories startet; nur lesende Befehle aus einer festen Liste, `--end-of-options` vor jedem Verweis, Zeitgrenze 10 s (`ZEITGRENZE`), läuft ohne die Sperre des Board-Ordners. Soll, noch nicht gebaut: weitere Befehle (`cat-file`, `log`, `rev-list`, `diff`, `diff-tree`, `merge-base`, `for-each-ref`) mit den Scheiben, die sie brauchen
- [ADR-0032 Nachtrag N1](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-19-n1-hinterlegen-während-der-arbeit-erreichbarkeit-gegen-alle-zweige-ersetzen-alt--neu-karte-207) — Soll (#207): Zustände mit Zweigliste über `for-each-ref --contains`, flüchtiger Cache im Speicher; gehört, soweit es Git startet, in diesen Baustein
- [ADR-0032 Nachtrag N2](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-19-n2-schreibweise-von-commits-legacy-mit-einem-eintrag-gehärteter-startpunkt-karte-207-architektur-review-s1s3-o1o3) — gebaut (`3279e9f9`, #207): Umgebung gehärtet (`GIT_CONFIG_*`, Pager, ext diff, `GIT_EXEC_PATH`, `ASKPASS`, `SSH_COMMAND` entfernt; `NOSYSTEM`, `GLOBAL=/dev/null`; `core.fsmonitor` und `core.hooksPath` je Befehl gesperrt); `safe.directory` aus der Benutzerkonfiguration wirkt nicht. Soll für die Diff-Scheibe: `--no-ext-diff --no-textconv --no-color -c core.quotepath=off` aus `Befehl` abgeleitet, Prozessgruppe bei Zeitüberschreitung beenden. Vorschrift: `Command::new("git")` außerhalb von Tests nur in `src/git.rs`, `src/start/ordner.rs`, `src/git/arbeitsrepo.rs`

## Offene Fragen

- Das Board-Git (`src/git.rs:360,366`) läuft ohne Zeitgrenze und mit der Umgebung des Betreibers; ob es denselben Startpunkt nutzt, ist offen (ADR-0032 N2.5, keine Entscheidung).
- Die Fitness Function „`Command::new("git")` nur an drei Orten“ hat noch keinen Test.

## Notizen / Quellen

- Verfeinert aus A00007 nach Architektur-Review S3 (Karte #207): `src/git/arbeitsrepo.rs` war in keinem Baustein verankert, und „committen im Board-Repository“ und „lesen in Arbeits-Repositories“ sind zwei Verantwortungen mit verschiedenem Vertrauen (eigenes Repository gegenüber fremdem), anderer Umgebung und anderer Sperre. Ein eigener Baustein hält beide Sätze ohne „und“.
- Ist: `laufen` beendet bei Zeitüberschreitung nur den Kindprozess (`kill`), nicht die Prozessgruppe.
- Worktrees teilen Objektdatenbank und `refs/heads` mit dem Hauptrepo; das Modul liest deshalb immer über die Wurzel aus dem Register (ADR-0032 N1).
