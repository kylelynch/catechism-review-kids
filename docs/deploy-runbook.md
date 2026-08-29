# Catechism Time deployment runbook

## Architecture and rationale

Catechism Time is a static Vite application, so nginx serves the verified build directly without Docker, a runtime process, or an application port.

The production hostname is `catechism.kylelynch.us`.

The server root is `/srv/catechism-review-kids`, immutable releases live under `releases/<git-sha>`, and nginx reads the atomic `current` symlink.

The workflow is manual-only and cannot deploy until the one-time server setup, DNS, TLS, and repository secrets are complete.

## One-time root setup

Run these commands as root on the droplet after replacing `DEPLOY_USER` with the restricted SSH account used by GitHub Actions.

```bash
set -euo pipefail
apt-get update
apt-get install -y nginx rsync curl
install -d -m 755 /srv/catechism-review-kids/releases
chown -R DEPLOY_USER:DEPLOY_USER /srv/catechism-review-kids
install -d -m 700 /etc/ssl/cloudflare
```

Create a Cloudflare Origin CA wildcard certificate for `*.kylelynch.us` and `kylelynch.us`.

Install the certificate at `/etc/ssl/cloudflare/kylelynch.us.pem` with mode `0644` and its private key at `/etc/ssl/cloudflare/kylelynch.us.key` with owner `root:root` and mode `0600`.

Copy [deploy/nginx-catechism.conf](../deploy/nginx-catechism.conf) to `/etc/nginx/sites-available/catechism.kylelynch.us`.

The checked-in vhost contains the exact HTTP-to-HTTPS redirect, wildcard Cloudflare origin certificate paths, SPA fallback, `/healthz`, cache rules, and security headers expected by the current build.

The Content Security Policy permits only same-origin scripts, styles, fonts, and connections, plus `data:` images, which is compatible with the current generated `dist/index.html` and hashed assets.

Enable and validate the site with these commands.

```bash
set -euo pipefail
ln -s /etc/nginx/sites-available/catechism.kylelynch.us /etc/nginx/sites-enabled/catechism.kylelynch.us
nginx -t
systemctl reload nginx
```

The first reload can occur before a release exists, but normal page requests will return an error until `current` points to a verified release.

## Cloudflare and DNS

Create a proxied Cloudflare `A` record for `catechism.kylelynch.us` that targets the droplet IPv4 address.

Set Cloudflare SSL/TLS encryption mode to `Full (strict)` before public verification.

Keep the origin firewall limited to the expected SSH administration path and Cloudflare HTTP/HTTPS source ranges according to the droplet's existing policy.

## GitHub Actions secrets

Create `DROPLET_HOST` with the droplet host or IP address.

Create `DROPLET_USER` with the restricted deployment account.

Create `DROPLET_SSH_KEY` with that account's private deployment key.

Create `DROPLET_KNOWN_HOSTS` from a host key verified through a trusted out-of-band source.

The workflow deliberately never runs `ssh-keyscan` and fails before deployment when any required secret is empty.

The workflow uses `actions/checkout` v4.2.2 at commit `11bd71901bbe5b1630ceea73d27597364c9af683`, `actions/setup-node` v4.4.0 at commit `49933ea5288caeca8642d1e84afbd3f7d6820020`, and `actions/upload-artifact` v4.6.2 at commit `ea165f8d65b6e75b540449e92b4886f43607fa02`.

## Deploy

Open GitHub Actions, select `Deploy Catechism Time to droplet`, and run the workflow manually against `main`.

The workflow installs with `npm ci`, installs Playwright Chromium, runs the complete `npm run verify`, packages `dist`, uploads a 14-day audit artifact, copies `dist` into `releases/<sha>`, verifies the uploaded index, atomically switches `current`, and retains the five newest validated SHA release directories.

The final origin check uses `curl --resolve` against `127.0.0.1` on the droplet, so it verifies nginx and `/healthz` before public DNS is available.

The origin check uses `--insecure` only because Cloudflare Origin CA certificates are intentionally not trusted by public operating-system CA bundles; Cloudflare still validates that certificate in Full strict mode.

## Rollback

List the retained releases and choose a known-good full SHA.

```bash
set -euo pipefail
cd /srv/catechism-review-kids
find releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn
test -s "releases/FULL_SHA/index.html"
ln -s "releases/FULL_SHA" ".current-FULL_SHA"
mv -Tf ".current-FULL_SHA" current
```

Rollback is immediate because nginx resolves the new symlink without a reload.

## Verification

Verify the origin locally on the droplet before DNS with this command.

```bash
curl --fail --silent --show-error --insecure \
  --resolve catechism.kylelynch.us:443:127.0.0.1 \
  https://catechism.kylelynch.us/healthz
```

After DNS propagates, verify `https://catechism.kylelynch.us/healthz`, load the application in a private browser window, start a session, test Space, Right Arrow, Left Arrow, and Escape, and inspect response headers for the CSP and cache policies.

Confirm `index.html` returns `Cache-Control: no-cache, no-store, must-revalidate` and hashed files under `/assets/` return `Cache-Control: public, max-age=31536000, immutable`.

Do not run the deployment workflow until nginx, the certificate, the deployment account, and all four GitHub Actions secrets are ready.
