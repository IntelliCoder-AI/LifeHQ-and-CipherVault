import type { Metadata } from "next";
import "@lifehq/ui/styles.css";
import "./styles.css";
export const metadata: Metadata = {
  title: "LifeHQ — Your personal atelier",
  description: "A thoughtful space for your days, ideas, and ambitions.",
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
