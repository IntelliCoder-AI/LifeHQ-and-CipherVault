# Deployment

## Free infrastructure and current setup

A separate Supabase project named **LifeHQ** was created in the **Anurag** organization after explicit approval for $0 only. The organization reports the Free plan. Project reference: `vcxxhpglhfkdxliwieao`, region `ap-south-1`. Both checked-in migrations have been applied. The existing unrelated project was not modified.

The connected Vercel team **Radhe** (`radhe12`) reports **Hobby**. No paid services, custom domain purchase, AI APIs, enhanced builds, or plan upgrades are enabled by this repository. Remain within provider quotas; free hosting can pause or reject work when limits are exceeded.

LifeHQ is deployed at **https://lifehq-radhe12.vercel.app**, with additional alias `https://lifehq-three.vercel.app`. Source is published on the repository’s `main` branch. The deployment was uploaded through Vercel’s source-file API because the GitHub integration rejected this repository. Git pushes will not automatically redeploy until the owner authorizes the Vercel GitHub integration for this repository and links it to the LifeHQ project.

Deployment verification results and any unresolved external blockers are recorded in [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md). A source repository alone is not a verified live deployment.

## Supabase

For a new installation, create a separate Free project. Use a current Supabase CLI (migration generation here used 2.83.0):

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Inspect pending migrations before applying to an existing database. Never reset a production project to install this app. `supabase start` plus `supabase db reset` is for a disposable local Docker database only. The seed is intentionally empty. Local Docker startup could not be verified in this managed environment because access to `public.ecr.aws` is blocked.

For this delivery, the user confirmed that the production Site URL and both redirect URLs below are saved. For another installation, in **Authentication → URL Configuration**, set Site URL to the exact LifeHQ production origin. Add these redirect URLs for that origin:

```text
https://lifehq-radhe12.vercel.app/auth/callback
https://lifehq-radhe12.vercel.app/auth/callback?next=/reset
```

For local testing add `http://localhost:3000/auth/callback` and `http://localhost:3000/auth/callback?next=/reset`. Add only trusted preview origins when testing preview authentication. Keep email confirmation enabled for production. Use Supabase's supported PKCE callback email flow; `/auth/confirm` also supports validated token-hash confirmation templates. Do not point production email links at localhost.

Supabase's built-in email service has provider restrictions and low rate limits. Check the current project's email-provider settings and delivery logs before testing. Custom SMTP may be needed for unrestricted signups; no paid email provider was purchased or configured. Do not disable confirmation just to label a failing production journey complete.

## Vercel LifeHQ project

Import `IntelliCoder-AI/LifeHQ-and-CipherVault`, choose Next.js, and set **Root Directory** to `apps/lifehq`. Include source outside the root directory for the shared workspace packages. Use the repository's root npm lockfile and normal workspace install (`npm ci` at the monorepo root), with `npm run build` in `apps/lifehq`. The checked-in `apps/lifehq/vercel.json` sets the root install command to `cd ../.. && npm ci`. Do not use the root build command for the LifeHQ deployment; that would also build the local vault unnecessarily. Choose Node 22 or 24.

Set these environment variables for the appropriate deployment targets:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project API URL from Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project publishable key; never a secret/service-role key |
| `NEXT_PUBLIC_APP_URL` | Exact production LifeHQ origin |
| `NEXT_PUBLIC_VAULT_URL` | Omit for cloud LifeHQ while the vault stays local |

Redeploy after build-time `NEXT_PUBLIC_*` changes. `.env.local` is gitignored; `.env.example` contains placeholders only. The app does not require Supabase admin credentials, a Vercel token, or any AI key at runtime. Preview callbacks use Vercel's preview origin; the origin still needs Supabase allowlisting.

If Git linking is rejected, authorize the Vercel GitHub integration for this repository, or deploy the same reviewed source using an authenticated CLI/file-upload workflow. Do not change repository visibility or upgrade the plan to work around access failures.

## Verify a hosted release

1. Wait for deployment READY. Visit the public `/login` and `/demo` URLs without a protection bypass; verify CSP and responsive navigation.
2. Register a new test user, receive and follow the actual confirmation email, and sign in. Test a separate user in a different browser context.
3. Create/edit/reload a task, project, habit check-in, note, and goal. Verify saved data and dashboard agreement.
4. Change preferences, sign out, return, and verify preferences persist. Test password recovery through the actual delivered link.
5. Check guessed IDs and cross-owner references using the second user's authenticated requests. Expect no foreign records and rejected associations.
6. Export the disposable account's data, then use the account's own confirmed deletion flow. Do not delete unrelated existing user accounts.

The managed environment blocks direct access to both `lifehq-radhe12.vercel.app` and `vcxxhpglhfkdxliwieao.supabase.co`. The user cannot modify that policy. Run live browser/auth checks from an unrestricted local machine, or have the environment administrator allow those hosts. The Supabase connector can apply SQL but does not configure Auth URL settings or provide an email inbox. Those limits are not evidence of a product test passing.

## CipherVault

Keep it on localhost at a different port/origin for this delivery. It needs no Supabase project or runtime secrets. Run `npm run dev:vault`, or after `npm run build` run `npm run start -w @lifehq/vault`.

Publishing the prototype's code would still serve a sensitive unlock interface; the supplied specification requires explicit approval before deploying sensitive functionality. Any later approved publication must use a distinct HTTPS origin and retain the dummy-only, unaudited warnings. Hosting it does not add synchronization: encrypted data remains in that browser. Do not colocate it as `/vault` under LifeHQ, embed it in an iframe, add analytics, or share auth/storage. Independent security review is required before real credentials.
