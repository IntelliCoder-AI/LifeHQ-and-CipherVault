"use client";
import { Button } from "@lifehq/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="loading">
      <h1>A little interruption.</h1>
      <p>We couldn’t load this page. Your saved workspace is still there.</p>
      <Button onClick={reset}>Try again</Button>
      <a href="/login">Return to sign in</a>
    </main>
  );
}
