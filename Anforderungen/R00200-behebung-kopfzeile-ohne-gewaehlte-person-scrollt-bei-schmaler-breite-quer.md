---
id: R00200
status: Offen
datum: 2026-11-19
ursprung: Bug-Report
ursprungslauf: R00140
---

# R00200: Behebung — Kopfzeile ohne gewählte Person scrollt bei schmaler Breite quer

## Beschreibung

Herkunft: Karte #205 (Vorrang, Befund des ux-reviewer aus der Detailplanung von #204). Bei 320 px und Touch scrollt jede Hauptseite quer, solange im Tab keine Person gewählt ist. Das ist der Normalfall jeder neuen Sitzung ([R00003](R00003-identitaet-waehlen.md) US-2). Es ist ein Rückfall gegen [R00140](R00140-navigation-seltene-ziele-im-mehr-menue.md) („Bei 320/375/414 px scrollt nichts quer“) im [schmalen Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md). Zuschnitt des product-owner: `AI-Team/po-entscheidungen.md` Z. 348–352. Technik vom architekt am Code gemessen (Kartenkommentar #205), kein ADR.

**Beobachtet** (architekt, headless Chromium auf 8dd99d8e, 320 px, Touch, ohne gewählte Person, gegen `clientWidth` gemessen): `scrollWidth` Board 367, Personen 337, Aufgaben 337, Einrichten 340, Berichte 331, jeweils bei `clientWidth` 320. `#t-mehr` ragt rechts hinaus (Personen: right = 337).

**Ursache (architekt):**

- `#t-ich` zeigt ohne Person „nicht gewählt ▾“ mit 99 px Breite (`web/ansicht.js:177`, `vIchKnopf`).
- `.kz-reihe>*{flex:none}` (`web/kd-app.css:32`) lässt nichts schrumpfen. Die Zielgröße 48 px bei Touch (`web/kd-tokens.css:133`, `web/kd-base.css:9`) kommt hinzu.
- Die Tests sahen es nicht: Die Breitenprobe B0406 (`e2e/tests/ziele.spec.js:557`) wählt in `starten()` immer eine Person (`alsPerson`, Z. 51). Zwei Rollen haben außerdem gegen `innerWidth` gemessen, das mit isMobile mit dem Inhalt wächst.
- Nebenbei: Der Umschalter „Personen“ (`web/ansicht.js:1185`) bricht bei 320 px mitten im Wort um, weil `.seg>span` kein `nowrap` trägt (`web/kd-base.css:35`). Einzeilig braucht er 322 px.

**Erwartet (PO Z. 349–350):**

1. **Leerform in compact.** Ohne gewählte Person zeigt `#t-ich` in der Stufe compact einen hohlen Chip `.pk-0` ohne Buchstaben und dahinter ▾. Das Ziel ist 48 px breit. „nicht gewählt“ steht als visuell versteckter Text im Knopf (`.vh`, `web/kd-app.css:216`), kein `aria-label`. Für die Maus trägt der Knopf `title="nicht gewählt"`.
2. **Ab medium unverändert** „nicht gewählt ▾“ wie in R00003.
3. **Umschalter „Personen“** in compact: „alle · Menschen · Agenten“. Ab medium bleibt „Menschen + Agenten · nur Menschen · nur Agenten“. Jedes Segment bricht bei keiner Breite um (Vorbild `.kl-wahl .seg>span`, `web/kd-app.css:555`). Die Gruppe heißt weiter „Personen“, der sichtbare Text ist der Name.

**Verhältnis zu R00003 und R00140** (beide bleiben abgenommen und unverändert): R00003 US-2 „Dann zeigt die Kopfzeile „nicht gewählt““ gilt ab medium wörtlich. In compact gilt es für den zugänglichen Namen und den Tooltip, sichtbar steht die Leerform nach Regel 1. Die Breitenregel von R00140 gilt jetzt auch ohne gewählte Person.

**Außen vor:** Skalenkontrast der Tagesleiste im Produkt (gemessen 5,52:1 hell, 8,3:1 dunkel), hier ändert sich kein Code, nur das Artboard (AK 8). Personenleiste im Stundenzettel (eigene Karte). Eine Ellipse oder ein Umbruch von „nicht gewählt“ (architekt verworfen). Eine Zeichnung vor dem Bau (PO Z. 351: die Beschreibung ist die Freigabe).

