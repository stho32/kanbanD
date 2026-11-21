---
id: R00219
status: Neu
datum: 2026-11-21
---

# R00219: Ansicht „Läufe“ im Aufgabenfenster

## Beschreibung

Karte #217, Scheibe D1 des Feinschnitts (Zuschnitt PO Z. 384–388). Technik [ADR-0039](../Dokumentation/ADRs/0039-reiter-laeufe-zusammenfuehren-in-der-seite-ueber-die-kennung.md) (Akzeptiert), Produkt `AI-Team/po-entscheidungen.md` Z. 466–470, Freigabe der Zeichnung und Wortlaute Z. 471–477.

**Umfang:** Hat eine Aufgabe abgelegte Transkripte ([R00216](R00216-transkripte-der-agentenlaeufe-ablegen.md)), gibt es im Ansichtsmenü des [Aufgabenfensters](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) die Ansicht „Läufe“. Sie zeigt je Agentenlauf eine Zeile: Transkript und Kosteneintrag mit derselben Kennung stehen in einer Zeile, ein Teil ohne Partner steht allein. Ein Lauf, dessen Transkript nicht auf diesem Rechner liegt, sagt das; ein Lauf, für den nie ein Transkript abgelegt wurde, sagt das anders. **Keine Laufansicht** (D2, #210), **kein Ziel an einer Zeile**, kein Herunterladen, kein Verweis auf „Einrichten“ (C2, #218). Am Server, an OpenAPI und am Format ändert sich nichts.

**Name:** „Ansicht“, nicht „Reiter“ — es gibt keine Reiterleiste mehr ([R00145](R00145-aufgabenfenster-ansichtsmenue-anhaenge-im-inhalt.md)); „Aufgabe“, nie „Karte“.

**Zeichnung:** D1 ist in D0009 (`#laeufe`) baufertig gezeichnet und vom product-owner freigegeben, mit der Änderung „1 Lauf“ im Statusbereich (PO Z. 471); die Wortlaute 1–13 sind festgelegt (PO Z. 472, 474). Die Zeichnung ist die Quelle für Aussehen, Abstände und Anordnung; diese Anforderung legt Verhalten und Inhalte fest. Die Wortlaute stehen hier wörtlich; Kopf (Wortlaut 8) und Zustand „leer“ (Wortlaut 11) stehen nur in der Zeichnung, der Verweis „In „Einrichten“ umschalten“ (Wortlaut 13) gehört zu C2 (#218).

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109: „die Läufe der Agenten, die an ihr gearbeitet haben“) und „Live überall, egal woher die Änderung kommt“ (Z. 88).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — die Ansicht ist eine Ansicht darin, gewählt über das Ansichtsmenü
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) — Kosten und Zustand folgen Ereignissen ohne Neuladen
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — bis einschließlich 640 px
- Lauf, Transkript, Kosteneintrag und Kennung fehlen im Glossar; bis dahin gelten die Wörter von R00216 und ADR-0028 (Kennung `role@at`).

## Geschäftlicher Nutzen

Wer eine Aufgabe in der Abnahme prüft, sieht an einer Stelle, welche Agenten wann und in welcher Spalte an ihr gearbeitet haben, was jeder Lauf gekostet hat und ob sein Transkript auf diesem Rechner liegt. Heute stehen Beträge in „Kosten“ und Transkripte nur in der API; welche zusammengehören, muss man an der Kennung selbst vergleichen.

## Funktionale Anforderungen

