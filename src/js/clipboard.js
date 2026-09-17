export function createClipboardHandlers({ $, getLastResult, resultString, tr, infoTr }){
  async function copyResult(){const lastResult=getLastResult();if(!lastResult)return;const txt=resultString(lastResult);try{await navigator.clipboard.writeText(txt)}catch{const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()} const b=$('copyBtn');const old=b.textContent;b.textContent=tr('copied');setTimeout(()=>b.textContent=old,1200)}
  async function copyHistory(r,b){try{await navigator.clipboard.writeText(resultString(r))}catch{} b.textContent=tr('copied');setTimeout(()=>b.textContent=tr('copy'),900)}
  async function copyWallet(button){const value=button.dataset.wallet;try{await navigator.clipboard.writeText(value)}catch{const ta=document.createElement('textarea');ta.value=value;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}button.dataset.copied='1';button.textContent=infoTr('copied');setTimeout(()=>{delete button.dataset.copied;button.textContent=infoTr('copy')},1200)}
  return { copyResult, copyHistory, copyWallet };
}
