---
id: A00010
name: Verlauf
code: verlauf
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/verlauf.rs
verwandt: []
domaene: []
---

# Verlauf

## Verantwortung

Der Verlauf rechnet aus den Git-Ständen von Board- und Aufgabendateien ab: die Bewegungen eines Boards für die Berichte (R00042) und den Weg einer einzelnen Karte für den Karten-Verlauf (R00123, [ADR-0021](../ADRs/0021-karten-verlauf-aus-der-git-geschichte.md)) — rein, ohne Git-Aufruf und ohne zweiten Speicher.

## Schnittstellen

- eingehend: `verlauf::bewegungen(staende, spalten, jetzt)` → `Bewegungen` (R00042), `verlauf::zuege(staende)` → `Vec<Zug>`, `verlauf::verlauf(staende, heute)` → `Verlauf`, `verlauf::kartenverlauf(nummer, aufgabe, boards, loeschung)` → `Kartenverlauf` (R00123); die Stände kommen von [Git](A00007-git.md), das Modell von [A00006](A00006-modell.md).
- ausgehend: keine — der Baustein ist rein (kein Datei-, Git- oder HTTP-Zugriff).

## Abhaengigkeiten

- [A00005 Format](A00005-format.md) (`format::aufgabe::ZEITFORMAT` für die Zeitpunkte), [A00006 Modell](A00006-modell.md) (`Board`), [A00007 Git](A00007-git.md) (`git::Stand` und `git::Autor` als **reines Datenobjekt**)

## Entscheidungen

- [ADR-0021: Karten-Verlauf aus der Git-Geschichte gerechnet — ableiten statt speichern](../ADRs/0021-karten-verlauf-aus-der-git-geschichte.md) — gebaut (#119, R00123, `902a97b`): `verlauf::kartenverlauf` (`src/verlauf.rs:165`) führt die Stände der Aufgabendatei (je `Aufgabenstand { zeitpunkt, archiviert, autor }`, `:156`) und jeder Board-Datei (`Vec<(NaiveDateTime, Board, git::Autor)>`) zu `KartenEintrag`/`Kartenverlauf` zusammen; die Art `Kartenart` (`:118`) ist `erstellt`/`bewegt`/`archiviert`/`zurueckgeholt`/`geloescht`, ein Commit je Aktion ist ein Eintrag, ein Commit, der anlegt und zugleich aufnimmt, ist **ein** `erstellt`-Eintrag; neueste zuerst. Der `Autor` kommt aus [A00007](A00007-git.md) als reines Datenobjekt (`Autor::wer()`), es gibt keinen Commit-Weg und keinen neuen Schreibweg
- [ADR-0034: kanbanD ohne WBS — Register mit Repository, Phasen werden Spalten](../ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) (Akzeptiert, #224–#228) — Soll: `Phasenkarte` und `uebersprungen` in den Bewegungen entfallen

## Offene Fragen

## Notizen / Quellen

- `src/verlauf.rs` ist rein (kein Git-, Datei- oder HTTP-Zugriff): die Stände kommen fertig gereicht (gelesen in `src/dienst/verlauf.rs` über `git::staende`). Geteilt mit den Berichten: `kartenverlauf` (R00123) und `bewegungen` (R00042) bauen auf derselben `zuege`-Rechnung (`:90`) auf, damit die Wechsel-Logik nicht doppelt entsteht.
- Der Baustein entstand 2026-11-12 aus dem Architektur-Review #119 (S2): `src/verlauf.rs` stand unter [A00002](A00002-kanband-programm.md) in `ausgenommen`; R00123 ändert ihn erheblich (neuer Karten-Verlauf) und macht ihn damit zum Baustein (Regel „Bausteine, sobald eine Karte sie ändert“).
- nachgeführt 2026-11-12 nach R00123 (ADR-0021): `Kartenart` (`:118`), `KartenEintrag` (`:128`), `Kartenverlauf` (`:144`, mit `leer()`) und `Aufgabenstand` (`:156`) ergänzt; `verlauf`/`bewegungen`/`zuege` (R00042) unverändert.
- Zusätzlicher Leser außerhalb dieses Bausteins: `src/phasen.rs` (in A00002 `ausgenommen`) liefert `Phasenfolge` für `Phasenkarte` — der Verlauf bleibt davon abhängig, ohne es zu kennen.
