const utils = require("../utils/authUtils");

/**
 * Cerca un utente all'interno del database tramite il suo indirizzo email.
 * Normalizza l'email rimuovendo gli spazi bianchi e convertendola in minuscolo.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string} email - L'indirizzo email dell'utente da cercare.
 * @returns {Promise<Object|null>} Il documento dell'utente se trovato, oppure `null` se l'email non è valida o l'utente non esiste.
 */
async function findUserByEmail(db, email) {
    if (!email || typeof email !== 'string') {
        return null;
    }

    const users = db.collection("Utente");

    // Normalizziamo l'email (rimozione spazi ed eventuale lowercase per consistenza)
    const normalizedEmail = email.trim().toLowerCase();

    return await users.findOne({ email: normalizedEmail });
}

/**
 * Crea e salva un nuovo utente nel database previa cifratura della password.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {Object} userData - I dati dell'utente da registrare.
 * @param {string} userData.email - L'indirizzo email dell'utente.
 * @param {string} userData.nome - Il nome dell'utente.
 * @param {string} userData.cognome - Il cognome dell'utente.
 * @param {string} userData.password - La password in chiaro da cifrare prima del salvataggio.
 * @param {string} userData.ruolo - Il ruolo dell'utente (es. 'cliente', 'ristoratore').
 * @returns {Promise<import('mongodb').InsertOneResult>} Il risultato dell'operazione di inserimento MongoDB (incluso l' `insertedId`).
 */
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

/**
 * Aggiorna i campi di un utente identificato dalla sua email.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string} email - L'indirizzo email dell'utente da aggiornare.
 * @param {Object} aggiornamenti - Oggetto contenente i campi e i valori da aggiornare (passato all'operatore `$set`).
 * @returns {Promise<import('mongodb').UpdateResult>} Il risultato dell'operazione di aggiornamento MongoDB.
 * @throws {Error} Se l'email non è una stringa valida o se l'oggetto aggiornamenti non è fornito.
 */
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

/**
 * Elimina un utente dal database tramite la sua email.
 * 
 * @note Per consistenza con gli altri metodi, si consiglia di applicare `.trim().toLowerCase()` alla stringa `email` prima dell'eliminazione.
 *
 * @async
 * @param {import('mongodb').Db} db - L'istanza del database MongoDB.
 * @param {string} email - L'indirizzo email dell'utente da eliminare.
 * @returns {Promise<boolean>} Restituisce `true` se l'utente è stato eliminato con successo, `false` altrimenti.
 */
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
