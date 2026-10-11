'use strict';
/* Shop Stock sheets (part 1): stock items, used devices, spare parts, and their forms. Each sheet returns {title, body} or null when its record is gone. */
var SHEETS={};
var DEC_LABEL={priced:'Priced',undecided:'Undecided',parts:'For parts'};
var PART_STATES=['tested','untested','faulty'];

function btn(a,label,cls,o){
  o=o||{};
  return '<button type="button" class="btn'+(cls?' '+cls:'')+' wide" data-a="'+a+'"'+(o.id?' data-id="'+esc(o.id)+'"':'')+(o.v!=null?' data-v="'+esc(o.v)+'"':'')+(o.dis?' disabled':'')+'>'+(o.icon?ic(o.icon,18,2):'')+esc(label)+'</button>';
}
function btn2(a,b){return '<div class="btns">'+a+b+'</div>';}
function decSeg(allowParts){
  var o=[{v:'priced',t:T('Set a price')},{v:'undecided',t:T('Undecided')}];
  if(allowParts)o.push({v:'parts',t:T('For parts')});
  return '<div><div class="field" style="margin-bottom:6px">'+esc(T('Price decision'))+'</div>'+segHtml(o,F('f_dec','priced'),'fDec')+'</div>';
}
function methSeg(){return '<div><div class="field" style="margin-bottom:6px">'+esc(T('Paid by'))+'</div>'+segHtml(methodOpts(),F('f_m','Cash'),'fMeth')+'</div>';}
function chkHtml(txt,isPhone,ign){
  var a=analyzeSerials(txt,isPhone,ign),out='';
  if(!a.list.length&&!a.dupInput.length)return '';
  var hard=a.dupInput.length||a.inStock.length;
  out+='<div class="'+(hard?'err':a.warn.length?'warnbox':'okbox')+'" style="font-weight:600">'+esc(T('{n} numbers entered',{n:a.list.length}))+'</div>';
  var more=function(l){return l.slice(0,3).join(', ')+(l.length>3?' ...':'');};
  if(a.dupInput.length)out+='<div class="err">'+esc(T('Repeated in your list: {n}',{n:more(a.dupInput)}))+'</div>';
  if(a.inStock.length)out+='<div class="err">'+esc(T('Already in your stock: {n}',{n:more(a.inStock)}))+'</div>';
  a.warn.slice(0,3).forEach(function(w){out+='<div class="warnbox">'+esc(w.w==='len'?T('{s} should have 15 digits but has {n}.',{s:w.s,n:w.s.length}):T('{s} does not pass the IMEI check. Please check for a typo.',{s:w.s}))+'</div>';});
  return out;
}
function applyDecision(k,r,dec,price){
  var key=k==='used'?'ask':'price',old=r[key]||0,od=r.decision,nm=k==='part'?T(r.name):r.name;
  if(dec==='priced'){r[key]=price;r.decision='priced';if(old!==price)log('price','Price changed: {n} from {a} to {b} Birr',{n:nm,a:old?fmt(old):'-',b:fmt(price)});}
  else{r[key]=0;r.decision=dec;if(od!==dec)log('decision','{n} is now marked: {d}',{n:nm,d:T(DEC_LABEL[dec])});}
}
function unitFilterBox(){return '<label class="search">'+ic(I.search,20)+'<input id="ufilter" type="search" placeholder="'+esc(T('Search IMEI or serial'))+'" aria-label="'+esc(T('Search IMEI or serial'))+'" data-live="unitFilter" autocomplete="off"></label>';}

