# Guide d'utilisation — Paiements Stripe Connect (Weekook)

---

## Table des matières

1. [Configuration initiale](#1-configuration-initiale)
2. [Onboarding Kooker (Stripe Connect)](#2-onboarding-kooker-stripe-connect)
3. [Flux de réservation et paiement](#3-flux-de-réservation-et-paiement)
4. [Confirmation de prestation et libération des fonds](#4-confirmation-de-prestation-et-libération-des-fonds)
5. [Avis bidirectionnels](#5-avis-bidirectionnels)
6. [Administration — Commission plateforme](#6-administration--commission-plateforme)
7. [Statuts de paiement](#7-statuts-de-paiement)
8. [Mode dégradé (sans Stripe)](#8-mode-dégradé-sans-stripe)
9. [Tests en mode développement](#9-tests-en-mode-développement)
10. [Webhook Stripe](#10-webhook-stripe)
11. [FAQ / Dépannage](#11-faq--dépannage)

---

## 1. Configuration initiale

### 1.1 Prérequis

- Un compte Stripe (https://dashboard.stripe.com/register)
- Le mode **Test** activé (toggle en haut à droite du dashboard Stripe)
- **Stripe Connect** activé dans Settings > Connect settings
- Business model : **Marketplace**

### 1.2 Clés API

Récupérer les clés dans **Developers > API Keys** du dashboard Stripe :

| Clé | Format | Usage |
|-----|--------|-------|
| Publishable key | `pk_test_...` | Frontend (chargée dynamiquement) |
| Secret key | `sk_test_...` | Backend uniquement |
| Webhook secret | `whsec_...` | Vérification des webhooks |

### 1.3 Variables d'environnement

Ajouter dans le fichier `.env` du serveur :

```bash
STRIPE_SECRET_KEY=sk_test_VOTRE_CLE_SECRETE
STRIPE_PUBLISHABLE_KEY=pk_test_VOTRE_CLE_PUBLIQUE
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_SECRET_WEBHOOK
```

> **Important** : Ne jamais committer le `.env` dans Git. Ces clés doivent rester confidentielles.
>
> **Sans ces clés**, l'application fonctionne en **mode dégradé** : les réservations sont créées sans paiement (voir section 6).

### 1.4 Migration base de données

Après avoir mis à jour le schéma Prisma, appliquer les changements :

```bash
cd server
npx prisma db push
```

Cela crée :
- Les champs `stripeAccountId` et `stripeOnboardingComplete` sur `KookerProfile`
- Les champs `stripePaymentIntentId` et `paymentStatus` sur `Booking`
- La table `payments` (audit trail)

---

## 2. Onboarding Kooker (Stripe Connect)

### 2.1 Qu'est-ce que c'est ?

Avant de pouvoir recevoir des paiements, chaque kooker doit connecter son compte bancaire via Stripe Connect. C'est un processus géré entièrement par Stripe (formulaire sécurisé).

### 2.2 Comment ça se déclenche ?

**Automatiquement à l'inscription :**
Quand un utilisateur devient kooker via la page "Devenir Kooker", il est automatiquement redirigé vers le formulaire Stripe Connect après la création de son profil.

**Via la bannière du dashboard :**
Si le kooker n'a pas complété son onboarding (skip ou interruption), une bannière violette apparaît en haut du dashboard kooker :

```
╔══════════════════════════════════════════════════════════╗
║  Configurez vos paiements                                ║
║  Pour recevoir les paiements de vos clients,             ║
║  connectez votre compte bancaire via Stripe.             ║
║                                    [Configurer Stripe]   ║
╚══════════════════════════════════════════════════════════╝
```

### 2.3 Étapes pour le kooker

1. Cliquer sur **"Configurer Stripe"**
2. Remplir le formulaire Stripe (informations personnelles, coordonnées bancaires)
3. Stripe redirige vers le dashboard Weekook avec un message de confirmation
4. La bannière disparaît une fois l'onboarding terminé

### 2.4 Statuts Stripe Connect

| Statut | Signification |
|--------|---------------|
| Pas de compte | Le kooker n'a jamais cliqué sur "Configurer Stripe" |
| Onboarding en cours | Le kooker a commencé mais n'a pas terminé |
| Onboarding terminé | `charges_enabled` et `payouts_enabled` = true |

> **Note** : Tant que l'onboarding n'est pas terminé et que Stripe est activé, les utilisateurs ne peuvent pas réserver les services de ce kooker. Un message d'erreur explicite s'affiche.

---

## 3. Flux de réservation et paiement

### 3.1 Vue d'ensemble

Le processus de réservation se déroule en **deux phases distinctes** :

```
╔═══════════════════════════════════════════════════════════════════════╗
║                        PHASE 1 : RÉSERVATION                        ║
║                                                                     ║
║  Étape 1 → Service sélectionné (résumé)                            ║
║  Étape 2 → Choisir une date (calendrier interactif)                ║
║  Étape 3 → Choisir un créneau horaire                              ║
║  Étape 4 → Nombre de convives + notes                              ║
║  Étape 5 → Récapitulatif + bouton "Confirmer la réservation"       ║
║                                                                     ║
╠═══════════════════════════════════════════════════════════════════════╣
║                        PHASE 2 : PAIEMENT                           ║
║  (affichée uniquement après clic sur "Confirmer")                   ║
║                                                                     ║
║  → Récapitulatif de la réservation                                  ║
║  → Formulaire carte bancaire (Stripe Elements)                      ║
║  → Bouton "Payer et confirmer — XX,XX€"                            ║
║  → Bouton retour "Modifier la réservation"                          ║
║                                                                     ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 3.2 Phase 1 — Formulaire de réservation (5 étapes)

L'utilisateur parcourt les étapes dans l'ordre. Chaque étape suivante est grisée tant que la précédente n'est pas complétée :

1. **Service sélectionné** : titre, type, prix/personne, durée, description
2. **Choisir une date** : calendrier avec jours disponibles en vert, légende
3. **Choisir un créneau** : boutons horaires pour la date sélectionnée (créneaux complets barrés)
4. **Convives et notes** : compteur +/- avec min/max, champ notes optionnel
5. **Récapitulatif** : résumé complet + prix total + bouton **"Confirmer la réservation"**

### 3.3 Phase 2 — Paiement

Quand l'utilisateur clique sur **"Confirmer la réservation"** :

1. Le système tente de charger Stripe.js (chargement lazy, pas au montage de la page)
2. **Si Stripe est disponible** : la phase paiement s'affiche avec le formulaire carte
3. **Si Stripe n'est pas configuré** : la réservation est créée directement sans paiement (voir section 6)

**Écran de paiement :**
- Récapitulatif de la réservation (service, date, créneau, convives, total)
- Champ carte bancaire sécurisé (Stripe Elements)
- Message : *"Votre carte sera pré-autorisée. Le montant ne sera débité que lorsque le kooker acceptera votre réservation."*
- Bouton **"Payer et confirmer — XX,XX€"**
- Lien **"Modifier la réservation"** pour revenir au formulaire

**Ce qui se passe techniquement au clic sur "Payer et confirmer" :**
1. Création de la réservation en base (statut `pending`, paiement `pending_authorization`)
2. Création d'un `PaymentIntent` Stripe en mode **capture manuelle**
3. Confirmation côté client via `stripe.confirmCardPayment()`
4. La carte est vérifiée et le montant est bloqué, mais **aucun débit réel** n'a lieu
5. Confirmation côté serveur via `POST /bookings/:id/confirm-payment`
6. Affichage de l'écran de succès

### 3.4 Vue d'ensemble du cycle de vie complet

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  RÉSERVATION     │     │  DÉCISION KOOKER │     │  PRESTATION           │     │  CONFIRMATION    │     │  PAIEMENT FINAL │
│                  │     │                  │     │                       │     │                  │     │                 │
│  Client réserve  │────>│  Kooker accepte  │────>│  Créneau terminé      │────>│  Client confirme │────>│  Transfert auto │
│  + pré-auth CB   │     │  = capture CB    │     │  (détection auto cron)│     │  OU auto 48h     │     │                 │
│                  │     │                  │     │                       │     │                  │     │  Kooker: 80%    │
│  Carte vérifiée  │     │  Kooker refuse   │     │  Status: confirmed    │     │  Status: completed│    │  Weekook: 20%   │
│  Montant bloqué  │     │  = annulation    │     │  → awaiting_          │     │  → transferred   │     │  (commission)   │
│  Pas de débit    │     │  hold libéré     │     │    confirmation       │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └───────────────────────┘     └──────────────────┘     └─────────────────┘
```

**Cycle des statuts de réservation :**
```
pending → confirmed → awaiting_confirmation → completed
                ↘ cancelled     ↘ cancelled
```

### 3.5 Décision du kooker

Le kooker voit la réservation dans son dashboard avec le badge **"Pré-autorisé"** (orange).

**Si le kooker ACCEPTE :**
- Stripe **capture** le montant (débit réel sur la carte du client)
- Le badge passe à **"Payé"** (vert)
- L'argent reste séquestré sur le **compte plateforme Weekook (Massilia Peche Club)** — pas encore versé au kooker

**Si le kooker REFUSE :**
- Stripe **annule** la pré-autorisation (le hold est libéré)
- Aucun débit n'a lieu
- Le badge passe à **"Annulé"** (gris)

> **Important** : Le kooker ne peut **plus** marquer directement une réservation comme "terminée". Il peut uniquement accepter ou annuler. La suite du workflow est automatisée (voir section 4).

### 3.6 Annulation

**Annulation AVANT acceptation du kooker (status = pending) :**
- La pré-autorisation est annulée
- Le hold sur la carte est libéré immédiatement
- Aucun débit, aucun frais

**Annulation APRÈS acceptation (status = confirmed, paiement capturé) :**
- Un **remboursement** Stripe est créé
- Le montant est recrédité sur la carte du client
- Délai de remboursement : 5 à 10 jours ouvrés selon la banque

**Annulation en attente de confirmation (status = awaiting_confirmation) :**
- Un **remboursement** Stripe est créé (identique à après acceptation)
- Le montant est recrédité sur la carte du client

---

## 4. Confirmation de prestation et libération des fonds

### 4.1 Principe

L'argent du client est **séquestré** sur le compte plateforme (Massilia Peche Club) après la capture. Il n'est transféré au kooker **qu'après confirmation** que la prestation a bien eu lieu. Cette confirmation vient du **client** (ou automatiquement après 48h).

### 4.2 Détection automatique de fin de créneau (Cron)

Un système de tâches planifiées (`node-cron`) tourne en continu sur le serveur :

| Fréquence | Tâche | Action |
|-----------|-------|--------|
| Toutes les 5 min | Transition | Détecte les réservations `confirmed` dont le créneau est passé → passe en `awaiting_confirmation` + email au client |
| Toutes les 30 min | Rappels | Envoie les rappels email (rappel 2 à +24h, rappel 3 à +36h) |
| Toutes les 15 min | Auto-confirm | Auto-confirme les réservations à +48h → `completed` + transfert Stripe |

**Calcul de fin de créneau :** `date du booking` + `startTime` + `durée du service en minutes` (timezone Europe/Paris).

**Fichier serveur :** `server/src/cron/bookingCompletion.ts`

### 4.3 Emails envoyés au client

| Moment | Email | Contenu |
|--------|-------|---------|
| Créneau terminé (T+0) | Demande de confirmation | "Confirmez que la prestation a eu lieu" + lien vers la réservation |
| T+24h sans réponse | Rappel 1 | "Validation automatique dans 24h" |
| T+36h sans réponse | Rappel 2 | "Dernier rappel — validation automatique dans 12h" |
| T+48h (auto-confirm) | Notification | "Prestation auto-validée" |

**Fichier serveur :** `server/src/lib/email.ts` (fonctions `sendConfirmationRequest*`, `sendAutoConfirmation*`)

### 4.4 Confirmation par le client

Le client peut confirmer depuis :
- Le **dashboard utilisateur** : bouton vert **"Confirmer la réalisation"** sur chaque réservation `awaiting_confirmation`
- La **page de détail** de la réservation : bouton **"Confirmer la réalisation"**

**Endpoint :** `PUT /api/v1/bookings/:id/confirm-completion`

**Ce qui se passe au clic :**
1. Le statut passe à `completed`
2. Le transfert Stripe est déclenché (voir 4.5)
3. Un email est envoyé au kooker : "Le client a confirmé, paiement en cours de versement"
4. Un message système est envoyé dans la messagerie interne
5. La modale d'avis s'ouvre immédiatement (voir section 5)

### 4.5 Transfert Stripe — Répartition des fonds

**Fichier serveur :** `server/src/lib/bookingTransfer.ts`

Quand une prestation est confirmée (par le client ou auto-confirm), la fonction `executeStripeTransfer()` est appelée :

```
╔══════════════════════════════════════════════════════════════════════╗
║                     RÉPARTITION DES FONDS                           ║
║                                                                     ║
║  Prix total payé par le client :               50,00€               ║
║                                                                     ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │  Compte Massilia Peche Club (plateforme)                    │    ║
║  │  = Commission Weekook (20% par défaut)                      │    ║
║  │  = 50,00€ × 20% = 10,00€                                   │    ║
║  │  → Reste sur le compte principal Stripe                     │    ║
║  └─────────────────────────────────────────────────────────────┘    ║
║                                                                     ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │  Compte Kooker (Stripe Connect Express)                     │    ║
║  │  = Prix total - Commission                                  │    ║
║  │  = 50,00€ - 10,00€ = 40,00€                                │    ║
║  │  → Transféré via stripe.transfers.create()                  │    ║
║  └─────────────────────────────────────────────────────────────┘    ║
╚══════════════════════════════════════════════════════════════════════╝
```

**Détail technique :**
- Le paiement du client est reçu sur le **compte plateforme** (Massilia Peche Club = le compte Stripe principal lié à `sk_test_...`)
- `stripe.transfers.create()` envoie uniquement la part du kooker vers son compte Connect
- La commission **reste automatiquement** sur le compte plateforme — pas besoin d'un second transfert
- Le `transfer_group` est `booking_{id}` pour traçabilité
- Un enregistrement `Payment` de type `transfer` est créé en base (audit trail)

**Exemple concret :**

| Élément | Montant | Destination |
|---------|---------|-------------|
| Prix total client | **50,00€** | Compte Massilia Peche Club (plateforme) |
| Commission Weekook (20%) | 10,00€ | **Reste** sur Massilia Peche Club |
| Transfert kooker | 40,00€ | Compte Stripe Connect du kooker |

### 4.6 Auto-confirmation (48h)

Si le client ne confirme pas dans les 48h suivant la fin du créneau :
1. Le cron auto-confirme : statut → `completed`
2. Le transfert Stripe est déclenché automatiquement
3. Un email est envoyé au client : "Prestation auto-validée"
4. Le kooker est notifié du versement

### 4.7 Récapitulatif du cycle de vie Stripe

```
Client réserve          → PaymentIntent créé (capture_method: manual)
                        → paymentStatus: pending_authorization → authorized

Kooker accepte          → stripe.paymentIntents.capture()
                        → paymentStatus: captured
                        → Argent séquestré sur compte Massilia Peche Club

Créneau terminé (cron)  → booking.status: awaiting_confirmation
                        → Email au client

Client confirme (ou     → booking.status: completed
auto-confirm 48h)       → stripe.transfers.create() vers kooker
                        → paymentStatus: transferred
                        → Commission reste sur Massilia Peche Club
```

---

## 5. Avis bidirectionnels

### 5.1 Principe

Après confirmation de la prestation, un système d'avis bidirectionnels permet au client et au kooker de se noter mutuellement.

### 5.2 Flux des avis

```
Prestation confirmée (completed)
        │
        ▼
┌───────────────────┐
│  Client note le   │  ← Modale d'avis ouverte automatiquement
│  kooker (1-5 ★)   │     après confirmation
│  + commentaire    │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Kooker peut      │  ← Disponible uniquement APRÈS que le
│  noter le client  │     client a laissé son avis
│  (1-5 ★)          │
└───────────────────┘
```

### 5.3 Avis client → kooker (user_to_kooker)

- **Déclenchement** : modale ouverte automatiquement au clic sur "Confirmer la réalisation"
- **Aussi accessible** : bouton "Laisser un avis" dans l'historique des réservations et sur la page profil du kooker
- **Endpoint** : `POST /api/v1/reviews` (avec `bookingId`, `kookerProfileId`, `rating`, `comment`)
- **Visibilité** : affiché sur la page profil du kooker avec le nom du service
- **Limite** : un seul avis par booking — le bouton disparaît après soumission

### 5.4 Avis kooker → client (kooker_to_user)

- **Condition** : le client doit avoir laissé son avis en premier
- **Accessible** : page de détail de la réservation, section dédiée pour le kooker
- **Endpoint** : `POST /api/v1/reviews/kooker-to-user` (avec `bookingId`, `rating`, `comment`)
- **Limite** : un seul avis par booking

### 5.5 Affichage sur la page profil kooker

Les avis sont affichés en bas de la page profil avec :
- Nom de l'auteur + avatar
- Date + **nom du service** (prestation liée)
- Note en étoiles
- Commentaire

Un clic sur les **étoiles / note** en haut de la page profil fait défiler automatiquement vers la section avis.

---

## 6. Administration — Commission plateforme

### 6.1 Accès

La commission se configure dans le **backoffice admin** :
- URL : `/admin/config`
- Section : **"Commission plateforme"** (en haut de la page)

### 6.2 Interface

```
╔══════════════════════════════════════════════════════════╗
║  Commission plateforme                   [Sauvegarder]  ║
║                                                         ║
║  Pourcentage prélevé sur chaque paiement avant          ║
║  transfert au kooker.                                   ║
║                                                         ║
║  ┌──────┐                                               ║
║  │  20  │ %                                             ║
║  └──────┘                                               ║
╚══════════════════════════════════════════════════════════╝
```

### 6.3 Fonctionnement

- **Valeur par défaut** : 20%
- **Plage autorisée** : 0% à 100%
- Le bouton "Sauvegarder" n'apparaît que si la valeur a été modifiée
- Le changement est **appliqué immédiatement** sur les prochains transferts
- Les transferts déjà effectués ne sont **pas** recalculés

### 6.4 Calcul de la commission

```
Commission = Prix total × Taux / 100
Montant kooker = Prix total - Commission
```

**Exemples avec différents taux :**

| Prix total | Taux | Commission | Kooker reçoit |
|-----------|------|------------|---------------|
| 50,00€ | 20% | 10,00€ | 40,00€ |
| 50,00€ | 15% | 7,50€ | 42,50€ |
| 50,00€ | 10% | 5,00€ | 45,00€ |
| 120,00€ | 20% | 24,00€ | 96,00€ |

### 6.5 Autres configurations admin

La page Admin Config contient aussi les listes éditables :
- **Spécialités culinaires** (Méditerranéen, Provençal, etc.)
- **Villes disponibles** (Marseille, Aix-en-Provence, etc.)
- **Allergènes** (Gluten, Lactose, etc.)
- **Types de service** (KOOK, KOURS)

---

## 7. Statuts de paiement

### 7.1 Tableau des statuts

| Statut | Badge | Couleur | Signification |
|--------|-------|---------|---------------|
| `none` | — | — | Pas de paiement (Stripe non configuré ou ancienne réservation) |
| `pending_authorization` | Paiement en cours | Orange | En attente de la confirmation CB du client |
| `authorized` | Pré-autorisé | Orange | CB vérifiée, montant bloqué, pas de débit |
| `captured` | Payé | Vert | Montant débité de la carte du client |
| `transferred` | Versé au kooker | Vert foncé | Montant transféré au kooker (- commission) |
| `cancelled` | Annulé | Gris | Pré-autorisation annulée (avant capture) |
| `refunded` | Remboursé | Gris | Montant remboursé au client (après capture) |
| `failed` | — | — | Erreur Stripe (carte refusée, etc.) |

### 7.2 Diagramme des transitions

```
                    ┌──────────────────────┐
                    │ pending_authorization │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │     authorized       │
                    └──────────┬───────────┘
                              / \
                    Accepte /     \ Refuse/Annule
                          /         \
               ┌─────────▼──┐   ┌────▼────────┐
               │  captured   │   │  cancelled  │
               └──────┬──────┘   └─────────────┘
                     / \
          Terminé  /     \ Annulé
                 /         \
      ┌─────────▼───┐   ┌───▼───────┐
      │ transferred │   │ refunded  │
      └─────────────┘   └───────────┘
```

### 7.3 Où sont affichés les badges ?

- **Page détail réservation** (`BookingDetailPage`) : à côté du badge de statut de la réservation
- **Dashboard kooker** (`KookerDashboardPage`) : dans chaque carte de réservation

---

## 8. Mode dégradé (sans Stripe)

### 8.1 Quand s'active-t-il ?

Le mode dégradé s'active automatiquement quand :
- Les variables `STRIPE_SECRET_KEY` et/ou `STRIPE_PUBLISHABLE_KEY` ne sont **pas configurées** dans le `.env`
- Ou quand la clé publishable est **vide**

### 8.2 Comportement

| Fonctionnalité | Avec Stripe | Sans Stripe (mode dégradé) |
|----------------|-------------|----------------------------|
| Réservation | Phase 1 (formulaire) + Phase 2 (paiement) | Phase 1 uniquement, réservation directe |
| Pré-autorisation | Carte vérifiée, montant bloqué | Pas de paiement |
| Capture à l'acceptation | Débit réel | Pas de débit |
| Transfert à la complétion | Vers compte kooker | Pas de transfert |
| Remboursement à l'annulation | Automatique | Pas de remboursement |
| `paymentStatus` des bookings | `pending_authorization` → `authorized` → ... | `none` |
| Onboarding kooker | Redirection vers Stripe Connect | Skippé silencieusement |
| Bannière dashboard kooker | Affichée si non connecté | Non affichée |

### 8.3 Messages côté serveur

Au démarrage, si Stripe n'est pas configuré :
```
[stripe] STRIPE_SECRET_KEY non configurée — les paiements sont désactivés.
```

### 8.4 Transition vers le mode paiement

Pour activer les paiements, il suffit de :
1. Configurer les 3 variables Stripe dans le `.env` (voir section 1.3)
2. Redémarrer le serveur
3. Les nouvelles réservations passeront par le formulaire de paiement

> **Note** : Les réservations créées en mode dégradé (paymentStatus `none`) ne seront pas affectées. Seules les nouvelles réservations bénéficieront du paiement.

---

## 9. Tests en mode développement

### 9.1 Cartes de test Stripe

| Numéro de carte | Résultat |
|-----------------|----------|
| `4242 4242 4242 4242` | Paiement réussi |
| `4000 0025 0000 3155` | Authentification 3D Secure requise |
| `4000 0000 0000 9995` | Carte refusée (fonds insuffisants) |
| `4000 0000 0000 0002` | Carte refusée (générique) |

**Pour toutes les cartes de test :**
- Date d'expiration : n'importe quelle date future (ex: `12/30`)
- CVC : n'importe quel code à 3 chiffres (ex: `123`)
- Code postal : n'importe quel code (ex: `13000`)

### 9.2 Scénarios de test recommandés

#### Test 1 : Flux complet réussi
1. Se connecter en tant qu'utilisateur
2. Choisir un service, date, créneau, convives → cliquer "Confirmer la réservation"
3. Le formulaire de paiement apparaît → entrer `4242 4242 4242 4242`
4. Cliquer "Payer et confirmer"
5. Vérifier dans le dashboard Stripe : PaymentIntent en `requires_capture`
6. Se connecter en tant que kooker > Accepter la réservation
7. Vérifier : PaymentIntent passé à `succeeded` (capturé), argent sur compte Massilia Peche Club
8. Attendre que le créneau passe (ou modifier la date en DB) → le cron passe en `awaiting_confirmation`
9. Se connecter en tant que client → cliquer "Confirmer la réalisation"
10. Vérifier : Transfer créé vers le compte Connect du kooker (montant - commission)
11. Vérifier : la modale d'avis s'ouvre automatiquement
12. Laisser un avis → vérifier qu'il apparaît sur la page profil du kooker

#### Test 2 : Retour au formulaire
1. Choisir un service, date, créneau, convives → cliquer "Confirmer la réservation"
2. Sur l'écran de paiement, cliquer **"Modifier la réservation"**
3. Vérifier que le formulaire réapparaît avec les valeurs pré-remplies

#### Test 3 : Carte refusée
1. Arriver à l'écran de paiement
2. Entrer la carte `4000 0000 0000 0002`
3. Vérifier le message d'erreur
4. Vérifier qu'aucune réservation n'est créée en base

#### Test 4 : Annulation par le client
1. Réserver avec la carte `4242 4242 4242 4242`
2. Annuler la réservation depuis le dashboard utilisateur
3. Vérifier que le PaymentIntent est annulé dans Stripe

#### Test 5 : Refus par le kooker
1. Réserver avec la carte `4242 4242 4242 4242`
2. Se connecter en tant que kooker > Refuser la réservation
3. Vérifier que le PaymentIntent est annulé

#### Test 6 : Remboursement après capture
1. Réserver > Kooker accepte (capture)
2. Annuler la réservation
3. Vérifier qu'un Refund est créé dans Stripe

#### Test 7 : Commission modifiée
1. Aller dans Admin > Configuration
2. Modifier la commission à 15%
3. Créer une réservation > Kooker accepte > Créneau passe > Client confirme
4. Vérifier que le Transfer est calculé avec 15% de commission

#### Test 8 : Auto-confirmation (48h)
1. Créer une réservation, kooker accepte
2. En DB, modifier `awaitingConfirmationAt` à il y a 49h
3. Attendre le passage du cron (15 min max)
4. Vérifier : statut passe à `completed`, Transfer Stripe créé automatiquement

#### Test 9 : Avis bidirectionnels
1. Après confirmation d'une prestation, vérifier que la modale d'avis s'ouvre
2. Laisser un avis client → kooker
3. Vérifier que le bouton "Laisser un avis" disparaît sur cette réservation
4. Se connecter en tant que kooker → la section "Noter le client" apparaît
5. Laisser un avis kooker → client

#### Test 10 : Annulation en awaiting_confirmation
1. Créer une réservation, kooker accepte, créneau passe → `awaiting_confirmation`
2. Annuler la réservation
3. Vérifier qu'un remboursement Stripe est créé

#### Test 11 : Mode dégradé (sans Stripe)
1. Retirer les variables Stripe du `.env` et redémarrer le serveur
2. Choisir un service, date, créneau, convives → cliquer "Confirmer la réservation"
3. Vérifier que la réservation est créée directement (pas de formulaire de carte)
4. Le `paymentStatus` doit être `none`

### 9.3 Dashboard Stripe

Pour suivre les paiements en temps réel :
- **Payments** : voir tous les PaymentIntents (autorisés, capturés, annulés)
- **Transfers** : voir les transferts vers les comptes kookers
- **Connect** : voir les comptes Express des kookers
- **Webhooks** : voir les événements envoyés et les réponses

URL : https://dashboard.stripe.com/test/payments

---

## 10. Webhook Stripe

### 10.1 À quoi ça sert ?

Les webhooks permettent à Stripe d'envoyer des notifications au serveur Weekook quand un événement se produit (paiement réussi, compte mis à jour, etc.). C'est une couche de **synchronisation** supplémentaire.

### 10.2 Événements gérés

| Événement | Action |
|-----------|--------|
| `payment_intent.amount_capturable_updated` | Met à jour `paymentStatus` → `authorized` |
| `payment_intent.payment_failed` | Met à jour `paymentStatus` → `failed`, booking → `cancelled` |
| `account.updated` | Met à jour `stripeOnboardingComplete` si charges+payouts activés |

### 10.3 Configuration en production

1. Aller dans **Stripe Dashboard > Developers > Webhooks**
2. Cliquer sur **"Add endpoint"**
3. URL : `https://dev.weekook.com/api/v1/stripe/webhook`
4. Événements à écouter :
   - `payment_intent.amount_capturable_updated`
   - `payment_intent.payment_failed`
   - `account.updated`
5. Copier le **Signing secret** (`whsec_...`) dans le `.env`

### 10.4 Test en local avec Stripe CLI

```bash
# Installer Stripe CLI (macOS)
brew install stripe/stripe-cli/stripe

# Se connecter
stripe login

# Écouter les webhooks et les transférer vers le serveur local
stripe listen --forward-to localhost:3001/api/v1/stripe/webhook

# La commande affiche le signing secret :
# > Ready! Your webhook signing secret is whsec_test_abc123...
# Copier cette valeur dans .env → STRIPE_WEBHOOK_SECRET
```

---

## 11. FAQ / Dépannage

### Q: Le module de paiement affiche un spinner infini

**Cause :** Stripe n'est pas configuré (clé publishable vide ou absente).

**Correction appliquée :** Depuis la dernière mise à jour, quand Stripe n'est pas disponible, la réservation est créée directement sans passer par le formulaire de paiement. Si le spinner persiste, vérifier que le déploiement est à jour.

### Q: Un kooker ne peut pas recevoir de réservations

**Vérifier :**
- Le kooker a-t-il complété l'onboarding Stripe ? (bannière absente du dashboard = OK)
- Dans le dashboard Stripe > Connect > voir le compte du kooker
- `charges_enabled` et `payouts_enabled` doivent être `true`
- Si Stripe n'est pas configuré, les réservations fonctionnent sans paiement

### Q: Le paiement échoue à la réservation

**Causes possibles :**
- Carte de test invalide (utiliser `4242 4242 4242 4242`)
- Clés Stripe mal configurées dans `.env`
- Le serveur ne démarre pas (vérifier les logs)

### Q: Le serveur crash au démarrage avec une erreur Stripe

**Cause :** `STRIPE_SECRET_KEY` est définie mais vide (`STRIPE_SECRET_KEY=`).

**Solution :** Soit mettre une vraie clé, soit **retirer complètement** la ligne du `.env`. Le serveur démarre sans problème si la variable est absente (mode dégradé).

### Q: La capture échoue quand le kooker accepte

**Causes possibles :**
- La pré-autorisation a expiré (7 jours par défaut, 31 avec extended auth)
- Le `paymentStatus` n'est pas `authorized`
- Vérifier les logs serveur pour le message d'erreur Stripe

### Q: Le transfert ne se fait pas à la complétion

**Vérifier :**
- Le `paymentStatus` est bien `captured`
- Le kooker a bien un `stripeAccountId` valide
- Le montant du transfert est > 0 (après déduction de la commission)
- Vérifier dans Stripe Dashboard > Transfers

### Q: La pré-autorisation expire

La pré-autorisation Stripe expire après **7 jours** (31 jours avec extended authorization). Si le kooker ne répond pas dans ce délai, le hold est automatiquement libéré par Stripe. Dans ce cas :
- Le webhook `payment_intent.payment_failed` sera déclenché
- La réservation sera automatiquement annulée

> **Note** : Un mécanisme de cron pour annuler proactivement les réservations expirées pourra être ajouté ultérieurement.

### Q: Comment promouvoir un utilisateur en admin ?

```sql
UPDATE users SET role = 'admin' WHERE email = 'votre@email.com';
```

L'admin accède ensuite au backoffice via `/admin`.

### Q: Où voir l'audit trail des paiements ?

Chaque opération de paiement est enregistrée dans la table `payments` en base de données :

```sql
SELECT * FROM payments WHERE booking_id = 123 ORDER BY created_at;
```

Types d'enregistrements :
- `authorization` : pré-autorisation carte
- `capture` : capture du paiement
- `transfer` : transfert vers le kooker (inclut `commission_in_cents`)
- `cancellation` : annulation du hold
- `refund` : remboursement

### Q: Le kooker ne peut plus marquer une réservation comme terminée ?

**C'est normal.** Depuis la mise à jour du workflow, seul le **client** peut confirmer que la prestation a eu lieu (ou auto-confirmation après 48h). Le kooker peut uniquement accepter ou annuler une réservation.

### Q: Le cron ne détecte pas les créneaux terminés

**Vérifier :**
- Le cron est bien démarré (`startBookingCompletionCron()` dans `app.ts`)
- La réservation est en statut `confirmed` (pas `pending`)
- La date + heure de début + durée du service est bien dans le passé
- Les logs serveur montrent `[cron]` pour chaque passage

### Q: Où va la commission Weekook ?

La commission **reste automatiquement** sur le compte Stripe principal (Massilia Peche Club). Seul le montant net (total - commission) est transféré au kooker via `stripe.transfers.create()`. Il n'y a pas besoin d'un transfert séparé vers le compte plateforme.

### Q: Le client ne voit pas le bouton "Confirmer la réalisation"

**Vérifier :**
- La réservation est bien en statut `awaiting_confirmation`
- Le client est connecté avec le bon compte (propriétaire de la réservation)
- Les réservations `awaiting_confirmation` apparaissent dans l'onglet "À venir" du dashboard

---

## Résumé rapide

| Action | Qui | Résultat paiement |
|--------|-----|-------------------|
| Réserver (Stripe actif) | Client | Phase 1 (formulaire) → Phase 2 (paiement) → Carte pré-autorisée |
| Réserver (sans Stripe) | Client | Phase 1 (formulaire) → Réservation directe (pas de paiement) |
| Accepter | Kooker | Paiement capturé → argent séquestré sur Massilia Peche Club |
| Refuser | Kooker | Hold annulé (aucun débit) |
| Annuler (avant acceptation) | Client ou Kooker | Hold annulé |
| Annuler (après acceptation) | Client ou Kooker | Remboursement |
| Créneau terminé | Cron auto | Status → `awaiting_confirmation` + email au client |
| Confirmer la réalisation | Client | Transfert au kooker (- commission) + modale d'avis |
| Auto-confirmation (+48h) | Cron auto | Transfert au kooker (- commission) |
| Laisser un avis | Client → Kooker | Avis lié au booking, visible sur profil kooker |
| Noter le client | Kooker → Client | Avis lié au booking (après avis client) |

### Répartition des fonds (exemple à 20% de commission)

| Élément | Montant | Compte |
|---------|---------|--------|
| Paiement client | 50,00€ | → Massilia Peche Club (plateforme) |
| Commission Weekook (20%) | 10,00€ | Reste sur Massilia Peche Club |
| Transfert kooker | 40,00€ | → Compte Stripe Connect du kooker |
