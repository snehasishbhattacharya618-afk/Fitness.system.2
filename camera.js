// ============================================================
// THE FORGE — camera rep-counting module
// Uses MediaPipe Pose for full-body joint tracking.
// Lessons applied from earlier hand-tracking debugging:
//  - single getUserMedia call, no MediaPipe Camera utility (avoids double-request NotReadableError)
//  - origin/protocol check before attempting camera access
//  - constraint fallback chain for cross-device reliability
//  - visible debug log, no dev tools required
// ============================================================

let pose = null;
let poseTrackingActive = false;
let poseStartInProgress = false;
let cameraCurrentStream = null;
let cameraFacingMode = 'user';
let repCount = 0;
let repState = 'up'; // tracks whether we're in the 'up' or 'down' phase of a rep
let currentExerciseType = 'pushups';
let camFrameCount = 0;
let camResultCount = 0;

let camDebugLines = [];
function camLog(msg) {
  const time = new Date().toISOString().substr(11, 8);
  camDebugLines.push('[' + time + '] ' + msg);
  if (camDebugLines.length > 60) camDebugLines.shift();
  const el = document.getElementById('camera-debug-log');
  if (el) {
    el.textContent = camDebugLines.join('\n');
    el.scrollTop = el.scrollHeight;
  }
}

function toggleCameraDebugLog() {
  const el = document.getElementById('camera-debug-log');
  const btn = document.getElementById('camera-debug-toggle');
  el.classList.toggle('hidden');
  btn.textContent = el.classList.contains('hidden') ? 'SHOW DEBUG LOG' : 'HIDE DEBUG LOG';
}

// ---------- Pose landmark indices (MediaPipe Pose) ----------
const LM = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_HIP: 23, RIGHT_HIP: 24,
  LEFT_KNEE: 25, RIGHT_KNEE: 26,
  LEFT_ANKLE: 27, RIGHT_ANKLE: 28
};

function angleBetween(a, b, c) {
  // angle at point b, formed by points a-b-c, in degrees
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  if (magAB === 0 || magCB === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.acos(cos) * (180 / Math.PI);
}

// ---------- Exercise-specific rep detection ----------
// Each exercise tracks a primary joint angle and fires a rep when it cycles
// through the full down->up range. Thresholds are deliberately generous
// since consumer camera pose estimation is noisy.
const EXERCISE_CONFIG = {
  pushups: {
    label: 'PUSH-UPS',
    getAngle: (lm) => {
      const l = angleBetween(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_ELBOW], lm[LM.LEFT_WRIST]);
      const r = angleBetween(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_ELBOW], lm[LM.RIGHT_WRIST]);
      return (l + r) / 2;
    },
    downThreshold: 95,  // elbow bent
    upThreshold: 150,   // elbow extended
    joints: [LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP]
  },
  situps: {
    label: 'SIT-UPS',
    getAngle: (lm) => {
      const l = angleBetween(lm[LM.LEFT_SHOULDER], lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE]);
      const r = angleBetween(lm[LM.RIGHT_SHOULDER], lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE]);
      return (l + r) / 2;
    },
    downThreshold: 70,   // torso curled up toward knees
    upThreshold: 130,    // torso back down/reclined
    joints: [LM.LEFT_SHOULDER, LM.LEFT_HIP, LM.LEFT_KNEE, LM.RIGHT_SHOULDER, LM.RIGHT_HIP, LM.RIGHT_KNEE]
  },
  squats: {
    label: 'SQUATS',
    getAngle: (lm) => {
      const l = angleBetween(lm[LM.LEFT_HIP], lm[LM.LEFT_KNEE], lm[LM.LEFT_ANKLE]);
      const r = angleBetween(lm[LM.RIGHT_HIP], lm[LM.RIGHT_KNEE], lm[LM.RIGHT_ANKLE]);
      return (l + r) / 2;
    },
    downThreshold: 100,  // knees bent (squatting)
    upThreshold: 160,    // standing straight
    joints: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
  }
};

const POSE_CONNECTIONS = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW], [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW], [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP], [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.LEFT_KNEE], [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE], [LM.RIGHT_KNEE, LM.RIGHT_ANKLE]
];

// ---------- Initialize MediaPipe Pose (once) ----------
function initPoseModel() {
  if (pose) return;
  camLog('Constructing Pose model...');
  try {
    pose = new Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5
    });
    pose.onResults(onPoseResults);
    camLog('Pose model constructed and configured OK.');
  } catch (err) {
    camLog('ERROR constructing Pose model: ' + err.message);
    pose = null;
  }
}

