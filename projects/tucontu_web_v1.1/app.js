
(function(){
'use strict';

const C=window.TUCONTU_CORE;
const KEY='tucontu.oneshot.v1';

const app=document.getElementById('app');
const side=document.getElementById('sidebar');
const modal=document.getElementById('modalRoot');

let state=load();
let route=state.products.length?'home':'intro';
let step=0;
let draft=newDraft();
let editingId=null;
let activeProductId=null;

function deep(x){ return JSON.parse(JSON.stringify(x)); }

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY));
    return x&&x.schema===C.DATA_SCHEMA ? x : C.defaultState();
  }catch(e){
    return C.defaultState();
  }
}

function save(){
  localStorage.setItem(KEY,JSON.stringify(state));
  renderSide();
}

function newDraft(){
  return {
    id:C.uid('product'),
    name:'',
    sizeKey:'M',
    customLengthM:null,
    cordCount:9,
    coletId:null,
    cords:[],
    groups:[],
    minutes:null,
    hourlyRate:state?.settings?.hourlyRate??null,
    extraWorkPct:0,
    cordWastePct:state?.settings?.defaultCordWastePct??0,
    wrapWastePct:state?.settings?.defaultWrapWastePct??0,
    price:null,
    createdAt:C.today()
  };
}

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[m]));

const money=v=>v===null||v===undefined||!Number.isFinite(Number(v))
  ? '—'
  : new Intl.NumberFormat('es-CL',{
      style:'currency',currency:'CLP',maximumFractionDigits:0
    }).format(v);

const num=(v,d=2)=>v===null||v===undefined||!Number.isFinite(Number(v))
  ? '—'
  : new Intl.NumberFormat('es-CL',{maximumFractionDigits:d}).format(v);

const qlabel=q=>({
  measured:'medido',
  custom:'personalizado',
  estimated:'estimado',
  unknown:'desconocido'
})[q]||q;

const badge=q=>`<span class="badge ${q}">${qlabel(q)}</span>`;
const glabel=n=>n===1?'1 suelto':`Trenza de ${n}`;

function unitText(m,u){
  const c=C.deriveUnitCost(m.cost);
  return c.value===null ? 'Costo no informado' : `${money(c.value)} / ${u}`;
}

function baseLengthM(p){
  return p.sizeKey==='X'
    ? p.customLengthM
    : state.settings.sizeLengthsM[p.sizeKey];
}

function sizeText(p){
  const names={S:'Pequeño',M:'Mediano',L:'Grande',X:'Personalizado'};
  const m=baseLengthM(p);
  return `${names[p.sizeKey]||p.sizeKey}${m?` · ${num(m*100,0)} cm`:''}`;
}

function productStatus(r){
  if(!r.complete){
    return {quality:'unknown',text:r.unknowns.length===1?'falta 1 dato':`faltan ${r.unknowns.length} datos`};
  }
  if(r.quality==='estimated') return {quality:'estimated',text:'estimación completa'};
  if(r.quality==='measured') return {quality:'measured',text:'datos medidos'};
  return {quality:'custom',text:'cálculo completo'};
}

function renderSide(){
  const groups=[
    ['Colets','colets','un'],
    ['Cordones','cords','m'],
    ['Hilos, lanas y otros','wraps','m']
  ];

  side.innerHTML=
    `<div class="kicker">Vista rápida</div>
     <h2>Tus materiales</h2>
     <div class="empty">Lo que creas mientras armas una pieza queda disponible para la siguiente.</div>`+
    groups.map(([title,key,unit])=>`
      <div class="side-title">${title} · ${state.materials[key].length}</div>
      ${state.materials[key].length
        ? state.materials[key].map(m=>`
            <div class="mat">
              <strong>${esc(m.name||'Sin nombre')}</strong>
              <small>${unitText(m,unit)}</small>
              ${key==='cords'
                ? `<small>Grosor: ${m.thicknessMm?num(m.thicknessMm)+' mm':'no informado'}</small>`
                : ''}
            </div>`).join('')
        : '<div class="empty">Todavía no hay registrados.</div>'}
    `).join('')+
    `<div class="side-title">TuconTu guardados · ${state.products.length}</div>
     ${state.products.slice(-5).reverse().map(p=>{
       const r=C.costProduct(state,p);
       const s=productStatus(r);
       return `<button class="side-piece" data-side-product="${p.id}">
         <strong>${esc(p.name||'TuconTu')}</strong>
         <small>${p.cordCount} cordones · ${s.text}</small>
       </button>`;
     }).join('') || '<div class="empty">Aún ninguno.</div>'}`;

  side.querySelectorAll('[data-side-product]').forEach(b=>{
    b.onclick=()=>openDetail(b.dataset.sideProduct);
  });
}

function render({scroll='preserve'}={}){
  const y=window.scrollY;
  renderSide();

  if(route==='intro') intro();
  else if(route==='wizard') wizard();
  else if(route==='detail') detail();
  else home();

  requestAnimationFrame(()=>{
    if(scroll==='top') window.scrollTo({top:0,left:0,behavior:'auto'});
    else window.scrollTo({top:y,left:0,behavior:'auto'});
  });
}

