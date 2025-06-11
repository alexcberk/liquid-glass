// Vanilla JS Liquid Glass Effect - Paste into browser console
// Forked from Shu Ding (https://github.com/shuding/liquid-glass) in 2025.

const LOGO_WIDTH = 163;
const LOGO_HEIGHT = Math.floor((LOGO_WIDTH * 309) / 326);

const _logo = `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Layer_2" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 325.51 308.78">
  <defs>
    <style>
      .cls-1 {
        fill: #060419;
      }
    </style>
  </defs>
  <g id="Layer_1-2" data-name="Layer 1">
    <g>
      <path class="cls-1" d="M283.19,145.14H42.6c-6.13,0-11.14-5.04-11.14-11.21v-17.09c0-19.33,15.59-35.02,34.81-35.02h192.97c19.21,0,34.81,15.69,34.81,35.02v17.09c.28,6.16-4.73,11.21-10.86,11.21Z"/>
      <path class="cls-1" d="M232.51,63.32H93.28c-6.13,0-11.42-5.04-11.42-11.49C81.87,23.26,104.98,0,133.38,0h59.03c28.4,0,51.51,23.26,51.51,51.84,0,6.44-5.01,11.49-11.42,11.49Z"/>
      <path class="cls-1" d="M294.33,163.63H31.47c-17.26,0-31.47,14.29-31.47,31.66s14.2,31.66,31.47,31.66h93.28c3.34-17.93,18.93-31.66,37.87-31.66s34.81,13.73,38.15,31.66h93.28c17.26,0,31.47-14.29,31.47-31.66s-13.92-31.66-31.19-31.66Z"/>
      <path class="cls-1" d="M282.91,245.45h-81.59v63.32h61.26c17.26,0,31.47-14.29,31.47-31.66v-20.17c.28-6.16-4.73-11.49-11.14-11.49Z"/>
      <path class="cls-1" d="M42.6,245.45c-6.13,0-11.42,5.04-11.42,11.49v20.17c0,17.37,14.2,31.66,31.47,31.66h61.26v-63.32c.28,0-81.31,0-81.31,0Z"/>
    </g>
  </g>
</svg>`;

