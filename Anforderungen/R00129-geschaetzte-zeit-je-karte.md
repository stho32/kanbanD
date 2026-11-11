---
id: R00129
status: Neu
datum: 2026-11-11
---

# R00129: Geschätzte Zeit je Karte (rein informativ)

## Beschreibung

Jede Aufgabe kann optional eine **geschätzte Zeit** tragen: die Dauer, die ein Mensch oder ein KI-Werkzeug für sie veranschlagt. Sie steht als Frontmatter-Schlüssel `estimate` in der Aufgabendatei, als ganze Minuten (`estimate: 150` heißt 2 h 30 min). Die Oberfläche blendet sie **nur ein, wenn sie gesetzt ist** — auf der Karte als `h:mm` und im Aufgabenfenster als Feldzeile „Geschätzt“. Geschrieben wird der Wert in dieser Ausbaustufe **nur über die API**; die Oberfläche liest ihn nur. Der Wert ist **rein informativ**: keine Auswertung, keine Prognose und keine Warnung rechnet damit (Karte #37, Auftraggeber-Entscheidung 2026-11-03, `AI-Team/po-entscheidungen.md:61`).

Zahlt ein auf: [Vision](R00000-vision.md) — „Auswertungen rechnen aus dem, was geschehen ist“ (der Wert wird gespeichert und angezeigt, nie ausgewertet) und „Mensch und Agent arbeiten gleichberechtigt“ (Agenten setzen die Schätzung über dieselbe Tür wie alles andere).

**Bewusst außerhalb** (ADR-0023): Story Points (PO Z. 61); jede Auswertung des Wertes (kein Bericht, keine Prognose, keine Warnung, keine Summe, keine Gegenüberstellung „geschätzt gegen gebucht“); eine Spanne statt eines Wertes; ein Eingabefeld in der Oberfläche (die erste Ausbaustufe setzt über die API, wie `cost`).

### Domänenbezug
- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md)
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md)

## Geschäftlicher Nutzen

Ein KI-Werkzeug oder ein Mensch veranschlagt für eine Aufgabe eine Dauer — heute steht sie nirgends am Werkstück; die Karte zeigt nur die **gebuchte** Zeit (`Σ`, R00089). Mit einem optionalen Feld „geschätzte Zeit“ sieht der Betreiber auf der Karte und im Aufgabenfenster, was veranschlagt war, ohne eine zweite Liste zu führen, und Agenten können ihre Schätzung über dieselbe Tür vermerken, über die sie sonst schreiben. Der Wert bleibt rein informativ: er wird gespeichert und angezeigt, mehr nicht — damit bleibt die Leitplanke „Auswertungen rechnen aus dem, was geschehen ist“ gewahrt, und es entsteht kein Projektmanagement-Werkzeug (R00000:183, PO Z. 61).

## Funktionale Anforderungen

### Form in der Datei (ADR-0023)
- Ein Schlüssel `estimate` im Frontmatter der Aufgabe trägt die geschätzte Zeit als **ganze Zahl von Minuten** ohne Einheit und ohne Anführungszeichen: `estimate: 150` heißt 2 h 30 min. `estimate` ist die kanonische Repräsentation; es gibt keinen zweiten Schlüssel und keine abgeleitete Angabe daneben.
- Der Wert ist entweder gar nicht gesetzt oder **positiv**: ganze Zahl ≥ 1 und ≤ 100.000. `0` gibt es nicht; „nicht gesetzt“ ist das **Fehlen** des Schlüssels (PO Z. 61: nur eingeblendet, wenn gesetzt).
- `2.5`, `"150"`, `150.0`, `0`, `-1`, `.inf`, `.nan` und `2:30` sind keine gültigen Werte.

### Setzen und lesen (Tür)
- **Kein eigener Endpunkt**: `PATCH /api/aufgaben/{nr}` und `PATCH /api/aufgaben/mehrere` bekommen das Feld `estimate`. Ein Wert ersetzt den Wert, `null` entfernt ihn, ein fehlendes Feld lässt ihn unverändert.
- Jede Änderung ist ein Commit „#n geändert: Geschätzte Zeit“; ohne Änderung entsteht kein Commit.
- `GET` liefert `estimate` als **JSON-Zahl**; die OpenAPI beschreibt das Feld in derselben `Aufgabenaenderung` wie `cost`, samt 400.
- Die `estimate` kommt in `BEKANNT` (`src/format/aufgabe.rs`) und in die Schreibreihenfolge, damit der Wert nicht mehr als unbekannter Schlüssel durch `weitere` läuft.

