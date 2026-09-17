
const fs=require("fs");
const app=fs.readFileSync("./app.js","utf8");
const css=fs.readFileSync("./styles.css","utf8");
const html=fs.readFileSync("./index.html","utf8");
const crypto=require("crypto");
let p=0,f=0;
function t(n,c){if(c){console.log("PASS  "+n);p++;}else{console.error("FAIL  "+n);f++;}}

t("index says v1.7",html.includes("Web v1.7"));
t("viewport-fit cover preserved",html.includes("viewport-fit=cover"));
t("mobile web app metadata exists",html.includes("apple-mobile-web-app-capable"));
t("telephone detection disabled",html.includes('format-detection'));
t("safe top exists",css.includes("--safe-top:env(safe-area-inset-top"));
t("safe bottom exists",css.includes("--safe-bottom:env(safe-area-inset-bottom"));
t("visualViewport adapter exists",app.includes("syncVisualViewport")&&app.includes("window.visualViewport"));
t("app height follows visual viewport",app.includes('--app-height')&&css.includes("var(--app-height"));
t("keyboard state exists",app.includes("keyboard-open")&&css.includes("body.keyboard-open"));
t("keyboard collapses global header",css.includes("body.keyboard-open .app-shell"));
t("iPhone 16e exact query exists",css.includes("@media(width:390px) and (height:844px)"));
t("phone breakpoint covers 390",css.includes("@media(max-width:430px)"));
t("touch targets 44 exist",css.includes("min-height:44px"));
t("mobile inputs are 16px",/input,select\{[\s\S]*font-size:16px/.test(css));
t("range touch area enlarged",css.includes('input[type="range"].commercial-range'));
t("one archive record on compact remains",app.includes("function archivePerPage(){return isCompact()?1:4;}"));
t("compact editor panels remain",app.includes("installCompactPaneSwitch"));
t("full phone material panel",css.includes("width:100vw"));
t("phone material workspace is opaque",css.includes("background:var(--bone)")&&css.includes("backdrop-filter:none"));
t("economic rail uses safe bottom",css.includes("padding-bottom:var(--safe-bottom)"));
t("mobile economic status is compact",app.includes("status-short")&&css.includes(".value-status .status-long{display:none}"));
t("portrait orientation guard exists",html.includes("orientation-guard")&&css.includes("orientation:landscape"));
t("no width-based phone blocker returns",!css.includes(".too-small{display:flex"));
t("reduced motion supported",css.includes("prefers-reduced-motion:reduce"));
t("focus visible supported",css.includes(":focus-visible"));
t("editor nav has tab semantics",app.includes('role="tablist"')&&app.includes('aria-selected'));
t("zero page scroll preserved",css.includes("overflow:hidden")&&css.includes("overscroll-behavior:none"));
t("price margin simulator preserved",app.includes("beginCommercialSimulation")&&app.includes("simMarginRange"));
t("inline material editing preserved",app.includes("beginLibraryEdit")&&app.includes("libraryEditRow"));
t("packaging preserved",app.includes("packagingTemplates")&&app.includes("applyPackagingTemplate"));
t("historical snapshots preserved",app.includes("freezeCostsForSave")&&app.includes("rebaseProductCosts"));

console.log(`\nResultado Mobile v1.7: ${p} PASS · ${f} FAIL`);
process.exitCode=f?1:0;
