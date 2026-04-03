## Brave Blueprint Programme

From https://wiki.bravecollective.com/public/alliance/industry/bpcprogram

- Brave Alliance only
- 10 BPCs per request
  - Requests for multiple of the same BPC is at the discretion of the BPC manager.
- Only the BPCs on the list can be requested.
- Please only have one request active at a time
  - **Per person NOT per character**
- Capital hull BPCs are provided at one per month per person due to scarcity (and because if you need them, you're generally wealthy enough to be able to get them from contracts)
- The program operates only from "E3OI-U - Librarian"

Anything that is unreasonable will be rejected. And this is a sliding scale, arbitrary and utterly at the discretion of the BPC Managers. If they blink at the request, they’ll reject it.

## Building

```sh
docker build --output ./build --platform linux/arm64 .
```

This will produce a backend binary and frontend package in the build/ directory ready for upload to a server.

## Development

Create a development app at [developers.eveonline.com](https://developers.eveonline.com) with the callback URL `http://localhost:2727/login` and following scopes:

- esi-assets.read_corporation_assets.v1
- esi-corporations.read_blueprints.v1
- esi-industry.read_corporation_jobs.v1

Copy `backend/.env.example` to `backend/.env`, then fill in the EVE SSO values:

```sh
cp backend/.env.example backend/.env
```

On Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set these values in `backend/.env`:

```sh
ESI_APP_ID=<appid>
ESI_APP_SECRET=<secret>
ESI_APP_REDIRECT=http://localhost:2727/login
INITIAL_ALLIANCE_ID=<starting alliance id>
INITIAL_ADMIN_CORP_ID=<starting admin corp id>
INITIAL_ADMIN_CHARACTER_ID=<starting admin character id>
```

The `INITIAL_*` variables are only used when the backend creates its first config row in an empty database. After that, use the Admin page in the frontend to edit settings.

The backend container can now be built and run using

```sh
docker compose up -d --build backend
```

Access to npm can be acquired via a node container linked in the `/app` directory

```sh
docker run --rm -it --volume ./frontend:/app node:23-alpine sh
```

Running the frontend container provides a hotloading webserver at `localhost:3000` for react/frontend development.

```sh
docker compose up -d frontend
```

## Backend Deployment

For a new deployment, copy `backend/.env.example` to `backend/.env` and set at least these required values:

```sh
ESI_APP_ID=<appid>
ESI_APP_SECRET=<secret>
ESI_APP_REDIRECT=https://<your-host>/login
INITIAL_ALLIANCE_ID=<starting alliance id>
INITIAL_ADMIN_CORP_ID=<starting admin corp id>
INITIAL_ADMIN_CHARACTER_ID=<starting admin character id>
```

Deployment notes:

- `INITIAL_ALLIANCE_ID`, `INITIAL_ADMIN_CORP_ID`, and `INITIAL_ADMIN_CHARACTER_ID` are only used on first boot when the `config` table is empty.
- Once the first config row exists, use the frontend Admin page to edit config instead of changing `INITIAL_*` values.
- The compose example reads `backend/.env` and also shows the optional `INITIAL_*` bootstrap variables on the backend service.
- If you want to re-bootstrap those values from env, clear the config row or start from a fresh database.

### Known Bugs

- Issue when adding more scopes to an existing character/token

### TODO

- [ ] Backend
  - [x] Oauth for ESI
    - [x] Corp Blueprint roles to fetch blueprints store in token table
  - [x] Pull Blueprint data via ESI
- [ ] Pages
  - [ ] Unauthenticated / Login Page
  - [ ] Unauthorized Character
  - [ ] Authorized Character
    - [ ] User Settings P2
    - [ ] User Requests
    - [ ] Home Page
  - [ ] Authorized Manager Page
    - [ ] Request Queue
    - [ ] Request History P2
    - [ ] Research Queue
  - [ ] Authorized Admin Page
    - [ ] System Settings
