const STORAGE_KEY = "sanjeevani_active_sos";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ID_PATTERN = /^SOS-[A-Za-z0-9-]{8,80}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function saveSosSession(alert) {
  if (!alert?.id || !alert?.accessToken) return;
  if (!ID_PATTERN.test(alert.id) || !TOKEN_PATTERN.test(alert.accessToken)) {
    return;
  }

  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify({
        id: alert.id,
        accessToken: alert.accessToken,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Session storage can be unavailable in privacy mode.
  }
}

export function loadSosSession() {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;

    const value = JSON.parse(raw);
    if (!ID_PATTERN.test(value?.id) || !TOKEN_PATTERN.test(value?.accessToken)) {
      clearSosSession();
      return null;
    }

    if (!Number.isFinite(value.savedAt) || Date.now() - value.savedAt > MAX_AGE_MS) {
      clearSosSession();
      return null;
    }

    return {
      id: value.id,
      accessToken: value.accessToken,
      savedAt: value.savedAt,
    };
  } catch {
    clearSosSession();
    return null;
  }
}

export function clearSosSession() {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures during cleanup.
  }
}
