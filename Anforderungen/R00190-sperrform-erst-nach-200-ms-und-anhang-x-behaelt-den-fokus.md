---
id: R00190
status: Neu
datum: 2026-11-16
---

# R00190: Sperrform erst nach 200 ms sichtbar, das ✕ eines Anhangs behält beim Lesen den Fokus

## Beschreibung

Herkunft: Karte #151 (Härtung aus #138, [R00148](R00148-behebung-laufende-aktion-nimmt-keinen-zweiten-ausloeser-an.md)). Am heutigen Code geprüft (2026-11-16), zwei Punkte der Karte bestehen:

1. **Die Sperrform erscheint sofort.** `sperrenMarkieren` setzt `aria-disabled="true"` im selben Augenblick, in dem der Auslöser angenommen wird (`web/app.js:1734`, Aufruf `:1761`); die Dämpfung hängt ohne Verzögerung an diesem Attribut (`web/kd-app.css:14–25`). Bei jeder schnellen Antwort blitzt der Auslöser also für einen Augenblick grau auf. Am Code gelesen, am laufenden Programm nicht gemessen.
2. **Das ✕ eines Anhangs verliert beim Lesen den Fokus.** Während der Inhalt für „Rückgängig“ gelesen wird, zeichnet es sich mit nativem `disabled aria-busy="true"` (`web/ansicht.js:454`, Zustand `S.ui.anhangLiest`, `web/app.js:2248`). Ein natives `disabled` nimmt den Knopf aus der Tabreihenfolge, der Fokus fällt heraus — genau das, was R00148 AK 20 und ADR-0025 Regel 2 für alle anderen Auslöser ausschließen.

**Gewünscht:** Die sichtbare Sperrform erscheint erst, wenn die Anfrage länger als 200 ms läuft; die Sperre selbst wirkt weiter sofort. Das ✕ eines Anhangs zeigt beim Lesen dieselbe Sperrform wie jeder andere Auslöser und behält den Fokus.

