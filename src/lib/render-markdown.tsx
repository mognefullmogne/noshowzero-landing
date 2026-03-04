import React from "react";

/**
 * Renders inline markdown bold (**text**) as <strong> elements.
 * Lightweight — avoids pulling in a full markdown library.
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/**
 * Renders a block of text with line-by-line markdown support:
 * - ## and ### headings
 * - **bold** inline
 * - bullet lists (- or *)
 * - numbered lists (1. 2. etc.)
 * - blank lines as spacing
 */
export function MarkdownBlock({
  text,
  className,
}: {
  readonly text: string;
  readonly className?: string;
}) {
  const lines = text.split("\n");

  return (
    <div className={className ?? "space-y-1 text-sm text-gray-700"}>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="text-sm font-semibold text-gray-900 mt-4 mb-1 first:mt-0"
            >
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4
              key={i}
              className="text-xs font-semibold text-gray-800 mt-3 mb-0.5"
            >
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 text-xs text-gray-600">
              <span className="shrink-0 text-gray-400 mt-0.5">&bull;</span>
              <span>{renderInlineMarkdown(line.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\. /.test(line)) {
          return (
            <div key={i} className="flex gap-2 text-xs text-gray-600">
              <span className="shrink-0 text-gray-500 font-medium">
                {line.match(/^\d+/)?.[0]}.
              </span>
              <span>{renderInlineMarkdown(line.replace(/^\d+\. /, ""))}</span>
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1" />;
        }
        return (
          <p key={i} className="text-xs text-gray-600 leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}
