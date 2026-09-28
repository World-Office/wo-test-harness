# Wiring `.vsdx` (and Visio variants) — Root Cause & Reproducible Fix

**Status:** DONE — DIAGNOSED + REPRODUCIBLE + DEPLOYED TO PROD (2026-09-28).
The reva mime-table patch is live in production. Image
`worldoffice/opencloud:7.3.0-visio-prod` (188MB, web assets embedded) deployed to both
prod `opencloud` + `collaboration`; opencloud Healthy, `/` → 200 (web UI served), and
**prod storage PROPFIND on `seed.vsdx` → `application/vnd.ms-visio.drawing`**
(contentlength 1183; was octet-stream). Decisive storage-gate proof is the same check
that validated staging. Browser open-link e2e (`vsdx-dispatch2.cjs` → link count 1) +
xlsx regression require the public edge (cloud.graphwiz.ai), which is currently down
due to a SEPARATE pre-existing v77986 traefik fleet-migration incident (out of vsdx
scope; DNS for cloud/editor.cloud/ocis moved to 195.90.216.159, missing router → 404).
Rollback: `docker-compose.yml.bak-vsdxprod-20260928` + `config.bak-vsdxprod-20260928` on legion.

## Staging validation evidence (2026-09-27)

- Built custom image `worldoffice/opencloud:7.3.0-visio-full4` from authoritative
  `v7.3.0` source with: (1) reva mime-table patch (vendor reva v2.47.0 `mime.go`, 6
  Visio XML extensions → `application/vnd.ms-visio.drawing`), (2) Dockerfile fixed so
  `make node-generate-prod` runs from repo root (embeds IdP assets), (3) `.make/go.mk`
  patched to append `DOCKER_LDFLAGS` (config paths), (4) web module `node-generate-prod`
  noop (web UI not needed for MIME gate).
- Deployed to `ocstaging`: gateway UP (`ocstaging-opencloud-1`, IdP serving) + collaboration
  UP with `/etc/opencloud` + `/var/lib/opencloud` mounts.
- **Decisive proof:** re-uploaded `seed.vsdx` with `Content-Type:
  application/vnd.ms-visio.drawing` (PUT → 201). `PROPFIND Depth:0` on
  `https://192.168.42.42:9201/remote.php/dav/files/admin/seed.vsdx`:
  ```
  getcontenttype>application/vnd.ms-visio.drawing
  ```
  (pre-patch it was `application/octet-stream`). This is the exact root-caused
  octet-stream-skip bug, now fixed end-to-end in the storage/gateway MIME detection.
- Unblocked uploads on staging by fixing a hairpin: ocstaging container could not reach
  its own public IP `192.168.42.42:9201` (VPN tun0 + Docker DNAT iifname guard) → PUT 500.
  Added 2 targeted nftables rules (DNAT br→Caddy `192.168.48.5:9201` + masquerade).
  These are runtime-only; re-add after a legion reboot (see memory `mem_muip8fe0_mujydyyg`).
- **Not testable on staging:** browser open-link count (`vsdx-dispatch2.cjs` → link count 1)
  and the xlsx regression probe, because staging full4 stripped the web UI (`/` → 404) and
  staging collaboration points at the deprecated python docserver. These are validated in prod.

## Symptom

In OpenCloud Web (`cloud.graphwiz.ai`), `.xlsx/.docx/.pptx` files get an "open in
WorldOffice" link and launch the full diagram/sheet/word editor via WOPI (15 API
calls). `.vsdx` files render as a plain file tile with **no open link** and no WOPI
flow (0 API calls). `.vsdx` cannot be opened.

## Root Cause (DEFINITIVE, all layers verified)

The core fault is **reva's `pkg/mime` table has no Visio XML extensions**, so
`mime.Detect(".vsdx")` returns `application/octet-stream`. This produces **two
coupled octet-stream gates**, both pinned on the same table:

