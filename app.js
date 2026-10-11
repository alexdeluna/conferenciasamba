const INITIAL_PRODUCTS = [{"id":"heineken","name":"Heineken","quantity":240,"unitPriceCents":492,"active":true},{"id":"amstel","name":"Amstel","quantity":120,"unitPriceCents":433,"active":true},{"id":"coca","name":"Coca","quantity":12,"unitPriceCents":350,"active":true},{"id":"antarctica","name":"Antarctica","quantity":12,"unitPriceCents":275,"active":true},{"id":"fanta","name":"Fanta","quantity":6,"unitPriceCents":325,"active":true},{"id":"sprite","name":"Sprite","quantity":6,"unitPriceCents":325,"active":true},{"id":"monster","name":"Monster","quantity":12,"unitPriceCents":933,"active":true},{"id":"redbull","name":"Red Bull","quantity":6,"unitPriceCents":799,"active":true},{"id":"h2o","name":"H2O","quantity":12,"unitPriceCents":800,"active":true},{"id":"ice","name":"Ice","quantity":24,"unitPriceCents":266,"active":true},{"id":"whisky-doses","name":"Whisky — doses","quantity":20,"unitPriceCents":375,"active":true}];
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const money = cents => (cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const centsFromInput = value => {
  const raw=String(value??"").trim().replace(/\s/g,"").replace(/^R\$\s?/,"");
  if(!raw) return NaN;
  let normalized;
  if(raw.includes(",")) normalized=raw.replace(/\./g,"").replace(",",".");
  else normalized=raw;
  const n=Number(normalized);
  return Number.isFinite(n)&&n>=0 ? Math.round(n*100) : NaN;
};
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const initials = name => name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
let products=[], history=[], returns={}, currentFilter="all", detailRecord=null, toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function productTotal(p){return p.quantity*p.unitPriceCents;}
function returnedCents(p){return (Number(returns[p.id])||0)*p.unitPriceCents;}
function payableCents(p){return (p.quantity-(Number(returns[p.id])||0))*p.unitPriceCents;}
function activeProducts(){return products.filter(p=>p.active!==false).sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));}
function totals(list=activeProducts()){return list.reduce((a,p)=>{const r=Number(returns[p.id])||0;a.received+=p.quantity;a.returned+=r;a.original+=productTotal(p);a.returnedCents+=returnedCents(p);a.payable+=payableCents(p);return a;},{received:0,returned:0,original:0,returnedCents:0,payable:0});}
async function init(){
  await Store.open();
  products=await Store.all("products"); history=await Store.all("history");
  if(!products.length){products=INITIAL_PRODUCTS.map(p=>({...p}));for(const p of products)await Store.put("products",p);}
  history.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  renderAll();
  if("serviceWorker" in navigator && location.protocol!=="file:") navigator.serviceWorker.register("./sw.js").catch(()=>{});
  $("#connectionText").textContent=navigator.onLine?"Local":"Offline";
  window.addEventListener("online",()=>$("#connectionText").textContent="Local");
  window.addEventListener("offline",()=>$("#connectionText").textContent="Offline");
}
function go(view){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${view}`));
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.go===view));
  if(view==="home")renderHome();if(view==="settlement")renderSettlement();if(view==="products")renderManage();if(view==="history")renderHistory();
  window.scrollTo({top:0,behavior:"smooth"});
}
function renderAll(){renderHome();renderSettlement();renderManage();renderHistory();}
function renderHome(){
  const ps=activeProducts(),t=totals(ps);
  $("#homePayable").textContent=money(t.payable);
  $("#homePayableCaption").textContent=t.returned?`${t.returned} unidade(s) marcadas para devolução`:"Nenhuma devolução registrada";
  $("#homeProductCount").textContent=ps.length;
  $("#homeUnits").textContent=t.received.toLocaleString("pt-BR");
}
function renderSettlement(){
  const ps=activeProducts(), t=totals(ps), q=$("#productSearch").value.trim().toLocaleLowerCase("pt-BR");
  $("#settlementPayable").textContent=money(t.payable);$("#stickyPayable").textContent=money(t.payable);
  $("#returnedUnits").textContent=`${t.returned} devolvida(s)`;
  $("#remainingUnits").textContent=`${t.received-t.returned} não devolvida(s)`;
  $("#returnProgress").style.width=(t.received?Math.min(100,t.returned/t.received*100):0)+"%";
  const filtered=ps.filter(p=>p.name.toLocaleLowerCase("pt-BR").includes(q)).filter(p=>currentFilter==="all"||(currentFilter==="pending"&&(Number(returns[p.id])||0)===0)||(currentFilter==="returned"&&(Number(returns[p.id])||0)>0));
  $("#settlementProducts").innerHTML=filtered.length?filtered.map(p=>{
    const r=Number(returns[p.id])||0, remaining=p.quantity-r;
    return `<article class="product-card settlement-product" data-product-card="${p.id}">
      <div class="product-card-top"><div class="product-avatar">${escapeHtml(initials(p.name))}</div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><div class="product-meta">Recebidos: <strong>${p.quantity}</strong> · Custo: <strong>${money(p.unitPriceCents)}</strong></div></div><div class="product-cost">${money(productTotal(p))}<small>valor original</small></div></div>
      <div class="return-line"><div><div class="product-meta">Quantidade devolvida</div><div class="return-control"><button type="button" data-adjust="${p.id}" data-delta="-1" aria-label="Diminuir devolução">−</button><input aria-label="Quantidade devolvida de ${escapeHtml(p.name)}" data-return="${p.id}" type="number" inputmode="numeric" min="0" max="${p.quantity}" step="1" value="${r}"><button type="button" data-adjust="${p.id}" data-delta="1" aria-label="Aumentar devolução">＋</button></div></div><div class="return-result"><span data-remaining="${p.id}">${remaining} não devolvida(s)</span><strong data-payable="${p.id}">${money(payableCents(p))}</strong></div></div>
    </article>`;
  }).join(""):`<div class="empty-state"><div class="empty-icon">⌕</div><strong>Nenhum produto encontrado</strong><p>Tente outra busca ou altere o filtro.</p></div>`;
}
function renderManage(){
  const q=$("#manageSearch").value.trim().toLocaleLowerCase("pt-BR");
  const list=[...products].sort((a,b)=>a.name.localeCompare(b.name,"pt-BR")).filter(p=>p.name.toLocaleLowerCase("pt-BR").includes(q));
  $("#manageCount").textContent=`${products.filter(p=>p.active!==false).length} ativos · ${products.length} cadastrados`;
  $("#manageProducts").innerHTML=list.length?list.map(p=>`<article class="product-card manage-card">
    <div class="product-avatar">${escapeHtml(initials(p.name))}</div><div class="product-info"><h3>${escapeHtml(p.name)}</h3><div class="product-meta">${p.quantity} unidade(s) · <strong>${money(p.unitPriceCents)}</strong> / un.</div>${p.active===false?'<span class="inactive-label">INATIVO</span>':""}</div>
    <div class="manage-actions"><button class="mini-action" data-edit="${p.id}" aria-label="Editar ${escapeHtml(p.name)}" title="Editar">✎</button><button class="mini-action" data-toggle="${p.id}" aria-label="${p.active===false?'Ativar':'Desativar'} ${escapeHtml(p.name)}" title="${p.active===false?'Ativar':'Desativar'}">${p.active===false?"＋":"Ⅱ"}</button></div>
  </article>`).join(""):`<div class="empty-state"><strong>Nenhum produto encontrado</strong><p>Experimente outro termo de busca.</p></div>`;
}
function renderHistory(){
  history.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $("#historyCount").textContent=history.length;
  $("#historyList").innerHTML=history.length?history.map(h=>{
    const d=new Date(h.createdAt);
    return `<article class="history-card"><div class="history-badge">✓</div><div class="history-main"><strong>Acerto · ${d.toLocaleDateString("pt-BR")}</strong><span>${d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})} · ${h.items.length} produto(s) · ${h.returnedUnits} devolvida(s)</span></div><div class="history-amount"><strong>${money(h.payableCents)}</strong><button data-detail="${h.id}">Ver detalhes ↗</button></div></article>`;
  }).join(""):`<div class="empty-state"><div class="empty-icon">◷</div><strong>Nenhum acerto salvo</strong><p>Quando finalizar uma conferência, o registro aparecerá aqui com os valores congelados.</p></div>`;
}
function openProduct(p=null){
  $("#productForm").reset();$("#productId").value=p?.id||"";$("#productDialogTitle").textContent=p?"Editar produto":"Novo produto";
  $("#productName").value=p?.name||"";$("#productQuantity").value=p?.quantity??"";$("#productPrice").value=p?(p.unitPriceCents/100).toFixed(2).replace(".",","):"";$("#productActive").checked=p?.active!==false;
  $("#productDialog").showModal();setTimeout(()=>$("#productName").focus(),100);
}
async function saveProduct(event){
  event.preventDefault();
  const id=$("#productId").value||uid(),name=$("#productName").value.trim(),quantity=Number($("#productQuantity").value),unitPriceCents=centsFromInput($("#productPrice").value),active=$("#productActive").checked;
  if(!name){toast("Informe o nome do produto.");return;}
  if(!Number.isInteger(quantity)||quantity<0){toast("A quantidade deve ser um número inteiro igual ou maior que zero.");return;}
  if(!Number.isSafeInteger(unitPriceCents)||unitPriceCents<0){toast("Informe um valor unitário válido.");return;}
  const duplicate=products.some(p=>p.id!==id&&p.name.trim().toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR"));
  if(duplicate){toast("Já existe um produto com esse nome.");return;}
  const old=products.find(p=>p.id===id);
  const product={id,name,quantity,unitPriceCents,active,createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  await Store.put("products",product);if(old)products=products.map(p=>p.id===id?product:p);else products.push(product);
  $("#productDialog").close();renderAll();toast(old?"Produto atualizado.":"Produto cadastrado.");
}
async function toggleProduct(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  p.active=p.active===false; p.updatedAt=new Date().toISOString();await Store.put("products",p);renderAll();toast(p.active?"Produto ativado.":"Produto desativado.");
}
function openFinish(){
  const ps=activeProducts(),t=totals(ps);
  $("#finishPayable").textContent=money(t.payable);$("#finishSubline").textContent=`${t.returned} unidade(s) devolvida(s) · ${t.received-t.returned} unidade(s) não devolvida(s)`;
  $("#finishBreakdown").innerHTML=`<div class="breakdown-row"><span>Valor original dos produtos</span><strong>${money(t.original)}</strong></div><div class="breakdown-row"><span>Desconto das devoluções</span><strong>− ${money(t.returnedCents)}</strong></div><div class="breakdown-row"><span>Produtos conferidos</span><strong>${ps.length}</strong></div>`;
  $("#settlementNote").value="";$("#finishDialog").showModal();
}
async function finalizeSettlement(event){
  event.preventDefault();
  const ps=activeProducts(),t=totals(ps),items=ps.map(p=>({id:p.id,name:p.name,quantityReceived:p.quantity,quantityReturned:Number(returns[p.id])||0,quantityRetained:p.quantity-(Number(returns[p.id])||0),unitPriceCents:p.unitPriceCents,originalCents:productTotal(p),returnedCents:returnedCents(p),payableCents:payableCents(p)}));
  const record={id:uid(),createdAt:new Date().toISOString(),note:$("#settlementNote").value.trim(),items,receivedUnits:t.received,returnedUnits:t.returned,originalCents:t.original,returnedCents:t.returnedCents,payableCents:t.payable};
  await Store.put("history",record);history.unshift(record);returns={};$("#finishDialog").close();renderAll();go("history");toast("Acerto salvo no histórico.");detailRecord=record;openDetail(record);
}
function openDetail(h){
  detailRecord=h;$("#detailTitle").textContent=`Acerto · ${new Date(h.createdAt).toLocaleDateString("pt-BR")}`;
  $("#detailContent").innerHTML=`<div class="finish-breakdown"><div class="breakdown-row"><span>Data e hora</span><strong>${new Date(h.createdAt).toLocaleString("pt-BR")}</strong></div><div class="breakdown-row"><span>Valor original</span><strong>${money(h.originalCents)}</strong></div><div class="breakdown-row"><span>Devoluções</span><strong>− ${money(h.returnedCents)}</strong></div>${h.note?`<div class="breakdown-row"><span>Observação</span><strong>${escapeHtml(h.note)}</strong></div>`:""}</div><div style="overflow:auto"><table class="detail-table"><thead><tr><th>Produto</th><th>Qtd. dev.</th><th>Unitário</th><th>Total</th></tr></thead><tbody>${h.items.map(i=>`<tr><td>${escapeHtml(i.name)}<br><span style="color:var(--muted)">${i.quantityRetained} não devolvida(s)</span></td><td>${i.quantityReturned}</td><td>${money(i.unitPriceCents)}</td><td>${money(i.payableCents)}</td></tr>`).join("")}</tbody></table></div><div class="detail-total"><span>TOTAL A PAGAR</span><strong>${money(h.payableCents)}</strong></div>`;
  $("#detailDialog").showModal();
}
function download(filename,content,type="application/json"){
  const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function exportBackup(){
  const backup={app:"Acerto Samba Nigth",version:1,exportedAt:new Date().toISOString(),products,history};
  download(`backup-acerto-samba-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(backup,null,2));toast("Backup exportado.");
}
async function importBackup(file){
  try{
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data.products)||!Array.isArray(data.history))throw new Error("Formato inválido");
    if(!confirm(`Restaurar ${data.products.length} produto(s) e ${data.history.length} acerto(s)? Os dados atuais com os mesmos identificadores serão substituídos.`))return;
    for(const p of data.products){if(!p.id||typeof p.name!=="string"||!Number.isInteger(p.quantity)||!Number.isInteger(p.unitPriceCents))throw new Error("Produto inválido no arquivo");await Store.put("products",p);}
    for(const h of data.history){if(!h.id||!Array.isArray(h.items))throw new Error("Registro de acerto inválido");await Store.put("history",h);}
    products=await Store.all("products");history=await Store.all("history");renderAll();toast("Backup restaurado.");
  }catch(e){alert("Não foi possível restaurar o arquivo. Verifique se ele é um backup válido do Acerto.");}
  finally{$("#importData").value="";}
}
function exportReceipt(){
  if(!detailRecord)return;
  const h=detailRecord,lines=[`ACERTO COM FORNECEDOR — SAMBA NIGTH`,`Data: ${new Date(h.createdAt).toLocaleString("pt-BR")}`,`Observação: ${h.note||"—"}`,"","Produto;Recebido;Devolvido;Não devolvido;Valor unitário;Valor a pagar",...h.items.map(i=>[i.name,i.quantityReceived,i.quantityReturned,i.quantityRetained,money(i.unitPriceCents),money(i.payableCents)].join(";")),"",`Valor original;${money(h.originalCents)}`,`Devoluções;-${money(h.returnedCents)}`,`TOTAL A PAGAR;${money(h.payableCents)}`];
  download(`acerto-fornecedor-${h.createdAt.slice(0,10)}.csv`,"\ufeff"+lines.join("\r\n"),"text/csv;charset=utf-8");toast("Resumo exportado em CSV.");
}
document.addEventListener("click",async e=>{
  const nav=e.target.closest("[data-go]");if(nav){go(nav.dataset.go);return;}
  const close=e.target.closest("[data-close]");if(close){$("#"+close.dataset.close).close();return;}
  const adjust=e.target.closest("[data-adjust]");if(adjust){const p=products.find(x=>x.id===adjust.dataset.adjust);const current=Number(returns[p.id])||0;returns[p.id]=Math.max(0,Math.min(p.quantity,current+Number(adjust.dataset.delta)));renderSettlement();renderHome();return;}
  const edit=e.target.closest("[data-edit]");if(edit){openProduct(products.find(p=>p.id===edit.dataset.edit));return;}
  const toggle=e.target.closest("[data-toggle]");if(toggle){toggleProduct(toggle.dataset.toggle);return;}
  const detail=e.target.closest("[data-detail]");if(detail){openDetail(history.find(h=>h.id===detail.dataset.detail));return;}
  const filter=e.target.closest("[data-filter]");if(filter){currentFilter=filter.dataset.filter;$$("[data-filter]").forEach(b=>b.classList.toggle("active",b===filter));renderSettlement();return;}
});
function updateSettlementTotalsOnly(){
  const ps=activeProducts(), t=totals(ps);
  $("#settlementPayable").textContent=money(t.payable);
  $("#stickyPayable").textContent=money(t.payable);
  $("#returnedUnits").textContent=`${t.returned} devolvida(s)`;
  $("#remainingUnits").textContent=`${t.received-t.returned} não devolvida(s)`;
  $("#returnProgress").style.width=(t.received?Math.min(100,t.returned/t.received*100):0)+"%";
  for(const p of ps){
    const remaining=p.quantity-(Number(returns[p.id])||0);
    const rem=$(`[data-remaining="${p.id}"]`);
    const pay=$(`[data-payable="${p.id}"]`);
    if(rem) rem.textContent=`${remaining} não devolvida(s)`;
    if(pay) pay.textContent=money(payableCents(p));
  }
  renderHome();
}
document.addEventListener("input",e=>{
  if(e.target.matches("[data-return]")){
    const input=e.target;
    const p=products.find(x=>x.id===input.dataset.return);
    if(!p)return;
    // Do not rebuild the card or replace the input while the user is typing:
    // this preserves the caret and permits any number of digits to be entered.
    const raw=input.value;
    if(raw===""){returns[p.id]=0;updateSettlementTotalsOnly();return;}
    const digits=raw.replace(/[^\d]/g,"");
    let value=digits===""?0:Number(digits);
    if(!Number.isFinite(value))value=0;
    value=Math.max(0,Math.min(p.quantity,Math.floor(value)));
    returns[p.id]=value;
    if(String(value)!==raw){
      const caret=input.selectionStart;
      input.value=String(value);
      try{input.setSelectionRange(caret,caret)}catch{}
    }
    updateSettlementTotalsOnly();
  }
});
document.addEventListener("change",e=>{
  if(e.target.matches("[data-return]")){
    const input=e.target;
    const p=products.find(x=>x.id===input.dataset.return);
    if(!p)return;
    let value=Math.max(0,Math.min(p.quantity,Math.floor(Number(input.value)||0)));
    returns[p.id]=value;
    input.value=String(value);
    updateSettlementTotalsOnly();
  }
});
$("#productSearch").addEventListener("input",renderSettlement);
$("#manageSearch").addEventListener("input",renderManage);
$("#addProductBtn").addEventListener("click",()=>openProduct());
$("#productForm").addEventListener("submit",saveProduct);
$("#finishSettlement").addEventListener("click",openFinish);
$("#finishForm").addEventListener("submit",finalizeSettlement);
$("#resetReturns").addEventListener("click",()=>{if(confirm("Zerar todas as quantidades devolvidas desta conferência?")){returns={};renderAll();toast("Devoluções zeradas.");}});
$("#exportData").addEventListener("click",exportBackup);$("#exportData2").addEventListener("click",exportBackup);
$("#importData").addEventListener("change",e=>{if(e.target.files?.[0])importBackup(e.target.files[0]);});
$("#exportReceipt").addEventListener("click",exportReceipt);
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();const view=$(".view.active");const input=view.querySelector('input[type="search"]');input?.focus();}});
init().catch(err=>{console.error(err);toast("Erro ao carregar os dados locais.");});
