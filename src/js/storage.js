export function getHistory(){try{return JSON.parse(localStorage.getItem('lottoHistory')||'[]')}catch{return[]}}
function setHistory(h){localStorage.setItem('lottoHistory',JSON.stringify(h))}
export function addHistory(result){let h=getHistory();h.unshift(result);h=h.slice(0,30);setHistory(h)}
export function deleteHistory(h,index){h.splice(index,1);setHistory(h)}
export function getTheme(){return localStorage.getItem('lottoTheme')||'dark'}
export function setTheme(theme){localStorage.setItem('lottoTheme',theme)}
export function setLanguage(language){localStorage.setItem('lottoLang',language)}
