---
id: R00205
status: Erledigt
datum: 2026-11-19
---

# R00205: Ansicht „Commits“ im Aufgabenfenster

## Beschreibung

Auftrag des Betreibers (2026-11-19, Karte #207, Nachtrag N1) und Karte #212.

**Umfang (Scheibe B1 des Feinschnitts, baut auf [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md)):** Hat eine Aufgabe Commit-Verweise, gibt es im Ansichtsmenü des [Aufgabenfensters](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) die Ansicht „Commits“. Sie zeigt zu jedem Verweis eine Zeile mit Kurz-Hash, Titel, Autor, Datum, `+`/`−` und Zustand, bei `auf_zweig` mit den Namen der Zweige. Gelesen wird beim Öffnen und über „Neu lesen“ aus `GET /api/aufgaben/{nr}/commits` (R00204). **Kein Diff** (B2, B3), kein Nachfolgervorschlag (A5), keine Sortierung, kein Filter, keine Spalte „Dateien“ (PO 2026-11-19, Punkt 8).

**Das Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, Anker `#commits-ansicht` und `#commits-raender` (Commit 3b8b514d), vom product-owner „frei wie gezeichnet“ freigegeben (`AI-Team/po-entscheidungen.md` Z. 396–405). Die Zeichnung ist die Quelle für Aussehen, Abstände und Reihenfolge der Teile; diese Anforderung legt das **Verhalten** und die **Wortlaute** fest, die der Nutzer prüfen kann.

**Was B1 nicht baut (bestätigt vom product-owner am 2026-11-19, `AI-Team/po-entscheidungen.md` Z. 409):** Das Artboard zeichnet den Knopf „Alle Änderungen ansehen“ und den Hash als Verweis auf die Review-Seite. Diese Seite baut erst B2 (#209), vorher gäbe es kein Ziel. In B1 **fehlen** der Knopf und der Verweis ganz: der Kurz-Hash steht als Text, die Zeile ist kein Ziel. B2 ergänzt beides in seiner Anforderung (Knopf im Kopf der Liste, Hash und Zeile als Verweis auf `…/review?commit=`, auf schmalen Breiten die ganze Zeile als 48-px-Ziel). So gibt es in keinem Stand einen toten Verweis.

**Wortlaut:** „Aufgabe“, nie „Karte“ (PO Punkt 3). Die fünf Zustandswörter sind die des PO (Punkt 6).

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110) und Nicht-Ziel „Kein Git-Client“ (Z. 194: im Arbeits-Repository nur lesen).

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) — die Ansicht ist eine Ansicht darin, gewählt über das Ansichtsmenü ([R00145](R00145-aufgabenfenster-ansichtsmenue-anhaenge-im-inhalt.md))
- [Schmales Layout](../Dokumentation/Domaenenwissen/D00004-schmales-layout.md) — bis einschließlich 640 px steht jeder Verweis in einer Zeile mit vier Reihen
- Die Begriffe Commit-Verweis, verwaist, Anwendung und Register fehlen im Glossar (Auftrag an den fachspezialist, PO Punkt 6); bis dahin gelten die Wörter von [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md).

## Geschäftlicher Nutzen

Ein Mensch, der eine Aufgabe in der Abnahme prüft, sieht im Aufgabenfenster, welche Commits an ihr hängen, wo sie liegen und welche Verweise nach einem Rebase nachzuziehen sind — ohne Git, ohne den Agenten zu fragen. Die Liste steht vor dem Diff (B2), damit sie schon auf echten Daten bewährt ist.

## Funktionale Anforderungen

