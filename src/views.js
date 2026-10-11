'use strict';
/* Shop Stock screens: the tabs (Home, Stock, Sales, Repair) and the full pages (New sale, Trade-in, Notifications, Menu, Settings, Activity, Expenses, Customers who owe, Unsold stock). */

/* ---------- shared row builders ---------- */
function saleRow(s){
  return '<button class="row'+(s.voided?' off':'')+'" data-a="sale" data-id="'+s.id+'"><span class="grow"><b>'+esc(saleTitle(s))+'</b><small>'+esc(whenLabel(s.ts))+' · '+esc(T(s.method))+(s.customer?' · '+esc(s.customer):'')+'</small>'+tagsHtml(saleTags(s))+'</span><span class="end"><b class="num">'+fmt(s.price)+'</b><small class="num">'+esc(T('profit'))+' '+fmt(s.profit)+'</small></span></button>';
}
function alertRow(a){
  return '<button class="row" data-a="alertGo" data-k="'+esc(a.key)+'"><span class="alert-dot dot '+a.sev+'" style="width:10px;height:10px;border-radius:50%;flex:none;background:'+(a.sev==='bad'?'var(--bad)':a.sev==='warn'?'#D98A00':'var(--accent)')+'"></span><span class="grow"><b>'+esc(a.t)+'</b><small>'+esc(a.s)+'</small></span>'+ic(I.chev,18)+'</button>';
}
function newRow(i){
  var s=stock(i),low=isLow(i);
  var right=i.decision==='parts'?tag(T('For parts'),'gray'):tag(s===0?T('Out'):low?T('Low'):T('OK'),low?'bad':'good');
  return '<button class="row" data-a="item" data-id="'+i.id+'"><span class="grow"><b>'+esc(i.name)+'</b><small>'+esc(T(i.cat))+', '+esc(i.track==='serial'?T('tracked by IMEI or serial'):T('counted by quantity'))+'</small><span class="num" style="font-weight:600;margin-top:4px">'+(i.decision==='undecided'||!i.price?esc(T('Price undecided')):fmt(i.price)+' '+esc(T('Birr')))+'</span></span><span class="end"><span class="stockn num" style="color:'+(low?'var(--bad)':'var(--ink)')+'">'+s+'</span>'+right+'</span></button>';
}
function usedRow(u){
  var right;
  if(u.status==='sold')right='<b class="num">'+fmt(u.soldPrice)+'</b><small>'+esc(T('Sold'))+'</small>';
  else if(u.status==='parts')right='<b>'+esc(T('Parts'))+'</b><small>'+esc(T('Taken apart'))+'</small>';
  else right=priceText(u.ask,u.decision)+'<small class="num">'+esc(T('Bought'))+' '+fmt(u.buy)+'</small>';
  var undec=u.status==='stock'&&u.decision==='undecided';
  return '<button class="row" data-a="used" data-id="'+u.id+'"><span class="grade g'+u.grade+'">'+u.grade+'</span><span class="grow"><b>'+esc(u.name)+'</b><small>'+esc(u.imei?u.imei:T('No IMEI or serial'))+', '+esc(ageLabel(u.ts))+'</small>'+(undec?tagsHtml([{t:T('Undecided'),k:'warn'}]):'')+'</span><span class="end">'+right+'</span></button>';
}
function partRow(p){
  var k=p.state==='tested'?'good':p.state==='faulty'?'bad':'warn';
  return '<button class="row" data-a="part" data-id="'+p.id+'"><span class="grow"><b>'+esc(T(p.name))+(p.qty>1?' x'+p.qty:'')+'</b><small>'+esc(T('From'))+' '+esc(p.from?T(p.from):T('unknown'))+'</small>'+(p.qty>0&&p.decision==='undecided'?tagsHtml([{t:T('Undecided'),k:'warn'}]):'')+'</span><span class="end"><b class="num">'+(p.qty>0?(p.price?fmt(p.price):'-'):T('Gone'))+'</b><small class="num">'+esc(T('cost'))+' '+fmt(p.cost)+'</small>'+tag(T(cap(p.state)),k)+'</span></button>';
}
function repairRow(r){
  var k=r.status==='ready'?'good':r.status==='delivered'?'gray':r.status==='waiting'?'warn':'info';
  return '<button class="row" data-a="repair" data-id="'+r.id+'"><span class="grow"><b>'+esc(r.device)+'</b><small>'+esc(r.customer||T('No name'))+' · '+esc(r.problem||'')+'</small><small>'+esc(ageLabel(r.ts))+'</small></span><span class="end"><b class="num">'+fmt(r.status==='delivered'?r.fee:r.estimate)+'</b>'+tag(T(cap(r.status)),k)+'</span></button>';
}
function dayGroups(list,rowFn,tsOf){
  var out='',cur='',bucket=[];
  var flush=function(){if(bucket.length)out+='<div class="dayhead"><span>'+esc(dayLabel(bucket[0].ts))+'</span><span class="num">'+esc(T('{n} sales',{n:bucket.length}))+' · '+fmt(sum(bucket.filter(function(s){return !s.voided;}),function(s){return s.price;}))+'</span></div>'+bucket.map(rowFn).join('');bucket=[];};
  list.forEach(function(s){var d=startOfDay(tsOf(s));if(d!==cur){flush();cur=d;}bucket.push(s);});
  flush();return out;
}