**Fällt weg:** `aria-busy` an der Sperrform. Es gehört nur an eine sichtbare Warte-Anzeige (R00148 AK 19, Projektlehre #138); die gibt es nicht, und eine neue zu zeichnen ist nicht Teil dieser Karte. Am ✕ des Anhangs entfällt es mit dem nativen `disabled`.

Eine Zeichnung ist nicht nötig: die am 2026-11-14 freigegebene Form bleibt, nur ihr Zeitpunkt ändert sich. Zahlt ein auf: [Vision](R00000-vision.md) — das Board bleibt beim Arbeiten ruhig und mit der Tastatur bedienbar.

## Akzeptanzkriterien

**Ausgangslage:** Aufgabe #1 mit den Anhängen `plan.pdf` und `notiz.txt`, Person `st` gewählt. Die Antwort des Servers wird in der Probe gehalten. Gemessen wird ab dem Auslösen (Klick oder Taste); die Schwelle ist 200 ms, geprüft wird mit Abstand bei 100 ms und bei 400 ms.

- [ ] **AK 1 Schnelle Antwort, kein Aufblitzen:** Ein Schreib-Auslöser (Beispiel: Knopf „Anlegen“ im Dialog „Neue Aufgabe“), dessen Antwort nach 100 ms kommt → der Auslöser zeigt bis zur Antwort durchgehend seine Ruheform (Schrift, Kontur und Fläche unverändert). Die Sperre wirkt trotzdem sofort: ein zweiter Klick innerhalb der 100 ms stellt keine zweite Anfrage. Heute rot: die Dämpfung steht sofort.
- [ ] **AK 2 Lange Antwort, Sperrform wie freigegeben:** Derselbe Auslöser, Antwort 1 s gehalten → nach 100 ms noch Ruheform, spätestens nach 400 ms die gedämpfte Form aus R00148 AK 19, unverändert bis zur Antwort; mit der Antwort steht sofort wieder die Ruheform. Gilt für jede Auslöserfamilie aus R00148 AK 19 (Knopf, Symbolknopf, Kästchen, Kartenleiste).
- [ ] **AK 3 Das ✕ eines Anhangs behält den Fokus:** ✕ von `plan.pdf` mit Enter ausgelöst, das Lesen des Inhalts 1 s gehalten → der Fokus steht während des Lesens auf diesem ✕; es trägt `aria-disabled="true"`, kein natives `disabled` und kein `aria-busy`; ein zweites Enter löst kein zweites Lesen und kein zweites Löschen aus. Nach dem Lesen wie heute: der Anhang ist entfernt, der Hinweis mit „Rückgängig“ steht, der Fokus steht auf dem ✕ von `notiz.txt`. Scheitert das Lesen, steht die Meldung „Anhang „plan.pdf“ nicht entfernt: …“ im Fensterfuß und der Fokus auf dem ✕ von `plan.pdf`. Heute rot: der Fokus fällt während des Lesens heraus.
- [ ] **AK 4 Bleibt:** Die bestehenden Proben laufen unverändert grün (`e2e/tests/r00148-zweiter-ausloeser.spec.js`, `r00112-rueckgaengig.spec.js`).

## Tests

E2E als Spec mit gehaltener Antwort (`page.route`, Vorbild `r00148-zweiter-ausloeser.spec.js` und `r00112-rueckgaengig.spec.js:793–803`): AK 3 und AK 1 zuerst (heute rot). Zeitgrenzen am dauerhaften Merkmal festmachen, nicht an der Wanduhr der Probe: liegt die Verzögerung im Stil (`transition-delay`), prüft die Probe den gerechneten Wert 200 ms am gesperrten Auslöser und die Farbe nach der gehaltenen Antwort — ein Lesezeitpunkt „bei 100 ms“ verrutscht unter Last.

## Implementierungshinweise

- Vorschlag, keine Vorschrift: die Dämpfung an `[aria-disabled="true"]` mit `transition` ohne Dauer und 200 ms Verzögerung (`color`, `border-color`, `background-color`); die Ruheform trägt keine Verzögerung, also endet die Sperrform sofort. `aria-disabled` selbst bleibt sofort gesetzt — die Sperre und ihre Aussage für Hilfstechnik hängen nicht am Zeitpunkt der Farbe.
- Anhang-✕: ` disabled aria-busy="true"` aus `vAnhaenge` (`web/ansicht.js:454`) entfernen; die Sperre des Auslösers trägt `act` schon (`ausloeserGesperrt`, `web/app.js:1725`), `sperrenMarkieren` markiert das ✕. Prüfen, ob `S.ui.anhangLiest` und das `render()` davor (`web/app.js:2248–2249`) dann noch etwas tragen — ein Zeichnen an dieser Stelle verbraucht das Fokusziel (R00112 FA 8).
- `r00112-rueckgaengig.spec.js:799` prüft `toBeDisabled()`; Playwright wertet dafür auch `aria-disabled="true"`, die Probe bleibt also gültig.
- **Schadensstelle:** Die Verzögerung gilt nur der sichtbaren Form. Ein zweiter Auslöser innerhalb der ersten 200 ms darf nie durchgehen (R00148 AK 1–12).
- **Nicht hinein:** eine Warte-Anzeige (Drehsymbol, Fortschritt) · `aria-busy` · andere native `disabled` (gesperrte Personen im Zuweisen-Dialog, Achsen im Bericht — dort ist nichts unterwegs, das Feld ist nicht wählbar).

## Warum löst diese Anforderung das Problem?

Auslöser: Wer eine Teilaufgabe abhakt oder einen Anhang entfernt, sieht bei jeder schnellen Antwort ein kurzes Grau am gerade bedienten Element; wer das ✕ mit der Tastatur auslöst, steht während des Lesens ohne Fokus da. Erscheint die Sperrform erst nach 200 ms (X), bleibt das Element bei schnellen Antworten ruhig und zeigt nur bei wirklich laufender Anfrage, dass es wartet (Y). Trägt das ✕ dieselbe Sperrform statt `disabled` (X), bleibt der Fokus, wo die Hand ist, und die Tastatur arbeitet nach dem Lesen an derselben Stelle weiter (Z).

## Offene Fragen

Keine.