function onPoseResults(results) {
  camResultCount++;
  const canvas = document.getElementById('camera-overlay');
  const video = document.getElementById('camera-video');
  if (!canvas || !video) return;

  if (canvas.width !== video.videoWidth && video.videoWidth) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const statusEl = document.getElementById('camera-status');

  if (results.poseLandmarks) {
    const config = EXERCISE_CONFIG[currentExerciseType];
    const lm = results.poseLandmarks;

    // quality check: are the joints we need actually visible/confident?
    const visibilities = config.joints.map(i => lm[i].visibility || 0);
    const avgVisibility = visibilities.reduce((a, b) => a + b, 0) / visibilities.length;
    const goodQuality = avgVisibility > 0.5;

    const color = goodQuality ? '#6bd68a' : '#ff8a8a';

    // draw skeleton
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.fillStyle = color;
    POSE_CONNECTIONS.forEach(([a, b]) => {
      if (lm[a] && lm[b]) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * canvas.width, lm[a].y * canvas.height);
        ctx.lineTo(lm[b].x * canvas.width, lm[b].y * canvas.height);
        ctx.stroke();
      }
    });
    config.joints.forEach(i => {
      if (lm[i]) {
        ctx.beginPath();
        ctx.arc(lm[i].x * canvas.width, lm[i].y * canvas.height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    if (goodQuality) {
      const angle = config.getAngle(lm);

      if (repState === 'up' && angle < config.downThreshold) {
        repState = 'down';
      } else if (repState === 'down' && angle > config.upThreshold) {
        repState = 'up';
        repCount++;
        document.getElementById('camera-rep-count').textContent = repCount;
        if (navigator.vibrate) navigator.vibrate(60);
      }
      statusEl.textContent = 'Tracking well. Keep going!';
    } else {
      statusEl.textContent = 'Can\'t see all key joints clearly. Adjust phone position or lighting.';
    }
  } else {
    statusEl.textContent = 'No person detected. Make sure your full body is in frame.';
  }
}

// ---------- Camera acquisition with fallback chain ----------
async function getCamStream(facing) {
  const attempts = [
    { video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } } },
    { video: { facingMode: facing } },
    { video: true }
  ];
  for (let i = 0; i < attempts.length; i++) {
    try {
      camLog('Trying camera constraint #' + (i + 1) + ': ' + JSON.stringify(attempts[i]));
      const stream = await navigator.mediaDevices.getUserMedia(attempts[i]);
      camLog('Constraint #' + (i + 1) + ' succeeded.');
      return stream;
    } catch (err) {
      camLog('Constraint #' + (i + 1) + ' failed: ' + err.name + ' - ' + err.message);
      if (i === attempts.length - 1) throw err;
    }
  }
}

// ---------- Launch / stop tracking ----------
function launchCameraTracking(exerciseType) {
  currentExerciseType = exerciseType;
  repCount = 0;
  repState = 'up';
  camFrameCount = 0;
  camResultCount = 0;
  camDebugLines = [];

  document.getElementById('camera-tracking-title').textContent = EXERCISE_CONFIG[exerciseType].label;
  document.getElementById('camera-rep-count').textContent = '0';

  openPanel('panel-camera-tracking');
  initPoseModel();
  startPoseCamera();
}

async function startPoseCamera() {
  if (poseStartInProgress) {
    camLog('startPoseCamera called while already in progress — ignoring.');
    return;
  }

  const badOrigin = window.location.protocol !== 'https:' && window.location.hostname !== 'localhost';
  const warningEl = document.getElementById('camera-origin-warning');
  if (badOrigin) {
    warningEl.classList.remove('hidden');
    document.getElementById('camera-status').textContent = 'Cannot access camera from this page (see warning above).';
    camLog('WARNING: non-https origin detected (' + window.location.protocol + '). Camera will likely fail.');
    return;
  } else {
    warningEl.classList.add('hidden');
  }

  if (!pose) {
    camLog('ERROR: Pose model not constructed. Cannot start tracking.');
    document.getElementById('camera-status').textContent = 'Tracking model failed to load. Check debug log.';
    return;
  }

  poseStartInProgress = true;
  document.getElementById('camera-status').textContent = 'Requesting camera access...';
  camLog('Requesting camera (' + cameraFacingMode + ')...');

  try {
    const stream = await getCamStream(cameraFacingMode);
    cameraCurrentStream = stream;
    const video = document.getElementById('camera-video');
    video.srcObject = stream;

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      setTimeout(() => reject(new Error('Video metadata load timed out')), 8000);
    });
    camLog('Video metadata loaded: ' + video.videoWidth + 'x' + video.videoHeight);

    try {
      await video.play();
    } catch (playErr) {
      camLog('video.play() rejected (non-fatal): ' + playErr.message);
    }

    const canvas = document.getElementById('camera-overlay');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    poseTrackingActive = true;
    poseStartInProgress = false;
    document.getElementById('camera-status').textContent = 'Tracking started. Make sure your full body is visible.';

    async function frameLoop() {
      if (!poseTrackingActive) return;
      camFrameCount++;
      if (camFrameCount === 1) camLog('First frame captured, sending to Pose model...');
      try {
        await pose.send({ image: video });
      } catch (sendErr) {
        camLog('ERROR in pose.send(): ' + sendErr.message);
      }
      if (poseTrackingActive) requestAnimationFrame(frameLoop);
    }
    requestAnimationFrame(frameLoop);

    setTimeout(() => {
      if (camResultCount === 0 && poseTrackingActive) {
        camLog('WARNING: 6s passed, frames sent: ' + camFrameCount + ', zero results. Model may have failed on this device.');
        document.getElementById('camera-status').textContent = 'Tracking not responding. See debug log, or try switching browsers.';
      }
    }, 6000);

  } catch (err) {
    poseStartInProgress = false;
    camLog('CAMERA ERROR: ' + err.name + ' - ' + err.message);
    let msg = 'Camera access failed: ' + err.message;
    if (err.name === 'NotAllowedError') msg = 'Camera permission denied. Check site settings and try again.';
    else if (err.name === 'NotReadableError') msg = 'Camera is busy or in use by another app. Close other camera apps and retry.';
    else if (err.name === 'NotFoundError') msg = 'No camera found on this device.';
    document.getElementById('camera-status').textContent = msg;
  }
}

