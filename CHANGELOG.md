# Changelog

Toutes les évolutions notables du projet sont documentées ici.

## [Non publié] — Sprint 5bis

### Ajouté
- **Résultats détaillés des propositions** (S5-21) : page admin `/admin/propositions/:id/stats`, répartition des votes selon le profil déclaré des votants (résidence, quartier, lieu et rôle de travail), impression / export PDF — endpoint `GET /api/v1/proposals/:id/stats?segmentBy=…`

### Sécurité / RGPD
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
