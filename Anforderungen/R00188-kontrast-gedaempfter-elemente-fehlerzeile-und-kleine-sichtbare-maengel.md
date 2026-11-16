---
id: R00188
status: Neu
datum: 2026-11-16
---

# R00188: Kontrast gedämpfter Elemente, Fehlerzeile beim Einrichten und kleine sichtbare Mängel

## Beschreibung

Herkunft: Karten #57, #68 und #55, gebündelt mit #140 (product-owner 2026-11-15, „Kleine Karten bündeln“). Drei Mitglieder, je mit eigenen Kriterien (57-…, 68-…, 55-…); nichts davon ist neue Bedienung.

- **#57:** Die Initiale einer stillgelegten Person wird über Deckkraft gedämpft und misst 2,08–2,90 : 1 (`opacity:.5`) bzw. 2,26–3,23 : 1 (`.55`) statt 4,5 : 1 ([ADR-0011](../Dokumentation/ADRs/0011-farbrollen-in-paaren-kontrast-als-probe.md), Nachtrag N2, Rechnung vom 2026-11-13). Betreiber-Entscheidung 2026-11-13: „lesbar machen. Der Name einer stillgelegten Person ist Information: statt `opacity` ein gedämpfter Farbton mit ≥ 4,5:1, der Zustand zusätzlich gekennzeichnet (Titel/Hilfstext). Für Zeilen, in denen wirklich nichts bedienbar ist, bleibt Dämpfung erlaubt (dann `aria-disabled`/`disabled` + Grund).“
- **#68:** Die Fehlermeldung in der Modusleiste von „Spalten einrichten“ steht einzeilig und kürzt mit „…“ (`.fehl-kopf`, `web/kd-app.css:667`); bei 1280 px fehlt das Ende der Meldung und damit die Handlungsanweisung.
- **#55:** Kleine Mängel, die ein Mensch sieht — am Code vom 2026-11-16 geprüft, erledigte und unsichtbare Punkte der Karte sind gestrichen (Liste unter „Implementierungshinweise“).

Zahlt ein auf: [Vision](R00000-vision.md) — was die Oberfläche zeigt, ist lesbar und stimmt ([R00107](R00107-kontrast-farbrollen-in-paaren.md)).

## Akzeptanzkriterien

**Ausgangslage:** Board „Entwicklung“; Personen `st` (Mensch, aktiv, im Browser gewählt), `mi` (Mensch, stillgelegt), `cl` (Agent, aktiv); Aufgabe #1 mit den Zuständigen `st` und `mi`; Fenster 1280 × 900 px, hell und dunkel.

- [ ] **57-1 Stillgelegte Initiale ist lesbar:** Die Initiale von `mi` misst auf der Karte von #1, in der Personenliste und in den Einstellungen unter „Personen“ mindestens 4,5 : 1 gegen ihre Fläche, in beiden Themen (heute 2,08–3,23). Gedämpft wird über einen Farbton, nicht über Deckkraft; das gedämpfte Paar steht in der Paartabelle der Kontrastprobe. Form, Größe und die Rollenfarben aktiver Personen bleiben.
- [ ] **57-2 Zustand genannt, Dämpfung nur mit Grund:** An jeder der drei Stellen steht „stillgelegt“ als sichtbarer Text oder als Hilfstext der Initiale (heute fehlt er in den Einstellungen). Wo eine gedämpfte Initiale unter 4,5 : 1 bleibt, liegt sie in einer als nicht bedienbar gekennzeichneten Zeile mit genanntem Grund — das gilt neu auch für die Zeile einer stillgelegten Person im Dialog „Zuständige“; die Zeile im Ich-Menü und die gesperrten Zuständigen-Knöpfe bleiben, wie sie sind. Setzt jemand die Deckkraft an der Initiale wieder auf 0,5, wird die Kontrastprobe rot.
- [ ] **68-1 Fehlermeldung beim Einrichten ganz lesbar:** Scheitert „Fertig“ in „Spalten einrichten“ mit einer Meldung von 120 Zeichen, steht sie bei 1280 px und bei 320 px vollständig da, ohne „…“ — sie bricht um, die Modusleiste wird dafür höher; „Verwerfen“ und „Fertig“ bleiben sichtbar und bedienbar.
- [ ] **55-1 „gespeichert“ nur, wenn gespeichert wurde:** Im Aufgabenfenster von #1 den Titel um 10:00:05 erfolgreich ändern, danach den Titel leeren und abschicken (abgelehnt) → im Fuß steht die Fehlermeldung und daneben kein „gespeichert hh:mm:ss“; es entsteht kein Commit. Nach der nächsten angenommenen Änderung um 10:01:30 steht wieder „gespeichert 10:01:30“ und keine Fehlermeldung. Gleiches gilt für abgelehnte Eingaben in Dauer und Herkunft.
- [ ] **55-2 Cursor im Zahlenfeld bleibt:** Im Berichtsfilter steht „Messbasis“ auf 90, das Feld hat den Fokus, der Cursor steht am Ende; ein [Live-Ereignis](../Dokumentation/Domaenenwissen/D00005-live-ereignis.md) zeichnet neu (ein zweiter Teilnehmer ändert einen Titel); ich tippe „1“ → im Feld steht 901 (heute 190). Mit dem Cursor am Anfang ergibt dieselbe Folge 190.
- [ ] **55-3 Kleine Beschriftungen stimmen:** (a) Die Überschrift des Ich-Menüs lautet „ICH BIN …“ ohne den Dateischlüssel „people:“. (b) Im Mehr-Menü steht „☑ Signale oben“ mit sichtbarem Abstand zwischen Haken und Wort. (c) Die Eigentümer-Auswahl einer Spalte mit unbekanntem Eintrag zeigt „„chef“ (unbekannt)“ ungekürzt oder nennt den vollen Text als Hilfstext. (d) Der gesperrte Knopf „⇄ Achsen tauschen“ nennt seinen Grund als Hilfstext. (e) Im kumulativen Fluss überdecken sich die Randbeschriftungen „angekommen 7“ und „fertig 7“ bei gleichem Wert nicht.

