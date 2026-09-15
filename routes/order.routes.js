const express = require("express");
const router = express.Router();

// Middlewares e Utility
const middlewares = require("../middlewares");
const orderUtils = require("../utils/orderUtils");

// Services
const orderServices = require("../services/orderServices");
const userServices = require("../services/userServices");

/**
 * @swagger
 * /checkout:
 *   get:
 *     summary: Pagina di Checkout e conferma ordine
 *     description: Legge l'ordine temporaneo salvato nei cookie, calcola il tempo di attesa stimato in base agli ordini in coda e mostra la schermata di invio dell'ordine. Il cookie temporaneo viene distrutto subito dopo la lettura.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina checkout renderizzata (HTML).
 *       302:
 *         description: Reindirizzamento a /login (se non autenticato) o alla Home (se il cookie ordine non è presente/valido).
 *       500:
 *         description: Database non connesso o errore interno durante il processo di checkout.
 */
router.get("/checkout", middlewares.verifyJWT, async (req, res) => {
  if (req.db === null) {
    return res
      .status(500)
      .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user) {
    return res.redirect("/login");
  }

  const cookieOrdine = req.cookies.ordineTemporaneo;
  if (!cookieOrdine) {
    return res.redirect("/");
  }

  let datiOrdine;
  try {
    datiOrdine = JSON.parse(cookieOrdine);
  } catch (err) {
    res.clearCookie("ordineTemporaneo");
    return res.redirect("/");
  }

  // Consumato: si cancella subito
  res.clearCookie("ordineTemporaneo");

  try {
    const user = await userServices.findUserByEmail(req.db, req.user.email);
    const metodiPagamento = user ? user.metodi_pagamento : [];

    const ordiniPrecedenti = await orderServices.getTempiOrdiniRistorante(req.db, datiOrdine.idRistorante);

    let tempoAttesa = orderUtils.calcolaTempoAttesaTotale(ordiniPrecedenti, datiOrdine);

    return res.render("invio-ordine", {
      ...datiOrdine,
      metodiPagamento,
      role: req.user.ruolo,
      tempoAttesa
    });
  } catch (err) {
    console.error("Errore checkout:", err.message);
    return res.status(500).json({ Error: "Errore interno durante il checkout." });
  }
});


/**
 * @swagger
 * /ordini:
 *   get:
 *     summary: Visualizza gli ordini dell'utente
 *     description: Recupera lo storico degli ordini effettuati dal cliente autenticato, aggiornandone lo stato in tempo reale.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina storico ordini renderizzata (HTML).
 *       404:
 *         description: Utente non autenticato.
 *       500:
 *         description: Database non connesso o errore interno.
 */
router.get("/ordini", middlewares.verifyJWT, async (req, res) => {
  if (req.db === null) {
    return res
      .status(500)
      .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user) {
    return res.render("not_found");
  }

  try {
 		const ordini = await orderServices.getOrdiniUtente(req.db, req.user.sub);

    return res.render("ordini", {
      ordini,
      role: req.user.ruolo
    });
  } catch (err) {
    console.error("Errore checkout:", err.message);
    return res.status(500).json({ Error: "Errore interno." });
  }
});


/**
 * @swagger
 * /ordini-ricevuti:
 *   get:
 *     summary: Visualizza gli ordini ricevuti dal ristoratore
 *     description: Endpoint riservato ai ristoratori (ruolo 'R'). Mostra gli ordini ricevuti da tutti i propri ristoranti con stato aggiornato.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina ordini ricevuti renderizzata (HTML).
 *       404:
 *         description: Utente non autenticato o ruolo non autorizzato (not_found HTML).
 *       500:
 *         description: Database non connesso o errore interno.
 */
router.get("/ordini-ricevuti", middlewares.verifyJWT, async (req, res) => {
  if (req.db === null) {
    return res
      .status(500)
      .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user || req.user.ruolo != "R") {
    return res.render("not_found");
  }

  try {
 		const ordini = await orderServices.getOrdiniRistoratore(req.db, req.user.sub);

    return res.render("ordini", {
      ordini,
      role: req.user.ruolo
    });
  } catch (err) {
    console.error("Errore checkout:", err.message);
    return res.status(500).json({ Error: "Errore interno." });
  }
});



/**
 * @swagger
 * /invia-ordine:
 *   post:
 *     summary: Conferma ed esecuzione finale dell'ordine
 *     description: Crea e inserisce definitivamente l'ordine nell'array degli ordini dell'utente cliente autenticato.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idRistorante
 *               - totale
 *               - tempoAttesa
 *               - listaProdotti
 *             properties:
 *               idRistorante:
 *                 type: string
 *               totale:
 *                 type: number
 *               tempoAttesa:
 *                 type: number
 *               listaProdotti:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - idMeal
 *                     - strMeal
 *                     - qty
 *                   properties:
 *                     idMeal:
 *                       type: string
 *                     strMeal:
 *                       type: string
 *                     qty:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Ordine inserito correttamente. Restituisce URL di reindirizzamento alla home.
 *       400:
 *         description: Dati della richiesta non validi, incompleti o importi negativi.
 *       401:
 *         description: Utente non autenticato.
 *       404:
 *         description: Utente non trovato nel database.
 *       500:
 *         description: Database non connesso o errore interno.
 */
