---
id: R00243
status: Erledigt
datum: 2026-11-23
ursprung: Bug-Report
ursprungslauf: R00239
---

# R00243: Behebung von Laufansicht — Seitenfeld mit den Filtern bei niedrigem Fenster nicht erreichbar

## Beschreibung

Karte #266 (Befund 1 des Entwicklertests von #261). Das Seitenfeld der Laufansicht (`section.lv-gl` mit „Längste Schritte“, „Teuerste Schritte“, „Zeigen“) ist `position: sticky; top: 0`, hat aber weder Höhengrenze noch eigenes Rollen. Mit langen Befehlen und Pfaden ist es 946 bis 1.068 px hoch. In einem Fenster, das niedriger ist, klebt es oben, ragt unten über den Rollbereich hinaus und wird nie ganz sichtbar. „Zeigen“ steht ganz unten und ist dann weder per Klick noch per Tab erreichbar.

**Reproduktion** (heute rot): Lauf mit langen Befehlen und Pfaden (T15, siehe Ausgangslage), Fenster 1920 × 950. `sh` klickt „Systemhinweise“ (ohne `force`): der Klick scheitert mit „outside of the viewport“, „Werkzeuge“ verdeckt die Fußzeile. **Erwartet:** das Kästchen ist angehakt, und der Status endet auf „… eingebettete Systemhinweise sichtbar.“

**Was diese Anforderung von R00239 ablöst** (R00239 ist `Erledigt` und bleibt unverändert; für diesen einen Punkt geht diese Anforderung vor, PO Z. 622):

- **R00239 FA 8**, Satzteil „und darunter ‚Zeigen‘“ und die Angabe der Reihenfolge der linken Spalte: Ab 641 px steht „Zeigen“ als **erstes** Kind des Seitenfelds, darunter „Längste Schritte“, dann „Teuerste Schritte“.
- **R00239 AK 6**, die Aussagen „‚Zeigen‘ steht in der linken Spalte unter ‚Längste Schritte‘“ und „in Node unter ‚Teuerste Schritte‘“: ab 641 px steht es **über** beiden Listen.

Unverändert gelten: die Breiten der Spalte (232 px, 200 px), die Reihenfolge unter 641 px (PO Z. 590: Bericht vor der Gliederung, „Zeigen“ nach „Teuerste Schritte“), „Zeigen“ allein ohne Listen (Bild 7), Lese- und Tab-Reihenfolge gleich der sichtbaren, der Rest von AK 6 (Live-Ereignis, Sprung, Fokus) und AK 10 (kein Querscrollen). Die Zeichnung D0009 `#laufansicht` (Notiz „Gliederung links“, Bild 1, 1a, 7) wird für diesen Punkt nicht neu gezeichnet (PO Z. 622, Freigabe in Worten).

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): die Filter aus R00239 helfen nur, wenn man sie auf einem Laptop auch erreicht.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)

## Ursachenanalyse

### Root Cause

`web/kd-app.css:1892`: `.lv-gl{position:sticky;top:0;display:flex;flex-direction:column;gap:4px;min-width:0}` — kein `max-height`, kein `overflow`. Das Seitenfeld ist die linke Rasterspalte (`.lv-rumpf2`, `:1887`) und so hoch wie sein Inhalt; der Rollbereich `.lv` (`:1740`, `overflow:auto`) rollt die Seite, das klebende Feld bleibt oben. Ist das Feld höher als `.lv`, liegt sein unterer Teil dauerhaft außerhalb. Der Inhalt wuchs mit #253 (Filter unten) und #263 (Pfadnamen in „Teuerste Schritte“ brechen zeichenweise um, 616 px). Gemessen in der Probe der Architektur (`gemeinsam/scratchpad/arch-266/ergebnis2.tsv`, Stand ohne Änderung): Seitenfeld 1.068 px bei Rollbereich 576 px (1366 × 640); von zehn Elementen des Felds sind 3 bis 5 per Tab in Sicht, kein Kästchen von „Zeigen“ per Klick.
Ausgeschlossen: „weniger sticky“ (V2) und „Höhe nur begrenzen“ (V1–V5) tragen nicht, solange „Zeigen“ unten steht (Messung V1–V5, V8). Eingetretener Defekt ab 641 px; unter 641 px steht das Feld im Fluss (`:1912`) und ist über das Rollen der Seite erreichbar (Probe: Fokus 10/10).

