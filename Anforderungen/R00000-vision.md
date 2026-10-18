---
id: R00000
titel: Vision — kanbanD
status: Lebend
angelegt: 2026-09-26
zuletzt-ergaenzt: 2026-10-18
---

# R00000: Vision — kanbanD

Kein Anforderungsdokument. Beschreibt das Gesamtziel der Anwendung.
Wird fortgeschrieben, nie abgehakt.

## Kurzfassung

kanbanD ist ein Kanban, das ein Ordner ist. Mit `kanbanD <ordner>` gestartet,
arbeitet es auf zwei Verzeichnissen darin: einem mit Aufgaben, je Aufgabe eine
Markdown-Datei mit Frontmatter und bei Bedarf ein Ordner für Anhänge, und einem mit
Boards, je Board eine Markdown-Datei, die ihre eigene Struktur trägt und darin auf
Aufgaben verweist. Der Ordner liegt meist in einem Git-Repository, neben der Arbeit,
um die es geht. Menschen arbeiten im Browser, KI-Agenten über die API oder direkt an
den Dateien; jede Änderung erscheint sofort in allen offenen Sichten. Jede Aktion in
kanbanD wird sofort committet, so ist Git das vollständige Gedächtnis: wer wann was
getan hat, lässt sich diffen, mergen und branchen wie Code.

## Anlass

kanbanC hat gezeigt, dass Mensch und Agent auf einem gemeinsamen Board arbeiten
können. Es hat aber eine Datenbank neben das Repository gestellt, genau dort, wo die
Arbeit stattfindet. Der Board-Zustand reist nicht mit dem Code und hat keine
Geschichte. Er lässt sich nicht diffen, nicht mergen und nicht per Branch mitführen.
Ein Agent erreicht ihn nur über eine eigene API, obwohl er Markdown-Dateien ohnehin
liest und schreibt.

Dazu kamen Baukosten, die aus der Architektur stammten: zwei Prozesse, zwei Uhren,
ein nachgerüsteter Live-Kanal, ein starres Schema und eine Gestaltung, die kein
Mensch je gesehen hat.

Und die Nutzung war umständlich: zwei Anwendungen, zwei Starts. kanbanD ist eine
Anwendung — ein Programm, das Weboberfläche und WebApi zugleich ausliefert. `kanbanD ./kanban-ordner` startet sie
und öffnet das erste Browserfenster.

kanbanD dreht es um: Das Board liegt im Repository, und Git ist sein Gedächtnis.

## Zielbild

- **Ein Kanban, das ein Ordner ist.** Aufgaben und Boards liegen als
  Markdown-Dateien vor. Sie sind ohne kanbanD lesbar und mit jedem Editor änderbar.
  kanbanD ist die bequemste Art, sie zu bearbeiten, aber nicht die einzige.

- **Aufgaben sind unabhängige Daten.** Eine Aufgabe ist eine Markdown-Datei mit
  Frontmatter im Aufgabenverzeichnis, bei Bedarf mit einem eigenen Ordner für
  Anhänge. Sie weiß nicht, auf welchem Board und in welcher Spalte sie liegt.

- **Das Board besitzt seine Struktur.** Ein Board ist eine Markdown-Datei im
  Boardverzeichnis. Sie enthält Spalten und Reihenfolge und verweist auf Aufgaben —
  samt der Stelle, an der jede in dieser Struktur liegt. Eine Aufgabe zu bewegen
  ändert nur die Board-Datei, nie die Aufgabe. Auf der Oberfläche erscheint eine
  Aufgabe als Karte.

- **Git ist das Gedächtnis.** Jede Aktion in kanbanD ergibt einen eigenen Commit.
  Die Git-Geschichte ist damit das vollständige Archiv, auch der Zeiten: wann eine
  Aufgabe angelegt, geändert und wohin sie bewegt wurde, steht in den Commits. Das
  Board lässt sich diffen, mergen und branchen wie Code, ein Pull bringt die Arbeit
  anderer mit. Die Dateistruktur ist so geschnitten, dass typische Merges nicht in
  Konflikten enden.

- **Mensch und Agent arbeiten gleichberechtigt.** Der Mensch nutzt den Browser, der
  Agent die API oder die Dateien direkt. An jeder Änderung ist ablesbar, wer
  gehandelt hat: kanbanD committet unter dem Namen der handelnden Person. Ändert
  jemand die Dateien an kanbanD vorbei, committet er selbst; kanbanD zeigt die
  Änderung live, schreibt aber keinen fremden Commit.

- **Mehrere Boards über einem Aufgabenbestand.** Eine Instanz zeigt alle Boards des
  Boardverzeichnisses und wechselt zwischen ihnen. Dieselbe Aufgabe darf auf mehreren
  Boards liegen; eine Aufgabe auf keinem Board bleibt in der Aufgabenliste sichtbar.
  Personen und Klassen gelten für den ganzen Ordner und reisen mit ihm.

