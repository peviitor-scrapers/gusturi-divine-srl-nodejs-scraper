# AGENTS.md — Rules for AI agents

## Project
GUSTURI DIVINE S.R.L. scraper for peviitor.ro (Node.js, ESM, Jest) — derived from EPAM template.

## 🌱 This Repo Is a Derived Scraper
This repo is a **derived scraper** generated from the EPAM Systems International SRL template (sebiboga/epam-systems-international-srl-nodejs-scraper).

**Data source:** ANOFM (Agentia Nationala pentru Ocuparea Fortei de Munca) API — queries by CIF.

## Critical Rules

### 0. Background tasks — always pass `--repo` explicitly to `gh`

When polling a workflow run with `until [ "$(gh run view ID --json status -q .status)" = "completed" ]; do sleep N; done`, the `gh run view` command implicitly uses the current working directory's git remote. If the CWD is a different repo (e.g. you cd-ed elsewhere mid-task), `gh` looks in the wrong repo and returns 404 — the loop's check becomes `"" != "completed"` (always true) and the background task sleeps forever.

**Always specify the repo explicitly:**
```bash
gh run view <RUN_ID> --repo sebiboga/gusturi-divine-srl-nodejs-scraper --json status -q .status
```

Before starting any `gh run watch` or polling loop in the background, sanity-check:
- Does the command include `--repo`?
- Is the run ID from the same repo as `--repo`?
