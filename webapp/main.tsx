import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { loadGoogleMaps } from "./lib/loadGoogleMaps";

// Load Google Maps API dynamically using the env variable
loadGoogleMaps();

createRoot(document.getElementById("root")!).render(<App />);
