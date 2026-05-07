# Vercel PR previews

This project is configured as a Vite static app for Vercel. Once the GitHub repo is connected to Vercel, every pull request gets a unique Preview Deployment URL before changes merge to `main`.

## One-time Vercel setup

1. In Vercel, import `noahweiss3/dilution-model`.
2. Use the default settings from `vercel.json`:
   - Framework: Vite
   - Install: `npm ci`
   - Build: `npm run build`
   - Output: `dist`
3. Set **Production Branch** to `main`.
4. Keep Vercel GitHub comments/checks enabled so each PR shows its preview URL.
5. Add optional environment variables in Vercel if needed:
   - `VITE_CLERK_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Workflow

1. Open a PR from any branch into `main`.
2. Vercel creates a Preview Deployment and posts the URL/check on the PR.
3. Review the preview URL and GitHub checks.
4. Merge to `main` only after approval; Vercel then promotes/builds the Production Deployment from `main`.

## GitHub branch protection recommendation

In GitHub repo settings, protect `main` and require these before merge:

- Pull request review, if desired.
- Vercel Preview Deployment check.
- Local CI checks such as tests/build, if configured.

Do not add secrets to `vercel.json` or committed `.env` files.
