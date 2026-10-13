'use strict';
/* Shop Stock core: constants, helpers, icons, themes, saved data (load, migrate, save), example data, activity log. */
var KEY='shop-stock.v1', DAY=86400000, storageOK=true;
var db=null;
var CATS=['Phones','TVs','Computers','Audio','Accessories','Appliances','Networking','Gaming','Wearables','Cameras','Power'];
var DEV_CATS=['phone','tv','computer','other'];
var DEV_CAT_LABEL={phone:'Smartphones',tv:'TVs',computer:'Computers',other:'Others'};
var PART_TYPES={
  phone:['Motherboard','Screen','Battery','Speaker','Camera','Charging port','Back cover','Flex cable','Buttons','SIM tray','Other'],
  tv:['Main board','Power board','T-con board','Backlight strip','Panel','Remote','Speaker','Stand','Other'],
  computer:['Motherboard','Screen','Battery','Keyboard','RAM','SSD or HDD','Charger','Fan','Charging port','Other'],
  other:['Motherboard','Power board','Motor','Screen','Speaker','Other']
};
var APART_DEFAULTS={
  phone:[['Motherboard',4],['Screen',3],['Battery',1],['Speaker',1]],
  tv:[['Main board',3],['Power board',2],['T-con board',1],['Speaker',1]],
  computer:[['Motherboard',4],['Screen',3],['Battery',1],['Keyboard',1]],
  other:[['Motherboard',3],['Power board',2],['Other',1]]
};
var GRADES={A:'Like new',B:'Good, minor wear',C:'Works, visible wear',D:'Faulty, repairable',E:'Very poor'};
var METHODS=['Cash','Telebirr','Bank'];
var EXP_CATS=['Spare parts','Used devices','Transport','Rent','Salaries','Utilities','Other'];
var STOCK_EXP=['Spare parts','Used devices'];
var REPAIR_STATUS=['received','diagnosing','waiting','ready','delivered'];
var REASONS_UNDO=['Wrong item','Wrong price','Customer returned it','Entered twice','Other'];
var REASONS_DISC=['Customer bargained','Bulk purchase','Small damage','Regular customer','Other'];
var REASONS_FIX=['Recount','Damaged','Lost or stolen','Returned to supplier','Other'];
var SLOW_OPTIONS=[7,14,30,45,60,90];

/* ---------- small helpers ---------- */
var uid=function(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
var fmt=function(n){return Math.round(Number(n)||0).toLocaleString('en-US');};
var num=function(v){var n=parseFloat(String(v==null?'':v).replace(/,/g,''));return isFinite(n)&&n>0?n:0;};
var $=function(s){return document.querySelector(s);};
var clone=function(o){return JSON.parse(JSON.stringify(o));};
var extend=function(a,b){for(var k in b)if(Object.prototype.hasOwnProperty.call(b,k))a[k]=b[k];return a;};
var find=function(arr,id){for(var i=0;i<arr.length;i++)if(arr[i].id===id)return arr[i];return null;};
var cap=function(s){return s.charAt(0).toUpperCase()+s.slice(1);};
var pad=function(n){return n<10?'0'+n:''+n;};
var sum=function(arr,f){return arr.reduce(function(a,x){return a+(f(x)||0);},0);};
var uniq=function(arr){var o={},r=[];arr.forEach(function(x){if(!o[x]){o[x]=1;r.push(x);}});return r;};

/* ---------- dates ---------- */
var startOfDay=function(ts){var d=new Date(ts);d.setHours(0,0,0,0);return d.getTime();};
var addDays=function(ts,n){var d=new Date(ts);d.setDate(d.getDate()+n);return d.getTime();};
var daysSince=function(ts){return Math.floor((Date.now()-ts)/DAY);};
var isToday=function(ts){return startOfDay(ts)===startOfDay(Date.now());};
var ymd=function(ts){var d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
var fromYmd=function(s){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||'');return m?new Date(+m[1],+m[2]-1,+m[3]).getTime():0;};
function loc(){return {en:'en-US',am:'am-ET',om:'om-ET'}[db&&db.settings?db.settings.lang:'en']||'en-US';}
function dfmt(ts,o){try{return new Date(ts).toLocaleDateString(loc(),o);}catch(e){return new Date(ts).toLocaleDateString('en-US',o);}}
function tfmt(ts){try{return new Date(ts).toLocaleTimeString(loc(),{hour:'numeric',minute:'2-digit'});}catch(e){return new Date(ts).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});}}
function fmtDate(ts){return dfmt(ts,{month:'short',day:'numeric',year:'numeric'});}
function dayLabel(ts){
  var s=startOfDay(ts),t=startOfDay(Date.now());
  if(s===t)return T('Today');if(s===addDays(t,-1))return T('Yesterday');
  return dfmt(ts,{weekday:'short',month:'short',day:'numeric'});
}
function whenLabel(ts){return isToday(ts)?tfmt(ts):dayLabel(ts)+', '+tfmt(ts);}
function ageLabel(ts){var d=daysSince(ts);return d<=0?T('today'):T('{n} days',{n:d});}
function weekStart(ts){var d=new Date(startOfDay(ts)),ws=db.settings.weekStart,diff=(d.getDay()-ws+7)%7;return addDays(d.getTime(),-diff);}

