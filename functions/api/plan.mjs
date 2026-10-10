import { runLocalEngineChain } from './anil-engine-chain.mjs';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};
const cache = new Map();
const clean = value => String(value ?? '').trim();
const keyOf = value => JSON.stringify({text: clean(value.text), language: clean(value.language)}).slice(0,6000);
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:HEADERS});

function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:','https:'].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' ||
        /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url;
  } catch { return null; }
}

async function fetchPublicUrl(value) {
  const url = safeUrl(value);
  if (!url) return {ok:false, error:'url_not_allowed'};
  try {
    const response = await fetch(url, {
      redirect:'manual',
      signal:AbortSignal.timeout(4500),
      headers:{'user-agent':'ANIL-X-Independent-Research/2.0'}
    });
    if (response.status >= 300 && response.status < 400) {
      return {ok:false,status:response.status,error:'redirect_not_followed_for_safety'};
    }
    const type = response.headers.get('content-type') || '';
    const raw = (await response.text()).slice(0,20000);
    const body = type.includes('html')
      ? raw.replace(/<script[\s\S]*?<\/script>/gi,' ')
           .replace(/<style[\s\S]*?<\/style>/gi,' ')
           .replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,7000)
      : raw.slice(0,7000);
    return {ok:response.ok,status:response.status,url:url.href,
      title:(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').trim().slice(0,160),
      contentType:type,body};
  } catch (error) {
    return {ok:false,error:String(error?.message||error).slice(0,180)};
  }
}

async function webSearch(env, query) {
  const q = clean(query).slice(0,400);
  if (!q) return {ok:false,error:'missing_query'};
  try {
    if (env.TAVILY_API_KEY) {
      const response = await fetch('https://api.tavily.com/search', {
        method:'POST', signal:AbortSignal.timeout(5000),
        headers:{'content-type':'application/json'},
        body:JSON.stringify({api_key:env.TAVILY_API_KEY,query:q,max_results:5,search_depth:'basic'})
      });
      return {ok:response.ok,provider:'tavily',status:response.status,
        data:response.ok ? await response.json().catch(()=>null) : null};
    }
    if (env.BRAVE_SEARCH_API_KEY) {
      const response = await fetch('https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(q)+'&count=5', {
        signal:AbortSignal.timeout(5000),
        headers:{accept:'application/json','X-Subscription-Token':env.BRAVE_SEARCH_API_KEY}
      });
      return {ok:response.ok,provider:'brave',status:response.status,
        data:response.ok ? await response.json().catch(()=>null) : null};
    }
    return {ok:false,error:'web_search_not_configured'};
  } catch (error) {
    return {ok:false,error:String(error?.message||error).slice(0,180)};
  }
}

function isSearchIntent(text) {
  return /\b(latest|today|news|current|price|research|search|compare|verify|source)\b|تحقیق|جستجو|جدیدترین|امروز|قیمت|اخبار|راستی.?آزمایی|منبع|مقایسه/i.test(text);
}

export async function handlePlan(request, env={}) {
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:HEADERS});
  if (request.method !== 'POST') return json({ok:false,error:'method_not_allowed'},405);
  try {
    const body = await request.json();
    const requestText = clean(body?.text || body?.request || body?.prompt);
    if (!requestText) return json({ok:false,error:'missing_request'},400);

    const cacheKey = keyOf({text:requestText,language:body?.language});
    const cached = cache.get(cacheKey);
    if (cached && Date.now()-cached.time < 12000) {
      return json({...cached.value,cached:true});
    }

    // First-party deterministic specialist council. No external model request is required.
    const council = runLocalEngineChain(requestText);
    const urls = [...requestText.matchAll(/https?:\/\/[^\s<>"']+/g)]
      .map(match=>match[0].replace(/[),.;]+$/,'')).slice(0,2);
    const needsSearch = isSearchIntent(requestText);
    const [urlResults, searchResult] = await Promise.all([
      Promise.all(urls.map(fetchPublicUrl)),
      needsSearch ? webSearch(env,requestText) : Promise.resolve(null)
    ]);

    const successfulUrls = urlResults.filter(item=>item.ok).length;
    const toolEvidence = [];
    if (urlResults.length) toolEvidence.push({
      tool:'public_url_fetch',attempted:urlResults.length,successful:successfulUrls,results:urlResults
    });
    if (searchResult) toolEvidence.push({
      tool:'web_search',attempted:true,ok:!!searchResult.ok,
      provider:searchResult.provider||null,error:searchResult.error||null,
      data:searchResult.data||null
    });

    const toolWorked = urlResults.some(item=>item.ok) || !!searchResult?.ok;
    const evidenceNote = toolEvidence.length
      ? (toolWorked
          ? 'ابزارهای خواندنی اجرا شدند؛ داده خام در بخش evidence موجود است و باید قبل از نتیجه‌گیری بررسی شود.'
          : 'تلاش برای استفاده از ابزار انجام شد اما منبع قابل‌دسترسی به دست نیامد؛ پاسخ نباید به‌عنوان تحقیق زنده تلقی شود.')
      : 'برای این درخواست ابزار بیرونی اجرا نشد.';
    const result = {
      ok:true,
      source:'anil-independent-specialist-council',
      engine:'ANIL-INDEPENDENT-ENGINE-COUNCIL',
      version:'2.0.0',
      orchestrator:'anil-core',
      reviewer:'independent-qa-pending-execution',
      research:searchResult?.ok ? searchResult.provider : 'internal',
      specialists:{
        core:{live:true,provider:'first-party-deterministic'},
        planner:{live:true,provider:'first-party-deterministic'},
        security:{live:true,provider:'first-party-deterministic'},
        qa:{live:true,provider:'first-party-deterministic',status:'verification-required'},
        vision:{live:false,endpoint:'/api/vision'},
        voice:{live:false,endpoint:'/api/voice'}
      },
      router:{
        selected:council.selectedEngine,
        providerErrors:[],
        externalModelsCalled:false,
        tools:{
          urls:urls.length,used:toolWorked,webSearch:!!searchResult?.ok,
          searchProvider:searchResult?.provider||null,
          evidenceCount:toolEvidence.length
        }
      },
      plan:council.plan,
      execution:{
        performed:false,status:'not_executed',
        reason:'planning and read-only research do not authorize code changes, payments, claims, transfers, or production deployment'
      },
      orchestration:{
        ...council.orchestration,
        providerIndependent:true,
        externalProviderRequired:false,
        externalModelsCalled:false,
        toolEvidence:toolEvidence.length>0,
        evidenceNote
      },
      engineChain:council.chain,
      council:council.specialists,
      evidence:toolEvidence,
      reply:council.reply+' '+evidenceNote,
      text:council.reply+' '+evidenceNote,
      answer:council.reply+' '+evidenceNote,
      confidence:toolWorked ? Math.min(.9,council.confidence+.04) : council.confidence
    };
    cache.set(cacheKey,{time:Date.now(),value:result});
    while(cache.size>40) cache.delete(cache.keys().next().value);
    return json(result);
  } catch (error) {
    return json({ok:false,error:'plan_failed',detail:String(error?.message||error).slice(0,180)},500);
  }
}
