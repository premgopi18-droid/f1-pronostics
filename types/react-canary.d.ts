// Expose les typings React canary (`ViewTransition`…) : l'App Router de Next embarque
// un React canary qui exporte ces APIs, mais `@types/react` ne les déclare que via
// cette référence explicite (#242).
/// <reference types="react/canary" />
