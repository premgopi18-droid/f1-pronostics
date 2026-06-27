// Constantes « Mode accessibilité » partagées serveur ⇄ client. NE PAS ajouter
// 'use client' ici : le boot script anti-FOUC du layout (Server Component) interpole
// ces valeurs dans une string ; venant d'un module 'use client', le serveur ne
// recevrait que des références client (sérialisées en `undefined`).

/** Clé localStorage de l'override « Mode accessibilité » posé depuis le profil. */
export const REDUCE_MOTION_STORAGE_KEY = 'reduce-motion-override'
/** Classe posée sur `<html>` qui coupe animations/transitions (cf. globals.css). */
export const REDUCE_MOTION_CLASS = 'reduce-motion'