/* ---------- HOME ---------- */
function viewHome(){
  var t0=startOfDay(Date.now()),t1=addDays(t0,1),todays=salesBetween(t0,t1,false),tot=totalsFor(todays,t0,t1);
  var spent=sum(expensesBetween(t0,t1),function(e){return e.amount;});
  var low=db.items.filter(isLow).length,slow=slowUsed().length+slowNew().length+slowParts().length;
  var openR=db.repairs.filter(function(r){return r.status!=='delivered';}).length;
  var debtors=uniq(debtList().map(function(s){return (s.customer||'?')+'|'+(s.phone||'');})).length;
  var alerts=visibleAlerts(),unseen=unseenAlerts().length;
  var recent=db.sales.filter(function(s){return !s.voided;}).sort(function(a,b){return b.ts-a.ts;}).slice(0,5);
  var today=dfmt(Date.now(),{weekday:'long',month:'short',day:'numeric'});
  var hasData=db.items.length+db.used.length+db.sales.length>0;
  var backupDue=!db.demo&&hasData&&(!db.settings.backupAt||daysSince(db.settings.backupAt)>=14);
  return '<header class="top"><div><p class="sub" style="margin:0 0 2px">'+esc(today)+'</p><h1>'+esc(db.shop||T('Your shop'))+'</h1></div><div class="acts">'+
    iconBtn('page',I.bell,T('Notifications'),unseen?'<span class="badge">'+unseen+'</span>':'','notifications')+iconBtn('page',I.menu,T('Menu'),'','menu')+'</div></header>'+
  (db.demo?'<div class="banner"><span>'+esc(T('You are looking at example data. Remove it before you start with your real stock.'))+'</span><button data-a="clearDemo">'+esc(T('Remove'))+'</button></div>':'')+
  (!storageOK?'<div class="banner"><span>'+esc(T('This browser is not saving data. Your changes will be lost when you close the page.'))+'</span></div>':'')+
  (backupDue?'<div class="banner"><span>'+esc(T('You have not backed up your data for a while.'))+'</span><button data-a="page" data-v="settings">'+esc(T('Back up'))+'</button></div>':'')+
  '<button class="hero" data-a="goSales" data-v="today"><div class="toprow"><div><div class="label">'+esc(T("Today's sales"))+'</div><div class="big num">'+fmt(tot.value)+'<span>'+esc(T('Birr'))+'</span></div></div>'+ic(I.chev,22)+'</div>'+
  '<div class="stats"><div><div class="label">'+esc(T('Profit'))+'</div><b class="num">'+fmt(tot.profit)+'</b></div><div><div class="label">'+esc(T('Cash in'))+'</div><b class="num">'+fmt(tot.cash)+'</b></div><div><div class="label">'+esc(T('Spent'))+'</div><b class="num">'+fmt(spent)+'</b></div></div></button>'+
  '<section class="tiles"><button class="tile" data-a="goLow"><b class="num" style="color:'+(low?'var(--bad)':'var(--ink)')+'">'+low+'</b><span>'+esc(T('Low stock'))+'</span></button>'+
  '<button class="tile" data-a="page" data-v="slow"><b class="num" style="color:'+(slow?'var(--warn)':'var(--ink)')+'">'+slow+'</b><span>'+esc(T('Slow stock'))+'</span></button>'+
  '<button class="tile" data-a="goRepair"><b class="num">'+openR+'</b><span>'+esc(T('Open repairs'))+'</span></button>'+
  '<button class="tile" data-a="goUsed"><b class="num">'+usedInStock().length+'</b><span>'+esc(T('Used units'))+'</span></button>'+
  '<button class="tile" data-a="goParts"><b class="num">'+partUnits(partsInStock())+'</b><span>'+esc(T('Spare parts'))+'</span></button>'+
  '<button class="tile" data-a="page" data-v="debts"><b class="num" style="color:'+(debtors?'var(--warn)':'var(--ink)')+'">'+debtors+'</b><span>'+esc(T('Customers owe'))+'</span></button></section>'+
  '<div class="btns"><button class="btn primary" data-a="openSale">'+ic(I.plus,18,2.2)+esc(T('New sale'))+'</button><button class="btn" data-a="page" data-v="trade">'+ic(I.swap,18)+esc(T('Trade-in'))+'</button></div>'+
  '<div class="btns"><button class="btn" data-a="repairNew">'+ic(I.wrench,18)+esc(T('New repair'))+'</button><button class="btn" data-a="expenseNew">'+ic(I.wallet,18)+esc(T('Add expense'))+'</button></div>'+
  '<section class="card"><div class="cardhead"><h3>'+esc(T('Needs attention'))+'</h3>'+(alerts.length>4?'<button class="link" data-a="page" data-v="notifications">'+esc(T('See all'))+'</button>':'')+'</div>'+(alerts.length?alerts.slice(0,4).map(alertRow).join(''):'<p class="empty" style="padding-block:10px">'+esc(T('Nothing needs attention right now.'))+'</p>')+'</section>'+
  '<section class="card"><div class="cardhead"><h3>'+esc(T('Recent sales'))+'</h3><button class="link" data-a="goSales" data-v="week">'+esc(T('See all'))+'</button></div>'+(recent.length?recent.map(saleRow).join(''):'<p class="empty" style="padding-block:10px">'+esc(T('No sales yet. Record your first sale with the + button.'))+'</p>')+'</section>';
}

