# ADR-0042: Review-Seite übersichtlicher — Art der Datei aus festen Pfadregeln, „Gesehen“ nur in der Sitzung, Wortmarke über Präfix und Suffix, Pfad und VS Code über `vscode://file` mit der Wurzel aus der Diff-Antwort, „Diff in VS Code“ ohne Serveraufruf durch „Patch herunterladen“ ersetzt

**Status**: Akzeptiert (Punkte 1, 3, 4, 5, 6 und 7). Punkt 2 („Gesehen“ nur in der Sitzung) Akzeptiert vorbehaltlich der Frage an den product-owner, ob „Gesehen“ dauerhaft gelten soll; bis zur Antwort gilt die Sitzung. Nachtrag N1 (2026-11-22, Akzeptiert): Punkt 2 durch N1.4 ersetzt („Gesehen“ dauerhaft in `localStorage`, product-owner), Punkte 6, 7 und 9 präzisiert, Aufklapper bis 1099 px und Modul `web/review-uebersicht.js` ergänzt. Nachtrag N2 (2026-11-22, Akzeptiert): Punkt 6 ergänzt (`ETag` von „Ein Commit“ mit dem Startordner, ohne Git, kein eigener Versionsteil), Wortlaute an Punkt 3 nach N1.2. Nachtrag N3 (2026-11-23, Akzeptiert): Fingerabdruck von N1.4 ohne `patch`. Nachtrag N4 (2026-11-23, Akzeptiert): Meldung bei nicht speicherbarem „Gesehen“ ersetzt „ohne Meldung“ (Punkt 2, N1.4, N3). Nachtrag N5 (2026-11-23, Akzeptiert): Punkt 8 präzisiert (Umbrechen in `localStorage` statt `sessionStorage`, Breite der Blöcke als Eigenschaft `--bb`, Umbruch nur per Klasse, Leseposition wird gehalten).
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
   - `M` mit mindestens einer entfernten Zeile (`minus > 0`): „Test geändert, nicht neu“. *(Wortlaut nach N1.2 und N2.4: „bestehender Test geändert“)*
   - `D`: „Test entfernt“. *(Wortlaut nach N1.2 und N2.4: „Test gelöscht“)*
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
8. **Lange Zeilen und Ansicht** (Inhalt 6 der Karte): Der Umbruch ist ein Schalter am Seitenkopf (`white-space: pre-wrap` an `.dz td.c`, Klasse am Diffbereich), gemerkt in `sessionStorage` *(ersetzt durch N5.1: `localStorage`)*. Bei Umbruch entfällt `contain-intrinsic-inline-size` (die Breite ist dann 100 %). Die geschätzte Höhe bleibt, `auto` merkt sich die echte nach dem ersten Zeichnen. „Nebeneinander“ ist ein zweiter Zeichenweg (zwei Spalten, Paarung wie Punkt 4, ungepaarte Zeilen gegenüber leer) und eine eigene Scheibe. Das Budget zählt dieselben Zeilen.
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

## Nachtrag 2026-11-22 N2: `ETag` von „Ein Commit“ mit dem Startordner, ohne Git; kein eigener Versionsteil; Wortlaute aus N1.2 an Punkt 3 (Karte #255)

**Status `Akzeptiert`.** Der Nachtrag beantwortet die Frage des planers zu R00236 FA 2 und ergänzt Punkt 6. Der Text der Punkte 1–9 und von N1 bleibt stehen. Wo er abweicht, gilt dieser Nachtrag.
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #255, Lauf 255-architekt-1)
**Erprobt durch**: Code gelesen auf `karte/255` (3110e7b0). Nichts gebaut.

### Anlass

