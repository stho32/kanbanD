---
id: R00266
status: Neu
datum: 2026-11-27
---

# R00266: Review-Seite — Kopfzeile mit den Schaltern anheften

## Beschreibung

Karte #270, aus dem Code-Review von #259 (Anmerkung 1 des code-reviewer, Sollte 2 des ux-reviewer; PO Z. 680/682), neue Interaction unter D0009. Wer auf der Review-Seite („Ein Commit“ oder „Alle Änderungen“) eine längere Datei liest, hat die Kopfzeile mit den Schaltern „Umbrechen“ und „Nebeneinander“ (und „Alle einklappen“) beim Umschalten längst aus dem Bild gerollt; er muss erst zurückscrollen, und die Lesestelle geht dabei verloren — der Leseanker aus ADR-0042 N6.2 greift für einen Menschen deshalb nie. Die Kopfzeile liegt künftig **außerhalb** des Rollbehälters `#review` (ADR-0042 Nachtrag N9): sie bleibt beim Lesen sichtbar, weil sie nicht mitrollt — nicht durch `position:sticky`. Weil die Oberkante von `#review` dann wieder die Unterkante des Kopfs ist, bleiben Leseanker, Sprungziele und Scroll-Anker unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme eine Änderung prüft, schaltet um, ohne die Stelle zu verlieren.

### Domänenbezug
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md)
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Wirkungskette: Wer eine lange Datei prüft und beim Lesen umschalten will, rollt heute zur Kopfzeile zurück → die Stelle im Text geht verloren und wird wiedergesucht → der Nutzen des Schalters („die Stelle bleibt im Fenster“, R00248 US-5/US-6) tritt für einen Menschen nie ein. Liegt der Kopf außerhalb des Rollbehälters, ist der Schalter beim Lesen erreichbar, und die Lesestelle bleibt beim Umschalten stehen. Der Hebel ist genau dieser Umzug: kein zweiter Mechanismus, keine Messung, keine Nachführung.

## Funktionale Anforderungen

- FA 1: Die Kopfzeile der Review-Seite (die Leiste mit „Alle einklappen“/„Alle aufklappen“, „Umbrechen“ und „Nebeneinander“ — `.rv-leiste`) liegt **außerhalb** des Rollbehälters `#review` und bleibt beim Lesen sichtbar (ADR-0042 N9.4 Punkt 1). `#review` bleibt der Rollbehälter (`.rv{flex:1;min-height:0;overflow:auto}`, `web/kd-app.css:1510`); der Kopf ist ein `flex:none`-Geschwister **über** `#review` in `#main` (`#main{display:flex;flex-direction:column}`, `:7`). Kein `position:sticky`, kein `scroll-padding`. Der Kopf ist in „Ein Commit“ und in „Alle Änderungen“ derselbe; er liegt in denselben Zuständen außerhalb, in denen er heute im Rollbehälter steht (Laden, Liste-Fehler, Diff-Fehler, „keine Dateien“, geladene Ansicht — `web/app.js:2307`, `:2335`, `:2396`); die Zustände „Verweis ungültig“ und „Aufgabe gibt es nicht“ tragen heute keinen Kopf und ändern sich nicht.
- FA 2: Ob die Commit-Leiste `.rv-ls` (mit dem Sprung „Zum Code“) **mit** angeheftet wird oder nur die Schalterleiste klebt und „Zum Code“ in sie wandert, ist D0009s Komposition (ADR-0042 N9.4 Punkt 4) und die Freigabe des product-owner. Die Technik aus FA 1 gilt für jedes angeheftete Element; der Sprung „Zum Code“ landet in jedem Fall unter der Kopfzeile (FA 4).
- FA 3: Die Oberkante von `#review` ist die Unterkante des Kopfs (kein Spalt, keine Überlappung). Der Leseanker aus ADR-0042 N6.2 bleibt **wörtlich** gültig: `reviewLeseZeileMerken` findet mit `document.elementFromPoint` an der Oberkante von `#review` die oberste sichtbare Zeile `tr` (`web/app.js:2160–2169`); der Rückfall (Dateikopf, dann `#rv-a0`) bleibt, wird aber nicht mehr durch den Kopf ausgelöst. Kein neuer Messpunkt.
- FA 4: Sprungziele bleiben unverändert und landen **unter** dem Kopf: der Sprung aus der Dateiliste (`data-act="review-datei"`, `web/app.js:4307–4329`) und der native Sprung „Zum Code“ (`#rv-zc`, `href="#rv-insel"`, `web/gesamt.js:196`) setzen das Ziel an die Oberkante von `#review`, also unter den Kopf; die `scroll-margin-block-start`-Werte (`.df-k`, `.rv-gk`, `web/kd-app.css:1771/1761`) bleiben. Der Scroll-Anker N7 (`.rv{overflow-anchor:none}` / `.rv.umbr{overflow-anchor:auto}`, `:1675–1676`) bleibt.
- FA 5: Der Kopf ist beim Lesen bedienbar: „Umbrechen“ und „Nebeneinander“ (und „Alle einklappen“, wo es Dateien gibt) sind ohne Zurückscrollen zu bedienen; Umschalten ändert nur die Darstellung — Zustand der Seite, „k von n gesehen“, offene Dateien und Fokus bleiben, wie R00248/R00249 es festlegen.
- FA 6: Gestaltung: der gestalter zeichnet D0009 um das Anheften nach, **auch bei 320 px** (welche Elemente kleben, wie hoch der Kopf wird, welcher Hintergrund den durchrollenden Code deckt), und der product-owner gibt frei (ADR-0042 N9.7, PO Z. 680). Ohne diese Freigabe wird nicht gebaut.
- FA 7: Stil und Proben ziehen nach: die fünf `.rv `-Regeln des Kopfs (`.rv .btn`, `.rv .sum`, `.rv .pl`, `.rv .mi`, `.rv .btn.rv-mehr`, `web/kd-app.css:1512/1519/1520/1535`) treffen den Kopf weiterhin (Regel auf den neuen Behälter umgehängt oder der Behälter trägt eine Klasse, die sie trifft); jede E2E-Probe, die den Kopf unter `#review` sucht (`#review .rv-leiste …`, `#review .rv-ls`, r00207/r00248/r00249), wird auf den neuen Kopfbehälter umgehängt; keine Erwartung wird abgeschwächt.
- FA 8: Sichtbarer Text: **kein neuer Hinweis- oder Meldungstext** (Wortlaut-Vorschlag des planers an den product-owner). Die Schalterwörter („Umbrechen“, „Nebeneinander“, „Alle einklappen“, „Alle aufklappen“, „Zum Code“) bleiben wörtlich. Verlangt die Freigabe von D0009 einen Hinweis am angehefteten Kopf, entscheidet der product-owner den Wortlaut; er wird hier nachgetragen.

