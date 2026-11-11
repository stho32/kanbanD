---
id: R00120
status: Neu
datum: 2026-11-11
---

# R00120: Härtung Spalten mit Eigentümer: Format, Sperre, Beschreibung, Oberfläche

## Beschreibung

Die Reviews der abgenommenen Karte #3 (R00097, Spalten mit Eigentümer) ließen Sollte- und Optional-Befunde übrig, die nach der Regel „Nacharbeit nur für Muss“ nicht mehr in R00097 selbst, sondern in die Härtungskarte #26 gesammelt wurden (Details in der Kartenbeschreibung und ihren Kommentaren). Diese Anforderung ist ihre Heimat. Die Architektur hat bestanden: **keine Technikfrage, kein ADR** — Härtung (Präzedenz B0537 / PO Z. 52); eigene Interaction mit eigener Anforderung unter D0002 (Muster I0106–I0109), nicht an das grüne I0086 hängen.

Die Befunde sind teils Muss-nahe Fehler (Punkt 1 und 2 sind Sicherheitsbefunde), teils Beschreibungs-, Doku- und Oberflächenpflege:

1. **Verwaister oder ungültiger Eintrag unter `column-owner` (Sollte, Code- und Security-Review).** Passt der Schlüssel auf keine Spalte (z. B. `eingang` neben Spalte `Eingang`), ist der Wert keine Zeichenkette (z. B. `Eingang: [human]`), oder ist `column-owner` selbst keine Zuordnung (z. B. `column-owner: human`), dann gibt es keinen Hinweis, die Sperre gilt nicht, und beim nächsten Schreiben ist der Eintrag weg. Soll: Hinweis wie bei unbekanntem Wert, Rohwert bleibt erhalten (PO Z. 52). Ort: `src/format/board.rs` :18/:44 (lesen), :280/:284 (schreiben).
2. **Archivieren überspringt Boards mit Formatfehler (Sollte, Security-Review).** `archivieren_pruefen` liest `ordner().boards()?` und verwirft die Defekte-Liste (`src/dienst/zugregeln.rs`:57): ein Agent kann eine Karte archivieren, die auf einem defekten Board in einer Menschen-Spalte liegt.
3. **Architektur-Modell nachziehen (Sollte, Architektur-Review).** `X00001` (:48 „Eigentümer ist gebaut“, :50 „Soll … noch nicht gebaut“, Zeilenverweise), `A00004` (Entnahme-Helfer), `A00006` (`Eigentuemer`, `entnahme_erlaubt`).
4. **Rechtschreibung (Sollte, Rechtschreib-Review).** `src/web/openapi.rs`:13 — Großschreibung nach Doppelpunkt als Hausregel entscheiden; `Dokumentation/Gelerntes.md`:49 — Infinitiv nach „für“ groß.
5. **Oberfläche und Schema (Sollte/Optional, UX- und Code-Review, siehe Kommentare).** Die beiden Kontrastbefunde sind veraltet: R00107 hat `--kd-warn` nachgedunkelt und die Modusleiste „Spalten einrichten“ als Akzent-Container gebaut, damit ist `.eig-roh` (hell 4,86:1 / dunkel 4,79:1, früher hell 4,27:1) und die dunkle Modusleiste (8,24:1 / 8,96:1, früher Titel dunkel 1,33:1) bereits erfüllt — beide bleiben hier nur als Regressionswächter (Punkt 13, 16), ohne Token-Eingriff. Offen sind die Oberflächenpflege: der unbekannte Rohwert ist keine eigene vorausgewählte Option („— keiner —“ steht vorausgewählt, die Entfernung braucht den Umweg Mensch/Agent → „— keiner —“), die Textsammlung `EIGENTUEMER_TEXT` hat keinen Schlüssel für den unbekannten Wert (mit vorausgewähltem Rohwert stünde `.eig-hin` auf „undefined“), der Satz „unbekannter Eigentümer — bleibt erhalten“ steht im `title` eines nicht fokussierbaren `span` statt als Beschreibung der Auswahl, und der Sende-/Rundlauf-Vertrag ist nicht festgeschrieben; dazu der veraltete Artboard-Vermerk (Punkt 5 Doku) und im OpenAPI-Schema `Spalte` fehlt `eigentuemer_unbekannt`; dazu Kommentarstellen und Wortlaut.

Optional (mitgeführt, Punkt 6–11): `entnahme_und_zug_pruefen`/`entnahme_und_grenzen_pruefen` zusammenlegen; Konstruktor/Default für `Spalte` statt 15 Struktur-Literalen; `entnahme_erlaubt` über **alle** Spalten (`any`) statt nur die erste; `Art` und `Eigentuemer` bewusst getrennt im Code festhalten; `eigentuemer: ""` gegen `farbe`/`notiz: ""` einheitlich entscheiden; Hinweis „unbekannter Eigentümer“ um „— bekannt sind human, agent“ ergänzen.

Zahlt ein auf: [Vision](R00000-vision.md) — „Menschen im Browser, KI-Agenten über die API auf einem gemeinsamen Board“; die Freigabe wirkt nur, wenn ihre Sperre nirgends still umgangen wird und ihre Beschreibung, ihre Probe und ihre Oberfläche so genau sind wie die Regel selbst.

