// ========= 基本變數 =========
const apiUrl = typeof GAS_API_URL !== "undefined" ? GAS_API_URL : "";
const cart = {}; // { name: { qty, price, rawPrice } }
let productsCache = [];

// ========= 初始化 =========
document.addEventListener("DOMContentLoaded", () => {
  detectInAppBrowser();
  loadProducts();
  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) submitBtn.addEventListener("click", submitOrder);
  setupLightbox();
});

// 偵測 LINE / IG / FB 內建瀏覽器
function detectInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();
  const isInApp =
    ua.includes("line") ||
    ua.includes("instagram") ||
    ua.includes("fbav") ||
    ua.includes("fb_iab") ||
    ua.includes("fbios") ||
    ua.includes("fban") ||
    ua.includes("messenger") ||
    ua.includes("webview");

  if (isInApp) {
    const bar = document.getElementById("inapp-warning");
    if (bar) bar.classList.remove("hidden");
  }
}

// ========= 載入商品 =========
function loadProducts() {
  const container = document.getElementById("products-container");
  if (!apiUrl) {
    container.innerHTML = "<p>尚未設定 GAS_API_URL。</p>";
    return;
  }

  container.innerHTML = '<div class="loading">商品載入中…</div>';

  fetch(apiUrl + "?action=products")
    .then((res) => res.json())
    .then((data) => {
      if (data.status !== "ok") throw new Error(data.message || "載入失敗");
      productsCache = data.products || [];
      renderProducts(productsCache);
    })
    .catch((err) => {
      console.error(err);
      container.innerHTML = '<div class="loading">載入商品失敗，請稍後再試。</div>';
    });
}

// 依 series 分組並渲染
function renderProducts(products) {
  const container = document.getElementById("products-container");
  if (!products || !products.length) {
    container.innerHTML = "<p>目前沒有商品。</p>";
    return;
  }

  const groups = {};
  products.forEach((p) => {
    const seriesKey = (p.series || inferSeriesFromName(p.name)).trim() || "其他";
    if (!groups[seriesKey]) groups[seriesKey] = [];
    groups[seriesKey].push(p);
  });

  let html = "";
  Object.keys(groups).forEach((series) => {
    const label = seriesLabel(series);
    html += `<div class="category-title">${label}</div>`;
    html += `<div class="product-grid">`;

    groups[series].forEach((p) => {
      const safeName = escapeHtml(p.name || "");
      const price = Number(p.price) || 0;
      const priceDisplay = p.rawPrice || ("$" + price);

      html += `
        <div class="product-card">
          <div class="product-img-wrap" onclick="openLightbox('${encodeURI(p.imageUrl || "")}')">
            <img src="${p.imageUrl || ""}" alt="${safeName}">
          </div>
          <div class="product-name">${safeName}</div>
          <div class="product-price">${priceDisplay}</div>
          <div class="product-qty">
            數量：
            <input type="number" min="0" value="0"
              data-name="${safeName}"
              data-price="${price}"
              data-rawprice="${priceDisplay}"
              oninput="handleQtyChange(this)">
          </div>
        </div>`;
    });

    html += `</div>`;
  });

  container.innerHTML = html;
}

// 若 D 欄沒寫系列，從品名推論
function inferSeriesFromName(name) {
  const lower = String(name || "").toLowerCase();
  if (lower.includes("art")) return "ART 系列";
  if (lower.includes("fantasia")) return "Fantasia 系列";
  if (lower.includes("metal") || lower.includes("gold")) return "金屬色系列";
  return "其他";
}

// 將 series key 轉換成顯示文字
function seriesLabel(series) {
  const s = String(series || "");
  const lower = s.toLowerCase();
  if (lower.includes("art")) return "ART 系列";
  if (lower.includes("fantasia") || lower.includes("多色")) return "Fantasia 系列";
  if (lower.includes("metal") || lower.includes("金屬")) return "金屬色系列";
  return s || "其他";
}

// ========= 購物車相關 =========
window.handleQtyChange = function (inputEl) {
  const qty = Number(inputEl.value) || 0;
  const name = inputEl.dataset.name;
  const price = Number(inputEl.dataset.price) || 0;
  const rawPrice = inputEl.dataset.rawprice || ("$" + price);

  if (!name) return;

  if (qty <= 0) {
    delete cart[name];
  } else {
    cart[name] = { qty, price, rawPrice };
  }
  updateCartSummary();
};

function updateCartSummary() {
  const totalSpan = document.getElementById("totalAmount");
  const itemCountSpan = document.getElementById("itemCount");
  const cartPreview = document.getElementById("cartPreview");

  let total = 0;
  let countItems = 0;
  const lines = [];

  Object.keys(cart).forEach((name) => {
    const item = cart[name];
    const sub = item.qty * item.price;
    total += sub;
    countItems += 1;
    lines.push(`${name} × ${item.qty}`);
  });

  totalSpan.textContent = "$" + total.toLocaleString();
  itemCountSpan.textContent = `(${countItems} 項)`;
  cartPreview.textContent = lines.length ? lines.join("、 ") : "尚未選購任何品項。";
}