### Fehlerwege
- **Datei und API rufen dieselbe Prüfung.** Ein ungültiger Wert in der Datei macht die Aufgabe **defekt und nur lesbar** (423); die Meldung nennt den Pfad: `estimate: ganze Zahl von Minuten ≥ 1 erwartet`.
- In der API ist **jeder** Fehler im Rumpf `estimate` — auch ein Typfehler — **400** mit derselben Meldung, nie 422 und nie 500; nichts wird geschrieben. Dafür kommt `estimate` wie `cost` als rohes JSON an (`Option<Option<serde_json::Value>>`, entfernbar).

### Anzeige
- Karte und Aufgabenfenster zeigen die geschätzte Zeit als `h:mm` über den vorhandenen Helfer `hm`, **nur wenn** der Wert gesetzt ist. Eine Aufgabe ohne `estimate` bekommt weder auf der Karte noch im Fenster ein Element; ihr Markup ist wie heute.
- Auf der Karte steht die geschätzte Zeit in der unteren Zeile neben der gebuchten Zeit `Σ h:mm` (`.r3`) und ist von ihr unterscheidbar; ihr zugänglicher Name lautet „Geschätzt <h:mm>“. Ort und Form (Zeichen, Label) legt die UX-Vorprüfung fest und der Gestalter zeichnet sie an D0002 (siehe „Gestaltung“).
- Im Aufgabenfenster steht sie als **Feldzeile** mit der Beschriftung „Geschätzt“ und dem Schlüssel `estimate` als Hilfstext in eigenem Element ([ADR-0013](../Dokumentation/ADRs/0013-deutsche-anzeige-an-der-zeichengrenze.md) N1), Wert `h:mm`. Die Zeile ist **nur lesend** (kein Eingabefeld); Ort nach D0003.
- Die Anzeige ist eine Ableitung aus dem gespeicherten Wert und wird **nie gespeichert**.

### Grenzen (rein informativ)
- **Kein Rechnen**: keine Auswertung, kein Bericht, keine Summe, keine Prognose und keine Warnung liest `estimate` (PO Z. 61). Der Wert wird gespeichert und angezeigt, mehr nicht.
- **Bestand**: Eine Aufgabe ohne `estimate` bekommt keine neue Zeile und wird unverändert gelesen und geschrieben. Eine bisher geduldete, formwidrige Angabe (`estimate: 2:30`, `estimate: 0`) gilt nach dieser Anforderung als defekt und wird nicht still verworfen (ADR-0023 Regel 8). Ein von Hand geschriebenes `estimate: 3` gilt als drei Minuten.

## Nicht-funktionale Anforderungen
- **Verträglichkeit**: kein Fehler zu `estimate` antwortet mit 422 oder 500 (wie `cost`, ADR-0009).
- **Barrierefreiheit**: die geschätzte Zeit hängt nicht an der Farbe allein; auf der Karte trägt sie einen zugänglichen Namen „Geschätzt <h:mm>“, im Fenster die Beschriftung „Geschätzt“ samt Schlüssel als Hilfstext.
- **Bestand**: keine vorhandene Aufgabe ändert sich durch das Lesen; heute trägt keine Aufgabendatei `estimate` als bekannten Wert (`estimate` war bis ADR-0023 ein unbekannter Schlüssel, siehe R00004).

## Akzeptanzkriterien

**Grundbestand** (über die API herstellbar): Board „fabrik“ mit den Spalten „Eingang“, „In Arbeit“, „Fertig“ (Abschlussspalte); Aufgabe #1 in „Eingang“ ohne Schätzung, #4 in „Eingang“ ohne Schätzung. Eine von Hand geschriebene Datei wird direkt in den Ordner gelegt.

