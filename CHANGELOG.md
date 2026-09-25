# Changelog

Toutes les évolutions notables du projet sont documentées ici.

## [Non publié] — Sprint 5bis

### Ajouté
- **Résultats détaillés des propositions** (S5-21) : page admin `/admin/propositions/:id/stats`, répartition des votes selon le profil déclaré des votants (résidence, quartier, lieu et rôle de travail), impression / export PDF — endpoint `GET /api/v1/proposals/:id/stats?segmentBy=…`

### Corrigé
- **Inscription** (S5A-02) : le quartier et le rôle de travail saisis à l'inscription sont enfin enregistrés (ils étaient validés puis ignorés) ; quartier de résidence conservé seulement pour « autre quartier », rôle seulement avec un quartier de travail
- **Erreurs traduites** (S5A-02) : pseudo ou email déjà pris → 409 `PSEUDO_TAKEN` / `EMAIL_TAKEN` (y compris pour deux inscriptions simultanées), enregistrement introuvable → 404, image trop lourde → 413 `FILE_TOO_LARGE`, mauvais format → 400 `INVALID_FILE_TYPE`, JSON mal formé → 400 `INVALID_JSON`, trop gros → 413 — au lieu de 500 ; une 500 ne renvoie plus jamais de code interne Prisma
- **Tests** (S5A-02) : `users.tests.js` renommé en `users.test.js` — ses 11 tests n'avaient jamais été exécutés ; nouveau garde-fou qui échoue si un fichier de `tests/` est mal nommé

### Sécurité / RGPD
- **Polices auto-hébergées** (S5A-03, CNIL) : Fraunces et Public Sans sont servies par notre serveur (paquets `@fontsource-variable/*`, licence OFL) — plus aucun appel à Google Fonts, donc plus d'adresse IP transmise à Google ; garde-fou de test contre toute réintroduction ; `nodemailer` retiré des dépendances du client (inutilisé)
- **Contrôle d'accès** (S5A-01, OWASP A01) : le rôle et l'existence du compte sont relus en base à chaque requête authentifiée — un admin rétrogradé perd ses droits immédiatement, le jeton d'un compte supprimé est refusé (401) ; algorithme JWT épinglé en HS256
- **Secret statistique** : tout groupe de 1 à 4 personnes est masqué dans les résultats segmentés (votes et enquêtes), y compris une question branchée vue par trop peu de personnes d'un segment
- Les réponses libres ne sont plus jamais détaillées à l'intérieur d'un segment, ni reproduites dans un document imprimé

## v1.0.0 — Lot 1 (Sprints 0 à 5)

Première mise en ligne publique de Senlis Participatif.

### Ajouté
- **Authentification** : inscription, vérification d'email, connexion, mot de passe oublié
- **Propositions citoyennes** : création, vote (pour/contre/neutre), carte interactive (Leaflet)
- **Enquêtes** : moteur générique (5 types de questions), constructeur admin, parcours répondant, résultats publics
- **Carte** : quartiers IRIS, parkings de report, propositions géolocalisées
- **Sécurité** : mot de passe renforcé (recommandation CNIL), double authentification par email pour les comptes admin
- **RGPD** : effacement de compte (cascade/anonymisation selon les données), pages légales, consentement à l'inscription
- **Accessibilité** : widget complet (profils rapides, contrastes, taille de texte, lecture au survol), audit de contraste, `prefers-reduced-motion` respecté partout
- **Expérience** : mascotte animée, confettis, compteurs animés, toasts, guide-citoyen contextuel
- **Performance** : découpage du code par route (chargement à la demande)

### Sécurité
- Mise en conformité avec la recommandation CNIL du 14 avril 2026 sur les pixels de suivi dans les emails (aucun pixel de suivi utilisé)

### Infrastructure
- Bascule de l'envoi d'emails de Mailtrap (dev) vers Brevo (production)
- Validation de la configuration au démarrage du serveur
