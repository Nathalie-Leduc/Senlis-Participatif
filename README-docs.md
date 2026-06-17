# 📚 senlis-participatif-docs

> Documentation de conception du projet [Senlis Participatif](https://github.com/Nathalie-Leduc/senlis-participatif) — de l'idée au plan d'exécution. Les diagrammes sont en Mermaid : GitHub les affiche nativement.

## Sommaire

| # | Document | Contenu |
|---|---|---|
| 01 | [Cahier des charges](01-cahier-des-charges.md) | Besoins, objectifs, MVP en 2 lots, Lot 3 collectivités, technos, routes, user stories, risques — *avec journal des décisions (dont adoption de la direction artistique joyeuse v1.1)* |
| 02 | [Diagramme ERD](02-diagramme-erd.md) | Base de données + contraintes d'unicité + règles RGPD de suppression |
| 03 | [Dictionnaire de données](03-dictionnaire-de-donnees.md) | Les 10 entités, attribut par attribut |
| 04 | [Use cases](04-use-cases.md) | 5 cas détaillés (scénarios nominaux + exceptions) |
| 05 | [Diagramme de séquence](05-diagramme-sequence.md) | Soumission d'une réponse d'enquête (transaction, 409) |
| 06 | [Diagramme d'architecture](06-diagramme-architecture.md) | Client / API / BDD / services externes |
| 07 | [Diagramme d'activité](07-diagramme-activite.md) | Cycle de vie d'une proposition |
| 08 | [Merise : MCD · MLD · MPD](08-merise-mcd-mld-mpd.md) | Du conceptuel français au SQL PostgreSQL |
| 09 | [Charte graphique](09-charte-graphique.md) | **« La pierre, la rivière et le cerf »** : palette AA étendue (Joy Layer), mascotte cerf (4 poses, animations CSS, widget guide-citoyen), composants joyeux, micro-interactions, accessibilité |
| 10 | [Wireframes](10-wireframes.html) | 6 écrans basse fidélité annotés — avec sections colorées, mascotte, widget flottant |
| 11 | [Maquettes](11-maquettes.html) | Haute fidélité non interactive (à ouvrir dans un navigateur) — direction artistique joyeuse |
| 12 | [Diagramme des cas d'utilisation](12-diagramme-use-cases.md) | Acteurs, héritage, include/extend |
| 13 | [Diagramme de packages](13-diagramme-package.md) | Organisation du monorepo et dépendances — avec composants mascotte et joy layer |
| 14 | [Sitemap](14-sitemap.md) | Arborescence de navigation par niveau d'accès |
| 15 | [Kanban, sprints & Git](15-kanban-sprints-git.md) | Méthode : colonnes, labels (dont `joy:palier-*`), branches, DoD |
| 16 | [Backlog complet des issues](16-kanban-issues-complet.md) | 53 issues codifiées, planifiées sur 13 semaines — dont 6 issues design mascotte/joy intégrées aux sprints existants |

Annexes : `logo-senlis-participatif.svg` · `schema.prisma` (copie de référence, la source vivante est dans le dépôt de code) · `senlis-participatif-joyeux.html` (prototype interactif de référence pour la direction artistique).

## Comment lire cette documentation

Parcours conseillé : **01** (le pourquoi et le quoi) → **02-03** (les données) → **04-07** (les comportements) → **09-11** (le visuel — la mascotte et l'univers joyeux) → **15-16** (le comment et le quand). Le document 08 (Merise) reprend 02-03 sous l'angle académique MCD/MLD/MPD.

## Conventions

- Tout changement de périmètre passe par le **journal des décisions** du cahier des charges (document 01) — la documentation garde la mémoire de ses choix
- Les documents évoluent par PR, comme le code : une décision = un commit tracé
- Les documents liés au modèle de données (02, 03, 05, 06, 07, 08, 12, 14) n'ont **pas changé** avec l'adoption de la direction artistique joyeuse — la mascotte est 100 % front
