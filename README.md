# Sage Playground — Backend

> **Document de référence** — synthèse du cahier des charges et de l'état du projet (auth, droits, requêtes, exécution Sage). À lire avant de reprendre le développement.

---

## 1. Vision produit

**Sage Playground** est une application interne qui permet de :

1. **Cataloguer** des requêtes SQL en lecture seule contre **Sage X3** (SQL Server)
2. **Organiser** ces requêtes par **secteur** et par **visibilité**
3. **Partager** certaines requêtes à des groupes d'utilisateurs
4. **Exécuter** une requête et **afficher les résultats** tabulaires dans le frontend

L'identité vient de l'**Active Directory (LDAP)**. L'application gère les rôles, groupes, requêtes et favoris dans **PostgreSQL**.

```
Utilisateur → Login AD → JWT
           → Catalogue requêtes (PostgreSQL)
           → Exécution → Sage X3 (SQL Server) → Résultats tabulaires
```

---

## 2. Stack technique


| Couche                          | Technologie                                                  |
| ------------------------------- | ------------------------------------------------------------ |
| **Backend**                     | NestJS, Prisma, PostgreSQL, JWT, Passport                    |
| **Auth**                        | LDAP (Active Directory) + auto-provisioning PostgreSQL       |
| **Exécution ERP**               | `mssql` → pool SQL Server Sage X3                            |
| **Frontend** (repo `Frontend/`) | React, TanStack Router, TanStack Query, TanStack Table, Vite |


Variables d'environnement clés : `JWT_SECRET`, config LDAP, `DATABASE_URL`, `SAGE_DB_`* (serveur, base, user, password).

---

## 3. Modèle de données (Prisma)

### Entités principales


| Modèle         | Rôle                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| **User**       | Compte applicatif lié à l'AD (`ldapGuid`, `username`, `role`, `isActive`)                              |
| **Group**      | Groupe de partage (nom, description)                                                                   |
| **UserGroup**  | Appartenance user ↔ groupe                                                                             |
| **Query**      | Requête SQL sauvegardée (`name`, `description`, `sqlContent`, `visibility`, `sectorId`, `createdById`) |
| **QueryGroup** | Requête assignée à un groupe (partage ciblé)                                                           |
| **Sector**     | Référentiel de classement (ex. « Achats », « Stock »)                                                  |
| **Favorite**   | Requête mise en favori par un user                                                                     |


### Visibilité d'une requête


| Valeur    | Signification                                                                         |
| --------- | ------------------------------------------------------------------------------------- |
| `PRIVATE` | Visible uniquement par les **admins** (catalogue admin, brouillon)                    |
| `SHARED`  | Visible par les users membres d'**au moins un groupe** auquel la requête est assignée |
| `PUBLIC`  | Visible par **tous** les utilisateurs connectés                                       |


### Partage « personnes précises »

Il n'existe **pas** de lien direct user ↔ requête. Le partage ciblé passe par les **groupes** :

```
Admin crée un Groupe
     → y ajoute des Utilisateurs   (POST /groups/:id/users)
     → y assigne des Requêtes       (POST /groups/:id/queries)
     → met visibility = SHARED
```

---

## 4. Rôles et droits

### 4.1 ADMIN

L'admin est le **seul** à implémenter et maintenir le catalogue de requêtes (pour l'instant et à terme).


| Action                                                                     | Autorisé                        |
| -------------------------------------------------------------------------- | ------------------------------- |
| Voir **toutes** les requêtes (+ `sqlContent`)                              | Oui                             |
| Créer / modifier / supprimer une requête (`sqlContent`, nom, description…) | Oui                             |
| Changer le **secteur** d'une requête                                       | Oui (`PATCH` avec `sectorId`)   |
| Changer la **visibilité**                                                  | Oui (`PATCH` avec `visibility`) |
| Assigner requêtes ↔ groupes, users ↔ groupes                               | Oui (API groupes, admin only)   |
| CRUD **secteurs** (créer, renommer, supprimer)                             | Oui                             |
| Gestion **utilisateurs** (rôle, `isActive`)                                | Oui                             |
| Exécuter n'importe quelle requête                                          | Oui                             |


### 4.2 USER (lambda)


| Action                                                      | Autorisé                         |
| ----------------------------------------------------------- | -------------------------------- |
| Voir les requêtes **PUBLIC**                                | Oui                              |
| Voir les requêtes **SHARED** des groupes dont il est membre | Oui                              |
| Voir ses **favoris** (requêtes encore accessibles)          | Oui                              |
| Voir / exécuter une requête **PRIVATE**                     | Non                              |
| Créer / modifier / supprimer des requêtes                   | Non                              |
| Gérer secteurs, groupes, utilisateurs                       | Non                              |
| Voir tous les groupes de l'organisation                     | Non — **uniquement ses groupes** |


**Sources de contenu pour un user :**

1. `GET /queries` → PUBLIC + SHARED (via groupes)
2. `GET /favorites` → favoris filtrés (requête toujours accessible)

---

## 5. Contrôle d'accès (implémenté)

La logique est centralisée dans `**QueryAccessService`**  
(`src/modules/queries/query-access.service.ts`).

### Règle unique

```
Accès autorisé si :
  ADMIN
  OU visibility = PUBLIC
  OU (visibility = SHARED ET intersection groupes user / groupes requête non vide)

Sinon → 403 Forbidden
```

### Où elle s'applique


