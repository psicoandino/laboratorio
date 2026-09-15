const core = require('./core.js');
let passed=0, failed=0;
function ok(name,cond){ if(cond){console.log('PASS  '+name);passed++;} else {console.error('FAIL  '+name);failed++;} }
const approx=(a,b,eps=1e-6)=>Math.abs(a-b)<=eps;

const state=core.defaultState();
const colet={id:'colet1',name:'Colet',cost:core.makeCostPurchase(12,4200)};
const cord={id:'cord1',name:'Cordón negro',thicknessMm:null,cost:core.makeCostPurchase(20,4800)};
const cordThick={id:'cord2',name:'Cordón grueso',thicknessMm:4,cost:core.makeCostDirect(300)};
const wrapA={id:'wrap1',name:'Lana',baseRatePerM:null,cost:core.makeCostDirect(50)};
const wrapB={id:'wrap2',name:'Hilo',baseRatePerM:null,cost:core.makeCostPurchase(100,3000)};
state.materials.colets.push(colet);
state.materials.cords.push(cord,cordThick);
state.materials.wraps.push(wrapA,wrapB);
state.settings.hourlyRate=6000;

let c=core.deriveUnitCost(colet.cost);
ok('12 colets por $4200 = $350/un',approx(c.value,350));
ok('compra real queda medida',c.quality==='measured');
c=core.deriveUnitCost(cordThick.cost);
ok('costo directo $300/m',approx(c.value,300));
ok('costo directo queda personalizado',c.quality==='custom');
ok('agrupación 3+2+2+2 usa 9',core.validateGrouping(9,[{size:3},{size:2},{size:2},{size:2}]).ok);
ok('agrupación 2+2 usa 4',core.validateGrouping(4,[{size:2},{size:2}]).ok);
ok('agrupación incompleta se rechaza',!core.validateGrouping(4,[{size:2},{size:1}]).ok);

const l1=core.estimateBraidLength({baseLengthM:.6,strandCount:3,cords:[{thicknessMm:null},{thicknessMm:null},{thicknessMm:null}],settings:state.settings});
ok('grosor desconocido no rompe largo',approx(l1.valueM,.468));
ok('largo sin grosor queda estimado',l1.quality==='estimated');
const l2=core.estimateBraidLength({baseLengthM:.6,strandCount:3,cords:[{thicknessMm:4},{thicknessMm:4},{thicknessMm:4}],settings:state.settings});
ok('grosor conocido corrige largo',approx(l2.valueM,.456));
const l3=core.estimateBraidLength({baseLengthM:.6,strandCount:3,cords:[{thicknessMm:4},{thicknessMm:4},{thicknessMm:4}],measuredFinalLengthM:.45,settings:state.settings});
ok('medición vence a fórmula',approx(l3.valueM,.45)&&l3.quality==='measured');

const w=core.estimateWrapMeters({baseLengthM:.6,strandCount:3,cords:[{thicknessMm:null},{thicknessMm:null},{thicknessMm:null}],wrapMaterial:wrapA,settings:state.settings});
ok('embarrilado puede estimarse sin grosor',w.valueM!==null&&w.quality==='estimated');

const product={
 id:'P1',name:'Test',sizeKey:'M',customLengthM:null,cordCount:4,coletId:'colet1',
 cords:[{materialId:'cord1',thicknessMm:null},{materialId:'cord1',thicknessMm:null},{materialId:'cord2',thicknessMm:4},{materialId:'cord2',thicknessMm:4}],
 groups:[
  {size:2,cordIndexes:[0,1],wraps:[{materialId:'wrap1',meters:.8,source:'measured'},{materialId:'wrap2',meters:.5,source:'custom'}]},
  {size:2,cordIndexes:[2,3],wraps:[]}
 ],
 minutes:30,hourlyRate:6000,extraWorkPct:10,cordWastePct:0,wrapWastePct:0,price:null
};
let r=core.costProduct(state,product);
ok('varios géneros se suman por metros usados',r.wrapCostKnown>0);
ok('precio desconocido no impide calcular costo',r.total!==null&&r.price===null);
ok('ajuste de trabajo +10% se refleja',approx(r.laborCost,3300));
ok('producto completo devuelve costo',r.complete===true);
const unknown=JSON.parse(JSON.stringify(product)); unknown.hourlyRate=null; state.settings.hourlyRate=null;
r=core.costProduct(state,unknown);
ok('hora desconocida no rompe flujo',r.complete===false&&r.knownSubtotal>0);
ok('motor declara qué falta',r.unknowns.some(x=>x.includes('hora')));
state.settings.hourlyRate=6000;
const waste=JSON.parse(JSON.stringify(product)); waste.cordWastePct=10; waste.wrapWastePct=10;
ok('merma opcional aumenta costo',core.costProduct(state,waste).total>core.costProduct(state,product).total);
ok('precio para margen 50%',approx(core.priceForMargin(5000,.5),10000));
console.log(`\nResultado: ${passed} PASS · ${failed} FAIL`);
process.exitCode=failed?1:0;
