# ADR-0025: Genau ein Auslöser je Aktion — die Schlange endet immer erfüllt, der Listenindex lebt nur unter dieser Sperre

**Status**: Akzeptiert
**Datum**: 2026-11-13
**Entscheider**: Claude (autonom, architekt, Auftrag Director der Software-Factory)
**Kontext-Anforderung**: Karte #138 (zusammengelegt aus #106, #65, #95 und #121 A2) und Karte #80 (aus #76 A3); die Anforderung folgt über den planer
**Erprobt durch**: —
**Bedingt, löst nicht ab**: die akzeptierte Schwäche „Teilaufgaben-Index" aus [ADR-0017](0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) (Konsequenzen) bleibt bestehen, aber nur noch unter der Sperre dieser ADR

## Kontext

Zwei Karten mit derselben Wurzel: der Weg vom Auslöser über die Warteschlange zur Anfrage hält weder „einmal" noch „immer" ein.

**Doppelte Auslösung (#138).** Aktionen auf Listen sind über die Stelle adressiert — `DELETE /api/aufgaben/{nr}/teilaufgaben/{i}` (`web/app.js:1416–1428`, `i` aus `data-arg`), Herkünfte ebenso (`:1733`). Der Schreibweg `schreiben()` (`:479–485`) wartet auf die Antwort, aber der Auslöser bleibt die ganze Zeit bedienbar; jeder Klick ist ein neuer Aufruf. Der zweite Auslöser trifft deshalb den nachgerückten Eintrag (#106: nur `b` löschen, `c` bleibt) oder wiederholt dieselbe Aktion (#65 zweiter Tipp hakt den Nachbarn ab; #95 zweimal „Anlegen" legt zwei Karten an, `nf-anlegen` `:1305`; #121 A2 zweimal „Fertig" im Spalten-Dialog, `setup-ok` `:1978`). Der Betreiber hat den Vorrang gesetzt: „Datenverlust ohne Rückweg wiegt schwerer als jede offene Gestaltungsfrage" (`AI-Team/po-entscheidungen.md:166`).

**Die Kette bleibt rejected (#80).** `warteschlange()` (`web/app.js:433–442`) endet mit `.then(() => { …; return laden(); })` ohne `catch`. Scheitert dieses Laden (Netzfehler, Server weg), ist `schlange` rejected. Danach gilt für jede weitere Aktion: `schlange.then(anfrage)` überspringt `anfrage` — die eigene Änderung wird **still** nicht gesendet, ohne Meldung. Zugleich wird `schlangeOffen` nicht mehr heruntergezählt, und `ereignis()` (`:2804`) überspringt jedes Live-Ereignis, solange `schlangeOffen > 0`: Die Ansicht bleibt stehen, bis die Seite neu geladen wird. Die Karte verlangt vor dem Bau eine Probe (Netzfehler beim Laden der Schlange); sie belegt den Ist-Zustand, die Wahl unten hängt nicht von ihr ab.

**Was schon entschieden ist.** [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md) Nachtrag N3 gibt Listenzeilen einen inhaltsbezogenen `data-halt` für den **Fokus**; [R00138](../../Anforderungen/R00138-fokus-trifft-nach-fremder-aenderung-dasselbe-element.md) grenzt ausdrücklich ab: „die Adressierung des Löschens selbst (welche Stelle die `DELETE`-Anfrage trifft)" ist nicht dort entschieden. [ADR-0017](0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) hat die Indexadressierung **in Kauf genommen**: „Ist der gezeigte Stand veraltet, trifft das Entfernen schon heute die falsche Teilaufgabe. Rückgängig heilt das, löst es aber nicht." Genau diesen veralteten Stand erzeugt der Doppelklick.

### Qualitätsziele und Szenarien

- **Die Dateien sind der einzige Speicher** (Vision, Leitplanke): Ein Tastendruck oder Doppelklick, den der Mensch nicht als zweiten Befehl gemeint hat, darf keinen Commit erzeugen. Maß: die Abnahme-Proben der Karte (ein Commit, ein gelöschter Eintrag).
- **Rückgängig hält, was es verspricht** (Vision Z. 104, ADR-0017): Was ohne Rückfrage verschwindet, muss der gemeinte Eintrag sein.
- **Lastprofil**: bis zu zehn Agenten schreiben gleichzeitig; die Oberfläche darf ihre eigenen Änderungen nicht verlieren, wenn ein Laden scheitert.
- **Änderbarkeit**: Eine neue Aktion erbt Sperre und Kettenende, ohne dass jemand daran denken muss; sonst wiederholt sich der Fehler bei jedem neuen Knopf.

## Optionen

### Option A: Sperre am Auslöser, Kette immer erfüllt, Index bleibt (gewählt)

- Ein Schreib-Auslöser hat keine Wirkung, solange seine Anfrage läuft; die Sperre ist Zustand der Oberfläche (ADR-0007) und übersteht das Neuzeichnen.
- `warteschlange()` endet in jedem Fall erfüllt; ein gescheitertes Laden wird gemeldet und blockiert nichts.
- Vorteile: deckt alle vier Fälle mit **einem** Mechanismus; kein Dateiformat ändert sich; die vorhandene Warteschlange bleibt der eine Ort; die Probe je Fall ist ein Doppelklick.
- Nachteile: nur clientseitig — ein zweiter Browser-Tab und ein gleichzeitig schreibender Agent bleiben ungeschützt; verlässt sich darauf, dass jede Aktion durch denselben Verteiler läuft.

### Option B: Stabile Adressierung — Kennungen für Teilaufgaben, Herkünfte, Wirkungen

- Vorteile: robust gegen alles, auch gegen zwei Tabs und fremde Änderungen; die Stelle verschwindet als Identität.
- Nachteile: Teilaufgaben sind Markdown-Kästchen (`- [ ] Text`, `src/format/aufgabe.rs:427`) — Kennungen wären ein Formatwechsel mit Rundlauf, Migration und Handpflege in einer Datei, die der Betreiber selbst editiert. Dasselbe für Herkünfte (Verweise) und Wirkungen (Knoten-IDs). Der Preis steht in keinem Verhältnis zum Fall „zweimal geklickt"; die Fokussuche hat diese Frage für ihren Bereich schon ohne Kennungen gelöst (ADR-0007 N3).

### Option C: Optimistisch zeichnen — der Eintrag verschwindet sofort, die Anfrage folgt

- Vorteile: der zweite Klick trifft nie einen nachgerückten Eintrag, weil er nicht mehr da ist; fühlt sich schnell an.
- Nachteile: eine zweite Wahrheit neben `S.` (die Ansicht zeigt, was der Server noch nicht hat), Rücknahme bei Fehlschlag, Konflikt mit ADR-0007 (Sichtzustand übersteht das Neuzeichnen) und ADR-0014 (nur die neueste Antwort wird übernommen). Behebt #95 und #121 A2 nicht.

### Option D: Nur gleiche Anfragen zusammenfassen (Deduplizierung in der Schlange)

- Vorteile: kleinster Eingriff; zwei identische Aufrufe ergeben einen.
- Nachteile: „gleiche Anfrage" ist bei `POST …/teilaufgaben` ohne Schlüssel nicht erkennbar, und der zweite Klick auf ein **anderes** Ziel (nachgerückte Stelle) ist eine andere Anfrage — der Fall #106 bliebe offen.

## Entscheidung

**Option A.** Der Weg vom Auslöser zur Anfrage hält zwei Invarianten ein: **einmal** (Sperre am Auslöser) und **immer** (die Kette endet erfüllt). Damit bleibt die in ADR-0017 in Kauf genommene Indexadressierung tragbar: Zwei Anfragen derselben Liste können nicht mehr überlappen, also gibt es keinen „veralteten gezeigten Stand" mehr, den ein zweiter Auslöser träfe. Bewusst in Kauf genommen: ein zweiter Browser-Tab und ein gleichzeitig schreibender Agent bleiben ungeschützt (Option B wäre der Weg, wenn das je zum Fall wird), und die Sperre ist nur so gut wie ihre eine Stelle.

### Regeln

1. **Genau ein Auslöser je Aktion.** Solange die Anfrage eines Schreib-Auslösers läuft, hat derselbe Auslöser keine Wirkung: keine zweite Anfrage, kein zweites Fenster, kein zweiter Commit. Ausgenommen sind Auslöser ohne Schreibwirkung (Ansicht wechseln, Fenster öffnen, Menü). Der Sperrzustand ist Zustand der Oberfläche (`S.ui`, ADR-0007) und übersteht das Neuzeichnen; er darf nicht allein am DOM-Knoten hängen.
2. **Der Auslöser verliert dabei nicht den Fokus.** Die Sperre ist eine Prüfung im Verteiler (`act`), sichtbar höchstens als `aria-disabled` — **nicht** als natives `disabled` (das nimmt den Knoten aus der Tabreihenfolge, der Fokus fiele auf `BODY`; ADR-0010, „Fokus nie `BODY`"). Wie die Sperre aussieht, entscheidet UX.
3. **Die Schlange endet immer erfüllt.** `warteschlange()` gibt eine Kette zurück, die nach jedem Fehler erfüllt ist; `schlangeOffen` wird in jedem Fall heruntergezählt; ein gescheitertes Laden wird dort gemeldet, wo die Aktion ausgelöst wurde (Fuß/Toast), und blockiert weder folgende Aktionen noch Live-Ereignisse. Eine Fehlermeldung nur in der Konsole ist ein Befund.
4. **Adressierung.** Wo die Datei eine Kennung trägt, adressiert die Anfrage sie (Kartennummer, Zeit `wer@beginn`, Anhangname). Die **Stelle** (`data-arg`) bleibt für Teilaufgabe, Herkunft und Wirkung, weil das Aufgabendatei-Format keine Kennungen trägt (ADR-0017); sie ist nur unter Regel 1 tragbar. Ein Kennungsfeld im Aufgabendatei-Format ist eine eigene Entscheidung (Option B), nicht Teil dieser ADR.
5. **Anlegen trägt einen Schlüssel.** `POST /api/aufgaben` mit `key` antwortet bei Wiederholung `200` mit `neu: false` (R00098, gebaut). Die Oberfläche nutzt den Schlüssel für „Anlegen" und „Anlegen und weitere", damit ein Doppelklick auch ohne Sperre keine zweite Karte erzeugt.
6. **Eine Stelle.** Sperre, Kettenende und Meldung liegen im gemeinsamen Verteiler der Aktionen (`web/app.js`), nicht je Sicht. Ein Auslöser, der `api(...)` schreibend direkt ruft statt über den Verteiler, ist ein Befund.

### Durchsetzung (Fitness-Funktion)

- **E2E je Fall der Karte #138**: Doppelklick auf ✕ (120 ms und 600 ms, Touch 390) → nur `b` gelöscht, `c` bleibt, genau ein Commit; Doppeltipp auf ein Kästchen → nur `b` abgehakt, auf der letzten Teilaufgabe öffnet der zweite Tipp kein Fenster; Doppelklick „Anlegen" → genau eine Aufgabe; zweimal „Fertig" im Spalten-Dialog → genau ein Commit (`git log --oneline | wc -l` vor/nach).
- **E2E zu #80**: Laden der Schlange künstlich scheitern lassen (Route abfangen / Netzfehler), dann eine Aktion auslösen → die Aktion kommt an, der Stand zeichnet neu, und ein Live-Ereignis wirkt wieder (heute: beides still weg).
- **Unit**: `warteschlange`-Kette mit einem abgelehnten `laden()` → die nächste Anfrage läuft, `schlangeOffen` endet bei 0.
- **Review-Punkt für `code-reviewer` und `architektur-reviewer`**: ein schreibender Auslöser außerhalb des Verteilers, eine Sperre am Knoten statt im Zustand, oder ein Ketten-Ende ohne `catch` ist ein Befund.

## Konsequenzen

- **Positiv:**
  - Alle vier Doppel-Auslöser-Fälle (Datenverlust eingeschlossen) schließen sich mit einem Mechanismus statt mit vier Sonderwegen.
  - Kein Dateiformat ändert sich; ADR-0017 bleibt in Kraft.
  - Ein Netzfehler beim Laden bleibt eine Meldung und wird nicht zum Stillstand der Oberfläche.
- **Akzeptierte Schwächen:**
  - Ein zweiter Tab bleibt ungeschützt; ebenso ein Agent, der zwischen zwei Anfragen dieselbe Liste ändert.
  - Die Stelle als Adresse bleibt — die Sperre macht sie tragbar, nicht richtig.
  - `aria-disabled` sieht ohne Gestaltung aus wie bedienbar; UX entscheidet über die sichtbare Form.
- **Fallstricke für den Bau:**
  - **Fokus:** `disabled` statt `aria-disabled` setzt den Fokus auf `BODY` (R00106, ADR-0010). Die Sperre gehört in den Verteiler, nicht ans Attribut.
  - **Live-Ereignisse:** `ereignis()` (`web/app.js:2804`) prüft `schlangeOffen`; ein Zähler, der bei einem Fehler nicht zurückgeht, hält die Ansicht dauerhaft an — die Probe zu #80 deckt genau das ab.
  - **Rückgängig (ADR-0017):** Der gemerkte Inhalt (`undo`) entsteht vor dem Senden aus dem gezeigten Stand; bei unterbundenen zweiten Auslösern bleibt er eindeutig. `r00112-rueckgaengig.spec.js` muss grün bleiben.
  - **Doppelte Meldung:** Fängt die Schlange ihren Fehler, darf die Aktion ihn nicht ein zweites Mal melden — eine Meldung je Fehlschlag.
  - **Tests, die zählen:** Proben, die heute zwei Anfragen sehen (Doppelklick-Tests), zählen künftig eine; sie sind zuerst umzustellen.

### Pre-Mortem

| Gescheitert, weil … | Gegenmaßnahme |
|---|---|
| Die Sperre sitzt an einem Knopf und der nächste Knopf vergisst sie | Regel 1/6: die Prüfung im Verteiler, Review-Punkt; die E2E-Proben decken vier verschiedene Auslöser |
| Ein Fehlschlag wird jetzt zweimal gemeldet (Schlange und Aktion) | eine Meldung je Fehlschlag; die Probe zu #80 prüft genau eine Fußmeldung |
| `aria-disabled` bleibt unsichtbar und der Mensch klickt ins Leere | UX gestaltet den Sperrzustand; die Probe misst nur die Wirkung (ein Commit), nicht das Aussehen |
| Der Zähler geht bei einem Abbruch (Navigation, Fenster zu) nicht zurück | `schlangeOffen` wird in einem `finally`-artigen Schritt heruntergezählt, nicht im Erfolgszweig |

## Offene Fragen

- Soll ein **zweiter Tab** geschützt werden (Server: optimistische Sperre je Datei, 409/423)? Das ist eine eigene Entscheidung (Option B) und heute nicht der Fall; die Karte nennt ihn nicht.
- Soll die Oberfläche bei laufender Anfrage sichtbar „läuft" zeigen (ADR-0019-Muster) oder nur die Wirkung unterbinden? Gestaltung, nicht Struktur.

## Quellen / Bezüge

- Karte #138 (aus #106, #65, #95, #121 A2), Karte #80 (aus #76 A3); `AI-Team/po-entscheidungen.md:166` (Vorrang „Datenverlust ohne Rückweg")
- `web/app.js:433–442` (`warteschlange`), `:479–485` (`schreiben`), `:1305` (`nf-anlegen`), `:1416–1428` (`teil-weg`), `:1733` (`herkunft-weg`), `:1978` (`setup-ok`), `:2804` (`ereignis`, `schlangeOffen`)
- [ADR-0007](0007-sichtzustand-uebersteht-das-neuzeichnen.md) (Sichtzustand, N3 `data-halt`), [ADR-0010](0010-fokusfuehrung-ueber-ebenen-mit-rueckgabe.md) (Fokus, „nie `BODY`"), [ADR-0014](0014-nur-die-neueste-antwort-wird-uebernommen.md) (Marke der Schlange), [ADR-0017](0017-rueckgaengig-als-gegenaktion-mit-gemerktem-inhalt.md) (Index, in Kauf genommen)
- [R00138](../../Anforderungen/R00138-fokus-trifft-nach-fremder-aenderung-dasselbe-element.md) (Abgrenzung der Löschadressierung), R00098 (`key`, `neu: false`)
- Baustein [A00009 Oberfläche](../Architektur/A00009-oberflaeche.md)

## Nachtrag N1 2026-11-13: Probe zu #80 — der Ist-Zustand, geschärft; Kontext berichtigt

Nachgetragen nach der Probe, die Karte #80 vor dem Bau verlangt (Karte #80, Architektur-Durchgang 2026-11-13). Die Entscheidung (Option A, Regeln 1–6) bleibt **unverändert**; berichtigt wird eine Ist-Aussage im Kontext, und die Meldungspflicht aus Regel 3 wird geschärft.

**Probe.** E2E gegen `target/debug/kanbanD` mit Wegwerf-Ordner: eine Karte mit drei offenen Teilaufgaben, abgehakt über den Kartenknopf `.naechste-ziel` (`data-act="teil-karte"` → `warteschlange()`, `web/app.js:1372–1383`); der **nächste** `GET /api/zustand` wird hart abgelehnt (`fetch` wirft `TypeError: Failed to fetch`), sodass das Nachladen der Schlange scheitert. Ergebnis, in drei Läufen gleich:

| Schritt | heutiges Verhalten |
|---|---|
| 1. Abhaken; das Nachladen der Schlange scheitert | `PATCH …/teilaufgaben/0` geht raus und wird gespeichert. Danach ist die Kette `schlange` rejected. **Keine sichtbare Meldung** (die Meldung des `catch` liegt nur im Zustand `S.ui.fensterFehler`, den nur der Fuß eines offenen Aufgabenfensters zeichnet, `web/ansicht.js:343`); eine unbehandelte Ablehnung erscheint als `pageerror` in der Konsole |
| 2. Abhaken | `PATCH …/teilaufgaben/1` wird **nicht** gesendet — die eigene Änderung geht still verloren. Erst jetzt setzt der `catch` `S.ui.fensterFehler` auf „Keine Verbindung zum Server — nichts geändert." — eine Meldung, die zum gescheiterten **Nachladen** gehört, nicht zum Klick, und im Aufgabenfenster neben der gespeicherten Änderung stünde |
| 3. Abhaken | wird wieder gesendet: das Nachladen aus Schritt 2 ist gelungen und hat die Kette geheilt |

Zwischen Schritt 1 und 3 fällt kein weiterer eigener Schritt aus; verliert das Nachladen wiederholt (Server in der Neustartpause, ein Endpunkt der Sammelabfrage antwortet mit Fehler), verliert sich je Nachladen genau der nächste eigene Schritt.

**Berichtigung des Kontexts.** Der Kontext (Abschnitt „Die Kette bleibt rejected (#80)") sagt, `schlangeOffen` werde „nicht mehr heruntergezählt" und `ereignis()` überspringe deshalb jedes Live-Ereignis, die Ansicht bleibe bis zum Neuladen stehen. Für den hier geprüften Fall — das Nachladen **wirft** — trifft das nicht zu: `--schlangeOffen` steht im letzten `.then` **vor** `return laden()` (`web/app.js:437–439`) und läuft bei einer Ablehnung mit; gemessen steht `schlangeOffen` direkt nach dem gescheiterten Nachladen auf `0`. Der Schaden des **geworfenen** Falls ist damit eng: genau die nächste eigene Änderung geht still verloren, und der gezeichnete Stand bleibt der alte, bis ein nächster Anlass neu lädt. Die Kontext-Aussage gilt für den **hängenden** Fall: bleibt die Anfrage selbst unbeantwortet (`api()` setzt keine Frist, `web/app.js:90–104`), läuft das letzte `.then` nie, `schlangeOffen` bleibt dauerhaft > 0, und `ereignis()` (`:2804`) überspringt fortan jedes Live-Ereignis — derselbe sichtbare Stillstand, andere Ursache. Das ist eine eigene Restlücke (unten), nicht Teil dieser Entscheidung.

**Geschärfte Pflichten für den Bau (aus Regel 3 abgeleitet).**
1. Das Kettenende fängt in **jedem** Fall; auch ein geworfenes `laden()` hinterlässt keine unbehandelte Ablehnung. Eine Ablehnung, die nur als Konsolenfehler (`pageerror`) erscheint, ist der von Regel 3 genannte Befund.
2. Je Fehlschlag genau **eine** Meldung, und sie nennt den richtigen Vorgang: Ein gescheitertes **Nachladen** darf nicht „nichts geändert" heißen — die eigene Änderung ist gespeichert. Sie ist von der Meldung einer gescheiterten eigenen Anfrage unterscheidbar.
3. Die Meldung erreicht den Auslöser: Wer auf dem **Board** abhakt, sieht den Fuß des Aufgabenfensters nicht. Die Meldung gehört dorthin, wo ausgelöst wurde (Regel 3, „Fuß/Toast").
4. Die Abnahme deckt **beide** Schritte ab: nach dem gescheiterten Nachladen kommt die **nächste** eigene Änderung an (heute rot, siehe Probe), und `schlangeOffen` endet bei 0.

**Benannte Restlücke (Vorschlag für eine eigene Karte).** Eine hängende Anfrage — der Server antwortet nie — hält Kette und Zähler dauerhaft offen und legt Aktionen **und** Live-Ereignisse still, ohne jede Meldung. Regel 3 (Kette endet erfüllt) heilt das nicht, weil ein hängendes Glied weder erfüllt noch abgelehnt wird. Abhilfe wäre eine Frist je Anfrage (`AbortController`, Option B aus ADR-0014) mit definiertem Fehlerpfad; sie berührt alle Aufrufer von `api()` und ist eine eigene Entscheidung.

## Nachtrag N2 2026-11-13: Reichweite aus dem Härtungsdurchgang (2026-11-12) — drei weitere Fälle; Regel 4 berichtigt, Regel 6 geschärft

Nachgetragen nach dem Härtungsdurchgang des Betreibers (#55, #134; Kartenkommentare zu #138 vom 2026-11-12). Die Entscheidung (Option A, Regeln 1–6) bleibt **unverändert**. Drei weitere Fälle derselben Klasse kommen in die Reichweite; zwei Regeln werden berichtigt bzw. geschärft.

**Die drei Fälle.**

1. **„⇄ Achsen tauschen“** (Bericht „Bestand nach Labels“): `bestand-tauschen` (`web/app.js:1603`) → `bestandAchsenSetzen('tauschen')` (`:49–61`). Der zweite Klick rechnet aus dem **schon getauschten** Zustand (`S.ui.bestandLokal`, gelesen in `bestandAchsen`, `web/ansicht.js:1403–1405`) und tauscht zurück — zwei `PUT …/bestand` (`web/app.js:58`), zwei Commits, netto keine Änderung. Ein **Schreib-Auslöser** → Regel 1. Probe: Doppelklick → höchstens ein Commit.
2. **`wirkung-weg`** (`web/app.js:1681–1686`, Knopf `web/ansicht.js:642`): über den **Index** adressiert (`data-arg="${j}"`), die Anfrage ruft `api` direkt.
3. **`nf-teil-weg`** (`web/app.js:1327`, Knopf `web/ansicht.js:230`): entfernt eine **Entwurfs**-Zeile **lokal** (`u.neu.teil`), ohne Anfrage; der zweite Klick trifft die nachgerückte Zeile.

**Regel 6 geschärft (die eine Stelle).** Die Stelle, an der die Sperre „Anfrage in Arbeit“ beobachtet, ist der **Schreibweg**, durch den **jede** schreibende Anfrage läuft — die Warteschlange (`warteschlange`, `web/app.js:442`), nicht allein der Verteiler `act` (`:1275`). Heute gehen Anfragen daran vorbei: `schreiben` (`:482`), `bestandAchsenSetzen` (`:58`), `wirkung-weg` (`:1683`), `bewegen` (`:1344`), `nf-anlegen` (`:1330`), `wbs-status` (`:1622`) und weitere. Sie sind auf die eine Stelle zu ziehen; ein Schreib-Auslöser, dessen Anfrage daran vorbeigeht, ist ein Befund (Regel 6, Review-Punkt). Ohne diese Bündelung deckt Regel 1 die Fälle 1 und 2 nicht.

**Regel 4 berichtigt.** Der Satz „das Aufgabendatei-Format trägt keine Kennungen“ gilt nur für die **Teilaufgabe** (Markdown-Kästchen). **Wirkungen** tragen `application:node` (`Wirkung::schluessel()`, `src/modell/aufgabe.rs:326–331`), **Herkünfte** einen Verweis. Beide Kennungen sind aber **nicht garantiert eindeutig** (zwei gleiche Verweise; dieselbe Wirkung zweimal; ein `create` vor der Ausführung hat noch keinen Knoten — `schluessel()` ist dann `None`). Deshalb bleibt die **Stelle** (`data-arg`) für Teilaufgabe, Herkunft und Wirkung — aber aus dem Grund „die Kennung ist nicht eindeutig“, **nicht** „es gibt keine“. Sie ist nur unter Regel 1 tragbar (unverändert).

**Fälle ohne Anfrage (neu).** Regel 1 greift nur, solange eine **Anfrage** läuft. Ein Auslöser ohne Anfrage, der eine **lokale** Liste ändert (`nf-teil-weg`, Entwurfs-Teilaufgaben in `u.neu.teil`), wird über eine **stabile Kennung der Zeile** adressiert (im Zustand vergeben; kein Serverformat, keine Anfrage); der zweite Klick auf dasselbe ✕ ist ein No-op. Sonst trifft er die nachgerückte Zeile (dieselbe Klasse wie #106, ohne Commit).

**Proben (ergänzt zur Durchsetzung).** Doppelklick „⇄ Achsen tauschen“ → höchstens ein Commit; Doppelklick auf ein Wirkungs-✕ → höchstens ein Commit; Doppelklick auf ein Entwurfs-✕ → nur die gemeinte Zeile entfernt.
