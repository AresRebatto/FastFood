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
    return await restaurants.find({
      $or: [
        { ristoratore_id: searchId },
        { ristoratore_id: ristoratoreId.toString() }
      ]
    }).toArray();
}

module.exports = {
  findRestaurantsByRistoratoreId,
};