/* ---------- STOCK (New | Used | Parts) ---------- */
function viewStock(){
  var st=state.stockTab,sub,add=st==='new'?'itemNew':st==='used'?'usedNew':'partNew',lbl=st==='new'?T('Add item'):st==='used'?T('Add used device'):T('Add part');
  if(st==='new')sub=viewNew();else if(st==='used')sub=viewUsed();else sub=viewParts();
  return topbar(T('Stock'),null,addBtn(add,lbl))+
    segHtml([{v:'new',t:T('New')},{v:'used',t:T('Used')},{v:'parts',t:T('Parts')}],st,'stockTab')+sub;
}
function newList(){
  var q=state.q.trim().toLowerCase(),c=state.newCat;
  var list=db.items.filter(function(i){
    if(c==='Low'&&!isLow(i))return false;
    if(c==='Undecided'&&i.decision!=='undecided')return false;
    if(c!=='All'&&c!=='Low'&&c!=='Undecided'&&i.cat!==c)return false;
    if(q&&(i.name+' '+i.cat+' '+T(i.cat)+' '+i.serials.join(' ')).toLowerCase().indexOf(q)<0)return false;
    return true;
  });
  if(!list.length)return emptyMsg(db.items.length?T('No items match. Try a different search or filter.'):T('No items yet. Tap + to add your first item.'));
  return list.map(newRow).join('');
}
function viewNew(){
  var cats=[];db.items.forEach(function(i){if(cats.indexOf(i.cat)<0)cats.push(i.cat);});
  var lowN=db.items.filter(isLow).length,und=undecidedNew().length;
  var opts=[{v:'All',t:T('All')},{v:'Low',t:T('Low stock')+' ('+lowN+')'}];
  if(und)opts.push({v:'Undecided',t:T('Undecided')+' ('+und+')'});
  opts=opts.concat(cats.map(function(c){return {v:c,t:T(c)};}));
  return '<p class="sub" style="margin-top:-6px">'+esc(T('{n} products, {l} low on stock',{n:db.items.length,l:lowN}))+'</p>'+
    searchBox('q',T('Search name or IMEI'),state.q,'newList')+chipsRow(opts,state.newCat,'setNewCat')+
    (state.newCat==='Low'&&lowN?'<button class="btn wide" data-a="shareReorder">'+ic(I.share,18)+esc(T('Share reorder list'))+'</button>':'')+
    '<section class="card flush" id="newList">'+newList()+'</section>';
}
function usedList(){
  var q=state.usedQ.trim().toLowerCase();
  var list=db.used.filter(function(u){
    if(u.status!==state.usedStatus)return false;
    if(state.usedGrade==='Undecided'){if(u.decision!=='undecided')return false;}
    else if(state.usedGrade!=='All'&&u.grade!==state.usedGrade)return false;
    if(q&&(u.name+' '+(u.imei||'')+' '+(u.notes||'')).toLowerCase().indexOf(q)<0)return false;
    return true;
  }).sort(function(a,b){return b.ts-a.ts;});
  return list.length?list.map(usedRow).join(''):emptyMsg(T('Nothing here yet.'));
}
function viewUsed(){
  var inStock=usedInStock(),tied=sum(inStock,function(u){return u.buy;}),slowN=slowUsed().length,und=undecidedUsed().length;
  var gradeOpts=[{v:'All',t:T('All')}];
  if(und)gradeOpts.push({v:'Undecided',t:T('Undecided')+' ('+und+')'});
  Object.keys(GRADES).forEach(function(g){gradeOpts.push({v:g,t:g});});
  return '<p class="sub" style="margin-top:-6px">'+esc(T('{n} units in stock, graded A to E',{n:inStock.length}))+'</p>'+
  '<section class="tiles2"><div class="tile"><span>'+esc(T('Money tied up'))+'</span><b class="num" style="font-size:20px;margin-top:4px">'+fmt(tied)+'</b></div>'+
  '<button class="tile" data-a="page" data-v="slow"><span>'+esc(T('Unsold {n}+ days',{n:slowDays()}))+'</span><b class="num" style="font-size:20px;margin-top:4px;color:'+(slowN?'var(--warn)':'var(--ink)')+'">'+esc(T('{n} units',{n:slowN}))+'</b></button></section>'+
  segHtml([{v:'stock',t:T('In stock')},{v:'sold',t:T('Sold')},{v:'parts',t:T('Taken apart')}],state.usedStatus,'setUsedStatus')+
  searchBox('uq',T('Search name or IMEI'),state.usedQ,'usedList')+
  chipsRow(gradeOpts,state.usedGrade,'setUsedGrade')+
  '<section class="card flush" id="usedList">'+usedList()+'</section>';
}
function partsInCat(c){return db.parts.filter(function(p){return p.cat===c;});}
function partList(){
  var q=state.partQ.trim().toLowerCase(),c=state.partCat;
  var list=partsInCat(c).filter(function(p){
    if(state.partStatus==='stock'?p.qty<=0:p.qty>0)return false;
    if(state.partType!=='All'&&p.name!==state.partType)return false;
    if(q&&(p.name+' '+T(p.name)+' '+(p.from||'')).toLowerCase().indexOf(q)<0)return false;
    return true;
  }).sort(function(a,b){return b.ts-a.ts;});
  return list.length?list.map(partRow).join(''):emptyMsg(T('No parts here yet.'));
}
function viewParts(){
  var apart='<section class="hero" style="gap:10px"><div><div style="font-size:16px;font-weight:700">'+esc(T('Take a device apart'))+'</div><div class="label" style="margin-top:4px;line-height:1.4">'+esc(T('Pick a used device, list the parts you got, and the app splits its buy-in cost across them.'))+'</div></div><button class="btn wide" data-a="apartOpen">'+esc(T('Start'))+'</button></section>';
  if(state.partCat==null){
    var cards=DEV_CATS.map(function(c){
      var ps=partsInCat(c),n=partUnits(ps.filter(function(p){return p.qty>0;})),val=sum(ps,function(p){return p.qty*p.cost;});
      return '<button class="catcard" data-a="partCat" data-v="'+c+'"><span class="ci">'+ic(partCatIcon(c),22)+'</span><b>'+esc(T(DEV_CAT_LABEL[c]))+'</b><small>'+esc(T('{n} parts in stock',{n:n}))+'</small></button>';
    }).join('');
    return '<p class="sub" style="margin-top:-6px">'+esc(T('Choose what the part came from'))+'</p><div class="catgrid">'+cards+'</div>'+apart;
  }
  var c=state.partCat,types=[];
  PART_TYPES[c].forEach(function(t){types.push(t);});partsInCat(c).forEach(function(p){if(types.indexOf(p.name)<0)types.push(p.name);});
  var present=types.filter(function(t){return partsInCat(c).some(function(p){return p.name===t;});});
  return '<div class="btns" style="align-items:center"><button class="btn sm" data-a="partCat" data-v="" style="flex:none">'+ic(I.back,18,2)+esc(T('Categories'))+'</button><b style="flex:1;font-size:18px">'+esc(T(DEV_CAT_LABEL[c]))+'</b></div>'+
    segHtml([{v:'stock',t:T('In stock')},{v:'gone',t:T('Used or sold')}],state.partStatus,'setPartStatus')+
    searchBox('pq',T('Search parts'),state.partQ,'partList')+
    chipsRow([{v:'All',t:T('All')}].concat(present.map(function(t){return {v:t,t:T(t)};})),state.partType,'setPartType')+
    '<section class="card flush" id="partList">'+partList()+'</section>'+apart;
}

