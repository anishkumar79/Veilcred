# Level 4 Submission Checklist

- [x] Contract written (`contracts/veilcred.compact`) with privacy model
      documented in-file
- [ ] Contract compiled with `compact compile` — **run locally**, requires
      the Compact CLI, not available in this build environment
- [x] Tests written and passing (8/8, `npm test`)
- [x] Frontend built and wired to a contract-interaction layer
      (`npm run build` — zero errors)
- [x] Lint clean (`npm run lint` — 0 warnings, 0 errors)
- [ ] Contract deployed to Preprod — **run locally**, needs your wallet/CLI
- [ ] Contract address added to README.md — **mandatory**, do this right
      after deploying
- [ ] Frontend deployed (Vercel/Netlify) and live link added to README.md
- [x] CI/CD workflow created (`.github/workflows/ci.yml`)
- [ ] CI badge confirmed passing after first push (badge URL already in
      README — update `YOUR_GITHUB_USERNAME`)
- [x] `docs/USAGE.md` written
- [x] File structure matches the Level 4 spec
- [ ] Product X account created, 3 tweets posted (drafts in
      `docs/LAUNCH_TWEETS.md`), link added to README
- [ ] Demo video recorded
- [ ] 15+ meaningful commits made
- [ ] Repo pushed and submitted on Rise In

## What's left for you to do manually

1. Install the Compact CLI and run:
   ```
   compact compile contracts/veilcred.compact managed/veilcred
   ```
   Fix any stdlib naming drift the compiler flags — `persistentHash`,
   `verifySig`, and `concat` signatures are based on current Compact
   documentation patterns but should be checked against your installed
   compiler version.
2. Deploy to Preprod and paste the contract address into `README.md`.
3. `npm run build`, deploy the `dist/` folder to Vercel or Netlify, add the
   live URL to `README.md`.
4. Push this repo to GitHub as `YOUR_GITHUB_USERNAME/veilcred`, update the
   CI badge URL in `README.md` to match, confirm the Actions tab shows a
   green run.
5. Create the product's X account, post the three drafted tweets (fill in
   the demo/GitHub links), add the profile link to `README.md`.
6. Record a short demo video walking through: connect wallet → fill
   credential form → generate proof → see the public ledger update with
   only a nullifier + boolean.
7. Make your commits meaningful and incremental rather than one giant
   commit — e.g. contract, then tests, then frontend components, then CI,
   then docs, is already a natural 5+ commit shape from this codebase.
<!-- Checklist updates -->
