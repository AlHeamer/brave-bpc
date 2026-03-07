import { http, HttpResponse } from "msw";
import { makeBlueprintFixtureSeed } from "../fixtures/blueprints";
const blueprintFixture = makeBlueprintFixtureSeed();

export const handlers = [
  http.get("/api/blueprints", () => {
    // For normal unit/UI tests we keep payload size reasonable while still sourcing from the real fixture file.
    // Local perf tests override this handler with a larger payload.
    const data = blueprintFixture.slice(0, 50);

    return HttpResponse.json(data as never);
  }),
];