function goto(nextRoute,{top=true}={}){
  route=nextRoute;
  render({scroll:top?'top':'preserve'});
}

function intro(){
  app.innerHTML=`
    <section>
      <div class="kicker">TUCONTU · Web v1.1</div>
      <h1>Crear tu primer<br>TuconTu.</h1>
      <p class="lead">Para calcular una pieza necesitamos algunos datos sobre los materiales, los cordones, el embarrilado y tu tiempo. Los iremos creando mientras trabajas.</p>
      <div class="axiom">Un dato desconocido jamás rompe el flujo.<br>Sólo cambia la calidad de la estimación.</div>
      <button class="primary" id="start">Comenzar con una pieza</button>
    </section>`;

  document.getElementById('start').onclick=()=>{
    draft=newDraft();
    editingId=null;
    step=0;
    goto('wizard');
  };
}

const steps=[
  ['La pieza',pieceStep],
  ['El colet',coletStep],
  ['Los cordones',cordsStep],
  ['Cómo se agrupan',groupsStep],
  ['Embarrilado',wrapStep],
  ['Tiempo y precio',timeStep],
  ['Resultado',summaryStep]
];

function wizard(){
  const s=steps[step];
  app.innerHTML=`
    <div class="wizard-head">
      <div>
        <div class="kicker">${editingId?'Editar TuconTu':'Crear TuconTu'}</div>
        <h2>${s[0]}</h2>
      </div>
      <div class="stepmark">${step+1} de ${steps.length}</div>
    </div>
    <div class="progress"><i style="width:${(step+1)/steps.length*100}%"></i></div>
    <div id="body"></div>`;

  s[1](document.getElementById('body'));
}

function nav(body,{ok=true,next='Continuar',back=true,onNext=null}={}){
  const x=document.createElement('div');
  x.className='actions';
  x.innerHTML=`
    <div>${back?'<button class="secondary prev">Anterior</button>':''}</div>
    <button class="primary next" ${ok?'':'disabled'}>${next}</button>`;

  body.appendChild(x);

  if(back){
    x.querySelector('.prev').onclick=()=>{
      step=Math.max(0,step-1);
      render({scroll:'top'});
    };
  }

  x.querySelector('.next').onclick=()=>{
    if(onNext&&onNext()===false) return;
    step=Math.min(steps.length-1,step+1);
    render({scroll:'top'});
  };
}

function pieceStep(body){
  body.innerHTML=`
    <div class="card">
      <p class="lead" style="font-size:17px">Partimos por lo que sí sabes. Todo puede cambiarse después.</p>

      <div class="field">
        <label>Nombre <span class="help">· opcional</span></label>
        <input id="name" value="${esc(draft.name)}" placeholder="Ej. TuconTu arena">
      </div>

      <div class="field">
        <label>Largo de cada cordón</label>
        <div class="grid4">
          ${[
            ['S','Pequeño','30 cm'],
            ['M','Mediano','60 cm'],
            ['L','Grande','80 cm'],
            ['X','Otro','personalizado']
          ].map(a=>`
            <button class="choice ${draft.sizeKey===a[0]?'active':''}" data-size="${a[0]}">
              <strong>${a[1]}</strong>
              <small>${a[2]}</small>
            </button>`).join('')}
        </div>
      </div>

      <div id="custom" class="field ${draft.sizeKey==='X'?'':'hidden'}">
        <label>Largo personalizado · cm</label>
        <input id="cm" type="number" min="1" value="${draft.customLengthM?draft.customLengthM*100:''}" placeholder="No sé todavía">
      </div>

      <div class="field">
        <label>¿Cuántos cordones usarás?</label>
        <input id="count" type="number" min="1" max="9" value="${draft.cordCount}">
        <div class="help">9 es habitual, pero una pieza puede usar menos.</div>
      </div>
    </div>`;

  body.querySelectorAll('[data-size]').forEach(b=>{
    b.onclick=()=>{
      draft.sizeKey=b.dataset.size;
      body.querySelectorAll('[data-size]').forEach(x=>x.classList.toggle('active',x===b));
      body.querySelector('#custom').classList.toggle('hidden',draft.sizeKey!=='X');
    };
  });

  nav(body,{
    back:false,
    onNext:()=>{
      draft.name=body.querySelector('#name').value.trim()||'TuconTu';

      const n=Math.max(1,Math.min(9,Number(body.querySelector('#count').value)||9));
      if(n!==draft.cordCount){
        draft.cordCount=n;
        draft.cords=[];
        draft.groups=[];
      }

      if(draft.sizeKey==='X'){
        const cm=body.querySelector('#cm').value;
        draft.customLengthM=cm===''?null:Number(cm)/100;
      }else{
        draft.customLengthM=null;
      }
      return true;
    }
  });
}

