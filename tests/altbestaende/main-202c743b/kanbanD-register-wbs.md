---
people:
  be: {name: Betreiber, kind: human}
  ag: {name: Agent, kind: agent}
classes: {}
sources:
  wbs: plan/wbs.md
  requirements: anf
  applications:
    kd: {name: Anwendung, wbs: /srv/app/Dokumentation/Planung/app.md, requirements: /srv/app/Anforderungen}
    nr: {name: Nur Anforderungen, wbs: "", requirements: "../app/Requirements"}
---

# kanbanD

Einstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).
Personen werden stillgelegt (`active: false`), nicht entfernt.
