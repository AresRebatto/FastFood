const { ObjectId } = require("mongodb");

/**
 * Recupera tutti i ristoranti associati a uno specifico ID ristoratore.
 * Gestisce la ricerca sia se l'ID è memorizzato come ObjectId sia come Stringa.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string|import('mongodb').ObjectId} ristoratoreId - L'ID del ristoratore da cercare.
 * @returns {Promise<Array<Object>>} Una promise che risolve con un array di documenti ristorante trovati. Restituisce un array vuoto se `ristoratoreId` non è fornito.
 */
async function findRestaurantsByRistoratoreId(db, ristoratoreId) {
	if (!ristoratoreId) {
    return [];
  }

  const restaurants = db.collection("Ristorante");

  // Gestisce sia il caso in cui ristoratore_id sia salvato come ObjectId che come Stringa
  let searchId = ristoratoreId;
  if (typeof ristoratoreId === "string" && ObjectId.isValid(ristoratoreId)) {
    searchId = new ObjectId(ristoratoreId);
}

	const findedRestaurant = await restaurants.find({
		$or: [
			{ ristoratore_id: searchId },
			{ ristoratore_id: ristoratoreId.toString() }
		]
	}).toArray();

  return findedRestaurant;
}

/**
 * Aggiunge un nuovo ristorante nel database previa validazione dei dati obbligatori e della Partita IVA.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string|import('mongodb').ObjectId} userId - L'ID dell'utente ristoratore che crea il ristorante.
 * @param {Object} data - I dati del ristorante da inserire.
 * @param {string} data.nome - Nome del ristorante.
 * @param {string} data.via - Indirizzo del ristorante.
 * @param {string} data.n_tell - Numero di telefono del ristorante.
 * @param {string|number} data.piva - Partita IVA (deve contenere esattamente 11 cifre).
 * @param {Array<Object>} [data.menu=[]] - Array contenente la lista dei piatti/menù.
 * @returns {Promise<Object>} Il documento del ristorante creato, completo di `_id` generato e timestamp `createdAt`.
 * @throws {Error} Con `statusCode = 400` se mancano campi obbligatori o la P.IVA non è valida (non ha 11 cifre).
 */
async function addRistorante(db, userId, data) {
    const { nome, via, n_tell, piva, menu } = data;

    // Controllo presenza campi obbligatori -> 400 Bad Request
    if (!nome || !via || !n_tell || !piva) {
        const error = new Error("Tutti i campi (nome, via, telefono, P.IVA) sono obbligatori.");
        error.statusCode = 400;
        throw error;
    }

    const pivaClean = String(piva).trim();
    if (pivaClean.length !== 11 || !/^\d{11}$/.test(pivaClean)) {
        const error = new Error("La partita IVA deve contenere esattamente 11 cifre numeriche.");
        error.statusCode = 400;
        throw error;
    }

    // Struttura del documento da salvare nella collection Ristorante
    const newRistorante = {
        ristoratore_id: userId,
        nome: nome.trim(),
        via: via.trim(),
        n_tell: n_tell.trim(),
        piva: pivaClean,
        menu: Array.isArray(menu) ? menu : [],
        createdAt: new Date()
    };

    const collection = db.collection("Ristorante");
    const result = await collection.insertOne(newRistorante);

    return {
        _id: result.insertedId,
        ...newRistorante
    };
}

