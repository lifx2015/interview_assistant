import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

interface Props {
  content: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer: React.FC<Props> = ({ content, isStreaming }) => {
  if (!content) return null;

  return (
    <div className="markdown-body">
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
      {isStreaming && <span className="md-cursor" />}
    </div>
  );
};
