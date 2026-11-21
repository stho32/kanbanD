---
id: A00008
name: Wächter
code: waechter
ebene: Komponente
eltern: A00002
repo: kanbanD
status: Aktiv
herkunft: code
quellen:
  - src/waechter.rs
verwandt: []
domaene: []
blackbox: Startmodell bewusst knapp; verfeinert wird, sobald eine Karte den Baustein ändert.
---

# Wächter

## Verantwortung

Der Wächter beobachtet den Ordner, bündelt Änderungen zu Ereignissen mit Kennzeichen extern oder eigen.

## Schnittstellen

- eingehend: Dateisystem-Ereignisse (notify); die [Dienste](A00004-dienste.md) merken eigene Pfade über `Eigene::merken` und fragen `relativ`/`FremdeWbs` (`src/dienst/mod.rs:71`, `src/dienst/wbs.rs:5`); die [Web-Schicht](A00003-web-schicht.md) startet ihn (`waechter::starten`, `fremde_starten`, `src/web/mod.rs:53`, `:152`)
- ausgehend: `Ereignis {pfade, extern, wbs}` über den Rückruf der Web-Schicht (SSE)

## Abhaengigkeiten

- [A00006 Modell](A00006-modell.md) (nur `TRANSKRIPTE_ORDNER`) — die einzige interne Kante; Dienste und Web-Schicht hängen vom Wächter ab (A00004 → A00008, A00003 → A00008), nie umgekehrt
- extern: notify

## Entscheidungen

- [ADR-0034: kanbanD ohne WBS — Register mit Repository, Phasen werden Spalten](../ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) (Akzeptiert, #224–#228) — Soll: der Wächter für fremde WBS-Dateien (`FremdeWbs`) entfällt; beobachtet wird nur der Ordner
- [ADR-0036: Transkripte der Agentenläufe — gzip unversioniert unter `transkripte/<nr>/`, Eintrag an der Karte, Schalter `record-transcripts`](../ADRs/0036-transkripte-unversioniert-im-ordner-eintrag-an-der-karte.md) (Akzeptiert, Karte #208, Nachtrag 2026-11-21 „Gebaut“) — gebaut (#208, R00216, auf main seit `c37b74cc`): Pfade unter `transkripte/` sind nicht relevant (`waechter::relevant`, `src/waechter.rs:44–49`); neu geladen wird über den Commit der Aufgabendatei; der Ordnername kommt aus `modell::TRANSKRIPTE_ORDNER`

## Offene Fragen

## Notizen / Quellen

- Bündelung 150 ms, eigene Schreibvorgänge gelten 3 s als eigen.
- nachgeführt 2026-11-21 nach #208 (R00216, ADR-0036, `c37b74cc`), Architektur-Review 208-1 (Muss) und 208-2:
  - Richtung der Kanten richtiggestellt: Das Modell nannte bisher „A00004 Dienste (über `Eigene`)“ als Abhängigkeit des Wächters. Tatsächlich importieren die Dienste den Wächter (`use crate::waechter::Eigene`), und die Web-Schicht startet ihn. Der Wächter selbst greift außerhalb seines Testmoduls nur auf `crate::modell::TRANSKRIPTE_ORDNER` zu (`src/waechter.rs:45`).
  - `relevant(rel)` (`:44`) schließt `transkripte` und alles darunter aus (`rel == "transkripte"` oder Präfix `transkripte/`), dazu wie bisher `.git`, `.git/…` und `*.kanbanD-tmp`. Ein Upload von 10 MB löst damit kein Ereignis aus; die Sichten laden über den Commit der Aufgabendatei neu.
  - Zwischenstand von #208 vor der Nacharbeit 1: `relevant` las `crate::dienst::transkripte::ORDNER` — ein Importzyklus Wächter ↔ Dienste. Behoben durch den Umzug der Konstante ins Modell ([A00006](A00006-modell.md)).
  - Probe (Fitness-Funktion): `tests/fitness_waechter_importe.rs` liest `src/waechter.rs` bis zum ersten `#[cfg(test)]` und verlangt, dass weder `crate::dienst…` noch `crate::web…` noch die Klammerform `use crate::{…, dienst, …}` vorkommt (`der_waechter_importiert_weder_dienst_noch_web`); die Gegenprobe `jede_schreibweise_wird_gefunden` prüft die erkannten Schreibweisen. Sie war vor dem Fix rot mit `["dienst"]`.
  - Bekannte Lücken der Probe (Architektur-Review 208-2, Sollte 3): `super::dienst…` erkennt sie nicht, und in verschachtelten Klammern (`use crate::{a::{b}, dienst};`) endet die Suche an der ersten `}` und übersieht `dienst`. Abnahme-Probe für eine Härtung: `verbotene_zugriffe("use super::dienst::Kanban;")` und `verbotene_zugriffe("use crate::{a::{b}, dienst};")` liefern `["dienst"]` — heute beide `[]`. Ein allgemeiner Test auf Zyklen im Importgraphen aller Module fehlt.