/* ---------- serial numbers and IMEI ---------- */
function luhn(s){var sum=0,alt=false;for(var i=s.length-1;i>=0;i--){var n=s.charCodeAt(i)-48;if(alt){n*=2;if(n>9)n-=9;}sum+=n;alt=!alt;}return sum%10===0;}
function mkImei(base14){var s=String(base14),sum=0,alt=true;for(var i=s.length-1;i>=0;i--){var n=s.charCodeAt(i)-48;if(alt){n*=2;if(n>9)n-=9;}sum+=n;alt=!alt;}return s+((10-sum%10)%10);}
function parseSerials(txt){var seen={},out=[];String(txt||'').split(/[\n,;]+/).forEach(function(x){x=x.trim();if(x&&!seen[x.toLowerCase()]){seen[x.toLowerCase()]=1;out.push(x);}});return out;}
function serialWarn(s,isPhone){
  if(!isPhone)return '';
  if(/^\d+$/.test(s)){if(s.length!==15)return 'len';if(!luhn(s))return 'luhn';}
  return '';
}
function serialInUse(s,ignoreUsedId){
  s=s.toLowerCase();
  return db.items.some(function(i){return i.serials.some(function(x){return x.toLowerCase()===s;});})||
         db.used.some(function(u){return u.id!==ignoreUsedId&&u.status==='stock'&&u.imei&&u.imei.toLowerCase()===s;});
}
function analyzeSerials(txt,isPhone,ignoreUsedId){
  var raw=String(txt||'').split(/[\n,;]+/).map(function(x){return x.trim();}).filter(Boolean),seen={},dupInput=[],list=[],inStock=[],warn=[];
  raw.forEach(function(x){var k=x.toLowerCase();if(seen[k]){dupInput.push(x);return;}seen[k]=1;list.push(x);if(serialInUse(x,ignoreUsedId))inStock.push(x);var w=serialWarn(x,isPhone);if(w)warn.push({s:x,w:w});});
  return {list:list,dupInput:dupInput,inStock:inStock,warn:warn};
}

/* ---------- icons ---------- */
var ic=function(d,s,w){s=s||24;w=w||1.8;return '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';};
var I={
  home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  swap:'<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
  phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  tv:'<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  laptop:'<rect x="4" y="4" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  chip:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  check:'<path d="M5 13l4 4L19 7"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  receipt:'<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet:'<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l2-3h12"/><circle cx="16.5" cy="13.5" r="1"/>',
  back:'<path d="M15 18l-6-6 6-6"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  users:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>'
};

