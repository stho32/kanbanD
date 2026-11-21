---
id: R00224
status: Erledigt
datum: 2026-11-21
---

# R00224: Review-Seite — Grund bei 404 in Worten

## Beschreibung

Zeigt eine Anwendung der Aufgabe auf ein Repository, das nicht erreichbar ist, sagt die Review-Seite heute nicht, warum. Auf „Alle Änderungen“ steht „Die Änderungen der Anwendung wb ließen sich nicht lesen: kein Diff zu diesem Verweis — der Zustand sagt warum (404).“ ([R00210](R00210-alle-aenderungen-der-aufgabe-in-der-review-seite.md) FA 7). Auf „Ein Commit“ steht „Zu diesem Verweis gibt es keinen Diff: wb:abc1234 ist Repository nicht erreichbar.“ ([R00207](R00207-review-seite-eines-commits.md) FA 8). Beide Male fehlt der `grund` der Antwort, und der zweite Satz ist grammatisch schief. Trifft es die **erste** Anwendung der Aufgabe, ist es schlimmer: „Alle Änderungen“ deutet jede 404 als „An dieser Aufgabe sind keine Commit-Verweise hinterlegt.“ (`web/app.js:1380`, `:1778`). Das ist unwahr, und die übrigen Anwendungen der Aufgabe verschwinden still.

Danach nennt die Seite den Zustand einer 404 in einem ganzen Satz, nach dem Wortlaut des product-owner (`AI-Team/po-entscheidungen.md` Z. 506–508, Commit 4d1b9659). Darunter steht, wo die Antwort ihn trägt, der `grund`. Fehlt das Repository der ersten Anwendung, zeigt „Alle Änderungen“ den Abschnitt dieser Anwendung mit dem Satz. Die übrigen Anwendungen bleiben erreichbar.

Herkunft: Anmerkung aus dem Entwicklertest von #215 (2026-11-20, Beleg `gemeinsam/scratchpad/etest-215/s-echt-fehlt.png` der Factory), Karte #232. Architektur: keine Technikfrage und kein ADR (Kommentar des architekten an #232 vom 2026-11-21). Die API liefert schon `404 {fehler, zustand, grund?}` (ADR-0032, Schema `Zustandsfehler` in `src/web/openapi.rs:92`). Die eine Stelle, die Zustände in Worte fasst, ist `web/commits.js` (`ZUSTANDSWOERTER`, `hinweisVon`, `zustandsmarke`). Neuer Umfang ist nur Oberfläche, kein Endpunkt und keine Änderung der API.

Zahlt ein auf: [Vision](R00000-vision.md) — Zielbild „Die Arbeit hinter der Karte nachvollziehen“ (Vision Z. 110). Dazu kommt die Linie des PO „nie still“ (Z. 360) und „jede Änderung erreichbar“ (Z. 411).

## Geschäftlicher Nutzen

Wer eine Aufgabe in der Abnahme prüft, sieht sofort, *warum* ein Teil der Änderungen fehlt. Ein Beispiel ist „Ordner fehlt: /home/…/wb“. Er kann den Eintrag im Register beheben, statt zu raten. Eine Aufgabe, deren erste Anwendung nicht erreichbar ist, wirkt nicht mehr leer. Ihre übrigen Anwendungen bleiben prüfbar.

## Funktionale Anforderungen

Wortlaut nach PO Z. 506–508. `<k>` steht für das Kürzel. Bei leerem Kürzel heißt es „der Standardanwendung“ statt „der Anwendung <k>“ (PO Z. 448). `<grund>` steht für den `grund` der Antwort ohne Bidi-Steuerzeichen.

