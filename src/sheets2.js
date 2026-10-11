'use strict';
/* Shop Stock sheets (part 2): sales, undo, picking items for a sale, expenses, repairs, quick actions, confirm dialogs. */

/* ---------- sale details ---------- */
SHEETS.sale=function(s){
  var x=find(db.sales,s.id);if(!x)return null;
  var paidLater=sum(x.payments,function(p){return p.amount;}),paid=(x.cash||0)+paidLater;
  var body=(s.done?'<div class="okbox">'+ic(I.check,20,2.4)+'<span>'+esc(s.done)+'</span></div>':'')+tagsHtml(saleTags(x));
  body+='<div>'+kv(T('When'),esc(dfmt(x.ts,{weekday:'short',month:'short',day:'numeric',year:'numeric'})+', '+tfmt(x.ts)))+kv(T('Paid by'),esc(T(x.method)))+(x.customer?kv(T('Customer'),esc(x.customer)+(x.phone?' ('+esc(x.phone)+')':'')):'')+'</div>';
  if(x.legacy&&!x.lines.length)body+='<div class="warnbox">'+esc(T('This is an older sale. It cannot be reversed automatically.'))+'</div>';
  body+='<section class="card flush" style="padding-inline:12px">'+x.lines.map(function(l){
    var sub=l.serial?'<small class="mono">'+esc(l.serial)+'</small>':'';
    return '<div class="kv" style="align-items:flex-start"><span style="color:var(--ink)"><b>'+esc(l.kind==='part'?T(l.name):l.name)+'</b>'+(l.kind==='used'?' <small>('+esc(T('used'))+')</small>':'')+'<br>'+sub+'</span><span class="num" style="text-align:right">'+(l.kind==='repair'?fmt(l.price):l.qty+' x '+fmt(l.price))+'</span></div>';
  }).join('')+'</section>';
  if(x.trade)body+='<div class="warnbox" style="background:var(--accent-soft);color:var(--accent)">'+esc(T('Trade-in: {n}',{n:x.trade.name||''}))+' - '+fmt(x.trade.value)+' '+esc(T('Birr'))+'</div>';
  body+='<div class="sum">'+(x.discount>0?'<div class="l"><span>'+esc(T('Subtotal'))+'</span><span class="num">'+fmt(x.subtotal)+'</span></div><div class="l"><span>'+esc(T('Discount'))+(x.discountReason?' ('+esc(T(x.discountReason))+')':'')+'</span><span class="num">- '+fmt(x.discount)+'</span></div>':'')+
    '<div class="total"><span style="font-weight:700">'+esc(T('Total'))+'</span><b class="num">'+fmt(x.price)+' <small style="font-size:14px;font-weight:600">'+esc(T('Birr'))+'</small></b></div>'+
    '<div class="l"><span>'+esc(T('Paid at the time of sale'))+'</span><span class="num">'+fmt(x.cash)+'</span></div>'+
    x.payments.map(function(p){return '<div class="l"><span>'+esc(T('Payment on {d}',{d:fmtDate(p.ts)}))+' ('+esc(T(p.method))+')</span><span class="num">'+fmt(p.amount)+'</span></div>';}).join('')+
    (x.balance>0&&!x.voided?'<div class="l"><span>'+esc(T('Still owed'))+'</span><span class="num" style="color:var(--warn);font-weight:700">'+fmt(x.balance)+'</span></div>':'')+
    '<div class="l"><span>'+esc(T('Profit'))+'</span><span class="num">'+fmt(x.profit)+'</span></div></div>';
  if(x.voided)body+='<div class="err">'+esc(T('This sale was reversed on {d}.',{d:fmtDate(x.voidedAt||x.ts)}))+(x.voidReason?' '+esc(T('Reason: {r}',{r:T(x.voidReason)})):'')+'</div>';
  body+='<div class="form">';
  if(!x.voided){
    if(x.balance>0)body+=btn('payOpen',T('Receive a payment'),'primary',{id:x.id,icon:I.wallet});
    body+=btn('shareReceipt',T('Share receipt'),'',{id:x.id,icon:I.share});
    if(x.lines.length)body+=btn('undoSaleOpen',T('Undo this sale'),'danger',{id:x.id,icon:I.undo});
  }else body+=btn('shareReceipt',T('Share receipt'),'',{id:x.id,icon:I.share});
  body+='</div>';
  return {title:saleTitle(x),body:body};
};
SHEETS.payment=function(s){
  var x=find(db.sales,s.id);if(!x||x.balance<=0)return null;
  return {title:T('Receive a payment'),body:'<div class="form"><p class="sub">'+esc(saleTitle(x))+' - '+esc(T('Still owed'))+': <b class="num">'+fmt(x.balance)+'</b></p>'+
    fInput('f_amt',T('Amount received (Birr)'),{im:'numeric',def:String(x.balance)})+methSeg()+errBox()+btn('paySave',T('Save payment'),'primary',{id:x.id})+'</div>'};
};

