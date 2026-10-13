'use strict';
/* Shop Stock actions: rendering, navigation and back button, taps, typing, form submits. */

function toast(msg){var t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(function(){t.hidden=true;},2800);}
function showErr(msg,id){
  var el=document.querySelector(id?'#'+id:(state.sheet?'#sheetRoot #sheetErr':'#sheetErr'));
  if(!el){toast(msg);return false;}
  el.textContent=msg;el.hidden=false;try{el.scrollIntoView({block:'nearest'});}catch(e){}
  return false;
}
function copyText(text,msg){
  var done=function(){toast(msg||T('Copied'));};
  var fb=function(){var ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){toast(T('Could not copy'));}document.body.removeChild(ta);};
  try{navigator.clipboard.writeText(text).then(done,fb);}catch(e){fb();}
}
function shareText(text,msg){
  try{if(navigator.share){navigator.share({text:text}).catch(function(){});return;}}catch(e){}
  copyText(text,msg);
}

/* ---------- views ---------- */
function tabView(){return state.tab==='home'?viewHome():state.tab==='stock'?viewStock():state.tab==='sales'?viewSales():viewRepair();}
function pageView(p){
  switch(p){
    case 'sale':return pageSale();case 'trade':return pageTrade();case 'notifications':return pageNotifications();case 'menu':return pageMenu();
    case 'slow':return pageSlow();case 'activity':return pageActivity();case 'expenses':return pageExpenses();case 'debts':return pageDebts();case 'settings':return pageSettings();
  }
  return pageMenu();
}
function navHtml(){
  var b=function(t,icon,label){return '<button type="button" data-a="tab" data-v="'+t+'"'+(state.tab===t?' aria-current="page"':'')+'>'+ic(icon,24)+esc(label)+'</button>';};
  return b('home',I.home,T('Home'))+b('stock',I.box,T('Stock'))+'<button type="button" class="mid" data-a="quick" aria-label="'+esc(T('Quick actions'))+'"><span class="disc">'+ic(I.plus,28,2.4)+'</span><span>'+esc(T('New'))+'</span></button>'+b('sales',I.chart,T('Sales'))+b('repair',I.wrench,T('Repair'));
}
var lastSheet=null,lastConf=null,lastKey='';
function viewKey(){return state.tab+'|'+state.pages.join(',')+'|'+state.stockTab+'|'+state.partCat;}
function renderSheet(){
  var root=$('#sheetRoot'),s=state.sheet;
  if(!s){root.innerHTML='';lastSheet=null;return;}
  var def=SHEETS[s.t],r=def?def(s):null;
  if(!r){state.sheet=null;root.innerHTML='';lastSheet=null;return;}
  var old=root.querySelector('.panel'),st=old&&s===lastSheet?old.scrollTop:0;
  root.innerHTML='<div class="scrim" data-scrim="sheet"><div class="panel" role="dialog" aria-modal="true" aria-label="'+esc(r.title)+'" tabindex="-1"><div class="head"><h2>'+esc(r.title)+'</h2><button type="button" class="iconbtn" data-a="closeSheet" aria-label="'+esc(T('Close'))+'">'+ic(I.x,22,2)+'</button></div>'+r.body+'</div></div>';
  var p=root.querySelector('.panel');p.scrollTop=st;
  if(s!==lastSheet)p.focus();
  lastSheet=s;
}
function render(){
  var y=window.scrollY,key=viewKey(),ae=document.activeElement,fid=ae&&ae.id?ae.id:'',a0=0,a1=0;
  try{if(fid&&ae.selectionStart!=null){a0=ae.selectionStart;a1=ae.selectionEnd;}}catch(e){}
  var top=state.pages.length?state.pages[state.pages.length-1]:null;
  $('#app').innerHTML=top?pageView(top):tabView();
  var nav=$('#nav');nav.hidden=!!top;if(!top)$('#navIn').innerHTML=navHtml();
  document.body.classList.toggle('nonav',!!top);
  renderSheet();renderConf();
  if(fid){var n=document.getElementById(fid);if(n&&n!==document.activeElement){n.focus();try{n.setSelectionRange(a0,a1);}catch(e){}}}
  if(state.conf&&state.conf!==lastConf){var cp=document.querySelector('#confRoot .panel');if(cp)cp.focus();}
  lastConf=state.conf;
  document.documentElement.style.overflow=(state.sheet||state.conf)?'hidden':'';
  window.scrollTo(0,key===lastKey?y:0);lastKey=key;
  syncHist();
}

