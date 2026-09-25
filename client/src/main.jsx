import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "leaflet/dist/leaflet.css";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";

import "./cprImage.css";
import "./healthTracker.css";
import "./medicineSafety.css";
import "./medicinesSimple.css";
import "./careCircle.css";
import "./womensHealth.css";
import "./accessibility.css";
import "./auth.css";
import "./emergencyQr.css";
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => void 0));
createRoot(document.getElementById("root")).render(<React.StrictMode><BrowserRouter><AuthProvider><App /></AuthProvider></BrowserRouter></React.StrictMode>);
