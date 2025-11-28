// === In-app Browser 偵測（LINE / IG / FB） ===
function detectInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  if (/Line/i.test(ua) || /Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua)) {
    const bar = document.getElementById("inapp-warning");
    if (bar) bar.classList.remove("hidden");
  }
}

// === 載入商品（GET 到 Google Apps Script） ===
async function loadProducts() {
  const container = document.getElementById("products-container");
  if (!container) return;

  try {
    const res = await fetch(PRODUCTS_API_URL, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    let data = await res.json();

    // 支援 {products:[...]} 或直接 [...]
    if (data && Array.isArray(data.products)) {
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

    list.forEach((p) => {
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
  document
    .querySelectorAll(".product-qty input[type='number']")
    .forEach((el) => {
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

  document.querySelectorAll(".product-img-wrap").forEach((wrap) =>
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

// === 送出訂單：POST 到 GAS + 產 PDF ===
async function handleSubmit() {
  const msgEl = document.getElementById("message");
  msgEl.textContent = "";

  const name = document.getElementById("customerName").value.trim();
  const whatsapp = document.getElementById("customerWhatsapp").value.trim();
  const shop = document.getElementById("shopName").value.trim();
  const ig = document.getElementById("shopInstagram").value.trim();

  if (!name || !whatsapp) {
    msgEl.textContent = "請填寫「訂購者姓名」與「Whatsapp 號碼」。";
    return;
  }

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
    msgEl.textContent = "請至少選擇一個品項。";
    return;
  }

  const payload = {
    name,
    whatsapp,
    shop,
    instagram: ig,
    items,
    total,
  };

  try {
    msgEl.textContent = "訂單送出中，請稍候⋯";

    // 先送到 Google Sheet
    const res = await fetch(ORDER_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!result || result.success !== true) {
      throw new Error(result && result.error ? result.error : "未知錯誤");
    }

    // 再產 PDF 提供客人下載
    await generatePdf(payload);

    msgEl.textContent = "已成功送出預購單，PDF 也已下載。感謝您的訂購！";
    clearSelections();
  } catch (e) {
    console.error("送出訂單失敗", e);
    msgEl.textContent = "送出失敗，請稍後再試或聯絡福盛協助。";
  }
}

// 產生 PDF
async function generatePdf(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 14;
  doc.setFontSize(16);
  doc.text("2026 農曆新年 蝴蝶蘭盆栽打樣預購單", 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`姓名：${order.name}`, 14, y);
  y += 6;
  doc.text(`Whatsapp：${order.whatsapp}`, 14, y);
  y += 6;
  doc.text(`花店名稱：${order.shop || "-"}`, 14, y);
  y += 6;
  doc.text(`花店 IG：${order.instagram || "-"}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("訂購內容：", 14, y);
  y += 6;

  order.items.forEach((it) => {
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
  doc.text(`總計：HKD$${order.total}`, 18, y);

  const fileName = `orchid-preorder-${Date.now()}.pdf`;
  doc.save(fileName);
}

// 清空選擇與表單
function clearSelections() {
  document
    .querySelectorAll(".product-qty input[type='number']")
    .forEach((input) => (input.value = "0"));
  updateCartSummary();

  // 可選：清空表單
  // document.getElementById("customerName").value = "";
  // document.getElementById("customerWhatsapp").value = "";
  // document.getElementById("shopName").value = "";
  // document.getElementById("shopInstagram").value = "";
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
