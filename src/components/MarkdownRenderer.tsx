import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  fontSize?: 'small' | 'medium' | 'large';
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children || '').replace(/\n$/, '');
  const match = /language-(\w+)/.exec(className || '');
  const lang = match?.[1] || 'code';
  const isInline = !className && !codeText.includes('\n');

  if (isInline) {
    return (
      <code className="rounded bg-slate-200/80 dark:bg-slate-800/90 px-1.5 py-0.5 font-mono text-[0.85em] text-cyan-800 dark:text-cyan-300">
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
        <span className="font-mono text-slate-400">{lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed">
        <code>{codeText}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content, fontSize = 'medium' }: MarkdownRendererProps) {
  const sizeClass =
    fontSize === 'small'
      ? 'text-[13.5px]'
      : fontSize === 'large'
      ? 'text-[16.5px]'
      : 'text-[15px]';

  return (
    <div className={`jarvis-markdown ${sizeClass} text-slate-800 dark:text-slate-100 break-words`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children }) {
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-cyan-500/60 underline-offset-2 hover:text-cyan-400"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
