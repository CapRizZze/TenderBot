const fs = require('fs');
const envText = fs.readFileSync('.env', 'utf8');
function env(name) {
  const m = envText.match(new RegExp(`^${name}="?([^"\r\n]+)"?$`, 'm'));
  if (!m) throw new Error(`Missing env ${name}`);
  return m[1];
}
const AUTH_URL = env('SABY_AUTH_URL');
const TENDER_API_URL = env('SABY_TENDER_API_URL');
const LOGIN = env('SABY_LOGIN');
const PASSWORD = env('SABY_PASSWORD');
async function post(url, body, sid) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (sid) {
    headers['Cookie'] = `sid=${sid}`;
    headers['X-SBISSessionID'] = sid;
    headers['Origin'] = 'https://trade.saby.ru';
    headers['Referer'] = 'https://trade.saby.ru/page/tenders-subscriptions';
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`Non-JSON response from ${url}: ${text.slice(0,300)}`); }
}
function normalizeStats(result) {
  const dayLimit = Number(result?.day_limit ?? result?.dayLimit ?? result?.limit ?? 0);
  const dayCounter = Number(result?.day_counter ?? result?.dayCounter ?? result?.count ?? 0);
  const dayRemaining = Number(result?.day_remaining ?? result?.dayRemaining ?? Math.max(dayLimit - dayCounter, 0));
  return { dayLimit, dayCounter, dayRemaining, raw: result };
}
(async () => {
  const auth = await post(AUTH_URL, { jsonrpc: '2.0', method: 'СБИС.Аутентифицировать', params: { Параметр: { Логин: LOGIN, Пароль: PASSWORD } }, id: 'auth-1' });
  const sid = auth?.result;
  if (!sid) throw new Error('SID not found');
  async function getStats(label) {
    const res = await post(TENDER_API_URL, { jsonrpc: '2.0', protocol: 4, method: 'SbisTenderAPI.GetStatistics', params: {}, id: `stats-${label}` }, sid);
    if (res.error) throw new Error(`GetStatistics failed at ${label}: ${JSON.stringify(res.error)}`);
    const stats = normalizeStats(res.result);
    console.log(label + ' ' + JSON.stringify(stats));
    return stats;
  }
  async function callTrade(label, body) {
    const res = await post('https://trade.saby.ru/tender/service/?x_version=26.3202-36.4', body, sid);
    console.log(label + '_RESULT ' + JSON.stringify(res).slice(0,500));
    return res;
  }
  await getStats('before');
  await callTrade('query_list', { jsonrpc: '2.0', protocol: 7, method: 'Query.query_list', params: { 'Фильтр': { d: [false, 854874, true, true, 1, true], s: [{ t: 'Логическое', n: 'is_new_rp' }, { t: 'Число целое', n: 'parent' }, { t: 'Логическое', n: 'show_interesting_comp' }, { t: 'Логическое', n: 'show_our_industry' }, { t: 'Число целое', n: 'tenderType' }, { t: 'Логическое', n: 'user_folders_first' }], _type: 'record', f: 0 }, 'Сортировка': null, 'Навигация': { d: [true, 100, 0], s: [{ t: 'Логическое', n: 'ЕстьЕще' }, { t: 'Число целое', n: 'РазмерСтраницы' }, { t: 'Число целое', n: 'Страница' }], _type: 'record', f: 0 }, 'ДопПоля': [] }, id: 1 });
  await getStats('after_query_list');
  await callTrade('get_query', { jsonrpc: '2.0', protocol: 7, method: 'Query.GetQuery', params: { query_id: -1398341 }, id: 1 });
  await getStats('after_get_query');
  const payload = JSON.parse(fs.readFileSync('tmp-tender-getlist-live.json','utf8'));
  const res = await post('https://trade.saby.ru/service/?x_version=26.3202-36.4', payload, sid);
  console.log('tender_get_list_RESULT ' + JSON.stringify({ count: res?.result?.r?.d?.[0], firstId: res?.result?.d?.[0]?.[0] }));
  await getStats('after_tender_get_list');
})();
