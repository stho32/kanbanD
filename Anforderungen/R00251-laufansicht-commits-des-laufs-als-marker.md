---
id: R00251
status: In Arbeit
datum: 2026-11-23
---

# R00251: Laufansicht — Commits des Laufs als Marker an ihrer Stelle, Link ins Diff

## Beschreibung

Karte #269, Auftrag des Betreibers vom 2026-11-23 (wörtlich auf der Karte): „Kann man in der Anzeige des Transkripts, wenn git commits gemacht werden, diese ebenfalls referenzieren, so dass man da gleich ins Diff springen könnte?“ Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N7, Punkte 1–9; Produkt `AI-Team/po-entscheidungen.md` Z. 645 (Zuschnitt Scheibe 1), 658 (Wortlaut „Commit nicht an der Karte“), 659 (Commits früherer Phasen nicht in #269), 660 (Satz im Kopf), 662 (Nachzeichnung), 664 (Freigabe D0009 `#laufansicht` Bild 15 mit Änderung: Strich-Knöpfe mindestens `--kd-ziel` hoch, Satz unter der Gesamtdauer).

Wer einen Lauf liest, sieht danach jeden Commit, den die Rolle in diesem Lauf gemacht hat, als eigene Zeile unmittelbar nach dem Schritt, der ihn erzeugte (Ausbaustufe 2: auch als Strich in der Zeitachse). Steht der Commit an der Karte, ist die Zeile ein Link auf die Review-Seite „Ein Commit“ dieses Commits; „Schließen“ führt zurück in die Laufansicht. Steht er nicht an der Karte (frühere Phase, Repository fehlt), sagt die Zeile das in Worten, ohne Link. Die Zuordnung läuft über Titel und Autordatum im Zeitfenster des Aufrufs, nie über den Hash aus dem Transkript: der Hash im Transkript ist der des Worktrees und stimmt nach dem Rebase der Merge-Wache nicht mehr.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): Commits und Läufe sind zwei Seiten derselben Spur; der Marker verbindet beide, nur lesend (Nicht-Ziel „Kein Git-Client“ bleibt gewahrt).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“; Ansicht „Commits“)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) (ersetzt die Insel der Einträge nicht)

## Geschäftlicher Nutzen

Gezählt in ADR-0041 N7 „Belegt“ (5 Karten, alle Transkripte): 89 Aufrufe mit `git … commit`, davon 86 mit `-q`, also ohne Ausgabezeile; 53 von 53 Kartencommits mit Transkript liegen mit ihrem Autordatum im Fenster ihres Aufrufs, und ihr Titelanfang steht im Befehl. Heute muss der Leser den Titel aus dem Befehl abschreiben und in der Ansicht „Commits“ suchen; danach ist der Diff einen Klick entfernt, an der Stelle, an der er entstand.

## Funktionale Anforderungen

