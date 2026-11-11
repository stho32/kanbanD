---
id: R00135
status: Neu
datum: 2026-11-11
---

# R00135: Hauptknöpfe „Fertig“ und „+ Neue Aufgabe“ geben im Hover Rückmeldung

## Beschreibung

Die beiden Hauptknöpfe des Boards reagieren nicht auf den Zeiger: „Fertig“ in der Modusleiste „Spalten einrichten“ und „+ Neue Aufgabe“ in der Kopfzeile behalten ihre Fläche `--kd-accent` auch im Hover. Die Ursache ist die Kaskade, kein fehlender Ton — die Hover-Fläche `--kd-accent-hover` und ihr Paar mit `--kd-on-accent` stehen seit R00107 (Funktionaler Anforderung 1) und die Hausform `.btn-haupt:hover` gibt sie seit langem vor (`web/kd-base.css:28`). An diesen beiden Knöpfen wird sie nur nicht angewandt: `.kz-modus .kz-btn.haupt` (`web/kd-app.css:81`) ist spezifischer als `.kz-btn:hover` (`web/kd-base.css:24`, darum ausgenommen in `web/kd-app.css:80`), und `.kz-btn.neu-btn` (`:691`) steht in der Kaskade hinter ihm. Diese Anforderung zieht das R00107-Kriterium an beiden Knöpfen nach (Karte #67, Befund aus dem UX-Review der Karte #9).

Zahlt ein auf: [Vision](R00000-vision.md) — „folgt gewohnten Konventionen“. Ein Knopf, der auf den Zeiger nicht reagiert, wirkt tot; die Rückmeldung im Hover ist eine gewohnte Konvention.

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Wer das Board mit der Maus bedient, sieht an den wichtigsten Aktionen seines Orts heute nicht, dass er auf einem bedienbaren Knopf steht: „+ Neue Aufgabe“ (anlegen) und „Fertig“ (Einrichten abschließen). Die Hausform `.btn-haupt:hover` (Fläche `--kd-accent-hover`) gibt es bereits; die beiden Knöpfe erreichen sie nur wegen ihrer Spezifität nicht. Ein Probe-Wächter, der den Zustandswechsel am Element misst, hält nach dem Fix fest, dass die Rückmeldung nicht wieder verschwindet — heute prüft nur die Token-Paartabelle den Ton, nicht seine Anwendung am Knopf.

## Funktionale Anforderungen

1. „Fertig“ in der Modusleiste „Spalten einrichten“ (`.kz-modus .kz-btn.haupt`, `web/kd-app.css:81`) wechselt im Hover auf die Fläche `--kd-accent-hover`.
2. „+ Neue Aufgabe“ in der Kopfzeile (`.kz-btn.neu-btn`, `web/kd-app.css:691`) wechselt im Hover auf die Fläche `--kd-accent-hover`.
3. Die Schrift beider Knöpfe bleibt `--kd-on-accent`; der Zustand ist die Fläche, keine zweite Schriftfarbe.
4. Die Ruhefläche bleibt `--kd-accent`, der Rahmen unverändert (Hausmuster `.btn-haupt:hover` ändert nur die Fläche). Es entsteht kein neuer Token und kein neuer Farbwert außerhalb `web/kd-tokens.css` (R00107 Funktionaler Anforderung 14).
5. Ein Regressionswächter misst den Hover-Zustand beider Knöpfe in `data-theme=light` und `data-theme=dark`.

## Nicht-funktionale Anforderungen

- **Maß**: Der Kontrast der Schrift `--kd-on-accent` gegen die Hover-Fläche `--kd-accent-hover` ist in beiden Themen mindestens 4,5:1 (R00107, WCAG 2.1 SC 1.4.3). Gerechnet (oklch → sRGB → WCAG, dieselbe Rechnung wie R00107): hell 7,84, dunkel 5,54.
- **Gestaltung**: Es ändert sich nur die Fläche der beiden Knöpfe im Hover; Form, Maße, Schrift und Anordnung bleiben. Kein neuer Gestaltungszustand.
- **Ein Ort**: Die Hover-Fläche bleibt `--kd-accent-hover` in `web/kd-tokens.css`; die beiden Knöpfe tragen nur die Regel.

## Akzeptanzkriterien

Grundbestand: das Board „entwicklung“ mit den Spalten „Zu erledigen“, „In Arbeit“ und „Erledigt“, über die API herstellbar. Breite 1280 px. „Hover“ heißt: der Zeiger steht auf dem Knopf (`page.hover`), gemessen mit `getComputedStyle(el).backgroundColor`. „Beide Themen“ heißt `data-theme=light` und `data-theme=dark`.

### Fläche (Funktionale Anforderungen 1–4)

- [ ] **1. Abnahme-Probe der Karte #67, wörtlich**: „`.haupt`/`.neu-btn` spezifischer als `.kz-btn:hover`, Fläche bleibt gleich.“
  - Besteht (nach dem Fix): bei 1280 px, hell und dunkel, entspricht die berechnete Fläche von „+ Neue Aufgabe“ und — nach „Mehr“ → „Spalten einrichten“ — von „Fertig“ im Hover `--kd-accent-hover` und weicht von der Ruhefläche `--kd-accent` ab.
  - Fällt durch (heute): beide Knöpfe behalten im Hover die Fläche `--kd-accent` — gemessen ändert sich `backgroundColor` beim Verweilen nicht.
  - Prüfebene: E2E `r00135` (neu).
- [ ] **2. Ruhe unverändert**: ohne Hover ist die Fläche beider Knöpfe `--kd-accent`, `border-color` `--kd-accent`, `color` `--kd-on-accent` — wie heute.
- [ ] **3. Zeiger weg**: verlässt der Zeiger den Knopf, ist die Fläche wieder `--kd-accent` (kein bleibender Zustand).

### Kontrast (Nicht-funktionale Anforderung)

- [ ] **4. Hover-Kontrast**: `--kd-on-accent` gegen die Hover-Fläche ist in beiden Themen ≥ 4,5:1 — gerechnet hell 7,84, dunkel 5,54; im Browser ≥ 4,5. Gegeben ein Hauptknopf im Hover, hell und dunkel.

### Gegenproben (Mutanten)

- [ ] **5.** Die Hover-Regel eines der beiden Knöpfe entfernt → die Probe zur Fläche wird rot und nennt den Knopf.
- [ ] **6.** `--kd-accent-hover` im hellen Thema auf den Wert von `--kd-accent` gesetzt → die Probe zur Abweichung wird rot.

### Abnahme der Karte

- [ ] **7.** `npx playwright test r00135` in `e2e/` ist grün; `node --test e2e/einheit/` grün; `npx playwright test kontrast r00009 r00097 ziele` bleiben grün.
- [ ] **8. Kriterium nachgezogen**: R00107 Funktionaler Anforderung 1 nennt das Hover-Paar `--kd-accent-hover` ↔ `--kd-on-accent` auch an `.kz-modus .kz-btn.haupt:hover` und `.kz-btn.neu-btn:hover`.

## Betroffene Verzeichnisstruktur

```
web/
  kd-app.css                                 geändert: Hover-Regeln .kz-modus .kz-btn.haupt:hover (:81) und .kz-btn.neu-btn:hover (:691)
e2e/
  tests/r00135-hauptknoepfe-hover.spec.js    neu: Hover-Fläche, Abweichung und Kontrast hell/dunkel
Anforderungen/
  R00107-kontrast-farbrollen-in-paaren.md    geändert: Hover-Kriterium an beiden Hauptknöpfen nachgezogen (FA 1, Notizen)
```

## Technische Überlegungen

### Optionen

| | A: Hover-Regel mit `--kd-accent-hover` (Hausmuster) | B: Spezifität senken, damit `.kz-btn:hover` greift | C: keine Hover-Rückmeldung (heute) |
|---|---|---|---|
| Deckt die Probe | ja | ja | nein |
| Hausmuster | folgt `.btn-haupt:hover` (`web/kd-base.css:28`) | weicht ab: `.kz-btn:hover` gibt `--kd-head-line`, nicht den Akzent-Ton | — |
| Risiko | gering: zwei Regeln, kein neuer Wert | mittel: ändert die Kaskade aller Kopfknöpfe, Rückwirkung auf andere Zustände | schlechte Rückmeldung |
| Sichtbare Änderung | Fläche im Hover dunkler | Fläche im Hover in falschem Ton | keine |

**Entscheidung: A** (Architektur bestanden 2026-11-11, keine Technikfrage, kein ADR): Die Hausform `.btn-haupt:hover` gibt Fläche und Ton vor; sie wird an den beiden spezifischeren Selektoren nur nachgezogen. B stellte die Hover-Fläche aller Kopfknöpfe auf `--kd-head-line` um — nicht gewollt und weiter reichend als der Befund.

### Ablauf

1. In `web/kd-app.css`: `.kz-modus .kz-btn.haupt:hover{background:var(--kd-accent-hover)}` und `.kz-btn.neu-btn:hover{background:var(--kd-accent-hover)}`; Rahmen und Schrift unverändert.
2. Probe `e2e/tests/r00135-hauptknoepfe-hover.spec.js` nach dem Muster von `e2e/tests/kontrast.spec.js`: je Knopf und Thema die Hover-Fläche gegen `--kd-accent-hover`, ihre Abweichung von der Ruhefläche und der Kontrast ≥ 4,5.
3. `web/kd-app.css` ist per `include_bytes!` in die Binärdatei eingebettet — nach der Änderung `cargo build` und Neustart.

### Wächter

`kontrast` (ADR-0011, Paar `accent-hover/on-accent`), `r00009` (Modusleiste „Spalten einrichten“), `r00097` und `ziele` (Kopfzeile, Breiten).

## Tests

Nach Skill `test-pyramide`; die Szene ist eine sichtbare Zustandsänderung (Skill `test-ehrlichkeit`).

- **Unit**: entfällt — keine reine Logik; das Paar `--kd-accent-hover` ↔ `--kd-on-accent` prüft R00107 schon in `e2e/einheit/kontrast.test.js`.
- **E2E**: neu `e2e/tests/r00135-hauptknoepfe-hover.spec.js` mit AK 1–4; gegen heute rot (beide Knöpfe bleiben im Hover `--kd-accent`).

## Abhängigkeiten

- R00107 (Hover-Paar, hier nachgezogen), R00009 (Modusleiste „Spalten einrichten“), R00101 (Kopfzeile), ADR-0011 (Farbrollen in Paaren und Kontrast als Probe).
- Abgegrenzt, nicht Teil dieser Anforderung: die Hover-Paare selbst (R00107 prüft sie), die übrigen `.kz-btn`-Zustände und `--kd-accent-hover` als Token.

## Offene Fragen

- Keine.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine — kein neuer Token, kein neues Dateiformat; `web/` ist eingebettet, sichtbar erst nach `cargo build` und Neustart.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist ein Befund aus dem UX-Review der Karte #9: „Fläche bleibt gleich“. Die Ursache ist nicht ein fehlender Ton — das Paar `--kd-accent-hover` ↔ `--kd-on-accent` steht seit R00107 in der Paartabelle und hält sein Maß —, sondern die Kaskade: die beiden Hauptknöpfe sind spezifischer als `.kz-btn:hover` und stehen später im Stylesheet, sodass die allgemeine Hover-Regel sie nicht erreicht. Indem genau diese zwei Selektoren die Hausform `.btn-haupt:hover` erben, reagieren die sichtbarsten Aktionen wieder auf den Zeiger, ohne neuen Wert und ohne zweite Gestaltung. Die Probe misst den Zustandswechsel am Element, nicht nur die Tokens: ein späterer Umbau, der die Hover-Regel wieder verdeckt, fällt in einem Lauf auf und nicht erst in der nächsten Durchsicht. Damit schließt der Befund denselben Kreis wie R00107 — ein Befund wird zur Probe, die Probe zum Wächter.

## Missing-Docs

- Keine.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene Interaction I0123 unter D0002 (Bubbles B0615, B0616) mit eigener Anforderung R00135 — die Härtungsregel (`AI-Team/gelerntes.md` 2026-11-11; Vorbild I0106/R00117 für Karte #17). Der Auftrag nannte „I0096/R00107 (Folge-Bubble)“; I0096 ist grün, eine rote Folge-Bubble daran öffnete dessen Abnahme. Der Auftrag nennt zugleich eine feste eigene R-Nummer (R00135), was zur eigenen Interaction passt. Elterndialog D0002, weil beide Knöpfe in der Kopfzeile liegen (Modusleiste „Fertig“, Kopfzeile „+ Neue Aufgabe“).
- **R00107-Kriterium nachgezogen**: R00107 Funktionaler Anforderung 1 nennt das Hover-Paar jetzt auch an `.kz-modus .kz-btn.haupt:hover` und `.kz-btn.neu-btn:hover`; R00135 führt es aus.
- **Einarbeitung Architektur (2026-11-11, bestanden, kein ADR)**: keine Technikfrage — die Hausform `.btn-haupt:hover` gibt Fläche und Ton vor.
