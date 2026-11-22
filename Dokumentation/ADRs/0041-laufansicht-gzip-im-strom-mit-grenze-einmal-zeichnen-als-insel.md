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
   - Die Tokens stehen an der **Zeile des Eintrags, der sie trägt**: an einer Nachricht von `agent` oder an einer Schrittzeile, deren Aufruf sie trägt. Weitere Zeilen derselben Antwort zeigen „–“ mit dem Lesetext, dass sie in der Antwort darüber gezählt sind. Einträge von `agent` ohne Antwort mit `tokens` zeigen „–“ mit dem Lesetext „keine Angabe“. Das gilt auch für jeden Eintrag eines Transkripts ganz ohne `tokens` (Wunsch 4 der Karte).
   - Nachrichten von `mensch`, allein stehende Ergebnisse sowie Denk- und Wartezeilen tragen keine Token-Angabe. Die Denkzeile vor einer Antwort und ihre Tokens bleiben getrennt, denn die Lücke gehört nach N1 Punkt 1 dem späteren Eintrag und hängt an keiner Antwort.
   - Die Zeile zeigt die **neuen Tokens** (Punkt 4), unauffällig wie die Dauer. Aufgeklappt stehen die vier Werte einzeln. Die Summe aller vier gehört nicht in die Zeile, denn sie wächst mit dem Kontext und liest sich wie ein Zähler.
   - Die Auswertung liefert je Antwort `{nr, tokens, neu, nachNr}`. `nr` ist die Nummer der Zeile, an der die Tokens stehen. `nachNr` ist die Zeile des Schritts, dessen Ergebnis unmittelbar vor der Antwort stand, sonst `null`.
4. **„Teuerste Schritte“ (Technikfrage 3)**: Variante S3.
   - Rangfolge nach **neuen Tokens** = `ein + cache_schreiben + aus` je Antwort, absteigend, bei Gleichstand die frühere zuerst. Die drei ersten stehen als Liste neben „Längste Schritte“. Gesprungen wird wie dort über einen Knopf mit `data-act` an `lv-s<nr>`, nie über `href="#…"`, und das Nachführen aus N1 „Nach dem Bau“ gilt auch hier. Die Knöpfe tragen eigene Kennungen (`lv-teu-<i>`), damit sie nicht mit `lv-top-<i>` kollidieren.
   - Beschriftet wird eine Antwort mit ihrem ersten Aufruf (`schrittText`), ohne Aufruf mit „Nachricht von Agent“. Ob dazu „nach <Schritt aus `nachNr`>“ steht, entscheidet die Gestaltung. Die Zählung zeigt, dass der Anlass meist das große Ergebnis davor ist.
   - Die Liste erscheint nur, wenn mindestens eine Antwort `tokens` trägt.
   - **In Kauf genommen**: Cache-Lesen zählt nicht mit, obwohl es im Lauf den größten Teil der Kosten ausmacht. Es ist der Preis des schon vorhandenen Kontexts und keinem einzelnen Schritt zuzurechnen. Ein Token Ausgabe zählt so viel wie ein Token Cache-Schreiben. Ohne Preis kann deshalb ein großer gelesener Text vor einer langen Ausgabe stehen, die mehr gekostet hat.
5. **Leistung (Technikfrage 4)**: Es bleibt bei **einer Auswertung je Lesen** und **O(n)**. `tokens` wird je Eintrag in O(1) geprüft. Die laufende Antwort, die Summen und die Zeile des letzten Ergebnisses sind je eine Variable. Die drei teuersten Antworten werden in einem Durchlauf über eine Liste fester Länge 3 bestimmt, ohne alle Antworten zu sortieren. Kopf und Liste zeichnen aus der Auswertung, die Kennzahl aus dem Kosteneintrag kommt live aus der Karte. `grep -c "laufAuswerten(" web/app.js` bleibt 1, und jeder Aufruf von `laufHtml` gibt die Auswertung mit (N1 „Nach dem Bau“).
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
- E2E: Ein gebuchter Kosteneintrag mit `tokens` ändert die Tokens im Kopf, und die Insel bleibt (`el.__probe`, wie N1). Ein Sprung aus „Teuerste Schritte“ lässt `location.hash` gleich und setzt den Fokus auf die Zeile.
- Messprobe als Beobachtung im Bericht, nicht im Gate: 20.000 Zeilen mit `tokens` an jedem Eintrag von `agent` bleiben unter 300 ms (Q5 aus N1 Punkt 7).
- Review-Punkt `architektur-reviewer`: Gerechnet wird nur in `web/lauf.js` und einmal je Lesen. Kein Preis, kein Modell, kein Betrag aus Tokens (PO Z. 569). Keine Liste wird nach allen Antworten sortiert.
- Review-Punkt `code-reviewer`: Die Werte aus `tokens` gehen nur als Zahl ins HTML.

### Folgeaufgaben

- [ ] Planer: **eine Scheibe** „Tokens je Lauf und je Schritt“ als eigene Interaction unter D2 „Laufansicht“: Punkte 1–5, höchstens zehn Kriterien. Das Label `braucht:263` an #253 und `braucht:253` an #261 setzt der Director.
- [ ] PO: Zahlform im Kopf und in der Zeile (Vorschlag: volle Zahl mit Tausenderpunkt wie im Kostenbericht, `web/ansicht.js:319`, oder Kurzform „1,2 Mio.“/„35 Tsd.“); Name der Größe in Zeile und Liste („neue Tokens“); Titel der Liste („Teuerste Schritte“); Lesetexte für „in der Antwort darüber gezählt“, „keine Angabe“ und „aus dem Transkript gezählt“; ob die Liste „nach <Schritt>“ nennt (Empfehlung: ja).
- [ ] Gestalter: D0009 `#laufansicht` nachzeichnen: Feld „Tokens“ im Kopf neben „Kosten“, Token-Angabe in der Zeile neben der Dauer, Liste „Teuerste Schritte“ neben „Längste Schritte“. Freigabe durch den PO.
- [ ] Director/Factory: Die Transkripte, die vor Factory-Commit `89cb890` abgelegt wurden, tragen keine `tokens`. Sie lassen sich mit dem Werkzeug aus N2 Punkt 4 neu ablegen, solange die Rohprotokolle liegen (bis etwa 2026-12-20).
