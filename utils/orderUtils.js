/**
 * Calcola i minuti trascorsi tra un timestamp (Date o stringa ISO) e l'orario attuale.
 * @param {Date|string|number} mongoTimestamp - Il campo timestamp estratto da MongoDB
 * @returns {number} Minuti trascorsi (arrotondati per difetto)
 */
function calcolaMinutiTrascorsi(mongoTimestamp) {
  const adesso = new Date();
  const dataOrdine = new Date(mongoTimestamp);

  // Differenza in millisecondi
  const diffMs = adesso - dataOrdine;

  // Conversione da ms a minuti
  const diffMinuti = Math.floor(diffMs / (1000 * 60));

  return diffMinuti;
}

/**
 * Calcola il tempo totale di attesa (in minuti) includendo le code e l'ordine corrente.
 * @param {Array<{timestamp: Date|string, tempo_stimato: number}>} ordiniPrecedenti - Gli ordini in attesa
 * @param {Object} ordineTemporaneo - L'ordine corrente contenente la lista dei prodotti
 * @returns {number} Minuti totali di attesa
 */
function calcolaTempoAttesaTotale(ordiniPrecedenti, ordineTemporaneo) {
  let tempoAttesa = 0;

  // 1. Minuti di attesa residui per gli ordini già in coda
  if (ordiniPrecedenti && ordiniPrecedenti.length > 0) {
    // CORRETTO: Chiamata diretta alla funzione nello stesso modulo
    const minutiTrascorsi = calcolaMinutiTrascorsi(ordiniPrecedenti[0].timestamp);
    const minutiRimanenti = ordiniPrecedenti[0].tempo_stimato - minutiTrascorsi;

    tempoAttesa += Math.max(0, minutiRimanenti);

    for (let i = 1; i < ordiniPrecedenti.length; i++) {
      tempoAttesa += ordiniPrecedenti[i].tempo_stimato || 0;
    }
  }

  // 2. Tempo necessario per l'ordine corrente (15 min per prodotto)
  const numProdotti = ordineTemporaneo?.listaProdotti ? ordineTemporaneo.listaProdotti.length : 0;
  tempoAttesa += numProdotti * 15;

  return tempoAttesa;
}

module.exports = {
  calcolaMinutiTrascorsi,
  calcolaTempoAttesaTotale
};
