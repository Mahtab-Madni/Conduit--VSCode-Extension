import "./AiResponseFormatter.css";

const AiResponseFormatter = ({ content }) => {
  const parseContent = (text) => {
    if (!text) return [];

    const elements = [];
    const lines = text.split("\n");
    let i = 0;
    let listCounter = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code blocks (```json ... ```)
      if (line.trim().startsWith("```")) {
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        elements.push(
          <div key={`code-${elements.length}`} className="json-block">
            <code>{codeLines.join("\n")}</code>
          </div>,
        );
        i++; // Skip closing ```
        continue;
      }

      // Headers (# ## ###)
      if (line.startsWith("###")) {
        const headerContent = line.substring(3).trim();
        elements.push(<h3 key={`h3-${elements.length}`}>{headerContent}</h3>);
        i++;
        continue;
      }

      if (line.startsWith("##")) {
        const headerContent = line.substring(2).trim();
        elements.push(<h2 key={`h2-${elements.length}`}>{headerContent}</h2>);
        i++;
        continue;
      }

      if (line.startsWith("#")) {
        const headerContent = line.substring(1).trim();
        elements.push(<h1 key={`h1-${elements.length}`}>{headerContent}</h1>);
        i++;
        continue;
      }

      // Bullet lists (- item)
      if (line.trim().startsWith("-")) {
        const listItems = [];
        while (i < lines.length && lines[i].trim().startsWith("-")) {
          const content = lines[i].trim().substring(1).trim();
          listItems.push(
            <li key={`bullet-${listItems.length}`} className="bullet-list">
              {formatInlineText(content)}
            </li>,
          );
          i++;
        }
        elements.push(<ul key={`ul-${elements.length}`}>{listItems}</ul>);
        continue;
      }

      // Numbered lists (1. 2. 3. or step 1:)
      if (
        line.trim().match(/^\d+\.|^Step \d+:|^\[.*\]/) ||
        (line.includes("|") && line.includes("-"))
      ) {
        const content = line.trim().replace(/^\d+\.\s*|^Step \d+:\s*/, "");
        if (content && !line.includes("|")) {
          elements.push(
            <div key={`step-${elements.length}`} className="formatted-content">
              {formatInlineText(content)}
            </div>,
          );
          i++;
          continue;
        }
      }

      // Empty lines
      if (line.trim() === "") {
        i++;
        continue;
      }

      // Regular paragraphs
      if (line.trim()) {
        elements.push(
          <div key={`para-${elements.length}`} className="formatted-content">
            {formatInlineText(line)}
          </div>,
        );
      }

      i++;
    }

    return elements;
  };

  const formatInlineText = (text) => {
    if (!text) return text;

    const parts = [];
    let currentIndex = 0;

    // Pattern to match: **bold**, `code`, and other inline formats
    const regex = /\*\*(.+?)\*\*|`(.+?)`|__(.+?)__|~~(.+?)~~/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index));
      }

      if (match[1]) {
        // Bold text **text**
        parts.push(<strong key={`bold-${parts.length}`}>{match[1]}</strong>);
      } else if (match[2]) {
        // Inline code `text`
        parts.push(
          <code key={`code-${parts.length}`} className="inline-code">
            {match[2]}
          </code>,
        );
      } else if (match[3]) {
        // Bold text __text__
        parts.push(<strong key={`bold98-${parts.length}`}>{match[3]}</strong>);
      } else if (match[4]) {
        // Strikethrough ~~text~~
        parts.push(<s key={`strike-${parts.length}`}>{match[4]}</s>);
      }

      currentIndex = regex.lastIndex;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return <div className="ai-response-formatter">{parseContent(content)}</div>;
};

export default AiResponseFormatter;
