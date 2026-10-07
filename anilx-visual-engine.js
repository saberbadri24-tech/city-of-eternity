/* ANIL X ROYAL VISUAL ENGINE — local-first, no external image dependency */
(()=>{'use strict';
const roots=['wallpapers/royal-dawn.svg','wallpapers/royal-midnight.svg','wallpapers/royal-sunrise.svg'];
const key='anilx-royal-wallpaper-v1';
try{
  const last=Number(localStorage.getItem(key)||'-1');
  const next=(last+1)%roots.length;
  localStorage.setItem(key,String(next));
  const url=new URL(roots[next],location.href).href;
  const img=new Image();
  img.decoding='async';
  img.onload=()=>document.body?.style.setProperty('--ax-wallpaper',`url("${url}")`);
  img.src=url;
  if(document.body)document.body.style.setProperty('--ax-wallpaper',`url("${url}")`);
  document.documentElement.dataset.axWallpaper=String(next);
}catch{}
})();