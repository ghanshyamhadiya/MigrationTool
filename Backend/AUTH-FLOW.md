## Auth & JWT Flow

This backend exposes three main auth endpoints under the `/auth` prefix and then
uses JWT + middleware to protect selected routes (for example `POST /claude/generate`).

- **Stack**: Express, PostgreSQL, `bcrypt` for password hashing, `jsonwebtoken` for JWTs.
- **JWT secret**: `process.env.JWT_SECRET` (falls back to a default in code – set a strong secret in production).

---

### 1. Signup – `POST /auth/signup`

**Purpose**: Create a new user and send a one-time password (OTP) to verify the account.

- **Request body**
  - `name` (string, required)
  - `mobile_number` (string, required)
  - `email` (string, required)
  - `password` (string, required)

- **Flow**
  1) Validate required fields.
  2) Hash the password with `bcrypt`.
  3) Generate a 6‑digit OTP and an expiry time 5 minutes in the future.
  4) Insert a new row into `users` with:
     - `name, mobile_number, email`
     - `password` (hashed)
     - `otp` and `otp_expiry`
     - `is_verified` initially `false`
  5) Attempt to send the OTP via `sendOTP(mobile_number, otp)`:
     - If SMS sending fails, it is logged but **does not** block signup.
  6) Return a JSON response with:
     - `message`: instructing the user to verify with OTP.
     - `user`: the newly created user record (without password).
     - In **non‑production** (`NODE_ENV !== "production"`), an additional `otp_debug` field and a console log of the OTP are included to simplify local testing.

- **Important**
  - **No JWT token is returned at signup anymore.**
  - The user must successfully verify OTP (or later login as a verified user) to receive a JWT.

---

### 2. Verify OTP – `POST /auth/verify-otp`

**Purpose**: Confirm the OTP and mark the account as verified. Returns a JWT for immediate authenticated use.

- **Request body**
  - `email` (string, required)
  - `otp` (string or number, required)

- **Flow**
  1) Validate required fields.
  2) Fetch the user by `email`, selecting `id, email, otp, otp_expiry, is_verified`.
  3) If no user is found → `404 User not found`.
  4) If `is_verified` is already `true` → `400 User already verified`.
  5) Compare the stored OTP with the provided OTP:
     - Both values are coerced to strings, so `"123456"` and `123456` are treated the same.
     - If mismatch → `400 Invalid OTP`.
  6) Validate expiry:
     - Convert `otp_expiry` into a `Date` (handles both `Date` and string from the DB).
     - If missing or invalid or already past → `400 OTP expired`.
  7) If checks pass:
     - Update the user:
       - `is_verified = true`
       - `otp = NULL`
       - `otp_expiry = NULL`
     - Create a JWT with payload:
       - `{ id, email, is_verified: true }`
       - Signed with `JWT_SECRET`
       - `expiresIn: "7d"`
  8) Return:
     - `message: "Account verified"`
     - `token`: the JWT

---

### 3. Login – `POST /auth/login`

**Purpose**: Allow an already verified user to log in with email + password and receive a JWT.

- **Request body**
  - `email` (string, required)
  - `password` (string, required)

- **Flow**
  1) Validate required fields.
  2) Fetch the user by `email`, selecting:
     - `id, name, email, mobile_number, password, is_verified`
  3) If user is not found → `401 Invalid credentials`.
  4) If `is_verified` is `false` → `403 Please verify your account first`.
  5) Compare password using `bcrypt.compare`.
     - If mismatch → `401 Invalid credentials`.
  6) Remove `password` from the object (build a `safeUser`).
  7) Sign a JWT with payload:
     - `{ id, email, is_verified }`
     - Signed with `JWT_SECRET`
     - `expiresIn: "7d"`
  8) Return:
     - `user`: `safeUser`
     - `token`: the JWT

---

### 4. JWT Middleware – `authMiddleware`

Defined in `src/middleware/auth.middleware.js`.

- **Reads** the `Authorization` header:
  - Must be in the format: `Bearer <token>`.
  - If missing or malformed → `401 Missing or invalid Authorization header`.

- **Verification steps**
  1) Extract the token part.
  2) Call `jwt.verify(token, JWT_SECRET)`:
     - If verification fails or token expired → `401 Token invalid or expired`.
  3) Check `decoded.is_verified`:
     - If `false` or missing → `403 Account not verified`.
  4) Attach the decoded payload to `req.user` and call `next()`.

- **Result**
  - Any route protected with `authMiddleware` can safely assume:
    - `req.user.id` exists and is for a verified account.
    - The token was signed by this backend and is not expired.

---

### 5. Protected vs Public Routes

- **Public**
  - `/auth/signup`
  - `/auth/login`
  - `/auth/verify-otp`
  - `/gemini/sample`
  - `/gemini/generate`
  - `/claude/reload-instructions`
  - `/claude/cache-status`

- **Protected (JWT required)**
  - `POST /claude/generate`
    - This route uses `authMiddleware`, so the client must:
      1) Obtain a JWT from either:
         - `POST /auth/verify-otp` (after signup), or
         - `POST /auth/login` (for existing verified users).
      2) Send requests with:
         - Header: `Authorization: Bearer <token>`.
    - Inside the handler, `req.user.id` is used as `userId` when logging conversions.

You can protect additional routes by importing `authMiddleware` and adding it to the route definition:

```js
import { authMiddleware } from "./middleware/auth.middleware.js";

router.get("/some-protected-endpoint", authMiddleware, (req, res) => {
  // req.user is available here
});
```

---

### 6. Recommended Client Flow (Happy Path)

1) **User signs up**
   - `POST /auth/signup` with name, mobile, email, password.
   - Backend creates user, generates OTP, sends SMS.

2) **User verifies account**
   - User reads OTP from SMS.
   - `POST /auth/verify-otp` with email + OTP.
   - Backend verifies and returns a **JWT**.

3) **User accesses protected features**
   - Frontend stores the JWT (e.g., in memory or secure storage).
   - For calls like `POST /claude/generate`, include:
     - `Authorization: Bearer <token>`.
   - Backend middleware validates token and ensures the user is verified.

4) **Subsequent logins**
   - User skips OTP and uses:
     - `POST /auth/login` with email + password.
   - Backend returns a fresh JWT for the session.

