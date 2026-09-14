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
 * Recupera e formatta tutti gli ordini di un utente specifico.
 * @param {Db} db - Istanza del database MongoDB
 * @param {string|ObjectId} utenteId - ID dell'utente
 * @returns {Promise<Array>} Lista degli ordini formattati dell'utente
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

module.exports = {
	getTempiOrdiniRistorante,
	creaOrdineUtente,
  getOrdiniUtente
};
