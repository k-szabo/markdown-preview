const markdownInputElement = document.querySelector("#markdown-input");
const markdownPreviewElement = document.querySelector("#markdown-preview");
const markdownThemeToggle = document.querySelector("#theme-toggle");
const renderDependencies = window.markdownPreviewDependencies;
const renderMarkdownUtils = window.markdownPreviewMarkdown;
let markdownRenderVersion = 0;
let activeCharts = [];

function normalizeMermaidSvgText(svg) {
  return svg.replace(/>([^<]*)</g, (match, text) =>
    `>${text.replace(/&amp;(amp|lt|gt);/g, "&$1;")}<`,
  );
}

function showError(error) {
  if (!markdownPreviewElement) {
    throw error;
  }

  markdownPreviewElement.textContent = `Az előnézet nem tölthető be: ${
    error instanceof Error ? error.message : String(error)
  }`;
  markdownPreviewElement.classList.add("empty-state");
}

function updateThemeButton(theme) {
  if (!markdownThemeToggle) {
    return;
  }

  const isDark = theme === "dark";
  markdownThemeToggle.setAttribute("aria-pressed", String(isDark));
  markdownThemeToggle.setAttribute(
    "aria-label",
    isDark ? "Világos mód bekapcsolása" : "Sötét mód bekapcsolása",
  );
  markdownThemeToggle.title = isDark
    ? "Világos mód bekapcsolása"
    : "Sötét mód bekapcsolása";
  markdownThemeToggle.querySelector(".theme-icon").textContent = isDark
    ? "☀"
    : "☾";
  markdownThemeToggle.querySelector(".theme-label").textContent = isDark
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

  const activeHighlightTheme = renderDependencies.getActiveHighlightTheme();
  if (activeHighlightTheme && activeHighlightTheme !== theme) {
    void renderDependencies.ensureHighlight(theme).catch(showError);
  }
}

async function renderMarkdown() {
  if (!markdownInputElement || !markdownPreviewElement) {
    throw new Error("A Markdown szerkesztő vagy az előnézet nem található.");
  }

  const currentVersion = ++markdownRenderVersion;

  try {
    await renderDependencies.ensureCore(
      renderMarkdownUtils.definitionListExtension,
    );
    if (currentVersion !== markdownRenderVersion) {
      return;
    }

    const markdown = markdownInputElement.value.trim();
    if (!markdown) {
      activeCharts.forEach((chart) => chart.destroy());
      activeCharts = [];
      markdownPreviewElement.innerHTML =
        '<p class="empty-state">Az előnézet itt jelenik meg.</p>';
      return;
    }

    const tokens = new marked.Marked().lexer(markdown);
    const codeTokens = renderMarkdownUtils.collectCodeTokens(tokens);
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
      ...(hasMermaid ? [renderDependencies.ensureMermaid(theme)] : []),
      ...(hasGraphviz ? [renderDependencies.ensureGraphviz()] : []),
      ...(hasChart ? [renderDependencies.ensureChart()] : []),
      ...(hasHighlight ? [renderDependencies.ensureHighlight(theme)] : []),
      ...(hasKatex ? [renderDependencies.ensureKatex()] : []),
      ...(hasFootnotes ? [renderDependencies.ensureFootnotes()] : []),
    ]);

    if (currentVersion !== markdownRenderVersion) {
      return;
    }

    const graphvizInstance = hasGraphviz
      ? await renderDependencies.ensureGraphviz()
      : undefined;

    activeCharts.forEach((chart) => chart.destroy());
    activeCharts = [];

    const renderer = new marked.Renderer();
    renderer.code = renderMarkdownUtils.renderCodeBlock;
    markdownPreviewElement.classList.remove("empty-state");
    markdownPreviewElement.innerHTML = DOMPurify.sanitize(
      marked.parse(markdown, { renderer }),
    );

    const diagrams = markdownPreviewElement.querySelectorAll(".mermaid");
    await Promise.all(
      [...diagrams].map(async (diagram, index) => {
        try {
          const { svg } = await mermaid.render(
            `mermaid-${currentVersion}-${index}`,
            diagram.textContent,
          );
          if (
            currentVersion !== markdownRenderVersion ||
            !diagram.isConnected
          ) {
            return;
          }
          diagram.innerHTML = DOMPurify.sanitize(normalizeMermaidSvgText(svg), {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
        } catch (error) {
          if (
            currentVersion !== markdownRenderVersion ||
            !diagram.isConnected
          ) {
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
      markdownPreviewElement.querySelectorAll("pre code").forEach((code) => {
        hljs.highlightElement(code);
      });
    }

    markdownPreviewElement
      .querySelectorAll(".chart-container")
      .forEach((container) => {
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
                              color:
                                theme === "dark" ? "#343946" : "#e1e3e8",
                            },
                          },
                          y: {
                            ticks: {
                              color: theme === "dark" ? "#d0d3dc" : "#666",
                            },
                            grid: {
                              color:
                                theme === "dark" ? "#343946" : "#e1e3e8",
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
      markdownPreviewElement.querySelectorAll(".graphviz").forEach((diagram) => {
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
    if (currentVersion === markdownRenderVersion) {
      showError(error);
    }
  }
}

window.markdownPreviewRenderer = { setTheme, renderMarkdown };