(function () {
  'use strict';

  // Check if liquid glass already exists and destroy it
  if (window.liquidGlass) {
    window.liquidGlass.destroy();
    console.log('Previous liquid glass effect removed.');
  }

  // Utility functions
  function smoothStep(a, b, t) {
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function length(x, y) {
    return Math.sqrt(x * x + y * y);
  }

  function roundedRectSDF(x, y, width, height, radius) {
    const qx = Math.abs(x) - width + radius;
    const qy = Math.abs(y) - height + radius;
    return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
  }

  function texture(x, y) {
    return { type: 't', x, y };
  }

  // Generate unique ID
  function generateId() {
    return 'liquid-glass-' + Math.random().toString(36).substr(2, 9);
  }

  // Main Shader class
  class Shader {
    constructor(options = {}) {
      this.width = options.width || 100;
      this.height = options.height || 100;
      this.fragment = options.fragment || ((uv) => texture(uv.x, uv.y));
      // Optional SVG that will be used to mask/clip the glass shape
      this.shapeSvg = options.shapeSvg || null;
      this.canvasDPI = 1;
      this.id = generateId();
      this.offset = 10; // Viewport boundary offset

      this.mouse = { x: 0, y: 0 };
      this.mouseUsed = false;

      this.createElement();
      this.setupEventListeners();
      this.updateShader();
    }

    createElement() {
      // Create container
      this.container = document.createElement('div');
      this.container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: ${this.width}px;
        height: ${this.height}px;
        overflow: hidden;
        border-radius: 150px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.25), 0 -10px 25px inset rgba(0, 0, 0, 0.15);
        cursor: grab;
        backdrop-filter: url(#${this.id}_filter) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1);
        z-index: 9999;
        pointer-events: auto;
      `;

      // Apply SVG mask if provided
      if (this.shapeSvg) {
        const encodedSvg = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(this.shapeSvg)));

        // Standard and WebKit-prefixed properties for broad browser support
        this.container.style.maskImage = `url("${encodedSvg}")`;
        this.container.style.webkitMaskImage = `url("${encodedSvg}")`;

        this.container.style.maskMode = 'alpha';
        this.container.style.webkitMaskComposite = 'source-over';

        this.container.style.maskRepeat = 'no-repeat';
        this.container.style.webkitMaskRepeat = 'no-repeat';

        this.container.style.maskSize = 'contain';
        this.container.style.webkitMaskSize = 'contain';

        this.container.style.maskPosition = 'center';
        this.container.style.webkitMaskPosition = 'center';

        // Remove the default rounded rectangle if we're using a custom shape
        this.container.style.borderRadius = '0';
      }

      // Create SVG filter
      this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      this.svg.setAttribute('width', '0');
      this.svg.setAttribute('height', '0');
      this.svg.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        pointer-events: none;
        z-index: 9998;
      `;

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
      filter.setAttribute('id', `${this.id}_filter`);
      filter.setAttribute('filterUnits', 'userSpaceOnUse');
      filter.setAttribute('colorInterpolationFilters', 'sRGB');
      filter.setAttribute('x', '0');
      filter.setAttribute('y', '0');
      filter.setAttribute('width', this.width.toString());
      filter.setAttribute('height', this.height.toString());

      this.feImage = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
      this.feImage.setAttribute('id', `${this.id}_map`);
      this.feImage.setAttribute('width', this.width.toString());
      this.feImage.setAttribute('height', this.height.toString());

      this.feDisplacementMap = document.createElementNS('http://www.w3.org/2000/svg', 'feDisplacementMap');
      this.feDisplacementMap.setAttribute('in', 'SourceGraphic');
      this.feDisplacementMap.setAttribute('in2', `${this.id}_map`);
      this.feDisplacementMap.setAttribute('xChannelSelector', 'R');
      this.feDisplacementMap.setAttribute('yChannelSelector', 'G');

      filter.appendChild(this.feImage);
      filter.appendChild(this.feDisplacementMap);
      defs.appendChild(filter);
      this.svg.appendChild(defs);

      // Create canvas for displacement map (hidden)
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.width * this.canvasDPI;
      this.canvas.height = this.height * this.canvasDPI;
      this.canvas.style.display = 'none';

      this.context = this.canvas.getContext('2d');
    }

    constrainPosition(x, y) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate boundaries with offset
      const minX = this.offset;
      const maxX = viewportWidth - this.width - this.offset;
      const minY = this.offset;
      const maxY = viewportHeight - this.height - this.offset;

      // Constrain position
      const constrainedX = Math.max(minX, Math.min(maxX, x));
      const constrainedY = Math.max(minY, Math.min(maxY, y));

      return { x: constrainedX, y: constrainedY };
    }

    setupEventListeners() {
      let isDragging = false;
      let startX, startY, initialX, initialY;

      this.container.addEventListener('mousedown', (e) => {
        isDragging = true;
        this.container.style.cursor = 'grabbing';
        startX = e.clientX;
        startY = e.clientY;
        const rect = this.container.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;

          // Calculate new position
          const newX = initialX + deltaX;
          const newY = initialY + deltaY;

          // Constrain position within viewport bounds
          const constrained = this.constrainPosition(newX, newY);

          this.container.style.left = constrained.x + 'px';
          this.container.style.top = constrained.y + 'px';
          this.container.style.transform = 'none';
        }

        // Update mouse position for shader
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left) / rect.width;
        this.mouse.y = (e.clientY - rect.top) / rect.height;

        if (this.mouseUsed) {
          this.updateShader();
        }
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
        this.container.style.cursor = 'grab';
      });

      // Handle window resize to maintain constraints
      window.addEventListener('resize', () => {
        const rect = this.container.getBoundingClientRect();
        const constrained = this.constrainPosition(rect.left, rect.top);

        if (rect.left !== constrained.x || rect.top !== constrained.y) {
          this.container.style.left = constrained.x + 'px';
          this.container.style.top = constrained.y + 'px';
          this.container.style.transform = 'none';
        }
      });
    }

    updateShader() {
      const mouseProxy = new Proxy(this.mouse, {
        get: (target, prop) => {
          this.mouseUsed = true;
          return target[prop];
        },
      });

      this.mouseUsed = false;

      const w = this.width * this.canvasDPI;
      const h = this.height * this.canvasDPI;
      const data = new Uint8ClampedArray(w * h * 4);

      let maxScale = 0;
      const rawValues = [];

      for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % w;
        const y = Math.floor(i / 4 / w);
        const pos = this.fragment({ x: x / w, y: y / h }, mouseProxy);
        const dx = pos.x * w - x;
        const dy = pos.y * h - y;
        maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
        rawValues.push(dx, dy);
      }

      maxScale *= 0.5;

      let index = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = rawValues[index++] / maxScale + 0.5;
        const g = rawValues[index++] / maxScale + 0.5;
        data[i] = r * 255;
        data[i + 1] = g * 255;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }

      this.context.putImageData(new ImageData(data, w, h), 0, 0);
      this.feImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', this.canvas.toDataURL());
      this.feDisplacementMap.setAttribute('scale', (maxScale / this.canvasDPI).toString());
    }

    appendTo(parent) {
      parent.appendChild(this.svg);
      parent.appendChild(this.container);
    }

    destroy() {
      this.svg.remove();
      this.container.remove();
      this.canvas.remove();
    }
  }

  // Create the liquid glass effect
  function createLiquidGlass() {
    // Create shader
    const shader = new Shader({
      // Match the original viewBox of the logo for best fidelity
      width: LOGO_WIDTH,
      height: LOGO_HEIGHT,
      shapeSvg: _logo,
      fragment: (uv, mouse) => {
        const ix = uv.x - 0.5;
        const iy = uv.y - 0.5;
        const distanceToEdge = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
        const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15);
        const scaled = smoothStep(0, 1, displacement);
        return texture(ix * scaled + 0.5, iy * scaled + 0.5);
      },
    });

    // Add to page
    shader.appendTo(document.body);

    console.log('Liquid Glass effect created! Drag the glass around the page.');

    // Return shader instance so it can be removed if needed
    window.liquidGlass = shader;
  }

  // Initialize
  createLiquidGlass();
})();
