---
id: R00263
status: Neu
datum: 2026-11-27
---

# R00263: Lizenzhinweise der eingebetteten Rust-Pakete mitliefern

## Beschreibung

Karte #250, gefunden vom architekt bei #243. kanbanD bettet die Oberfläche als eine einzige Programmdatei ein und trägt damit auch die Rust-Pakete mit, aus denen es gebaut ist (`Cargo.lock`: 161 Pakete, Stand 2026-11-21). Viele stehen unter MIT oder Apache-2.0; beide Lizenzen verlangen, dass Lizenz- und Urheberhinweis (bei Apache-2.0 zusätzlich der Lizenztext) bei der Weitergabe mitkommt. Heute liefert kanbanD keinen dieser Hinweise mit.

[ADR-0045](../Dokumentation/ADRs/0045-lizenzhinweise-erzeugt-aus-cargo-lock-eingebettet-unter-web.md) entscheidet Option A: `Cargo.lock` ist die einzige Quelle der Wahrheit; ein Kommando im Repository erzeugt daraus `web/LIZENZEN.md`, die Datei wird committet und über die vorhandene Hausform (`dateien!`, Route `/web/{*name}`, Muster `web/vendor/LICENSE-prism.txt`) als `/web/LIZENZEN.md` ausgeliefert; zwei Wächter halten sie davon ab, still falsch zu werden. Kein neues Crate, kein neues Fremdwerkzeug. Zuschnitt des architekt: `gemeinsam/scratchpad/arch-250/hinweise-planer.md` (3 Scheiben, Proben P1–P3, Mutanten M1–M4).

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanken „Rust, eine Anwendung … die Oberfläche ist in das Programm eingebettet“ (Z. 144–147) und „keine Datenbank als Wahrheit“ (Z. 193): was das Programm an fremdem Werk enthält, liefert es mit den Bedingungen seiner Lizenz aus.

## Geschäftlicher Nutzen

Ohne diese Hinweise gibt kanbanD fremde Werk-MIT/Apache-2.0-Pakete weiter, ohne deren Lizenzbedingung zu erfüllen — ein Rechtsmangel in jeder ausgelieferten Fassung, heute 161 Pakete. Mit der Anforderung reist der Hinweis im Programm mit (Q2) und `Cargo.lock` bleibt die einzige Quelle (Q1): ein `cargo update` kann die Datei nicht unbemerkt veralten lassen, weil Gate und Release-Prüfung es melden.

## Funktionale Anforderungen

**Erzeugen und committen (Scheibe 1)**
- Ein Kommando im Repository erzeugt `web/LIZENZEN.md` aus dem aufgelösten Graph; Quelle der Wahrheit ist `Cargo.lock`, nicht eine zweite, von Hand gehaltene Liste.
- Ausgewählt werden nur die Kanten `normal` und `build` (keine `dev`) für die Release-Ziele Linux-x64 und Windows-x64; das Workspace-Paket kanbanD selbst ist ausgenommen. Jede ausgenommene Abhängigkeit trägt einen Grund aus fester Liste: `dev`, `build`, `plattformfremd`, `workspace`.
- Je enthaltenem Paket stehen **Name, Version, Lizenz und Urheber-/Lizenztext**. Fehlt einem Paket eine Lizenzangabe, ist das ein Fehler mit Paketnamen, kein stiller Eintrag.
- Kein neues Crate (`serde_json` ist da) und kein neues Fremdwerkzeug (Q3); die Logik liegt hinter einer Cargo-Feature, damit `cargo install --path` und `RUSTFLAGS=-D warnings` nichts Totes sehen.

**Ausliefern (Scheibe 2)**
- `web/LIZENZEN.md` ist committet, wird in `dateien!` eingebettet und über `GET /web/LIZENZEN.md` mit `text/plain; charset=utf-8` ausgeliefert.
- Der Release-Ablauf kopiert die Datei ins Archiv; `README.md` nennt `/web/LIZENZEN.md`, damit das Archiv allein genügt.

**Wachen (Scheibe 3)**
- Gate-Test `tests/lizenzen.rs` (offline, gegen `Cargo.lock` und die Datei): Menge aus `Cargo.lock` = enthaltene ∪ ausgenommene (jede Ausnahme mit Grund), vier Felder je enthaltenem Paket, dev-Pakete nicht enthalten.
- Release-Schritt `… --pruefen`: erzeugt neu, vergleicht byteweise und bricht mit Exit ≠ 0, wenn die Datei veraltet ist, und nennt das fehlende Paket.

## Nicht-funktionale Anforderungen

