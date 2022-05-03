import express, { json } from "express";
import bodyParser from "body-parser";
import chalk from "chalk";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";

const app = express();
let day = dayjs();
app.use(cors());
app.use(bodyParser.json());
dotenv.config();

const nameSchema = joi.string().required();

const messageSchema = joi.object({
    from: joi.string().required(),
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().required().valid("message", "private_message"),
    time: joi.string().required()
})

setInterval(checkUsers, 1000 * 15);

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

    const time = day.format("HH:mm:ss");
    try {
        const nameVerification = await db.collection("participants").findOne({ name });
        if (nameVerification) {
            return res.sendStatus(422).send("Participant already exists");
        }
    }
    catch {
        return res.sendStatus(500);
    }

    const { error } = nameSchema.validate(name, { abortEarly: false });

    if (error) {
        return res.status(422).json({ error: error.message });
    }
    else {
        try {
            await db.collection("participants").insertOne({ name: name, lastStatus: Date.now() });
            await db.collection("messages").insertOne({ from: '', to: "Todos", text: `${name} entrou na sala`, type: "status", time: time });
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

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    const name = user.replace(/"|'/g, '');
    try {
        const participant = await db.collection("participants").findOne({ name });
        if (!participant) {
            return res.status(402).send("Participant not found");
        }
    }
    catch {
        return res.sendStatus(404);
    }

    const message = {
        from: name,
        to: to,
        text: text,
        type: type,
        time: day.format("HH:mm:ss")
    }

    const { error } = messageSchema.validate(message, { abortEarly: false });

    if (error) {
        return res.status(422).json({ error: error.message });
    }

    else {
        try {
            await db.collection("messages").insertOne(message);
            res.sendStatus(201);
        } catch (error) {
            res.sendStatus(422).send("Error adding a new message")
        }
    }
})

app.get("/messages", async (req, res) => {
    const { user } = req.headers;
    const query = parseInt(req.query.limit);
    let messages = [];
    try {
        const message = await db.collection("messages").find({ $or: [{ to: "Todos" }, { to: user }, { from: user }] }).toArray();
        messages = message.reverse().splice(0, query);
    }
    catch {
        return res.sendStatus(404);
    }
    res.send(messages.reverse());


});

app.post("/status", async (req, res) => {
    const { user } = req.headers;

    try {
        const participant = await db.collection("participants").findOne({ name: user.replace(/"|'/g, '') });
        if (participant) {
            try {
                await db.collection("participants").updateOne({ name: user.replace(/"|'/g, '') }, { $set: { lastStatus: Date.now() } });
                return res.sendStatus(200);
            } catch {
                return res.sendStatus(500);
            }
        }
        else {
            return res.sendStatus(404);
        }
    } catch {
        return res.status(404);
    }
});

function checkUsers() {
    const promisse = db.collection("participants").find().toArray();
    promisse.then(async (participants) => {
        const now = Date.now();
        participants.forEach(participant => {
            if (now - participant.lastStatus > 1000 * 10) {
                db.collection("messages").insertOne({ from: '', to: "Todos", text: `${participant.name} saiu da sala`, type: "status", time: day.format("HH:mm:ss") });
                db.collection("participants").deleteOne({ name: participant.name });
            }
        });
    });
    promisse.catch(() => {
        console.log(chalk.bold.red("Error checking users"));
    });

}








app.listen(5000, () => {
    console.log(chalk.bold.green("Server is running on port 5000"));
})