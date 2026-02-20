import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { memo } from "react";
import type { BlueprintRequest } from "../api/requisitions";
import LazyImage from "./LazyImage";

type BlueprintLineItem = BlueprintRequest["blueprints"][number];

export interface BlueprintsTableProps {
  blueprints: BlueprintLineItem[];
  emptyContent?: string;
  ariaLabel?: string;
  className?: string;
}

const BlueprintsTable = memo(
  ({
    blueprints,
    emptyContent = "No blueprints",
    ariaLabel = "Blueprints",
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
        <TableColumn key="me">ME</TableColumn>
        <TableColumn key="te">TE</TableColumn>
        <TableColumn key="runs">Runs</TableColumn>
        <TableColumn key="qty">Quantity</TableColumn>
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
                  className="h-12 w-12 flex-shrink-0 rounded-none object-contain"
                  height={48}
                  width={48}
                  src={`https://images.evetech.net/types/${blueprint.type_id}/bpc?size=64`}
                />
                <span className="min-w-0 break-words text-sm font-medium text-default-900">
                  {blueprint.type_name}
                </span>
              </div>
            </TableCell>
            <TableCell>{blueprint.material_efficiency ?? 0}</TableCell>
            <TableCell>{blueprint.time_efficiency ?? 0}</TableCell>
            <TableCell>{blueprint.runs}</TableCell>
            <TableCell>{blueprint.quantity ?? 1}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
);

BlueprintsTable.displayName = "BlueprintsTable";

export default BlueprintsTable;
