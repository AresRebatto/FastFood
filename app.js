const express = require("express");
const ejs = require("ejs");
const { MongoClient } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const utils = require("./utils");
const cookieUtils = require("./utils/cookie")
const userServices = require("./services/userServices");
const middlewares = require("./middlewares");

const app = express();
const port = process.env.PORT;
const uri = process.env.URI;
const client = new MongoClient(uri);
let db;

	// const roleMap = {
	// 	"role": ["page1"]
	// }

	app.set("view engine", "ejs");
	app.use(express.static("public"));
	app.use(express.json());
	app.use(cookieParser());

	app.get("/", middlewares.verifyJWT, (req, res) => {
		if (req.user) {
			res.render("index", { role: req.user.ruolo });
		} else {
			res.render("index", { role: null });
		}
	});

	app.get("/login", middlewares.verifyJWT, (req, res) => {
		//Se l'utente  è già registrato, lo rimanda alla home
		if (req.user) {
			res.render("index", { role: req.user.ruolo });
		} else {
			res.render("access", { mode: "login" });
		}
	});

	app.get("/signup", middlewares.verifyJWT, (req, res) => {
		//Se l'utente  è già registrato, lo rimanda alla home
		if (req.user) {
			res.render("index", { role: req.user.ruolo });
		} else {
			res.render("access", { mode: "signup" });
		}
	});

	app.get("/profilo", middlewares.verifyJWT, async (req, res) => {
		if (req.user) {
			try {
				if (db === null) {
					return res
						.status(500)
						.json({ Error: "Non e' stato possibile connettersi al DB" });
				}
				const users = db.collection("Utente");
				const user = await users.findOne({ email: req.user.email });

				if (user) {
					res.render(
						"profile",
						{
							nome: user.nome,
							cognome: user.cognome,
							metodi_pagamento: user.metodi_pagamento
						});
				} else {
					//TODO problema di sicurezza in cui utente è entrato con JWT falso
				}
			} catch (err) {
				console.error(err);
				res.status(500).json({ Error: "Errore interno" });
			}
		} else {
			res.render("not_found");
		}

	});

	app.post("/login", middlewares.validateCredentials, async (req, res) => {
		try {
			const { email, password } = req.body;
			if (db === null) {
				return res
					.status(500)
					.json({ Error: "Non e' stato possibile connettersi al DB" });
			}

			const user = userServices.findUserByEmail(db, email);

			if (!user) {
				return res.status(401).json({ Error: "Credenziali non valide" });
			}

			const passwordValida = await utils.verifyPassword(password, user.password);
			if (!passwordValida) {
				return res.status(401).json({ Error: "Credenziali non valide" });
			}
			const token = utils.generateToken(user._id, user.email, user.ruolo);

			cookieUtils.setAuthCookie(res, token);


			res.status(200).json({ ok: true });
		} catch (err) {
			console.error(err);
			res.status(500).json({ Error: "Errore interno" });
		}
	});

	app.post("/signup", middlewares.validateCredentials, async (req, res) => {
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
			if (db === null) {
				return res
					.status(500)
					.json({ Error: "Non e' stato possibile connettersi al DB" });
			}

			const user = userServices.findUserByEmail(db, email);

			if (!user) {
				return res.status(409).json({ Error: "Email già registrata" });
			}

			const result = await userServices.createUser(db, {
        email,
        nome,
        cognome,
        password,
        ruolo
      });

			const token = utils.generateToken(result.insertedId, email, ruolo);
			cookieUtils.setAuthCookie(res, token);

			res.status(202).json({ ok: true });
		} catch (err) {
			console.error(err);
			res.status(500).json({ Error: "Errore interno" });
		}
	});

	app.post("/logout", middlewares.verifyJWT, (req, res) => {
		if (!req.user) {
			return res.redirect("/");
		}

		cookieUtils.clearAuthCookie(res);
		res.redirect("/");

	});

	app.post("/modifica-dati", middlewares.verifyJWT, async (req, res) => {
		if (db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}

		if (!req.user) {
			return res
				.status(401)
				.json({ Error: "Non sei autorizzato. Credenziali non valide" });
		}

		const user = userServices.findUserByEmail(db, req.user.email);

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
			aggiornamenti.password = await utils.hashPwd(password);
		}

		if (metodi_pagamento !== undefined) {
			if (!Array.isArray(metodi_pagamento)) {
				return res.status(400).json({ Error: "Formato dei metodi di pagamento non valido" });
			}

			for (const carta of metodi_pagamento) {
				if (!utils.validaMetodoPagamento(carta)) {
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

			await userServices.updateUserByEmail(db, req.user.email, aggiornamenti);
			return res.status(200).json({ Success: "Dati aggiornati con successo" });

		} catch (errore) {
			return res.status(500).json({ Error: "Errore durante l'aggiornamento dei dati" });
		}
	});

app.delete("/cancella-profilo", middlewares.verifyJWT, async (req, res) => {
	if (db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}

	if (!req.user) {
		return res
			.status(401)
			.json({ Error: "Non sei autorizzato. Credenziali non valide" });
	}

	const user = userServices.findUserByEmail(db, req.user.email);

	if (!user) {
		return res.status(401).json({ Error: "Utente non trovato" });
	}

	try {
			const cancellato = await userServices.deleteUserByEmail(db, req.user.email);

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

// Middleware di fallback per il 404
	app.use((req, res, next) => {
		res.status(404).render("not_found");
	});

	async function start() {
		await client.connect();

		const result = await client.db("FastFood").command({ ping: 1 });
		if (result.ok === 1) {
			db = client.db("FastFood");
		} else {
			db = null;
		}

		app.listen(port, () => {
			console.log(`In ascolto sulla porta ${port}`);
		});
	}

	start();