/* ---------- new item: details ---------- */
SHEETS.item=function(s){
  var i=find(db.items,s.id);if(!i)return null;
  var n=stock(i),tags=[];
  if(i.decision==='parts')tags.push({t:T('For parts'),k:'gray'});
  else if(i.decision==='undecided'||!i.price)tags.push({t:T('Price undecided'),k:'warn'});
  if(isLow(i))tags.push({t:n===0?T('Out of stock'):T('Low stock'),k:'bad'});
  var last=lastSaleTs(i.id),body=tagsHtml(tags)+'<div>'+kv(T('Category'),esc(T(i.cat)))+kv(T('Selling price'),priceText(i.price,i.decision))+kv(T('Cost'),'<b class="num">'+fmt(i.cost)+'</b>')+kv(T('In stock'),'<b class="num">'+n+'</b>')+kv(T('Reorder at'),'<span class="num">'+i.reorder+'</span>')+kv(T('Last sale'),last?esc(dayLabel(last)):esc(T('Never')))+kv(T('Tracked by'),esc(i.track==='serial'?T('IMEI or serial'):T('Quantity')))+'</div>';
  if(i.track==='serial'&&n){
    body+='<div class="field">'+esc(T('IMEI or serial numbers'))+' ('+n+')</div>'+(n>6?unitFilterBox():'')+'<div class="unitlist">'+i.serials.map(function(x){return '<div class="unit" data-s="'+esc(x.toLowerCase())+'"><span class="mono" style="flex:1">'+esc(x)+'</span><button type="button" class="btn sm" data-a="unitRemove" data-id="'+i.id+'" data-v="'+esc(x)+'">'+esc(T('Remove'))+'</button></div>';}).join('')+'</div>';
  }
  body+='<div class="form">'+btn('sellItem',T('Sell'),'primary',{id:i.id,dis:!(n>0&&i.decision!=='parts'),icon:I.receipt})+
    btn2(btn('restock',T('Add stock'),'',{id:i.id}),btn('itemEdit',T('Edit'),'',{id:i.id}))+
    btn('decide',T('Set price or status'),'',{id:i.id,v:'item'})+
    (i.track==='qty'?btn('correct',T('Correct the count'),'',{id:i.id,v:'item'}):'')+
    btn('itemDel',T('Delete this item'),'danger',{id:i.id})+'</div>';
  return {title:i.name,body:body};
};

/* ---------- new item: add or edit ---------- */
function openItemForm(id){
  var i=id?find(db.items,id):null;
  openSheet({t:'itemForm',id:id||null},{f_name:i?i.name:'',f_cat:i?i.cat:'Phones',f_track:i?i.track:'serial',f_price:i&&i.price?String(i.price):'',f_cost:i&&i.cost?String(i.cost):'',f_reorder:i?String(i.reorder):'5',f_dec:i?i.decision:'priced',f_serials:'',f_qty:''});
}
SHEETS.itemForm=function(s){
  var i=s.id?find(db.items,s.id):null;if(s.id&&!i)return null;
  var cat=F('f_cat'),track=F('f_track'),dec=F('f_dec','priced');
  var body='<div class="form">'+fInput('f_name',T('Name'),{ph:T('For example iPhone 15 128GB')})+
    fSelect('f_cat',T('Category'),CATS.map(function(c){return {v:c,t:T(c)};}),{live:'rerender'})+
    (i?'':'<div><div class="field" style="margin-bottom:6px">'+esc(T('How do you count it?'))+'</div>'+segHtml([{v:'serial',t:T('By IMEI or serial')},{v:'qty',t:T('By quantity')}],track,'fTrack')+'<small>'+esc(track==='serial'?T('Each unit has its own number, so you can see exactly which one was sold.'):T('For small things like cables and chargers.'))+'</small></div>')+
    decSeg(true)+
    fInput('f_price',T('Selling price (Birr)'),{im:'numeric',hid:dec!=='priced'})+
    '<div class="grid2">'+fInput('f_cost',T('Cost each (Birr)'),{im:'numeric'})+fInput('f_reorder',T('Warn me at'),{im:'numeric'})+'</div>';
  if(!i){
    if(track==='serial')body+=fArea('f_serials',T('IMEI or serial numbers'),{live:'itemChk',ph:T('One per line'),hint:T('Add one number per line or separate them with commas. You can also add them later.')})+'<div id="f_chk" class="form">'+chkHtml(F('f_serials'),cat==='Phones')+'</div>';
    else body+=fInput('f_qty',T('Quantity in stock'),{im:'numeric'});
  }
  body+=errBox()+btn('itemSave',T('Save'),'primary')+'</div>';
  return {title:i?T('Edit item'):T('Add item'),body:body};
};
function itemSave(){
  var s=state.sheet,i=s.id?find(db.items,s.id):null,f=state.f,now=Date.now();
  var name=(f.f_name||'').trim(),dec=f.f_dec||'priced',price=num(f.f_price),cost=num(f.f_cost);
  var reorder=String(f.f_reorder==null?'':f.f_reorder).trim()===''?5:Math.floor(num(f.f_reorder));
  if(!name)return showErr(T('Enter a name.'));
  if(dec==='priced'&&!price)return showErr(T('Enter a selling price, or choose Undecided.'));
  if(!cost)return showErr(T('Enter what you paid for each unit.'));
  if(i){
    i.name=name;i.cat=f.f_cat;i.cost=cost;i.reorder=reorder;applyDecision('item',i,dec,price);
    save();toast(T('Saved'));openSheet({t:'item',id:i.id});return;
  }
  var track=f.f_track||'serial',serials=[],qty=0;
  if(track==='serial'){
    var a=analyzeSerials(f.f_serials,f.f_cat==='Phones');
    if(a.dupInput.length)return showErr(T('Repeated in your list: {n}',{n:a.dupInput.join(', ')}));
    if(a.inStock.length)return showErr(T('Already in your stock: {n}',{n:a.inStock.join(', ')}));
    if(a.warn.length&&!f._ack){f._ack=1;return showErr(T('Some numbers look wrong. Tap Save again to keep them anyway.'));}
    serials=a.list;
  }else qty=Math.floor(num(f.f_qty));
  var it={id:uid(),name:name,cat:f.f_cat,track:track,price:dec==='priced'?price:0,cost:cost,reorder:reorder,serials:serials,qty:qty,decision:dec,ts:now};
  db.items.push(it);
  log('stock','Item added: {n} ({q} in stock)',{n:name,q:track==='serial'?serials.length:qty},now);
  save();state.sheet=null;state.tab='stock';state.stockTab='new';state.newCat='All';state.q='';toast(T('Item added'));
}

