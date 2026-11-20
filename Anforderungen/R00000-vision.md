---
id: R00000
titel: Vision — kanbanD
status: Lebend
angelegt: 2026-09-26
zuletzt-ergaenzt: 2026-11-20
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
  Personen gelten für den ganzen Ordner und reisen mit ihm. Klassen gelten je Board:
  ein Board kann eigene Klassen mit eigenen Farben tragen; ohne eigene gelten die
  Klassen des Ordners als Vorgabe.
  Archiviert ist eine Eigenschaft der Aufgabe, nicht eines Boards: sie gilt mit Blick
  auf alle Boards, auf denen die Aufgabe liegt. Aus dem Archiv geholt, liegt sie wieder
  auf allen Boards, auf denen sie vorher lag; nennt ein Wiederöffnen ein weiteres
  Board, liegt sie zusätzlich dort. Im Wortlaut des Betreibers: „Archiviert bedeutet
  archiviert, mit Blick auf alle Boards auf denen sie ist, ist die Karte im Archiv.
  Wird sie aus dem Archiv geholt, dann ist sie wieder auf allen Boards auf denen sie
  vorher auch war.“

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

- **Die Aufgaben sind der Stand.** Die WBS ist ein Planungswerkzeug im Repository
  der Anwendung: aus ihr entstehen Aufgaben, danach dient sie nur noch dem
  Entwickler. kanbanD liest, schreibt und zeigt sie nicht. Ein Board bindet keine
  bis mehrere Anwendungen (Kürzel und Repository, etwa für Commit-Verweise).
  Spalten sind Spalten, durch die Aufgaben wandern; `Braucht`-Beziehungen bleiben
  echte Abhängigkeiten zwischen Karten.

- **Die Arbeit hinter der Karte nachvollziehen.** An einer Karte stehen die Commits,
  die für sie entstanden sind, und die Läufe der Agenten, die an ihr gearbeitet haben.
  kanbanD zeigt beides lesend: die Änderungen als Diff aus dem Arbeits-Repository, je
  Commit oder für die ganze Karte, und den Verlauf eines Laufs.

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

Ein Agent führt Arbeitspakete, Phasen und Warteschlange auf dem Board statt in
eigenen Verwaltungsdateien; was er sonst abgleicht, steht an einem Ort.

## Leitplanken

- **Rust, eine Anwendung.** Ein einziges Programm liefert Weboberfläche und WebApi
  im selben Prozess aus; die Oberfläche ist in das Programm eingebettet. Getestet
  wird mit `cargo test` (Unit und Integration) und Playwright (E2E gegen das echte
  Programm).
- **Ordneraufbau.** `<ordner>/kanbanD.md` trägt die Einstellungen (Personen, Klassen
  als Vorgabe, Quellpfade), `<ordner>/aufgaben/` die Aufgaben (`0012-titel.md`, Anhänge unter
  `0012-titel/`), `<ordner>/boards/` die Boards (`<slug>.md`). Eine Board-Datei hat
  je Spalte eine Überschrift und je Aufgabe darunter eine Zeile mit ihrer Nummer,
  dazu wahlweise eigene Klassen;
  die letzte Spalte ist die Abschlussspalte.
- **Board-Repository und Arbeits-Repository sind getrennt.** Die vielen Commits von
  kanbanD liegen nicht in der Geschichte der Anwendung. `kanbanD.md` führt die
  Anwendungen mit Kürzel und vollen Pfaden zu WBS und Anforderungen; Boards nennen
  Kürzel, Herkunft wird als `kd:I0007` qualifiziert.
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
  Transkripte der Agentenläufe liegen gezippt im Ordner, werden aber nicht
  versioniert; die Karte trägt ihren Eintrag. Sie reisen nicht mit dem Repository und
  lassen sich vollständig löschen.
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
- **Jede Gestaltung wird freigegeben, bevor sie gebaut wird** — vom Auftraggeber
  oder vom product-owner der Factory in seinem Auftrag.

## Ausdrücklich nicht Ziel

- **Kein Cloud-Dienst.** Keine Accounts, keine Registrierung, kein Betrieb im
  Internet.
- **Kein Wechsel zwischen Ordnern.** Eine Instanz arbeitet auf genau einem Ordner.
  Ein zweiter Ordner ist eine zweite Instanz.
- **Keine Datenbank als Wahrheit.** Was nicht in den Dateien steht, gibt es nicht.
- **Kein Git-Client.** kanbanD committet seine eigenen Aktionen im Board-Repository,
  mehr nicht; im Repository einer Anwendung ändert es Dateien, committet dort aber
  nie. Pull,
  Push, Branch und Merge macht der Mensch mit seinen gewohnten Werkzeugen. kanbanD kommt mit dem zurecht, was dabei herauskommt.
  Im Arbeits-Repository liest kanbanD Commits nur. Kommentare, Freigaben oder Merge im
  Diff gibt es nicht.
