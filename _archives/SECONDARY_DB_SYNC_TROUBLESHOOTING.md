# Secondary Database Sync Troubleshooting Guide

## Issue: Users and PMEs not being created in PFE-OGOUE-FINANCEMENT

### Step 1: Verify Environment Variables on Render

Ensure these are set in your Render environment:

```
SUPABASE_URL_SECONDARY=https://xqqusftebfmzuwoueqcg.supabase.co
SUPABASE_SERVICE_ROLE_KEY_SECONDARY=<your-actual-service-key>
```

Check logs with:
```bash
curl https://api.render.com/v1/services/<SERVICE_ID>/events -H "Authorization: Bearer YOUR_RENDER_API_KEY"
```

---

### Step 2: Verify Secondary Database Tables Exist

Run these curl commands to check if tables are set up:

#### Check USERS table:
```bash
curl 'https://xqqusftebfmzuwoueqcg.supabase.co/rest/v1/users?select=id' \
  -H "apikey: SUPABASE_SERVICE_ROLE_KEY_SECONDARY" \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY_SECONDARY"
```

**Expected Response:**
- `200 OK` with empty array `[]` or existing records
- If `400` error → table doesn't exist or schema mismatch

#### Check PMES table:
```bash
curl 'https://xqqusftebfmzuwoueqcg.supabase.co/rest/v1/pmes?select=id' \
  -H "apikey: SUPABASE_SERVICE_ROLE_KEY_SECONDARY" \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY_SECONDARY"
```

#### If tables don't exist, create them using:
Execute the SQL from `SECONDARY_DB_SETUP.sql` in your Supabase SQL editor:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select **PFE-OGOUE-FINANCEMENT** project
3. Go to **SQL Editor**
4. Create a new query
5. Paste the entire content from `SECONDARY_DB_SETUP.sql`
6. Click **Execute**

---

### Step 3: Check Backend Logs on Render

After creating a new account, check the Render logs for the detailed sync debugging output:

Look for these log lines:
```
🔄 Syncing to secondary Supabase...
📋 [DEBUG] User data to sync: {...}
📋 [DEBUG] Organization data to sync: {...}
➡️ Inserting into secondary users table: {...}
✅ User synced to secondary Supabase: ...
```

If you see error logs like:
```
❌ Secondary user sync error: {message: "...", code: "...", details: "..."}
```

This tells you what's wrong.

---

### Step 4: Common Error Codes & Solutions

| Error Code | Meaning | Solution |
|-----------|---------|----------|
| `400 Bad Request` | Table/column doesn't exist or type mismatch | Run `SECONDARY_DB_SETUP.sql` to create tables |
| `401 Unauthorized` | Invalid/expired service key | Update `SUPABASE_SERVICE_ROLE_KEY_SECONDARY` env var |
| `42P01` (PostgreSQL) | Relation (table) does not exist | Create tables with SQL script |
| `23505` | Duplicate key violation | User with this email already exists in secondary DB |
| `23503` | Foreign key violation | User doesn't exist when inserting PME |

---

### Step 5: Manual Test

After creating a new account on the main application:

1. **Check PRIMARY database (PFE-OGOUE):**
```bash
curl 'https://PROJECT_ID.supabase.co/rest/v1/users?select=*' \
  -H "apikey: SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY"
```
✅ Should show the new user record

2. **Check SECONDARY database (PFE-OGOUE-FINANCEMENT):**
```bash
curl 'https://xqqusftebfmzuwoueqcg.supabase.co/rest/v1/users?select=*' \
  -H "apikey: SUPABASE_SERVICE_ROLE_KEY_SECONDARY" \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY_SECONDARY"
```
✅ Should also show the new user record

3. **Check PMES table:**
```bash
curl 'https://xqqusftebfmzuwoueqcg.supabase.co/rest/v1/pmes?select=*' \
  -H "apikey: SUPABASE_SERVICE_ROLE_KEY_SECONDARY" \
  -H "Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY_SECONDARY"
```
✅ Should show the PME record with all fields populated

---

### Step 6: Verify Data Consistency

After a successful registration, verify the sync worked by comparing:

**PRIMARY DB:**
```bash
SELECT id, first_name, last_name, email, organization_id 
FROM public.users 
ORDER BY created_at DESC LIMIT 1;

SELECT id, name, rccm_number, nif_number, activity, activity_description 
FROM public.organizations 
ORDER BY created_at DESC LIMIT 1;
```

**SECONDARY DB:**
```bash
SELECT id, email, full_name, role 
FROM public.users 
ORDER BY created_at DESC LIMIT 1;

SELECT id, user_id, company_name, rccm_number, nif_number, sector, activity_description 
FROM public.pmes 
ORDER BY created_at DESC LIMIT 1;
```

---

### Step 7: If Still Not Working

Enable detailed logging by adding this to `auth.controller.js` (already done in latest version):

```javascript
console.log("📋 [DEBUG] User data to sync:", userData);
console.log("📋 [DEBUG] Organization data to sync:", orgData);
console.log("➡️ Inserting into secondary users table:", {...});
```

Then redeploy and check Render logs for the exact error message.

---

### Step 8: Full Reset (if needed)

If you need to reset the secondary database:

```sql
-- Delete all data (careful!)
TRUNCATE TABLE public.pmes CASCADE;
TRUNCATE TABLE public.users CASCADE;

-- Or drop and recreate
DROP TABLE IF EXISTS public.pmes CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
```

Then re-run `SECONDARY_DB_SETUP.sql` to recreate the tables.
