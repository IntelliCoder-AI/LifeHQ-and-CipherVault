import type { Metadata } from "next";
import "@lifehq/ui/styles.css";
import "./styles.css";
export const metadata: Metadata = {
  title: "CipherVault — Local prototype",
  description:
    "An encrypted local-only prototype. Not independently audited. Use dummy credentials only.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
