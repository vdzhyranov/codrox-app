import { useState } from “react”;

const S = `
@import url(‘https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&family=Syne:wght@400;500;600;700;800&display=swap’);
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
–bg:#0a0a0b;–surface:#111113;–surface2:#18181c;–surface3:#1f1f25;
–border:#2a2a32;–border2:#353540;
–accent:#7c6af7;–accent2:#a78bfa;–accent-dim:rgba(124,106,247,0.13);
–green:#3ecf8e;–green-dim:rgba(62,207,142,0.11);
–amber:#f59e0b;–amber-dim:rgba(245,158,11,0.11);
–red:#f87171;–red-dim:rgba(248,113,113,0.11);
–blue:#60a5fa;–blue-dim:rgba(96,165,250,0.11);
–pink:#f472b6;–pink-dim:rgba(244,114,182,0.11);
–text:#e4e4f0;–text2:#8b8b9e;–text3:#555568;
–mono:‘Geist Mono’,monospace;–sans:‘Syne’,sans-serif;
}
body{background:var(–bg);color:var(–text);font-family:var(–mono);overflow:hidden;}
.app{display:flex;flex-direction:column;height:100vh;width:100vw;}

/* TITLEBAR */
.tb{height:40px;display:flex;align-items:center;justify-content:space-between;
padding:0 16px;background:var(–bg);border-bottom:1px solid var(–border);flex-shrink:0;}
.tb-logo{display:flex;align-items:center;gap:8px;}
.tb-logo-mark{color:var(–accent);}
.tb-name{font-family:var(–sans);font-weight:700;font-size:14px;letter-spacing:.05em;}
.tb-name em{color:var(–accent2);font-style:normal;}
.tb-pills{display:flex;gap:6px;}
.tb-pill{font-size:10px;padding:3px 10px;border-radius:20px;border:1px solid var(–border);
color:var(–text3);cursor:pointer;transition:all .15s;}
.tb-pill:hover{color:var(–text2);border-color:var(–border2);}
.tb-pill.active{background:var(–accent-dim);color:var(–accent2);border-color:rgba(124,106,247,.3);}

/* LAYOUT */
.layout{display:flex;flex:1;overflow:hidden;}

/* WORKTREE SIDEBAR */
.wt-sidebar{width:220px;flex-shrink:0;background:var(–surface);border-right:1px solid var(–border);
display:flex;flex-direction:column;overflow:hidden;}
.wt-header{padding:12px 14px;border-bottom:1px solid var(–border);}
.wt-header-row{display:flex;align-items:center;justify-content:space-between;}
.wt-label{font-size:9px;font-weight:600;letter-spacing:.12em;color:var(–text3);text-transform:uppercase;}
.add-wt{font-size:18px;color:var(–text3);background:none;border:none;cursor:pointer;
line-height:1;transition:color .12s;padding:0 2px;}
.add-wt:hover{color:var(–accent2);}
.wt-list{flex:1;overflow-y:auto;padding:8px;}
.wt-list::-webkit-scrollbar{width:3px;}
.wt-list::-webkit-scrollbar-thumb{background:var(–border2);border-radius:2px;}
.wt-item{border-radius:8px;padding:10px 10px;cursor:pointer;transition:all .12s;
margin-bottom:4px;border:1px solid transparent;}
.wt-item:hover{background:var(–surface2);}
.wt-item.sel{background:var(–accent-dim);border-color:rgba(124,106,247,.25);}
.wt-item-top{display:flex;align-items:center;gap:7px;margin-bottom:5px;}
.wt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.wt-item-name{font-size:12px;color:var(–text);font-weight:500;flex:1;
overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.wt-phase-mini{font-size:8px;padding:1px 5px;border-radius:2px;font-weight:700;
letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;}
.wt-branch{font-size:10px;color:var(–text3);}
.wt-progress-track{height:2px;background:var(–border);border-radius:1px;overflow:hidden;margin-top:6px;}
.wt-progress-fill{height:100%;border-radius:1px;transition:width .4s;}

/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;}

/* LIFECYCLE HEADER */
.lc-header{background:var(–surface);border-bottom:1px solid var(–border);flex-shrink:0;padding:0;}
.lc-feature-row{display:flex;align-items:center;justify-content:space-between;
padding:10px 20px;border-bottom:1px solid var(–border);}
.lc-feature-name{font-family:var(–sans);font-size:14px;font-weight:700;color:var(–text);}
.lc-feature-branch{font-size:10px;color:var(–text3);margin-top:2px;}
.lc-feature-branch span{color:var(–accent2);}
.lc-actions{display:flex;gap:6px;}
.lc-btn{padding:6px 14px;border-radius:5px;font-size:11px;font-family:var(–mono);
cursor:pointer;transition:all .12s;border:1px solid var(–border);
background:var(–surface2);color:var(–text2);}
.lc-btn:hover{border-color:var(–border2);color:var(–text);}
.lc-btn.primary{background:var(–accent);border-color:var(–accent);color:white;}
.lc-btn.primary:hover{background:var(–accent2);border-color:var(–accent2);}
.lc-btn.danger{background:var(–red-dim);border-color:rgba(248,113,113,.3);color:var(–red);}

/* PHASE TRACK */
.phase-track{display:flex;align-items:stretch;padding:0 20px;gap:0;overflow-x:auto;
scrollbar-width:none;height:52px;}
.phase-track::-webkit-scrollbar{display:none;}
.phase-node{display:flex;align-items:center;gap:0;flex-shrink:0;cursor:pointer;}
.phase-step{display:flex;flex-direction:column;align-items:center;justify-content:center;
padding:0 14px;height:52px;transition:all .15s;position:relative;gap:3px;}
.phase-step:hover .phase-step-label{color:var(–text2);}
.phase-step-icon{font-size:14px;line-height:1;}
.phase-step-label{font-size:9px;letter-spacing:.08em;text-transform:uppercase;
font-weight:600;white-space:nowrap;transition:color .15s;}
.phase-step.done .phase-step-label{color:var(–green);}
.phase-step.active .phase-step-label{color:var(–text);}
.phase-step.upcoming .phase-step-label{color:var(–text3);}
.phase-step.active::after{content:’’;position:absolute;bottom:0;left:0;right:0;
height:2px;border-radius:2px 2px 0 0;}
.phase-connector{width:24px;display:flex;align-items:center;justify-content:center;
flex-shrink:0;}
.phase-connector-line{height:1px;width:100%;background:var(–border2);}
.phase-connector-line.done{background:var(–green);opacity:.4;}

/* CONTENT */
.content{flex:1;display:flex;overflow:hidden;}

/* PHASE PANEL */
.phase-panel{flex:1;display:flex;flex-direction:column;overflow:hidden;}
.phase-body{flex:1;overflow-y:auto;padding:24px;}
.phase-body::-webkit-scrollbar{width:3px;}
.phase-body::-webkit-scrollbar-thumb{background:var(–border2);border-radius:2px;}

/* SECTION BLOCKS */
.section{margin-bottom:24px;}
.section-title{font-family:var(–sans);font-size:11px;font-weight:700;letter-spacing:.1em;
text-transform:uppercase;color:var(–text3);margin-bottom:10px;display:flex;
align-items:center;gap:8px;}
.section-title::after{content:’’;flex:1;height:1px;background:var(–border);}

/* PROPOSAL */
.proposal-card{background:var(–surface);border:1px solid var(–border);border-radius:10px;
padding:18px 20px;transition:border-color .15s;}
.proposal-card:hover{border-color:var(–border2);}
.proposal-field{margin-bottom:16px;}
.pf-label{font-size:9px;color:var(–text3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;}
.pf-text{font-size:12px;color:var(–text);line-height:1.65;}
.pf-textarea{width:100%;background:var(–surface2);border:1px solid var(–border);border-radius:6px;
padding:10px 12px;color:var(–text);font-family:var(–mono);font-size:12px;outline:none;
resize:vertical;min-height:80px;transition:border-color .15s;line-height:1.6;}
.pf-textarea:focus{border-color:var(–accent);}
.pf-textarea::placeholder{color:var(–text3);}
.pf-input{width:100%;background:var(–surface2);border:1px solid var(–border);border-radius:6px;
padding:9px 12px;color:var(–text);font-family:var(–mono);font-size:12px;outline:none;
transition:border-color .15s;}
.pf-input:focus{border-color:var(–accent);}
.pf-input::placeholder{color:var(–text3);}

/* GRILL */
.grill-msg{display:flex;gap:12px;margin-bottom:16px;}
.grill-avatar{width:30px;height:30px;border-radius:7px;flex-shrink:0;display:flex;
align-items:center;justify-content:center;font-size:13px;}
.grill-body{flex:1;}
.grill-role{font-size:9px;color:var(–text3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;}
.grill-text{font-size:12px;color:var(–text);line-height:1.65;background:var(–surface);
border:1px solid var(–border);border-radius:8px;padding:12px 14px;}
.grill-text.challenge{border-left:3px solid var(–red);background:var(–red-dim);}
.grill-text.user{border-left:3px solid var(–accent);background:var(–accent-dim);}
.grill-score{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
.score-chip{padding:4px 12px;border-radius:20px;font-size:10px;font-weight:600;}

/* RESEARCH */
.research-finding{background:var(–surface);border:1px solid var(–border);border-radius:8px;
padding:14px 16px;margin-bottom:10px;}
.rf-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.rf-type{font-size:9px;padding:2px 7px;border-radius:2px;font-weight:700;letter-spacing:.06em;
text-transform:uppercase;}
.rf-title{font-size:12px;color:var(–text);font-weight:500;}
.rf-body{font-size:11px;color:var(–text2);line-height:1.6;}
.rf-source{font-size:10px;color:var(–text3);margin-top:6px;}
.rf-source code{color:var(–accent2);}

/* PLAN */
.plan-task{background:var(–surface);border:1px solid var(–border);border-radius:8px;
padding:12px 14px;margin-bottom:8px;cursor:pointer;transition:all .15s;}
.plan-task:hover{border-color:var(–border2);}
.plan-task.expanded{border-color:rgba(124,106,247,.3);background:var(–accent-dim);}
.pt-header{display:flex;align-items:center;gap:10px;}
.pt-num{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;
font-size:10px;font-weight:700;flex-shrink:0;}
.pt-title{font-size:12px;color:var(–text);flex:1;}
.pt-file{font-size:10px;color:var(–text3);}
.pt-expand{font-size:10px;color:var(–text3);transition:transform .15s;}
.pt-expand.open{transform:rotate(90deg);}
.pt-detail{margin-top:10px;padding-top:10px;border-top:1px solid var(–border);
font-size:11px;color:var(–text2);line-height:1.6;}
.pt-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;}
.pt-tag{font-size:9px;padding:2px 8px;border-radius:3px;border:1px solid var(–border);color:var(–text3);}

/* IMPLEMENT */
.impl-task{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;
background:var(–surface);border:1px solid var(–border);margin-bottom:8px;}
.impl-check{width:18px;height:18px;border-radius:4px;flex-shrink:0;display:flex;
align-items:center;justify-content:center;font-size:10px;}
.impl-check.done{background:var(–green-dim);border:1px solid rgba(62,207,142,.3);color:var(–green);}
.impl-check.active{background:var(–amber-dim);border:1px solid rgba(245,158,11,.3);color:var(–amber);
animation:spin 2s linear infinite;}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.impl-check.todo{background:var(–surface2);border:1px solid var(–border);}
.impl-task-name{flex:1;font-size:12px;}
.impl-task-name.done{color:var(–text3);text-decoration:line-through;}
.impl-task-name.active{color:var(–text);}
.impl-task-name.todo{color:var(–text3);}
.impl-lines{font-size:10px;color:var(–text3);}
.impl-log{background:var(–bg);border:1px solid var(–border);border-radius:8px;
padding:14px 16px;font-size:11px;line-height:1.8;max-height:160px;overflow-y:auto;}
.impl-log::-webkit-scrollbar{width:3px;}
.impl-log::-webkit-scrollbar-thumb{background:var(–border2);}
.log-line{color:var(–text3);}
.log-line .ts{color:var(–text3);margin-right:8px;}
.log-line .act{color:var(–green);}
.log-line .file{color:var(–accent2);}
.log-line .warn{color:var(–amber);}

/* VERIFY */
.verify-item{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;
border-radius:8px;background:var(–surface);border:1px solid var(–border);margin-bottom:8px;}
.vi-status{font-size:14px;flex-shrink:0;margin-top:1px;}
.vi-body{flex:1;}
.vi-name{font-size:12px;color:var(–text);margin-bottom:3px;}
.vi-detail{font-size:11px;color:var(–text3);line-height:1.5;}
.vi-action{font-size:10px;padding:4px 10px;border-radius:4px;border:1px solid var(–border);
background:var(–surface2);color:var(–text3);cursor:pointer;font-family:var(–mono);
transition:all .12s;white-space:nowrap;flex-shrink:0;}
.vi-action:hover{border-color:var(–border2);color:var(–text);}

/* SIDE PANEL */
.side-panel{width:280px;flex-shrink:0;background:var(–surface);border-left:1px solid var(–border);
display:flex;flex-direction:column;overflow:hidden;}
.sp-header{padding:12px 14px;border-bottom:1px solid var(–border);
font-family:var(–sans);font-size:12px;font-weight:600;color:var(–text);}
.sp-body{flex:1;overflow-y:auto;padding:12px;}
.sp-body::-webkit-scrollbar{width:3px;}
.sp-body::-webkit-scrollbar-thumb{background:var(–border2);border-radius:2px;}

/* CHAT */
.chat-msg{display:flex;gap:8px;margin-bottom:12px;}
.chat-avatar{width:24px;height:24px;border-radius:5px;flex-shrink:0;
display:flex;align-items:center;justify-content:center;font-size:10px;}
.chat-bubble{font-size:11px;color:var(–text2);line-height:1.55;
background:var(–surface2);border:1px solid var(–border);border-radius:6px;
padding:8px 10px;flex:1;}
.chat-bubble.ai-bubble{border-left:2px solid var(–accent);}
.chat-input-wrap{padding:10px 12px;border-top:1px solid var(–border);flex-shrink:0;}
.chat-input{width:100%;background:var(–surface2);border:1px solid var(–border);border-radius:6px;
padding:8px 10px;color:var(–text);font-family:var(–mono);font-size:11px;outline:none;
transition:border-color .15s;}
.chat-input:focus{border-color:var(–accent);}
.chat-input::placeholder{color:var(–text3);}

/* PHASE FOOTER */
.phase-footer{padding:14px 20px;border-top:1px solid var(–border);background:var(–surface);
display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.pf-status{font-size:11px;color:var(–text3);}
.pf-status span{color:var(–text);}
.pf-btns{display:flex;gap:8px;}

/* MISC */
.badge{font-size:9px;padding:2px 7px;border-radius:3px;font-weight:700;
letter-spacing:.06em;text-transform:uppercase;}
.tag-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}
.tag{font-size:10px;padding:3px 9px;border-radius:4px;border:1px solid var(–border);color:var(–text3);}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.pulse{animation:pulse 2s infinite;}
`;