function stopCameraStream() {
  poseTrackingActive = false;
  if (cameraCurrentStream) {
    cameraCurrentStream.getTracks().forEach(t => t.stop());
    cameraCurrentStream = null;
    camLog('Camera stream stopped.');
  }
}

function switchCameraFacing() {
  cameraFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
  camLog('Switching camera to: ' + cameraFacingMode);
  stopCameraStream();
  document.getElementById('camera-status').textContent = 'Switching camera...';
  setTimeout(() => startPoseCamera(), 300);
}

function stopCameraTracking() {
  stopCameraStream();
  closeAllPanels();
}

function finishCameraTracking() {
  const finalReps = repCount;
  stopCameraStream();
  closeAllPanels();

  if (finalReps > 0) {
    const xpEarned = Math.min(60, 20 + Math.round(finalReps / 2));
    addXP(xpEarned);
    updateStreakOnCompletion();
    state.history.push({
      date: todayStr(),
      type: currentExerciseType,
      amount: finalReps + ' reps (camera)',
      xpEarned
    });
    saveState();
    renderHome();

    pendingFeedbackType = currentExerciseType;
    openPanel('panel-quest-feedback');
  }
}

// ============================================================
// GPS WORKOUT MODE
// ============================================================
let gpsWatchId = null;
let gpsActive = false;
let gpsPositions = [];
let gpsTotalDistanceKm = 0;
let gpsStartTime = null;
let gpsTimerInterval = null;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function startGPSWorkout() {
  if (!navigator.geolocation) {
    document.getElementById('gps-status').textContent = 'GPS is not available on this device/browser.';
    return;
  }

  gpsPositions = [];
  gpsTotalDistanceKm = 0;
  gpsStartTime = Date.now();
  gpsActive = true;

  document.getElementById('gps-distance').textContent = '0.00';
  document.getElementById('gps-duration').textContent = '00:00';
  document.getElementById('gps-status').textContent = 'Acquiring GPS signal...';
  document.getElementById('gps-start-btn').classList.add('hidden');
  document.getElementById('gps-stop-btn').classList.remove('hidden');

  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      if (gpsPositions.length > 0) {
        const last = gpsPositions[gpsPositions.length - 1];
        const segment = haversineKm(last.lat, last.lon, latitude, longitude);
        // ignore GPS jitter: only count segments that reflect real movement
        if (segment > 0.002 && segment < 0.3) {
          gpsTotalDistanceKm += segment;
        }
      }
      gpsPositions.push({ lat: latitude, lon: longitude });
      document.getElementById('gps-distance').textContent = gpsTotalDistanceKm.toFixed(2);
      document.getElementById('gps-status').textContent = 'Tracking your route live.';
    },
    (err) => {
      let msg = 'GPS error: ' + err.message;
      if (err.code === err.PERMISSION_DENIED) msg = 'Location permission denied. Check site settings.';
      document.getElementById('gps-status').textContent = msg;
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );

  gpsTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - gpsStartTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    document.getElementById('gps-duration').textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  }, 1000);
}

function stopGPSTracking() {
  gpsActive = false;
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (gpsTimerInterval) {
    clearInterval(gpsTimerInterval);
    gpsTimerInterval = null;
  }
}

function stopGPSWorkout() {
  stopGPSTracking();
  closeAllPanels();
  document.getElementById('gps-start-btn').classList.remove('hidden');
  document.getElementById('gps-stop-btn').classList.add('hidden');
}

function finishGPSWorkout() {
  const finalDistance = gpsTotalDistanceKm;
  const elapsedSec = gpsStartTime ? Math.floor((Date.now() - gpsStartTime) / 1000) : 0;
  stopGPSTracking();
  closeAllPanels();
  document.getElementById('gps-start-btn').classList.remove('hidden');
  document.getElementById('gps-stop-btn').classList.add('hidden');

  if (finalDistance > 0.01) {
    const xpEarned = Math.min(80, 20 + Math.round(finalDistance * 15));
    addXP(xpEarned);
    updateStreakOnCompletion();
    state.history.push({
      date: todayStr(),
      type: 'run',
      amount: finalDistance.toFixed(2) + ' km in ' + Math.floor(elapsedSec/60) + 'm ' + (elapsedSec%60) + 's',
      xpEarned
    });
    saveState();
    renderHome();

    pendingFeedbackType = 'run';
    openPanel('panel-quest-feedback');
  }
}
