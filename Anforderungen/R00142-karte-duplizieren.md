---
id: R00142
status: Neu
datum: 2026-11-11
---

# R00142: Karte duplizieren

## Beschreibung

Eine Karte lässt sich als **Kopie** anlegen: eine neue Aufgabe mit eigener Nummer, die den sichtbaren Inhalt der Quelle trägt — Titel mit Zusatz „(Kopie)", Beschreibung, Teilaufgaben, Klasse, Zuständige, Labels, Fälligkeit und Herkunft —, aber nichts, was an die Quelle gebunden ist (Fremdschlüssel `key`, Verlauf, Zeiten, Kommentare, Durchläufe, Anhänge, Archivstand, Reservierung, Preisetikett, Signale, WBS-Wirkungen, Phasen-Übersprung, Berichts-Zählung). Der Weg läuft über die API (`POST /api/aufgaben/{nr}/duplizieren`) und aus der Oberfläche über einen Eintrag im Kartenmenü; die Kopie landet in **derselben Spalte** wie die Quelle (lag die Quelle auf keinem Board, entsteht nur die Aufgabendatei) — in **einem** Commit. Mensch und Agent dürfen duplizieren.

Zahlt ein auf: [Vision](R00000-vision.md) — „Aufgaben sind unabhängige Daten", „Mensch und Agent arbeiten gleichberechtigt".

### Domänenbezug
- [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md)
- [Rückgängig](../Dokumentation/Domaenenwissen/D00008-rueckgaengig.md)

## Geschäftlicher Nutzen

Wiederkehrende Arbeit — die wöchentliche Durchsicht, dieselbe Prüfung für eine zweite Lieferung, eine Vorlage mit fester Checkliste — wird heute von Hand nachgebaut: eine neue Karte anlegen und alle Felder neu eintippen. Mit einer Kopie entsteht die zweite Aufgabe in **einem** Zug, mit allen Angaben der ersten und einer eigenen Nummer; die Kopie ist sofort eine normale, unabhängige Aufgabe und trägt nichts von der Quelle mit, was nicht hingehört (kein Fremdschlüssel, keine fremden Zeiten oder Kommentare). Das ist weniger Tipparbeit und weniger Fehler — und es holt die übliche Kanban-Funktion „Karte duplizieren" dorthin, wo sonst alles an der Karte ist: ins Kartenmenü.

## Funktionale Anforderungen

### Duplizieren über die API

1. `POST /api/aufgaben/{nr}/duplizieren` legt aus der Aufgabe `{nr}` eine neue Aufgabe an: neue Nummer, neue Datei, Titel `<Titel> (Kopie)`, sonst die Grundfelder der Quelle. Rumpf optional `{board?, spalte?}` (beide oder keines), wie bei `POST /api/aufgaben`. Antwort **201** mit der neuen Aufgabe (Form wie bei `POST /api/aufgaben`).
2. **Die Kopie trägt** den Titel mit dem Zusatz „ (Kopie)", die Beschreibung, die Teilaufgaben (nur ihre Texte, **alle offen**), die Klasse, die Zuständigen, die Labels, die Fälligkeit und die Herkunft.
3. **Die Kopie trägt nicht**: den Fremdschlüssel `key`, den Verlauf, die Zeiten, die Kommentare, die Durchläufe, die Anhänge, den Archivstand (`archived`), die Reservierung, das Preisetikett (`cost`), die Signale, die WBS-Wirkungen (`wbs-effects`), den Phasen-Übersprung (`phasen.übersprungen`) und die Berichts-Zählung (`reporting`).
4. Unbekannte Nummer → **404**; eine defekte Aufgabendatei der Quelle → **423**; nichts wird geschrieben.
5. Mit `board` und `spalte` liegt die Kopie **unten** in dieser Spalte (wie eine neu angelegte Karte); ohne beide entsteht nur die Aufgabendatei, keine Board-Zeile.
6. Spalten-Sperre und WIP-Grenze gelten wie beim Anlegen: ein Agent über der Grenze der Zielspalte → **409** `{fehler: „Grenze erreicht", spalte, grenze, anzahl}`, nichts wird geschrieben; ein Mensch wird ohne Warnung durchgelassen. Die Eigentümer-Regel sperrt das Duplizieren **nicht** — eine Kopie in eine Menschen-Spalte ist ein Hineinlegen, kein Entnehmen (R00097).
7. Der Commit nennt `#<neu> dupliziert (aus #<nr>)`, mit Zielspalte wie beim Anlegen (` in „<Spalte>" (<Board>)`).
8. Der Weg läuft **atomar unter derselben Sperre** (`gesperrt()`) und schreibt **einen** Commit. Die Kopie wird an **einem Ort** gebildet, indem die Angaben der Quelle (ohne `key`) samt Titelzusatz durch den vorhandenen Anlegeweg gehen; die `key`-Falle entfällt, weil `key` nie gesetzt wird.

