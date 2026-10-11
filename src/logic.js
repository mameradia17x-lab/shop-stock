'use strict';
/* Shop Stock logic: stock numbers, sales, trade-ins, taking devices apart, undo, repairs, expenses, alerts, receipts, CSV. */

/* ---------- stock numbers ---------- */
var stock=function(i){return i.track==='serial'?i.serials.length:i.qty;};
var isLow=function(i){return i.decision!=='parts'&&stock(i)<=i.reorder;};
var slowDays=function(){return db.settings.slowDays||30;};
function lastSaleTs(itemId){var m=0;db.sales.forEach(function(s){if(s.voided)return;s.lines.forEach(function(l){if(l.kind==='new'&&l.refId===itemId&&s.ts>m)m=s.ts;});});return m;}
function idleSince(i){return Math.max(i.ts||0,lastSaleTs(i.id));}
function slowUsed(){return db.used.filter(function(u){return u.status==='stock'&&daysSince(u.ts)>=slowDays();}).sort(function(a,b){return a.ts-b.ts;});}
function slowNew(){return db.items.filter(function(i){return stock(i)>0&&i.decision!=='parts'&&daysSince(idleSince(i))>=slowDays();}).sort(function(a,b){return idleSince(a)-idleSince(b);});}
function slowParts(){return db.parts.filter(function(p){return p.qty>0&&daysSince(p.ts)>=slowDays();}).sort(function(a,b){return a.ts-b.ts;});}
var undecidedNew=function(){return db.items.filter(function(i){return i.decision==='undecided';});};
var undecidedUsed=function(){return db.used.filter(function(u){return u.status==='stock'&&u.decision==='undecided';});};
var undecidedParts=function(){return db.parts.filter(function(p){return p.qty>0&&p.decision==='undecided';});};
var usedInStock=function(){return db.used.filter(function(u){return u.status==='stock';});};
var partsInStock=function(){return db.parts.filter(function(p){return p.qty>0;});};
var partUnits=function(list){return sum(list,function(p){return p.qty;});};

