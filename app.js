import {
  FigmaService,
  FigmaServiceError
} from "./figmaService.js";


// =========================================================
// APPLICATION STATE
// =========================================================

const state = {

  figma: {

    token:
      localStorage.getItem("figma_token") || "",

    fileKey:
      localStorage.getItem("figma_file_key") || ""

  },

  lastSync:
    localStorage.getItem("figma_last_sync") || null,

  file:
    null,

  colors:
    [],

  tokens:
    {},

  nodes:
    [],

  assets:
    {},

  view:
    "dashboard"

};


const figmaService =
  new FigmaService();


figmaService.configure(
  state.figma.token,
  state.figma.fileKey
);


// =========================================================
// DOM HELPERS
// =========================================================

const $ =
  selector =>
    document.querySelector(selector);


const $$ =
  selector =>
    document.querySelectorAll(selector);


// =========================================================
// DOM REFERENCES
// =========================================================

const syncBtn =
  $("#syncBtn");

const settingsBtn =
  $("#settingsBtn");

const settingsToolbarBtn =
  $("#settingsToolbarBtn");

const settingsOverlay =
  $("#settingsOverlay");

const closeSettings =
  $("#closeSettings");

const saveSettings =
  $("#saveSettings");

const clearSettings =
  $("#clearSettings");

const figmaToken =
  $("#figmaToken");

const figmaFileKey =
  $("#figmaFileKey");

const toast =
  $("#toast");

const inspector =
  $("#inspector");


// =========================================================
// INITIALIZATION
// =========================================================

document.addEventListener(
  "DOMContentLoaded",
  initialize
);


function initialize() {

  setupNavigation();

  setupSettings();

  setupWindowControls();

  setupInspector();

  populateSettings();

  updateConnectionUI();

  updateTimestamp();

  applyFallbackTheme();

}


// =========================================================
// FALLBACK THEME
// =========================================================

function applyFallbackTheme() {

  const root =
    document.documentElement;


  const defaults = {

    "--primary-color":
      "#7c3aed",

    "--surface-bg":
      "#0b0d12",

    "--text-main":
      "#f5f7fa"

  };


  for (
    const [key, value]
    of Object.entries(defaults)
  ) {

    if (
      !root.style.getPropertyValue(key)
    ) {

      root.style.setProperty(
        key,
        value
      );

    }

  }

}


// =========================================================
// NAVIGATION
// =========================================================

function setupNavigation() {

  $$(".nav-item[data-view]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const view =
            button.dataset.view;

          changeView(view);

        }
      );

    });

}


function changeView(view) {

  state.view =
    view;


  $$(".nav-item[data-view]")
    .forEach(item => {

      item.classList.toggle(
        "active",
        item.dataset.view === view
      );

    });


  const names = {

    dashboard:
      "Dashboard",

    tokens:
      "Design Tokens",

    assets:
      "Assets",

    inspect:
      "Figma Inspect"

  };


  const title =
    names[view] ||
    "Dashboard";


  $("#currentViewName")
    .textContent =
      title;


  $("#pageTitle")
    .textContent =
      view === "dashboard"
        ? "Design System Preview"
        : title;


  // Focus the inspector for inspect view.

  if (view === "inspect") {

    inspector
      .classList
      .remove("collapsed");

  }

}


// =========================================================
// SETTINGS
// =========================================================

function setupSettings() {

  settingsBtn.addEventListener(
    "click",
    openSettings
  );


  settingsToolbarBtn.addEventListener(
    "click",
    openSettings
  );


  closeSettings.addEventListener(
    "click",
    closeSettingsDrawer
  );


  settingsOverlay.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        settingsOverlay
      ) {

        closeSettingsDrawer();

      }

    }
  );


  saveSettings.addEventListener(
    "click",
    saveConfiguration
  );


  clearSettings.addEventListener(
    "click",
    clearConfiguration
  );

}


function populateSettings() {

  figmaToken.value =
    state.figma.token;

  figmaFileKey.value =
    state.figma.fileKey;

}


function openSettings() {

  populateSettings();

  settingsOverlay
    .classList
    .remove("hidden");

}


function closeSettingsDrawer() {

  settingsOverlay
    .classList
    .add("hidden");

}


function saveConfiguration() {

  const token =
    figmaToken.value.trim();

  const fileKey =
    figmaFileKey.value.trim();


  state.figma.token =
    token;

  state.figma.fileKey =
    fileKey;


  localStorage.setItem(
    "figma_token",
    token
  );


  localStorage.setItem(
    "figma_file_key",
    fileKey
  );


  figmaService.configure(
    token,
    fileKey
  );


  updateConnectionUI();

  closeSettingsDrawer();

  showToast(
    "Figma configuration saved."
  );

}


function clearConfiguration() {

  localStorage.removeItem(
    "figma_token"
  );

  localStorage.removeItem(
    "figma_file_key"
  );

  localStorage.removeItem(
    "figma_last_sync"
  );


  state.figma.token =
    "";

  state.figma.fileKey =
    "";

  state.lastSync =
    null;


  figmaService.configure(
    "",
    ""
  );


  populateSettings();

  updateConnectionUI();

  updateTimestamp();

  showToast(
    "Figma configuration cleared."
  );

}


