---
id: R00162
status: Neu
datum: 2026-11-15
---

# R00162: Beschreibung im Aufgabenfenster über das Stift-Symbol bearbeiten

## Beschreibung

Auftrag des Betreibers (2026-11-14, Karte #161), wörtlich:

> „Im Karten-Detail wenn man eine Kanban-Aufgabe öffnet sieht man die R/O Ansicht der Beschreibung der Aufgabe. Bisher ist es so, dass man bei ‚einem klick‘ in den bereich bereits den Bearbeiten-Modus aktiviert. Dadurch kann man schlecht Inhalte kopieren. Wunschverhalten: Es gibt ein kleines Stift-Icon oben rechts am Rand innerhalb der Anzeige des Details, dass halbtransparent sichtbar wird wenn man mit der Maus über den Inhalt hovert. Man kann dann mit der Maus auf das Icon gehen und klicken um den Bearbeiten Modus zu aktivieren. Ansonsten verhält sich das Feld R/O, d.h. man kann den HTML Formatierten Inhalt auswählen und normal kopieren.“

Ein Klick in die Beschreibung öffnet kein Textfeld mehr; die Lesefläche ist reiner Text, der sich auswählen und kopieren lässt. Bearbeiten beginnt über einen Stift-Knopf auf der Zeile der Überschrift „BESCHREIBUNG“ oder wie bisher über das Kürzel `b`. Damit ist der Einstieg „Klick (oder Enter auf dem Bereich) → Textfeld“ aus [R00030](R00030-beschreibung-als-markdown-lesen.md) aufgehoben.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“ (Markdown bleibt Markdown, kanbanD zeigt es lesbar — und lesbar heißt auch kopierbar). Begriff: [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md).

## Entscheidungen des product-owner (2026-11-14)

- **a) Touch und Tastatur:** Der Stift ist ein echter Symbol-Knopf in der Tab-Folge; bei Hover der Beschreibung halbtransparent, voll beim Zeigen auf den Stift und bei Tastatur-Fokus, auf Touch dauerhaft halbtransparent, sonst unsichtbar und nicht anklickbar; Zielgröße nach ADR-0012; der Fokus kehrt nach dem Bearbeiten an den Stift zurück.
- **b) Leere Beschreibung:** wie heute direkt das Textfeld, kein Stift.
- **c) Andere Bereiche:** nur die Beschreibung; Titel und Teilaufgaben behalten ihren Klick, Kommentare sind nicht bearbeitbar.
- **d) Verweise:** bleiben klickbar; die Lesefläche trägt weder Rolle noch `data-act` noch `tabindex`.
- **e) Doppelklick:** markiert ein Wort und öffnet nicht das Bearbeiten.
- **f) Gestaltung:** Der Stift sitzt oben rechts auf der Zeile der Überschrift „BESCHREIBUNG“ (nicht über dem Text, damit er keinen Inhalt verdeckt); `title` „Beschreibung bearbeiten (b)“. Die Zeichnung liegt am Artboard `Dokumentation/Wireframes/D0003.dc.html` unter dem Anker `#beschreibung-stift`.

## Akzeptanzkriterien

**Ausgangslage:** Board `entwicklung`; Karte #1 „Abnahme prüfen“ mit der Beschreibung `Erster Absatz mit [Verweis](https://example.org)`; Karte #2 „Zweite Aufgabe“ ohne Beschreibung; das Aufgabenfenster von #1 ist offen, Ansicht „Inhalt“.

