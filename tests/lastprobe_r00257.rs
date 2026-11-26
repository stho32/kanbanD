// R00257 AK 7 (I0247, Karte #241): Lastprobe der Sammelwege — 4.002 Aufgaben, 4.000 Titeländerungen in **einer**
// Anfrage, dazu ein fremder `PATCH /api/aufgaben/1` 100 ms nach ihrem Beginn. Läuft nur ausdrücklich, mit --release
// und ruhiger Maschine (Last unter 2):
//   cargo test --release --test lastprobe_r00257 -- --ignored --nocapture
//
// Getrennt protokolliert (ADR-0044 „Messprobe“): die Dauer bis `aktion` (Lesen und Prüfen) misst eine Anfrage mit
// denselben 4.000 Einträgen, deren Titel schon stehen — sie ändert nichts, ruft `aktion` nicht und kehrt nach dem
// Lesen zurück; die Dauer von `aktion` (Schreiben und Commit) ist die Differenz zur vollen Kette. Bleibt die Kette
// über 770 ms (1 s ÷ 1,3), nennt der Durchlauf Last und Werte als Frage an den architekt; liegt sie ≥ 1 s, während
// der Lesepfad unter 200 ms braucht, liegt der Rest im Commit — dann ist eine neue Karte zum Commit-Weg fällig.
mod gemeinsam;

use std::time::{Duration, Instant};

/// Soll der Kette und des fremden PATCH (US-1, Q1/Q2 der ADR-0044).
const ZIEL: Duration = Duration::from_millis(1000);
/// Ab hier ist der Abstand zum Soll zu klein (1 s ÷ 1,3, `rollen/planer/zeitkriterien.md`).
const ABSTAND: Duration = Duration::from_millis(770);
/// Ab hier liegt der Rest nicht mehr im Commit.
const LESEPFAD: Duration = Duration::from_millis(200);
const AUFGABEN: usize = 4002;
const KETTE: usize = 4000;
const BEOBACHTUNG: usize = 30_002;

/// Die Last der Maschine aus `/proc/loadavg`.
fn last() -> f64 {
    std::fs::read_to_string("/proc/loadavg").unwrap_or_default().split(' ').next().unwrap_or_default().parse().unwrap_or(f64::MAX)
}

fn ms(d: Duration) -> u128 {
    d.as_millis()
}

/// Legt `anzahl` Aufgaben über den echten Weg an (POST /api/aufgaben/mehrere, höchstens 5000 je Anfrage).
async fn anlegen(client: &reqwest::Client, adresse: &str, von: usize, anzahl: usize) {
    for stueck in (0..anzahl).collect::<Vec<_>>().chunks(5000) {
        let titel: Vec<String> = stueck.iter().map(|i| format!("t{}", von + i)).collect();
        let a = client
            .post(format!("{adresse}api/aufgaben/mehrere"))
            .header("X-KanbanD-Wer", "mi")
            .json(&serde_json::json!({ "titel": titel }))
            .send()
            .await
            .unwrap();
        assert_eq!(a.status().as_u16(), 201, "{}", a.text().await.unwrap());
    }
}

/// Eine Sammelanfrage über `nummern` mit den Titeln `titel(nr)`; liefert Status und Dauer.
async fn sammeln(client: &reqwest::Client, adresse: &str, nummern: &[u32], titel: impl Fn(u32) -> String) -> (u16, Duration) {
    let aenderungen: Vec<serde_json::Value> = nummern.iter().map(|nr| serde_json::json!({ "nummer": nr, "titel": titel(*nr) })).collect();
    let start = Instant::now();
    let a = client
        .patch(format!("{adresse}api/aufgaben/mehrere"))
        .header("X-KanbanD-Wer", "mi")
        .json(&serde_json::json!({ "aenderungen": aenderungen }))
        .send()
        .await
        .unwrap();
    let status = a.status().as_u16();
    let _ = a.text().await.unwrap();
    (status, start.elapsed())
}

