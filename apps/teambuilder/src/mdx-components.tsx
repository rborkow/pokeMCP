import type { MDXComponents } from "mdx/types";

/**
 * Global MDX component map (required by @next/mdx for App Router).
 *
 * Reports are read by AI crawlers that execute no JavaScript, so every element
 * here renders as plain semantic HTML — tables stay <table>, no client
 * components, no virtualization. Keep numbers in markup, not in attributes.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
    return {
        h2: ({ children, ...props }) => (
            <h2
                className="mt-10 mb-4 text-xl font-semibold tracking-tight text-foreground"
                {...props}
            >
                {children}
            </h2>
        ),
        h3: ({ children, ...props }) => (
            <h3 className="mt-8 mb-3 text-lg font-semibold text-foreground" {...props}>
                {children}
            </h3>
        ),
        p: ({ children, ...props }) => (
            <p className="my-4 leading-7 text-muted-foreground" {...props}>
                {children}
            </p>
        ),
        ul: ({ children, ...props }) => (
            <ul className="my-4 ml-6 list-disc space-y-2 text-muted-foreground" {...props}>
                {children}
            </ul>
        ),
        ol: ({ children, ...props }) => (
            <ol className="my-4 ml-6 list-decimal space-y-2 text-muted-foreground" {...props}>
                {children}
            </ol>
        ),
        a: ({ children, ...props }) => (
            <a className="text-foreground underline underline-offset-4" {...props}>
                {children}
            </a>
        ),
        strong: ({ children, ...props }) => (
            <strong className="font-semibold text-foreground" {...props}>
                {children}
            </strong>
        ),
        table: ({ children, ...props }) => (
            <div className="my-6 w-full overflow-x-auto">
                <table className="w-full border-collapse text-sm" {...props}>
                    {children}
                </table>
            </div>
        ),
        thead: ({ children, ...props }) => (
            <thead className="border-b border-border text-left" {...props}>
                {children}
            </thead>
        ),
        th: ({ children, ...props }) => (
            <th className="signal-mono px-3 py-2 font-medium text-muted-foreground" {...props}>
                {children}
            </th>
        ),
        td: ({ children, ...props }) => (
            <td className="border-b border-border px-3 py-2 text-foreground" {...props}>
                {children}
            </td>
        ),
        blockquote: ({ children, ...props }) => (
            <blockquote
                className="my-6 border-l-2 border-border pl-4 italic text-muted-foreground"
                {...props}
            >
                {children}
            </blockquote>
        ),
        ...components,
    };
}
