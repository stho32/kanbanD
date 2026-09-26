---
id: R00000
titel: Vision — kanbanD
status: Lebend
angelegt: 2026-09-26
zuletzt-ergaenzt: 2026-09-26
---

# R00000: Vision — kanbanD

Kein Anforderungsdokument. Beschreibt das Gesamtziel der Anwendung.
Wird fortgeschrieben, nie abgehakt.

## Kurzfassung

kanbanD ist ein Kanban-Board, das ein Ordner ist. Mit `kanbanD <ordner>` gestartet,
zeigt es genau das eine Board, dessen Spalten und Karten als Markdown-Dateien mit
Frontmatter in diesem Ordner liegen — meist in einem Git-Repository, neben der
Arbeit, um die es geht. Menschen arbeiten im Browser, KI-Agenten über die API oder
direkt an den Dateien; jede Änderung erscheint sofort in allen offenen Sichten.
Git ist das Gedächtnis des Boards: seine Geschichte lässt sich diffen, mergen und
branchen wie Code.

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
Anwendung mit Blazor-Oberfläche und WebApi. `kanbanD ./kanban-ordner` startet sie
und öffnet das erste Browserfenster.

kanbanD dreht es um: Das Board liegt im Repository, und Git ist sein Gedächtnis.

## Zielbild

- **Ein Board, das ein Ordner ist.** Spalten und Karten liegen als Markdown-Dateien
  mit Frontmatter vor. Sie sind ohne kanbanD lesbar und mit jedem Editor änderbar.
  kanbanD ist die bequemste Art, sie zu bearbeiten, aber nicht die einzige.

- **Git ist das Gedächtnis.** Jede Karte hat eine Geschichte: wer sie wann wohin
  bewegt hat. Das Board lässt sich diffen, mergen und branchen wie Code, ein Pull
  bringt die Arbeit anderer mit. Die Dateistruktur ist so geschnitten, dass typische
  Merges nicht in Konflikten enden.

- **Mensch und Agent arbeiten gleichberechtigt.** Der Mensch nutzt den Browser, der
  Agent die API oder die Dateien direkt. An jeder Änderung ist ablesbar, wer
  gehandelt hat.

- **Live überall, egal woher die Änderung kommt.** Ob der Browser, die API, ein
  Editor oder ein `git pull` eine Datei ändert: alle offenen Sichten zeigen es
  sofort, ohne Reload.

- **Zeiterfassung, die zum Arbeiten passt.** Ein Timer, der sich ohne Umstand
  starten und stoppen lässt, mit mitlaufender Dauer.

- **Die WBS als Nachbar statt als Importquelle.** Liegt die WBS im selben
  Repository, zeigt eine Karte auf ihren Knoten. `Braucht`-Beziehungen werden zu
  echten Abhängigkeiten zwischen Karten und nicht zu Fließtext.

- **Auswertungen aus der Geschichte.** Soll-Ist, Burndown und Zeiten je Karte und
  Kontributor werden aus den Dateien und ihrer Git-Geschichte gerechnet.

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

- **C# / .NET 10, eine Anwendung.** Blazor Server und die WebApi laufen im selben
  Prozess und im selben Projekt. Hausstil und Werkzeuge bleiben: `csharp-stil`,
  NUnit und Playwright.
- **Start mit einem Befehl.** `kanbanD <ordner>` startet die Anwendung und öffnet
  das erste Browserfenster.
- **Weboberfläche, im LAN erreichbar.** Kein Desktop-Programm und kein Betrieb im
  Internet.
- **Die Dateien sind der einzige Speicher.** Das sind Markdown-Dateien mit
  Frontmatter, ohne Datenbank daneben. Ein Index oder Cache darf existieren, muss
  sich aber jederzeit aus den Dateien neu aufbauen lassen und wird nicht versioniert.
