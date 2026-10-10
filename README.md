# 🍔 FastFood

Piattaforma full-stack di **food delivery** sviluppata come progetto universitario. Gli utenti possono consultare il menu, comporre un ordine e seguirne lo stato; il backend espone un'API REST documentata con Swagger, protetta da autenticazione JWT.

> Progetto realizzato a scopo didattico

---

## ✨ Funzionalità
 
### 👤 Account e sicurezza
- **Registrazione** con scelta del ruolo: Cliente (`C`) o Ristoratore (`R`)
- **Login e logout** con token **JWT** (validità 7 giorni) salvato in un cookie `HttpOnly`; `secure` e `sameSite: strict` in produzione
- Supporto all'header `Authorization: Bearer` per testare le API con strumenti esterni
- **Password cifrate con bcrypt** (12 salt round) e **validazione degli input** (formato email, lunghezza minima, controllo sul tipo dei campi contro l'injection di oggetti)
- **Profilo utente**: modifica di nome, cognome e password
- **Metodi di pagamento** con validazione del circuito (Visa/Mastercard o Amex), lunghezza del numero, scadenza e CVV
- **Eliminazione dell'account** con pulizia a cascata: per un ristoratore vengono rimossi anche i suoi ristoranti e gli ordini collegati
### 🛒 Lato cliente
- **Home personalizzata** con piatti consigliati, ricavati dagli ordini recenti dell'utente (senza duplicati, escludendo piatti o ristoranti non più disponibili)
- **Ricerca** di ristoranti (per nome o via) e di piatti (per nome, categoria o area geografica), case-insensitive
- **Pagina del ristorante** con informazioni e menù
- **Carrello** persistente nel browser, con riepilogo e totale
- **Checkout**: l'ordine temporaneo vive in un cookie di 5 minuti; il sistema **stima il tempo di attesa** in base alla coda di ordini già presenti nel ristorante (15 minuti per prodotto)
- **Storico ordini** con **stato aggiornato in tempo reale**: *Ordinato → In preparazione → In consegna → Consegnato*, calcolato in automatico dal tempo trascorso
- **Conferma di consegna** manuale da parte del cliente
### 🍽️ Lato ristoratore
- **Gestione dei ristoranti** (creazione, modifica, eliminazione) con validazione della **Partita IVA** (11 cifre)
- **Controllo di proprietà**: ogni ristoratore può modificare ed eliminare solo i propri locali (risposta `403` altrimenti)
- **Menù costruito da un catalogo locale** di circa 300 piatti
- **Ordini ricevuti** da tutti i propri ristoranti, con stato sempre aggiornato
- **Dashboard statistiche** per ogni ristorante: ricavo medio per ordine, incasso degli ultimi 7 giorni suddiviso per giorno della settimana (con grafico) e piatto più venduto
### ⚙️ Aspetti tecnici
- **API documentata con Swagger / OpenAPI 3.0**, generata dai commenti JSDoc con `swagger-jsdoc`
- **Rendering lato server** con EJS e componenti riutilizzabili (header, footer, carrello, ricerca)
- Pagina **404** personalizzata
- Architettura a livelli: *routes → services → database*, con middleware dedicati
## 🛠️ Stack tecnologico
 
| Livello | Tecnologie |
|---|---|
| Frontend | HTML5, CSS3, JavaScript, [Alpine.js](https://alpinejs.dev/), template EJS |
| Backend | Node.js, Express 5 |
| Database | MongoDB (driver ufficiale) |
| Autenticazione | JWT (`jsonwebtoken`), `bcrypt`, `cookie-parser` |
| Documentazione API | `swagger-jsdoc`, `swagger-ui-express` |
| Configurazione | `dotenv` |

## 🗂️ Struttura del progetto

```
FastFood/
├── app.js            # Entry point: configurazione di Express e avvio del server
├── middlewares.js    # Middleware condivisi (es. verifica del token)
├── swagger.js        # Configurazione della documentazione Swagger
├── routes/           # Definizione degli endpoint REST
├── services/         # Logica di business e accesso ai dati
├── utils/            # Funzioni di supporto
├── data/             # Dati e modelli
├── views/            # Template delle pagine
└── public/           # Asset statici (CSS, JS client, immagini)
```

L'architettura separa i livelli di responsabilità: le **routes** gestiscono le richieste HTTP, i **services** contengono la logica applicativa e i **middleware** si occupano di aspetti trasversali come l'autenticazione.

## 🚀 Installazione e avvio

### Prerequisiti

- [Node.js](https://nodejs.org/) (v18 o successiva)
- Un'istanza di [MongoDB](https://www.mongodb.com/) locale o su Atlas

### Passaggi

```bash
# 1. Clona il repository
git clone https://github.com/AresRebatto/FastFood.git
cd FastFood

# 2. Installa le dipendenze
npm install

# 3. Configura le variabili d'ambiente (vedi sotto)
cp .env.example .env

# 4. Avvia il server
npm start
```

### Variabili d'ambiente

Crea un file `.env` nella radice del progetto:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/fastfood
JWT_SECRET=una_stringa_lunga_e_casuale
```


## 📖 Documentazione API

Con il server in esecuzione, la documentazione interattiva Swagger è consultabile all'indirizzo:

```
http://localhost:3000/api-docs
```


## 🔐 Sicurezza

Le rotte riservate richiedono un token JWT nell'header della richiesta:

```
Authorization: Bearer <token>
```

Il token viene rilasciato in fase di login e verificato dai middleware prima di raggiungere la logica applicativa.


## 👤 Autore

**Ares Rebatto**
Studente presso l'Università Statale di Milano (Unimi)
[GitHub](https://github.com/AresRebatto)
