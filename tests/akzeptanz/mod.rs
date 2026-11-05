//! Akzeptanztests in vier Schichten: Testfall (tests/akzeptanz_*.rs) → DSL (Fachsprache) → Treiber (HTTP, Dateien, Git) → Programm.
#![allow(dead_code)]
pub mod arbeitsordner;
pub mod dsl;
pub mod treiber;