/* ---------- SALES (history by period) ---------- */
function salesBody(){
  var r=periodRange(state.salesPeriod),q=state.salesQ.trim(),list=salesBetween(r[0],r[1],state.salesVoid);
  if(q)list=list.filter(function(s){return saleMatches(s,q);});
  var act=list.filter(function(s){return !s.voided;}),tot=totalsFor(act,r[0],r[1]);
  if(q)tot.cash=sum(act,function(s){return (s.ts>=r[0]&&s.ts<r[1]?s.cash:0)+sum(s.payments,function(p){return p.ts>=r[0]&&p.ts<r[1]?p.amount:0;});});
  var multi=(r[1]-r[0])>DAY;
  var body=list.length?(multi?dayGroups(list,saleRow,function(s){return s.ts;}):list.map(saleRow).join('')):emptyMsg(q?T('No sales match your search.'):T('No sales in this period.'));
  return '<section class="card"><div class="sum"><div class="l"><span>'+esc(q?T('Matching sales'):periodLabel(state.salesPeriod))+'</span><span class="num">'+esc(T('{n} sales',{n:tot.count}))+'</span></div>'+
    '<div class="facts"><div><small>'+esc(T('Sales value'))+'</small><b class="num">'+fmt(tot.value)+'</b></div><div><small>'+esc(T('Cash received'))+'</small><b class="num">'+fmt(tot.cash)+'</b></div><div><small>'+esc(T('Profit'))+'</small><b class="num">'+fmt(tot.profit)+'</b></div><div><small>'+esc(T('Still owed'))+'</small><b class="num">'+fmt(tot.owed)+'</b></div></div></div></section>'+
    '<section class="card flush">'+body+'</section>';
}
function viewSales(){
  var p=state.salesPeriod;
  var opts=[{v:'today',t:T('Today')},{v:'yesterday',t:T('Yesterday')},{v:'week',t:T('This week')},{v:'date',t:T('A date')},{v:'range',t:T('Date range')}];
  var pick='';
  if(p==='date')pick=fInput('sd',T('Date'),{b:'salesDate',type:'date',max:ymd(Date.now())});
  if(p==='range')pick='<div class="grid2">'+fInput('sf',T('From'),{b:'salesFrom',type:'date',max:ymd(Date.now())})+fInput('st',T('To'),{b:'salesTo',type:'date',max:ymd(Date.now())})+'</div>';
  return topbar(T('Sales'),null,addBtn('openSale',T('New sale'))+iconBtn('exportSales',I.download,T('Export this list to Excel')))+
    chipsRow(opts,p,'salesPeriod')+pick+
    searchBox('sq',T('Search sales, customers or IMEI'),state.salesQ,'salesBody')+
    '<div class="chips"><button class="chip" data-a="toggleVoid" aria-pressed="'+state.salesVoid+'">'+esc(T('Show reversed sales'))+'</button></div>'+
    '<div id="salesBody" class="form">'+salesBody()+'</div>';
}

/* ---------- REPAIR ---------- */
function repairList(){
  var q=state.repairQ.trim().toLowerCase(),f=state.repairFilter;
  var list=db.repairs.filter(function(r){
    if(f==='open'&&r.status==='delivered')return false;
    if(f==='ready'&&r.status!=='ready')return false;
    if(f==='delivered'&&r.status!=='delivered')return false;
    if(q&&(r.device+' '+(r.customer||'')+' '+(r.phone||'')+' '+(r.problem||'')+' '+(r.imei||'')).toLowerCase().indexOf(q)<0)return false;
    return true;
  }).sort(function(a,b){return b.ts-a.ts;});
  return list.length?list.map(repairRow).join(''):emptyMsg(T('No repair jobs here.'));
}
function viewRepair(){
  var t0=startOfDay(Date.now()),m0=new Date(t0);m0.setDate(1);m0=m0.getTime();
  var inc=function(a,b){return sum(db.sales.filter(function(s){return !s.voided&&s.ts>=a&&s.ts<b&&s.lines.length===1&&s.lines[0].kind==='repair';}),function(s){return s.price;});};
  var openN=db.repairs.filter(function(r){return r.status!=='delivered';}).length,rdy=db.repairs.filter(function(r){return r.status==='ready';}).length;
  var opts=[{v:'open',t:T('Open')+' ('+openN+')'},{v:'ready',t:T('Ready')+' ('+rdy+')'},{v:'delivered',t:T('Delivered')},{v:'all',t:T('All')}];
  return topbar(T('Repair'),T('{n} open jobs',{n:openN}),addBtn('repairNew',T('New repair')))+
    '<section class="tiles2"><div class="tile"><span>'+esc(T('Repair income today'))+'</span><b class="num" style="font-size:20px;margin-top:4px">'+fmt(inc(t0,addDays(t0,1)))+'</b></div><div class="tile"><span>'+esc(T('This month'))+'</span><b class="num" style="font-size:20px;margin-top:4px">'+fmt(inc(m0,addDays(t0,1)))+'</b></div></section>'+
    chipsRow(opts,state.repairFilter,'setRepairFilter')+
    searchBox('rq',T('Search device, customer or phone'),state.repairQ,'repairList')+
    '<section class="card flush" id="repairList">'+repairList()+'</section>';
}

