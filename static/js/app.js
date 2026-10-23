/**
 * app.js - Frontend application logic for Identify Face Recognition
 * Pure Vanilla JS, Zero Emojis, Luxury Editorial Tech Interface
 */

document.addEventListener('DOMContentLoaded', () => {
  // ---------------- DOM ELEMENTS ----------------
  // Navigation Pills
  const navPills = document.querySelectorAll('.nav-pills .pill-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const btnQuickAction = document.getElementById('btnQuickAction');

  // Scanner Viewport & Controls
  const btnScanWebcam = document.getElementById('btnScanWebcam');
  const btnScanPhoto = document.getElementById('btnScanPhoto');
  const videoContainer = document.getElementById('videoContainer');
  const photoScanContainer = document.getElementById('photoScanContainer');
  const scanVideo = document.getElementById('scanVideo');
  const scanOverlay = document.getElementById('scanOverlay');
  const btnToggleCamera = document.getElementById('btnToggleCamera');
  const btnActionArrow = document.getElementById('btnActionArrow');
  const btnCameraText = document.getElementById('btnCameraText');
  const autoScanSwitch = document.getElementById('autoScanSwitch');
  const thresholdInput = document.getElementById('thresholdInput');
  const thresholdValue = document.getElementById('thresholdValue');

  // Scanner File Test Elements
  const scanPhotoDropzone = document.getElementById('scanPhotoDropzone');
  const scanPhotoInput = document.getElementById('scanPhotoInput');
  const scanDropPrompt = document.getElementById('scanDropPrompt');
  const scanPhotoPreviewWrap = document.getElementById('scanPhotoPreviewWrap');
  const scanPhotoPreview = document.getElementById('scanPhotoPreview');
  const scanPhotoCanvas = document.getElementById('scanPhotoCanvas');
  const btnClearScanPhoto = document.getElementById('btnClearScanPhoto');
  const scanLoader = document.getElementById('scanLoader');

  // Result Card Elements
  const matchBadge = document.getElementById('matchBadge');
  const emptyResult = document.getElementById('emptyResult');
  const identityCard = document.getElementById('identityCard');
  const avatarLetter = document.getElementById('avatarLetter');
  const resName = document.getElementById('resName');
  const resCode = document.getElementById('resCode');
  const resDept = document.getElementById('resDept');
  const resScore = document.getElementById('resScore');
  const resProgress = document.getElementById('resProgress');
  const statLatencyVal = document.getElementById('statLatencyVal');
  const statTotalScanned = document.getElementById('statTotalScanned');

  // Enrollment Elements
  const btnModeSinglePhoto = document.getElementById('btnModeSinglePhoto');
  const btnModeWebcam = document.getElementById('btnModeWebcam');
  const methodSinglePhoto = document.getElementById('methodSinglePhoto');
  const methodWebcam = document.getElementById('methodWebcam');
  const singlePhotoSubmitWrap = document.getElementById('singlePhotoSubmitWrap');
  const enrollName = document.getElementById('enrollName');
  const enrollCode = document.getElementById('enrollCode');
  const enrollDept = document.getElementById('enrollDept');
  const enrollPhotoDropzone = document.getElementById('enrollPhotoDropzone');
  const enrollPhotoInput = document.getElementById('enrollPhotoInput');
  const enrollDropPrompt = document.getElementById('enrollDropPrompt');
  const enrollPreviewWrap = document.getElementById('enrollPreviewWrap');
  const enrollPhotoPreview = document.getElementById('enrollPhotoPreview');
  const btnClearEnrollPhoto = document.getElementById('btnClearEnrollPhoto');
  const btnSubmitPhotoEnroll = document.getElementById('btnSubmitPhotoEnroll');

  // e-KYC Interactive Steppers
  const ekycVideo = document.getElementById('ekycVideo');
  const ovalGuide = document.getElementById('ovalGuide');
  const ekycInstruction = document.getElementById('ekycInstruction');
  const ekycStepDesc = document.getElementById('ekycStepDesc');
  const ekycStepCounter = document.getElementById('ekycStepCounter');
  const checkFront = document.getElementById('checkFront');
  const checkBlink = document.getElementById('checkBlink');
  const checkLeft = document.getElementById('checkLeft');
  const checkRight = document.getElementById('checkRight');
  const stepFront = document.getElementById('stepFront');
  const stepBlink = document.getElementById('stepBlink');
  const stepLeft = document.getElementById('stepLeft');
  const stepRight = document.getElementById('stepRight');
  const btnRestartEkyc = document.getElementById('btnRestartEkyc');
  const btnFinishEkyc = document.getElementById('btnFinishEkyc');

  // Database Directory Elements
  const dbTableBody = document.getElementById('dbTableBody');
  const dbSearchInput = document.getElementById('dbSearchInput');
  const btnRefreshDb = document.getElementById('btnRefreshDb');

  // Tooltip & Toast Containers
  const globalTooltipBox = document.getElementById('globalTooltipBox');
  const toastContainer = document.getElementById('toastContainer');

  // ---------------- STATE VARIABLES ----------------
  const scanCam = new CameraManager(scanVideo, scanOverlay, true);
  const ekycCam = new CameraManager(ekycVideo, null, true);

  let scanLoopActive = false;
  let isScanning = false;
  let selectedEnrollFile = null;

  // e-KYC flow state
  let ekycStep = 0;
  let ekycImages = {};
  let ekycIntervalId = null;
  let blinkDetected = false;

  // ---------------- TOAST NOTIFICATION ----------------
  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ---------------- TOOLTIP POPOVER HANDLER ----------------
  document.querySelectorAll('.info-badge').forEach(badge => {
    const showTip = () => {
      const text = badge.getAttribute('data-tooltip');
      if (!text || !globalTooltipBox) return;
      globalTooltipBox.textContent = text;
      globalTooltipBox.style.display = 'block';

      const rect = badge.getBoundingClientRect();
      const tipRect = globalTooltipBox.getBoundingClientRect();

      let left = rect.left + rect.width / 2 - tipRect.width / 2;
      let top = rect.top - tipRect.height - 8;

      if (left < 10) left = 10;
      if (left + tipRect.width > window.innerWidth - 10) left = window.innerWidth - tipRect.width - 10;
      if (top < 10) top = rect.bottom + 8;

      globalTooltipBox.style.left = `${left}px`;
      globalTooltipBox.style.top = `${top}px`;
    };

    const hideTip = () => {
      if (globalTooltipBox) globalTooltipBox.style.display = 'none';
    };

    badge.addEventListener('mouseenter', showTip);
    badge.addEventListener('mouseleave', hideTip);
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      if (globalTooltipBox && globalTooltipBox.style.display === 'block') {
        hideTip();
      } else {
        showTip();
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.classList.contains('info-badge') && globalTooltipBox) {
      globalTooltipBox.style.display = 'none';
    }
  });

  // ---------------- NAVIGATION PILLS ----------------
  window.switchTab = function(tabName) {
    navPills.forEach(p => {
      if (p.dataset.tab === tabName) {
        p.classList.add('active');
      } else {
        p.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === `pane-${tabName}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    if (tabName !== 'scanner') {
      stopScannerCamera();
    }
    if (tabName !== 'enrollment' || (methodWebcam && methodWebcam.style.display === 'none')) {
      stopEkycCamera();
    }
    if (tabName === 'database') {
      loadPeopleDatabase();
    }
  };

  navPills.forEach(pill => {
    pill.addEventListener('click', () => {
      window.switchTab(pill.dataset.tab);
    });
  });

  // Header quick action button
  if (btnQuickAction) {
    btnQuickAction.addEventListener('click', async () => {
      const scannerTabBtn = document.getElementById('tabBtnScanner');
      if (scannerTabBtn && !scannerTabBtn.classList.contains('active')) {
        scannerTabBtn.click();
      }
      if (scanCam.isActive) {
        stopScannerCamera();
      } else {
        await startScannerCamera();
      }
    });
  }

  // ---------------- TAB 1: SCANNER CONTROLS ----------------
  if (thresholdInput && thresholdValue) {
    thresholdInput.addEventListener('input', (e) => {
      thresholdValue.textContent = `${e.target.value}%`;
    });
  }

  if (btnScanWebcam && btnScanPhoto) {
    btnScanWebcam.addEventListener('click', () => {
      btnScanWebcam.classList.add('active');
      btnScanPhoto.classList.remove('active');
      if (videoContainer) videoContainer.style.display = 'block';
      if (photoScanContainer) photoScanContainer.style.display = 'none';
    });

    btnScanPhoto.addEventListener('click', () => {
      btnScanPhoto.classList.add('active');
      btnScanWebcam.classList.remove('active');
      if (videoContainer) videoContainer.style.display = 'none';
      if (photoScanContainer) photoScanContainer.style.display = 'block';
      stopScannerCamera();
    });
  }

  if (btnToggleCamera) {
    btnToggleCamera.addEventListener('click', async () => {
      if (scanCam.isActive) {
        stopScannerCamera();
      } else {
        await startScannerCamera();
      }
    });
  }

  if (btnActionArrow) {
    btnActionArrow.addEventListener('click', () => {
      if (btnToggleCamera) btnToggleCamera.click();
    });
  }

  async function startScannerCamera() {
    try {
      if (btnToggleCamera) btnToggleCamera.disabled = true;
      if (btnCameraText) btnCameraText.textContent = 'Menghubungkan...';
      await scanCam.start();

      if (btnCameraText) btnCameraText.textContent = 'Hentikan Kamera';
      if (btnQuickAction) btnQuickAction.textContent = 'Hentikan Scan';

      if (autoScanSwitch && autoScanSwitch.checked) {
        startContinuousScan();
      }
    } catch (err) {
      showToast('Gagal mengakses webcam. Pastikan izin kamera telah diberikan.', 'error');
      if (btnCameraText) btnCameraText.textContent = 'Nyalakan Kamera';
      if (btnQuickAction) btnQuickAction.textContent = 'Mulai Scan';
    } finally {
      if (btnToggleCamera) btnToggleCamera.disabled = false;
    }
  }

  function stopScannerCamera() {
    stopContinuousScan();
    scanCam.stop();
    if (btnCameraText) btnCameraText.textContent = 'Nyalakan Kamera';
    if (btnQuickAction) btnQuickAction.textContent = 'Mulai Scan';
    resetIdentityResult();
  }

  function startContinuousScan() {
    scanLoopActive = true;
    runScanFrame();
  }

  function stopContinuousScan() {
    scanLoopActive = false;
  }

  if (autoScanSwitch) {
    autoScanSwitch.addEventListener('change', () => {
      if (autoScanSwitch.checked && scanCam.isActive) {
        startContinuousScan();
      } else {
        stopContinuousScan();
      }
    });
  }

  async function runScanFrame() {
    if (!scanLoopActive || !scanCam.isActive) return;

    if (!isScanning) {
      const frameBase64 = scanCam.captureFrame(400, 0.8);
      if (frameBase64) {
        isScanning = true;
        const startTime = performance.now();

        try {
          const threshold = thresholdInput ? (parseFloat(thresholdInput.value) / 100.0) : 0.45;
          const resp = await fetch('/api/identify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: frameBase64, threshold })
          });

          const data = await resp.json();
          const elapsed = Math.round(performance.now() - startTime);

          if (statLatencyVal) {
            statLatencyVal.innerHTML = `${elapsed}<span class="stat-unit">ms</span>`;
          }

          if (resp.ok) {
            // Draw corner brackets & label HUD with horizontal mirror mapping
            scanCam.drawBoundingBoxes(data.faces, 400, 300, true);
            updateIdentityDisplay(data.faces);
          }
        } catch (err) {
          console.warn('Scan frame warning:', err);
        } finally {
          isScanning = false;
        }
      }
    }

    if (scanLoopActive && scanCam.isActive) {
      setTimeout(runScanFrame, 75);
    }
  }

  function updateIdentityDisplay(faces) {
    if (!faces || faces.length === 0) {
      if (matchBadge) {
        matchBadge.className = 'badge-status-pill unknown';
        matchBadge.textContent = 'Menunggu Wajah';
      }
      if (emptyResult) emptyResult.style.display = 'block';
      if (identityCard) identityCard.style.display = 'none';
      return;
    }

    const firstFace = faces[0];
    if (emptyResult) emptyResult.style.display = 'none';
    if (identityCard) identityCard.style.display = 'flex';

    if (firstFace.status === 'MATCH' && firstFace.person) {
      if (matchBadge) {
        matchBadge.className = 'badge-status-pill match';
        matchBadge.textContent = 'Teridentifikasi';
      }
      if (resName) resName.textContent = firstFace.person.name;
      if (resCode) resCode.textContent = `ID: ${firstFace.person.code}`;
      if (resDept) resDept.textContent = `Dept: ${firstFace.person.department || '-'}`;
      if (avatarLetter) avatarLetter.textContent = firstFace.person.name.charAt(0).toUpperCase();
      if (resScore) resScore.textContent = `${firstFace.score}%`;
      if (resProgress) {
        resProgress.style.width = `${Math.min(100, firstFace.score)}%`;
        resProgress.style.backgroundColor = '#10b981';
      }
    } else if (firstFace.status === 'AMBIGUOUS' && firstFace.person) {
      if (matchBadge) {
        matchBadge.className = 'badge-status-pill ambiguous';
        matchBadge.textContent = 'Mirip / Ambigu';
      }
      if (resName) resName.textContent = `${firstFace.person.name} (?)`;
      if (resCode) resCode.textContent = `ID: ${firstFace.person.code}`;
      if (resDept) resDept.textContent = `Dept: ${firstFace.person.department || '-'}`;
      if (avatarLetter) avatarLetter.textContent = firstFace.person.name.charAt(0).toUpperCase();
      if (resScore) resScore.textContent = `${firstFace.score}%`;
      if (resProgress) {
        resProgress.style.width = `${Math.min(100, firstFace.score)}%`;
        resProgress.style.backgroundColor = '#f59e0b';
      }
    } else {
      if (matchBadge) {
        matchBadge.className = 'badge-status-pill unknown';
        matchBadge.textContent = 'Tidak Dikenali';
      }
      if (resName) resName.textContent = 'Wajah Tidak Dikenali';
      if (resCode) resCode.textContent = 'ID: -';
      if (resDept) resDept.textContent = 'Belum Terdaftar';
      if (avatarLetter) avatarLetter.textContent = '?';
      if (resScore) resScore.textContent = `${firstFace.score}%`;
      if (resProgress) {
        resProgress.style.width = `${Math.min(100, firstFace.score)}%`;
        resProgress.style.backgroundColor = '#ef4444';
      }
    }
  }

  function resetIdentityResult() {
    if (matchBadge) {
      matchBadge.className = 'badge-status-pill unknown';
      matchBadge.textContent = 'Menunggu Wajah';
    }
    if (emptyResult) emptyResult.style.display = 'block';
    if (identityCard) identityCard.style.display = 'none';
    if (statLatencyVal) statLatencyVal.innerHTML = `&lt; 80<span class="stat-unit">ms</span>`;
  }

  // ---------------- SCANNER: PHOTO FILE TEST ----------------
  if (scanPhotoDropzone && scanPhotoInput) {
    scanPhotoDropzone.addEventListener('click', (e) => {
      if (e.target !== btnClearScanPhoto) scanPhotoInput.click();
    });

    scanPhotoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleScanPhotoFile(e.target.files[0]);
      }
    });
  }

  if (btnClearScanPhoto) {
    btnClearScanPhoto.addEventListener('click', (e) => {
      e.stopPropagation();
      if (scanPhotoInput) scanPhotoInput.value = '';
      if (scanPhotoPreview) scanPhotoPreview.src = '';
      if (scanPhotoPreviewWrap) scanPhotoPreviewWrap.style.display = 'none';
      if (scanDropPrompt) scanDropPrompt.style.display = 'flex';
      resetIdentityResult();
    });
  }

  async function handleScanPhotoFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (scanPhotoPreview) scanPhotoPreview.src = e.target.result;
      if (scanDropPrompt) scanDropPrompt.style.display = 'none';
      if (scanPhotoPreviewWrap) scanPhotoPreviewWrap.style.display = 'block';

      const formData = new FormData();
      formData.append('file', file);
      const threshVal = thresholdInput ? (parseFloat(thresholdInput.value) / 100.0).toString() : '0.45';
      formData.append('threshold', threshVal);

      if (scanLoader) scanLoader.style.display = 'flex';
      const startTime = performance.now();

      try {
        const resp = await fetch('/api/identify/photo', {
          method: 'POST',
          body: formData
        });
        const data = await resp.json();
        const elapsed = Math.round(performance.now() - startTime);
        if (statLatencyVal) statLatencyVal.innerHTML = `${elapsed}<span class="stat-unit">ms</span>`;

        if (resp.ok) {
          updateIdentityDisplay(data.faces);
          drawStaticCanvasBoxes(data.faces);
        } else {
          showToast(data.detail || 'Gagal memproses foto', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan koneksi', 'error');
      } finally {
        if (scanLoader) scanLoader.style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  }

  function drawStaticCanvasBoxes(faces) {
    if (!scanPhotoPreview || !scanPhotoCanvas) return;
    scanPhotoPreview.onload = () => {
      scanPhotoCanvas.width = scanPhotoPreview.clientWidth;
      scanPhotoCanvas.height = scanPhotoPreview.clientHeight;
      const ctx = scanPhotoCanvas.getContext('2d');
      ctx.clearRect(0, 0, scanPhotoCanvas.width, scanPhotoCanvas.height);

      if (!faces || faces.length === 0) return;

      const scaleX = scanPhotoCanvas.width / scanPhotoPreview.naturalWidth;
      const scaleY = scanPhotoCanvas.height / scanPhotoPreview.naturalHeight;

      faces.forEach(f => {
        const [x1, y1, x2, y2] = f.bbox;
        const color = f.status === 'MATCH' ? '#10b981' : (f.status === 'AMBIGUOUS' ? '#f59e0b' : '#ef4444');
        const rx1 = x1 * scaleX;
        const ry1 = y1 * scaleY;
        const rw = (x2 - x1) * scaleX;
        const rh = (y2 - y1) * scaleY;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx1, ry1, rw, rh);

        const label = f.person ? `${f.person.name} (${f.score}%)` : `Tidak Dikenali (${f.score}%)`;
        ctx.font = '600 12px Inter, sans-serif';
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(rx1, Math.max(0, ry1 - 22), tw + 12, 22);
        ctx.fillStyle = '#090d16';
        ctx.fillText(label, rx1 + 6, Math.max(0, ry1 - 22) + 15);
      });
    };
    if (scanPhotoPreview.complete) scanPhotoPreview.onload();
  }

  // ---------------- TAB 2: ENROLLMENT (UPLOAD) ----------------
  window.setEnrollMode = function(mode) {
    if (mode === 'single') {
      if (btnModeSinglePhoto) btnModeSinglePhoto.classList.add('active');
      if (btnModeWebcam) btnModeWebcam.classList.remove('active');
      if (methodSinglePhoto) methodSinglePhoto.style.display = 'block';
      if (methodWebcam) methodWebcam.style.display = 'none';
      if (singlePhotoSubmitWrap) singlePhotoSubmitWrap.style.display = 'block';
      stopEkycCamera();
    } else {
      if (btnModeWebcam) btnModeWebcam.classList.add('active');
      if (btnModeSinglePhoto) btnModeSinglePhoto.classList.remove('active');
      if (methodSinglePhoto) methodSinglePhoto.style.display = 'none';
      if (methodWebcam) methodWebcam.style.display = 'block';
      if (singlePhotoSubmitWrap) singlePhotoSubmitWrap.style.display = 'none';
      startEkycCamera();
    }
  };

  if (btnModeSinglePhoto && btnModeWebcam) {
    btnModeSinglePhoto.addEventListener('click', () => window.setEnrollMode('single'));
    btnModeWebcam.addEventListener('click', () => window.setEnrollMode('ekyc'));
  }

  if (enrollPhotoDropzone && enrollPhotoInput) {
    enrollPhotoDropzone.addEventListener('click', (e) => {
      if (e.target !== btnClearEnrollPhoto) enrollPhotoInput.click();
    });

    enrollPhotoInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        selectedEnrollFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (enrollPhotoPreview) enrollPhotoPreview.src = ev.target.result;
          if (enrollDropPrompt) enrollDropPrompt.style.display = 'none';
          if (enrollPreviewWrap) enrollPreviewWrap.style.display = 'block';
        };
        reader.readAsDataURL(selectedEnrollFile);
      }
    });
  }

  if (btnClearEnrollPhoto) {
    btnClearEnrollPhoto.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedEnrollFile = null;
      if (enrollPhotoInput) enrollPhotoInput.value = '';
      if (enrollPhotoPreview) enrollPhotoPreview.src = '';
      if (enrollDropPrompt) enrollDropPrompt.style.display = 'flex';
      if (enrollPreviewWrap) enrollPreviewWrap.style.display = 'none';
    });
  }

  if (btnSubmitPhotoEnroll) {
    btnSubmitPhotoEnroll.addEventListener('click', async () => {
      const name = enrollName ? enrollName.value.trim() : '';
      const code = enrollCode ? enrollCode.value.trim() : '';
      const dept = enrollDept ? enrollDept.value.trim() : '';

      if (!name || !code) {
        showToast('Harap isi Nama Lengkap dan NIK/Kode Identitas.', 'error');
        return;
      }
      if (!selectedEnrollFile) {
        showToast('Pilih 1 foto wajah terlebih dahulu.', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('name', name);
      formData.append('code', code);
      formData.append('department', dept);
      formData.append('file', selectedEnrollFile);

      btnSubmitPhotoEnroll.disabled = true;
      btnSubmitPhotoEnroll.textContent = 'Menyimpan Vektor Wajah...';

      try {
        const resp = await fetch('/api/register/photo', {
          method: 'POST',
          body: formData
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
          showToast(`Berhasil! Wajah ${name} telah didaftarkan.`, 'success');
          if (enrollName) enrollName.value = '';
          if (enrollCode) enrollCode.value = '';
          if (enrollDept) enrollDept.value = '';
          if (btnClearEnrollPhoto) btnClearEnrollPhoto.click();
          loadPeopleDatabase();
        } else {
          showToast(data.detail || 'Gagal mendaftarkan wajah.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      } finally {
        btnSubmitPhotoEnroll.disabled = false;
        btnSubmitPhotoEnroll.textContent = 'Daftarkan Wajah Sekarang';
      }
    });
  }

  // ---------------- ENROLLMENT: e-KYC INTERACTIVE FLOW (ZERO EMOJIS) ----------------
  async function startEkycCamera() {
    try {
      await ekycCam.start();
      resetEkycFlow();
      ekycIntervalId = setInterval(runEkycLoop, 350);
    } catch (err) {
      showToast('Gagal mengakses kamera e-KYC.', 'error');
    }
  }

  function stopEkycCamera() {
    if (ekycIntervalId) {
      clearInterval(ekycIntervalId);
      ekycIntervalId = null;
    }
    ekycCam.stop();
  }

  function resetEkycFlow() {
    ekycStep = 0;
    ekycImages = {};
    blinkDetected = false;
    if (checkFront) checkFront.textContent = '○';
    if (checkBlink) checkBlink.textContent = '○';
    if (checkLeft) checkLeft.textContent = '○';
    if (checkRight) checkRight.textContent = '○';

    [stepFront, stepBlink, stepLeft, stepRight].forEach(s => {
      if (s) s.classList.remove('active', 'completed');
    });
    if (stepFront) stepFront.classList.add('active');

    if (ekycInstruction) ekycInstruction.textContent = 'Tatap lurus ke kamera di dalam oval';
    if (ekycStepDesc) ekycStepDesc.textContent = 'Tahap 1: Tatap lurus ke kamera di dalam oval guide.';
    if (ekycStepCounter) ekycStepCounter.textContent = 'Langkah 1 / 4';
    if (ovalGuide) ovalGuide.className = 'minimal-oval';
    if (btnFinishEkyc) btnFinishEkyc.disabled = true;
  }

  if (btnRestartEkyc) {
    btnRestartEkyc.addEventListener('click', resetEkycFlow);
  }

  async function runEkycLoop() {
    if (!ekycCam.isActive || ekycStep >= 4) return;
    const frame = ekycCam.captureFrame(400, 0.8);
    if (!frame) return;

    try {
      const resp = await fetch('/api/quality-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: frame })
      });
      const data = await resp.json();
      if (!resp.ok) return;

      const q = data.quality || {};
      const l = data.liveness || {};

      if (!q.is_ok) {
        if (ovalGuide) ovalGuide.className = 'minimal-oval guide-invalid';
        if (ekycInstruction) ekycInstruction.textContent = q.message || 'Posisikan wajah di dalam oval';
        return;
      }

      if (ovalGuide) ovalGuide.className = 'minimal-oval guide-valid';

      if (ekycStep === 0) {
        if (l.pose === 'FRONT') {
          ekycImages['front'] = frame;
          if (checkFront) checkFront.textContent = '✓';
          if (stepFront) stepFront.classList.replace('active', 'completed');
          if (stepBlink) stepBlink.classList.add('active');
          ekycStep = 1;
          if (ekycInstruction) ekycInstruction.textContent = 'Silakan kedipkan mata Anda';
          if (ekycStepDesc) ekycStepDesc.textContent = 'Tahap 2: Kedipkan mata untuk liveness anti-spoofing.';
          if (ekycStepCounter) ekycStepCounter.textContent = 'Langkah 2 / 4';
        } else {
          if (ekycInstruction) ekycInstruction.textContent = 'Harap tatap lurus ke depan';
        }
      } else if (ekycStep === 1) {
        if (l.blink) {
          blinkDetected = true;
        } else if (blinkDetected && !l.blink) {
          if (checkBlink) checkBlink.textContent = '✓';
          if (stepBlink) stepBlink.classList.replace('active', 'completed');
          if (stepLeft) stepLeft.classList.add('active');
          ekycStep = 2;
          if (ekycInstruction) ekycInstruction.textContent = 'Menoleh ke KIRI perlahan (~15°)';
          if (ekycStepDesc) ekycStepDesc.textContent = 'Tahap 3: Tengok kepala ke arah kiri.';
          if (ekycStepCounter) ekycStepCounter.textContent = 'Langkah 3 / 4';
        }
      } else if (ekycStep === 2) {
        if (l.pose === 'LEFT') {
          ekycImages['left'] = frame;
          if (checkLeft) checkLeft.textContent = '✓';
          if (stepLeft) stepLeft.classList.replace('active', 'completed');
          if (stepRight) stepRight.classList.add('active');
          ekycStep = 3;
          if (ekycInstruction) ekycInstruction.textContent = 'Menoleh ke KANAN perlahan (~15°)';
          if (ekycStepDesc) ekycStepDesc.textContent = 'Tahap 4: Tengok kepala ke arah kanan.';
          if (ekycStepCounter) ekycStepCounter.textContent = 'Langkah 4 / 4';
        }
      } else if (ekycStep === 3) {
        if (l.pose === 'RIGHT') {
          ekycImages['right'] = frame;
          if (checkRight) checkRight.textContent = '✓';
          if (stepRight) stepRight.classList.replace('active', 'completed');
          ekycStep = 4;
          if (ekycInstruction) ekycInstruction.textContent = 'Semua pose lengkap!';
          if (ekycStepDesc) ekycStepDesc.textContent = 'Pengambilan 3 sudut selesai. Klik simpan pendaftaran.';
          if (ekycStepCounter) ekycStepCounter.textContent = 'Selesai (4/4)';
          if (btnFinishEkyc) btnFinishEkyc.disabled = false;
        }
      }
    } catch (err) {
      console.warn('e-KYC loop warning:', err);
    }
  }

  if (btnFinishEkyc) {
    btnFinishEkyc.addEventListener('click', async () => {
      const name = enrollName ? enrollName.value.trim() : '';
      const code = enrollCode ? enrollCode.value.trim() : '';
      const dept = enrollDept ? enrollDept.value.trim() : '';

      if (!name || !code) {
        showToast('Harap isi Nama Lengkap dan NIK/Kode Identitas.', 'error');
        return;
      }

      btnFinishEkyc.disabled = true;
      btnFinishEkyc.textContent = 'Menyimpan...';

      try {
        const resp = await fetch('/api/register/webcam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, code, department: dept,
            poses: ekycImages
          })
        });
        const data = await resp.json();

        if (resp.ok && data.success) {
          showToast(`Berhasil! Wajah ${name} telah didaftarkan dengan 3 sudut.`, 'success');
          if (enrollName) enrollName.value = '';
          if (enrollCode) enrollCode.value = '';
          if (enrollDept) enrollDept.value = '';
          resetEkycFlow();
          loadPeopleDatabase();
        } else {
          showToast(data.detail || 'Gagal mendaftar via webcam.', 'error');
        }
      } catch (err) {
        showToast('Terjadi kesalahan jaringan.', 'error');
      } finally {
        btnFinishEkyc.disabled = false;
        btnFinishEkyc.textContent = 'Simpan Pendaftaran (3 Pose)';
      }
    });
  }

  // ---------------- TAB 3: DATABASE DIRECTORY ----------------
  async function loadPeopleDatabase() {
    if (!dbTableBody) return;
    try {
      const resp = await fetch('/api/people');
      const data = await resp.json();
      const people = data.people || [];

      if (statTotalScanned) {
        statTotalScanned.innerHTML = `${people.length}<span class="stat-unit"> orang</span>`;
      }

      if (people.length === 0) {
        dbTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Belum ada identitas terdaftar. Silakan daftarkan di tab Face Upload.</td></tr>`;
        return;
      }

      renderPeopleTable(people);
    } catch (err) {
      dbTableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Gagal memuat database.</td></tr>`;
    }
  }

  function renderPeopleTable(people) {
    if (!dbTableBody) return;
    dbTableBody.innerHTML = people.map(p => `
      <tr>
        <td style="font-family: var(--font-mono); color: var(--text-dim);">${p.id}</td>
        <td><strong style="color: #60a5fa; font-family: var(--font-mono);">${p.code}</strong></td>
        <td><strong style="color: var(--text-pure);">${p.name}</strong></td>
        <td style="color: var(--text-muted);">${p.department || '-'}</td>
        <td><span class="badge-vector">${p.sample_count} Sampel</span></td>
        <td style="color: var(--text-dim); font-family: var(--font-mono); font-size: 12px;">${p.created_at || '-'}</td>
        <td>
          <button class="btn-delete-ghost" onclick="window.handleDeletePerson(${p.id}, '${p.name}')">
            Hapus
          </button>
        </td>
      </tr>
    `).join('');
  }

  window.handleDeletePerson = async (id, name) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data wajah ${name}?`)) return;
    try {
      const resp = await fetch(`/api/people/${id}`, { method: 'DELETE' });
      if (resp.ok) {
        showToast(`Data ${name} berhasil dihapus.`, 'info');
        loadPeopleDatabase();
      } else {
        showToast('Gagal menghapus data.', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan jaringan.', 'error');
    }
  };

  if (btnRefreshDb) {
    btnRefreshDb.addEventListener('click', loadPeopleDatabase);
  }

  if (dbSearchInput && dbTableBody) {
    dbSearchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const rows = dbTableBody.querySelectorAll('tr');
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }

  // Initial database pre-fetch
  loadPeopleDatabase();
});
