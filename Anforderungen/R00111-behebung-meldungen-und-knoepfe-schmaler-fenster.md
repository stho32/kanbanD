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

Reproduktion (architekt, isolierte Probe mit den echten Stilen auf kanbanD `6636db3`, ADR-0015 „Erprobt durch“): Bei 414 und 640 px haben die Meldung des Aufgabenfensters, die Meldung von „Neue Aufgabe“ und der Knopf „Anlegen“ 0 Client-Rects und keinen Eintrag im Accessibility-Snapshot; ab 641 px sind sie sichtbar. Die UX-Vorprüfung (2026-11-07, Bildschirmfotos bei 641, 768 und 844 × 390 px) fand zusätzlich: Zwischen 641 und etwa 895 px hat „Anlegen“ in „Neue Aufgabe“ keine Client-Rects, „Anlegen und weitere“ ist angeschnitten — `.mod-fuss` schneidet mit `overflow:hidden` ab, deshalb merkt eine Probe auf Querscrollen das nicht. Betroffen sind das quer gehaltene Handy und das Tablet im Hochformat, also Touch.

Der Fehler besteht seit R00077 (Responsive für Tablet und Handy). R00077 sagt zu: „dieselbe Seite, kein zweiter Modus“, und das Aufgabenfenster den Bildschirm füllt; die Meldungen und Knöpfe des Fußes sind dabei verloren gegangen.

Zahlt ein auf: [Vision](R00000-vision.md) — Leitplanke „Weboberfläche, im LAN erreichbar“: Der Browser auf dem Handy im LAN ist ein vollwertiger Zugang, kein Lesemodus. Eine Oberfläche, die eine abgelehnte Eingabe verschweigt, lässt den Menschen raten, ob seine Änderung in der Datei steht — und die Datei ist der einzige Speicher.

Die technische Entscheidung steht in [ADR-0015](../Dokumentation/ADRs/0015-meldungen-und-aktionen-ueberstehen-jede-breite.md) (Option A); diese Anforderung macht sie prüfbar.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — Bestandteil „Fuß: Speicherhinweis […] und Fehlermeldung“
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
- `web/kd-app.css:367` — `.mod-fuss` mit `white-space:nowrap; overflow:hidden` (schneidet eine lange Meldung und, zwischen 641 und etwa 895 px, die Knöpfe von „Neue Aufgabe“ ab)
- `web/kd-app.css:243`, `:820` — `.mod-bg` ist `position:fixed` bis `bottom:0`, bis 1024 px füllt `.mod` die volle Höhe; `web/index.html:5` setzt kein `interactive-widget`, und kein Code liest `visualViewport` (Meldung hinter der Bildschirmtastatur, AK 11)
- `web/ansicht.js:187`, `:256` — Markup der Füße (Tastenhinweise ohne Markierung)
- `e2e/tests/r00077-responsive.spec.js` — Probe ohne Meldungen und Knöpfe

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0015 Option A:

1. **Der Fuß bleibt in jeder Breite.** Bis 640 px fallen nur die Tastenhinweise weg, einzeln. Sie tragen dafür eine Hinweis-Klasse im Markup (`web/ansicht.js:187`, `:256`); die schmale Regel blendet `.mod-fuss .<hinweis>` aus statt `.mod-fuss`. Den Klassennamen wählt der Bau, nicht `.leer` (vergeben).
2. **Der Fuß bricht um, statt abzuschneiden**: Umbruch der Zeile, die Meldung mit normalem Zeilenumbruch in einer eigenen Zeile; die Knopfgruppe von „Neue Aufgabe“ bricht als Ganzes um, die Knöpfe behalten `--kd-ziel` (ADR-0012). Ist die Gruppe breiter als die Zeile (bei 320 px ist sie 301 px breit, die Zeile innen 288 px, gemessen in der UX-Vorprüfung), brechen die Knöpfe innerhalb der Gruppe um; „Anlegen“ bleibt der letzte Knopf.
3. **Die Meldung nimmt keinen Fokus** (ADR-0010). Der Fokus kehrt über `u.fokus` ins Feld der Eingabe zurück (heute schon so: `web/app.js:1210` für die Herkunft, `:406` für den Titel), angesagt wird über `role="alert"`.
4. **Der Fuß bricht um, sobald sein Inhalt nicht in eine Zeile passt**; einzeilig bleibt er nur, wo alles hineinpasst (heute ab etwa 896 px). Das weicht von ADR-0015 Regel 5 („Ab 641 px ändert sich nichts“) ab; der Nachtrag zur ADR ist beim architekt offen (Offene Fragen).
5. **Die Meldung bleibt über der Bildschirmtastatur.** Der Fokus bleibt im Feld (3), also bleibt die Tastatur offen; das Fenster reicht heute bis zur Unterkante der Seite, nicht des sichtbaren Bereichs. iOS Safari und Chrome ab 108 verkleinern bei eingeblendeter Tastatur nur den sichtbaren Bereich (`visualViewport`), die Meldung liegt dann wahrscheinlich unter der Tastatur (begründet, nicht gemessen). Das Fenster folgt deshalb dem sichtbaren Bereich. Wie (Höhe an `visualViewport` binden, oder `interactive-widget=resizes-content` im Viewport-Meta, das nur Chromium und Firefox kennen), entscheidet der architekt (Offene Fragen).
6. **Das Feld verweist auf seine Meldung.** Solange eine Meldung zu einer Eingabe steht, trägt das Feld `aria-invalid="true"` und `aria-describedby` auf die Meldung; beides fällt weg, sobald eine Eingabe angenommen wird.

