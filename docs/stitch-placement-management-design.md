---
name: OpenStory Design System
colors:
  surface: '#121317'
  surface-dim: '#121317'
  surface-bright: '#38393e'
  surface-container-lowest: '#0d0e12'
  surface-container-low: '#1a1b20'
  surface-container: '#1f1f24'
  surface-container-high: '#292a2e'
  surface-container-highest: '#343439'
  on-surface: '#e3e2e8'
  on-surface-variant: '#b9cbc1'
  inverse-surface: '#e3e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#83958c'
  outline-variant: '#3a4a43'
  surface-tint: '#00e1ab'
  primary: '#fbfffa'
  on-primary: '#003828'
  primary-container: '#00ffc2'
  on-primary-container: '#007255'
  inverse-primary: '#006c50'
  secondary: '#e3b5ff'
  on-secondary: '#4d007a'
  secondary-container: '#9400e4'
  on-secondary-container: '#f0d2ff'
  tertiary: '#fffdff'
  on-tertiary: '#3a3000'
  tertiary-container: '#ffe065'
  on-tertiary-container: '#766200'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#36ffc4'
  primary-fixed-dim: '#00e1ab'
  on-primary-fixed: '#002116'
  on-primary-fixed-variant: '#00513c'
  secondary-fixed: '#f3daff'
  secondary-fixed-dim: '#e3b5ff'
  on-secondary-fixed: '#2f004c'
  on-secondary-fixed-variant: '#6e00ab'
  tertiary-fixed: '#ffe16d'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#121317'
  on-background: '#e3e2e8'
  surface-variant: '#343439'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
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
  label-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style

The design system is engineered to feel immersive, cinematic, and focused, catering to writers and readers who seek a premium, distraction-free environment. The aesthetic sits at the intersection of Minimalism and Glassmorphism, leveraging deep backgrounds to make creative content feel as though it is floating in a digital void.

The personality is intellectual yet vibrant. While the structure remains disciplined and utilitarian, the use of neon accents and subtle glows introduces a sense of energy and digital magic. The UI should evoke a feeling of unlimited possibility, mirroring the creative process of storytelling itself. Visual interest is maintained through high-contrast typography and translucent layering rather than heavy decorative elements.

## Colors

The palette is anchored by a deep charcoal base that provides maximum contrast for the high-energy neon accents.

- Primary Neon Cyan: Used for primary actions, progress indicators, and active states. It represents momentum and writing flow.
- Secondary Electric Purple: Used for creative features, world-building tools, and specialized categories.
- Tertiary Amber: Reserved for notifications, editorial notes, or highlighting critical narrative warnings.
- Surface Strategy: Surfaces are not solid colors but translucent layers. This glassmorphic approach ensures that as the user scrolls, subtle hints of background depth are visible, maintaining a modern, lightweight feel.

## Typography

This design system utilizes Inter for its incredible legibility and neutral, systematic character. It ensures that the story content remains the hero. For technical metadata and UI labels, Geist is introduced to provide a sharp, monospaced-adjacent aesthetic that complements the futuristic neon theme.

High contrast is essential. Primary text should be pure white (#FFFFFF), while secondary information uses a muted light grey (#949599) to establish a clear information hierarchy. For long-form reading, `body-lg` is preferred to reduce eye strain against the dark background.

## Layout & Spacing

The layout follows a Fluid Grid model with a 12-column structure for desktop and a 4-column structure for mobile. A strict 8px rhythmic scale is used to define all margins and padding, ensuring mathematical harmony across the platform.

Content is typically centered in a max-width container to preserve readability. Sidebars and navigation panels use the glassmorphic surface treatment, floating over the main background. Use generous whitespace with internal margins of 24px-32px within cards to maintain a minimalist, premium feel that avoids visual clutter.

## Elevation & Depth

Depth in the design system is communicated through Backdrop Blurs and Subtle Glows rather than traditional heavy shadows.

- Level 0 Base: Deep Charcoal (#0B0C10).
- Level 1 Cards/Panels: Translucent surface at 60% opacity with a `12px` backdrop blur. A `1px` border of white at 8% opacity is required to define edges.
- Level 2 Modals/Popovers: Higher opacity surface at 80% with a `24px` backdrop blur. Include a very soft, `20px` spread outer glow using the primary accent color at 10% opacity to simulate light emission.
- Active States: Elements being interacted with should emit a subtle neon glow (cyan) to indicate focus.

## Shapes

The shape language is consistently Rounded. A standard radius of `0.5rem (8px)` is applied to cards and containers to soften the high-contrast tech aesthetic.

Interactive elements like buttons and input fields utilize a more pronounced `1rem (16px)` radius to feel approachable and tactile. Circularity is a key motif, specifically for progress indicators, avatar frames, and status pips, reinforcing the cycle of storytelling.

## Components

- Buttons: Primary buttons use a solid Neon Cyan (#00FFC2) fill with black text for maximum punch. Secondary buttons are Ghost style with a thin cyan border and a subtle hover glow.
- Cards: Must feature the glassmorphism effect. Borders are mandatory for visibility against the dark background. Headers within cards should use `label-md` for a clean, organized look.
- Circular Progress: Use the Primary Accent color for the stroke. Use a glow-trail effect where the head of the progress line is slightly brighter than the tail.
- Input Fields: Darker than the surface level, nearly black, with a `1px` border that transitions to Neon Cyan on focus.
- Chips/Tags: Small, pill-shaped elements with low-opacity background tints of Purple or Cyan, used for genre tagging or story status.
- Story Timeline: A vertical or horizontal thin line using the Secondary Accent (Purple) to connect narrative milestones, utilizing circular pips as nodes.
