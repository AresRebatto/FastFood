const express = require("express");
const ejs = require("ejs");
const { MongoClient } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");


const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const restaurantRoutes = require('./routes/restaurant.routes');
const orderRoutes = require('./routes/order.routes');



//utils
const utils = require("./utils/authUtils");
const cookieUtils = require("./utils/cookie");
const orderUtils = require("./utils/orderUtils");

//services
const userServices = require("./services/userServices");
const restaurantServices = require("./services/restaurantServices");
const mealServices = require("./services/mealServices");
const orderServices = require("./services/orderServices");
const ristoratoreServices = require("./services/ristoratoreServices");

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

/**
 * @swagger
 * /:
 *   get:
 *     summary: Renderizza la Home Page
 *     description: Mostra la pagina principale della piattaforma. Se l'utente è autenticato ed è un cliente, carica una lista di piatti consigliati basati sui suoi ordini recenti.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Home page renderizzata correttamente (HTML).
 *       500:
 *         description: Errore del server durante il recupero dei piatti consigliati (viene comunque renderizzata la pagina con lista vuota).
 */
app.get("/", middlewares.verifyJWT, async (req, res) => {
 try {
    let consigliati = [];

    // I consigli hanno senso solo per i clienti, non per i ristoratori
    if (req.user) {
      consigliati = await mealServices.getPiattiConsigliati(db, req.user.sub, 8);
    }

    res.render('index', {
      role: req.user?.ruolo,
      consigliati
    });
  } catch (error) {
    console.error('Errore caricamento home:', error);
    res.render('index', { role: req.user?.ruolo, consigliati: [] });
  }
});


//Attacco db a req
app.use((req, res, next) => {
    req.db = db;
    next();
});

app.use('/', authRoutes);
app.use('/', userRoutes);
app.use('/', restaurantRoutes);
app.use('/', orderRoutes);

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

// Middleware di fallback per il 404
app.use(
    (req, res, next) => {
        res.status(404).render("not_found");
    }
);
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
