const { ObjectId } = require('mongodb');

async function getStatisticheRistoratore(db, ristoratoreId) {
  try {
    const searchRistoratoreId = typeof ristoratoreId === 'string' ? ristoratoreId : ristoratoreId.toString();

    // 1. Recupero di tutti i ristoranti appartenenti al ristoratore
    const ristoranti = await db.collection('Ristorante').find(
      { ristoratore_id: searchRistoratoreId },
      { projection: { _id: 1, nome: 1 } }
    ).toArray();

    if (!ristoranti || ristoranti.length === 0) {
      const error = new Error('Nessun ristorante trovato per questo ristoratore');
      error.statusCode = 404;
      throw error;
    }

    const ristorantiIdsStr = ristoranti.map((r) => r._id.toString());

    // 2. Definizione del range di date per l'ultima settimana (ultimi 7 giorni da oggi)
    const ora = new Date();
    const setteGiorniFa = new Date();
    setteGiorniFa.setDate(ora.getDate() - 6);
    setteGiorniFa.setHours(0, 0, 0, 0);

    // Mappatura da indice giorno JS (0=Dom, 1=Lun...) al formato di output
    const mappaGiorni = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

    // 3. Estrazione degli ordini da tutti gli utenti per i ristoranti del ristoratore
    // Escludiamo gli ordini annullati (es. con stato 'C' o annullato, adattabile se necessario)
    const utenti = await db.collection('Utente').find(
      { 'ordini.ristorante_id': { $in: ristorantiIdsStr } },
      { projection: { ordini: 1 } }
    ).toArray();

    // Inizializzazione delle strutture dati di calcolo per ogni ristorante
    const statsMap = new Map();
    for (const r of ristoranti) {
      statsMap.set(r._id.toString(), {
        nomeRistorante: r.nome,
        totaleRicavo: 0,
        numeroOrdini: 0,
        incassoUltimaSettimana: { lun: 0, mar: 0, mer: 0, gio: 0, ven: 0, sab: 0, dom: 0 },
        conteggioPiatti: new Map() // idMeal -> { strMeal, qty }
      });
    }

    // 4. Aggregazione dei dati degli ordini
    for (const utente of utenti) {
      for (const ordine of utente.ordini || []) {
        const rId = ordine.ristorante_id?.toString();

        // Consideriamo l'ordine solo se appartiene a uno dei ristoranti del ristoratore
        if (statsMap.has(rId)) {
          const stats = statsMap.get(rId);
          const costo = Number(ordine.costo) || 0;
          const dataOrdine = new Date(ordine.timestamp?.$date || ordine.timestamp);

          // Conteggio totale per il ricavo medio
          stats.totaleRicavo += costo;
          stats.numeroOrdini += 1;

          // Incasso ultima settimana (ultimi 7 giorni)
          if (dataOrdine >= setteGiorniFa && dataOrdine <= ora) {
            const giornoNome = mappaGiorni[dataOrdine.getDay()];
            stats.incassoUltimaSettimana[giornoNome] += costo;
          }

          // Conteggio quantitativo piatti per individuare il piattoTop
          for (const piatto of ordine.piatti || []) {
            const quantità = Number(piatto.qty) || 1;
            const piattoCorrente = stats.conteggioPiatti.get(piatto.idMeal) || {
              strMeal: piatto.strMeal,
              qty: 0
            };
            piattoCorrente.qty += quantità;
            stats.conteggioPiatti.set(piatto.idMeal, piattoCorrente);
          }
        }
      }
    }

    // 5. Formattazione finale del risultato
    const statistiche = Array.from(statsMap.values()).map((stats) => {
      // Calcolo ricavo medio
      const ricavoMedio = stats.numeroOrdini > 0
        ? Number((stats.totaleRicavo / stats.numeroOrdini).toFixed(2))
        : 0;

      // Determinazione del piattoTop
      let piattoTop = null;
      let maxQty = 0;
      for (const [idMeal, info] of stats.conteggioPiatti.entries()) {
        if (info.qty > maxQty) {
          maxQty = info.qty;
          piattoTop = {
            idMeal: idMeal,
            strMeal: info.strMeal,
            totaleVenduto: info.qty
          };
        }
      }

      // Arrotondamento degli incassi settimanali a 2 cifre decimali
      const incassoUltimaSettimana = {};
      for (const giorno of ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']) {
        incassoUltimaSettimana[giorno] = Number(stats.incassoUltimaSettimana[giorno].toFixed(2));
      }

      return {
        nomeRistorante: stats.nomeRistorante,
        ricavoMedio: ricavoMedio,
        incassoUltimaSettimana: incassoUltimaSettimana,
        piattoTop: piattoTop
      };
    });

    return { statistiche };

  } catch (error) {
    console.error('Errore recupero statistiche ristoratore:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}

module.exports = {
	getStatisticheRistoratore
}
