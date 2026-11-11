---
id: R00138
status: Neu
datum: 2026-11-11
---

# R00138: Der gehaltene Fokus trifft nach einer fremden Listenänderung dasselbe Element

## Beschreibung

Die Listenzeilen des Aufgabenfensters adressieren Teilaufgabe und Herkunft über ihre **Stelle**: das ✕ ist `data-act="teil-weg" data-arg="${j}"` (`web/ansicht.js:324`), das ✕ der Herkunft `data-act="herkunft-weg" data-arg="${j}"` (`:288`), die bearbeitbare Zeile `data-act="teil-bearbeiten" data-arg="${j}"` (`:321`). Der Sicherer aus ADR-0007 findet ein Element über die Schlüsselregel `id` → `data-halt` → Feldschlüssel (samt `data-i`) → `data-act`(+`data-arg`) → `href` → Klassen (`web/sichtzustand.js:20–34`). Ohne `id` und ohne `data-halt` fällt ein ✕ auf die Stelle zurück.

Eine Listenposition ist aber kein stabiler Schlüssel: Entfernt ein Agent „Teilaufgabe eins" über die API, zeichnet das Live-Ereignis die Liste neu, und „zwei" steht jetzt an Stelle 0. Der gehaltene Schlüssel `[data-act="teil-weg"][data-arg="1"]` trifft danach „Teilaufgabe drei entfernen" — der Fokus steht auf einem fremden ✕, und der nächste Tastendruck entfernt es. Der Mensch verliert Inhalt, den er nie gewählt hat.

Diese Anforderung setzt ADR-0007 Nachtrag N3 um: Listenzeilen und zerstörende Knöpfe tragen einen **inhaltsbezogenen** `data-halt`, und ein zerstörender Knopf wird **nie über seine Stelle** gehalten. Sie deckt die beiden heute betroffenen Listen — Teilaufgabe und Herkunft — und gilt nach derselben Regel für jede künftige Liste.

Nicht Teil: die Adressierung des Löschens selbst (welche Stelle die `DELETE`-Anfrage trifft, der Doppelklick-Fall). Das ist der eigene Strang #106 (Vorrang) und #65 (ADR-0017 Konsequenz „Teilaufgaben-Index", ausdrücklich in Kauf genommen); ADR-0007 N3 regelt **nur**, worüber der Sicherer ein Element wiederfindet.

Zahlt ein auf: [Vision](R00000-vision.md) — „Es ist per Tastatur bedienbar und folgt gewohnten Konventionen." Eine Tastatur, deren nächster Druck ungewollt einen fremden Eintrag löscht, ist nicht bedienbar; die Leitplanke „Die Dateien sind der einzige Speicher" wiegt den Verlust zusätzlich.

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md)

## Geschäftlicher Nutzen

Der Betreiber arbeitet im Aufgabenfenster mit der Tastatur: er fährt auf das ✕ einer Teilaufgabe und drückt Enter. Während er zielt, kann ein Agent (bis zu zehn schreiben gleichzeitig, Lastprofil) die Liste ändern. Adressiert das ✕ die Stelle, wandert der Fokus unter seinen Fingern auf einen fremden Eintrag, und der nächste Druck löscht ihn — ein Commit, ein unwiederbringlicher Verlust ohne Nachfrage. Mit einem inhaltsbezogenen Schlüssel bleibt der Fokus auf **demselben** Eintrag; ist der Inhalt nicht eindeutig, fällt er harmlos auf den Abschnitt (`#teil-neu`, das Herkunftsfeld) und nie auf ein fremdes ✕.

## Funktionale Anforderungen

