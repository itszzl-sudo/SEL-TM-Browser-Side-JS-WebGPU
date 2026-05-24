# SEL-TM Browser-Side JS+WebGPU Full Renderer

A self-evolving constrained layout Turing machine (SEL-TM) browser-side implementation using JavaScript and WebGPU.

## Features

- **Cold Path (JavaScript)**: W3C-compliant layout algorithms
  - Standard Flex layout with multi-line wrap support
  - Standard Grid layout with row/column span
  - Block layout with standard Box model

- **Hot Path (WebGPU)**: GPU-accelerated rendering
  - Gradient backgrounds
  - Border radius / rounded corners
  - Box shadows
  - Hover effects
  - Smooth animations
  - Text rendering via texture

- **Memory System**: IndexedDB-based persistence
  - Long-term memory (LTM)
  - Short-term memory (STM)

## Quick Start

### Option 1: HTTP Server (Recommended)

```bash
# Python 3
python -m http.server 8080

# Then open in browser
http://localhost:8080/index.html
```

### Option 2: Edge Browser Shortcut

Double-click `SEL-TM-WebGPU-Edge.lnk` to launch Edge with WebGPU enabled.

## Project Structure

- `index.html` - SEL-TM engine host page
- `demo.html` - External page to be rendered

## Supported CSS Properties

### Flex Layout
```css
display: flex;
flex-wrap: wrap;
justify-content: space-evenly;
flex-basis: 100px;
flex-grow: 1;
```

### Grid Layout
```css
display: grid;
grid-column-span: 2;
grid-row-span: 2;
```

### Visual Effects
```css
border-radius: 12px;
box-shadow: 0 8px 32px rgba(0,0,0,0.3);
background: linear-gradient(#1e88e5, #42a5f5);
opacity: 0.9;
```

## Architecture

```
┌─────────────────────────────────┐
│   Host Page (index.html)        │
├─────────────────────────────────┤
│  Cold Path (JS)                │  Hot Path (WebGPU)
│  ┌─────────────────────┐        │  ┌─────────────────────┐
│  │ W3C Layout State    │        │  │ GPU Render Pipeline │
│  │ Machine             │───────▶│  │ - Gradients         │
│  │ - Flex              │ tasks  │  │ - Shadows           │
│  │ - Grid              │        │  │ - Animations         │
│  │ - Block             │        │  │ - Textures           │
│  └─────────────────────┘        │  └─────────────────────┘
├─────────────────────────────────┤
│  IndexedDB Memory              │
│  ┌────────────┬────────────┐   │
│  │ Long-term  │ Short-term │   │
│  │ Memory (K) │ Memory (L)  │   │
│  └────────────┴────────────┘   │
└─────────────────────────────────┘
```

## Browser Compatibility

- Chrome/Edge 113+ (WebGPU support required)
- Firefox Nightly (WebGPU behind flag)
- Safari Technology Preview

## License

MIT
