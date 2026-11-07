---
id: R00111
status: Neu
datum: 2026-11-07
ursprung: Bug-Report
ursprungslauf: R00077
---

# R00111: Behebung — Meldungen und Knöpfe der Fenster fehlen auf schmalen Bildschirmen

## Beschreibung

Wer kanbanD auf dem Handy bedient und im Aufgabenfenster eine ungültige Herkunft einträgt, etwa „X1“ + Enter, bekommt keine Rückmeldung. Das Feld behält den Wert, der Fokus steht wieder darin, aber die Meldung „„X1“ ist keine Herkunft — …“ ist weder zu sehen noch wird sie vorgelesen. Auch „gespeichert HH:MM:SS“ nach einer gültigen Änderung fehlt. Im Fenster „Neue Aufgabe“ fehlen auf dem Handy zusätzlich die Knöpfe „Abbrechen“, „Anlegen und weitere“ und „Anlegen“ sowie die Meldung „Die Aufgabe braucht einen Titel“. Anlegen geht dort nur über Enter auf der Bildschirmtastatur, Abbrechen nur über einen Tipp auf den Hintergrund.

Reproduktion (architekt, isolierte Probe mit den echten Stilen auf kanbanD `6636db3`, ADR-0015 „Erprobt durch“): bei 414 und 640 px haben die Meldung des Aufgabenfensters, die Meldung von „Neue Aufgabe“ und der Knopf „Anlegen“ 0 Client-Rects und keinen Eintrag im Accessibility-Snapshot; ab 641 px sind sie sichtbar.

Der Fehler besteht seit R00077 (Responsive für Tablet und Handy). R00077 sagt zu, dass auf dem Handy „dieselbe Oberfläche“ gilt und das Aufgabenfenster den Bildschirm füllt; die Meldungen und Knöpfe des Fußes sind dabei verloren gegangen.

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Weboberfläche, im LAN erreichbar“: Der Browser auf dem Handy im LAN ist ein vollwertiger Zugang, kein Lesemodus. Eine Oberfläche, die eine abgelehnte Eingabe verschweigt, lässt den Menschen raten, ob seine Änderung in der Datei steht — und die Datei ist der einzige Speicher.

Die technische Entscheidung steht in [ADR-0015](../Dokumentation/ADRs/0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) (Option A); diese Anforderung macht sie prüfbar.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — Bestandteil „Fuß: Speicherhinweis und Fehlermeldung“
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — bis einschließlich 640 px

## Ursachenanalyse

### Root Cause

Die Responsive-Regel aus R00077 blendet bis 640 px den Fuß jedes Fensters als Ganzes aus: `.mod-fuss{display:none}` in `@media (max-width:640px)` (`web/kd-app.css:836`). Gemeint waren die Tastenhinweise (`Esc schließen · ↑↓ Karte wechseln`, `Enter im Titel … legt an`), die auf einem Handy nichts nützen. Im selben Container stehen aber:

| Fenster | Ort | Inhalt des Fußes |
|---|---|---|
| Aufgabenfenster | `web/ansicht.js:256` | Meldung `S.ui.fensterFehler` (`role="alert"`), Anzeige „gespeichert HH:MM:SS“ (`.gs`), Tastenhinweis |
| Neue Aufgabe | `web/ansicht.js:187` | Meldung `f.fehler` (`role="alert"`) **oder** Tastenhinweis, Knöpfe „Abbrechen“, „Anlegen und weitere“, „Anlegen“ |
| Defekte Datei | `web/ansicht.js:520` | Erklärsatz „Die Datei ist nur lesbar, bis sie im Editor repariert ist …“; die Meldung des Defekts steht oben in `.archbar.warnbar` und ist nicht betroffen |

Ein Element unter `display:none` ist nicht im Accessibility-Baum; eine Meldung mit `role="alert"` wird dort weder gezeichnet noch angesagt (WCAG 3.3.1, 4.1.3). Die Klasse des Fehlers: **Eine Breitenregel blendet einen Container aus, statt die Elemente, die gemeint sind.** Die Probe von R00077 (`e2e/tests/r00077-responsive.spec.js`) prüft Breite und Anordnung, aber keine Meldung und keinen Knopf, deshalb blieb der Fehler unbemerkt.

