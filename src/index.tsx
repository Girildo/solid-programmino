/* @refresh reload */
import { render } from "solid-js/web"
import { App } from "./App"
import "./app.css"

const root = document.getElementById("root")
if (!root) throw new Error("Manca il nodo #root")

render(() => <App />, root)
