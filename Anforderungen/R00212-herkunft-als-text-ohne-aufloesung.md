---
id: R00212
status: Neu
datum: 2026-11-20
---

# R00212: Herkunft als Text ohne Auflösung

## Beschreibung

Karte #226, Scheibe **S4** des Rückbaus der WBS (Auftrag des Betreibers 2026-11-20, #224). Technik nach [ADR-0034](../Dokumentation/ADRs/0034-kanband-ohne-wbs-register-mit-repository-phasen-werden-spalten.md) **Nachtrag N3** (Regeln 1–8, Testtabelle); Produktentscheidungen po-entscheidungen Z. 430 (Herkunft bleibt Text, `/api/herkunft` entfällt), Z. 445 („wartet auf“ fällt mit S4) und Z. 446 (Chip Variante A ohne Nachzeichnung).

Die Herkunft einer Aufgabe (`origins`, z. B. `kd:I0007`) bleibt Inhalt der Aufgabe: kanbanD liest, schreibt, prüft die Schreibweise, filtert, exportiert und zeigt sie als Text. kanbanD **löst sie nicht mehr auf** — weder gegen die WBS noch gegen den Anforderungsordner. Damit entfallen:

- der Endpunkt `GET /api/herkunft` (danach 404) samt Dienst `Kanban::herkunft`, `anforderungsname` und `Anwendungen::aufloesen`;
- in der Oberfläche der Abruf der Auflösung, der Editor-Link und der Tooltip des Herkunfts-Chips, sein Hover-Zustand;
- **„wartet auf“** auf der Karte und im Aufgabenfenster: es nahm `Braucht` allein aus der Auflösung (ADR-0034 N3 Regel 4). Bis #228 „Braucht zwischen Karten“ gibt es kein „wartet auf“; die Labels `braucht:<nr>` bleiben sichtbar (PO Z. 445).

Der Herkunfts-Chip ist danach ein Text-Chip `span.org` ohne `href` und ohne `title`, ohne Hover und ohne eigenen Zeiger-Cursor; im Ruhezustand sieht er aus wie heute (PO Z. 446). „ohne Herkunft“ (`thin air`) und „mehrdeutig“ bleiben wie heute; „mehrdeutig“ rechnet nur noch aus Text und Register.

**Abnahme-Probe der Karte (wörtlich):** „`GET /api/herkunft` gibt 404. Die Herkunft-Chips bleiben, „wartet auf“ aus der WBS gibt es nicht mehr. Altaufgaben mit `origins` öffnen unverändert.“ Sie steckt in AK 1, AK 2, AK 4 und AK 7.

Ändert [R00018](R00018-herkunft-und-abhaengigkeiten.md) (Editor-Link der Herkunft, „wartet auf“) und [R00053](R00053-anwendungen-registrieren.md) (Auflösung je Kürzel, Tooltip „Quelle nicht gefunden“). Beide bleiben unverändert stehen.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Aufgaben sind der Stand“ („kanbanD liest, schreibt und zeigt sie [die WBS] nicht“; die Herkunft ist „ein Verweis, den kanbanD nicht auflöst“), Leitplanke „Die Dateien sind der einzige Speicher“.

### Domänenbezug

Begriffe: Aufgabe, Aufgabenfenster, Board, Herkunft (`origins`), Anwendung und Kürzel (Register in `kanbanD.md`). Ein eigener Glossar-Eintrag für „Herkunft“ fehlt (Missing-Docs).

## Geschäftlicher Nutzen

