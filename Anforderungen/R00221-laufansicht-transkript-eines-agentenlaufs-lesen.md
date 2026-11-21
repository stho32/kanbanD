---
id: R00221
status: Neu
datum: 2026-11-21
---

# R00221: Laufansicht — Transkript eines Agentenlaufs lesen

## Beschreibung

Karte #210, Scheibe D2 des Feinschnitts (Zuschnitt PO Z. 384–388). Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) (Akzeptiert, 24901a16), Punkte 1–7. Produkt `AI-Team/po-entscheidungen.md` Z. 371 (Format), 372 (Vollansicht), 374 („nie still“), 468, 472 (Wortlaute 14–20), 475 (Freigabe der Zeichnung), 481 (genau eine Ansage), 490 (Wortlaute für Entpacken und unbekannte Kennung, Grenze ist kein Fehler).

**Umfang:** Zeilen der Ansicht „Läufe“ ([R00219](R00219-ansicht-laeufe-im-aufgabenfenster.md)) mit dem Zustand `vorhanden` tragen „Ansehen“. Es führt auf eine eigene Seite mit eigener Adresse hinter `/aufgabe/<nr>`, wie die Review-Seite. Die Seite zeigt Kopf mit Rückweg, eine Leiste mit den Angaben des Laufs und die Einträge des Transkripts der Reihe nach. Nachrichten stehen offen mit Markdown, Werkzeugaufrufe und -ergebnisse sind eingeklappt. Eine defekte Zeile steht an ihrer Stelle, die Nachbarn bleiben. Am Server, an OpenAPI und am Format ändert sich nichts. Neu am Server ist nur ein API-Test. **Nicht in D2:** Suche, Filter, Sprung zu Commits (Z. 372), Herunterladen, Seiten oder Nachladen.

**Name:** „Aufgabe“, nie „Karte“; „Laufansicht“ ist die Seite, „Läufe“ die Ansicht im Aufgabenfenster.

**Zeichnung:** D0009 `#laufansicht` (Bilder 1–6), freigegeben in PO Z. 475. Die Zeichnung ist die Quelle für Aussehen, Abstände und Anordnung; diese Anforderung legt Verhalten und Inhalte fest. Abweichend von der Zeichnung trägt die Fehlermeldung kein `role="alert"` (PO Z. 481 b). Die Notiz zieht der gestalter nach.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 109: „die Läufe der Agenten, die an ihr gearbeitet haben“).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — Einstieg aus der Ansicht „Läufe“, Rückweg dorthin
- [Hauptbereich](../Dokumentation/Domaenenwissen/D00002-hauptbereich.md) — die Laufansicht steht im Hauptbereich wie die Review-Seite
- [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) — Leiste live, Einträge nie neu gelesen
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — bis einschließlich 640 px
- Lauf, Transkript, Eintrag, Kennung fehlen im Glossar; es gelten die Wörter von R00216, R00219 und ADR-0028 (Kennung `role@at`).

## Geschäftlicher Nutzen

Wer eine Aufgabe in der Abnahme prüft, sieht seit R00219, welche Läufe es gab und ob ihr Transkript hier liegt, kann es aber nicht lesen. Heute bleibt dafür nur `zcat` auf dem Rechner. Mit der Laufansicht liest der Mensch, was der Agent gelesen, gedacht und getan hat, mit einem Klick von der Zeile aus.

## Funktionale Anforderungen

