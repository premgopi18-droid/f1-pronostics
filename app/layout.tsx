import type { Metadata, Viewport } from "next";
import { Inter, Titillium_Web, Rajdhani } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/app/components/sw-register";
import { InstallBanner } from "@/app/components/install-banner";
import { BottomNav } from "@/app/components/bottom-nav";
import { SplashScreen } from "@/app/ui/splash-screen";
import {
  REDUCE_MOTION_STORAGE_KEY,
  REDUCE_MOTION_CLASS,
} from "@/lib/a11y/reduce-motion";
import { FONT_SIZE_STORAGE_KEY, FONT_SIZE_CLASS } from "@/lib/a11y/font-size";
import { THEME_STORAGE_KEY, THEME_PRIMARY_COLORS } from "@/lib/theme/themes";
import {
  SPLASH_SESSION_STORAGE_KEY,
  SPLASH_PLAY_CLASS,
  SPLASH_FAILSAFE_MS,
} from "@/lib/splash/splash";

// Applique le mode accessibilité manuel avant le premier paint (anti-FOUC). La
// préférence système, elle, est gérée en pur CSS (`@media prefers-reduced-motion`),
// donc le script n'a à traiter que l'override explicite.
const reduceMotionBootScript = `try{if(localStorage.getItem('${REDUCE_MOTION_STORAGE_KEY}')==='true')document.documentElement.classList.add('${REDUCE_MOTION_CLASS}')}catch(e){}`;

// Applique la taille de police choisie avant le premier paint (anti-FOUC).
const fontSizeClassMap = JSON.stringify(FONT_SIZE_CLASS);
const fontSizeBootScript = `try{var _f=localStorage.getItem('${FONT_SIZE_STORAGE_KEY}');var _m=${fontSizeClassMap};if(_f&&_m[_f])document.documentElement.classList.add(_m[_f])}catch(e){}`;

// Pose data-theme sur <html> et met à jour theme-color avant le premier paint.
// Le thème 'boxbox' est le défaut (pas d'attribut) — on ne pose l'attribut que
// pour les thèmes non-défaut.
const themeColorMap = JSON.stringify(THEME_PRIMARY_COLORS)
const themeBootScript = `try{var _t=localStorage.getItem('${THEME_STORAGE_KEY}');if(_t&&_t!=='boxbox'){document.documentElement.setAttribute('data-theme',_t);var _c=${themeColorMap};var _m=document.querySelector('meta[name="theme-color"]');if(_m&&_c[_t])_m.setAttribute('content',_c[_t])}}catch(e){}`;

// Capte beforeinstallprompt dès le parsing du <body>, avant que React n'attache son
// listener : l'event peut se déclencher pendant le chargement et serait sinon perdu.
// useInstallPrompt lit ensuite window.__deferredInstallPrompt au montage.
const installPromptBootScript = `window.__deferredInstallPrompt=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__deferredInstallPrompt=e})`;

// Décide AVANT le premier paint si le splash doit jouer, pour couvrir l'écran
// immédiatement (pas de flash de la Home avant l'animation). Pose `.splash-play`
// sur <html> (→ overlay visible via globals.css) et marque la session. Skippé si
// mode réduit (système ou override) ou splash déjà vu cette session. Un filet de
// sécurité retire la classe si React ne le fait jamais (bundle non chargé).
const splashBootScript = `try{var _r=matchMedia('(prefers-reduced-motion: reduce)').matches||localStorage.getItem('${REDUCE_MOTION_STORAGE_KEY}')==='true';if(!_r&&!sessionStorage.getItem('${SPLASH_SESSION_STORAGE_KEY}')){sessionStorage.setItem('${SPLASH_SESSION_STORAGE_KEY}','1');document.documentElement.classList.add('${SPLASH_PLAY_CLASS}');setTimeout(function(){document.documentElement.classList.remove('${SPLASH_PLAY_CLASS}')},${SPLASH_FAILSAFE_MS})}}catch(e){}`;

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const titilliumWeb = Titillium_Web({
  variable: "--font-titillium",
  weight: ["400", "600", "700", "900"],
  subsets: ["latin"],
  display: "swap",
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BoxBox",
  description: "Pronostics F1 entre amis",
  // iOS ignore les icônes du manifest pour l'écran d'accueil → apple-touch-icon dédié.
  icons: { apple: "/icons/icon-192.png" },
  // statusBarStyle "default" réserve la barre d'état (contenu en dessous) : l'app ne gère
  // pas encore env(safe-area-inset-top), donc pas de "black-translucent" qui passerait dessous.
  appleWebApp: { capable: true, title: "BoxBox", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Teinte la barre du navigateur (Android) — généré en <meta name="theme-color">.
  // Valeur initiale (boxbox) ; mise à jour côté client par applyTheme() et le boot script.
  themeColor: THEME_PRIMARY_COLORS.boxbox,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${titilliumWeb.variable} ${rajdhani.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Anti-FOUC : applique le thème et le mode accessibilité avant le premier paint.
            Placés en tête de <body> (pas dans un <head> manuel) : Next gère lui-même le
            <head> et y injecte la <meta name="theme-color"> du viewport — un <head> rendu
            à la main la supprimerait. Depuis <body>, ce <head> est déjà parsé, donc le
            script theme-color trouve la meta, et data-theme est posé sur <html> avant
            tout paint du contenu. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: reduceMotionBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: fontSizeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: installPromptBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: splashBootScript }} />
        <SwRegister />
        <InstallBanner />
        {children}
        <BottomNav />
        <SplashScreen />
      </body>
    </html>
  );
}
