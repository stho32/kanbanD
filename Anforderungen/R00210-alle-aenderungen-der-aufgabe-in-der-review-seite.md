---
id: R00210
status: Neu
datum: 2026-11-20
---

# R00210: Alle Änderungen der Aufgabe in der Review-Seite

## Beschreibung

Karte #215 (Scheibe B3 des Feinschnitts, Zuschnitt des PO 2026-11-19, po-entscheidungen Z. 384–388).

**Umfang (baut auf [R00207](R00207-review-seite-eines-commits.md) und [R00208](R00208-gesamt-diff-der-karte-per-api-lesen.md)):** Die Review-Seite zeigt unter `…/review` ohne `?commit=` **alle Änderungen der Aufgabe** als ein Bild: je Anwendung ein Abschnitt mit Commit-Liste, Hinweisen und Dateien, gelesen aus `GET /api/aufgaben/{nr}/diff` ohne `commit` (R00208). Eine Datei, die ein fremder Commit zwischen den Schritten der Aufgabe berührt, steht als **Folge-Datei** mit ihren Schritten. Ein Umschalter „Alle Änderungen | Ein Commit“ steht in beiden Ansichten. Was nicht im Gesamtbild steht (fremde Commits, verwaiste Commits, Merges, Unlesbares), sagt die Seite in Worten und führt, wo es einen Diff gibt, in einem Schritt dorthin. **Nicht** in B3: Syntaxfarben (B4, #216), Band „neu laden“ (po-entscheidungen Z. 441), Zwilling eines verwaisten Commits (#220), Nachfolgervorschlag (A5), jede Schreibaktion.

**Grundlagen:** ADR-0033 Nachtrag N1 (N1.1–N1.10, akzeptiert, acbb2e9b) mit Messung und Pre-Mortem; Artboard `Dokumentation/Wireframes/D0009.dc.html`, Anker `#alle-aenderungen` und `#alle-raender` (538e96f9), vom product-owner **freigegeben mit Änderung** (`AI-Team/po-entscheidungen.md` Z. 437–441). Die Zeichnung ist die Quelle für Aussehen, Abstände und Reihenfolge; diese Anforderung legt Verhalten und Wortlaute fest. Die Änderungen des PO (Wortlaute, G2 je Datei, Rand `.seg.umsch`, Titel und Ansage) gehen der Zeichnung vor.

**Ersetzt zwei Aussagen von R00207** (R00207 bleibt unverändert, die Tests werden umgestellt):
- R00207 FA 3 und B1020: „`…/review` ohne `commit` → `replaceState` auf den ersten Commit mit Diff“. Ab B3 zeigt `…/review` „Alle Änderungen“, und die Adresse bleibt. Rand (c) von R00207 (keine Einträge mit Diff) zeigt sich nun im Abschnitt (FA 7).
- R00207 Beschreibung „Nicht in B2: Umschalter“. Der Umschalter steht ab B3 auch in „Ein Commit“; Titel, Blättern und alles Übrige von R00207 bleiben, wie sie sind, und werden in der Abnahme erneut geprüft (AK 1).

**Wortlaut:** „Aufgabe“ in allen Texten, die der Nutzer sieht oder hört, auch in den Sätzen der Hinweise und im Ladezustand (PO Z. 399, Z. 444); die freigegebenen Sätze aus Z. 437/440 stehen hier mit „Aufgabe“ statt „Karte“, sonst wörtlich.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110) und Nicht-Ziel „Kein Git-Client“ (Z. 194: nur lesen).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — Einstieg („Alle Änderungen ansehen“) und Ziel des Rückwegs
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) — liest auf der Review-Seite nichts neu
- [Leseposition](../Dokumentation/Domaenenwissen/D00006-leseposition.md) — bleibt, weil die Insel derselbe Knoten bleibt
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — Umschalter und Schrittköpfe bis 640 px
- Die Begriffe Review-Seite, Gesamt-Diff, Folge-Datei, fremder Commit und verwaist fehlen im Glossar (Auftrag an den fachspezialist aus R00207/R00208); bis dahin gelten die Wörter von R00208 und ADR-0033 N1.

## Geschäftlicher Nutzen

Wer eine Aufgabe in der Abnahme prüft, muss heute ihre Commits einzeln durchblättern und sich das Gesamtbild selbst zusammensetzen: Was am Ende in einer Datei steht, sieht er nirgends auf einmal, und eine Zeile, die ein späterer Commit wieder ändert, liest er zweimal. Mit „Alle Änderungen“ sieht er die Arbeit der Aufgabe als ein Bild. Wo fremde Arbeit dazwischenliegt, steht das offen da, und die Schritte stehen nacheinander, statt fremde Zeilen als Arbeit der Aufgabe zu zeigen (PO Z. 426: nie fremd).

## Funktionale Anforderungen