1. **Einstieg** (ADR-0041 Punkt 2): Nur Zeilen von „Läufe“ mit Transkript im Zustand `vorhanden` tragen „Ansehen“, als echten Verweis (`a[href]`) auf die Laufadresse. Jede andere Zeile bleibt ohne Ziel (ADR-0039 Punkt 9). Ein einfacher Linksklick öffnet die Laufansicht im selben Tab. Mittelklick und „In neuem Tab öffnen“ bleiben Verweise.
2. **Adresse** (ADR-0041 Punkt 1): `#/board/<slug>/aufgabe/<nr>/lauf?kennung=<encodeURIComponent(kennung)>` bzw. `#/aufgaben/aufgabe/<nr>/lauf?kennung=…`. Die Kennung aus der Adresse ist nur Suchtext: höchstens 100 Zeichen, ohne Steuerzeichen. Sie wird nur als Text mit den `kennung` in `transkripte` der Aufgabe verglichen. Angefragt wird mit der gespeicherten Kennung des Treffers. Ohne Treffer geht keine Anfrage hinaus.
3. **Rückweg** „‹ #<nr>“: Kam der Mensch über „Ansehen“, geht es zurück wie mit „Zurück“ im Browser. Kam er über Verweis oder Lesezeichen, ersetzt der Rückweg die Adresse durch die des Fensters mit der Ansicht „Läufe“. Danach steht der Fokus auf „Ansehen“ derselben Kennung, sonst auf der Überschrift von „Läufe“, nie auf `body`. Umgekehrt steht beim Öffnen der Laufansicht (Klick oder Enter auf „Ansehen“, Lesezeichen, auch bei unbekannter Kennung) der Fokus auf der Überschrift „Lauf“ (`h1`, `tabindex="-1"`), nie auf `body`.
4. **Kopf und Leiste** (ADR-0041 Punkt 3): Titel „Lauf“ mit „<Rolle> · <Zeitpunkt>“, „liest nur“. Die Leiste zeigt Rolle, Zeitpunkt (`TT.MM.JJJJ hh:mm`), Spalte des Transkripts (eine abweichende Kostenspalte als Nebentext „Kosten gebucht in <Spalte>“ wie in R00219 FA 3), Betrag (Form wie in „Läufe“, ohne Kosten „—“) und Größe aus `bytes` (Form wie bei den Anhängen, `groesse` in `web/ansicht.js`: 281.600 Byte → „275,0 KB“). Alles kommt aus dem Stand der Aufgabe, ohne Aufruf von `GET …/transkripte`, und zeichnet bei jedem Live-Ereignis neu.
5. **Lesen** (ADR-0041 Punkt 4): Die Seite liest `GET /api/aufgaben/{nr}/transkripte/{kennung}` einmal beim Aufbau und über „Erneut versuchen“. Sie entpackt im Strom, zählt die Zeilen ab 1 und zeichnet **einmal**: wenn der Strom sauber endet oder die Grenze erreicht ist. Bis dahin steht „Liest das Transkript …“ (Wortlaut 14). Zeilen werden nur an `\n` getrennt; eine Zeile nur aus Leerraum zählt mit, ergibt aber keinen Eintrag. Das Ergebnis des ersten Lesens verschiebt den Fokus nicht. Nach „Erneut versuchen“ steht der Fokus, sobald das Ergebnis gezeichnet ist, auf dem Knopf, wenn das Ergebnis „Erneut versuchen“ trägt (derselbe Knoten), sonst auf der Überschrift „Lauf“, und der Seitenanfang ist sichtbar. `document.activeElement` ist in keinem Fall `body`.
6. **Einträge** (ADR-0041 Punkt 5, PO Z. 372):
   - Gültig ist eine Zeile mit `art` ∈ {`nachricht`, `werkzeugaufruf`, `werkzeugergebnis`}, `wer` ∈ {`mensch`, `agent`, `werkzeug`} und `text` als Text; `zeit` und `name` sind, wenn vorhanden, Text. Unbekannte Schlüssel werden übergangen.
   - **Nachricht** offen: Name (wenn vorhanden), „Agent“/„Mensch“, Uhrzeit, Text als Markdown.
   - **Werkzeugaufruf und -ergebnis** eingeklappt: Name, „Aufruf“/„Ergebnis“ (Wortlaut 20), erste Zeile des Textes gekürzt auf 200 Zeichen, Uhrzeit; aufgeklappt der ganze Text in Mono, umbrechend, nie als Markdown.
   - Uhrzeit: `zeit` nach ISO 8601 mit Versatz oder `Z` wird `hh:mm:ss` in Ortszeit; eine `zeit` in anderer Form entfällt wie eine fehlende. Fehlt `name`, entfällt er.
   - Jede andere Zeile wird an ihrer Stelle der Eintrag „Zeile <n> des Transkripts ist nicht lesbar.“ (Wortlaut 17). Rohtext wird nie gezeigt.
   - Am Ende steht „Ende des Transkripts“ (Wortlaut 16), auch wenn kein Eintrag entstand (gültige Datei ohne Zeile).
7. **Grenze** (ADR-0041 Punkt 4, PO Z. 490 c): höchstens 16 MiB entpackt (16.777.216 Byte, gezählt vor dem Dekodieren) und höchstens 20.000 Zeilen; was zuerst erreicht ist, beendet das Lesen und bricht die Anfrage ab. Eine angefangene Zeile entfällt. Unter den gelesenen Einträgen steht „Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.“ (Wortlaut 15) statt „Ende des Transkripts“. Die Grenze ist kein Fehler: Der eigene Abbruch zeigt nie das Fehlerbild. Erreicht schon die erste Zeile die Grenze, steht nur Wortlaut 15, ohne Eintrag. Die Zahlen stehen nicht in der Oberfläche (Z. 468).
8. **Zustände und Meldungen** (ADR-0041 Punkt 6, PO Z. 472, 490), nur die gezeichneten Bilder:

   | Lage | Bild | Text | „Erneut versuchen“ |
   |---|---|---|---|
   | 404 mit `zustand: fehlt` | 4 | „Das Transkript liegt nicht auf diesem Rechner.“ und die Erklärung der Zeichnung (Wortlaut 18) | nein |
   | anderer HTTP-Fehler (auch 404 `abweichend`/`unlesbar`, 503) | 5 | „Das Transkript ließ sich nicht lesen: <`fehler`> (<Status>).“ (Wortlaut 19) | ja |
   | keine Verbindung, Frist abgelaufen | 5 | „Das Transkript ließ sich nicht lesen: keine Verbindung zum Programm.“ | ja |
   | Entpacken scheitert (abgeschnitten, falsche Prüfsumme, zwei gzip-Glieder, auch bei Status 200) | 5 | „Das Transkript ließ sich nicht lesen: Die Datei lässt sich nicht entpacken.“ | ja |
   | Kennung der Adresse steht nicht in `transkripte` der Aufgabe | 5 | „Das Transkript ließ sich nicht lesen: An dieser Aufgabe steht kein Lauf mit dieser Kennung.“ | ja |

   Jeder Fehler vor dem Zeichnen ergibt das ganzseitige Bild ohne einen Eintrag; das schon Gelesene wird verworfen. Bei Entpacken und unbekannter Kennung steht kein Status, kein Text des Browsers und kein Text der Adresse. Es gibt keine automatische Wiederholung. Ab dem Klick auf „Erneut versuchen“ bleibt der Knopf derselbe Knoten, trägt `aria-disabled="true"` (Sperrform nach PO Z. 484 S-A) und behält den Fokus, bis das Ergebnis steht; ein Klick darauf in dieser Zeit löst keine zweite Anfrage aus. Eine Antwort gilt nur, solange die Seite dieselbe Aufgabe und Kennung mit derselben Anfrage zeigt; Verlassen der Seite bricht die Anfrage ab. Eine unerwartete Ausnahme beim Lesen oder Zeichnen zeigt „Das Transkript ließ sich nicht lesen: Die Datei lässt sich nicht verarbeiten.“ mit „Erneut versuchen“, nie Text des Browsers.