### Schätzung setzen und lesen
- [ ] Gegeben #1 ohne Schätzung, wenn über die API `estimate: 150` gesetzt wird, dann gibt es genau einen Commit „#1 geändert: Geschätzte Zeit“, die Datei enthält `estimate: 150`, und ein Lesen liefert 150
- [ ] Gegeben #1 mit `estimate: 150`, wenn derselbe Wert noch einmal gesetzt wird, dann bleibt die Zahl der Commits gleich
- [ ] Gegeben #1 mit `estimate: 150`, wenn `estimate: 90` gesetzt wird, dann ersetzt 90 den Wert und die Datei enthält `estimate: 90`
- [ ] Gegeben #1 mit `estimate: 150`, wenn `estimate: null` gesetzt wird, dann fehlt der Schlüssel in der Datei und es gibt genau einen Commit „#1 geändert: Geschätzte Zeit“
- [ ] Gegeben #1 mit `estimate: 150`, wenn nur der Titel geändert wird, dann bleibt `estimate` unverändert
- [ ] Grenzwert: Gegeben #1, wenn `estimate: 1` und danach `estimate: 100000` gesetzt wird, dann je 200, und die Datei enthält beide Male den kürzesten Zahltext
- [ ] Gegeben #1 und #4, wenn `estimate: 30` über das Ändern mehrerer Aufgaben gesetzt wird, dann tragen beide 30 und es gibt je einen Commit
- [ ] Gegeben eine von Hand geschriebene Aufgabe ohne `estimate`, wenn kanbanD den Ordner liest und ihren Titel ändert, dann ist die Datei danach bis auf die Titelzeile byte-gleich (keine neue Zeile für die Schätzung)

### Ungültige Werte und defekte Dateien
- [ ] Fehlfall: Gegeben #1 ohne Schätzung, wenn nacheinander `estimate: 2:30`, `estimate: "150"`, `estimate: 150.0`, `estimate: 2.5`, `estimate: 0`, `estimate: -1`, `estimate: 100001`, `estimate: .inf`, `estimate: .nan` und `estimate: true` gesetzt wird, dann antwortet jeder Aufruf 400 mit „estimate: ganze Zahl von Minuten ≥ 1 erwartet“, die Datei ist byte-gleich und die Zahl der Commits gleich
- [ ] Fehlfall: Gegeben #1 und #4, wenn ein ungültiges `estimate` über das Ändern mehrerer Aufgaben für beide gesetzt wird, dann 400 und keine der beiden Dateien ändert sich
- [ ] Gegeben ein beliebiger Fehlfall dieser Gruppe, wenn er abgewiesen wird, dann ist der Status 400 (nie 422, nie 500), die Datei byte-gleich und die Zahl der Commits gleich
- [ ] Gegeben eine von Hand geschriebene Aufgabe mit `estimate: 2:30`, wenn der Ordner gelesen wird, dann ist die Aufgabe defekt und nur lesbar mit der Meldung „estimate: ganze Zahl von Minuten ≥ 1 erwartet“
- [ ] Gegeben eine von Hand geschriebene Aufgabe mit `estimate: 3`, wenn der Ordner gelesen wird, dann ist sie lesbar und trägt drei Minuten (angezeigt als `0:03`), und beim Schreiben bleibt `estimate: 3` zeichengleich

### Anzeige auf der Karte
- [ ] Gegeben #1 mit `estimate: 150`, wenn das Board angesehen wird, dann zeigt die Karte die geschätzte Zeit „2:30“, ihr zugänglicher Name lautet „Geschätzt 2:30“, und die Datei von #1 ist danach byte-gleich (keine abgeleitete Angabe gespeichert)
- [ ] Gegeben #1 mit `estimate: 5`, wenn das Board angesehen wird, dann zeigt die Karte „0:05“ (fünf Minuten, nicht fünf Stunden)
- [ ] Gegeben #1 mit `estimate: 150` und 46 Minuten gebuchter Zeit, wenn das Board angesehen wird, dann stehen die gebuchte Zeit „Σ 0:46“ und die geschätzte Zeit „2:30“ beide auf der Karte mit je ihrem Wert
- [ ] Leerfall: Gegeben #4 ohne Schätzung, wenn das Board angesehen wird, dann trägt die Karte kein Element für die geschätzte Zeit
- [ ] Gegeben #1 mit `estimate: 150`, wenn 60 s zugesehen wird, dann steigt `kdTest.renders()` ohne Ereignis nicht (kein zweiter Takt für die Anzeige)

