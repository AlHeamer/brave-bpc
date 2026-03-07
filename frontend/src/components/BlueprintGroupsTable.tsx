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
          summary: {
            meMin: number;
            meMax: number;
            teMin: number;
            teMax: number;
            runsMin: number;
            runsMax: number;
            qtyTotal: number;
          };
        }
      | {
          key: string;
          kind: "groupDetail";
          typeName: string;
          blueprint: Blueprint;
        };

    const summarizeGroup = (blueprints: Blueprint[]) => {
      let meMin = Number.POSITIVE_INFINITY;
      let meMax = Number.NEGATIVE_INFINITY;
      let teMin = Number.POSITIVE_INFINITY;
      let teMax = Number.NEGATIVE_INFINITY;
      let runsMin = Number.POSITIVE_INFINITY;
      let runsMax = Number.NEGATIVE_INFINITY;
      let qtyTotal = 0;

      for (const bp of blueprints) {
        const me = bp.material_efficiency ?? 0;
        const te = bp.time_efficiency ?? 0;
        const runs = bp.runs;
        const qty = bp.quantity ?? 0;

        meMin = Math.min(meMin, me);
        meMax = Math.max(meMax, me);
        teMin = Math.min(teMin, te);
        teMax = Math.max(teMax, te);
        runsMin = Math.min(runsMin, runs);
        runsMax = Math.max(runsMax, runs);
        qtyTotal += qty;
      }

      if (!Number.isFinite(meMin)) meMin = 0;
      if (!Number.isFinite(teMin)) teMin = 0;
      if (!Number.isFinite(runsMin)) runsMin = 0;
      if (!Number.isFinite(meMax)) meMax = meMin;
      if (!Number.isFinite(teMax)) teMax = teMin;
      if (!Number.isFinite(runsMax)) runsMax = runsMin;

      return { meMin, meMax, teMin, teMax, runsMin, runsMax, qtyTotal };
    };

    const renderSortIndicator = (key: keyof Blueprint | "name") =>
      sortKey === key ? (sortAsc ? " ▲" : " ▼") : "";

    const flatRows = useMemo<DisplayRow[]>(() => {
      // HeroUI table rendering memoizes based on the collection derived from
      // `items`. When selectionState changes, we need the collection to rebuild
      // so checkbox ticks / adjust inputs update visually.
      const selectionStateNonce = Object.keys(selectionState).length;
      if (selectionStateNonce < 0) return [];

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
          summary: summarizeGroup(blueprints),
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
    }, [expandedGroups, groups, selectionState]);

    const renderBlueprintCells = (
      blueprint: Blueprint,
      typeName: string,
      showTypeInfo: boolean,
    ) => {
      const state = selectionState[blueprint.key];

      const me = blueprint.material_efficiency ?? 0;
      const te = blueprint.time_efficiency ?? 0;
      const runs = blueprint.runs;
      const qty = blueprint.quantity;

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
              <div className="flex min-w-0 flex-col">
                <div className="min-w-0 break-words">{typeName}</div>
                <div className="text-xs font-normal text-default-500 md:hidden">
                  ME {me} · TE {te} · Runs {runs} · Qty {qty}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col">
              <div className="text-sm font-medium text-default-900">Copy</div>
              <div className="text-xs text-default-500 md:hidden">
                ME {me} · TE {te} · Runs {runs} · Qty {qty}
              </div>
            </div>
          )}
        </TableCell>,
        <TableCell key="group" className="hidden md:table-cell">
          {null}
        </TableCell>,
        <TableCell key="me" className="hidden md:table-cell">
          {me}
        </TableCell>,
        <TableCell key="te" className="hidden md:table-cell">
          {te}
        </TableCell>,
        <TableCell key="runs" className="hidden md:table-cell">
          {runs}
        </TableCell>,
        <TableCell key="qty" className="hidden md:table-cell">
          {qty}
        </TableCell>,
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
          <TableColumn className="hidden md:table-cell">Group</TableColumn>
          <TableColumn
            className="hidden cursor-pointer md:table-cell"
            onClick={() => onSort("material_efficiency")}
          >
            ME
            {renderSortIndicator("material_efficiency")}
          </TableColumn>
          <TableColumn
            className="hidden cursor-pointer md:table-cell"
            onClick={() => onSort("time_efficiency")}
          >
            TE
            {renderSortIndicator("time_efficiency")}
          </TableColumn>
          <TableColumn
            className="hidden cursor-pointer md:table-cell"
            onClick={() => onSort("runs")}
          >
            Runs
            {renderSortIndicator("runs")}
          </TableColumn>
          <TableColumn
            className="hidden cursor-pointer md:table-cell"
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
              const hintTextDesktop = row.isExpanded
                ? "Click to collapse"
                : "Click to expand";
              const hintTextMobile = row.isExpanded ? "Collapse" : "Expand";

              const range = (min: number, max: number) =>
                min === max ? String(min) : `${min}–${max}`;
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
                    <div className="flex min-w-0 flex-col">
                      <div className="min-w-0 break-words">{row.typeName}</div>
                      <div className="text-xs font-normal text-default-500 md:hidden">
                        ME {range(row.summary.meMin, row.summary.meMax)} · TE{" "}
                        {range(row.summary.teMin, row.summary.teMax)} · Runs{" "}
                        {range(row.summary.runsMin, row.summary.runsMax)} · Qty{" "}
                        {row.summary.qtyTotal}
                      </div>
                      <div className="text-xs font-normal text-default-500 md:hidden">
                        {hintTextMobile}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-default-500 md:table-cell">
                    {hintTextDesktop}
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