9. **Live** (ADR-0041 Punkt 7): Ein Live-Ereignis liest das Transkript nie neu und ersetzt die Einträge nicht. Der Knoten der Einträge bleibt derselbe, aufgeklappte Werkzeugaufrufe bleiben offen.
10. **Fremder Text bleibt Text** (ADR-0041 Punkt 5, ADR-0030, ADR-0033 Punkt 8): Nachrichten gehen erst durch das Sichtbarmachen von Bidi- und Steuerzeichen, dann durch `markdownHtml` (maskiert). Name und Werkzeugtext gehen durch das Sichtbarmachen und werden maskiert, nie Markdown. Rolle und Spalte in Kopf und Leiste behandelt die Seite wie R00219 (Bidi-Zeichen entfernt, maskiert). **Budget** (PO Z. 493): Je Text (Nachricht, Name, Werkzeugtext) werden höchstens 1.000 Bidi- und Steuerzeichen einzeln als Marke gezeigt, je Lauf höchstens 10.000. An der Stelle des ersten Zeichens über dem Budget steht einmal je Text „… und <n> weitere Steuerzeichen“ (Einzahl „… und 1 weiteres Steuerzeichen“, n mit Tausenderpunkt; n zählt alle nicht einzeln gezeigten Zeichen dieses Texts), als Text in der Farbe der Marken. Kein nicht gezeigtes Zeichen steht roh im Dokument; der übrige Text und alle weiteren Einträge stehen wie sonst. Ist das Lauf-Budget erschöpft, trägt jeder weitere Text mit solchen Zeichen nur seine Zusammenfassung. Links entstehen nur in Nachrichten (ADR-0030), nie aus Name oder Werkzeugtext (PO Z. 494).
11. **Genau eine Ansage** (PO Z. 481 b): Die Fehlermeldung trägt kein `role="alert"` und kein `aria-live`. Angesagt wird nur im Statusbereich der Seite (`role="status"`, schon im Zustand „lädt“ im Dokument, derselbe Knoten). Er sagt „Liest das Transkript …“ beim Start (auch nach „Erneut versuchen“, PO Z. 484 S-B) und danach den Satz des gezeichneten Zustands: „Ende des Transkripts“, Wortlaut 15, den ersten Satz von Wortlaut 18 oder den Text der Fehlermeldung (offene Frage 1). Bei unbekannter Kennung geht keine Anfrage hinaus; der Statusbereich steht vorher leer im Dokument und erhält nur die Fehlermeldung. Der Text des Statusbereichs ist wortgleich mit dem sichtbaren Satz des Ergebnisses (kein eigener Text im Statusbereich); der sichtbare Satz steht nicht in einem Live-Bereich.

## Nicht-funktionale Anforderungen