1. Jedes fokussierbare Element einer Listenzeile trägt einen **inhaltsbezogenen, stabilen `data-halt`** — nie die Stelle. Für die Teilaufgabe aus ihrem Text (`teil:<text>` für die bearbeitbare Zeile, `teil-weg:<text>` für das ✕, sinngemäß für das Kästchen); für die Herkunft aus dem Verweis (`herkunft:<verweis>` / `herkunft-weg:<verweis>`). Je fokussierbarem Teil ein **eigener** Wert: tragen Zeile und ✕ denselben Wert, zählt die Schlüsselregel den Selektor zweimal und verwirft ihn (ADR-0007 N3 Regeln 2, 3).
2. Die Schlüsselregel findet `data-halt` **vor** `data-act`+`data-arg` — heute schon so (`web/sichtzustand.js:24` vor `:29`); es ist keine neue Vorrangstufe nötig.
3. **Ein zerstörender Knopf wird nie über seine Stelle gehalten.** Ist der `data-halt` eines ✕ im Bereich nicht eindeutig (zwei gleiche Texte), weicht der Sicherer für ein Element, das eine **entfernende** Aktion auslöst, **nicht** auf `[data-act][data-arg]` aus. Er hält nichts, und der Fokus fällt nach ADR-0010 N7a/N7b auf den Ort des Abschnitts (`#teil-neu` bzw. das Herkunftsfeld) — nie auf das ✕ eines fremden Eintrags. Den Schnitt (eigene Marke am zerstörenden Knopf oder Regel im Schlüsselmodul `web/sichtzustand.js`) wählt der `entwickler` (ADR-0007 N3 Regel 4).
4. `data-arg` **bleibt**: das ✕ behält die Stelle, damit die Aktion sie weiter adressiert (`web/app.js` `teil-weg`/`herkunft-weg`); nur der Schlüssel des Sicherers kommt aus `data-halt` (ADR-0007 N3 Regel 5).
5. **Die eigene Aktion bleibt unverändert.** Nach dem eigenen Entfernen steht der Fokus auf dem ✕ des Nachbarn (R00112 FA 8, `nachbarNachEntfernen`, `fokusNachEntfernen`); nach dem Rückgängig auf dem ✕ des wiederhergestellten Elements bzw. dem Ort des Abschnitts (`#teil-neu`). Diese Wege sind Regressionswächter, kein Teil des Umbaus.
6. Kein neues Aussehen und kein neuer Zustand: nur Markup-Schlüssel und die Regel für zerstörende Knöpfe. `data-halt` ist unsichtbar.

## Nicht-funktionale Anforderungen

- **Eine Stelle**: Die Schlüsselregel bleibt in `web/sichtzustand.js` (ADR-0007 N1); es entsteht keine zweite Liste neben ihr. Review-Punkt für `architektur-reviewer` und `code-reviewer`: ein fokussierbares Element in einer Liste, dessen einziger stabiler Schlüssel die Stelle (`data-arg`/`data-i`) ist, ist ein Befund — jedes trägt einen inhaltsbezogenen `data-halt` oder wird bewusst nicht gehalten (zerstörend und nicht eindeutig).
- **Wächter**: Die Node-Unit der Schlüsselregel (`e2e/einheit/sichtzustand.test.js`) hält die Reihenfolge `data-halt` vor `data-act`+`data-arg` und das „nichts halten statt Stelle" für zerstörende Knöpfe fest. Die vorhandenen R00112-Fokusproben (`e2e/tests/r00112-rueckgaengig.spec.js`, eigene Aktion) bleiben grün.
- **Zeit**: Der Fokus steht nach dem Live-Ereignis (≤ 1 s, Lastprofil) auf dem Ziel; kein Warten auf einen zweiten Takt.

## Akzeptanzkriterien

Grundbestand (über die API herstellbar, Identität `X-KanbanD-Wer`): Aufgabe #1 offen im Aufgabenfenster, Teilaufgaben „eins", „zwei", „drei"; eine zweite Karte mit gleichen Verweisen für den Doppeltext-Fall; Personen Mensch und Agent. Breite 1280 px, Thema hell. „Fokus auf X" heißt `document.activeElement` ist X; „dasselbe Element" heißt derselbe Inhalt (derselbe Teilaufgabentext bzw. derselbe Herkunftsverweis), auch wenn er nach der fremden Änderung an einer anderen Stelle steht.

