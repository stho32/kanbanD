---
people:
  sh: {name: Mensch Eins, kind: human}
  cl: {name: Claude, kind: agent}
  dir: {name: Director (Software-Factory), kind: agent}
  arch: {name: architekt (Software-Factory), kind: agent}
  plan: {name: planer (Software-Factory), kind: agent}
  entw: {name: entwickler (Software-Factory), kind: agent}
  crev: {name: code-reviewer (Software-Factory), kind: agent}
  ux: {name: ux-reviewer (Software-Factory), kind: agent}
  etst: {name: entwicklertester (Software-Factory), kind: agent}
  srev: {name: security-reviewer (Software-Factory), kind: agent}
  rsr: {name: rechtschreib-reviewer (Software-Factory), kind: agent}
  obs: {name: observability-reviewer (Software-Factory), kind: agent}
  entw2: {name: "entwickler 2 (Software-Factory, Nacharbeit im Worktree)", kind: agent}
  po: {name: product-owner (Software-Factory), kind: agent}
  entw3: {name: "entwickler 3, kleine Karten (Software-Factory)", kind: agent}
classes:
  vorrang: {label: Vorrang, color: red}
signals:
  in-arbeit: {label: In Arbeit, color: green}
  testfeuer: {label: Testfeuer, color: red}
sources:
  wbs: ""
  requirements: ""
  applications:
    lc: {name: localchatA, wbs: /home/shoff/Projekte/localchatA/Dokumentation/Planung/localchata.md, requirements: /home/shoff/Projekte/localchatA/Anforderungen}
---

# kanbanD

Einstellungen dieses Ordners: Personen (`people`), Klassen (`classes`), Signale (`signals`) und Quellpfade (`sources`).
Personen werden stillgelegt (`active: false`), nicht entfernt.
