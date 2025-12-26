# 🚀 Configuration du Backend OGOUE

## ✅ Prérequis

1. **Node.js** (v18+)
2. **PostgreSQL** (v12+)
3. **npm** (inclus avec Node.js)

---

## 🔧 Configuration PostgreSQL

### Sur Windows

#### 1️⃣ Vérifier si PostgreSQL est installé
```cmd
psql --version
```

#### 2️⃣ Si installé, démarrer le service
**Option A : Via Services Windows**
- Appuie sur `Win + R`
- Tape `services.msc`
- Cherche "PostgreSQL Server"
- Clique droit → Démarrer

**Option B : Via PowerShell (Admin)**
```powershell
Start-Service -Name postgresql-x64-*
```

#### 3️⃣ Si NOT installé, télécharge
- Visite https://www.postgresql.org/download/windows/
- Télécharge l'installeur
- Lance l'installation (mémorise le mot de passe postgres !)
- Redémarre ton ordinateur

---

### Tester la Connexion PostgreSQL

```cmd
psql -U postgres -h localhost
```
Si tu vois `postgres=#`, PostgreSQL fonctionne ! ✅

Sinon, vérifie :
- ❌ Le service PostgreSQL n'est pas démarré
- ❌ La base `ogoue_dev` n'existe pas
- ❌ L'utilisateur `ogoue_dev` n'existe pas

---

## 📝 Setup Base de Données

### 1️⃣ Créer la base et l'utilisateur

```sql
-- Connecté en tant que postgres
CREATE USER ogoue_dev WITH PASSWORD 'ogoue01';
CREATE DATABASE ogoue_dev OWNER ogoue_dev;
```

### 2️⃣ Créer le schéma et les tables

```sql
-- Connecté en tant que ogoue_dev
psql -U ogoue_dev -d ogoue_dev -h localhost
```

Puis exécute :

```sql
CREATE SCHEMA app;

CREATE TABLE app.organizations (
  id UUID PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE app.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES app.organizations(id),
  sale_date DATE NOT NULL,
  description VARCHAR(200),
  sale_type VARCHAR(50),
  payment_method VARCHAR(50),
  quantity DECIMAL(10,2) DEFAULT 1,
  amount DECIMAL(15,2) NOT NULL,
  receipt_name VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE app.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES app.organizations(id),
  expense_date DATE NOT NULL,
  category VARCHAR(100),
  payment_method VARCHAR(50),
  amount DECIMAL(15,2) NOT NULL,
  receipt_name VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Grants
GRANT USAGE ON SCHEMA app TO ogoue_dev;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO ogoue_dev;

-- Insérer l'org de test
INSERT INTO app.organizations (id, name) VALUES 
  ('015eb7eb-35bc-4863-9992-4c601f5c9f6f', 'Test Org');
```

---

## 🎯 Démarrer le Backend

### 1️⃣ Installation des dépendances
```bash
cd backend
npm install
```

### 2️⃣ Lancer en mode développement
```bash
npm run dev
```

Tu devrais voir :
```
API: http://localhost:3001
```

### 3️⃣ Ou lancer en production
```bash
npm start
```

---

## 🧪 Tester l'API

### Via cURL
```bash
# Vérifier la santé
curl http://localhost:3001/health

# Ajouter une vente
curl -X POST http://localhost:3001/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "015eb7eb-35bc-4863-9992-4c601f5c9f6f",
    "saleDate": "2025-12-20",
    "description": "Test",
    "amount": 100000
  }'
```

### Via Postman
1. Importe les endpoints dans Postman
2. Utilise `http://localhost:3001` comme base URL
3. Teste GET `/health`, POST `/api/sales`, etc.

---

## ❌ Troubleshooting

### "CONNECTION REFUSED"
→ PostgreSQL n'est pas démarré. Relis la section "Démarrer le service" ci-dessus.

### "ROLE ogoue_dev does not exist"
→ Tu n'as pas créé l'utilisateur. Exécute les commandes SQL ci-dessus.

### "DATABASE ogoue_dev does not exist"
→ Tu n'as pas créé la base. Exécute les commandes SQL ci-dessus.

### "npm: command not found"
→ Node.js n'est pas installé. Télécharge-le sur https://nodejs.org/

---

## ✅ Vérification Finale

Avant de continuer, assure-toi que :
- ✅ PostgreSQL démarre sans erreur
- ✅ `npm run dev` affiche "API: http://localhost:3001"
- ✅ `curl http://localhost:3001/health` retourne `{"ok":true}`

Si tout est OK, tu peux tester le frontend ! 🚀
