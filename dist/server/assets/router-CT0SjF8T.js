import { createRootRoute, HeadContent, Scripts, createFileRoute, lazyRouteComponent, createRouter } from "@tanstack/react-router";
import { jsxs, jsx } from "react/jsx-runtime";
const Route$2 = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "KODEX IA — Kodex Tech Solutions" },
      { name: "description", content: "Intelligent AI assistant by Kodex Tech Solutions" }
    ]
  }),
  shellComponent: RootDocument
});
function RootDocument({ children }) {
  return /* @__PURE__ */ jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsx(Scripts, {})
    ] })
  ] });
}
const $$splitComponentImporter = () => import("./index-C96108bA.js");
const Route$1 = createFileRoute("/")({
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const SYSTEM_PROMPT = 'You are KODEX IA, a professional and intelligent assistant created by Kodex Tech Solutions. Always respond in the same language the user writes in. Never use emojis under any circumstance. Keep greetings and short questions brief and direct — one or two sentences maximum. For detailed requests, write long well-structured responses with headers, numbered lists and proper paragraphs. Never end responses with phrases like "Do you need more info?" or "I am here to help" or similar. Use proper punctuation always. Be human, clear and professional in tone.';
const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.signal.aborted) {
          return new Response(null, { status: 499 });
        }
        try {
          const { messages } = await request.json();
          const apiKey = "ncVH9qIK3WT3zFDaXaJ3G6cV4s3dNJF6";
          if (!apiKey) ;
          const mistralMessages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.map((m) => ({
              role: m.role,
              content: m.content
            }))
          ];
          const mistralRes = await fetch(
            "https://api.mistral.ai/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model: "mistral-small-latest",
                messages: mistralMessages,
                temperature: 0.5,
                max_tokens: 8192,
                stream: true
              }),
              signal: request.signal
            }
          );
          if (!mistralRes.ok) {
            const err = await mistralRes.text();
            return new Response(
              JSON.stringify({ error: "Mistral API error", detail: err }),
              { status: 502, headers: { "Content-Type": "application/json" } }
            );
          }
          return new Response(mistralRes.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive"
            }
          });
        } catch (error) {
          if (error.name === "AbortError") {
            return new Response(null, { status: 499 });
          }
          console.error("Chat error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to process request" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      }
    }
  }
});
const IndexRoute = Route$1.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$2
});
const ApiChatRoute = Route.update({
  id: "/api/chat",
  path: "/api/chat",
  getParentRoute: () => Route$2
});
const rootRouteChildren = {
  IndexRoute,
  ApiChatRoute
};
const routeTree = Route$2._addFileChildren(rootRouteChildren)._addFileTypes();
const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0
  });
  return router;
};
export {
  getRouter
};
