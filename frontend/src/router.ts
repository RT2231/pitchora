type RouteHandler = (params: Record<string, string>) => void;

interface Route {
  pattern: RegExp;
  keys: string[];
  handler: RouteHandler;
}

const routes: Route[] = [];
let notFoundHandler: RouteHandler = () => {};

function compile(path: string): { pattern: RegExp; keys: string[] } {
  const keys: string[] = [];
  const pattern = path.replace(/:[^/]+/g, (match) => {
    keys.push(match.slice(1));
    return "([^/]+)";
  });
  return { pattern: new RegExp(`^${pattern}$`), keys };
}

export function addRoute(path: string, handler: RouteHandler) {
  const { pattern, keys } = compile(path);
  routes.push({ pattern, keys, handler });
}

export function setNotFound(handler: RouteHandler) {
  notFoundHandler = handler;
}

export function navigate(path: string) {
  window.location.hash = path;
}

function resolve() {
  const hash = window.location.hash.replace(/^#/, "") || "/";
  for (const route of routes) {
    const match = hash.match(route.pattern);
    if (match) {
      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => (params[key] = match[i + 1]));
      route.handler(params);
      return;
    }
  }
  notFoundHandler({});
}

export function startRouter() {
  window.addEventListener("hashchange", resolve);
  resolve();
}
