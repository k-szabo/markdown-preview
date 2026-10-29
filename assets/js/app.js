const input = document.querySelector("#markdown-input");
const preview = document.querySelector("#markdown-preview");
const scriptPromises = new Map();
const stylePromises = new Map();
const featurePromises = new Map();
const themeToggle = document.querySelector("#theme-toggle");
let corePromise;
let graphvizInstance;
let renderVersion = 0;
let activeCharts = [];
let definitionListRegistered = false;
let activeHighlightTheme;

const assets = {
  marked: {
    url: "https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js",
    integrity:
      "sha384-H+hy9ULve6xfxRkWIh/YOtvDdpXgV2fmAGQkIDTxIgZwNoaoBal14Di2YTMR6MzR",
  },
  purify: {
    url: "https://cdn.jsdelivr.net/npm/dompurify@3.2.4/dist/purify.min.js",
    integrity:
      "sha384-eEu5CTj3qGvu9PdJuS+YlkNi7d2XxQROAFYOr59zgObtlcux1ae1Il3u7jvdCSWu",
  },
  mermaid: {
    url: "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js",
    integrity:
      "sha384-rbtjAdnIQE/aQJGEgXrVUlMibdfTSa4PQju4HDhN3sR2PmaKFzhEafuePsl9H/9I",
  },
  katex: {
    url: "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js",
    integrity:
      "sha384-cMkvdD8LoxVzGF/RPUKAcvmm49FQ0oxwDF3BGKtDXcEc+T1b2N+teh/OJfpU0jr6",
  },
  markedKatex: {
    url: "https://cdn.jsdelivr.net/npm/marked-katex-extension@5.1.13/lib/index.umd.js",
    integrity:
      "sha384-znQsAXN+fVvr8zYDa4rV4/xDzH2i+E7ADJecUq9EivZT+JmM53FPEgn6nPK9ThKw",
  },
  footnote: {
    url: "https://cdn.jsdelivr.net/npm/marked-footnote@1.4.0/dist/index.umd.min.js",
    integrity:
      "sha384-U2JaaoXhDznoUlBasI0QYYOcShh12YmdJKK0MMebphXwGi+wTXwp0hB7lk3YKtgH",
  },
  highlight: {
    url: "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js",
    integrity:
      "sha384-RH2xi4eIQ/gjtbs9fUXM68sLSi99C7ZWBRX1vDrVv6GQXRibxXLbwO2NGZB74MbU",
  },
  chart: {
    url: "https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js",
    integrity:
      "sha384-Emf5ZVIUiarAdhkgtqK+5/Z5qIvM6QoVrS+qAVtfyZVuD5lIHrac0me485+Antp0",
  },
  graphviz: {
    url: "https://cdn.jsdelivr.net/npm/@hpcc-js/wasm@2.36.0/dist/graphviz.umd.js",
    integrity:
      "sha384-8noVBjEGuZ/cgYi4GkOoHUm3S6pki8fr4Xn9owf7202wwlc371DlxmjTEjWg3Pul",
  },
};

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

function loadScript(name) {
  if (!scriptPromises.has(name)) {
    const asset = assets[name];
    if (!asset) {
      return Promise.reject(new Error(`Ismeretlen könyvtár: ${name}`));
    }

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = asset.url;
      script.integrity = asset.integrity;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(
          new Error(
            `Nem sikerült betölteni vagy ellenőrizni a(z) ${name} könyvtárat.`,
          ),
        );
      };
      document.head.append(script);
    }).catch((error) => {
      scriptPromises.delete(name);
      throw error;
    });

    scriptPromises.set(name, promise);
  }

  return scriptPromises.get(name);
}

function loadStyle(name, url, integrity, attributes = {}) {
  if (!stylePromises.has(name)) {
    const promise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.integrity = integrity;
      link.crossOrigin = "anonymous";
      Object.entries(attributes).forEach(([key, value]) => {
        link.dataset[key] = value;
      });
      link.onload = () => resolve();
      link.onerror = () => {
        link.remove();
        reject(new Error(`Nem sikerült betölteni a(z) ${name} stíluslapot.`));
      };
      document.head.append(link);
    }).catch((error) => {
      stylePromises.delete(name);
      throw error;
    });

    stylePromises.set(name, promise);
  }

  return stylePromises.get(name);
}

function loadFeature(name, load) {
  if (!featurePromises.has(name)) {
    const promise = load().catch((error) => {
      featurePromises.delete(name);
      throw error;
    });
    featurePromises.set(name, promise);
  }

  return featurePromises.get(name);
}