/* ---------- themes: a mode (light or dark) plus a color palette ---------- */
var MODES={
  light:{'bg':'#F3F5F7','surface':'#FFFFFF','ink':'#0F1B2D','muted':'#566275','line':'#E1E6EC','field-line':'#8793A6','seg':'#E3E8EE','scrim':'rgba(15,27,45,.5)',
    'bad':'#B42318','bad-bg':'#FDE7E5','warn':'#7A4100','warn-bg':'#FFEBCF','good':'#0B6150','good-bg':'#E2F3EE',
    'gA-bg':'#0B6150','gA-fg':'#FFFFFF','gB-bg':'#BFE6DA','gB-fg':'#0B3D33','gC-bg':'#FFE3A3','gC-fg':'#5C3B00','gD-bg':'#F4B58A','gD-fg':'#4A2000','gE-bg':'#D5DAE1','gE-fg':'#243044',
    'hero-ink':'#FFFFFF','hero-muted':'#C3CCDA','hero-line':'rgba(255,255,255,.2)'},
  dark:{'bg':'#0B121C','surface':'#131D2B','ink':'#EAF0F7','muted':'#9AA8BB','line':'#243247','field-line':'#62748E','seg':'#1B2738','scrim':'rgba(0,0,0,.65)',
    'bad':'#FF9A90','bad-bg':'#3A1C1C','warn':'#FFC46B','warn-bg':'#3A2A10','good':'#7FD6C0','good-bg':'#12342C',
    'gA-bg':'#3CC5A3','gA-fg':'#04231B','gB-bg':'#1F4A40','gB-fg':'#BFE6DA','gC-bg':'#4A3A12','gC-fg':'#FFE3A3','gD-bg':'#55301A','gD-fg':'#F4B58A','gE-bg':'#2A3547','gE-fg':'#C5CEDB',
    'hero-ink':'#FFFFFF','hero-muted':'#C3CCDA','hero-line':'rgba(255,255,255,.2)'}
};
var PALETTES={
  violet:{name:'Violet',light:{'accent':'#6D4FD8','accent-ink':'#FFFFFF','accent-soft':'#EFEAFC','hero':'#FFFFFF'},dark:{'accent':'#A98BFF','accent-ink':'#14101F','accent-soft':'#2C2640','hero':'#252528'}},
  teal:{name:'Teal',light:{'accent':'#0E7C66','accent-ink':'#FFFFFF','accent-soft':'#E2F3EE','hero':'#0F1B2D'},dark:{'accent':'#3CC5A3','accent-ink':'#04231B','accent-soft':'#12342C','hero':'#1B2A40'}},
  ocean:{name:'Ocean',light:{'accent':'#1D5FD1','accent-ink':'#FFFFFF','accent-soft':'#E4EDFC','hero':'#0E2347'},dark:{'accent':'#6AA5FF','accent-ink':'#061631','accent-soft':'#15294D','hero':'#16305C'}},
  sunset:{name:'Sunset',light:{'accent':'#B4470C','accent-ink':'#FFFFFF','accent-soft':'#FCEBDD','hero':'#3A1A0A'},dark:{'accent':'#FFA05A','accent-ink':'#2A1100','accent-soft':'#43260F','hero':'#47260F'}},
  forest:{name:'Forest',light:{'accent':'#2E7D32','accent-ink':'#FFFFFF','accent-soft':'#E5F2E5','hero':'#12281A'},dark:{'accent':'#7ED47F','accent-ink':'#0A2A0B','accent-soft':'#173522','hero':'#1B3A26'}},
  royal:{name:'Royal',light:{'accent':'#6A3FC9','accent-ink':'#FFFFFF','accent-soft':'#EEE8FB','hero':'#1D1240'},dark:{'accent':'#B79BFF','accent-ink':'#1C0B45','accent-soft':'#2A1F55','hero':'#2A1E5C'}},
  graphite:{name:'Graphite',light:{'accent':'#2B3544','accent-ink':'#FFFFFF','accent-soft':'#E6E9EE','hero':'#11151B'},dark:{'accent':'#D5DBE5','accent-ink':'#0D1117','accent-soft':'#252E3B','hero':'#222A36'}}
};
function isDark(){var m=db.settings.mode;return m==='dark'||(m==='auto'&&!!window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);}
function applyTheme(){
  var s=db.settings,dk=isDark(),root=document.documentElement,p=PALETTES[s.palette]||PALETTES.teal,vars=extend(extend({},dk?MODES.dark:MODES.light),p[dk?'dark':'light']);
  if(dk){var B={charcoal:{bg:'#1B1B1D',surface:'#252528',line:'#3A3A3F',seg:'#2F2F33'},black:{bg:'#000000',surface:'#111113',line:'#2A2A2E',seg:'#1A1A1D'},navy:{bg:'#0B0E17',surface:'#141927',line:'#222A3F',seg:'#1B2236'}}[s.bgStyle||'charcoal'];vars.bg=B.bg;vars.surface=B.surface;vars.line=B.line;vars.seg=B.seg;vars.hero=B.surface;}
  var ac=s.cAccent;if(/^#[0-9a-f]{6}$/i.test(ac||'')){var r=parseInt(ac.substr(1,2),16),g=parseInt(ac.substr(3,2),16),bl=parseInt(ac.substr(5,2),16);vars.accent=ac;vars['accent-ink']=(r*.299+g*.587+bl*.114)>150?'#111111':'#FFFFFF';vars['accent-soft']='rgba('+r+','+g+','+bl+',.18)';}
  vars.bar=s.cBar||'#6EA8FE';
  for(var k in vars)root.style.setProperty('--'+k,vars[k]);
  root.setAttribute('data-mode',dk?'dark':'light');
  root.setAttribute('data-size',s.textSize==='large'?'large':'normal');
  root.setAttribute('lang',s.lang==='am'?'am':s.lang==='om'?'om':'en');
  var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',vars['bg']);
}

/* ---------- saved data ---------- */
function defaultSettings(){return {lang:'en',mode:'dark',palette:'violet',ui:3,bgStyle:'charcoal',cAccent:'',cBar:'#6EA8FE',textSize:'normal',slowDays:30,weekStart:1,backupAt:0};}
function emptyDb(){return {v:2,shop:'',demo:false,settings:defaultSettings(),items:[],used:[],parts:[],sales:[],repairs:[],expenses:[],activity:[],alertsDismissed:{},alertsSeen:{}};}
function guessDevCat(name,hasImei){
  var n=String(name||'').toLowerCase();
  if(/\btv\b|television|"|inch/.test(n)&&!/phone/.test(n))return 'tv';
  if(/laptop|computer|\bpc\b|macbook|latitude|thinkpad|desktop|notebook/.test(n))return 'computer';
  return hasImei?'phone':'other';
}
function guessPartCat(name,from){
  var n=String(name||'').toLowerCase();
  if(/power board|t-con|backlight|remote|main board/.test(n))return 'tv';
  if(/keyboard|\bram\b|ssd|hdd/.test(n))return 'computer';
  return from&&from.cat?from.cat:'phone';
}
function migrate(o){
  if(!o||typeof o!=='object'||!Array.isArray(o.items)||!Array.isArray(o.used)||!Array.isArray(o.parts)||!Array.isArray(o.sales))return null;
  var now=Date.now();
  ['repairs','expenses','activity'].forEach(function(k){if(!Array.isArray(o[k]))o[k]=[];});
  o.settings=extend(defaultSettings(),o.settings||{});
  o.alertsDismissed=o.alertsDismissed||{};o.alertsSeen=o.alertsSeen||{};
  if(typeof o.shop!=='string')o.shop='';
  o.items.forEach(function(i){
    i.serials=i.serials||[];i.qty=i.qty||0;i.cost=i.cost||0;i.price=i.price||0;if(i.reorder==null)i.reorder=5;
    if(!i.decision)i.decision=i.price>0?'priced':'undecided';if(!i.ts)i.ts=now;
  });
  o.used.forEach(function(u){
    u.buy=u.buy||0;u.ask=u.ask||0;if(!u.ts)u.ts=now;
    if(!u.cat)u.cat=guessDevCat(u.name,!!u.imei);
    if(!u.decision)u.decision=u.ask>0?'priced':(u.status==='stock'?'undecided':'priced');
    if(u.grade==='E'&&u.notes==='Taken apart')u.notes='';
  });
  o.parts.forEach(function(p){
    if(p.qty==null)p.qty=(p.status==='used'||p.status==='gone')?0:1;
    delete p.status;
    p.cost=p.cost||0;p.price=p.price||0;if(!p.ts)p.ts=now;
    if(!p.cat)p.cat=guessPartCat(p.name,find(o.used,p.fromId));
    if(!p.decision)p.decision=p.price>0?'priced':'undecided';
  });
  o.sales.forEach(function(s){
    if(s.voided==null)s.voided=false;
    if(!Array.isArray(s.payments))s.payments=[];
    if(s.discount==null)s.discount=0;
    if(s.balance==null)s.balance=0;
    if(s.subtotal==null)s.subtotal=s.price;
    if(!Array.isArray(s.lines)){
      s.legacy=true;s.lines=[];
      if(s.kind==='used'&&s.usedId)s.lines.push({kind:'used',refId:s.usedId,name:s.title,price:s.price,cost:s.price-s.profit,qty:1});
      else if(s.kind==='trade'&&s.itemId){s.lines.push({kind:'new',refId:s.itemId,name:s.title,serial:'',qty:1,price:s.price,cost:s.price-s.profit});}
      else if(s.kind==='new'&&s.itemId){var m=/ x(\d+)/.exec(s.title||'');var q=m?parseInt(m[1],10):1;s.lines.push({kind:'new',refId:s.itemId,name:s.title,serial:'',qty:q,price:q?s.price/q:s.price,cost:q?(s.price-s.profit)/q:0});}
      if(s.kind==='trade'&&s.usedId)s.trade={usedId:s.usedId,value:s.value||0};
    }
  });
  o.v=2;return o;
}
function load(){
  try{
    var s=localStorage.getItem(KEY);
    if(s){
      var o=JSON.parse(s);
      if(o&&o.v!==2){try{localStorage.setItem(KEY+'.before-v2',s);}catch(e){}}
      var m=migrate(o);if(m){m.settings=Object.assign(defaultSettings(),m.settings||{});if(m.settings.ui!==3){m.settings.ui=3;m.settings.palette='violet';m.settings.mode='dark';m.settings.bgStyle='charcoal';}return m;}
    }
  }catch(e){storageOK=false;}
  return null;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));}catch(e){storageOK=false;}}

