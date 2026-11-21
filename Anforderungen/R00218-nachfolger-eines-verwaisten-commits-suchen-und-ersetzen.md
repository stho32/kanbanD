---
id: R00218
status: Neu
datum: 2026-11-21
---

# R00218: Nachfolger eines verwaisten Commits suchen und ersetzen

## Beschreibung

Karte #220 (Scheibe A5 des Feinschnitts; Betreiber 2026-11-19, po-entscheidungen Z. 389 Punkt 4: „patch-id-Nachfolgervorschlag für verwaiste Commits als eigene spätere Karte“). Technik: [ADR-0038](../Dokumentation/ADRs/0038-nachfolger-eines-verwaisten-commits-ueber-patch-id-mit-vorfilter.md) (Vorgeschlagen, b835fdb8). Zuschnitt der Oberfläche: po-entscheidungen Z. 455–456; Zeichnung D0009 `#nachfolger` (075156d8), freigegeben mit Änderung in Z. 458–462.

**Umfang (baut auf [R00203](R00203-commit-verweise-nach-einem-rebase-ersetzen.md), [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md) und [R00205](R00205-ansicht-commits-im-aufgabenfenster.md)):** Steht an einer Karte ein Commit-Verweis „auf keinem Zweig“ (Zustand `verwaist`), sucht kanbanD **auf Anfrage** Commits auf den Zweigen des Arbeits-Repositorys, die denselben Patch tragen (gleiche `git patch-id --stable`). Das sind die Kandidaten für den Nachfolger, also den Commit, den ein Rebase oder Cherry-pick aus dem verwaisten gemacht hat. Ein Agent fragt das über `GET /api/aufgaben/{nr}/commits/{verweis}/nachfolger`. Ein Mensch drückt in der Ansicht „Commits“ des [Aufgabenfensters](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) am Eintrag „auf keinem Zweig“ den Knopf „Nachfolger suchen“ und wählt dann selbst je Kandidat „Ersetzen“ oder „Verwaisten Verweis entfernen“. Die Antwort nennt nur Hash und Metadaten, nie Patch-Text oder Dateinamen. kanbanD ersetzt nie selbst, auch nicht bei genau einem Kandidaten.

**Nicht** in A5: „ähnliche“ Commits mit gleichem Autor und Datum, aber anderem Patch (PO Z. 456); ein Knopf auf der Review-Seite (`…/review` bleibt reine Leseansicht, PO Z. 455); eine Vorschau des Kandidaten-Diffs; ein Cache im Speicher; die Nutzung der Suche durch die Factory in `_rebase` (ADR-0032 N1.8, eigene Entscheidung der Factory).

**Zuerst die Sondierung** (ADR-0038 Punkt 9): höchstens 30 Minuten, tagsüber. Ihre Regel entscheidet ohne Rückfrage über die Höchstzahl von 1.000 Commits. Nur bei ungleichem Orakel oder p95 ≥ 2 s bei 200 hält die Karte an (AK 1).

**Gestaltung zuerst für die Oberfläche:** Der gestalter hat das Artboard D0009 um den Anker `#nachfolger` ergänzt (hell und dunkel, 1280/414/320 px, 075156d8). Der product-owner hat die Zeichnung mit Änderung freigegeben (Z. 458): Knöpfe auf `.btn` mit dem Rand `--kd-line-strong` (Z. 418), der 409 beim Ersetzen nach Z. 460, die Wortlaute nach Z. 461. Nach der UX-Vorprüfung (220-ux-reviewer-1, Muss 1: Zwischenbreiten 641–1099 px ungezeichnet) hat der gestalter die mittlere Form nachgezeichnet (4d6b3997). Der PO hat sie mit Änderung freigegeben (Z. 463–465): Die mittlere Form hängt nur an der Breite, nicht am Zeiger. Sie gilt für die ganze Ansicht „Commits“, auch ohne Suche, und wird in dieser Karte gebaut. Im Kopf steht ein Zusatz zu „Verwaisten Verweis entfernen“. Die Suche per API (AK 1–6) und die Oberfläche (AK 7–13) dürfen damit gebaut werden.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109–112). Ersetzen schreibt nur die Karte im Board-Repository über die vorhandene API; im Arbeits-Repository wird nur gelesen (Nicht-Ziel „Kein Git-Client“, Z. 194).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- Die Begriffe **Commit-Verweis**, **verwaist**, **Anwendung** und **Register** wie in R00202–R00205; im Glossar fehlen sie weiterhin. **Nachfolger** und **Kandidat** sind neu, siehe Offene Fragen (Glossar).

## Geschäftlicher Nutzen

Wer von Hand rebased oder einen Commit auf einen anderen Zweig überträgt, lässt an der Karte einen Verweis zurück, der „auf keinem Zweig“ steht. Heute muss er den neuen Hash im Log selbst suchen: nach Titel, Datum und Inhalt, und mit dem Risiko, den falschen Commit einzutragen. Mit A5 genügt ein Klick zum Suchen und einer zum Ersetzen. Die Karte zeigt danach wieder auf den Commit, der auf dem Zweig liegt. Diff und Gesamt-Diff stimmen dann wieder, denn ein verwaister Verweis fehlt im Gesamt-Diff als „nicht einbezogen“.

## Funktionale Anforderungen

