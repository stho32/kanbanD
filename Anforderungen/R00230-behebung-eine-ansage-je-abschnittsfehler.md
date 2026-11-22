---
id: R00230
status: Neu
datum: 2026-11-22
ursprung: Bug-Report
ursprungslauf: R00210
---

# R00230: Behebung — ein gescheiterter Abschnitt auf „Alle Änderungen“ wird genau einmal angesagt

## Beschreibung

Karte #245 „Genau eine Ansage in ‚Commits‘ und auf der Review-Seite“, entstanden aus der stehenden Regel des product-owner `AI-Team/po-entscheidungen.md` Z. 481 (a) und (c): Ein Ereignis ergibt genau eine Live-Ansage. Hat eine Ansicht einen Statusbereich, der das Ereignis ansagt, trägt die sichtbare Meldung kein `role="alert"`, kein `role="status"` und kein `aria-live`. Technik: ADR-0018 Nachtrag N4 (Variante B, Commit `ecd2ee6f` auf `karte/245`, vorher `93fcb5f9`). Ergänzt durch PO Z. 515: Die Ladesätze je Abschnitt und je Datei bleiben eigene Start-Ansagen.

**Reproduktion:** Aufgabe #11 (Anwendungen `kd`, `wb`, `xx`) auf `…/aufgabe/11/review` öffnen und den Abschnitt `wb` mit 503 „Antwortbudget …“ enden lassen. **Erwartet:** Für das Scheitern von `wb` gibt es genau eine Ansage, nämlich in `#rv-ansage` („Alle Änderungen der Aufgabe #11: …, ohne Anwendung wb: ließ sich nicht lesen.“), sobald alle Abschnitte entschieden sind. **Tatsächlich:** Zusätzlich sagt die sichtbare Meldung `.rv-abs-f` mit `role="alert"` dasselbe Scheitern an, sobald sie eingefügt wird. Ein Bildschirmleser hört den Fehler zweimal. Dasselbe gilt bei 503 Zeitgrenze, 404 `repository_fehlt`, 500 und ohne Verbindung.

Das ist **falsch gebaut**: R00210 FA 3 und die Ansage-Probe von AK 10 (Z. 178) legen die Ansage in `#rv-ansage` fest, AK 4a und Z. 178 verlangten aber zugleich `role="alert"` am Abschnittsfehler. R00224 FA 1/AK 1 haben diese Rolle für den 404 übernommen. Seit PO Z. 481 widerspricht das der stehenden Regel. Diese Anforderung löst die genannten Teile ab (siehe „Notizen“).

In „Commits“ und auf „Ein Commit“ wird nach der Inventur in N4 heute schon jedes Ereignis genau einmal angesagt. Diese Ansichten laufen hier als Rückfallschutz mit.

Zahlt ein auf: [Vision](R00000-vision.md), „per Tastatur bedienbar, folgt gewohnten Konventionen“ und „Die Arbeit hinter der Karte nachvollziehen“: Wer die Review-Seite mit einem Bildschirmleser liest, hört jeden Fehler einmal und verwechselt ihn nicht mit zwei Fehlern.

### Domänenbezug

Die Review-Seite gehört zum Dialog D0009 „Arbeit hinter der Karte“. Begriffe wie „Abschnitt“, „Ansage“ und „Statusbereich“ sind die aus R00210 und ADR-0018 N4; im Glossar (`Dokumentation/Domaenenwissen/`) steht dafür kein eigener Eintrag.

## Ursachenanalyse

### Root Cause

Belegt am Stand `ecd2ee6f`:

- `web/gesamt.js:358`, `:361`, `:366` (`abschnittFehlerHtml`): Alle drei Fehlerformen (Antwortbudget, 404 `repository_fehlt`, übrige samt Zeitgrenze, 500 und ohne Verbindung) zeichnen `<div class="… rv-abs-f" role="alert">`. Ein eingefügtes `role="alert"` mit Text wird sofort angesagt.
- `web/app.js:1704` setzt `alle.ansage = ansageText(…)` (`web/gesamt.js:128–134`), sobald alle Abschnitte entschieden sind. `web/app.js:1801` zeichnet sie in `#rv-ansage` (`aria-live="polite"`, `aria-atomic="true"`). Damit wird dasselbe Ereignis ein zweites Mal angesagt.
- Kein Test zählt beide Regionen zusammen. `e2e/tests/r00210-alle-aenderungen.spec.js:485` verlangt `role="alert"` ausdrücklich. Die AK-1-Probe in `e2e/tests/r00224-grund-bei-404.spec.js:165–170` prüft nur die Gleichheit der Rolle bei 404 und bei 503.