1. **Zuordnung** (N7 Punkt 2): Gerechnet wird je Schritt mit `name` `Bash`, dessen Aufruf und Ergebnis eine gültige `zeit` tragen. Fenster: `floor(zeit Aufruf) ≤ autordatum ≤ floor(zeit Ergebnis) + 1` in Sekunden; ein Aufruf ohne Ergebnis hat das Fenster bis zur `zeit` des nächsten Eintrags mit Zeit. Ein Commit der Karte ist einem Schritt **zugeordnet**, wenn sein Autordatum im Fenster liegt **und** die ersten `min(60, Länge)` Zeichen seines Titels (roh) als Teilstring im Befehl stehen (`command` des JSON, sonst der Text; Befehle über 64 KiB werden nicht durchsucht). Ohne Titel-Treffer gilt er nur, wenn genau ein Commit im Fenster liegt, genau ein Schritt, der `git commit` aufruft (Nacharbeit 1: `git`, nur globale Optionen, dann `commit` — nicht `pre-commit`, kein Kommentar, kein `git log … commit`), dieses Fenster hat, dieser Schritt kein `--amend` trägt und der Commit keinem anderen Schritt zugeordnet ist. Ein Commit gehört höchstens einem Schritt (Titel-Treffer vor Rückfall, bei Gleichstand der frühere Schritt); mehrere Commits eines Schritts stehen nach Autordatum, bei gleicher Sekunde nach der Stelle des Titels im Befehl, sonst nach der Reihenfolge der Karte.
2. **Ohne Treffer kein Link**: Hook-Abbruch (kein Commit), `--amend`, `-C`, `cherry-pick`, `rebase` (Autordatum außerhalb des Fensters) bekommen keinen Marker aus der Karte. Ein Aufruf, dessen `git commit` unter seinen Argumenten `--amend` trägt, bekommt gar keinen Marker, weder Link noch Text, und vergleicht keine Titel (Nacharbeit 1, PO Z. 712); `--amend` anderswo im Befehl (etwa in einem Heredoc) zählt nicht.
3. **Text-Marker aus der Belegzeile** (N7 Punkt 3, Z. 658; Nacharbeit 1, PO Z. 713): Ein Schritt ohne Zuordnung, der `git commit` aufruft (FA 1, ohne `--amend`), bekommt einen Text-Marker, wenn sein Ergebnis eine einzeilige Bestätigung mit Hex-Wort trägt — `[<zweig> <hex7–40>] <titel>` oder `<hex7–12> <titel>`, Hex nur `[0-9a-f]` — und dieser Titel (mindestens 12 Zeichen) im Befehl steht. Jede andere Zeile (Großbuchstaben, Nicht-Hex, Ausgabe eines Hooks, `git log` mit Nachrichtentext) ergibt keinen Marker. Er zeigt Kurzhash, Titel und den Satz „Commit nicht an der Karte“; er ist nie ein Link.
4. **Daten** (N7 Punkt 4): `GET /api/aufgaben/{nr}/commits` trägt je Eintrag mit `zustand` `auf_zweig` oder `verwaist` zusätzlich `autordatum` (Epoch-Sekunden, ganze Zahl); bei den übrigen Zuständen fehlt das Feld. Kein neuer Git-Aufruf, kein neues Datenformat in der Karte.
5. **Anfrage und Kopf** (N7 Punkt 4, Z. 660, 664 (b)): Die Laufansicht fragt `GET …/commits` zugleich mit dem Transkript und zeichnet einmal, wenn beide da sind, die Commits scheiterten oder die Antwort 2 s überschritt; dann ohne Zuordnung, Text-Marker bleiben, eine spätere Antwort wird verworfen. Scheitert die Anfrage oder überschreitet sie die Frist, steht im Kopf unter „Werkzeuge … · Denken …“ in der Kachel Gesamtdauer der Satz „Commits der Karte nicht lesbar“, gedämpft, ohne Fehlerrot, ohne `role` und ohne `aria-live`. Der Satz steht auf jeder Breite in der Lesereihenfolge dort, wo er zu sehen ist: im DOM unmittelbar nach „Werkzeuge … · Denken …“ in derselben Kachel, ohne Umstellung durch `order`, `float` oder absolute Lage (UX-Vorprüfung S6). Der Lauf ist kein Fehlerbild. Ein Wechsel der Kennung und das Verlassen brechen beide Anfragen ab.
6. **Marker-Zeile und Link** (N7 Punkt 5, 6; Z. 645 (2)): Die Marker-Zeile steht unmittelbar nach der Schrittzeile, nicht in deren aufgeklappten Teilen, und ist bei jedem Filter sichtbar. Link-Fassung: ein echtes `<a href>` auf „Ein Commit“, das das Wort „Commit“, den Kurzhash (`hash.slice(0, 7)` des Karteneintrags) und den Titel aus der Karte umschließt; sein zugänglicher Name ist „Commit <kurzhash> <Titel>“ (UX-Vorprüfung S4; D0009 Bild 15 setzt das Wort vor den Link — Frage 3 an den product-owner, bis zur Antwort gilt dieser Satz). Die Adresse entsteht nur über `reviewAdresseBilden` mit dem **Verweis der Karte**, nur bei `zustand` `auf_zweig` oder `verwaist` und `verweis` nach `VERWEIS_FORM`. Linksklick öffnet wie `reviewOeffnen` (ein Verlaufseintrag), Strg- und Mittelklick eine neue Registerkarte. „Schließen“ der Review-Seite führt zurück in die Laufansicht, wenn sie von dort geöffnet wurde.
7. **Zeitachse** (N7 Punkt 6, Z. 664 (a), Z. 691; UX-Vorprüfung M1, M2, S1, S2, S3, S5; **Ausbaustufe 2** nach „Zuschnitt“, B1327): Je Stelle ein Strich über den Fächern an der kumulierten Dauer bis zum Ergebnis des Schritts (derselbe Maßstab wie die Fächer), beschriftet mit dem Kurzhash; mehrere Marker an derselben Stelle werden ein Strich „<n> Commits“.
   - **Verdichtung nach Abstand** (M1): von links nach rechts geht ein Strich in den vorigen Knopf auf, wenn ihre Mitten weniger als 24 px auseinander lägen oder ihre Beschriftungen sich überschneiden würden (Mitten näher als die halbe Summe der Beschriftungsbreiten); der zusammengefasste Knopf steht an der Stelle seines ersten Strichs und heißt „<n> Commits“, n = Summe der Marker. Danach liegen die Mitten benachbarter Strich-Knöpfe mindestens 24 px auseinander, Knöpfe mit Beschriftung mindestens um die Beschriftungsbreite, und keine Beschriftungen überschneiden sich — bei 320 px wie bei 1280 px. Unabhängig davon höchstens 100 Striche.
   - **Zugänglich** (M2): Die Strich-Knöpfe (`.lv-ckb`) stehen in einer Gruppe `role="group"` mit dem Namen „Commits der Zeitachse“ neben dem Bild der Zeitachse (`role="img"`), nie darin. Name eines Knopfs „Commit <kurzhash>, zur Zeile springen“, verdichtet „<n> Commits, zur ersten Zeile springen“; der Name enthält den sichtbaren Text.
   - **Tastatur** (S1): Die Gruppe ist ein einziger Tab-Stopp (wandernder `tabindex`: der aktive Knopf `0`, alle anderen `-1`); Pfeil rechts/links wechselt zum nächsten/vorigen Strich, Pos1/Ende zum ersten/letzten. Vom letzten Bedienelement vor der Zeitachse sind es höchstens 2 Tabs bis zum ersten Schritt, gleich wie viele Striche es gibt.
   - **Sprung** (S2, S3): Ein Knopf springt zu seiner Marker-Zeile, ein verdichteter zur ersten seiner Marker-Zeilen (`data-act`, `scrollIntoView`; nie `href="#…"`); die Marker-Zeile (`.lv-cm`, `tabindex="-1"`) trägt danach den Fokus mit sichtbarem Fokusumriss, die Adresse bleibt gleich. Bei `prefers-reduced-motion: reduce` springt die Ansicht ohne weiches Scrollen. Der Fokusumriss eines Strich-Knopfs ist vollständig sichtbar, nicht vom Balken, der Zeitachse oder dem Seitenrand abgeschnitten.
   - **Zielfläche** (Z. 664 (a)): jeder Strich-Knopf mindestens `--kd-ziel` in der Höhe (`min-block-size`) auf jeder Breite; die Breite bleibt wie gezeichnet.
   - **Legende und Lesetext** (Z. 691, S5): Die Legende nennt „Commit“ nur, wenn der Lauf mindestens einen Strich hat. Der Lesetext der Zeitachse endet dann mit „, <n> Commits“, bei genau einem Marker „, 1 Commit“ (n = Zahl der Marker). Ein Lauf ohne Strich zeigt Zeitachse, Legende und Lesetext byte-gleich wie vor dieser Anforderung.
