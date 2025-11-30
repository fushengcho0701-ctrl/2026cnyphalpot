
// Simple in-app browser detection
function detectInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  if (/Line/i.test(ua) || /Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua)) {
    const bar = document.getElementById("inapp-warning");
    if (bar) bar.classList.remove("hidden");
  }
}

// Load products from GAS
async function loadProducts() {
  const container = document.getElementById("products-container");
  if (!container) return;

  try {
    const res = await fetch(PRODUCTS_API_URL);
    const data = await res.json();

    if (!data || data.status !== "ok" || !Array.isArray(data.products)) {
      throw new Error("格式錯誤");
    }

    renderProducts(data.products);
  } catch (err) {
    console.error(err);
    container.innerHTML =
      '<div class="loading">商品載入失敗，請稍後再試。</div>';
    alert("商品載入失敗，請稍後再試。");
  }
}

function renderProducts(products) {
  const container = document.getElementById("products-container");
  container.innerHTML = "";

  const groups = { ART: [], FANTASIA: [], OTHER: [] };

  products.forEach((p) => {
    const name = String(p.name || "").trim();
    const series = String(p.series || "").toLowerCase();

    if (series.includes("art") || name.toLowerCase().includes("art")) {
      groups.ART.push(p);
    } else if (
      series.includes("fantasia") ||
      name.toLowerCase().includes("fantasia")
    ) {
      groups.FANTASIA.push(p);
    } else {
      groups.OTHER.push(p);
    }
  });

  const renderGroup = (title, list) => {
    if (!list || list.length === 0) return;
    const h = document.createElement("div");
    h.className = "product-group-title";
    h.textContent = title;
    container.appendChild(h);

    list.forEach((p) => {
      const priceNum = parsePrice(p.price ?? p.rawPrice);
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

  renderGroup("ART 系列", groups.ART);
  renderGroup("Fantasia 系列", groups.FANTASIA);
  renderGroup("其他系列", groups.OTHER);

  bindQtyEvents();
  bindImageLightbox();
}

function parsePrice(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^0-9.]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n);
}

// Quantity and cart summary
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

// Image lightbox
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

// Submit order (send to GAS + generate PDF)
async function handleSubmit() {
  const msgEl = document.getElementById("message");
  msgEl.textContent = "";

  const customerName = document
    .getElementById("customerName")
    .value.trim();
  const customerWhatsapp = document
    .getElementById("customerWhatsapp")
    .value.trim();
  const shopName = document.getElementById("shopName").value.trim();
  const shopInstagram = document
    .getElementById("shopInstagram")
    .value.trim();

  if (!customerName || !customerWhatsapp) {
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
      const name = input.dataset.name || "";
      const price = parseInt(input.dataset.price || "0", 10);
      items.push({ name, price, qty });
      total += price * qty;
    }
  });

  if (items.length === 0) {
    msgEl.textContent = "請至少選擇一個品項。";
    return;
  }

  // Generate PDF (and get base64)
  const pdfInfo = await generatePdf({
    customerName,
    customerWhatsapp,
    shopName,
    shopInstagram,
    items,
    total,
  });

  const orderPayload = {
    customerName,
    customerWhatsapp,
    shopName,
    shopInstagram,
    items,
    pdfBase64: pdfInfo.base64,
  };

  try {
    msgEl.textContent = "訂單送出中，請稍候⋯";

    const body =
      "payload=" + encodeURIComponent(JSON.stringify(orderPayload));

    const res = await fetch(ORDER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const result = await res.json();
    if (!result || result.status !== "ok") {
      throw new Error(result && result.message ? result.message : "未知錯誤");
    }

    msgEl.textContent = "已成功送出預購單，PDF 也已下載。感謝您的訂購！";
    clearSelections();
  } catch (e) {
    console.error("送出訂單失敗", e);
    msgEl.textContent = "送出失敗，請稍後再試或聯絡福盛協助。";
  }
}

async function generatePdf(order) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let y = 14;
  doc.setFontSize(16);
  doc.text("2026 蝴蝶蘭打樣預購單", 14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`姓名：${order.customerName}`, 14, y);
  y += 6;
  doc.text(`Whatsapp：${order.customerWhatsapp}`, 14, y);
  y += 6;
  doc.text(`花店名稱：${order.shopName || "-"}`, 14, y);
  y += 6;
  doc.text(`花店 IG：${order.shopInstagram || "-"}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  doc.text("訂購內容：", 14, y);
  y += 6;

  order.items.forEach((it) => {
    const line = `${it.name}  x ${it.qty}  @ HKD$${it.price}  = HKD$${
      it.price * it.qty
    }`;
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
  // save will also trigger download
  doc.save(fileName);

  const dataUri = doc.output("datauristring");
  const base64 = dataUri.split(",")[1] || "";

  return { base64 };
}

function clearSelections() {
  document
    .querySelectorAll(".product-qty input[type='number']")
    .forEach((input) => (input.value = "0"));
  updateCartSummary();
}

// helpers
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeHtmlAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  detectInAppBrowser();
  loadProducts();

  const submitBtn = document.getElementById("submitBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", handleSubmit);
  }
});