/* ---------- navigation and the back button ---------- */
var histN=0,histIgnore=0;
function depth(){return (state.conf?1:0)+(state.sheet?1:0)+state.pages.length+(state.tab!=='home'?1:0)+(state.tab==='stock'&&state.stockTab==='parts'&&state.partCat!=null?1:0);}
function backOnce(){
  if(state.conf)state.conf=null;
  else if(state.sheet)state.sheet=null;
  else if(state.pages.length)state.pages.pop();
  else if(state.tab==='stock'&&state.stockTab==='parts'&&state.partCat!=null)state.partCat=null;
  else if(state.tab!=='home')state.tab='home';
}
function syncHist(){
  if(histIgnore>0)return;
  var d=depth();
  try{
    if(d>histN){while(histN<d){histN++;history.pushState({d:histN},'');}}
    else if(d<histN){var n=histN-d;histN=d;histIgnore++;history.go(-n);}
  }catch(e){}
}
window.addEventListener('popstate',function(e){
  if(histIgnore>0){histIgnore--;if(!histIgnore)syncHist();return;}
  histN=(e.state&&e.state.d)||0;
  var g=20;while(depth()>histN&&g-->0)backOnce();
  state.armed=null;render();
});
function openSheet(s,f){state.sheet=s;state.f=f||{};state.armed=null;render();}
function pushPage(p){
  state.pages.push(p);state.sheet=null;state.conf=null;state.f={};state.armed=null;
  if(p==='notifications')markAlertsSeen();
  if(p==='expenses'&&!state.expDate)state.expDate=ymd(Date.now());
}
function setTab(t){state.tab=t;state.pages=[];state.sheet=null;state.conf=null;state.f={};state.armed=null;}
function ensureSalePage(){state.sheet=null;if(state.pages[state.pages.length-1]!=='sale')pushPage('sale');}
function ask(o){state.conf=o;render();}

/* ---------- live updates while typing (no full redraw) ---------- */
var live={
  newList:function(el){state.q=el.value;$('#newList').innerHTML=newList();},
  usedList:function(el){state.usedQ=el.value;$('#usedList').innerHTML=usedList();},
  partList:function(el){state.partQ=el.value;$('#partList').innerHTML=partList();},
  salesBody:function(el){state.salesQ=el.value;$('#salesBody').innerHTML=salesBody();},
  repairList:function(el){state.repairQ=el.value;$('#repairList').innerHTML=repairList();},
  actList:function(el){state.actQ=el.value;$('#actList').innerHTML=actList();},
  pickList:function(el){state.f.f_pq=el.value;$('#pickList').innerHTML=pickList();},
  unitFilter:function(el){var q=el.value.trim().toLowerCase();[].forEach.call(document.querySelectorAll('.unit[data-s]'),function(u){u.hidden=!!q&&u.getAttribute('data-s').indexOf(q)<0;});},
  cart:function(){
    var c=state.cart,s=$('#cartSummary');if(s)s.innerHTML=cartSummaryHtml();
    c.lines.forEach(function(l,i){
      var r=lineRef(l),w=$('#lw'+i);if(!w)return;var p=num(l.price),m='';
      if(p>0&&r){var cost=l.kind==='used'?r.buy:r.cost;if(p<cost)m='<div class="warnbox">'+esc(T('Below cost: you paid {n} for this.',{n:fmt(cost)}))+'</div>';}
      w.innerHTML=m;
    });
    var lab=document.querySelector('label[for="cr"]');if(lab)lab.hidden=!(num(c.discount)>0);
  },
  trade:function(){var s=$('#tradeSummary');if(s)s.innerHTML=tradeSummary();},
  tradeItem:function(){var it=find(db.items,state.trade.itemId);state.trade.serial='';state.trade.price=it&&it.price?String(it.price):'';render();},
  itemChk:function(el){
    var s=state.sheet,cat=s.t==='restock'?(find(db.items,s.id)||{}).cat:state.f.f_cat,b=$('#f_chk');
    if(b)b.innerHTML=chkHtml(el.value,cat==='Phones');
  },
  usedChk:function(el){var b=$('#f_chk');if(b)b.innerHTML=chkHtml(el.value,state.f.f_cat==='phone',state.sheet.id);},
  apart:function(){
    var a=state.apart,costs=apartCosts();
    a.rows.forEach(function(r,i){var e=$('#apc'+i);if(e)e.textContent=r.name.trim()?fmt(costs[r.key]||0):'-';});
  },
  apartDev:function(){var a=state.apart,d=find(db.used,a.deviceId);a.rows=d?apartDefaults(d.cat):[];render();},
  deliver:function(){var e=$('#deliverSum'),r=find(db.repairs,state.sheet.id);if(e&&r)e.innerHTML=deliverSum(r);},
  rerender:function(){render();}
};