1. **Ort und Sichtbarkeit:** „Läufe“ steht im Ansichtsmenü in der Reihenfolge Kosten · Commits · Läufe · Verlauf (fehlende Einträge rücken auf) und **nur**, wenn `transkripte` der Aufgabe aus `GET /api/aufgaben/{nr}` nicht leer ist — ohne Lesen. Eine Aufgabe nur mit Kosteneinträgen hat kein „Läufe“ (ADR-0039 Punkt 5, PO Z. 466). Entfällt der letzte Eintrag, gilt die Regel von R00145 für jede entfallende Ansicht („Inhalt“, Fokus auf dem Auslöser „Ansicht: Inhalt“).
2. **Zusammenführen** (ADR-0039 Punkte 1–3): Schlüssel ist allein die `kennung` des Servers, als Text verglichen; die Spalte zählt nicht. Ein Transkript ohne Kosteneintrag und ein Kosteneintrag ohne Transkript stehen je allein. Ein Eintrag „nicht lesbar“ ohne Kennung wird nie zugeordnet. Doppelte Kennungen aus einer von Hand bearbeiteten Datei paaren sich der Reihe nach; nichts wird zusammengezählt oder verworfen.
3. **Zeile je Lauf:** Zeitpunkt, Rolle, Spalte, Betrag (Form wie in der Ansicht „Kosten“, etwa „1,80 $“) und Zustand. Hauptangabe ist die Spalte des Transkripts; weicht die Spalte des Kosteneintrags ab, steht sie als Nebentext „Kosten gebucht in <Spalte>“, nicht als Fehler. Eine Zeile ohne Transkript zeigt die Spalte des Kosteneintrags. Eine Zeile ohne Kosten zeigt als Betrag „—“, vorgelesen „kein Betrag“ (Wortlaut 7, PO Z. 472). Keine Zeile ist ein Ziel (ADR-0039 Punkt 9).
4. **Zustände** (übernommen aus der Antwort, ohne eigene Deutung; je mit sichtbarem Wort, nie nur Farbe; Wortlaute 1–6, PO Z. 472):

   | Lage | Wort |
   |---|---|
   | `vorhanden` | kein sichtbares Wort; vorgelesen „Transkript vorhanden“ |
   | `fehlt` | liegt nicht auf diesem Rechner |
   | `abweichend` (Größe der Datei ≠ `bytes`) | Datei weicht vom abgelegten Stand ab |
   | `unlesbar` | Eintrag nicht lesbar |
   | Kosteneintrag ohne Transkript | kein Transkript abgelegt (gedämpft, ohne Marke) |
   | Kosteneintrag, nur wenn das Lesen scheitert (FA 8) | Transkript nicht gelesen |

   „kein Transkript abgelegt“ ist kein `fehlt`: es gibt keinen Eintrag, dessen Datei fehlen könnte (ADR-0039 Punkt 4, PO Z. 466). „Transkript nicht gelesen“ ist keines von beiden: ohne Antwort weiß die Seite nicht, ob ein Transkript da ist (PO Z. 474).
