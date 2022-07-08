const express = require("express");
const cors = require("cors");
const app = express();
const { Client } = require("pg");
const hasher = require("pbkdf2-password-hash");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { response } = require("express");
dotenv.config();
let PORT = process.env.PORT || 8080;

const corsSettings = {
  origin: "*",
};

const connectionString =
  "postgres://zqpeqxci:Rlj8TUt18wCfImgJL8jqiGGpDjQT9YtG@manny.db.elephantsql.com/zqpeqxci";

const client = new Client(connectionString);
client.connect();

app.use(cors(corsSettings));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

app.listen(PORT, function () {
  console.log("CORS-enabled web server listening on port " + PORT);
});

app.get("/test", async (req, res) => {
  await testServer(req, res);
});

app.get("/login", async (req, res) => {
  await getUser(req, res);
});

app.post("/register", async (req, res) => {
  await registerUser(req, res);
});

app.get("/sessions", async (req, res) => {
  await getLoggedInUser(req, res);
});

app.post("/sessions", async (req, res) => {
  await startSession(req, res);
});

app.delete("/sessions", async (req, res) => {
  await endSession(req, res);
});

app.get("/profile", async (req, res) => {
  await getProfile(req, res);
});

async function testServer(req, res) {
  res.json({ response: "test working, server running" });
}

async function getUser(req, res) {
  const { email, password } = await req.query;

  const result = await client.query(`SELECT * FROM users WHERE email = $1`, [
    email,
  ]);
  if (result.rows.length === 0) {
    res.json({ response: "User not found" });
  } else {
    const auth = await hasher.compare(password, result.rows[0].password);
    if (!auth) {
      res.json({ response: "Incorrect Password" });
    } else {
      res.json({ response: "User Found", user: result.rows[0] });
    }
  }
}

async function registerUser(req, res) {
  const { email, password } = await req.body;

  const emailCheck = await client.query(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  if (emailCheck.rows.length != 0) {
    res.json({ response: "email already exists" });
  } else {
    await client.query(
      `INSERT INTO users (email,password,created_at) VALUES($1,$2,NOW())`,
      [email, await hasher.hash(password)]
    );
    const newUser = await client.query(`SELECT * FROM users WHERE email = $1`, [
      email,
    ]);
    res.json({ response: "added new user" });
  }
}

async function getProfile(req, res) {
  try {
    const sessionID = req.cookies.sessionID;
    const user = await getUserFromID(sessionID);
    const profile = await client.query(
      `SELECT user_id, email FROM users WHERE user_id = $1`,
      [user[0].id]
    );
    return res.json({ response: "user found", user: profile.rows[0] });
  } catch (err) {
    res.json(err);
  }
}

async function startSession(req, res) {
  const { userID } = await req.body;
  if (userID) {
    const sessionID = crypto.randomUUID();
    await client.query(
      "INSERT INTO sessions (uuid, created_at, user_id) VALUES ($1, NOW(), $2)",
      [sessionID, userID]
    );
    res.cookie("sessionID", sessionID);
    console.log(req.cookies.sessionID);
    return res.json({ response: "session started" });
  } else {
    res.json({ response: "session not started" });
  }
}

async function endSession(req, res) {
  try {
    const sessionID = req.cookies.sessionID;
    await client.query(`DELETE FROM sessions WHERE uuid = $1`, [sessionID]);
    res.json({ response: "session ended" });
  } catch (err) {
    res.json(err);
  }
}

async function getLoggedInUser(req, res) {
  const sessionID = req.cookies.sessionID;
  console.log(sessionID);
  const user = await getUserFromID(sessionID);
  if (user.length > 0) {
    return res.json({ response: true });
  } else {
    return res.json({ response: false });
  }
}

async function getUserFromID(sessionID) {
  const user = await client.query(
    "SELECT * FROM users JOIN sessions ON users.id = sessions.user_id WHERE sessions.uuid = $1",
    [sessionID]
  );
  return user.rows;
}

module.exports = app;