1. **Endpunkt** `GET /api/aufgaben/{nr}/commits/{verweis}/nachfolger`. `verweis` ist der volle Hash oder ein an der Karte eindeutiger Präfix ab 7 Zeichen, wie bei `DELETE`. Er braucht kein `X-KanbanD-Wer`, setzt keine Sperre und schreibt nichts (ADR-0038 Punkt 1).
2. **Nur für `verwaist`**: Der Zustand wird so gerechnet wie in der Liste (R00204). Jeder andere Zustand ergibt 404 `{fehler, zustand, grund?}`.
3. **Kandidat** ist jeder Commit auf einem lokalen oder entfernten Zweig mit derselben `patch-id --stable` wie der verwaiste, im Suchraum aus ADR-0038 Punkt 2. Für jede Binärdatei, die der verwaiste ändert, muss der Kandidat denselben neuen Inhalt haben.
4. **Antwort 200** in der Form aus ADR-0038 Punkt 4. Je Kandidat stehen `verweis` (passt wörtlich als `neu` in `ersetzen`), `hash`, `titel`, `autor`, `datum`, Zweige und `an_der_karte`. Die Kandidaten sind nach Commit-Datum absteigend geordnet, bei Gleichstand nach Hash. Gezeigt werden höchstens 10, der Rest steht als `kandidaten_weitere`. Die `hinweise` sind `suche_gekappt` (mit `durchsucht` und `grund`), `merge` und `leer`.
5. **Kein Kandidat** ist kein Fehler: 200 mit `kandidaten: []`.
6. **Nie Inhalt**: Die Antwort trägt keinen Patch-Text, keinen Dateinamen und keine Zeile. Titel und Autor erscheinen nur für Commits mit gleicher `patch-id`. Ein Kandidat ist kein Verweis der Karte: Diff und Review bleiben für ihn gesperrt, bis er ersetzt ist.
7. **Grenzen**: höchstens 12 Git-Prozesse nacheinander in einem Platz der Lesegrenze, 10 s für die Suche, Antwort nach höchstens 15 s, sonst 503 `{fehler}` und nie eine Teilliste. `ETag` mit 304 (ADR-0038 Punkte 2, 6, 7).
8. **Neuer Git-Befehl** `patch-id`, nur mit `--stable`, Eingabe nur über `stdin` (ADR-0038 Punkt 3).
9. **Oberfläche**: In der Ansicht „Commits“ steht am Eintrag „auf keinem Zweig“ der Knopf „Nachfolger suchen“. Er sucht nur auf Klick, nie beim Laden der Liste. Das Ergebnis steht am Eintrag: je Kandidat Kurz-Hash, Titel, Autor, Datum und Zweige wie in der Liste, dazu „Ersetzen“. Ist der Kandidat schon an der Karte (`an_der_karte`), trägt er die Marke „schon an der Aufgabe“ und statt „Ersetzen“ den Knopf „Verwaisten Verweis entfernen“. Alle Knöpfe bauen auf `.btn` mit dem Rand `--kd-line-strong` (Z. 418, 458).
10. **Ersetzen** ruft `POST …/commits/ersetzen` mit genau dem Paar `{alt: <Verweis des verwaisten Eintrags>, neu: <verweis des Kandidaten>}` auf. **Verwaisten Verweis entfernen** ruft `DELETE …/commits/<Verweis des verwaisten Eintrags>` auf. Beides geschieht ohne Bestätigungsdialog, denn die Wahl je Kandidat ist die Bestätigung. Danach liest die Ansicht die Liste einmal neu. Antwortet „Ersetzen“ mit 409 und ist `verweis` der Antwort der Verweis des verwaisten Eintrags, steht der Nachfolger inzwischen schon an der Karte: Der Kandidat wechselt in die Form `an_der_karte`, und erst ein Klick auf „Verwaisten Verweis entfernen“ ruft `DELETE` (Z. 460).
11. **Zustände der Oberfläche** mit dem Wortlaut aus Z. 461 und Z. 465, wie in den Akzeptanzkriterien: lädt, Kandidaten (Kopf mit dem Zusatz zu „Ersetzen“, sobald mindestens ein Kandidat „Ersetzen“ trägt, und dem Zusatz zu „Verwaisten Verweis entfernen“, sobald mindestens ein Kandidat diesen Knopf trägt), kein Kandidat, gekappt (ein Satz für jeden `grund`, Z. 462), weitere (Einzahl und Mehrzahl), Merge, leer, Fehler der Suche mit „Erneut versuchen“, Fehler beim Ersetzen oder Entfernen, 409 mit Wechsel in die Form `an_der_karte`, Erfolg, gesperrt.
12. **Mittlere Form 641–1099 px** (PO Z. 463–464): In dieser Breite stehen in der ganzen Ansicht „Commits“ je Verweis und je Kandidat links der Hash, rechts untereinander Titel, „Autor · Datum“, Zustand bzw. Zweige und der Knopf. Das gilt für die Liste mit und ohne Suche. Die Form hängt nur an der Fensterbreite (`@media (min-width:641px) and (max-width:1099px)`, dieselbe Grenze wie `.rv-abs-rumpf`), nicht am Zeiger. Bei grobem Zeiger gelten auch dort Ziele von mindestens 48 px (`--kd-ziel`). Bis 640 px bleibt die schmale Form aus R00205, ab 1100 px die Tabelle. Die Review-Seite ändert sich nicht.
13. **Fokus und Ansage:** Die Oberfläche setzt den Fokus nach einer Suche, einem Ersetzen oder Entfernen nur, wenn er noch auf dem Auslöser oder auf `body` liegt. Ein Auslöser, der beim Neuzeichnen wegfällt, lässt den Fokus auf `body` zurück und zählt so mit. Live-Regionen gibt es nur für „lädt“, für Fehler, bei denen der Fokus auf dem Auslöser bleibt (409 allgemein, 423), und für die Erfolgsmeldung im Kopf der Liste. Wohin der Fokus geht, dort steht keine Live-Region; was dort zu sagen ist, hängt als Beschreibung (`aria-describedby`) am Fokusziel. Je Suche gibt es höchstens eine Ansage über eine Live-Region.

## Nicht-funktionale Anforderungen

- **Performance (Sondierung, Tag-Kriterium):** Gemessen wird kalt im Wegwerf-Repository nach B0998 (20.000 Commits, 50 Zweige, ohne `commit-graph`), mit p95 < 2 s. Gemessen nur tagsüber (8–21 Uhr), bei 1-Minuten-Last ≤ 6 beim Start. Nachts gemessene Werte gelten nicht (Lehre #230). Das ist Lastbeobachtung der Sondierung, kein Zeittest im Gate.
- **Sicherheit:** Die Zusage aus #214 gilt: „nie fremder Code“. Nach außen gehen nur Hash und Metadaten von Commits mit gleicher `patch-id`. Eingabe von außen ist nur ein Verweis der Karte. Fenster, Datum und Commit-Liste rechnet der Dienst selbst, und Revisionen stehen hinter `--end-of-options` (ADR-0038 Punkt 5). Das ist ein Prüfpunkt für den `security-reviewer`.
- **Barrierefreiheit:** Jedes Bedienziel ist bei grobem Zeiger mindestens 48 × 48 px groß, in jeder der drei Formen. Der Fokus landet nie auf `body` (ADR-0010). Hat der Mensch den Fokus während der Suche woanders hingesetzt (die Suche dauert bis zu 15 s), nimmt die Oberfläche ihn ihm nicht weg. Ein zugänglicher Name beginnt mit dem sichtbaren Wort (WCAG 2.5.3). Die gesperrte Form folgt po-entscheidungen-archiv Z. 216: `aria-disabled` und `aria-busy`, nie natives `disabled`, und der Fokusring wird nicht gedämpft. Gesperrter Text fällt aus der Regel 4,5:1 heraus (WCAG 1.4.3, Z. 459), der Knopfrand aus der Regel 3:1 für Konturen (WCAG 1.4.11, Z. 418).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, wie R00203–R00205; jede Probe stellt sie selbst her). Browser headless, Mensch `sh`, Agent `entw1`. Wegwerf-Repository R (`git init -b main`), Anwendung `kd` im Register:

