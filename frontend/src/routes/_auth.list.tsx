import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
} from "@heroui/react";

export const Route = createFileRoute("/_auth/list")({
  component: RouteComponent,
  component: RouteComponent,
});

export interface Blueprint {
  name?: string;
  item_id: number;
  location_flag: string;
  location_id: number;
  quantity: number;
  runs: number;
  type_id: number;
  material_efficiency?: number;
  time_efficiency?: number;
}
function RouteComponent() {
  const [blueprints, setBlueprints] = useState(new Map<string, Blueprint[]>());
  const [nameMap, setNameMap] = useState(new Map<string, string>());

  type ArrayItem = {
    item_id: number;
    quantity: number;
    runs: number;
    type_id: number;
    material_efficiency?: number;
    time_efficiency?: number;
  };

  useEffect(() => {
    const fetchNameMap = async () => {
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:2727/api/namemap`,
        {
          method: "GET",
          credentials: "include",
          mode: "cors",
        }
      );
      const data = await response.json();

      const map = new Map<string, string>(Object.entries(data));
      setNameMap(map);
      return;
    };

    const fetchBlueprints = async () => {
      const response = await fetch(
        `${window.location.protocol}//${window.location.hostname}:2727/api/blueprints`,
        {
          method: "GET",
          credentials: "include",
          mode: "cors",
        }
      );
      const data = await response.json();

      const map = new Map<string, Blueprint[]>(Object.entries(data));
      setBlueprints(map);
      return;
    };

    fetchNameMap()
      .then(() => fetchBlueprints().catch((err) => console.error(err)))
      .catch((err) => console.error(err));
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof Blueprint>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Map<number, number>>(
    new Map()
  );

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  const handleSort = (key: keyof ArrayItem) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };
  const getTotalSelectedQuantity = () => {
    return Array.from(selectedItems.values()).reduce(
      (sum, qty) => sum + qty,
      0
    );
  };

  const toggleItemSelection = (itemId: number, checked: boolean) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (checked) {
        next.set(itemId, 1);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const updateItemValue = (itemId: number, value: number) => {
    //TODO add check for max count
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.set(itemId, value);
      }
      return next;
    });
  };
  const filteredGroups = useMemo(() => {
    const filteredItems = Array.from(blueprints.entries()).map(
      ([groupId, items]) => {
        const filteredItems = items.filter((item) => {
          if (nameMap.has(`${item.type_id}`)) {
            //@ts-expect-error check above
            return nameMap
              .get(`${item.type_id}`)
              .toLowerCase()
              .includes(search.toLowerCase());
          } else {
            return true;
          }
        });

        return [groupId, filteredItems] as [string, ArrayItem[]];
      }
    );

    const sortedItems = [...filteredItems].sort((a, b) => {
      let valA = a[0];
      let valB = b[0];
      if (sortKey === "name") {
        valA = nameMap.get(`${a[0]}`) || "";
        valB = nameMap.get(`${b[0]}`) || "";
      } else {
        valA = a[1][sortKey];
        valB = b[1][sortKey];
      }
      if (valA == null) return 1;
      if (valB == null) return -1;
      return (valA > valB ? 1 : -1) * (sortAsc ? 1 : -1);
    });
    return sortedItems;
  }, [search, sortKey, sortAsc, blueprints]);

  return (
    <div>
      <Input
        placeholder="Search items..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="font-semibold w-64 p-2"
      />
      <Table aria-label="Collapsible selectable table" isStriped >
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
          {filteredGroups.map(([groupId, items]) => {
            const showExpandable = items.length > 1;

            return (
              <>
                {showExpandable ? (
                  <>
                    <TableRow
                      key={groupId}
                      onClick={() => toggleExpand(groupId)}
                      className="cursor-pointer"
                    >
                      <TableCell className="flex items-center gap-2 font-semibold">
                        <Avatar
                          radius="none"
                          src={`https://images.evetech.net/types/${items[0].type_id}/bpc`}
                        />
                        {nameMap.get(groupId)}
                      </TableCell>
                      <TableCell colSpan={4} className="text-sm text-gray-500">
                        {expandedGroups.has(groupId)
                          ? "Click to collapse"
                          : "Click to expand"}
                      </TableCell>
                      <TableCell children={undefined} />
                      <TableCell children={undefined} />
					  <TableCell children={undefined} />
                    </TableRow>

                    {expandedGroups.has(groupId) &&
                      items.map((item) => (
                        <TableRow key={item.item_id}>
                          <TableCell children={undefined} />
                          <TableCell children={undefined}>{}</TableCell>
                          <TableCell>{item.material_efficiency}</TableCell>
                          <TableCell>{item.time_efficiency}</TableCell>
                          <TableCell>{item.runs}</TableCell>
                          <TableCell>{item.quantity} </TableCell>
						  <TableCell>{selectedItems.has(item.item_id) && (
                              <NumberInput
                                size="sm"
                                className="w-20 mt-1"
                                minValue={1}
                                maxValue={item.quantity}
                                defaultValue={
                                  selectedItems.get(item.item_id) || 1
                                }
                                onValueChange={(e) =>
                                  updateItemValue(item.item_id, e)
                                }
                              />
                            )}</TableCell>
                          <TableCell>
                            <Checkbox
                              isSelected={selectedItems.has(item.item_id)}
                              onValueChange={(checked) =>
                                toggleItemSelection(item.item_id, checked)
                              }
                            />
                            
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.item_id}>
                      <TableCell className="flex items-center gap-2 font-semibold">
                        <Avatar
                          radius="none"
                          src={`https://images.evetech.net/types/${item.type_id}/bpc`}
                        />
                        {nameMap.get(groupId)}
                      </TableCell>
                      <TableCell children={undefined}></TableCell>
                      <TableCell>{item.material_efficiency}</TableCell>
                      <TableCell>{item.time_efficiency}</TableCell>
                      <TableCell>{item.runs}</TableCell>
                      <TableCell>{item.quantity} </TableCell>
					  <TableCell>{selectedItems.has(item.item_id) && (
                          <NumberInput
                            size="sm"
                            className="w-20 mt-1"
                            minValue={1}
                            maxValue={item.quantity}
                            defaultValue={selectedItems.get(item.item_id) || 1}
                            onValueChange={(e) =>
                              updateItemValue(item.item_id, e)
                            }
                          />
                        )}</TableCell>
                      <TableCell>
                        <Checkbox
                          isSelected={selectedItems.has(item.item_id)}
                          onValueChange={(checked) =>
                            toggleItemSelection(item.item_id, checked)
                          }
                        />
                        
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