/* ---------- undo a sale / undo a take-apart (with preview) ---------- */
SHEETS.undoSale=function(s){
  var x=find(db.sales,s.id);if(!x||x.voided)return null;
  var pv=previewUndoSale(s.id);
  return {title:T('Undo this sale'),body:'<div class="form"><p class="sub">'+esc(saleTitle(x))+' - '+fmt(x.price)+' '+esc(T('Birr'))+'</p>'+
    '<small style="font-weight:700;color:var(--ink)">'+esc(T('If you continue, the app will:'))+'</small>'+okSteps(pv.steps)+
    fSelect('f_reason',T('Reason'),[{v:'',t:T('Choose a reason')}].concat(optsFrom(REASONS_UNDO)),{})+errBox()+
    btn('undoSaleGo',T('Yes, undo this sale'),'danger',{id:x.id})+btn('sale',T('Cancel'),'',{id:x.id})+'</div>'};
};
SHEETS.undoApart=function(s){
  var d=find(db.used,s.id);if(!d||d.status!=='parts')return null;
  var pv=previewUndoApart(s.id);
  return {title:T('Undo take apart'),body:'<div class="form"><p class="sub">'+esc(d.name)+'</p><small style="font-weight:700;color:var(--ink)">'+esc(T('If you continue, the app will:'))+'</small>'+okSteps(pv.steps)+errBox()+
    btn('undoApartGo',T('Yes, undo'),'danger',{id:d.id})+btn('used',T('Cancel'),'',{id:d.id})+'</div>'};
};

