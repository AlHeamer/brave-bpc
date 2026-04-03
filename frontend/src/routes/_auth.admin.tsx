import { Button, Input, Spinner, Textarea, addToast } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  type AppConfig,
  useConfigQuery,
  useUpdateConfigMutation,
} from "../api/config";
import MarkdownContent from "../components/MarkdownContent";
import { buildScopeLoginHref } from "../utils/auth";

export const Route = createFileRoute("/_auth/admin")({
  component: RouteComponent,
});

interface ConfigFormState {
  alliances: string;
  corporations: string;
  admin_corp: string;
  admin_char: string;
  max_contracts: string;
  max_request_items: string;
  homepage_markdown: string;
}

const emptyFormState: ConfigFormState = {
  alliances: "",
  corporations: "",
  admin_corp: "",
  admin_char: "",
  max_contracts: "",
  max_request_items: "",
  homepage_markdown: "",
};

function idsToFieldValue(values: number[]) {
  return values.join("\n");
}

function configToFormState(config: AppConfig): ConfigFormState {
  return {
    alliances: idsToFieldValue(config.alliances),
    corporations: idsToFieldValue(config.corporations),
    admin_corp: String(config.admin_corp),
    admin_char: String(config.admin_char),
    max_contracts: String(config.max_contracts),
    max_request_items: String(config.max_request_items),
    homepage_markdown: config.homepage_markdown,
  };
}

function parsePositiveInteger(label: string, rawValue: string) {
  const parsed = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseIdList(label: string, rawValue: string) {
  const tokens = rawValue
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return tokens.map((token) => {
    const parsed = Number.parseInt(token, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`${label} must contain only positive integers.`);
    }

    return parsed;
  });
}

function formToConfig(form: ConfigFormState): AppConfig {
  return {
    alliances: parseIdList("Alliance whitelist", form.alliances),
    corporations: parseIdList("Corporation whitelist", form.corporations),
    admin_corp: parsePositiveInteger("Admin corporation", form.admin_corp),
    admin_char: parsePositiveInteger("Admin character", form.admin_char),
    max_contracts: parsePositiveInteger("Max contracts", form.max_contracts),
    max_request_items: parsePositiveInteger(
      "Max request items",
      form.max_request_items,
    ),
    homepage_markdown: form.homepage_markdown,
  };
}

function RouteComponent() {
  const { data: config, error, isLoading, refetch } = useConfigQuery();
  const updateConfig = useUpdateConfigMutation();
  const [form, setForm] = useState<ConfigFormState>(emptyFormState);
  const scopeLoginHref = buildScopeLoginHref();

  useEffect(() => {
    if (!config) {
      return;
    }

    setForm(configToFormState(config));
  }, [config]);

  useEffect(() => {
    if (!error) {
      return;
    }

    addToast({
      title: "Configuration",
      description:
        error instanceof Error
          ? error.message
          : "Unable to load the current configuration.",
      color: "danger",
    });
  }, [error]);

  const setFieldValue = (field: keyof ConfigFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      const nextConfig = formToConfig(form);
      await updateConfig.mutateAsync(nextConfig);
      addToast({
        title: "Configuration saved",
        description: "Site settings were updated successfully.",
        color: "success",
      });
    } catch (saveError) {
      addToast({
        title: "Save failed",
        description:
          saveError instanceof Error
            ? saveError.message
            : "Unable to save the configuration.",
        color: "danger",
      });
    }
  };

  if (isLoading && !config) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner label="Loading configuration..." size="lg" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-2xl border border-danger-200 bg-danger-50 p-6 text-danger-700">
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p>Unable to load the current configuration.</p>
        <div>
          <Button color="danger" variant="flat" onPress={() => void refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-default-900">
          Administration
        </h1>
        <p className="text-sm text-default-500">
          Manage site-wide settings, homepage content, and admin OAuth actions.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="flex flex-col gap-6 rounded-3xl border border-default-200 bg-content1 p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              aria-label="Admin corporation"
              label="Admin corporation"
              type="number"
              value={form.admin_corp}
              onValueChange={(value) => setFieldValue("admin_corp", value)}
            />
            <Input
              aria-label="Admin character"
              label="Admin character"
              type="number"
              value={form.admin_char}
              onValueChange={(value) => setFieldValue("admin_char", value)}
            />
            <Input
              aria-label="Max contracts"
              label="Max contracts"
              type="number"
              value={form.max_contracts}
              onValueChange={(value) => setFieldValue("max_contracts", value)}
            />
            <Input
              aria-label="Max request items"
              label="Max request items"
              type="number"
              value={form.max_request_items}
              onValueChange={(value) =>
                setFieldValue("max_request_items", value)
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Textarea
              aria-label="Alliance whitelist"
              description="One alliance ID per line or comma-separated. Leave blank to allow any alliance."
              label="Alliance whitelist"
              minRows={6}
              value={form.alliances}
              onValueChange={(value) => setFieldValue("alliances", value)}
            />
            <Textarea
              aria-label="Corporation whitelist"
              description="One corporation ID per line or comma-separated. Leave blank to allow any corporation."
              label="Corporation whitelist"
              minRows={6}
              value={form.corporations}
              onValueChange={(value) => setFieldValue("corporations", value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-default-200 bg-content1 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-default-900">
            Admin OAuth
          </h2>
          <p className="text-sm leading-6 text-default-600">
            Use the backend OAuth flow to store the required corporation scopes
            for the configured admin character.
          </p>
          <Button as="a" color="secondary" href={scopeLoginHref} variant="flat">
            Grant Required Scopes
          </Button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 rounded-3xl border border-default-200 bg-content1 p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-default-900">
              Homepage markdown
            </h2>
            <p className="text-sm leading-6 text-default-500">
              This content is shown on the public homepage and supports Markdown
              formatting.
            </p>
          </div>
          <Textarea
            aria-label="Homepage markdown"
            minRows={16}
            placeholder="# Welcome"
            value={form.homepage_markdown}
            onValueChange={(value) => setFieldValue("homepage_markdown", value)}
          />
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-default-200 bg-content1 p-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-default-900">Preview</h2>
            <p className="text-sm leading-6 text-default-500">
              This preview matches the public homepage renderer.
            </p>
          </div>
          <MarkdownContent
            markdown={form.homepage_markdown}
            emptyFallback={
              <p className="text-sm leading-6 text-default-500">
                Add some markdown to preview the homepage content.
              </p>
            }
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          color="primary"
          isLoading={updateConfig.isPending}
          onPress={() => void handleSave()}
        >
          Save settings
        </Button>
      </div>
    </div>
  );
}

export default RouteComponent;
