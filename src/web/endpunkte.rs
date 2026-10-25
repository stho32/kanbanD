//! Die eine Beschreibung der API — Quelle für `/api` und `/api/endpunkte`.

use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize, utoipa::ToSchema)]
pub struct Endpunkt {
    pub methode: &'static str,
    pub pfad: &'static str,
    /// braucht `X-KanbanD-Wer`
    pub wer: bool,
    pub thema: &'static str,
    pub zweck: &'static str,
}

const fn e(methode: &'static str, pfad: &'static str, wer: bool, thema: &'static str, zweck: &'static str) -> Endpunkt {
    Endpunkt { methode, pfad, wer, thema, zweck }
}

pub const ENDPUNKTE: &[Endpunkt] = &[
    e("GET", "/api", false, "API", "diese Beschreibung als Seite; mit Accept: application/json 303 auf /api/openapi.json"),
    e("GET", "/api/openapi.json", false, "API", "die vollständige Beschreibung als OpenAPI 3.1 — Felder, erlaubte Werte, Formate und Fehlerformen"),
    e("GET", "/api/endpunkte", false, "API", "diese Liste maschinenlesbar {methode, pfad, wer, thema, zweck}"),
    e("GET", "/api/zustand", false, "Ordner", "Ordner, eingerichtet?, Einstellungen, Boards, defekte Dateien"),
    e("POST", "/api/einrichten", false, "Ordner", "erster Start {ich, agenten, board, spalten, quellen}"),
    e("GET", "/api/wer", true, "Ordner", "die Person zum Header X-KanbanD-Wer"),
    e("GET", "/api/einstellungen", false, "Ordner", "Personen, Klassen, Signale und Quellen in der Form, die PUT annimmt"),
    e("GET", "/api/personen", false, "Personen", "{personen: [{kuerzel, name, art: human|agent, aktiv}]}"),
    e("POST", "/api/personen", true, "Personen", "Person anlegen {kuerzel, name, art: human|agent, aktiv?} → 201 mit der Person; Kürzel 1–8 Kleinbuchstaben oder Ziffern, Name nicht leer; Kürzel vorhanden → 409; ein Commit der kanbanD.md"),
    e("PATCH", "/api/personen/{kuerzel}", true, "Personen", "Person ändern {name?, art?, aktiv?} → die Person; andere Personen, Klassen und Signale bleiben; unbekannt → 404; ohne Änderung kein Commit"),
    e("DELETE", "/api/personen/{kuerzel}", true, "Personen", "Person stilllegen (aktiv: false) — Personen werden nie entfernt; Antwort die Person"),
    e("PUT", "/api/einstellungen", true, "Ordner", "Personen, Klassen, Signale, Quellen und Register der Anwendungen ersetzen (Personen nur stilllegen); signale: [{schluessel, bezeichnung, farbe}] — Schlüssel wie Klassen, „due“ vergeben"),
    e("GET", "/api/anwendungen", false, "Ordner", "Register der Anwendungen {kürzel: {name, wbs, anforderungen, erreichbar: {wbs, anforderungen}}}"),
    e("GET", "/api/ereignisse", false, "Ordner", "Server-Sent Events {pfade, extern} je Änderung im Ordner; alle 15 s `event: herzschlag` mit `{}` — still länger als 40 s heißt: neu verbinden"),
    e("GET", "/api/boards", false, "Boards", "alle Boards mit Spalten und Aufgabennummern — ohne archivierte Karten, mit ?archivierte=ja mit ihnen"),
    e("POST", "/api/boards", true, "Boards", "Board anlegen {titel, spalten?}"),
    e("GET", "/api/boards/{slug}", false, "Boards", "ein Board {slug, titel, spalten: [{name, grenze, aufgaben (ohne archivierte; ?archivierte=ja nimmt sie auf — die Board-Datei behält ihren Platz), phase, pruefungen: column-checks, notiz: column-notes, farbe: column-colors}], termine (je {name, datum, farbe, linie, staerke, ziel}), anwendungen, start: Projektstart JJJJ-MM-TT | null, fieber: {puffer, perzentil, woche, gelb: [bei 0 %, bei 100 %], rot, zielspalte, aufloesung}, berichtsfilter: {zeitraum, von, bis, ohneFarben, ohneSpalten, personen, labels, messbasisTage}, phasen: null | {anwendung, folge: [{nr, name, eingebettet, gleich}], hinweise}, hinweise: [unbekannte Prüfung …]}; ist es an eine Anwendung gebunden und fehlt einer Phase der Hauptspur die Spalte, legt kanbanD sie zuerst an (ein Commit „Phasen-Spalten von „<Board>“ ergänzt: …“)"),
    e("PUT", "/api/boards/{slug}/spalten", true, "Boards", "Spalten setzen [{name, alt?, grenze?, pruefungen?, notiz?, farbe?}] — fehlende Felder behalten den Wert der alten Spalte, leerer Text entfernt notiz/farbe; farbe als #rrggbb, sonst 400"),
    e("PUT", "/api/boards/{slug}/termine", true, "Boards", "Termine setzen [{name, datum, farbe, linie?: durchgehend|gestrichelt|gepunktet, staerke?: fein|normal|fett, ziel?: true — höchstens einer, Zieltermin des Fever Charts}]"),
    e("PUT", "/api/boards/{slug}/berichtsfilter", true, "Boards", "Berichtsfilter des Boards setzen {zeitraum: heute|gestern|woche|vorwoche|monat|vormonat|30|90|jahr|alles|eigen, von, bis (bei eigen), ohneFarben: [Klasse | \"\" = ohne], ohneSpalten, personen, labels, messbasisTage: 1–3650 (Standard 90, letzte N Tage für die Prognose)} — gilt für alle Berichte und alle, die das Board ansehen"),
    e("PUT", "/api/boards/{slug}/start", true, "Boards", "„Rechnen ab“ (Projektstart) setzen {start: \"JJJJ-MM-TT\" | null} — ab diesem Tag rechnen Burndown, Durchlaufzeit, Wie lange noch und Fever Chart; null = erste Aufgabe auf dem Board"),
    e("PUT", "/api/boards/{slug}/fieber", true, "Boards", "Fever Chart einstellen {puffer: Tage | null, perzentil: 50|70|85|95, woche: 5|7, gelb: [bei 0 %, bei 100 %], rot: […]}"),
    e("GET", "/api/boards/{slug}/fieber/cache", false, "Boards", "Cache des Fever Charts {abschnitte: [{schluessel, tage: [{datum, erledigt, umfang, ende7: [P50, P70, P85, P95], ende5: […]}]}]}"),
    e("POST", "/api/boards/{slug}/fieber/cache", false, "Boards", "Cache ergänzen {schluessel, tage} — nur fehlende Tage vor heute, ein Commit unter „kanbanD“, ohne X-KanbanD-Wer"),
    e("DELETE", "/api/boards/{slug}/fieber/cache", false, "Boards", "Cache verwerfen — ein Commit unter „kanbanD“"),
    e("PUT", "/api/boards/{slug}/anwendungen", true, "Boards", "Bindung setzen [kürzel…] registrierter Anwendungen (applications); [] löst das Board (reines Kanban, keine Phasen, nachgetragene Spalten bleiben), ein Commit „Anwendungen von „<Board>“: …“; unbekanntes Kürzel → 400"),
    e("POST", "/api/boards/{slug}/bewegen", true, "Boards", "Aufgabe bewegen {nummer, spalte, index?} — ohne index oben in die Zielspalte (auch beim Umsortieren), index zu groß → ans Ende; ändert nur die Board-Datei; Antwort {bewegt, warnungen: [{pruefung, text, knoten: [kd:I0048], details: [kd:I0048 rot | Knoten fehlt | WBS nicht erreichbar]}]} — Prüfungen (column-checks) der verlassenen Spalte bei einem Zug nach rechts (Rang der Phase, ohne Phasen Spaltenindex); der Zug wird immer ausgeführt und committet"),
    e("POST", "/api/boards/{slug}/bewegen-mehrere", true, "Boards", "mehrere Aufgaben bewegen {ziele: [{nummer, spalte, index?}]} — alle heraus, dann der Reihe nach an index ihrer Spalte, ohne index oben in Anfragereihenfolge (die erste genannte ganz oben); ein Commit; Antwort wie bewegen"),
    e("POST", "/api/boards/{slug}/aufgaben/mehrere", true, "Boards", "mehrere Aufgaben auf das Board legen {nummern, spalte?} — ein Commit, schon liegende bleiben; Antwort: gelegte Nummern"),
    e("POST", "/api/boards/{slug}/aufgaben", true, "Boards", "Aufgabe auf das Board legen {nummer, spalte?}"),
    e("DELETE", "/api/boards/{slug}/aufgaben/{nr}", true, "Boards", "Aufgabe vom Board nehmen"),
    e("GET", "/api/aufgaben", false, "Aufgaben", "alle Aufgaben und defekte Dateien — Filter: board, spalte (braucht board), klasse, signal (auch due), zustaendig, reserviert=ja|nein|<instanz>, archivierte=ja|nein|nur; verschiedene Parameter UND, derselbe mehrfach ODER (?klasse=a&klasse=b); ohne Parameter alle, auch archivierte, sobald einer genannt ist gilt archivierte=nein; unbekannter Parameter → 400"),
    e("POST", "/api/aufgaben", true, "Aufgaben", "anlegen {titel, board?, spalte?}"),
    e("POST", "/api/aufgaben/mehrere", true, "Aufgaben", "mehrere anlegen {titel: [...], board?, spalte?} — ein Commit"),
    e("POST", "/api/aufgaben/archivieren", true, "Aufgaben", "mehrere archivieren {nummern} — ein Commit"),
    e("PATCH", "/api/aufgaben/mehrere", true, "Aufgaben", "mehrere ändern {aenderungen: [{nummer, …Felder wie PATCH /api/aufgaben/{nr}}]} — ein Commit, ein ungültiges Feld ändert nichts"),
    e("POST", "/api/aufgaben/zurueckholen", true, "Aufgaben", "mehrere zurückholen {nummern} — ein Commit"),
    e("GET", "/api/aufgaben/{nr}", false, "Aufgaben", "die Aufgabe direkt, dazu pfad und text der Datei auf oberster Ebene (423 bei defekter Datei: {fehler, pfad, text})"),
    e("PATCH", "/api/aufgaben/{nr}", true, "Aufgaben", "ändern {titel?, beschreibung?, klasse?, zustaendige?, labels?, faellig?, herkunft?, signale?: [Schlüssel], phasen?: {uebersprungen: [Phase]}, reporting?: {burndown?: bool | null, forecast?: bool | null}} — phasen.uebersprungen (auch skipped) ersetzt phases.skipped: diese Phasen entfallen für die Aufgabe; reporting setzt, ob die Aufgabe im Burndown bzw. in Wie lange noch zählt (false nimmt sie aus, null entfernt den Schlüssel: Standard, sie zählt), Commit „#n geändert: Zählen in Berichten“"),
    e("PUT", "/api/aufgaben/{nr}/signale/{signal}", true, "Aufgaben", "Signal setzen — hebt die Aufgabe hervor (pulsierende Fackel auf der Karte, Zahl im Spaltenkopf); nur in kanbanD.md eingerichtete Signale (signals), sonst 400; schon gesetzt: kein Commit; Commit „#n Signal „<Bedeutung>“ gesetzt“ → Aufgabe"),
    e("DELETE", "/api/aufgaben/{nr}/signale/{signal}", true, "Aufgaben", "Signal zurücknehmen; nicht gesetzt: kein Commit; Commit „#n Signal „<Bedeutung>“ zurückgenommen“ → Aufgabe. Das Signal „due“ (Fälligkeit heute oder überschritten) wird gerechnet und folgt dem Feld faellig"),
    e("POST", "/api/aufgaben/{nr}/teilaufgaben", true, "Aufgaben", "Teilaufgabe anlegen {text}"),
    e("POST", "/api/aufgaben/{nr}/teilaufgaben/mehrere", true, "Aufgaben", "mehrere Teilaufgaben anlegen {texte: [...]} — ein Commit"),
    e("PATCH", "/api/aufgaben/{nr}/teilaufgaben/{i}", true, "Aufgaben", "Teilaufgabe ändern {erledigt?, text?, position?} — position verschiebt an diese Stelle (0-basiert, außerhalb = ans Ende)"),
    e("DELETE", "/api/aufgaben/{nr}/teilaufgaben/{i}", true, "Aufgaben", "Teilaufgabe entfernen"),
    e("POST", "/api/aufgaben/{nr}/kommentare", true, "Aufgaben", "kommentieren {text}"),
    e("PATCH", "/api/aufgaben/{nr}/wbs-effects", true, "Aufgaben", "Wirkung auf die WBS vermerken, ohne sie auszuführen {application, action: create|rework|remove, node?, parent?, level?, name?, done_criterion?} → Aufgabe; executed: false, die WBS bleibt; geprüft gegen die WBS (Knoten fehlt, Datei defekt oder nicht erreichbar 409, falsche Angaben 400); dieselbe Wirkung zweimal: kein Commit"),
    e("GET", "/api/aufgaben/{nr}/wbs-effects", false, "Aufgaben", "Wirkungen mit Eintritt [{i, application, action, node?, …, executed, eingetreten: true|false|null, erfuellt: true|false|null}] — erfuellt (Zielzustand): create/rework Knoten gerechnet gruen, remove verworfen oder fehlt; eingetreten — create: Knoten steht und ist nicht verworfen; remove: Knoten verworfen oder fehlt; rework: executed gesetzt (fehlt = vor R00071, gilt als eingetreten); null: WBS nicht lesbar"),
    e("POST", "/api/aufgaben/{nr}/wbs-effects/{i}/eintritt", true, "Aufgaben", "Eintritt schalten {an: true|false} → Aufgabe; an: create legt an (ID wird eingetragen), rework setzt den Teilbaum rot, remove verwirft; aus: create verwirft den Knoten, remove hebt das Verwerfen auf (Blätter rot), rework nimmt nur den Vermerk zurück; schon so: keine Änderung; die WBS ohne Commit, ein Commit im Board-Repository"),
    e("DELETE", "/api/aufgaben/{nr}/wbs-effects/{i}", true, "Aufgaben", "Wirkung aus der Aufgabe entfernen — die WBS bleibt, wie sie ist"),
    e("POST", "/api/aufgaben/{nr}/archivieren", true, "Aufgaben", "archivieren (stoppt laufende Timer, entfernt die Reservierung)"),
    e("POST", "/api/aufgaben/{nr}/durchlaeufe", true, "Aufgaben", "Durchlauf eintragen {phase (1–40 Zeichen), ergebnis: bestanden|befund|entfaellt, dauer?, text?, wer?} — jetzt mit Versatz, wer wie beim Zeitnachtrag; Zeile im Block kanbanD-runs und Kommentar „<Phase> <ergebnis> (<wer>, <dauer>): <text>“ in einem Commit; die Aufgabe trägt durchlaeufe: [{zeitpunkt, phase, ergebnis, wer, dauer_minuten, text}]"),
    e("POST", "/api/aufgaben/{nr}/reservierung", true, "Reservierungen", "reservieren für Wer und Instanz (Header X-KanbanD-Instanz oder Feld instanz, 1–64 Zeichen A–Z a–z 0–9 . _ -) — 24 h ab jetzt; eigene Instanz verlängert; fremde gültige → 409 mit Inhaber; Antwort: die Aufgabe mit reservierung {wer, instanz, seit}. Eine fremde Reservierung sperrt nur Reservieren und Ziehen"),
    e("POST", "/api/boards/{slug}/ziehen", true, "Reservierungen", "nächste Karte ziehen {von, nach?, instanz?} — braucht Wer und Instanz; atomar in einem Commit: die oberste Karte in von ohne fremde gültige Reservierung (eigene zählt als frei, archivierte nicht) wird für Wer/Instanz reserviert, Wer zuständig und oben in nach einsortiert (ohne nach: die Spalte rechts von von; letzte Spalte → 400); Prüfungen wie bei bewegen; Antwort {aufgabe, von, nach, warnungen}; keine freie Karte → 404 {fehler: \"nichts zu ziehen\"}"),
    e("DELETE", "/api/aufgaben/{nr}/reservierung", true, "Reservierungen", "freigeben — die eigene Instanz, oder ein Mensch jede; fremde Instanz eines Agenten → 409; keine Reservierung → 404"),
    e("POST", "/api/aufgaben/{nr}/zurueckholen", true, "Aufgaben", "aus dem Archiv zurückholen"),
    e("GET", "/api/aufgaben/{nr}/anhaenge", false, "Aufgaben", "Anhänge auflisten"),
    e("POST", "/api/aufgaben/{nr}/anhaenge", true, "Aufgaben", "Anhang hochladen (multipart, Feld datei)"),
    e("GET", "/api/aufgaben/{nr}/anhaenge/{name}", false, "Aufgaben", "Anhang laden"),
    e("DELETE", "/api/aufgaben/{nr}/anhaenge/{name}", true, "Aufgaben", "Anhang entfernen"),
    e("GET", "/api/herkunft", false, "Aufgaben", "WBS-Knoten und Anforderungen der verwendeten Herkunft, je Schreibweise mit anwendung und schluessel"),
    e("GET", "/api/wbs/{kuerzel}", false, "WBS", "WBS einer registrierten Anwendung {knoten: [{id, ebene, eltern, name, status, gerechnet, erreicht, …, zeile}], stand: {gruen, gelb, rot, slices, aktiv, pfad, laufend}, nicht_committet, anforderungen}; 404 unbekannt, 409 nicht erreichbar"),
    e("POST", "/api/wbs/{kuerzel}/knoten", true, "WBS", "Knoten anlegen {ebene, eltern, name, fertig_kriterium, eingabe_ausgabe?, aufwand?, ausbaustufe?, braucht?, requirement?, notiz?} → 201 {id}; nächste freie ID auch aus der Git-Historie der WBS, Zeile rot nach dem letzten Nachfahren der Eltern, kein Commit; 400 bei fehlendem Pflichtfeld, falscher Eltern-Ebene oder Aufwand unter 0,4h"),
    e("PATCH", "/api/wbs/{kuerzel}/knoten/{id}", true, "WBS", "Status eines Blatts setzen {status: rot|gelb|gruen} → {geaendert: [ids]}; Vorfahren gerechnet, zuletzt gesetzt, kein Commit im Arbeits-Repository; 409 bei Kindern oder defekter Datei, 400 bei option/ausbau/verworfen/bestehend"),
    e("POST", "/api/wbs/{kuerzel}/knoten/{id}/verwerfen", true, "WBS", "Knoten verwerfen {grund?} → {geaendert: [ids]}; verworfen an Knoten und zählenden Nachfahren, keine Zeile gelöscht, Grund in der Notiz, kein Commit; 409 schon verworfen oder Application"),
    e("POST", "/api/aufgaben/{nr}/timer/start", true, "Zeiten", "eigenen Timer starten"),
    e("POST", "/api/aufgaben/{nr}/timer/stop", true, "Zeiten", "Timer stoppen {wer?} — auch fremde; lief er (seit dem Start über diesen Server) unter 20 s, wird die Zeile verworfen statt abgeschlossen"),
    e("POST", "/api/aufgaben/{nr}/zeiten", true, "Zeiten", "Zeit nachtragen — entweder {dauer} (endet jetzt) oder {beginn, ende} (Formen wie bei der Korrektur; Ende nach Beginn, nicht in der Zukunft); optional wer: bucht für diese Person, Autor bleibt die handelnde; gleiche Kennung wer@beginn schon vorhanden → 409"),
    e("PATCH", "/api/aufgaben/{nr}/zeiten/{kennung}", true, "Zeiten", "Zeiteintrag über seine Kennung wer@JJJJ-MM-TTTHH:MM±HH:MM (Feld kennung jedes Zeiteintrags, URL-kodiert) korrigieren {beginn?, ende?}; ein neuer Beginn gibt eine neue Kennung — JJJJ-MM-TT HH:MM, optional ±HH:MM oder Z, auch ISO mit T; ohne Versatz als Ortszeit, gespeichert in Ortszeit mit Versatz"),
    e("DELETE", "/api/aufgaben/{nr}/zeiten/{kennung}", true, "Zeiten", "Zeiteintrag über seine Kennung löschen (nur beendete); unbekannte Kennung → 404"),
    e("GET", "/api/berichte/zeiten.csv", false, "Berichte", "alle Zeiteinträge als CSV"),
    e("GET", "/api/berichte/verlauf?board={slug}", false, "Berichte", "offene Aufgaben je Tag und Durchlaufzeiten aus Git"),
    e("GET", "/api/berichte/bewegungen?board={slug}", false, "Berichte", "je Aufgabe die Spaltenwechsel aus Git (Grundlage der Board-Berichte) {spalten: [Name in heutiger Reihenfolge, die letzte ist die Abschlussspalte], jetzt: JJJJ-MM-TT HH:MM, aufgaben: [{nummer, wechsel: [{zeitpunkt: JJJJ-MM-TT HH:MM, spalte: Name | null = vom Board genommen}], labels, uebersprungen: phases.skipped, reporting: {burndown?: false, forecast?: false} (nur gesetzte Schlüssel; fehlt einer, zählt die Aufgabe)}], phasen: null bei reinem Kanban | {anwendung, folge: [{nr, name, eingebettet, gleich}] (Hauptspur, ohne verworfen), spaltenphasen: {Spalte: Phase} (column-phases von heute, N:1)}} — eine Phase P ist durchlaufen, sobald die Aufgabe in einer Spalte einer späteren Phase oder in der Abschlussspalte liegt oder lag (erstes Erreichen zählt im Durchsatz, offen nach dem aktuellen Stand); gleich wie: mit der genannten Phase; eingebettet in im-pair: mit der Vorphase, wenn die Aufgabe das Label im-pair trägt; uebersprungen: nicht in Zähler, Nenner und Durchsatz der Phase; reporting.forecast false: nicht in Wie lange noch (Umfang, Nenner, Durchsatz, je Spalte und je Phase), reporting.burndown false: nicht im Burndown"),
];