/* ---------- sales: titles, tags, totals ---------- */
function lineLabel(l){
  var n=l.name;
  if(l.kind==='used')n+=' ('+T('used')+')';
  else if(l.kind==='part')n=T(l.name)+' ('+T('part')+')';
  if(l.qty>1)n+=' x'+l.qty;
  return n;
}
function saleTitle(s){
  if(s.legacy)return s.title||'';
  if(s.lines.length&&s.lines[0].kind==='repair')return T('Repair: {d}',{d:s.lines[0].name});
  if(s.trade&&s.lines.length)return T('{a} for {b}',{a:s.lines[0].name,b:s.trade.name||''});
  var ls=s.lines.map(lineLabel);
  if(ls.length<=2)return ls.join(' + ');
  return ls[0]+' '+T('+{n} more',{n:ls.length-1});
}
function saleTags(s){
  var t=[];
  if(s.voided)t.push({t:T('Reversed'),k:'bad'});
  if(s.trade)t.push({t:T('Trade-in'),k:'info'});
  else if(s.lines.length===1&&s.lines[0].kind==='repair')t.push({t:T('Repair'),k:'info'});
  else if(s.lines.length&&s.lines.every(function(l){return l.kind==='used';}))t.push({t:T('Used'),k:'gray'});
  else if(s.lines.length&&s.lines.every(function(l){return l.kind==='part';}))t.push({t:T('Part'),k:'gray'});
  if(s.discount>0)t.push({t:T('Discount'),k:'warn'});
  if(!s.voided&&s.balance>0)t.push({t:T('Owes {n}',{n:fmt(s.balance)}),k:'warn'});
  if(!s.voided&&saleBelowCost(s))t.push({t:T('Below cost'),k:'bad'});
  return t;
}
function saleBelowCost(s){return !s.trade&&s.lines.some(function(l){return l.kind!=='repair'&&l.cost>0&&l.price<l.cost;});}
function saleMatches(s,q){
  q=q.trim().toLowerCase();if(!q)return true;
  var hay=[saleTitle(s),s.customer,s.phone,s.method,s.kind,s.discountReason,fmt(s.price)].concat(s.lines.map(function(l){return l.name+' '+(l.serial||'');})).join(' ').toLowerCase();
  return q.split(/\s+/).every(function(w){return hay.indexOf(w)>=0;});
}
function salesBetween(a,b,withVoid){return db.sales.filter(function(s){return s.ts>=a&&s.ts<b&&(withVoid||!s.voided);}).sort(function(x,y){return y.ts-x.ts;});}
function cashInBetween(a,b){
  var c=0;
  db.sales.forEach(function(s){if(s.voided)return;if(s.ts>=a&&s.ts<b)c+=s.cash||0;(s.payments||[]).forEach(function(p){if(p.ts>=a&&p.ts<b)c+=p.amount;});});
  return c;
}
function totalsFor(list,a,b){return {value:sum(list,function(s){return s.price;}),profit:sum(list,function(s){return s.profit;}),count:list.length,cash:cashInBetween(a,b),owed:sum(list,function(s){return s.balance;})};}
function periodRange(p){
  var t=startOfDay(Date.now());
  if(p==='today')return [t,addDays(t,1)];
  if(p==='yesterday')return [addDays(t,-1),t];
  if(p==='week'){var w=weekStart(Date.now());return [w,addDays(w,7)];}
  if(p==='date'){var d=fromYmd(state.salesDate)||t;return [d,addDays(d,1)];}
  var f=fromYmd(state.salesFrom)||t,e=fromYmd(state.salesTo)||f;if(e<f){var x=f;f=e;e=x;}
  return [f,addDays(e,1)];
}
function periodLabel(p){
  var r=periodRange(p);
  if(p==='today')return T('Today');if(p==='yesterday')return T('Yesterday');
  if(p==='week')return T('This week');
  if(p==='date')return fmtDate(r[0]);
  return fmtDate(r[0])+' - '+fmtDate(r[1]-DAY);
}
function expensesBetween(a,b){return db.expenses.filter(function(e){return e.ts>=a&&e.ts<b;}).sort(function(x,y){return y.ts-x.ts;});}
function debtList(){return db.sales.filter(function(s){return !s.voided&&s.balance>0;}).sort(function(a,b){return a.ts-b.ts;});}

