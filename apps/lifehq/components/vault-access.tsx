"use client";
import Link from "next/link";
import {
  Vault,
  ArrowUpRight,
  ArrowLeft,
  KeyRound,
  Database,
  Fingerprint,
} from "lucide-react";
import { ThemeToggle } from "@lifehq/ui/theme";
import { Button } from "@lifehq/ui";
export function VaultAccess() {
  const address = process.env.NEXT_PUBLIC_VAULT_URL;
  const launchable = Boolean(
    address &&
    /^https:\/\//.test(address) &&
    !/^https:\/\/(localhost|127\.)/.test(address),
  );
  return (
    <div className="cipher-product">
      <header className="cipher-product-header">
        <Link href="/ciphervault" className="cipher-wordmark">
          <span>
            <Vault size={26} />
          </span>
          CIPHER<span className="cipher-wordmark-light">VAULT</span>
        </Link>
        <div className="row">
          <Link className="cipher-back" href="/">
            <ArrowLeft size={16} /> LifeHQ
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" className="cipher-product-main">
        <div className="cipher-product-kicker">
          <span /> INDEPENDENT APP · ON-DEVICE STORAGE
        </div>
        <div className="cipher-product-hero">
          <div>
            <span className="cipher-edition">CIPHERVAULT / 01</span>
            <h1>
              Your secrets.
              <br />
              <em>Your custody.</em>
            </h1>
            <p>
              A dedicated home for credentials and private notes, with its own
              identity, master passphrase, and encrypted local storage.
            </p>
            {launchable ? (
              <Button asChild>
                <a href={address} target="_blank" rel="noopener noreferrer">
                  Open CipherVault <ArrowUpRight size={18} />
                </a>
              </Button>
            ) : (
              <div className="cipher-unavailable" role="status">
                The web app is being connected. No local server is required once
                its web address is available.
              </div>
            )}
            <span className="cipher-launch-note">
              Separate from LifeHQ sign-in. Opens as its own application.
            </span>
          </div>
          <div className="cipher-emblem" aria-hidden="true">
            <span className="cipher-emblem-ring" />
            <span className="cipher-emblem-ring" />
            <span className="cipher-emblem-core">
              <Vault size={76} strokeWidth={1.1} />
            </span>
            <span className="cipher-emblem-label">
              ENCRYPTED ON THIS DEVICE
            </span>
          </div>
        </div>
        <div className="cipher-feature-grid">
          {[
            {
              icon: KeyRound,
              number: "01",
              title: "One independent key",
              text: "A master passphrase unlocks the vault. It is separate from your LifeHQ password.",
            },
            {
              icon: Database,
              number: "02",
              title: "Your browser is the home",
              text: "Encrypted records stay on this browser and device. Export encrypted backups to keep a second copy.",
            },
            {
              icon: Fingerprint,
              number: "03",
              title: "A focused workspace",
              text: "Credentials, secure notes, password generation, and automatic locking in a dedicated app.",
            },
          ].map((item) => (
            <section key={item.number}>
              <div className="between">
                <item.icon size={22} />
                <span>{item.number}</span>
              </div>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </section>
          ))}
        </div>
        <aside className="cipher-prototype">
          <strong>Development prototype · dummy credentials only.</strong>{" "}
          CipherVault has not been independently audited and is unsuitable for
          real credentials until expert review. There is no passphrase recovery.
          Your vault does not sync across devices.
        </aside>
        <footer className="cipher-product-footer">
          <span>CIPHERVAULT — AN INDEPENDENT COMPANION TO LIFEHQ</span>
          <a
            href="https://github.com/IntelliCoder-AI/LifeHQ-and-CipherVault#run-locally"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source & local setup <ArrowUpRight size={14} />
          </a>
        </footer>
      </main>
    </div>
  );
}
