import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, getDoc, setDoc, deleteDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const firebaseConfig={apiKey:"AIzaSyCt2K02qxKyqw_sjHS7DMeTReL_UV7E4Dw",authDomain:"project-1887607634176513143.firebaseapp.com",projectId:"project-1887607634176513143",storageBucket:"project-1887607634176513143.firebasestorage.app",messagingSenderId:"712983097804",appId:"1:712983097804:web:bf69e83deef8fc43c02d69"};
const ADMIN_PASSWORD="2026";const db=getFirestore(initializeApp(firebaseConfig));
const normal=[["1교시","09:00","09:45"],["2교시","09:50","10:35"],["3교시","10:40","11:25"],["4교시","11:30","12:15"],["5교시","13:00","13:45"],["6교시","13:50","14:35"],["7교시","14:40","15:25"]];
const monday=[["1교시","09:00","09:35"],["2교시","09:45","10:20"],["3교시","10:30","11:05"],["4교시","11:15","11:50"],["5교시","12:40","13:15"],["6교시","13:25","14:00"],["7교시","14:10","14:45"]];
const DAYS=[{id:"2026-08-31",label:"8월 31일",weekday:"월요일",short:true,periods:monday,teaching:[0,1,3,5]},{id:"2026-09-01",label:"9월 1일",weekday:"화요일",short:false,periods:normal,teaching:[3,5,6]},{id:"2026-09-02",label:"9월 2일",weekday:"수요일",short:false,periods:normal,teaching:[2,4,5]},{id:"2026-09-03",label:"9월 3일",weekday:"목요일",short:false,periods:normal,teaching:[0,2,3,5,6]},{id:"2026-09-04",label:"9월 4일",weekday:"금요일",short:false,periods:normal,teaching:[1,2,4,5]}];
const $=id=>document.getElementById(id);let enabled=new Map(),bookings=new Map(),locks=new Map(),selected=null,cancelTarget=null,admin=false,globalClosed=false;let myIds=new Set(JSON.parse(localStorage.getItem("parentConsultBookingIds")||"[]"));
function showToast(m,e=false){const t=$("toast");t.textContent=m;t.className="toast show"+(e?" error":"");clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.className="toast",2400)}function clean(v){return v.trim().replace(/\s+/g," ")}function phoneNorm(v){return v.replace(/\D/g,"")}async function hashText(v){const data=new TextEncoder().encode(v),buf=await crypto.subtle.digest("SHA-256",data);return[...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("")}async function applicantKey(student,phone){return await hashText(clean(student).toLowerCase()+"|"+phoneNorm(phone))}function pk(d,i){return`${d}_p${i+1}`}function sid(d,s,e){return`${d}_${s.replace(":","-")}_${e.replace(":","-")}`}function mins(x){let[h,m]=x.split(":").map(Number);return h*60+m}function hm(n){return`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`}
function slots(day,p){let[n,s,e]=p;if(day.short)return[{periodName:n,start:s,end:e,label:`${s}~${e}`}];let x=mins(s);return[{periodName:n,start:s,end:hm(x+20),label:`${s}~${hm(x+20)}`},{periodName:n,start:hm(x+25),end:e,label:`${hm(x+25)}~${e}`}]}function mode(){return document.querySelector('input[name="mode"]:checked').value}function formOK(){if(globalClosed){showToast("현재 상담 신청이 마감되었습니다.",true);return false}if(!clean($("studentName").value)){showToast("학생 이름을 입력해 주세요.",true);return false}if(!clean($("parentName").value)){showToast("학부모 성함을 입력해 주세요.",true);return false}if(phoneNorm($("phone").value).length<10){showToast("연락처를 정확히 입력해 주세요.",true);return false}return true}function findBookingByLock(lockId){const l=locks.get(lockId);return l?bookings.get(l.bookingId):null}function periodLocks(day,p){return slots(day,p).map(s=>sid(day.id,s.start,s.end))}function periodHasAnyBooking(day,p){return periodLocks(day,p).some(id=>locks.has(id))}
document.querySelectorAll('input[name="mode"]').forEach(r=>r.addEventListener("change",render));
function render(){$("closedBanner").hidden=!globalClosed;const wrap=$("scheduleWrap");wrap.innerHTML="";const currentMode=mode();DAYS.forEach(day=>{const sec=document.createElement("section");sec.className="day-card";let choices=[];day.periods.forEach((p,i)=>{if(!enabled.get(pk(day.id,i)))return;if(currentMode==="inperson")choices.push({type:"inperson",periodIndex:i,periodName:p[0],start:p[1],end:p[2],label:`${p[1]}~${p[2]}`,locks:periodLocks(day,p),occupied:periodHasAnyBooking(day,p)});else slots(day,p).forEach(s=>{const lockId=sid(day.id,s.start,s.end);choices.push({type:"remote",periodIndex:i,...s,lockId,occupied:locks.has(lockId)})})});const openCount=choices.filter(c=>!c.occupied&&!globalClosed).length;sec.innerHTML=`<div class="day-head"><h3>${day.label} (${day.weekday})</h3><span>${choices.length?openCount+"개 신청 가능":"상담 시간 미등록"}</span></div>`;if(!choices.length)sec.innerHTML+=`<div class="empty-slots">상담 시간이 아직 등록되지 않았습니다.</div>`;else{const g=document.createElement("div");g.className="slot-grid";choices.forEach(c=>{let booking=null;if(c.type==="remote")booking=findBookingByLock(c.lockId);else if(c.occupied){for(const lid of c.locks){booking=findBookingByLock(lid);if(booking)break}}const mine=booking&&myIds.has(booking.id),bt=document.createElement("button");bt.className="slot"+(mine?" mine":"")+(c.type==="inperson"?" inperson":"");const unavailable=c.occupied||globalClosed;if(globalClosed&&!booking)bt.disabled=true;const status=mine?"내 신청":c.occupied?"마감":globalClosed?"신청 마감":"신청 가능";bt.innerHTML=`<span class="state">${status}</span><strong>${c.label}</strong><small>${c.periodName} · ${c.type==="inperson"?"대면":"비대면"}</small>`;if(!unavailable)bt.onclick=()=>openBooking(day,c);else if(booking){bt.disabled=false;bt.onclick=()=>openCancel(booking)}g.append(bt)});sec.append(g)}wrap.append(sec)})}
function openBooking(day,c){if(!formOK())return;selected={day,...c};$("bookingSummary").innerHTML=`<strong>${day.label} (${day.weekday}) ${c.label}</strong><br>${c.periodName} · ${c.type==="inperson"?"대면 상담":"비대면 상담"}<br>학생: ${clean($("studentName").value)}<br>학부모: ${clean($("parentName").value)}`;$("bookingDialog").showModal()}
$("bookingConfirmBtn").onclick=async e=>{
 e.preventDefault();
 $("bookingDialog").close();
 if(!selected||!formOK())return;

 const student=clean($("studentName").value);
 const parent=clean($("parentName").value);
 const phone=phoneNorm($("phone").value);
 const phoneHash=await hashText(phone);
 const aKey=await applicantKey(student,phone);
 const bookingId=selected.type==="inperson"
   ?`${selected.day.id}_p${selected.periodIndex+1}_face_${Date.now()}`
   :`${selected.lockId}_remote_${Date.now()}`;
 const lockIds=selected.type==="inperson"?selected.locks:[selected.lockId];

 try{
   const settingsSnap=await getDoc(doc(db,"settings","global"));
   if(settingsSnap.exists()&&settingsSnap.data().closed)throw Error("방금 상담 신청이 마감되었습니다.");

   await runTransaction(db,async tx=>{
     const applicantRef=doc(db,"applicants",aKey);
     const applicantSnap=await tx.get(applicantRef);
     if(applicantSnap.exists()){
       throw Error("이미 신청하신 상담 일정이 있습니다. 기존 신청을 취소한 후 다시 신청해 주세요.");
     }

     for(const lid of lockIds){
       const ls=await tx.get(doc(db,"locks",lid));
       if(ls.exists())throw Error("이미 마감된 시간입니다.");
     }

     const payload={
       id:bookingId,
       applicantKey:aKey,
       studentName:student,
       parentName:parent,
       phoneHash,
       phoneLast4:phone.slice(-4),
       dayId:selected.day.id,
       dayLabel:selected.day.label,
       weekday:selected.day.weekday,
       periodIndex:selected.periodIndex,
       periodName:selected.periodName,
       start:selected.start,
       end:selected.end,
       time:selected.label,
       mode:selected.type,
       lockIds,
       createdAt:serverTimestamp()
     };

     tx.set(doc(db,"bookings",bookingId),payload);
     tx.set(applicantRef,{
       bookingId,
       studentName:student,
       phoneLast4:phone.slice(-4),
       createdAt:serverTimestamp()
     });
     lockIds.forEach(lid=>tx.set(doc(db,"locks",lid),{bookingId,mode:selected.type}));
   });

   myIds.add(bookingId);
   localStorage.setItem("parentConsultBookingIds",JSON.stringify([...myIds]));
   $("successSummary").innerHTML=`<strong>${selected.day.label} (${selected.day.weekday}) ${selected.label}</strong><br>${selected.type==="inperson"?"대면 상담":"비대면 상담"}<br>${student} 학생`;
   $("successDialog").showModal();
 }catch(err){
   showToast(err.message||"신청 중 오류가 발생했습니다.",true);
 }
 selected=null;
};
function openCancel(booking){cancelTarget=booking;$("cancelSummary").innerHTML=`<strong>${booking.dayLabel} (${booking.weekday}) ${booking.time}</strong><br>${booking.mode==="inperson"?"대면 상담":"비대면 상담"} · ${booking.studentName} 학생`;$("cancelPhone").value="";$("cancelDialog").showModal()}
$("cancelConfirmBtn").onclick=async()=>{if(!cancelTarget)return;const p=phoneNorm($("cancelPhone").value);if(p.length<10)return showToast("연락처를 정확히 입력해 주세요.",true);const h=await hashText(p);if(h!==cancelTarget.phoneHash)return showToast("신청 당시 연락처와 일치하지 않습니다.",true);try{const bid=cancelTarget.id,lockIds=cancelTarget.lockIds||[];await runTransaction(db,async tx=>{const bs=await tx.get(doc(db,"bookings",bid));if(!bs.exists())throw Error("이미 취소된 신청입니다.");tx.delete(doc(db,"bookings",bid));if(cancelTarget.applicantKey)tx.delete(doc(db,"applicants",cancelTarget.applicantKey));lockIds.forEach(lid=>tx.delete(doc(db,"locks",lid)))});myIds.delete(bid);localStorage.setItem("parentConsultBookingIds",JSON.stringify([...myIds]));$("cancelDialog").close();showToast("상담 신청을 취소했습니다.")}catch(err){showToast(err.message||"취소 중 오류가 발생했습니다.",true)}cancelTarget=null};
$("adminOpenBtn").onclick=()=>$("adminDialog").showModal();$("adminLoginBtn").onclick=()=>{if($("adminPassword").value!==ADMIN_PASSWORD)return showToast("관리자 비밀번호가 올바르지 않습니다.",true);admin=true;$("adminLoginPanel").hidden=true;$("adminPanel").hidden=false;renderAdmin()};$("toggleGlobalCloseBtn").onclick=async()=>{const next=!globalClosed;await setDoc(doc(db,"settings","global"),{closed:next},{merge:true});showToast(next?"전체 신청을 마감했습니다.":"신청 마감을 취소했습니다.")};
function renderAdmin(){if(!admin)return;$("adminCloseText").textContent=globalClosed?"현재 전체 신청이 마감된 상태입니다.":"현재 신청을 받고 있습니다.";$("toggleGlobalCloseBtn").textContent=globalClosed?"마감 취소":"전체 신청 마감";$("toggleGlobalCloseBtn").className="btn "+(globalClosed?"primary":"danger");const ad=$("adminDays");ad.innerHTML="";DAYS.forEach(day=>{const c=document.createElement("section");c.className="admin-day";c.innerHTML=`<div class="admin-day-title"><strong>${day.label} (${day.weekday})</strong><span>${day.short?"단축수업 · 35분 1타임":"일반수업 · 비대면 20분×2 / 대면 교시 전체"}</span></div>`;day.periods.forEach((p,i)=>{const locked=day.teaching.includes(i),r=document.createElement("div");r.className="period-row";r.innerHTML=`<div class="period-name">${p[0]}</div><div class="period-time">${p[1]}~${p[2]}</div><div class="period-slots ${locked?"locked":""}">${locked?"수업 중":slots(day,p).map(x=>x.label).join(" / ")}</div>`;const lab=document.createElement("label");lab.className="toggle";const inp=document.createElement("input");inp.type="checkbox";inp.disabled=locked;inp.checked=!!enabled.get(pk(day.id,i));const sp=document.createElement("span");sp.className="slider";lab.append(inp,sp);r.append(lab);if(!locked)inp.onchange=async()=>{const key=pk(day.id,i),ref=doc(db,"availability",key);if(inp.checked)await setDoc(ref,{dayId:day.id,periodIndex:i,enabled:true});else{if(periodHasAnyBooking(day,p)){inp.checked=true;return showToast("예약이 있는 교시는 먼저 예약을 취소해 주세요.",true)}await deleteDoc(ref)}};c.append(r)});ad.append(c)});renderBookingBoard()}
function renderBookingBoard(){const board=$("adminBookingBoard");board.innerHTML="";DAYS.forEach(day=>{const published=day.periods.map((p,i)=>({p,i})).filter(x=>enabled.get(pk(day.id,x.i)));if(!published.length)return;const dayBox=document.createElement("section");dayBox.className="booking-day";dayBox.innerHTML=`<h4>${day.label} (${day.weekday})</h4>`;published.forEach(({p,i})=>{const pb=document.createElement("div");pb.className="booking-period";pb.innerHTML=`<div class="booking-period-head"><strong>${p[0]}</strong><span>${p[1]}~${p[2]}</span></div>`;const sg=document.createElement("div");sg.className="booking-slots",pslots=slots(day,p);let faceBooking=null;for(const s of pslots){const b=findBookingByLock(sid(day.id,s.start,s.end));if(b&&b.mode==="inperson"){faceBooking=b;break}}if(faceBooking)sg.append(personCard(faceBooking,`${p[1]}~${p[2]}`,true));else pslots.forEach(s=>{const b=findBookingByLock(sid(day.id,s.start,s.end));sg.append(b?personCard(b,s.label,false):emptyCard(s.label))});pb.append(sg);dayBox.append(pb)});board.append(dayBox)});if(!board.children.length)board.innerHTML=`<div style="font-size:13px;color:#98a2b3">공개된 상담 시간이 없습니다.</div>`}
function emptyCard(label){const d=document.createElement("div");d.className="booking-person empty";d.innerHTML=`<strong>${label}</strong><p>신청자 없음</p>`;return d}function personCard(b,label,face){const d=document.createElement("div");d.className="booking-person";d.innerHTML=`<span class="badge ${face?"face":""}">${face?"대면":"비대면"}</span><strong>${label} · ${b.studentName}</strong><p>학부모 ${b.parentName} · 연락처 끝 ${b.phoneLast4}</p>`;const x=document.createElement("button");x.className="admin-cancel";x.textContent="관리자 취소";x.onclick=async()=>{if(!confirm(`${b.studentName} 학생의 예약을 취소할까요?`))return;await adminCancel(b)};d.append(x);return d}async function adminCancel(b){await runTransaction(db,async tx=>{tx.delete(doc(db,"bookings",b.id));if(b.applicantKey)tx.delete(doc(db,"applicants",b.applicantKey));(b.lockIds||[]).forEach(lid=>tx.delete(doc(db,"locks",lid)))});showToast("예약을 취소했습니다.")}
onSnapshot(collection(db,"availability"),s=>{enabled=new Map();s.forEach(d=>enabled.set(d.id,true));render();renderAdmin()});onSnapshot(collection(db,"bookings"),s=>{bookings=new Map();s.forEach(d=>bookings.set(d.id,d.data()));render();renderAdmin()});onSnapshot(collection(db,"locks"),s=>{locks=new Map();s.forEach(d=>locks.set(d.id,d.data()));render();renderAdmin()});onSnapshot(doc(db,"settings","global"),s=>{globalClosed=s.exists()?!!s.data().closed:false;render();renderAdmin()});render();