/* ---------- selling: the cart ---------- */
function cartTotals(c){
  var sub=sum(c.lines,function(l){return num(l.price)*l.qty;});
  var disc=Math.min(num(c.discount),sub),total=sub-disc,raw=String(c.paid==null?'':c.paid).trim();
  var paid=raw===''?total:Math.max(0,Math.min(parseFloat(raw.replace(/,/g,''))||0,total));
  return {sub:sub,disc:disc,total:total,paid:paid,balance:total-paid};
}
function lineRef(l){
  if(l.kind==='new')return find(db.items,l.refId);
  if(l.kind==='used')return find(db.used,l.refId);
  return find(db.parts,l.refId);
}
function cartError(c){
  if(!c.lines.length)return T('Add at least one item to the sale.');
  var tot=cartTotals(c),taken={};
  for(var i=0;i<c.lines.length;i++){
    var l=c.lines[i],r=lineRef(l),nm=l.name;
    if(!r)return T('{n} is no longer in stock.',{n:nm});
    if(l.kind==='new'){
      if(r.track==='serial'){
        if(!l.serial)return T('Choose the IMEI or serial number for {n}.',{n:nm});
        if(r.serials.indexOf(l.serial)<0)return T('{n} is no longer in stock.',{n:nm+' ('+l.serial+')'});
        if(taken[l.serial])return T('The same unit is in the sale twice: {n}.',{n:l.serial});
        taken[l.serial]=1;
      }else if(l.qty>r.qty)return T('Only {n} left in stock for {i}.',{n:r.qty,i:nm});
    }else if(l.kind==='used'){if(r.status!=='stock')return T('{n} is no longer in stock.',{n:nm});}
    else if(l.kind==='part'){if(l.qty>r.qty)return T('Only {n} left in stock for {i}.',{n:r.qty,i:nm});}
    if(num(l.price)<=0)return T('Enter a price for {n}.',{n:nm});
  }
  if(tot.disc>0&&!c.reason)return T('Choose a reason for the discount.');
  if(tot.balance>0&&!String(c.customer||'').trim())return T('Add the customer name when part of the payment is still owed.');
  return '';
}
function snapItem(i){return {name:i.name,cat:i.cat,track:i.track,price:i.price,cost:i.cost,reorder:i.reorder,decision:i.decision};}
function recordSale(){
  var c=state.cart,err=cartError(c);if(err)return {err:err};
  var now=Date.now(),id=uid(),tot=cartTotals(c),lines=[];
  c.lines.forEach(function(l){
    var line={kind:l.kind,refId:l.refId,name:l.name,serial:l.serial||'',qty:l.qty,price:num(l.price),cost:0},r=lineRef(l);
    if(l.kind==='new'){
      line.cost=r.cost;line.snap=snapItem(r);
      if(r.track==='serial')r.serials.splice(r.serials.indexOf(l.serial),1);else r.qty-=l.qty;
    }else if(l.kind==='used'){
      line.cost=r.buy;line.serial=r.imei||'';line.snap=clone(r);
      r.status='sold';r.soldPrice=line.price;r.soldAt=now;r.saleId=id;
    }else{
      line.cost=r.cost;line.snap=clone(r);r.qty-=l.qty;
    }
    lines.push(line);
  });
  var cost=sum(lines,function(l){return l.cost*l.qty;});
  var sale={id:id,ts:now,kind:lines.length===1?lines[0].kind:'sale',lines:lines,subtotal:tot.sub,discount:tot.disc,discountReason:tot.disc>0?c.reason:'',price:tot.total,cash:tot.paid,balance:tot.balance,payments:[],profit:tot.total-cost,method:c.method,customer:String(c.customer||'').trim(),phone:String(c.phone||'').trim(),voided:false};
  db.sales.push(sale);
  log('sale','Sale recorded: {t} for {p} Birr',{t:saleTitle(sale),p:fmt(sale.price)},now);
  if(tot.disc>0)log('sale','Discount of {d} Birr given on {t} ({r})',{d:fmt(tot.disc),t:saleTitle(sale),r:c.reason},now);
  if(tot.balance>0)log('money','{c} owes {n} Birr for {t}',{c:sale.customer,n:fmt(tot.balance),t:saleTitle(sale)},now);
  state.cart=freshCart();save();
  return {sale:sale};
}
function addPayment(s,amount,method){
  amount=Math.min(amount,s.balance);if(amount<=0)return false;
  s.payments.push({id:uid(),ts:Date.now(),amount:amount,method:method});s.balance-=amount;
  log('money','Payment of {n} Birr received from {c} for {t}',{n:fmt(amount),c:s.customer||T('a customer'),t:saleTitle(s)});save();return true;
}

