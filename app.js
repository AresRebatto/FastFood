const express = require("express");
const ejs = require("ejs");
const { MongoClient } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const utils = require("./utils");
const middlewares = require("./middlewares");

const app = express();
const port = process.env.PORT;
const uri = process.env.URI;
const client = new MongoClient(uri);
let db;

// const roleMap = new Map(
// 	["chiave", "valore"]
// )

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

app.post("/login", middlewares.validateCredentials, async (req, res) => {
	try {
		const { email, password } = req.body;
		if (db === null) {
			return res
				.status(500)
				.json({ Error: "Non e' stato possibile connettersi al DB" });
		}
		const users = db.collection("Utente");
		const user = await users.findOne({ email: email });
		if (user === null) {
			return res.status(401).json({ Error: "Credenziali non valide" });
		}
		const passwordValida = await utils.verifyPassword(password, user.password);
		if (!passwordValida) {
			return res.status(401).json({ Error: "Credenziali non valide" });
		}
		const token = utils.generateToken(user._id, user.email, user.ruolo);

		res.cookie("token", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production", // true in produzione
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

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
		const users = db.collection("Utente");
		const user = await users.findOne({ email: req.body.email });
		if (user !== null) {
			return res.status(409).json({ Error: "Email già registrata" });
		}
		const result = await users.insertOne({
			email: email,
			nome: nome,
			cognome: cognome,
			password: await utils.hashPwd(password),
			ruolo: ruolo,
			metodo_pagamento: null,
		});
		const token = utils.generateToken(result.insertedId, email, ruolo);

		res.cookie("token", token, {
			httpOnly: true,
			secure: false, // true quando avrai HTTPS in produzione
			sameSite: "lax",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.status(202).json({ ok: true });
	} catch (err) {
		console.error(err);
		res.status(500).json({ Error: "Errore interno" });
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
