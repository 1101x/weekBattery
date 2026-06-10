import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ───────────── 상태 & 저장 ───────────── */
const KEY = 'finance-battery-v1';
const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
};
const state = Object.assign({ budget: 200000, entries: [] }, load());
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

/* 이번 주(월요일 시작) */
function weekStart(d = new Date()) {
  const x = new Date(d); x.setHours(0,0,0,0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
function weekEnd(d = new Date()) {
  const s = weekStart(d);
  const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999);
  return e;
}
const inThisWeek = e => {
  const t = new Date(e.ts).getTime();
  return t >= weekStart().getTime() && t <= weekEnd().getTime();
};
const weekEntries = () => state.entries.filter(inThisWeek).sort((a,b) => b.ts - a.ts);
const weekSpent   = () => weekEntries().reduce((s,e) => s + e.amount, 0);
const won         = n => n.toLocaleString('ko-KR') + '원';
const parseNum    = v => parseInt(String(v).replace(/[^0-9]/g, ''), 10);

/* ───────────── 3D 배터리 (가로형 + 액체 채움) ───────────── */
const C_GREEN  = new THREE.Color(0x39ff14);
const C_YELLOW = new THREE.Color(0xffdd00);
const C_RED    = new THREE.Color(0xff2200);

function getUsageColor(p) {
  const c = new THREE.Color();
  if (p < 0.5) c.lerpColors(C_GREEN, C_YELLOW, p * 2);
  else          c.lerpColors(C_YELLOW, C_RED, (p - 0.5) * 2);
  return c;
}

const canvas = document.getElementById('battery-canvas');
const wrap   = document.getElementById('battery-wrap');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 0.4, 9.5);
camera.lookAt(0, 0, 0);

/* 조명 */
scene.add(new THREE.AmbientLight(0x223344, 1.2));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(3, 5, 6); scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0xffeedd, 0.35);
rimLight.position.set(-5, -2, 3); scene.add(rimLight);

/* 채움 엣지 글로우 포인트라이트 */
const fillGlow = new THREE.PointLight(0x39ff14, 3.5, 7);
fillGlow.position.set(0, 0, 2);
scene.add(fillGlow);

const battery = new THREE.Group();
scene.add(battery);

/* ── 배터리 치수 (가로형) ── */
const BW = 5.8, BH = 2.7, BD = 1.6, CORNER = 0.38;

/* 유리 케이스 */
const shellMat = new THREE.MeshPhysicalMaterial({
  color: 0xddeeff,
  metalness: 0.0,
  roughness: 0.07,
  transmission: 0.88,
  thickness: 0.5,
  ior: 1.46,
  clearcoat: 1.0,
  clearcoatRoughness: 0.06,
  attenuationColor: 0xbbccee,
  attenuationDistance: 5,
  transparent: true,
  opacity: 0.72,
});
const shell = new THREE.Mesh(new RoundedBoxGeometry(BW, BH, BD, 6, CORNER), shellMat);
battery.add(shell);

/* 뒷면 금속 테두리 */
battery.add(new THREE.Mesh(
  new RoundedBoxGeometry(BW + 0.1, BH + 0.1, BD + 0.1, 6, CORNER + 0.05),
  new THREE.MeshPhysicalMaterial({
    color: 0x8899bb, metalness: 0.65, roughness: 0.3,
    transparent: true, opacity: 0.18, side: THREE.BackSide,
  })
));

/* +단자 (오른쪽) */
const nub = new THREE.Mesh(
  new RoundedBoxGeometry(0.44, 1.05, 0.85, 4, 0.15),
  new THREE.MeshPhysicalMaterial({ color: 0x9aabcc, roughness: 0.28, metalness: 0.72, clearcoat: 1.0 })
);
nub.position.x = BW / 2 + 0.16;
battery.add(nub);

/* ── 채움 메시 (사용량에 비례해 왼쪽→오른쪽 채움) ── */
const FW = BW - 0.38;   // 내부 최대 폭
const FH = BH - 0.38;   // 내부 높이
const FD = BD - 0.32;   // 내부 깊이

const fillMat = new THREE.MeshStandardMaterial({
  color: C_GREEN,
  emissive: C_GREEN,
  emissiveIntensity: 0.65,
  roughness: 0.22,
  metalness: 0.08,
  transparent: true,
  opacity: 0.93,
});
const fillMesh = new THREE.Mesh(new THREE.BoxGeometry(FW, FH, FD), fillMat);
battery.add(fillMesh);