### Betroffene Komponenten

- `web/kd-app.css:836` — schmale Regel (Ursache)
- `web/kd-app.css:367` — `.mod-fuss` mit `white-space:nowrap; overflow:hidden` (schmal würde eine lange Meldung abgeschnitten)
- `web/ansicht.js:187`, `:256` — Markup der Füße (Tastenhinweise ohne Markierung)
- `e2e/tests/r00077-responsive.spec.js` — Probe ohne Meldungen und Knöpfe

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0015 Option A:

1. **Der Fuß bleibt in jeder Breite.** Bis 640 px fallen nur die Tastenhinweise weg, einzeln. Sie tragen dafür eine Hinweis-Klasse im Markup (`web/ansicht.js:187`, `:256`); die schmale Regel blendet `.mod-fuss .<hinweis>` aus statt `.mod-fuss`. Den Klassennamen wählt der Bau, nicht `.leer` (vergeben).
2. **Der Fuß bricht schmal um**, statt abzuschneiden: Umbruch der Zeile, die Meldung mit normalem Zeilenumbruch in einer eigenen Zeile; die Knopfgruppe von „Neue Aufgabe“ bricht als Ganzes um, die Knöpfe behalten `--kd-ziel` (ADR-0012).
3. **Die Meldung nimmt keinen Fokus** (ADR-0010). Der Fokus kehrt über `u.fokus` ins Feld der Eingabe zurück (heute schon so: `web/app.js:1210` für die Herkunft, `:406` für den Titel), angesagt wird über `role="alert"`.
4. **Ab 641 px ändert sich nichts** am gezeichneten Fuß.

`S.ui.fensterFehler` bzw. `f.fehler` bleibt die einzige Quelle der Meldung; es gibt keine zweite gezeichnete Kopie (zwei `role="alert"` würden doppelt angesagt).

### Alternative Ansätze

- **Meldungszeile oben im Fenster** (ADR-0015 Option B): ändert den Desktop gegen R00077 und löst die Knöpfe von „Neue Aufgabe“ nicht.
- **Meldung am Feld** (ADR-0015 Option C): bessere Nähe zur Eingabe, aber ein Meldungsort je Feld statt je Fenster und keine Antwort auf die fehlenden Knöpfe.
- **Nur den Fuß schmal wieder einblenden, ohne Umbruch**: kleinste Änderung, aber bei 320 px würden Meldung oder Knöpfe abgeschnitten (`overflow:hidden`) oder die Seite scrollte quer (verboten, PO Z. 98, 105).

## Test-Strategie

- **Unit**: entfällt mit Grund. Es gibt keine reine Logik, nur CSS und Markup (ADR-0015, Durchsetzung). Ein Wächter auf den CSS-Text wäre schwächer als die E2E-Probe, die das Gezeichnete misst; die Mutanten decken die Regel.
- **Integration**: entfällt mit Grund. Server und API ändern sich nicht; die Meldungstexte kommen unverändert vom Server bzw. aus `web/app.js`.
- **E2E** (Playwright, neue Datei `e2e/tests/r00111-meldungen-schmal.spec.js` neben `r00077-responsive.spec.js`, Treiber `e2e/tests/hilfen.js`: `kanbanStarten`, `alsPerson`): zwei Geräteprofile — **schmal** 414 × 896 px mit `isMobile` und `hasTouch`, **breit** 1280 × 800 px mit feinem Zeiger; für Querscrollen zusätzlich 320 und 375 px mit Touch.

### Unit Test zur Bug-Reproduktion

