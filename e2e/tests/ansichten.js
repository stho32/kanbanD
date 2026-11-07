// Die Ansichten der Anwendung, geteilt von Kontrast- und Zielprobe (ADR-0012 Regel 6): eine Liste, damit keine Probe eine Ansicht auslässt

const BERICHTE = ['stundenzettel', 'kreuz', 'verlauf', 'durchlauf', 'prognose', 'fieber', 'kosten', 'bestand'];

/** Je Ansicht Name und Adresse (Hash); Board und WBS-Sicht tragen den Slug des Testbestands. */
function ansichtenDerAnwendung({ board, wbs }) {
  return [
    { ansicht: 'Board', adresse: '#/board/' + board },
    { ansicht: 'Aufgabenliste', adresse: '#/aufgaben' },
    { ansicht: 'Personen', adresse: '#/personen' },
    { ansicht: 'Einrichten', adresse: '#/einrichten' },
    ...BERICHTE.map(name => ({ ansicht: 'Bericht ' + name, adresse: '#/berichte/' + name })),
    { ansicht: 'WBS-Sicht', adresse: '#/wbs/' + wbs },
  ];
}

/** Öffnet das Aufgabenfenster einer Karte des geladenen Boards und wartet auf den Dialog. */
async function aufgabenfenster(page, nummer, reiter) {
  await page.locator(`.ka[data-id="${nummer}"] .t`).click();
  const fenster = page.getByRole('dialog', { name: `Aufgabe #${nummer}` });
  await fenster.waitFor();
  if (reiter) await fenster.getByRole('tab', { name: reiter }).click();
  return fenster;
}

/**
 * Die Fenster der Anwendung, geteilt von Proben über alle Fenster (R00111 AK 8–10, ADR-0015): eine Liste, damit keine Probe
 * ein Fenster auslässt. `oeffnen` beginnt am geladenen Board und liefert den Dialog. Erwarteter Testbestand: #1 offen
 * (ihre Meldung entsteht aus der abgelehnten Herkunft „X1“), #2 mit Preisetikett, #3 archiviert, #4 defekte Datei, ein Board mit der Spalte „Zu erledigen“.
 */
function fensterDerAnwendung() {
  return [
    { fenster: 'Aufgabenfenster #1, Reiter Inhalt', oeffnen: page => aufgabenfenster(page, 1) },
    { fenster: 'Aufgabenfenster #1, Reiter Datei', oeffnen: page => aufgabenfenster(page, 1, 'Datei') },
    {
      fenster: 'Aufgabenfenster #1 mit Meldung',
      oeffnen: async page => {
        const fenster = await aufgabenfenster(page, 1);
        await fenster.getByLabel('Neue Herkunft').fill('X1');
        await fenster.getByLabel('Neue Herkunft').press('Enter');
        await fenster.locator('[role=alert]').waitFor({ state: 'attached' });
        return fenster;
      },
    },
    { fenster: 'Aufgabenfenster #2, Reiter Kosten', oeffnen: page => aufgabenfenster(page, 2, 'Kosten') },
    {
      fenster: 'Aufgabenfenster #3 (archiviert)',
      oeffnen: async page => { await page.locator('[data-act="archiv-an"]').click(); return aufgabenfenster(page, 3); },
    },
    {
      fenster: '„Neue Aufgabe“ mit Meldung',
      oeffnen: async page => {
        await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
        const fenster = page.getByRole('dialog', { name: 'Neue Aufgabe' });
        // Enter im Titel statt Klick auf „Anlegen“: die Meldung entsteht auch, wenn der Knopf fehlt, und die Probe zeigt, was fehlt
        await page.getByLabel('Titel der neuen Aufgabe').press('Enter');
        await fenster.locator('[role=alert]').waitFor({ state: 'attached' });
        return fenster;
      },
    },
    {
      fenster: 'Defekte Datei #4',
      oeffnen: async page => {
        await page.locator('.ka.defekt[data-id="4"]').click();
        const fenster = page.getByRole('dialog', { name: 'Defekte Datei #4' });
        await fenster.waitFor();
        return fenster;
      },
    },
  ];
}

module.exports = { ansichtenDerAnwendung, fensterDerAnwendung };