/* ---------- add to a sale ---------- */
function inCartUsed(id){return state.cart.lines.some(function(l){return l.kind==='used'&&l.refId===id;});}
function cartTaken(skipIdx){var t={};state.cart.lines.forEach(function(l,i){if(i!==skipIdx&&l.serial)t[l.serial]=1;});return t;}
function pickList(){
  var q=String(F('f_pq','')).trim().toLowerCase(),tab=state.pickTab,rows='';
  if(tab==='new'){
    db.items.filter(function(i){return stock(i)>0&&i.decision!=='parts'&&(!q||(i.name+' '+i.serials.join(' ')).toLowerCase().indexOf(q)>=0);}).forEach(function(i){
      rows+='<button type="button" class="row" data-a="pickItem" data-k="new" data-id="'+i.id+'"><span class="grow"><b>'+esc(i.name)+'</b><small>'+stock(i)+' '+esc(T('in stock'))+'</small></span><span class="end">'+priceText(i.price,i.decision)+'</span></button>';
    });
  }else if(tab==='used'){
    db.used.filter(function(u){return u.status==='stock'&&!inCartUsed(u.id)&&(!q||(u.name+' '+(u.imei||'')).toLowerCase().indexOf(q)>=0);}).forEach(function(u){
      rows+='<button type="button" class="row" data-a="pickItem" data-k="used" data-id="'+u.id+'"><span class="grade g'+u.grade+'">'+u.grade+'</span><span class="grow"><b>'+esc(u.name)+'</b><small>'+esc(u.imei||T('No IMEI or serial'))+'</small></span><span class="end">'+priceText(u.ask,u.decision)+'</span></button>';
    });
  }else{
    db.parts.filter(function(p){return p.qty>0&&(!q||(p.name+' '+T(p.name)+' '+(p.from||'')).toLowerCase().indexOf(q)>=0);}).forEach(function(p){
      rows+='<button type="button" class="row" data-a="pickItem" data-k="part" data-id="'+p.id+'"><span class="grow"><b>'+esc(T(p.name))+'</b><small>'+esc(T(DEV_CAT_LABEL[p.cat]))+', '+p.qty+' '+esc(T('in stock'))+'</small></span><span class="end">'+priceText(p.price,p.decision==='parts'?'undecided':p.decision)+'</span></button>';
    });
  }
  return rows||emptyMsg(T('Nothing found.'));
}
SHEETS.pick=function(){
  return {title:T('Add item'),body:'<div class="form">'+segHtml([{v:'new',t:T('New')},{v:'used',t:T('Used')},{v:'part',t:T('Parts')}],state.pickTab,'pickTab')+
    searchBox('f_pq',T('Search name or IMEI'),F('f_pq',''),'pickList')+'<section class="card flush" id="pickList" style="max-height:48vh;overflow-y:auto">'+pickList()+'</section></div>'};
};
SHEETS.units=function(s){
  var it=find(db.items,s.id);if(!it)return null;
  var multi=s.idx==null,taken=cartTaken(s.idx),cur=!multi&&state.cart.lines[s.idx]?[state.cart.lines[s.idx].serial]:[];
  return {title:it.name,body:'<div class="form"><p class="sub">'+esc(multi?T('Choose the exact units the customer is buying. You can choose more than one.'):T('Choose the exact unit the customer is buying.'))+'</p>'+
    unitListHtml(it,cur,multi,taken,'ufilter')+errBox()+btn('unitsGo',multi?T('Add to sale'):T('Use this unit'),'primary')+'</div>'};
};
function addToCart(kind,id,serial){
  var c=state.cart,ex=null;
  if(kind==='new'){
    var it=find(db.items,id);if(!it)return;
    if(it.track==='serial'){c.lines.push({kind:'new',refId:id,name:it.name,serial:serial||'',qty:1,price:it.price?String(it.price):''});return;}
    c.lines.forEach(function(l){if(l.kind==='new'&&l.refId===id)ex=l;});
    if(ex)ex.qty=Math.min(ex.qty+1,it.qty);else c.lines.push({kind:'new',refId:id,name:it.name,serial:'',qty:1,price:it.price?String(it.price):''});
  }else if(kind==='used'){
    var u=find(db.used,id);if(!u||inCartUsed(id))return;
    c.lines.push({kind:'used',refId:id,name:u.name,serial:u.imei||'',qty:1,price:u.ask?String(u.ask):''});
  }else{
    var p=find(db.parts,id);if(!p)return;
    c.lines.forEach(function(l){if(l.kind==='part'&&l.refId===id)ex=l;});
    if(ex)ex.qty=Math.min(ex.qty+1,p.qty);else c.lines.push({kind:'part',refId:id,name:p.name,serial:'',qty:1,price:p.price?String(p.price):''});
  }
}

/* ---------- quick actions (+ button) ---------- */
SHEETS.quick=function(){
  var q=function(a,icon,t,v){return '<button type="button" data-a="'+a+'"'+(v?' data-v="'+v+'"':'')+'><span class="ci">'+ic(icon,24)+'</span>'+esc(t)+'</button>';};
  return {title:T('What do you want to do?'),body:'<div class="qa">'+q('openSale',I.receipt,T('New sale'))+q('page',I.swap,T('Trade-in'),'trade')+q('repairNew',I.wrench,T('New repair'))+q('expenseNew',I.wallet,T('Add expense'))+q('itemNew',I.box,T('Add item'))+q('usedNew',I.phone,T('Add used device'))+q('partNew',I.chip,T('Add part'))+q('page',I.users,T('Customers who owe'),'debts')+'</div>'};
};