Ausgeschlossen (Inventur N4): Der Ladesatz `web/gesamt.js:333` (`role="status"`, „Lädt die Änderungen der Anwendung … …“) ist ein eigenes Start-Ereignis (PO Z. 484 S-B, Z. 515) und bleibt. Die Dateimeldungen in `web/diff.js:332–354` sagt `#rv-ansage` nicht an, sie bleiben unverändert. `#commits-status`, `#nf-meld` und `#nf-gruppe` in `web/commits.js` sagen je Ereignis einmal an.

### Betroffene Komponenten

- `web/gesamt.js` `abschnittFehlerHtml` (drei Rückgaben)
- `e2e/tests/hilfen.js`: neue gemeinsame Hilfe `ansagenZaehlen(page)` (N4 Punkt 5)
- Specs, die der Bau umstellt: `e2e/tests/r00210-alle-aenderungen.spec.js:485` (`toHaveAttribute('role', 'alert')`) und die AK-1-Probe in `e2e/tests/r00224-grund-bei-404.spec.js:150–171`
- **Nicht** betroffen: `web/app.js` (`#rv-ansage`, `ansageBehalten`, `reviewAbschnittErneut`), `web/diff.js`, `web/commits.js`, `web/laeufe.js`, `web/lauf.js`, CSS, Wortlaute, Ton, Symbol und Fokus

## Lösungsvorschlag

### Langfristige Lösung

ADR-0018 N4 Variante B: `abschnittFehlerHtml` zeichnet die drei Fehlerformen ohne `role` und ohne `aria-live`. `#rv-ansage` bleibt der einzige Statusbereich für Ergebnis und Fehler der Abschnitte und sagt einmal an, wenn alle entschieden sind. Eine gemeinsame Hilfe `ansagenZaehlen(page)` zählt Ansagen auf eine Weise, die jede künftige Probe übernimmt. Der Review-Punkt aus N4 „Durchsetzung“ gilt für architektur-reviewer, code-reviewer und ux-reviewer.

### Alternative Ansätze

Entschieden in ADR-0018 N4:

- **A, nur die drei Stellen ändern:** Die nächste Ansicht doppelt dann wieder, wie schon viermal zuvor, und außerhalb der Karte prüft es nichts. Verworfen.
- **C, ein seitenweiter Statusbereich:** Er bricht abgenommene Kriterien (R00205, R00218 AK 13, R00219 AK 10, R00210) und braucht für Fenster ohne Statusbereich trotzdem einen Sonderweg. Verworfen.
- **D, Rolle aus einem Flag:** Die Frage wandert nur in jeden Aufruf. Verworfen.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Der Reproduktionstest ist ein E2E-Test im echten Programm (`e2e/tests/r00230-eine-ansage.spec.js`). Die Antwort für `wb` wird mit `page.route` gehalten und über ein Promise freigegeben, ohne Schlafzeiten (Muster `halten` in `r00210-alle-aenderungen.spec.js`). Gezählt wird mit `ansagenZaehlen`, ab der Freigabe. Heute rot sind AK 2–5.

### Code-Extraktion für isoliertes Testing

Die Zählhilfe bekommt eine eigene Probe gegen eine statische Seite (`page.setContent`), siehe AK 1. Eine weitere Extraktion ist nicht nötig, denn `abschnittFehlerHtml` ist rein und in `e2e/einheit/gesamt.test.js` schon erreichbar. Dort reicht eine Zusicherung „kein `role`, kein `aria-live`“ je Fehlerform.

### Regressionstests

- AK 6 („Commits“, „Ein Commit“) mit derselben Hilfe, heute grün
- R00210-, R00224-, R00207- und R00205-Specs mit den zwei umgestellten Erwartungen (AK 8) grün
- alle Tests aller Ebenen grün (Gate)

## Akzeptanzkriterien

**Ausgangslage:** wie R00210 „Ausgangslage“, also #11 mit drei Abschnitten in der Reihenfolge `kd`, `wb`, `xx` (Register `kd` → R, `wb` → S, `xx` → T), dazu #4 für „Commits“ (R00205) und ein Commit-Verweis für „Ein Commit“ (R00207). Mensch `sh`, Browser headless. Antworten für `GET /api/aufgaben/11/diff?anwendung=wb` werden mit `page.route` gehalten und freigegeben. Die fünf **Fehlerfälle F** an `wb` sind:

| Fall | Antwort | sichtbarer Satz in `#rv-a1 .rv-abs-f` (unverändert) |
|---|---|---|
| F1 | 503 `art: antwortbudget` | „Server ausgelastet (Antwortbudget). Die Änderungen der Anwendung wb wurden nicht gelesen. Es wird nicht von selbst wiederholt.“ |
| F2 | 503 `art: zeitgrenze` | „Die Änderungen der Anwendung wb ließen sich nicht lesen: <fehler> (503).“ |
| F3 | 404 `{zustand: "repository_fehlt", grund}` | „Das Repository der Anwendung wb ist nicht erreichbar.“ mit `grund` darunter |
| F4 | 500 `{fehler: "kaputt"}` | „Die Änderungen der Anwendung wb ließen sich nicht lesen: kaputt (500).“ |
| F5 | `route.abort()` | „Die Änderungen der Anwendung wb ließen sich nicht lesen: keine Verbindung zum Programm.“ |

**Zählfenster** (ADR-0018 N4 Punkt 5, PO Z. 515): Es reicht vom Freigeben der gehaltenen Antwort bis zu dem Zeitpunkt, an dem alle Abschnitte entschieden sind und `#rv-ansage` nicht leer ist. Gezählt werden die Einträge von `ansagenZaehlen`. Eine **Ergebnis- bzw. Fehleransage** ist jeder Eintrag, der kein Ladesatz ist. Ein **Ladesatz** ist der Start-Satz eines Abschnitts („Lädt die Änderungen der Anwendung <k> …“) oder einer Datei („Lädt die Änderungen …“, „Wartet, bis …“). Ladesätze sind erlaubt, höchstens einer je in diesem Fenster gestartetem Abschnitt bzw. Datei.

**Rechenbeispiel:** F1 an `wb`. Nach der Freigabe startet `xx`, das ergibt den Eintrag „Lädt die Änderungen der Anwendung xx …“ (Ladesatz 1 von höchstens 1 für `xx`). Wenn `xx` gezeichnet ist, folgt der Eintrag „Alle Änderungen der Aufgabe #11: …, ohne Anwendung wb: ließ sich nicht lesen.“ in `#rv-ansage`. Das sind zwei Einträge, davon eine Ergebnisansage → grün. Heute kommt ein dritter Eintrag aus `.rv-abs-f` (`role="alert"`, Text „Server ausgelastet …“), also zwei Ergebnisansagen → rot.

### Bug behoben

- [ ] **AK 1 Die gemeinsame Zählhilfe (ADR-0018 N4 Punkt 5):** `e2e/tests/hilfen.js` exportiert `ansagenZaehlen(page)`. Ein `MutationObserver` am Dokument verzeichnet jede nicht leere Textänderung in einem Element, das auf `[role=status],[role=alert],[aria-live]` passt, oder in dessen Inhalt. Ebenso verzeichnet er ein eingehängtes Live-Element, das schon Text trägt, je mit Ort (`id` oder Selektor des Live-Elements) und Text. Die Hilfe kann ab einem Zeitpunkt neu zählen (Fensterbeginn). Probe gegen eine statische Seite, je Fall eine erwartete Zahl:
  - Gegeben eine leere Region `aria-live="polite"`, wenn ihr Text auf „A“ gesetzt wird, dann gibt es 1 Eintrag (Ort, „A“).
  - Wenn ein `<div role="alert">B</div>` eingehängt wird, dann gibt es 1 Eintrag.
  - Wenn eine Region geleert wird, dann gibt es 0 Einträge (Leeren zählt nicht).
  - Wenn ein leeres Live-Element eingehängt wird, dann gibt es 0 Einträge.
  - Wenn derselbe Knoten mit unverändertem Text ausgehängt und wieder eingesetzt wird (wie ein Halter in `render()`), dann gibt es 0 Einträge.
  - Wenn ein Text in einem `<span>` innerhalb von `role="status"` geändert wird, dann gibt es 1 Eintrag.
  - Wenn eine Meldung ohne Live-Rolle mit Text eingehängt wird, dann gibt es 0 Einträge.