- **Git-freundliche Form.** Die Dateien sind stabil sortiert, haben stabile IDs,
  sind zeilenorientiert und ändern sich nur dort, wo sich etwas ändert. Eine
  Bewegung ergibt einen kleinen Diff.
- **Full-Trust.** Keine Anmeldung und keine Rechteprüfung. Die Identität wird je
  Tab gewählt (`sessionStorage`), und ein Agent nennt sie bei jedem schreibenden
  Aufruf.
- **Eine festgelegte Kultur.** Die Oberfläche ist deutsch, Datumsangaben stehen im
  deutschen Format, Tage und Zeiten gelten in Ortszeit.
- **Der Mensch sieht jede Gestaltung, bevor sie gebaut wird.**

## Ausdrücklich nicht Ziel

- **Kein Cloud-Dienst.** Keine Accounts, keine Registrierung, kein Betrieb im
  Internet.
- **Keine Board-Verwaltung.** kanbanD führt keine Liste von Boards und wechselt
  nicht zwischen ihnen. Ein zweites Board ist ein zweiter Ordner mit einer zweiten
  Instanz.
- **Keine Datenbank als Wahrheit.** Was nicht in den Dateien steht, gibt es nicht.
- **Kein Git-Client.** Pull, Push, Branch und Merge macht der Mensch mit seinen
  gewohnten Werkzeugen. kanbanD kommt mit dem zurecht, was dabei herauskommt.
- **Kein Funktionsgleichstand mit Kanbanflow oder kanbanC.** Keine Mobile-Apps,
  keine Fremd-Integrationen, keine Benachrichtigungen und keine @-Mentions; aus
  kanbanC nicht übernommen sind Linien- und Projektboards, Klassen mit eigener
  Nummerierung, Critical Chain mit Puffer und Anhänge.
- **Kein Projektmanagement-Werkzeug.** Kein Gantt, keine Kapazitäts- und
  Terminplanung. Auswertungen rechnen aus dem, was geschehen ist.
- **Kein Ersatz für Vision, Anforderungen und WBS.** Diese Dokumente bleiben
  eigenständig; das Board zeigt auf sie, statt sie zu kopieren.

## Offene Richtungsfragen

- **Committet kanbanD selbst?** Möglich wäre ein Commit je Änderung, gebündelte
  Commits oder gar keiner, sodass der Mensch committet. Daran hängt, ob die
  Git-Geschichte wirklich die Geschichte jeder Kartenbewegung ist.
- **Wo steht das „Wer“?** Im Git-Autor, im Frontmatter oder in beidem. Das hängt
  an der ersten Frage.
- **Wie wird ein laufender Timer gespeichert?** Er kann als Datei geschrieben
  werden, was häufige Änderungen erzeugt, oder bis zum Stopp flüchtig bleiben, was
  bei einem Absturz verloren geht.
- **Wie sieht ein Konflikt aus?** Das betrifft gleichzeitiges Schreiben von UI, API
  und Editor sowie Merge-Konfliktmarker in einer Kartendatei. Offen ist, was
  kanbanD dann zeigt und tut.
- **Fließt etwas zur WBS zurück?** Zum Beispiel könnte eine erledigte Karte ihren
  Knoten grün setzen.
- **Wo werden Kontributoren definiert?** Im Board-Ordner, damit sie mitreisen, oder
  außerhalb, damit sie über Boards hinweg gelten.
- **Was geschieht mit kanbanC-Beständen?** Import, Migration oder ein Neuanfang.
- **Welche weiteren Aufgabenquellen?** E-Mail und Formulare bleiben Möglichkeiten,
  keine Vorhaben.

## Ergänzungshistorie

| Datum | Ergänzung |
|---|---|
| 2026-09-26 | Vision angelegt (Nachfolger von kanbanC: Board als Markdown-Ordner, Git als Gedächtnis, eine Anwendung mit einem Startbefehl, Live auch bei Dateiänderungen, WBS als Nachbar) |
