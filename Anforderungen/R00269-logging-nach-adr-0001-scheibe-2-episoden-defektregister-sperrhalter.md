---
id: R00269
status: Neu
datum: 2026-11-27
---

# R00269: Logging nach ADR-0001, Scheibe 2 — Episoden der Kapazitätsgrenzen, Defektregister und Haltezeit der Schreibsperre

## Beschreibung

kanbanD protokolliert abgewiesene Anfragen seit Scheibe 1 (R00258, Karte #239) mit genau einer Zeile je Anfrage. Das ist für Einzelfälle richtig, flutet aber bei den beiden Kapazitätsgrenzen: solange die Lesegrenze belegt ist oder das Antwortbudget ausgeschöpft ist, hinterlässt jede abgewiesene Anfrage eine eigene Zeile. Ebenso hinterlässt eine defekte Aufgabendatei bei jeder vollständigen Lesung eine neue Spur, und eine lange gehaltene Schreibsperre ist heute gar nicht sichtbar. ADR-0001 Nachtrag N1 regelt das in N1.4 Regel 5/6 (Episoden), N1.5 (Defektregister) und N1.6 (Sperrhalter, Messwert der Lesegrenze). Diese Anforderung setzt den Nachtrag N1 für Scheibe 2 um; Maßstab ist `Dokumentation/ADRs/0001-logging-konzept.md`, Nachtrag N1. Karte #272, Labels `fehlerpfad`, `sicherheit`.

Heute (Stand vor #272): Jede 503 der Lesegrenze und des Antwortbudgets schreibt eine eigene ` WARN abgewiesen `-Zeile (gewollter Zwischenstand, PO Z. 703). Eine defekte Datei wird bei jeder vollständigen Lesung erneut gelesen, aber nicht protokolliert; `DefekteDatei` existiert bereits als Rückgabewert der drei Leser (`src/ablage.rs`), ein Register gibt es nicht. Einen `Sperrhalter` gibt es nicht; `Ordner::gesperrt` bzw. `Mutex::lock` liefert einen `MutexGuard<'_, ()>`, und keine Zeile nennt die Haltezeit. Der Messwert der Lesegrenze (`belegt()`) ist seit N1.6 Regel 3 öffentlich, wird aber nur im Test gelesen.

Zahlt ein auf: [Vision](R00000-vision.md) — Menschen und Agenten arbeiten über dieselbe API am selben Ordner; wer eine Instanz betreibt, muss einen Sturm von Abweisungen als eine Episode nachlesen können, eine defekte Datei einmal statt bei jeder Abfrage sehen und eine lange gehaltene Schreibsperre erkennen, ohne den Board-Ordner (Git) zu verschmutzen und ohne Inhalte ins Log zu schreiben.

### Domänenbezug

Kein Eintrag im Glossar betroffen. „Episode“, „Defektregister“, „Sperrhalter“ und „Haltezeit“ sind Begriffe aus ADR-0001 N1.4–N1.6 und haben im Glossar keinen Eintrag.

## Geschäftlicher Nutzen

Ein Sturm von 503-Antworten ist für den Betreiber heute nicht als ein Ereignis lesbar: 200 Abweisungen erzeugen 200 Zeilen, und der eine Messwert (wie viele Plätze belegt waren, wie viele Abweisungen es waren) geht unter. Eine defekte Datei erzeugt bei jeder Abfrage eine neue Spur, obwohl sie dieselbe Datei ist; der Betreiber kann nicht sehen, ob sie repariert wurde. Und eine Schreibsperre, die eine Sekunde oder länger gehalten wird, ist die Ursache für stockende Züge, die heute spurlos bleibt. Nach #272 gilt: eine Zeile je Episode, eine Warning je defekter Datei und Episode, eine Warning ab 1 s Haltezeit — jeweils mit den Feldern, die der Betrieb braucht, und ohne Inhalt.

## Funktionale Anforderungen

- FA 1: Für die beiden Kapazitätsgrenzen `lesegrenze` und `antwortbudget` führt das Protokoll je Ursache eine Episode. Die erste Abweisung einer Episode schreibt die volle ` WARN abgewiesen `-Zeile mit `episode=beginn`, `ursache=…`, `belegt=<belegt>/<kapazität>` (Lesegrenze) bzw. `frei_kb=<kb>` (Antwortbudget) und den Feldern aus N1.4 Regel 2; jede weitere Abweisung derselben Episode wird nur gezählt. Nach 10 s ohne Abweisung derselben Ursache endet die Episode mit genau einer ` INFO Episode beendet `-Zeile, die `ursache=…`, `abweisungen=<n>`, `belegt_max=<n>` (Lesegrenze) und `dauer_ms=<n>` nennt. Eine spätere Abweisung beginnt eine neue Episode (`episode=beginn`).
- FA 2: Die Episodenlogik ist eine reine Funktion `beobachten(ursache, jetzt, stand) -> Option<Zeile>` mit übergebenem Zeitpunkt; sie liest keine Uhr. Der Zustand wird je Instanz gehalten, nicht global.
- FA 3: Die Episode endet auch beim geordneten Beenden der Instanz (`App::ende` bzw. der Haken in `main` nach `axum::serve(…).with_graceful_shutdown(…).await`), damit die letzte Episode nicht offen bleibt. Ein zweiter Aufruf schreibt keine weitere Zeile.
- FA 4: `zeitgrenze` und alle 4xx bleiben bei genau einer Zeile je Anfrage. Die Episodenlogik gilt nur für `lesegrenze` und `antwortbudget`.
- FA 5: Das `Ordner` hält ein Defektregister je Art (Einstellungen, Boards, Aufgaben). Ein Pfad, der beim letzten vollständigen Lesen defekt war, wird genau einmal mit ` WARN defekte Datei ` und `aufgabe=#<n>` (Aufgaben; sonst nur Pfad) sowie dem relativen Pfad protokolliert; weitere Lesungen desselben Pfads schreiben keine Zeile. Fehlt der Pfad beim nächsten vollständigen Lesen oder ist er repariert, schreibt das Protokoll genau einmal ` INFO Datei repariert ` mit dem relativen Pfad; ein erneuter Defekt beginnt eine neue Episode mit neuer Warning. Nie Inhalt, nie Parser-Meldung, nie Schlüssel.
- FA 6: Die drei vollständigen Leser `Ordner::einstellungen`, `Ordner::boards` und `Ordner::aufgaben` melden ins Register. `Ordner::aufgabenpfad` und `Ordner::pfad_und_text` melden nicht (Entscheidung: ADR N1.5 nennt die drei vollständigen Leser; eine Einzelabfrage soll nicht bei jedem Aufruf eine neue Episode beginnen).
- FA 7: Ein `Sperrhalter` umschließt den `MutexGuard<'_, ()>` der Schreibsperre. Er trägt den Aufrufort über `#[track_caller]` (`Location::caller()`), misst die Wartezeit vor dem `lock()` und die Haltezeit im `Drop` und schreibt ab `SPERRSCHWELLE` (1 s) genau eine ` WARN Schreibsperre lange gehalten `-Zeile mit `halte_ms=`, `warte_ms=` und `ort=<datei>:<zeile>`. Unter der Schwelle schreibt er keine Zeile. Die drei Signaturen, die heute `&MutexGuard<'_, ()>` nehmen (`aufgabe_anlegen.rs:118/128`, `einstellungen.rs:199`), nehmen `&Sperrhalter<'_, ()>`; die Aufrufstelle `aufgabe_anlegen.rs:100` wird mitgezogen. Die übrigen Aufrufstellen bleiben unverändert.
- FA 8: Der Messwert der Lesegrenze (belegte Plätze, Abweisungen je Zeitraum) steht nur im Log (Beginn- und Ende-Zeile der Episode); es gibt keine neue API und keine neue Antwortform (PO Z. 703–705).
- FA 9: Zusagen bleiben: Rumpf und Status jeder Antwort sind unverändert; `zeitgrenze` und 4xx schreiben weiter eine Zeile je Anfrage; die 38 `gesperrt()`-Aufrufstellen am Stand bleiben 38; `Ordner::aufgabenpfad`/`pfad_und_text` und die API bleiben unverändert.

## Nicht-funktionale Anforderungen

- Sicherheit: keine Zeile enthält Rumpf, Beschreibung, Kommentar, Aufgaben-Titel, Commit-Text, Dateiinhalt, Parser-Meldung oder Query-String; ein Defektpfad wird nur relativ und ohne Inhalt genannt. Kein Wert bricht die Zeile (Log-Injektion).
- Determinismus: kein Test wartet auf eine Wanduhr; Zeitgrenzen (10 s Ruhe, 1 s Haltezeit) werden über übergebene Instants bzw. `Duration::ZERO` geprüft. Im Gate läuft keine Probe, die eine Last ≥ 6 verlangt; die Grenze der Maschine ist 6. Die Spanne der Zeitgrenzen läuft als Lastprobe nur ausdrücklich (ADR-0026 N7 Regel 13), nicht im Gate.
- Keine neue Abhängigkeit; `std::time::Instant` und die vorhandene `Uhr` reichen.
- Keine neue API, keine neue Antwortform; der Messwert bleibt im Log.

## Akzeptanzkriterien

Ebene je Kriterium in Klammern: **I** = Integrationstest in-process (Treiber wie die bestehenden Tests, Sammler-Senke), **U** = Unit-Test, **P** = Probe wörtlich aus dem Auftrag. „Heute“ nennt den Stand vor #272.

### Episoden der Kapazitätsgrenzen

- [ ] **AK 1 Probe P3 wörtlich** (I, P): Gegeben alle 4 Plätze der Lesegrenze belegt (wie `src/dienst/commits_lesen.rs:359`, nicht `:348`), die Frist der Testinstanz kurz; wenn 3× `GET /api/aufgaben/1/commits` abgewiesen wird, dann stehen 3× 503, und das Log hat genau 1 Zeile ` WARN abgewiesen ` mit `ursache=lesegrenze`, `episode=beginn`, `belegt=4/4`, `endpunkt=/api/aufgaben/{nr}/commits`, `aufgabe=#1`. `beobachten(lesegrenze, t0+9s)` → keine Zeile; `beobachten(…, t_letzte+10s)` → genau 1 ` INFO Episode beendet ` mit `abweisungen=3`, `belegt_max=4`; danach eine neue Abweisung → wieder `episode=beginn`. **Heute rot** (3 Zeilen, keine Episode, kein Ende).
- [ ] **AK 2 Variante Antwortbudget** (I): Gegeben ein kleines Antwortbudget (wie `src/dienst/transkripte.rs:818`); wenn 3 Anfragen abgewiesen werden, dann genau 1 ` WARN abgewiesen ` mit `ursache=antwortbudget`, `episode=beginn`, `frei_kb=<kb>`; danach `beobachten(…, t_letzte+10s)` → genau 1 ` INFO Episode beendet ` mit `abweisungen=3`. **Heute rot** (3 Zeilen, keine Episode).
- [ ] **AK 3 keine Zeile für weitere Abweisungen** (I): Gegeben eine offene Episode; wenn 20 weitere Anfragen derselben Ursache abgewiesen werden, dann bleibt es bei der einen Beginn-Zeile; `grep -c ' WARN abgewiesen '` wächst nicht. **Heute rot** (20 Zeilen).
- [ ] **AK 4 Ende nach 10 s Ruhe** (U): `beobachten` mit festen Instants: `t0+9s` → keine Ende-Zeile; `t0+10s` → genau eine; `t0+10s+1ms` → genau eine; eine Abweisung bei `t0+10s` beginnt eine neue Episode. Kein `sleep`. **Heute rot** (keine Funktion).
- [ ] **AK 5 neue Episode nach dem Ende** (U): nach dem Ende schreibt die nächste Abweisung wieder `episode=beginn`, und `abweisungen`/`belegt_max` beginnen neu. **Heute rot**.
- [ ] **AK 6 geordnetes Beenden** (I): Episode offen, `episoden_beenden()` (aus `main` nach dem geordneten Beenden) → genau 1 ` INFO Episode beendet `; ein zweiter Aufruf → keine Zeile. **Heute rot** (keine Episode).
- [ ] **AK 7 Zusage: `zeitgrenze` und 4xx je Anfrage** (I): 3 Anfragen an der Zeitgrenze → 3 Zeilen ` WARN abgewiesen ` mit `ursache=zeitgrenze`; 3 Abweisungen mit 4xx → 3 Zeilen. **Heute grün** (Test `ak_drei_abweisungen_je_503_grund_ergeben_drei_zeilen`, `src/web/mod.rs:2277`; darf nicht rot werden).

### Defektregister

- [ ] **AK 8 Probe P2 wörtlich** (I, P): `printf -- '---\nid: [\n---\nGEHEIM-DEFEKT\n' > <ordner>/aufgaben/3-kaputt.md`; `GET /api/aufgaben?wartet=ja` zweimal → `grep -c ' WARN defekte Datei .*#3' $LOG` = 1; `grep -c GEHEIM-DEFEKT $LOG` = 0. Datei reparieren, `GET` → 1 Zeile ` INFO Datei repariert `; wieder kaputt machen, `GET` → `grep -c ' WARN defekte Datei .*#3'` = 2. **Heute rot** (keine Warning, keine Reparatur-Zeile).
- [ ] **AK 9 nur Pfad/Nummer, nie Inhalt** (I): Die Defektdatei enthält `GEHEIM-DEFEKT`; die Warning nennt nur `aufgabe=#3` und den relativen Pfad; `grep -c GEHEIM-DEFEKT` = 0, `grep -c 'id: \['` = 0. Gilt auch für eine defekte Board-Datei und eine defekte `kanban.md`. **Heute rot** (keine Zeile).
- [ ] **AK 10 die drei vollständigen Leser, nicht die Einzelwege** (I): `Ordner::einstellungen`, `Ordner::boards`, `Ordner::aufgaben` melden; `Ordner::aufgabenpfad` und `Ordner::pfad_und_text` melden nicht. **Heute rot** (kein Register).

### Sperrhalter

- [ ] **AK 11 Probe P4 wörtlich** (I, P): Instanz mit `sperrschwelle = Duration::ZERO`; `PATCH /api/aufgaben/1 {"titel":"x"}` → 200, genau 1 ` WARN Schreibsperre lange gehalten ` mit `halte_ms=`, `warte_ms=`, `ort=src/dienst/`; Standard-Schwelle → 0 Zeilen; `assert_eq!(SPERRSCHWELLE, Duration::from_secs(1))`. Mutanten: Schwelle ignoriert (immer/nie) → rot. **Heute rot** (kein `Sperrhalter`).
- [ ] **AK 12 Zusage: 38 Aufrufstellen, drei Signaturen** (U/I): `grep -c 'gesperrt()'` = 38 am Stand; nach der Änderung 38; die drei Signaturen nehmen `&Sperrhalter<'_, ()>`; `aufgabe_anlegen.rs:100` ist mitgezogen. **Heute grün** (38; die Signaturen sind heute `&MutexGuard`).
- [ ] **AK 13 Zusage: keine Antwort ändert sich** (I): Rumpf und Status der 503 (Lesegrenze, Antwortbudget, Zeitgrenze), der 4xx und der 200 (PATCH) sind byte-gleich zu heute; die Defektdatei bleibt im Bestand und wird weiter als defekt gemeldet. **Heute grün** (Vergleich gegen den Stand; darf nicht rot werden).

## Betroffene Verzeichnisstruktur

- `src/dienst/` — neues Modul `episoden.rs` (Episodenzustand, `beobachten`, `faellig`, `beenden`); `src/dienst/mod.rs` (Reexport, `Sperrhalter`, `SPERRSCHWELLE`, `belegt`/`frei`-Zugriff); `src/dienst/aufgabe_anlegen.rs`, `src/dienst/einstellungen.rs` (drei Signaturen).
- `src/ablage.rs` — `Defektregister`, `Ordner`-Feld, `Debug` von Hand, `abgleichen` in `einstellungen`/`boards`/`aufgaben`.
- `src/web/` — Middleware: Episode je Ursache, Beginn/Ende, `zeitgrenze`/4xx unverändert; `App`-Zustand.
- `src/fehler.rs` — `Ereignis`-Varianten `EpisodeBeendet`, `DefekteDatei`, `DateiRepariert`, `SchreibsperreLangeGehalten` (in `src/protokoll.rs`).
- `src/protokoll.rs` — `Ereignis`-Varianten; ggf. `Protokoll`-Halter für den Episodenzustand.
- `src/main.rs` — Haken für das geordnete Beenden.
- `tests/` — neue Abnahme-Datei `akzeptanz_r00269.rs` (P2/P3/P4, AK 1–13).
- `Anforderungen/user-stories/R00269.md` — User Story.

## Technische Überlegungen

- **Episodenzustand**: `HashMap<Ursache, Episode>` mit `beginn: Instant`, `letzte: Instant`, `abweisungen: u64`, `belegt_max: usize`. `beobachten` ist eine reine Funktion mit übergebenem `Instant`; `faellig(jetzt)` liefert die Ende-Zeilen; `beenden()` liefert alle offenen Ende-Zeilen. Der Zustand liegt je Instanz (nicht global), damit Tests und Instanzen sich nicht stören (N1.7 Regel 1).
- **Ort des Zustands**: Der Zustand hängt am `Protokoll` (eine Instanz je Instanz, `Arc<Mutex<…>>`), damit `main` ihn beim geordneten Beenden erreicht. `App::ende` ist nur ein Signal; der Haken sitzt in `main` nach `axum::serve(…).with_graceful_shutdown(…).await` (Hinweis (3) des architekt).
- **Defektregister**: `Ordner` hält `Arc<Mutex<Defektregister>>` je Art; `abgleichen(art, gute, defekte)` schreibt die Übergänge. `Ordner` leitet `Debug` von Hand ab (der Guard ist nicht `Debug`). Die drei vollständigen Leser rufen `abgleichen`; `aufgabenpfad`/`pfad_und_text` nicht (Entscheidung, FA 6).
- **Sperrhalter**: `Sperrhalter<'a>` hält `MutexGuard<'a, ()>`, `ort: &'static Location<'static>`, `warte: Duration`, `protokoll: Protokoll`, `schwelle: Duration`; `Drop` schreibt ab Schwelle. `#[track_caller]` an `gesperrt` und am Konstruktor. `SPERRSCHWELLE = Duration::from_secs(1)`; Testnaht `sperrschwelle` je Instanz (Default 1 s).
- **Proben ohne Wanduhr**: P3 nutzt `beobachten` mit festen Instants; die 3× 503 kommen aus einer Instanz mit kurzer Frist. P4 nutzt `Duration::ZERO`; die Standard-Schwelle prüft 0 Zeilen. Keine Probe verlangt Last ≥ 6; die Spanne läuft als Lastprobe nur ausdrücklich (ADR-0026 N7 Regel 13).
- **Testnaht P3**: Die Instanz muss die 4 Plätze selbst belegen können; dafür eine Testnaht `router_mit_kanban` (Instanz um einen vorhandenen `Router` bauen) oder ein gleichwertiger Weg. Der Entwickler nennt die gewählte Naht im Bericht.

## Tests

- Neue Abnahme-Datei `tests/akzeptanz_r00269.rs` mit AK 1–13; P2 als Shell-Probe, P3/P4 als Rust-Integration; Sammler-Senke, keine Wanduhr.
- Unit-Tests für `beobachten`/`faellig`/`beenden` (AK 4, 5) und für `abgleichen` (AK 8–10) mit festen Instants.
- Mutanten: Episode endet nie / zählt nicht / schreibt jede Abweisung; Defekt jede Lesung / nie repariert; Sperrhalter immer/nie. Jeder Mutant macht genau ein Kriterium rot.
- Bestehende Tests bleiben grün: `ak_drei_abweisungen_je_503_grund_ergeben_drei_zeilen` (AK 7), die 38 Aufrufstellen, die Antwortformate.

## Abhängigkeiten

- R00258 (Scheibe 1) ist gebaut; die Middleware, die Sammler-Senke und `abweisungszeile` sind vorhanden.
- `Ordner::einstellungen`/`boards`/`aufgaben` liefern bereits `DefekteDatei`; das Register ist neu.
- `Ordner::gesperrt` liefert heute `MutexGuard`; der `Sperrhalter` ist neu.
- ADR-0001 Nachtrag N1 (N1.4 Regel 5/6, N1.5, N1.6) ist der Maßstab; ADR-0026 N7 Regel 13 für die Lastprobe.

## Offene Fragen

1. **An den architekt**: N1.4 Regel 5 nennt für den Antwortbudget-Ende-Satz kein Feld. Reicht `abweisungen`/`dauer_ms` ohne `belegt_max` (Vorschlag), oder soll der Ende-Satz analog `frei_kb_min` führen? Die Anforderung lässt es bei `abweisungen`/`dauer_ms`; AK 2 prüft nur diese.
2. **An den architekt**: Ist die Testnaht `router_mit_kanban` (Instanz um einen vorhandenen Router) gewollt, oder soll P3 die 4 Plätze über die öffentliche API belegen (dann braucht es einen Weg, die Frist der Instanz zu verkürzen)? Die Anforderung lässt beides zu; der Entwickler entscheidet und nennt die Naht.

## Manuelle Vorbereitungstätigkeiten

- keine

## Manuelle Nachbereitungstätigkeiten

- Director: nach #272 die Log-Zeilen in `AI-Team/factory.md` „Umgebung“ und im Observability-Review nachziehen (Episode, Defektregister, Sperrhalter); Verweis auf #272 in R00258 „Notizen“ als gebaut markieren.

## Warum löst diese Anforderung das Problem? (Pflicht)

Ohne #272 bleibt jeder Sturm von Kapazitätsabweisungen eine unlesbare Folge von Zeilen, eine defekte Datei erzeugt bei jeder Abfrage eine neue Spur, und eine lange gehaltene Schreibsperre ist unsichtbar. Mit #272 schreibt die Middleware je Episode eine Beginn- und eine Ende-Zeile mit dem Messwert, das `Ordner` führt ein Defektregister und meldet jeden Defekt einmal (und die Reparatur einmal), und der `Sperrhalter` warnt ab 1 s Haltezeit mit Ort. Die Antworten ändern sich nicht; der Betreiber liest den Zustand, nicht den Inhalt.

## Missing-Docs

- Ob `Ordner::einstellungen` als vollständiger Leser im Sinne von N1.5 gilt, obwohl es `Err` statt `DefekteDatei` liefert: die Anforderung behandelt es als vollständigen Leser (FA 6) und meldet den Pfad; der Entwickler bestätigt die Stelle im Bericht.

## Notizen

- Umfang: 8 Bubbles gezählt (B1467–B1474), alle bis Bubble geplant; Richtwert 7,5–15 h (Summe der Spannen, Hypothese des planers). Zwei Scheiben: I0258 (Episoden, F0200, B1467–B1470, 4 Bubbles) und I0259 (Defektregister und Sperrhalter, F0201/F0202, B1471–B1474, 4 Bubbles); die beiden Features in I0259 sind unabhängig. Grund für die Teilung: 8 Bubbles und 15 h wären für „morgen fertig“ zu groß; die Scheiben folgen den Nachtrag-Abschnitten N1.4 gegen N1.5/N1.6.
- Nicht Teil: neue API für den Messwert (PO Z. 704), Rotation/Aufbewahrung (Scheibe 1), `grund`-Regeln (R00258).
- Hinweis (1) des architekt: P3-Verweis ist `src/dienst/commits_lesen.rs:359`, nicht `:348`. Hinweis (2): drei Signaturen plus `aufgabe_anlegen.rs:100`. Hinweis (3): Episode endet beim geordneten Beenden. Hinweis (4): Entscheidung zu `aufgabenpfad`/`pfad_und_text` in FA 6.
