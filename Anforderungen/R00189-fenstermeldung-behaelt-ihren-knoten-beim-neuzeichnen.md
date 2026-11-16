---
id: R00189
status: Neu
datum: 2026-11-16
---

# R00189: Die Fenstermeldung behält beim Neuzeichnen ihren Knoten

## Beschreibung

Herkunft: Karte #86 (aus #74; offene Frage in [ADR-0015](../Dokumentation/ADRs/0015-meldungen-und-aktionen-ueberstehen-jede-breite.md), Pre-Mortem und „Offene Fragen“). Die Meldung im Fuß des [Aufgabenfensters](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) ist ein `role="alert"`. Ein Vorleseprogramm sagt einen solchen Knoten an, wenn er ins Dokument kommt.

**Stufe 1 der Karte, Ergebnis am Code gelesen (2026-11-16):** Der Knoten wird bei jedem Neuzeichnen ersetzt. `render()` schreibt `#over` vollständig neu (`web/app.js:1181`), das Aufgabenfenster samt Fuß liegt darin (`vFenster`, `web/ansicht.js:370`: `<span class="fehl" id="fenster-meldung" role="alert">`). Jedes [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) — ein Agent ändert irgendeine andere Aufgabe — fügt also eine unveränderte Meldung als neuen Knoten ein; je nach Vorleseprogramm wird sie erneut oder gar nicht angesagt.

**Gewünscht:** Solange dieselbe Meldung im selben Aufgabenfenster steht, bleibt ihr Knoten über jedes Neuzeichnen derselbe. Eine neue Meldung — auch dieselbe Ablehnung ein zweites Mal — ist ein neuer Knoten und wird damit angesagt. Ort, Text und Feldverweis der Meldung ändern sich nicht.

Eine Zeichnung ist nicht nötig: nichts Sichtbares ändert sich. Zahlt ein auf: [Vision](R00000-vision.md) — Mensch und Agenten arbeiten gleichzeitig am selben Board, ohne dass die Arbeit der Agenten den Menschen stört.

## Akzeptanzkriterien

**Ausgangslage:** Aufgaben #1 und #2; Aufgabenfenster von #1 offen, in „Neue Herkunft“ `X1` eingegeben und mit Enter abgeschickt — im Fensterfuß steht die Meldung „„X1“ ist keine Herkunft“.

- [ ] **AK 1 Derselbe Knoten (Abnahme-Probe der Karte):** Ein Agent ändert über die API den Titel von #2, das Board hinter dem Fenster zeigt den neuen Titel → der Knoten der Fenstermeldung ist vor und nach dem Neuzeichnen **dasselbe Objekt** (geprüft über die Objektidentität, nicht über Text oder `id`); die Meldung steht weiter genau einmal als `alert` mit ihrem Text im Fensterfuß. Die Probe ist deterministisch (sie wartet auf den neuen Titel von #2, kein `test.skip`) und heute rot. Drei Änderungen hintereinander ergeben dasselbe.
- [ ] **AK 2 Feld und Eingabe bleiben:** Nach demselben Neuzeichnen steht `X1` weiter in „Neue Herkunft“, das Feld ist weiter ungültig und verweist auf die Meldung (`aria-describedby` trifft genau diesen Knoten), der Fokus steht im Feld.
- [ ] **AK 3 Neue Meldung, neuer Knoten:** `X1` ein zweites Mal abgeschickt (derselbe Text) → ein neuer Knoten; `abc` in „Zeit nachtragen“ abgeschickt (anderer Text) → ein neuer Knoten mit dem neuen Text. Meldung geräumt (Esc im Feld) → kein `alert` im Fenster. Fenster von #2 geöffnet → der Knoten aus #1 ist nicht darin.
- [ ] **AK 4 Bleibt:** Die bestehenden Proben zur Fenstermeldung laufen unverändert grün (`e2e/tests/r00155-*.spec.js`, `r00111-*.spec.js`, `r00147-warteschlange.spec.js`).

## Tests