### Fremde Löschung (ADR-0007 N3 Regel 2)

- [ ] **1. Abnahme-Probe der Karte #40, wörtlich**: „Fokus auf „Teilaufgabe zwei entfernen", bot entfernt „eins" über die API → Fokus liegt nicht auf „Teilaufgabe drei entfernen"." Der Bot entfernt „eins" mit `DELETE /api/aufgaben/1/teilaufgaben/0` als Agent.
  - Besteht (nach dem Fix): nach dem Live-Ereignis (≤ 1 s) ist `document.activeElement` das ✕ mit dem zugänglichen Namen „Teilaufgabe zwei entfernen" (heute Stelle 1), nicht „Teilaufgabe drei entfernen".
  - Fällt durch (heute): der Fokus steht auf dem ✕ von „Teilaufgabe drei entfernen".
  - Prüfebene: E2E `r00138-fokus-listen.spec.js` (neu).

### Doppelter Inhalt (ADR-0007 N3 Regel 4)

- [ ] **2. Doppeltext — nichts halten statt Stelle**: Zwei gleich benannte Teilaufgaben („gleich", „gleich") und eine dritte. Der Bot entfernt eine „gleich" über die API.
  - Besteht: der Fokus steht auf `#teil-neu`, **nie** auf dem ✕ der anderen „gleich".
  - Fällt durch: der Fokus steht auf dem ✕ der verbliebenen „gleich" (die Stelle hätte geraten).
- [ ] **3. Herkunft**: Fokus auf dem ✕ einer Herkunft; der Bot entfernt eine **andere** Herkunft über die API.
  - Besteht: der Fokus steht weiter auf dem ✕ **derselben** Herkunft (gleicher Verweis); zwei gleiche Verweise und eine fremde Löschung → der Fokus steht im Herkunftsfeld (`#herkunft-neu`), nie auf dem ✕ der anderen.
  - Fällt durch: der Fokus steht auf dem ✕ einer fremden Herkunft.

### Eigene Aktion und Grenze (Rückschritt-Wächter)

- [ ] **4. Eigene Aktion unverändert (R00112 FA 8)**: Eigenes Entfernen von „zwei" → der Fokus steht auf dem ✕ des Nachbarn (folgender rückt nach, am Ende der vorige); ist danach keine Teilaufgabe mehr da, auf `#teil-neu`. Nach Strg+Z steht der Fokus auf dem ✕ des wiederhergestellten Elements.
  - Prüfebene: E2E; `e2e/tests/r00112-rueckgaengig.spec.js` bleibt grün.

### Schlüsselregel (Node-Unit, ADR-0007 N3 Testbarkeit)

- [ ] **5. Zerstörender Knopf ohne eindeutigen `data-halt` hält nichts**: Eingabe ein Element `{ id: '', daten: { halt: 'teil-weg:zwei', act: 'teil-weg', arg: '1' } }` und eine Zählfunktion, die `[data-halt="teil-weg:zwei"]` einmal und `[data-act="teil-weg"][data-arg="1"]` einmal zählt.
  - Besteht: die Ausgabe ist `[data-halt="teil-weg:zwei"]`.
  - Fällt durch: zählt die Funktion den `data-halt` **zweimal**, ist die Ausgabe `''` — **nicht** `[data-act="teil-weg"][data-arg="1"]` (Regel 4).
  - Prüfebene: `e2e/einheit/sichtzustand.test.js`.

## Betroffene Verzeichnisstruktur

