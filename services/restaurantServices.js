const { ObjectId } = require("mongodb");

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


  // Cerchiamo sia con l'ObjectId formattato che con il valore stringa originale
	const findedRestaurant = await restaurants.find({
		$or: [
			{ ristoratore_id: searchId },
			{ ristoratore_id: ristoratoreId.toString() }
		]
	}).toArray();

  return findedRestaurant;
}

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

module.exports = {
	findRestaurantsByRistoratoreId,
  addRistorante
};