- auf `main`: **M0** „Grundstand“ mit `a.txt`, `b.txt`, `bild.png`, danach **M1** „Drittes anlegen“ (`c.txt`);
- **K** „Zeile zwei ändern“ (ändert `a.txt`) auf `karte/1` (von M0). Dann `git rebase main` auf `karte/1`, `main` per `merge --ff-only` nachgezogen, `karte/1` gelöscht: **K'** liegt auf `main`, K ist verwaist;
- **G** „Zeile zwei anders ändern“ auf Zweig `fremd`: dieselbe Datei `a.txt` wie K, anderer Inhalt;
- **C** „Gruß ändern“ (ändert `b.txt`) auf losgelöstem `HEAD`, per Cherry-pick auf die Zweige `x` (**C1**, Commit-Datum später) und `y` (**C2**, früher);
- **S1–S3** auf `karte/3`, als Squash **S** auf `main` übernommen, `karte/3` gelöscht;
- **Mg**, ein Merge auf `karte/4`, Zweig gelöscht; **E**, ein leerer Commit (`--allow-empty`) auf losgelöstem `HEAD`;
- **B** „Bild tauschen“ (`bild.png`, neuer Inhalt X) auf losgelöstem `HEAD`; **B2** ändert `bild.png` auf Zweig `z` vom selben alten Inhalt auf Y; **B3** ist B, per Cherry-pick auf Zweig `w` übertragen (Inhalt X).

Die Karten tragen diese Verweise: #1 `kd:<K>`, `kd:<M1>` · #2 `kd:<C>` · #3 `kd:<K>`, `kd:<K'>` · #4 `kd:<S1>`, `kd:<Mg>`, `kd:<E>`, `kd:<B>`. „Commit-Zahl“ ist `git rev-list --count HEAD` im Board-Ordner. Kein Commit-Titel enthält einen Dateinamen; nur so lässt sich AK 5 an der Antwort prüfen.

### Suche per API

- [ ] **1. Sondierung (Tag-Kriterium, nicht im Nachtbetrieb).** Gegeben ist der Erzeuger aus B0998 (20.000 Commits, 50 Zweige, ohne `commit-graph`) mit den Fällen (a)–(f) aus ADR-0038 Punkt 9, dazu kanbanD nur lesend. Wenn die Suche nach V2 tagsüber (8–21 Uhr, Last ≤ 6 beim Start, `nice -n 10`) je Fall 20-mal kalt läuft, dann ist ihre Kandidatenmenge je Fall gleich der des Orakels `git log -p --no-merges --no-renames --branches --remotes ^<verwaist> --since=<…> -n 1000 | git patch-id --stable`, gefiltert auf die `patch-id` des verwaisten. Einzige Ausnahme ist Fall (e), dort ist V2 strenger. Erwartet: (a) je der Nachfolger, (b) zwei, (c) keiner, (d) einer, (e) keiner, (f) wie das Orakel. Außerdem ist p95, der 19. von 20 sortierten Werten, kleiner als 2 s. Messwerte, Uhrzeit und Last stehen im Bericht. **Regel ohne Rückfrage:** Ist das Orakel gleich und p95 < 2 s, bleibt es bei 1.000. Ist p95 ≥ 2 s, wird halbiert, bis p95 < 2 s gilt, aber nie unter 200 (1.000 → 500 → 250 → 200); der Wert steht in der Commit-Nachricht. Ist das Orakel ungleich oder p95 ≥ 2 s bei 200: **Halt**, nichts weiter bauen, Rückweg `anforderung_falsch` an den architekt.
- [ ] **2. Kandidaten.** Gegeben die Ausgangslage, dann gilt:
  - `GET /api/aufgaben/1/commits/kd:<K:7>/nachfolger` ergibt 200 mit genau einem Kandidaten: `verweis` `kd:<K'>`, `zweige ["main"]`, `an_der_karte: false`. G kommt nicht vor.
  - Für #2 und `kd:<C>` kommen genau C1, dann C2 (Commit-Datum absteigend).
  - Für #3 und `kd:<K>` steht K' mit `an_der_karte: true`.
  - Wird C auf 12 Zweige übertragen, stehen 10 Kandidaten da und `kandidaten_weitere: 2` (12 − 10). Bei genau 10 fehlt das Feld.
  - Die Commit-Zahl im Board-Ordner bleibt bei allen Aufrufen gleich.
- [ ] **3. Ohne Kandidat, mit Hinweis.** Gegeben die Ausgangslage, dann ergibt jeder dieser Aufrufe 200:
  - `kd:<S1>` an #4: `kandidaten: []` ohne Hinweis (Squash);
  - `kd:<Mg>`: `kandidaten: []` und `hinweise` mit `art: "merge"`;
  - `kd:<E>`: `kandidaten: []` und `art: "leer"`;
  - `kd:<B>`: nur B3, nie B2 (gleiche Datei, anderer Binärinhalt).
  - Gegeben ein Repository R2 mit einem verwaisten Commit V und danach 1.001 Commits auf `main` (über `git fast-import`): `hinweise` enthält `{art: "suche_gekappt", durchsucht: 1000, grund: "fenster"}` (1.001 Zeilen, durchsucht 1.000).
- [ ] **4. Zulassung und Zeitgrenze.** Gegeben die Ausgangslage, dann gilt:
  - `/api/aufgaben/999/…/nachfolger` ergibt 404;
  - `kd:<M1:7>` an #1 ergibt 404 `{fehler, zustand: "auf_zweig"}`;
  - ein Verweis, der nicht an der Karte steht, ergibt 404 `{fehler, verweis}`;
  - `kd:main` und ein Präfix mit 6 Zeichen ergeben 400;
  - eine defekte Aufgabendatei ergibt 423.
  - Gegeben ein `git`, das `patch-id` 60 s festhält, dann kommt nach höchstens 15 s 503 `{fehler}` ohne `kandidaten`.
  - Kein Aufruf braucht `X-KanbanD-Wer`.
- [ ] **5. Nur lesen, nie Inhalt.** Gegeben alle Aufrufe aus AK 2–4, dann gilt:
  - Keine Antwort enthält einen Schlüssel `patch`, `pfad` oder `dateien`, die Texte `a.txt`, `b.txt` oder `bild.png` und den Titel von G („Zeile zwei anders ändern“).
  - `GET /api/aufgaben/1/diff?commit=kd:<K'>` ergibt 404, bis ersetzt ist.
  - `git status --porcelain` und die Commit-Zahl sind in R und im Board-Ordner unverändert.
  - Bei 1, 30 und 1.000 Commits im Fenster startet eine Suche höchstens 12 Git-Prozesse (Zähler des Moduls oder `GIT_TRACE`), und die Lesegrenze ist währenddessen mit genau 1 belegt.
