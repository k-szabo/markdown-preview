function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function definitionListExtension() {
  return {
    name: "definitionList",
    level: "block",
    start(source) {
      const match = /^(?!\s)([^\n]+)\n: /m.exec(source);
      return match?.index;
    },
    tokenizer(source) {
      const lines = source.split("\n");
      if (lines.length < 2 || !lines[0].trim() || !lines[1].startsWith(": ")) {
        return;
      }

      const entries = [];
      let index = 0;

      while (index + 1 < lines.length && lines[index].trim()) {
        const term = lines[index];
        index += 1;
        const definitions = [];

        while (index < lines.length && lines[index].startsWith(": ")) {
          definitions.push(lines[index].slice(2));
          index += 1;
        }

        if (definitions.length === 0) {
          break;
        }

        entries.push({ term, definitions });
        if (index >= lines.length || !lines[index].trim()) {
          break;
        }
      }

      if (entries.length === 0) {
        return;
      }

      return {
        type: "definitionList",
        raw: lines.slice(0, index).join("\n"),
        entries,
      };
    },
    renderer(token) {
      const items = token.entries
        .map(
          ({ term, definitions }) =>
            `<dt>${marked.parseInline(term)}</dt>${definitions
              .map((definition) => `<dd>${marked.parseInline(definition)}</dd>`)
              .join("")}`,
        )
        .join("");

      return `<dl>${items}</dl>\n`;
    },
  };
}

function collectCodeTokens(tokens, found = []) {
  tokens.forEach((token) => {
    if (token.type === "code") {
      found.push(token);
    }
    if (Array.isArray(token.tokens)) {
      collectCodeTokens(token.tokens, found);
    }
  });
  return found;
}

function parseChartConfiguration(source) {
  const config = JSON.parse(source);
  const allowedTypes = new Set([
    "bar",
    "line",
    "pie",
    "doughnut",
    "polarArea",
    "radar",
  ]);

  if (
    !config ||
    !allowedTypes.has(config.type) ||
    !Array.isArray(config.labels) ||
    !Array.isArray(config.datasets) ||
    config.datasets.length === 0
  ) {
    throw new Error(
      "A diagram JSON formátuma: type, labels és legalább egy datasets elem.",
    );
  }

  const datasets = config.datasets.map((dataset) => {
    if (
      !dataset ||
      typeof dataset.label !== "string" ||
      !Array.isArray(dataset.data) ||
      !dataset.data.every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    ) {
      throw new Error("Minden adatsorhoz szöveges label és számsor kell.");
    }

    return {
      label: dataset.label,
      data: dataset.data,
      ...(typeof dataset.backgroundColor === "string" ||
      Array.isArray(dataset.backgroundColor)
        ? { backgroundColor: dataset.backgroundColor }
        : {}),
      ...(typeof dataset.borderColor === "string"
        ? { borderColor: dataset.borderColor }
        : {}),
    };
  });

  return {
    type: config.type,
    data: {
      labels: config.labels.map(String),
      datasets,
    },
  };
}

function renderCodeBlock({ text, lang }) {
  const language = lang?.trim().toLowerCase();

  if (language === "mermaid") {
    return `<div class="mermaid">${escapeHtml(text)}</div>`;
  }

  if (language === "dot" || language === "graphviz") {
    return `<div class="graphviz">${escapeHtml(text)}</div>`;
  }

  if (language === "chart") {
    try {
      const config = parseChartConfiguration(text);
      return `<div class="chart-container" data-chart-config="${escapeHtml(
        JSON.stringify(config),
      )}"><canvas role="img" aria-label="Markdown grafikon"></canvas></div>`;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Érvénytelen grafikonadat.";
      return `<pre class="render-error">${escapeHtml(message)}</pre>`;
    }
  }

  const languageClass = language
    ? ` class="language-${escapeHtml(language)}"`
    : "";
  return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>`;
}

window.markdownPreviewMarkdown = {
  escapeHtml,
  definitionListExtension,
  collectCodeTokens,
  renderCodeBlock,
};
