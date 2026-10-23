"use client";
import {
  ShieldCheck,
  ArrowUpRight,
  KeyRound,
  Database,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@lifehq/ui";

export function VaultAccess() {
  return (
    <div className="vault-access stack">
      <div className="page-heading">
        <div>
          <span className="eyebrow">CIPHERVAULT · LOCAL PROTOTYPE</span>
          <h1>A private place for your test secrets.</h1>
          <p>
            CipherVault is a separate application that keeps its encrypted vault
            in your browser on this device.
          </p>
        </div>
      </div>
      <section className="paper-panel vault-introduction">
        <span className="empty-symbol">
          <ShieldCheck size={28} />
        </span>
        <h2>Separate from your LifeHQ workspace.</h2>
        <p>
          The hosted LifeHQ app does not include the vault’s unlock screen.
          Start CipherVault from your copy of the source, then open its separate
          local address.
        </p>
        <div className="vault-start-command">
          <span className="eyebrow">FROM THE REPOSITORY ROOT</span>
          <code>npm run dev:vault</code>
        </div>
        <Button asChild>
          <a
            href={process.env.NEXT_PUBLIC_VAULT_URL || "http://localhost:3001"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open local CipherVault <ArrowUpRight size={18} />
          </a>
        </Button>
        <p className="subtle">
          Start the command first. The local app opens at localhost:3001 on your
          own computer.
        </p>
      </section>
      <div className="vault-capabilities">
        {[
          {
            icon: KeyRound,
            title: "Credentials & secure notes",
            text: "Organize dummy accounts, generate passwords, and find your local items.",
          },
          {
            icon: Database,
            title: "Encrypted local backups",
            text: "Export and restore encrypted backups. Nothing syncs to your LifeHQ account.",
          },
          {
            icon: LockKeyhole,
            title: "An independent lock",
            text: "Your master passphrase and encryption key stay separate from LifeHQ sign-in.",
          },
        ].map((item) => (
          <section key={item.title}>
            <item.icon size={23} />
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </section>
        ))}
      </div>
      <div className="warning">
        <strong>Development prototype — dummy credentials only.</strong>{" "}
        CipherVault has not been independently audited and is unsuitable for
        real credentials until expert review. There is no passphrase recovery;
        keep an encrypted backup.
      </div>
      <a
        className="text-link"
        href="https://github.com/IntelliCoder-AI/LifeHQ-and-CipherVault#run-locally"
        target="_blank"
        rel="noopener noreferrer"
      >
        Source and local setup instructions <ArrowUpRight size={16} />
      </a>
    </div>
  );
}
