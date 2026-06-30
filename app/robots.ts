import type { MetadataRoute } from "next";

// Sans ce fichier, `/robots.txt` renvoie le HTML de l'app (route fourre-tout) →
// les crawlers reçoivent « Syntax not understood » et Lighthouse pénalise le SEO.
// App à accès privé (tout est derrière l'auth, cf. proxy.ts) : on autorise la
// surface publique (landing + /login) et on exclut les routes API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
  };
}
