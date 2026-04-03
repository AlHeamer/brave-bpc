import { http, HttpResponse } from "msw";
import { makeBlueprintFixtureSeed } from "../fixtures/blueprints";
import {
  DEFAULT_HOMEPAGE_MARKDOWN,
  DEFAULT_MAX_REQUEST_ITEMS,
  type AppConfig,
} from "../../api/config";

const blueprintFixture = makeBlueprintFixtureSeed();

const defaultAppConfig: AppConfig = {
  alliances: [99003214],
  corporations: [],
  admin_corp: 98544197,
  admin_char: 95154016,
  max_contracts: 2,
  max_request_items: DEFAULT_MAX_REQUEST_ITEMS,
  homepage_markdown: DEFAULT_HOMEPAGE_MARKDOWN,
};

export const handlers = [
  http.get("/api/blueprints", () => {
    // For normal unit/UI tests we keep payload size reasonable while still sourcing from the real fixture file.
    // Local perf tests override this handler with a larger payload.
    const data = blueprintFixture.slice(0, 50);

    return HttpResponse.json(data as never);
  }),
  http.get("/api/public-config", () => {
    return HttpResponse.json({
      max_request_items: defaultAppConfig.max_request_items,
      homepage_markdown: defaultAppConfig.homepage_markdown,
    });
  }),
  http.get("/api/config", () => {
    return HttpResponse.json(defaultAppConfig);
  }),
  http.post("/api/config", async ({ request }) => {
    const config = (await request.json()) as AppConfig;
    return HttpResponse.json(config);
  }),
];
