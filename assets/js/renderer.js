const markdownInputElement = document.querySelector("#markdown-input");
const markdownPreviewElement = document.querySelector("#markdown-preview");
const markdownThemeToggle = document.querySelector("#theme-toggle");
const renderDependencies = window.markdownPreviewDependencies;
const renderMarkdownUtils = window.markdownPreviewMarkdown;
const renderErrorHandling = window.markdownPreviewErrorHandling;
let markdownRenderVersion = 0;
let activeCharts = [];
let activeDiagramObservers = [];

function enableDiagramNavigation(diagram) {
  const svg = diagram.querySelector("svg");
  if (!svg) {
    return;
  }

  diagram.classList.add("diagram-viewport");
  diagram.setAttribute(
    "aria-label",
    "Nagyítható diagram: görgővel nagyítható, húzással mozgatható.",
  );
  diagram.setAttribute("role", "group");
  diagram.title = "Görgővel nagyítható, húzással mozgatható";
  addFullscreenButton(diagram, "diagram");

  let canvas;
  let scale = 1;
  let baseWidth = 0;
  let baseHeight = 0;
  let lastAvailableWidth = 0;
  const viewBox = svg.viewBox.baseVal;
  const aspectRatio =
    viewBox.width > 0 && viewBox.height > 0
      ? viewBox.width / viewBox.height
      : undefined;
  const naturalWidth =
    viewBox.width > 0
      ? viewBox.width
      : Number.parseFloat(svg.getAttribute("width")) ||
        svg.getBoundingClientRect().width;

  function updateCanvasSize(availableWidth) {
    if (!canvas || !aspectRatio) {
      return;
    }

    baseWidth = Math.min(naturalWidth || availableWidth, availableWidth);
    baseHeight = baseWidth / aspectRatio;
    lastAvailableWidth = availableWidth;
    canvas.style.width = `${baseWidth * scale}px`;
    canvas.style.height = `${baseHeight * scale}px`;
    svg.style.width = `${baseWidth}px`;
    svg.style.height = `${baseHeight}px`;
    svg.style.transform = `scale(${scale})`;
  }

  function updateDiagramSize() {
    if (!diagram.isConnected) {
      return;
    }

    const styles = getComputedStyle(diagram);
    const availableWidth =
      diagram.clientWidth -
      Number.parseFloat(styles.paddingLeft) -
      Number.parseFloat(styles.paddingRight);
    if (availableWidth <= 0) {
      return;
    }

    if (!canvas) {
      if (!aspectRatio) {
        return;
      }

      canvas = document.createElement("div");
      canvas.className = "diagram-canvas";
      svg.replaceWith(canvas);
      canvas.append(svg);
      svg.style.position = "absolute";
      svg.style.left = "0";
      svg.style.top = "0";
      svg.style.maxWidth = "none";
      svg.style.transformOrigin = "top left";
    }

    if (Math.abs(availableWidth - lastAvailableWidth) > 1) {
      updateCanvasSize(availableWidth);
    }
  }

  function onWheel(event) {
    if (!canvas || !baseWidth) {
      return;
    }

    event.preventDefault();
    const previousScale = scale;
    scale = Math.min(
      4,
      Math.max(0.25, previousScale * Math.exp(-event.deltaY * 0.002)),
    );
    if (scale === previousScale) {
      return;
    }

    const viewportBounds = diagram.getBoundingClientRect();
    const styles = getComputedStyle(diagram);
    const localX =
      event.clientX -
      viewportBounds.left -
      Number.parseFloat(styles.borderLeftWidth) -
      Number.parseFloat(styles.paddingLeft);
    const localY =
      event.clientY -
      viewportBounds.top -
      Number.parseFloat(styles.borderTopWidth) -
      Number.parseFloat(styles.paddingTop);
    const previousMargin = Math.max(
      0,
      (lastAvailableWidth - baseWidth * previousScale) / 2,
    );
    const diagramX =
      (localX + diagram.scrollLeft - previousMargin) / previousScale;
    const diagramY = (localY + diagram.scrollTop) / previousScale;

    updateCanvasSize(lastAvailableWidth);
    const nextMargin = Math.max(
      0,
      (lastAvailableWidth - baseWidth * scale) / 2,
    );
    diagram.scrollLeft = nextMargin + diagramX * scale - localX;
    diagram.scrollTop = diagramY * scale - localY;
  }

  function onPointerDown(event) {
    if (
      !canvas ||
      event.button !== 0 ||
      (event.target instanceof Element &&
        event.target.closest("a, .fullscreen-toggle"))
    ) {
      return;
    }

    if (
      diagram.scrollWidth <= diagram.clientWidth &&
      diagram.scrollHeight <= diagram.clientHeight
    ) {
      return;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const startScrollLeft = diagram.scrollLeft;
    const startScrollTop = diagram.scrollTop;
    diagram.classList.add("is-dragging");
    diagram.setPointerCapture(event.pointerId);

    const onPointerMove = (moveEvent) => {
      diagram.scrollLeft = startScrollLeft - (moveEvent.clientX - startX);
      diagram.scrollTop = startScrollTop - (moveEvent.clientY - startY);
    };
    const stopDragging = () => {
      diagram.classList.remove("is-dragging");
      diagram.removeEventListener("pointermove", onPointerMove);
      diagram.removeEventListener("pointerup", stopDragging);
      diagram.removeEventListener("pointercancel", stopDragging);
    };

    diagram.addEventListener("pointermove", onPointerMove);
    diagram.addEventListener("pointerup", stopDragging, { once: true });
    diagram.addEventListener("pointercancel", stopDragging, { once: true });
  }

  const resizeObserver = new ResizeObserver(updateDiagramSize);
  resizeObserver.observe(diagram);
  activeDiagramObservers.push(resizeObserver);
  diagram.addEventListener("wheel", onWheel, { passive: false });
  diagram.addEventListener("pointerdown", onPointerDown);
  updateDiagramSize();
}

function disposeActiveDiagrams() {
  activeDiagramObservers.forEach((observer) => observer.disconnect());
  activeDiagramObservers = [];
}

function updateFullscreenButtons() {
  markdownPreviewElement
    ?.querySelectorAll(".fullscreen-toggle")
    .forEach((button) => setFullscreenButtonState(button));
}

function setFullscreenButtonState(button) {
  const container = button.parentElement;
  const isFullscreen = document.fullscreenElement === container;
  const description =
    container?.classList.contains("chart-container") ? "grafikon" : "diagram";
  const label = button.disabled
    ? "A böngésző nem támogatja a teljes képernyős megjelenítést."
    : isFullscreen
      ? "Kilépés a teljes képernyőből"
      : `${description[0].toUpperCase()}${description.slice(1)} megjelenítése teljes képernyőn`;
  button.setAttribute("aria-label", label);
  button.title = label;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute(
    "d",
    isFullscreen
      ? "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3m8 0v-3a2 2 0 0 1 2-2h3"
      : "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3",
  );
  svg.append(path);
  button.replaceChildren(svg);
}

function addFullscreenButton(container, type) {
  const button = document.createElement("button");
  button.className = "fullscreen-toggle";
  button.type = "button";
  if (container.requestFullscreen && document.exitFullscreen) {
    button.addEventListener("click", async () => {
      try {
        if (document.fullscreenElement === container) {
          await document.exitFullscreen();
        } else {
          await container.requestFullscreen();
        }
      } catch (error) {
        console.warn(`A ${type} nem jeleníthető meg teljes képernyőn.`, error);
      }
    });
  } else {
    button.disabled = true;
    button.title = "A böngésző nem támogatja a teljes képernyős megjelenítést.";
  }
  container.append(button);
  setFullscreenButtonState(button);
}

function normalizeMermaidSvgText(svg) {
  return svg.replace(/>([^<]*)</g, (match, text) =>
    `>${text.replace(/&amp;(amp|lt|gt);/g, "&$1;")}<`,
  );
}

document.addEventListener("fullscreenchange", updateFullscreenButtons);

function showError(error) {
  if (!markdownPreviewElement) {
    throw error;
  }

  disposeActiveDiagrams();
  renderErrorHandling.showPreviewError(markdownPreviewElement, error);
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
      disposeActiveDiagrams();
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
    disposeActiveDiagrams();

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
          const source = diagram.textContent;
          await mermaid.parse(source);
          const { svg } = await mermaid.render(
            `mermaid-${currentVersion}-${index}`,
            source,
          );
          if (
            currentVersion !== markdownRenderVersion ||
            !diagram.isConnected
          ) {
            return;
          }
          const renderError = renderErrorHandling.getMermaidRenderError(svg);
          if (renderError) {
            throw renderError;
          }
          diagram.innerHTML = DOMPurify.sanitize(normalizeMermaidSvgText(svg), {
            USE_PROFILES: { svg: true, svgFilters: true },
          });
          enableDiagramNavigation(diagram);
        } catch (error) {
          if (
            currentVersion !== markdownRenderVersion ||
            !diagram.isConnected
          ) {
            return;
          }
          renderErrorHandling.showMermaidError(diagram, error);
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
            addFullscreenButton(container, "grafikon");
          }
        } catch (error) {
          renderErrorHandling.showLibraryError(
            container,
            error,
            "A grafikon nem jeleníthető meg.",
          );
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
          enableDiagramNavigation(diagram);
        } catch (error) {
          renderErrorHandling.showLibraryError(
            diagram,
            error,
            "A Graphviz diagram nem jeleníthető meg.",
          );
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