### Betroffene Komponenten

- `web/kd-app.css` (Regeln `.lv`, `.lv-gl`, `.lv-teu .nach`)
- `web/lauf.js` (`laufTopHtml`, Reihenfolge der Kinder, `:395-401`)
- `e2e/einheit/lauf-filter.test.js` (FA 8, AK 6, `:77`), `e2e/tests/r00239-laufansicht-zeitachse-filter-blaettern.spec.js` (AK 6, `:356`)

## Lösungsvorschlag

### Langfristige Lösung

Variante V7 der Architektur (A00009, Notiz zu #266, PO Z. 622–624):

1. Ab 641 px ist `.lv` der Größen-Container (`container-type:size`), `.lv-gl` hat `max-height:100cqh` und `overflow-y:auto`: das Seitenfeld ist nie höher als der Rollbereich und rollt innen. `max-height:100%` geht nicht, das Rasterfeld ist so hoch wie die Einträge.
2. „Zeigen“ steht ab 641 px als erstes Kind des Seitenfelds (PO Z. 622); der Rollstand des Felds steht nach dem Neuzeichnen auf 0. Unter 641 px bleibt die Reihenfolge von PO Z. 590, das Feld steht im Fluss, ohne Höhengrenze und ohne inneres Rollen.
3. „Teuerste Schritte“ zeigt den Anlass (`.nach`) höchstens zwei Zeilen lang, danach „…“, ohne vollen Pfad (PO Z. 623); gleiche Kürzung wie `.wt` bei „Längste Schritte“.

### Alternative Ansätze

- Nur `max-height` und Rollen, „Zeigen“ unten (V1–V5, V8): trägt nicht, die Kästchen liegen unterhalb der Listen im Rollbereich, unter etwa 730 px Höhe unerreichbar.
- Seitenfeld nicht sticky (V2): das Feld rollt mit, aber auf einer langen Liste ist „Zeigen“ nach dem Lesen weit weg; löst den Fall unter 640 px, nicht den Fokus.
- „Zeigen“ aus dem Feld lösen (z. B. in die Leiste): neue Gestaltung, mehr Umfang; verworfen (PO Z. 622).
- Pfade in „Teuerste Schritte“ begrenzen, ohne Höhengrenze (V9): trägt nicht unter etwa 700 px.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

E2E-Spec `e2e/tests/r00243-laufansicht-seitenfeld-niedriges-fenster.spec.js` auf T15, **ohne Fix rot**: der Klick ohne `force` auf „Systemhinweise“ in 1920 × 950 scheitert (Zeitüberschreitung „outside of the viewport“ oder verdeckt), das ist der Reproduktionstest. Dazu Node-Fälle in `e2e/einheit/lauf-filter.test.js` (Reihenfolge der Kinder von `laufTopHtml`).

### Code-Extraktion für isoliertes Testing

Keine nötig: die Reihenfolge der Kinder ist in `laufTopHtml` schon rein (Auswertung in, HTML-Text aus) und in Node prüfbar; die Höhe und das Rollen sind Stil und nur im Browser prüfbar.

### Regressionstests

- Die Spec von R00239 bleibt grün, die zwei Erwartungen zur Reihenfolge (AK 6) werden auf „Zeigen über den Listen ab 641 px“ angepasst und sind der einzige geänderte Teil.
- Mutanten in einer eigenen Kopie (je von einem benannten Test getötet): `max-height` entfernt; `overflow-y:auto` entfernt; Media-Abfrage 641 → 981; `container-type:size` entfernt; „Zeigen“ wieder am Ende; Rollstand wird nicht auf 0 gesetzt.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00239: die gz-Datei erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/<n>/transkripte` ab): Mensch `sh`, Browser headless (Chromium), Board `fabrik` mit `record-transcripts: true`. **T15** (neu, nur erfundene Inhalte, in `e2e/tests/laufansicht-t15.js`; die nächste freie Nummer prüft der Entwickler): ein Lauf mit Tokens je Antwort, mindestens drei Aufrufen mit einem Befehl von über 150 Zeichen und einem Pfad von über 100 Zeichen, mindestens zwei in Nachrichten eingebetteten Systemhinweisen und einem Fehler, sodass „Längste Schritte“ und „Teuerste Schritte“ je drei Einträge tragen und das Seitenfeld ungekürzt über 1.000 px hoch ist (Probe der Architektur: 1.068 px). T1 und T4 aus R00234 wie dort.

- [x] **AK 1 Klick ohne `force`:** Gegeben T15, wenn `sh` in jedem der Fenster 1920 × 950, 1366 × 640, 1280 × 500, 844 × 390 (Touch, `hasTouch`) und 641 × 700 „Systemhinweise“, „Werkzeuge“ und „nur Fehler“ je mit einem echten Klick anklickt (Playwright `click` ohne `force`, ohne vorheriges `scrollIntoView` oder Rollen durch den Test), dann gelingt jeder Klick, das Kästchen wechselt seinen Stand, und der Statusbereich meldet den Wechsel; beim Anhaken von „Systemhinweise“ endet er auf „… eingebettete Systemhinweise sichtbar.“. Je Fenster ist „Zeigen“ nach dem Klick weiter im Fenster, über der Fußzeile. Nach „nur Fehler“ tragen die drei anderen Kästchen die Sperrform (R00239 AK 6/Z. 588), der Klick auf ein gesperrtes bleibt ohne Wirkung.
- [x] **AK 2 Gegenprobe unter 641 px:** Gegeben T15 in 375 × 667 und 320 × 568 (Touch), dann gelingt derselbe Klick ohne `force` auf alle drei Kästchen, das Seitenfeld hat keine Höhengrenze und rollt nicht innen (`getComputedStyle(.lv-gl).overflowY` ist `visible`, `scrollHeight` gleich `clientHeight`), „Zeigen“ steht nach „Teuerste Schritte“ (PO Z. 590, unverändert), und die Seite rollt dafür selbst (kein Rollen im Rollen).
- [x] **AK 3 Tab-Fokus:** Gegeben T15 in jedem Fenster von AK 1, wenn `sh` mit Tab durch alle Elemente des Seitenfelds geht (vier Kästchen und die sechs Listenknöpfe), dann liegt jedes beim Fokus ganz im Rollbereich `.lv` und im Seitenfeld, über der Fußzeile (`getBoundingClientRect` gegen `.lv`, `.lv-gl` und `#stat`), und `document.elementFromPoint` an seiner Mitte trifft das Element oder sein Etikett (Probe der Architektur: 10 von 10, heute 3 bis 5 von 10).
- [x] **AK 4 Reihenfolge, löst R00239 FA 8 und AK 6 ab:** Gegeben T15 und T1 bei 641 px und breiter, dann sind die Kinder des Seitenfelds in dieser Reihenfolge: „Zeigen“, „Längste Schritte“, „Teuerste Schritte“, und Lese- und Tab-Reihenfolge sind dieselbe (Tab vom Seitenkopf trifft zuerst „Nachrichten“). Gegeben T15 bei 640 px und schmaler, dann ist die Reihenfolge „Längste“, „Teuerste“, „Zeigen“. Wechselt das Fenster von 700 auf 600 px und zurück ohne Neuladen, stimmen Lese-, Tab- und sichtbare Reihenfolge jeweils überein. Gegeben T4, dann steht „Zeigen“ allein. In Node steht „Zeigen“ in `laufTopHtml` bei einer Auswertung mit `top3` und `teuer3` vor beiden Listen (angepasst: `e2e/einheit/lauf-filter.test.js` FA 8/AK 6).
- [x] **AK 5 Höhengrenze, Rollstand, Anlass:** Gegeben T15, dann ist `getComputedStyle(.lv-gl).overflowY` bei 641 × 700, 844 × 390, 1280 × 500 und 1920 × 950 `auto`, bei 640 × 700 `visible`; die Höhe des Seitenfelds ist höchstens die Höhe von `.lv` (1366 × 640: `.lv` 576 px, Feld höchstens 576 px, `scrollHeight` größer). Rollt `sh` das Seitenfeld bis zu „Teuerste Schritte“ (`scrollTop > 0`) und schaltet danach „Nachrichten“ per Tab und Klick, dann steht `scrollTop` auf 0 und „Zeigen“ ist sichtbar; zeichnet ein Live-Ereignis (Kosteneintrag) die Laufansicht neu, steht `scrollTop` ebenfalls auf 0. Der Anlass (`.nach`) in „Teuerste Schritte“ ist höchstens zwei Zeilen hoch, danach „…“, ohne vollen Pfad; der volle Pfad steht im aufgeklappten Schritt. Das Dokument und `.lv` rollen dabei nicht quer (R00239 AK 10: `scrollWidth ≤ clientWidth` bei 320, 641, 980 und 1280 px).
- [x] **AK 6 Kein `position:fixed` unter `.lv`:** `container-type:size` macht `.lv` zum Bezugsrahmen für feste Kinder. Gegeben T15 mit allen Schritten aufgeklappt und einem Tooltip an einem Listenknopf, dann hat kein Nachfahre von `.lv` `getComputedStyle().position === 'fixed'`; Tooltip, Menü und Dialoge hängen außerhalb (`.kd-tipp`, `.pop`, `.kmenue`, `.mod-bg`, `.al-bg`). Der Mutant „`position:fixed` an einem Kind der Insel“ ist rot.

Grenz- und Leerfälle: Seitenfeld ohne Listen (T4) hat keine Höhengrenze zu prüfen (Feld kleiner als der Rollbereich, 1920 × 950: Höhe ≤ `.lv`, kein Rollen); genau 641 px gilt das Rollen, genau 640 px nicht (AK 5); die Höhe 390 (Querformat) ist der engste Fall, das Feld von etwa 294 px rollt innen (PO Z. 624).

## Implementierungshinweise

- Reihenfolge: ein Baum, zwei Lagen (ab 641 „Zeigen“ zuerst, darunter zuletzt). Lese- und Tab-Reihenfolge müssen der sichtbaren folgen (AK 4); eine reine CSS-Umordnung (`order`) trennt Tab von Optik und trägt das nur, wenn sie das nicht bricht. Wie es gebaut wird (Umhängen im DOM bei `matchMedia`, Neuzeichnen), entscheidet der Entwickler; die Probe ist AK 4.
- CSS-Regeln aus V7 (Probe `gemeinsam/scratchpad/arch-266/probe2.js` der Factory): `@media (min-width:641px){.lv{container-type:size}.lv-gl{max-height:100cqh;overflow-y:auto}}` und `.lv-teu .nach{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}`; Farben und Abstände nur über Tokens (`kd-tokens.css`).
- Nach dem Bau Modell A00009 „Ist“ nachführen (Notiz zu #266 wird Ist).

## Offene Fragen

Keine, die den Bau aufhält. Die drei Fragen des architekt sind vom PO beantwortet (Z. 622–624).

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Defekt entsteht, weil ein klebendes Feld höher ist als der Bereich, in dem es klebt, und sein Eingabeteil ganz unten steht. Der Fix hebt die Eingaben nach oben (sie sind ohne Rollen erreichbar), begrenzt das Feld auf die Höhe des Rollbereichs (die Listen rollen innen, eine Orientierung, die rollen darf) und kürzt den Anlass, der die Höhe unberechenbar machte. Die Wirkungskette: „Zeigen“ oben → Klick und Tab treffen es in jeder Fensterhöhe; Höhengrenze → das Feld ragt nie hinaus; zwei Zeilen Anlass → die Höhe bleibt berechenbar. Die Probe der Architektur belegt die Kette in neun Fenstern (V7: 10 von 10 per Tab und Klick, heute 3 bis 5 von 10).

## Notizen

- Priorität: Hoch (Befund des Entwicklertests: die Filter sind auf einem Laptop nicht bedienbar).
- Betroffene Nutzer: Mensch in der Abnahme mit Fenster bis etwa 1000 px Höhe; Tastaturbedienung.
- Workaround: Seite verkleinern (Zoom) oder Fenster vergrößern.
- Quellen: Karte #266; PO Z. 622–624 (`AI-Team/po-entscheidungen.md`); A00009 Notiz zu #266; Probe `gemeinsam/scratchpad/arch-266/` der Factory (`ergebnis2.tsv`, V0, V6–V9).
- Verworfene Varianten siehe „Alternative Ansätze“.
