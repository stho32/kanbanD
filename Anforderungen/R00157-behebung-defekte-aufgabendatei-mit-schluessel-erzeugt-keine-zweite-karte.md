---
id: R00157
status: Neu
datum: 2026-11-15
ursprung: Bug-Report
ursprungslauf: R00098
---

# R00157: Behebung — Defekte Aufgabendatei mit Schlüssel erzeugt eine zweite Karte

## Beschreibung

Trägt eine **defekte** Aufgabendatei einen Schlüssel (`key`), sieht die Schlüsselsuche beim Anlegen sie nicht: `POST /api/aufgaben` und `POST /api/aufgaben/mehrere` mit demselben Schlüssel legen eine **zweite** Datei mit diesem Schlüssel an. Defekt wird eine Aufgabendatei aus jedem Grund — Merge-Konfliktmarker, formwidrige Schätzung oder Kosten, doppelte Nummer —, und in all diesen Fällen steht der Schlüssel unverändert und gültig in der Datei. Der nächste Lauf eines Sensors mit demselben Schlüssel erzeugt die Dublette. R00098 sagt zu, dass Anlegen mit `key` nie zwei Karten ergibt.

Reproduzierbar (am Code gelesen, noch nicht gefahren — die erste Bubble misst es): von Hand angelegt und committet `aufgaben/0007-fund.md` mit `key: k1` und `estimate: abc`; `POST /api/aufgaben` mit `{"titel": "Fund", "key": "k1"}` → heute 201 und eine neue Datei `aufgaben/0008-fund.md` mit `key: k1`. Erwartet: 423, die Meldung nennt Datei, Grund und Schlüssel, keine neue Datei, HEAD unverändert.

Herkunft: Karte #44 (aus dem Code-Review von #4, Sollte, latent — heute trägt keine Aufgabe des Projektboards einen `key`). Entscheidung des product-owner vom 2026-11-15 (`AI-Team/po-entscheidungen.md`, Fragen 1–4 zu #44): bauen, **schmal** — nur der lesbare, gleiche Schlüssel einer defekten Datei hält das Anlegen an. R00098 bleibt abgenommen und unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — „Defekte Dateien bleiben sichtbar … und sind bis zur Reparatur nur lesbar“; die Agenten-Schnittstelle legt je Befund genau eine Karte an.

## Ursachenanalyse

### Root Cause

Belegt am Stand `karte/44` = `main` (`f63202e`) vom 2026-11-15, Einzelheiten in [ADR-0004 Nachtrag N1](../Dokumentation/ADRs/0004-schluesselsuche-unter-der-sperre.md), Abschnitt „Belegt (Code)“:

- `Ordner::aufgaben` legt jede Datei mit Lesefehler und jede mit doppelter Nummer in eine eigene Liste der defekten Dateien (`src/ablage.rs:88`, `:91`).
- `anlegen_gesperrt` verwirft diese Liste (`src/dienst/aufgabe_anlegen.rs:132`: `let (vorhanden, _) = …`); `schon_da` sucht nur in den lesbaren Aufgaben (`:268–283`).
- `naechste_nummer` zählt die defekte Datei mit (`src/ablage.rs:138–141`): das Anlegen scheitert nicht, es legt eine Datei mit der nächsten Nummer und demselben Schlüssel an.
- `format::aufgabe::lesen` prüft `key` streng (`src/format/aufgabe.rs:54–57`, `Fremdschluessel::pruefen` in `src/modell/aufgabe.rs:157–164`); ein formwidriger `key` macht die Datei ebenfalls defekt.

Ausgeschlossen: die Sperre (das Lesen geschieht unter derselben Sperre wie das Anlegen, ADR-0004); die Suche unter lesbaren Karten (200, 409 und Wiederöffnen aus R00098 arbeiten richtig).

**Lücke:** die Kette ist am Code gelesen, nicht mit einem Lauf nachgestellt. Die Abnahme-Probe (AK 1) ist der Nachweis; ihre Antwort vor dem Fix wird gemessen und im Commit genannt.

### Betroffene Komponenten

