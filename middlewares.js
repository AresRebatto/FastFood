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



function verifyJWT(req, res, next) {
	try {
		let token = null;

		const authHeader = req.headers.authorization;

		//Non usa i cookie perché testo con apidog
		if (authHeader && authHeader.startsWith("Bearer ")) {
			token = authHeader.split(" ")[1];
		} else if (req.cookies && req.cookies.token) {
			token = req.cookies.token;
		}

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


module.exports = {
	validateCredentials,
	verifyJWT
};
