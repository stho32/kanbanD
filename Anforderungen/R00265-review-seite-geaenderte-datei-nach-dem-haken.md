---
id: R00265
status: Neu
datum: 2026-11-27
---

# R00265: Review-Seite — geänderte Datei nach dem Haken sichtbar kennzeichnen

## Beschreibung

Wer auf der Review-Seite in „Alle Änderungen“ eine Datei als „gesehen“ abgehakt hat und diese Datei ändert sich danach durch einen neuen Commit, gilt sie wieder als ungesehen (R00246 US-5/AK 5, FA 8). Bisher geschieht das still: der Mensch sieht keinen Unterschied zwischen „nie geprüft“ und „geprüft, seither geändert“. Diese Anforderung kennzeichnet eine solche Datei mit einem sichtbaren Text-Hinweis — nicht nur mit Farbe — und lässt den Zähler „<k> von <n> gesehen“ wahr bleiben (die geänderte Datei zählt nicht mit). Das Speicherformat von „Gesehen“ bleibt unverändert; „seit dem Haken geändert“ wird aus dem vorhandenen Schlüssel gelesen (ADR-0042 Nachtrag N8).

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme viele Dateien prüft, sieht, welche geprüfte Datei sich seither geändert hat, und verwechselt sie nicht mit einer noch nie geprüften.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Seit S3 (R00246) klappt die Seite geprüfte Dateien ein und zählt sie; ändert ein neuer Commit eine geprüfte Datei, fällt sie still auf „ungesehen“ zurück. Wer die Seite verlässt, einen Fund bespricht oder am nächsten Tag zurückkehrt, sieht dann nur, dass die Datei wieder offen ist, und hält sie für „noch nie geprüft“. Mit dem Hinweis unterscheidet der Mensch „nie geprüft“ von „geprüft, aber die Datei hat sich seither geändert“ und prüft gezielt die geänderten Stellen nach. Dass nur die Anzeige dazukommt — kein neues Feld, kein neuer Endpunkt, der Zähler unverändert —, hält den Preis klein und lässt die abgenommene S3 unberührt.

## Funktionale Anforderungen

- FA 1: Der Zustand einer Datei in „Alle Änderungen“ ist `gesehen`, `geändert` (seit dem Haken geändert) oder `offen`: `gesehen` — der genaue Schlüssel `alle` + U+0000 + `<Anwendung>` + U+0000 + `<Pfad>` + U+0000 + `<Fingerabdruck>` steht in der Menge; `geändert` — der genaue Schlüssel fehlt, aber ein Schlüssel **derselben Identität** (Anwendung, Pfad) mit **anderem** Fingerabdruck steht in der Menge; sonst `offen` (ADR-0042 N8.4 Punkt 3). `gesehen` schließt `geändert` aus. Ein `alle`-Schlüssel wird an U+0000 in genau vier Felder zerlegt; ein Schlüssel ohne vier Felder ist fremd und wird nur auf Gleichheit geprüft, nie zerlegt (N8.4 Punkt 2).
- FA 2: In „Alle Änderungen“ trägt jede Datei im Zustand `geändert` einen sichtbaren Text-Hinweis, nicht nur eine Farbe — an zwei Stellen: an der Zeile in der Dateiliste und am Dateikopf neben „Gesehen“ (in „Ein Commit“ nie, FA 4). Wortlaut (sichtbarer Text und Tooltip gleich): „Seit dem Haken verändert“ (entschieden, `AI-Team/po-entscheidungen.md` Z. 734–736). Der Hinweis ist kein neues Bedienelement: in der Dateiliste steht er als gewöhnlicher Text (Span) im Zeilen-Knopf (`button.dn-e`, `web/diff.js:643`) in Lesereihenfolge direkt hinter dem Pfad, sein Text geht so von selbst in den zugänglichen Namen der Zeile ein; am Dateikopf steht er neben dem Kästchen „Gesehen“ (`input.ru-ges-k`, `web/diff.js:565`) und ist per `aria-describedby` damit verbunden. Die Zähl-Region sagt ihn nicht an (AK 5).
- FA 3: Der Zähler „<k> von <n> gesehen“ bleibt wahr: gezählt werden nur Dateien im Zustand `gesehen`; eine Datei im Zustand `geändert` zählt nicht mit. Der Hinweis ändert weder die gespeicherte Menge noch den Zähler (ADR-0042 N8.4 Punkt 4).
- FA 4: In „Ein Commit“ gibt es den Hinweis nicht; dort ist der Commit-Hash die Identität einer Datei, und „seit dem Haken geändert“ ist keine Aussage dieser Ansicht (ADR-0042 N8.4 Punkt 3, letzter Satz).
- FA 5: Das Speicherformat bleibt unverändert — kein neues Feld, keine Migration, der Schreibweg (Haken setzen und entfernen) unverändert. Ein Schlüssel derselben Identität wird nicht entfernt, wenn sich die Datei ändert; ein erneuter Haken setzt den Schlüssel mit dem **neuen** Fingerabdruck daneben, der Hinweis verschwindet dann (ADR-0042 N8.4 Punkte 1 und 5).
- FA 6: Lässt sich der Speicher nicht lesen (fehlend, werfend, unlesbar), gilt keine Datei als `geändert`; es entsteht kein Hinweis und kein Fehler in der Konsole (der Fehlerpfad von R00246 FA 10 bleibt unberührt).