### Oberfläche (Kartenmenü)

9. Das Kartenmenü (R00033/I0033) bietet einen Eintrag **„Duplizieren"**; der Vorgang ist ein Aufruf ohne Zwischendialog (die Kopie ist die Quelle plus Zusatz, es ist nichts einzugeben).
10. Das Kartenmenü sendet das angezeigte Board und die Spalte der Quelle mit, sodass die Kopie **in derselben Spalte** erscheint.
11. Nach dem Erfolg steht der [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md) „#<neu> „<Titel> (Kopie)" angelegt" mit [Rückgängig](../Dokumentation/Domaenenwissen/D00008-rueckgaengig.md); „rückgängig" **archiviert die Kopie** (wie beim Anlegen, R00031/I0031).
12. Bei Fehler (404/409/423/Netz) erscheint die Meldung, nichts ist geändert, und es erscheint **keine Erfolgsmeldung vor der Antwort**.
13. Der Eintrag ist mit Maus und Tastatur erreichbar (wie jeder Eintrag des Kartenmenüs).

Wortlaut, Lage, Hinweis und Fokus bestimmt die **UX-Vorprüfung**; die Oberfläche wartet auf ihre Freigabe, der Server-Teil ist frei baubar (siehe „Gestaltung").

## Nicht-funktionale Anforderungen

- **Atomarität:** ein Duplizieren ist **ein** Commit; eine Abweisung (404/409/423) committet nicht.
- **Rückwärtsverträglich:** kein Formatwechsel; eine nie duplizierte Aufgabe bleibt byte-gleich.
- **Gleichberechtigung:** Mensch und Agent duplizieren über denselben Weg; der Commit trägt den Namen der handelnden Person.
- **Barrierefreiheit:** der Menüeintrag ist wie die übrigen per Maus und Tastatur erreichbar (ADR-0010); der Hinweis und seine Aktion überstehen 320/375/414 px ohne Querscrollen (ADR-0015).

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar, Muster `tests/aufgabe_anlegen.rs`): die laufende Instanz mit dem Board „entwicklung" und den Spalten „Eingang", „In Arbeit", „Fertig"; die Aufgabe #1 „Rechnung prüfen" mit Beschreibung, **drei** Teilaufgaben (zwei davon erledigt), Klasse `feature`, Zuständige `[ST]`, Labels `[doku]`, Fälligkeit `2026-11-20`, Herkunft `[kd:I0005]`, einem Anhang, einem Kommentar, einem Zeiteintrag, einem laufenden Timer, einer Reservierung, einem gesetzten Signal, einem Preisetikett und einer WBS-Wirkung; #1 liegt in „In Arbeit". Heute ist der 11.11.2026.

### Kopie anlegen

- [ ] **1. Weg und ein Commit (Abnahme, wörtlich):** Gegeben #1 in „In Arbeit", wenn ich `POST /api/aufgaben/1/duplizieren {board: „entwicklung", spalte: „In Arbeit"}` sende, dann antwortet die API **201** mit der neuen Aufgabe **#2**; `aufgaben/0002-rechnung-pruefen-kopie.md` existiert, #2 steht unten in „In Arbeit", und alles steht in **genau einem** Commit (`git rev-list --count` +1); `git status --short` ist sauber.
  - Fällt durch: mehr als ein Commit; #2 fehlt auf dem Board; #2 mit falschem Titel.
  - Prüfebene: Integration, E2E US-1.
