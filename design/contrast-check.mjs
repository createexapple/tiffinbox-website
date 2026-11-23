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

// ---------------------------------------------------------------------------------------------
// PUBLIC DESIGN (CR-004 addendum): colours of the operator's design "Tiffin Box Lahore" as built in
// src/styles/public.css (.tb tokens, light-dark()). Reported separately: the public colours come from the design file,
// so a pair below AA is listed for the operator, not silently "fixed". Does not change the exit code of the
// original pairs above.
const PL={bg:"#FAF6EE",band:"#F1E9DA",card:"#FFFFFF",ink:"#17201A",mut:"#4B5550",line:"#E4DCCB",green:"#1F5134",greenInk:"#1F5134",gold:"#F2B441",brown:"#A9561A",night:"#1E2B3A",tint:"#EEF3EC",chipOn:"#FFF3DC",chipEdge:"#8A5D00",ring:"#1F5134",footer:"#14241B"};
const PD={bg:"#0E1712",band:"#13211A",card:"#182A20",ink:"#EEF1EC",mut:"#AEBBB2",line:"#28392F",green:"#1F5134",greenInk:"#8FD0A8",gold:"#F2B441",brown:"#E3A06A",night:"#1E2B3A",tint:"#1D3326",chipOn:"#3A2D12",chipEdge:"#C98A12",ring:"#F2B441",footer:"#14241B"};
const pub=[];
for(const [m,C] of [["light",PL],["dark",PD]]){
  pub.push(
   [m,"Body text on page",C.ink,C.bg,"text"],[m,"Body text on card",C.ink,C.card,"text"],[m,"Body text on band",C.ink,C.band,"text"],
   [m,"Muted text on page",C.mut,C.bg,"text"],[m,"Muted text on card",C.mut,C.card,"text"],[m,"Muted text on band",C.mut,C.band,"text"],
   [m,"Heading/link green on page",C.greenInk,C.bg,"text"],[m,"Heading/link green on card",C.greenInk,C.card,"text"],[m,"Heading/link green on band",C.greenInk,C.band,"text"],
   [m,"Active nav / selected option: green on tint",C.greenInk,C.tint,"text"],[m,"Selected option: ink on tint",C.ink,C.tint,"text"],[m,"Muted (nav, small) on tint",C.mut,C.tint,"text"],
   [m,"Kicker brown on page",C.brown,C.bg,"text"],[m,"Kicker brown on band",C.brown,C.band,"text"],[m,"Kicker brown on card",C.brown,C.card,"text"],
   [m,"Fill button: white on green","#FFFFFF",C.green,"text"],[m,"Gold button / tag / chip: ink on gold","#17201A",C.gold,"text"],
   [m,"Line button: green text on page",C.greenInk,C.bg,"text"],[m,"Outlined tag: ink on page",C.ink,C.bg,"text"],
   [m,"Table header: white on green","#FFFFFF",C.green,"text"],[m,"Selected day tab: white on green","#FFFFFF",C.green,"text"],
   [m,"Popular plan: gold on green",C.gold,C.green,"text"],[m,"Popular plan body: #CFE3D6 on green","#CFE3D6",C.green,"text"],
   [m,"Night card title: gold on night",C.gold,C.night,"text"],[m,"Night card body: #C9D3DE on night","#C9D3DE",C.night,"text"],
   [m,"Total panel big number: gold on green",C.gold,C.green,"text"],[m,"Total panel lines: #CFE3D6 on green","#CFE3D6",C.green,"text"],
   [m,"CTA band text: #CFE3D6 on green","#CFE3D6",C.green,"text"],[m,"WhatsApp pill: white on green","#FFFFFF",C.green,"text"],
   [m,"Footer body: #DCE3DE on footer","#DCE3DE",C.footer,"text"],[m,"Footer link: gold on footer",C.gold,C.footer,"text"],[m,"Footer small: #9FB0A5 on footer","#9FB0A5",C.footer,"text"],
   [m,"Chip on (add-on selected): ink on chip tint",C.ink,C.chipOn,"text"],[m,"Chip on: muted small on chip tint",C.mut,C.chipOn,"text"],
   [m,"Focus ring on page",C.ring,C.bg,"ui"],[m,"Focus ring on card",C.ring,C.card,"ui"],[m,"Focus ring (gold) on green",C.gold,C.green,"ui"],[m,"Focus ring (gold) on footer",C.gold,C.footer,"ui"],
   [m,"Selected option border: green on card",C.greenInk,C.card,"ui"],[m,"Selected chip border on chip tint",C.chipEdge,C.chipOn,"ui"],
   [m,"Unselected option / chip / tab / stepper border on card (design: line colour)",C.line,C.card,"ui"],[m,"Unselected tab border on page",C.line,C.bg,"ui"],
  );
}
console.log("\n## Public design (light and dark): pairs used by src/styles/public.css\n");
console.log("| Mode | Pair | Foreground | Background | Ratio | Need | Result |");
console.log("|---|---|---|---|---|---|---|");
let pubBelow=0;
for(const [m,l,f,b,k] of pub){
  const r=ratio(f,b), need=k==="text"?4.5:3, ok=r>=need;
  if(!ok)pubBelow++;
  console.log(`| ${m} | ${l} | ${f} | ${b} | ${r.toFixed(2)}:1 | ${need}:1 | ${ok?"PASS":"BELOW AA"} |`);
}
console.log(`\nPublic design: ${pub.length} pairs, ${pubBelow} below WCAG AA (listed above; colours come from the design file).`);
console.log("\nForbidden combinations (must NOT be used for text / UI edges):");
console.log("| Pair | Foreground | Background | Ratio |");
console.log("|---|---|---|---|");
for(const [l,f,b] of forbidden) console.log(`| ${l} | ${f} | ${b} | ${ratio(f,b).toFixed(2)}:1 |`);
console.log(`\nChecked ${pairs.length} pairs; failures: ${fails}`);
process.exit(fails?1:0);
