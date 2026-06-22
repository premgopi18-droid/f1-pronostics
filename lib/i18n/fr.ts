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
    back: "Précédent",
    comingSoon: "Bientôt disponible.",
  },
  login: {
    tagline1: "Pronostics F1 entre amis.",
    tagline2: "Ligues privées · items stratégiques.",
    cta: "Continuer avec Google",
    footer: "Pas d'installation · partage par lien",
  },
  onboarding: {
    pseudoStep: "Étape 1 / 2",
    pseudoTitle: "Choisis ton pseudo",
    pseudoSubtitle: "C'est le nom que verront tes amis dans les classements.",
    pseudoPlaceholder: "ex: BoxBoxRomain",
    pseudoChecking: "Vérification…",
    pseudoAvailable: "Disponible",
    avatarStep: "Étape 2 / 2",
    avatarTitle: "Choisis ton casque",
    avatarSubtitle: "Tu pourras importer le tien plus tard.",
    finish: "C'est parti ! 🏁",
    errorLength: "Entre 3 et 20 caractères.",
    errorChars: "Lettres, chiffres et underscore uniquement.",
    errorTaken: "Ce pseudo est déjà pris.",
    errorAvatar: "Choisis un casque pour continuer.",
    errorGeneric: "Une erreur est survenue. Réessaie.",
  },
  join: {
    invitationLabel: "Invitation reçue",
    adminLabel: "Admin",
    seasonLabel: "Saison",
    members: "membres",
    seasonInProgress: "en cours",
    blurb:
      "Pronostique chaque Grand Prix, joue des items contre tes amis, grimpe au classement de la saison.",
    cta: "Rejoindre la ligue",
    fullTitle: "Ligue complète",
    fullText: "Cette ligue a atteint son nombre maximum de membres.",
    closedTitle: "Inscriptions fermées",
    closedText: "L'admin a fermé les inscriptions à cette ligue.",
    notFoundTitle: "Invitation invalide",
    notFoundText: "Ce lien d'invitation est introuvable ou a expiré.",
    manualTitle: "Rejoindre une ligue",
    manualLabel: "Code d'invitation",
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
