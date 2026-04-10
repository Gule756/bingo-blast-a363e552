# Git Commands for Quick Deployment

## 🚀 **Push Your Code Changes**

### **Basic Workflow**
```bash
# Add all changes
git add .

# Commit with message
git commit -m "Fixed ghost message bug and updated bot logic"

# Push to GitHub
git push origin main
```

### **If You Get Errors:**
```bash
# First time setup:
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# If rejected (need to pull first):
git pull origin main
git push origin main

# If conflicts:
git pull origin main
git add .
git commit -m "Merge and fix conflicts"
git push origin main
```

## 🔄 **Quick Commands for Updates**

### **After Code Changes in Windsurf:**
```bash
# One-liner for quick push:
git add . && git commit -m "Updated bot logic" && git push origin main
```

### **Check Status:**
```bash
git status
git log --oneline -5
```

### **Undo Last Commit:**
```bash
git reset --soft HEAD~1
# Then make new commit:
git add . && git commit -m "Fixed previous commit"
git push origin main --force
```

## 📱 **For Different Hosting**

### **Vercel (Frontend):**
- Auto-deploys on `git push`
- Takes 1-2 minutes
- Check at vercel.com

### **Render/Railway (Backend):**
- Auto-deploys on `git push`
- Takes 2-5 minutes
- Check logs in dashboard

### **PythonAnywhere (Manual):**
- Upload files via dashboard
- Click reload button
- No Git needed

---

**Use these commands to get your bot responding again!** 🚀