```
web/
  ansicht.js          data-halt am Inhalt: Teilaufgabe (Text, Kästchen, ✕) und Herkunft (Chip, ✕)
  sichtzustand.js     zerstörender Knopf ohne eindeutigen data-halt: kein Rückfall auf die Stelle
e2e/
  einheit/sichtzustand.test.js        Node-Unit: zerstörender Knopf hält nicht über die Stelle
  tests/r00138-fokus-listen.spec.js   neu: fremde Löschung, Doppeltext, Herkunft, eigene Aktion
```

## Technische Überlegungen

Nach ADR-0007 Nachtrag N3 (Akzeptiert, bindend); der Baustein A00009 (Oberfläche) trägt die Soll-Notiz. Die Frage „stabiler Schlüssel statt Listenindex" ist dort entschieden und wird hier nicht wiederholt.

### Optionen

| | A: inhaltsbezogener `data-halt` je Teil (ADR-0007 N3) | B: Position als Schlüssel behalten, nur die Anzeige verbessern | C: zerstörende ✕ ganz aus dem Sichern nehmen |
|---|---|---|---|
| Deckt die Probe | ja | nein — der Fokus folgt weiter dem Index | nein — verliert R00112 FA 8 |
| Risiko | gering: zwei Attribute je Zeile, keine neue Vorrangstufe | hoch: jede fremde Löschung verschiebt den Fokus | mittel: die Rückgabe nach dem eigenen Entfernen entfällt |
| Sichtbare Änderung | keine (`data-halt` ist unsichtbar) | keine | keine |

**Entscheidung: A** (ADR-0007 N3): Nur der inhaltliche Schlüssel erhält beides — denselben Eintrag nach fremder Änderung und den Nachbarn nach eigener Aktion. B behebt den Einzelfall nicht; C nimmt den R00112-Weg heraus. Ein Ordinal unter Gleichnamigen (`teil-weg:2:<text>`) ist wieder eine Stelle und entfällt (dann gilt Regel 4: nichts halten).

### Ablauf

1. `web/ansicht.js` `vTeilaufgaben` (`:321`/`:324`) und die Herkunftszeile (`:288`): je fokussierbarem Teil ein eigener inhaltsbezogener `data-halt`; `data-arg` und `data-act` bleiben.
2. `web/sichtzustand.js`: für ein Element mit **entfernender** Aktion (`teil-weg`, `herkunft-weg`, künftig sinngemäß) wird der Kandidat `[data-act][data-arg]` nicht in die Liste aufgenommen bzw. verworfen; der Schnitt ist die Wahl des Entwicklers (ADR-0007 N3 Regel 4).
3. `web/`-Dateien sind per `include_bytes!` eingebettet — sichtbar erst nach `cargo build` und Neustart.

### Wächter

`e2e/einheit/sichtzustand.test.js` (Schlüsselregel), `e2e/tests/r00112-rueckgaengig.spec.js` (eigene Aktion), `r00106-fokus.spec.js` (Fokusführung), `node --test e2e/einheit/`.

## Tests

Nach Skill `test-pyramide` und `test-ehrlichkeit`; jede Szene prüft eine Zustandsänderung (Fokus am Element), nicht nur den Aufruf.

- **Unit (Node, rein)**: `e2e/einheit/sichtzustand.test.js` — AK 5; `data-halt` vor `data-act`+`data-arg`, zerstörender Knopf ohne eindeutigen `data-halt` ergibt `''`.
- **E2E (Playwright)**: neu `e2e/tests/r00138-fokus-listen.spec.js` mit US-1 bis US-4 (AK 1–4); Muster `r00112-rueckgaengig.spec.js` (`kanbanStarten(einrichten(DATEIEN))`, `alsPerson(page, …)`, Live-Ereignis über die API). Rot vor dem Bau: AK 1 fällt heute durch (Fokus auf dem ✕ des Nachfolgers).
- **Mitlaufend grün**: `r00112-rueckgaengig.spec.js`, `r00106-fokus.spec.js`, `node --test e2e/einheit/`.

## Abhängigkeiten

