# Gelerntes — projektgebunden

Lehren, die an dieses Projekt gebunden sind und mehrere Rollen betreffen. Lehren einer einzelnen Rolle stehen in `AI-Team/<rolle>.md`; allgemeine Lehren schlägt der Director für die Factory vor.

- 2026-10-31 (#7/#14, R00101): Browser-Proben laufen über ein eigenes headless Chromium per Skript (`NODE_PATH=e2e/node_modules`, `chromium.launch({ headless: true })`), nicht über den Playwright-MCP — Anweisung des Betreibers. Gilt für ux-reviewer, entwicklertester und jede Rolle mit Browser; im Auftrag ausdrücklich nennen.
- 2026-10-31 (#7/#14): Im Sparbetrieb lassen Rollen die gemeinsamen Regeln und ihren Rollenindex weg, wenn der Auftrag „nur Nötiges lesen“ sagt. Der Director nennt deshalb im Auftrag die Mindest-Leseliste ausdrücklich (gemeinsam/regeln.md bleibt Pflicht).
- 2026-10-31 (#7/#14): Abschluss je Karte kostete etwa 1,3 Mio. Tokens über alle Rollen (UX-Durchsicht und Startmodell eingerechnet); Bau 264k, Reviews 92k–166k je Rolle. Für den Sparbetrieb: Detailplanung und Reviews möglichst knapp beauftragen.
- 2026-11-01 (#1, R00095): Der Zug nach „Erledigt“ kommt erst nach Push und Auslieferung (Gate, `git push origin main`, `cargo install`, Board-Neustart) — gestern brach die Session zwischen Zug und Push ab, und die Karte stand fertig da, ohne ausgeliefert zu sein. Board-Neustart über `.claude/factory/board.pid` (`kill $(cat …)`), nie `pkill -f` mit dem Ordnerpfad: das Muster trifft die eigene Shell.
