# WWHN-29 Design Tokens

Status: implementation baseline
HEAD evidence: capture from current branch before Jira update
Source of truth: `src/app/theme.ts`, `src/shared/design-tokens.ts`

## Token Inventory

| Token group | Source | Values covered | Usage |
| --- | --- | --- | --- |
| Color - brand | `BRAND` in `src/app/theme.ts` | primary, hover, sider background, trigger, header background, header blur | Ant Design theme and app shell |
| Color - neutral | `NEUTRAL_COLORS` in `src/shared/design-tokens.ts` | canvas, paper, alternate paper, ink, muted text, placeholders, table header | shared page/card/table surfaces |
| Color - border | `BORDER_COLORS` | input, divider, soft divider, row line, connector | form controls, rows, hierarchy lines |
| Color - semantic/status | `SEMANTIC_COLORS` | success, warning, danger, neutral, overdue | status badges, alerts, validation and audit signals |
| Typography | `DESIGN_TOKENS.typography`, `FONT_FAMILY` | page title, section title, body, caption, app font family | headers, dense operation views, captions |
| Spacing | `DESIGN_TOKENS.spacing` | xs 4, sm 8, md 12, lg 16, xl 24, xxl 32 | app shell gutters, form/table/card spacing |
| Radius | `DESIGN_TOKENS.radius`, `RADIUS` | sm/card/control 4, md 8, lg 12, pill 10 | controls, cards, chips and popups |
| Shadow | `CARD_SHADOW` | framed card shadow | legacy framed surfaces that require visual lift |
| Breakpoints | Ant Design responsive grid plus layout CSS | desktop 1440, tablet 768, mobile 375 evidence targets | shell/sidebar/drawer behavior |
| Z-index | Ant Design component defaults | modal, drawer, dropdown, notification layering | overlays remain above shell and tables |
| Control height | `themeConfig.components` | Button/Input/Select 40px, Layout header 64px | consistent form and toolbar density |
| Layout dimensions | `themeConfig.components.Layout`, app layout files | header height, sider background, body background | responsive app shell |

## Acceptance Notes

- Tokens are consumed through Ant Design `themeConfig` and local constants instead of page-local magic values.
- New shared components must use these tokens or Ant Design theme values first.
- Hard-coded legacy values are allowed only when documented as migration debt in the component inventory.
