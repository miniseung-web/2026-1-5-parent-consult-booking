import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, getDoc, getDocs, setDoc,
  deleteDoc, runTransaction, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ① Firebase Console에서 웹 앱을 만든 뒤 아래 값만 교체하세요. */
const firebaseConfig = {
  apiKey: "AIzaSyCt2K02qxKyqw_sjHS7DMeTRel_UV7E4Dw",
  authDomain: "project-1887607634176513143.firebaseapp.com",
  projectId: "project-1887607634176513143",
  storageBucket: "project-1887607634176513143.firebasestorage.app",
  messagingSenderId: "712983097804",
  appId: "1:712983097804:web:bf69e83dee8f8c43c02d69",
  measurementId: "G-F532KSS7XE"
};

/* ② 관리자 비밀번호. 실제 배포 전 반드시 변경하세요.
   간편 운영용 비밀번호이며, 고보안 인증 방식은 아닙니다. */
const ADMIN_PASSWORD = "2026";

/* 다음 주: 2026.08.31(월) ~ 09.04(금)
   시간대는 관리자 화면의 + 버튼으로 직접 추가합니다. */
const DAYS = [
  { id:"2026-08-31", label:"8월 31일", weekday:"월요일" },
  { id:"2026-09-01", label:"9월 1일",  weekday:"화요일" },
  { id:"2026-09-02", label:"9월 2일",  weekday:"수요일" },
  { id:"2026-09-03", label:"9월 3일",  weekday:"목요일" },
  { id:"2026-09-04", label:"9월 4일",  weekday:"금요일" }
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = id => document.getElementById(id);
const scheduleWrap = $("scheduleWrap");
const studentName = $("studentName");
const parentName = $("parentName");
const phone = $("phone");
const toast = $("toast");

const bookingDialog = $("bookingDialog");
const bookingSummary = $("bookingSummary");
const bookingConfirmBtn = $("bookingConfirmBtn");

const adminDialog = $("adminDialog");
const adminOpenBtn = $("adminOpenBtn");
const adminLoginPanel = $("adminLoginPanel");
const adminPanel = $("adminPanel");
const adminPassword = $("adminPassword");
const adminLoginBtn = $("adminLoginBtn");
const adminDays = $("adminDays");
const bookingList = $("bookingList");
const refreshAdminBtn = $("refreshAdminBtn");

const timeDialog = $("timeDialog");
const timeDialogTitle = $("timeDialogTitle");
const newTimeInput = $("newTimeInput");
const addTimeBtn = $("addTimeBtn");

let schedules = new Map(DAYS.map(d => [d.id, []]));
let bookings = new Map();
let selected = null;
let addingDay = null;
let adminUnlocked = false;
let myBookingId = localStorage.getItem("parentConsultBookingId") || null;

function showToast(msg, error=false){
  toast.textContent = msg;
  toast.className = `toast show${error ? " error" : ""}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>toast.className="toast", 2600);
}

function slotId(dayId,time){
  return `${dayId}_${time.replace(":","-")}`;
}

function clean(v){
  return v.trim().replace(/\s+/g," ");
}

function validForm(){
  if(!clean(studentName.value)){ studentName.focus(); showToast("학생 이름을 입력해 주세요.",true); return false; }
  if(!clean(parentName.value)){ parentName.focus(); showToast("학부모 성함을 입력해 주세요.",true); return false; }
  return true;
}

function renderSchedule(){
  scheduleWrap.innerHTML = "";
  for(const day of DAYS){
    const times = [...(schedules.get(day.id)||[])].sort();
    const available = times.filter(t=>!bookings.has(slotId(day.id,t))).length;

    const section = document.createElement("section");
    section.className = "day-card";
    section.innerHTML = `
      <div class="day-head">
        <h3>${day.label} (${day.weekday})</h3>
        <span>${times.length ? `${available}개 신청 가능` : "시간 미등록"}</span>
      </div>
    `;

    if(!times.length){
      const empty = document.createElement("div");
      empty.className = "empty-slots";
      empty.textContent = "상담 시간이 아직 등록되지 않았습니다.";
      section.appendChild(empty);
    }else{
      const grid = document.createElement("div");
      grid.className = "slot-grid";

      for(const time of times){
        const id = slotId(day.id,time);
        const booked = bookings.get(id);
        const mine = myBookingId === id;

        const btn = document.createElement("button");
        btn.className = `slot${mine ? " mine" : ""}`;
        if(booked && !mine) btn.disabled = true;
        btn.innerHTML = `
          <span class="state">${mine ? "내 신청" : booked ? "마감" : "신청 가능"}</span>
          <strong>${time}</strong>
          <small>${booked && !mine ? "이미 마감된 시간입니다" : `${day.label} ${day.weekday}`}</small>
        `;

        if(!booked){
          btn.addEventListener("click",()=>{
            if(!validForm()) return;
            selected = { day, time, id };
            bookingSummary.innerHTML = `
              <strong>${day.label} (${day.weekday}) ${time}</strong><br>
              학생: ${clean(studentName.value)}<br>
              학부모: ${clean(parentName.value)}
              ${clean(phone.value) ? `<br>연락처: ${clean(phone.value)}` : ""}
            `;
            bookingDialog.showModal();
          });
        }else if(mine){
          btn.addEventListener("click",()=>showToast("이미 신청하신 시간입니다."));
        }

        grid.appendChild(btn);
      }
      section.appendChild(grid);
    }
    scheduleWrap.appendChild(section);
  }
}

async function confirmBooking(){
  if(!selected || !validForm()) return;
  bookingConfirmBtn.disabled = true;
  try{
    if(myBookingId){
      throw new Error("이미 신청하신 상담 시간이 있습니다.");
    }

    const bookingRef = doc(db,"bookings",selected.id);
    await runTransaction(db, async tx=>{
      const current = await tx.get(bookingRef);
      if(current.exists()){
        throw new Error("이미 마감된 시간입니다.");
      }
      tx.set(bookingRef,{
        studentName: clean(studentName.value),
        parentName: clean(parentName.value),
        phone: clean(phone.value),
        dayId: selected.day.id,
        dayLabel: selected.day.label,
        weekday: selected.day.weekday,
        time: selected.time,
        createdAt: serverTimestamp()
      });
    });

    myBookingId = selected.id;
    localStorage.setItem("parentConsultBookingId", myBookingId);
    showToast("상담 신청이 완료되었습니다.");
  }catch(e){
    showToast(e.message || "신청 중 오류가 발생했습니다.", true);
  }finally{
    bookingConfirmBtn.disabled = false;
    selected = null;
  }
}

bookingConfirmBtn.addEventListener("click", async e=>{
  e.preventDefault();
  bookingDialog.close();
  await confirmBooking();
});

/* 관리자 */
adminOpenBtn.addEventListener("click",()=>adminDialog.showModal());

adminLoginBtn.addEventListener("click",()=>{
  if(adminPassword.value !== ADMIN_PASSWORD){
    showToast("관리자 비밀번호가 올바르지 않습니다.",true);
    return;
  }
  adminUnlocked = true;
  adminLoginPanel.hidden = true;
  adminPanel.hidden = false;
  renderAdmin();
});

refreshAdminBtn.addEventListener("click",()=>renderAdmin());

function renderAdmin(){
  if(!adminUnlocked) return;

  adminDays.innerHTML = "";
  for(const day of DAYS){
    const box = document.createElement("div");
    box.className = "admin-day";
    const times = [...(schedules.get(day.id)||[])].sort();

    const head = document.createElement("div");
    head.className = "admin-day-head";
    head.innerHTML = `<strong>${day.label} (${day.weekday})</strong>`;

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "plus-btn";
    plus.textContent = "+";
    plus.title = "시간 추가";
    plus.addEventListener("click",()=>{
      addingDay = day;
      timeDialogTitle.textContent = `${day.label} (${day.weekday}) 시간 추가`;
      newTimeInput.value = "";
      timeDialog.showModal();
    });
    head.appendChild(plus);
    box.appendChild(head);

    const tags = document.createElement("div");
    tags.className = "time-tags";
    if(!times.length){
      tags.innerHTML = `<span style="font-size:12px;color:#98a2b3">등록된 시간이 없습니다.</span>`;
    }else{
      for(const time of times){
        const tag = document.createElement("span");
        tag.className = "time-tag";
        const id = slotId(day.id,time);
        tag.innerHTML = `${time}`;
        const del = document.createElement("button");
        del.type = "button";
        del.textContent = "×";
        del.title = "시간 삭제";
        del.addEventListener("click", async ()=>{
          if(bookings.has(id)){
            showToast("이미 신청자가 있는 시간은 먼저 예약을 취소해 주세요.",true);
            return;
          }
          await deleteDoc(doc(db,"schedules",id));
          showToast("시간을 삭제했습니다.");
        });
        tag.appendChild(del);
        tags.appendChild(tag);
      }
    }
    box.appendChild(tags);
    adminDays.appendChild(box);
  }

  bookingList.innerHTML = "";
  const ordered = [...bookings.entries()].sort((a,b)=>{
    const A=a[1], B=b[1];
    return `${A.dayId}_${A.time}`.localeCompare(`${B.dayId}_${B.time}`);
  });

  if(!ordered.length){
    bookingList.innerHTML = `<div style="font-size:13px;color:#98a2b3">아직 신청 내역이 없습니다.</div>`;
  }else{
    for(const [id,b] of ordered){
      const row = document.createElement("div");
      row.className = "booking-row";
      const info = document.createElement("div");
      info.innerHTML = `
        <strong>${b.dayLabel} (${b.weekday}) ${b.time} · ${b.studentName}</strong>
        <p>학부모 ${b.parentName}${b.phone ? ` · ${b.phone}` : ""}</p>
      `;
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "cancel-booking";
      cancel.textContent = "예약 취소";
      cancel.addEventListener("click", async ()=>{
        if(!confirm(`${b.studentName} 학생의 ${b.dayLabel} ${b.time} 예약을 취소할까요?`)) return;
        await deleteDoc(doc(db,"bookings",id));
        showToast("예약을 취소했습니다.");
      });
      row.append(info,cancel);
      bookingList.appendChild(row);
    }
  }
}

addTimeBtn.addEventListener("click", async ()=>{
  if(!addingDay) return;
  const time = newTimeInput.value;
  if(!time){
    showToast("추가할 시간을 선택해 주세요.",true);
    return;
  }
  const id = slotId(addingDay.id,time);
  try{
    const ref = doc(db,"schedules",id);
    const existing = await getDoc(ref);
    if(existing.exists()){
      showToast("이미 등록된 시간입니다.",true);
      return;
    }
    await setDoc(ref,{
      dayId: addingDay.id,
      dayLabel: addingDay.label,
      weekday: addingDay.weekday,
      time
    });
    timeDialog.close();
    showToast("상담 시간을 추가했습니다.");
  }catch(e){
    showToast("시간 추가 중 오류가 발생했습니다.",true);
  }
});

/* 실시간 데이터 */
onSnapshot(collection(db,"schedules"), snap=>{
  schedules = new Map(DAYS.map(d=>[d.id,[]]));
  snap.forEach(d=>{
    const v=d.data();
    if(schedules.has(v.dayId)) schedules.get(v.dayId).push(v.time);
  });
  renderSchedule();
  renderAdmin();
},err=>{
  console.error(err);
  renderSchedule();
  showToast("Firebase 설정을 확인해 주세요.",true);
});

onSnapshot(collection(db,"bookings"), snap=>{
  bookings = new Map();
  snap.forEach(d=>bookings.set(d.id,d.data()));
  renderSchedule();
  renderAdmin();
},err=>{
  console.error(err);
});

/* 초기 화면 */
renderSchedule();
