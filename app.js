
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCt2K02qxKyqw_sjHS7DMeTRel_UV7E4Dw",
  authDomain: "project-1887607634176513143.firebaseapp.com",
  projectId: "project-1887607634176513143",
  storageBucket: "project-1887607634176513143.firebasestorage.app",
  messagingSenderId: "712983097804",
  appId: "1:712983097804:web:bf69e83dee8f8c43c02d69",
  measurementId: "G-F532KSS7XE"
};
const ADMIN_PASSWORD="2026";
const db=getFirestore(initializeApp(firebaseConfig));

const normal=[["1교시","09:00","09:45"],["2교시","09:50","10:35"],["3교시","10:40","11:25"],["4교시","11:30","12:15"],["5교시","13:00","13:45"],["6교시","13:50","14:35"],["7교시","14:40","15:25"]];
const monday=[["1교시","09:00","09:35"],["2교시","09:45","10:20"],["3교시","10:30","11:05"],["4교시","11:15","11:50"],["5교시","12:40","13:15"],["6교시","13:25","14:00"],["7교시","14:10","14:45"]];
const DAYS=[
 {id:"2026-08-31",label:"8월 31일",weekday:"월요일",short:true,periods:monday,teaching:[0,1,3,5]},
 {id:"2026-09-01",label:"9월 1일",weekday:"화요일",short:false,periods:normal,teaching:[3,5,6]},
 {id:"2026-09-02",label:"9월 2일",weekday:"수요일",short:false,periods:normal,teaching:[2,4,5]},
 {id:"2026-09-03",label:"9월 3일",weekday:"목요일",short:false,periods:normal,teaching:[0,2,3,5,6]},
 {id:"2026-09-04",label:"9월 4일",weekday:"금요일",short:false,periods:normal,teaching:[1,2,4,5]}
];

const $=id=>document.getElementById(id);
let enabled=new Map(),bookings=new Map(),selected=null,admin=false,myId=localStorage.getItem("parentConsultBookingId");