- Punkt 6 legt `wurzel` nur für den Gesamt-Diff in den `ETag`. Im Gesamt-Diff läuft `rev-parse` vor dem `ETag` (`src/dienst/gesamt_diff.rs:77–79`), dort geht das ohne neuen Prozess.
- In „Ein Commit“ entsteht der `ETag` vor jedem Git-Aufruf (`src/dienst/diff.rs:307`, Lesegrenze und `wurzel_bis` erst ab `:314–315`). Er hängt heute nur an Verweis, `datei`, `format` und `GRENZEN_VERSION` (`:388–395`). Ändert sich das Register, bestätigt ein 304 die alte Antwort. Mit `wurzel` in der Antwort hieße das: Der Link „VS Code“ zeigt auf die alte Wurzel.
- Der Browser fragt von selbst mit `If-None-Match` nach und reicht bei 304 seinen gespeicherten Rumpf weiter (ADR-0033 N1, „Belegt“, `etag-probe.js`). Ein Rumpf aus der Zeit vor der Karte, also ohne `wurzel`, lebte so weiter, solange der `ETag` gleich bleibt.
- Die Lücke gab es schon vor dieser Karte: Nach einer Änderung des Registers bestätigte ein 304 auch den Inhalt aus dem alten Repository. ADR-0032 Punkt 2 verlangt aber, dass ein geändertes Register sofort gilt.

### N2.1 Optionen

| Option | Stärke | Schwäche |
|---|---|---|
| **S1 — der Startordner in den `ETag`, als Pfad genau so, wie `wurzel_bis` ihn an Git gibt (Board-Ordner verbunden mit `Anwendung::startordner`); 304 bleibt ohne Git** (gewählt) | kein Prozess, keine Frist und kein Platz der Lesegrenze für ein 304 (ADR-0032 Punkt 9, N4.1). Jede Änderung des Registers und jeder Umzug des Board-Ordners ergeben einen anderen `ETag` | Bleibt der Startordner gleich und ändert sich die Wurzel trotzdem, bestätigt ein 304 die alte Wurzel. Das passiert, wenn ein Symlink umgehängt, ein `.git` im Unterordner angelegt oder entfernt oder das Repository an derselben Stelle ersetzt wird. Ändert sich der Startordner und bleibt die Wurzel gleich, kommt ein unnötiges 200 |
| S1′ — wie S1, aber der Text des Registers roh | wie S1 | Ein relativer Eintrag bleibt gleich, wenn der Board-Ordner umzieht, die Wurzel aber nicht. Dann käme wieder ein 304 mit alter Wurzel |
| S2 — `wurzel_bis` vor dem `ETag` (wie Gesamt-Diff und Nachfolger, ADR-0038 Punkt 7) | genau: Der `ETag` hängt an der Wurzel selbst | Ein 304 kostet einen Prozess, Frist und einen Platz der Lesegrenze. Bei belegter Lesegrenze käme 503 statt 304. Das bricht ADR-0032 N4.1 („304 und alle Prüfungen ohne Git kosten keine Frist“) und die Leseregel am Dienst („alles, was ohne Git geht, vor dem ersten Git-Aufruf“, `diff.rs:289–292`) |
| S3 — kein `wurzel` im Ein-Commit-Diff; die Seite nimmt die Wurzel aus einer anderen Antwort | `ETag` unberührt | Widerspricht Punkt 6 („beide Diff-Formen“). Dazu käme eine zweite Anfrage oder ein `rev-parse` in einer Route, die heute ohne Git ist |

### N2.2 Entscheidung

