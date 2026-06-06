---
name: Ecclesia OS
colors:
  surface: '#031427'
  surface-dim: '#031427'
  surface-bright: '#2a3a4f'
  surface-container-lowest: '#000f21'
  surface-container-low: '#0b1c30'
  surface-container: '#102034'
  surface-container-high: '#1b2b3f'
  surface-container-highest: '#26364a'
  on-surface: '#d3e4fe'
  on-surface-variant: '#c6c6cd'
  inverse-surface: '#d3e4fe'
  inverse-on-surface: '#213145'
  outline: '#909097'
  outline-variant: '#45464d'
  surface-tint: '#bec6e0'
  primary: '#bec6e0'
  on-primary: '#283044'
  primary-container: '#0f172a'
  on-primary-container: '#798098'
  inverse-primary: '#565e74'
  secondary: '#7bd0ff'
  on-secondary: '#00354a'
  secondary-container: '#00a6e0'
  on-secondary-container: '#00374d'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#001c10'
  on-tertiary-container: '#009365'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#c4e7ff'
  secondary-fixed-dim: '#7bd0ff'
  on-secondary-fixed: '#001e2c'
  on-secondary-fixed-variant: '#004c69'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#031427'
  on-background: '#d3e4fe'
  surface-variant: '#26364a'
typography:
  headline-xl:
    fontFamily: Manrope
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
---

## Brand & Style
This design system is built for a high-performance Church Management Ecosystem, blending the reliability of an enterprise SaaS platform with the vitality of a living community. The brand personality is **Sophisticated, Authoritative, and Responsive**. It evokes a sense of "command and control" for administrative tasks while maintaining high-energy cues for live events and community engagement.

The design style is **Corporate Modern with Tactile Accents**. It utilizes a deep, layered foundation of navies and slates to reduce cognitive load during long administrative sessions, punctuated by vibrant, "current" action colors that draw the eye to real-time data and critical updates. The aesthetic prioritizes data density and clarity, utilizing subtle glassmorphism for overlays and crisp, high-contrast borders for structural integrity.

## Colors
The palette is anchored in a "Deep Night" spectrum to provide a premium, dashboard-centric feel. 

- **Foundation:** The background (`--bg-main`) uses a near-black navy to allow surface elements to pop. 
- **Action Layers:** Electric Blue (`--brand-secondary`) is the primary interactive color, used for links, primary buttons, and active states.
- **Semantic Accents:** Emerald is reserved for financial growth and successful check-ins; Amber for pending volunteer applications or low inventory; Crimson for urgent alerts and "LIVE" broadcast indicators.
- **Pulsing States:** The `--accent-live` token is specifically tuned for a 2-second ease-in-out opacity animation to signal active sessions or streaming content.

## Typography
The typographic system balances modern elegance with technical precision. 

- **Headlines:** Uses **Manrope** for its balanced, modern geometric forms. It remains highly legible even at semi-bold weights against dark backgrounds.
- **Body:** Uses **Inter** for its neutral, systematic utility. It is optimized for screen readability and high-density data layouts.
- **Data & Metadata:** Uses **JetBrains Mono** for all numerical data, timestamps, and monospaced labels. This reinforces the "OS" feel and ensures that columns of numbers in financial tables align perfectly.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. The sidebar remains at a fixed 280px width, while the main content area utilizes a 12-column fluid grid.

- **Gutters:** Standardized at 24px (`lg`) to allow for data-dense cards without visual clutter.
- **Margins:** Page-level margins are 32px on desktop, scaling down to 16px on mobile.
- **Density:** Components use a tight vertical rhythm (4px increments) to allow for "at-a-glance" monitoring of large congregations and volunteer schedules.
- **Responsive Behavior:** At the 1024px breakpoint, the sidebar collapses into a rail, and at 768px, it transitions to a bottom navigation bar or hidden drawer.

## Elevation & Depth
Depth is conveyed through **Tonal Layering and Subtle Outlines** rather than heavy shadows.

1.  **Level 0 (Base):** `--bg-main` - The canvas.
2.  **Level 1 (Cards/Surfaces):** `--bg-surface` with a 1px border of `--border-color`.
3.  **Level 2 (Popovers/Modals):** A slightly lighter slate with a "Glass" effect (backdrop-blur: 12px) and a `--shadow-md` (0px 12px 24px rgba(0,0,0,0.4)).
4.  **Interactive States:** Elements should lift slightly on hover using a `transform: translateY(-2px)` and an increased shadow spread.

Shadows are "Inky" — low-spread, high-density, and tinted with the primary navy color to avoid a "dirty" gray look on dark surfaces.

## Shapes
The shape language is **Refined and Professional**. 

- **Standard Elements:** Buttons, inputs, and small chips use a 0.5rem (`8px`) radius to feel approachable but sturdy.
- **Container Elements:** Large dashboard cards and modal containers use a 1rem (`16px`) radius to soften the high-density layout.
- **Interactive Indicators:** Status dots and "Live" indicators are always full-circle (pill-shaped).
- **Hard Edges:** Reserved for code snippets or strictly technical data logs to provide a "Brutalist Lite" contrast where necessary.

## Components
Consistent styling across the ecosystem is achieved through these component guidelines:

- **Elegant Cards:** Surfaces should use `--bg-surface`. Headers within cards should have a subtle bottom border. Footer actions are right-aligned.
- **Data-Dense Tables:** Use `--data-mono` for row content. Hovering a row should apply a background highlight of `rgba(56, 189, 248, 0.05)`.
- **Buttons:** 
    - *Primary:* Electric Blue background with white text.
    - *Secondary:* Ghost style with `--border-color` and white text.
    - *Live:* Crimson background with a "Heartbeat" pulse animation (scale 1 to 1.05).
- **Input Fields:** Darker than the surface (`#020617`), with a 1px border. Focus state glows with a 2px Electric Blue ring.
- **Interactive Charts:** Use a custom palette of the vibrant action colors (Blue, Emerald, Amber, Crimson) against the dark slate grid lines.
- **Skeleton Pulse:** Loading states use a linear gradient shine moving from left to right across `--brand-secondary` at 10% opacity.
- **Toasts:** Slide in from the top-right, utilizing high-saturation status colors for the left-edge border.