- **Begrenzt** (ADR-0041 Q1): Eine gz-Datei bis 10 MB mit beliebigem Inhalt hält den Tab bedienbar; nach FA 7 entsteht höchstens 16 MiB Text.
- **Tempo (Beobachtung, Tag-Kriterium, kein Gate)** (ADR-0041 Punkt 7, Q5): Zeit von der Antwort bis zum gezeichneten Bild für einen Lauf in der Größe des größten echten Laufs (1,6 MB entpackt, 856 Zeilen; Ziel < 300 ms, gemessen 33 ms DOM) und für eine Datei an der Grenze (erwartet ≈ 1–1,5 s), in Chromium, im Bericht. Gemessen nur tagsüber (8–21 Uhr) bei 1-Minuten-Last ≤ 2 beim Start (Lehre #217); nachts gemessene Werte gelten nicht.
- **Breite:** bei 320, 414, 640, 641, 768, 980, 1099, 1100 und 1280 px, hell und dunkel, ohne Querscrollen; gemessen am Dokument und am Bildlaufbehälter (Lehre #217).
- **Ziele:** bei grobem Zeiger Rückweg, jedes `summary`, „Erneut versuchen“ und „Ansehen“ mindestens 48 × 48 px (Zeichnung).
- **Themen:** Kontrastprobe des Projekts (`kontrastVerstoesse`, 4,5:1 Text, 3:1 Symbole und Ränder).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00216 und R00219; die gz-Dateien erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/{nr}/transkripte` ab — der Server prüft nur die Kennbytes, also tragen auch die defekten den Zustand `vorhanden`). Mensch `sh`, Agent `entw1`, Browser headless (Chromium) in `Europe/Berlin`. Board `fabrik` mit `record-transcripts: true`, Aufgabe #1:

| Lauf | Kennung | Transkript | Kosten |
|---|---|---|---|
| L1 | `entwickler@2026-11-20T10:00+01:00` | Spalte „Entwicklung“, Datei G (unten) | „Reviews“, 1,80 USD |
| L2 | `planer@2026-11-20T09:00+01:00` | „Detailplanung“, Datei F (fremder Text) | — |
| L3 | `code-reviewer@2026-11-20T11:00+01:00` | „Reviews“, Datei danach im Ordner gelöscht → `fehlt` | — |
| L4 | `a/b c%?@2026-11-20T13:00+01:00` (Rolle `a/b c%?`) | „Entwicklung“, ein gültiger Eintrag | — |
| L5 | `abgeschnitten@2026-11-20T14:00+01:00` | eine gültige Datei ohne ihre letzten 100 Byte | — |
| L6 | `pruefsumme@2026-11-20T15:00+01:00` | die 856 Zeilen der Größe des größten echten Laufs, CRC32 im Schluss verändert | — |
| L7 | `zweiglied@2026-11-20T16:00+01:00` | zwei gzip-Glieder hintereinander (`cat a.gz b.gz`) | — |
| L8 | `bombe@2026-11-20T17:00+01:00` | ≈ 600 KB gz, 500 MB entpackt, gültige Zeilen zu je ≈ 1 KB | — |
| L9 | `einzeile@2026-11-20T18:00+01:00` | eine einzige Zeile über 16 MiB | — |

**Datei G** (sechs Zeilen):

```
1 {"zeit":"2026-11-20T10:00:41+01:00","art":"nachricht","wer":"agent","name":"entwickler","text":"Ich lese zuerst **die Anforderung**."}
2 {"zeit":"2026-11-20T10:00:42+01:00","art":"werkzeugaufruf","wer":"agent","name":"Read","text":"Anforderungen/R00219.md"}
3 (nur Leerzeichen)
4 {"art":"nachricht"
5 {"zeit":"2026-11-20T09:00:43Z","art":"werkzeugergebnis","wer":"werkzeug","name":"Read","text":"---\nid: R00219\nstatus: Neu"}
6 {"zeit":"gestern","art":"nachricht","wer":"mensch","text":"Passt."}
```

**Datei F**: eine Nachricht `<script>window.pwn=1</script> [x](javascript:window.pwn=2)`, ein Werkzeugaufruf mit `name` `Bash` + U+202E + `hs` und dem Text `echo <img src=x onerror=window.pwn=3>` + U+202E + `abc` in der ersten Zeile.

### API und Lesen

- [ ] **AK 1 Kennung mit Sonderzeichen (Rust, erster Test des Baus).** Gegeben L4 über die API abgelegt, wenn `GET /api/aufgaben/1/transkripte/a%2Fb%20c%25%3F%402026-11-20T13%3A00%2B01%3A00` gerufen wird (`encodeURIComponent` der Kennung), dann antwortet der Server 200 mit genau den abgelegten Bytes. **Ist er rot, hält die Karte** mit der Frage an den architekt (Abhilfe am Server, ADR-0041 Punkt 1), bevor die Oberfläche gebaut wird.
- [ ] **AK 2 Zeilen lesen** (Node an `web/lauf.js`, ADR-0041 „Durchsetzung“):
  - Gegeben Datei G, dann entstehen in dieser Reihenfolge: die Nachricht aus Zeile 1, der Aufruf aus Zeile 2, der Eintrag „Zeile 4 des Transkripts ist nicht lesbar.“, das Ergebnis aus Zeile 5, die Nachricht aus Zeile 6 — fünf Einträge; Zeile 3 ergibt keinen, zählt aber mit (sonst hieße der Fehler „Zeile 3“).
  - Dasselbe Ergebnis, wenn G in Stücke zerlegt ankommt, darunter ein Stück, dessen letztes Byte das `\n` nach Zeile 2 ist, und eines, das ein „ü“ zwischen seinen zwei Bytes teilt.
  - `\r\n` als Zeilenende stört nicht; U+2028 im Text trennt keine Zeile; ein Rest ohne `\n` am Ende ist die letzte Zeile.
  - Falsche `art`, fehlendes `wer`, `text` als Zahl ergeben je den Fehlereintrag; ein unbekannter Schlüssel nicht.
- [ ] **AK 3 Grenze** (Node, dazu E2E mit L8 und L9; PO Z. 490 c):
  - Node: genau 16.777.216 Byte entpackt werden ganz gelesen und enden mit „Ende des Transkripts“, ein Byte mehr endet mit „Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.“; ebenso 20.000 und 20.001 Zeilen. Die an der Grenze angefangene Zeile ergibt weder Eintrag noch Fehlereintrag. **Mutanten** „Grenze erst nach dem Dekodieren gezählt“ und „angefangene Zeile als defekt gezeigt“ sind je rot.
  - E2E: Gegeben L8, wenn die Laufansicht geöffnet wird, dann stehen die gelesenen Einträge und darunter Wortlaut 15; das Fehlerbild steht nicht; die Anfrage wird abgebrochen (gesehen an `page.route` bzw. am Abbruch der Antwort), und danach reagiert der Rückweg auf einen Klick.
  - E2E: Gegeben L9, dann steht nur Wortlaut 15, kein Eintrag und kein Fehlerbild.

### Einstieg, Adresse, Rückweg

- [ ] **AK 4 Einstieg und Rückweg:**
  - Gegeben „Läufe“ an #1 offen, dann trägt jede Zeile mit `vorhanden` (L1, L2, L4–L9) genau ein „Ansehen“ als `a[href]`; L3 trägt keines. Das `href` von L1 lautet `#/board/fabrik/aufgabe/1/lauf?kennung=entwickler%402026-11-20T10%3A00%2B01%3A00`, das von L4 endet auf `kennung=a%2Fb%20c%25%3F%402026-11-20T13%3A00%2B01%3A00`.
  - Ein Linksklick auf „Ansehen“ von L1 zeigt die Laufansicht von L1. Der Rückweg „‹ #1“ führt zum Fenster mit „Läufe“; `history.length` ist danach so groß wie vor dem Klick, und der Fokus steht auf „Ansehen“ von L1.
  - Gegeben die Adresse von L1 als Lesezeichen (frisch geladen), dann führt der Rückweg zum Fenster mit „Läufe“, ohne die Seite zu verlassen, und `history.length` wächst nicht. Wurde L1 inzwischen gelöscht, steht der Fokus auf der Überschrift von „Läufe“. `document.activeElement` ist in keinem Fall `body`.
  - Gegeben die Adresse von L4 (`/`, Leerzeichen, `%`, `?` in der Kennung), dann zeigt die Seite die Leiste von L4 und seinen Eintrag.
- [ ] **AK 5 Adresse ohne Treffer** (Zähler über `page.route` an `…/transkripte/**`, geprüft, nachdem das Fehlerbild steht): Gegeben die Adresse `#/board/fabrik/aufgabe/1/lauf?kennung=niemand%402026-11-20T10%3A00%2B01%3A00`, dann steht „Das Transkript ließ sich nicht lesen: An dieser Aufgabe steht kein Lauf mit dieser Kennung.“ mit „Erneut versuchen“, es ging keine Anfrage an `…/transkripte/…` hinaus, und der Text `niemand` steht nirgends auf der Seite. Dasselbe für eine Kennung aus 101 Zeichen und für eine mit `%0A` (Zeilenumbruch). Mit `kennung=<script>x</script>` entsteht kein `script`-Element.

### Seite, Zustände, fremder Text

- [ ] **AK 6 Seite von L1:** Gegeben die Laufansicht von L1, dann:
  - Kopf „Lauf“ mit „entwickler · 20.11.2026 10:00“ und „liest nur“; Leiste: Rolle „entwickler“, Zeitpunkt „20.11.2026 10:00“, Spalte „Entwicklung“ mit Nebentext „Kosten gebucht in Reviews“, Betrag „1,80 $“, Größe nach `groesse` aus `bytes` von L1; für die Leiste geht kein `GET /api/aufgaben/1/transkripte` hinaus.
  - Einträge nach AK 2: Zeile 1 offen mit Uhrzeit „10:00:41“ und „die Anforderung“ fett (`strong`); Zeile 2 eingeklappt mit „Read“, „Aufruf“, „Anforderungen/R00219.md“ und „10:00:42“; der Fehlereintrag zwischen Aufruf und Ergebnis; Zeile 5 eingeklappt mit „Ergebnis“, erster Zeile „---“ und Uhrzeit „10:00:43“ (aus `09:00:43Z`), aufgeklappt drei Zeilen in Mono; Zeile 6 ohne Uhrzeit und ohne Namen; darunter „Ende des Transkripts“. Kein Rohtext von Zeile 4 (`{"art"`) steht auf der Seite.
  - Solange die Antwort per `page.route` gehalten ist, steht kein Eintrag, nur „Liest das Transkript …“.
  - Ein Werkzeugtext mit erster Zeile aus 250 Zeichen zeigt eingeklappt höchstens 200 davon und „…“, aufgeklappt alle 250.
  - Gegeben eine gültige gz-Datei ohne Zeile (Status 200 per `page.route`), dann steht nur „Ende des Transkripts“, ohne Eintrag und ohne Fehlerbild; der Fokus steht auf der Überschrift „Lauf“.
- [ ] **AK 7 Fehlerbilder** (Status 200 bei L5–L7; Fehler sonst per `page.route`):
  - L5, L6 und L7 zeigen je „Das Transkript ließ sich nicht lesen: Die Datei lässt sich nicht entpacken.“ mit „Erneut versuchen“, **ohne einen einzigen Eintrag** und ohne „(200)“ oder englischen Text des Browsers. L6 ist der Fall, in dem Chromium vor dem Fehler schon Zeilen liefert (gemessen 45 von 856).
  - L3 (`fehlt`) zeigt „Das Transkript liegt nicht auf diesem Rechner.“ mit der Erklärung, ohne „Erneut versuchen“; Kopf und Leiste stehen wie immer.
  - 503 mit `fehler` „Antwortbudget erschöpft“ (per `page.route`) zeigt „Das Transkript ließ sich nicht lesen: Antwortbudget erschöpft (503).“; eine abgebrochene Anfrage zeigt „…: keine Verbindung zum Programm.“. „Erneut versuchen“ liest genau einmal (Zähler) und zeigt bei 200 die Einträge.
  - Gegeben die Antwort für L1 ist gehalten, wenn der Rückweg gewählt und danach freigegeben wird, dann zeichnet die Seite nichts mehr (keine Einträge im Hauptbereich, „Läufe“ bleibt offen).
- [ ] **AK 8 Fremder Text** (L2): `<script>window.pwn=1</script>` steht als Text, `[x](javascript:…)` ergibt kein `a` mit `javascript:`, aus dem Werkzeugtext entsteht kein `img`, und `window.pwn` ist nach dem Aufklappen nicht gesetzt. U+202E im Namen und in der ersten Zeile steht nicht als Zeichen in einem Textknoten, sondern als sichtbare Marke wie in der Review-Seite; „Bash“ steht vor „hs“ in dieser Reihenfolge. Drei Läufe, je mit „Anfang“ davor und „Ende“ danach: A ein Werkzeugergebnis mit 1.000.000 × U+202E, B ein Werkzeugergebnis mit 2.700.000 × `\u0001` (16 MiB entpackt), C eine Nachricht mit 262.144 × U+202E im Namen. Jeder zeigt „Anfang“, höchstens 1.000 Marken, „… und 999.000 / 2.699.000 / 261.144 weitere Steuerzeichen“ und „Ende“; nach dem Lesen wird ein `setTimeout(0)` in weniger als 1 s bedient, die Seite hat weniger als 100.000 Knoten, kein Textknoten enthält U+202E oder U+0001, keine Meldung enthält „Invalid string length“ oder „undefined“. Kontrollpaar: gleich viel Text aus „a“ steht ganz da. Lauf-Budget: bei 11 Werkzeugergebnissen mit je 1.000 × U+202E trägt das elfte nur „… und 1.000 weitere Steuerzeichen“. `[x](https://example.org)` in einer Nachricht ergibt genau ein `a` mit `target="_blank" rel="noopener"`, dieselbe Zeichenfolge im Werkzeugtext kein `a`.

### Live und Bedienung

- [ ] **AK 9 Live hält die Einträge** (ADR-0041 „Durchsetzung“ c): Gegeben die Laufansicht von L1, der Knoten der Einträge trägt eine Marke (`el.__probe = 1`) und der Aufruf aus Zeile 2 ist aufgeklappt, wenn `sh` an #1 einen Kommentar schreibt und eine andere Aufgabe umbenannt wird, dann trägt der Knoten die Marke, der Aufruf ist offen, und es folgt kein weiteres `GET …/transkripte/…`. Wenn danach `entw1` für L2 einen Kosteneintrag bucht und die Laufansicht von L2 offen ist, zeigt ihre Leiste den Betrag ohne Neuladen, und die Marke bleibt. **Mutant** „Einträge bei jedem Zeichnen neu eingesetzt“ macht die Probe rot.
- [ ] **AK 10 Breite, Ziele, Themen, Tastatur, Fokus und Ansage:**
  - **Breite:** bei 320, 414, 640, 641, 768, 980, 1099, 1100 und 1280 px, hell und dunkel, in den Zuständen Einträge (L1, ein Aufruf aufgeklappt mit einer Zeile aus 45.000 Zeichen ohne Leerzeichen), lädt, Grenze, fehlt und Fehler: `scrollWidth ≤ clientWidth` am Dokument und am Bildlaufbehälter der Seite; dazu in „Läufe“ mit „Ansehen“ an `.mod-body` und `.lf-panel` (Lehre #217, auch 641, 768, 980 px).
  - **Ziele:** bei grobem Zeiger Rückweg, jedes `summary`, „Erneut versuchen“ und „Ansehen“ ≥ 48 × 48 px.
  - **Themen:** `kontrastVerstoesse` ohne Befund in allen Zuständen, hell und dunkel; der Fokusring von Rückweg, `summary`, „Erneut versuchen“ (auch gesperrt) und „Ansehen“ ist berechnet `outline-style: solid`, mindestens 2 px und 3:1 gegen die Fläche; erscheint ein Fokusring an der Überschrift „Lauf“, gilt für ihn dasselbe. Der gesperrte Knopf steht in `--kd-faint` mit mindestens 3:1 (PO Z. 484 S-A).
  - **Tastatur:** Tab erreicht Rückweg, jedes `summary` (Enter und Leertaste klappen) und „Erneut versuchen“.
  - **Fokus beim Öffnen:** Gegeben „Ansehen“ von L1 mit Enter, mit Klick und die Adresse als Lesezeichen, wenn die Laufansicht erscheint, dann steht der Fokus auf der Überschrift „Lauf“ (`h1`, `tabindex="-1"`, wie „Review“ der Review-Seite), nicht auf `body`; ein Tab erreicht danach den ersten `summary`. Gegeben die Adresse einer unbekannten Kennung, dann dasselbe Ziel.
  - **Fokus beim Lesen:** Gegeben die Antwort auf „Erneut versuchen“ ist gehalten, dann ist `document.activeElement` der Knopf (nicht `body`) mit `aria-disabled="true"`, und ein zweiter Klick erhöht den Anfragezähler nicht.
  - **Fokus nach dem Ergebnis:** Nach „Erneut versuchen“ steht der Fokus, sobald das Ergebnis gezeichnet ist, auf dem Knopf, wenn das Ergebnis ihn trägt (derselbe Knoten), sonst auf der Überschrift „Lauf“, und der Seitenanfang ist sichtbar; `document.activeElement` ist in keinem Fall `body`. Geprüft für 200 mit Ende (L1), Grenze (L8, L9), 404 `fehlt` (L3) und erneuten Fehler (503), je nach einem ersten 503.
  - **Genau eine Ansage** (PO Z. 481 b): Ein `MutationObserver` zählt Textänderungen in `[role=status],[role=alert],[aria-live]` und deren Inhalt. Je Ergebnis zählt er vom Freigeben der gehaltenen Antwort bis zum gezeichneten Bild genau **eine**, im `role="status"`: bei L1, L8, L9, L3, L5, 503, „keine Verbindung zum Programm“ und unbekannter Kennung (ohne Anfrage; der Statusbereich steht vorher leer im Dokument). Ab dem Klick auf „Erneut versuchen“ zählt er bis zum Ergebnis genau zwei Änderungen („Liest das Transkript …“, dann das Ergebnis), ab der Freigabe genau eine; zweimal derselbe Fehler hintereinander ergibt beide Male eine Ansage. `status.textContent` ist gleich dem sichtbaren Text von „Ende des Transkripts“, Wortlaut 15, dem ersten Satz von Wortlaut 18 bzw. der Fehlermeldung. Die Fehlermeldung trägt kein `role` und kein `aria-live` und liegt in keinem solchen Element. **Mutant** `role="alert"` an der Meldung macht die Zählung rot (zwei).

## Betroffene Verzeichnisstruktur

- neu `web/lauf.js` — reine Funktionen (`zeilenLesen`, `eintragPruefen`, `laufHtml`), Browser und Node wie `web/laeufe.js`
- `web/adresse.js` — Lesen und Bilden der Laufadresse; `web/app.js` — Sicht `lauf`, Anfrage mit den geteilten Fristen von `diffHolen`, Insel, Rückweg und Fokus; `web/ansicht.js` — „Ansehen“ in der Zeile von „Läufe“
- `web/kd-*.css` — Stil nur mit Tokens
- Tests: neu `tests/transkripte_api.rs` (Fall AK 1), `e2e/einheit/lauf.test.js`, `e2e/tests/r00221-laufansicht.spec.js`; erweitert `e2e/einheit/adresse.test.js`, `e2e/tests/r00219-ansicht-laeufe.spec.js` („Ansehen“)

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **B1142** API-Probe Kennung mit `/`, Leerzeichen, `%`, `?` (AK 1) — zuerst; rot ⇒ Halt mit Frage an den architekt.
2. **B1143** Zeilen im Strom lesen und prüfen, rein (AK 2, AK 3 Node).
3. **B1144** Einträge als HTML, rein (AK 6 Teil Einträge, AK 8 Node).
4. **B1145** Adresse, „Ansehen“ und Rückweg (AK 4, AK 5).
5. **B1146** Seite: Kopf, Leiste, Lesen, einmal zeichnen, Grenze, Fehlerbilder, späte Antwort (AK 3 E2E, AK 6, AK 7).
6. **B1147** Insel hält bei Live-Ereignissen (AK 9).
7. **B1148** Breite, Ziele, Themen, Tastatur, Fokus, Ansage (AK 10).
8. **B1149** Probe im echten Programm, Beobachtung Tempo (Tag-Kriterium), Gate, abschließen (AK 1–10).

### Grobentwurf

- `zeilenLesen(strom, {bytes, zeilen})` (async-Generator, rein) — liefert `{nr, objekt | null}` je nicht leerer Zeile und am Ende `{grenze: true | false}`.
- `eintragPruefen(objekt)` (rein) — Eintrag oder `null`.
- `laufHtml(eintraege, grenze)` (rein) — HTML der Liste, nur über `sichtbarText`/`sichtbarHtml`/`markdownHtml`/`esc`.
- `laufAdresseLesen(hash)` / `laufAdresseBilden(basis, nr, kennung)` in `web/adresse.js` (rein).

### Hinweise

- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, `#laufansicht` (Bilder 1–6), freigegeben PO Z. 475; die Notiz zu Z. 481 b und 490 zieht der gestalter nach. Die Zeichnung ist die Quelle für das Aussehen; Kriterien entstehen nicht aus ihr.
- **Vorbild:** Review-Seite (R00207: eigene Sicht hinter `/aufgabe/<nr>`, Marke, Rückweg, Insel, Fristen).
- **Review-Punkte** (ADR-0041): security-reviewer — die Kennung aus der Adresse erreicht nur einen Textvergleich; kein Text des Transkripts geht an `markdownHtml`/`sichtbarHtml` vorbei ins HTML. architektur-reviewer — Lesen und Prüfen nur in `web/lauf.js`, Fristen geteilt, kein Neuzeichnen der Insel bei gleichem Schlüssel.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Integration (Rust):** AK 1 in `tests/transkripte_api.rs`.
- **Unit (Node):** `zeilenLesen` über Stückgrenzen, Leerraum, `\r\n`, U+2028, Grenzen 16 MiB und 20.000 Zeilen je beidseitig, Mutanten nach AK 3; `eintragPruefen`; `laufHtml` mit fremdem Text; Adresse lesen und bilden.
- **E2E (Chromium, headless):** AK 3–10; defekte gz-Dateien und die Bombe nur hier (Node liest zwei Glieder, Chromium nicht); Antworten gehalten per `page.route` und über ein Promise freigegeben, Verneinungen erst nach einem sichtbaren Signal.

## Abhängigkeiten

- Abhängig von: [R00219](R00219-ansicht-laeufe-im-aufgabenfenster.md) (I0209, Karte #217, `braucht:217`: Ansicht „Läufe“, `web/laeufe.js`, Insel mit Schlüssel aus HTML); [R00216](R00216-transkripte-der-agentenlaeufe-ablegen.md) (I0206, Ablage und `GET …/transkripte/{kennung}`); [R00207](R00207-review-seite-eines-commits.md) (Muster der Review-Seite); Zeichnung D0009 `#laufansicht` (PO Z. 475).
- Blockiert: nichts.

## Offene Fragen

1. **Text der Ansage im Statusbereich** (an den product-owner, blockiert nicht): Wortlaut 14 legt nur „Liest das Transkript …“ fest; die Zeichnung zeigt den Statusbereich nur im Zustand „lädt“. Empfehlung, gilt bis zur Antwort: Nach dem Lesen sagt derselbe Knoten den Satz des gezeichneten Zustands an — „Ende des Transkripts“, Wortlaut 15, den ersten Satz von Wortlaut 18 oder den Text der Fehlermeldung — ohne neuen Wortlaut. Die UX-Vorprüfung (Lauf 210-ux-reviewer-1) bestätigt die Empfehlung; offen ist nur die Bestätigung des Wortlauts durch den product-owner.

Beantwortet (UX-Vorprüfung, Lauf 210-ux-reviewer-1): Fokus nach „Erneut versuchen“ — auf dem gesperrten Knopf während des Lesens, danach auf dem Knopf, wenn das Ergebnis ihn trägt, sonst auf der Überschrift „Lauf“ (FA 5, FA 8, AK 10); Fokus beim Öffnen auf der Überschrift (FA 3, AK 10).

Beantwortet (PO Z. 490): Wortlaute für Entpacken und unbekannte Kennung (FA 8, AK 5, AK 7); die Grenze ist kein Fehler (FA 7, AK 3).

Beantwortet (PO Z. 493–496): Budget für sichtbar gemachte Zeichen mit Zusammenfassungsmarke, 1.000 je Text und 10.000 je Lauf (FA 10, AK 8); Links nur in Nachrichten klickbar (FA 10, AK 8); unerwartete Ausnahme mit eigenem Wortlaut (FA 8); der Mutantensatz in AK 7 ist gestrichen.

## Manuelle Vorbereitungstätigkeiten

- Beobachtung Tempo tagsüber einplanen (8–21 Uhr, Last ≤ 2).

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 nachführen (ADR-0041 Folgeaufgabe: Sicht `lauf`, `web/lauf.js`, dritte Insel).

## Warum löst diese Anforderung das Problem? (Pflicht)

Seit R00219 sieht der Mensch je Lauf, ob ein Transkript hier liegt, lesen kann er es aber nur mit `zcat`. „Ansehen“ an der Zeile führt auf eine Seite, die die Datei im Browser entpackt und die Einträge so zeigt, wie man einen Lauf liest: Nachrichten offen, Werkzeugausgaben eingeklappt. Damit ist sichtbar, was der Agent gelesen und getan hat, ohne den Rechner zu wechseln. Weil die Seite mit Grenze liest und erst am Ende zeichnet, zeigt sie bei einer defekten oder riesigen Datei nie einen zufälligen Teil als ganzes Transkript und hält den Tab bedienbar. Weil die Adresse nur einen Textvergleich mit den gespeicherten Kennungen auslöst, kann ein fremder Verweis keine Anfrage formen. Der Hebel liegt ganz in der Seite; der Vertrag von #208 bleibt (ADR-0041).

## Notizen

- **Verworfene Alternativen** (ADR-0041): G ganz lesen (Bombe), S2 schrittweise zeichnen (neuer Zustand „Fehler mitten im Strom“), S3 Server entpackt (gegen Z. 375/387); Z1 Neuzeichnen, Z3 Virtualisierung; A2 Index in der Adresse, A3 ohne Adresse.
- **Inkauf:** Ein von Hand getipptes `+` in der Adresse wird Leerzeichen und findet den Lauf nicht (AK 5 greift). Eine Datei mit falscher Prüfsumme zeigt nur den Fehler. Ein frischer Aufbau klappt alles zu.
- **Zehn Kriterien** (Schlank arbeiten); weitere Grenzfälle der Zeilenprüfung gehören dem entwickler.