### Anzeige im Aufgabenfenster, rein informativ
- [ ] Gegeben #1 mit `estimate: 150`, wenn das Aufgabenfenster geöffnet wird, dann zeigt die Feldzeile die Beschriftung „Geschätzt“ und im eigenen Element den Schlüssel `estimate` und den Wert „2:30“, und es gibt kein Eingabefeld; Datei und Zahl der Commits bleiben gleich
- [ ] Leerfall: Gegeben #4 ohne Schätzung, wenn das Aufgabenfenster geöffnet wird, dann fehlt die Feldzeile „Geschätzt“ ganz
- [ ] Gegenbeispiel: Gegeben #1 mit `estimate: 150`, wenn nacheinander Burndown, „Wie lange noch“, „Kosten“ und „Zeiten nach Aufgabe und Person“ geöffnet werden, dann nennt keiner dieser Berichte die geschätzte Zeit, und Board- und Aufgabendatei sind danach byte-gleich

## Betroffene Verzeichnisstruktur
- Server: Modell und Prüfung in `src/modell/aufgabe.rs` (neben `cost`), Dateiformat in `src/format/aufgabe.rs`, Tür und OpenAPI über die bestehende Aufgabenänderung und `src/web/endpunkte.rs`; Integrationstests unter `tests/`.
- Oberfläche: Darstellung in `web/ansicht.js` (`vKarte` und `vBeschriftung('estimate')`), Beschriftungstabelle `FELDER` in `web/kultur.js`, Aussehen in `web/kd-app.css`; E2E `e2e/tests/r00129-geschaetzte-zeit.spec.js`.

## Technische Überlegungen

Alle Entscheidungen zur Technik stehen in [ADR-0023](../Dokumentation/ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) und werden hier nicht wiederholt. Die Bubbles der WBS (B0607–B0613) sind **Vorplanung**; welche es beim Bauen werden, entscheidet der Entwickler.

### Ablauf
1. **Schätzung setzen, lesen und abweisen** (F0106, frei baubar)
   - 1.1 Geschätzte Minuten prüfen und ins Modell aufnehmen, eine Prüfung für Datei und API (B0607)
   - 1.2 `estimate` in der Aufgabendatei lesen und schreiben, Rundlauf (B0608)
   - 1.3 `estimate` aus der Anfrage umwandeln, ohne serde-Typisierung (B0609)
   - 1.4 PATCH einzeln und `/mehrere`, GET, OpenAPI (B0610)
2. **Anzeigen** (Oberfläche; Artboards D0002 und D0003 durch den product-owner freizugeben)
   - 2.1 Geschätzte Zeit an der Karte zeigen, `h:mm`, nur wenn gesetzt (B0611)
   - 2.2 Feldzeile „Geschätzt“ im Aufgabenfenster, nur lesend (B0612)
   - 2.3 Gegenprobe: nur wenn gesetzt, kein abgeleiteter Wert, keine Auswertung (B0613)

### Grobentwurf

**Wichtige Einstiegsstellen:** `PATCH /api/aufgaben/{nr}` und `PATCH /api/aufgaben/mehrere` (Feld `estimate`, neben `cost`); Kartendarstellung und Feldzeilen des Aufgabenfensters in `web/ansicht.js`.

**Elemente** (Signaturen nach ADR-0023):
- `Aufgabe.geschaetzte_minuten: Option<u32>` — die geprüfte Zahl; `null`/fehlend heißt „keine Schätzung“; im JSON als `estimate`.
- `estimate` in `Aufgabenaenderung` (roh, `Option<Option<serde_json::Value>>`, entfernbar) — geht durch dieselbe Prüfung wie das Frontmatter.
- `geschätzte_minuten_pruefen(wert) -> Result<Option<u32>, String>` (rein) — Datei und API rufen sie; sie liefert den Pfadfehler.
- `hm` (bestehend; Server `src/uhr.rs`, Browser `web/zeiten.js`) — formt den Wert als `h:mm`; es entsteht keine zweite Zeitform.
- `FELDER` (bestehend, `web/kultur.js`) — neuer Eintrag `estimate: 'Geschätzt'` (ADR-0013).

