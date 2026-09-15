const express = require("express");
const router = express.Router();

// Middlewares e Utility
const middlewares = require("../middlewares");
const authUtils = require("../utils/authUtils");
const cookieUtils = require("../utils/cookie");

// Services
const userServices = require("../services/userServices");

/**
 * @swagger
 * /login:
 *   get:
 *     summary: Visualizza la pagina di Login
 *     description: Renderizza la form di login ("access"). Se l'utente ha già un token JWT valido, viene reindirizzato alla Home page.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina di login o home renderizzata correttamente (HTML).
 */
router.get("/login", middlewares.verifyJWT, (req, res) => {
	//Se l'utente  è già registrato, lo rimanda alla home
	if (req.user) {
		res.render("index", { role: req.user.ruolo });
	} else {
		res.render("access", { mode: "login" });
	}
});

/**
 * @swagger
 * /signup:
 *   get:
 *     summary: Visualizza la pagina di Registrazione
 *     description: Renderizza la form di registrazione ("access"). Se l'utente ha già un token JWT valido, viene reindirizzato alla Home page.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pagina di registrazione o home renderizzata correttamente (HTML).
 */
router.get("/signup", middlewares.verifyJWT, (req, res) => {
	//Se l'utente  è già registrato, lo rimanda alla home
	if (req.user) {
		res.render("index", { role: req.user.ruolo });
	} else {
		res.render("access", { mode: "signup" });
	}
});


/**
 * @swagger
 * /login:
 *   post:
 *     summary: Autenticazione utente
 *     description: Verifica email e password dell'utente. Se corrette, genera un token JWT e imposta un cookie HTTP-Only.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login effettuato con successo.
 *       401:
 *         description: Credenziali non valide (email errata o password non corrispondente).
 *       500:
 *         description: Database non connesso o errore interno del server.
 */
router.post("/login", middlewares.validateCredentials, async (req, res) => {
	try {
		const { email, password } = req.body;
		if (req.db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}

		const user = await userServices.findUserByEmail(req.db, email);

		if (!user) {
			return res.status(401).json({ Error: "Credenziali non valide" });
		}

		const passwordValida = await authUtils.verifyPassword(password, user.password);
		if (!passwordValida) {
			return res.status(401).json({ Error: "Credenziali non valide" });
		}
		const token = authUtils.generateToken(user._id, user.email, user.ruolo);

		cookieUtils.setAuthCookie(res, token);


		res.status(200).json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ Error: "Errore interno" });
	}
});

/**
 * @swagger
 * /signup:
 *   post:
 *     summary: Registrazione nuovo utente
 *     description: Crea un nuovo profilo utente (Cliente 'C' o Ristoratore 'R'), salva la password cifrata e restituisce un cookie con il token JWT.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - nome
 *               - cognome
 *               - password
 *               - ruolo
 *             properties:
 *               email:
 *                 type: string
 *               nome:
 *                 type: string
 *               cognome:
 *                 type: string
 *               password:
 *                 type: string
 *               ruolo:
 *                 type: string
 *                 enum: [C, R]
 *     responses:
 *       202:
 *         description: Registrazione completata con successo.
 *       400:
 *         description: Dati mancanti o formato ruolo non conforme (deve essere 'C' o 'R').
 *       409:
 *         description: Email già registrata.
 *       500:
 *         description: Database non connesso o errore interno del server.
 */
router.post("/signup", middlewares.validateCredentials, async (req, res) => {
	try {
		const { email, nome, cognome, password, ruolo } = req.body;
		if (!email || !nome || !cognome || !password || !ruolo) {
			return res.status(400).json({
				Error: "Mancano alcuni dei parametri necessari per la registrazione",
			});
		}
		if (ruolo != "R" && ruolo != "C") {
			return res.status(400).json({
				Error: "Formato del ruolo non conforme",
			});
		}
		if (req.db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}

		const user = userServices.findUserByEmail(req.db, email);

		if (!user) {
			return res.status(409).json({ Error: "Email già registrata" });
		}

		const result = await userServices.createUser(req.db, {
      email,
      nome,
      cognome,
      password,
      ruolo
    });

		const token = authUtils.generateToken(result.insertedId, email, ruolo);
		cookieUtils.setAuthCookie(res, token);

		res.status(202).json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ Error: "Errore interno" });
	}
});


/**
 * @swagger
 * /logout:
 *   post:
 *     summary: Disconnessione utente
 *     description: Rimuove il cookie di autenticazione JWT e reindirizza l'utente alla Home Page.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       302:
 *         description: Cookie eliminato e reindirizzamento effettuato alla Home Page.
 */
router.post("/logout", middlewares.verifyJWT, (req, res) => {
	if (!req.user) {
		return res.redirect("/");
	}

	cookieUtils.clearAuthCookie(res);
	res.redirect("/");

});


module.exports = router;
