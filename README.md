# SplitTrip - Expense Tracker 💸

A beautiful, mobile-friendly expense tracker for splitting trip costs with friends. Deployed on PythonAnywhere for free!

## Features

- ✅ **Multiple Trips** - Track expenses for different trips
- ✅ **Add Expenses** - Track who paid and for what
- ✅ **Equal Splits** - Automatically split expenses among selected members
- ✅ **Balance Tracking** - See who owes what at a glance
- ✅ **Smart Settlements** - Optimized suggestions to minimize transactions
- ✅ **Multiple Currencies** - Support for INR, USD, EUR, MYR, and more
- ✅ **Mobile Optimized** - Works great on phones
- ✅ **Cloud Storage** - Data stored in SQLite database

## Live Demo

🌐 **Your app will be live at:** `https://YOUR_USERNAME.pythonanywhere.com`

---

## Deployment to PythonAnywhere (Free!)

### Step 1: Create PythonAnywhere Account

1. Go to [pythonanywhere.com](https://www.pythonanywhere.com)
2. Click "Start running Python online" → Sign up (Free tier is fine!)
3. Verify your email

### Step 2: Upload Your Code

**Option A: Via Git (Recommended)**

1. In PythonAnywhere, go to **Consoles** → **Bash**
2. Run these commands:

```bash
cd ~
git clone https://github.com/kiranh8086/expense-tracker.git
cd expense-tracker
pip install --user -r requirements.txt
```

**Option B: Manual Upload**

1. Go to **Files** tab
2. Create folder: `expense-tracker`
3. Upload all files: `app.py`, `requirements.txt`, `templates/`, `static/`

### Step 3: Create Web App

1. Go to **Web** tab
2. Click **Add a new web app**
3. Choose **Flask** and **Python 3.10**
4. Set source code path: `/home/YOUR_USERNAME/expense-tracker`
5. Set WSGI file path: Click the link to edit it

### Step 4: Configure WSGI

Replace the WSGI file contents with:

```python
import sys
path = '/home/YOUR_USERNAME/expense-tracker'
if path not in sys.path:
    sys.path.append(path)

from app import app as application
```

*(Replace YOUR_USERNAME with your actual PythonAnywhere username)*

### Step 5: Reload & Test

1. Click the **Reload** button (green button)
2. Visit: `https://YOUR_USERNAME.pythonanywhere.com`
3. 🎉 Your app is live!

---

## Local Development

### Setup

```bash
cd expense-tracker
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run

```bash
python app.py
```

Open http://localhost:5000 in your browser.

---

## Project Structure

```
expense-tracker/
├── app.py              # Flask backend with SQLite
├── requirements.txt    # Python dependencies
├── splittrip.db        # SQLite database (auto-created)
├── templates/
│   └── index.html      # Main HTML template
├── static/
│   ├── style.css       # Styles
│   └── app.js          # Frontend JavaScript
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/trips` | List all trips |
| POST | `/api/trips` | Create new trip |
| GET | `/api/trips/:id` | Get trip with expenses |
| PUT | `/api/trips/:id` | Update trip |
| DELETE | `/api/trips/:id` | Delete trip |
| GET | `/api/trips/:id/expenses` | List expenses |
| POST | `/api/trips/:id/expenses` | Add expense |
| DELETE | `/api/trips/:id/expenses/:eid` | Delete expense |
| GET | `/api/trips/:id/balances` | Get balances |
| GET | `/api/trips/:id/settlements` | Get settlements |

---

## Tech Stack

- **Backend:** Flask + SQLAlchemy
- **Database:** SQLite
- **Frontend:** Vanilla JavaScript
- **Styling:** Custom CSS (mobile-first)
- **Hosting:** PythonAnywhere (free tier)

---

Made with ❤️ for easier trip expense management