## Tests

Kontrast: Unit für das gedämpfte Paar (Maß 4,5 in beiden Themen), E2E mit Personenliste, Einstellungen und Karte in der Bereichsliste der Kontrastprobe; Gegenproben nach ADR-0011 N2 „Durchsetzung“ (Deckkraft zurück → rot; dasselbe Element in einer nicht bedienbaren Zeile bleibt ungemeldet). Je übriges Kriterium ein E2E-Test, zuerst rot; 55-2 zusätzlich als Unit am Sicherer.

## Implementierungshinweise

- **#57:** `.pk-still{opacity:.5}` (`web/kd-app.css:249`), `.pt tr.ruhe .pk{opacity:.55}` (`:588`; trifft auch die Zuständigen archivierter Aufgaben in der Aufgabenliste, `web/ansicht.js:1101`), `.zw-p.still .pk{opacity:.5}` (`:1036`); Initiale in den Einstellungen von Hand gebaut, ohne Titel (`web/ansicht.js:2137`). `.ruhig` (`:529`) trägt keinen Text und bleibt (N2 Punkt 4). Töne wählt der Bau, das Maß entscheidet die Probe; kein Farbwert außerhalb von `web/kd-tokens.css`.
- **#68:** `.fehl-kopf` steht nur in der Modusleiste von „Spalten einrichten“ (`web/ansicht.js:40`); die Leiste bricht unterhalb der Stufe `large` schon um (`web/kd-app.css:59`).
- **55-1:** Der Fuß zeigt `u.gespeichert` unabhängig von `u.fensterFehler` (`web/ansicht.js:370`). Schadensstelle: die Meldung einer angenommenen Änderung eines anderen Felds (R00155 G-3) bleibt, wie sie ist.
- **55-2:** `auswahlGrenze` liest bei `type="number"` keine Auswahl (`web/sichtzustand.js`, `fokusstand`); Felder: `web/ansicht.js:1165`, `:1992`, `:1995`.
- **55-3:** `web/ansicht.js:562` (a), `:139` (b), `:2185` und `.eig-wahl` `web/kd-app.css:521` (c), `:1739` (d), `rand` `:1438` (e; Vorbild Burndown `:1366`, 18 px Versatz).
- **Aus #55 gestrichen:** Amber-Schrift an `.fehl-kopf` und `.tm-ziel.an` (erledigt mit #9, heute `--kd-warn` bzw. `--kd-accent-ink`) · Doppelklick „Achsen tauschen“ (→ #138) · Fokus nach Board-Wechsel (→ #141) · `GET /api/aufgaben/null/anhaenge` (am Code kein Aufruf ohne offene Aufgabe mehr zu finden, für den Menschen ohne Wirkung) · „$,Σ“ beim Kopieren (auf dem Schirm richtig) · oberste y-Marke unter dem Höchstwert (Skala stimmt) · unerreichbarer „lädt“-Zustand der Berichte · zusätzliches Zeichnen im Fever Chart, Aufblitzen nach Berichtswechsel, Testhinweis `filterSchalten` (keine oder nur flüchtige Wirkung).
- **Nicht hinein:** Ränder von `.btn` und Auswahlfeldern auf 3 : 1 (offene Frage) · durchscheinender Rand am festen Zeilenkopf des Bestands (375 px dunkel; am Code nicht belegbar).

## Warum löst diese Anforderung das Problem?

Auslöser: Wer wissen will, wem eine alte Karte gehörte, kann die blasse Initiale der stillgelegten Person kaum lesen; wer beim Einrichten einen Fehler bekommt, sieht nur den Anfang der Meldung; wer eine abgelehnte Eingabe macht, liest daneben „gespeichert“. Trägt die Initiale einen Farbton mit 4,5 : 1, bricht die Meldung um und steht „gespeichert“ nur nach einem Erfolg (X), sagt jede dieser Stellen, was ist (Y); der Mensch liest den Namen, folgt der Anweisung und weiß, ob seine Eingabe angekommen ist (Z).

## Offene Fragen

- Ränder von `.btn` und Auswahlfeldern (≥ 3 : 1, WCAG 1.4.11, aus #55): der Rand trägt `--kd-line-strong`, das die ganze Oberfläche verwendet. Empfehlung: nicht in diesem Paket, eigene Karte mit Entscheidung des gestalters — die Kriterien folgen dieser Empfehlung.