`S.ui.fensterFehler` bzw. `f.fehler` bleibt die einzige Quelle der Meldung; es gibt keine zweite gezeichnete Kopie (zwei `role="alert"` würden doppelt angesagt).

### Alternative Ansätze

- **Meldungszeile oben im Fenster** (ADR-0015 Option B): ändert den Desktop gegen R00077 und löst die Knöpfe von „Neue Aufgabe“ nicht.
- **Meldung am Feld** (ADR-0015 Option C): bessere Nähe zur Eingabe, aber ein Meldungsort je Feld statt je Fenster und keine Antwort auf die fehlenden Knöpfe.
- **Nur den Fuß schmal wieder einblenden, ohne Umbruch**: kleinste Änderung, aber bei 320 px würden Meldung oder Knöpfe abgeschnitten (`overflow:hidden`) oder die Seite scrollte quer (verboten, PO Z. 98, 105).

## Test-Strategie

- **Unit**: entfällt mit Grund. Es gibt keine reine Logik, nur CSS und Markup (ADR-0015, Durchsetzung). Ein Wächter auf den CSS-Text wäre schwächer als die E2E-Probe, die das Gezeichnete misst; die Mutanten decken die Regel.
- **Integration**: entfällt mit Grund. Server und API ändern sich nicht; die Meldungstexte kommen unverändert vom Server bzw. aus `web/app.js`.
- **E2E** (Playwright, neue Datei `e2e/tests/r00111-meldungen-schmal.spec.js` neben `r00077-responsive.spec.js`, Treiber `e2e/tests/hilfen.js`: `kanbanStarten`, `alsPerson`): zwei Geräteprofile — **schmal** 414 × 896 px mit `isMobile` und `hasTouch`, **breit** 1280 × 800 px mit feinem Zeiger; für Querscrollen und abgeschnittene Knöpfe zusätzlich 320 und 375 px sowie die Zwischenbreiten 641 × 896, **Tablet** 768 × 1024 und **Handy quer** 844 × 390 px, alle mit Touch.
- **Bildschirmtastatur (AK 11)**: Ein Viewport von 414 × 500 px bildet die Tastatur nicht ehrlich nach. Er verkleinert den Layout-Viewport, ein `position:fixed`-Fenster rückt mit nach oben, und der Test wäre ohne Fix grün — das ist das Verhalten von `resizes-content`, nicht das von iOS Safari und Chrome ab 108. Nachgebildet wird deshalb nur der sichtbare Bereich: Layout bleibt 414 × 896 px, ein Init-Skript gibt `visualViewport.height` 500 und `offsetTop` 0 vor und löst `resize` auf `visualViewport` aus (gelesen, nicht erprobt; der Bau prüft das in B0454 als ersten Schritt). Das ist eine Nachbildung der Schnittstelle, nicht der Tastatur; die Tastatur selbst prüft eine Zeile auf dem Abnahmezettel am echten Handy. Wählt der architekt nur `interactive-widget`, kann die E2E-Probe den Fix nicht zeigen (das Meta wirkt nur mit echter Tastatur); dann prüft der Test nur noch, dass Meldung und Feld in einen Layout-Viewport von 414 × 500 px passen, und der Nachweis liegt allein auf dem Zettel.

### Unit Test zur Bug-Reproduktion

