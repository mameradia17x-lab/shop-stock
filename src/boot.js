'use strict';
/* Shop Stock start-up. */
(function(){
  db=load();
  if(!db){db=seed();save();}
  applyTheme();
  try{history.replaceState({d:0},'');}catch(e){}
  try{var mq=window.matchMedia('(prefers-color-scheme: dark)');var f=function(){if(db.settings.mode==='auto'){applyTheme();render();}};if(mq.addEventListener)mq.addEventListener('change',f);}catch(e){}
  render();
  if(window.__REGISTER_SW__){try{if('serviceWorker' in navigator)window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js').catch(function(){});});}catch(e){}}
})();
