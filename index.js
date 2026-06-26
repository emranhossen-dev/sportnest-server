const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { toNodeHandler } = require("better-auth/node");
require("dotenv").config();

const port = process.env.PORT || 5000;
const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://sportnest.emran.work"
  ],
  credentials: true
}));

app.use(cookieParser());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("sportnest_db");

const auth = betterAuth({
  database: mongodbAdapter(db),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    }
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"]
    }
  },
  trustedOrigins: [
    "http://localhost:5173",
    "https://sportnest.emran.work"
  ],
  advanced: {
    cookie: {
      sameSite: "none",
      secure: true
    }
  }
});

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

async function run() {
  try {
    await client.connect();

    const facilitiesCollection = db.collection("facilities");
    const bookingsCollection = db.collection("bookings");

    app.post("/facilities", async (req, res) => {
      try {
        const data = req.body;
        data.createdAt = new Date();
        const result = await facilitiesCollection.insertOne(data);
        res.status(201).send(result);
      } catch (err) {
        console.error("POST /facilities error:", err);
        res.status(500).send({ message: "Failed to create facility" });
      }
    });

    app.get("/facilities", async (req, res) => {
      try {
        const { search, type } = req.query;
        let query = {};

        if (search) {
          query.name = { $regex: search, $options: "i" };
        }

        if (type && type !== "all") {
          query.facility_type = { $in: [type] };
        }

        const result = await facilitiesCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        console.error("GET /facilities error:", err);
        res.status(500).send({ message: "Failed to fetch facilities" });
      }
    });

    app.get("/facilities/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid facility id" });
        }
        const query = { _id: new ObjectId(id) };
        const result = await facilitiesCollection.findOne(query);
        if (!result) {
          return res.status(404).send({ message: "Facility not found" });
        }
        res.send(result);
      } catch (err) {
        console.error("GET /facilities/:id error:", err);
        res.status(500).send({ message: "Failed to fetch facility" });
      }
    });

    app.put("/facilities/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid facility id" });
        }
        const data = req.body;
        const query = { _id: new ObjectId(id) };
        const updateDoc = { $set: data };
        const result = await facilitiesCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch (err) {
        console.error("PUT /facilities/:id error:", err);
        res.status(500).send({ message: "Failed to update facility" });
      }
    });

    app.delete("/facilities/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid facility id" });
        }
        const query = { _id: new ObjectId(id) };
        const result = await facilitiesCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.error("DELETE /facilities/:id error:", err);
        res.status(500).send({ message: "Failed to delete facility" });
      }
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SportNest Server is Running!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});