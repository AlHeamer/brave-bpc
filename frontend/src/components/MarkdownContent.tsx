import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

function joinClasses(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

const markdownComponents: Components = {
  h1: ({ node, className, ...props }) => (
    <h1
      className={joinClasses(
        "text-4xl font-semibold tracking-tight text-default-900",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ node, className, ...props }) => (
    <h2
      className={joinClasses(
        "mt-10 text-2xl font-semibold text-default-900",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ node, className, ...props }) => (
    <h3
      className={joinClasses(
        "mt-8 text-xl font-semibold text-default-900",
        className,
      )}
      {...props}
    />
  ),
  p: ({ node, className, ...props }) => (
    <p
      className={joinClasses("text-base leading-7 text-default-700", className)}
      {...props}
    />
  ),
  ul: ({ node, className, ...props }) => (
    <ul
      className={joinClasses(
        "list-disc space-y-2 pl-6 text-base leading-7 text-default-700",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ node, className, ...props }) => (
    <ol
      className={joinClasses(
        "list-decimal space-y-2 pl-6 text-base leading-7 text-default-700",
        className,
      )}
      {...props}
    />
  ),
  li: ({ node, className, ...props }) => (
    <li className={joinClasses("pl-1", className)} {...props} />
  ),
  a: ({ node, className, href, ...props }) => {
    const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);

    return (
      <a
        href={href}
        className={joinClasses(
          "font-medium text-primary underline underline-offset-4",
          className,
        )}
        rel={isExternal ? "noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
        {...props}
      />
    );
  },
  blockquote: ({ node, className, ...props }) => (
    <blockquote
      className={joinClasses(
        "border-l-4 border-primary/40 pl-4 italic text-default-600",
        className,
      )}
      {...props}
    />
  ),
  code: ({ node, className, ...props }) => (
    <code
      className={joinClasses(
        "rounded bg-default-100 px-1.5 py-0.5 font-mono text-sm text-default-800",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ node, className, ...props }) => (
    <pre
      className={joinClasses(
        "overflow-x-auto rounded-2xl bg-default-100 p-4 text-sm text-default-800",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ node, className, ...props }) => (
    <hr className={joinClasses("border-default-200", className)} {...props} />
  ),
  table: ({ node, className, ...props }) => (
    <div className="overflow-x-auto rounded-2xl border border-default-200">
      <table
        className={joinClasses("min-w-full border-collapse", className)}
        {...props}
      />
    </div>
  ),
  thead: ({ node, className, ...props }) => (
    <thead className={joinClasses("bg-default-100", className)} {...props} />
  ),
  th: ({ node, className, ...props }) => (
    <th
      className={joinClasses(
        "border-b border-default-200 px-4 py-3 text-left text-sm font-semibold text-default-800",
        className,
      )}
      {...props}
    />
  ),
  td: ({ node, className, ...props }) => (
    <td
      className={joinClasses(
        "border-b border-default-200 px-4 py-3 text-sm text-default-700",
        className,
      )}
      {...props}
    />
  ),
};

interface MarkdownContentProps {
  markdown: string;
  className?: string;
  emptyFallback?: ReactNode;
}

export function MarkdownContent({
  markdown,
  className,
  emptyFallback,
}: MarkdownContentProps) {
  if (markdown.trim().length === 0) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  return (
    <div className={joinClasses("space-y-5", className)}>
      <ReactMarkdown
        components={markdownComponents}
        remarkPlugins={[remarkGfm]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownContent;