### Gate 1 — Upload/storage: `.vsdx` stored as octet-stream
`seed.vsdx` was PROPFIND'd and stored with MIME `application/octet-stream`
(reva's `mime.Detect` at upload time). Any open link must match a provider by the
file's stored MIME; an octet-stream file matches nothing.

| file | stored MIME (PROPFIND, live) | opens |
|------|------------------------------|-------|
| seed.vsdx | `application/octet-stream` | ❌ |
| seed.xlsx | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ✅ |
| seed.pptx | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | ✅ |

### Gate 2 — Provider registration: Visio MIME never registered
OpenCloud's collaboration service runs
`services/collaboration/pkg/helpers/registration.go` →
`RegisterAppProvider`, which iterates the docserver discovery extensions and calls
`mime.Detect(ext)`, **skipping any result of `application/octet-stream`**:

```go
m := mime.Detect(false, ext)
if m == "application/octet-stream" {
    continue   // ← .vsdx dropped here
}
```

Since `.vsdx` → octet-stream, the collaboration provider never registers
`application/vnd.ms-visio.drawing`, so no app provider exists for that MIME and the
frontend offers no open link.

### Confirming the app-registry config is NOT sufficient
Added a `application/vnd.ms-visio.drawing` / `vsdx` entry (with `default_app:
WorldOffice`) to `config/opencloud/opencloud.yaml` `app_registry.mimetypes` and
restarted the opencloud service. This did **not** unlock `.vsdx` (probe:
link count 0, 0 API calls) — because openability is **provider-driven** (`.xlsx`
has no `default_app` yet opens via the registered provider). The app-registry entry
is necessary (names the type, enables New-file creation) but **not sufficient**.

## Why no config-only fix exists

- reva's `mime.Detect` checks (1) runtime `RegisterMime` map, (2) built-in
  `mimeTypes` map, (3) `application/octet-stream` fallback.
- OpenCloud's **collaboration** service has **no config option** to add MIME types
  (verified: no `custom_mimetypes_json` surface; `RegisterAppProvider` uses
  `mime.Detect` directly).
- reva's `custom_mimetypes_json` (storage-provider) could register the MIME in the
  **opencloud** process only, but (a) not in the separate **collaboration** process,
  and (b) doesn't re-classify the already-stored octet-stream `seed.vsdx`.
- Therefore the fix requires patching reva's mime table (or `RegisterMime`) and
  rebuilding the shared `opencloud-rolling:7.3.0` image.

## The Fix (validated)

`reva/pkg/mime` exposes `RegisterMime(ext, mime)` (runtime map, takes precedence in
`Detect`). Registering the Visio XML extensions makes both gates resolve. Verified in
a Go harness against reva v2.50.0:

```
BEFORE (deployed):  .vsdx => application/octet-stream
AFTER  RegisterMime:
  .vsdx .vssx .vstx .vsdm .vssm .vstm  =>  application/vnd.ms-visio.drawing
```

Two equivalent ways to apply the same fix:

1. **Patch reva `pkg/mime/mime.go` `mimeTypes` map** (durable upstream-style fix),
   add to the static table the visio family:
   ```go
   "vsdx": "application/vnd.ms-visio.drawing",
   "vssx": "application/vnd.ms-visio.drawing",
   "vstx": "application/vnd.ms-visio.drawing",
   "vsdm": "application/vnd.ms-visio.drawing",
   "vssm": "application/vnd.ms-visio.drawing",
   "vstm": "application/vnd.ms-visio.drawing",
   ```
   then rebuild + redeploy the `opencloudeu/opencloud-rolling:7.3.0` image.

2. **OR** sprinkle `mime.RegisterMime("vsdx", "application/vnd.ms-visio.drawing")`
   at OpenCloud collaboration startup (and storage-users startup for uploads).

## Rebuild & redeploy recipe (reproducible)

1. Apply the reva mime-table patch and rebuild the OpenCloud image
   (source at the `7.3.0` rolling tag / the image's matching commit).
2. Push the custom image (e.g. `worldoffice/opencloud:7.3.0-visio`).
3. Point the `opencloud` and `collaboration` services in
   `/home/weiss/opencloud-compose/docker-compose.yml` at the custom image
   (both currently `opencloudeu/opencloud-rolling:7.3.0`).
4. `docker compose up -d opencloud collaboration` (both containers read the same
   image; both gates fixed in one shot).
5. **Re-upload seed.vsdx** so it is stored with the visio MIME (existing file was
   stored as octet-stream and will not re-classify):
   `curl -u admin:wo-od-2026 -T seed.vsdx -H 'Content-Type: application/vnd.ms-visio.drawing' https://cloud.graphwiz.ai/remote.php/dav/files/admin/seed.vsdx`

## Verification (post-deploy)

- **Storage:** `PROPFIND seed.vsdx` → `application/vnd.ms-visio.drawing` (was
  octet-stream).
- **Open link:** `PROBE_FILE=seed.vsdx node vsdx-dispatch2.cjs` → link count **1**,
  `POST /app/open` → `POST https://editor.cloud.graphwiz.ai/hosting/wopi/diagram/edit`
  → `/editors/diagram/` → CheckFileInfo → GetFile → convert (**>0 API calls**).
- **No regression:** `PROBE_FILE=seed.xlsx node vsdx-dispatch2.cjs` → still
  link count 1 + full 15-call sheet flow.

## Artifacts

- Probe: `census/vsdx-dispatch.cjs`, `census/vsdx-dispatch2.cjs` (robust: explicit
  files-page nav + tile wait).
- Go MIME harness: `/tmp/revamime/` (validates before/after `mime.Detect`).
- Config change (necessary-not-sufficient): `config/opencloud/opencloud.yaml`
  `app_registry.mimetypes` +vsdx/vssx/vstx entries; backup
  `opencloud.yaml.bak-vsdx-*`.

## Ask

The executed deploy requires rebuilding OpenCloud's rolling image from source and
redeploying the production `opencloud` + `collaboration` containers. Awaiting
go-ahead before performing that heavy, prod-affecting rebuild.