function chooser(kind,label,selected,cb){
  const d=document.createElement('div');
  d.className='card';

  const list=state.materials[kind];
  const human={colets:'colet',cords:'cordón',wraps:'material'}[kind];

  if(!list.length){
    d.innerHTML=`
      <div class="empty-action">
        <strong>Todavía no tienes ${human}${human==='material'?'es':'s'} registrados.</strong>
        <p>Crea el primero y quedará guardado para esta pieza y las siguientes.</p>
        <button class="primary create-first">+ Crear mi primer ${human}</button>
      </div>`;

    d.querySelector('.create-first').onclick=()=>{
      materialModal(kind,m=>{
        cb(m.id);
        render({scroll:'preserve'});
      });
    };
    return d;
  }

  d.innerHTML=`
    <div class="field">
      <label>${label}</label>
      <div class="inline">
        <select>
          <option value="">Seleccionar...</option>
          ${list.map(m=>`
            <option value="${m.id}" ${m.id===selected?'selected':''}>
              ${esc(m.name)} · ${unitText(m,kind==='colets'?'un':'m')}
            </option>`).join('')}
        </select>
        <button class="secondary create-more">+ Crear otro</button>
      </div>
    </div>`;

  d.querySelector('select').onchange=e=>cb(e.target.value||null);
  d.querySelector('.create-more').onclick=()=>{
    materialModal(kind,m=>{
      cb(m.id);
      render({scroll:'preserve'});
    });
  };

  return d;
}

function coletStep(body){
  body.innerHTML=`
    <p class="lead" style="font-size:17px">Puedes elegir uno registrado o crear uno ahora. Si no sabes su costo, también puedes guardarlo.</p>`;

  body.appendChild(chooser('colets','Colet de esta pieza',draft.coletId,id=>{
    draft.coletId=id;
    render({scroll:'preserve'});
  }));

  nav(body,{ok:!!draft.coletId,onNext:()=>!!draft.coletId});
}

function ensureCords(){
  while(draft.cords.length<draft.cordCount){
    draft.cords.push({materialId:null,thicknessMm:null});
  }
  draft.cords=draft.cords.slice(0,draft.cordCount);
}

function cordsStep(body){
  ensureCords();

  if(!state.materials.cords.length){
    body.innerHTML=`
      <div class="empty-action">
        <strong>Primero crea un cordón.</strong>
        <p>Después podrás usarlo en una o varias hebras. El grosor puede quedar como “no sé todavía”.</p>
        <button class="primary" id="firstCord">+ Crear mi primer cordón</button>
      </div>`;

    body.querySelector('#firstCord').onclick=()=>{
      materialModal('cords',m=>{
        if(draft.cords.length) draft.cords[0].materialId=m.id;
        render({scroll:'preserve'});
      });
    };

    nav(body,{ok:false});
    return;
  }

  body.innerHTML=`
    <div class="card">
      <p class="lead" style="font-size:17px">El largo ya viene dado por el tamaño. El grosor puede quedar sin informar.</p>

      <div class="field">
        <label>Atajo</label>
        <div class="inline">
          <select id="same">
            <option value="">Usar el mismo cordón en todos...</option>
            ${state.materials.cords.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('')}
          </select>
          <button id="new" class="secondary">+ Crear cordón</button>
        </div>
      </div>

      <div id="rows"></div>
    </div>`;

  const rows=body.querySelector('#rows');

  draft.cords.forEach((c,i)=>{
    const r=document.createElement('div');
    r.className='minirow';
    r.innerHTML=`
      <div class="numtag">${i+1}</div>
      <select data-c="${i}">
        <option value="">Elegir cordón...</option>
        ${state.materials.cords.map(m=>`
          <option value="${m.id}" ${m.id===c.materialId?'selected':''}>
            ${esc(m.name)} · ${unitText(m,'m')}
          </option>`).join('')}
      </select>
      <input data-t="${i}" type="number" min="0" step=".1" value="${c.thicknessMm??''}" placeholder="Grosor mm · no sé">`;
    rows.appendChild(r);
  });

  body.querySelectorAll('[data-c]').forEach(el=>{
    el.onchange=e=>{
      const i=+el.dataset.c;
      draft.cords[i].materialId=e.target.value||null;
      const m=state.materials.cords.find(x=>x.id===draft.cords[i].materialId);
      if(draft.cords[i].thicknessMm===null&&m?.thicknessMm){
        draft.cords[i].thicknessMm=m.thicknessMm;
        render({scroll:'preserve'});
      }
    };
  });

  body.querySelectorAll('[data-t]').forEach(el=>{
    el.oninput=e=>{
      const i=+el.dataset.t;
      const v=e.target.value;
      draft.cords[i].thicknessMm=v===''?null:Number(v);
    };
  });

  body.querySelector('#same').onchange=e=>{
    const id=e.target.value;
    if(!id) return;
    const m=state.materials.cords.find(x=>x.id===id);
    draft.cords.forEach(c=>{
      c.materialId=id;
      if(c.thicknessMm===null&&m?.thicknessMm) c.thicknessMm=m.thicknessMm;
    });
    render({scroll:'preserve'});
  };

  body.querySelector('#new').onclick=()=>{
    materialModal('cords',()=>render({scroll:'preserve'}));
  };

  nav(body,{
    ok:draft.cords.every(c=>c.materialId),
    onNext:()=>draft.cords.every(c=>c.materialId)
  });
}

