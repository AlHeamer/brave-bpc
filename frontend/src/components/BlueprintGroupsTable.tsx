import {
  Checkbox,
  NumberInput,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { memo, useMemo } from "react";
import type { Blueprint, BlueprintGroup } from "../api/blueprints";
import LazyImage from "./LazyImage";

export type BlueprintSelectionState = Record<
  string,
  { checked: boolean; value: number }
>;

export interface BlueprintGroupsTableProps {
  groups: BlueprintGroup[];
  expandedGroups: Set<string>;
  onToggleGroup: (groupId: string) => void;
  onSort: (key: keyof Blueprint | "name") => void;
  sortKey: keyof Blueprint | "name";
  sortAsc: boolean;
  selectionState: BlueprintSelectionState;
  onValueChange: (blueprint: Blueprint, value: number | null) => void;
  onCheck: (key: string, checked: boolean) => void;
  isLoading: boolean;
  className?: string;
}

const BlueprintGroupsTable = memo(
  ({
    groups,
    expandedGroups,
    onToggleGroup,
    onSort,
    sortKey,
    sortAsc,
    selectionState,
    onValueChange,
    onCheck,
    isLoading,
    className,
  }: BlueprintGroupsTableProps) => {
    const shouldVirtualize =
      typeof window !== "undefined" &&
      typeof window.ResizeObserver !== "undefined" &&
      groups.length > 200;

    type DisplayRow =
      | {
          key: string;
          kind: "single";
          typeName: string;
          blueprint: Blueprint;
        }
      | {
          key: string;
          kind: "groupHeader";
          typeName: string;
          firstBlueprint: Blueprint;
          isExpanded: boolean;
        }
      | {
          key: string;
          kind: "groupDetail";
          typeName: string;
          blueprint: Blueprint;
        };

    const renderSortIndicator = (key: keyof Blueprint | "name") =>
      sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

    const flatRows = useMemo<DisplayRow[]>(() => {
      if (groups.length === 0) return [];

      const out: DisplayRow[] = [];
      for (const group of groups) {
        const typeName = group.type_name;
        const blueprints = group.blueprints;
        const firstBlueprint = blueprints[0];
        if (!firstBlueprint) continue;

        const isExpandable = blueprints.length > 1;
        if (!isExpandable) {
          out.push({
            key: `single-${typeName}-${firstBlueprint.key}`,
            kind: "single",
            typeName,
            blueprint: firstBlueprint,
          });
          continue;
        }

        const isExpanded = expandedGroups.has(typeName);
        out.push({
          key: `header-${typeName}`,
          kind: "groupHeader",
          typeName,
          firstBlueprint,
          isExpanded,
        });

        if (isExpanded) {
          for (
            let blueprintIndex = 0;
            blueprintIndex < blueprints.length;
            blueprintIndex++
          ) {
            const blueprint = blueprints[blueprintIndex];
            if (!blueprint) continue;

            out.push({
              key: `detail-${typeName}-${blueprint.key}-${blueprintIndex}`,
              kind: "groupDetail",
              typeName,
              blueprint,
            });
          }
        }
      }

      return out;
      // NOTE: HeroUI table rendering memoizes based on the collection derived
      // from `items`. When selectionState changes, we need the collection to
      // rebuild so checkbox ticks / adjust inputs update visually.
    }, [expandedGroups, groups, selectionState]);

    const renderBlueprintCells = (
      blueprint: Blueprint,
      typeName: string,
      showTypeInfo: boolean,
    ) => {
      const state = selectionState[blueprint.key];

      return [
        <TableCell
          key="name"
          className={
            showTypeInfo ? "flex items-center gap-2 font-semibold" : undefined
          }
        >
          {showTypeInfo ? (
            <>
              <LazyImage
                alt={`${typeName} icon`}
                className="h-10 w-10 flex-shrink-0 rounded-none object-contain"
                height={40}
                width={40}
                src={`https://images.evetech.net/types/${blueprint.type_id}/bpc?size=128`}
              />
              {typeName}
            </>
          ) : null}
        </TableCell>,
        <TableCell key="group">{null}</TableCell>,
        <TableCell key="me">{blueprint.material_efficiency ?? 0}</TableCell>,
        <TableCell key="te">{blueprint.time_efficiency ?? 0}</TableCell>,
        <TableCell key="runs">{blueprint.runs}</TableCell>,
        <TableCell key="qty">{blueprint.quantity}</TableCell>,
        <TableCell key="adjust">
          <div className="flex h-10 items-center justify-center">
            {state?.checked ? (
              <NumberInput
                aria-label={`Adjust quantity for ${typeName}`}
                className="w-20"
                maxValue={blueprint.quantity}
                minValue={1}
                onValueChange={(value) => onValueChange(blueprint, value)}
                size="sm"
                value={state.value}
              />
            ) : (
              <div aria-hidden className="h-9 w-20" />
            )}
          </div>
        </TableCell>,
        <TableCell key="select">
          <Checkbox
            isSelected={state?.checked ?? false}
            onValueChange={(checked) => onCheck(blueprint.key, checked)}
          />
        </TableCell>,
      ];
    };

    return (
      <Table
        aria-label="Collapsible selectable table"
        className={["flex h-full w-full flex-col", className]
          .filter(Boolean)
          .join(" ")}
        isVirtualized={shouldVirtualize}
        isStriped
        isHeaderSticky
        maxTableHeight={shouldVirtualize ? 604 : undefined}
        rowHeight={shouldVirtualize ? 56 : undefined}
      >
        <TableHeader className="bg-default-100/90 text-default-700 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-md dark:bg-default-50/80 dark:text-default-300">
          <TableColumn
            className="cursor-pointer"
            onClick={() => onSort("name")}
          >
            Name
            {renderSortIndicator("name")}
          </TableColumn>
          <TableColumn>Group</TableColumn>
          <TableColumn
            className="cursor-pointer"
            onClick={() => onSort("material_efficiency")}
          >
            ME
            {renderSortIndicator("material_efficiency")}
          </TableColumn>
          <TableColumn
            className="cursor-pointer"
            onClick={() => onSort("time_efficiency")}
          >
            TE
            {renderSortIndicator("time_efficiency")}
          </TableColumn>
          <TableColumn
            className="cursor-pointer"
            onClick={() => onSort("runs")}
          >
            Runs
            {renderSortIndicator("runs")}
          </TableColumn>
          <TableColumn
            className="cursor-pointer"
            onClick={() => onSort("quantity")}
          >
            Quantity
            {renderSortIndicator("quantity")}
          </TableColumn>
          <TableColumn>Adjust</TableColumn>
          <TableColumn>Select</TableColumn>
        </TableHeader>
        <TableBody
          emptyContent="No data"
          isLoading={isLoading}
          loadingContent={<Spinner label="Loading..." />}
          items={flatRows}
        >
          {(row) => {
            if (row.kind === "groupHeader") {
              return (
                <TableRow
                  key={row.key}
                  className="cursor-pointer"
                  onClick={() => onToggleGroup(row.typeName)}
                >
                  <TableCell className="flex items-center gap-2 font-semibold">
                    <LazyImage
                      alt={`${row.typeName} icon`}
                      className="h-10 w-10 flex-shrink-0 rounded-none object-contain"
                      height={40}
                      width={40}
                      src={`https://images.evetech.net/types/${row.firstBlueprint.type_id}/bpc?size=128`}
                    />
                    {row.typeName}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {row.isExpanded ? "Click to collapse" : "Click to expand"}
                  </TableCell>
                  <TableCell>{null}</TableCell>
                  <TableCell>{null}</TableCell>
                  <TableCell>{null}</TableCell>
                  <TableCell>{null}</TableCell>
                  <TableCell>{null}</TableCell>
                  <TableCell>{null}</TableCell>
                </TableRow>
              );
            }

            const showTypeInfo = row.kind === "single";
            return (
              <TableRow key={row.key}>
                {renderBlueprintCells(
                  row.blueprint,
                  row.typeName,
                  showTypeInfo,
                )}
              </TableRow>
            );
          }}
        </TableBody>
      </Table>
    );
  },
);

BlueprintGroupsTable.displayName = "BlueprintGroupsTable";

export default BlueprintGroupsTable;
