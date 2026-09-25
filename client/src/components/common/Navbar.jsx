import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Activity, HeartPulse, Menu, ShieldAlert, X } from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard",    path: "/" },
  { label: "Voice Check",  path: "/voice-check" },
  { label: "Facilities",   path: "/facilities" },
  { label: "Blood Bank",   path: "/blood-bank" },
  { label: "First Aid",    path: "/first-aid" },
  { label: "Report Reader",path: "/report-reader" }
];

// Returns true when the current URL pathname matches the nav item's path
function isActive(currentPath, itemPath) {
  if (itemPath === "/") return currentPath === "/";
  return currentPath.startsWith(itemPath);
}

export function Navbar({ online }) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const go = (path) => {
    navigate(path);
    setOpen(false);
  };

  return (
    <header className="site-nav">
      <div className="nav-inner">
        {/* Brand / logo */}
        <button className="brand" onClick={() => go("/")} aria-label="Go to Sanjeevani dashboard">
          <span className="brand-icon"><HeartPulse size={20} /></span>
          <span><b>SANJEEVANI</b><small>HEALTH COMPANION</small></span>
        </button>

        {/* Main nav links */}
        <nav className={open ? "nav-links open" : "nav-links"} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={isActive(pathname, item.path) ? "active" : ""}
              onClick={() => go(item.path)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right-side actions */}
        <div className="nav-actions">
          <span className={online ? "connection live" : "connection"}>
            <Activity size={14} />
            {online ? "Online" : "Demo mode"}
          </span>
          <button
            className={isActive(pathname, "/sos") ? "nav-sos active" : "nav-sos"}
            onClick={() => go("/sos")}
          >
            <ShieldAlert size={16} /> SOS
          </button>
          <button
            className="menu-button"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}