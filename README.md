## Brave Blueprint Programme

https://wiki.bravecollective.com/public/alliance/industry/bpcprogram

## Building

``` sh
docker build --output ./build --platform linux/arm64 .
```

This will produce a backend binary and frontend package in the build/ directory ready for upload to a server.

## Development

Create a development app at [developers.eveonline.com](https://developers.eveonline.com) with the callback URL `http://localhost:2727/login` and the following scopes:
- esi-assets.read_corporation_assets.v1
- esi-corporations.read_blueprints.v1
- esi-industry.read_corporation_jobs.v1

As of release 0.9.0, the read_corporation_jobs scope is unused and is listed for future features.

Then create `backend/.env` with 
``` sh
ESI_APP_ID=<appid>
ESI_APP_SECRET=<secret>
ESI_APP_REDIRECT=http://localhost:2727/login
```

The backend container can now be built and run using
``` sh
docker compose up -d --build backend
```

Access to npm can be acquired via a node container linked in the `/app` directory
``` sh
docker run --rm -it --volume ./frontend:/app node:23-alpine sh
```

Running the frontend container provides a hotloading webserver at `localhost:3000` for react/frontend development.
``` sh
docker compose up -d frontend
```

## Known Bugs
- Issue when adding more scopes to an existing character/token
