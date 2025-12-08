/*****************************************
 * GAS API 端點（你最新部署的那個）
 *****************************************/
const PRODUCT_API =
  "https://script.google.com/macros/s/AKfycbzmCmNRKkT7gN_ZPTgrSJxZ8v9YODl_F4cYqN-Ox_vK-GMnF8OyAV5nwJwj-Wdkb7-5HQ/exec?action=products";

const ORDER_API =
  "https://script.google.com/macros/s/AKfycbzmCmNRKkT7gN_ZPTgrSJxZ8v9YODl_F4cYqN-Ox_vK-GMnF8OyAV5nwJwj-Wdkb7-5HQ/exec?action=order";

/*****************************************
 * 全域狀態
 *****************************************/
let allProducts = [];

/*****************************************
 * In-app Browser 偵測（LINE / IG）
 *****************************************/
function detectInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  if (/Line/i.test(ua) || /Instagram/i.test(ua) || /FBAN|FBAV/i.test(ua)) {
    document.getElementById("inapp-warning").classList.remove("hidden");
  }
}

/*****************************************
 * 讀取商品清單
 *****************************************/
async function loadProducts() {
  const container = document.getElementById("products-container");

  try {
    const res = await fetch(PRODUCT_API);
    const data = await res.json();

    if (!data || data.status !== "ok") {
      throw new Error("商品 API 回傳格式錯誤");
    }

    allProducts = data.products || [];
    renderProducts();
  } catch (err) {
    console.error("載入商品錯誤", err);
    container.innerHTML =
      `<div class="loading">商品載入失敗，請稍後再試。</div>`;
  }
}

/*****************************************
 * Render 商品卡片
 *****************************************/
function renderProducts() {
  const container = document.getElementById("products-container");
  container.innerHTML = "";

  const groups = {
    ART: [],
    FANTASIA: [],
    OTHER: []
  };

  allProducts.forEach(p => {
    const name = (p.name || "").toLowerCase();
    const series = (p.series || "").toLowerCase();

    if (series.includes("art") || name.includes("art")) groups.ART.push(p);
    else if (series.includes("fantasia") || name.includes("fantasia")) groups.FANTASIA.push(p);
    else groups.OTHER.push(p);
  });

  function renderGroup(title, list) {
    if (!list.length) return;

    const titleEl = document.createElement("div");
    titleEl.className = "product-group-title";
    titleEl.textContent = title;
    container.appendChild(titleEl);

    list.forEach(product => {
      const price = parsePrice(product.price ?? product.rawPrice);
      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <div class="product-img-wrap" data-fullsrc="${product.imageUrl}">
          <img src="${product.imageUrl}" alt="${product.name}" />
        </div>

        <div class="product-name">${product.name}</div>
        <div class="product-price">HKD$${price}</div>

        <div class="product-qty">
          <span>數量：</span>
          <input
            type="number"
            min="0"
            value="0"
            data-name="${product.name}"
            data-price="${price}"
          />
        </div>
      `;

      container.appendChild(card);
    });
  }

  renderGroup("ART 系列", groups.ART);
  renderGroup("Fantasia 系列", groups.FANTASIA);
  renderGroup("其他系列", groups.OTHER);

  bindQtyEvents();
  bindImageLightbox();
}

/*****************************************
 * 處理價格格式（HKD$ 去字串）
 *****************************************/
function parsePrice(raw) {
  if (!raw) return 0;
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : Math.round(num);
}

/*****************************************
 * 綁定數量 input
 *****************************************/
function bindQtyEvents() {
  document.querySelectorAll(".product-qty input").forEach(input => {
    input.addEventListener("input", updateCartSummary);
  });
}

/*****************************************
 * 更新底部購物車（數量、項目、金額）
 *****************************************/
function updateCartSummary() {
  const inputs = document.querySelectorAll(".product-qty input");
  const preview = [];
  let total = 0;
  let count = 0;

  inputs.forEach(input => {
    const qty = parseInt(input.value || "0");
    if (qty > 0) {
      const name = input.dataset.name;
      const price = parseInt(input.dataset.price);
      preview.push(`${name} x ${qty}`);
      total += qty * price;
      count++;
    }
  });

  document.getElementById("cartPreview").textContent =
    preview.length ? preview.join("、") : "尚未選購任何品項";

  document.getElementById("itemCount").textContent = `(${count} 項)`;

  document.getElementById("totalAmount").textContent = `HKD$${total}`;
}

/*****************************************
 * Lightbox（放大圖片）
 *****************************************/
function bindImageLightbox() {
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightboxImg");

  document.querySelectorAll(".product-img-wrap").forEach(wrap => {
    wrap.addEventListener("click", () => {
      lbImg.src = wrap.dataset.fullsrc;
      lb.classList.add("show");
    });
  });

  document.querySelectorAll("[data-role='close-lightbox']").forEach(btn => {
    btn.addEventListener("click", () => {
      lb.classList.remove("show");
      lbImg.src = "";
    });
  });
}

/*****************************************
 * 送出訂單（PDF 已取消）
 *****************************************/
async function handleSubmit() {
  const msg = document.getElementById("message");
  msg.textContent = "";

  const name = document.getElementById("customerName").value.trim();
  const wa = document.getElementById("customerWhatsapp").value.trim();
  const shop = document.getElementById("shopName").value.trim();
  const ig = document.getElementById("shopInstagram").value.trim();

  if (!name || !wa) {
    msg.textContent = "請填寫「姓名」與「Whatsapp」。";
    return;
  }

  const inputs = document.querySelectorAll(".product-qty input");
  const items = [];
  let total = 0;

  inputs.forEach(input => {
    const qty = parseInt(input.value || "0");
    if (qty > 0) {
      items.push({
        name: input.dataset.name,
        qty,
        price: parseInt(input.dataset.price)
      });
      total += qty * parseInt(input.dataset.price);
    }
  });

  if (!items.length) {
    msg.textContent = "請至少選擇 1 個品項。";
    return;
  }

  const payload = {
    customerName: name,
    customerWhatsapp: wa,
    shopName: shop,
    shopInstagram: ig,
    items,
    total,
    pdfBase64: "" // 已停用
  };

  msg.textContent = "訂單送出中⋯";

  try {
    const res = await fetch(ORDER_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payload=" + encodeURIComponent(JSON.stringify(payload))
    });

    const data = await res.json();

    // ★★★★★ 新增：修正「明明成功但前端顯示錯誤」的問題
    if (data.status === "ok" || data.success === true) {
      msg.textContent = "訂單已成功送出！感謝您的預購 🙏";
      clearSelections();
    } else {
      msg.textContent =
        "送出失敗：" + (data.message || data.error || "未知錯誤");
    }
  } catch (err) {
    msg.textContent = "送出訂單失敗：" + err;
  }
}

/*****************************************
 * 清空選擇
 *****************************************/
function clearSelections() {
  document.querySelectorAll(".product-qty input").forEach(i => (i.value = "0"));
  updateCartSummary();
}

/*****************************************
 * 啟動程式
 *****************************************/
document.addEventListener("DOMContentLoaded", () => {
  detectInAppBrowser();
  loadProducts();
  document
    .getElementById("submitBtn")
    .addEventListener("click", handleSubmit);
});