- **Kein Funktionsgleichstand mit Kanbanflow oder kanbanC.** Keine Mobile-Apps,
  keine Fremd-Integrationen, keine Benachrichtigungen und keine @-Mentions; aus
  kanbanC nicht übernommen sind Linien- und Projektboards, Klassen mit eigener
  Nummerierung und Critical Chain mit Puffer.
- **Kein Projektmanagement-Werkzeug.** Kein Gantt, keine Kapazitäts- und
  Terminplanung. Auswertungen rechnen aus dem, was geschehen ist.
- **Kein Ersatz für Vision, Anforderungen und WBS.** Die Dokumente bleiben Dateien
  im Repository der Anwendung; kanbanD liest und schreibt sie nicht.
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
| 2026-10-18 | Zielbild „Die WBS als Nachbar statt als Importquelle“ ersetzt durch „Die WBS als Stand, die Aufgaben als Fortschritt“ (eigene WBS-Sicht, Wirkungen von Aufgaben auf Knoten, Phasen als Spalten); Nutzen um den Agenten ohne Verwaltungsdateien ergänzt — Grund: kanbanD soll WBS und Arbeit gemeinsam führen und Verwaltungs-Commands in `~/.claude` ersetzen (Durchgang im Pair) |
| 2026-10-18 | Leitplanke „Board-Repository und Arbeits-Repository sind getrennt“ mit Register der Anwendungen (Kürzel, volle Pfade) und qualifizierter Herkunft ergänzt |
| 2026-10-18 | Nicht-Ziele „Kein Ersatz für Vision, Anforderungen und WBS“ und „Kein Git-Client“ geschärft — Grund: kanbanD schreibt die WBS im Arbeits-Repository ohne dortigen Commit, `gruen` nie aus einer Bewegung; ersetzt „Es fließt nichts in die WBS zurück“ |
| 2026-11-07 | Leitplanke „Der Mensch sieht jede Gestaltung, bevor sie gebaut wird“ ersetzt durch „Jede Gestaltung wird freigegeben, bevor sie gebaut wird“, vom Auftraggeber oder vom product-owner — Grund: der Auftraggeber überträgt die Artboard-Freigabe dem product-owner (Anlass po-entscheidungen Z. 76, 148, 153) |
| 2026-11-15 | Zielbild „Mehrere Boards über einem Aufgabenbestand“ um die Regel zum Archiv ergänzt: Archiviert ist eine Eigenschaft der Aufgabe und gilt für alle Boards, auf denen sie liegt; aus dem Archiv geholt, liegt sie wieder auf allen diesen Boards, ein beim Wiederöffnen genanntes weiteres Board kommt hinzu — Entscheidung des Betreibers vom 2026-11-15 im Wortlaut (Anlass Karte #45; hebt seine Entscheidung vom 2026-11-13 „eine Karte liegt auf genau einem Board“ auf, die nie im Zielbild stand) |
| 2026-11-18 | Zielbild „Mehrere Boards über einem Aufgabenbestand“ und Leitplanke „Ordneraufbau“: Klassen gelten je Board, ein Board kann eigene Klassen mit eigenen Farben tragen, ohne eigene gelten die Klassen des Ordners als Vorgabe; Personen bleiben ordnerweit — ersetzt „Personen und Klassen gelten für den ganzen Ordner und reisen mit ihm“. Grund: Entscheidung des Betreibers vom 2026-11-18 (Karte #200): ein eigenes Board für eine große Wartungsaufgabe trug die Klassen des Wartungsboards, die dort keinen Sinn ergeben |
| 2026-11-19 | Zielbild „Die Arbeit hinter der Karte nachvollziehen“ neu (Commits und Agentenläufe an der Karte, lesend als Diff und Verlauf); Nicht-Ziel „Kein Git-Client“ ergänzt: im Arbeits-Repository nur lesen, keine Kommentare, Freigaben oder Merge im Diff; Leitplanke „Die Dateien sind der einzige Speicher“ um die Ausnahme für unversionierte, gezippte Transkripte ergänzt — Entscheidung des Betreibers vom 2026-11-19 (Karten #207, #208, po-entscheidungen Z. 361 und 376) |
| 2026-11-20 | Zielbild „Die WBS als Stand, die Aufgaben als Fortschritt“ ersetzt durch „Die Aufgaben sind der Stand“, Nicht-Ziel „keine zweite WBS“ geschärft zu „Kein Ersatz für Vision, Anforderungen und WBS“ — Grund (Betreiber): die WBS ist ein Planungswerkzeug; sobald es die Aufgaben gibt, ist sie nur noch etwas für den Entwickler, alle WBS-Funktionen kommen aus kanbanD heraus (Karte #224) |
