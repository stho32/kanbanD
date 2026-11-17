---
id: R00184
status: In Arbeit
datum: 2026-11-16
---

# R00184: Fokusring im Kopf sichtbar, aktueller Bericht im Menü angesagt, Überschriftenfolge im Aufgabenfenster ohne Sprung

## Beschreibung

Herkunft: Paket aus Karte #59 (UX-Review von #9; #66 ist darin aufgegangen) und Karte #111 (Auto-Reviews von #13, Entscheidungen des product-owner vom 2026-11-08, `AI-Team/po-entscheidungen.md` Z. 178–179). Drei kleine Lücken der Barrierefreiheit, am Code vom 2026-11-16 gelesen, alle drei bestehen noch:

- **59 — Fokusring im Kopf.** Links und Knöpfe der Kopfzeile ([Hauptnavigation](../Dokumentation/Domaenenwissen/D00009-hauptnavigation.md)) haben keinen eigenen Fokusring; der Standardring des Browsers ist auf dem dunklen Kopf kaum zu sehen. Das Filterfeld im Kopf trägt im dunklen Thema einen Ring mit 1,55:1 gegen den Kopf (`.kz .inp:focus`, `web/kd-app.css:72`). Nur der Kopf des Modus „Spalten einrichten“ hat schon einen eigenen Ring (`web/kd-app.css:102`).
- **111 — aktueller Bericht.** Das Menü „Berichte“ zeigt den offenen Bericht nur fürs Auge (Klasse `an`), ohne `aria-current="page"` (`vBerichtePop`, `web/ansicht.js:1151`). ADR-0018 Regel 5 verlangt beides unter derselben Bedingung.
- **111 — Überschriftenfolge.** Das [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) und der Dialog „Neue Aufgabe“ beginnen mit Überschriften dritter Ebene („BESCHREIBUNG“, „TEILAUFGABEN“ …), eine zweite Ebene fehlt (`web/ansicht.js:229`, `:394`). ADR-0018 Regel 2 gilt dem Sinn nach auch im Dialog (product-owner 2026-11-08).

**Gewünscht:** Wer mit der Tastatur durch den Kopf geht, sieht in beiden Themen, wo der Fokus steht. Wer mit einem Screenreader arbeitet, hört im Menü „Berichte“, welcher Bericht offen ist, und findet im Aufgabenfenster eine Überschrift zweiter Ebene mit dem Namen des Fensters, darunter die Abschnitte. Zu sehen ist außer dem Ring nichts Neues; eine Zeichnung ist deshalb nicht nötig.

Zahlt ein auf: [Vision](R00000-vision.md) — der Mensch bedient das Board ohne Umweg, auch ohne Maus und ohne Bildschirm.

## Akzeptanzkriterien

**Ausgangslage:** Board „Entwicklung“ mit Aufgabe #1 (Beschreibung „Text“, eine Teilaufgabe), Fenster des Browsers 1280 × 900 px; helles und dunkles Thema über `data-theme`.

- [ ] **AK 1 · 59-Ring im Kopf (Abnahme-Probe der Karte):** Board geöffnet, mit Tab nacheinander auf „Board“, „Berichte“, das Filterfeld und jeden weiteren Knopf der Kopfzeile → jedes Element zeigt, solange es den Fokus hat, einen durchgezogenen Ring von 2 px, dessen Farbe **mindestens 3:1 gegen die Fläche des Kopfs** steht — im hellen und im dunklen Thema (WCAG 2.4.7, 1.4.11). Rechenbeispiel mit dem Vorschlag der Karte, Ring in `--kd-head-link`: hell 11,49:1, dunkel 12,47:1 (aus den Token gerechnet). Heute rot: Links und Knöpfe tragen den Standardring des Browsers (`outline-style: auto`), das Filterfeld dunkel 1,55:1. Die Karte nennt als Ziel der Probe „Aufgaben“; das Ziel liegt seit R00140 im Menü „…“, die Probe nimmt deshalb „Board“.
- [x] **AK 2 · 59-Bleibt:** Der Kopf im Modus „Spalten einrichten“ zeigt seinen Ring wie heute (gemessen gleich vorher/nachher). Ein Klick mit der Maus auf einen Link oder Knopf des Kopfs zeigt keinen Ring; das Filterfeld zeigt ihn auch nach einem Klick, wie heute. Ringe außerhalb der Kopfzeile (Menüs, Fenster, Board) sind unverändert.
- [x] **AK 3 · 111-Aktueller Bericht (Abnahme 1 der Karte):** Auf jeder der zehn Berichtsrouten (Stundenzettel, Zeiten nach Aufgabe und Person, Burndown, Kumulativer Fluss, Durchsatz, Wie lange noch, Projekt-Fever-Chart, Durchlaufzeit, Bestand nach Labels, Kosten) trägt im geöffneten Menü „Berichte“ genau der Eintrag des offenen Berichts `aria-current="page"` und die Klasse `an`, kein anderer. Auf dem Board trägt kein Eintrag des Menüs eines von beiden; „Export als CSV“ nie. Gilt bei 1280 px und bei 560 px (dort über „Seite“ → „Berichte“). Der Auslöser „Berichte“ in der Leiste behält seine Markierung wie heute (Lesart von Regel 5: ADR-0018 Nachtrag N3).
- [x] **AK 4 · 111-Überschriftenfolge (Abnahme 2 der Karte):** Im Aufgabenfenster von #1 ist die erste Überschrift eine der zweiten Ebene und heißt wie das Fenster („Aufgabe #1“), darunter folgen die Abschnitte als dritte Ebene ohne Sprung — in jeder Ansicht des Fensters (Inhalt, Zeiten, Details, Datei, Verlauf). Im Dialog „Neue Aufgabe“ ebenso mit „Neue Aufgabe“. Die zugänglichen Namen der beiden Dialoge bleiben wörtlich wie heute. Überschriften, die aus dem Markdown einer Beschreibung oder eines Kommentars stammen, zählen nicht mit.
- [x] **AK 5 · 111-Gestaltung gleich (Abnahme 3 der Karte):** Vorher und nachher gemessen gleich: Schriftgröße, Schriftstärke, Farbe, Ränder und Höhe des Fensterkopfs, der Abschnittsköpfe („BESCHREIBUNG“ …) und der Einträge des Menüs „Berichte“; Fensterkopf und Abschnitte stehen an derselben Stelle (Lage und Größe auf 1 px gleich).
- [ ] **AK 6 · Proben und Bestand:** Je eine Probe zu AK 1, AK 3 und AK 4 ist vor der Änderung rot und danach grün. Die bestehenden Specs zu Struktur, Navigation, Fokus und Kontrast (`r00113-struktur`, `r00140-navigation`, `r00106-*`, `kontrast`) laufen unverändert grün.

