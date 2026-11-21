---
id: R00219
status: Erledigt
datum: 2026-11-21
---

# R00219: Ansicht „Läufe“ im Aufgabenfenster

## Beschreibung

Karte #217, Scheibe D1 des Feinschnitts (Zuschnitt PO Z. 384–388). Technik [ADR-0039](../Dokumentation/ADRs/0039-reiter-laeufe-zusammenfuehren-in-der-seite-ueber-die-kennung.md) (Akzeptiert), Produkt `AI-Team/po-entscheidungen.md` Z. 466–470, Freigabe der Zeichnung und Wortlaute Z. 471–477, Nachzeichnung nach der UX-Vorprüfung (Bild 7 „Fehler, liest erneut“, Bild 9) und Antworten Z. 478–482.

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
6. **Hinweis bei ausgeschaltetem Erfassen:** Liefert die Antwort `erfassen: false`, steht über der Liste eine Hinweiszeile mit den Boards aus `boards_aus`: „Auf „<Board>“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.“ (Wortlaut 12). Mehrere Boards stehen in der Reihenfolge von `boards_aus`, jedes in „…“, mit Komma getrennt, vor dem letzten „und“ ohne Komma; alle werden genannt, nichts wird gekürzt, kein „und n weitere“ (PO Z. 480): zwei Boards „Auf „zweit“ und „dritt“ werden …“, drei Boards „Auf „a“, „b“ und „c“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.“ — nur als Text; den Verweis auf „Einrichten“ bringt C2 (#218).
7. **Lesen:** `GET /api/aufgaben/{nr}/transkripte` beim Öffnen der Ansicht, über „Neu lesen“, über „Erneut versuchen“ und **genau einmal**, wenn sich die Menge der Kennungen in `transkripte` der Aufgabe nach einem Live-Ereignis gegenüber der letzten Antwort ändert (ADR-0039 Punkt 6, L2). Kosten zeichnen bei jedem Ereignis neu, ohne Lesen. Bis die Antwort da ist, bleiben die alten Zeilen stehen, und der Statusbereich meldet „Liest die Läufe …“; nach dem Lesen meldet er „<n> Läufe · Stand hh:mm:ss“, bei genau einem Lauf „1 Lauf · Stand hh:mm:ss“, bei Fehler „Die Läufe ließen sich nicht lesen.“ (Wortlaut 9, PO Z. 471). Beim ersten Öffnen steht bis zur Antwort keine Zeile, nur der Statusbereich meldet das Laden. Trägt die Antwort keinen Lauf und die Aufgabe keinen Kosteneintrag, steht „An dieser Aufgabe stehen keine Läufe mehr.“ (Wortlaut 11) und der Statusbereich meldet „0 Läufe · Stand hh:mm:ss“ (Bild 6 „leer“). „Neu lesen“ ist in allen Zuständen derselbe Knoten und während des Lesens gesperrt (`aria-disabled="true"`, fokussierbar, Form Z. 216). Einzige Live-Region der Ansicht ist der Statusbereich (`role="status"`); die Meldung über der Liste trägt kein `role` und kein `aria-live`, der Hinweis trägt `role="note"` (PO Z. 478, 481). Ein selbsttätiges Lesen (nach einem Live-Ereignis) bewegt den Fokus nie, weder beim Start noch bei Antwort oder Fehler (PO Z. 479). Ein neues Transkript erscheint nicht vorab ohne Zustand. Eine späte Antwort wird verworfen, wenn inzwischen neu gelesen wurde, die Aufgabe gewechselt hat oder die Ansicht nicht mehr gezeigt wird (ADR-0014).
   **Warum anders als „Commits“:** Anders als „Commits“ liest „Läufe“ bei Live-Ereignissen selbst neu. Ablegen und Löschen eines Transkripts kommen über die API von kanbanD und lösen ein Live-Ereignis aus, und das Lesen braucht kein Git im Arbeits-Repository; der Grund, aus dem „Commits“ nur beim Öffnen und über „Neu lesen“ liest (Git im Arbeits-Repository, kein Ereignis; R00205 FA 2, PO Z. 403), trifft hier nicht zu. Ohne Nachlesen stünde ein neu gebuchter Betrag neben einer Zeile ohne Zustand (PO Z. 467).
8. **Fehler:** Scheitert das Lesen, steht über der Liste „Die Läufe ließen sich nicht lesen: <`fehler` der Antwort> (<Status>).“ bzw. ohne Verbindung „Die Läufe ließen sich nicht lesen: keine Verbindung zum Programm.“ (Wortlaut 10, Form wie R00205 FA 8) mit „Erneut versuchen“; die Kosteneinträge der Aufgabe bleiben dabei als Zeilen mit Betrag sichtbar. Ihr Zustand heißt dann „Transkript nicht gelesen“, nie „kein Transkript abgelegt“ (PO Z. 474). Dasselbe Fehlerbild gilt, egal wie oft vorher gelesen wurde: scheitert ein Lesen, nachdem schon Zeilen standen — auch ein selbsttätiges nach einem Live-Ereignis —, fällt die Ansicht darauf zurück; Zeilen ohne Kosteneintrag entfallen dann, bis wieder gelesen ist. Bis die Fehlerantwort kommt, bleiben die alten Zeilen stehen (PO Z. 479). **Erneut versuchen** (Bild 7, PO Z. 478): Meldung und Knopf bleiben während des Lesens stehen; „Erneut versuchen“ ist derselbe Knoten, gesperrt mit `aria-disabled="true"`, und behält den Fokus; ein weiterer Druck während des Lesens liest nicht noch einmal. Bei Erfolg fallen Meldung und Knopf weg, und der Fokus geht auf „Neu lesen“; bei Fehler oder ohne Verbindung wird der Knopf wieder frei, und der Fokus bleibt darauf. Hat der Mensch den Fokus während des Lesens woanders hingesetzt, bleibt er dort. Der Fokus fällt nie auf `body`.
9. **Fremder Text bleibt Text:** Rolle, Spalte und Boardnamen stammen aus Dateien, die jeder bearbeiten kann; nichts davon wird als HTML gedeutet, Bidi-Steuerzeichen werden entfernt (ADR-0030, wie `web/commits.js`).

## Nicht-funktionale Anforderungen

- **Performance (Messprobe, Tag-Kriterium, ADR-0039 Punkt 7):** 1.000 Transkripte und 1.000 Kosteneinträge an einer Aufgabe, Release-Build: `GET …/transkripte` warm p95 < 200 ms, Antwort < 250.000 Byte; Neuzeichnen der Ansicht in Chromium bei gleicher Tabelle (Antwort und Kosteneinträge unverändert) < 100 ms je `render()`; das erste Zeichnen nach dem Lesen und das Zeichnen nach einer geänderten Zeile werden gemessen und im Bericht genannt, ohne Grenze im Gate (ADR-0039 N1 Punkt 5, PO Z. 483). Gemessen nur tagsüber (8–21 Uhr) bei 1-Minuten-Last ≤ 6 beim Start; nachts gemessene Werte gelten nicht (Lehre #230). Lastbeobachtung, kein Zeittest im Gate. Herleitung der Grenzen: ADR-0039 (Lastprofil lesend p95 < 200 ms; vermutet 1.000 × ≈ 150 B ≈ 150 KB, nicht gemessen).
- **Breite:** bei 320, 414, 640, 641, 768, 980, 1099, 1100 und 1280 px (je beide Seiten der Grenzen 640/641 und 1099/1100 aus D0009), hell und dunkel, in jedem Zustand `document.documentElement.scrollWidth ≤ clientWidth`; nichts ragt über die rechte Kante (Lehren #212, #220).
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
- **#4 (fabrik, Breitendaten und fremder Text, für AK 8–10):** ein Lauf mit Rolle aus 40 Zeichen, ein Kosteneintrag mit Spalte aus 60 Zeichen ohne Leerzeichen (abweichend von der Spalte des Transkripts), ein Kosteneintrag mit Spalte `<img src=x onerror=window.pwn=1> ` + U+202E + `"x"` (37 Zeichen, ohne U+202E 36); dazu alle Zeilenarten aus #1. Für den Hinweis: ein zweites ausgeschaltetes Board mit Namen aus 60 Zeichen.

### Messprobe und Zusammenführen

- [x] **AK 1 Messprobe (Tag-Kriterium, nicht im Nachtbetrieb, zuerst).** Gegeben ein Wegwerf-Board mit einer Aufgabe mit 1.000 Transkripten (Dateien vorhanden) und 1.000 Kosteneinträgen gleicher Kennungen und der Release-Build, wenn tagsüber (8–21 Uhr, 1-Minuten-Last ≤ 6 beim Start, `nice -n 10`) nach 5 Aufrufen zum Anwärmen 20-mal `GET …/transkripte` gerufen wird, dann ist der p95 (der 19. von 20 aufsteigend sortierten Werten) < 200 ms und die Antwort < 250.000 Byte; und wenn die Ansicht „Läufe“ dieser Aufgabe nach dem Lesen in Chromium 20-mal mit erzwungenem Layout neu gezeichnet wird, ohne dass sich Antwort oder Kosteneinträge dazwischen ändern, dann dauert jedes `render()` < 100 ms; die Dauer des ersten Zeichnens nach dem Lesen steht zusätzlich im Bericht, ohne Grenze (PO Z. 483). Messwerte, Uhrzeit und Last stehen im Bericht. **Reißt eine Grenze, hält die Karte** mit der Frage an den architekt (Abhilfe nach ADR-0039 N1, kein Umbau am Server). Der Teil am Server läuft vor der Zeichnung, der Teil Zeichnen nach ihr. **Insel hält** (im Gate, kein Tag-Kriterium, ADR-0039 N1): Gegeben „Läufe“ ist an #1 offen mit den sechs Zeilen, wenn an #1 ein Kommentar entsteht und #2 umbenannt wird, dann zeichnet die Ansicht neu, und die Tabelle bleibt derselbe Knoten im Dokument, nie aus- und wieder eingehängt; wird danach an #1 ein Kosteneintrag für L3 gebucht, ersetzt eine neue Tabelle die alte und L3 zeigt den Betrag (etwa „0,25 $“); in beiden Fällen folgt kein weiteres `GET …/transkripte`.
- [x] **AK 2 Zusammenführen über die Kennung** (Node, ADR-0039 „Durchsetzung“):
  - (a) Gegeben ein Transkript `entwickler@2026-11-20T10:00+01:00` in „Entwicklung“ und ein Kosteneintrag gleicher Kennung in „Reviews“, dann entsteht **eine** Zeile mit beiden Spalten.
  - (b) Ein Transkript ohne Kosteneintrag ergibt eine Zeile mit `kosten: null`.
  - (c) Ein Kosteneintrag ohne Transkript ergibt eine Zeile mit `transkript: null`, und ihr Zustand ist nicht `fehlt`.
  - (d) Ein `unlesbar`er Eintrag ohne Kennung wird keinem Kosteneintrag zugeordnet, auch wenn nur einer da ist.
  - (e) Je zwei Transkripte und zwei Kosteneinträge derselben Kennung ergeben genau zwei Paare (erstes mit erstem, zweites mit zweitem, in der Reihenfolge der Datei).
  - (f) Gegeben die Kennung des Servers `entwickler@2026-11-20T14:00+01:00` an beiden Seiten, obwohl der Kosteneintrag von Hand mit `2026-11-20T13:00:00Z` geschrieben wurde, dann eine Zeile; verglichen wird nur die Kennung des Servers, die Seite bildet keine eigene.
  - Reihenfolge: aus #1 entsteht L4, L3, L2, L1, L5, L6 (neueste zuerst, ohne Kennung am Ende).
  - **Mutant „Spalte gehört zum Schlüssel“** macht (a) rot.

### Menü, Zeilen, Hinweis

- [x] **AK 3 Ort und Sichtbarkeit:** Gegeben #1 mit Kosten und ohne Commits, dann nennt das Ansichtsmenü `…, Datei, Kosten, Läufe, Verlauf`; mit einem Commit-Verweis `…, Kosten, Commits, Läufe, Verlauf`. Gegeben #2 nur mit Kosten, dann steht „Läufe“ nicht im Menü, und es wird kein `GET …/transkripte` gesendet (geprüft, nachdem das Menü sichtbar steht). Gegeben „Läufe“ ist an #1 offen und alle Transkripte werden über die API gelöscht, dann entfällt der Eintrag, das Fenster zeigt „Inhalt“, und der Fokus steht auf dem Auslöser „Ansicht: Inhalt“ (nie auf `body`).
  - **Leer:** Gegeben eine Aufgabe auf `fabrik` mit einem Transkript und keinem Kosteneintrag, deren `GET …/transkripte` per `page.route` mit `{erfassen: true, boards_aus: [], transkripte: []}` antwortet, wenn „Läufe“ geöffnet wird, dann steht keine Zeile, sondern „An dieser Aufgabe stehen keine Läufe mehr.“, und der Statusbereich meldet `0 Läufe · Stand hh:mm:ss`.
- [x] **AK 4 Zeilen, Zustände, Reihenfolge:** Gegeben #1, wenn „Läufe“ geöffnet wird, dann stehen sechs Zeilen in der Reihenfolge L4, L3, L2, L1, L5, L6:
  - L4 „kein Transkript abgelegt“, Spalte „Entwicklertest“, „0,30 $“;
  - L3 „liegt nicht auf diesem Rechner“, Spalte „Reviews“, Betrag „—“;
  - L2 Spalte „Entwicklung“ mit dem Nebentext „Kosten gebucht in Reviews“, „1,80 $“, kein Fehlerwort;
  - L1 Spalte „Detailplanung“, „0,42 $“, kein Nebentext, kein Fehlerwort;
  - L5 „Datei weicht vom abgelegten Stand ab“, „0,55 $“;
  - L6 „Eintrag nicht lesbar“, Betrag „—“.
  - **Zeitpunkt:** aus der Kennung in `Europe/Berlin` als `TT.MM.JJJJ hh:mm`: L4 „20.11.2026 12:00“, L3 „20.11.2026 11:00“, L2 „20.11.2026 10:00“, L1 „20.11.2026 09:00“, L5 „20.11.2026 08:00“; L6 ohne Kennung zeigt „—“.
  - **Vorgelesen** (Zugänglichkeitsbaum der Zeile, Playwright `ariaSnapshot()`; nicht das Attribut, sondern was ankommt): L1 und L2 nennen „Transkript vorhanden“, das sichtbar nicht dasteht; L3 und L6 nennen beim Betrag „kein Betrag“, L6 dazu „kein Zeitpunkt“, „keine Rolle“, „keine Spalte“; kein „—“ wird als Zeichen vorgelesen. Das gilt bei jeder Breite: auch in der mittleren und schmalen Form bleiben die Zellen Zeitpunkt, Rolle, Spalte und Betrag der Zeile ohne Kennung im Dokument, sichtbar als „—“ und vorgelesen als „kein Zeitpunkt“, „keine Rolle“, „keine Spalte“, „kein Betrag“; sie werden nicht ausgeblendet (`display:none`), abweichend von D0009 `#laeufe` (PO Z. 484).
  - **Fünf Wörter:** „liegt nicht auf diesem Rechner“, „Datei weicht vom abgelegten Stand ab“, „Eintrag nicht lesbar“, „kein Transkript abgelegt“ und „Transkript nicht gelesen“ (aus AK 7) sind als Text paarweise verschieden und sichtbar (nicht in der Klasse für nur-vorlesbaren Text, Rechteck größer 0, ohne `opacity:0`). Die drei Marken (`fehlt`, `abweichend`, `unlesbar`) tragen je ein Symbol, und die drei Symbole sind paarweise verschieden (verglichen am gezeichneten Pfad); „kein Transkript abgelegt“ und „Transkript nicht gelesen“ tragen keine Marke und kein Symbol (D0009, PO Z. 466).
  - Keine Zeile ist ein Ziel: kein `a[href]` in der Liste, ein Klick auf eine Zeile ändert weder Adresse noch Ansicht.
  - **1.000:** Gegeben das Wegwerf-Board aus AK 1 (1.000 Transkripte, 1.000 Kosteneinträge gleicher Kennungen), dann stehen nach dem Lesen 1.000 Zeilen am Stück, ohne Seiten und ohne Nachladen (kein zweites `GET …/transkripte` beim Scrollen bis zur letzten Zeile), und der Statusbereich meldet `1.000 Läufe · Stand hh:mm:ss` (Zahl mit Tausenderpunkt wie in Bild 8).
- [x] **AK 5 Hinweis bei ausgeschaltetem Erfassen:** Gegeben #3 auf `zweit` (Antwort `erfassen: false`, `boards_aus: ["zweit"]`), dann steht über der Liste die Hinweiszeile „Auf „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.“, und darunter die Zeile „kein Transkript abgelegt“ für `entwickler@2026-11-21T09:00+01:00`. Gegeben #1 (`erfassen: true`), dann steht keine Hinweiszeile.
  - **Mehrere Boards** (Antwort von #3 per `page.route` mit geändertem `boards_aus`, PO Z. 480): `["zweit", "dritt"]` ergibt genau „Auf „zweit“ und „dritt“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.“ (Bild 9); `["zweit", "dritt", "viert"]` ergibt genau „Auf „zweit“, „dritt“ und „viert“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.“ — verglichen als ganzer Text, also ohne Komma vor „und“, ohne Kürzung; `["viert", "zweit"]` ergibt „Auf „viert“ und „zweit“ …“ (Reihenfolge der Antwort, nicht sortiert).

### Lesen

- [x] **AK 6 Live und genau ein Lesen** (Zähler über `page.route`, Antworten gehalten und über ein Promise freigegeben, keine Schlafzeiten; jede Verneinung erst nach einem sichtbaren Signal):
  - Beim Öffnen von „Läufe“ an #1 genau ein `GET …/transkripte`; „Neu lesen“ genau ein weiteres.
  - **Erstes Öffnen:** solange die erste Antwort gehalten ist, steht keine Zeile und keine Meldung, der Statusbereich meldet „Liest die Läufe …“, und „Neu lesen“ trägt `aria-disabled="true"` (Bild 9, bei 320 und 1280 px); nach der Freigabe stehen die sechs Zeilen.
  - Gegeben „Läufe“ ist an #1 offen, wenn `entw1` für L3 einen Kosteneintrag 0,25 USD bucht, dann zeigt die Zeile L3 „0,25 $“, und es folgt **kein** `GET …/transkripte`.
  - Wenn `entw1` ein Transkript `entwicklertester@2026-11-20T12:00+01:00` für L4 ablegt, dann folgt **genau ein** `GET …/transkripte`; solange die Antwort gehalten ist, steht L4 weiter mit „kein Transkript abgelegt“ und der Statusbereich meldet „Liest die Läufe …“; nach der Freigabe steht L4 ohne dieses Wort mit Zustand.
  - Wenn `entw1` das Transkript von L1 löscht, dann genau ein `GET …/transkripte`, und L1 steht danach als „kein Transkript abgelegt“.
  - Wenn `sh` einen Kommentar an #1 schreibt, dann folgt kein `GET …/transkripte` (geprüft, nachdem der Kommentar sichtbar ist).
  - Wird die Datei von L2 im Ordner gelöscht, ohne dass sich der Eintrag ändert, zeigt L2 „liegt nicht auf diesem Rechner“ erst nach „Neu lesen“ (kein Ereignis, Inkauf ADR-0039).
  - **Mutant** „liest bei jedem Live-Ereignis“ macht die Kommentar-Probe rot.
- [x] **AK 7 Späte Antwort und Fehler:**
  - Gegeben die Antwort für #1 ist gehalten, wenn auf #3 gewechselt und danach freigegeben wird, dann zeigt #3 nur seine eigenen Zeilen und seinen Hinweis; dasselbe beim Wechsel von „Läufe“ auf „Inhalt“ (nach der Freigabe bleibt „Inhalt“). Gegeben zwei Lesungen in Folge, deren erste zuletzt antwortet, dann gilt die zweite. **Mutant** ohne „Aufgabe noch dieselbe“ macht die Probe rot.
  - Gegeben `GET …/transkripte` antwortet 503 (per `page.route`), dann steht „Die Läufe ließen sich nicht lesen: <`fehler` der Antwort> (503).“ mit „Erneut versuchen“, und die Kosteneinträge von #1 (L4, L2, L1, L5) stehen weiter mit ihren Beträgen und je dem Wort „Transkript nicht gelesen“; „kein Transkript abgelegt“ steht an keiner dieser Zeilen. Ein Klick auf „Erneut versuchen“ liest genau einmal und zeigt bei Erfolg die sechs Zeilen.
  - **Keine Verbindung** (Anfrage per `page.route` abgebrochen): dann steht „Die Läufe ließen sich nicht lesen: keine Verbindung zum Programm.“ mit „Erneut versuchen“, dieselben vier Kostenzeilen mit Betrag und „Transkript nicht gelesen“, und der Statusbereich meldet „Die Läufe ließen sich nicht lesen.“.
  - **Fehler nach früherem Erfolg** (PO Z. 479): Gegeben „Läufe“ ist an #1 offen mit den sechs Zeilen und `6 Läufe · Stand hh:mm:ss`, und der Fokus steht auf „Neu lesen“, wenn `entw1` für L4 ein Transkript ablegt und das dadurch ausgelöste `GET …/transkripte` gehalten wird, dann stehen weiter die sechs alten Zeilen mit ihren alten Zuständen (L4 „kein Transkript abgelegt“), und der Statusbereich meldet „Liest die Läufe …“. Wird die Anfrage danach mit 503 beantwortet, dann gilt das Fehlerbild wie beim ersten Lesen: Meldung „Die Läufe ließen sich nicht lesen: <`fehler`> (503).“ mit „Erneut versuchen“, die Zeilen L4, L2, L1, L5 mit Betrag und „Transkript nicht gelesen“, L3 und L6 (ohne Kosteneintrag) stehen nicht mehr, und der Statusbereich meldet „Die Läufe ließen sich nicht lesen.“. Der Fokus steht während des Lesens und danach auf „Neu lesen“ (derselbe Knoten wie vorher), nie auf „Erneut versuchen“ und nie auf `body`. Dasselbe ohne Verbindung. **Mutant** „bei Fehler nach Erfolg bleiben die alten Zustände“ macht die Probe rot.

### Darstellung und Bedienung

- [x] **AK 8 Fremder Text:** Gegeben #4, dann steht die Rolle aus 40 Zeichen zeichengleich als Text da, und die Spalte steht als Text `<img src=x onerror=window.pwn=1> "x"` da — das ist die Eingabe aus 37 Zeichen ohne U+202E, also 36 Zeichen; sonst ist kein Zeichen verändert. Es entsteht kein `img` im Dokument, `window.pwn` ist nicht gesetzt. Kein Textknoten und kein Attribut der Ansicht enthält U+202E; trägt ein Element der Ansicht ein `title`- oder `aria-label`-Attribut mit diesem Text, ist es derselbe bereinigte Text aus 36 Zeichen wie die Anzeige.
- [x] **AK 9 Breite, Tabelle und Ziele:** Gegeben #4 und #3, dann gilt bei 320, 414, 640, 641, 768, 980, 1099, 1100 und 1280 px (neun Breiten: je beide Seiten der Grenzen 640/641 und 1099/1100), hell und dunkel, in den Zuständen Liste, Laden, Fehler, Fehler liest erneut und Hinweis:
  - `documentElement.scrollWidth ≤ documentElement.clientWidth` und `scrollWidth ≤ clientWidth` des Aufgabenfensters;
  - **an der eigenen Zelle gemessen:** für die Rolle aus 40 Zeichen, die Spalte aus 60 Zeichen, den Nebentext und den Boardnamen aus 60 Zeichen im Hinweis liegt jedes Rechteck aus `Range.getClientRects()` über dem ganzen Text innerhalb von `getBoundingClientRect()` der eigenen Zelle bzw. des eigenen Blocks (Toleranz 1 px) — nicht nur innerhalb des Fensters; ein Text, der in die Nachbarzelle läuft, ist rot;
  - **Form an den Grenzen** (D0009): bei 1100 und 1280 px ist die Kopfzeile der Tabelle sichtbar (Rechteck größer 0), bei 1099 px und darunter nicht.
  - **Tabelle für Vorlesende** bei 320 und 1280 px (Zugänglichkeitsbaum, Playwright `getByRole`): genau eine `table` mit dem Namen „Läufe dieser Aufgabe, neueste zuerst“, an #1 mit sechs Datenzeilen (`row`) und den fünf Spaltenköpfen (`columnheader`) Zeitpunkt, Rolle, Spalte, Betrag, Transkript; je Datenzeile ist der Zeitpunkt der Zeilenkopf (`rowheader`). Die schmale Blockform nimmt der Liste die Tabellenrolle nicht.
  - **Mutationsprobe:** `white-space: nowrap` an der Spalte und am Nebentext macht die Probe je rot; `display: block` an der Tabelle ohne zurückgegebene Rollen macht die Tabellenprobe bei 320 px rot.
  - Bei grobem Zeiger ist jedes Bedienziel („Läufe“ im Menü, „Neu lesen“, „Erneut versuchen“) mindestens 48 × 48 px.
- [x] **AK 10 Themen, Tastatur, Fokus und Ansage:** Gegeben Hell und Dunkel, dann hat in den Zuständen Liste, Laden, Fehler, Fehler liest erneut und Hinweis kein Text der Ansicht weniger als 4,5:1 und kein Symbol oder Rand einer Zustandsmarke weniger als 3:1. Ausgenommen ist der Text gesperrter Bedienelemente (`aria-disabled="true"`, WCAG 1.4.3 „inaktive Komponenten“, PO Z. 459, 484): er steht in `--kd-faint` (Sperrform Z. 216, PO Z. 491; Nachtrag #247) und mindestens 3:1 gegen die Fläche, hell und dunkel (3,59:1 hell, 4,40:1 dunkel auf `--kd-surface`, ADR-0025 N5); der Fokusring eines gesperrten, fokussierten Knopfes gilt unverändert (mindestens 2 px, 3:1). Mit der Tastatur ist „Läufe“ im Ansichtsmenü wie die anderen Einträge erreichbar und wählbar (danach heißt der Auslöser „Ansicht: Läufe“); Tab erreicht „Neu lesen“ und bei Fehler „Erneut versuchen“, auch gesperrt.
  - **Fokus sichtbar, als Messwert:** Solange „Läufe“ im Menü, „Neu lesen“ oder „Erneut versuchen“ den Tastaturfokus hat — auch gesperrt mit `aria-disabled="true"` —, ist an ihm berechnet `outline-style: solid` und `outline-width` mindestens 2 px, und die Farbe des Rings (`outline-color`) steht mindestens 3:1 gegen die Fläche dahinter, hell und dunkel (Form wie R00184 AK 1); `outline-style: auto` oder `none` ist rot.
  - **Statusbereich:** Nach dem Lesen meldet ein Statusbereich (`role="status"`, schon im Laden-Zustand im Dokument und derselbe Knoten) die Zahl der Läufe bzw. den Fehler, ohne den Fokus zu bewegen: an #1 `6 Läufe · Stand hh:mm:ss`, bei 503 „Die Läufe ließen sich nicht lesen.“. **Einzahl:** Gegeben eine Aufgabe auf `fabrik` mit genau einem über die API abgelegten Transkript und keinem Kosteneintrag, dann lautet der Statusbereich `1 Lauf · Stand hh:mm:ss` (geprüft mit `^1 Lauf · Stand \d{2}:\d{2}:\d{2}$`), nie „1 Läufe“.
  - **Genau eine Ansage** (UX-Vorprüfung M2, PO Z. 478, 481): Ein `MutationObserver` am Dokument zählt Textänderungen in Elementen, die auf `[role=status],[role=alert],[aria-live]` passen, oder in deren Inhalt. Je Ereignis — vom Freigeben der gehaltenen Antwort bis zum gezeichneten Ergebnis — zählt er genau **eine** Textänderung, und die liegt im `role="status"`: bei Erfolg (`6 Läufe · Stand hh:mm:ss`), bei 503 und ohne Verbindung („Die Läufe ließen sich nicht lesen.“), beim ersten Lesen, nach „Erneut versuchen“ und nach einem selbsttätigen Lesen aus AK 7. Der Start eines Lesens durch „Neu lesen“ oder „Erneut versuchen“ ist ein eigenes Ereignis mit genau einer Textänderung im `role="status"` („Liest die Läufe …“): ab dem Klick zählt er bis zum gezeichneten Ergebnis genau **zwei** Änderungen, ab der Freigabe genau **eine** (PO Z. 484). Die Fehlermeldung über der Liste trägt kein `role` und kein `aria-live` und liegt in keinem Element mit `role="status"`, `role="alert"` oder `aria-live`; der Hinweis trägt `role="note"`. **Mutant** `role="alert"` an der Meldung macht die Zählung rot (zwei Änderungen).
  - **Fokus nach „Erneut versuchen“** (UX-Vorprüfung M1, Bild 7, PO Z. 478): Gegeben 503 an #1, der Fokus steht per Tab auf „Erneut versuchen“, wenn Enter gedrückt und die Antwort gehalten wird, dann bleiben Meldung und Knopf stehen; der Knopf ist derselbe Knoten wie vor dem Druck (`===`), trägt `aria-disabled="true"` und ist `document.activeElement`; ein zweites Enter sendet kein weiteres `GET …/transkripte` (Zähler bleibt bei zwei: Öffnen und ein Versuch). Wird mit 200 freigegeben, fallen Meldung und Knopf weg, und der Fokus steht auf „Neu lesen“. Wird mit 503 freigegeben, steht derselbe Knopf wieder ohne `aria-disabled`, und der Fokus bleibt darauf; ebenso ohne Verbindung. Hat `sh` den Fokus während des Haltens mit der Tastatur auf den Auslöser „Ansicht: Läufe“ gesetzt (Umschalt+Tab, bis er dort steht), steht er nach der Freigabe (200 wie 503) dort. `document.activeElement` ist nach keinem dieser Schritte `body`.
  - **„Neu lesen“:** ist vor, während und nach dem Lesen derselbe Knoten (`===`), trägt während des Lesens `aria-disabled="true"`, und ein Enter darauf während des Lesens sendet kein weiteres `GET …/transkripte`. Nach „Neu lesen“ bleibt der Fokus darauf — nur, wenn er beim Eintreffen der Antwort noch dort liegt; hat `sh` ihn inzwischen weitergesetzt, bleibt er dort.
  - **Selbsttätiges Lesen** (PO Z. 479): Ein Lesen durch ein Live-Ereignis bewegt den Fokus nie — weder beim Start noch bei Antwort 200, 503 oder ohne Verbindung (`document.activeElement` vor dem Ereignis `===` nach dem gezeichneten Ergebnis, AK 7).
  - Das Fokusziel ist weder selbst Live-Region (`role="status"`, `aria-live`) noch liegt es in einer.

### Belege (Abschluss 2026-11-21, Stand `ab41d75c`)

Entwicklertest US-1 bis US-7 ohne Befund (Debug-Build `ab41d75c`), Code-Review ohne Muss, UX-Review mit Nachprüfung 1 ohne Befund; Gate grün in `88b37e59` (cargo 1239, node 1439, Playwright 2231, 8 übersprungen: Messproben hinter `KD_MESSPROBE` bzw. `#[ignore]`), die Nacharbeit 1 (`c1696dc7`–`f1756bcd`) je mit eigenem rotem Test.

- **AK 1:** Server `f449f84c` (`tests/lastprobe_r00219.rs`): 2026-11-21 08:00–08:02, Last 1,87, `nice -n 10`, drei Läufe p95 64,8 / 59,7 / 53,7 ms, Antwort 154.049 Byte. Zeichnen `9432a4b5`: 08:35, Last 1,48, größter `render()` 80,2 / 70,4 / 60,5 ms, erstes Zeichnen 113–158 ms (ohne Grenze). Insel hält: E2E `e2e/tests/r00219-ansicht-laeufe.spec.js` (N1), Mutanten „Schlüssel immer gleich“ und „Insel nie gehalten“ rot (`9432a4b5`, `29107730`).
- **AK 2:** `e2e/einheit/laeufe.test.js` (a)–(f) und Reihenfolge; Mutant „Spalte gehört zum Schlüssel“ macht (a) rot (`711f062d`).
- **AK 3:** Entwicklertest US-1, US-4 (Menü, kein GET an #2, Rückfall mit Fokus auf „Ansicht: Inhalt“).
- **AK 4:** Entwicklertest US-1, US-2 (sechs Zeilen, Wörter, vorgelesen, kein `a[href]`) und Schwerpunkt 1.000 Zeilen (`1.000 Läufe`, kein zweites GET).
- **AK 5:** Entwicklertest US-5 (ein, zwei, drei Boards, Reihenfolge der Antwort).
- **AK 6:** Entwicklertest US-3 (Kosten ohne GET, Ablegen genau ein GET, Kommentar keines); Mutant „liest bei jedem Live-Ereignis“ rot (`ae5639c0`).
- **AK 7:** Entwicklertest US-6, US-7 (503, keine Verbindung, Fehler nach Erfolg); Mutanten „ohne Prüfung“ und „Fehler nach Erfolg behält alte Zustände“ rot (`ae5639c0`).
- **AK 8:** E2E `r00219-ansicht-laeufe.spec.js` AK 8; Code-Review (`esc` und `ohneSteuerzeichen` vor jedem fremden Text).
- **AK 9:** Entwicklertest Schwerpunkte (neun Breiten × hell/dunkel × #4/#3, Tabelle für Vorlesende bei 320 und 1280 px); UX-Nachprüfung 1 (kein Bildlauf an `.mod-body` und `.lf-panel` bis 768 px); Mutanten `nowrap` und `display: block` rot (`f60eda1c`, `c1696dc7`).
- **AK 10:** `f60eda1c` (Kontrast, Fokusring, genau eine Ansage; Mutanten `role="alert"` und ohne Ring rot); Entwicklertest US-6 (Fokus nach „Erneut versuchen“, Ansagen ab Klick genau zwei), Fokusring solid 2 px auch gesperrt; UX-Nachprüfung 1 (gesperrt `--kd-muted`, 6,44:1 / 6,94:1).

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
6. **B1130 Breite, Ziele, Themen, Tastatur, Fokus** (nach der freigegebenen Zeichnung): neun Breiten, Tabellenrolle, beide Themen, alle Zustände (AK 9, 10).
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
- **E2E:** AK 3–10 gegen das gestartete Programm (Playwright, headless), neun Breiten, beide Themen, grober Zeiger, Tastatur; Zeitproben deterministisch über gehaltene Antworten; Mutanten nach AK 6, 7, 9, 10.

## Abhängigkeiten

- Abhängig von: [R00216](R00216-transkripte-der-agentenlaeufe-ablegen.md) (I0206, Karte #208, `braucht:208`: Transkripte, `GET …/transkripte`, `transkripte` an der Aufgabe); [R00205](R00205-ansicht-commits-im-aufgabenfenster.md) (I0195, Ansicht „Commits“, Reihenfolge im Menü); [R00145](R00145-aufgabenfenster-ansichtsmenue-anhaenge-im-inhalt.md) (Ansichtsmenü); die Zeichnung D0009 (D1, `#laeufe`), freigegeben samt Wortlauten (PO Z. 471–477).
- Blockiert: D2 Laufansicht (#210; gibt den Zeilen mit `vorhanden` ein Ziel), C2 Schalter in „Einrichten“ (#218; macht aus dem Hinweis einen Verweis).

## Offene Fragen

Keine. Beantwortet mit der Freigabe der Zeichnung (PO Z. 471–477):

1. Wort für `abweichend` — „Datei weicht vom abgelegten Stand ab“ (Wortlaut 3).
2. Zustandswort für `vorhanden` — kein sichtbares Wort, vorgelesen „Transkript vorhanden“ (Wortlaut 1).
3. Wortlaute von Nebentext, Hinweiszeile, Fehler und Ansage — Wortlaute 7, 9, 10 und 12, eingetragen in FA 3, 6, 7, 8 und AK 4, 5, 7, 10; dazu der Zustand „Transkript nicht gelesen“ (Wortlaut 6, PO Z. 474) in FA 4, FA 8 und AK 7.

Beantwortet mit der Freigabe der Nachzeichnung (PO Z. 478–482, Fragen der UX-Vorprüfung):

4. Scheitert ein selbsttätiges Lesen, nachdem schon Zeilen standen — Rückfall auf das Fehlerbild wie beim ersten Lesen; bis zur Antwort bleiben die alten Zeilen; der Fokus bewegt sich nie (Z. 479; FA 7, FA 8, AK 7, AK 10).
5. Hinweis bei drei und mehr Boards — alle Boards in „…“, mit Komma, ohne Komma vor „und“, ohne Kürzung (Z. 480; FA 6, AK 5).
6. Genau eine Ansage — einzige Live-Region ist der Statusbereich, die Meldung trägt keine Live-Rolle (Z. 478, 481; FA 7, AK 10).

Beantwortet nach dem Bau (PO Z. 483–484):

7. Grenze fürs Zeichnen — gilt für das Neuzeichnen bei gleicher Tabelle; das erste Zeichnen wird nur berichtet; Abhilfe ADR-0039 N1 (Z. 483; NFA Performance, AK 1).
8. Gesperrte Knöpfe, Ansage beim Start eines Lesens, Zellen der Zeile ohne Kennung bei schmaler Breite (Z. 484; AK 4, AK 10).

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
- **Nachtrag 2026-11-21 (Karte #247, PO Z. 491, ADR-0025 N5, über `/anforderung review` im Auftrag des Directors):** In AK 10 gilt für den Text gesperrter Bedienelemente `--kd-faint` statt `--kd-muted` (Kontur `--kd-line`, Hover neutral, Fokusring unverändert). Die Angleichung „ohne Befund in die lesbarere Richtung“ widersprach Z. 484 S-A und ist aufgehoben; mindestens 3:1 bleibt erfüllt (hell 3,59, dunkel 4,40 auf `--kd-surface`). Den Zeiger (`progress` oder `default`) legt R00229 fest. Gebaut und abgenommen wird das in [R00229](R00229-behebung-sperrform-der-leseknoepfe.md) (I0219); Status und Kästchen dieser Anforderung bleiben unverändert.
