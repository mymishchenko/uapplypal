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

## 3. Start the app (adm.tools → Мої сайти → site → Налаштування веб-застосунку)

1. **Проксування HTTP-трафіку в застосунок** (HTTP proxy): switch it on and note the IP
   (`127.x.x.x`) and port it shows (default `3000`).
2. **Налаштування запуску застосунку** (launch settings):
   - Каталог запуску (launch directory): the site root, e.g. `/home/<account>/uapplypal.com/www/`. This is `REMOTE_PATH` below.
   - Команда запуску (launch command):
     `/usr/local/node22/bin/node server.js --host <IP> --port <PORT>`
   - Click **Зберегти** (Save), then start the app. The status should change to running.
3. If it doesn't start, open the log file linked on that page.

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

The app has no login: anyone with the link can open it and change its data. Don't store sensitive
personal details in it (passport numbers, date of birth).

In the **Variables** tab, add `REMOTE_NODE_BIN` if `npm` isn't found during deploy. Its value is the folder
holding `node` and `npm` on the server. To find it, SSH in and run `dirname "$(which node)"`.

Each deploy restarts the app automatically. It stops the running `node server.js`, and Hosting
Ukraine's Node.js supervisor starts it again with the new code. To use a different restart,
set the `RESTART_COMMAND` variable in the **Variables** tab.

Then delete the private key from your computer, or keep it somewhere safe.

## 5b. Turn on the AI assistant

1. Create an API key at https://console.anthropic.com → **API keys**. It starts with `sk-ant-`.
2. In **Billing → Limits**, set a monthly spend limit (e.g. $20). The site has no login, so this is your safety net.
3. Add it in GitHub as the repository secret **`ANTHROPIC_API_KEY`**. Paste only the key, one line.
4. Deploy (merge to `main`, or Actions → Test & Deploy → Run workflow). The deploy writes it to `.env` on the server.

The assistant uses Claude Opus 5.5. Usage is capped at 30 messages per visitor per hour and 150 per day;
change this with `ASSISTANT_HOURLY_LIMIT` / `ASSISTANT_DAILY_LIMIT` in `.env`.

## 6. Deploy

Merge anything into `main`, or go to **Actions → Test & Deploy → Run workflow**.
To check the deploy, open `https://<your-domain>/api/health`. It should show the commit that was deployed.

Your own data (profile, statuses, verifications) is saved on the server in `data/runtime/store.json`.
Deploys never overwrite or delete it. To back it up, copy that file over SSH.

## Working with Claude Code

- Ask Claude Code for a change. It commits to a branch and pushes it, and GitHub Actions runs the tests.
- Open a pull request and merge it into `main` to put the change live.
- Secrets stay in GitHub. Claude Code never needs your hosting password or SSH key.