/* ---------- expenses ---------- */
SHEETS.expense=function(s){
  var e=find(db.expenses,s.id);if(!e)return null;
  var body='<div>'+kv(T('Amount'),'<b class="num">'+fmt(e.amount)+' '+esc(T('Birr'))+'</b>')+kv(T('Type'),esc(T(e.cat)))+kv(T('Paid by'),esc(T(e.method)))+kv(T('When'),esc(dfmt(e.ts,{weekday:'short',month:'short',day:'numeric',year:'numeric'})+', '+tfmt(e.ts)))+(e.note?kv(T('Note'),esc(e.note)):'')+'</div>';
  if(e.ref)body+='<p class="sub">'+esc(T('This was added automatically when you added stock. Edit the stock record to change the price you paid.'))+'</p>';
  body+='<div class="form">'+btn2(btn('expenseEdit',T('Edit'),'',{id:e.id}),btn('expenseDel',T('Delete'),'danger',{id:e.id}))+'</div>';
  return {title:e.note||T(e.cat),body:body};
};
function openExpenseForm(id){
  var e=id?find(db.expenses,id):null,d=e?e.ts:(state.expDate?fromYmd(state.expDate)+43200000:Date.now());
  if(!e&&startOfDay(d)===startOfDay(Date.now()))d=Date.now();
  openSheet({t:'expenseForm',id:id||null},{f_amt:e?String(e.amount):'',f_cat:e?e.cat:'Transport',f_note:e?e.note||'':'',f_m:e?e.method:'Cash',f_date:ymd(d)});
}
SHEETS.expenseForm=function(s){
  var e=s.id?find(db.expenses,s.id):null;if(s.id&&!e)return null;
  return {title:e?T('Edit expense'):T('Add expense'),body:'<div class="form">'+fInput('f_amt',T('Amount (Birr)'),{im:'numeric'})+fSelect('f_cat',T('Type'),optsFrom(EXP_CATS),{})+fInput('f_note',T('Note (optional)'),{ph:T('For example Taxi to the supplier')})+methSeg()+fInput('f_date',T('Date'),{type:'date',max:ymd(Date.now())})+errBox()+btn('expenseSave',T('Save'),'primary')+'</div>'};
};