| Endpoint / service                  | Usage                                          |
| ----------------------------------- | ---------------------------------------------- |
| `QueriesService.findAll`            | Filtre Prisma pour la liste                    |
| `QueriesService.findOne`            | Détail + base pour l'exécution                 |
| `ExecutionController`               | Via `findOne` avant exécution                  |
| `FavoritesService.add`              | Interdit de favoriser une requête inaccessible |
| `FavoritesService.findAllForUser`   | Ne renvoie que les favoris encore accessibles  |
| `GroupsService.findAll` / `findOne` | User : groupes dont il est membre uniquement   |


### Écriture réservée à l'admin

- `POST / PATCH / DELETE /queries` → `@Roles('ADMIN')`
- `POST / PATCH / DELETE /sectors` → admin
- Mutations sur `/groups` → admin

---

## 6. Authentification

### Flux login

1. `POST /auth/login` — identifiants AD
2. Authentification **LDAP**
3. **Find-or-create** user PostgreSQL (clé `ldapGuid`), sync nom/email à chaque connexion
4. Refus si `isActive === false`
5. Émission **JWT** (`sub`, `username`, `role`)
6. Routes protégées : `Authorization: Bearer <token>` (guard global JWT)

### Rôles

- `ADMIN` — défini en base (défaut à la première connexion : `USER`)
- `USER` — utilisateur standard

---

## 7. Exécution Sage X3

### Endpoint

`GET /execution/:queryId`

1. Charge la requête (`findOne` + contrôle d'accès)
2. Exécute `sqlContent` via le pool **mssql**
3. Retourne `{ columns: string[], rows: Record<string, unknown>[], total: number }`

### Garde-fous SQL

- Uniquement requêtes commençant par **SELECT**
- Blocage de mots-clés dangereux : `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, `EXEC`, etc.

### Santé connexion

`GET /execution/health` — état du pool Sage (sans auth métier spécifique au-delà du JWT global).

### Limitation actuelle

Le backend renvoie **tout le recordset** en une fois. Pour de gros volumes, prévoir pagination côté serveur (`OFFSET/FETCH`) plus tard.

---

## 8. API REST — récapitulatif


| Préfixe      | Lecture                           | Écriture               |
| ------------ | --------------------------------- | ---------------------- |
| `/auth`      | `GET /me`                         | `POST /login` (public) |
| `/queries`   | Tous (filtré par rôle)            | Admin                  |
| `/execution` | User avec accès à la requête      | —                      |
| `/sectors`   | Tous connectés                    | Admin                  |
| `/groups`    | Admin : tous ; User : ses groupes | Admin                  |
| `/users`     | Admin                             | Admin                  |
| `/favorites` | User (ses favoris)                | User (add/remove)      |


---

## 9. Frontend — état au dernier point de discussion

### Fonctionnel

- Login / logout (JWT en `localStorage`)
- Liste des requêtes (`GET /queries`)
- Détail requête + affichage `sqlContent`
- Bouton **Exécuter** + `**QueryResultTable`** (TanStack Table : tri, filtre, pagination client)

### À implémenter (placeholders)

- Favoris (page `/favorites`)
- Création / édition requête (admin)
- Paramètres : profil, users, groups, sectors (admin)
- Masquer actions admin côté UI pour les `USER`

### TanStack Table

Réservé à l'affichage des **résultats d'exécution ERP** (données tabulaires dynamiques), **pas** pour afficher le SQL (`sqlContent` reste en `<pre>`).

Composants clés :

- `Frontend/src/components/QueryResultTable.tsx`
- `Frontend/src/lib/api-execution.ts`

---

## 10. Décisions d'architecture retenues

1. **LDAP authentifie, PostgreSQL identifie** — pas de mot de passe stocké en base
2. **Une règle d'accès** (`QueryAccessService`) — pas de logique dupliquée par endpoint
3. **Partage par groupes**, pas par assignation user directe sur la requête
4. **Seul l'admin** maintient le catalogue SQL
5. **Exécution en lecture seule** — SELECT strict sur Sage
6. **Clean Architecture côté frontend** — types, API, logique pure (colonnes/format), composants UI séparés

---

## 11. Pistes évolutives

- Page favoris frontend branchée sur `GET /favorites`
- Écrans admin : CRUD requêtes, secteurs, groupes, users
- Export CSV des résultats (depuis `QueryResultTable`)
- Pagination serveur sur gros jeux de données Sage
- `PATCH /queries/:id` enrichi pour gérer groupes + visibilité en une opération (optionnel)
- Tests e2e sur les scénarios de droits (USER vs ADMIN, SHARED hors groupe, favoris)

---

## 12. Démarrage rapide

```bash
# Backend
cd Backend
cp .env.example .env   # si présent — configurer LDAP, JWT, PostgreSQL, Sage
npm install
npx prisma migrate dev
npm run start:dev      # par défaut port 5000

# Frontend (autre terminal)
cd Frontend
npm install
npm run dev            # port 3000 — VITE_API_URL → backend
```

---

## 13. Glossaire


| Terme                     | Définition                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **sqlContent**            | Texte SQL stocké en PostgreSQL (catalogue), pas les données ERP                             |
| **Résultats / exécution** | Lignes renvoyées par Sage après exécution du `sqlContent`                                   |
| **SHARED**                | Partage via groupes ; nécessite `QueryGroup` + `UserGroup`                                  |
| **Schéma des droits**     | Ensemble des règles qui, admin/user/visibilité/groupe, définissent qui voit et exécute quoi |