/* 채움 오른쪽 엣지 글로우 슬라이스 */
const edgeMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xffffff,
  emissiveIntensity: 2.2,
  roughness: 0.08,
  transparent: true,
  opacity: 0.72,
});
const edgeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, FH * 0.92, FD * 0.92), edgeMat);
battery.add(edgeMesh);

/* 빈 영역 (어두운 반투명 내부) */
const emptyMat = new THREE.MeshStandardMaterial({
  color: 0x050a14,
  roughness: 0.8,
  transparent: true,
  opacity: 0.45,
});
const emptyMesh = new THREE.Mesh(new THREE.BoxGeometry(FW, FH, FD), emptyMat);
battery.add(emptyMesh);

/* ── 레벨 업데이트 ── */
// level: 0=아무것도 안 씀(빈 배터리), 1=예산 다 씀(꽉 찬 배터리)
let level = 0, targetLevel = 0;
function setLevel(usagePct) { targetLevel = Math.max(0, Math.min(1, usagePct)); }

function updateFill(t) {
  const lv = Math.max(0.0001, level);

  /* 채움 메시: 왼쪽 정렬 스케일 */
  fillMesh.scale.x = lv;
  fillMesh.position.x = FW * (lv - 1) / 2;

  /* 빈 영역: 오른쪽 정렬 */
  const emptyLv = Math.max(0.0001, 1 - lv);
  emptyMesh.scale.x = emptyLv;
  emptyMesh.position.x = FW * (1 - emptyLv) / 2;

  /* 엣지 글로우 */
  const edgeX = fillMesh.position.x + FW * lv / 2;
  edgeMesh.position.x = edgeX;
  edgeMesh.visible = lv > 0.015;

  /* 색상 */
  const col = getUsageColor(level);
  fillMat.color.copy(col);
  fillMat.emissive.copy(col);
  fillMat.emissiveIntensity = 0.55 + Math.sin(t * 0.0025) * 0.1;
  edgeMat.color.copy(col);
  edgeMat.emissive.copy(col);

  /* 글로우 라이트 */
  fillGlow.color.copy(col);
  fillGlow.position.x = edgeX + 0.4;
  fillGlow.intensity = 2.5 + Math.sin(t * 0.003) * 0.5;
}

/* ── 드래그 회전 ── */
let dragging = false, px = 0, py = 0, spinY = 0.0028, inertiaX = 0, inertiaY = 0;
wrap.addEventListener('pointerdown', e => {
  dragging = true; px = e.clientX; py = e.clientY;
  wrap.setPointerCapture(e.pointerId);
});
wrap.addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - px, dy = e.clientY - py;
  px = e.clientX; py = e.clientY;
  battery.rotation.y += dx * 0.008;
  battery.rotation.x += dy * 0.008;
  inertiaY = dx * 0.008; inertiaX = dy * 0.008;
});
const endDrag = () => dragging = false;
wrap.addEventListener('pointerup', endDrag);
wrap.addEventListener('pointercancel', endDrag);

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);
resize();

let lastT = 0;
renderer.setAnimationLoop((t) => {
  const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
  lastT = t;

  if (!dragging) {
    battery.rotation.y += spinY + inertiaY;
    battery.rotation.x += inertiaX;
    inertiaY *= 0.94; inertiaX *= 0.94;
    // 살짝 기울기 복원
    battery.rotation.x += (-battery.rotation.x) * 0.01;
  }

  level += (targetLevel - level) * 0.055;
  updateFill(t);
  renderer.render(scene, camera);
});

/* ───────────── UI ───────────── */
const $ = s => document.querySelector(s);
const screens = document.querySelectorAll('.screen');
let stack = ['screen-main'];

function show(id) {
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  if (id !== stack[stack.length-1]) stack.push(id);
  if (id === 'screen-main') { stack = ['screen-main']; resize(); }
}
document.querySelectorAll('[data-back]').forEach(b =>
  b.addEventListener('click', () => { stack.pop(); show(stack[stack.length-1] || 'screen-main'); })
);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 1800);
}

