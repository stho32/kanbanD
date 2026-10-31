# Quellen

Was die Rollen dieses Projekts lesen dürfen, wo es liegt und wie sie es nutzen. Angelegt bei der Bestückung (Factory: `rollen/director/bestueckung.md`), fortgeschrieben nur vom Director. Eine Rolle liest die Zeilen, in denen sie oder `alle` steht. Prüfen: `python3 werkzeuge/quellen.py pruefen <projekt>/AI-Team` (aus der Factory).

## Orte

- `repo:<pfad>` — im Projekt-Repo, relativ zur Wurzel, versioniert.
- `extern:<absoluter pfad>` — außerhalb des Repos auf diesem Rechner (E-Buch, Norm, vertrauliches Dokument); die Session braucht Lesezugriff (`claude --add-dir <ordner>` bzw. `/add-dir <ordner>`).
- `url:<adresse>` — im Netz; beim Zitieren mit Abrufdatum.
- `person:<rolle beim Auftraggeber>` — Auskunft nur über den Betreiber; Namen und Kontaktdaten stehen nicht hier.

## Nutzung

- `lesen` — lesen und in eigenen Worten verwenden, mit Fundstelle.
- `zitieren` — zusätzlich kurze wörtliche Zitate mit Fundstelle.
- `nur-verweis` — nennen, nicht öffnen (Zugang fehlt noch, Lizenz unklar).

Externe Quellen werden nie ins Repo kopiert, auch nicht in Auszügen über ein kurzes Zitat hinaus. Was eine Rolle daraus gewinnt, steht in eigenen Worten im Projekt (z. B. Domänenwissen) mit Quellen-ID und Fundstelle.

## Verzeichnis

| ID | Was | Ort | Nutzung | Ins Repo | Für Rollen |
|---|---|---|---|---|---|
| Q01 | Vision | repo:Anforderungen/R00000-vision.md | lesen | ja | alle |
| Q02 | Anforderungen und User Stories | repo:Anforderungen/ | lesen | ja | alle |
| Q03 | WBS und Phasen-Datei | repo:Dokumentation/Planung/kanbanD.md | lesen | ja | planer, product-owner, architekt |
| Q04 | Wireframes (Betrieb lokal) | repo:Dokumentation/Wireframes/ | lesen | ja | ux-reviewer, planer, entwickler, product-owner |
| Q05 | Anmerkungen aus dem /anwendung-Lauf (147 offen) | repo:kanbanD-anmerkungen.md | lesen | ja | planer, product-owner, realist-consultant |
| Q06 | Gelerntes aus früheren Läufen | repo:Dokumentation/Gelerntes.md | lesen | ja | entwickler, code-reviewer |
| Q07 | Stil-Token der Oberfläche | repo:web/kd-tokens.css | lesen | ja | ux-reviewer, entwickler |
| Q08 | API-Beschreibung (Quelle der OpenAPI) | repo:src/web/endpunkte.rs | lesen | ja | alle |
| Q09 | Altbestände: Board-Ordner anderer Projekte (nur Kopien öffnen) | extern:/home/shoff/Projekte/Kanban-Boards | lesen | nein — fremde Projekte | legacy-reviewer, entwicklertester |
| Q10 | Agenten-Client der Factory | extern:/home/shoff/Projekte/Software-Factory/werkzeuge/kanband.py | lesen | nein — Factory | legacy-reviewer, entwickler |
| Q11 | axum 0.8 | url:https://docs.rs/axum/0.8 | lesen | nein — Verweis | entwickler, code-reviewer, architekt |
| Q12 | utoipa 6 | url:https://docs.rs/utoipa/latest/utoipa/ | lesen | nein — Verweis | entwickler, code-reviewer |
| Q13 | Kanban-Begriffe (Kanbanflow-Hilfe als Referenzprodukt) | url:https://kanbanflow.com/help | lesen | nein — Verweis | fachspezialist, product-owner |

## Offen

- 2026-10-31 · fachspezialist · Glossar existiert nicht — legt die Rolle bei der ersten Karte mit neuen Begriffen an.
- 2026-10-31 · factory · Vorschlag einer Spezialisierung `entwickler/rust-web` (axum, utoipa, SSE) — erst bei Bedarf über `/factory lehren`.