/* ---------- add stock to an item ---------- */
SHEETS.restock=function(s){
  var i=find(db.items,s.id);if(!i)return null;
  var body='<div class="form"><p class="sub">'+esc(T('Now in stock: {n}',{n:stock(i)}))+'</p>'+
    (i.track==='serial'?fArea('f_serials',T('New IMEI or serial numbers'),{live:'itemChk',ph:T('One per line'),hint:T('Add one number per line or separate them with commas.')})+'<div id="f_chk" class="form">'+chkHtml(F('f_serials'),i.cat==='Phones')+'</div>':fInput('f_qty',T('How many arrived?'),{im:'numeric'}))+
    errBox()+btn('restockSave',T('Add to stock'),'primary',{id:i.id})+'</div>';
  return {title:T('Add stock')+': '+i.name,body:body};
};
function restockSave(id){
  var i=find(db.items,id),f=state.f;if(!i)return;
  if(i.track==='serial'){
    var a=analyzeSerials(f.f_serials,i.cat==='Phones');
    if(!a.list.length)return showErr(T('Enter at least one IMEI or serial number.'));
    if(a.dupInput.length)return showErr(T('Repeated in your list: {n}',{n:a.dupInput.join(', ')}));
    if(a.inStock.length)return showErr(T('Already in your stock: {n}',{n:a.inStock.join(', ')}));
    if(a.warn.length&&!f._ack){f._ack=1;return showErr(T('Some numbers look wrong. Tap Save again to keep them anyway.'));}
    i.serials=i.serials.concat(a.list);log('stock','Stock added: {n} +{q}',{n:i.name,q:a.list.length});toast(T('{n} units added',{n:a.list.length}));
  }else{
    var q=Math.floor(num(f.f_qty));if(q<1)return showErr(T('Enter how many arrived.'));
    i.qty+=q;log('stock','Stock added: {n} +{q}',{n:i.name,q:q});toast(T('{n} added to stock',{n:q}));
  }
  save();openSheet({t:'item',id:id});
}

