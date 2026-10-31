# Sentinel Enterprise Design System: The Pristine Auditor

This design system moves beyond the standard SaaS dashboard to create a high-end, editorial experience for Governance, Risk, and Compliance. Inspired by the precision of **Linear** and the fluidity of **Stripe**.

## 1. Overview & Creative North Star
### Creative North Star: "The Pristine Auditor"
- **Intentional Asymmetry**: Breaking the standard grid for a curated look.
- **Tonal Depth**: Using background shifts instead of heavy borders.
- **Functional Whitespace**: Directing attention through breathing room.

## 2. Core Tokens

### Colors & Surface
- **Background**: `#f7f9fb` (Base surface)
- **Primary**: `#4f46e5` (Action indicator)
- **Success**: Emerald-500
- **Warning**: Tertiary `#7e3000` (Sophisticated burnt orange)
- **The "No-Line" Rule**: Achieved through nested layers:
  - Base: `background`
  - Workspace: `surface_container_low`
  - Interaction Layer: `surface_container_lowest` (#ffffff)

### Typography
- **Headlines**: Manrope (ExtraBold) | Tracking: -0.02em
- **Body/UI**: Inter (Regular/Medium) | Tracking: 0

### Elevation
- Multi-layered soft shadows:
  - Layer 1: `0px 4px 12px rgba(25, 28, 30, 0.03)`
  - Layer 2: `0px 1px 2px rgba(25, 28, 30, 0.02)`

## 3. Component Guidelines
- **Buttons**: Indigo gradient (145° from #3525cd to #4f46e5), 12px rounding.
- **Input Fields**: Ghost Borders (outline_variant at 20% opacity) in Slate-200.
- **Glassmorphism**: 80% surface opacity + 20px backdrop blur for floating menus.

## 4. Spacing
- Base 8px grid.
- Page Margins: 5.5rem (spacing-16) to 7rem (spacing-20) for elite feel.
