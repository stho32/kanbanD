# ADR-0016: Fenster folgen dem sichtbaren Bereich — `visualViewport` setzt zwei Maße, nur `.mod-bg` liest sie

**Status**: Akzeptiert
**Datum**: 2026-11-07
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #74, [R00111](../../Anforderungen/R00111-behebung-meldungen-und-knoepfe-schmaler-fenster.md) Lösung 5, AK 11, US-9; WBS I0100 Meldungen und Knöpfe der Fenster auf schmalen Bildschirmen, F0062 Meldung bleibt über der Bildschirmtastatur (B0454, B0455)
**Erprobt durch**: Probe in eigenem Headless-Chromium gegen das echte Programm (`~/.cargo/bin/kanbanD`, Kopie-Board auf freiem Port, Web-Stand kanbanD `791509c`, ausgeliefertes `kd-app.css` gleich dem Arbeitsbaum geprüft). Der Fuß-Fix aus ADR-0015 lag in beiden Läufen als Zusatz-CSS an, der Entwurf unten nur im Lauf „mit“. Die Tastatur war nachgebildet wie in R00111 (Layout 414 × 896 Touch, `visualViewport.height` 500, `offsetTop` 0, `resize` auf `visualViewport`). Ergebnis siehe [Probe](#probe).

## Kontext

Ein Fenster ist `.mod-bg{position:fixed; top:var(--kd-head-h); bottom:0}` (`web/kd-app.css:243`), bis 1024 px `top:0` und `.mod` in voller Höhe (`:820ff`). Der Fuß mit der Meldung steht also an der Unterkante des **Layout**-Viewports. iOS Safari und Chrome ab 108 verkleinern bei eingeblendeter Bildschirmtastatur nur den **sichtbaren** Bereich (`visualViewport`); das Layout bleibt. Nach einer abgelehnten Eingabe bleibt der Fokus im Feld (ADR-0015 Regel 4, `web/app.js:1210`, `:406`), die Tastatur bleibt offen, und die Meldung liegt unter ihr. Gemessen ohne Fix: Meldung unten bei 868 px, sichtbar bis 500 px; das Feld „Neue Herkunft“ (758–806 px) liegt ebenfalls unter der Tastatur.

`web/index.html:5` setzt kein `interactive-widget`, und kein Code liest `visualViewport`. Der einzige Hörer auf Größenänderungen ist `window` `resize` (`web/app.js:1633`); er prüft die Breitenstufe über `innerWidth`, und die ändert sich mit der Tastatur nicht.

Die Frage: **Wie folgt ein Fenster dem sichtbaren Bereich, ohne Board, Kopf und Desktop zu berühren?**

### Qualitätsziele und Szenarien

- **Bedienbarkeit auf jedem Gerät** (Vision, R00077, US-9): Auf einem Handy mit offener Tastatur liegen nach einer abgelehnten Eingabe Meldung und Feld ganz im sichtbaren Bereich (Unterkante ≤ `offsetTop + height`), auf iOS Safari wie auf Android Chrome.
- **Desktop unverändert** (R00077, US-3): Ohne Tastatur und ohne Zoom ändert sich an keiner Lage etwas, bei 1280 px wie bei 414 px.
- **Prüfbarkeit**: Ein E2E-Test zeigt den Fix rot und grün ohne echte Tastatur (AK 11), Mutanten werden rot.
- **Last** (Lastprofil bis 5 Neuzeichnungen/s): Die Bindung zeichnet nicht neu und hängt nicht an `render()`.

## Optionen

| # | Option | Stärke | Schwäche |
|---|---|---|---|
| a | **Bindung an `visualViewport`**: Hörer auf `resize` und `scroll`, gedrosselt auf ein Setzen je Frame, schreibt zwei Maße `--kd-vv-oben` und `--kd-vv-unten` an `document.documentElement`, nur wenn der sichtbare Bereich verdeckt ist und nicht gezoomt wird; sonst entfernt er sie. Nur `.mod-bg` liest sie, mit dem heutigen Wert als Rückfall. | Deckt iOS Safari und Chrome ab 108 ab. Per E2E über die Schnittstelle nachbildbar. Ohne Tastatur ist keine Variable gesetzt, die Regel rechnet den heutigen Wert: Desktop beweisbar unberührt. `documentElement` übersteht `render()` (ADR-0007). | Ein Stück Skript für etwas, das Plattformen eigentlich selbst lösen sollten; die Nachbildung prüft die Schnittstelle, nicht die Tastatur. Geräte, deren Tastatur den sichtbaren Bereich nicht meldet, bleiben ungelöst. |
| b | **`interactive-widget=resizes-content`** im Viewport-Meta (`web/index.html:5`). | Eine Zeile, kein Skript. Der Browser verkleinert den Layout-Viewport selbst. | Nur Chromium und Firefox, **nicht iOS Safari**. Wirkt nur mit echter Tastatur, per E2E nicht prüfbar — AK 11 hätte keinen roten Test. Ändert die ganze Seite: Board und Kopf springen bei jeder Eingabe im Kopf (Suche) oder Board. |
| c | **a und b zusammen**. | Chromium bekommt die Plattformlösung, iOS die Bindung. Kein Doppelausgleich: unter `resizes-content` ist `visualViewport.height` gleich `innerHeight`, (a) setzt dann nichts. | Zwei Mechanismen für ein Verhalten; der Anteil von (b) bleibt ungeprüft und trägt die Rückwirkung auf Board und Kopf. Kein Gewinn gegenüber (a). |
| d | **Vollbild-Fenster mit Meldung und Bestätigung oben** (Material 3, kompakte Breiten). | Die Tastatur verdeckt nur den unteren Teil; oben liegt immer im sichtbaren Bereich. | Ein zweiter Meldungsort und ein zweites Layout für schmal — widerspricht ADR-0015 (Option B verworfen, Regel 3: ein Meldungsort, der Fuß) und PO `AI-Team/po-entscheidungen.md` Z. 153 (keine neue Gestaltung vor dem Bau). Ein großer Umbau aller Fenster. |
| e | **Meldung beim Erscheinen in den sichtbaren Bereich scrollen** (`scrollIntoView`). | Kein Dauerhörer. | Ein `position:fixed`-Fenster lässt sich nicht in den sichtbaren Bereich scrollen; der Browser schiebt die Seite, nicht das Fenster. Löst das Feld unter der Tastatur nicht; würde zudem Fokus- und Scrollzustand anfassen, den ADR-0007 sichert. |

Datenhoheit: Die Lage des sichtbaren Bereichs gehört dem Browser (`visualViewport`). Die beiden Variablen sind ein abgeleiteter Wert ohne eigenen Zustand, in keinem `S`, nicht im Sichtzustand, nie gespeichert. Es gibt genau einen Schreiber (der Hörer) und genau einen Leser (`.mod-bg`).

## Entscheidung

**Option a.** Ausschlaggebend: Nur sie deckt iOS ab, und nur sie lässt sich mit einem ehrlichen roten Test prüfen. Ohne verdeckten Bereich ist sie nicht da, deshalb bleibt der Desktop unberührt. In Kauf genommen wird, dass der E2E-Test die Schnittstelle nachbildet und nicht die Tastatur. Der Nachweis am echten Gerät liegt auf der Zettelzeile von AK 11. Eine Tastatur, die `visualViewport` nicht meldet, bleibt ungelöst.

### Regeln

1. **Ein Hörer, zwei Maße.** Auf `visualViewport` `resize` **und** `scroll` (iOS verschiebt `offsetTop` beim Scrollen mit offener Tastatur) wird gedrosselt über `requestAnimationFrame` höchstens einmal je Frame gesetzt:
   `unten = innerHeight − offsetTop − height`; `--kd-vv-oben = offsetTop`, `--kd-vv-unten = max(0, unten)`.
   Danach `.focus()` aufrufen, neu zeichnen oder `S` ändern darf der Hörer nicht.
2. **Gesetzt nur bei verdecktem Bereich ohne Zoom.** Die Variablen stehen nur, wenn `|scale − 1| < 0,01` **und** (`unten > 1` oder `offsetTop > 1`). Sonst werden sie entfernt. Beim Zoomen mit zwei Fingern bewegt sich der sichtbare Bereich über das Layout. Ein Fenster, das ihm folgte, würde unter den Fingern wandern.
3. **Nur `.mod-bg` liest sie, mit dem heutigen Wert als Rückfall.** Basis `top: calc(var(--kd-head-h) + var(--kd-vv-oben, 0px)); bottom: var(--kd-vv-unten, 0px)`; bis 1024 px `top: var(--kd-vv-oben, 0px)`. Kein anderer Selektor liest die Variablen. Board, Kopf, Pop-Fenster und Toast bleiben am Layout.
4. **Wurzel erst beim Setzen lesen.** Der Hörer liest `document.documentElement` im Setzen, nicht beim Laden des Skripts. In der Probe warf ein im Init-Skript festgehaltenes `documentElement` (dort noch `null`), und der Fix blieb ohne Wirkung. `web/app.js` lädt am Ende des Body und ist davon nicht betroffen, die Regel gilt trotzdem für jeden späteren Ort.
5. **Einmal angemeldet, unabhängig von `render()`.** Der Hörer wird beim Start einmal angemeldet, wie der Hörer in `web/app.js:1633`, nicht in `render()`. Ohne `window.visualViewport` meldet er sich nicht an (Rückfall auf heute).

### Rückwirkungen

- **ADR-0007 Sichtzustand**: `render()` ersetzt `#kopf`, `#main`, `#over` per `innerHTML` (`web/app.js:508ff`). `documentElement` und seine Inline-Variablen überstehen das. Fokus und Scroll fasst die Bindung nicht an.
- **ADR-0010 Fokusführung**: Kein `.focus()`, deshalb kein Eintrag in `ERLAUBT`, und der Wächter bleibt unberührt.
- **ADR-0012 Zielgrößen**: `--kd-ziel` bleibt unberührt. Mit offener Tastatur wird `.mod` niedriger, der Körper `.mod-body` scrollt (schmal `overflow:auto`), der Fuß bleibt unten im sichtbaren Bereich.
- **ADR-0015**: Die Bindung setzt voraus, dass der Fuß gezeichnet ist (Regel 1, 3). Mit Fuß-Umbruch (Nachtrag N1) bleibt der Fuß der eine Meldungsort; die Bindung ändert nur, wo das Fenster unten endet.
- **Board und Kopf**: Sie liegen unter dem Scrim bzw. sind bei offenem Fenster inert und bewegen sich nicht. In der Probe war das Rechteck von `#kopf` vor und nach der Tastatur in allen Fällen gleich.
- **Desktop ohne Effekt**: Ohne verdeckten Bereich ist keine Variable gesetzt. Gemessen bei 1280 × 800 mit und ohne Fix: `.mod-bg` 40–800 px, Meldung, Feld identisch.
- **Takt und Last**: Ereignisse kommen nur beim Ein- und Ausblenden der Tastatur, bei Drehung und beim Scrollen mit offener Tastatur. Höchstens ein Setzen je Frame, kein Neuzeichnen, unabhängig von Live-Ereignissen.

### Durchsetzung (Fitness-Funktion)

Erster Test ist AK 11 (B0454), Layout 414 × 896 Touch, Tastatur nachgebildet über die Schnittstelle (`VisualViewport.prototype.height`/`offsetTop`, dann `resize` auf `visualViewport`).

- **Selbstprobe zuerst**: Im Test `visualViewport.height === 500` lesen, sonst ist die Nachbildung nicht wirksam (B0454).
- **Tastatur nach dem Fokus öffnen.** Die Nachbildung wird ausgelöst, **nachdem** das Feld den Fokus hat, so wie eine echte Tastatur aufgeht. Eine Nachbildung schon beim Laden lässt einen Mutanten grün, der nur beim Start liest (siehe Probe).
- **Gemessen wird**: die Unterkante von Meldung und fokussiertem Feld ≤ `offsetTop + height` und die Oberkante des Felds ≥ `offsetTop`; dazu `#kopf` unverändert.
- **Mutanten, die rot werden müssen**:
  - Lesen nur beim Start, ohne Hörer.
  - Hörer ohne `scroll`; geprüft mit `offsetTop` 150 nach `scroll`.
  - Variablen von `.mod-bg` entfernt.
- **Desktop**: bei 1280 × 800 ohne Nachbildung ist `--kd-vv-oben` nicht gesetzt, und `.mod-bg` liegt wie vorher.

Unit-Ebene entfällt mit Grund: Die Rechnung ist eine Zeile, die Probe liegt in der Wirkung auf das Layout. Integration entfällt: Server und API ändern sich nicht.

## Probe

Chromium headless, 414 × 896 Touch, sichtbarer Bereich 500, mit Fuß-Fix aus ADR-0015:

| Fall | ohne Bindung | mit Bindung |
|---|---|---|
| Herkunft „X1“ abgelehnt (US-1), Tastatur beim Laden | rot: Meldung unten 868, Feld 758–806, `.mod-bg` 0–896 | grün: Meldung 472, Feld 230–278, `.mod-bg` 0–500 |
| „Anlegen“ mit leerem Titel (US-4) | rot: Meldung 832 | grün: Meldung 436, Titel 65–113 |
| Tastatur geht nach dem Fokus auf | rot: Meldung 868 | grün: Meldung 472, Feld 209–257 |
| 844 × 390 quer, sichtbar 200 | rot: Meldung 362 | grün: Meldung 172, Feld 78–126 |
| `offsetTop` 150 (gescrollt) | — | grün: `.mod-bg` 150–650, Meldung 622 |
| Desktop 1280 × 800, keine Tastatur | grün | grün, identisch: `.mod-bg` 40–800, Variable nicht gesetzt |
| Gegenprobe Layout 414 × 500 statt Nachbildung | grün **ohne** Fix — Strohmann, bestätigt R00111 Test-Strategie | — |
| Mutant „liest nur beim Start“, Tastatur beim Laden | — | **grün** (Mutant überlebt) |
| Mutant „liest nur beim Start“, Tastatur nach dem Fokus | — | rot (Mutant gefangen) |

`#kopf` war in jedem Fall vor und nach der Tastatur gleich.

## Konsequenzen

- **Positiv**: Meldung und Feld bleiben mit offener Tastatur lesbar, auf iOS wie Android. Das gilt für jedes Fenster unter `.mod-bg`, auch künftige. Der Desktop ist beweisbar unberührt.
- **Negativ**: Ein Hörer mehr im Start. Mit offener Tastatur ist das Fenster niedriger, der Körper scrollt.
- **Neutral**: Pop-Fenster (`popPlatzieren`) und Toast folgen nicht. Sie tragen heute keine Meldung zu einer Eingabe mit offener Tastatur.

### Pre-Mortem

| Wie es scheitert | Gegenmittel |
|---|---|
| Der Test bildet die Tastatur beim Laden nach, und ein Bau, der nur beim Start liest, ist grün. | Regel „Tastatur nach dem Fokus öffnen“ in der Fitness-Funktion, Mutant „liest nur beim Start“. |
| Pinch-Zoom: Das Fenster wandert beim Zoomen. | Regel 2 (nur bei `scale` ≈ 1). |
| iOS scrollt mit offener Tastatur, `offsetTop` > 0, der Fuß rutscht. | `scroll`-Hörer (Regel 1), Mutant ohne `scroll`. |
| Init vor dem DOM wirft, der Fix bleibt still ohne Wirkung. | Regel 4; die Selbstprobe in B0454 zeigt eine Nachbildung ohne Wirkung als rot. |
| Das fokussierte Feld liegt nach dem Verkleinern außerhalb des Körpers. | In der Probe nicht aufgetreten (Feld 209–257 bzw. 230–278); AK 11 misst das Feld mit. |
| Die echte Tastatur verhält sich anders als die Nachbildung (Android mit `resizes-visual`, Tastaturen von Drittanbietern). | Zettelzeile von AK 11 am echten iOS Safari und Android Chrome. |
| Tablet quer über 1024 px mit Tastatur. | Basisregel rechnet `--kd-head-h` + `--kd-vv-oben`. |

## Offene Fragen

- Keine für die Wahl. Ob Pop-Fenster mit Eingabe (Suche, Zuweisen) dieselbe Bindung brauchen, zeigt die Zettelzeile. Die Regel 3 lässt das bewusst aus.

## Quellen / Bezüge

- Karte #74; R00111 (Lösung 5, Test-Strategie Bildschirmtastatur, AK 11, US-9); ADR-0007 Sichtzustand; ADR-0010 Fokusführung; ADR-0012 Zielgrößen; [ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) samt Nachtrag N1; Baustein [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)
- Code auf kanbanD `791509c`: `web/index.html:5`; `web/kd-app.css:243`, `:820ff`; `web/kd-tokens.css:43`; `web/app.js:406`, `:508ff`, `:1204–1216`, `:1633`
- Visual Viewport API (W3C CSSOM View), `interactive-widget` (Chromium ab 108 und Firefox; nicht Safari; Versionen gelesen, nicht erprobt)
