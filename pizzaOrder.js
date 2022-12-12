const http = require("http");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, 'credentials/.env') })

const axios = require("axios");

const options = {
  method: 'GET',
  url: 'https://numbersapi.p.rapidapi.com/random/trivia',
  params: {min: '10', max: '20', fragment: 'true', json: 'true'},
  headers: {
    'X-RapidAPI-Key': '10763cbae5msh8bd734b05873a85p149e08jsnbfc63edf5715',
    'X-RapidAPI-Host': 'numbersapi.p.rapidapi.com'
  }
};

const app = express();
app.set("views", path.resolve(__dirname, "templates"));
app.use(bodyParser.urlencoded({extended:false}));
app.set("view engine", "ejs");

process.stdin.setEncoding("utf8");

const userName = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseName = process.env.MONGO_DB_NAME;
const collection = process.env.MONGO_COLLECTION;

const databaseAndCollection = {db: databaseName, collection: collection};

const { MongoClient, ServerApiVersion } = require('mongodb');

async function insertOrder(client, databaseAndCollection, order) {
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(order);
}

async function lookUpEmail(client, databaseAndCollection, email) {
    let filter = {email: email};
    const result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);
   if (result) {
       return result;
   } else {
       return null;
   }
}

if (process.argv[1] && !(process.argv[2])) {
    const uri = `mongodb+srv://${userName}:${password}@cluster0.jms7ap3.mongodb.net/?retryWrites=true&w=majority`;
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

    const portNumber = 4000;

    app.listen(portNumber);

    app.get("/", (request, response) => {
        response.render("index");
    });

    app.get("/order", (request, response) => {
        let form = `<form action="./processOrder" method="post" onsubmit = "return confirmSubmit()">`;
        response.render("order", {form: form});
    });

    app.post("/processOrder", async (request, response) => {
        let {name, email, size, additionalInformation} = request.body;
        try {
            await client.connect();
            let order = {name: name, email: email, size: size, additionalInformation: additionalInformation};
            await insertOrder(client, databaseAndCollection, order);
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
        axios.request(options).then(function (res) {
            response.render("processOrder", {name: name, email: email, size: size, additionalInformation: additionalInformation, fact: res.data.text, answer: res.data.number});
        }).catch(function (error) {
            response.render("processOrder", {name: name, email: email, size: size, additionalInformation: additionalInformation, fact: "Seems like the API failed D", answer: ""});
        });
    });

    app.get("/review", (request, response) => {
        let form = `<form action="./processReviewOrder" method="post">`;
        response.render("reviewOrder", {form: form});
    });

    app.post("/processReviewOrder", async (request, response) => {
        let {email} = request.body;
        try {
            await client.connect();
            let applicant = await lookUpEmail(client, databaseAndCollection, email);
            if (applicant === null) {
                response.render("processReviewOrder", {name: "NONE", email: "NONE", size: "NONE", additionalInformation: "NONE"});
            } else {
                let name = applicant.name;
                let size = applicant.size;
                let additionalInformation = applicant.additionalInformation;
                response.render("processReviewOrder", {name: name, email: email, size: size, additionalInformation: additionalInformation});
            }
        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    });

    console.log(`Web server is running at http://localhost:${portNumber}`);

    const prompt = "Stop to shutdown the server: ";

    process.stdout.write(prompt);

    process.stdin.on('readable', () => {
        let dataInput;
        while ((dataInput = process.stdin.read()) !== null) {
            let command = dataInput.trim();
            if (command === "stop") {
                console.log("Shutting down the server");
                process.exit(0);
            } else {
                console.log(`Invalid command: ${command}`);
            }
            process.stdout.write(prompt);
            process.stdin.resume();
        }
    });
}