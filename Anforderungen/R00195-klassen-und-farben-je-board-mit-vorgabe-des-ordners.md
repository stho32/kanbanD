---
id: R00195
status: Neu
datum: 2026-11-18
---

# R00195: Klassen und Farben je Board, sonst die Vorgabe des Ordners

## Beschreibung

Herkunft: Karte #200, Betreiber als Product Owner, 2026-11-18: „Und zwar ist mir aufgefallen, dass die Farben / Aufgabenklassen für die Instanz aber nicht für das Board konfiguriert sind. Ich möchte aber, dass sie pro Board festgelegt werden können. In einem aktuellen Projekt habe ich z.B. ein Wartungsboard und für eine große Wartungsaufgabe ein eigenes Board erstellt. Das zweite Board ist nun aber mit den Klassen des ersten Boards versehen und kann keine eigenen haben. Das ist doof, denn die Klassen machen auf dem anderen Board keinen Sinn.“

**Gewünscht:** Jedes Board kann **eigene Klassen** mit eigenen Farben tragen. Ein Board ohne eigene Klassen nimmt wie bisher die Klassen des Ordners; sie heißen ab jetzt **Vorgabe des Ordners**. Es wird nicht gemischt: der **Klassenvorrat** eines Boards ist entweder sein eigener Satz oder die Vorgabe. Die Aufgabe behält ihren einen Schlüssel (`class`); kein Vorgang am Board ändert eine Aufgabe. Kennt der Klassenvorrat des betrachteten Boards den Schlüssel einer Karte nicht, ist die Klasse dort **fremd**: sie wird als Schlüssel in Textform ohne Farbe gezeigt, auch auf der Karte selbst, und nie entfernt.

Technik und Begründung: [ADR-0031](../Dokumentation/ADRs/0031-klassen-je-board-mit-vorgabe-des-ordners.md) (Akzeptiert, Regeln 1–8, Nachtrag N1); Produktentscheidungen: `AI-Team/po-entscheidungen.md`, Zeilen vom 2026-11-18 zu #200. Vorgänger: [R00010](R00010-personen-und-klassen-pflegen.md) (Klassen des Ordners pflegen) — bleibt gültig, der Ordner-Satz ist jetzt die Vorgabe.

> **In Kauf genommen — bei der Auslieferung sagen:** (1) Liegt eine Karte auf zwei Boards mit verschiedenen Klassen, ist ihre Klasse auf einem davon fremd (Text ohne Farbe). (2) Eine ältere kanbanD-Version, die eine Board-Datei mit `classes` schreibt, lässt den Schlüssel weg; die Karten behalten ihre Klasse, der Satz liegt in der Git-Geschichte. (3) Ein Agent, der auf einem Board mit eigenen Klassen eine Klasse der Vorgabe setzt, die das Board nicht führt, bekommt 400 mit Board und Schlüssel in der Meldung.

Zahlt ein auf: [Vision](R00000-vision.md) — „Mehrere Boards über einem Aufgabenbestand“ (Klassen gelten je Board, ohne eigene gilt die Vorgabe des Ordners) und „Aufgaben sind unabhängige Daten“.

## Akzeptanzkriterien

**Ausgangslage:** Ordner mit der Vorgabe `sicherheit` („Sicherheit“, `red`) und `eol` („EOL“, `amber`) in `kanbanD.md`, in dieser Reihenfolge. Zwei Boards, in der Boardliste zuerst „Wartung“ (`wartung`), dann „Umzug“ (`umzug`), beide ohne eigene Klassen. Aufgaben: #1 `sicherheit` auf Wartung; #2 `sicherheit`, #3 `eol` und #4 ohne Klasse auf Umzug. **Eigener Satz von Umzug**, wo ein Kriterium ihn nennt: `phase1` („Phase 1“, `green`), `eol` („Altlast“, `#885500`).

### Datei und API (Feature F0157)