/* ---------- trade-ins ---------- */
function tradeCalc(){
  var t=state.trade,it=find(db.items,t.itemId),price=num(t.price),value=num(t.value),miss=[];
  if(!t.name.trim())miss.push(T("the customer's device"));
  if(!it)miss.push(T('the new device'));
  else if(it.track==='serial'&&!t.serial)miss.push(T('which unit they take'));
  if(!value)miss.push(T('the trade-in value'));
  if(!price&&it)miss.push(T('the selling price'));
  return {it:it,price:price,value:value,diff:price-value,miss:miss};
}
function recordTrade(){
  var c=tradeCalc(),t=state.trade;if(c.miss.length)return {err:T('Still needed: {n}.',{n:c.miss.join(', ')})};
  var it=c.it,now=Date.now();
  if(it.track==='serial'){var ix=it.serials.indexOf(t.serial);if(ix<0)return {err:T('That unit is no longer in stock.')};}
  else if(it.qty<1)return {err:T('{n} is no longer in stock.',{n:it.name})};
  var imei=t.imei.trim();
  if(imei&&serialInUse(imei))return {err:T('That IMEI or serial number is already in your stock: {n}',{n:imei})};
  var sid=uid(),did=uid(),ask=num(t.ask);
  var line={kind:'new',refId:it.id,name:it.name,serial:t.serial||'',qty:1,price:c.price,cost:it.cost,snap:snapItem(it)};
  if(it.track==='serial')it.serials.splice(it.serials.indexOf(t.serial),1);else it.qty-=1;
  var dev={id:did,name:t.name.trim(),cat:t.cat,imei:imei,grade:t.grade,buy:c.value,ask:ask,decision:ask>0?'priced':'undecided',notes:t.customer.trim()?T('Customer: {n}',{n:t.customer.trim()}):'',status:'stock',ts:now,source:'trade-in',tradeSaleId:sid};
  db.used.push(dev);
  var sale={id:sid,ts:now,kind:'trade',lines:[line],trade:{usedId:did,value:c.value,name:dev.name},subtotal:c.price,discount:0,price:c.price,cash:c.diff,balance:0,payments:[],profit:c.price-it.cost,method:t.method,customer:t.customer.trim(),phone:'',voided:false};
  db.sales.push(sale);
  log('trade','Trade-in: {a} came in for {b}',{a:dev.name,b:it.name},now);
  save();return {sale:sale,dev:dev};
}

