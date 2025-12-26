# AUTH_FLOW.md - Frontend Marketing Auth Flow

## Overview

The frontend_marketing pages (login.html and signin.html) are now connected to the OGOUÉ Auth API backend.

**Flow:**
1. User fills form on login.html or signin.html
2. Form submit triggers JavaScript handler
3. Handler calls backend API (POST /api/auth/login or POST /api/auth/register)
4. Token received and stored in localStorage
5. User redirected to app dashboard (frontend_app/module_tableau_bord.html)

---

## Login Flow (login.html)

### User Journey

```
┌─────────────────┐
│  login.html     │
│  User enters    │
│  email + pwd    │
└────────┬────────┘
         │ Submit
         ▼
┌──────────────────────────────┐
│ handleLogin(event)           │
│ - Validate inputs            │
│ - Call POST /api/auth/login  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Backend Response             │
│ - 200 OK: token + user data  │
│ - 401: Invalid credentials   │
│ - 400: Validation error      │
└────────┬─────────────────────┘
         │
         ├─ Error: Show message, stay on login.html
         │
         └─ Success:
            1. Store token in localStorage
            2. Store user data in localStorage
            3. Redirect to dashboard (1.5s delay)
            └──► frontend_app/module_tableau_bord.html
```

### Code Flow

```javascript
async function handleLogin(event) {
    // 1. Get form values
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    
    // 2. Validate
    if (!email || !password) {
        showError("Veuillez remplir tous les champs");
        return;
    }
    
    // 3. Call API
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    // 4a. Handle error
    if (!response.ok) {
        showError(data.error);
        return;
    }
    
    // 4b. Store token & redirect
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '../../frontend_app/module_tableau_bord.html';
}
```

### API Request

**Endpoint:** `POST http://127.0.0.1:3001/api/auth/login`

**Request Body:**
```json
{
  "email": "benoit@test.com",
  "password": "Test1234!"
}
```

**Success Response (200):**
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

**Error Response (401/400):**
```json
{
  "error": "Email ou mot de passe incorrect"
}
```

---

## Signup Flow (signin.html)

### User Journey

```
┌─────────────────┐
│  signin.html    │
│  User enters    │
│  registration   │
│  form details   │
└────────┬────────┘
         │ Submit
         ▼
┌──────────────────────────────────┐
│ handleSignup(event)              │
│ - Validate all inputs            │
│ - Check password match           │
│ - Verify terms accepted          │
│ - Call POST /api/auth/register   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Backend Response             │
│ - 201 Created: token + org   │
│ - 400: Email already used    │
│ - 400: Validation error      │
└────────┬─────────────────────┘
         │
         ├─ Error: Show message, stay on signin.html
         │
         └─ Success:
            1. Store token in localStorage
            2. Store user data in localStorage
            3. Redirect to dashboard (1.5s delay)
            └──► frontend_app/module_tableau_bord.html
```

### Code Flow

```javascript
async function handleSignup(event) {
    // 1. Get form values
    const firstname = document.getElementById('firstname').value.trim();
    const lastname = document.getElementById('lastname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const confirmPassword = document.getElementById('confirm_password').value.trim();
    const entreprise = document.getElementById('entreprise').value.trim();
    // ... more fields
    
    // 2. Client-side validation
    if (!email || !password || !confirmPassword || !firstname || !lastname || !entreprise) {
        showError('Veuillez remplir tous les champs requis');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('Les mots de passe ne correspondent pas');
        return;
    }
    
    // 3. Call API
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            firstName: firstname,
            lastName: lastname,
            email: email,
            password: password,
            organizationName: entreprise,
            rccmNumber: rccm || null,
            nifNumber: nif || null,
            activity: activity || null,
            activityDescription: activityNature || null
        })
    });
    
    const data = await response.json();
    
    // 4a. Handle error
    if (!response.ok) {
        showError(data.error || "Erreur d'inscription");
        return;
    }
    
    // 4b. Store token & redirect
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '../../frontend_app/module_tableau_bord.html';
}
```

### API Request

**Endpoint:** `POST http://127.0.0.1:3001/api/auth/register`

**Request Body:**
```json
{
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@example.com",
  "password": "SecurePass123!",
  "organizationName": "Ma PME",
  "rccmNumber": "GA-LBV-01-2022-...",
  "nifNumber": "2022 0101 5209-E",
  "activity": "Commerce",
  "activityDescription": "Vente et fabrication"
}
```

**Success Response (201):**
```json
{
  "message": "Inscription réussie",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "firstName": "Jean",
    "lastName": "Dupont",
    "email": "jean@example.com",
    "role": "manager",
    "organizationId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy"
  },
  "organization": {
    "id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    "name": "Ma PME"
  }
}
```

**Error Response (400/409):**
```json
{
  "error": "Cet email est déjà utilisé"
}
```

---

## LocalStorage Format

After successful login or signup, the following data is stored in browser localStorage:

### authToken
- **Key:** `authToken`
- **Value:** JWT token string
- **Purpose:** Used to authenticate API requests from frontend_app
- **Usage:** Add to request headers: `Authorization: Bearer <authToken>`
- **Expires:** 7 days (managed by backend)