/* ---------- repairs ---------- */
SHEETS.repair=function(s){
  var r=find(db.repairs,s.id);if(!r)return null;
  var done=r.status==='delivered',k=r.status==='ready'?'good':done?'gray':r.status==='waiting'?'warn':'info';
  var body=tagsHtml([{t:T(cap(r.status)),k:k}])+'<div>'+kv(T('Customer'),esc(r.customer||T('No name'))+(r.phone?' ('+esc(r.phone)+')':''))+kv(T('Device'),esc(r.device)+(r.imei?' <span class="mono">'+esc(r.imei)+'</span>':''))+kv(T('Problem'),esc(r.problem||'-'))+kv(T('Received'),esc(ageLabel(r.ts)))+
    (done?kv(T('Fee'),'<b class="num">'+fmt(r.fee)+'</b>')+kv(T('Delivered'),esc(fmtDate(r.deliveredAt))):kv(T('Estimate'),'<b class="num">'+fmt(r.estimate)+'</b>'))+(r.notes?kv(T('Notes'),esc(r.notes)):'')+'</div>';
  if(!done)body+='<div class="field">'+esc(T('Status'))+'</div>'+chipsRow(['received','diagnosing','waiting','ready'].map(function(x){return {v:x+'|'+r.id,t:T(cap(x))};}).map(function(o){return {v:o.v,t:o.t};}),r.status+'|'+r.id,'repairStatus');
  body+='<div class="field">'+esc(T('Parts used'))+'</div><section class="card flush" style="padding-inline:12px">'+(r.parts.length?r.parts.map(function(p,i){return '<div class="kv" style="align-items:center"><span style="color:var(--ink)"><b>'+esc(T(p.name))+'</b>'+(p.qty>1?' x'+p.qty:'')+'<br><small>'+esc(T('cost'))+' '+fmt(p.cost*p.qty)+'</small></span>'+(done?'':'<button type="button" class="btn sm" data-a="repairPartRm" data-id="'+r.id+'" data-v="'+i+'">'+esc(T('Remove'))+'</button>')+'</div>';}).join(''):'<p class="empty" style="padding-block:10px">'+esc(T('No parts used yet.'))+'</p>')+'</section>';
  if(done&&r.saleId)body+=kv(T('Parts cost'),'<span class="num">'+fmt(repairPartsCost(r)+(r.otherCost||0))+'</span>');
  body+='<div class="form">';
  if(!done)body+=btn('useInRepairFor',T('Use a spare part'),'',{id:r.id,icon:I.chip})+btn('deliverOpen',T('Hand over and take payment'),'primary',{id:r.id,icon:I.check})+btn2(btn('repairEdit',T('Edit'),'',{id:r.id}),btn('repairDel',T('Delete'),'danger',{id:r.id}));
  else if(r.saleId&&find(db.sales,r.saleId))body+=btn('sale',T('View the sale'),'primary',{id:r.saleId});
  body+='</div>';
  return {title:r.device,body:body};
};
function openRepairForm(id){
  var r=id?find(db.repairs,id):null;
  openSheet({t:'repairForm',id:id||null},{f_cu:r?r.customer||'':'',f_ph:r?r.phone||'':'',f_dv:r?r.device:'',f_im:r?r.imei||'':'',f_pr:r?r.problem||'':'',f_es:r&&r.estimate?String(r.estimate):'',f_nt:r?r.notes||'':''});
}
SHEETS.repairForm=function(s){
  var r=s.id?find(db.repairs,s.id):null;if(s.id&&!r)return null;
  return {title:r?T('Edit repair'):T('New repair'),body:'<div class="form">'+customersList()+'<div class="grid2">'+fInput('f_cu',T('Customer name'),{list:'custlist'})+fInput('f_ph',T('Phone'),{type:'tel',im:'tel'})+'</div>'+fInput('f_dv',T('Device'),{ph:T('For example Samsung A12')})+fInput('f_im',T('IMEI or serial number (optional)'),{})+fInput('f_pr',T('Problem'),{ph:T('For example Cracked screen')})+fInput('f_es',T('Estimated price (Birr)'),{im:'numeric'})+fArea('f_nt',T('Notes'),{})+errBox()+btn('repairSave',T('Save'),'primary')+'</div>'};
};
SHEETS.deliver=function(s){
  var r=find(db.repairs,s.id);if(!r||r.status==='delivered')return null;
  var fee=num(F('f_fee',r.estimate)),oc=num(F('f_oc','')),pc=repairPartsCost(r),cost=pc+oc;
  return {title:T('Hand over and take payment'),body:'<div class="form"><p class="sub">'+esc(r.device)+' - '+esc(r.customer||T('No name'))+'</p>'+
    fInput('f_fee',T('Final price (Birr)'),{im:'numeric',def:String(r.estimate||''),live:'deliver'})+
    '<div class="grid2">'+fInput('f_oc',T('Other costs (Birr)'),{im:'numeric',live:'deliver'})+fInput('f_paid',T('Paid now'),{im:'numeric',ph:T('Full amount'),live:'deliver'})+'</div>'+methSeg()+
    '<div class="sum" id="deliverSum">'+deliverSum(r)+'</div>'+errBox()+btn('deliverGo',T('Confirm and record'),'primary',{id:r.id})+'</div>'};
};
function deliverSum(r){
  var fee=num(F('f_fee',r.estimate)),oc=num(F('f_oc','')),pc=repairPartsCost(r),raw=String(F('f_paid','')).trim(),paid=raw===''?fee:Math.min(num(raw),fee);
  return '<div class="l"><span>'+esc(T('Parts cost'))+'</span><span class="num">'+fmt(pc)+'</span></div><div class="l"><span>'+esc(T('Profit'))+'</span><span class="num">'+fmt(fee-pc-oc)+'</span></div>'+(fee>paid?'<div class="l"><span>'+esc(T('Still owed'))+'</span><span class="num" style="color:var(--warn);font-weight:700">'+fmt(fee-paid)+'</span></div>':'');
}

/* ---------- confirm dialog ---------- */
function renderConf(){
  var root=$('#confRoot'),c=state.conf;
  if(!c){root.innerHTML='';return;}
  root.innerHTML='<div class="scrim center" data-scrim="conf"><div class="panel" role="alertdialog" aria-modal="true" aria-label="'+esc(c.title)+'" tabindex="-1"><h2>'+esc(c.title)+'</h2>'+(c.msg?'<p class="sub" style="font-size:14px">'+esc(c.msg)+'</p>':'')+(c.html||'')+
    '<div class="btns"><button type="button" class="btn" data-a="confNo">'+esc(T('Cancel'))+'</button><button type="button" class="btn '+(c.danger?'dangerfill':'primary')+'" data-a="confYes">'+esc(c.ok||T('Yes'))+'</button></div></div></div>';
}
function ask(o){state.conf=o;render();}