/* ---------- undo (reverse a sale, undo a take-apart). All steps are collected so they can be previewed first. ---------- */
function removeUsed(d){
  db.used=db.used.filter(function(u){return u.id!==d.id;});
  db.expenses=db.expenses.filter(function(e){return !(e.ref&&e.ref.t==='used'&&e.ref.id===d.id);});
}
function syncRepairSale(r){
  if(!r.saleId)return;var s=find(db.sales,r.saleId);if(!s||!s.lines.length)return;
  var cost=sum(r.parts,function(p){return p.qty*p.cost;})+(r.otherCost||0);
  s.lines[0].cost=cost;s.profit=s.price-cost;
}
function reverseSale(s,ctx){
  if(!s||s.voided||ctx.seen[s.id])return;
  ctx.seen[s.id]=1;var S=ctx.steps;
  S.push(T('Reverse the sale: {t}',{t:saleTitle(s)}));
  if(s.trade){
    var d=find(db.used,s.trade.usedId);
    if(d){
      if(d.status==='sold'){
        var s2=null;db.sales.forEach(function(x){if(!s2&&!x.voided&&x!==s&&x.lines.some(function(l){return l.kind==='used'&&l.refId===d.id;}))s2=x;});
        if(s2)reverseSale(s2,ctx);else d.status='stock';
      }
      if(d.status==='parts')undoTakeApart(d,ctx);
      S.push(T('Remove {n} from used stock',{n:d.name}));removeUsed(d);
    }
  }
  s.lines.forEach(function(l){
    if(l.kind==='new'){
      var it=find(db.items,l.refId);
      if(!it){it=extend({id:l.refId,serials:[],qty:0,ts:Date.now()},l.snap||{name:l.name,cat:'Accessories',track:l.serial?'serial':'qty',price:l.price,cost:l.cost,reorder:5,decision:'priced'});db.items.push(it);S.push(T('Create {n} again (it had been deleted)',{n:it.name}));}
      if(it.track==='serial'){
        if(l.serial){if(serialInUse(l.serial))S.push(T('{n} is already in stock again, so it is not added twice',{n:l.serial}));else{it.serials.push(l.serial);S.push(T('Put {n} back in stock',{n:it.name+' ('+l.serial+')'}));}}
        else S.push(T('The IMEI of {n} was not saved in this older sale. Add it again with Add stock.',{n:it.name}));
      }else{it.qty+=l.qty;S.push(T('Put {n} back in stock',{n:it.name+' x'+l.qty}));}
    }else if(l.kind==='used'){
      var d2=find(db.used,l.refId);
      if(!d2&&l.snap){d2=clone(l.snap);db.used.push(d2);}
      if(d2){d2.status='stock';delete d2.soldPrice;delete d2.soldAt;delete d2.saleId;S.push(T('Put {n} back in used stock',{n:d2.name}));}
    }else if(l.kind==='part'){
      var p=find(db.parts,l.refId);
      if(!p&&l.snap){p=clone(l.snap);p.qty=0;db.parts.push(p);}
      if(p){p.qty+=l.qty;S.push(T('Put {n} back in spare parts',{n:T(p.name)+(l.qty>1?' x'+l.qty:'')}));}
    }else if(l.kind==='repair'){
      var r=find(db.repairs,l.refId);
      if(r){r.status='ready';r.saleId=null;r.deliveredAt=null;S.push(T('The repair for {c} goes back to Ready',{c:r.customer||r.device}));}
    }
  });
  if(ctx.top===s.id){
    var back=(s.cash||0)+sum(s.payments,function(p){return p.amount;});
    if(back>0)S.push(T('Give {n} Birr back to the customer',{n:fmt(back)}));
    else if(back<0)S.push(T('The customer gives back {n} Birr that you paid out',{n:fmt(-back)}));
  }
  s.voided=true;s.voidedAt=Date.now();s.voidReason=ctx.reason||'';
  log('undo','Sale reversed: {t} ({r})',{t:saleTitle(s),r:ctx.reason?T(ctx.reason):'-'});
}
function undoTakeApart(d,ctx){
  var ps=db.parts.filter(function(p){return p.fromId===d.id;});
  ps.forEach(function(p){
    db.sales.slice().forEach(function(x){if(!x.voided&&x.lines.some(function(l){return l.kind==='part'&&l.refId===p.id;}))reverseSale(x,ctx);});
    db.repairs.forEach(function(r){
      var keep=[],removed=false;
      r.parts.forEach(function(rp){if(rp.partId===p.id){removed=true;ctx.steps.push(T('Take {n} out of the repair for {c}',{n:T(p.name),c:r.customer||r.device}));}else keep.push(rp);});
      if(removed){r.parts=keep;syncRepairSale(r);}
    });
  });
  db.parts=db.parts.filter(function(p){return p.fromId!==d.id;});
  ctx.steps.push(T('Remove the {n} parts taken from {d}',{n:ps.length,d:d.name}));
  d.status='stock';delete d.partedAt;
  ctx.steps.push(T('{d} goes back to used stock',{d:d.name}));
  log('undo','Take-apart undone: {d}',{d:d.name});
}
function previewRun(fn){
  var keep=db,ctx={steps:[],seen:{},ts:Date.now(),reason:'',top:null};
  db=clone(keep);
  try{fn(ctx);}finally{db=keep;}
  return ctx;
}
function realRun(fn,reason){
  var backup=clone(db),ctx={steps:[],seen:{},ts:Date.now(),reason:reason||'',top:null};
  try{fn(ctx);save();}catch(e){db=backup;throw e;}
  return ctx;
}
var undoSaleFn=function(id){return function(ctx){ctx.top=id;reverseSale(find(db.sales,id),ctx);};};
var undoApartFn=function(id){return function(ctx){var d=find(db.used,id);if(d&&d.status==='parts')undoTakeApart(d,ctx);};};
var previewUndoSale=function(id){return previewRun(undoSaleFn(id));};
var previewUndoApart=function(id){return previewRun(undoApartFn(id));};