8. **Zustände** (N7 Punkt 7): `fehlt`, `repository_fehlt`, `anwendung_unbekannt`, `unlesbar` werden nie zugeordnet; höchstens ein Text-Marker nach FA 3 entsteht.
9. **Grenzen** (N7 Punkt 8): höchstens 500 Commits der Karte (Grenze der Antwort, `HOECHSTZAHL_COMMITS`), höchstens 1.000 Marker je Lauf, die ersten 1.000 in der Reihenfolge des Laufs. Darüber steht im Kopf wörtlich „Mehr als 1.000 Commits im Lauf, markiert sind die ersten 1.000.“ (Z. 690), gedämpft, ohne `role` und ohne `aria-live`, an der Stelle von „Commits der Karte nicht lesbar“; treffen beide zu, stehen beide, je eine Zeile, erst „Commits der Karte nicht lesbar“, dann der Satz der Grenze. Konstanten in `web/lauf-commits.js`.
   - **Grenze der Vergleiche** (Nacharbeit 1, Security-Review Muss 2, PO Z. 710): höchstens `COMMIT_GRENZEN.vergleiche` = 10.000 Titelvergleiche (Paare Schritt × Commit im Fenster) und `COMMIT_GRENZEN.vergleichsZeichen` = 16.777.216 dabei durchsuchte Zeichen der Befehle je Lauf, gezählt und gebucht an einer Stelle (`vergleichBuchen`). Gemessen am 2026-11-23 an allen 296 echten Läufen mit Transkript (Board kanbanD, 27 Karten): höchstens 11 Vergleiche und 14.728 Zeichen, alle vollständig zugeordnet. Würde ein Vergleich eine Grenze überschreiten, endet die Zuordnung dort: die übrigen Schritte bekommen keinen Link (Belegzeilen werden Text-Marker), es gibt keinen Rückfall, und im Kopf steht wörtlich „Commits nur teilweise zugeordnet — der Lauf ist zu groß.“, gedämpft, ohne `role` und ohne `aria-live`, an derselben Stelle, je eine Zeile in der Reihenfolge „nicht lesbar“, „teilweise“, Grenze der Marker.
   - **Budget der Titel** (Nacharbeit 1, Security-Review Muss 1, PO Z. 709): Titel von Link- und Text-Markern gehen durch `zeichenBuchen` gegen dasselbe Budget des Laufs wie jeder andere fremde Text (1.000 je Text, 10.000 je Lauf, R00221 FA 10); gezeichnet wird nur Gebuchtes, der Rest steht als „… und n weitere Steuerzeichen“.

## Nicht-funktionale Anforderungen

- **Sicherheit** (Label `sicherheit`, N7 Q2, Review-Punkt `security-reviewer`): Befehl, Ergebnis, Belegzeile, Titel und Hash aus dem Transkript sind fremder Text. Aus dem Transkript fließt keine Zeichenkette in `href`, `title`, `data-*` oder eine Anfrage; der einzige Linkbau ist `reviewAdresseBilden` mit einem Wert aus `a.commits`. Text aus dem Transkript wird nur als Text gezeigt (`esc`, `sichtbarText`), nie ausgeführt.
- **Leistung** (Label `leistung`, N7 Q4, Punkt 8, 9; Lehre „Grenzen, die Arbeit begrenzen“): Die Zuordnung sucht je Schritt das Fenster in der nach Autordatum sortierten Liste (O(log n)) und prüft nur dessen Treffer. Gate ist ein **Zähler** der Titelprüfungen (AK 10), nicht die Wanduhr. Beobachtung im Bericht des entwicklers (kein Gate): Zuordnung 5.000 Schritte × 500 Commits unter 50 ms; Zeichnen höchstens 300 ms nach der späteren der beiden Antworten für 30 Commits und den größten echten Lauf; Zeit von `GET …/commits` bei 30 Commits (heute 245 ms bei 16 Commits, Last 3,3, N7 „Belegt“). Stufe 2 (`?felder=zuordnung`) nur, wenn beide Schwellen nach N7 Punkt 9 überschritten sind; nicht in dieser Anforderung.
- **Zugänglichkeit**: Marker und Striche tragen Text, nicht nur Farbe; Text ≥ 4,5 : 1, Strich mit Rand ≥ 3 : 1 (Stufe 2) (gemessen vom gestalter, `gemeinsam/scratchpad/ges-269/kontrast.txt`); der Satz im Kopf wird nicht angesagt.
- **Architektur** (Review-Punkt `architektur-reviewer`): Zuordnung nur in `web/lauf-commits.js` (rein, Browser und Node, ohne DOM und `fetch`); `web/lauf.js` zeichnet nur; kein Weg, der den Hash des Transkripts in eine Adresse bringt.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über Git und die API wie in R00244: das Arbeits-Repository der Anwendung `kd` bekommt die Commits mit `GIT_AUTHOR_DATE` wie `e2e/tests/commits-hilfen.js`, die Verweise stehen an Aufgabe #1, die gz-Datei erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/1/transkripte` ab; Unit-Proben in Node). Mensch `sh`, Browser headless (Chromium) in `Europe/Berlin`, Board `fabrik` mit `record-transcripts: true`. Datum 2026-11-22 (der Server lehnt Zeitpunkte in der Zukunft ab). Alle Inhalte erfunden.

**Commits** (Autordatum, Ort):

| Name | Titel | Autordatum | an Aufgabe #1 |
|---|---|---|---|
| C1 | `[R00999] B0001: Zähler zuerst` | 11:00:13 | ja, nach Rebase als C1′ (neuer Hash, gleiches Autordatum) |
| C2 | `[R00999] B0002: Zähler zeichnen` | 11:00:31 | ja |
| C3 | `[R00999] B0003: Grenze prüfen` | 11:00:31 | ja |
| C4 | `[DOC] Anforderung angelegt` | 11:00:40 | **nein** (frühere Phase), Hash `e5f6a7b` nur im Transkript |
| C5a | `[R00999] B0004: Nacharbeit` | 11:01:05 | ja |
| C5b | `[R00999] B0004: Nacharbeit` | 11:01:39 | ja |
| C6 | `[R00999] B0006: von Hand` | 11:00:45 | ja (kein Aufruf im Lauf) |

**T17** = `entwickler@2026-11-22T11:00+01:00` in Aufgabe #1 (alle Aufrufe `name` `Bash`, `command` im JSON):

| Nr | art · Zeit | Inhalt |
|---|---|---|
| 1 | nachricht · 11:00:00 | „Projekt: /w/demo“ |
| 2 | aufruf · 11:00:10.400 | `git add -A && git commit -q -m "[R00999] B0001: Zähler zuerst"` |
| 3 | ergebnis · 11:00:12.900 | (leer) |
| 4 | aufruf · 11:00:20 | `cargo test -q` |
| 5 | ergebnis · 11:00:29 | `test result: ok` |
| 6 | aufruf · 11:00:30.200 | `git commit -q -F - <<'EOF'`⏎`[R00999] B0002: Zähler zeichnen`⏎`EOF`⏎`git commit -q -m "[R00999] B0003: Grenze prüfen"` |
| 7 | ergebnis · 11:00:31.600 | (leer) |
| 8 | aufruf · 11:00:40 | `git commit -q -m "[DOC] Anforderung angelegt" && git log --oneline -1` |
| 9 | ergebnis · 11:00:41 | `e5f6a7b [DOC] Anforderung angelegt` |
| 10 | aufruf · 11:00:50 | `git commit -q --amend --no-edit` |
| 11 | ergebnis · 11:00:51 | (leer) |
| 12 | aufruf · 11:01:04.500 | `git commit -q -m "[R00999] B0004: Nacharbeit"` |
| 13 | ergebnis · 11:01:05.300 | (leer) |
| 14 | aufruf · 11:01:39.800 | `git commit -q -m "[R00999] B0004: Nacharbeit"` |
| 15 | ergebnis · 11:01:40.200 | (leer) |
| 16 | aufruf · 11:01:50 | `git commit -m "[R00999] B0005: Hook bricht ab"` |
| 17 | ergebnis · 11:01:52 | „Exit code 1“⏎„pre-commit hook exited with code 1“ |
| 18 | nachricht · 11:02:00 | „Ergebnis: bestanden“ |

