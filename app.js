// Importações modulares do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";

// Suas Credenciais Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBMU08sKY1IrNbH_FRCwQ9LOLAuSofg_b0",
  authDomain: "checklist-c97f8.firebaseapp.com",
  databaseURL: "https://checklist-c97f8-default-rtdb.firebaseio.com",
  projectId: "checklist-c97f8",
  storageBucket: "checklist-c97f8.firebasestorage.app",
  messagingSenderId: "21553212008",
  appId: "1:21553212008:web:a234af1b9a11cc4e8ee9dd",
  measurementId: "G-W3R1HY2Z56"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Lista de Lojas e Senhas Exatas solicitadas
const STORES = {
  "001-AFL": "Delmoro001",
  "002-APIACAS": "Delmoro002",
  "003-PAR": "Delmoro003",
  "004-SORBH": "Delmoro004",
  "005-LRVCEN": "Delmoro005",
  "006-MUTUM": "Delmoro006",
  "008-LRVVEN": "Delmoro008",
  "009-TAPURAH": "Delmoro009",
  "010-GTA": "Delmoro010",
  "011-PEIXOTO": "Delmoro011",
  "012-SORBR": "Delmoro012",
  "013-DNSOR": "Delmoro013",
  "014-CD": "Delmoro014",
  "015-TNN": "Delmoro015",
  "016-DNMUTUM": "Delmoro016",
  "018-SOR-RDS": "Delmoro018",
  "502-CA-GTA-C": "Demoro2026",
  "503-CA-SNP-J": "Demoro2026",
  "505-CA-SORRI": "Demoro2026",
  "506-CA-SNP-A": "Demoro2026",
  "508-CA-MTP-I": "Demoro2026"
};

const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));

const DEFAULT_FROM_YEAR = 2026;
const WEEKDAYS = [
  {i:0, short:"Dom", full:"Domingo"}, {i:1, short:"Seg", full:"Segunda"},
  {i:2, short:"Ter", full:"Terça"}, {i:3, short:"Qua", full:"Quarta"},
  {i:4, short:"Qui", full:"Quinta"}, {i:5, short:"Sex", full:"Sexta"},
  {i:6, short:"Sáb", full:"Sábado"},
];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

let state = { employees: [], selectedEmployeeId: null, cargoFilter: "__ALL__" };
let selectedCargoFilter = "__ALL__";
let current = new Date();
let selectedYear = Math.max(DEFAULT_FROM_YEAR, current.getFullYear());
let selectedMonth = current.getMonth();
let draft = null;

// Controle de Sessão
let loggedInStore = sessionStorage.getItem("folgas_current_store");

// ---------- Utils ----------
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const pad2 = (n) => (n<10 ? "0"+n : ""+n);
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
const parseYMD = (s) => {
  if(!s) return null;
  const [y,m,d] = s.split("-").map(Number);
  if(!y||!m||!d) return null;
  return new Date(y, m-1, d);
};
const monthDays = (y, m) => new Date(y, m+1, 0).getDate();
const isDateBetween = (dateStr, startStr, endStr) => (dateStr && startStr && endStr) && (dateStr >= startStr && dateStr <= endStr);

// ---------- FIREBASE LOAD / SAVE ----------
const load = async () => {
  if(!loggedInStore) return;
  try {
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, `escalas/${loggedInStore}`));
    if (snapshot.exists()) {
      state = snapshot.val();
      if(!state.employees) state.employees = [];
      if(!state.cargoFilter) state.cargoFilter = "__ALL__";
      selectedCargoFilter = state.cargoFilter;
    } else {
      state = { employees: [], selectedEmployeeId: null, cargoFilter: "__ALL__" };
    }
  } catch (e) {
    console.error("Erro Firebase Load:", e);
    state = { employees: [], selectedEmployeeId: null, cargoFilter: "__ALL__" };
  }
};

const save = async () => {
  if(!loggedInStore) return;
  try {
    const dbRef = ref(database, 'escalas/' + loggedInStore);
    await set(dbRef, state);
  } catch (e) {
    console.error("Erro Firebase Save:", e);
    alert("Falha ao sincronizar com a nuvem.");
  }
};

