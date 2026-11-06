---
id: X00003
name: Zielgrößen
art: Aspekt
geltung: Makro
befund: Uneinheitlich
hausantwort: "ADR-0012 (Akzeptiert): Token --kd-ziel in web/kd-tokens.css, Basisregel in web/kd-base.css, Trefferhof für kleine Zeichen, Messprobe e2e/tests/ziele.spec.js"
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

Soll nach [ADR-0012](../../ADRs/0012-zielgroessen-als-zentrales-mass-mit-messprobe.md) (Akzeptiert, Karte #10, PO `AI-Team/po-entscheidungen.md:129–132`):

- Die Mindestkante jedes Zeigerziels ist `var(--kd-ziel)`. Sie steht genau einmal in `web/kd-tokens.css`: genau 24px bei feinem Zeiger (WCAG 2.2 SC 2.5.8), genau 48px in `@media (pointer:coarse)`. Die Messprobe verlangt bei Touch ≥ 44 ohne Ausnahme; bei 320 px darf ein Ziel bis 44 schrumpfen oder ins Menü „<Seite> ▾“ wandern, waagrechtes Scrollen bleibt verboten (PO `:130`). Die Abstandsausnahme ist die WCAG-Kreisformel, nur bei feinem Zeiger (`:131`).
- Die Basisregel in `web/kd-base.css` (`:where(button, select, input, a.btn, [role=checkbox|radio|menuitem|tab|switch])`) setzt die Mindestgröße. Inline-Links im Fließtext sind ausgenommen.
- Kleine Zeichen behalten ihre Zeichnung. Ihr Ziel wächst über einen durchsichtigen Trefferhof (`::after`), der weder Nachbarn überdeckt noch abgeschnitten wird.
- Benennt ein Text die Aktion, gehört er zum Ziel (Teilaufgabe: Kästchen und Text sind ein Element).

## Systemantwort

Ist 2026-11-06 nach Karte #10 (Zweig `karte/10`, `a83a43a`, noch nicht auf `main`): Token `--kd-ziel` in `web/kd-tokens.css` (24, unter `pointer:coarse` 48), `--kd-head-h` folgt ihm; Basisregel in `web/kd-base.css` (dazu `a.kz-btn` und der Link allein in seiner Zelle); Trefferhof bei feinem Zeiger nur an Symbolzeichen (`.lnk-x`, `.kopf-plus`, `.signal`, `.sigz`, `.kl`), Textknöpfe `.lnk` wachsen selbst; Leisten mit fester Höhe (`.bahn-kopf`, `.leg`, `.mod-kopf`, `.mod-fuss`, `.stat`) umschließen ihre Ziele mit `min-block-size`; keine Coarse-Liste mehr außerhalb der Tokens (Wächter `e2e/einheit/ziele.test.js`). Messprobe `e2e/tests/ziele.spec.js`: 22 Ansichten fein bei 1280 px und 21 bei Touch 390 px ohne Verstoß, `NICHT_GEMESSEN` leer. Breitenprobe 320/375/414 px: 59 von 60 grün, offen die Aufgabenliste bei 320 px (siehe Abweichungen).

Vorher (kanbanD `49d99ef`): Es gibt kein Token. Für den feinen Zeiger gibt es keine Regel, für Touch eine Selektorliste mit festem Wert 32 px (`web/kd-app.css:791–795`, R00077) und eine Einzelregel mit 44 px (`:277`, Bestandsbericht). Gemessen (headless Chromium, sechs Ansichten, ohne Abstandsausnahme): Bei feinem Zeiger liegen 18 von 114 Zielen unter 24, alle auf Board und Aufgabenliste. Bei Touch liegen 93 von 93 unter 44.

Erkennen von Abweichungen (Durchsetzung):

- Soll: die Messprobe `e2e/tests/ziele.spec.js` über alle Ansichten, je feiner Zeiger und Touch, mit Liste `NICHT_GEMESSEN` (Karte je Eintrag), dazu die reine Probe `e2e/einheit/ziele.test.js` über die Stylesheets.
- Heute ohne Probe: `grep -nE "pointer: ?coarse" web/*.css`. Jeder Treffer außerhalb von `web/kd-tokens.css` ist ein Befund, ebenso jedes `min-width`/`min-height` mit Zahlenwert, das ein Zeigerziel absichern soll.

## Abweichungen

| Baustein | Ort | Was anders ist |
|---|---|---|
| A00009 | `web/kd-app.css` `.kz-reihe` (nowrap), Kopfzeile der Aufgabenliste | bei 320 px ist die Seite 349 px breit: Filter 80 px und Segmentschalter „alle · ohne Board · archiviert“ 253 px in einer Zeile; mit Maus derselbe Überlauf (Breiten vom Text). Entscheidung zu B0407 offen (Umbruch, 44 px oder Menü „<Seite> ▾“) |

Behoben auf `karte/10` (B0399–B0405, B0408, B0409): Touch-Liste 32 px und Einzelregel 44 px aufgelöst; Teilaufgabe als ein Ziel mit Text; ✕ „von Board nehmen“, `.kopf-plus`, `.signal`, `.sigz`, `.kl` mit Trefferhof; Spaltenkopf, Legende, Statuszeile und Fensterleisten wachsen mit dem Token.

## Offene Fragen

- keine. Maße entschieden durch den PO 2026-11-06: fein genau 24 (`AI-Team/po-entscheidungen.md:129`), Touch genau 48 mit Untergrenze 44 und Ausweichregel 320 px (`:130`), Kreisformel nur fein (`:131`); Aufteilung Akzeptanzkriterium oder Test nach `:132` (ADR-0012 Regel 8).

## Notizen / Quellen

- WCAG 2.2 SC 2.5.8 (AA, 24×24, Ausnahme *Spacing* als 24-px-Kreis um die Mitte), SC 2.5.5 (AAA, 44×44): https://www.w3.org/TR/WCAG22/#target-size-minimum, abgerufen 2026-11-06.
- M3: Touch-Ziel 48 dp, Checkbox-Box 18 dp mit Ziel 48 dp, Chips 32 dp hoch (Factory-Gedächtnis `material3/notizen.md:197`, `:223`; https://m3.material.io/foundations/designing/structure).
- Muster der Messprobe: R00107 `e2e/tests/kontrast.spec.js` (Ansichtenliste, `NICHT_GEMESSEN` mit Karte, Selbstproben). Die Ansichtenliste wird ein gemeinsames Modul beider Proben.
- angelegt 2026-11-06 nach #10 (ADR-0012)
- nachgeführt 2026-11-06 nach PO-Entscheidung zu ADR-0012 (`AI-Team/po-entscheidungen.md:129–132`)
- nachgeführt 2026-11-06 nach dem Bau von Karte #10 auf `karte/10` (R00108, B0399–B0406)
