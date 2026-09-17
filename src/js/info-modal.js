import { INFO_T } from '../data/translations.js';

export function createInfoModalHandlers({ $ }){
  function infoTr(k){const lang=$('language')?.value||'en';return (INFO_T[lang]||INFO_T.en)[k]||INFO_T.en[k]||k}
  function applyInfoLanguage(){document.querySelectorAll('[data-info-i18n]').forEach(el=>el.textContent=infoTr(el.dataset.infoI18n));document.querySelectorAll('.copy-wallet').forEach(b=>{if(!b.dataset.copied)b.textContent=infoTr('copy')})}
  function openInfo(){const o=$('infoOverlay');o.classList.add('open');o.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';applyInfoLanguage()}
  function closeInfo(){const o=$('infoOverlay');o.classList.remove('open');o.setAttribute('aria-hidden','true');document.body.style.overflow=''}
  function handleInfoOverlayClick(e){if(e.target===$('infoOverlay'))closeInfo()}
  function handleInfoKeydown(e){if(e.key==='Escape'&&$('infoOverlay').classList.contains('open'))closeInfo()}
  return { infoTr, applyInfoLanguage, openInfo, closeInfo, handleInfoOverlayClick, handleInfoKeydown };
}