// =========================================================
// SYNC
// =========================================================

syncBtn.addEventListener(
  "click",
  syncWithFigma
);


async function syncWithFigma() {

  if (
    !state.figma.token ||
    !state.figma.fileKey
  ) {

    openSettings();

    showToast(
      "Configure your Figma token and file key first."
    );

    return;

  }


  setSyncLoading(true);


  try {

    updateConnection(
      "Connecting…",
      "warning"
    );


    // -----------------------------------------------------
    // 1. GET FILE
    // -----------------------------------------------------

    const file =
      await figmaService.getFile();


    state.file =
      file;


    // -----------------------------------------------------
    // 2. EXTRACT COLORS
    // -----------------------------------------------------

    state.colors =
      figmaService.extractColors(
        file
      );


    // -----------------------------------------------------
    // 3. MAP COLORS TO CSS TOKENS
    // -----------------------------------------------------

    state.tokens =
      figmaService.mapColorsToTokens(
        state.colors
      );


    // -----------------------------------------------------
    // 4. EXTRACT NODES
    // -----------------------------------------------------

    state.nodes =
      figmaService.extractInterestingNodes(
        file,
        50
      );


    // -----------------------------------------------------
    // 5. APPLY TOKENS
    // -----------------------------------------------------

    applyDesignTokens(
      state.tokens
    );


    // -----------------------------------------------------
    // 6. RENDER INSPECTOR
    // -----------------------------------------------------

    renderInspector();


    // -----------------------------------------------------
    // 7. UPDATE UI
    // -----------------------------------------------------

    state.lastSync =
      new Date().toISOString();


    localStorage.setItem(
      "figma_last_sync",
      state.lastSync
    );


    updateTimestamp();

    updateConnection(
      "Connected",
      "online"
    );


    $("#syncBadge")
      .textContent =
        "Synced from Figma";


    $("#tokenCount")
      .textContent =
        Object.keys(
          state.tokens
        ).length;


    $("#componentCount")
      .textContent =
        state.nodes.length;


    showToast(
      `Synced "${file.name}" successfully.`
    );


  } catch (error) {

    console.error(
      "Figma sync failed:",
      error
    );


    handleFigmaError(
      error
    );

  } finally {

    setSyncLoading(false);

  }

}


// =========================================================
// APPLY CSS VARIABLES
// =========================================================

function applyDesignTokens(tokens) {

  const root =
    document.documentElement;


  for (
    const [name, value]
    of Object.entries(tokens)
  ) {

    if (
      typeof value !== "string"
    ) {
      continue;
    }


    root.style.setProperty(
      name,
      value
    );

  }

}


// =========================================================
// INSPECTOR
// =========================================================

function renderInspector() {

  if (!state.file) {
    return;
  }


  $("#fileName")
    .textContent =
      state.file.name || "Unnamed";


  $("#fileModified")
    .textContent =
      formatDate(
        state.file.lastModified
      );


  $("#fileVersion")
    .textContent =
      state.file.version || "—";


  renderColors();

  renderNodes();

}


function renderColors() {

  const container =
    $("#colorInspect");


  container.innerHTML =
    "";


  const colors =
    state.colors
      .filter(
        color =>
          color.hex
      )
      .slice(0, 30);


  if (!colors.length) {

    container.innerHTML =
      `<span class="empty-state">
        No solid colors detected.
      </span>`;

    return;

  }


  for (const color of colors) {

    const row =
      document.createElement(
        "div"
      );


    row.className =
      "color-row";


    row.innerHTML = `

      <div
        class="color-swatch"
        style="background:${escapeHtml(color.hex)}"
      ></div>

      <div class="color-details">

        <span class="color-name">
          ${escapeHtml(color.name)}
        </span>

        <span class="color-value">
          ${escapeHtml(color.hex)}
        </span>

      </div>

    `;


    container.appendChild(
      row
    );

  }

}


function renderNodes() {

  const container =
    $("#nodeInspect");


  container.innerHTML =
    "";


  if (!state.nodes.length) {

    container.innerHTML =
      `<span class="empty-state">
        No nodes loaded.
      </span>`;

    return;

  }


  for (const node of state.nodes) {

    const row =
      document.createElement(
        "div"
      );


    row.className =
      "node-row";


    row.title =
      `${node.name} — ${node.id}`;


    row.textContent =
      `${node.type} · ${node.name}`;


    container.appendChild(
      row
    );

  }

}


// =========================================================
// OPTIONAL ASSET LOADING
// =========================================================

async function loadFigmaAssets(
  nodeIds
) {

  try {

    const images =
      await figmaService.getSvgImages(
        nodeIds
      );


    state.assets =
      images;


    $("#assetCount")
      .textContent =
        Object.keys(images)
          .length;


    return images;

  } catch (error) {

    console.error(
      "Asset loading failed:",
      error
    );


    showToast(
      "Unable to load Figma assets."
    );


    return {};

  }

}


// =========================================================
// INSPECTOR COLLAPSE
// =========================================================