## Nicht-funktionale Anforderungen

- Benutzerfreundlichkeit: der Hinweis ist bei 320 px ohne Querscrollen der Seite lesbar; sein Text hat gegen seinen Grund ≥ 4,5 : 1 in Hell und Dunkel; er wird als Text und nicht allein durch Farbe unterschieden (WCAG 1.3.1 — 2.5.3 gilt für bedienbare Komponenten, der Hinweis ist keine).
- Performance: keine neue Anfrage; das Lesen des Speichers und der Vergleich ändern das Zeichnen nicht (wie R00246).
- Sicherheit: kein neuer Endpunkt, kein neues Feld; Pfade stehen nur als Schlüssel im Speicher und werden nie als HTML gezeichnet.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `uebersichtRepository` in `e2e/tests/review-hilfen.js`): wie R00246 „Ausgangslage“ — K-Art (acht Dateien), Aufgabe #3 mit `kd` (fünf Dateien) und `wb`, dazu ein Commit K3b in `kd`, der `src/a.rs` um eine hinzugefügte Zeile ändert und an Aufgabe #3 hängt; Mensch `sh`, Browser headless, Board-Slug aus dem Wegwerf-Board. Heute gibt es den Zustand `geändert` und den Hinweis nicht; AK 1–7 sind rot.

### Zustand und Zähler (Einheit, rein)

- [ ] **AK 1 Zustand aus der Menge:** Gegeben eine Gesehen-Menge und eine aktuelle Datei (Anwendung, Pfad, Fingerabdruck), wenn der genaue `alle`-Schlüssel darin steht, dann `gesehen`; steht nur ein Schlüssel **derselben** (Anwendung, Pfad) mit **anderem** Fingerabdruck darin, dann `geändert`; steht kein Schlüssel dieser Identität darin, dann `offen`; ein Schlüssel einer anderen Anwendung oder eines anderen Pfades ergibt `offen` (nicht `geändert`); ein Ein-Commit-Schlüssel (`<hash>` + U+0000 + `<Pfad>`) wird nie als `alle`-Schlüssel gelesen. Der Leseweg zerlegt einen `alle`-Schlüssel an U+0000 in vier Felder und setzt ihn zeichengleich wieder zusammen; ein Pfad mit Bidi-/Steuerzeichen (ADR-0033 Punkt 8) und eine Anwendung mit Leerzeichen überstehen den Rundlauf; ein Schlüssel ohne vier Felder gilt als fremd und wird nur auf Gleichheit geprüft. Der Zähler zählt nur `gesehen` (Rechnung: eine Datei `gesehen`, eine `geändert`, eine `offen` → „1 von n“). Heute rot.

### Hinweis und Zähler (im echten Programm, „Alle Änderungen“)

