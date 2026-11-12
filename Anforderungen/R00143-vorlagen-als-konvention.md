---
id: R00143
status: Neu
datum: 2026-11-12
---

# R00143: Karten- und Board-Vorlagen als Konvention

## Beschreibung

Eine Vorlage ist **kein eigenes Konzept**: kein `vorlagen/`-Ordner, kein `template:`-Feld, keine Oberflächen-Aktion „Als Vorlage speichern". Als Vorlage dient eine **gewöhnliche Karte** in einem gewöhnlichen Board (Kartenvorlage) oder ein **gewöhnliches Board** mitsamt seiner Struktur (Boardvorlage); kopiert wird mit dem vorhandenen Weg **Duplizieren** (R00142/I0130) und — für die Board-Struktur — durch Kopieren der Board-Datei. Diese Anforderung schreibt die Konvention und ihre Grenzen als Abschnitt „Vorlagen" in `README.md`; sie baut **nichts**.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben sind unabhängige Daten", „Das Board besitzt seine Struktur", „Ordneraufbau", „Die Dateien sind der einzige Speicher".

## Geschäftlicher Nutzen

Wiederkehrende Arbeit hat dieselbe Form: die wöchentliche Durchsicht, die Abnahme einer Lieferung, ein Board mit denselben Spalten, Grenzen, Phasen und Terminen für das nächste Projekt. Heute entsteht jede Wiederholung von Hand — Felder neu tippen, Spalten neu einrichten. Der Weg zum Kopieren ist längst da (`Duplizieren`, R00142; Board-Dateien sind Markdown), aber niemand sagt, dass eine Vorlage genau das ist und wie man eine benutzt; also wird entweder nachgebaut oder eine „Vorlagen"-Funktion vermutet, die es nicht gibt. Ein kurzer Abschnitt in der Projektdokumentation macht aus vorhandenen Fähigkeiten eine benutzbare Konvention und verhindert zugleich den naheliegenden Fehlschluss, es brauche dafür Format, Ordner oder Oberfläche.

## Funktionale Anforderungen

