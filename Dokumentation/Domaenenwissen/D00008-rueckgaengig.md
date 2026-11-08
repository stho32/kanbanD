---
id: D00008
name: Rückgängig
status: Aktiv
sprache: de
verwandt: [D00007, D00001, D00005]
gebiet: Oberfläche
code: [S.ui.hinweis.undo, "act('rueckgaengig')", "data-act=\"rueckgaengig\"", rueckgaengigAusfuehren, rueckgaengigSenden, rueckgaengigTaste, leeresFeldDesEntfernens, zeitZuruecklegen, anhangZuruecklegen]
---

# Rückgängig

## Definition

Rückgängig ist die Gegenaktion zur zuletzt gemeldeten Aktion: eine neue Aktion über die API, die mit dem beim Klick gemerkten Inhalt den Stand davor wieder herstellt — sie setzt nie eine Datei oder einen Commit zurück (bestätigt, R00031:11, ADR-0017 Regel 1–2). Angeboten wird es nur, solange der [Hinweis](D00007-hinweis.md) dazu steht, ausgelöst über dessen Knopf „rückgängig“ oder Strg+Z. Ist der Stand inzwischen ein anderer, lehnt der Server ab, und die Oberfläche meldet „nicht rückgängig: …“, ohne etwas zu erzwingen (bestätigt, R00112 FA 4, NFA 3).

## ELI14

Der Knopf „hoppla, zurück“: kanbanD hat sich gemerkt, was du gerade weggenommen oder verschoben hast, und legt es wieder hin — außer jemand anderes hat in der Zwischenzeit schon etwas daran geändert.

## Bestandteile

- Art der Gegenaktion und gemerkter Inhalt (`undo` des Hinweises), aus dem gezeigten Stand zum Zeitpunkt des Klicks:
  - aus R00031/R00017: `bewegen {nummer, spalte, index}`, `ziele`, `archivieren` (nach dem Anlegen), `zurueckholen` (nach dem Archivieren)
  - aus R00112 für die vier entfernenden Aktionen: `legen {slug, nummer, spalte, index}`, `teilaufgabe {nummer, text, erledigt, position}`, `zeit {nummer, wer, beginn, ende}`, `anhang {nummer, name, blob}`
- Auslöser: Knopf „rückgängig“ im Hinweis oder Strg+Z bzw. ⌘Z
- Ergebnis: Erfolgshinweis ohne Knopf (z. B. „Teilaufgabe „b“ wiederhergestellt“) oder Ablehnung „nicht rückgängig: <Text des Servers>“
- Fokus danach als Rangliste: das wiederhergestellte Element, sonst der Ort des Entfernens (R00112 FA 8, ADR-0017 N2)

## Beziehungen

- gehört zu genau einem [Hinweis](D00007-hinweis.md); lebt und stirbt mit ihm (8 s, oder ein neuer Hinweis ersetzt ihn)
- höchstens eins zur Zeit und nur in dem Tab, der gehandelt hat; ein Neuladen verliert es (ADR-0017, Konsequenzen)
- gilt auch bei offenem [Aufgabenfenster](D00001-aufgabenfenster.md); die Ablehnung steht dann in dessen Fuß
- schreibt wie jede Aktion einen Commit und löst damit ein [Live-Ereignis](D00005-live-ereignis.md) in allen offenen Sichten aus (abgeleitet aus R00007:11 und R00112 NFA 2)

## Wechselwirkungen

- [Hinweis](D00007-hinweis.md) wird vor dem Senden geleert — ein Doppelklick stellt genau einmal her (R00112 FA 5)
- [Aufgabenfenster](D00001-aufgabenfenster.md) zeigt die Ablehnung im Fuß, wenn es oberster Dialog ist (ADR-0015 Regel 3, ADR-0017 N1)
- [Live-Ereignis](D00005-live-ereignis.md) trägt die Wiederherstellung zu anderen Tabs und Agenten; umgekehrt kann die Änderung eines Agenten das Rückgängig in die Ablehnung führen (409, 404, 400)

## Vorkommen in Anforderungen

