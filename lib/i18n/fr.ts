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
  login: {
    tagline1: "Pronostics F1 entre amis.",
    tagline2: "Ligues privées · items stratégiques.",
    cta: "Continuer avec Google",
    footer: "Pas d'installation · partage par lien",
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
    pickLegend: "Choisis ton casque",
    colors: {
      red: "Casque rouge",
      orange: "Casque orange",
      amber: "Casque jaune",
      green: "Casque vert",
      teal: "Casque turquoise",
      cyan: "Casque cyan",
      blue: "Casque bleu",
      indigo: "Casque indigo",
      purple: "Casque violet",
      pink: "Casque rose",
      white: "Casque blanc",
      slate: "Casque gris",
    },
  },
} as const;
