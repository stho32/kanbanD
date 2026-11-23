---
people:
  stho: {name: Mensch Eins, kind: human}
  pour: {name: Mensch Zwei, kind: human}
  clau: {name: Claude, kind: agent}
  entw: {name: Entwickler (AI-Team), kind: agent}
  crev: {name: Code-Reviewer (AI-Team), kind: agent}
  etst: {name: Entwicklertester (AI-Team), kind: agent}
  srev: {name: Security-Reviewer (AI-Team), kind: agent}
  abts: {name: Abnahmetest-Schreiber (AI-Team), kind: agent}
  entw2: {name: entwickler-2 (Software-Factory), kind: agent}
  entw3: {name: entwickler-3 (Software-Factory), kind: agent}
  uxr: {name: ux-reviewer (Software-Factory), kind: agent}
  dsgv: {name: datenschutz-spezialist (Software-Factory), kind: agent}
  plan: {name: planer (Software-Factory), kind: agent}
  po: {name: product-owner (Software-Factory), kind: agent}
  real: {name: realist-consultant (Software-Factory), kind: agent}
  fach: {name: fachspezialist (Software-Factory), kind: agent}
  wart: {name: Wartet auf Systemressourcen, kind: agent}
classes:
  vorrang: {label: Vorrang, color: red}
  bug: {label: Bug, color: yellow}
signals:
  mail: {label: Neue E-Mail, color: blue}
  fragen: {label: Coding-Agent hat Fragen, color: violet}
  in-arbeit: {label: In Arbeit, color: green}
  wartet-auf-ressourcen: {label: Wartet auf Systemressourcen, color: "#7755cc"}
sources:
  wbs: ""
  requirements: ""
  applications:
    jopu: {name: JoinPuya, wbs: /home/shoff/Projekte/JoinPuyaApp/Documentation/Planning/joinpuya.md, requirements: /home/shoff/Projekte/JoinPuyaApp/Requirements}
---

# kanbanD

Einstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).
Personen werden stillgelegt (`active: false`), nicht entfernt.