/**
 * Aggiorna i dati di un ristorante esistente previa verifica dei permessi dell'utente e validazione dell'input.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string|import('mongodb').ObjectId} ristoranteId - L'ID del ristorante da aggiornare.
 * @param {string|import('mongodb').ObjectId} userId - L'ID dell'utente che richiede la modifica.
 * @param {Object} data - I nuovi dati con cui aggiornare il ristorante.
 * @param {string} data.nome - Nuovo nome del ristorante.
 * @param {string} data.via - Nuovo indirizzo del ristorante.
 * @param {string} data.n_tell - Nuovo numero di telefono.
 * @param {string|number} data.piva - Nuova Partita IVA (deve contenere esattamente 11 cifre).
 * @param {Array<Object>} [data.menu=[]] - Nuovo array menù.
 * @returns {Promise<Object>} L'oggetto aggiornato con l'ID, il ristoratore e i dati aggiornati con timestamp `updatedAt`.
 * @throws {Error} Con `statusCode = 400` se l'ID ristorante non è valido, se mancano campi obbligatori o la P.IVA è errata.
 * @throws {Error} Con `statusCode = 404` se il ristorante non viene trovato nel database.
 * @throws {Error} Con `statusCode = 403` se l'utente non è il proprietario del ristorante.
 */
async function updateRistorante(db, ristoranteId, userId, data) {
  // Validazione ID MongoDB
  if (!ObjectId.isValid(ristoranteId)) {
    const error = new Error("ID ristorante non valido.");
    error.statusCode = 400;
    throw error;
  }

  const { nome, via, n_tell, piva, menu } = data;

  // Controllo campi obbligatori
  if (!nome || !via || !n_tell || !piva) {
    const error = new Error("Tutti i campi (nome, via, telefono, P.IVA) sono obbligatori.");
    error.statusCode = 400;
    throw error;
  }

  const pivaClean = String(piva).trim();
  if (pivaClean.length !== 11 || !/^\d{11}$/.test(pivaClean)) {
    const error = new Error("La partita IVA deve contenere esattamente 11 cifre numeriche.");
    error.statusCode = 400;
    throw error;
  }

  const collection = db.collection("Ristorante");

  // Verifica esistenza e proprietà del ristorante
  const ristorante = await collection.findOne({ _id: new ObjectId(ristoranteId) });

  if (!ristorante) {
    const error = new Error("Ristorante non trovato.");
    error.statusCode = 404;
    throw error;
  }

  if (ristorante.ristoratore_id.toString() !== userId.toString()) {
    const error = new Error("Non sei autorizzato a modificare questo ristorante.");
    error.statusCode = 403;
    throw error;
  }

  const updatedData = {
    nome: nome.trim(),
    via: via.trim(),
    n_tell: n_tell.trim(),
    piva: pivaClean,
    menu: Array.isArray(menu) ? menu : [],
    updatedAt: new Date()
  };

  await collection.updateOne(
    { _id: new ObjectId(ristoranteId) },
    { $set: updatedData }
  );

  return {
    _id: ristoranteId,
    ristoratore_id: userId,
    ...updatedData
  };
}

/**
 * Elimina un ristorante dal database previa verifica di esistenza e autorizzazione del proprietario.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string|import('mongodb').ObjectId} ristoranteId - L'ID del ristorante da eliminare.
 * @param {string|import('mongodb').ObjectId} userId - L'ID dell'utente che richiede l'eliminazione.
 * @returns {Promise<{message: string}>} Un oggetto di conferma con un messaggio di successo.
 * @throws {Error} Con `statusCode = 400` se l'ID ristorante fornito non è un ID MongoDB valido.
 * @throws {Error} Con `statusCode = 404` se il ristorante non viene trovato nel database.
 * @throws {Error} Con `statusCode = 403` se l'utente non è il proprietario del ristorante.
 */
async function deleteRistorante(db, ristoranteId, userId) {
  if (!ObjectId.isValid(ristoranteId)) {
    const error = new Error("ID ristorante non valido.");
    error.statusCode = 400;
    throw error;
  }

  const collection = db.collection("Ristorante");

  const ristorante = await collection.findOne({ _id: new ObjectId(ristoranteId) });

  if (!ristorante) {
    const error = new Error("Ristorante non trovato.");
    error.statusCode = 404;
    throw error;
  }

  if (ristorante.ristoratore_id.toString() !== userId.toString()) {
    const error = new Error("Non sei autorizzato ad eliminare questo ristorante.");
    error.statusCode = 403;
    throw error;
  }

  await collection.deleteOne({ _id: new ObjectId(ristoranteId) });

  return { message: "Ristorante eliminato con successo." };
}

