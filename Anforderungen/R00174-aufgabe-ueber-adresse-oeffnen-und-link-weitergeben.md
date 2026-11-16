---
id: R00174
status: Neu
datum: 2026-11-16
---

# R00174: Aufgabe über Adresse öffnen und Link weitergeben

## Beschreibung

Herkunft: Karte #153 „Direktlinks auf Aufgaben“ (Betreiber), Technik vom architekt am Code gelesen ([ADR-0029](../Dokumentation/ADRs/0029-adresse-der-geoeffneten-aufgabe.md)). **Wozu**, im Wortlaut des Betreibers: „Derzeit kann ich Aufgaben auf dem Board öffnen, aber ich erhalte keinen Direktlink. Dadurch können wir in localchatA nicht einfach einen Link auf z.B. die aktuelle Aufgabe mitgeben oder per E-Mail sich gegenseitig einfach die Aufgabe zusenden. … Die Links müssten vermutlich Board und AufgabenNr enthalten, so dass die gleiche Ansicht geöffnet wird aus der man den Link hat. Es könnte ja mehrere Boards geben, die die gleiche Aufgabe enthalten.“

**Entschieden** (ADR-0029, hier nur das Ergebnis):

1. **Form:** `#/board/<slug>/aufgabe/<nr>` öffnet das Board mit dem [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md); `#/aufgaben/aufgabe/<nr>` öffnet die Aufgabenliste mit dem Fenster (Aufgaben ohne Board). Alle bisherigen Adressen bleiben.
2. **Nachführen:** Öffnen und Schließen des Fensters schreiben die Adresse als neuen Verlaufseintrag, ohne neu zu laden; Zurück schließt, Vor öffnet.
3. **„Link kopieren“** steht im ⋮-Menü des Fensters und im Kartenmenü; der Host ist der des Betrachters.
4. **Ohne Zwischenablage** erscheint der [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md) „Kopieren nicht erlaubt — der Link steht in der Adresszeile“; auf `localhost` und `127.0.0.1` ergänzt jede Rückmeldung „gilt nur auf diesem Rechner“.
5. **Nur Navigation:** eine Adresse löst nie einen schreibenden Aufruf aus; die Nummer besteht nur aus Ziffern, der Slug gilt nur gegen die bekannten Boards, Text aus der Adresse wird nie angezeigt.
6. **Anderes Fenster oder Entwurf offen:** eine Adresse wirkt wie der Klick auf eine andere Karte.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mensch und Agent arbeiten gleichberechtigt“: beide zeigen mit derselben Adresse auf dieselbe Aufgabe.

## Akzeptanzkriterien

**Ausgangslage:** Boards „Entwicklung“ (`entwicklung`) und „Zweit“ (`zweit`); Aufgabe #7 liegt auf beiden, #8 auf keinem Board, #9 nur auf „Zweit“, #99 gibt es nicht.

