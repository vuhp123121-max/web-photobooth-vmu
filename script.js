// ===== Elements =====
const screens = {
  home: document.getElementById("screen-home"),
  capture: document.getElementById("screen-capture"),
  downloading: document.getElementById("screen-downloading"),
  done: document.getElementById("screen-done"),
};

const btnStart = document.getElementById("btnStart");
const btnCapture = document.getElementById("btnCapture");
const btnDownload = document.getElementById("btnDownload");
const btnRetake = document.getElementById("btnRetake");
const btnPrevTpl = document.getElementById("btnPrevTpl");
const btnNextTpl = document.getElementById("btnNextTpl");
const btnHome = document.getElementById("btnHome");

const video = document.getElementById("video");
const countdownEl = document.getElementById("countdown");

const stripPreview = document.getElementById("stripPreview");
const stripOut = document.getElementById("stripOut");
const stripFinal = document.getElementById("stripFinal");
const printSound = document.getElementById("printSound");
const shutterSound = document.getElementById("shutterSound");

const canvas = document.getElementById("canvas");

const CLOUD_NAME = "dqbi4wztz";
const UPLOAD_PRESET = "photobooth";

async function uploadToCloudinary(dataUrl) {
  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const data = await res.json();
  return data.secure_url;
}

async function generateQR(url) {
  const canvasQR = document.getElementById("qrCanvas");
  await QRCode.toCanvas(canvasQR, url);
}

// ===== Config =====
const TEMPLATES_STRIP = [
  "assets/2_2.png",
  "assets/anh4_demo.png",
  "assets/anh5new2.png",
  "assets/dacoten.png",
];
const TEMPLATES_CIRCLE = [
  "assets/template4.png",
  "assets/template5.png", // 👉 ảnh bạn vừa thêm
];

// ===== Layout Mode =====
let layoutMode = "strip"; // "strip" | "circle"

let templateIndex = 0;

const PREVIEW_SIZES = {
  strip: { width: 300, height: 900 },
  circle: { width: 800, height: 800 },
};

const EXPORT_MIN_SCALE = {
  strip: 4,
  circle: 2048 / 800,
};

const STRIP_LAYOUT = {
  photoWidth: 270,
  photoHeight: 202.5,
  slots: [
    { x: 15, y: 199 },
    { x: 15, y: 408 },
    { x: 15, y: 617 },
  ],
};

const CIRCLE_LAYOUT = {
  radius: 320,
  zoom: 1.4,
};

const COUNTDOWN_SEC = 5;

// ===== State =====
let stream = null;
let templateImg = null;
let photos = [null, null, null];
let isBusy = false;

const flash = document.getElementById("flash");

function triggerFlash() {
  flash.classList.add("active");
  setTimeout(() => flash.classList.remove("active"), 400);
}

// ===== Utils =====
function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.toggle("hidden", key !== name);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function playSound(audioEl) {
  if (!audioEl) return;
  audioEl.currentTime = 0;
  audioEl.play().catch(() => {});
}

async function loadTemplate() {
  templateImg = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Load template lỗi"));
    const list = layoutMode === "strip" ? TEMPLATES_STRIP : TEMPLATES_CIRCLE;
    img.src = list[templateIndex] || list[0];
  });
}

// ===== Camera =====
function getCameraLabelScore(label = "") {
  const normalized = label.toLowerCase();
  let score = 0;

  if (normalized.includes("usb")) score += 4;
  if (normalized.includes("logitech")) score += 4;
  if (normalized.includes("obs")) score += 3;
  if (normalized.includes("webcam")) score += 2;
  if (normalized.includes("integrated")) score -= 1;

  return score;
}

function sortCameras(cams = []) {
  return [...cams].sort((a, b) => {
    const scoreDiff =
      getCameraLabelScore(b.label) - getCameraLabelScore(a.label);
    if (scoreDiff !== 0) return scoreDiff;
    return (a.label || "").localeCompare(b.label || "");
  });
}