/* ---------- PAGE: new sale (cart) ---------- */
function cartLineHtml(l,idx){
  var r=lineRef(l),sub='';
  if(l.kind==='new'&&r&&r.track==='serial')sub=l.serial?'<span class="mono">IMEI/SN '+esc(l.serial)+'</span>':'';
  else if(l.kind==='used')sub=esc(T('Used'))+(r&&r.imei?', <span class="mono">'+esc(r.imei)+'</span>':'');
  else if(l.kind==='part')sub=esc(T('Spare part'));
  var needUnit=l.kind==='new'&&r&&r.track==='serial'&&!l.serial;
  var qty=(l.kind==='new'&&r&&r.track==='qty')||l.kind==='part';
  var max=r?(l.kind==='used'?1:(l.kind==='new'&&r.track==='serial'?1:r.qty)):1;
  return '<div class="cartline"><div class="top2"><div><b>'+esc(l.kind==='part'?T(l.name):l.name)+'</b><div><small>'+sub+'</small></div></div><button class="iconbtn" data-a="cartRm" data-v="'+idx+'" aria-label="'+esc(T('Remove'))+'">'+ic(I.x,20,2)+'</button></div>'+
    (needUnit?'<button class="btn sm danger" data-a="cartPick" data-v="'+idx+'">'+esc(T('Choose IMEI or serial number'))+'</button>':'')+
    '<div class="grid2">'+fInput('lp'+idx,T('Price each (Birr)'),{b:'cart.lines.'+idx+'.price',im:'numeric',live:'cart'})+
    (qty?'<div class="field">'+esc(T('Quantity'))+'<div class="stepper"><button type="button" data-a="cartQty" data-v="'+idx+':-1" aria-label="'+esc(T('Less'))+'">'+ic(I.minus,18,2)+'</button><b class="num" id="lq'+idx+'">'+l.qty+'</b><button type="button" data-a="cartQty" data-v="'+idx+':1" data-max="'+max+'" aria-label="'+esc(T('More'))+'">'+ic(I.plus,18,2)+'</button></div></div>':'<div></div>')+'</div>'+
    '<div id="lw'+idx+'"></div></div>';
}
function cartSummaryHtml(){
  var t=cartTotals(state.cart);
  return '<div class="sum"><div class="l"><span>'+esc(T('Subtotal'))+'</span><span class="num">'+fmt(t.sub)+'</span></div>'+
    (t.disc>0?'<div class="l"><span>'+esc(T('Discount'))+'</span><span class="num">- '+fmt(t.disc)+'</span></div>':'')+
    '<div class="total"><span style="font-weight:700">'+esc(T('Total'))+'</span><b class="num">'+fmt(t.total)+' <small style="font-size:14px;font-weight:600">'+esc(T('Birr'))+'</small></b></div>'+
    '<div class="l"><span>'+esc(T('Paid now'))+'</span><span class="num">'+fmt(t.paid)+'</span></div>'+
    (t.balance>0?'<div class="l"><span>'+esc(T('Still owed'))+'</span><span class="num" style="color:var(--warn);font-weight:700">'+fmt(t.balance)+'</span></div>':'')+'</div>';
}
function customersList(){
  var seen={},o='';db.sales.forEach(function(s){if(s.customer&&!seen[s.customer]){seen[s.customer]=1;o+='<option value="'+esc(s.customer)+'">';}});
  return '<datalist id="custlist">'+o+'</datalist>';
}
function pageSale(){
  var c=state.cart,rs=REASONS_DISC.map(function(r){return {v:r,t:T(r)};});
  return pagehead(T('New sale'))+
    '<section class="card"><div class="cardhead"><h3>'+esc(T('Items'))+'</h3></div>'+(c.lines.length?c.lines.map(cartLineHtml).join(''):'<p class="empty" style="padding-block:10px">'+esc(T('No items yet. Tap Add item.'))+'</p>')+
    '<button class="btn wide" data-a="cartAdd" style="margin-top:10px">'+ic(I.plus,18,2.2)+esc(T('Add item'))+'</button></section>'+
    '<section class="card form"><h3 style="margin:0">'+esc(T('Customer (optional)'))+'</h3>'+customersList()+
    '<div class="grid2">'+fInput('cc',T('Name'),{b:'cart.customer',list:'custlist',live:'cart'})+fInput('cp',T('Phone'),{b:'cart.phone',type:'tel',im:'tel'})+'</div></section>'+
    '<section class="card form"><h3 style="margin:0">'+esc(T('Payment'))+'</h3>'+
    '<div class="grid2">'+fInput('cd',T('Discount (Birr)'),{b:'cart.discount',im:'numeric',live:'cart'})+fInput('cpd',T('Paid now'),{b:'cart.paid',im:'numeric',live:'cart',ph:T('Full amount')})+'</div>'+
    fSelect('cr',T('Reason for the discount'),[{v:'',t:T('Choose a reason')}].concat(rs),{b:'cart.reason',live:'cart',hid:!(num(c.discount)>0)})+
    '<div><div class="field" style="margin-bottom:6px">'+esc(T('Paid by'))+'</div>'+segHtml(methodOpts(),c.method,'cartMethod')+'</div></section>'+
    '<section class="card"><div id="cartSummary">'+cartSummaryHtml()+'</div></section>'+
    '<p class="err" id="cartErr" role="alert" hidden></p>'+
    '<button class="btn primary wide" data-a="cartGo">'+esc(T('Record sale'))+'</button>';
}

/* ---------- PAGE: trade-in ---------- */
function unitListHtml(it,selected,multi,taken,filterId){
  var u=(it.serials||[]).filter(function(s){return !(taken&&taken[s]);});
  if(!u.length)return '<p class="empty">'+esc(T('No units left.'))+'</p>';
  return (u.length>6?'<label class="search">'+ic(I.search,20)+'<input id="'+filterId+'" type="search" placeholder="'+esc(T('Search IMEI or serial'))+'" aria-label="'+esc(T('Search IMEI or serial'))+'" data-live="unitFilter" autocomplete="off"></label>':'')+
    '<div class="unitlist" role="group" aria-label="'+esc(T('IMEI or serial numbers'))+'">'+u.map(function(s){
      return '<label class="unit" data-s="'+esc(s.toLowerCase())+'"><input type="'+(multi?'checkbox':'radio')+'" name="unit" value="'+esc(s)+'" data-unit'+(selected&&selected.indexOf(s)>=0?' checked':'')+'><span class="mono">'+esc(s)+'</span></label>';
    }).join('')+'</div>';
}
function tradeSummary(){
  var c=tradeCalc(),t=state.trade,out=c.diff<0;
  return '<div class="sum"><div class="l"><span>'+esc(T('New device'))+'</span><span class="num">'+fmt(c.price)+'</span></div><div class="l"><span>'+esc(T('Trade-in value'))+'</span><span class="num">- '+fmt(c.value)+'</span></div>'+
  '<div class="total"><span style="font-weight:700">'+esc(out?T('You pay the customer'):T('Customer pays'))+'</span><b class="num'+(out?' out':'')+'">'+fmt(Math.abs(c.diff))+' <small style="font-size:14px;font-weight:600">'+esc(T('Birr'))+'</small></b></div></div>'+
  '<div style="margin-top:12px"><small style="font-weight:700;color:var(--ink)">'+esc(T('When you confirm, the app will:'))+'</small>'+okSteps([
    T('Remove {n} from new stock',{n:c.it?c.it.name:T('the new device')}),
    T('Add {n} to used stock at a cost of {c}',{n:t.name.trim()||T('the old device'),c:fmt(c.value)}),
    out?T('Record {n} Birr paid out by {m}',{n:fmt(Math.abs(c.diff)),m:T(t.method)}):T('Record {n} Birr received by {m}',{n:fmt(Math.abs(c.diff)),m:T(t.method)})])+'</div>'+
  (c.miss.length?'<p class="sub" style="margin-top:10px">'+esc(T('Still needed: {n}.',{n:c.miss.join(', ')}))+'</p>':'');
}
function pageTrade(){
  var t=state.trade,c=tradeCalc();
  var avail=db.items.filter(function(i){return stock(i)>0&&i.decision!=='parts';});
  var itemOpts=[{v:'',t:T('Choose a new device')}].concat(avail.map(function(i){return {v:i.id,t:i.name+' ('+stock(i)+' '+T('left')+')'};}));
  var units='';
  if(c.it&&c.it.track==='serial')units='<div class="field">'+esc(T('Which unit does the customer take?'))+'</div>'+unitListHtml(c.it,t.serial?[t.serial]:[],false,null,'tfilter');
  return pagehead(T('Trade-in'))+
  (state.tradeDone?'<div class="okbox">'+ic(I.check,20,2.4)+'<span>'+esc(state.tradeDone)+'</span></div>':'')+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Customer brings'))+'</h3>'+
  fSelect('tc',T('Type of device'),DEV_CATS.map(function(x){return {v:x,t:T(DEV_CAT_LABEL[x])};}),{b:'trade.cat'})+
  fInput('tn',T('Device'),{b:'trade.name',live:'trade',ph:T('For example Samsung A54')})+
  fInput('ti',T('IMEI or serial number'),{b:'trade.imei',im:'text'})+
  '<div><div class="field" style="margin-bottom:6px">'+esc(T('Condition'))+'</div><div class="chips" role="group" aria-label="'+esc(T('Condition'))+'">'+Object.keys(GRADES).map(function(g){return '<button type="button" class="chip" data-a="tradeGrade" data-v="'+g+'" aria-pressed="'+(t.grade===g)+'">'+g+'</button>';}).join('')+'</div><small>'+esc(t.grade)+': '+esc(T(GRADES[t.grade]))+'</small></div>'+
  '<div class="grid2">'+fInput('tv',T('Agreed value (Birr)'),{b:'trade.value',im:'numeric',live:'trade'})+fInput('ta',T('Resale price (optional)'),{b:'trade.ask',im:'numeric'})+'</div>'+
  fInput('tcu',T('Customer name or phone (optional)'),{b:'trade.customer'})+'</section>'+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Customer takes'))+'</h3>'+
  fSelect('tit',T('New device'),itemOpts,{b:'trade.itemId',live:'tradeItem'})+units+
  fInput('tp',T('Selling price (Birr)'),{b:'trade.price',im:'numeric',live:'trade'})+'</section>'+
  '<section class="card"><div id="tradeSummary">'+tradeSummary()+'</div></section>'+
  '<div><div class="field" style="margin-bottom:6px">'+esc(T('Paid by'))+'</div>'+segHtml(methodOpts(),t.method,'tradeMethod')+'</div>'+
  '<p class="err" id="tradeErr" role="alert" hidden></p>'+
  '<button class="btn primary wide" id="tradeGo" data-a="tradeGo">'+esc(T('Confirm trade-in'))+'</button>';
}

