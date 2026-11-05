// R00104 Board-Name als Pfad — Akzeptanzszenarien US-1 bis US-6 als Matrix (Werte × Wege), Schicht Testfall: nur DSL.
// Jede Zeile prüft Status und „nichts geändert“ gegen den Stand direkt davor; alle Abweichungen kommen in einer Meldung.
mod akzeptanz;
mod gemeinsam;

use akzeptanz::arbeitsordner::{Arbeitsordner, FERTIG, IN_ARBEIT, abweichung, fehlfaelle, fehlfaelle_kodiert, vierzig_a};

fn bestanden(abweichungen: Vec<String>) {
    assert!(abweichungen.is_empty(), "{} Abweichungen:\n{}", abweichungen.len(), abweichungen.join("\n"));
}

#[tokio::test]
async fn us1_erledigen_mit_pfad_statt_board_namen_wird_abgewiesen() {
    let ordner = Arbeitsordner::default().oeffnen().await;
    let mut abweichungen = vec![];
    for board in fehlfaelle().into_iter().chain([String::new()]) {
        let vorher = ordner.stand();
        let aus = ordner.erledigt(&board).await;
        abweichungen.extend(abweichung("erledigen", &board, &aus, 400, ordner.aenderungen(&vorher)));
    }
    bestanden(abweichungen);
}

#[tokio::test]
async fn us2_anlegen_mit_pfad_statt_board_namen_wird_abgewiesen() {
    let ordner = Arbeitsordner::default().oeffnen().await;
    let mut abweichungen = vec![];
    for board in fehlfaelle().into_iter().chain([String::new(), " fabrik".into()]) {
        let vorher = ordner.stand();
        let aus = ordner.legt_an("neu", &board).await;
        abweichungen.extend(abweichung("anlegen", &board, &aus, 400, ordner.aenderungen(&vorher)));
    }
    bestanden(abweichungen);
}

#[tokio::test]
async fn us3_lesen_mit_kodiertem_pfad_wird_abgewiesen() {
    let ordner = Arbeitsordner::default().oeffnen().await;
    let mut abweichungen = vec![];
    for kodiert in fehlfaelle_kodiert() {
        let vorher = ordner.stand();
        let board = ordner.board_abrufen(&kodiert);
        abweichungen.extend(abweichung("GET /api/boards/", &kodiert, &board, 400, ordner.aenderungen(&vorher)));
        let vorher = ordner.stand();
        let filter = ordner.aufgaben_filtern(&kodiert);
        abweichungen.extend(abweichung("?board=", &kodiert, &filter, 400, ordner.aenderungen(&vorher)));
    }
    bestanden(abweichungen);
}

#[tokio::test]
async fn us4_gueltiger_name_aber_kein_solches_board() {
    let ordner = Arbeitsordner::default().oeffnen().await;
    let name = vierzig_a();
    let mut abweichungen = vec![];
    let vorher = ordner.stand();
    let aus = ordner.erledigt(&name).await;
    abweichungen.extend(abweichung("erledigen", &name, &aus, 404, ordner.aenderungen(&vorher)));
    let aus = ordner.legt_an("neu", &name).await;
    abweichungen.extend(abweichung("anlegen", &name, &aus, 404, ordner.aenderungen(&vorher)));
    let aus = ordner.board_abrufen(&name);
    abweichungen.extend(abweichung("GET /api/boards/", &name, &aus, 404, ordner.aenderungen(&vorher)));
    let aus = ordner.aufgaben_filtern(&name);
    abweichungen.extend(abweichung("?board=", &name, &aus, 404, ordner.aenderungen(&vorher)));
    bestanden(abweichungen);
}

#[tokio::test]
async fn us5_das_richtige_board_erledigt_wie_bisher() {
    for board in ["fabrik", " fabrik "] {
        let ordner = Arbeitsordner::default().oeffnen().await;
        let aus = ordner.erledigt(board).await;
        assert_eq!((aus.status, aus.ergebnis.as_str()), (200, "erledigt"), "{board:?}: {}", aus.fehler);
        assert_eq!(ordner.spalte(FERTIG).await, [12], "{board:?}: #12 in Fertig");
        assert_eq!(ordner.neue_commits(), 1, "{board:?}: genau ein Commit");
    }
}

#[tokio::test]
async fn us5_das_richtige_board_legt_an_wie_bisher() {
    let ordner = Arbeitsordner::default().oeffnen().await;
    let aus = ordner.legt_an("neu", "fabrik").await;
    assert_eq!(aus.status, 201, "{}", aus.fehler);
    assert_eq!(ordner.spalte(IN_ARBEIT).await, [12, 13], "#13 unten in „In Arbeit“");
    assert_eq!(ordner.titel(13).await, "neu");
    assert_eq!(ordner.neue_commits(), 1);
}

#[tokio::test]
async fn us5_das_richtige_board_liest_wie_bisher() {
    let ordner = Arbeitsordner::default().oeffnen().await;
    let board = ordner.board_abrufen("fabrik");
    assert_eq!(board.status, 200, "{}", board.fehler);
    assert!(board.rumpf.contains("\"titel\":\"fabrik\"") && board.rumpf.contains(IN_ARBEIT) && board.rumpf.contains(FERTIG), "{}", board.rumpf);
    let filter = ordner.aufgaben_filtern("fabrik");
    assert_eq!(filter.status, 200, "{}", filter.fehler);
    assert!(filter.rumpf.contains("\"nummer\":12"), "{}", filter.rumpf);
    assert_eq!(ordner.aenderungen_seit_start(), Vec::<String>::new(), "Lesen ändert nichts");
}

#[tokio::test]
async fn us6_handbenannte_board_datei_wird_gemeldet_nicht_veraendert() {
    let ordner = Arbeitsordner::default().mit_handbenanntem_board("Alt_Board").oeffnen().await;
    let datei = ordner.board_datei("Alt_Board");
    assert!(ordner.defekte().await.contains(&"boards/Alt_Board.md: Dateiname ist kein gültiger Board-Name — umbenennen".to_string()), "{:?}", ordner.defekte().await);
    assert_eq!(ordner.boards_im_zustand().await, ["fabrik"], "nicht unter den Boards des Zustands");
    assert_eq!(ordner.boards().await, ["fabrik"], "GET /api/boards");
    assert_eq!(ordner.board_abrufen("Alt_Board").status, 400);
    assert_eq!(ordner.board_datei("Alt_Board"), datei, "unverändert unter demselben Namen");
    assert_eq!(ordner.aenderungen_seit_start(), Vec::<String>::new());
}
