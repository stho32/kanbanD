---
people:
  sh: {name: Mensch Eins, kind: human}
  cl: {name: Claude, kind: agent}
  dir: {name: Director (Software-Factory), kind: agent}
  arch: {name: architekt (Software-Factory), kind: agent}
  plan: {name: planer (Software-Factory), kind: agent}
  ux: {name: ux-reviewer (Software-Factory), kind: agent}
  entw1: {name: entwickler (Software-Factory), kind: agent}
  crev: {name: code-reviewer (Software-Factory), kind: agent}
  srev: {name: security-reviewer (Software-Factory), kind: agent}
  rsr: {name: rechtschreib-reviewer (Software-Factory), kind: agent}
  arev: {name: architektur-reviewer (Software-Factory), kind: agent}
  leg: {name: legacy-reviewer (Software-Factory), kind: agent}
  obs: {name: observability-reviewer (Software-Factory), kind: agent}
  etst: {name: entwicklertester (Software-Factory), kind: agent}
  po: {name: Product Owner, kind: agent}
  real: {name: Realist-Consultant, kind: agent}
  fach: {name: Fachspezialist, kind: agent}
  entw2: {name: Entwickler (Nacharbeit), kind: agent}
  ges: {name: gestalter (Software-Factory), kind: agent}
  wart: {name: Wartet auf Systemressourcen, kind: agent}
classes:
  vorrang: {label: Vorrang, color: red}
signals:
  frage: {label: Ich habe Fragen, color: orange}
  in-arbeit: {label: in Arbeit, color: blue}
  wartet-auf-ressourcen: {label: Wartet auf Systemressourcen, color: "#7755cc"}
sources:
  wbs: ""
  requirements: ""
  applications:
    kd: {name: kanbanD, wbs: /home/shoff/Projekte/kanbanD/Dokumentation/Planung/kanbanD.md, requirements: /home/shoff/Projekte/kanbanD/Anforderungen}
record-transcripts: true
---

# kanbanD

Einstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).
Personen werden stillgelegt (`active: false`), nicht entfernt.
