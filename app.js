let allProducts = [];

function detectInAppBrowser() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  if (/Line|Instagram|FBAN|FBAV/i.test(ua)) {
    document.getElementById("inapp-warning").classList.remove("hidden");
  }
}

async function loadProducts() {
  const container = document.getElementById("products-container");
  try {
    const res = await fetch(PRODUCT_API);
    const data = await res.json();
    if (data.status === "ok") {
      allProducts = data.products || [];
      renderProducts();
    }
  } catch (err) {
    container.innerHTML = `<div class="loading">商品載入失敗。</div>`;
  }
}

function renderProducts() {
  const container = document.getElementById("products-container");
  container.innerHTML = "";
  
  const groups = { ART: [], FANTASIA: [], OTHER: [] };
  allProducts.forEach(p => {
    const name = (p.name || "").toLowerCase();
    const series = (p.series || "").toLowerCase();
    if (series.includes("art") || name.includes("art")) groups.ART.push(p);
    else if (series.includes("fantasia") || name.includes("fantasia")) groups.FANTASIA.push(p);
    else groups.OTHER.push(p);
  });

  const renderGroup = (title, list) => {
    if (!list.length) return;
    const titleEl = document.createElement("div");
    titleEl.className = "product-group-title";
    titleEl.textContent = title;
    container.appendChild(titleEl);

    list.forEach(p => {
      const price = Math.round(parseFloat(String(p.price).replace(/[^0-9.]/g, "")) || 0);
      const card = document.createElement("div");
      card.className = "product-card";
      card.innerHTML = `
        <div class="product-img-wrap" data-fullsrc="${p.imageUrl}">
          <img src="${p.imageUrl}" loading="lazy" />
        </div>
        <div class="product-name">${p.name}</div>
        <div class="product-price">HKD$${price}</div>
        <div class="product-qty">
          <span>數量：</span>
          <input type="number" min="0" value="0" data-name="${p.name}" data-price="${price}" />
        </div>`;
      container.appendChild(card);
    });
  };

  renderGroup("ART 系列", groups.ART);
  renderGroup("Fantasia 系列", groups.FANTASIA);
  renderGroup("其他系列", groups.OTHER);

  document.querySelectorAll(".product-qty input").forEach(i => i.addEventListener("input", updateCartSummary));
  bindImageLightbox();
}

function updateCartSummary() {
  const inputs = document.querySelectorAll(".product-qty input");
  const preview = [];
  let total = 0, count = 0;
  inputs.forEach(input => {
    const qty = parseInt(input.value || "0", 10);
    if (qty > 0) {
      preview.push(`${input.dataset.name} x ${qty}`);
      total += qty * parseInt(input.dataset.price, 10);
      count++;
    }
  });
  document.getElementById("cartPreview").textContent = preview.length ? preview.join("、") : "尚未選購任何品項";
  document.getElementById("itemCount").textContent = `(${count} 項)`;
  document.getElementById("totalAmount").textContent = `HKD$${total}`;
}

function bindImageLightbox() {
  const lb = document.getElementById("lightbox"), lbImg = document.getElementById("lightboxImg");
  document.querySelectorAll(".product-img-wrap").forEach(w => w.addEventListener("click", () => {
    lbImg.src = w.dataset.fullsrc; lb.classList.add("show");
  }));
  document.querySelectorAll("[data-role='close-lightbox']").forEach(b => b.addEventListener("click", () => {
    lb.classList.remove("show"); lbImg.src = "";
  }));
}

async function handleSubmit() {
  const msg = document.getElementById("message");
  const btn = document.getElementById("submitBtn");
  const arrivalDate = document.getElementById("arrivalDate").value;
  const name = document.getElementById("customerName").value.trim();
  const wa = document.getElementById("customerWhatsapp").value.trim();

  if (!arrivalDate || !name || !wa) {
    msg.textContent = "❌ 請完整填寫到港日、姓名與 Whatsapp。";
    msg.style.color = "red";
    return;
  }

  const items = [];
  document.querySelectorAll(".product-qty input").forEach(input => {
    const qty = parseInt(input.value || "0", 10);
    if (qty > 0) {
      items.push({ name: input.dataset.name, qty, price: parseInt(input.dataset.price, 10) });
    }
  });

  if (!items.length) {
    msg.textContent = "⚠️ 請至少選擇 1 個品項。";
    return;
  }

  btn.disabled = true;
  msg.textContent = "🚀 訂單送出中...";
  msg.style.color = "#666";

  const payload = {
    arrivalDate,
    customerName: name,
    customerWhatsapp: wa,
    shopName: document.getElementById("shopName").value.trim(),
    shopInstagram: document.getElementById("shopInstagram").value.trim(),
    items
  };

  try {
    const res = await fetch(ORDER_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payload=" + encodeURIComponent(JSON.stringify(payload))
    });
    const data = await res.json();
    if (data.status === "ok") {
      msg.textContent = "✅ 訂單已成功送出！";
      msg.style.color = "green";
      clearSelections();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    msg.textContent = "❌ 送出失敗：" + err.message;
  } finally {
    btn.disabled = false;
  }
}

function clearSelections() {
  document.querySelectorAll(".product-qty input").forEach(i => i.value = "0");
  document.getElementById("arrivalDate").value = "";
  updateCartSummary();
}

document.addEventListener("DOMContentLoaded", () => {
  detectInAppBrowser();
  loadProducts();
  document.getElementById("submitBtn").addEventListener("click", handleSubmit);
});