/* ---------- PAGE: notifications ---------- */
function pageNotifications(){
  var al=visibleAlerts(),low=db.items.filter(isLow).length;
  var rows=al.map(function(a){
    return '<div class="alert"><span class="dot '+a.sev+'"></span><div class="grow"><b>'+esc(a.t)+'</b><small>'+esc(a.s)+'</small><div class="acts"><button data-a="alertGo" data-k="'+esc(a.key)+'">'+esc(T('Open'))+'</button><button class="muted" data-a="alertHide" data-k="'+esc(a.key)+'">'+esc(T('Hide for today'))+'</button></div></div></div>';
  }).join('');
  return pagehead(T('Notifications'))+
    (low?'<button class="btn wide" data-a="shareReorder">'+ic(I.share,18)+esc(T('Share reorder list'))+'</button>':'')+
    '<section class="card">'+(rows||'<p class="empty">'+esc(T('Nothing needs attention right now.'))+'</p>')+'</section>'+
    '<p class="sub">'+esc(T('These alerts are checked every time you open the app. They disappear when the problem is fixed.'))+'</p>';
}

/* ---------- PAGE: menu ---------- */
function menuItem(a,v,icon,t,s){return '<button data-a="'+a+'" data-v="'+v+'"><span class="ci">'+ic(icon,22)+'</span><span class="grow"><b>'+esc(t)+'</b><small>'+esc(s)+'</small></span>'+ic(I.chev,18)+'</button>';}
function pageMenu(){
  var debts=sum(debtList(),function(s){return s.balance;}),t0=startOfDay(Date.now());
  var spent=sum(expensesBetween(t0,addDays(t0,1)),function(e){return e.amount;});
  return pagehead(T('Menu'))+'<section class="card"><div class="menulist">'+
    menuItem('page','notifications',I.bell,T('Notifications'),T('{n} alerts',{n:visibleAlerts().length}))+
    menuItem('page','activity',I.activity,T('Activity'),T('Everything that happened in the app'))+
    menuItem('page','expenses',I.wallet,T('Expenses'),T('Spent today: {n} Birr',{n:fmt(spent)}))+
    menuItem('page','debts',I.users,T('Customers who owe'),T('{n} Birr owed',{n:fmt(debts)}))+
    menuItem('page','slow',I.clock,T('Unsold stock'),T('Items unsold for {d}+ days',{d:slowDays()}))+
    menuItem('page','settings',I.gear,T('Settings'),T('Language, theme, backup'))+'</div></section>';
}

