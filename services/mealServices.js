const fs = require("fs/promises");
const path = require("path");
const { ObjectId } = require('mongodb');


async function getAvailableMealsLocal() {

	const filePath = path.join(__dirname, "../data/meals 1.json");
  const rawData = await fs.readFile(filePath, "utf-8");
  const parsedData = JSON.parse(rawData);


  return parsedData.map(piatto => ({
    idMeal: piatto.idMeal,
    strMeal: piatto.strMeal,
    strCategory: piatto.strCategory,
    strArea: piatto.strArea,
    strMealThumb: piatto.strMealThumb,
		strTags: piatto.strTags,
    price: piatto.price
  }));
}

async function getPiattiConsigliati(db, utenteId, limite = 8) {
  try {
    const searchUserId = typeof utenteId === 'string' ? new ObjectId(utenteId) : utenteId;

    const utente = await db.collection('Utente').findOne(
      { _id: searchUserId },
      { projection: { ordini: 1 } }
    );

    if (!utente) {
      const error = new Error('Utente non trovato');
      error.statusCode = 404;
      throw error;
    }

    // Ordina gli ordini dal più recente al più vecchio
    const ordini = (utente.ordini || [])
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Dedup dei piatti per idMeal, tenendo il riferimento all'ordine più recente in cui compaiono
    const piattiUnici = new Map();
    for (const ordine of ordini) {
      for (const piatto of ordine.piatti || []) {
        if (!piattiUnici.has(piatto.idMeal)) {
          piattiUnici.set(piatto.idMeal, {
            idMeal: piatto.idMeal,
            strMeal: piatto.strMeal,
            ristorante_id: ordine.ristorante_id
          });
        }
      }
      if (piattiUnici.size >= limite) break;
    }

    const listaPiatti = Array.from(piattiUnici.values()).slice(0, limite);

    if (listaPiatti.length === 0) {
      return [];
    }

    // Recupero dei ristoranti coinvolti per pescare nome, thumbnail e prezzo attuali dal menù
    const ristorantiIds = [...new Set(listaPiatti.map((p) => p.ristorante_id))];
    const ristoranti = await db.collection('Ristorante').find(
      { _id: { $in: ristorantiIds.map((id) => new ObjectId(id)) } },
      { projection: { nome: 1, menu: 1 } }
    ).toArray();

    const ristorantiMap = new Map(ristoranti.map((r) => [r._id.toString(), r]));

    const consigliati = listaPiatti
      .map((p) => {
        const ristorante = ristorantiMap.get(p.ristorante_id.toString());
        const piattoMenu = ristorante?.menu?.find((m) => m.idMeal === p.idMeal);

        // Se il ristorante non esiste più o il piatto è stato tolto dal menù, scartiamo la voce
        if (!ristorante || !piattoMenu) return null;

        return {
          idMeal: p.idMeal,
          strMeal: p.strMeal,
          strMealThumb: piattoMenu.strMealThumb,
          price: piattoMenu.price ?? null,
          ristorante_id: p.ristorante_id,
          ristorante_nome: ristorante.nome
        };
      })
      .filter(Boolean);

    return consigliati;
  } catch (error) {
    console.error('Errore recupero piatti consigliati:', error);
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    throw error;
  }
}


module.exports = {
	getAvailableMealsLocal,
	getPiattiConsigliati
};
