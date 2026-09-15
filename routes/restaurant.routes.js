const express = require("express");
const router = express.Router();

// Middlewares
const middlewares = require("../middlewares");

// Services
const restaurantServices = require("../services/restaurantServices");
const mealServices = require("../services/mealServices");
const ristoratoreServices = require("../services/ristoratoreServices");
/**
 * @swagger
 * /gestione-ristoranti:
 *   get:
 *     summary: Pagina di gestione dei ristoranti
 *     description: Endpoint riservato ai ristoratori (ruolo 'R'). Recupera i ristoranti associati al ristoratore e la lista dei piatti disponibili localmente.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina gestione ristoranti renderizzata correttamente (HTML).
 *       404:
 *         description: Utente non autenticato o ruolo insufficiente (not_found HTML).
 *       500:
 *         description: Database non connesso o errore interno del server.
 */
router.get("/gestione-ristoranti", middlewares.verifyJWT, async (req, res) => {
	if (!req.user || req.user.ruolo != 'R') {
		return res.render("not_found");
	}

	if (req.db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}
	try {

		const restaurants = await restaurantServices.findRestaurantsByRistoratoreId(req.db, req.user.sub);
		const meals = await mealServices.getAvailableMealsLocal();


			res.render("gestione-ristoranti",
			{
				role: req.user.ruolo,
				ristoranti: restaurants,
				meals: meals
			});

	}catch (err) {
		console.error(err);
		res.status(500).json({ Error: "Errore interno" });
	}

});


/**
 * @swagger
 * /search-result/{kind}:
 *   get:
 *     summary: Ricerca ristoranti o piatti
 *     description: Esegue una ricerca case-insensitive per nome/via se kind='restaurants', o per nome/categoria/area del piatto se kind='dishes'.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: kind
 *         required: true
 *         schema:
 *           type: string
 *           enum: [restaurants, dishes]
 *         description: Tipo di ricerca da effettuare.
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Testo della query di ricerca.
 *     responses:
 *       200:
 *         description: Pagina dei risultati di ricerca renderizzata correttamente (HTML).
 *       400:
 *         description: Parametro query 'q' mancante o non valido.
 *       404:
 *         description: Valore del parametro 'kind' non valido.
 *       500:
 *         description: Database non connesso o errore durante la ricerca.
 */