5. **Reihenfolge:** neueste zuerst nach dem Zeitpunkt der Kennung; bei Gleichstand die Reihenfolge der Datei, Transkripte vor Kosteneinträgen ohne Transkript; Zeilen ohne Kennung am Ende (ADR-0039 Punkt 8, PO Z. 469).
6. **Hinweis bei ausgeschaltetem Erfassen:** Liefert die Antwort `erfassen: false`, steht über der Liste eine Hinweiszeile mit den Boards aus `boards_aus`: „Auf „<Board>“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.“ (Wortlaut 12; mehrere Boards wie in D0009 `#laeufe`) — nur als Text; den Verweis auf „Einrichten“ bringt C2 (#218).
7. **Lesen:** `GET /api/aufgaben/{nr}/transkripte` beim Öffnen der Ansicht, über „Neu lesen“, über „Erneut versuchen“ und **genau einmal**, wenn sich die Menge der Kennungen in `transkripte` der Aufgabe nach einem Live-Ereignis gegenüber der letzten Antwort ändert (ADR-0039 Punkt 6, L2). Kosten zeichnen bei jedem Ereignis neu, ohne Lesen. Bis die Antwort da ist, bleiben die alten Zeilen stehen, und der Statusbereich meldet „Liest die Läufe …“; nach dem Lesen meldet er „<n> Läufe · Stand hh:mm:ss“, bei genau einem Lauf „1 Lauf · Stand hh:mm:ss“, bei Fehler „Die Läufe ließen sich nicht lesen.“ (Wortlaut 9, PO Z. 471). Ein neues Transkript erscheint nicht vorab ohne Zustand. Eine späte Antwort wird verworfen, wenn inzwischen neu gelesen wurde, die Aufgabe gewechselt hat oder die Ansicht nicht mehr gezeigt wird (ADR-0014).
   **Warum anders als „Commits“:** Anders als „Commits“ liest „Läufe“ bei Live-Ereignissen selbst neu. Ablegen und Löschen eines Transkripts kommen über die API von kanbanD und lösen ein Live-Ereignis aus, und das Lesen braucht kein Git im Arbeits-Repository; der Grund, aus dem „Commits“ nur beim Öffnen und über „Neu lesen“ liest (Git im Arbeits-Repository, kein Ereignis; R00205 FA 2, PO Z. 403), trifft hier nicht zu. Ohne Nachlesen stünde ein neu gebuchter Betrag neben einer Zeile ohne Zustand (PO Z. 467).
8. **Fehler:** Scheitert das Lesen, steht über der Liste „Die Läufe ließen sich nicht lesen: <`fehler` der Antwort> (<Status>).“ bzw. ohne Verbindung „Die Läufe ließen sich nicht lesen: keine Verbindung zum Programm.“ (Wortlaut 10, Form wie R00205 FA 8) mit „Erneut versuchen“; die Kosteneinträge der Aufgabe bleiben dabei als Zeilen mit Betrag sichtbar. Ihr Zustand heißt dann „Transkript nicht gelesen“, nie „kein Transkript abgelegt“ (PO Z. 474).
9. **Fremder Text bleibt Text:** Rolle, Spalte und Boardnamen stammen aus Dateien, die jeder bearbeiten kann; nichts davon wird als HTML gedeutet, Bidi-Steuerzeichen werden entfernt (ADR-0030, wie `web/commits.js`).

## Nicht-funktionale Anforderungen

- **Performance (Messprobe, Tag-Kriterium, ADR-0039 Punkt 7):** 1.000 Transkripte und 1.000 Kosteneinträge an einer Aufgabe, Release-Build: `GET …/transkripte` warm p95 < 200 ms, Antwort < 250.000 Byte; Zeichnen der Ansicht in Chromium < 100 ms je `render()`. Gemessen nur tagsüber (8–21 Uhr) bei 1-Minuten-Last ≤ 6 beim Start; nachts gemessene Werte gelten nicht (Lehre #230). Lastbeobachtung, kein Zeittest im Gate. Herleitung der Grenzen: ADR-0039 (Lastprofil lesend p95 < 200 ms; vermutet 1.000 × ≈ 150 B ≈ 150 KB, nicht gemessen).
- **Breite:** bei 320, 414, 641, 768, 980 und 1280 px, hell und dunkel, in jedem Zustand `document.documentElement.scrollWidth ≤ clientWidth`; nichts ragt über die rechte Kante (Lehren #212, #220).
- **Ziele:** bei grobem Zeiger jedes Bedienziel der Ansicht mindestens 48 × 48 px.
- **Themen:** Kontrastprobe des Projekts (`kontrastVerstoesse`, 4,5:1 Text, 3:1 Symbole und Ränder).
- **Last:** Ein Live-Ereignis, das die Kennungsmenge nicht ändert (Kommentar, Timer, Kosten), liest nie (ADR-0039 L3 verworfen).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API und Dateien des Board-Ordners, wie in R00216). Mensch `sh`, Agent `entw1`, Browser headless in `Europe/Berlin`. Board `fabrik` mit `record-transcripts: true`, Board `zweit` mit `record-transcripts: false` (in der Board-Datei von Hand gesetzt; keine Route setzt den Schalter, R00216 AK 5).

- **#1 (fabrik, für AK 3–7):** sechs Läufe, abgelegt bzw. gebucht über die API:

  | Lauf | Kennung | Transkript (Spalte, Zustand) | Kosteneintrag (Spalte, Betrag) |
  |---|---|---|---|
  | L1 | `planer@2026-11-20T09:00+01:00` | Detailplanung, `vorhanden` | Detailplanung, 0,42 USD |
  | L2 | `entwickler@2026-11-20T10:00+01:00` | Entwicklung, `vorhanden` | Reviews, 1,80 USD |
  | L3 | `code-reviewer@2026-11-20T11:00+01:00` | Reviews, Datei danach im Ordner gelöscht → `fehlt` | — |
  | L4 | `entwicklertester@2026-11-20T12:00+01:00` | — | Entwicklertest, 0,30 USD |
  | L5 | `architekt@2026-11-20T08:00+01:00` | Architektur, Datei um ein Byte verlängert → `abweichend` | Architektur, 0,55 USD |
  | L6 | — | Eintrag in `transcripts` von Hand formwidrig gemacht → `unlesbar`, `kennung: null` | — |

- **#2 (fabrik):** nur ein Kosteneintrag (0,10 USD), kein Transkript.
- **#3 (zweit):** ein Transkript, abgelegt solange `zweit` noch erfasste, danach Schalter aus und ein Kosteneintrag `entwickler@2026-11-21T09:00+01:00` ohne Transkript.
- **#4 (fabrik, Breitendaten und fremder Text, für AK 8–10):** ein Lauf mit Rolle aus 40 Zeichen, ein Kosteneintrag mit Spalte aus 60 Zeichen ohne Leerzeichen (abweichend von der Spalte des Transkripts), ein Kosteneintrag mit Spalte `<img src=x onerror=window.pwn=1> "x"` samt U+202E; dazu alle Zeilenarten aus #1. Für den Hinweis: ein zweites ausgeschaltetes Board mit Namen aus 60 Zeichen.

### Messprobe und Zusammenführen

- [ ] **AK 1 Messprobe (Tag-Kriterium, nicht im Nachtbetrieb, zuerst).** Gegeben ein Wegwerf-Board mit einer Aufgabe mit 1.000 Transkripten (Dateien vorhanden) und 1.000 Kosteneinträgen gleicher Kennungen und der Release-Build, wenn tagsüber (8–21 Uhr, 1-Minuten-Last ≤ 6 beim Start, `nice -n 10`) nach 5 Aufrufen zum Anwärmen 20-mal `GET …/transkripte` gerufen wird, dann ist der p95 (der 19. von 20 aufsteigend sortierten Werten) < 200 ms und die Antwort < 250.000 Byte; und wenn die Ansicht „Läufe“ dieser Aufgabe in Chromium 20-mal neu gezeichnet wird, dann dauert jedes `render()` < 100 ms. Messwerte, Uhrzeit und Last stehen im Bericht. **Reißt eine Grenze, hält die Karte** mit der Frage an den architekt (Abhilfe dann Zeichnen in Stücken oder Seiten, kein Umbau am Server). Der Teil am Server läuft vor der Zeichnung, der Teil Zeichnen nach ihr.
- [ ] **AK 2 Zusammenführen über die Kennung** (Node, ADR-0039 „Durchsetzung“):
  - (a) Gegeben ein Transkript `entwickler@2026-11-20T10:00+01:00` in „Entwicklung“ und ein Kosteneintrag gleicher Kennung in „Reviews“, dann entsteht **eine** Zeile mit beiden Spalten.
  - (b) Ein Transkript ohne Kosteneintrag ergibt eine Zeile mit `kosten: null`.
  - (c) Ein Kosteneintrag ohne Transkript ergibt eine Zeile mit `transkript: null`, und ihr Zustand ist nicht `fehlt`.
  - (d) Ein `unlesbar`er Eintrag ohne Kennung wird keinem Kosteneintrag zugeordnet, auch wenn nur einer da ist.
  - (e) Je zwei Transkripte und zwei Kosteneinträge derselben Kennung ergeben genau zwei Paare (erstes mit erstem, zweites mit zweitem, in der Reihenfolge der Datei).
  - (f) Gegeben die Kennung des Servers `entwickler@2026-11-20T14:00+01:00` an beiden Seiten, obwohl der Kosteneintrag von Hand mit `2026-11-20T13:00:00Z` geschrieben wurde, dann eine Zeile; verglichen wird nur die Kennung des Servers, die Seite bildet keine eigene.
  - Reihenfolge: aus #1 entsteht L4, L3, L2, L1, L5, L6 (neueste zuerst, ohne Kennung am Ende).
  - **Mutant „Spalte gehört zum Schlüssel“** macht (a) rot.

### Menü, Zeilen, Hinweis

- [ ] **AK 3 Ort und Sichtbarkeit:** Gegeben #1 mit Kosten und ohne Commits, dann nennt das Ansichtsmenü `…, Datei, Kosten, Läufe, Verlauf`; mit einem Commit-Verweis `…, Kosten, Commits, Läufe, Verlauf`. Gegeben #2 nur mit Kosten, dann steht „Läufe“ nicht im Menü, und es wird kein `GET …/transkripte` gesendet (geprüft, nachdem das Menü sichtbar steht). Gegeben „Läufe“ ist an #1 offen und alle Transkripte werden über die API gelöscht, dann entfällt der Eintrag, das Fenster zeigt „Inhalt“, und der Fokus steht auf dem Auslöser „Ansicht: Inhalt“ (nie auf `body`).
- [ ] **AK 4 Zeilen, Zustände, Reihenfolge:** Gegeben #1, wenn „Läufe“ geöffnet wird, dann stehen sechs Zeilen in der Reihenfolge L4, L3, L2, L1, L5, L6:
  - L4 „kein Transkript abgelegt“, Spalte „Entwicklertest“, „0,30 $“;
  - L3 „liegt nicht auf diesem Rechner“, Spalte „Reviews“, Betrag „—“;
  - L2 Spalte „Entwicklung“ mit dem Nebentext „Kosten gebucht in Reviews“, „1,80 $“, kein Fehlerwort;
  - L1 Spalte „Detailplanung“, „0,42 $“, kein Nebentext, kein Fehlerwort;
  - L5 „Datei weicht vom abgelegten Stand ab“, „0,55 $“;
  - L6 „Eintrag nicht lesbar“, Betrag „—“.
  - Die drei Wörter „kein Transkript abgelegt“, „liegt nicht auf diesem Rechner“ und „Eintrag nicht lesbar“ sind paarweise verschieden und sichtbar (nicht in der Klasse für nur-vorlesbaren Text, Rechteck größer 0, ohne `opacity:0`). Keine Zeile ist ein Ziel: kein `a[href]` in der Liste, ein Klick auf eine Zeile ändert weder Adresse noch Ansicht.
- [ ] **AK 5 Hinweis bei ausgeschaltetem Erfassen:** Gegeben #3 auf `zweit` (Antwort `erfassen: false`, `boards_aus: ["zweit"]`), dann steht über der Liste die Hinweiszeile „Auf „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.“, und darunter die Zeile „kein Transkript abgelegt“ für `entwickler@2026-11-21T09:00+01:00`. Gegeben #1 (`erfassen: true`), dann steht keine Hinweiszeile.

### Lesen

- [ ] **AK 6 Live und genau ein Lesen** (Zähler über `page.route`, Antworten gehalten und über ein Promise freigegeben, keine Schlafzeiten; jede Verneinung erst nach einem sichtbaren Signal):
  - Beim Öffnen von „Läufe“ an #1 genau ein `GET …/transkripte`; „Neu lesen“ genau ein weiteres.
  - Gegeben „Läufe“ ist an #1 offen, wenn `entw1` für L3 einen Kosteneintrag 0,25 USD bucht, dann zeigt die Zeile L3 „0,25 $“, und es folgt **kein** `GET …/transkripte`.
  - Wenn `entw1` ein Transkript `entwicklertester@2026-11-20T12:00+01:00` für L4 ablegt, dann folgt **genau ein** `GET …/transkripte`; solange die Antwort gehalten ist, steht L4 weiter mit „kein Transkript abgelegt“ und der Statusbereich meldet „Liest die Läufe …“; nach der Freigabe steht L4 ohne dieses Wort mit Zustand.
  - Wenn `entw1` das Transkript von L1 löscht, dann genau ein `GET …/transkripte`, und L1 steht danach als „kein Transkript abgelegt“.
  - Wenn `sh` einen Kommentar an #1 schreibt, dann folgt kein `GET …/transkripte` (geprüft, nachdem der Kommentar sichtbar ist).
  - Wird die Datei von L2 im Ordner gelöscht, ohne dass sich der Eintrag ändert, zeigt L2 „liegt nicht auf diesem Rechner“ erst nach „Neu lesen“ (kein Ereignis, Inkauf ADR-0039).
  - **Mutant** „liest bei jedem Live-Ereignis“ macht die Kommentar-Probe rot.
- [ ] **AK 7 Späte Antwort und Fehler:**
  - Gegeben die Antwort für #1 ist gehalten, wenn auf #3 gewechselt und danach freigegeben wird, dann zeigt #3 nur seine eigenen Zeilen und seinen Hinweis; dasselbe beim Wechsel von „Läufe“ auf „Inhalt“ (nach der Freigabe bleibt „Inhalt“). Gegeben zwei Lesungen in Folge, deren erste zuletzt antwortet, dann gilt die zweite. **Mutant** ohne „Aufgabe noch dieselbe“ macht die Probe rot.
  - Gegeben `GET …/transkripte` antwortet 503 (per `page.route`), dann steht „Die Läufe ließen sich nicht lesen: <`fehler` der Antwort> (503).“ mit „Erneut versuchen“, und die Kosteneinträge von #1 (L4, L2, L1, L5) stehen weiter mit ihren Beträgen und je dem Wort „Transkript nicht gelesen“; „kein Transkript abgelegt“ steht an keiner dieser Zeilen. Ein Klick auf „Erneut versuchen“ liest genau einmal und zeigt bei Erfolg die sechs Zeilen. Ohne Verbindung steht „Die Läufe ließen sich nicht lesen: keine Verbindung zum Programm.“.

### Darstellung und Bedienung

- [ ] **AK 8 Fremder Text:** Gegeben #4, dann stehen die Spalte `<img src=x onerror=window.pwn=1> "x"` und die Rolle aus 40 Zeichen zeichengleich als Text da (ohne U+202E), es entsteht kein `img` im Dokument, `window.pwn` ist nicht gesetzt, und `title`- bzw. `aria-label`-Attribute enthalten den Text unverändert.
- [ ] **AK 9 Breite und Ziele:** Gegeben #4 und #3, dann gilt bei 320, 414, 641, 768, 980 und 1280 px, hell und dunkel, in den Zuständen Liste, Laden, Fehler und Hinweis: `documentElement.scrollWidth ≤ documentElement.clientWidth`, `scrollWidth ≤ clientWidth` des Aufgabenfensters, und das letzte Zeichen der Spalte aus 60 Zeichen, des Nebentexts und des Boardnamens im Hinweis liegt innerhalb des Fensters (per `Range` und `getClientRects()`). **Mutationsprobe:** `white-space: nowrap` an der Spalte und am Nebentext macht die Probe je rot. Bei grobem Zeiger ist jedes Bedienziel („Läufe“ im Menü, „Neu lesen“, „Erneut versuchen“) mindestens 48 × 48 px.
- [ ] **AK 10 Themen, Tastatur, Fokus und Ansage:** Gegeben Hell und Dunkel, dann hat in den Zuständen Liste, Laden, Fehler und Hinweis kein Text der Ansicht weniger als 4,5:1 und kein Symbol oder Rand einer Zustandsmarke weniger als 3:1. Mit der Tastatur ist „Läufe“ im Ansichtsmenü wie die anderen Einträge erreichbar und wählbar (danach heißt der Auslöser „Ansicht: Läufe“); Tab erreicht „Neu lesen“ und bei Fehler „Erneut versuchen“; jeder Fokus ist sichtbar. Nach dem Lesen meldet ein Statusbereich (`role="status"`, schon im Laden-Zustand im Dokument und derselbe Knoten) die Zahl der Läufe bzw. den Fehler, ohne den Fokus zu bewegen: an #1 `6 Läufe · Stand hh:mm:ss`, bei 503 „Die Läufe ließen sich nicht lesen.“. **Einzahl:** Gegeben eine Aufgabe auf `fabrik` mit genau einem über die API abgelegten Transkript und keinem Kosteneintrag, dann lautet der Statusbereich `1 Lauf · Stand hh:mm:ss` (geprüft mit `^1 Lauf · Stand \d{2}:\d{2}:\d{2}$`), nie „1 Läufe“. **Fokus:** Nach „Neu lesen“ bleibt der Fokus auf „Neu lesen“; nach erfolgreichem „Erneut versuchen“ geht er auf „Neu lesen“ — beides nur, wenn er beim Eintreffen der Antwort noch am Auslöser liegt; hat `sh` ihn inzwischen weitergesetzt, bleibt er dort. Ein Lesen durch ein Live-Ereignis bewegt den Fokus nie. Das Fokusziel ist weder selbst Live-Region (`role="status"`, `aria-live`) noch liegt es in einer.

## Betroffene Verzeichnisstruktur

- neu `web/laeufe.js` — reine Funktionen (Zusammenführen, Ordnen, Zeilenwerte), im Browser und in Node nutzbar wie `web/commits.js`
- `web/reiter.js` — Eintrag „Läufe“ und seine Sichtbarkeit; `web/ansicht.js` — Panel neben `vCommitsPanel` und `vKostenPanel`; `web/app.js` — Lesen neben `commitsLesen` und der Auslöser beim Live-Ereignis
- `web/kd-*.css` — Stil nur mit Tokens aus `kd-tokens.css`
- Tests: neu `e2e/einheit/laeufe.test.js`, `e2e/tests/r00219-ansicht-laeufe.spec.js`, `tests/lastprobe_r00219.rs` (`#[ignore]`, `--release`); erweitert `e2e/einheit/reiter.test.js`, `e2e/tests/r00145-ansichtsmenue.spec.js` (Reihenfolge), Ziel-, Breiten- und Kontrastproben

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1125 Messprobe am Server** (Tag-Kriterium, ohne Zeichnung): Wegwerf-Board mit 1.000 + 1.000 Einträgen → p95 und Größe der Antwort (AK 1, Teil Server).
2. **B1126 Zusammenführen und ordnen, rein** (ohne Zeichnung): Antwort + `a.kosteneintraege` → Zeilen (AK 2).
3. **B1127 Menüeintrag** (nach der freigegebenen Zeichnung): `transkripte` der Aufgabe → Eintrag in `REITER` zwischen „Commits“ und „Verlauf“ (AK 3).
4. **B1128 Liste zeichnen** (nach der freigegebenen Zeichnung): Zeilen + `erfassen`/`boards_aus` → Kopf, Zeilen, Nebentext, Hinweis; Messprobe Zeichnen (AK 1 Teil Zeichnen, AK 4, 5, 8).
5. **B1129 Lesen L2** (nach der freigegebenen Zeichnung): Öffnen, „Neu lesen“, Kennungsmenge, späte Antwort, Fehler (AK 6, 7).
6. **B1130 Breite, Ziele, Themen, Tastatur, Fokus** (nach der freigegebenen Zeichnung): sechs Breiten, beide Themen, alle Zustände (AK 9, 10).
7. **B1131 Probe im echten Programm, Gate, Anforderung abschließen** (AK 1–10).

### Grobentwurf

**Einstiegsstellen:** Ansichtsmenü (`web/reiter.js:8–13`), Panel in `web/ansicht.js`, Lesen und Live-Auslöser in `web/app.js` (Muster `commitsLesen`, `:978`, und `:2916`).

- `laeufe(transkripte, kosteneintraege)` (rein) — liefert `[{kennung, at, role, column, transkript: {bytes, zustand} | null, kosten: {amount, currency, tokens, column} | null}]`, geordnet nach FA 5 (ADR-0039 Punkt 1).
- `kennungsmengeGeaendert(aufgabe, letzteAntwort)` (rein) — wahr, wenn die Menge der `kennung` in `a.transkripte` von der Menge der lesbaren Einträge der letzten Antwort abweicht.
- Zeilenwerte (rein) — Zustandswort, Nebentext, Betragstext; Wörter aus FA 3 und FA 4.

### Hinweise

- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, Bereich D1 (`#laeufe`, freigegeben PO Z. 471). Die Zeichnung ist die Quelle für das Aussehen; Kriterien entstehen nicht aus ihr.
- **Vorbild:** Ansicht „Commits“ (R00205: Panel, Statusbereich, Laden, Fehler, verworfene späte Antwort) und „Kosten“ (Betragstext, neueste zuerst über `zeitMs`).
- **Abhängigkeit im Code:** Die Entfernung der WBS (#225 ff.) berührt diese Karte nicht; ein Mergekonflikt in `web/app.js` ist möglich (ADR-0039).

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (Node):** `laeufe()` mit (a)–(f), Reihenfolge, Doppel, Mutant „Spalte gehört zum Schlüssel“; `kennungsmengeGeaendert`; Zeilenwerte.
- **Integration:** Messprobe `tests/lastprobe_r00219.rs` (nur ausdrücklich, tagsüber, Release).
- **E2E:** AK 3–10 gegen das gestartete Programm (Playwright, headless), sechs Breiten, beide Themen, grober Zeiger, Tastatur; Zeitproben deterministisch über gehaltene Antworten; Mutanten nach AK 6, 7, 9.

## Abhängigkeiten

- Abhängig von: [R00216](R00216-transkripte-der-agentenlaeufe-ablegen.md) (I0206, Karte #208, `braucht:208`: Transkripte, `GET …/transkripte`, `transkripte` an der Aufgabe); [R00205](R00205-ansicht-commits-im-aufgabenfenster.md) (I0195, Ansicht „Commits“, Reihenfolge im Menü); [R00145](R00145-aufgabenfenster-ansichtsmenue-anhaenge-im-inhalt.md) (Ansichtsmenü); die Zeichnung D0009 (D1, `#laeufe`), freigegeben samt Wortlauten (PO Z. 471–477).
- Blockiert: D2 Laufansicht (#210; gibt den Zeilen mit `vorhanden` ein Ziel), C2 Schalter in „Einrichten“ (#218; macht aus dem Hinweis einen Verweis).

## Offene Fragen

Keine. Beantwortet mit der Freigabe der Zeichnung (PO Z. 471–477):

1. Wort für `abweichend` — „Datei weicht vom abgelegten Stand ab“ (Wortlaut 3).
2. Zustandswort für `vorhanden` — kein sichtbares Wort, vorgelesen „Transkript vorhanden“ (Wortlaut 1).
3. Wortlaute von Nebentext, Hinweiszeile, Fehler und Ansage — Wortlaute 7, 9, 10 und 12, eingetragen in FA 3, 6, 7, 8 und AK 4, 5, 7, 10; dazu der Zustand „Transkript nicht gelesen“ (Wortlaut 6, PO Z. 474) in FA 4, FA 8 und AK 7.

## Manuelle Vorbereitungstätigkeiten

- Messprobe tagsüber einplanen (8–21 Uhr, geringe Last).

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 nachführen (ADR-0039 Folgeaufgabe).

## Warum löst diese Anforderung das Problem? (Pflicht)

Seit R00216 legen Agenten Transkripte an der Aufgabe ab, und seit ADR-0028 bucht jeder Lauf seinen Kosteneintrag mit derselben Kennung — aber wer eine Aufgabe prüft, sieht Beträge nur in „Kosten“ und Transkripte nur in der API. Führt die Ansicht „Läufe“ beide über die Kennung des Servers zu einer Zeile zusammen, sieht der Mensch je Lauf Rolle, Spalte, Betrag und ob das Transkript hier liegt; weil ein Teil ohne Partner nie verschwindet, fehlt auch kein Lauf, dessen Transkript nie abgelegt wurde oder auf einem anderen Rechner liegt. Weil die Ansicht bei Ablegen und Löschen selbst einmal neu liest und Kosten live zeichnet, stimmt sie mit Menü und Betrag überein, ohne dass jemand „Neu lesen“ drückt. Der Hebel liegt in der Seite und nicht am Server: der Vertrag von #208 bleibt, und die eine Quelle für Beträge bleibt die Aufgabe (ADR-0039).

## Notizen

- **Verworfene Alternativen** (ADR-0039): F — `GET …/transkripte` trägt die Kosten mit (ändert den Vertrag von #208, Beträge an zwei Orten, Kosten erst nach neuem Lesen); E — eigener Endpunkt `GET …/laeufe` (neue Route für eine reine Anzeige, ohne zweiten Aufrufer); L1 — lesen nur wie „Commits“ (verfehlt Live, PO Z. 467); L3 — bei jedem Ereignis lesen (1.000 Dateizugriffe je Tastendruck eines Kollegen).
- **Nicht in D1:** Ziel an der Zeile und Laufansicht (#210), Herunterladen, Verweis auf „Einrichten“ (#218), Seiten oder Nachladen (bis 1.000 Zeilen am Stück, ADR-0039 Punkt 7).
- **Wegen Schlank arbeiten A** zehn Kriterien; Grenzfälle der Rechnung über (a)–(f) hinaus gehören dem entwickler.