Die Auflösung ist der letzte Teil von kanbanD, der WBS-Dateien und Anforderungsordner liest, ohne zur WBS-Sicht zu gehören. Ist sie weg, kann S2 (#224) die WBS entfernen, ohne dass sich an Karten etwas ändert, was nicht schon geprüft und abgenommen ist. Die 363 Aufgaben mit Herkunft behalten ihren Text, Filter und Export; nur der Sprung in den Editor fällt weg.

## Funktionale Anforderungen

- `GET /api/herkunft` gibt 404 (der Router hat keinen Fallback). Die Endpunktliste (`GET /api/endpunkte`, README) nennt ihn nicht mehr.
- `origins` wird unverändert gelesen und geschrieben: Format in der Aufgabendatei, `herkunft` in `POST`/`PATCH`/Duplizieren, Schnelleingabe, Feld „Neue Herkunft“, Entfernen mit Rückgängig (R00185).
- Die Prüfung der Schreibweise beim Schreiben über die API bleibt mit ihren Meldungen (ADR-0034 N3 Regel 2).
- Der Herkunfts-Chip ist `<span class="org" data-halt="herkunft:…">kd:I0007</span>` ohne `href` und ohne `title`, auf der Karte und im Aufgabenfenster. `org leer` („ohne Herkunft“) und `org mehrdeutig` bleiben wie heute, mit ihrem `title`.
- „mehrdeutig“ gilt genau dann, wenn die Herkunft kein Kürzel hat, nicht `thin air` ist und der Ordner mehr als eine Anwendung kennt.
- Die Oberfläche fragt `/api/herkunft` nie an.
- „wartet auf“ erscheint weder auf der Karte noch im Aufgabenfenster.
- Filter `origin:` (`web/filter.js:59`), CSV-Export der Zeiten (Spalte Herkunft) und „ohne Herkunft“ verhalten sich wie heute.
- README Z. 51 sagt: Die Herkunft ist ein Verweis, den kanbanD nicht auflöst; ohne Kürzel ist sie bei mehreren Anwendungen mehrdeutig (ADR-0034 N3 Regel 8).

## Nicht-funktionale Anforderungen

- Gestaltung: keine Nachzeichnung (PO Z. 446). Der Ruhezustand des Chips ist der angesehene; D0002/D0003 zieht der gestalter mit #228 nach.
- Verträglichkeit: Format und Daten ändern sich nicht; kein Start und kein Lesen schreibt eine Datei oder einen Commit.
- Kein Aufrufer außerhalb von kanbanD nutzt `/api/herkunft` (ADR-0034 N3 „Belegt“); die Factory setzt `origins` weiter über `POST`/`PATCH`.

## Akzeptanzkriterien

Ausgangslage (herstellbar mit Git und der API): Ordner `K` mit Register `kd` (Repository `R`, WBS `R/Dokumentation/Planung/kd.md` mit den Knoten `I0007` und `I0008`, `I0008` hat `Braucht` = `I0007`, und Anforderung `R/Anforderungen/R00014-probe.md`). Aufgabe #1 mit `origins: [kd:I0007, kd:R00014]` und Label `braucht:2`, Aufgabe #2 mit `origins: [kd:I0008]` in einer offenen Spalte, Aufgabe #3 ohne `origins`. Auf dem Stand vor der Karte zeigt #2 „wartet auf #1“ und der Chip `kd:I0007` ist ein `a.org` mit Editor-Link.

### Endpunkt

- [ ] **AK 1** Gegeben die Ausgangslage. Wenn `GET /api/herkunft` (auch mit Abfrage `?x=1`) aufgerufen wird, dann ist die Antwort 404, und `GET /api/endpunkte` sowie README nennen `/api/herkunft` nicht. Heute: 200 mit `kd:I0007` aufgelöst.

### Chip

- [ ] **AK 2** Gegeben die Ausgangslage. Wenn der Betreiber das Board öffnet und danach #1 im Aufgabenfenster, dann ist jeder Chip `kd:I0007` und `kd:R00014` ein `span.org` ohne `href` und ohne `title`, auf der Karte und im Fenster. Kein Element `.org` der Seite hat ein `href` oder einen `title` mit „Quelle“ oder „Editor“. Im Netzwerkmitschnitt vom Laden bis nach einem Neuladen gibt es keine Anfrage an `/api/herkunft`. #3 zeigt „ohne Herkunft“ wie heute. Mit einer zweiten Anwendung `lc` im Register zeigt eine Herkunft `I0007` ohne Kürzel „I0007 · mehrdeutig“ mit dem heutigen `title`, `kd:I0007` bleibt ohne Zusatz.
- [ ] **AK 3** Gegeben die Ausgangslage, Hell und Dunkel. Wenn der Chip `kd:I0007` auf der Karte und im Fenster im Ruhezustand gemessen wird, dann sind seine berechneten Stile `color`, `background-color`, `border`, `font-family`, `font-size`, `padding`, `height` und `text-decoration-line` gleich den Werten am Stand vor der Karte (B1059 hält sie fest). Fährt die Maus über den Chip, ändert sich keiner dieser Werte. Im Fenster ist `cursor` nicht `pointer`; auf der Karte ist `cursor` gleich dem der Karte selbst (kein eigener Wert am Chip).

### „wartet auf“

- [ ] **AK 4** Gegeben die Ausgangslage. Wenn der Betreiber das Board öffnet und #2 im Aufgabenfenster, dann gibt es auf der Karte #2 kein Element `.wartet` und keinen Text „wartet auf“, und das Fenster hat keine Zeile „wartet auf“. Das Label `braucht:2` an #1 ist auf der Karte sichtbar.

### Herkunft lesen und schreiben

- [ ] **AK 5** Gegeben die Ausgangslage. Wenn per API und Oberfläche geschrieben wird, dann gilt wie heute:
  - `PATCH /api/aufgaben/3` mit `herkunft: [kd:I0007, R00014]` (nur `kd` im Register) ergibt 200, genau einen Commit und `origins` in der Datei in dieser Reihenfolge;
  - `herkunft: [X1]` und `herkunft: [zz:I0001]` (unbekanntes Kürzel) ergeben 400 mit derselben Meldung wie vor der Karte, ohne Commit;
  - `kd:I0009` über das Feld „Neue Herkunft“ erscheint als Chip; „entfernen“ und danach „Rückgängig“ stellen ihn an derselben Stelle wieder her (R00185).
- [ ] **AK 6** Gegeben die Ausgangslage und an #1 ein Zeiteintrag von 30 Minuten. Wenn im Board-Filter `origin:kd:I0007` und danach `origin:"thin air"` steht und der Export `GET /api/berichte/zeiten.csv` geladen wird, dann zeigt der erste Filter genau #1, der zweite genau #3, und die CSV ist bytegleich zur CSV des Programms vor der Karte auf demselben Ordner (Spalte Herkunft der Zeile von #1: `kd:I0007, kd:R00014` bzw. so, wie das Programm vor der Karte sie schreibt).

### Altbestand

- [ ] **AK 7** Gegeben Kopien der Ordner `~/Projekte/Kanban-Boards/JoinPuyaApp-Kanbanboard`, `localchatA-Kanbanboard`, `kanbanD-Kanbanboard` und `goaltreetoolA-Kanbanboard` in der eigenen Ablage (Stand 2026-11-20 zusammen 363 Aufgaben mit 547 Herkunftseinträgen). Wenn erst das Programm vor der Karte und dann dieses auf jeder Kopie startet und `GET /api/aufgaben` sowie das Board gelesen werden, dann:
  - liefert jeder Lauf 200 ohne defekte Datei, und im Log steht keine Fehler- oder Warnzeile;
  - ist die Liste `herkunft` jeder Aufgabe in beiden Läufen gleich (Zahl der Aufgaben mit Herkunft und der Einträge gleich der Zählung mit `grep` über `origins:`);
  - bleibt die Zahl der Commits gleich (`git rev-list --count HEAD`), und alle Dateien sind bytegleich (SHA-256 über `git ls-files`);
  - erscheinen die Chips auf dem Board der JoinPuya-Kopie als Text ohne `href`.

## Betroffene Verzeichnisstruktur

- Entfällt: `src/dienst/herkunft.rs` (samt `mod`/Re-Export `src/dienst/mod.rs:29`, `:64`).
- Ändert: `src/web/mod.rs` (Route `:95`, Handler `:1453–1464`), `src/web/endpunkte.rs:103`, `src/herkunft.rs` (nur `wbs_tabelle` bleibt bis S2), `src/modell/anwendungen.rs` und `src/modell/mod.rs:14` (ohne `aufloesen`/`Aufloesung`), `src/dienst/anwendungen.rs` (nimmt `absolut` auf), `src/dienst/phasen.rs`, `src/dienst/wbs.rs` (nur `use`).
- Oberfläche: `web/app.js` (`S.herkunft` `:2`, `:242`, `:302–304`, `:321`), `web/ansicht.js` (`quelleLink`, `mehrdeutig`, `vHerkunftChip` `:701–718`, `wartetAuf` `:788–797`, Fenster `:430`, Karte `:863`), `web/kd-app.css` (`:208–215`, `:236`, `:743–744`).
- Doku: README Z. 51.
- Tests: `tests/herkunft.rs`, `tests/anwendungen.rs`, `tests/aufgaben.rs:59`, Unit-Tests in `src/herkunft.rs` und `src/modell/anwendungen.rs`; e2e `r00018-herkunft`, `r00053-anwendungen`, `kontrast`, `r00171`/`r00172` (Hilfe `waehlen`), `r00196:206`; neu `tests/akzeptanz_r00212.rs`, `e2e/tests/r00212-herkunft-als-text.spec.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1059 Abnahme-Proben rot**: Rust `GET /api/herkunft` → 404 (heute 200); e2e Chip ohne `href`/`title`, kein `.wartet`, keine Anfrage an `/api/herkunft` (heute rot); Stile des Ruhezustands am heutigen Stand messen und als Erwartung festhalten (AK 3).
2. **B1060 Dienst und Route entfernen**: Regeln 1 und 5 von N3; Rust-Tests nach der Testtabelle umbauen.
3. **B1061 Oberfläche ohne Auflösung und ohne „wartet auf“**: `S.herkunft`, `quelleLink`, Link-/Tooltip-Zweig, `wartetAuf` mit Karten- und Fensterzeile, CSS.
4. **B1062 e2e-Tests umbauen**: r00018, r00053, kontrast, Wartelisten in r00171/r00172/r00196.
5. **B1063 README Z. 51** nach Regel 8.
6. **B1064 Legacy-Probe** an Kopien der vier Ordner (AK 7).
7. **B1065 Probe im echten Programm, Gate, Anforderung abschließen.**

### Hinweise

- Grenze zu S2/S3 und #229 nach N3 Regel 7: WBS-Sicht, Wirkungen, Phasen, Register-Felder und `wbs_tabelle` bleiben unberührt.
- Der Chip auf der Karte erbt den Zeiger der Karte (`.ka{cursor:pointer}`): ein Klick auf ihn öffnet die Karte wie ein Klick daneben. Er bekommt keinen eigenen Zeiger und kein eigenes Ziel.
- Kopien nur in der eigenen Ablage, nie im Board-Ordner selbst; der kanbanD-Ordner ist das laufende Board des Directors. Testsystem ohne echte Personendaten: die Ordner enthalten Karten, keine Personendaten von Nutzern.

## Tests

- **Unit:** entfallen `name_der_anforderung`, `aufloesen_eindeutig_mehrdeutig_unbekannt`; „mehrdeutig“ aus Text und Register (falls als reine Funktion herausgelöst).
- **Integration:** `tests/akzeptanz_r00212.rs`: AK 1, AK 5 (API-Teil), AK 7 (`#[ignore]`, wenn die Ordner fehlen; in B1064 einmal gefahren und belegt).
- **E2E:** `e2e/tests/r00212-herkunft-als-text.spec.js`: AK 2–4, AK 5 (Oberfläche), AK 6.

## Abhängigkeiten

- **Abhängig von:** [R00209](R00209-register-fuehrt-das-repository-der-anwendung.md) (I0199, Karte #225, erledigt); [R00018](R00018-herkunft-und-abhaengigkeiten.md) (I0018), [R00053](R00053-anwendungen-registrieren.md) (I0048), [R00185](R00185-herkunft-entfernen-mit-rueckgaengig-fussmeldung-und-kartenname-des-vergessenen-timers.md) (I0175).
- **Blockiert:** #228 „Braucht zwischen Karten“ (`braucht:226`, PO Z. 445).

## Offene Fragen

- Keine. Produkt entschieden (PO Z. 430, 445, 446), Technik entschieden (ADR-0034 N3).

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine; Bestände bleiben, wie sie sind.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser ist die Vision vom 2026-11-20: kanbanD liest die WBS nicht mehr. Die Auflösung der Herkunft liest WBS und Anforderungen bei jedem Aufbau der Oberfläche (`web/app.js:302–304` → `Kanban::herkunft`). Fällt der Endpunkt weg, lesen Board und Aufgabenfenster diese Dateien nicht mehr (AK 1, AK 2); übrig bleiben nur WBS-Sicht, Wirkungen und Phasen, die S2 und S3 entfernen. Weil der Text selbst unangetastet bleibt, verliert kein Bestand Daten (AK 7), und Filter, Export und Prüfung bleiben gleich (AK 5, AK 6). „wartet auf“ hing nur an der Auflösung und fällt deshalb hier, sichtbar und abgenommen (AK 4), statt später still zu verschwinden.

## Missing-Docs

- Glossar: „Herkunft“ hat keinen eigenen Eintrag in `Dokumentation/Domaenenwissen/` (nur Erwähnungen in D00003, D00010).

## Notizen

**Verworfene Alternativen** (ADR-0034 N3, Varianten B–D): Tooltip „kanbanD öffnet ihn nicht“ (Rauschen auf 547 Chips, neuer Wortlaut); Chip als Filter (neuer Umfang); Editor-Link aus `repository` errechnet (Auflösung in anderer Form, widerspricht der Vision).
