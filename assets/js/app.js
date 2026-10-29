const input = document.querySelector("#markdown-input");
const themeToggle = document.querySelector("#theme-toggle");
const markdownRenderer = window.markdownPreviewRenderer;
const workspace = document.querySelector(".workspace");
const workspaceDivider = document.querySelector(".workspace-divider");
const viewButtons = document.querySelectorAll(".view-controls [data-view]");
const narrowLayout = window.matchMedia("(max-width: 700px)");

const appVersion = document.querySelector('meta[name="app-version"]')?.content;
const versionLabel = document.querySelector("#app-version");
if (versionLabel && appVersion) {
  versionLabel.textContent = `v${appVersion}`;
}

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const view = button.dataset.view;
    if (!workspace || !view) {
      return;
    }

    workspace.dataset.view = view;
    viewButtons.forEach((viewButton) => {
      viewButton.setAttribute(
        "aria-pressed",
        String(viewButton.dataset.view === view),
      );
    });
  });
});

function updateDividerOrientation() {
  workspaceDivider?.setAttribute(
    "aria-orientation",
    narrowLayout.matches ? "horizontal" : "vertical",
  );
}

function setEditorSize(size) {
  if (!workspace || !workspaceDivider) {
    return;
  }

  const clampedSize = Math.min(80, Math.max(20, size));
  workspace.style.setProperty("--editor-size", `${clampedSize}%`);
  workspaceDivider.setAttribute("aria-valuenow", String(clampedSize));
}

workspaceDivider?.addEventListener("pointerdown", (event) => {
  if (!workspace || workspace.dataset.view !== "split") {
    return;
  }

  event.preventDefault();
  workspaceDivider.setPointerCapture(event.pointerId);
});

workspaceDivider?.addEventListener("pointermove", (event) => {
  if (
    !workspace ||
    workspace.dataset.view !== "split" ||
    !workspaceDivider.hasPointerCapture(event.pointerId)
  ) {
    return;
  }

  const bounds = workspace.getBoundingClientRect();
  const position = narrowLayout.matches
    ? ((event.clientY - bounds.top) / bounds.height) * 100
    : ((event.clientX - bounds.left) / bounds.width) * 100;
  setEditorSize(position);
});

workspaceDivider?.addEventListener("keydown", (event) => {
  const currentSize = Number(workspaceDivider.getAttribute("aria-valuenow"));

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    setEditorSize(currentSize - 5);
  } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    event.preventDefault();
    setEditorSize(currentSize + 5);
  } else if (event.key === "Home") {
    event.preventDefault();
    setEditorSize(20);
  } else if (event.key === "End") {
    event.preventDefault();
    setEditorSize(80);
  }
});

workspaceDivider?.addEventListener("dblclick", () => setEditorSize(50));
narrowLayout.addEventListener("change", updateDividerOrientation);
updateDividerOrientation();

markdownRenderer.setTheme(document.documentElement.dataset.theme || "light");
themeToggle?.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  markdownRenderer.setTheme(nextTheme, true);
  void markdownRenderer.renderMarkdown();
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
input?.addEventListener("input", markdownRenderer.renderMarkdown);
void markdownRenderer.renderMarkdown();