document.addEventListener('input',function(e){
  var el=e.target;
  if(el.hasAttribute('data-b'))setPath(state,el.getAttribute('data-b'),el.value);
  else if(el.hasAttribute('data-f')){state.f[el.id]=el.value;state.f._ack=0;}
  if(el.tagName==='SELECT')return;
  var l=el.getAttribute('data-live');if(l&&live[l])live[l](el);
});
document.addEventListener('change',function(e){
  var el=e.target;
  try{
    if(el.hasAttribute('data-unit')){if(!state.sheet){state.trade.serial=el.value;live.trade();}return;}
    if(el.hasAttribute('data-set')){doSet(el);return;}
    if(el.id==='bk_file'){readBackupFile(el);return;}
    if(el.type==='date'&&el.hasAttribute('data-b')){render();return;}
    var l=el.getAttribute('data-live');if(l&&el.tagName==='SELECT'&&live[l])live[l](el);
  }catch(err){console.error(err);toast(T('Something went wrong. Please try again.'));}
});
function doSet(el){
  var k=el.getAttribute('data-set');
  if(k==='shop'){db.shop=el.value.trim();save();toast(T('Saved'));render();}
  else if(k==='slowDays'){db.settings.slowDays=Math.max(1,Math.min(365,Math.floor(num(el.value))||30));save();render();}
}

/* ---------- backup ---------- */
function backupStamp(){db.settings.backupAt=Date.now();log('system','Backup saved');save();}
function readBackupFile(el){
  var f=el.files&&el.files[0];if(!f)return;
  var r=new FileReader();r.onload=function(){restoreFrom(String(r.result||''));el.value='';};r.onerror=function(){toast(T('Could not read that file.'));};r.readAsText(f);
}
function restoreFrom(text){
  var o=null;try{o=migrate(JSON.parse(text));}catch(e){}
  if(!o)return showErr(T('That is not a valid backup.'));
  ask({title:T('Restore this backup?'),msg:T('This replaces everything on this phone with the backup: {a} devices, {b} sales.',{a:o.items.length+o.used.length,b:o.sales.length}),ok:T('Yes, restore'),danger:true,fn:function(){
    db=o;log('system','Backup restored');save();applyTheme();setTab('home');toast(T('Backup restored'));
  }});
}

