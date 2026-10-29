"use strict";
const menuButton=document.querySelector('.nav-toggle');
const navigation=document.querySelector('#site-nav');
if(menuButton&&navigation){
  menuButton.addEventListener('click',()=>{
    const isOpen=navigation.classList.toggle('open');
    menuButton.setAttribute('aria-expanded',String(isOpen));
  });
  navigation.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false');
  }));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      navigation.classList.remove('open');
      menuButton.setAttribute('aria-expanded','false');
    }
  });
}
document.querySelectorAll('[data-year]').forEach(el=>el.textContent=String(new Date().getFullYear()));