- Keine Wanduhr-Grenze im Gate; der Gate-Test ist offline und deterministisch.
- Ein-Datei-Programm bleibt: Empfänger finden den Hinweis ohne den Registrarcache des Erzeugers (Q2).
- Kein neuer Build-Schritt und keine neue Abhängigkeit (Q3, `gemeinsam/regeln.md` „Quellen“).
- `/web/LIZENZEN.md` ist für jeden mit Zugriff auf die Instanz lesbar — gewollt, es ist ein Hinweis, kein Geheimnis.

## Akzeptanzkriterien

**Ausgangslage:** kanbanD auf einem Wegwerf-Ordner mit `--port 0` gestartet (wie `tests/statisch_faerben.rs`); das Repository trägt `Cargo.lock` mit 161 Paketen (Stand 2026-11-21) und den gefüllten Registrarcache. Heute: `web/LIZENZEN.md` fehlt, `GET /web/LIZENZEN.md` → 404.

### Erzeugen und committen

- [ ] **AK 1 (Scheibe 1, Probe P2a/P2b):** Gegeben `Cargo.lock`. Wenn der Generator läuft, dann entsteht `web/LIZENZEN.md`, und die Menge der Pakete aus `Cargo.lock` ist die **Vereinigung** der enthaltenen und der ausgenommenen; jede Ausnahme nennt einen Grund aus `dev`, `build`, `plattformfremd`, `workspace`. Je enthaltenem Paket stehen die vier Felder `Name`, `Version`, `Lizenz`, Urhebertext.
- [ ] **AK 2 (Scheibe 1, Positivkontrolle P2c):** Gegeben dieselbe Ausgangslage. Wenn die Datei erzeugt ist, dann sind die dev-Abhängigkeiten `tower`, `tempfile`, `reqwest` **nicht** enthalten (Rechnung: dev-Kanten sind keine Weitergabe, #239).

### Ausliefern

- [ ] **AK 3 (Scheibe 2, Probe P1):** Gegeben kanbanD läuft. Wenn ich `GET /web/LIZENZEN.md` aufrufe, dann Status 200 und `Content-Type` genau `text/plain; charset=utf-8`, und der Rumpf enthält je enthaltenem Paket die vier Felder. Heute: 404 „nicht gefunden“.
- [ ] **AK 4 (Scheibe 2, Q2):** Gegeben ein Archiv aus `release.yml` (oder der Archivabschnitt lokal ausgeführt). Wenn es entpackt wird, dann liegt `LIZENZEN.md` neben dem Programm, und `README.md` nennt `/web/LIZENZEN.md`.

### Wachen

- [ ] **AK 5 (Scheibe 3, Gate-Test offline):** Gegeben die committete Datei und `Cargo.lock` am selben Stand. Wenn `tests/lizenzen.rs` läuft, dann grün (Menge vollständig, vier Felder je Paket, dev-Pakete nicht enthalten). Gegenproben (Mutanten, in eigener Kopie): einen Eintrag aus der Datei löschen, ein dev-Paket von Hand in die Ausnahmetabelle eintragen oder `Cargo.lock` um ein Paket erweitern (Datei nicht neu erzeugt) → je rot und mit Paketnamen.
- [ ] **AK 6 (Scheibe 3, Release-Prüfung P3):** Gegeben ein bewusst veralteter Stand (Datei älter als der aufgelöste Graph). Wenn `… --pruefen` läuft, dann Exit ≠ 0 und der fehlende Paketname. Gegenprobe: ein enthaltenes Paket steht fälschlich in der Ausnahmetabelle → Exit ≠ 0.

### Mutanten (alle müssen rot werden; in eigener Kopie, nicht im Worktree)

- [ ] **AK 5/6 Mutanten:** M1 Eintrag von Hand aus `web/LIZENZEN.md` gelöscht → AK 5 rot (P2a); M2 enthaltenes Paket von Hand in die Ausnahmetabelle → AK 6 rot; M3 `tower` aufgenommen → AK 2/AK 5 rot (P2c); M4 `Cargo.lock` um ein Paket erweitert, Datei nicht neu erzeugt → AK 5 rot (P2a).

## Betroffene Verzeichnisstruktur

- Erzeugung: neues `examples/lizenzen.rs` (Rust; `serde_json`; Cargo-Feature `lizenzen` mit `required-features`); erzeugt `web/LIZENZEN.md` (committet).
- Auslieferung: `src/web/statisch.rs` (`dateien!`), `.github/workflows/release.yml`, `README.md`.
- Wächter: `tests/lizenzen.rs` (Integration, offline); Release-Schritt `--pruefen` in `.github/workflows/release.yml`.
- Keine Änderung an `web/`-Oberfläche, kein `ux-review` (nur eine ausgelieferte Textdatei, keine Gestaltung).

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Siehe WBS I0253 (B1430–B1436). Erzeugen: Graph auflösen (B1430) → Lizenz- und Urhebertexte lesen (B1431) → Datei schreiben und Kommando hinter der Feature bereitstellen (B1432). Ausliefern: einbetten und Route (B1433) → Release-Archiv und README (B1434). Wachen: Gate-Test offline (B1435) und Release-Prüfschritt `--pruefen` (B1436).

### Hinweise

- Interactor-Regel: die Auslieferung ist ein dünner Adapter über `liefern` (bestehende Route `/web/{*name}`); die Erzeugung liegt in einer für sich testbaren Einheit (Graph + Ausnahmen + Format), Einstieg `examples/lizenzen.rs`.
- `cargo metadata --offline` bricht an einer Cache-Lücke ab (`bumpalo 3.20.4` gegen Cache `3.20.3`, ADR-0045 „Kontext“); der Generator braucht den aufgelösten Graph nach `cargo fetch`. Probe P0: 151 von 161 Paketen im Cache, alle mit Lizenzangabe.
- `RUSTFLAGS=-D warnings`: Logik hinter die Cargo-Feature `lizenzen` legen, sonst tote Warnungen im Release.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`:

- **Unit (rein):** Auswahl und Ausnahmegründe aus dem aufgelösten Graph, Formatierung eines Paketeintrags — ohne Dateisystem.
- **Integration (offline):** `tests/lizenzen.rs` gegen `Cargo.lock` und die committete Datei (AK 5); `GET /web/LIZENZEN.md` gegen das gestartete Programm (AK 3).
- **E2E:** entfällt — keine Oberfläche; die Route ist über die Integration abgedeckt (kein Hot Path, kein Browser-Eigenes).

## Abhängigkeiten

- **Abhängig von:** I0002 (grün, das Programm liefert die Oberfläche aus); innerhalb der Interaction baut F0191 und F0192 auf F0190 (Scheibe 1 erzeugt die Datei) — F0191 und F0192 sind danach parallel baubar.
- **Blockiert:** nichts.

## Offene Fragen

- Keine, die den Bau aufhält. Umsetzungshinweis statt Rückfrage: welche `--filter-platform`-Ziele die Release-Builds genau bedienen (ADR-0045 nennt Linux-x64 und Windows-x64); folgt der Release-Ablauf dem, ist nichts zu entscheiden.

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist der Fund bei #243: kanbanD liefert die eingebetteten fremden Pakete weiter, aber keinen ihrer Lizenzhinweise — ein Rechtsmangel, der ohne Zutun mit jedem `cargo update` wächst (161 Pakete). Nimmt die Erzeugung `Cargo.lock` als einzige Quelle und committet die Datei (AK 1), reist der Hinweis über die vorhandene Hausform im Programm mit und ist über `GET /web/LIZENZEN.md` und im Archiv auffindbar (AK 3, AK 4), ohne das Ein-Datei-Programm aufzugeben. Weil die committete Datei veralten kann, machen Gate-Test und Release-Prüfung sie zur erzwungenen Aussage statt zu einem Wunsch (AK 5, AK 6): Fehlt ein Paket, wird es sichtbar, bevor ein Programm ohne den Hinweis ausgeliefert wird. Der Hebel liegt gerade hier und nicht in einer Handpflege: eine zweite, von Hand geführte Liste wäre selbst die Fehlerquelle, die sie beheben soll (ADR-0045 Option B).

## Missing-Docs

- Keine (rein technische Anforderung ohne Fachbegriff).

## Notizen

- Verworfene Alternativen (ADR-0045): Option B — von Hand gepflegte Hinweisdatei (driftet mit jedem `cargo update`) und Option C — Fremdwerkzeug `cargo-about` (neues Werkzeug ohne tragenden Grund, Q3). Gewählt Option A.
- WBS-Einordnung des planers: neuer Knoten I0253 unter **D0001** (Start und Einrichtung), Geschwister der vorhandenen I0217 „Lizenz der eingebetteten Schriften (OFL) mit ausliefern“ (R00227) — dieselbe Auslieferung fremder Lizenzen über `/web/`. Der Hinweis des architekt nennt „D0003/D0004-nahe“; dem folgt der planer nicht, weil der einzige vorhandene Lizenz-Auslieferungs-Knoten I0217 unter D0001 sitzt (Begründung im Bericht).
- Aufteilung in drei Scheiben (erzeugen/committen, ausliefern, wachen) vom architekt; als drei Features geplant, jedes für sich auslieferbar, F0191 und F0192 nach F0190 parallel.
- Umfang (Zählung, Stand dieser Planung): 7 Bubbles; Richtwert 5,5–11 h ungemessen (Summe der Spannen, Hypothese des planers).
