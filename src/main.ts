import { App } from "./App";

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container element");
}

new App(container);
