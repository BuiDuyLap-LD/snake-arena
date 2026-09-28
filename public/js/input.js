// public/js/input.js

class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.angle = 0;
    this.boosting = false;

    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;

    this.onInputChange = null;
    this.setupListeners();
  }

  setupListeners() {
    // Mouse movement
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this.calculateAngle();
    });

    // Mouse click for boost
    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('.hud-interactive') || e.target.closest('.overlay-screen') || e.target.closest('.modal-overlay')) {
        return;
      }
      if (e.button === 0) { // Left click
        this.boosting = true;
        this.notifyChange();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.boosting = false;
        this.notifyChange();
      }
    });

    // Keyboard (Space to boost, Arrow keys / WASD option)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.boosting = true;
        this.notifyChange();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.boosting = false;
        this.notifyChange();
      }
    });

    // Touch controls for mobile / tablet
    let touchId = null;
    window.addEventListener('touchstart', (e) => {
      if (e.target.closest('.hud-interactive') || e.target.closest('.overlay-screen') || e.target.closest('.modal-overlay')) {
        return;
      }
      const touch = e.touches[0];
      if (touch) {
        touchId = touch.identifier;
        this.mouseX = touch.clientX;
        this.mouseY = touch.clientY;
        this.calculateAngle();
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === touchId) {
          this.mouseX = touch.clientX;
          this.mouseY = touch.clientY;
          this.calculateAngle();
          break;
        }
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      // Touch ended
    }, { passive: true });

    // Window resize
    window.addEventListener('resize', () => {
      this.calculateAngle();
    });
  }

  calculateAngle() {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    this.angle = Math.atan2(this.mouseY - cy, this.mouseX - cx);
    this.notifyChange();
  }

  setTouchBoost(state) {
    this.boosting = state;
    this.notifyChange();
  }

  notifyChange() {
    if (this.onInputChange) {
      this.onInputChange({
        angle: this.angle,
        boosting: this.boosting,
      });
    }
  }
}

window.InputManager = InputManager;