1. **Ort:** Im Ansichtsmenü steht „Commits“ zwischen „Kosten“ und „Verlauf“; hat die Aufgabe kein „Kosten“, zwischen „Datei“ und „Verlauf“. Der Eintrag steht **nur**, wenn die Aufgabendatei mindestens einen Commit-Verweis trägt (`commits` aus `GET /api/aufgaben/{nr}`, kein Git-Aufruf zum Zeigen des Eintrags). Fällt der letzte Verweis weg (Live-Ereignis, API), entfällt der Eintrag, und war „Commits“ gewählt, gilt „Inhalt“ (die Regel von R00145 für jede entfallende Ansicht); der Fokus steht dann auf dem Auslöser „Ansicht: Inhalt“, nie auf `body`. Ist das Ansichtsmenü offen, wenn „Commits“ per Ereignis erscheint, bleiben Menü und Fokus erhalten, und der Eintrag steht in Pfeilreihenfolge zwischen „Kosten“ (bzw. „Datei“) und „Verlauf“.
2. **Lesen:** Beim Öffnen der Ansicht wird einmal gelesen, danach nur über „Neu lesen“. Es gibt kein selbsttätiges Nachladen (PO Punkt 7), auch nicht bei Live-Ereignissen. Lesen darf jeder: ohne gewählte Person lädt die Ansicht wie sonst, ohne Hinweis und ohne Fehler. Ein zweiter Klick auf „Neu lesen“, solange die Antwort aussteht, löst keinen zweiten Aufruf aus.
3. **Kopf:** „COMMITS“ mit der Zahl der Einträge der Antwort, „an dieser Aufgabe hinterlegt · ältester zuerst“.
4. **Zeile je Eintrag**, in der Reihenfolge der Antwort (die Oberfläche sortiert nicht):
   - **Commit:** bei vorhandenem `hash` Kürzel und die ersten 7 Zeichen des Hashs (`kd:a41e0c5`; ohne Kürzel nur die 7 Zeichen), sonst `verweis` wörtlich; der volle `verweis` steht im `title`. Text, kein Verweis (siehe oben).
   - **Titel:** der volle `titel` der Antwort, umbrechend, nie von der Oberfläche abgeschnitten. Hat er genau 501 Zeichen und endet auf „…“, steht dabei die Marke „gekürzt“ (`title`: „Der Titel ist bei 500 Zeichen gekürzt; vollständig steht er im Repository.“).
   - **Autor:** der Name der Antwort, nie eine E-Mail-Adresse.
   - **Datum:** `TT.MM.JJJJ HH:MM` in Ortszeit wie in der Ansicht „Verlauf“ (`zeitpunktLang`); `title` ist `datum` wörtlich.
   - **`+` / `−`:** `+592 −0` mit Tausenderpunkt (`+1.204 −87`), Lesetext „Zeilen“.
   - **Zustand:** bei `auf_zweig` die Zweige, sonst Marke und Hinweis (Fünf Zustände unten).
   - Ohne Metadaten (`fehlt`, `unlesbar`, `repository_fehlt`, `anwendung_unbekannt`) steht „—“ in Titel, Autor, Datum und `+`/`−`; das „—“ ist `aria-hidden`, daneben steht ein verstecktes „keine Angabe“ (nur für Bedienhilfen).
5. **Fünf Zustände** (je Symbol, Wort und Hinweiszeile; der Zustand hängt nie allein an der Farbe):

   | `zustand` | Wort | Hinweiszeile |
   |---|---|---|
   | `verwaist` | auf keinem Zweig | Der Commit ist noch da, aber kein Zweig führt zu ihm — meist nach einem Rebase. |
   | `fehlt` | nicht mehr im Repository | Das Repository kennt diesen Commit nicht mehr. |
   | `repository_fehlt` | Repository nicht erreichbar | `grund` der Antwort |
   | `anwendung_unbekannt` | Anwendung unbekannt | Ist `anwendung` gesetzt (nicht leer): Anwendung „xy“ ist unter Einrichten nicht eingetragen. Fehlt `anwendung` oder ist es leer (Verweis ohne Kürzel, keine Standardanwendung eingerichtet, R00204 FA 3 und AK 4): Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet. |
   | `unlesbar` | Eintrag nicht lesbar | `grund` der Antwort |

   Bei `verwaist` stehen Titel, Autor, Datum und Zahlen; bei den vier anderen „—“. `auf_zweig` hat kein Wort, sondern die Zweige. Die fünf Wörter und die Marke „gekürzt“ (FA 4) sind **sichtbar**: nicht versteckt (nicht in der Klasse für nur-vorlesbaren Text), mit Rechteck größer 0, ohne Beschnitt, ohne `opacity:0` und ohne `font-size:0`, innerhalb ihrer Zeile.
6. **Zweige:** Bis zu drei Namen stehen in der Zeile (lokale zuerst, dann entfernte; entfernte gestrichelt und mit Lesetext „(entfernt)“). Sind es mehr (Summe von `zweige`, `entfernte_zweige` und `zweige_weitere`), folgt ein Knopf „+n weitere“ mit n = Summe − 3. Er klappt unter der Zeile die vollen Listen auf: „LOKALE ZWEIGE n“, „ENTFERNTE ZWEIGE n“ (eine Überschrift entfällt, wenn ihre Liste leer ist) und, bei `zweige_weitere`, den Satz „und n weitere Zweige, hier nicht aufgeführt“.
7. **Fuß:** „liest nur · gelesen aus dem Repository der Anwendung · Stand HH:MM:SS“ und „Neu lesen“. Stand ist die Uhrzeit der letzten erfolgreichen Antwort; vor der ersten steht kein Stand.
8. **Laden, Fehler, leer:**
   - Laden: Kopf ohne Zahl, Hinweis „Liest die Commits aus dem Repository …“, keine Zeilen. Der Statusbereich (`role="status"`, AK 10) und „Neu lesen“ (mit `aria-disabled="true"`) stehen schon jetzt im Dokument; der Fokus verlässt „Neu lesen“ dabei nicht.
   - Fehler: „Die Commits ließen sich nicht lesen: Das Repository antwortete nicht innerhalb von 10 Sekunden (503).“ und der Knopf „Erneut versuchen“. Bei einem anderen Status oder ohne Verbindung steht „Die Commits ließen sich nicht lesen: <`fehler` der Antwort oder „keine Verbindung zum Programm“> (<Status>).“
   - leer (200 mit `commits: []`): „An dieser Aufgabe sind keine Commits hinterlegt.“ und „Ein Agent hinterlegt sie über die API (POST /api/aufgaben/{nr}/commits); siehe Endpunktliste unter /api.“
