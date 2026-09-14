const express = require("express");
const ejs = require("ejs");
const { MongoClient } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();

//utils
const utils = require("./utils");
const cookieUtils = require("./utils/cookie");
const orderUtils = require("./utils/orderUtils");

//services
const userServices = require("./services/userServices");
const restaurantServices = require("./services/restaurantServices");
const mealServices = require("./services/mealServices");
const orderServices = require("./services/orderServices");

const middlewares = require("./middlewares");

const app = express();
const port = process.env.PORT;
const uri = process.env.URI;
const client = new MongoClient(uri);
let db;

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
	if (!req.user) {
		return res.render("not_found");
	}

	try {
		if (db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}
		const user = await userServices.findUserByEmail(db, req.user.email);

		//problema di sicurezza in cui utente è entrato con JWT falso
		if (!user) {
			return res.render("not_found");
		}

		res.render(
			"profile",
			{
				nome: user.nome,
				cognome: user.cognome,
				metodi_pagamento: user.metodi_pagamento
			});

	} catch (err) {
		console.error(err);
		res.status(500).json({ Error: "Errore interno" });
	}


});

app.get("/gestione-ristoranti", middlewares.verifyJWT, async (req, res) => {
	if (!req.user || req.user.ruolo != 'R') {
		return res.render("not_found");
	}

	if (db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}
	try {

		const restaurants = await restaurantServices.findRestaurantsByRistoratoreId(db, req.user.sub);
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

app.get("/search-result/:kind", middlewares.verifyJWT, async (req, res) => {

	if (db === null) {
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

		const results = await restaurantServices.searchByKind(db, kind, q);
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

app.get("/ristorante/:id", middlewares.verifyJWT, async (req, res) => {
	if (db === null) {
		return res
			.status(500)
			.json({ Error: "Non e' stato possibile connettersi al DB" });
	}

	const restaurantId = req.params.id;

	try {
		const restaurant = await restaurantServices.searchByRestaurantId(db, restaurantId)
		res.render("ristorante", { ristorante: restaurant, role: req.user.ruolo });
	} catch (error) {
	 console.error("Errore eliminazione ristorante:", error.message);
    const statusCode = error.statusCode || 500;

    return res
        .status(statusCode)
        .json({ message: error.message || "Errore interno durante la ricerca del ristorante." });
	}
});

app.get("/checkout", middlewares.verifyJWT, async (req, res) => {
  if (db === null) {
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
    const user = await userServices.findUserByEmail(db, req.user.email);
    const metodiPagamento = user ? user.metodi_pagamento : [];

    const ordiniPrecedenti = await orderServices.getTempiOrdiniRistorante(db, datiOrdine.idRistorante);

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

app.get("/ordini", middlewares.verifyJWT, async (req, res) => {
  if (db === null) {
    return res
      .status(500)
      .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user) {
    return res.render("not_found");
  }

  try {
 		const ordini = await orderServices.getOrdiniUtente(db, req.user.sub);

    return res.render("ordini", {
      ordini,
      role: req.user.ruolo
    });
  } catch (err) {
    console.error("Errore checkout:", err.message);
    return res.status(500).json({ Error: "Errore interno." });
  }
});

app.get("/ordini-ricevuti", middlewares.verifyJWT, async (req, res) => {
  if (db === null) {
    return res
      .status(500)
      .json({ Error: "Non e' stato possibile connettersi al DB" });
  }

  if (!req.user || req.user.ruolo != "R") {
    return res.render("not_found");
  }

  try {
 		const ordini = await orderServices.getOrdiniRistoratore(db, req.user.sub);

    return res.render("ordini", {
      ordini,
      role: req.user.ruolo
    });
  } catch (err) {
    console.error("Errore checkout:", err.message);
    return res.status(500).json({ Error: "Errore interno." });
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

app.post("/add-ristorante", middlewares.verifyJWT, async (req, res) => {
	if (db === null) {
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
    const ristoranteCreato = await restaurantServices.addRistorante(db, userId, req.body);


    return res.status(201).json(ristoranteCreato);
  } catch (err) {
      console.error("Errore aggiunta ristorante:", err.message);


      const statusCode = err.statusCode || 500;

      return res
          .status(statusCode)
          .json({ message: err.message || "Errore del server durante l'inserimento." });
  }
});

app.put("/edit-ristoranti/:id", middlewares.verifyJWT, async (req, res) => {
  if (db === null) {
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

    const ristoranteAggiornato = await restaurantServices.updateRistorante(db, ristoranteId, userId, req.body);

    return res.status(200).json(ristoranteAggiornato);
  } catch (err) {
    console.error("Errore aggiornamento ristorante:", err.message);
    const statusCode = err.statusCode || 500;

    return res
        .status(statusCode)
        .json({ message: err.message || "Errore durante l'aggiornamento del ristorante." });
  }
});

app.delete("/ristoranti/:id", middlewares.verifyJWT, async (req, res) => {
  if (db === null) {
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

    const result = await restaurantServices.deleteRistorante(db, ristoranteId, userId);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Errore eliminazione ristorante:", err.message);
    const statusCode = err.statusCode || 500;

    return res
        .status(statusCode)
        .json({ message: err.message || "Errore durante l'eliminazione del ristorante." });
  }
});

app.post("/invia-ordine", middlewares.verifyJWT, async (req, res) => {
	try {
		if (db === null) {
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
		await orderServices.creaOrdineUtente(db, req.user.sub, data);

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

app.post("/invio-ordine", middlewares.verifyJWT, async (req, res) => {
	try {
		if (db === null) {
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

app.post("/invia-ordine", middlewares.verifyJWT, async (req, res) => {
	try {
		if (db === null) {
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

	orderServices.confermaOrdine(db, req.user.sub, idOrdine);
		

	} catch (err) {
		console.error("Errore invio ordine:", err.message);
		const statusCode = err.statusCode || 500;
		return res
			.status(statusCode)
			.json({ Error: err.message || "Errore del server." });
	}

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
