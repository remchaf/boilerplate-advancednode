"use strict";
require("dotenv").config();
const routes = require("./routes");
const auth = require("./auth.js");
const express = require("express");
const myDB = require("./connection");
const fccTesting = require("./freeCodeCamp/fcctesting.js");
const session = require("express-session");
const passport = require("passport");
const passportSocketIo = require("passport.socketio");
const cookieParser = require("cookie-parser");
const MongoStore = require("connect-mongo")(session);
const store = new MongoStore({ url: process.env.MONGO_URI });


const app = express();

// Setting the view-engine to pug
app.set("view engine", "pug");

// Express-session settings
app.use(
  session({
    key: "express.sid",
    store: store,
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Passport settings
app.use(passport.initialize());
app.use(passport.session());

fccTesting(app); //For FCC testing purposes
app.use("/public", express.static(process.cwd() + "/public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

myDB(async (client) => {
  const myDataBase = await client.db("database").collection("Chat-Users");

  //Instanciating routes and auth
  routes(app, myDataBase);
  auth(app, myDataBase);

  // Socket
  let currentUsers = 0;
  io.on("connection", (socket) => {
    console.log('user ' + socket.request.user.username + ' connected');
    currentUsers++;
    io.emit('user', {
      username: socket.request.user.username,
      currentUsers,
      connected: true
    });

    socket.on("disconnect", () => {
      console.log('user ' + socket.request.user.username + ' disconnected');
      currentUsers--;
      io.emit("user count", currentUsers);
    });
  });
}).catch((e) => {
  app.route("/").get((req, res) => {
    res.render("pug", { title: e, message: "Unable to login" });
  });
});

// Instanciating Socket.io
const http = require("http").createServer(app);
const io = require("socket.io")(http);

// Passport-socket setting
io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: "express.sid",
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail,
  })
);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log("Listening on port " + PORT);
});

function onAuthorizeSuccess(data, accept) {
  console.log("successful connection to socket.io");

  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log("failed connection to socket.io:", message);
  accept(null, false);
}
