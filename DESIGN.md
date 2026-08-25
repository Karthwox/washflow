---
name: Nocturne Academic
colors:
  surface: '#001429'
  surface-dim: '#001429'
  surface-bright: '#273a52'
  surface-container-lowest: '#000f21'
  surface-container-low: '#061c33'
  surface-container: '#0b2137'
  surface-container-high: '#172b42'
  surface-container-highest: '#22364d'
  on-surface: '#d2e4ff'
  on-surface-variant: '#c4c6cf'
  inverse-surface: '#d2e4ff'
  inverse-on-surface: '#1e3249'
  outline: '#8e9198'
  outline-variant: '#43474e'
  surface-tint: '#afc8f0'
  primary: '#afc8f0'
  on-primary: '#163152'
  primary-container: '#001f3f'
  on-primary-container: '#6f88ad'
  inverse-primary: '#476083'
  secondary: '#a6e6ff'
  on-secondary: '#003543'
  secondary-container: '#14d1ff'
  on-secondary-container: '#00566b'
  tertiary: '#adc7ff'
  on-tertiary: '#002e68'
  tertiary-container: '#001d46'
  on-tertiary-container: '#2b83ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#afc8f0'
  on-primary-fixed: '#001c3a'
  on-primary-fixed-variant: '#2f486a'
  secondary-fixed: '#b7eaff'
  secondary-fixed-dim: '#4cd6ff'
  on-secondary-fixed: '#001f28'
  on-secondary-fixed-variant: '#004e60'
  tertiary-fixed: '#d8e2ff'
  tertiary-fixed-dim: '#adc7ff'
  on-tertiary-fixed: '#001a41'
  on-tertiary-fixed-variant: '#004493'
  background: '#001429'
  on-background: '#d2e4ff'
  surface-variant: '#22364d'
  crisp-white: '#FFFFFF'
  surface-accent: '#002B56'
  status-success: '#00E676'
  status-error: '#FF5252'
  status-warning: '#FFD600'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
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
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system evolves the "Academic Tech" aesthetic into a high-end, focused environment tailored for deep focus and institutional prestige. By shifting to a **Deep Navy & Crisp White** theme, the brand moves away from generic utility and toward a premium, authoritative experience.

The visual style is a fusion of **Modern Corporate** and **Minimalism**, optimized for a dark-first environment. It evokes the feeling of a late-night library or a high-tech research lab—quiet, powerful, and precise. The interface should feel like a sophisticated tool that recedes into the background, allowing data and academic tasks to take center stage. The emotional response is one of calm confidence, professional reliability, and intellectual clarity.

## Colors

The palette is anchored by **Deep Navy** (#001F3F), used for primary surfaces and containers to establish a solid, scholarly foundation. This is contrasted with **Crisp White** (#FFFFFF) for typography and high-priority iconography, ensuring maximum legibility and a sharp, modern edge.

**Turquoise/Bright Blue** (#00D1FF) serves as the primary accent, used sparingly for interactive elements, progress indicators, and focal points to provide energy without compromising the professional tone. 

Background tiers are constructed using subtle shifts in navy saturation:
- **Primary Surface:** The darkest navy (#00152B).
- **Container Surface:** The primary navy (#001F3F).
- **Elevated Surface:** A slightly lighter navy (#002B56) to define hierarchy without relying on heavy borders.

## Typography

This design system utilizes a trio of typefaces to balance modern aesthetics with technical precision. **Hanken Grotesk** is used for headlines, providing a sharp, contemporary look that feels more distinct than standard sans-serifs. **Inter** is retained for body text due to its exceptional readability in dark mode environments. **JetBrains Mono** is introduced for labels and technical data, reinforcing the "Tech" aspect of the academic theme.

- **Contrast:** Maintain high contrast by using pure white for headlines and a slightly transparent white (85% opacity) for body text to reduce eye strain.
- **Hierarchy:** Use the monospaced font for machine IDs, timestamps, and status tags to separate data from narrative content.

## Layout & Spacing

The layout employs a **Fixed Grid** system for desktop to maintain a structured, editorial feel, while transitioning to a **Fluid Grid** for mobile devices. 

- **Desktop:** A 12-column grid with a maximum content width of 1280px.
- **Mobile:** A 4-column grid with 16px margins.
- **Rhythm:** An 8px linear scale governs all padding and margins. In the dark theme, spacing is slightly increased (24px+ for internal card padding) to prevent the deep colors from feeling too heavy or claustrophobic. Use "generous" vertical rhythm between sections to allow the white text to breathe against the dark background.

## Elevation & Depth

In this dark-mode centric system, depth is primarily conveyed through **Tonal Layers** rather than traditional shadows. 

- **Level 0 (Background):** The deepest navy (#00152B).
- **Level 1 (Cards/Surface):** Primary Navy (#001F3F).
- **Level 2 (Interaction/Popovers):** Lighter Navy (#002B56) with a faint, 1px **Low-Contrast Outline** (#FFFFFF, 10% opacity) to define boundaries.

**Ambient Shadows** are used sparingly and should be tinted with the primary navy color (e.g., `rgba(0, 15, 43, 0.5)`) to maintain a cohesive "Deep Sea" depth. Avoid pure black shadows. When an element is active, use a subtle "outer glow" effect using the secondary turquoise color at a very low opacity (15%) to indicate focus.

## Shapes

The shape language is **Soft**, moving away from overly bubbly aesthetics to a more precise, architectural feel. 

- **Primary Elements:** Buttons and cards use a 4px (0.25rem) radius for a "sharp-yet-approachable" technical look.
- **Contextual Elements:** Chips and status indicators use the **Soft-LG** (0.5rem) radius.
- **Exceptions:** No pill shapes are used; consistency is maintained through rectangular forms with soft corners to align with the "Academic Tech" precision.

## Components

- **Buttons:** Primary buttons are Crisp White with Navy text. This inversion creates an immediate focal point. Secondary buttons are outlined in Turquoise with Turquoise text.
- **Input Fields:** Outlined with a 1px border. Default border is the surface-accent color; focus border is Turquoise. Use JetBrains Mono for placeholder text.
- **Machine/Data Cards:** Backgrounded in the Primary Navy. Headlines in White. Status is indicated by a vertical bar on the left edge (Turquoise for active, Error-Red for down).
- **Status Chips:** Rectangular with 0.5rem radius. They use a subtle background (Navy 50% + Status Color 20%) with the status color used for the text and a 1px border.
- **Progress Bars:** Thin 4px tracks in Surface-Accent color, with a Turquoise fill that has a slight neon glow.
- **Navigation:** Top-tier navigation uses high-contrast white text for active states and 50% opacity white for inactive states, reinforcing the minimal, academic aesthetic.