1. **Adresse (N1.1, H1):** `#/board/<slug>/aufgabe/<nr>/review` und `#/aufgaben/aufgabe/<nr>/review` ohne `commit` zeigen „Alle Änderungen“ und **ersetzen die Adresse nicht**. `?commit=` bleibt wie in R00207.
2. **Umschalter (N1.1):** Über dem Inhalt steht in **beiden** Ansichten „Alle Änderungen | Ein Commit“, gebaut aus zwei echten Verweisen (`a[href]`). Der gezeigte Teil trägt `aria-current="page"`. Ein einfacher Linksklick ersetzt den Verlaufseintrag (`replaceState`), und die Marke „aus der Liste geöffnet“ bleibt. Mittel- und Strg-Klick öffnen einen Tab. Ziel von „Ein Commit“ ist der **zuletzt auf dieser Seite gezeigte** Commit, sonst der erste mit Diff (Weg aus R00207, `reviewErsterCommit`). Bis das Ziel bekannt ist, steht der Teil gedämpft und ohne `href` da (gezeichnet in `#alle-raender`, Ladezustand). Scheitert `…/commits`, ist das Ziel der erste Eintrag aus `commits[].verweis` der Diff-Antwort (UX-Vorprüfung S1). **Hat die Aufgabe keinen Commit mit Diff** (PO Z. 442), bleibt der Teil sichtbar in dieser gedämpften Form: ohne `href`, **ohne** `role="link"`, kein Tab-Stopp, nicht als Verweis vorgelesen, und nicht nur an der Farbe als nicht wählbar erkennbar (z. B. ohne Unterstreichung und ohne Rand des wählbaren Teils, wie gezeichnet). Der Grund steht sichtbar im Rumpf („Keine Änderungen zu zeigen“ mit den Zuständen der Einträge), nicht am Umschalter. Eine von Hand eingetippte Adresse mit `?commit=` verhält sich wie in R00207. Der Umschalter steht auch beim Laden, beim Seitenfehler und bei „Keine Änderungen zu zeigen“; nur bei 404 ohne Verweise entfällt er (S8). Jeder Verweis der Seite auf `?commit=` (Commit-Liste, Schrittköpfe, „einzeln ansehen“) ersetzt bei einfachem Linksklick den Verlaufseintrag wie der Umschalter (S4); Klappen gelten nach R00207, eine Scrollposition wird nicht versprochen. Es gibt keine Commit-Auswahl (N1.1, PO Z. 416). Rand des Umschalters: `--kd-muted`, nur über den Modifikator `.seg.umsch`, die Basis `.seg` bleibt (PO Z. 439).
3. **Titel und Ansage (N1.1, PO Z. 440):** Der Seitentitel in „Alle Änderungen“ heißt „Review #<nr> · Alle Änderungen — kanbanD“, gebaut über `fenstertitelName` (mit dem Vorsatz „(n ▶)“, wenn Timer laufen). In „Ein Commit“ bleibt der Titel aus R00207. Die Ansage sagt die Zahlen in Worten, z. B. „Alle Änderungen der Aufgabe #219: 13 Dateien, 1.059 Zeilen hinzugefügt, 25 entfernt.“ Nie stehen dort „+“ oder „−“. Einzahl bei 1 („1 Datei“, „1 Zeile hinzugefügt“), Zahlen mit Tausenderpunkt. **Ansage (UX-Vorprüfung M1, WCAG 4.1.3):** Die Live-Region (`aria-live="polite"`, `aria-atomic="true"`) steht schon beim Aufbau der Insel **leer** im DOM. Ihr Text wird erst gesetzt, wenn alle Abschnitte entschieden sind (geladen oder mit Fehler). Scheitert ein Abschnitt, sagt sie z. B. „Alle Änderungen der Aufgabe #11: 9 Dateien, 40 Zeilen hinzugefügt, 3 entfernt, ohne Anwendung wb: ließ sich nicht lesen.“ Die Zahlen gelten nur für die geladenen Abschnitte, und jeder gescheiterte Abschnitt wird einmal genannt. Nach erfolgreichem „Erneut versuchen“ wird sie neu gesetzt. Zwei Ansagen mit gleichem Wortlaut hintereinander gibt es nicht. Eine Fehlermeldung am Abschnitt trägt `role="alert"`.
4. **Abschnitte (N1.3):** Die Insel trägt `data-insel="<nr>:alle"`. Je Anwendung steht ein Abschnitt in der Reihenfolge der Antworten, mit der Überschrift „Anwendung <kürzel>“ und „<c> Commits · <d> Dateien“. Darin stehen die Hinweise des Abschnitts, die Commit-Liste und die Dateien. In der Commit-Liste ist jeder einbezogene Commit ein Verweis auf `…/review?commit=<verweis>`; ein verwaister steht als „nicht einbezogen: verwaist“, ein Merge als „nicht einbezogen: Merge“, beide als sichtbarer Text. Die Leiste zeigt die Summe über die **geladenen** Abschnitte („<d> Dateien · +<plus> −<minus>“) und, solange ein Abschnitt lädt, „· Anwendung <kürzel> lädt noch …“. Kennungen sind über Abschnitte und Schritte eindeutig (`rv-d<a>-<i>`, `rv-d<a>-<i>-<j>`, `data-arg="<a>:<i>"`).
5. **Folge-Datei (N1.4):** Ein Eintrag mit `schritte` zeigt im Kopf Pfad, Summe `plus`/`minus` aus der Antwort und „Folge · <n> Commits“ (bei 1: „Folge · 1 Commit“), aber **kein Statuswort**. Aufgeklappt steht einmal der Satz zur Folge (FA 6), dann je Schritt ein Kopf mit Kurzverweis, Titel (aus `commits` der Antwort, zugeordnet über `commit` wörtlich), Statuswort und Zahlen. Der Kopf ist ein Verweis auf `…/review?commit=<verweis>`. Darunter folgt der Schritt wie eine Datei in R00207 (Zustand, Merkmalsätze, Hinweis, Code). Die Zahl in Liste und Kopf ist die Summe der Schritte.
6. **Hinweise in Worten (N1.7, Wortlaute nach PO Z. 437 und 440, Zeichnung `#alle-aenderungen` Bild 1, `#alle-raender`):**
   - `fremd_dazwischen` im Abschnitt: „Zwischen den Commits der Aufgabe liegt 1 fremder Commit. Er berührt Dateien der Aufgabe; <d> Dateien stehen deshalb als Folge der Schritte der Aufgabe. Die Änderungen des fremden Commits sind nicht zu sehen.“, in der Mehrzahl „… liegen <c> fremde Commits. Sie berühren Dateien der Aufgabe; … Die Änderungen fremder Commits sind nicht zu sehen.“; bei `dateien` 1 „1 Datei steht deshalb …“. An jeder Folge-Datei steht: „Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert. Hier stehen die Schritte der Aufgabe nacheinander; Änderungen fremder Commits fehlen.“ Hashes fremder Commits stehen nirgends, weil die API sie nicht liefert.
   - `ganz_als_folge` über den Dateien: „<Grund> Darum steht jede Datei als Folge der Schritte der Aufgabe; einen zusammengefassten Diff der ganzen Aufgabe gibt es hier nicht.“ mit den Gründen `nicht_linear` „Die Commits der Aufgabe folgen nicht auf einem Zweig aufeinander.“, `fremd_zu_viele` „Zwischen den Commits der Aufgabe liegen mehr als 1.000 fremde Commits.“ und `fremd_zu_gross` „Die Commits zwischen denen der Aufgabe sind zu umfangreich, um zu erkennen, welche Dateien sie berühren.“ An jeder Datei steht dann: „Diese Datei steht als Folge der Schritte der Aufgabe. Hier stehen die Schritte nacheinander; Änderungen fremder Commits fehlen.“
   - `verwaist`: „<verweis> ist verwaist: Kein Zweig führt zu ihm, darum zählt er hier nicht mit.“ mit dem Verweis „einzeln ansehen“ auf `…/review?commit=<verweis>`.
   - `merge_ausgelassen`: „<verweis> ist ein Merge und in diesem Gesamtbild ausgelassen.“ mit „einzeln ansehen“ auf `…/review?commit=<verweis>` (PO Z. 427).
   - `ausgelassen`: `unlesbar` und `anwendung_unbekannt` stehen einmal je Seite über den Abschnitten, entdoppelt nach Verweis; `fehlt` steht im Abschnitt. Je Eintrag stehen Verweis, Symbol, Zustandswort und Hinweis, wie in der Liste der Commits (R00205 FA 5, PO Z. 406). Es gibt kein „einzeln ansehen“, weil kein Diff existiert. Der Verweis bei `unlesbar` ist fremder Text und geht nur über `sichtbarHtml`.
   - `dateien_gekappt`: „<gezeigt> von <gesamt> Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; sie lassen sich über „Ein Commit“ lesen.“
   - `zu_gross_zum_anzeigen` an einer Folge-Datei: „Zu groß zum Anzeigen. Es stehen nur die Zahlen: +<plus> −<minus>. Jeder Schritt lässt sich über seinen Kopf einzeln ansehen.“, die Schrittköpfe bleiben Verweise. An einer Netto-Datei gilt der Zustand aus R00207.
   - Unbekannte `art`: „Die Antwort nennt einen Hinweis „<art>“, den diese Ansicht nicht kennt.“ (`<art>` als Text über `esc`).
   - `weitere_anwendungen`: kein Satz. Der Hinweis löst das Laden der weiteren Abschnitte aus (FA 8).
