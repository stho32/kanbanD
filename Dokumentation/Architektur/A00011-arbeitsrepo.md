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
blackbox: Einziger Startort für Git in Arbeits-Repositories, gebaut mit A1–A4 (#207, #211, #213, #214) — Wurzel, Objekte, Metadaten, Zweigspitzen und Erreichbarkeit (Z5), Diff eines Commits und Läufe über viele Commits, Köpfe und Erst-Eltern-Linie; sieben lesende Befehle, gehärtete Umgebung, Gesamtgrenze und Bytegrenze.
---

# Arbeits-Repository (lesend)

## Verantwortung

Das Arbeits-Repository (lesend) startet Git in den Arbeits-Repositories des Registers, ausschließlich lesend, mit gehärteter Umgebung und Zeitgrenze.

## Schnittstellen

- eingehend (Ist, `src/git/arbeitsrepo.rs`):
  - Register und Objekte: `wurzel`/`wurzel_bis` (Wurzel aus dem Register, mit Frist), `commit_aufloesen` (Hinterlegen), `objekte_pruefen` (`cat-file --batch-check`), `metadaten` (`log --no-walk`, Elternteile, Titel, Zähler; Soll #233: vorher ein Zähllauf `--no-renames --name-only`, je Commit das Urteil `Umbenennungssuche` — bis 10.000 Einträge `-M50% -l1000`, darüber `-M100%` —, das jeder Lauf `diff_tree` dieses Commits übernimmt, ADR-0032 N11)
  - Zweige: `fingerabdruck`, `fingerabdruck_probe`, `erreichbar` (Z5: ein Lauf `rev-list --parents`, Erreichbarkeit im Speicher, ADR-0032 N3.4)
  - Diff: `diff_tree` (ein Commit gegen seinen ersten Elternteil oder zwei Bäume; Liste, Zähler, Patch), `diff_tree_viele` (`diff-tree --stdin` über viele Commits, Zeilen `<commit> <erster Elternteil>`; Namenslauf und Folge-Läufe, N6.2/N7.1)
  - Gesamt-Diff: `koepfe` (`merge-base --independent`), `linie` (`rev-list --first-parent --parents --max-count`)
  - Soll nach ADR-0038 (#220): Nachfolgersuche — Fenster der Zweig-Commits ab dem Autordatum (`rev-list --since --max-count`), `patch-id --stable` über `stdin`
  - Startort: `git` (ganz oder Fehler, Zeilengrenze), `git_teil` (Bytegrenze, Teil nur für `diff-tree`, Eingabe auf `stdin`), `laufen`; Zähler `aufrufe()` für Proben
- ausgehend: Kindprozess `git -C <wurzel> -c core.fsmonitor=false -c core.hooksPath=/dev/null [Schalter des Befehls] <befehl> … --end-of-options <revisionen> -- [pfade]`, Argumentliste ohne Shell, Umgebung ohne System- und Benutzerkonfiguration, mit `GIT_OPTIONAL_LOCKS=0`, `GIT_NO_REPLACE_OBJECTS=1`; Befehl nur aus der abschließenden Liste `Befehl` mit sieben Einträgen: `rev-parse`, `cat-file`, `log`, `for-each-ref`, `rev-list`, `diff-tree`, `merge-base` (nur `--independent`)

## Abhaengigkeiten

- [A00006 Modell](A00006-modell.md) (`Anwendung` aus dem Register)
- [A00007 Git](A00007-git.md) — Nachbar, bewusst getrennt: A00007 schreibt im Board-Repository, dieser Baustein liest in Arbeits-Repositories und kennt kein `add`, `commit`, `checkout`, `fetch`, `gc`
- extern: `git` im Pfad

## Entscheidungen

- [ADR-0032: Commit-Verweise an der Karte, Diff live und nur lesend](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md) — gebaut (#207, R00202, Punkt 3): einziger Ort, der Git in Arbeits-Repositories startet; nur lesende Befehle aus einer festen Liste, `--end-of-options` vor jedem Verweis, Zeitgrenze 10 s (`ZEITGRENZE`), läuft ohne die Sperre des Board-Ordners. Gebaut sind seitdem `cat-file`, `log`, `for-each-ref`, `rev-list`, `diff-tree`, `merge-base`; `diff` bleibt draußen (N4.6)
- [ADR-0032 Nachtrag N1](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-19-n1-hinterlegen-während-der-arbeit-erreichbarkeit-gegen-alle-zweige-ersetzen-alt--neu-karte-207) — gebaut (#211): Zustände mit Zweigliste über Z5 (`erreichbar`, Rückfall nach N3.4 statt `for-each-ref --contains`), flüchtiger Cache im Dienst
- [ADR-0032 Nachtrag N2](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-19-n2-schreibweise-von-commits-legacy-mit-einem-eintrag-gehärteter-startpunkt-karte-207-architektur-review-s1s3-o1o3) — gebaut (`3279e9f9`, #207): Umgebung gehärtet (`GIT_CONFIG_*`, Pager, ext diff, `GIT_EXEC_PATH`, `ASKPASS`, `SSH_COMMAND` entfernt; `NOSYSTEM`, `GLOBAL=/dev/null`; `core.fsmonitor` und `core.hooksPath` je Befehl gesperrt); `safe.directory` aus der Benutzerkonfiguration wirkt nicht. Soll für die Diff-Scheibe: `--no-ext-diff --no-textconv --no-color -c core.quotepath=off` aus `Befehl` abgeleitet, Prozessgruppe bei Zeitüberschreitung beenden. Vorschrift: `Command::new("git")` außerhalb von Tests nur in `src/git.rs`, `src/start/ordner.rs`, `src/git/arbeitsrepo.rs`
- [ADR-0032 Nachtrag N4](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-19-n4-diff-eines-commits--gesamtgrenze-zulassung-zählweise-lauf-mit-teilausgabe-hinweise-befehl-diff-tree-karte-213-scheibe-a3-r00206-fragen-des-planers) — gebaut (#213, A3): Befehl `diff-tree` (nicht `diff`), Schalter je Befehl statt einer gemeinsamen Konstante, zweite Lauf-Funktion `git_teil` mit Bytegrenze und `Teil` (nur für `DiffTree`; `git()` liefert nie einen Teil), Gesamtgrenze des Diffs 10 s/15 s
- [ADR-0032 Nachtrag N6](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-20-n6-gesamt-diff-der-karte--basis-spanne-klassifikation-je-datei-merges-antwortform-mit-folge-einträgen-und-summen-grenzen-prozesszahl-datei-formatpatch-etag-karte-214-scheibe-a4) — gebaut (#214, A4): neuer Befehl `merge-base` (nur `--independent`, ohne Schalter, kein Teil); `git_teil` mit Eingabe auf `stdin` für `diff-tree --stdin` (Namenslauf `--raw -z --no-renames`, Folge-Läufe), Zeilen `<commit> <erster Elternteil>`; Gesamt-Diff höchstens 15 Git-Prozesse je Anwendung, unabhängig von der Zahl der Commits

- [ADR-0032 Nachtrag N7](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-20-n7-gruppen-über-umbenennungen-der-karte-abgeschlossene-pfadangaben-namen-über-4-mb-gehärteter-startort-etag-über-alle-verweise-karte-214-nacharbeit-1) — gebaut (#214, Nacharbeit 1): Namenslauf mit `-M50% -l1000`; `--` immer hinter den Revisionen (`git_teil`, `metadaten`, `linie`); `GIT_NO_REPLACE_OBJECTS=1`
- [ADR-0032 Nachtrag N8](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-21-n8-folge-nur-für-belastete-pfade-netto-unveränderte-kartenpfade-erscheinen-nirgends-fremd_dazwischen-nur-mit-fremdem-commit-karte-234) — Soll (#234): Folge-Pfade nur belastet oder aus einer verdorbenen Gruppe (N8.6: belastet oder ein Pfad in einem verworfenen Netto-Eintrag, bis zum Fixpunkt); `datei=` mit Netto-Liste bis 20 MB, hinter dem Schnitt eigener 404 (N8.6); netto unveränderte Kartenpfade erscheinen nirgends (`datei=` 404); `fremd_dazwischen` nur mit `commits` ≥ 1 (Ist: `src/modell/gesamt_diff.rs:254–258`, `src/dienst/gesamt_diff.rs:308–310`)
- [ADR-0032 Nachtrag N11](../ADRs/0032-commit-verweise-an-der-karte-diff-live-und-nur-lesend.md#nachtrag-2026-11-23-n11-sehr-große-commits--über-10000-einträgen-nur-genaue-umbenennungen-ein-urteil-je-commit-für-alle-läufe-karte-233) — Soll (#233): Zähllauf in `metadaten`, Schwelle 10.000 Einträge, darüber `-M100%` in Metadaten und allen Läufen des Diffs je Commit, Hinweis `umbenennung_eingeschraenkt`; `diff_tree_viele` und Netto-Läufe des Gesamt-Diffs bleiben bei `-M50% -l1000`
- [ADR-0038: Nachfolger eines verwaisten Commits über `patch-id` mit Vorfilter](../ADRs/0038-nachfolger-eines-verwaisten-commits-ueber-patch-id-mit-vorfilter.md) — Soll, Vorgeschlagen bis zur Sondierung (#220, A5): achter Befehl `patch-id` (nur `--stable`, Eingabe nur über `stdin`, kein Teil, keine Schalter); die Suche läuft über bestehende Funktionen (`rev-list`-Fenster, `diff_tree_viele` mit `--raw` als Vorfilter und mit `-p`), alle Prozesse nacheinander in einem Platz der Lesegrenze, keine Röhre zwischen zwei Git-Prozessen

## Offene Fragen

- Das Board-Git (`src/git.rs:360,366`) läuft ohne Zeitgrenze und mit der Umgebung des Betreibers; ob es denselben Startpunkt nutzt, ist offen (ADR-0032 N2.5, keine Entscheidung).
- Die Fitness Function „`Command::new("git")` nur an drei Orten“ hat noch keinen Test (Sollte des architektur-reviewers, #214).
- Der Diff je Commit (`datei=`) schließt seine Pfadangabe noch nicht nach ADR-0032 N7.2 ab: `?commit=…&datei=d/x` ergibt 500 bei Typwechsel (eigene Karte).

## Notizen / Quellen

- Verfeinert aus A00007 nach Architektur-Review S3 (Karte #207): `src/git/arbeitsrepo.rs` war in keinem Baustein verankert, und „committen im Board-Repository“ und „lesen in Arbeits-Repositories“ sind zwei Verantwortungen mit verschiedenem Vertrauen (eigenes Repository gegenüber fremdem), anderer Umgebung und anderer Sperre. Ein eigener Baustein hält beide Sätze ohne „und“.
- Worktrees teilen Objektdatenbank und `refs/heads` mit dem Hauptrepo; das Modul liest deshalb immer über die Wurzel aus dem Register (ADR-0032 N1).
