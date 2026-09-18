import { INFO_T } from '../data/translations.js';

export function createInfoModalHandlers({ $ }){
  let previousFocus = null;
  function infoTr(k){const lang=$('language')?.value||'en';return (INFO_T[lang]||INFO_T.en)[k]||INFO_T.en[k]||k}
  function applyInfoLanguage(){document.querySelectorAll('[data-info-i18n]').forEach(el=>el.textContent=infoTr(el.dataset.infoI18n));document.querySelectorAll('.copy-wallet').forEach(b=>{if(!b.dataset.copied)b.textContent=infoTr('copy')})}
  function openInfo(){
    const o=$('infoOverlay');
    if(!o.classList.contains('open'))previousFocus=document.activeElement;
    o.classList.add('open');o.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';applyInfoLanguage();
    $('infoX').focus();
  }
  function closeInfo(){
    const o=$('infoOverlay');
    if(!o.classList.contains('open'))return;
    o.classList.remove('open');o.setAttribute('aria-hidden','true');document.body.style.overflow='';
    const target=previousFocus;
    previousFocus=null;
    if(target?.isConnected && typeof target.focus==='function')target.focus();
  }
  function handleInfoOverlayClick(e){if(e.target===$('infoOverlay'))closeInfo()}
  function handleInfoKeydown(e){
    const o=$('infoOverlay');
    if(!o.classList.contains('open'))return;
    if(e.key==='Escape'){closeInfo();return}
    if(e.key!=='Tab')return;
    // Resolve the current controls each time, including after language updates.
    const controls=[...o.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
      .filter(el=>el.tabIndex>=0 && !el.matches(':disabled') && el.getClientRects().length>0 && getComputedStyle(el).visibility==='visible');
    const first=controls[0],last=controls[controls.length-1];
    if(!first){e.preventDefault();return}
    if(!controls.includes(document.activeElement) || (e.shiftKey ? document.activeElement===first : document.activeElement===last)){
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }
  return { infoTr, applyInfoLanguage, openInfo, closeInfo, handleInfoOverlayClick, handleInfoKeydown };
}
