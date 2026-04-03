"use client";
import { createFileRoute } from "@tanstack/react-router";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Input, Button, addToast } from "@heroui/react";
import { DEFAULT_MAX_REQUEST_ITEMS, usePublicConfigQuery } from "../api/config";
import {
  useBlueprintsQuery,
  type Blueprint,
  type BlueprintGroup,
} from "../api/blueprints";
import { useCreateRequisitionMutation } from "../api/requisitions";
import BlueprintGroupsTable, {
  type BlueprintSelectionState,
} from "../components/BlueprintGroupsTable.tsx";
import BlueprintsTable from "../components/BlueprintsTable";

export const Route = createFileRoute("/_auth/list")({
  component: RouteComponent,
});

type SelectedBlueprint = { blueprint: Blueprint; type_name: string };

function RouteComponent() {
  const { data: blueprintGroups = [], isLoading, error } = useBlueprintsQuery();
  const { data: publicConfig } = usePublicConfigQuery();
  const createRequisition = useCreateRequisitionMutation();
  const MAX_REQUEST_ITEMS =
    publicConfig?.max_request_items ?? DEFAULT_MAX_REQUEST_ITEMS;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Blueprint | "name">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<BlueprintSelectionState>({});

  useEffect(() => {
    if (!error) return;
    addToast({
      title: "Error",
      description:
        error instanceof Error
          ? `Failed to load blueprints: ${error.message}`
          : "Failed to load blueprints.",
      color: "danger",
    });
  }, [error]);

  const getTotal = (state: BlueprintSelectionState = selected) => {
    let total = 0;
    for (const entry of Object.values(state)) {
      if (entry?.checked) {
        total += entry.value;
      }
    }
    return total;
  };

  const selectedItems = useMemo<SelectedBlueprint[]>(() => {
    if (blueprintGroups.length === 0) return [];

    const out: SelectedBlueprint[] = [];
    for (const group of blueprintGroups) {
      const typeName = group.type_name;
      for (const blueprint of group.blueprints) {
        if (selected[blueprint.key]?.checked) {
          out.push({ blueprint, type_name: typeName });
        }
      }
    }
    return out;
  }, [blueprintGroups, selected]);

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSort = (key: keyof Blueprint | "name") => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const handleCheck = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const current = prev[key]?.value ?? 1;
      const nextState: BlueprintSelectionState = {
        ...prev,
        [key]: {
          checked,
          value: current,
        },
      };

      if (checked && getTotal(nextState) > MAX_REQUEST_ITEMS) {
        addToast({
          title: "Selection limit exceeded",
          description: `You cannot exceed the overall limit of ${MAX_REQUEST_ITEMS} BPCs.`,
          color: "danger",
        });
        return prev;
      }

      return nextState;
    });
  };

  const handleValueChange = (item: Blueprint, rawValue: number | null) => {
    const parsedValue = typeof rawValue === "number" ? rawValue : 1;
    const clampedValue = Math.min(
      Math.max(Math.floor(parsedValue) || 1, 1),
      item.quantity,
    );

    setSelected((prev) => {
      const nextState: BlueprintSelectionState = {
        ...prev,
        [item.key]: {
          checked: true,
          value: clampedValue,
        },
      };

      if (getTotal(nextState) > MAX_REQUEST_ITEMS) {
        addToast({
          title: "Selection limit exceeded",
          description: `You cannot exceed the overall limit of ${MAX_REQUEST_ITEMS} BPCs.`,
          color: "danger",
        });
        return prev;
      }

      return nextState;
    });
  };

  const filteredGroups = useMemo<BlueprintGroup[]>(() => {
    if (blueprintGroups.length === 0) {
      return [];
    }

    const normalizedSearch = search.trim().toLowerCase();
    const filtered = normalizedSearch.length
      ? blueprintGroups.filter((group) =>
          group.type_name.toLowerCase().includes(normalizedSearch),
        )
      : blueprintGroups;

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === "name") {
        return a.type_name.localeCompare(b.type_name) * (sortAsc ? 1 : -1);
      }

      const valueA = a.blueprints[0]?.[sortKey];
      const valueB = b.blueprints[0]?.[sortKey];

      if (valueA == null) return 1;
      if (valueB == null) return -1;
      return (valueA > valueB ? 1 : -1) * (sortAsc ? 1 : -1);
    });

    return sorted;
  }, [blueprintGroups, search, sortAsc, sortKey]);

  const handleSubmit = async () => {
    if (selectedItems.length === 0) {
      addToast({
        title: "No items selected",
        description: "Select at least one blueprint before submitting.",
        color: "warning",
      });
      return;
    }

    try {
      await createRequisition.mutateAsync({
        blueprints: selectedItems.map((item) => ({
          type_name: item.type_name,
          type_id: item.blueprint.type_id,
          runs: item.blueprint.runs,
          me: item.blueprint.material_efficiency ?? 0,
          te: item.blueprint.time_efficiency ?? 0,
          quantity:
            selected[item.blueprint.key]?.value ?? item.blueprint.quantity,
        })),
      });
      addToast({
        title: "Success",
        description: "Requisition created successfully!",
        color: "success",
      });
      setSelected({});
    } catch (err) {
      addToast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to create requisition.",
        color: "danger",
      });
    }
  };

  const selectedBlueprints = useMemo(() => {
    return selectedItems.map((item) => ({
      type_id: item.blueprint.type_id,
      runs: item.blueprint.runs,
      material_efficiency: item.blueprint.material_efficiency ?? 0,
      time_efficiency: item.blueprint.time_efficiency ?? 0,
      quantity:
        selected[item.blueprint.key]?.value ?? item.blueprint.quantity ?? 1,
      type_name: item.type_name,
      selectionKey: item.blueprint.key,
    }));
  }, [selected, selectedItems]);

  const handleRemoveSelected = (selectionKey: string) => {
    setSelected((prev) => {
      const existing = prev[selectionKey];
      if (!existing) return prev;
      return {
        ...prev,
        [selectionKey]: {
          checked: false,
          value: existing.value,
        },
      };
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-6 lg:flex-row">
      <div className="flex w-full flex-1 min-h-0 flex-col gap-4 lg:w-[1000px]">
        <Input
          aria-label="Search items"
          placeholder="Search items..."
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setSearch(event.target.value)
          }
          className="w-full font-semibold sm:w-72"
        />

        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-default-200 bg-content1 p-2 shadow-sm">
          <BlueprintGroupsTable
            className="h-full"
            groups={filteredGroups}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleExpand}
            onSort={handleSort}
            sortKey={sortKey}
            sortAsc={sortAsc}
            selectionState={selected}
            onValueChange={handleValueChange}
            onCheck={handleCheck}
            isLoading={isLoading}
          />
        </div>
      </div>
      {selected && (
        <aside className="flex w-full flex-col lg:sticky lg:top-4 lg:w-[480px]">
          <div className="flex flex-col gap-4 rounded-xl border border-default-200 bg-content1 p-4 shadow-sm">
            <h2 className="text-center text-lg font-semibold text-default-900">
              Selected Items
            </h2>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-default-200 bg-content2 lg:h-[470px] lg:max-h-none">
              <BlueprintsTable
                ariaLabel="Selected items table"
                className="h-full w-full"
                blueprints={selectedBlueprints}
                emptyContent="No items selected"
                onRemove={handleRemoveSelected}
              />
            </div>
            <Button
              className="mt-auto"
              onPress={() => void handleSubmit()}
              isDisabled={
                selectedItems.length === 0 || createRequisition.isPending
              }
              isLoading={createRequisition.isPending}
            >
              Submit
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default RouteComponent;