- **Live überall, egal woher die Änderung kommt.** Ob der Browser, die API, ein
  Editor oder ein `git pull` eine Datei ändert: alle offenen Sichten zeigen es
  sofort, ohne Reload.

- **Zeiterfassung, die zum Arbeiten passt.** Ein Timer, der sich ohne Umstand
  starten und stoppen lässt, mit mitlaufender Dauer. Er steht als Zeile in der
  Aufgabe: Start und Stopp sind je eine Aktion mit Commit, ein laufender Timer
  übersteht also einen Absturz. Mehrere Timer dürfen gleichzeitig laufen.

- **Defekte Dateien bleiben sichtbar.** Eine Datei mit Merge-Konfliktmarkern oder
  unlesbarem Frontmatter wird mit Fehlerzeile angezeigt statt verschluckt und ist
  bis zur Reparatur nur lesbar. Gleichzeitige Schreibzugriffe über Oberfläche und
  API werden nacheinander ausgeführt.

- **Die WBS als Nachbar statt als Importquelle.** Liegt die WBS im selben
  Repository, zeigt eine Karte auf ihren Knoten. `Braucht`-Beziehungen werden zu
  echten Abhängigkeiten zwischen Karten und nicht zu Fließtext.

- **Auswertungen aus der Geschichte.** Soll-Ist, Burndown, Durchlaufzeiten und Zeiten
  je Aufgabe und Kontributor werden aus den Dateien und ihrer Git-Geschichte gerechnet.

- **Ein eigenes Design, früh vom Menschen gesehen.** Es ist per Tastatur bedienbar
  und folgt gewohnten Konventionen. Keine Gestaltung geht in den Bau, die niemand
  angesehen hat.

## Nutzer und Nutzen

In erster Linie ich selbst, gemeinsam mit KI-Agenten, die als eigene Kontributoren
auf dem Board erscheinen. Gelegentlich kommen weitere Menschen im LAN dazu, die
ihren Browser auf dieselbe Instanz richten.

Kontributoren gibt es in zwei Ausprägungen. Die einen benutzen die Anwendung: der
Mensch am Browser, der Agent an der API oder direkt an den Dateien. Die anderen
werden nur abgebildet; ihnen werden Karten und Zeiten zugeordnet, ohne dass sie die
Anwendung je öffnen.

Jeder Browser-Tab trägt seine eigene Identitätswahl. Ein Agent nennt bei jedem
schreibenden Aufruf, als wer er handelt.

Der Nutzen: Ein Board, das mit dem Repository reist und seine Geschichte in Git
trägt. Ein Agent kann es mit den Werkzeugen führen, die er ohnehin benutzt. Und es
startet mit einem Befehl.

## Leitplanken

- **Rust, eine Anwendung.** Ein einziges Programm liefert Weboberfläche und WebApi
  im selben Prozess aus; die Oberfläche ist in das Programm eingebettet. Getestet
  wird mit `cargo test` (Unit und Integration) und Playwright (E2E gegen das echte
  Programm).
- **Ordneraufbau.** `<ordner>/kanbanD.md` trägt die Einstellungen (Personen, Klassen,
  Quellpfade), `<ordner>/aufgaben/` die Aufgaben (`0012-titel.md`, Anhänge unter
  `0012-titel/`), `<ordner>/boards/` die Boards (`<slug>.md`). Eine Board-Datei hat
  je Spalte eine Überschrift und je Aufgabe darunter eine Zeile mit ihrer Nummer;
  die letzte Spalte ist die Abschlussspalte.
- **Git ist Voraussetzung.** Ist der Ordner in keinem Git-Repository, legt kanbanD
  beim Start eines an. Der Git-Autor eines Commits ist die handelnde Person.
- **Start mit einem Befehl.** `kanbanD <ordner>` startet die Anwendung und öffnet
  das erste Browserfenster.
- **Weboberfläche, im LAN erreichbar.** Kein Desktop-Programm und kein Betrieb im
  Internet.
- **Die Dateien sind der einzige Speicher.** Das sind Markdown-Dateien mit
  Frontmatter, ohne Datenbank daneben. Aufgaben und Boards liegen in getrennten
  Verzeichnissen. Ein Index oder Cache darf existieren, muss
  sich aber jederzeit aus den Dateien neu aufbauen lassen und wird nicht versioniert.
- **Git-freundliche Form.** Die Dateien sind stabil sortiert, haben stabile IDs,
  sind zeilenorientiert und ändern sich nur dort, wo sich etwas ändert. Eine
  Bewegung ergibt einen kleinen Diff in der Board-Datei und keinen in der Aufgabe:
  eine Zeile je Aufgabe, damit Bewegungen verschiedener Aufgaben ohne Konflikt
  mergen.
- **Ein Commit je Aktion.** Jede schreibende Aktion über Oberfläche oder API wird
  von kanbanD sofort und einzeln committet.
