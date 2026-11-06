//! Preisetikett einer Aufgabe (R00105, ADR-0009): geschätzte API-Kosten in ganzen Cent.
//! Ein Konstruktor prüft alle Inhaltsregeln — Datei und API rufen denselben.

/// Höchster Geldwert in Cent (1.000.000,00) — technischer Schutzwert für exakte `f64`- und JavaScript-Rechnung.
pub const HOECHSTWERT_CENT: u64 = 100_000_000;
pub const HOECHSTZAHL_POSITIONEN: usize = 100;

/// Abschnitt `cost` einer Aufgabe; Gesamtwerte aus Positionen werden nie gespeichert.
#[derive(Debug, Clone, PartialEq)]
pub struct Kosten {
    /// `currency`: genau drei Großbuchstaben A–Z, nicht normalisiert
    pub waehrung: String,
    pub basis: Option<String>,
    pub wert: Gesamt,
    /// Schlüssel in `cost`, die kanbanD nicht kennt — bleiben beim Schreiben der Datei erhalten.
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Gesamt {
    Betrag(u64),
    Spanne { min: u64, max: u64 },
    Positionen(Vec<Position>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Position {
    pub text: String,
    pub wert: Wert,
    pub tokens: Option<u64>,
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Wert {
    Betrag(u64),
    Spanne { min: u64, max: u64 },
}

/// Die Werte, wie sie in Datei oder Anfrage stehen — Geldwerte schon in Cent, sonst ungeprüft.
#[derive(Debug, Clone, Default)]
pub struct Rohkosten {
    pub waehrung: Option<String>,
    pub basis: Option<String>,
    pub betrag: Option<u64>,
    pub min: Option<u64>,
    pub max: Option<u64>,
    pub positionen: Option<Vec<Rohposition>>,
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

#[derive(Debug, Clone, Default)]
pub struct Rohposition {
    pub text: Option<String>,
    pub betrag: Option<u64>,
    pub min: Option<u64>,
    pub max: Option<u64>,
    pub tokens: Option<u64>,
    pub weitere: Vec<(String, serde_yaml::Value)>,
}

impl Kosten {
    /// Alle Inhaltsregeln von ADR-0009 an einer Stelle; der Fehler nennt den Pfad (`cost.items[1]: min > max`).
    pub fn pruefen(roh: Rohkosten) -> Result<Kosten, String> {
        let waehrung = roh.waehrung.ok_or("cost: currency fehlt")?;
        if !(waehrung.len() == 3 && waehrung.bytes().all(|b| b.is_ascii_uppercase())) {
            return Err("cost.currency: genau drei Großbuchstaben A–Z".into());
        }
        if let Some(b) = &roh.basis {
            nicht_leer(b, "cost.basis")?;
        }
        let wert = match roh.positionen {
            Some(_) if roh.betrag.is_some() || roh.min.is_some() || roh.max.is_some() => {
                return Err("cost: items zusammen mit amount, min oder max".into())
            }
            Some(p) => Gesamt::Positionen(positionen_pruefen(p)?),
            None => match wert_pruefen(
                "cost",
                "amount, min + max oder items",
                roh.betrag,
                roh.min,
                roh.max,
            )? {
                Wert::Betrag(c) => Gesamt::Betrag(c),
                Wert::Spanne { min, max } => Gesamt::Spanne { min, max },
            },
        };
        Ok(Kosten {
            waehrung,
            basis: roh.basis,
            wert,
            weitere: roh.weitere,
        })
    }
}

fn positionen_pruefen(roh: Vec<Rohposition>) -> Result<Vec<Position>, String> {
    if roh.is_empty() {
        return Err("cost.items: mindestens eine Position".into());
    }
    if roh.len() > HOECHSTZAHL_POSITIONEN {
        return Err(format!(
            "cost.items: höchstens {HOECHSTZAHL_POSITIONEN} Positionen"
        ));
    }
    roh.into_iter()
        .enumerate()
        .map(|(i, p)| position_pruefen(&format!("cost.items[{i}]"), p))
        .collect()
}

fn position_pruefen(pfad: &str, roh: Rohposition) -> Result<Position, String> {
    let text = roh.text.ok_or_else(|| format!("{pfad}: text fehlt"))?;
    nicht_leer(&text, &format!("{pfad}.text"))?;
    let wert = wert_pruefen(pfad, "amount oder min + max", roh.betrag, roh.min, roh.max)?;
    Ok(Position {
        text,
        wert,
        tokens: roh.tokens,
        weitere: roh.weitere,
    })
}

/// Genau ein Betrag oder eine Spanne, jeder Wert höchstens [`HOECHSTWERT_CENT`], min ≤ max.
fn wert_pruefen(
    pfad: &str,
    fehlt: &str,
    betrag: Option<u64>,
    min: Option<u64>,
    max: Option<u64>,
) -> Result<Wert, String> {
    match (betrag, min, max) {
        (Some(_), Some(_), _) | (Some(_), _, Some(_)) => {
            Err(format!("{pfad}: amount zusammen mit min/max"))
        }
        (Some(c), None, None) => Ok(Wert::Betrag(hoechstens(c, pfad, "amount")?)),
        (None, None, None) => Err(format!("{pfad}: {fehlt} fehlt")),
        (None, Some(_), None) => Err(format!("{pfad}: max fehlt")),
        (None, None, Some(_)) => Err(format!("{pfad}: min fehlt")),
        (None, Some(min), Some(max)) => {
            let (min, max) = (hoechstens(min, pfad, "min")?, hoechstens(max, pfad, "max")?);
            if min > max {
                Err(format!("{pfad}: min > max"))
            } else {
                Ok(Wert::Spanne { min, max })
            }
        }
    }
}

fn hoechstens(cent: u64, pfad: &str, schluessel: &str) -> Result<u64, String> {
    if cent > HOECHSTWERT_CENT {
        Err(format!("{pfad}.{schluessel}: höchstens 1000000.00"))
    } else {
        Ok(cent)
    }
}

fn nicht_leer(text: &str, pfad: &str) -> Result<(), String> {
    if text.trim().is_empty() {
        Err(format!("{pfad}: leer"))
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn spanne(min: u64, max: u64) -> Rohkosten {
        Rohkosten {
            waehrung: Some("USD".into()),
            min: Some(min),
            max: Some(max),
            ..Default::default()
        }
    }

    fn betrag(cent: u64) -> Rohkosten {
        Rohkosten {
            waehrung: Some("USD".into()),
            betrag: Some(cent),
            ..Default::default()
        }
    }

    fn position(text: &str, min: u64, max: u64) -> Rohposition {
        Rohposition {
            text: Some(text.into()),
            min: Some(min),
            max: Some(max),
            ..Default::default()
        }
    }

    fn positionen(p: Vec<Rohposition>) -> Rohkosten {
        Rohkosten {
            waehrung: Some("USD".into()),
            positionen: Some(p),
            ..Default::default()
        }
    }

    fn fehler(roh: Rohkosten) -> String {
        Kosten::pruefen(roh).expect_err("Fehler erwartet")
    }

    #[test]
    fn spanne_mit_basis_wird_gebaut() {
        let k = Kosten::pruefen(Rohkosten {
            basis: Some("Schätzung planer".into()),
            ..spanne(60, 160)
        })
        .unwrap();
        assert_eq!(k.waehrung, "USD");
        assert_eq!(k.basis.as_deref(), Some("Schätzung planer"));
        assert_eq!(k.wert, Gesamt::Spanne { min: 60, max: 160 });
    }

    #[test]
    fn betrag_ohne_basis_wird_gebaut_auch_null() {
        assert_eq!(
            Kosten::pruefen(betrag(163)).unwrap().wert,
            Gesamt::Betrag(163)
        );
        assert_eq!(Kosten::pruefen(betrag(0)).unwrap().wert, Gesamt::Betrag(0));
        assert_eq!(Kosten::pruefen(betrag(163)).unwrap().basis, None);
    }

    #[test]
    fn positionen_werden_in_ihrer_reihenfolge_gebaut() {
        let k = Kosten::pruefen(positionen(vec![
            Rohposition {
                tokens: Some(12000),
                ..position("Planung", 10, 20)
            },
            Rohposition {
                text: Some("Gemeinkostenanteil".into()),
                betrag: Some(30),
                ..Default::default()
            },
        ]))
        .unwrap();
        let Gesamt::Positionen(p) = k.wert else {
            panic!("Positionen erwartet")
        };
        assert_eq!(p[0].text, "Planung");
        assert_eq!(p[0].wert, Wert::Spanne { min: 10, max: 20 });
        assert_eq!(p[0].tokens, Some(12000));
        assert_eq!(p[1].wert, Wert::Betrag(30));
        assert_eq!(p[1].tokens, None);
    }

    #[test]
    fn waehrung_genau_drei_grossbuchstaben_nicht_normalisiert() {
        assert_eq!(
            Kosten::pruefen(Rohkosten {
                waehrung: Some("CHF".into()),
                ..betrag(200)
            })
            .unwrap()
            .waehrung,
            "CHF"
        );
        assert_eq!(
            fehler(Rohkosten {
                waehrung: None,
                ..betrag(1)
            }),
            "cost: currency fehlt"
        );
        for w in [
            "usd", "Usd", "US", "USDX", "", "   ", "U$D", "ÄÖÜ", " USD", "US1",
        ] {
            assert_eq!(
                fehler(Rohkosten {
                    waehrung: Some(w.into()),
                    ..betrag(1)
                }),
                "cost.currency: genau drei Großbuchstaben A–Z",
                "{w:?}"
            );
        }
    }

    #[test]
    fn basis_und_text_nach_dem_trimmen_nicht_leer_sonst_unveraendert() {
        for leer in ["", "   ", "\t\n"] {
            assert_eq!(
                fehler(Rohkosten {
                    basis: Some(leer.into()),
                    ..betrag(1)
                }),
                "cost.basis: leer",
                "{leer:?}"
            );
            assert_eq!(
                fehler(positionen(vec![position("a", 1, 2), position(leer, 1, 2)])),
                "cost.items[1].text: leer",
                "{leer:?}"
            );
        }
        assert_eq!(
            Kosten::pruefen(Rohkosten {
                basis: Some(" x ".into()),
                ..betrag(1)
            })
            .unwrap()
            .basis
            .as_deref(),
            Some(" x ")
        );
        assert_eq!(
            fehler(positionen(vec![Rohposition {
                text: None,
                betrag: Some(1),
                ..Default::default()
            }])),
            "cost.items[0]: text fehlt"
        );
    }

    #[test]
    fn min_hoechstens_max() {
        assert_eq!(
            Kosten::pruefen(spanne(160, 160)).unwrap().wert,
            Gesamt::Spanne { min: 160, max: 160 }
        );
        assert_eq!(fehler(spanne(161, 160)), "cost: min > max");
        assert_eq!(
            fehler(positionen(vec![position("a", 1, 2), position("b", 3, 2)])),
            "cost.items[1]: min > max"
        );
    }

    #[test]
    fn genau_eine_gesamtangabe() {
        assert_eq!(
            fehler(Rohkosten {
                betrag: Some(1),
                ..spanne(1, 2)
            }),
            "cost: amount zusammen mit min/max"
        );
        assert_eq!(
            fehler(Rohkosten {
                betrag: Some(1),
                max: None,
                ..spanne(1, 2)
            }),
            "cost: amount zusammen mit min/max"
        );
        assert_eq!(
            fehler(Rohkosten {
                positionen: Some(vec![position("a", 1, 2)]),
                ..betrag(1)
            }),
            "cost: items zusammen mit amount, min oder max"
        );
        assert_eq!(
            fehler(Rohkosten {
                positionen: Some(vec![position("a", 1, 2)]),
                ..spanne(1, 2)
            }),
            "cost: items zusammen mit amount, min oder max"
        );
        assert_eq!(
            fehler(Rohkosten {
                waehrung: Some("USD".into()),
                ..Default::default()
            }),
            "cost: amount, min + max oder items fehlt"
        );
        assert_eq!(
            fehler(Rohkosten {
                max: None,
                ..spanne(1, 2)
            }),
            "cost: max fehlt"
        );
        assert_eq!(
            fehler(Rohkosten {
                min: None,
                ..spanne(1, 2)
            }),
            "cost: min fehlt"
        );
        let p = Rohposition {
            betrag: Some(1),
            ..position("a", 1, 2)
        };
        assert_eq!(
            fehler(positionen(vec![p])),
            "cost.items[0]: amount zusammen mit min/max"
        );
        let p = Rohposition {
            text: Some("a".into()),
            ..Default::default()
        };
        assert_eq!(
            fehler(positionen(vec![p])),
            "cost.items[0]: amount oder min + max fehlt"
        );
        let p = Rohposition {
            max: None,
            ..position("a", 1, 2)
        };
        assert_eq!(fehler(positionen(vec![p])), "cost.items[0]: max fehlt");
    }

    #[test]
    fn eine_bis_hundert_positionen() {
        assert_eq!(
            fehler(positionen(vec![])),
            "cost.items: mindestens eine Position"
        );
        let hundert = (0..100)
            .map(|i| position(&format!("p{i}"), 1, 2))
            .collect::<Vec<_>>();
        assert!(Kosten::pruefen(positionen(hundert.clone())).is_ok());
        let mut hunderteins = hundert;
        hunderteins.push(position("zu viel", 1, 2));
        assert_eq!(
            fehler(positionen(hunderteins)),
            "cost.items: höchstens 100 Positionen"
        );
    }

    #[test]
    fn je_wert_hoechstens_eine_million_die_summe_darf_darueber() {
        assert!(Kosten::pruefen(betrag(HOECHSTWERT_CENT)).is_ok());
        assert_eq!(
            fehler(betrag(HOECHSTWERT_CENT + 1)),
            "cost.amount: höchstens 1000000.00"
        );
        assert_eq!(
            fehler(spanne(1, HOECHSTWERT_CENT + 1)),
            "cost.max: höchstens 1000000.00"
        );
        assert_eq!(
            fehler(spanne(HOECHSTWERT_CENT + 1, HOECHSTWERT_CENT + 1)),
            "cost.min: höchstens 1000000.00"
        );
        let p = |t: &str| Rohposition {
            text: Some(t.into()),
            betrag: Some(60_000_000),
            ..Default::default()
        };
        assert!(Kosten::pruefen(positionen(vec![p("a"), p("b")])).is_ok());
        let ps = vec![
            position("a", 1, 2),
            position("b", 1, 2),
            position("c", 1, 2),
            position("d", 1, HOECHSTWERT_CENT + 1),
        ];
        assert_eq!(
            fehler(positionen(ps)),
            "cost.items[3].max: höchstens 1000000.00"
        );
        let p = Rohposition {
            text: Some("a".into()),
            betrag: Some(HOECHSTWERT_CENT + 1),
            ..Default::default()
        };
        assert_eq!(
            fehler(positionen(vec![p])),
            "cost.items[0].amount: höchstens 1000000.00"
        );
    }

    #[test]
    fn unbekannte_schluessel_bleiben_im_wert() {
        let note = vec![("note".to_string(), serde_yaml::Value::String("x".into()))];
        let k = Kosten::pruefen(Rohkosten {
            weitere: note.clone(),
            ..betrag(100)
        })
        .unwrap();
        assert_eq!(k.weitere, note);
        let p = Rohposition {
            weitere: note.clone(),
            ..position("a", 1, 2)
        };
        let Gesamt::Positionen(p) = Kosten::pruefen(positionen(vec![p])).unwrap().wert else {
            panic!()
        };
        assert_eq!(p[0].weitere, note);
    }
}