/* ---------- stock corrections (with a reason) ---------- */
SHEETS.correct=function(s){
  var r=s.k==='part'?find(db.parts,s.id):find(db.items,s.id);if(!r)return null;
  var nm=s.k==='part'?T(r.name):r.name;
  var body='<div class="form"><p class="sub">'+esc(T('The app says {n} in stock.',{n:r.qty}))+'</p>'+
    fInput('f_newqty',T('Real count'),{im:'numeric',def:String(r.qty)})+
    fSelect('f_reason',T('Reason'),[{v:'',t:T('Choose a reason')}].concat(optsFrom(REASONS_FIX)),{})+
    errBox()+btn('correctSave',T('Save correction'),'primary',{id:r.id,v:s.k})+'</div>';
  return {title:T('Correct the count')+': '+nm,body:body};
};
function correctSave(id,k){
  var r=k==='part'?find(db.parts,id):find(db.items,id),f=state.f;if(!r)return;
  var raw=String(f.f_newqty==null?r.qty:f.f_newqty).trim();
  if(raw===''||!/^\d+$/.test(raw))return showErr(T('Enter the real count as a whole number.'));
  if(!f.f_reason)return showErr(T('Choose a reason.'));
  var q=parseInt(raw,10);
  if(q===r.qty){state.sheet=null;return;}
  correctQty(r,q,f.f_reason,k==='part'?T(r.name):r.name);
  toast(T('Count corrected'));openSheet({t:k==='part'?'part':'item',id:id});
}
SHEETS.unitRemove=function(s){
  var i=find(db.items,s.id);if(!i||i.serials.indexOf(s.serial)<0)return null;
  var body='<div class="form"><p class="sub mono">'+esc(s.serial)+'</p><p class="sub">'+esc(T('Use this only if the unit is not really in your shop (lost, damaged, or returned). To undo a sale, use the sale instead.'))+'</p>'+
    fSelect('f_reason',T('Reason'),[{v:'',t:T('Choose a reason')}].concat(optsFrom(REASONS_FIX)),{})+errBox()+btn('unitRemoveSave',T('Remove this unit'),'danger',{id:i.id,v:s.serial})+'</div>';
  return {title:i.name,body:body};
};

/* ---------- price decision ---------- */
function openDecide(k,id){
  var r=k==='item'?find(db.items,id):k==='used'?find(db.used,id):find(db.parts,id);if(!r)return;
  var price=k==='used'?r.ask:r.price;
  openSheet({t:'decide',k:k,id:id},{f_dec:r.decision||'priced',f_price:price?String(price):''});
}
SHEETS.decide=function(s){
  var r=s.k==='item'?find(db.items,s.id):s.k==='used'?find(db.used,s.id):find(db.parts,s.id);if(!r)return null;
  var dec=F('f_dec','priced'),nm=s.k==='part'?T(r.name):r.name;
  var body='<div class="form">'+decSeg(s.k!=='part')+fInput('f_price',T('Selling price (Birr)'),{im:'numeric',hid:dec!=='priced'})+
    '<small>'+esc(dec==='undecided'?T('The item stays in your stock without a price. You will be reminded to decide.'):dec==='parts'?(s.k==='used'?T('Marked to be taken apart. Use Take apart on the device when you are ready.'):T('Marked as parts. It will not be offered for sale and will not count as low stock.')):T('The price is used when you add this to a sale. You can still change it during the sale.'))+'</small>'+
    errBox()+btn('decideSave',T('Save'),'primary',{id:s.id,v:s.k})+'</div>';
  return {title:nm,body:body};
};
function decideSave(id,k){
  var r=k==='item'?find(db.items,id):k==='used'?find(db.used,id):find(db.parts,id),f=state.f;if(!r)return;
  var dec=f.f_dec||'priced',price=num(f.f_price);
  if(dec==='priced'&&!price)return showErr(T('Enter a selling price, or choose Undecided.'));
  applyDecision(k,r,dec,price);save();toast(T('Saved'));openSheet({t:k,id:id});
}