- [ ] **2. Was die Kopie trägt:** Gegeben #1 wie im Grundbestand, wenn ich dupliziere, dann heißt #2 „Rechnung prüfen (Kopie)" und trägt dieselbe Beschreibung, **drei offene** Teilaufgaben (keine Haken), Klasse `feature`, Zuständige `[ST]`, Labels `[doku]`, Fälligkeit `2026-11-20` und Herkunft `[kd:I0005]`.
- [ ] **3. Was die Kopie nicht trägt:** Gegeben #1 wie im Grundbestand, wenn ich dupliziere, dann hat #2 keinen Fremdschlüssel, keine Zeiten, keine Kommentare, keine Durchläufe, keinen Anhangsordner, keinen Archivstand, keine Reservierung, kein Preisetikett, keine Signale, keine WBS-Wirkungen, keinen Phasen-Übersprung und keine Berichts-Zählung.
- [ ] **4. Zweimal duplizieren:** Gegeben #2 ist die Kopie von #1, wenn ich #1 erneut dupliziere, dann entsteht **#3** als weitere Kopie von #1 (Titel „Rechnung prüfen (Kopie)") und #2 bleibt unberührt.
- [ ] **5. Ohne Board:** Gegeben #1 liegt auf keinem Board, wenn ich `POST /api/aufgaben/1/duplizieren` ohne `board`/`spalte` sende, dann entsteht nur die Aufgabendatei der Kopie, keine Board-Zeile, **201**.

### Sperre, Grenze, Fehler

- [ ] **6. WIP-Grenze:** Gegeben die Spalte „In Arbeit" hat Grenze 1 und enthält #1, wenn ein **Agent** #1 dupliziert (nach „In Arbeit"), dann **409** `{fehler: „Grenze erreicht", spalte: „In Arbeit", grenze: 1, anzahl: 1}`, nichts wird geschrieben; dupliziert ein **Mensch**, dann **201** ohne Warnung.
- [ ] **7. Menschen-Spalte sperrt nicht:** Gegeben #1 liegt in einer Spalte mit `column-owner: human`, wenn ein **Agent** #1 dupliziert, dann **201** und die Kopie liegt in derselben Spalte (Hineinlegen ist erlaubt, R00097).
  - Fällt durch: der Agent wird mit 403 abgewiesen.
  - Prüfebene: Integration.
- [ ] **8. Unbekannt und defekt:** Gegeben eine Nummer, die es nicht gibt, wenn ich dupliziere, dann **404**, nichts geändert; gegeben eine unlesbare Aufgabendatei der Quelle, dann **423**, nichts geändert.
- [ ] **9. Wortlaut:** Gegeben #1 in „In Arbeit" auf „entwicklung", wenn ich dupliziere, dann lautet die Commit-Nachricht `#2 dupliziert (aus #1) in „In Arbeit" (entwicklung)`.

### Oberfläche

- [ ] **10. Aus dem Kartenmenü:** Gegeben die Karte #1 auf dem Board bei 1280 px, wenn ich im Kartenmenü „Duplizieren" wähle, dann erscheint #2 unten in derselben Spalte, es steht der Hinweis „#2 „Rechnung prüfen (Kopie)" angelegt" mit „rückgängig", und „rückgängig" **archiviert** #2.
  - Prüfebene: E2E US-1, US-7.
- [ ] **11. Tastatur und Fehler:** Gegeben das Kartenmenü über die Tastatur geöffnet, wenn ich „Duplizieren" per Enter auslöse, dann wirkt es wie der Mausweg; antwortet der Server mit 409/423 oder schlägt das Netz fehl, steht die Meldung sichtbar, und es erschien keine Erfolgsmeldung vor der Antwort.
  - Prüfebene: E2E US-8.
- [ ] **12. Nachbarn unberührt:** Anlegen (R00005), Umbenennen, Archivieren (R00017) und `POST /api/aufgaben` verhalten sich unverändert; `cargo test`, `node --test e2e/einheit/` und die betroffenen Playwright-Proben sind grün.

## Betroffene Verzeichnisstruktur

