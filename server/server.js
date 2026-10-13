const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const colyseus = require('colyseus');
// Admin monitor is loaded only when enabled (see MONITOR below).
// const socialRoutes = require("@colyseus/social/express").default;

const PokeWorld = require('./rooms/PokeWorld').PokeWorld;
const npcRoutes = require("./routes/npcs");
const authRoutes = require("./routes/auth");
const npcEmotionService = require("./services/npcEmotionService");

const port = process.env.PORT || 3000;
const app = express()

app.use(cors());
// Accounts and saves first: they parse their own (bigger) request bodies.
app.use("/api", authRoutes);
app.use(express.json());
app.use("/api", npcRoutes);

const server = http.createServer(app);
const gameServer = new colyseus.Server({
    server: server,
});

// register your room handlers
gameServer.define("poke_world", PokeWorld)
    .on("create", (room) => console.log("room created:", room.roomId))
    .on("dispose", (room) => console.log("room disposed:", room.roomId))
    .on("join", (room, client) => console.log(client.id, "joined", room.roomId))
    .on("leave", (room, client) => console.log(client.id, "left", room.roomId));

// ToDo: Create a 'chat' room for realtime chatting

/**
 * Register @colyseus/social routes
 *
 * - uncomment if you want to use default authentication (https://docs.colyseus.io/authentication/)
 * - also uncomment the require statement
 */
// app.use("/", socialRoutes);

// Admin monitor: only when explicitly enabled (MONITOR=1), it lets anyone see and close rooms.
if (process.env.MONITOR === "1") {
    const { monitor } = require("@colyseus/monitor");
    app.use("/colyseus", monitor(gameServer));
}

// Serve the built game (client/dist) from this same server, so one URL does everything.
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist));
    console.log(`Serving game files from ${clientDist}`);
}

app.get("/health", (request, response) => response.send("ok"));

npcEmotionService.init();

gameServer.listen(port);
console.log(`Listening on http://localhost:${port}`)
