# APP_AUTH.md - Frontend App JWT Authentication

## Overview

The OGOUÉ frontend app (`frontend_app/js/ogoue-state.js`) has been updated to use JWT authentication instead of hardcoded organization IDs.

**Changes:**
- ❌ Removed hardcoded `ORG_ID`
- ✅ Added JWT token management from localStorage
- ✅ Added `Authorization: Bearer` header to all API requests
- ✅ Removed `organizationId` parameter from all API calls
- ✅ Added automatic 401 handling with redirect to login

---

## Key Changes in ogoue-state.js

### 1. Authentication Helpers

**New functions added:**

```javascript
/**
 * Gets JWT token from localStorage
 */
function getToken() {
  return localStorage.getItem("authToken");
}

/**
 * Gets current user from localStorage
 */
function getCurrentUser() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Handles 401 Unauthorized responses
 * - Clears auth tokens
 * - Redirects to login page
 */
function handleUnauthorized() {
  console.warn("❌ Token expiré ou invalide. Redirection vers login...");
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  window.location.href = "../../frontend_marketing/homepage/login.html";
}
```

### 2. API URL Changes

**Backend URL:**
```javascript
// Before
const API_BASE_URL = "http://localhost:3001";

// After
const API_BASE_URL = "http://127.0.0.1:3001";
```

### 3. Request Header Changes

**All fetch requests now include:**