E2E als Spec: AK 1 zuerst (heute rot). Der Knoten wird vor der Änderung im Browser festgehalten (`window.__meldung = document.getElementById('fenster-meldung')`), nach dem Neuzeichnen verglichen (`=== document.getElementById('fenster-meldung')` und `isConnected`); zusätzlich zählt ein `MutationObserver` auf `#over`, dass tatsächlich neu gezeichnet wurde — sonst prüft die Probe nichts.

## Implementierungshinweise

- **Entscheidung (ADR-0015, Nachtrag N3 — Wortlaut):** Der Knoten der Fenstermeldung wird beim Zeichnen wiederverwendet: `render()` hält ihn vor dem Ersetzen von `#over` fest und setzt ihn an die Stelle des frisch gezeichneten, solange dasselbe Aufgabenfenster offen ist und die Meldung seit ihrem Setzen nicht neu gesetzt wurde. Ein Knoten außerhalb der ersetzten Bereiche ist verworfen: er nähme die Rolle `alert` aus dem Fensterfuß, an den Regel und Proben von ADR-0015 sie binden (gezählt: 11 Dateien unter `e2e/tests/` suchen sie dort), und läge außerhalb des modalen Fensters. Ob ein wieder eingehängter Knoten in NVDA, VoiceOver und TalkBack schweigt, ist im Headless-Browser nicht prüfbar und bleibt ein Prüfpunkt der Abnahme.
- Vorschlag, keine Vorschrift: `fensterMelden` zählt jede gesetzte Meldung (`web/app.js:844`), der gezeichnete Knoten trägt die Zahl; gleiche Zahl und gleiche offene Aufgabe → alter Knoten ersetzt den neuen (`neu.replaceWith(alt)`), sonst bleibt der neue. Der Wächter „dasselbe Fenster“ steht schon in `render()` (`$('#over').dataset.offen`, `:1156`).
- **Probe vor dem Bau** (höchstens eine halbe Stunde, Hypothese — nicht gefahren): Über das DevTools-Protokoll (`Accessibility.getFullAXTree`) die Kennung des `alert` im Zugänglichkeitsbaum vor und nach dem Neuzeichnen vergleichen. Wechselt sie beim Aus- und Wiedereinhängen und bleibt sie mit `Element.moveBefore` (Knoten verlässt das Dokument nie), dann `moveBefore` nehmen, wo der Browser es kennt. Das Ergebnis steht im Bericht; ein Kriterium ist es nicht.
- **Schadensstelle:** Ein stehengebliebener alter Knoten darf nie eine fremde oder geräumte Meldung zeigen — maßgeblich bleibt `S.ui.fensterFehler` (ADR-0015, Datenhoheit).
- **Nicht hinein:** die übrigen `role="alert"` (Dialog „Neue Aufgabe“, Board-Fehler, Warnung im Hinweis, Dialoge) — sie werden ebenso neu eingefügt; ob sie nachziehen, entscheidet das Urteil am Vorleseprogramm. Das auf dem Zweig `karte/189` aufgeschobene Zeichnen während einer Datumseingabe berührt diese Anforderung nicht.
- **Abnahmezettel:** Prüfpunkt „Mit Vorleseprogramm: Die Meldung wird einmal angesagt und nicht erneut, wenn ein Agent eine andere Aufgabe ändert“ — dein Urteil, kein Gate.

## Warum löst diese Anforderung das Problem?

Auslöser: Ein Mensch mit Vorleseprogramm hat eine abgelehnte Eingabe vor sich, während Agenten im Minutentakt Karten ändern. Bleibt der Knoten der Meldung derselbe (X), kommt mit dem Live-Ereignis kein neuer `alert` ins Dokument (Y); die Meldung wird einmal angesagt, wenn sie entsteht, und nicht bei jeder fremden Änderung wieder (Z).

## Offene Fragen

- Schweigt ein wieder eingehängter Knoten im Vorleseprogramm wirklich? Nur am Gerät prüfbar (Abnahmezettel). Wird weiter wiederholt angesagt, ist der nächste Schritt ein eigener Ansage-Knoten außerhalb der ersetzten Bereiche — eigene Karte, weil er die Rolle aus dem Fensterfuß nimmt.
