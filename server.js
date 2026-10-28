const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { checkEligibility } = require("./engine");

const schemes = JSON.parse(
  fs.readFileSync(path.join(__dirname, "schemes.json"), "utf8")
);

const stats = {
  totalChecks: 0,
  schemeEligibleCounts: {},
  byState: {},
};

function recordStats(user, result) {
  stats.totalChecks += 1;

  if (typeof user.state === "string" && user.state.trim()) {
    const state = user.state.trim();
    stats.byState[state] = (stats.byState[state] || 0) + 1;
  }

  for (const item of result.results) {
    if (item.status === "eligible") {
      stats.schemeEligibleCounts[item.id] =
        (stats.schemeEligibleCounts[item.id] || 0) + 1;
    }
  }
}

function getStatsPayload() {
  const topSchemes = Object.entries(stats.schemeEligibleCounts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, 5);

  return {
    totalChecks: stats.totalChecks,
    topSchemes,
    byState: stats.byState,
  };
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateCheckBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Request body must be a JSON object";
  }
  if (body.age === undefined || body.age === null) {
    return "age is required";
  }
  if (!isNumber(body.age)) {
    return "age must be a number";
  }
  if (body.income === undefined || body.income === null) {
    return "income is required";
  }
  if (!isNumber(body.income)) {
    return "income must be a number";
  }
  if (body.occupation === undefined || body.occupation === null) {
    return "occupation is required";
  }
  if (typeof body.occupation !== "string" || !body.occupation.trim()) {
    return "occupation must be a string";
  }
  return null;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use((err, _req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  next(err);
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/schemes", (_req, res) => {
  res.json(schemes);
});

app.post("/api/check", (req, res) => {
  const error = validateCheckBody(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const result = checkEligibility(req.body, schemes);
  recordStats(req.body, result);
  res.json(result);
});

app.get("/api/stats", (_req, res) => {
  res.json(getStatsPayload());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Scheme Finder API listening on port ${PORT}`);
});