## Tests

E2E als Spec, die drei Proben zuerst und rot: Ring je Element des Kopfs aus den berechneten Werten (`outline-style`, `outline-width`, Kontrast der Ringfarbe gegen den Hintergrund von `header.kz`) in beiden Themen; Menü „Berichte“ über alle zehn Routen und das Board; Überschriftenfolge je Ansicht des Aufgabenfensters und im Dialog „Neue Aufgabe“. Die Vorher-Werte für AK 2 und AK 5 werden vor der Änderung gemessen und in der Spec als feste Werte geführt. Unit, falls der Kontrast über `e2e/einheit/kontrast.test.js` als Paar geführt wird.

## Implementierungshinweise

- Vorschlag der Karte #59, keine Vorschrift: `.kz :focus-visible{outline:2px solid var(--kd-head-link);outline-offset:2px}`; für das Filterfeld die Ringfarbe von `.kz .inp:focus` nachziehen (Vorschlag aus #66 war `--kd-accent`, dunkel 4,21:1, hell aber nur 2,34:1 gegen den Kopf — `--kd-head-link` trägt in beiden Themen).
- **Schadensstelle Spezifität:** `[role="radio"]:focus-visible` (`web/kd-app.css:922`) steht gleich hoch wie `.kz :focus-visible` und zeichnet in `--kd-accent` (hell 2,34:1 gegen den Kopf); `.kz-modus .kz-btn:focus-visible` (`:102`) muss für den Modus weiter gewinnen, weil dessen Fläche hell ist.
- Menü „Berichte“: der Helfer `aktuelleSeite` (`web/ansicht.js:77`) liefert Klasse und Attribut aus einem Wahrheitswert; die Funktion `e` in `vBerichtePop` setzt heute nur die Klasse.
- Überschrift: ob der sichtbare Kopf („#1“, „Neue Aufgabe“ in `.mod-kopf .id`) zur Überschrift wird oder eine visuell verborgene (`.vh`) davor steht, entscheidet der Bau; Gestaltung an der Klasse, nicht am Tag (ADR-0018 Regel 2). Die Abschnitte bleiben dritte Ebene.
- **Nicht hinein:** Menüköpfe als `h4` in Pops (#109) · Hilfe-Dialog „Tastaturkürzel“ (beginnt ebenfalls mit dritter Ebene, eigener Befund) · Sperrform (#151) · Mutanten je Punkt (Abnahme 4 der Karte #111 entfällt, Betreiber 2026-11-16: keine Härtung der Härtung — die Probe muss nur vor der Änderung rot sein).
- **Weggefallen nach Prüfung am Code:** Hover-Grund `--kd-head-line` mit Schrift `--kd-head-text` (Anmerkung des planers an #59 vom 2026-11-06) steht bei 8,14:1 hell und 11,10:1 dunkel und braucht nichts.

## Warum löst diese Anforderung das Problem?

Auslöser: Wer mit Tab durch den Kopf geht, verliert im hellen Thema den Fokus aus dem Auge, und wer das Filterfeld im dunklen Thema ansteuert, sieht keinen Ring. Trägt jedes Element des Kopfs einen Ring mit mindestens 3:1 gegen den Kopf (X), ist der Fokus in beiden Themen zu sehen (Y), und die Bedienung mit der Tastatur gelingt ohne Raten (Z). Ebenso: Trägt der offene Bericht `aria-current` und beginnt das Fenster mit einer Überschrift zweiter Ebene (X), sagt der Screenreader „aktuelle Seite“ und führt die Überschriftenliste ohne Lücke (Y); der Mensch weiß, wo er ist, ohne das Menü durchzuprobieren (Z).

## Offene Fragen

- Lesart von ADR-0018 Regel 5 bei offenem Menü „Berichte“: der Auslöser in der Leiste und der Eintrag des offenen Berichts tragen dann beide `aria-current="page"`. Empfehlung und Stand der Kriterien: beide behalten bzw. bekommen die Markierung (Nachtrag N3); zu bestätigen durch den architekt.