function groupsStep(body){
  const used=draft.groups.reduce((a,g)=>a+g.size,0);
  const rem=draft.cordCount-used;

  body.innerHTML=`
    <div class="card">
      <p class="lead" style="font-size:17px">Agrupa los cordones como realmente los usarás. No hay una combinación obligatoria.</p>
      <div class="note">Usados: <strong>${used}</strong> de ${draft.cordCount} · Quedan: <strong>${rem}</strong></div>
      <div class="group-strip">
        ${draft.groups.map(g=>`<div class="chip">${glabel(g.size)}</div>`).join('')||'<span class="help">Todavía no has agregado grupos.</span>'}
      </div>
      <div class="group-builder">
        ${Array.from({length:rem},(_,i)=>i+1).map(n=>`
          <button class="pill" data-add="${n}">${n===1?'Suelto':'Trenza '+n}</button>`).join('')}
        ${draft.groups.length?'<button class="pill" id="undo">↶ Quitar último</button>':''}
      </div>
    </div>`;

  body.querySelectorAll('[data-add]').forEach(b=>{
    b.onclick=()=>{
      const n=+b.dataset.add;
      const start=draft.groups.reduce((a,g)=>a+g.size,0);

      draft.groups.push({
        id:C.uid('group'),
        size:n,
        cordIndexes:Array.from({length:n},(_,i)=>start+i),
        measuredFinalLengthM:null,
        customFinalLengthM:null,
        wraps:[]
      });

      render({scroll:'preserve'});
    };
  });

  const undo=body.querySelector('#undo');
  if(undo){
    undo.onclick=()=>{
      draft.groups.pop();
      render({scroll:'preserve'});
    };
  }

  nav(body,{ok:rem===0,onNext:()=>rem===0});
}

function wrapStep(body){
  const base=baseLengthM(draft);

  body.innerHTML=`
    <p class="lead" style="font-size:17px">Cada grupo puede usar ninguno, uno o varios materiales. Si no sabes cuántos metros se usan, déjalo vacío: el Core hará una estimación.</p>
    <div id="wraps"></div>`;

  const h=body.querySelector('#wraps');

  draft.groups.forEach((g,gi)=>{
    const cords=g.cordIndexes.map(i=>{
      const ci=draft.cords[i];
      const m=state.materials.cords.find(x=>x.id===ci.materialId);
      return {thicknessMm:ci.thicknessMm??m?.thicknessMm??null};
    });

    const len=C.estimateBraidLength({
      baseLengthM:base,
      strandCount:g.size,
      cords,
      measuredFinalLengthM:g.measuredFinalLengthM,
      settings:state.settings
    });

    const c=document.createElement('div');
    c.className='card';
    c.innerHTML=`
      <h3>Grupo ${gi+1} · ${glabel(g.size)}</h3>
      <div class="help" style="margin-top:5px">
        Largo final ${len.valueM!==null?'≈ '+num(len.valueM*100,1)+' cm':'desconocido'} · ${badge(len.quality)}
      </div>

      <div class="field">
        <label>Si mediste el largo final <span class="help">· opcional</span></label>
        <input data-final="${gi}" type="number" min="0" step=".1" value="${g.measuredFinalLengthM!==null?g.measuredFinalLengthM*100:''}" placeholder="No sé todavía">
      </div>

      <div class="side-title">Embarrilado</div>
      <div class="wr"></div>
      <button class="secondary add" data-gi="${gi}">+ Agregar material</button>`;

    const list=c.querySelector('.wr');

    g.wraps.forEach((w,wi)=>{
      const r=document.createElement('div');
      r.className='wrap-row';
      r.innerHTML=`
        <select data-wm="${gi}:${wi}">
          <option value="">Elegir...</option>
          ${state.materials.wraps.map(m=>`
            <option value="${m.id}" ${m.id===w.materialId?'selected':''}>${esc(m.name)}</option>`).join('')}
        </select>
        <input data-m="${gi}:${wi}" type="number" min="0" step=".01" value="${w.meters??''}" placeholder="Metros · no sé">
        <select data-src="${gi}:${wi}">
          <option value="custom" ${w.source!=='measured'?'selected':''}>aprox.</option>
          <option value="measured" ${w.source==='measured'?'selected':''}>medido</option>
        </select>
        <button class="xbtn" data-del="${gi}:${wi}">×</button>`;
      list.appendChild(r);
    });

    h.appendChild(c);
  });

  body.querySelectorAll('[data-final]').forEach(e=>{
    e.oninput=()=>{
      const v=e.value;
      draft.groups[+e.dataset.final].measuredFinalLengthM=v===''?null:Number(v)/100;
    };
  });

  body.querySelectorAll('.add').forEach(b=>{
    b.onclick=()=>{
      const gi=+b.dataset.gi;

      if(!state.materials.wraps.length){
        materialModal('wraps',m=>{
          draft.groups[gi].wraps.push({materialId:m.id,meters:null,source:'custom'});
          render({scroll:'preserve'});
        });
      }else{
        draft.groups[gi].wraps.push({
          materialId:state.materials.wraps[0].id,
          meters:null,
          source:'custom'
        });
        render({scroll:'preserve'});
      }
    };
  });

  body.querySelectorAll('[data-wm]').forEach(e=>{
    e.onchange=()=>{
      const [gi,wi]=e.dataset.wm.split(':').map(Number);
      draft.groups[gi].wraps[wi].materialId=e.value||null;
    };
  });

  body.querySelectorAll('[data-m]').forEach(e=>{
    e.oninput=()=>{
      const [gi,wi]=e.dataset.m.split(':').map(Number);
      draft.groups[gi].wraps[wi].meters=e.value===''?null:Number(e.value);
    };
  });

  body.querySelectorAll('[data-src]').forEach(e=>{
    e.onchange=()=>{
      const [gi,wi]=e.dataset.src.split(':').map(Number);
      draft.groups[gi].wraps[wi].source=e.value;
    };
  });

  body.querySelectorAll('[data-del]').forEach(e=>{
    e.onclick=()=>{
      const [gi,wi]=e.dataset.del.split(':').map(Number);
      draft.groups[gi].wraps.splice(wi,1);
      render({scroll:'preserve'});
    };
  });

  const addNew=document.createElement('button');
  addNew.className='soft';
  addNew.style.marginTop='14px';
  addNew.textContent='+ Crear otro hilo, lana o material';
  addNew.onclick=()=>materialModal('wraps',()=>render({scroll:'preserve'}));
  body.appendChild(addNew);

  nav(body);
}

