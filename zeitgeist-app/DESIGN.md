# Zeitgeist product design

The product uses a deep-ocean blue workspace with pale text and a restrained blue accent. Data is the primary content; AI interpretation is visually separated from provider evidence.

## Foundations

`src/app/globals.css` owns the dark theme and shared component primitives. The root layout selects the theme so portals, menus and nested pages inherit the same readable colors.

| Role | Token | Value |
| --- | --- | --- |
| Page | background | #06121f |
| Surface | card | #0b1a2b |
| Body text | foreground | #f3f6ff |
| Supporting text | muted-foreground | #a8bdd9 |
| Accent text | primary | #82b6ff |
| Borders | border | #1c354d |
| Main action | app-button | #2563eb with white text |

Use 4/8px spacing increments, 12px control corners, 20px panel corners, and at least 44px for main controls. Use tabular numerals for market data. Supporting text is subordinate through size and placement, not low opacity. Do not hardcode black text on dark surfaces.

## Components

- `app-panel`: common content surface.
- `app-eyebrow`: short section label.
- `app-button` / `app-button-secondary`: main and secondary actions.
- `app-icon-button`: labeled icon controls.
- `app-field`: text fields with explicit labels and visible focus.
- `app-details`: native expandable analysis sections, keyboard operable.
- `app-copy`: long-form supporting prose.

Navigation shares the same route labels and active state on desktop and mobile. Account actions remain separate from product navigation. A skip link leads to the main content.

## Page hierarchy

- Home: market workspace with top search, left navigation, central chart and right AI insight panel.
- Research: daily quote, selectable history window, price/evidence/analysis sections, three summary cards and a separate AI insight column.
- AI CFO: shared workspace header, left conversation navigation, central thread, right contextual guidance and persistent composer.
- Sign-in: purpose on the left at desktop widths, labeled form on the right; a single column on phones.

Charts use a neutral blue line, not a fabricated positive/negative sentiment. Explicit session changes use both direction symbols and color. Volume is optional and has a separate axis; an expandable data table provides an alternative to the graphic. Missing targets remain unavailable.

## Interaction and states

Show prices before AI completes. Retry analysis without clearing the market data. Errors provide a relevant action without claiming a nonexistent maintenance or status page. Empty states explain the next step. Disabled, focus, loading and expanded states remain distinguishable. Reduced-motion preferences suppress nonessential animation.

Check overview, search, results, error, chat and sign-in at desktop and phone widths. Use clearly labeled, temporary fixture data to inspect result components without invoking paid providers; never publish the fixture as real market data. Live sign-in and provider behavior need deployment credentials.

The reference-inspired finish uses subtle blue panel gradients, cyan data accents, an electric-blue active navigation item, a pill search field, and decorative sidebar curves. Do not imitate unsupported forecasts, analyst consensus, news, or watchlist actions with invented data or inert controls.
