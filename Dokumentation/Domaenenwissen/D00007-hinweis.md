---
id: D00007
name: Hinweis
status: Aktiv
sprache: de
verwandt: [D00001, D00004, D00008]
gebiet: Oberfläche
synonyme: [Toast]
code: [S.ui.hinweis, vHinweis, vHinweisInhalt, vHinweisAnker, hinweisDialog, dialogMitHinweis, hinweisEinpassen, .toast, .toast.warn, .hinweis-anker, "--kd-hinweis-rand"]
---

# Hinweis

## Definition

Ein Hinweis ist die kurze Meldung der Oberfläche, die nach einer Aktion sagt, was geschehen ist („#2 von „Entwicklung“ genommen“), und dafür, wenn möglich, das [Rückgängig](D00008-rueckgaengig.md) anbietet. Es gibt genau einen Hinweis zur Zeit; ein neuer ersetzt den alten, und nach 8 s verschwindet er von selbst (bestätigt, R00031, R00112 FA 3). Er steht im obersten Fenster mit Hinweis-Anker, sonst unten in der Mitte über allem (bestätigt, R00112 FA 17–18, ADR-0017 Regel 5 mit N1).

## ELI14

Der kleine dunkle Streifen unten, der kurz sagt „hab ich gemacht“ und manchmal einen Knopf „rückgängig“ dazu hat.

## Bestandteile

- Text: was die Aktion bewirkt hat, mit dem Fachbegriff der Sache (Nummer, Spalte, Teilaufgabe, Zeit, Anhang)
- optional der Knopf „rückgängig“ (Tooltip „Strg+Z“), nur wenn der Hinweis eine Gegenaktion gemerkt hat
- Lebensdauer: 8 s ab dem Erscheinen; ein Hinweis mit Warnungen 20 s
- Lage: im obersten modalen Fenster mit Hinweis-Anker (Aufgabenfenster, „Neue Aufgabe“, „Defekte Datei“) als Überlagerung 8 px über dem Fuß; sonst unten in der Mitte, 40 px über dem Rand
- Form: bricht um, höchstens `min(720px, 100vw − 32px)` breit; der Knopf wird nie abgeschnitten
- Variante mit Warnungen: Zugwarnungen der WIP-Grenze mit „!“ und Links in die WBS (R00096, R00107 „Warnungs-Toast“)

## Beziehungen

- höchstens einer zur Zeit, je Tab
- trägt höchstens ein [Rückgängig](D00008-rueckgaengig.md), das der zuletzt gemeldeten Aktion
- liegt bei offenem [Aufgabenfenster](D00001-aufgabenfenster.md) in dessen Hinweis-Anker zwischen Körper und Fuß, also innerhalb von `aria-modal`
- im [schmalen Layout](D00004-schmales-layout.md) bricht er um, statt quer zu scrollen (R00112 AK 11)

## Wechselwirkungen

- [Rückgängig](D00008-rueckgaengig.md) leert den Hinweis vor dem Senden und ersetzt ihn danach durch einen Erfolgshinweis ohne Knopf oder, ohne Aufgabenfenster obenauf, durch „nicht rückgängig: …“
- [Aufgabenfenster](D00001-aufgabenfenster.md) hält, solange der Hinweis steht, den unteren Rand des Körpers frei, damit ein fokussiertes Feld nie hinter ihm liegt (`scroll-padding-bottom`, PO Z. 162 Auflage 1)

## Vorkommen in Anforderungen

- [R00031](../../Anforderungen/R00031-rueckgaengig.md) — führt den Hinweis mit „rückgängig“ und die 8 s ein (Zeilen 11, 21–25)
- [R00017](../../Anforderungen/R00017-archivieren-und-zurueckholen.md) — Hinweis „#n archiviert · rückgängig“ (Zeile 26)
- [R00096](../../Anforderungen/R00096-wip-grenze-fuer-agenten-durchsetzen.md) — Zugwarnungen als „Toast“ (Zeile 123)
- [R00107](../../Anforderungen/R00107-kontrast-farbrollen-in-paaren.md) — Kontrast des Toasts und des Warnungs-Toasts (Zeilen 204–205, 219–220)
- [R00112](../../Anforderungen/R00112-entfernen-rueckgaengig-und-sichtbare-entfernen-knoepfe.md) — Hinweis im obersten Fenster, Umbruch, Texte der vier entfernenden Aktionen (FA 1, 3, 7, 17–19; AK 7, 11)

## Notizen / Quellen

- Definition nach R00031:11, 25 und R00112 FA 3, 17–19 — bestätigt; Lage im Fenster nach ADR-0017 Regel 5 und Nachtrag N1, Überlagerung über dem Fuß nach PO-Entscheidung `AI-Team/po-entscheidungen.md` Z. 163, Rand nach Z. 164.
- Code (beobachtet, Stand 6ab1dd6): Zustand `S.ui.hinweis = { text, undo?, feld?, warnungen?, dauer?, at }` (`web/app.js`, z. B. :1370, :1425); Ablauf im Sekundentakt `jetzt - at > (dauer || 8000)` (`web/app.js:2457`); gezeichnet von `vHinweisInhalt()` als `<div class="toast" role="status">`, mit Warnungen als `.toast.warn` mit `role="alert"` (`web/ansicht.js:762–765`); Ort aus `hinweisDialog()` / `dialogMitHinweis()` (`web/ansicht.js:738–751`), Anker `.hinweis-anker` (`web/kd-app.css:493–495`); Rand `--kd-hinweis-rand` (`web/kd-tokens.css:12–13`).
- Abweichung beobachtet: R00112 FA 3 sagt „8 s ab dem Klick“; der Code zählt ab dem Setzen des Hinweises, also nach der Antwort des Servers. Fachlich ohne Folge, solange die Antwort schnell ist.
- Oberfläche (de): der Begriff selbst steht nicht auf dem Schirm; sichtbar sind der Text und der Knopf „rückgängig“. Bildschirmleser lesen ihn als Status vor (`role="status"`), den Warnungshinweis als Alarm.
- Erlaubtes Synonym „Toast“ in Anforderungen und ADRs zur Gestaltung (R00107, ADR-0017) und als CSS-Klasse; Leitform ist „Hinweis“ (R00031, R00112, `S.ui.hinweis`). Material 3 nennt das Muster „Snackbar“ (so zitiert in PO Z. 163, 164; nicht selbst geöffnet) — Referenz, kein Wort des Projekts.
- Nicht zu verwechseln mit der **Meldung im Fuß** des Aufgabenfensters (`fensterMelden`, `S.ui.fensterFehler`, `role="alert"`): sie ist der Ort für Fehler im Fenster (ADR-0015 Regel 3); ein Hinweis ist nie Fehlerort im Fenster (ADR-0017 Regel 5). Ebenso nicht mit dem Speicherhinweis „gespeichert hh:mm“ und dem Tastenhinweis (`.tastenhinweis`) im Fuß.
- Nicht verwenden: „Hinweis“ für andere Dinge — in älteren Anforderungen meint das Wort auch den Tooltip (R00105:113, 186), den Erklärtext im Ich-Menü (`#ich-hinweis`, R00106:72), die Hinweisfläche und -leiste defekter Dateien (R00025:22–25) und im Code `.kost-hinweis`, `#phasen-hinweis`. Diese Stellen sind Altbestand und geduldet; neu geschrieben heißt „Hinweis“ nur noch die Meldung nach einer Aktion.
- Offen: ob die Meldung im Fuß einen eigenen Eintrag bekommt („Meldung im Fuß“ oder „Fußmeldung“, beides im Gebrauch, R00112 AK 11, PO Z. 162).
