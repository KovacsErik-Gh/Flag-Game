# 🚀 Guess the Flag – Ghid de pornire

## Cerințe

- **Python 3.10+** – [Download](https://www.python.org/downloads/) *(bifează "Add to PATH" la instalare!)*
- **Node.js** – deja instalat ✅

---

## 1. Instalare Backend (Python FastAPI)

Deschide un terminal PowerShell în folderul `backend\`:

```powershell
cd backend
python -m pip install -r requirements.txt
python main.py
```

Serverul backend va rula pe: **http://localhost:8000**

---

## 2. Instalare Frontend (Node.js)

Deschide **alt terminal** în folderul `frontend\`:

```powershell
cd frontend
npm install       # (o singură dată)
npm start
```

Aplicația va fi disponibilă la: **http://localhost:3000**

---

## Structura proiectului

```
TD/
├── backend/
│   ├── main.py          ← FastAPI (pornit cu: python main.py)
│   ├── models.py        ← Modele DB (User, Score)
│   ├── auth.py          ← JWT + bcrypt
│   ├── flags_data.py    ← Lista 195 tari
│   ├── database.py      ← SQLite setup
│   └── requirements.txt
│
└── frontend/
    ├── server.js        ← Express server (pornit cu: npm start)
    ├── views/           ← EJS templates
    └── public/          ← CSS + JS
```

---

## Flux de utilizare

1. Mergi la http://localhost:3000
2. Click **Sign Up** → creezi cont
3. Click **Play Now** → joci 10 tururi cu steaguri random
4. La final, scorul tău este salvat automat
5. Click **Leaderboard** → vezi clasamentul global

---

## ⚠️ Notă despre Python

Dacă `python` nu funcționează în terminal, încearcă:
- `python3 main.py`
- Sau reinstalează Python de la [python.org](https://www.python.org/downloads/) cu **"Add to PATH"** bifat
