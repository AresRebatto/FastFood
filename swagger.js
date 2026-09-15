const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.3",
        info: {
            title: "Restaurant API",
            version: "1.0.0",
            description: "API per la gestione dei ristoranti"
        },
        servers: [
            {
                url: "http://localhost:3000"
            }
        ]
    },

    apis: ["app.js", "./routes/*.js"]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
