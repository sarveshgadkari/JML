# 🔧 Troubleshooting 401 Unauthorized Error

## Issue
You're getting "API Error: 401" when trying to load your lawyer profile.

---

## ✅ **Solution: Create an Account First!**

The 401 error likely means you haven't created a Supabase user account yet. Here's what to do:

### **Option 1: Sign Up Through the App (Easiest)**

1. **Open your app**
2. **Click "Login" in the top-right**
3. Click **"Sign up"** at the bottom of the login modal
4. Fill in your details:
   - Full Name
   - Email
   - Phone Number
   - Password (at least 6 characters)
5. Click **"Sign Up"**
6. You'll be automatically logged in!

### **Option 2: Create Account via Supabase Dashboard**

1. Go to **Supabase Dashboard** → **Authentication** → **Users**
2. Click **"Invite User"** or **"Add User"**
3. Enter your email and password
4. **Important:** Check "Auto Confirm User" (since email server isn't configured)
5. Click **"Send Invite"** or **"Create User"**
6. Now you can login through the app!

---

## 🔍 **How to Debug**

I've added console logging to help debug. Open **Browser Console** (F12) and look for:

### **When you login, you should see:**
```
Attempting sign in for: your.email@example.com
Sign in successful, storing token
Setting auth token: eyJhbGciOiJIUzI1NiIs...
Token stored, session user: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### **When loading profile, you should see:**
```
Getting auth token: Token found
API Call: {
  endpoint: "/lawyers/me",
  hasToken: true,
  tokenPreview: "eyJhbGciOiJIUzI1NiIs..."
}
```

### **If you see:**
```
Getting auth token: No token, using anon key
```

**This means the token wasn't stored properly after login!**

---

## 🛠️ **Common Fixes**

### **Fix 1: Clear Browser Storage**
1. Open Browser Console (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Clear **localStorage**
4. Refresh the page
5. Try logging in again

### **Fix 2: Check Supabase Auth Settings**
1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Make sure **"Enable Email Confirmations"** is **OFF** (or set to false)
3. This allows immediate login without email confirmation

### **Fix 3: Verify Backend is Deployed**
1. Go to **Supabase Dashboard** → **Edge Functions**
2. Find **make-server-e36f2be2**
3. Make sure it's deployed with the latest code
4. Check the deployment logs for errors

---

## 📝 **Complete Login Flow**

Here's what should happen when you login:

1. **Enter email/password** → Click "Login"
2. **Supabase Auth** verifies credentials
3. **Frontend** receives access token
4. **Token stored** in localStorage as `supabase_auth_token`
5. **Backend called** at `/lawyers/me` with token in Authorization header
6. **Backend verifies** token with Supabase
7. **Backend checks** if lawyer profile exists for your user_id
   - If NO: Creates one automatically
   - If YES: Returns existing profile
8. **Frontend displays** your profile

---

## ⚠️ **Important Notes**

### **User ID Linking**
- Your **Supabase Auth User ID** must match the **`user_id`** in the lawyers table
- The backend automatically creates a lawyer profile on first login
- The profile is linked to your auth user via `user_id` column

### **Admin Status**
- Admin status is separate from user account
- After creating account, set admin status via SQL:

```sql
INSERT INTO kv_store_e36f2be2 (key, value)
VALUES ('admin:YOUR_USER_ID_HERE', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
```

---

## 🎯 **Step-by-Step Checklist**

- [ ] **Create Supabase user account** (via app signup or dashboard)
- [ ] **Login with email/password**
- [ ] **Check browser console** for "Token stored" message
- [ ] **Verify localStorage** has `supabase_auth_token`
- [ ] **Backend should auto-create** lawyer profile
- [ ] **Set admin status** in KV store (if you want admin access)
- [ ] **Refresh page** and login again
- [ ] **Should see your profile!**

---

## 🚨 **Still Not Working?**

Check these in browser console:

### **1. Token is being stored:**
```javascript
localStorage.getItem('supabase_auth_token')
// Should return: "eyJhbGciOiJIUzI1NiIs..." (long string)
```

### **2. Supabase URL and project ID are correct:**
```javascript
console.log(window.location.origin)
// Should match your Supabase project URL
```

### **3. Backend is accessible:**
```javascript
fetch('https://iyoxxvdkdwdpatzjljrs.supabase.co/functions/v1/make-server-e36f2be2/health')
  .then(r => r.json())
  .then(console.log)
// Should return: { status: "ok" }
```

---

## 📧 **Create Test Account**

Here's a quick test account you can create:

**Email:** test@judgemylawyer.com  
**Password:** password123  
**Name:** Test Lawyer  
**Phone:** +91 98765 43210

Then set as admin:
```sql
-- Get user ID first
SELECT id, email FROM auth.users WHERE email = 'test@judgemylawyer.com';

-- Then set admin (replace USER_ID)
INSERT INTO kv_store_e36f2be2 (key, value)
VALUES ('admin:USER_ID', 'true');
```

---

## ✅ **Success Indicators**

You'll know it's working when:
- ✅ Login doesn't show errors
- ✅ Console shows "Token stored"
- ✅ Profile loads without 401 error
- ✅ You see your name (not "Unnamed Lawyer")
- ✅ Admin dashboard appears (if admin status is set)

---

**Try creating an account through the app's signup modal first - it's the easiest way!** 🚀
