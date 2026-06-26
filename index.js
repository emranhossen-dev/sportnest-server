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

// --- DB connection: connect once, reused across serverless invocations ---
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  try {
    await client.connect();
    isConnected = true;
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  }
}
connectDB();

const facilitiesCollection = db.collection("facilities");
const bookingsCollection = db.collection("bookings");

// --- Routes are registered synchronously at module load, independent of connectDB() ---

app.get("/", (req, res) => {
  res.send("SportNest Server is Running!");
});

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
    const { search, type, owner_email } = req.query;
    let query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (type && type !== "all") {
      query.facility_type = { $in: [type] };
    }

    if (owner_email) {
      query.owner_email = owner_email;
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

    const facility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
    if (!facility) {
      return res.status(404).send({ message: "Facility not found" });
    }
    if (facility.owner_email !== data.owner_email) {
      return res.status(403).send({ message: "Forbidden: Not the owner" });
    }

    const updateDoc = { $set: data };
    const result = await facilitiesCollection.updateOne({ _id: new ObjectId(id) }, updateDoc);
    res.send(result);
  } catch (err) {
    console.error("PUT /facilities/:id error:", err);
    res.status(500).send({ message: "Failed to update facility" });
  }
});

app.delete("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const { owner_email } = req.query;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid facility id" });
    }

    const facility = await facilitiesCollection.findOne({ _id: new ObjectId(id) });
    if (!facility) {
      return res.status(404).send({ message: "Facility not found" });
    }
    if (facility.owner_email !== owner_email) {
      return res.status(403).send({ message: "Forbidden: Not the owner" });
    }

    const result = await facilitiesCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (err) {
    console.error("DELETE /facilities/:id error:", err);
    res.status(500).send({ message: "Failed to delete facility" });
  }
});

app.post("/bookings", async (req, res) => {
  try {
    const booking = req.body;
    booking.createdAt = new Date();
    const result = await bookingsCollection.insertOne(booking);
    res.status(201).send(result);
  } catch (err) {
    console.error("POST /bookings error:", err);
    res.status(500).send({ message: "Failed to create booking" });
  }
});

app.get("/bookings", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).send({ message: "Email parameter required" });
    const query = { user_email: email };
    const result = await bookingsCollection.find(query).toArray();
    res.send(result);
  } catch (err) {
    console.error("GET /bookings error:", err);
    res.status(500).send({ message: "Failed to fetch bookings" });
  }
});

app.delete("/bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking id" });
    }
    const query = { _id: new ObjectId(id) };
    const result = await bookingsCollection.deleteOne(query);
    res.send(result);
  } catch (err) {
    console.error("DELETE /bookings/:id error:", err);
    res.status(500).send({ message: "Failed to cancel booking" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

module.exports = app;