// WCAG 2.1 contrast check for every colour pair used in design/tokens.css.
// Run: node design/contrast-check.mjs   (exit code 1 if any pair fails its threshold)
// kind "text" needs 4.5:1, kind "ui" (borders, focus rings, icons) needs 3:1.
const light = {
  green800:"#1F5134", green900:"#163D27", green100:"#E3EEE7",
  gold500:"#F2B441", gold100:"#FDF0D0",
  cream50:"#FAF6EE", cream100:"#F2EBDC", cream200:"#E4DAC3", white:"#FFFFFF",
  brown600:"#A9561A", brown800:"#7A3C0E",
  ink900:"#1D2A22", ink700:"#3F4B43", ink600:"#55615A",
  lineStrong:"#76705F",
  okFg:"#14602F", okBg:"#DDF1E4", warnFg:"#7A4A00", warnBg:"#FFEFC7",
  errFg:"#A3221B", errBg:"#FBE4E1", infoFg:"#1F4E79", infoBg:"#E1ECF7",
  neutFg:"#3F4B43", neutBg:"#ECE6D8", dangerBtn:"#A3221B",
};
const dark = {
  bg:"#0F1B15", surface:"#17271E", surfaceHi:"#1F3328", text:"#F3EEE1", muted:"#B8C4BB",
  gold:"#F2B441", onGold:"#143823", green:"#1F5134", onGreen:"#FAF6EE", greenText:"#8FD0A6",
  lineStrong:"#7F9487", accentText:"#F0A56A", greenBorder:"#6FB58A",
  okFg:"#8EDBA7", okBg:"#1E3B2A", warnFg:"#F5CF73", warnBg:"#3C3015",
  errFg:"#FF9C93", errBg:"#442220", infoFg:"#9CC7F0", infoBg:"#1D3248",
};
const L=light, D=dark;
// [mode, label, fg, bg, kind]
const pairs = [
 ["light","Body text on page (cream)",L.ink900,L.cream50,"text"],
 ["light","Body text on card (white)",L.ink900,L.white,"text"],
 ["light","Muted text on page",L.ink600,L.cream50,"text"],
 ["light","Muted text on card",L.ink600,L.white,"text"],
 ["light","Muted text on sunken cream",L.ink600,L.cream100,"text"],
 ["light","Secondary text (ink700) on sunken",L.ink700,L.cream100,"text"],
 ["light","Heading / link green on page",L.green800,L.cream50,"text"],
 ["light","Heading / link green on card",L.green800,L.white,"text"],
 ["light","Green text on green tint",L.green800,L.green100,"text"],
 ["light","Ink text on green tint",L.ink900,L.green100,"text"],
 ["light","Brown accent text on page",L.brown600,L.cream50,"text"],
 ["light","Brown accent text on card",L.brown600,L.white,"text"],
 ["light","Dark brown text on sunken cream (use instead of brown600 there)",L.brown800,L.cream100,"text"],
 ["light","Dark brown on gold tint (notes, banner)",L.brown800,L.gold100,"text"],
 ["light","Ink on gold tint",L.ink900,L.gold100,"text"],
 ["light","PRIMARY BUTTON / WhatsApp: cream label on deep green",L.cream50,L.green800,"text"],
 ["light","Primary button: white label on deep green",L.white,L.green800,"text"],
 ["light","Primary button hover: cream on green900",L.cream50,L.green900,"text"],
 ["light","Hero/footer accent: gold text on deep green",L.gold500,L.green800,"text"],
 ["light","Footer accent: gold text on green900",L.gold500,L.green900,"text"],
 ["light","Gold button/badge: green900 label on gold",L.green900,L.gold500,"text"],
 ["light","Gold button/badge: ink label on gold",L.ink900,L.gold500,"text"],
 ["light","Footer body: cream200 on green900",L.cream200,L.green900,"text"],
 ["light","Footer body: cream50 on green800",L.cream50,L.green800,"text"],
 ["light","Danger button: white on red",L.white,L.dangerBtn,"text"],
 ["light","Error text on white",L.errFg,L.white,"text"],
 ["light","Error text on page",L.errFg,L.cream50,"text"],
 ["light","Badge success (paid, active)",L.okFg,L.okBg,"text"],
 ["light","Badge warning (unpaid, upcoming, renewal due)",L.warnFg,L.warnBg,"text"],
 ["light","Badge danger (overdue, expired)",L.errFg,L.errBg,"text"],
 ["light","Badge info (scheduled, upcoming)",L.infoFg,L.infoBg,"text"],
 ["light","Badge neutral (paused, draft)",L.neutFg,L.neutBg,"text"],
 ["light","Disabled-state text is exempt; shown for info: ink600 on cream200",L.ink600,L.cream200,"text"],
 ["light","Input border on white (UI 3:1)",L.lineStrong,L.white,"ui"],
 ["light","Input border on page (UI 3:1)",L.lineStrong,L.cream50,"ui"],
 ["light","Focus ring green on page (UI 3:1)",L.green800,L.cream50,"ui"],
 ["light","Focus ring green on white (UI 3:1)",L.green800,L.white,"ui"],
 ["light","Focus ring gold on deep green (UI 3:1)",L.gold500,L.green800,"ui"],
 ["light","Focus ring gold on green900 (UI 3:1)",L.gold500,L.green900,"ui"],
 ["light","Primary button edge vs page (UI 3:1)",L.green800,L.cream50,"ui"],
 ["light","Prototype state-frame label: white on ink700","#FFFFFF",L.ink700,"text"],
 ["light","Toast: white on ink900","#FFFFFF",L.ink900,"text"],
 ["light","Toast link: gold-tint on ink900","#F5CF73",L.ink900,"text"],
 ["light","Placeholder text: ink700 on sunken cream",L.ink700,L.cream100,"text"],
 ["light","Admin top bar: cream50 on green900",L.cream50,L.green900,"text"],
 ["light","Admin top bar pill: green900 on gold",L.green900,L.gold500,"text"],
 ["light","Admin top bar muted: cream200 on green900",L.cream200,L.green900,"text"],
 ["light","Overdue row: ink900 on error tint",L.ink900,L.errBg,"text"],
 ["light","Overdue row link: green800 on error tint",L.green800,L.errBg,"text"],
 // dark
 ["dark","Body text on bg",D.text,D.bg,"text"],
 ["dark","Body text on card",D.text,D.surface,"text"],
 ["dark","Muted text on bg",D.muted,D.bg,"text"],
 ["dark","Muted text on card",D.muted,D.surface,"text"],
 ["dark","Muted text on raised card",D.muted,D.surfaceHi,"text"],
 ["dark","Green-ish link/heading text on bg",D.greenText,D.bg,"text"],
 ["dark","Green-ish link/heading text on card",D.greenText,D.surface,"text"],
 ["dark","Accent (brown-light) text on bg",D.accentText,D.bg,"text"],
 ["dark","Accent (brown-light) text on card",D.accentText,D.surface,"text"],
 ["dark","Primary button: cream on deep green",D.onGreen,D.green,"text"],
 ["dark","Gold button: dark green label on gold",D.onGold,D.gold,"text"],
 ["dark","Gold text on bg",D.gold,D.bg,"text"],
 ["dark","Badge success",D.okFg,D.okBg,"text"],
 ["dark","Badge warning",D.warnFg,D.warnBg,"text"],
 ["dark","Badge danger / error text",D.errFg,D.errBg,"text"],
 ["dark","Error text on card",D.errFg,D.surface,"text"],
 ["dark","Badge info",D.infoFg,D.infoBg,"text"],
 ["dark","Primary hover: cream on #2A6A45",D.onGreen,"#2A6A45","text"],
 ["dark","Badge neutral","#D5DDD7","#2B3B31","text"],
 ["dark","Danger button: dark label on light red","#442220","#FF9C93","text"],
 ["dark","Warning note: gold-tint text on dark tint","#F5CF73","#3C3015","text"],
 ["dark","Input border on card (UI 3:1)",D.lineStrong,D.surface,"ui"],
 ["dark","Input border on bg (UI 3:1)",D.lineStrong,D.bg,"ui"],
 ["dark","Green button edge vs bg (UI 3:1)",D.greenBorder,D.bg,"ui"],
 ["dark","Focus ring gold on bg (UI 3:1)",D.gold,D.bg,"ui"],
 ["dark","Focus ring gold on card (UI 3:1)",D.gold,D.surface,"ui"],
];
// Documented FAILS (kept so nobody uses them): not part of pass/fail count.
const forbidden = [
 ["Gold text on cream page",L.gold500,L.cream50],
 ["Gold edge/border on cream (UI)",L.gold500,L.cream50],
 ["Gold text on white",L.gold500,L.white],
 ["Cream label on gold button",L.cream50,L.gold500],
 ["Brown #A9561A text on sunken cream #F2EBDC",L.brown600,L.cream100],
];
const lin=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
const lum=h=>{const n=parseInt(h.slice(1),16);return 0.2126*lin(n>>16)+0.7152*lin((n>>8)&255)+0.0722*lin(n&255)};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)};
let fails=0;
console.log("| Mode | Pair | Foreground | Background | Ratio | Need | Result |");
console.log("|---|---|---|---|---|---|---|");
for(const [m,l,f,b,k] of pairs){
  const r=ratio(f,b), need=k==="text"?4.5:3, ok=r>=need;
  const exempt=l.startsWith("Disabled-state");
  if(!ok&&!exempt)fails++;
  console.log(`| ${m} | ${l} | ${f} | ${b} | ${r.toFixed(2)}:1 | ${need}:1 | ${exempt?"exempt (disabled)":ok?"PASS":"FAIL"} |`);
}
console.log("\nForbidden combinations (must NOT be used for text / UI edges):");
console.log("| Pair | Foreground | Background | Ratio |");
console.log("|---|---|---|---|");
for(const [l,f,b] of forbidden) console.log(`| ${l} | ${f} | ${b} | ${ratio(f,b).toFixed(2)}:1 |`);
console.log(`\nChecked ${pairs.length} pairs; failures: ${fails}`);
process.exit(fails?1:0);
