(() => {
  if (globalThis.__jobPilotProfileOptimizerLoaded) return;
  globalThis.__jobPilotProfileOptimizerLoaded = true;

  const host = location.hostname.toLowerCase();
  const path = location.pathname.toLowerCase();

  function portalName() {
    if (host.includes("naukri")) return "naukri";
    if (host.includes("foundit")) return "foundit";
    if (host.includes("linkedin")) return "linkedin";
    if (host.includes("indeed")) return "indeed";
    if (host.includes("hirist")) return "hirist";
    return "";
  }

  function likelyProfilePage() {
    if (/job-listings|\/jobs(?:\/|$)|jobfeed|search/.test(path)) return false;
    if (/profile|resume|my-profile|candidate|career-profile|\/in\//.test(path)) return true;

    const title = (document.title || "").toLowerCase();
    const body = (document.body?.innerText || "").slice(0,5000).toLowerCase();
    return /profile|resume/.test(title) && /skills|experience|employment|about/.test(body);
  }

  if (!likelyProfilePage()) return;

  const id = "jobpilot-profile-optimizer";
  if (document.getElementById(id)) return;

  const root = document.createElement("div");
  root.id = id;
  root.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483646;font-family:Inter,Arial,sans-serif";
  const shadow = root.attachShadow({mode:"open"});

  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box}
      .wrap{width:340px;background:#07111c;color:#edf5ff;border:1px solid #233a52;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.35);overflow:hidden}
      .head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #203247;background:#0a1523}
      .brand{font-weight:800}.brand b{color:#69f0a8}.close{border:0;background:#142235;color:#cfe0f2;width:30px;height:30px;border-radius:9px;cursor:pointer}
      .body{padding:15px}.intro{font-size:12px;line-height:1.55;color:#aebed0;margin:0 0 12px}
      .run{width:100%;border:0;border-radius:11px;padding:12px;background:#69f0a8;color:#04120a;font-weight:800;cursor:pointer}
      .run:disabled{opacity:.55;cursor:wait}.score{display:flex;align-items:end;gap:8px;margin:5px 0 10px}.score strong{font-size:40px;line-height:1;color:#69f0a8}.score span{font-size:13px;color:#aebed0;padding-bottom:4px}
      .label{font-weight:800;margin-bottom:12px}.box{background:#0c1928;border:1px solid #223852;border-radius:12px;padding:11px;margin-top:10px}
      .box h4{margin:0 0 7px;font-size:12px;color:#8fa7bf;text-transform:uppercase;letter-spacing:.06em}.box p{margin:0;font-size:12px;line-height:1.5}
      ul{margin:7px 0 0;padding-left:17px}li{font-size:12px;line-height:1.5;margin:5px 0;color:#d9e5f1}.warn{color:#ffd27d}.muted{font-size:11px;color:#8ba0b5;margin-top:10px}
    </style>
    <div class="wrap">
      <div class="head"><div class="brand"><b>JOBPILOT</b> Profile Optimizer</div><button class="close" title="Close">×</button></div>
      <div class="body">
        <p class="intro">Compare this visible profile with your saved JobPilot profile, applied-job history and recurring skill gaps.</p>
        <button class="run">Scan my profile</button>
        <div class="result"></div>
      </div>
    </div>
  `;

  document.documentElement.appendChild(root);
  shadow.querySelector(".close").addEventListener("click",()=>root.remove());

  const btn=shadow.querySelector(".run");
  const result=shadow.querySelector(".result");

  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

  btn.addEventListener("click", async()=>{
    btn.disabled=true; btn.textContent="Analyzing…"; result.innerHTML="";
    try{
      const raw=(document.body?.innerText||"").replace(/\s+/g," ").trim().slice(0,30000);
      const response=await chrome.runtime.sendMessage({
        type:"jobpilot:profile-optimize",
        page:{portal:portalName(),url:location.href,title:document.title,text:raw}
      });
      if(!response?.ok) throw new Error(response?.error||"Profile scan failed.");
      const r=response.result;
      result.innerHTML=`
        <div class="score"><strong>${esc(r.score)}/100</strong><span>profile coverage</span></div>
        <div class="label">${esc(r.label)}</div>
        <div class="box"><h4>Suggested headline</h4><p>${esc(r.suggestedHeadline||"Keep your current headline if it is already specific.")}</p></div>
        <div class="box"><h4>Best improvements</h4><ul>${(r.ideas||[]).slice(0,5).map(x=>`<li>${esc(x)}</li>`).join("")||"<li>No major wording issue detected.</li>"}</ul></div>
        <div class="box"><h4>Recurring JD keywords missing here</h4><ul>${(r.frequentMissing||[]).slice(0,8).map(x=>`<li>${esc(x.skill)} <span class="warn">(${esc(x.count)} applied jobs)</span></li>`).join("")||"<li>Good coverage of recurring job keywords.</li>"}</ul></div>
        <div class="box"><h4>Learning / verify first</h4><ul>${(r.learningTargets||[]).slice(0,6).map(x=>`<li>${esc(x.value)} <span class="warn">(${esc(x.count)} recent jobs)</span></li>`).join("")||"<li>No recurring skill-gap signal yet.</li>"}</ul></div>
        <p class="muted">This is a profile keyword/coverage score, not a recruiter-search ranking. Add only skills and claims you can genuinely support.</p>
      `;
    }catch(e){result.innerHTML=`<div class="box"><p class="warn">${esc(e?.message||String(e))}</p></div>`;}
    finally{btn.disabled=false;btn.textContent="Scan again";}
  });
})();