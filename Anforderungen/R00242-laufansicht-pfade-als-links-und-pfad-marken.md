---
id: R00242
status: Neu
datum: 2026-11-22
---

# R00242: Laufansicht — Pfade als Links und kurze Pfad-Marken

## Beschreibung

Karte #264, Scheibe C2 „Pfade“ (PO Z. 592). Technik [ADR-0041](../Dokumentation/ADRs/0041-laufansicht-gzip-im-strom-mit-grenze-einmal-zeichnen-als-insel.md) Nachtrag N4 Punkte 5 und 6 (Variante M1). Produkt `AI-Team/po-entscheidungen.md` Z. 592 (Zuschnitt), Z. 593 (Ausnahmen zu Z. 494), Z. 594 (Pfad der Marke „gekürzt“ ab C2 als Link), Z. 596 (Wortlaut der Marken), Z. 607 (Tooltip nur bei feinem Zeiger). Zeichnung D0009 `#laufansicht` Bild 13 mit den Notizen „Pfad-Marken (C2)“ und „Links (C2)“ (freigegeben Z. 602). Gebaut auf dem Stand nach #261 ([R00240](R00240-laufansicht-satz-der-eintraege.md), `web/lauf-satz.js`).

Wer in der Laufansicht liest, sieht lange Pfade kurz: ‹kanbanD›/web/lauf.js statt `/home/…/kanbanD/web/lauf.js`, ‹Worktree #246›/… und ‹Ablage›/…. Die Marken kommen aus dem Kopf des Auftrags (Zeilen `Projekt:`, `Arbeitsort:`, `Ablage:`). Der volle Pfad bleibt im Tooltip, in der Kopie, in der Suche und für den Bildschirmleser. Pfade in Nachrichten, das Pfadfeld von Read, Edit, Write und NotebookEdit und der Pfad, den Claude Code in `<persisted-output>` nennt, sind Links nach VS Code, Read an `offset`, Edit an der ersten geänderten Zeile. Pfade in Befehlen, anderen Feldern, Ergebnissen und in der Zusammenfassung werden nie ein Link. Lesen, Auswertung, Format, Server und OpenAPI bleiben unverändert.

Zahlt ein auf: [Vision](R00000-vision.md) — „Die Arbeit hinter der Karte nachvollziehen“ (Z. 110): R00240 macht lesbar, was in einem Schritt geschah. Diese Anforderung macht die Orte lesbar, an denen es geschah, und führt mit einem Klick dorthin.

### Domänenbezug

- [Aufgabenfenster](../Dokumentation/Domaenenwissen/D00001-aufgabenfenster.md) (Ansicht „Läufe“, von dort „Ansehen“)

## Geschäftlicher Nutzen

