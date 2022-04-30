import express, { json } from "express";
import chalk from "chalk";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";

const app = express();
let day = dayjs();
app.use(cors());
app.use(json());
dotenv.config();

let db = null;
const mongoClient = new MongoClient("mongodb://localhost:27017");
const promisse = mongoClient.connect();
promisse.then(() => {
    db = mongoClient.db("uol-api");
    console.log(chalk.bold.blue("Connected to MongoDB"));
});
promisse.catch(() => {
    console.log(chalk.bold.red("Error connecting to MongoDB"));
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    const nameVerification = await db.collection("participants").findOne({ name });
    const time = day.format("HH:mm:ss");
    const nameSchema = joi.string().required();

    const { error } = nameSchema.validate(name, { abortEarly: false });

    if (error) {
        return res.status(422).json({ error: error.message });
    }

    else if (nameVerification) {
        res.status(409).send("Participant already exists");
    }
    else {
        try {
            await db.collection("participants").insertOne({ name: name, lastStatus: Date.now() });
            await db.collection("messages").insertOne({ from: 'xxx', to: "Todos", text: `${name} entrou na sala`, type: "status", time: time });
            res.sendStatus(201);
        } catch (error) {
            res.sendStatus(422).send("Error adding a new participant")
        }
    }
})

app.get("/participants", async (req, res) => {
    const participants = await db.collection("participants").find().toArray();
    res.json(participants);
})








app.listen(5000, () => {
    console.log(chalk.bold.green("Server is running on port 5000"));
})