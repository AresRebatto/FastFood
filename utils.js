const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

async function hashPwd(password) {
	const saltRounds = 12;
	const hashedPassword = await bcrypt.hash(password, saltRounds);
	return hashedPassword;
}

async function verifyPassword(password, hashedPassword) {
	const isValid = await bcrypt.compare(password, hashedPassword);
	return isValid;
}

function generateToken(id, email, ruolo) {
	return jwt.sign(
		{
			sub: id,
			email: email,
			ruolo: ruolo,
		},
		process.env.JWT_SECRET,
		{ expiresIn: "7d" }
);
}

function rilevaCircuito(numero) {
	if (!numero) return null;
	const primaCifra = numero.charAt(0);
	if (primaCifra === "3") return "amex";
	if (primaCifra === "4" || primaCifra === "5") return "visa-mc";
	return "sconosciuto";
}

function validaMetodoPagamento(carta) {
	const numero = (carta.numero_carta || "").toString();
	const scadenza = (carta.scadenza || "").toString();
	const cvv = (carta.cvv || "").toString();
	const circuito = rilevaCircuito(numero);

	if (!/^\d+$/.test(numero)) return false;
	if (circuito === "sconosciuto" || circuito === null) return false;
	if (circuito === "amex" && numero.length !== 15) return false;
	if (circuito === "visa-mc" && numero.length !== 16) return false;

	if (!/^\d{2}\/\d{2}$/.test(scadenza)) return false;
	const [mese, anno] = scadenza.split("/").map(Number);
	if (mese < 1 || mese > 12) return false;
	const oggi = new Date();
	const annoCorrente = oggi.getFullYear() % 100;
	const meseCorrente = oggi.getMonth() + 1;
	if (anno < annoCorrente || (anno === annoCorrente && mese < meseCorrente)) return false;

	const lunghezzaCvvAttesa = circuito === "amex" ? 4 : 3;
	if (!/^\d+$/.test(cvv) || cvv.length !== lunghezzaCvvAttesa) return false;

	return true;
}
module.exports = {
	hashPwd,
	verifyPassword,
	generateToken,
	validaMetodoPagamento
};
