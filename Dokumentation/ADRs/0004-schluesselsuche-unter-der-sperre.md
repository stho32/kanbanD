# ADR-0004: Schlüsselsuche unter der Sperre durch Lesen des Ordners, ohne Index

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00098 (genutzt von R00099)
**Erprobt durch**: —
**Nachträge**: 2026-11-15 — die Schlüsselsuche sieht auch defekte Aufgabendateien: lesbarer Schlüssel gleich dem angefragten oder Schlüssel nicht bestimmbar → **423** statt einer zweiten Karte (Karte #44, **Vorgeschlagen**, eine Frage an den product-owner offen), siehe [Nachtrag N1](#nachtrag-2026-11-15-n1-die-schlüsselsuche-sieht-auch-defekte-dateien-karte-44). Der Text oberhalb der Nachträge ist der Stand der Annahme und bleibt unverändert.

## Kontext

Anlegen mit `key` muss idempotent sein: zwei Sensoren mit demselben Schlüssel dürfen nie zwei Karten erzeugen. Archivierte Karten zählen mit; doppelte Schlüssel (nach einem Merge) sollen gemeldet und nicht defekt werden. Die Dateien sind die Wahrheit, sie ändern sich auch von außen (Editor, `git pull`), der [Wächter](../Architektur/A00008-waechter.md) sieht das nur verzögert. Archivierte Aufgaben liegen im selben Ordner `aufgaben/` mit Feld `archived`.

## Optionen

### Option A: Suche über `ordner().aufgaben()` unter derselben Sperre wie das Anlegen
- Vorteile: immer der Stand auf der Platte; kein zweiter Zustand; Rennen zwischen zwei Anfragen ausgeschlossen, weil Suche und Anlegen unter `gesperrt()` liegen.
- Nachteile: jedes Anlegen mit `key` liest alle Aufgabendateien (O(n)); bei vielen tausend Karten spürbar.

### Option B: Schlüssel-Index im Speicher, gepflegt über eigene Schreibvorgänge und den Wächter
- Vorteile: Nachschlagen O(1).
- Nachteile: Änderungen von außen kommen erst nach Bündelung (150 ms) an — genau dann entsteht die Doppelte; zweiter Zustand mit eigener Fehlerklasse.

### Option C: Schlüssel im Dateinamen
- Vorteile: Suche über Verzeichnisliste.
- Nachteile: ändert das Dateiformat und bestehende Links; Schlüssel bis 200 Zeichen mit beliebigen Zeichen passen nicht in Dateinamen.

## Entscheidung

**Gewählt: Option A**

Korrektheit gegen Änderungen von außen wiegt schwerer als die Kosten; `aufgaben_anlegen` liest den Ordner ohnehin unter der Sperre (`naechste_nummer`). Bei `…/mehrere` wird **einmal** je Anfrage gesucht, nicht je Eintrag; doppelte Schlüssel innerhalb der Anfrage werden im Speicher zusammengeführt. Wird das Lesen messbar zu langsam, ist Option B mit Abgleich gegen die Platte der nächste Schritt (neue ADR).

## Konsequenzen

**Positiv:**
- Die Suche ist eine reine Funktion über `&[Aufgabe]` im [Modell](../Architektur/A00006-modell.md) (`key → Treffer 0|1|n`); der Filter `?key=` und R00099 nutzen dieselbe.
- Doppelte Schlüssel bleiben lesbare Aufgaben; `Kanban::zustand` meldet sie in einer eigenen Liste neben `defekte`.

**Negativ / Inkauf zu nehmen:**
- O(n) Dateilesen je Anlegen mit Schlüssel.

**Folgeentscheidungen / Aufgaben:**
- [ ] Lastprobe beim Bau: 2 000 Aufgaben, Anlegen mit `key` unter 200 ms (Abnahme-Idee, keine Anforderung).

## Nachtrag 2026-11-15 N1: Die Schlüsselsuche sieht auch defekte Dateien (Karte #44)

**Status des Nachtrags: Vorgeschlagen** — Entscheider: Claude (autonom, architekt, Auftrag Director Karte #44). Die Punkte 1, 2 und 4–7 sind durch Code und bestehende Systemantwort getragen; **Punkt 3 wartet auf den product-owner** (Frage unter „Offen“). Der Status von ADR-0004 bleibt `Akzeptiert`; Option A (Lesen des Ordners unter der Sperre) bleibt gewählt. Der Nachtrag löst die Zusage „immer der Stand auf der Platte“ für die Dateien ein, die das Lesen heute verwirft.

Anlass ist Karte #44 (aus Code-Review #4, Sollte, latent): „Steht in einer Aufgabendatei ein `key`, den `Fremdschluessel::pruefen` ablehnt, wird die Datei `defekt`; sie fehlt in der Suche nach Schlüssel und in `dubletten`. Ein erneutes Anlegen mit demselben Schlüssel erzeugt eine zweite Karte.“

### Belegt (Code), Stand `karte/44` = `main` vom 2026-11-15

- **Streng gelesen**: `format::aufgabe::lesen` prüft `key` mit derselben Prüfung wie die API (`src/format/aufgabe.rs:54–57`, `Fremdschluessel::pruefen` in `src/modell/aufgabe.rs:157–164`: getrimmt 1–200 Zeichen ohne Zeilenumbruch). Ein Wert, der kein Skalar ist (Liste, Zuordnung, `null`), wird zum leeren Text (`yaml::wert_als_text`, `src/format/yaml.rs:99–106`) und fällt damit durch. Folge ist ein `Formatfehler` für die **ganze** Datei; der bestehende Test hält das fest (`src/format/aufgabe.rs:522–525`: `key: ""`, Zeilenumbruch, Liste).
- **Defekt heißt unsichtbar für die Suche**: `Ordner::aufgaben` legt jede Datei mit Lesefehler und jede mit doppelter Nummer in die zweite Liste (`src/ablage.rs:88`, `:91`). `anlegen_gesperrt` wirft diese Liste weg (`src/dienst/aufgabe_anlegen.rs:132`: `let (vorhanden, _) = …`); `schon_da` und `Schluesseltreffer::suchen` sehen nur die lesbaren Aufgaben (`:268–283`, `src/modell/aufgabe.rs:206–215`). Dasselbe gilt für `dubletten` (`src/dienst/mod.rs:155–163`, `doppelte_schluessel` in `src/modell/aufgabe.rs:179–192`) und den Filter `?key=` (`src/dienst/aufgabenfilter.rs:80`).
- **Die neue Nummer zählt die defekte Datei mit** (`naechste_nummer`, `src/ablage.rs:138–141`): das Anlegen scheitert also nicht, es legt eine zweite Datei mit demselben Schlüssel an.
- **Die Klasse ist breiter als die Karte sagt.** Defekt wird eine Aufgabendatei aus jedem Grund: Merge-Konfliktmarker (`src/format/frontmatter.rs:6–8`), formwidrige Kosten (ADR-0009), formwidrige Schätzung (ADR-0023), `wbs-effects`, `phases`, doppelte Nummer. In all diesen Fällen steht der Schlüssel **unverändert und gültig** in der Datei, und der nächste Lauf des Sensors mit demselben Schlüssel (R00099) legt eine Dublette an. Das ist der häufigere Weg; die Vision nennt die Konfliktmarker selbst als den Fall der defekten Datei (`Anforderungen/R00000-vision.md:88–91`).
- **Der wörtliche Fall der Karte ist enger, als er aussieht.** Ein von Hand verdorbener Schlüssel (geleert, über 200 Zeichen) ist nicht mehr der Schlüssel, den der Sensor schickt; kein Vergleich findet ihn wieder. Wiederfindbar ist nur, was beim Lesen als YAML die Form verliert, als Text aber gleich bleibt — z. B. `key: [a, b]` nach dem Entfernen der Anführungszeichen, die `yaml::skalar` beim Schreiben setzt (`src/format/yaml.rs:10–19`).
- **Lücke**: nicht mit einem Lauf nachgestellt (Tagbetrieb, kein Build); die Kette ist am Code gelesen. Die Abnahme-Probe unten ist der Nachweis und heute rot.

### Varianten

| | Variante | Stärke | Schwäche |
|---|---|---|---|
| V1 | **Dreiwertig lesen, im Zweifel abweisen**: je defekter Datei den Schlüssel nachsichtig lesen — *keiner*, *lesbar*, *nicht bestimmbar*; Anlegen mit Schlüssel wird mit 423 abgewiesen, wenn eine defekte Datei ihn trägt oder ihr Schlüssel nicht bestimmbar ist | keine Dublette in beiden Klassen; dieselbe Begründung wie ADR-0003 N2 („der defekte Ordner macht jede Aussage unsicher“) | eine Datei mit verdorbenem Schlüssel hält **jedes** Anlegen mit Schlüssel an, bis ein Mensch sie repariert |
| V2 | **Nur lesbare Rohschlüssel vergleichen**: wie V1, aber *nicht bestimmbar* lässt durch | deckt die breite Klasse; ein einzelner Tippfehler hält keinen Sensor an | der wörtliche Fall der Karte bleibt offen: die Dublette entsteht weiter, wenn der Schlüssel seine Form verloren hat |
| V3 | **Ungültigen Schlüssel nicht mehr als defekt werten**: Feld verwerfen, warnen, Karte bleibt schreibbar | die Karte bleibt bedienbar | verhindert die Dublette nicht (die Karte gilt als schlüssellos); der nächste Schreibvorgang löscht den handgeschriebenen Wert still oder braucht einen zweiten Zustand „roh aufbewahrt“; bricht „eine Prüfung für Datei und API“ (ADR-0009, ADR-0023); die breite Klasse bleibt unberührt |
| V4 | **Defekte Dateien als Treffer behandeln** (200 `neu: false` mit der Nummer aus dem Dateinamen, in `dubletten` und `?key=` aufführen) | der Sensor merkt nichts, kein Stillstand | behauptet eine Lage, die kanbanD nicht kennt (archiviert? Nummer?); das Wiederöffnen nach R00099 fiele still aus; `Dublette` und `?key=` tragen Aufgaben mit Nummer, eine defekte Datei hat nicht immer eine |
| V5 | **Nichts ändern**: nach der Reparatur melden `dubletten` und die 409 die Doppelte | kein Aufwand, kein neues Verhalten | die Dublette entsteht erst und muss von Hand zusammengeführt werden; bis zur Reparatur meldet nichts den Zusammenhang |

### Entschieden

1. **Der Schlüssel einer defekten Aufgabendatei wird nachsichtig gelesen — drei Werte.** Eine reine Funktion im [Format](../Architektur/A00005-format.md) liefert je Dateitext *keiner* (sicher kein `key`), *lesbar* (ein oder mehrere Texte, die `Fremdschluessel::pruefen` annimmt — mehrere bei Konfliktmarkern mit zwei Seiten) oder *nicht bestimmbar* (ein `key` steht da, ist aber kein gültiger einzeiliger Text: leer, Liste, Zuordnung, `null`, mehrzeilig, über 200 Zeichen, Anführungszeichen mit Fluchtzeichen ohne lesbares YAML). Lässt sich das Frontmatter als YAML lesen, entscheidet der Wert; sonst die Zeilen `key:` am Zeilenanfang bis zum Ende des Frontmatters. **Im Zweifel *nicht bestimmbar*, nie *keiner*.** Eine Datei mit doppelter Nummer trägt ihren streng gelesenen Schlüssel.
2. **Lesbar und gleich → 423.** Trägt eine defekte Datei den angefragten Schlüssel, weist `POST /api/aufgaben` (und `…/mehrere` als Ganzes) mit `Fehler::Defekt` ab: die Meldung nennt die Datei und ihren Grund in der Form „`aufgaben/<datei>: <Grund> — nur lesbar, bis die Datei repariert ist`“ (wie `src/dienst/zugregeln.rs:109`), ergänzt um den Schlüssel. Keine Datei, kein Commit, kein Wiederöffnen. kanbanD antwortet **nicht** mit `200` auf die defekte Datei: ob sie offen oder archiviert ist, weiß es nicht.
3. **Nicht bestimmbar → 423 für jedes Anlegen mit Schlüssel** (V1). Begründung wie ADR-0003 N2 Punkt 2: solange der Schlüssel einer Datei nicht bestimmbar ist, ist die Aussage „keine Karte trägt diesen Schlüssel“ unsicher; 423 sagt „ich kann es nicht sagen“. *Empfehlung, vom product-owner zu bestätigen — bis dahin gilt für diesen Punkt V2 als Rückfallebene.*
4. **Ort und Reihenfolge.** Die Prüfung liegt in `anlegen_gesperrt` unter derselben Sperre und auf demselben Lesen wie die Suche (`src/dienst/aufgabe_anlegen.rs:132` behält die zweite Liste, statt sie zu verwerfen) — kein zweites Lesen, kein Index, kein neuer Zustand; die defekte Datei trägt ihren Rohschlüssel nur im Speicher. Reihenfolge nach ADR-0003 N2: **400** (Schlüssel der Anfrage ungültig) → **423** (defekte Datei) → **409** (mehrfach vergeben, Grenze). Trägt eine lesbare Karte den Schlüssel **und** eine defekte Datei, gilt 423.
5. **Wen es trifft.** Jede Anfrage mit `key`, Mensch wie Agent — es ist keine Sperre, sondern Unwissen. Anlegen ohne `key` und `aufgabe_duplizieren` (Schlüssel bleibt leer, `:243–248`) bleiben unberührt.
6. **`dubletten` und `?key=` bleiben Listen lesbarer Karten.** Die defekte Datei steht mit Grund unter `defekte` in `GET /api/zustand`; nach der Reparatur greifen `dubletten` und die 409 wie bisher. Kein neues Feld in der API.
7. **Die strenge Prüfung beim Lesen bleibt** (V3 verworfen): ein formwidriger `key` macht die Datei weiter defekt, wie Kosten und Schätzung.

**Verworfen**: V3 (löst die Dublette nicht und verliert Handgeschriebenes), V4 (antwortet mit einer Lage, die nicht bekannt ist — das Gegenteil von ADR-0003 N2), V5 (lässt die Doppelte entstehen; der Nutzer räumt von Hand auf).

**In Kauf genommen**:
- Eine defekte Datei hält Sensoren an (bei Punkt 2 nur den mit diesem Schlüssel, bei Punkt 3 alle), bis ein Mensch sie repariert; die Wiederkehr eines Befunds (R00099) wartet so lange.
- Unlesbares Frontmatter **ohne** eine Zeile `key:` am Zeilenanfang gilt als *keiner* — sonst hielte jeder Merge-Konflikt in irgendeiner Aufgabe alle Sensoren an. Ein Schlüssel in Flussschreibweise (`{id: 7, key: k1}`) in einer zugleich unlesbaren Datei bleibt unentdeckt.
- Die Zeilensuche kann zu viel finden (eine Textzeile `key: …` am Zeilenanfang einer Datei ohne schließendes `---`). Folge ist eine 423 mit Verweis auf eine Datei, die ohnehin repariert werden muss.
- Ein Schlüssel, den ein Mensch zu einem **anderen gültigen oder nicht wiederherstellbaren** Wert geändert hat, ist nicht wiederzufinden; unter Punkt 3 wird er wenigstens angehalten, wenn er ungültig ist.

### Durchsetzung (Probe)

- **Unit, Format** (erster Test, keine Provider): Tabelle Dateitext → Rohschlüssel. `key: k1` mit `estimate: abc` → *lesbar* `k1`; ohne `key` mit `estimate: abc` → *keiner*; `key: ""`, `key: [a, b]`, `key:` ohne Wert, 201 Zeichen → *nicht bestimmbar*; Konfliktmarker mit `key: k1` auf der einen und `key: k2` auf der anderen Seite → *lesbar* `k1`, `k2`; Konfliktmarker ohne `key` → *keiner*.
- **Gleichlauf nachsichtig/streng**: für jede Datei, die `lesen` annimmt, liefert das nachsichtige Lesen denselben Schlüssel (alle Fälle aus `schluessel_im_rundlauf`, `src/format/aufgabe.rs:511–516`) — sonst driften zwei Leser auseinander.
- **Integration, Abnahme-Probe der Karte** (Muster `tests/fremdschluessel.rs:130–153`): von Hand angelegt und committet `aufgaben/0007-fund.md` mit `key: k1` und `estimate: abc`. `POST /api/aufgaben {titel, key: "k1"}` → **423**, Meldung nennt `aufgaben/0007-fund.md`, HEAD unverändert, keine neue Datei. Heute: 201 mit `aufgaben/0008-…` und `key: k1` (rot). Varianten: Konfliktmarker statt `estimate`; doppelte Nummer; `…/mehrere` mit `k9` und `k1` → ganze Anfrage 423; `key: "k2"` → 201; ohne `key` → 201. Punkt 3: Datei mit `key: ""` → `POST` mit beliebigem gültigem Schlüssel 423 (bzw. 201, falls der product-owner V2 wählt), ohne `key` 201.
- **Reihenfolge**: defekte Datei mit `k1`, Anfrage mit `key: ""` → 400; lesbare #8 mit `k1` und defekte Datei mit `k1` → 423, nicht 200.
- **Mutanten**: zweite Liste wieder verworfen → Abnahme-Probe rot; *nicht bestimmbar* als *keiner* gewertet → Probe zu Punkt 3 rot; 409 vor 423 → Reihenfolge-Probe rot.
- **Sperre**: die bestehende deterministische Probe (`src/dienst/aufgabe_anlegen.rs:309–345`) bleibt grün; die Prüfung nutzt dasselbe Lesen, es entsteht keine zweite Lücke zwischen Prüfen und Handeln.
- **Review-Punkt für `architektur-reviewer` und `code-reviewer`**: ein Weg, der mit Schlüssel anlegt und die Liste der defekten Aufgaben verwirft, ist ein Befund; ebenso ein zweiter nachsichtiger Leser neben dem einen im Format.

### Grenze

- **Kein Formatwechsel**: der Board-Ordner und die Aufgabendatei bleiben, wie sie sind; kanbanD schreibt eine defekte Datei nie und repariert nichts.
- **API**: ein neuer Anlass für die bestehende 423 mit Rumpf `{fehler}` (ADR-0003) an `POST /api/aufgaben` und `…/mehrere`; die Beschreibung in `/api`, `/api/endpunkte` und OpenAPI nennt ihn. Kein neuer Code, kein neues Feld.
- **Kosten**: kein zusätzliches Dateilesen — der Rohschlüssel fällt im selben Durchgang an, nur für defekte Dateien; die O(n)-Aussage oben gilt unverändert.
- **Oberfläche**: sendet keinen `key` (`web/app.js`, Projekt-Gelerntes #138) und ist nicht betroffen; die Anzeige defekter Dateien bleibt.
- **Der Bau ist nicht Teil des Nachtrags**; Anforderung und WBS-Knoten folgen über den planer (eigene Interaction mit eigener Anforderung, R00098 bleibt abgenommen).

### Offen

- **Frage an den product-owner (Punkt 3)**: Soll eine Aufgabendatei, deren Schlüssel nicht bestimmbar ist, **jedes** Anlegen mit Schlüssel anhalten (V1, Empfehlung — keine Dublette, dieselbe Linie wie „423 vor 403 vor 409“; Preis: alle Sensoren dieses Ordners stehen, bis die Datei repariert ist), oder nur gemeldet bleiben wie heute (V2 — Sensoren laufen weiter; Preis: im wörtlichen Fall der Karte kann die Dublette weiter entstehen)? Dazu der Wortlaut der beiden 423-Meldungen.

## Quellen / Bezuege

- `src/dienst/aufgabe_anlegen.rs:66–80`, `src/ablage.rs:75` (`aufgaben`), `:113` (`naechste_nummer`)
- Nachtrag N1 (2026-11-15, Stand `karte/44`): `src/format/aufgabe.rs:54–57`, `:522–525`; `src/modell/aufgabe.rs:157–164`, `:179–192`, `:206–215`; `src/ablage.rs:83–95`, `:138–141`; `src/dienst/aufgabe_anlegen.rs:130–132`, `:268–283`; `src/dienst/mod.rs:155–163`; `src/dienst/aufgabenfilter.rs:80`; `src/format/frontmatter.rs:6–8`; `src/format/yaml.rs:10–19`, `:99–106`; `src/dienst/zugregeln.rs:109`; ADR-0003 Nachtrag N2; R00098 Zeilen 36, 40, 87; R00099