/* ---------- PAGE: unsold stock ---------- */
function pageSlow(){
  var d=slowDays(),opts=SLOW_OPTIONS.slice();if(opts.indexOf(d)<0){opts.push(d);opts.sort(function(a,b){return a-b;});}
  var su=slowUsed(),sn=slowNew(),sp=slowParts();
  var tied=sum(su,function(u){return u.buy;})+sum(sn,function(i){return stock(i)*i.cost;})+sum(sp,function(p){return p.qty*p.cost;});
  var newRowSlow=function(i){return '<button class="row" data-a="item" data-id="'+i.id+'"><span class="grow"><b>'+esc(i.name)+'</b><small>'+esc(T('No sale for {n} days',{n:daysSince(idleSince(i))}))+'</small></span><span class="end"><b class="num">'+stock(i)+'</b><small class="num">'+fmt(stock(i)*i.cost)+'</small></span></button>';};
  var partRowSlow=function(p){return '<button class="row" data-a="part" data-id="'+p.id+'"><span class="grow"><b>'+esc(T(p.name))+'</b><small>'+esc(T(DEV_CAT_LABEL[p.cat]))+', '+esc(ageLabel(p.ts))+'</small></span><span class="end"><b class="num">'+p.qty+'</b><small class="num">'+fmt(p.qty*p.cost)+'</small></span></button>';};
  var sec=function(title,list,fn){return list.length?'<section class="card flush"><div class="cardhead" style="padding-top:12px"><h3>'+esc(title)+' ('+list.length+')</h3></div>'+list.map(fn).join('')+'</section>':'';};
  return pagehead(T('Unsold stock'))+
    '<section class="card form"><label class="field" for="sdays">'+esc(T('Show items unsold for at least'))+'<select id="sdays" data-set="slowDays">'+opts.map(function(o){return '<option value="'+o+'"'+(o===d?' selected':'')+'>'+T('{n} days',{n:o})+'</option>';}).join('')+'</select></label>'+
    '<div class="sum"><div class="l"><span>'+esc(T('Money tied up'))+'</span><span class="num">'+fmt(tied)+' '+esc(T('Birr'))+'</span></div></div><small>'+esc(T('This number is also used for the alerts and the Unsold card. You can change it any time.'))+'</small></section>'+
    sec(T('Used devices'),su,usedRow)+sec(T('New items'),sn,newRowSlow)+sec(T('Spare parts'),sp,partRowSlow)+
    ((su.length+sn.length+sp.length)?'':'<section class="card">'+emptyMsg(T('Nothing has been sitting for {d} days or more.',{d:d}))+'</section>');
}

/* ---------- PAGE: activity ---------- */
var ACT_GROUPS={stock:['stock','used','part','price','decision'],sales:['sale','trade'],repair:['repair'],money:['expense','money'],fix:['undo','fix'],system:['system']};
var ACT_ICON={stock:I.box,used:I.phone,part:I.chip,price:I.receipt,decision:I.star,sale:I.chart,trade:I.swap,repair:I.wrench,expense:I.wallet,money:I.wallet,undo:I.undo,fix:I.undo,system:I.gear};
function actText(a){return T(a.k,a.v);}
function actList(){
  var q=state.actQ.trim().toLowerCase(),g=state.actFilter,list=db.activity.slice().sort(function(a,b){return b.ts-a.ts;});
  if(g!=='all')list=list.filter(function(a){return ACT_GROUPS[g].indexOf(a.type)>=0;});
  if(q)list=list.filter(function(a){return actText(a).toLowerCase().indexOf(q)>=0;});
  list=list.slice(0,300);
  if(!list.length)return emptyMsg(T('Nothing recorded yet.'));
  var out='',cur='';
  list.forEach(function(a){
    var d=startOfDay(a.ts);if(d!==cur){cur=d;out+='<div class="dayhead"><span>'+esc(dayLabel(a.ts))+'</span><span></span></div>';}
    out+='<div class="row" style="min-height:52px"><span style="flex:none;color:var(--accent)">'+ic(ACT_ICON[a.type]||I.activity,20)+'</span><span class="grow"><b style="font-weight:600">'+esc(actText(a))+'</b><small>'+esc(tfmt(a.ts))+'</small></span></div>';
  });
  return out;
}
function pageActivity(){
  var opts=[{v:'all',t:T('All')},{v:'stock',t:T('Stock')},{v:'sales',t:T('Sales')},{v:'repair',t:T('Repair')},{v:'money',t:T('Money')},{v:'fix',t:T('Corrections')},{v:'system',t:T('App')}];
  return pagehead(T('Activity'))+chipsRow(opts,state.actFilter,'setActFilter')+searchBox('aq',T('Search activity'),state.actQ,'actList')+'<section class="card flush" id="actList">'+actList()+'</section>';
}

/* ---------- PAGE: expenses ---------- */
function expDay(){return fromYmd(state.expDate)||startOfDay(Date.now());}
function pageExpenses(){
  var d=expDay(),list=expensesBetween(d,addDays(d,1)),tot=sum(list,function(e){return e.amount;});
  var stockSpent=sum(list.filter(function(e){return STOCK_EXP.indexOf(e.cat)>=0;}),function(e){return e.amount;});
  var byCat={};list.forEach(function(e){byCat[e.cat]=(byCat[e.cat]||0)+e.amount;});
  var isTd=d===startOfDay(Date.now());
  var rows=list.map(function(e){
    return '<button class="row" data-a="expense" data-id="'+e.id+'"><span class="grow"><b>'+esc(e.note||T(e.cat))+'</b><small>'+esc(T(e.cat))+' · '+esc(T(e.method))+' · '+esc(tfmt(e.ts))+'</small></span><span class="end"><b class="num">'+fmt(e.amount)+'</b></span></button>';
  }).join('');
  return pagehead(T('Expenses'),addBtn('expenseNew',T('Add expense')))+
    '<div class="grid2" style="grid-template-columns:44px minmax(0,1fr) 44px;align-items:end"><button class="iconbtn" data-a="expDay" data-v="-1" aria-label="'+esc(T('Previous day'))+'">'+ic(I.back,20,2)+'</button>'+fInput('ed',T('Day'),{b:'expDate',type:'date',max:ymd(Date.now())})+'<button class="iconbtn" data-a="expDay" data-v="1" aria-label="'+esc(T('Next day'))+'">'+ic(I.chev,20,2)+'</button></div>'+
    '<section class="card"><div class="label"><small>'+esc(isTd?T('Spent today'):T('Spent on {d}',{d:fmtDate(d)}))+'</small></div><div style="font-size:34px;font-weight:800;margin-top:4px" class="num">'+fmt(tot)+' <small style="font-size:15px">'+esc(T('Birr'))+'</small></div>'+
    (tot?'<div class="sum" style="margin-top:10px"><div class="l"><span>'+esc(T('Buying stock and parts'))+'</span><span class="num">'+fmt(stockSpent)+'</span></div><div class="l"><span>'+esc(T('Running costs'))+'</span><span class="num">'+fmt(tot-stockSpent)+'</span></div></div>':'')+'</section>'+
    (tot?'<section class="card"><h3>'+esc(T('By type'))+'</h3>'+Object.keys(byCat).map(function(k){return kv(T(k),'<b class="num">'+fmt(byCat[k])+'</b>');}).join('')+'</section>':'')+
    '<section class="card flush">'+(rows||emptyMsg(T('No expenses on this day.')))+'</section>'+
    '<p class="sub">'+esc(T('Trade-in values are not cash spent, so they do not appear here.'))+'</p>';
}