## Nicht-funktionale Anforderungen

- Performance: kein neuer Mechanismus, keine Messung, keine Resize-Nachführung (ADR-0042 N9.4); der Umzug kostet keine Anfrage und kein zusätzliches Neuzeichnen. Kein Zeitmaß im Gate (ADR-0026 N5 Regel 12).
- Benutzerfreundlichkeit: bei 320, 414, 980 und 1280 px, hell und dunkel, `document.documentElement.scrollWidth ≤ clientWidth`; der Kopf deckt den durchrollenden Code (Hintergrund nicht durchsichtig, gemessen Alpha 1); Kontrast ≥ 4,5:1 (Text) bzw. 3:1 (Rand/Zeichen) in beiden Themen; Fokusring ganz sichtbar; die Tab-Reihenfolge bleibt (Dateiliste, dann Kopf, dann Inhalt wie heute).
- Sicherheit: kein neuer Endpunkt, kein neues Feld, kein Prozess; fremder Text bleibt Text und wird nie als HTML gelesen.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `uebersichtRepository` in `e2e/tests/review-hilfen.js`): Repository R mit Anwendung `kd` und Aufgabe #9; Commit N mit mehreren Dateien, darunter eine lange (`src/l.rs`, eine Zeile aus 407 Zeichen mit Leerzeichen, wie R00248 K-Lang); Mensch `sh`, Browser headless.

Heute (Stand `15f08b2a`) liegt die Kopfzeile **in** `#review` und rollt beim Lesen aus dem Bild; AK 1, 2, 3, 5 und 6 sind deshalb rot (AK 4 belegt, dass der Leseanker nach dem Umzug greift; AK 7 hält den Bestand).

### Angeheftet und Lesestelle

