import {
  Button,
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
type BlueprintLineItemWithSelection = BlueprintLineItem & {
  selectionKey?: string;
};

export interface BlueprintsTableProps {
  blueprints: BlueprintLineItemWithSelection[];
  emptyContent?: string;
  ariaLabel?: string;
  nameAsSnippet?: boolean;
  className?: string;
  compact?: boolean;
  onRemove?: (selectionKey: string) => void;
}

const BlueprintsTable = memo(
  ({
    blueprints,
    emptyContent = "No blueprints",
    ariaLabel = "Blueprints",
    nameAsSnippet = false,
    compact = false,
    className,
    onRemove,
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
        <TableColumn
          key="me"
          className={[
            "hidden md:table-cell",
            compact ? "w-14 whitespace-nowrap" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          ME
        </TableColumn>
        <TableColumn
          key="te"
          className={[
            "hidden md:table-cell",
            compact ? "w-14 whitespace-nowrap" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          TE
        </TableColumn>
        <TableColumn
          key="runs"
          className={[
            "hidden md:table-cell",
            compact ? "w-16 whitespace-nowrap" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          Runs
        </TableColumn>
        <TableColumn
          key="qty"
          className={[
            "hidden md:table-cell",
            compact ? "w-20 whitespace-nowrap" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          Quantity
        </TableColumn>
        <TableColumn
          key="remove"
          className={onRemove ? "w-12 whitespace-nowrap" : "hidden"}
        >
          {" "}
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

                  <div className="mt-1 text-xs text-default-500 md:hidden">
                    <span className="whitespace-nowrap">
                      ME {blueprint.material_efficiency ?? 0}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="whitespace-nowrap">
                      TE {blueprint.time_efficiency ?? 0}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="whitespace-nowrap">
                      Runs {blueprint.runs}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="whitespace-nowrap">
                      Qty {blueprint.quantity ?? 1}
                    </span>
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell
              className={[
                "hidden md:table-cell",
                compact ? "whitespace-nowrap" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {blueprint.material_efficiency ?? 0}
            </TableCell>
            <TableCell
              className={[
                "hidden md:table-cell",
                compact ? "whitespace-nowrap" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {blueprint.time_efficiency ?? 0}
            </TableCell>
            <TableCell
              className={[
                "hidden md:table-cell",
                compact ? "whitespace-nowrap" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {blueprint.runs}
            </TableCell>
            <TableCell
              className={[
                "hidden md:table-cell",
                compact ? "whitespace-nowrap" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {blueprint.quantity ?? 1}
            </TableCell>

            <TableCell className={onRemove ? "whitespace-nowrap" : "hidden"}>
              {onRemove ? (
                <Button
                  aria-label={`Remove ${blueprint.type_name}`}
                  className="min-w-0 px-2"
                  color="danger"
                  isDisabled={!blueprint.selectionKey}
                  onPress={() =>
                    blueprint.selectionKey
                      ? onRemove(blueprint.selectionKey)
                      : undefined
                  }
                  size="sm"
                  variant="light"
                >
                  ✕
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
);

BlueprintsTable.displayName = "BlueprintsTable";

export default BlueprintsTable;
