// assets/js/app.js - improved loadQuestions with fallback to raw.githubusercontent and cache-bust
const QUESTIONS_URL = 'data/questions.json';

let questions = [];
let state = {
  level: 'PCEP',
  requestedCount: 10,
  index: 0,
  answers: {},
  timed: false,
  timeLeft: 0,
  timerId: null,
  sessionQuestions: []
};

function el(id){ return document.getElementById(id); }

async function loadQuestions(){
  const LOCAL = QUESTIONS_URL;
  const FALLBACK = 'https://raw.githubusercontent.com/sultanshehri1/python-pcep-exam/feature/interactive-exam/data/questions.json';

  try{
    // try local first (no-store to avoid cached stale copy)
    let res = await fetch(LOCAL, {cache: 'no-store'});
    if(!res.ok){
      console.warn('Local fetch failed with', res.status, 'trying fallback...');
      // try fallback (cache-bust)
      res = await fetch(FALLBACK + '?t=' + Date.now(), {cache: 'no-store'});
    }

    if(!res.ok) throw new Error('فشل تحميل الأسئلة (status: ' + res.status + ')');

    const data = await res.json();
    if(!Array.isArray(data)) throw new Error('تنسيق ملف الأسئلة غير صحيح');
    questions = data;
    console.log('Loaded questions:', questions.length);

  }catch(e){
    console.error('loadQuestions error', e);
    questions = [];
    // Inform user with actionable steps
    alert('تعذّر تحميل بنك الأسئلة حالياً. جرّب إعادة تحميل الصفحة بدون كاش (Ctrl+F5) أو تشغيل خادم محلي: "python -m http.server 8000" ثم افتح http://localhost:8000/. راجع Console للمزيد من التفاصيل.');
  }
}

function start(){
  state.level = el('level').value;
  state.requestedCount = parseInt(el('count').value,10) || 10;
  state.timed = el('timed').checked;
  state.answers = {};

  // تجميع الأسئلة: مستوى المستخدم أولاً ثم الباقي
  const byLevel = questions.filter(q => q.level === state.level);
  const others = questions.filter(q => q.level !== state.level);

  // pool يعطي أولوية لأسئلة نفس المستوى
  const pool = [];
  // أضف أولاً أسئلة بنفس المستوى
  pool.push(...byLevel);
  // ثم أضف الباقي
  pool.push(...others);

  if(pool.length === 0){
    alert('لا توجد أسئلة في البنك حالياً. الرجاء إضافة أسئلة إلى data/questions.json أو تأكد من أن الملف تم تحميله بنجاح.');
    return;
  }

  // الآن نملأ الجلسة بحيث نصل للعدد المطلوب حتى لو اضطررنا للتكرار
  const session = [];
  for(let i = 0; i < state.requestedCount; i++){
    const item = pool[i % pool.length];
    session.push(item);
  }

  // نخلط الجلسة كي لا تظهر الأسئلة في ترتيب ثابت
  shuffle(session);

  // أخيراً نعطي sessionQuestions
  state.sessionQuestions = session;
  state.count = state.sessionQuestions.length;
  state.index = 0;
  showExam();
}

function showExam(){
  el('start-screen').classList.add('hidden');
  el('exam-screen').classList.remove('hidden');
  el('q-total').textContent = state.count;
  renderQuestion();
}

function renderQuestion(){
  const q = state.sessionQuestions[state.index];
  el('q-index').textContent = state.index + 1;
  const area = el('question-area');
  area.innerHTML = '';

  const top = document.createElement('div');
  top.className = 'prompt';
  top.textContent = q.prompt;
  area.appendChild(top);

  if(q.type === 'multiple_choice'){
    q.choices.forEach((c) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="choice" value="${escapeHtml(c)}"> ${escapeHtml(c)}`;
      area.appendChild(label);
      area.appendChild(document.createElement('br'));
    });
  } else if(q.type === 'true_false'){
    ['True','False'].forEach(v => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="choice" value="${v}"> ${v}`;
      area.appendChild(label);
      area.appendChild(document.createElement('br'));
    });
  } else if(q.type === 'code_output'){
    const pre = document.createElement('pre');
    pre.textContent = q.code;
    area.appendChild(pre);
    area.appendChild(document.createElement('br'));
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'answer-input';
    input.placeholder = 'اكتب المخرج هنا';
    area.appendChild(input);
  } else if(q.type === 'fill_in_blank'){
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'answer-input';
    area.appendChild(input);
  } else {
    const note = document.createElement('div');
    note.textContent = 'نوع السؤال هذا مدعوم لاحقاً.';
    area.appendChild(note);
  }

  // تحميل إجابة حالية إن وجدت
  const saved = state.answers[q.id];
  if(saved){
    const radios = area.querySelectorAll('input[type=radio]');
    radios.forEach(r => { if(r.value === saved) r.checked = true; });
    const txt = area.querySelector('#answer-input');
    if(txt) txt.value = saved;
  }
}