1. **„Alle Änderungen“, Abschnitt mit 404 `repository_fehlt`** (PO Z. 506): Der Satz lautet „Das Repository der Anwendung <k> ist nicht erreichbar.“ Darunter steht `<grund>` wörtlich als Hinweiszeile. Fehlt `grund`, entfällt diese Zeile. Satz und Hinweiszeile sind eigene Block-Elemente und stehen untereinander (`.df-hin` ist heute eine Flexzeile, zwei `p` stünden nebeneinander). Symbol `ordner-offen` und Ton `fehl` sind dieselben wie bei der Marke in der Liste (`ZEICHEN` in `web/commits.js`). Die Meldung trägt dieselbe Live-Rolle wie die übrigen Abschnittsfehler (R00210 FA 7, heute `role="alert"`); ändert die Karte „Genau eine Ansage“ (PO Z. 481 c) diese Rolle, ändert sie sich hier mit. „Erneut versuchen“ bleibt. Es gibt keinen Status „(404)“ und keinen Server-`fehler`. Das ersetzt für diesen Zustand den Satz aus R00210 FA 7, Z. 58. Für jeden anderen Fehler eines Abschnitts gilt R00210 FA 7 unverändert, auch für eine 404 mit anderem oder ohne `zustand`.
2. **Erste Anwendung mit 404 und `zustand`** (PO Z. 506, „Dazu gehört zur Karte“): Antwortet die erste Anfrage `GET …/diff` ohne `anwendung` mit 404 **und** `zustand`, steht nie „Keine Änderungen zu zeigen.“ mit „An dieser Aufgabe sind keine Commit-Verweise hinterlegt.“. Die Seite zeigt dann Abschnitte. Die Leer-Meldung bleibt der 404 **ohne** `zustand`, also einer Aufgabe ohne Verweise.
3. **Woher die Anwendungen kommen, wenn die erste Antwort 404 ist:** Eine solche Antwort trägt kein `weitere_anwendungen`. Die Kürzel kommen deshalb aus der Antwort von `GET …/commits`, die die Seite ohnehin parallel liest (R00210 B1045). Es zählt jedes `anwendung` (auch das leere) eines Eintrags, dessen `zustand` weder `unlesbar` noch `anwendung_unbekannt` ist. Jedes Kürzel zählt einmal, in der Reihenfolge seines ersten Auftretens. Je Kürzel entsteht ein wartender Abschnitt. Die Abschnitte werden wie weitere Anwendungen nacheinander mit `GET …/diff?anwendung=<k>` gelesen, durch dieselbe Reihe (höchstens eine Anfrage an `…/diff` zur Zeit, Lauf-Kennung, Abbruch; R00210 FA 9, 10). Auch die fehlende Anwendung bekommt ihren Abschnitt aus ihrer eigenen Antwort. Ihr Satz entsteht also auf demselben Weg wie FA 1. Ist die Liste beim Eintreffen der 404 noch nicht da, zeigt die Seite weiter „Liest die Änderungen der Aufgabe …“, bis sie da ist.
4. **Seitenweite Hinweise ohne erreichbare Anwendung:** Gibt es im Fall von FA 3 Einträge mit `unlesbar` oder `anwendung_unbekannt`, stehen sie als seitenweite Hinweise über den Abschnitten. Das gilt wie bei einer Antwort 200 (R00210 FA 6, entdoppelt nach Verweis), auch wenn keine Anwendung mit 200 antwortet. Die Quelle sind dann die Einträge der Liste (`verweis`, `zustand`).
5. **Liste gescheitert** (PO Z. 511, wörtlich): Scheitert `GET …/commits` im Fall von FA 3, steht eine Seitenmeldung in der Form `meldungHtml` mit `role="alert"`, Ton `fehl` und Symbol `ordner-offen`. Die Überschrift lautet „Das Repository einer Anwendung dieser Aufgabe ist nicht erreichbar.“, darunter steht `<grund>` der ersten Antwort als Hinweiszeile (fehlt `grund`, entfällt sie). Darunter folgt „Die Liste der Commits ließ sich nicht lesen: <fehler> (<status>). Die übrigen Anwendungen der Aufgabe sind deshalb nicht zu sehen.“. Der erste Satz ist der vorhandene `listeFehlerText` (`web/diff.js`), geprobt: `{status: 500, fehler: "kaputt"}` ergibt „Die Liste der Commits ließ sich nicht lesen: kaputt (500).“, ohne Antwort „… keine Verbindung zum Programm (0).“. Überschrift, Hinweiszeile und dieser Satz sind eigene Block-Elemente untereinander (wie FA 6). Der Knopf „Erneut versuchen“ wiederholt beide Lesungen (Liste und Gesamtbild). Der Fokus steht nach dem Aufbau und nach „Erneut versuchen“ auf der Überschrift `#rv-meld` (R00207 FA 13). Es gibt genau eine Live-Ansage (PO Z. 481 a, 511): die Meldung; die Ansage-Region aus R00210 FA 3 bleibt dabei leer. Es steht nie die Leer-Meldung.
6. **„Ein Commit“, 404 mit `zustand`** (PO Z. 507, 508): Die Überschrift lautet „Zu <kurz> gibt es keinen Diff.“. `<kurz>` ist die Kurzform des **angefragten** Verweises (`kurzVerweis`). Darunter steht je Zustand ein Satz, dann gegebenenfalls `<grund>` als Hinweiszeile (`rv-hin`), dann „Zur Liste der Commits“ wie bisher:
   - `repository_fehlt`: „Das Repository der Anwendung <k> ist nicht erreichbar.“ + `<grund>`;
   - `fehlt`: „Das Repository der Anwendung <k> kennt diesen Commit nicht mehr.“ ohne Hinweiszeile;
   - `anwendung_unbekannt`: „Die Anwendung <k> ist unter Einrichten nicht eingetragen.“. Ohne Kürzel lautet der Satz „Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.“;
   - `unlesbar`: „Der Eintrag an der Aufgabe ist nicht lesbar.“ + `<grund>`, falls vorhanden;
   - unbekannter Zustand und 404 ohne `zustand`: wie bisher „Zu diesem Verweis gibt es keinen Diff: <kurz> — <fehler>.“

   `<k>` ist das Kürzel des angefragten Verweises. Eine Adresse mit Hash-Präfix ohne Kürzel, die über die Liste auf `wb:<hash>` aufgelöst wurde, nennt also „Anwendung wb“. Ein Verweis ohne Kürzel nennt die Standardanwendung. Die Meldung trägt Symbol und Ton aus `ZEICHEN` des Zustands (`repository_fehlt` ordner-offen/fehl, `fehlt` fehlt/fehl, `anwendung_unbekannt` frage/warn, `unlesbar` achtung/fehl); beim unbekannten Zustand bleibt sie ohne Symbol; die Rolle `status` bleibt (UX-Vorprüfung M2, wörtlich). Überschrift, Satz und Hinweiszeile sind eigene Block-Elemente untereinander: `.rv-meld` setzt `h2` und `p` heute `inline` (`web/kd-app.css`), sodass „erreichbar.Ordner fehlt“ in einer Zeile klebte. Die Form der übrigen Seitenmeldungen bleibt (z. B. über einen Modifikator). Der Fokus (`#rv-meld`) bleibt wie in R00207 FA 13. Das ersetzt R00207 FA 8 „<verweis> ist <Zustandswort>.“.