```
src/
├── dienst/
│   └── aufgabe_anlegen.rs     # Kanban::aufgabe_duplizieren (nutzt aufgaben_anlegen_gesperrt)
└── web/
    ├── mod.rs                 # Route POST /api/aufgaben/{nr}/duplizieren
    └── endpunkte.rs           # Eintrag in /api, /api/endpunkte und openapi
tests/
└── aufgabe_duplizieren.rs     # neu: Felder, ein Commit, Grenze, 404/423
web/
├── menue.js                   # Eintrag „Duplizieren" im Kartenmenü
├── app.js                     # Aktion duplizieren, Senden, Hinweis mit rückgängig
├── ansicht.js                 # nur falls die neue Karte angesteuert wird
└── kd-app.css                 # nur falls Eintrag/Hinweis Gestaltung brauchen
e2e/tests/
└── r00142-karte-duplizieren.spec.js  # neu
```

## Technische Überlegungen

Bindende Technik: **keine eigene ADR** — Architektur-Urteil zum Kartenkommentar #124 (2026-11-11): keine Technikfrage; eigener Endpunkt `POST /api/aufgaben/{nr}/duplizieren`, atomar unter der Sperre, die Kopie an einem Ort definiert, `key` wird nicht kopiert.

### Ablauf

1. **Eingang:** `POST /api/aufgaben/{nr}/duplizieren` mit `X-KanbanD-Wer` → Handelnder (`Person`); Rumpf optional `{board?, spalte?}`.
2. **Dienst unter der Sperre:** `let _sperre = self.gesperrt();`
   - 2.1 **Quelle lesen:** `self.ordner().aufgabe(nr)`; fehlt sie → 404, defekt → 423.
   - 2.2 **Angaben der Kopie bilden** (`key: None`): `Angaben { key: None, klasse, zustaendige, labels, faellig, herkunft, beschreibung, teilaufgaben: <Texte ohne Haken> }`; Titel `format!("{} (Kopie)", quelle.titel)`.
   - 2.3 **Über den vorhandenen Anlegeweg schreiben:** `aufgaben_anlegen_gesperrt(&_sperre, wer, &NeueAufgaben { titel: [Eintrag::MitAngaben { … }], board, spalte })` — Nummernvergabe, Board-Zeile, WIP-Grenze und **ein** Commit sind dort schon richtig.
3. **Antwort:** 201 mit der neuen Aufgabe.
4. **Oberfläche:** Kartenmenü → „Duplizieren" → `POST …/duplizieren {board, spalte}` → Hinweis mit „rückgängig".

### Grobentwurf (Klassen-Entwurf ohne Implementierungen)

Die öffentliche API wächst um **eine** Methode; alles andere ist vorhanden (`aufgaben_anlegen_gesperrt`, `Angaben`, `Eintrag`, `NeueAufgaben`).

- `Kanban::aufgabe_duplizieren(wer: &Person, nr: u32, zielort: Zielort) -> Result<Aufgabe, Fehler>` — liest die Quelle, bildet die Kopie und reicht sie an den Anlegeweg durch. Rückgabe: die neue Aufgabe.
- `Zielort` (DTO, immutable) — `{ board: Option<String>, spalte: Option<String> }` als Rumpf des Endpunkts (beide oder keines).
- `Angaben` (vorhanden) — nimmt die Felder der Quelle auf; `key` bleibt `None`.

### Änderungen an bestehenden Klassen

- `src/dienst/aufgabe_anlegen.rs` — neue Methode `aufgabe_duplizieren`; der vorhandene `aufgaben_anlegen_gesperrt` wird nur **benutzt**, nicht geändert.
- `src/web/mod.rs` / `src/web/endpunkte.rs` — neue Route samt Beschreibung.

### Optionen (Skill `optionen-vor-entscheidung`)

| | A: eigener Endpunkt, der den Anlegeweg benutzt (gewählt) | B: nur Oberfläche, zwei Aufrufe (GET, dann POST) | C: eigener Endpunkt baut die Datei selbst | D: Kopie mit `key` |
|---|---|---|---|---|
| Wege zur Kopie | einer, an einer Stelle definiert | zwei; zwischendrin ändert sich die Quelle | einer, aber am Anlegeweg vorbei | einer |
| `key`-Falle | entfällt (nie gesetzt) | vermeidbar, aber Client-Wissen | entfällt | Kopie trägt fremden Schlüssel |
| Grenze/Sperre/Commit | vom Anlegeweg geerbt | doppelt nachgebildet | Nachbau von Hand | — |
| Atomarität | ja (eine Sperre) | nein (zwei Anfragen) | ja | ja |