router.post("/invia-ordine", middlewares.verifyJWT, async (req, res) => {
	try {
		if (req.db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}

		if (!req.user) {
			return res.status(401).json({ Error: "Utente non autenticato", redirectUrl: "/access" });
		}
		const data = req.body;

		if (
    	!data ||
	    typeof data !== 'object' ||
	    !data.idRistorante ||
	    typeof data.totale !== 'number' || data.totale <= 0 ||
	    typeof data.tempoAttesa !== 'number' || data.tempoAttesa < 0 ||
	    !Array.isArray(data.listaProdotti) || data.listaProdotti.length === 0 ||
	    !data.listaProdotti.every(p => p && p.idMeal && p.strMeal && typeof p.qty === 'number' && p.qty > 0)
	  ) {
	    return res.status(400).json({ Error: "Dati richiesta non validi o incompleti." });
	  }

		console.log(data.idRistorante);
		await orderServices.creaOrdineUtente(req.db, req.user.sub, data);

		return res
			.status(200)
			.json({redirectUrl: "/" });

	} catch (err) {
		console.error("Errore invio ordine:", err.message);
		const statusCode = err.statusCode || 500;
		return res
			.status(statusCode)
			.json({ Error: err.message || "Errore del server durante l'invio." });
	}

});


/**
 * @swagger
 * /invio-ordine:
 *   post:
 *     summary: Inizializzazione ordine temporaneo (Carrello -> Checkout)
 *     description: Riceve i dati del carrello dal frontend, ne calcola il totale e li salva in un cookie temporaneo ("ordineTemporaneo") con durata 5 minuti prima di reindirizzare al checkout.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idRistorante
 *               - nomeRistorante
 *               - items
 *             properties:
 *               idRistorante:
 *                 type: string
 *               nomeRistorante:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     price:
 *                       type: number
 *                     qty:
 *                       type: integer
 *     responses:
 *       200:
 *         description: Cookie temporaneo impostato con successo. Restituisce redirectUrl="/checkout".
 *       400:
 *         description: Campi obbligatori o lista articoli mancanti.
 *       401:
 *         description: Utente non autenticato.
 *       500:
 *         description: Database non connesso o errore interno.
 */
router.post("/invio-ordine", middlewares.verifyJWT, async (req, res) => {
	try {
		if (req.db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}

		if (!req.user) {
			return res.status(401).json({ Error: "Utente non autenticato", redirectUrl: "/access" });
		}

		const { idRistorante, nomeRistorante, items } = req.body;

		if (!idRistorante || !nomeRistorante || !items || !Array.isArray(items) || items.length === 0) {
			return res.status(400).json({ Error: "E' necessario fornire tutti i campi obbligatori" });
		}

		console.log(idRistorante);
		const sum = items.reduce((total, item) => total + ((item.price || 0) * (item.qty || 1)), 0);

		const ordineTemporaneo = {
			listaProdotti: items,
			totale: sum,
			idRistorante,
			nomeRistorante
		};


		res.cookie("ordineTemporaneo", JSON.stringify(ordineTemporaneo), {
			httpOnly: true,
			sameSite: "lax",
			maxAge: 5 * 60 * 1000 // 5 minuti
		});

		return res.status(200).json({ redirectUrl: "/checkout" });

	} catch (err) {
		console.error("Errore invio ordine:", err.message);
		const statusCode = err.statusCode || 500;
		return res
			.status(statusCode)
			.json({ Error: err.message || "Errore del server durante l'invio." });
	}
});


/**
 * @swagger
 * /conferma-ordine:
 *   post:
 *     summary: Contrassegna un ordine come Consegnato
 *     description: Aggiorna lo stato di uno specifico ordine dell'utente portandolo al valore 'C' (Consegnato).
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idOrdine
 *             properties:
 *               idOrdine:
 *                 type: string
 *     responses:
 *       200:
 *         description: Stato ordine aggiornato con successo a 'C'.
 *       400:
 *         description: Campo 'idOrdine' mancante.
 *       401:
 *         description: Utente non autenticato.
 *       500:
 *         description: Database non connesso o errore nell'aggiornamento.
 */
router.post("/conferma-ordine", middlewares.verifyJWT, async (req, res) => {
	try {
		if (req.db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}

		if (!req.user) {
			return res.status(401).json({ Error: "Utente non autenticato"});
		}

		const { idOrdine } = req.body;

		if (!idOrdine) {
			return res.status(400).json({ Error: "E' richiesto il campo idOrdine"});
		}

	await orderServices.confermaOrdine(req.db, req.user.sub, idOrdine);

	return res.status(200).json({ok: true});

	} catch (err) {
		console.error("Errore invio ordine:", err.message);
		const statusCode = err.statusCode || 500;
		return res
			.status(statusCode)
			.json({ Error: err.message || "Errore del server." });
	}

});


module.exports = router;