7. **Eine Stelle für die Sätze:** Satz und Hinweiszeile je Zustand entstehen an genau einer Stelle neben `ZUSTANDSWOERTER` in `web/commits.js`. Beide Ansichten benutzen sie, es gibt kein zweites Wörterbuch. Das Kürzel im Satz kommt über `anwendungName` (`web/diff.js`), nie als „Anwendung “ ohne Namen. Das Symbol kommt aus derselben Quelle wie die Marke der Liste (`SYMBOLE` in `web/commits.js`): `symbol` in `web/diff.js` kennt `ordner-offen`, `fehlt` und `frage` nicht und schreibt `undefined` ins SVG (geprobt mit `diff.symbol('ordner-offen')`).
8. **Fremder Text** (ADR-0033 Punkt 8): `grund` und Kürzel gehen nur maskiert (`esc`) in die Seite. Aus `grund` werden vorher U+202A–202E und U+2066–2069 entfernt (`ohneSteuerzeichen`, wie `hinweisVon`).

## Nicht-funktionale Anforderungen

- Benutzerfreundlichkeit: Bei 320 und 414 px scrollt keine der beiden Ansichten quer, auch nicht mit einem `grund` von 500 Zeichen ohne Leerzeichen. Die Hinweiszeile bricht um (Breitenregel aus R00210 AK 9). Das Zustandswort hängt nie allein an der Farbe, Symbol und Satz stehen immer dabei.
- Sicherheit: Siehe FA 8. Der Serverpfad im `grund` ist die bewusste Grenze nach ADR-0032 N2.4 und S2 (lokales Werkzeug, der Pfad hilft beim Beheben).
- Anfragen: Die fehlende erste Anwendung kostet genau eine weitere Anfrage `…/diff?anwendung=<k>`. Der Server antwortet darauf ohne Git-Lauf über das Register hinaus (`wurzel_bis` scheitert vorher). Es gibt keine Wiederholung von selbst.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar mit Git und der API) ist die von R00210 wie im Entwicklertest von #215 (`gemeinsam/scratchpad/etest-215/` der Factory). Sie entsteht mit `gesamtRepositorien()` und `gesamtVorbereiten(rep, zusatz)` aus `e2e/tests/gesamt-hilfen.js`, Register `kd` → R, `wb` → S, `xx` → T, Mensch `sh`, Browser headless, Zeitzone `Europe/Berlin`. **Danach wird das Repository S umbenannt** (`S` → `S-weg`). Der Registereintrag `wb` zeigt damit auf einen Ordner, den es nicht gibt. Der erwartete `grund` ist der `grund` des Eintrags `wb:<W1>` aus `GET /api/aufgaben/11/commits`. Er beginnt mit „Ordner fehlt: “ und nennt den Pfad aus dem Register. Die Probe vergleicht mit diesem Wert, nicht mit einem festen Pfad. Zusätzliche Aufgaben (`zusatz`):

