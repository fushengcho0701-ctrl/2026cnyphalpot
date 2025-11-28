// === 設定：Google Apps Script Web App URL ===
const GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbwuU4bd8LEeuulW2Rx9Eqn6g89N4wxDqlzdwQ1J2DJmg8lBUHbnWAEfJx9VUvt-qeprcQ/exec";

// === In-app Browser 偵測（LINE / IG） ===
function detectInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  if (/Line/i.test(ua) || /Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua)) {
    const bar = document.getElementById("inapp-warning");
    if (bar) bar.classList.remove("hidden");
  }
}

// === 讀取商品 ===
async function loadProducts() {
  const container = document.getElementById("products-container");
  if (!container) return;

  try {
    const res = await fetch(GAS_API_URL, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    let data = await res.json();

    // 允許 data 是 {products:[...]} 或直接 [...]
    if (data && data.products) {
      data = data.products;
    }

    if (!Array.isArray(data)) {
      throw new Error("資料格式錯誤");
    }

    renderProducts(data);
  } catch (err) {
    console.error("載入商品錯誤", err);
    container.innerHTML =
      '<div class="loading">商品載入失敗，請稍後再試。</div>';
    alert("商品載入失敗，請稍後再試。");
  }
}

// === 商品渲染與分組 ===
function renderProducts(products) {
  const container = document.getElementById("products-container");
  container.innerHTML = "";

  // 依 series 或 name 分成 ART / Fantasia / 其他
  const groups = {
    ART: [],
    FANTASIA: [],
    OTHER: [],
  };

  products.forEach((p) => {
    const name = String(p.name || "").trim();
    const series = String(p.series || "").toLowerCase();

    if (series.includes("art") || name.toLowerCase().includes("art")) {
      groups.ART.push(p);
    } else if (series.includes("fantasia") || name.toLowerCase().includes("fantasia")) {
      groups.FANTASIA.push(p);
    } else {
      groups.OTHER.push(p);
    }
  });

  const renderGroup = (title, subtitle, list) => {
    if (!list || list.length === 0) return;
    const h = document.createElement("div");
    h.className = "product-group-title";
    h.textContent = title;
    container.appendChild(h);
    if (subtitle) {
      const sub = document.createElement("div");
      sub.className = "product-group-subtitle";
      sub.textContent = subtitle;
      container.appendChild(sub);
    }

    list.forEach((p, idx) => {
      const priceNum = parsePrice(p.price);
      const priceDisplay = "HKD$" + priceNum;

      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <div class="product-img-wrap" data-fullsrc="${p.imageUrl || ""}">
          <img src="${p.imageUrl || ""}" alt="${escapeHtml(p.name || "")}" />
        </div>
        <div class="product-name">${escapeHtml(p.name || "")}</div>
        <div class="product-price">${priceDisplay}</div>
        <div class="product-qty">
          <span>數量：</span>
          <input type="number" min="0" value="0"
            data-name="${escapeHtmlAttr(p.name || "")}"
            data-price="${priceNum}">
        </div>
      `;

      container.appendChild(card);
    });
  };

  renderGroup("ART 系列", "細緻花紋、強烈視覺效果", groups.ART);
  renderGroup("Fantasia 系列", "多色漸層、繽紛浪漫", groups.FANTASIA);
  renderGroup("其他系列", "", groups.OTHER);

  bindQtyEvents();
  bindImageLightbox();
}

// 解析價格文字，例如 "HK$258.00"
function parsePrice(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^\d.]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

// === 數量 & 購物車 ===
function bindQtyEvents() {
  document.querySelectorAll(".product-qty input[type='number']").forEach((el) => {
    el.addEventListener("input", updateCartSummary);
  });
}

function updateCartSummary() {
  const inputs = document.querySelectorAll(
    ".product-qty input[type='number']"
  );

  let total = 0;
  let countItems = 0;
  const previewItems = [];

  inputs.forEach((input) => {
    const qty = parseInt(input.value || "0", 10);
    if (qty > 0) {
      const name = input.dataset.name || "";
      const price = parseInt(input.dataset.price || "0", 10);
      total += price * qty;
      countItems += 1;
      previewItems.push(`${name} x ${qty}`);
    }
  });

  const previewEl = document.getElementById("cartPreview");
  const countEl = document.getElementById("itemCount");
  const totalEl = document.getElementById("totalAmount");

  previewEl.textContent =
    previewItems.length > 0 ? previewItems.join("、") : "尚未選購任何品項。";
  countEl.textContent = `(${countItems} 項)`;
  totalEl.textContent = `HKD$${total}`;
}

// === 圖片放大 Lightbox ===
function bindImageLightbox() {
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightboxImg");

  document
    .querySelectorAll(".product-img-wrap")
    .forEach((wrap) =>
      wrap.addEventListener("click", () => {
        const src = wrap.dataset.fullsrc || wrap.querySelector("img").src;
        lightboxImg.src = src;
        lightbox.classList.add("show");
      })
    );

  lightbox.querySelectorAll("[data-role='close-lightbox']").forEach((btn) =>
    btn.addEventListener("click", () => {
      lightbox.classList.remove("show");
      lightboxImg.src = "";
    })
  );
}

// === 送出訂單 → 產生 PDF（前端） ===
async function handleSubmit() {
  const name = document.getElementById("customerName").value.trim();
  const whatsapp = document.getElementById("customerWhatsapp").value.trim();
  const shop = document.getElementById("shopName").value.trim();
  const ig = document.getElementById("shopInstagram").value.trim();

  if (!name || !whatsapp) {
    alert("請填寫姓名與 Whatsapp 號碼。");
    return;
  }

  // 收集購物車項目
  const inputs = document.querySelectorAll(
    ".product-qty input[type='number']"
  );
  const items = [];
  let total = 0;

  inputs.forEach((input) => {
    const qty = parseInt(input.value || "0", 10);
    if (qty > 0) {
      const itemName = input.dataset.name || "";
      const price = parseInt(input.dataset.price || "0", 10);
      items.push({ name: itemName, price, qty });
      total += price * qty;
    }
  });

  if (items.length === 0) {
    alert("請至少選擇一個品項。");
    return;
  }

  // 產生 PDF
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 14;
    doc.setFontSize(16);
    doc.text("2026 農曆新年 蝴蝶蘭盆栽打樣預購單", 14, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`姓名：${name}`, 14, y);
    y += 6;
    doc.text(`Whatsapp：${whatsapp}`, 14, y);
    y += 6;
    doc.text(`花店名稱：${shop || "-"}`, 14, y);
    y += 6;
    doc.text(`花店 IG：${ig || "-"}`, 14, y);
    y += 10;

    doc.setFontSize(12);
    doc.text("訂購內容：", 14, y);
    y += 6;

    items.forEach((it) => {
      const line = `${it.name}  x ${it.qty}  @ HKD$${it.price}  = HKD$${it.price *
        it.qty}`;
      doc.text(line, 18, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 14;
      }
    });

    y += 4;
    doc.setFontSize(13);
    doc.text(`總計：HKD$${total}`, 18, y);

    const fileName = `orchid-preorder-${Date.now()}.pdf`;
    doc.save(fileName);

    document.getElementById("message").textContent =
      "PDF 訂購單已產生並下載，若有問題可再聯絡 Lisa。";
  } catch (e) {
    console.error(e);
    alert("PDF 產生失敗，但訂購內容已在頁面中顯示。");
  }
}

// === 小工具 ===
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeHtmlAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

// === 初始化 ===
document.addEventListener("DOMContentLoaded", () => {
  detectInAppBrowser();
  loadProducts();

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleSubmit);
  }
});