Zählen und Messen in den Proben (UX-Vorprüfung, Prüfbarkeit): Marker = Zeile `.lv-cm` (trägt `tabindex="-1"`); Strich = Knopf `.lv-ckb` in der Zeitachse; „hat den Fokus“ = `document.activeElement` ist diese `.lv-cm`; „im Blick“ = das Rechteck der Zeile (`getBoundingClientRect`) liegt ganz im Viewport (`top ≥ 0`, `bottom ≤ innerHeight`); „grober Zeiger“ = Browserkontext mit `hasTouch: true` und `isMobile: true`.

### Zuordnung

- [x] **AK 1 Marker an ihrer Stelle, auch mit `-q`, Rechenbeispiel:** Gegeben T17 und die Commits oben, wenn `sh` den Lauf öffnet, dann stehen genau sechs Marker: nach Schritt 2/3 C1′; nach Schritt 6/7 erst C2, dann C3 (gleiche Sekunde, Reihenfolge nach der Stelle des Titels im Befehl); nach 8/9 der Text-Marker zu C4 (AK 5); nach 12/13 C5a; nach 14/15 C5b. Jeder Marker steht unmittelbar nach seiner Schrittzeile, nicht in ihrem aufgeklappten Teil, auch wenn der Schritt aufgeklappt ist. Schritt 4/5, 10/11 (`--amend`), 16/17 (Hook-Abbruch) haben keinen Marker; C6 hat keinen. Mit jedem Filter (auch „nur Fehler“) bleiben alle sechs Marker sichtbar. Rechenbeispiel Fenster: Schritt 2/3 → `floor(10,4) = 10` bis `floor(12,9) + 1 = 13`, C1 (13) liegt darin, 14 läge außerhalb; Schritt 14/15 → 39 bis 41, C5b (39) liegt darin, 38 läge außerhalb.
- [x] **AK 2 Gleiche Titel, Parallelfenster, Rückfall:** Gegeben T17, dann gehört C5a zu Schritt 12/13 und C5b zu 14/15, obwohl beide denselben Titel tragen (das Fenster trennt sie); kein Commit erscheint zweimal. Unit am Modul: zwei überlappende Aufrufe mit je einem Titel ordnen jedem seinen Commit zu; zwei überlappende Aufrufe ohne Titel-Treffer und mit zwei Commits im Fenster ergeben keinen Marker; ein Aufruf, dessen Titel `"`, `$` oder einen Backtick maskiert trägt, bekommt seinen Commit nur, wenn er allein im Fenster liegt und der einzige Schritt mit `commit` darin ist; ein Schritt ohne `name`, ein Nicht-Bash-Schritt, ein Eintrag ohne `zeit` ergeben keinen Marker; ein Aufruf ohne Ergebnis hat das Fenster bis zur nächsten `zeit`.
- [x] **AK 3 Nach dem Rebase der Merge-Wache:** Gegeben C1 wurde auf einen neuen Stand von `main` rebasiert (C1′: neuer Hash, neues Commit-Datum, gleiches Autordatum) und die Karte trägt nur C1′, wenn `sh` den Lauf öffnet, dann zeigt der Marker nach Schritt 2/3 Kurzhash und Link von C1′. Am Server: `GET /api/aufgaben/1/commits` trägt für C1′ `autordatum` `1795341613` (= 2026-11-22T11:00:13+01:00), gleich dem Wert von C1 vor dem Rebase, als ganze Zahl; ein Verweis mit `zustand` `fehlt` hat kein Feld `autordatum` (nicht `null`); alle übrigen Felder sind gleich wie vorher.

### Marker und Link

- [x] **AK 4 Link führt ins Diff und zurück:** Gegeben der Marker zu C2, dann ist er ein `<a href>`, dessen `href` genau `reviewAdresseBilden({basis, slug: 'fabrik', nummer: 1, commit: <Verweis von C2 an der Karte>})` ist; das `<a>` umschließt das Wort „Commit“, die ersten 7 Zeichen des Hashes aus der Karte und den Titel aus der Karte, sein zugänglicher Name ist „Commit <7 Zeichen> [R00999] B0002: Zähler zeichnen“ (S4, Frage 3). Wenn `sh` ihn mit einfachem Linksklick öffnet, zeigt die Review-Seite „Ein Commit“ mit C2; „Schließen“ führt zurück in die Laufansicht desselben Laufs. Strg-Klick öffnet eine neue Registerkarte, die Laufansicht bleibt.
- [x] **AK 5 Text, wenn der Commit nicht an der Karte steht:** Gegeben Schritt 8/9, dann steht der Marker „e5f6a7b [DOC] Anforderung angelegt“ mit dem Satz „Commit nicht an der Karte“, ohne `<a>`, ohne Hover. Gegeben dieselbe Ausgangslage, aber das Repository der Anwendung ist gelöscht (alle Verweise `repository_fehlt`), dann steht nur dieser eine Text-Marker, die übrigen Schritte haben keinen, und der Lauf steht ohne Fehlerbild. Ein Ergebnis `abc1234 kurz` (Titel unter 12 Zeichen) oder eine Belegzeile, deren Titel nicht im Befehl steht, ergibt keinen Marker.
- [x] **AK 6 Satz im Kopf, Frist, Abbruch:** Gegeben T17, wenn `GET …/commits` mit 500 antwortet, dann steht der Lauf vollständig, nur mit dem Text-Marker zu C4, und unter der Aufteilung der Gesamtdauer steht „Commits der Karte nicht lesbar“ in `--kd-muted`, ohne `role` und ohne `aria-live`, keine Fehlermeldung sonst. Antwortet `GET …/commits` erst nach 2,5 s, ist der Lauf vorher gezeichnet (ereignisgenau gemessen: Zeichnen spätestens nach Ablauf der Frist von 2 s), mit demselben Satz, und die späte Antwort ändert nichts. Antwortet es nach 0,5 s, stehen alle sechs Marker und kein Satz. Bei 320 px und bei 1280 px ist der Satz im DOM das nächste Textelement nach „Werkzeuge … · Denken …“ in derselben Kachel, und seine Lage auf dem Schirm folgt dieser Reihenfolge (oberer Rand unter dem von „Werkzeuge …“, keine absolute Lage, kein `order`) (S6). Gegeben zugleich der Fehler von `GET …/commits` und mehr als 1.000 Marker (AK 10, Unit mit 1.200 Belegzeilen), dann stehen beide Sätze, je eine Zeile, erst „Commits der Karte nicht lesbar“, dann „Mehr als 1.000 Commits im Lauf, markiert sind die ersten 1.000.“ Wechselt `sh` die Kennung, während beide Anfragen laufen, werden beide abgebrochen (Abbruchsignal gesetzt) und nichts vom alten Lauf wird gezeichnet.

