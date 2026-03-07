import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

export interface BlueprintLineItem {
  type_id: number;
  runs: number;
  material_efficiency?: number;
  time_efficiency?: number;
  quantity?: number;
  type_name: string;
}

type BlueprintLineItemWire = Omit<
  BlueprintLineItem,
  "material_efficiency" | "time_efficiency"
> & {
  // Backend currently uses `me`/`te` for requisition blueprint lines.
  me?: number;
  te?: number;

  // Accept the alternative names as well (tolerance for future changes).
  material_efficiency?: number;
  time_efficiency?: number;
};

export interface RequisitionLock {
  locked_at: string;
  character_id: number;
  character_name: string;
}

export interface BlueprintRequest {
  id: number;
  character_id: number;
  character_name: string;
  status?: number | string;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  public_notes?: string;
  lock?: RequisitionLock | null;
  blueprints: BlueprintLineItem[];
}

type BlueprintRequestWire = Omit<BlueprintRequest, "blueprints"> & {
  blueprints: BlueprintLineItemWire[];
};

export interface CreateRequisitionBlueprint {
  type_name: string;
  type_id: number;
  runs: number;
  me: number;
  te: number;
  quantity: number;
}

export interface CreateRequisitionPayload {
  blueprints: CreateRequisitionBlueprint[];
}

export const requisitionsQueryKey = ["requisitions"] as const;

interface FetchRequisitionsOptions {
  signal?: AbortSignal;
  status?: number;
}

function buildRequisitionsUrl(status?: number) {
  const search = new URLSearchParams();
  if (status != null) {
    search.set("status", String(status));
  }
  const suffix = search.toString();
  return suffix.length > 0 ? `/api/requisition?${suffix}` : "/api/requisition";
}

export async function fetchRequisitions({
  signal,
  status,
}: FetchRequisitionsOptions = {}) {
  const response = await fetch(buildRequisitionsUrl(status), {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load requisitions (${response.status})`);
  }

  const data: BlueprintRequestWire[] = await response.json();

  return data.map((request) => ({
    ...request,
    blueprints: (request.blueprints ?? []).map((bp) => ({
      type_id: bp.type_id,
      runs: bp.runs,
      quantity: bp.quantity,
      type_name: bp.type_name,
      material_efficiency: bp.material_efficiency ?? bp.me,
      time_efficiency: bp.time_efficiency ?? bp.te,
    })),
  }));
}

export function useRequisitionsQuery(
  status?: number,
): UseQueryResult<BlueprintRequest[]> {
  return useQuery({
    queryKey:
      status == null
        ? requisitionsQueryKey
        : ([...requisitionsQueryKey, { status }] as const),
    queryFn: ({ signal }) => fetchRequisitions({ signal, status }),
  });
}

async function postRequisition(payload: CreateRequisitionPayload) {
  const response = await fetch("/api/requisition", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to create requisition (${response.status})`);
  }

  return response.json().catch(() => undefined);
}

export function useCreateRequisitionMutation(): UseMutationResult<
  unknown,
  Error,
  CreateRequisitionPayload
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postRequisition,
    onSuccess: () => invalidateRequisitions(queryClient),
  });
}

export function invalidateRequisitions(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: requisitionsQueryKey });
}
