# Architecture Notes site

[Docusaurus](https://docusaurus.io/) site that publishes the Markdown in the repo-level [`docs/`](../docs) folder.

## Run it

```bash
cd website
npm install
npm start          # dev server with live reload at http://localhost:3000
npm run build      # static site in website/build
npm run serve      # preview the build
```

## Adding content

- Each folder under `docs/` is a topic and becomes a sidebar section automatically. Put its pages in `docs/<topic>/docs/` (or directly in `docs/<topic>/`).
- Set the section label and order in `docs/<topic>/_category_.json`, for example `{"label": "Modern payment platform", "position": 1}`.
- A topic appears in the sidebar once it has at least one `.md` or `.mdx` page.
- Images next to the docs work with normal relative Markdown links.
- Standalone files such as HTML diagrams are served from `/<topic>/...`. Link to them with `pathname:///<topic>/path/to/file.html`.
- Mermaid code blocks render as diagrams.
- Add a card for a new topic on the home page in `src/pages/index.tsx`.
