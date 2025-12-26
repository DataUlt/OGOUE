# TEST_AUTH.md - Auth Backend Testing Guide

## Overview

This document contains all cURL commands to test the OGOUÉ Auth Backend (JWT).

**Backend URL:** `http://127.0.0.1:3001`

---

## 1A - REGISTER

Create a new organization and user account.

**Endpoint:** `POST /api/auth/register`

**Request:**
```bash
curl -X POST http://127.0.0.1:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Benoit",
    "lastName": "Test",
    "email": "benoit@test.com",
    "password": "Test1234!",
    "organizationName": "OGOUE Demo",
    "rccmNumber": "RCCM-001",
    "nifNumber": "NIF-001",
    "activity": "Commerce",
    "activityDescription": "Org de test"
  }'
```

**Expected Response (201 Created):**
```json
{
  "message": "Inscription réussie",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "8a840338-177f-4eb3-9278-4edb0488e33a",
    "firstName": "Benoit",
    "lastName": "Test",
    "email": "benoit@test.com",
    "role": "manager",
    "organizationId": "709e9968-071c-4a69-8366-28755f884cb9"
  },
  "organization": {
    "id": "709e9968-071c-4a69-8366-28755f884cb9",
    "name": "OGOUE Demo"
  }
}
```

**Fields:**
- `firstName` (required): User first name (1-100 chars)
- `lastName` (required): User last name (1-100 chars)
- `email` (required): Valid email (must be unique)
- `password` (required): Password (min 6 chars)
- `organizationName` (required): Organization name (1-200 chars)
- `rccmNumber` (optional): RCCM number
- `nifNumber` (optional): NIF number
- `activity` (optional): Activity type
- `activityDescription` (optional): Activity description
- `role` (optional): "manager" or "agent" (default: "manager")

**What it does:**
1. Creates a new organization in `app.organizations` table
2. Creates a new user in `app.users` table (password hashed with bcrypt)
3. Returns JWT token valid for 7 days
4. User is automatically assigned "manager" role

---

## 1B - LOGIN

Authenticate with email and password to get a new JWT token.

**Endpoint:** `POST /api/auth/login`

**Request:**
```bash
curl -X POST http://127.0.0.1:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "benoit@test.com",
    "password": "Test1234!"
  }'
```

**Expected Response (200 OK):**
```json
{
  "message": "Connexion réussie",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "8a840338-177f-4eb3-9278-4edb0488e33a",
    "firstName": "Benoit",
    "lastName": "Test",
    "email": "benoit@test.com",
    "role": "manager",
    "organizationId": "709e9968-071c-4a69-8366-28755f884cb9"
  }
}
```

**Fields:**
- `email` (required): User email
- `password` (required): User password

**What it does:**
1. Finds user by email
2. Verifies password hash matches
3. Returns new JWT token (valid 7 days)

**Error Responses:**
- `401` - "Email ou mot de passe incorrect" (invalid email or wrong password)

---

## 1C - ME (Authenticated)

Get current authenticated user data.

**Endpoint:** `GET /api/auth/me`

**Request:**
```bash
# Replace <TOKEN> with the JWT token from register or login
curl -X GET http://127.0.0.1:3001/api/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

**Example with real token:**
```bash
curl -X GET http://127.0.0.1:3001/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Expected Response (200 OK):**
```json
{
  "user": {
    "id": "8a840338-177f-4eb3-9278-4edb0488e33a",
    "firstName": "Benoit",
    "lastName": "Test",
    "email": "benoit@test.com",
    "role": "manager",
    "organizationId": "709e9968-071c-4a69-8366-28755f884cb9"
  }
}
```

**Headers:**
- `Authorization: Bearer <JWT_TOKEN>` (required)

**What it does:**
1. Extracts `userId` from JWT token
2. Fetches user data from database
3. Returns user info with organization ID

**Error Responses:**
- `401` - "Non authentifié" (missing or invalid token)
- `404` - "Utilisateur non trouvé" (user not found in DB)
- `500` - "Erreur serveur" (server error)

---

## Running Full Test Suite

Use the PowerShell script provided:

```powershell
powershell -ExecutionPolicy Bypass -File "backend\full_test.ps1"
```

This will:
1. Start the backend server
2. Wait for it to be ready
3. Run all 3 tests (Register, Login, Me)
4. Display results with colors
5. Keep backend running

---

## Database Validation

After running tests, validate data in PostgreSQL:

```sql
-- Check organization was created
SELECT id, name FROM app.organizations WHERE name = 'OGOUE Demo';

-- Check user was created  
SELECT id, first_name, last_name, email, role, organization_id FROM app.users WHERE email = 'benoit@test.com';
```

---

## JWT Token Structure

Tokens are JWT (JSON Web Tokens) containing:

**Payload:**
```json
{
  "userId": "8a840338-177f-4eb3-9278-4edb0488e33a",
  "email": "benoit@test.com",
  "organizationId": "709e9968-071c-4a69-8366-28755f884cb9",
  "role": "manager",
  "iat": 1703252400,
  "exp": 1703857200
}
```

**Expires in:** 7 days

**Secret:** Configured in `.env` as `JWT_SECRET`

---

## Environment Setup

Before testing, ensure:

1. **.env file** contains:
   ```
   PORT=3001
   NODE_ENV=development
   DATABASE_URL=postgresql://ogoue_dev:ogoue01@localhost:5432/ogoue_dev
   CORS_ORIGIN=*
   JWT_SECRET=ogoue_dev_jwt_secret_2025
   ```

2. **PostgreSQL is running** with database `ogoue_dev`

3. **Backend is started:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

4. **Database tables exist:**
   ```bash
   \dt app.*  # In psql - should show users, organizations, sales, expenses
   ```

---

## Troubleshooting

### "Cannot connect to server"
- Ensure backend is running: `npm run dev`
- Check port 3001 is not already in use: `netstat -ano | findstr :3001` (Windows) or `lsof -i :3001` (macOS/Linux)

### "Email already in use"
- Use a different email for registration
- Or delete the user from DB: `DELETE FROM app.users WHERE email = 'benoit@test.com';`

### "Invalid token"
- Ensure token is copied completely
- Check token hasn't expired (valid for 7 days)
- Verify `JWT_SECRET` matches between backend `.env` and token generation

### "Non authentifié" (401)
- Authorization header must be exactly: `Authorization: Bearer <TOKEN>`
- Cannot use "Bearer <TOKEN>" without the space

---

## Next Steps

Once all auth tests pass:
1. Move to **Étape 2**: Connect frontend_marketing (login.html/signin.html) to Auth API
2. Move to **Étape 3**: Update frontend_app to use Auth tokens instead of hardcoded orgId
3. Test end-to-end flow

---

**Last Updated:** December 23, 2025  
**Backend Status:** ✅ Auth API Ready  
**Tests:** ✅ All Passing
