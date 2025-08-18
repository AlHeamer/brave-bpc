import {
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
  TableColumn,
  Chip,
  DateInput,
  Spinner,
  User,
  Snippet,
  Button,
} from "@heroui/react";
import { parseAbsoluteToLocal } from "@internationalized/date";
import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { AsyncListData, useAsyncList } from "@react-stately/data";

export const Route = createFileRoute("/_auth/requests")({
  component: RouteComponent,
});
interface BlueprintRequest {
  id: string;
  character_id: number;
  status?: string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  public_notes?: string;
  blueprints: Array<{
    type_id: number;
    runs: number;
    material_efficiency?: number;
    time_efficiency?: number;
    quantity?: number;
    type_name?: string;
  }>;
}
interface EsiResponse {
  category: string;
  id: number;
  name: string;
}

const statusColorMap = {
  open: "primary",
  closed: "default",
  completed: "success",
  rejected: "danger",
} as const;
type Status = keyof typeof statusColorMap;

function RouteComponent() {
  const {
    auth: {
      user: { auth_level, character_id },
    },
  } = Route.useRouteContext();
  const [isLoading, setIsLoading] = useState(true);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [idMap, setIdMap] = useState<EsiResponse[]>([]);

  const toggleExpand = (key: string) => {
    setSelectedKey((prev) => (prev === key ? null : key));
  };

  const asyncList: AsyncListData<BlueprintRequest> = useAsyncList({
    load: async ({ signal }) => {
      const response = await fetch("/api/requisition", { signal });
      const data = await response.json();
      setIsLoading(false);
      return { items: data };
    },
    sort: async ({ items, sortDescriptor }) => {
      const { column, direction } = sortDescriptor;
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      });

      const getValue = (item: BlueprintRequest) => {
        const value = item[column as keyof BlueprintRequest];
        if (column === "created_at" || column === "updated_at") {
          // ISO strings sort lexicographically; alternatively use timestamps
          return Date.parse(String(value)) || 0;
        }
        return value ?? "";
      };

      const sorted = [...items].sort((a, b) => {
        const va = getValue(a);
        const vb = getValue(b);

        const cmp =
          typeof va === "number" && typeof vb === "number"
            ? va - vb
            : collator.compare(String(va), String(vb));

        if (cmp === 0) return 0;
        return direction === "descending" ? -cmp : cmp;
      });

      return { items: sorted };
    },
  });

  useEffect(() => {
    const ids = asyncList.items.map((item) => item.character_id);
    const itemIds = asyncList.items
      .map((item) => item.blueprints.map((bp) => bp.type_id))
      .flat();
    ids.push(...itemIds);
    const idArray = Array.from(new Set(ids));
    if (!isLoading) {
      resolveIdsToNames(idArray);
    }

    async function resolveIdsToNames(idArray: number[]) {
      const response = await fetch("https://esi.evetech.net/universe/names", {
        method: "POST",
        headers: {
          "Accept-Language": "",
          "If-None-Match": "",
          "X-Compatibility-Date": "2020-01-01",
          "X-Tenant": "",
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(idArray),
      });
      const data: EsiResponse[] = await response.json();
      setIdMap(data);
    }
  }, [asyncList.items, isLoading]);

  const getNameById = (id: number) => {
    const item = idMap.find((item) => item.id === id);
    return item ? item.name : "Unknown";
  };

  return (
    <Table
      aria-label="Requests Table"
      sortDescriptor={asyncList.sortDescriptor}
      onSortChange={asyncList.sort}
      isVirtualized
      className="flex w-full flex-row"
    >
      <TableHeader>
        <TableColumn>ID</TableColumn>
        <TableColumn>Requester</TableColumn>
        <TableColumn allowsSorting>Status</TableColumn>
        <TableColumn allowsSorting key="created_at">
          Created At
        </TableColumn>
        <TableColumn allowsSorting key="updated_at">
          Updated At
        </TableColumn>
        <TableColumn>Updated By</TableColumn>
        <TableColumn>Public Notes</TableColumn>
        <TableColumn>Actions</TableColumn>
      </TableHeader>
      <TableBody
        isLoading={isLoading}
        loadingContent={<Spinner label="Loading..." />}
      >
        {asyncList.items.map((item) => (
          <Fragment key={item.id}>
            <TableRow>
              <TableCell>{item.id}</TableCell>
              <TableCell>
                <User
                  id={item.character_id.toString()}
                  avatarProps={{
                    src: `https://images.evetech.net/characters/${item.character_id}/portrait`,
                  }}
                  name={
                    <Snippet hideSymbol size="sm" radius="none">
                      {getNameById(item.character_id)}
                    </Snippet>
                  }
                  className="text-default-600"
                />
              </TableCell>
              <TableCell>
                <Chip
                  className="capitalize gap-1 text-default-600 text-bold"
                  color={statusColorMap[(item.status as Status) ?? "open"]}
                  size="lg"
                  variant="bordered"
                  radius="sm"
                >
                  {item.status || "Open"}
                </Chip>
              </TableCell>
              <TableCell>
                <DateInput
                  value={parseAbsoluteToLocal(item.created_at)}
                  isDisabled
                  size="sm"
                />
              </TableCell>
              <TableCell>
                <DateInput
                  value={parseAbsoluteToLocal(item.updated_at)}
                  isDisabled
                  granularity={"minute"}
                  hourCycle={24}
                  size="sm"
                />
              </TableCell>
              <TableCell>{item.updated_by || "N/A"}</TableCell>
              <TableCell>{item.public_notes}</TableCell>
              <TableCell>
                <Button onPress={() => toggleExpand(item.id)}>View</Button>
              </TableCell>
            </TableRow>
            {item.id === selectedKey && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col gap-4">
                    <div className="flex-row-reverse justify-between">
                      {item.character_id === character_id && (
                        <Button variant="ghost" color="danger">
                          Cancel
                        </Button>
                      )}
                      {auth_level >= 2 && (
                        <>
                          <Button variant="ghost" color="secondary">
                            Lock
                          </Button>
                          <Button variant="ghost" color="success">
                            Complete
                          </Button>
                          <Button variant="ghost" color="danger">
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableColumn>Blueprint</TableColumn>
                        <TableColumn>ME</TableColumn>
                        <TableColumn>TE</TableColumn>
                        <TableColumn>Runs</TableColumn>
                        <TableColumn>Quantity</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {item.blueprints.map((blueprint) => (
                          <TableRow key={blueprint.type_id}>
                            <TableCell>
                              <User
                                avatarProps={{
                                  src: `https://images.evetech.net/types/${blueprint.type_id}/bpc`,
                                }}
                                name={getNameById(blueprint.type_id)}
                              />
                            </TableCell>
                            <TableCell>
                              {blueprint?.material_efficiency || 0}
                            </TableCell>
                            <TableCell>
                              {blueprint?.time_efficiency || 0}
                            </TableCell>
                            <TableCell>{blueprint.runs}</TableCell>
                            <TableCell>{blueprint?.quantity || 1}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}