- [ ] **AK 2 Ein Fehlerfall, eine Ansage, in `#rv-ansage` (Abnahme N4, heute rot):** Gegeben #11 auf „Alle Änderungen“ und `wb` endet je Durchlauf mit einem der Fälle F1–F5. Dann gibt es im Zählfenster genau eine Ergebnis- bzw. Fehleransage. Sie steht in `#rv-ansage` und enthält „ohne Anwendung wb: ließ sich nicht lesen“. Daneben gibt es höchstens einen Ladesatz für `xx` und keinen anderen Eintrag. `#rv-a1 .rv-abs-f` trägt kein `role` und kein `aria-live`. Der sichtbare Satz, Ton, Symbol und „Erneut versuchen“ sind die aus der Tabelle oben und unverändert. Heute: zwei Ergebnisansagen je Fall (rot).
- [ ] **AK 3 Zwei gescheiterte Abschnitte, eine Ansage:** Gegeben #11, `wb` endet mit F2 und `xx` mit F4, beide gehalten und nacheinander freigegeben. Dann gibt es vom Freigeben von `wb` bis zum entschiedenen `xx` genau eine Ergebnis- bzw. Fehleransage, in `#rv-ansage`. Sie nennt beide („…, ohne Anwendung wb: ließ sich nicht lesen, ohne Anwendung xx: ließ sich nicht lesen.“, Text aus `ansageText`). Daneben gibt es höchstens einen Ladesatz für `xx`. Beide `.rv-abs-f` tragen kein `role` und kein `aria-live`. Heute: drei Ergebnisansagen (rot).
- [ ] **AK 4 „Erneut versuchen“ mit erneutem Fehler:** Gegeben AK 2 mit F1, und `sh` drückt „Erneut versuchen“ an `wb`, das Lesen wird gehalten und endet wieder mit F1. Dann gibt es ab dieser Freigabe bis zum gezeichneten Abschnitt wieder genau eine Ergebnis- bzw. Fehleransage in `#rv-ansage` (die Region war beim Druck geleert worden, N4 Punkt 4), sonst keinen Eintrag. Der Fokus steht danach auf „Anwendung wb“ (`#rv-a1-t`, R00210 AK 4a). Dasselbe gilt mit F5. Heute: zwei (rot).
- [ ] **AK 5 Mutante (N4 Abnahme):** Die Mutante „`role="alert"` zurück an `.rv-abs-f`“ (in einer der drei Rückgaben von `abschnittFehlerHtml`) macht AK 2 im zugehörigen Fall rot. Je Rückgabe gibt es eine eigene Mutante: m1 Antwortbudget → F1 rot, m2 404 `repository_fehlt` → F3 rot, m3 übrige → F2, F4 und F5 rot. Die Mutanten laufen in einer eigenen Kopie, nicht im Worktree.

### Nichts anderes ändert sich