fn esc(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// Die Seite `/api` — Gestaltung nach Artboard D0007, Werte aus dem Token-Sheet.
pub fn api_seite(adresse: &str) -> String {
    let mut zeilen = String::new();
    let mut thema = "";
    for e in ENDPUNKTE {
        if e.thema != thema {
            thema = e.thema;
            zeilen.push_str(&format!("<tr class=\"grp\"><td colspan=\"4\">{}</td></tr>", esc(&thema.to_uppercase())));
        }
        zeilen.push_str(&format!(
            "<tr><td class=\"mono\">{}</td><td class=\"mono\">{}</td><td>{}</td><td>{}</td></tr>",
            e.methode,
            esc(e.pfad),
            if e.wer { "✓" } else { "" },
            esc(e.zweck)
        ));
    }
    format!(
        r#"<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>kanbanD · API</title>
<link rel="stylesheet" href="/web/kd-tokens.css"><link rel="stylesheet" href="/web/kd-base.css"><link rel="stylesheet" href="/web/kd-app.css">
<style>html,body{{overflow:auto}}main{{padding:24px 32px;max-width:1100px}}.md{{white-space:pre-wrap}}</style></head>
<body><header class="kz"><div class="kz-z1"><b>kanbanD · API</b> <span class="mono">für Agenten und Skripte</span></div><div class="kz-z3"><a class="kz-btn" href="/">zur Oberfläche</a></div></header>
<main><h1 style="margin:0 0 8px;font-size:18px">Alles, was die Oberfläche kann, kann auch ein Agent.</h1>
<p class="muted">Jeder schreibende Aufruf nennt im Header <span class="mono">X-KanbanD-Wer: &lt;kürzel&gt;</span> die handelnde Person aus <span class="mono">kanbanD.md</span>; kanbanD committet unter ihrem Namen. Lesen braucht keine Identität. Antworten sind JSON: ein Objekt kommt direkt, eine Liste verpackt unter ihrem Sammlungsnamen (<span class="mono">{{"aufgaben": […]}}</span>), weil Listen Zusatzangaben tragen; Fehler <span class="mono">{{"fehler": "…"}}</span>. Maschinenlesbar: <b><a href="/api/openapi.json">/api/openapi.json</a></b> (OpenAPI 3.1 mit allen Feldern, Werten und Formaten), knapp: <a href="/api/endpunkte">/api/endpunkte</a>.</p>
<p class="muted">Mehrere Agenten an einem Board: jede laufende Instanz wählt sich eine Kennung (z.&nbsp;B. eine GUID) und nennt sie im Header <span class="mono">X-KanbanD-Instanz</span>. <span class="mono">POST …/ziehen</span> nimmt atomar die oberste freie Karte einer Spalte, reserviert sie 24&nbsp;h für diese Instanz und zieht sie weiter — zwei Instanzen bekommen nie dieselbe Karte.</p>
<pre class="md">curl -X POST {adresse}api/aufgaben -H 'X-KanbanD-Wer: cl' -H 'Content-Type: application/json' -d '{{"titel":"Dateiwächter","board":"entwicklung"}}'</pre>
<table class="pt dicht" style="margin-top:16px"><thead><tr><th>Methode</th><th>Pfad</th><th>Wer</th><th>Zweck</th></tr></thead><tbody>{zeilen}</tbody></table></main></body></html>"#,
        adresse = esc(adresse)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seite_enthaelt_jeden_pfad_und_maskiert() {
        let s = api_seite("http://h:1/");
        for e in ENDPUNKTE {
            assert!(s.contains(&esc(e.pfad)), "{}", e.pfad);
        }
        assert!(s.contains("<title>kanbanD · API</title>"));
        assert!(api_seite("http://<x>/").contains("http://&lt;x&gt;/api/aufgaben"));
    }
}
