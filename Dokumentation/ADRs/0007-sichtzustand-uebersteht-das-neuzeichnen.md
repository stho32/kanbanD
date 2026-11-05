# ADR-0007: Sichtzustand übersteht das Neuzeichnen — ein allgemeiner Sicherer über stabile Schlüssel statt Selektorliste und Feld-IDs

**Status**: Akzeptiert
**Datum**: 2026-11-05
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #19)
**Kontext-Anforderung**: — (Bug-Karte #19, Anforderung folgt)
**Erprobt durch**: headless Probe gegen `target/release/kanbanD` (Stand `6333800`), siehe Kontext

## Kontext

- Belegt (Code): Die Oberfläche zeichnet bei jedem Live-Ereignis, das den Serverstand ändert, **alles** neu — `ereignis()` → `laden({ nurBeiAenderung: true })` → `render()` (`web/app.js:1756–1769`, `153–208`); `render()` ersetzt `#kopf`, `#main` und `#over` per `innerHTML` (`web/app.js:446–452`). Ein Kommentar an **irgendeine** Aufgabe ändert `S.aufgaben` und damit den Vergleichsstand (`web/app.js:150`).
- Belegt (Code): Was das Neuzeichnen überstehen soll, retten drei Einzelmechanismen: eine feste Selektorliste der Scrollflächen nur in `#main` (`rollpositionen()`, `web/app.js:467–479`), das fokussierte Eingabefeld nur, wenn es eine `id` trägt (`web/app.js:434–460`), der Fokus über einzelne Sonderfälle (`S.ui.fokus`, `fokusKarte`, `fokusZeile`, `web/app.js:462–464`).
- Belegt (Code): Das Aufgabenfenster liegt in `#over` (`web/ansicht.js:222–237`). Seine Scrollflächen sind im breiten Layout `.mod-main` und `.mod-side` (`web/kd-app.css:226–227`), erst bis 640 px `.mod-body` (`web/kd-app.css:710–714`). Die Felder `input.titel`, Labels, Fälligkeit, Spalte und Klasse tragen `data-af`, aber keine `id` (`web/ansicht.js:225–236`); sie speichern über `change` (`web/app.js:1165–1172`). 37 Eingabeelemente in `web/*.js` haben keine `id`.
- Beobachtet (Probe, 1400 × 700 und 600 × 700, Aufgabe mit 40 Kommentaren, Kommentar per API): Scrollstand von `.mod-main` bzw. `.mod-body` nach dem Ereignis 0 statt 400, sowohl bei Kommentar an dieselbe wie an eine andere Aufgabe. Beim Tippen im Titel landet der Fokus auf `BODY`, **und der halb getippte Titel wird committet** („#1 geändert: Titel“ direkt nach dem fremden Kommentar). Das Kommentarfeld `#km-inp` (mit `id`) behält Inhalt und Fokus.
- Vermutung: Der Commit entsteht, weil das fokussierte, geänderte Feld beim Ersetzen seinen Knoten verliert und dabei `change` auslöst. Nicht im Einzelnen nachverfolgt; die Wirkung ist belegt.
- Ziel aus `AI-Team/umgebung.md` (Lastprofil): Live-Änderung in allen offenen Sichten < 1 s, bis 10 Agenten schreiben gleichzeitig — bei 5 Schreibaufrufen/s zeichnet die Oberfläche also bis zu fünfmal je Sekunde neu. Was ein Mensch gerade liest oder tippt, muss das überstehen, sonst ist das Fenster unter Agentenlast nicht benutzbar.

Die Klasse des Fehlers ist damit nicht „ein Selektor fehlt“, sondern „jede Fläche und jedes Feld, das niemand in eine Liste einträgt, verliert beim Neuzeichnen seinen Zustand“. Die Karte nennt `.mod-body`; das allein hilft nur bis 640 px und weder Fokus noch Titel.

## Optionen

### Option A: Liste erweitern, Feldern `id` geben
`.mod-main`, `.mod-side`, `.mod-body` in `rollpositionen()` aufnehmen, auch `#over` absuchen; jedem Feld des Fensters eine `id`.
- Vorteile: kleinste Änderung, folgt dem vorhandenen Muster; in einer Stunde gebaut.
- Nachteile: behebt diesen Fall, nicht die Klasse — die nächste neue Scrollfläche oder das nächste Feld ohne `id` (heute 37) fällt wieder heraus, und niemand merkt es vor dem Betreiber. Knöpfe und andere fokussierbare Elemente bleiben ungehalten. Der ungewollte Commit beim Ersetzen bleibt.

### Option B: allgemeiner Sicherer in `render()` über stabile Schlüssel
`render()` sichert vor dem Ersetzen **alle** Zustände in `#main` und `#over` und stellt sie danach über einen Schlüssel wieder her, statt Listen zu führen:
- Scrollstand jedes Elements mit `scrollTop`/`scrollLeft` ≠ 0, Fokus des aktiven Elements, Wert und Cursor eines fokussierten Feldes.
- Schlüssel eines Elements: `id`; sonst `data-halt="<name>"`; sonst ein Feldschlüssel (`data-af`, `data-nf`, `data-wf`, `data-wn`, `data-tf`, `data-fb`, `data-bf`, `data-dl`, `data-ef`, `data-sf`, `data-fr` samt Wert, bei Listenzeilen mit `data-i`); sonst `data-act` + `data-arg`; sonst die Klasse, wenn sie im Bereich eindeutig ist. Ohne eindeutigen Schlüssel wird nichts zurückgesetzt (kein Raten an der falschen Stelle).
- Ein Element, das nur durch das Neuzeichnen seinen Knoten verliert, löst keine Speicheraktion aus (ein Merker um das Ersetzen verwirft das `change`, das währenddessen feuert — das Feld hängt dann noch im Dokument; beim Verlassen wird es genau einmal nachgetragen).
- Vorteile: deckt die Klasse ab, auch für künftige Flächen und Felder, ohne dass jemand eine Liste pflegt; ersetzt drei Einzelmechanismen durch einen; bleibt beim heutigen Zeichenmodell (Vorlagen als Zeichenketten, kein Build-Schritt, `A00009`).
- Nachteile: zeichnet weiter alles neu (Kosten je Ereignis unverändert); der Schlüssel aus Klasse oder `data-act` kann bei gleichartigen Elementen mehrdeutig sein — dann gilt die Regel „nichts zurücksetzen“, und es braucht `data-halt`. Restfälle (Textauswahl in Lesetext, aufgeklappte `<details>`) deckt er nicht.

### Option C: gezielt neu zeichnen, nur was sich geändert hat
Je Bereich (`#kopf`, `#main`, `#over`) prüfen, ob sich seine Eingangsdaten geändert haben; das Fenster nur neu zeichnen, wenn sich die offene Aufgabe ändert (Pfade aus dem Ereignis, `A00008`).
- Vorteile: weniger Arbeit je Ereignis; der häufigste Fall der Karte (Kommentar an eine **andere** Aufgabe) lässt das Fenster unberührt.
- Nachteile: löst den Fall „Kommentar an dieselbe Aufgabe“ nicht — dann wird das Fenster doch ersetzt und braucht B ohnehin. Führt Abhängigkeitswissen je Bereich ein (welcher Bereich liest welche Daten); vergisst man eine Abhängigkeit, zeigt die Sicht alten Stand — ein Fehler, der schwerer auffällt als ein Sprung.

### Option D: DOM-Abgleich statt Ersetzen (Morphing)
Neues Markup in einen losen Baum zeichnen und den lebenden DOM per Abgleich angleichen (eigene Funktion oder eingebettete Bibliothek nach dem Muster idiomorph/morphdom); Knoten bleiben erhalten, Scroll, Fokus, Cursor, Auswahl und `<details>` von selbst.
- Vorteile: die gründlichste Antwort — Zustand bleibt, weil Knoten bleiben, auch für Fälle, an die heute niemand denkt.
- Nachteile: tauscht den Zeichenkern der ganzen Oberfläche; Eigenheiten (Eigenschaft `value` gegen Attribut, fokussiertes Feld nicht überschreiben, Listen ohne Schlüssel werden falsch zugeordnet) verlangen selbst Schlüssel wie in B. Neue Abhängigkeit oder einige hundert Zeilen eigener Code ohne Build-Schritt; jeder E2E-Test der Oberfläche ist betroffen. Unverhältnismäßig für einen Fehler, den B ohne Umbau des Kerns schließt.

## Entscheidung

**Gewählt: Option B** — ein allgemeiner Sicherer in `render()`, Schlüsselregel wie oben, gilt für `#main` und `#over`.

B schließt die Fehlerklasse statt des Einzelfalls und ersetzt drei Sonderwege durch einen, ohne das Zeichenmodell anzufassen. Bewusst in Kauf genommen: Es wird weiter alles neu gezeichnet (C bleibt als spätere Lastmaßnahme möglich und baut auf B auf), und Elemente ohne eindeutigen Schlüssel brauchen `data-halt`. D wird erst wieder Thema, wenn B an Restfällen (Textauswahl, `<details>`) mehrfach scheitert oder das Neuzeichnen unter dem Lastprofil messbar zu teuer wird — dann neue ADR, die diese ablöst.

## Konsequenzen

**Positiv:**
- Scroll, Fokus, Wert und Cursor im offenen Fenster überstehen Live-Ereignisse, auch für Felder ohne `id`.
- Kein halb getippter Wert wird mehr durch ein fremdes Ereignis committet.
- Neue Flächen und Felder sind ohne Zutun abgedeckt, solange ihr Schlüssel eindeutig ist.

**Negativ / In Kauf zu nehmen:**
- Rechenaufwand je Ereignis bleibt (volles Neuzeichnen).
- Gleichartige Elemente ohne eindeutigen Schlüssel werden nicht wiederhergestellt; das muss im Markup mit `data-halt` gelöst werden.

**Durchsetzung** (Regel gilt für die ganze Oberfläche):
- E2E-Test „Live-Ereignis bei offenem Fenster“ (Abnahme-Probe der Karte #19) in breitem **und** schmalem Layout: misst `.mod-main` bzw. `.mod-body`, Fokus und Wert des Titelfelds, und dass kein Commit „geändert: Titel“ entsteht.
- Die vorhandenen Proben zur Leseposition (`e2e/tests/r00033-kontextmenue.spec.js:94–103`, `r00054-wbs-sicht.spec.js:106–115`) bleiben grün — sie sind die Regressionsprobe für `#main`.
- Review-Punkt `architektur-reviewer` und `code-reviewer`: keine neue Selektorliste und kein Sonderfall für Fokus neben dem Sicherer.

**Folgeentscheidungen / Aufgaben:**
- [ ] Anforderung aus Karte #19 nach dieser ADR (Vorschlag im Bericht an den Director).
- [ ] Option C prüfen, falls das Neuzeichnen unter dem Lastprofil (5 Schreibaufrufe/s) messbar ruckelt — eigene Karte, eigene ADR.

## Quellen / Bezüge

- Karte #19 (Betreiber, 2026-10-31); `AI-Team/umgebung.md`, Lastprofil
- Bausteine [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md), [A00008 Wächter](../Architektur/A00008-waechter.md) (Quelle der Ereignisse, unverändert)
- R00061 (zeichnet nur bei Änderung), R00033 (Leseposition unter dem Kontextmenü), R00085 (Live-Verbindung)
