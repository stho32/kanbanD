# ADR-0041: Laufansicht — gzip im Strom lesen mit Grenze, einmal zeichnen, Einträge als Insel; Adresse `…/aufgabe/<nr>/lauf?kennung=`, aufgelöst nur über die Einträge der Aufgabe

**Status**: Akzeptiert. Der erste Test des Baus ist die API-Probe zu Punkt 1 (Kennung mit `/` in der Adresse). Offen sind nur zwei Wortlaute innerhalb des gezeichneten Fehlerbilds, sie gehen an den PO (Punkt 6). An der Technik ändern sie nichts.
**Datum**: 2026-11-21
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #210, Lauf 210-architekt-1)
**Kontext-Anforderung**: — (Karte #210, nach dem Feinschnitt nur Scheibe D2 „Laufansicht“; die Anforderung schreibt der planer). Bezug: po-entscheidungen Z. 371, 372, 374, 468, 472, 475, 481; ADR-0029, ADR-0030, ADR-0032 Punkt 10, ADR-0033 Punkte 1–4 und 8, ADR-0036 Regel 5 und 7 mit Nachtrag G7, ADR-0039 Punkt 9 und Nachtrag N1; Zeichnung D0009 `#laufansicht` (freigegeben, Z. 475)
**Erprobt durch**: Messprobe 2026-11-21 10:11 Uhr, Last 2,1–3,3 bei 8 Kernen, `nice -n 10`, Chromium headless aus `e2e/node_modules` (Playwright 1.65.1), Fenster 1280 × 900. Die Transkripte stammen aus 150 echten Läufen der Factory, grob in das neutrale Format gewandelt (Skripte in der Ablage der Factory `gemeinsam/scratchpad/arch-210/`, Wegwerf). Adresse, Navigation und Insel sind am Code gelesen (Stand `4c6fb093`), nicht gefahren.

## Kontext

- **Belegt (Code)**:
  - `GET /api/aufgaben/{nr}/transkripte/{kennung}` liefert die gz-Datei als `application/gzip` ohne `Content-Encoding` und mit `Content-Disposition: attachment`. Der Browser entpackt also nicht von selbst, die Seite entpackt mit `DecompressionStream('gzip')`. Unbekannte Kennung → 404, Zustand ≠ `vorhanden` → 404 `{fehler, zustand}`, Antwortbudget voll → 503 (ADR-0036 Regel 5, G7). Die 404-Meldung nennt die Kennung (`src/dienst/transkripte.rs:320`).
  - `a.transkripte` trägt `[{kennung, at, role, column, bytes}]` ohne Zustand und ohne Dateizugriff (ADR-0036 G8). Die Kosten stehen in `a.kosteneintraege`, die Zusammenführung leistet `laeufe()` (`web/laeufe.js`, ADR-0039 Punkt 1).
  - Die Review-Seite ist das Vorbild für eine eigene Sicht hinter `/aufgabe/<nr>`: eigene Lesefunktion in `web/adresse.js` mit `nummer: null` (`:21–39`), `pushState` mit Marke, Rückweg über `history.back()` oder `replaceState` (`web/app.js:1078`, `:1725`), stehender Knoten über `hauptbereichErsetzen(…, inselVorher)` (`web/app.js:1737`), zwei Fristen für den Diff (`DIFF_FRIST_KOPF_MS`/`…_RUMPF_MS`, `:1081`).
  - Fremder Text: `markdownHtml` maskiert zuerst (ADR-0030). `sichtbarTeile`/`sichtbarHtml`/`sichtbarText` in `web/diff.js:62–196` machen Bidi- und Steuerzeichen sichtbar, je Zeile. „Läufe“ entfernt Bidi-Zeichen in Rolle und Spalte (`ohneSteuerzeichen`, ADR-0039 Punkt 4).
  - Format je Zeile (PO Z. 371): `{zeit?, art: nachricht | werkzeugaufruf | werkzeugergebnis, wer: mensch | agent | werkzeug, name?, text}`.
- **Gemessen (Probe)**:

  | Transkript | gz | entpackt | Zeilen | Lesen | HTML | DOM + Layout | DOM mit `content-visibility: auto` je Eintrag |
  |---|---|---|---|---|---|---|---|
  | größter von 150 echten Läufen | 336 KB | 1,6 MB | 856 | 19–42 ms | 13–17 ms | 70–112 ms | 33 ms |
  | zusammengesetzt | 2,4 MB | 9,9 MB | 5.247 | 111–131 ms | 123–156 ms | 1.382–1.519 ms | 196 ms |
  | zusammengesetzt, Grenze 20 MiB | 10 MB | 21 MB (abgebrochen) | 10.954 | 381–463 ms | 218–318 ms | 2.425 ms | 379 ms |
  | Bombe ohne Grenze | 643 KB | 500 MB | 5.000 | 1.562 ms | 352 ms | 2.042 ms | — |

  Die echten Läufe: Median 72 KB gz und 131 Zeilen, der größte 336 KB gz, 1,6 MB entpackt, 856 Zeilen, die längste Zeile 45 KB.
- **Gemessen (Probe), Fehlerfälle in Chromium**:
  - Abgeschnittene Datei: 97 Zeilen kommen an, dann `TypeError: Compressed input was truncated.`
  - Prüfsumme falsch: Die Datei ist bis zum Ende entpackbar. Es kommen aber nur 45 von 856 Zeilen an, dann `incorrect data check`. Beim Fehler verwirft der Strom, was noch in der Warteschlange stand. **Wie viel vor einem Fehler ankommt, hängt von der Stückelung ab und ist nicht der lesbare Teil der Datei.**
  - Beschädigte Mitte: keine Zeile, sofort ein Fehler.
  - **Zwei gzip-Glieder hintereinander** (`cat a.gz b.gz`, `gzip.open(…, 'ab')`): Chromium bricht nach dem ersten Glied ab mit `Junk found after end of compressed data`. Node 20 liest beide Glieder, `zcat` auch. Der Server prüft nur die Kennbytes und nimmt solche Dateien an.
- **Lastprofil** (`AI-Team/factory.md`, „Wissen“): Es betrifft hier nur „Live < 1 s“ und „lesend p95 < 200 ms“. Am Server ändert sich nichts, die Auslieferung läuft über das Antwortbudget (ADR-0036 Regel 6). Für das Zeichnen im Browser nennt das Lastprofil nichts.

Qualitätsziele (Szenarien mit Maß):

- **Q1 Begrenzt**: Eine gz-Datei bis 10 MB mit beliebigem Inhalt (auch eine Bombe) hält Speicher und Zeit des Tabs begrenzt. Ab der Grenze wird nicht weiter entpackt, und die Anfrage wird abgebrochen.
- **Q2 Nie still, nie falsch**: Eine defekte Zeile steht mit ihrer Zeilennummer an ihrer Stelle. Eine defekte Datei zeigt nie einen zufälligen Teil als vollständiges Transkript.
- **Q3 Fremder Text bleibt Text**: `<script>`, Markdown-Links mit `javascript:` und Bidi-Zeichen aus dem Transkript führen nichts aus und verstecken nichts.
- **Q4 Live billig**: Ein Live-Ereignis des Boards, während die Laufansicht offen ist, ersetzt die Einträge nicht. Der Knoten bleibt, und die aufgeklappten Werkzeugaufrufe bleiben offen.
- **Q5 Schnell für echte Läufe**: Ein Lauf in der Größe der echten Läufe (≤ 1,6 MB entpackt) steht in < 300 ms nach der Antwort.

## Optionen

### Lesen

| Variante | Stärke | Schwäche |
|---|---|---|
| G — ganz: `new Response(strom).text()`, dann zerlegen | am wenigsten Code | keine Grenze vor dem Ende: eine Bombe von 643 KB wird zu 500 MB Text im Tab (Probe), verfehlt Q1 |
| **S1 — im Strom lesen, Zeilen zählen, an der Grenze abbrechen, einmal zeichnen, wenn der Strom sauber endet oder die Grenze erreicht ist** (gewählt) | Q1 mit einer Grenze vor dem Speicher; die Zeilennummer ist beim Lesen bekannt; nur die gezeichneten Zustände „lädt“ und „Grenze erreicht“, weil vor dem Ende nichts gezeigt wird | ein Fehler am Ende (Prüfsumme) verwirft auch das schon Gelesene |
| S2 — im Strom lesen und schrittweise zeichnen | erste Einträge früher sichtbar | Ein Fehler mitten im Strom wäre ein neuer sichtbarer Zustand (Z. 475). Er zeigte einen Teil, der nach der Probe vom Zufall der Stückelung abhängt, nicht von der Datei (verfehlt Q2). Bei echten Läufen (≤ 150 ms) gewinnt man nichts |
| S3 — Server entpackt und liefert JSON | eine Prüfung am Server, Grenze serverseitig | gegen Z. 375/387 (kein Entpacken am Server, keine gzip-Abhängigkeit im Baum) |

### Zeichnen

| Variante | Stärke | Schwäche |
|---|---|---|
| Z1 — Einträge in `render()` aus dem Zustand neu bauen wie jede Ansicht | ein Weg | jedes Live-Ereignis baut bis zu 16 MiB HTML neu (Probe: bis 2,4 s), aufgeklappte Aufrufe klappen zu (verfehlt Q4) |
| **Z2 — Liste der Einträge als Insel: einmal je erfolgreichem Lesen eingesetzt, danach derselbe Knoten, solange Aufgabe und Kennung gleich sind; jeder Eintrag mit `content-visibility: auto`** (gewählt) | Live kostet nur Kopf und Leiste; Klappen, Textauswahl und Leseposition bleiben; Muster wie ADR-0033 Punkt 4 und ADR-0039 N1; mit `content-visibility` gemessen 7- bis 8-mal schneller als ohne | dritter Ort mit gehaltenem Knoten; ein frischer Aufbau (Zurück, Neuladen) klappt alles zu |
| Z3 — Virtualisierung | konstante DOM-Größe | Strg+F, Textauswahl und Bildschirmleser verlieren Einträge; aus denselben Gründen für D1 verworfen (ADR-0039 N1, Variante C) |

### Adresse

| Variante | Stärke | Schwäche |
|---|---|---|
| **A1 — `#/board/<slug>/aufgabe/<nr>/lauf?kennung=<kodiert>` und `#/aufgaben/aufgabe/<nr>/lauf?kennung=…`; aufgelöst nur durch Vergleich mit `a.transkripte`** (gewählt) | wie die Review-Seite (ADR-0033 Punkt 1, ADR-0029 „nur hinter `/aufgabe/<nr>`“); Deep-Link; die Kennung aus der Adresse erreicht weder Pfad noch Anfrage, nur eine gespeicherte Kennung tut das | Ein von Hand getipptes `+` wird zum Leerzeichen (Formulardekodierung) und findet den Lauf nicht |
| A2 — Index der Zeile (`…/lauf/3`) | kurz, ohne Kodierung | Der Index verschiebt sich bei neuen Läufen, Lesezeichen zeigen auf fremde Läufe |
| A3 — keine Adresse, nur Zustand im Fenster | kein Adressteil | gegen Z. 372 („Vollansicht mit eigener Adresse“) |

## Entscheidung

**Gewählt: S1, Z2, A1.** In Kauf genommen: Eine Datei mit falscher Prüfsumme oder mit zwei gzip-Gliedern zeigt nur die Fehlermeldung, auch wenn der größte Teil lesbar wäre. Ein frischer Aufbau klappt die Werkzeugaufrufe wieder zu.

1. **Adresse und Auflösung** (erweitert ADR-0029 hinter `/aufgabe/<nr>`, wie ADR-0033 Punkt 1):
   - Die Formen sind `#/board/<slug>/aufgabe/<nr>/lauf?kennung=<encodeURIComponent(kennung)>` und `#/aufgaben/aufgabe/<nr>/lauf?kennung=…`. Eine eigene reine Lesefunktion in `web/adresse.js` liefert `sicht: 'lauf'` mit `lauf: {basis, nummer, kennung}`, und `nummer` der Adresse bleibt `null` wie bei `review`. Dazu kommt eine Bildefunktion `laufAdresseBilden`.
   - Die Kennung aus der Adresse ist nur ein Suchtext: höchstens 100 Zeichen, ohne Steuerzeichen, sonst `null`. Sie wird **nur als Text verglichen** mit den `kennung` in `a.transkripte`. Angefragt wird mit der **gespeicherten** Kennung des Treffers, kodiert mit `encodeURIComponent`. Ohne Treffer geht keine Anfrage hinaus, und die Seite zeigt das Fehlerbild nach Punkt 6 mit einem festen Text, nie den Text der Adresse (ADR-0029 Regel 3).
   - **Erster Test des Baus (API, Rust)**: Eine Rolle mit `/`, Leerzeichen, `%` und `?` (etwa `a/b c%?`) wird abgelegt. `GET …/transkripte/<encodeURIComponent(kennung)>` liefert 200 und dieselben Bytes. Heute ist das nicht belegt, belegt ist nur `+` → `%2B` (`tests/transkripte_api.rs:430`). Scheitert der Test bei `%2F`, kommt die Frage an den architekten zurück. Die Abhilfe läge dann am Server (Pfadsegment dekodieren), nicht in der Seite.
2. **Einstieg und Rückweg** (ADR-0039 Punkt 9, Übergabe von B1131):
   - Nur Zeilen von „Läufe“ mit `transkript.zustand === 'vorhanden'` tragen „Ansehen“ als echtes `<a href>` auf die Laufadresse. Ein einfacher Linksklick ohne Umschalt- und Steuertaste läuft über `act` und schreibt `history.pushState` mit einer eigenen Marke (wie `REVIEW_AUS_DER_LISTE`). Mittelklick und „In neuem Tab öffnen“ bleiben Links. „Ansehen“ ist Teil der D1-Insel (ADR-0039 N1, Schlüssel ist ihr HTML), und es gilt die Fokusregel der Review-Insel (N1 Punkt 4).
   - Rückweg „‹ #<nr>“: mit Marke `history.back()`, ohne Marke (Link, Lesezeichen) `replaceState` auf die Adresse des Fensters mit der Ansicht „Läufe“. Danach liegt der Fokus auf dem „Ansehen“ derselben Kennung, sonst auf der Überschrift von „Läufe“, nie auf `body` (wie `fokusNachListe`).
3. **Leiste ohne eigenes Lesen**: Kopf und Leiste kommen aus dem Stand der Aufgabe, und zwar aus der Zeile von `laeufe(a.transkripte, a.kosteneintraege)` mit dieser Kennung (Rolle, Zeitpunkt, Spalte samt Nebentext, Betrag, Größe aus `bytes`). Es gibt keinen Aufruf von `GET …/transkripte`. Rolle und Spalte werden behandelt wie in D1 (`ohneSteuerzeichen`, `esc`). Kopf und Leiste zeichnen bei jedem Live-Ereignis neu, ein neuer Kosteneintrag erscheint also live.
4. **Lesen im Strom (S1)**:
   - Die Anfrage geht an `GET /api/aufgaben/{nr}/transkripte/{kennung}`. Es gelten dieselben Fristen wie für den Diff: 15 s bis zum Kopf, 60 s für den Rumpf. Abgebrochen wird mit `AbortController`. Die Frist-Mechanik von `diffHolen` wird dafür geteilt, nicht kopiert. Jede Anfrage trägt ein eigenes Lauf-Objekt in `S.ui.lauf`, und eine Antwort gilt nur, solange genau dieses Objekt der laufende Lauf ist (Lehre #209, ADR-0014). Verlassen der Sicht, ein Wechsel der Kennung oder „Erneut versuchen“ brechen die laufende Anfrage ab.
   - `antwort.body` → `DecompressionStream('gzip')` → Bytes zählen → `TextDecoder` (nicht fatal, ungültiges UTF-8 wird U+FFFD) → zerlegen **nur an `\n`**, Zeilen ab 1 gezählt. Ein `\r` am Zeilenende stört nicht, weil `JSON.parse` Leerraum duldet. U+2028 im Text trennt keine Zeile. Eine Zeile nur aus Leerraum wird übersprungen, zählt aber mit. Ein Rest ohne `\n` am sauberen Ende ist die letzte Zeile.
   - **Grenze**: höchstens **16 MiB entpackt** (16.777.216 Byte, gezählt vor dem Dekodieren) **und höchstens 20.000 Zeilen**. Was zuerst erreicht ist, beendet das Lesen. Der Leser wird abgebrochen (`cancel`, dazu `abort`, das gibt das Budget des Servers frei), eine angefangene Zeile entfällt, und unter den Einträgen steht „Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.“ (Wortlaut 15) statt „Ende des Transkripts“. Begründung: 10-mal der größte echte Lauf. Gemessen sind an der Grenze ≈ 0,4 s Lesen, 0,3 s HTML und 0,4 s DOM mit `content-visibility`. Die Zahl steht nicht in der Oberfläche (Z. 468), sondern als Konstante in `web/lauf.js`.
   - **Zeile prüfen**: Gültig ist ein Objekt mit `art` ∈ {`nachricht`, `werkzeugaufruf`, `werkzeugergebnis`}, `wer` ∈ {`mensch`, `agent`, `werkzeug`} und `text` als Text. Gibt es `zeit` und `name`, müssen sie Text sein. Unbekannte Schlüssel werden übergangen. Alles andere (kein JSON, falsche Form) wird ein Eintrag „Zeile <n> des Transkripts ist nicht lesbar.“ (Wortlaut 17) an seiner Stelle, die Nachbarn bleiben. `zeit` ist ein Zeitpunkt nach ISO 8601 mit Versatz oder `Z`, Sekunden sind erlaubt, gezeigt wird `hh:mm:ss` in Ortszeit. Eine `zeit` in anderer Form entfällt wie eine fehlende (Zeichnung: „Fehlt zeit oder name, fällt die Angabe weg“). Rohtext wird nie gezeigt.
   - **Gezeichnet wird einmal**, wenn der Strom sauber endet oder die Grenze erreicht ist. Bis dahin steht „lädt“ (Bild 2). **Jeder Fehler vor diesem Punkt** ergibt das ganzseitige Fehlerbild (Bild 5, Punkt 6), und das schon Gelesene wird verworfen. Das gilt für Netz, Frist und Entpacken, auch bei einer falschen Prüfsumme am Ende und bei zwei gzip-Gliedern. Damit gibt es keinen Zustand „Fehler mitten im Strom“, und es bleibt bei den gezeichneten Zuständen (Merkposten Z. 475). Der ganzseitige Fehler steht nur, solange kein Eintrag **gezeigt** ist.
5. **Zeichnen (Z2) und fremder Text**:
   - Die Liste der Einträge (`ol`) ist eine Insel mit fester `id` (z. B. `lv-insel`). Der Schlüssel `nr + kennung + Lauf-Objekt` liegt in `S.ui.lauf`, nicht im DOM. Das HTML entsteht einmal je erfolgreichem Lesen und wird einmal eingesetzt, danach fällt der Text aus dem Zustand. `render()` setzt einen Platzhalter derselben `id`, und `hauptbereichErsetzen` lässt den alten Knoten stehen, solange der Schlüssel gleich ist (Wurzel `#main`, wie die Review-Insel). Kein Ab- und Einhängen (ADR-0039 N1 Punkt 6). Auf- und Zuklappen der Werkzeugaufrufe ist reiner DOM-Zustand (`details`), er bleibt in der Insel und wird nicht gemerkt.
   - Jeder Eintrag trägt `content-visibility: auto` mit `contain-intrinsic-size: auto <Schätzung>` (wie die Blöcke in ADR-0033 Punkt 5). Strg+F findet weiter alles.
   - **Nachricht**: `text` je Zeile (an `\n` zerlegt) durch `sichtbarText` (Bidi- und Steuerzeichen sichtbar, `web/diff.js`), wieder mit `\n` verbunden, dann `markdownHtml` (ADR-0030: erst maskieren, feste Elemente, Adressen nach Positivliste). `<script>` bleibt Text.
   - **Werkzeugaufruf und -ergebnis**: `summary` mit `name` (durch `sichtbarText` und `esc`) und der ersten Zeile von `text`, gekürzt auf 200 Zeichen. Aufgeklappt steht der ganze `text` in `pre`, je Zeile durch `sichtbarHtml` (Marken wie im Review), nie durch Markdown. Lange Zeilen brechen um (Zeichnung).
   - Grund für „sichtbar statt entfernt“ im Inhalt: Ein Transkript zeigt gelesenen Code und Befehle. Ein verstecktes Bidi-Zeichen dort ist derselbe Angriff wie im Review (ADR-0033 Punkt 8). Rolle und Spalte in Kopf und Leiste folgen D1.
   - Nur ein reines Modul `web/lauf.js` (Browser und Node, wie `web/laeufe.js`) liest und prüft die Zeilen und baut das HTML: `zeilenLesen(strom, grenzen)` als async-Generator über Byte-Stücke, `eintragPruefen(objekt)` und `laufHtml(eintraege, …)`. `web/app.js` hält nur Sicht, Anfrage, Insel und Fokus.
6. **Zustände und Meldungen** (nur gezeichnete Bilder, Z. 475):
   - `fehlt`, also 404 mit `zustand: 'fehlt'`: Bild 4 „Das Transkript liegt nicht auf diesem Rechner.“, ohne „Erneut versuchen“.
   - Jeder andere Fehler ist Bild 5 mit „Erneut versuchen“: HTTP-Fehler mit `fehler` des Servers und Status (Wortlaut 19, auch 404 mit `zustand` `abweichend` oder `unlesbar`, auch 503 Antwortbudget), ohne Verbindung oder bei abgelaufener Frist „…: keine Verbindung zum Programm.“ (bzw. Frist wie `diffHolen`).
   - **Zwei Wortlaute fehlen noch in Wortlaut 19** (Frage an den PO, nicht blockierend): (a) Entpacken scheitert (Status 200, die Meldung des Browsers ist englisch und je Browser anders). Empfehlung: „Das Transkript ließ sich nicht lesen: Die Datei lässt sich nicht entpacken.“ (b) Die Kennung der Adresse steht nicht an der Aufgabe, es geht also keine Anfrage hinaus. Empfehlung: „Das Transkript ließ sich nicht lesen: An dieser Aufgabe steht kein Lauf mit dieser Kennung.“ Beide ohne Status, mit „Erneut versuchen“ wie gezeichnet. Bis zur Antwort gelten diese Empfehlungen. Keine automatische Wiederholung (ADR-0033 Punkt 7).
   - **Genau eine Ansage** (PO Z. 481): Die Fehlermeldung `lv_fehl` trägt kein `role="alert"` und kein `aria-live`. Angesagt wird nur im Statusbereich der Seite, gezählt mit `MutationObserver` wie R00219 AK 10.
7. **Live und Größe**:
   - Ein Live-Ereignis liest das Transkript nie neu. Die Datei zu einer Kennung ändert sich nicht, denn eine Kennung wird erst nach dem Löschen wieder frei. Wird der Eintrag gelöscht, während die Ansicht offen ist, bleibt das Gelesene stehen, bis die Seite verlassen wird (Inkauf).
   - Messung im Bau, als Beobachtung im Bericht und nicht im Gate (wie ADR-0039 N1 Punkt 5): Zeit von der Antwort bis zum gezeichneten Bild für den größten echten Lauf (Ziel < 300 ms, Q5) und für eine Datei an der Grenze (erwartet ≈ 1–1,5 s). Im Gate: Ein Live-Ereignis lässt die Insel stehen (Durchsetzung).

## Konsequenzen

**Positiv:**
- Keine Änderung am Server, an OpenAPI oder am Format. D2 ist eine reine Karte der Oberfläche plus ein API-Test.
- Eine Bombe oder eine riesige Datei kostet höchstens 16 MiB Text und etwa 1–1,5 s, nie den Tab.
- Es gibt nur die freigegebenen Zustände: keine neue Zeichnung, kein Rückweg an gestalter und PO außer zwei Wortlauten.
- Fremder Text geht über dieselben Wege wie im Review und in der Beschreibung (ADR-0030, ADR-0033 Punkt 8).

**Negativ / Inkauf:**
- Eine Datei mit falscher Prüfsumme, abgeschnittenem Ende oder zwei gzip-Gliedern zeigt nur den Fehler, auch wenn fast alles lesbar wäre. Ein Herunterladen gibt es in D2 nicht. Wer sie lesen will, nimmt `zcat` auf dem Rechner.
- **Zwei gzip-Glieder** lehnt Chromium ab, Node und `zcat` lesen sie. Die Factory (E2) muss je Lauf **ein** Glied schreiben. Ein Node-Test sieht diesen Fall nicht, er gehört in den E2E-Test.
- Bei Fehlern wartet der Mensch bis zum Ende des Stroms, ohne erste Einträge zu sehen. Bei echten Läufen sind das ≤ 150 ms.
- Ein frischer Aufbau der Seite liest neu und klappt alles zu.

**Durchsetzung:**
- Rust-API-Test nach Punkt 1 (Rolle mit `/`, Leerzeichen, `%`, `?`) als erster Test.
- Node-Tests `web/lauf.js`: Zeilennummern über Stückgrenzen hinweg, auch mit einem `\n` als letztem Byte eines Stücks und einem UTF-8-Zeichen über zwei Stücke. Eine defekte Zeile 3 von 5 ergibt vier Einträge und den Fehlereintrag „Zeile 3“ an Platz 3. Leerraumzeile zählt, ergibt aber keinen Eintrag. Falsche `art`, fehlendes `wer`, `text` als Zahl → defekt. Grenze genau 16 MiB → ganz gelesen, ein Byte mehr → „Grenze erreicht“. 20.000 und 20.001 Zeilen. Mutant „Grenze erst nach dem Dekodieren geprüft“ und Mutant „angefangene Zeile an der Grenze als defekt gezeigt“ sind rot. Fremder Text: `<script>` in Nachricht und Werkzeugtext, `[x](javascript:…)`, U+202E in `name` und in der ersten Zeile.
- E2E (Chromium, Antworten über `page.route`, gz mit `zlib` erzeugt): (a) abgeschnittene Datei, falsche Prüfsumme und **zwei Glieder** ergeben je das ganzseitige Fehlerbild ohne einen einzigen Eintrag. (b) Eine Bombe (≈ 600 KB gz, 500 MB entpackt) ergibt „Grenze erreicht“, die Route sieht den Abbruch, und der Tab bleibt bedienbar. (c) Insel hält: Marke am Knoten (`el.__probe = 1`), ein Werkzeugaufruf aufgeklappt, ein Kommentar an der Aufgabe und eine Änderung an einer anderen Karte. Die Marke ist da, der Aufruf offen, und es gibt kein zweites `GET …/transkripte/…`. Ein gebuchter Kosteneintrag ändert den Betrag in der Leiste, und die Marke bleibt. Mutant „Insel nie gehalten“ ist rot. (d) Adresse mit unbekannter Kennung: keine Anfrage (Zähler), festes Fehlerbild, der Text der Adresse steht nicht auf der Seite. (e) Rückweg mit und ohne Marke, `history.length` stapelt nicht, Fokus auf „Ansehen“. (f) Eine gehaltene Antwort, die nach dem Verlassen der Seite kommt, zeichnet nichts. (g) Genau eine Ansage je Fehler (`MutationObserver`).
- Review-Punkt `security-reviewer`: Die Kennung aus der Adresse erreicht nur einen Textvergleich, Anfragen tragen nur gespeicherte Kennungen. Kein Text des Transkripts geht an `markdownHtml` oder `sichtbarHtml` vorbei ins HTML.
- Review-Punkt `architektur-reviewer`: Lesen und Prüfen nur in `web/lauf.js`, Fristen geteilt mit `diffHolen`, kein Neuzeichnen der Insel bei gleichem Schlüssel.

## Folgeentscheidungen / Aufgaben

- [ ] Anforderung über den planer (Punkte 1–7). Höchstens etwa zehn Kriterien. Grenzen und Mutanten gehören dem entwickler.
- [ ] PO: Wortlaute 6 (a) und (b), bis zur Antwort gelten die Empfehlungen. Der gestalter zieht die Notiz in `#laufansicht` nach (Z. 481 b), ohne neues Bild.
- [ ] Factory (E2, `/factory lehren`): Das Transkript je Lauf ist **ein** gzip-Glied (`gzip.compress` oder ein einmal geöffneter Schreiber, nie Anhängen an eine vorhandene gz-Datei) in UTF-8, eine Zeile je Eintrag nach Z. 371, `zeit` nach ISO 8601 mit Versatz oder `Z`.
- [ ] Modell nachführen nach dem Bau (A00009: Sicht `lauf`, Modul `web/lauf.js`, dritte Insel).

## Quellen / Bezüge

- po-entscheidungen Z. 371 (Format), 372 (Vollansicht), 374 (nie still), 375/387 (kein Entpacken am Server), 468, 472 (Wortlaute 14–19), 475 (Freigabe D2 und Merkposten), 481 (genau eine Ansage)
- ADR-0029, ADR-0030, ADR-0032 Punkt 10, ADR-0033 Punkte 1–5, 7, 8, ADR-0036 Regel 5–7 und G7/G8, ADR-0039 Punkte 4 und 9 sowie N1
- D0009 `#laufansicht` (Bilder 1–6 und Notizen)
- `web/adresse.js:21–39`, `web/app.js:1078–1110`, `:1725–1760`, `web/diff.js:62–196`, `web/laeufe.js`, `src/dienst/transkripte.rs:318–340`, `src/web/mod.rs:1395–1406`, `tests/transkripte_api.rs:430`
- Compression Streams: https://compression.spec.whatwg.org/ (abgerufen 2026-11-21). Das Verhalten bei Daten hinter dem Ende eines Glieds ist hier in Chromium und Node 20 geprobt, nicht aus der Spezifikation übernommen.

## Nachtrag 2026-11-22 N1: Auswertung des Laufs — Dauer, Denkzeit, Paare, Fehler, Bericht zuerst, Blättern; ohne Abschnitte und ohne neues Feld (Karte #251)

**Status bleibt `Akzeptiert`.** Karte #251 (Auftrag des Betreibers, Entwurf „Laufansicht – Vorschlag“) soll zwei Fragen beantworten: „War das ein sinnvolles Vorgehen?“ und „Was hat am längsten gedauert?“. Alles Neue wird **aus den gelesenen Einträgen gerechnet**. Format (PO Z. 371), Server und OpenAPI bleiben, wie sie sind. Punkte 1–7 gelten weiter.
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #251, Lauf 251-architekt-1)
**Erprobt durch**: Auswertung der 9 Transkripte an #247 (Instanz :7422, nur gelesen, 2026-11-22 06:25) mit Wegwerf-Skripten in der Ablage der Factory `gemeinsam/scratchpad/arch-251/`. Eine Messprobe in Node 20 lief bei Last 1,5–2,8 mit `nice -n 10`.

### Belegt (Probe an #247)

- In allen 534 Einträgen ist `zeit` gesetzt, die Zeitpunkte steigen monoton an. `name` steht nur an Aufrufen, **nie an Ergebnissen**.
- Es gibt 250 Aufrufe und 250 Ergebnisse. Fünfmal kommen zwei Aufrufe vor ihren Ergebnissen (`A A E E`), und die Ergebnisse folgen dann der Reihenfolge der Aufrufe.
- Die Aufteilung der Zeit zeigt, worauf es ankommt. Planer #247-1: 330 s gesamt, davon 270 s Denkzeit des Agenten und 60 s Werkzeug. Entwickler: 77 min gesamt, davon 72 min Werkzeug, vor allem Wartebefehle mit je etwa 180 s.
- Fünf Ergebnisse sind Fehler. Drei beginnen mit `Exit code <n>` (n = 144, 2, 1), zwei mit `<tool_use_error>`. Ergebnisse, die nur irgendwo „error“ enthalten, sind keine Fehler.
- **Commits stehen im Transkript nicht in fester Form**: `git commit -q` gefolgt von `git log --oneline`, ein Heredoc mit Commit. Fest steht dagegen der Bericht: Jeder der 9 Läufe hat einen Eintrag des Agenten mit der Zeile `Ergebnis: bestanden`. Sie steht im JSON-Text des letzten Aufrufs (`{"message": "Ergebnis: …"}`) oder in einer Nachricht. Diese Zeile gehört zum Vertrag der Factory (Schluss jedes Berichts mit `Ergebnis:` und `Commits:`).
- An der Karte stehen **Ergebnis und Commits nicht je Lauf**. `a.commits` gilt für die ganze Karte, `durchlaeufe` ist leer, und die Timer in `zeiten` tragen andere Kennungen (`arch@…` statt `architekt@…`). Die Kosten von #247 stehen nur in der Altform `cost.items`, mit dem Text „architekt (247-architekt-1)“ und ohne Kennung. `kosteneintraege` ist leer.
- Messprobe: `laufAuswerten` (Paaren, Lücken, Kategorien, Top 3, Kurzbefehl) läuft über 20.000 Zeilen (58 MB, also mehr, als die Bytegrenze zulässt) in **38–61 ms**.

### Optionen zu den Abschnitten (Technikfrage 2)

| Variante | Stärke | Schwäche |
|---|---|---|
| **W — weglassen; Zeitachse und Gliederung aus den Schritten** (gewählt) | kein neues Feld, keine Regel, die still falsch liegen kann; „was dauerte am längsten“ beantworten Top 3, Dauer je Zeile und die Aufteilung Werkzeug/Denken/Warten | weicht vom Entwurf ab (Abschnitte als Balken und in der Gliederung) — Frage an den PO |
| R — ableiten aus Werkzeugen und Pfaden (etwa „liest“, „baut“, „prüft“) | sieht aus wie der Entwurf | Die Regeln hängen am Projekt und an der Rolle. Ein falsch zugeordneter Abschnitt ist nicht zu erkennen (verfehlt Q2). Fast alle Aufrufe heißen `Bash`, und Agentennachrichten als Trenner gibt es nur 0–9-mal je Lauf |
| F — neues optionales Feld `abschnitt` im Format | sauber, wenn jemand es setzt | Auch der Erzeuger kennt keine Abschnitte, denn der Agent meldet keine. Das Feld bliebe leer oder würde ebenso geraten. Dazu kämen eine Änderung des Formats, ein Umwandler und Altbestand ohne das Feld |

Ein späteres Feld bliebe möglich, denn der Leser übergeht unbekannte Schlüssel schon heute (Punkt 4). Kommt es, gibt es dafür einen neuen Nachtrag.

### Entscheidung

1. **Dauer (Technikfrage 1).**
   - **Gesamtdauer**: Sie ist die Summe der Lücken zwischen aufeinanderfolgenden Einträgen mit gültiger `zeit` (Form nach Punkt 4). Eine negative Lücke zählt als 0.
   - Jede Lücke gehört **dem späteren Eintrag**. Vor einem Ergebnis ist sie **Werkzeug**, vor einem Eintrag von `agent` (Aufruf oder Nachricht) **Denken**, vor einer Nachricht von `mensch` **Warten**. Werkzeug, Denken und Warten ergeben so zusammen genau die Gesamtdauer, auch bei parallelen Aufrufen, und nichts wird doppelt gezählt.
   - **Ohne gültige `zeit`**: Der Eintrag hat keine eigene Dauer und zeigt „–“. Die Lücke vom vorigen zum nächsten Eintrag mit Zeit gehört dem nächsten. Haben weniger als zwei Einträge eine Zeit, zeigt der Kopf „Dauer unbekannt“, und es gibt weder Zeitachse noch Top 3.
   - **Grenze erreicht** (Punkt 4): Gerechnet wird nur über das Gelesene, und der Kopf kennzeichnet das. Er zeigt nie eine Dauer, die wie die des ganzen Laufs aussieht (Q2).
   - **Schrittzeile** (Aufruf mit Ergebnis): Ihre Dauer ist `zeit(Ergebnis) − zeit(Aufruf)`. Kommt ein Aufruf, bevor ein anderer sein Ergebnis hat, tragen beide die Marke „parallel“. Ihre Zeilendauern überlappen, der Kopf rechnet aber aus der Aufteilung oben.
   - **Denk- und Wartezeile**: Eine Lücke der Art Denken oder Warten ab **5 s** wird eine eigene Zeile vor dem Eintrag, etwa „21 s denkt“ oder „wartet“. Kürzere Lücken zählen nur in der Summe. Die Schwelle ist eine Konstante in `web/lauf.js`, Frage an den PO.
   - **Top 3**: Es zählen Schritt-, Denk- und Wartezeilen nach Dauer, bei Gleichstand die frühere zuerst. Gesprungen wird über einen Knopf mit `data-act` (`scrollIntoView` und Fokus auf die Zeile), **nie über `href="#…"`**, denn der Hash ist die Adresse der Seite (ADR-0029). Jede Zeile trägt `id="lv-s<Zeilennummer>"`.
2. **Abschnitte**: Variante W. Die **Zeitachse** zeigt die Folge der Lücken in den drei Arten. Benachbarte Lücken derselben Art verschmelzen. Sind es mehr als 200 Stücke, wird die Gesamtdauer in 200 gleiche Fächer geteilt, und jedes Fach bekommt die Farbe der Art, die darin überwiegt. Die **Gliederung links** besteht aus Top 3 und den Filtern Nachrichten, Werkzeuge, Systemhinweise und nur Fehler. Ein Filter ist ein Attribut an der Wurzel der Insel und wirkt nur über CSS. Die Insel bleibt also derselbe Knoten (Punkt 5, Q4). Der Zustand des Filters liegt in `S.ui.lauf` und wird nach einem frischen Aufbau wieder gesetzt.
3. **Paaren und Kurzbefehl (Technikfrage 3)**:
   - Ein Ergebnis gehört zum **ältesten offenen Aufruf** (Warteschlange je Lauf). Den Namen übernimmt das Ergebnis vom Aufruf. Ein Ergebnis ohne offenen Aufruf und ein Aufruf ohne Ergebnis stehen je allein, mit „–“ als Dauer.
   - `kurzbefehl(text)`: Ist `text` ein JSON-Objekt, gilt die erste Zeile des ersten Textwerts unter `command`, `file_path`, `pattern`, `url`, `query`, `prompt`, `message`, sonst die des ersten Textwerts überhaupt. Getrennt davon wird `description` als Absicht geliefert. Ist `text` kein Objekt, gilt die erste Zeile wie heute.
   - Gekürzt wird auf 200 Zeichen, und die Zeichen laufen über `sichtbarText` und das Budget wie in `ersteZeileHtml`. Was die Zeile zeigt (Befehl, Absicht oder beides), entscheidet die Gestaltung, Frage an den PO. Aufgeklappt stehen Aufruf und Ergebnis ganz, wie heute.
4. **Fehler (Technikfrage 4)**: `fehlerErkennen(ergebnistext)` ist wahr, wenn **die erste Zeile** `Exit code <n>` mit n ≠ 0 lautet oder der Text mit `<tool_use_error>` beginnt. Geprüft wird nur der Anfang des Texts, nie eine Suche nach „error“. Ein Fehler färbt die Schrittzeile rot und zählt im Kopf. Ein neues Feld gibt es nicht. Ein späteres optionales `fehler` wäre eine Ergänzung, die nichts bricht.
5. **Kennzahlen und Bericht (Technikfrage 5)**:
   - **Kosten** kommen aus der Karte: die Zeile von `laeufe(a.transkripte, a.kosteneintraege)` mit dieser Kennung, wie die Leiste (Punkt 3), also live. Die Altform `cost.items` wird nicht über ihren Text zugeordnet, denn das wäre brüchig. Ohne Kosteneintrag mit Kennung steht „–“.
   - **Ergebnis und Commits** stehen an der Karte nicht je Lauf (siehe Belegt). Sie kommen deshalb aus dem **Bericht**, und das ist der letzte Eintrag von `agent`, dessen Text eine Zeile `^Ergebnis: (bestanden|befund|blockiert)` enthält. Ist der Text eines Aufrufs ein JSON-Objekt, werden seine Textwerte durchsucht.
   - **Commits** zählen die Kennungen `\b[0-9a-f]{7,40}\b` in der Zeile `^Commits:` desselben Berichts. „keine“ ergibt 0, ohne Bericht steht „–“. Die **Zahl der Werkzeugaufrufe** und die Zahl der **Fehler** kommen aus der Auswertung.
   - **Ergebnis zuerst**: Der Bericht steht als Karte über den Einträgen und wird gezeichnet wie eine Nachricht (`sichtbarText`, dann `markdownHtml`, Budget). Ohne Bericht gibt es keine Karte, und das Ergebnis zeigt „–“.
   - **Auftrag und Systemhinweise eingeklappt**: Der Auftrag ist die erste Nachricht von `mensch`. Ein Systemhinweis ist eine Nachricht von `mensch`, deren Text ohne führenden Leerraum mit `<system-reminder>` oder `[SYSTEM NOTIFICATION` beginnt. Beide stehen als `details` an ihrer Stelle und sind über den Filter erreichbar.
   - **Blättern**: Die Läufe der Karte kommen aus `a.transkripte` und werden nach dem Zeitpunkt der Kennung **aufsteigend** geordnet (`kennungMs`, der älteste ist 1), ganz ohne Anfrage: „Lauf k von n“. Vor und zurück sind echte `<a href>` auf `laufAdresseBilden`. Ein einfacher Linksklick über `act` nimmt `replaceState`, damit `history.length` nicht wächst und „‹ #<nr>“ weiter auf „Läufe“ führt (Punkt 2). Der Wechsel der Kennung bricht die laufende Anfrage ab (Punkt 4). Ein Lauf ohne Datei zeigt Bild 4, denn der Zustand ist ohne `GET …/transkripte` nicht bekannt.
6. **Ort und Leistung (Technikfrage 6)**: Gerechnet wird im Browser. `laufAuswerten(zeilen)` steht in `web/lauf.js` und ist rein: ein Durchlauf, O(n), in Node testbar. Die Auswertung läuft **einmal je erfolgreichem Lesen** und liegt im Lauf-Objekt `S.ui.lauf` neben dem Text der Insel. Kopf, Kennzahlen und Zeitachse zeichnen bei Live aus dieser Auswertung und aus der Karte, die Auswertung wird dabei nie neu gerechnet. Schritt- und Denkzeilen gehören zur Insel. Die Messung nach Punkt 7 (Q5: < 300 ms für echte Läufe) wiederholt der Bau als Beobachtung.

**In Kauf genommen**: Fehler, Auftrag, Systemhinweise und Bericht werden an Formen erkannt, die der heutige Erzeuger (Claude Code und der Umwandler der Factory) schreibt. Ein anderer Erzeuger ergibt dann „0 Fehler“ und „–“, und der Wortlaut muss das als „erkannt“ kennzeichnen. Auch die Paarung setzt voraus, dass Ergebnisse in der Reihenfolge der Aufrufe stehen. Die Zeitachse zeigt keine fachlichen Abschnitte.

### Durchsetzung

- Node-Tests `laufAuswerten` (`e2e/einheit/`):
  - Werkzeug + Denken + Warten = Gesamtdauer, bei `A A E E` ohne Doppelzählung.
  - Fehlende und falsch geformte `zeit` mitten im Lauf; eine negative Lücke; weniger als zwei Zeitpunkte ergeben „unbekannt“.
  - Ein Ergebnis ohne Aufruf und ein Aufruf ohne Ergebnis.
  - Die Denkzeile genau ab 5 s (4.999 ms ergibt keine).
  - Top 3 mit Gleichstand; 201 Stücke ergeben 200 Fächer.
  - `fehlerErkennen`: `Exit code 0` ist kein Fehler, `Exit code 2` ist einer, „error“ mitten im Text ist keiner, `<tool_use_error>` am Anfang ist einer.
  - Bericht: im JSON eines Aufrufs; `Ergebnis:` nur mitten in einer Zeile wird nicht erkannt; `Commits: keine` ergibt 0.
  - `kurzbefehl`: JSON mit `command`, Nicht-JSON, JSON ohne bekannten Schlüssel.
- E2E:
  - Top 3 springen, `location.hash` bleibt gleich, der Fokus liegt auf der Zeile.
  - Ein Filter lässt die Marke an der Insel stehen (`el.__probe`).
  - Ein gebuchter Kosteneintrag ändert die Kosten im Kopf, und die Insel bleibt.
  - Blättern hält `history.length` gleich, „‹ #<nr>“ führt zu „Läufe“, und die vorige Anfrage wird abgebrochen.
- Review-Punkt `architektur-reviewer`: Gerechnet wird nur in `web/lauf.js` und nur einmal je Lesen, und `app.js` rechnet keine Dauer.
- Review-Punkt `security-reviewer`: Bericht, Kurzbefehl und Absicht gehen durch dieselben Wege wie bisher (`sichtbarText` und Budget, `markdownHtml`).

### Folgeaufgaben

- [ ] Planer: zwei Scheiben. **A „Ergebnis und Dauer“**: Punkte 1, 3, 4, 5 ohne Blättern, 6. **B „Überblick und Navigation“**: Zeitachse und Gliederung mit Filtern (Punkt 2) und Blättern. B braucht A.
- [ ] PO: Abschnitte entfallen gegenüber dem Entwurf; Schwelle der Denkzeile 5 s; Kurzbefehl als Befehl oder Absicht; Wortlaute für „Dauer unbekannt“, für die Dauer bis zur Grenze und für „keine Fehler erkannt“, für das fehlende Ergebnis und für „Lauf k von n“; Blättern aufsteigend.
- [ ] Gestalter: D0009 `#laufansicht` nach dem Entwurf nachzeichnen, ohne Abschnitte und mit der Zeitachse aus Werkzeug, Denken und Warten. Freigabe durch den PO.
- [ ] Director/Factory: Kosten je Lauf als Kosteneintrag **mit der Kennung des Transkripts** buchen (ADR-0028). Sonst bleibt „Kosten“ im Kopf leer, wie heute an #247.

### Nach dem Bau (2026-11-22, Lauf 251-architekt-2)

Ergänzt nach den Reviews an #251 (architektur-reviewer, rechtschreib-reviewer). Der Text oben bleibt stehen. Was hier steht, präzisiert ihn nach dem gebauten Stand (Zweig `karte/251`, `c39f4733`).

- **Zu Punkt 1, Zuordnung der Lücke (schließt R00234, Offene Frage 1):** Ein Ergebnis oder ein Eintrag mit `wer=werkzeug` ist **Werkzeug**, ein Eintrag von `agent` ist **Denken**, jeder andere Eintrag ist **Warten**. So ordnet `lueckenArt` (`web/lauf.js:299–303`) auch die Fälle zu, die Punkt 1 offen ließ: eine Nachricht von `werkzeug` zählt als Werkzeug, ein Aufruf von `mensch` als Warten. Damit ergeben die drei Teile für jede Folge von Einträgen genau die Gesamtdauer. Die Denk- oder Wartezeile heißt „<Dauer> denkt“ bzw. „<Dauer> wartet“ (PO Z. 518; `LUECKE_WORT`, `web/lauf.js:151`).
- **Zu Punkt 5, ohne Bericht:** Ohne Bericht steht an der Stelle der Karte die gedämpfte Zeile „Kein Bericht erkannt: Keine Nachricht des Agenten enthält eine Zeile ‚Ergebnis:‘.“ (PO Z. 520 (7); `KEIN_BERICHT`, `web/lauf.js:248`). Der Satz „Ohne Bericht gibt es keine Karte“ oben ist damit so zu lesen: keine Karte „Bericht“, aber diese Zeile. Das Ergebnis im Kopf zeigt weiter „–“.
- **Zu Punkt 6, einmal je Lesen (Fitness Function):** `grep -c "laufAuswerten(" web/app.js` ergibt genau 1 (heute `web/app.js:1999`). Ein Stolperstein ist der Standardwert in `laufHtml(zeilen, grenze, esc, auswertung = laufAuswerten(zeilen, grenze))` (`web/lauf.js:125`): Wer `laufHtml` ohne die vierte Angabe aufruft, rechnet die Auswertung still ein zweites Mal. Heute geben beide Aufrufer sie mit (`web/app.js:2000`, `:2091`). Der Review-Punkt des `architektur-reviewer` prüft deshalb auch, dass jeder Aufruf von `laufHtml` in `web/app.js` vier Angaben hat.
- **Zu Punkt 1, Sprung aus „Längste Schritte“ (Muster):** In einer Liste mit `content-visibility: auto` tragen die Einträge vor dem Ziel bis zu ihrem ersten Zeichnen nur die geschätzte Höhe (`contain-intrinsic-size`). Werden sie beim Rollen gemessen, rückt das Ziel nach einem einzigen `scrollIntoView` wieder aus dem Blick. Deshalb gilt: Nach dem Sprung wird das Ziel nachgeführt. Ruht seine Lage zwei Bilder lang, wird ohne Animation erneut an das Ziel gerollt, bis es auch danach ruht, höchstens etwa 2 s lang. Ein neuer Sprung oder eine Eingabe des Menschen beendet das Nachführen, und die Insel bleibt, wie sie ist (`laufZeileNachfuehren`, `web/app.js:2123`; Befund Entwicklertest #251, Nacharbeit 2 `c39f4733`). Das gilt für jeden Sprung in eine solche Liste, also auch für die Review-Seite (ADR-0033 Punkt 5).

## Nachtrag 2026-11-22 N2: Paaren über die Kennung des Aufrufs — Format um `id`, `zu` und `tokens` ergänzt, Warteschlange als Rückfall (Karte #262)

**Status bleibt `Akzeptiert`.** Karte #262 (Vorrang, Auftrag des Betreibers): Kommen die Ergebnisse paralleler Aufrufe in anderer Reihenfolge zurück, zeigt die Ansicht ein Ergebnis beim falschen Aufruf, denn N1 Punkt 3 paart über die Warteschlange. N2 ersetzt N1 Punkt 3, erster Spiegelstrich, und den Satz „Auch die Paarung setzt voraus …“ unter „In Kauf genommen“. Alles andere aus N1 gilt weiter, Server und OpenAPI bleiben, wie sie sind.
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #262, Lauf 262-architekt-1)
**Erprobt durch**: Zählung über 400 Claude-Protokolle der Factory aus den letzten 7 Tagen (nur Zeilen `user`/`assistant`, wie der Umwandler sie liest) und eine Messprobe der heutigen `laufAuswerten` in Node 20 (Stand `c3e928c2`, Last 1,1, `nice -n 10`). Die Wegwerf-Skripte liegen in der Ablage der Factory `gemeinsam/scratchpad/arch-262/`.

### Belegt

- **Code**: `eintragPruefen` (`web/lauf.js:64–69`) übernimmt nur `art`, `wer`, `text`, `zeit`, `name`, unbekannte Schlüssel fallen weg (R00221, Zeile 41). Gepaart wird in `aufrufOeffnen`/`ergebnisZuordnen` (`:390–410`). Der Server liest die gz-Datei nie zeilenweise (`src/dienst/transkripte.rs`), das Format betrifft nur `web/lauf.js` und den Erzeuger.
- **Erzeuger**: Der Umwandler der Factory schreibt seit Factory-Commit `89cb890` `id` an jeden Aufruf (`tool_use.id`), `zu` an jedes Ergebnis (`tool_result.tool_use_id`) und `tokens` `{ein, aus, cache_lesen, cache_schreiben}` (nur Werte über 0) an den ersten Eintrag einer Antwort des Agenten. opencode-Läufe legt die Factory heute nicht ab.
- **Häufigkeit**: In 400 Protokollen mit 21.927 Aufrufen gibt es 1.164 Gruppen paralleler Aufrufe. In **130 Fällen** paart die Warteschlange falsch, und das trifft **109 von 400 Läufen (27 %)**. Keine Kennung fehlt, keine ist doppelt, kein Ergebnis zeigt auf einen unbekannten Aufruf.
- **Altbestand**: Auf den Boards lagen bei der Zählung 49 Transkripte, alle vom 2026-11-22, und nur 2 davon tragen schon Kennungen. Die Rohprotokolle der übrigen liegen noch unter `~/.claude/projects/` (das älteste dort ist vom 2026-10-26, das passt zur Aufbewahrung von 30 Tagen, die Claude Code als Standard hat). Das Journal der Factory nennt den Pfad je Lauf.
- **Messprobe**: Das Beispiel der Karte (A, B, Ergebnis B nach 2 s, Ergebnis A mit `Exit code 1` nach 10 s) ergibt heute A 3 s, B 9 s, und der Fehler steht bei B. Richtig wäre A 10 s mit dem Fehler, B 2 s. Gesamtdauer und Werkzeuganteil sind in beiden Fällen gleich. Mit 10.000 offenen Aufrufen, deren Ergebnisse danach folgen, braucht `laufAuswerten` schon heute 185–253 ms, bei 1.000 sind es 13–20 ms. Die Zeit wächst quadratisch, weil `aufrufOeffnen` bei jedem Aufruf alle offenen durchläuft (`:392`).

### Optionen zum gemischten Transkript (Technikfrage 2)

| Variante | Stärke | Schwäche |
|---|---|---|
| **G1 — jeder Eintrag nach seinen eigenen Feldern; ein Ergebnis ohne `zu` nimmt den ältesten offenen Aufruf ohne `id`, gibt es keinen, den ältesten offenen überhaupt** (gewählt) | ohne Felder genau das Verhalten von heute; mit Feldern immer richtig; eine Lücke an einzelnen Einträgen verdirbt nicht den Rest | zwei Warteschlangen statt einer; ein Ergebnis ohne `zu` kann im gemischten Fall einen Aufruf mit `id` belegen, dessen eigenes `zu` dann allein steht |
| G2 — Schalter je Transkript: trägt irgendein Eintrag `id` oder `zu`, wird nur über Kennungen gepaart | eine Regel, leicht zu erklären | Ein Erzeuger, der `zu` nur manchmal schreibt, lässt jedes Ergebnis ohne `zu` allein stehen. Das ist schlechter als heute, und niemand sieht den Grund |
| G3 — Kennung nur als Prüfung: gepaart wird weiter über die Warteschlange, ein Widerspruch zu `zu` wird markiert | kleinste Änderung | Die Ansicht bleibt falsch und sagt es nur. Die Abnahme der Karte („A zeigt das Ergebnis von A“) verfehlt sie |

### Entscheidung

1. **Format (Technikfrage 1)**: Der Formatnachtrag zu PO Z. 371 lautet `{zeit?, art, wer, name?, id?, zu?, tokens?, text}`. Alle drei Felder sind optional, alte Transkripte bleiben gültig. **Ein falsch geformtes neues Feld gilt als fehlend, der Eintrag bleibt lesbar.** Das ist anders als bei `zeit` und `name`, bei denen die Zeile dann unlesbar wird. Der Grund: Die neuen Felder sind Hilfsangaben, und ein Fehler des Erzeugers darin soll den Text des Aufrufs nicht verdecken.
   - `id`: nur an `werkzeugaufruf`, ein Text mit 1–256 Zeichen (`length`). An anderen Arten fällt das Feld weg.
   - `zu`: nur an `werkzeugergebnis`, dieselbe Form. Es nennt die `id` des Aufrufs, zu dem das Ergebnis gehört.
   - Verglichen wird genau, Zeichen für Zeichen, ohne Trimmen und ohne Groß-/Kleinschreibung anzugleichen. Kennungen werden **nie gezeichnet** und nie Schlüssel eines einfachen Objekts. Die Zuordnung geht über eine `Map`, damit Kennungen wie `__proto__` nichts auslösen.
   - `tokens`: nur an Einträgen von `agent`, ein Objekt mit den Schlüsseln `ein`, `aus`, `cache_lesen`, `cache_schreiben`. Jeder Wert ist eine ganze Zahl ≥ 0 (`Number.isSafeInteger`). Ein falscher Wert oder ein unbekannter Schlüssel fällt weg, und bleibt keiner übrig, fehlt das Feld. Die Regel steht hier, damit #263 nicht noch einmal ans Format muss. **Gebaut wird sie erst mit #263**, und dort entscheidet sich auch die Anzeige. #262 liest `tokens` nicht, das wäre tote Flexibilität.
   - `eintragPruefen` liefert zusätzlich `id` und `zu` (sonst `null`). Unbekannte Schlüssel fallen weiter weg.
2. **Paaren (Technikfrage 2)**: Variante G1, in einem Durchlauf.
   - Ein **Aufruf mit `id`** wird unter seiner Kennung offen geführt. Hatte schon ein früherer Aufruf desselben Laufs diese `id` (**doppelte Kennung**), gilt die erste, und der spätere zählt als Aufruf ohne `id`.
   - Ein **Ergebnis mit `zu`** gehört zu dem offenen Aufruf mit dieser `id`. Gibt es keinen, weil die Kennung unbekannt oder ihr Aufruf schon gepaart ist, **steht das Ergebnis allein**, mit „–“ und dem Lesetext „kein Aufruf“, wie heute. Es greift dann **keine** Warteschlange, denn wo der Erzeuger eine Kennung nennt, wird nicht geraten.
   - Ein **Ergebnis ohne `zu`** gehört zum ältesten offenen Aufruf ohne `id`. Gibt es keinen, gehört es zum ältesten offenen Aufruf überhaupt. Ohne Felder ist das genau die Warteschlange von N1.
   - Ein Aufruf ohne Ergebnis steht allein, wie heute.
   - **„parallel“** bleibt, wie N1 es festlegt: Ein Aufruf ist parallel, wenn bei seinem Beginn ein anderer offen war oder vor seinem Ende ein anderer begann. Die Marke hängt nur an der Zahl der offenen Aufrufe und nicht daran, wer mit wem gepaart wird.
   - **Aufwand**: Gerechnet wird in O(n), auch im ungünstigsten Fall. Offene Aufrufe stehen in zwei Warteschlangen (alle und ohne `id`) mit Kopfzeiger und einer Marke „gepaart“, dazu eine `Map` von Kennung auf Aufruf. Nichts wird aus der Mitte einer Liste entfernt. Die Marke „parallel“ geht über einen Zähler der begonnenen Aufrufe statt über `offen.forEach` (`:392`) und beseitigt so den heutigen quadratischen Anteil.
3. **Folgen für die Auswertung (Technikfrage 3)**:
   - Gesamtdauer, Werkzeug, Denken, Warten, die Denk- und Wartezeilen und die Zeitachse ändern sich **nicht**. Eine Lücke gehört dem späteren Eintrag und hängt an keiner Paarung (N1 Punkt 1).
   - Was sich ändert, ist die **Dauer einer Schrittzeile**, weiter `zeit(Ergebnis) − zeit(Aufruf)`, jetzt mit dem richtigen Ergebnis. Im Beispiel oben werden aus A 3 s und B 9 s nun A 10 s und B 2 s. Damit ändern sich auch die Balken und **„Längste Schritte“**.
   - Die **Marke „Fehler“** wandert zum richtigen Aufruf, mit roter Zeile und Kürzel des Ergebnisses. Die **Zahl der Fehler** im Kopf bleibt gleich, denn jedes Ergebnis zählt genau einmal, gepaart oder allein. Auch die Zahl der Werkzeugaufrufe und der Bericht bleiben gleich.
   - Die Auswertung läuft weiter einmal je Lesen (N1 Punkt 6).
4. **Altbestand (Technikfrage 4)**:
   - Der Rückfall auf die Warteschlange reicht für kanbanD und **muss** bleiben. Andere Erzeuger und alte Dateien tragen keine Kennung, und das Format bleibt neutral (PO Z. 371).
   - Die Ansicht kennzeichnet einen Lauf ohne Kennungen nicht eigens. Eine Marke „nach Reihenfolge gepaart“ wäre ein neuer Zustand mit eigenem Wortlaut, und der Altbestand ist klein und ersetzbar. Ob die Ansicht ihn trotzdem kennzeichnet, entscheidet der PO.
   - Die alten Transkripte ohne Kennung (bei der Zählung 47) kann die Factory **neu ablegen**: Rohprotokoll aus dem Journal, `transkript.py`, dann `DELETE` und `POST` unter derselben Kennung (ADR-0036 Regel 5). Das sind je Lauf zwei Commits am Board. Es ist ein Werkzeug des Directors und **kein Teil von kanbanD**. Es geht nur, solange Claude Code die Rohprotokolle aufbewahrt, also bis etwa 2026-12-20.

**In Kauf genommen**: In einem gemischten Transkript kann ein Ergebnis ohne `zu` einen Aufruf mit `id` belegen, wenn kein Aufruf ohne `id` offen ist. Dessen eigenes Ergebnis steht dann allein. Das ist nie schlechter als die Warteschlange von heute, und mit dem Umwandler der Factory kommt es nicht vor, denn dort sind alle Einträge gekennzeichnet. Ein Erzeuger, der falsche Kennungen schreibt, paart falsch, ohne dass die Ansicht es merkt.

### Durchsetzung

- Node-Tests `laufAuswerten`/`eintragPruefen` (`e2e/einheit/`):
  - Abnahme der Karte: A, B mit `id`, Ergebnisse B, A mit `zu`. A zeigt das Ergebnis von A samt Fehler, B das von B, und die Dauern sind A 10 s und B 2 s. Dieselben Zeilen ohne Felder liefern genau das Ergebnis von heute (`deepEqual` gegen die alte Auswertung).
  - `zu` unbekannt, `zu` eines schon gepaarten Aufrufs, doppelte `id`, gemischt (A mit `id`, B ohne, Ergebnis B ohne `zu`, Ergebnis A mit `zu`), Ergebnis ohne `zu`, während nur Aufrufe mit `id` offen sind.
  - Falsche Form: `id` als Zahl, leer, mit 257 Zeichen, an einer Nachricht, `zu` an einem Aufruf. Der Eintrag bleibt lesbar, und das Feld ist `null`.
  - `id: "__proto__"` und `id: "constructor"` paaren wie jede andere Kennung.
  - Gesamtdauer, Anteile und Fehlerzahl sind mit und ohne Felder gleich.
- Messprobe als Beobachtung im Bericht, nicht im Gate: 10.000 offene Aufrufe, Ergebnisse danach in umgekehrter Reihenfolge mit `zu`, Ziel unter 100 ms. Heute sind es 185–253 ms bei derselben Zahl ohne `zu`.
- Review-Punkt `code-reviewer`: keine Entnahme aus der Mitte einer Liste, keine Kennung als Schlüssel eines einfachen Objekts und nie als HTML.
- Review-Punkt `legacy-reviewer`: Für jedes abgelegte Transkript ohne Kennung ist die Auswertung vor und nach der Karte gleich (Kopie der Boards, nur lesen). Ein Transkript mit Kennungen öffnet auch der Stand vor der Karte, denn unbekannte Schlüssel fallen weg.

### Folgeaufgaben

- [ ] Planer: eine Scheibe „Paaren über die Kennung“ (Punkte 1 ohne `tokens`, 2, 3) als Bug-Anforderung mit eigener Interaction unter D2 „Laufansicht“. Die Regel zu `tokens` steht in der Anforderung von #263.
- [ ] PO: den Formatnachtrag zu Z. 371 (`id?`, `zu?`, `tokens?`) ins Protokoll; entscheiden, ob ein Lauf ohne Kennungen eine Marke bekommt (Empfehlung: nein).
- [ ] Director/Factory: entscheiden, ob die alten Transkripte neu abgelegt werden (Punkt 4), solange die Rohprotokolle noch liegen, also bis etwa 2026-12-20.

## Nachtrag 2026-11-22 N3: Tokens — Kennzahl aus dem Kosteneintrag, je Antwort an ihrer ersten Zeile, „Teuerste Schritte“ nach neuen Tokens (Karte #263)

**Status bleibt `Akzeptiert`.** Karte #263 (Vorrang, Auftrag des Betreibers: „Wenn die Daten schon da sind, sollten wir sie auch anzeigen.“) soll neben „Was hat am längsten gedauert?“ auch „Was hat am meisten gekostet?“ beantworten. N3 baut die Regel zu `tokens` aus N2 Punkt 1 und legt die Anzeige fest. Alles wird weiter aus den gelesenen Einträgen und aus der Karte gerechnet. Server, OpenAPI und Format bleiben, wie sie sind. kanbanD rechnet aus Tokens nie einen Betrag, kennt kein Modell und keine Preistabelle (PO Z. 569).
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #263, Lauf 263-architekt-1)
**Erprobt durch**: Zählung über die 300 neuesten Claude-Protokolle von Rollenläufen der Factory (2026-11-22 14:25), umgewandelt mit `transkript.wandle` und gemessen mit `kosten.claude` der Factory (Stand `90fc807`). Last 1,2, `nice -n 10`. Die Wegwerf-Skripte liegen in der Ablage der Factory `gemeinsam/scratchpad/arch-263/`. Die Leistung ist begründet, nicht gemessen (Punkt 5).

### Belegt

- **Code**: `eintragPruefen` (`web/lauf.js:77`) liest `tokens` noch nicht. `laeufe.js:43` reicht `tokens` des Kosteneintrags schon an die Zeile des Laufs weiter, `laufKopfHtml` (`web/lauf.js:520`) zeigt davon nur den Betrag. Der Kostenbericht zeigt Tokens als volle Zahl mit Tausenderpunkt (`web/ansicht.js:319`).
- **Erzeuger**: Der Kosteneintrag trägt als `tokens` die Summe von Eingabe, Ausgabe, Cache-Lesen und Cache-Schreiben über alle Antworten des Laufs, jede Antwort einmal (Factory `werkzeuge/kosten.py:26–49`, `board.py:727`). Das Transkript trägt dieselben vier Werte je Antwort am ersten Eintrag, den die Antwort erzeugt (`transkript.py:70–93`). Eine Antwort, die nur aus einem Denkblock besteht, erzeugt keinen Eintrag, und ihre Tokens fehlen im Transkript.
- **Abgleich**: In 299 von 300 Läufen ist die Summe aus dem Transkript gleich dem Wert des Kosteneintrags. Im übrigen Lauf fehlen 4,3 %, und die Ursache ist genau eine Antwort nur mit Denkblock.
- **Antworten**: 11.772 Antworten. 11.060 enthalten genau einen Aufruf, 662 zwei oder mehr (5,6 %), 50 keinen. 560 beginnen mit einer Nachricht und enthalten danach einen Aufruf. Die weiteren Einträge einer Antwort folgen unmittelbar auf ihren ersten, und zwischen zwei Antworten steht immer ein Eintrag von `werkzeug` oder `mensch`, denn das Modell antwortet nur auf eine Eingabe.
- **Anteile**: Cache-Lesen macht 96,9 % aller Tokens aus, Cache-Schreiben 2,6 %, Ausgabe 0,5 %, Eingabe weniger als 0,01 %.
- **Rangfolge** (278 Läufe mit mindestens 10 Antworten, je die drei größten Antworten, Lage 0 = Anfang, 1 = Ende des Laufs):

  | Größe | Lage im Median | im letzten Fünftel | Ergebnistext direkt davor, Median |
  |---|---|---|---|
  | Summe aller vier | 0,94 | 96 % | 333 Zeichen |
  | Ausgabe | 0,77 | 46 % | 1.038 Zeichen |
  | neue Tokens (Eingabe + Cache-Schreiben + Ausgabe) | 0,17 | 7 % | 9.859 Zeichen |

  Die Summe misst die Länge des Kontexts, also die Stelle im Lauf, und nicht den Schritt. Die neuen Tokens zeigen die Antworten nach großen Ergebnissen, also das, was ein Schritt dem Kontext hinzugefügt hat.

### Optionen

| Frage | Variante | Stärke | Schwäche |
|---|---|---|---|
| Kennzahl je Lauf (Technikfrage 1) | **K1 — Kosteneintrag, ersatzweise Summe aus dem Transkript** (gewählt) | dieselbe Quelle wie der Betrag daneben; vollständig, auch bei Antworten nur mit Denkblock; live wie die Kosten | zwei Quellen; im seltenen Abweichungsfall passt die Summe der Zeilen nicht genau zum Kopf |
| | K2 — nur die Summe aus dem Transkript | eine Quelle, Zeilen und Kopf passen immer | fehlt bei Altbestand ganz (Wunsch 4 der Karte); an der Grenze nur ein Teil; kann vom gebuchten Betrag daneben abweichen |
| | K3 — beide zeigen, Abweichung kennzeichnen | nichts wird verschwiegen | neuer Zustand mit Wortlaut für einen Fall von 1 zu 300 mit harmlosem Grund |
| Zuordnung je Schritt (Technikfrage 2) | **Z1 — an der Zeile des Eintrags, der das Feld trägt; weitere Zeilen derselben Antwort verweisen darauf** (gewählt) | genau die Angabe des Erzeugers, nichts erfunden; jede Antwort zählt genau einmal | die Zahl steht bei einer Antwort mit Nachricht und Aufruf an der Nachricht; ein paralleler zweiter Aufruf zeigt keine eigene Zahl |
| | Z2 — gleichmäßig auf die Aufrufe der Antwort aufteilen | jede Schrittzeile hat eine Zahl | erfundene Werte: Wie sich Ausgabe und Kontext auf die Aufrufe verteilen, weiß niemand; Rundungsreste |
| | Z3 — eigene Zeile „Antwort“ vor ihren Einträgen | sauber getrennt | neue Zeilenart in der Insel, mehr Zeilen als heute (bei 95 % der Antworten steht nur ein Eintrag), eigene Zeichnung |
| „Teuerste Schritte“ (Technikfrage 3) | S1 — Summe aller vier | entspricht der Kennzahl im Kopf | wählt zu 96 % das Ende des Laufs (Belegt) und beantwortet die Frage nicht |
| | S2 — Ausgabe | eindeutig dem Schritt zuzurechnen, teuerste Tokenart | 0,5 % aller Tokens; große gelesene Texte, die den Kontext treiben, sieht sie nicht |
| | **S3 — neue Tokens: Eingabe + Cache-Schreiben + Ausgabe** (gewählt) | ohne Preis und ohne Gewichtung; misst, was die Antwort dem Kontext hinzufügt und selbst erzeugt; findet die Schritte nach großen Ergebnissen | lässt Cache-Lesen weg, das im Lauf den größten Teil der Kosten ausmacht; zählt einen Token Ausgabe so viel wie einen Token Cache-Schreiben, obwohl er mehr kostet |
| | S4 — gewichtet nach Preisverhältnis (etwa Cache-Lesen 0,1) | nah am Geld | ist eine Preistabelle und damit ausgeschlossen (PO Z. 569); veraltet mit jedem Modell |

### Entscheidung

1. **Lesen**: `eintragPruefen` liefert zusätzlich `tokens` nach N2 Punkt 1, sonst `null`. Das Feld wird nur an Einträgen von `agent` übernommen, und die Werte sind ganze Zahlen ≥ 0 (`Number.isSafeInteger`). Ein fehlender Schlüssel zählt in jeder Summe als 0. Ein falsch geformtes Feld gilt als fehlend, der Eintrag bleibt lesbar. Ein Objekt aus `tokens` wird nie gezeichnet, gezeichnet werden nur daraus gerechnete Zahlen.
2. **Kennzahl je Lauf (Technikfrage 1)**: Variante K1.
   - Der Kopf zeigt die Tokens neben den Kosten und aus derselben Quelle: `tokens` des Kosteneintrags dieser Kennung (`laeufe.js:43`). Sie sind live wie die Kosten (N1 Punkt 5), und die Auswertung wird dafür nicht neu gerechnet.
   - Fehlt der Kosteneintrag oder sein `tokens`, und trägt mindestens ein gelesener Eintrag `tokens`, zeigt der Kopf die Summe aller vier Werte über die gelesenen Einträge, gekennzeichnet als „aus dem Transkript gezählt“. An der Grenze steht „mindestens“ davor, wie bei der Dauer (N1 Punkt 1).
   - Fehlt beides, steht „–“ mit Lesetext.
   - Weichen Kosteneintrag und Transkript ab, gilt der Kosteneintrag, ohne Hinweis. Er ist die gebuchte Zahl, aus der der Betrag daneben gerechnet ist (ADR-0028). Die bekannte Ursache einer Abweichung ist eine Antwort nur mit Denkblock, die keine Zeile hat.
   - Die Auswertung liefert die Summe aus dem Transkript als `tokens: {summe, neu, ein, aus, cache_lesen, cache_schreiben}`, ohne `tokens` im Transkript `null`. Ob der Kopf daraus eine Aufteilung zeigt (etwa „davon neu …“), entscheidet die Gestaltung.
3. **Zuordnung je Schritt (Technikfrage 2)**: Variante Z1.
   - Eine **Antwort** beginnt an einem Eintrag von `agent` mit `tokens` und umfasst die unmittelbar folgenden Einträge von `agent` ohne `tokens`. Sie endet am nächsten Eintrag eines anderen `wer` oder am nächsten Eintrag mit `tokens`. Ein Ergebnis hat `wer=werkzeug` und beendet die Antwort damit immer.
   - Die Tokens stehen an der **Zeile des Eintrags, der sie trägt**: an einer Nachricht von `agent` oder an einer Schrittzeile, deren Aufruf sie trägt. Weitere Zeilen derselben Antwort zeigen „–“ mit dem Lesetext, dass sie in der Antwort darüber gezählt sind. Einträge von `agent` ohne Antwort mit `tokens` zeigen „–“ mit dem Lesetext „keine Angabe“ (angeglichen 2026-11-22, siehe Nachtrag am Ende von N3: entschieden ist „Tokens unbekannt“, PO Z. 576). Das gilt auch für jeden Eintrag eines Transkripts ganz ohne `tokens` (Wunsch 4 der Karte).
   - Nachrichten von `mensch`, allein stehende Ergebnisse sowie Denk- und Wartezeilen tragen keine Token-Angabe. Die Denkzeile vor einer Antwort und ihre Tokens bleiben getrennt, denn die Lücke gehört nach N1 Punkt 1 dem späteren Eintrag und hängt an keiner Antwort.
   - Die Zeile zeigt die **neuen Tokens** (Punkt 4), unauffällig wie die Dauer. Aufgeklappt stehen die vier Werte einzeln. Die Summe aller vier gehört nicht in die Zeile, denn sie wächst mit dem Kontext und liest sich wie ein Zähler.
   - Die Auswertung liefert je Antwort `{nr, tokens, neu, nachNr}`. `nr` ist die Nummer der Zeile, an der die Tokens stehen. `nachNr` ist die Zeile des Schritts, dessen Ergebnis unmittelbar vor der Antwort stand, sonst `null`.
   - **N3.1 (PO Z. 577–580): Feld `warten_davor`.** Die Auswertung liefert je Antwort zusätzlich `warten_davor`, die Dauer in ms der **letzten gezeichneten Wartezeile** seit der vorigen Antwort, sonst `null`. Es gilt nur, wenn `nachNr` `null` ist; hat die Antwort `nachNr`, bleibt es `null`. „Gezeichnet“ heißt: Die Lücke ist nach N1 Punkt 1 Warten (vor einer Nachricht von `mensch`) und hat die Schwelle von 5 s erreicht, also genau die Lücke, die als Zeile „<Dauer> wartet“ steht, mit derselben Dauer und derselben Form. Weil jede Lücke dem späteren Eintrag gehört, steht die Wartezeile nie vor der Antwort selbst, sondern vor einem Eintrag von `mensch` zwischen der vorigen und dieser Antwort. Gibt es dort mehrere, gilt die letzte, also die der Antwort nächste.
   - **Entstehung aus den Lücken**: Im selben Durchlauf, der die Lücken nach N1 Punkt 1 ohnehin bildet, hält die Auswertung eine Variable `wartenSeit` (Dauer oder `null`). Ein Eintrag mit Lücke der Art Warten ab der Schwelle setzt sie auf diese Lücke. Beginnt eine Antwort (Eintrag von `agent` mit `tokens`), geht der Wert in `warten_davor` der Antwort (nur bei `nachNr === null`), danach wird `wartenSeit` auf `null` gesetzt, sobald die Antwort begonnen hat. Eine Lücke ohne gültige `zeit` (N1 Punkt 1) setzt sie nicht. Es entsteht weder eine neue Zeilenart noch eine neue Messung, und `warten_davor` hängt an keiner Paarung.
4. **„Teuerste Schritte“ (Technikfrage 3)**: Variante S3.
   - Rangfolge nach **neuen Tokens** = `ein + cache_schreiben + aus` je Antwort, absteigend, bei Gleichstand die frühere zuerst. Die drei ersten stehen als Liste neben „Längste Schritte“. Gesprungen wird wie dort über einen Knopf mit `data-act` an `lv-s<nr>`, nie über `href="#…"`, und das Nachführen aus N1 „Nach dem Bau“ gilt auch hier. Die Knöpfe tragen eigene Kennungen (`lv-teu-<i>`), damit sie nicht mit `lv-top-<i>` kollidieren.
   - Beschriftet wird eine Antwort mit ihrem ersten Aufruf (`schrittText`), ohne Aufruf mit „Nachricht von Agent“. Dazu steht gedämpft „nach <Schritt aus `nachNr`>“ (PO Z. 575). **N3.1**: Ist `nachNr` `null` und `warten_davor` gesetzt, steht an dieser Stelle „nach <Dauer> Warten“ (etwa „nach 5 min 17 s Warten“, Dauer in der Form der Wartezeile, PO Z. 580); sind beide `null`, entfällt die Zeile. Die Zählung zeigt, dass der Anlass meist das große Ergebnis davor ist.
   - **N3.1: Zeile „Tokens“ unter der Nachricht des Agenten (PO Z. 579).** Trägt der Eintrag einer Nachricht von `agent` `tokens`, setzt `schrittHtml` unter ihren Text eine gedämpfte Zeile „Tokens“ mit den vier Werten in der Form der aufgeklappten Schrittzeile: „Eingabe <n> · Cache-Schreiben <n> · Ausgabe <n> · Cache-Lesen <n>“, volle Zahlen mit Tausenderpunkt. Sie steht immer, ohne Aufklappen; Nachrichten ohne `tokens`, von `mensch` und Zeilen ohne eigenes `tokens` bleiben unverändert. Die Werte kommen als Zahlen aus dem gelesenen Eintrag (Punkt 1) und nicht aus der Auswertung; die Zeile braucht keine neue Rechnung. Ihre Zahlform ist die der aufgeklappten Zeile und nicht die gekürzte der Kopfzeile.
   - Die Liste erscheint nur, wenn mindestens eine Antwort `tokens` trägt.
   - **In Kauf genommen**: Cache-Lesen zählt nicht mit, obwohl es im Lauf den größten Teil der Kosten ausmacht. Es ist der Preis des schon vorhandenen Kontexts und keinem einzelnen Schritt zuzurechnen. Ein Token Ausgabe zählt so viel wie ein Token Cache-Schreiben. Ohne Preis kann deshalb ein großer gelesener Text vor einer langen Ausgabe stehen, die mehr gekostet hat.
5. **Leistung (Technikfrage 4)**: Es bleibt bei **einer Auswertung je Lesen** und **O(n)**. `tokens` wird je Eintrag in O(1) geprüft. Die laufende Antwort, die Summen und die Zeile des letzten Ergebnisses sind je eine Variable. Die drei teuersten Antworten werden in einem Durchlauf über eine Liste fester Länge 3 bestimmt, ohne alle Antworten zu sortieren. **N3.1**: `wartenSeit` ist eine weitere Variable im selben Durchlauf; `warten_davor` kostet je Eintrag O(1) und je Antwort eine Zuweisung, ohne Rückblick auf frühere Einträge. Die Auswertung bleibt bei O(n) und einer Auswertung je Lesen. Kopf und Liste zeichnen aus der Auswertung, die Kennzahl aus dem Kosteneintrag kommt live aus der Karte. `grep -c "laufAuswerten(" web/app.js` bleibt 1, und jeder Aufruf von `laufHtml` gibt die Auswertung mit (N1 „Nach dem Bau“).
6. **Abgrenzung zu #253 und #261 (Technikfrage 5)**: Die Karten werden nicht gebündelt, aber nacheinander gebaut, in der Reihenfolge **#263 → #253 → #261**.
   - Alle drei ändern dieselben Stellen in `web/lauf.js`: den Rückgabewert von `laufAuswerten` (`:325`), die Zusammenfassung der Schrittzeile in `schrittHtml` (`:233`, Bereich `.du`), `laufTopHtml` (`:268`) und `.lv-gl` in `web/kd-app.css`. #263 und #261 ändern zusätzlich `laufKopfHtml` bzw. die Zeilen. Gleichzeitig gebaut, kollidieren sie beim Rebase (vgl. `AI-Team/gelerntes.md`, #201).
   - **#263 zuerst**, denn die Karte ist klein, rein additiv und ohne Vorgänger. Sie macht aus `laufTopHtml` eine Listenfunktion für beide Listen (Titel, Kennungspräfix, Einträge, Wertform).
   - **#253 danach** (`braucht:263`): Die Gliederung links nimmt beide Listen auf, statt nur „Längste Schritte“.
   - **#261 zuletzt** (`braucht:253`): Punkt 3 der Ergänzung, die Beschriftung mit der Absicht, wirkt dann über die eine Listenfunktion auf beide Listen. Der neue Satz der Zeilen übernimmt die Token-Angabe als festen Bestandteil der Zusammenfassung.
   - Bündeln von #263 in #253 wurde verworfen. #253 hat Architektur und Zuschnitt schon (N1, PO Z. 522), und eine größere Karte verzögert die Vorrang-Wünsche beider.

### Durchsetzung

- Node-Tests `eintragPruefen`/`laufAuswerten` (`e2e/einheit/`):
  - `tokens` an einem Eintrag von `agent` wird gelesen. Es fällt weg an einem Ergebnis und an einer Nachricht von `mensch`, als Zahl, als Liste, mit `-1`, `1.5`, `2**53` und mit unbekanntem Schlüssel allein. Der Eintrag bleibt in jedem Fall lesbar.
  - Antwort mit Nachricht und zwei parallelen Aufrufen: Die Tokens stehen an der Nachricht, beide Aufrufe zeigen den Verweis, und die Tokens aller Antworten ergeben zusammen die Summe des Transkripts.
  - Zwei Antworten ohne Eintrag eines anderen `wer` dazwischen, beide mit `tokens`, werden zwei Antworten.
  - Rangfolge: Eine Antwort mit großer Summe, aber kleinen neuen Tokens steht nicht in der Liste. Gleichstand ergibt die frühere zuerst. Ohne `tokens` gibt es keine Liste.
  - Kopf: Ein Kosteneintrag mit `tokens` geht vor dem Transkript. Ohne Kosteneintrag gilt die Summe des Transkripts mit Kennzeichnung, an der Grenze mit „mindestens“. Ohne beides steht „–“.
  - Ein Transkript ohne `tokens` ergibt dieselbe Auswertung wie vor der Karte, bis auf `tokens: null` und die leere Liste (`deepEqual`).
- Node-Tests N3.1: `warten_davor` ist die Dauer der Wartezeile zwischen zwei Antworten (ab 5 s), bei einer Lücke von 4,9 s `null`, bei mehreren die letzte, bei gesetztem `nachNr` `null`, und nach dem Beginn einer Antwort gilt sie nicht für die nächste. Eine Nachricht von Agent mit `tokens` zeichnet die Zeile „Tokens“ mit vier Werten, ohne `tokens` keine.
- E2E: Ein gebuchter Kosteneintrag mit `tokens` ändert die Tokens im Kopf, und die Insel bleibt (`el.__probe`, wie N1). Ein Sprung aus „Teuerste Schritte“ lässt `location.hash` gleich und setzt den Fokus auf die Zeile.
- Messprobe als Beobachtung im Bericht, nicht im Gate: 20.000 Zeilen mit `tokens` an jedem Eintrag von `agent` bleiben unter 300 ms (Q5 aus N1 Punkt 7).
- Review-Punkt `architektur-reviewer`: Gerechnet wird nur in `web/lauf.js` und einmal je Lesen. Kein Preis, kein Modell, kein Betrag aus Tokens (PO Z. 569). Keine Liste wird nach allen Antworten sortiert.
- Review-Punkt `code-reviewer`: Die Werte aus `tokens` gehen nur als Zahl ins HTML.

### Nachtrag 2026-11-22 (Lauf 263-architekt-3): Lesetext angeglichen

Der PO hat den Lesetext in `AI-Team/po-entscheidungen.md` Z. 576 entschieden: Einträge von `agent` ohne Angabe und ein Kopf ohne beide Quellen zeigen „–“ mit dem Lesetext **„Tokens unbekannt“**, nicht „keine Angabe“. Punkt 3 oben bleibt als ursprünglicher Wortlaut stehen, maßgeblich ist Z. 576. Gebaut ist es so (`TOKENS_UNBEKANNT`, `web/lauf.js:238`).

### Folgeaufgaben

- [ ] Planer: **eine Scheibe** „Tokens je Lauf und je Schritt“ als eigene Interaction unter D2 „Laufansicht“: Punkte 1–5, höchstens zehn Kriterien. Das Label `braucht:263` an #253 und `braucht:253` an #261 setzt der Director.
- [ ] PO: Zahlform im Kopf und in der Zeile (Vorschlag: volle Zahl mit Tausenderpunkt wie im Kostenbericht, `web/ansicht.js:319`, oder Kurzform „1,2 Mio.“/„35 Tsd.“); Name der Größe in Zeile und Liste („neue Tokens“); Titel der Liste („Teuerste Schritte“); Lesetexte für „in der Antwort darüber gezählt“, „keine Angabe“ und „aus dem Transkript gezählt“; ob die Liste „nach <Schritt>“ nennt (Empfehlung: ja).
- [ ] Gestalter: D0009 `#laufansicht` nachzeichnen: Feld „Tokens“ im Kopf neben „Kosten“, Token-Angabe in der Zeile neben der Dauer, Liste „Teuerste Schritte“ neben „Längste Schritte“. Freigabe durch den PO.
- [ ] Director/Factory: Die Transkripte, die vor Factory-Commit `89cb890` abgelegt wurden, tragen keine `tokens`. Sie lassen sich mit dem Werkzeug aus N2 Punkt 4 neu ablegen, solange die Rohprotokolle liegen (bis etwa 2026-12-20).

## Nachtrag 2026-11-22 N4: Satz der Einträge — Aufruf strukturiert und abgesetzt, Ergebnis gekürzt, Marken für Gekürztes und Systemhinweise, Pfade als Links, Edit und Write als Diff (Karte #261)

**Status bleibt `Akzeptiert`.** Karte #261 (Auftrag des Betreibers vom 2026-11-22, „Es ist noch schwer lesbar“, mit der Ergänzung im Kommentar des Directors 12:33) will, dass sich ein Lauf wie ein gesetztes Protokoll liest. Alles Neue betrifft **nur den Satz** der Einträge in der Insel. Lesen, Grenzen, Auswertung, Format (PO Z. 371 mit N2), Server und OpenAPI bleiben, wie sie sind. Punkte 1–7 und N1–N3 gelten weiter. Gebaut wird nach #253 (N3 Punkt 6).
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #261, Lauf 261-architekt-1)
**Erprobt durch**: Zählung über alle 89 Transkripte des Factory-Boards (7.313 Einträge, nur gelesen, 2026-11-22 16:53) und eine Messprobe in Node 20 (Last 4,2–5,0 bei 8 Kernen, `nice -n 10`), beides mit Wegwerf-Skripten in der Ablage der Factory `gemeinsam/scratchpad/arch-261/`. Der Satz ist dort als Prototyp gebaut (nur Stringbau, ohne DOM), nicht im Code.

### Belegt

- **Code (Stand `d2762e46`)**:
  - Nachrichten laufen schon durch `markdownHtml` (`nachrichtTextHtml`, `web/lauf.js:258`). Wunsch 6 des Kommentars ist also seit #251 gebaut. Es fehlen nur Pfade als Links.
  - Systemhinweise sind eingeklappt, aber nur als **ganze Nachricht**, die mit `<system-reminder>` beginnt (`eingeklapptFinden`, `:562`). In Ergebnissen bleiben sie Text.
  - Aufgeklappt stehen Aufruf und Ergebnis als zwei `pre` mit den Wörtern „Aufruf“ und „Ergebnis“ (`schrittHtml`, `:285`). Der Aufruf ist dabei roher JSON-Text in einer Zeile.
  - `markdownInline` verlinkt nackte `http(s)`-Adressen, aber keine Pfade. Inline-Code wird vor allem anderen geschützt (`web/markdown.js:83`). Ein Pfad in Backticks kann also heute nie ein Link werden.
  - `vscodeLink(wurzel, pfad, zeile)` mit Kodierung je Pfadteil und die Regel „kein Link, wenn das Sichtbarmachen den Pfad ändert“ gibt es schon (`web/review-uebersicht.js:99–106`, `:136–141`; R00236 FA 4–6). `web/ansicht.js:392` ist das ältere Muster nur mit `esc`. R00236 AK 4 hat es als Mutanten verworfen.
  - Die Syntaxfarben laufen über Prism im Worker mit Frist und zweistufigem Zeichnen (ADR-0040). Wiederverwendbar ohne diese Mechanik sind die sieben Rollen und ihre Farben `--kd-tk-*` (`web/kd-tokens.css:59`, `:97`, `:134`). Die Klassen `.tk-*` gelten heute nur unter `.dz .c` (`web/kd-app.css:1582`).
  - PO Z. 494: „Name und Werkzeugtext ergeben nie einen Link … Die Ausgaben der Werkzeuge bleiben ohnehin Text.“
- **Zählung (89 Transkripte)**:
  - 3.459 Aufrufe, **alle** mit einem JSON-Objekt als Text und keiner mit einem verschachtelten Wert. Bash ist mit 2.887 (83 %) der Löwenanteil, dann Read 211, Write 28, Edit 7, sonst MCP-Werkzeuge mit flachen Feldern.
  - **151 Ergebnisse (4,4 %) sind `<persisted-output>`** in genau einer Form: `Output too large (<Größe>). Full output saved to: <Pfad>`, Leerzeile, `Preview (first 2KB):`, Vorschau. In 3 davon steht ein `Exit code` ≠ 0 in der Vorschau, und `fehlerErkennen` sieht ihn heute nicht, denn die erste Zeile ist `<persisted-output>`.
  - **49 Ergebnisse tragen `<system-reminder>`**, 47 davon nicht am Ende des Texts.
  - 1.339 Ergebnisse (39 %) haben mehr als 20 Zeilen. 210 enthalten eine Schlusszeile eines Testlaufs (`\d+ passed|failed`, `test result:`).
  - 96 von 395 Nachrichten nennen einen absoluten Pfad.
- **Messprobe (Node, nur Stringbau)**:

  | Stand | Zeilen | Text | `laufHtml` heute | Satz neu (Prototyp, zusätzlich) |
  |---|---|---|---|---|
  | größter echter Lauf | 381 | 0,7 MB | 35–46 ms | 9–14 ms |
  | echte Läufe aneinandergehängt bis zur Grenze von 16 MiB | 7.166 | 14,7 MB | 591 ms | 233 ms |

  Der Prototyp ersetzt die heutigen `pre` des Aufrufs und des Ergebnisses. Was an DOM und Layout dazukommt, misst erst der Bau (Punkt 9).

### Optionen

**Wo und wann gesetzt wird**

| Variante | Stärke | Schwäche |
|---|---|---|
| **E1 — eifrig im HTML der Insel, einmal je Lesen, mit festen Grenzen je Eintrag** (gewählt) | Ein Weg wie heute (Punkt 5). Strg+F findet alles, auch in zugeklappten `details` (Chromium klappt sie bei einem Treffer auf; aus dem Gedächtnis, nicht geprobt, die E2E-Probe nimmt `textContent`). Deterministisch und in Node testbar. Gemessen +40 % Stringbau an der Grenze, +14 ms beim größten echten Lauf | Das HTML wächst mit jeder neuen Marke. Ohne Grenze wäre eine einzelne riesige Eingabe (Write mit 8 MB) teuer |
| E2 — träge beim ersten Aufklappen (`toggle`), aus dem gemerkten Eintrag | Kosten nur für Geöffnetes | Strg+F findet Zugeklapptes nicht mehr (dasselbe Argument wie gegen Z3). Eine zweite Quelle für den Inhalt der Insel neben dem einmal gesetzten HTML |
| E3 — Prism-Worker (ADR-0040) auch für die Laufansicht | dieselbe Färbung wie im Review, auch für Code in Edit und Write | Zweistufiges Zeichnen mit Frist widerspricht „einmal zeichnen“ (Punkt 4). JSON braucht keinen Tokenizer, denn `JSON.parse` liefert die Struktur schon |

**Woher die Marken für lange Pfade kommen** (Wunsch 2 des Kommentars)

| Variante | Stärke | Schwäche |
|---|---|---|
| **M1 — aus dem Auftrag gelesen** (erste Nachricht von `mensch`, N1 Punkt 5): die Zeilen mit `Projekt:`, `Arbeitsort:` und `Ablage:` und einem absoluten Pfad (gewählt) | Keine neue Angabe im Format, kein Server. Liefert genau die drei Wurzeln aus dem Wunsch. Es ist dieselbe Art „erkannte Form“ wie `Ergebnis:` und `<system-reminder>` (N1) | kanbanD liest Schlüssel eines Erzeugers. Ein anderer Erzeuger ergibt keine Marken, dann stehen die Pfade voll da |
| M2 — neues optionales Feld im Format (etwa eine Kopfzeile mit Wurzeln) | neutral und genau | Format und Factory ändern sich zugleich. Alte Transkripte haben keine Marken |
| M3 — aus dem Bestand des Boards (`S.zustand.ordner`, Wurzeln der Anwendungen) | kein Text des Erzeugers | Der Browser kennt die Wurzeln der Anwendungen nur aus `GET …/diff`. Worktree und Ablage kennt kanbanD gar nicht |

### Entscheidung

**Gewählt: E1 und M1.** In Kauf genommen: Marken, Systemhinweise, gekürzte Ausgaben und Testzeilen werden an Formen erkannt, die Claude Code und die Factory heute schreiben. Andere Erzeuger fallen auf den heutigen Satz zurück. Code in Edit und Write bleibt ohne Syntaxfarben.

1. **Ort**: Ein neues reines Modul **`web/lauf-satz.js`** (Browser und Node, wie `web/lauf.js`) setzt den aufgeklappten Teil einer Schrittzeile und die Marken: `aufrufSatz`, `ergebnisSatz`, `shellUmbruch`, `jsonHtml`, `editDiff`, `gekuerztErkennen`, `systemhinweiseTrennen`, `testzeileFinden`, `pfadMarken`, `pfadLinkHtml`. `web/lauf.js` ruft es aus `schrittHtml` und `nachrichtHtml` auf. Lesen und Auswerten bleiben in `web/lauf.js`. Grund: `web/lauf.js` hat 861 Zeilen, und der Satz ist ein eigenes Unterthema. `web/app.js` ändert sich nicht.
2. **Aufruf** (Wünsche 3, 4, 8):
   - Aufgeklappt steht der Aufruf **in einem eigenen Block mit Fläche und Rahmen** und das Ergebnis abgesetzt darunter, beides in derselben Zeile (Wunsch 8). Das ist reine Gestaltung, D0009.
   - **Bash** (`command` als Text): ein Shell-Block in Festbreite mit Umbruch. `description` steht nicht noch einmal darin, sie steht schon als Absicht in der Zusammenfassung (N1 Punkt 3). Weitere Felder (`timeout`, `run_in_background`) stehen darunter als „Schlüssel: Wert“.
   - **`shellUmbruch`**: Ein Zeilenumbruch kommt **nach** `&&`, `||` und `;`, wenn der Operator auf oberster Ebene steht. Er kommt nie innerhalb von `'…'`, `"…"`, `$(…)` oder Backticks, nie nach `\`, nie bei `;;`, nie hinter einem `#`, das ein Wort beginnt (Kommentar bis Zeilenende), und nie mehr hinter dem ersten `<<` (Heredoc, der Rest bleibt wie er ist). Eingefügt wird nur `\n`, ohne Einrückung. Darum bleibt ein kopierter Block ausführbar und bedeutet dasselbe. Ein Durchlauf, O(n).
   - **Andere Werkzeuge mit flachem Objekt**: Die Felder stehen als „Schlüssel: Wert“ in der Reihenfolge des Objekts. Ein Wert mit `\n` steht als Block in Festbreite. Ein Pfadfeld (Punkt 5) ist ein Link.
   - **Rückfall, nur wenn nötig**: Ist der Text kein Objekt oder trägt er einen verschachtelten Wert, steht er als **formatiertes JSON** (zwei Leerzeichen Einzug). Gefärbt wird mit den Rollen aus ADR-0037 Punkt 5: Schlüssel, Text, Zahl, `true`/`false`/`null`. Welche Rolle der Schlüssel bekommt, entscheidet die Gestaltung. Der Satz entsteht aus dem Ergebnis von `JSON.parse`, ohne Tokenizer und ohne Worker. Kein JSON → der Text wie heute.
   - **Edit und Write als Diff** (Kommentar Punkt 1): Edit zeigt `old_string` als entfernte und `new_string` als hinzugefügte Zeilen. Gleiche Zeilen am Anfang und am Ende stehen als Kontext, es gibt kein LCS (O(n)). Write zeigt `content` ganz als hinzugefügt. Farben und Marken `−`/`+` wie auf der Review-Seite (`--kd-c-red`, `--kd-c-green`), ohne Syntaxfarben. `replace_all: true` steht als Feld darunter.
   - Was „Schlüssel: Wert“, Diff und Shell-Block zeigen, sind **dieselben Zeichen** wie im Text des Aufrufs, durch `sichtbarHtml` bzw. `esc`. Das Zeichenbudget bleibt, wie es ist: Der Aufruf wird einmal ganz gebucht (`zeichenBuchen`). Reicht das Budget nicht für den ganzen Aufruf (`rest > 0`), steht er wie heute als `pre`.
3. **Ergebnis** (Wünsche 4, 5, 7, 9):
   - Das Ergebnis steht in Festbreite und behält seine Umbrüche, **nie Markdown** (R00221 FA 10, PO Z. 494). Ein JSON-Objekt als Ergebnis wird formatiert wie der Rückfall in Punkt 2.
   - **Kürzung**: Die ersten **20 Zeilen** stehen offen. Der Rest steht in einem eingebetteten `details` mit „weitere <n> Zeilen“ (Wortlaut PO). Er ist im DOM, Strg+F findet ihn, und das Aufklappen ist reiner DOM-Zustand der Insel (Punkt 5).
   - **Testzeile**: `testzeileFinden` sucht nur in den **letzten 20 Zeilen** nach der letzten Zeile in einer der Formen `<n> passed`, `<n> failed`, `test result: ok|FAILED. <n> passed; <n> failed`, `# pass <n>`, `# fail <n>`. Diese Zeile steht zusätzlich über der Kürzung hervorgehoben: Fehler-Ton, wenn eine Zahl der Fehlschläge > 0 ist, sonst Erfolg-Ton.
   - **`<persisted-output>`**: `gekuerztErkennen` erkennt einen Text, der nach führendem Leerraum mit `<persisted-output>` beginnt. Er liest Größe und Pfad aus `Output too large (<Größe>). Full output saved to: <Pfad>` und als Vorschau den Teil nach `Preview (…):` bis `</persisted-output>`. Die Zeile trägt dann die Marke „von Claude Code gekürzt“ mit Größe und dem Pfad als Link (Punkt 5). Darunter steht die Vorschau, gesetzt wie ein Ergebnis. Wortlaut PO. Passt das Innere nicht zur Form, steht nur die Marke ohne Pfad und darunter der Text wie heute.
   - **Fehler in gekürzter Ausgabe**: `fehlerErkennen` (N1 Punkt 4) prüft bei einem erkannten `<persisted-output>` die erste Zeile der Vorschau statt der des Texts. Das ändert die Zahl der Fehler im Kopf bei den 3 gezählten Fällen von 0 auf 1. Die Regel „nur der Anfang, nie eine Suche nach ‚error‘“ bleibt.
   - **Systemhinweise mitten im Text**: `systemhinweiseTrennen` schneidet jeden Block `<system-reminder>…</system-reminder>` aus Ergebnis und Nachricht und setzt ihn an seiner Stelle als eingeklapptes `details` „Systemhinweis“ (wie N1 Punkt 5). Ein Block ohne Ende reicht bis zum Ende des Texts. Der Filter „Systemhinweise“ aus #253 blendet diese eingebetteten Hinweise über dieselbe Klasse aus (CSS an der Wurzel der Insel, N1 Punkt 2).
4. **„Längste Schritte“ mit der Absicht** (Kommentar Punkt 3): `laengsteListe` beschriftet einen Schritt mit seiner Absicht (`description`) und setzt den Befehl gekürzt und gedämpft darunter. Ohne Absicht steht der Befehl allein wie heute. Das läuft über die eine Listenfunktion `schrittListeHtml` (N3 Punkt 6) und gilt für „Teuerste Schritte“ ebenso, wenn die Antwort einen Aufruf mit Absicht hat.
5. **Pfade als Links** (Wünsche 1, 3, Kommentar Punkt 1):
   - Ein Link entsteht **nur** über `vscodeLink` (`web/review-uebersicht.js`), also als `vscode://file` + Pfad mit `encodeURIComponent` je Teil, mit `:<zeile>` nur, wenn es eine Zeile gibt. Wie R00236 FA 6 gibt es keinen Link, wenn `sichtbarTeile` den Pfad ändern würde (Bidi- und Steuerzeichen). Das Muster `web/ansicht.js:392` (nur `esc`) wird nicht übernommen.
   - **In Nachrichten**: `markdownInline` bekommt eine Option `pfade` (Vorgabe aus). Nur `web/lauf.js` setzt sie, Beschreibung und Kommentare bleiben unverändert (ADR-0030 Punkt 7: ein Kern, die Form schaltet der Aufrufer ein). Verlinkt werden absolute Pfade (`/…` mit mindestens zwei Teilen) und relative Pfade mit mindestens einem `/` und einer Endung, ohne `..`, nur wenn die Marke „Arbeitsort“ (Punkt 6) bekannt ist. Relative Pfade gelten dann gegen diese Wurzel. Beide auch mit `:<zeile>`. Ist der **ganze Inhalt eines Inline-Codes** ein solcher Pfad, wird der Code in den Link gesetzt (`<a><code>…</code></a>`), sonst bleibt Code Code (ADR-0030 Punkt 5). Gesucht wird in einem Durchlauf, linear (ADR-0030 Punkt 9).
   - **In Aufrufen**: Nur das Feld `file_path` (auch `notebook_path`) von Read, Edit, Write, NotebookEdit wird ein Link. Read mit `offset` springt an diese Zeile. Edit springt an die erste Zeilennummer im Ergebnis, wenn das Ergebnis die Form von `cat -n` trägt (`^\s*\d+` und Tabulator oder `→`), sonst ohne Zeile. Write ohne Zeile. Pfade in `command` und in Ergebnissen werden **kein** Link. Ausnahme ist der Pfad aus `<persisted-output>`, denn er ist eine Angabe von Claude Code und keine Ausgabe des Werkzeugs. Damit bleibt PO Z. 494 („Ausgaben der Werkzeuge bleiben Text“) bestehen. Die beiden Ausnahmen bestätigt der PO.
   - **Nie in der Zusammenfassung**: `summary` ist selbst ein Bedienelement, ein Link darin wäre verschachtelt (wie ADR-0030 Punkt 8). Links stehen nur im aufgeklappten Teil und in Nachrichten.
6. **Marken für lange Pfade** (Kommentar Punkt 2, M1):
   - `pfadMarken(auftrag)` liest aus dem Text der ersten Nachricht von `mensch` (N1 Punkt 5) die Teile `Projekt: <abs. Pfad>`, `Arbeitsort: … <abs. Pfad>` und `Ablage: <abs. Pfad>` (je Zeile, auch mehrere durch `·` getrennt; Satzzeichen am Ende des Pfads fallen weg). Daraus werden ‹<letzter Teil des Projektpfads>›, ‹Worktree #<n>› (wenn der Pfad auf `karte-<n>` endet, sonst ‹Arbeitsort›) und ‹Ablage›. Wortlaut der Marken: PO.
   - Ein Pfad, der mit einer Wurzel beginnt (der längste Treffer gewinnt, nur an einer Grenze `/`), wird als Marke + Rest gezeigt. Der **volle Pfad** steht im `title` und ist das, was **kopiert** wird. Die Marke ist erzeugter Inhalt (`::before` mit `content: attr(…)`), der volle Anfang steht als visuell verborgener Text im DOM. Strg+F findet dann den vollen Pfad, und der Bildschirmleser liest ihn. Der Link zielt immer auf den vollen Pfad.
   - Marken gelten in Nachrichten, im Aufruf (auch in `command` als Text, ohne Link), in der Zusammenfassung und im Pfad aus `<persisted-output>`. In Ergebnissen gelten sie nicht, dort bleibt der Text, wie er ist.
   - Ohne erkannte Zeile gibt es keine Marken, und Pfade stehen voll da.
7. **Grenzen je Eintrag (E1)**: Feste Grenzen halten den schlechtesten Fall klein, ohne Zeitmessung (wie ADR-0037 L2). „Schlüssel: Wert“, JSON-Satz und Diff nur, wenn der Text des Aufrufs höchstens **64 KiB** und höchstens **2.000 Zeilen** hat. `shellUmbruch` nur, wenn `command` höchstens **16 KiB** hat. Die Pfadsuche in Nachrichten nur bis zum Budget, das `markdownHtml` ohnehin hat. Darüber steht der Eintrag wie heute als `pre`. Die Zahlen sind Konstanten in `web/lauf-satz.js` und stehen nicht in der Oberfläche.
8. **Leistung**: Gesetzt wird einmal je Lesen beim Bau des HTML der Insel. Bei Live, Filter und Blättern wird nichts neu gesetzt (N1 Punkt 6). `JSON.parse` je Aufruf läuft höchstens zweimal, einmal in der Auswertung (`kurzbefehl`) und einmal im Satz. Ziel bleibt Q5 (< 300 ms für den größten echten Lauf) und an der Grenze ≈ 1–1,5 s (Punkt 7).
9. **Messung im Bau** (Beobachtung im Bericht, nicht im Gate, wie Punkt 7): Zeit von der Antwort bis zum gezeichneten Bild für den größten echten Lauf und für eine Datei an der Grenze, je **vor und nach** #261. Liegt der Anstieg an der Grenze über 50 %, kommt die Frage an den architekten zurück (Rückfalloption E2 nur für die Kürzung „weitere n Zeilen“).

### Durchsetzung

- Node-Tests `web/lauf-satz.js` (`e2e/einheit/`):
  - `shellUmbruch`: `a && b; c` ergibt drei Zeilen. Unverändert bleiben `echo "a && b"`, `echo 'x;y'`, `$(a; b)`, `a \&& b`, `case x in a) ;; esac`, `echo a # b; c` und alles hinter `cat <<EOF`. Der Mutant „Umbruch auch in Anführungszeichen“ ist rot.
  - `editDiff`: Präfix und Suffix als Kontext, leeres `old_string`, gleiche Texte.
  - `gekuerztErkennen`: die echte Form, Größe in KB und MB, eine fremde Form ohne Pfad, kein `<persisted-output>` am Anfang; `fehlerErkennen` mit `Exit code 1` als erster Zeile der Vorschau.
  - `systemhinweiseTrennen`: zwei Blöcke mitten im Text, ein Block ohne Ende.
  - `testzeileFinden`: `2448 passed`, `1 failed, 3 passed`, `test result: FAILED. 3 passed; 1 failed`, eine Testzeile vor den letzten 20 Zeilen wird nicht gefunden.
  - `pfadMarken`: der Kopf eines echten Auftrags, längster Treffer, `/a/bc` ist kein Treffer für die Wurzel `/a/b`.
  - Pfad-Links: Kodierung wie R00236 AK 4 (`a/b?c#d%e:12.rs`), U+202E im Pfad ergibt keinen Link, `..` ergibt keinen, ohne Arbeitsort ergibt ein relativer Pfad keinen, ein Pfad in Inline-Code mit Text daneben bleibt Code ohne Link. In der Zusammenfassung steht kein `<a`.
  - Grenzen: Aufruf mit 64 KiB + 1 Byte und mit 2.001 Zeilen steht als `pre`. Ein Aufruf über dem Zeichenbudget steht als `pre`.
- `markdownInline` ohne Option `pfade` liefert für alle bestehenden Tests dasselbe HTML (Wächter: Beschreibung und Kommentare unverändert).
- E2E: Edit als Diff mit Link auf `vscode://file…`; ein `<persisted-output>` trägt die Marke und den Link; „weitere n Zeilen“ klappt auf, und die Insel bleibt (`el.__probe`); der Filter „Systemhinweise“ blendet einen eingebetteten Hinweis aus; Strg+F-Ersatz: `document.body.innerText` bzw. `textContent` der Insel enthält den vollen Pfad hinter einer Marke.
- Review-Punkt `security-reviewer`: Jeder Link der Insel beginnt mit `vscode://file/`, `http://`, `https://` oder `mailto:` und entsteht nur über `vscodeLink` oder `markdownInline`. Kein Text aus Aufruf oder Ergebnis geht an `esc`/`sichtbarHtml` vorbei ins HTML. Kein Link steht in `summary`.
- Review-Punkt `architektur-reviewer`: Der Satz liegt nur in `web/lauf-satz.js`, Lesen und Auswerten nur in `web/lauf.js`. `grep -c "laufAuswerten(" web/app.js` bleibt 1. Die Grenzen aus Punkt 7 sind Konstanten.

### Folgeaufgaben

- [ ] PO: Zuschnitt (Vorschlag: zwei Scheiben, siehe unten); Wortlaute für die Marke „gekürzt“, für „weitere n Zeilen“, für die Pfad-Marken und für „Systemhinweis“ im Ergebnis; Bestätigung der zwei Link-Ausnahmen zu Z. 494 (Pfadfeld des Aufrufs, Pfad aus `<persisted-output>`); Kürzung auch für Write und große Diffs; Testzeile oben oder an ihrer Stelle.
- [ ] Gestalter: D0009 `#laufansicht` nachzeichnen. Aufruf als abgesetzter Block, Shell-Block, „Schlüssel: Wert“, JSON-Rückfall mit Rollenfarben, Diff für Edit und Write, Marke „gekürzt“, „weitere n Zeilen“, Testzeile, eingebetteter Systemhinweis, Pfad-Marke mit Tooltip, „Längste Schritte“ zweizeilig. Freigabe durch den PO.
- [ ] Planer, Vorschlag **zwei Scheiben** nach #253. **C1 „Satz“**: Punkte 2 (ohne Pfad-Links), 3, 4, 7. **C2 „Pfade“**: Punkte 5 und 6 sowie die Links in Edit/Write/Read und aus `<persisted-output>`. C2 braucht C1, denn beide ändern `schrittHtml`. Grund: C2 trägt alle neuen Links aus fremdem Text und die Erkennung des Auftrags. Das ist der Teil mit Sicherheitsbezug, und er bekommt so eine eigene Prüfung.

### Nachtrag 2026-11-22 (Lauf 261-architekt-2): Systemhinweis nur als vollständiger Block am Zeilenanfang, Kürzung auch für Shell- und Wert-Block

Der PO hat in `AI-Team/po-entscheidungen.md` Z. 602–607 zwei Punkte entschieden (Freigabe D0009, Fragen 1 und 4 des gestalter). Punkt 3 und Punkt 2 oben bleiben als ursprünglicher Wortlaut stehen, maßgeblich ist dieser Nachtrag.

1. **Punkt 3, „Systemhinweise mitten im Text“ (Frage 1)**: `systemhinweiseTrennen` erkennt nur einen **vollständigen Block**, dessen `<system-reminder>` **am Zeilenanfang** beginnt und mit `</system-reminder>` schließt. Der Satz „Ein Block ohne Ende reicht bis zum Ende des Texts“ **entfällt**. Ein Tag mitten in einer Zeile und ein Block ohne Ende bleiben Text und stehen vollständig lesbar da. Grund: Fast jedes Vorkommen in Ergebnissen ist eine bloße Erwähnung (Doku, Code), die Zählung des gestalter belegt es; die alte Regel hätte Lesetext weggeklappt, ein stiller Verlust. Eine verpasste Erwähnung schadet nicht. Durchsetzung: der Test „ein Block ohne Ende“ in `systemhinweiseTrennen` erwartet jetzt unveränderten Text; neu: ein Tag mitten in der Zeile bleibt Text, ein Block am Zeilenanfang wird `details` „Systemhinweis“. Ein Ergebnis, das nur aus einem solchen Block besteht, zeigt in der Zusammenfassung gedämpft „Systemhinweis“ (PO Z. 604).
2. **Punkt 3, Kürzung „weitere <n> Zeilen“ (Frage 4)**: Die Kürzung auf 20 Zeilen gilt **auch für den Shell-Block und den Wert-Block** des Aufrufs (Punkt 2), mit derselben Grenze und demselben Wortlaut wie bei Ergebnis und Diff. **Gezählt werden Zeilen des Textes**, nicht umbrochene Bildschirmzeilen. Ein langer Heredoc steht also ab Zeile 21 hinter „weitere <n> Zeilen“; ein langer, umbrochener Einzeiler bleibt ungekürzt. Der Inhalt bleibt im DOM und für Strg+F auffindbar (E1). Die Grenzen aus Punkt 7 bleiben unberührt. Gezählt wird nach `shellUmbruch`: die dort eingefügten `\n` sind echte Zeilen des gesetzten Textes (Annahme des architekt, vom PO nicht ausdrücklich entschieden; der Bau meldet es, falls die Zeichnung etwas anderes zeigt). Durchsetzung: Node-Test mit einem Befehl von 21 Zeilen (Kürzung mit „weitere 1 Zeilen“), einem Wert-Block von 25 Zeilen und einem Einzeiler von 500 Zeichen (keine Kürzung).

### Nachtrag 2026-11-22 (Lauf 261-architekt-3, nach dem Bau, Stand `5a0e4cb3`): Berichtigungen zu N4 aus den Reviews

Aus `arev-261` und `rsr-261` (Sollte). Der Wortlaut oben bleibt stehen, maßgeblich ist dieser Nachtrag.

1. **Punkt 7, Grenzen**: Alle stehen als Konstanten an einer Stelle, `SATZ_GRENZEN` in `web/lauf-satz.js:9`. Je Grenze ihr Zweck:
   - `aufrufBytes` 64 KiB, `aufrufZeilen` 2.000, `befehlBytes` 16 KiB: halten die Kosten je Eintrag klein (wie in Punkt 7).
   - `jsonTiefe` **32**: schützt den **Stapel**, denn der Satz rekursiert je Ebene; tiefer wird der Text nicht als Wert gesetzt (Rückfall `pre`), ein `RangeError` fällt ebenso zurück.
   - `satzZeichen` **512 Ki** (524.288): deckelt die **HTML-Größe** eines JSON-Satzes; darüber Rückfall.
   - `hinweise` **200**: die **Hinweis-Flut**; mehr eingebettete Systemhinweise je Text, dann bleibt der Text Text, gezählt wie gesetzt.
   - Das **Zeichenbudget** der Insel (`zeichenBuchen`) bleibt, wie es ist; es ist keine Konstante des Satzes.
2. **Punkt 1, „`app.js` ändert sich nicht“ wird berichtigt**: Es ändert sich **eine Zeile**, die Ansage des Filters nach PO Z. 608 (`laufFilterAnsage(…, arg, v.ergebnis.auswertung.eingebettet)`, `web/app.js:3742`). Die Auswertung bleibt dort bei einem Aufruf von `laufAuswerten(`, die Fitness Function in A00009 gilt unverändert.
3. **Bezug auf ADR-0037**: Punkt 2 und die Optionen verweisen für die Rollenfarben auf ADR-0037. Dessen Mechanik (Worker, Frist) hat **ADR-0040 abgelöst**; die sieben Rollen und ihre Farben `--kd-tk-*` gelten weiter. Der Verweis gilt künftig ADR-0040.
4. **Wortlaut**: „**Von Claude Code gekürzt**“ steht groß geschrieben (Punkt 3 oben schrieb „von Claude Code gekürzt“), und die Kürzung heißt „**1 weitere Zeile**“ im Singular (Nachtrag 261-architekt-2 schrieb „weitere 1 Zeilen“), beides nach PO Z. 595. Maßgeblich ist der Wortlaut des PO.

## Nachtrag 2026-11-22 N5: Filterwechsel ohne Einfrieren — die Zeilen der Insel sind keine Listenelemente im Sinne der Darstellung (`display:block` statt `list-item`) (Karte #265)

**Status bleibt `Akzeptiert`.** Die Filter aus N1 Punkt 2 und R00239 FA 6 bleiben, wie sie sind: Attribute an der Wurzel der Insel, Wirkung nur über CSS, derselbe Knoten. Neu ist nur **eine Regel im CSS**. Punkte 1–7 und N1–N4 gelten weiter.
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #265, Lauf 265-architekt-1)
**Erprobt durch**: Messprobe 2026-11-22 19:17–19:25 Uhr, Last 2,3–3,5 bei 8 Kernen (über der Messbedingung ≤ 2 des Kriteriums, die Zahlen sind also eher zu hoch), `nice -n 10`, Chromium headless aus `e2e/node_modules` (Playwright 1.65.1), Fenster 1280 × 900. Die Insel ist mit dem echten `laufHtml` (`web/lauf.js:162`, Stand `3867b80e`) gebaut und mit `web/kd-app.css` als statische Seite geladen. Gemessen wird vom Setzen des Attributs bis nach dem nächsten Bild (`requestAnimationFrame`, dann `setTimeout 0`), Median aus 3 bzw. 5 Wechseln. Wegwerf-Skripte liegen in der Ablage der Factory `gemeinsam/scratchpad/arch-265/` (`gen.js`, `mess.js`, `mess2.js`, `stil.js`, `a11y.js`).

### Belegt

- **Ursache ist die Nummerierung der Listenelemente, nicht `content-visibility`, nicht Flexbox und nicht die Selektoren.** Jede Zeile `#lv-insel>li` ohne eigene `display`-Regel hat `display: list-item` (Vorgabe des Browsers für `li`, gemessen an 942 von 1.102 Zeilen). Wird ein Listenelement verborgen, zählt Chromium die Ordnungszahlen der folgenden Elemente derselben Liste neu. Das kostet O(n) je verborgener Zeile, beim Verbergen von k Zeilen also O(n·k). `list-style: none` ändert daran nichts, `counter-reset: none` auch nicht. Das Wiederanzeigen ist billiger, weil es nur einmal je Liste neu nummeriert.
- Gegenproben an 1.003 Zeilen, „Werkzeuge“ aus:

  | Variante | Verbergen | Wiederanzeigen |
  |---|---|---|
  | Ist (`list-item`, `content-visibility: auto`, Flex-Spalte) | 450 ms | 79 ms |
  | ohne `content-visibility` | 427 ms | 165 ms |
  | `contain-intrinsic-size` ohne `auto` | 428 ms | 70 ms |
  | Liste als Block statt Flex | 327 ms | 58 ms |
  | `counter-reset`/`counter-increment: none` | 378 ms | 83 ms |
  | **Zeilen `display: block`** | **7 ms** | **42 ms** |

- Ist-Verlauf (quadratisch): 503 Zeilen 105 ms, 1.003 Zeilen 450 ms, 2.003 Zeilen 1.769 ms, 5.000 Zeilen 58 s (Code-Review #253 A1).
- Eine Regel `.lv-l>li{display:block}` (Spezifität 0,1,1) **überschreibt** `.lv-n{display:grid}` und `.lv-d{display:grid}` und zerstört so die Nachrichten- und Denkzeilen (gemessen: 158 `lv-n` von `grid` zu `block`). Mit `:where(.lv-l)>li` (Spezifität 0,0,1) bleiben sie `grid`. Die Regel des Autors schlägt die des Browsers trotzdem, weil die Herkunft vor der Spezifität entscheidet.
- Der Baum der Hilfstechnik ändert sich nicht: Chromium leitet die Rolle `listitem` aus dem Element ab, nicht aus `display` (Schnappschuss mit und ohne Regel gleich, 7 von 7 `listitem` in `list` „Einträge des Transkripts der Reihe nach“).

### Optionen

Gemessen an der Insel mit 1.003 Zeilen (1.000er-Lauf des Kriteriums) und mit 10.003 Zeilen (T3: 20.000 Einträge an der Zeilengrenze), „Werkzeuge“ aus und wieder an:

| Variante | 1.003 Zeilen | 10.003 Zeilen (T3) | Stärke | Schwäche |
|---|---|---|---|---|
| **A — Zeilen `display: block` über `:where(.lv-l)>li`** (gewählt) | 7–12 / 35–44 ms | 57–92 / 298–377 ms | eine Zeile CSS; Insel, Knoten, `details`-Zustand, Strg+F, Sprung, Fokus und Rolle `listitem` bleiben; linear | beruht auf einem Verhalten von Chromium, das kein Standard festschreibt; ein späteres `li` mit eigener Klasse ohne `display` ist ohne Durchsetzung wieder `list-item` |
| B — Verbergen in Blöcken (je 200 Zeilen ein Block mit `content-visibility: auto`, Klasse je Zeile) | 34 / 65 ms | 53 / 91 ms | auch das Wiederanzeigen schnell, weil verdeckte Blöcke nicht gezeichnet werden | ein `div` in `ol` ist kein gültiges HTML, sonst eine verschachtelte Liste (andere Ansage); Selektoren nur noch über Klassen je Zeile (O(n) im Skript); Sprung in einen Block mit geschätzter Höhe trifft das Nachführen aus N1 „Nach dem Bau“ härter; ohne `content-visibility` am Block bleibt es quadratisch (gemessen 407 ms) |
| C — Klasse je Zeile statt Attribut am Container | 303 / 66 ms | — | Zustand an jeder Zeile sichtbar | bleibt quadratisch, weil die Ursache das Verbergen eines `list-item` ist, nicht der Selektor |
| D — Neuaufbau der sichtbaren Liste aus dem Text (`innerHTML`) | 23 / 85 ms | 1.497 / 2.091 ms | keine verborgenen Knoten | verfehlt 500 ms auf T3; bricht „einmal zeichnen“ (Punkt 5) und klappt aufgeklappte Aufrufe zu (Q4) |
| E — Virtualisierung | nicht gemessen | — | konstante Zahl an Knoten | Strg+F, Textauswahl und Bildschirmleser verlieren Einträge; verworfen wie in Punkt 5 (Z3) und ADR-0039 N1 (C) |

### Entscheidung

1. **Gewählt: A.** In `web/kd-app.css` bei der Regel für `.lv-l>li` (`:1758`) steht `:where(.lv-l)>li{display:block}` mit einem Kommentar zum Grund (Nummerierung je verborgenem `list-item`, O(n·k), dieser Nachtrag). Filter, Selektoren (`:1864–1867`), `laufFilterAnInsel` (`web/app.js:2325`) und die Insel bleiben unverändert. Ansage, Zählung, Sperrform, Sprung und Fokus aus R00239 bleiben damit unberührt.
2. **Regel für jede lange Liste, deren Zeilen über CSS massenhaft verborgen werden**: Die Zeilen dürfen nicht `display: list-item` sein. Das gilt auch für spätere Inseln. Heute betrifft es nur `#lv-insel`.
3. **Messung** wie das Kriterium (PO Z. 615): 1.000 Zeilen der Liste ≤ 200 ms, T3 an der Grenze ≤ 500 ms, Median aus fünf Wechseln je Kästchen hin und zurück. Gemessen sind höchstens 44 ms bzw. 377 ms bei Last 3. Die Wanduhr ist Beobachtung im Bericht, kein Gate (`gemeinsam/gelerntes.md`, „Grenzen, die Arbeit begrenzen“). Das Gate trägt die Stilprobe in der Durchsetzung.

**In Kauf genommen**: Die Lösung beruht auf beobachtetem Verhalten von Chromium, nicht auf einer Zusage der Spezifikation. Ändert ein Browser die Nummerierung, kann die Zeit zurückkommen, ohne dass sich unser Code ändert. Das Wiederanzeigen auf T3 bleibt mit etwa 0,3–0,4 s nah an der Grenze, weil Chromium dann bis zu 10.000 Zeilen wieder in den Layoutbaum nimmt. Reicht das unter Last ≤ 2 nicht, ist B der nächste Schritt (neuer Nachtrag).

### Durchsetzung

- **E2E, Stilprobe (Gate)**: Auf T1 mit allen drei Arten sichtbar gilt für jedes `#lv-insel>li`, dass `getComputedStyle(li).display !== 'list-item'` (Zähler = 0), und jedes `#lv-insel>li.lv-n` und `.lv-d` hat weiter `display: grid`. Mutant „Regel entfernt“ ist rot (Zähler > 0), Mutant „`.lv-l>li{display:block}` statt `:where(…)`“ ist rot (`lv-n` wird `block`).
- **E2E, Rolle**: `ariaSnapshot` der Insel zeigt dieselben `listitem` wie vorher.
- **E2E, Verhalten**: die bestehende Spec von R00239 (Ansage, Zählung, Sperrform, Sprung, Fokus, Marke `el.__probe` an der Insel) bleibt unverändert grün.
- **Messprobe im Bericht des Baus (Beobachtung)**: ein Lauf mit 2.000 Einträgen (≈ 1.000 Zeilen) und T3. Je Kästchen fünfmal hin und zurück, Zeit vom Klick bis nach dem nächsten Bild, Median, mit Last nach `uptime`. Erwartet ≤ 200 ms bzw. ≤ 500 ms.
- **Review-Punkt `architektur-reviewer`**: Eine neue Zeilenart der Insel mit eigener Klasse setzt `display` selbst oder bleibt bei der `:where`-Regel. Sie wird nie `list-item`.

### Folgeaufgaben

- [ ] Entwickler (Karte #265): Regel nach Punkt 1, Stilprobe mit beiden Mutanten, Messprobe als Beobachtung. Keine Änderung an `web/lauf.js` oder `web/app.js`.
- [ ] Merge: Dieser Nachtrag steht auf `karte/265`, abgeleitet von `karte/253`. Auf `main` steht schon N4 (#261). Beim Zusammenführen kommt N5 hinter N4.

## Nachtrag 2026-11-23 N6: Ergebnis mit Farbcodes lesbar (nur eine feste Liste, nie versteckt), fehlgeschlagenes Edit als „nicht angewendet“, Fehlerfarbe nur an Zeile und Ergebnis (Karte #267)

**Status**: `Vorgeschlagen` — bis der product-owner Frage 1 und 2 (siehe Folgeaufgaben) beantwortet hat. Punkt 3 (CSS-Ursache) ist unabhängig davon. Punkte 1–7 und N1–N5 gelten weiter; N6 ändert den Satz aus N4 nur an drei Stellen.
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #267, Lauf 267-architekt-1)
**Erprobt durch**: Zählung am 2026-11-23 über 144 echte Transkripte (nur GET auf :7422, Aufgaben 1–270; Skripte `gemeinsam/scratchpad/arch-267/` der Factory, Kopien nach der Zählung gelöscht). Punkt 3 aus CSS und Bild `etst-261/edit49.png` gelesen, nicht gebaut.

### Belegt

- **ANSI in Ergebnissen ist selten, aber echt**: 18 von 5.357 Ergebnissen (0,3 %) in 11 von 144 Dateien tragen `U+001B`, zusammen 252 Zeichen; in Aufrufen und Nachrichten kein einziges. Davon 228 SGR-Folgen `ESC[…m` mit den Codes 2 (97, dunkler), 22 (97, zurück), 0 (16), 32 (14, grün), 31 (4, rot); 16 `ESC(B` (Zeichensatz, aus `tput sgr0`); 8 Bytes Rauschen in einem binären Auszug (gzip-Kopf im Text). Hauptquelle ist die Fehlerausgabe des Playwright-MCP (`### Error … Call log:`, Bild `pw57.png`: eine Marke je Zeilenrand).
- **Heute** setzt `zeichenBuchen` (`web/lauf.js:134`) jedes `U+001B` als Marke aus dem Budget (1.000 je Text, 10.000 je Lauf, ADR-0036 FA 10): 252 Marken kosten Platz und Lesbarkeit, ändern aber nichts an der Sicherheit. Die Klasse `MARKIERBAR` steht dreimal (`web/lauf.js:127`, `web/lauf-satz.js:572`, `web/diff.js`); ein Node-Test hält sie gleich.
- **Fehlgeschlagenes Edit**: 4 von 48 Edit/Write-Ergebnissen sind `<tool_use_error>File has not been read yet…` (8 %). `schrittHtml` (`web/lauf.js:320`) kennt `s.fehler`, `aufrufSatz` (`web/lauf-satz.js:260`) bekommt es nicht und setzt den Diff mit `.lv-dif .add` grün.
- **Rote Aufruf-Schrift ist ein Klassenzusammenstoß, keine Absicht**: das Element heißt `<details class="lv-s fehl">`; die allgemeine Regel `.fehl{color:var(--kd-warn);font-size:12px}` (`web/kd-app.css:673`, für Meldungen anderswo) färbt es, `.lv-s-ganz` (`:1811`) setzt keine Schriftfarbe, also erben Aufruf, Diff-Text und Ergebnis das Rot (`edit49.png`). Gewollt sind nur `.nm`, `.eg`, `.ab`, `.du` der Zeile (`:1810`). Dasselbe Element erbt `font-size:12px`.

### Optionen (Punkt 1, Farbcodes)

| Variante | Stärke | Schwäche |
|---|---|---|
| A — Marken bleiben (heute) | nichts versteckt | 252 Kästchen verdecken den Text; löst die Karte nicht |
| B — alle `ESC[…m` ausblenden, ein Satz „n Farbcodes ausgeblendet“ | kleinster Bau, keine Farbe zu prüfen | Bedeutung (rot/grün, gedämpft) geht verloren; die Folgen verschwinden ohne Spur im Text |
| **C — feste Liste übersetzen, alles andere bleibt Marke** (empfohlen) | die Farben kommen an; unbekanntes, Fremdes und Binäres bleibt sichtbar markiert | eine Liste und ein Zustand je Ergebnis zu pflegen |
| D — ANSI voll auslesen (Hintergrund, 256 Farben, `8` verbergen, `7` umkehren) | wie ein Terminal | öffnet genau den Weg, Text zu verstecken (Schrift in Hintergrundfarbe, `conceal`); verworfen |

### Entscheidung (Soll, bei Wahl von C)

1. **Übersetzt wird nur im Ergebnis**, nie in Aufruf, Nachricht, Name, Pfad oder Kurzform der Zeile (dort bleibt die Marke, N4 gilt). Erlaubt sind SGR-Folgen `ESC[<p>(;<p>)*m` mit höchstens 4 Teilen, jeder Teil leer, `0`, `1`, `2`, `22`, `31`, `32` oder `33`. Jede andere Folge (`ESC(B`, `ESC[8m`, `ESC[30m`, `ESC[38;5;…m`, Hintergründe, `ESC[` ohne Abschluss, einzelnes `ESC`) bleibt Marke wie heute.
2. **Wirkung nur über feste Klassen**, nie `style` und nie ein Wert aus dem Text: `0` und `22` setzen zurück, `1` fett, `2` `--kd-muted`, `31` `--kd-status-error-ink`, `32` `--kd-status-ok-ink`, `33` `--kd-status-warn-ink`. Keine Hintergründe, keine Deckkraft, kein `display`. Der Zustand gilt je Ergebnis und endet mit ihm. Folgen, die den Zustand nicht ändern, öffnen keine neue Spanne.
3. **Nichts kann sich verstecken**: jede erlaubte Farbe hat auf der Fläche des Ergebnisses in beiden Themes mindestens 4,5 : 1; die Folge selbst verschwindet nur, wenn sie ganz in der Liste steht. Die Rohform bleibt im Transkript-Download.
4. **Grenzen**: höchstens 2.000 Spannen je Ergebnis (`SATZ_GRENZEN.farben`); darüber bleiben die weiteren Folgen Marken und laufen in das Budget von FA 10. Erlaubte Folgen zählen **nicht** gegen das Budget (sonst äßen 252 `U+001B` die 1.000 je Text); `MARKIERBAR` bekommt dafür einen Vorgriff („`U+001B` nicht, wenn eine erlaubte Folge folgt“), an allen drei Orten gleich, der Gleichheitstest wird entsprechend erweitert.
5. **Ort**: reine Funktion in `web/lauf-satz.js` (Zeile + Zustand → Teile mit Klasse), vom `zeile`-Parameter von `ergebnisSatz` genutzt; `web/lauf-satz.js` bleibt frei von `innerHTML`, `document` usw. (Fitness Function N4).
6. **Fehlgeschlagenes Edit/Write**: ist `s.fehler`, setzt `aufrufSatz` über dem Diff eine Zeile „Nicht angewendet — der Schritt ist fehlgeschlagen.“ (sichtbarer Text, nicht nur Farbe) und der Diff bekommt die Klasse `nicht-angewendet`: keine grünen und roten Flächen, Zeilen gedämpft, `+`/`−` bleiben; der Lesetext „hinzugefügt:/entfernt:“ wird „vorgesehen hinzuzufügen:/zu entfernen:“. Der Diff bleibt sichtbar, weil er zeigt, was beabsichtigt war. Ohne Ergebnis im Transkript bleibt der Diff wie heute (der Ausgang ist unbekannt, `KEIN_ERGEBNIS` steht darunter).
7. **Fehlerfarbe nur an der Zeile und am Ergebnis**: `.lv-s-ganz` setzt `color:var(--kd-text)` zurück (das ist die Ursache), `.lv-s.fehl .lv-erg` bekommt `color:var(--kd-status-error-ink)`; Aufruf, Diff, Felder bleiben neutral. Das allgemeine `.fehl` wird nicht umbenannt (viele Treffer in `web/kd-app.css`, kein Gewinn).

**In Kauf genommen**: Eine Liste von sieben Codes deckt, was die Zählung zeigt (2, 22, 0, 31, 32); `1` und `33` sind Zugabe für Cargo- und Testausgaben ohne Beleg im Bestand. Ein Programm, das eine andere Folge schreibt, zeigt weiter Marken. Die Farben tragen keine Bedeutung allein: der Fehlerzustand steht als Wort „Fehler:“ in der Zeile (N1).

### Durchsetzung

- **Node-Test (Gate), rein**: Eingabe `ESC[2m a ESC[22m` → Teile mit Klasse, kein `U+001B` im HTML; je Gegenprobe bleibt Marke: `ESC[8m`, `ESC[30m`, `ESC[38;5;196m`, `ESC[0;8m`, `ESC(B`, einzelnes `ESC`, 5 Teile; 3 MiB `ESC[31m` → höchstens 2.000 Spannen, Rest Marken im Budget. Test „`MARKIERBAR` gleich an drei Orten“ mit dem Vorgriff.
- **Mutanten**: „`8` in der Liste“ und „Hintergrundfarbe zugelassen“ je von einer Probe getötet; „Zustand läuft über das Ergebnis hinaus“ von einer Zwei-Ergebnis-Probe.
- **E2E**: Ergebnis aus `pw57` (Call log) zeigt 0 Marken und gedämpfte Spannen; Kontrast ≥ 4,5 : 1 je Klasse in hell und dunkel (`getComputedStyle`); Edit mit `tool_use_error` zeigt die Zeile „Nicht angewendet“ und keine `.add`-Fläche (Mutant „Klasse fehlt“); im Fehlerschritt hat Aufruf-Block die Farbe `--kd-text`, Zeile und Ergebnis die Fehlerfarbe (Mutant „Regel entfernt“).
- **Review-Punkt `architektur-reviewer`/`security-reviewer`**: eine neue erlaubte Folge muss Farbe aus dem Token-Satz nehmen und die Kontrastprobe bestehen; Hintergrund, `conceal`, `invert` und Deckkraft sind nie erlaubt.

### Folgeaufgaben

- [ ] product-owner: Fragen 1–3 aus dem Bericht (Variante C oder B; Diff bei Fehlschlag gedämpft statt verborgen; Kurzform).
- [ ] Entwickler (Karte #267, eine Karte, Reihenfolge 7 → 6 → 1–5): je Punkt Probe zuerst; Änderungen in `web/kd-app.css`, `web/lauf-satz.js`, `web/lauf.js` (`schrittHtml` gibt `s.fehler` an `aufrufSatz`, Ergebnis-Zeile mit Zustand), Probe-Dateien.
