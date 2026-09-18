import { version } from '../package.json';

import { getHistory, addHistory, deleteHistory, getLanguage, setLanguage } from './js/storage.js';
import { createLiveStatus } from './js/accessibility.js';
import { createClipboardHandlers } from './js/clipboard.js';
import { createInfoModalHandlers } from './js/info-modal.js';
import { applyTheme, selectTheme } from './js/theme.js';
import { toggleFullscreen } from './js/fullscreen.js';
import { presets } from './data/presets.js';
import { T } from './data/translations.js';
import { hash32, mulberry32, uniqueNums, todayDMY, parseDMY, displayDate } from './js/generator.js';

const $=id=>document.getElementById(id); let currentPreset='6'; let lastResult=null;
$('infoVersion').textContent=version;
const announce=createLiveStatus({ $ });
const { infoTr, applyInfoLanguage, openInfo, closeInfo, handleInfoOverlayClick, handleInfoKeydown }=createInfoModalHandlers({ $ });
const { copyResult, copyHistory, copyWallet }=createClipboardHandlers({ $, getLastResult:()=>lastResult, resultString, tr, infoTr, announce });
function tr(k){return (T[$('language').value]||T.en)[k]||T.en[k]||k}
function renderPresets(){ const wrap=$('presets'); wrap.innerHTML=''; presets.forEach(p=>{const b=document.createElement('button');b.className='chip'+(p.id===currentPreset?' active':'');b.setAttribute('aria-pressed',String(p.id===currentPreset));b.textContent=p.id==='custom'?tr('custom'):p.label;b.onclick=()=>selectPreset(p.id);wrap.appendChild(b)}) }
function selectPreset(id){currentPreset=id; const p=presets.find(x=>x.id===id); if(id!=='custom'){ $('mainCount').value=p.m;$('extraCount').value=p.e;$('mainMax').value=p.mm;$('extraMax').value=p.em } renderPresets()}
function validate(){const m=+$('mainCount').value,mm=+$('mainMax').value,e=+$('extraCount').value,em=+$('extraMax').value;return [m,mm,e,em].every(Number.isInteger)&&m>=1&&m<=20&&mm>=m&&mm<=99&&e>=0&&e<=10&&em>=1&&em<=99&&(e===0||em>=e)}
function generate(){if(!validate()){alert(tr('invalid'));return} let entered=$('dateInput').value.trim();if(!entered){entered=todayDMY();$('dateInput').value=entered}const parsed=parseDMY(entered);if(!parsed){alert(tr('invalidDate'));$('dateInput').focus();return}const date=parsed.display;$('dateInput').value=date;const m=+$('mainCount').value,mm=+$('mainMax').value,e=+$('extraCount').value,em=+$('extraMax').value,salt=$('salt').value.trim();const seedBase=`${parsed.iso}|${m}|${mm}|${e}|${em}|${salt}`;const main=uniqueNums(m,mm,mulberry32(hash32(seedBase+'|main')));const extra=e?uniqueNums(e,em,mulberry32(hash32(seedBase+'|extra'))):[]; lastResult={date,m,mm,e,em,salt,main,extra,created:new Date().toISOString()};renderResult();announce(`${tr('result')}: ${resultString(lastResult)}`)}
function resultString(r){return `${displayDate(r.date)} • ${r.m}${r.e?`+${r.e}`:''} • ${r.main.join(', ')}${r.e?' + '+r.extra.join(', '):''}`}
function renderResult(){const r=lastResult;if(!r)return;const balls=r.main.map(n=>`<div class="ball">${n}</div>`).join('');const extra=r.extra.length?`<div class="plus">+</div>${r.extra.map(n=>`<div class="ball extra">${n}</div>`).join('')}`:'';$('resultArea').className='';$('resultArea').innerHTML=`<div class="drawMeta"><span>${displayDate(r.date)}</span><span>${r.m}${r.e?`+${r.e}`:''} • 1–${r.mm}${r.e?` / 1–${r.em}`:''}</span></div><div class="balls">${balls}${extra}</div><div class="resultText" id="resultText">${resultString(r)}</div><div class="actions"><button class="btn secondary" id="copyBtn">${tr('copy')}</button><button class="btn secondary" id="saveBtn">${tr('save')}</button></div>`;$('copyBtn').onclick=copyResult;$('saveBtn').onclick=saveResult}
function saveResult(){if(!lastResult)return;const saved=addHistory(lastResult);$('saveBtn').textContent=tr(saved?'saved':'save');announce(tr(saved?'saved':'saveFailed'));renderHistory()}
function renderHistory(){const h=getHistory();$('historyWrap').hidden=!h.length;const w=$('historyList');w.innerHTML='';h.forEach((r,i)=>{const row=document.createElement('div');row.className='histItem';row.innerHTML=`<div class="histText" title="${resultString(r)}">${resultString(r)}</div><div><button class="btn mini" data-copy="${i}">${tr('copy')}</button> <button class="btn mini" data-del="${i}">${tr('delete')}</button></div>`;w.appendChild(row)});w.querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>copyHistory(h[+b.dataset.copy],b));w.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{deleteHistory(h,+b.dataset.del);renderHistory()})}
function applyLanguage(){announce.clear();document.documentElement.lang=$('language').value;document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=tr(el.dataset.i18n));document.querySelectorAll('[data-i18n-name]').forEach(el=>{const name=tr(el.dataset.i18nName);el.setAttribute('aria-label',name);el.title=name});renderPresets();if(lastResult)renderResult();renderHistory();applyInfoLanguage();setLanguage($('language').value)}
function reset(){announce.clear();selectPreset('6');$('salt').value='';$('dateInput').value='';lastResult=null;$('resultArea').className='empty';$('resultArea').innerHTML=`<div class="big">🎱</div><p>${tr('empty')}</p>`}

$('infoBtn').onclick=openInfo;$('infoX').onclick=closeInfo;$('infoClose').onclick=closeInfo;$('infoOverlay').addEventListener('click',handleInfoOverlayClick);document.addEventListener('keydown',handleInfoKeydown);document.querySelectorAll('.copy-wallet').forEach(b=>b.onclick=()=>copyWallet(b));
$('generateBtn').onclick=generate;$('resetBtn').onclick=reset;$('language').onchange=applyLanguage;$('themeSelect').onchange=e=>selectTheme(e.target.value);$('fullscreenBtn').onclick=toggleFullscreen;
['mainCount','mainMax','extraCount','extraMax'].forEach(id=>$(id).addEventListener('input',()=>{currentPreset='custom';renderPresets()}));
$('dateInput').addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,8);if(v.length>4)v=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);else if(v.length>2)v=v.slice(0,2)+'/'+v.slice(2);e.target.value=v});
(function init(){$('language').value=getLanguage();applyTheme();$('dateInput').value='';applyLanguage();selectPreset('6');renderHistory()})();
