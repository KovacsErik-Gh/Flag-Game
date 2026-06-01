# Guess the Flag - Aplicație Web pentru Recunoașterea Steagurilor

## Descriere Generală
Proiectul reprezintă o aplicație web interactivă de tip quiz, dedicată testării cunoștințelor geografice prin identificarea steagurilor celor 195 de țări ale lumii. Aplicația dispune de un sistem complet de autentificare a utilizatorilor, salvarea scorurilor într-o bază de date relațională și afișarea unui clasament global în timp real.

Arhitectura proiectului este de tip decuplat (decoupled architecture), fiind structurată în două componente principale:
* **Backend:** Dezvoltat în Python folosind framework-ul de înaltă performanță FastAPI, responsabil pentru logica de business, persistența datelor și securitate.
* **Frontend:** Dezvoltat în Node.js cu motorul de șabloane EJS (Embedded JavaScript) și Express.js, asigurând o interfață utilizator dinamică și receptivă.

---

## Structura Proiectului și Rolul Componentelor

```text
TD/
├── backend/
│   ├── main.py          ← Punctul de intrare al aplicației FastAPI, definirea rutelor API
│   ├── models.py        ← Definirea modelelor bazelor de date (Utilizatori, Scoruri) via ORM
│   ├── auth.py          ← Logica de securitate: criptare parole (bcrypt) și generare token-uri JWT
│   ├── database.py      ← Configurarea conexiunii cu baza de date relațională SQLite
│   ├── flags_data.py    ← Sursa de date internă conținând setul complet de 195 de țări
│   └── requirements.txt ← Dependențele specifice ecosistemului Python
│
└── frontend/
    ├── server.js        ← Serverul web Express.js responsabil pentru randarea paginilor
    ├── views/           ← Șabloanele EJS (HTML dinamic) pentru interfața grafică
    └── public/          ← Resursele statice ale aplicației (stiluri CSS și scripturi JS client-side)
```

---

## Detalii Tehnice și Implementare

### 1. Autentificare și Securitate (Backend)
Sistemul de gestiune a utilizatorilor folosește bunele practici din industrie pentru securizarea datelor:
* **Criptarea parolelor:** Parolele nu sunt salvate în clar în baza de date, ci sunt procesate folosind algoritmul de hashing **bcrypt**, prevenind atacurile de tip Rainbow Table.
* **Sesiuni securizate:** Autorizarea acțiunilor (cum ar fi salvarea scorului) se realizează pe baza standardului **JWT (JSON Web Tokens)**, asigurând un mecanism stateless și sigur de comunicare între frontend și backend.

### 2. Persistența Datelor
Pentru stocarea informațiilor se utilizează **SQLite**, o bază de date relațională integrată, ideală pentru acest tip de arhitectură, eliminând necesitatea unui server separat de baze de date. Interacțiunea cu baza de date este abstractizată printr-un ORM, mapând tabelele `User` (pentru utilizatori) și `Score` (pentru istoricul jocurilor).

### 3. Logica Jocului (Fluxul de Utilizare)
* **Generare dinamică:** La inițierea unei sesiuni de joc ("Play Now"), utilizatorul parcurge un set de 10 runde cu steaguri selectate în mod aleatoriu.
* **Sincronizare:** La finalizarea jocului, rezultatul obținut este transmis automat prin intermediul unei cereri HTTP POST securizate către backend.
* **Clasament global:** Secțiunea "Leaderboard" interoghează baza de date pentru a returna o listă ordonată descrescător a celor mai mari scoruri înregistrate pe platformă.

---

## Instrucțiuni de Instalare și Rulare

Pentru rularea proiectului în mediul local sunt necesare **Python 3.10+** și **Node.js**.

### Pasul 1: Pornirea Serverului Backend (FastAPI)
Deschideți un terminal în directorul `backend/` și executați următoarele comenzi:

```bash
cd backend
python -m pip install -r requirements.txt
python main.py
```
Serverul backend va rula implicit la adresa: **http://localhost:8000**

### Pasul 2: Pornirea Serverului Frontend (Express/EJS)
Deschideți un terminal separat în directorul `frontend/` și executați următoarele comenzi:

```bash
cd frontend
npm install
npm start
```
Aplicația client va fi accesibilă în browser la adresa: **http://localhost:3000**

---

## Diagnosticare (Troubleshooting)

În cazul în care comanda `python` nu este recunoscută în terminalul sistemului de operare Windows/Linux:
* Asigurați-vă că opțiunea **"Add python.exe to PATH"** a fost bifată în momentul instalării interpretorului.
* Încercați utilizarea explicită a comenzii `python3 main.py` sau `py main.py`.
