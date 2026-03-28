# 🔐 How to Set Yourself as Admin

Since Supabase Auth doesn't have built-in user types, I've added an admin management system using the KV store.

---

## ✅ **Option 1: Set Admin via Supabase SQL Editor (Easiest)**

### **Step 1: Find Your User ID**

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Find your account and **copy your User ID**
   - It looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

### **Step 2: Run SQL Command**

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Click **"New Query"**
3. Paste this SQL:

```sql
-- Replace YOUR_USER_ID_HERE with your actual user ID
INSERT INTO kv_store_e36f2be2 (key, value)
VALUES ('admin:YOUR_USER_ID_HERE', 'true')
ON CONFLICT (key) 
DO UPDATE SET value = 'true';
```

**Example:**
```sql
INSERT INTO kv_store_e36f2be2 (key, value)
VALUES ('admin:a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'true')
ON CONFLICT (key) 
DO UPDATE SET value = 'true';
```

4. Click **"Run"**
5. You should see: ✅ **Success. 1 rows affected**

---

## ✅ **Option 2: Set Admin via API (Using Postman/Curl)**

### **Step 1: Get Your Service Role Key**

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Copy the **`service_role` key** (secret key - keep it safe!)

### **Step 2: Call the API**

**Using Postman:**

1. **Method:** POST
2. **URL:**
   ```
   https://iyoxxvdkdwdpatzjljrs.supabase.co/functions/v1/make-server-e36f2be2/auth/set-admin
   ```
3. **Headers:**
   ```
   Authorization: Bearer YOUR_SERVICE_ROLE_KEY_HERE
   Content-Type: application/json
   ```
4. **Body (JSON):**
   ```json
   {
     "email": "your.email@example.com",
     "isAdmin": true
   }
   ```
5. Click **Send**

**Using curl:**

```bash
curl -X POST \
  https://iyoxxvdkdwdpatzjljrs.supabase.co/functions/v1/make-server-e36f2be2/auth/set-admin \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your.email@example.com",
    "isAdmin": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "isAdmin": true,
  "message": "Admin status granted successfully"
}
```

---

## ✅ **Option 3: Update Frontend Login to Check Admin Status**

The backend now has two new endpoints:

### **1. Check if User is Admin:**
```
GET /make-server-e36f2be2/auth/is-admin
```

Returns:
```json
{
  "isAdmin": true,
  "userId": "...",
  "email": "..."
}
```

### **2. Set Admin Status (requires admin or service role):**
```
POST /make-server-e36f2be2/auth/set-admin
```

Body:
```json
{
  "userId": "...",  // or use email instead
  "email": "...",
  "isAdmin": true
}
```

---

## 🔍 **Verify Admin Status**

After setting admin, verify it worked:

### **Method 1: Check KV Store in SQL Editor**

```sql
SELECT * FROM kv_store_e36f2be2 
WHERE key LIKE 'admin:%';
```

You should see:
```
key                                      | value
-----------------------------------------|-------
admin:a1b2c3d4-e5f6-7890-abcd-ef1234567890 | true
```

### **Method 2: Call Check Admin API**

After logging in, call:
```
GET /make-server-e36f2be2/auth/is-admin
```

With your user's auth token in header:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## 🎯 **Quick Start: Recommended Method**

**I recommend Option 1 (SQL Editor) - it's the fastest:**

1. ✅ Go to Supabase → Authentication → Users
2. ✅ Copy your User ID
3. ✅ Go to SQL Editor → New Query
4. ✅ Run:
   ```sql
   INSERT INTO kv_store_e36f2be2 (key, value)
   VALUES ('admin:YOUR_USER_ID', 'true')
   ON CONFLICT (key) DO UPDATE SET value = 'true';
   ```
5. ✅ Done! You're now an admin

---

## 🔐 **Security Notes**

- **Service Role Key** is powerful - never expose it in frontend code
- The `/auth/set-admin` endpoint:
  - Can be called with Service Role Key (for initial setup)
  - Can be called by existing admins (to create more admins)
  - Cannot be called by regular users
- Admin status is stored in KV store with key pattern: `admin:USER_ID`

---

## 🚀 **Next Steps**

After setting yourself as admin:

1. **Deploy the updated backend** to Supabase (if not already deployed)
2. **Update the frontend** login flow to check admin status
3. **Test** by logging in and accessing admin features

---

## 💡 **For Future Admin Management**

Once you're an admin, you can create other admins through the app by calling:

```javascript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/make-server-e36f2be2/auth/set-admin`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`, // Your admin access token
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'newadmin@example.com',
      isAdmin: true
    })
  }
);
```

---

## ❓ **Troubleshooting**

### **Error: "User not found"**
- Make sure you've created an account in Supabase Auth first
- Check that the email exactly matches

### **Error: "Table kv_store_e36f2be2 doesn't exist"**
- Make sure you've run the database migration
- The table should already exist if you've deployed the backend

### **Can't access admin features**
- Verify admin status in KV store
- Make sure frontend is checking admin status correctly
- Check browser console for errors

---

**Need help? Let me know which method you'd like to use!** 🚀
