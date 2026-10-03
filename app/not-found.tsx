import { t } from "./i18n";
import { withBase } from "./lib/paths";

/** Exported as 404.html on GitHub Pages, so stray links land somewhere friendly. */
export default function NotFound() {
  return (
    <main className="not-found">
      <span aria-hidden>🤔</span>
      <h1>{t.notFound.title}</h1>
      {/* A plain link: on Pages this page is served for unknown paths, so it
          must not rely on client routing being available. */}
      <a href={withBase("/")}>{t.notFound.back}</a>
    </main>
  );
}
