# Morrow Mortgage Planner

A responsive, installable static PWA with a guided, first-run setup for exploring mortgage overpayments, projected loan-to-value (LTV), a recommended monthly overpayment, and the one-off cash amount that may be needed at remortgage. It prompts users through their own mortgage figures before revealing the planner.

## Publish on GitHub Pages (recommended: GitHub Actions)

This package includes a deployment workflow at `.github/workflows/deploy.yml` for the static website. No Node.js build, package installation, secrets, or backend is required.

1. Extract the ZIP and upload the **contents** of the `morrow-mortgage-planner` folder to the **root of your GitHub repository**. Make sure `index.html` is visible at the repository's top level, alongside `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js`, and the `icons` folder. Do not upload the outer folder as a nested directory.
2. Commit the files to your repository's default branch.
3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment → Source**, select **GitHub Actions** (not “Deploy from a branch”).
5. Open the **Actions** tab. A workflow named **Deploy Morrow to GitHub Pages** should run after the commit. Wait for the job to complete, then open the URL shown in the deployment job or in **Settings → Pages**.

The workflow automatically deploys when you push to the repository's default branch. It also supports manual runs from **Actions → Deploy Morrow to GitHub Pages → Run workflow**, as long as you select the default branch. It is intentionally configured not to publish non-default branches.

### If the workflow still fails

- **No “Deploy Morrow to GitHub Pages” workflow appears:** confirm `.github/workflows/deploy.yml` exists in the repository, exactly at that path, and has been committed to the default branch.
- **Deployment is denied or permissions fail:** open **Settings → Actions → General** and ensure the repository permits Actions to run. The workflow declares the `pages: write` and `id-token: write` permissions required by GitHub Pages deployment.
- **“Not Found” or artifact errors during deploy:** verify **Settings → Pages → Source** is set to **GitHub Actions** and inspect which workflow step failed in the Actions run.
- **A different workflow is failing:** open **Actions**, select the failed run, expand the red step, and read the first actual error message. If it is an older custom workflow in `.github/workflows/`, disable or correct that workflow so it does not conflict with this one.
- **Site deploys but displays a 404:** confirm `index.html` is at the repository root and use the published URL shown in the Pages settings; for a project repository, the URL generally includes `/<repository>/`.

For an alternative deployment method, remove/ignore the custom workflow and set **Settings → Pages → Source** to **Deploy from a branch**, then select your default branch and `/ (root)`. Do not mix this branch-source setup with instructions for a custom Actions workflow.

## Run locally

For a quick UI preview, open `index.html` in a browser. To test PWA service-worker/offline behaviour, serve the folder over localhost, for example:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## What it does

- Introductory overview followed by guided setup steps.
- No pre-filled personal mortgage figures; numeric fields start blank and prompt users to enter their own details.
- Editable balance, rate, regular payment, balance date, fixed-rate end date and target LTV.
- Large touch-friendly monthly overpayment, property valuation and cash top-up sliders.
- Responsive mobile planner layout with wrapping result values and no page-level horizontal scrolling. Setup step 3 uses a responsive LTV grid so every target can be tapped without horizontal swiping; the main planner's LTV strip remains independently swipeable.
- Direct number entry and plus/minus controls for monthly overpayment, expected property value and one-off cash top-up; the fields and sliders stay synchronised.
- LTV targets at 95%, 90%, 85%, 80%, 75%, 70%, 65%, and 60%, plus 59.5%, 59% and 58% safety-buffer targets.
- Estimated balance and LTV at the end of the current fix.
- Cash injection needed to reach the selected LTV, accounting for a cash amount already planned.
- Recommended monthly overpayment to reach the selected LTV without a lump sum.
- Comparison across valuation scenarios at 5% below, at, and 5% above the user's estimate.
- Practical money tips, calculation notes, local settings persistence and offline app shell.

## Assumptions and limitations

This is an educational estimator, not financial advice or a lender quote. It uses a monthly-rate approximation and a standard amortisation formula, assumes one payment on the first of each month after the entered balance date and before the fixed-rate end date, and does not include fees, early-repayment charges, future rates, or lender-specific product rules. Actual mortgage interest is often calculated daily and may result in a different balance. Confirm the figures, overpayment allowance, valuation and LTV eligibility with your lender or mortgage adviser.

The values entered into the planner are saved in the browser's local storage on that device, if available. No backend, analytics, advertising, or third-party services are included. Once a user builds a plan, their entries can be saved locally in the browser for the next visit. The “Clear plan & start again” action removes saved planner settings and returns to the blank welcome flow. The service worker cache is versioned (currently v5) so updated app files replace the previous offline shell. No account or backend is required.

## Files

- `.github/workflows/deploy.yml` — deployment workflow for GitHub Pages
- `index.html` — page structure
- `styles.css` — responsive sage/mint UI
- `app.js` — mortgage calculations, controls and local persistence
- `manifest.webmanifest` — install metadata
- `sw.js` — offline app-shell cache
- `icons/` — app icons
