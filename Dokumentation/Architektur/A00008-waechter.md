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

- eingehend: Dateisystem-Ereignisse (notify); `Eigene` von den [Diensten](A00004-dienste.md)
- ausgehend: `Ereignis {pfade, extern, wbs}` an die [Web-Schicht](A00003-web-schicht.md) (SSE)

## Abhaengigkeiten

- [A00004 Dienste](A00004-dienste.md) (über `Eigene`)
- extern: notify

## Entscheidungen

- [ADR-0034: kanbanD ohne WBS — Register mit Repository, Phasen werden Spalten](../ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) (Akzeptiert, #224–#228) — Soll: der Wächter für fremde WBS-Dateien (`FremdeWbs`) entfällt; beobachtet wird nur der Ordner
- [ADR-0036: Transkripte der Agentenläufe — gzip unversioniert unter `transkripte/<nr>/`, Eintrag an der Karte, Schalter `record-transcripts`](../ADRs/0036-transkripte-unversioniert-im-ordner-eintrag-an-der-karte.md) (Akzeptiert, Karte #208) — Soll: Pfade unter `transkripte/` sind nicht relevant (`waechter::relevant`); neu geladen wird über den Commit der Aufgabendatei

## Offene Fragen

## Notizen / Quellen

- Bündelung 150 ms, eigene Schreibvorgänge gelten 3 s als eigen.