- [ ] **AK 2 Grundfall, Zähler bleibt wahr:** Gegeben Aufgabe #3 in „Alle Änderungen“ mit `src/a.rs` abgehakt („1 von 5 gesehen“), wenn der Commit K3b `src/a.rs` um eine Zeile ändert und `sh` die Seite neu lädt, dann steht „0 von 5 gesehen“, `src/a.rs` ist im Zustand `geändert` (nicht `offen`, nicht eingeklappt) und trägt den sichtbaren Text-Hinweis „Seit dem Haken verändert“ (nicht nur eine Farbe) an zwei Trägern: an der Zeile in der Dateiliste (`button.dn-e` dieser Datei, `web/diff.js:643`) und am Dateikopf neben „Gesehen“ (`input.ru-ges-k`, `web/diff.js:565`); hakt `sh` `src/a.rs` erneut an, dann steht „1 von 5 gesehen“ und der Hinweis ist weg; liegt der aktuelle Fingerabdruck von `src/a.rs` im Speicher, steht der Hinweis nie da. Heute rot.
- [ ] **AK 3 Jede geänderte Datei, Nachbarn und Neuladen (Abtastung):** Gegeben Aufgabe #3 in „Alle Änderungen“ mit allen fünf Dateien abgehakt („5 von 5 gesehen“), wenn ein Commit drei der fünf Dateien ändert und `sh` neu lädt, dann trägt **jede** der drei geänderten Dateien den Hinweis und die beiden unveränderten keinen; es steht „2 von 5 gesehen“; die gleichnamige Datei einer anderen Anwendung trägt weder Haken noch Hinweis. Der Hinweis bleibt nach jedem Neuladen, nach dem Wechsel auf „Ein Commit“ und zurück und nach dem Nachladen eines anderen Abschnitts (Nachbarübergänge derselben Ansicht); in „Ein Commit“ erscheint der Hinweis nie; „Änderungen anzeigen“ an einer großen Datei nimmt den Haken nicht weg und setzt keinen Hinweis. Heute rot.
- [ ] **AK 4 Kein Hinweis ohne Grund (Fehlerpfad):** Gegeben ein Speicher, der bei jedem Zugriff wirft (gesperrt oder Kontingent voll), wenn `sh` eine Datei abhakt und die Seite neu lädt, dann gilt keine Datei als `geändert`, es steht kein Hinweis da und es gibt keinen Fehler in der Konsole (`pageerror`); mit funktionierendem Speicher (AK 2, 3) steht der Hinweis nie ohne eine Änderung. Heute rot.

### Breite, Zugänglichkeit, Bestand, Mutanten

- [ ] **AK 5 Breite, Themen, Kontrast, Ansage:** Gegeben Aufgabe #3 in „Alle Änderungen“ mit `src/a.rs` durch K3b geändert, bei 320, 414, 980 und 1280 px, hell und dunkel, dann gilt `document.documentElement.scrollWidth ≤ clientWidth`; der Hinweis am Dateikopf liegt bei jeder Breite ganz in der Breite und ist mit dem Kästchen „Gesehen“ per `aria-describedby` verbunden; der Hinweis in der Dateiliste liegt ganz in der Breite, wenn `sh` das Menü geöffnet hat (`.rail-offen`; unter 1100 px ist die Liste sonst hinter „Dateien (n) und Commit“ verborgen, `web/kd-app.css:1785`); der Text jedes Hinweises hat gegen seinen Grund ≥ 4,5 : 1 (`kontrastMessen`). Der Hinweis löst keine Ansage aus (die Live-Region „<k> von <n> gesehen“ meldet keine Hinweis-Änderung). Ort, Form und Wortlaut sind gezeichnet und freigegeben (`D0009.dc.html` `#review-uebersicht`, Stand 267a36e5; PO-Entscheidung `AI-Team/po-entscheidungen.md` Z. 734–736). Heute rot.
- [ ] **AK 6 Zugänglicher Name am Zeilen-Knopf (Muss der UX-Vorprüfung):** Abnahme-Probe wörtlich (Wortlaut auf „verändert“ angepasst): Gegeben Aufgabe #3 in „Alle Änderungen“ (K-Art-Ausgangslage), `src/a.rs` abgehakt, Commit K3b (eine hinzugefügte Zeile) angehängt, Seite neu geladen: der zugängliche Name des Zeilen-Knopfs von `src/a.rs` in der Dateiliste (`button.dn-e` mit dem `data-arg` dieser Datei; Name gelesen mit `ariaSnapshot()`/`getComputedAccessibleNode`) enthält den Hinweistext „Seit dem Haken verändert“; für die unveränderten Dateien (Zustand `offen`) enthält er ihn nicht. Heute rot.
- [ ] **AK 7 Bestand und Mutanten:** Ohne Haken verhält sich die Seite wie vor dieser Anforderung (Gruppen, Fortschritt, Ein- und Aufklappen, „Alle Änderungen“, soweit sie dann auf `main` stehen); die bestehenden Tests behalten ihre Erwartungen, jede geänderte Erwartung nennt der entwickler im Bericht mit Grund. Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie:
  - (a) der Hinweis feuert ohne Fingerabdruckvergleich (jeder Schlüssel derselben (Anwendung, Pfad) genügt) → eine Datei, deren aktueller Fingerabdruck gespeichert ist, zeigt den Hinweis → AK 2 rot
  - (b) der Zähler zählt die (Anwendung, Pfad) statt des genauen Schlüssels → eine geänderte Datei zählt als gesehen („1 von 5“ statt „0 von 5“) → AK 2 rot
  - (c) der Leseweg erkennt nur ein Präfix und nimmt den ersten Fund → ein Schlüssel einer anderen Anwendung/Datei erzeugt einen Hinweis → AK 1/AK 3 rot
  - (d) der Hinweis wird auch in „Ein Commit“ gesetzt → AK 3 rot
  - (e) der Ein-Commit-Schlüssel wird als `alle`-Schlüssel gelesen → AK 1/AK 3 rot