- **#20** `wb:<W1>`, `kd:<K1>`, `xx:<X1>`: Die erste Anwendung fehlt.
- **#21** `wb:<W1>`, `wb:<W2>`, `xy:<K1>`: Nur die fehlende Anwendung, dazu ein Verweis auf eine nicht eingetragene Anwendung.
- **#24** `<F>` (voller Hash, ohne Kürzel): Das Register hat keine Standardanwendung (`sources: wbs: ""`), also gilt `anwendung_unbekannt` ohne Kürzel.
- Aus R00210 dienen #6 (`kd:<V2>` gelöscht, `xy:<K1>`), #11 und #14 (ohne Verweise).
- **Feste Antworten per `page.route`** für Zustände, die echtes Git nicht billig herstellt: `unlesbar` mit und ohne `grund`, `repository_fehlt` ohne `grund`, ein unbekannter `zustand`, ein leeres Kürzel (Standardanwendung) und fremder Text im `grund`.

### Alle Änderungen

- [x] **AK 1 Weitere Anwendung fehlt (#11, Beleg der Anmerkung):** Gegeben #11 auf `…/aufgabe/11/review`, dann steht im Abschnitt „Anwendung wb“ der Satz „Das Repository der Anwendung wb ist nicht erreichbar.“. Darunter steht als eigene Zeile der erwartete `grund`, mit dem Symbol `ordner-offen` (dasselbe SVG wie die Marke von `wb:<W1>` in der Liste „Commits“, kein `undefined` im Markup) im Ton `fehl` und mit „Erneut versuchen“. Die Meldung trägt dieselben Attribute `role` und `aria-live` wie der Abschnittsfehler bei 503 aus R00210 AK 4a (geprüft als Gleichheit, kein fester Wert; heute `role="alert"`). Der Abschnitt enthält weder „ließen sich nicht lesen“ noch „(404)“, „kein Diff zu diesem Verweis“ oder „der Zustand sagt warum“. Die Abschnitte `kd` und `xx` sind unverändert geladen. *(Heute rot: `s-echt-fehlt.png`.)*
- [x] **AK 2 Erste Anwendung fehlt (#20):** Gegeben #20, dann zeigt die Seite **weder** „Keine Änderungen zu zeigen.“ **noch** „An dieser Aufgabe sind keine Commit-Verweise hinterlegt.“. Sie zeigt genau drei Abschnitte, die Anwendungen `wb`, `kd` und `xx`. Der Abschnitt `wb` trägt Satz und `grund` wie in AK 1, die Abschnitte `kd` (K1) und `xx` (X1) zeigen ihre Dateien. Die Abschnitte stehen in der Reihenfolge, in der die Kürzel in der Antwort von `GET /api/aufgaben/20/commits` zuerst auftreten. Rechenbeispiel: K1 und X1 haben ein Datum, W1 im fehlenden Repository hat keins. Die Liste lautet daher K1, X1 (nach Datum) und dann W1, die Abschnitte also `kd`, `xx`, `wb`, sofern K1 älter als X1 ist, sonst `xx`, `kd`, `wb`. Der Umschalter steht da, „Ein Commit“ führt auf den ersten Commit mit Diff. *(Heute rot: `web/app.js:1380`.)*
- [x] **AK 3 Nur die fehlende Anwendung (#21):** Gegeben #21, dann steht genau ein Abschnitt „Anwendung wb“ mit Satz und `grund`. Über ihm steht der seitenweite Hinweis zu `xy:<K1>` im Wortlaut von R00210 FA 6. „Ein Commit“ im Umschalter ist gedämpft und ohne `href` (PO Z. 442). Die Leer-Meldung steht nicht da.
- [x] **AK 4 Ohne Verweise bleibt leer (#14):** Gegeben #14, dann steht „Keine Änderungen zu zeigen.“ mit „An dieser Aufgabe sind keine Commit-Verweise hinterlegt.“ und dem Rückweg wie bisher. Dasselbe gilt für eine feste 404 der ersten Anfrage ohne `zustand` bei einer Aufgabe mit Verweisen. *(Heute grün, bleibt.)*
- [x] **AK 5 Anfragen und Erneut versuchen (#20):** Gegeben #20, dann geht nach der ersten 404 je Kürzel genau eine `GET …/diff?anwendung=<k>` hinaus, für `kd`, `xx` und `wb`, nie zwei zugleich (Zähler gleichzeitiger `…/diff`-Anfragen höchstens 1). Ein Klick auf „Erneut versuchen“ am Abschnitt `wb` sendet genau eine `…/diff?anwendung=wb`, und die übrigen Abschnitte bleiben stehen. Steht die Antwort von `…/commits` noch aus, wenn die 404 eintrifft (gehalten per `page.route`), steht „Liest die Änderungen der Aufgabe …“. Nach ihrer Freigabe folgen die drei Abschnitte.
- [x] **AK 6 Liste gescheitert** (PO Z. 511): Gegeben #20 und `GET …/commits` endet mit 500 `{"fehler": "kaputt"}` (`page.route`). Dann steht `.rv-meld.fehl` mit Symbol `ordner-offen`, Überschrift „Das Repository einer Anwendung dieser Aufgabe ist nicht erreichbar.“, darunter der erwartete `grund`, darunter „Die Liste der Commits ließ sich nicht lesen: kaputt (500). Die übrigen Anwendungen der Aufgabe sind deshalb nicht zu sehen.“, dazu „Erneut versuchen“, nie die Leer-Meldung. Der Fokus steht auf `#rv-meld`. Ein `MutationObserver` über alle Live-Regionen der Seite (`role="alert"`, `role="status"`, `aria-live`) zählt ab dem Scheitern der Liste genau eine Ansage, die Meldung; die Ansage-Region bleibt leer. Überschrift, Hinweiszeile und Listensatz liegen bei 320 und 1280 px untereinander (Oberkante ≥ Unterkante des vorigen, `getBoundingClientRect`). Das Symbol-SVG ist gleich der Ausgabe für `ordner-offen` aus `web/commits.js` und enthält kein `undefined`. Mit einer 404 der ersten Anfrage ohne `grund` (`page.route`) fehlt die Hinweiszeile. Nach dem Freigeben der Route und „Erneut versuchen“ gehen je eine `…/commits` und `…/diff` hinaus, und es stehen die drei Abschnitte aus AK 2. *(Heute rot: Leer-Meldung.)*

### Ein Commit

- [x] **AK 7 Repository fehlt:** Gegeben #11 und die Adresse `…/aufgabe/11/review?commit=wb:<W1>`, dann lautet die Überschrift „Zu wb:<W1 7 Zeichen> gibt es keinen Diff.“. Darunter steht „Das Repository der Anwendung wb ist nicht erreichbar.“, darunter der erwartete `grund` als Hinweiszeile, dann „Zur Liste der Commits“. Die Meldung ist `.rv-meld.fehl` mit `role="status"` und dem Symbol `ordner-offen` (dasselbe SVG wie die Marke in der Liste, kein `undefined` im Markup). Nirgends steht „ist Repository nicht erreichbar“. Dasselbe gilt für die Adresse mit dem Hash-Präfix allein `?commit=<W1 7 Zeichen>`, die über die Liste aufgelöst wird. *(Heute rot.)*
- [x] **AK 8 Die übrigen Zustände:** Es gilt jeweils:
  - Gegeben #6 und `?commit=kd:<V2>`, dann steht „Zu kd:<V2 7 Zeichen> gibt es keinen Diff.“ mit „Das Repository der Anwendung kd kennt diesen Commit nicht mehr.“ und ohne Hinweiszeile, `.rv-meld.fehl` mit Symbol `fehlt`.
  - Gegeben #6 und `?commit=xy:<K1>`, dann steht „Die Anwendung xy ist unter Einrichten nicht eingetragen.“, `.rv-meld.warn` mit Symbol `frage`.
  - Gegeben #24 und `?commit=<F>`, dann steht „Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.“, `.rv-meld.warn` mit Symbol `frage`.
  - Gegeben eine feste 404 `{fehler, zustand: "unlesbar", grund: "Kurz-Hash mehrdeutig"}`, dann steht „Der Eintrag an der Aufgabe ist nicht lesbar.“ mit der Hinweiszeile „Kurz-Hash mehrdeutig“, `.rv-meld.fehl` mit Symbol `achtung`. Ohne `grund` fehlt diese Zeile.
  - In jedem dieser Fälle ist die Rolle `status`, und das Symbol ist dasselbe SVG wie die Marke des Zustands in der Liste „Commits“.
  - *(Heute rot: „ist nicht mehr im Repository“, „ist Anwendung unbekannt“, „ist Eintrag nicht lesbar“.)*
- [x] **AK 9 Unbekannter Zustand bleibt:** Gegeben eine feste 404 `{fehler: "x", zustand: "neu_art"}` auf `?commit=kd:<K1>`, dann steht wie bisher „Zu diesem Verweis gibt es keinen Diff: kd:<K1 7 Zeichen> — x.“, ohne Symbol und ohne Ton (`.rv-meld` ohne `fehl` und `warn`). Ebenso für die 404 `{fehler, verweis}` „Verweis nicht an der Karte“. *(Heute grün, bleibt.)*

### Beide Ansichten

- [x] **AK 10 Standardanwendung und fehlender Grund** (`page.route`): Gegeben ein Verweis ohne Kürzel und eine 404 `repository_fehlt`, dann steht in beiden Ansichten „Das Repository der Standardanwendung ist nicht erreichbar.“. Bei `fehlt` steht „Das Repository der Standardanwendung kennt diesen Commit nicht mehr.“. Nirgends steht „Anwendung “ ohne Namen. Gegeben `repository_fehlt` ohne `grund`, dann steht der Satz ohne Hinweiszeile, in beiden Ansichten.
- [x] **AK 11 Fremder Text** (`page.route`, beide Ansichten): Gegeben `grund` = „Ordner fehlt: /x/<img src=x onerror=window.PWN=1>\u202Egpj.exe“, dann bleibt `window.PWN` undefiniert, und es gibt kein `img[src=x]` im Dokument. Die Hinweiszeile zeigt `<img src=x onerror=window.PWN=1>` als Text. Ihr `textContent` enthält kein Zeichen aus U+202A–202E und U+2066–2069, es endet auf „gpj.exe“.
- [x] **AK 12 Breite:** Gegeben `grund` mit 500 Zeichen (`langerOrdner` aus `e2e/tests/commits-hilfen.js`), dann scrollt bei 320 und 414 px keine der beiden Ansichten quer (gemessen gegen `clientWidth` wie R00210 AK 9). Symbol, Satz und Hinweiszeile sind sichtbar, kein Zustandswort steht als `.vh`. Die rechte Kante von „Erneut versuchen“ ist ≤ `clientWidth`.
  **Lage (UX-Vorprüfung M1):** Gegeben #11 mit dem echten `grund`, dann gilt bei 320, 414 und 1280 px in beiden Ansichten (Abschnitt `wb` und `?commit=wb:<W1>`): Oberkante der Hinweiszeile ≥ Unterkante des Satzes, auf „Ein Commit“ zusätzlich Oberkante des Satzes ≥ Unterkante der Überschrift (`getBoundingClientRect`). Zwischen Satz und Hinweiszeile steht in `textContent` kein Zeichen außer Leerraum (die Zeilen sind getrennte Elemente). *(Heute rot mit der Form aus Runde 1: bei 1280 px Überschrift, Satz und Grund auf einer Höhe, „erreichbar.Ordner fehlt“; im Abschnitt Satz und Grund nebeneinander.)*
- [x] **AK 13 Mutanten:** Jeder Mutant wird von einem benannten Test getötet:
  - (m1) Leer-Meldung bei jeder 404 der ersten Anfrage (heutiger Stand): AK 2 rot.
  - (m2) Kürzel nur aus `weitere_anwendungen`: AK 2 rot, Abschnitte `kd` und `xx` fehlen.
  - (m3) `grund` ohne `ohneSteuerzeichen`: AK 11 rot.
  - (m4) `grund` ohne `esc`: AK 11 rot.
  - (m5) Kürzel aus der Adresse statt aus dem angefragten Verweis: AK 7, Präfix-Fall rot.
  - (m6) „Anwendung “ + leeres Kürzel: AK 10 rot.
  - (m7) Abschnitte auch bei 404 ohne `zustand`: AK 4 rot.
  - (m8) zwei `…/diff`-Anfragen zugleich: AK 5 rot.
  - (m9) „Ein Commit“ ohne Ton und Symbol, oder das Symbol über `symbol` aus `web/diff.js`: AK 7 rot, AK 6 rot.
  - (m10) Hinweiszeile `inline` bzw. als zweites Flex-Element neben dem Satz: AK 12 (Lage) rot, AK 6 rot.
  - (m11) Seitenmeldung aus FA 5 setzt zusätzlich die Ansage-Region: AK 6 rot (zwei Ansagen).

  Die Tests von R00207 und R00210 laufen grün. Geändert werden nur die Erwartungen an den beiden ersetzten Sätzen (R00207 FA 8, R00210 FA 7), die Anzahl steht im Commit.

## Betroffene Verzeichnisstruktur

- `web/commits.js`: Satz und Hinweiszeile je Zustand (rein, Node-tauglich), neben `ZUSTANDSWOERTER`. Tests in `e2e/einheit/commits.test.js`.
- `web/diff.js`: `diffFehlerHtml`, Zweig `kein_diff`. `web/gesamt.js`: `abschnittFehlerHtml`, dazu die reine Herleitung der Kürzel und seitenweiten Hinweise aus der Liste. Tests in `e2e/einheit/diff.test.js` und `gesamt.test.js`.
- `web/app.js`: `reviewBild`, `reviewAlleErste`, Warten auf die Liste, `vReviewAlle`, Aktion `review-erneut` für FA 5.
- E2E: neue Spec `e2e/tests/r00224-grund-bei-404.spec.js` mit den Hilfen aus `gesamt-hilfen.js` und `commits-hilfen.js`.

## Technische Überlegungen

### Ablauf (Vorplanung, die Bubbles entscheidet der Entwickler)

1. **Satz je Zustand** (`web/commits.js`): `(zustand, kuerzel, grund)` ergibt `{satz, hinweis, symbol, ton}` oder `null` für einen unbekannten Zustand. Der Name kommt über `anwendungName`, der Hinweis ist `ohneSteuerzeichen(grund)` oder leer. Rein, nichts ist maskiert.
2. **„Ein Commit“** (`diffFehlerHtml`): Bei `kein_diff` mit bekanntem `zustand` gilt Überschrift + Satz + `rv-hin`, sonst der alte Satz. Der Verweis ist der angefragte (`r.diff.verweis`), nicht `r.commit`.
3. **Abschnitt** (`abschnittFehlerHtml`): Bei Status 404 mit `f.daten.zustand === 'repository_fehlt'` gilt Satz + Hinweiszeile + Symbol/Ton aus Schritt 1, sonst wie bisher.
4. **Erste Anfrage mit 404 + `zustand`** (`reviewBild`, `reviewAlleErste`):
   - 4.1 Ist die Liste da, kommen die Kürzel nach FA 3 und die seitenweiten Hinweise nach FA 4. `alle.erste` wird `da` ohne eigenen Abschnitt, je Kürzel ein `{status: 'wartet', kuerzel}` in die Reihe.
   - 4.2 Ist die Liste noch nicht da, wartet die Seite, und die Ankunft der Liste setzt 4.1 fort.
   - 4.3 Ist die Liste gescheitert, gilt FA 5.
5. **Probe im echten Programm** mit umbenanntem S, die Mutanten, das Gate.

**Wichtige Einstiegsstellen:** `web/app.js:1380` (`reviewBild`, Zweig `alle`), `:1588` (`reviewAlleErste`), `:1778` (Leer-Meldung). `web/gesamt.js:342` (`abschnittFehlerHtml`), `web/diff.js:442` (`diffFehlerHtml`).

### Änderungen an bestehenden Klassen

- `ZUSTANDSWOERTER` und `hinweisVon` bleiben für die Liste unverändert, die neue Funktion steht daneben.
- `seitenHinweise` (`web/gesamt.js`) nimmt zusätzlich Listeneinträge `{verweis, zustand}` an.

## Tests

Nach Skill `test-pyramide`:

- **Unit** (Node): Satz je Zustand mit leerem Kürzel, ohne `grund` und unbekanntem Zustand; Kürzel aus der Liste (Reihenfolge, entdoppelt, leeres Kürzel, `unlesbar` und `anwendung_unbekannt` ausgenommen); `diffFehlerHtml` und `abschnittFehlerHtml` mit `esc` gegen HTML im `grund`.
- **Integration:** keine. Es gibt keinen Serverteil, die 404-Antworten sind Bestand (R00206, R00208).
- **E2E:** AK 1–12 gegen das gestartete Programm (`target/debug`), feste Antworten nur für die genannten Zustände; Mutanten aus AK 13.

## Abhängigkeiten

- Abhängig von: R00207 (I0197, gruen), R00208 (I0198), R00210 (I0200), alle auf `main`.
- Blockiert: nichts.

## Offene Fragen

- Keine. Entschieden am 2026-11-21: Wortlaut, wenn die erste Anwendung mit `repository_fehlt` antwortet **und** die Liste der Commits scheitert (PO Z. 511, wörtlich in FA 5 und AK 6).

## Manuelle Vorbereitungstätigkeiten

- Keine.

## Manuelle Nachbereitungstätigkeiten

- Keine Nachzeichnung (PO Z. 506: keine neue Bedienfläche). Der gestalter kann die Ränder von D0009 (`#alle-raender`, `#diff-raender`) nach dem Bau um die Sätze ergänzen. Das ist kein Teil dieser Karte.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser war der Entwicklertest von #215: Eine Anwendung im Register zeigte auf einen fehlenden Ordner, und die Seite sagte nur „der Zustand sagt warum (404)“, ohne den Zustand zu nennen. Bei der ersten Anwendung behauptete sie sogar, es gebe keine Verweise. Die Antwort der API trägt Zustand und Grund schon. Der Hebel liegt deshalb allein in der Oberfläche, genauer an der einen Stelle, die Zustände in Worte fasst (FA 7). Wenn beide Fehlerwege diese Stelle benutzen, sieht der Mensch „Das Repository der Anwendung wb ist nicht erreichbar.“ mit dem Pfad, behebt das Register und lädt neu. Holt die Seite die Anwendungen bei einer 404 aus der Liste der Commits statt aus der fehlenden Antwort, bleibt jede erreichbare Anwendung prüfbar. Eine Aufgabe wirkt dann nie leer, nur weil ihre erste Anwendung nicht erreichbar ist. Eine Änderung der API (`anwendung` und `weitere_anwendungen` an der 404) wäre der vorgelagerte Hebel. Sie bräuchte aber einen Nachtrag zu ADR-0032 und eine zweite Karte, während die Liste die Kürzel schon liefert.

## Notizen

**Entscheidung des planers (Optionen zu FA 3, woher die Anwendungen kommen):**

| Option | Kosten | Risiko | Gewählt |
|---|---|---|---|
| A: alle Kürzel aus der Liste, jede Anwendung einzeln durch die Reihe, auch die fehlende | eine Anfrage mehr (ohne Git) | keins, kein Schluss aus der Sortierung | **ja** |
| B: Kürzel der fehlenden = erster Listeneintrag mit `repository_fehlt`, Satz aus der ersten 404 | keine Anfrage mehr | beruht auf der Sortierregel der Liste (ohne Datum in Dateireihenfolge, R00204) und auf zwei Anfragen mit demselben Register | nein |
| C: API trägt `anwendung` und `weitere_anwendungen` auch an der 404 | Nachtrag ADR-0032, Rust und Dokumentation | ändert den Vertrag (OpenAPI, Clients) | nein, bräuchte den architekten |

Bei A entsteht der Satz der fehlenden Anwendung auf demselben Weg wie bei einer weiteren Anwendung (FA 1). Es gibt also einen Codeweg statt zwei. Die Reihenfolge der Abschnitte weicht im 404-Fall von der Antwort 200 ab: Die fehlende Anwendung steht hinten, weil ihre Einträge kein Datum haben. Das ist sichtbar und harmlos.

**UX-Vorprüfung (Lauf 232-ux-reviewer-1) eingearbeitet:** M1 „darunter“ als Lageprobe in AK 12, Block-Elemente in FA 1, 5, 6; M2 Symbol und Ton auf „Ein Commit“ wörtlich in FA 6, Proben in AK 7–9; Sollte Live-Rolle in FA 1 und AK 1 (wie die übrigen Abschnittsfehler, damit die Karte aus PO Z. 481 c nur eine Stelle ändert); Sollte Wortlaut, Form, Fokus und eine Ansage in FA 5 und AK 6, inzwischen von PO Z. 511 bestätigt; Optional „Erneut versuchen“ ≤ `clientWidth` in AK 12. Beim Einarbeiten gefunden: `symbol` in `web/diff.js` kennt die Zustandssymbole nicht (FA 7, Mutant m9). Mutanten m9–m11 neu.

**Bewusst außerhalb:**

- Die Ansage im Statusbereich bleibt „…, ohne Anwendung <k>: ließ sich nicht lesen.“ (R00210, B1041). Der PO hat nur den sichtbaren Satz entschieden.
- `fehlt`, `unlesbar` und `anwendung_unbekannt` auf „Alle Änderungen“ kommen nicht als 404 (PO Z. 508), deshalb gibt es dort nichts zu tun.
- Keine Änderung an der Liste „Commits“ (R00205).
