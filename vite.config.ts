import { defineConfig, loadEnv } from "vite"
import type { Plugin } from "vite"
import solid from "vite-plugin-solid"
import { callFlickr, planFlickrRequest } from "./shared/flickrProxy"

/**
 * Serves /api/flickr during `npm run dev` with the same rules the deployed
 * function uses, so the key stays out of the browser in development too.
 *
 * FLICKR_API_KEY has no VITE_ prefix on purpose: Vite only exposes prefixed
 * variables to client code, so this one cannot reach the bundle by accident.
 */
function flickrProxy(apiKey: string | undefined): Plugin {
  return {
    name: "flickr-proxy-dev",
    configureServer(server) {
      server.middlewares.use("/api/flickr", async (req, res) => {
        const query = new URL(req.url ?? "/", "http://localhost").searchParams
        const plan = planFlickrRequest(query, apiKey)

        res.setHeader("content-type", "application/json; charset=utf-8")
        if (!plan.ok) {
          res.statusCode = plan.status
          res.end(JSON.stringify({ stat: "fail", message: plan.message }))
          return
        }

        try {
          const { status, body } = await callFlickr(plan)
          res.statusCode = status
          res.end(body)
        } catch (cause) {
          res.statusCode = 502
          res.end(JSON.stringify({ stat: "fail", message: String(cause) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  return { plugins: [solid(), flickrProxy(env["FLICKR_API_KEY"])] }
})
