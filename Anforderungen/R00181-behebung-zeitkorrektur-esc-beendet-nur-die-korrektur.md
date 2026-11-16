---
id: R00181
status: Neu
datum: 2026-11-16
ursprung: Bug-Report
ursprungslauf: R00155
---

# R00181: Behebung — Zeitkorrektur: Esc beendet nur die Korrektur, nicht das Fenster

## Beschreibung

Herkunft: Karte #190 (aus #141, davor #54). Wer im [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) eine Zeit korrigiert und Esc drückt, verliert heute das ganze Fenster, obwohl der Fensterfuß „Esc Eingabe verwerfen · erneut schließen“ sagt.

**Ursache (am Code gelesen, Stand 2026-11-16, nicht gefahren):** Die Esc-Kaskade hat keinen Zweig für die Zeitkorrektur (`web/app.js:2953–2959`). Ihre Felder `#z-beginn` und `#z-ende` (`web/ansicht.js:488`) tragen kein `data-af` und stehen nicht in `ENTER_FELDER`, also kennt `eingabeVerwerfen` sie nicht, und das erste Esc läuft in den Schließen-Zweig. [R00155](R00155-behebung-aufgabenfenster-felder-und-fenstermeldung.md) hat das in Kauf genommen und an Karte #141 verwiesen.

**Erwartet:** Es gilt die eine Esc-Regel des Fensters ([ADR-0010 N9](../Dokumentation/ADRs/0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md), Ziffer 4: Esc tut je Druck genau eines, das Innerste zuerst; Ziffer 2: Esc löst keinen Schreibweg aus). Die Korrektur ist ein Bearbeitungsmodus: Das erste Esc beendet ihn, die Zeile zeigt wieder den Stand der Datei, der Fokus steht auf dem Stift dieser Zeile, nichts wird geschrieben. Erst das zweite Esc schließt das Fenster.

Eine Zeichnung ist nicht nötig: es entsteht kein neues Bedienelement. Zahlt ein auf: [Vision](R00000-vision.md) — die Oberfläche ist per Tastatur bedienbar und folgt gewohnten Konventionen.

## Akzeptanzkriterien

**Ausgangslage:** Aufgabe #1 mit einer beendeten Zeit (Beginn `2026-11-16 09:00`, Ende `2026-11-16 09:30`), Aufgabe #2 mit einer laufenden Zeit; Person `st` (Mensch) gewählt; Aufgabenfenster in der Ansicht „Zeiten“. „Nichts geschrieben“ heißt: kein `PATCH` an den Server, die Datei der Aufgabe unverändert, kein neuer Commit im `git log`.

- [ ] **AK 1 Esc beendet nur die Korrektur (Abnahme-Probe der Karte):** #1, Korrektur über den Stift (✎) geöffnet, „Beginn“ auf `2026-11-16 08:00` geändert, Esc → das Fenster bleibt offen, die Zeile zeigt wieder 09:00–09:30, der Fokus steht auf dem Stift dieser Zeile, nichts ist geschrieben. Ein zweites Esc schließt das Fenster. Heute rot: das erste Esc schließt.
- [ ] **AK 2 Laufende Zeit:** #2, Korrektur geöffnet (nur „Beginn“), „Beginn“ geändert, Esc → wie AK 1: Fenster offen, Zeile zeigt den Stand der Datei und läuft weiter, Fokus auf dem Stift dieser Zeile, nichts geschrieben; das zweite Esc schließt.
- [ ] **AK 3 Ohne Änderung:** #1, Korrektur geöffnet, nichts getippt, Esc → die Korrektur ist beendet, das Fenster bleibt offen, Fokus auf dem Stift der Zeile; das zweite Esc schließt.
- [ ] **AK 4 Gegenprobe und Bestand:** Enter in „Beginn“ oder „Ende“ und der Knopf ✓ speichern die Korrektur wie bisher (ein `PATCH`, die Zeile zeigt 08:00–09:30). Die bestehenden Tests zu Zeiten und zur Esc-Regel laufen unverändert grün.

## Tests

E2E als Spec: AK 1 zuerst (heute rot aus dem richtigen Grund: Fenster zu), mit Netzwerkprotokoll, Datei und `git log` wie in `e2e/tests/r00155-esc-verwirft.spec.js` (Hilfen `r00155-hilfen.js`); dann laufende Zeit, ohne Änderung, Gegenprobe Enter und ✓. Mutant, der rot werden muss: der neue Zweig hinter dem Schließen-Zweig.

## Implementierungshinweise

- Vorschlag, keine Vorschrift: ein Zweig für `S.ui.zeitEdit` in der Esc-Kaskade vor `S.ui.offen`, nach dem Vorbild der Teilaufgabe (`teilEdit`, `web/app.js:2956`) — Modus beenden, `S.ui.fokus` auf den Stift der Zeile (`[data-act="zeit-edit"]` mit der Kennung der Zeit, `web/ansicht.js:489`), neu zeichnen. Die Felder schreiben nur über `zeit-ok` (`web/app.js:2278`), ein Zurücksetzen des Werts ist nicht nötig, weil das Neuzeichnen die Felder entfernt.
- **Schadensstelle:** Der Zweig darf kein `blur()` mit Schreibweg auslösen und das Fenster nie schließen.
- **Nicht hinein:** ein Knopf „Eingabe verwerfen“ für die Zeitkorrektur (product-owner 2026-11-15) · „Zeit nachtragen“ (`#zeit-neu`, schon in R00155) · Verhalten der Korrektur bei einem Live-Ereignis.
- Nach dem Bau stimmt der Absatz „Zeitkorrektur, außerhalb dieses Pakets“ in ADR-0010 N9 Ziffer 4 nicht mehr; das Nachziehen gehört dem architekt.

## Warum löst diese Anforderung das Problem?

Auslöser: Ein Mensch öffnet die Korrektur einer Zeit, vertippt sich und drückt Esc, wie es der Fensterfuß anbietet. Beendet Esc nur die Korrektur (X), bleibt das Fenster mit seinem Zusammenhang stehen und der Fokus liegt auf dem Stift der Zeile (Y); der Mensch korrigiert erneut oder arbeitet im Fenster weiter, statt die Aufgabe neu zu öffnen und die Zeile wiederzusuchen (Z).

## Offene Fragen

Keine.
