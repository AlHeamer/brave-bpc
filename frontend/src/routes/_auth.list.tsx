"use client";
import { createFileRoute } from "@tanstack/react-router";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Input, Button, addToast } from "@heroui/react";
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

const MAX_TOTAL = 10;
type BlueprintWithName = Blueprint & { type_name: string };

function RouteComponent() {
  const { data: blueprintGroups = [], isLoading, error } = useBlueprintsQuery();
  const createRequisition = useCreateRequisitionMutation();

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

  const flattenedBlueprints = useMemo<BlueprintWithName[]>(() => {
    return blueprintGroups.flatMap((group) =>
      group.blueprints.map((blueprint) => ({
        ...blueprint,
        type_name: group.type_name,
      }))
    );
  }, [blueprintGroups]);

  const selectedItems = useMemo(() => {
    return flattenedBlueprints.filter((item) => selected[item.key]?.checked);
  }, [flattenedBlueprints, selected]);

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

      if (checked && getTotal(nextState) > MAX_TOTAL) {
        addToast({
          title: "Selection limit exceeded",
          description: `You cannot exceed the overall limit of ${MAX_TOTAL} BPCs.`,
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
      item.quantity
    );

    setSelected((prev) => {
      const nextState: BlueprintSelectionState = {
        ...prev,
        [item.key]: {
          checked: true,
          value: clampedValue,
        },
      };

      if (getTotal(nextState) > MAX_TOTAL) {
        addToast({
          title: "Selection limit exceeded",
          description: `You cannot exceed the overall limit of ${MAX_TOTAL} BPCs.`,
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
          group.type_name.toLowerCase().includes(normalizedSearch)
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
          type_id: item.type_id,
          runs: item.runs,
          material_efficiency: item.material_efficiency ?? 0,
          time_efficiency: item.time_efficiency ?? 0,
          quantity: selected[item.key]?.value ?? item.quantity,
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
      type_id: item.type_id,
      runs: item.runs,
      material_efficiency: item.material_efficiency ?? 0,
      time_efficiency: item.time_efficiency ?? 0,
      quantity: selected[item.key]?.value ?? item.quantity ?? 1,
      type_name: item.type_name,
    }));
  }, [selected, selectedItems]);

  return (
    <div className="flex items-start gap-6">
      <div className="flex w-[1000px] flex-col gap-4">
        <Input
          aria-label="Search items"
          placeholder="Search items..."
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            setSearch(event.target.value)
          }
          className="w-72 font-semibold"
        />

        <div className="h-[620px] overflow-hidden rounded-xl border border-default-200 bg-content1 p-2 shadow-sm">
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
        <aside className="sticky top-4 flex w-[480px] flex-col">
          <div className="flex flex-col gap-4 rounded-xl border border-default-200 bg-content1 p-4 shadow-sm">
            <h2 className="text-center text-lg font-semibold text-default-900">
              Selected Items
            </h2>
            <div className="h-[470px] overflow-auto rounded-lg border border-default-200 bg-content2">
              <BlueprintsTable
                ariaLabel="Selected items table"
                className="h-full w-full"
                blueprints={selectedBlueprints}
                emptyContent="No items selected"
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
