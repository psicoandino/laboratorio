
(function(){
"use strict";

const C=window.TUCONTU_CORE;
const STORAGE="tucontu.web";
const LEGACY_KEYS=["tucontu.oneshot.v1","tucontu.web.v1.1"];
const main=document.getElementById("main");
const library=document.getElementById("library");
const modalRoot=document.getElementById("modalRoot");

let state=loadState();
let view=state.products.length?"archive":"intro";
let editorPane="pieza";
let detailMode="summary";
let draft=newDraft();
let editingId=null;
let detailId=null;

let piecePage=0;
let libKind="cords",libPage=0;
let cordPage=0,groupPage=0,groupSelected=new Set();
let finishGroupIndex=0,wrapPage=0,packagingPage=0;
let detailGroupIndex=0,detailGroupPage=0;
let archiveSelectedId=null;
let commercialSim=null;

function deep(x){return JSON.parse(JSON.stringify(x));}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function money(v){if(v===null||v===undefined||!Number.isFinite(Number(v)))return"—";return new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(v);}
function num(v,d=2){if(v===null||v===undefined||!Number.isFinite(Number(v)))return"—";return new Intl.NumberFormat("es-CL",{maximumFractionDigits:d}).format(v);}
function qualityLabel(q){return({measured:"medido",custom:"personalizado",estimated:"estimado",unknown:"desconocido"})[q]||q;}
function badge(q){return`<span class="badge ${q}">${qualityLabel(q)}</span>`;}
function kindLabel(n){return C.groupKindLabel(Number(n));}
function targetMargin(){
  const m=Number(state?.settings?.defaultTargetMargin);
  return Number.isFinite(m)&&m>=0&&m<.95?m:.50;
}
function priceRounding(){
  const n=Number(state?.settings?.priceRounding);
  return Number.isFinite(n)&&n>0?n:100;
}
function commercialCost(r){
  return {
    value:r.readyToSellComplete?r.readyToSellCost:r.knownReadyToSellCost,
    complete:!!r.readyToSellComplete
  };
}
function priceSuggestion(r){
  const c=commercialCost(r);
  if(!c.complete||c.value===null||c.value<=0)return null;
  return C.suggestedPrice(c.value,targetMargin(),priceRounding());
}
function commercialDisplay(r,product=null){
  if(commercialSim&&product&&commercialSim.productId===product.id){
    return {
      price:commercialSim.price,
      profit:commercialSim.profit,
      margin:commercialSim.margin,
      priceLabel:"Precio · prueba",
      simulated:true
    };
  }
  if(r.price!==null){
    return {price:r.price,profit:r.profit,margin:r.margin,priceLabel:"Precio",simulated:false};
  }
  const suggested=priceSuggestion(r);
  if(suggested!==null){
    const c=commercialCost(r).value;
    return {
      price:suggested,
      profit:C.profitForPrice(c,suggested),
      margin:C.marginForPrice(c,suggested),
      priceLabel:"Precio sugerido",
      simulated:false,
      suggested:true
    };
  }
  return {price:null,profit:null,margin:null,priceLabel:"Precio",simulated:false};
}
function beginCommercialSimulation(productId){
  const p=state.products.find(x=>x.id===productId);if(!p)return;
  const r=C.costProduct(state,p),c=commercialCost(r);
  if(c.value===null)return;
  let price=p.price;
  if(price===null){
    price=c.complete?priceSuggestion(r):C.priceForMargin(c.value,targetMargin());
  }
  if(price===null)price=0;
  const margin=C.marginForPrice(c.value,price);
  commercialSim={
    productId:p.id,
    cost:c.value,
    costComplete:c.complete,
    price:Math.max(0,Math.round(price)),
    margin:margin,
    profit:C.profitForPrice(c.value,price),
    authority:p.price===null?"margin":"price"
  };
  archiveSelectedId=p.id;
  renderArchive();
}
function updateCommercialSimFromPrice(value){
  if(!commercialSim)return;
  const p=Math.max(0,Number(value)||0);
  commercialSim.price=p;
  commercialSim.margin=C.marginForPrice(commercialSim.cost,p);
  commercialSim.profit=C.profitForPrice(commercialSim.cost,p);
  commercialSim.authority="price";
  updateCommercialSimDom();
}
function updateCommercialSimFromMargin(percent){
  if(!commercialSim)return;
  const m=Math.max(0,Math.min(.85,(Number(percent)||0)/100));
  const p=C.priceForMargin(commercialSim.cost,m);
  commercialSim.price=p===null?0:Math.max(0,C.roundCommercialPrice(p,priceRounding()));
  commercialSim.margin=C.marginForPrice(commercialSim.cost,commercialSim.price);
  commercialSim.profit=C.profitForPrice(commercialSim.cost,commercialSim.price);
  commercialSim.authority="margin";
  updateCommercialSimDom();
}
function updateCommercialSimDom(){
  if(!commercialSim)return;
  const priceOut=document.getElementById("simPriceOut");
  const marginOut=document.getElementById("simMarginOut");
  const profitOut=document.getElementById("simProfitOut");
  const priceRange=document.getElementById("simPriceRange");
  const marginRange=document.getElementById("simMarginRange");
  if(priceOut)priceOut.textContent=money(commercialSim.price);
  if(marginOut)marginOut.textContent=commercialSim.margin===null?"—":num(commercialSim.margin*100,1)+"%";
  if(profitOut)profitOut.textContent=money(commercialSim.profit);
  if(priceRange)priceRange.value=String(Math.round(commercialSim.price));
  if(marginRange&&commercialSim.margin!==null){
    marginRange.value=String(Math.max(0,Math.min(85,commercialSim.margin*100)));
  }
  renderArchiveValueBar();
}

function loadState(){
  let raw=localStorage.getItem(STORAGE);
  if(!raw)for(const k of LEGACY_KEYS){const v=localStorage.getItem(k);if(v){raw=v;break;}}
  if(!raw)return C.defaultState();
  try{
    const migrated=C.migrateState(JSON.parse(raw));
    localStorage.setItem(STORAGE,JSON.stringify(migrated));
    return migrated;
  }catch(e){console.warn(e);return C.defaultState();}
}
function saveState(){
  state.schema=C.DATA_SCHEMA;state.coreVersion=C.VERSION;
  localStorage.setItem(STORAGE,JSON.stringify(state));
  renderLibrary();
}
function newDraft(){
  return{
    id:C.uid("product"),name:"",createdAt:C.today(),
    sizeKey:"M",customLengthM:null,cordCount:9,coletId:null,
    cords:[],groups:[],
    minutes:null,hourlyRate:state?.settings?.hourlyRate??null,extraWorkPct:0,
    cordWastePct:state?.settings?.defaultCordWastePct??0,
    wrapWastePct:state?.settings?.defaultWrapWastePct??0,
    packaging:{templateId:null,items:[],laborMode:"none",minutes:null},
    price:null
  };
}
function material(kind,id){return(state.materials[kind]||[]).find(m=>m.id===id)||null;}
function baseLengthM(p){return p.sizeKey==="X"?p.customLengthM:state.settings.sizeLengthsM[p.sizeKey];}
function unitCostText(m,unit){
  const c=C.deriveUnitCost(m?.cost);
  return c.value===null?"Costo no informado":`${money(c.value)} / ${unit}`;
}
function productStatus(r){
  if(!r.complete){const n=r.unknowns.length;return{quality:"unknown",text:n===1?"1 dato por completar":`${n} datos por completar`};}
  if(r.quality==="estimated")return{quality:"estimated",text:"estimación completa"};
  if(r.quality==="measured")return{quality:"measured",text:"datos medidos"};
  return{quality:"custom",text:"cálculo completo"};
}
function mergeSnapshot(existing,fresh){
  if(!existing)return fresh;
  const out=deep(existing);
  for(const kind of["colets","cords","wraps","packaging"]){
    out[kind]=out[kind]||{};
    for(const[id,v]of Object.entries(fresh[kind]||{}))if(!out[kind][id])out[kind][id]=v;
  }
  return out;
}
function freezeCostsForSave(product,previous=null){
  const fresh=C.snapshotProductCosts(state,product,{capturedAt:product.createdAt||C.today()});
  const next=deep(product);next.costSnapshot=mergeSnapshot(previous?.costSnapshot||null,fresh);return next;
}
function previewProduct(){
  const prev=editingId?state.products.find(p=>p.id===editingId):null;
  return editingId?freezeCostsForSave(draft,prev):C.withCostSnapshot(state,draft,{capturedAt:draft.createdAt});
}
function previewCost(){return C.costProduct(state,previewProduct());}
function ensureCordInstances(){
  while(draft.cords.length<draft.cordCount)draft.cords.push({materialId:null,thicknessMm:null});
  draft.cords=draft.cords.slice(0,draft.cordCount);
}
function ensurePackaging(){
  if(!draft.packaging)draft.packaging={templateId:null,items:[],laborMode:"none",minutes:null};
  if(!Array.isArray(draft.packaging.items))draft.packaging.items=[];
}
function usedCordIndexes(){return new Set((draft.groups||[]).flatMap(g=>g.cordIndexes||[]));}

function render(){renderMain();renderLibrary();}
function renderMain(){
  if(view==="intro")renderIntro();
  else if(view==="editor")renderEditor();
  else if(view==="detail")renderDetail();
  else renderArchive();
}

function startNew(){
  draft=newDraft();editingId=null;editorPane="pieza";cordPage=0;groupPage=0;groupSelected.clear();finishGroupIndex=0;wrapPage=0;packagingPage=0;
  view="editor";renderMain();
}
function editProduct(id,pane="pieza"){
  const p=state.products.find(x=>x.id===id);if(!p)return;
  draft=deep(p);ensurePackaging();editingId=id;editorPane=pane;
  cordPage=0;groupPage=0;groupSelected.clear();finishGroupIndex=0;wrapPage=0;packagingPage=0;
  view="editor";renderMain();
}
function saveDraft(){
  draft.name=(draft.name||"").trim()||"TuconTu";
  if(draft.hourlyRate!==null)state.settings.hourlyRate=draft.hourlyRate;
  if(editingId){
    const i=state.products.findIndex(p=>p.id===editingId);
    const previous=state.products[i];
    state.products[i]=freezeCostsForSave(draft,previous);
    detailId=editingId;
  }else{
    const frozen=C.withCostSnapshot(state,draft,{capturedAt:draft.createdAt});
    state.products.push(frozen);detailId=frozen.id;
  }
  saveState();editingId=null;detailMode="summary";view="detail";renderMain();
}

function renderIntro(){
  main.innerHTML=`
  <div class="screen single">
    <div class="hero">
      <section class="hero-copy">
        <div class="kicker">TUCONTU · Web v1.5</div>
        <h1>Una mesa para<br>cada pieza.</h1>
        <p class="lead">Construye, conoce el costo y deja cada TuconTu listo para vender sin convertir el trabajo artesanal en administración.</p>
        <div class="axiom">Un dato desconocido jamás rompe el flujo.<br>Sólo cambia la calidad de la estimación.</div>
        <div><button id="start" class="primary">Crear mi primer TuconTu</button></div>
      </section>
      <aside class="hero-side">
        <div class="card">
          <div class="kicker">Tres lugares</div>
          <div class="hero-list">
            <div class="hero-item"><div class="hero-num">1</div><div><strong>Mis TuconTu</strong><div class="help">Tu archivo de piezas.</div></div></div>
            <div class="hero-item"><div class="hero-num">2</div><div><strong>La mesa</strong><div class="help">Crear y editar sin un recorrido obligatorio.</div></div></div>
            <div class="hero-item"><div class="hero-num">3</div><div><strong>La ficha</strong><div class="help">Qué hiciste, cuánto costó y cómo se vende.</div></div></div>
          </div>
        </div>
      </aside>
    </div>
  </div>`;
  document.getElementById("start").onclick=startNew;
}

function renderArchive(){
  const per=4,pages=Math.max(1,Math.ceil(state.products.length/per));
  piecePage=Math.max(0,Math.min(piecePage,pages-1));
  const items=state.products.slice(piecePage*per,piecePage*per+per);

  if(items.length && !items.some(p=>p.id===archiveSelectedId)){
    archiveSelectedId=items[0].id;
    if(commercialSim && commercialSim.productId!==archiveSelectedId) commercialSim=null;
  }

  const rightHead=items.length?`
    <div class="archive-head-right">
      <div class="meta">${state.products.length} pieza${state.products.length===1?"":"s"}</div>
      ${pages>1?`<div class="pager"><button id="piecePrev" ${piecePage===0?"disabled":""}>‹</button><div class="page-label">${piecePage+1}/${pages}</div><button id="pieceNext" ${piecePage===pages-1?"disabled":""}>›</button></div>`:""}
    </div>`:"";

  main.innerHTML=`
  <div class="screen ${items.length?"archive-screen":"no-footer"}">
    <div class="screen-head">
      <div><div class="kicker">Archivo</div><h1>Mis TuconTu</h1><p class="lead">Costo, precio y margen pueden revisarse sin abrir la pieza.</p></div>
      ${rightHead}
    </div>
    <div class="body-area">
      ${items.length?`<div class="archive-grid">
        ${items.map(p=>{
          const r=C.costProduct(state,p),s=productStatus(r),ready=r.readyToSellCost??r.knownReadyToSellCost;
          const display=commercialDisplay(r,p);
          const isSim=commercialSim&&commercialSim.productId===p.id;
          const selected=archiveSelectedId===p.id;
          const suggestion=p.price===null&&priceSuggestion(r)!==null;
          if(isSim){
            const maxPrice=Math.max(
              priceRounding()*10,
              Math.ceil(Math.max(commercialSim.cost*4,commercialSim.price*1.8,10000)/priceRounding())*priceRounding()
            );
            const marginPct=commercialSim.margin===null?0:Math.max(0,Math.min(85,commercialSim.margin*100));
            return`<article class="card piece piece-simulating ${selected?"selected":""}" data-piece="${p.id}">
              <div class="piece-head"><div><h3>${esc(p.name)}</h3><div class="meta">${commercialSim.costComplete?"Costo listo":"Sobre costo conocido"} · ${money(commercialSim.cost)}</div></div><span class="badge custom">prueba</span></div>
              <div class="simulator">
                <div class="sim-line"><span>Precio</span><strong id="simPriceOut">${money(commercialSim.price)}</strong></div>
                <input id="simPriceRange" class="commercial-range" type="range" min="0" max="${maxPrice}" step="${priceRounding()}" value="${Math.round(commercialSim.price)}" aria-label="Ajustar precio">
                <div class="sim-line"><span>Margen</span><strong id="simMarginOut">${commercialSim.margin===null?"—":num(commercialSim.margin*100,1)+"%"}</strong></div>
                <input id="simMarginRange" class="commercial-range" type="range" min="0" max="85" step=".1" value="${marginPct}" aria-label="Ajustar margen">
                <div class="sim-profit">Ganancia <strong id="simProfitOut">${money(commercialSim.profit)}</strong></div>
              </div>
              <div class="sim-actions">
                <button class="primary" id="useSimPrice">Usar este precio</button>
                <button class="secondary" id="cancelSim">Cancelar</button>
              </div>
            </article>`;
          }
          return`<article class="card piece ${selected?"selected":""}" data-piece="${p.id}">
            <div class="piece-head"><div><h3>${esc(p.name)}</h3><div class="meta">${p.cordCount} cordones · ${p.groups.map(g=>kindLabel(g.cordIndexes.length)).join(" · ")||"sin agrupación"}</div></div>${badge(s.quality)}</div>
            <div class="statusline"><span class="dot ${s.quality}"></span>${s.text}</div>
            <div class="piece-metrics">
              <div class="mini-metric"><span>${r.readyToSellComplete?"Listo para vender":"Costo conocido"}</span><strong>${money(ready)}</strong></div>
              <div class="mini-metric"><span>${display.priceLabel}</span><strong>${display.price===null?"—":money(display.price)}</strong>${suggestion?`<small>margen habitual ${num(targetMargin()*100,0)}%</small>`:""}</div>
              <div class="mini-metric"><span>Margen</span><strong>${display.margin===null?"—":num(display.margin*100,1)+"%"}</strong></div>
            </div>
            <div class="action-group">
              <button class="primary" data-adjust="${p.id}">Ajustar precio</button>
              <button class="secondary" data-open="${p.id}">Ficha</button>
              <button class="text-btn small" data-edit="${p.id}">Editar</button>
            </div>
          </article>`;
        }).join("")}
      </div>`:`<div class="card" style="height:100%;display:grid;place-items:center"><div style="text-align:center;max-width:430px"><h2>Todavía no hay piezas.</h2><p class="help">La primera pieza crea también los materiales que necesites.</p><button id="emptyNew" class="primary">Crear TuconTu</button></div></div>`}
    </div>
    ${items.length?`<div id="archiveValueHost"></div>`:""}
  </div>`;

  const en=document.getElementById("emptyNew");if(en)en.onclick=startNew;

  main.querySelectorAll("[data-piece]").forEach(card=>card.addEventListener("click",e=>{
    if(e.target.closest("button,input"))return;
    const id=card.dataset.piece;
    if(id&&id!==archiveSelectedId){archiveSelectedId=id;commercialSim=null;renderArchive();}
  }));

  main.querySelectorAll("[data-adjust]").forEach(b=>b.onclick=()=>beginCommercialSimulation(b.dataset.adjust));
  main.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{archiveSelectedId=b.dataset.open;commercialSim=null;detailId=b.dataset.open;detailMode="summary";detailGroupIndex=0;view="detail";renderMain();});
  main.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{archiveSelectedId=b.dataset.edit;commercialSim=null;editProduct(b.dataset.edit);});

  const priceRange=document.getElementById("simPriceRange");
  const marginRange=document.getElementById("simMarginRange");
  if(priceRange)priceRange.oninput=e=>updateCommercialSimFromPrice(e.target.value);
  if(marginRange)marginRange.oninput=e=>updateCommercialSimFromMargin(e.target.value);

  const use=document.getElementById("useSimPrice");
  if(use)use.onclick=()=>{
    const p=state.products.find(x=>x.id===commercialSim.productId);
    if(p){p.price=Math.max(0,Math.round(commercialSim.price));saveState();}
    commercialSim=null;renderArchive();
  };
  const cancel=document.getElementById("cancelSim");
  if(cancel)cancel.onclick=()=>{commercialSim=null;renderArchive();};

  const pp=document.getElementById("piecePrev"),pn=document.getElementById("pieceNext");
  if(pp)pp.onclick=()=>{piecePage--;commercialSim=null;archiveSelectedId=null;renderArchive();};
  if(pn)pn.onclick=()=>{piecePage++;commercialSim=null;archiveSelectedId=null;renderArchive();};

  renderArchiveValueBar();
}

