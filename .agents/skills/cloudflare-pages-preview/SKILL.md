---
name: cloudflare-pages-preview
description: Publish a single self-contained rig review page to the approved Cloudflare Pages project, then replace it without the lane marker.
---

# Cloudflare Pages preview

Use this routine only for the S01E04 digest preview. The approved project is `rig-morning-digest-preview-20261125-f6k3`; its public production URL is `https://rig-morning-digest-preview-20261125-f6k3.pages.dev/`. The project is on Cloudflare Pages Free. Anyone can open the URL after a deployment.

Do not use the project name `rig-morning-digest-preview`: its base `pages.dev` URL serves an existing digest page that is not in the signed-in account's deployment list.

## Requirements

- Node.js 22.12 or newer and Wrangler 4.168.0.
- The human owns the Cloudflare account and signs in with Wrangler. Use only `account:read` and `pages:write`; store credentials in the OS keychain with `--use-keyring`. Never put credentials in the repository or chat.
- The human must separately approve the marked upload and the later unmarked overwrite. Before each, state the file, URL, public visibility, reason, and how the change will be undone.
- Keep the exported HTML in a temporary directory outside the repository. Never commit the preview or `.env`, or attach a preview to an issue or chat message.

## Export and publish

Start rig with the approved `.env` and save the route as a single file; do not use a browser's “save as”. Check that the file contains the lane banner and no client script. After the human approves publication, upload the directory to the production branch:

```sh
preview_dir="$(mktemp -d)"
curl --fail --location http://localhost:8787/digest/2026-10-28 --output "$preview_dir/index.html"
npx --yes --registry=https://registry.npmjs.org wrangler@4.168.0 pages deploy "$preview_dir" --project-name rig-morning-digest-preview-20261125-f6k3 --branch main
```

Use the production URL above for review, not the unique deployment URL. Record the deployment ID from:

```sh
npx --yes --registry=https://registry.npmjs.org wrangler@4.168.0 pages deployment list --project-name rig-morning-digest-preview-20261125-f6k3 --environment production --json
```

## Replace the marker

After review and a separate human approval, render the same route with `LANE_MARKER` unset so the banner reads `no marker set` into a new temporary directory, then run the same deploy command and project. Verify the production URL no longer shows the marker. If the marked deployment's unique URL must also be removed, delete only that recorded deployment after the clean deployment is live:

```sh
npx --yes --registry=https://registry.npmjs.org wrangler@4.168.0 pages deployment delete <marked-deployment-id> --project-name rig-morning-digest-preview-20261125-f6k3 --force
```

Verify the old unique URL is no longer available. Do not delete the Pages project or any other deployment as part of this routine.
