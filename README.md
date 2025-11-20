# Tipmix Web App

Modern Tipmix jellegű fogadási felület React frontenddel és Node/Express backendllel. A backend MySQL adatbázist használ (XAMPP/MySQL kompatibilis), melyben felhasználók, fogadások és felhasználói tétek tárolódnak.

## Gyors indítás

```bash
# 1) Klónozás vagy könyvtárba lépés
cd /Users/vendel/Desktop/Saját/tipmix_web

# 2) Backend környezet
cd backend
cp env.example .env
# .env állományban add meg az adatbázis, JWT és admin adatokat
npm install
npm run db:setup   # táblák + admin user létrehozása
npm run dev        # backend indul az .env PORT értéken (alap 5050)

# 3) Frontend
cd ../frontend
npm install
npm run dev        # Vite fejlesztői szerver (5173), proxy az /api hívásokra
```

MySQL-ben hozd létre előtte a `tipmix_app` adatbázist (vagy amit a `.env`-ben megadsz):

```sql
CREATE DATABASE tipmix_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Backend API áttekintés

- `POST /api/auth/register` – regisztráció (alap egyenleg 10 000 HUF)
- `POST /api/auth/login` – bejelentkezés, JWT
- `GET /api/auth/profile` – bejelentkezett felhasználó adatai
- `GET /api/bets` – nyitott fogadások
- `POST /api/bets/:id/place` – tét leadása (JWT szükséges, outcome_id paraméter)
- `GET /api/bets/me/history` – saját fogadások
- Admin végpontok (admin JWT szükséges):
  - `GET /api/bets/admin` – összes fogadás + kimenetek
  - `POST /api/bets` – új fogadás létrehozása (2-3 tetszőleges nevű kimenet)
  - `POST /api/bets/:id/close` – fogadás lezárása kiválasztott outcome_id alapján

## Frontend funkciók

- Modern, kártya alapú UI (React + Vite)
- Teljes képernyős navbar Home / Fogadások / Aktív / Napló tabokkal
- Profil menü gyors eléréssel (napló, aktív fogadások, kijelentkezés)
- Dashboard kártyák, dinamikusan változó odds az aktuális fogadás kártyákon
- Admin panel modalban: 2 vagy 3 kimenet felvétele, saját név + kezdő odds
- REST hívások Axios-szal, JWT token tárolás `localStorage`-ben, Vite proxy az `/api`-ra

## Hasznos parancsok

```bash
# Backend
npm run dev      # nodemon
npm run start    # production mód
npm run db:setup # táblák + admin létrehozás

# Frontend
npm run dev      # fejlesztői mód
npm run build    # production build
npm run preview  # build előnézete
```

## További tippek

- Az admin felhasználót az `.env` alapján automatikusan létrehozza a `npm run db:setup`.
- XAMPP-ban ellenőrizd, hogy a MySQL portja megegyezik a `.env` fájlban lévő `DB_PORT` értékkel.
- Ha SSL vagy más hoston fut a backend, frissítsd a `frontend/vite.config.js` proxy beállítását vagy állítsd át az `api` alap URL-t.