### Zeitachse

- [x] **AK 8 Bedienbar auf jeder Breite:** Gegeben T17 bei 320 px mit grobem Zeiger und bei 1280 px, hell und dunkel, dann hat jeder Link-Marker eine Höhe der Zielfläche von mindestens `--kd-ziel` (`getBoundingClientRect`); Text der Marker ≥ 4,5 : 1 zum Grund (Strich mit Rand ≥ 3 : 1: Stufe 2); bei 1280 px kürzt ein Titel über die Zeilenbreite mit „…“ (voller Titel im Text des Links für den Lesetext), bei 320 px bricht er um, und die Seite scrollt nicht quer.
- [x] **AK 11 Zeitachse byte-gleich auch mit Markern (Ausbaustufe 1, UX-Nachprüfung):** Gegeben T17 mit allen sechs Markern, dann ist das `outerHTML` von `.lv-za` gleich dem Stand vor dieser Anforderung: keine Striche, Legende ohne „Commit“, Lesetext ohne Commits.

#### Ausbaustufe 2 (nicht Teil der Abnahme)

- **AK 7 Striche, Sprung, Tastatur, Lesetext (Ausbaustufe 2):** Gegeben T17 bei 1280 px, dann trägt die Zeitachse fünf Striche: an den Stellen der Ergebnisse 3, 9, 13, 15 je mit Kurzhash und an der Stelle von 7 einer mit „2 Commits“. Lage, Rechenbeispiel: hat ein Lauf 100 s kumulierte Dauer und liegt das Ergebnis bei 25 s, steht der Strich bei 25 % der Breite des Balkens (±1 px). Ein Lauf mit 150 Commit-Schritten an verschiedenen Stellen hat höchstens 100 Striche.
  - **Zugänglich (M2, Probe wörtlich):** *Strich-Knöpfe stehen in einer Gruppe `role="group"` „Commits der Zeitachse“ neben dem Bild; `button.closest('[role=img]') === null`; Name „Commit f9e808a, zur Zeile springen“ bzw. „2 Commits, zur ersten Zeile springen“, enthält den sichtbaren Text.* (In T17 steht statt `f9e808a` der Kurzhash des jeweiligen Commits aus der Karte.)
  - **Sprung:** Klickt `sh` auf „2 Commits“, liegt die Marker-Zeile von C2 (die erste der beiden) im Blick und hat den Fokus mit sichtbarem Fokusumriss; die Adresse ändert sich nicht. Mit `prefers-reduced-motion: reduce` ist die Zeile nach dem Klick ohne weiches Scrollen sofort im Blick.
  - **Tastatur (S1):** Vom letzten Bedienelement vor der Zeitachse führt der erste Tab auf genau einen Strich-Knopf der Gruppe, der zweite auf das erste Bedienelement des ersten Schritts (bei 5 wie bei 100 Strichen); Pfeil rechts in der Gruppe führt vom ersten zum zweiten Strich, Ende zum letzten, Pos1 zum ersten; Enter auf dem fokussierten Knopf springt wie ein Klick. Der Fokusumriss eines fokussierten Strich-Knopfs liegt bei 320 und 1280 px ganz innerhalb des Viewports und wird von keinem Vorfahren mit `overflow: hidden` abgeschnitten (S3).
  - **Legende und Lesetext (Z. 691, S5):** Die Legende nennt „Commit“, der Lesetext der Zeitachse lautet „Zeitachse: Werkzeuge …, Denken …, 6 Commits“. Ein Lauf mit genau einem Marker endet mit „, 1 Commit“. Ein Lauf ohne Strich (auch einer mit Text-Marker, aber ohne Zeitachse) zeigt Zeitachse, Legende und Lesetext byte-gleich wie vorher (Vergleich des `outerHTML` von `.lv-za` vor und nach der Anforderung).
  - Mit jedem Filter (auch „nur Fehler“) bleiben alle Striche sichtbar.
- **AK 8, Strich-Teile:** jeder Strich-Knopf hat eine Höhe der Zielfläche von mindestens `--kd-ziel`; Strich mit Rand ≥ 3 : 1 zum Grund.
  - **Dichter Lauf (M1, Ausbaustufe 2, Probe wörtlich):** *Lauf mit 40 Commit-Schritten, gleichmäßig verteilt, bei 320 px mit grobem Zeiger und bei 1280 px: Mitten benachbarter Strich-Knöpfe ≥ 24 px auseinander, Knöpfe mit Beschriftung mindestens Beschriftungsbreite; Näheres zu „n Commits“ verdichtet (n = Summe der Marker). `document.elementFromPoint(Mitte)` liefert genau diesen Knopf; keine Beschriftungen überschneiden sich.* Dazu: die Summe der `n` aller Knöpfe ist 40.
  - Rechenbeispiel der Verdichtung (Beschriftungen je 52 px breit): Striche bei 10, 20, 50, 60 und 130 px → 20, 50 und 60 liegen weniger als 52 px nach 10 und gehen in dessen Knopf auf („4 Commits“ bei 10 px); 130 liegt 120 px nach 10 und bleibt ein eigener Knopf. Zwei Knöpfe, Summe der Marker 5.

### Sicherheit und Leistung