/* ---------- sale and trade-in: confirm, then record ---------- */
function doRecordSale(){
  var res=recordSale();
  if(res.err){toast(res.err);return;}
  if(state.pages[state.pages.length-1]==='sale')state.pages.pop();
  openSheet({t:'sale',id:res.sale.id,done:T('Sale recorded.')});
}
function doTrade(){
  var res=recordTrade();
  if(res.err){toast(res.err);return;}
  var m=state.trade.method;state.trade=freshTrade(m);
  if(state.pages[state.pages.length-1]==='trade')state.pages.pop();
  openSheet({t:'sale',id:res.sale.id,done:T('Trade-in recorded.')});
}
function goAlert(g){
  if(!g)return;
  if(g.a==='page'){pushPage(g.v);return;}
  if(g.a==='undecided'){
    if(undecidedNew().length){setTab('stock');state.stockTab='new';state.newCat='Undecided';state.q='';}
    else if(undecidedUsed().length){setTab('stock');state.stockTab='used';state.usedStatus='stock';state.usedGrade='Undecided';state.usedQ='';}
    else{setTab('stock');state.stockTab='parts';state.partCat=undecidedParts().length?undecidedParts()[0].cat:null;state.partStatus='stock';}
    return;
  }
  openSheet({t:g.a,id:g.id});
}
function reorderText(){
  var L=[(db.shop||T('Your shop'))+' - '+T('Reorder list')+' ('+fmtDate(Date.now())+')'];
  db.items.filter(isLow).forEach(function(i){L.push('- '+i.name+': '+T('{n} left, reorder at {r}',{n:stock(i),r:i.reorder}));});
  return L.join('\n');
}

