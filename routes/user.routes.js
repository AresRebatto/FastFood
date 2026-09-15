const express = require("express");
const router = express.Router();

// Middlewares e Utility
const middlewares = require("../middlewares");
const authUtils = require("../utils/authUtils");
const cookieUtils = require("../utils/cookie");

// Services
const userServices = require("../services/userServices");
const ristoratoreServices = require("../services/ristoratoreServices");

/**
 * @swagger
 * /profilo:
 *   get:
 *     summary: Visualizza il profilo utente
 *     description: Recupera le informazioni dell'utente autenticato (nome, cognome, metodi di pagamento) e renderizza la vista del profilo.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina profilo renderizzata correttamente (HTML).
 *       404:
 *         description: Utente non trovato o token non valido.
 *       500:
 *         description: Database non connesso o errore interno del server.
 */
router.get("/profilo", middlewares.verifyJWT, async (req, res) => {
	if (!req.user) {
		return res.render("not_found");
	}

	try {
		if (req.db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}
		const user = await userServices.findUserByEmail(req.db, req.user.email);

		//problema di sicurezza in cui utente è entrato con JWT falso
		if (!user) {
			return res.render("not_found");
		}

		res.render(
			"profile",
			{
				nome: user.nome,
				cognome: user.cognome,
				metodi_pagamento: user.metodi_pagamento,
				role: req.user.ruolo
			});

	} catch (err) {
		console.error(err);
		res.status(500).json({ Error: "Errore interno" });
	}


});


/**
 * @swagger
 * /modifica-dati:
 *   post:
 *     summary: Aggiornamento profilo utente
 *     description: Permette di aggiornare nome, cognome, password e i metodi di pagamento dell'utente autenticato.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               password:
 *                 type: string
 *               metodi_pagamento:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     numero_carta:
 *                       type: string
 *                     scadenza:
 *                       type: string
 *                     cvv:
 *                       type: string
 *     responses:
 *       200:
 *         description: Dati aggiornati con successo.
 *       400:
 *         description: Password troppo corta (<8 caratteri), formato metodi pagamento errato o nessun dato fornito per l'aggiornamento.
 *       401:
 *         description: Utente non autenticato o non trovato.
 *       500:
 *         description: Database non connesso o errore durante l'aggiornamento.
 */
router.post("/modifica-dati", middlewares.verifyJWT, async (req, res) => {
	if (req.db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}

	if (!req.user) {
		return res
			.status(401)
			.json({ Error: "Non sei autorizzato. Credenziali non valide" });
	}

	const user = userServices.findUserByEmail(req.db, req.user.email);

	if (!user) {
		return res.status(401).json({ Error: "Utente non trovato" });
	}

	const { nome, cognome, password, metodi_pagamento } = req.body;

	const aggiornamenti = {};

	if (typeof nome === "string" && nome.trim().length > 0) {aggiornamenti.nome = nome.trim();}

	if (typeof cognome === "string" && cognome.trim().length > 0) {aggiornamenti.cognome = cognome.trim();}

	if (typeof password === "string" && password.length > 0) {
		if (password.length < 8) {
			return res.status(400).json({ Error: "La password deve contenere almeno 8 caratteri" });
		}
		aggiornamenti.password = await authUtils.hashPwd(password);
	}

	if (metodi_pagamento !== undefined) {
		if (!Array.isArray(metodi_pagamento)) {
			return res.status(400).json({ Error: "Formato dei metodi di pagamento non valido" });
		}

		for (const carta of metodi_pagamento) {
			if (!authUtils.validaMetodoPagamento(carta)) {
				return res.status(400).json({ Error: "Uno o più metodi di pagamento non sono validi" });
			}
		}

		aggiornamenti.metodi_pagamento = metodi_pagamento.map((carta) => ({
			numero_carta: carta.numero_carta,
			scadenza: carta.scadenza,
			cvv: carta.cvv,
		}));
	}

	if (Object.keys(aggiornamenti).length === 0) {
		return res.status(400).json({ Error: "Nessun dato da aggiornare" });
	}

	try {

		await userServices.updateUserByEmail(req.db, req.user.email, aggiornamenti);
		return res.status(200).json({ Success: "Dati aggiornati con successo" });

	} catch (errore) {
		return res.status(500).json({ Error: "Errore durante l'aggiornamento dei dati" });
	}
});

/**
 * @swagger
 * /cancella-profilo:
 *   delete:
 *     summary: Eliminazione dell'account utente
 *     description: Rimuove l'utente dal sistema. Se l'utente è un ristoratore ('R'), elimina anche tutti i suoi ristoranti e ripulisce gli ordini ad essi associati. Elimina infine il cookie di sessione.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Account eliminato con successo.
 *       401:
 *         description: Utente non autenticato o non trovato.
 *       500:
 *         description: Database non connesso o errore durante la cancellazione dell'utente o dei relativi ristoranti.
 */
router.delete("/cancella-profilo", middlewares.verifyJWT, async (req, res) => {
	if (req.db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}

	if (!req.user) {
		return res
			.status(401)
			.json({ Error: "Non sei autorizzato. Credenziali non valide" });
	}



	try {
		const user = userServices.findUserByEmail(req.db, req.user.email);

		if (!user) {
			return res.status(401).json({ Error: "Utente non trovato" });
		}

		const cancellato = await userServices.deleteUserByEmail(req.db, req.user.email);

		if (req.user.ruolo == "R") {
			ristoratoreServices.eliminaRistorantiDaRistoratore(req.db, req.user.sub);
		}

		if (!cancellato) {
			return res.status(500).json({ Error: "Non e' stato possibile cancellare l'utente" });
		}
	} catch (errore) {
		return res.status(500).json({ Error: "Errore durante la cancellazione del profilo" });
	}

	cookieUtils.clearAuthCookie(res);

	res.status(200).json({ok: true})
	res.redirect("/");
});


module.exports = router;