function createVideoConstraintList(deviceId) {
  const basePresets = [
    {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      aspectRatio: { ideal: 4 / 3 },
      frameRate: { ideal: 30, max: 30 },
    },
    {
      width: { ideal: 2560 },
      height: { ideal: 1440 },
      aspectRatio: { ideal: 4 / 3 },
      frameRate: { ideal: 30, max: 30 },
    },
    {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      aspectRatio: { ideal: 4 / 3 },
    },
    {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      aspectRatio: { ideal: 4 / 3 },
    },
    { aspectRatio: { ideal: 4 / 3 } },
    true,
  ];

  return basePresets.map((preset) => {
    if (preset === true) {
      return deviceId ? { deviceId: { exact: deviceId } } : true;
    }

    return deviceId ? { ...preset, deviceId: { exact: deviceId } } : preset;
  });
}

async function openCameraWithFallback(cams = []) {
  const prioritizedCams = sortCameras(cams);
  const candidateDeviceIds = prioritizedCams
    .map((cam) => cam.deviceId)
    .filter(Boolean);
  const tried = [];

  const constraintSets = [
    ...candidateDeviceIds.flatMap((deviceId) =>
      createVideoConstraintList(deviceId),
    ),
    ...createVideoConstraintList(undefined),
    { facingMode: "user" },
    { facingMode: "environment" },
    true,
  ];

  for (const videoConstraints of constraintSets) {
    const key = JSON.stringify(videoConstraints);
    if (tried.includes(key)) continue;
    tried.push(key);

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });
    } catch (error) {
      console.warn(
        "Camera fallback failed:",
        videoConstraints,
        error?.name || error,
      );
    }
  }

  throw new Error("Không tìm thấy cấu hình camera phù hợp");
}

async function attachStream(targetStream) {
  video.srcObject = targetStream;

  await new Promise((resolve) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }

    video.onloadedmetadata = () => resolve();
  });

  await video.play();
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Trình duyệt không hỗ trợ camera");
    }

    if (!window.isSecureContext) {
      throw new Error("Camera chỉ hoạt động trên HTTPS hoặc localhost");
    }

    stopCamera();

    // Xin quyền trước để đọc được label thiết bị.
    const permissionStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");

    console.log("CAM:", cams);

    if (!cams.length) {
      stream = permissionStream;
      await attachStream(stream);
      return;
    }

    permissionStream.getTracks().forEach((track) => track.stop());
    stream = await openCameraWithFallback(cams);
    await attachStream(stream);
  } catch (err) {
    console.error("Lỗi camera:", err);
    alert(err?.message || "Không mở được camera");
  }
}

