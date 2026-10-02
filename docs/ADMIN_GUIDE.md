# Guide Utilisateur — Backoffice Administrateur Weekook

## Accès au backoffice

### Connexion
1. Aller sur `/connexion` (page de connexion standard)
2. Se connecter avec les identifiants du compte admin
3. Redirection automatique vers `/admin` (tableau de bord)

> Si le compte n'est pas encore admin, le promouvoir en base :
> ```bash
> ssh admin@91.99.128.31
> mysql -u weekook_dev_user -pDevPassword123! weekook_DEV \
>   -e "UPDATE users SET role='admin' WHERE email='TON_EMAIL';"
> ```

### Sécurité
- Toute tentative d'accès à `/admin/*` sans être connecté redirige vers `/connexion`
- Un utilisateur connecté mais non-admin est redirigé vers son tableau de bord (`/tableau-de-bord`)
- Tous les endpoints `/api/v1/admin/*` vérifient le rôle admin côté serveur (double protection)

---

## Navigation

La sidebar gauche (240 px) donne accès aux 7 sections :

| Icône | Section | URL |
|-------|---------|-----|
| Tableau de bord | Vue d'ensemble + stats | `/admin` |
| Utilisateurs | Gestion des comptes | `/admin/utilisateurs` |
| Kookers | Gestion des profils kooker | `/admin/kookers` |
| Réservations | Historique toutes réservations | `/admin/reservations` |
| Services | Catalogue des offres | `/admin/services` |
| Témoignages | Modération | `/admin/temoignages` |
| Configuration | Listes de valeurs | `/admin/configuration` |

---

## Tableau de bord

Affiche 4 indicateurs clés en temps réel :

- **Utilisateurs** — nombre total de comptes inscrits
- **Kookers** — nombre total de profils kooker créés
**Réservations** — nombre total de réservations toutes statuts confondus
- **Revenus (confirmés)** — somme des réservations au statut `confirmed` ou `completed`, en €

Chaque carte est cliquable et renvoie vers la section correspondante.
Les liens rapides en dessous permettent d'accéder directement à une action courante.

---

## Utilisateurs

### Recherche et filtrage
- **Recherche** (champ texte) : filtre sur le prénom, nom ou email — appuyer sur *Chercher* ou Entrée
- **Filtre rôle** (liste déroulante) : `Tous` / `Utilisateur` / `Kooker` / `Admin` / `Suspendu`
- **Pagination** : 20 résultats par page, navigation ← →

### Colonnes du tableau
| Colonne | Contenu |
|---------|---------|
| ID | Identifiant interne (5 chiffres) |
| Nom | Prénom + nom |
| Email | Adresse email |
| Rôle | Badge coloré (Utilisateur / Kooker / Admin / Suspendu) |
| Inscrit le | Date d'inscription |
| Actions | Sélecteur de rôle + bouton supprimer |

### Changer le rôle d'un utilisateur
1. Dans la colonne *Actions*, cliquer sur le sélecteur de rôle
2. Choisir le nouveau rôle (`Utilisateur`, `Kooker`, `Admin`, `Suspendu`)
3. Le changement est appliqué immédiatement (pas de confirmation)

| Rôle | Effet |
|------|-------|
| `Utilisateur` | Compte standard, accès au tableau de bord utilisateur |
| `Kooker` | Peut accéder au dashboard kooker (si profil kooker existant) |
| `Admin` | Accès complet au backoffice |
| `Suspendu` | Ne peut plus se connecter |

> **Attention** : Il est impossible de se rétrograder soi-même depuis l'interface (on pourrait perdre l'accès). Faire le changement directement en base si besoin.

### Supprimer un utilisateur
1. Cliquer sur l'icône corbeille dans la colonne *Actions*
2. Confirmer dans la boîte de dialogue
3. **Irréversible** — toutes les données associées (réservations, messages...) seront supprimées

---

## Kookers

