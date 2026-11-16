// Beispielboard der Anforderung R00171 (vier Aufgaben, Zahlen aus AK 1–3) — der eine Aufbau für den Einheitstest an
// kostenbericht() und für die Probe im echten Programm. Betrachter in +01:00, alle Beträge in USD. Rollen nach R00172:
// #1 12.11. 1,00 `planer`, #2 0,54 `architekt`, alle übrigen `entwickler`.
const SPALTEN = ['Eingang', 'Entwicklung', 'Abnahme', 'Produktiv'];
const eintrag = (at, column, amount, mehr = {}) => ({ at: `2026-11-${at}+01:00`, role: 'entwickler', column, amount, currency: 'USD', ...mehr });

const AUFGABEN = [
  { nummer: 1, titel: 'Angebot für das Kundenprojekt schreiben', spalte: 'Produktiv', eintraege: [eintrag('12 09:00', 'Entwicklung', 1.00, { role: 'planer' }), eintrag('13 10:34', 'Entwicklung', 3.46), eintrag('14 15:00', 'Abnahme', 2.00)] },
  { nummer: 2, titel: 'Schnittstelle zur Abrechnung anbinden und mit Beispieldaten prüfen', spalte: 'Entwicklung', eintraege: [eintrag('13 11:00', 'Entwicklung', 0.54, { role: 'architekt' })] },
  { nummer: 3, titel: 'Altes Angebot ablegen', spalte: 'Produktiv', archiviert: '2026-11-06', eintraege: [eintrag('05 08:00', 'Entwicklung', 4.00)] },
  { nummer: 4, titel: 'Rechnungsvorlage abstimmen', spalte: 'Eingang', altePosten: 5.00, eintraege: [] },
];

/** AK 7: ein Eintrag aus einer Spalte, die das Board nicht führt. */
const FREMDE_SPALTE = eintrag('13 12:00', 'Review', 0.25, { role: 'reviewer' });
/** AK 9: beiderseits der Tagesgrenze in der Ortszeit des Betrachters. */
const VOR_MITTERNACHT = eintrag('13 23:30', 'Entwicklung', 0.10, { role: 'planer' });
const NACH_MITTERNACHT = eintrag('14 00:10', 'Entwicklung', 0.20, { role: 'planer' });

const ZEITRAUM_12_13 = { zeitraum: 'eigen', von: '2026-11-12', bis: '2026-11-13' };
const ZEITRAUM_12_14 = { zeitraum: 'eigen', von: '2026-11-12', bis: '2026-11-14' };
/** Der Tag, an dem der Betrachter auf den Bericht sieht (mittags in +01:00). */
const HEUTE = '2026-11-16T12:00:00+01:00';

module.exports = { SPALTEN, AUFGABEN, FREMDE_SPALTE, VOR_MITTERNACHT, NACH_MITTERNACHT, ZEITRAUM_12_13, ZEITRAUM_12_14, HEUTE, eintrag };