function renderArchiveValueBar(){
  const host=document.getElementById("archiveValueHost");if(!host)return;
  const p=state.products.find(x=>x.id===archiveSelectedId);
  if(!p){host.innerHTML="";return;}
  const r=C.costProduct(state,p);
  host.innerHTML=valueStrip(r,commercialDisplay(r,p),p.name);
  bindPending(host,r);
}

function valueStrip(r,commercial=null,contextName=""){
  const manufacture=r.manufacturingCost??r.manufacturingKnownCost;
  const pack=r.packagingCost??r.packagingKnownCost;
  const ready=r.readyToSellCost??r.knownReadyToSellCost;
  const status=productStatus(r);
  const c=commercial||{price:r.price,profit:r.profit,margin:r.margin,priceLabel:"Precio",simulated:false};
  return`
  <div class="valuebar ${c.simulated?"simulated":""}">
    <div class="value"><span>${r.manufacturingComplete?"Fabricación":"Fabricación conocida"}</span><strong>${money(manufacture)}</strong></div>
    <div class="value"><span>${r.packagingComplete?"Empaque":"Empaque conocido"}</span><strong>${money(pack)}</strong></div>
    <div class="value"><span>${r.readyToSellComplete?"Listo para vender":"Conocido hasta ahora"}</span><strong>${money(ready)}</strong></div>
    <div class="value"><span>${c.priceLabel||"Precio"}</span><strong>${c.price===null?"—":money(c.price)}</strong></div>
    <div class="value"><span>Ganancia</span><strong>${c.profit===null?"—":money(c.profit)}</strong></div>
    <div class="value"><span>Margen</span><strong>${c.margin===null?"—":num(c.margin*100,1)+"%"}</strong></div>
    <div class="value-status"><button data-pending title="${contextName?esc(contextName):"Estado"}">${c.simulated?"simulando":status.text}</button></div>
  </div>`;
}

