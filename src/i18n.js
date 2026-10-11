'use strict';
/* Shop Stock translations. English is the key itself; other languages are looked up by that key. */
var DICT={am:{},om:{}};
function T(k,v){
  if(k==null)return '';
  var l=db&&db.settings?db.settings.lang:'en',s=String(k);
  if(l!=='en'&&DICT[l]&&DICT[l][s]!=null)s=DICT[l][s];
  if(v)s=s.replace(/\{(\w+)\}/g,function(m,n){return v[n]!=null?v[n]:m;});
  return s;
}
