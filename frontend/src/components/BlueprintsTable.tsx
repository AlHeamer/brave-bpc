import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Snippet,
} from "@heroui/react";
import { memo } from "react";
import type { BlueprintRequest } from "../api/requisitions";
import LazyImage from "./LazyImage";

type BlueprintLineItem = BlueprintRequest["blueprints"][number];

export interface BlueprintsTableProps {
  blueprints: BlueprintLineItem[];
  emptyContent?: string;
  ariaLabel?: string;
  nameAsSnippet?: boolean;
  className?: string;
  compact?: boolean;
}

const BlueprintsTable = memo(
  ({
    blueprints,
    emptyContent = "No blueprints",
    ariaLabel = "Blueprints",
    nameAsSnippet = false,
    compact = false,
    className,
  }: BlueprintsTableProps) => (
    <Table
      aria-label={ariaLabel}
      className={["h-full w-full", className].filter(Boolean).join(" ")}
      isHeaderSticky
      removeWrapper
      shadow="none"
    >
      <TableHeader className="bg-default-100/90 text-default-700 shadow-sm backdrop-blur supports-[backdrop-filter]:backdrop-blur-md dark:bg-default-50/80 dark:text-default-300">
        <TableColumn key="bp">Blueprint</TableColumn>
        <TableColumn key="me" className={compact ? "w-14 whitespace-nowrap" : undefined}>
          ME
        </TableColumn>
        <TableColumn key="te" className={compact ? "w-14 whitespace-nowrap" : undefined}>
          TE
        </TableColumn>
        <TableColumn key="runs" className={compact ? "w-16 whitespace-nowrap" : undefined}>
          Runs
        </TableColumn>
        <TableColumn key="qty" className={compact ? "w-20 whitespace-nowrap" : undefined}>
          Quantity
        </TableColumn>
      </TableHeader>
      <TableBody emptyContent={emptyContent}>
        {blueprints.map((blueprint) => (
          <TableRow
            key={`${blueprint.type_id}-${blueprint.material_efficiency ?? 0}-${blueprint.time_efficiency ?? 0}-${
              blueprint.runs
            }`}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <LazyImage
                  alt={`${blueprint.type_name} icon`}
                  className={
                    compact
                      ? "h-8 w-8 flex-shrink-0 rounded-none object-contain"
                      : "h-12 w-12 flex-shrink-0 rounded-none object-contain"
                  }
                  height={compact ? 32 : 48}
                  width={compact ? 32 : 48}
                  src={`https://images.evetech.net/types/${blueprint.type_id}/bpc?size=64`}
                />
                <div className="min-w-0 flex-1">
                  {nameAsSnippet ? (
                    <Snippet
                      hideSymbol
                      radius="none"
                      size="sm"
                      fullWidth
                      className="min-w-0 w-full max-w-full"
                      classNames={{
                        // Override default `justify-between` so the text area can truly shrink.
                        base: "min-w-0 w-full max-w-full !justify-start",
                        // Make the <pre> participate in flex layout and truncate within the cell.
                        pre: "!min-w-0 !flex-1 truncate font-sans text-sm font-medium text-default-900",
                        copyButton: "flex-shrink-0 self-center",
                      }}
                    >
                      {blueprint.type_name}
                    </Snippet>
                  ) : (
                    <span className="min-w-0 break-words text-sm font-medium text-default-900">
                      {blueprint.type_name}
                    </span>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className={compact ? "whitespace-nowrap" : undefined}>
              {blueprint.material_efficiency ?? 0}
            </TableCell>
            <TableCell className={compact ? "whitespace-nowrap" : undefined}>
              {blueprint.time_efficiency ?? 0}
            </TableCell>
            <TableCell className={compact ? "whitespace-nowrap" : undefined}>
              {blueprint.runs}
            </TableCell>
            <TableCell className={compact ? "whitespace-nowrap" : undefined}>
              {blueprint.quantity ?? 1}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
);

BlueprintsTable.displayName = "BlueprintsTable";

export default BlueprintsTable;
