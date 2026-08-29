# Catechism Time deployment runbook

## Architecture and rationale

Catechism Time is a static Vite application, so nginx serves the verified build directly without Docker, a runtime process, or an application port.

The production hostname is `catechism.kylelynch.us`.

The server root is `/srv/catechism-review-kids`, immutable releases live under `releases/<git-sha>`, and nginx reads the atomic `current` symlink.

The workflow is manual-only and cannot deploy until the one-time server setup, DNS, TLS, and repository secrets are complete.

## One-time root setup

The restricted deployment user already exists.

Run these commands as root on the droplet after replacing `DEPLOY_USER` with that existing account.

```bash
set -euo pipefail
install -d -m 755 /srv/catechism-review-kids/releases
chown -R DEPLOY_USER:DEPLOY_USER /srv/catechism-review-kids
```

The live wildcard Cloudflare Origin CA certificate and private key already exist at `/etc/ssl/cloudflare/kylelynch-cert.pem` and `/etc/ssl/cloudflare/kylelynch-key.pem`.

Do not create, replace, or move those certificate files for this application.

Verify that the existing certificate covers `catechism.kylelynch.us`, that nginx can read the certificate, and that only root can read the private key.

```bash
set -euo pipefail
openssl x509 -in /etc/ssl/cloudflare/kylelynch-cert.pem -noout -subject -issuer -dates -ext subjectAltName
namei -l /etc/ssl/cloudflare/kylelynch-cert.pem
namei -l /etc/ssl/cloudflare/kylelynch-key.pem
stat -c '%U:%G %a %n' /etc/ssl/cloudflare/kylelynch-cert.pem /etc/ssl/cloudflare/kylelynch-key.pem
test "$(stat -c '%U:%G %a' /etc/ssl/cloudflare/kylelynch-key.pem)" = 'root:root 600'
```

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

The workflow installs with `npm ci`, installs Playwright Chromium, runs the complete `npm run verify`, packages `dist`, uploads a 14-day audit artifact, copies `dist` into `releases/<sha>`, checks the uploaded SHA-256 manifest and referenced assets, and then atomically switches `current`.

After the switch, the workflow requests the real application through local nginx with the production Host and SNI, checks stable HTML markers, requests a referenced hashed asset, and checks `/healthz` as a supplement.

Any failed post-switch application check atomically restores the validated prior symlink, or removes `current` when no prior release existed, before the workflow fails.

Only a successful application check permits pruning, and pruning retains the five newest releases plus a validated prior target when it falls outside that set.

The final origin check uses `curl --resolve` against `127.0.0.1` on the droplet, so it verifies nginx and `/healthz` before public DNS is available.

The origin check uses `--insecure` only because Cloudflare Origin CA certificates are intentionally not trusted by public operating-system CA bundles; Cloudflare still validates that certificate in Full strict mode.

## Rollback

List the retained releases and choose a known-good full SHA.

```bash
set -euo pipefail
cd /srv/catechism-review-kids
find releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn
sha="FULL_SHA"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
target="releases/$sha"
[[ -d "$target" && -s "$target/index.html" ]]
grep -q '<title>Catechism Time</title>' "$target/index.html"
temporary=".rollback-$sha"
rm -f -- "$temporary"
ln -s "$target" "$temporary"
mv -Tf "$temporary" current
html="$(curl --fail --silent --show-error --insecure \
  --resolve catechism.kylelynch.us:443:127.0.0.1 \
  https://catechism.kylelynch.us/)"
grep -q '<title>Catechism Time</title>' <<<"$html"
grep -q '<div id="root"></div>' <<<"$html"
asset="$(grep -oE '(src|href)="\./assets/[^"]+"' <<<"$html" | sed -E -n '1{s/^(src|href)="\.\///; s/"$//; p;}')"
[[ "$asset" =~ ^assets/[A-Za-z0-9._-]+$ ]]
curl --fail --silent --show-error --insecure --output /dev/null \
  --resolve catechism.kylelynch.us:443:127.0.0.1 \
  "https://catechism.kylelynch.us/$asset"
```

Verify the rolled-back app through local nginx with the application and asset checks below before ending the recovery session.

If verification fails, repeat the validated procedure with another retained full SHA or remove `current` only when intentionally taking the site out of service.

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