function timeStep(body){
  body.innerHTML=`
    <div class="card">
      <p class="lead" style="font-size:17px">Todo aquí puede quedar pendiente. El TuconTu se guarda igual.</p>

      <div class="split">
        <div class="field">
          <label>¿Cuántos minutos te tomó?</label>
          <input id="min" type="number" min="0" value="${draft.minutes??''}" placeholder="No sé todavía">
        </div>
        <div class="field">
          <label>Valor de una hora de trabajo</label>
          <input id="hour" type="number" min="0" value="${draft.hourlyRate??''}" placeholder="No sé todavía">
        </div>
      </div>

      <div class="field">
        <label>¿Fue más trabajoso de lo habitual?</label>
        <div class="segment">
          ${[
            [0,'No'],
            [10,'Un poco · +10%'],
            [20,'Bastante · +20%']
          ].map(([v,t])=>`
            <button data-work="${v}" class="${draft.extraWorkPct===v?'active':''}">${t}</button>`
          ).join('')}
        </div>
      </div>

      <div class="field">
        <label>Precio de venta <span class="help">· opcional</span></label>
        <input id="price" type="number" min="0" value="${draft.price??''}" placeholder="No sé todavía">
      </div>

      <details>
        <summary>Ajustes opcionales de merma</summary>
        <div class="split">
          <div class="field">
            <label>Merma de cordón · %</label>
            <input id="cw" type="number" min="0" value="${draft.cordWastePct??0}">
          </div>
          <div class="field">
            <label>Merma de hilos / lanas · %</label>
            <input id="ww" type="number" min="0" value="${draft.wrapWastePct??0}">
          </div>
        </div>
        <div class="help">Parten en 0. Sólo ajústalos si quieres incorporar desperdicio real o esperado.</div>
      </details>
    </div>`;

  body.querySelectorAll('[data-work]').forEach(b=>{
    b.onclick=()=>{
      draft.extraWorkPct=+b.dataset.work;
      body.querySelectorAll('[data-work]').forEach(x=>x.classList.toggle('active',x===b));
    };
  });

  nav(body,{
    onNext:()=>{
      const get=id=>{
        const v=body.querySelector(id).value;
        return v===''?null:Number(v);
      };

      draft.minutes=get('#min');
      draft.hourlyRate=get('#hour');
      if(draft.hourlyRate!==null) state.settings.hourlyRate=draft.hourlyRate;
      draft.price=get('#price');
      draft.cordWastePct=get('#cw')??0;
      draft.wrapWastePct=get('#ww')??0;
      save();
      return true;
    }
  });
}

function resultHtml(r){
  const amount=r.complete?r.total:r.knownSubtotal;

  return `
    <div class="summary">
      <div class="metric">
        <span>Materiales conocidos</span>
        <strong>${money(r.knownMaterialCost)}</strong>
      </div>
      <div class="metric">
        <span>Tu trabajo</span>
        <strong>${money(r.laborCost)}</strong>
      </div>
      <div class="metric">
        <span>${r.complete?(r.quality==='estimated'?'Costo estimado':'Costo real'):'Costo conocido hasta ahora'}</span>
        <strong>${money(amount)}</strong>
        ${r.complete?badge(r.quality):''}
      </div>
      <div class="metric">
        <span>Precio</span>
        <strong>${r.price===null?'No definido':money(r.price)}</strong>
      </div>
    </div>

    ${r.profit!==null?`
      <div class="summary">
        <div class="metric">
          <span>Ganancia</span>
          <strong>${money(r.profit)}</strong>
        </div>
        <div class="metric">
          <span>Margen</span>
          <strong>${num(r.margin*100,1)}%</strong>
        </div>
      </div>`:''}

    ${r.unknowns.length?`
      <div class="card" style="margin-top:16px">
        <h3>Queda por completar</h3>
        <ul class="pending">
          ${r.unknowns.map(x=>`<li>${esc(x)}</li>`).join('')}
        </ul>
        <div class="help" style="margin-top:10px">Nada de esto impide guardar la pieza.</div>
      </div>`:''}

    <div class="card" style="margin-top:16px">
      <h3>Lo que calculó el Core</h3>
      ${r.groups.map((g,i)=>`
        <div class="mat">
          <strong>Grupo ${i+1} · ${glabel(g.strandCount)}</strong>
          <small>Largo final: ${g.length.valueM!==null?num(g.length.valueM*100,1)+' cm':'desconocido'} · ${qlabel(g.length.quality)}</small>
          ${g.wraps.map(w=>`
            <small>${esc(w.materialName)}: ${w.meters.valueM!==null?num(w.meters.valueM,2)+' m':'desconocido'} · ${qlabel(w.meters.quality)}</small>`
          ).join('')}
        </div>`).join('')}
    </div>`;
}

