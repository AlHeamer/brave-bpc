"use client";
import { createFileRoute } from "@tanstack/react-router";
import { SetStateAction, useEffect, useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Checkbox,
  Avatar,
  NumberInput,
  Button,
  addToast,
} from "@heroui/react";

export const Route = createFileRoute("/_auth/list")({
  component: RouteComponent,
});

export interface Blueprint {
  quantity: number;
  runs: number;
  type_id: number;
  material_efficiency?: number;
  time_efficiency?: number;
  key: string;
}
interface BlueprintApiResponse {
  type_name: string;
  blueprints: Blueprint[];
}
//TODO load from config
const MAX_TOTAL = 10;

function RouteComponent() {
  const [blueprints, setBlueprints] = useState(
    new Array<BlueprintApiResponse>()
  );

  useEffect(() => {
    try {
      fetchBlueprints(setBlueprints);
    } catch (e: unknown) {
      addToast({
        title: "Error",
        description: "Failed to load blueprints: " + (e as Error).message,
        color: "danger",
      });
    }
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Blueprint | "name">("name");
  const [sortAsc, setSortAsc] = useState(true);

  const [selected, setSelected] = useState<
    Record<string, { checked: boolean; value: number }>
  >({});

  const getTotal = (state = selected) =>
    Object.values(state)
      .filter((v) => v.checked)
      .reduce((sum, v) => sum + v.value, 0);

  const handleCheck = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const current = prev[key]?.value ?? 1;
      const newState = {
        ...prev,
        [key]: {
          checked,
          value: current,
        },
      };

      // if unchecked, fine; if checked, enforce overall max
      if (checked && getTotal(newState) > MAX_TOTAL) {
        addToast({
          title: "Selection limit exceeded",
          description:
            "You cannot exceed the overall limit of " + MAX_TOTAL + " BPCs.",
          color: "danger",
        });
        return prev; // reject change
      }
      return newState;
    });
  };
  const handleValueChange = (item: Blueprint, value: number) => {
    setSelected((prev) => {
      // clamp to row max
      // let clamped = Math.min(value, item.maxCount);
      // if (clamped < 1) clamped = 1;

      const newState = {
        ...prev,
        [item.key]: {
          checked: true, // auto-check if typing
          value: value,
        },
      };

      // enforce global max
      if (getTotal(newState) > MAX_TOTAL) {
        addToast({
          title: "Selection limit exceeded",
          description:
            "You cannot exceed the overall limit of " + MAX_TOTAL + " BPCs.",
          color: "danger",
        });

        return prev; // reject change
      }

      return newState;
    });
  };
  const selectedItems = blueprints
    .flatMap((group) =>
      group.blueprints.map((blueprint) => ({
        ...blueprint,
        type_name: group.type_name,
      }))
    )
    .filter((item) => selected[item.key]?.checked);

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
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!blueprints || blueprints.length === 0) return [];
    const filteredItems = blueprints.filter((item) =>
      item.type_name.toLowerCase().includes(search.toLowerCase())
    );
    //TODO fix this sort, filtering and mayhem
    const sortedItems = [...filteredItems].sort((a, b) => {
      let valA;
      let valB;
      if (sortKey === "name") {
        valA = a.type_name;
        valB = b.type_name;
      } else {
        valA = a.blueprints[0][sortKey];
        valB = b.blueprints[0][sortKey];
      }
      if (valA == null) return 1;
      if (valB == null) return -1;
      return (valA > valB ? 1 : -1) * (sortAsc ? 1 : -1);
    });
    return sortedItems;
  }, [search, sortKey, sortAsc, blueprints]);

  return (
    <div className="flex gap-4">
      <div>
        <Input
          placeholder="Search items..."
          value={search}
          onChange={(e: { target: { value: SetStateAction<string> } }) =>
            setSearch(e.target.value)
          }
          className="font-semibold w-64 p-2"
        />

        <Table
          className="flex gap-4"
          aria-label="Collapsible selectable table"
          isStriped
          isVirtualized
        >
          <TableHeader>
            <TableColumn
              onClick={() => handleSort("name")}
              className="cursor-pointer"
            >
              Name
            </TableColumn>
            <TableColumn>Group</TableColumn>
            <TableColumn className="cursor-pointer">ME</TableColumn>
            <TableColumn className="cursor-pointer">TE</TableColumn>
            <TableColumn className="cursor-pointer">Runs</TableColumn>
            <TableColumn className="cursor-pointer">Quantity</TableColumn>
            <TableColumn children={undefined}></TableColumn>
            <TableColumn>Select</TableColumn>
          </TableHeader>
          <TableBody>
            {filteredGroups.map(({ type_name, blueprints: items }) => {
              const showExpandable = items.length > 1;

              return (
                <>
                  {showExpandable ? (
                    <>
                      <TableRow
                        key={items[0].type_id}
                        onClick={() => toggleExpand(type_name)}
                        className="cursor-pointer"
                      >
                        <TableCell className="flex items-center gap-2 font-semibold">
                          <Avatar
                            radius="none"
                            src={`https://images.evetech.net/types/${items[0].type_id}/bpc`}
                          />
                          {type_name}
                        </TableCell>
                        <TableCell
                          colSpan={4}
                          className="text-sm text-gray-500"
                        >
                          {expandedGroups.has(type_name)
                            ? "Click to collapse"
                            : "Click to expand"}
                        </TableCell>
                        <TableCell children={undefined} />
                        <TableCell children={undefined} />
                        <TableCell children={undefined} />
                      </TableRow>

                      {expandedGroups.has(type_name) &&
                        items.map((item) => {
                          const state = selected[item.key];
                          return (
                            <TableRow key={item.key}>
                              <TableCell children={undefined} />
                              <TableCell children={undefined}>{}</TableCell>
                              <TableCell>
                                {item.material_efficiency || 0}
                              </TableCell>
                              <TableCell>{item.time_efficiency || 0}</TableCell>
                              <TableCell>{item.runs}</TableCell>
                              <TableCell>{item.quantity} </TableCell>
                              <TableCell>
                                {state?.checked && (
                                  <NumberInput
                                    size="sm"
                                    className="w-20 mt-1"
                                    minValue={1}
                                    maxValue={item.quantity}
                                    aria-labelledby={
                                      type_name +
                                      items.findIndex(
                                        (findItem) => findItem == item
                                      )
                                    }
                                    value={state?.value || 0}
                                    onValueChange={(e: number) =>
                                      handleValueChange(item, e)
                                    }
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <Checkbox
                                  isSelected={state?.checked || false}
                                  onValueChange={(checked: boolean) =>
                                    handleCheck(item.key, checked)
                                  }
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </>
                  ) : (
                    items.map((item) => {
                      const state = selected[item.key];
                      return (
                        <TableRow key={item.key}>
                          <TableCell className="flex items-center gap-2 font-semibold">
                            <Avatar
                              radius="none"
                              src={`https://images.evetech.net/types/${item.type_id}/bpc`}
                            />
                            {type_name}
                          </TableCell>
                          <TableCell children={undefined}></TableCell>
                          <TableCell>{item.material_efficiency}</TableCell>
                          <TableCell>{item.time_efficiency}</TableCell>
                          <TableCell>{item.runs}</TableCell>
                          <TableCell>{item.quantity} </TableCell>
                          <TableCell>
                            {state?.checked && (
                              <NumberInput
                                size="sm"
                                aria-labelledby={
                                  type_name +
                                  items.findIndex(
                                    (findItem) => findItem == item
                                  )
                                }
                                className="w-20 mt-1"
                                minValue={1}
                                maxValue={item.quantity}
                                value={state?.value || 0}
                                onValueChange={(e: number) =>
                                  handleValueChange(item, e)
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Checkbox
                              isSelected={state?.checked || false}
                              onValueChange={(checked: boolean) =>
                                handleCheck(item.key, checked)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {selected && (
        <div className="flex gap-4 flex-col border rounded-lg p-4">
          <h2 className="text-center font-bold">Selected Items</h2>

          <Table className="flex-1 h-full" aria-label="Selected items table">
            <TableHeader>
              <TableColumn>Name</TableColumn>
              <TableColumn>Quantity</TableColumn>
              <TableColumn>Runs</TableColumn>
              <TableColumn>ME</TableColumn>
              <TableColumn>TE</TableColumn>
            </TableHeader>
            <TableBody>
              {selectedItems.map((item) => {
                const quantity = selected[item.key]?.value || 1;
                return (
                  <TableRow key={item.key + "selected"}>
                    <TableCell>
                      <Avatar
                        radius="none"
                        src={`https://images.evetech.net/types/${item?.type_id}/bpc`}
                      />
                      {item?.type_name || "Unknown Item"}
                    </TableCell>
                    <TableCell>{quantity}</TableCell>
                    <TableCell>{item?.runs}</TableCell>
                    <TableCell>{item?.material_efficiency}</TableCell>
                    <TableCell>{item?.time_efficiency}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Button
            className="object-bottom"
            onPress={async () => {
              try {
                await createRequisition(selectedItems);
                addToast({
                  title: "Success",
                  description: "Requisition created successfully!",
                  color: "success",
                });
              } catch (e: unknown) {
                addToast({
                  title: "Error",
                  description:
                    "Failed to create requisition: " + (e as Error).message,
                  color: "danger",
                });
              }
              setSelected({});
            }}
          >
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}
async function fetchBlueprints(
  setBlueprints: React.Dispatch<React.SetStateAction<BlueprintApiResponse[]>>
) {
  const response = await fetch(`/api/blueprints`, {
    method: "GET",
    credentials: "include",
    mode: "cors",
  });
  if (response.status !== 200) {
    throw new Error("Failed to fetch blueprints: " + response.statusText);
  }
  const data: Array<BlueprintApiResponse> = await response.json();

  const correctedData = data.map((item) => {
    return {
      type_name: item.type_name,
      blueprints: item.blueprints.map((blueprint) => ({
        ...blueprint,
        key: `${blueprint.type_id}-${blueprint?.material_efficiency || 0}-${blueprint?.time_efficiency || 0}-${blueprint.runs}`,
      })),
    };
  });
  setBlueprints(correctedData);
  return;
}

async function createRequisition(selectedItems: Blueprint[]) {
  // Required format for api
  const requisitionItems = selectedItems.map((item) => ({
    type_id: item.type_id,
    runs: item.runs,
    material_efficiency: item.material_efficiency || 0,
    time_efficiency: item.time_efficiency || 0,
    quantity: item.quantity,
  }));

  const response = await fetch(`/api/requisition`, {
    method: "POST",
    credentials: "include",
    mode: "cors",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ blueprints: requisitionItems }),
  });
  if (response.status !== 200) {
    throw new Error("Failed to create requisition");
  }
  return;
}