function stopCamera() {
  if (video.srcObject) {
    const activeStream = video.srcObject;
    if (typeof activeStream.getTracks === "function") {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
  }

  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  stream = null;
}

// ===== Countdown =====
async function runCountdown() {
  countdownEl.classList.remove("hidden");
  for (let i = COUNTDOWN_SEC; i > 0; i--) {
    countdownEl.textContent = i;
    await sleep(1000);
  }
  countdownEl.classList.add("hidden");
}

// ===== Capture =====
async function captureFrame() {
  const temp = document.createElement("canvas");
  temp.width = video.videoWidth;
  temp.height = video.videoHeight;
  const tctx = temp.getContext("2d");

  tctx.translate(temp.width, 0);
  tctx.scale(-1, 1);
  tctx.drawImage(video, 0, 0);

  return await createImageBitmap(temp);
}

// ===== Auto Capture =====
async function autoCaptureSequence() {
  if (isBusy) return;

  isBusy = true;
  btnCapture.disabled = true;

  try {
    if (layoutMode === "strip") {
      // 👉 chụp 3 ảnh
      for (let i = 0; i < 3; i++) {
        await runCountdown();
        triggerFlash();
        const photo = await captureFrame();
        photos[i] = photo;

        drawStripPreview();
        playSound(shutterSound);
        await sleep(500);
      }
    } else {
      // 👉 chụp 1 ảnh (frame tròn)
      await runCountdown();
      triggerFlash();
      const photo = await captureFrame();
      photos = [photo]; // 🔥 chỉ 1 ảnh

      drawStripPreview();
      playSound(shutterSound);
    }
  } catch (e) {
    alert("Lỗi chụp ảnh");
  }

  isBusy = false;
  btnCapture.disabled = false;
  updateUI();
}

// ===== Draw =====
function drawImageCover(targetCtx, img, x, y, w, h) {
  const ratio = img.width / img.height;
  const targetRatio = w / h;

  let drawW, drawH, dx, dy;

  if (ratio > targetRatio) {
    drawH = h;
    drawW = h * ratio;
    dx = x - (drawW - w) / 2;
    dy = y;
  } else {
    drawW = w;
    drawH = w / ratio;
    dx = x;
    dy = y - (drawH - h) / 2;
  }

  targetCtx.drawImage(img, dx, dy, drawW, drawH);
}

function getLayoutBaseSize(mode = layoutMode) {
  return PREVIEW_SIZES[mode];
}

function getTemplateScale(mode = layoutMode) {
  const baseSize = getLayoutBaseSize(mode);
  const naturalWidth =
    templateImg?.naturalWidth || templateImg?.width || baseSize.width;
  const naturalHeight =
    templateImg?.naturalHeight || templateImg?.height || baseSize.height;

  return Math.max(
    naturalWidth / baseSize.width,
    naturalHeight / baseSize.height,
  );
}

function getRenderScale(mode = layoutMode, quality = "preview") {
  if (quality === "preview") return 1;
  return Math.max(getTemplateScale(mode), EXPORT_MIN_SCALE[mode] || 1);
}

function getRenderSize(mode = layoutMode, quality = "preview") {
  const baseSize = getLayoutBaseSize(mode);
  const scale = getRenderScale(mode, quality);

  return {
    width: Math.round(baseSize.width * scale),
    height: Math.round(baseSize.height * scale),
    scale,
  };
}

function setupRenderCanvas(
  targetCanvas,
  mode = layoutMode,
  quality = "preview",
) {
  const { width, height, scale } = getRenderSize(mode, quality);
  targetCanvas.width = width;
  targetCanvas.height = height;

  const targetCtx = targetCanvas.getContext("2d");
  targetCtx.clearRect(0, 0, width, height);
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.imageSmoothingQuality = "high";

  return { targetCtx, width, height, scale };
}

function renderStrip(targetCtx, width, height, scale) {
  for (let i = 0; i < 3; i++) {
    if (!photos[i]) continue;

    const { x, y } = STRIP_LAYOUT.slots[i];
    drawImageCover(
      targetCtx,
      photos[i],
      x * scale,
      y * scale,
      STRIP_LAYOUT.photoWidth * scale,
      STRIP_LAYOUT.photoHeight * scale,
    );
  }

  if (templateImg) {
    targetCtx.drawImage(templateImg, 0, 0, width, height);
  }
}

function renderCircle(targetCtx, width, height, scale) {
  if (photos[0]) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = CIRCLE_LAYOUT.radius * scale;
    const zoom = CIRCLE_LAYOUT.zoom;

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.arc(cx, cy, radius, 0, Math.PI * 2);
    targetCtx.clip();

    drawImageCover(
      targetCtx,
      photos[0],
      cx - radius * zoom,
      cy - radius * zoom,
      radius * 2 * zoom,
      radius * 2 * zoom,
    );

    targetCtx.restore();
  }

  if (templateImg) {
    targetCtx.drawImage(templateImg, 0, 0, width, height);
  }
}

function renderComposite(targetCanvas, quality = "preview") {
  const { targetCtx, width, height, scale } = setupRenderCanvas(
    targetCanvas,
    layoutMode,
    quality,
  );

  if (layoutMode === "strip") {
    renderStrip(targetCtx, width, height, scale);
  } else {
    renderCircle(targetCtx, width, height, scale);
  }

  return targetCanvas;
}

function buildExportDataUrl() {
  const exportCanvas = document.createElement("canvas");
  renderComposite(exportCanvas, "export");
  return exportCanvas.toDataURL("image/png");
}

function drawStripPreview() {
  renderComposite(canvas, "preview");

  const url = canvas.toDataURL("image/png");
  stripPreview.src = url;
  return url;
}

// ===== UI =====
function updateUI() {
  const done = layoutMode === "strip" ? photos.every(Boolean) : photos[0];

  btnDownload.disabled = !done;

  // 👉 hiện retake khi đã chụp xong
  btnRetake.classList.toggle("hidden", !done);
}

// ===== EVENTS =====