/* ---------- activity log (stored as a key plus values so it can be shown in any language) ---------- */
function log(type,k,v,ts){
  db.activity.push({id:uid(),ts:ts||Date.now(),type:type,k:k,v:v||{}});
  if(db.activity.length>5000)db.activity.splice(0,db.activity.length-5000);
}

/* ---------- example data ---------- */
function seed(){
  var t=Date.now(),ago=function(d){return t-d*DAY;},mins=function(m){return t-m*60000;},o=emptyDb();
  o.demo=true;
  var imei=function(n){return mkImei('35693803'+String(100000+n*7919).slice(-6));};
  var mark=function(a){a.forEach(function(x){x.demo=true;});return a;};
  var snapItem=function(i){return {name:i.name,cat:i.cat,track:i.track,price:i.price,cost:i.cost,reorder:i.reorder,decision:i.decision};};
  o.items=mark([
    {id:'i1',name:'Samsung 55" TV',cat:'TVs',track:'serial',price:31500,cost:26000,reorder:3,serials:['TV55-7781','TV55-7782'],qty:0,decision:'priced',ts:ago(40)},
    {id:'i2',name:'iPhone 15 128GB',cat:'Phones',track:'serial',price:78000,cost:70500,reorder:2,serials:[imei(1),imei(2),imei(3),imei(4),imei(5),imei(6)],qty:0,decision:'priced',ts:ago(30)},
    {id:'i3',name:'Phone charger 20W',cat:'Accessories',track:'qty',price:650,cost:400,reorder:10,serials:[],qty:4,decision:'priced',ts:ago(20)},
    {id:'i4',name:'JBL Flip 6',cat:'Audio',track:'serial',price:9800,cost:8200,reorder:2,serials:['JBL-5522','JBL-5523','JBL-5524'],qty:0,decision:'priced',ts:ago(15)},
    {id:'i5',name:'HDMI cable 2m',cat:'Accessories',track:'qty',price:250,cost:120,reorder:10,serials:[],qty:38,decision:'priced',ts:ago(60)},
    {id:'i6',name:'Wireless mouse',cat:'Accessories',track:'qty',price:0,cost:180,reorder:5,serials:[],qty:12,decision:'undecided',ts:ago(5)}
  ]);
  o.used=mark([
    {id:'u1',name:'iPhone 13 128GB',cat:'phone',imei:imei(11),grade:'A',buy:38000,ask:46000,decision:'priced',notes:'Battery health 91%',status:'stock',ts:ago(12),source:'trade-in'},
    {id:'u2',name:'Samsung A54',cat:'phone',imei:imei(12),grade:'B',buy:14000,ask:18500,decision:'priced',notes:'Small scratch on screen',status:'stock',ts:ago(21),source:'trade-in'},
    {id:'u3',name:'Tecno Spark 10',cat:'phone',imei:imei(13),grade:'C',buy:4500,ask:6500,decision:'priced',notes:'Back cover cracked',status:'stock',ts:ago(45),source:'purchase'},
    {id:'u4',name:'LG 43" TV',cat:'tv',imei:'LG43-90017',grade:'D',buy:5000,ask:9000,decision:'priced',notes:'Panel fault, lines on the left',status:'stock',ts:ago(30),source:'purchase'},
    {id:'u5',name:'Redmi 9',cat:'phone',imei:imei(14),grade:'E',buy:1200,ask:0,decision:'undecided',notes:'Dead. Not sure if I will sell it or take it apart.',status:'stock',ts:ago(60),source:'purchase'},
    {id:'u6',name:'Infinix Hot 11',cat:'phone',imei:imei(15),grade:'E',buy:3000,ask:0,decision:'priced',notes:'',status:'parts',ts:ago(9),partedAt:ago(3),source:'purchase'},
    {id:'u7',name:'LG 32" TV',cat:'tv',imei:'LG32-44120',grade:'B',buy:4000,ask:0,decision:'undecided',notes:'Customer: Dawit',status:'stock',ts:mins(20),source:'trade-in',tradeSaleId:'s3'},
    {id:'u8',name:'Dell Latitude 5420',cat:'computer',imei:'DL5420-8831',grade:'C',buy:12000,ask:16000,decision:'priced',notes:'Needs a new battery',status:'stock',ts:ago(8),source:'purchase'},
    {id:'u9',name:'Samsung A32',cat:'phone',imei:imei(16),grade:'B',buy:8500,ask:12000,decision:'priced',notes:'',status:'sold',ts:ago(20),soldPrice:12000,soldAt:ago(1),source:'purchase',saleId:'s4'}
  ]);
  o.parts=mark([
    {id:'p1',name:'Motherboard',cat:'phone',state:'tested',cost:1400,price:0,decision:'undecided',qty:1,from:'Infinix Hot 11',fromId:'u6',ts:ago(3)},
    {id:'p2',name:'Screen',cat:'phone',state:'tested',cost:1000,price:1800,decision:'priced',qty:1,from:'Infinix Hot 11',fromId:'u6',ts:ago(3)},
    {id:'p3',name:'Speaker',cat:'phone',state:'untested',cost:200,price:0,decision:'undecided',qty:1,from:'Infinix Hot 11',fromId:'u6',ts:ago(3)},
    {id:'p4',name:'Battery',cat:'phone',state:'faulty',cost:400,price:0,decision:'undecided',qty:1,from:'Infinix Hot 11',fromId:'u6',ts:ago(3)},
    {id:'p5',name:'Power board',cat:'tv',state:'tested',cost:900,price:1500,decision:'priced',qty:1,from:'Bought directly',fromId:'',ts:ago(14)},
    {id:'p6',name:'Charging port',cat:'phone',state:'tested',cost:80,price:200,decision:'priced',qty:5,from:'Bought directly',fromId:'',ts:ago(14)},
    {id:'p7',name:'Remote',cat:'tv',state:'tested',cost:50,price:120,decision:'priced',qty:3,from:'Bought directly',fromId:'',ts:ago(10)}
  ]);
  var it=function(id){return find(o.items,id);};
  o.sales=mark([
    {id:'s1',ts:mins(95),kind:'new',title:'Phone charger 20W x2',lines:[{kind:'new',refId:'i3',name:'Phone charger 20W',serial:'',qty:2,price:650,cost:400,snap:snapItem(it('i3'))}],subtotal:1300,discount:0,price:1300,cash:1300,balance:0,payments:[],profit:500,method:'Cash',customer:'',phone:'',voided:false},
    {id:'s2',ts:mins(55),kind:'new',title:'JBL Flip 6',lines:[{kind:'new',refId:'i4',name:'JBL Flip 6',serial:'JBL-5521',qty:1,price:9800,cost:8200,snap:snapItem(it('i4'))}],subtotal:9800,discount:0,price:9800,cash:9800,balance:0,payments:[],profit:1600,method:'Telebirr',customer:'',phone:'',voided:false},
    {id:'s3',ts:mins(20),kind:'trade',title:'Samsung 55" TV for LG 32" TV',lines:[{kind:'new',refId:'i1',name:'Samsung 55" TV',serial:'TV55-7780',qty:1,price:31500,cost:26000,snap:snapItem(it('i1'))}],trade:{usedId:'u7',value:4000,name:'LG 32" TV'},subtotal:31500,discount:0,price:31500,cash:27500,balance:0,payments:[],profit:5500,method:'Cash',customer:'Dawit',phone:'',voided:false},
    {id:'s4',ts:ago(1),kind:'used',title:'Samsung A32 (used)',lines:[{kind:'used',refId:'u9',name:'Samsung A32 (used)',serial:imei(16),qty:1,price:12000,cost:8500}],subtotal:12000,discount:0,price:12000,cash:12000,balance:0,payments:[],profit:3500,method:'Cash',customer:'',phone:'',voided:false},
    {id:'s5',ts:ago(3),kind:'new',title:'HDMI cable 2m x4',lines:[{kind:'new',refId:'i5',name:'HDMI cable 2m',serial:'',qty:4,price:250,cost:120,snap:snapItem(it('i5'))}],subtotal:1000,discount:0,price:1000,cash:400,balance:600,payments:[],profit:520,method:'Cash',customer:'Hana',phone:'0911000000',voided:false},
    {id:'s6',ts:mins(200),kind:'repair',title:'Repair: Tecno Spark 8',lines:[{kind:'repair',refId:'r3',name:'Repair: Tecno Spark 8',qty:1,price:1500,cost:80}],subtotal:1500,discount:0,price:1500,cash:1500,balance:0,payments:[],profit:1420,method:'Cash',customer:'Sara',phone:'',voided:false}
  ]);
  o.repairs=mark([
    {id:'r1',ts:ago(7),customer:'Ahmed',phone:'0912000001',device:'Samsung A12',imei:'',problem:'Cracked screen',estimate:2500,status:'ready',readyAt:ago(5),parts:[],otherCost:0,notes:''},
    {id:'r2',ts:ago(2),customer:'Tigist',phone:'0912000002',device:'LG 43" TV',imei:'',problem:'No power',estimate:1800,status:'waiting',parts:[],otherCost:0,notes:'Waiting for a power board'},
    {id:'r3',ts:mins(260),customer:'Sara',phone:'',device:'Tecno Spark 8',imei:'',problem:'Not charging',estimate:1500,status:'delivered',deliveredAt:mins(200),fee:1500,method:'Cash',saleId:'s6',parts:[{partId:'p6',name:'Charging port',cat:'phone',qty:1,cost:80}],otherCost:0,notes:''}
  ]);
  o.expenses=mark([
    {id:'e1',ts:mins(150),amount:150,cat:'Transport',note:'Taxi to the supplier',method:'Cash',ref:null},
    {id:'e2',ts:ago(8),amount:12000,cat:'Used devices',note:'Dell Latitude 5420',method:'Cash',ref:{t:'used',id:'u8'}},
    {id:'e3',ts:ago(1),amount:800,cat:'Utilities',note:'Electricity',method:'Cash',ref:null}
  ]);
  o.activity=mark([
    {id:'a1',ts:mins(20),type:'trade',k:'Trade-in: {a} came in for {b}',v:{a:'LG 32" TV',b:'Samsung 55" TV'}},
    {id:'a2',ts:mins(55),type:'sale',k:'Sale recorded: {t} for {p} Birr',v:{t:'JBL Flip 6',p:fmt(9800)}},
    {id:'a3',ts:mins(95),type:'sale',k:'Sale recorded: {t} for {p} Birr',v:{t:'Phone charger 20W x2',p:fmt(1300)}},
    {id:'a4',ts:ago(1),type:'sale',k:'Sale recorded: {t} for {p} Birr',v:{t:'Samsung A32 (used)',p:fmt(12000)}}
  ]);
  return o;
}

/* ---------- app state (not saved) ---------- */
function freshCart(){return {lines:[],customer:'',phone:'',discount:'',reason:'',method:'Cash',paid:''};}
function freshTrade(m){return {customer:'',name:'',imei:'',cat:'phone',grade:'B',value:'',ask:'',itemId:'',serial:'',price:'',method:m||'Cash'};}
var state={tab:'home',stockTab:'new',pages:[],sheet:null,conf:null,f:{},fresh:false,armed:null,
  q:'',newCat:'All',usedGrade:'All',usedStatus:'stock',usedQ:'',partCat:null,partType:'All',partStatus:'stock',partQ:'',
  salesPeriod:'today',salesDate:'',salesFrom:'',salesTo:'',salesQ:'',salesVoid:false,
  repairFilter:'open',repairQ:'',expDate:'',actFilter:'all',actQ:'',debtQ:'',
  cart:freshCart(),trade:freshTrade(),tradeDone:null,apart:null,pickTab:'new'};
