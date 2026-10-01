/* Folio Sync — deploy as a Web app, execute as Me, access Anyone.
   Set Script Property SYNC_KEY to a random 32+ character secret before running initialize().
   Portfolio data is private; all data requests require the secret in a POST body.
   GET permits only fixed public market-data routes. No arbitrary proxy URLs. */
function output_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function initialize() {
  var p=PropertiesService.getScriptProperties();
  if((p.getProperty('SYNC_KEY')||'').length<32) throw new Error('Set SYNC_KEY in Project Settings first.');
  if(!(p.getProperty('GOOGLE_CLIENT_ID')||'').endsWith('.apps.googleusercontent.com')||!(p.getProperty('ALLOWED_EMAILS')||'').trim())throw new Error('Set GOOGLE_CLIENT_ID and ALLOWED_EMAILS in Script Properties first.');
  var id=p.getProperty('FOLIO_FILE_ID');
  if(!id){var f=DriveApp.createFile('Folio-private-data.json',JSON.stringify({revision:0,data:null}),'application/json');p.setProperty('FOLIO_FILE_ID',f.getId());}
  return 'Ready';
}
function same_(a,b){a=String(a||'');b=String(b||'');var diff=a.length^b.length;for(var i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function allowedUser_(token,p){
  if(!token||String(token).length>5000)throw new Error('Google Sign-In required');
  // Google's tokeninfo endpoint validates the signed ID token; verify audience,
  // verified email, issuer, expiry, and this application's session window here.
  var response=UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(token),{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw new Error('Google session invalid or expired');
  var info=JSON.parse(response.getContentText()),now=Math.floor(Date.now()/1000);
  if(info.aud!==p.getProperty('GOOGLE_CLIENT_ID')||['accounts.google.com','https://accounts.google.com'].indexOf(info.iss)<0||String(info.email_verified)!=='true'||!info.sub||Number(info.exp)<=now)throw new Error('Google identity verification failed');
  var hours=Math.min(24,Math.max(0.25,Number(p.getProperty('SESSION_HOURS')||1)));
  if(!Number.isFinite(Number(info.iat))||Number(info.iat)>now+60||now-Number(info.iat)>hours*3600)throw new Error('Session expired. Sign in again');
  var allow=(p.getProperty('ALLOWED_EMAILS')||'').toLowerCase().split(',').map(function(x){return x.trim();});
  if(allow.indexOf(String(info.email||'').toLowerCase())<0)throw new Error('This Google account is not on the allowlist');
  return info.email;
}
function doPost(e) {
  var lock=LockService.getScriptLock(),locked=false;
  try {
    if(!e.postData||e.postData.contents.length>12000000)throw new Error('Invalid request size');
    var body=JSON.parse(e.postData.contents),p=PropertiesService.getScriptProperties(),secret=p.getProperty('SYNC_KEY');
    if(!secret||secret.length<32||!same_(body.key,secret))return output_({ok:false,message:'Invalid sync key'});
    allowedUser_(body.idToken,p);
    if(body.action!=='read'&&body.action!=='write')throw new Error('Unknown action');
    lock.waitLock(15000);locked=true;
    var id=p.getProperty('FOLIO_FILE_ID');if(!id)throw new Error('Run initialize in the Apps Script editor first.');
    var file=DriveApp.getFileById(id),state=JSON.parse(file.getBlob().getDataAsString());
    if(body.action==='read')return output_({ok:true,revision:state.revision,data:state.data});
    if(body.revision!==state.revision)return output_({ok:false,message:'Sync conflict: another device uploaded changes. Your local data is safe. Export a backup, then download the cloud version.'});
    var d=body.data;
    if(!d||d.version!==1||!Array.isArray(d.lots)||!Array.isArray(d.sales)||!Array.isArray(d.dividends)||d.lots.length>2000)throw new Error('Invalid portfolio');
    // Private previous-version file provides recovery from accidental replacements.
    var old=p.getProperty('FOLIO_PREVIOUS_ID');
    if(old)DriveApp.getFileById(old).setContent(JSON.stringify(state));
    else p.setProperty('FOLIO_PREVIOUS_ID',DriveApp.createFile('Folio-previous-version.json',JSON.stringify(state),'application/json').getId());
    var next={revision:state.revision+1,data:d};file.setContent(JSON.stringify(next));
    return output_({ok:true,revision:next.revision});
  } catch(err){return output_({ok:false,message:String(err.message||err)});} finally {if(locked)lock.releaseLock();}
}
function doGet(e) {
  try {
    var p=e.parameter||{},action=p.action;
    if(action==='ping')return output_({ok:true,app:'folio-fresh',version:2,authRequired:true});
    var path;
    if(action==='chart'){
      var symbol=String(p.symbol||'');if(!/^[A-Za-z0-9.^=_-]{1,40}$/.test(symbol))throw new Error('Invalid symbol');
      var range=['5d','1mo','1y','max'].indexOf(p.range)>=0?p.range:'1y';
      path='/v8/finance/chart/'+encodeURIComponent(symbol)+'?interval=1d&range='+range;
    }else if(action==='search'){
      var q=String(p.q||'').slice(0,100);if(!q)throw new Error('Search term required');
      path='/v1/finance/search?q='+encodeURIComponent(q)+'&quotesCount=15&newsCount=5';
    }else throw new Error('Unknown public route');
    var hash=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,path)),cache=CacheService.getScriptCache(),hit=cache.get(hash);
    if(hit)return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
    var hosts=['https://query1.finance.yahoo.com','https://query2.finance.yahoo.com'];
    for(var i=0;i<hosts.length;i++){
      var r=UrlFetchApp.fetch(hosts[i]+path,{muteHttpExceptions:true,headers:{'User-Agent':'Mozilla/5.0'}});
      if(r.getResponseCode()===200){var text=r.getContentText();JSON.parse(text);if(text.length<90000)cache.put(hash,text,300);return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);}
    }
    throw new Error('Market provider unavailable. Retain the previous price or enter a manual quote.');
  }catch(err){return output_({error:String(err.message||err)});}
}