# Public sandbox deployment

The frontend is published at `https://kora-sandbox-linoxbt.netlify.app` and
proxies API paths to `https://kora-api.13-140-188-185.sslip.io`. The API, worker,
and PostgreSQL run on the Kora host with `compose.public.yaml`. The database is
stored in the `kora-public-postgres` Docker volume. All funds and providers in
this deployment are simulated.

## Host configuration

Create an ignored, mode `600` `.env.public` at the repository root. Set
`KORA_PUBLIC_DB_PASSWORD` to a unique random password; set
`KORA_WEBHOOK_ENCRYPTION_KEY` and `KORA_PROVIDER_CALLBACK_SECRET` to independent
random secrets. Set `KORA_CONSOLE_ORIGINS` to the exact Netlify HTTPS origin.
Keep `KORA_MODE=sandbox`, and leave `PAYSTACK_SECRET_KEY` blank for the simulator.
Never commit this file. The Compose file supplies the internal `DATABASE_URL`.
Personal and Business email sign-in require `KORA_AUTH_SECRET`, `SMTP_HOST`,
`SMTP_PORT`, and `SMTP_FROM`; set `SMTP_USER` and `SMTP_PASS` when the SMTP
service requires authentication. Without these variables, both sign-in forms
fail closed and the existing Developer Sandbox remains available. The secret
must remain stable across API restarts because it authenticates outstanding
one-time codes. Use a delivery service and sender domain under Kora's control.

The HTTPS reverse proxy needs a host entry equivalent to:

```caddyfile
kora-api.13-140-188-185.sslip.io {
    encode gzip
    reverse_proxy 127.0.0.1:4312
}
```

The IP-dependent `sslip.io` hostname must be changed in both Caddy and
`netlify.toml` if the host IP changes. Docker binds port 4312 to loopback only.

## Start and update

```sh
docker compose --env-file .env.public -f compose.public.yaml up -d --build
docker compose --env-file .env.public -f compose.public.yaml ps
curl -fsS https://kora-api.13-140-188-185.sslip.io/health
```

The API applies database migrations before it starts. The worker starts after
the API is healthy. Deploy the frontend with the Netlify CLI or the connected
Git integration; the root `netlify.toml` provides the build command, publish
directory, and API proxy rules. Check `/console/session` on the Netlify origin
to confirm the proxy is active, then create a sandbox workspace in the browser.

Back up the `kora-public-postgres` volume before replacing the host or changing
database versions. The volume persists across Compose restarts and image updates,
but not across host loss.
