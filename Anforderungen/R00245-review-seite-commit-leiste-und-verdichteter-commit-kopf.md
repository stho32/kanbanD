---
id: R00245
status: Erledigt
datum: 2026-11-23
---

# R00245: Review-Seite — Commit-Leiste und verdichteter Commit-Kopf

## Beschreibung

Karte #256, Scheibe S2 nach ADR-0042 Punkt 5, Reihenfolge 2 von 6 (PO Z. 538), und der freigegebenen Nachzeichnung D0009 `#review-uebersicht` (PO Z. 539, Änderung 1 und 2; Rand der Kacheln Z. 542; Seitenleiste bleibt Z. 544). Wer auf der Review-Seite die Commits einer Aufgabe prüft, wählt jeden Commit mit einem Klick aus einer Leiste unter dem Seitenkopf. Sie ersetzt den Umschalter „Alle Änderungen | Ein Commit“: erster Eintrag „Alle Änderungen“ mit „<n> Commits · +<a> −<b>“, danach je Commit Chips, gekürzter Titel, Zeit und Zeilen. Der Kopf des gezeigten Commits nennt Kennungen aus dem Titel als Chips und zeigt die Zweige verdichtet als „auf main“ mit einem Knopf „+<k> Zweige“.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109): wer in der Abnahme mehrere Commits liest, springt ohne Umweg über „Zurück“ und „Vor“ zum gewünschten Commit und erkennt am Kopf sofort, zu welcher Anforderung und welchem Schritt er gehört.

### Domänenbezug
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md)

## Geschäftlicher Nutzen

Heute führt in „Ein Commit“ nur „Zurück“ und „Vor“ von Commit zu Commit; wer den dritten von vier prüfen will, klickt zweimal und sieht erst am Kopf, welcher Commit es ist. Der Titel steht im Kopf mit allem, was die Commit-Konvention davor setzt (`[R00229] B1187: …`), und die Zweige stehen als Liste aller Namen — bei einer Aufgabe mit Kartenzweigen sind das bis zu zehn Namen, in denen „main“ untergeht. Mit der Leiste sieht der Prüfer alle Commits der Aufgabe mit Anforderung, Schritt, Zeit und Umfang auf einmal und wählt einen mit einem Klick. Der Kopf nennt die Kennungen vorn und den Rest des Titels lesbar dahinter, und „auf main“ sagt, was die Zweigliste meist sagen soll.

## Funktionale Anforderungen

