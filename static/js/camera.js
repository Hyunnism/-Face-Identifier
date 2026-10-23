/**
 * camera.js - Webcam streaming, frame capturing, and Canvas HUD rendering
 */

class CameraManager {
  constructor(videoElement, canvasElement, isMirrored = true) {
    this.video = videoElement;
    this.canvas = canvasElement;
    this.stream = null;
    this.isActive = false;
    this.isMirrored = isMirrored;
  }

  async start() {
    if (this.isActive) return true;
    try {
      const constraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      await new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          this.video.play();
          this.isActive = true;
          this.syncCanvasSize();
          resolve(true);
        };
      });
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      throw err;
    }
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.isActive = false;
    this.clearCanvas();
  }

  syncCanvasSize() {
    if (this.canvas && this.video.videoWidth) {
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
    }
  }

  clearCanvas() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  captureFrame(maxWidth = 480, quality = 0.8) {
    if (!this.isActive || !this.video.videoWidth) return null;
    
    // Scale down for ultra-fast transfer & sub-80ms CPU inference
    const scale = Math.min(1, maxWidth / this.video.videoWidth);
    const w = Math.round(this.video.videoWidth * scale);
    const h = Math.round(this.video.videoHeight * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    ctx.drawImage(this.video, 0, 0, w, h);
    return offscreen.toDataURL('image/jpeg', quality);
  }

  drawBoundingBoxes(faces, imageWidth, imageHeight, mirror = true) {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!faces || faces.length === 0) return;

    const scaleX = this.canvas.width / imageWidth;
    const scaleY = this.canvas.height / imageHeight;

    faces.forEach(face => {
      const [x1, y1, x2, y2] = face.bbox;
      
      // If mirrored (selfie webcam), flip horizontal coordinate so text stays normal
      let rx1, rw;
      if (mirror) {
        rx1 = (imageWidth - x2) * scaleX;
        rw = (x2 - x1) * scaleX;
      } else {
        rx1 = x1 * scaleX;
        rw = (x2 - x1) * scaleX;
      }
      const ry1 = y1 * scaleY;
      const rh = (y2 - y1) * scaleY;

      let color = '#ef4444'; // Red for unknown
      let dotColor = '#ef4444';
      let label = 'Wajah Tidak Dikenali';

      if (face.status === 'MATCH' && face.person) {
        color = '#10b981'; // Green for match
        dotColor = '#10b981';
        label = `${face.person.name} (${face.score}%)`;
      } else if (face.status === 'AMBIGUOUS' && face.person) {
        color = '#f59e0b'; // Amber for ambiguous
        dotColor = '#f59e0b';
        label = `Ambigu: ${face.person.name}? (${face.score}%)`;
      } else {
        color = 'rgba(255, 255, 255, 0.75)';
      }

      ctx.save();
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;

      // Draw Corner Brackets HUD Style
      const cornerLen = Math.min(rw, rh) * 0.22;
      
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(rx1, ry1 + cornerLen);
      ctx.lineTo(rx1, ry1);
      ctx.lineTo(rx1 + cornerLen, ry1);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(rx1 + rw - cornerLen, ry1);
      ctx.lineTo(rx1 + rw, ry1);
      ctx.lineTo(rx1 + rw, ry1 + cornerLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(rx1, ry1 + rh - cornerLen);
      ctx.lineTo(rx1, ry1 + rh);
      ctx.lineTo(rx1 + cornerLen, ry1 + rh);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(rx1 + rw - cornerLen, ry1 + rh);
      ctx.lineTo(rx1 + rw, ry1 + rh);
      ctx.lineTo(rx1 + rw, ry1 + rh - cornerLen);
      ctx.stroke();

      // Subtle translucent box fill
      ctx.fillStyle = face.status === 'MATCH' ? 'rgba(16, 185, 129, 0.08)' : (face.status === 'AMBIGUOUS' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255, 255, 255, 0.03)');
      ctx.fillRect(rx1, ry1, rw, rh);

      // Label Pill HUD (Luxury Dark Glass with Status Dot)
      ctx.font = '500 12px Inter, -apple-system, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const dotRadius = 3.5;
      const padX = 10;
      const tagH = 26;
      const pillWidth = textWidth + padX * 2 + dotRadius * 2 + 6;
      const tagY = Math.max(0, ry1 - tagH - 6);

      // Pill Background
      ctx.fillStyle = 'rgba(10, 10, 14, 0.88)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(rx1, tagY, pillWidth, tagH, 9999);
      } else {
        ctx.rect(rx1, tagY, pillWidth, tagH);
      }
      ctx.fill();
      ctx.stroke();

      // Status Dot
      ctx.beginPath();
      ctx.arc(rx1 + padX + dotRadius, tagY + tagH / 2, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();

      // Label text (pure white)
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, rx1 + padX + dotRadius * 2 + 6, tagY + 17);

      ctx.restore();
    });
  }
}

window.CameraManager = CameraManager;