/* ---------- used devices ---------- */
SHEETS.used=function(s){
  var u=find(db.used,s.id);if(!u)return null;
  var tags=[];
  if(u.status==='sold')tags.push({t:T('Sold'),k:'gray'});else if(u.status==='parts')tags.push({t:T('Taken apart'),k:'gray'});
  else if(u.decision==='parts')tags.push({t:T('For parts'),k:'gray'});else if(u.decision==='undecided'||!u.ask)tags.push({t:T('Undecided'),k:'warn'});
  if(u.source==='trade-in')tags.push({t:T('Trade-in'),k:'info'});
  var body='<div style="display:flex;gap:12px;align-items:center"><span class="grade g'+u.grade+'">'+u.grade+'</span><div class="grow" style="min-width:0"><small>'+esc(T(GRADES[u.grade]))+'</small>'+tagsHtml(tags)+'</div></div><div>'+
    kv(T('Type'),esc(T(DEV_CAT_LABEL[u.cat]||'Others')))+kv(T('IMEI or serial'),u.imei?'<span class="mono">'+esc(u.imei)+'</span>':esc(T('No IMEI or serial')))+
    kv(T('Bought for'),'<b class="num">'+fmt(u.buy)+'</b>')+kv(T('Asking price'),priceText(u.ask,u.decision))+kv(T('Added'),esc(dfmt(u.ts,{month:'short',day:'numeric',year:'numeric'})+' ('+ageLabel(u.ts)+')'))+
    (u.status==='sold'?kv(T('Sold for'),'<b class="num">'+fmt(u.soldPrice)+'</b>'):'')+(u.notes?kv(T('Notes'),esc(u.notes)):'')+'</div>';
  var parts=db.parts.filter(function(p){return p.fromId===u.id;});
  if(u.status==='parts')body+='<p class="sub">'+esc(T('{n} parts were taken from this device.',{n:parts.length}))+'</p>';
  body+='<div class="form">';
  if(u.status==='stock'){
    body+=btn('sellUsed',T('Sell'),'primary',{id:u.id,icon:I.receipt})+btn2(btn('usedEdit',T('Edit'),'',{id:u.id}),btn('apartOpen',T('Take apart'),'',{id:u.id}))+btn('decide',T('Set price or status'),'',{id:u.id,v:'used'})+btn('usedDel',T('Delete this device'),'danger',{id:u.id});
  }else if(u.status==='sold'){
    body+=(u.saleId&&find(db.sales,u.saleId)?btn('sale',T('View the sale'),'primary',{id:u.saleId}):'');
  }else{
    body+=btn('undoApartOpen',T('Undo take apart'),'danger',{id:u.id,icon:I.undo});
  }
  body+='</div>';
  return {title:u.name,body:body};
};
function openUsedForm(id){
  var u=id?find(db.used,id):null;
  openSheet({t:'usedForm',id:id||null},{f_name:u?u.name:'',f_cat:u?u.cat:'phone',f_imei:u?u.imei||'':'',f_grade:u?u.grade:'B',f_buy:u&&u.buy?String(u.buy):'',f_dec:u?(u.decision||'priced'):'priced',f_ask:u&&u.ask?String(u.ask):'',f_notes:u?u.notes||'':'',f_exp:'yes',f_m:'Cash'});
}
SHEETS.usedForm=function(s){
  var u=s.id?find(db.used,s.id):null;if(s.id&&!u)return null;
  var dec=F('f_dec','priced'),g=F('f_grade','B'),cat=F('f_cat','phone');
  var body='<div class="form">'+fInput('f_name',T('Name'),{ph:T('For example Samsung A54')})+
    fSelect('f_cat',T('Type of device'),DEV_CATS.map(function(x){return {v:x,t:T(DEV_CAT_LABEL[x])};}),{live:'rerender'})+
    fInput('f_imei',T('IMEI or serial number'),{live:'usedChk',hint:T('Leave empty only if the device has no number.')})+'<div id="f_chk" class="form">'+chkHtml(F('f_imei'),cat==='phone',u?u.id:null)+'</div>'+
    '<div><div class="field" style="margin-bottom:6px">'+esc(T('Condition'))+'</div><div class="chips" role="group" aria-label="'+esc(T('Condition'))+'">'+Object.keys(GRADES).map(function(x){return '<button type="button" class="chip" data-a="fGrade" data-v="'+x+'" aria-pressed="'+(g===x)+'">'+x+'</button>';}).join('')+'</div><small>'+esc(g)+': '+esc(T(GRADES[g]))+'</small></div>'+
    fInput('f_buy',T('Bought for (Birr)'),{im:'numeric'})+decSeg(true)+fInput('f_ask',T('Asking price (Birr)'),{im:'numeric',hid:dec!=='priced'})+
    fArea('f_notes',T('Notes'),{ph:T('Battery health, scratches, what is wrong')});
  if(!u){
    body+='<div><div class="field" style="margin-bottom:6px">'+esc(T('Record the purchase as an expense?'))+'</div>'+segHtml([{v:'yes',t:T('Yes')},{v:'no',t:T('No, it was a trade-in or gift')}],F('f_exp','yes'),'fExp')+'</div>'+(F('f_exp','yes')==='yes'?methSeg():'');
  }
  body+=errBox()+btn('usedSave',T('Save'),'primary')+'</div>';
  return {title:u?T('Edit used device'):T('Add used device'),body:body};
};
function usedSave(){
  var s=state.sheet,u=s.id?find(db.used,s.id):null,f=state.f,now=Date.now();
  var name=(f.f_name||'').trim(),imei=(f.f_imei||'').trim(),dec=f.f_dec||'priced',ask=num(f.f_ask),buy=num(f.f_buy);
  if(!name)return showErr(T('Enter a name.'));
  if(dec==='priced'&&!ask)return showErr(T('Enter an asking price, or choose Undecided.'));
  if(imei){
    if(serialInUse(imei,u?u.id:null))return showErr(T('That IMEI or serial number is already in your stock: {n}',{n:imei}));
    var w=serialWarn(imei,f.f_cat==='phone');
    if(w&&!f._ack){f._ack=1;return showErr(T('Some numbers look wrong. Tap Save again to keep them anyway.'));}
  }
  if(u){
    u.name=name;u.cat=f.f_cat;u.imei=imei;u.grade=f.f_grade;u.buy=buy;u.notes=(f.f_notes||'').trim();applyDecision('used',u,dec,ask);
    save();toast(T('Saved'));openSheet({t:'used',id:u.id});return;
  }
  var d={id:uid(),name:name,cat:f.f_cat,imei:imei,grade:f.f_grade,buy:buy,ask:dec==='priced'?ask:0,decision:dec,notes:(f.f_notes||'').trim(),status:'stock',ts:now,source:f.f_exp==='yes'?'purchase':'other'};
  db.used.push(d);
  log('used','Used device added: {n}, bought for {p} Birr',{n:name,p:fmt(buy)},now);
  if(f.f_exp==='yes'&&buy>0){db.expenses.push({id:uid(),ts:now,amount:buy,cat:'Used devices',note:name,method:f.f_m||'Cash',ref:{t:'used',id:d.id}});log('expense','Expense recorded: {c}, {n} Birr',{c:T('Used devices')+' - '+name,n:fmt(buy)},now);}
  save();state.sheet=null;state.tab='stock';state.stockTab='used';state.usedStatus='stock';state.usedGrade='All';state.usedQ='';toast(T('Added to used stock'));
}

