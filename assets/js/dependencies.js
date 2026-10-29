const scriptPromises = new Map();
const stylePromises = new Map();
const featurePromises = new Map();
let corePromise;
let graphvizInstance;
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

function ensureCore(definitionListExtension) {
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
    return graphvizInstance;
  });
}

window.markdownPreviewDependencies = {
  ensureCore,
  ensureMermaid,
  ensureKatex,
  ensureFootnotes,
  ensureHighlight,
  ensureChart,
  ensureGraphviz,
  getActiveHighlightTheme: () => activeHighlightTheme,
};