- [ ] **AK 1 Der Text bleibt Text:** Ein Klick in den Text, ein Doppelklick auf „Absatz“ und das Ziehen über „Erster Absatz“ öffnen kein Textfeld. Nach dem Doppelklick ist „Absatz“ ausgewählt, nach dem Ziehen „Erster Absatz“; die Auswahl bleibt stehen und lässt sich kopieren. (Heute öffnet jede der drei Handlungen das Textfeld.)
- [ ] **AK 2 Lesefläche ohne Knopf-Eigenschaften:** Die Lesefläche der Beschreibung hat weder `role` noch `data-act` noch `tabindex`. Ein Klick auf „Verweis“ folgt seinem Ziel wie in R00030 und öffnet kein Textfeld.
- [ ] **AK 3 Der Stift öffnet das Bearbeiten:** Auf der Zeile „BESCHREIBUNG“ steht ein `button` mit dem `title` „Beschreibung bearbeiten (b)“; er liegt in der Tab-Folge. Klick, Enter und Leertaste auf dem Stift öffnen je das Textfeld mit dem Markdown der Beschreibung, der Fokus steht im Textfeld. Solange das Textfeld offen ist, gibt es keinen Stift.
- [ ] **AK 4 Sichtbarkeit:** Ohne Hover und ohne Fokus ist der Stift unsichtbar (Deckkraft 0) und nicht anklickbar, bleibt aber per Tab erreichbar. Liegt der Zeiger auf der Beschreibung, ist er halbtransparent (Deckkraft zwischen 0 und 1; den Wert nennt die Zeichnung); liegt der Zeiger auf dem Stift oder hat er den Tastatur-Fokus, ist er voll sichtbar (Deckkraft 1). Auf einem Gerät ohne Hover (Touch) ist er dauerhaft halbtransparent und anklickbar.
- [ ] **AK 5 Zielgröße:** Die Zielfläche des Stifts erfüllt ADR-0012 (`--kd-ziel`), auch bei grobem Zeiger.
- [ ] **AK 6 Kürzel:** `b` öffnet das Textfeld der Beschreibung wie bisher.
- [ ] **AK 7 Fokus-Rückweg:** Nach dem Bearbeiten über den Stift liegt der Fokus wieder auf dem Stift, nie auf `BODY` — nach dem Speichern einer Änderung (Strg+Enter), nach dem Verlassen ohne Änderung, nach Esc und nach „Eingabe verwerfen“.
- [ ] **AK 8 Leere Beschreibung und Nachbarn:** Karte #2 zeigt direkt das Textfeld mit Platzhalter und keinen Stift. Ein Klick auf den Titel und auf eine Teilaufgabe wirkt wie bisher.

## Tests

Neue Spec `e2e/tests/r00162-beschreibung-stift.spec.js`; AK 1 läuft zuerst rot am heutigen Stand. Bestehende Tests ändern ihre Erwartung nur am Einstieg (Stift statt Klick in den Text): `r00030-markdown.spec.js` (:17), `r00103-sichtzustand.spec.js` (:242), `r00155-esc-verwirft.spec.js` (:371, :417), `r00155-eingabe-verwerfen.spec.js` (:216, :297). `r00116-fenstertitel.spec.js` und `r00145-ansichtsmenue.spec.js` nennen die Lesefläche und werden geprüft; `ziele.spec.js` und `r00106-fokus*.spec.js` messen den neuen Knopf vermutlich mit.

## Implementierungshinweise

- **Ändert sich:** `web/ansicht.js:361–362` (Lesefläche verliert `data-act`, `tabindex`, `role`, `aria-label`, `title`; Stift-`button` mit `data-act="beschreibung-bearbeiten"` auf der `h3`-Zeile, nur wenn Text da ist und nicht bearbeitet wird), `web/app.js:2628` (Enter-Zweig auf `.besch-lesen` entfällt), `web/kd-app.css:753–754` (Fokusrahmen der Lesefläche entfällt; Stift-Zustände mit `opacity` und `pointer-events`, nie `visibility:hidden`).
- **Bleibt**, weil der Stift dasselbe `data-act` trägt: Aktion, Kürzel `b`, Rückgabeziel des Fokus aus R00155, Speichern und Verlassen.
- **Nicht hinein:** Titel, Teilaufgaben, Kommentare; die Esc-Regel aus R00155 (Karte #54) wird nicht neu entschieden. Kein ADR-Nachtrag; der Bau führt die Tabellenzeile in ADR-0010 N9 und A00009 nach.
- Die Architektur ist am Code belegt, nicht am Programm gefahren; die erste Bubble misst den heutigen Stand.

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Keine. Die Zeichnung unter `#beschreibung-stift` klärt der Director getrennt.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: Wer einen Satz aus der Beschreibung kopieren will, klickt hinein — und steht im Textfeld mit dem Rohtext. Ist die Lesefläche reiner Text ohne Aktion (X), gehören Klick, Doppelklick und Ziehen wieder der Auswahl des Browsers (Y), und der formatierte Inhalt lässt sich auswählen und kopieren; das Bearbeiten bleibt über Stift und `b` einen Schritt entfernt (Z).

## Notizen

- Heimat: I0149 unter D0003. Optionen: entschieden vor der Planung — „die ganze Lesefläche bleibt Knopf“ ist verworfen, weil sie Auswahl, Doppelklick und Verweise überschreibt (Beratung realist-consultant, Entscheidung product-owner).
- Abweichung vom Wortlaut des Betreibers, ihm zur Kenntnis gegeben: Der Stift sitzt auf der Zeile der Überschrift statt über dem Text.
