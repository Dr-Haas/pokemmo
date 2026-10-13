const express = require("express");
const accounts = require("../services/accounts");

const router = express.Router();
// Saves can be bigger than the default 100kb body limit.
router.use(express.json({ limit: "2mb" }));

// A few tries per minute per address, to slow down password guessing.
const attempts = new Map();
function tooManyAttempts(request) {
    const ip = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "").split(",")[0].trim();
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || entry.resetAt < now) {
        attempts.set(ip, { count: 1, resetAt: now + 60 * 1000 });
        return false;
    }
    entry.count += 1;
    return entry.count > 10;
}

function bearerToken(request) {
    const header = String(request.headers.authorization || "");
    return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function requireUser(request, response, next) {
    const user = accounts.userFromToken(bearerToken(request));
    if (!user) {
        response.status(401).json({ error: "Session expirée, reconnecte-toi." });
        return;
    }
    request.user = user;
    next();
}

function handle(fn) {
    return (request, response) => {
        try {
            response.json(fn(request));
        } catch (error) {
            if (error instanceof accounts.AccountError) {
                response.status(error.status).json({ error: error.message });
                return;
            }
            console.error(error);
            response.status(500).json({ error: "Erreur du serveur." });
        }
    };
}

router.post("/auth/register", (request, response, next) => {
    // Private game: only people with the link can create an account.
    if (process.env.GAME_CODE && request.headers["x-game-code"] !== process.env.GAME_CODE) {
        response.status(403).json({ error: "Code de partie manquant ou faux. Ouvre le lien qu'on t'a envoyé." });
        return;
    }
    if (tooManyAttempts(request)) {
        response.status(429).json({ error: "Trop d'essais, attends une minute." });
        return;
    }
    next();
}, handle((request) => accounts.register(request.body || {})));

router.post("/auth/login", (request, response, next) => {
    if (tooManyAttempts(request)) {
        response.status(429).json({ error: "Trop d'essais, attends une minute." });
        return;
    }
    next();
}, handle((request) => accounts.login(request.body || {})));

router.post("/auth/logout", handle((request) => {
    accounts.logout(bearerToken(request));
    return { ok: true };
}));

router.get("/me", requireUser, handle((request) => ({ user: accounts.publicUser(request.user) })));
router.patch("/me", requireUser, handle((request) => ({ user: accounts.updateProfile(request.user.id, request.body || {}) })));

router.get("/save", requireUser, handle((request) => accounts.getSave(request.user.id)));
router.put("/save", requireUser, handle((request) => accounts.putSave(request.user.id, request.body && request.body.save)));

module.exports = router;
