/**
 * Catalogue de traduction — français (locale de lancement).
 *
 * i18n approche A : 1 seule locale pour l'instant, pas de routing multi-locale.
 * Ajouter une langue plus tard = ajouter un catalogue de même forme, sans toucher
 * aux écrans (les appels `t('…')` restent identiques).
 */
export const fr = {
  common: {
    loading: "Chargement…",
    next: "Suivant →",
    comingSoon: "Bientôt disponible.",
  },
  nav: {
    label: "Navigation principale",
    home: "Accueil",
    leagues: "Ligues",
    predictions: "Mes Pronos",
    results: "GP Résultats",
    profile: "Profil",
  },
  avatar: {
    helmetAlt: "Avatar casque",
  },
} as const;