Zahlt ein auf: [Vision](R00000-vision.md) — kanbanD ist auch auf dem Telefon bedienbar. Wer eine neue Sitzung öffnet, sieht die ganze Kopfzeile ohne Querscrollen und erreicht „…“. Optionen: entfallen, der Lösungsraum ist durch die Freigabe des product-owner (Z. 349–350) entschieden.

### Domänenbezug

[Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md), [Hauptnavigation](../Dokumentation/Domaenenwissen/D00009-hauptnavigation.md). „compact“ und „medium“ sind die Stufen der Kopfzeile (`web/kopfzeile.js:6`, compact unter 600 px). Neue Fachbegriffe: keine.

## Akzeptanzkriterien

**Ausgangslage:** Grundbestand der Breitenprobe (`e2e/tests/ziele.spec.js:45`), ein Timer läuft (Stefan an #3). Im Tab ist **keine** Person gewählt (frische Sitzung, kein `alsPerson`). Touch (isMobile, hasTouch), Höhe 844 px, Breiten 320, 375 und 414 px, Themen hell und dunkel.

- [ ] **AK 1 Kein Querscrollen ohne Person (Abnahme-Probe des architekt, wörtlich):** 320/375/414, Touch, ohne alsPerson, ein Timer läuft; Board, Personen, Aufgaben, Einrichten, alle Berichte; `document.documentElement.scrollWidth ≤ clientWidth` (nicht `innerWidth`), rechte Kante von `#t-mehr` ≤ `clientWidth`, der zugängliche Name von `#t-ich` enthält „nicht gewählt“. Heute rot: Board 367/320. Rechenbeispiel (Hypothese aus den Messwerten, nicht gemessen): `#t-ich` schrumpft von 99 auf 48 px, also um 51 px. Board 367 − 51 = 316 ≤ 320, Einrichten 340 − 51 = 289, Personen 337 − 51 = 286. Bleibt eine Seite darüber, ist eine weitere Ursache im Spiel, und die Probe zeigt sie.
- [ ] **AK 2 Leerform in compact:** Bei 320 px ohne Person zeigt `#t-ich` einen hohlen Chip `.pk-0` ohne Buchstaben und ▾, sonst keinen sichtbaren Text. Das Ziel ist ≥ 48 × 48 px. Der Knopf enthält den visuell versteckten Text „nicht gewählt“, trägt `title="nicht gewählt"` und kein `aria-label`. ▾ steht in `<span aria-hidden="true">`, damit Name und Tooltip nicht doppelt angesagt werden. Grenzfall: Ist eine stillgelegte oder eine Agenten-Person als `S.ich` gemerkt, gilt sie als nicht gewählt (heutige Regel in `vIchKnopf`), es erscheint die Leerform.
- [ ] **AK 3 Ab medium unverändert:** Bei 600 und 1280 px ohne Person zeigt `#t-ich` sichtbar „nicht gewählt ▾“ wie bisher (R00003 US-2). Mit gewählter Person zeigt er bei jeder Breite das Kürzel und ab large den Namen wie bisher.
- [ ] **AK 4 Kontrast:** Chiprand und ▾ der Leerform haben gegen den Kopfhintergrund ≥ 3:1 in hell und dunkel (WCAG 1.4.11). Im Kopf trägt der Ring der Leerform `--kd-head-muted` wie `.kz-btn.leer` (`web/kd-app.css:91`; gemessen 6,85:1 hell, 9,57:1 dunkel gegen `--kd-head`; `--kd-line-strong` erreicht dunkel nur 2,34:1, ux-reviewer). Die Probe rechnet oklch über Canvas in RGB um.
- [ ] **AK 5 Tipp öffnet die Wahl:** Ein Tipp auf die Leerform öffnet das Popover „Ich bin …“. Nach der Wahl von Stefan zeigt `#t-ich` sein Kürzel (und ab large seinen Namen) wie bisher. Die Leerform ist danach verschwunden, ohne Neuladen. Fokus in compact (Regression, Bestand nach R00106 US-6 bei breitem Fenster): Bei Tastaturfokus zeigt `#t-ich` den Kopfring (`--kd-head-link`, ≥ 3:1, `web/kd-app.css:78`); nach der Wahl im Popover steht der Fokus auf `#t-ich`.
- [ ] **AK 6 Umschalter „Personen“:** In compact heißen die Segmente „alle“, „Menschen“, „Agenten“, ab medium „Menschen + Agenten“, „nur Menschen“, „nur Agenten“. Bei 320, 375 und 414 px steht jedes Segment einzeilig (je Segment liefert `document.createRange().selectNodeContents(seg).getClientRects().length` genau 1; heute 2 bei 320 px, hell und dunkel). Die Höhe taugt nicht als Probe: unter Touch ist jedes Segment per `min-block-size` 48 px hoch, ein- wie zweizeilig. Die Gruppe hat den zugänglichen Namen „Personen“, die Segmente haben keinen `aria-label`. Die Wahl filtert wie bisher (R00021).
- [ ] **AK 7 Probe bleibt im Gate:** Die Breitenprobe B0406 (`e2e/tests/ziele.spec.js:557 ff.`) hat eine Variante ohne `alsPerson`, die AK 1 prüft. Sie war vor dem Fix rot und läuft in der vollen Suite. Die bestehende Variante mit Person bleibt grün.
- [ ] **AK 8 Artboard nachgezogen (gestalter, keine Bedingung für den Bau):** In `Dokumentation/Wireframes/D0005.dc.html` stehen Z. 361 und Z. 435 auf `--kd-muted` statt `--kd-faint`.

## Tests

Test zuerst: die Variante ohne `alsPerson` der Breitenprobe B0406 mit Timer, je Breite und Seite (AK 1, 7). Sie misst `documentElement` gegen `clientWidth` (`breiteMessen`, `e2e/tests/ziele-hilfen.js:171`), dazu `#t-mehr`.right und den zugänglichen Namen von `#t-ich`. Heute rot. Dann E2E für AK 2–5 bei 320 und 600 px in hell und dunkel, die Kontrastmessung nach dem Vorbild der Kontrastproben im Projekt, und AK 6 am Umschalter „Personen“ bei 320/375/414 und 600 px über die Zahl der Zeilenrechtecke je Segment. Mutanten, die rot werden müssen: Leerform auch ab medium · „nicht gewählt“ als `aria-label` statt Text · Ring der Leerform mit `--kd-line-strong` (dunkel 2,34:1) · ▾ ohne `aria-hidden` · Umschalter ohne `nowrap` (Rechtecke 2 statt 1) · kurze Beschriftung auch ab medium · Probe misst `innerWidth`.

## Implementierungshinweise

- `vIchKnopf` (`web/ansicht.js:176–178`) kennt die Stufe über `S.ui.stufe`. Ob die Leerform per Stufe im Markup oder per CSS an `.kz[data-stufe="compact"]` entsteht, entscheidet der entwickler. Der versteckte Text bleibt im Knopf, damit der zugängliche Name aus dem Inhalt kommt (WCAG 2.5.3).
- Der Umschalter „Personen“ steht außerhalb der Kopfzeile. Die Stufe für die kurzen Beschriftungen liefert `S.ui.stufe`, nicht `data-stufe` der Kopfzeile. Ob `nowrap` an `.seg>span` allgemein (`web/kd-base.css:35`) oder nur am Umschalter steht, entscheidet der entwickler. Die Breitenprobe aller Ansichten muss grün bleiben.
- **Nicht hinein:** neue Tokens · Änderungen an R00003, R00140 oder ihren User Stories · eine Zeichnung (PO Z. 351) · die Personenleiste im Stundenzettel.

## Warum löst diese Anforderung das Problem?

Auslöser: Jemand öffnet kanbanD auf dem Telefon in einer neuen Sitzung, es ist noch keine Person gewählt. Die Leerform braucht 48 statt 99 px (X), damit passt die Kopfzeile bei 320 px in die Breite und „…“ liegt im Bild (Y). Alle Hauptseiten sind ohne Querscrollen bedienbar, und die Wahl „Ich bin …“ ist mit einem Tipp erreichbar (Z). Die Probe ohne `alsPerson` hält den Fall im Gate, sodass der Rückfall nicht unbemerkt wiederkommt.

## Offene Fragen

Keine.

## Notizen

- Priorität: Hoch (Vorrang-Karte). Betroffen: jede neue Sitzung im schmalen Layout. Workaround: erst eine Person wählen.
- AK 8 erledigt der gestalter parallel (PO Z. 348). Es hält den Bau nicht auf, wohl aber die Abnahme.