/* ---------- PAGE: customers who owe ---------- */
function pageDebts(){
  var list=debtList(),tot=sum(list,function(s){return s.balance;}),groups={},order=[];
  list.forEach(function(s){var k=(s.customer||T('No name'))+(s.phone?' ('+s.phone+')':'');if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(s);});
  var body=order.map(function(k){
    var g=groups[k],t=sum(g,function(s){return s.balance;});
    return '<section class="card flush"><div class="cardhead" style="padding-top:12px"><h3>'+esc(k)+'</h3><b class="num" style="color:var(--warn)">'+fmt(t)+'</b></div>'+g.map(function(s){return '<button class="row" data-a="sale" data-id="'+s.id+'"><span class="grow"><b>'+esc(saleTitle(s))+'</b><small>'+esc(whenLabel(s.ts))+' · '+esc(T('{n} days ago',{n:daysSince(s.ts)}))+'</small></span><span class="end"><b class="num">'+fmt(s.balance)+'</b><small>'+esc(T('of {n}',{n:fmt(s.price)}))+'</small></span></button>';}).join('')+'</section>';
  }).join('');
  return pagehead(T('Customers who owe'))+'<section class="card"><small>'+esc(T('Total owed to you'))+'</small><div style="font-size:30px;font-weight:800" class="num">'+fmt(tot)+' <small style="font-size:15px">'+esc(T('Birr'))+'</small></div></section>'+(body||'<section class="card">'+emptyMsg(T('Nobody owes you anything.'))+'</section>');
}

/* ---------- PAGE: settings ---------- */
function pageSettings(){
  var s=db.settings,swatches=Object.keys(PALETTES).map(function(k){
    var p=PALETTES[k],dk=isDark(),c=p[dk?'dark':'light'];
    return '<button type="button" class="swatch" data-a="setPalette" data-v="'+k+'" aria-pressed="'+(s.palette===k)+'"><span class="dots"><i style="background:'+c.hero+'"></i><i style="background:'+c.accent+'"></i><i style="background:'+c['accent-soft']+'"></i></span><span>'+esc(T(p.name))+(k==='teal'?' ('+esc(T('current'))+')':'')+'</span></button>';
  }).join('');
  var last=s.backupAt?T('Last backup: {n}',{n:fmtDate(s.backupAt)}):T('No backup yet.');
  var json=JSON.stringify(db);
  return pagehead(T('Settings'))+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Shop'))+'</h3><label class="field" for="shopn">'+esc(T('Shop name'))+'<input id="shopn" data-set="shop" value="'+esc(db.shop)+'" autocomplete="off" placeholder="'+esc(T('Your shop'))+'"></label></section>'+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Language'))+'</h3>'+segHtml([{v:'en',t:'English'},{v:'am',t:'አማርኛ'},{v:'om',t:'Afaan Oromoo'}],s.lang,'setLang')+'<small>'+esc(T('Translations are a first draft. Tell us which words to change.'))+'</small></section>'+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Appearance'))+'</h3>'+
  '<div class="field">'+esc(T('Mode'))+'</div>'+segHtml([{v:'auto',t:T('Automatic')},{v:'light',t:T('Light')},{v:'dark',t:T('Dark')}],s.mode,'setMode')+
  '<div class="field">'+esc(T('Color theme'))+'</div><div class="swatches">'+swatches+'</div>'+
  '<div class="field">'+esc(T('Text size'))+'</div>'+segHtml([{v:'normal',t:T('Normal')},{v:'large',t:T('Large')}],s.textSize,'setSize')+'</section>'+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Stock and reports'))+'</h3>'+
  '<label class="field" for="sl">'+esc(T('Count an item as slow-moving after (days)'))+'<input id="sl" data-set="slowDays" inputmode="numeric" value="'+s.slowDays+'" autocomplete="off"></label>'+
  '<div class="field">'+esc(T('Week starts on'))+'</div>'+segHtml([{v:'1',t:T('Monday')},{v:'0',t:T('Sunday')},{v:'6',t:T('Saturday')}],String(s.weekStart),'setWeek')+'</section>'+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Backup'))+'</h3><p class="sub">'+esc(T('Your data is saved only in this browser on this phone. Make a backup often and keep it somewhere safe, for example in Telegram Saved Messages.'))+'</p><small>'+esc(last)+'</small>'+
  '<button class="btn wide" data-a="downloadBackup">'+ic(I.download,18)+esc(T('Download backup file'))+'</button>'+
  '<button class="btn wide" data-a="copyBackup">'+esc(T('Copy backup text'))+'</button>'+
  '<label class="field" for="bk_out" hidden><span>'+esc(T('Backup text'))+'</span><textarea id="bk_out" readonly>'+esc(json)+'</textarea></label>'+
  fArea('bk_in',T('Restore: paste backup text here'),{ph:T('Paste here')})+errBox()+
  '<button class="btn wide" data-a="restore">'+esc(T('Restore from backup text'))+'</button><input type="file" id="bk_file" accept=".json,application/json,text/plain" hidden>'+
  '<button class="btn wide" data-a="pickBackupFile">'+esc(T('Restore from backup file'))+'</button></section>'+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Export to Excel'))+'</h3><p class="sub">'+esc(T('Files open in Excel or Google Sheets.'))+'</p>'+
  '<div class="grid2"><button class="btn sm" data-a="exportAll" data-v="sales">'+esc(T('All sales'))+'</button><button class="btn sm" data-a="exportAll" data-v="stock">'+esc(T('Stock'))+'</button><button class="btn sm" data-a="exportAll" data-v="expenses">'+esc(T('Expenses'))+'</button><button class="btn sm" data-a="exportAll" data-v="repairs">'+esc(T('Repairs'))+'</button></div></section>'+
  (db.demo?'<section class="card form"><h3 style="margin:0">'+esc(T('Example data'))+'</h3><button class="btn wide" data-a="clearDemo">'+esc(T('Remove example data'))+'</button></section>':'')+
  '<section class="card form"><h3 style="margin:0">'+esc(T('Danger zone'))+'</h3><button class="btn danger wide'+(state.armed==='reset'?' armed':'')+'" data-a="resetAll">'+esc(state.armed==='reset'?T('Tap again to erase everything'):T('Erase everything and start empty'))+'</button></section>';
}