/* ---------- taking a device apart ---------- */
function apartCosts(){
  var a=state.apart,dev=find(db.used,a.deviceId),rows=a.rows.filter(function(r){return r.name.trim();});
  var tot=sum(rows,function(r){return num(r.share)||1;}),left=dev?dev.buy:0,out={};
  rows.forEach(function(r,idx){var c=idx===rows.length-1?left:Math.round((dev?dev.buy:0)*(num(r.share)||1)/tot);left-=c;out[r.key]=c;});
  return out;
}
function apartDefaults(cat){return (APART_DEFAULTS[cat]||APART_DEFAULTS.other).map(function(x){return {key:uid(),name:x[0],state:'untested',share:String(x[1])};});}
function takeApart(){
  var a=state.apart,dev=find(db.used,a.deviceId);
  if(!dev||dev.status!=='stock')return T('Choose a device.');
  var rows=a.rows.filter(function(r){return r.name.trim();});
  if(!rows.length)return T('List at least one part.');
  var costs=apartCosts(),now=Date.now();
  rows.forEach(function(r){db.parts.push({id:uid(),name:r.name.trim(),cat:dev.cat,state:r.state,cost:costs[r.key],price:0,decision:'undecided',qty:1,from:dev.name,fromId:dev.id,ts:now});});
  dev.status='parts';dev.partedAt=now;
  log('part','Took apart {d}: {n} parts added',{d:dev.name,n:rows.length},now);
  save();return '';
}

/* ---------- repairs ---------- */
function repairPartsCost(r){return sum(r.parts,function(p){return p.qty*p.cost;});}
function useInRepair(partId,repairId,qty){
  var p=find(db.parts,partId),r=find(db.repairs,repairId);
  if(!p||!r)return T('Choose a repair job.');
  qty=Math.floor(qty);if(qty<1)return T('Enter how many you used.');if(qty>p.qty)return T('Only {n} left in stock for {i}.',{n:p.qty,i:T(p.name)});
  p.qty-=qty;
  var ex=null;r.parts.forEach(function(x){if(x.partId===p.id)ex=x;});
  if(ex)ex.qty+=qty;else r.parts.push({partId:p.id,name:p.name,cat:p.cat,qty:qty,cost:p.cost});
  syncRepairSale(r);
  log('part','{n} used in the repair for {c}',{n:T(p.name)+(qty>1?' x'+qty:''),c:r.customer||r.device});
  save();return '';
}
function removePartFromRepair(r,idx){
  var rp=r.parts[idx];if(!rp)return;
  var p=find(db.parts,rp.partId);
  if(p)p.qty+=rp.qty;else db.parts.push({id:rp.partId,name:rp.name,cat:rp.cat||'phone',state:'untested',cost:rp.cost,price:0,decision:'undecided',qty:rp.qty,from:'',fromId:'',ts:Date.now()});
  r.parts.splice(idx,1);syncRepairSale(r);
  log('part','{n} taken out of the repair for {c}',{n:T(rp.name),c:r.customer||r.device});save();
}
function deliverRepair(r,fee,method,paid,other){
  var now=Date.now(),cost=repairPartsCost(r)+other,sid=uid();
  paid=Math.max(0,Math.min(paid,fee));
  var sale={id:sid,ts:now,kind:'repair',lines:[{kind:'repair',refId:r.id,name:r.device,qty:1,price:fee,cost:cost}],subtotal:fee,discount:0,price:fee,cash:paid,balance:fee-paid,payments:[],profit:fee-cost,method:method,customer:r.customer||'',phone:r.phone||'',voided:false};
  db.sales.push(sale);
  r.status='delivered';r.deliveredAt=now;r.fee=fee;r.method=method;r.otherCost=other;r.saleId=sid;
  log('repair','Repair delivered: {d} for {c}, {p} Birr',{d:r.device,c:r.customer||'-',p:fmt(fee)},now);
  save();return sale;
}

/* ---------- stock corrections ---------- */
function correctQty(it,newQty,reason,label){
  var old=it.qty;it.qty=newQty;
  log('fix','Stock corrected: {n} from {a} to {b} ({r})',{n:label||it.name,a:old,b:newQty,r:T(reason)});save();
}
function removeUnit(it,serial,reason){
  var ix=it.serials.indexOf(serial);if(ix<0)return;it.serials.splice(ix,1);
  log('fix','Unit removed from stock: {n} {s} ({r})',{n:it.name,s:serial,r:T(reason)});save();
}

