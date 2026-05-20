# Bug Analysis — URL Shortener API

Findings from scanning the source code against the API spec in `EXAM.md`.
Issues are grouped by the four categories identified in `README.md`.

---

## 1. Functional Bugs

### 1.1 No URL validation in `POST /shorten`
**File:** `handlers/urlHandlers.ts` — `shortenHandler`

`req.body.url` is passed directly to `createShortUrl` without any validation. Missing or malformed URLs are silently accepted. The spec requires a `400 Bad Request` response.

```ts
// current — no guard at all
const url = req.body.url;
const result = createShortUrl(url);
```

**Fix:** validate presence and format (e.g. using `URL` constructor) and return `400` on failure.

---

### 1.2 `GET /stats/:code` crashes when code is not found
**File:** `services/urlService.ts` — `getUrlStats`

The query result is typed as `UrlRow` (non-nullable). If the code does not exist, `row` is `undefined` and accessing `row.short_code` throws a runtime `TypeError`, producing a `500` instead of the required `404`.

```ts
const row = db.prepare("SELECT * FROM urls WHERE short_code = '" + code + "'").get() as UrlRow;
// row may be undefined — next line crashes
return { short_code: row.short_code, ... };
```

The same gap exists in `statsHandler` — it never checks for a missing code before returning.

---

### 1.3 `recordVisit` does not update `last_visited_at`
**File:** `services/urlService.ts` — `recordVisit`

The UPDATE statement increments `visit_count` but never writes `last_visited_at`. The field stays `NULL` forever, breaking the stats response and the `/admin/top` output.

```ts
db.prepare(
  "UPDATE urls SET visit_count = visit_count + 1 WHERE short_code = ?"
).run(code);
// last_visited_at is never touched
```

**Fix:** add `last_visited_at = ?` to the UPDATE and pass `new Date().toISOString()`.

---

### 1.4 Rate limiter is never applied
**File:** `routes/index.ts`

`rateLimitMiddleware` is imported nowhere and never attached to the `/shorten` route. All rate-limiting logic is dead code.

```ts
// routes/index.ts — no import of rateLimitMiddleware
app.post("/shorten", shortenHandler);  // middleware is missing
```

**Fix:** import `rateLimitMiddleware` and apply it: `app.post("/shorten", rateLimitMiddleware, shortenHandler)`.

---

### 1.5 Rate-limit `429` response is missing `retry_after_seconds`
**File:** `middleware/rateLimiter.ts`

The spec requires:
```json
{ "error": "Rate limit exceeded. Try again later.", "retry_after_seconds": 42 }
```
The implementation returns only `{ error: "Rate limit exceeded" }` — wrong error message and missing field.

---

## 2. Code Quality Issues

### 2.1 TypeScript strict mode is off
**File:** `tsconfig.json`

```json
"strict": false
```

With strict mode disabled, `null`/`undefined` bugs (see §1.2) and other type errors go undetected at compile time.

---

### 2.2 No `UNIQUE` constraint on `short_code`
**File:** `database/db.ts`

The `CREATE TABLE` statement has no uniqueness constraint on `short_code`. The database will silently allow duplicate codes.

```sql
short_code TEXT,   -- should be: short_code TEXT NOT NULL UNIQUE,
```

---

### 2.3 No collision handling in `createShortUrl`
**File:** `services/urlService.ts`

A freshly generated code is inserted immediately with no check for an existing row. Combined with the missing UNIQUE constraint (§2.2), this can silently create duplicates; with the constraint in place it would crash instead of retrying.

**Fix:** query for the code first (or catch the constraint error) and re-generate until a free code is found.

---

### 2.4 `generateCode` always produces exactly 6 characters
**File:** `utils/generateCode.ts`

The spec specifies 6–8 alphanumeric characters. The function always returns exactly 6 lowercase characters, and uppercase letters (`A-Z`) are absent from the character set.

```ts
for (let i = 0; i < 6; i++) { ... }          // always 6
const chars = "abcdefghijklmnopqrstuvwxyz0123456789";  // no uppercase
```

---

## 3. Security Vulnerability

### 3.1 SQL injection in `getUrlStats`
**File:** `services/urlService.ts` — `getUrlStats`

The only query in the service that does **not** use a parameterized statement. The `code` parameter is concatenated directly into the SQL string.

```ts
// VULNERABLE
db.prepare("SELECT * FROM urls WHERE short_code = '" + code + "'").get()
```

An attacker can pass a crafted `code` value via `GET /stats/<payload>` to read or manipulate arbitrary data.

**Fix:** use the same parameterized style used everywhere else in the file:
```ts
db.prepare("SELECT * FROM urls WHERE short_code = ?").get(code)
```

---

## 4. Adaptability / Performance Issues

### 4.1 `getTopUrls` fetches the entire table in application memory
**File:** `services/urlService.ts` — `getTopUrls`

All rows are loaded, sorted in JavaScript, then sliced. This is O(n log n) in the application process and transfers the full table over the SQLite boundary.

```ts
const rows = db.prepare("SELECT * FROM urls").all() as UrlRow[];
rows.sort((a, b) => b.visit_count - a.visit_count);
const top = rows.slice(0, 10);
```

**Fix:** push the work to the database where it belongs:
```ts
db.prepare(
  "SELECT * FROM urls ORDER BY visit_count DESC LIMIT 10"
).all()
```

---

## Summary Table

| # | File | Issue | Category |
|---|------|-------|----------|
| 1.1 | `handlers/urlHandlers.ts` | No URL validation → missing `400` | Functional |
| 1.2 | `services/urlService.ts` | `getUrlStats` crashes on unknown code | Functional |
| 1.3 | `services/urlService.ts` | `recordVisit` never updates `last_visited_at` | Functional |
| 1.4 | `routes/index.ts` | Rate limiter never applied to `/shorten` | Functional |
| 1.5 | `middleware/rateLimiter.ts` | `429` body missing `retry_after_seconds` | Functional |
| 2.1 | `tsconfig.json` | `strict: false` | Code quality |
| 2.2 | `database/db.ts` | No `UNIQUE` constraint on `short_code` | Code quality |
| 2.3 | `services/urlService.ts` | No collision handling after code generation | Code quality |
| 2.4 | `utils/generateCode.ts` | Fixed 6-char length, no uppercase | Code quality |
| 3.1 | `services/urlService.ts` | SQL injection in `getUrlStats` | Security |
| 4.1 | `services/urlService.ts` | `getTopUrls` loads full table in memory | Performance |