- [x] **AK 9 Fremder Text bleibt Text** (Satz zur Belegzeile ohne Hex geändert durch Nacharbeit 1, PO Z. 713)**:** Gegeben ein Lauf, in dem Befehl, Belegzeile und Ergebnis `"><img src=x onerror=alert(1)>`, `javascript:alert(1)` und U+202E enthalten, und ein Commit der Karte, dessen Titel `<b>x</b>` enthält, dann entsteht kein Element außer den erwarteten, kein `alert`, jedes `href` eines Markers ist genau die Adresse aus `reviewAdresseBilden` mit dem Verweis der Karte, und kein `href`, `title`, `data-*` und keine Anfrage enthält eine Zeichenkette aus dem Transkript; U+202E steht als sichtbare Marke. Eine Belegzeile `ABC1234X [DOC] Anforderung angelegt` (kein Hex) ergibt keinen Marker. Ein Karteneintrag mit `zustand` `fehlt` oder einem Verweis außerhalb von `VERWEIS_FORM` (`../x`, Leerzeichen) ergibt nie einen Link.
- [x] **AK 10 Grenzen und Zähler:** Gegeben 5.000 Bash-Schritte und 500 Commits der Karte, davon je Schritt höchstens 2 im Fenster, dann prüft die Zuordnung höchstens so viele Titel, wie Paare (Schritt, Commit im Fenster) bestehen (Zähler am einzigen Prüfort, gezählt in der Unit-Probe), höchstens 10.000; ein Befehl über 64 KiB wird nicht durchsucht (Zähler 0 für ihn). Gegeben 1.200 zuordenbare Commit-Schritte (Unit, 500 Commits der Karte und 700 Belegzeilen), dann entstehen genau 1.000 Marker (die ersten 1.000 in der Reihenfolge des Laufs) und der Kopf trägt wörtlich „Mehr als 1.000 Commits im Lauf, markiert sind die ersten 1.000.“ (Z. 690); mit genau 1.000 zuordenbaren Commit-Schritten fehlt der Satz. Rechenbeispiel Zähler: 3 Schritte mit 0, 1, 2 Commits im Fenster → 3 Titelprüfungen.

### Nacharbeit 1 (Reviews #269, PO Z. 709–717)

- [x] **AK 12 Budget der Marker-Titel (Security Muss 1):** Gegeben ein Lauf mit einem `git commit -m "<4.000 × U+202E>"` und im Ergebnis 100 bzw. 1.000 Belegzeilen `[main <hex>] <4.000 × U+202E>` mit verschiedenen Hashes (Probe `srev-269/p1.js` wörtlich), dann ist die Zahl der gezeichneten Marken des Laufs gleich der gebuchten und höchstens 10.000, je Titel höchstens 1.000, jeder Marker-Titel endet mit „… und n weitere Steuerzeichen“, kein U+202E steht roh, und es gibt keinen `RangeError` (vorher 104 MB HTML bzw. `RangeError`). Zähler bei 1, 100 und 1.000 Text-Markern; Variante Link-Marker mit Kartentitel voller Steuerzeichen bei 1 und 100.
- [x] **AK 13 Grenze der Vergleiche (Security Muss 2):** Gegeben eine Karte mit 1, 10, 500 gleichen Titeln `a…ab` (59 × „a“, dann „b“) in einer Sekunde und 1, 10, 500, 2.000 Bash-Schritte in dieser Sekunde mit Befehlen aus 4.000 × „a“ (Probe `srev-269/p2.js … adv` wörtlich), dann sind Vergleiche ≤ 10.000 und durchsuchte Zeichen ≤ 16.777.216; „teilweise“ gilt genau dann, wenn vollständiges Vergleichen eine Grenze überschritte. Genau an der Grenze (10.000 Paare bzw. 256 Commits × 65.536 Zeichen) kein Satz, ein Vergleich mehr: der Satz „Commits nur teilweise zugeordnet — der Lauf ist zu groß.“ — im echten Programm mit 20 bzw. 21 Schritten × 500 Commits. Nach dem Abbruch bekommt ein Schritt mit Titel der Karte und Belegzeile nur den Text-Marker, ein einzelner Commit im Fenster keinen Rückfall. Wanduhr nur Beobachtung.
- [x] **AK 14 `--amend` (Code Sollte 2):** `git commit -m "[R1] B1: Erster Titel"` mit Belegzeile, danach `git commit --amend -m "[R1] B1: Erster Titel"` mit Belegzeile (Probe „amend same title -m“, `crev-269/p/probe.js`) → nur der erste Aufruf trägt einen Marker; ein `--amend`-Aufruf allein mit Commit der Karte im Fenster bekommt keinen; `--amend` in einem Heredoc des Befehls hindert den echten `git commit` daneben nicht.
- [x] **AK 15 Text-Marker eng (Code Sollte 3):** Probe „log false positive“ (`git log -1 --format=%B # commit …`), `cat .git/hooks/pre-commit # …` mit `abc1234 <titel>`, Hook-Ausgabe `formatting <titel>`, `echo commit`, `git log --grep commit` → kein Marker; `git commit`, `git -C <pfad> commit`, `git -c x=y commit`, `git --no-pager commit`, `… && git commit` mit `[zweig abc1234] <titel>` → Text-Marker.
- [x] **AK 16 Symbol in der Zeile mit „Commit“ (UX S1):** Gegeben T17 bei 375 px und 320 px mit grobem Zeiger, dann liegt die Oberkante von `.lv-cm .ic` jedes Link-Markers höchstens 8 px neben der Oberkante der ersten Zeile seines Links (gemessen 0 px, vorher 28 bzw. 19 px), die Zielfläche bleibt ≥ `--kd-ziel`, kein Querscrollen.

Grenz- und Leerfälle, bedacht: Lauf ohne Commit-Aufruf (keine Marker, kein Strich, Zeitachse mit Legende und Lesetext byte-gleich — Z. 691, AK 7), Karte ohne Commits (Anfrage liefert `[]`, Text-Marker aus Belegzeilen bleiben, kein Satz im Kopf), Lauf ohne Zeitachse (FA 4 von R00239: Marker-Zeilen ja, Striche nein), Lauf an der Lesegrenze (nur die gelesenen Schritte werden zugeordnet), Live-Ereignis bei offener Laufansicht (Insel samt Markern bleibt stehen, `el.__probe`). Verworfen: Hash des Transkripts als Schlüssel (Z1), Zweig `karte/<nr>` (Z2), Trailer (Z3) — N7 Optionen.

