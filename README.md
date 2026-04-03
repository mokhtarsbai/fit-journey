# 🏋️ Fit Journey

> Votre coach sportif à domicile au Maroc - Application mobile tout-en-un pour le coaching fitness et l'événementiel sportif.

![Version](https://img.shields.io/badge/version-3.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Web-lightgrey)

## 📱 Aperçu

Fit Journey est une plateforme mobile complète connectant les sportifs marocains avec des coachs certifiés pour des séances de coaching à domicile. L'application propose également un hub événementiel pour les marathons, courses et autres événements sportifs.

## ✨ Fonctionnalités

### 🔐 Authentification "Zero Friction" (V3)
- **Connexion Google OAuth 2.0** - Intégration Emergent Auth
- **Apple Sign-In** - Support natif iOS
- **Email/Mot de passe** - Avec hachage bcrypt
- **JWT Tokens** - Access & Refresh tokens sécurisés
- **Conformité CNDP** - Respect de la réglementation marocaine sur la protection des données

### 👨‍🏫 Coaching
- Profils de coachs détaillés avec certifications
- Système de notation et avis
- Filtres par ville, discipline et tarif
- Réservation de séances en quelques clics
- Packs de séances avec réductions (15%)

### 📅 Réservations
- Gestion des séances (à venir, passées, annulées)
- Politique d'annulation 24h
- **Factures PDF** générées automatiquement
- Historique complet des réservations

### 💬 Messagerie Temps Réel
- **WebSocket** pour la communication instantanée
- Indicateur de frappe ("écrit...")
- Fallback polling automatique
- Historique des conversations

### 🏆 Communauté & Gamification
- Défis communautaires avec points
- Classements (leaderboards) par ville
- Badges et récompenses
- FitStories (publications éphémères 24h)
- Buddy Finder pour les événements

### 📊 Suivi de Progression
- Tableau de bord fitness
- Intégration Apple Health / Google Fit (logique prête)
- Graphiques de progression
- Journal d'entraînement personnel

### 🎫 Hub Événementiel
- Marathons, courses, bootcamps
- Inscription en ligne
- Recherche de partenaires d'entraînement
- Filtres par ville et discipline

### 💳 Paiements
- Simulation CMI (Centre Monétique Interbancaire)
- Portefeuille virtuel avec crédits
- Devise MAD (Dirham Marocain)

## 🛠️ Stack Technique

### Frontend
```
- Expo SDK 52 (React Native)
- Expo Router (Navigation file-based)
- TypeScript
- React Context API (State management)
- expo-linear-gradient, @expo/vector-icons
```

### Backend
```
- Python 3.11+
- FastAPI
- Motor (MongoDB async driver)
- PyJWT + bcrypt (Authentification)
- ReportLab (Génération PDF)
- WebSockets
```

### Base de données
```
- MongoDB
```

### Sécurité
```
- OAuth 2.0
- JWT (Access + Refresh tokens)
- bcrypt (hachage mots de passe)
- TLS 1.3
- CNDP compliant
```

## 📁 Structure du Projet

```
/app
├── backend/
│   ├── server.py          # API FastAPI principale
│   ├── requirements.txt   # Dépendances Python
│   └── .env.example       # Variables d'environnement
│
├── frontend/
│   ├── app/
│   │   ├── index.tsx      # Écran de connexion
│   │   ├── (tabs)/        # Navigation par onglets
│   │   │   ├── index.tsx      # Accueil (Stories, Coachs, Events)
│   │   │   ├── search.tsx     # Recherche de coachs
│   │   │   ├── challenges.tsx # Défis communautaires
│   │   │   ├── bookings.tsx   # Mes réservations
│   │   │   ├── progress.tsx   # Suivi progression
│   │   │   └── messages.tsx   # Messagerie
│   │   ├── coach/[id].tsx     # Détail coach
│   │   ├── event/[id].tsx     # Détail événement
│   │   └── booking/[coachId].tsx # Modal réservation
│   ├── src/
│   │   └── context/
│   │       └── AuthContext.tsx # Contexte d'authentification
│   ├── app.json           # Configuration Expo
│   ├── package.json       # Dépendances Node
│   └── .env.example       # Variables d'environnement
│
└── README.md
```

## 🚀 Installation

### Prérequis
- Node.js 18+
- Python 3.11+
- MongoDB
- Expo CLI (`npm install -g expo-cli`)

### Backend

```bash
cd backend

# Créer environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou: venv\Scripts\activate  # Windows

# Installer dépendances
pip install -r requirements.txt

# Configurer variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Lancer le serveur
uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend

# Installer dépendances
yarn install
# ou: npm install

# Configurer variables d'environnement
cp .env.example .env

# Lancer Expo
yarn start
# ou: npx expo start
```

## ⚙️ Variables d'Environnement

### Backend (.env)
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=fitjourney
JWT_SECRET=your-secret-key-here
```

### Frontend (.env)
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

## 📡 API Endpoints

### Authentification
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/google` | Connexion Google OAuth |
| POST | `/api/auth/apple` | Connexion Apple |
| POST | `/api/auth/email/register` | Inscription email |
| POST | `/api/auth/email/login` | Connexion email |
| POST | `/api/auth/refresh` | Rafraîchir token |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/me` | Profil utilisateur |
| GET | `/api/auth/privacy-policy` | Politique CNDP |

### Coachs & Réservations
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/coaches` | Liste des coachs |
| GET | `/api/coaches/:id` | Détail coach |
| POST | `/api/sessions` | Créer réservation |
| GET | `/api/sessions` | Mes réservations |
| POST | `/api/packs` | Acheter un pack |
| GET | `/api/packs` | Mes packs |

### Factures
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/invoices/:packId/pdf` | Télécharger facture PDF |

### Événements
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/events` | Liste événements |
| GET | `/api/events/:id` | Détail événement |
| POST | `/api/events/:id/register` | S'inscrire |
| GET | `/api/events/:id/buddies` | Trouver partenaires |

### Messagerie
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/messages/conversations` | Mes conversations |
| GET | `/api/messages/:partnerId` | Messages avec partenaire |
| POST | `/api/messages` | Envoyer message |
| WS | `/ws/chat/:token` | WebSocket temps réel |

### Communauté
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/challenges` | Défis actifs |
| POST | `/api/challenges/:id/join` | Rejoindre défi |
| GET | `/api/leaderboard` | Classement |
| GET | `/api/stories` | FitStories |
| POST | `/api/stories` | Publier story |

### Progression
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/progress` | Ma progression |
| POST | `/api/progress` | Ajouter données |
| GET | `/api/badges` | Tous les badges |

## 🧪 Tests

```bash
# Backend
cd backend
pytest

# Frontend
cd frontend
yarn test
```

## 📱 Captures d'Écran

| Connexion | Accueil | Coach |
|-----------|---------|-------|
| Authentification Zero Friction | Stories & Coachs | Profil détaillé |

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez suivre ces étapes :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📄 Licence

Distribué sous la licence MIT. Voir `LICENSE` pour plus d'informations.

## 👥 Équipe

Développé avec ❤️ pour le marché marocain du fitness.

## 📞 Contact

- Email: contact@fitjourney.ma
- Site web: https://fitjourney.ma

---

<p align="center">
  <strong>Fit Journey</strong> - Transformez votre vie, une séance à la fois 🏋️‍♀️
</p>
