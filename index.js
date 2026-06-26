const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const port = process.env.PORT || 5000;

const app = express();

app.use(cors({
  origin: [process.env.CLIENT_URL || "http://localhost:5173"],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    const database = client.db("sportnest_db");
    const facilitiesCollection = database.collection("facilities");
    const bookingsCollection = database.collection("bookings");

    app.post("/auth/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).send({ success: true });
    });

    app.post("/auth/logout", async (req, res) => {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).send({ success: true });
    });

    app.post("/facilities", async (req, res) => {
      const data = req.body;
      const date = new Date();
      data.createdAt = date;
      const result = await facilitiesCollection.insertOne(data);
      res.status(201).send(result);
    });

    app.get("/facilities", async (req, res) => {
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
    });

    app.get("/facilities/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await facilitiesCollection.findOne(query);
      res.send(result);
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("SportNest Server is Running!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});