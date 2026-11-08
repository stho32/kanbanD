# ADR-0017: Rückgängig als Gegenaktion mit gemerktem Inhalt — entfernte Dinge werden über die API neu geschrieben, nicht verzögert gelöscht

**Status**: Akzeptiert
**Datum**: 2026-11-08
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #12 „Entfernende Aktionen mit Rückgängig versehen und dauerhaft sichtbar machen“ (UX-Durchsicht 2026-10-31); Anforderung und WBS-Knoten folgen über den planer
**Nachträge**: 2026-11-08 — Regel 5 unter Zuständige und Hilfe, siehe [Nachtrag N1](#nachtrag-2026-11-08-n1-hinweis-unter-zustaendige-und-hilfe-r00112). Der Text oberhalb der Nachträge ist der Stand der Annahme und bleibt unverändert.
**Erprobt durch**: Probe 2026-11-08 gegen eine eigene Instanz (`target/release/kanbanD <wegwerf-ordner> --port <frei> --kein-browser`, kanbanD `283b94c`, unter `nice -n 19`), nur über die HTTP-API:
- **Board:** `DELETE /api/boards/{slug}/aufgaben/1`, danach `POST /api/boards/{slug}/aufgaben {nummer:1, spalte}` stellt „Liegt auf“ und die Spalte wieder her. Die Karte landet aber **unten**: vorher Reihenfolge 1, 2, 3, nachher 2, 3, 1. Ein zweites Auflegen ergibt 409.
- **Teilaufgabe:** `POST …/teilaufgaben {text, position:1, erledigt:true}` ignoriert `position` und `erledigt`. Die Teilaufgabe hängt am Ende und ist offen.
- **Zeiteintrag:** `POST …/zeiten {wer, beginn, ende}` stellt den Eintrag mit derselben Kennung `wer@beginn` wieder her. Ein zweites Wiederherstellen ergibt 409, es entsteht kein Doppel.
- **Anhang:** die Bytes werden vor dem Löschen über `GET …/anhaenge/{name}` gelesen. Nach `DELETE` stellt ein multipart-Upload unter demselben Namen den Anhang bytegleich wieder her.
- **Historie:** jede Wiederherstellung ist ein eigener, neuer Commit.

Die Oberfläche ist nicht im Browser geprobt. Das leistet die Abnahme-Probe der Karte.

## Kontext

Vier Aktionen entfernen sofort und ohne Rückweg:
- „von Board nehmen“ (`abnehmen`, `web/app.js:1208`, auch im Kontextmenü `web/menue.js:63`)
- Teilaufgabe entfernen (`teil-weg`, `:963`, adressiert per **Index**)
- Anhang entfernen (`anhang-weg`, `:1214`, löscht die Datei, `src/dienst/anhaenge.rs`)
- Zeiteintrag entfernen (`zeit-weg`, `:1246`, nur beendete Einträge)

Für Bewegen, Archivieren und Mehrfach-Ziele gibt es schon einen Toast mit „rückgängig“: `S.ui.hinweis.undo`, Fall `rueckgaengig` (`web/app.js:1017`), Strg+Z (`:1710`), Ablauf nach 8 s (`:2275`). Diese Fälle machen die Aktion als neue Gegenaktion über die API rückgängig. Nur der jeweils neueste Hinweis lebt.

Randbedingungen:
- Der Schreibweg ist eine Aktion, eine Sperre, ein Commit ([X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md), [ADR-0005](0005-zusammengesetzte-aktionen-in-einem-commit.md)).
- Die Zugregeln gelten vor der Aktion ([ADR-0002](0002-zugregeln-gemeinsam-vor-der-aktion.md)).
- Bis zu zehn Agenten schreiben, und die Datei-Wächter-Synchronisation läuft in unter einer Sekunde.
- Nur die neueste Antwort wird übernommen, und die Zustandsfelder schreiben nur `laden`/`dateiLaden`/`defektLaden` ([ADR-0014](0014-nur-die-neueste-antwort-wird-uebernommen.md)).
- Der Toast ist als Ort für Fensterfehler verworfen ([ADR-0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md), Option D).

### Qualitätsziele und Szenarien

| Ziel | Szenario | Maß |
|---|---|---|
| Fehlertoleranz der Bedienung | Ein Mensch klickt versehentlich ein ✕ | Zustand vorher wird mit einem Klick oder Strg+Z innerhalb der Hinweisdauer wiederhergestellt; bei Board und Teilaufgabe auch die Position |
| Konsistenz unter Nebenläufigkeit | Ein Agent ändert die Karte zwischen Entfernen und Rückgängig | Nichts Fremdes wird überschrieben; ein Konflikt endet als Meldung (409/404/400), nie stillschweigend |
| Nachvollziehbarkeit | Jemand liest die Git-Historie | Entfernen und Wiederherstellen sind je ein eigener Commit mit sprechender Nachricht |
| Sofortige Sichtbarkeit | Ein zweiter Tab oder ein Agent liest direkt nach dem Klick | Der Stand auf der Platte ist der gezeigte Stand (kein „schwebendes“ Löschen) |

## Optionen

### Option A: Gegenaktion über die API mit gemerktem Inhalt
Vor dem Entfernen merkt sich die Oberfläche, was sie zum Wiederherstellen braucht, im `undo` des Hinweises. „rückgängig“ schreibt es als neue Aktion zurück.
- Vorteile:
  - Derselbe Weg wie die vorhandenen Fälle `bewegen`/`zurueckholen`/`ziele`.
  - Jede Wiederherstellung läuft unter der Sperre durch dieselben Prüfungen. Fremde Änderungen bleiben unangetastet.
  - Datei und Historie sind sofort wahr.
  - Kein neuer Endpunkt; Zeit und Anhang gehen schon heute (Probe).
- Nachteile:
  - Board-Position und Position/Status einer Teilaufgabe brauchen kleine, additive Parameter.
  - Für einen Anhang muss vorher der Inhalt geladen werden (ein GET, bis 50 MB im Speicher des Tabs).
  - Nur dieser Tab kann rückgängig machen.

### Option B: Verzögertes Löschen — erst nach Ablauf des Toasts schreiben
- Vorteile: Rückgängig ist trivial (nichts senden), auch bei Anhängen.
- Nachteile:
  - Bricht die Zusage, dass jede Änderung sofort in der Datei steht.
  - Andere Tabs und Agenten sehen 8 s lang den alten Stand.
  - Teilaufgaben-Indizes verschieben sich zwischen Anzeige und Schreiben.
  - Schließen des Tabs verliert die Aktion.
  - Die Anzeige bräuchte eine Überlagerung außerhalb von `laden` und widerspräche damit ADR-0014.

### Option C: Eigener Wiederherstellungs-Endpunkt (Commit zurücknehmen oder Inhalt aus Git lesen)
- Vorteile:
  - Server-seitig; auch Agenten könnten rückgängig machen.
  - Anhänge kämen aus der Historie, ohne Blob im Tab.
- Nachteile:
  - Ein generisches Zurücknehmen scheitert oft, weil die Datei inzwischen anders geändert wurde (Timer, Kommentare, Agenten).
  - Lesen aus Git braucht eine neue Leseschnittstelle in A00007.
  - Deutlich mehr Servercode für einen Nutzen, den die Karte nicht verlangt.

### Option D: Bestätigungsdialog statt Rückgängig
- Vorteile: kein Wiederherstellen nötig.
- Nachteile: Reibung bei jeder gewollten Aktion; die Karte verlangt ausdrücklich Rückgängig.

## Entscheidung

**Gewählt: Option A.** B tauscht Konsistenz und die Sofort-Zusage gegen Bequemlichkeit, und das in einem System mit vielen Schreibern. C löst eine Frage, die niemand gestellt hat. D widerspricht der Karte. C bleibt Rückfall für Anhänge, falls der Blob im Tab in der Praxis stört (siehe Pre-Mortem).

### Regeln

1. **Rückgängig ist eine neue, vorwärts gerichtete Aktion.** Es setzt nie eine Datei oder einen Commit zurück. Jede Wiederherstellung geht durch dieselbe Prüfung unter der Sperre wie jede andere Aktion. Lehnt der Server ab (409 schon vorhanden oder Grenze, 404 Karte weg, 400), wird das gemeldet. Es wird nie wiederholt, erzwungen oder überschrieben.
2. **Gemerkt wird zum Zeitpunkt des Klicks**, aus dem gezeigten Stand, im `undo` des Hinweises. Neue Arten:
   - `legen {slug, nummer, spalte, index}`
   - `teilaufgabe {nummer, text, erledigt, position}`
   - `zeit {nummer, wer, beginn, ende}`
   - `anhang {nummer, name, blob}`

   Das Gemerkte liegt nicht in den durch ADR-0014 geschützten Feldern (`S.aufgaben`, `S.board`, `S.zustand`, `S.ui.datei`, `S.ui.defektDatei`). Der Wächtertest `e2e/einheit/uebernahme.test.js` bleibt ohne neue Ausnahme.
3. **Anhang: erst lesen, dann löschen.** Die Oberfläche lädt den Inhalt per `GET …/anhaenge/{name}` als Blob. Schlägt das fehl, wird **nicht** gelöscht, und es gibt eine Meldung. Es lebt höchstens ein Blob: der des neuesten Hinweises. Mit dem Ablauf oder einem neuen Hinweis wird er freigegeben. Wiederhergestellt wird per Upload. Ist der Name inzwischen belegt, vergibt der Server `name-2`, und der Erfolgstext nennt den neuen Namen.
4. **Ein Commit je Wiederherstellung.** Dafür gibt es zwei additive, optionale Parameter. Ohne die Parameter bleibt das Verhalten gleich, also sind sie abwärtskompatibel für Agenten:
   - `POST /api/boards/{slug}/aufgaben` nimmt `index?`. Fehlt er, wie heute unten; zu groß, unten.
   - `POST /api/aufgaben/{nr}/teilaufgaben` nimmt `position?` und `erledigt?`.

   Kein Zusammensetzen aus POST + PATCH. Das wären zwei Commits, und ein Agent könnte dazwischen die Indizes verschieben (ADR-0005, Option A verworfen).
5. **Der Toast bleibt der einzige Ort des Rückgängig-Angebots.** Er ist ein Status mit Aktion, kein Fehlerort; ADR-0015 Option D bleibt unberührt.
   - Ist ein modales Fenster offen, wird der Hinweis **im obersten modalen Dialog** gerendert, damit er innerhalb von `aria-modal` liegt und für Screenreader und Tastatur erreichbar ist ([ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md)).
   - Strg+Z gilt auch bei offenem Fenster, außer in Eingabefeldern.
   - Der Toast bricht um und ist in jeder Breite höchstens `min(720px, 100vw - 32px)` breit. Der Knopf „rückgängig“ wird nie abgeschnitten (ADR-0015 Regel 1).
6. **Fehler eines Rückgängig:**
   - bei offenem Fenster über `fensterMelden` im Fuß (ADR-0015)
   - sonst als Toast ohne `undo`: „nicht rückgängig: <Grund>“

   Erfolg ist ein Toast ohne `undo`, z. B. „#7 wieder auf „Entwicklung“ · Spalte In Arbeit“. Fokus danach nach N7a/N7b (ADR-0010).
7. **✕ dauerhaft sichtbar** in `--kd-muted` (Rolle `on-surface-variant`, [ADR-0011](0011-farbrollen-in-paaren-kontrast-als-probe.md)). `opacity:0` bis Hover entfällt; die Regel unter `@media (hover:none)` aus R00108 (`web/kd-app.css`) wird damit zum Normalfall. Die Trefferfläche bleibt nach [ADR-0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md).

### Durchsetzung (Fitness-Funktion)

- **E2E je Art** (Board, Teilaufgabe, Anhang, Zeit): Entfernen, `.toast [data-act=rueckgaengig]` sichtbar, Strg+Z, danach ist der Zustand gleich dem Ausgangszustand. Geprüft werden Position, Erledigt-Status und Bytes des Anhangs (gleiche Länge und gleicher Hash).
- **Negativ je Art:**
  - nach Ablauf kein Knopf und Strg+Z ohne Wirkung
  - nach fremdem Wiederauflegen 409 als Meldung ohne Doppel
  - bei einem GET-Fehler für den Anhang kein Löschen
- **Nebenläufigkeit:** ein Agent ändert die Karte über die API zwischen Entfernen und Rückgängig. Seine Änderung bleibt erhalten.
- **Touch:** bei emuliertem `hover:none` hat jedes ✕ (`.zt .btn-sym`, `.chk .x`, `.anh-z .x`, `.lnk-x`) die berechnete Opazität 1. Bei feinem Zeiger ebenfalls, nach Regel 7.
- **Modal:** mit offenem Aufgabenfenster liegt `.toast` innerhalb von `[aria-modal=true]` und ist per Tab erreichbar.
- **Breite:** `e2e/tests/r00111-schmal-wie-breit.spec.js` nimmt den Toast mit „rückgängig“ auf. Der Knopf hat bei 320/414 px Client-Rects.
- **Wächter** `e2e/einheit/uebernahme.test.js` unverändert grün; keine neue Zeile in `ERLAUBT`.
- **Server-Tests** für `index?` und `position?/erledigt?`: Grenzen (0, zu groß, negativ → 400), ohne Parameter wie bisher, ein Commit.

## Konsequenzen

**Positiv:**
- Alle Rückgängig-Fälle laufen über einen Mechanismus. Die Zugregeln, Eigentümer-Prüfungen und Grenzen gelten ohne Sonderweg.
- Die Historie bleibt ehrlich: entfernt, wiederhergestellt.
- Agenten profitieren von den neuen Parametern auch ohne Rückgängig.

**Negativ / Inkauf zu nehmen:**
- **WIP-Grenze:** Ein Mensch legt eine Karte über die WIP-Grenze ohne Warnung zurück, wie heute beim Auflegen (ADR-0002, Grenze nur für Agenten). Ein Agent bekäme 409.
- **Zeiteinträge:** Ein wiederhergestellter Zeiteintrag steht dort, wo der Server einsortiert. Eine Zeitliste ohne Sortierung zeigt ihn am Ende.
- **Teilaufgaben-Index:** Die Adressierung per Index bleibt. Ist der gezeigte Stand veraltet, trifft das Entfernen schon heute die falsche Teilaufgabe. Rückgängig heilt das, löst es aber nicht.
- **Blob im Tab:** bis 50 MB Arbeitsspeicher, solange der Hinweis lebt.
- **Nur dieser Tab:** Rückgängig gibt es nur im Tab, der entfernt hat. Ein Reload verliert es.

### Pre-Mortem

| Gescheitert, weil … | Gegenmaßnahme |
|---|---|
| Ein Agent hat die Teilaufgabe zwischendurch verschoben, und Rückgängig setzt an die alte Position | Position ist ein Wunsch, kein Zwang. Das Ergebnis ist eine Teilaufgabe mehr, nichts überschrieben. Der Test „Nebenläufigkeit“ prüft das |
| Großer Anhang: das Lesen vor dem Löschen dauert spürbar | Das Löschen wartet auf den GET mit Ladezustand am ✕. Wird das zum Problem, Rückfall Option C nur für Anhänge |
| Der Toast verschwindet hinter der Bildschirmtastatur ([ADR-0016](0016-fenster-folgen-dem-sichtbaren-bereich.md)) | Bei offenem Fenster liegt er im Dialog (Regel 5) und folgt damit `.mod-bg`. Ohne Fenster ist keine Tastatur offen |
| Doppelklick auf „rückgängig“ legt doppelt an | Der Hinweis wird vor dem Senden geleert (wie heute); Zeit und Board ergeben 409; die Teilaufgabe ist durch das Leeren geschützt |
| Rückgängig nach Seitenwechsel trifft das falsche Board | Der `slug` steht im `undo`, nicht der aktuelle Board-Kontext |

## Offene Fragen

- **PO:** Soll „Herkunft entfernen“ (`herkunft-weg`, `web/app.js:1226`) mit in die Karte? Gleiches Muster, aber nicht in der Karte genannt.
- **PO:** Positionstreue beim Wiederauflegen und bei Teilaufgaben ist hier Soll (Regel 4). Die Abnahme-Probe der Karte verlangt nur „Liegt auf“. Empfehlung: Positionstreue gehört dazu.

## Quellen / Bezüge

- Code: `web/app.js:416`, `:483`, `:896`, `:963`, `:1014–1030`, `:1208–1252`, `:1710`, `:2275`; `web/ansicht.js:300`, `:312`, `:324`, `:737–740`, `:758`; `web/kd-app.css:486`, `:533–539`; `src/dienst/zuordnung.rs`, `teilaufgaben.rs`, `zeiten.rs`, `anhaenge.rs`; Upload-Grenze `src/web/mod.rs:117`
- Modell: [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md), [A00003 Web-Schicht](../Architektur/A00003-web-schicht.md), [A00004 Dienste](../Architektur/A00004-dienste.md), [X00001](../Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md)
- ADRs: [0002](0002-zugregeln-gemeinsam-vor-der-aktion.md), [0005](0005-zusammengesetzte-aktionen-in-einem-commit.md), [0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md), [0011](0011-farbrollen-in-paaren-kontrast-als-probe.md), [0012](0012-zielgroessen-als-zentrales-mass-mit-messprobe.md), [0014](0014-nur-die-neueste-antwort-wird-uebernommen.md), [0015](0015-meldungen-und-aktionen-ueberstehen-jede-breite.md), [0016](0016-fenster-folgen-dem-sichtbaren-bereich.md)

## Nachtrag 2026-11-08 N1: Hinweis unter Zuständige und Hilfe (R00112)

**Anlass**: Architektur-Review zu Karte #12 (R00112), Befund S1. Regel 5 nennt den „obersten modalen Dialog“. Sie sagt nicht, was gilt, wenn dieser Dialog Zuständige (`#zuweisen`) oder Hilfe (`#hilfe`) ist. Beide liegen im Dialogstapel über Fenster, Neu und Defekt (`web/fokus.js:41–48`). Ein Hinweis kann dort stehen, wenn er vor dem Öffnen entstanden ist; er lebt 8 s. Die Wahl, Option A, gilt unverändert; der Status bleibt `Akzeptiert`.

**Belegt (Code, kanbanD Zweig `karte/12`, `9d246a3`)**:
- `hinweisDialog()` (`web/ansicht.js:738–742`) nimmt den obersten modalen Dialog aus `ebenen(S.ui)`. Einen Anker zwischen Körper und Fuß bekommen nur Fenster, Neu und Defekt (`dialogMitHinweis`, `:745–751`). Für Zuständige und Hilfe liefert sie `null`, und der Hinweis steht wie ohne Fenster unten über allem in `#over` (`vHinweis`, `:758–760`).
- Die Ablehnung eines Rückgängig geht nur dann in den Fuß über `fensterMelden`, wenn das Aufgabenfenster oberster Dialog ist. Sonst steht sie im Hinweis (`web/app.js:539–545`, Commit `0cab278`, Test „US-7 Gegenfall unter der Hilfe“ in `e2e/tests/r00112-rueckgaengig.spec.js:280`).
- Strg+Z: unter der Hilfe erreicht die Taste den Rückgängig-Zweig (`web/app.js:1888`, `:1891–1896`). Unter Zuständige endet sie in `zuweisenTaste` (`:1890`, `:634–637`), Strg+Z wirkt dort nicht. Das ist aus dem Code gelesen und nicht geprobt.

### N1 Regel 5, Ergänzung

**Entschieden**:
1. „Oberster modaler Dialog“ in Regel 5 heißt: oberster modaler Dialog **mit Hinweis-Anker**. Anker haben Aufgabenfenster, „Neue Aufgabe“ und „Defekte Datei“. Zuständige und Hilfe bekommen keinen Anker.
2. Ist Zuständige oder Hilfe oberster Dialog, steht der Hinweis unten über allem wie ohne Fenster. Er ist sichtbar und per Maus bedienbar (`#over` ist nicht inert, z-index 70 über `.mod-bg` 40). Er liegt aber außerhalb von `aria-modal`. Das ist der Zustand, den ADR-0017 im Kontext für alle Fenster als Mangel benannt hat; hier wird er bewusst hingenommen.
3. Die Ablehnung eines Rückgängig steht im Fuß nur, wenn das Aufgabenfenster oberster Dialog ist, sonst im Hinweis. Ein verdeckter Fuß ist kein Meldungsort (ADR-0015 Regel 1).
4. Unter Zuständige gilt Strg+Z nicht. Das Fenster hat eigene Tasten (Esc, Enter) und ist ein kurzer Auswahlschritt.

**Begründung**: Zuständige und Hilfe lösen selbst kein Entfernen aus. Ein Hinweis darunter ist also immer der Rest einer Aktion vor dem Öffnen und lebt noch höchstens 8 s. Ein Anker in zwei weiteren Dialogen brächte Markup, Abstand und Fokusfreihaltung (`hinweisEinpassen`, `web/app.js:550–553`) für einen seltenen Fall. Schließt man die Hilfe, steht der Hinweis wieder im Fenster darunter.

**In Kauf genommen**: Unter Zuständige und Hilfe ist „rückgängig“ für Screenreader und per Tab nicht erreichbar, solange der Dialog offen ist. Unter Zuständige gibt es auch kein Strg+Z.

**Durchsetzung**:
- Test „US-7 Gegenfall unter der Hilfe“ (`e2e/tests/r00112-rueckgaengig.spec.js:280`): die Ablehnung steht im Hinweis obenauf, nicht im Fuß.
- Kippt die Annahme „Zuständige und Hilfe entfernen nichts“, weil eines der beiden eine entfernende Aktion bekommt, braucht es einen Anker. Dann ist das ein Review-Punkt des `architektur-reviewer`: `dialogMitHinweis` gegen jede neue Aktion mit `undo` prüfen.

