const PRODUCT_API = "https://script.google.com/macros/s/AKfycbwuU4bd8LEeuulW2Rx9Eqn6g89N4wxDqlzdwQ1J2DJmg8lBUHbnWAEfJx9VUvt-qeprcQ/exec?action=products";
const ORDER_API   = "https://script.google.com/macros/s/AKfycbzjF-KV_gsvLp8qxlRa1wN7Nc1cUCtQv4O0_R_4crE37qMXuQYERC5AGZt-rmtzQT2LzQ/exec?action=order";

let cart = [];

async function loadProducts() {
  const res = await fetch(PRODUCT_API);
  const data = await res.json();
  if (!data.products) return;

  const art = data.products.filter(p => (p.series||'').toLowerCase().includes('art'));
  const fan = data.products.filter(p => (p.series||'').toLowerCase().includes('fantasia'));

  renderList("art-list", art);
  renderList("fantasia-list", fan);
}

function renderList(id, list){
  const container = document.getElementById(id);
  container.innerHTML = "";
  list.forEach(item=>{
    const div = document.createElement("div");
    div.className = "product-card";
    div.innerHTML = `
      <img src="${item.imageUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:4px;" />
      <h4>${item.name}</h4>
      <p>HKD$ ${item.price}</p>
      <button onclick='addToCart(${JSON.stringify(item)})'>加入</button>
    `;
    container.appendChild(div);
  });
}

function addToCart(item){
  cart.push({...item, qty:1});
  document.getElementById("cart-items").innerHTML = 
    "已選：" + cart.length + " 項";
}

document.getElementById("submit-order").onclick = async ()=>{
  if (!cart.length) {alert("請先選擇商品"); return;}

  const order = {
    customerName:"客戶",
    customerWhatsapp:"0000",
    shopName:"",
    shopInstagram:"",
    items: cart
  };

  const body = "payload=" + encodeURIComponent(JSON.stringify(order));
  const res = await fetch(ORDER_API,{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body
  });

  const data = await res.json();
  if (data.status==="ok") alert("訂單送出成功！");
  else alert("訂單送出失敗");
};

loadProducts();