## Betroffene Verzeichnisstruktur

- `web/lauf-commits.js` (neu): `commitMarker(schritte, karte)`, Belegzeile, Grenzen.
- `web/lauf.js`: `schrittHtml` (Marker-Zeile), `laufZeitachseHtml`, `LEGENDE`, Lesetext, `laufKopfHtml` (Satz); `web/app.js`: `laufLesen`, `transkriptLesen` (zweite Anfrage, Frist, Abbruch), Marke `REVIEW_AUS_DER_LISTE` mit Herkunft; `web/index.html` (Skript einbinden); `web/kd-app.css` nur mit Tokens.
- `src/modell/commit_eintrag.rs`, `src/dienst/commits_lesen.rs`, `src/web/openapi.rs`: Feld `autordatum`.
- Tests: `e2e/einheit/lauf-commits.test.js`, `e2e/tests/laufansicht-t17.js` (Fixture), `e2e/tests/r00251-laufansicht-commit-marker.spec.js`, Rust-Test zu `autordatum`, `tests/openapi.rs`.

## Technische Überlegungen

### Ablauf (Vorplanung; welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1322** `autordatum` in der Antwort (Rust, parallel zu 2).
2. **B1323** Zuordnung rein, mit T17 und Zähler.
3. **B1324** Belegzeile, Text-Marker, Grenzen rein.
4. **B1325** zweite Anfrage, Frist, Abbruch, Satz im Kopf.
5. **B1326** Marker-Zeile, Link nur aus der Karte, Rückweg.
6. **B1328** Stil der Marker-Zeilen, Zielflächen, Kontrast, 320 px.
7. **B1329** Probe im echten Programm, Sicherheit, Messprobe, Mutanten, Gate.

**Ausbaustufe 2** (nicht beauftragt, `ausbau`): **B1327** Zeitachse — Striche, Verdichtung nach Abstand, Gruppe mit Namen, Tastatur, Sprung mit Fokus, Legende und Lesetext (FA 7, AK 7, Strich-Teile von AK 8). Bei Aktivierung voraussichtlich zwei Bubbles ab B1330 (Lage und Verdichtung; Gruppe, Tastatur, Sprung).

### Zuschnitt

Mit den Befunden der UX-Vorprüfung (M1, M2, S1–S3, S5) wächst die Zeitachse von einer auf zwei Bubbles, die Karte von acht auf neun (gezählt). Darum wird die Zeitachse als Ausbaustufe 2 abgetrennt, wie im ersten Lauf angekündigt. Ausbaustufe 1 ist für sich auslieferbar: jeder Commit steht als Zeile an seiner Stelle und führt ins Diff (US-1–US-3, US-5, US-6); die Zeitachse bleibt dort byte-gleich wie heute, auch in Läufen mit Commits. Ausbaustufe 2 ersetzt nichts, sie macht dasselbe Verhalten in der Zeitachse sichtbar (US-4). Ob sie in #269 nach Stufe 1 oder als eigene Karte kommt, entscheidet der product-owner (Frage 4).

### Grobentwurf

- `commitMarker(schritte, karte)` → `Map<Schrittnummer, Marker[]>`, Marker `{art: 'link'|'text', verweis?, kurzhash?, titel, zeit}`; die Karte geht nach `autordatum` sortiert hinein.
- `belegzeileLesen(ergebnis, befehl)` → `{hash?, titel}` oder null.
- `COMMIT_GRENZEN = { commits: 500, marker: 1000, striche: 100, befehl: 65536, titel: 60 }`.

### Hinweise

- **Späte Antwort nach der Frist** wird verworfen (einmal zeichnen, ADR-0041 Punkt 4); N7 sagt das nicht wörtlich — Empfehlung des planers, Frage an den architekt nur, wenn der entwickler ein Nachzeichnen für nötig hält.
- **Kennzahl „Commits“ im Kopf** (R00234, aus der Zeile `Commits:` des Berichts) bleibt unverändert; sie zählt, was die Rolle meldet, die Zeitachse zählt Marker (FA 7, Ausbaustufe 2).
- Zuschnitt: siehe „Zuschnitt“ — Zeitachse ist Ausbaustufe 2.
- **Verdichtung nach Abstand** (FA 7, M1) erweitert ADR-0041 N7 Punkt 6 (dort: gleiche Stelle und höchstens 100); die Regel misst Beschriftungsbreiten im Browser, die Zuordnung in `web/lauf-commits.js` bleibt rein. Hinweis an den architekt beim Aktivieren von Stufe 2.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`, Test zuerst je Bubble.

- **Unit (Node):** Zuordnung und Belegzeile mit den Fällen aus N7 „Durchsetzung“ und T17; Zähler (AK 10); Sicherheitsprobe rein (AK 9).
- **Rust:** `autordatum` je Zustand, gleich nach Rebase, Antwortform sonst gleich; OpenAPI.
- **E2E (Chromium, headless):** AK 1, 3–9 an T17, hell und dunkel, 320 und 1280 px; Fristprobe mit verzögert antwortender Route.
- **Mutanten** (in eigener Kopie, je von einem benannten Test getötet): m1 `autordatum` aus dem Commit-Datum (AK 3); m2 Fenster ohne `+ 1` (AK 1, C1); m3 Fenster ohne `floor` unten (AK 1, C5b); m4 Titel-Treffer entfernt, nur Fenster (AK 2, Parallelfenster); m5 ein Commit mehreren Schritten (AK 2); m6 Hash der Belegzeile ohne Hex-Prüfung (AK 9); m7 Grenze 1.000 Marker fehlt (AK 10); m8 Fehler der Commits-Anfrage als Fehlerbild der Laufansicht (AK 6); m9 Hash des Transkripts im Link (AK 3, 9); m10 Titel aus dem Befehl statt aus der Karte im Marker (AK 4); m11 Filter „nur Fehler“ blendet Marker aus (AK 1); m13 lineare Suche über alle Commits je Schritt (AK 10, Zähler); m14 Wort „Commit“ außerhalb des Links (AK 4). Ausbaustufe 2: m12 keine Verdichtung an gleicher Stelle (AK 7); m15 Verdichtung nur an gleicher Stelle, nicht nach Abstand (AK 8, M1); m16 Strich-Knöpfe innerhalb von `role="img"` (AK 7, M2); m17 Legende „Commit“ auch ohne Strich (AK 7, Z. 691).
- **Regression:** R00221, R00234, R00237–R00244 bleiben grün; ein Lauf ohne Marker ist byte-gleich zum Stand vorher (Legende nach Z. 691); in Ausbaustufe 1 ist auch die Zeitachse eines Laufs mit Markern byte-gleich.

## Abhängigkeiten

- Abhängig von: [R00221](R00221-laufansicht-transkript-eines-agentenlaufs-lesen.md) (I0211), [R00239](R00239-laufansicht-zeitachse-filter-blaettern.md) (I0229, Zeitachse), [R00240](R00240-laufansicht-satz-der-eintraege.md) (I0230, `web/lauf-satz.js`, `sichtbarText`), [R00245](R00245-review-seite-commit-leiste-und-verdichteter-commit-kopf.md) (I0235, Review-Seite „Ein Commit“); alle grün. Zeichnung D0009 `#laufansicht` Bild 15 (freigegeben mit Änderung, Z. 664).
- Blockiert: nichts.