### Domänenbezug
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Die Eigentümer-Spalte ist die einzige Stelle, an der kanbanD die Freigabe des Menschen technisch durchsetzt (R00097). Die Reviews von #3 haben zwei Stellen gefunden, an denen die Sperre umgangen werden kann: ein verwaister oder ungültiger `column-owner`-Eintrag hebt den Schutz still auf und verschwindet beim nächsten Speichern (Datenverlust), und ein Board mit Formatfehler wird beim Archivieren übersprungen. Dazu kommen Stellen, an denen die Beschreibung, das Schema und die Oberfläche nicht mit der Regel Schritt halten. Jede ist klein; jede weitere Durchsicht, die sie findet, kostet einen Lauf. Eine Karte, die jeden Befund mit einer messbaren Probe schließt (Rundlauf byte-gleich, Archivsperre bei defektem Board, `any` über alle Spalten, Kontrast ≥ 4,5:1, Schemafeld), macht die Sperre lückenlos und den Wächtervorrat schärfer.

## Funktionale Anforderungen

### Format: verwaiste und ungültige `column-owner`-Einträge (Punkt 1, 10, 11)

1. Ein `column-owner`-Eintrag, dessen Schlüssel auf keine Spalte der Board-Datei passt (z. B. `eingang` neben Spalte `Eingang`), erzeugt einen Hinweis in `hinweise` und bleibt beim nächsten Schreiben erhalten (verlustfreier Rundlauf).
2. Ein `column-owner`-Eintrag mit einem Wert, der keine Zeichenkette ist (z. B. `Eingang: [human]`, eine Zuordnung), erzeugt einen Hinweis und bleibt erhalten.
3. Steht `column-owner` selbst nicht als Zuordnung (z. B. `column-owner: human`), erzeugt das einen Hinweis und der Eintrag bleibt erhalten.
4. Das bestehende Verhalten für einen unbekannten Wert (`chef`) bleibt: Hinweis, Rohwert erhalten, gilt nicht als Eigentümer.
5. Der Hinweis für einen unbekannten Eigentümer nennt die bekannten Werte: „Spalte „<Name>“: unbekannter Eigentümer „<Rohwert>“ — bekannt sind human, agent“ (`src/pruefungen.rs`:41).
6. `eigentuemer: ""` und leere `farbe`/`notiz` werden einheitlich behandelt (entscheiden und festhalten, siehe Offene Fragen).

### Die Entnahmesperre greift überall (Punkt 2, 8, Leerzug)

7. Kann ein Board-Datei des Ordners nicht gelesen werden (Formatfehler), gilt die Archiv-Prüfung für einen Agenten als nicht bestanden: er bekommt eine Abweisung, es wird nichts geschrieben; ein Mensch wird nicht abgewiesen.
8. `entnahme_erlaubt` prüft **alle** Spalten: Liegt eine Nummer in zwei Spalten und gehört eine davon dem Menschen, ist sie gesperrt (`src/modell/board.rs`:505, `find` → `any`).
9. Ein Leerzug eines Agenten in einer Menschen-Spalte (Karte an ihre eigene Stelle, `bewegt: false`) verhält sich wie in der API-Beschreibung: entweder 403 „auch beim Umsortieren“, oder die Beschreibung wird präzisiert (entscheiden, siehe Offene Fragen).

### Beschreibung und Schema (Punkt 4, Punkt 5 Code-Review)

10. Das OpenAPI-Schema `Spalte` enthält `eigentuemer_unbekannt`; `GET /api/boards/{slug}` und die Beschreibung von `GET /api/boards` nennen es.
11. Die Hausregel „Großschreibung nach dem Doppelpunkt“ wird entschieden und in `src/web/openapi.rs` (Karte nennt :13) angewandt.
12. `Dokumentation/Gelerntes.md` (Lehre R00097, Karte nennt :49) schreibt Infinitive nach „für“ groß.

### Oberfläche: Rohwert und Modusleiste (Punkt 5)

13. **Regressionswächter (durch R00107 erfüllt, kein Token-Eingriff):** die Schrift von `.eig-roh` (Farbrolle `--kd-warn`) erreicht gegen den Grund der Spaltenkarte (`.bk-ed`, Fläche `--kd-accent-weak`) im Hell- **und** Dunkelthema mindestens 4,5:1 (WCAG 1.4.3). R00107 hat `--kd-warn` nachgedunkelt; gemessen hell 4,86:1 / dunkel 4,79:1 (die frühere Hellzahl 4,27:1 stammt aus der Zeit vor R00107). Die Probe ist elementgebunden (berechnete `color` von `.eig-roh` gegen berechnetes `background` von `.bk-ed`), nicht tokengebunden.
14. Bei unbekanntem Rohwert ist eine eigene Option vorausgewählt; ihr Text lautet `„<Rohwert>“ (unbekannt)` (z. B. `„chef“ (unbekannt)`), und „— keiner —“ ist dann eine echte Änderung, die den Eintrag in einem Schritt entfernt. Die Textsammlung `EIGENTUEMER_TEXT` trägt dazu einen Schlüssel für den unbekannten Wert: `EIGENTUEMER_TEXT.roh = 'Unbekannter Eigentümer „<Rohwert>“ — bleibt erhalten'`; `.eig-hin` liest damit nie „undefined“. **Sende- und Rundlauf-Vertrag:** (a) ist die Rohwert-Option vorausgewählt und wird ohne Änderung „Fertig“ gewählt, bleibt die Board-Datei byte-gleich (der Eintrag `column-owner: chef` steht unverändert); (b) „— keiner —“ und „Fertig“ entfernen den Eintrag; `eigentuemer` wird auch weiterhin nur bei Änderung gesendet.
15. Der Satz „unbekannter Eigentümer — bleibt erhalten“ ist die zugängliche **Beschreibung** der Auswahl `<select class="inp eig-wahl">`: er liegt in `.eig-hin`, auf das die bereits verdrahtete `aria-describedby` zeigt — nicht im `title` eines nicht fokussierbaren `span`.
16. **Regressionswächter (durch R00107 erfüllt, kein Token-Eingriff):** in der Modusleiste „Spalten einrichten“ (`.kz.modus`) erreichen Titel, Board-Name und „Verwerfen“ gegen die Leistenfläche mindestens 4,5:1 (WCAG 1.4.3). R00107 hat die Fläche `--kd-modus` und die Schrift `--kd-modus-text` gesetzt; gemessen hell 8,24:1 / dunkel 8,96:1 (früher Titel dunkel 1,33:1). Probe elementgebunden: berechnete `color` gegen berechnetes `background-color` von `.kz.modus`.
17. Der Kommentar „Gesendet wird `eigentuemer` nur bei Änderung …“ steht über den Funktionen, die er beschreibt; über `EIGENTUEMER_STREIFEN` steht „Zusatz im aria-label des zugeklappten Streifens (R00097).“ (`web/ansicht.js`:738 f., :1460 f.).
18. In `web/kd-app.css` heißt es „Namensknopf“ statt „Namen-Knopf“ (:111).

