# ADR-0042: Review-Seite übersichtlicher — Art der Datei aus festen Pfadregeln, „Gesehen“ nur in der Sitzung, Wortmarke über Präfix und Suffix, Pfad und VS Code über `vscode://file` mit der Wurzel aus der Diff-Antwort, „Diff in VS Code“ ohne Serveraufruf durch „Patch herunterladen“ ersetzt

**Status**: Akzeptiert (Punkte 1, 3, 4, 5, 6 und 7). Punkt 2 („Gesehen“ nur in der Sitzung) Akzeptiert vorbehaltlich der Frage an den product-owner, ob „Gesehen“ dauerhaft gelten soll; bis zur Antwort gilt die Sitzung. Nachtrag N1 (2026-11-22, Akzeptiert): Punkt 2 durch N1.4 ersetzt („Gesehen“ dauerhaft in `localStorage`, product-owner), Punkte 6, 7 und 9 präzisiert, Aufklapper bis 1099 px und Modul `web/review-uebersicht.js` ergänzt.
**Datum**: 2026-11-22
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #252, Lauf 252-architekt-1)
**Kontext-Anforderung**: — (Karte #252, Auftrag des Betreibers vom 2026-11-22 nach dem Entwurf „Review ‚Ein Commit‘ – Vorschlag“; die Anforderungen schreibt der planer). Bezug: R00207, R00210, R00217, R00224; ADR-0030 Punkt 4, ADR-0032 (N2.4, N4 S2, N5.1, N6.9), ADR-0033 (Punkte 5 und 8, N1), ADR-0040; Artboard D0009
**Erprobt durch**: Lesende Aufrufe an der Board-Instanz :7422 (Karte #247, drei Verweise; `GET …/commits`, `GET …/diff?commit=…`, `…&datei=web/kd-app.css&format=patch` mit 200 `text/x-diff`, `GET /api/anwendungen`); URL-Behandlung von VS Code 1.147.0 im installierten Programm gelesen (`resources/app/out/mainImpl.js`, `getWindowOpenableFromProtocolUrl`, `shouldBlockOpenable`; `extensions/git/dist/main.js`, `handleUri`). Nichts gebaut.

## Kontext

- **Belegt (Code)**:
  - kanbanD öffnet VS Code schon heute über Links ohne Serveraufruf: `vscode://file${wurzel}/${pfad}` am Knopf `#vsc` im Aufgabenfenster (`web/ansicht.js:392`, Wurzel `S.zustand.ordner`), an defekten Dateien und Boards (`web/ansicht.js:818`, `:890`, `:1019`). `web/app.js:4439` lässt Klicks auf `a[href^="vscode:"]` durch, `web/markdown.js:4` führt `vscode` auf der Positivliste (ADR-0030 Punkt 4). Die Fundstellen setzen den Pfad nur mit `esc` (HTML) ein, nicht URI-kodiert. Das genügt dort, weil die Namen von kanbanD selbst stammen (`aufgaben/<datei>`, `boards/<slug>.md`).
  - Die Zeilennummern des Diffs entstehen in `patchZeilen` (`web/diff.js:36`), gezeichnet in `zeileHtml` (`web/diff.js:279`) als `td.n` mit `aria-hidden`. Die Syntaxfarbe ist eine Auflage auf den Zeilentext mit UTF-16-Versätzen (`farbigHtml`, `web/diff.js:231`; ADR-0040 Punkt 3).
  - Die Review-Seite liest `GET …/commits` schon (`web/app.js:1309`). Eine Commit-Leiste braucht keine neue Anfrage.
  - Der Pfad im Diff ist relativ zur Wurzel des Repositorys (`git rev-parse --show-toplevel` im Startordner, `src/git/arbeitsrepo.rs:240`), nicht zum `repository` des Registers. Belegt am Bestand: `GET /api/anwendungen` liefert für `kd` das Repository `/home/shoff/Projekte/kanbanD/Dokumentation/Planung`, die Wurzel ist `/home/shoff/Projekte/kanbanD`. „Repository plus Pfad im Diff“ ergäbe also einen falschen Pfad. Die Oberfläche kennt die Wurzel heute nicht.
  - `GET …/diff?commit=…&datei=<pfad>&format=patch` gibt es schon (ADR-0032 Punkt 4, N6.9, R00206). Es antwortet mit 200 `text/x-diff`, gezählt im Antwortbudget (N5.1).
- **Belegt (VS Code 1.147.0, installiertes Programm gelesen)**: Ein `vscode://file/<pfad>` öffnet eine Datei, einen Ordner oder einen Arbeitsbereich. Vorher fragt VS Code nach, solange die Nachfrage nicht abgeschaltet ist (`shouldBlockOpenable`). Einen Diff-Modus gibt es auf diesem Weg nicht. Die eingebaute Git-Erweiterung behandelt nur `/clone`. Ein Diff-Weg über URI gäbe es nur mit einer Erweiterung eines Dritten. Das ist eine Vermutung (Deep Links von GitLens), am Netz nicht geprüft.
- **Belegt (Konfiguration)**: Die Board-Instanz lauscht bewusst auf allen Schnittstellen (`AI-Team/factory.md`, „Board im Netz“). Absolute Serverpfade stehen schon in Antworten: `ordner` in `GET /api/zustand`, `repository` in `GET /api/anwendungen`, Pfade in Fehlermeldungen (ADR-0032 N2.4, N4 S2: bewusste Grenze für ein lokales Werkzeug ohne Anmeldung).
- **Belegt (Beispieldaten #247)**: In `b0bea5fd` stehen 8 Dateien. Davon ist 1 Code (`web/kd-app.css`, +2 −3), 4 sind Tests (+297 −3), 3 sind Doku und Planung (`Dokumentation/…`, `Schaetzungen/…`, je +1). In `73188233` stehen 4 Dateien, alle Doku und Planung. Zwei Testdateien sind geändert, nicht neu (`kontrast.test.js` +2 −1, `r00219-…spec.js` +2 −2).
- **Qualitätsziele**:
  - Q1 Übersicht: Bei einem Commit wie `b0bea5fd` steht der Code vor den Tests, die Doku ist eingeklappt, und der Mensch sieht ohne Scrollen, wie viele Dateien er schon gesehen hat.
  - Q2 Last: Die Zusätze ändern das Zeichenbudget nicht (ADR-0033 Punkt 5). Die Wortmarke kostet linear in den Zeichen der geänderten Zeilen, und keine Aufgabe des Hauptfadens dauert länger als 150 ms (Messziel ADR-0040 Punkt 6).
  - Q3 Sicherheit: Die Karte bringt keinen neuen Prozessaufruf und keinen schreibenden Weg am Server. Kein Text aus einem Commit kann einen Link auf ein anderes Ziel als `vscode://file/<wurzel>/<pfad>` lenken.

## Optionen

### Art einer Datei (Frage 1)

| Option | Stärke | Schwäche |
|---|---|---|
| **A1 — feste Pfadregeln in einer reinen Funktion der Oberfläche** (gewählt) | kein Format, kein Server, keine Einstellung. Gängige Konventionen vieler Sprachen werden abgedeckt. Testbar in Node | Ein Projekt mit eigener Ordnung wird falsch eingeteilt. Weil nur sortiert und eingeklappt wird, nie verborgen, kostet das wenig |
| A2 — Regeln je Anwendung im Register (`kanbanD.md`), mit Vorgabe | passt für jedes Projekt | neue Schlüssel, Einstellungsseite, Schreibweg und Prüfung für eine Sortierung. Die Not ist nicht belegt |
| A3 — Einteilung am Server (Feld `art` je Datei) | ein Ort für alle Leser (Factory, Agenten) | Neues Antwortfeld in zwei Routen (ADR-0032 N4/N6). Kein Leser außer der Seite braucht es |

### „Gesehen“ (Frage 3)

| Option | Stärke | Schwäche |
|---|---|---|
| **G1 — `sessionStorage` je Board und Karte** (gewählt) | ohne Server, ohne Format, ohne Commit. Verfällt mit dem Tab | gilt nicht in einem zweiten Tab, nicht nach dem Schließen und nicht auf einem anderen Gerät |
| G2 — `localStorage` | überlebt das Schließen | wächst ohne Ende, braucht Aufräumen. Bleibt am Gerät, ist also nicht „an der Karte“ |
| G3 — dauerhaft an der Karte (Schlüssel im Frontmatter) | für alle Geräte und Menschen | Jeder Klick ist ein Commit im Board-Git (ein Commit je Aktion). Neues Format nach ADR-0032, Schreibweg, Konflikte zwischen mehreren Prüfern, „wer hat gesehen“ ist offen |

### Wortgenaue Hervorhebung (Frage 4)

| Option | Stärke | Schwäche |
|---|---|---|
| **W1 — gleiches Präfix und Suffix je Zeilenpaar, auf Wortgrenzen erweitert, eine Marke je Zeile** (gewählt) | linear, deterministisch, ohne schlechtesten Fall. Genau ein Bereich je Zeile, also höchstens zwei zusätzliche Schnitte in der Farbauflage | Zwei getrennte Änderungen in einer Zeile werden zu einem Bereich mit allem dazwischen |
| W2 — Wort-LCS je Paar (Myers) | genau | quadratisch im schlechtesten Fall. Braucht eine eigene Grenze und mehrere Marken je Zeile in der Farbauflage |
| W3 — CSS Custom Highlight API über Ranges | ändert das DOM nicht | Ranges werden ungültig, sobald die Farbauflage den Zelleninhalt ersetzt (ADR-0040 Punkt 5). Zwei Zeichenwege |

### „Diff in VS Code“ (Frage 7)

| Option | Stärke | Schwäche / Bedrohung |
|---|---|---|
| D1 — Server startet `code --diff alt neu` | echter Diff in VS Code | T1 CSRF: Jede Webseite, die der Betreiber öffnet, kann `POST http://127.0.0.1:7422/…` senden. kanbanD hat keine Anmeldung und kein Token. „Nur 127.0.0.1“ prüft die Gegenstelle, und die ist dabei der eigene Browser. Gegen DNS-Rebinding hilft nur zusätzlich eine Prüfung von `Host`/`Origin`, die kanbanD nicht hat. T2 Argument-Einschleusung: Pfade aus Commits, die mit `-` beginnen, werden Optionen von `code` (`--install-extension`, `--extensions-dir`). T3 Alt- und Neustand müssen als Dateien geschrieben werden: Plattenplatz, Aufräumen, Größe bis 8 MB, Symlinks. T4 `code` aus `PATH` und ohne Anzeige, wenn kanbanD als Dienst läuft. T5 Das Board ist im Netz: Ein Gerät im Netz löst Prozesse auf dem Rechner des Betreibers aus, wenn die Adressprüfung fehlt oder falsch ist |
| D2 — D1 nur, wenn die Gegenstelle 127.0.0.1 ist | schließt T5 | T1 bis T4 bleiben. Der Schutz hinge an einer neuen Sicherheitsmechanik (Token, `Origin`), die es im ganzen Programm nicht gibt |
| D3 — ein `vscode://`-Weg ohne Server | keine Angriffsfläche am Server | Für Diffs gibt es keinen (belegt, VS Code 1.147.0). Nur über eine Erweiterung eines Dritten |
| **D4 — weglassen; Ersatz: „Patch herunterladen“ über die bestehende Route und „VS Code“ an der ersten geänderten Zeile** (gewählt) | kein neuer Weg. Die Route gibt es (`format=patch`, `datei=`), sie zählt im Antwortbudget, VS Code zeigt `.patch` mit Diff-Farben. Die Datei an der Zeile erfüllt den Zweck „im Editor weiterlesen“ | kein Diff nebeneinander in VS Code. Der Patch ist eine Datei im Download-Ordner |

## Entscheidung

1. **Art einer Datei (A1)**: Eine reine Funktion `dateiArt(pfad)` in einem neuen Modul `web/review-uebersicht.js` (oder in `web/diff.js`, Wahl des entwicklers) gibt `code`, `test` oder `doku` zurück. Geprüft wird in dieser Reihenfolge:
   - **test**, wenn ein Ordnerteil `test`, `tests`, `spec`, `specs`, `__tests__`, `e2e` heißt (Groß- und Kleinschreibung egal), oder wenn der Name auf `.test.<x>`, `.spec.<x>`, `_test.<x>`, `_spec.<x>` endet, mit `test_` beginnt oder vor der Endung auf `Test`/`Tests` endet (`FooTests.cs`). Eine `.md` unter `tests/` ist also Test.
   - **doku**, wenn die Endung `md`, `markdown`, `txt`, `adoc`, `rst` ist, oder wenn der erste Ordner `Dokumentation`, `Documentation`, `docs`, `doc`, `Anforderungen`, `Requirements`, `Schaetzungen` heißt.
   - sonst **code**. Im Zweifel ist es also Code (Konfiguration, Workflows, Build-Dateien), denn Code steht oben und offen.
   - Gruppen in der Reihenfolge Code, Tests, Doku und Planung, innerhalb einer Gruppe in der Reihenfolge der API. Die Gruppe Doku ist anfangs eingeklappt und zeigt im Kopf ihre Zahl und ihre Zeilen.
   - **Zeichenbudget (ADR-0033 Punkt 5)**: Die „Reihenfolge der Liste“ ist jetzt die gruppierte. Dateien der Gruppe Doku zählen nicht und unterbrechen die Folge nicht, wie gelöschte Dateien. Eine neue Datei (`A`) mit mehr als 500 hinzugefügten Zeilen (eine Blockgröße) beginnt zu, zählt nicht und unterbricht nicht. Die Ausnahme „die erste Datei immer“ gilt für die erste Datei mit `patch`, die nach diesen Regeln öffnen darf.
   - In „Alle Änderungen“ gelten dieselben Gruppen je Abschnitt einer Anwendung. Folge-Dateien (ADR-0033 N1.4) werden nach ihrem Pfad eingeteilt.
2. **„Gesehen“ (G1)**: Je Datei ein Kästchen „Gesehen“. Gespeichert wird in `sessionStorage` unter dem Schlüssel `kd-gesehen:<board-slug>:<nr>`, ein JSON-Feld von Schlüsseln. Im Ein-Commit-Fall lautet der Schlüssel `<voller hash>\u0000<pfad>`. In „Alle Änderungen“ lautet er `alle\u0000<anwendung>\u0000<pfad>\u0000<fingerabdruck>`. Der Fingerabdruck ist FNV-1a (32 Bit, hexadezimal) über `status`, `alt`, `neu`, `plus`, `minus` und, falls geladen, `patch`. Ändert ein neuer Commit die Datei, gilt sie wieder als ungesehen. Der Fortschritt „k von n gesehen“ zählt **alle** Dateien der Seite, auch die eingeklappte Doku. So bleibt sichtbar, dass Doku ungeprüft ist. Fehlt `sessionStorage` oder wirft es (Kontingent, privat), gilt „Gesehen“ nur bis zum Neuzeichnen, ohne Meldung. Nichts geht an den Server.
3. **„Erwartung geändert“ (Frage 2)**: Ohne Kenntnis der Sprache lässt sich eine geänderte Erwartung nicht sicher erkennen. Eine Liste von Schlüsselwörtern (`assert`, `expect`, `toBe`, `Assert.`) wäre Sprachkenntnis, und ihr Fehlschlag wäre still. Deshalb gibt es nur einen Hinweis am Merkmal einer Datei der Art `test`:
   - `M` mit mindestens einer entfernten Zeile (`minus > 0`): „Test geändert, nicht neu“.
   - `D`: „Test entfernt“.
   - `R` mit `minus > 0`: wie `M`.
   - Ein Bezug auf die Anforderung kommt nur aus den Chips des Commit-Titels (Punkt 5), nicht aus dem Inhalt.
4. **Wortmarke (W1)**: In einem Lauf aufeinanderfolgender `minus`-Zeilen, dem direkt ein Lauf `plus`-Zeilen folgt, wird die i-te mit der i-ten gepaart, aber nur, wenn **beide Läufe gleich lang** sind. Sonst gibt es keine Marke. Je Paar werden das gemeinsame Präfix und das gemeinsame Suffix bestimmt (UTF-16, kein Schnitt in einem Ersatzpaar). Der Rest wird nach außen auf Wortgrenzen erweitert (`\p{L}\p{N}_`). Markiert wird `[von, bis)` auf beiden Seiten, wenn Präfix und Suffix zusammen mindestens 4 Einheiten lang sind und der Rest kürzer ist als die Zeile. Sonst ist ganz oder gar nichts gleich, und es gibt keine Marke. Zeilen über `GRENZE_ZEILE` (1.000) bekommen keine Marke. Die Marke ist ein `<mark class="wm">` in `zelleHtml`. Die Farbauflage (`farbigHtml`) schneidet ihre Stücke an `von` und `bis`, die Marke liegt außen. Sichtbar gemachte Zeichen (Bidi, Steuerzeichen, ADR-0033 Punkt 8) bleiben Marken in derselben Zählung wie bei der Farbe. Berechnet wird beim Zeichnen je Block zu 500 Zeilen, also in denselben Aufgaben wie heute. Ein Lauf, der über eine Blockgrenze geht, wird vorab auf der ganzen Zeilenliste gepaart (linear). Kosten: ein Durchgang über die Zeichen der geänderten Zeilen, ohne schlechtesten Fall. Mit `GRENZE_ZEILE` sind es höchstens 2.000 Vergleiche je Paar.
5. **Commit-Leiste und Kopf** (Frage 5): Die Leiste wird aus der schon gelesenen Antwort von `GET …/commits` gebaut. Sie ist ein `nav` mit Links auf die bestehenden Adressen (`…/review` für „Alle Änderungen“ als erster Eintrag, `…/review?commit=<verweis>` je Commit) und `aria-current="page"` am gezeigten. Je Eintrag stehen Chips, der gekürzte Titel, die Zeit und `+/−`. Verwaiste Einträge tragen ihre Marke (ADR-0032 N1). Die Leiste bricht um (`flex-wrap`), unter 600 px steht sie untereinander. Das Blättern (R00207 FA 3) bleibt. Chips kommen aus dem Titel über eine reine Funktion: `^\[([A-Z]+\d*)\]` (z. B. `R00229`, `DOC`) und danach `^\s*(B\d+):`. Ein Titel ohne diese Form bekommt keine Chips und erscheint unverändert. Die Zweige werden verdichtet: Steht `main` oder `master` in `zweige`, steht „auf main“ (bzw. „auf master“) und „+k Zweige“ zum Aufklappen. Sonst gilt die heutige Liste. Fremder Text bleibt sichtbar gemacht (ADR-0033 Punkt 8).
6. **„Pfad“ und „VS Code“** (Frage 6, bestehendes Muster `web/ansicht.js:392`):
   - **Wurzel aus der Diff-Antwort**: `GET …/diff` (Ein Commit und „Alle Änderungen“) liefert je Anwendung neben `anwendung` das Feld `wurzel`, den absoluten Pfad aus `git rev-parse --show-toplevel`, den der Dienst ohnehin bestimmt. Es gibt keinen neuen Git-Prozess, und `format=patch` bleibt unverändert. Im Gesamt-Diff geht `wurzel` in den `ETag` ein (ADR-0032 N6), sonst lieferte ein 304 nach einer Änderung im Register die alte Wurzel. Der Pfad ist das Ergebnis von `rev-parse` und nicht der Text des Registers.
   - **Erlaubt nach ADR-0032 S2**: Ja. Die Antwort enthält keine neue Art von Information. `ordner` in `/api/zustand` und `repository` in `/api/anwendungen` sind schon absolute Serverpfade, und die Wurzel ist ein Vorfahr des Repositorys. Es gilt dieselbe bewusste Grenze wie in N2.4: lokales Werkzeug ohne Anmeldung, das Board im Netz ist so gewollt. Sie fällt mit einer Bereitstellung für Fremde. Dann fallen `ordner`, `repository` und `wurzel` gemeinsam.
   - **Pfad kopieren**: Kopiert wird `<wurzel>/<pfad>` (bei `D` und `R` der Pfad, der angezeigt wird). Zuerst `navigator.clipboard.writeText`. Diese Schnittstelle gibt es nur in einem sicheren Kontext (HTTPS oder localhost), also **nicht**, wenn das Board von einem anderen Gerät über `http://<ip>:7422` geöffnet wird. Dann steht der Pfad in einem schreibgeschützten Feld, markiert, mit dem Satz „markiert — mit Strg+C kopieren“. Eine stille Fehlanzeige gibt es nicht. Der kopierte Text ist der Rohpfad. Bidi- und Steuerzeichen bleiben darin, so wie sie im Commit stehen. Angezeigt wird er sichtbar gemacht (Punkt 8 ADR-0033).
   - **VS Code**: `vscode://file` + Wurzel + `/` + Pfad. **Jeder Teil von Wurzel und Pfad wird mit `encodeURIComponent` kodiert**, `/` bleibt. Das weicht vom heutigen Muster ab, das nur `esc` nutzt, weil der Pfad hier aus einem Commit kommt. `?`, `#`, `%` oder `:` im Dateinamen dürfen weder Abfrage noch Fragment noch Zeile werden. Danach kommt `:<zeile>`. Am Knopf der Datei ist das die erste Zeile der neuen Seite im ersten Hunk, an einer Zeilennummer die Zahl der neuen Seite (`z.neu`). Nummern der alten Seite (`minus`-Zeilen) sind kein Sprung, denn VS Code öffnet den heutigen Stand. Gelöschte Dateien bekommen keinen Knopf „VS Code“, aber „Pfad“. Dateien, deren Pfad sich nach `sichtbarTeile` ändern würde (Bidi, Steuerzeichen), bekommen ebenfalls keinen Knopf „VS Code“, nur „Pfad“. Grund: Ein Link soll nie auf etwas anderes zeigen, als die Seite anzeigt.
   - Die Zeilennummern werden **nicht** zu je einem `<a>`. Bis zu 200.000 Links würden das DOM verdoppeln. Ein Klick auf `td.n` der neuen Seite wird delegiert (ein Handler am Diffbereich) und setzt `location.href` auf den Link. Die Nummern bleiben `aria-hidden`. Über die Tastatur führt der Knopf „VS Code“ je Datei. Ausnahmen der Klickbehandlung wie `web/app.js:4439`.
   - **Bekannte Grenze**: Die Zeile gilt für den Stand des Commits. Im Arbeitsbaum der Wurzel kann sie verschoben sein oder fehlen (ein älterer Commit, ein Commit nur auf `karte/<nr>` in einem Worktree). Ein Link von einem anderen Gerät öffnet das VS Code *dieses* Geräts mit einem Serverpfad. Beides ist harmlos, die Datei öffnet dann eben nicht oder an anderer Stelle.
7. **„Diff in VS Code“ (D4)**: Es gibt keinen Serverweg und keinen Prozessaufruf. Stattdessen:
   - **„Patch“** je Datei: `<a href="/api/aufgaben/<nr>/diff?commit=<verweis>&datei=<pfad>&format=patch" download="<name>.patch">`. Die Adressteile sind mit `encodeURIComponent` kodiert. `<name>` ist der letzte Pfadteil, auf `[A-Za-z0-9._-]` beschränkt, sonst `datei`. In „Alle Änderungen“ wird `datei=` ohne `commit=` gesetzt, wie die Route es kennt (N6.9). Für Dateien mit `zu_gross_zum_anzeigen` gibt es keinen Link, sie werden dort abgewiesen.
   - „VS Code“ an der ersten geänderten Zeile (Punkt 6) ist der Ersatz für „im Editor weiterlesen“.
   - Ein späterer Diff-Weg braucht eine neue ADR mit Token und `Origin`-Prüfung für alle Prozessaufrufe. Das ist keine Folgekarte dieser Karte.
8. **Lange Zeilen und Ansicht** (Inhalt 6 der Karte): Der Umbruch ist ein Schalter am Seitenkopf (`white-space: pre-wrap` an `.dz td.c`, Klasse am Diffbereich), gemerkt in `sessionStorage`. Bei Umbruch entfällt `contain-intrinsic-inline-size` (die Breite ist dann 100 %). Die geschätzte Höhe bleibt, `auto` merkt sich die echte nach dem ersten Zeichnen. „Nebeneinander“ ist ein zweiter Zeichenweg (zwei Spalten, Paarung wie Punkt 4, ungepaarte Zeilen gegenüber leer) und eine eigene Scheibe. Das Budget zählt dieselben Zeilen.
9. **Größenbalken** je Datei in der Liste: aus `plus` und `minus`, relativ zur größten Datei der Seite, als reines CSS-Element mit dem Text der Zahlen daneben. Es gibt kein neues Feld.

## Konsequenzen

- Positiv: Kein neuer Prozess, keine neue Route, kein schreibender Weg. Die einzige Änderung am Server ist das Feld `wurzel` in einer bestehenden Antwort. Alles andere sind reine Funktionen der Oberfläche, die in Node testbar sind.
- Positiv: Die Doku bleibt im Fortschritt sichtbar. Eingeklappt heißt nicht „erledigt“.
- Inkauf: Feste Regeln teilen eigenwillige Projekte falsch ein (A1). Die Wortmarke fasst zwei Änderungen in einer Zeile zu einem Bereich (W1). „Gesehen“ ist im nächsten Tab weg (G1). Es gibt keinen Diff nebeneinander in VS Code (D4). Zeilen-Sprünge können im Arbeitsbaum daneben liegen.
- Inkauf: `wurzel` ist ein weiterer absoluter Serverpfad in einer Antwort (Punkt 6, gleiche Grenze wie N2.4).
- Durchsetzung (Abnahme-Proben für den planer):
  - Einheit `dateiArt` mit den Pfaden von #247 (1 Code, 4 Tests, 3 Doku), dazu `src/foo_test.go`, `FooTests.cs`, `tests/fixtures/a.md` → test, `README.md` → doku, `Cargo.toml` und `.github/workflows/ci.yml` → code.
  - Einheit Wortmarke: `a = 1` gegen `a = 2` ergibt eine Marke `[4,5)`. Ungleich lange Läufe ergeben keine Marke. Eine ganz neue Zeile ergibt keine Marke. Ein Ersatzpaar am Rand wird nicht geteilt. Bei 2 × 1.000 Zeichen kommen höchstens 2.000 Vergleiche heraus (Zähler). Mit Farbauflage ist der Text Zeichen für Zeichen gleich dem ohne Marke.
  - Einheit Link: Der Pfad `a/b?c#d%e:12.rs` mit der Wurzel `/w x` ergibt `vscode://file/w%20x/a/b%3Fc%23d%25e%3A12.rs:<zeile>`. Ein Pfad mit U+202E ergibt keinen Link. Der Mutant „nur `esc`“ wird rot.
  - API: `wurzel` in beiden Diff-Formen gleich `git rev-parse --show-toplevel`, auch wenn `repository` ein Unterordner ist (Bestand `kd`). Nach einer Änderung des Registers kommt kein 304 mit alter Wurzel. `format=patch` ist bytegleich zu vorher.
  - E2E: Bei #247 `b0bea5fd` ist die Reihenfolge Code, Tests, Doku, die Doku ist zu, und es steht „0 von 8 gesehen“. Ein Haken ergibt „1 von 8“, das Neuladen im selben Tab behält ihn, ein neuer Kontext nicht. Das Zeichenbudget mit Doku-Gruppe und großer neuer Datei folgt den Fällen aus Punkt 1. Kein `longtask` über 150 ms mit Wortmarke und Farbe bei 10.000 Zeilen.
  - Clipboard: Ohne `navigator.clipboard` (Kontext über `http://<ip>`) steht das markierte Feld da, und es gibt keinen Fehler in der Konsole.
  - Review-Punkt für code-reviewer und security-reviewer: kein `spawn` und kein `Command::new` außer `git` neu im Diff der Karte.

## Folgeentscheidungen / Aufgaben

- [ ] gestalter: D0009 nachzeichnen. Dazu gehören die Gruppenköpfe mit Zahl und Zeilen, das Kästchen „Gesehen“ mit „k von n gesehen“, die Commit-Leiste (umbrechend, untereinander unter 600 px), die Chips im Kopf, „auf main +k Zweige“, die Knöpfe „Pfad“, „VS Code“ und „Patch“ je Datei, das markierte Pfadfeld ohne Zwischenablage, die Wortmarke in Hell und Dunkel (Kontrast zur Farbe von `add` und `del`), die Schalter „Umbrechen“ und „Nebeneinander“ und der Größenbalken.
- [ ] product-owner: siehe Fragen im Bericht des architekts, Karte #252 (dauerhaftes „Gesehen“, Schwelle der großen neuen Datei, Wortlaute).

## Quellen / Bezüge

- `web/ansicht.js:392`, `:818`, `:890`, `:1019`; `web/app.js:1309`, `:4439`; `web/markdown.js:4`; `web/diff.js:36`, `:231`, `:274–316`; `src/git/arbeitsrepo.rs:228–240`
- VS Code 1.147.0, `resources/app/out/mainImpl.js` (`getWindowOpenableFromProtocolUrl`, `shouldBlockOpenable`), `resources/app/extensions/git/dist/main.js` (`handleUri`: nur `/clone`), gelesen am 2026-11-22
- ADR-0030, ADR-0032, ADR-0033, ADR-0040; R00206, R00207, R00209, R00210, R00217

## Nachtrag 2026-11-22 N1: nach dem Bau von S1 — Balken je Gruppe, Aufklapper bis 1099 px, Modul `web/review-uebersicht.js`; „VS Code“ an der ersten hinzugefügten Zeile, kein Diff in VS Code; „Gesehen“ dauerhaft im Browser (Karte #252)

**Status bleibt `Akzeptiert`.** Der Nachtrag führt die ADR an den Bau von S1 (`karte/252` bis 9f83f5d9, R00235) und an die Entscheidungen von product-owner und Betreiber heran. N1.1 und N1.2 beschreiben Gebautes (Ist), N1.3 und N1.4 sind Soll für die Folgekarten #255 (S4) und #257 (S3). Der Text der Punkte 1–9 oben bleibt stehen; wo er abweicht, gilt dieser Nachtrag.
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #252, Lauf 252-architekt-2)
**Erprobt durch**: S1 gebaut und geprüft (Commits 37b47c27 bis 9f83f5d9; `e2e/tests/r00235-review-gruppen.spec.js`, Einheitentests; Architektur-Review 252-architektur-reviewer-1 bestanden). N1.3 und N1.4: nichts gebaut.

### Anlass

- Der architektur-reviewer meldet Drift zu Punkt 9: oben steht „relativ zur größten Datei der Seite“, Code und po-entscheidungen Z. 548 rechnen je Gruppe.
- Der Aufklapper „Dateien (<n>) und Commits“ (po-entscheidungen Z. 549) ist gebaut, steht aber in keiner Entscheidung.
- po-entscheidungen Z. 545 präzisiert Punkt 6, Z. 534–535 kippen Punkt 2. Der Betreiber hat Z. 533 entschieden (Kommentar an #252, 2026-11-22 09:05).

### N1.1 Größenbalken je Gruppe (präzisiert Punkt 9; Ist)

- Die Skala ist die **größte Summe `plus + minus` derselben Gruppe**, nicht der Seite (Z. 548). In „Ein Commit“ sind das die Gruppen Code, Tests, Doku und Planung der Seite. In „Alle Änderungen“ ist es die Gruppe **je Abschnitt** einer Anwendung.
- Je Zahl über 0 gibt es einen Teil mit dem Anteil `zahl / größte Summe`. Jeder Teil ist **mindestens 1 px** lang. Eine 0 ergibt keinen Teil.
- Die volle Länge (44 px, `--rv-balken`) und die Mindestlänge legt allein das CSS fest. Die Rechnung liefert nur Anteile.
- Der Balken bleibt `aria-hidden`. Die Aussage tragen die Zahlen daneben und die Zahlen im Gruppenkopf. Sie tragen auch den Vergleich über Gruppen hinweg.
- Fundstellen: `groessteSumme`, `balkenTeile` (`web/review-uebersicht.js`); `gruppierteListeHtml`, `balkenHtml` (`web/diff.js:437`, `:451`); „Alle Änderungen“ über `diff.gruppierteListeHtml` (`web/gesamt.js:243`); `.rv-gb` (`web/kd-app.css:1672–1674`).
- Inkauf: Gleich lange Balken in zwei Gruppen bedeuten nicht gleich viele Zeilen. Das ist gewollt, denn gelesen wird Gruppe für Gruppe (Z. 538).

### N1.2 Aufklapper „Dateien (<n>) und Commits“ und das Modul der Gruppierung (ergänzt Punkt 1; Ist)

- **Bis 1099 px** steht die linke Spalte (Dateiliste und Commits) hinter dem Knopf „Dateien (<n>) und Commits“. So steht der Code auf schmalen Breiten zuerst (Z. 549). Ab 1100 px blendet das CSS den Knopf aus, und die Liste steht links. Die Grenze ist die bestehende von `.rv-rumpf`, keine neue Zahl.
- Jede Adresse beginnt mit zugeklapptem Aufklapper, auch beim Blättern zu einem anderen Commit (`railOffen: false`). Der Zustand lebt nur in `S.ui.review` und wird nirgends gespeichert. Der Knopf trägt `aria-expanded` und `aria-controls`, nach dem Klick bleibt der Fokus auf ihm.
- `<n>` ist in „Ein Commit“ die Zahl der Dateien des Commits. In „Alle Änderungen“ ist es die Summe über die Abschnitte, und der Knopf steuert die Listen aller geladenen Abschnitte mit Dateien.
- Fundstellen: `reviewAufklapperHtml` (`web/app.js:1953`), Aufrufe `:1885` (Alle Änderungen) und `:1943` (Ein Commit), Anfangszustand `:1170`, Handler `review-rail` `:3619`; CSS `web/kd-app.css:1676–1682`.
- **Modul `web/review-uebersicht.js`** (Wahl aus Punkt 1 getroffen): reine Funktionen ohne DOM, im Browser und in Node nutzbar wie `web/diff.js`, vor `diff.js` geladen. Es enthält:
  - `dateiArt(pfad)` → `code` | `test` | `doku` nach Punkt 1
  - `dateiPfad(d)` → Pfad der Einteilung: `pfad` einer Folge-Datei (ADR-0033 N1.4), sonst der neue, bei `D` der alte
  - `dateiGruppen(dateien)` → Gruppen `{art, name, indizes, n, plus, minus}` in fester Reihenfolge, leere entfallen
  - `gruppierteFolge(dateien)` → Indizes in der Folge, in der gezeichnet und das Budget gezählt wird
  - `testHinweis(d)` → „bestehender Test geändert“ | „Test gelöscht“ | '' (Punkt 3, Wortlaut Z. 537)
  - `grosseNeueDatei(d)` → `A` mit mehr als 500 hinzugefügten Zeilen (Z. 536)
  - `groessteSumme(dateien, indizes)`, `balkenTeile(d, groesste)` → N1.1
- Das Modul hängt von nichts ab. `web/diff.js` und `web/gesamt.js` lesen es. Ausgeliefert wird es über die bestehende Liste der eingebetteten Dateien (`src/web/statisch.rs:30`). Am Server kommt nichts anderes dazu.

### N1.3 „VS Code“ an der ersten hinzugefügten Zeile, kein Diff in VS Code (präzisiert Punkte 6 und 7; Soll #255)

- **Sprungziel des Knopfs „VS Code“** ist die **erste hinzugefügte Zeile** der Datei (Nummer der neuen Seite, Z. 545). Hat die Datei keine hinzugefügte Zeile, gilt die erste Zeile der neuen Seite im ersten Hunk, wie in Punkt 6. Hat sie keinen Hunk (reine Umbenennung, Binärdatei), steht der Link ohne `:<zeile>`. Diesen letzten Fall ergänze ich als architekt; der planer von #255 prüft ihn als Randfall.
- Der Tooltip nennt dieselbe Zahl („In VS Code an Zeile <z> öffnen“, Z. 537). Nummern an den Zeilen bleiben wie in Punkt 6.
- **Es gibt keinen echten Diff in VS Code.** Der Betreiber hat Z. 533 mit „1“ beantwortet: „Patch“ und der Sprung „VS Code“ an die Zeile genügen. Damit gibt es keine Folgekarte, keinen lokalen Programmaufruf und keine Token- oder `Origin`-Mechanik. Option D4 ist damit endgültig. Der Satz in Punkt 7 „Ein späterer Diff-Weg braucht eine neue ADR …“ bleibt als Bedingung stehen, falls der Betreiber die Frage neu öffnet.
- Durchsetzung bei #255: Einheit „Sprungziel“ mit einer Datei, deren erster Hunk drei Kontextzeilen vor der ersten `+`-Zeile hat (Ziel ist die `+`-Zeile, nicht der Hunk-Anfang), einer Datei nur mit entfernten Zeilen (Ziel ist die erste Zeile der neuen Seite im Hunk) und einer reinen Umbenennung (ohne `:<zeile>`). Der Review-Punkt „kein `spawn` und kein `Command::new` außer `git`“ gilt weiter.

### N1.4 „Gesehen“ dauerhaft im Browser (ersetzt Punkt 2, G1 → G2; Soll #257)

Der product-owner hat G2 gewählt, abweichend von meiner Empfehlung (Z. 534). Sein Grund trägt: Die Review-Seite öffnet in einem eigenen Tab (Z. 367), mit `sessionStorage` wäre der Fortschritt dort und nach jeder Pause weg. Die Schwäche von G2 aus der Tabelle oben („wächst ohne Ende“) löst die Obergrenze unten. G3 (an der Karte) bleibt verworfen.

- **Ort**: `localStorage`, Schlüssel `kanbanD.gesehen.<board-slug>.<nr>` nach dem Muster der übrigen Ansichtswahl (`kanbanD.spalten-zu.<slug>`, `web/app.js:129`).
- **Inhalt**: ein JSON-Objekt `{"zeit": <ms seit 1970>, "gesehen": [<schlüssel>…]}`. Die Schlüssel der Einträge und der Fingerabdruck bleiben wie in Punkt 2 (`<voller hash>\u0000<pfad>` bzw. `alle\u0000<anwendung>\u0000<pfad>\u0000<fingerabdruck>`). Eine geänderte Datei gilt also wieder als ungesehen. `zeit` ist der Zeitpunkt des letzten Setzens oder Entfernens an dieser Karte.
- **Obergrenze**: höchstens 200 Karten je Browser. Wird ein Haken gesetzt und gibt es danach mehr als 200 Schlüssel mit dem Präfix `kanbanD.gesehen.`, fällt der mit der kleinsten `zeit` weg (Z. 534). Ein Wert, der sich nicht lesen lässt, gilt als leer und wird beim nächsten Setzen überschrieben. Beim Aufräumen zählt er als der älteste.
- **Zwei Tabs**: Jeder Haken liest den Wert frisch, ändert genau seinen Eintrag und schreibt zurück. So geht der Haken eines anderen Tabs nicht verloren, außer beide schreiben im selben Augenblick. Das nehme ich in Kauf. Ein Tab, der schon offen ist, zeigt den Haken des anderen erst beim nächsten Zeichnen. Ein `storage`-Ereignis ist nicht nötig.
- **Wirkung des Hakens** (Z. 535): Setzen klappt die Datei ein, Entfernen klappt sie auf. Beim Laden beginnen gesehene Dateien eingeklappt. Wie die Doku (Punkt 1) zählen sie nicht ins Zeichenbudget und unterbrechen die Folge nicht. Die Ausnahme „die erste Datei immer“ gilt für die erste Datei, die danach öffnen darf. Der Fortschritt „<k> von <n> gesehen“ zählt weiter **alle** Dateien.
- **Fehlerpfad** wie in Punkt 2: Fehlt `localStorage` oder wirft es (Kontingent, gesperrt), gilt „Gesehen“ nur bis zum Neuzeichnen, ohne Meldung. Nichts geht an den Server, nichts an die Karte.
- **Durchsetzung** (ersetzt die E2E-Zeile zu „Gesehen“ in den Konsequenzen): Ein Haken ergibt „1 von 8“. Ein neuer Tab im selben Browser-Kontext behält ihn, ein neuer Kontext nicht. Ändert ein neuer Commit die Datei, ist sie in „Alle Änderungen“ wieder ungesehen. Einheit „Obergrenze“: 201 Karten nacheinander gesetzt ergeben 200 Schlüssel, und die älteste fehlt. Ein unlesbarer Wert wirft nicht. Ein Mutant, der `sessionStorage` schreibt, wird im Tab-Test rot.
- Inkauf: „Gesehen“ gilt je Browser und Gerät, nicht je Mensch und nicht an der Karte. Wer im Browser die Website-Daten löscht, verliert den Fortschritt.
