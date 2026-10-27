import React from "react";
import ReactDOM from "react-dom/client";
import RepairApp from "./features/repair/RepairApp";
import { BrowserRouter } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <RepairApp />
    </BrowserRouter>
  </React.StrictMode>,
);
