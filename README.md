# Morrow Mortgage Planner

A responsive, installable static PWA with a guided, first-run setup for exploring mortgage overpayments, projected loan-to-value (LTV), a recommended monthly overpayment, and the one-off cash amount that may be needed at remortgage. It opens with an overview and prompts users through their own mortgage figures before revealing the planner.

## Run locally

Open `index.html` for a quick UI preview. For service-worker/offline testing, serve the folder over localhost, for example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a new GitHub repository, for example `morrow-mortgage-planner`.
2. Upload all files and the `icons` folder from this project to the repository root. Keep the relative paths intact.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, select your default branch (often `main`) and the `/ (root)` folder, then save.
5. Open the published `https://<your-user>.github.io/<repository>/` URL. The install prompt and offline caching require HTTPS (GitHub Pages provides HTTPS) or localhost.
6. On mobile, open the published URL in the browser and use **Add to Home Screen** / **Install app** if your browser offers it.

The app is designed for both a user site (`https://<user>.github.io/`) and a project site (`https://<user>.github.io/<repository>/`) by using relative paths.

## What it does

- Introductory overview followed by four guided setup steps.
- No pre-filled personal mortgage figures; numeric fields start blank and prompt the user to enter their own details.
- Editable balance, rate, regular payment, balance date and fixed-rate end date.
- Large touch-friendly monthly overpayment, property valuation and cash top-up sliders.
- Horizontally scrollable LTV targets from 95%, 90%, 85%, 80%, 75%, 70%, 65% and 60%, plus 59.5%, 59% and 58% safety-buffer targets.
- Direct numeric editing with plus/minus controls for monthly overpayment, expected property value and one-off cash top-up; slider and numeric controls stay synchronised.
- Estimated balance and LTV at the end of the current fix.
- Cash injection needed to reach the selected LTV, accounting for a cash amount already planned.
- Recommended monthly overpayment to reach the selected LTV without a lump sum.
- Comparison across valuation scenarios at 5% below, at, and 5% above the user's estimate.
- Practical money tips, calculation notes, local settings persistence and offline app shell.

## Assumptions and limitations

This is an educational estimator, not financial advice or a lender quote. It uses a monthly-rate approximation and a standard amortisation formula, assumes one payment on the first of each month after the entered balance date and before the fixed-rate end date, and does not include fees, early-repayment charges, future rates, or lender-specific product rules. Actual mortgage interest is often calculated daily and may result in a different balance. Confirm the figures, overpayment allowance, valuation and LTV eligibility with your lender or mortgage adviser.

The values entered into the planner are saved in the browser's local storage on that device, if available. No backend, analytics, advertising, or third-party services are included. The first setup uses generic illustrative copy only. Once a user builds a plan, their entries can be saved locally in the browser for the next visit. The “Clear plan & start again” action removes saved planner settings and returns to the blank welcome flow. No account or backend is required.

## Files

- `index.html` — page structure
- `styles.css` — responsive sage/mint UI
- `app.js` — mortgage calculations, controls and local persistence
- `manifest.webmanifest` — install metadata
- `sw.js` — offline app-shell cache
- `icons/` — app icons