/* ---------- taps ---------- */
function act(a,el){
  var id=el.getAttribute('data-id'),v=el.getAttribute('data-v'),k=el.getAttribute('data-k');
  if(a!=='resetAll')state.armed=null;
  switch(a){
    /* navigation */
    case 'tab':setTab(v);break;
    case 'quick':openSheet({t:'quick'});return false;
    case 'page':pushPage(v);break;
    case 'back':if(histN>0){history.back();return false;}backOnce();break;
    case 'closeSheet':state.sheet=null;break;
    case 'confNo':state.conf=null;break;
    case 'confYes':var fn=state.conf&&state.conf.fn;state.conf=null;if(fn)fn();break;
    case 'goSales':setTab('sales');state.salesPeriod=v;state.salesQ='';break;
    case 'goLow':setTab('stock');state.stockTab='new';state.newCat='Low';state.q='';break;
    case 'goUsed':setTab('stock');state.stockTab='used';break;
    case 'goParts':setTab('stock');state.stockTab='parts';state.partCat=null;break;
    case 'goRepair':setTab('repair');break;
    case 'openSale':pushPage('sale');break;
    case 'alertGo':var al=computeAlerts().filter(function(x){return x.key===k;})[0];if(al)goAlert(al.go);break;
    case 'alertHide':db.alertsDismissed[k]=Date.now();save();break;
    case 'shareReorder':shareText(reorderText(),T('Reorder list copied'));return false;
    /* open records */
    case 'sale':case 'item':case 'used':case 'part':case 'repair':case 'expense':openSheet({t:a,id:id});return false;
    case 'itemNew':openItemForm();return false;case 'usedNew':openUsedForm();return false;case 'partNew':openPartForm();return false;
    case 'repairNew':openRepairForm();return false;case 'expenseNew':openExpenseForm();return false;
    case 'itemEdit':openItemForm(id);return false;case 'usedEdit':openUsedForm(id);return false;case 'partEdit':openPartForm(id);return false;
    case 'repairEdit':openRepairForm(id);return false;case 'expenseEdit':openExpenseForm(id);return false;
    case 'restock':openSheet({t:'restock',id:id},{f_serials:'',f_qty:''});return false;
    case 'decide':openDecide(v,id);return false;
    case 'correct':openSheet({t:'correct',id:id,k:v},{});return false;
    case 'unitRemove':openSheet({t:'unitRemove',id:id,serial:v},{});return false;
    case 'apartOpen':openApart(id);return false;
    case 'undoApartOpen':openSheet({t:'undoApart',id:id},{});return false;
    case 'undoSaleOpen':openSheet({t:'undoSale',id:id},{f_reason:''});return false;
    case 'payOpen':var ps=find(db.sales,id);openSheet({t:'payment',id:id},{f_amt:String(ps.balance),f_m:'Cash'});return false;
    case 'useInRepair':openSheet({t:'useIn',partId:id},{f_rep:'',f_uq:'1'});return false;
    case 'useInRepairFor':openSheet({t:'useIn',repairId:id},{f_part:'',f_uq:'1'});return false;
    case 'deliverOpen':var rd=find(db.repairs,id);openSheet({t:'deliver',id:id},{f_fee:String(rd.estimate||''),f_oc:'',f_paid:'',f_m:'Cash'});return false;
    /* lists and filters */
    case 'stockTab':state.stockTab=v;break;
    case 'setNewCat':state.newCat=v;break;
    case 'setUsedStatus':state.usedStatus=v;break;
    case 'setUsedGrade':state.usedGrade=v;break;
    case 'partCat':state.partCat=v===''?null:v;state.partType='All';state.partQ='';break;
    case 'setPartStatus':state.partStatus=v;break;
    case 'setPartType':state.partType=v;break;
    case 'salesPeriod':state.salesPeriod=v;if(v==='date'&&!state.salesDate)state.salesDate=ymd(Date.now());if(v==='range'){if(!state.salesFrom)state.salesFrom=ymd(addDays(Date.now(),-6));if(!state.salesTo)state.salesTo=ymd(Date.now());}break;
    case 'toggleVoid':state.salesVoid=!state.salesVoid;break;
    case 'setRepairFilter':state.repairFilter=v;break;
    case 'setActFilter':state.actFilter=v;break;
    case 'expDay':var d=addDays(expDay(),Number(v));if(d>startOfDay(Date.now()))d=startOfDay(Date.now());state.expDate=ymd(d);break;
    case 'pickTab':state.pickTab=v;break;
    /* form helpers */
    case 'fGrade':state.f.f_grade=v;break;
    case 'fDec':state.f.f_dec=v;break;
    case 'fTrack':state.f.f_track=v;break;
    case 'fExp':state.f.f_exp=v;break;
    case 'fMeth':state.f.f_m=v;break;
    /* saving */
    case 'itemSave':return itemSave();
    case 'restockSave':return restockSave(id);
    case 'correctSave':return correctSave(id,v);
    case 'decideSave':return decideSave(id,v);
    case 'usedSave':return usedSave();
    case 'partSave':return partSave();
    case 'useInSave':return useInSave();
    case 'unitRemoveSave':
      var it=find(db.items,id);if(!state.f.f_reason)return showErr(T('Choose a reason.'));
      removeUnit(it,v,state.f.f_reason);toast(T('Unit removed'));openSheet({t:'item',id:id});return false;
    case 'apartAdd':state.apart.rows.push({key:uid(),name:'',state:'untested',share:'1'});break;
    case 'apartRm':state.apart.rows.splice(Number(v),1);break;
    case 'apartSave':
      var dv=find(db.used,state.apart.deviceId),er=takeApart();if(er)return showErr(er);
      state.sheet=null;state.apart=null;setTab('stock');state.stockTab='parts';state.partCat=dv.cat;state.partStatus='stock';state.partType='All';state.partQ='';toast(T('Parts added to stock'));break;
    case 'repairSave':return repairSave();
    case 'expenseSave':return expenseSave();
    case 'repairStatus':
      var sp=v.split('|'),rr=find(db.repairs,sp[1]);if(rr&&rr.status!==sp[0]){rr.status=sp[0];if(sp[0]==='ready')rr.readyAt=Date.now();log('repair','Repair status: {d} is now {s}',{d:rr.device,s:T(cap(sp[0]))});save();}
      break;
    case 'repairPartRm':var rp=find(db.repairs,id);if(rp)removePartFromRepair(rp,Number(v));break;
    case 'deliverGo':return deliverGo(id);
    case 'paySave':
      var sx=find(db.sales,id),amt=num(state.f.f_amt);if(!amt)return showErr(T('Enter the amount received.'));
      addPayment(sx,amt,state.f.f_m||'Cash');toast(T('Payment saved'));openSheet({t:'sale',id:id});return false;
    case 'undoSaleGo':
      if(!state.f.f_reason)return showErr(T('Choose a reason.'));
      try{realRun(undoSaleFn(id),state.f.f_reason);}catch(e){console.error(e);toast(T('Something went wrong. Nothing was changed.'));break;}
      toast(T('Sale reversed'));openSheet({t:'sale',id:id});return false;
    case 'undoApartGo':
      try{realRun(undoApartFn(id));}catch(e2){console.error(e2);toast(T('Something went wrong. Nothing was changed.'));break;}
      toast(T('Take apart undone'));openSheet({t:'used',id:id});return false;
    case 'shareReceipt':shareText(receiptText(find(db.sales,id)),T('Receipt copied'));return false;
    /* delete */
    case 'itemDel':var di=find(db.items,id);ask({title:T('Delete this item?'),msg:di.name,ok:T('Delete'),danger:true,fn:function(){db.items=db.items.filter(function(x){return x.id!==id;});log('stock','Item deleted: {n}',{n:di.name});save();state.sheet=null;toast(T('Deleted'));}});return false;
    case 'usedDel':var du=find(db.used,id);ask({title:T('Delete this device?'),msg:du.name,ok:T('Delete'),danger:true,fn:function(){removeUsed(du);log('used','Used device deleted: {n}',{n:du.name});save();state.sheet=null;toast(T('Deleted'));}});return false;
    case 'partDel':var dp=find(db.parts,id);ask({title:T('Delete this part?'),msg:T(dp.name),ok:T('Delete'),danger:true,fn:function(){db.parts=db.parts.filter(function(x){return x.id!==id;});log('part','Spare part deleted: {n}',{n:T(dp.name)});save();state.sheet=null;toast(T('Deleted'));}});return false;
    case 'expenseDel':var de=find(db.expenses,id);ask({title:T('Delete this expense?'),msg:(de.note||T(de.cat))+' - '+fmt(de.amount)+' '+T('Birr'),ok:T('Delete'),danger:true,fn:function(){db.expenses=db.expenses.filter(function(x){return x.id!==id;});log('expense','Expense deleted: {c}, {n} Birr',{c:T(de.cat)+(de.note?' - '+de.note:''),n:fmt(de.amount)});save();state.sheet=null;toast(T('Deleted'));}});return false;
    case 'repairDel':var dr=find(db.repairs,id);ask({title:T('Delete this repair?'),msg:dr.device,ok:T('Delete'),danger:true,fn:function(){for(var i=dr.parts.length-1;i>=0;i--)removePartFromRepair(dr,i);db.repairs=db.repairs.filter(function(x){return x.id!==id;});log('repair','Repair deleted: {d}',{d:dr.device});save();state.sheet=null;toast(T('Deleted'));}});return false;
    /* selling */
    case 'sellItem':
      var si=find(db.items,id);
      if(si.track==='serial'){openSheet({t:'units',id:id,idx:null,go:true},{});return false;}
      addToCart('new',id);ensureSalePage();toast(T('Added to the sale'));break;
    case 'sellUsed':addToCart('used',id);ensureSalePage();toast(T('Added to the sale'));break;
    case 'sellPart':addToCart('part',id);ensureSalePage();toast(T('Added to the sale'));break;
    case 'cartAdd':openSheet({t:'pick'},{f_pq:''});return false;
    case 'pickItem':
      if(k==='new'&&find(db.items,id).track==='serial'){openSheet({t:'units',id:id,idx:null,go:false},{});return false;}
      addToCart(k,id);state.sheet=null;toast(T('Added to the sale'));break;
    case 'unitsGo':
      var us=state.sheet,picked=[].map.call(document.querySelectorAll('#sheetRoot [data-unit]:checked'),function(x){return x.value;});
      if(!picked.length)return showErr(T('Choose at least one unit.'));
      if(us.idx!=null)state.cart.lines[us.idx].serial=picked[0];else picked.forEach(function(s){addToCart('new',us.id,s);});
      state.sheet=null;if(us.go)ensureSalePage();break;
    case 'cartRm':state.cart.lines.splice(Number(v),1);break;
    case 'cartQty':
      var pr=v.split(':'),ln=state.cart.lines[Number(pr[0])],rf=lineRef(ln),mx=rf?(ln.kind==='used'||(ln.kind==='new'&&rf.track==='serial')?1:rf.qty):1;
      ln.qty=Math.max(1,Math.min(ln.qty+Number(pr[1]),mx));break;
    case 'cartPick':openSheet({t:'units',id:state.cart.lines[Number(v)].refId,idx:Number(v)},{});return false;
    case 'cartMethod':state.cart.method=v;break;
    case 'cartGo':
      var ce=cartError(state.cart);if(ce)return showErr(ce,'cartErr');
      ask({title:T('Record this sale?'),msg:T('Are you sure you want to record this sale?'),html:cartSummaryHtml(),ok:T('Yes, record sale'),fn:doRecordSale});return false;
    case 'tradeGrade':state.trade.grade=v;break;
    case 'tradeMethod':state.trade.method=v;break;
    case 'tradeGo':
      var tc=tradeCalc();if(tc.miss.length)return showErr(T('Still needed: {n}.',{n:tc.miss.join(', ')}),'tradeErr');
      var ti=state.trade.imei.trim();if(ti&&serialInUse(ti))return showErr(T('That IMEI or serial number is already in your stock: {n}',{n:ti}),'tradeErr');
      ask({title:T('Confirm trade-in?'),msg:T('Are you sure you want to record this trade-in?'),html:tradeSummary(),ok:T('Yes, record it'),fn:doTrade});return false;
    /* settings */
    case 'setLang':db.settings.lang=v;save();applyTheme();break;
    case 'setBg':db.settings.bgStyle=v;save();applyTheme();render();break;
    case 'colReset':db.settings.cAccent='';db.settings.cBar='#6EA8FE';db.settings.bgStyle='charcoal';save();applyTheme();render();break;
    case 'setMode':db.settings.mode=v;save();applyTheme();break;
    case 'setPalette':db.settings.palette=v;save();applyTheme();break;
    case 'setSize':db.settings.textSize=v;save();applyTheme();break;
    case 'setWeek':db.settings.weekStart=Number(v);save();break;
    case 'downloadBackup':if(downloadFile('shop-stock-backup-'+ymd(Date.now())+'.json',JSON.stringify(db),'application/json')){backupStamp();toast(T('Backup file saved'));}else toast(T('Could not save the file. Use Copy backup text instead.'));break;
    case 'copyBackup':copyText(JSON.stringify(db),T('Backup copied'));backupStamp();break;
    case 'restore':var txt=(state.f.bk_in||'').trim();if(!txt)return showErr(T('Paste your backup text first.'));return restoreFrom(txt);
    case 'pickBackupFile':var bf=$('#bk_file');if(bf)bf.click();return false;
    case 'exportSales':
      var rg=periodRange(state.salesPeriod),sl=salesBetween(rg[0],rg[1],state.salesVoid);if(state.salesQ.trim())sl=sl.filter(function(s){return saleMatches(s,state.salesQ);});
      downloadFile('sales-'+ymd(rg[0])+'.csv',salesCsv(sl));return false;
    case 'exportAll':
      var csv=v==='sales'?salesCsv(db.sales.slice().sort(function(x,y){return x.ts-y.ts;})):v==='stock'?stockCsv():v==='expenses'?expensesCsv():repairsCsv();
      downloadFile(v+'-'+ymd(Date.now())+'.csv',csv);return false;
    case 'clearDemo':
      ask({title:T('Remove the example data?'),msg:T('Your own entries stay.'),ok:T('Remove'),danger:true,fn:function(){
        var keep=function(x){return !x.demo;};
        db.items=db.items.filter(keep);db.used=db.used.filter(keep);db.parts=db.parts.filter(keep);db.sales=db.sales.filter(keep);db.repairs=db.repairs.filter(keep);db.expenses=db.expenses.filter(keep);db.activity=db.activity.filter(keep);
        db.demo=false;save();toast(T('Example data removed'));
      }});return false;
    case 'resetAll':
      if(state.armed==='reset'){var keepSet=db.settings;db=emptyDb();db.settings=keepSet;save();setTab('home');state.trade=freshTrade();state.cart=freshCart();toast(T('Everything erased'));}
      else{state.armed='reset';clearTimeout(act.t);act.t=setTimeout(function(){if(state.armed==='reset'){state.armed=null;render();}},4000);}
      break;
    default:return false;
  }
}
document.addEventListener('click',function(e){
  var t=e.target;
  if(t.hasAttribute&&t.hasAttribute('data-scrim')){if(state.conf)state.conf=null;else state.sheet=null;render();return;}
  var el=t.closest?t.closest('[data-a]'):null;if(!el||el.disabled)return;
  var r;
  try{r=act(el.getAttribute('data-a'),el);}catch(err){console.error(err);toast(T('Something went wrong. Please try again.'));return;}
  if(r!==false)render();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){if(state.conf)state.conf=null;else if(state.sheet)state.sheet=null;else return;render();}
});