- [ ] **AK 1 Bestand bleibt:** Nach dem Start mit der Ausgangslage entsteht kein Commit und keine Datei ändert sich; ein Kartenzug auf Umzug ändert in `boards/umzug.md` nur die Kartenzeile, es kommt keine Zeile `classes` hinzu; `GET /api/boards/umzug` liefert `klassen: null`; beide Boards zeigen Farben, Legende und Klassenwahl wie vor der Änderung.
- [ ] **AK 2 Eigener Satz steht in der Board-Datei:** `PUT /api/boards/umzug/klassen` mit `{klassen: [{schluessel: "phase1", bezeichnung: "Phase 1", farbe: "green"}, {schluessel: "eol", bezeichnung: "Altlast", farbe: "#885500"}]}` → 200; `boards/umzug.md` trägt im Frontmatter `classes:` mit beiden Einträgen in dieser Reihenfolge und in der Form von `kanbanD.md` (`<schlüssel>: {label, color}`); genau ein Commit, der nur diese Datei ändert; `GET /api/boards/umzug` liefert den Satz; `kanbanD.md`, `boards/wartung.md` und alle Aufgabendateien sind unverändert. Ein Kartenzug und `PUT …/spalten` auf Umzug erhalten `classes`. `{klassen: []}` schreibt `classes: {}` (das Board hat ausdrücklich keine Klassen); `{klassen: null}` nimmt die Zeile heraus, die Datei ist zeichengleich zur Ausgangslage.
- [ ] **AK 3 Ungültiger Satz wird abgewiesen:** doppelter Schlüssel (`eol` zweimal), leere Bezeichnung oder Farbe `lila` (weder Palettenname noch `#rrggbb`) → 400 mit `{fehler}`, kein Commit, Datei unverändert; unbekanntes Board → 404. Es gilt dieselbe Prüfung wie für die Klassen in `PUT /api/einstellungen`.
- [ ] **AK 4 Gültig ist, was ein Board der Aufgabe führt:** Mit dem eigenen Satz auf Umzug: `POST /api/aufgaben {titel, board: "umzug", klasse: "phase1"}` → 201; mit `klasse: "sicherheit"` → 400, die Meldung nennt `umzug` und `sicherheit`; mit `board: "wartung", klasse: "sicherheit"` → 201, mit `klasse: "phase1"` → 400. `PATCH /api/aufgaben/2 {titel: "neu", klasse: "sicherheit"}` (fremde Klasse unverändert mitgeschickt) → 200; `PATCH /api/aufgaben/2 {klasse: "eol"}` → 200. Liegt #3 zusätzlich auf Wartung, sind `sicherheit` und `phase1` beide gültig; eine Aufgabe auf keinem Board nimmt nur Schlüssel der Vorgabe.

### Das Board zeigt seinen Klassenvorrat (Feature F0158)

- [ ] **AK 5 Jedes Board zeigt seine Klassen:** Mit dem eigenen Satz zeigt Umzug in der Legende „Phase 1“, „Altlast“ und „ohne Klasse“, nicht „Sicherheit“ und nicht „EOL“; Karte #3 trägt die Farbe `#885500`, ihr Name nennt „Altlast“; Klassenwahl im Aufgabenfenster, in „Neue Aufgabe“, im Kartenmenü, im Menü mehrerer Karten und die Schnelleingabe `class:` bieten genau `phase1` und `eol`; die Berichte und der Berichtsfilter von Umzug führen „Phase 1“ vor „Altlast“. Wartung zeigt unverändert „Sicherheit“ (rot) und „EOL“, Karte #1 rot.
- [ ] **AK 6 Fremde Klasse ist auf der Karte erkennbar und bleibt erhalten:** Auf Umzug mit eigenem Satz zeigt Karte #2 den Schlüssel `sicherheit` als Text ohne Klassenfarbe; der zugängliche Name der Karte nennt ihn; Karte #4 (ohne Klasse) zeigt keinen solchen Text. Die Klassenwahl von #2 zeigt `sicherheit` als gewählten eigenen Eintrag ohne Farbe; die Berichte führen `sicherheit` hinter den bekannten Klassen. Die Schnelleingabe mit einer Klasse, die der Vorrat nicht kennt, erzeugt keinen Fehler in der Browser-Konsole. `aufgaben/…` von #2 ist nach Einschalten des Satzes, Drauflegen, Bewegen und Herunternehmen zeichengleich (`class: sicherheit`), kein Commit berührt die Aufgabe.
- [ ] **AK 7 Außerhalb eines Boards gilt das erste Board der Aufgabe:** Mit dem eigenen Satz auf Umzug zeigt die Aufgabenliste #3 als „Altlast“ in `#885500`; liegt #3 zusätzlich auf Wartung (in der Boardliste vor Umzug), zeigt sie „EOL“ in `amber`; eine Aufgabe mit `eol` auf keinem Board zeigt „EOL“ in `amber` (Vorgabe).