```javascript
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${token}`  // New!
}
```

**Example:**
```javascript
const response = await fetch(`${API_BASE_URL}/api/sales`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`  // ← Token added here
  },
  body: JSON.stringify(payload)
});
```

### 4. Response Handling

**All functions now check for 401:**

```javascript
if (response.status === 401) {
  handleUnauthorized();  // Clears token + redirects to login
  return null;  // or empty array []
}
```

### 5. API Endpoint Changes

#### Sales Endpoints

**Before:**
```javascript
const params = new URLSearchParams({
  organizationId: ORG_ID,  // ← Hardcoded!
  month: mois,
  year: annee
});
```

**After:**
```javascript
const params = new URLSearchParams({
  month: mois,
  year: annee
  // organizationId removed - backend gets it from JWT token
});
```

#### Expense Endpoints

**Before:**
```javascript
const params = new URLSearchParams({
  organizationId: ORG_ID,  // ← Hardcoded!
  month: mois,
  year: annee
});
```

**After:**
```javascript
const params = new URLSearchParams({
  month: mois,
  year: annee
  // organizationId removed - backend gets it from JWT token
});
```

#### Summary Endpoint

**Before:**
```javascript
const params = new URLSearchParams({
  orgId: ORG_ID,  // ← Hardcoded!
  month: mois,
  year: annee
});
```

**After:**
```javascript
const params = new URLSearchParams({
  month: mois,
  year: annee
  // orgId removed - backend gets it from JWT token
});
```

---

## Modified Functions

### addVente(vente)

**Changes:**
- ✅ Check for token at start
- ✅ Removed `organizationId` from payload
- ✅ Added `Authorization` header with token
- ✅ Handle 401 response

```javascript
async function addVente(vente) {
  const token = getToken();
  if (!token) {
    alert("Vous devez être connecté");
    handleUnauthorized();
    return null;
  }

  try {
    const payload = {
      // ❌ No longer sends organizationId
      saleDate: vente.date,
      description: vente.description || "",
      // ... other fields
    };

    const response = await fetch(`${API_BASE_URL}/api/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`  // ✅ Token header
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {  // ✅ Check 401
      handleUnauthorized();
      return null;
    }
    // ... rest of function
  }
}
```

### addDepense(depense)

**Changes:**
- ✅ Check for token at start
- ✅ Removed `organizationId` from payload
- ✅ Added `Authorization` header with token
- ✅ Handle 401 response

```javascript
async function addDepense(depense) {
  const token = getToken();
  if (!token) {
    alert("Vous devez être connecté");
    handleUnauthorized();
    return null;
  }

  try {
    const payload = {
      // ❌ No longer sends organizationId
      expenseDate: depense.date,
      category: depense.categorie || "",
      // ... other fields
    };

    const response = await fetch(`${API_BASE_URL}/api/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`  // ✅ Token header
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {  // ✅ Check 401
      handleUnauthorized();
      return null;
    }
    // ... rest of function
  }
}
```

### getVentesPourPeriode(mois, annee)

**Changes:**
- ✅ Check for token at start
- ✅ Removed `organizationId` parameter
- ✅ Added `Authorization` header with token
- ✅ Handle 401 response

```javascript
async function getVentesPourPeriode(mois, annee) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return [];
  }

  try {
    const params = new URLSearchParams({
      // ❌ organizationId removed
      month: mois,
      year: annee
    });

    const response = await fetch(`${API_BASE_URL}/api/sales?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`  // ✅ Token header
      }
    });

    if (response.status === 401) {  // ✅ Check 401
      handleUnauthorized();
      return [];
    }
    // ... rest of function
  }
}
```

### getDepensesPourPeriode(mois, annee)

**Changes:**
- ✅ Check for token at start
- ✅ Removed `organizationId` parameter
- ✅ Added `Authorization` header with token
- ✅ Handle 401 response

### getResumeMensuel(mois, annee)

**Changes:**
- ✅ Check for token at start
- ✅ Removed `orgId` parameter (was typo, should have been `organizationId`)
- ✅ Added `Authorization` header with token
- ✅ Handle 401 response

---

## Window Exports (window.OGOUE)

**Before:**
```javascript
window.OGOUE = {
  appState,
  ORG_ID,  // ❌ Removed - hardcoded ID
  setPeriodeCourante,
  addVente,
  addDepense,
  getVentesPourPeriode,
  getDepensesPourPeriode,
  getResumeMensuel
};
```

**After:**
```javascript
window.OGOUE = {
  appState,
  getToken,               // ✅ New - get JWT token
  getCurrentUser,         // ✅ New - get user data
  handleUnauthorized,     // ✅ New - handle 401
  setPeriodeCourante,
  addVente,
  addDepense,
  getVentesPourPeriode,
  getDepensesPourPeriode,
  getResumeMensuel
};
```

---

## How It Works

### User Authentication Flow

```
1. User logs in via frontend_marketing/login.html
   ↓
2. Token stored in localStorage.authToken
3. User info stored in localStorage.user
   ↓
4. User navigates to frontend_app/module_tableau_bord.html
   ↓
5. ogoue-state.js functions are called
   ↓
6. getToken() retrieves JWT from localStorage
   ↓
7. Authorization header added: "Bearer <JWT>"
   ↓
8. Request sent to backend with token
   ↓
9. Backend validates token + extracts organizationId
   ↓
10. Returns data for that organization only
```

### Error Handling Flow

```
If API returns 401 Unauthorized:
   ↓
handleUnauthorized() called
   ↓
1. localStorage.authToken cleared
2. localStorage.user cleared
3. Redirect to login.html
   ↓
User must log in again
```

---

## Using Auth in Frontend

### Example: Get Current User

```javascript
const user = window.OGOUE.getCurrentUser();
console.log(user.firstName);  // "Benoit"
console.log(user.organizationId);  // "709e9968-..."
```

### Example: Check if Logged In

```javascript
const token = window.OGOUE.getToken();
if (!token) {
  console.log("Not logged in");
  window.location.href = "../../frontend_marketing/homepage/login.html";
}
```

### Example: Make API Call (already in functions)

```javascript
// Functions automatically handle token + 401
const sales = await window.OGOUE.getVentesPourPeriode(12, 2025);

// If token expired:
// - 401 response triggers handleUnauthorized()
// - User is redirected to login.html
```

---

## Removed Code

### Hardcoded ORG_ID

**This line was removed:**
```javascript
const ORG_ID = "015eb7eb-35bc-4863-9992-4c601f5c9f6f";
```

**Why:** Organization ID is now determined by the JWT token. The backend extracts `organizationId` from the token payload and uses it to filter data. This prevents any user from accessing another organization's data.

### organizationId in API Payloads

**Removed from all POST requests:**
```javascript
// BEFORE - Backend didn't know which org this was for
const payload = {
  organizationId: ORG_ID,  // ❌ Removed
  saleDate: vente.date,
  // ...
};

// AFTER - Backend knows org from JWT token
const payload = {
  saleDate: vente.date,    // ✅ No organizationId needed
  // ...
};
```

---

## Security Improvements

### Before (Hardcoded orgId)
- ❌ Organization ID visible in code
- ❌ Can only work for one organization
- ❌ No user authentication
- ❌ No token management

### After (JWT Authentication)
- ✅ No hardcoded credentials
- ✅ Multi-organization support
- ✅ JWT-based authentication
- ✅ Token expiration handling
- ✅ Automatic 401 handling
- ✅ Organization isolation (backend enforces)

---

## Testing Guide

### Test Scenario 1: Normal Flow

1. Navigate to `frontend_marketing/homepage/login.html`
2. Log in with: `benoit@test.com` / `Test1234!`
3. Get redirected to `frontend_app/module_tableau_bord.html`
4. App loads data using token from localStorage
5. Dashboard displays sales/expenses for logged-in user's organization

**Expected Result:** ✅ Data loads without errors

### Test Scenario 2: Missing Token

1. Open `frontend_app/module_tableau_bord.html` directly (no login)
2. JavaScript calls getVentesPourPeriode()
3. getToken() returns null
4. handleUnauthorized() called
5. Redirected to login page

**Expected Result:** ✅ Automatic redirect to login

### Test Scenario 3: Expired Token

1. Log in successfully
2. Wait for token to expire (7 days) OR manually delete from localStorage
3. Try to refresh page or load new data
4. API returns 401 Unauthorized
5. handleUnauthorized() called
6. Redirected to login page

**Expected Result:** ✅ Automatic redirect to login

### Test Scenario 4: Token Storage

1. Log in successfully
2. Open browser DevTools (F12)
3. Go to Application → LocalStorage
4. Look for:
   - Key: `authToken` → Value: JWT token starting with `eyJ...`
   - Key: `user` → Value: JSON with user data

**Expected Result:** ✅ Both keys present with valid data

### Test Scenario 5: API with Authorization Header

1. Log in successfully
2. Open DevTools (F12) → Network tab
3. Trigger data load (e.g., navigate to sales page)
4. Look for request to `/api/sales?month=...&year=...`
5. Check request headers:
   - Should have: `Authorization: Bearer eyJ...`
   - Should NOT have: `organizationId` in query params

**Expected Result:** ✅ Authorization header present, no organizationId in URL

---

## Browser DevTools Debugging

### Check Token

```javascript
// In console:
localStorage.getItem('authToken')
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4YTg0MDMzOC...
```

### Check User Data

```javascript
// In console:
JSON.parse(localStorage.getItem('user'))
// {
//   id: "8a840338-177f-4eb3-9278-4edb0488e33a",
//   firstName: "Benoit",
//   lastName: "Test",
//   email: "benoit@test.com",
//   role: "manager",
//   organizationId: "709e9968-071c-4a69-8366-28755f884cb9"
// }
```

### Check if getToken() works

```javascript
// In console:
window.OGOUE.getToken()
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Simulate Logout

```javascript
// In console:
window.OGOUE.handleUnauthorized()
// → Will clear token and redirect to login
```

---

## Configuration

**Backend URL:**
```javascript
const API_BASE_URL = "http://127.0.0.1:3001";
```

To change, update in `frontend_app/js/ogoue-state.js`

**Token Storage Key:**
```javascript
localStorage.getItem("authToken")  // JWT token
localStorage.getItem("user")       // User data JSON
```

These match the keys set by `frontend_marketing/homepage/login.html` and `signin.html`

---

## Next Steps

1. ✅ Backend Auth API working (Étape 1)
2. ✅ Frontend Marketing integrated (Étape 2)
3. ✅ Frontend App using JWT (Étape 3)
4. **TODO (Étape 4):** End-to-end testing
   - Test login flow
   - Test data loading in app
   - Test token expiration
   - Test multi-user scenarios

---

## Files Modified

- `frontend_app/js/ogoue-state.js` - Complete JWT authentication integration

---

**Last Updated:** December 23, 2025  
**Status:** ✅ Frontend App Auth Ready  
**Security:** ✅ No hardcoded credentials, JWT-based auth