/* ---------- spare parts ---------- */
SHEETS.part=function(s){
  var p=find(db.parts,s.id);if(!p)return null;
  var k=p.state==='tested'?'good':p.state==='faulty'?'bad':'warn',tags=[{t:T(cap(p.state)),k:k}];
  if(p.qty>0&&(p.decision==='undecided'||!p.price))tags.push({t:T('Undecided'),k:'warn'});
  var body=tagsHtml(tags)+'<div>'+kv(T('Category'),esc(T(DEV_CAT_LABEL[p.cat]||'Others')))+kv(T('In stock'),'<b class="num">'+p.qty+'</b>')+kv(T('Cost each'),'<b class="num">'+fmt(p.cost)+'</b>')+kv(T('Selling price'),priceText(p.price,p.decision==='parts'?'undecided':p.decision))+kv(T('From'),esc(p.from?T(p.from):T('unknown')))+kv(T('Added'),esc(ageLabel(p.ts)))+'</div>';
  var uses=[];db.repairs.forEach(function(r){r.parts.forEach(function(rp){if(rp.partId===p.id)uses.push(r);});});
  if(uses.length)body+='<p class="sub">'+esc(T('Used in {n} repairs.',{n:uses.length}))+'</p>';
  body+='<div class="form">'+
    (p.qty>0?btn2(btn('useInRepair',T('Used in Repair'),'primary',{id:p.id,icon:I.wrench}),btn('sellPart',T('Record Sale'),'primary',{id:p.id,icon:I.receipt})):'<p class="sub">'+esc(T('None left in stock.'))+'</p>')+
    btn2(btn('partEdit',T('Edit'),'',{id:p.id}),btn('decide',T('Set price'),'',{id:p.id,v:'part'}))+
    btn('correct',T('Correct the count'),'',{id:p.id,v:'part'})+btn('partDel',T('Delete this part'),'danger',{id:p.id})+'</div>';
  return {title:T(p.name),body:body};
};
function openPartForm(id){
  var p=id?find(db.parts,id):null;
  openSheet({t:'partForm',id:id||null},{f_name:p?p.name:'',f_cat:p?p.cat:(state.partCat||'phone'),f_state:p?p.state:'tested',f_qty:p?String(p.qty):'1',f_cost:p&&p.cost?String(p.cost):'',f_dec:p&&p.decision==='priced'?'priced':(p?'undecided':'priced'),f_price:p&&p.price?String(p.price):'',f_from:p?p.from||'':'Bought directly',f_exp:'yes',f_m:'Cash'});
}
SHEETS.partForm=function(s){
  var p=s.id?find(db.parts,s.id):null;if(s.id&&!p)return null;
  var cat=F('f_cat','phone'),dec=F('f_dec','priced');
  var names=PART_TYPES[cat]||[];
  var body='<div class="form">'+fSelect('f_cat',T('Which device is it for?'),DEV_CATS.map(function(x){return {v:x,t:T(DEV_CAT_LABEL[x])};}),{live:'rerender'})+
    '<datalist id="partnames">'+names.map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist>'+
    fInput('f_name',T('Part'),{list:'partnames',ph:T('For example Screen')})+
    fSelect('f_state',T('Condition'),PART_STATES.map(function(x){return {v:x,t:T(cap(x))};}),{})+
    (p?'':fInput('f_qty',T('Quantity'),{im:'numeric'}))+
    fInput('f_cost',T('Cost each (Birr)'),{im:'numeric'})+
    '<div><div class="field" style="margin-bottom:6px">'+esc(T('Price decision'))+'</div>'+segHtml([{v:'priced',t:T('Set a price')},{v:'undecided',t:T('Undecided')}],dec,'fDec')+'</div>'+
    fInput('f_price',T('Selling price (Birr)'),{im:'numeric',hid:dec!=='priced'})+
    fInput('f_from',T('Where is it from?'),{});
  if(!p)body+='<div><div class="field" style="margin-bottom:6px">'+esc(T('Record the purchase as an expense?'))+'</div>'+segHtml([{v:'yes',t:T('Yes')},{v:'no',t:T('No')}],F('f_exp','yes'),'fExp')+'</div>'+(F('f_exp','yes')==='yes'?methSeg():'');
  body+=errBox()+btn('partSave',T('Save'),'primary')+'</div>';
  return {title:p?T('Edit part'):T('Add part'),body:body};
};
function partSave(){
  var s=state.sheet,p=s.id?find(db.parts,s.id):null,f=state.f,now=Date.now();
  var name=(f.f_name||'').trim(),dec=f.f_dec||'priced',price=num(f.f_price),cost=num(f.f_cost),qty=p?p.qty:Math.floor(num(f.f_qty));
  if(!name)return showErr(T('Enter a name.'));
  if(!p&&qty<1)return showErr(T('Enter how many you have.'));
  if(dec==='priced'&&!price)return showErr(T('Enter a selling price, or choose Undecided.'));
  var from=(f.f_from||'').trim();
  if(p){
    p.name=name;p.cat=f.f_cat;p.state=f.f_state;p.cost=cost;p.from=from;applyDecision('part',p,dec,price);
    save();toast(T('Saved'));openSheet({t:'part',id:p.id});return;
  }
  var np={id:uid(),name:name,cat:f.f_cat,state:f.f_state,cost:cost,price:dec==='priced'?price:0,decision:dec,qty:qty,from:from,fromId:'',ts:now};
  db.parts.push(np);
  log('part','Spare part added: {n} x{q}',{n:T(name),q:qty},now);
  if(f.f_exp!=='no'&&cost*qty>0){db.expenses.push({id:uid(),ts:now,amount:cost*qty,cat:'Spare parts',note:T(name)+(qty>1?' x'+qty:''),method:f.f_m||'Cash',ref:{t:'part',id:np.id}});log('expense','Expense recorded: {c}, {n} Birr',{c:T('Spare parts')+' - '+T(name),n:fmt(cost*qty)},now);}
  save();state.sheet=null;state.tab='stock';state.stockTab='parts';state.partCat=np.cat;state.partStatus='stock';state.partType='All';state.partQ='';toast(T('Part added'));
}

