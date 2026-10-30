import { useEffect } from "react";
import { SITE_URL } from "@/shared/constants/seo";

export interface PageMeta {
  title: string;
  /** Search-result snippet and link-preview text. Leave out on noindex pages. */
  description?: string;
  /** Canonical path on SITE_URL, e.g. "/app". Only public, indexable pages have one. */
  path?: string;
  /** Keep the page out of search results (sign-in, role picker, everything behind login). */
  noindex?: boolean;
}

/**
 * Set the document title and the search / link-preview tags for the current page.
 *
 * index.html ships the home page's tags for crawlers that don't run JS; this keeps
 * them right after client-side navigation and gives each public route its own
 * canonical. The canonical exists only in the rendered page, never in index.html:
 * Google advises against JS changing a canonical the original HTML already set.
 */
export function usePageMeta({ title, description, path, noindex = false }: PageMeta): void {
  useEffect(() => {
    document.title = title;
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    setMeta("property", "og:title", title);
    setMeta("name", "twitter:title", title);
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    const canonical = path && !noindex ? SITE_URL + path : null;
    setCanonical(canonical);
    if (canonical) setMeta("property", "og:url", canonical);
  }, [title, description, path, noindex]);
}

function setMeta(attr: "name" | "property", key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setCanonical(href: string | null): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}
