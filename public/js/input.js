// public/js/input.js

class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.angle = 0;
    this.boosting = false;

    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;

    this.joystickZone = document.getElementById('joystick-zone');
    this.joystickBase = document.getElementById('joystick-base');
    this.joystickThumb = document.getElementById('joystick-thumb');

    this.joystickTouchId = null;
    this.joystickMaxDist = 38; // Maximum thumbstick displacement in pixels

    this.onInputChange = null;
    this.setupListeners();
    this.setupJoystick();
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

    // General Touch controls (for steering directly on canvas if not using joystick)
    let generalTouchId = null;
    window.addEventListener('touchstart', (e) => {
      if (e.target.closest('.hud-interactive') || e.target.closest('.overlay-screen') || e.target.closest('.modal-overlay')) {
        return;
      }
      if (this.joystickTouchId !== null) return; // Prioritize joystick

      const touch = e.touches[0];
      if (touch) {
        generalTouchId = touch.identifier;
        this.mouseX = touch.clientX;
        this.mouseY = touch.clientY;
        this.calculateAngle();
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.joystickTouchId !== null) return;

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        if (touch.identifier === generalTouchId) {
          this.mouseX = touch.clientX;
          this.mouseY = touch.clientY;
          this.calculateAngle();
          break;
        }
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === generalTouchId) {
          generalTouchId = null;
          break;
        }
      }
    }, { passive: true });

    // Window resize
    window.addEventListener('resize', () => {
      this.calculateAngle();
    });
  }

  setupJoystick() {
    if (!this.joystickZone || !this.joystickBase || !this.joystickThumb) return;

    const handleJoystickStart = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const touch = e.changedTouches ? e.changedTouches[0] : e;
      this.joystickTouchId = touch.identifier !== undefined ? touch.identifier : 'mouse';
      this.updateJoystickPosition(touch.clientX, touch.clientY);
    };

    const handleJoystickMove = (e) => {
      if (this.joystickTouchId === null) return;
      e.preventDefault();

      if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          if (touch.identifier === this.joystickTouchId) {
            this.updateJoystickPosition(touch.clientX, touch.clientY);
            break;
          }
        }
      } else {
        this.updateJoystickPosition(e.clientX, e.clientY);
      }
    };

    const handleJoystickEnd = (e) => {
      if (this.joystickTouchId === null) return;

      let ended = false;
      if (e.changedTouches) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === this.joystickTouchId) {
            ended = true;
            break;
          }
        }
      } else {
        ended = true;
      }

      if (ended) {
        this.joystickTouchId = null;
        this.resetJoystick();
      }
    };

    // Touch events on joystick zone
    this.joystickZone.addEventListener('touchstart', handleJoystickStart, { passive: false });
    window.addEventListener('touchmove', handleJoystickMove, { passive: false });
    window.addEventListener('touchend', handleJoystickEnd, { passive: true });
    window.addEventListener('touchcancel', handleJoystickEnd, { passive: true });

    // Mouse events on joystick zone (allows testing in browser emulator)
    this.joystickZone.addEventListener('mousedown', handleJoystickStart);
    window.addEventListener('mousemove', (e) => {
      if (this.joystickTouchId === 'mouse') handleJoystickMove(e);
    });
    window.addEventListener('mouseup', (e) => {
      if (this.joystickTouchId === 'mouse') handleJoystickEnd(e);
    });
  }

  updateJoystickPosition(clientX, clientY) {
    const rect = this.joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);

    if (distance > 2) {
      this.angle = Math.atan2(dy, dx);
      this.notifyChange();
    }

    const clampedDist = Math.min(distance, this.joystickMaxDist);
    const angle = Math.atan2(dy, dx);
    const thumbX = Math.cos(angle) * clampedDist;
    const thumbY = Math.sin(angle) * clampedDist;

    this.joystickThumb.style.transform = `translate3d(${thumbX.toFixed(1)}px, ${thumbY.toFixed(1)}px, 0)`;
  }

  resetJoystick() {
    this.joystickThumb.style.transform = 'translate3d(0, 0, 0)';
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
