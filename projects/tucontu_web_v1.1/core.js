(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TUCONTU_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "tucontu.core/1.0";
  const DATA_SCHEMA = "tucontu.data/1.0";

  const QUALITY = Object.freeze({ unknown: 0, estimated: 1, custom: 2, measured: 3 });
  const DEFAULT_BRAID_RATIOS = Object.freeze({
    1: 1.00, 2: 0.90, 3: 0.78, 4: 0.66, 5: 0.55,
    6: 0.46, 7: 0.37, 8: 0.30, 9: 0.24
  });

  const uid = (prefix="id") => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,9)}`;
  const today = () => new Date().toISOString().slice(0,10);
  const finiteOrNull = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) ? null : Number(v);
  const round = (n,d=4) => Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 10**d) / 10**d : null;

  function stateQuality(...qualities){
    const valid = qualities.filter(Boolean);
    if(!valid.length) return "unknown";
    const min = Math.min(...valid.map(q=>QUALITY[q] ?? 0));
    return Object.keys(QUALITY).find(k=>QUALITY[k]===min) || "unknown";
  }

  function defaultState(){
    return {
      schema: DATA_SCHEMA,
      coreVersion: VERSION,
      settings: {
        sizeLengthsM: {S:0.30, M:0.60, L:0.80},
        braidRatios: {...DEFAULT_BRAID_RATIOS},
        thicknessReferenceMm: 3,
        braidThicknessCorrectionCmPerMPerMm: 2,
        wrapGenericBaseRatePerM: 1.0,
        wrapThicknessPctPerMm: 0.08,
        hourlyRate: null,
        defaultCordWastePct: 0,
        defaultWrapWastePct: 0
      },
      materials: { colets:[], cords:[], wraps:[] },
      products: []
    };
  }

  const makeCostUnknown = () => ({mode:"unknown",unitCost:null,purchaseQty:null,purchaseTotal:null,updatedAt:today()});
  const makeCostDirect = unitCost => ({mode:"direct",unitCost:finiteOrNull(unitCost),purchaseQty:null,purchaseTotal:null,updatedAt:today()});
  const makeCostPurchase = (qty,total) => ({mode:"purchase",unitCost:null,purchaseQty:finiteOrNull(qty),purchaseTotal:finiteOrNull(total),updatedAt:today()});

  function deriveUnitCost(cost){
    if(!cost || cost.mode === "unknown") return {value:null,quality:"unknown",provenance:"Costo todavía desconocido"};
    if(cost.mode === "direct"){
      const value = finiteOrNull(cost.unitCost);
      return {value,quality:value===null?"unknown":"custom",provenance:value===null?"Costo todavía desconocido":"Ingresado directamente"};
    }
    if(cost.mode === "purchase"){
      const qty = finiteOrNull(cost.purchaseQty), total = finiteOrNull(cost.purchaseTotal);
      if(qty===null || total===null || qty<=0) return {value:null,quality:"unknown",provenance:"Compra incompleta"};
      return {value:total/qty,quality:"measured",provenance:`Calculado desde ${qty} por ${total}`};
    }
    return {value:null,quality:"unknown",provenance:"Costo todavía desconocido"};
  }

  function validateGrouping(cordCount, groups){
    const count = Number(cordCount);
    if(!Number.isInteger(count) || count<1 || count>9) return {ok:false,reason:"La cantidad de cordones debe estar entre 1 y 9."};
    if(!Array.isArray(groups) || !groups.length) return {ok:false,reason:"Falta indicar cómo se usarán los cordones."};
    const sum = groups.reduce((a,g)=>a+Number(g.size || g.cordIndexes?.length || 0),0);
    if(sum!==count) return {ok:false,reason:`La combinación usa ${sum} de ${count} cordones.`};
    if(groups.some(g=>{const n=Number(g.size || g.cordIndexes?.length || 0);return !Number.isInteger(n)||n<1||n>9;})) return {ok:false,reason:"Cada grupo debe contener entre 1 y 9 cordones."};
    return {ok:true,reason:null};
  }

  function avgKnownThickness(cords){
    const vals=(cords||[]).map(c=>finiteOrNull(c.thicknessMm)).filter(v=>v!==null&&v>0);
    if(!vals.length) return {value:null,complete:false};
    return {value:vals.reduce((a,b)=>a+b,0)/vals.length,complete:vals.length===(cords||[]).length};
  }

  function estimateBraidLength({baseLengthM,strandCount,cords=[],measuredFinalLengthM=null,customFinalLengthM=null,settings}){
    const measured=finiteOrNull(measuredFinalLengthM);
    if(measured!==null&&measured>=0) return {valueM:measured,quality:"measured",method:"medido",notes:[]};
    const custom=finiteOrNull(customFinalLengthM);
    if(custom!==null&&custom>=0) return {valueM:custom,quality:"custom",method:"personalizado",notes:[]};
    const n=Number(strandCount), ratio=finiteOrNull(settings?.braidRatios?.[n]), base=finiteOrNull(baseLengthM);
    if(ratio===null||base===null) return {valueM:null,quality:"unknown",method:"desconocido",notes:["No hay suficiente información para estimar el largo final."]};
    let result=base*ratio;
    const t=avgKnownThickness(cords);
    const ref=finiteOrNull(settings?.thicknessReferenceMm)??3;
    const correction=finiteOrNull(settings?.braidThicknessCorrectionCmPerMPerMm)??0;
    const notes=[`Ratio base para ${n} cordón${n===1?"":"es"}: ${ratio}.`];
    if(t.value!==null){
      result -= base*(t.value-ref)*correction/100;
      notes.push(`Corrección por grosor medio ${round(t.value,2)} mm.`);
      if(!t.complete) notes.push("Hay cordones sin grosor conocido; la corrección usa sólo los grosores disponibles.");
    } else notes.push("Grosor desconocido: se usa sólo el ratio base.");
    return {valueM:round(Math.max(0,result),4),quality:"estimated",method:"estimado",notes};
  }

  function estimateWrapMeters({baseLengthM,strandCount,cords=[],wrapMaterial=null,explicitMeters=null,explicitSource=null,settings}){
    const explicit=finiteOrNull(explicitMeters);
    if(explicit!==null&&explicit>=0){
      const q=explicitSource==="measured"?"measured":"custom";
      return {valueM:explicit,quality:q,method:q==="measured"?"medido":"personalizado",notes:[]};
    }
    const base=finiteOrNull(baseLengthM), n=Number(strandCount);
    if(base===null||!Number.isFinite(n)||n<1) return {valueM:null,quality:"unknown",method:"desconocido",notes:["No hay suficiente información para estimar el consumo."]};
    const materialRate=finiteOrNull(wrapMaterial?.baseRatePerM);
    const genericRate=finiteOrNull(settings?.wrapGenericBaseRatePerM);
    const baseRate=materialRate??genericRate;
    if(baseRate===null) return {valueM:null,quality:"unknown",method:"desconocido",notes:["No existe una referencia para estimar este material."]};
    let meters=base*baseRate*Math.sqrt(n);
    const notes=[materialRate!==null?"Se usa la referencia propia de este material.":"Se usa la referencia inicial genérica."];
    const t=avgKnownThickness(cords), ref=finiteOrNull(settings?.thicknessReferenceMm)??3, pct=finiteOrNull(settings?.wrapThicknessPctPerMm)??0;
    if(t.value!==null){
      meters*=Math.max(0,1+(t.value-ref)*pct);
      notes.push(`Corrección por grosor medio ${round(t.value,2)} mm.`);
      if(!t.complete) notes.push("Hay grosores desconocidos; la estimación usa los disponibles.");
    } else notes.push("Grosor desconocido: no se aplica corrección por grosor.");
    return {valueM:round(meters,4),quality:"estimated",method:"estimado",notes};
  }

  const materialById=(state,kind,id)=>id?(state?.materials?.[kind]||[]).find(m=>m.id===id)||null:null;
  function baseLengthForProduct(state,product){
    const custom=finiteOrNull(product.customLengthM);
    if(custom!==null&&custom>0) return custom;
    return finiteOrNull(state?.settings?.sizeLengthsM?.[product.sizeKey])??null;
  }
  function productCordInstances(state,product){
    return (product.cords||[]).map((ci,index)=>{
      const material=materialById(state,"cords",ci.materialId);
      return {index,material,thicknessMm:finiteOrNull(ci.thicknessMm)??finiteOrNull(material?.thicknessMm)};
    });
  }

  function costProduct(state,product){
    const settings=state.settings||{}, baseLengthM=baseLengthForProduct(state,product), unknowns=[], details=[], qualities=[];
    const colet=materialById(state,"colets",product.coletId);
    let coletCost=null;
    if(colet){
      const uc=deriveUnitCost(colet.cost);
      if(uc.value!==null){coletCost=uc.value;qualities.push(uc.quality);} else unknowns.push("Falta el costo del colet.");
    } else unknowns.push("Falta elegir un colet.");

    const cordWastePct=finiteOrNull(product.cordWastePct)??finiteOrNull(settings.defaultCordWastePct)??0;
    const wrapWastePct=finiteOrNull(product.wrapWastePct)??finiteOrNull(settings.defaultWrapWastePct)??0;
    let cordCostKnown=0, cordCostComplete=true;
    const cordInstances=productCordInstances(state,product);
    cordInstances.forEach((ci,i)=>{
      if(!ci.material){cordCostComplete=false;unknowns.push(`Falta el material del cordón ${i+1}.`);return;}
      const uc=deriveUnitCost(ci.material.cost);
      if(uc.value===null||baseLengthM===null){cordCostComplete=false;unknowns.push(`Falta información de costo para ${ci.material.name||`cordón ${i+1}`}.`);return;}
      const usedM=baseLengthM*(1+cordWastePct/100), c=usedM*uc.value;
      cordCostKnown+=c;qualities.push(uc.quality);details.push({type:"cord",label:ci.material.name||`Cordón ${i+1}`,amount:c,meters:usedM,quality:uc.quality});
    });

    const grouping=validateGrouping(product.cordCount,product.groups||[]);
    if(!grouping.ok) unknowns.push(grouping.reason);
    let wrapCostKnown=0, wrapCostComplete=true;
    const groupResults=[];

    (product.groups||[]).forEach((group,gi)=>{
      const idxs=Array.isArray(group.cordIndexes)?group.cordIndexes:[];
      const cords=idxs.map(i=>cordInstances[i]).filter(Boolean), n=idxs.length||Number(group.size||0);
      const length=estimateBraidLength({baseLengthM,strandCount:n,cords,measuredFinalLengthM:group.measuredFinalLengthM,customFinalLengthM:group.customFinalLengthM,settings});
      if(length.quality!=="unknown") qualities.push(length.quality);
      const wraps=[];
      (group.wraps||[]).forEach(wi=>{
        const material=materialById(state,"wraps",wi.materialId);
        if(!material){wrapCostComplete=false;unknowns.push(`Falta un material de embarrilado en el grupo ${gi+1}.`);return;}
        const meters=estimateWrapMeters({baseLengthM,strandCount:n,cords,wrapMaterial:material,explicitMeters:wi.meters,explicitSource:wi.source,settings});
        const uc=deriveUnitCost(material.cost), withWaste=meters.valueM===null?null:meters.valueM*(1+wrapWastePct/100);
        let cost=null;
        if(withWaste!==null&&uc.value!==null){cost=withWaste*uc.value;wrapCostKnown+=cost;qualities.push(stateQuality(meters.quality,uc.quality));}
        else {wrapCostComplete=false;if(uc.value===null) unknowns.push(`Falta el costo de ${material.name||"un material de embarrilado"}.`);if(withWaste===null) unknowns.push(`No se puede estimar cuánto ${material.name||"material"} usa el grupo ${gi+1}.`);}
        wraps.push({materialId:material.id,materialName:material.name,meters,metersWithWasteM:withWaste,cost,unitCost:uc});
      });
      groupResults.push({index:gi,strandCount:n,length,wraps});
    });

    let laborCost=null;
    const minutes=finiteOrNull(product.minutes), hourlyRate=finiteOrNull(product.hourlyRate)??finiteOrNull(settings.hourlyRate), extraWorkPct=finiteOrNull(product.extraWorkPct)??0;
    if(minutes!==null&&hourlyRate!==null){laborCost=minutes*(hourlyRate/60)*(1+extraWorkPct/100);qualities.push("custom");}
    else {if(minutes===null) unknowns.push("Tiempo todavía desconocido.");if(hourlyRate===null) unknowns.push("Valor de la hora todavía desconocido.");}

    const knownMaterialCost=(coletCost??0)+cordCostKnown+wrapCostKnown;
    const materialComplete=coletCost!==null&&cordCostComplete&&wrapCostComplete&&grouping.ok;
    const knownSubtotal=knownMaterialCost+(laborCost??0), complete=materialComplete&&laborCost!==null, total=complete?knownSubtotal:null;
    const quality=complete?stateQuality(...qualities):"unknown";
    const price=finiteOrNull(product.price), profit=total!==null&&price!==null?price-total:null, margin=profit!==null&&price>0?profit/price:null, markup=profit!==null&&total>0?profit/total:null;
    return {baseLengthM,grouping,coletCost,cordCostKnown,wrapCostKnown,materialCost:materialComplete?knownMaterialCost:null,knownMaterialCost,laborCost,knownSubtotal,complete,total,quality,price,profit,margin,markup,unknowns:[...new Set(unknowns)],groups:groupResults,details};
  }

  function priceForMargin(cost,margin){
    const c=finiteOrNull(cost),m=finiteOrNull(margin);
    if(c===null||m===null||m>=1||m<0) return null;
    return c/(1-m);
  }

  return {VERSION,DATA_SCHEMA,QUALITY,DEFAULT_BRAID_RATIOS,uid,today,round,finiteOrNull,stateQuality,defaultState,deriveUnitCost,makeCostUnknown,makeCostDirect,makeCostPurchase,validateGrouping,estimateBraidLength,estimateWrapMeters,costProduct,priceForMargin};
});
