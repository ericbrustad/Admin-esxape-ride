const STORAGE_KEY = "admin-settings";

const defaults = {
  protection: false,
  notifications: "disabled",
  gameFolder: false,
  passwordRequired: false,
};

function readSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaults };
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch (error) {
    console.warn("Unable to read stored settings; resetting to defaults.", error);
    return { ...defaults };
  }
}

function persistSettings(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Unable to persist settings.", error);
  }
}

function initialize() {
  const state = readSettings();
  const protectionToggle = document.querySelector("#protection-toggle");
  const notificationOptions = document.querySelectorAll(
    'input[name="notifications"]'
  );
  const gameToggle = document.querySelector("#game-toggle");
  const passwordToggle = document.querySelector("#password-toggle");

  protectionToggle.checked = state.protection;
  notificationOptions.forEach((option) => {
    option.checked = option.value === state.notifications;
  });
  gameToggle.checked = state.gameFolder;
  passwordToggle.checked = state.passwordRequired;

  protectionToggle.addEventListener("change", () => {
    state.protection = protectionToggle.checked;
    persistSettings(state);
  });

  notificationOptions.forEach((option) => {
    option.addEventListener("change", () => {
      if (option.checked) {
        state.notifications = option.value;
        persistSettings(state);
      }
    });
  });

  gameToggle.addEventListener("change", () => {
    state.gameFolder = gameToggle.checked;
    persistSettings(state);
  });

  passwordToggle.addEventListener("change", () => {
    state.passwordRequired = passwordToggle.checked;
    persistSettings(state);
  });
}

document.addEventListener("DOMContentLoaded", initialize);