### Gestaltung

Die Anzeige der geschätzten Zeit ist eine **Aussage der Zeichengrenze** (ADR-0013): gespeichert ist eine Zahl in Minuten, sichtbar wird sie erst beim Zeichnen. Die Gestaltung ist ein neuer Zustand und braucht die **UX-Vorprüfung** und ein **Artboard** (der product-owner gibt frei, bevor gebaut wird; B0607–B0610 sind davon frei).

- **Karte (D0002).** Die untere Zeile `.r3 .rechts` trägt bereits Nummer, Preisetikett `≈ 1,10 $` (R00105), gebuchte Zeit `Σ 0:46`, erste Teilaufgabe, Fälligkeit, Herkunft und Zuständige. Empfehlung (Option A): die geschätzte Zeit kompakt wie das Preisetikett mit einem eigenen Zeichen und dem Wert `h:mm` — Vorschlag `≈ 2:30` —, von der gebuchten Zeit durch das Zeichen („Σ 0:46“) und vom Preis durch die Einheit unterscheidbar; der zugängliche Name lautet „Geschätzt 2:30“ (visuell versteckt), das sichtbare Zeichen und der Wert sind `aria-hidden`, kein `aria-label` an einem Element ohne Rolle. Alternativen: (B) das Wort „Geschätzt“ als sichtbares Label vor dem Wert; (C) nur der Wert `h:mm` mit `title`. Der `ux-reviewer` entscheidet und misst (Breite neben `Σ`, `≈` und Labels, 320/375/414 px), der Gestalter zeichnet den Zustand an D0002.
- **Aufgabenfenster (D0003).** Eine Feldzeile mit der Beschriftung „Geschätzt“ und dem Schlüssel `estimate` als zweite Zeile in eigenem Element (ADR-0013 N1), Wert `h:mm`, nur lesend; Lage unter den übrigen Feldern der Seitenleiste. Der Gestalter zeichnet den Zustand an D0003.

Gilt ein Artboard anders als ein Kriterium, gilt das Kriterium (wie R00105). Die Anzeige ist neutral, ohne neue Farbrolle (ADR-0011) und ohne Warnform.

### Änderungen an bestehenden Klassen
- `Aufgabe` (`src/modell/aufgabe.rs`): neues Feld `geschaetzte_minuten` mit `#[serde(rename = "estimate")]`.
- `Aufgabenaenderung`: neues entfernbares Rohfeld `estimate` (wie `cost`).
- `src/format/aufgabe.rs`: `estimate` in `BEKANNT` und in die Schreibreihenfolge; der Test `handgeschriebene_datei_ohne_id_mit_sekunden_und_unbekanntem_schluessel` wählt einen anderen unbekannten Schlüssel, weil `estimate` bekannt wird.
- `web/kultur.js` `FELDER`: Eintrag `estimate: 'Geschätzt'`.
- `web/ansicht.js` `vKarte`: ein Element mehr je Karte; `vBeschriftung('estimate')` als neue Feldzeile.
- OpenAPI/Beschreibung (`src/web/endpunkte.rs`, `src/web/mod.rs`): Feld `estimate` mit Schema und 400.

### Umfang
- F0106: 4 Bubbles, 2,5–5 h; F0107: 3 Bubbles, 1,5–3 h; zusammen 7 Bubbles, 4–8 h. Richtwerte nach dem Muster von F0038/F0039 (R00105), ungemessen (Hypothese). Klein gehalten: der Wert trägt keine Auswertung, und die Anzeige nutzt den vorhandenen `hm`.

## Tests
Nach Skill `test-pyramide`, jede User-Story-Szene wird ein Test.

**Unit (pure Logik):** die Prüffunktion je Regel mit Grenz- und Gegenwert (1, 100.000, 0, -1, 2.5, `"150"`, 150.0, `.inf`, `.nan`, `2:30`); Rundlauf der Minuten 1–100.000 plus Ränder; die Umwandlung des Rohwerts je Fehlfall; die Anzeige-Rechnung `150 → 2:30`, `5 → 0:05` und „ohne Wert kein Feld“.

