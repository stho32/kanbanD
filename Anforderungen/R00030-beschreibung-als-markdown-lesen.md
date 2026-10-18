---
id: R00030
status: Neu
datum: 2026-10-18
---

# R00030: Beschreibung als Markdown lesen

## Beschreibung

Die Beschreibung einer Aufgabe ist Markdown. Im Aufgabenfenster erscheint sie formatiert — Überschriften, Listen, Hervorhebungen, Code, Links, Zitate —; ein Klick (oder Enter auf dem Bereich) wechselt ins Textfeld, Verlassen speichert und zeigt sie wieder formatiert. Links öffnen in einem neuen Fenster; nichts aus der Beschreibung wird als HTML ausgeführt.

Zahlt ein auf: [Vision](R00000-vision.md) — „Ein Kanban, das ein Ordner ist“ (Markdown bleibt Markdown, kanbanD zeigt es lesbar).

## Geschäftlicher Nutzen

Längere Beschreibungen sind lesbar statt Rohtext.

## Funktionale Anforderungen

- Unterstützt: `#`–`###` Überschriften, Absätze, Zeilenumbruch, `-`/`*`/`1.` Listen, `**fett**`, `*kursiv*`, `` `code` ``, Codeblöcke mit ```` ``` ````, `> Zitat`, `[Text](URL)` und nackte `http(s)://`-Adressen.
- Sicherheit: aller Text wird zuerst maskiert; Links nur mit `http:`, `https:`, `mailto:`, `vscode:` oder relativ; sonst bleibt der Text ohne Link.
- Leere Beschreibung zeigt direkt das Textfeld mit Platzhalter.

## Akzeptanzkriterien

- [ ] `# T\n\n**a** *b* `c`\n- x\n- y` → `<h3>T</h3><p><strong>a</strong> <em>b</em> <code>c</code></p><ul><li>x</li><li>y</li></ul>` (Überschriften im Fenster eine Stufe kleiner)
- [ ] `<script>alert(1)</script>` erscheint als Text; `[x](javascript:alert(1))` ergibt keinen Link
- [ ] Oberfläche: Beschreibung mit Liste erscheint formatiert; Klick → Textfeld mit dem Markdown; Verlassen → gespeichert und wieder formatiert

## Betroffene Verzeichnisstruktur

`web/markdown.js` (pure), `web/ansicht.js`, `web/app.js`; Tests `e2e/einheit/markdown.test.js`, `e2e/tests/r00030-markdown.spec.js`.

## Tests
- Unit: alle Elemente, Maskierung, Link-Schemata
- E2E: Lesen, Bearbeiten, Speichern

## Abhängigkeiten
- Abhängig von: R00011

## Offene Fragen