- [ ] **AK 1 Link kopieren:** #7 auf „Entwicklung“ geöffnet, „Link kopieren“ gewählt, der kopierte Text in einem neuen Tab geöffnet → Board „Entwicklung“ mit dem Fenster „Aufgabe #7“; der Text endet auf `#/board/entwicklung/aufgabe/7`.
- [ ] **AK 2 Adresse folgt, Zurück und Vor:** Öffnen von #7 ändert die Adresse auf `#/board/entwicklung/aufgabe/7`, Schließen auf `#/board/entwicklung`, je ohne Neuladen; Zurück schließt das Fenster, Vor öffnet es wieder; gespeicherte Eingaben bleiben. Steht ein ungespeicherter Entwurf im Fenster, verhält sich Zurück wie das Schließen über ✕ heute — kein neuer Weg, eine Eingabe zu verlieren.
- [ ] **AK 3 Zwei Boards:** `#/board/entwicklung/aufgabe/7` öffnet „Entwicklung“, `#/board/zweit/aufgabe/7` öffnet „Zweit“, je mit dem Fenster „Aufgabe #7“.
- [ ] **AK 4 Ohne Board:** `#/aufgaben/aufgabe/8` öffnet die Aufgabenliste mit dem Fenster „Aufgabe #8“; „Link kopieren“ dort ergibt diese Adresse.
- [ ] **AK 5 Hinweise statt leerer Seite:** `…/board/entwicklung/aufgabe/99` → Board ohne Fenster, Hinweis „Aufgabe #99 gibt es nicht“, die Adresse fällt auf `#/board/entwicklung`. `…/board/gibtsnicht/aufgabe/7` → das erste bzw. gemerkte Board mit Fenster „Aufgabe #7“ und Hinweis „Board aus dem Link gibt es nicht“ (ohne den Slug). `…/board/entwicklung/aufgabe/9` oder eine archivierte Aufgabe → Board und Fenster, Hinweis „#9 liegt nicht auf diesem Board“.
- [ ] **AK 6 Defekte Datei:** Ist die Datei der Aufgabe defekt (423), zeigt die Adresse das vorhandene Defekt-Fenster.
- [ ] **AK 7 Ohne Zwischenablage:** Verweigert der Browser das Kopieren, steht der Hinweis „Kopieren nicht erlaubt — der Link steht in der Adresszeile“, und die Adresszeile trägt den Link.
- [ ] **AK 8 Tastatur:** „Link kopieren“ ist im ⋮-Menü des Fensters mit der Tastatur erreichbar; die Rückmeldung „Link kopiert“ ist eine Statusmeldung, der Fokus bleibt im Fenster.
- [ ] **AK 9 Fremde Zeichen:** `#/board/entwicklung/aufgabe/<img src=x onerror=alert(1)>` → Board ohne Fenster, kein Dialog, der Adresstext steht nirgends in der Seite.
- [ ] **AK 10 Bleibt:** Alle bisherigen Adressen (`#/board/<slug>`, `#/aufgaben`, `#/personen`, `#/einrichten`, `#/berichte/<name>`, `#/wbs/<kürzel>[/<id>]`) wirken wie zuvor; die bestehenden Specs laufen unverändert grün.

Gestaltung nach der Zeichnung `Dokumentation/Wireframes/D0003.dc.html#link-kopieren`.

## Tests

Unit an der Lesefunktion Hash → {Sicht, Slug, Nummer} (erster Test: `#/board/entwicklung/aufgabe/7` → Board `entwicklung`, Nummer 7; fremde Zeichen → keine Nummer). E2E als Spec: beide Formen in einem frischen Tab, Zurück/Vor, die drei Hinweise.

## Implementierungshinweise

- Schnitt, einzeln auslieferbar: F0143 Adresse öffnet die Aufgabe (AK 3–6, 9, 10) · F0144 Adresse nachführen und Link kopieren (AK 1, 2, 7, 8, 10; braucht F0143).
- Nachgeführt wird die README „Für Agenten“ um einen Satz mit dem Muster der Adresse.
- **In Kauf genommen:** Ein Link von `localhost` gilt nur auf dem eigenen Rechner. Die API nennt die Boards einer Aufgabe nicht — ein Agent bildet die Adresse aus dem Board, an dem er arbeitet. Die Adresse trägt weder Filter noch Reiter.
- **Nicht hinein:** Pfad-Adressen · Links auf Berichte mit Filterzustand · Kurzlinks · `GET /api/aufgaben/{nr}` um Boards ergänzen.

## Warum löst diese Anforderung das Problem?

Auslöser: Wer eine Aufgabe zeigen will, kann heute nur „#7 auf dem Board Entwicklung“ schreiben. Kopiert der Betreiber den Link aus dem Fenster oder der Adresszeile (X), öffnet der Empfänger mit einem Klick dasselbe Board mit derselben Aufgabe (Y); damit lässt sich eine Aufgabe in localchatA und per E-Mail weitergeben, auch wenn sie auf mehreren Boards liegt (Z).

## Offene Fragen

Keine.

## Manuelle Vorbereitungstätigkeiten

Die Zeichnung `Dokumentation/Wireframes/D0003.dc.html#link-kopieren` entsteht vor dem Bau durch den gestalter (beauftragt der Director).
