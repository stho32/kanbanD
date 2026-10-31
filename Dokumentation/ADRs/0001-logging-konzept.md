# ADR-0001: Logging-Konzept

**Status**: Vorgeschlagen
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory), Freigabe durch den Betreiber offen
**Kontext-Anforderung**: — (Vorbereitung für R00096–R00099: abgewiesene Züge sollen sichtbar werden)
**Erprobt durch**: —

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
- [ ] Anforderung „Logging nach ADR-0001“ (Vorschlag an den Director)
- [ ] Probe nach `dependency-probe`, dann Status `Akzeptiert`

## Quellen / Bezuege

- `AI-Team/umgebung.md`, Zeile „Logging“
- [X00002 Logging](../Architektur/Aspekte/X00002-logging.md)