Der Fehler entsteht nur aus dem gezeichneten Layout im Browser; die Reproduktion ist deshalb der **E2E-Fall US-1** („abgelehnte Herkunft X1 wird bei 414 px als alert gemeldet, Fokus bleibt im Feld“). Er steht vor der ersten Bubble als erwartet roter Test (`test.fail` mit Verweis auf #74) und wird beim Bau ohne Umdeutung grün.

Geprüft wird ohne feste Pause: auf die Meldung warten (`expect(locator).toHaveCount(1)` auf `[role=alert]` im Fenster), dann `getClientRects().length > 0`, `ariaSnapshot()` des Fensters enthält `alert` mit dem Meldungstext, `document.activeElement.id === 'herkunft-neu'`.

### Code-Extraktion für isoliertes Testing

Entfällt — keine Logik zu extrahieren.

### Regressionstests

- `e2e/tests/r00077-responsive.spec.js` (Handy, Tablet, Desktop), `ziele.spec.js` (R00108, Zielgrößen bei Touch ≥ 44 px), `r00036-neue-aufgabe.spec.js`, `r00018-herkunft.spec.js`, `r00106-fokus-raster.spec.js` (Fokus in Fenstern) und `kontrast.spec.js` bleiben grün.
- Alle Ebenen: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`.

## Akzeptanzkriterien

Gegeben jeder Prüfung: Board `entwicklung` mit den Spalten „Zu erledigen“, „In Arbeit“, „Erledigt“; Aufgabe #1 „Abnahme prüfen“ ohne Herkunft in „Zu erledigen“; Person `st` (Mensch) im Browser. „Schmal“ heißt 414 × 896 px mit Touch, „breit“ heißt 1280 × 800 px mit feinem Zeiger. „Sichtbar“ heißt: das Element hat Client-Rects (`getClientRects().length > 0`) und liegt ganz im Fenster.

### Bug behoben (Pflicht)
- [ ] Der Reproduktionstest US-1 ist ohne Fix rot und mit Fix grün (E2E)
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story (US-1 bis US-8) nicht mehr auf (E2E)
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün (`cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`)

### Aufgabenfenster (E2E)
- [ ] **1 — Abgelehnte Herkunft schmal gemeldet (Karte #74).** Gegeben schmal, das Aufgabenfenster von #1 ist offen; wenn `st` im Feld „Neue Herkunft“ „X1“ eingibt und Enter drückt, dann ist eine Meldung sichtbar, die mit „„X1“ ist keine Herkunft“ beginnt, sie steht im Accessibility-Snapshot des Fensters als `alert`, der Fokus steht im Feld „Neue Herkunft“ mit dem Wert „X1“, und die Datei von #1 enthält keine Herkunft „X1“ — heute 0 Client-Rects und kein `alert` im Snapshot
- [ ] **2 — „gespeichert“ schmal sichtbar.** Gegeben schmal, das Aufgabenfenster von #1 ist offen; wenn `st` den Titel in „Abnahme prüfen lassen“ ändert und das Feld verlässt, dann ist „gespeichert HH:MM:SS“ mit der Uhrzeit der Änderung sichtbar, und die Datei von #1 trägt den neuen Titel
- [ ] **3 — Breit unverändert.** Gegeben breit, derselbe Ablauf wie in 1; dann ist die Meldung sichtbar und als `alert` im Snapshot, der Fokus steht im Feld, und der Fuß ist genauso hoch wie vor dem Fix und einzeilig (Vergleichswert vor dem Fix im Test gemessen; nach `web/kd-app.css:367` 28 px, gelesen, nicht gemessen); die Tastenhinweise „Esc schließen · ↑↓ Karte wechseln“ sind sichtbar
- [ ] **4 — Lange Meldung bricht schmal um, nichts scrollt quer.** Gegeben das Aufgabenfenster von #1 bei 320, 375 und 414 px mit Touch und die Meldung aus 1; dann ist die Meldung ganz lesbar (nicht abgeschnitten: ihre `scrollWidth` ≤ `clientWidth`), und weder die Seite noch das Fenster scrollt waagrecht (`scrollWidth` ≤ `clientWidth` an Dokument und Fenster; bei 320 px ist die Seite höchstens 320 px breit, 321 px fällt durch); die Tastenhinweise sind schmal nicht sichtbar

### „Neue Aufgabe“ (E2E)
- [ ] **5 — Leerer Titel schmal gemeldet.** Gegeben schmal, „Neue Aufgabe“ ist offen, der Titel ist leer; wenn `st` auf „Anlegen“ tippt, dann ist die Meldung „Die Aufgabe braucht einen Titel“ sichtbar und als `alert` im Snapshot, der Fokus steht im Titel, und die Board-Datei enthält keine neue Aufgabe
- [ ] **6 — Die drei Knöpfe schmal bedienbar.** Gegeben schmal, „Neue Aufgabe“ ist offen: „Abbrechen“, „Anlegen und weitere“ und „Anlegen“ sind sichtbar und je mindestens 44 × 44 px groß; Titel „Handy-Aufgabe“ + Tipp auf „Anlegen“ legt die Aufgabe in „Zu erledigen“ an und schließt das Fenster; Titel „Zweite“ + Tipp auf „Anlegen und weitere“ legt sie an und lässt das Fenster mit leerem Titel offen; ein Tipp auf „Abbrechen“ schließt das Fenster ohne neue Aufgabe
- [ ] **7 — Kein Querscrollen.** Gegeben „Neue Aufgabe“ mit der Meldung aus 5 bei 320, 375 und 414 px mit Touch; dann scrollt weder die Seite noch das Fenster waagrecht, und jeder der drei Knöpfe liegt ganz im Fenster

### Schmal so bedienbar wie breit (E2E, Fitness-Funktion ADR-0015)
Zusätzlich gegeben: #2 „Kosten prüfen“ mit Preisetikett, #3 „Altlast“ archiviert, #4 eine defekte Aufgabendatei. Fensterliste: Aufgabenfenster #1 mit den Reitern „Inhalt“ und „Datei“, Aufgabenfenster #2 mit Reiter „Kosten“, Aufgabenfenster #3 (archiviert), „Neue Aufgabe“ mit der Meldung aus 5, Defekte Datei #4.
- [ ] **8 — Bedienelemente.** Je Fenster der Liste hat bei schmal jedes Bedienelement Client-Rects, das bei breit im selben Fenster sichtbar ist (Knöpfe, Links, Felder, Auswahllisten, Reiter, Kästchen); ausgenommen ist nur die Liste `AUSNAHMEN`, heute genau ein Eintrag: „In VS Code öffnen“ im Kopf des Aufgabenfensters (`#vsc`), Grund: ein `vscode://`-Link hat auf dem Handy kein Ziel
- [ ] **9 — Meldungsträger.** Je Fenster der Liste hat bei schmal jedes gezeichnete Element mit `role="alert"`, `role="status"` oder `aria-live` Client-Rects
- [ ] **10 — Die Ausnahmeliste ist ehrlich.** Jeder Eintrag in `AUSNAHMEN` nennt Selektor, Fenster und Grund; die Probe schlägt Alarm, wenn das ausgenommene Element bei breit fehlt oder bei schmal sichtbar wird (dann gehört der Eintrag gestrichen)

### Mutanten (E2E, Abnahme-Probe)
Je Mutante wird die ausgelieferte Datei per `page.route` ersetzt (`**/kd-app.css` bzw. `**/ansicht.js`); greift der Ersatz nicht, wirft die Route. Kein Mutant wird ins Repository geschrieben.
- [ ] **M1** — `.mod-fuss` steht wieder in der Regel bis 640 px (`display:none`): US-1, US-4 und die Probe 8/9 werden rot
- [ ] **M2** — die Hinweis-Klasse sitzt an der Meldung statt am Tastenhinweis: US-1 und die Probe 9 werden rot
- [ ] Das Ergebnis jeder Mutantenprobe (Fall, Mutante, rot ja/nein) steht im Bericht des Baus

## Implementierungshinweise

- Hinweis sind nur die Tastenhinweise: in `:256` die Spanne `Esc schließen · ↑↓ Karte wechseln`, in `:187` die Spanne mit `Enter im Titel …` (sie steht dort nur, wenn keine Meldung da ist). „gespeichert“ (`.gs`) und der Erklärsatz des Defektfensters (`:520`) sind Inhalt und bleiben schmal sichtbar.
- Die Knopfgruppe in `:187` trägt heute ein Inline-`style` (`margin-left:auto;display:flex;gap:6px`); ob sie für den Umbruch eine Klasse bekommt, entscheidet der Bau.
- `.mod-kopf .nav`, `.mod-kopf .cls` und `.mod-kopf .pfad` bleiben schmal ausgeblendet; sie sind weder Bedienelement noch Meldung und brauchen keinen Eintrag in `AUSNAHMEN` (ADR-0015, Durchsetzung). Auch `.leg .rechts` und `.stat>.mono` außerhalb der Fenster tragen nur Hinweise und bleiben, wie sie sind.
- Muster der Ausnahmeliste: `NICHT_GEMESSEN` in `e2e/tests/ziele.spec.js` (ADR-0012 Regel 6); die Fensterliste gehört neben `e2e/tests/ansichten.js`, nicht als zweite Kopie der Fixtures.
- Preisetikett als Fixture wie `e2e/tests/r00105-preisetikett.spec.js:107`, defekte Datei wie `r00025-defekt.spec.js`.
- Die Touch-Zielgröße kommt aus `--kd-ziel` (48 px bei Touch); keine eigene Pixelzahl im Fuß (ADR-0012 Regel 1).

## Offene Fragen

- **Abgegrenzt, kein Akzeptanzkriterium:** Wird eine `role="alert"`-Meldung, die `render()` bei jedem Neuzeichnen per `innerHTML` neu einfügt, von NVDA, VoiceOver und TalkBack wiederholt angesagt (ADR-0015, Offene Fragen)? Auf dem Desktop schon heute so, durch diese Anforderung nicht verändert und im Headless-Browser nicht prüfbar. Empfehlung: eigene Karte mit Screenreader-Probe; wird sie bejaht, braucht das Zeichnen einen stabilen Meldungsknoten.
- **Gestaltung vor dem Bau:** Der umbrechende Fuß bis 640 px ist im Artboard D0003 nicht gezeichnet. Empfehlung: kein neues Artboard und kein Warten, weil kein neues Element entsteht, sondern der Fuß des Desktops in zwei Zeilen; Bildschirmfotos bei 414 und 320 px auf dem Abnahmezettel. Entscheidet der Auftraggeber über den product-owner.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass die schmale Regel den ganzen Fuß ausblendet statt der Tastenhinweise darin. Werden nur die markierten Hinweise ausgeblendet, sind Meldung, „gespeichert“ und die Knöpfe von „Neue Aufgabe“ auf dem Handy wieder gezeichnet und im Accessibility-Baum (1, 2, 5, 6). Weil der Fuß schmal umbricht, wird dabei nichts abgeschnitten und nichts scrollt quer (4, 7). Die Probe „schmal so bedienbar wie breit“ über alle Fenster samt Mutanten verhindert, dass eine künftige Breitenregel wieder einen Container mit Meldung oder Aktion ausblendet (8–10, M1, M2) — das schließt die Klasse des Fehlers, nicht nur die Stelle.

## Notizen

- Priorität: Hoch (Klasse Vorrang) — eine abgelehnte Eingabe wird auf dem Handy verschwiegen; „Neue Aufgabe“ ist dort nur halb bedienbar
- Betroffene Nutzer/Systeme: jeder Mensch, der kanbanD auf einem Bildschirm bis 640 px Breite bedient
- Workaround: Gerät quer halten, sofern die Breite dann über 640 px liegt; sonst keiner
- Herkunft: Befundkarte #74 „Fehlermeldung des Aufgabenfensters auf schmalen Bildschirmen unsichtbar“ aus dem UX-Review von #11; ADR-0015 (`84a2651`); Ist-Notiz A00009 (2026-11-07). Die Abnahme-Idee der Karte steht wörtlich in 1, 3, 5, 8, 9 und M1/M2
- Nicht Umfang: #84 (lange Meldung auf dem Desktop abgeschnitten, `web/kd-app.css:367`), #85 (`fensterFehler` ohne offenes Fenster, `web/app.js:997–1001`)
- WBS: I0100 mit F0059 (1–4), F0060 (5–7), F0061 (8–10, M1, M2)