function refreshValueStrip(){
  const host=document.getElementById("valueHost");if(!host)return;
  const r=previewCost();host.innerHTML=valueStrip(r);
  bindPending(host,r);
}
function bindPending(host,r){
  const b=host.querySelector("[data-pending]");
  if(b)b.onclick=()=>openPending(r.unknowns);
}

function renderEditor(){
  ensurePackaging();ensureCordInstances();
  main.innerHTML=`
  <div class="editor">
    <div class="editor-head">
      <div class="editor-title">
        <div><div class="kicker">${editingId?"Editar":"Mesa"}</div><div class="meta">TUCONTU</div></div>
        <input id="editorName" class="name-inline" value="${esc(draft.name)}" placeholder="Nombre de la pieza">
      </div>
      <div class="action-group"><button id="cancelEditor" class="secondary">${editingId?"Cancelar":"Salir"}</button><button id="saveEditor" class="primary">Guardar</button></div>
    </div>
    <nav class="editor-nav">
      ${[["pieza","Pieza"],["construccion","Construcción"],["acabado","Acabado"],["venta","Venta"]].map(([k,t])=>`<button class="editor-tab ${editorPane===k?"active":""}" data-pane="${k}">${t}</button>`).join("")}
    </nav>
    <div id="editorBody" class="editor-body"></div>
    <div id="valueHost">${valueStrip(previewCost())}</div>
  </div>`;
  document.getElementById("editorName").oninput=e=>{draft.name=e.target.value;};
  document.getElementById("saveEditor").onclick=saveDraft;
  document.getElementById("cancelEditor").onclick=()=>{
    if(editingId){detailId=editingId;detailMode="summary";view="detail";}else view=state.products.length?"archive":"intro";
    renderMain();
  };
  main.querySelectorAll("[data-pane]").forEach(b=>b.onclick=()=>{editorPane=b.dataset.pane;renderEditor();});
  bindPending(document.getElementById("valueHost"),previewCost());
  renderEditorPane();
}

function renderEditorPane(){
  const host=document.getElementById("editorBody");
  if(editorPane==="pieza")panePiece(host);
  else if(editorPane==="construccion")paneBuild(host);
  else if(editorPane==="acabado")paneFinish(host);
  else paneSale(host);
}

function panePiece(host){
  const r=state.settings.lengthRules||C.DEFAULT_LENGTH_RULES;
  const colets=state.materials.colets||[];
  host.innerHTML=`
  <div class="pane pane-grid">
    <section class="card pane-card">
      <div class="section-head"><div><div class="kicker">Base</div><h3>Largo y cantidad</h3></div></div>
      <div class="grid4">
        ${[["S","Pequeño","30 cm"],["M","Mediano","60 cm"],["L","Grande","80 cm"],["X","Otro","manual"]].map(([k,n,l])=>`<button class="choice ${draft.sizeKey===k?"active":""}" data-size="${k}"><strong>${n}</strong><small>${l}</small></button>`).join("")}
      </div>
      <div class="grid2">
        <div id="customLength" class="field ${draft.sizeKey==="X"?"":"hidden"}"><label>Largo · cm</label><input id="customCm" type="number" min="1" value="${draft.customLengthM?draft.customLengthM*100:""}" placeholder="No sé todavía"></div>
        <div class="field"><label>Cantidad de cordones</label><input id="cordCount" type="number" min="1" max="9" value="${draft.cordCount}"></div>
      </div>
      <div>
        <div class="section-head"><div><div class="kicker">Reglas actuales</div><div class="help">De cada 30 cm iniciales quedan, en promedio:</div></div><button id="editRules" class="text-btn small">Cambiar</button></div>
        <div class="base-rules">
          <div class="rule-chip"><strong>Cordón suelto</strong>${num(r.looseFinalCm,1)} cm</div>
          <div class="rule-chip"><strong>Espiral</strong>${num(r.spiralFinalCm,1)} cm</div>
          <div class="rule-chip"><strong>Trenza</strong>${num(r.braidFinalCm,1)} cm</div>
        </div>
      </div>
    </section>

    <section class="card pane-card center">
      <div><div class="kicker">Colet</div><h3>El soporte de esta pieza</h3></div>
      ${colets.length?`
        <div class="field"><label>Colet</label><select id="coletSelect"><option value="">Elegir...</option>${colets.map(m=>`<option value="${m.id}" ${draft.coletId===m.id?"selected":""}>${esc(m.name)} · ${unitCostText(m,"un")}</option>`).join("")}</select></div>
        <div class="help">Puedes editar su costo en “Tus materiales”, a la derecha.</div>
      `:`<div class="note">Todavía no tienes colets. Puedes crear el primero sin salir de esta pieza.</div><button id="createColet" class="primary">+ Crear colet</button>`}
    </section>
  </div>`;

  host.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{
    draft.sizeKey=b.dataset.size;
    if(draft.sizeKey!=="X")draft.customLengthM=null;
    panePiece(host);refreshValueStrip();
  });
  const cc=document.getElementById("customCm");if(cc)cc.oninput=e=>{draft.customLengthM=e.target.value===""?null:Number(e.target.value)/100;refreshValueStrip();};
  document.getElementById("cordCount").onchange=e=>{
    const old=draft.cordCount,n=Math.max(1,Math.min(9,Number(e.target.value)||old));
    if(n===old)return;
    if((draft.cords.length||draft.groups.length)&&!confirm("Cambiar la cantidad reinicia los cordones y grupos de esta pieza. ¿Continuar?")){e.target.value=old;return;}
    draft.cordCount=n;draft.cords=[];draft.groups=[];cordPage=0;groupPage=0;groupSelected.clear();ensureCordInstances();refreshValueStrip();
  };
  const cs=document.getElementById("coletSelect");if(cs)cs.onchange=e=>{draft.coletId=e.target.value||null;refreshValueStrip();};
  const create=document.getElementById("createColet");if(create)create.onclick=()=>openMaterialModal("colets",null,m=>{draft.coletId=m.id;renderEditor();});
  document.getElementById("editRules").onclick=openSettings;
}