- FA 1: In „Ein Commit“ und in „Alle Änderungen“ steht unter dem Seitenkopf eine Leiste (Navigation „Ansicht der Review-Seite“). Sie ersetzt den Umschalter „Alle Änderungen | Ein Commit“ samt dem gedämpften „Ein Commit“ ohne Ziel. Das Blättern „Zurück“ / „Vor“ (R00207 FA 3) bleibt.
- FA 2: Der erste Eintrag heißt „Alle Änderungen“ und trägt „<n> Commits · +<a> −<b>“ („1 Commit“ bei einem, Zahlen mit Tausenderpunkt, PO Z. 540 (c)). <n> zählt die Commits auf einem Zweig, <a> und <b> sind die Summen ihrer hinzugefügten und entfernten Zeilen aus der Liste der Commits (brutto; die Summe der Seite darunter darf kleiner sein, PO Z. 637).
- FA 3: Danach steht je Commit mit Diff ein Eintrag, in der Reihenfolge der Liste (älteste zuerst, wie das Blättern). Commits ohne Diff (`fehlt`, `unlesbar` und die übrigen ohne Hash) stehen nicht in der Leiste. Ein verwaister Commit steht mit der Marke „auf keinem Zweig“, zählt aber nicht in <n>, <a> und <b> (wie im Gesamtbild, R00210; PO Z. 636). Die Marke steht als Text (nicht nur Farbe) in Zeile 2 nach dem Kurz-Hash, und der Name des Eintrags endet „…, auf keinem Zweig, zählt nicht in den Zahlen von Alle Änderungen“. Das Wort „verwaist“ bleibt dem Band im Kopf und der Seitenleiste.
- FA 4: Ein Eintrag zeigt in dieser Folge: die Chips aus dem Titel (FA 8), den Titel ohne die Chips einzeilig und mit „…“ gekürzt (der volle Titel steht im `title`), den Kurz-Hash mit Anwendung (`kd:b0bea5f`), die Zeit „TT.MM. hh:mm“ in Ortszeit und „+<plus> −<minus>“. Fremder Text geht nur über `esc` bzw. `sichtbarHtml` (ADR-0033 Punkt 8).
- FA 5: Jeder Eintrag ist ein echter Verweis auf die bestehende Adresse (`…/review` bzw. `…/review?commit=<verweis>`). Der gezeigte trägt `aria-current="page"`, Fläche `--kd-accent-weak` und 3 px Unterkante `--kd-accent` (D0009). Der Rand der Einträge ist `--kd-muted`, nicht `--kd-line-strong` (PO Z. 542).
- FA 6: Ein einfacher Klick auf einen Eintrag ersetzt den Verlaufseintrag (wie der Umschalter, R00210 N1.1), die Marke „aus der Liste geöffnet“ bleibt, und der Fokus steht danach auf dem gewählten Eintrag der neuen Leiste. Mittel- und Strg-Klick öffnen einen Tab. Der Wechsel liest die Liste der Commits nicht neu. Wählt der Mensch den Eintrag, der schon `aria-current` trägt, bewirkt der Klick nichts: keine neue Zeichnung, kein neuer Verlaufseintrag, Rollstand und Fokus bleiben. Nach der Wahl eines anderen Eintrags sagt genau ein `role=status` „Commit <i> von <n>: <kurz>“ an (wie beim Blättern, R00230), kein zweiter.
- FA 7: Solange die Liste der Commits lädt, steht in der Leiste nur „Alle Änderungen“ mit der gedämpften Zeile „Commits werden gelesen …“ (gleiche Höhe wie sonst) und `aria-busy="true"` an der Leiste; scheitert sie, steht dort „Commits nicht gelesen“; hat die Aufgabe keinen Commit mit Diff, steht dort keine Zeile. Der Eintrag trägt in keinem der drei Fälle Zahlen und kein `aria-current`, wenn die Seite einen Commit zeigt. Die Meldung und „Erneut versuchen“ bleiben wie heute; nach dem Erfolg fällt `aria-busy` weg, und der Fokus liegt nicht auf `body`.
- FA 8: Chips entstehen aus dem Titel durch eine reine Funktion: ein erster Chip aus `^\[([A-Z]+\d*)\]` (z. B. `R00229`, `DOC`), danach höchstens ein zweiter aus `^\s*(B\d+):` unmittelbar dahinter; der Rest des Titels folgt ohne diese Teile. Ein Titel ohne diese Form erscheint unverändert ohne Chips; bliebe nach dem Abziehen nichts übrig, auch (ADR-0042 Punkt 5). Ein Chip ist höchstens 16 Zeichen breit; längere Kennungen kürzt er mit „…“, `title` und Name tragen die volle.
- FA 9: Der Commit-Kopf nennt Kurz-Hash, die Chips und darunter den Titel ohne Chips als Überschrift, dann Autor, Datum, Zeilen und Dateien wie heute. Die Chips stehen im Kopf als Liste mit dem unsichtbaren Vorspann „Kennungen:“. Die Zweige stehen verdichtet: Steht `main` (sonst `master`) unter den lokalen Zweigen der Antwort, lautet die Angabe „auf main“ bzw. „auf master“, und ein Knopf „+<k> Zweige“ („+1 Zweig“) öffnet die heutige Liste aller Namen. <k> ist die Zahl aller Namen (lokale und entfernte Zweige und die `weitere`-Angabe der Antwort) abzüglich des genannten. Ist <k> 0, gibt es keinen Knopf. Sonst gilt die heutige Liste (PO Z. 537, ADR-0042 Punkt 5). „auf keinem Zweig“ bleibt.
- FA 10: Ab 600 px stehen die Einträge nebeneinander und brechen in die nächste Zeile um. Unter 600 px stehen sie untereinander in voller Breite, ein langer Titel kürzt mit „…“, und der Titel im Kopf bricht um (PO Z. 539, Änderung 1; nur Teil S2).
- FA 11: In „Alle Änderungen“ bleibt die Commit-Liste der Seitenleiste neben der Leiste (PO Z. 544).
- FA 12: Der Name eines Eintrags enthält jeden sichtbaren Text des Eintrags (Titel ohne Chips, Zeit, Kurz-Hash) als Teilstring (WCAG 2.5.3) und lautet für Commits „Commit <kurz>, <voller Titel>, <Zeit>, <n> Zeilen hinzugefügt, <m> entfernt“, für den ersten Eintrag „Alle Änderungen, 3 Commits, 318 Zeilen hinzugefügt, 20 entfernt“. Die Leiste enthält eine Liste (`ul`); die Zahl ihrer Einträge ist 1 + Zahl der Commits mit Diff.
- FA 13: Die Leiste ist höchstens so hoch wie 40 % der Fensterhöhe (`max-block-size: 40dvh`, Rückfall `40vh`) und scrollt darin senkrecht; darunter steht der Kopf mit dem Code (PO Z. 635). Das Rollen setzt `scrollTop` der Leiste (nicht `scrollIntoView`); die Seite scrollt dabei nicht. Nach jedem Zeichnen der Leiste (Wahl, Laden, „Erneut versuchen“, Wechsel des Themas) liegt der gezeigte Eintrag ganz im sichtbaren Teil der Leiste; liegt er schon darin, ändert sich der Rollstand nicht. Ohne gezeigten Eintrag („Alle Änderungen“ gewählt) steht die Leiste oben. Der Fokusring jedes Eintrags liegt ganz in der Leiste (Innenabstand oder negativer `outline-offset`). Die Rollleiste bleibt sichtbar, der letzte sichtbare Eintrag darf angeschnitten sein, `overscroll-behavior` bleibt Standard. Alle Breiten.
- FA 14: Hat die Leiste mehr als 8 Einträge, steht als erstes Element der Leiste ein Verweis mit dem sichtbaren Text „Zum Code“, nur bei Tastaturfokus sichtbar; er springt zum Anfang des Codebereichs (Dateien) der Seite, sein Name ist „Zum Code“ (WCAG 2.5.3), er steht in der Tabfolge vor den Einträgen. Bis 8 Einträge gibt es ihn nicht (PO Z. 639).