function ensureCore() {
  if (!corePromise) {
    corePromise = Promise.all([loadScript("marked"), loadScript("purify")])
      .then(() => {
        if (!window.marked || !window.DOMPurify) {
          throw new Error("A Markdown alapkönyvtárak nem érhetők el.");
        }
        if (!definitionListRegistered) {
          marked.use({ extensions: [definitionListExtension()] });
          definitionListRegistered = true;
        }
      })
      .catch((error) => {
        corePromise = undefined;
        throw error;
      });
  }

  return corePromise;
}

async function ensureMermaid(theme) {
  await loadFeature("mermaid", async () => {
    await loadScript("mermaid");
    if (!window.mermaid) {
      throw new Error("A Mermaid könyvtár nem érhető el.");
    }
  });

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: theme === "dark" ? "dark" : "default",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
  });
}

function ensureKatex() {
  return loadFeature("katex", async () => {
    await Promise.all([
      loadScript("katex"),
      loadStyle(
        "KaTeX",
        "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css",
        "sha384-5TcZemv2l/9On385z///+d7MSYlvIEw9FuZTIdZ14vJLqWphw7e7ZPuOiCHJcFCP",
      ),
    ]);
    await loadScript("markedKatex");
    if (!window.katex || !window.markedKatex) {
      throw new Error("A KaTeX könyvtár nem érhető el.");
    }
    marked.use(markedKatex({ throwOnError: false, output: "html" }));
  });
}

function ensureFootnotes() {
  return loadFeature("footnote", async () => {
    await loadScript("footnote");
    if (!window.markedFootnote) {
      throw new Error("A lábjegyzet-kiegészítő nem érhető el.");
    }
    marked.use(markedFootnote());
  });
}

async function ensureHighlight(theme) {
  await loadFeature("highlight", async () => {
    await loadScript("highlight");
    if (!window.hljs) {
      throw new Error("A szintaxiskiemelő könyvtár nem érhető el.");
    }
  });

  const stylesheet =
    theme === "dark"
      ? {
          name: "Highlight.js dark",
          url: "https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github-dark.min.css",
          integrity:
            "sha384-wH75j6z1lH97ZOpMOInqhgKzFkAInZPPSPlZpYKYTOqsaizPvhQZmAtLcPKXpLyH",
        }
      : {
          name: "Highlight.js light",
          url: "https://cdn.jsdelivr.net/npm/highlight.js@11.11.1/styles/github.min.css",
          integrity:
            "sha384-eFTL69TLRZTkNfYZOLM+G04821K1qZao/4QLJbet1pP4tcF+fdXq/9CdqAbWRl/L",
        };

  await loadStyle(
    stylesheet.name,
    stylesheet.url,
    stylesheet.integrity,
    { highlightTheme: theme },
  );
  if (document.documentElement.dataset.theme !== theme) {
    return;
  }

  document
    .querySelectorAll(
      `link[data-highlight-theme]:not([data-highlight-theme="${theme}"])`,
    )
    .forEach((link) => {
      stylePromises.delete(
        theme === "dark" ? "Highlight.js light" : "Highlight.js dark",
      );
      link.remove();
    });
  activeHighlightTheme = theme;
}

function ensureChart() {
  return loadFeature("chart", async () => {
    await loadScript("chart");
    if (!window.Chart) {
      throw new Error("A grafikon-könyvtár nem érhető el.");
    }
  });
}