function paneBuild(host){
  ensureCordInstances();
  const cordMaterials=state.materials.cords||[];
  const per=4,pages=Math.max(1,Math.ceil(draft.cordCount/per));cordPage=Math.max(0,Math.min(cordPage,pages-1));
  const start=cordPage*per,slice=draft.cords.slice(start,start+per);
  const used=usedCordIndexes();
  const groupsPer=4,gpages=Math.max(1,Math.ceil(draft.groups.length/groupsPer));groupPage=Math.max(0,Math.min(groupPage,gpages-1));
  const groupSlice=draft.groups.slice(groupPage*groupsPer,groupPage*groupsPer+groupsPer);

  host.innerHTML=`
  <div class="pane pane-grid">
    <section class="card pane-card cord-panel">
      <div class="section-head">
        <div><div class="kicker">Cordones</div><h3>${draft.cordCount} cordones concretos</h3></div>
        ${cordMaterials.length?`<select id="sameCord" style="width:190px"><option value="">Usar el mismo en todos…</option>${cordMaterials.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join("")}</select>`:""}
      </div>
      ${cordMaterials.length?`
      <div class="cord-list">
        ${slice.map((ci,j)=>{const i=start+j;return`<div class="cord-row">
          <div class="cord-num">${i+1}</div>
          <div class="cord-fields">
            <select data-cord="${i}"><option value="">Elegir cordón…</option>${cordMaterials.map(m=>`<option value="${m.id}" ${ci.materialId===m.id?"selected":""}>${esc(m.name)}</option>`).join("")}</select>
            <input data-thick="${i}" type="number" min="0" step=".1" value="${ci.thicknessMm??""}" placeholder="mm · no sé">
          </div>
        </div>`;}).join("")}
        ${Array.from({length:Math.max(0,4-slice.length)},()=>'<div class="cord-row" style="visibility:hidden"></div>').join("")}
      </div>
      <div class="actions"><div class="help">El grosor puede quedar desconocido.</div>${pages>1?`<div class="pager"><button id="cordPrev" ${cordPage===0?"disabled":""}>‹</button><div class="page-label">${cordPage+1}/${pages}</div><button id="cordNext" ${cordPage===pages-1?"disabled":""}>›</button></div>`:""}</div>
      `:`<div class="note">Primero crea un cordón. Después podrás reutilizarlo o mezclar cordones distintos.</div><button id="createCord" class="primary">+ Crear cordón</button>`}
    </section>

    <section class="card pane-card group-compose">
      <div class="section-head"><div><div class="kicker">Agrupar</div><h3>Forma la pieza</h3></div><div class="help">${groupSelected.size?`${groupSelected.size} → ${kindLabel(groupSelected.size)}`:"Selecciona cordones"}</div></div>
      <div class="token-grid">
        ${draft.cords.map((ci,i)=>{const m=material("cords",ci.materialId);return`<button class="cord-token ${used.has(i)?"used":""} ${groupSelected.has(i)?"selected":""}" data-token="${i}" ${used.has(i)?"disabled":""}><strong>#${i+1} ${esc(m?.name||"sin material")}</strong><small>${ci.thicknessMm??m?.thicknessMm?num(ci.thicknessMm??m?.thicknessMm)+" mm":"grosor —"}</small></button>`;}).join("")}
      </div>
      <div class="group-list">
        ${groupSlice.map((g,j)=>{const gi=groupPage*groupsPer+j;return`<div class="group-row"><div><strong>${kindLabel(g.cordIndexes.length)} · ${g.cordIndexes.length}</strong><small>${g.cordIndexes.map(i=>"#"+(i+1)).join(" · ")}</small></div><button class="icon" data-delgroup="${gi}">×</button></div>`;}).join("")}
        ${Array.from({length:Math.max(0,4-groupSlice.length)},()=>'<div class="group-row" style="visibility:hidden"></div>').join("")}
      </div>
      <div class="actions">
        ${gpages>1?`<div class="pager"><button id="groupPrev" ${groupPage===0?"disabled":""}>‹</button><div class="page-label">${groupPage+1}/${gpages}</div><button id="groupNext" ${groupPage===gpages-1?"disabled":""}>›</button></div>`:"<div></div>"}
        <button id="makeGroup" class="primary" ${groupSelected.size?"":"disabled"}>Crear ${groupSelected.size?kindLabel(groupSelected.size):"grupo"}</button>
      </div>
    </section>
  </div>`;

  if(cordMaterials.length){
    host.querySelectorAll("[data-cord]").forEach(el=>el.onchange=e=>{
      const i=Number(el.dataset.cord);draft.cords[i].materialId=e.target.value||null;
      const m=material("cords",draft.cords[i].materialId);
      if(draft.cords[i].thicknessMm===null&&m?.thicknessMm)draft.cords[i].thicknessMm=m.thicknessMm;
      refreshValueStrip();
    });
    host.querySelectorAll("[data-thick]").forEach(el=>el.oninput=e=>{draft.cords[Number(el.dataset.thick)].thicknessMm=e.target.value===""?null:Number(e.target.value);refreshValueStrip();});
    const same=document.getElementById("sameCord");if(same)same.onchange=e=>{
      const id=e.target.value;if(!id)return;const m=material("cords",id);
      draft.cords.forEach(c=>{c.materialId=id;if(c.thicknessMm===null&&m?.thicknessMm)c.thicknessMm=m.thicknessMm;});
      renderEditor();
    };
    const cp=document.getElementById("cordPrev"),cn=document.getElementById("cordNext");
    if(cp)cp.onclick=()=>{cordPage--;renderEditor();};if(cn)cn.onclick=()=>{cordPage++;renderEditor();};
  }else{
    document.getElementById("createCord").onclick=()=>openMaterialModal("cords",null,m=>{draft.cords[0].materialId=m.id;renderEditor();});
  }

  host.querySelectorAll("[data-token]").forEach(b=>b.onclick=()=>{
    const i=Number(b.dataset.token);if(groupSelected.has(i))groupSelected.delete(i);else groupSelected.add(i);renderEditor();
  });
  host.querySelectorAll("[data-delgroup]").forEach(b=>b.onclick=()=>{draft.groups.splice(Number(b.dataset.delgroup),1);groupSelected.clear();renderEditor();});
  document.getElementById("makeGroup").onclick=()=>{
    const idx=[...groupSelected].sort((a,b)=>a-b);if(!idx.length)return;
    draft.groups.push({id:C.uid("group"),size:idx.length,cordIndexes:idx,measuredFinalLengthM:null,customFinalLengthM:null,wraps:[]});
    groupSelected.clear();groupPage=Math.floor((draft.groups.length-1)/groupsPer);renderEditor();
  };
  const gp=document.getElementById("groupPrev"),gn=document.getElementById("groupNext");
  if(gp)gp.onclick=()=>{groupPage--;renderEditor();};if(gn)gn.onclick=()=>{groupPage++;renderEditor();};
}

function paneFinish(host){
  ensurePackaging();
  const preview=previewCost();
  finishGroupIndex=Math.max(0,Math.min(finishGroupIndex,Math.max(0,draft.groups.length-1)));
  const g=draft.groups[finishGroupIndex]||null;
  const groupResult=preview.groups[finishGroupIndex]||null;

  const wraps=g?.wraps||[],wrPer=3,wrPages=Math.max(1,Math.ceil(wraps.length/wrPer));wrapPage=Math.max(0,Math.min(wrapPage,wrPages-1));
  const wrapSlice=wraps.slice(wrapPage*wrPer,wrapPage*wrPer+wrPer);

  const p=draft.packaging,items=p.items||[],pkPer=3,pkPages=Math.max(1,Math.ceil(items.length/pkPer));packagingPage=Math.max(0,Math.min(packagingPage,pkPages-1));
  const packSlice=items.slice(packagingPage*pkPer,packagingPage*pkPer+pkPer);
  const templates=state.packagingTemplates||[];

  host.innerHTML=`
  <div class="pane pane-grid">
    <section class="card finish-card">
      <div class="section-head">
        <div><div class="kicker">Embarrilado</div><h3>${g?kindLabel(g.cordIndexes.length):"Sin grupos"}</h3></div>
        ${draft.groups.length?`<select id="finishGroupSelect" style="width:190px">${draft.groups.map((x,i)=>`<option value="${i}" ${i===finishGroupIndex?"selected":""}>${i+1} · ${kindLabel(x.cordIndexes.length)}</option>`).join("")}</select>`:""}
      </div>
      ${g?`
        <div class="grid2">
          <div class="field"><label>Largo final medido · cm</label><input id="measuredLength" type="number" min="0" step=".1" value="${g.measuredFinalLengthM!==null?g.measuredFinalLengthM*100:""}" placeholder="${groupResult?.length?.valueM!==null?"estimado "+num(groupResult.length.valueM*100,1):"no sé todavía"}"></div>
          <div><div class="help">Largo actual</div><strong>${groupResult?.length?.valueM!==null?num(groupResult.length.valueM*100,1)+" cm":"—"}</strong> ${groupResult?badge(groupResult.length.quality):""}</div>
        </div>
        <div class="item-list">
          ${wrapSlice.map((w,j)=>{const wi=wrapPage*wrPer+j,m=material("wraps",w.materialId);return`<div class="item-row"><div><strong>${esc(m?.name||"Material")}</strong><small>${unitCostText(m,"m")}</small></div><div class="item-controls"><input data-wrapmeters="${wi}" type="number" min="0" step=".01" value="${w.meters??""}" placeholder="metros"><select data-wrapsrc="${wi}"><option value="custom" ${w.source!=="measured"?"selected":""}>aprox.</option><option value="measured" ${w.source==="measured"?"selected":""}>medido</option></select><button class="icon" data-delwrap="${wi}">×</button></div></div>`;}).join("")}
          ${Array.from({length:Math.max(0,3-wrapSlice.length)},()=>'<div class="item-row" style="visibility:hidden"></div>').join("")}
        </div>
        <div class="actions">
          <div class="action-group"><button id="addWrap" class="secondary">+ Material</button><button id="noWrap" class="text-btn small">Sin embarrilado</button></div>
          ${wrPages>1?`<div class="pager"><button id="wrapPrev" ${wrapPage===0?"disabled":""}>‹</button><div class="page-label">${wrapPage+1}/${wrPages}</div><button id="wrapNext" ${wrapPage===wrPages-1?"disabled":""}>›</button></div>`:""}
        </div>
      `:`<div class="note">El embarrilado se define por grupo. Primero forma al menos un Cordón suelto, Espiral o Trenza en Construcción.</div>`}
    </section>

    <section class="card finish-card">
      <div class="section-head">
        <div><div class="kicker">Empaque</div><h3>Listo para entregar</h3></div>
        <select id="packageTemplate" style="width:190px"><option value="">Sin plantilla</option>${templates.map(t=>`<option value="${t.id}" ${p.templateId===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select>
      </div>
      <div class="item-list">
        ${packSlice.map((it,j)=>{const i=packagingPage*pkPer+j,m=material("packaging",it.materialId);return`<div class="item-row"><div><strong>${esc(m?.name||"Componente")}</strong><small>${unitCostText(m,m?.unit||it.unit||"un")}</small></div><div class="item-controls pack"><input data-packqty="${i}" type="number" min="0" step=".01" value="${it.quantity??1}" placeholder="cantidad"><button class="icon" data-delpack="${i}">×</button></div></div>`;}).join("")}
        ${Array.from({length:Math.max(0,3-packSlice.length)},()=>'<div class="item-row" style="visibility:hidden"></div>').join("")}
      </div>
      <div class="grid2">
        <div class="field"><label>Tiempo de empaque · min</label><input id="packMinutes" type="number" min="0" value="${p.laborMode==="minutes"?(p.minutes??""):""}" placeholder="No considerar"></div>
        <div class="field"><label>Acciones</label><div class="action-group"><button id="addPackageItem" class="secondary">+ Componente</button><button id="savePackageTpl" class="soft" ${items.length?"":"disabled"}>Guardar habitual</button></div></div>
      </div>
      <div class="actions">
        <div class="help">${items.length?"El empaque se suma después de fabricar.":"Sin empaque también es válido."}</div>
        ${pkPages>1?`<div class="pager"><button id="packPrev" ${packagingPage===0?"disabled":""}>‹</button><div class="page-label">${packagingPage+1}/${pkPages}</div><button id="packNext" ${packagingPage===pkPages-1?"disabled":""}>›</button></div>`:""}
      </div>
    </section>
  </div>`;

  if(g){
    document.getElementById("finishGroupSelect").onchange=e=>{finishGroupIndex=Number(e.target.value);wrapPage=0;renderEditor();};
    document.getElementById("measuredLength").oninput=e=>{g.measuredFinalLengthM=e.target.value===""?null:Number(e.target.value)/100;refreshValueStrip();};
    document.getElementById("addWrap").onclick=()=>openWrapChooser(m=>{g.wraps.push({materialId:m.id,meters:null,source:"custom"});wrapPage=Math.floor((g.wraps.length-1)/wrPer);renderEditor();});
    document.getElementById("noWrap").onclick=()=>{g.wraps=[];wrapPage=0;renderEditor();};
    host.querySelectorAll("[data-delwrap]").forEach(b=>b.onclick=()=>{g.wraps.splice(Number(b.dataset.delwrap),1);renderEditor();});
    host.querySelectorAll("[data-wrapmeters]").forEach(e=>e.oninput=()=>{g.wraps[Number(e.dataset.wrapmeters)].meters=e.value===""?null:Number(e.value);refreshValueStrip();});
    host.querySelectorAll("[data-wrapsrc]").forEach(e=>e.onchange=()=>{g.wraps[Number(e.dataset.wrapsrc)].source=e.value;refreshValueStrip();});
    const wp=document.getElementById("wrapPrev"),wn=document.getElementById("wrapNext");if(wp)wp.onclick=()=>{wrapPage--;renderEditor();};if(wn)wn.onclick=()=>{wrapPage++;renderEditor();};
  }

  document.getElementById("packageTemplate").onchange=e=>{
    const id=e.target.value;if(!id){p.templateId=null;return;}
    draft=C.applyPackagingTemplate(state,draft,id);ensurePackaging();renderEditor();
  };
  document.getElementById("addPackageItem").onclick=()=>openPackagingChooser(m=>{draft.packaging.items.push({materialId:m.id,quantity:1,unit:m.unit||"un"});draft.packaging.templateId=null;packagingPage=Math.floor((draft.packaging.items.length-1)/pkPer);renderEditor();});
  host.querySelectorAll("[data-delpack]").forEach(b=>b.onclick=()=>{draft.packaging.items.splice(Number(b.dataset.delpack),1);draft.packaging.templateId=null;renderEditor();});
  host.querySelectorAll("[data-packqty]").forEach(e=>e.oninput=()=>{draft.packaging.items[Number(e.dataset.packqty)].quantity=e.value===""?null:Number(e.value);draft.packaging.templateId=null;refreshValueStrip();});
  document.getElementById("packMinutes").oninput=e=>{const v=e.target.value;if(v===""){draft.packaging.laborMode="none";draft.packaging.minutes=null;}else{draft.packaging.laborMode="minutes";draft.packaging.minutes=Number(v);}draft.packaging.templateId=null;refreshValueStrip();};
  const pp=document.getElementById("packPrev"),pn=document.getElementById("packNext");if(pp)pp.onclick=()=>{packagingPage--;renderEditor();};if(pn)pn.onclick=()=>{packagingPage++;renderEditor();};
  document.getElementById("savePackageTpl").onclick=()=>openSavePackagingTemplate(draft.packaging);
}

function paneSale(host){
  const r=previewCost();
  const cc=commercialCost(r);
  const previous=editingId?state.products.find(p=>p.id===editingId):null;
  const compare=previous?C.compareHistoricalToCurrent(state,previous):null;
  const suggestion=priceSuggestion(r);
  const startPrice=draft.price!==null?draft.price:(suggestion??(cc.value!==null?C.priceForMargin(cc.value,targetMargin()):null));
  const shownPrice=startPrice===null?null:Math.max(0,Math.round(startPrice));
  const shownMargin=(cc.value!==null&&shownPrice!==null)?C.marginForPrice(cc.value,shownPrice):null;
  const maxPrice=cc.value!==null?Math.max(priceRounding()*10,Math.ceil(Math.max(cc.value*4,(shownPrice||0)*1.8,10000)/priceRounding())*priceRounding()):100000;

  host.innerHTML=`
  <div class="pane pane-grid">
    <section class="card pane-card">
      <div><div class="kicker">Trabajo</div><h3>Lo necesario para cerrar el costo</h3></div>
      <div class="grid2">
        <div class="field"><label>Tiempo de fabricación · min</label><input id="minutes" type="number" min="0" value="${draft.minutes??""}" placeholder="No sé todavía"></div>
        <div class="field"><label>Valor de una hora</label><input id="hourly" type="number" min="0" value="${draft.hourlyRate??""}" placeholder="No sé todavía"></div>
      </div>
      <div class="field"><label>¿Fue más trabajoso de lo habitual?</label><div class="segment">${[[0,"No"],[10,"Un poco"],[20,"Bastante"]].map(([v,t])=>`<button data-work="${v}" class="${draft.extraWorkPct===v?"active":""}">${t}${v?` · +${v}%`:""}</button>`).join("")}</div></div>
      <div class="actions"><button id="optionalAdjustments" class="text-btn small">Ajustes opcionales</button><div class="help">Merma y otros detalles quedan fuera del flujo principal.</div></div>
      ${compare?`<div class="flat pad"><div class="kicker">Historia</div><div class="definition"><div class="label">Costo guardado</div><div class="value">${money(compare.historical.readyToSellCost??compare.historical.knownReadyToSellCost)}</div></div><div class="definition"><div class="label">Con precios de hoy</div><div class="value">${money(compare.current.readyToSellCost??compare.current.knownReadyToSellCost)}</div></div></div>`:""}
    </section>

    <section class="card pane-card commercial-panel">
      <div>
        <div class="kicker">Precio ↔ margen</div>
        <h3>${cc.complete?"Ajusta y observa":"Simulación sobre costo conocido"}</h3>
        <div class="help">${cc.complete?`Costo listo para vender: ${money(cc.value)}`:`Conocido hasta ahora: ${money(cc.value)}. No lo tratamos como precio sugerido.`}</div>
      </div>

      ${cc.value!==null?`
      <div class="commercial-control">
        <div class="sim-line"><span>Precio</span><strong id="salePriceOut">${shownPrice===null?"—":money(shownPrice)}</strong></div>
        <input id="salePriceRange" class="commercial-range" type="range" min="0" max="${maxPrice}" step="${priceRounding()}" value="${shownPrice??0}" aria-label="Ajustar precio">
      </div>
      <div class="commercial-control">
        <div class="sim-line"><span>Margen</span><strong id="saleMarginOut">${shownMargin===null?"—":num(shownMargin*100,1)+"%"}</strong></div>
        <input id="saleMarginRange" class="commercial-range" type="range" min="0" max="85" step=".1" value="${shownMargin===null?targetMargin()*100:Math.max(0,Math.min(85,shownMargin*100))}" aria-label="Ajustar margen">
      </div>
      <div class="sim-profit">Ganancia <strong id="saleProfitOut">${shownPrice===null?"—":money(C.profitForPrice(cc.value,shownPrice))}</strong></div>
      <div class="actions">
        <button id="clearPrice" class="secondary">Dejar sin precio</button>
        ${draft.price===null&&suggestion!==null?`<div class="help">Sugerido desde ${num(targetMargin()*100,0)}% habitual: <strong>${money(suggestion)}</strong>. El redondeo puede mover unas décimas el margen.</div>`:"<div></div>"}
      </div>
      `:`<div class="note">Todavía no hay costo suficiente para simular precio y margen.</div>`}
    </section>
  </div>`;

  const read=(id)=>{const v=document.getElementById(id).value;return v===""?null:Number(v);};
  document.getElementById("minutes").oninput=()=>{draft.minutes=read("minutes");renderEditor();};
  document.getElementById("hourly").oninput=()=>{draft.hourlyRate=read("hourly");renderEditor();};

  const priceRange=document.getElementById("salePriceRange");
  const marginRange=document.getElementById("saleMarginRange");
  const refreshCommercial=(authority)=>{
    if(!priceRange||!marginRange||cc.value===null)return;
    let price=Number(priceRange.value)||0;
    if(authority==="margin"){
      const m=(Number(marginRange.value)||0)/100;
      const exact=C.priceForMargin(cc.value,m);
      price=exact===null?0:Math.max(0,C.roundCommercialPrice(exact,priceRounding()));
      priceRange.value=String(price);
    }
    draft.price=price;
    const m=C.marginForPrice(cc.value,price),profit=C.profitForPrice(cc.value,price);
    if(m!==null)marginRange.value=String(Math.max(0,Math.min(85,m*100)));
    document.getElementById("salePriceOut").textContent=money(price);
    document.getElementById("saleMarginOut").textContent=m===null?"—":num(m*100,1)+"%";
    document.getElementById("saleProfitOut").textContent=money(profit);
    refreshValueStrip();
  };
  if(priceRange)priceRange.oninput=()=>refreshCommercial("price");
  if(marginRange)marginRange.oninput=()=>refreshCommercial("margin");

  const clear=document.getElementById("clearPrice");
  if(clear)clear.onclick=()=>{draft.price=null;renderEditor();};

  host.querySelectorAll("[data-work]").forEach(b=>b.onclick=()=>{draft.extraWorkPct=Number(b.dataset.work);renderEditor();});
  document.getElementById("optionalAdjustments").onclick=openOptionalAdjustments;
}

function renderDetail(){
  const p=state.products.find(x=>x.id===detailId);if(!p){view="archive";renderMain();return;}
  const r=C.costProduct(state,p);
  main.innerHTML=`
  <div class="detail">
    <div class="screen-head">
      <div><button id="backArchive" class="text-btn">← Mis TuconTu</button><div class="kicker">Ficha</div><h2>${esc(p.name)}</h2></div>
      <div class="action-group">${detailMode==="build"?'<button id="backSummary" class="secondary">Volver a ficha</button>':''}<button id="editDetail" class="primary">Editar</button></div>
    </div>
    <div id="detailBody" class="body-area"></div>
    <div id="valueHost">${valueStrip(r)}</div>
  </div>`;
  document.getElementById("backArchive").onclick=()=>{view="archive";renderMain();};
  const bs=document.getElementById("backSummary");if(bs)bs.onclick=()=>{detailMode="summary";renderDetail();};
  document.getElementById("editDetail").onclick=()=>editProduct(p.id,detailMode==="build"?"construccion":"pieza");
  bindPending(document.getElementById("valueHost"),r);
  if(detailMode==="build")renderConstructionDetail(p,r);else renderSummaryDetail(p,r);
}

function renderSummaryDetail(p,r){
  const host=document.getElementById("detailBody");
  const current=C.costProductCurrent(state,p),cmp=C.compareHistoricalToCurrent(state,p);
  const size=p.sizeKey==="X"?(p.customLengthM?num(p.customLengthM*100,0)+" cm":"largo manual"):`${p.sizeKey} · ${num(baseLengthM(p)*100,0)} cm`;
  const packName=p.packaging?.templateId?(state.packagingTemplates||[]).find(t=>t.id===p.packaging.templateId)?.name:null;
  host.innerHTML=`
  <div class="detail-grid">
    <section class="card detail-card">
      <div class="kicker">Hecho</div><h3>${size}</h3>
      <div class="definition"><div class="label">Cordones</div><div class="value">${p.cordCount}</div></div>
      <div class="definition"><div class="label">Construcción</div><div class="value">${p.groups.map(g=>kindLabel(g.cordIndexes.length)).join(" · ")||"Pendiente"}</div></div>
      <div class="definition"><div class="label">Empaque</div><div class="value">${packName?esc(packName):(p.packaging?.items?.length?`${p.packaging.items.length} componente${p.packaging.items.length===1?"":"s"}`:"Sin empaque")}</div></div>
      <button id="seeBuild" class="secondary">Ver construcción</button>
    </section>

    <section class="card detail-card">
      <div class="kicker">Costó</div><div class="big">${money(r.readyToSellCost??r.knownReadyToSellCost)}</div>
      <div class="definition"><div class="label">Fabricación</div><div class="value">${money(r.manufacturingCost??r.manufacturingKnownCost)}</div></div>
      <div class="definition"><div class="label">Empaque</div><div class="value">${money(r.packagingCost??r.packagingKnownCost)}</div></div>
      <div class="definition"><div class="label">Con precios de hoy</div><div class="value">${money(current.readyToSellCost??current.knownReadyToSellCost)}</div></div>
      ${cmp.delta!==null&&Math.abs(cmp.delta)>.01?'<button id="rebaseCosts" class="secondary">Usar precios actuales</button>':'<div class="help">El costo histórico está al día con el catálogo.</div>'}
    </section>

    <section class="card detail-card">
      <div class="kicker">Venta</div><div class="big">${p.price===null?"Sin precio":money(p.price)}</div>
      <div class="definition"><div class="label">Ganancia</div><div class="value">${r.profit===null?"—":money(r.profit)}</div></div>
      <div class="definition"><div class="label">Margen</div><div class="value">${r.margin===null?"—":num(r.margin*100,1)+"%"}</div></div>
      <div class="definition"><div class="label">Trabajo</div><div class="value">${p.minutes===null?"No registrado":p.minutes+" min"}</div></div>
      <button id="adjustDetailPrice" class="secondary">Ajustar precio ↔ margen</button>
    </section>
  </div>`;
  document.getElementById("seeBuild").onclick=()=>{detailMode="build";detailGroupIndex=0;detailGroupPage=0;renderDetail();};
  const rb=document.getElementById("rebaseCosts");if(rb)rb.onclick=()=>confirmRebase(p);
  document.getElementById("adjustDetailPrice").onclick=()=>editProduct(p.id,"venta");
}

function renderConstructionDetail(p,r){
  const host=document.getElementById("detailBody");
  const per=5,pages=Math.max(1,Math.ceil(r.groups.length/per));detailGroupPage=Math.max(0,Math.min(detailGroupPage,pages-1));
  const slice=r.groups.slice(detailGroupPage*per,detailGroupPage*per+per);
  detailGroupIndex=Math.max(0,Math.min(detailGroupIndex,Math.max(0,r.groups.length-1)));
  const g=r.groups[detailGroupIndex]||null;
  host.innerHTML=`
  <div class="construction-grid">
    <section class="card group-browser">
      <div><div class="kicker">Construcción</div><h3>${r.groups.length} grupo${r.groups.length===1?"":"s"}</h3></div>
      <div class="group-browser-list">
        ${slice.map(gr=>`<button class="${gr.index===detailGroupIndex?"active":""}" data-detailgroup="${gr.index}"><strong>${gr.index+1} · ${gr.kindLabel}</strong><br><span class="small">${gr.cordIndexes.map(i=>"#"+(i+1)).join(" · ")}</span></button>`).join("")}
        ${Array.from({length:Math.max(0,5-slice.length)},()=>'<button style="visibility:hidden"></button>').join("")}
      </div>
      ${pages>1?`<div class="pager"><button id="dgPrev" ${detailGroupPage===0?"disabled":""}>‹</button><div class="page-label">${detailGroupPage+1}/${pages}</div><button id="dgNext" ${detailGroupPage===pages-1?"disabled":""}>›</button></div>`:"<div></div>"}
    </section>
    <section class="card group-detail">
      ${g?`<div class="section-head"><div><div class="kicker">${g.kindLabel}</div><h3>${g.strandCount} cordón${g.strandCount===1?"":"es"}</h3></div>${badge(g.length.quality)}</div>
        <div class="definition"><div class="label">Largo final</div><div class="value">${g.length.valueM!==null?num(g.length.valueM*100,1)+" cm":"—"}</div></div>
        ${g.cords.map(c=>`<div class="definition"><div class="label">Cordón #${c.index+1}</div><div class="value">${esc(c.materialName||"Cordón")} · ${c.thicknessMm?num(c.thicknessMm,1)+" mm":"grosor no informado"}</div></div>`).join("")}
        <div style="margin-top:10px"><div class="kicker">Embarrilado</div>${g.wraps.length?g.wraps.slice(0,4).map(w=>`<div class="definition"><div class="label">${esc(w.materialName||"Material")}</div><div class="value">${w.meters.valueM!==null?num(w.meters.valueM,2)+" m":"—"} · ${qualityLabel(w.meters.quality)}</div></div>`).join(""):'<div class="help">Sin embarrilado.</div>'}</div>
      `:'<div class="note">No hay grupos definidos todavía.</div>'}
    </section>
  </div>`;
  host.querySelectorAll("[data-detailgroup]").forEach(b=>b.onclick=()=>{detailGroupIndex=Number(b.dataset.detailgroup);renderConstructionDetail(p,r);});
  const dp=document.getElementById("dgPrev"),dn=document.getElementById("dgNext");if(dp)dp.onclick=()=>{detailGroupPage--;detailGroupIndex=detailGroupPage*per;renderConstructionDetail(p,r);};if(dn)dn.onclick=()=>{detailGroupPage++;detailGroupIndex=detailGroupPage*per;renderConstructionDetail(p,r);};
}

function renderLibrary(){
  const meta={
    colets:{unit:"un",create:"colet"},
    cords:{unit:"m",create:"cordón"},
    wraps:{unit:"m",create:"material"},
    packaging:{unit:null,create:"componente"}
  }[libKind];
  const list=state.materials[libKind]||[],per=4,pages=Math.max(1,Math.ceil(list.length/per));libPage=Math.max(0,Math.min(libPage,pages-1));
  const items=list.slice(libPage*per,libPage*per+per);
  library.innerHTML=`
    <div class="lib-head"><div><div class="kicker">Mesa lateral</div><h2>Tus materiales</h2></div><button id="closeMaterials" class="secondary mobile-only">×</button></div>
    <div class="lib-tabs">${[["colets","Colets"],["cords","Cordones"],["wraps","Embarr."],["packaging","Empaque"]].map(([k,t])=>`<button class="lib-tab ${libKind===k?"active":""}" data-libkind="${k}">${t}</button>`).join("")}</div>
    <div class="lib-list">
      ${items.map(m=>`<div class="lib-item"><div><strong>${esc(m.name||"Sin nombre")}</strong><small>${unitCostText(m,libKind==="packaging"?(m.unit||"un"):meta.unit)}</small>${libKind==="cords"?`<small>${m.thicknessMm?num(m.thicknessMm,1)+" mm":"grosor no informado"}</small>`:""}</div><button class="lib-edit" data-editmat="${m.id}">Editar</button></div>`).join("")}
      ${Array.from({length:Math.max(0,4-items.length)},()=>'<div class="lib-item" style="visibility:hidden"></div>').join("")}
    </div>
    <div class="lib-footer"><button id="libCreate" class="primary">+ Crear ${meta.create}</button>${pages>1?`<div class="pager"><button id="libPrev" ${libPage===0?"disabled":""}>‹</button><div class="page-label">${libPage+1}/${pages}</div><button id="libNext" ${libPage===pages-1?"disabled":""}>›</button></div>`:""}</div>`;
  library.querySelectorAll("[data-libkind]").forEach(b=>b.onclick=()=>{libKind=b.dataset.libkind;libPage=0;renderLibrary();});
  library.querySelectorAll("[data-editmat]").forEach(b=>b.onclick=()=>openMaterialModal(libKind,b.dataset.editmat,()=>{saveState();renderMain();renderLibrary();}));
  document.getElementById("libCreate").onclick=()=>openMaterialModal(libKind,null,()=>{saveState();renderMain();renderLibrary();});
  const lp=document.getElementById("libPrev"),ln=document.getElementById("libNext");if(lp)lp.onclick=()=>{libPage--;renderLibrary();};if(ln)ln.onclick=()=>{libPage++;renderLibrary();};
  const cm=document.getElementById("closeMaterials");if(cm)cm.onclick=()=>document.body.classList.remove("library-open");
}

function openMaterialModal(kind,id=null,done=null){
  const existing=id?material(kind,id):null;
  const title=existing?"Editar material":({colets:"Nuevo colet",cords:"Nuevo cordón",wraps:"Nuevo material para embarrilar",packaging:"Nuevo componente de empaque"})[kind];
  let mode=existing?.cost?.mode||"unknown";
  const unitKey=kind==="colets"?"un":kind==="packaging"?(existing?.unit||"un"):"m";
  const unitWord=unitKey==="m"?"metro":"unidad";
  const qtyWord=unitKey==="m"?"Metros comprados":"Unidades compradas";
  modalRoot.innerHTML=`
  <div class="modal-bg"><div class="modal">
    <div class="modal-head"><div><div class="kicker">Tus materiales</div><h2>${title}</h2></div><button id="modalClose" class="close">×</button></div>
    <div class="grid2">
      <div class="field"><label>Nombre</label><input id="matName" value="${esc(existing?.name||"")}" placeholder="Nombre"></div>
      ${kind==="cords"?`<div class="field"><label>Grosor · mm <span class="help">· opcional</span></label><input id="matThickness" type="number" min="0" step=".1" value="${existing?.thicknessMm??""}" placeholder="No sé todavía"></div>`:kind==="packaging"?`<div class="field"><label>Se compra por</label><select id="packUnit"><option value="un" ${(existing?.unit||"un")==="un"?"selected":""}>unidad</option><option value="m" ${existing?.unit==="m"?"selected":""}>metro</option></select></div>`:"<div></div>"}
    </div>
    <div class="field"><label>¿Cómo conoces su costo?</label><div class="segment"><button data-costmode="unknown" class="${mode==="unknown"?"active":""}">No sé</button><button data-costmode="direct" class="${mode==="direct"?"active":""}">Por ${unitWord}</button><button data-costmode="purchase" class="${mode==="purchase"?"active":""}">Desde compra</button></div></div>
    <div id="directCost" class="${mode==="direct"?"":"hidden"} field"><label id="unitCostLabel">Costo por ${unitWord}</label><input id="unitCost" type="number" min="0" value="${existing?.cost?.mode==="direct"?(existing.cost.unitCost??""):""}" placeholder="$"></div>
    <div id="purchaseCost" class="${mode==="purchase"?"":"hidden"} grid2"><div class="field"><label id="qtyLabel">${qtyWord}</label><input id="purchaseQty" type="number" min="0" step=".01" value="${existing?.cost?.mode==="purchase"?(existing.cost.purchaseQty??""):""}"></div><div class="field"><label>Total pagado</label><input id="purchaseTotal" type="number" min="0" value="${existing?.cost?.mode==="purchase"?(existing.cost.purchaseTotal??""):""}" placeholder="$"></div></div>
    <div class="note">Editar el costo actual no cambia silenciosamente el costo histórico de las piezas ya guardadas.</div>
    <div class="actions"><button id="modalCancel" class="secondary">Cancelar</button><button id="modalSave" class="primary">Guardar</button></div>
  </div></div>`;
  const close=()=>modalRoot.innerHTML="";
  document.getElementById("modalClose").onclick=close;document.getElementById("modalCancel").onclick=close;
  modalRoot.querySelector(".modal-bg").onclick=e=>{if(e.target.classList.contains("modal-bg"))close();};
  modalRoot.querySelectorAll("[data-costmode]").forEach(b=>b.onclick=()=>{
    mode=b.dataset.costmode;modalRoot.querySelectorAll("[data-costmode]").forEach(x=>x.classList.toggle("active",x===b));
    document.getElementById("directCost").classList.toggle("hidden",mode!=="direct");
    document.getElementById("purchaseCost").classList.toggle("hidden",mode!=="purchase");
  });
  const pu=document.getElementById("packUnit");if(pu)pu.onchange=()=>{const word=pu.value==="m"?"metro":"unidad";document.getElementById("qtyLabel").textContent=pu.value==="m"?"Metros comprados":"Unidades compradas";document.getElementById("unitCostLabel").textContent="Costo por "+word;const direct=modalRoot.querySelector('[data-costmode="direct"]');if(direct)direct.textContent="Por "+word;};
  document.getElementById("modalSave").onclick=()=>{
    let cost=C.makeCostUnknown();
    if(mode==="direct")cost=C.makeCostDirect(document.getElementById("unitCost").value);
    if(mode==="purchase")cost=C.makeCostPurchase(document.getElementById("purchaseQty").value,document.getElementById("purchaseTotal").value);
    let m=existing;
    if(!m){m={id:C.uid(kind.slice(0,-1)),name:"",cost,createdAt:C.today()};state.materials[kind].push(m);}
    m.name=document.getElementById("matName").value.trim()||({colets:"Colet",cords:"Cordón",wraps:"Material",packaging:"Componente"})[kind];m.cost=cost;
    if(kind==="cords"){const v=document.getElementById("matThickness").value;m.thicknessMm=v===""?null:Number(v);}
    if(kind==="wraps"&&m.baseRatePerM===undefined)m.baseRatePerM=null;
    if(kind==="packaging")m.unit=document.getElementById("packUnit")?.value||existing?.unit||"un";
    saveState();close();if(done)done(m);
  };
}

function openWrapChooser(done){
  const list=state.materials.wraps||[];if(!list.length){openMaterialModal("wraps",null,done);return;}
  modalRoot.innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><div><div class="kicker">Embarrilado</div><h2>Agregar material</h2></div><button id="modalClose" class="close">×</button></div><div class="grid2">${list.slice(0,8).map(m=>`<button class="choice" data-wrapchoice="${m.id}"><strong>${esc(m.name)}</strong><small>${unitCostText(m,"m")}</small></button>`).join("")}</div><div class="actions"><button id="createWrapMaterial" class="secondary">+ Crear material</button><button id="cancelWrap" class="text-btn">Cancelar</button></div></div></div>`;
  const close=()=>modalRoot.innerHTML="";document.getElementById("modalClose").onclick=close;document.getElementById("cancelWrap").onclick=close;
  modalRoot.querySelectorAll("[data-wrapchoice]").forEach(b=>b.onclick=()=>{const m=material("wraps",b.dataset.wrapchoice);close();done(m);});
  document.getElementById("createWrapMaterial").onclick=()=>{close();openMaterialModal("wraps",null,done);};
}
function openPackagingChooser(done){
  const list=state.materials.packaging||[];if(!list.length){openMaterialModal("packaging",null,done);return;}
  modalRoot.innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><div><div class="kicker">Empaque</div><h2>Agregar componente</h2></div><button id="modalClose" class="close">×</button></div><div class="grid2">${list.slice(0,8).map(m=>`<button class="choice" data-packchoice="${m.id}"><strong>${esc(m.name)}</strong><small>${unitCostText(m,m.unit||"un")}</small></button>`).join("")}</div><div class="actions"><button id="createPackMaterial" class="secondary">+ Crear componente</button><button id="cancelPack" class="text-btn">Cancelar</button></div></div></div>`;
  const close=()=>modalRoot.innerHTML="";document.getElementById("modalClose").onclick=close;document.getElementById("cancelPack").onclick=close;
  modalRoot.querySelectorAll("[data-packchoice]").forEach(b=>b.onclick=()=>{const m=material("packaging",b.dataset.packchoice);close();done(m);});
  document.getElementById("createPackMaterial").onclick=()=>{close();openMaterialModal("packaging",null,done);};
}
function openSavePackagingTemplate(packaging){
  modalRoot.innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><div><div class="kicker">Empaque habitual</div><h2>Guardar esta combinación</h2></div><button id="modalClose" class="close">×</button></div><div class="field"><label>Nombre</label><input id="tplName" placeholder="Ej. Empaque simple"></div><div class="actions"><button id="tplCancel" class="secondary">Cancelar</button><button id="tplSave" class="primary">Guardar</button></div></div></div>`;
  const close=()=>modalRoot.innerHTML="";document.getElementById("modalClose").onclick=close;document.getElementById("tplCancel").onclick=close;
  document.getElementById("tplSave").onclick=()=>{const tpl={id:C.uid("packtpl"),name:document.getElementById("tplName").value.trim()||"Empaque habitual",items:deep(packaging.items||[]),laborMode:packaging.laborMode||"none",minutes:packaging.minutes??null};state.packagingTemplates.push(tpl);draft.packaging.templateId=tpl.id;saveState();close();renderEditor();};
}

function openSettings(){
  const r=state.settings.lengthRules||C.DEFAULT_LENGTH_RULES;
  modalRoot.innerHTML=`
  <div class="modal-bg"><div class="modal">
    <div class="modal-head"><div><div class="kicker">Ajustes</div><h2>Reglas que rara vez cambian</h2></div><button id="modalClose" class="close">×</button></div>
    <div class="note">De cada 30 cm iniciales, indica cuánto queda en promedio. El programa transforma esta observación en la regla interna.</div>
    <div class="grid3">
      <div class="field"><label>Cordón suelto</label><input id="ruleLoose" type="number" min="0" step=".1" value="${r.looseFinalCm}"></div>
      <div class="field"><label>Espiral</label><input id="ruleSpiral" type="number" min="0" step=".1" value="${r.spiralFinalCm}"></div>
      <div class="field"><label>Trenza</label><input id="ruleBraid" type="number" min="0" step=".1" value="${r.braidFinalCm}"></div>
    </div>
    <div class="grid3">
      <div class="field"><label>Valor hora habitual</label><input id="defaultHourly" type="number" min="0" value="${state.settings.hourlyRate??""}" placeholder="Opcional"></div>
      <div class="field"><label>Margen habitual · %</label><input id="defaultMargin" type="number" min="0" max="90" step="1" value="${num(targetMargin()*100,0)}"></div>
      <div class="field"><label>Redondear sugerencias a</label><select id="priceRounding"><option value="1" ${priceRounding()===1?"selected":""}>$1</option><option value="10" ${priceRounding()===10?"selected":""}>$10</option><option value="100" ${priceRounding()===100?"selected":""}>$100</option><option value="500" ${priceRounding()===500?"selected":""}>$500</option><option value="1000" ${priceRounding()===1000?"selected":""}>$1.000</option></select></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Merma cordón · %</label><input id="defaultCordWaste" type="number" min="0" value="${state.settings.defaultCordWastePct??0}"></div>
      <div class="field"><label>Merma embarrilado · %</label><input id="defaultWrapWaste" type="number" min="0" value="${state.settings.defaultWrapWastePct??0}"></div>
    </div>
    <div class="actions"><button id="settingsCancel" class="secondary">Cancelar</button><button id="settingsSave" class="primary">Guardar</button></div>
  </div></div>`;
  const close=()=>modalRoot.innerHTML="";document.getElementById("modalClose").onclick=close;document.getElementById("settingsCancel").onclick=close;
  document.getElementById("settingsSave").onclick=()=>{
    const val=(id,fallback=null)=>{const s=document.getElementById(id).value;if(s==="")return fallback;const n=Number(s);return Number.isFinite(n)?n:fallback;};
    state.settings.lengthRules={referenceCm:30,looseFinalCm:val("ruleLoose",30),spiralFinalCm:val("ruleSpiral",29),braidFinalCm:val("ruleBraid",27)};
    state.settings.hourlyRate=val("defaultHourly",null);
    state.settings.defaultTargetMargin=Math.max(0,Math.min(.90,val("defaultMargin",50)/100));
    state.settings.priceRounding=val("priceRounding",100);
    state.settings.defaultCordWastePct=val("defaultCordWaste",0);state.settings.defaultWrapWastePct=val("defaultWrapWaste",0);
    saveState();close();renderMain();
  };
}
function openOptionalAdjustments(){
  modalRoot.innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><div><div class="kicker">Opcional</div><h2>Merma de esta pieza</h2></div><button id="modalClose" class="close">×</button></div><div class="grid2"><div class="field"><label>Cordón · %</label><input id="pieceCordWaste" type="number" min="0" value="${draft.cordWastePct??0}"></div><div class="field"><label>Embarrilado · %</label><input id="pieceWrapWaste" type="number" min="0" value="${draft.wrapWastePct??0}"></div></div><div class="help">Estos ajustes existen, pero no ocupan espacio en la mesa principal.</div><div class="actions"><button id="optionalCancel" class="secondary">Cancelar</button><button id="optionalSave" class="primary">Guardar</button></div></div></div>`;
  const close=()=>modalRoot.innerHTML="";document.getElementById("modalClose").onclick=close;document.getElementById("optionalCancel").onclick=close;
  document.getElementById("optionalSave").onclick=()=>{draft.cordWastePct=Number(document.getElementById("pieceCordWaste").value)||0;draft.wrapWastePct=Number(document.getElementById("pieceWrapWaste").value)||0;close();renderEditor();};
}
function openPending(items){
  modalRoot.innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><div><div class="kicker">Estado</div><h2>${items.length?`${items.length} dato${items.length===1?"":"s"} por completar`:"Nada pendiente"}</h2></div><button id="modalClose" class="close">×</button></div><div class="pending-list">${items.slice(0,8).map(x=>`<div class="pending-item">${esc(x)}</div>`).join("")||'<div class="note">El cálculo está completo.</div>'}</div><div class="help">Un pendiente no bloquea el trabajo: sólo limita qué tan completa puede ser la estimación.</div></div></div>`;
  document.getElementById("modalClose").onclick=()=>modalRoot.innerHTML="";
}
function confirmRebase(product){
  modalRoot.innerHTML=`<div class="modal-bg"><div class="modal"><div><div class="kicker">Costo histórico</div><h2>¿Usar los precios actuales?</h2></div><div class="note">Esto reemplaza el snapshot de costos de esta pieza. Normalmente TUCONTU conserva el costo con el que fue guardada.</div><div class="actions"><button id="cancelRebase" class="secondary">Cancelar</button><button id="doRebase" class="primary">Actualizar esta pieza</button></div></div></div>`;
  document.getElementById("cancelRebase").onclick=()=>modalRoot.innerHTML="";
  document.getElementById("doRebase").onclick=()=>{const i=state.products.findIndex(p=>p.id===product.id);state.products[i]=C.rebaseProductCosts(state,product,{capturedAt:C.today()});saveState();modalRoot.innerHTML="";renderDetail();};
}
function openBackup(){
  modalRoot.innerHTML=`<div class="modal-bg"><div class="modal"><div class="modal-head"><div><div class="kicker">Respaldo</div><h2>Guardar o recuperar tus datos</h2></div><button id="modalClose" class="close">×</button></div><div class="grid2"><button id="exportData" class="choice"><strong>Guardar respaldo</strong><small>Descarga un archivo con tus piezas y materiales.</small></button><button id="importData" class="choice"><strong>Recuperar respaldo</strong><small>Abre un respaldo guardado anteriormente.</small></button></div><div class="help">No necesitas entender JSON ni archivos técnicos.</div></div></div>`;
  document.getElementById("modalClose").onclick=()=>modalRoot.innerHTML="";
  document.getElementById("exportData").onclick=exportData;
  document.getElementById("importData").onclick=()=>document.getElementById("importFile").click();
}
function exportData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`tucontu-respaldo-${C.today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importData(file){
  const reader=new FileReader();reader.onload=()=>{try{state=C.migrateState(JSON.parse(reader.result));saveState();modalRoot.innerHTML="";view=state.products.length?"archive":"intro";render();}catch(e){alert("No pude abrir ese respaldo de TUCONTU.");}};reader.readAsText(file);
}

document.getElementById("brandBtn").onclick=()=>{view=state.products.length?"archive":"intro";renderMain();};
document.getElementById("newPieceTop").onclick=startNew;
document.getElementById("settingsBtn").onclick=openSettings;
document.getElementById("backupBtn").onclick=openBackup;
document.getElementById("materialsBtn").onclick=()=>document.body.classList.toggle("library-open");
document.getElementById("importFile").onchange=e=>{if(e.target.files[0])importData(e.target.files[0]);e.target.value="";};

const small=document.createElement("div");small.className="too-small";small.innerHTML='<div><h2>TUCONTU necesita un poco más de alto.</h2><div class="help">Amplía la ventana. No reducimos la letra ni escondemos información para evitar el scroll.</div></div>';document.body.appendChild(small);

render();
})();