1. **Ein Commit**: Der `ETag` nimmt den Startordner auf, als den Pfad, den `wurzel_bis` an Git gibt (`board_ordner.join(startordner)`, `src/git/arbeitsrepo.rs:234`). Beide Stellen sollen ihn aus **einer** Funktion holen, damit `ETag` und Git nie auseinanderlaufen. Fehlt der Startordner, steht im `ETag` ein fester Platzhalter (wie `\u{1}` für fehlendes `datei`). Der Teil gilt für `json` **und** `format=patch`, denn zeigt das Register auf ein anderes Repository, muss die Antwort aus diesem kommen (etwa `fehlt` statt 304). Das 304 bleibt ohne Git-Prozess.
2. **Gesamt-Diff**: wie Punkt 6. `wurzel` ist das Ergebnis von `rev-parse` und geht in den `ETag` ein. Sie liegt dort schon vor dem `ETag` vor. Ein 304 kostet weiter 2 Prozesse (ADR-0032 N6.10).
3. **Kein eigener Versionsteil, `GRENZEN_VERSION` bleibt 1.** Ein neuer Teil im `ETag` ändert schon jeden `ETag` beider Formen. Ein Tag aus der Zeit vor der Karte passt also nie mehr, und der Browser bekommt 200 mit `wurzel`. Ein zusätzlicher Wechsel der Version wäre ein gleichwertiger Mutant: Kein Test kann ihn vom richtigen Stand unterscheiden. `GRENZEN_VERSION` zu erhöhen hieße außerdem, alle `ETag`s des Nachfolgers (`src/dienst/nachfolger.rs:397`) grundlos zu ändern, obwohl sich keine Grenze geändert hat. Eine Konstante für die Form der Antwort lege ich erst an, wenn ein Feld dazukommt, ohne dass sich eine Eingabe des `ETag`s ändert.
4. **Durchsetzung**: (a) Ein Literal-Test wie `etag_nicht_wie_vor_der_einteilung_n8` (`src/dienst/gesamt_diff.rs:888`) je Form: Der `ETag`, den die Formel vor der Karte zur selben Anfrage gab, ist ungleich dem neuen. (b) Register auf eine Kopie des Repositorys umgestellt: Mit dem alten Tag kommt 200 mit neuer `wurzel`. (c) Register unverändert: 304, im Ein-Commit-Diff mit unverändertem `arbeitsrepo::aufrufe()`. (d) Mutant „Startordner nicht im Ein-Commit-`ETag`“ wird von (b) rot. Das sind R00236 AK 2 und ein zusätzlicher Mutant.

### N2.3 Wirkung auf ADR-0032 und ADR-0033

- **ADR-0032 Punkt 2** („je Anfrage neu ermittelt, damit ein geändertes Register sofort gilt“): N2 schließt die Lücke für 304 in „Ein Commit“ bis auf den Inkauf-Fall aus S1. Es ist keine Ablösung.
- **ADR-0032 Punkt 9, N4.1 und die Leseregel am Dienst**: unverändert. Das 304 von „Ein Commit“ bleibt ohne Git, ohne Frist und ohne Lesegrenze. Der Startordner ist Register, also „ohne Git“.
- **ADR-0032 N4.6** (`ETag` hängt an den Attribut-Dateien): unverändert. **N6.10 und N7.5** (Gesamt-`ETag`): Sie bekommen `wurzel` als weiteren Teil, wie Punkt 6 es schon sagt. Die Zahl der Prozesse eines 304 bleibt 2.
- **ADR-0033**: keine Änderung. `diffHolen` verlässt sich auf das bedingte Lesen des Browsers (N1, „Belegt“). Genau deshalb muss der `ETag` jede Änderung der Antwort tragen. Das Zeichenbudget (Punkt 5) und die Reihe der Anfragen (N1.2) bleiben.
- **ADR-0038 Punkt 7** (Nachfolger): bleibt. Dort steht die Wurzel schon im `ETag`.

### N2.4 Wortlaute an Punkt 3

Die Hinweise lauten nach N1.2 und po-entscheidungen Z. 537 „bestehender Test geändert“ (bei `M` und `R` mit `minus > 0`) und „Test gelöscht“ (bei `D`). So steht es gebaut in `testHinweis` (`web/review-uebersicht.js:56–60`). Punkt 3 trägt dazu einen Vermerk und behält seinen alten Text.

### N2 Konsequenzen

