# DPDP Compliance Checker — Deployment Guide

## What you need before starting
- A Google account (to get a Gemini API key)
- A GitHub account (free at github.com)
- A Vercel account (free at vercel.com — sign up with GitHub)

---

## Step 1 — Get your Gemini API key

1. Go to https://aistudio.google.com/app/apikey
2. Click "Create API key"
3. Copy the key — it looks like: AIzaSy...
4. Keep it safe, don't share it

---

## Step 2 — Put files on GitHub

1. Go to github.com and click "New repository"
2. Name it: dpdp-checker
3. Set it to Public, click "Create repository"
4. Click "uploading an existing file"
5. Upload these files keeping the same folder structure:
   - api/index.py
   - public/index.html
   - vercel.json
   - requirements.txt

---

## Step 3 — Deploy on Vercel

1. Go to vercel.com, click "Add New Project"
2. Click "Import" next to your dpdp-checker repository
3. Leave all settings as default
4. Before clicking Deploy, click "Environment Variables"
5. Add:
   - Name:  GEMINI_API_KEY
   - Value: (paste your API key from Step 1)
6. Click "Deploy"
7. Wait ~2 minutes — Vercel builds and deploys automatically

---

## Step 4 — Your website is live

Vercel gives you a URL like: https://dpdp-checker.vercel.app

That's it. Every time you push changes to GitHub, Vercel automatically redeploys.

---

## Folder structure (must match exactly)

```
dpdp-checker/
├── api/
│   └── index.py          ← Python backend (Gemini API)
├── public/
│   └── index.html        ← The website
├── vercel.json           ← Tells Vercel how to build
└── requirements.txt      ← Python packages needed
```

---

## If something breaks

- Check Vercel dashboard → your project → "Deployments" → click the failed deploy → "Build Logs"
- Most common issue: GEMINI_API_KEY not set correctly in Environment Variables
- Go to Vercel project → Settings → Environment Variables → check it's there

---

## Disclaimer

This tool is for informational purposes only and does not constitute legal advice.