/* ---------- use a part in a repair ---------- */
SHEETS.useIn=function(s){
  var p=s.partId?find(db.parts,s.partId):null,r=s.repairId?find(db.repairs,s.repairId):null;
  if(s.partId&&!p)return null;if(s.repairId&&!r)return null;
  var body='<div class="form">';
  if(!p){
    var ps=db.parts.filter(function(x){return x.qty>0;});
    if(!ps.length)return {title:T('Use a part'),body:emptyMsg(T('No spare parts in stock.'))};
    body+=fSelect('f_part',T('Part'),[{v:'',t:T('Choose a part')}].concat(ps.map(function(x){return {v:x.id,t:T(x.name)+' - '+T(DEV_CAT_LABEL[x.cat])+' ('+x.qty+')'};})),{});
  }else body+='<p class="sub">'+esc(T(p.name))+' - '+esc(T('{n} in stock',{n:p.qty}))+'</p>';
  if(!r){
    var rs=db.repairs.filter(function(x){return x.status!=='delivered';});
    if(!rs.length)return {title:T('Used in Repair'),body:emptyMsg(T('There are no open repair jobs.'))+btn('repairNew',T('New repair'),'primary')};
    body+=fSelect('f_rep',T('Repair job'),[{v:'',t:T('Choose a repair job')}].concat(rs.map(function(x){return {v:x.id,t:x.device+' - '+(x.customer||T('No name'))};})),{});
  }else body+='<p class="sub">'+esc(T('Repair job'))+': '+esc(r.device)+'</p>';
  body+=fInput('f_uq',T('How many used?'),{im:'numeric',def:'1'})+errBox()+btn('useInSave',T('Save'),'primary')+'</div>';
  return {title:T('Used in Repair'),body:body};
};
function useInSave(){
  var s=state.sheet,f=state.f,pid=s.partId||f.f_part,rid=s.repairId||f.f_rep;
  if(!pid)return showErr(T('Choose a part.'));if(!rid)return showErr(T('Choose a repair job.'));
  var q=Math.floor(num(f.f_uq==null?1:f.f_uq));
  var err=useInRepair(pid,rid,q);if(err)return showErr(err);
  state.sheet=null;toast(T('Part used in the repair'));
  if(s.repairId)openSheet({t:'repair',id:rid});
}

