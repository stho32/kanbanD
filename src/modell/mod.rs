//! Die Begriffe von kanbanD als Daten — ohne Dateien, ohne HTTP.

mod anwendungen;
mod aufgabe;
mod board;
mod braucht;
mod commit_diff;
mod gesamt_diff;
mod commit_eintrag;
mod commit_verweis;
mod einstellungen;
mod kosten;
mod kosteneintrag;
mod meldung;
mod transkript;

pub use anwendungen::{Anwendungen, Herkunftsschluessel, id_gueltig};
pub(crate) use aufgabe::mitgeschickt;
pub use aufgabe::{Aufgabe, Aufgabenaenderung, Berichtszaehlung, Dublette, Durchlauf, Ergebnis, Fremdschluessel, GESCHAETZTE_MINUTEN_MAX, GESCHAETZT_MELDUNG, Kommentar, OHNE_HERKUNFT, RESERVIERUNG_MINUTEN, Reservierung, Schluesseltreffer, Teilaufgabe, Zeiteintrag, Zaehlungsaenderung, doppelte_schluessel, geschaetzte_minuten_pruefen, herkunft_gueltig, instanz_gueltig, signal_unbekannt};
pub use commit_diff::{Diffdatei, Fassung, GRENZE_DATEILISTE, GRENZE_DATEILISTE_EINZELN, GRENZE_EINZELN, GRENZE_PATCH_DATEI, GRENZE_PATCH_LAUF, GRENZE_ZEILEN, GRENZEN_VERSION, Hinweis, KAPPE_DATEIEN, PFAD_HOECHSTENS, Rohdatei, Verteilung, angabe_passt, aus_stuecken, datei as diffdatei, dateiliste, hunks, lauf_der_liste, patch_text, getroffen, im_bezug_zugeordnet, nicht_zugeordnet_im_bezug, patches_zuordnen, patches_zuordnen_im_bezug, patches_zuordnen_nachsichtig, roh_lesen, stuecke, zahlen_im_bezug, zahlen_lesen, zahlen_mit_pfaden};
pub(crate) use commit_diff::zitiert;
pub use gesamt_diff::{Abschnitt, EINTEILUNG_VERSION, Einteilung, Eintragspfade, FREMD_HOECHSTENS, Folgedatei, GRENZE_NAMEN, GRENZE_PFADANGABE, Gesamtdatei, Grund, LEERER_BAUM, Linienpunkt, Schritt, Spanne, Spannenlauf, Zform, abschliessen, abschnitte_patch, abschnitte_z, folge_bilden, hinweiszeile, leerer_baum, namen_lesen, ordnen, spanne_lesen};
pub use commit_eintrag::{Commiteintrag, Commitzustand, TITEL_HOECHSTENS, ZWEIGE_HOECHSTENS, Zweige, titel_kuerzen};
pub use commit_verweis::{Ersetzungsfehler, HASH_MAX, HASH_MIN, HOECHSTZAHL_PAARE, Paar, Verweisfehler, Verweisform, ersetzungen_lesen, lesen as verweis_lesen};
pub use braucht::{Abhaengigkeit, BRAUCHT_UEBER_LABELS, Deutung, FORM_MELDUNG, abhaengigkeiten, an_der_tuer, braucht_nummern, deuten as braucht_deuten, in_letzter_spalte, ist_erledigt, kreis_meldung, kreis_suchen, neue_braucht_labels, selbstbezug_meldung, unbekannt_meldung};
pub use board::{Belegung, Berichtsfilter, Bestandseinstellung, Bewegfehler, Board, ColumnOwnerEintrag, Eigentuemer, Einstellung, Einstellungsaenderung, Einstellungsaenderungen, Entnahmesperre, FIEBER_AUFLOESUNGEN, FIEBER_PERZENTILE, Fieber, Grenzverletzung, Grenzverletzungen, Klassengeltung, Linie, Spalte, SpaltenAenderung, Spaltenbelegung, Spaltenfehler, Staerke, Termin, ist_datum, ist_hexfarbe, meint_human_wert, slug_gueltig, spaltenname_gueltig};
pub use kosteneintrag::{Kosteneintrag, ROLLE_HOECHSTENS_ZEICHEN, Roheintrag};
pub use transkript::{Erfassung, GZIP_KENNBYTES, HOECHSTZAHL_TRANSKRIPTE, TRANSKRIPT_HOECHSTENS, TRANSKRIPTE_ORDNER, Transkripteintrag, Transkriptzeile, Transkriptzustand, erfassung};
pub use kosten::{Gesamt, HOECHSTWERT_CENT, HOECHSTZAHL_POSITIONEN, Kosten, Position, Rohkosten, Rohposition, Wert};
pub use einstellungen::{Anwendung, Art, Einstellungen, Klasse, Person, Quellen, SIGNAL_FAELLIG, Signal, kuerzel_gueltig};
pub use meldung::{Meldung, inhalt_laenge};

/// Dateiname aus einem Titel: Kleinbuchstaben, Umlaute als ae/oe/ue/ss, sonst Bindestriche; höchstens 40 Zeichen.
pub fn slug(titel: &str) -> String {
    let mut s = String::new();
    for c in titel.to_lowercase().chars() {
        match c {
            'ä' => s.push_str("ae"),
            'ö' => s.push_str("oe"),
            'ü' => s.push_str("ue"),
            'ß' => s.push_str("ss"),
            c if c.is_ascii_alphanumeric() => s.push(c),
            _ if !s.ends_with('-') => s.push('-'),
            _ => {}
        }
    }
    let s = s.trim_matches('-');
    let gekuerzt: String = s.chars().take(40).collect();
    gekuerzt.trim_end_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::slug;

    #[test]
    fn slug_ersetzt_umlaute_und_sonderzeichen() {
        assert_eq!(slug("Größe ändern: Übersicht!"), "groesse-aendern-uebersicht");
        assert_eq!(slug("  --A  B--  "), "a-b");
        assert_eq!(slug("!!!"), "");
    }

    #[test]
    fn slug_wird_auf_40_zeichen_gekuerzt_ohne_endstrich() {
        let s = slug(&"wort ".repeat(20));
        assert!(s.len() <= 40);
        assert!(!s.ends_with('-'));
    }
}