**Example:**
```javascript
const token = localStorage.getItem('authToken');
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI4YTg0MDMzOC0xNzdmLTRlYjMtOTI3OC00ZWRiMDQ4OGUzM2EiLCJlbWFpbCI6ImJlbm9pdEB0ZXN0LmNvbSIsIm9yZ2FuaXphdGlvbklkIjoiNzA5ZTk5NjgtMDcxYy00YTY5LTgzNjYtMjg3NTVmODg0Y2I5Iiwicm9sZSI6Im1hbmFnZXIiLCJpYXQiOjE3MDMyNTI0MDAsImV4cCI6MTcwMzg1NzIwMH0.xxx
```

### user
- **Key:** `user`
- **Value:** JSON stringified user object
- **Purpose:** Store user information for frontend display
- **Fields:**
  - `id`: User UUID
  - `firstName`: User's first name
  - `lastName`: User's last name
  - `email`: User's email
  - `role`: "manager" or "agent"
  - `organizationId`: Organization UUID (for API calls)

**Example:**
```javascript
const user = JSON.parse(localStorage.getItem('user'));
// {
//   "id": "8a840338-177f-4eb3-9278-4edb0488e33a",
//   "firstName": "Benoit",
//   "lastName": "Test",
//   "email": "benoit@test.com",
//   "role": "manager",
//   "organizationId": "709e9968-071c-4a69-8366-28755f884cb9"
// }
```

---

## Error Handling

### Frontend Validation Errors

**Login errors:**
- Missing email or password
- Invalid email format (HTML5 validation)

**Signup errors:**
- Missing required fields (firstName, lastName, email, enterpriseName)
- Password too short (< 6 chars)
- Passwords don't match
- Terms not accepted

### Backend Validation Errors

**Login errors:**
- `401 Unauthorized` - "Email ou mot de passe incorrect" (invalid credentials)
- `400 Bad Request` - Invalid email format

**Signup errors:**
- `400 Bad Request` - "Cet email est déjà utilisé" (email already registered)
- `400 Bad Request` - Validation errors (invalid email, password too short, etc.)

### Network Errors

If server is down or not reachable:
- Error message displayed: "Erreur réseau: [error details]"
- User stays on login/signup page
- Can retry by resubmitting form

### Error Display

Errors are displayed in a red alert box above the form:
```html
<div id="errorMessage" class="hidden p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded-md"></div>
```

The `hidden` class is removed when error occurs, showing the message to the user.

---

## Testing Guide

### Test Login Flow

1. Go to `frontend_marketing/homepage/login.html`
2. Enter credentials from previous test:
   - Email: `benoit@test.com`
   - Password: `Test1234!`
3. Click "Se connecter"
4. Should redirect to `frontend_app/module_tableau_bord.html` after 1.5s
5. Check localStorage:
   ```javascript
   console.log(localStorage.getItem('authToken'));
   console.log(JSON.parse(localStorage.getItem('user')));
   ```

### Test Signup Flow

1. Go to `frontend_marketing/homepage/signin.html`
2. Fill form with new user details:
   - Prénom: Jean
   - Nom: Dupont
   - Email: jean.dupont@test.com
   - Entreprise: Test SARL
   - Password: Test1234!
   - Confirm: Test1234!
   - Check terms
3. Click "Créer un compte"
4. Should redirect to dashboard after 1.5s
5. Check localStorage in dev tools

### Test Error Scenarios

1. **Invalid credentials**: Login with wrong password → See error message
2. **Email already exists**: Signup with existing email → See error message
3. **Missing fields**: Signup without firstname → See validation error
4. **Network error**: Stop backend server → See network error message

---

## Integration with frontend_app

After successful auth, `module_tableau_bord.html` and other app pages need to:

1. **Read token from localStorage:**
   ```javascript
   const token = localStorage.getItem('authToken');
   if (!token) {
       // Redirect to login
       window.location.href = '../../frontend_marketing/homepage/login.html';
    }
   ```

2. **Add token to all API requests:**
   ```javascript
   fetch(`http://127.0.0.1:3001/api/sales`, {
       headers: {
           'Authorization': `Bearer ${token}`
       }
   })
   ```

3. **Handle 401 responses:**
   - If token expired or invalid
   - Redirect back to login.html
   - Clear localStorage

---

## Files Modified

- `frontend_marketing/homepage/login.html` - Added handleLogin() function + API integration
- `frontend_marketing/homepage/signin.html` - Updated handleSignup() function + API integration

---

## Configuration

**Backend URL:** `http://127.0.0.1:3001`

To change, update in both HTML files:
```javascript
const API_BASE_URL = "http://127.0.0.1:3001";
```

---

## Next Steps

1. ✅ Auth backend working (Étape 1)
2. ✅ Frontend marketing connected (Étape 2) 
3. **TODO (Étape 3):** Update frontend_app to use auth tokens instead of hardcoded orgId
4. **TODO (Étape 4):** Test end-to-end user flow

---

**Last Updated:** December 23, 2025  
**Status:** ✅ Frontend Marketing Auth Ready
