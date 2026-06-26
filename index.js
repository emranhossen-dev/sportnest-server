import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { toNodeHandler } from "better-auth/node";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

/* ---------------- Middleware ---------------- */
app.use(
  cors({
    origin: ["http://localhost:5173", "https://sportnest.emran.work"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

/* ---------------- MongoDB ---------------- */
const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("sportnest_db");

/* ---------------- Auth ---------------- */
const auth = betterAuth({
  database: mongodbAdapter(db),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: { enabled: true },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "email-password"],
    },
  },

  trustedOrigins: [
    "http://localhost:5173",
    "https://sportnest.emran.work",
  ],

  advanced: {
    cookie: {
      sameSite:
        process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },
});

app.all("/api/auth/*splat", toNodeHandler(auth));

/* ---------------- DB Connect ---------------- */
let connected = false;

async function connectDB() {
  if (connected) return;
  await client.connect();
  connected = true;
  console.log("MongoDB connected");
}

await connectDB();

/* ---------------- Collections ---------------- */
const facilities = db.collection("facilities");
const bookings = db.collection("bookings");

/* ---------------- Routes ---------------- */

app.get("/", (_, res) => res.send("SportNest Server Running"));

/* ---- Facilities ---- */
app.post("/facilities", async (req, res) => {
  try {
    const data = { ...req.body, createdAt: new Date() };
    const result = await facilities.insertOne(data);
    res.status(201).send(result);
  } catch {
    res.status(500).send({ message: "Create failed" });
  }
});

app.get("/facilities", async (req, res) => {
  try {
    const { search, type, owner_email } = req.query;
    const query = {};

    if (search) query.name = { $regex: search, $options: "i" };
    if (type && type !== "all") query.facility_type = type;
    if (owner_email) query.owner_email = owner_email;

    res.send(await facilities.find(query).toArray());
  } catch {
    res.status(500).send({ message: "Fetch failed" });
  }
});

app.get("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid ID" });

    const data = await facilities.findOne({ _id: new ObjectId(id) });
    if (!data) return res.status(404).send({ message: "Not found" });

    res.send(data);
  } catch {
    res.status(500).send({ message: "Fetch failed" });
  }
});

app.put("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid ID" });

    const existing = await facilities.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).send({ message: "Not found" });

    if (existing.owner_email !== req.body.owner_email)
      return res.status(403).send({ message: "Forbidden" });

    const result = await facilities.updateOne(
      { _id: new ObjectId(id) },
      { $set: req.body }
    );

    res.send(result);
  } catch {
    res.status(500).send({ message: "Update failed" });
  }
});

app.delete("/facilities/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const email = req.query.owner_email;

    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid ID" });

    const existing = await facilities.findOne({ _id: new ObjectId(id) });
    if (!existing) return res.status(404).send({ message: "Not found" });

    if (existing.owner_email !== email)
      return res.status(403).send({ message: "Forbidden" });

    res.send(await facilities.deleteOne({ _id: new ObjectId(id) }));
  } catch {
    res.status(500).send({ message: "Delete failed" });
  }
});

/* ---- Bookings ---- */
app.post("/bookings", async (req, res) => {
  try {
    const result = await bookings.insertOne({
      ...req.body,
      createdAt: new Date(),
    });
    res.status(201).send(result);
  } catch {
    res.status(500).send({ message: "Booking failed" });
  }
});

app.get("/bookings", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email)
      return res.status(400).send({ message: "Email required" });

    res.send(
      await bookings.find({ user_email: email }).toArray()
    );
  } catch {
    res.status(500).send({ message: "Fetch failed" });
  }
});

app.delete("/bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid ID" });

    res.send(
      await bookings.deleteOne({ _id: new ObjectId(id) })
    );
  } catch {
    res.status(500).send({ message: "Delete failed" });
  }
});

/* ---------------- Server ---------------- */
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () =>
    console.log(`http://localhost:${port}`)
  );
}

export default app;