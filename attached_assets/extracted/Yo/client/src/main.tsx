import { createRoot } from "react-dom/client";
import { pdfjs } from 'react-pdf';
import { Worker } from '@react-pdf-viewer/core';
import App from "./App";
import "./index.css";

// Set up PDF.js worker globally for all PDF libraries
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Also configure worker for @react-pdf-viewer library 
const WORKER_URL = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

createRoot(document.getElementById("root")!).render(
  <Worker workerUrl={WORKER_URL}>
    <App />
  </Worker>
);
