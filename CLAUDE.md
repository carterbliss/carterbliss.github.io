# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install Bookshop/npm dependencies
npm install

# Install Jekyll/Ruby dependencies
npm run jekyll:install

# Run dev server (http://localhost:6060)
npm start

# Build static site
npm run build

# Update Bookshop to latest version
npm run update-bookshop
```

> Note: Pagination does not work when running locally — deploy to CloudCannon to test it.

## Architecture

This is a **Jekyll + Bookshop** portfolio site built on the [Vonge template](https://github.com/CloudCannon/vonge-jekyll-bookshop-template), managed via [CloudCannon CMS](https://cloudcannon.com/).

### Key directories

- `site/` — Jekyll source root (passed as `--source site` at build time)
  - `_config.yml` — site title, plugins, collections config, permalink rules
  - `collections/` — content split into `_pages`, `_posts`, `_projects`, `_testimonials`
  - `_data/` — YAML data files (sitewide settings, nav, etc.)
  - `_layouts/`, `_includes/` — Jekyll templates
  - `assets/`, `images/`, `js/` — static files
- `component-library/` — Bookshop component library (separate from Jekyll source)
  - `components/` — individual UI components (hero, project-card, blog-section, etc.)
  - `shared/` — shared partials/styles
  - `bookshop/` — Bookshop config
- `cloudcannon.config.yml` — CloudCannon CMS configuration (collection paths, schemas, inputs)

### How Jekyll + Bookshop connect

Jekyll is configured (`bookshop_locations: ../component-library`) to resolve Bookshop components from `component-library/components/`. Components are rendered via the `jekyll-bookshop` plugin and can be live-edited in CloudCannon.

### Content collections

| Collection | Path | Output |
|---|---|---|
| Pages | `site/collections/_pages/` | `/title` |
| Projects | `site/collections/_projects/` | `/project/:slug` |
| Posts | `site/collections/_posts/` | `/blog/:slug` |
| Testimonials | `site/collections/_testimonials/` | none |

Schemas for new content are in `.cloudcannon/schemas/`.
