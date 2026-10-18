//! Die eine Beschreibung der API — Quelle für `/api` und `/api/endpunkte`.

use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
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
    e("GET", "/api/zustand", false, "Ordner", "Ordner, eingerichtet?, Einstellungen, Boards, defekte Dateien"),
    e("POST", "/api/einrichten", false, "Ordner", "erster Start {ich, agenten, board, spalten, quellen}"),
    e("GET", "/api/wer", true, "Ordner", "die Person zum Header X-KanbanD-Wer"),
    e("PUT", "/api/einstellungen", true, "Ordner", "Personen, Klassen, Quellen und Register der Anwendungen ersetzen (Personen nur stilllegen)"),
    e("GET", "/api/anwendungen", false, "Ordner", "Register der Anwendungen {kürzel: {name, wbs, anforderungen, erreichbar: {wbs, anforderungen}}}"),
    e("GET", "/api/ereignisse", false, "Ordner", "Server-Sent Events {pfade, extern} je Änderung im Ordner"),
    e("GET", "/api/boards", false, "Boards", "alle Boards mit Spalten und Aufgabennummern"),
    e("POST", "/api/boards", true, "Boards", "Board anlegen {titel, spalten?}"),
    e("GET", "/api/boards/{slug}", false, "Boards", "ein Board"),
    e("PUT", "/api/boards/{slug}/spalten", true, "Boards", "Spalten setzen [{name, alt?, grenze?}]"),
    e("PUT", "/api/boards/{slug}/termine", true, "Boards", "Termine setzen [{name, datum, farbe, linie?: durchgehend|gestrichelt|gepunktet, staerke?: fein|normal|fett}]"),
    e("POST", "/api/boards/{slug}/bewegen", true, "Boards", "Aufgabe bewegen {nummer, spalte, index?} — ändert nur die Board-Datei"),
    e("POST", "/api/boards/{slug}/aufgaben", true, "Boards", "Aufgabe auf das Board legen {nummer, spalte?}"),
    e("DELETE", "/api/boards/{slug}/aufgaben/{nr}", true, "Boards", "Aufgabe vom Board nehmen"),
    e("GET", "/api/aufgaben", false, "Aufgaben", "alle Aufgaben und defekte Dateien"),
    e("POST", "/api/aufgaben", true, "Aufgaben", "anlegen {titel, board?, spalte?}"),
    e("POST", "/api/aufgaben/mehrere", true, "Aufgaben", "mehrere anlegen {titel: [...], board?, spalte?} — ein Commit"),
    e("POST", "/api/aufgaben/archivieren", true, "Aufgaben", "mehrere archivieren {nummern} — ein Commit"),
    e("POST", "/api/aufgaben/zurueckholen", true, "Aufgaben", "mehrere zurückholen {nummern} — ein Commit"),
    e("GET", "/api/aufgaben/{nr}", false, "Aufgaben", "Aufgabe mit Pfad und Dateitext (423 bei defekter Datei)"),
    e("PATCH", "/api/aufgaben/{nr}", true, "Aufgaben", "ändern {titel?, beschreibung?, klasse?, zustaendige?, labels?, faellig?, herkunft?}"),
    e("POST", "/api/aufgaben/{nr}/teilaufgaben", true, "Aufgaben", "Teilaufgabe anlegen {text}"),
    e("POST", "/api/aufgaben/{nr}/teilaufgaben/mehrere", true, "Aufgaben", "mehrere Teilaufgaben anlegen {texte: [...]} — ein Commit"),
    e("PATCH", "/api/aufgaben/{nr}/teilaufgaben/{i}", true, "Aufgaben", "Teilaufgabe ändern {erledigt?, text?}"),
    e("DELETE", "/api/aufgaben/{nr}/teilaufgaben/{i}", true, "Aufgaben", "Teilaufgabe entfernen"),
    e("POST", "/api/aufgaben/{nr}/kommentare", true, "Aufgaben", "kommentieren {text}"),
    e("POST", "/api/aufgaben/{nr}/archivieren", true, "Aufgaben", "archivieren (stoppt laufende Timer)"),
    e("POST", "/api/aufgaben/{nr}/zurueckholen", true, "Aufgaben", "aus dem Archiv zurückholen"),
    e("GET", "/api/aufgaben/{nr}/anhaenge", false, "Aufgaben", "Anhänge auflisten"),
    e("POST", "/api/aufgaben/{nr}/anhaenge", true, "Aufgaben", "Anhang hochladen (multipart, Feld datei)"),
    e("GET", "/api/aufgaben/{nr}/anhaenge/{name}", false, "Aufgaben", "Anhang laden"),
    e("DELETE", "/api/aufgaben/{nr}/anhaenge/{name}", true, "Aufgaben", "Anhang entfernen"),
    e("GET", "/api/herkunft", false, "Aufgaben", "WBS-Knoten und Anforderungen der verwendeten Herkunft, je Schreibweise mit anwendung und schluessel"),
    e("GET", "/api/wbs/{kürzel}", false, "WBS", "WBS einer registrierten Anwendung {knoten: [{id, ebene, eltern, name, status, gerechnet, erreicht, …, zeile}], stand: {gruen, gelb, rot, slices, aktiv, pfad, laufend}, nicht_committet, anforderungen}; 404 unbekannt, 409 nicht erreichbar"),
    e("POST", "/api/aufgaben/{nr}/timer/start", true, "Zeiten", "eigenen Timer starten"),
    e("POST", "/api/aufgaben/{nr}/timer/stop", true, "Zeiten", "Timer stoppen {wer?} — auch fremde"),
    e("POST", "/api/aufgaben/{nr}/zeiten", true, "Zeiten", "Zeit nachtragen {dauer}"),
    e("PATCH", "/api/aufgaben/{nr}/zeiten/{i}", true, "Zeiten", "Zeiteintrag korrigieren {beginn?, ende?}"),
    e("DELETE", "/api/aufgaben/{nr}/zeiten/{i}", true, "Zeiten", "Zeiteintrag löschen"),
    e("GET", "/api/berichte/zeiten.csv", false, "Berichte", "alle Zeiteinträge als CSV"),
    e("GET", "/api/berichte/verlauf?board={slug}", false, "Berichte", "offene Aufgaben je Tag und Durchlaufzeiten aus Git"),
    e("GET", "/api/berichte/bewegungen?board={slug}", false, "Berichte", "je Aufgabe die Spaltenwechsel aus Git (Grundlage der Board-Berichte)"),
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
<p class="muted">Jeder schreibende Aufruf nennt im Header <span class="mono">X-KanbanD-Wer: &lt;kürzel&gt;</span> die handelnde Person aus <span class="mono">kanbanD.md</span>; kanbanD committet unter ihrem Namen. Lesen braucht keine Identität. Antworten sind JSON, Fehler <span class="mono">{{"fehler": "…"}}</span>. Maschinenlesbar: <a href="/api/endpunkte">/api/endpunkte</a>.</p>
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