- **Full-Trust.** Keine Anmeldung und keine Rechteprüfung. Die Identität wird je
  Tab gewählt (`sessionStorage`), und ein Agent nennt sie bei jedem schreibenden
  Aufruf.
- **Eine festgelegte Kultur.** Die Oberfläche ist deutsch, Datumsangaben stehen im
  deutschen Format, Tage und Zeiten gelten in Ortszeit.
- **Der Mensch sieht jede Gestaltung, bevor sie gebaut wird.**

## Ausdrücklich nicht Ziel

- **Kein Cloud-Dienst.** Keine Accounts, keine Registrierung, kein Betrieb im
  Internet.
- **Kein Wechsel zwischen Ordnern.** Eine Instanz arbeitet auf genau einem Ordner.
  Ein zweiter Ordner ist eine zweite Instanz.
- **Keine Datenbank als Wahrheit.** Was nicht in den Dateien steht, gibt es nicht.
- **Kein Git-Client.** kanbanD committet seine eigenen Aktionen, mehr nicht. Pull,
  Push, Branch und Merge macht der Mensch mit seinen gewohnten Werkzeugen. kanbanD kommt mit dem zurecht, was dabei herauskommt.
- **Kein Funktionsgleichstand mit Kanbanflow oder kanbanC.** Keine Mobile-Apps,
  keine Fremd-Integrationen, keine Benachrichtigungen und keine @-Mentions; aus
  kanbanC nicht übernommen sind Linien- und Projektboards, Klassen mit eigener
  Nummerierung und Critical Chain mit Puffer.
- **Kein Projektmanagement-Werkzeug.** Kein Gantt, keine Kapazitäts- und
  Terminplanung. Auswertungen rechnen aus dem, was geschehen ist.
- **Kein Ersatz für Vision, Anforderungen und WBS.** Diese Dokumente bleiben
  eigenständig; das Board zeigt auf sie, statt sie zu kopieren. Es fließt nichts
  in die WBS zurück; eine erledigte Aufgabe setzt keinen Knoten grün.
- **Kein Import aus kanbanC.** kanbanD beginnt neu.
- **Keine weiteren Aufgabenquellen.** E-Mail und Formulare sind kein Vorhaben.

## Offene Richtungsfragen

- **Gleichzeitige Nummernvergabe auf zwei Branches.** Legen zwei Menschen auf zwei
  Branches je eine Aufgabe an, bekommen beide dieselbe nächste Nummer. kanbanD
  meldet doppelte Nummern; wie sie aufgelöst werden, ist offen.

## Ergänzungshistorie

| Datum | Ergänzung |
|---|---|
| 2026-09-26 | Vision angelegt (Nachfolger von kanbanC: Board als Markdown-Ordner, Git als Gedächtnis, eine Anwendung mit einem Startbefehl, Live auch bei Dateiänderungen, WBS als Nachbar) |
| 2026-10-18 | Richtungsfrage Commit entschieden: jede Aktion in kanbanD ergibt sofort einen eigenen Commit, die Git-Geschichte ist das volle Archiv inkl. Zeiten (Leitplanke, Zielbild, „Kein Git-Client“ geschärft) |
| 2026-10-18 | Datenmodell fortgeschrieben: Aufgabenverzeichnis (je Aufgabe eine Datei, ggf. Anhang-Ordner) und Boardverzeichnis (je Board eine Markdown-Datei mit Struktur und Aufgabenverweisen); Bewegen ändert nur die Board-Datei. Ersetzt „Ein Board, das ein Ordner ist“ und „Keine Board-Verwaltung“ (jetzt „Kein Wechsel zwischen Ordnern“), Anhänge aus dem Nicht-Ziel gestrichen — Grund: Aufgaben sind unabhängig von Boards. Neue Richtungsfragen: Boards und Aufgaben, Timer, Mergebarkeit der Board-Datei, Änderungen von außen |
| 2026-10-18 | Leitplanke „C# / .NET 10“ ersetzt durch „Rust, eine Anwendung“ — Grund: Auftrag, die Anwendung in Rust zu bauen; Ordneraufbau und „Git ist Voraussetzung“ als Leitplanken ergänzt |
| 2026-10-18 | Richtungsfragen ohne Menschen nach bestem Wissen entschieden (Anmerkungen 1–8 in `kanbanD-anmerkungen.md`): Wer = Git-Autor; mehrere Boards je Instanz, Aufgabe auf mehreren oder keinem Board; Timer als Zeile in der Aufgabe, Commit bei Start und Stopp; Board-Datei mit einer Zeile je Aufgabe; Änderungen von außen werden gezeigt, nicht committet; defekte Dateien sichtbar und nur lesbar; kein Rückfluss zur WBS; Kontributoren im Ordner; kein kanbanC-Import; keine weiteren Aufgabenquellen. Neue Frage: doppelte Nummern aus zwei Branches |
