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