9. **Fremder Text bleibt Text** (Titel, Autor, Zweignamen, `grund`, `verweis` stammen aus fremden Repositories und Dateien): nichts davon wird als HTML, Markdown oder Adresse gedeutet (ADR-0030, Grundsatz 1).

## Nicht-funktionale Anforderungen

- **Breite:** Bei 320, 414 und 1280 px (Fensterbreite des Browsers) gilt `document.documentElement.scrollWidth ≤ document.documentElement.clientWidth` (nicht `innerWidth`), das Aufgabenfenster und der Rahmen der Liste scrollen nicht quer, und nichts ragt über die rechte Kante. Zwischen 641 und 980 px darf der Rahmen der Liste in sich quer scrollen (wie `bericht-rahmen`), die Seite nicht. Bis 640 px stehen die Daten je Verweis in vier Reihen (Commit und `+`/`−`, Titel, Autor und Datum, Zustand).
- **Ziele:** Bei grobem Zeiger (`pointer:coarse`) ist jedes Bedienziel der Ansicht (Menüeintrag „Commits“, „+n weitere“, „Neu lesen“, „Erneut versuchen“) mindestens 48 × 48 px.
- **Themen:** Hell und Dunkel; Kontrast nach der Kontrastprobe des Projekts (`kontrastVerstoesse`, 4,5:1 für Text, 3:1 für Symbole und Ränder der Zustandsmarken).
- **Last:** Die Ansicht startet kein Git selbst; Lesen ist der eine Aufruf von R00204 (bis 10 s, danach 503).

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API; erweitert die von R00204). Jede Probe stellt ihre Aufgabe selbst her; die Aufgaben sind getrennt, damit jede Zahl und jede Reihenfolge nur zu einer Probe gehört:

- **Arbeits-Repository R, Register und Board wie in R00204** (K1–K4, W1 auf `karte/1`, V1 verwaist, V2 gelöscht, R1 nur auf `o/x`; Anwendung `kd`, keine Standardanwendung). Der Browser läuft headless in der Zeitzone `Europe/Berlin`, die Ansicht „Commits“ ist, wo nicht anders genannt, geöffnet.
- **Aufgabe #1 (A, für AK 1, AK 2, AK 6, US-1):** genau fünf Verweise in dieser Reihenfolge: `kd:<K3>`, `kd:<W1>`, `kd:<V1>`, `kd:<V2>`, `kd:<R1>` (so hinterlegt wie in R00204 AK 1; die Antwort liefert `K3, W1, V1, R1, V2`).
- **Aufgabe #2:** ohne Verweise.
- **Aufgabe #3 (B, für AK 3 und AK 6/AK 7 beim Wechsel):** acht Verweise, hinterlegt in der Reihenfolge `kd:<K3>`, `kd:<W1>`, `kd:<V1>`, `kd:<R1>`, `kd:<V2>`, `xx:<K1>` (Anwendung `xx` zeigt auf einen Ordner ohne Git), `xy:<K1>` (Anwendung nicht im Register) und `kd:3f2a9c1;rm -rf x`. Die Antwort liefert sie nach R00204 FA 5 in der Reihenfolge `K3, W1, V1, R1` (Datum aufsteigend), dann `V2, xx, xy, Semikolon` (ohne Metadaten, in der Reihenfolge der Datei). Sie hat **sechs Zustände** (`auf_zweig`, `verwaist`, `fehlt`, `repository_fehlt`, `anwendung_unbekannt`, `unlesbar`).
- **Aufgabe #4 (Ränder und Breite, für AK 4, AK 5, AK 8, AK 9):** die Breitendaten, nie nur kurze Namen (Lehre #204–#206):
  - Commit Z mit **Titel aus 600 Zeichen** (darin ein Wort ohne Leerzeichen von 120 Zeichen), **Autor mit 45 Zeichen** („Maximiliane Alexandrowna von Beispielhausen“), **11 lokalen Zweigen** `z01`–`z11` und **12 entfernten** `o/e01`–`o/e12`, jeder Name auf 60 Zeichen aufgefüllt (`z01-xxxx…`, `o/e01-xxxx…`; die Namen **beginnen** mit `z01` usw., die Proben in AK 5 zählen und prüfen die Anfänge), **`+1.204.567 −987.654`**;
  - Commits mit Titeln von 500, 501 und 499 `a` plus Emoji (U+1F600) an Stelle 500 (R00204 AK 17);
  - ein `unlesbar`-Eintrag mit 64 Zeichen ohne Leerzeichen, ein `repository_fehlt`-Eintrag mit `grund` von 200 Zeichen;
  - ein Commit mit Titel `<img src=x onerror=window.pwn=1> "x" \ y`, Autor `Mallory <b>fett</b>` und Zweig `a"><i>z`.
