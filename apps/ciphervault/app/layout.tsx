import { headers } from "next/headers";
import { ThemeProvider } from "@lifehq/ui/theme";
import type { Metadata } from "next";
import "@lifehq/ui/styles.css";
import "./styles.css";
export const metadata: Metadata = {
  title: "CipherVault — Your secrets. Your custody.",
  description:
    "An encrypted local-only prototype. Not independently audited. Use dummy credentials only.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('ciphervault-appearance');document.documentElement.dataset.theme=t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{}",
          }}
        />
        <ThemeProvider storageKey="ciphervault-appearance">
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
