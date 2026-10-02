# Documentation Weekook V2

Documentation technique du projet Weekook — plateforme de cuisine à domicile.

## Index

| Document | Description |
|----------|-------------|
| [SPECS_FONCTIONNELLES.md](./SPECS_FONCTIONNELLES.md) | Spécifications fonctionnelles — parcours utilisateur, règles métier, 60+ scénarios de test |
| [SPECS.md](./SPECS.md) | Spécifications techniques — schéma DB, endpoints API, validations Zod, logique serveur |

## Architecture résumée

- **Client** : React 18 + TypeScript + Vite 6 + Tailwind CSS 4
- **Server** : Express.js + Prisma ORM + MySQL
- **Auth** : JWT httpOnly cookies, bcrypt 12 rounds
- **Email** : Resend

## Démarrage rapide

```bash
# Backend
cd server && npm run dev     # → http://localhost:3001

# Frontend
cd client && npx vite        # → http://localhost:5173
```