- **Aufgabe #5 (ohne Kürzel, für AK 3):** ein Verweis `<K1>` ohne Kürzel, **ohne** Standardanwendung im Register (R00204 AK 4: `anwendung_unbekannt`).
- Alle Einträge einer Aufgabe stehen vollständig an ihr; „COMMITS n“ ist je Aufgabe gleich der Länge der Antwort.

### Menü und Lesen

- [x] **AK 1 Ort und Sichtbarkeit:**
  - Gegeben #1 mit fünf Verweisen und ohne Kosten, dann nennt das Ansichtsmenü `Inhalt, Zeiten, Details, Datei, Commits, Verlauf` in dieser Reihenfolge; mit Preisetikett `…, Datei, Kosten, Commits, Verlauf`.
  - Gegeben #2 ohne Verweise, dann steht „Commits“ nicht im Menü, und es wird dabei kein `GET …/commits` gesendet (geprüft, nachdem das Menü sichtbar steht, nicht davor).
  - Gegeben „Commits“ ist an #1 geöffnet und die Verweise von #1 werden alle über die API entfernt (`DELETE`), dann entfällt der Eintrag, das Fenster zeigt „Inhalt“, die Ansicht „Commits“ ist nicht mehr zu sehen, und der Fokus steht auf dem Auslöser „Ansicht: Inhalt“ (nie auf `body`).
  - Gegeben #2 bekommt den ersten Verweis (Live-Ereignis) und das Fenster ist offen, dann steht „Commits“ im Menü, und das Fenster bleibt dabei auf seiner Ansicht.
  - Gegeben das Ansichtsmenü ist offen (Fokus auf einem Eintrag) und das Ereignis fügt „Commits“ ein, dann bleiben Menü und Fokus erhalten, und der Eintrag steht in Pfeilreihenfolge zwischen „Kosten“ (bzw. „Datei“) und „Verlauf“.
- [x] **AK 2 Liste und Zeilen:** Gegeben #1 mit den fünf Verweisen, dann steht im Kopf „COMMITS 5“ und „ältester zuerst“, und die Zeilen kommen in der Reihenfolge der Antwort (`kd:<K3>`, `kd:<W1>`, `kd:<V1>`, `kd:<R1>`, `kd:<V2>`):
  - Zeile K3: Commit `kd:` und die ersten 7 Zeichen von K3, Titel „c.txt anlegen“, Autor „Ada Autorin“, Datum „01.03.2026 10:00“, `+3 −0`, Zweige `main` (lokal) und `o/main` (entfernt); `o/HEAD` steht nicht da.
  - Zeile W1: Autor „Bernd Beispiel“, Zweig `karte/1`; Zeile R1: nur `o/x`, gestrichelt, Lesetext „(entfernt)“.
  - Es gibt **keine E-Mail-Adresse** in der Ansicht: der Text der Ansicht enthält weder „@“ noch die Adresse des Autors (die Test-Commits tragen `ada@example.org`).
  - Es gibt **keinen** Knopf „Alle Änderungen ansehen“ und keinen Verweis (`a[href]`) in der Liste; ein Klick auf den Kurz-Hash oder die Zeile ändert Adresse und Ansicht nicht.
  - Die Ansicht lässt sich weder sortieren noch filtern, und es gibt keine Spalte „Dateien“.
  - Der Aufruf ändert weder die Aufgabendatei noch die Commit-Zahl des Board-Ordners.