- [ ] **AK 1 Der Kopf bleibt beim Lesen sichtbar, die Lesestelle steht** (Abnahme-Probe P1, ADR-0042 N9.5): Gegeben Commit N bei 980 px, `sh` rollt bis unter die erste Datei; wenn er „Umbrechen“ umschaltet (in „Nebeneinander“ zusätzlich den zweiten Schalter) und zurückschaltet, dann liegt die Kopfzeile mit den Schaltern (`.rv-leiste`) ganz im Sichtbereich und ist bedienbar (Umschalten ohne Zurückscrollen), und die oberste Lesezeile (die Zeile `tr`, die vor dem Umschalten mit `elementFromPoint` an der Oberkante von `#review` getroffen wurde, samt ihrem `data-z`) steht danach mit `|top_danach − top_davor| ≤ 36` px an ihrer Stelle; dasselbe bei 320 px. Heute rot.
- [ ] **AK 2 Sprungziel unter dem Kopf** (P2): Gegeben Commit N, `sh` löst in der Dateiliste den Sprung auf eine weiter unten stehende Datei aus (`data-act="review-datei"`), dann gilt `#rv-dk<i>.getBoundingClientRect().top >= #review.getBoundingClientRect().top` — der Dateikopf steht **unter** dem Kopf, nicht dahinter.
- [ ] **AK 3 „Zum Code“ unter dem Kopf** (P3): Gegeben Commit N mit mindestens einem Sprung („Zum Code“, `#rv-zc`), wenn `sh` ihn per Tastatur auslöst, dann gilt `#rv-insel.getBoundingClientRect().top >= #review.getBoundingClientRect().top`.
- [ ] **AK 4 Der Leseanker greift** (P5): Gegeben AK 1, dann trifft `document.elementFromPoint` an der Oberkante von `#review` eine Zeile `tr` mit ihrem `data-z`, nicht den Rückfall `#rv-a0` (den ADR-0042 N6.2 verworfen hat).

### Nachbarübergänge, Neuladen und Zustände

- [ ] **AK 5 Jeder Zustand, Neuladen und Ansichtswechsel**: Gegeben die Review-Seite, dann liegt die Kopfzeile in **jedem Zustand, der heute einen Kopf trägt**, außerhalb von `#review` und ist sichtbar — Laden (`Liest den Diff …`), Liste-Fehler, Diff-Fehler, „keine Dateien“ (`Dieser Commit ändert keine Dateien.`), geladene Ansicht (`diff`), „Alle Änderungen“; die Zustände „Verweis ungültig“ und „Aufgabe gibt es nicht“ tragen heute keinen Kopf und bleiben ohne (unverändert). Abgetastet über die ganze Menge der Zustände, nicht Beispiele. Nach Neuladen, Blättern zu einem anderen Commit, Wechsel „Ein Commit“ ↔ „Alle Änderungen“ und nach einem Fehler mit „Erneut versuchen“ liegt der Kopf weiter außerhalb (kein Zurückrutschen in `#review`). Heute rot.
- [ ] **AK 6 Breiten und Bedienung**: Gegeben Commit N, Breiten 320, 414, 980 und 1280 px, hell und dunkel, dann gilt `document.documentElement.scrollWidth ≤ clientWidth`; die Kopfzeile ist bei jeder dieser Breiten sichtbar und bedienbar (auch 320 px), ihr Hintergrund deckt den durchrollenden Code (berechnetes `backgroundColor` mit Alpha 1), Tab erreicht „Umbrechen“ und „Nebeneinander“ in der heutigen Reihenfolge, die Leertaste schaltet um, der Fokusring ist ganz sichtbar, und der Text hat gegen seine Fläche ≥ 4,5:1, Rand/Zeichen ≥ 3:1. Heute rot.

### Bestand und Mutanten

- [ ] **AK 7 Bestand und Mutanten** (P4): Bei unverändertem Bestand verhalten sich Schalter, Blättern, „Alle einklappen“, „Gesehen“, Leseanker, Sprungziele und Scroll-Anker wie vor der Karte; die Wächter `r00207-review-seite`, `r00245-review-commit-leiste`, `r00248-review-umbrechen`, `r00249-review-nebeneinander`, `r00265-review-geaendert` sind grün (Selektoren des Kopfs auf den neuen Behälter umgehängt, jede geänderte Erwartung nennt der entwickler im Bericht mit Grund). Eine Suche über **alle** `e2e/tests/*.js` (Abtastung der ganzen Menge) findet keine Probe mehr, die den Kopf unter `#review` sucht (`#review .rv-leiste`, `#review .rv-ls`). Mutant (P4): den Kopf wieder **in** `#review` legen (oder `position:sticky` ohne Aufschlag) → AK 2 und AK 3 werden rot.