function nextQuestion(){
  saveAnswer();
  if(state.index < state.count -1){
    state.index++;
    renderQuestion();
  }
}

function prevQuestion(){
  saveAnswer();
  if(state.index > 0){
    state.index--;
    renderQuestion();
  }
}

function saveAnswer(){
  const q = state.sessionQuestions[state.index];
  const radios = document.querySelectorAll('#question-area input[type=radio]');
  if(radios.length){
    const sel = Array.from(radios).find(r => r.checked);
    state.answers[q.id] = sel ? sel.value : null;
  } else {
    const txt = document.querySelector('#question-area #answer-input');
    if(txt) state.answers[q.id] = txt.value.trim();
  }
}

function finish(){
  saveAnswer();
  el('exam-screen').classList.add('hidden');
  el('result-screen').classList.remove('hidden');
  showResults();
}

function normalizeAnswer(s){
  if(s == null) return '';
  // تجاهل حالة الأحرف، فراغات متكررة، والإزاحة
  return String(s).trim().replace(/\s+/g,' ').toLowerCase();
}

function showResults(){
  let total = 0, earned = 0;
  const review = [];
  state.sessionQuestions.forEach(q => {
    total += (q.points || 1);
    const rawAns = state.answers[q.id];
    const ans = normalizeAnswer(rawAns);
    let ok = false;

    if(q.type === 'multiple_choice' || q.type === 'true_false'){
      ok = normalizeAnswer(q.answer) === ans;
    } else if(q.type === 'code_output' || q.type === 'fill_in_blank'){
      if(q.answer_regex){
        try{
          const re = new RegExp(q.answer_regex,'i');
          ok = re.test(rawAns || '');
        }catch(e){
          ok = normalizeAnswer(q.answer) === ans;
        }
      } else {
        ok = normalizeAnswer(q.answer) === ans;
      }
    }

    if(ok) earned += (q.points || 1);
    review.push({q, rawAns, ok});
  });

  // عرض النتيجة
  const percent = total ? Math.round(earned/total*100) : 0;
  el('score').innerHTML = `<div class="result-header"><div class="result-score">النقاط: ${earned} / ${total}</div><div class="result-percent">النسبة: ${percent}%</div></div>`;

  const rdiv = el('review');
  rdiv.innerHTML = '';
  review.forEach(item => {
    const d = document.createElement('div');
    d.className = 'review-item';

    const badge = item.ok ? `<span class="correct-badge">صحيح</span>` : `<span class="wrong-badge">خاطئ</span>`;
    const correctText = item.q.answer || (item.q.answer_regex || '');

    d.innerHTML = `
      <h4>${escapeHtml(item.q.prompt)}</h4>
      <p class="small">إجابتك: <strong>${escapeHtml(item.rawAns || '')}</strong></p>
      <p class="small">الصحيحة: <strong>${escapeHtml(correctText)}</strong></p>
      <p class="small">النتيجة: ${badge}</p>
      <p class="small">شرح: ${escapeHtml(item.q.explanation || '')}</p>
    `;
    rdiv.appendChild(d);
  });
}

function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } }
function escapeHtml(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

document.addEventListener('DOMContentLoaded', async () => {
  await loadQuestions();
  el('start-btn').addEventListener('click', start);
  el('next-btn').addEventListener('click', nextQuestion);
  el('prev-btn').addEventListener('click', prevQuestion);
  el('finish-btn').addEventListener('click', finish);
  el('home-btn').addEventListener('click', () => location.reload());
});
