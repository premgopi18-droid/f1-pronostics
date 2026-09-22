import type { NextConfig } from "next";

// Headers de sécurité posés sur toutes les routes (pages, API, assets servis par
// Next). Vercel ajoute déjà Strict-Transport-Security ; le reste est à nous.
// Périmètre volontairement minimal : une CSP complète (script-src…) exigerait des
// nonces/hashes sur les boot scripts inline du layout — chantier séparé (cf. #180).
const SECURITY_HEADERS = [
  {
    // Anti-clickjacking : l'app n'a aucune raison d'être iframée. `frame-ancestors`
    // est le remplaçant moderne de X-Frame-Options (ne pas cumuler les deux).
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'",
  },
  {
    // Pas de sniffing MIME : le navigateur respecte le Content-Type déclaré.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Ne fuite pas les URLs internes (/leagues/<id>, codes d'invitation en query)
    // vers les origines externes — seule l'origine est envoyée en cross-origin.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // APIs navigateur non utilisées par l'app, désactivées explicitement.
    // NB : le push/notifications ne se gère pas ici, et l'upload d'avatar passe
    // par <input type="file"> (pas l'API camera) — rien de fonctionnel n'est coupé.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/** Durée (s) pendant laquelle une page dynamique déjà vue est resservie depuis le cache client. */
const STALE_TIME_DYNAMIC_SECONDS = 30;

const nextConfig: NextConfig = {
  // Supprime `X-Powered-By: Next.js` (fuite de framework). Vercel le retire déjà
  // en prod, mais le projet se veut self-hostable (décision clé « no lock-in ») :
  // cette ligne rend le comportement déterministe quel que soit l'hébergeur.
  poweredByHeader: false,
  experimental: {
    // Cache client des pages dynamiques (#243) : revenir sur un onglet vu il y a moins
    // de STALE_TIME_DYNAMIC_SECONDS est instantané, sans rendu serveur. Contrepartie :
    // toute Server Action qui mute une donnée affichée purge ce cache via
    // `revalidateAfterMutation()` (lib/actions/revalidate.ts).
    staleTimes: { dynamic: STALE_TIME_DYNAMIC_SECONDS },
    // Intégration React <ViewTransition> aux navigations Next (#242) : transition
    // entre écrans et au remplacement skeleton → contenu (cf. app/components/page-transition.tsx).
    viewTransition: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