7. **Leere und Fehler (N1.3, `#alle-raender`):**
   - Hat ein Abschnitt keine einbezogenen Commits (`commits: []`), sagt er „Keine Änderungen zu zeigen.“, dazu seine Hinweise. Der zweite Satz richtet sich nach den Hinweisen (UX-Vorprüfung S2, PO Z. 443): Gibt es mindestens einen Hinweis `verwaist` oder `merge_ausgelassen`, auch gemischt mit `fehlt`, lautet er „Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen. Die Commits lassen sich einzeln ansehen.“ (ersetzt den gezeichneten Satz „Kein Commit dieser Anwendung liegt auf einem Zweig. …“). Stehen nur `fehlt` oder `anwendung_unbekannt`, lautet er „Zu den Verweisen dieser Anwendung gibt es keinen Diff.“
   - Hat die Aufgabe keine Verweise (404), steht „Keine Änderungen zu zeigen“ mit „An dieser Aufgabe sind keine Commit-Verweise hinterlegt.“ und dem Rückweg aus R00207.
   - Beim Öffnen steht „Liest die Änderungen der Aufgabe …“ (`role="status"`, `aria-busy`). Scheitert die erste Anfrage, steht der Fehler der Seite wie in R00207 FA 8 (Antwortbudget amber, Zeitgrenze rot, andere Fehler).
   - Scheitert der Abschnitt einer weiteren Anwendung, sagt er „Die Änderungen der Anwendung <kürzel> ließen sich nicht lesen: <fehler der Antwort> (<Status>).“, bei 503 „Antwortbudget …“ „Server ausgelastet (Antwortbudget). Die Änderungen der Anwendung <kürzel> wurden nicht gelesen. Es wird nicht von selbst wiederholt.“. Kommt keine Antwort (Netzfehler), steht statt „<fehler der Antwort> (<Status>)“ „keine Verbindung zum Programm“, ohne Klammer (UX-Vorprüfung M2). Kommt 404 oder 400 für `…/diff?anwendung=<kürzel>`, gilt derselbe Satz mit Status. Alle Fälle haben „Erneut versuchen“ am Abschnitt (amber mit Server-Symbol beim Antwortbudget, rot mit Uhr bei Zeitgrenze und anderen Fehlern), die Meldung trägt `role="alert"`, und die übrigen Abschnitte bleiben lesbar.