### Architektur-Modell (Punkt 3)

19. `X00001` beschreibt den gebauten Stand (Eigentümer gebaut, `entnahme_pruefen`/`entnahme_und_zug_pruefen`, aktuelle Zeilenverweise, „Verboten → 403“); `A00004` nennt den Entnahme-Helfer, `A00006` die Typen `Eigentuemer` und `entnahme_erlaubt`.

### Aufräumen (Optional 6, 7, 9)

20. `entnahme_und_zug_pruefen` und `entnahme_und_grenzen_pruefen` (`src/dienst/zugregeln.rs`:37/:44) teilen sich einen gemeinsamen Kern.
21. Für `Spalte` gibt es einen Konstruktor/`Default` statt der vielen Struktur-Literale (Tests bleiben grün).
22. Dass `Art` (Mensch/Agent, wer handelt) und `Eigentuemer` (human/agent, wem die Spalte gehört) bewusst getrennt sind, steht als Kommentar am Code.

## Nicht-funktionale Anforderungen

- **Sicherheit (prüfpflichtig):** Punkt 1 (ungültiger Rohwert entfernt still den Schutz und geht beim Rundlauf verloren) und Punkt 2 (Archivieren umgeht die Sperre auf einem defekten Board) sind Sicherheitsbefunde. Der `security-reviewer` prüft den gebauten Stand mit einer Angriffsmatrix (Archivieren, vom Board nehmen, bewegen, ziehen — je mit defektem Board und mit verwaistem oder ungültigem `column-owner`) vor der Abnahme. Full-Trust bleibt: die Regel schützt vor Versehen, nicht vor Absicht.
- **Barrierefreiheit:** Kontrast ≥ 4,5:1 (Punkt 13 und 16 sind Regressionswächter — durch R00107 erfüllt, kein Token-Eingriff); der Rohwert ist auch ohne Farbe erkennbar (der Text „(unbekannt)“ an der Option und der Rohwert selbst tragen den Zustand, nicht allein `--kd-warn`); der Satz „unbekannter Eigentümer — bleibt erhalten“ ist als Beschreibung der Auswahl hörbar (Punkt 15, `aria-describedby`).
- **Rückwärtskompatibel:** die Antwortform der 403/Read (`{fehler, spalte, nummer}`, `eigentuemer`, `eigentuemer_unbekannt`, `hinweise`) bleibt; die Härtung ergänzt nur Hinweise, Schemafelder und Oberflächen-Details.

## Akzeptanzkriterien

Gegeben für jede Probe: ein Wegwerf-Ordner mit einem Board „fabrik“, die Spalte „Eingang“ trägt `column-owner: human`, #1 liegt darin; die WBS-Knoten `I0110` (rot) und ihre Features (rot). Alles lässt sich über die Datei oder die API herstellen.

### Format (Punkt 1, 10, 11)

