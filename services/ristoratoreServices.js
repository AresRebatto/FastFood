const { ObjectId } = require('mongodb');

/**
 * Calcola e restituisce le statistiche delle vendite per tutti i ristoranti gestiti da un determinato ristoratore.
 * 
 * Processa le seguenti metriche per ciascun ristorante:
 * - Ricavo medio per ordine.
 * - Incasso giornaliero dettagliato degli ultimi 7 giorni (dal lunedì alla domenica).
 * - Piatto più venduto (piattoTop) in termini di quantità complessiva ordinata.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string|import('mongodb').ObjectId} ristoratoreId - L'ID del ristoratore di cui recuperare le statistiche.
 * @returns {Promise<{
 *   statistiche: Array<{
 *     nomeRistorante: string,
 *     ricavoMedio: number,
 *     incassoUltimaSettimana: { lun: number, mar: number, mer: number, gio: number, ven: number, sab: number, dom: number },
 *     piattoTop: { idMeal: string, strMeal: string, totaleVenduto: number } | null
 *   }>
 * }>} Oggetto contenente l'array con le statistiche elaborate per ogni ristorante.
 * @throws {Error} Con `statusCode = 404` se non viene trovato alcun ristorante associato al ristoratore.
 * @throws {Error} Con `statusCode = 500` per eventuali errori di query o esecuzione generici durante l'elaborazione.
 */
async function getStatisticheRistoratore(db, ristoratoreId) {
  try {
    const searchRistoratoreId = typeof ristoratoreId === 'string' ? ristoratoreId : ristoratoreId.toString();

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

    const ora = new Date();
    const setteGiorniFa = new Date();
    setteGiorniFa.setDate(ora.getDate() - 6);
    setteGiorniFa.setHours(0, 0, 0, 0);

    // Mappatura da indice giorno JS (0=Dom, 1=Lun...) al formato di output
    const mappaGiorni = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

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


/**
 * Elimina tutti i ristoranti associati a un ristoratore e ripulisce
 * tutti gli ordini ad essi collegati presenti nella collection Utente.
 * @param {string|ObjectId} ristoratoreId - L'ID del ristoratore.
 * @param {Db} db - L'istanza del database MongoDB.
 */
async function eliminaRistorantiDaRistoratore(ristoratoreId, db) {
  const idStr = ristoratoreId.toString();


  const ristoranti = await db.collection('Ristorante')
    .find({ ristoratore_id: idStr }, { projection: { _id: 1 } })
    .toArray();

  if (ristoranti.length > 0) {
    const ristorantiIds = ristoranti.map(r => r._id.toString());

    await db.collection('Utente').updateMany(
      { "ordini.ristorante_id": { $in: ristorantiIds } },
      {
        $pull: {
          ordini: { ristorante_id: { $in: ristorantiIds } }
        }
      }
    );

    const deleteResult = await db.collection('Ristorante').deleteMany({
      ristoratore_id: idStr
    });

    return deleteResult;
  }

  return { deletedCount: 0 };
}

module.exports = {
	getStatisticheRistoratore,
	eliminaRistorantiDaRistoratore
}
