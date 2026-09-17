
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.TUCONTU_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "tucontu.core/1.3";
  const DATA_SCHEMA = "tucontu.data/1.3";
  const PREVIOUS_SCHEMAS = new Set(["tucontu.data/1.2", "tucontu.data/1.1", "tucontu.data/1.0"]);

  const QUALITY = Object.freeze({
    unknown: 0,
    estimated: 1,
    custom: 2,
    measured: 3
  });

  const GROUP_KIND = Object.freeze({
    loose: "loose",
    spiral: "spiral",
    braid: "braid"
  });

  const DEFAULT_LENGTH_RULES = Object.freeze({
    referenceCm: 30,
    looseFinalCm: 30,
    spiralFinalCm: 29,
    braidFinalCm: 27
  });

  const uid = (prefix = "id") =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

  const today = () => new Date().toISOString().slice(0, 10);

  const finiteOrNull = value => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const round = (n, digits = 4) => {
    if (!Number.isFinite(n)) return null;
    const p = 10 ** digits;
    return Math.round((n + Number.EPSILON) * p) / p;
  };

  const clone = value => JSON.parse(JSON.stringify(value));

  function stateQuality(...qualities) {
    const valid = qualities.filter(Boolean);
    if (!valid.length) return "unknown";
    const min = Math.min(...valid.map(q => QUALITY[q] ?? 0));
    return Object.keys(QUALITY).find(k => QUALITY[k] === min) || "unknown";
  }

  function groupKind(strandCount) {
    const n = Number(strandCount);
    if (n === 1) return GROUP_KIND.loose;
    if (n === 2) return GROUP_KIND.spiral;
    if (Number.isInteger(n) && n >= 3) return GROUP_KIND.braid;
    return null;
  }

  function groupKindLabel(strandCount) {
    const kind = groupKind(strandCount);
    if (kind === GROUP_KIND.loose) return "Cordón suelto";
    if (kind === GROUP_KIND.spiral) return "Espiral";
    if (kind === GROUP_KIND.braid) return "Trenza";
    return "Grupo inválido";
  }

  function defaultState() {
    return {
      schema: DATA_SCHEMA,
      coreVersion: VERSION,
      settings: {
        sizeLengthsM: { S: 0.30, M: 0.60, L: 0.80 },
        lengthRules: { ...DEFAULT_LENGTH_RULES },
        thicknessReferenceMm: 3,
        braidThicknessCorrectionCmPerMPerMm: 2,
        wrapGenericBaseRatePerM: 1.0,
        wrapThicknessPctPerMm: 0.08,
        hourlyRate: null,
        defaultCordWastePct: 0,
        defaultWrapWastePct: 0,
        defaultTargetMargin: 0.50,
        priceRounding: 100
      },
      materials: {
        colets: [],
        cords: [],
        wraps: [],
        packaging: []
      },
      packagingTemplates: [],
      products: []
    };
  }

  const makeCostUnknown = () => ({
    mode: "unknown", unitCost: null, purchaseQty: null, purchaseTotal: null, updatedAt: today()
  });

  const makeCostDirect = unitCost => ({
    mode: "direct", unitCost: finiteOrNull(unitCost), purchaseQty: null, purchaseTotal: null, updatedAt: today()
  });

  const makeCostPurchase = (qty, total) => ({
    mode: "purchase", unitCost: null, purchaseQty: finiteOrNull(qty), purchaseTotal: finiteOrNull(total), updatedAt: today()
  });

  function deriveUnitCost(cost) {
    if (!cost || cost.mode === "unknown") {
      return {
        value: null,
        quality: "unknown",
        provenance: "Costo todavía desconocido"
      };
    }

    if (cost.mode === "direct") {
      const value = finiteOrNull(cost.unitCost);
      return {
        value,
        quality: value === null ? "unknown" : "custom",
        provenance:
          value === null
            ? "Costo todavía desconocido"
            : "Ingresado directamente"
      };
    }

    if (cost.mode === "purchase") {
      const qty = finiteOrNull(cost.purchaseQty);
      const total = finiteOrNull(cost.purchaseTotal);

      if (qty === null || total === null || qty <= 0) {
        return {
          value: null,
          quality: "unknown",
          provenance: "Compra incompleta"
        };
      }

      return {
        value: total / qty,
        quality: "measured",
        provenance: `Calculado desde ${qty} por ${total}`
      };
    }

    return {
      value: null,
      quality: "unknown",
      provenance: "Costo todavía desconocido"
    };
  }

  function materialById(state, kind, id) {
    if (!id) return null;
    return (state?.materials?.[kind] || []).find(m => m.id === id) || null;
  }

  function materialSnapshot(material) {
    if (!material) {
      return {
        materialId: null,
        unitCost: null,
        quality: "unknown",
        provenance: "Material ausente",
        materialName: null
      };
    }

    const uc = deriveUnitCost(material.cost);
    return {
      materialId: material.id,
      materialName: material.name || null,
      unit: material.unit || null,
      unitCost: uc.value,
      quality: uc.quality,
      provenance: uc.provenance,
      costUpdatedAt: material?.cost?.updatedAt || null
    };
  }

  function collectReferencedMaterialIds(product) {
    const ids = {
      colets: new Set(), cords: new Set(), wraps: new Set(), packaging: new Set()
    };
    if (product?.coletId) ids.colets.add(product.coletId);
    (product?.cords || []).forEach(c => { if (c?.materialId) ids.cords.add(c.materialId); });
    (product?.groups || []).forEach(g => {
      (g?.wraps || []).forEach(w => { if (w?.materialId) ids.wraps.add(w.materialId); });
    });
    (product?.packaging?.items || []).forEach(i => {
      if (i?.materialId) ids.packaging.add(i.materialId);
    });
    return ids;
  }

  function snapshotProductCosts(state, product, options = {}) {
    const ids = collectReferencedMaterialIds(product);
    const capturedAt = options.capturedAt !== undefined ? options.capturedAt : product?.createdAt || null;
    const snapshot = {
      schema: "tucontu.cost-snapshot/1.1", capturedAt,
      source: options.source || "catalog-at-save",
      colets: {}, cords: {}, wraps: {}, packaging: {}
    };
    for (const kind of ["colets", "cords", "wraps", "packaging"]) {
      for (const id of ids[kind]) {
        snapshot[kind][id] = materialSnapshot(materialById(state, kind, id));
      }
    }
    return snapshot;
  }

  function withCostSnapshot(state, product, options = {}) {
    const next = clone(product);
    next.costSnapshot = snapshotProductCosts(state, next, options);
    return next;
  }

  function rebaseProductCosts(state, product, options = {}) {
    return withCostSnapshot(state, product, {
      capturedAt:
        options.capturedAt !== undefined
          ? options.capturedAt
          : null,
      source: options.source || "explicit-rebase-to-current-catalog"
    });
  }

  function snapshotUnitCost(product, kind, materialId) {
    const entry = product?.costSnapshot?.[kind]?.[materialId];
    if (!entry) return null;

    return {
      value: finiteOrNull(entry.unitCost),
      quality: entry.quality || "unknown",
      provenance:
        entry.provenance || "Costo histórico guardado",
      materialName: entry.materialName || null,
      costUpdatedAt: entry.costUpdatedAt || null,
      source: "snapshot"
    };
  }

  function resolveUnitCost(state, product, kind, materialId, priceMode = "snapshot") {
    if (priceMode === "snapshot") {
      const historical = snapshotUnitCost(product, kind, materialId);
      if (historical) return historical;
    }

    const material = materialById(state, kind, materialId);
    const current = deriveUnitCost(material?.cost);

    return {
      ...current,
      materialName: material?.name || null,
      costUpdatedAt: material?.cost?.updatedAt || null,
      source: "catalog"
    };
  }

  function validateGrouping(cordCount, groups) {
    const count = Number(cordCount);

    if (!Number.isInteger(count) || count < 1 || count > 9) {
      return {
        ok: false,
        reason: "La cantidad de cordones debe estar entre 1 y 9."
      };
    }

    if (!Array.isArray(groups) || !groups.length) {
      return {
        ok: false,
        reason: "Falta indicar cómo se usarán los cordones."
      };
    }

    const sizes = groups.map(g =>
      Number(
        Array.isArray(g?.cordIndexes)
          ? g.cordIndexes.length
          : g?.size || 0
      )
    );

    if (
      sizes.some(
        n => !Number.isInteger(n) || n < 1 || n > 9
      )
    ) {
      return {
        ok: false,
        reason: "Cada grupo debe contener entre 1 y 9 cordones."
      };
    }

    const sum = sizes.reduce((a, b) => a + b, 0);
    if (sum !== count) {
      return {
        ok: false,
        reason: `La combinación usa ${sum} de ${count} cordones.`
      };
    }

    const allHaveIndexes = groups.every(g =>
      Array.isArray(g?.cordIndexes)
    );

    if (allHaveIndexes) {
      const all = groups.flatMap(g => g.cordIndexes);

      if (
        all.some(
          i =>
            !Number.isInteger(Number(i)) ||
            Number(i) < 0 ||
            Number(i) >= count
        )
      ) {
        return {
          ok: false,
          reason: "Hay un cordón fuera del rango de esta pieza."
        };
      }

      const normalized = all.map(Number);
      const unique = new Set(normalized);

      if (unique.size !== normalized.length) {
        return {
          ok: false,
          reason: "Un mismo cordón aparece en más de un grupo."
        };
      }

      if (unique.size !== count) {
        return {
          ok: false,
          reason: "No todos los cordones están asignados exactamente una vez."
        };
      }
    }

    return { ok: true, reason: null };
  }

  function avgKnownThickness(cords) {
    const vals = (cords || [])
      .map(c => finiteOrNull(c?.thicknessMm))
      .filter(v => v !== null && v > 0);

    if (!vals.length) {
      return { value: null, complete: false };
    }

    return {
      value: vals.reduce((a, b) => a + b, 0) / vals.length,
      complete: vals.length === (cords || []).length
    };
  }

  function lengthRuleRatio(strandCount, settings) {
    const kind = groupKind(strandCount);
    const rules = settings?.lengthRules || DEFAULT_LENGTH_RULES;
    const ref = finiteOrNull(rules.referenceCm) ?? 30;
    if (ref <= 0) return null;
    let finalCm = null;
    if (kind === GROUP_KIND.loose) finalCm = finiteOrNull(rules.looseFinalCm);
    if (kind === GROUP_KIND.spiral) finalCm = finiteOrNull(rules.spiralFinalCm);
    if (kind === GROUP_KIND.braid) finalCm = finiteOrNull(rules.braidFinalCm);
    if (finalCm === null) return null;
    return finalCm / ref;
  }

  function estimateBraidLength({
    baseLengthM, strandCount, cords = [], measuredFinalLengthM = null,
    customFinalLengthM = null, settings
  }) {
    const measured = finiteOrNull(measuredFinalLengthM);
    if (measured !== null && measured >= 0) return { valueM: measured, quality: "measured", method: "medido", notes: [] };
    const custom = finiteOrNull(customFinalLengthM);
    if (custom !== null && custom >= 0) return { valueM: custom, quality: "custom", method: "personalizado", notes: [] };
    const n = Number(strandCount);
    const ratio = lengthRuleRatio(n, settings);
    const base = finiteOrNull(baseLengthM);
    if (ratio === null || base === null) return { valueM: null, quality: "unknown", method: "desconocido", notes: ["No hay suficiente información para estimar el largo final."] };
    const kind = groupKind(n);
    let result = base * ratio;
    const notes = [`Regla ${groupKindLabel(n)}: ${(ratio*100).toFixed(1)}% del largo base.`];
    if (kind !== GROUP_KIND.loose) {
      const t = avgKnownThickness(cords);
      const ref = finiteOrNull(settings?.thicknessReferenceMm) ?? 3;
      const correction = finiteOrNull(settings?.braidThicknessCorrectionCmPerMPerMm) ?? 0;
      if (t.value !== null) {
        result -= (base * (t.value - ref) * correction) / 100;
        notes.push(`Corrección por grosor medio ${round(t.value, 2)} mm.`);
        if (!t.complete) notes.push("Hay cordones sin grosor conocido; la corrección usa sólo los grosores disponibles.");
      } else notes.push("Grosor desconocido: se usa sólo la regla base.");
    }
    return { valueM: round(Math.max(0, result), 4), quality: "estimated", method: "estimado", notes };
  }

  function estimateWrapMeters({
    baseLengthM,
    strandCount,
    cords = [],
    wrapMaterial = null,
    explicitMeters = null,
    explicitSource = null,
    settings
  }) {
    const explicit = finiteOrNull(explicitMeters);

    if (explicit !== null && explicit >= 0) {
      const q =
        explicitSource === "measured"
          ? "measured"
          : "custom";

      return {
        valueM: explicit,
        quality: q,
        method:
          q === "measured"
            ? "medido"
            : "personalizado",
        notes: []
      };
    }

    const base = finiteOrNull(baseLengthM);
    const n = Number(strandCount);

    if (
      base === null ||
      !Number.isFinite(n) ||
      n < 1
    ) {
      return {
        valueM: null,
        quality: "unknown",
        method: "desconocido",
        notes: [
          "No hay suficiente información para estimar el consumo."
        ]
      };
    }

    const materialRate =
      finiteOrNull(wrapMaterial?.baseRatePerM);

    const genericRate =
      finiteOrNull(settings?.wrapGenericBaseRatePerM);

    const baseRate =
      materialRate ?? genericRate;

    if (baseRate === null) {
      return {
        valueM: null,
        quality: "unknown",
        method: "desconocido",
        notes: [
          "No existe una referencia para estimar este material."
        ]
      };
    }

    let meters =
      base * baseRate * Math.sqrt(n);

    const notes = [
      materialRate !== null
        ? "Se usa la referencia propia de este material."
        : "Se usa la referencia inicial genérica."
    ];

    const t = avgKnownThickness(cords);
    const ref =
      finiteOrNull(settings?.thicknessReferenceMm) ?? 3;

    const pct =
      finiteOrNull(settings?.wrapThicknessPctPerMm) ?? 0;

    if (t.value !== null) {
      meters *= Math.max(
        0,
        1 + (t.value - ref) * pct
      );

      notes.push(
        `Corrección por grosor medio ${round(t.value, 2)} mm.`
      );

      if (!t.complete) {
        notes.push(
          "Hay grosores desconocidos; la estimación usa los disponibles."
        );
      }
    } else {
      notes.push(
        "Grosor desconocido: no se aplica corrección por grosor."
      );
    }

    return {
      valueM: round(meters, 4),
      quality: "estimated",
      method: "estimado",
      notes
    };
  }

  function baseLengthForProduct(state, product) {
    const custom =
      finiteOrNull(product?.customLengthM);

    if (custom !== null && custom > 0) {
      return custom;
    }

    return (
      finiteOrNull(
        state?.settings?.sizeLengthsM?.[product?.sizeKey]
      ) ?? null
    );
  }

  function productCordInstances(state, product) {
    return (product?.cords || []).map(
      (ci, index) => {
        const material =
          materialById(
            state,
            "cords",
            ci?.materialId
          );

        return {
          index,
          materialId: ci?.materialId || null,
          materialName:
            material?.name ||
            product?.costSnapshot?.cords?.[
              ci?.materialId
            ]?.materialName ||
            null,
          material,
          thicknessMm:
            finiteOrNull(ci?.thicknessMm) ??
            finiteOrNull(material?.thicknessMm)
        };
      }
    );
  }

  function normalizedPackaging(product) {
    const p = product?.packaging || {};
    return {
      templateId: p.templateId || null,
      items: Array.isArray(p.items) ? p.items : [],
      laborMode: p.laborMode === "minutes" ? "minutes" : "none",
      minutes: finiteOrNull(p.minutes)
    };
  }

  function applyPackagingTemplate(state, product, templateId) {
    const tpl = (state?.packagingTemplates || []).find(t => t.id === templateId);
    if (!tpl) return clone(product);
    const next = clone(product);
    next.packaging = {
      templateId: tpl.id,
      items: clone(tpl.items || []),
      laborMode: tpl.laborMode === "minutes" ? "minutes" : "none",
      minutes: finiteOrNull(tpl.minutes)
    };
    return next;
  }

  function costProduct(state, product, options = {}) {
    const priceMode = options.priceMode || "snapshot";
    const settings = state?.settings || {};
    const baseLengthM = baseLengthForProduct(state, product);
    const unknowns = [], details = [], qualities = [];

    let coletCost = null;
    if (product?.coletId) {
      const uc = resolveUnitCost(state, product, "colets", product.coletId, priceMode);
      if (uc.value !== null) { coletCost = uc.value; qualities.push(uc.quality); }
      else unknowns.push("Falta el costo del colet.");
    } else unknowns.push("Falta elegir un colet.");

    const cordWastePct = finiteOrNull(product?.cordWastePct) ?? finiteOrNull(settings.defaultCordWastePct) ?? 0;
    const wrapWastePct = finiteOrNull(product?.wrapWastePct) ?? finiteOrNull(settings.defaultWrapWastePct) ?? 0;
    let cordCostKnown = 0, cordCostComplete = true;
    const cordInstances = productCordInstances(state, product);
    cordInstances.forEach((ci,i)=>{
      if (!ci.materialId) { cordCostComplete=false; unknowns.push(`Falta el material del cordón ${i+1}.`); return; }
      const uc=resolveUnitCost(state,product,"cords",ci.materialId,priceMode);
      if (uc.value===null || baseLengthM===null) { cordCostComplete=false; unknowns.push(`Falta información de costo para ${ci.materialName||`cordón ${i+1}`}.`); return; }
      const usedM=baseLengthM*(1+cordWastePct/100), cost=usedM*uc.value;
      cordCostKnown+=cost; qualities.push(uc.quality);
      details.push({type:"cord",cordIndex:i,materialId:ci.materialId,label:ci.materialName||`Cordón ${i+1}`,amount:cost,meters:usedM,unitCost:uc.value,quality:uc.quality,priceSource:uc.source});
    });

    const grouping=validateGrouping(product?.cordCount,product?.groups||[]);
    if(!grouping.ok)unknowns.push(grouping.reason);
    let wrapCostKnown=0,wrapCostComplete=true; const groupResults=[];
    (product?.groups||[]).forEach((group,gi)=>{
      const idxs=Array.isArray(group?.cordIndexes)?group.cordIndexes.map(Number):[];
      const cords=idxs.map(i=>cordInstances[i]).filter(Boolean); const n=idxs.length||Number(group?.size||0);
      const length=estimateBraidLength({baseLengthM,strandCount:n,cords,measuredFinalLengthM:group?.measuredFinalLengthM,customFinalLengthM:group?.customFinalLengthM,settings});
      if(length.quality!=="unknown")qualities.push(length.quality);
      const wraps=[];
      (group?.wraps||[]).forEach(wi=>{
        const mat=materialById(state,"wraps",wi?.materialId);
        const snapName=product?.costSnapshot?.wraps?.[wi?.materialId]?.materialName||null;
        if(!wi?.materialId){wrapCostComplete=false;unknowns.push(`Falta un material de embarrilado en el grupo ${gi+1}.`);return;}
        const meters=estimateWrapMeters({baseLengthM,strandCount:n,cords,wrapMaterial:mat,explicitMeters:wi?.meters,explicitSource:wi?.source,settings});
        const uc=resolveUnitCost(state,product,"wraps",wi.materialId,priceMode);
        const withWaste=meters.valueM===null?null:meters.valueM*(1+wrapWastePct/100); let cost=null;
        if(withWaste!==null&&uc.value!==null){cost=withWaste*uc.value;wrapCostKnown+=cost;qualities.push(stateQuality(meters.quality,uc.quality));}
        else {wrapCostComplete=false;if(uc.value===null)unknowns.push(`Falta el costo de ${mat?.name||snapName||"un material de embarrilado"}.`);if(withWaste===null)unknowns.push(`No se puede estimar cuánto ${mat?.name||snapName||"material"} usa el grupo ${gi+1}.`);}
        wraps.push({materialId:wi.materialId,materialName:mat?.name||snapName||null,meters,metersWithWasteM:withWaste,cost,unitCost:uc,priceSource:uc.source});
      });
      groupResults.push({index:gi,kind:groupKind(n),kindLabel:groupKindLabel(n),strandCount:n,cordIndexes:idxs,cords:cords.map(c=>({index:c.index,materialId:c.materialId,materialName:c.materialName,thicknessMm:c.thicknessMm})),length,wraps,wrapped:wraps.length>0});
    });

    const minutes=finiteOrNull(product?.minutes);
    const hourlyRate=finiteOrNull(product?.hourlyRate)??finiteOrNull(settings.hourlyRate);
    const extraWorkPct=finiteOrNull(product?.extraWorkPct)??0;
    let fabricationLaborCost=null;
    if(minutes!==null&&hourlyRate!==null){fabricationLaborCost=minutes*(hourlyRate/60)*(1+extraWorkPct/100);qualities.push("custom");}
    else {if(minutes===null)unknowns.push("Tiempo de fabricación todavía desconocido.");if(hourlyRate===null)unknowns.push("Valor de la hora todavía desconocido.");}

    const manufacturingMaterialCostKnown=(coletCost??0)+cordCostKnown+wrapCostKnown;
    const manufacturingMaterialComplete=coletCost!==null&&cordCostComplete&&wrapCostComplete&&grouping.ok;
    const manufacturingKnownCost=manufacturingMaterialCostKnown+(fabricationLaborCost??0);
    const manufacturingComplete=manufacturingMaterialComplete&&fabricationLaborCost!==null;
    const manufacturingCost=manufacturingComplete?manufacturingKnownCost:null;

    const packaging=normalizedPackaging(product);
    let packagingMaterialCostKnown=0,packagingMaterialComplete=true; const packagingItems=[];
    packaging.items.forEach((item,i)=>{
      if(!item?.materialId){packagingMaterialComplete=false;unknowns.push(`Falta un componente del empaque ${i+1}.`);return;}
      const mat=materialById(state,"packaging",item.materialId);
      const snapName=product?.costSnapshot?.packaging?.[item.materialId]?.materialName||null;
      const qty=finiteOrNull(item.quantity);
      const uc=resolveUnitCost(state,product,"packaging",item.materialId,priceMode); let cost=null;
      if(qty===null||qty<0){packagingMaterialComplete=false;unknowns.push(`Falta la cantidad usada de ${mat?.name||snapName||"un componente de empaque"}.`);}
      if(uc.value===null){packagingMaterialComplete=false;unknowns.push(`Falta el costo de ${mat?.name||snapName||"un componente de empaque"}.`);}
      if(qty!==null&&qty>=0&&uc.value!==null){cost=qty*uc.value;packagingMaterialCostKnown+=cost;qualities.push(uc.quality);}
      packagingItems.push({materialId:item.materialId,materialName:mat?.name||snapName||null,unit:item.unit||mat?.unit||"un",quantity:qty,cost,unitCost:uc});
    });

    let packagingLaborCost=0,packagingLaborComplete=true;
    if(packaging.laborMode==="minutes"){
      if(packaging.minutes!==null&&hourlyRate!==null){packagingLaborCost=packaging.minutes*(hourlyRate/60);qualities.push("custom");}
      else {packagingLaborCost=null;packagingLaborComplete=false;if(packaging.minutes===null)unknowns.push("Tiempo de empaque todavía desconocido.");if(hourlyRate===null)unknowns.push("Valor de la hora todavía desconocido para costear el empaque.");}
    }
    const packagingKnownCost=packagingMaterialCostKnown+(packagingLaborCost??0);
    const packagingComplete=packagingMaterialComplete&&packagingLaborComplete;
    const packagingCost=packagingComplete?packagingKnownCost:null;

    const knownReadyToSellCost=manufacturingKnownCost+packagingKnownCost;
    const readyToSellComplete=manufacturingComplete&&packagingComplete;
    const readyToSellCost=readyToSellComplete?knownReadyToSellCost:null;
    const quality=readyToSellComplete?stateQuality(...qualities):"unknown";
    const price=finiteOrNull(product?.price);
    const profit=readyToSellCost!==null&&price!==null?price-readyToSellCost:null;
    const margin=profit!==null&&price>0?profit/price:null;
    const markup=profit!==null&&readyToSellCost>0?profit/readyToSellCost:null;

    return {
      priceMode,baseLengthM,grouping,coletCost,cordCostKnown,wrapCostKnown,
      manufacturingMaterialCost:manufacturingMaterialComplete?manufacturingMaterialCostKnown:null,
      manufacturingMaterialCostKnown,fabricationLaborCost,manufacturingKnownCost,manufacturingComplete,manufacturingCost,
      packaging:{...packaging,items:packagingItems},packagingMaterialCost:packagingMaterialComplete?packagingMaterialCostKnown:null,packagingMaterialCostKnown,packagingLaborCost,packagingKnownCost,packagingComplete,packagingCost,
      readyToSellComplete,readyToSellCost,knownReadyToSellCost,quality,price,profit,margin,markup,
      // aliases retained for older UI contracts
      materialCost:manufacturingMaterialComplete?manufacturingMaterialCostKnown:null,knownMaterialCost:manufacturingMaterialCostKnown,laborCost:fabricationLaborCost,knownSubtotal:knownReadyToSellCost,complete:readyToSellComplete,total:readyToSellCost,
      unknowns:[...new Set(unknowns)],groups:groupResults,details
    };
  }

  function costProductCurrent(state, product) {
    return costProduct(
      state,
      product,
      { priceMode: "current" }
    );
  }

  function compareHistoricalToCurrent(state, product) {
    const historical =
      costProduct(
        state,
        product,
        { priceMode: "snapshot" }
      );

    const current =
      costProduct(
        state,
        product,
        { priceMode: "current" }
      );

    return {
      historical,
      current,
      delta:
        historical.total !== null &&
        current.total !== null
          ? current.total -
            historical.total
          : null
    };
  }

  function priceForMargin(cost, margin) {
    const c = finiteOrNull(cost);
    const m = finiteOrNull(margin);

    if (
      c === null ||
      m === null ||
      m >= 1 ||
      m < 0
    ) {
      return null;
    }

    return c / (1 - m);
  }


  function marginForPrice(cost, price) {
    const c = finiteOrNull(cost);
    const p = finiteOrNull(price);
    if (c === null || p === null || p <= 0) return null;
    return (p - c) / p;
  }

  function profitForPrice(cost, price) {
    const c = finiteOrNull(cost);
    const p = finiteOrNull(price);
    if (c === null || p === null) return null;
    return p - c;
  }

  function roundCommercialPrice(price, increment = 100) {
    const p = finiteOrNull(price);
    const step = finiteOrNull(increment);
    if (p === null || step === null || step <= 0) return p;
    return Math.round(p / step) * step;
  }

  function suggestedPrice(cost, targetMargin = 0.50, increment = 100) {
    const raw = priceForMargin(cost, targetMargin);
    if (raw === null) return null;
    return roundCommercialPrice(raw, increment);
  }

  function migrateState(inputState) {
    if (!inputState) return defaultState();
    if (inputState.schema !== DATA_SCHEMA && !PREVIOUS_SCHEMAS.has(inputState.schema)) {
      throw new Error(`Esquema no soportado: ${inputState.schema || "sin schema"}`);
    }
    const oldSchema=inputState.schema;
    const migrated=clone(inputState);
    migrated.schema=DATA_SCHEMA; migrated.coreVersion=VERSION;
    const defaults=defaultState();
    migrated.settings={...defaults.settings,...(migrated.settings||{})};
    // Preserve observed/custom length rules from prior schemas when they exist.
    if(!migrated.settings.lengthRules) migrated.settings.lengthRules={...DEFAULT_LENGTH_RULES};
    migrated.materials={colets:[],cords:[],wraps:[],packaging:[],...(migrated.materials||{})};
    migrated.packagingTemplates=Array.isArray(migrated.packagingTemplates)?migrated.packagingTemplates:[];
    migrated.products=(migrated.products||[]).map(p=>{
      const next=clone(p);
      next.groups=(next.groups||[]).map(g=>({...g,wraps:Array.isArray(g.wraps)?g.wraps:[]}));
      next.packaging=next.packaging||{templateId:null,items:[],laborMode:"none",minutes:null};
      next.packaging.items=Array.isArray(next.packaging.items)?next.packaging.items:[];
      if(next.packaging.laborMode!=="minutes")next.packaging.laborMode="none";
      if(!next.costSnapshot && oldSchema==="tucontu.data/1.0") {
        next.costSnapshot=snapshotProductCosts(migrated,next,{capturedAt:next.createdAt||null,source:"migration-1.0-current-catalog"});
      } else if(next.costSnapshot) {
        next.costSnapshot.packaging=next.costSnapshot.packaging||{};
        next.costSnapshot.schema="tucontu.cost-snapshot/1.1";
      }
      return next;
    });
    return migrated;
  }

  return {
    VERSION,
    DATA_SCHEMA,
    PREVIOUS_SCHEMAS,
    QUALITY,
    GROUP_KIND,
    DEFAULT_LENGTH_RULES,
    uid,
    today,
    round,
    finiteOrNull,
    stateQuality,
    groupKind,
    groupKindLabel,
    lengthRuleRatio,
    defaultState,
    deriveUnitCost,
    makeCostUnknown,
    makeCostDirect,
    makeCostPurchase,
    materialSnapshot,
    snapshotProductCosts,
    withCostSnapshot,
    rebaseProductCosts,
    resolveUnitCost,
    validateGrouping,
    estimateBraidLength,
    estimateWrapMeters,
    normalizedPackaging,
    applyPackagingTemplate,
    costProduct,
    costProductCurrent,
    compareHistoricalToCurrent,
    priceForMargin,
    marginForPrice,
    profitForPrice,
    roundCommercialPrice,
    suggestedPrice,
    migrateState
  };
});
