let allProducts = [];

async function loadProducts() {
  try {
    const res = await fetch(PRODUCT_API);
    const data = await res.json();
    if (data.status === "ok") {
      allProducts = data.products || [];
      renderProducts();
    }
  } catch (err) { console.error("載入失敗"); }
}

function renderProducts() {
  const container = document.getElementById("products-container");
  container.innerHTML = "";
  allProducts.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="product-img-wrap" data-fullsrc="${p.imageUrl}"><img src="${p.imageUrl}" loading="lazy" /></div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">HKD$${p.price}</div>
      <div class="product-qty"><input type="number" min="0" value="0" data-name="${p.name}" data-price="${p.price}" /></div>`;
    container.appendChild(card);
  });
  document.querySelectorAll(".product-qty input").forEach(i => i.addEventListener("input", updateCartSummary));
  bindImageLightbox();
}

function updateCartSummary() {
  let total = 0, preview = [];
  document.querySelectorAll(".product-qty input").forEach(input => {
    const qty = parseInt(input.value || "0", 10);
    if (qty > 0) {
      preview.push(`${input.dataset.name} x ${qty}`);
      total += qty * parseInt(input.dataset.price);
    }
  });
  document.getElementById("cartPreview").textContent = preview.length ? preview.join("、") : "尚未選購";
  document.getElementById("totalAmount").textContent = `HKD$${total}`;
}

async function handleSubmit() {
  const arrivalDate = document.getElementById("arrivalDate").value;
  const name = document.getElementById("customerName").value.trim();
  const wa = document.getElementById("customerWhatsapp").value.trim();
  const items = [];
  let total = 0;

  document.querySelectorAll(".product-qty input").forEach(input => {
    const qty = parseInt(input.value || "0", 10);
    if (qty > 0) {
      items.push({ name: input.dataset.name, qty, price: parseInt(input.dataset.price) });
      total += qty * parseInt(input.dataset.price);
    }
  });

  if (!arrivalDate || !name || !wa || !items.length) {
    alert("請完整填寫日期、資料並選擇商品。");
    return;
  }

  const payload = { arrivalDate, customerName: name, customerWhatsapp: wa, 
                    shopName: document.getElementById("shopName").value.trim(),
                    shopInstagram: document.getElementById("shopInstagram").value.trim(),
                    items, total };

  document.getElementById("submitBtn").disabled = true;
  document.getElementById("message").textContent = "正在送出訂單...";

  try {
    const res = await fetch(ORDER_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "payload=" + encodeURIComponent(JSON.stringify(payload))
    });
    const data = await res.json();
    if (data.status === "ok") {
      showSuccessScreen(payload);
    }
  } catch (err) { alert("送出失敗，請檢查網路。"); }
}

function showSuccessScreen(payload) {
  document.getElementById("main-content").classList.add("hidden");
  document.getElementById("cartBar").classList.add("hidden");
  document.getElementById("success-screen").classList.remove("hidden");

  const itemsHtml = payload.items.map(it => `<div class="summary-item"><span>${it.name}</span><span>x ${it.qty}</span></div>`).join('');
  document.getElementById("order-summary-details").innerHTML = `
    <p><strong>到港日：</strong>${payload.arrivalDate}</p>
    <p><strong>訂購人：</strong>${payload.customerName}</p>
    <p><strong>總金額：</strong>HKD$${payload.total}</p>
    <hr/>${itemsHtml}`;

  const waMsg = `您好 Lisa，我已下單大貨預購：\n姓名：${payload.customerName}\n到港日：${payload.arrivalDate}\n總計：HKD$${payload.total}`;
  document.getElementById("wa-confirm-btn").href = `https://wa.me/852XXXXXXXX?text=${encodeURIComponent(waMsg)}`; //更換成Lisa號碼
  window.scrollTo(0,0);
}

function bindImageLightbox() {
  const lb = document.getElementById("lightbox"), lbImg = document.getElementById("lightboxImg");
  document.querySelectorAll(".product-img-wrap").forEach(w => w.addEventListener("click", () => {
    lbImg.src = w.dataset.fullsrc; lb.classList.add("show");
  }));
  document.querySelectorAll("[data-role='close-lightbox']").forEach(b => b.addEventListener("click", () => lb.classList.remove("show")));
}

document.addEventListener("DOMContentLoaded", () => {
  loadProducts();
  document.getElementById("submitBtn").addEventListener("click", handleSubmit);
});