/* ---------- take a device apart ---------- */
function openApart(devId){
  var d=devId?find(db.used,devId):null;
  state.apart={deviceId:d?d.id:'',rows:d?apartDefaults(d.cat):[]};
  openSheet({t:'apart'});
}
SHEETS.apart=function(){
  var a=state.apart;if(!a)return null;
  var dev=find(db.used,a.deviceId),devs=usedInStock(),costs=apartCosts();
  var body='<div class="form">'+fSelect('ap_dev',T('Device'),[{v:'',t:T('Choose a device')}].concat(devs.map(function(u){return {v:u.id,t:u.name+' ('+fmt(u.buy)+')'};})),{b:'apart.deviceId',live:'apartDev'});
  if(dev){
    body+='<p class="sub">'+esc(T('Bought for {n} Birr. The cost is split across the parts using the shares below.',{n:fmt(dev.buy)}))+'</p>';
    body+=a.rows.map(function(r,idx){
      return '<div class="cartline"><div class="top2"><b>'+esc(T('Part {n}',{n:idx+1}))+'</b><button type="button" class="iconbtn" data-a="apartRm" data-v="'+idx+'" aria-label="'+esc(T('Remove'))+'">'+ic(I.x,20,2)+'</button></div>'+
        fInput('ap_n'+idx,T('Part'),{b:'apart.rows.'+idx+'.name',list:'partnames'})+
        '<div class="grid2">'+fSelect('ap_s'+idx,T('Condition'),PART_STATES.map(function(x){return {v:x,t:T(cap(x))};}),{b:'apart.rows.'+idx+'.state'})+fInput('ap_h'+idx,T('Share of cost'),{b:'apart.rows.'+idx+'.share',im:'numeric',live:'apart'})+'</div>'+
        '<small>'+esc(T('Cost'))+': <b class="num" id="apc'+idx+'">'+(r.name.trim()?fmt(costs[r.key]||0):'-')+'</b></small></div>';
    }).join('')+'<datalist id="partnames">'+(PART_TYPES[dev.cat]||[]).map(function(n){return '<option value="'+esc(n)+'">';}).join('')+'</datalist>'+
    btn('apartAdd',T('Add another part'),'',{icon:I.plus})+errBox()+btn('apartSave',T('Take apart and add parts to stock'),'primary');
  }else body+=errBox();
  return {title:T('Take a device apart'),body:body+'</div>'};
};