function toast(m,e=false){const t=$("toast");t.textContent=m;t.className="toast show"+(e?" error":"");setTimeout(()=>t.className="toast",2300)}
function clean(v){return v.trim().replace(/\s+/g," ")}
function pk(d,i){return `${d}_p${i+1}`}
function sid(d,s,e){return `${d}_${s.replace(":","-")}_${e.replace(":","-")}`}
function mins(x){let[h,m]=x.split(":").map(Number);return h*60+m}
function hm(n){return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`}
function slots(day,p){let[n,s,e]=p;if(day.short)return[{periodName:n,start:s,end:e,label:`${s}~${e}`}];let x=mins(s);return[{periodName:n,start:s,end:hm(x+20),label:`${s}~${hm(x+20)}`},{periodName:n,start:hm(x+25),end:e,label:`${hm(x+25)}~${e}`}]}
function formOK(){if(!clean($("studentName").value)){toast("학생 이름을 입력해 주세요.",true);return false}if(!clean($("parentName").value)){toast("학부모 성함을 입력해 주세요.",true);return false}return true}

function render(){
 const wrap=$("scheduleWrap");wrap.innerHTML="";
 DAYS.forEach(day=>{
  let ss=[];day.periods.forEach((p,i)=>{if(enabled.get(pk(day.id,i)))ss.push(...slots(day,p))});
  const sec=document.createElement("section");sec.className="day-card";
  sec.innerHTML=`<div class="day-head"><h3>${day.label} (${day.weekday})</h3><span>${ss.length?ss.filter(s=>!bookings.has(sid(day.id,s.start,s.end))).length+"개 신청 가능":"상담 시간 미등록"}</span></div>`;
  if(!ss.length){sec.innerHTML+=`<div class="empty-slots">상담 시간이 아직 등록되지 않았습니다.</div>`}
  else{const g=document.createElement("div");g.className="slot-grid";ss.forEach(s=>{const id=sid(day.id,s.start,s.end),b=bookings.get(id),mine=myId===id;const bt=document.createElement("button");bt.className="slot"+(mine?" mine":"");if(b&&!mine)bt.disabled=true;bt.innerHTML=`<span class="state">${mine?"내 신청":b?"마감":"신청 가능"}</span><strong>${s.label}</strong><small>${s.periodName}${b&&!mine?" · 이미 마감된 시간입니다":""}</small>`;if(!b)bt.onclick=()=>{if(!formOK())return;selected={day,...s,id};$("bookingSummary").innerHTML=`<strong>${day.label} (${day.weekday}) ${s.label}</strong><br>${s.periodName}<br>학생: ${clean($("studentName").value)}<br>학부모: ${clean($("parentName").value)}`;$("bookingDialog").showModal()};g.append(bt)});sec.append(g)}
  wrap.append(sec)
 })
}

$("bookingConfirmBtn").onclick=async e=>{e.preventDefault();$("bookingDialog").close();if(!selected)return;try{if(myId)throw Error("이미 신청하신 상담 시간이 있습니다.");const r=doc(db,"bookings",selected.id);await runTransaction(db,async tx=>{const s=await tx.get(r);if(s.exists())throw Error("이미 마감된 시간입니다.");tx.set(r,{studentName:clean($("studentName").value),parentName:clean($("parentName").value),phone:clean($("phone").value),dayId:selected.day.id,dayLabel:selected.day.label,weekday:selected.day.weekday,periodName:selected.periodName,start:selected.start,end:selected.end,time:selected.label,createdAt:serverTimestamp()})});myId=selected.id;localStorage.setItem("parentConsultBookingId",myId);toast("상담 신청이 완료되었습니다.")}catch(err){toast(err.message,true)}};

$("adminOpenBtn").onclick=()=>$("adminDialog").showModal();
$("adminLoginBtn").onclick=()=>{if($("adminPassword").value!==ADMIN_PASSWORD)return toast("관리자 비밀번호가 올바르지 않습니다.",true);admin=true;$("adminLoginPanel").hidden=true;$("adminPanel").hidden=false;renderAdmin()};

function renderAdmin(){if(!admin)return;const ad=$("adminDays");ad.innerHTML="";DAYS.forEach(day=>{const c=document.createElement("section");c.className="admin-day";c.innerHTML=`<div class="admin-day-title"><strong>${day.label} (${day.weekday})</strong><span>${day.short?"단축수업 · 35분 1타임":"일반수업 · 20분×2타임"}</span></div>`;day.periods.forEach((p,i)=>{const locked=day.teaching.includes(i),r=document.createElement("div");r.className="period-row";r.innerHTML=`<div class="period-name">${p[0]}</div><div class="period-time">${p[1]}~${p[2]}</div><div class="period-slots ${locked?"locked":""}">${locked?"수업 중":slots(day,p).map(x=>x.label).join(" / ")}</div>`;const lab=document.createElement("label");lab.className="toggle";const inp=document.createElement("input");inp.type="checkbox";inp.disabled=locked;inp.checked=!!enabled.get(pk(day.id,i));const sp=document.createElement("span");sp.className="slider";lab.append(inp,sp);r.append(lab);if(!locked)inp.onchange=async()=>{const key=pk(day.id,i),ref=doc(db,"availability",key);if(inp.checked)await setDoc(ref,{dayId:day.id,periodIndex:i,enabled:true});else{const occ=slots(day,p).some(x=>bookings.has(sid(day.id,x.start,x.end)));if(occ){inp.checked=true;return toast("예약이 있는 교시는 먼저 예약을 취소해 주세요.",true)}await deleteDoc(ref)}};c.append(r)});ad.append(c)});
 const bl=$("bookingList");bl.innerHTML="";[...bookings.entries()].sort((a,b)=>(a[1].dayId+a[1].start).localeCompare(b[1].dayId+b[1].start)).forEach(([id,b])=>{const r=document.createElement("div");r.className="booking-row";r.innerHTML=`<div><strong>${b.dayLabel} ${b.time} · ${b.studentName}</strong><p>${b.periodName||""} · 학부모 ${b.parentName}${b.phone?" · "+b.phone:""}</p></div>`;const x=document.createElement("button");x.className="cancel-booking";x.textContent="예약 취소";x.onclick=async()=>{if(confirm("예약을 취소할까요?"))await deleteDoc(doc(db,"bookings",id))};r.append(x);bl.append(r)});if(!bookings.size)bl.innerHTML=`<div style="font-size:13px;color:#98a2b3">아직 신청 내역이 없습니다.</div>`
}

onSnapshot(collection(db,"availability"),s=>{enabled=new Map();s.forEach(d=>enabled.set(d.id,true));render();renderAdmin()});
onSnapshot(collection(db,"bookings"),s=>{bookings=new Map();s.forEach(d=>bookings.set(d.id,d.data()));render();renderAdmin()});
render();
