/**
 * Obsidian Flux - Interactive Engine
 * Ganesh Nil | Cinematic Developer Identity Portfolio
 */

(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ==========================================
  // 1. WebGL Background Fluid Shader
  // ==========================================
  function initBackgroundShader() {
    const canvas = document.getElementById('shader-canvas');
    if (!canvas) return;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return;

    function syncCanvasSize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
    }
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);

    const vsSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision highp float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;
      varying vec2 v_texCoord;

      // Simplex 2D noise
      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m;
        m = m*m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 uv = v_texCoord;
        vec2 mouse = u_mouse / u_resolution;
        
        // Evolving fluid background
        float n1 = snoise(uv * 1.8 + u_time * 0.08);
        float n2 = snoise(uv * 3.5 - u_time * 0.12 + n1 * 0.8);
        
        // Aesthetic color palette (Deep Void -> Dark Cyan -> Electric Accent)
        vec3 colorBg = vec3(0.04, 0.04, 0.06);
        vec3 colorCyan = vec3(0.0, 0.16, 0.22);
        vec3 colorPurple = vec3(0.12, 0.0, 0.25);
        vec3 accent = vec3(0.0, 0.95, 1.0);
        
        float mixFactor = clamp(n2 * 0.5 + 0.5, 0.0, 1.0);
        vec3 color = mix(colorBg, colorCyan, mixFactor);
        color = mix(color, colorPurple, clamp(n1 * 0.4 + 0.2, 0.0, 1.0));
        
        // Glowing luminous ribbons
        float ribbon = smoothstep(0.42, 0.5, abs(n2)) * 0.14;
        color += accent * ribbon;
        
        // Mouse glow interaction
        float mouseDist = length(uv - mouse);
        float mouseGlow = smoothstep(0.35, 0.0, mouseDist) * 0.18;
        color += accent * mouseGlow;
        
        // Vignette effect
        float vignette = smoothstep(1.6, 0.4, length(uv - 0.5));
        color *= vignette;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    function createShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = createShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uTimeLoc = gl.getUniformLocation(program, 'u_time');
    const uResLoc = gl.getUniformLocation(program, 'u_resolution');
    const uMouseLoc = gl.getUniformLocation(program, 'u_mouse');

    let mousePos = { x: canvas.width / 2, y: canvas.height / 2 };
    let targetMouse = { x: canvas.width / 2, y: canvas.height / 2 };

    window.addEventListener('mousemove', (e) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      targetMouse.x = e.clientX * dpr;
      targetMouse.y = (window.innerHeight - e.clientY) * dpr;
    });

    let startTime = performance.now();

    function renderLoop(now) {
      mousePos.x += (targetMouse.x - mousePos.x) * 0.08;
      mousePos.y += (targetMouse.y - mousePos.y) * 0.08;

      gl.viewport(0, 0, canvas.width, canvas.height);
      const elapsed = (now - startTime) * 0.001;

      if (uTimeLoc) gl.uniform1f(uTimeLoc, elapsed);
      if (uResLoc) gl.uniform2f(uResLoc, canvas.width, canvas.height);
      if (uMouseLoc) gl.uniform2f(uMouseLoc, mousePos.x, mousePos.y);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      requestAnimationFrame(renderLoop);
    }

    requestAnimationFrame(renderLoop);
  }

  // ==========================================
  // 2. Three.js Interactive 3D Hero Structure
  // ==========================================
  function initHero3D() {
    const container = document.getElementById('hero-3d-container');
    if (!container || typeof THREE === 'undefined') return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.z = 4.2;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();

    // 1. Inner glowing icosahedron wireframe
    const coreGeo = new THREE.IcosahedronGeometry(1.2, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00f2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.65
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // 2. Inner points cloud
    const pointsGeo = new THREE.IcosahedronGeometry(1.0, 2);
    const pointsMat = new THREE.PointsMaterial({
      color: 0xe1fdff,
      size: 0.04,
      transparent: true,
      opacity: 0.8
    });
    const points = new THREE.Points(pointsGeo, pointsMat);
    group.add(points);

    // 3. Dual Orbital Rings
    const ring1Geo = new THREE.TorusGeometry(1.8, 0.015, 16, 100);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f2ff,
      transparent: true,
      opacity: 0.4
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI / 3;
    group.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(2.1, 0.012, 16, 100);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x7000ff,
      transparent: true,
      opacity: 0.5
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.y = Math.PI / 4;
    group.add(ring2);

    scene.add(group);

    // Mouse parallax
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;

    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animate() {
      requestAnimationFrame(animate);

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;

      group.rotation.x += 0.003;
      group.rotation.y += 0.004;
      core.rotation.z += 0.005;
      ring1.rotation.z -= 0.006;
      ring2.rotation.x += 0.005;

      group.position.x = targetX * 0.35;
      group.position.y = -targetY * 0.35;

      renderer.render(scene, camera);
    }
    animate();

    function onWindowResize() {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onWindowResize);
  }

  // ==========================================
  // 3. Custom Dual-Stage Lerp Cursor
  // ==========================================
  function initCustomCursor() {
    if (prefersReducedMotion || window.innerWidth < 768) return;

    const cursor = document.getElementById('custom-cursor');
    const follower = document.getElementById('custom-cursor-follower');
    if (!cursor || !follower) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;
    let followerX = mouseX;
    let followerY = mouseY;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    function renderCursor() {
      cursorX += (mouseX - cursorX) * 0.35;
      cursorY += (mouseY - cursorY) * 0.35;
      followerX += (mouseX - followerX) * 0.12;
      followerY += (mouseY - followerY) * 0.12;

      cursor.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
      follower.style.transform = `translate(${followerX}px, ${followerY}px) translate(-50%, -50%)`;

      requestAnimationFrame(renderCursor);
    }
    renderCursor();

    const hoverElements = document.querySelectorAll('.interactive, a, button, .tilt-card');
    hoverElements.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('hovered');
        follower.classList.add('hovered');
        if (el.classList.contains('project-card')) {
          cursor.textContent = 'VIEW';
        } else if (el.classList.contains('social-card')) {
          cursor.textContent = 'GO';
        } else {
          cursor.textContent = '';
        }
      });

      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('hovered');
        follower.classList.remove('hovered');
        cursor.textContent = '';
      });
    });
  }

  // ==========================================
  // 4. 3D Card Perspective Tilt
  // ==========================================
  function init3DTilt() {
    if (prefersReducedMotion) return;

    const tiltCards = document.querySelectorAll('.tilt-card');
    tiltCards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      });

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'none';
      });
    });
  }

  // ==========================================
  // 5. Magnetic Hover on Buttons and Links
  // ==========================================
  function initMagnetic() {
    if (prefersReducedMotion) return;

    const magneticWraps = document.querySelectorAll('.magnetic-wrap');
    magneticWraps.forEach((wrap) => {
      const inner = wrap.querySelector('.magnetic-inner') || wrap;

      wrap.addEventListener('mousemove', (e) => {
        const rect = wrap.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const moveX = (relX - centerX) * 0.28;
        const moveY = (relY - centerY) * 0.28;

        inner.style.transform = `translate(${moveX.toFixed(2)}px, ${moveY.toFixed(2)}px)`;
        inner.style.transition = 'none';
      });

      wrap.addEventListener('mouseleave', () => {
        inner.style.transform = 'translate(0px, 0px)';
        inner.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      });
    });
  }

  // ==========================================
  // 6. Scroll Reveal Observer & Active Navigation
  // ==========================================
  function initScrollReveals() {
    const reveals = document.querySelectorAll('.reveal');
    if (!prefersReducedMotion && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

      reveals.forEach((el) => observer.observe(el));
    } else {
      reveals.forEach((el) => el.classList.add('active'));
    }

    // Active Section Tracking
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

    window.addEventListener('scroll', () => {
      let current = '';
      const scrollPos = window.scrollY + 200;

      sections.forEach((section) => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          current = section.getAttribute('id');
        }
      });

      navLinks.forEach((link) => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });

      mobileNavLinks.forEach((link) => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
          link.classList.add('active');
        }
      });
    });
  }

  // ==========================================
  // 7. Mobile Navigation Drawer
  // ==========================================
  function initMobileMenu() {
    const toggleBtn = document.getElementById('mobile-menu-btn');
    const drawer = document.getElementById('mobile-nav-drawer');

    if (!toggleBtn || !drawer) return;

    const drawerLinks = drawer.querySelectorAll('a');

    function setDrawerState(isOpen) {
      drawer.classList.toggle('open', isOpen);
      toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      const icon = toggleBtn.querySelector('.material-symbols-outlined');
      if (icon) {
        icon.textContent = isOpen ? 'close' : 'menu';
      }
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = drawer.classList.contains('open');
      setDrawerState(!isOpen);
    });

    drawerLinks.forEach((link) => {
      link.addEventListener('click', () => {
        setDrawerState(false);
      });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (drawer.classList.contains('open') && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
        setDrawerState(false);
      }
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        setDrawerState(false);
      }
    });

    // Close on desktop resize
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 860 && drawer.classList.contains('open')) {
        setDrawerState(false);
      }
    });
  }

  // ==========================================
  // 8. Copy Email / Contact Action
  // ==========================================
  function initContactAction() {
    const contactBtn = document.getElementById('contact-action-btn');
    if (!contactBtn) return;

    contactBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const email = 'ganeshneel278@gmail.com';
      navigator.clipboard.writeText(email).then(() => {
        const originalText = contactBtn.innerHTML;
        contactBtn.innerHTML = '<span class="material-symbols-outlined text-sm">check</span> Email Copied to Clipboard!';
        setTimeout(() => {
          contactBtn.innerHTML = originalText;
        }, 2500);
      }).catch(() => {
        window.location.href = `mailto:${email}`;
      });
    });
  }

  // Boot on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initBackgroundShader();
    initHero3D();
    initCustomCursor();
    init3DTilt();
    initMagnetic();
    initScrollReveals();
    initMobileMenu();
    initContactAction();
  });
})();