/**
 * Rimuove tutti gli ordini relativi a un determinato ristorante da tutti gli utenti.
 * @param {string|ObjectId} ristoranteId - L'ID del ristorante da rimuovere dagli ordini.
 * @param {Db} db - L'istanza del database MongoDB.
 * @returns {Promise<UpdateResult>}
 */
async function eliminaOrdiniRistorante(db, ristoranteId) {
  const idStr = ristoranteId.toString();

  const result = await db.collection('Utente').updateMany(
    { "ordini.ristorante_id": idStr }, // Filtra solo gli utenti che hanno ordinato da quel ristorante
    { 
      $pull: { 
        ordini: { ristorante_id: idStr } // Se la proprietà nell'ordine ha un nome diverso (es. ristoranteId), adatta questo campo
      } 
    }
  );

  return result;
}

async function searchByKind(db, kind, q) {
	const queryRegex = new RegExp(q.trim(), 'i');
	console.log(queryRegex);
  const collection = db.collection("Ristorante");
  const DISTANZA_MOCK = 2.5; // Distanza cablata per ora

  if (kind === 'restaurants') {
      // Cerca ristoranti per nome o via
      const ristoranti = await collection.find({
          $or: [
              { nome: queryRegex },
              { via: queryRegex }
          ]
      }).toArray();

      // Mappatura con le sole chiavi richieste per restaurant
      return ristoranti.map(r => ({
          id: r._id,
          nome: r.nome,
          via: r.via,
          distanza_km: DISTANZA_MOCK,
          kind: 'restaurant'
      }));
  }

  if (kind === 'dishes') {
      // Cerca i ristoranti che contengono il piatto cercato nel menu
    const ristoranti = await collection.find({
        menu: {
            $elemMatch: {
                $or: [
                    { strMeal: queryRegex },
                    { strCategory: queryRegex },
                    { strArea: queryRegex }
                ]
            }
        }
      }).toArray();

      const risultatiPiatti = [];

      // Per ogni ristorante, estraiamo solo i singoli piatti che matchano la ricerca
      for (const r of ristoranti) {
          const piattiMatch = (r.menu || []).filter(p =>
              queryRegex.test(p.strMeal || '') ||
              queryRegex.test(p.strCategory || '') ||
              queryRegex.test(p.strArea || '')
          );

          for (const piatto of piattiMatch) {
              risultatiPiatti.push({
                  id: r._id, // ID del ristorante
                  nome: r.nome,
                  via: r.via,
                  distanza_km: DISTANZA_MOCK,
                  kind: 'plate',
                  idMeal: piatto.idMeal,
                  strMeal: piatto.strMeal,
                  strCategory: piatto.strCategory,
                  strMealThumb: piatto.strMealThumb,
                  price: piatto.price
              });
          }
		}

      return risultatiPiatti;
  }

  return [];
}

async function searchByRestaurantId(db, id) {
 if (!ObjectId.isValid(id)) {
    const error = new Error("ID ristorante non valido.");
    error.statusCode = 400;
    throw error;
  }

  const collection = db.collection("Ristorante");

	const ristorante = await collection.findOne({ _id: new ObjectId(id) });

	if (!ristorante) {
    const error = new Error("Ristorante non trovato.");
    error.statusCode = 404;
    throw error;
  }

	return {
		nome: ristorante.nome,
    via: ristorante.via,
    n_tell: ristorante.n_tell,
		menu: (ristorante.menu || []).map((meal) => ({
			idMeal: meal.idMeal,
      strMeal: meal.strMeal,
      strCategory: meal.strCategory,
      strMealThumb: meal.strMealThumb,
      strTags: meal.strTags,
      price: meal.price,
    })),
  };
}
module.exports = {
	findRestaurantsByRistoratoreId,
	addRistorante,
	updateRistorante,
	deleteRistorante,
	searchByKind,
	searchByRestaurantId,
  eliminaOrdiniRistorante
};