## Betroffene Verzeichnisstruktur

- Zeichnung der Seite: `web/app.js` (`vReview`, `vReviewAlle`, `reviewDiffHtml` — der Kopf verlässt das `seite(...)`-Element, das heute alles in `<div class="rv" id="review">` hüllt, `:2327`), `web/gesamt.js` (die Leiste `reviewLeisteHtml`/`leisteHtml`, `:197`).
- Stil: `web/kd-app.css` (`.rv`, `.rv-leiste`, `.rv-ls`, die fünf `.rv `-Regeln, `#main`), nur Tokens; Anhalt `Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht`/`#diff-fenster`/`#alle-aenderungen`.
- Tests: neu `e2e/tests/r00266-review-kopf-angeheftet.spec.js`; angepasste Kopf-Selektoren in `e2e/tests/r00207-review-seite.spec.js`, `r00245-review-commit-leiste.spec.js`, `r00248-review-umbrechen.spec.js`, `r00249-review-nebeneinander.spec.js`; Ausgangslage in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1450 Abnahme-Proben rot am heutigen Stand**: P1 (980/320), P2, P3, P5 in einer neuen Spec; heute rot, weil der Kopf in `#review` liegt und mitrollt (der Kopf liegt dann vor der getroffenen Zeile). Test zuerst rot aus dem richtigen Grund.
2. **B1451 Kopf außerhalb des Rollbehälters zeichnen und halten** (Kern, FA 1, 3): `vReview`/`vReviewAlle` geben die Leiste als eigenes Element **über** `#review` aus (beide `flex`-Kinder von `#main`); der Kopf bleibt derselbe Knoten über ein Neuzeichnen (Halter wie `#rv-insel`, `web/app.js:2820–2845`, `:3325`), Fokus und Reihenfolge unverändert. P1 wird grün.
3. **B1452 Stil des angehefteten Kopfs** (FA 6, 7; D0009): Hintergrund (deckt den Code), Höhe, Umbruch bei 320 px, die fünf `.rv `-Regeln auf den Behälter umgehängt; kein `sticky`. Vorprüfung ux-reviewer vor diesem Schritt.
4. **B1453 Sprungziele, Leseanker und bestehende Proben nachziehen** (FA 4, 7): P2, P3, P5 belegen; Kopf-Selektoren in r00207/r00245/r00248/r00249 auf den neuen Behälter umhängen (keine Erwartung abgeschwächt).
5. **B1454 Probe im echten Programm, Mutant P4, Gate, Verweiszeilen, Anforderung abschließen**: volle Suite gegen echtes Git; Mutant P4 getötet; R00248/R00249 je höchstens eine Verweiszeile in „Notizen“; R00266 `Erledigt`.

### Gestaltung und Wortlaut

D0009 nachzeichnen (gestalter, auch 320 px) und vom product-owner freigeben (FA 6). Kein neuer Hinweis- oder Meldungstext (FA 8); der planer schlägt **keinen** vor. Sollte die Freigabe einen Hinweis am Kopf verlangen, entscheidet der product-owner den Wortlaut.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht` (Bild 1: „Ein Commit“ mit der Kopfzeile), `#diff-fenster` (S6 „Umbrechen“), `#alle-aenderungen`. Der angeheftete Kopf ist dort **noch nicht gezeichnet** — die Nachzeichnung ist Teil dieser Karte (FA 6). Die Zeichnung ist Anhalt, nicht Vertrag: was sie nicht festlegt (Höhe bei 320 px, Hintergrund, Umfang des Kopfs), füllt der gestalter nach Material 3, der product-owner gibt frei.

## Tests

- **Unit**: keine neue reine Funktion erwartet (die Änderung ist Zeichnung und Stil); entsteht eine kleine Ableitung des Kopfumfangs, wird sie als Node-Test geprüft.
- **Integration**: keine, der Server bleibt unverändert.
- **E2E**: AK 1–7 im gestarteten Programm gegen echtes Git. Höhen, Rechtecke und Lage mit `getBoundingClientRect` und `Range.getClientRects`; die Lesestelle über `elementFromPoint` an der Oberkante von `#review` und `data-z`; Verneinungen („kein Kopf in `#review`“) erst nach einem sichtbaren Signal (Kopf sichtbar, Inhalt gezeichnet).

## Abhängigkeiten