- `src/format/` — ein nachsichtiger Leser für den Schlüssel einer defekten Datei (A00005 Format).
- `src/ablage.rs` — die defekte Datei trägt ihren Rohschlüssel im Speicher.
- `src/dienst/aufgabe_anlegen.rs` — `anlegen_gesperrt` behält die Liste der defekten Dateien und weist ab (A00004 Dienste).
- `src/web/endpunkte.rs`, `src/web/mod.rs` — die Beschreibung der beiden Endpunkte.
- Tests: neuer Integrationstest neben `tests/fremdschluessel.rs`; Unit im Format.

## Lösungsvorschlag

### Langfristige Lösung

Nach ADR-0004 Nachtrag N1 (Akzeptiert, schmale Fassung V2), Punkte 1, 2 und 4–7:

1. **Zwei Werte.** Eine reine Funktion im Format liefert je Text einer defekten Aufgabendatei *keiner* oder *lesbar* (ein oder mehrere Texte, die `Fremdschluessel::pruefen` annimmt — mehrere bei Konfliktmarkern mit zwei Seiten). Ein `key`, der kein gültiger einzeiliger Text ist (leer, Liste, Zuordnung, `null`, mehrzeilig, über 200 Zeichen), gilt als **kein Schlüssel** und hält nichts an. Lässt sich das Frontmatter als YAML lesen, entscheidet der Wert; sonst die Zeilen `key:` am Zeilenanfang bis zum Ende des Frontmatters. Eine Datei mit doppelter Nummer trägt ihren streng gelesenen Schlüssel.
2. **Lesbar und gleich → 423.** Trägt eine defekte Datei einen Schlüssel der Anfrage, weisen `POST /api/aufgaben` und `POST /api/aufgaben/mehrere` (als Ganzes) mit `Fehler::Defekt` ab. Keine Datei, kein Commit, kein Wiederöffnen.
3. **Ort und Reihenfolge.** Die Prüfung liegt in `anlegen_gesperrt` unter derselben Sperre und auf demselben Lesen wie die Suche; kein zweites Lesen, kein Index, kein neuer Zustand. Reihenfolge: **400** (Schlüssel der Anfrage ungültig) → **423** (defekte Datei trägt den Schlüssel) → **200/409** (Treffer unter lesbaren Karten).
4. **Die strenge Prüfung beim Lesen bleibt**; `dubletten` und `?key=` bleiben Listen lesbarer Karten; kein neues Feld in der API.

### Wortlaut (entschieden, product-owner 2026-11-15)

- **Meldung der 423** (Feld `fehler`): `aufgaben/<datei>: <Grund> — nur lesbar, bis die Datei repariert ist; sie trägt den Schlüssel „<key>“, angelegt wurde nichts`. Der vordere Teil ist der bestehende Satz für defekte Dateien, unverändert (`src/dienst/zugregeln.rs:109`, `src/ablage.rs:134`); angehängt sind Schlüssel und Folge. `<Grund>` ist der Text, den `GET /api/zustand` unter `defekte` für diese Datei als `fehler` nennt. Bei mehreren Treffern nennt die Meldung die erste defekte Datei in der Reihenfolge des Lesens (nach Dateiname).
- **Satz der API-Beschreibung**: „423: Eine defekte Aufgabendatei trägt den Schlüssel der Anfrage; angelegt wird nichts, bis die Datei repariert ist.“

### Alternative Ansätze

Verworfen in ADR-0004 N1 (Varianten V1, V3–V5):

- V1 dreiwertig mit „nicht bestimmbar“ als Sperre: ein Tippfehler in einer Datei hielte alle Sensoren des Ordners an (product-owner 2026-11-15).
- V3 ungültigen Schlüssel nicht mehr als defekt werten: verhindert die Dublette nicht und verliert Handgeschriebenes.
- V4 defekte Datei als Treffer mit 200: antwortet mit einer Lage, die kanbanD nicht kennt.
- V5 nichts ändern: die Dublette entsteht erst und wird von Hand zusammengeführt.

## Test-Strategie

### Unit Test zur Bug-Reproduktion