// ========= 送出預購單 =========
async function submitOrder() {
  const msgEl = document.getElementById("message");
  const pdfLinkEl = document.getElementById("pdf-link");
  msgEl.textContent = "";
  pdfLinkEl.innerHTML = "";

  const name = document.getElementById("customerName").value.trim();
  const whatsapp = document.getElementById("customerWhatsapp").value.trim();
  const shopName = document.getElementById("shopName").value.trim();
  const shopInstagram = document.getElementById("shopInstagram").value.trim();

  if (!name || !whatsapp) {
    msgEl.textContent = "請先填寫「訂購者姓名」與「Whatsapp 號碼」。";
    msgEl.style.color = "#e53935";
    return;
  }

  const items = Object.keys(cart).map((k) => ({
    name: k,
    qty: cart[k].qty,
    price: cart[k].price,
    rawPrice: cart[k].rawPrice
  }));

  if (!items.length) {
    msgEl.textContent = "請至少選擇一個品項（數量 > 0）。";
    msgEl.style.color = "#e53935";
    return;
  }

  // 產生 PDF（前端）
  msgEl.textContent = "正在建立 PDF 與送出訂單…";
  msgEl.style.color = "#333";

  let pdfBase64 = "";
  let pdfBlobUrl = "";

  try {
    const pdfResult = await generatePdfDocument({
      customerName: name,
      customerWhatsapp: whatsapp,
      shopName,
      shopInstagram,
      items
    });
    pdfBase64 = pdfResult.base64;
    pdfBlobUrl = pdfResult.blobUrl;
  } catch (e) {
    console.error("PDF 產生失敗：", e);
  }

  // 組成送到後端的資料
  const payload = {
    customerName: name,
    customerWhatsapp: whatsapp,
    shopName,
    shopInstagram,
    items,
    pdfBase64
  };

  try {
    const res = await fetch(apiUrl + "?action=order", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: "payload=" + encodeURIComponent(JSON.stringify(payload))
    });

    const data = await res.json();
    if (data.status !== "ok") {
      throw new Error(data.message || "訂單送出失敗");
    }

    msgEl.textContent = "已成功送出預購單！";
    msgEl.style.color = "#2e7d32";

    if (pdfBlobUrl) {
      pdfLinkEl.innerHTML =
        `<a href="${pdfBlobUrl}" download="預購單_${escapeHtml(name)}.pdf">點此下載 PDF 訂購單</a>`;
    }

    // 清空數量與購物車
    clearCart();
  } catch (err) {
    console.error(err);
    msgEl.textContent = "送出失敗，請稍後再試。";
    msgEl.style.color = "#e53935";
  }
}

function clearCart() {
  // 清除所有數量輸入
  document.querySelectorAll('input[type="number"][data-name]').forEach((input) => {
    input.value = "0";
  });
  Object.keys(cart).forEach((k) => delete cart[k]);
  updateCartSummary();
}

// ========= 產生 PDF =========
async function generatePdfDocument(order) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  pdf.setFontSize(18);
  pdf.text("蝴蝶蘭預購單", 10, 15);

  pdf.setFontSize(12);
  pdf.text("訂購者姓名：" + (order.customerName || ""), 10, 25);
  pdf.text("Whatsapp：" + (order.customerWhatsapp || ""), 10, 32);
  pdf.text("花店名稱：" + (order.shopName || ""), 10, 39);
  pdf.text("花店 IG：" + (order.shopInstagram || ""), 10, 46);

  pdf.text("訂購明細：", 10, 58);

  let y = 66;
  let total = 0;

  (order.items || []).forEach((item) => {
    const qty = item.qty || 0;
    const price = item.price || 0;
    const sub = qty * price;
    total += sub;

    const line = `${item.name} × ${qty}  單價 ${price}  小計 ${sub}`;
    pdf.text(line, 10, y);
    y += 8;
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
  });

  pdf.text("總金額：$" + total, 10, y + 6);

  const dataUri = pdf.output("datauristring");
  const base64 = dataUri.split(",")[1] || "";

  // 同時給前端下載用的 Blob URL
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);

  return { base64, blobUrl };
}

// ========= Lightbox =========
function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;

  lightbox.addEventListener("click", (e) => {
    if (e.target.dataset.role === "close-lightbox" || e.target.id === "lightbox") {
      closeLightbox();
    }
  });
}

window.openLightbox = function (url) {
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImg");
  if (!lightbox || !img) return;
  img.src = decodeURI(url);
  lightbox.classList.remove("hidden");
};

function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (lightbox) lightbox.classList.add("hidden");
}

// ========= 小工具 =========
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