## Offene Fragen

Keine, die den Bau aufhält; je Frage gilt bis zur Antwort die Empfehlung.

- ~~Frage 1 (product-owner) — Wortlaut über 1.000 Markern~~: entschieden, Z. 690 (wie empfohlen), eingearbeitet in FA 9, AK 6, AK 10.
- ~~Frage 2 (product-owner) — Legende „Commit“ ohne Commits~~: entschieden, Z. 691 (nur mit Strich, sonst byte-gleich), eingearbeitet in FA 7, AK 7.
- **Frage 3 (product-owner) — Wort „Commit“ im Link** (UX-Vorprüfung S4): D0009 Bild 15 setzt „Commit“ als eigenes Wort vor den Link, FA 6 und AK 4 sagen „Link mit Wort, Kurzhash und Titel“. Empfehlung des ux-reviewer: das Wort steht im Link, zugänglicher Name „Commit <kurzhash> <Titel>“ — ein Link nur aus Hash und Titel ist für Sprachausgabe und Linkliste nicht als Commit erkennbar. Bis zur Antwort gilt die Empfehlung (FA 6, AK 4); die Zeichnung bleibt, die Abweichung ist eine Bau-Eigenschaft.
- **Frage 4 (product-owner) — Zeitachse als Ausbaustufe 2** (siehe „Zuschnitt“): Z. 645 nennt den Marker „im Verlauf und in der Zeitachse“. Empfehlung: #269 baut Ausbaustufe 1; Ausbaustufe 2 (B1327) wird danach als eigene Karte aktiviert, damit die Karte bei sieben Bubbles bleibt und die Zeitachse mit den Befunden der UX-Vorprüfung ohne Zeitdruck gebaut wird. Bis zur Antwort gilt: #269 ohne Zeitachse.

## Manuelle Vorbereitungstätigkeiten

- Keine. T17 und die Commits entstehen im Test.

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 (Modul `web/lauf-commits.js`) und die API-Beschreibung (`autordatum`) nachführen (architekt, N7 Folgeaufgaben).

## Warum löst diese Anforderung das Problem?

Auslöser ist die Frage des Betreibers, ob er aus dem Transkript gleich ins Diff springen kann. Wirkungskette: eine Rolle committet mit `-q` → im Transkript steht nur der Befehl → Titel und Autordatum finden den Commit unter den Commits der Karte, auch nach dem Rebase der Wache → der Marker steht an der Stelle des Schritts und führt mit einem Klick auf „Ein Commit“ → wer den Lauf liest, sieht, was der Schritt geändert hat, ohne zu suchen. Wo der Commit nicht an der Karte steht, sagt der Text das ehrlich, statt einen toten oder falschen Link zu zeigen (Q1 „richtig oder still“).

## Missing-Docs

- Keine.

## Notizen

- Priorität: Mittel (verbindet #253 und #256; keine Funktion fällt aus; PO Z. 645: kein `vorrang`).
- Quellen: Karte #269; ADR-0041 N7 (`e66cb07c`, nach Rebase `5cba9c01`); `AI-Team/po-entscheidungen.md` Z. 645, 658–664; D0009 `#laufansicht` Bild 15 (`3eb327b8`, nach Rebase `bb81b797`).
- Nicht Teil (PO Z. 714): Rufen zwei Schritte binnen weniger als 1,5 s Commits mit gleichem Titel auf, kann der Commit des späteren dem früheren Schritt zugeordnet werden (das Fenster reicht bis eine Sekunde nach dem Ergebnis, der frühere Schritt gewinnt); der Link führt dann auf einen echten Commit gleichen Titels an der Karte.
- Nicht Teil (Z. 645, 659): Commits früherer Phasen als Link (Factory, Vorschlag an den Director), Commits ohne Transkript, `--amend`, `rebase`, `cherry-pick`, Diff-Vorschau, Sprung zurück an die Stelle im Lauf, eigener Filter für Commits, Stufe 2 `?felder=zuordnung`.
- Nicht Teil (Z. 645): Rückweg von der Review-Seite an die Marker-Zeile (UX-Vorprüfung S2, letzter Teil) — Z. 645 schließt den „Sprung von der Review-Seite zurück an die Stelle im Transkript“ aus Scheibe 1 aus; „Schließen“ führt zurück in die Laufansicht (AK 4).
- Nacharbeit 1 (2026-11-23, PO Z. 709–717): FA 1, 2, 3, 9, AK 9, AK 12–16, „Nicht Teil“ (gleicher Titel < 1,5 s); Proben der Reviews `srev-269/p1.js`, `p2.js`, `crev-269/p/probe.js`, UX S1. A00009 führt der architekt nach (Z. 716).
- Überarbeitet 2026-11-23 nach der UX-Vorprüfung (Karte #269, Vorprüfung 1 von 2: M1, M2, S1–S6) und PO Z. 690–692: FA 5, 6, 7, 9, AK 1, 4, 6, 7, 8, 10, Zuschnitt, Mutanten m14–m17, Fragen 3 und 4.
- Entscheidungen des planers: eine Interaction, Ausbaustufe 1 mit sieben Bubbles, Zeitachse als Ausbaustufe 2 (eine Karte, ein Dialogstück, PO-Zuschnitt Z. 645, „Zuschnitt“); Gate der Leistung als Zähler statt Wanduhr (gemeinsames Gelerntes); späte Antwort verworfen (Hinweise).
