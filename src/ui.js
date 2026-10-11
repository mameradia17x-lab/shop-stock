'use strict';
/* Shop Stock UI helpers: small HTML builders shared by screens and sheets. */
function getPath(o,path){var p=path.split('.');for(var i=0;i<p.length&&o!=null;i++)o=o[p[i]];return o;}
function setPath(o,path,v){var p=path.split('.');for(var i=0;i<p.length-1;i++)o=o[p[i]];o[p[p.length-1]]=v;}
function F(id,def){var v=state.f[id];return v==null?(def==null?'':def):v;}
var tagHtml=function(t){return '<span class="tag '+t.k+'">'+esc(t.t)+'</span>';};
var tag=function(t,k){return '<span class="tag '+k+'">'+esc(t)+'</span>';};
function tagsHtml(list){return list.length?'<span class="tags">'+list.map(tagHtml).join('')+'</span>':'';}

/* form fields. If o.b is given the value lives at that path in state, otherwise in state.f under the field id. */
function fInput(id,label,o){
  o=o||{};
  var val=o.b?getPath(state,o.b):F(id,o.def);
  return '<label class="field'+(o.cls?' '+o.cls:'')+'" for="'+id+'"'+(o.hid?' hidden':'')+'>'+esc(label)+
    '<input id="'+id+'" '+(o.b?'data-b="'+o.b+'"':'data-f')+(o.type?' type="'+o.type+'"':'')+(o.im?' inputmode="'+o.im+'"':'')+(o.list?' list="'+o.list+'"':'')+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.max?' max="'+o.max+'"':'')+' autocomplete="off" value="'+esc(val==null?'':val)+'"'+(o.live?' data-live="'+o.live+'"':'')+'>'+
    (o.hint?'<small>'+esc(o.hint)+'</small>':'')+'</label>';
}
function fSelect(id,label,opts,o){
  o=o||{};
  var val=o.b?getPath(state,o.b):F(id,o.def);
  return '<label class="field" for="'+id+'"'+(o.hid?' hidden':'')+'>'+esc(label)+'<select id="'+id+'" '+(o.b?'data-b="'+o.b+'"':'data-f')+(o.live?' data-live="'+o.live+'"':'')+'>'+
    opts.map(function(x){return '<option value="'+esc(x.v)+'"'+(String(x.v)===String(val)?' selected':'')+'>'+esc(x.t)+'</option>';}).join('')+'</select></label>';
}
function fArea(id,label,o){
  o=o||{};
  return '<label class="field" for="'+id+'"><span>'+esc(label)+'</span><textarea id="'+id+'" data-f'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.live?' data-live="'+o.live+'"':'')+(o.ro?' readonly':'')+'>'+esc(o.b?getPath(state,o.b):F(id,o.def))+'</textarea>'+(o.hint?'<small>'+esc(o.hint)+'</small>':'')+'</label>';
}
function segHtml(opts,cur,action,extra){
  return '<div class="seg" role="group">'+opts.map(function(o){return '<button type="button" data-a="'+action+'" data-v="'+esc(o.v)+'"'+(extra||'')+' aria-pressed="'+(String(cur)===String(o.v))+'">'+esc(o.t)+'</button>';}).join('')+'</div>';
}
function chipsRow(opts,cur,action){
  return '<div class="chips" role="group">'+opts.map(function(o){return '<button type="button" class="chip" data-a="'+action+'" data-v="'+esc(o.v)+'" aria-pressed="'+(String(cur)===String(o.v))+'">'+esc(o.t)+'</button>';}).join('')+'</div>';
}
function searchBox(id,ph,val,live){
  return '<label class="search">'+ic(I.search,20)+'<input id="'+id+'" type="search" placeholder="'+esc(ph)+'" aria-label="'+esc(ph)+'" value="'+esc(val)+'" data-live="'+live+'" autocomplete="off"></label>';
}
function topbar(title,sub,right){return '<header class="top"><div><h1>'+esc(title)+'</h1>'+(sub?'<p class="sub">'+esc(sub)+'</p>':'')+'</div>'+(right?'<div class="acts">'+right+'</div>':'')+'</header>';}
function pagehead(title,right){return '<header class="pagehead"><button class="iconbtn" data-a="back" aria-label="'+esc(T('Back'))+'">'+ic(I.back,22,2)+'</button><h1>'+esc(title)+'</h1>'+(right||'')+'</header>';}
function addBtn(action,label,v){return '<button class="iconbtn primary" data-a="'+action+'"'+(v?' data-v="'+v+'"':'')+' aria-label="'+esc(label)+'">'+ic(I.plus,22,2.2)+'</button>';}
function iconBtn(action,icon,label,extra,v){return '<button class="iconbtn" data-a="'+action+'"'+(v?' data-v="'+esc(v)+'"':'')+' aria-label="'+esc(label)+'">'+ic(icon,22)+(extra||'')+'</button>';}
function methodOpts(){return METHODS.map(function(m){return {v:m,t:T(m)};});}
function optsFrom(list){return list.map(function(x){return {v:x,t:T(x)};});}
function errBox(){return '<p class="err" id="sheetErr" role="alert" hidden></p>';}
function okSteps(list){return '<div class="steps">'+list.map(function(s){return '<div>'+ic(I.check,18,2.4)+'<span>'+esc(s)+'</span></div>';}).join('')+'</div>';}
function emptyMsg(t){return '<p class="empty">'+esc(t)+'</p>';}
function kv(k,v){return '<div class="kv"><span>'+esc(k)+'</span><span>'+v+'</span></div>';}
function priceText(price,decision){
  if(decision==='parts')return '<b>'+esc(T('For parts'))+'</b>';
  if(!price)return '<b>'+esc(T('Undecided'))+'</b>';
  return '<b class="num">'+fmt(price)+'</b>';
}
function decisionTag(decision,price){
  if(decision==='parts')return tag(T('For parts'),'gray');
  if(!price||decision==='undecided')return tag(T('Undecided'),'warn');
  return '';
}
function partCatIcon(c){return c==='tv'?I.tv:c==='computer'?I.laptop:c==='phone'?I.phone:I.chip;}