## Betroffene Verzeichnisstruktur

- Reine Funktionen (Zustand einer Datei aus der Menge, Zähler) kommen in `web/review-uebersicht.js` (Node-tauglich, hängt von nichts ab).
- Zeichnen: `web/diff.js` (`dateiHtml`, `dateilisteHtml`), `web/app.js` (`reviewDiffHtml`, `vReviewAlle`), `web/gesamt.js` (`abschnittHtml`, `gesamtDateiHtml`); der Hinweis nur in „Alle Änderungen“.
- Stil: `web/kd-app.css`, nur Tokens.
- Tests: `e2e/einheit/` (Node, rein) und eine Spec `e2e/tests/r00265-review-geaendert.spec.js`; die Ausgangslage kommt aus `e2e/tests/review-hilfen.js`, der K3b-Commit wie in R00246.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1440 Zustand und Hinweis-Merkmal je Datei, rein**: einen `alle`-Schlüssel in vier Felder zerlegen, aus der Gesehen-Menge den Zustand `gesehen`/`geaendert`/`offen` bestimmen, Zähler zählt nur `gesehen`. Einheitentests zuerst.
2. **B1441 Hinweis an der Datei zeichnen (nur „Alle Änderungen“)**: sichtbarer Text-Hinweis an der Datei in der Dateiliste, zugänglicher Name nach FA 2, Zähler unverändert, kein Hinweis in „Ein Commit“.
3. **B1442 Breite, Themen, Kontrast, Zugänglichkeit messen und nachziehen** (AK 5). Die Vorprüfung macht der ux-reviewer.
4. **B1443 Probe im echten Programm**, Mutanten (a)–(e), Gate, Anforderung abschließen.

### Grobentwurf

**Wichtige Einstiegsstellen:** `web/review-uebersicht.js` (reine Funktion neben `alleDateiSchluessel` `:381` und `fingerabdruck` `:386`), die Review-Seite in „Alle Änderungen“ (`web/app.js` `vReviewAlle`, `web/gesamt.js` `abschnittHtml`), die Dateiliste in `web/diff.js` (`dateilisteHtml`).

**Entwurf** (JavaScript, Hausstil `javascript-stil`):
- eine reine Funktion im Modul `web/review-uebersicht.js`: aus der Gesehen-Menge, der Anwendung und einer Datei den Zustand bestimmen (IOSP, keine Seiteneffekte); `gesehen` schließt `geändert` aus.
- der vorhandene Zähler `reviewAlleGesehen` zählt weiter nur den Zustand `gesehen` — keine zweite Zählweise.

### Änderungen an bestehenden Klassen