// START
btnStart.addEventListener("click", async () => {
  showScreen("capture");

  try {
    await loadTemplate();
    await startCamera();

    drawStripPreview();
    updateUI();
  } catch (err) {
    alert("Không mở được camera");
  }
});

// CAPTURE
btnCapture.addEventListener("click", () => {
  autoCaptureSequence();
});

// RETAKE 🔥
btnRetake.addEventListener("click", () => {
  photos = [null, null, null];

  drawStripPreview();
  updateUI();
});

// TEMPLATE
btnPrevTpl.addEventListener("click", async () => {
  const list = layoutMode === "strip" ? TEMPLATES_STRIP : TEMPLATES_CIRCLE;

  templateIndex = (templateIndex - 1 + list.length) % list.length;

  await loadTemplate();
  drawStripPreview();
});

btnNextTpl.addEventListener("click", async () => {
  const list = layoutMode === "strip" ? TEMPLATES_STRIP : TEMPLATES_CIRCLE;

  templateIndex = (templateIndex + 1) % list.length;

  await loadTemplate();
  drawStripPreview();
});

// DOWNLOAD
btnDownload.addEventListener("click", async () => {
  drawStripPreview();
  const dataUrl = buildExportDataUrl();

  showScreen("downloading");

  stripOut.src = dataUrl;
  stripFinal.src = dataUrl;

  // 🔥 reset animation trước
  stripOut.classList.remove("play");
  void stripOut.offsetWidth; // trick để restart animation

  // 🔥 chạy animation in ảnh
  stripOut.classList.add("play");

  playSound(printSound);

  try {
    // 👉 upload lên cloud
    const cloudUrl = await uploadToCloudinary(dataUrl);

    console.log("Cloud URL:", cloudUrl);

    // 👉 ép tải khi mở link
    const downloadUrl = cloudUrl.replace("/upload/", "/upload/fl_attachment/");

    // 👉 tạo QR
    await generateQR(downloadUrl);
  } catch (e) {
    alert("Upload lỗi");
    console.error(e);
    return;
  }

  await sleep(2000);

  showScreen("done");
});

const btnLayout = document.getElementById("btnLayout");

btnLayout.addEventListener("click", async () => {
  // 🔥 bắt đầu animation OUT
  stripPreview.classList.add("changing");

  await sleep(200); // cho nó fade ra trước

  layoutMode = layoutMode === "strip" ? "circle" : "strip";
  templateIndex = 0;
  photos = layoutMode === "strip" ? [null, null, null] : [null];

  await loadTemplate();
  drawStripPreview();
  updateUI();

  // 🔥 animation IN
  stripPreview.classList.remove("changing");
});

// ===== HEART EFFECT (TRANG TRÍ) =====
function spawnHeart() {
  const container = document.getElementById("hearts");

  const heart = document.createElement("div");
  heart.className = "heart";

  // random icon 💖💗💘
  const icons = ["❤", "💖", "💗", "💘", "💕"];
  heart.innerHTML = icons[Math.floor(Math.random() * icons.length)];

  heart.style.left = Math.random() * 100 + "vw";

  const size = 12 + Math.random() * 22;
  heart.style.fontSize = size + "px";

  heart.style.setProperty("--drift", Math.random() * 120 - 60 + "px");
  heart.style.setProperty("--scale", 0.8 + Math.random());

  heart.style.animationDuration = 5 + Math.random() * 4 + "s";

  // random mờ
  heart.style.opacity = 0.6 + Math.random() * 0.4;

  container.appendChild(heart);

  setTimeout(() => heart.remove(), 9000);
}

// chạy liên tục
setInterval(() => {
  if (!screens.capture.classList.contains("hidden")) {
    spawnHeart();
  }
}, 500);

function spawnSparkle() {
  const container = document.getElementById("sparkles");

  const s = document.createElement("div");
  s.className = "sparkle";
  s.innerHTML = "✨";

  s.style.left = Math.random() * 100 + "vw";
  s.style.top = Math.random() * 100 + "vh";

  container.appendChild(s);

  setTimeout(() => s.remove(), 3000);
}

setInterval(spawnSparkle, 800);

// HOME
btnHome.addEventListener("click", () => {
  photos = [null, null, null];
  stopCamera();
  showScreen("home");
});