- ADR-0007 Nachtrag N3 (Akzeptiert, bindend), ADR-0010 N6 (`data-halt`), N7a/N7b (Rückfall); R00112 FA 8 (eigene Aktion, Wächter), R00106 (Fokusführung).
- Abgegrenzt, nicht Teil dieser Anforderung: die DELETE-Adressierung #106/#65 (welche Stelle der Aufruf trifft); die übrigen Listen (Zeiten, Anhänge) folgen derselben Regel, wenn sie fokussierbare Zeilen bekommen.
- Blockiert: keine Interaction.

## Offene Fragen

- Keine. Die Technikfrage ist mit ADR-0007 N3 entschieden; der Auftrag nennt eine feste eigene R-Nummer (R00138).

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine — kein neuer Gestaltungszustand (nichts wird neu sichtbar), `web/` ist eingebettet und erst nach `cargo build` und Neustart sichtbar.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist der Code-Review #19 (A2, Sollte) und der Befund der Karte #40: Nach einer fremden Listenänderung landet der gehaltene Fokus auf dem ✕ des Nachfolgers, ein zweiter Tastendruck entfernt ihn. Die Ursache ist die Adressierung über die Liste**stelle** (`data-arg` = Index). Eine Stelle benennt nach jeder fremden Änderung ein anderes Element; sie taugt nicht als Identität.

Weil der Sicherer aus ADR-0007 schon eine Schlüsselregel mit `data-halt` besitzt und der Bestand das Muster kennt (`kopf:<spalte>`, `klapp:<spalte>`, `info:<spalte>`, ADR-0010 N6), zahlt diese Anforderung nur den inhaltlichen Schlüssel an der Zeile nach: X (Listenzeile adressiert über den Inhalt) → Y (der Sicherer findet nach jeder fremden Änderung denselben Eintrag bzw. hält nichts und fällt auf den Abschnitt) → Z (der nächste Tastendruck trifft nie ein fremdes ✕; kein ungewollter Commit). Kein neuer Mechanismus, kein Umbau der Oberfläche, keine neue Abhängigkeit.

## Missing-Docs

- Keine. ADR-0007 N3 und ADR-0010 N6/N7a/N7b tragen die Regel bereits.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene kleine Interaction **I0127** unter D0003 (Aufgabe), Bubbles B0628 (Akzeptanztest) und B0629 (data-halt und Regel) mit eigener Anforderung R00138. Die Härtungsregel (`AI-Team/gelerntes.md` 2026-11-11; Vorbilder I0106/R00117, I0110/R00120, I0121/R00131, I0122/R00132, I0123/R00135) verlangt das: der Auftrag des Directors nannte „WBS I0101/R00112 (F0064/B0474)", aber I0101 ist **grün/abgenommen** — eine rote Folge-Bubble daran öffnete dessen Abnahme („alle AK erfüllt") wieder. Der Auftrag nennt zugleich eine feste eigene R-Nummer (R00138), was zur eigenen Interaction passt. Elterndialog D0003, weil Teilaufgabe und Herkunft im Aufgabenfenster liegen (wie I0101 und I0098).
- **Weiche (befunde-einplanen)**: kein Befund an einer Befundbehebung (die Ursache ist die Adressierung, kein Rückschritt eines Fixes); der Nutzer kann den Vorgang nicht sicher ausführen — die Zusage „der Fokus bleibt auf demselben Element" fehlt in R00112. Deshalb neuer Umfang, eigene Anforderung (nicht `aus-bug`, nicht Bubble).
- **Architektur (Karte #40, bestanden 2026-11-11, arch)**: Technikfrage „stabiler Schlüssel statt Listenindex" → ADR-0007 Nachtrag N3 (`data-halt` für Listenzeilen); kein neuer ADR.
- **Abgrenzung #106/#65**: Die DELETE-Adressierung (Doppelklick auf ✕ löscht die nachgerückte) bleibt dort; hier geht es nur um den **gehaltenen Fokus**.