- [ ] **6. ETag und Beschreibung.** Gegeben die Antwort für `kd:<K>` an #1, dann gilt:
  - Derselbe Aufruf mit `If-None-Match` ergibt 304.
  - Nach `git branch neu M0` in R ergibt er 200 mit neuem `ETag`. Nach dem Hinterlegen von `kd:<K'>` an #1 ebenso, und dann gilt `an_der_karte: true`.
  - Die Endpunktliste unter `/api`, die OpenAPI-Beschreibung und die README „Für Agenten“ nennen den Endpunkt mit den Statuscodes 200, 304, 400, 404, 423, 503 und einem Beispiel „Nachfolger suchen, dann ersetzen“.

### In der Ansicht „Commits“ (nach Freigabe der Zeichnung D0009 `#nachfolger`)

Wortlaute: vom PO entschieden (Z. 455 und Z. 461, zum 409 Z. 460, Kopfzusatz zu „Entfernen“ Z. 465). Sie gelten wörtlich; `<K:7>` und `<K':7>` sind die Kurzform aus sieben Zeichen.

- [ ] **7. Suchen nur auf Klick am verwaisten Eintrag.** Gegeben #1 in der Ansicht „Commits“, dann gilt:
  - Nur der Eintrag `kd:<K>` („auf keinem Zweig“) trägt „Nachfolger suchen“. `kd:<M1>` trägt den Knopf nicht, die Review-Seite von #1 auch nicht.
  - Das Öffnen der Ansicht und „Neu lesen“ lösen kein `GET …/nachfolger` aus.
  - Wenn `sh` den Knopf drückt, kommt genau ein Aufruf. Solange die Antwort gehalten wird, steht „Sucht Commits mit gleichem Patch …“, der Knopf ist gesperrt, und ein zweiter Klick löst keinen zweiten Aufruf aus.
  - Danach steht am Eintrag „1 Commit mit gleichem Patch“, daneben „neuester zuerst · „Ersetzen“ trägt ihn an der Stelle von kd:<K:7> ein“. Darunter steht K' mit Kurz-Hash, Titel, Autor, Datum, dem Zweig `main` und „Ersetzen“. Der Knopf hat den zugänglichen Namen „Ersetzen durch kd:<K':7>“ (sichtbares Wort am Anfang, WCAG 2.5.3).
  - „Nachfolger suchen“ bleibt am Eintrag stehen. Drückt `sh` ihn bei angezeigtem Ergebnis erneut, verschwindet das Ergebnis. Bis die Antwort kommt, steht wieder „Sucht Commits mit gleichem Patch …“, und der Knopf ist gesperrt. Es kommt genau ein weiterer Aufruf, danach steht das neue Ergebnis.
  - Für #3 steht am Kandidaten K' die Marke „schon an der Aufgabe“ mit „Verwaisten Verweis entfernen“. Der Kopf heißt dort „1 Commit mit gleichem Patch“, daneben „neuester zuerst · „Verwaisten Verweis entfernen“ nimmt kd:<K:7> von der Aufgabe“, ohne den Zusatz zu „Ersetzen“ (Z. 465).
  - Trägt eine Antwort zwei Kandidaten und nur einer davon `an_der_karte: true` (per `page.route`), stehen beide Zusätze im Kopf, zuerst der zu „Ersetzen“: „neuester zuerst · „Ersetzen“ trägt ihn an der Stelle von kd:<K:7> ein · „Verwaisten Verweis entfernen“ nimmt kd:<K:7> von der Aufgabe“. Für jeden Zusatz reicht ein Kandidat mit dem Knopf.
  - **Zweige am Kandidaten** wie in der Liste (R00205 FA 6, AK 5): Gegeben ein Kandidat mit 10 lokalen Zweigen (per `page.route`), dann stehen die ersten drei Namen und der Knopf „+7 weitere“ (10 − 3) mit `aria-expanded="false"` und dem Namen „7 weitere Zweige zeigen“. Nach der Betätigung gilt `aria-expanded="true"`, der Name „7 weitere Zweige verbergen“, darunter „LOKALE ZWEIGE 10“ mit allen zehn Namen und keine Überschrift „ENTFERNTE ZWEIGE“. Eine zweite Betätigung klappt zu, der Fokus bleibt auf dem Knopf. Mit genau 3 Zweigen gibt es keinen Knopf. Eine neue Suche oder „Neu lesen“ zeigt die Zweige wieder zugeklappt.
  - **Zwei verwaiste Einträge auf einer Karte** (#4 trägt `kd:<S1>`, `kd:<Mg>`, `kd:<E>` und `kd:<B>`, alle verwaist): Es läuft höchstens eine Suche je Aufgabe, und es steht höchstens ein Ergebnis. Solange die Suche an `kd:<S1>` gehalten wird, sind alle anderen „Nachfolger suchen“ der Aufgabe gesperrt (Form nach Z. 216). Ein Klick an `kd:<B>` löst dann keinen Aufruf aus, geprüft nach dem Freigeben der Antwort. Sucht `sh` danach an `kd:<B>`, verschwindet das Ergebnis an `kd:<S1>`, und das neue Ergebnis steht in der Gruppe „Nachfolger von kd:<B:7>“; sie bekommt den Fokus (AK 13).
- [ ] **8. Zustände ohne Ersetzen.** Gegeben die Suche an diesen Einträgen, dann steht:
  - `kd:<S1>`: „Kein Commit mit gleichem Patch auf einem Zweig gefunden. Nach Squash oder einem anders gelösten Konflikt findet die Suche keinen Nachfolger.“ (ADR-0038 Punkt 4, wörtlich);
  - `kd:<Mg>`: „Für einen Merge-Commit sucht kanbanD keinen Nachfolger.“;
  - `kd:<E>`: „Der Commit ändert keine Datei, darum gibt es keinen Patch zum Vergleichen.“;
  - bei `suche_gekappt` mit `durchsucht: 1000` (Antwort per `page.route`): „Die Suche hat nach 1.000 Commits aufgehört; ein Nachfolger kann fehlen.“ (Zahl mit Tausenderpunkt). Derselbe Satz steht für `grund` `fenster`, `vorfilter` und `patch` (Z. 462). Ohne Kandidat steht darunter „Kein Commit mit gleichem Patch auf einem Zweig gefunden.“;
  - bei `kandidaten_weitere: 2`: 10 Kandidaten und „2 weitere Commits mit gleichem Patch sind nicht gezeigt.“; bei `kandidaten_weitere: 1`: „1 weiterer Commit mit gleichem Patch ist nicht gezeigt.“;
  - **Ort der Sätze bei vorhandenen Kandidaten:** Der Satz zu „weitere“ und der Satz zu „gekappt“ stehen in der Gruppe nach der Liste der Kandidaten, nie zwischen Kopf und Liste. Trägt eine Antwort beides (per `page.route`: 10 Kandidaten, `kandidaten_weitere: 1`, `suche_gekappt` mit `durchsucht: 1000`), steht in Dokumentreihenfolge zuerst der Kopf, dann die Liste, dann „1 weiterer Commit mit gleichem Patch ist nicht gezeigt.“, dann „Die Suche hat nach 1.000 Commits aufgehört; ein Nachfolger kann fehlen.“;
  - bei 503: „Der Nachfolger ließ sich nicht suchen: <`fehler` der Antwort> (503).“ mit „Erneut versuchen“, das genau einen weiteren Aufruf auslöst; ohne Verbindung: „Der Nachfolger ließ sich nicht suchen: keine Verbindung zum Programm.“ ohne Zahl (Z. 450), ebenfalls mit „Erneut versuchen“.
- [ ] **9. Ersetzen und Entfernen.** Gegeben `sh` ist gewählt und die Suche an `kd:<K>` von #1 zeigt K'. Wenn `sh` „Ersetzen“ drückt, dann gilt:
  - Es gibt genau ein `POST /api/aufgaben/1/commits/ersetzen` mit `{ersetzungen: [{alt: "kd:<K>", neu: "kd:<K'>"}]}` und keinen Dialog.
  - Die Commit-Zahl steigt um genau 1, mit `sh` als Autor.
  - Die Liste wird einmal neu gelesen und zeigt an Platz 1 `kd:<K'>` auf `main`, ohne „auf keinem Zweig“.
  - Der Statusbereich (`role="status"` im Kopf der Liste) sagt „Ersetzt durch kd:<K':7>.“. Das ist die einzige Ansage dieses Ersetzens: Das Neulesen danach sagt nicht „… Commits gelesen“ (R00205 AK 10).
  - Danach ist `document.activeElement` der Kurz-Hash-Verweis (`a.cl-hash`) in der Zeile von K'. Sein zugänglicher Name beginnt mit „Commit kd:<K':7>“. Der Fokus springt erst, wenn der Satz im Statusbereich steht (AK 13).
  - Für #3 ergibt „Verwaisten Verweis entfernen“ genau ein `DELETE …/commits/kd:<K>` und einen Commit. Danach steht K' allein an der Karte, und der Statusbereich sagt „Verwaisten Verweis kd:<K:7> entfernt.“. `document.activeElement` ist wieder der Kurz-Hash-Verweis in der Zeile von K'.
  - Ohne gewählte Person öffnet der Klick „Ich bin …“ mit Hinweis und sendet nichts (R00003).
- [ ] **10. Fehler, Sperre und Nachbarübergänge.** Gegeben die Suche an `kd:<K>` zeigt K', dann gilt:
  - Hat eine zweite Sitzung inzwischen `kd:<K'>` an #1 hinterlegt, ergibt „Ersetzen“ 409 mit `verweis` gleich `kd:<K>`. Am Kandidaten steht dann „Der Verweis ließ sich nicht ersetzen: kd:<K':7> steht inzwischen schon an der Aufgabe (409).“, ohne den Text des Servers. Der Kandidat wechselt in die Form `an_der_karte` (Marke „schon an der Aufgabe“, Knopf „Verwaisten Verweis entfernen“), und der Fokus steht auf diesem Knopf. Der Satz ist keine Live-Region; er hängt als Beschreibung (`aria-describedby`) an diesem Knopf. Der Kopf heißt danach „1 Commit mit gleichem Patch“, daneben „neuester zuerst · „Verwaisten Verweis entfernen“ nimmt kd:<K:7> von der Aufgabe“: Der Zusatz zu „Ersetzen“ fällt weg, sobald kein Kandidat mehr „Ersetzen“ trägt, und der Zusatz zu „Entfernen“ kommt dazu (Z. 465). Es geht kein `DELETE` hinaus, und die Aufgabendatei bleibt byte-gleich. Erst der Klick darauf ergibt genau ein `DELETE …/commits/kd:<K>` und einen Commit (weiter wie AK 9).
  - Jeder andere 409, etwa mit einem anderen `verweis` oder ohne `verweis` (per `page.route`), zeigt die allgemeine Form „Der Verweis ließ sich nicht ersetzen: <`fehler` der Antwort> (409).“. Der Kandidat behält „Ersetzen“, und der Fokus bleibt auf dem Knopf. Der Satz steht in einer Live-Region (`role="status"`), die schon vor dem Satz im Dokument steht.
  - Bei defekter Aufgabendatei steht die allgemeine Form mit (423). Die Datei bleibt byte-gleich, und der Fokus bleibt auf dem Knopf. Für „Verwaisten Verweis entfernen“ lautet die Form „Der Verweis ließ sich nicht entfernen: <`fehler` der Antwort> (<Status>).“
  - Solange „Ersetzen“ auf die Antwort wartet, sind alle „Ersetzen“ und „Verwaisten Verweis entfernen“ dieser Suche gesperrt, dazu jedes „Nachfolger suchen“ der Aufgabe, in der Form nach Z. 216. Ein zweiter Klick ergibt keinen zweiten Aufruf und keinen zweiten Commit.
  - Wechselt `sh` während einer laufenden Suche in die Ansicht „Inhalt“ und zurück, erscheint keine Fehlermeldung. „Inhalt“ ändert sich nicht, und zurück in „Commits“ steht wieder „Nachfolger suchen“. „Neu lesen“ verwirft ein angezeigtes Ergebnis ebenso.
  - Wechselt `sh` während eines laufenden „Ersetzen“ die Ansicht, entsteht genau ein Commit. Zurück in „Commits“ steht K' an Platz 1.
- [ ] **11. Breite, Themen, Kontrast und Tastatur.** Gegeben die Suche an `kd:<K>` von #1 mit 10 Kandidaten (per `page.route`): je Titel 500 Zeichen mit einem Wort aus 120 Zeichen, je 10 Zweige mit 60 Zeichen, Kandidat 4 mit `an_der_karte: true` (Knopf „Verwaisten Verweis entfernen“), dann gilt:
  - Bei 320, 414, 641, 768, 980, 1100 und 1280 px, jeweils hell und dunkel, ist `documentElement.scrollWidth ≤ clientWidth`, ebenso `scrollWidth ≤ clientWidth` am Aufgabenfenster und am Rahmen der Liste. Kein Element der Ansicht hat eine rechte Kante über `clientWidth`.
  - Bei 641, 768, 980, 1100 und 1280 px ist der Titel jedes Kandidaten mindestens 200 px breit (Breite seines Rechtecks). Bei 320 und 414 px nimmt er die ganze Breite seines Blocks ein (schmale Form aus R00205).
  - Bei allen sieben Breiten liegt der Knopf jedes Kandidaten ganz in dessen Block: Seine linke und rechte Kante liegen innerhalb der Kanten des Kandidaten (`.nf-k` bzw. dem Element, das ihn trägt).
  - Bei 641, 768 und 980 px steht die mittlere Form (FA 12): der Hash links, der Titel rechts daneben, darunter „Autor · Datum“, die Zweige und der Knopf. Bei 1100 und 1280 px steht die breite Form mit dem Titel in seiner Spalte.
  - Die mittlere Form hängt nur an der Breite (Z. 463): Bei 768 px ist die Anordnung bei feinem und grobem Zeiger dieselbe (gleiche Reihenfolge und gleiche linke Kante von Hash, Titel und Knopf). Nur die Zielgröße wechselt.
  - Bei grobem Zeiger ist bei 320, 414 und 768 px jedes Bedienziel mindestens 48 × 48 px groß („Nachfolger suchen“, „Ersetzen“, „Verwaisten Verweis entfernen“, „+n weitere“, „Erneut versuchen“).
  - In beiden Themen hat Text in Ruhe, Zeigen und Fokus mindestens 4,5:1 Kontrast. Der Fokusring und Zeichen ohne Text haben mindestens 3:1. Der Knopfrand ist davon ausgenommen, weil die Beschriftung den Knopf erkennbar macht; er ist `--kd-line-strong` wie an `.btn` (Z. 418).
  - Gesperrte Auslöser (`aria-disabled="true"`) fallen aus der Regel 4,5:1 und aus der Regel für Konturen heraus (WCAG 1.4.3, Z. 459). Für sie gilt die Form nach Z. 216: Schrift und Symbol in `--kd-faint`, Kontur in `--kd-line`, die Fläche bleibt. Der Fokusring ist ungedämpft und hat mindestens 3:1.
  - Tab erreicht in Dokumentreihenfolge „Nachfolger suchen“, danach je Kandidat „+n weitere“ (falls vorhanden) und seinen Knopf. Enter und Leertaste lösen aus. Nach der Suche steht der Fokus auf dem Ergebnis (Rolle `group`, Name „Nachfolger von kd:<K:7>“), nie auf `body`.
- [ ] **12. Liste ohne Suche in der mittleren Form.** Gegeben die Ausgangslage und die Breitendaten von R00205 (dort AK 8: die Karten #4 und #3 von R00205 mit allen Zeilen und einer aufgeklappten Zweigliste), ohne Suche, dann gilt:
  - Bei 641, 768 und 980 px, hell und dunkel, ist `documentElement.scrollWidth ≤ clientWidth`, ebenso `scrollWidth ≤ clientWidth` am Aufgabenfenster und am Rahmen der Liste (`.cl-rahmen`). Der Rahmen scrollt hier nicht mehr quer, anders als R00205 (Nicht-funktionale Anforderung „Breite“) es zwischen 641 und 980 px erlaubt hat. Kein Element der Ansicht hat eine rechte Kante über `clientWidth`.
  - Bei diesen Breiten steht je Verweis links der Hash, rechts untereinander Titel, „Autor · Datum“ und Zustand bzw. Zweige. Der Titel jeder Zeile ist mindestens 200 px breit. Die Spaltenüberschriften (`scope="col"`) und die Zeilenüberschrift aus R00205 AK 10 bleiben im Dokument und vorlesbar, auch wenn sie nicht sichtbar sind.
  - **Grenze an `.rv-abs-rumpf`:** Bei 640 px steht die schmale Form aus R00205, bei 1099 px die mittlere, bei 1100 px die Tabelle mit sichtbaren Spaltenköpfen.
  - Bei grobem Zeiger und 768 px ist jedes Bedienziel der Ansicht („+n weitere“, „Neu lesen“, „Erneut versuchen“, „Alle Änderungen ansehen“, der Kurz-Hash-Verweis) mindestens 48 × 48 px groß.
  - **Regression R00205:** Bei 320, 414 und 1280 px bleibt das Verhalten aus R00205 unverändert. Die Proben in `e2e/tests/r00205-ansicht-commits.spec.js` laufen ohne Änderung an ihren Erwartungen grün.
- [ ] **13. Fokus und Ansage.** Gegeben die Suche an `kd:<K>` von #1, Antworten per `page.route` gehalten, und ein Beobachter (`MutationObserver`), der jeden Text in `[role=status]`, `[role=alert]` und `[aria-live]` der Ansicht mitschreibt, dann gilt:
  - **Fokus nur vom Auslöser:** Bleibt der Fokus während der Suche auf „Nachfolger suchen“, steht er nach der Antwort auf der Gruppe „Nachfolger von kd:<K:7>“. Setzt `sh` den Fokus vor der Antwort auf „Neu lesen“, steht er nach der Antwort weiter dort. Dasselbe gilt für Ersetzen und Entfernen (AK 9, 10): Der Fokus springt nur, wenn er auf dem Auslöser oder auf `body` liegt.
  - **Keine Live-Region am Fokusziel:** Sobald die Gruppe den Fokus hat, enthält sie kein Element mit `role="status"`, `role="alert"` oder `aria-live`. Der erste Satz der Gruppe (Kopf bzw. Satz des Zustands, auch beim 503) hängt als `aria-describedby` an der Gruppe. Ebenso hat der Knopf „Verwaisten Verweis entfernen“ nach dem 409-Wechsel keine Live-Region in seinem Kandidaten.
  - **Live-Regionen nur hier:** „Sucht Commits mit gleichem Patch …“ (Fokus auf dem Auslöser), die Fehler beim Schreiben mit Fokus auf dem Auslöser (409 allgemein, 423) und die Erfolgsmeldung im Kopf der Liste.
  - **Je Suche höchstens eine Ansage:** Der Beobachter schreibt je Suche höchstens einen Text mit, „Sucht Commits mit gleichem Patch …“. Je Ersetzen oder Entfernen schreibt er genau einen mit, den Satz des Erfolgs bzw. des Fehlers. Beim 409 mit Wechsel schreibt er keinen mit.
  - **Reihenfolge beim Erfolg:** Der Container mit `role="status"` für „Ersetzt durch kd:<K':7>.“ steht schon leer im Dokument, bevor der Text hineinkommt. Der Beobachter sieht erst den Knoten, dann den Text. Der Fokus wechselt erst, wenn der Text steht.
  - **Zwei verwaiste Einträge (#4):** Den Fokus bekommt die Gruppe des Eintrags, an dem gesucht wurde („Nachfolger von kd:<B:7>“), nie die eines anderen Eintrags.

## Betroffene Verzeichnisstruktur

- `src/git/arbeitsrepo.rs`: achter `Befehl::PatchId` (Zuordnung in `erzeugt_diffs`, `schalter`, `liefert_teil`, `einzige_form`). `diff_tree_viele` und `erreichbar` werden wiederverwendet.
- neu `src/dienst/nachfolger.rs` neben `commits_lesen.rs`: Zulassung, Fenster, Vorfilter, Patch, `patch-id`, Binärschutz, Antwort. Den Zustand rechnet derselbe Helfer wie in der Liste.
- `src/web/mod.rs` (Route neben `GET …/commits`), `src/web/endpunkte.rs`, `src/web/openapi.rs`, `README.md` „Für Agenten“.
- `web/commits.js`: reine Funktion, die die Antwort in Zeilenwerte und Wortlaute deutet. `web/ansicht.js`: Ergebnis am Eintrag zeichnen. `web/app.js`: Aktionen „Nachfolger suchen“, „Ersetzen“, „Verwaisten Verweis entfernen“ über den einen Schreibweg (`warteschlange`, ADR-0025 Regel 6). `web/kd-app.css` nur mit Tokens, dazu die mittlere Form `@media (min-width:641px) and (max-width:1099px)` für die ganze Ansicht „Commits“ (`.cl-rahmen`, `.cl-tab`, Ergebniszeile).
- Tests: neu `tests/nachfolger_dienst.rs` (echtes Git im Wegwerf-Repository), Erweiterung der Startort-Tests, `e2e/einheit/commits.test.js`, neu `e2e/tests/r00218-nachfolger.spec.js`, Erweiterung `kontrast.spec.js`. `e2e/tests/r00205-ansicht-commits.spec.js` bleibt in seinen Erwartungen unverändert (AK 12).

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Interaction I0208 mit den Features F0160 (Suche per API) und F0161 (in der Ansicht „Commits“), Bubbles B1112–B1123 in `Dokumentation/Planung/kanbanD.md`:

**Umfang** (gezählt, `/planung zaehlen I0208`): I0208 = 12 Bubbles bis Bubble geplant. F0160 hat 6 Bubbles mit 5–9,5 h, F0161 hat 6 mit 5–10 h (4–8 h und B1123 mit 1–2 h), zusammen 10–19,5 h. Das sind Richtwerte der Nachbar-Interactions, für diese Bubbles ungemessen. Die Ist-Zeiten vergleichbarer Bubbles in D0009 (#228–#231, `Schaetzungen/_ist-zeiten.md`) lagen bei 0,1–1,3 h, also am unteren Rand oder darunter.

1. **B1112 Sondierung** (Zeitbox 30 Minuten, tagsüber, Wegwerfcode in der Ablage): AK 1. Bei Halt endet die Karte hier.
2. **B1113 Startort `patch-id`**: nur `--stable`, nur `stdin`.
3. **B1114 Fenster und Vorfilter**: ein `rev-list`, ein `diff_tree_viele --raw`, die Pfadmenge und die neuen Blobs der Binärdateien je Commit.
4. **B1115 Patch und `patch-id`**: höchstens 50 Übrige, Bytegrenze 8 MB, Binärschutz, daraus die Kandidaten.
5. **B1116 Dienst `nachfolger`**: Zulassung, Zustand, Gesamtgrenze, Reihenfolge, 10 und `kandidaten_weitere`, `an_der_karte`, Hinweise.
6. **B1117 Route, `ETag`, Beschreibung, API-Probe**: Zähler, Sicherheit, Zeitgrenze im gestarteten Programm.
7. **B1118 Antwort deuten (rein)**: Zustände, Wortlaute, Zahl mit Tausenderpunkt.
8. **B1123 Ansicht „Commits“: mittlere Form 641–1099 px**: Liste ohne Suche bei 641, 768 und 980 px ohne Querscrollen, Grenze an `.rv-abs-rumpf`, Regression von R00205 bei 320, 414 und 1280 px (AK 12).
9. **B1119 Suchen am Eintrag**: Knopf, lädt, Ergebnis, erneuter Klick, „+n weitere“, Fehler, „Erneut versuchen“, Sperre, zwei verwaiste Einträge, Ansichtswechsel, Fokus nach der Suche.
10. **B1120 Ersetzen und Entfernen**: über den Schreibweg, Fehler am Auslöser, neu lesen, Fokus und Ansage.
11. **B1121 Breite, Ziele, Themen, Kontrast, Tastatur** bei sieben Breiten messen und nachziehen.
12. **B1122 Probe im echten Programm, Gate, abschließen.**

### Hinweise

- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, Anker `#nachfolger` (075156d8), freigegeben mit Änderung (Z. 458). Der Rand `--kd-muted` der Zeichnung (`.nf .knopf`, `.c-zst .nf-such`) wird nicht übernommen. Es gilt die Zeichnung, kein Kriterium aus dem Bild.
- **Gesperrte Form**: po-entscheidungen-archiv Z. 216 (D0002/D0003 `#sperrform`), für jeden gesperrten Schreib-Auslöser.
- **Fuß der Ansicht** „liest nur · gelesen aus dem Repository der Anwendung“ bleibt wahr: Ersetzen schreibt die Karte, nicht das Arbeits-Repository. Der Fuß bleibt unverändert (Z. 461).
- **Kein Live-Nachladen** (R00205 FA 2): Ein angezeigtes Ergebnis kann veralten. Ersetzen meldet das dann über 404 bzw. 409 in der Form aus AK 10, oder antwortet als Wiederholung mit 200 ohne Commit (R00203 FA 6).
- **Nachbarübergänge** (po-entscheidungen Z. 457, Lehre #231): Ansichtswechsel und „Neu lesen“ während der Suche oder des Ersetzens sind Kriterien (AK 10). Eine späte Antwort schreibt nur in den Zustand, der noch derselbe ist (Muster `commitsLesen`, `web/app.js:989`).

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Rust):** Pfadmengen-Vergleich und Binärregel als reine Funktionen; Zerlegung der `patch-id`-Ausgabe; Reihenfolge, 10er-Schnitt, `kandidaten_weitere`. **Unit (Node):** Deutung der Antwort in Wortlaute für alle Zustände.
- **Modul (Rust, echtes Git im Wegwerf-Repository):** erster Test nach ADR-0038 „Durchsetzung“ (K → K'), dazu AK 2–5 und die Startort-Tests (`patch-id` ohne `stdin` oder mit anderem Argument ist ein Fehler).
- **E2E (Playwright, headless):** AK 7–13 gegen das gestartete Programm, Antworten gehalten über `page.route`, ohne Schlafzeiten. Breiten 320, 414, 641, 768, 980, 1100 und 1280 px; die Grenze 640/641 und 1099/1100 px. Ansagen zählt ein `MutationObserver` an den Live-Regionen (AK 13).
- Grenzfälle wie 50/51 Übrige im Vorfilter, das Fenster ab Autordatum − 1 Tag und die Bytegrenzen bleiben Sache des entwicklers. Dazu kommen die Proben des Pre-Mortems aus ADR-0038 (a)–(d).

## Abhängigkeiten

- Abhängig von: [R00203](R00203-commit-verweise-nach-einem-rebase-ersetzen.md) (I0193, #219, erledigt), [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md) (I0194, #211, erledigt), [R00205](R00205-ansicht-commits-im-aufgabenfenster.md) (I0195, #212, erledigt). Dazu ADR-0038 (Vorgeschlagen bis zur Sondierung), ADR-0032, ADR-0025, ADR-0010 und für F0161 die freigegebene Zeichnung D0009 `#nachfolger`.
- Blockiert: keine. Ob die Factory die Suche in `_rebase` nutzt (ADR-0032 N1.8), entscheidet die Factory.

## Offene Fragen

- **An den fachspezialist (über den Director):** **Nachfolger**, **Kandidat**, **Commit-Verweis** und **verwaist** ins Glossar.
- **An den architekt nach der Sondierung:** Status von ADR-0038 auf „Akzeptiert“, oder bei Halt ein Nachtrag.

## Manuelle Vorbereitungstätigkeiten

- Die Sondierung tagsüber einplanen (8–21 Uhr), bei Last ≤ 6.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Seit R00204/R00205 sieht der Mensch, dass ein Verweis „auf keinem Zweig“ steht, aber nicht, wohin der Commit gewandert ist. Er muss den Nachfolger im Log selbst finden und trägt dabei leicht den falschen ein. Sucht kanbanD auf Klick nach Commits mit gleicher `patch-id`, bekommt er nur Commits mit derselben Änderung genannt, keine bloß ähnlichen. Mit „Ersetzen“ zieht er den Verweis über die vorhandene Route an dessen Platz nach. Danach zeigen Liste, Diff und Gesamt-Diff wieder auf den Stand auf dem Zweig. Der Hebel liegt bei der Suche und nicht beim Hinterlegen: Die Factory ersetzt in der Merge-Wache schon selbst (E1). Verwaist bleiben gerade die Verweise, die ein Mensch von Hand rebased hat. Weil die Antwort nur Hash und Metadaten derselben Änderung trägt, öffnet die Suche keinen neuen Weg zu fremdem Code.

## Missing-Docs

- Dass `patch-id` die Kopfzeilen `---`/`+++` mitzählt und wie es Modusänderungen behandelt, beschreibt ADR-0038 aus dem Gedächtnis. Die Sondierung prüft es mit dem Orakel (AK 1, Fall f).

## Notizen

- **Schlank arbeiten (A):** dreizehn Kriterien, sechs für die API und sieben für die Oberfläche, weil der PO beides in diese Karte gelegt hat (Z. 455). Mutanten und Grenzfälle gehören dem entwickler.
- **Optionen** sind in ADR-0038 abgewogen und entschieden: V2 mit T2, statt V1 (Strom als Röhre), V3 (`patch-id` in Rust) und V4 (Autor/Datum/Titel, vom PO verworfen, Z. 456). Für die Oberfläche hat der PO zwischen „nur API“ und „API und Oberfläche“ entschieden (Z. 455).
- **Herleitung der Zahlen:** 1.000, 50, 10, 12, 10 s, 15 s, 4 MB, 8 MB und p95 < 2 s stammen aus ADR-0038. Die 3,0 s für 1.000 Commits über den Strom wurden 2026-11-19 gemessen (ADR-0032 N1.7). 12 − 10 = 2 weitere. 1.001 Zeilen ergeben 1.000 durchsucht. Die Halbierungsfolge 1.000 → 500 → 250 → 200 ist die Lesart des planers für „nie unter 200“: nach 250 kommt 200, nicht 125. Die Lastschwelle ≤ 6 steht in ADR-0038 Punkt 9 und im Auftrag.
- **Nachgezogen 2026-11-21** (Lauf 220-planer-2) nach PO Z. 458–462: Wortlaute fest (AK 7–9), 409 mit Wechsel in die Form `an_der_karte` (FA 10, AK 10), Kontrastregel für gesperrt und Knopfrand (AK 11), die zwei offenen Fragen an den PO gestrichen.
- **Nachgezogen 2026-11-21** (Lauf 220-planer-3) nach PO Z. 463–465 und den Sollte 2, 4 und 5 der UX-Vorprüfung (220-ux-reviewer-1): AK 11 mit sieben Breiten und der Probe aus Muss 1, neu AK 12 (Liste ohne Suche in der mittleren Form) und AK 13 (Fokus und Ansage), FA 12 und 13, Kopfzusatz zu „Entfernen“ (AK 7, 10), erneuter Klick, „+n weitere“, Ort der Sätze, zwei verwaiste Einträge, Fokusziel nach dem Ersetzen, Name „Ersetzen durch kd:<K':7>“.
- **Herleitung der neuen Zahlen:** 641, 768 und 980 px stammen aus Muss 1 der UX-Vorprüfung. Bei 641 und 768 px war die Probe dort gemessen rot. 1100 px ist die erste Breite der breiten Form, 1099 px die letzte der mittleren (`.rv-abs-rumpf`, `web/kd-app.css:1565`, PO Z. 464). Die 200 px Titelbreite stammen aus der Probe der UX-Vorprüfung und aus `minmax(200px,1fr)` der breiten Form; gemessen hat der gestalter in der mittleren Form mindestens 380 px (PO Z. 463). Die Zahl 7 in „+7 weitere“ ist 10 − 3 (R00205 FA 6).
- **Verworfen:** mehrere Suchen gleichzeitig an einer Aufgabe, denn jede belegt einen Platz der Lesegrenze für bis zu 15 s, und zwei offene Ergebnisse brauchten zwei Fokusziele; ein eigener Satz, wenn der Fokus während der Suche woanders steht, denn sein Wortlaut wäre nicht freigegeben, und das Ergebnis steht sichtbar am Eintrag.
- **Verworfen:** ein Zeittest im Gate für p95, denn eine Wanduhr unter Last wackelt (gemeinsam/gelerntes); ein Bestätigungsdialog (PO Z. 455); das Ergebnis über einen Ansichtswechsel zu behalten, denn die Liste wird beim Öffnen ohnehin neu gelesen und ein altes Ergebnis wäre ein zweiter Stand.
