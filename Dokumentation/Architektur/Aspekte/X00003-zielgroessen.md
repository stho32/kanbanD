---
id: X00003
name: Zielgrößen
art: Aspekt
geltung: Makro
befund: Uneinheitlich
hausantwort: "ADR-0012 (Vorgeschlagen): Token --kd-ziel in web/kd-tokens.css, Basisregel in web/kd-base.css, Trefferhof für kleine Zeichen, Messprobe e2e/tests/ziele.spec.js"
betrifft:
  - A00009
herkunft: code
quellen:
  - web/kd-tokens.css
  - web/kd-base.css
  - web/kd-app.css
  - web/ansicht.js
  - e2e/tests/r00077-responsive.spec.js
---

# Zielgrößen

## Hausantwort

Soll nach [ADR-0012](../../ADRs/0012-zielgroessen-als-zentrales-mass-mit-messprobe.md) (Vorgeschlagen, Karte #10):

- Die Mindestkante jedes Zeigerziels ist `var(--kd-ziel)`. Sie steht genau einmal in `web/kd-tokens.css`: 24px bei feinem Zeiger (WCAG 2.2 SC 2.5.8), in `@media (pointer:coarse)` der Touch-Wert (Vorschlag 48, mindestens 44).
- Die Basisregel in `web/kd-base.css` (`:where(button, select, input, a.btn, [role=checkbox|radio|menuitem|tab|switch])`) setzt die Mindestgröße. Inline-Links im Fließtext sind ausgenommen.
- Kleine Zeichen behalten ihre Zeichnung. Ihr Ziel wächst über einen durchsichtigen Trefferhof (`::after`), der weder Nachbarn überdeckt noch abgeschnitten wird.
- Benennt ein Text die Aktion, gehört er zum Ziel (Teilaufgabe: Kästchen und Text sind ein Element).

## Systemantwort

Ist 2026-11-06 (kanbanD `49d99ef`): Es gibt kein Token. Für den feinen Zeiger gibt es keine Regel, für Touch eine Selektorliste mit festem Wert 32 px (`web/kd-app.css:791–795`, R00077) und eine Einzelregel mit 44 px (`:277`, Bestandsbericht). Gemessen (headless Chromium, sechs Ansichten, ohne Abstandsausnahme): Bei feinem Zeiger liegen 18 von 114 Zielen unter 24, alle auf Board und Aufgabenliste. Bei Touch liegen 93 von 93 unter 44.

Erkennen von Abweichungen (Durchsetzung):

- Soll: die Messprobe `e2e/tests/ziele.spec.js` über alle Ansichten, je feiner Zeiger und Touch, mit Liste `NICHT_GEMESSEN` (Karte je Eintrag), dazu die reine Probe `e2e/einheit/ziele.test.js` über die Stylesheets.
- Heute ohne Probe: `grep -nE "pointer: ?coarse" web/*.css`. Jeder Treffer außerhalb von `web/kd-tokens.css` ist ein Befund, ebenso jedes `min-width`/`min-height` mit Zahlenwert, das ein Zeigerziel absichern soll.

## Abweichungen

| Baustein | Ort | Was anders ist |
|---|---|---|
| A00009 | `web/kd-app.css:791–795` | Touch-Maß 32 px als Selektorliste (`.btn-sym,.kz-btn,.kopf-plus,.bk-name,.signal,.kz-menue .iz,.kz-chip`) statt Token; Felder, `.btn`, Chips der Berichte fehlen |
| A00009 | `web/kd-app.css:277` | zweites, eigenes Touch-Maß 44 px nur für `.best-tab a.bz`, `.best-tausch`, `.best-sel` |
| A00009 | `web/kd-app.css:615`, `web/ansicht.js:585` | Teilaufgabe auf der Karte: Kästchen 13×13 ohne Text im Ziel; ein Tipp auf den Text öffnet die Karte |
| A00009 | `web/kd-app.css:448` | `.lnk` ohne Mindestgröße, „von Board nehmen“ (✕) gemessen 8×14 |
| A00009 | `web/kd-app.css:609` | `.kopf-plus` 20×20 |
| A00009 | `web/kd-app.css:562`, `:109` | `.signal` 18×18, auf Karten mit Signal 22×22 |
| A00009 | `web/kd-app.css:569` | `.bahn-kopf .sigz` (Signalzähler im Spaltenkopf) 34×15 |
| A00009 | `web/kd-app.css:76`, `:67` | `.bk-name` 17 hoch im 30-px-Spaltenkopf |
| A00009 | `web/kd-app.css:182`, `:189` | Knöpfe der Legende 22 hoch, `.leg .x` 22×22, unter `overflow:hidden` (`:180`) |
| A00009 | `web/ansicht.js:591` | Timer-Stopp `.kl` auf der Karte (Karte #10: 24×22) |

## Offene Fragen

- Maß bei feinem Zeiger 24 oder 44, Maß bei Touch 48 oder 44: offen beim PO, Empfehlungen in ADR-0012, „Offene Fragen“.

## Notizen / Quellen

- WCAG 2.2 SC 2.5.8 (AA, 24×24, Ausnahme *Spacing* als 24-px-Kreis um die Mitte), SC 2.5.5 (AAA, 44×44): https://www.w3.org/TR/WCAG22/#target-size-minimum, abgerufen 2026-11-06.
- M3: Touch-Ziel 48 dp, Checkbox-Box 18 dp mit Ziel 48 dp, Chips 32 dp hoch (Factory-Gedächtnis `material3/notizen.md:197`, `:223`; https://m3.material.io/foundations/designing/structure).
- Muster der Messprobe: R00107 `e2e/tests/kontrast.spec.js` (Ansichtenliste, `NICHT_GEMESSEN` mit Karte, Selbstproben). Die Ansichtenliste wird ein gemeinsames Modul beider Proben.
- angelegt 2026-11-06 nach #10 (ADR-0012)
