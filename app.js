/*****************************************
 * 設定：你的兩個 GAS 網址
 *****************************************/
const PRODUCT_API = "https://script.google.com/macros/s/AKfycbwuU4bd8LEeuulW2Rx9Eqn6g89N4wxDqlzdwQ1J2DJmg8lBUHbnWAEfJx9VUvt-qeprcQ/exec?action=products";
const ORDER_API   = "https://script.google.com/macros/s/AKfycbzjF-KV_gsvLp8qxlRa1wN7Nc1cUCtQv4O0_R_4crE37qMXuQYERC5AGZt-rmtzQT2LzQ/exec?action=order";

/*****************************************
 * 變數
 *****************************************/
let allProducts = [];
let cart = [];

/*****************************************
 * 1. 初始化：讀商品
 *****************************************/
async function loadProducts() {
    try {
        const res = await fetch(PRODUCT_API);
        const data = await res.json();

        if (data.status !== "ok") {
            alert("商品載入失敗");
            return;
        }

        allProducts = data.products || [];
        renderProducts();
    } catch (err) {
        alert("商品載入失敗");
    }
}

/*****************************************
 * 2. Render 商品（維持你舊版 UI）
 *****************************************/
function renderProducts() {
    const artContainer = document.getElementById("art-list");
    const fanContainer = document.getElementById("fan-list");

    artContainer.innerHTML = "";
    fanContainer.innerHTML = "";

    allProducts.forEach(p => {
        const box = document.createElement("div");
        box.className = "product-card";
        box.innerHTML = `
            <div class="img-box">
                <img src="${p.imageUrl}" onclick="showImage('${p.imageUrl}')">
            </div>
            <div class="p-name">${p.name}</div>
            <div class="p-price">HKD$ ${p.price}</div>
            <button onclick="addToCart('${p.name}', ${p.price})">加入</button>
        `;

        if (p.series.includes("ART")) artContainer.appendChild(box);
        else fanContainer.appendChild(box);
    });
}

/*****************************************
 * 3. 放大圖片
 *****************************************/
function showImage(url) {
    const modal = document.getElementById("img-modal");
    const modalImg = document.getElementById("modal-img");
    modal.style.display = "block";
    modalImg.src = url;
}

function closeImage() {
    document.getElementById("img-modal").style.display = "none";
}

/*****************************************
 * 4. 購物車
 *****************************************/
function addToCart(name, price) {
    const exist = cart.find(c => c.name === name);
    if (exist) exist.qty++;
    else cart.push({ name, price, qty: 1 });

    updateCartUI();
}

function updateCartUI() {
    const cartList = document.getElementById("cart-items");
    const cartTotal = document.getElementById("cart-total");

    cartList.innerHTML = "";
    let total = 0;

    cart.forEach(item => {
        const li = document.createElement("div");
        li.className = "cart-row";
        const sub = item.price * item.qty;
        total += sub;
        li.innerHTML = `${item.name} x ${item.qty} = HKD$${sub}`;
        cartList.appendChild(li);
    });

    cartTotal.innerText = total;
}

/*****************************************
 * 5. 提交訂單（✔ 不下載 PDF ✔ 修正 API 回應格式）
 *****************************************/
async function submitOrder() {
    if (!cart.length) {
        alert("請選擇商品");
        return;
    }

    const name = document.getElementById("customer-name").value.trim();
    const wa   = document.getElementById("customer-wa").value.trim();
    const shop = document.getElementById("customer-shop").value.trim();
    const ig   = document.getElementById("customer-ig").value.trim();

    if (!name || !wa) {
        alert("姓名與 Whatsapp 必填");
        return;
    }

    const order = {
        customerName: name,
        customerWhatsapp: wa,
        shopName: shop,
        shopInstagram: ig,
        items: cart.map(c => ({
            name: c.name,
            qty: c.qty,
            price: c.price
        })),
        total: cart.reduce((sum, i) => sum + i.price * i.qty, 0),

        // ❌ 不再下載 PDF
        // ✔ 但仍把 Base64 給 GAS（如果你保留 PDF 功能的話）
        pdfBase64: ""
    };

    try {
        const res = await fetch(ORDER_API, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "payload=" + encodeURIComponent(JSON.stringify(order))
        });

        const data = await res.json();

        // *** ✔ 這裡是關鍵：只要 GAS 回傳 status=ok 就算成功 ***
        if (data.status === "ok") {
            alert("送出成功！");
            cart = [];
            updateCartUI();
        } else {
            alert("送出失敗：" + JSON.stringify(data));
        }
        
    } catch (err) {
        alert("送出訂單失敗：" + err);
    }
}

/*****************************************
 * 啟動
 *****************************************/
window.onload = loadProducts;
