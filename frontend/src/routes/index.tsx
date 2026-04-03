import { createFileRoute } from "@tanstack/react-router";
import { DEFAULT_PUBLIC_CONFIG, usePublicConfigQuery } from "../api/config";
import MarkdownContent from "../components/MarkdownContent";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: publicConfig } = usePublicConfigQuery();
  const config = publicConfig ?? DEFAULT_PUBLIC_CONFIG;

  return (
    <section className="-mt-3 mx-auto flex w-full max-w-7xl flex-col sm:-mt-4">
      <div className="relative flex min-h-[72vh] flex-col overflow-hidden rounded-[2rem] border border-default-200 bg-gradient-to-br from-content1 via-content1 to-content2 px-6 py-6 shadow-sm sm:min-h-[78vh] sm:px-10 sm:py-8 lg:px-14 lg:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.06),transparent_28%)]" />
        <div className="relative flex max-w-4xl flex-col gap-5 sm:gap-6">
          <MarkdownContent
            className="space-y-6"
            markdown={config.homepage_markdown}
            emptyFallback={
              <p className="text-base leading-7 text-default-600">
                Homepage content has not been configured yet.
              </p>
            }
          />
          <p className="inline-flex w-fit rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            {config.max_request_items} maximum items per request
          </p>
        </div>
      </div>
    </section>
  );
}

export default RouteComponent;