router.get("/search-result/:kind", middlewares.verifyJWT, async (req, res) => {

	if (req.db === null) {
    return res
        .status(500)
        .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  const { kind } = req.params;
  const { q } = req.query;

  if (kind !== 'restaurants' && kind !== 'dishes') {
    return res.status(404).render("not_found");
  }

  if (!q || typeof q !== 'string' || q.trim() === '') {
    return res.status(400).json({
      message: "La query string 'q' è obbligatoria per effettuare la ricerca (es. ?q=nome)."
    });
  }

  try {

		const results = await restaurantServices.searchByKind(req.db, kind, q);
		console.log(results);
		res.render('search-results', {
			results,
			searchKind: kind,
			query: q,
			role: req.user.ruolo
		})
  } catch (err) {
    console.error("Errore durante la ricerca:", err.message);
    return res.status(500).json({
      message: "Errore interno del server durante la ricerca."
    });
  }
});

/**
 * @swagger
 * /ristorante/{id}:
 *   get:
 *     summary: Visualizza il dettaglio di un ristorante
 *     description: Recupera le informazioni generali e il menù di uno specifico ristorante tramite il suo ID.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID unico del ristorante (ObjectId).
 *     responses:
 *       200:
 *         description: Pagina dettaglio ristorante renderizzata (HTML).
 *       400:
 *         description: Formato ID ristorante non valido.
 *       404:
 *         description: Ristorante non trovato.
 *       500:
 *         description: Database non connesso o errore interno del server.
 */
router.get("/ristorante/:id", middlewares.verifyJWT, async (req, res) => {
	if (req.db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}

	const restaurantId = req.params.id;

	try {
		const restaurant = await restaurantServices.searchByRestaurantId(req.db, restaurantId)
		res.render("ristorante", { ristorante: restaurant, role: req.user.ruolo, idRistorante: restaurantId });
	} catch (error) {
	 console.error("Errore eliminazione ristorante:", error.message);
    const statusCode = error.statusCode || 500;

    return res
        .status(statusCode)
        .json({ message: error.message || "Errore interno durante la ricerca del ristorante." });
	}
});


/**
 * @swagger
 * /add-ristorante:
 *   post:
 *     summary: Aggiunta di un nuovo ristorante
 *     description: Endpoint per soli ristoratori (ruolo 'R'). Inserisce un nuovo ristorante con relativi dati e menù.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - via
 *               - n_tell
 *               - piva
 *             properties:
 *               nome:
 *                 type: string
 *               via:
 *                 type: string
 *               n_tell:
 *                 type: string
 *               piva:
 *                 type: string
 *               menu:
 *                 type: array
 *     responses:
 *       201:
 *         description: Ristorante creato con successo.
 *       400:
 *         description: Campi obbligatori mancanti o Partita IVA non valida (deve contenere esattamente 11 cifre).
 *       401:
 *         description: Non autorizzato (utente non autenticato o non ristoratore).
 *       500:
 *         description: Database non connesso o errore durante l'inserimento.
 */
router.post("/add-ristorante", middlewares.verifyJWT, async (req, res) => {
	if (req.db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}

	if (!req.user || req.user.ruolo != 'R') {
		return res
			.status(401)
			.json({ Error: "Non sei autorizzato ad accedere" });
	}

	try {
    const userId = req.user.sub;
    const ristoranteCreato = await restaurantServices.addRistorante(req.db, userId, req.body);


    return res.status(201).json(ristoranteCreato);
  } catch (err) {
      console.error("Errore aggiunta ristorante:", err.message);


      const statusCode = err.statusCode || 500;

      return res
          .status(statusCode)
          .json({ message: err.message || "Errore del server durante l'inserimento." });
  }
});

/**
 * @swagger
 * /edit-ristoranti/{id}:
 *   put:
 *     summary: Modifica dati di un ristorante
 *     description: Aggiorna le informazioni e/o il menù di uno specifico ristorante gestito dal ristoratore autenticato.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del ristorante da aggiornare.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *               - via
 *               - n_tell
 *               - piva
 *             properties:
 *               nome:
 *                 type: string
 *               via:
 *                 type: string
 *               n_tell:
 *                 type: string
 *               piva:
 *                 type: string
 *               menu:
 *                 type: array
 *     responses:
 *       200:
 *         description: Ristorante aggiornato con successo.
 *       400:
 *         description: ID non valido, campi obbligatori mancanti o P.IVA errata.
 *       401:
 *         description: Non autorizzato (utente non autenticato o ruolo errato).
 *       403:
 *         description: Il ristorante non appartiene al ristoratore autenticato.
 *       404:
 *         description: Ristorante non trovato.
 *       500:
 *         description: Database non connesso o errore del server.
 */
router.put("/edit-ristoranti/:id", middlewares.verifyJWT, async (req, res) => {
  if (req.db === null) {
    return res
        .status(500)
        .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user || req.user.ruolo !== 'R') {
    return res
        .status(401)
        .json({ Error: "Non sei autorizzato ad accedere" });
  }

  try {
    const userId = req.user.sub;
    const ristoranteId = req.params.id;

    const ristoranteAggiornato = await restaurantServices.updateRistorante(req.db, ristoranteId, userId, req.body);

    return res.status(200).json(ristoranteAggiornato);
  } catch (err) {
    console.error("Errore aggiornamento ristorante:", err.message);
    const statusCode = err.statusCode || 500;

    return res
        .status(statusCode)
        .json({ message: err.message || "Errore durante l'aggiornamento del ristorante." });
  }
});

/**
 * @swagger
 * /ristoranti/{id}:
 *   delete:
 *     summary: Eliminazione di un ristorante
 *     description: Rimuove un ristorante dal DB e cancella tutti gli ordini associati a quel ristorante presenti negli account utenti.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del ristorante da eliminare.
 *     responses:
 *       200:
 *         description: Ristorante ed ordini correlati eliminati con successo.
 *       400:
 *         description: ID ristorante non valido.
 *       401:
 *         description: Non autorizzato.
 *       403:
 *         description: Il ristorante non appartiene all'utente loggato.
 *       404:
 *         description: Ristorante non trovato.
 *       500:
 *         description: Database non connesso o errore del server.
 */
router.delete("/ristoranti/:id", middlewares.verifyJWT, async (req, res) => {
  if (req.db === null) {
    return res
        .status(500)
        .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user || req.user.ruolo !== 'R') {
    return res
        .status(401)
        .json({ Error: "Non sei autorizzato ad accedere" });
  }

  try {
    const userId = req.user.sub;
    const ristoranteId = req.params.id;

    const result = await restaurantServices.deleteRistorante(req.db, ristoranteId, userId);
		await restaurantServices.eliminaOrdiniRistorante(req.db, ristoranteId);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Errore eliminazione ristorante:", err.message);
    const statusCode = err.statusCode || 500;

    return res
        .status(statusCode)
        .json({ message: err.message || "Errore durante l'eliminazione del ristorante." });
  }
});

/**
 * @swagger
 * /statistiche:
 *   get:
 *     summary: Dashboard statistiche per il ristoratore
 *     description: Endpoint riservato ai ristoratori (ruolo 'R'). Raccoglie e calcola il ricavo medio, l'incasso dell'ultima settimana e il piatto più venduto per ogni ristorante gestito.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina statistiche renderizzata (HTML).
 *       404:
 *         description: Utente non autenticato, ruolo non autorizzato o nessun ristorante trovato.
 *       500:
 *         description: Database non connesso o errore interno.
 */
router.get("/statistiche", middlewares.verifyJWT, async (req, res) => {
  if (req.db === null) {
    return res
      .status(500)
      .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user || req.user.ruolo != "R") {
    return res.render("not_found");
  }

  try {
  const { statistiche } = await ristoratoreServices.getStatisticheRistoratore(req.db, req.user.sub);

    return res.render("statistiche", {
      statistiche,
      role: req.user.ruolo
    });
  } catch (err) {
    console.error("Errore checkout:", err.message);
    return res.status(500).json({ Error: "Errore interno." });
  }
});


module.exports = router;