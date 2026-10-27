# ADR 001: HTML5 Canvas vs DOM/SVG for Commit & Branch Graph

## Status
Accepted

## Context
Rendering complex Git topologies (especially in repositories with 5,000 to 100,000+ commits such as Linux or VS Code) introduces massive DOM overhead when using raw SVG or HTML elements. Each commit node, branch lane line, bezier curve, and merge arc adds multiple DOM nodes. With SVG, scrolling through tens of thousands of commits leads to frequent layout thrashing, excessive garbage collection, and frame drops below 15 FPS.

## Decision
We chose a high-performance **HTML5 Canvas 2D** rendering engine coupled with **virtual windowing**:
1. Only commits currently visible inside the viewport buffer are rendered per frame.
2. Smooth cubic Bézier curves (`ctx.bezierCurveTo`) are computed in linear time $O(N)$ with no persistent DOM tree cost.
3. Interactive hover and click hit-testing is performed mathematically using row offsets and lane positions.

## Consequences
### Positive
- Sustained 60 FPS scrolling even in repositories with 50,000+ commits.
- Sub-50MB memory footprint for large repositories.
- Zero DOM element bloat in the Webview process.

### Trade-offs
- Text labels (commit subject, branch pills, author names) are layered as lightweight HTML above the canvas for crisp OS-level subpixel antialiasing and native clipboard selection.