/* ---------- repair, expense and delivery saves ---------- */
function repairSave(){
  var s=state.sheet,r=s.id?find(db.repairs,s.id):null,f=state.f,now=Date.now();
  var device=(f.f_dv||'').trim();if(!device)return showErr(T('Enter the device.'));
  var vals={customer:(f.f_cu||'').trim(),phone:(f.f_ph||'').trim(),device:device,imei:(f.f_im||'').trim(),problem:(f.f_pr||'').trim(),estimate:num(f.f_es),notes:(f.f_nt||'').trim()};
  if(r){extend(r,vals);save();toast(T('Saved'));openSheet({t:'repair',id:r.id});return false;}
  var nr=extend({id:uid(),ts:now,status:'received',parts:[],otherCost:0},vals);
  db.repairs.push(nr);log('repair','Repair received: {d} from {c}',{d:device,c:vals.customer||'-'},now);save();
  setTab('repair');state.repairFilter='open';state.repairQ='';toast(T('Repair added'));openSheet({t:'repair',id:nr.id});return false;
}
function expenseSave(){
  var s=state.sheet,e=s.id?find(db.expenses,s.id):null,f=state.f;
  var amt=num(f.f_amt);if(!amt)return showErr(T('Enter the amount.'));
  var day=fromYmd(f.f_date)||startOfDay(Date.now()),ts=e?e.ts:Date.now();
  if(!e||startOfDay(e.ts)!==day)ts=day===startOfDay(Date.now())?Date.now():day+43200000;
  var note=(f.f_note||'').trim();
  if(e){e.amount=amt;e.cat=f.f_cat;e.note=note;e.method=f.f_m||'Cash';e.ts=ts;log('expense','Expense changed: {c}, {n} Birr',{c:T(e.cat)+(note?' - '+note:''),n:fmt(amt)});save();toast(T('Saved'));openSheet({t:'expense',id:e.id});return false;}
  var ne={id:uid(),ts:ts,amount:amt,cat:f.f_cat,note:note,method:f.f_m||'Cash',ref:null};
  db.expenses.push(ne);log('expense','Expense recorded: {c}, {n} Birr',{c:T(ne.cat)+(note?' - '+note:''),n:fmt(amt)},ts);save();
  state.expDate=ymd(ts);state.sheet=null;toast(T('Expense saved'));
}
function deliverGo(id){
  var r=find(db.repairs,id),f=state.f,fee=num(f.f_fee);
  if(!fee)return showErr(T('Enter the final price.'));
  var raw=String(f.f_paid==null?'':f.f_paid).trim(),paid=raw===''?fee:Math.min(num(raw),fee);
  if(paid<fee&&!r.customer)return showErr(T('Add the customer name on the repair when part of the payment is still owed.'));
  var sale=deliverRepair(r,fee,f.f_m||'Cash',paid,num(f.f_oc));
  toast(T('Repair delivered'));openSheet({t:'sale',id:sale.id,done:T('Repair recorded as a sale.')});return false;
}

addEventListener('input',function(e){var c=e.target&&e.target.getAttribute&&e.target.getAttribute('data-col');if(c){db.settings[c]=e.target.value;save();applyTheme();}});
addEventListener('beforeinstallprompt',function(e){e.preventDefault();});
