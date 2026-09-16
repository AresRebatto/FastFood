const { ObjectId } = require('mongodb');
const { calcolaMinutiTrascorsi } = require('../utils/orderUtils');

/**
 * Recupera solo timestamp e tempo_stimato degli ordini 'O' o 'P' per un ristorante.
 * @param {Db} db - Istanza del database MongoDB
 * @param {string|ObjectId} idRistorante - ID del ristorante
 * @returns {Promise<Array<{timestamp: Date|string, tempo_stimato: number}>>}
 */
async function getTempiOrdiniRistorante(db, idRistorante) {
  try {
    const ordiniAttivi = await db.collection('Utente').aggregate([
      { $unwind: '$ordini' },
      {
        $match: {
          'ordini.ristorante_id': idRistorante,
          'ordini.stato': { $ne: 'C' } // Consideriamo tutti quelli non ancora consegnati
        }
      },
      {
        $project: {
          _id: 0,
          utenteId: '$_id',
          idOrdine: '$ordini._id',
          stato: '$ordini.stato',
          timestamp: '$ordini.timestamp',
          tempo_stimato: '$ordini.tempo_stimato',
          piatti: '$ordini.piatti'
        }
      }
    ]).toArray();

    const tempiValidi = [];

    await Promise.all(
      ordiniAttivi.map(async (ord) => {
        const { nuovoStato } = await aggiornaStatoOrdineDB(
          db,
          ord.utenteId,
          ord.idOrdine,
          ord.stato,
          ord.tempo_stimato,
          ord.timestamp,
          ord.piatti
        );

        // Teniamo solo quelli il cui stato attuale è 'O' o 'P'
        if (nuovoStato === 'O' || nuovoStato === 'P') {
          tempiValidi.push({
            timestamp: ord.timestamp,
            tempo_stimato: ord.tempo_stimato
          });
        }
      })
    );

    return tempiValidi;

  } catch (error) {
    console.error('Errore recupero tempi ordini:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}



/**
 * Inserisce un nuovo ordine nell'array ordini dell'utente specificato.
 * @param {Db} db - Istanza del database MongoDB
 * @param {string|ObjectId} utenteId - ID dell'utente
 * @param {Object} data - Dati dell'ordine (listaProdotti, totale, tempoAttesa, idRistorante)
 * @returns {Promise<Object>} Risultato dell'operazione di update
 */
async function creaOrdineUtente(db, utenteId, data) {
  try {
    const searchUserId = typeof utenteId === 'string' ? new ObjectId(utenteId) : utenteId;

    // Mappatura della lista prodotti per estrarre solo i campi richiesti nello schema
    const piatti = (data.listaProdotti || []).map((p) => ({
      idMeal: p.idMeal,
      strMeal: p.strMeal,
      qty: p.qty
    }));


    const nuovoOrdine = {
      _id: new ObjectId(),
      stato: 'O',
      timestamp: new Date(),
      costo: data.totale,
      ristorante_id: data.idRistorante,
      tempo_stimato: data.tempoAttesa,
      numero_piatti: data.listaProdotti ? data.listaProdotti.length : 0,
      piatti
    };

    // Inserimento dell'ordine nell'array 'ordini' dell'utente
    const result = await db.collection('Utente').updateOne(
      { _id: searchUserId },
      { $push: { ordini: nuovoOrdine } }
    );

    if (result.matchedCount === 0) {
      const error = new Error('Utente non trovato');
      error.statusCode = 404;
      throw error;
    }

    return result;
  } catch (error) {
    console.error('Errore creazione ordine:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}

async function aggiornaStatoOrdineDB(db, utenteId, idOrdine, statoAttuale, tempoStimato, timestamp, piatti) {
  const oraCorrente = new Date();
  const dataOrdine = new Date(timestamp);
  const minutiTrascorsi = Math.floor((oraCorrente - dataOrdine) / (1000 * 60));

  const numeroPiattiTotale = (piatti || []).reduce((acc, p) => acc + (p.qty || 1), 0);
  const tempoPreparazione = numeroPiattiTotale * 15;
  const soglia = (tempoStimato || 0) - minutiTrascorsi - tempoPreparazione;


  let nuovoStato = statoAttuale;


  if (statoAttuale !== 'C') {
    if (soglia > 0) {
      nuovoStato = 'O'; // Ordinato
    } else if (soglia <= 0 && soglia >= -tempoPreparazione) {
      nuovoStato = 'P'; // In preparazione
    } else if (soglia < -tempoPreparazione) {
      nuovoStato = '>'; // In consegna
    }
  }

  if (nuovoStato !== statoAttuale) {
    await db.collection('Utente').updateOne(
      {
        _id: new ObjectId(utenteId),
        'ordini._id': new ObjectId(idOrdine)
      },
      {
        $set: { 'ordini.$.stato': nuovoStato }
      }
    );
  }

  return { nuovoStato, minutiTrascorsi };
}

/**
 * Recupera e formatta tutti gli ordini effettuati da un determinato utente,
 * ricalcolando e aggiornando automaticamente il loro stato nel database.
 *
 * @param {Db} db - Istanza del database MongoDB
 * @param {string|ObjectId} utenteId - ID dell'utente
 * @returns {Promise<Array<{
 *   _id: ObjectId|string,
 *   stato: string,
 *   costo: number,
 *   nome_ristorante: string,
 *   via_ristorante: string,
 *   tempo_rimanente: number,
 *   piatti: Array<{ strMeal: string, qty: number }>
 * }>>} Lista degli ordini dell'utente con stato aggiornato
 */
async function getOrdiniUtente(db, utenteId) {
  try {
    const searchUserId = typeof utenteId === 'string' ? new ObjectId(utenteId) : utenteId;

    const ordiniGrezzi = await db.collection('Utente').aggregate([
      { $match: { _id: searchUserId } },

      { $unwind: '$ordini' },

      {
        $addFields: {
          'ordini.ristorante_obj_id': {
            $toObjectId: '$ordini.ristorante_id'
          }
        }
      },

      {
        $lookup: {
          from: 'Ristorante',
          localField: 'ordini.ristorante_obj_id',
          foreignField: '_id',
          as: 'infoRistorante'
        }
      },

      {
        $unwind: {
          path: '$infoRistorante',
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $project: {
          _id: 0,
          idOrdine: '$ordini._id',
          stato: '$ordini.stato',
          costo: '$ordini.costo',
          timestamp: '$ordini.timestamp',
          tempo_stimato: '$ordini.tempo_stimato',
          nome_ristorante: { $ifNull: ['$infoRistorante.nome', 'Ristorante Sconosciuto'] },
          via_ristorante: { $ifNull: ['$infoRistorante.via', 'Indirizzo non disponibile'] },
          piatti: {
            $map: {
              input: '$ordini.piatti',
              as: 'p',
              in: {
                strMeal: '$$p.strMeal',
                qty: '$$p.qty'
              }
            }
          }
        }
      },

      { $sort: { timestamp: -1 } }
    ]).toArray();

    // Mappiamo ed elaboriamo gli ordini (con aggiornamento stato in parallelo tramite Promise.all)
    const ordiniAggiornati = await Promise.all(
      ordiniGrezzi.map(async (ord) => {
        const { nuovoStato, minutiTrascorsi } = await aggiornaStatoOrdineDB(
          db,
          searchUserId,
          ord.idOrdine,
          ord.stato,
          ord.tempo_stimato,
          ord.timestamp,
          ord.piatti
        );

        const minutiRimanenti = (ord.tempo_stimato || 0) - minutiTrascorsi;

        return {
          _id: ord.idOrdine,
          stato: nuovoStato, // Restituisce lo stato aggiornato
          costo: ord.costo,
          nome_ristorante: ord.nome_ristorante,
          via_ristorante: ord.via_ristorante,
          tempo_rimanente: Math.max(0, minutiRimanenti),
          piatti: ord.piatti || []
        };
      })
    );

    return ordiniAggiornati;

  } catch (error) {
    console.error('Errore recupero ordini utente:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}

/**
 * Recupera e formatta tutti gli ordini ricevuti dai ristoranti gestiti da uno specifico ristoratore,
 * aggiornando contestualmente lo stato di ciascun ordine nel database.
 *
 * @param {Db} db - Istanza del database MongoDB
 * @param {string|ObjectId} ristoratoreId - ID dell'utente ristoratore
 * @returns {Promise<Array<{
 *   _id: ObjectId|string,
 *   stato: string,
 *   costo: number,
 *   nome_ristorante: string,
 *   via_ristorante: string,
 *   tempo_rimanente: number,
 *   piatti: Array<{ idMeal: string, strMeal: string, qty: number }>
 * }>>} Lista degli ordini ricevuti dai ristoranti dell'utente
 */
async function getOrdiniRistoratore(db, ristoratoreId) {
  try {
    const searchRistoratoreId = typeof ristoratoreId === 'string' ? ristoratoreId : ristoratoreId.toString();

    const ristoranti = await db.collection('Ristorante')
      .find({ ristoratore_id: searchRistoratoreId }, { projection: { _id: 1 } })
      .toArray();

    if (!ristoranti || ristoranti.length === 0) {
      return [];
    }

    const ristoranteIdsString = ristoranti.map(r => r._id.toString());

    const ordiniGrezzi = await db.collection('Utente').aggregate([
      { $unwind: '$ordini' },

      // Filtriamo gli ordini rivolti ai ristoranti di questo ristoratore
      {
        $match: {
          'ordini.ristorante_id': { $in: ristoranteIdsString }
        }
      },

      {
        $addFields: {
          'ordini.ristorante_obj_id': {
            $toObjectId: '$ordini.ristorante_id'
          }
        }
      },

      // Recuperiamo le info del ristorante per nome e via
      {
        $lookup: {
          from: 'Ristorante',
          localField: 'ordini.ristorante_obj_id',
          foreignField: '_id',
          as: 'infoRistorante'
        }
      },

      {
        $unwind: {
          path: '$infoRistorante',
          preserveNullAndEmptyArrays: true
        }
      },

      // Proiettiamo i campi necessari
      {
        $project: {
          _id: 0,
          clienteId: '$_id',
          idOrdine: '$ordini._id',
          stato: '$ordini.stato',
          costo: '$ordini.costo',
          timestamp: '$ordini.timestamp',
          tempo_stimato: '$ordini.tempo_stimato',
          nome_ristorante: { $ifNull: ['$infoRistorante.nome', 'Ristorante Sconosciuto'] },
          via_ristorante: { $ifNull: ['$infoRistorante.via', 'Indirizzo non disponibile'] },
          piatti: {
            $map: {
              input: '$ordini.piatti',
              as: 'p',
              in: {
                idMeal: '$$p.idMeal',
                strMeal: '$$p.strMeal',
                qty: '$$p.qty'
              }
            }
          }
        }
      },

      // Ordiniamo per data decrescente (i più recenti in alto)
      { $sort: { timestamp: -1 } }
    ]).toArray();

    const ordiniAggiornati = await Promise.all(
      ordiniGrezzi.map(async (ord) => {
        // Eseguiamo il ricalcolo e l'aggiornamento automatico dello stato
        const { nuovoStato, minutiTrascorsi } = await aggiornaStatoOrdineDB(
          db,
          ord.clienteId,
          ord.idOrdine,
          ord.stato,
          ord.tempo_stimato,
          ord.timestamp,
          ord.piatti
        );

        const minutiRimanenti = (ord.tempo_stimato || 0) - minutiTrascorsi;

        return {
          _id: ord.idOrdine,
          stato: nuovoStato,
          costo: ord.costo,
          nome_ristorante: ord.nome_ristorante,
          via_ristorante: ord.via_ristorante,
          tempo_rimanente: Math.max(0, minutiRimanenti),
          piatti: ord.piatti || []
        };
      })
    );

    return ordiniAggiornati;

  } catch (error) {
    console.error('Errore recupero ordini ristoratore:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}

/**
 * Aggiorna lo stato di uno specifico ordine portandolo a 'C' (Consegnato).
 * 
 * @param {Db} db - Istanza del database MongoDB
 * @param {string|ObjectId} utenteId - ID dell'utente proprietario dell'ordine
 * @param {string|ObjectId} idOrdine - ID dell'ordine da aggiornare
 * @returns {Promise<boolean>} True se l'ordine è stato aggiornato con successo, false altrimenti
 */
async function confermaOrdine(db, utenteId, idOrdine) {
  try {
    const searchUserId = typeof utenteId === 'string' ? new ObjectId(utenteId) : utenteId;
    const searchOrderId = typeof idOrdine === 'string' ? new ObjectId(idOrdine) : idOrdine;

    const result = await db.collection('Utente').updateOne(
      {
        _id: searchUserId,
        'ordini._id': searchOrderId
      },
      {
        $set: {
          'ordini.$.stato': 'C'
        }
      }
    );

    // Ritorna true se ha trovato l'ordine e ne ha modificato lo stato
    return result.modifiedCount > 0;

  } catch (error) {
    console.error('Errore aggiornamento ordine a C:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}
module.exports = {
	getTempiOrdiniRistorante,
	creaOrdineUtente,
	getOrdiniUtente,
	getOrdiniRistoratore,
  confermaOrdine
};