### Klassen dieses Boards einrichten (Feature F0159)

- [ ] **AK 8 Eigene Klassen beginnen mit einer Kopie der Vorgabe:** Beim Einrichten von Umzug steht ein Abschnitt „Klassen dieses Boards“ mit der Wahl „Vorgabe des Ordners“ (gewählt) oder „eigene Klassen“. Wird „eigene Klassen“ gewählt, stehen „Sicherheit“ (`red`) und „EOL“ (`amber`) im Klassen-Editor, bedienbar wie der Klassen-Editor des Ordners. Ohne weitere Änderung gespeichert: `boards/umzug.md` trägt `classes:` mit beiden, ein Commit, jede Karte von Umzug sieht aus wie vorher, `kanbanD.md` unverändert. Danach `phase1` („Phase 1“, `green`) ergänzt und gespeichert: die Legende von Umzug zeigt „Phase 1“, Wartung nicht.
- [ ] **AK 9 Hinweis vor dem Streichen einer belegten Klasse, in beiden Editoren:** Umzug hat nach AK 8 die eigenen Klassen `sicherheit`, `eol` und `phase1`; wird `sicherheit` im Editor gestrichen, steht **vor dem Speichern** an der gestrichenen Klasse eine Zeile, die die Zahl nennt („1 Karte“, nämlich #2) und sagt, dass diese Karten die Klasse danach als Text ohne Farbe zeigen; kein Bestätigungsfenster, Speichern bleibt ein Schritt. Nach dem Speichern ist #2 fremd (AK 6); wird `sicherheit` wieder angelegt, hat #2 ihre Farbe zurück. Trägt keine Karte die Klasse, steht keine Zeile. Im Klassen-Editor des Ordners gilt dasselbe: in der Ausgangslage `eol` streichen → „1 Karte“ (#3); hat Umzug einen eigenen Satz, zählt #3 nicht mit und es steht keine Zeile.
- [ ] **AK 10 Zurück zur Vorgabe, mit Hinweis:** Umzug hat den eigenen Satz (`phase1`, `eol`), Aufgabe #5 trägt `phase1` und liegt auf Umzug. Wird „Vorgabe des Ordners“ gewählt, steht vor dem Speichern die Hinweiszeile mit „1 Karte“ (#5; #3 zählt nicht, die Vorgabe kennt `eol`). Nach dem Speichern trägt `boards/umzug.md` keine Zeile `classes` (ein Commit), #5 zeigt `phase1` als Text ohne Farbe, #3 wieder „EOL“ in `amber`.

**Zählregel der Hinweiszeile** (AK 9, 10): gezählt werden nicht archivierte Aufgaben, die den Schlüssel tragen und — im Editor eines Boards — auf diesem Board liegen bzw. — im Editor des Ordners — auf mindestens einem Board ohne eigene Klassen oder auf keinem Board liegen. Bei der Rückkehr zur Vorgabe zählen die nicht archivierten Aufgaben dieses Boards, deren Schlüssel der eigene Satz kennt und die Vorgabe nicht.

## Nicht-funktional

- Lesend bleibt das Board bei 10 Boards und 5.000 Aufgaben je Ordner im bisherigen Rahmen (p95 < 200 ms); der Klassenvorrat ist eine Suche in ohnehin gelesenen Dateien, kein weiterer Dateizugriff je Karte.
- Farbe trägt nie allein: die fremde Klasse ist Text, die Hinweiszeile nennt die Zahl in Worten.

## Tests

Rust: Rundlauf der Board-Datei ohne `classes`, mit mehreren und mit `{}` (zuerst am heutigen Stand: der Schlüssel geht verloren); `klassenvorrat` für kein, leeren und gefüllten Satz; Gültigkeit beim Setzen mit Aufgabe auf keinem, einem und zwei Boards samt unverändertem fremdem Wert; `PUT /api/boards/{slug}/klassen` (setzen, `null`, `[]`, 400, ein Commit, Erhalt bei Kartenzug). Unit in `e2e/einheit/`: Vorrat-Funktion in `web/`, Zählregel der Hinweiszeile an der Ausgangslage. E2E (neue Spec `e2e/tests/r00195-klassen-je-board.spec.js`): US-1 bis US-3 am Beispiel; US-4 und US-5 als API- und Dateiprobe.

## Implementierungshinweise

- Die Regeln 1–8 der ADR-0031 gelten wörtlich, samt „Durchsetzung“: außerhalb der beiden Vorrat-Funktionen (`Board::klassenvorrat(&Einstellungen)` und eine in `web/`) greift niemand für Karten eines Boards auf `einstellungen.klassen` zu (`grep -n "einstellungen.klassen" web/ src/`). Heutige Stellen in `web/`: `ansicht.js:178, 618, 630, 632, 1038, 1177, 1818`, `app.js:1192, 3181`.
- Karte heute: `vKarte` (`web/ansicht.js:789`) setzt Farbe und `data-c` nur für eine bekannte Klasse, eine unbekannte sieht aus wie „ohne Klasse“; `kartenName` (`web/kartenname.js:15`) nennt dann nichts. Schnelleingabe: `web/ansicht.js:181` greift ohne Schutz auf `klasse(s.klasse).bezeichnung` zu.
- Der Abschnitt „Klassen dieses Boards“ gehört in „Spalten einrichten“ des Boards (dort steht schon die Bindung `applications`, `web/ansicht.js:2218 ff.`); der Editor ist der vorhandene aus „Einrichten“ (`web/ansicht.js:2201–2203`), nicht ein zweiter.
- **Zeichnung vor dem Bau der sichtbaren Teile** (F0158 Bubble B0964, F0159): `Dokumentation/Wireframes/D0002.dc.html` — Abschnitt „Klassen dieses Boards“ beim Einrichten (beide Wahlen, Hinweiszeile beim Streichen und bei der Rückkehr zur Vorgabe) und die Karte mit fremder Klasse; `Dokumentation/Wireframes/D0001.dc.html` — Hinweiszeile im Klassen-Editor des Ordners („Einrichten“). Wortlaut und Ort der Texte legt die Zeichnung fest; Pflicht aus dieser Anforderung sind Zahl, Folge und „kein Bestätigungsfenster“. F0157 braucht keine Zeichnung.
- **Nicht hinein:** eine Klasse je Lage (ADR-0031 Option C) · Mischen von eigenem Satz und Vorgabe · Umschreiben oder Entfernen fremder Klassen an Aufgaben · Rückfrage beim Drauflegen · Personen oder Signale je Board · ein Upgrade-Schritt über bestehende Ordner · fremde Klassen als eigene Einträge der Legende.
- Am Code gelesen, nicht gefahren.

## Abhängigkeiten

- Abhängig von: R00010 (Klassen des Ordners pflegen, erledigt), R00009 (Spalten einrichten, erledigt), ADR-0031.
- Blockiert: nichts.

## Manuelle Nachbereitungstätigkeiten

Bei der Auslieferung den Absatz „In Kauf genommen“ wörtlich sagen. Das Architektur-Modell (A00004, A00005, A00006, A00009) führt der architekt nach dem Bau nach (ADR-0031, Folgeaufgaben).

## Warum löst diese Anforderung das Problem?

Auslöser: Der Betreiber hat neben seinem Wartungsboard ein Board für eine große Wartungsaufgabe angelegt und sieht dort die Klassen des ersten, die dort keinen Sinn ergeben; eigene kann das zweite Board nicht haben. Bekommt die Board-Datei einen eigenen Klassensatz (X), nimmt jede Stelle, die Karten dieses Boards färbt, benennt oder zur Wahl stellt, den Klassenvorrat des Boards statt der Ordner-Einstellungen (Y); das zweite Board zeigt dann nur seine eigenen Klassen und das erste bleibt, wie es ist (Z). Der Hebel liegt am Board und nicht an der Aufgabe, weil die Aufgabe laut Vision unabhängig vom Board bleibt: so ändert sich kein Aufgabenformat, kein bestehender Ordner wird umgeschrieben, und was auf einem Board nicht passt, bleibt als Text sichtbar statt zu verschwinden.

## Offene Fragen

Keine. Vom planer festgelegt und im Bericht genannt: die Form der fremden Klasse auf der Karte (Schlüssel als Text, Auftrag des product-owner „die Form legt der planer am Bestand fest“) und die Zählregel der Hinweiszeile.

## Notizen

Verworfene Alternativen (ADR-0031): B — Klassen ziehen ganz in die Boards um (Schreib-Upgrade über fremde Ordner); C — Klasse je Lage an der Kartenzeile (neues Aufgabenformat, jede Tür braucht ein Board); D — benannte Klassensätze im Ordner (Indirektion ohne Anlass).
