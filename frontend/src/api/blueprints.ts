import { useQuery, type UseQueryResult } from "@tanstack/react-query";

export interface Blueprint {
  quantity: number;
  runs: number;
  type_id: number;
  material_efficiency?: number;
  time_efficiency?: number;
  key: string;
}

export interface BlueprintGroup {
  type_name: string;
  blueprints: Blueprint[];
}

export const blueprintsQueryKey = ["blueprints"] as const;

type BlueprintFixtureParams = {
  targetCount: number;
};

function getBlueprintFixtureParams(): BlueprintFixtureParams | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const fixture = params.get("bpFixture");

  if (fixture !== "test") return null;

  const rawCount = params.get("bpCount") ?? "20000";
  const parsed = Number.parseInt(rawCount, 10);

  return {
    targetCount: Number.isFinite(parsed) && parsed > 0 ? parsed : 20000,
  };
}

function withKeys(
  data: BlueprintGroup[],
  options?: {
    keySuffix?: (groupIndex: number, blueprintIndex: number) => string;
  },
): BlueprintGroup[] {
  for (let groupIndex = 0; groupIndex < data.length; groupIndex++) {
    const group = data[groupIndex];
    if (!group) continue;

    for (
      let blueprintIndex = 0;
      blueprintIndex < group.blueprints.length;
      blueprintIndex++
    ) {
      const blueprint = group.blueprints[blueprintIndex] as
        | Blueprint
        | undefined;
      if (!blueprint) continue;

      const baseKey = `${blueprint.type_id}:${blueprint.material_efficiency ?? 0}:${
        blueprint.time_efficiency ?? 0
      }:${blueprint.runs}`;

      const suffix = options?.keySuffix?.(groupIndex, blueprintIndex) ?? "";
      blueprint.key = suffix ? `${baseKey}:${suffix}` : baseKey;
    }
  }

  return data;
}

function countBlueprints(groups: BlueprintGroup[]): number {
  let total = 0;
  for (const group of groups) total += group.blueprints.length;
  return total;
}

function buildScaledFixture(
  seed: BlueprintGroup[],
  targetCount: number,
): BlueprintGroup[] {
  const seedCount = countBlueprints(seed);
  if (seedCount <= 0) return [];

  const copies = Math.ceil(targetCount / seedCount);
  const out: BlueprintGroup[] = [];
  let produced = 0;

  for (
    let copyIndex = 0;
    copyIndex < copies && produced < targetCount;
    copyIndex++
  ) {
    for (const seedGroup of seed) {
      if (produced >= targetCount) break;

      const remaining = targetCount - produced;
      const take = Math.min(remaining, seedGroup.blueprints.length);
      const groupTypeName = `${seedGroup.type_name} [${copyIndex + 1}]`;

      out.push({
        type_name: groupTypeName,
        blueprints: seedGroup.blueprints.slice(0, take),
      });

      produced += take;
    }
  }

  return out;
}

async function fetchBlueprints(
  signal?: AbortSignal,
): Promise<BlueprintGroup[]> {
  if (import.meta.env.DEV) {
    const fixtureParams = getBlueprintFixtureParams();
    if (fixtureParams) {
      const { makeBlueprintFixtureSeed } =
        await import("../test/fixtures/blueprints");

      const scaled = buildScaledFixture(
        makeBlueprintFixtureSeed() as BlueprintGroup[],
        fixtureParams.targetCount,
      );

      // Ensure unique keys even when the seed data repeats.
      return withKeys(scaled, {
        keySuffix: (groupIndex, blueprintIndex) =>
          `${groupIndex}-${blueprintIndex}`,
      });
    }
  }

  const response = await fetch("/api/blueprints", {
    method: "GET",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load blueprints (${response.status})`);
  }

  const data: BlueprintGroup[] = await response.json();
  return withKeys(data);
}

export function useBlueprintsQuery(): UseQueryResult<BlueprintGroup[]> {
  const fixtureKey =
    import.meta.env.DEV && typeof window !== "undefined"
      ? `${new URLSearchParams(window.location.search).get("bpFixture") ?? ""}:${
          new URLSearchParams(window.location.search).get("bpCount") ?? ""
        }`
      : "";

  return useQuery({
    queryKey: [...blueprintsQueryKey, fixtureKey] as const,
    queryFn: ({ signal }) => fetchBlueprints(signal),
  });
}