- [ ] **AK 6 Rückfallschutz „Commits“ und „Ein Commit“ (heute grün):** Mit derselben Hilfe und je Fall dem Fenster vom Freigeben bis zum gezeichneten Ergebnis gibt es genau eine Ergebnis- bzw. Fehleransage, und zwar in:
  - „Commits“ (#4): Lesen scheitert mit 503 (in `#commits-status`); Suche nach dem Nachfolger scheitert mit 503, während der Fokus vom Auslöser weggewandert ist (in `#commits-status`, PO Z. 488); Schreiben am Kandidaten scheitert mit 409 allgemein und mit 423 (in `#nf-meld`).
  - „Ein Commit“: Diff endet mit 503 und mit 500 (Seitenmeldung `#rv-meld`); Nachladen einer Datei endet mit 503 (Dateimeldung).
  Ein Ladesatz ist auch hier erlaubt, höchstens einer je gestartetem Lesen. Wird eine Erwartung heute rot, ist das ein Befund an diese Karte und kein Grund, das Kriterium zu lockern.
- [ ] **AK 7 Ladesätze bleiben eigene Ansagen (PO Z. 515):** Gegeben #11 ohne Fehler, ab dem Öffnen der Seite. Dann sagt jeder Abschnitt seinen Start höchstens einmal an, in seiner eigenen Region (`.rv-abs-zust`, `role="status"`), und `#rv-ansage` sagt nach dem letzten Abschnitt genau einmal „Alle Änderungen der Aufgabe #11: …“ an. `#rv-ansage` sagt keinen Start an. Heute grün (Wächter).
- [ ] **AK 8 Abgelöste Erwartungen umgestellt:** `e2e/tests/r00210-alle-aenderungen.spec.js:485` erwartet an `.rv-abs-f` kein `role` und kein `aria-live` statt `role="alert"`. Die AK-1-Probe in `e2e/tests/r00224-grund-bei-404.spec.js` (Z. 150–171) prüft bei 404 und 503 je „kein `role`, kein `aria-live`“ und genau eine Ergebnisansage in `#rv-ansage`. Sonst ändert sich keine Erwartung in R00207-, R00210- oder R00224-Specs. Der Zähler in `r00224-grund-bei-404.spec.js:122` darf bleiben (N4 Punkt 5).
- [ ] **AK 9 Bug-Vorlage:** Die Reproduktionstests (AK 2–5) sind ohne Fix rot und mit Fix grün. Der Fehler der Karte tritt im Szenario der User Story nicht mehr auf. Alle Tests aller Ebenen sind grün.

## Implementierungshinweise

- Die drei Rückgaben in `web/gesamt.js:358/361/366` verlieren nur ` role="alert"`. Klassen, Symbol, Ton und `erneut` bleiben.
- `ansagenZaehlen` braucht einen „Halter-Ausschluss“: Ein Knoten, der mit demselben Text an seinen Platz zurückkehrt, zählt nicht. Die Halter in `render()` setzen `#rv-ansage`, `#commits-status` und `#laeufe-status` so wieder ein (`web/app.js:2610–2615`). Ein Vorbild ist der Zähler in `r00224-grund-bei-404.spec.js:122–135`. Er unterscheidet diesen Fall noch nicht.
- Ladesätze lassen sich am Text erkennen („Lädt die Änderungen …“, „Wartet, bis …“) oder an der Klasse der Region (`.rv-abs-zust`, `.df-laedt`, `.df-wartet`). Die Hilfe selbst unterscheidet sie nicht, die Probe tut das.
- Zählt der Ladesatz eines Abschnitts heute mehr als einmal (weil die Insel ihn neu einhängt), ist das eine weitere Doppelung nach derselben Regel (N4 Punkt 1). Sie gehört in diese Karte und ist im Bericht zu nennen. Gelockert wird AK 2 dafür nicht.
- `page.unrouteAll()` nimmt die `KD_MUTANTE`-Route mit (Lehre #232): Nach dem Zurücksetzen der Routen die Mutante neu einsetzen (`routenZuruecksetzen`).

## Offene Fragen

- Keine, die den Bau aufhalten. Die Frage des architekt an den ux-reviewer (Dringlichkeit der Dateifehler: Antwortbudget an der Datei `role="status"`, die übrigen `role="alert"`, N4 „Offen“ b) betrifft keine Doppelung. Sie gehört in die UX-Vorprüfung und ändert diese Anforderung nur, wenn dort entschieden wird, die Dateifehler anzugleichen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Fehler eines Abschnitts wird zweimal angesagt, weil zwei Live-Regionen dasselbe Ereignis tragen: die sichtbare Meldung mit `role="alert"` und der Statusbereich `#rv-ansage`. Ohne die Rolle an der Meldung bleibt nur der Statusbereich, und der sagt einmal an, wenn alle Abschnitte entschieden sind. Wer mit einem Bildschirmleser „Alle Änderungen“ von #11 liest, hört dann „…, ohne Anwendung wb: ließ sich nicht lesen.“ einmal und sieht die Meldung mit „Erneut versuchen“ am Abschnitt. Der Hebel ist die Rolle an der Meldung, nicht der Statusbereich: dieser ist in R00210 abgenommen und nennt alle gescheiterten Abschnitte in einem Satz. Die gemeinsame Zählhilfe macht die nächste Doppelung in jeder Ansicht mit derselben Probe sichtbar, statt mit einem sechsten eigenen Zähler.

## Notizen

- Priorität: Mittel (Barrierefreiheit, die Bedienung selbst wirkt)
- Betroffene Nutzer/Systeme: Mensch mit Bildschirmleser auf der Review-Seite „Alle Änderungen“
- Workaround: keiner. Die zweite Ansage ist redundant, aber nicht falsch.
- **Abgelöst** (über `/anforderung review` mit Notiz nachgezogen, Karte #245): R00210 AK 4a („… und `role="alert"`“) und die Ansage-Probe von AK 10 (Z. 178, „der Abschnittsfehler hat `role="alert"`“); R00224 FA 1 und AK 1 („dieselbe Live-Rolle wie die übrigen Abschnittsfehler“ heißt jetzt: keine). Status und Kästchen dieser Anforderungen bleiben unverändert.
- **Herkunft der Zahlen:** Die fünf Fälle F1–F5 stammen aus ADR-0018 N4 „Abnahme“. Die Fälle in AK 6 sind die aus N4 und gezählt, nicht geschätzt. Die drei Mutanten in AK 5 kommen aus den drei Rückgaben von `abschnittFehlerHtml`.
- Schlank arbeiten (A): neun Kriterien.
