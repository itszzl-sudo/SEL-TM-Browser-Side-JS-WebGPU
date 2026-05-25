# SEL-TM Browser-Side JS+WebGPU Full Renderer

A self-evolving constrained layout Turing machine (SEL-TM) browser-side implementation using JavaScript and WebGPU.

## Features

### Cold Path (JavaScript) - W3C-Compliant Layout

- **Standard Flex Layout**: Multi-line wrap, justify-content, align-items, flex-grow/shrink/basis
- **Standard Grid Layout**: Row/column span, grid template
- **Block Layout**: Standard Box model with margin/padding/border
- **Position Layout**: absolute, relative, fixed positioning
- **Float Layout**: left/right floating elements
- **Inline Layout**: inline/inline-block elements
- **Overflow Handling**: Hidden, scroll, auto overflow modes
- **z-index Layering**: Proper stacking context management

### Hot Path (WebGPU) - GPU-Accelerated Rendering

- Gradient backgrounds (linear-gradient)
- Border radius / rounded corners
- Box shadows (single and multiple)
- Hover effects and animations
- Text rendering via texture
- Opacity and blend modes

### Advanced CSS Selector System

- Class selectors (.class)
- ID selectors (#id)
- Attribute selectors ([attr], [attr=value])
- Pseudo-classes (:hover, :active, :focus)

### Interactive System

- Click events
- Hover events
- Input events
- Keyboard events
- Event logging

### Responsive Design

- @media queries (min-width, max-width)
- Orientation detection (landscape/portrait)
- DPR adaptation for high-DPI screens
- Responsive width calculation

### Typography

- Font-family parsing
- Font-size units (px, em, rem, %)
- Line-height support
- Letter-spacing
- Text-align (left, center, right, justify)
- Custom font loading via @font-face

### Media Resources

- Image loading with caching
- Video element support
- Canvas element support
- Lazy loading with IntersectionObserver
- Image preloading

### Performance Optimization

- Virtual scrolling for large lists
- OffscreenCanvas caching
- FPS monitoring
- Performance metrics reporting

### Browser API Integration

- ResizeObserver for responsive updates
- Fullscreen API
- Visibility computation
- IntersectionObserver for lazy loading

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
- `test/` - Test suite
  - `index.html` - Unit tests (HTML/Color/Style parsers)
  - `layout-test.html` - Layout engine visual tests
- `src/core/` - Core modules
  - `sel-tm.js` - Global state and W3C rules
  - `memory-db.js` - IndexedDB persistence
  - `color-parser.js` - Color parsing utilities
  - `style-parser.js` - Style parsing
  - `html-parser.js` - HTML document parser
  - `layout-engine.js` - Layout calculation engine
  - `render-engine.js` - WebGPU rendering engine
- `使用说明.md` - Chinese documentation
- `README.md` - English documentation

## Testing

### Browser-Based Tests (Recommended)

Open test pages in browser:

```bash
# Start HTTP server
python -m http.server 8000

# Run unit tests
http://localhost:8000/test/index.html

# Run layout visual tests
http://localhost:8000/test/layout-test.html
```

### Test Coverage

**Unit Tests** (`test/index.html`):
- ✅ HTML Parser (6 tests)
  - Simple parsing
  - Attributes
  - Self-closing tags
  - Comment skipping
  - Deep nesting
  - Mixed content

- ✅ Color Parser (10 tests)
  - Hex colors (#RGB, #RRGGBB, #RRGGBBAA)
  - RGB/RGBA
  - HSL/HSLA
  - Color names
  - Percentage values

- ✅ Style Parser (5 tests)
  - Simple styles
  - CamelCase conversion
  - Quoted values
  - Empty styles
  - Complex Flex styles

**Visual Tests** (`test/layout-test.html`):
- ✅ Block layout
- ✅ Flex layout
- ✅ Grid layout
- ✅ Position (absolute/relative/fixed)
- ✅ Border radius
- ✅ Box shadow

### Running Tests

1. Start HTTP server: `python -m http.server 8000`
2. Open `http://localhost:8000/test/index.html`
3. Click "运行所有测试" to run all tests
4. View pass/fail status and error details

## Architecture

```
┌─────────────────────────────────┐
│   Host Page (index.html)        │
├─────────────────────────────────┤
│  Cold Path (JS)                │  Hot Path (WebGPU)
│  ┌─────────────────────┐        │  ┌─────────────────────┐
│  │ W3C Layout State    │        │  │ GPU Render Pipeline │
│  │ Machine             │───────▶│  │ - Gradients         │
│  │ - Flex/Grid/Block   │        │  │ - Shadows           │
│  │ - Position/Float     │        │  │ - Animations        │
│  └─────────────────────┘        │  └─────────────────────┘
│  ┌─────────────────────┐        │
│  │ Style System        │        │
│  │ - Border/Transform  │        │
│  │ - Multiple Shadows  │        │
│  └─────────────────────┘        │
│  ┌─────────────────────┐        │
│  │ Selector Engine     │        │
│  │ - Class/ID/Attr     │        │
│  └─────────────────────┘        │
│  ┌─────────────────────┐        │
│  │ Interaction System  │        │
│  │ - Click/Input/Key   │        │
│  └─────────────────────┘        │
└─────────────────────────────────┘
```

## Memory System

- **IndexedDB**: Browser-side persistent storage
- **LTM (Long-Term Memory)**: Persistent data
- **STM (Short-Term Memory)**: Session data

## Supported CSS Properties

### Layout
```css
display: flex; flex-wrap: wrap; justify-content: space-evenly;
display: grid; grid-column-span: 2; grid-row-span: 2;
position: absolute; float: left; display: inline;
overflow: hidden; z-index: 10;
```

### Visual Effects
```css
border-radius: 12px;
border: 3px solid #e91e63;
box-shadow: 0 8px 32px rgba(0,0,0,0.3);
background: linear-gradient(#1e88e5, #42a5f5);
transform: translate(30px, 10px) rotate(15deg) scale(1.1);
opacity: 0.9;
```

### Typography
```css
font-family: "Custom Font", system-ui;
font-size: 16px; line-height: 1.5;
letter-spacing: 1px;
text-align: center;
```

### Responsive
```css
@media (min-width: 768px) { ... }
@media (orientation: landscape) { ... }
```

## License

MIT
