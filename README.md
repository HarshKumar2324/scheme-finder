# Scheme Finder API

Backend REST API that matches a user profile against 12 Indian central-government schemes. No database — scheme data lives in `schemes.json` and usage counters live in memory (reset on restart).

## Run locally

```bash
cd backend
npm install
npm start
```

The server listens on `process.env.PORT` or **3000**.

Health check:

```bash
curl http://localhost:3000/api/health
```

Expected: `{"ok":true}`

On Windows PowerShell, use `curl.exe` (the `curl` alias is `Invoke-WebRequest` and will break JSON bodies).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | `{ "ok": true }` |
| GET | `/api/schemes` | Full scheme list (including rules) |
| POST | `/api/check` | Evaluate eligibility for one user |
| GET | `/api/stats` | In-memory usage stats |

### POST `/api/check`

**Body**

```json
{
  "age": 35,
  "gender": "male",
  "state": "Rajasthan",
  "income": 250000,
  "occupation": "selfemployed",
  "category": "OBC",
  "hasBankAccount": true,
  "ownsLand": false,
  "hasBusiness": true,
  "hasGirlChildUnder10": false
}
```

- `gender`: `male` | `female` | `other`
- `occupation`: `farmer` | `student` | `selfemployed` | `salaried` | `unemployed` | `streetvendor`
- `category`: `General` | `OBC` | `SC` | `ST`
- `income`: annual income in rupees

Returns **HTTP 400** `{ "error": "..." }` if `age`, `income`, or `occupation` is missing or the wrong type.

**Success shape**

```json
{
  "summary": {
    "eligible": 4,
    "almost": 7,
    "notEligible": 1,
    "totalAnnualBenefit": 6000
  },
  "results": [
    {
      "id": "pm-kisan",
      "name": { "en": "...", "hi": "..." },
      "benefit": { "en": "...", "hi": "..." },
      "benefitValue": 6000,
      "applyUrl": "https://...",
      "status": "eligible",
      "passed": [{ "en": "...", "hi": "..." }],
      "failed": [],
      "documents": [{ "en": "...", "hi": "..." }]
    }
  ]
}
```

Results are ordered `eligible`, then `almost`, then `not_eligible`. `totalAnnualBenefit` is the sum of `benefitValue` for **eligible** schemes only.

Matching: each scheme rule is either passed or failed. 0 failed → `eligible`, 1 failed → `almost`, 2+ → `not_eligible`. A rule may be `{ anyOf: [...] }`, which passes if any inner rule passes.

### GET `/api/stats`

```json
{
  "totalChecks": 3,
  "topSchemes": [{ "id": "pmjay", "count": 3 }],
  "byState": { "Rajasthan": 3 }
}
```

Counters update on every successful `/api/check`. No personal data is stored. Counters reset when the process restarts.

---

## Sample users

### 1. Farmer

Age 42, income ₹1,20,000, farmer, OBC, bank account, owns land.

```bash
curl -s -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "age": 42,
    "gender": "male",
    "state": "Rajasthan",
    "income": 120000,
    "occupation": "farmer",
    "category": "OBC",
    "hasBankAccount": true,
    "ownsLand": true,
    "hasBusiness": false,
    "hasGirlChildUnder10": false
  }'
```

**Eligible:** PM Kisan Samman Nidhi, PM Jeevan Jyoti Bima Yojana, PM Suraksha Bima Yojana, Ayushman Bharat PM-JAY.

`summary.totalAnnualBenefit` = **6000** (PM Kisan only).

**Almost (1 rule short):** Atal Pension Yojana — age 42 is outside the 18–40 window. Also Mudra, SSY, Jan Dhan, NSP, SVANidhi, PMEGP.

### 2. Student

Age 19, income ₹2,00,000, student, SC, bank account.

```bash
curl -s -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "age": 19,
    "gender": "male",
    "state": "Rajasthan",
    "income": 200000,
    "occupation": "student",
    "category": "SC",
    "hasBankAccount": true,
    "ownsLand": false,
    "hasBusiness": false,
    "hasGirlChildUnder10": false
  }'
```

**Eligible:** National Scholarship Portal, Ayushman Bharat PM-JAY, Atal Pension Yojana, PMJJBY, PMSBY.

`summary.totalAnnualBenefit` = **20000** (NSP).

### 3. Shopkeeper

Age 35, income ₹2,50,000, self-employed, has a business, bank account.

```bash
curl -s -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{
    "age": 35,
    "gender": "male",
    "state": "Rajasthan",
    "income": 250000,
    "occupation": "selfemployed",
    "category": "General",
    "hasBankAccount": true,
    "ownsLand": false,
    "hasBusiness": true,
    "hasGirlChildUnder10": false
  }'
```

**Eligible:** PM Mudra Yojana, PMEGP, Atal Pension Yojana, PMJJBY, PMSBY, Ayushman Bharat PM-JAY.

`summary.totalAnnualBenefit` = **0** (none of these schemes have a cash `benefitValue`).

Stand-Up India is **almost** (needs woman or SC/ST).

### Validation example

```bash
curl -s -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"gender":"male"}'
```

Expected: HTTP 400 `{ "error": "age is required" }`

### Other endpoints

```bash
curl -s http://localhost:3000/api/schemes
curl -s http://localhost:3000/api/stats
```

---

## Deploy on Render (Web Service)

1. Push this project to GitHub (the `backend` folder must be in the repo).
2. Open [Render Dashboard](https://dashboard.render.com/) → **New** → **Web Service**.
3. Connect the GitHub repository.
4. Configure:
   - **Name:** `scheme-finder-api` (or any name)
   - **Language / Runtime:** Node
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance type:** Free (or paid)
5. Leave **PORT** unset. Render injects `PORT`; `server.js` already uses `process.env.PORT || 3000`.
6. Click **Deploy**. When the deploy is live, health-check:

```bash
curl https://YOUR-SERVICE.onrender.com/api/health
```

Free instances spin down after idle time; the first request after that can take ~30–60 seconds. In-memory `/api/stats` counters reset on every restart/spin-up.

`package.json` includes `"start": "node server.js"` so either `npm start` or `node server.js` works as the start command.
