import React, { useRef, useEffect, useMemo } from "react";
import "./JsonEditor.css";

const JsonEditor = ({
  value,
  onChange,
  placeholder,
  className = "",
  rows = 10,
}) => {
  const textareaRef = useRef(null);
  const preRef = useRef(null);
  const containerRef = useRef(null);

  // Syntax highlighting function (WITHOUT reformatting - keep value as-is)
  const highlightJSON = useMemo(() => {
    return (json) => {
      if (!json) return "";

      return json
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
          (match) => {
            let cls = "json-number";
            if (/^"/.test(match)) {
              if (/:$/.test(match)) {
                cls = "json-key";
              } else {
                cls = "json-string";
              }
            } else if (/true|false/.test(match)) {
              cls = "json-boolean";
            } else if (/null/.test(match)) {
              cls = "json-null";
            }
            return `<span class="${cls}">${match}</span>`;
          },
        )
        .replace(/([{}[\],])/g, '<span class="json-bracket">$1</span>')
        .replace(/:/g, '<span class="json-punctuation">:</span>');
    };
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const handleScroll = (e) => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = e.target.scrollTop;
      preRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Sync scroll and other properties when value changes
  useEffect(() => {
    if (textareaRef.current && preRef.current && containerRef.current) {
      // Ensure both elements have the same scroll position
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;

      // Auto-expand container to fit content
      const scrollHeight = textareaRef.current.scrollHeight;
      const minHeight = Math.max(rows * 24, scrollHeight);
      textareaRef.current.style.minHeight = `${minHeight}px`;
      preRef.current.style.minHeight = `${minHeight}px`;
    }
  }, [value, rows]);

  // Calculate minimum height based on rows
  const minHeight = rows * 24; // Approximate line height

  return (
    <div ref={containerRef} className={`json-editor-container ${className}`}>
      <pre
        ref={preRef}
        className="json-syntax-highlight"
        dangerouslySetInnerHTML={{ __html: highlightJSON(value) }}
        aria-hidden="true"
        style={{ minHeight: `${minHeight}px` }}
      />
      <textarea
        ref={textareaRef}
        className="json-editor-textarea"
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        placeholder={placeholder}
        rows={rows}
        style={{ minHeight: `${minHeight}px` }}
        spellCheck="false"
      />
    </div>
  );
};

export default JsonEditor;
