import type { Metadata, Viewport } from "next";
import { Inter, Titillium_Web, Rajdhani } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/app/components/sw-register";
import { InstallBanner } from "@/app/components/install-banner";
import { BottomNav } from "@/app/components/bottom-nav";
import {
  REDUCE_MOTION_STORAGE_KEY,
  REDUCE_MOTION_CLASS,
} from "@/lib/hooks/use-prefers-reduced-motion";
import { THEME_STORAGE_KEY } from "@/lib/hooks/use-theme";

// Applique le mode accessibilité manuel avant le premier paint (anti-FOUC). La
// préférence système, elle, est gérée en pur CSS (`@media prefers-reduced-motion`),
// donc le script n'a à traiter que l'override explicite.
const reduceMotionBootScript = `try{if(localStorage.getItem('${REDUCE_MOTION_STORAGE_KEY}')==='true')document.documentElement.classList.add('${REDUCE_MOTION_CLASS}')}catch(e){}`;

// Pose data-theme sur <html> avant l'hydration pour éviter le flash de thème.
// Le thème 'boxbox' est le défaut (pas d'attribut) — on ne pose l'attribut que
// pour les thèmes non-défaut.
const themeBootScript = `try{var _t=localStorage.getItem('${THEME_STORAGE_KEY}');if(_t&&_t!=='boxbox')document.documentElement.setAttribute('data-theme',_t)}catch(e){}`;

// Capte beforeinstallprompt dès le parsing du <body>, avant que React n'attache son
// listener : l'event peut se déclencher pendant le chargement et serait sinon perdu.
// useInstallPrompt lit ensuite window.__deferredInstallPrompt au montage.
const installPromptBootScript = `window.__deferredInstallPrompt=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__deferredInstallPrompt=e})`;

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
  themeColor: "#e8002d",
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
        {/* Anti-FOUC : applique le thème et le mode accessibilité avant le premier paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: reduceMotionBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: installPromptBootScript }} />
        <SwRegister />
        <InstallBanner />
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