- Positiv: Ein 304 bestätigt nach einer Änderung des Registers weder eine alte Wurzel noch Inhalt aus dem alten Repository. Das 304 bleibt in „Ein Commit“ ohne Git.
- Inkauf: Der Fall aus S1 (Startordner gleich, Wurzel anders) bestätigt die alte Wurzel per 304. Das ist harmlos wie die bekannte Grenze in Punkt 6, denn die Datei öffnet dann eben nicht. Ein unnötiges 200 kommt, wenn sich nur der Startordner ändert. Nach dem Update kommt einmal je gespeicherte Antwort ein 200, auch für `format=patch`.

## Nachtrag 2026-11-23 N3: Fingerabdruck der Datei ohne `patch` (präzisiert N1.4 und Punkt 2; Frage 3 des planers zu R00246, Karte #257)

**Status `Akzeptiert`.** Der Nachtrag beantwortet Frage 3 des planers zu R00246 FA 7. Der Text der Punkte 1–9, von N1 und N2 bleibt stehen. Wo er abweicht, gilt dieser Nachtrag.
**Entscheider**: Claude (autonom, architekt, Auftrag Director Karte #257, Lauf 257-architekt-1)
**Erprobt durch**: Prüfung am Code von main (unten, „Belegt“). Nichts gebaut.

### N3.1 Entscheidung

Der Fingerabdruck (N1.4, Punkt 2) bildet sich **nie über `patch`**. Er läuft über Felder, die in jeder Antwort stehen:

- Datei: `status`, `alt`, `neu`, `plus`, `minus`, `binaer`.
- Folge-Datei: `plus`, `minus`, `binaer` und die Verweise der Schritte.

Der Wortlaut „und, falls geladen, `patch`“ in Punkt 2 und N1.4 („bleiben wie in Punkt 2“) entfällt. Die Absicht bleibt: Eine geänderte Datei gilt wieder als ungesehen.

### N3.2 Belegt (Code von main)

- `patch` fehlt je nach Zustand: `Diffdatei.patch` ist `Option<String>` mit `skip_serializing_if` und nur gesetzt, wenn die Datei Hunks hat und weder binär noch `gross` noch `nachladen` ist (`src/modell/commit_diff.rs:51–53`). `dateiZustand` unterscheidet `zu_gross`, `gross`, `nachladen`, `binaer`, `patch`, `ohne` (`web/diff.js:122–130`). Die Tests halten `nachladen: true` mit `patch: null` fest (`src/dienst/diff.rs:509`, `src/dienst/gesamt_diff.rs:986`). Nach dem Nachladen kommt `patch` hinzu, der Fingerabdruck würde sich ändern und der Haken verschwinden.
- Eine stabile Kennung steht **nicht** in der Antwort: Die Blob-Hashes (`Diffdatei.blobs`, aus `--raw`) sind `#[serde(skip)]` (`src/modell/commit_diff.rs:61–62`). Sie dienen nur als Schlüssel der Stücke für `format=patch` (ADR-0032 N5.2). Weitere Hashes oder Kennungen je Datei gibt es nicht.

### N3.3 Preis (in Kauf genommen)

In „Alle Änderungen“ bleibt eine Änderung unerkannt, die `plus`, `minus`, `status` und Pfade gleich lässt (eine Zeile ersetzt). Die Datei gilt dann weiter als gesehen. In „Ein Commit“ wirkt der Preis nicht, dort trägt der volle Hash. Für eine Folge-Datei fängt der Verweis der Schritte jeden neuen Commit an der Datei. Betroffen ist also nur der Fall „derselbe Verweis, anderer Inhalt“, den ein Commit-Verweis nicht hervorbringt. Die Grenze trifft damit im Wesentlichen eine Datei ohne Folge, die im Arbeitsstand der Aufgabe in Zeilenzahl gleich umgeschrieben wird.

### N3.4 Stufe, falls der Preis nicht reicht

Will der Betreiber die Lücke schließen: ein neues Feld `blob` (Blob-Hash nachher, bei `D` der vorherige) je Datei und Schritt in der Diff-Antwort, im Fingerabdruck an Stelle von `plus`/`minus`. Das ist ein neues Antwortfeld ohne neuen Endpunkt, mit Änderung an `Diffdatei` (`#[serde(skip)]` fällt für das Feld weg), an der OpenAPI-Beschreibung und am `ETag`-Test, und eine eigene Karte. Bis dahin gilt N3.1. Die Antwort würde größer um etwa 40 Zeichen je Datei.

### N3.5 Durchsetzung

Einheit (Node, rein, `web/review-uebersicht.js`): derselbe Fingerabdruck für dieselbe Datei mit und ohne `patch`, mit und ohne `nachladen`; anderer Fingerabdruck bei anderem `plus`, `minus`, `status`, `alt`, `neu`, `binaer` und bei anderem Verweis eines Schritts. Ein Mutant, der `patch` einrechnet, wird im Nachladen-Test rot (R00246 m7).

### N3 Konsequenzen

- Positiv: Der Haken überlebt Nachladen, den Wechsel offen/zu und jedes Neuzeichnen. Kein Eingriff in die Antwort, kein neuer Endpunkt.
- Inkauf: Die Lücke aus N3.3, bis eine Karte `blob` einführt.
- R00246 FA 7 ist damit gedeckt (Frage 3 beantwortet). Nicht aufgenommen: die Meldung bei nicht speicherbarem „Gesehen“ (Frage 2 an den product-owner). Dazu liegt keine Entscheidung vor, N1.4 („ohne Meldung“) gilt bis dahin. **Überholt durch N4**: die Entscheidung liegt vor, die Meldung gilt.

## Nachtrag 2026-11-23 N4: Meldung, wenn „Gesehen“ nicht gespeichert werden kann (ersetzt „ohne Meldung“ in Punkt 2 und N1.4; Frage 2 des planers zu R00246, Karte #257)

**Status `Akzeptiert`.** Der product-owner hat Frage 2 entschieden (`AI-Team/po-entscheidungen.md`, Eintrag 2026-11-23 zu #257, Frage 2; nicht richtungsweisend, umkehrbar). Der Text der Punkte 1–9 und von N1 bis N3 bleibt stehen. Wo er abweicht, gilt dieser Nachtrag.

### N4.1 Entscheidung

Der Fehlerpfad „Fehlt `localStorage` oder wirft es (Kontingent, privates Fenster, gesperrt), gilt „Gesehen“ nur bis zum Neuzeichnen, ohne Meldung“ (Punkt 2, N1.4) gilt **mit Meldung**:

- **Wortlaut, verbindlich**: „Gesehen wird in diesem Browser nicht gespeichert und gilt nur bis zum Neuladen.“
- **Ort und Art**: ein Satz in derselben Zeile wie „<k> von <n> gesehen“, als Statusmeldung (`role="status"`), im gedämpften Ton; kein Fehlerrot, keine Schaltfläche, kein Eintrag in der Konsole.
- **Wann**: sie erscheint, sobald ein Zugriff auf den Speicher fehlschlägt, beim Lesen oder beim Schreiben. Sie verschwindet, wenn ein späteres Schreiben gelingt oder die Seite neu lädt.
- **Wirkung**: Der Haken wirkt in der Seite weiter (Einklappen, Fortschritt zählen); nur der Speicher fehlt. Nichts geht an den Server, nichts an die Karte.

### N4.2 Begründung

Ohne Meldung verlöre, wer im privaten Fenster 30 Dateien abhakt und neu lädt, seine Arbeit, ohne es zu wissen („kein stiller Verlust“). Der Satz ist ehrliche Auskunft ohne Alarm.

### N4.3 Durchsetzung

Einheit: wirft `localStorage` beim Lesen oder Schreiben, steht die Meldung mit dem Wortlaut aus N4.1; gelingt ein späteres Schreiben, steht sie nicht mehr; es entsteht kein Konsolenfehler. E2E: bei gesperrtem Speicher erscheint der Satz im Statusbereich neben „<k> von <n> gesehen“, und der Haken klappt die Datei weiter ein (R00246 FA 10, AK 7, Mutant m12).

### N4 Konsequenzen

- Positiv: Die Dauer von „Gesehen“ ist für den Menschen erkennbar.
- Inkauf: ein zusätzliches Element in der Fortschrittszeile, nur im Fehlerfall sichtbar.

## Nachtrag 2026-11-23 N5: Umbrechen — Speicherort `localStorage`, Breite der Blöcke als Eigenschaft, Leseposition beim Umschalten (präzisiert Punkt 8; zwei Fragen des planers zu R00248, Karte #259)

**Status `Akzeptiert`.** Der Nachtrag beantwortet die Fragen 1 und 2 des planers zu R00248 („Offene Fragen“). Der Text der Punkte 1–9 und von N1 bis N4 bleibt stehen. Wo er abweicht, gilt dieser Nachtrag. Geprüft am Code von main (`web/diff.js`, `web/kd-app.css`, `web/app.js`); nichts gebaut, nichts im Browser gemessen. Was unten „Annahme“ heißt, prüft der entwickler in B1304 und AK 9.

### N5.1 Speicherort (Frage 1; ersetzt `sessionStorage` in Punkt 8)

- **Ort**: `localStorage`, Schlüssel `kanbanD.umbrechen`, Wert `1` (an) oder `0` (aus), **ein** Wert für alle Karten und beide Ansichten. Lesen beim Start wie `kanbanD.signale-oben` (`web/app.js:28`), Schreiben im Handler des Schalters wie dort (`web/app.js:4085`): `try … catch (_) { }`. Fehlt der Wert oder ist er etwas anderes als `1`, gilt „aus“.
- **Fehlerpfad**: Wirft der Speicher, gilt der Zustand bis zum Neuladen, ohne Meldung. Eine Meldung wie in N4 gibt es hier nicht: Der Zustand ist eine Ansichtswahl, kein Fortschritt, dessen Verlust still Arbeit kostet. Die Ansichtswahl der Oberfläche (`signale-oben`, `thema`) verhält sich genauso.
- **Begründung**: Seit N1.4 liegt „Gesehen“ dauerhaft im Browser, und die Review-Seite öffnet in einem eigenen Tab (N1.4). Mit `sessionStorage` wäre „an“ dort bei jedem neuen Tab wieder weg. `sessionStorage` bleibt in `web/app.js` nur für Dinge, die ausdrücklich je Tab gelten (`merken`/`gemerkt`, `kanbanD.ich`). Ein Umbruch-Zustand ist keiner davon.
- Inkauf: Der Zustand gilt je Browser, nicht je Mensch und nicht je Karte. Wer ihn für eine Karte ändert, ändert ihn für alle.
- Der Satz „neuer Tab“ / „neuer Browser-Kontext“ in R00248 FA 4 und AK 3 gilt wie von der Empfehlung vorgesehen: neuer Tab im selben Kontext behält ihn, neuer Kontext nicht.

### N5.2 Umbruch nur per CSS, Breite der Blöcke als Eigenschaft (Frage 2; präzisiert Punkt 8)

**Belegt (Code von main)**: `codeHtml` (`web/diff.js:316`) schreibt je Block `style="contain-intrinsic-inline-size:<blockBreite>px;contain-intrinsic-block-size:auto <n×18>px"`. `.dz-b` ist `content-visibility:auto; min-inline-size:100%; inline-size:max-content` (`web/kd-app.css:1578`), `.dz .c` ist `white-space:pre` und `tr.hk>td` ebenfalls (Z. 1583, 1586). Ein Wert im `style` schlägt jede Klasse aus der Stilvorlage, ohne `!important`. Darum kann eine Klasse die Breite nicht übersteuern. Und `inline-size:max-content` allein verhindert den Umbruch: Der Block wäre so breit wie die längste Zeile.

**Entscheidung**:

1. **Der `style` trägt nur noch Werte, keine Entscheidung**: `style="--bb:<blockBreite>px;contain-intrinsic-block-size:auto <n×18>px"`. `blockBreite` und seine Rechnung bleiben unverändert (nur das Ziel des Wertes wechselt).
2. **Die Stilvorlage entscheidet**: `.dz-b{contain-intrinsic-inline-size:var(--bb)}` im Normalzustand. Bei „an“ (Klasse `umbr` am Rollbehälter der Seite, `#review`, ein Schreibzugriff, kein Neuzeichnen):
   - `.umbr .dz-b{contain-intrinsic-inline-size:none;inline-size:100%}` — **`inline-size:100%` trägt die Wirkung**, `none` ist die Absicht in der Datei (Punkt 8: „entfällt `contain-intrinsic-inline-size`“) und schützt, falls später jemand `max-content` zurückholt;
   - `.umbr .dz .c,.umbr .dz tr.hk>td{white-space:pre-wrap;overflow-wrap:anywhere}`. Der Hunk-Kopf bricht mit (Frage 4 des planers an den product-owner, Empfehlung „ja“; fällt die Antwort anders aus, entfällt nur der zweite Selektor).
   - `anywhere`, nicht `break-word`: nur `anywhere` zählt für die kleinste Breite der Tabellenspalte mit; ohne das bliebe die Tabelle bei einem Wort ohne Leerzeichen (AK 2 Fall b) breiter als der Block (Annahme, B1304).
3. **Die Klasse hängt an einem Element, das beim Umschalten nicht neu gezeichnet wird**: Der Schalter schreibt `S.ui.umbrechen`, setzt die Klasse und `aria-pressed` am Knopf. Er löst kein `render` aus (R00248 AK 1: Zeilenknoten bleiben dieselben, Fokus bleibt auf dem Knopf). Beim Zeichnen der Seite wird die Klasse aus dem gemerkten Wert gesetzt (Blättern, Wechsel der Ansicht).
4. **Wortmarke (#258, R00247)**: Die Marke ist ein `<mark class="wm">` inline in `td.c` (R00247 FA 5), erbt `white-space` und bricht darum von selbst mit. Zu halten sind zwei Dinge, beide stehen schon in R00247 AK 8 und werden dort mit dem im Test gesetzten Stil geprobt, in #259 mit dem echten Schalter wiederholt: (a) die Kante auf **jedem** Fragment, (b) keine Seitenränder an der Bruchstelle. Für (a) sind `border-bottom` oder `text-decoration` je Fragment sicher; ein `box-shadow` als Kante braucht `box-decoration-break: clone` (bei `slice` wird der Schatten über die Fragmente verteilt, Annahme). #259 setzt an der Marke **nichts** eigenes. Fällt AK 8 von R00247 an einem Fragment, ist das ein Befund der Karte #258 und nicht durch eine Regel in #259 zu flicken.
5. **Syntaxfarbe (R00217)**: liegt als `<span class="tk-…">` im Text und bricht mit; die Farbe bleibt je Zeichen.

### N5.3 Höhe und Leseposition beim Umschalten (Frage 2, zweiter Punkt; präzisiert Punkt 8)

- **Die Höhenschätzung bleibt** (`auto <n×18>px`, Punkt 8: „die Schätzung bleibt, `auto` merkt sich die echte“). Ein Block im Bild wird beim Umschalten ohnehin neu gesetzt und misst sich selbst. Ein Block weit außerhalb behält seine gemerkte Höhe der alten Einstellung, bis er wieder ins Bild kommt. Das ist die bestehende Eigenschaft von `content-visibility: auto`, kein neuer Fehler. **Inkauf**: Beim späteren Rollen an einen vorher übersprungenen Block kann die Seite um die Differenz springen (umgebrochene Blöcke sind höher als geschätzt). Das gilt schon heute für die Schätzung gegen die echte Höhe und ist nicht Teil von AK 9.
- **Der Browser-Anker steht nicht zur Verfügung**: `#review` hat `overflow-anchor:none` (`web/kd-app.css:1612`, Begründung dort: die Seite führt die Leseposition selbst nach). Die Empfehlung „Browser-Anker“ aus R00248 trägt deshalb nicht; ihn für `#review` einzuschalten würde R00210 FA 8 und die Nachführung (`web/app.js:2398`) aufs Spiel setzen.
- **Entscheidung**: Der Schalter hält die Leseposition mit dem vorhandenen Muster `reviewLesepositionMerken` / `reviewLesepositionHalten` (`web/app.js:1932–1940`): vor dem Setzen der Klasse die Lage eines Ankers messen, danach die Rolle (`#review.scrollTop`) um die Verschiebung nachführen. Der Anker ist hier **das oberste im Bild stehende Element mit fester Kennung** (der Kopf der Datei, deren Kopf oder Körper oben im Bild steht, sonst die erste Zeilentabelle im Bild), nicht `#rv-a0` (der erste Abschnitt kann weit darüber liegen). Eine eigene kleine Funktion, nicht ein Umbau der vorhandenen; sie bekommt den Anker als Parameter.
- **Zweimal nachführen**: einmal unmittelbar nach dem Setzen der Klasse (synchrone Messung zwingt das Layout) und einmal im nächsten Bild, weil Blöcke am Rand der Relevanz erst dann neu gemessen werden können (Annahme; derselbe Befund wie bei `laufZeileNachfuehren`, `web/app.js:2398–2402`). Das vorhandene Nachführen über mehrere Bilder wird nicht wiederverwendet: Es hängt an einer Zeile der Liste und endet bei Eingabe des Menschen; hier genügen zwei Messungen.
- **Annahme, unbelegt**: ob Chromium die Blöcke oberhalb des Bildes beim Umschalten tatsächlich neu setzt (Rand der Relevanz) und wie weit der Kopf in AK 9 ohne Nachführen springt. Das misst der entwickler in B1304 zuerst ohne Nachführen. Springt der Kopf in AK 9 nicht, entfällt die Nachführung (nichts Ungenutztes bauen, J10). Springt er, gilt sie wie hier beschrieben.
- **Durchsetzung**: R00248 AK 9 (`0 ≤ top < innerHeight` nach Ein- und Ausschalten, Fälle (a) und (b) je 30-mal). Mutant: Nachführung entfernt und Klasse an einem Element mit `overflow-anchor: auto` → nur nötig, wenn die Messung oben einen Sprung zeigt.

### N5 Konsequenzen

- **Positiv**: Der Schalter ist ein Klassenwechsel und eine Schreibung in `localStorage`; keine Neuberechnung der Blöcke, keine Anfrage, kein Neuzeichnen. Die Breite wird weiter nur einmal je Block geschätzt, bei „aus“ wie bisher.
- **Preis**: Ein Block ändert seine Breitenregel von einem Wert im `style` zu einer Eigenschaft plus Regel in der Stilvorlage. Das berührt die Zeichenkette in `codeHtml`; Tests, die den `style` genau vergleichen (`contain-intrinsic-inline-size:…px` im Wortlaut), müssen auf `--bb` umgestellt werden (Einheitentest zu `codeHtml`, falls vorhanden, und R00235-Spezifikationen). Das ist der erste Test der Slice B1301 und nennt das Muster.
- **Inkauf**: die Sprünge beim späteren Rollen an übersprungene Blöcke (N5.3), die gleiche Wirkung des Zustands auf alle Karten (N5.1).
- **Offen, nicht hier entschieden**: Frage 3 (Voreinstellung unter 641 px) und Frage 4 (Hunk-Kopf) an den product-owner; N5.2 Punkt 2 nennt die Folge von Frage 4.
- **Unverändert**: Zeilenzahl und Zeichenbudget (Punkt 8, R00248 FA 7); „Nebeneinander“ (eigene Scheibe, #260).