## Nicht-funktionale Anforderungen

- Benutzerfreundlichkeit: Bei 320 px scrollt die Seite nicht quer (PO Z. 539, Änderung 1). Die Einträge sind mit der Tastatur erreichbar, der gezeigte sagt es an (`aria-current`), und bei grobem Zeiger ist jeder Eintrag mindestens 44 px hoch (`--kd-ziel`). Die beiden Navigationen der Seite (Leiste und Blättern) tragen verschiedene Namen.
- Performance: keine neue Anfrage; die Leiste wird aus der schon gelesenen Antwort von `GET …/commits` gebaut (ADR-0042 Punkt 5).
- Sicherheit: kein neuer Endpunkt, kein neues Feld, kein Prozess. Titel, Zweige, Verweise und Kurz-Hash sind fremder Text und bleiben sichtbar gemacht; ein Chip entsteht nur aus dem Muster von FA 8.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API, Muster `uebersichtBauen` in `e2e/tests/review-hilfen.js`): Wegwerf-Repository R mit Anwendung `kd`, Mensch `sh`, Browser headless mit Zeitzone Europa/Berlin, Commit-Daten mit `+01:00`.

- **K-Leiste** (Aufgabe #5), in dieser Reihenfolge:
  - C1 `[R00229] B1187: Sperrform je Komponente`, 22.11. 03:19, +302 −7, Zweige `main`, `karte/247`, `karte/a`, `karte/b`, `karte/c`, `karte/d`
  - C2 `[R00229] B1188: Mutanten m1–m7 getötet, R00229 Erledigt, WBS und Ist-Zeiten`, 22.11. 03:31, +14 −12, Zweige `karte/247` und entfernt `origin/karte/247`
  - C3 `[DOC] R00229 AK 5: Fokusring je Ansicht`, 22.11. 04:34, +2 −1, Zweige `main` und entfernt `origin/main`
- **K-Rand** (Aufgabe #6 und #7), je einmal:
  - C4 `Ohne Form`, nur auf `main`
  - C5 `[Factory] director: Text` und C6 `[R00229]`, beide auf `main`
  - C7 mit dem Titel `<img src=x onerror=window.pwn=1> "x"` und einem Zweig mit U+202E im Namen (lässt Git das nicht zu, liefert `page.route` die Antwort)
  - C8 nur auf `master` und `x`; C9 auf `main` und `zz01`–`zz11` (die Antwort nennt `main`, `zz01`–`zz09` und `weitere: 2`)
  - C10 mit +1.240 −0 allein in Aufgabe #6
  - V verwaist (Zweig gelöscht) neben C1 und C2 in Aufgabe #7
- **Aufgabe #8**: Commits C1' und C2' in `kd`, W1 in `wb`.

Heute (Stand `75238bd3`) stehen der Umschalter und die Zweigliste, es gibt weder Leiste noch Chips noch „+<k> Zweige“. AK 1–6 sind deshalb rot.

### Leiste

- [x] **AK 1 Leiste statt Umschalter, Zahlen:** Gegeben K-Leiste, wenn `sh` die Review-Seite von C2 öffnet, dann steht unter dem Seitenkopf die Navigation „Ansicht der Review-Seite“ mit vier Einträgen in der Reihenfolge „Alle Änderungen · 3 Commits · +318 −20“, C1, C2, C3; nur C2 trägt `aria-current="page"`; „Ein Commit“ und der Umschalter gibt es nicht mehr. Rechnung: 302 + 14 + 2 = 318, 7 + 12 + 1 = 20. Gegeben Aufgabe #6 mit nur C10, dann steht „1 Commit · +1.240 −0“. Der Name des Eintrags C2 beginnt mit „Commit kd:<kurz>, “, enthält den vollen Titel und nennt die Zahlen in Worten („14 Zeilen hinzugefügt, 12 entfernt“). Der Name des Eintrags „Alle Änderungen“ lautet „Alle Änderungen, 3 Commits, 318 Zeilen hinzugefügt, 20 entfernt“; der Name jedes Eintrags enthält dessen sichtbaren Text als Teilstring, die Leiste enthält eine Liste mit 1 + 3 Einträgen (FA 12). Die Navigation „Commits der Aufgabe, ältester zuerst“ (Blättern) und die Leiste tragen verschiedene Namen. Heute rot.
- [x] **AK 2 Eintrag und Chips:** Gegeben K-Leiste, dann zeigt der Eintrag C1 die Chips „R00229“ und „B1187“, den Titel „Sperrform je Komponente“, „kd:<kurz>“, „22.11. 03:19“ und „+302 −7“; C3 zeigt den Chip „DOC“ und den Titel „R00229 AK 5: Fokusring je Ansicht“. Der Titel steht in einer Zeile, und das `title` des Eintrags trägt den ganzen Titel wörtlich (C1: „[R00229] B1187: Sperrform je Komponente“). Einheitenprobe `commitChips`:
  - `[R00229] B1187: Sperrform` → Chips `R00229`, `B1187`, Rest „Sperrform“
  - `[R00229] Abschluss: B1229, B1230` → Chip `R00229`, Rest „Abschluss: B1229, B1230“ (kein `B…:` am Anfang des Rests)
  - `[DOC] R00229 AK 5: x` → Chip `DOC`, Rest „R00229 AK 5: x“
  - `Ohne Form`, `[Factory] director: Text`, `[r00229] x`, `B1187: x`, `x [R00229] y` → keine Chips, Titel unverändert
  - `[R00229]` → keine Chips, Titel `[R00229]` (nichts bliebe übrig)

  Heute rot.
- [x] **AK 3 Wahl, Blättern, Tastatur:** Gegeben K-Leiste, C2 aus der Liste der Commits geöffnet, wenn `sh` den Eintrag C3 mit einfachem Klick wählt, dann zeigt die Seite C3, nur C3 trägt `aria-current`, der Fokus steht auf dem Eintrag C3 der neuen Leiste, der Verlaufseintrag ist ersetzt (`history.length` unverändert), „←“ führt weiter in die Liste der Commits, und die Liste wurde nicht neu gelesen (Zähler der Anfragen an `…/commits` bleibt 1). Ein Strg-Klick öffnet C3 in einem neuen Tab. „Zurück“ und „Vor“ wechseln den Eintrag mit `aria-current` mit. Wählt `sh` „Alle Änderungen“, dann zeigt die Seite die Ansicht der Aufgabe, `aria-current` steht nur am ersten Eintrag, und der Fokus steht dort. Mit Tab folgen auf den Rückweg die Einträge in der Reihenfolge der Leiste, dann „Zurück“, „Vor“ und „Alle einklappen“; Enter wählt. Wählt `sh` den Eintrag mit `aria-current`, passiert nichts: `history.length`, Rollstand der Leiste und Fokus bleiben, die Seite wird nicht neu gezeichnet. Nach der Wahl eines anderen Eintrags steht in genau einem `role=status` „Commit 3 von 3: kd:<kurz>“. Bei mehr als 8 Einträgen (30 Commits) ist „Zum Code“ der erste Tab-Halt der Leiste und setzt den Fokus auf den Anfang der Dateien, nicht auf den Kopf (FA 14). Probe „8 Einträge (7 Commits)“: kein Verweis; Probe „9 Einträge (8 Commits)“: Verweis da. Heute rot.

### Kopf

- [x] **AK 4 Kopf mit Chips:** Gegeben K-Leiste, wenn `sh` C1 zeigt, dann nennt der Kopf „kd:<kurz>“, die Chips „R00229“ und „B1187“ und als Überschrift „Sperrform je Komponente“ ohne Chips, danach Autor, Datum, Zeilen und Dateien wie heute. Gegeben K-Rand, dann zeigt C4 die Überschrift „Ohne Form“ und C6 die Überschrift „[R00229]“, beide ohne Chips. Die Chips stehen als Liste mit dem unsichtbaren Vorspann „Kennungen:“; ein Chip über 16 Zeichen ist gekürzt, der volle Text steht im `title`. Heute rot.
- [x] **AK 5 Zweige verdichtet:** Gegeben K-Leiste und K-Rand, dann zeigt der Kopf
  - C1 „auf main“ mit dem Knopf „+5 Zweige“ (`aria-expanded="false"`); der Klick öffnet die Liste aller Namen (`karte/247`, `karte/a` … `karte/d`), `aria-expanded` steht auf `true`, der Fokus bleibt auf dem Knopf, ein zweiter Klick schließt; beim Wechsel zu einem anderen Commit beginnt sie zu. Rechnung: 6 lokale Zweige − 1 = 5.
  - C3 „auf main“ und „+1 Zweig“ (`origin/main` zählt: 2 Namen − 1)
  - C4 „auf main“ ohne Knopf
  - C2 die heutige Liste („auf Zweigen: karte/247, origin/karte/247“) ohne „auf main“ und ohne Knopf
  - C8 „auf master“ und „+1 Zweig“; steht neben `master` auch `main`, gilt `main`
  - C9 „auf main“ und „+11 Zweige“. Rechnung: 10 genannte Namen − 1 = 9, dazu `weitere: 2`, zusammen 11
  - V „auf keinem Zweig“ ohne Knopf, mit dem Band wie heute

  Steht `main` nicht in der Antwort (Wegwerf-Commit mit `a01`–`a12` und `main`: die Antwort nennt die ersten zehn alphabetisch), gilt die heutige Liste. Heute rot.

### Ränder und Breite

- [x] **AK 6 Ränder der Leiste:** Gegeben Aufgabe #7, dann steht V mit „auf keinem Zweig“ in der Leiste, „Alle Änderungen“ zählt nur C1 und C2 („2 Commits · +316 −19“), und die Wahl von V zeigt dessen Diff mit dem Band „Dieser Commit ist verwaist …“. Ein Eintrag mit Zustand `fehlt` steht nicht in der Leiste. V trägt „auf keinem Zweig“ in Zeile 2 und im Namen („…, zählt nicht in den Zahlen von Alle Änderungen“). Gegeben die Antwort der Liste ist gehalten (`page.route`), dann steht nur „Alle Änderungen“ ohne Zahlen mit der Zeile „Commits werden gelesen …“ und `aria-busy="true"`, ohne `aria-current`, wenn die Adresse einen Commit nennt. Endet sie mit 503, dann steht die Zeile „Commits nicht gelesen“, und die Meldung mit „Erneut versuchen“ bleibt; nach „Erneut versuchen“ fällt `aria-busy` weg, alle Einträge stehen da, der Fokus liegt nicht auf `body`. Gegeben eine Aufgabe ohne Commit mit Diff, dann steht nur „Alle Änderungen“ ohne Zahlen und die Seite sagt „Keine Änderungen zu zeigen.“. Gegeben die Adresse nennt einen Commit, der nicht in der Folge steht (R00207 Rand b), dann trägt kein Eintrag `aria-current`. Rechnung für V: 302 + 14 = 316, 7 + 12 = 19. Heute rot.
- [x] **AK 7 Alle Änderungen, mehrere Anwendungen:** Gegeben Aufgabe #8, wenn `sh` „Alle Änderungen“ öffnet, dann stehen in der Leiste die Einträge von `kd` und `wb` mit „kd:<kurz>“ bzw. „wb:<kurz>“ in der Reihenfolge der Liste, „Alle Änderungen“ trägt `aria-current`, und die Commit-Liste der Seitenleiste je Abschnitt steht weiter da (PO Z. 544). Die Wahl von W1 zeigt „Ein Commit“ von `wb` mit `aria-current` an W1. Heute rot (Umschalter).
- [x] **AK 8 Breite, beide Themen, Ziele:** Gegeben K-Leiste mit einem Titel von 120 Zeichen in C2 und einem Titel `[AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA]` in C3, Breiten 320, 414, 599, 600, 980 und 1280 px, Themen hell und dunkel, dann gilt `document.documentElement.scrollWidth ≤ clientWidth`. Bei 599 px und darunter steht jeder Eintrag in einer eigenen Zeile und ist so breit wie die Leiste (±1 px), sein Titel ist gekürzt (`scrollWidth > clientWidth`, `text-overflow: ellipsis`), und die Überschrift des Kopfs bricht um (mehr als eine Zeile, `scrollWidth ≤ clientWidth`). Ab 600 px stehen C1 und C2 bei 980 px in derselben Zeile (gleiches `top`), und ein Eintrag ist nie breiter als die Leiste. Bei grobem Zeiger ist jeder Eintrag mindestens 44 px hoch (der Stil liefert 48), bei feinem mindestens 24 px. Kein Chip ist breiter als die Leiste (320 und 599 px), die Kennung des Titels in C3 ist auf 16 Zeichen gekürzt (15 Zeichen und „…“ ergeben 16, das „…“ zählt mit), und `scrollWidth ≤ clientWidth` gilt in Leiste und Kopf. Gegeben eine Leiste mit 30 Commits (C1' bis C30', neue Fixture) bei 320 x 568 und 1280 x 720 gilt `leiste.getBoundingClientRect().height ≤ 0,4 · innerHeight + 1` und `leiste.scrollHeight > leiste.clientHeight` (PO Z. 635, FA 13); wählt `sh` den 25. Eintrag per Tastatur, liegt dessen Rechteck samt 4 px Fokusring ganz in dem der Leiste, `window.scrollY` ist unverändert, und der Eintrag liegt nach dem Wechsel ganz im sichtbaren Teil der Leiste (kein Rücksprung auf Rollstand 0). Bei 640 x 360 (grober Zeiger) ist die Leiste ≤ 144 px hoch und bricht in Zeilen um. Klick auf den gezeigten Eintrag ändert den Rollstand nicht. Der Bau nutzt dafür eine Media Query `max-width: 599.98px`. Heute rot.
- [x] **AK 9 Rand, Kontrast, Fokus:** Gegeben K-Leiste, hell und dunkel, dann hat der Rand eines Eintrags gegen die Fläche mindestens 3:1 (`--kd-muted` gegen `--kd-surface`, gerechnet 6,47 hell und 6,97 dunkel), der gewählte hat Fläche `--kd-accent-weak` und eine Unterkante von 3 px `--kd-accent`, und der Text jedes Eintrags und jedes Chips hat mindestens 4,5:1 in Ruhe, bei Hover, bei Fokus und bei „gewählt + Hover“ (`kontrastMessen`). Der Fokusring eines Eintrags liegt ganz im sichtbaren Bereich. Der gewählte Eintrag ist nicht nur an der Farbe erkennbar: seine Unterkante ist mindestens 3 px dick, die der anderen nicht. Die 3-px-Unterkante `--kd-accent` hat gegen `--kd-surface` mindestens 3:1 (hell, dunkel; gemessen, nicht geschätzt), und Hover auf dem gezeigten Eintrag ändert seine Fläche nicht. „Fokusring ganz sichtbar“ heißt: für den ersten und den letzten Eintrag liegt das um `outline-width + outline-offset` erweiterte Rechteck des Eintrags innerhalb von `getBoundingClientRect()` der Leiste und des Fensters. Heute rot.

### Fremder Text, Bestand, Mutanten

- [x] **AK 10 Fremder Text, Bestand, Mutanten:** Gegeben C7, dann stehen Titel und Zweigname in Leiste, Kopf und Zweigliste zeichengleich als Text bzw. mit der Marke `⟨U+202E⟩`, es entsteht kein `img`, `window.pwn` ist nicht gesetzt, und ein Chip entsteht nur aus dem Muster von FA 8. Was nicht S2 ist, bleibt wie in B2/B3 und S1: Blättern, Gruppen, Aufklapper „Dateien (<n>) und Commits“, Pfad, VS Code und Patch. Bestehende Tests behalten ihre Erwartungen; die Tests, die den Umschalter prüfen (gezählt: 56 Fundstellen in `r00210-alle-aenderungen.spec.js`, `r00207-review-seite.spec.js`, `r00224-grund-bei-404.spec.js`, `r00217-syntaxfarben.spec.js`, `r00230-eine-ansage.spec.js`, `r00236-review-pfad-vscode-patch.spec.js`, `gesamt-zeichnen.test.js`), gehen auf die Leiste über, und jede geänderte Erwartung nennt der entwickler im Bericht mit Grund. Mutanten, je von einem benannten Test getötet, in einer eigenen Kopie:
  - (m1) Chip-Muster ohne `^` → AK 2 rot (`x [R00229] y`)
  - (m2) die Chips bleiben in der Überschrift → AK 4 rot
  - (m3) „<n> Commits“ zählt den verwaisten mit → AK 6 rot
  - (m4) `aria-current` an jedem Eintrag oder am falschen → AK 1 und AK 3 rot
  - (m5) entfernte Zweige zählen nicht in „+<k>“ → AK 5 rot (C3)
  - (m6) `master` vor `main` → AK 5 rot
  - (m7) „1 Zweige“ statt „1 Zweig“ → AK 5 rot
  - (m8) Klick fügt einen Verlaufseintrag hinzu → AK 3 rot

## Betroffene Verzeichnisstruktur

- Reine Funktionen (`commitChips`, `zweigVerdichtung`, `leistenEintraege`, Zählung und Einzahl) kommen in `web/review-uebersicht.js` (ADR-0042 N1.2: hängt von nichts ab, Node-tauglich).
- Zeichnen: `web/gesamt.js` (`umschalterHtml` wird zur Leiste), `web/diff.js` (`commitKopfHtml`, `zweigeHtml`), `web/app.js` (`vReviewAlle`, `vReview`, `reviewDiffHtml`, `reviewUmschalterCommit`, Handler `review-umschalten` und `review-alle-zeigen`, `reviewCommitZiel` und `r.zuletzt`, soweit nichts anderes sie braucht).
- Stil: `web/kd-app.css`, nur Tokens (`.seg.umsch` entfällt); die Maße der Zeichnung (`.ru-cl`, `.ru-chip` in `D0009.dc.html`) gelten als Anhalt.
- Tests: `e2e/einheit/` (Node) und `e2e/tests/r00245-review-commit-leiste.spec.js`; die Ausgangslage kommt in `e2e/tests/review-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der entwickler)

1. **B1280 Chips, Zweigverdichtung und Einträge, rein**: Titel → Chips und Rest (FA 8); Eintrag der Liste → `{name, weitere}` oder keine Verdichtung (FA 9); Einträge der Liste → Leistenfolge mit „<n> Commits · +<a> −<b>“ (FA 2, 3). Einheitentests zuerst.
2. **B1281 Leiste zeichnen, Umschalter ersetzen**: beide Ansichten, Zustände lädt, Fehler, leer, fremd (FA 1–5, 7, 11); die Bestandstests, die den Umschalter prüfen, gehen vorab auf die Leiste über (AK 10); `rv-u-alle` bleibt, wo es geht, die Kennung des ersten Eintrags.
3. **B1282 Wahl**: Handler für Klick, Fokus, ersetzter Verlaufseintrag, Tab-Folge, keine neue Anfrage (FA 6).
4. **B1283 Commit-Kopf verdichtet**: Chips, Überschrift ohne Chips, „auf main“ mit Knopf, Zustand der Zweigliste nur in `S.ui.review`, beim Wechsel zu (FA 9).
5. **B1284 Breite, Themen, Kontrast, Fokus messen und nachziehen** (AK 8, 9). Die Vorprüfung macht der ux-reviewer.
6. **B1285 Probe im echten Programm**, Mutanten m1–m8, Gate, Anforderung abschließen.

### Artboard

`Dokumentation/Wireframes/D0009.dc.html` `#review-uebersicht`. Für S2 gelten Bild 1 und 2 (Leiste, Kopf mit Chips und „auf main“, „+5 Zweige“), Bild 4 (980 px, die Leiste bricht um), Bild 5 (320 px, untereinander) und die Notiz „Was die Zeichnung festlegt“, Absatz S2. Verbindlich sind PO Z. 539 (Änderung 1 und 2), 540 (c), 542 und 544. Nicht gezeichnet sind die Zustände der Leiste in AK 6 (lädt, Fehler, verwaist, fremd); ihre Form wählt der entwickler nach dem Muster der bestehenden Zustände und lässt sie vom ux-reviewer prüfen. „Gesehen“ im Kopf und die Schalter in der Leiste gehören zu #257, #259 und #260.

## Tests

- **Unit** (Node, rein): `commitChips` (alle Fälle aus AK 2), `zweigVerdichtung` (C1, C2, C3, C4, C8, C9 und `main` fehlt aus AK 5, Einzahl), Leistenfolge (Reihenfolge, Zählung ohne verwaisten Commit, Tausenderpunkt, Einzahl, Aufgabe ohne Diff).
- **Integration**: keine neue, der Server bleibt unverändert.
- **E2E**: AK 1–10 im gestarteten Programm gegen echtes Git. Antworten per `page.route` gehalten und über ein Promise freigegeben, keine Schlafzeiten; Verneinungen erst nach einem sichtbaren Signal. Lage mit `getBoundingClientRect`, Kontrast mit `kontrastMessen`, Zeit mit festgelegter Zeitzone.

## Abhängigkeiten

- Abhängig von: R00207 (I0197 Review-Seite eines Commits, grün), R00210 (I0200 Alle Änderungen, grün), R00235 (I0225 Gruppen und Aufklapper, grün), ADR-0042 Punkt 5, ADR-0033
- Blockiert: nichts unmittelbar; #257 (S3 Gesehen im Kopf), #259 und #260 (Schalter in der Leiste) bauen auf diese Leiste auf (PO Z. 538)

## Offene Fragen

- Frage 1 (Höhe der Leiste): entschieden, PO Z. 635, jetzt FA 13 und AK 8.
- Frage 2 (verwaister Commit in „<n> Commits“): entschieden, PO Z. 636, FA 3, AK 6.
- Frage 3 (Summe brutto aus der Liste): entschieden, PO Z. 637, FA 2.
- Frage 4 (an den product-owner, aus der UX-Vorprüfung F2): Reicht ein Verweis „Zum Code“ ab 8 Einträgen (FA 14), oder bleibt es bei der Tab-Folge? Empfehlung: Verweis; kein Umfang, umkehrbar. Entschieden, PO Z. 639: der Verweis gilt, jetzt FA 14 und AK 3.

## Manuelle Vorbereitungstätigkeiten
- keine

## Manuelle Nachbereitungstätigkeiten
- keine

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Abnahme von #247: Die Aufgabe hat drei Commits, der Prüfer sieht aber immer nur einen und kennt die anderen nur über „Zurück“ und „Vor“, ohne ihren Titel. Zeigt die Leiste alle Commits der Aufgabe mit Anforderung, Schritt, Zeit und Umfang, dann sieht der Prüfer, was die Aufgabe getan hat, und wählt den Commit, der ihn gerade interessiert, mit einem Klick statt mit mehreren. Nennt der Kopf die Kennungen vorn und die Zweige als „auf main“, dann liest er den Titel ohne die Kennungen davor und muss keine Zweigliste durchsuchen. Der Hebel ist die Übersicht über die Folge: ein Klick statt n Schritte, und ein Kopf, der in einem Blick sagt, wohin der Commit gehört.

## Notizen

- Optionen für die Leiste (ADR-0042 Punkt 5 trägt A): (A) aus der schon gelesenen Liste der Commits bauen, echte Verweise, kein neuer Weg — gewählt, weil sie keine Anfrage kostet und Kopf und Leiste dieselbe Quelle haben; (B) eine eigene Antwort für die Leiste — verworfen, ein neuer Endpunkt ohne Gewinn; (C) die Commit-Auswahl als Aufklappliste — verworfen, PO Z. 416 hat sie für „Ein Commit“ schon verworfen, und eine Liste verbirgt, was die Leiste zeigen soll.
- Entscheidung des planers: Die Leiste führt dieselbe Folge wie das Blättern (Commits mit Diff). Commits ohne Diff stehen nicht darin, damit „Zurück“ und „Vor“ und die Leiste dieselben Nachbarn kennen.
- Entscheidung des planers: Der Umschalter entfällt mit seinem Ziel „zuletzt gezeigter Commit“ (R00210 FA 2); jeder Eintrag der Leiste ist sein eigenes Ziel.
- Grenze, die bleibt: Die Antwort nennt höchstens zehn lokale Zweige alphabetisch (`commit_eintrag.rs`). Steht `main` nicht darunter, kennt der Kopf es nicht, und die heutige Liste gilt (AK 5). Ein Wert, den der Server sonst mitliefern müsste, ist nicht Teil von S2.
- Bewusst nicht in S2: „Gesehen“ und „k von n gesehen“ (#257), Wortmarke (#258), Umbrechen (#259), Nebeneinander (#260).
- Härtung ohne Kriterium, für die UX-Vorprüfung: Tooltip mit vollem Titel auch bei grobem Zeiger (dort gibt es kein Zeigen; der Kopf trägt den ganzen Titel), Ansage der Zeit.