/* ---------- notifications (calculated from the data, so they disappear when the problem is fixed) ---------- */
function computeAlerts(){
  var out=[],now=Date.now();
  db.items.forEach(function(i){
    if(!isLow(i))return;var s=stock(i);
    out.push({key:'low:'+i.id,sev:s===0?'bad':'warn',t:i.name,s:s===0?T('Out of stock'):T('{n} left, reorder at {r}',{n:s,r:i.reorder}),go:{a:'item',id:i.id}});
  });
  var su=slowUsed().length,sn=slowNew().length,sp=slowParts().length;
  if(su+sn+sp>0)out.push({key:'slow',sev:'warn',t:T('{n} items unsold for {d}+ days',{n:su+sn+sp,d:slowDays()}),s:T('{a} used, {b} new, {c} parts',{a:su,b:sn,c:sp}),go:{a:'page',v:'slow'}});
  var un=undecidedNew().length+undecidedUsed().length+undecidedParts().length;
  if(un>0)out.push({key:'undecided',sev:'info',t:T('{n} items have no price decision yet',{n:un}),s:T('Set a price, keep them undecided, or mark them as parts.'),go:{a:'undecided'}});
  var debts=debtList();
  if(debts.length){var owed=sum(debts,function(s){return s.balance;});out.push({key:'debts',sev:'warn',t:T('Customers owe you {n} Birr',{n:fmt(owed)}),s:T('{n} unpaid sales',{n:debts.length}),go:{a:'page',v:'debts'}});}
  db.repairs.forEach(function(r){
    if(r.status==='ready'&&r.readyAt&&daysSince(r.readyAt)>=3)out.push({key:'rdy:'+r.id,sev:'warn',t:T('{d} is ready for pickup',{d:r.device}),s:T('{c} has not collected it for {n} days',{c:r.customer||T('The customer'),n:daysSince(r.readyAt)}),go:{a:'repair',id:r.id}});
    else if(r.status==='waiting'&&daysSince(r.ts)>=5)out.push({key:'wait:'+r.id,sev:'info',t:T('{d} is still waiting for parts',{d:r.device}),s:T('Open for {n} days',{n:daysSince(r.ts)}),go:{a:'repair',id:r.id}});
  });
  db.sales.forEach(function(s){
    if(now-s.ts>3*DAY)return;
    if(s.voided){if(s.voidedAt&&now-s.voidedAt<=3*DAY)out.push({key:'void:'+s.id,sev:'info',t:T('A sale was reversed'),s:saleTitle(s),go:{a:'sale',id:s.id}});return;}
    if(saleBelowCost(s))out.push({key:'cost:'+s.id,sev:'warn',t:T('Sold below cost'),s:saleTitle(s)+' - '+fmt(s.price)+' Birr',go:{a:'sale',id:s.id}});
    else if(s.discount>0&&s.discount>=0.1*s.subtotal)out.push({key:'disc:'+s.id,sev:'info',t:T('Large discount given'),s:saleTitle(s)+' - '+fmt(s.discount)+' Birr ('+T(s.discountReason)+')',go:{a:'sale',id:s.id}});
  });
  var hasData=db.items.length+db.used.length+db.sales.length>0;
  if(!db.demo&&hasData&&(!db.settings.backupAt||daysSince(db.settings.backupAt)>=7))out.push({key:'backup',sev:'info',t:T('Back up your data'),s:db.settings.backupAt?T('Last backup was {n} days ago.',{n:daysSince(db.settings.backupAt)}):T('You have not made a backup yet.'),go:{a:'page',v:'settings'}});
  var order={bad:0,warn:1,info:2};
  return out.sort(function(a,b){return order[a.sev]-order[b.sev];});
}
function visibleAlerts(){var now=Date.now();return computeAlerts().filter(function(a){var d=db.alertsDismissed[a.key];return !d||now-d>DAY;});}
function unseenAlerts(){return visibleAlerts().filter(function(a){return !db.alertsSeen[a.key];});}
function markAlertsSeen(){var keys={};visibleAlerts().forEach(function(a){keys[a.key]=1;});db.alertsSeen=keys;save();}