Der Fehler entsteht nur aus dem gezeichneten Layout im Browser; die Reproduktion ist deshalb der **E2E-Fall US-1** („abgelehnte Herkunft X1 wird bei 414 px als alert gemeldet, Fokus bleibt im Feld“). Er steht vor der ersten Bubble als erwartet roter Test (`test.fail` mit Verweis auf #74) und wird beim Bau ohne Umdeutung grün.

Geprüft wird ohne feste Pause: auf die Meldung warten (`expect(locator).toHaveCount(1)` auf `[role=alert]` im Fenster), dann `getClientRects().length > 0`, `ariaSnapshot()` des Fensters enthält `alert` mit dem Meldungstext, `document.activeElement.id === 'herkunft-neu'`.

### Code-Extraktion für isoliertes Testing

Entfällt — keine Logik zu extrahieren.

### Regressionstests

- `e2e/tests/r00077-responsive.spec.js` (Handy, Tablet, Desktop), `ziele.spec.js` (R00108, Zielgrößen bei Touch ≥ 44 px), `r00036-neue-aufgabe.spec.js`, `r00018-herkunft.spec.js`, `r00106-fokus-raster.spec.js` (Fokus in Fenstern) und `kontrast.spec.js` bleiben grün.
- Alle Ebenen: `cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`.

## Akzeptanzkriterien

Ausgangslage jeder Prüfung: Board `entwicklung` mit den Spalten „Zu erledigen“, „In Arbeit“, „Erledigt“; Aufgabe #1 „Abnahme prüfen“ ohne Herkunft in „Zu erledigen“; Person `st` (Mensch) im Browser. „Schmal“ heißt 414 × 896 px mit Touch, „breit“ heißt 1280 × 800 px mit feinem Zeiger. „Zwischenbreiten“ heißt 641 × 896, 768 × 1024 (Tablet) und 844 × 390 px (Handy quer), alle mit Touch. „Sichtbar“ heißt: Das Element hat Client-Rects (`getClientRects().length > 0`) und liegt ganz im Fenster, und kein Vorfahr mit `overflow` außer `visible` schneidet es ab (sein Rechteck liegt ganz im Rechteck jedes solchen Vorfahren).

### Bug behoben (Pflicht)
- [ ] Der Reproduktionstest US-1 ist ohne Fix rot und mit Fix grün (E2E)
- [ ] Der ursprüngliche Fehler tritt in den Szenarien der User Story (US-1 bis US-9) nicht mehr auf (E2E)
- [ ] Keine neuen Fehler: alle Tests aller Ebenen grün (`cargo test` · `node --test e2e/einheit/` · `cd e2e && npx playwright test`)

### Aufgabenfenster (E2E)
- [ ] **1 — Abgelehnte Herkunft schmal gemeldet (Karte #74).** Gegeben schmal, das Aufgabenfenster von #1 ist offen; wenn `st` im Feld „Neue Herkunft“ „X1“ eingibt und auf der Bildschirmtastatur die Eingabetaste tippt, dann ist eine Meldung sichtbar, die mit „„X1“ ist keine Herkunft“ beginnt, sie steht im Accessibility-Snapshot des Fensters als `alert`, der Fokus steht im Feld „Neue Herkunft“ mit dem Wert „X1“, das Feld trägt `aria-invalid="true"` und `aria-describedby` mit der id der Meldung, und die Datei von #1 enthält keine Herkunft „X1“ — heute 0 Client-Rects und kein `alert` im Snapshot. Wenn `st` danach „I0001“ eingibt und die Eingabetaste tippt, trägt das Feld weder `aria-invalid` noch `aria-describedby` auf die Meldung
- [ ] **2 — „gespeichert“ schmal sichtbar.** Gegeben schmal, das Aufgabenfenster von #1 ist offen; wenn `st` den Titel in „Abnahme prüfen lassen“ ändert und das Feld verlässt, dann ist „gespeichert HH:MM:SS“ mit der Uhrzeit der Änderung sichtbar, und die Datei von #1 trägt den neuen Titel
- [ ] **3 — Breit unverändert.** Gegeben breit, derselbe Ablauf wie in 1; dann ist die Meldung sichtbar und als `alert` im Snapshot, der Fokus steht im Feld, und der Fuß ist genauso hoch wie vor dem Fix und einzeilig (Vergleichswert vor dem Fix im Test gemessen; nach `web/kd-app.css:367` 28 px, gelesen, nicht gemessen); die Tastenhinweise „Esc schließen · ↑↓ Karte wechseln“ sind sichtbar
- [ ] **4 — Lange Meldung bricht schmal um, nichts scrollt quer.** Gegeben das Aufgabenfenster von #1 bei 320, 375 und 414 px mit Touch und die Meldung aus 1; dann ist die Meldung ganz lesbar (nicht abgeschnitten: ihre `scrollWidth` ≤ `clientWidth`), und weder die Seite noch das Fenster scrollt waagrecht (`scrollWidth` ≤ `clientWidth` an Dokument und Fenster; bei 320 px ist die Seite höchstens 320 px breit, 321 px fällt durch); die Tastenhinweise sind schmal nicht sichtbar

### „Neue Aufgabe“ (E2E)
- [ ] **5 — Leerer Titel schmal gemeldet.** Gegeben schmal, „Neue Aufgabe“ ist offen, der Titel ist leer; wenn `st` auf „Anlegen“ tippt, dann ist die Meldung „Die Aufgabe braucht einen Titel“ sichtbar und als `alert` im Snapshot, der Fokus steht im Titel, der Titel trägt `aria-invalid="true"` und `aria-describedby` mit der id der Meldung, und die Board-Datei enthält keine neue Aufgabe; nach Eingabe von „Handy-Aufgabe“ und Tipp auf „Anlegen“ trägt der Titel beides nicht mehr
- [ ] **6 — Die drei Knöpfe schmal bedienbar.** Gegeben schmal, „Neue Aufgabe“ ist offen: „Abbrechen“, „Anlegen und weitere“ und „Anlegen“ sind sichtbar; Titel „Handy-Aufgabe“ + Tipp auf „Anlegen“ legt die Aufgabe in „Zu erledigen“ an und schließt das Fenster; Titel „Zweite“ + Tipp auf „Anlegen und weitere“ legt sie an und lässt das Fenster mit leerem Titel offen; ein Tipp auf „Abbrechen“ schließt das Fenster ohne neue Aufgabe
- [ ] **7 — Kein Knopf abgeschnitten, kein Querscrollen.** Gegeben „Neue Aufgabe“ mit der Meldung aus 5 bei 320, 375 und 414 px und bei den Zwischenbreiten, alle mit Touch; dann ist jeder der drei Knöpfe sichtbar (ganz im Fenster, nicht durch `overflow` verdeckt) und mindestens 44 × 44 px groß, auch bei 320 px, „Anlegen“ ist der letzte der drei Knöpfe, und weder die Seite noch das Fenster scrollt waagrecht — heute fehlt „Anlegen“ bei 641, 768 und 844 × 390 px (0 Client-Rects, UX-Vorprüfung)

### Schmal so bedienbar wie breit (E2E, Fitness-Funktion ADR-0015)
Zusätzlich gegeben: #2 „Kosten prüfen“ mit Preisetikett, #3 „Altlast“ archiviert, #4 eine defekte Aufgabendatei. Fensterliste: Aufgabenfenster #1 mit den Reitern „Inhalt“ und „Datei“, Aufgabenfenster #2 mit Reiter „Kosten“, Aufgabenfenster #3 (archiviert), „Neue Aufgabe“ mit der Meldung aus 5, Defekte Datei #4.
- [ ] **8 — Bedienelemente.** Je Fenster der Liste ist bei schmal und bei den Zwischenbreiten jedes Bedienelement sichtbar, das bei breit im selben Fenster sichtbar ist (Knöpfe, Links, Felder, Auswahllisten, Reiter, Kästchen); ausgenommen ist nur die Liste `AUSNAHMEN`, heute genau ein Eintrag: „In VS Code öffnen“ (`#vsc`, „↗“ im Kopf des Aufgabenfensters), Grund: Er öffnet die Datei, deren Pfad (`.mod-kopf .pfad`) schmal ebenfalls fehlt (R00077). Die übrigen `vscode://`-Links — Herkunft-Chips (`web/ansicht.js:383`, `:393`) und „Im Editor reparieren“ im Kopf der defekten Datei (`:520`) — bleiben schmal sichtbar und sind keine Ausnahme
- [ ] **9 — Meldungsträger.** Je Fenster der Liste hat bei schmal und bei den Zwischenbreiten jedes gezeichnete Element mit `role="alert"`, `role="status"` oder `aria-live` Client-Rects
- [ ] **10 — Die Ausnahmeliste ist ehrlich.** Jeder Eintrag in `AUSNAHMEN` nennt Selektor, Fenster und Grund; die Probe schlägt Alarm, wenn das ausgenommene Element bei breit fehlt oder bei schmal sichtbar wird (dann ist der Eintrag zu streichen)

### Bildschirmtastatur (E2E und Abnahmezettel)
- [ ] **11 — Meldung über der Bildschirmtastatur.** Gegeben schmal mit eingeblendeter Bildschirmtastatur (sichtbarer Bereich 414 × 500 px, nachgebildet wie unter Test-Strategie beschrieben); wenn „X1“ wie in 1 abgelehnt wird oder „Anlegen“ wie in 5 mit leerem Titel getippt wird, dann liegen die Meldung und das Feld mit dem Fokus ganz im sichtbaren Bereich (Unterkante ≤ `visualViewport.offsetTop + visualViewport.height`) — ohne Fix erwartet rot. Zusätzlich eine Zeile auf dem Abnahmezettel: Am echten Handy (iOS Safari und Android Chrome) ist die Meldung mit offener Tastatur zu lesen, ohne die Tastatur zu schließen

### Mutanten (E2E, Abnahme-Probe)
Je Mutant wird die ausgelieferte Datei per `page.route` ersetzt (`**/kd-app.css` bzw. `**/ansicht.js`); greift der Ersatz nicht, wirft die Route. Der Mutant wird nie ins Repository geschrieben.
- [ ] **M1** — `.mod-fuss` steht wieder in der Regel bis 640 px (`display:none`): US-1, US-4 und die Probe 8/9 werden rot
- [ ] **M2** — die Hinweis-Klasse sitzt an der Meldung statt am Tastenhinweis: US-1 und die Probe 9 werden rot
- [ ] Das Ergebnis jeder Mutantenprobe (Fall, Mutante, rot ja/nein) steht im Bericht des Baus

## Implementierungshinweise

- Hinweis sind nur die Tastenhinweise: in `:256` die Spanne `Esc schließen · ↑↓ Karte wechseln`, in `:187` die Spanne mit `Enter im Titel …` (sie steht dort nur, wenn keine Meldung da ist). „gespeichert“ (`.gs`) und der Erklärsatz des Defektfensters (`:520`) sind Inhalt und bleiben schmal sichtbar.
- Die Knopfgruppe in `:187` trägt heute ein Inline-`style` (`margin-left:auto;display:flex;gap:6px`); ob sie für den Umbruch eine Klasse bekommt, entscheidet der Bau.
- `.mod-kopf .nav`, `.mod-kopf .cls` und `.mod-kopf .pfad` bleiben schmal ausgeblendet; sie sind weder Bedienelement noch Meldung und brauchen keinen Eintrag in `AUSNAHMEN` (ADR-0015, Durchsetzung). Auch `.leg .rechts` und `.stat>.mono` außerhalb der Fenster tragen nur Hinweise und bleiben, wie sie sind.
- Muster der Ausnahmeliste: `NICHT_GEMESSEN` in `e2e/tests/ziele.spec.js` (ADR-0012 Regel 6); die Fensterliste gehört neben `e2e/tests/ansichten.js`, nicht als zweite Kopie der Fixtures.
- Preisetikett als Fixture wie `e2e/tests/r00105-preisetikett.spec.js:107`, defekte Datei wie `r00025-defekt.spec.js`.
- Die Touch-Zielgröße kommt aus `--kd-ziel` (48 px bei Touch); keine eigene Pixelzahl im Fuß (ADR-0012 Regel 1). Bei 320 px gilt die Ausweichregel aus PO-Entscheidung Z. 130, nicht kleinere Knöpfe.
- Die Meldung braucht für `aria-describedby` eine id; sie wird bei jedem `render()` neu gezeichnet, die id bleibt gleich.
- Im Test die typografischen Anführungszeichen U+201E „ und U+201C “ verwenden und im `ariaSnapshot` auf einen Teilstring prüfen (der Servertext endet auf „… oder thin air“).

## Offene Fragen

Entschieden (product-owner, `AI-Team/po-entscheidungen.md` Z. 152–153):

- **Wiederansage durch Bildschirmleser — entschieden, nicht in dieser Anforderung.** Ob eine `role="alert"`-Meldung, die `render()` bei jedem Neuzeichnen per `innerHTML` neu einfügt, wiederholt angesagt wird, prüft eine eigene Karte (#86, Backlog) mit einer Probe, die ein Agent fahren kann (Z. 152).
- **Gestaltung vor dem Bau — entschieden: kein neues Artboard, kein Warten.** Auflage: Bildschirmfotos auf dem Abnahmezettel; die Elemente stehen in der Reihenfolge des Desktops, die Meldung in eigener Zeile, kein neues Element, keine neue Farbe, kein neuer Text (Z. 153). Die UX-Vorprüfung erweitert die Fotos (siehe Abnahmezettel).

Offen beim architekt (Technik, keine Frage an den Auftraggeber):

- **Wie folgt das Fenster dem sichtbaren Bereich (Lösung 5, AK 11)?** Höhe an `visualViewport` binden (deckt iOS ab, per E2E nachbildbar) oder `interactive-widget=resizes-content` (nur Chromium und Firefox, per E2E nicht nachbildbar); Material 3 sieht für kompakte Breiten ein Vollbild-Fenster mit Bestätigung oben vor. Empfehlung planer: `visualViewport`, weil nur sie iOS abdeckt und AK 11 sie ehrlich prüfen kann. Braucht ADR-0015 dazu einen Nachtrag?
- **Nachtrag ADR-0015 Regel 5:** Lösung 4 (Umbruch nach Bedarf in jeder Breite) ersetzt „Ab 641 px ändert sich nichts“.

## Abnahmezettel

Bildschirmfotos (Auflage PO Z. 153, erweitert durch die UX-Vorprüfung): bei 320, 414, 768 × 1024 und 844 × 390 px je das Aufgabenfenster von #1 mit der Meldung „„X1“ ist keine Herkunft …“ und „Neue Aufgabe“ mit „Die Aufgabe braucht einen Titel“ und den drei Knöpfen; dazu ein Foto am echten Handy mit offener Bildschirmtastatur (AK 11).

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist, dass die schmale Regel den ganzen Fuß ausblendet statt der Tastenhinweise darin. Werden nur die markierten Hinweise ausgeblendet, sind Meldung, „gespeichert“ und die Knöpfe von „Neue Aufgabe“ auf dem Handy wieder gezeichnet und im Accessibility-Baum (1, 2, 5, 6). Weil der Fuß umbricht, sobald sein Inhalt nicht passt, wird in keiner Breite etwas abgeschnitten und nichts scrollt quer (4, 7). Weil das Fenster dem sichtbaren Bereich folgt, verdeckt die Bildschirmtastatur die Meldung nicht (11), und das Feld verweist für den Bildschirmleser auf seine Meldung (1, 5). Die Probe „schmal so bedienbar wie breit“ über alle Fenster und die Zwischenbreiten samt Mutanten verhindert, dass eine künftige Breitenregel wieder einen Container mit Meldung oder Aktion ausblendet (8–10, M1, M2) — das schließt die Klasse des Fehlers, nicht nur die Stelle.

## Notizen

- Priorität: Hoch (Klasse Vorrang) — eine abgelehnte Eingabe wird auf dem Handy verschwiegen; „Neue Aufgabe“ ist dort nur halb bedienbar
- Betroffene Nutzer/Systeme: jeder Mensch, der kanbanD auf einem Bildschirm bis 640 px Breite bedient; für die Knöpfe von „Neue Aufgabe“ bis etwa 895 px (Handy quer, Tablet hoch)
- Workaround: keiner. Quer gehalten (über 640 px) erscheint zwar die Meldung, aber „Anlegen“ fehlt bis etwa 895 px
- Herkunft: Befundkarte #74 „Fehlermeldung des Aufgabenfensters auf schmalen Bildschirmen unsichtbar“ aus dem UX-Review von #11; ADR-0015 (`84a2651`); Ist-Notiz A00009 (2026-11-07). Die Abnahme-Idee der Karte steht wörtlich in 1, 3, 5, 8, 9 und M1/M2
- #84 (lange Meldung auf dem Desktop abgeschnitten, `web/kd-app.css:367`) wird durch Lösung 4 sachlich mit erledigt: Die Meldung bricht in jeder Breite um, statt abgeschnitten zu werden. Ein eigenes Akzeptanzkriterium für 1280 px mit langer Meldung hat diese Anforderung nicht; ob #84 damit geschlossen wird, entscheidet der Director
- Nicht Umfang: #85 (`fensterFehler` ohne offenes Fenster, `web/app.js:997–1001`)
- WBS: I0100 mit F0059 (1–4), F0060 (5–7), F0061 (8–10, M1, M2), F0062 (11)
- Eingearbeitet am 2026-11-07: PO-Entscheidungen Z. 152–153, UX-Vorprüfung (befund: Tastatur, Zwischenbreiten, `aria-invalid`, Ausnahme `#vsc`), Text-Vorprüfung
