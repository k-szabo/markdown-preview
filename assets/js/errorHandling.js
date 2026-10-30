function getErrorDetails(error) {
  const message =
    error instanceof Error ? error.message : String(error ?? "Ismeretlen hiba.");
  return message.split("\n")[0].slice(0, 240) || "Ismeretlen hiba.";
}

function escapeErrorHtml(value) {
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

function getMermaidRenderError(svg) {
  const renderedSvg = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (renderedSvg.querySelector("parsererror")) {
    return new Error("A Mermaid érvénytelen SVG-t adott vissza.");
  }

  const errorText = renderedSvg.querySelector(".error-text")?.textContent.trim();
  if (
    renderedSvg.querySelector(".error-icon, .error-text") ||
    renderedSvg.documentElement.getAttribute("aria-roledescription") === "error"
  ) {
    return new Error(
      errorText?.slice(0, 240) ||
        "A Mermaid diagram renderelése hibát jelzett.",
    );
  }

  return undefined;
}

function renderCodeBlockError(error, fallback) {
  return `<pre class="render-error" role="alert" title="${escapeErrorHtml(
    getErrorDetails(error),
  )}">${escapeErrorHtml(fallback)}</pre>`;
}

function showLibraryError(element, error, message, className = "render-error") {
  element.classList.add(className);
  element.setAttribute("role", "alert");
  element.setAttribute("aria-label", message);
  element.title = getErrorDetails(error);
  element.textContent = message;
}

function showMermaidError(element, error) {
  showLibraryError(
    element,
    error,
    "A Mermaid-diagram nem jeleníthető meg. Ellenőrizd a szintaxist.",
    "mermaid-error",
  );
}

function showPreviewError(element, error) {
  element.textContent = `Az előnézet nem tölthető be: ${getErrorDetails(error)}`;
  element.classList.add("empty-state");
}

window.markdownPreviewErrorHandling = {
  getMermaidRenderError,
  renderCodeBlockError,
  showLibraryError,
  showMermaidError,
  showPreviewError,
};