function setupInspector() {

  $("#collapseInspector")
    .addEventListener(
      "click",
      () => {

        inspector
          .classList
          .toggle("collapsed");

      }
    );

}


// =========================================================
// CONNECTION UI
// =========================================================

function updateConnectionUI() {

  if (
    state.figma.token &&
    state.figma.fileKey
  ) {

    updateConnection(
      "Configured",
      "warning"
    );

  } else {

    updateConnection(
      "Not connected",
      "offline"
    );

  }

}


function updateConnection(
  text,
  stateName
) {

  $("#connectionText")
    .textContent =
      text;


  const dot =
    $("#connectionDot");


  dot.className =
    `status-dot ${stateName}`;


  const sidebarDot =
    $("#sidebarConnectionDot");


  sidebarDot.className =
    `status-dot ${stateName}`;


  $("#sidebarConnectionText")
    .textContent =
      text;

}


// =========================================================
// TIMESTAMP
// =========================================================

function updateTimestamp() {

  if (!state.lastSync) {

    $("#syncTimestamp")
      .textContent =
        "Never synced";

    return;

  }


  $("#syncTimestamp")
    .textContent =
      `Synced ${formatDate(
        state.lastSync
      )}`;

}


// =========================================================
// WINDOW CONTROLS
// =========================================================

function setupWindowControls() {

  $("#minimizeBtn")
    .addEventListener(
      "click",
      () => {

        if (
          window.desktopAPI?.minimize
        ) {

          window.desktopAPI.minimize();

          return;

        }


        // Tauri hook.

        if (
          window.__TAURI__?.invoke
        ) {

          window.__TAURI__.invoke(
            "minimize_window"
          );

          return;

        }


        console.log(
          "Minimize hook not connected."
        );

      }
    );


  $("#maximizeBtn")
    .addEventListener(
      "click",
      () => {

        if (
          window.desktopAPI?.maximize
        ) {

          window.desktopAPI.maximize();

          return;

        }


        if (
          window.__TAURI__?.invoke
        ) {

          window.__TAURI__.invoke(
            "toggle_maximize"
          );

          return;

        }


        console.log(
          "Maximize hook not connected."
        );

      }
    );


  $("#closeBtn")
    .addEventListener(
      "click",
      () => {

        if (
          window.desktopAPI?.close
        ) {

          window.desktopAPI.close();

          return;

        }


        if (
          window.__TAURI__?.invoke
        ) {

          window.__TAURI__.invoke(
            "close_window"
          );

          return;

        }


        console.log(
          "Close hook not connected."
        );

      }
    );

}


// =========================================================
// LOADING STATE
// =========================================================

function setSyncLoading(
  loading
) {

  syncBtn.disabled =
    loading;


  if (loading) {

    syncBtn.textContent =
      "↻ Syncing…";

  } else {

    syncBtn.textContent =
      "↻ Sync with Figma";

  }

}


// =========================================================
// ERROR HANDLING
// =========================================================

function handleFigmaError(
  error
) {

  let message =
    "Unable to sync with Figma.";


  let connectionState =
    "offline";


  if (
    error instanceof FigmaServiceError
  ) {

    switch (error.code) {

      case "AUTH":

        message =
          "Authentication failed. Check your Figma PAT.";

        connectionState =
          "offline";

        break;


      case "NOT_FOUND":

        message =
          "Figma file not found. Check the File Key.";

        connectionState =
          "offline";

        break;


      case "RATE_LIMIT":

        message =
          "Figma rate limit reached. Try again later.";

        connectionState =
          "warning";

        break;


      case "OFFLINE":

        message =
          "No network connection.";

        connectionState =
          "offline";

        break;


      case "NOT_CONFIGURED":

        message =
          "Configure Figma first.";

        connectionState =
          "offline";

        break;


      default:

        message =
          error.message;

    }

  }


  updateConnection(
    "Sync failed",
    connectionState
  );


  showToast(
    message
  );

}


// =========================================================
// UTILITIES
// =========================================================

function formatDate(
  value
) {

  if (!value) {
    return "—";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );

}


function showToast(
  message
) {

  toast.textContent =
    message;


  toast.classList.remove(
    "hidden"
  );


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
    setTimeout(
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      3500
    );

}


// =========================================================
// BASIC HTML ESCAPING
// =========================================================

function escapeHtml(
  value
) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// =========================================================
// NETWORK EVENTS
// =========================================================

window.addEventListener(
  "online",
  () => {

    if (
      state.figma.token &&
      state.figma.fileKey
    ) {

      updateConnection(
        "Ready",
        "online"
      );

    }

  }
);


window.addEventListener(
  "offline",
  () => {

    updateConnection(
      "Offline",
      "offline"
    );

  }
);


// =========================================================
// OPTIONAL GLOBAL API
// Useful if another part of the application wants
// to trigger a sync or asset import.
// =========================================================

window.figmaSyncApp = {

  sync:
    syncWithFigma,

  loadAssets:
    loadFigmaAssets,

  getState:
    () => ({
      ...state,

      // Don't expose the PAT.
      figma: {
        configured:
          Boolean(
            state.figma.token
          ),

        fileKey:
          state.figma.fileKey
      }

    })

};