1. **Der Abschnitt.** `README.md` trägt zwischen „Der Ordner" und „Für Agenten" einen Abschnitt **„Vorlagen"** von höchstens etwa 20 Zeilen, deutsch, im Ton der übrigen Abschnitte.
2. **Was eine Vorlage ist.** In einem Satz: eine Vorlage ist eine gewöhnliche Karte bzw. ein gewöhnliches Board, das als Kopiervorlage dient — es gibt kein eigenes Format, keinen Ordner, kein Frontmatter-Feld und keine Aktion „Als Vorlage speichern".
3. **Kartenvorlage.** Der Abschnitt nennt den Weg: die Vorlagenkarte steht **offen in einer Spalte eines Boards** (empfohlen: die Spalte, in der neue Arbeit beginnt, etwa „Eingang" oder „Backlog" — dann liegt die Kopie gleich am richtigen Ort; auf dieser Spalte keine WIP-Grenze, sonst weist kanbanD einen Agenten mit 409 ab, R00142 FA 6) — Kartenmenü → **„Duplizieren"**. Die Kopie trägt den Titel mit Zusatz „(Kopie)", Beschreibung, Teilaufgaben (alle offen), Klasse, Zuständige, Labels, Fälligkeit und Herkunft, aber keine Zeiten, Kommentare, Anhänge und keinen Verlauf (R00142 FA 2/3), und sie landet **in derselben Spalte**; danach Titel kürzen und Felder anpassen.
4. **Boardvorlage — Struktur über die Datei.** Der Abschnitt nennt den Weg für die ganze Struktur: `boards/<vorlage>.md` kopieren, **Dateinamen** (= Slug und Adresse `#/board/<slug>`) und `# `-Überschrift neu setzen, die Aufgabenzeilen `- [#nr](../aufgaben/…)` entfernen und ein `archived:` aus dem Frontmatter streichen. Die übrigen Frontmatter-Schlüssel bleiben und tragen die Struktur mit: `limits`, `column-phases`, `column-checks`, `column-notes`, `column-colors`, `column-owner`, `column-dates`, `milestones`, `start`, `fever`, `report-filter`, `report-labels`, `applications`. Die kopierte Datei **committet der Mensch selbst** (kanbanD committet fremde Änderungen nicht, Vision „Kein Git-Client"); das neue Board erscheint im Board-Umschalter.
5. **Boardvorlage — ohne Datei.** Alternativ nennt der Abschnitt den Weg über die Oberfläche: neues Board im Board-Umschalter („Neues Board · Enter", es kommen die drei Standardspalten „Zu erledigen", „In Arbeit", „Erledigt" mit, `src/dienst/board_anlegen.rs:9`), dann Struktur im Spalten-Dialog (`PUT /api/boards/{slug}/spalten`) und in den Berichten nachziehen (Termine R00047, Berichtsfilter R00043, „Rechnen ab").
6. **Karten in das neue Board.** Der Abschnitt nennt beide Wege: **Mensch** — Karte auf der Vorlagen-Seite duplizieren (die Kopie bleibt in der Quellspalte), im Kartenmenü „Auf Board legen" und in der Aufgabenliste „Von Board nehmen"; **Agent** — ein Aufruf `POST /api/aufgaben/{nr}/duplizieren {board, spalte}` legt die Kopie direkt in der Zielspalte ab (R00142 FA 1/5).
7. **Grenzen.** Der Abschnitt sagt offen: **keine Automatik** (beim Anlegen wird keine Vorlage angeboten), **keine Wahl** von Zielboard/-spalte im Kartenmenü (die Kopie bleibt in der Spalte der Quelle), **kein** Kopieren der Board-Struktur durch kanbanD, **keine** Format- oder Vision-Änderung; Vorlagen zählen nur auf ihrem eigenen Board in den Berichten (Berichte und Berichtsfilter gelten je Board).
8. **Was nicht dazugehört.** Der Abschnitt nennt ausdrücklich, was es nicht gibt und nicht kommen soll: `vorlagen/`-Ordner, `template:`-Feld, Format-Versionierung, Oberflächen-Aktion „Als Vorlage speichern"/„Neu aus Vorlage", ADR.

## Nicht-funktionale Anforderungen

- **Reine Dokumentation:** die Änderung berührt nur `README.md`; `src/`, `web/`, `tests/`, `e2e/` und die Board-Dateien bleiben byte-gleich, es gibt keinen Commit im Board-Repository.
- **Rückwärtsverträglich:** kein Formatwechsel (A00005 unberührt), keine Vision-Fortschreibung, kein ADR; eine nie als Vorlage benutzte Datei bleibt unverändert.
- **Sprache:** deutsch wie das README; kein Kunstbegriff („Vorlage", nicht „Template"), keine neuen Domänenwörter ohne Glossareintrag (Missing-Docs).
- **Ehrlichkeit:** der Abschnitt nennt die Grenzen aus FA 7; er verspricht keine Automatik und keine Zielwahl.

## Akzeptanzkriterien

**Grundbestand:** der Stand von `main`; `README.md` mit den Abschnitten „Start", „Bedienen in Kürze", „Der Ordner", „Für Agenten", „Tests"; ein Board „entwicklung" mit den Spalten „Eingang", „In Arbeit", „Fertig"; die Karte #1 „Wöchentliche Durchsicht" mit drei offenen Teilaufgaben und dem Label `vorlage` in „Eingang".

### Der Abschnitt

- [ ] **1. Vorhanden und einordnend:** Gegeben das README, wenn ich nach „Vorlagen" suche, dann steht dort ein Abschnitt „Vorlagen" zwischen „Der Ordner" und „Für Agenten", und er sagt in den ersten Sätzen, dass eine Vorlage eine gewöhnliche Karte oder ein gewöhnliches Board ist und es kein eigenes Format, keinen Ordner und keine Aktion „Als Vorlage speichern" gibt.
- [ ] **2. Kartenvorlage:** Gegeben der Abschnitt, wenn ich ihn lese, dann nennt er Kartenmenü → „Duplizieren", die Kopie **in derselben Spalte**, den Titelzusatz „(Kopie)", was mitkommt (Beschreibung, offene Teilaufgaben, Klasse, Zuständige, Labels, Fälligkeit, Herkunft) und was nicht (Zeiten, Kommentare, Anhänge, Verlauf).
- [ ] **3. Boardvorlage über die Datei:** Gegeben der Abschnitt, wenn ich ihn lese, dann nennt er die Schritte Datei kopieren, Dateiname und `# `-Überschrift neu, Aufgabenzeilen und `archived:` entfernen, die tragenden Frontmatter-Schlüssel (`limits`, `column-phases`, `milestones`, `report-filter`, `applications`, …) und dass der Mensch selbst committet.
- [ ] **4. Boardvorlage ohne Datei:** Gegeben der Abschnitt, wenn ich ihn lese, dann nennt er „Neues Board · Enter" samt den drei Standardspalten und das Nachziehen von Spalten, Terminen und Berichtsfilter über die vorhandenen Dialoge.
- [ ] **5. Karten ins neue Board:** Gegeben der Abschnitt, wenn ich ihn lese, dann nennt er für den Menschen „duplizieren, Auf Board legen, Von Board nehmen" und für den Agenten `POST /api/aufgaben/{nr}/duplizieren {board, spalte}`.
- [ ] **6. Grenzen:** Gegeben der Abschnitt, wenn ich ihn lese, dann nennt er die vier Grenzen aus FA 7 (keine Automatik, keine Zielwahl im Kartenmenü, kein Struktur-Kopieren durch kanbanD, Berichte je Board).
- [ ] **7. Nicht-dazugehöriges:** Gegeben der Abschnitt, wenn ich ihn lese, dann stehen dort `vorlagen/`-Ordner, `template:`-Feld, Format-Versionierung und „Als Vorlage speichern" als ausdrücklich **nicht** vorhanden.

### Nachbarn unberührt

- [ ] **8. Nur Doku:** Nach dem Bau nennt `git diff --stat` als Anwendungsdatei nur `README.md` (dazu die Anforderungsdatei selbst); `src/`, `web/`, `tests/`, `e2e/` sind unverändert; `cargo test`, `node --test e2e/einheit/` und die Playwright-Suite sind grün wie vorher.

## Betroffene Verzeichnisstruktur

```
README.md        # neuer Abschnitt „Vorlagen" — die einzige Änderung
```

Kein `src/`, `web/`, `tests/`, `e2e/`: die Anforderung baut nichts.

## Technische Überlegungen

Bindende Technik: **keine eigene ADR** — Betreiber-Entscheidung 2026-11-12 (Kartenkommentar #125): eine Vorlage ist eine Konvention über vorhandenen Dateien; der Format-, Ordner- und ADR-Teil entfällt. Es gibt keinen Code zu entwerfen; dieser Abschnitt begründet nur den Ort und die Grenzen des Textes.

### Optionen (Skill `optionen-vor-entscheidung`)

| | A: Abschnitt in `README.md` (gewählt) | B: eigene Datei `Dokumentation/Vorlagen.md` + Zeiger im README | C: Hinweis in der Oberfläche (Board-Pop, Feld „Neues Board", Kartenmenü) | D: Bau „Board duplizieren" (Endpunkt + Menüeintrag) |
|---|---|---|---|---|
| Findbarkeit | dort, wo das Handbuch ist | zwei Stellen, ein Zeiger mehr | am Ort der Handlung | am Ort der Handlung |
| Kosten | ein Absatz | ein Absatz, ein Zeiger, eine neue Datei | Textänderung + Artboard-Freigabe (Vision-Leitplanke) | Endpunkt, Dienst, Menü, Tests, Artboard |
| Format berührt | nein | nein | nein | nein |
| Verhältnis zur Entscheidung | genau die Konvention | genau die Konvention | mehr als die Konvention | widerspricht „Konvention, kein neues Konzept" |

**Entscheidung: A.** Das README ist das einzige Handbuch des Projekts (es beschreibt schon „Der Ordner" und die Bedienwege); ein eigener Abschnitt genügt, solange er ~20 Zeilen bleibt. **C** verlangt nach der Vision-Leitplanke „Jede Gestaltung wird freigegeben, bevor sie gebaut wird" ein Artboard und liefert wenig — der Text gehört in die Doku, nicht in ein Pop. **D** ist eine eigene Funktion (Struktur kopieren) und widerspricht dem Zuschnitt der Entscheidung; als Folgekarte denkbar (Offene Frage 1).

### Ablauf

1. **Eingang:** wer wissen will, wie eine Vorlage geht, liest das README.
2. **Kartenvorlage:** Vorlagenkarte → Kartenmenü „Duplizieren" → Kopie in derselben Spalte → Titel und Felder anpassen.
3. **Boardvorlage:** Board-Datei kopieren und anpassen **oder** neues Board anlegen und Struktur nachziehen → Karten duplizieren (Mensch: duplizieren/legen/abnehmen; Agent: ein Aufruf mit `{board, spalte}`).
4. **Kein Schritt im Programm:** kein Dienst, kein Endpunkt, kein Menüeintrag, keine Datei unter `src/`, `web/`, `tests/`, `e2e/`.

### Grobentwurf

Entfällt — kein Code.

## Tests

Nach Skill `test-pyramide`: hier trägt keine Ebene, weil sich nur Prosa ändert.

- **Unit:** keiner.
- **Integration:** keiner.
- **E2E:** keiner.
- **Abnahme (Leseprobe):** AK 1–7 am gebauten README, wörtlich gegen den Text; AK 8 als Nachweis, dass nur `README.md` geändert ist (`git diff --stat`) und die Suiten unverändert grün sind.
- **Gegenprobe (Mutante):** ein Abschnitt, der „Als Vorlage speichern" oder ein `template:`-Feld als vorhanden darstellt, fällt in AK 1/AK 7 durch.

## Abhängigkeiten

- **Abhängig von (grün):** I0130 Karte duplizieren (R00142 — Weg, Kopie in derselben Spalte, `{board, spalte}`), I0008 Boards wechseln und anlegen (R00008 — `POST /api/boards {titel, spalten}`, drei Standardspalten), I0009 Spalten einrichten (R00009), I0043 Berichtsfilter (R00043 — `report-filter:` je Board), I0047 Termine (R00047 — `milestones:`), R00128 (archiviertes Board bleibt lesbar — `archived:`), A00005 Format (Aufbau der Board-Datei).
- **Blockiert:** — .
- **Kein ADR** (Betreiber-Entscheidung 2026-11-12, Kartenkommentar #125).
- **Kein WBS-Knoten:** die Anforderung baut nichts, also gibt es keine Interaction und keine Bubble (Begründung in der WBS unter „Notizen / Quellen").

## Offene Fragen

1. **Zielboard und Zielspalte beim Duplizieren.** Die Kopie bleibt in der Spalte der Quelle (R00142 FA 10); die API kann `{board, spalte}` schon, die Oberfläche fragt nicht. Empfehlung: **nicht hier** — eigene Karte „Duplizieren nach Board/Spalte" (Kartenmenü-Untermenü), wenn der Bedarf nach dem ersten Gebrauch bleibt.
2. **Ort der Doku.** README jetzt; eine eigene Datei erst, wenn der Abschnitt über ~30 Zeilen wächst oder eine bebilderte Anleitung dazukommt. Empfehlung: so lassen.
3. **Erkennbarkeit von Vorlagen-Boards** im Board-Umschalter (etwa Namensvorsatz „Vorlage: …"). Empfehlung: reine Namenskonvention, keine Automatik und keine Markierung — sonst entsteht doch ein Vorlagen-Konzept.
4. **Label `vorlage`** an Vorlagenkarten (Filter `label:vorlage` blendet sie aus). Empfehlung: als Tipp im Abschnitt nennen, nicht als Pflicht.

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist Karte #32, geteilt in #124 und #125: kanbanD soll „übliche Kanban-Funktionen" haben, und „Vorlagen" klingt nach einem eigenen Format — nach einem Ordner, einem Feld, einer Oberfläche, einer Vision-Zeile, einem ADR. Wer das so baut, bezahlt dauerhaft: jedes Format braucht Leser, Schreiber, Prüfungen, Tests und eine zweite Vorstellung davon, was eine Aufgabe ist; genau das verbietet die Leitplanke „Aufgaben sind unabhängige Daten" und „Die Dateien sind der einzige Speicher". Die Betreiber-Entscheidung dreht es um: **weil** eine Vorlage nur eine gewöhnliche Karte in einem gewöhnlichen Board ist, ist sie bereits kopierbar — durch `Duplizieren` (R00142), das die Angaben der Quelle ohne Fremdschlüssel durch den vorhandenen Anlegeweg schickt, und für die Board-Struktur durch das Kopieren einer Markdown-Datei, die ohne kanbanD lesbar ist. Fehlt nur noch, dass es dasteht: ein Absatz im Handbuch macht aus einer vorhandenen Fähigkeit eine benutzbare Konvention, kostet keinen Code und keinen Formatwechsel und nimmt dem nächsten Bearbeiter die Versuchung, „Vorlagen" als Feature zu bauen. Der Hebel ist also die Doku — nicht, weil Dokumentation billiger ist, sondern weil hier die Funktion schon vollständig existiert und jede Zeile Code sie nur schlechter machen würde.

## Missing-Docs

- Das Domänenwissen kennt „Vorlage" nicht. Vorschlag an den `fachspezialist`: Eintrag **„Vorlage"** mit der Abgrenzung „gewöhnliche Karte oder gewöhnliches Board als Kopiervorlage; kein eigenes Format, kein Ordner, kein Feld, keine Automatik" — und Verweis auf „Karte duplizieren" (Vorschlag aus R00142 Missing-Docs).

## Notizen

**Entfallen mit der Betreiber-Entscheidung 2026-11-12 (Kartenkommentar #125), ausdrücklich:** (a) **Vorlagen-Ordner** `vorlagen/` und jede Änderung der Leitplanke „Ordneraufbau"; (b) **`template:`-Feld** im Frontmatter und **Format-Versionierung** (A00005 bleibt unberührt); (c) **Vision-Fortschreibung** (`/vision fortschreiben` entfällt — die Vision bleibt, wie sie ist); (d) **ADR-0024/0025-Anschluss** für Format/Folder (keine Technikfrage); (e) **Oberflächen-Aktion** „Als Vorlage speichern" bzw. „Neu aus Vorlage" und jede Automatik beim Anlegen; (f) **automatisches Kopieren der Board-Struktur** durch kanbanD. Was bleibt, ist ein Abschnitt im README.

**Verworfene Alternativen (Optionen-Tableau):**

- **B — eigene Datei `Dokumentation/Vorlagen.md` mit Zeiger im README:** zwei Stellen zu pflegen, für ~20 Zeilen zu viel; `Dokumentation/` ist Engineering-Doku (Architektur, ADRs, Wireframes, Planung), das Handbuch ist das README.
- **C — Hinweis in der Oberfläche** (Board-Pop, Feld „Neues Board", Kartenmenü): verlangt nach der Vision-Leitplanke eine Gestaltungsfreigabe für einen Satz Text, der besser in die Doku gehört; widerspricht zudem „keine Oberflächen-Aktion".
- **D — Bau „Board duplizieren"** (Endpunkt, Dienst, Menüeintrag, Tests, Artboard): kopiert die Struktur in einem Zug, ist aber eine eigene Funktion und kein Vorlagen-Konzept; als Folgekarte denkbar (Offene Frage 1), nicht in diesem Zuschnitt.

**Bewusst außerhalb:** Wahl von Zielboard/-spalte im Kartenmenü (Offene Frage 1); Markierung von Vorlagen-Boards (Offene Frage 3); Vorlagen für Berichte oder Einstellungen; jede Änderung an Format, Vision oder Architektur.

**Keine User Story:** die Anforderung ändert kein sichtbares Verhalten der Anwendung — sie ändert einen Text. Es gibt nichts, was ein Entwicklertest im Programm abnehmen könnte; die Abnahme ist die Leseprobe (AK 1–8).