- [R00031](../../Anforderungen/R00031-rueckgaengig.md) — führt Rückgängig für Bewegen, Anlegen und Archivieren ein, Strg+Z/⌘Z, nicht in Eingabefeldern (Zeilen 11, 21–25)
- [R00017](../../Anforderungen/R00017-archivieren-und-zurueckholen.md) — Archivieren mit „rückgängig“ (Zeile 26)
- [R00112](../../Anforderungen/R00112-entfernen-rueckgaengig-und-sichtbare-entfernen-knoepfe.md) — Rückgängig für von Board nehmen, Teilaufgabe, Anhang, Zeiteintrag; Positionstreue; Ablehnung (FA 1–16, AK 1–10)

## Notizen / Quellen

- Definition nach R00031:11 („Rückgängig ist selbst eine Aktion mit eigenem Commit“) und ADR-0017 Regeln 1–2, 6 — bestätigt; Positionstreue nach PO-Entscheidung `AI-Team/po-entscheidungen.md` Z. 161 (gemerkter Index, gekappt auf die Länge).
- Strg+Z gilt nicht in Eingabefeldern — außer im leeren Feld, auf das das Entfernen den Fokus gesetzt hat (`#teil-neu`, `#zeit-neu`), solange der Hinweis lebt (ADR-0017 N2, R00112 FA 2). Unter „Zuständige“ wirkt Strg+Z nicht, unter „Zuständige“ und Hilfe ist der Knopf nicht per Tab erreichbar (ADR-0017 N1, PO Z. 172: bleibt so).
- Ein Rückgängig der Zeit trägt den Eintrag mit seinem ursprünglichen `wer` zurück; Autor des Commits bleibt der Handelnde (PO Z. 170). Das Wiederauflegen hat denselben Commit-Text wie jedes Auflegen, „#2 auf „Entwicklung“ gelegt (Zu erledigen)“ (PO Z. 165).
- Code (beobachtet, Stand 6ab1dd6): Verteilung nach Art in `case 'rueckgaengig'` (`web/app.js:1154–1182`); Senden, Erfolg und Ablehnung in `rueckgaengigAusfuehren()` (`web/app.js:533–548`); Taste in `rueckgaengigTaste` (`web/app.js:1891–1895`), Ausnahme `leeresFeldDesEntfernens()` (`web/app.js:494–497`); Knopf `<button class="lnk" data-act="rueckgaengig" title="Strg+Z">rückgängig</button>` (`web/ansicht.js:765`).
- Oberfläche (de): Knopf „rückgängig“ (klein geschrieben), Tooltip „Strg+Z“; Erfolgstexte mit „wiederhergestellt“, „wieder auf …“, „zurück nach …“, „zurückgelegt“, „zurückgeholt“; Ablehnung „nicht rückgängig: …“.
- Der Server kennt kein Rückgängig: er sieht nur gewöhnliche Aufrufe (`POST …/aufgaben` mit `index`, `POST …/teilaufgaben` mit `position`/`erledigt`, `POST …/zeiten`, Upload). Darum gibt es Rückgängig nur für Menschen in der Oberfläche, nicht für Agenten (ADR-0017 Option C verworfen).
- Abweichung beobachtet, geduldet: das Feld heißt im Code englisch `undo`, sonst sind die Bezeichner deutsch (`rueckgaengig…`). Altbestand seit R00031, nur Zustand im Tab (Risiko GELB, Suche beweist); kein Umbenennungsvorschlag im Rahmen von R00112.
- Nicht zu verwechseln mit dem Rückgängig des Browsers in Eingabefeldern (nimmt Getipptes zurück) und mit „Zurückholen“ (eine eigene Aktion für archivierte Aufgaben, R00017), das selbst per Rückgängig angeboten werden kann.
- Nicht verwenden: „Zurücksetzen“ oder „Revert“ für Rückgängig — beides meint das Zurücknehmen eines Commits (ADR-0017 Option C, verworfen); „Zurücksetzen“ ist zudem schon der Knopf für Filter (R00105:66). „Wiederherstellen“ ist erlaubt als Wort für die Wirkung, nicht für die Aktion.
