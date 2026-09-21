# Cinematic Play — Codex backend

Private backend for **https://apirak09.github.io/frontia/**.

It launches the official `codex app-server` as a child process, talks to it over its documented JSON-RPC stdio transport, uses the documented ChatGPT device-code login flow, and keeps Codex credentials on the server volume rather than in browser JavaScript.

## Recommended free host: Oracle Cloud Always Free VM

The backend needs a persistent process **and persistent disk** because Codex stores its login cache under `CODEX_HOME`. Static GitHub Pages cannot do this.

Use an Ubuntu Always Free VM. In its OCI Security List/NSG allow inbound TCP **22, 80, 443**.

Then SSH into the VM:

```bash
git clone https://github.com/apirak09/apirak09.github.io.git
cd apirak09.github.io/frontia-backend
sudo bash deploy-oracle.sh
```

The script:
- installs Docker,
- builds this backend,
- creates persistent Docker volumes for Codex credentials/workspace,
- generates a random private app password,
- derives a free HTTPS hostname from the VM public IP using nip.io,
- puts Caddy in front for automatic TLS.

At the end it prints:
- `Backend URL`
- `Private app password`

Enter both in **Cinematic Play → Settings**, press **Test backend**, then **Connect ChatGPT**.

## Security

- Never commit `~/.codex/auth.json`. It contains access tokens.
- Keep the generated app password private.
- OAuth tokens remain inside the backend's persistent Docker volume.
- Frontend origin is restricted to `https://apirak09.github.io` (plus localhost for development).
- The roleplay prompt tells Codex not to use tools; the backend uses a dedicated empty workspace.

## Health

```bash
curl https://YOUR-BACKEND/health
```

Expected:

```json
{"ok":true,"codexHome":true}
```

## Update

```bash
cd ~/apirak09.github.io
git pull
cd frontia-backend
sudo docker compose up -d --build
```
