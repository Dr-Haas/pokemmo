// Player accounts: email + password, the trainer name and character, and the game save,
// so the same game can be picked up from any device.
//
// Stored in SQLite (built into Node). DATA_DIR must survive redeploys (a Docker volume).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const SESSION_DAYS = 180;
const MAX_NAME_LENGTH = 12;
const MAX_SAVE_BYTES = 2 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "pokemmo.db"));
db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        character TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saves (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    );
`);

class AccountError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function cleanEmail(raw) {
    const email = String(raw || "").trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new AccountError(400, "Adresse e-mail invalide.");
    }
    return email;
}

function cleanName(raw) {
    const name = String(raw || "").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, MAX_NAME_LENGTH);
    if (!name) {
        throw new AccountError(400, "Choisis un nom de dresseur.");
    }
    return name;
}

function cleanCharacter(raw) {
    const character = String(raw || "");
    return /^[a-z0-9]{1,24}$/.test(character) ? character : "misa";
}

function checkPassword(raw) {
    const password = String(raw || "");
    if (password.length < 8) {
        throw new AccountError(400, "Le mot de passe doit faire au moins 8 caractères.");
    }
    if (password.length > 200) {
        throw new AccountError(400, "Mot de passe trop long.");
    }
    return password;
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);
    return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
    const [scheme, saltHex, hashHex] = String(stored).split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex) {
        return false;
    }
    const expected = Buffer.from(hashHex, "hex");
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

function publicUser(user) {
    return { email: user.email, name: user.name, character: user.character };
}

function createSession(userId) {
    const token = crypto.randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
        .run(token, userId, Date.now() + (SESSION_DAYS * 24 * 3600 * 1000));
    return token;
}

function register({ email, password, name, character }) {
    const cleanedEmail = cleanEmail(email);
    const cleanedPassword = checkPassword(password);
    const cleanedName = cleanName(name);

    if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(cleanedEmail)) {
        throw new AccountError(409, "Un compte existe déjà avec cet e-mail.");
    }

    const result = db.prepare("INSERT INTO users (email, password_hash, name, character, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(cleanedEmail, hashPassword(cleanedPassword), cleanedName, cleanCharacter(character), Date.now());
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    return { token: createSession(user.id), user: publicUser(user), hasSave: false };
}

function login({ email, password }) {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").trim().toLowerCase());
    if (!user || !verifyPassword(String(password || ""), user.password_hash)) {
        throw new AccountError(401, "E-mail ou mot de passe incorrect.");
    }
    return { token: createSession(user.id), user: publicUser(user), hasSave: hasSave(user.id) };
}

function logout(token) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(String(token || ""));
}

/** The account behind a session token, or null. */
function userFromToken(token) {
    if (!token) {
        return null;
    }
    const row = db.prepare(`
        SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ? AND sessions.expires_at > ?
    `).get(String(token), Date.now());
    return row || null;
}

function updateProfile(userId, { character }) {
    if (character !== undefined) {
        db.prepare("UPDATE users SET character = ? WHERE id = ?").run(cleanCharacter(character), userId);
    }
    return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId));
}

function hasSave(userId) {
    return Boolean(db.prepare("SELECT 1 FROM saves WHERE user_id = ?").get(userId));
}

function getSave(userId) {
    const row = db.prepare("SELECT data, updated_at FROM saves WHERE user_id = ?").get(userId);
    return row ? { save: JSON.parse(row.data), updatedAt: row.updated_at } : { save: null, updatedAt: null };
}

function putSave(userId, save) {
    const data = JSON.stringify(save);
    if (!save || typeof save !== "object" || data.length > MAX_SAVE_BYTES) {
        throw new AccountError(400, "Sauvegarde invalide.");
    }
    const now = Date.now();
    db.prepare(`
        INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run(userId, data, now);
    return { updatedAt: now };
}

module.exports = {
    AccountError,
    register,
    login,
    logout,
    userFromToken,
    updateProfile,
    getSave,
    putSave,
    publicUser
};