- `web/review-uebersicht.js`: neue reine Funktion (Name wählt der entwickler) neben `alleDateiSchluessel`; Export ergänzen.
- `web/app.js`, `web/gesamt.js`, `web/diff.js`: der Zustand wird je Datei an die Zeichnung gereicht; der Hinweis nur in „Alle Änderungen“.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht` (Stand 267a36e5, Vorgabe). Der Zustand „geprüft, seither verändert“ ist gezeichnet: als Marke im Gewand der `.mk`-Marke in der Dateiliste hinter dem Pfad und am Dateikopf neben „Gesehen“, nur in „Alle Änderungen“, sichtbarer Text und Tooltip „Seit dem Haken verändert“, Hell und Dunkel, 1280 px und 320 px (grober Zeiger). Ort und Form gibt die Zeichnung vor; den Wortlaut hat der product-owner entschieden (`AI-Team/po-entscheidungen.md` Z. 734–736; ADR-0042 N8.4 Punkt 6, N8.7).

## Tests

Nach `test-pyramide`.

**Kandidaten für Unit Tests (pure Logik nach IOSP):**
- die reine Zustandsfunktion in `web/review-uebersicht.js` (Menge + Datei → Zustand, Zähler) — ohne Seiteneffekte, Node-tauglich.

**Integration:** keine neue, der Server bleibt unverändert.

**E2E:** AK 2–7 im gestarteten Programm gegen echtes Git; der geänderte Commit K3b wie in R00246, der werfende Speicher über `addInitScript`, Breiten und Kontrast wie R00246.

## Abhängigkeiten

- Abhängig von: R00246 (I0236, grün), ADR-0042 Nachtrag N8 (Akzeptiert)
- Blockiert: nichts unmittelbar.

## Offene Fragen

- Wortlaut und Ort des Hinweises: **entschieden** (product-owner, `AI-Team/po-entscheidungen.md` Z. 734–736) — Liste **und** Dateikopf, nur „Alle Änderungen“, „Seit dem Haken verändert“ (sichtbar und Tooltip), Span im `button.dn-e` hinter dem Pfad, am Kopf per `aria-describedby` an „Gesehen“; die Zähl-Region sagt ihn nicht an.
- Ob `D0009` `#review-uebersicht` den Zustand erhält: **entschieden ja** (gestalter, Zeichnung `D0009.dc.html` `#review-uebersicht`, 267a36e5; `Dokumentation/Wireframes/_wireframes.md` Z. 97).

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die UX-Vorprüfung von R00246: S3 lässt eine geprüfte Datei still auf „ungesehen“ zurückfallen, sobald ein neuer Commit sie ändert; der Mensch kann „nie geprüft“ nicht von „geprüft, seither geändert“ unterscheiden und liest die Datei entweder doppelt oder hält veralteten Stand für geprüft. Kennzeichnet die Seite die geänderte Datei mit Text, dann sieht der Mensch den Unterschied und prüft gezielt die Stellen nach, die sich seit seinem Haken geändert haben. Der Hebel ist der vorhandene Schlüssel: der alte Fingerabdruck liegt schon im gespeicherten `alle`-Schlüssel (ADR-0042 N8.2), also braucht der Hinweis kein neues Feld, keine Migration und keinen neuen Endpunkt — nur das Lesen des Lesewegs. Dass der Zähler weiter nur genaue Schlüssel zählt, hält die abgenommene Zusage von S3 wahr und lässt die Datei weiter als offen gelten.

## Missing-Docs
- keine

## Notizen

- Eigene Interaction mit eigener Anforderung (Härtung), nicht Bubbles an die abgenommene I0236 — sonst öffnet sich deren Abnahme („alle AK erfüllt“) wieder (Lehre 2026-11-11, #17/#80). R00246 bleibt unverändert; US-5/AK 5 trägt höchstens eine Verweiszeile.
- Aus R00246 Frage 5 (PO Z. 643–644, „nein“): der Hinweis war bewusst nicht Umfang von S3, weil er den alten Fingerabdruck braucht. ADR-0042 N8 entscheidet, dass er ohne neues Feld aus dem vorhandenen Schlüssel gelesen wird.
- Inkauf (ADR-0042 N8.6): eine ersetzte Zeile (gleiches `plus`/`minus`/`status`) erkennt der Fingerabdruck nicht → kein Hinweis; die Stufe `blob` aus N3.4 schließt beide zugleich. Eine Rückkehr zu einem früher geprüften Stand macht die Datei wieder „gesehen“ (F1); F3 (je Haken ersetzen) wäre die genauere, aber teurere Lesart — eigene Karte.
- Verworfene Alternativen (ADR-0042 N8.3): F2 (Gegenstands-Liste je Datei) — Migration und geänderte R00246-Tests; F3 (je Haken ersetzen statt ergänzen) — ändert den Schreibweg und den Sinn von „geändert“, nicht Teil dieser Karte.
- Nicht Teil: ein Hinweis in „Ein Commit“ (US-5 nennt „Alle Änderungen“), die Stufe `blob` (N3.4), „Alle als gesehen markieren“, „wer hat gesehen“, Abgleich zwischen Geräten.
