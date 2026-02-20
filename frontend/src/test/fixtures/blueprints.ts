export type RawBlueprint = {
  quantity: number;
  runs: number;
  type_id: number;
  material_efficiency?: number;
  time_efficiency?: number;
};

export type RawBlueprintGroup = {
  type_name: string;
  blueprints: RawBlueprint[];
};

/**
 * Small, deterministic seed fixture used for dev/perf/test data generation.
 *
 * This intentionally mirrors the backend response shape (no `key` field). The
 * frontend derives stable keys when reading API responses.
 */
export function makeBlueprintFixtureSeed(): RawBlueprintGroup[] {
  return [
    {
      type_name: "Antimatter Charge S Blueprint",
      blueprints: [
        {
          quantity: 1,
          runs: 24,
          type_id: 11283,
          material_efficiency: 10,
          time_efficiency: 20,
        },
      ],
    },
    {
      type_name: "Rocket Fuel Blueprint",
      blueprints: [
        {
          quantity: 11,
          runs: 600,
          type_id: 9836,
          material_efficiency: 10,
          time_efficiency: 20,
        },
        {
          quantity: 2,
          runs: 120,
          type_id: 9837,
          material_efficiency: 8,
          time_efficiency: 18,
        },
      ],
    },
    {
      type_name: "'Gambler' Ladar ECM Blueprint",
      blueprints: [
        {
          quantity: 1,
          runs: 10,
          type_id: 44001,
          material_efficiency: 10,
          time_efficiency: 20,
        },
        {
          quantity: 1,
          runs: 5,
          type_id: 44002,
          material_efficiency: 10,
          time_efficiency: 20,
        },
        {
          quantity: 1,
          runs: 1,
          type_id: 44003,
          material_efficiency: 9,
          time_efficiency: 19,
        },
      ],
    },
    {
      type_name: "Cap Booster 400 Blueprint",
      blueprints: [
        {
          quantity: 5,
          runs: 150,
          type_id: 15001,
          material_efficiency: 9,
          time_efficiency: 18,
        },
      ],
    },
    {
      type_name: "Nanite Repair Paste Blueprint",
      blueprints: [
        {
          quantity: 3,
          runs: 60,
          type_id: 28668,
          material_efficiency: 10,
          time_efficiency: 16,
        },
        {
          quantity: 2,
          runs: 30,
          type_id: 28669,
          material_efficiency: 8,
          time_efficiency: 14,
        },
      ],
    },
  ];
}

export function buildSingleBlueprintGroups(
  seed: RawBlueprintGroup[],
  targetGroups: number,
): RawBlueprintGroup[] {
  const flattened = seed.flatMap((group) =>
    group.blueprints.map((bp) => ({
      type_name: group.type_name,
      blueprint: bp,
    })),
  );

  if (flattened.length === 0) return [];

  const out: RawBlueprintGroup[] = [];
  for (let i = 0; i < targetGroups; i++) {
    const item = flattened[i % flattened.length]!;
    out.push({
      type_name: `${item.type_name} #${i + 1}`,
      blueprints: [item.blueprint],
    });
  }

  return out;
}

export function pickExpandableSeedGroup(
  seed: RawBlueprintGroup[],
): RawBlueprintGroup | null {
  return seed.find((g) => (g.blueprints?.length ?? 0) > 1) ?? null;
}

export function loadTestBlueprintGroups(): RawBlueprintGroup[] {
  return makeBlueprintFixtureSeed();
}