- Abhängig von: R00207 (I0197 Review-Seite eines Commits, grün), R00210 (I0200 Alle Änderungen, grün), R00245 (I0235 Commit-Leiste, grün), **R00248** (I0238 Schalter „Umbrechen“ und Klasse am Diffbereich, abgenommen — `Braucht` der Karte #259) und **R00249** (I0239 Ansicht nebeneinander, abgenommen — `Braucht` der Karte #260); Technik ADR-0042 **Nachtrag N9** (Akzeptiert, `15f08b2a`), N5/N6/N7 bleiben unverändert.
- Blockiert: nichts.

## Offene Fragen

- **Frage 1 (product-owner, nach D0009) — Umfang des angehefteten Kopfs:** nur die Schalterleiste (`.rv-leiste`) oder auch die Commit-Leiste (`.rv-ls`, mit „Zum Code“) bzw. „Zum Code“ in die Schalterleiste? ADR-0042 N9.4 Punkt 4 lässt es offen. Empfehlung: nur die Schalterleiste, „Zum Code“ wandert in sie — die Commit-Leiste wird bis 40 vh hoch (`web/kd-app.css:1679`) und nähme bei 320 px die halbe Lesehöhe. Der product-owner entscheidet nach der Zeichnung.
- **Frage 2 (ux-reviewer, Vorprüfung) — Wortlaut am Kopf:** Vorschlag des planers: kein neuer Hinweis- oder Meldungstext (FA 8). Braucht der angeheftete Kopf bei 320 px einen Hinweis, entscheidet der product-owner den Wortlaut.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Schalter „Umbrechen“ (R00248) und „Nebeneinander“ (R00249) wurden gebaut, damit die Lesestelle beim Umschalten bleibt; beim Menschen tritt die Wirkung aber nie ein, weil die Kopfzeile mit dem Schalter längst aus dem Bild gerollt ist, bevor er umschalten will (Befund des Code-Reviews #259, PO Z. 680/682). Wird der Kopf aus dem Rollbehälter `#review` herausgenommen, dann steht er still, während der Inhalt rollt: der Schalter ist beim Lesen erreichbar (X), und weil die Oberkante von `#review` wieder die Unterkante des Kopfs ist, trifft der Leseanker (N6.2) die oberste sichtbare Zeile statt des Rückfalls, die Lesestelle bleibt stehen (Y) — der Zweck der beiden Schalter tritt endlich ein (Z). Genau dieser Umzug ist der Hebel: ein `position:sticky` innerhalb von `#review` erreichte dasselbe, erzwänge aber drei Anpassungen (Leseanker, Sprungziele, Scroll-Anker) an der fehleranfälligsten Stelle der Seite und wäre ein zweiter Mechanismus für dieselbe Wirkung; der Umzug braucht keinen. Ein Vorschalten (die Schalter anders bauen) oder Nachschalten (nur die Kopfzeile sperren) löst die verlorene Lesestelle nicht.

## Missing-Docs

Keine.

## Notizen

- Optionen für das Anheften (ADR-0042 N9.3, Karte #270): (V1) `position:sticky` am Kopf **innerhalb** `#review` — verworfen, erzwingt drei Anpassungen an Leseanker, Sprungzielen und Scroll-Anker (die Stellen mit den meisten Nacharbeiten, #259); (V3) nur die Schalterleiste anheften, die Commit-Leiste rollt weg — dieselbe Technikfrage, „Zum Code“ müsste wandern, eine Komposition (Frage 1), kein eigener Weg. Gewählt: **(V2)** der Kopf wird aus `#review` herausgenommen (ADR-0042 N9.4).
- Nicht Teil: ein neuer Scroll-Mechanismus (V1 bleibt Rückfall, falls die Annahme N9.6 falsch ist), `position:sticky`, `scroll-padding`, eine Resize-Nachführung, ein neuer Hinweis-/Meldungstext, Änderungen an Leseanker, Sprungzielen und Scroll-Anker (bleiben unverändert), die „Gesehen“-Markierung (R00265/I0255), die Läufe-Ansicht.
- In Kauf genommen: der Kopf rollt nie weg und nimmt dauerhaft Höhe ein (bei 320 px mehr); ist die Commit-Leiste mit angeheftet, bis ~40 vh plus Schalterleiste (ADR-0042 N9 Konsequenzen). Der Umfang ist Frage 1.
- Verworfen/verwiesen: R00248 und R00249 bleiben abgenommen; sie erhalten je höchstens **eine** Verweiszeile in „Notizen“ auf diese Karte.