8. **Laden in einer Reihe (N1.2):** Beim Öffnen laufen `GET …/commits` und `GET …/diff` (ohne `commit`, ohne `anwendung`) parallel. Nennt die Antwort `weitere_anwendungen`, liest die Seite je Kürzel `GET …/diff?anwendung=<kürzel>` **nacheinander** in der Reihenfolge des Hinweises. **Höchstens eine Anfrage an `…/diff` zur Zeit je Seite**, gleich ob für einen Abschnitt oder für `datei=`. Ein Klick auf „Nachladen“ oder „Änderungen anzeigen“ geht vor noch nicht begonnene Anwendungen, überholt aber nie eine laufende Anfrage. Ein Abschnitt, der läuft, zeigt „lädt …“ und „Lädt die Änderungen der Anwendung <kürzel> …“. Ein Abschnitt, der wartet, zeigt „wartet“ und „Wartet, bis die Anwendung <kürzel der laufenden> geladen ist …“ mit ruhender Sanduhr. Ein ankommender Abschnitt wird **in die stehende Insel gehängt**, ohne sie neu aufzubauen; der Fokus bleibt, wo er ist, und nichts oberhalb der Leseposition verschiebt sich (S5: höchstens 1 px).
9. **Lauf-Kennung (N1.2, Lehre #209):** Jede Anfrage an `…/diff` trägt ein eigenes Lauf-Objekt mit `AbortController`. Eine Antwort gilt nur, solange genau dieses Objekt der laufende Lauf der Seite ist, nie über Index, Kürzel oder Namen. Umschalten, Wechsel des Commits oder der Adresse und Verlassen der Seite brechen die laufende Anfrage ab und leeren die Reihe. Kein Zustand des Gesamtbilds übersteht das Umschalten, die Rückkehr zu „Alle Änderungen“ liest neu. `If-None-Match` setzt die Oberfläche **nicht** selbst (N1.2: der Browser fragt von selbst bedingt nach; ein selbst gesetztes Tag käme als 304 mit leerem Rumpf an). Ein Live-Ereignis liest nichts neu, und die Insel bleibt derselbe Knoten mit Klappen, Nachgeladenem, Auswahl und Leseposition. Klappen werden je Anwendung unter `alle:<kürzel>` gemerkt und gelten nur bei gleicher Dateiliste.
10. **Zeichenbudget seitenweit (N1.4):** Gezählt werden wie in R00207 FA 6 die gezeichneten Zeilen, hier über alle Abschnitte der Seite. Eine Folge-Datei zählt mit allen Schritten, die `patch` haben, und öffnet ganz oder gar nicht. „Die erste Datei mit `patch` öffnet immer“ gilt nur für die erste Datei der Seite. Nach der ersten Datei, die nicht passt, öffnet keine weitere, auch nicht in später ankommenden Abschnitten. Ein Schritt ohne `patch` zählt nicht und unterbricht nicht. „Alle aufklappen“ wirkt wie in R00207 FA 5a über alle Abschnitte.
11. **Nachladen (N1.6):** „Nachladen“ und „Änderungen anzeigen“ lesen `GET …/diff?datei=<name aus der Antwort>&anwendung=<kürzel>` ohne `commit`. `anwendung=` steht **immer** dabei, bei der Standardanwendung leer (`anwendung=`). Der Name ist für Netto-Dateien `neu` (bei gelöschten `alt`) und für Folge-Dateien `pfad`, nie ein Text der Oberfläche. Die Antwort ersetzt den Eintrag: Netto-Dateien werden über `zuordnen` gefunden, Folge-Dateien über `pfad` und die Position unter gleichnamigen. Kommt der Eintrag in der anderen Art zurück, gilt die neue Antwort. Eine Folge-Datei öffnet danach ganz. Während eine Anwendung lädt, zeigt die Datei „Wartet, bis die Anwendung <kürzel> geladen ist …“ ohne Knopf; danach gelten „Lädt die Änderungen …“, Fehler an der Datei und „Erneut versuchen“ wie in R00207 FA 7.
12. **Fremder Text (R00207 FA 12, Label `sicherheit`):** Titel der Commits, Pfade, Patch-Zeilen, Verweise aus Hinweisen, `fehler` und die Namen unbekannter Arten gehen nur über `esc` bzw. `sichtbarHtml` in feste Elemente. Bidi- und Steuerzeichen erscheinen als Marke wie in R00207.
13. **Fokus (N1.1, Lehre #209):** Nach dem Umschalten steht der Fokus auf dem nun gewählten Teil des Umschalters. Nach der Ankunft eines weiteren Abschnitts bleibt er unverändert. Nach „Nachladen“, „Änderungen anzeigen“ oder „Erneut versuchen“ und nach jedem Neuzeichnen einer Datei, auch beim Übergang „wartet“ → „lädt“, steht er auf dem Kopfknopf der betroffenen Datei bzw. auf der Überschrift des Abschnitts. Nach „Erneut versuchen“ am Abschnitt steht er auf dessen Überschrift „Anwendung <kürzel>“ (`h2`, `tabindex="-1"`, der Abschnitt mit `aria-labelledby` auf sie; S3). Nach Browser-Zurück und -Vor stehen Fokus und Titel wie beim Öffnen (S9). Nie steht er auf `body`. Namen (S3), beginnend mit dem sichtbaren Text: Kopfknopf einer Folge-Datei „<pfad>, Folge · <n> Commits, +<plus> −<minus>, zugeklappt|aufgeklappt“; Schrittkopf „Commit <kurz>, <Titel>, <Zustandswort>, +<p> −<m>“. Sonst gilt R00207 FA 13.

## Nicht-funktionale Anforderungen

- **Breite:** Bei 320, 414, 641, 768, 980 und 1280 px, hell und dunkel, gilt `documentElement.scrollWidth ≤ documentElement.clientWidth`; quer scrollen darf nur der Code-Bereich je Datei bzw. Schritt. Bei 641, 768 und 980 px ist jede Textspalte (Pfad der Dateiliste, Titel der Commit-Liste und der Schrittköpfe, Code-Bereich) mindestens 160 px breit. Der Umschalter passt bei 320 px mit beiden Teilen in die Zeile. Bei 320 und 414 px brechen Datei- und Schrittköpfe um, Zustandswort und „+p −m“ bleiben ganz sichtbar (S7).
- **Ziele:** Bei grobem Zeiger sind die Teile des Umschalters, die Schrittköpfe, „einzeln ansehen“ und die Verweise der Commit-Liste mindestens 48 × 48 px groß, bei feinem Zeiger mindestens 24 × 24 px (WCAG 2.5.8).
- **Kontrast:** Text ≥ 4,5:1, Rand und Fokusring ≥ 3:1, hell und dunkel, für den Umschalter in Ruhe, Hover, Fokus, „gewählt“ und „gewählt + Hover“ und für alle neuen Verweise in Ruhe und Hover; ebenso für „lädt …“, „wartet“, die Hinweissätze, „Folge · n Commits“ und die Fehlerfarben amber und rot (S6). „wartet“ und „lädt“ unterscheiden sich auch im Symbol (ruhende Sanduhr, Drehsymbol). Die Komponentenregel schlägt `a:hover` (`web/kd-base.css:4`, UX-Review #209 M2).
- **Last:** Höchstens eine Anfrage an `…/diff` zur Zeit je Seite; keine Wiederholung ohne Klick; die Rückkehr zu „Alle Änderungen“ kostet eine Anfrage (bei unbewegten Zweigen beantwortet der Server sie mit 304 nach zwei Git-Prozessen, ADR-0032 N6.10).
- **Zeichnen:** Budget 10.000 gezeichnete Zeilen beim ersten Aufbau, seitenweit. Gemessen liegt jede der 201 Karten der Geschichte von kanbanD darunter (höchstens 4.367 Zeilen, ADR-0033 N1 „Gemessen“); das Budget greift also nur bei Ausreißern.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API; jede Probe stellt ihre Aufgaben selbst her). Browser headless, Zeitzone `Europe/Berlin`, Mensch `sh`:

- **Repository R, Anwendung `kd` (Standardanwendung), wie R00208:** A0, dann auf `main` K1, F (fremd), K2; **#2** trägt `kd:<K1>`, `kd:<K2>`. **Rechenbeispiel:** `a.txt` ist eine Folge-Datei mit den Schritten K1 und K2 (je +1 −1), also +2 −2; `k.txt` ist netto (`neu`, +3). Damit hat #2 2 Dateien, 5 Zeilen hinzugefügt und 2 entfernt. **#3** trägt `kd:<L1>`, `kd:<L2>` und ist nur netto. **#7** ist „nicht linear“ wie R00208 #7.
- **#12 (Hinweise), in R:** N1, MK (Merge an der Aufgabe), N2 wie R00208 #6. Dazu `kd:<N1'>` (verwaist, wie K1' in R00208), `kd:<V2>` (gelöscht, `fehlt`), `xy:<K1>` (Anwendung nicht eingetragen) und ein unlesbarer Eintrag mit U+202E im Verweistext (über die Aufgabendatei wie R00205 #3). Reihenfolge der Verweise: die mit `kd:` zuerst.
- **#11 (drei Anwendungen):** Register mit `kd` (R), `wb` (Repository S) und `xx` (Repository T). In S liegen W1, fremd FS und W2 an derselben Datei, in T ein Commit X1. #11 trägt `kd:<K1>`, `kd:<K2>`, `wb:<W1>`, `wb:<W2>`, `xx:<X1>`. **Rechenbeispiel:** Die erste Antwort ist `kd`, `weitere_anwendungen` nennt `wb`, `xx`; also gibt es drei Abschnitte in dieser Reihenfolge.
- **#13 (nichts einbezogen):** nur `kd:<N1'>` (verwaist). **#14 (ohne Verweise):** keine Verweise.
- **Feste Antworten per `page.route`** (Zustände, die echtes Git nicht billig herstellt; die Form folgt R00208 FA 7, je Datei und Schritt höchstens 3.000 geänderte Zeilen wie die echten Grenzen): Budget (AK 5), `fremd_zu_viele`, `fremd_zu_gross`, `fremd_dazwischen {commits 3, dateien 5}`, unbekannte Art, `dateien_gekappt`, 503 je Abschnitt. Gehaltene Antworten werden über ein Promise freigegeben, ohne Schlafzeiten.
- Für die erneute Prüfung von R00207: dessen Aufgaben #1 und #6.

### Adresse und Umschalter

- [ ] **AK 1 Adresse, Umschalter, Titel und Ansage (N1.10 Probe 1):** Gegeben #2 aus der Liste der Commits über „Alle Änderungen ansehen“ geöffnet. Dann gilt:
  - Die Adresse ist `…/aufgabe/2/review` ohne `commit`, und die Seite zeigt „Alle Änderungen“ mit `aria-current="page"` an diesem Teil.
  - Der Titel heißt „Review #2 · Alle Änderungen — kanbanD“. Die Ansage lautet „Alle Änderungen der Aufgabe #2: 2 Dateien, 5 Zeilen hinzugefügt, 2 entfernt.“
  - „Ein Commit“ führt auf `?commit=kd:<K1>` und zeigt „1 von 2“. „Vor“ zeigt K2. „Alle Änderungen“ führt zurück auf `…/review`, und danach führt „Ein Commit“ auf `?commit=kd:<K2>` (zuletzt gezeigt).
  - Beide Teile sind `a[href]`. Ein Mittelklick öffnet einen Tab, und die Seite bleibt.
  - `history.length` ist über alle Umschaltungen gleich. **Ein** Browser-Zurück bzw. „Zurück zur Liste der Commits“ führt ins Fenster mit „Commits“.
  - Der Titel in „Ein Commit“ bleibt der aus R00207.
  - Ein Klick auf einen Schrittkopf und auf „einzeln ansehen“ ersetzt den Verlaufseintrag; `history.length` bleibt gleich (S4). Nach Browser-Zurück und -Vor zwischen Fenster und Seite stehen Fokus und Titel wie beim Öffnen (S9).
  - Der Umschalter steht auch, während die erste Antwort lädt, und beim Seitenfehler (S8).
  - Erneut geprüft: R00207 AK 1–10 und 6a grün, mit zwei Ausnahmen, die umgestellt sind und im Commit genannt werden: `…/review` ohne `commit` bleibt jetzt stehen, und für #6 aus R00207 steht der Rand (c) im Abschnitt (AK 4).

### Inhalt

- [ ] **AK 2 Folge-Datei und Netto-Datei (N1.10 Probe 2, Pre-Mortem f):** Gegeben #2, einmal direkt und einmal mit verzögerter Route und fester Antwort. Dann gilt:
  - Der Abschnitt heißt „Anwendung kd“ mit „2 Commits · 2 Dateien“.
  - `a.txt` zeigt im Kopf und in der Liste „+2 −2“ und „Folge · 2 Commits“ und **kein** Statuswort.
  - Aufgeklappt steht der Satz an der Folge-Datei aus FA 6, dann zwei Schrittköpfe „kd:<K1 kurz> <Titel> geändert +1 −1“ und „kd:<K2 kurz> …“. Sie sind Verweise auf `…/review?commit=kd:<K1>` bzw. `kd:<K2>`, und darunter steht je der Diff des Schritts.
  - `k.txt` steht mit Statuswort „neu“ und „+3“.
  - Die Summe jeder Folge-Datei ist gleich der Summe ihrer Schritte.
  - In keinem gezeichneten Code steht eine `+`/`−`-Zeile mit `FREMD`.
  - Mutanten „Statuswort aus dem ersten Schritt“ und „Summe aus dem letzten Schritt“ → je ein benannter Test rot.
- [ ] **AK 3 Hinweise in Worten (N1.10 Probe 7):**
  - Gegeben #2: Im Abschnitt steht wörtlich „Zwischen den Commits der Aufgabe liegt 1 fremder Commit. Er berührt Dateien der Aufgabe; 1 Datei steht deshalb als Folge der Schritte der Aufgabe. Die Änderungen des fremden Commits sind nicht zu sehen.“
  - Gegeben die feste Antwort `{commits 3, dateien 5}`: Dort steht der Satz in der Mehrzahl nach FA 6.
  - Gegeben #12:
    - „kd:<MK kurz> ist ein Merge und in diesem Gesamtbild ausgelassen.“ und „kd:<N1' kurz> ist verwaist: …“ tragen je „einzeln ansehen“ auf `?commit=kd:<MK>` bzw. `kd:<N1'>`. Der Klick zeigt den Diff des Commits.
    - Die Commit-Liste nennt „nicht einbezogen: Merge“ und „nicht einbezogen: verwaist“ als sichtbaren Text.
    - `kd:<V2>` steht mit „nicht mehr im Repository“ im Abschnitt.
    - `xy:<K1>` und der unlesbare Eintrag stehen **einmal** über dem Abschnitt, mit Zustandswort und Hinweis wie in der Liste der Commits. Der unlesbare Eintrag zeigt `⟨U+202E⟩` als Marke.
  - Gegeben #7 und die festen Antworten `fremd_zu_viele` und `fremd_zu_gross`: Über den Dateien steht je der Grund nach FA 6 mit „… einen zusammengefassten Diff der ganzen Aufgabe gibt es hier nicht.“, und jede Datei ist eine Folge-Datei.
  - Gegeben eine unbekannte Art `neu_art`: Es steht „Die Antwort nennt einen Hinweis „neu_art“, den diese Ansicht nicht kennt.“
  - Gegeben `dateien_gekappt {gezeigt 2000, gesamt 2431}`: Es steht „2.000 von 2.431 Dateien gezeigt. …“ nach FA 6.
  - Kein Satz enthält einen Hash eines fremden Commits.
- [ ] **AK 4 Leere, Fehler und Abschnittsfehler:**
  - Gegeben #13: Der Abschnitt sagt „Keine Änderungen zu zeigen.“ und „Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen. Die Commits lassen sich einzeln ansehen.“ und dem Hinweis „verwaist“ mit „einzeln ansehen“. „Ein Commit“ führt auf `?commit=kd:<N1'>`.
  - Gegeben #14: Es steht „Keine Änderungen zu zeigen“ mit „An dieser Aufgabe sind keine Commit-Verweise hinterlegt.“ und dem Rückweg.
  - **Gemischt** (PO Z. 443): Gegeben #13 mit zusätzlich `kd:<V2>` (`fehlt`): Der Abschnitt sagt weiter „Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen. Die Commits lassen sich einzeln ansehen.“, nennt `kd:<V2>` mit „nicht mehr im Repository“, und „Zu den Verweisen dieser Anwendung gibt es keinen Diff.“ steht nicht da. Gleiches gilt mit einem Merge statt des verwaisten Commits (feste Antwort `commits: []` mit `merge_ausgelassen` und `fehlt`). Mutant „Satz nur nach dem ersten Hinweis gewählt“ → benannter Test rot.
  - Gegeben #6 aus R00207 (keine Einträge mit Diff): Der Abschnitt `kd` sagt „Keine Änderungen zu zeigen.“ und nennt `kd:<V2>` und `xy:<K1>` mit Zustandswort. Der Teil „Ein Commit“ ist sichtbar und gedämpft, hat kein `href`, kein `role="link"`, ist kein Tab-Stopp (Tab geht von „Alle Änderungen“ direkt weiter) und erscheint im Barrierefreiheitsbaum nicht als Verweis (PO Z. 442). Eine eingetippte Adresse `?commit=kd:<V2>` zeigt den Fall aus R00207. Der zweite Satz ist „Zu den Verweisen dieser Anwendung gibt es keinen Diff.“ (FA 7, PO Z. 443).
  - Gegeben die erste Antwort ist gehalten: Es steht „Liest die Änderungen der Aufgabe …“ mit `role="status"` und `aria-busy`.
  - Gegeben die erste Antwort ist 503 „Antwortbudget …“: Es steht der Seitenfehler aus R00207 FA 8 mit „Erneut versuchen“. Er löst genau **eine** weitere Anfrage aus, und nichts wird von selbst wiederholt.
  - Gegeben #11 und der Abschnitt `wb` endet mit 503 „Zeitgrenze …“: Abschnitt `wb` zeigt „Die Änderungen der Anwendung wb ließen sich nicht lesen: <fehler> (503).“ mit „Erneut versuchen“. Die Abschnitte `kd` und `xx` sind lesbar, und `xx` lädt danach von selbst.
  - **(4a, UX-Vorprüfung M2)** Gegeben #11 und `wb` endet mit 503 „Antwortbudget …“: Der Abschnitt sagt „Server ausgelastet (Antwortbudget). Die Änderungen der Anwendung wb wurden nicht gelesen. Es wird nicht von selbst wiederholt.“, amber mit Server-Symbol, mit „Erneut versuchen“ und `role="alert"`; die Zeitgrenze ist rot mit Uhr. `kd` und `xx` bleiben lesbar. Mit Netzabbruch (`route.abort()`) sagt er „Die Änderungen der Anwendung wb ließen sich nicht lesen: keine Verbindung zum Programm.“ „Erneut versuchen“ liest genau einmal, nichts wird von selbst wiederholt, und der Fokus steht danach auf „Anwendung wb“. Mutant „Antwortbudget wie Zeitgrenze“ → benannter Test rot.

### Budget, Reihe, Nachladen

- [ ] **AK 5 Zeichenbudget seitenweit (N1.10 Probe 3, Pre-Mortem d):** Feste Antworten, gezeichnete Zeilen nach R00207 FA 6.
  - **(a)** Die Anwendung `kd` hat vier Netto-Dateien zu je 2.250 gezeichneten Zeilen, die Anwendung `wb` eine Netto-Datei zu 1.500. **Rechenbeispiel:** 4 × 2.250 = 9.000 ≤ 10.000, also sind die vier offen; 9.000 + 1.500 = 10.500 > 10.000, also bleibt die Datei von `wb` zu. Mutant „Budget je Anwendung neu“ → die Datei von `wb` öffnet → benannter Test rot.
  - **(b)** Eine Anwendung hat eine erste Netto-Datei zu 2.000, dann eine Folge-Datei mit drei Schritten zu je 2.800, dann eine Netto-Datei zu 100. **Rechenbeispiel:** 2.000 + 8.400 = 10.400 > 10.000, also bleibt die Folge-Datei ganz zu; die Datei zu 100 bleibt ebenfalls zu, denn nach der ersten, die nicht passt, öffnet keine. Mutanten „Schritte einzeln“ (öffnete Schritt 1 und 2: 4.800, 7.600) und „nach der Sperre weiter“ (öffnete die 100) → je ein benannter Test rot.
  - **(c)** Die erste Datei der Seite ist eine Folge-Datei mit vier Schritten zu je 2.800 und, zwischen dem zweiten und dritten, einem Schritt ohne `patch` (`gross`); danach folgt eine Netto-Datei zu 100. **Rechenbeispiel:** 4 × 2.800 = 11.200 > 10.000, aber die erste Datei der Seite öffnet immer, ganz, mit allen vier gezeichneten Schritten; der Schritt ohne `patch` zählt nicht und unterbricht nicht; die Datei zu 100 bleibt zu (11.300 > 10.000). Mutant „erste Datei immer je Abschnitt“ → in (a) öffnete die Datei von `wb` → benannter Test rot.
- [ ] **AK 6 Mehrere Anwendungen in einer Reihe (N1.10 Proben 4 und 9, Pre-Mortem a):** Gegeben #11, und die Antwort für `wb` ist gehalten. Dann gilt:
  - Der Abschnitt `kd` steht, `wb` zeigt „lädt …“ und „Lädt die Änderungen der Anwendung wb …“, und `xx` zeigt „wartet“ und „Wartet, bis die Anwendung wb geladen ist …“.
  - Die Leiste zählt nur `kd` und sagt „Anwendung wb lädt noch …“.
  - Wählt `sh` jetzt „Nachladen“ an einer Datei von `kd` (feste Antwort mit `nachladen`), startet die `datei=`-Anfrage erst nach dem Ende von `wb` und **vor** `xx`. Die Reihenfolge der Anfragen ist: `…/diff`, `anwendung=wb`, `datei=…&anwendung=`, `anwendung=xx`.
  - Ein Zähler gleichzeitiger Anfragen an `…/diff` ist über die ganze Probe **nie > 1**.
  - Ankommende Abschnitte verschieben nichts oberhalb der Leseposition: Die obere Kante eines sichtbaren Schrittkopfs von `kd` ändert sich bei 320 und 1280 px um höchstens 1 px (S5).
  - Die Insel trägt eine Marke (Eigenschaft am Element), die nach der Ankunft von `wb` und `xx` noch dasselbe Element bezeichnet. Ein Live-Ereignis an #11 (Kommentar über die API) löst keine Anfrage aus und lässt die Marke stehen.
  - Mutant „Anwendungen parallel“ → benannter Test rot.
- [ ] **AK 7 Nachladen mit `anwendung=` (N1.10 Probe 6, Pre-Mortem c):**
  - Gegeben #11 mit fester Antwort, in der je eine Datei gleichen Namens `README.md` in `kd` und `wb` den Zustand `nachladen` trägt. „Nachladen“ an der Datei von `wb` fragt `datei=README.md&anwendung=wb`, an der von `kd` `datei=README.md&anwendung=`, ohne `commit`. Jede zeigt danach den Inhalt ihrer Anwendung.
  - Mutant „ohne `anwendung`“ → die Datei von `wb` zeigt den Inhalt von `kd` (bzw. 404) → benannter Test rot.
  - Gegeben eine Folge-Datei mit `gross`: „Änderungen anzeigen“ ersetzt den Eintrag, und alle Schritte stehen offen.
  - Gegeben eine Folge-Datei mit `zu_gross_zum_anzeigen`: Es steht der Satz aus FA 6, ohne Knopf, und die Schrittköpfe führen auf `?commit=`.
  - **(7a, UX-Vorprüfung M2)** Gegeben „Nachladen“ an einer Netto-Datei und an einer Folge-Datei, und die Antwort ist 503 „Antwortbudget …“ bzw. 503 Zeitgrenze: Die Datei zeigt den Fehler nach R00207 FA 7 mit „Erneut versuchen“, ohne Wiederholung von selbst. Der Fokus steht danach auf dem Kopfknopf der Datei, nie auf `body`. Eine hinter ihr wartende Anwendung startet trotzdem. „Erneut versuchen“ liest genau einmal.

### Laden und Lesen

- [ ] **AK 8 Lauf-Kennung, Rückkehr und Live (N1.10 Proben 5 und 9, Pre-Mortem b, e):**
  - **(1)** Gegeben #11 und die Antwort für `wb` ist gehalten. `sh` wählt „Ein Commit“. Dann sieht die Route den Abbruch der Anfrage `anwendung=wb`. Nach der Freigabe erscheint kein Abschnitt, auch nicht nach Rückkehr auf „Alle Änderungen“ vor einer neuen Antwort. `xx` wird nicht mehr gelesen.
  - **(2)** Die Rückkehr zu „Alle Änderungen“ liest neu (genau eine neue Anfrage an `…/diff` ohne `anwendung`).
  - **(3)** Gegeben #2 ohne Route, im echten Programm: Dreimal hin und zurück umschalten zeigt jedes Mal den Abschnitt `kd`, nie „ließ sich nicht lesen (304)“. Keine Anfrage der Seite trägt einen von ihr gesetzten Kopf `If-None-Match` (Einheitentest am Aufruf von `diffHolen`).
  - **(4)** Gegeben #2 mit einer zugeklappten Datei, Textauswahl und Leseposition: Ein Live-Ereignis an #2 lässt die Insel als denselben Knoten (Marke), Klappen, Auswahl und Leseposition bleiben, und es gibt keine Anfrage.
  - Mutanten „Annahme über Kürzel statt Lauf“ und „kein `abort()` beim Umschalten“ → je ein benannter Test rot.

### Darstellung und Bedienung

- [ ] **AK 9 Breite, Ziele und Kontrast (N1.10 Probe 10):** Gegeben #2 (aufgeklappt), #11 (mit „lädt“ und „wartet“ gehalten) und #12. Dann gilt:
  - Bei 320, 414, **641, 768, 980** und 1280 px, hell und dunkel: `documentElement.scrollWidth ≤ documentElement.clientWidth`. Nur Code-Bereiche scrollen quer. Bei 641–980 px sind die Textspalten nach den nicht-funktionalen Anforderungen ≥ 160 px breit.
  - Teile des Umschalters, Schrittköpfe, „einzeln ansehen“ und die Verweise der Commit-Liste sind bei grobem Zeiger ≥ 48 × 48 px und bei feinem ≥ 24 × 24 px groß.
  - Der Umschalter hat in Ruhe, Hover (gehalten), Fokus, „gewählt“ und „gewählt + Hover“ Text ≥ 4,5:1 und Rand ≥ 3:1. Der Rand ist `--kd-muted`, und eine andere `.seg` der Anwendung behält ihren Rand.
  - Schrittköpfe, „einzeln ansehen“ und die Verweise der Commit-Liste haben in Ruhe und Hover Text ≥ 4,5:1, und die Komponentenfarbe schlägt `a:hover`.
  - Fokusringe haben ≥ 3:1.
  - „lädt …“, „wartet“, die Hinweissätze, „Folge · n Commits“ und die Fehler amber und rot haben Text ≥ 4,5:1 und Symbole ≥ 3:1 (S6).
  - Bei 320 und 414 px sind Zustandswort und „+p −m“ in Datei- und Schrittköpfen ganz sichtbar, nicht abgeschnitten (S7).
  - Mutanten „Rand `--kd-line-strong` am Umschalter“, „Hover aus `a:hover`“ und „Mindestbreite bei 641–980 px“ → je ein benannter Test rot.
- [ ] **AK 10 Tastatur, Fokus und Bedienhilfe (N1.10 Probe 8):** Gegeben nur die Tastatur auf #11. Dann gilt:
  - Tab erreicht in dieser Reihenfolge den Rückweg, „Alle Änderungen“, „Ein Commit“, „Alle einklappen“ bzw. „Alle aufklappen“, die Verweise seitenweiter Hinweise, dann je Abschnitt die Hinweis-Verweise, die Commit-Liste und die Dateien mit Schrittköpfen (S10).
  - Die Namen von Kopfknopf der Folge-Datei und Schrittkopf lauten nach FA 13 und beginnen mit dem sichtbaren Text (S3).
  - Nach dem Umschalten mit Enter steht der Fokus auf dem gewählten Teil.
  - Steht der Fokus auf einem Schrittkopf von `kd`, während `wb` und `xx` ankommen, steht er danach auf demselben Element.
  - Nach „Nachladen“ an einer Datei, die „wartet“ und dann „lädt“, steht der Fokus auf ihrem Kopfknopf. `document.activeElement` ist zu keinem geprüften Zeitpunkt `body`.
  - „lädt …“, „wartet“, „nicht einbezogen: verwaist“ und „Folge · 2 Commits“ sind sichtbarer Text, keiner davon ist `.vh`.
  - **Ansage (UX-Vorprüfung M1):** Die Live-Region existiert vor der ersten Antwort, leer. Ein `MutationObserver` sieht genau **eine** Textänderung, nachdem der letzte Abschnitt angekommen ist. Mit `wb` = 503 enthält die Ansage „ohne Anwendung wb: ließ sich nicht lesen“, und der Abschnittsfehler hat `role="alert"`. Nach erfolgreichem „Erneut versuchen“ an `wb` wird sie einmal neu gesetzt, ohne „ohne Anwendung wb“. Mutant „Region wird mit dem Text erzeugt“ → benannter Test rot.
  - Mutant „Fokus auf `body` beim Start der wartenden Datei“ → benannter Test rot.

## Betroffene Verzeichnisstruktur

- neu `web/gesamt.js` (rein, Node-testbar wie `web/diff.js`): Folge-Datei und Schritte, Hinweis → Satz und Ziel, Abschnitt je Anwendung, Umschalter, Summen und Ansage, Zuordnung der `datei=`-Antwort, Wahl der nächsten Anfrage der Reihe
- `web/diff.js` — nur nach N1.8: `aufklappPlan` mit Restbudget und „gesperrt“, Präfix der Kennungen in `dateiHtml`, `inselHtml`, `dateilisteHtml`, `diffFehlerHtml` nennt ohne Verweis die Ansicht
- `web/adresse.js` — `…/review` ohne `commit` als Ansicht „Alle Änderungen“
- `web/app.js` — Sicht „Alle Änderungen“ in `render()`, Reihe der Seite, Lauf-Kennung, Umschalter, Abschnitte in die stehende Insel
- `web/kd-app.css` — Umschalter `.seg.umsch`, Abschnitte, Schrittköpfe (nur Tokens)
- Tests: neu `e2e/einheit/gesamt.test.js`, `e2e/tests/r00210-alle-aenderungen.spec.js`; erweitert `e2e/einheit/diff.test.js` (B2-Fälle unverändert), `e2e/einheit/adresse.test.js`, `e2e/tests/r00207-review-seite.spec.js` (umgestellte Punkte), `ziele.spec.js`, `kontrast.spec.js`, `ziele-hilfen.js`

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

Interaction I0200, Bubbles B1041–B1048 in `Dokumentation/Planung/kanbanD.md`:

1. **B1041 Gesamt-Antwort deuten (rein):** Folge-Datei, Schritte, Hinweise in Worten, Summen, Ansage.
2. **B1042 Plan, Reihe, Zuordnung (rein):** Budget seitenweit, nächste Anfrage, Zuordnung der `datei=`-Antwort.
3. **B1043 Adresse und Umschalter:** `…/review` bleibt, zwei Verweise, `replaceState`, Ziel, Fokus, Titel.
4. **B1044 Zeichnen:** Insel, Abschnitte, Commit-Liste, Dateien, Schritte, Ränder.
5. **B1045 Laden in einer Reihe:** Anwendungen nacheinander, Lauf-Kennung, `abort()`, Abschnitt einhängen.
6. **B1046 Nachladen:** `datei=` mit `anwendung=`, Ersetzen, Fokus.
7. **B1047 Messen:** Breiten, Ziele, Kontrast in allen Zuständen, Tastatur.
8. **B1048 Probe im echten Programm, Gate, abschließen.**

### Hinweise

- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, `#alle-aenderungen` (Seite, Folge-Datei aufgeklappt, Umschalter in beiden Ansichten) und `#alle-raender` (ganz als Folge, mehrere Anwendungen, Fehler je Abschnitt und Datei, Folge-Datei in Randzuständen, ausgelassene Einträge, unbekannte Art, nichts einbezogen, Kappung, ganze Seite).
- **Wiederverwendet** (N1.8): `folge`, `patchZeilen`, `sichtbarHtml`, `pfadHtml`, `dateiZustand`, `codeHtml`, `merkmalSaetze`, `hinweisHtml`, `dateiFehlerHtml`, `fehlerArt`, `zuordnen`, `kurzVerweis`, `keineHtml`, `meldungHtml`, `knopf`; aus `web/app.js` `diffHolen` mit Fristen, `hauptbereichErsetzen`, `reviewDateiNeu`, `reviewErsterCommit`, `reviewZurueck`, `reviewOeffnen`.
- **Konflikte:** `web/diff.js` ist auch der Ort von B4 (#216). Darum kommt Neues nach `web/gesamt.js`, und `diff.js` ändert sich nur an den Stellen aus N1.8.
- **Review-Punkt für `code-reviewer`** (Pre-Mortem e): Die Oberfläche setzt kein `If-None-Match`.
- **Lehren #209:** Nebenläufige Antworten werden über die Lauf-Kennung verworfen, nie über einen Index. Der Fokus wird nach jedem Neuzeichnen zurückgegeben. Der Kontrast wird auch im Hover gemessen. Die Breiten 641/768/980 sind Pflicht. Zustandswörter sind nie `.vh`.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node, `e2e/einheit/gesamt.test.js`):** Folge mit 1 und 2 Schritten, Schritt ohne passenden Eintrag in `commits` (neutraler Kopf, kein Verweis), Ein- und Mehrzahl von `fremd_dazwischen`, drei Gründe, unbekannte Art, Entdoppeln seitenweiter Hinweise nach Verweis; Summen und Ansage (0, 1, 1.059 mit Tausenderpunkt); Budget (a)–(c) aus AK 5 und B2-Fälle unverändert; Reihe (laufend + wartende Datei + zwei Anwendungen → Datei zuerst; laufend nie überholt); Zuordnung (zwei gleichnamige Folge-Einträge, Artwechsel Netto ↔ Folge).
- **E2E (Playwright, headless):** AK 1–10 gegen das gestartete Programm. Antworten werden per `page.route` gehalten und über ein Promise freigegeben, ohne Schlafzeiten. Ein Zähler zählt gleichzeitige `…/diff`-Anfragen. Verneinungen werden erst nach einem sichtbaren Signal geprüft.
- **Mutanten** (jeder macht einen benannten Test rot, die Commit-Nachricht nennt ihn): Statuswort aus dem ersten Schritt; Summe aus dem letzten Schritt; Budget je Anwendung neu; erste Datei immer je Abschnitt; Folge-Schritte einzeln geöffnet; nach der Sperre weiter geöffnet; Anwendungen parallel; `datei=` hinter allen Anwendungen; ohne `anwendung=`; Annahme über Kürzel statt Lauf; kein `abort()` beim Umschalten; Insel neu aufgebaut; `If-None-Match` gesetzt; `pushState` beim Umschalten; Rand an der Basis `.seg`; Rand `--kd-line-strong`; Hover aus `a:hover`; Mindestbreite bei 641–980 px; Fokus auf `body` beim Start der wartenden Datei; Zustandswort als `.vh`; `esc` am Verweis eines `unlesbar`-Hinweises entfernt; Region der Ansage mit dem Text erzeugt; Antwortbudget am Abschnitt wie Zeitgrenze; „Ein Commit“ ohne Ziel mit `href` oder `role="link"`.

## Abhängigkeiten

- Abhängig von: [R00208](R00208-gesamt-diff-der-karte-per-api-lesen.md) (I0198, Karte #214, `braucht:214`, in den Reviews auf `karte/214`), [R00207](R00207-review-seite-eines-commits.md) (I0197, Karte #209, erledigt), ADR-0033 N1, Artboard D0009 (freigegeben mit Änderung).
- Berührt, ohne abzuhängen: B4 #216 (Syntaxfarben in `codeHtml`, darum Neues in `web/gesamt.js`); #220 (Zwilling verwaister Commits, später als Satz am Hinweis `verwaist`).

## Offene Fragen

- Keine. Entschieden am 2026-11-20: „Ein Commit“ ohne Commit mit Diff (PO Z. 442, FA 2, AK 4); zweiter Satz bei `commits: []` (PO Z. 443, FA 7, AK 4); „Aufgabe“ in allen Texten der Oberfläche (PO Z. 444).

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Seit R00207 liest der Mensch jeden Commit einzeln. Das Gesamtbild setzt er im Kopf zusammen, und was ein späterer Commit zurücknimmt, liest er doppelt. R00208 rechnet das Gesamtbild auf dem Server und hält fremde Arbeit heraus. Diese Anforderung zeigt es unter derselben Adresse, die der Knopf „Alle Änderungen ansehen“ seit B2 öffnet. Ein Klick zeigt die Arbeit der Aufgabe als ein Bild. Wo fremde Commits dazwischenliegen, nennt die Seite das in Worten und zeigt die Schritte nacheinander. Jeder ausgelassene Commit ist mit einem Klick einzeln lesbar. Weil große Antworten nacheinander laden, verlassene Anfragen abgebrochen werden und das Budget für die ganze Seite gilt, bleibt die Seite auch bei großen Aufgaben und mehreren Anwendungen bedienbar, ohne den Server zu überlasten.

## Notizen

- **Schlank arbeiten (A):** zehn Kriterien auf der Grundlage der zehn Proben aus ADR-0033 N1.10. Grenzfälle der reinen Rechnung (Einzahl, Zuordnung, Reihe) gehören in die Unit-Tests des entwicklers.
- **Optionen** sind in ADR-0033 N1 abgewogen und entschieden: Adresse H1 (statt `pushState` H2 oder eigener Adresse H3), ganz als Folge G2 je Datei (statt G1 je Commit oder Umleitung G3, PO Z. 438), Nachladen N1 mit `datei=&anwendung=` (statt je Schritt N2 oder ganzer Anwendung N3).
- **Verworfen:** Commit-Auswahl als Dropdown (PO Z. 416, N1.1); Band „neu laden“ (PO Z. 441); Hashes fremder Commits (die API liefert sie nicht); Statuswort an der Folge-Datei (N1.4); eigenes `If-None-Match` (N1.2).
- **Herleitung der Zahlen:** Das Budget von 10.000 Zeilen stammt aus ADR-0033 Punkt 5. 3.000 Zeilen je Datei und Schritt sind die Grenze aus R00206/R00208; darum sind die Budget-Beispiele aus N1.10 Probe 3 (Schritte zu 6.000 und 5.000) auf Schritte zu 2.800 umgerechnet, mit derselben Aussage. Die Verteilung (Median 13 Dateien, Folge-Dateien in 21 % der Karten, keine über 10.000 Zeilen) ist gemessen (ADR-0033 N1 „Gemessen“).
