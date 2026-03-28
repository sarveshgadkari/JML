# 🚀 Quick Start Guide - Judge My Lawyer

## Get Started in 3 Minutes!

---

## Step 1: Create Your Account

### **Option A: Through the App (Recommended)**

1. Open your app
2. Click **"Login"** button
3. Click **"Sign up"** at the bottom
4. Fill in your details
5. Click **"Sign Up"**
6. ✅ Done! You're automatically logged in

### **Option B: Via Supabase Dashboard**

1. **Supabase** → **Authentication** → **Users**
2. Click **"Add User"**
3. Enter email and password
4. Check **"Auto Confirm User"**
5. Click **"Create User"**

---

## Step 2: Set Yourself as Admin

1. **Supabase** → **Authentication** → **Users**
2. Find your account, **copy your User ID**
3. **SQL Editor** → **New Query**
4. Run this (replace YOUR_USER_ID):

```sql
INSERT INTO kv_store_e36f2be2 (key, value)
VALUES ('admin:YOUR_USER_ID', 'true')
ON CONFLICT (key) DO UPDATE SET value = 'true';
```

---

## Step 3: Login and Test!

1. Open your app
2. Click **"Login"**
3. Select **"Lawyer"** 
4. Enter your email and password
5. ✅ You should see **Admin Dashboard**!

---

## 🎯 What You Can Do Now

### **As Admin:**
- ✅ Import cases via CSV
- ✅ Review lawyer/card claims
- ✅ Manage all data
- ✅ View comprehensive analytics

### **As Regular Lawyer:**
- ✅ View your profile
- ✅ See your statistics
- ✅ Claim your cases
- ✅ Update profile information

### **As Client:**
- ✅ Search for lawyers
- ✅ Save favorite lawyers
- ✅ Request consultations

---

## 🔧 Troubleshooting

### **Problem: 401 Error when loading profile**
**Solution:** You need to create a Supabase user account first! Use the signup modal.

### **Problem: Not redirecting to Admin Dashboard**
**Solution:** Make sure you ran the SQL command to set admin status with your correct User ID.

### **Problem: "Profile not found"**
**Solution:** The backend will auto-create your profile on first login. Just login again!

---

## 📚 More Help

- **Detailed admin setup:** See `/ADMIN_SETUP_COMPLETE.md`
- **401 error troubleshooting:** See `/TROUBLESHOOTING_401_ERROR.md`
- **Initial admin setup:** See `/SET_ADMIN_GUIDE.md`

---

## ✨ Features Available

1. **Public Content** (No login required)
   - Browse all lawyers, judges, courts
   - View detailed analytics
   - Search functionality

2. **Lawyer Features**
   - Personal dashboard
   - Profile management
   - Case claiming
   - Statistics tracking

3. **Admin Features**
   - CSV data import
   - Claims approval
   - Platform management
   - Full analytics

---

**That's it! Start by creating an account and logging in.** 🎉