function summaryStep(body){
  const r=C.costProduct(state,draft);

  body.innerHTML=`
    <div class="card">
      <div class="kicker">${editingId?'Cambios':'Resultado provisional'}</div>
      <h3 style="font-size:30px;margin-top:8px">${esc(draft.name)}</h3>
      <div class="help">${draft.cordCount} cordones · ${draft.groups.map(g=>g.size).join(' + ')}</div>
      ${resultHtml(r)}
    </div>`;

  const a=document.createElement('div');
  a.className='actions';
  a.innerHTML=`
    <button class="secondary" id="prev">Anterior</button>
    <button class="primary" id="save">${editingId?'Guardar cambios':'Guardar TuconTu'}</button>`;

  body.appendChild(a);

  a.querySelector('#prev').onclick=()=>{
    step--;
    render({scroll:'top'});
  };

  a.querySelector('#save').onclick=()=>{
    if(editingId){
      const idx=state.products.findIndex(p=>p.id===editingId);
      if(idx>=0) state.products[idx]=deep(draft);
      activeProductId=editingId;
    }else{
      state.products.push(deep(draft));
      activeProductId=draft.id;
    }

    save();
    editingId=null;
    route='detail';
    render({scroll:'top'});
  };
}

function home(){
  app.innerHTML=`
    <section>
      <div class="kicker">TUCONTU</div>
      <h1 style="font-size:54px">Tus piezas.</h1>
      <p class="lead">El catálogo se construye mientras trabajas. Lo que todavía no sabes puede completarse después.</p>
      <button class="primary" id="newp">+ Crear otro TuconTu</button>
    </section>

    <div class="piece-list">
      ${state.products.map(p=>{
        const r=C.costProduct(state,p);
        const s=productStatus(r);
        const cost=r.complete?r.total:r.knownSubtotal;

        return `
          <article class="card piece-card">
            <div class="piece-head">
              <div>
                <h3>${esc(p.name)}</h3>
                <div class="piece-meta">${p.cordCount} cordones · ${p.groups.map(g=>g.size).join(' + ')||'sin agrupar'}</div>
                <div class="statusline">
                  <span class="dot ${s.quality}"></span>
                  ${s.text}
                </div>
              </div>
              ${badge(s.quality)}
            </div>

            <div class="summary">
              <div class="metric">
                <span>${r.complete?'Costo':'Conocido hasta ahora'}</span>
                <strong>${money(cost)}</strong>
              </div>
              <div class="metric">
                <span>Precio</span>
                <strong>${r.price===null?'No definido':money(r.price)}</strong>
              </div>
              <div class="metric">
                <span>Ganancia</span>
                <strong>${r.profit===null?'—':money(r.profit)}</strong>
              </div>
              <div class="metric">
                <span>Margen</span>
                <strong>${r.margin===null?'—':num(r.margin*100,1)+'%'}</strong>
              </div>
            </div>

            <div class="piece-actions">
              <button class="primary" data-detail="${p.id}">Ver detalle</button>
              <button class="secondary" data-edit="${p.id}">Editar</button>
            </div>
          </article>`;
      }).join('') || '<div class="card"><div class="empty">Todavía no hay piezas.</div></div>'}
    </div>`;

  document.getElementById('newp').onclick=()=>{
    draft=newDraft();
    editingId=null;
    step=0;
    goto('wizard');
  };

  app.querySelectorAll('[data-detail]').forEach(b=>{
    b.onclick=()=>openDetail(b.dataset.detail);
  });

  app.querySelectorAll('[data-edit]').forEach(b=>{
    b.onclick=()=>editProduct(b.dataset.edit,0);
  });
}

function openDetail(id){
  activeProductId=id;
  route='detail';
  render({scroll:'top'});
}

function editProduct(id,targetStep=0){
  const p=state.products.find(x=>x.id===id);
  if(!p) return;

  draft=deep(p);
  editingId=id;
  step=targetStep;
  route='wizard';
  render({scroll:'top'});
}

