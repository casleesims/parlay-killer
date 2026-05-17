// ParlayKiller Live Edge — Client Math Module
// WARNING: Keep in sync with routes/liveunder.js
'use strict';
window.PK_MATH = {
  fmt(s){ return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); },
  getWindows(secs){
    const m=secs/60, w=[];
    if(m>10){w.push({l:'3:00',s:180});w.push({l:'5:00',s:300});w.push({l:'9:00',s:540});}
    else if(m>6){w.push({l:'2:00',s:120});w.push({l:'3:30',s:210});w.push({l:'5:00',s:300});}
    else if(m>3.5){w.push({l:'1:30',s:90});w.push({l:'3:00',s:180});}
    else if(m>1){w.push({l:'1:00',s:60});}
    w.push({l:this.fmt(secs)+'★',s:secs,full:true});
    return w;
  },
  getMLBWindows(inn){
    const w=[];
    if(inn>4){w.push({l:'1 inn',i:1});w.push({l:'2 inn',i:2});w.push({l:'3 inn',i:3});}
    else if(inn>2){w.push({l:'1 inn',i:1});w.push({l:'2 inn',i:2});}
    else if(inn>1){w.push({l:'1 inn',i:1});}
    w.push({l:inn.toFixed(1)+' inn★',i:inn,full:true});
    return w;
  },
  getAltState(secs){
    const m=secs/60;
    if(m>3.5) return {l:'Full board available',cls:'full'};
    if(m>1.5) return {l:'Lines thinning',cls:'thin'};
    return {l:'Main only · -110 both ways',cls:'gone'};
  },
  getMLBAltState(inn){
    if(inn>2) return {l:'Full board available',cls:'full'};
    if(inn>1) return {l:'Lines thinning',cls:'thin'};
    return {l:'Main only · -110 both ways',cls:'gone'};
  },
};
// Backwards-compatible globals for index.html
const fmt = (s) => window.PK_MATH.fmt(s);
const getWindows = (s) => window.PK_MATH.getWindows(s);
const getMLBWindows = (i) => window.PK_MATH.getMLBWindows(i);
const getAltState = (s) => window.PK_MATH.getAltState(s);
const getMLBAltState = (i) => window.PK_MATH.getMLBAltState(i);
