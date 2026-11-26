# ADR-0001: Logging-Konzept

**Status**: Akzeptiert in der Fassung von Nachtrag N1 (2026-11-23, Karte #239) und N1.8 (2026-11-26, Karte #239) — Option C statt Option A; `grund` ohne Inhalt, Board-Titel als Kennung, unbekannte Pfade ohne Zeile
**Datum**: 2026-10-31, Nachtrag N1 2026-11-23, Nachtrag N1.8 2026-11-26
**Entscheider**: architekt (Software-Factory), Nachtrag N1: Claude (autonom, architekt, Auftrag Betreiber über Karte #239), Nachtrag N1.8: Claude (autonom, architekt, Auftrag Director über Karte #239)
**Kontext-Anforderung**: — (Vorbereitung für R00096–R00099: abgewiesene Züge sollen sichtbar werden); Karte #239
**Erprobt durch**: Abhängigkeitsprobe 2026-11-23 (`cargo tree` gegen axum 0.8/tokio/chrono, siehe N1.1)

## Kontext

kanbanD gibt heute nur über `eprintln!` aus (sieben Stellen, Start und Wächter). Mit R00096–R00099 entstehen abgewiesene Züge (403/409), deren Ursache der Betreiber nachlesen will, ohne den Board-Ordner zu verschmutzen. Vorgabe des Betreibers (`AI-Team/umgebung.md`, 2026-10-31): stderr und `~/.local/state/kanbanD/<ordnername>/kanbanD.log`, nie im Board-Ordner (Git); Rotation täglich, 14 Tage; Standard Information, umschaltbar `--log <stufe>` bzw. `KANBAND_LOG`; Stufen Debug · Information (Start, Commit je Aktion mit Wer/Instanz) · Warning (403/409, defekte Dateien) · Error (Fachlogik) · Exception (Programmfehler, Panik); keine Inhalte von Beschreibungen oder Kommentaren.

## Optionen

### Option A: `tracing` + `tracing-subscriber` + `tracing-appender`
- Vorteile: Standard im tokio/axum-Umfeld; tägliche Rotation in `tracing-appender`; `EnvFilter` liefert `KANBAND_LOG` fast geschenkt; strukturierte Felder (`wer`, `instanz`, `aktion`) ohne Textbau; `tower-http` kann HTTP-Status mitschreiben.
- Nachteile: drei neue Crates; Aufbewahrung 14 Tage ist nicht eingebaut (eigenes Aufräumen beim Start); Stufen heißen anders (Warning = `WARN`, Exception = `ERROR` mit Panik-Hook).

### Option B: `log` + `simplelog`/`flexi_logger`
- Vorteile: einfache Fassade; `flexi_logger` bringt Rotation und Aufbewahrung mit.
- Nachteile: keine strukturierten Felder; kein Bezug zu tokio-Spans; zweiter Weg neben dem, was axum/tower bereits über `tracing` ausgeben.

### Option C: eigenes Modul über `std` (Datei + stderr)
- Vorteile: keine neue Abhängigkeit; Stufen und Ablage genau wie vorgegeben.
- Nachteile: Rotation, Nebenläufigkeit beim Schreiben und Panik-Hook selbst bauen und testen; Ausgaben der Bibliotheken gehen verloren.

## Entscheidung

**Vorgeschlagen: Option A**

Die Vorgaben (Stufen, Umgebungsvariable, tägliche Rotation, Felder `wer`/`instanz`) decken sich am besten mit `tracing`; die Lücke „14 Tage“ ist ein kleines Aufräumen beim Start. Offen bis zur Freigabe durch den Betreiber und bis eine Probe (Skill `dependency-probe`: Rotation, Schreibfehler im Log-Ordner darf den Server nicht stoppen) grün ist.

## Konsequenzen

**Positiv:**
- Ein Eintrag je Commit in `aktion()` ([X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md)) und je abgewiesenem Zug an einer Stelle.

**Negativ / Inkauf zu nehmen:**
- Drei Crates mehr im Build; Log-Ordner außerhalb des Repos muss beim Start angelegt werden, Fehler dort nur auf stderr.

**Folgeentscheidungen / Aufgaben:**
- [x] Anforderung „Logging nach ADR-0001“ (Vorschlag an den Director) — Karte #239, geschnitten in zwei Scheiben (N1, Konsequenzen)
- [x] Probe nach `dependency-probe`, dann Status `Akzeptiert` — Probe 2026-11-23, Ergebnis in N1.1 (Option C)

## Nachtrag N1 (2026-11-23, Karte #239): eigene kleine Schicht, eine Stelle für Abweisungen, Episoden, Sperrzeit

Anlass: Observability-Reviews von #228 und #238 (Karte #239 samt Kommentar vom 2026-11-22). Abgewiesene Anfragen (4xx, 503 Lesegrenze/Zeitgrenze/Antwortbudget) hinterlassen keine Zeile (`impl IntoResponse for Fehler`, `src/web/mod.rs:142`), defekte Dateien werden still übergangen (`src/ablage.rs:86–129`), die Haltezeit der Schreibsperre ist nicht messbar (`Kanban::gesperrt`, `src/dienst/mod.rs:259`; die 110 s aus dem Security-Review von #228 wären nur als hängende Anfrage sichtbar). Die Vorgabe des Betreibers aus dem Kontext (Ziel, Rotation, 14 Tage, Stufen, keine Inhalte) gilt unverändert; `AI-Team/umgebung.md` gibt es nicht mehr — die Vorgabe lebt in dieser ADR weiter.

### N1.1 Bibliothek: Option C statt Option A

**Entscheidung**: eigenes Modul `src/protokoll.rs` über `std` und `chrono` (schon im Baum); keine neue Abhängigkeit.

Probe 2026-11-23 (`cargo tree -e normal` für axum 0.8 + tokio + chrono, mit und ohne `tracing-subscriber` [fmt, env-filter] und `tracing-appender`): 19 Crates mehr, darunter `regex-automata`, `regex-syntax`, `time`, `crossbeam-channel`, `thiserror`, `sharded-slab`, `matchers`. `tracing` und `tracing-core` liegen schon im Baum (über axum), der Rest nicht.

| Option | Stärke | Schwäche, die entscheidet |
|---|---|---|
| A `tracing` + `-subscriber` + `-appender` | Rotation und Aufbewahrung (`max_log_files`) fertig, Ökosystem, Spans | 19 Crates; Test-Erfassung über `with_default` gilt je Thread — Ereignisse aus `spawn_blocking` (`src/web/mod.rs:247`, jeder Dienstaufruf) fehlen, ein globaler Subscriber mischt parallele `cargo test` → Tests wackeln; `non_blocking` verwirft Zeilen bei Überlauf still |
| B `log` + `flexi_logger` | Rotation und Aufbewahrung fertig | globaler Logger, dieselbe Test-Mischung; keine Felder |
| **C eigene Schicht** | jede Instanz hat ihr eigenes `Protokoll` (kein globaler Zustand) → parallele Tests sehen nur ihre Zeilen; synchron geschrieben → die Zeile steht im Log, bevor die Antwort den Server verlässt; Format genau nach Vorgabe | Rotation, Aufbewahrung, Panik-Hook selbst bauen und testen (etwa 200 Zeilen); interne `tracing`-Ereignisse von axum/hyper gehen verloren |

In Kauf genommen: eigener Code für Rotation und Aufbewahrung, und dass Bibliotheksmeldungen fehlen (axum meldet über `tracing` nur Debug/Trace zu Abweisungen, die die zentrale Zeile ohnehin abdeckt). Die Wahl kippt, wenn ein späterer Bedarf Spans über Anfragen hinweg verlangt — dann neue ADR für Option A mit Test-Senke je Instanz.

### N1.2 Ziel, Rotation, Aufbewahrung, Stufen

1. **Ziel**: stderr **und** `$XDG_STATE_HOME/kanbanD/<ordnername>/kanbanD.log` (ohne `XDG_STATE_HOME`: `~/.local/state/kanbanD/<ordnername>/kanbanD.log`), nie im Board-Ordner. Überschreibbar mit `--log-ordner <pfad>` bzw. `KANBAND_LOG_ORDNER` (Flag vor Variable) — für Proben und Wegwerf-Instanzen.
2. **Rotation** täglich nach Ortsdatum: beim ersten Schreiben eines neuen Tages wird `kanbanD.log` zu `kanbanD.log.JJJJ-MM-TT` (Datum des alten Tages) und neu geöffnet. **Aufbewahrung** 14 Tage: beim Start und bei jeder Rotation werden `kanbanD.log.<Datum>` mit Datum vor mehr als 14 Tagen gelöscht, andere Dateien im Ordner nie. Das Datum kommt über einen Uhr-Provider (im Test fest).
3. **Fehler des Logs stoppen nie den Server**: Ordner nicht anlegbar oder Schreiben scheitert → eine Zeile auf stderr, die Datei-Senke ruht bis zur nächsten Rotation; stderr läuft weiter.
4. **Stufen**: `DEBUG` · `INFO` (Start mit Ordner, Port und Log-Pfad; je Commit in `aktion()` eine Zeile mit `wer`, `instanz` und Anzahl Dateien, ohne Commit-Text) · `WARN` (Abweisungen 4xx/503, defekte Dateien, lange Sperre) · `ERROR` (500, Dateisystem/Git) · `EXCEPTION` (Panik, über einen Panik-Hook, den nur `main` setzt). Standard `INFO`, umschaltbar mit `--log debug|info|warn|error` bzw. `KANBAND_LOG` (Flag vor Variable; unbekannter Wert → Aufruffehler mit Exit-Code 2 wie die übrigen).
5. Die acht `eprintln!`/`println!` (X00002) ziehen ins Protokoll um; danach ist `grep -rn "eprintln!\|println!" src` außerhalb von `src/main.rs` (Aufruffehler vor dem Start) und `src/protokoll.rs` leer.

### N1.3 Zeilenformat

Ein Ereignis = eine Zeile:

```
<RFC 3339 mit ms und Versatz> <STUFE> <Ereignis> <feld>=<wert> …
2026-11-23T14:19:05.123+01:00 WARN abgewiesen status=400 wer=cl methode=PATCH endpunkt=/api/aufgaben/{nr} aufgabe=#1 ursache=eingabe grund="Aufgabe #999 gibt es nicht (braucht:999)"
```

- **Ereignis** ist fester Text aus einer geschlossenen Liste (`gestartet`, `commit`, `abgewiesen`, `fehlgeschlagen`, `Episode beendet`, `defekte Datei`, `Datei repariert`, `Schreibsperre lange gehalten`, `Panik`); er enthält nie `=`. Felder beginnen am ersten Wort mit `=`.
- **Werte** ohne Leerzeichen roh, sonst in `"…"`; `"`, `\`, Zeilenumbruch und Steuerzeichen werden als `\"`, `\\`, `\n`, `\u{..}` geschrieben — kein Wert bricht die Zeile (Log-Injektion über Header oder Meldung). Jeder Wert höchstens 200 Zeichen, gekürzt mit `…`.
- **Datenschutz**: nie Rumpf, Beschreibung, Kommentar, Titel, Commit-Text, Dateiinhalt, Query-String, Header außer `X-KanbanD-Wer` und `X-KanbanD-Instanz` (je höchstens 32 Zeichen). `wer` ist das Kürzel, kein Name. `grund` ist `Fehler::meldung()` — die Meldungen nennen Nummern, Spalten, Labels und Kürzel, keine Inhalte; eine neue Meldung mit Inhalt ist ein Befund.

### N1.4 Eine Stelle für abgewiesene Anfragen

1. **Einziger Schreiber** ist eine Middleware um alle `/api`-Routen (`route_layer`, damit `MatchedPath` vorliegt). Sie schreibt **nach** dem Handler und **bevor** die Antwort zurückgeht, je Anfrage mit Status ≥ 400 höchstens eine Zeile: 4xx und 503 → `WARN abgewiesen`, übrige 5xx → `ERROR fehlgeschlagen`. `Fehler::into_response` und `fehlerantwort` schreiben selbst nichts, sondern hängen `grund` und `ursache` als Response-Extension an; fehlt sie (Abweisung durch axum selbst), steht `grund=-`.
2. **Felder**: `status`, `wer`, `instanz` (falls Header), `methode`, `endpunkt` (Vorlage aus `MatchedPath`, nie die rohe URI), `aufgabe=#<n>` aus dem Pfadparameter `nr` (falls vorhanden), `ursache`, `grund`.
3. **`ursache`** ist ein eigenes Feld aus einer geschlossenen Liste, abgebildet an genau einem Ort (`Fehler::ursache()` in `src/fehler.rs`): `eingabe` (400), `fehlt` (404), `verboten` (403), `konflikt` (409), `grenze` (409 WIP), `defekt` (423), `zu_gross` (413), `zeitgrenze`, `lesegrenze`, `antwortbudget` (je 503), `intern` (500). `Fehler::Ausgelastet` bekommt dafür ein Feld, welche Grenze voll ist — die Ursache wird nie aus dem Text der Meldung gelesen. Rumpf und Status der Antwort ändern sich nicht.
4. **Sammelwege** (`PATCH /api/aufgaben`, `POST …/archivieren`, `…/zurueckholen`, Anlegen mehrerer Aufgaben oder Teilaufgaben, mehrere bewegen oder auf ein Board legen): statt `aufgabe` die Felder `ziele=<Anzahl>` und `erstes=#<n>`. Die Middleware legt dazu einen leeren Anfragezettel (`Arc<Mutex<…>>`) in die Request-Extensions; nur die Sammel-Handler füllen ihn vor dem Dienstaufruf. Nie die Liste selbst.
5. **Fluten der Kapazitätsgrenzen** (`lesegrenze`, `antwortbudget`): je Ursache eine Episode. Die erste Abweisung einer Episode bekommt die volle Zeile mit `episode=beginn` und `belegt=<n>/<max>` (Lesegrenze) bzw. `frei_kb=<n>` (Antwortbudget); weitere Abweisungen derselben Ursache werden nur gezählt. Die Episode endet, wenn 10 s keine Abweisung dieser Ursache kam; die Middleware prüft das bei jeder folgenden Anfrage und beim geordneten Beenden und schreibt dann `INFO Episode beendet ursache=… abweisungen=<n> dauer_ms=<ms> belegt_max=<n>` — der Messwert „Abweisungen je Zeitraum“. `zeitgrenze` (je Anfrage ein beendeter Git-Prozess) und alle 4xx bleiben **genau eine Zeile je Anfrage**.
6. Die Episodenlogik ist eine reine Funktion `beobachten(ursache, jetzt: Instant) -> Option<Zeile>` mit übergebenem Zeitpunkt.

### N1.5 Defekte Dateien: eine Warning je Episode

1. **Ort**: die drei Leser, die Defekte melden — `Ordner::einstellungen`, `Ordner::boards`, `Ordner::aufgaben` (`src/ablage.rs`). Das `Ordner` hält ein **Defektregister**: die Pfade, die beim letzten vollständigen Lesen ihrer Art defekt waren (nur im Speicher, je Instanz).
2. Ein Pfad, der defekt gelesen wird und nicht im Register steht → `WARN defekte Datei aufgabe=#<n> pfad=<relativ>` (Nummer aus dem Dateinamen, falls lesbar) und ins Register. Steht er schon drin → nichts.
3. Ein Pfad im Register, der beim nächsten vollständigen Lesen seiner Art lesbar ist oder fehlt → aus dem Register, `INFO Datei repariert pfad=…`. Wird er später wieder defekt, beginnt eine neue Episode mit neuer Warning.
4. Nie Inhalt, Fehlertext des Parsers oder lesbare Schlüssel ins Log (der Fehlertext kann Inhalt zitieren). Ein Neustart beginnt mit leerem Register — eine Warning je defekter Datei und Start ist gewollt.

### N1.6 Haltezeit der Schreibsperre, Messwert der Lesegrenze

1. `Kanban::gesperrt()` gibt statt des nackten `MutexGuard` einen `Sperrhalter` zurück, der beim Betreten die Wartezeit und beim Fallenlassen die Haltezeit misst (`Instant`). Der Aufrufort kommt über `#[track_caller]` (`Location::caller()`, Datei:Zeile) — die 39 Aufrufstellen bleiben unverändert.
2. Haltezeit ≥ `SPERRSCHWELLE` (1 s, Konstante; je Instanz überschreibbar wie `grenze_namen`, nur in Tests) → `WARN Schreibsperre lange gehalten halte_ms=<ms> warte_ms=<ms> ort=<datei:zeile>`. Darunter nichts.
3. Die Lesegrenze gibt `belegt()` auch außerhalb von Tests her und zählt `belegt_max` je Episode; die Werte erscheinen nur in den Zeilen aus N1.4 Regel 5 — keine neue API.

### N1.7 Wie Tests Log-Zeilen prüfen, ohne zu wackeln

1. Das `Protokoll` ist ein Wert je Instanz (in `App`, `Kanban` und `Ordner`), nie global; seine Senke ist ein Provider: Datei+stderr im Betrieb, ein Sammler (`Arc<Mutex<Vec<String>>>`) im Test. Parallel laufende `cargo test` sehen so nur ihre eigenen Zeilen.
2. Geschrieben wird synchron, bevor die Antwort den Server verlässt: ein Test liest nach dem `await` der Antwort, ohne Warten und ohne Wiederholschleife.
3. Geprüft wird über **Zählen und Enthalten** von Ereignis und Feldern (`zeilen.iter().filter(|z| z.contains(" WARN abgewiesen ") && z.contains("wer=cl")).count() == 1`), nie über die ganze Zeile mit Zeitstempel.
4. Zeit wird übergeben, nicht abgewartet: Episodenende über `beobachten(…, jetzt)` mit gesetzten Instants; Sperrzeit über die Schwelle (`Duration::ZERO` → jede gehaltene Sperre schreibt genau eine Zeile; Standard → keine) — kein `sleep` im Test. Die Konstante prüft ein Test als Wert (1 s).
5. Rotation und Aufbewahrung mit fester Uhr im Wegwerf-Ordner (`tempfile`).
6. **Durchsetzung**: Test, dass ein Rumpf mit Marker (`"beschreibung":"GEHEIM-239"`) in keiner Zeile erscheint; Review-Punkt des `observability-reviewer`: ein neues `eprintln!`/`println!` außerhalb von `main.rs`/`protokoll.rs` und jede Zeile zu einer Abweisung außerhalb der Middleware sind ein Befund.

### N1.8 `grund` ohne Inhalt, Board-Titel als Kennung, unbekannte Pfade ohne Zeile (2026-11-26, Karte #239)

Anlass: drei Fragen des planers an den architekt zu R00258 (deren „Offene Fragen“ 1–3). Der Auftrag nannte den Nachtrag „N1.5“; N1.5 ist bereits „Defekte Dateien“ (Scheibe 2), deshalb N1.8. Die drei Antworten gelten unverändert für Scheibe 2.

1. **Längenregel bestätigt — der Rumpf bleibt unverändert.** N1.4 Regel 1 setzt `grund` = `Fehler::meldung()`; das gilt für den **Rumpf der Antwort**, nicht für das Protokoll. Ins Log kommt neben `Fehler::meldung()` eine zweite, inhaltsfreie Fassung (`Fehler::grund_fuer_protokoll()`): an jeder Fundstelle, an der eine Meldung Inhalt einsetzt (Aufgaben-Titel, Fehlertext des Parsers, Wert aus Rumpf oder Query, Commit-Text), steht dort nur dessen Länge `<n Zeichen>` — die Anführungszeichen und der übrige Satz bleiben, also `„<16 Zeichen>“: Aufgabe #999 gibt es nicht (braucht:999)`. Nummern, Spalten-, Board- und Labelnamen, Kürzel und Schlüssel bleiben Wort für Wort. Damit ist „Titel“ in N1.3 (Datenschutz) als **Aufgaben-Titel** bestimmt. Grund: die gemeinsame Lehre „Benutzereingaben im Log nur als Länge oder Kennung, nie im Wortlaut“ (Probe: Markenwort eingeben, im Log suchen); ein Längendeckel allein genügt nicht, weil er Inhalt nur kürzt statt ihn zu ersetzen. Der Rumpf bleibt bytegleich `Fehler::meldung()`; Rechenbeispiel und Fundliste stehen in R00258 AK 10, die Regel als FA 13.
   Die Wahl kippt, wenn ein Inhalt allein über seine Länge diagnostizierbar sein muss — heute trägt die Zeile Nummer, Feld und Ursache daneben, die Länge ist nur der Beleg, dass etwas dagestanden hat.

2. **Board-Titel sind Kennung, sie bleiben im Log.** N1.3 meint mit „Titel“ den Aufgaben-Titel. Board-, Spalten- und Labelnamen gehören zur Board-Datei (`kanbanD.md`), sind Betreiber-Konfiguration und kein Nutzerinhalt; sie werden wie Kürzel und Schlüssel behandelt, R00258 FA 13 nennt sie bereits ausdrücklich. Eine Meldung, die den Board-Titel einsetzt (`Spalte „x“ gibt es auf „<Board>“ nicht`, `src/dienst/reservierung.rs:79`, `:82`, `src/dienst/zuordnung.rs:17`, `:31`, `:44`), erscheint im Log unverändert; wo die Meldung schon den Slug trägt (`src/dienst/aufgabe_anlegen.rs:239`), bleibt es der Slug. Kein Vorzug des Slugs vor dem Titel: `grund` ist die Meldung, nur um Inhalte gekürzt (Regel 1) — eine zweite Umschreibung wäre ein zweiter Wortlaut, der driftet. Grenze: wer Inhalt in einen Board- oder Spaltennamen legt, verstößt gegen die Board-Regeln, nicht gegen das Log; Länge und Escaping aus N1.3 (200 Zeichen, `\"`, `\\`, `\n`, `\u{..}`) gelten auch hier.

3. **Unbekannte Pfade bleiben für Scheibe 1 ohne Zeile — hingenommen.** `route_layer` läuft nur auf getroffenen Routen; `/api/gibtsnicht` fällt in den Fallback von axum, wo kein `MatchedPath` vorliegt. Eine Zeile dort erzwänge die rohe URI als `endpunkt` — genau das, was N1.4 Regel 2 und R00258 AK 9 verbieten, denn ein unbekannter Pfad ist Nutzereingabe und kann Query, Kürzel oder Kennungen tragen. Zwei Gründe überwiegen: (a) der Zweck ist, einem Agenten nachzulesen, warum sein **gültiger** Zug scheiterte; ein falscher Pfad zeigt ihm der Rumpf als 404; (b) jede Anfrage eines Scanners an einen unbekannten Pfad erzeugte sonst eine Zeile. Wenn ein späterer Bedarf entsteht, deckt es eine eigene Karte: dann eine Zeile für den `/api/*`-Fallback mit **festem** `endpunkt=unbekannt` (kein Pfad, keine Query), `ursache=fehlt`, `status=404` — nicht Teil von #239.

### Konsequenzen N1

- Positiv: keine neue Abhängigkeit; Abweisungen, Defekte und lange Sperren sind im Betrieb lesbar; Tests deterministisch.
- Negativ: etwa 200 Zeilen eigener Logging-Code mit Rotation. Agenten in einer Schleife (409 WIP) schreiben je Abweisung eine Zeile — bei 5/s Spitze (Lastprofil) höchstens etwa 430 000 Zeilen am Tag, durch die Aufbewahrung auf 14 Tage begrenzt. Zwei Instanzen auf Ordnern gleichen Namens teilen sich den Log-Ordner (Vorgabe `<ordnername>`); hingenommen.
- Folgeaufgaben (Anforderungen über den Director): Scheibe 1 „Protokoll und abgewiesene Anfragen“ (N1.1–N1.4 ohne Regel 5), Scheibe 2 „Fluten, defekte Dateien, Sperrzeit“ (N1.4 Regel 5, N1.5, N1.6).

## Quellen / Bezuege

- Vorgabe des Betreibers vom 2026-10-31 (ehemals `AI-Team/umgebung.md`, Zeile „Logging“; die Datei gibt es nicht mehr, der Wortlaut steht oben im Kontext)
- Karte #239 samt Kommentar vom 2026-11-22 (Observability-Reviews #228, #238)
- [X00002 Logging](../Architektur/Aspekte/X00002-logging.md)
