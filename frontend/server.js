const express = require("express");
const session = require("express-session");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = 3000;
const API_BASE = "http://localhost:8000/api";

// ─── Middleware ───────────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: "flaggame_session_secret_2024",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 24h
  })
);

// Inject user into all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login?next=" + req.path);
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect("/login?next=" + req.path);
  if (!req.session.user.is_admin) return res.status(403).render("error", { message: "Access denied. Admins only." });
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Home
app.get("/", (req, res) => {
  res.render("index");
});

// Register page
app.get("/register", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("register", { error: null });
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const response = await fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.render("register", { error: data.detail || "Registration failed" });
    }
    req.session.user = { token: data.token, username: data.username, user_id: data.user_id, is_admin: data.is_admin || false };
    res.redirect("/");
  } catch (err) {
    console.error("[REGISTER ERROR]", err.message, err.code);
    res.render("register", { error: `Backend error: ${err.message}` });
  }
});

// Login page
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.render("login", { error: data.detail || "Login failed" });
    }
    req.session.user = { token: data.token, username: data.username, user_id: data.user_id, is_admin: data.is_admin || false };
    const next = req.query.next || "/";
    res.redirect(next);
  } catch (err) {
    console.error("[LOGIN ERROR]", err.message, err.code);
    res.render("login", { error: `Backend error: ${err.message}` });
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

// Game page
app.get("/game", requireAuth, (req, res) => {
  res.render("game");
});

// Leaderboard
app.get("/leaderboard", async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/leaderboard`);
    const data = await response.json();
    res.render("leaderboard", { leaderboard: data.leaderboard });
  } catch (err) {
    res.render("leaderboard", { leaderboard: [] });
  }
});

// ─── API Proxy routes (for client-side JS) ───────────────────────────────────

app.get("/api/questions", requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/game/questions?count=10`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("[QUESTIONS ERROR]", err.message);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
});

app.post("/api/submit-score", requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${req.session.user.token}`,
      },
      body: JSON.stringify(req.body),
    });
    if (response.status === 401) {
      // Token invalid/expired – clear session so user re-logs in
      console.warn("[SUBMIT-SCORE] 401 from backend – clearing session");
      req.session.destroy();
      return res.status(401).json({ error: "session_expired" });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("[SUBMIT-SCORE ERROR]", err.message);
    res.status(500).json({ error: "Failed to submit score" });
  }
});

app.get("/api/my-scores", requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/scores/me`, {
      headers: { Authorization: `Bearer ${req.session.user.token}` },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scores" });
  }
});

// ─── Admin panel routes ───────────────────────────────────────────────────────

app.get("/admin", requireAdmin, async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: `Bearer ${req.session.user.token}` },
    });
    if (response.status === 401) { req.session.destroy(); return res.redirect("/login"); }
    const data = await response.json();
    res.render("admin", { users: data.users, message: req.query.message || null, error: req.query.error || null });
  } catch (err) {
    console.error("[ADMIN ERROR]", err.message);
    res.render("admin", { users: [], message: null, error: "Could not load users" });
  }
});

// Admin: create user
app.post("/admin/users", requireAdmin, async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const response = await fetch(`${API_BASE}/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.session.user.token}` },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await response.json();
    if (!response.ok) return res.redirect("/admin?error=" + encodeURIComponent(data.detail || "Create failed"));
    res.redirect("/admin?message=User '" + username + "' created successfully");
  } catch (err) {
    res.redirect("/admin?error=" + encodeURIComponent(err.message));
  }
});

// Admin: update user
app.post("/admin/users/:id/update", requireAdmin, async (req, res) => {
  const { username, email, password, is_admin } = req.body;
  try {
    const body = { username, email };
    if (password && password.trim()) body.password = password;
    body.is_admin = is_admin === "on";
    const response = await fetch(`${API_BASE}/admin/users/${req.params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${req.session.user.token}` },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) return res.redirect("/admin?error=" + encodeURIComponent(data.detail || "Update failed"));
    res.redirect("/admin?message=User updated successfully");
  } catch (err) {
    res.redirect("/admin?error=" + encodeURIComponent(err.message));
  }
});

// Admin: delete user
app.post("/admin/users/:id/delete", requireAdmin, async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/admin/users/${req.params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${req.session.user.token}` },
    });
    const data = await response.json();
    if (!response.ok) return res.redirect("/admin?error=" + encodeURIComponent(data.detail || "Delete failed"));
    res.redirect("/admin?message=" + encodeURIComponent(data.message));
  } catch (err) {
    res.redirect("/admin?error=" + encodeURIComponent(err.message));
  }
});

// Admin: clear scores
app.post("/admin/users/:id/clear-scores", requireAdmin, async (req, res) => {
  try {
    const response = await fetch(`${API_BASE}/admin/scores/${req.params.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${req.session.user.token}` },
    });
    const data = await response.json();
    if (!response.ok) return res.redirect("/admin?error=" + encodeURIComponent(data.detail || "Failed"));
    res.redirect("/admin?message=" + encodeURIComponent(data.message));
  } catch (err) {
    res.redirect("/admin?error=" + encodeURIComponent(err.message));
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚩 Guess the Flag running at http://localhost:${PORT}\n`);
});
