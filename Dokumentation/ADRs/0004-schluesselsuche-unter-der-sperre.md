# ADR-0004: Schlüsselsuche unter der Sperre durch Lesen des Ordners, ohne Index

**Status**: Akzeptiert
**Datum**: 2026-10-31
**Entscheider**: architekt (Software-Factory)
**Kontext-Anforderung**: R00098 (genutzt von R00099)
**Erprobt durch**: —
**Nachträge**: 2026-11-15 — die Schlüsselsuche sieht auch defekte Aufgabendateien: trägt eine defekte Datei lesbar den angefragten Schlüssel → **423** statt einer zweiten Karte; ein `key`, der kein gültiger einzeiliger Text ist, gilt als kein Schlüssel (Karte #44, **Akzeptiert**, schmale Fassung V2 nach Entscheidung des product-owner vom 2026-11-15), siehe [Nachtrag N1](#nachtrag-2026-11-15-n1-die-schlüsselsuche-sieht-auch-defekte-dateien-karte-44). Der Text oberhalb der Nachträge ist der Stand der Annahme und bleibt unverändert.

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

**Status des Nachtrags: Akzeptiert** (2026-11-15) — Entwurf: Claude (autonom, architekt, Auftrag Director Karte #44); Entscheider: product-owner nach Beratung durch den realist-consultant (`AI-Team/po-entscheidungen.md`, Zeilen zu #44 vom 2026-11-15, Fragen 1–4). Gebaut wird schmal (V2); die Empfehlung des architekt (V1, dreiwertig) ist verworfen. Die Punkte sind durch Code und bestehende Systemantwort getragen. Der Status von ADR-0004 bleibt `Akzeptiert`; Option A (Lesen des Ordners unter der Sperre) bleibt gewählt. Der Nachtrag löst die Zusage „immer der Stand auf der Platte“ für die Dateien ein, die das Lesen heute verwirft und deren Schlüssel lesbar geblieben ist.

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
| V1 | **Dreiwertig lesen, im Zweifel abweisen**: je defekter Datei den Schlüssel nachsichtig lesen — *keiner*, *lesbar*, *nicht bestimmbar*; Anlegen mit Schlüssel wird mit 423 abgewiesen, wenn eine defekte Datei ihn trägt oder ihr Schlüssel nicht bestimmbar ist | keine Dublette in beiden Klassen; dieselbe Begründung wie ADR-0003 N2 („der defekte Ordner macht jede Aussage unsicher“) | eine Datei mit verdorbenem Schlüssel hält **jedes** Anlegen mit Schlüssel an, bis ein Mensch sie repariert — ein Tippfehler in einer Datei ließe alle Sensoren des Ordners stehen |
| V2 | **Nur lesbare Schlüssel vergleichen** (zweiwertig: *keiner*, *lesbar*): 423 nur, wenn eine defekte Datei den angefragten Schlüssel lesbar trägt; ein `key`, der kein gültiger einzeiliger Text ist, gilt als kein Schlüssel | deckt die breite Klasse; ein einzelner Tippfehler hält keinen Sensor an; das Einfachere, das sich später erweitern lässt | der wörtliche Fall der Karte bleibt offen: die Zweitkarte entsteht weiter, wenn der Schlüssel seine Form oder seinen Wert verloren hat |
| V3 | **Ungültigen Schlüssel nicht mehr als defekt werten**: Feld verwerfen, warnen, Karte bleibt schreibbar | die Karte bleibt bedienbar | verhindert die Dublette nicht (die Karte gilt als schlüssellos); der nächste Schreibvorgang löscht den handgeschriebenen Wert still oder braucht einen zweiten Zustand „roh aufbewahrt“; bricht „eine Prüfung für Datei und API“ (ADR-0009, ADR-0023); die breite Klasse bleibt unberührt |
| V4 | **Defekte Dateien als Treffer behandeln** (200 `neu: false` mit der Nummer aus dem Dateinamen, in `dubletten` und `?key=` aufführen) | der Sensor merkt nichts, kein Stillstand | behauptet eine Lage, die kanbanD nicht kennt (archiviert? Nummer?); das Wiederöffnen nach R00099 fiele still aus; `Dublette` und `?key=` tragen Aufgaben mit Nummer, eine defekte Datei hat nicht immer eine |
| V5 | **Nichts ändern**: nach der Reparatur melden `dubletten` und die 409 die Doppelte | kein Aufwand, kein neues Verhalten | die Dublette entsteht erst und muss von Hand zusammengeführt werden; bis zur Reparatur meldet nichts den Zusammenhang |

### Entschieden

**Gewählt: V2** (product-owner 2026-11-15, einig mit dem realist-consultant, abweichend von der Empfehlung des architekt).

1. **Der Schlüssel einer defekten Aufgabendatei wird nachsichtig gelesen — zwei Werte.** Eine reine Funktion im [Format](../Architektur/A00005-format.md) liefert je Dateitext *keiner* oder *lesbar* (ein oder mehrere Texte, die `Fremdschluessel::pruefen` annimmt — mehrere bei Konfliktmarkern mit zwei Seiten). **Ein `key`, der kein gültiger einzeiliger Text ist, gilt als kein Schlüssel** (leer, Liste, Zuordnung, `null`, mehrzeilig, über 200 Zeichen, Anführungszeichen mit Fluchtzeichen ohne lesbares YAML) und hält nichts an. Lässt sich das Frontmatter als YAML lesen, entscheidet der Wert; sonst die Zeilen `key:` am Zeilenanfang bis zum Ende des Frontmatters. Eine Datei mit doppelter Nummer trägt ihren streng gelesenen Schlüssel.
2. **Lesbar und gleich → 423.** Trägt eine defekte Datei den angefragten Schlüssel, weist `POST /api/aufgaben` (und `…/mehrere` als Ganzes) mit `Fehler::Defekt` ab. Wortlaut der Meldung: „`aufgaben/<datei>: <Grund> — nur lesbar, bis die Datei repariert ist; sie trägt den Schlüssel „<key>“, angelegt wurde nichts`“ — der bestehende Satz für defekte Dateien (`src/dienst/zugregeln.rs:109`) unverändert, ergänzt um Schlüssel und Folge. Bei mehreren Treffern nennt die Meldung die erste defekte Datei in der Reihenfolge des Lesens. Keine Datei, kein Commit, kein Wiederöffnen. kanbanD antwortet **nicht** mit `200` auf die defekte Datei: ob sie offen oder archiviert ist, weiß es nicht.
3. *(entfällt — product-owner 2026-11-15. Die Nummern 4–7 bleiben stehen, weil Entscheidung und Planung auf sie verweisen.)*
4. **Ort und Reihenfolge.** Die Prüfung liegt in `anlegen_gesperrt` unter derselben Sperre und auf demselben Lesen wie die Suche (`src/dienst/aufgabe_anlegen.rs:132` behält die zweite Liste, statt sie zu verwerfen) — kein zweites Lesen, kein Index, kein neuer Zustand; die defekte Datei trägt ihren Rohschlüssel nur im Speicher. Reihenfolge nach ADR-0003 N2: **400** (Schlüssel der Anfrage ungültig) → **423** (defekte Datei) → **409** (mehrfach vergeben, Grenze). Trägt eine lesbare Karte den Schlüssel **und** eine defekte Datei, gilt 423.
5. **Wen es trifft.** Jede Anfrage mit `key`, Mensch wie Agent — es ist keine Sperre, sondern Unwissen. Anlegen ohne `key` und `aufgabe_duplizieren` (Schlüssel bleibt leer, `:243–248`) bleiben unberührt.
6. **`dubletten` und `?key=` bleiben Listen lesbarer Karten.** Die defekte Datei steht mit Grund unter `defekte` in `GET /api/zustand`; nach der Reparatur greifen `dubletten` und die 409 wie bisher. Kein neues Feld in der API.
7. **Die strenge Prüfung beim Lesen bleibt** (V3 verworfen): ein formwidriger `key` macht die Datei weiter defekt, wie Kosten und Schätzung.

**Verworfen**: V1 (ein Tippfehler in einer Datei hielte alle Sensoren des Ordners an; ohne den dritten Wert ist der Schaden auf höchstens eine Zweitkarte je Schlüssel begrenzt und wird nach der Reparatur über 409 und `dubletten` gemeldet), V3 (löst die Dublette nicht und verliert Handgeschriebenes), V4 (antwortet mit einer Lage, die nicht bekannt ist — das Gegenteil von ADR-0003 N2), V5 (lässt die Doppelte entstehen; der Nutzer räumt von Hand auf).

**In Kauf genommen**:
- Eine defekte Datei hält den Sensor an, der ihren Schlüssel schickt, bis ein Mensch sie repariert; die Wiederkehr dieses Befunds (R00099) wartet so lange. Alle anderen Schlüssel und das Anlegen ohne `key` laufen weiter.
- **Verliert der Schlüssel in der defekten Datei Form oder Wert, entsteht wie heute eine Zweitkarte** (genau eine je Schlüssel); nach der Reparatur melden sie `dubletten` und die 409.
- Unlesbares Frontmatter **ohne** eine Zeile `key:` am Zeilenanfang gilt als *keiner*. Ein Schlüssel in Flussschreibweise (`{id: 7, key: k1}`) in einer zugleich unlesbaren Datei bleibt unentdeckt.
- Die Zeilensuche kann zu viel finden (eine Textzeile `key: …` am Zeilenanfang einer Datei ohne schließendes `---`). Folge ist eine 423 mit Verweis auf eine Datei, die ohnehin repariert werden muss.
- Ein Schlüssel, den ein Mensch zu einem **anderen gültigen** Wert geändert hat, ist nicht wiederzufinden — er ist nicht mehr der Schlüssel, den der Sensor schickt.

### Durchsetzung (Probe)

- **Unit, Format** (erster Test, keine Provider): Tabelle Dateitext → Rohschlüssel. `key: k1` mit `estimate: abc` → *lesbar* `k1`; ohne `key` mit `estimate: abc` → *keiner*; `key: ""`, `key: [a, b]`, `key:` ohne Wert, 201 Zeichen → *keiner*; Konfliktmarker mit `key: k1` auf der einen und `key: k2` auf der anderen Seite → *lesbar* `k1`, `k2`; Konfliktmarker ohne `key` → *keiner*.
- **Gleichlauf nachsichtig/streng**: für jede Datei, die `lesen` annimmt, liefert das nachsichtige Lesen denselben Schlüssel (alle Fälle aus `schluessel_im_rundlauf`, `src/format/aufgabe.rs:511–516`) — sonst driften zwei Leser auseinander.
- **Integration, Abnahme-Probe der Karte** (Muster `tests/fremdschluessel.rs:130–153`): von Hand angelegt und committet `aufgaben/0007-fund.md` mit `key: k1` und `estimate: abc`. `POST /api/aufgaben {titel, key: "k1"}` → **423**, Meldung nennt `aufgaben/0007-fund.md`, den Grund und den Schlüssel `k1`, HEAD unverändert, keine neue Datei. Heute: 201 mit `aufgaben/0008-…` und `key: k1` (rot). Varianten: Konfliktmarker statt `estimate`; doppelte Nummer; `…/mehrere` mit `k9` und `k1` → ganze Anfrage 423; `key: "k2"` → 201; ohne `key` → 201. Grenze der schmalen Fassung: defekte Datei mit `key: ""` oder `key: [a, b]` → `POST` mit beliebigem gültigem Schlüssel **201**.
- **Reihenfolge**: defekte Datei mit `k1`, Anfrage mit `key: ""` → 400; lesbare #8 mit `k1` und defekte Datei mit `k1` → 423, nicht 200 und nicht 409.
- **Mutanten**: zweite Liste wieder verworfen → Abnahme-Probe rot; 409 vor 423 → Reihenfolge-Probe rot.
- **Sperre**: die bestehende deterministische Probe (`src/dienst/aufgabe_anlegen.rs:309–345`) bleibt grün; die Prüfung nutzt dasselbe Lesen, es entsteht keine zweite Lücke zwischen Prüfen und Handeln.
- **Review-Punkt für `architektur-reviewer` und `code-reviewer`**: ein Weg, der mit Schlüssel anlegt und die Liste der defekten Aufgaben verwirft, ist ein Befund; ebenso ein zweiter nachsichtiger Leser neben dem einen im Format.

### Grenze

- **Kein Formatwechsel**: der Board-Ordner und die Aufgabendatei bleiben, wie sie sind; kanbanD schreibt eine defekte Datei nie und repariert nichts.
- **API**: ein neuer Anlass für die bestehende 423 mit Rumpf `{fehler}` (ADR-0003) an `POST /api/aufgaben` und `…/mehrere`; die Beschreibung in `/api`, `/api/endpunkte` und OpenAPI nennt ihn. Kein neuer Code, kein neues Feld.
- **Kosten**: kein zusätzliches Dateilesen — der Rohschlüssel fällt im selben Durchgang an, nur für defekte Dateien; die O(n)-Aussage oben gilt unverändert.
- **Oberfläche**: sendet keinen `key` (`web/app.js`, Projekt-Gelerntes #138) und ist nicht betroffen; die Anzeige defekter Dateien bleibt.
- **`erledigen` bleibt unberührt**: `POST /api/aufgaben/erledigen` verwirft die Liste der defekten Dateien ebenfalls (`src/dienst/erledigen.rs:90`) und antwortet bei einem Schlüssel, den nur eine defekte Datei trägt, mit 404, ohne zu schreiben — keine zweite Karte, kein Datenverlust; der Nachtrag ändert daran nichts (product-owner 2026-11-15, Frage 4).
- **Der Bau ist nicht Teil des Nachtrags**; Anforderung und WBS-Knoten folgen über den planer (eigene Interaction mit eigener Anforderung, R00098 bleibt abgenommen).

## Quellen / Bezuege

- `src/dienst/aufgabe_anlegen.rs:66–80`, `src/ablage.rs:75` (`aufgaben`), `:113` (`naechste_nummer`)
- Nachtrag N1 (2026-11-15, Stand `karte/44`): `src/format/aufgabe.rs:54–57`, `:522–525`; `src/modell/aufgabe.rs:157–164`, `:179–192`, `:206–215`; `src/ablage.rs:83–95`, `:138–141`; `src/dienst/aufgabe_anlegen.rs:130–132`, `:268–283`; `src/dienst/mod.rs:155–163`; `src/dienst/aufgabenfilter.rs:80`; `src/format/frontmatter.rs:6–8`; `src/format/yaml.rs:10–19`, `:99–106`; `src/dienst/zugregeln.rs:109`; `src/dienst/erledigen.rs:88–95`; ADR-0003 Nachtrag N2; R00098 Zeilen 36, 40, 87; R00099; Entscheidung des product-owner vom 2026-11-15 zu #44 (`AI-Team/po-entscheidungen.md`, Fragen 1–4: schmal bauen, Wortlaut der 423, Nachtrag anpassen, `erledigen` außerhalb)