Der Betreiber will „Dateipfad und Zeile ein Link“ und kurze Marken statt langer Pfade (Karte #261, Wunsch 3, Kommentar Punkte 1, 2 und 9). Ein Pfad eines Worktrees hat heute rund 60 Zeichen, bevor der Dateiname kommt. Bei 320 px bricht er über drei Zeilen, und Projekt, Worktree und Ablage sind nur am Ende des langen Anfangs zu unterscheiden. 96 von 395 Nachrichten nennen einen absoluten Pfad (N4 „Belegt“). Wer eine Karte abnimmt, will sehen, in welchem Ordner der Agent gearbeitet hat, und die Datei an der Stelle öffnen, die er gelesen oder geändert hat.

## Funktionale Anforderungen

1. **Wurzeln aus dem Auftrag** (N4 Punkt 6, M1): `pfadMarken` liest die erste Nachricht von `mensch` (der „Auftrag“, R00234). Je Zeile, auch in mehreren durch `·` getrennten Teilen, gilt ein Teil, der mit `Projekt:`, `Arbeitsort:` oder `Ablage:` beginnt. Sein erster absoluter Pfad ist die Wurzel; Satzzeichen (`.`, `,`, `;`, `:`, `)`) und `/` am Ende fallen weg. Marken (PO Z. 596): ‹<letzter Teil des Projektpfads>›, ‹Worktree #<n>›, wenn der Arbeitsort auf `karte-<n>` endet, sonst ‹Arbeitsort›, und ‹Ablage›. Eine Wurzel mit Bidi- oder Steuerzeichen (`sichtbarTeile` ändert sie) ergibt keine Marke. Ohne erkannten Teil gibt es keine Marken.
2. **Marke am Pfad** (N4 Punkt 6, D0009 „Pfad-Marken (C2)“): Ein Pfad, der mit einer Wurzel beginnt, steht als Marke und Rest; es gilt der längste Treffer, nur an einer Grenze `/` (`/a/bc` ist kein Treffer für `/a/b`). Zwischen Marke und Rest steht der Schrägstrich des Pfads (‹Worktree #7›/web/a.js); ein Pfad gleich der Wurzel zeigt nur die Marke. Die Marke ist erzeugter Inhalt (`::before` aus einem Attribut) ohne eigenen Lesetext; der volle Anfang des Pfads steht als visuell verborgener Text im DOM. Der volle Pfad ist der `title` (Tooltip bei feinem Zeiger, PO Z. 607), das, was eine Auswahl kopiert, der zugängliche Name und das Ziel des Links. Marken gelten in Nachrichten, im Aufruf (auch in `command` und anderen Feldern, dort ohne Link), in der Zusammenfassung und im Pfad aus `<persisted-output>`. In Ergebnistext gelten sie nicht.
3. **Links in Nachrichten** (N4 Punkt 5): `markdownInline` bekommt eine Option `pfade` (Vorgabe aus); nur `web/lauf.js` setzt sie, für Nachrichten, Auftrag und Bericht. Links entstehen aus absoluten Pfaden (`/…` mit mindestens zwei Teilen) und, nur wenn die Wurzel „Arbeitsort“ bekannt ist, aus relativen Pfaden mit mindestens einem `/` und einer Endung, aufgelöst gegen diese Wurzel. Beide auch mit `:<zeile>`. Satzzeichen (`.`, `,`, `;`, `:`, `)`) und `/` am Ende gehören nicht zum Pfad und stehen als Text hinter dem Link. Füllt ein solcher Pfad den ganzen Inhalt eines Inline-Codes, steht der Code im Link (`<a><code>…</code></a>`), sonst bleibt Code Code. Gesucht wird in einem Durchlauf im Budget, das `markdownHtml` ohnehin hat. Beschreibung und Kommentare der Karten bleiben unverändert (ADR-0030 Punkt 7).
4. **Links im Aufruf** (N4 Punkt 5, PO Z. 593): Nur das Feld `file_path` bzw. `notebook_path` von Read, Edit, Write und NotebookEdit wird ein Link. Read mit `offset` springt an diese Zeile, ohne `offset` ohne Zeile. Edit springt an die Zahl der ersten Zeile seines Ergebnisses, die die Form von `cat -n` hat (`^\s*\d+` gefolgt von Tabulator oder `→`), sonst ohne Zeile. Write und NotebookEdit ohne Zeile. Nie ein Link aus `command`, aus anderen Feldern eines Aufrufs, aus Ergebnistext und nie in `summary`.
5. **Pfad aus `<persisted-output>`** (N4 Punkt 5, PO Z. 593, 594): In der Marke „Von Claude Code gekürzt (<Größe>): Der Agent sah nur diese Vorschau. Vollständig: <Pfad>“ (R00240 FA 8) ist der Pfad ein Link ohne Zeile, mit Marke. Die Vorschau darunter bleibt Ergebnistext ohne Link und ohne Marke.
6. **Wie ein Link entsteht** (N4 Punkt 5, R00236 FA 4–6, PO Z. 593): nur über `vscodeLink` (`web/review-uebersicht.js`): `vscode://file` + Pfad mit `encodeURIComponent` je Teil, `:<zeile>` nur, wenn es eine Zeile gibt. Kein Link, wenn das Sichtbarmachen (`sichtbarTeile`) den Pfad ändert (Bidi- und Steuerzeichen) oder ein Teil des Pfads `..` ist; dann steht der Pfad als Text wie heute. Das Muster `web/ansicht.js:392` (nur `esc`) wird nicht übernommen. Jedes Zeichen aus Auftrag, Aufruf und Ergebnis geht über `esc` bzw. `sichtbarHtml`, auch in `title` und im Attribut der Marke.
7. **Rückfälle**: Steht ein Aufruf über den Grenzen oder dem Zeichenbudget als `pre` (R00240 FA 13), trägt er weder Link noch Marke. Eine Nachricht über dem Budget von `markdownHtml` steht wie heute. Die Kürzung der Zusammenfassung auf 200 Zeichen zählt weiter den Rohtext (R00240 FA 11); eine Wurzel, die die Kürzung anschneidet, ergibt dort keine Marke. Die Listen „Längste Schritte“ und „Teuerste Schritte“ bleiben ohne Marken (N4 nennt sie nicht; Offene Frage 1).

## Nicht-funktionale Anforderungen

- **Sicherheit** (N4 „Durchsetzung“, Review-Punkt security-reviewer): Jeder Link der Insel beginnt mit `vscode://file/`, `http://`, `https://` oder `mailto:` und entsteht nur über `vscodeLink` oder `markdownInline`. Kein Text aus Aufruf oder Ergebnis geht an `esc`/`sichtbarHtml` vorbei ins HTML. Kein `<a` steht in `summary` oder im Ergebnistext.
- **Architektur** (Review-Punkt architektur-reviewer): `pfadMarken` und `pfadLinkHtml` liegen in `web/lauf-satz.js`, Lesen und Auswerten in `web/lauf.js`; `grep -c "laufAuswerten(" web/app.js` bleibt 1.
- **Leistung**: Gesetzt wird einmal je Lesen beim Bau der Insel (N4 Punkt 8); die Pfadsuche ist ein Durchlauf je Text. Keine eigene Messung; die Messung aus R00240 bleibt maßgeblich.
- **Zugänglichkeit**: Links tragen Farbe und Unterstreichung wie die übrigen Links der Ansicht; Text und Marke ≥ 4,5:1, Fokusring ≥ 2 px. Der Tooltip ist der `title` und erscheint bei grobem Zeiger nicht als eigenes Element (PO Z. 607); der volle Pfad bleibt dort in Kopie, DOM und Name.

## Akzeptanzkriterien

**Ausgangslage** (herstellbar über die API wie in R00240: die gz-Datei erzeugt der Test mit `zlib` und legt sie über `POST /api/aufgaben/<n>/transkripte` ab). Mensch `sh`, Browser headless (Chromium) in `Europe/Berlin`, Board `fabrik` mit `record-transcripts: true`. Aufgabe #1 trägt T14 = `planer@2026-11-24T10:00+01:00`, Aufgabe #2 trägt T14o = `planer@2026-11-24T11:00+01:00`, je ohne Kosteneintrag. Alle Inhalte sind erfunden; Kopf des Auftrags, `cat -n` und `<persisted-output>` sind echten Transkripten nachgebildet.

**T14** (Zeit 2026-11-24, Versatz +01:00, je eine Sekunde Abstand ab 10:00:00; Text der Aufrufe als JSON):

| Nr | art · wer | Inhalt |
|---|---|---|
| 1 | nachricht · mensch | „Projekt: /w/demo  ·  Factory: /w/fab“⏎„Karte: #7 Probe“⏎„Arbeitsort: Worktree /w/wt/demo/karte-7, Zweig karte/7. Arbeite nur dort.“⏎„Ablage: /w/fab/ablage/plan-7/ (nur dieser Ordner)“⏎„Lies zuerst /w/fab/ablage/plan-7/auftrag.md.“ |
| 2 | aufruf · `Read` | `{"file_path":"/w/wt/demo/karte-7/web/a.js","offset":10,"limit":2}` |
| 3 | ergebnis | `    10→x`⏎`    11→/w/demo/z.txt` |
| 4 | aufruf · `Edit` | `{"file_path":"/w/wt/demo/karte-7/web/a b?c#d%e:12.js","old_string":"x","new_string":"y"}` |
| 5 | ergebnis | „The file /w/wt/demo/karte-7/web/a b?c#d%e:12.js has been updated. Here's the result of running `cat -n` on a snippet of the edited file:“⏎`    42→y`⏎`    43→z` |
| 6 | aufruf · `Write` | `{"file_path":"/w/fab/ablage/plan-7/notiz.md","content":"a"}` |
| 7 | ergebnis | „File created successfully at: /w/fab/ablage/plan-7/notiz.md“ |
| 8 | aufruf · `Bash` | `{"command":"cat /w/demo/README.md && ls /w/wt/demo/karte-7/web","description":"Lesen"}` |
| 9 | ergebnis | `<persisted-output>`⏎`Output too large (12.0KB). Full output saved to: /w/fab/ablage/plan-7/tool-results/b1.txt`⏎⏎`Preview (first 2KB):`⏎„ok /w/demo/y.txt“⏎`</persisted-output>` |
| 10 | aufruf · `Grep` | `{"pattern":"x","path":"/w/demo/src"}` |
| 11 | ergebnis | „/w/demo/src/m.rs“ |
| 12 | aufruf · `NotebookEdit` | `{"notebook_path":"/w/demo/n.ipynb","new_source":"x"}` |
| 13 | ergebnis | „ok“ |
| 14 | aufruf · `Read` | `{"file_path":"/w/demo/‮evil.js"}` |
| 15 | ergebnis | „ok“ |
| 16 | nachricht · agent | „Geändert: `web/a.js`, siehe /w/demo/src/b.rs:42 und /w/demo/a&b.js. Lauf `cat web/a.js` bleibt Code; nicht ../x/y.js, nicht /w/demox/c.rs, nicht /w/demo/‮d.rs.“ |

**T14o** (Aufgabe #2, ohne Kopf): Nr 1 nachricht · mensch „Bitte /w/demo/a.js und `web/a.js` prüfen.“, Nr 2 aufruf `Read` `{"file_path":"/w/demo/a.js"}`, Nr 3 ergebnis „ok“.

**Rechenbeispiele** (geprobt gegen ein Modell der Regeln, `gemeinsam/scratchpad/plan-264/modell.js` der Factory):

- Wurzeln aus Nr 1: `/w/demo` → ‹demo›, `/w/wt/demo/karte-7` → ‹Worktree #7› (Komma weg), `/w/fab/ablage/plan-7` → ‹Ablage› (`/` am Ende weg). `/w/fab` (Factory) ist keine Wurzel.
- Nr 2: Link `vscode://file/w/wt/demo/karte-7/web/a.js:10`, sichtbar ‹Worktree #7›/web/a.js.
- Nr 4 mit Nr 5: erste Zeile der Form `cat -n` ist `    42→y`, also Link `vscode://file/w/wt/demo/karte-7/web/a%20b%3Fc%23d%25e%3A12.js:42`, sichtbar ‹Worktree #7›/web/a b?c#d%e:12.js.
- Nr 6: Link `vscode://file/w/fab/ablage/plan-7/notiz.md` ohne Zeile, sichtbar ‹Ablage›/notiz.md.
- Nr 8: Shell-Block `cat ‹demo›/README.md &&` · ` ls ‹Worktree #7›/web`, ohne Link.
- Nr 9: Marke „Von Claude Code gekürzt (12,0 KB): Der Agent sah nur diese Vorschau. Vollständig: ‹Ablage›/tool-results/b1.txt“, Link `vscode://file/w/fab/ablage/plan-7/tool-results/b1.txt`. Die Vorschau „ok /w/demo/y.txt“ bleibt Text.
- Nr 16: `web/a.js` → `vscode://file/w/wt/demo/karte-7/web/a.js` mit `<code>` im Link; `/w/demo/src/b.rs:42` → `vscode://file/w/demo/src/b.rs:42`, sichtbar ‹demo›/src/b.rs:42; `/w/demo/a&b.js` → `vscode://file/w/demo/a%26b.js`; `/w/demox/c.rs` → `vscode://file/w/demox/c.rs`, sichtbar voll, ohne Marke.

### Marken

- [ ] **AK 1 Wurzeln aus dem Auftragskopf:** In Node ergibt `pfadMarken` für Nr 1 von T14 genau die drei Wurzeln des Rechenbeispiels. Ein Arbeitsort `/w/arbeit` ergibt ‹Arbeitsort›. Mit Projekt `/a/b` und Arbeitsort `/a/b/wt/karte-3` steht `/a/b/wt/karte-3/x` als ‹Worktree #3›/x (längster Treffer), `/a/b/y` als ‹b›/y und `/a/bc/z` voll. `/w/fab/ablage/plan-70/x` steht voll. Ein Projekt `/w/de‮mo` ergibt keine Wurzel. Ein Text ohne die drei Schlüssel ergibt keine Wurzel, ebenso `Projekt:` erst in einer späteren Nachricht von `mensch`. Ein Kopf in der Form eines echten Auftrags der Factory, „Projekt: /p/kanbanD  ·  Factory: /p/fab“⏎„Arbeitsort: Worktree /p/.worktrees/kanbanD/karte-264, Zweig karte/264. Arbeite nur dort.“⏎„Ablage: /p/fab/gemeinsam/scratchpad/plan-264/ (nur dieser Ordner)“, ergibt ‹kanbanD›, ‹Worktree #264› und ‹Ablage›.
- [ ] **AK 2 Marke mit vollem Pfad:** Gegeben die Laufansicht von T14, wenn `sh` Nr 2 aufklappt, dann steht im Aufruf sichtbar ‹Worktree #7›/web/a.js. Für dieses Element gilt: `title` ist `/w/wt/demo/karte-7/web/a.js`, der `textContent` enthält den vollen Pfad, der zugängliche Name im `ariaSnapshot()` ist der volle Pfad ohne „‹“ und „Worktree #7“, und eine Auswahl über den ganzen Pfad ergibt mit `getSelection().toString()` den vollen Pfad. Der Auftrag (Nr 1) zeigt aufgeklappt „Projekt: ‹demo›“ ohne Rest. Die Zusammenfassung von Nr 8 zeigt `cat ‹demo›/README.md && ls ‹Worktree #7›/web` ohne `<a`. Die Ergebnisse Nr 3, Nr 7 und Nr 11 zeigen ihre Pfade voll, ohne Marke und ohne Link.

### Links

- [ ] **AK 3 Links in Nachrichten:** Gegeben T14, dann trägt Nr 16 genau vier Links mit den `href` des Rechenbeispiels; der erste enthält ein `code` mit „web/a.js“, und `title` jedes Links ist der volle Pfad. „cat web/a.js“ steht als Code ohne Link, „../x/y.js“ und der Pfad mit U+202E stehen ohne Link (das Zeichen sichtbar gemacht wie heute). Nr 1 trägt Links auf `vscode://file/w/demo`, `vscode://file/w/fab`, `vscode://file/w/wt/demo/karte-7`, `vscode://file/w/fab/ablage/plan-7` und `vscode://file/w/fab/ablage/plan-7/auftrag.md` (Punkt am Ende nicht im Pfad). In Node liefert `markdownInline` ohne Option `pfade` für alle bestehenden Tests dasselbe HTML, und die Beschreibung einer Karte mit „/w/demo/a.js“ trägt keinen Link.
- [ ] **AK 4 Pfadfeld im Aufruf:** Gegeben T14, dann ist im aufgeklappten Aufruf von Nr 2, Nr 4, Nr 6 und Nr 12 genau das Pfadfeld ein Link mit dem `href` des Rechenbeispiels (Nr 12: `vscode://file/w/demo/n.ipynb`). Nr 8 (`command`), Nr 10 (`path`: ‹demo›/src) und Nr 14 tragen keinen Link. In Node ergibt ein Read ohne `offset` einen Link ohne Zeile und ein Edit mit dem Ergebnis „The file /w/x.js has been updated successfully.“ einen Link ohne Zeile; ein Edit ohne Ergebnis ebenso.
- [ ] **AK 5 Pfad aus `<persisted-output>`:** Gegeben T14, dann steht in der Zeile von Nr 8 aufgeklappt die Marke von Nr 9 wörtlich wie im Rechenbeispiel, ‹Ablage›/tool-results/b1.txt ist ein Link auf `vscode://file/w/fab/ablage/plan-7/tool-results/b1.txt`, und die Vorschau „ok /w/demo/y.txt“ hat keinen Link und keine Marke. Die Zusammenfassung zeigt weiter „Von Claude Code gekürzt“ ohne `<a`. In Node ergibt ein `<persisted-output>` ohne die Form die Marke ohne Pfad und ohne Link.

### Sicherheit und Rückfälle

- [ ] **AK 6 Kodierung und Maskieren:** In Node gilt: Jedes `href` aus Pfaden ist gleich `vscodeLink` des rohen Pfads (`a&b` ergibt `%26`, nie `%26amp%3B`). Ein `file_path` und ein Pfad in einer Nachricht mit `"><img src=x onerror=alert(1)>` ergeben kein Element `img` und kein zusätzliches Attribut; `title` und das Attribut der Marke tragen den Text maskiert. Ein Pfad mit U+202E, mit U+001B oder mit dem Teil `..` (absolut `/w/demo/../etc/x.js` wie relativ) ergibt keinen Link. Ein Auftrag mit `Projekt: /w/<b>x</b>` ergibt kein Element `b`. In der ganzen Insel von T14 beginnt jedes `href` mit `vscode://file/`, `http://`, `https://` oder `mailto:`, und kein `summary` und kein Ergebnistext enthält ein `a`.
- [ ] **AK 7 Ohne erkannten Kopf:** Gegeben die Laufansicht von T14o, dann steht keine Marke in der Ansicht. „/w/demo/a.js“ in Nr 1 und das Pfadfeld von Nr 2 sind Links auf `vscode://file/w/demo/a.js` und stehen voll da; „web/a.js“ bleibt Code ohne Link.
- [ ] **AK 8 Breite, Themen, Zugänglichkeit:** Gegeben T14 mit allen Schritten aufgeklappt, dazu eine Nachricht mit einem absoluten Pfad aus 300 Zeichen ohne `/` nach dem ersten Teil. Dann gilt bei 320, 641, 980 und 1280 px, hell und dunkel, an Dokument, Bildlaufbehälter und jedem Block mit Link oder Marke: `scrollWidth ≤ clientWidth`. Link- und Markentext haben nach `getComputedStyle(color)` gegen ihren tatsächlichen Hintergrund ≥ 4,5:1. Jeder Link ist per Tab erreichbar, sein Fokusring ist ≥ 2 px und ≥ 3:1, und Enter folgt dem `href` (geprüft am Ereignis, ohne VS Code). Es gibt kein eigenes Tooltip-Element; der volle Pfad steht im `title`.
- [ ] **AK 9 Rückfälle:** In Node gilt: Ein Read mit 64 KiB + 1 Byte im Aufruf steht als `pre` ohne Link und ohne Marke. Mit den Wurzeln von T14 zeigt die Zusammenfassung eines Bash-Aufrufs `{"command":"echo <185 × a> /w/wt/demo/karte-7/web/a.js"}` `echo `, 185 × `a`, ` /w/wt/dem` (200 Zeichen des Rohtexts) und das „…“ von kanbanD, ohne Marke. `laengsteListe` zeigt einen Write-Schritt ohne Absicht mit `file_path` `/w/fab/ablage/plan-7/notiz.md` als „Write /w/fab/ablage/plan-7/notiz.md“, voll und ohne Marke (FA 7).

## Betroffene Verzeichnisstruktur

- `web/lauf-satz.js`: `pfadMarken`, `pfadLinkHtml`; `aufrufSatz` und `markeHtml` setzen Link und Marke ein (N4 Punkt 1). Rein, in Browser und Node.
- `web/markdown.js`: Option `pfade` an `markdownInline`/`markdownHtml` (Vorgabe aus).
- `web/lauf.js`: liest die Wurzeln einmal je Lesen aus dem Auftrag, gibt sie an Nachricht, Aufruf und Zusammenfassung (`markdownTeilHtml`, `schrittHtml`, `kurzTextHtml`). Lesen und Auswerten bleiben hier.
- `web/review-uebersicht.js`: `vscodeLink` wird nur genutzt, nicht geändert (gegebenenfalls exportiert).
- `web/kd-app.css`: `.lv-mk`, `.lv-pfad` nach D0009, nur Tokens aus `web/kd-tokens.css`. Die Zeichnung nennt `--kd-wbs-*`/`--tk-*` an anderen Regeln; die gibt es im Stil nicht (R00240 FA 3, 4, 7: `--kd-status-*`, `--kd-tk-*`).
- `web/app.js`: keine Änderung.
- Tests: `e2e/einheit/lauf-pfade.test.js` (Node), `e2e/tests/r00242-laufansicht-pfade.spec.js` mit Daten `e2e/tests/laufansicht-t14.js`.

## Technische Überlegungen

### Ablauf (Vorplanung — welche Bubbles es am Ende werden, entscheidet der entwickler)

1. **Proben zuerst** (B1264): T14, T14o und AK 1–9 als rote Spezifikation.
2. **Reine Bausteine**: Wurzeln (B1265), dann Link und Marke (B1266).
3. **Einbau**, parallel: Nachrichten über `markdownInline` (B1267), Aufruf, `<persisted-output>` und Zusammenfassung (B1268).
4. **Messen** (B1269), dann **Probe im echten Programm, Mutanten, Gate** (B1270).

### Grobentwurf

- `pfadMarken(auftragText) → [{wurzel, marke}]`, `pfadKurz(pfad, wurzeln) → {marke, wurzel, rest} | null`.
- `pfadLinkHtml(pfad, zeile, wurzeln, mitLink, esc) → html`: `mitLink` aus nur dann, wenn die Stelle keinen Link tragen darf (Befehl, andere Felder, Zusammenfassung). Erlaubnis wie `linkErlaubt` in R00236 (Sichtbarmachen ändert nichts) plus kein Teil `..`.
- Marke: `<span class="lv-mk" data-marke="‹…›"><span class="vh">/voller/anfang</span></span>/rest`; im CSS `content: attr(data-marke) / ""`, damit der Markentext nicht in den zugänglichen Namen geht (Annahme des planers, im Bau zu proben: Chromium nimmt erzeugten Inhalt sonst in den Namen auf).
- Die Pfadsuche in Nachrichten läuft auf dem rohen Text vor `sichtbarText` und vor `esc`; der Link entsteht aus dem rohen Pfad, das Sichtbare aus dem maskierten.

### Hinweise

- Bestandstests, die einen Pfad als Text in Nachricht, Auftrag oder Marke „gekürzt“ erwarten (R00221, R00234, R00240), ändern ihre Erwartung nur dort, wo Link oder Marke an die Stelle des Textes treten. Die Liste steht im Bericht des entwicklers.
- Der Auftrag dieser Karte und D0009 nennen für die Marken „PO Z. 597“; der Wortlaut steht in Z. 596 (Z. 597 ist die Kürzung für Write und Diffs).

## Tests

Nach `~/.claude/skills/test-pyramide/SKILL.md`, Test zuerst je Bubble.

- **Unit (Node):** Proben aus ADR-0041 N4 „Durchsetzung“ zu `pfadMarken` und Pfad-Links wörtlich, dazu AK 1, 3, 4, 6, 9 und die Rechenbeispiele.
- **E2E (Chromium, headless):** AK 2–5, 7, 8 an T14 und T14o. Wörtlich aus N4: Edit mit Link auf `vscode://file…`; `<persisted-output>` mit Marke und Link; `textContent` der Insel enthält den vollen Pfad hinter einer Marke.
- **Mutanten** (Mindestmenge, weitere wählt der entwickler): m1 Link nur mit `esc` statt `vscodeLink` (AK 3, 6 rot); m2 Link auch aus `command` (AK 4); m3 Link auch im Ergebnistext (AK 2, 6); m4 Prüfung „Sichtbarmachen ändert den Pfad“ weg (AK 6); m5 Treffer ohne Grenze `/` (AK 1); m6 kürzester statt längster Treffer (AK 1); m7 Edit-Sprung aus der ersten Zahl statt aus `cat -n` (AK 4); m8 Option `pfade` als Vorgabe an (AK 3). Jeder in eigener Kopie, je von einem benannten Test getötet.
- **Regression:** Die Tests von R00221, R00234, R00236, R00237–R00240 bleiben grün, mit geänderter Erwartung nur nach „Hinweise“.

## Abhängigkeiten

- Abhängig von: [R00240](R00240-laufansicht-satz-der-eintraege.md) (I0230, Karte #261: `web/lauf-satz.js`, Marke „gekürzt“ mit dem Pfad an einer Stelle; `braucht:261`). [R00236](R00236-review-seite-pfad-vscode-und-patch-je-datei.md) (`vscodeLink`, Erlaubnis). [R00234](R00234-laufansicht-ergebnis-und-dauer.md) (Auftrag als erste Nachricht von `mensch`).
- Blockiert: nichts.

## Offene Fragen

Keine, die den Bau aufhält. An den product-owner, je mit Empfehlung des planers (bis zur Antwort gilt die Empfehlung, so steht sie in den FA):

1. **Marken auch in „Längste“ und „Teuerste Schritte“?** N4 nennt die Listen nicht. Empfehlung: in dieser Karte nein (FA 7, AK 9), weil die Listen den Befehl schon gekürzt und gedämpft zeigen; eine spätere Karte kann sie nachziehen.
2. **Kein Link bei `..` auch für absolute Pfade?** N4 verbietet `..` nur für relative. Empfehlung: ja (FA 6), weil `/w/demo/../etc/x.js` sichtbar unter ‹demo› stünde, aber woanders hinführt.

## Manuelle Vorbereitungstätigkeiten

- Bauen erst, wenn #261 auf `main` ist; der Zweig `karte/264` wird vorher auf `main` gehoben (dort liegt inzwischen I0231/R00241, Konflikt nur in der WBS-Tabelle: eigene Zeilen aus der Karte, alles andere von `main`).

## Manuelle Nachbereitungstätigkeiten

- Modell A00009 (Laufansicht) um `pfadMarken`/`pfadLinkHtml` und die Option `pfade` nachführen.

## Warum löst diese Anforderung das Problem? (Pflicht)

Auslöser sind die Wünsche des Betreibers an #261: „Dateipfad und Zeile ein Link“ und kurze Marken für Projekt, Worktree und Ablage. Heute steht jeder Pfad voll da, rund 60 Zeichen Anfang, bevor der Dateiname kommt, und nichts führt zur Datei. Liest kanbanD die drei Wurzeln aus dem Kopf des Auftrags, kann es jeden Pfad darunter als ‹Worktree #7›/web/a.js zeigen; der Mensch sieht auf einen Blick, in welchem Ordner gearbeitet wurde, und der volle Pfad bleibt für Kopie, Suche und Bildschirmleser. Ist das Pfadfeld von Read und Edit ein Link an die gelesene bzw. geänderte Zeile, führt ein Klick genau an die Stelle, die der Agent sah. Weil Links nur aus dem Pfadfeld, aus Nachrichten und aus der Angabe von Claude Code entstehen, nie aus Befehl und Ausgabe, bleibt fremder Text der Werkzeuge Text (PO Z. 494, 593), und jeder Link geht über dieselbe geprüfte Kodierung wie auf der Review-Seite.

## Missing-Docs

- Die Form des Auftragskopfs (`Projekt:`, `Arbeitsort:`, `Ablage:`) ist eine Form der Factory, keine Angabe des Formats (N4 M1). Ändert die Factory sie, fallen die Marken weg und die Pfade stehen voll (AK 7).

## Notizen

- **Verworfene Alternativen** (N4 „Optionen“): M2 (eigenes Feld im Format) verworfen, weil Format und Factory sich zugleich ändern müssten und alte Transkripte keine Marken hätten. M3 (Wurzeln aus dem Board) verworfen, weil kanbanD Worktree und Ablage nicht kennt.
- **Tooltip**: `title` statt eines eigenen Tooltip-Elements, weil der Browser ihn bei grobem Zeiger nicht als Fläche zeigt (PO Z. 607) und nichts verdeckt; D0009 zeichnet den Tooltip zur Anschauung als Fläche.
- **Neun Kriterien** (Schlank arbeiten A). Weitere Grenzfälle der Pfaderkennung gehören dem entwickler.
