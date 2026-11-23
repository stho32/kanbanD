---
people:
  sh: {name: Mensch Eins, kind: human}
  cl: {name: Claude, kind: agent}
  dir: {name: Director (Software-Factory), kind: agent}
  po: {name: product-owner (Software-Factory), kind: agent}
  real: {name: realist-consultant (Software-Factory), kind: agent}
  plan: {name: planer (Software-Factory), kind: agent}
  arch: {name: architekt (Software-Factory), kind: agent}
  arev: {name: architektur-reviewer (Software-Factory), kind: agent}
  entw1: {name: entwickler (Software-Factory), kind: agent}
  entw2: {name: entwickler (Pool) (Software-Factory), kind: agent}
  crev: {name: code-reviewer (Software-Factory), kind: agent}
  srev: {name: security-reviewer (Software-Factory), kind: agent}
  etst: {name: entwicklertester (Software-Factory), kind: agent}
  ux: {name: ux-reviewer (Software-Factory), kind: agent}
  rsr: {name: rechtschreib-reviewer (Software-Factory), kind: agent}
  obs: {name: observability-reviewer (Software-Factory), kind: agent}
  fach: {name: fachspezialist (Software-Factory), kind: agent}
  doku: {name: dokumentar (Software-Factory), kind: agent}
classes:
  vorrang: {label: Vorrang, color: red}
signals:
  frage: {label: Ich habe Fragen, color: "#e8820c"}
  in-arbeit: {label: In Arbeit, color: "#2f6fdf"}
sources:
  wbs: ""
  requirements: ""
  applications:
    bb: {name: Beispiel B, wbs: /home/nutzer/projekte/beispiel-b/Dokumentation/Planung/beispiel-b.md, requirements: /home/nutzer/projekte/beispiel-b/Anforderungen}
---

# kanbanD

Einstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).
Personen werden stillgelegt (`active: false`), nicht entfernt.