function refresh() {
  const spent  = weekSpent();
  const remain = Math.max(0, state.budget - spent);
  const usagePct = state.budget > 0 ? Math.min(1, spent / state.budget) : 0;

  setLevel(usagePct);

  const pctEl = $('#pct');
  pctEl.textContent = Math.round(usagePct * 100) + '%';
  pctEl.classList.toggle('low', usagePct >= 0.8);
  $('#remain').textContent = `남은 예산 ${won(remain)} / ${won(state.budget)}`;
}

/* 메인 버튼 */
$('#btn-settings').addEventListener('click', () => {
  $('#input-budget').value = state.budget || '';
  show('screen-budget');
});
$('#btn-add').addEventListener('click', () => {
  $('#input-paste').value = '';
  $('#input-name').value = '';
  $('#input-amount').value = '';
  $('#parse-preview').classList.remove('show');
  show('screen-add');
});
$('#btn-history').addEventListener('click', () => { renderHistory(); show('screen-history'); });

/* 예산 저장 */
$('#btn-save-budget').addEventListener('click', () => {
  const v = parseNum($('#input-budget').value);
  if (!v || v <= 0) { toast('예산을 입력해주세요'); return; }
  state.budget = v;
  save(); refresh();
  show('screen-main');
  toast('예산이 저장되었습니다');
});

/* 문자 파싱 */
function parseSMS(text) {
  if (!text.trim()) return null;
  const amtMatch = text.match(/([0-9][0-9,]*)\s*원/) || text.match(/(?:금액|승인)[^\d]*([0-9][0-9,]*)/);
  const amount = amtMatch ? parseInt(amtMatch[1].replace(/,/g, ''), 10) : null;
  let name = null;
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const skip = /승인|체크|신용|일시불|할부|누적|잔액|원|\d{2}\/\d{2}|\d{2}:\d{2}|카드|[*]|Web발신/;
  for (const l of lines) {
    if (!skip.test(l) && /[가-힣A-Za-z]/.test(l)) { name = l; break; }
  }
  if (!name) {
    const after = text.match(/원\s+([가-힣A-Za-z][가-힣A-Za-z0-9 ]{1,20})/);
    if (after) name = after[1].trim();
  }
  return amount ? { amount, name } : null;
}

$('#input-paste').addEventListener('input', e => {
  const r = parseSMS(e.target.value);
  const pv = $('#parse-preview');
  if (r) {
    if (r.name) $('#input-name').value = r.name;
    $('#input-amount').value = r.amount.toLocaleString('ko-KR');
    pv.innerHTML = `인식됨 → <b>${r.name || '사용처 미인식'}</b> · <b>${won(r.amount)}</b>`;
    pv.classList.add('show');
  } else {
    pv.classList.remove('show');
  }
});

/* 내역 추가 */
$('#btn-save-entry').addEventListener('click', () => {
  const name   = $('#input-name').value.trim() || '내역';
  const amount = parseNum($('#input-amount').value);
  if (!amount || amount <= 0) { toast('금액을 입력해주세요'); return; }
  state.entries.push({ id: Date.now(), name, amount, ts: Date.now() });
  save(); refresh();
  show('screen-main');
  toast(`${name} ${won(amount)} 추가됨`);
});

/* 내역 화면 */
function renderHistory() {
  const s = weekStart(), e = weekEnd();
  const fmt = d => `${d.getMonth()+1}.${d.getDate()}`;
  $('#week-range').textContent = `${fmt(s)} (월) ~ ${fmt(e)} (일)`;
  $('#week-total').textContent = won(weekSpent());
  const list  = $('#entry-list');
  const items = weekEntries();
  if (!items.length) {
    list.innerHTML = '<li class="empty">아직 사용 내역이 없습니다</li>';
    return;
  }
  list.innerHTML = items.map(it => {
    const d   = new Date(it.ts);
    const day = ['일','월','화','수','목','금','토'][d.getDay()];
    return `<li class="entry" data-id="${it.id}">
      <div class="info">
        <div class="name">${it.name.replace(/</g,'&lt;')}</div>
        <div class="date">${d.getMonth()+1}.${d.getDate()} (${day})</div>
      </div>
      <span class="amount">-${won(it.amount)}</span>
      <button class="del" title="삭제">✕</button>
    </li>`;
  }).join('');
}
$('#entry-list').addEventListener('click', e => {
  if (!e.target.classList.contains('del')) return;
  const li = e.target.closest('.entry');
  const id = Number(li.dataset.id);
  state.entries = state.entries.filter(x => x.id !== id);
  save(); refresh(); renderHistory();
});

refresh();
