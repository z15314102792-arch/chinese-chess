/**
 * 禅意粒子背景 —— Canvas 金色微粒漂浮系统
 * 模拟香炉烟雾/阳光中尘埃缓慢升腾的效果
 */
const Particles = (() => {
  let canvas, ctx, particles = [], animId, running = false;

  const cfg = {
    count: 22,
    glow: '180,120,60', // 琥珀金色
    opacity: 0.50,
    minSize: 1.2,
    maxSize: 3.0,
  };

  class Particle {
    constructor(w, h, init) {
      this.reset(w, h, init);
    }
    reset(w, h, init) {
      this.x = init ? Math.random() * w : Math.random() * w;
      this.y = init ? Math.random() * h : h + 20;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = -(Math.random() * 0.35 + 0.15); // 上飘
      this.size = cfg.minSize + Math.random() * (cfg.maxSize - cfg.minSize);
      this.life = init ? Math.random() * 300 : 0;
      this.maxLife = 350 + Math.random() * 500;
      this.opacity = 0;
      this.targetOp = cfg.opacity * (0.4 + Math.random() * 0.6);
      this.wobbleAmp = 0.1 + Math.random() * 0.3;
      this.wobbleFreq = 0.02 + Math.random() * 0.04;
    }
    update(w, h, dt) {
      const t = dt / 16;
      this.life += dt;
      // 淡入
      if (this.life < 100) this.opacity = this.targetOp * (this.life / 100);
      // 淡出
      const fadeStart = this.maxLife - 100;
      if (this.life > fadeStart) this.opacity = this.targetOp * Math.max(0, 1 - (this.life - fadeStart) / 100);
      // 水平微摆
      this.vx += Math.sin(this.life * this.wobbleFreq) * this.wobbleAmp * 0.02;
      // 限速
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > 0.6) { const s = 0.6 / speed; this.vx *= s; this.vy *= s; }
      // 位移
      this.x += this.vx * t;
      this.y += this.vy * t;
      // 越界重生
      if (this.y < -30 || this.x < -40 || this.x > w + 40 || this.life > this.maxLife) {
        this.reset(w, h, false);
      }
    }
    draw(ctx) {
      if (this.opacity < 0.02) return;
      const a = this.opacity;
      const r = this.size;
      // 光晕：径向渐变从中心到边缘
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 4);
      grad.addColorStop(0, `rgba(${cfg.glow},${a.toFixed(3)})`);
      grad.addColorStop(0.15, `rgba(${cfg.glow},${(a * 0.8).toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(${cfg.glow},${(a * 0.2).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${cfg.glow},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  let lastTime = 0;
  function animate(time) {
    if (!running) return;
    const dt = lastTime ? Math.min(time - lastTime, 50) : 16;
    lastTime = time;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = window.innerWidth, h = window.innerHeight;
    for (const p of particles) p.update(w, h, dt);
    for (const p of particles) p.draw(ctx);
    animId = requestAnimationFrame(animate);
  }

  function initCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'particles-canvas';
    Object.assign(canvas.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100%', height: '100%',
      zIndex: '-1', pointerEvents: 'none',
    });
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function start() {
    if (running) return;
    initCanvas();
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    cfg.count = isMobile ? 12 : 22;
    cfg.opacity = isMobile ? 0.40 : 0.50;
    particles = Array.from({ length: cfg.count }, () =>
      new Particle(window.innerWidth, window.innerHeight, true)
    );
    running = true;
    lastTime = 0;
    animId = requestAnimationFrame(animate);
  }

  function stop() {
    running = false;
    if (animId) { cancelAnimationFrame(animId); animId = null; }
    if (canvas && canvas.parentNode) { canvas.parentNode.removeChild(canvas); canvas = null; ctx = null; }
    particles = [];
  }

  return { start, stop };
})();
