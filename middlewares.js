const jwt = require("jsonwebtoken");

function validateCredentials(req, res, next) {
	const { email, password } = req.body;

	// Verifica presenza dei campi
	if (!email || !password) {
		return res.status(400).json({
			error: "Email e password sono campi obbligatori",
		});
	}

	// Verifica che siano stringhe (evita injection di oggetti/array)
	if (typeof email !== "string" || typeof password !== "string") {
		return res.status(400).json({
			error: "Email e password devono essere stringhe",
		});
	}

	// Verifica formato email
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email.trim())) {
		return res.status(400).json({
			error: "Formato email non valido",
		});
	}

	// Verifica lunghezza minima password
	if (password.length < 8) {
		return res.status(400).json({
			error: "La password deve avere almeno 8 caratteri",
		});
	}

	// Tutto ok, passa al prossimo middleware
	next();
}

//Middleware giusto per provare la raggiungibilità degli endpoint
function VERIFY(req, res, next) {
	console.log("Richiesta effettuata");
	next();
}

//TODO: ricordati il middleware per la verifica di JWT
function verifyJWT(req, res, next) {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return next();
		}

		const token = authHeader.split(" ")[1];
		if (!token) {
			return next();
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;

		next();
	} catch (err) {
		if (err.name === "TokenExpiredError" || err.name === "JsonWebTokenError") {
			return next();
		}
		console.error(err);
		return res.status(500).json({ Error: "Errore interno" });
	}
}

//Autorizzazione
function verifyRole(req, res, next) {
	//Se, per qualche motivo, la pagina non è registrata nella mappa
	// l'autorizzazione è NEGATA
	next();
}

module.exports = {
	validateCredentials,
	VERIFY,
	verifyJWT,
	verifyRole,
};
