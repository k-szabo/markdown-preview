const input = document.querySelector("#markdown-input");
const themeToggle = document.querySelector("#theme-toggle");
const markdownRenderer = window.markdownPreviewRenderer;

const appVersion = document.querySelector('meta[name="app-version"]')?.content;
const versionLabel = document.querySelector("#app-version");
if (versionLabel && appVersion) {
  versionLabel.textContent = `v${appVersion}`;
}

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
