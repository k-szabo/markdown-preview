const input = document.querySelector("#markdown-input");
const themeToggle = document.querySelector("#theme-toggle");
const shareLinkButton = document.querySelector("#share-link");
const shareStatus = document.querySelector("#share-status");
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

function encodeMarkdown(markdown) {
  const bytes = new TextEncoder().encode(markdown);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeMarkdown(hash) {
  const encoded = hash.slice("#markdown=".length);
  if (encoded.length % 4 === 1 || !/^[A-Za-z0-9_-]*$/.test(encoded)) {
    throw new Error("A megosztási link Markdown-tartalma érvénytelen.");
  }

  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function showShareStatus(message, isError = false) {
  if (!shareStatus) {
    return;
  }
  shareStatus.textContent = message;
  shareStatus.dataset.error = String(isError);
}

function loadSharedMarkdown() {
  if (!input || !window.location.hash.startsWith("#markdown=")) {
    return false;
  }

  try {
    input.value = decodeMarkdown(window.location.hash);
    showShareStatus("", false);
    return true;
  } catch (error) {
    showShareStatus(error.message, true);
    return false;
  }
}

loadSharedMarkdown();
window.addEventListener("hashchange", () => {
  if (loadSharedMarkdown()) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const copyBuffer = document.createElement("textarea");
  copyBuffer.value = text;
  copyBuffer.setAttribute("readonly", "");
  copyBuffer.style.position = "fixed";
  copyBuffer.style.opacity = "0";
  document.body.append(copyBuffer);
  copyBuffer.select();
  let copied;
  try {
    copied = document.execCommand("copy");
  } finally {
    copyBuffer.remove();
  }

  if (!copied) {
    throw new Error("A böngésző nem engedélyezte a vágólap használatát.");
  }
}

shareLinkButton?.addEventListener("click", async () => {
  if (!input) {
    return;
  }

  try {
    const url = new URL(window.location.href);
    url.hash = `markdown=${encodeMarkdown(input.value)}`;
    await copyText(url.href);
    showShareStatus("A megosztási link a vágólapra másolva.");
  } catch (error) {
    showShareStatus(
      `Nem sikerült a megosztási link másolása: ${error.message}`,
      true,
    );
  }
});

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