// ---------- CSV Parsers ----------
const normalize = (s) => (s||"").toString().trim();
const parseCSV = (text) => {
  const lines = text.replace(/\r/g,"").split("\n").filter(l => l.trim().length>0);
  if(!lines.length) return {headers:[], rows:[]};
  const first = lines[0];
  const delim = (first.match(/;/g)||[]).length >= (first.match(/,/g)||[]).length ? ";" : ",";
  const splitLine = (line) => {
    const out = []; let cur = ""; let inQ = false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(ch === '"'){ if(inQ && line[i+1] === '"'){ cur += '"'; i++; } else inQ = !inQ; } 
      else if(!inQ && ch === delim){ out.push(cur); cur = ""; } 
      else { cur += ch; }
    }
    out.push(cur);
    return out.map(v => v.trim().replace(/^"|"$/g,""));
  };
  const headers = splitLine(lines[0]).map(h => h.trim().replace(/^\uFEFF/, ""));
  const rows = lines.slice(1).map(l => splitLine(l));
  return {headers, rows};
};

const parseEmployeesCSV = (text) => {
  const {headers, rows} = parseCSV(text);
  if(!headers.length) return [];
  const idxName = headers.findIndex(h => /nome/i.test(h));
  const idxMat = headers.findIndex(h => /matr/i.test(h));
  const idxId = headers.findIndex(h => /id/i.test(h));
  const idxCargo = headers.findIndex(h => /(cargo|setor|departamento|fun[cç]ao)/i.test(h));
  const idxAbsType = headers.findIndex(h => /(ausencia_tipo|absence_type|ferias|afastamento)/i.test(h));
  const idxAbsStart = headers.findIndex(h => /(ausencia_inicio|absence_start|inicio_ausencia)/i.test(h));
  const idxAbsEnd = headers.findIndex(h => /(ausencia_fim|absence_end|fim_ausencia)/i.test(h));

  const emps = [];
  for(const r of rows){
    const name = normalize(r[idxName >= 0 ? idxName : 1]);
    const mat = normalize(r[idxMat >= 0 ? idxMat : 0]);
    if(!name && !mat) continue;
    const cargo = normalize(r[idxCargo]) || "";
    const absType = normalize(r[idxAbsType]) || "";
    const absStart = normalize(r[idxAbsStart]) || "";
    const absEnd = normalize(r[idxAbsEnd]) || "";
    const absence = (absType && absStart && absEnd) ? {type: absType.toLowerCase().includes("afast") ? "afastamento" : "ferias", start: absStart, end: absEnd} : null;
    emps.push({ id: normalize(r[idxId]) || uid(), name: name || "SEM NOME", matricula: mat || "", cargo, offWeekdays: [], extraOff: {}, extraWork: {}, sundayWork: {}, absence });
  }
  return emps;
};

const exportEmployeesCSV = () => {
  const headers = ["id","matricula","Nome","cargo","folga_fixa_semana","ausencia_tipo","ausencia_inicio","ausencia_fim"];
  const lines = [headers.join(";")];
  for(const e of state.employees){
    const w = (e.offWeekdays||[]).slice().sort().join(",");
    const row = [ e.id, (e.matricula||"").replace(/;/g," "), (e.name||"").replace(/;/g," "), (e.cargo||"").replace(/;/g," "), w, (e.absence?.type||""), (e.absence?.start||""), (e.absence?.end||"") ];
    lines.push(row.join(";"));
  }
  return lines.join("\n");
};

const monthKey = () => `${selectedYear}-${pad2(selectedMonth+1)}`;
const getEmployeeById = (id) => state.employees.find(e => e.id === id) || null;

const isOff = (emp, dateObj) => {
  const key = `${dateObj.getFullYear()}-${pad2(dateObj.getMonth()+1)}`;
  const day = ymd(dateObj);
  const w = dateObj.getDay();

  if(emp.absence && emp.absence.start && emp.absence.end && isDateBetween(day, emp.absence.start, emp.absence.end)){
    return {off:false, kind:"absence"};
  }

  const extraOff = (emp.extraOff?.[key] || []);
  if(extraOff.includes(day)) return {off:true, kind:"extraoff"};

  const sundayWork = (emp.sundayWork?.[key] || []);
  if(w === 0 && sundayWork.includes(day)) return {off:false, kind:"sundaywork"};
  if(w === 0 && !sundayWork.includes(day)) return {off: true, kind: "sunoff"};

  const extraWork = (emp.extraWork?.[key] || []);
  if(extraWork.includes(day)) return {off:false, kind:"extrawork"};

  const fixed = (emp.offWeekdays || []).includes(w);
  return {off: fixed, kind: fixed ? "off" : "work"};
};

