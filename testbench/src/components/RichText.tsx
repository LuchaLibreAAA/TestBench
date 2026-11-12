import React, { useMemo } from 'react';
import type { LocalizedText } from '@/core/schema';
import { resolveText } from '@/core/utils/localized-text';
import katex from 'katex';
import DOMPurify from 'dompurify';

export interface RichTextProps {
  content?: LocalizedText;
  language?: string;
  className?: string;
}

const mathCache = new Map<string, string>();

function renderMath(formula: string, displayMode: boolean): string {
  const cacheKey = `${displayMode ? 'D' : 'I'}:${formula}`;
  const cached = mathCache.get(cacheKey);
  if (cached) return cached;

  try {
    const html = katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      strict: false,
    });
    mathCache.set(cacheKey, html);
    return html;
  } catch (err) {
    console.warn('KaTeX render error:', err);
    return `<code class="font-mono text-red-600 bg-red-50 px-1 py-0.5 rounded text-xs">${formula}</code>`;
  }
}

/**
 * Parses and formats markdown and KaTeX LaTeX math ($...$ and $$...$$).
 */
function parseInlineMarkup(text: string): React.ReactNode[] {
  // First, extract block math $$...$$
  const blockParts = text.split(/(\$\$[\s\S]+?\$\$)/g);
  const result: React.ReactNode[] = [];

  blockParts.forEach((blockPart, bIdx) => {
    if (!blockPart) return;

    if (blockPart.startsWith('$$') && blockPart.endsWith('$$')) {
      const math = blockPart.slice(2, -2).trim();
      const renderedHtml = renderMath(math, true);
      const cleanHtml = DOMPurify.sanitize(renderedHtml);

      result.push(
        <div
          key={`block-${bIdx}`}
          className="my-3 overflow-x-auto py-1 text-center"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
      return;
    }

    // Now handle inline lines and tokens
    const lines = blockPart.split('\n');

    lines.forEach((line, lineIdx) => {
      if (lineIdx > 0) {
        result.push(<br key={`br-${bIdx}-${lineIdx}`} />);
      }

      // Match inline math ($...$), bold (**...**), italic (*...*), sub (~...~), sup (^...^)
      const tokens = line.split(/(\$[^$]+?\$|\*\*[^*]+?\*\*|\*[^*]+?\*|\^[^^]+?\^|~[^~]+?~)/g);

      tokens.forEach((token, tIdx) => {
        const key = `${bIdx}-${lineIdx}-${tIdx}`;
        if (!token) return;

        if (token.startsWith('$') && token.endsWith('$')) {
          const math = token.slice(1, -1);
          const renderedHtml = renderMath(math, false);
          const cleanHtml = DOMPurify.sanitize(renderedHtml);

          result.push(
            <span
              key={key}
              className="inline-math inline-block align-baseline px-0.5"
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
          );
        } else if (token.startsWith('**') && token.endsWith('**')) {
          result.push(
            <strong key={key} className="font-bold text-gray-900">
              {token.slice(2, -2)}
            </strong>
          );
        } else if (token.startsWith('*') && token.endsWith('*')) {
          result.push(
            <em key={key} className="italic">
              {token.slice(1, -1)}
            </em>
          );
        } else if (token.startsWith('^') && token.endsWith('^')) {
          result.push(<sup key={key}>{token.slice(1, -1)}</sup>);
        } else if (token.startsWith('~') && token.endsWith('~')) {
          result.push(<sub key={key}>{token.slice(1, -1)}</sub>);
        } else {
          result.push(<span key={key}>{token}</span>);
        }
      });
    });
  });

  return result;
}

export const RichText: React.FC<RichTextProps> = ({
  content,
  language = 'en',
  className = '',
}) => {
  const raw = content ? resolveText(content, language) : '';
  const rendered = useMemo(() => parseInlineMarkup(raw), [raw]);

  if (!content) return null;

  return (
    <div className={`leading-relaxed text-slate-800 dark:text-slate-200 break-words ${className}`}>
      {rendered}
    </div>
  );
};