function ensureGraphviz() {
  return loadFeature("graphviz", async () => {
    await loadScript("graphviz");
    const graphvizModule = window["@hpcc-js/wasm/graphviz"];
    if (!graphvizModule?.Graphviz) {
      throw new Error("A Graphviz könyvtár nem érhető el.");
    }
    graphvizInstance = await graphvizModule.Graphviz.load();
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

function showError(error) {
  if (!preview) {
    throw error;
  }

  preview.textContent = `Az előnézet nem tölthető be: ${
    error instanceof Error ? error.message : String(error)
  }`;
  preview.classList.add("empty-state");
}

function updateThemeButton(theme) {
  if (!themeToggle) {
    return;
  }

  const isDark = theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Világos mód bekapcsolása" : "Sötét mód bekapcsolása",
  );
  themeToggle.title = isDark
    ? "Világos mód bekapcsolása"
    : "Sötét mód bekapcsolása";
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-label").textContent = isDark
    ? "Világos mód"
    : "Sötét mód";
}

function setTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  updateThemeButton(theme);

  if (persist) {
    try {
      localStorage.setItem("markdown-preview-theme", theme);
    } catch (error) {
      console.warn("A témaválasztást nem sikerült elmenteni.", error);
    }
  }

  if (activeHighlightTheme && activeHighlightTheme !== theme) {
    void ensureHighlight(theme).catch(showError);
  }
}

async function renderMarkdown() {
  if (!input || !preview) {
    throw new Error("A Markdown szerkesztő vagy az előnézet nem található.");
  }

  const currentVersion = ++renderVersion;

  try {
    await ensureCore();
    if (currentVersion !== renderVersion) {
      return;
    }

    const markdown = input.value.trim();
    if (!markdown) {
      activeCharts.forEach((chart) => chart.destroy());
      activeCharts = [];
      preview.innerHTML =
        '<p class="empty-state">Az előnézet itt jelenik meg.</p>';
      return;
    }

    const tokens = marked.lexer(markdown);
    const codeTokens = collectCodeTokens(tokens);
    const specialLanguages = new Set([
      "mermaid",
      "dot",
      "graphviz",
      "chart",
    ]);
    const codeLanguages = codeTokens.map((token) =>
      token.lang?.trim().toLowerCase(),
    );
    const hasMermaid = codeLanguages.includes("mermaid");
    const hasGraphviz = codeLanguages.some(
      (language) => language === "dot" || language === "graphviz",
    );
    const hasChart = codeLanguages.includes("chart");
    const hasHighlight = codeLanguages.some(
      (language) => language && !specialLanguages.has(language),
    );
    const hasKatex = markdown.includes("$");
    const hasFootnotes = /\[\^[^\]]+\]/.test(markdown);
    const theme = document.documentElement.dataset.theme || "light";

    await Promise.all([
      ...(hasMermaid ? [ensureMermaid(theme)] : []),
      ...(hasGraphviz ? [ensureGraphviz()] : []),
      ...(hasChart ? [ensureChart()] : []),
      ...(hasHighlight ? [ensureHighlight(theme)] : []),
      ...(hasKatex ? [ensureKatex()] : []),
      ...(hasFootnotes ? [ensureFootnotes()] : []),
    ]);

    if (currentVersion !== renderVersion) {
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
        try {
          const { svg } = await mermaid.render(
            `mermaid-${currentVersion}-${index}`,
            diagram.textContent,
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
      }),
    );

    if (hasHighlight) {
      preview.querySelectorAll("pre code").forEach((code) => {
        hljs.highlightElement(code);
      });
    }

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
                color: theme === "dark" ? "#d0d3dc" : "#666",
                scales:
                  config.type === "pie" ||
                  config.type === "doughnut" ||
                  config.type === "polarArea"
                    ? undefined
                    : {
                        x: {
                          ticks: {
                            color: theme === "dark" ? "#d0d3dc" : "#666",
                          },
                          grid: {
                            color: theme === "dark" ? "#343946" : "#e1e3e8",
                          },
                        },
                        y: {
                          ticks: {
                            color: theme === "dark" ? "#d0d3dc" : "#666",
                          },
                          grid: {
                            color: theme === "dark" ? "#343946" : "#e1e3e8",
                          },
                        },
                      },
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

    if (graphvizInstance) {
      preview.querySelectorAll(".graphviz").forEach((diagram) => {
        try {
          const svg = graphvizInstance.layout(
            diagram.textContent,
            "svg",
            "dot",
          );
          diagram.innerHTML = DOMPurify.sanitize(svg, {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
        } catch (error) {
          diagram.classList.add("render-error");
          diagram.textContent = `A Graphviz diagram nem jeleníthető meg: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      });
    }
  } catch (error) {
    if (currentVersion === renderVersion) {
      showError(error);
    }
  }
}

const appVersion = document.querySelector('meta[name="app-version"]')?.content;
const versionLabel = document.querySelector("#app-version");
if (versionLabel && appVersion) {
  versionLabel.textContent = `v${appVersion}`;
}

setTheme(document.documentElement.dataset.theme || "light");
themeToggle?.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme, true);
  void renderMarkdown();
});

input?.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || event.shiftKey) {
    return;
  }

  event.preventDefault();

  const { selectionStart, selectionEnd, value } = input;
  if (selectionStart === selectionEnd) {
    input.setRangeText("  ", selectionStart, selectionEnd, "end");
  } else {
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const selectedText = value.slice(lineStart, selectionEnd);
    const lines = selectedText.split("\n");
    const hasTrailingLineBreak = selectedText.endsWith("\n");
    const linesToIndent = hasTrailingLineBreak ? lines.slice(0, -1) : lines;
    const indentedText = `${linesToIndent
      .map((line) => `  ${line}`)
      .join("\n")}${hasTrailingLineBreak ? "\n" : ""}`;
    const addedIndent = linesToIndent.length * 2;

    input.setRangeText(indentedText, lineStart, selectionEnd, "preserve");
    input.setSelectionRange(selectionStart + 2, selectionEnd + addedIndent);
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
});
input?.addEventListener("input", renderMarkdown);
void renderMarkdown();
