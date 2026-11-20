import type { Metadata, Viewport } from "next";
import { Figtree, Martian_Mono, Syne } from "next/font/google";
import Script from "next/script";
import Link from "next/link";
import { SITE } from "@/lib/site";
import "./globals.css";
import styles from "./layout.module.css";

const syne = Syne({ variable: "--font-syne", subsets: ["latin"], weight: ["700", "800"] });
const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const martian = Martian_Mono({ variable: "--font-martian", subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `Remove Background from Image Free: Transparent PNG in Seconds | ${SITE.name}`,
    template: `%s | ${SITE.name}`,
  },
  description:
    "Remove the background from any photo for free. Get a transparent PNG at full resolution, or add a color or blurred background. No sign-up, no watermark, and your photos never leave your device.",
  openGraph: { siteName: SITE.name, type: "website" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e7ede7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1411" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${syne.variable} ${figtree.variable} ${martian.variable}`}>
      <body>
        {SITE.adsenseClient && (
          <Script
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsenseClient}`}
          />
        )}
        <header className="wrap">
          <div className={styles.header}>
            <Link href="/" className={styles.logo}>
              <span className={`${styles.mark} checker`} aria-hidden />
              {SITE.name}
            </Link>
            <span className={styles.tag}>Free · Full resolution · Private</span>
          </div>
        </header>
        <main>{children}</main>
        <footer className={styles.footer}>
          <div className={`wrap ${styles.footerInner}`}>
            <div>
              <p className={styles.footerName}>{SITE.name}</p>
              <p className={styles.footerNote}>
                Photos are processed on your device with ORMBG, an open-source AI model (Apache 2.0 license).
              </p>
            </div>
            <ul className={styles.footerLinks}>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/privacy">Privacy policy</Link></li>
            </ul>
          </div>
        </footer>
      </body>
    </html>
  );
}
