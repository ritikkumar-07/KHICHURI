import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Activity, HeartPulse, LogIn, LogOut, Menu, ShieldAlert, UserRound, X } from "lucide-react";

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

export function Navbar({ online, user, isHospitalAdmin, onSignOut }) {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const go = (path) => {
    navigate(path);
    setOpen(false);
  };

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'User';

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

          {/* Mobile Auth Actions */}
          <div className="nav-mobile-auth">
            {user ? (
              <div className="nav-mobile-user-box">
                <div className="nav-mobile-user-info">
                  <UserRound size={16} />
                  <span className="nav-mobile-name">{displayName}</span>
                  {isHospitalAdmin && <span className="nav-admin-tag">Admin</span>}
                </div>
                <button
                  className="nav-mobile-signout-btn"
                  onClick={() => {
                    if (onSignOut) onSignOut();
                    setOpen(false);
                  }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                className="nav-mobile-login-btn"
                onClick={() => go("/login")}
              >
                <LogIn size={16} />
                <span>Sign In</span>
              </button>
            )}
          </div>
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

          {/* Desktop Auth Controls */}
          {user ? (
            <div className="nav-auth-group">
              <div className="nav-user-badge" title={user.email || displayName}>
                <span className="nav-user-avatar">
                  <UserRound size={14} />
                </span>
                <span className="nav-user-name">{displayName}</span>
                {isHospitalAdmin && <span className="nav-admin-tag">Admin</span>}
              </div>
              <button
                className="nav-signout-btn"
                onClick={() => {
                  if (onSignOut) onSignOut();
                }}
                aria-label="Sign Out"
                title="Sign Out"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              className="nav-auth-btn"
              onClick={() => go("/login")}
              aria-label="Sign In"
            >
              <LogIn size={15} />
              <span>Sign In</span>
            </button>
          )}

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