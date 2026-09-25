import { Accessibility, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const storageKey = "sanjeevani-accessibility";
const defaults = { textSize: "normal", highContrast: false, reduceMotion: false, highlightControls: false, readableSpacing: false, largeControls: false };
const sizes = ["small", "normal", "large", "extra-large"];
const sizeLabels = { small: "Small", normal: "Normal", large: "Large", "extra-large": "Extra Large" };

function readSettings() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || "{}") }; } catch { return defaults; }
}

export function AccessibilitySettings() {
  const [open, setOpen] = useState(false), [settings, setSettings] = useState(readSettings);
  const closeButton = useRef(null);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.a11yText = settings.textSize;
    root.classList.toggle("a11y-high-contrast", settings.highContrast);
    root.classList.toggle("a11y-reduce-motion", settings.reduceMotion);
    root.classList.toggle("a11y-highlight-controls", settings.highlightControls);
    root.classList.toggle("a11y-readable-spacing", settings.readableSpacing);
    root.classList.toggle("a11y-large-controls", settings.largeControls);
    try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Preferences remain active for this session. */ }
  }, [settings]);
  useEffect(() => { if (open) closeButton.current?.focus(); }, [open]);
  useEffect(() => { const escape = event => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("keydown", escape); return () => document.removeEventListener("keydown", escape); }, []);
  const change = (key, value) => setSettings(current => ({ ...current, [key]: value }));
  const changeText = direction => { const index = sizes.indexOf(settings.textSize); change("textSize", sizes[Math.max(0, Math.min(sizes.length - 1, index + direction))]); };
  return <><button className="accessibility-fab" aria-label="Open accessibility settings" title="Accessibility Settings" aria-expanded={open} onClick={() => setOpen(true)}><Accessibility size={23} /></button>{open && <><button className="accessibility-backdrop" aria-label="Close accessibility settings" onClick={() => setOpen(false)} /><aside className="accessibility-panel" role="dialog" aria-modal="true" aria-labelledby="accessibility-title"><header><div><span className="section-kicker">DISPLAY PREFERENCES</span><h2 id="accessibility-title">Accessibility</h2></div><button ref={closeButton} className="icon-button" aria-label="Close accessibility settings" onClick={() => setOpen(false)}><X size={20} /></button></header><section className="text-size-control"><label>Text Size</label><div><button aria-label="Decrease text size" disabled={settings.textSize === "small"} onClick={() => changeText(-1)}><Minus size={16} /></button><output aria-live="polite">{sizeLabels[settings.textSize]}</output><button aria-label="Increase text size" disabled={settings.textSize === "extra-large"} onClick={() => changeText(1)}><Plus size={16} /></button></div><small>90% · 100% · 115% · 130%</small></section><div className="accessibility-options">{[["highContrast", "High Contrast", "Strengthen text, borders and controls"], ["reduceMotion", "Reduce Motion", "Stop decorative animations and transitions"], ["highlightControls", "Highlight Controls", "Make links and buttons easier to identify"], ["readableSpacing", "Readable Spacing", "Increase line and character spacing"], ["largeControls", "Large Controls", "Increase important click and tap targets"]].map(([key, label, help]) => <label key={key}><span><b>{label}</b><small>{help}</small></span><input type="checkbox" role="switch" checked={settings[key]} onChange={event => change(key, event.target.checked)} /></label>)}</div><button className="button secondary accessibility-reset" onClick={() => setSettings(defaults)}><RotateCcw size={15} /> Reset Accessibility</button></aside></>}</>;
}
