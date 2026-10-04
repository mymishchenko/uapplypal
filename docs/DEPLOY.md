# Deploying uapplypal to Hosting Ukraine

How it fits together:

```
Claude Code ──push──▶ GitHub ──merge to main──▶ GitHub Actions ──SSH/rsync──▶ Hosting Ukraine ◀── your domain
```

Every push runs the tests. A merge to `main` deploys the code to your hosting over SSH.
These are one-time steps. They happen in the adm.tools panel and on GitHub.

## 1. Check your plan supports Node.js

On Hosting Ukraine, Node.js runs only on **Business hosting** plans.
If you have a basic shared plan, either upgrade or ask Claude to rewrite the backend in PHP
(the deploy pipeline stays almost the same).

## 2. Attach the domain and turn on HTTPS (adm.tools)

1. **Hosting → Sites → Add site**: enter your domain. The domain was bought from Hosting Ukraine,
   so its DNS already points at their servers and you don't need to change any DNS records.
2. In the site's settings, turn on the free **Let's Encrypt SSL** certificate and force HTTPS.

## 3. Switch the site to Node.js (adm.tools)

1. Site settings → **Web server**: choose **Node.js**, version 20 or newer (22 recommended).
2. Startup file / command: `server.js` (or `npm start`).
3. The panel gives the site a local IP (`127.x.x.x`) and a port (default `3000`).
   If they differ from the defaults, set environment variables `HOST` and `PORT` to match.
   `server.js` reads both.
4. Note the site's **root directory** (usually `/home/<account>/<domain>/www`). This is `REMOTE_PATH` below.

## 4. Create an SSH key for GitHub to use

Run this on your own computer:

```bash
ssh-keygen -t rsa -b 4096 -m PEM -f uapplypal_deploy -N ""
```

This creates `uapplypal_deploy` (private key) and `uapplypal_deploy.pub` (public key).

In adm.tools, go to **SSH keys → Add key**, paste the contents of `uapplypal_deploy.pub`,
and **bind the key to your hosting account**. Write down the SSH **host**, **login** and **port**
shown on the hosting account's SSH access page.

If SSH access has an IP allow-list, allow all IPs for this key, because GitHub's runners change IP.

## 5. Add GitHub secrets

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret        | Value                                                        |
|---------------|--------------------------------------------------------------|
| `REMOTE_HOST` | SSH host from step 4                                         |
| `REMOTE_USER` | SSH login from step 4                                        |
| `REMOTE_PORT` | SSH port (only needed if it isn't 22)                        |
| `REMOTE_PATH` | site root directory from step 3, e.g. `/home/abc123/example.com/www` |
| `REMOTE_KEY`  | the whole contents of the private key file `uapplypal_deploy` |
| `APP_PASSWORD` | password for opening the app in the browser (letters and digits, 16+ characters) |

The app holds personal data, so it is password-protected. The browser asks for a username and
password: type anything as the username and `APP_PASSWORD` as the password. Each deploy writes
the password to `.env` on the server. Without it, the site answers "UApplyPal is locked".

In the **Variables** tab, add `REMOTE_NODE_BIN` if `npm` isn't found during deploy. Its value is the folder
holding `node` and `npm` on the server. To find it, SSH in and run `dirname "$(which node)"`.

Optional: in the **Variables** tab, add `RESTART_COMMAND`. This is a shell command that restarts
the Node app after each deploy, if Hosting Ukraine gives you one. Without it, restart the site
from adm.tools after a deploy.

Then delete the private key from your computer, or keep it somewhere safe.

## 6. Deploy

Merge anything into `main`, or go to **Actions → Test & Deploy → Run workflow**.
To check the deploy, open `https://<your-domain>/api/health`. It should show the commit that was deployed.

Your own data (profile, statuses, verifications) is saved on the server in `data/runtime/store.json`.
Deploys never overwrite or delete it. To back it up, copy that file over SSH.

## Working with Claude Code

- Ask Claude Code for a change. It commits to a branch and pushes it, and GitHub Actions runs the tests.
- Open a pull request and merge it into `main` to put the change live.
- Secrets stay in GitHub. Claude Code never needs your hosting password or SSH key.