**Entscheidung: A.** Der Endpunkt ist dünn (Quelle lesen, Angaben ohne `key`, Anlegeweg aufrufen), erbt Nummernvergabe, Board-Zeile, WIP-Grenze und „ein Commit" und definiert die Kopie an genau einer Stelle — die Empfehlung des Architektur-Urteils (#124). Verworfenes unter Notizen.

### Gestaltung

Der Eintrag „Duplizieren" im Kartenmenü und der Hinweis sind eine **kleine Ergänzung** bestehender Ansichten (Kartenmenü I0033, [Hinweis](../Dokumentation/Domaenenwissen/D00007-hinweis.md)). Nach der Vision-Leitplanke „Jede Gestaltung wird freigegeben, bevor sie gebaut wird" **liegt die UX-Vorprüfung noch nicht vor**: sie bestimmt Wortlaut („Duplizieren"), Lage im Menü, Hinweistext und Rückgängig-Verhalten (`Strg+Z`); der Kartenmenü-Zustand am Artboard D0002 wird um die Zeile ergänzt und vom product-owner freigegeben. Bis dahin ist der **Server-Teil** (Endpunkt, Dienst; F0110) frei baubar; die Oberflächen-Bubbles (F0111) warten.

## Tests

Nach Skill `test-pyramide`.

- **Unit:** keiner — die Logik hängt an Dateien und Boards; das prüft die Integration.
- **Integration:** neu `tests/aufgabe_duplizieren.rs`: AK 1–9 samt Git-Prüfung (`git rev-list --count`, `git show`, `git status`), Felder ja/nein, zweimal duplizieren, ohne Board, WIP-Grenze, Menschen-Spalte, 404/423, Wortlaut. Muster `tests/aufgabe_anlegen.rs`.
- **E2E (Playwright):** neu `e2e/tests/r00142-karte-duplizieren.spec.js`: AK 10–12 (Kartenmenü, gleiche Spalte, Hinweis/rückgängig, Tastatur, Fehlerpfad). Muster `e2e/tests/r00033-kontextmenue.spec.js`.
- **Rot vor dem Bau:** die Akzeptanztests beginnen als `test.fail` mit Verweis auf #124.
- **Gegenproben (Mutanten):** `key` mitkopiert; Zeiten oder Kommentare mitkopiert; zweiter Commit; Kopie ohne Board-Zeile; Haken der Teilaufgaben mitkopiert.

## Abhängigkeiten

- **Abhängig von (grün):** I0005 Aufgabe anlegen (R00005, `POST /api/aufgaben`, `aufgaben_anlegen`), I0033 Kontextmenü der Karte (R00033), I0011 Aufgabenfenster (R00011, Beschreibung/Teilaufgaben), I0086 Spalten mit Eigentümer (R00097, Sperre), I0031 Rückgängig (R00031, Hinweis).
- **Blockiert:** — .
- **Kein ADR** (keine Technikfrage, Architektur-Urteil Kartenkommentar #124).
- **Gestaltung:** UX-Vorprüfung für den Menüeintrag und den Hinweis vor dem Bau der Oberfläche (F0111); der Server-Teil (F0110) ist frei baubar.

## Offene Fragen

1. **Nummernverbrauch:** Eine Kopie verbraucht eine neue Nummer. Empfehlung: so lassen — eine Kopie ist eine eigenständige Aufgabe, kein Sonderzustand.
2. **Ort der Kopie:** Die Kopie landet unten in derselben Spalte (AK 5). Alternative: unmittelbar hinter der Quelle (Index Quelle+1). Empfehlung: unten wie beim Anlegen — der vorhandene Anlegeweg kann es, und die Kopie ist eine neue Karte, kein Nachbar.
3. **Haken der Teilaufgaben:** Die Kopie bekommt alle Teilaufgaben **offen** (AK 2). Alternative: den Erledigt-Stand mitkopieren. Empfehlung: offen — eine Kopie ist eine neue Aufgabe, kein Zwilling.
4. **Rückgängig:** „rückgängig" archiviert die Kopie (AK 10). Empfehlung: wie beim Anlegen (R00031). Bestätigt die UX-Vorprüfung.
5. **Duplizieren aus der Aufgabenliste:** Der Eintrag steht im Kartenmenü (D0002). Soll die Aufgabenliste (D0004) denselben Eintrag bekommen? Empfehlung: eigener kleiner Auftrag, nicht hier.
6. **Herkunft der Kopie:** Die Kopie erbt die Herkunft der Quelle (AK 2), obwohl sie ein eigener Vorgang ist. Empfehlung: ja — dieselbe Quelle hat dieselbe Herkunft.

## Manuelle Vorbereitungstätigkeiten

- Bildschirmfotos des Kartenmenü-Eintrags „Duplizieren" und des Hinweises mit „rückgängig" bei 320, 414 und 1280 px, je hell und dunkel, nach der UX-Vorprüfung auf den Abnahmezettel.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Der Auslöser ist Karte #32, gesplittet in #124: kanbanD hat „übliche Kanban-Funktionen" noch nicht, und „Karte duplizieren" fehlt (Architektur-Urteil 2026-11-11). Der Schmerzpunkt ist wiederkehrende, gleichartige Arbeit: dieselbe Durchsicht, dieselbe Prüfung für eine zweite Lieferung, dieselbe Checkliste — heute jedes Mal von Hand nachgebaut, indem der Mensch eine leere Karte anlegt und jedes Feld neu tippt. Wird das Duplizieren über einen **dünnen Endpunkt** geführt, der die Angaben der Quelle (ohne Fremdschlüssel) und den Titel mit Zusatz „(Kopie)" durch den **vorhandenen Anlegeweg** reicht, dann entsteht in **einem** Zug eine eigenständige Aufgabe mit eigener Nummer, die auf demselben Board in derselben Spalte erscheint — und Nummernvergabe, Board-Zeile, WIP-Grenze und der **eine** Commit sind automatisch richtig, weil `aufgaben_anlegen_gesperrt` sie schon kann; der `key` der Quelle kann nicht versehentlich mitwandern, weil er nie gesetzt wird. Der Hebel ist genau diese Stelle — kein zweites Schreibverfahren, keine neue Datenhaltung, nur ein Aufruf vor dem bestehenden Weg: gerade weil „die Dateien sind der einzige Speicher" und „ein Commit je Aktion" gelten, ist die Kopie eine gewöhnliche Anlage und braucht nichts Eigenes außer dem einen Schritt, der die Quelle liest.

## Missing-Docs

- Das Domänenwissen kennt „Kartenmenü" und „duplizieren" nicht. Vorschlag: eigener Eintrag „Karte duplizieren" mit der Abgrenzung zur Ablage (Kopie = eigene Aufgabe mit eigener Nummer, kein Zwilling; ohne Fremdschlüssel, ohne Verlauf/Zeiten).

## Notizen

**Verworfene Alternativen (Optionen-Tableau):**

- **B — nur Oberfläche, zwei Aufrufe (GET, dann POST):** zwei Schritte, zwischen denen sich die Quelle ändern kann, und ein zweiter Weg zur Kopie (Client-Wissen); keine Atomarität.
- **C — eigener Endpunkt baut die Datei selbst:** Nummernvergabe, Board-Zeile, WIP-Grenze und Commit müssten neben `aufgaben_anlegen_gesperrt` nachgebaut werden.
- **D — Kopie mit `key`:** der Fremdschlüssel ist ein Merkmal des fremden Systems, nicht der Aufgabe; er wäre sofort doppelt vergeben (die `key`-Falle des Kartenkommentars).

**Bewusst außerhalb:** Duplizieren aus der Aufgabenliste (offene Frage 5); eine ausdrückliche „Vorlagen"-Karte (eigene Anforderung); Nachziehen von Format A00005 (kein Formatwechsel).
