# Design System Documentation

## 1. Overview & Creative North Star: "The Empathetic Guardian"

The design system moves beyond the cold, clinical aesthetic typical of medical software. Instead, it adopts the persona of **"The Empathetic Guardian."** This philosophy prioritizes radical clarity and a nurturing presence, blending high-end editorial layouts with absolute accessibility.

To achieve a "bespoke" feel for an elderly demographic, we reject the rigid, boxy grids of standard frameworks. We utilize **intentional asymmetry**, generous white space, and **soft tonal layering** to guide the eye. The interface shouldn't feel like a digital tool; it should feel like a premium, printed health journal—authoritative, calm, and effortless to navigate.

---

## 2. Color Philosophy & Surface Architecture

The palette is designed to reassure. While we use high-contrast combinations for AA/AAA compliance, the transitions between elements are softened to prevent visual fatigue.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Structural boundaries must be defined exclusively through background color shifts or subtle tonal transitions. For instance, a section containing a week’s history should use `surface-container-low` to sit naturally against a `surface` background.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of fine paper. 
*   **Base:** `surface` (#f7f9fc)
*   **Primary Sections:** `surface-container-low` (#f2f4f7)
*   **Interactive Cards:** `surface-container-lowest` (#ffffff) – This creates a natural "lift" without aggressive shadows.
*   **Deep Content:** `surface-container-high` (#e6e8eb) for recessed areas like search bars or input wells.

### The "Glass & Gradient" Rule
To elevate the experience from "utility" to "premium," use **Glassmorphism** for floating headers or navigation bars. Apply a semi-transparent `surface` color with a 20px backdrop-blur. 
For primary Call-to-Actions (CTAs), utilize a subtle linear gradient transitioning from `primary` (#0058bc) to `primary_container` (#0070eb) at a 135-degree angle. This adds a sense of "soul" and dimensionality that flat colors lack.

---

## 3. Typography: Editorial Authority

We use a dual-typeface system to balance modern sophistication with clinical legibility.

*   **Display & Headlines (Lexend):** A typeface designed specifically for reading proficiency. We use this for all high-level data points (like BP numbers) and page titles. The geometric nature of Lexend provides an authoritative, modern feel.
*   **Body & Labels (Inter):** A workhorse for legibility. Inter is used for all instructional text and data labels to ensure maximum clarity at any size.

### Scale Highlights
*   **display-lg (3.5rem, Lexend):** Reserved for the primary blood pressure reading. It must be the undisputed hero of the screen.
*   **title-lg (1.375rem, Inter):** Used for card headers, ensuring the user always knows exactly where they are within a module.
*   **body-lg (1rem, Inter):** Our standard for all descriptive text. Never go smaller than this for the elderly demographic.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are often messy. This design system uses **Ambient Light** principles.

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card placed on a `surface-container-low` background creates a soft, tactile hierarchy without a single shadow.
*   **Ambient Shadows:** For elements that truly "float" (like a voice input FAB), use extra-diffused shadows. 
    *   *Formula:* `0px 20px 40px rgba(25, 28, 30, 0.06)`. The shadow color is a low-opacity version of `on-surface`, never pure black.
*   **The "Ghost Border" Fallback:** If a container requires further definition for accessibility, use the `outline-variant` token at **15% opacity**. A 100% opaque border is considered a design failure in this system.

---

## 5. Components & Interaction

### Buttons (The "Touch-First" Standard)
All buttons must have a minimum height of **64px** to accommodate reduced motor precision.
*   **Primary:** Gradient fill (`primary` to `primary_container`), `lg` (2rem) corner radius. Use `on_primary` (white) for text.
*   **Tertiary/Quiet:** No container. Use `primary` text with an underline or an icon to signify interactivity.

### Cards & Lists
*   **Prohibition:** Never use divider lines. 
*   **The Alternative:** Separate list items using a 16px vertical gap. For data-heavy lists, alternate background colors between `surface` and `surface-container-low`.
*   **Radius:** All cards must use `md` (1.5rem) or `lg` (2rem) roundedness to evoke a sense of safety and "softness."

### Vital Alerts
*   **Healthy Status:** Use `secondary` (#1b6d24) text on a `secondary_container` (#a0f399) background.
*   **High Pressure Alert:** Use `tertiary` (#b6171e) text on a `tertiary_container` (#da3433) background. This ensures the "soft red" requested is visible but not alarming.

### Animated Voice Indicator
When the voice input is active, the indicator should not just blink. It should use a **"rhythmic expansion"** animation—a soft, 24px blur pulse that mimics a calm resting heartbeat (60 BPM).

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical margins. For example, give a headline a larger left padding than the body text to create a sophisticated, editorial "staircase" effect.
*   **Do** prioritize `Lexend` for any numerical data.
*   **Do** use `xl` (3rem) corner radius for large hero sections to create a friendly, organic feel.

### Don’t:
*   **Don’t** use pure black (#000000) for text. Use `on_surface` (#191c1e) to maintain a premium, ink-on-paper feel.
*   **Don’t** use standard "Material Design" shadows. Keep them diffused and light.
*   **Don’t** cram information. If a screen feels full, split it into two screens with a smooth "heartbeat" fade transition.
*   **Don't** use icons without labels. At this demographic level, an icon is a supplement to text, not a replacement.

---

## 7. Accessibility Commitment
This system is built for **AA/AAA compliance**. 
1.  **Contrast:** Every text/background pair has been verified for a minimum 4.5:1 ratio (7:1 for headers).
2.  **Targets:** No interactive element is smaller than 48x48dp; our standard is 64dp.
3.  **Visual Cues:** We never use color alone to convey meaning. High pressure alerts must include both the `tertiary` color and a "Warning" icon or label.