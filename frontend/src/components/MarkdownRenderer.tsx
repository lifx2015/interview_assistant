import React from 'react';
import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
  isStreaming?: boolean;
}

function stripCodeBlock(text: string): string {
  let s = text.trim();
  if (s.startsWith('```markdown')) s = s.slice('```markdown'.length);
  else if (s.startsWith('```Markdown')) s = s.slice('```Markdown'.length);
  else if (s.startsWith('```md')) s = s.slice('```md'.length);
  else if (s.startsWith('```')) s = s.slice(3);
  if (s.endsWith('```')) s = s.slice(0, -3);
  return s.trim();
}

function preprocessContent(text: string): string {
  let s = stripCodeBlock(text);

  // Ensure ### headings start on a new line
  s = s.replace(/([^\n])(#{1,4}\s)/g, '$1\n\n$2');

  // Ensure numbered items like "1." "2." start on a new line if not already
  s = s.replace(/([^\n])((?:\d+)\.\s)/g, '$1\n$2');

  // Ensure **bold** on its own line for key points
  // Split pattern: question text followed immediately by **技术要点** on same line
  s = s.replace(/([^\n])(\*\*[^*]+\*\*)/g, '$1\n\n$2');

  return s.trim();
}

export const MarkdownRenderer: React.FC<Props> = ({ content, isStreaming }) => {
  if (!content) return null;

  return (
    <div className="markdown-body">
      <ReactMarkdown
        components={{
          h3: ({ ...props }) => <h3 className="question-title" {...props} />,
          p: ({ ...props }) => <p className="question-paragraph" {...props} />,
          li: ({ ...props }) => <li className="question-item" {...props} />,
        }}
      >
        {preprocessContent(content)}
      </ReactMarkdown>
      {isStreaming && <span className="md-cursor" />}
    </div>
  );
};