Integrationstest im echten Programm (`tests/`, Muster `tests/fremdschluessel.rs:130–153`, Helfer `tests/gemeinsam`): AK 1 als erster Test. **Rot ohne Fix** (erwartet 201 mit `aufgaben/0008-fund.md`); die gemessene Antwort steht im Commit.

### Code-Extraktion für isoliertes Testing

Der nachsichtige Leser ist eine reine Funktion (Dateitext → *keiner* | *lesbar*) und für sich testbar: Tabelle aus ADR-0004 N1, „Durchsetzung“, dazu der Gleichlauf mit dem strengen Lesen (für jede Datei, die `lesen` annimmt, derselbe Schlüssel; Fälle aus `schluessel_im_rundlauf`, `src/format/aufgabe.rs:511–516`).

### Regressionstests

- `tests/fremdschluessel.rs` bleibt ohne geänderte Erwartung grün (201, 200, 409, Wiederöffnen).
- Die deterministische Sperr-Probe (`src/dienst/aufgabe_anlegen.rs:309–345`) bleibt grün.
- Festgehalten, nicht geändert: `dubletten` und `defekte` in `GET /api/zustand`, `GET /api/aufgaben?key=`, `POST /api/aufgaben/erledigen`, `POST /api/aufgaben/{nr}/duplizieren`.

## Akzeptanzkriterien

**Grundbestand** (herstellbar mit `fabrik` aus `tests/fremdschluessel.rs`, Start mit `--port 0`): eingerichteter Ordner, Board „fabrik“ mit den Spalten „Eingang“ und „Fertig“, `cl` ist Agent (der Sensor), `st` Mensch, keine Aufgabe. Jede Anfrage trägt `X-KanbanD-Wer: cl`, wo nicht anders gesagt.

**Defekte Datei** heißt hier immer: außerhalb von kanbanD von Hand angelegt und mit `git commit` committet, bevor kanbanD startet. kanbanD selbst schreibt keine defekte Datei. Die **Fund-Datei** ist `aufgaben/0007-fund.md` mit dem Inhalt

```
---
id: 7
title: Fund
key: k1
estimate: abc
---
```

**Nichts angelegt** (gilt für jedes Kriterium, das so sagt): die Liste der Dateien unter `aufgaben/` ist vor und nach der Anfrage gleich; `git rev-parse HEAD` und `git status --porcelain` des Board-Ordners sind gleich; `boards/fabrik.md` ist unverändert.

**423 in der Form:** Status 423, `Content-Type: application/json`, Rumpf `{"fehler": "…"}` mit der Meldung aus „Wortlaut“.

### Bug behoben (Kriterien des product-owner, wörtlich 1–9)

- [ ] **AK 1 Abnahme-Probe der Karte — formwidrige Schätzung:** Gegeben der Grundbestand und die Fund-Datei. Wenn `POST /api/aufgaben` mit `{"titel": "Fund", "key": "k1", "board": "fabrik"}` gesendet wird, dann antwortet kanbanD mit 423 in der Form; die Meldung nennt die Datei `aufgaben/0007-fund.md`, den Grund und den Schlüssel `k1` — Beispiel mit dem am Code gelesenen Grund: „aufgaben/0007-fund.md: estimate: ganze Zahl von Minuten ≥ 1 erwartet — nur lesbar, bis die Datei repariert ist; sie trägt den Schlüssel „k1“, angelegt wurde nichts“; nichts ist angelegt. Heute: 201 und `aufgaben/0008-fund.md` mit `key: k1`.
  - Dasselbe gilt, wenn der Mensch `st` sendet (jede Anfrage mit `key`, Mensch wie Agent).
  - Mehrere Treffer: liegen `aufgaben/0007-fund.md` und `aufgaben/0009-fund.md` beide defekt mit `key: k1` vor, nennt die Meldung `aufgaben/0007-fund.md` (die erste in der Reihenfolge des Lesens).
