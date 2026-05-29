# PSICOANDINO LAB — Agent Context

## Project
Static experimental HTML archive. No build system. No frameworks. No dependencies.
Deployed on Vercel via `vercel.json` (`cleanUrls: true`).

---

## File Structure
```
/
├── index.html          # Main page (do not restructure)
├── style.css           # Global styles (do not restructure)
├── app.js              # Card renderer + project loader
├── projects.json       # Ordered list of project folder names
├── changelog.txt       # Manual log — append only, format: YYYY.MM.DD\nDescription
├── vercel.json
└── projects/
    └── [folder_name]/
        ├── meta.json
        └── index.html  # Self-contained experiment
```

---

## Adding a New Project — Exact Steps

1. Append folder name to `projects.json`
2. Create `projects/[folder_name]/meta.json`
3. Create `projects/[folder_name]/index.html`
4. Append entry to `changelog.txt`

---

## meta.json Schema
```json
{
  "title": "string",
  "description": "string — one line, no period",
  "tags": ["string"],
  "status": "new" | "wip" | null,
  "updated": "YYYY-MM-DD",
  "mobile": true | false,
  "accent": "#HEXCOLOR",
  "svg": "orbit" | "grid" | "default"
}
```

---

## SVG Types (generated in app.js → generateSVG)
- `orbit` — concentric circles with a dot
- `grid` — line grid pattern
- `default` — circle with 12 satellite circles

To add a new SVG type: add a new `if(type === "...")` block in `generateSVG()`.

---

## Project index.html Rules
- Fully self-contained (inline CSS + JS, no external deps unless CDN is justified)
- No shared stylesheets — each experiment is isolated
- Must work standalone when opened directly
- Mobile support → `meta.mobile: true` in meta.json; if desktop-only → `false`

---

## Style Conventions
- Dark background: `#000` / `#030303`
- Primary text: `#f4f1ea`
- Muted text: `#8d8d8d`, `#666`
- Accent/warm: `#d6c4a3`, `#d4c3a1`
- Border style: `1px solid rgba(255,255,255,0.08)`
- Border radius: `24px` cards, `999px` buttons/tags/badges
- Font: `Inter, sans-serif`
- Transitions: `0.3s` default

---

## app.js Conventions
- Cards rendered via `createCard(project, folder)`
- Mobile check: `window.innerWidth <= 768` (evaluated once at load)
- No TypeScript, no modules — plain ES6+
- Async project loading: sequential `for...of` loop over `projects.json`

---

## Agent Instructions

**Response format:**
- Output code only — no explanations unless explicitly asked
- No summaries after edits
- If multiple files change, output each as a clearly labeled block
- Never rewrite a file that wasn't part of the task

**Scope discipline:**
- Edit only the files mentioned in the task
- Preserve all existing code outside the changed section
- Use `str_replace`-style minimal edits when possible

**Quality bar:**
- Match existing code style exactly (spacing, naming, structure)
- No console.logs left in production code
- No placeholder comments like `// TODO` unless asked
- Self-contained experiments — no shared state between projects

**Token efficiency:**
- Do not repeat unchanged code back
- Do not explain what you did after doing it
- If a task is ambiguous, state the assumption in one line, then proceed
