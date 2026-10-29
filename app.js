const input = document.querySelector("#markdown-input");
const preview = document.querySelector("#markdown-preview");
let renderVersion = 0;
let graphvizPromise;
let activeCharts = [];

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

      const raw = lines.slice(0, index).join("\n");
      return {
        type: "definitionList",
        raw,
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

function loadGraphviz() {
  if (!graphvizPromise) {
    graphvizPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/@hpcc-js/wasm@2.36.0/dist/graphviz.umd.js";
      script.onload = () => {
        const graphvizModule = window["@hpcc-js/wasm/graphviz"];
        if (!graphvizModule?.Graphviz) {
          reject(new Error("A Graphviz könyvtár nem érhető el."));
          return;
        }

        graphvizModule.Graphviz.load().then(resolve, reject);
      };
      script.onerror = () =>
        reject(new Error("A Graphviz könyvtár nem tölthető be."));
      document.head.append(script);
    });
  }

  return graphvizPromise;
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

async function renderMarkdown() {
  if (!input || !preview) {
    throw new Error("A Markdown szerkesztő vagy az előnézet nem található.");
  }

  const currentVersion = ++renderVersion;

  if (
    !window.marked ||
    !window.DOMPurify ||
    !window.mermaid ||
    !window.katex ||
    !window.markedKatex ||
    !window.markedFootnote ||
    !window.hljs ||
    !window.Chart
  ) {
    preview.textContent =
      "A Markdown megjelenítéséhez szükséges könyvtárak nem töltődtek be. Ellenőrizd az internetkapcsolatot, majd frissítsd az oldalt.";
    preview.classList.add("empty-state");
    return;
  }

  const markdown = input.value.trim();

  if (!markdown) {
    activeCharts.forEach((chart) => chart.destroy());
    activeCharts = [];
    preview.innerHTML = '<p class="empty-state">Az előnézet itt jelenik meg.</p>';
    return;
  }

  activeCharts.forEach((chart) => chart.destroy());
  activeCharts = [];

  const renderer = new marked.Renderer();
  renderer.code = renderCodeBlock;

  preview.classList.remove("empty-state");
  preview.innerHTML = DOMPurify.sanitize(
    marked.parse(markdown, { renderer }),
  );

  const diagrams = preview.querySelectorAll(".mermaid");
  await Promise.all(
    [...diagrams].map(async (diagram, index) => {
      const source = diagram.textContent;

      try {
        const { svg } = await mermaid.render(
          `mermaid-${currentVersion}-${index}`,
          source,
        );

        if (currentVersion !== renderVersion || !diagram.isConnected) {
          return;
        }

        diagram.innerHTML = DOMPurify.sanitize(svg, {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
      } catch (error) {
        if (currentVersion !== renderVersion || !diagram.isConnected) {
          return;
        }

        diagram.classList.add("mermaid-error");
        diagram.textContent = `A diagram nem jeleníthető meg: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }    ),
  );

  preview.querySelectorAll("pre code").forEach((code) => {
    hljs.highlightElement(code);
  });

  preview.querySelectorAll(".chart-container").forEach((container) => {
    try {
      const config = JSON.parse(container.dataset.chartConfig);
      const canvas = container.querySelector("canvas");
      if (canvas) {
        activeCharts.push(
          new Chart(canvas, {
            ...config,
            options: {
              responsive: true,
              maintainAspectRatio: true,
            },
          }),
        );
      }
    } catch (error) {
      container.classList.add("render-error");
      container.textContent = `A grafikon nem jeleníthető meg: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  });

  const graphvizDiagrams = preview.querySelectorAll(".graphviz");
  if (graphvizDiagrams.length > 0) {
    try {
      const graphviz = await loadGraphviz();
      await Promise.all(
        [...graphvizDiagrams].map(async (diagram) => {
          const source = diagram.textContent;
          const svg = graphviz.layout(source, "svg", "dot");

          if (currentVersion !== renderVersion || !diagram.isConnected) {
            return;
          }

          diagram.innerHTML = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
        }),
      );
    } catch (error) {
      if (currentVersion === renderVersion) {
        graphvizDiagrams.forEach((diagram) => {
          diagram.classList.add("render-error");
          diagram.textContent = `A Graphviz diagram nem jeleníthető meg: ${
            error instanceof Error ? error.message : String(error)
          }`;
        });
      }
    }
  }
}

marked.use(
  markedFootnote(),
  markedKatex({ throwOnError: false, output: "html" }),
  { extensions: [definitionListExtension()] },
);

if (window.mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
  });
}

input?.addEventListener("input", renderMarkdown);
renderMarkdown();