- [ ] **1. Rundlauf verwaister Schlüssel (wörtlich aus #26)**: Board-Datei mit `column-owner:\n  eingang: human` (Spalte heißt `Eingang`) → `GET /api/boards/{slug}` liest das Board ohne Formatfehler, `hinweise` nennt den verwaisten Eintrag, und ein `PUT …/spalten` ohne `eigentuemer` lässt den Eintrag `eingang: human` in der Datei stehen (Rundlauf byte-gleich für diesen Eintrag).
  - Fällt durch: heute — kein Hinweis, Eintrag beim Schreiben weg.
  - Prüfebene: Unit (Format-Rundlauf) + Integration (`tests/spalten.rs`).
- [ ] **2. Nicht-Text-Wert**: Board-Datei mit `column-owner:\n  Eingang: [human]` → Hinweis in `hinweise`, Eintrag bleibt nach einem `PUT …/spalten` ohne `eigentuemer` erhalten.
- [ ] **3. Keine Zuordnung**: Board-Datei mit `column-owner: human` → Hinweis, Eintrag bleibt erhalten.
- [ ] **4. Unbekannter Wert (Regression)**: `column-owner: {Eingang: chef}` → Hinweis, Rohwert erhalten, Eingang ohne Eigentümer (bestehendes AK aus R00097 bleibt grün).
- [ ] **5. Hinweistext (Punkt 11)**: der Hinweis lautet „Spalte „Eingang“: unbekannter Eigentümer „chef“ — bekannt sind human, agent“; `grep` auf „bekannt sind human, agent“ trifft `src/pruefungen.rs`.
  - Prüfebene: Unit (`src/pruefungen.rs`) + `tests/openapi.rs`/Integration.

### Sperre (Punkt 2, 8, 9)

- [ ] **6. Archivieren bei defektem Board (Sicherheitsbefund)**: Board-Datei mit Formatfehler im Ordner, Karte auf einem anderen Board in einer Menschen-Spalte → `POST /api/aufgaben/{nr}/archivieren` als Agent ergibt **kein** 200 (Abweisung), kein Commit; als Mensch wie heute erlaubt.
  - Prüfebene: Integration (neuer Test `tests/spalteneinstellungen.rs` oder `tests/wip_grenze.rs`).
- [ ] **7. Doppelte Nummer (Punkt 8)**: dieselbe Nummer in zwei Spalten, die erste ohne Eigentümer, die zweite `human` → ein Agent wird beim Herausnehmen abgewiesen (403).
  - Prüfebene: Unit (`Board::entnahme_erlaubt`).
- [ ] **8. Leerzug (Punkt 9)**: Agent legt eine Karte in einer Menschen-Spalte an ihre eigene Stelle → Antwort und Beschreibung stimmen überein (403 oder präzisierte Beschreibung); Test belegt die gewählte Fassung.
  - Prüfebene: Integration + `tests/openapi.rs` (Beschreibung).

### Beschreibung und Schema (Punkt 4)

- [ ] **9. Schemafeld (wörtlich aus #26)**: Test auf `components.schemas.Spalte.properties.eigentuemer_unbekannt` besteht (`tests/openapi.rs`); die Beschreibung von `GET /api/boards` nennt das Feld.
  - Prüfebene: `tests/openapi.rs`.
- [ ] **10. Hausregel Doppelpunkt**: in `src/web/openapi.rs` folgt jeder Text nach einem Doppelpunkt der entschiedenen Hausregel; die Regel steht an einem Ort festgehalten.
  - Prüfebene: `grep` + `tests/openapi.rs`.
- [ ] **11. Gelerntes**: `grep -n 'für bewegen' Dokumentation/Gelerntes.md` = 0; die Zeile folgt der Hausregel.
  - Prüfebene: `grep`.

### Oberfläche (Punkt 5)

- [ ] **12. `.eig-roh`-Kontrast (Regressionswächter, durch R00107 erfüllt)**: die berechnete `color` von `.eig-roh` gegen das berechnete `background` von `.bk-ed` ist in Hell- und Dunkelthema ≥ 4,5:1 (gemessen hell 4,86, dunkel 4,79; die alte Hellzahl 4,27 stammt aus der Zeit vor R00107). Kein Token-Eingriff; die Probe hält das Maß, sie ist heute grün.
  - Prüfebene: E2E (Kontrastprobe wie `e2e/einheit/kontrast.test.js`/`e2e/tests/hilfen.js`, sRGB-Auflösung, WCAG-Formel), beide Themen.
- [ ] **13. Rohwert-Option, Hinweistext und Sende-Vertrag**: Board-Datei mit unbekanntem Rohwert `chef` → Spalten-Dialog zeigt `„chef“ (unbekannt)` als vorausgewählte Option, der `.eig-hin`-Satz lautet „Unbekannter Eigentümer „chef“ — bleibt erhalten“ und steht nie auf „undefined“. (a) „Fertig“ ohne Änderung → Board-Datei byte-gleich, `column-owner:\n  In Arbeit: chef` bleibt (kein `eigentuemer` gesendet); (b) „— keiner —“ wählen und „Fertig“ → der `column-owner`-Eintrag der Spalte ist entfernt (Datei enthält kein `column-owner` für die Spalte).
  - Prüfebene: E2E (neu `r00120`); Rundlauf zusätzlich Unit/Integration (`tests/spalten.rs`, Muster `r00097-eigentuemer.spec.js:45–61`).
- [ ] **14. Beschreibung für Hilfstechnik**: bei unbekanntem Rohwert ist „Unbekannter Eigentümer „<Rohwert>“ — bleibt erhalten“ die Accessible Description der `<select class="inp eig-wahl">` (`toHaveAccessibleDescription`), getragen von `.eig-hin`/`aria-describedby`; der Rohwert-`span` trägt kein `title` mehr.
  - Prüfebene: E2E (Accessible Description der Combobox).
- [ ] **15. Modusleiste (Regressionswächter, durch R00107 erfüllt)**: bei dunklem Thema erreicht die berechnete `color` in `.kz.modus` (Titel, Board-Name, „Verwerfen“) gegen das berechnete `background-color` von `.kz.modus` ≥ 4,5:1 (gemessen hell 8,24, dunkel 8,96). Kein Token-Eingriff; die Probe ist heute grün.
  - Prüfebene: E2E/Kontrastprobe, beide Themen.
- [ ] **16. Kommentarstellen und Wortlaut**: `grep -n 'Namen-Knopf' web/kd-app.css` = 0 („Namensknopf“); der Kommentar „Gesendet wird `eigentuemer` nur bei Änderung …“ steht über `eigentuemerGeaendert`/`eigentuemerInDatei`, über `EIGENTUEMER_STREIFEN` steht der Streifen-Kommentar (`web/ansicht.js`).
  - Prüfebene: `grep` + Sichtprüfung.

### Architektur-Modell und Aufräumen (Punkt 3, Optional 6, 7, 9)

- [ ] **17. X00001/A00004/A00006**: `X00001` nennt den gebauten Stand und keine „noch nicht gebaut“-Stelle für den Eigentümer; `grep` auf die Zeilenverweise zeigt auf den gebauten Code; `A00004` nennt den Entnahme-Helfer, `A00006` `Eigentuemer`/`entnahme_erlaubt`.
  - Prüfebene: `grep` + Sichtprüfung.
- [ ] **18. Zusammenlegen (Optional 6)**: `cargo test` grün; die beiden Prüfer teilen einen Kern (keine doppelte Entnahme-Prüfung).
- [ ] **19. Spalten-Konstruktor (Optional 7)**: `cargo test` grün; die Zahl der `Spalte { … }`-Literale ist deutlich kleiner (Konstruktor/`Default`).
- [ ] **20. Trennung `Art`/`Eigentuemer` (Optional 9)**: ein Kommentar am Code nennt die bewusste Trennung.
  - Prüfebene: `grep` auf den Kommentar.

## Betroffene Verzeichnisstruktur

```
src/
├── format/board.rs        # :18/:44 lesen, :280/:284 schreiben — verwaiste/ungültige column-owner erhalten
├── modell/board.rs        # :26 eigentuemer_unbekannt, :505 entnahme_erlaubt (any über alle Spalten)
├── dienst/zugregeln.rs    # :57 archivieren_pruefen (defektes Board), :37/:44 Prüfer zusammenlegen
├── pruefungen.rs          # :41 Hinweistext „— bekannt sind human, agent“
└── web/
    ├── openapi.rs         # :13 Hausregel Doppelpunkt, :29 f. Schema Spalte (eigentuemer_unbekannt)
    └── endpunkte.rs       # :34 GET /api/boards nennt eigentuemer_unbekannt
web/
├── ansicht.js             # :733 `EIGENTUEMER_TEXT` (Schlüssel `roh`), :1460 f. `eigentuemerGeaendert`/`eigentuemerInDatei`, :1486 f. `.eig-wahl`-Optionen, `.eig-hin` als `aria-describedby` (kein `span`-`title`)
├── app.js                 # :1621/:1706/:1903 Rohwert-Vorauswahl und Senden (nur bei Änderung)
└── kd-app.css             # :111 „Namensknopf“; :401 `.eig-roh`-Kontrast und :70 `.kz.modus`-Kontrast nur Regressionswächter (R00107, kein Token-Eingriff)
Dokumentation/
├── Gelerntes.md           # :49 Infinitiv nach „für“
├── Wireframes/D0002.dc.html  # :626 („— keiner —“) nach Freigabe auf die Rohwert-Option nachziehen
└── Architektur/
    ├── Aspekte/X00001-…   # gebauter Stand, Zeilenverweise
    ├── A00004-dienste.md  # Entnahme-Helfer
    └── A00006-modell.md   # Eigentuemer, entnahme_erlaubt
Anforderungen/
└── user-stories/R00120.md # US-1..US-6
e2e/
├── tests/                 # r00120 (Rohwert-Option, Sende-Vertrag, Beschreibung); r00097-eigentuemer.spec.js:45–61 auf die Rohwert-Option umstellen
└── einheit/               # kontrast.test.js läuft mit
tests/
├── spalten.rs / spalteneinstellungen.rs / wip_grenze.rs   # Rundlauf, Archivsperre, doppelte Nummer
└── openapi.rs             # Schemafeld, Beschreibung
```

## Technische Überlegungen

### Optionen (nicht-trivial: die Heimat der Härtung)

| | A: eigene Interaction I0110 unter D0002 | B: Bubbles an I0086 (R00097) | C: eigene Interaction unter D0007 |
|---|---|---|---|
| Abnahme von I0086 | bleibt geschlossen | öffnet sich wieder („alle AK erfüllt“) | bleibt geschlossen |
| WBS-Heimat | Board (D0002) | Board (D0002) | Agenten-Schnittstelle (D0007) |
| Wiederverwendung | Spalten sind ein Board-Begriff; Punkt 2 liegt in der Zugregel | dito | Punkt 2 liegt in der Durchsetzung |
| Muster | I0106–I0109 (Härtungen, D0002) | — | I0108 (D0002, Abweichung D0007) |

**Entscheidung: A.** Die Härtungsregel (`AI-Team/gelerntes.md`, 2026-11-11) sagt: eine Härtungskarte bekommt eine eigene Interaction mit eigener Anforderung, weil die abgenommene I0086 sonst wieder öffnet. Der Elterndialog ist D0002 (Board): der Eigentümer ist eine Spalteneigenschaft, die Oberfläche und die Hinweise liegen auf dem Board; die Durchsetzung (Punkt 2) liegt in D0007, die Abweichung wird in der Notiz genannt (wie bei I0108). B scheidet aus (I0086 grün), C brächte die Oberflächen- und Formatbefunde in den falschen Dialog.

### Optionen (Punkt 2 — Archivieren bei defektem Board)

| | A: fail-safe abweisen | B: nur die betroffene Karte prüfen, sonst durchlassen | C: wie heute überspringen (nichts) |
|---|---|---|---|
| Schutz | hoch: unbekannte Lage sperrt | mittel: hängt an der Auffindbarkeit der Karte | keiner |
| Nutzen | kein Archivieren solange ein Board defekt ist | Agent kann weiterarbeiten | still |
| Risiko | ein defektes Board blockiert alle Archiv-Züge | die Karte kann genau auf dem defekten Board liegen | Umgehung der Sperre |

**Entscheidung: A (fail-safe).** Solange die Lage einer Karte auf einem defekten Board nicht feststellbar ist, darf ein Agent sie nicht archivieren; der Mensch bleibt frei. B lässt genau die Lücke offen, die der Security-Review genannt hat. Die genaue Fehlerart (Empfehlung: 409 „Board „<slug>“ ist defekt“) entscheidet der Entwickler; die Antwortform bleibt nach ADR-0003.

### Ablauf (den Zuschnitt entscheidet der Entwickler)

1. **Format (Punkt 1)**: beim Lesen verwaiste Schlüssel, Nicht-Text-Werte und eine fehlende Zuordnung als Rohwert festhalten und melden; beim Schreiben erhalten.
2. **Sperre (Punkt 2, 8, 9)**: `archivieren_pruefen` fail-safe bei Defekten; `entnahme_erlaubt` über alle Spalten; Leerzug-Antwort/Beschreibung angleichen.
3. **Beschreibung (Punkt 4)**: Hausregel entscheiden, `openapi.rs` und `Gelerntes.md` angleichen; `eigentuemer_unbekannt` ins Schema.
4. **Oberfläche (Punkt 5)**: `.eig-roh`-Kontrast und Modusleiste als Regressionswächter (durch R00107 erfüllt, kein Token-Eingriff), Rohwert-Option samt Hinweistext (`EIGENTUEMER_TEXT.roh`) und Sende-Vertrag, `aria-describedby` statt `span`-`title`, Kommentarstellen, „Namensknopf“.
5. **Modell/Aufräumen (Punkt 3, Optional)**: X00001/A00004/A00006 nachziehen; Prüfer zusammenlegen; Spalten-Konstruktor; Kommentar zur Trennung.

### Grobentwurf

**Wichtige Einstiegsstellen:** das Format (`board::lesen`/`schreiben`), das Modell (`Board::entnahme_erlaubt`), die Zugregeln (`archivieren_pruefen`), die Web-Beschreibung (`openapi.rs`, `endpunkte.rs`), die Oberfläche (`ansicht.js`, `app.js`, `kd-app.css`).

- `Board` (vorhanden) — trägt die unbekannten und die verwaisten `column-owner`-Einträge (Rohform), damit `schreiben` sie verlustfrei zurückgibt.
  - `fn entnahme_erlaubt(&self, art: Art, nummer: u32) -> Result<(), Entnahmesperre>` — prüft **alle** Spalten.
- `ColumnOwnerEintrag` (DTO) — ein `column-owner`-Eintrag, wie er in der Datei steht (Schlüssel, Rohwert, Grund: verwaist / kein Text / keine Zuordnung), für Hinweis und Rundlauf.
- `Hinweis` (vorhanden) — je verwaistem oder ungültigem Eintrag einer, Wortlaut nach Punkt 5.
- `archivieren_pruefen` (vorhanden) — fail-safe: bei defektem Board Abweisung statt Überspringen.
- `Spalte` (vorhanden) — Konstruktor/`Default` statt der Struktur-Literale.

### Änderungen an bestehenden Klassen

- `format::board::lesen`/`schreiben`: verwaiste und ungültige `column-owner`-Einträge roh erhalten und melden.
- `modell::Board::entnahme_erlaubt`: `find` → `any` über alle Spalten.
- `dienst::zugregeln::archivieren_pruefen`: Defekte-Liste beachten.
- `web::openapi`: `Spalte`-Schema um `eigentuemer_unbekannt`; Hausregel nach dem Doppelpunkt.
- `web::ansicht.js`/`app.js`/`kd-app.css`: Rohwert-Vorauswahl, Kontrast, Kommentarstelle, „Namensknopf“.

### Wächter

`tests/spalten.rs`, `tests/spalteneinstellungen.rs`, `tests/wip_grenze.rs`, `tests/openapi.rs`, `e2e/einheit/kontrast.test.js`, `e2e/tests/r00097-eigentuemer.spec.js` (auf die Rohwert-Option umgestellt, :45–61), dazu neu `e2e/tests/r00120-*.spec.js`.

## Tests

Nach Skill `test-pyramide`; jede Szene der User Story ein Test, jeder prüft eine sichtbare Zustandsänderung (Skill `test-ehrlichkeit`).

- **Unit**: Format-Rundlauf mit verwaistem Schlüssel, Nicht-Text-Wert und fehlender Zuordnung (`src/format/board.rs`); `Board::entnahme_erlaubt` mit derselben Nummer in zwei Spalten (`src/modell/board.rs`); Hinweistext (`src/pruefungen.rs`); Schemafeld (`tests/openapi.rs`).
- **Integration**: `tests/spalten.rs`/`spalteneinstellungen.rs` (verwaister Eintrag überlebt `PUT …/spalten`), `tests/wip_grenze.rs` (Archivieren bei defektem Board, Leerzug).
- **E2E**: neu `r00120` — Rohwert-Option vorausgewählt mit Text `„chef“ (unbekannt)`, Hinweistext `EIGENTUEMER_TEXT.roh` an `.eig-hin`, Sende-Vertrag (ohne Änderung byte-gleich, „— keiner —“ entfernt), Beschreibung der Auswahl (`aria-describedby`); `.eig-roh`- und `.kz.modus`-Kontrast als Regressionswächter (heute grün); Muster `r00097-eigentuemer.spec.js`, `kontrast.spec.js`.
  - **Wächter-Umstellung**: `e2e/tests/r00097-eigentuemer.spec.js:45–61` erwartet heute `toHaveValue('')` und `toHaveAccessibleDescription(KEINER)` beim unbekannten Rohwert; nach Punkt 14 zeigt die Combobox die vorausgewählte Rohwert-Option (`toHaveValue` auf den Rohwert-Sentinel) und die Beschreibung des unbekannten Eigentümers — der Test wird im selben Zug umgestellt (weiterhin grün).
- **Security-Review (Prüfpunkt, ausdrücklich)**: Angriffsmatrix für Punkt 1 und 2 vor der Abnahme — Archivieren, vom Board nehmen, bewegen, ziehen, je mit defektem Board und mit verwaistem bzw. ungültigem `column-owner`.
- **Rot vor dem Bau**: Punkt 1 (kein Hinweis, Eintrag weg), Punkt 2 (kein 200 → Archivieren geht durch), Punkt 7 (nur die erste Spalte geprüft), Punkt 9 (Schemafeld fehlt), Punkt 13 (der Rohwert ist keine eigene vorausgewählte Option: „— keiner —“ steht vorausgewählt, die Entfernung braucht den Umweg Mensch/Agent, `.eig-hin` kennt den Rohwert nicht), Punkt 14 (der Satz steht im `title` eines `span`, nicht als Beschreibung der Auswahl), Punkt 16 (`Namen-Knopf` vorhanden), Punkt 20/22 (Kommentar fehlt) sind heute rot. **Nicht rot** (durch R00107 erfüllt, daher nur Regressionswächter): Punkt 12 (`.eig-roh`) und Punkt 15 (Modusleiste).
- **Gegenproben (Mutanten)**: verwaisten Eintrag beim Schreiben verwerfen → AK 1 rot; `boards()`-Defekte ignorieren → AK 6 rot; `find` statt `any` → AK 7 rot; Schemafeld wieder `skip` → AK 9 rot; `.eig-roh`-Option entfernen → AK 13 rot; `EIGENTUEMER_TEXT.roh` entfernen → `.eig-hin` zeigt „undefined“ → AK 13 rot; `.eig-roh` heller ohne Kontrast → AK 12 rot und `.kz.modus`-Text heller → AK 15 rot (Regressionswächter).
- **Mitlaufend grün**: `tests/spalten.rs`, `tests/spalteneinstellungen.rs`, `tests/wip_grenze.rs`, `tests/openapi.rs`, `node --test e2e/einheit/`, `npx playwright test r00097 kontrast kultur ziele`.

## Abhängigkeiten

- R00097 (Spalten mit Eigentümer, I0086), R00102 (Spalteneinstellungen ändern nur Menschen, I0087), R00096 (WIP-Grenze), ADR-0002 (Zugregeln), ADR-0003 (Abweisungen), ADR-0011 (Kontrast), X00001 (Schreibweg und Regeln an Zügen), A00004, A00006.
- Abgegrenzt, nicht Teil dieser Anforderung: die parallele Rundlauf-Lücke beim **Zurückholen** (`zurueckholen_pruefen` verwirft die Defekte-Liste ebenfalls) ist bereits als Grenzfall in `X00001` genannt (R00118/B0537); die Kopfzeichen-Tooltips liegen in I0109/R00119; die Kontrastpaare in R00107.

## Offene Fragen

- Keine blockierende. Zwei Wortlaut-/Verhaltensfragen entscheidet der Entwickler mit Empfehlung: (a) `eigentuemer: ""` — Empfehlung, es wie `farbe`/`notiz: ""` als „entfernt“ zu behandeln (einheitlich), statt wie heute 400; (b) Leerzug — Empfehlung, die API-Beschreibung auf „200 `{bewegt:false}` beim Umsortieren an dieselbe Stelle“ zu präzisieren, statt einen 403 zu erzwingen (die Karte wird nicht entnommen). Die Fehlerart bei defektem Board (Punkt 7): Empfehlung 409 „Board „<slug>“ ist defekt“. Punkt 4 (Großschreibung nach Doppelpunkt) entscheidet der rechtschreib-reviewer; Empfehlung: groß.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine — `web/` ist per `include_bytes!` eingebettet, Änderungen werden erst nach `cargo build` und Neustart sichtbar; die WBS-Änderung ist ein API-Commit, der Projekt-Commit `[DOC]` für Anforderung und User Stories.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser sind die stehen gebliebenen Sollte-/Optional-Befunde aus den Reviews von R00097. Zwei davon sind mehr als Kosmetik: Ein verwaister oder ungültiger `column-owner`-Eintrag hebt den Schutz still auf und verschwindet beim nächsten Schreiben (Datenverlust in einer Datei, die auch von Hand gepflegt wird), und ein defektes Board wird beim Archivieren übersprungen, sodass ein Agent eine Karte aus einer Menschen-Spalte nehmen kann — genau die Umgehung, gegen die R00097 gebaut ist. Beide Befunde sind bisher durch keine Probe gehalten worden (der Rundlauf-Test kennt nur gültige und unbekannte Werte, der Archiv-Test nur lesbare Boards). Indem jeder offene Befund eine wörtlich gefasste Probe bekommt (Rundlauf byte-gleich für den Eintrag, kein 200 beim Archivieren auf defektem Board, `any` über alle Spalten, Schemafeld, Rohwert-Option samt Beschreibung), fällt dieselbe Lücke künftig durch einen Lauf, nicht erst durch die nächste Durchsicht; die beiden Kontrastbefunde sind durch R00107 bereits erledigt und bleiben als Regressionswächter — dieselbe Wirkungskette wie bei den Vorbildkarten #17 (I0106/R00117) und #23 (I0108/R00118): ein Befund wird zur Probe, die Probe zum Wächter. Die UX-Vorprüfung 2026-11-11 hat genau diesen Stand bestätigt (bestanden, kein Muss).

## Missing-Docs

- Keine neue Architektur-Regel; X00001/A00004/A00006 werden nur auf den gebauten Stand gezogen. Der verwaiste `column-owner`-Eintrag wird als Grenzfall in X00001/A00005 genannt.

## Notizen

- **WBS-Heimat (Detailplanung 2026-11-11)**: eigene Interaction I0110 unter D0002 mit eigener Anforderung R00120. Muster: I0106 (Härtung der Kopfzeile), I0107, I0108 (Härtung der WIP-Grenze), I0109 — alle unter D0002. Verworfen: Bubbles/Features an I0086 (R00097) hängen — I0086 ist abgenommen (gruen), ein neuer roter Nachfahre öffnete seine Abnahme wieder (Härtungsregel `AI-Team/gelerntes.md`, 2026-11-11). Der Eigentümer ist eine Spalteneigenschaft des Boards; die Durchsetzung (Punkt 2) liegt in D0007, die Abweichung wird hier genannt (wie I0108).
- **Elterndialog D0002**: Format, Sperre, Hinweise und Oberfläche sind Board-Begriffe; `/api`-Beschreibung und Schema stehen in D0007, die Befunde sind aber Board-Begriffe (Spalte, Eigentümer).
- **Sicherheit**: Punkt 1 und 2 sind Sicherheitsbefunde (Architektur-Kartenkommentar); der `security-reviewer` prüft mit einer Angriffsmatrix vor der Abnahme (siehe Tests).
- **UX-Vorprüfung 2026-11-11 (bestanden — kein Muss, fünf Sollte)**, eingearbeitet:
  - **Veralteter Rot-Vermerk (Sollte):** `.eig-roh`-Kontrast (hell 4,27:1) und die dunkle „Titelleiste“ (Titel dunkel 1,33:1) waren als „rot vor dem Bau“ geführt; R00107 hat beide erfüllt (`--kd-warn` nachgedunkelt, Modusleiste als Akzent-Container). AK 12 und 15 sind jetzt **Regressionswächter** (elementgebunden: `.eig-roh`-`color` gegen `.bk-ed`-`background`, `.kz.modus`-`color` gegen `.kz.modus`-`background`, je ≥ 4,5 hell/dunkel; gemessen 4,86/4,79 bzw. 8,24/8,96). Kein Token-Eingriff; die „Rot vor dem Bau“-Zeile und die alten Zahlen sind korrigiert.
  - **Rohwert-Hinweistext (Sollte):** `EIGENTUEMER_TEXT` bekommt einen Schlüssel für den unbekannten Wert (`EIGENTUEMER_TEXT.roh = 'Unbekannter Eigentümer „<Rohwert>“ — bleibt erhalten'`); sonst stünde `.eig-hin` bei vorausgewähltem Rohwert auf „undefined“. Optionstext `„<Rohwert>“ (unbekannt)`. (FA 14, AK 13)
  - **`aria-describedby` statt `span`-`title` (Sollte):** der Satz „unbekannter Eigentümer — bleibt erhalten“ ist die Accessible Description der `<select class="inp eig-wahl">` (Ziel `.eig-hin`, `aria-describedby` ist verdrahtet), nicht der `title` eines nicht fokussierbaren `span`. (FA 15, AK 14)
  - **Sende-/Rundlauf-Vertrag (Sollte):** (a) Rohwert-Option vorausgewählt, ohne Änderung „Fertig“ → Board-Datei byte-gleich (`column-owner: chef` bleibt); (b) „— keiner —“ + „Fertig“ → Eintrag entfernt. (FA 14, AK 13)
  - **D0002-Notiz (Sollte Doku):** der Artboard-Vermerk in `Dokumentation/Wireframes/D0002.dc.html`:626 (Auswahl zeige „— keiner —“) widerspricht AK 13. R00120 vermerkt: der Zustand „Spalten mit Eigentümer“ ist **nach der Freigabe** auf die vorausgewählte Rohwert-Option nachzuziehen (den gestalter/ die Freigabe regelt der Director); die Artboards selbst ändert der planer nicht.
  - **Optional:** Begriff „Titelleiste“ durch „Modusleiste“ vereinheitlicht (die Leiste heißt `header.kz.modus`, R00107); der Zustand „unbekannt“ steht nicht allein auf der Farbe `--kd-warn`, sondern auf dem Text „(unbekannt)“ und dem Rohwert selbst.
- **Einarbeitung Architektur (2026-11-11, bestanden, kein ADR)**: keine Technikfrage; Präzedenz B0537/PO Z. 52; eigene Interaction/Anforderung; Security-Review nötig; die Zeilenverweise der Karte sind teils veraltet und wurden hier nachgezogen (`src/format/board.rs` :18/:44/:280/:284 statt :18/:43/:265; `entnahme_erlaubt` `src/modell/board.rs`:505 statt :451; `zugregeln.rs`:57 statt :55).
- **Herkunft**: `kd:I0086` (Karte #26 als Härtung nach #3/R00097); die Karte trägt als Herkunft die neue Interaction `kd:I0110`.
