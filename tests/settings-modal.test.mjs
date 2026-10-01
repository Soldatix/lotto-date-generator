import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const html = readFileSync('index.html', 'utf8');
const source = readFileSync('src/js/settings-modal.js', 'utf8');
const { SETTINGS_T, INFO_T } = await import(
  'data:text/javascript;base64,' +
  Buffer.from(readFileSync('src/data/translations.js', 'utf8')).toString('base64')
);
const settingsStart = html.indexOf('<div class="info-overlay settings-overlay"');
const infoStart = html.indexOf('<div class="info-overlay" id="infoOverlay"');
const settingsMarkup = html.slice(settingsStart, infoStart);
const infoMarkup = html.slice(infoStart);

test('Settings is independent of Info and moves app-data controls once', () => {
  assert.ok(settingsStart >= 0 && infoStart > settingsStart);
  assert.match(settingsMarkup, /role="dialog" aria-modal="true" aria-labelledby="settingsTitle"/);
  for (const id of ['settingsBtn', 'settingsOverlay', 'settingsTitle', 'settingsX',
    'settingsClose', 'exportBackup', 'importBackup', 'backupFile', 'backupStatus',
    'resetStoredData']) {
    assert.equal([...html.matchAll(new RegExp('id="' + id + '"', 'g'))].length, 1, id);
  }
  for (const id of ['exportBackup','importBackup','backupFile','backupStatus','resetStoredData']) {
    assert.match(settingsMarkup, new RegExp('id="' + id + '"'));
    assert.doesNotMatch(infoMarkup, new RegExp('id="' + id + '"'));
  }
  assert.match(settingsMarkup, /id="backupStatus"[^>]*role="status" aria-live="polite"/);
  assert.match(settingsMarkup, /id="backupFile"[^>]*hidden aria-labelledby="importBackup"/);
  assert.match(settingsMarkup, /id="resetStoredData" data-settings-i18n="resetStoredData"/);
  assert.doesNotMatch(settingsMarkup, /habits, tasks and statistics/);
});

test('Every Settings label and existing backup/reset action is localized', () => {
  const languages = ['en','hr','de','it','es'];
  for (const lang of languages) {
    for (const key of Object.keys(SETTINGS_T.en)) assert.ok(SETTINGS_T[lang][key]?.trim(), lang + '.' + key);
    for (const key of ['backupExport','backupImport','resetStoredData','close',
      'backupRestored','resetConfirm']) assert.ok(INFO_T[lang][key]?.trim(), lang + '.' + key);
  }
  const labels = [...settingsMarkup.matchAll(/data-settings-i18n="([^"]+)"/g)].map(match => match[1]);
  for (const key of labels) for (const lang of languages) {
    assert.ok(SETTINGS_T[lang][key] || INFO_T[lang][key], lang + '.' + key);
  }
});

function fixture() {
  const document = { activeElement: null, body: { style: {} }, querySelectorAll() { return []; } };
  const element = () => ({
    dataset: {}, tabIndex: 0, isConnected: true, visible: true, disabled: false,
    textContent: '', attributes: {},
    setAttribute(key,value) { this.attributes[key] = value; },
    focus() { if(this.visible && !this.disabled) document.activeElement = this; },
    matches() { return this.disabled; },
    getClientRects() { return this.visible ? [{}] : []; }
  });
  const ids = ['settingsBtn','settingsX','exportBackup','importBackup','resetStoredData',
    'settingsClose','backupStatus','language','settingsTitle','settingsDataTitle','settingsDangerTitle'];
  const nodes = Object.fromEntries(ids.map(id => [id,element()]));
  nodes.language.value='en';
  const controls=['settingsX','exportBackup','importBackup','resetStoredData','settingsClose'].map(id=>nodes[id]);
  const open=new Set();
  nodes.settingsOverlay={
    classList:{add:kind=>open.add(kind),remove:kind=>open.delete(kind),contains:kind=>open.has(kind)},
    setAttribute(key,value) { this[key]=value; },
    querySelectorAll() { return controls; }
  };
  const context=vm.createContext({document,SETTINGS_T,INFO_T,$:id=>nodes[id],
    getComputedStyle:()=>({visibility:'visible'})});
  vm.runInContext(source.replace(/^import .*\r?\n/, '').replace('export function','function'),context);
  const modal=vm.runInContext('createSettingsModalHandlers({ $ })',context);
  nodes.settingsBtn.focus();
  const key=(name,shiftKey=false)=>{
    const event={key:name,shiftKey,prevented:false,preventDefault(){this.prevented=true;}};
    modal.handleSettingsKeydown(event);
    return event;
  };
  return {document,nodes,modal,controls,key,open};
}

test('Settings opens with focus, traps Tab/Shift+Tab, then restores opener', () => {
  const f=fixture();
  f.modal.openSettings();
  assert.equal(f.document.activeElement,f.nodes.settingsX);
  assert.equal(f.nodes.settingsOverlay['aria-hidden'],'false');
  assert.equal(f.document.body.style.overflow,'hidden');
  assert.equal(f.key('Tab',true).prevented,true);
  assert.equal(f.document.activeElement,f.nodes.settingsClose);
  assert.equal(f.key('Tab').prevented,true);
  assert.equal(f.document.activeElement,f.nodes.settingsX);
  f.key('Escape');
  assert.equal(f.document.activeElement,f.nodes.settingsBtn);
  assert.equal(f.nodes.settingsOverlay['aria-hidden'],'true');
  assert.equal(f.document.body.style.overflow,'');
});

test('Settings X, footer Close, overlay and disabled controls are handled safely', () => {
  for(const method of ['X','Close','overlay']){
    const f=fixture();
    f.modal.openSettings();
    if(method==='overlay') f.modal.handleSettingsOverlayClick({target:f.nodes.settingsOverlay});
    else { f.nodes[method==='X'?'settingsX':'settingsClose'].focus(); f.modal.closeSettings(); }
    assert.equal(f.document.activeElement,f.nodes.settingsBtn);
  }
  const f=fixture();
  f.modal.openSettings();
  f.nodes.settingsClose.disabled=true;
  f.nodes.settingsX.focus();
  f.key('Tab',true);
  assert.equal(f.document.activeElement,f.nodes.resetStoredData);
  f.nodes.language.value='hr';
  f.modal.applySettingsLanguage();
  assert.equal(f.nodes.settingsX.attributes['aria-label'],INFO_T.hr.close);
  assert.equal(f.nodes.settingsX.title,INFO_T.hr.close);
});