#[tokio::test]
#[ignore = "Lastprobe: nur ausdrücklich, mit --release"]
async fn ak7_lastprobe_sammelanfrage_haelt_niemanden_auf() {
    let l = last();
    eprintln!("AK 7 Lastprobe: Last unter 2 nötig (Last jetzt {l})");
    if l >= 2.0 {
        eprintln!("AK 7 keine Messung: Last < 2 nötig (Last {l}) — kein Wert gilt als bestanden");
        return;
    }
    let tmp = tempfile::tempdir().unwrap();
    let board = tmp.path().canonicalize().unwrap();
    std::fs::create_dir_all(board.join("aufgaben")).unwrap();
    std::fs::create_dir_all(board.join("boards")).unwrap();
    std::fs::write(board.join("kanbanD.md"), "---\npeople:\n  mi: {name: Mia, kind: human}\n---\n").unwrap();
    std::fs::write(board.join("boards/entwicklung.md"), "# Entwicklung\n\n## Zu erledigen\n\n").unwrap();
    gemeinsam::git(&board, &["init", "-q"]);
    gemeinsam::git(&board, &["add", "-A"]);
    gemeinsam::git(&board, &["-c", "user.name=V", "-c", "user.email=v@v", "commit", "-q", "-m", "eingerichtet"]);
    let lauf = gemeinsam::starten(&board, &["--port", "0"]);
    let client = reqwest::Client::new();
    // 4.002 Aufgaben (#1–#4002, Titel t0…t4001); #1 trägt den fremden PATCH
    anlegen(&client, &lauf.adresse, 0, AUFGABEN).await;
    let nummern: Vec<u32> = (3..=(KETTE as u32 + 2)).collect();
    assert_eq!(nummern.len(), KETTE);

    // Dauer bis `aktion`: dieselben 4.000 Einträge mit den Titeln, die schon stehen — nichts ändert sich, kein Commit
    let (status_lesen, dauer_lesen) = sammeln(&client, &lauf.adresse, &nummern, |nr| format!("t{}", nr - 1)).await;
    assert_eq!(status_lesen, 200, "die Anfrage ohne Änderung läuft durch");
    let (last_vor, last_lesen) = (last(), last());

    // Die volle Kette, dazu der fremde PATCH 100 ms nach ihrem Beginn
    let fremd = {
        let (client, adresse) = (client.clone(), lauf.adresse.clone());
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(100)).await;
            let start = Instant::now();
            let a = client.patch(format!("{adresse}api/aufgaben/1")).header("X-KanbanD-Wer", "mi").json(&serde_json::json!({ "titel": "fremd" })).send().await.unwrap();
            let status = a.status().as_u16();
            let _ = a.text().await.unwrap();
            (status, start.elapsed(), Instant::now())
        })
    };
    let (status_kette, dauer_kette) = sammeln(&client, &lauf.adresse, &nummern, |nr| format!("y{nr}")).await;
    let kette_ende = Instant::now();
    let (status_fremd, dauer_fremd, fremd_ende) = fremd.await.unwrap();
    let last_nach = last();
    assert_eq!((status_kette, status_fremd), (200, 200), "Kette und fremder PATCH laufen durch");

    // Beobachtung ohne Soll: GET /api/aufgaben bei 30.002 Aufgaben (heute 4,1–4,6 s)
    anlegen(&client, &lauf.adresse, AUFGABEN, BEOBACHTUNG - AUFGABEN).await;
    let start = Instant::now();
    let a = client.get(format!("{}api/aufgaben", lauf.adresse)).send().await.unwrap();
    let status_liste = a.status().as_u16();
    let anzahl = serde_json::from_str::<serde_json::Value>(&a.text().await.unwrap()).unwrap()["aufgaben"].as_array().map(Vec::len).unwrap_or(0);
    let dauer_liste = start.elapsed();
    assert_eq!((status_liste, anzahl), (200, BEOBACHTUNG), "die Liste liest 30.002 Aufgaben");

    let nach_kette = fremd_ende.saturating_duration_since(kette_ende);
    eprintln!("AK 7 Last: vor {last_vor}, beim Lesen {last_lesen}, nach der Kette {last_nach}");
    eprintln!("AK 7 Dauer bis aktion (Lesen, Prüfen): {} ms", ms(dauer_lesen));
    eprintln!("AK 7 Dauer der Kette: {} ms (Soll < {} ms)", ms(dauer_kette), ms(ZIEL));
    eprintln!("AK 7 Dauer von aktion (Schreiben, Commit): {} ms (Kette − Lesen)", ms(dauer_kette).saturating_sub(ms(dauer_lesen)));
    eprintln!("AK 7 fremder PATCH: {} ms, Ende relativ zum Ende der Kette: {} ms (Soll < {} ms)", ms(dauer_fremd), ms(nach_kette), ms(ZIEL));
    eprintln!("AK 7 Beobachtung GET /api/aufgaben bei {BEOBACHTUNG} Aufgaben: {} ms (ohne Soll)", ms(dauer_liste));
    if dauer_kette > ABSTAND {
        eprintln!("AK 7 Frage an den architekt: die Kette liegt mit {} ms über {} ms — der Abstand zum Soll ist zu klein", ms(dauer_kette), ms(ABSTAND));
    }
    if dauer_kette >= ZIEL && dauer_lesen < LESEPFAD {
        eprintln!("AK 7 neue Karte zum Commit-Weg: die Kette braucht {} ms, der Lesepfad nur {} ms — der Rest liegt im Commit", ms(dauer_kette), ms(dauer_lesen));
    }
    assert!(nach_kette < ZIEL, "der fremde PATCH wartet {} ms nach dem Ende der Kette, Soll < {} ms", ms(nach_kette), ms(ZIEL));
    if dauer_kette >= ZIEL && dauer_lesen < LESEPFAD {
        panic!(
            "die Kette braucht {} ms, der Lesepfad aber nur {} ms — der Rest ({} ms) liegt im Schreiben und Commit: neue Karte zum Commit-Weg, kein Nachbessern in dieser Karte (ADR-0044 „Messprobe“)",
            ms(dauer_kette),
            ms(dauer_lesen),
            ms(dauer_kette).saturating_sub(ms(dauer_lesen))
        );
    }
    assert!(dauer_kette < ZIEL, "die Kette braucht {} ms, Soll < {} ms — anforderung_falsch (der Lesepfad braucht {} ms)", ms(dauer_kette), ms(ZIEL), ms(dauer_lesen));
}