/* ---------- receipt, CSV, files ---------- */
function receiptText(s){
  var L=[],shop=db.shop||T('Your shop');
  L.push(shop);L.push(fmtDate(s.ts)+' '+tfmt(s.ts));L.push('------------------------');
  s.lines.forEach(function(l){
    L.push(lineLabel(l).replace(/ x\d+$/,'')+(l.qty>1?' x'+l.qty:''));
    if(l.serial)L.push('  IMEI/SN: '+l.serial);
    if(l.kind!=='repair')L.push('  '+fmt(l.price)+' x '+l.qty+' = '+fmt(l.price*l.qty));else L.push('  '+fmt(l.price));
  });
  if(s.trade)L.push(T('Trade-in: {n}',{n:s.trade.name})+' -'+fmt(s.trade.value));
  L.push('------------------------');
  if(s.discount>0)L.push(T('Discount')+': -'+fmt(s.discount));
  L.push(T('Total')+': '+fmt(s.price)+' Birr');
  var paid=(s.cash||0)+sum(s.payments,function(p){return p.amount;});
  L.push(T('Paid')+': '+fmt(paid)+' Birr ('+T(s.method)+')');
  if(s.balance>0)L.push(T('Balance owed')+': '+fmt(s.balance)+' Birr');
  if(s.customer)L.push(T('Customer')+': '+s.customer);
  L.push(T('Thank you!'));
  return L.join('\n');
}
function csvCell(v){v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
function toCsv(rows){return '﻿'+rows.map(function(r){return r.map(csvCell).join(',');}).join('\r\n');}
function salesCsv(list){
  var rows=[['Date','Time','Sale','Customer','Phone','IMEI or serial','Total','Discount','Cash received','Still owed','Profit','Paid by','Reversed']];
  list.forEach(function(s){rows.push([ymd(s.ts),tfmt(s.ts),saleTitle(s),s.customer,s.phone,s.lines.map(function(l){return l.serial;}).filter(Boolean).join(' '),s.price,s.discount,s.cash,s.balance,s.profit,s.method,s.voided?'yes':'']);});
  return toCsv(rows);
}
function stockCsv(){
  var rows=[['Type','Name','Category','IMEI or serial','Quantity','Cost','Price','Condition','Decision']];
  db.items.forEach(function(i){if(i.track==='serial')i.serials.forEach(function(s){rows.push(['New',i.name,i.cat,s,1,i.cost,i.price,'',i.decision]);});else rows.push(['New',i.name,i.cat,'',i.qty,i.cost,i.price,'',i.decision]);});
  db.used.forEach(function(u){if(u.status==='stock')rows.push(['Used',u.name,DEV_CAT_LABEL[u.cat]||'',u.imei,1,u.buy,u.ask,u.grade,u.decision]);});
  db.parts.forEach(function(p){if(p.qty>0)rows.push(['Part',p.name,DEV_CAT_LABEL[p.cat]||'',p.from,p.qty,p.cost,p.price,p.state,p.decision]);});
  return toCsv(rows);
}
function expensesCsv(){
  var rows=[['Date','Category','Note','Amount','Paid by']];
  db.expenses.slice().sort(function(a,b){return a.ts-b.ts;}).forEach(function(e){rows.push([ymd(e.ts),e.cat,e.note,e.amount,e.method]);});
  return toCsv(rows);
}
function repairsCsv(){
  var rows=[['Received','Customer','Phone','Device','Problem','Status','Fee','Parts cost','Other cost','Delivered']];
  db.repairs.slice().sort(function(a,b){return a.ts-b.ts;}).forEach(function(r){rows.push([ymd(r.ts),r.customer,r.phone,r.device,r.problem,r.status,r.fee||'',repairPartsCost(r),r.otherCost||0,r.deliveredAt?ymd(r.deliveredAt):'']);});
  return toCsv(rows);
}
function downloadFile(name,text,mime){
  try{
    var blob=new Blob([text],{type:mime||'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},4000);return true;
  }catch(e){return false;}
}
