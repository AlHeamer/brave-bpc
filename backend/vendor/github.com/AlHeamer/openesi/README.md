## OpenAPI Generated ESI

Generated using

`docker pull openapitools/openapi-generator-cli`

``` sh
curl -O "https://esi.evetech.net/meta/openapi.yaml?compatibility_date=2026-07-21" && \
docker run --rm -v .:/local openapitools/openapi-generator-cli generate \
	-i /local/openapi.yaml \
	-g go \
	-o /local/esi \
	-p packageName=esi \
	-p packageVersion=2026.07.21 \
	--git-user-id AlHeamer \
	--git-repo-id openesi/esi
```

