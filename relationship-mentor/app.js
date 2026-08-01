"use strict";

const PAYLOAD_URL = new URL("./assets/private-content.enc.json", document.baseURI);
const LOCK_AFTER_MS = 30 * 60 * 1000;
const FRAME_LOAD_TIMEOUT_MS = 10000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const gate = document.querySelector("#gate");
const viewer = document.querySelector("#viewer");
const form = document.querySelector("#unlock-form");
const passwordInput = document.querySelector("#password");
const unlockButton = document.querySelector("#unlock-button");
const togglePasswordButton = document.querySelector("#toggle-password");
const lockButton = document.querySelector("#lock-button");
const status = document.querySelector("#status");
const frame = document.querySelector("#app-frame");

let lockTimer = null;
let frameLoadTimer = null;
let unlocked = false;

function setStatus(message, kind = "") {
  status.textContent = message;
  status.className = `status${kind ? ` ${kind}` : ""}`;
}

function setBusy(busy) {
  unlockButton.disabled = busy;
  passwordInput.disabled = busy;
  unlockButton.textContent = busy ? "正在本地解密…" : "解锁私人内容";
}

function decodeBase64(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("Invalid base64 value");
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function validatePayload(payload) {
  const valid = payload
    && payload.version === 1
    && payload.algorithm === "AES-256-GCM"
    && payload.kdf?.name === "PBKDF2"
    && payload.kdf?.hash === "SHA-256"
    && Number.isInteger(payload.kdf.iterations)
    && payload.kdf.iterations >= 200000
    && typeof payload.kdf.salt === "string"
    && typeof payload.iv === "string"
    && typeof payload.aad === "string"
    && typeof payload.ciphertext === "string";
  if (!valid) throw new Error("Unsupported encrypted payload");
}

async function deriveKey(password, payload) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: payload.kdf.hash,
      salt: decodeBase64(payload.kdf.salt),
      iterations: payload.kdf.iterations,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

async function decryptPayload(password) {
  const response = await fetch(PAYLOAD_URL, { cache: "no-store", credentials: "omit" });
  if (response.status === 404) throw new Error("PAYLOAD_NOT_PUBLISHED");
  if (!response.ok) throw new Error(`PAYLOAD_HTTP_${response.status}`);

  const payload = await response.json();
  validatePayload(payload);
  const key = await deriveKey(password, payload);
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64(payload.iv),
      additionalData: encoder.encode(payload.aad),
      tagLength: 128,
    },
    key,
    decodeBase64(payload.ciphertext),
  );
  return decoder.decode(plaintext);
}

function resetLockTimer() {
  if (!unlocked) return;
  clearTimeout(lockTimer);
  lockTimer = setTimeout(() => lock("已因 30 分钟无操作而自动锁定。"), LOCK_AFTER_MS);
}

function failFrameLoad(message) {
  clearTimeout(frameLoadTimer);
  frameLoadTimer = null;
  frame.onload = null;
  frame.srcdoc = "<!doctype html><meta charset='utf-8'><title>载入失败</title>";
  unlocked = false;
  viewer.hidden = true;
  gate.hidden = false;
  setStatus(message, "error");
  setBusy(false);
  passwordInput.focus();
}

function finishUnlocked() {
  clearTimeout(frameLoadTimer);
  frameLoadTimer = null;
  frame.onload = null;
  unlocked = true;
  gate.hidden = true;
  viewer.hidden = false;
  document.title = "亲密关系成长中心";
  passwordInput.value = "";
  setBusy(false);
  resetLockTimer();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function showUnlocked(html) {
  setStatus("密码正确，正在启动已解密的网站…", "working");

  frame.onload = () => {
    try {
      const innerDocument = frame.contentDocument;
      const appRoot = innerDocument?.querySelector("#app");
      const rendered = Boolean(appRoot && (appRoot.childElementCount > 0 || appRoot.textContent.trim().length > 0));
      if (!rendered) throw new Error("DECRYPTED_APP_NOT_RENDERED");
      finishUnlocked();
    } catch (error) {
      console.error("Decrypted frame failed to initialize", error instanceof Error ? error.message : "unknown");
      failFrameLoad("内容已经成功解密，但页面脚本未能启动。请刷新后重试；若仍出现，请查看最新部署状态。");
    }
  };

  frameLoadTimer = setTimeout(() => {
    failFrameLoad("内容已经成功解密，但页面载入超时。请刷新后重试。");
  }, FRAME_LOAD_TIMEOUT_MS);

  frame.srcdoc = html;
}

function lock(message = "内容已锁定。") {
  unlocked = false;
  clearTimeout(lockTimer);
  clearTimeout(frameLoadTimer);
  lockTimer = null;
  frameLoadTimer = null;
  frame.onload = null;
  frame.srcdoc = "<!doctype html><meta charset='utf-8'><title>已锁定</title>";
  viewer.hidden = true;
  gate.hidden = false;
  document.title = "亲密关系成长中心｜加密访问";
  passwordInput.value = "";
  passwordInput.type = "password";
  togglePasswordButton.textContent = "显示";
  togglePasswordButton.setAttribute("aria-label", "显示密码");
  setBusy(false);
  setStatus(message);
  passwordInput.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = passwordInput.value;
  if ([...password].length < 24) {
    setStatus("解密密码至少需要 24 个字符。", "error");
    return;
  }

  setBusy(true);
  setStatus("正在浏览器本地派生密钥并解密，首次可能需要几秒钟。", "working");
  try {
    const html = await decryptPayload(password);
    showUnlocked(html);
  } catch (error) {
    console.error("Local decryption failed", error instanceof Error ? error.message : "unknown");
    if (error instanceof Error && error.message === "PAYLOAD_NOT_PUBLISHED") {
      setStatus("加密内容包尚未发布。请先运行私有仓库中的发布工作流。", "error");
    } else if (error instanceof DOMException && error.name === "OperationError") {
      setStatus("密码不正确，或加密内容包已损坏。", "error");
    } else {
      setStatus("无法读取或解密内容包，请稍后重试。", "error");
    }
    setBusy(false);
    passwordInput.select();
  }
});

togglePasswordButton.addEventListener("click", () => {
  const reveal = passwordInput.type === "password";
  passwordInput.type = reveal ? "text" : "password";
  togglePasswordButton.textContent = reveal ? "隐藏" : "显示";
  togglePasswordButton.setAttribute("aria-label", reveal ? "隐藏密码" : "显示密码");
  passwordInput.focus();
});

lockButton.addEventListener("click", () => lock("已手动锁定。"));

window.addEventListener("message", (event) => {
  if (event.source === frame.contentWindow && event.data?.type === "mentor-lock") lock("已从内容页面退出并锁定。");
});

for (const eventName of ["pointerdown", "keydown", "touchstart", "scroll"]) {
  window.addEventListener(eventName, resetLockTimer, { passive: true });
}

window.addEventListener("pagehide", () => {
  clearTimeout(lockTimer);
  clearTimeout(frameLoadTimer);
  frame.onload = null;
  frame.srcdoc = "";
});
