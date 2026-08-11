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
module.exports = {
	hashPwd,
	verifyPassword,
	generateToken
};