### Colonnes du tableau
| Colonne | Contenu |
|---------|---------|
| ID | Identifiant profil kooker |
| Kooker | Nom + email |
| Ville | Ville renseignée sur le profil |
| Note | Note moyenne (nombre d'avis) |
| Services | Nombre d'offres créées |
| Réservations | Nombre de réservations reçues |
| ⭐ Coup de cœur | Toggle jaune = apparaît sur la page d'accueil |
| ✓ Vérifié | Toggle vert = badge de confiance sur le profil |
| Actif | Toggle violet/rouge = visible ou masqué dans la recherche |

### Toggles
Cliquer sur une icône change son état immédiatement :

- **⭐ Coup de cœur** (`featured`) : active l'affichage du kooker dans la section *Kookers vedettes* de la page d'accueil
- **✓ Vérifié** (`verified`) : affiche un badge de vérification sur le profil public du kooker
- **Actif/Inactif** (`active`) : masque ou rend visible le kooker dans les résultats de recherche

---

## Réservations

### Filtrage
- **Filtre statut** : `Tous` / `En attente` / `Confirmé` / `Terminé` / `Annulé`
- Pagination : 20 par page

### Colonnes
| Colonne | Contenu |
|---------|---------|
| ID | Identifiant réservation |
| Date | Date + heure de début |
| Client | Nom + email |
| Kooker | Nom du kooker |
| Service | Titre de l'offre |
| Convives | Nombre de personnes |
| Montant | Prix total TTC |
| Statut | Badge coloré |

> Cette vue est en **lecture seule**. Les changements de statut restent à la charge des kookers depuis leur dashboard.

---

## Services

Vue en lecture seule de toutes les offres créées sur la plateforme.

### Colonnes
| Colonne | Contenu |
|---------|---------|
| ID | Identifiant service |
| Titre | Nom de l'offre |
| Kooker | Propriétaire |
| Type | KOOK / KOURS |
| Prix | Tarif de base |
| Durée | En minutes |
| Réservations | Nombre de réservations liées |
| Statut | Actif / Inactif |

---

## Témoignages

Liste tous les témoignages, qu'ils soient en avant ou non.

### Actions disponibles

**Mettre en avant / Retirer**
- Cliquer sur le bouton `☆ Mettre en avant` → le témoignage apparaît sur la page d'accueil
- Cliquer à nouveau sur `★ En avant` → retire de la page d'accueil
- Les témoignages *en avant* ont un encadré violet

**Supprimer**
- Cliquer sur l'icône corbeille → confirmation → suppression définitive

> La page d'accueil affiche uniquement les témoignages avec `featured = true`.

---

## Configuration

Permet de modifier les listes de valeurs utilisées dans l'application **sans redéploiement**.

### Listes disponibles

| Liste | Utilisation |
|-------|-------------|
| **Spécialités culinaires** | Options dans le formulaire de création d'offre et les filtres de recherche |
| **Villes disponibles** | Filtre de recherche par ville |
| **Allergènes** | Sélection dans la création d'offre |
| **Types de service** | `KOOK` (cuisiner chez le client) / `KOURS` (cours de cuisine) |

### Ajouter une valeur
1. Cliquer dans le champ texte en bas de la liste
2. Saisir la nouvelle valeur
3. Appuyer sur **Entrée** ou cliquer sur le bouton **+**
4. La valeur apparaît en tag — cliquer sur **Sauvegarder** (bouton violet, visible dès qu'une modification est en attente)

### Supprimer une valeur
1. Cliquer sur le **×** à côté du tag à supprimer
2. Cliquer sur **Sauvegarder**

> Les modifications ne sont envoyées en base qu'après avoir cliqué sur **Sauvegarder**. Tant que le bouton est visible, les changements sont locaux et peuvent être annulés en rechargeant la page.

---

## Déconnexion

Cliquer sur **Déconnexion** en bas de la sidebar. Redirige vers `/connexion`.
