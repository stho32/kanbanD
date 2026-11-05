// R00099 Befund erledigt sich — Akzeptanzszenarien US-1 bis US-7, Schicht Testfall: nur DSL, kein Protokoll.
mod akzeptanz;
mod gemeinsam;

use akzeptanz::dsl::{EINGANG, FERTIG, Fabrik, IN_ARBEIT, MENSCH, SENSOR};

const LODASH: &str = "lodash 4.17.21 ist eingespielt";

#[tokio::test]
async fn us1_behobener_befund_verschwindet_aus_der_arbeit() {
    let fabrik = Fabrik::default().karte(3, "shop/nc-301/vue", FERTIG).karte(7, "shop/nc-304/lodash", IN_ARBEIT).oeffnen().await;
    let aus = fabrik.erledigt(SENSOR, "shop/nc-304/lodash", LODASH).await;
    assert_eq!((aus.status, aus.ergebnis.as_str()), (200, "erledigt"), "{}", aus.fehler);
    assert_eq!(fabrik.spalte(FERTIG).await, [7, 3], "oben in Fertig");
    assert_eq!(fabrik.kommentare(7).await, [format!("{SENSOR} · Befund nicht mehr gefunden: {LODASH}")]);
    assert_eq!(fabrik.neue_commits(), 1);
}

#[tokio::test]
async fn us2_beim_menschen_wird_nur_gemeldet() {
    let fabrik = Fabrik::default().karte(8, "k2", EINGANG).oeffnen().await;
    let aus = fabrik.erledigt(SENSOR, "k2", LODASH).await;
    assert_eq!((aus.status, aus.ergebnis.as_str()), (200, "gemeldet"), "{}", aus.fehler);
    assert_eq!(fabrik.spalte(EINGANG).await, [8], "bleibt im Eingang");
    assert_eq!(fabrik.kommentare(8).await, [format!("{SENSOR} · Befund nicht mehr gefunden: {LODASH}")]);
    assert!(fabrik.traegt_signal(8).await, "Signal behoben");
}

#[tokio::test]
async fn us3_taeglicher_lauf_aendert_nichts_mehr() {
    let fabrik = Fabrik::default().karte(7, "k1", IN_ARBEIT).karte(8, "k2", EINGANG).oeffnen().await;
    fabrik.erledigt(SENSOR, "k1", LODASH).await;
    fabrik.erledigt(SENSOR, "k2", LODASH).await;
    let gestern = fabrik.neue_commits();
    let (k1, k2) = (fabrik.erledigt(SENSOR, "k1", LODASH).await, fabrik.erledigt(SENSOR, "k2", LODASH).await);
    assert_eq!((k1.status, k1.ergebnis.as_str(), k2.status, k2.ergebnis.as_str()), (200, "schon erledigt", 200, "schon gemeldet"));
    assert_eq!((fabrik.kommentare(7).await.len(), fabrik.kommentare(8).await.len()), (1, 1), "kein zweiter Kommentar");
    assert_eq!(fabrik.neue_commits(), gestern, "kein Commit");
}

#[tokio::test]
async fn us4_der_mensch_erledigt_selbst() {
    let fabrik = Fabrik::default().karte(3, "k3", FERTIG).karte(8, "k2", EINGANG).oeffnen().await;
    let aus = fabrik.erledigt(MENSCH, "k2", LODASH).await;
    assert_eq!((aus.status, aus.ergebnis.as_str()), (200, "erledigt"), "{}", aus.fehler);
    assert_eq!(fabrik.spalte(FERTIG).await, [8, 3]);
}

#[tokio::test]
async fn us5_tippfehler_im_signal() {
    let fabrik = Fabrik::default().karte(7, "k1", IN_ARBEIT).oeffnen().await;
    let aus = fabrik.erledigt_mit_signal(SENSOR, "k1", LODASH, "behobn").await;
    assert_eq!(aus.status, 400, "{}", aus.fehler);
    assert_eq!(fabrik.spalte(IN_ARBEIT).await, [7]);
    assert!(fabrik.kommentare(7).await.is_empty());
    assert_eq!(fabrik.neue_commits(), 0);
}

#[tokio::test]
async fn us6_volle_abschlussspalte_weist_den_sensor_ab() {
    let fabrik = Fabrik::default().fertig_hat_grenze(1).karte(3, "k3", FERTIG).karte(7, "k1", IN_ARBEIT).oeffnen().await;
    let aus = fabrik.erledigt(SENSOR, "k1", LODASH).await;
    assert_eq!((aus.status, aus.fehler.as_str()), (409, "Grenze erreicht"));
    assert_eq!(fabrik.spalte(IN_ARBEIT).await, [7]);
    assert!(fabrik.kommentare(7).await.is_empty());
    assert_eq!(fabrik.neue_commits(), 0);
}

#[tokio::test]
async fn us7_volle_abschlussspalte_der_mensch_erledigt_trotzdem() {
    let fabrik = Fabrik::default().fertig_hat_grenze(1).karte(3, "k3", FERTIG).karte(7, "k1", IN_ARBEIT).reserviert(7).oeffnen().await;
    assert!(fabrik.ist_reserviert(7).await, "Gegeben: reserviert");
    let aus = fabrik.erledigt(MENSCH, "k1", LODASH).await;
    assert_eq!((aus.status, aus.ergebnis.as_str()), (200, "erledigt"), "{}", aus.fehler);
    assert_eq!(aus.warnungen, ["Grenze erreicht: „Fertig“ hat 2 von 1"]);
    assert_eq!(fabrik.spalte(FERTIG).await, [7, 3]);
    assert!(!fabrik.ist_reserviert(7).await, "ohne Reservierung");
    assert_eq!(fabrik.kommentare(7).await, [format!("{MENSCH} · Befund nicht mehr gefunden: {LODASH}")]);
    assert_eq!(fabrik.neue_commits(), 1);
}
