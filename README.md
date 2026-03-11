# FocusForge Chrome Extension — Installation Guide

## 📦 What's Included
- YouTube Shorts blocker (CSS + JS — works instantly)
- Instagram Reels blocker
- TikTok, Twitter/X, Snapchat full block
- Pomodoro timer + Stopwatch + Custom timer
- Channel whitelist (only approved YouTube channels allowed)
- Strict Mode (blocks ALL non-study sites)
- Daily motivation + streak tracker
- Blocked page with motivational quotes

---

## 🚀 How to Install (Chrome / Brave / Edge)

1. **Download & Unzip** this folder somewhere permanent (e.g. Desktop/FocusForge)

2. **Open Chrome** and go to: `chrome://extensions`

3. **Enable Developer Mode** (toggle in top-right corner)

4. Click **"Load unpacked"**

5. **Select the `focusforge-extension` folder** you unzipped

6. The extension icon (🟡 FF) will appear in your toolbar

7. **Pin it** by clicking the puzzle piece icon → pin FocusForge

---

## ✅ How It Works

| Feature | How it's blocked |
|---|---|
| YouTube Shorts | CSS hides shelf instantly; JS redirects /shorts URL |
| Instagram Reels | CSS + JS intercept on page load |
| TikTok | declarativeNetRequest → redirect to blocked page |
| Twitter/X | declarativeNetRequest → redirect to blocked page |
| Custom sites | Dynamic rules added when you block a site |
| Channel filter | Content script checks channel name on video pages |

---

## 🔧 Usage

1. Click the extension icon in the toolbar
2. Press **"▶ Start Focus Session"** to activate all blocks
3. Use the **Block tab** to toggle individual blockers
4. Use the **Channels tab** to whitelist YouTube channels
5. Press **"⏹ End Session"** when done (blocks are lifted)

---

## ❓ FAQ

**Q: Why do I still see Shorts sometimes?**
A: YouTube updates their HTML frequently. The CSS blocker runs first, but some elements may briefly appear. Report the CSS selector and we'll update.

**Q: Can I use this on Firefox?**
A: Not yet — Firefox requires a different manifest format. Chrome/Brave/Edge work perfectly.

**Q: Will this slow down my browser?**
A: No. The CSS blocker runs at document_start (before page renders). The JS uses MutationObserver efficiently.

---

## 🆕 Updating

To update: replace the files in the folder, then go to `chrome://extensions` and click the refresh icon on FocusForge.