// ---------- UI Renderers ----------
const updateCargoFilterOptions = () => {
  if(state?.cargoFilter) selectedCargoFilter = state.cargoFilter;
  const sel = $("#cargoFilter");
  if(!sel) return;
  const cargos = Array.from(new Set(state.employees.map(e => (e.cargo||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const current = selectedCargoFilter || "__ALL__";
  sel.innerHTML = `<option value="__ALL__">Todos</option>` + cargos.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  sel.value = Array.from(sel.options).some(o => o.value === current) ? current : "__ALL__";
  selectedCargoFilter = sel.value;
  state.cargoFilter = selectedCargoFilter;
};

const fillPickers = () => {
  const ySel = $("#year"); const mSel = $("#month");
  ySel.innerHTML = ""; mSel.innerHTML = "";
  const maxYear = Math.max(DEFAULT_FROM_YEAR, new Date().getFullYear()) + 10;
  for(let y=DEFAULT_FROM_YEAR; y<=maxYear; y++){
    const opt = document.createElement("option"); opt.value = String(y); opt.textContent = String(y);
    if(y === selectedYear) opt.selected = true;
    ySel.appendChild(opt);
  }
  for(let m=0; m<12; m++){
    const opt = document.createElement("option"); opt.value = String(m); opt.textContent = MONTHS[m];
    if(m === selectedMonth) opt.selected = true;
    mSel.appendChild(opt);
  }
  ySel.addEventListener("change", () => { selectedYear = Number(ySel.value); renderAll(); });
  mSel.addEventListener("change", () => { selectedMonth = Number(mSel.value); renderAll(); });
  $("#btnToday").addEventListener("click", () => {
    const now = new Date();
    selectedYear = Math.max(DEFAULT_FROM_YEAR, now.getFullYear());
    selectedMonth = now.getMonth();
    fillPickers(); renderAll();
  });
};

const formatWeekdays = (arr) => {
  const set = new Set(arr||[]);
  if(!set.size) return "Sem folga fixa";
  return WEEKDAYS.filter(w => set.has(w.i)).map(w => w.short).join(", ");
};

const renderEmployeeList = () => {
  const q = normalize($("#search").value).toLowerCase();
  const box = $("#employeeList"); box.innerHTML = "";
  const filtered = state.employees.slice().sort((a,b) => (a.name||"").localeCompare(b.name||"", "pt-BR")).filter(e => {
    const c = (e.cargo||"").trim();
    if(selectedCargoFilter !== "__ALL__" && c !== selectedCargoFilter) return false;
    if(!q) return true;
    return (e.name||"").toLowerCase().includes(q) || (e.matricula||"").toLowerCase().includes(q);
  });
  if(!filtered.length){
    box.innerHTML = `<div class="small muted">Nenhum colaborador. Importe um CSV ou adicione manualmente.</div>`; return;
  }
  for(const e of filtered){
    const card = document.createElement("div"); card.className = "card";
    card.innerHTML = `
      <div class="meta">
        <div class="name">${escapeHtml(e.name)}</div>
        <div class="sub">Matrícula: <b>${escapeHtml(e.matricula||"-")}</b></div>
      </div>
      <div class="pill"><b>${formatWeekdays(e.offWeekdays)}</b></div>
    `;
    card.addEventListener("click", () => openModal(e.id));
    box.appendChild(card);
  }
};

const renderCalendar = () => {
  const container = $("#calendar");
  const emps = state.employees.slice().filter(e => (selectedCargoFilter === "__ALL__") || ((e.cargo||"").trim() === selectedCargoFilter)).sort((a,b) => (a.name||"").localeCompare(b.name||"", "pt-BR"));
  const sectorName = selectedCargoFilter === "__ALL__" ? "TODOS OS SETORES" : selectedCargoFilter;

  // Função isolada que gera a tabela para qualquer mês fornecido
  const buildTable = (y, m) => {
    const days = monthDays(y, m);
    const head = [`<thead><tr><th>Colaborador</th>`];
    for(let d=1; d<=days; d++){
      const w = WEEKDAYS[new Date(y, m, d).getDay()].short;
      head.push(`<th>${d}<div class="small muted">${w}</div></th>`);
    }
    head.push(`</tr></thead>`);

    const body = []; body.push("<tbody>");
    for(const e of emps){
      body.push(`<tr data-emp="${e.id}"><th>
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between">
          <div><div style="font-weight:900">${escapeHtml(e.name)}</div><div class="small muted">Mat: ${escapeHtml(e.matricula||"-")}</div></div>
          <button class="btn ghost" style="padding:8px 10px" data-edit="${e.id}">Editar</button>
        </div>
      </th>`);
      for(let d=1; d<=days; d++){
        const dt = new Date(y, m, d);
        const info = isOff(e, dt);
        const cls = info.kind === "absence" ? "absence" : (info.kind === "sundaywork" ? "sunwork" : (info.kind === "sunoff" ? "sunoff" : (info.kind === "extraoff" ? "extraoff" : (info.kind === "extrawork" ? "extrawork" : (info.off ? "off" : "")))));
        const title = info.kind === "absence" ? (e.absence?.type === "afastamento" ? "Afastamento" : "Férias") : (info.kind === "sundaywork" ? "Domingo trabalhado" : (info.kind === "sunoff" ? "Folga de Domingo" : (info.kind === "extraoff" ? "Folga alterada!" : (info.kind === "extrawork" ? "Trabalha/Não folga" : (info.off ? "Folga" : "Trabalha")))));
        const mark = info.kind === "absence" ? "" : (info.kind === "sundaywork" ? "D" : (info.off ? "F" : "T"));
        body.push(`<td class="${cls}" data-date="${ymd(dt)}" title="${title}"><div class="cell">${mark}</div></td>`);
      }
      body.push("</tr>");
    }
    body.push("</tbody>");
    return `<div class="table-responsive"><table class="calendar">${head.join("")}${body.join("")}</table></div>`;
  };

  // Cálculo de Meses
  const nextM = selectedMonth === 11 ? 0 : selectedMonth + 1;
  const nextY = selectedMonth === 11 ? selectedYear + 1 : selectedYear;

  // Montando a UI inspirada na sua imagem (Setor, Mês Atual e Próximo Mês)
  container.innerHTML = `
    <div class="multi-month-view">
      <div class="sector-header">
        <div class="sh-title">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
          SETOR: ${escapeHtml(sectorName).toUpperCase()}
        </div>
        <div class="sh-count">👥 ${emps.length} Colaborador(es)</div>
      </div>
      
      <div class="month-section">
        <div class="month-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Mês Atual (${pad2(selectedMonth+1)}/${selectedYear})
        </div>
        ${buildTable(selectedYear, selectedMonth)}
      </div>

      <div class="month-section">
        <div class="month-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Próximo Mês (${pad2(nextM+1)}/${nextY})
        </div>
        ${buildTable(nextY, nextM)}
      </div>
    </div>
  `;

  // Re-aplicando eventos (agora ele varre todas as tabelas criadas na tela de uma vez)
  $$("[data-edit]").forEach(btn => btn.addEventListener("click", (ev) => { ev.stopPropagation(); openModal(btn.getAttribute("data-edit")); }));
  
  $$("tbody th", container).forEach(th => {
    th.style.cursor = "pointer";
    th.addEventListener("click", () => { const empId = th.closest("tr")?.getAttribute("data-emp"); if(empId) openModal(empId); });
  });

  $$("tbody td", container).forEach(td => {
    td.addEventListener("click", async () => {
      const empId = td.closest("tr")?.getAttribute("data-emp");
      const dateStr = td.getAttribute("data-date");
      if(!empId || !dateStr) return;
      const emp = getEmployeeById(empId);
      if(!emp) return;
      
      const dt = parseYMD(dateStr);
      // MÁGICA AQUI: Ele calcula a chave baseada no clique, assim não importa em qual mês você clica, salva certo no Firebase!
      const key = `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}`;
      
      emp.extraOff ||= {}; emp.extraWork ||= {}; emp.extraOff[key] ||= []; emp.extraWork[key] ||= [];
      const extraOff = emp.extraOff[key]; const extraWork = emp.extraWork[key];
      const fixed = (emp.offWeekdays||[]).includes(dt.getDay());
      
      if (dt.getDay() === 0) {
        emp.sundayWork ||= {}; 
        emp.sundayWork[key] ||= [];
        const sunWork = emp.sundayWork[key];
        
        if (sunWork.includes(dateStr)) {
          emp.sundayWork[key] = sunWork.filter(x => x !== dateStr);
        } else {
          emp.sundayWork[key].push(dateStr);
        }
      } 
      else {
        if(extraOff.includes(dateStr)) emp.extraOff[key] = extraOff.filter(x => x !== dateStr);
        else if(extraWork.includes(dateStr)) emp.extraWork[key] = extraWork.filter(x => x !== dateStr);
        else if(fixed) emp.extraWork[key].push(dateStr);
        else emp.extraOff[key].push(dateStr);
      }

      await save();
      renderCalendar();
    });
  });
};

const escapeHtml = (s) => (s||"").toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

// ---------- Modal Logic ----------
const openModal = (empId) => {
  const emp = empId ? getEmployeeById(empId) : null;
  draft = emp ? structuredClone(emp) : { id: uid(), name: "", matricula: "", cargo: "", offWeekdays: [], extraOff: {}, extraWork: {}, sundayWork: {}, absence: null };
  draft.extraOff ||= {}; draft.extraWork ||= {}; draft.sundayWork ||= {}; draft.cargo ||= "";
  if(draft.absence === undefined) draft.absence = null;
  state.selectedEmployeeId = empId || null;

  $("#modalTitle").textContent = emp ? "Editar colaborador" : "Adicionar colaborador";
  $("#mName").value = draft.name || ""; $("#mMat").value = draft.matricula || "";
  $("#mCargo") && ($("#mCargo").value = draft.cargo || "");
  if($("#mAbsType")) $("#mAbsType").value = draft.absence?.type || "";
  if($("#mAbsStart")) $("#mAbsStart").value = draft.absence?.start || "";
  if($("#mAbsEnd")) $("#mAbsEnd").value = draft.absence?.end || "";

  const wrap = $("#mWeekdays"); wrap.innerHTML = "";
  for(const w of WEEKDAYS){
    const label = document.createElement("label"); label.className = "wday";
    label.innerHTML = `<input type="checkbox" id="w${w.i}"/> <span><b>${w.short}</b> • ${w.full}</span>`;
    const cb = $("input", label); cb.checked = (draft.offWeekdays||[]).includes(w.i);
    cb.addEventListener("change", () => {
      draft.offWeekdays ||= [];
      if(cb.checked && !draft.offWeekdays.includes(w.i)) draft.offWeekdays.push(w.i);
      else draft.offWeekdays = draft.offWeekdays.filter(x => x !== w.i);
    });
    wrap.appendChild(label);
  }
  renderExtraLists(); renderSundayWork();
  $("#btnDelete").hidden = !emp;
  $("#modal").classList.add("show"); $("#modal").setAttribute("aria-hidden","false");
};

const closeModal = () => { draft = null; $("#modal").classList.remove("show"); $("#modal").setAttribute("aria-hidden","true"); };

const renderExtraLists = () => {
  const key = monthKey();
  const off = (draft.extraOff?.[key] || []).slice().sort();
  const work = (draft.extraWork?.[key] || []).slice().sort();
  const boxOff = $("#listExtraOff"); const boxWork = $("#listExtraWork");
  boxOff.innerHTML = ""; boxWork.innerHTML = "";

  const mkPill = (date, kind) => {
    const p = document.createElement("span"); p.className = "pill"; p.innerHTML = `<span>${date}</span> <span class="muted">✕</span>`;
    p.addEventListener("click", () => {
      if(kind === "off") draft.extraOff[key] = (draft.extraOff[key]||[]).filter(x => x !== date);
      else draft.extraWork[key] = (draft.extraWork[key]||[]).filter(x => x !== date);
      renderExtraLists();
    });
    return p;
  };
  if(!off.length) boxOff.innerHTML = `<span class="small muted">—</span>`; else off.forEach(d => boxOff.appendChild(mkPill(d, "off")));
  if(!work.length) boxWork.innerHTML = `<span class="small muted">—</span>`; else work.forEach(d => boxWork.appendChild(mkPill(d, "work")));
};

const renderSundayWork = () => {
  const key = monthKey(); draft.sundayWork ||= {}; draft.sundayWork[key] ||= [];
  const selected = new Set(draft.sundayWork[key]);
  const box = $("#mSundayWork"); if(!box) return; box.innerHTML = "";
  
  const daysInMonth = new Date(selectedYear, selectedMonth+1, 0).getDate();
  const sundays = [];
  for(let d=1; d<=daysInMonth; d++){
    const dt = new Date(selectedYear, selectedMonth, d);
    if(dt.getDay() === 0) sundays.push(dt);
  }
  if(!sundays.length){ box.innerHTML = `<span class="small muted">—</span>`; return; }
  sundays.forEach(dt => {
    const dayStr = ymd(dt); const el = document.createElement("label"); el.className = "sunday-item";
    el.innerHTML = `<input type="checkbox" ${selected.has(dayStr) ? "checked" : ""}/> <span><b>${dt.getDate()}</b> ${WEEKDAYS[0].short}</span>`;
    const cb = el.querySelector("input");
    cb.addEventListener("change", () => {
      const arr = new Set(draft.sundayWork[key] || []);
      if(cb.checked) arr.add(dayStr); else arr.delete(dayStr);
      draft.sundayWork[key] = Array.from(arr).sort();
    });
    box.appendChild(el);
  });
};

const addExtra = (kind) => {
  const key = monthKey(); const inp = kind === "off" ? $("#mExtraOff") : $("#mExtraWork"); const val = inp.value;
  if(!val) return; const dt = parseYMD(val); if(!dt) return;
  if(dt.getFullYear() !== selectedYear || dt.getMonth() !== selectedMonth){ alert("Data fora do mês."); return; }
  draft.extraOff ||= {}; draft.extraWork ||= {}; draft.extraOff[key] ||= []; draft.extraWork[key] ||= [];
  
  if(kind === "off"){
    if(!draft.extraOff[key].includes(val)) draft.extraOff[key].push(val);
    draft.extraWork[key] = (draft.extraWork[key]||[]).filter(x => x !== val);
  } else {
    if(!draft.extraWork[key].includes(val)) draft.extraWork[key].push(val);
    draft.extraOff[key] = (draft.extraOff[key]||[]).filter(x => x !== val);
  }
  inp.value = ""; renderExtraLists();
};

const saveDraft = async () => {
  draft.name = normalize($("#mName").value); draft.matricula = normalize($("#mMat").value);
  if(!draft.name){ alert("Informe o nome."); return; }
  const idx = state.employees.findIndex(e => e.id === draft.id);
  if(idx >= 0) state.employees[idx] = draft; else state.employees.push(draft);
  await save(); closeModal(); renderAll();
};

const deleteSelected = async () => {
  const id = state.selectedEmployeeId; if(!id) return;
  const emp = getEmployeeById(id); if(!emp || !confirm(`Excluir ${emp.name}?`)) return;
  state.employees = state.employees.filter(e => e.id !== id);
  await save(); closeModal(); renderAll();
};

// ---------- Events & Setup ----------
const bindEvents = () => {
  $("#search").addEventListener("input", renderEmployeeList);
  $("#cargoFilter")?.addEventListener("change", async (ev) => {
    selectedCargoFilter = ev.target.value || "__ALL__";
    state.cargoFilter = selectedCargoFilter;
    await save(); renderAll();
  });

  $("#btnAdd").addEventListener("click", () => openModal(null));
  $("#btnClose").addEventListener("click", closeModal);
  $("#btnCancel").addEventListener("click", closeModal);
  $("#btnSave").addEventListener("click", saveDraft);
  $("#btnDelete").addEventListener("click", deleteSelected);
  $("#btnAddExtraOff").addEventListener("click", () => addExtra("off"));
  $("#btnAddExtraWork").addEventListener("click", () => addExtra("work"));

  $("#mCargo")?.addEventListener("input", (ev) => { if(draft) draft.cargo = ev.target.value; });
  $("#mAbsType")?.addEventListener("change", (ev) => { if(!draft) return; const v = ev.target.value; if(!v){ draft.absence=null; $("#mAbsStart").value=""; $("#mAbsEnd").value=""; return;} draft.absence ||= {type:v,start:"",end:""}; draft.absence.type=v; });
  $("#mAbsStart")?.addEventListener("change", (ev) => { if(!draft) return; const v=ev.target.value; if(!v){ if(draft.absence) draft.absence.start=""; return;} draft.absence ||= {type:($("#mAbsType").value||"ferias"),start:"",end:""}; draft.absence.start=v; });
  $("#mAbsEnd")?.addEventListener("change", (ev) => { if(!draft) return; const v=ev.target.value; if(!v){ if(draft.absence) draft.absence.end=""; return;} draft.absence ||= {type:($("#mAbsType").value||"ferias"),start:"",end:""}; draft.absence.end=v; });
  $("#btnClearAbs")?.addEventListener("click", () => { if(!draft) return; draft.absence=null; if($("#mAbsType")) $("#mAbsType").value=""; if($("#mAbsStart")) $("#mAbsStart").value=""; if($("#mAbsEnd")) $("#mAbsEnd").value=""; });

  $("#csvFile").addEventListener("change", async (ev) => {
    const f = ev.target.files?.[0]; if(!f) return;
    const text = await f.text(); const imported = parseEmployeesCSV(text);
    const byMat = new Map(state.employees.filter(e=>e.matricula).map(e => [String(e.matricula), e]));
    for(const emp of imported){
      if(emp.matricula && byMat.has(String(emp.matricula))){
        const existing = byMat.get(String(emp.matricula));
        existing.name = emp.name || existing.name;
        if(emp.cargo) existing.cargo = emp.cargo;
        if(emp.absence) existing.absence = emp.absence;
      } else state.employees.push(emp);
    }
    await save(); renderAll(); ev.target.value = "";
  });

  $("#btnExportCSV").addEventListener("click", () => downloadText(exportEmployeesCSV(), `escala_${loggedInStore}_${new Date().toISOString().slice(0,10)}.csv`));

  $("#btnReset").addEventListener("click", async () => {
    if(!confirm(`Isso vai apagar TODOS os dados da loja ${loggedInStore} do servidor Firebase. Tem certeza absoluta?`)) return;
    state = { employees: [], selectedEmployeeId: null, cargoFilter: "__ALL__" };
    await save(); renderAll();
  });

  $("#btnPrint").addEventListener("click", () => window.print());
  $("#modal").addEventListener("click", (ev) => { if(ev.target === $("#modal")) closeModal(); });

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; $("#btnInstall").hidden = false; });
  $("#btnInstall").addEventListener("click", async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $("#btnInstall").hidden = true; });
};

const downloadText = (text, filename) => {
  const blob = new Blob([text], {type:"text/plain;charset=utf-8"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 500);
};

const renderAll = () => { updateCargoFilterOptions(); renderEmployeeList(); renderCalendar(); };

// ---------- Controle de Acesso (Login) ----------
const setupLogin = () => {
  const sel = $("#loginStore");
  // Preenche as lojas do objeto STORES
  Object.keys(STORES).forEach(s => sel.innerHTML += `<option value="${s}">${s}</option>`);

  $("#btnLogin").addEventListener("click", async () => {
    const s = sel.value;
    const p = $("#loginPassword").value;
    // Valida se a senha bate com a chave
    if(s && STORES[s] === p) {
      loggedInStore = s;
      sessionStorage.setItem("folgas_current_store", s);
      $("#loginOverlay").style.display = "none";
      $("#currentStoreBadge").textContent = `Loja: ${s}`;
      await initAfterLogin();
    } else {
      $("#loginError").style.display = "block";
    }
  });

  $("#btnLogout").addEventListener("click", () => {
    sessionStorage.removeItem("folgas_current_store");
    location.reload(); // Recarrega a página para voltar pra tela de login
  });

  if(loggedInStore) {
    $("#loginOverlay").style.display = "none";
    $("#currentStoreBadge").textContent = `Loja: ${loggedInStore}`;
    initAfterLogin();
  }
};

const initAfterLogin = async () => {
  if("serviceWorker" in navigator) try{ await navigator.serviceWorker.register("./sw.js"); }catch(_){}
  
  await load();
  
  for(const e of (state.employees||[])){
    e.offWeekdays ||= []; e.extraOff ||= {}; e.extraWork ||= {}; e.sundayWork ||= {}; e.cargo ||= "";
    if(e.absence === undefined) e.absence = null;
  }
  fillPickers();
  bindEvents();
  renderAll();
};

// Inicia o sistema travado na tela de login
setupLogin();