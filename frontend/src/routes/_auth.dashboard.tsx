import { Card, CardBody, CardHeader, Skeleton, addToast } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useRequisitionsQuery } from "../api/requisitions";
import { useBlueprintsQuery } from "../api/blueprints";

export const Route = createFileRoute("/_auth/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const {
    data: openRequisitions = [],
    isLoading: areRequisitionsLoading,
    error: requisitionsError,
  } = useRequisitionsQuery(1);

  const {
    data: blueprintGroups = [],
    isLoading: areBlueprintsLoading,
    error: blueprintsError,
  } = useBlueprintsQuery();

  useEffect(() => {
    if (requisitionsError) {
      addToast({
        title: "Requisitions",
        description:
          requisitionsError instanceof Error
            ? requisitionsError.message
            : "Failed to load open requisitions.",
        color: "danger",
      });
    }
  }, [requisitionsError]);

  useEffect(() => {
    if (blueprintsError) {
      addToast({
        title: "Blueprints",
        description:
          blueprintsError instanceof Error
            ? blueprintsError.message
            : "Failed to load blueprints.",
        color: "danger",
      });
    }
  }, [blueprintsError]);

  const { uniqueTypeCount, totalQuantity } = useMemo(() => {
    const typeIds = new Set<number>();
    let quantity = 0;

    for (const group of blueprintGroups) {
      for (const blueprint of group.blueprints) {
        typeIds.add(blueprint.type_id);
        quantity += blueprint.quantity ?? 0;
      }
    }

    return { uniqueTypeCount: typeIds.size, totalQuantity: quantity };
  }, [blueprintGroups]);

  const renderCount = (count: number, isLoading: boolean) => {
    if (isLoading) {
      return <Skeleton className="h-7 w-16 rounded" />;
    }
    return (
      <span className="text-3xl font-semibold text-default-900">{count}</span>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-default-900">Dashboard</h1>
        <p className="text-sm text-default-500">
          Quick overview of current requisitions and blueprint availability.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Card shadow="sm">
          <CardHeader className="flex flex-col items-start gap-1">
            <span className="text-sm uppercase text-default-500">
              Open Requisitions
            </span>
            {renderCount(openRequisitions.length, areRequisitionsLoading)}
          </CardHeader>
          <CardBody className="text-sm text-default-600">
            {areRequisitionsLoading
              ? "Checking current request queue..."
              : openRequisitions.length === 0
                ? "No open requisitions at the moment."
                : "These requests still need attention."}
          </CardBody>
        </Card>

        <Card shadow="sm">
          <CardHeader className="flex flex-col items-start gap-1">
            <span className="text-sm uppercase text-default-500">
              BPC Inventory
            </span>
            {renderCount(uniqueTypeCount, areBlueprintsLoading)}
          </CardHeader>
          <CardBody className="flex flex-col gap-1 text-sm text-default-600">
            {areBlueprintsLoading ? (
              <Skeleton className="h-4 w-32 rounded" />
            ) : (
              <>
                <span>
                  {uniqueTypeCount} {uniqueTypeCount === 1 ? "type" : "types"}
                </span>
                <span>
                  {totalQuantity} total {totalQuantity === 1 ? "BPC" : "BPCs"}{" "}
                  available
                </span>
              </>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
