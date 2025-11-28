const isInApp =
  navigator.userAgent.includes("Line") ||
  navigator.userAgent.includes("Instagram");

if (isInApp) {
  document.getElementById("inapp-warning").classList.remove("hidden");
}

async function loadProducts() {
  try {
    const res = await fetch(GAS_API_URL);
    const products = await res.json();

    const container = document.getElementById("product-list");
    container.innerHTML = "";

    products.forEach((p, index) => {
      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <div class="product-img-wrap">
          <img src="${p.imageUrl}" data-index="${index}" class="product-img" />
        </div>
        <div class="product-name">${p.name}</div>
        <div class="product-price">HKD$${p.price.replace("HK$", "").replace(".00","")}</div>
        <div class="qty-row">
          <span>數量： </span>
          <input type="number" min="0" value="0" data-index="${index}" class="qty-input" />
        </div>
      `;
      container.appendChild(card);
    });

    bindQtyEvents();
    bindImageEvents();
  } catch (e) {
    alert("商品載入失敗，請稍後再試。");
  }
}

function bindQtyEvents() {
  document.querySelectorAll(".qty-input").forEach((input) => {
    input.addEventListener("input", updateCart);
  });
}

function bindImageEvents() {
  document.querySelectorAll(".product-img").forEach((img) => {
    img.addEventListener("click", () => {
      document.getElementById("lightboxImg").src = img.src;
      document.getElementById("lightbox").classList.remove("hidden");
    });
  });

  document
    .querySelector("[data-role='close-lightbox']")
    .addEventListener("click", () => {
      document.getElementById("lightbox").classList.add("hidden");
    });
}

function updateCart() {
  const qtyInputs = document.querySelectorAll(".qty-input");
  let preview = "";
  let total = 0;

  qtyInputs.forEach((input) => {
    const qty = parseInt(input.value || 0);
    if (qty > 0) {
      const name =
        input.parentElement.parentElement.querySelector(".product-name")
          .textContent;
      const priceText =
        input.parentElement.parentElement.querySelector(".product-price")
          .textContent;
      const price = parseInt(priceText.replace("HKD$", ""));

      preview += `${name} x ${qty}, `;
      total += price * qty;
    }
  });

  document.getElementById("cartPreview").textContent =
    preview || "尚未選購任何品項。";
  document.getElementById("totalAmount").textContent = `HKD$${total}`;
}

document.getElementById("submitBtn").addEventListener("click", () => {
  alert("表單提交功能已啟動！");
});

loadProducts();