**Integration:** `PATCH` einzeln und `/mehrere` gegen einen echten Ordner mit Git — Commit-Zahl vorher/nachher, Datei neu gelesen, jeder Fehlfall 400 mit Datei byte-gleich; defekte Datei → nur lesbar.

**E2E:** US-4 und US-5 gegen das laufende Programm auf freiem Port; zugänglicher Name aus sichtbarem und verstecktem Text; Prüfsumme der Aufgabendatei vor und nach dem Ansehen; ein Bericht öffnen und belegen, dass er die geschätzte Zeit nicht nennt.

## Abhängigkeiten
- ADR-0023 (Akzeptiert, `5a740cb`); ADR-0009 (Zuschnitt: kanonisch in der Datei, eine Prüfung für Datei und API, jeder Fehler 400); ADR-0013 (deutsche Anzeige an der Zeichengrenze).
- Abhängig von (grün): I0004 Board ansehen (R00004), I0011 Aufgabe ansehen und bearbeiten (R00011).
- Berührt: **R00004** — dessen Akzeptanzkriterium „Ein unbekannter Schlüssel `estimate: 3` bleibt beim Schreiben erhalten“ (`R00004-board-ansehen.md:35`) verliert seinen Beispielschlüssel, weil `estimate` jetzt bekannt ist (Beispiel tauschen; Anpassung außerhalb dieser Anforderung). **R00127/I0115** (Kartenabschnitte auf Reitern): wandert die Feldzeile mit den übrigen Feldern in einen Reiter „Details“, ordnet sie dort ein, wer zuerst baut.
- Blockiert: —

## Offene Fragen

Keine, die den Bau blockieren. Empfehlungen des planers (Entscheidungen im Bericht); richtungsweisend bleibt die Artboard-Frage (product-owner):