function detail(){
  const p=state.products.find(x=>x.id===activeProductId);
  if(!p){
    route='home';
    render({scroll:'top'});
    return;
  }

  const r=C.costProduct(state,p);
  const s=productStatus(r);
  const cost=r.complete?r.total:r.knownSubtotal;

  const cordLines=(p.cords||[]).map((ci,i)=>{
    const mat=state.materials.cords.find(m=>m.id===ci.materialId);
    const thickness=ci.thicknessMm??mat?.thicknessMm??null;
    return `
      <div class="definition">
        <div class="label">Cordón ${i+1}</div>
        <div class="value">${esc(mat?.name||'Sin material')} · ${thickness?num(thickness)+' mm':'grosor no informado'}</div>
      </div>`;
  }).join('');

  const targets=r.total!==null
    ? [0.40,0.50,0.60,0.70].map(m=>`
        <div class="target">
          <span>${Math.round(m*100)}% de margen</span>
          <strong>${money(C.priceForMargin(r.total,m))}</strong>
        </div>`).join('')
    : `<div class="empty">Cuando el costo esté completo aparecerán referencias de precio.</div>`;

  app.innerHTML=`
    <div class="backline">
      <button class="text-btn" id="backHome">← Volver a tus piezas</button>
    </div>

    <div class="detail-head">
      <div>
        <div class="kicker">Ficha de pieza</div>
        <h1 style="font-size:52px">${esc(p.name)}</h1>
        <div class="statusline">
          <span class="dot ${s.quality}"></span>
          ${s.text}
        </div>
      </div>
      <button class="primary" id="editAll">Editar pieza</button>
    </div>

    <section class="card">
      <div class="section-head">
        <h3>Resumen</h3>
        ${badge(s.quality)}
      </div>

      <div class="summary">
        <div class="metric">
          <span>${r.complete?'Costo':'Conocido hasta ahora'}</span>
          <strong>${money(cost)}</strong>
        </div>
        <div class="metric">
          <span>Precio</span>
          <strong>${r.price===null?'No definido':money(r.price)}</strong>
        </div>
        <div class="metric">
          <span>Ganancia</span>
          <strong>${r.profit===null?'—':money(r.profit)}</strong>
        </div>
        <div class="metric">
          <span>Margen</span>
          <strong>${r.margin===null?'—':num(r.margin*100,1)+'%'}</strong>
        </div>
      </div>
    </section>

    <section class="section commercial-grid">
      <div class="card">
        <div class="section-head">
          <h3>Venta</h3>
          <button class="secondary" id="editSale">Editar precio y tiempo</button>
        </div>

        <div class="definition">
          <div class="label">Materiales conocidos</div>
          <div class="value">${money(r.knownMaterialCost)}</div>
        </div>
        <div class="definition">
          <div class="label">Tu trabajo</div>
          <div class="value">${money(r.laborCost)}</div>
        </div>
        <div class="definition">
          <div class="label">${r.complete?'Costo total':'Costo conocido'}</div>
          <div class="value">${money(cost)}</div>
        </div>
        <div class="definition">
          <div class="label">Precio actual</div>
          <div class="value">${r.price===null?'Todavía no definido':money(r.price)}</div>
        </div>
        <div class="definition">
          <div class="label">Ganancia</div>
          <div class="value">${r.profit===null?'—':money(r.profit)}</div>
        </div>
        <div class="definition">
          <div class="label">Margen</div>
          <div class="value">${r.margin===null?'—':num(r.margin*100,1)+'%'}</div>
        </div>
      </div>

      <div class="card">
        <h3>Referencias de precio</h3>
        <div class="help" style="margin-top:6px">No cambian tu precio. Sólo sirven como orientación.</div>
        <div class="target-list">${targets}</div>
      </div>
    </section>

    <section class="section card">
      <div class="section-head">
        <h3>Construcción</h3>
        <button class="secondary" id="editBuild">Editar construcción</button>
      </div>

      <div class="definition">
        <div class="label">Tamaño</div>
        <div class="value">${sizeText(p)}</div>
      </div>
      <div class="definition">
        <div class="label">Cordones</div>
        <div class="value">${p.cordCount}</div>
      </div>
      <div class="definition">
        <div class="label">Combinación</div>
        <div class="value">${p.groups.map(g=>g.size).join(' + ')||'sin agrupar'}</div>
      </div>

      <div style="margin-top:14px">${cordLines}</div>
    </section>

    <section class="section card">
      <div class="section-head">
        <h3>Trenzas y embarrilado</h3>
        <button class="secondary" id="editWrap">Editar embarrilado</button>
      </div>

      ${r.groups.map((g,i)=>`
        <div class="group-detail">
          <div class="group-title">
            <h4>Grupo ${i+1} · ${glabel(g.strandCount)}</h4>
            ${badge(g.length.quality)}
          </div>
          <div class="group-sub">
            Largo final: ${g.length.valueM!==null?num(g.length.valueM*100,1)+' cm':'desconocido'}
          </div>

          ${g.wraps.length
            ? g.wraps.map(w=>`
                <div class="wrap-detail">
                  <strong>${esc(w.materialName)}</strong>
                  <div class="group-sub">
                    ${w.meters.valueM!==null?num(w.meters.valueM,2)+' m':'consumo desconocido'} · ${qlabel(w.meters.quality)}
                    ${w.cost!==null?` · ${money(w.cost)}`:''}
                  </div>
                </div>`).join('')
            : '<div class="group-sub" style="margin-top:8px">Sin embarrilado registrado.</div>'}
        </div>`).join('')}
    </section>

    ${r.unknowns.length?`
      <section class="section card">
        <h3>Datos pendientes</h3>
        <ul class="pending">${r.unknowns.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        <div class="help" style="margin-top:10px">La pieza sigue siendo válida; estos datos sólo mejorarían la estimación.</div>
      </section>`:''}
  `;

  document.getElementById('backHome').onclick=()=>goto('home');
  document.getElementById('editAll').onclick=()=>editProduct(p.id,0);
  document.getElementById('editSale').onclick=()=>editProduct(p.id,5);
  document.getElementById('editBuild').onclick=()=>editProduct(p.id,0);
  document.getElementById('editWrap').onclick=()=>editProduct(p.id,4);
}

function materialModal(kind,done){
  const title={
    colets:'Nuevo colet',
    cords:'Nuevo cordón',
    wraps:'Nuevo material para embarrilar'
  }[kind];

  const unit=kind==='colets'?'unidad':'metro';
  let mode='unknown';

  modal.innerHTML=`
    <div class="modal-bg">
      <div class="modal">
        <div class="modal-head">
          <div>
            <div class="kicker">Tus materiales</div>
            <h2>${title}</h2>
          </div>
          <button class="close">×</button>
        </div>

        <div class="field">
          <label>Nombre <span class="help">· opcional</span></label>
          <input id="mn" placeholder="Nombre">
        </div>

        ${kind==='cords'?`
          <div class="field">
            <label>Grosor · mm <span class="help">· opcional</span></label>
            <input id="mt" type="number" min="0" step=".1" placeholder="No sé todavía">
          </div>`:''}

        <div class="field">
          <label>¿Sabes cuánto cuesta?</label>
          <div class="segment">
            ${[
              ['unknown','No sé'],
              ['direct','Sé el costo por '+unit],
              ['purchase','Tengo una compra']
            ].map(([v,t])=>`
              <button data-mode="${v}" class="${v==='unknown'?'active':''}">${t}</button>`
            ).join('')}
          </div>
        </div>

        <div id="direct" class="hidden">
          <div class="field">
            <label>Costo por ${unit}</label>
            <input id="uc" type="number" min="0" placeholder="$">
          </div>
        </div>

        <div id="purchase" class="hidden">
          <div class="split">
            <div class="field">
              <label>${kind==='colets'?'Unidades':'Metros'} comprados</label>
              <input id="pq" type="number" min="0" step=".01">
            </div>
            <div class="field">
              <label>Total pagado</label>
              <input id="pt" type="number" min="0" placeholder="$">
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="secondary cancel">Cancelar</button>
          <button class="primary create">Guardar material</button>
        </div>
      </div>
    </div>`;

  const close=()=>modal.innerHTML='';

  modal.querySelector('.close').onclick=close;
  modal.querySelector('.cancel').onclick=close;
  modal.querySelector('.modal-bg').onclick=e=>{
    if(e.target.classList.contains('modal-bg')) close();
  };

  const keyClose=e=>{
    if(e.key==='Escape'){
      close();
      document.removeEventListener('keydown',keyClose);
    }
  };
  document.addEventListener('keydown',keyClose);

  modal.querySelectorAll('[data-mode]').forEach(b=>{
    b.onclick=()=>{
      mode=b.dataset.mode;
      modal.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));
      modal.querySelector('#direct').classList.toggle('hidden',mode!=='direct');
      modal.querySelector('#purchase').classList.toggle('hidden',mode!=='purchase');
    };
  });

  modal.querySelector('.create').onclick=()=>{
    let cost=C.makeCostUnknown();

    if(mode==='direct'){
      cost=C.makeCostDirect(modal.querySelector('#uc').value);
    }
    if(mode==='purchase'){
      cost=C.makeCostPurchase(
        modal.querySelector('#pq').value,
        modal.querySelector('#pt').value
      );
    }

    const m={
      id:C.uid(kind.slice(0,-1)),
      name:modal.querySelector('#mn').value.trim()||({
        colets:'Colet',
        cords:'Cordón',
        wraps:'Material'
      }[kind]),
      cost,
      createdAt:C.today()
    };

    if(kind==='cords'){
      const v=modal.querySelector('#mt').value;
      m.thicknessMm=v===''?null:Number(v);
    }

    if(kind==='wraps') m.baseRatePerM=null;

    state.materials[kind].push(m);
    save();
    close();
    document.removeEventListener('keydown',keyClose);
    if(done) done(m);
  };
}

function exportData(){
  const b=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);
  a.download='tucontu-respaldo-'+C.today()+'.json';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

document.getElementById('brandBtn').onclick=()=>{
  if(state.products.length) goto('home');
  else goto('intro');
};

document.getElementById('exportBtn').onclick=exportData;

document.getElementById('resetBtn').onclick=()=>{
  if(confirm('¿Reiniciar esta prueba? Se borrarán los datos guardados en este navegador.')){
    localStorage.removeItem(KEY);
    state=C.defaultState();
    draft=newDraft();
    editingId=null;
    activeProductId=null;
    route='intro';
    step=0;
    render({scroll:'top'});
  }
};

render({scroll:'top'});
})();
