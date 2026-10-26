const AppError = require("../utils/AppError");

// Browser origins allowed to call the API — shared by the Express `cors`
// middleware and the realtime socket, so the two can never disagree.
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:4173",
  "http://localhost:5173",
  // Production site (served same-origin behind nginx, but browsers still send
  // an Origin header on POSTs — so these must be allowed explicitly).
  "https://proctavo.com",
  "https://www.proctavo.com",
];

// `localhost` and `127.0.0.1` are the same machine but different origins to a
// browser, so every local dev port is allowed under both names — opening the
// app at http://127.0.0.1:5173 must work exactly like http://localhost:5173.
for (const o of [...allowedOrigins]) {
  if (o.startsWith("http://localhost:")) allowedOrigins.push(o.replace("localhost", "127.0.0.1"));
}

// Extra origins can be supplied at runtime via CLIENT_ORIGINS (comma-separated)
// without a code change.
if (process.env.CLIENT_ORIGINS) {
  for (const o of process.env.CLIENT_ORIGINS.split(",")) {
    const trimmed = o.trim();
    if (trimmed) allowedOrigins.push(trimmed);
  }
}

// `(origin, callback)` — the shape both `cors` and socket.io accept. Also
// allows ngrok origins dynamically.
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || /\.ngrok-free\.app$/.test(origin)) {
    callback(null, true);
  } else {
    // 403, not a generic 500: the request was refused, nothing broke.
    callback(new AppError(`Not allowed by CORS: ${origin}`, 403));
  }
};

module.exports = { corsOrigin };
