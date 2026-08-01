const DOCS_SITE_BASE_URL =
  (import.meta.env.VITE_DOCS_SITE_URL as string) || "http://localhost:3000";

function docsSiteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${DOCS_SITE_BASE_URL}${normalizedPath}`;
}

export const DOCS_HOME_URL = docsSiteUrl("/docs/getting-started");
export const DOCS_API_URL = docsSiteUrl("/docs/api-reference");
export { DOCS_SITE_BASE_URL };