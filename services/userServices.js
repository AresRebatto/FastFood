const utils = require("./../utils");

async function findUserByEmail(db, email) {
    if (!email || typeof email !== 'string') {
        return null;
    }

    const users = db.collection("Utente");

    // Normalizziamo l'email (rimozione spazi ed eventuale lowercase per consistenza)
    const normalizedEmail = email.trim().toLowerCase();

    return await users.findOne({ email: normalizedEmail });
}

async function createUser(db, { email, nome, cognome, password, ruolo }) {
    const users = db.collection("Utente");

    // Cifratura della password tramite utility
    const hashedPassword = await utils.hashPwd(password);

    const nuovoUtente = {
        email: email.trim().toLowerCase(),
        nome: nome.trim(),
        cognome: cognome.trim(),
        password: hashedPassword,
        ruolo: ruolo,
        metodi_pagamento: [],
        ordini: []
    };

    return await users.insertOne(nuovoUtente);
}

async function updateUserByEmail(db, email, aggiornamenti) {
    if (!email || typeof email !== 'string' || !aggiornamenti) {
        throw new Error("Parametri non validi per l'aggiornamento utente");
    }

    const users = db.collection("Utente");
    const normalizedEmail = email.trim().toLowerCase();

    return await users.updateOne(
        { email: normalizedEmail },
        { $set: aggiornamenti }
    );
}

async function deleteUserByEmail(db, email) {
	const users = db.collection("Utente");
	const risultato = await users.deleteOne({ email });
	return risultato.deletedCount > 0;
}	

module.exports = {
  findUserByEmail,
  createUser,
	updateUserByEmail,
	deleteUserByEmail
};