// ─── PHASE CONFIG ───────────────────────────────────────────────
const PHASES = [
{ id: “propose”,   label: “Propose”,    icon: “◈”,  color: “#a78bfa”, colorDim: “rgba(167,139,250,.12)” },
{ id: “grill”,     label: “Grill”,      icon: “⚡”,  color: “#f87171”, colorDim: “rgba(248,113,113,.12)” },
{ id: “research”,  label: “Research”,   icon: “⊡”,  color: “#60a5fa”, colorDim: “rgba(96,165,250,.12)”  },
{ id: “plan”,      label: “Plan”,       icon: “≡”,  color: “#f59e0b”, colorDim: “rgba(245,158,11,.12)”  },
{ id: “implement”, label: “Implement”,  icon: “⟩”,  color: “#3ecf8e”, colorDim: “rgba(62,207,142,.12)”  },
{ id: “verify”,    label: “Verify”,     icon: “✓”,  color: “#3ecf8e”, colorDim: “rgba(62,207,142,.12)”  },
];

const PHASE_IDX = Object.fromEntries(PHASES.map((p, i) => [p.id, i]));

// ─── WORKTREES ───────────────────────────────────────────────────
const WORKTREES_INIT = [
{ id: 1, name: “feat/auth-v2”,       branch: “feat/auth-v2”,         phase: “implement”, progress: 72, color: “#3ecf8e” },
{ id: 2, name: “feat/dashboard”,     branch: “feat/dashboard-rewrite”,phase: “plan”,      progress: 45, color: “#f59e0b” },
{ id: 3, name: “feat/search”,        branch: “feat/full-text-search”, phase: “grill”,     progress: 20, color: “#f87171” },
{ id: 4, name: “fix/perf”,           branch: “fix/query-perf”,        phase: “research”,  progress: 35, color: “#60a5fa” },
];

// ─── PHASE CONTENT ───────────────────────────────────────────────
function PhasePropose({ onAdvance }) {
return (
<div className="phase-body">
<div className="section">
<div className="section-title">Feature Brief</div>
<div className="proposal-card">
<div className="proposal-field">
<div className="pf-label">Feature Name</div>
<input className="pf-input" defaultValue="JWT Authentication with Refresh Tokens" />
</div>
<div className="proposal-field">
<div className="pf-label">Problem Statement</div>
<textarea className="pf-textarea" defaultValue="Currently users get logged out when their access token expires (1h), creating friction. We need a silent refresh mechanism that keeps users logged in without requiring re-authentication, while still allowing instant revocation." />
</div>
<div className="proposal-field">
<div className="pf-label">Proposed Solution</div>
<textarea className="pf-textarea" defaultValue="Implement a dual-token strategy: short-lived JWT (15min) + long-lived refresh token (7d) stored in httpOnly cookies. On 401, client silently calls /api/auth/refresh. Refresh tokens stored in DB to allow server-side revocation." />
</div>
<div className="proposal-field">
<div className="pf-label">Success Criteria</div>
<textarea className="pf-textarea" rows={3} defaultValue="- Users stay logged in for 7 days without interaction&#10;- Logout invalidates all sessions immediately&#10;- Zero failed UX due to token expiry" />
</div>
<div style={{display:“flex”,gap:8}}>
<div className="tag">security</div>
<div className="tag">auth</div>
<div className="tag">backend</div>
<div className="tag">medium complexity</div>
</div>
</div>
</div>
<div className="section">
<div className="section-title">Open Questions</div>
<div className="proposal-card">
<div className="proposal-field">
<div className="pf-label">Blockers / Unknowns</div>
<textarea className="pf-textarea" placeholder="Anything you're unsure about or that needs answering before proceeding..." defaultValue="- Where to store refresh tokens — Redis vs Postgres? Need to think about scale.&#10;- Do we need token family tracking to detect refresh token reuse attacks?&#10;- Current session handling in middleware might conflict" />
</div>
</div>
</div>
</div>
);
}

function PhaseGrill({ onAdvance }) {
const exchanges = [
{ role: “ai”, text: “Why does the refresh token need to be 7 days? What’s the business justification vs the security tradeoff of a longer-lived credential sitting in a cookie?” },
{ role: “user”, text: “Users complained about being logged out. 7d matches competitor UX. We could make it configurable per user-tier.” },
{ role: “ai”, text: “If a refresh token is stolen and you’re storing them in Postgres — what’s your revocation latency? A table scan on every request won’t scale. Have you considered a bloom filter or a short-lived revocation list?” },
{ role: “user”, text: “Good catch. We’d index by token hash. But you’re right — at scale we’d want Redis with TTL-based expiry. I’ll add that as a phase-2 note.” },
{ role: “ai”, text: “The proposal says ‘httpOnly cookies’ but your existing /api routes use Authorization headers. How are you handling the migration for existing mobile clients that can’t use cookies?” },
];

const scores = [
{ label: “Clarity”, val: 8, color: “#3ecf8e” },
{ label: “Completeness”, val: 6, color: “#f59e0b” },
{ label: “Risk Awareness”, val: 5, color: “#f87171” },
{ label: “Feasibility”, val: 8, color: “#3ecf8e” },
];

return (
<div className="phase-body">
<div className="section">
<div className="section-title">Adversarial Review</div>
<div style={{marginBottom:8,padding:“8px 12px”,background:“var(–red-dim)”,border:“1px solid rgba(248,113,113,.2)”,borderRadius:8,fontSize:11,color:“var(–red)”}}>
⚡ Grill mode active — Claude is stress-testing your proposal. Defend your choices or revise them.
</div>
{exchanges.map((m, i) => (
<div key={i} className="grill-msg">
<div className=“grill-avatar” style={{
background: m.role===“ai” ? “var(–red-dim)” : “var(–accent-dim)”,
border: `1px solid ${m.role==="ai" ? "rgba(248,113,113,.3)" : "rgba(124,106,247,.3)"}`,
color: m.role===“ai” ? “var(–red)” : “var(–accent2)”
}}>{m.role===“ai” ? “⚡” : “U”}</div>
<div className="grill-body">
<div className="grill-role">{m.role===“ai” ? “CLAUDE / CHALLENGE” : “YOU / DEFENSE”}</div>
<div className={`grill-text ${m.role==="ai" ? "challenge" : "user"}`}>{m.text}</div>
</div>
</div>
))}
</div>
<div className="section">
<div className="section-title">Proposal Scores</div>
<div style={{display:“flex”,gap:10,flexWrap:“wrap”}}>
{scores.map(s => (
<div key={s.label} style={{flex:“1 1 120px”,background:“var(–surface)”,border:“1px solid var(–border)”,borderRadius:8,padding:“12px 14px”}}>
<div style={{fontSize:10,color:“var(–text3)”,marginBottom:6}}>{s.label}</div>
<div style={{display:“flex”,alignItems:“baseline”,gap:4}}>
<span style={{fontFamily:“var(–sans)”,fontSize:22,fontWeight:700,color:s.color}}>{s.val}</span>
<span style={{fontSize:10,color:“var(–text3)”}}>/10</span>
</div>
<div style={{height:3,background:“var(–border)”,borderRadius:2,marginTop:8,overflow:“hidden”}}>
<div style={{height:“100%”,width:`${s.val*10}%`,background:s.color,borderRadius:2}}/>
</div>
</div>
))}
</div>
<div style={{marginTop:12,padding:“10px 14px”,background:“var(–amber-dim)”,border:“1px solid rgba(245,158,11,.2)”,borderRadius:8,fontSize:11,color:“var(–amber)”,lineHeight:1.6}}>
⚠ Open issue: Mobile client cookie strategy unresolved. Recommend addressing before moving to Research.
</div>
</div>
</div>
);
}

function PhaseResearch({ onAdvance }) {
const findings = [
{ type: “PATTERN”, typeColor:”#60a5fa”, typeDim:“var(–blue-dim)”,
title: “Existing auth middleware in src/middleware.ts”,
body: “Current JWT verification runs on every request via next/server middleware. Switching to 15min tokens means this will fire ~4x more refresh cycles per user session. Need to optimize the verify path or cache decoded tokens per request.”,
source: “src/middleware.ts:14–38” },
{ type: “RISK”, typeColor:”#f87171”, typeDim:“var(–red-dim)”,
title: “Prisma schema missing tokenFamily field”,
body: “Without token family tracking, a stolen refresh token can be silently used. OWASP recommends detecting reuse by tracking token lineage. Adding this column requires a migration — coordinate with feat/dashboard which also touches the User model.”,
source: “prisma/schema.prisma:User, feat/dashboard conflict” },
{ type: “DEPENDENCY”, typeColor:”#f59e0b”, typeDim:“var(–amber-dim)”,
title: “jose library already present in package.json”,
body: “jose@5.2.0 is already installed (used by NextAuth internals). We can use signJWT/jwtVerify directly without adding a new dependency. This saves ~40kB and avoids version conflicts.”,
source: “package.json:dependencies” },
{ type: “INSIGHT”, typeColor:”#3ecf8e”, typeDim:“var(–green-dim)”,
title: “Cookie strategy works for web; mobile needs header fallback”,
body: “React Native’s fetch implementation supports cookies only with specific config. Safer to implement dual-mode: httpOnly cookie for web, Bearer token for mobile. Detect via User-Agent or explicit client hint header.”,
source: “Research: RFC 6750, Next.js docs, React Native fetch spec” },
];

return (
<div className="phase-body">
<div style={{display:“flex”,gap:10,marginBottom:20}}>
{[{l:“Files Analyzed”,v:“34”},{l:“Dependencies Checked”,v:“12”},{l:“Risks Found”,v:“3”},{l:“Opportunities”,v:“2”}].map(s=>(
<div key={s.l} style={{flex:1,background:“var(–surface)”,border:“1px solid var(–border)”,borderRadius:8,padding:“10px 14px”}}>
<div style={{fontSize:9,color:“var(–text3)”,textTransform:“uppercase”,letterSpacing:”.1em”,marginBottom:4}}>{s.l}</div>
<div style={{fontFamily:“var(–sans)”,fontSize:20,fontWeight:700,color:“var(–text)”}}>{s.v}</div>
</div>
))}
</div>
<div className="section">
<div className="section-title">Findings</div>
{findings.map((f,i)=>(
<div key={i} className="research-finding">
<div className="rf-header">
<span className=“rf-type badge” style={{background:f.typeDim,color:f.typeColor,border:`1px solid ${f.typeColor}33`}}>{f.type}</span>
<span className="rf-title">{f.title}</span>
</div>
<div className="rf-body">{f.body}</div>
<div className="rf-source">📄 <code>{f.source}</code></div>
</div>
))}
</div>
</div>
);
}

function PhasePlan({ onAdvance }) {
const [expanded, setExpanded] = useState(null);
const tasks = [
{ n:1, title:“DB migration: add tokenHash, tokenFamily, expiresAt to Session model”,
file:“prisma/schema.prisma”, color:”#60a5fa”, colorDim:“var(–blue-dim)”,
detail:“Add Session model with userId FK, tokenHash (indexed), tokenFamily (UUID), expiresAt, revokedAt nullable. Run migration. Coordinate with feat/dashboard team on User model conflicts.”,
tags:[“prisma”,“migration”,“db”], effort:“~1h” },
{ n:2, title:“Implement signToken / verifyToken / rotateRefresh in lib/auth.ts”,
file:“src/lib/auth.ts”, color:”#a78bfa”, colorDim:“var(–accent-dim)”,
detail:“Using jose library. signToken(payload, expiresIn). verifyToken(token). rotateRefresh(oldToken) — verifies family, marks old as revoked, issues new. Returns null on reuse attack detection.”,
tags:[“crypto”,“jose”,“tokens”], effort:“~2h” },
{ n:3, title:“Build /api/auth/login, /logout, /refresh endpoints”,
file:“src/api/auth/”, color:”#3ecf8e”, colorDim:“var(–green-dim)”,
detail:“login: verify password, create session, set httpOnly cookie. refresh: rotate token, update session. logout: revoke session. All endpoints handle dual-mode (cookie vs Bearer header).”,
tags:[“api”,“nextjs”,“routes”], effort:“~3h” },
{ n:4, title:“Update middleware.ts to verify 15min JWT + silent refresh signal”,
file:“src/middleware.ts”, color:”#f59e0b”, colorDim:“var(–amber-dim)”,
detail:“If token is valid but expiring in <2min, set X-Token-Expiring header. Client intercepts and calls /refresh in background. Keeps middleware lightweight.”,
tags:[“middleware”,“perf”], effort:“~1h” },
{ n:5, title:“Client-side auth hook: useAuth, token refresh logic”,
file:“src/hooks/useAuth.ts”, color:”#f472b6”, colorDim:“var(–pink-dim)”,
detail:“React hook wrapping fetch. Intercepts 401 or X-Token-Expiring, triggers refresh, retries original request. Queue concurrent requests during refresh to avoid thundering herd.”,
tags:[“react”,“hooks”,“client”], effort:“~2h” },
{ n:6, title:“Write integration tests: happy path, token reuse attack, expiry”,
file:“src/**tests**/auth.test.ts”, color:”#f87171”, colorDim:“var(–red-dim)”,
detail:“Vitest + supertest. Cover: login→refresh→logout, concurrent refresh dedup, stolen token reuse detection (expect 401 + family revocation), cookie vs Bearer modes.”,
tags:[“tests”,“vitest”,“security”], effort:“~2h” },
];

return (
<div className="phase-body">
<div style={{padding:“10px 14px”,background:“var(–green-dim)”,border:“1px solid rgba(62,207,142,.2)”,borderRadius:8,fontSize:11,color:“var(–green)”,marginBottom:20,lineHeight:1.6}}>
✓ Research complete. 6 tasks generated. Estimated total: ~11h. Click any task to expand details.
</div>
<div className="section">
<div className="section-title">Implementation Plan</div>
{tasks.map((t,i)=>(
<div key={i} className={`plan-task${expanded===i?" expanded":""}`} onClick={()=>setExpanded(expanded===i?null:i)}>
<div className="pt-header">
<div className=“pt-num” style={{background:t.colorDim,color:t.color,border:`1px solid ${t.color}33`}}>{t.n}</div>
<span className="pt-title">{t.title}</span>
<span className="pt-file">{t.file}</span>
<span className={`pt-expand${expanded===i?" open":""}`}>▶</span>
</div>
{expanded===i&&(
<div className="pt-detail">
{t.detail}
<div className="pt-tags">
{t.tags.map(tag=><span key={tag} className="pt-tag">{tag}</span>)}
<span className=“pt-tag” style={{color:“var(–amber)”,borderColor:“rgba(245,158,11,.3)”}}>{t.effort}</span>
</div>
</div>
)}
</div>
))}
</div>
</div>
);
}

function PhaseImplement() {
const tasks = [
{ title:“DB migration”, status:“done”, lines:”+47 -2” },
{ title:“lib/auth.ts — signToken, verifyToken, rotateRefresh”, status:“done”, lines:”+124 -0” },
{ title:”/api/auth routes (login, refresh, logout)”, status:“active”, lines:”+89 -0” },
{ title:“Update middleware.ts”, status:“todo”, lines:”” },
{ title:“useAuth hook”, status:“todo”, lines:”” },
{ title:“Integration tests”, status:“todo”, lines:”” },
];
const checkIcon = { done:“✓”, active:“↻”, todo:”” };

const logs = [
“[09:14:22] ✓ Migration applied: 20250405_add_sessions”,
“[09:15:01] ✓ Created src/lib/auth.ts — 3 exports”,
“[09:15:44] ✓ signToken: using jose RS256, 15min expiry”,
“[09:15:44] ✓ rotateRefresh: token family tracking enabled”,
“[09:16:12] → Writing src/api/auth/login/route.ts”,
“[09:16:33] → bcrypt.compare password hash”,
“[09:16:41] → Creating session record with tokenFamily UUID”,
“[09:16:50] → Setting httpOnly cookie with SameSite=Strict”,
];

return (
<div className="phase-body">
<div className="section">
<div className="section-title">Tasks</div>
{tasks.map((t,i)=>(
<div key={i} className="impl-task">
<div className={`impl-check ${t.status}`}>{checkIcon[t.status]}</div>
<span className={`impl-task-name ${t.status}`}>{t.title}</span>
{t.lines&&<span className=“impl-lines” style={{color:t.status===“done”?“var(–green)”:“var(–text3)”}}>{t.lines}</span>}
</div>
))}
</div>
<div className="section">
<div className="section-title">Live Log</div>
<div className="impl-log">
{logs.map((l,i)=>{
const isAct=l.includes(“→”);
const isDone=l.includes(“✓”);
return(
<div key={i} className="log-line">
<span className="ts">{l.split(”]”)[0].slice(1)}]</span>
<span className={isDone?“act”:isAct?“file”:””}>{l.split(”]”).slice(1).join(”]”)}</span>
</div>
);
})}
<div className=“log-line pulse” style={{color:“var(–amber)”}}>
<span className="ts">[09:16:58]</span>
<span> → Writing refresh token endpoint…</span>
</div>
</div>
</div>
<div style={{display:“flex”,gap:10,marginTop:8}}>
{[{l:“Files Changed”,v:“4”,c:”#a78bfa”},{l:“Lines Added”,v:”+260”,c:”#3ecf8e”},{l:“Lines Removed”,v:”-2”,c:”#f87171”},{l:“Tests Passing”,v:”—”,c:“var(–text3)”}].map(s=>(
<div key={s.l} style={{flex:1,background:“var(–surface)”,border:“1px solid var(–border)”,borderRadius:8,padding:“10px 14px”}}>
<div style={{fontSize:9,color:“var(–text3)”,textTransform:“uppercase”,letterSpacing:”.1em”,marginBottom:4}}>{s.l}</div>
<div style={{fontFamily:“var(–sans)”,fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
</div>
))}
</div>
</div>
);
}

function PhaseVerify() {
const checks = [
{ icon:“✓”, status:“pass”, name:“Unit tests (24/24 passing)”, detail:“All auth utility functions pass. signToken, verifyToken, rotateRefresh, reuse detection.”, action:“View report” },
{ icon:“✓”, status:“pass”, name:“Integration: happy path login → refresh → logout”, detail:“Token rotation works. Session revoked on logout. Cookie cleared.”, action:“View trace” },
{ icon:“✓”, status:“pass”, name:“Token reuse attack: stolen refresh token rejected”, detail:“Reuse detected, entire token family revoked. 401 returned.”, action:“View test” },
{ icon:“⚠”, status:“warn”, name:“Mobile Bearer-mode: refresh timing edge case”, detail:“Under high latency (>500ms), concurrent requests can fire duplicate refreshes. Race condition needs mutex or dedup queue in useAuth.”, action:“View issue” },
{ icon:“✗”, status:“fail”, name:“E2E: logout on all devices not tested”, detail:“Multi-device session revocation not covered. Needs test before merge.”, action:“Create test” },
];
const ic = { pass:“var(–green)”, warn:“var(–amber)”, fail:“var(–red)” };

return (
<div className="phase-body">
<div style={{display:“flex”,gap:10,marginBottom:20}}>
{[{l:“Tests Run”,v:“24”,c:“var(–text)”},{l:“Passing”,v:“22”,c:”#3ecf8e”},{l:“Warnings”,v:“1”,c:”#f59e0b”},{l:“Failing”,v:“1”,c:”#f87171”}].map(s=>(
<div key={s.l} style={{flex:1,background:“var(–surface)”,border:“1px solid var(–border)”,borderRadius:8,padding:“10px 14px”}}>
<div style={{fontSize:9,color:“var(–text3)”,textTransform:“uppercase”,letterSpacing:”.1em”,marginBottom:4}}>{s.l}</div>
<div style={{fontFamily:“var(–sans)”,fontSize:20,fontWeight:700,color:s.c}}>{s.v}</div>
</div>
))}
</div>
<div className="section">
<div className="section-title">Verification Checklist</div>
{checks.map((c,i)=>(
<div key={i} className="verify-item">
<div className="vi-status" style={{color:ic[c.status]}}>{c.icon}</div>
<div className="vi-body">
<div className="vi-name" style={{color:ic[c.status]}}>{c.name}</div>
<div className="vi-detail">{c.detail}</div>
</div>
<button className="vi-action">{c.action}</button>
</div>
))}
</div>
<div style={{padding:“12px 16px”,background:“var(–amber-dim)”,border:“1px solid rgba(245,158,11,.25)”,borderRadius:8,fontSize:11,color:“var(–amber)”,lineHeight:1.6}}>
⚠ 1 warning + 1 failing test. Recommend fixing race condition and adding multi-device E2E before marking complete.
</div>
</div>
);
}

// ─── SIDE PANEL CHAT ────────────────────────────────────────────
function SideChat({ phase }) {
const chats = {
propose: [
{ role:“ai”, text:“I’ve reviewed your brief. One gap: you haven’t addressed what happens to existing sessions when you deploy. Force logout all users, or migrate?” },
{ role:“user”, text:“Good point — we’ll force logout on deploy. Add it to open questions.” },
],
grill: [
{ role:“ai”, text:“Your mobile client concern is still open. Until you answer it, I’d flag this as not ready to advance.” },
{ role:“user”, text:“We’ll use dual-mode: cookie for web, Bearer for mobile. Updating the brief now.” },
],
research: [
{ role:“ai”, text:“Found a conflict with feat/dashboard on the User model. You’ll need to coordinate the Prisma migration order.” },
],
plan: [
{ role:“ai”, text:“Tasks 2 and 3 can be parallelized. Want me to split them into separate sub-agents?” },
{ role:“user”, text:“Yes — assign task 3 to a new agent on the same worktree.” },
],
implement: [
{ role:“ai”, text:“Writing the /refresh endpoint now. Using the rotateRefresh utility from task 2 — token family lineage is being tracked.” },
],
verify: [
{ role:“ai”, text:“The race condition in useAuth is a real bug. I can fix it now — want me to add a promise queue for concurrent refresh requests?” },
{ role:“user”, text:“Yes, fix it and rerun the mobile test suite.” },
],
};

const msgs = chats[phase] || [];
return (
<>
<div className="sp-body">
{msgs.map((m,i)=>(
<div key={i} className="chat-msg">
<div className=“chat-avatar” style={{
background: m.role===“ai”?“var(–amber-dim)”:“var(–accent-dim)”,
border:`1px solid ${m.role==="ai"?"rgba(245,158,11,.3)":"rgba(124,106,247,.3)"}`,
color: m.role===“ai”?“var(–amber)”:“var(–accent2)”
}}>{m.role===“ai”?“AI”:“U”}</div>
<div className={`chat-bubble${m.role==="ai"?" ai-bubble":""}`}>{m.text}</div>
</div>
))}
</div>
<div className="chat-input-wrap">
<input className=“chat-input” placeholder={`Ask about ${phase}...`} />
</div>
</>
);
}

// ─── MAIN APP ────────────────────────────────────────────────────
export default function ForgeLifecycle() {
const [worktrees, setWorktrees] = useState(WORKTREES_INIT);
const [activeWt, setActiveWt] = useState(1);
const [showNewWt, setShowNewWt] = useState(false);

const wt = worktrees.find(w => w.id === activeWt);
const phase = wt?.phase || “propose”;
const phaseIdx = PHASE_IDX[phase];
const phaseDef = PHASES[phaseIdx];

const advance = () => {
const nextPhase = PHASES[Math.min(phaseIdx + 1, PHASES.length - 1)].id;
const nextProgress = Math.min(100, Math.round((phaseIdx + 2) / PHASES.length * 100));
setWorktrees(wts => wts.map(w => w.id === activeWt ? { …w, phase: nextPhase, progress: nextProgress } : w));
};

const retreat = () => {
const prevPhase = PHASES[Math.max(phaseIdx - 1, 0)].id;
setWorktrees(wts => wts.map(w => w.id === activeWt ? { …w, phase: prevPhase } : w));
};

const PHASE_LABELS = {
propose: { action: “Send to Grill →”, back: null, hint: “Proposal looks solid enough to stress-test” },
grill: { action: “Start Research →”, back: “← Back to Propose”, hint: “All challenges addressed” },
research: { action: “Build Plan →”, back: “← Re-grill”, hint: “Research complete, risks documented” },
plan: { action: “Start Implementing →”, back: “← More Research”, hint: “Plan approved, begin execution” },
implement: { action: “Run Verification →”, back: null, hint: “Implementation complete” },
verify: { action: “✓ Mark Complete”, back: “← Back to Implement”, hint: “All checks pass” },
};

const pl = PHASE_LABELS[phase];

return (
<>
<style>{S}</style>
<div className="app">
{/* TITLEBAR */}
<div className="tb">
<div className="tb-logo">
<svg className="tb-logo-mark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
</svg>
<span className="tb-name">FORGE <em>OS</em></span>
</div>
<div className="tb-pills">
<div className="tb-pill active">Feature Lifecycle</div>
<div className="tb-pill">Editor</div>
<div className="tb-pill">Terminal</div>
<div className="tb-pill">Agents</div>
</div>
<div style={{fontSize:11,color:“var(–text3)”}}>
<span style={{color:“var(–text2)”}}>4</span> worktrees active
</div>
</div>

```
    <div className="layout">
      {/* WORKTREE SIDEBAR */}
      <div className="wt-sidebar">
        <div className="wt-header">
          <div className="wt-header-row">
            <span className="wt-label">Worktrees</span>
            <button className="add-wt" onClick={() => setShowNewWt(true)}>+</button>
          </div>
        </div>
        <div className="wt-list">
          {worktrees.map(w => {
            const pd = PHASES[PHASE_IDX[w.phase]];
            return (
              <div key={w.id} className={`wt-item${activeWt === w.id ? " sel" : ""}`} onClick={() => setActiveWt(w.id)}>
                <div className="wt-item-top">
                  <div className="wt-dot" style={{ background: w.color }} />
                  <span className="wt-item-name">{w.name}</span>
                  <span className="wt-phase-mini badge" style={{ background: pd.colorDim, color: pd.color, border: `1px solid ${pd.color}33` }}>
                    {pd.icon} {pd.label}
                  </span>
                </div>
                <div className="wt-branch">{w.branch}</div>
                <div className="wt-progress-track">
                  <div className="wt-progress-fill" style={{ width: `${w.progress}%`, background: w.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MAIN */}
      <div className="main">
        {/* LIFECYCLE HEADER */}
        <div className="lc-header">
          <div className="lc-feature-row">
            <div>
              <div className="lc-feature-name">JWT Authentication with Refresh Tokens</div>
              <div className="lc-feature-branch">worktree: <span>{wt?.branch}</span></div>
            </div>
            <div className="lc-actions">
              <button className="lc-btn">Edit Brief</button>
              <button className="lc-btn">View Diff</button>
            </div>
          </div>

          {/* PHASE TRACK */}
          <div className="phase-track">
            {PHASES.map((p, i) => {
              const isDone = i < phaseIdx;
              const isActive = i === phaseIdx;
              const status = isDone ? "done" : isActive ? "active" : "upcoming";
              return (
                <div key={p.id} className="phase-node">
                  <div
                    className={`phase-step ${status}`}
                    style={isActive ? { "--active-color": p.color } : {}}
                    onClick={() => setWorktrees(wts => wts.map(w => w.id === activeWt ? { ...w, phase: p.id } : w))}
                  >
                    <span className="phase-step-icon" style={{ color: isDone ? "var(--green)" : isActive ? p.color : "var(--text3)" }}>
                      {isDone ? "✓" : p.icon}
                    </span>
                    <span className="phase-step-label">{p.label}</span>
                    {isActive && <div style={{ position:"absolute",bottom:0,left:0,right:0,height:2,background:p.color,borderRadius:"2px 2px 0 0" }}/>}
                  </div>
                  {i < PHASES.length - 1 && (
                    <div className="phase-connector">
                      <div className={`phase-connector-line${isDone ? " done" : ""}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="content">
          <div className="phase-panel">
            {phase === "propose"   && <PhasePropose onAdvance={advance} />}
            {phase === "grill"     && <PhaseGrill onAdvance={advance} />}
            {phase === "research"  && <PhaseResearch onAdvance={advance} />}
            {phase === "plan"      && <PhasePlan onAdvance={advance} />}
            {phase === "implement" && <PhaseImplement />}
            {phase === "verify"    && <PhaseVerify />}

            {/* PHASE FOOTER */}
            <div className="phase-footer">
              <div className="pf-status">Phase: <span style={{ color: phaseDef.color }}>{phaseDef.icon} {phaseDef.label}</span><span style={{ color: "var(--text3)", marginLeft: 16 }}>{pl.hint}</span></div>
              <div className="pf-btns">
                {pl.back && <button className="lc-btn" onClick={retreat}>{pl.back}</button>}
                <button className="lc-btn primary" onClick={advance}>{pl.action}</button>
              </div>
            </div>
          </div>

          {/* SIDE CHAT */}
          <div className="side-panel">
            <div className="sp-header">
              {phaseDef.icon} {phaseDef.label} — Claude
            </div>
            <SideChat phase={phase} />
          </div>
        </div>
      </div>
    </div>
  </div>

  {/* NEW WORKTREE MODAL */}
  {showNewWt && (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(4px)" }} onClick={() => setShowNewWt(false)}>
      <div style={{ background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:12,padding:24,width:440,boxShadow:"0 24px 80px rgba(0,0,0,.6)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontFamily:"var(--sans)",fontSize:16,fontWeight:700,color:"var(--text)",marginBottom:4 }}>New Feature Worktree</div>
        <div style={{ fontSize:11,color:"var(--text3)",marginBottom:20 }}>Creates a git worktree and starts the feature lifecycle at Propose</div>
        {[{l:"Feature Name",p:"e.g. Dark mode support"},{l:"Branch Name",p:"feat/dark-mode"},{l:"One-line goal",p:"What should this feature accomplish?"}].map(f => (
          <div key={f.l} style={{ marginBottom:14 }}>
            <div style={{ fontSize:10,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6 }}>{f.l}</div>
            <input style={{ width:"100%",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:6,padding:"9px 12px",color:"var(--text)",fontFamily:"var(--mono)",fontSize:12,outline:"none" }} placeholder={f.p} />
          </div>
        ))}
        <div style={{ display:"flex",gap:8,justifyContent:"flex-end",marginTop:20 }}>
          <button style={{ padding:"8px 16px",borderRadius:6,border:"1px solid var(--border)",background:"transparent",color:"var(--text3)",fontFamily:"var(--mono)",fontSize:11,cursor:"pointer" }} onClick={() => setShowNewWt(false)}>Cancel</button>
          <button style={{ padding:"8px 16px",borderRadius:6,border:"none",background:"var(--accent)",color:"white",fontFamily:"var(--mono)",fontSize:11,cursor:"pointer" }} onClick={() => setShowNewWt(false)}>Create & Start Proposing</button>
        </div>
      </div>
    </div>
  )}
</>
```

);
} 