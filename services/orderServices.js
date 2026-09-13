/**
 * Recupera solo timestamp e tempo_stimato degli ordini 'O' o 'P' per un ristorante.
 * @param {Db} db - Istanza del database MongoDB
 * @param {string|ObjectId} idRistorante - ID del ristorante
 * @returns {Promise<Array<{timestamp: Date|string, tempo_stimato: number}>>}
 */
async function getTempiOrdiniRistorante(db, idRistorante) {
  try {
    return await db.collection('Utente').aggregate([
			{ $unwind: '$ordini' },
      
      {
        $match: {
          'ordini.ristorante_id': idRistorante,
          'ordini.stato': { $in: ['O', 'P'] }
        }
      },

      {
        $project: {
          _id: 0,
          timestamp: '$ordini.timestamp',
          tempo_stimato: '$ordini.tempo_stimato'
        }
      }
    ]).toArray();
  } catch (error) {
		console.error('Errore recupero tempi ordini:', error);
    error.statusCode = 404;
    throw error;
  }
}

module.exports = {
  getTempiOrdiniRistorante
};