- [ ] **AK 2 Konfliktmarker:** Gegeben der Grundbestand und `aufgaben/0007-fund.md` mit Merge-Konfliktmarkern und einer Zeile `key: k1`:

  ```
  ---
  id: 7
  title: Fund
  key: k1
  <<<<<<< HEAD
  class: eilig
  =======
  class: normal
  >>>>>>> sensor
  ---
  ```

  Wenn `POST /api/aufgaben` mit `{"titel": "Fund", "key": "k1", "board": "fabrik"}` gesendet wird, dann 423 in der Form; die Meldung nennt `aufgaben/0007-fund.md`, den Grund (am Code gelesen: „Merge-Konfliktmarker in der Datei“) und den Schlüssel `k1`; nichts ist angelegt. Heute: 201 und `aufgaben/0008-fund.md`.
- [ ] **AK 3 Doppelte Nummer:** Gegeben der Grundbestand, `aufgaben/0007-alt.md` (`id: 7`, `title: Alt`, ohne `key`) und `aufgaben/0007-fund.md` (`id: 7`, `title: Fund`, `key: k1`) — die zweite ist wegen der doppelten Nummer defekt. Wenn `POST /api/aufgaben` mit `{"titel": "Fund", "key": "k1", "board": "fabrik"}` gesendet wird, dann 423 in der Form; die Meldung nennt `aufgaben/0007-fund.md`, den Grund (am Code gelesen: „Nummer #7 doppelt — auch in aufgaben/0007-alt.md“) und den Schlüssel `k1`; nichts ist angelegt. Heute: 201 und `aufgaben/0008-fund.md`.
- [ ] **AK 4 `…/mehrere` als Ganzes:** Gegeben der Grundbestand und die Fund-Datei. Wenn `POST /api/aufgaben/mehrere` mit `{"titel": [{"titel": "neu", "key": "k9"}, {"titel": "Fund", "key": "k1"}], "board": "fabrik"}` gesendet wird, dann 423 in der Form für die ganze Anfrage, die Meldung nennt den Schlüssel `k1`; nichts ist angelegt — auch die Aufgabe mit `k9` nicht. Heute: 201 mit zwei neuen Dateien.
- [ ] **AK 5 Andere Schlüssel und Anlegen ohne Schlüssel laufen weiter:** Gegeben der Grundbestand und die Fund-Datei. Wenn `POST /api/aufgaben` mit `{"titel": "Anderer", "key": "k2"}` und danach mit `{"titel": "Lose"}` (ohne `key`) gesendet wird, dann je 201 mit `neu: true`, je genau eine neue Datei (`aufgaben/0008-anderer.md`, `aufgaben/0009-lose.md`) und je genau ein Commit.
- [ ] **AK 6 400 vor 423:** Gegeben der Grundbestand und die Fund-Datei. Wenn `POST /api/aufgaben` mit `{"titel": "Fund", "key": ""}` gesendet wird, dann 400 „Schlüssel: 1–200 Zeichen ohne Zeilenumbruch“, nicht 423; ebenso `…/mehrere` mit `{"titel": [{"titel": "Fund", "key": "k1"}, {"titel": "leer", "key": ""}]}` → 400 für die ganze Anfrage. Nichts ist angelegt.
- [ ] **AK 7 423 vor 200 und vor 409:** Gegeben der Grundbestand und die Fund-Datei.
  - Eine lesbare Karte: dazu `aufgaben/0008-fund.md` (`id: 8`, `title: Fund`, `key: k1`, lesbar). Wenn `POST /api/aufgaben` mit `{"titel": "Fund", "key": "k1"}` gesendet wird, dann 423 in der Form mit `aufgaben/0007-fund.md` in der Meldung — **nicht 200**. Heute: 200 mit #8 und `neu: false`.
  - Zwei lesbare Karten: dazu außerdem `aufgaben/0009-fund.md` (`id: 9`, `key: k1`, lesbar). Dieselbe Anfrage → 423 in der Form — **nicht 409**. Heute: 409 „Schlüssel „k1“ mehrfach vergeben: #8, #9“.
  - In beiden Lagen ist nichts angelegt.
- [ ] **AK 8 Grenze der schmalen Fassung — ein Schlüssel, der kein gültiger einzeiliger Text ist, hält nichts an:** Gegeben der Grundbestand und `aufgaben/0007-fund.md` mit `id: 7`, `title: Fund` und der Zeile `key: ""` (die Datei ist defekt). Wenn `POST /api/aufgaben` mit `{"titel": "Fund", "key": "k1"}` gesendet wird, dann 201 mit `neu: true` und der neuen Datei `aufgaben/0008-fund.md`. Ebenso mit der Zeile `key: [a, b]` statt `key: ""`: Anlegen mit `key: "k1"` und Anlegen mit `key: "[a, b]"` ergeben je 201. (Der dritte Wert „nicht bestimmbar“ ist nicht gebaut.)
- [ ] **AK 9 Beschreibung:** `GET /api` (Seite), `GET /api/endpunkte` und `GET /api/openapi.json` nennen bei `POST /api/aufgaben` und bei `POST /api/aufgaben/mehrere` den Anlass wörtlich mit dem Satz „423: Eine defekte Aufgabendatei trägt den Schlüssel der Anfrage; angelegt wird nichts, bis die Datei repariert ist.“

### Bug-Vorlage (Pflicht)

- [ ] **AK 10 Rot ohne Fix:** Die Tests zu AK 1–4 und AK 7 sind am Stand vor dem Fix rot und mit Fix grün; der Commit der ersten Bubble nennt die gemessenen Antworten vor dem Fix.
- [ ] **AK 11 Keine neuen Fehler:** Die bestehende Suite (`cargo test`) ist ohne geänderte Erwartung grün, darunter `tests/fremdschluessel.rs` und die Sperr-Probe in `src/dienst/aufgabe_anlegen.rs`.

## Implementierungshinweise

- **Abgrenzung — nicht hinein** (product-owner 2026-11-15, wörtlich): „‚nicht bestimmbar‘ als Wert oder Sperre, `dubletten`, `?key=`, `erledigen`, Lockerung der strengen Prüfung, Reparaturhilfe, Oberfläche, Lastprobe, Mutanten als Akzeptanzkriterien.“ Umfang nur `POST /api/aufgaben` und `POST /api/aufgaben/mehrere`.
- **Mutanten sind Testmittel, keine Kriterien** (ADR-0004 N1, „Durchsetzung“), im eigenen Worktree mit eigenem Build-Ziel:
  - M1: die zweite Liste wird in `anlegen_gesperrt` wieder verworfen → die Abnahme-Probe (AK 1) ist rot.
  - M2: die Suche unter lesbaren Karten (200/409) läuft vor der Prüfung der defekten Dateien → die Reihenfolge-Probe (AK 7) ist rot.
- **Ein nachsichtiger Leser**, im Format, nicht im Dienst; ein zweiter neben ihm ist ein Review-Befund (`architektur-reviewer`, `code-reviewer`), ebenso ein Weg, der mit Schlüssel anlegt und die Liste der defekten Aufgaben verwirft.
- **Kein neues Feld in der API:** der Rohschlüssel lebt nur im Speicher; `defekte` in `GET /api/zustand` und `GET /api/aufgaben` trägt je Eintrag die Felder von heute, das OpenAPI-Schema ändert sich nicht (ADR-0004 N1 Punkt 6). Die 423 steht an beiden Endpunkten schon in `responses` (`src/web/mod.rs:379`); neu ist nur der Satz in der Beschreibung.
- **Gründe in den Beispielen** (AK 1–3) sind am Code gelesen (`GESCHAETZT_MELDUNG` `src/modell/aufgabe.rs:362`, `src/format/frontmatter.rs:7`, `src/ablage.rs:88`), nicht gefahren. Verbindlich ist: der Grund in der Meldung ist der Text, den `GET /api/zustand` unter `defekte` für diese Datei nennt. Weicht ein Beispiel ab, meldet der Entwickler das, statt die Erwartung still zu ändern.
- **AK 7, heutiges Verhalten:** mit einer lesbaren Karte antwortet kanbanD heute 200 und legt nichts an — dort entsteht keine Dublette. Die 423 ist trotzdem entschieden (ADR-0004 N1 Punkt 4: der defekte Ordner hat Vorrang); für einen Sensor ändert sich die Antwort in dieser Lage von 200 auf 423, bis die Datei repariert ist.
- **404 und 500 bleiben vorn** (ADR-0003 N2): ein unbekanntes Board (`board: "gibtsnicht"`) ist kein Kriterium dieser Anforderung; steht die Prüfung im Code anders, Meldung an den architekt.
- **In Kauf genommen** (ADR-0004 N1): verliert der Schlüssel in der defekten Datei Form oder Wert, entsteht wie heute genau eine Zweitkarte (AK 8); unlesbares Frontmatter ohne eine Zeile `key:` am Zeilenanfang gilt als *keiner*; die Zeilensuche kann zu viel finden — Folge ist eine 423 mit Verweis auf eine Datei, die ohnehin repariert werden muss.
- **Kosten:** kein zusätzliches Dateilesen; der Rohschlüssel fällt im selben Durchgang an, nur für defekte Dateien.
- Die Oberfläche sendet beim Anlegen den Fenster-Schlüssel `neu-<zeit>-<zufall>` (R00148); eine defekte Datei mit genau diesem Schlüssel ist nicht zu erwarten. Kein Element und kein Code der Oberfläche ändert sich.
- Protokollierung: ADR-0001 (Logging) ist „Vorgeschlagen“ und nicht gebaut; diese Anforderung schreibt keine Protokollzeile.

## Offene Fragen

Keine, die den Bau aufhält. Umfang, Kriterien, Wortlaut und Abgrenzung hat der product-owner am 2026-11-15 entschieden (`AI-Team/po-entscheidungen.md`, Fragen 1–4 zu #44). Vom planer ausgelegt und dem product-owner zur Bestätigung vorgelegt:

1. AK 7 nennt zwei Lagen (eine und zwei lesbare Karten), weil „nicht 409“ mit einer lesbaren Karte nicht prüfbar ist.
2. AK 8 nennt als Beispiele die Schlüssel `k1` und `[a, b]` für „beliebiger gültiger Schlüssel“.
3. Die Regel „mehrere Treffer: die erste defekte Datei in der Reihenfolge des Lesens“ steht als Variante in AK 1.

## Manuelle Vorbereitungstätigkeiten

Keine.

## Manuelle Nachbereitungstätigkeiten

Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser: eine Aufgabendatei mit `key: k1` wird defekt (Konfliktmarker nach einem Merge, ein Tippfehler in `estimate`), und der Sensor, der täglich mit `k1` anlegt, bekommt 201 und eine zweite Karte, weil das Anlegen die Liste der defekten Dateien wegwirft. Behält `anlegen_gesperrt` diese Liste und liest den Schlüssel der defekten Dateien nachsichtig (X), dann sieht die Schlüsselsuche auch die Datei, die das strenge Lesen verwirft (Y), und kanbanD antwortet mit 423 samt Datei, Grund und Schlüssel, statt eine Dublette zu schreiben (Z). Der Hebel sitzt an der Suche und nicht am Lesen: eine gelockerte Prüfung beim Lesen verhinderte die Dublette nicht, und ein Aufräumen nach der Reparatur ließe sie erst entstehen. Der Sensor erfährt aus der Meldung, welche Datei ein Mensch reparieren muss; alle anderen Schlüssel und das Anlegen ohne `key` laufen weiter.

## Notizen

- Priorität: Mittel — Bruch der Zusage von R00098, latent (heute trägt keine der Aufgaben des Projektboards einen `key`); erreichbar, sobald Sensoren mit `key` anlegen.
- Betroffene Nutzer/Systeme: Agenten und Sensoren, die über `POST /api/aufgaben` oder `…/mehrere` mit `key` anlegen.
- Workaround: nach der Reparatur der Datei melden `dubletten` (`GET /api/zustand`) und die 409 die Doppelte; sie wird von Hand zusammengeführt.
- **Herkunft:** Karte #44; Technik: ADR-0004 Nachtrag N1 (2026-11-15, `a1c3780`); Architektur-Modell A00004 Dienste, A00005 Format, A00006 Modell. Bezug: R00098 (idempotentes Anlegen), R00099 (Befund erledigt sich), ADR-0003 N2 (Ordnung der Abweisungen).
- **Heimat:** eigene Interaction `I0144` unter D0007.
- Labels der Karte: `architektur`, `text`.
