import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

export interface AppConfig {
  alliances: number[];
  corporations: number[];
  admin_corp: number;
  admin_char: number;
  max_contracts: number;
  max_request_items: number;
  homepage_markdown: string;
}

export interface PublicConfig {
  max_request_items: number;
  homepage_markdown: string;
}

export const DEFAULT_HOMEPAGE_MARKDOWN = `# Welcome to Brave's BPC Request Program!

Thank you for your interest in Brave's BPC Program. This program is intended to help members of Brave Collective build what Brave needs.`;

export const DEFAULT_MAX_REQUEST_ITEMS = 10;

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  max_request_items: DEFAULT_MAX_REQUEST_ITEMS,
  homepage_markdown: DEFAULT_HOMEPAGE_MARKDOWN,
};

export const configQueryKey = ["config"] as const;
export const publicConfigQueryKey = ["public-config"] as const;

type ApiError = {
  msg?: string;
};

type AppConfigWire = Partial<AppConfig>;
type PublicConfigWire = Partial<PublicConfig>;

function normalizeAppConfig(config: AppConfigWire): AppConfig {
  return {
    alliances: Array.isArray(config.alliances) ? config.alliances : [],
    corporations: Array.isArray(config.corporations) ? config.corporations : [],
    admin_corp: Number(config.admin_corp ?? 0),
    admin_char: Number(config.admin_char ?? 0),
    max_contracts: Number(config.max_contracts ?? 0),
    max_request_items: Number(
      config.max_request_items ?? DEFAULT_MAX_REQUEST_ITEMS,
    ),
    homepage_markdown:
      typeof config.homepage_markdown === "string"
        ? config.homepage_markdown
        : DEFAULT_HOMEPAGE_MARKDOWN,
  };
}

function normalizePublicConfig(config: PublicConfigWire): PublicConfig {
  return {
    max_request_items: Number(
      config.max_request_items ?? DEFAULT_MAX_REQUEST_ITEMS,
    ),
    homepage_markdown:
      typeof config.homepage_markdown === "string"
        ? config.homepage_markdown
        : DEFAULT_HOMEPAGE_MARKDOWN,
  };
}

async function throwApiError(
  response: Response,
  fallbackMessage: string,
): Promise<never> {
  let message = `${fallbackMessage} (${response.status})`;

  try {
    const data: ApiError = await response.json();
    if (typeof data.msg === "string" && data.msg.trim().length > 0) {
      message = data.msg;
    }
  } catch {
    // Ignore JSON parsing errors and keep the fallback message.
  }

  throw new Error(message);
}

export async function fetchAppConfig(signal?: AbortSignal): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to load configuration");
  }

  const data = (await response.json()) as AppConfigWire;
  return normalizeAppConfig(data);
}

export async function fetchPublicConfig(
  signal?: AbortSignal,
): Promise<PublicConfig> {
  const response = await fetch("/api/public-config", { signal });

  if (!response.ok) {
    await throwApiError(response, "Failed to load site settings");
  }

  const data = (await response.json()) as PublicConfigWire;
  return normalizePublicConfig(data);
}

async function postConfig(payload: AppConfig): Promise<AppConfig> {
  const response = await fetch("/api/config", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to save configuration");
  }

  const data = (await response.json()) as AppConfigWire;
  return normalizeAppConfig(data);
}

export function useConfigQuery(): UseQueryResult<AppConfig> {
  return useQuery({
    queryKey: configQueryKey,
    queryFn: ({ signal }) => fetchAppConfig(signal),
  });
}

export function usePublicConfigQuery(): UseQueryResult<PublicConfig> {
  return useQuery({
    queryKey: publicConfigQueryKey,
    queryFn: ({ signal }) => fetchPublicConfig(signal),
    placeholderData: DEFAULT_PUBLIC_CONFIG,
  });
}

export function useUpdateConfigMutation(): UseMutationResult<
  AppConfig,
  Error,
  AppConfig
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postConfig,
    onSuccess: (config) => {
      queryClient.setQueryData(configQueryKey, config);
      queryClient.setQueryData(
        publicConfigQueryKey,
        normalizePublicConfig({
          homepage_markdown: config.homepage_markdown,
          max_request_items: config.max_request_items,
        }),
      );
    },
  });
}