- [x] **AK 3 Sechs Zustände:** Gegeben #3 (acht Einträge), dann steht im Kopf „COMMITS 8“, die Zeilen kommen als `K3, W1, V1, R1, V2, xx, xy, Semikolon`, und jede Marke trägt Symbol, Wort und Hinweis aus der Tabelle in FA 5: V1 „auf keinem Zweig“ mit Titel und Zahlen, V2 „nicht mehr im Repository“, `xx:` „Repository nicht erreichbar“ mit dem `grund` der Antwort, `xy:` „Anwendung unbekannt“ mit dem Satz „Anwendung „xy“ ist unter Einrichten nicht eingetragen.“, der Eintrag mit Semikolon „Eintrag nicht lesbar“ mit seinem `grund`.
  - Gegeben #5 (Verweis ohne Kürzel, keine Standardanwendung), dann steht „Anwendung unbekannt“ mit dem Satz „Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.“ (und nicht der Satz mit „xy“).
  - In den vier Zeilen ohne Metadaten steht in Titel, Autor, Datum und `+`/`−` „—“ (`aria-hidden`, daneben ein verstecktes „keine Angabe“), in V1 nicht. Der Kurz-Hash der Zeile `kd:3f2a9c1;rm -rf x` steht wörtlich da.
  - **Wörter sichtbar:** Bei 320, 414 und 1280 px sind die Wörter „auf keinem Zweig“, „nicht mehr im Repository“, „Repository nicht erreichbar“, „Anwendung unbekannt“ und „Eintrag nicht lesbar“ nicht versteckt (nicht in der Klasse für nur-vorlesbaren Text), haben ein Rechteck größer 0, keinen Beschnitt, kein `opacity:0`, kein `font-size:0` und liegen innerhalb ihrer Zeile. **Mutationsprobe:** wird ein Wort in die Klasse für nur-vorlesbaren Text verschoben, ist die Probe rot.
  - **Fremder Text** (Commit mit Titel `<img src=x onerror=window.pwn=1> "x" \ y`, Autor `Mallory <b>fett</b>` und Zweig `a"><i>z` aus #4): alle drei stehen zeichengleich als Text da, es entsteht weder ein `img`, `b`, noch `i` im Dokument, `window.pwn` ist nicht gesetzt, und die `title`- und `aria-label`-Attribute der Zeile enthalten den Text unverändert (Anführungszeichen brechen kein Attribut).

### Ränder

- [x] **AK 4 Gekürzter Titel** (an #4): die Titel mit 500, 501 und 600 Zeichen (R00204 AK 17): der Titel mit 600 Zeichen kommt als 501 Zeichen mit „…“ am Ende und trägt die Marke „gekürzt“ samt `title`; der mit 500 Zeichen steht unverändert **ohne** Marke (auch wenn er selbst mit „…“ endet); der mit 499 `a` und einem Emoji (U+1F600) an Stelle 500 steht ganz und ohne Marke. Der Text im Dokument hat die Länge der Antwort (die Oberfläche kürzt nichts, auch nicht mit CSS-Auslassungspunkten: `textContent` hat 501 Zeichen, und kein Element hat `text-overflow: ellipsis`). Die Marke „gekürzt“ ist bei 320, 414 und 1280 px sichtbar (Regel wie bei den Zustandswörtern in AK 3; Mutationsprobe: Marke in die Klasse für nur-vorlesbaren Text, rot).
- [x] **AK 5 Zweige und „+n weitere“** (an Commit Z in #4): Gegeben Commit Z, den 11 lokale (`z01…`–`z11…`) und 12 entfernte Zweige (`o/e01…`–`o/e12…`) erreichen (Antwort: je 10 Namen, `zweige_weitere 3`), dann stehen in der Zeile die drei Namen `z01…`, `z02…`, `z03…` (Anfang des Namens) und der Knopf „+20 weitere“ (10 + 10 + 3 − 3). Der Knopf trägt `aria-expanded="false"` und den Namen „20 weitere Zweige zeigen“; nach der Betätigung steht `aria-expanded="true"` und der Name „20 weitere Zweige verbergen“; es erscheinen „LOKALE ZWEIGE 10“ mit `z01…`–`z10…`, „ENTFERNTE ZWEIGE 10“ mit `o/e01…`–`o/e10…` und „und 3 weitere Zweige, hier nicht aufgeführt“; eine zweite Betätigung klappt zu. Grenzen: Ein Commit mit genau 3 Zweigen hat keinen Knopf; mit 4 steht „+1 weitere“; R1 (nur `o/x`) zeigt beim Aufklappen keine Überschrift „LOKALE ZWEIGE“. Nach „Neu lesen“ sind alle Zeilen zugeklappt.
- [x] **AK 6 Laden und „Neu lesen“** (Antworten werden mit `page.route` **gehalten** und über ein Promise freigegeben; keine Schlafzeiten):
  - Gegeben die Antwort auf `GET …/commits` von #1 ist gehalten, dann zeigt die Ansicht „Liest die Commits aus dem Repository …“ ohne Zeilen und ohne Zahl im Kopf, und im Fuß steht **kein** „Stand“. Nach dem Freigeben steht die Liste, und „Stand“ hat das Format `^\d\d:\d\d:\d\d$` mit einer Uhrzeit zwischen Klick und Erscheinen der Statusmeldung.
  - Während des Ladens steht „Neu lesen“ im Dokument mit `aria-disabled="true"`, der Fokus bleibt darauf (nie auf `body`); ein zweiter Klick darauf, während die Antwort gehalten wird, löst **keinen** zweiten Aufruf aus (geprüft nach dem Freigeben, wenn die Liste sichtbar ist).
  - Der Statusbereich steht schon im Laden-Zustand im Dokument und bleibt derselbe Knoten (`isConnected`, gleiche Referenz); nur sein Text wechselt.
  - Beim Öffnen wird genau einmal gelesen (geprüft, sobald die Liste sichtbar ist); „Neu lesen“ löst genau einen weiteren Aufruf aus, und nach `git branch -f karte/1 <K4>` zeigt die neue Liste `kd:<W1>` als „auf keinem Zweig“ (kein Cache der Oberfläche); der Fokus steht danach auf „Neu lesen“.
  - Ein Live-Ereignis (andere Änderung an #1, etwa ein Kommentar) lässt die gelesene Liste samt aufgeklappten Zweigen unverändert stehen und löst keinen weiteren Aufruf aus (geprüft, nachdem das Ereignis sichtbar angekommen ist, etwa der Kommentar im Inhalt).
  - **Verspätete Antwort wird verworfen:** Gegeben die Antwort für #1 ist gehalten. Wechsel auf #3 (eigene Verweise) mit gewählter Ansicht „Commits“, dann Freigabe der Antwort für #1: #3 zeigt „COMMITS 8“ und nur seine eigenen acht Zeilen (keine Zeile von #1), und „Stand“ und Statusmeldung stammen aus der Antwort für #3, nicht aus der verspäteten. Dasselbe beim Wechsel von #1 auf die Ansicht „Inhalt“ (nach der Freigabe zeigt das Fenster weiter „Inhalt“, die Ansicht „Commits“ erscheint nicht). **Mutationsprobe:** ohne die Prüfung „Aufgabe noch dieselbe“ ist die Probe rot.
  - Ohne gewählte Person lädt die Ansicht ohne Hinweis und ohne Fehler (das `GET` trägt kein `X-KanbanD-Wer`).
- [x] **AK 7 Fehler und leer:**
  - Gegeben die Antwort auf `GET …/commits` ist per `page.route` ein 503 mit dem Fehlertext von R00204 (die echte 10-s-Grenze belegt R00204 AK 9), dann steht „Die Commits ließen sich nicht lesen: Das Repository antwortete nicht innerhalb von 10 Sekunden (503).“ mit dem Knopf „Erneut versuchen“, ohne Zeilen und ohne Zahl; ein Klick darauf liest erneut (genau ein weiterer Aufruf) und zeigt, bei nun erfolgreicher Antwort, die Liste; der Fokus steht danach auf dem Rahmen der Liste oder auf „Neu lesen“, nie auf `body`.
  - Gegeben die Aufgabendatei ist defekt (423) oder der Server nicht erreichbar, dann steht „Die Commits ließen sich nicht lesen: …“ mit dem `fehler` der Antwort bzw. „keine Verbindung zum Programm“ und dem Status (Form „… (<Status>).“), und „Erneut versuchen“.
  - Gegeben die Antwort ist 200 mit `commits: []` (die Verweise fielen zwischen Menü und Lesen weg), dann steht „An dieser Aufgabe sind keine Commits hinterlegt.“ mit dem Satz zur API, ohne Zahl.

### Darstellung und Bedienung

- [x] **AK 8 Breite und Ziele** (an #4 und #3): Gegeben die Breitendaten, dann gilt bei 320, 414 und 1280 px, hell und dunkel, mit allen Zeilen der Liste und einer aufgeklappten Zweigliste: `documentElement.scrollWidth ≤ documentElement.clientWidth`, `scrollWidth ≤ clientWidth` des Aufgabenfensters und des Rahmens der Liste, und kein Element der Ansicht hat eine rechte Kante über `clientWidth`. Bei 320 und 414 px (grober Zeiger) stehen die Daten je Verweis in vier Reihen; bei 1280 px in einer Tabelle mit den Spalten Commit, Titel, Autor, Datum, `+ / −`, Zustand. Bei 641 und 980 px scrollt die Seite nicht (der Rahmen darf). Jedes Bedienziel („Commits“ im Menü, „+n weitere“, „Neu lesen“, „Erneut versuchen“) ist bei grobem Zeiger mindestens 48 × 48 px.
  - **Titel nie abgeschnitten:** Für Titel, Autor, Zweignamen, `grund` und das 64-Zeichen-Wort liegt das letzte Zeichen (per `Range` und `getClientRects()`) innerhalb des Rahmens der Liste; kein Vorfahr hat `overflow: hidden` oder `line-clamp`; das Wort von 120 Zeichen bricht um. **Mutationsproben:** `white-space: nowrap` am Titel, an den Zweig-Chips und am `grund`-Feld macht je die Probe rot.
- [x] **AK 9 Themen:** Gegeben Hell und Dunkel, dann hat kein Text der Ansicht (Kurz-Hash, Titel, Autor, Datum, Zahlen, Zustandswörter, Hinweise, Zweignamen, Kopf, Fuß) weniger als 4,5:1 und kein Symbol und kein Rand der Zustandsmarken weniger als 3:1 gegen seinen Grund. Das gilt zusätzlich in den Zuständen **Laden**, **Fehler** und **Zweigliste offen**. Die fünf Wörter sind paarweise verschieden, und jede Marke trägt Symbol und sichtbares Wort (der Zustand hängt nie allein an der Farbe).
- [x] **AK 10 Tastatur und Bedienhilfe:** Gegeben nur die Tastatur: „Commits“ ist im Ansichtsmenü wie die anderen Einträge erreichbar (Pfeile, Enter) und wählbar, danach trägt der Auslöser den Namen „Ansicht: Commits“ und der Bereich die Rolle `group` mit dem Namen „Ansicht: Commits“; Tab erreicht in Dokumentreihenfolge die Knöpfe „+n weitere“ (Enter und Leertaste betätigen sie, der Fokus bleibt darauf), „Neu lesen“ und, bei Fehler, „Erneut versuchen“; der Rahmen der Liste ist als `group` mit dem Namen „Commits dieser Aufgabe, ältester zuerst“ per Tab fokussierbar; jeder Fokus ist sichtbar; die Tabelle trägt Spaltenüberschriften (`scope="col"`), die Zeile ihren Kurz-Hash als Zeilenüberschrift; `+`/`−` und die entfernten Zweige tragen Lesetext („Zeilen“, „(entfernt)“). „Esc“ schließt das Fenster wie in jeder Ansicht. Nach dem Lesen meldet ein Statusbereich (`role="status"`) „5 Commits gelesen“ bzw. den Fehler, ohne den Fokus zu bewegen; der Statusbereich steht schon im Laden-Zustand im Dokument.

## Betroffene Verzeichnisstruktur

- `web/ansicht.js` — Ansichtsmenü (`ansichtDerAufgabe`, `vAnsichtWahl`) und das Panel der Ansicht neben `vVerlaufPanel`, `vKostenPanel`
- neu `web/commits.js` (reine Funktionen: Kurzform, Zeilenwerte, Zweigzählung, Kennzeichen „gekürzt“; im Browser und in Node nutzbar wie `kultur.js`), Zustand und Lesen bei den anderen Zuständen der Oberfläche (`S.ui`)
- `web/kd-*.css` — Stil der Ansicht, nur mit den Tokens aus `kd-tokens.css` (Einzige Quelle der Farben)
- Tests: neu `e2e/einheit/commits.test.js` (Rechnung), `e2e/tests/r00205-ansicht-commits.spec.js`; erweitert `e2e/tests/r00145-ansichtsmenue.spec.js` (Reihenfolge mit „Commits“), `e2e/tests/ziele-hilfen.js` (`QUER_ERLAUBT` um den Rahmen der Liste), die Ziel- und Kontrastproben (`ziele.spec.js`, `kontrast.spec.js`) um die Ansicht

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **Menü:** `commits` der Aufgabe (nicht leer) → Eintrag zwischen „Kosten“ und „Verlauf“; Rückfall wie bei jeder entfallenden Ansicht.
2. **Rechnen (rein):** Eintrag der Antwort → Anzeigewerte (Kurzform, Datum, `+`/`−`-Text, Zustandswort und -hinweis, Zweigmarken 3 + n, Kennzeichen „gekürzt“ nach Codepunkten).
3. **Zeichnen:** Tabelle (breit) und Zeilen in vier Reihen (schmal), Zweigklappe, Fuß; aller Text maskiert (`esc`).
4. **Lesen:** `GET /api/aufgaben/{nr}/commits` beim Öffnen und bei „Neu lesen“; Zustände Laden, Liste, Fehler, leer; eine Antwort nur anwenden, wenn Aufgabe und Ansicht noch dieselben sind.
5. **Messen:** Breitenprobe mit den Breitendaten, Ziele, Kontrast; dann echtes Programm.

### Hinweise

- **Vorbild** für Panel, Rahmen und Fuß: die Ansicht „Verlauf“ (R00123, `vVerlaufPanel`) und „Kosten“ (`vKostenPanel`, „liest nur“).
- **Artboard:** `Dokumentation/Wireframes/D0009.dc.html`, Anker `#commits-ansicht` (Menü, 1280/414/320 px) und `#commits-raender` (sechs Zustände, Zweigliste, Laden, 503, leer); für diesen Slice gilt der Teil B1. Das Bild ist die Quelle für das Aussehen.
- **Abweichungen vom Artboard, bewusst:** kein Knopf „Alle Änderungen ansehen“, kein Verweis am Hash (B2); „Stand“ zeigt die Zeit der letzten erfolgreichen Antwort (die Zeichnung zeigt in Laden und 503 die Zeit eines früheren Lesens).
- **Breitenprobe** nach `breiteMessen` (`e2e/tests/ziele-hilfen.js`): sie misst gegen `clientWidth`; der Rahmen der Liste wird in `QUER_ERLAUBT` aufgenommen, aber bei 320, 414 und 1280 px zusätzlich einzeln auf `scrollWidth ≤ clientWidth` geprüft.
- **Daten für die Probe** (Lehre aus #204–#206): immer die Breitendaten (Aufgabe #4), nie nur kurze Namen; die Mutationsversuche `white-space: nowrap` am Titel, an den Zweig-Chips und am `grund`-Feld müssen die Probe je rot machen.
- **Echtes Git:** Die Probe gegen das echte Programm braucht ein Wegwerf-Repository mit Worktree; es entsteht wie bei R00204 über Git im Test, nicht über Zwischenspeicher.

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`: Test zuerst je Bubble.

- **Unit (reine Rechnung):** Kurzform, Zweigzählung (3, 4, 23 Zweige), „gekürzt“ bei 500/501/601, Datum und Tausenderpunkt, Zustandstabelle.
- **Integration:** keine eigene Ebene; die Rechnung läuft in Node ohne Browser (`e2e/einheit`).
- **E2E:** AK 1–10 gegen das gestartete Programm (Playwright, headless), Breiten 320/414/1280 hell und dunkel, grober Zeiger, Tastatur, Mutationsproben (Breite: `nowrap` an Titel, Zweig-Chips und `grund`; Sichtbarkeit: Wort in der Klasse für nur-vorlesbaren Text; Verwerfen: ohne „Aufgabe noch dieselbe“). Zeitproben sind deterministisch: Antworten werden per `page.route` gehalten und über ein Promise freigegeben, 503 kommt aus `page.route`, keine Schlafzeiten; Verneinungen („kein weiterer Aufruf“) werden erst nach einem sichtbaren Signal geprüft. Die echte 10-s-Grenze bleibt bei R00204 AK 9.

## Abhängigkeiten

- Abhängig von: [R00204](R00204-commit-liste-einer-karte-per-api-lesen.md) (I0194, Karte #211, `braucht:211`, API und Zustände); [R00145](R00145-aufgabenfenster-ansichtsmenue-anhaenge-im-inhalt.md) (Ansichtsmenü); das Artboard D0009 (freigegeben).
- Blockiert: B2 Review-Seite (#209; nimmt Knopf und Hash-Verweis dieser Ansicht auf).

## Offene Fragen

- Keine. Die vier Produktfragen sind vom product-owner am 2026-11-19 entschieden (`AI-Team/po-entscheidungen.md` Z. 406–409): Hinweis bei „Anwendung unbekannt“ ohne Kürzel (FA 5), Fehlerwortlaut wie in FA 8 und AK 7, kein Hinweis „Verweise geändert“ in B1, kein Knopf und kein Hash-Verweis in B1.

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine.

## Warum löst diese Anforderung das Problem? (Pflicht)

Wer eine Aufgabe in der Abnahme prüft, sieht heute im Aufgabenfenster nur Text; was die Karte im Arbeits-Repository bewirkt hat, steht nur dort. Seit R00202 hängen Commit-Verweise an der Aufgabe, und seit R00204 liefert die API zu jedem Verweis Titel, Zahlen und einen Zustand. Zeigt das Aufgabenfenster diese Liste als eigene Ansicht, sieht der Mensch auf einen Blick, welche Commits an der Aufgabe hängen, welche nach einem Rebase auf keinem Zweig mehr liegen (und nachzuziehen sind) und welche verschwunden sind — jeder Zustand sichtbar und mit Grund, nie still. Weil die Ansicht ohne Diff schon auf echten Daten steht, zeigt sich vor dem Bau der Review-Seite (B2), ob Zustände, Wortlaute und Breiten bei langen Titeln, vielen Zweigen und auf dem Handy tragen.

## Notizen

- **Entschieden, nicht gebaut:** ein Hinweis „Verweise geändert · Neu lesen“ nach einem Live-Ereignis (PO 2026-11-19; „Stand“ und „Neu lesen“ genügen; bei Bedarf Folgekarte, vorher zeichnen).
- **Verworfen:** „Reiter“ (R00145: es gibt keine Reiterleiste mehr, PO Punkt 1); „Commits der Anwendung“ als Name (PO Punkt 2); Sortierung, Filter, Spalte „Dateien“ (PO Punkt 8); selbsttätiges Nachladen (PO Punkt 7).
- **Wegen Schlank arbeiten A** höchstens zehn Kriterien: Grenzfälle der Rechnung (Kurz-Hash 64 Zeichen, Mehrfachzweige), Mutanten und die Reihenfolge im Code gehören dem entwickler; die Breitenprobe mit der Mutation `nowrap` ist Teil von AK 8.
- **Folgekarte B2:** Knopf „Alle Änderungen ansehen“ im Kopf der Liste, Hash und Zeile als Verweis auf `…/review?commit=`, auf schmalen Breiten die ganze Zeile als Ziel (Artboard `#commits-ansicht`, Bild 2).
- **Nachtrag 2026-11-21 (Karte #247, PO Z. 491, ADR-0025 N5, über `/anforderung review` im Auftrag des Directors):** „Neu lesen“ trägt gesperrt (FA 7, AK 6) die Sperrform von Z. 216: Schrift `--kd-faint`, Hover neutral, Fokusring unverändert; gebaut war `--kd-muted` (B1006). Die Form hängt an der Komponente `.cl-textknopf`, nicht an der Ansicht. Den Zeiger legt R00229 fest. Gebaut und abgenommen wird das in [R00229](R00229-behebung-sperrform-der-leseknoepfe.md) (I0219); Status und Kästchen dieser Anforderung bleiben unverändert.