1. **Schlüsselname** `estimate` oder `estimated`? Empfehlung: `estimate` — er läuft heute schon als unbekannter Schlüssel durch die Dateien und die Probe (ADR-0023 Folgeentscheidung). Der product-owner kann den Namen kippen, ohne die Repräsentation zu ändern.
2. **Artboard?** Ja — die Anzeige ist ein neuer Zustand auf Karte und im Fenster. UX-Vorprüfung, Artboards D0002 (Etikett) und D0003 (Feldzeile), Freigabe durch den product-owner vor dem Bau der Oberfläche; die Vorschläge stehen unter „Gestaltung“. F0106 und die Bubbles B0607–B0610 hängen nicht daran.
3. **Setzweg?** In der ersten Ausbaustufe nur über die API (wie `cost`, PO Z. 31); ein Eingabefeld im Fenster ist eine spätere Ausbaustufe (ADR-0023 Folgeentscheidung).
4. **Darf ein Agent `estimate` setzen?** Ja, uneingeschränkt — der Wert ist rein informativ und gerade für die Schätzungen der KI-Werkzeuge gedacht (Karte #37); kein Schutz wie bei der WIP-Grenze.
5. **Obergrenze 100.000?** Technischer Schutz gegen Tippfehler, keine Produktregel; er darf angehoben werden, solange die Rundlauf-Probe grün bleibt (ADR-0023 Regel 2).

## Manuelle Vorbereitungstätigkeiten

Bildschirmfotos für den Abnahmezettel (nach der UX-Vorprüfung): Board mit einer Karte mit geschätzter Zeit (mit und ohne gebuchte Zeit, mit und ohne Preisetikett) und das Aufgabenfenster mit der Feldzeile „Geschätzt“, bei 320, 375, 414 und 1280 px, je hell und dunkel.

## Manuelle Nachbereitungstätigkeiten
- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Entscheidung des Auftraggebers (Karte #37, 2026-11-03): KI-Werkzeuge liefern Schätzungen für eine Aufgabe, und heute gibt es keinen Ort, sie am Werkstück zu vermerken — die Karte zeigt nur, was **gebucht** wurde (`Σ`, R00089). Wenn der Wert als `estimate` in Minuten in der Aufgabendatei steht und die Oberfläche ihn nur einblendet, dann sieht der Betreiber veranschlagte und gebuchte Zeit nebeneinander, und ein Agent kann seine Schätzung über dieselbe Tür schreiben, über die er sonst arbeitet. Weil derselbe Wert in Datei und API durch **eine** Prüfung geht (ADR-0023), stimmen Handschrift, Datei und API überein, und jeder Fehler ist sichtbar (400 in der API, defekte Datei mit Pfad in der Ablage). Der Hebel ist die Aufgabendatei: sie ist der einzige Speicher, und ohne ein Feld hätte eine Anzeige keine Quelle. Bewusst **nicht** gewählt wurde eine Auswertung: der Wert wird gespeichert und angezeigt, mehr nicht — so bleibt die Vision-Leitplanke „Auswertungen rechnen aus dem, was geschehen ist“ gewahrt und kanbanD kein Projektmanagement-Werkzeug (PO Z. 61).

## Missing-Docs
- Das Domänenwissen zu Hauptbereich und Aufgabenfenster nennt die Zeile `.r3` und die Felder der Seitenleiste; nach dem Bau ergänzt der Entwickler dort „geschätzte Zeit“ (`estimate`, nur wenn gesetzt) und ihre Anzeigeform.
- Das Glossar hat keinen Eintrag für „geschätzte Zeit“ (Abgrenzung zu „gebuchte Zeit“/`Σ`). Vorschlag: nach dem Bau ein Eintrag mit `estimate`, der Einheit (Minuten) und der Beziehung zu R00089 und R00105.

## Notizen

**Eigene Interaction unter D0003.** Datenmodell, Tür und Feldzeile hängen am Aufgabenfenster; das Etikett auf dem Board (D0002) ist ein Aspekt derselben Daten — dieselbe Begründung wie bei I0093/R00105 („Preisetikett je Aufgabe auf Karte und im Detail“). Muster: F0038/F0039 (Kosten setzen/anzeigen, I0093).

**Optionen-Tableau (kurz, Skill `optionen-vor-entscheidung`):**
- **A — ganze Minuten in der Datei (`estimate: 150`), eine Prüfung für Datei und API, Anzeige `h:mm`** (gewählt, ADR-0023): eindeutig für jeden YAML- und JSON-Leser, keine neue Grammatik, nutzt den vorhandenen `hm`; gleiche Linie wie `cost` in ganzen Cent.
- **B — Dauertext in der Datei (`estimate: 2:30`)**: ohne Umrechnen lesbar, doch `2:30` liest serde_yaml als Text, PyYAML als 150, Ruby Psych als 9000 — dieselbe Datei bedeutet je Werkzeug etwas anderes; verworfen (ADR-0023 Probe).
- **C — ganze Sekunden (`estimate: 9000`)**: nutzlos fein und schwerer zu lesen; verworfen.
- **D — ISO-8601-Dauer (`PT2H30M`) oder Objekt `{h, m}`**: neue Grammatik bzw. neuer Namensraum für einen rein informativen Wert; verworfen.

**Verworfene Alternativen (Schnitt):**
- **Den Wert in einem Bericht auswerten** („geschätzt gegen gebucht“): widerspricht PO Z. 61 und der Vision; eigene Anforderung erst auf Betreiberwunsch.
- **Ein Eingabefeld im Aufgabenfenster** in derselben Ausbaustufe: die erste Ausbaustufe setzt über die API (wie `cost`); ein Fenster-Setzweg ist eine spätere Ausbaustufe.

**Verwiesenes**
- Karte #37 „Feld „geschätzte Zeit“ je Karte (rein informativ)“ (Herkunft: Entscheidung des Betreibers 2026-11-03 nach Beratung des product-owners; Priorität „nicht superwichtig“).
- [ADR-0023](../Dokumentation/ADRs/0023-geschaetzte-zeit-als-ganze-minuten-eine-pruefung-fuer-datei-und-api.md) (Akzeptiert, `5a740cb`): `estimate` als ganze Minuten, eine Prüfung für Datei und API (jeder Fehler 400), Anzeige `h:mm`, kein Rechnen, Setzweg API-only erste Ausbaustufe.
- `AI-Team/po-entscheidungen.md:61` (Auftraggeber, 2026-11-03), `:31`, `:85`; R00089 (gebuchte Zeit auf der Karte), R00105 (Preisetikett je Aufgabe).
