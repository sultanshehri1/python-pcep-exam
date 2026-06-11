// assets/js/app.js - نسخة محسّنة: تضمن احترام عدد الأسئلة المطلوب وتطبيع المقارنات
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
  try{
    const res = await fetch(QUESTIONS_URL);
    if(!res.ok) throw new Error('فشل تحميل الأسئلة');
    const data = await res.json();
    questions = data;
  }catch(e){
    console.error(e);
    questions = [];
  }
}

function start(){
  state.level = el('level').value;
  state.requestedCount = parseInt(el('count').value,10) || 10;
  state.timed = el('timed').checked;
  state.answers = {};

  // بناء مجموعة الأسئلة مع محاولة الوفاء بعدد الأسئلة المطلوب
  const byLevel = questions.filter(q => q.level === state.level);
  let session = [];

  // نسخ مجموعات لمساعدة الملء
  const others = questions.filter(q => q.level !== state.level);

  // خshuffle
  shuffle(byLevel);
  shuffle(others);

  // إملاء من المستوى أولاً
  session = session.concat(byLevel.slice(0));

  // إذا لم يكفِ، أضف من المستويات الأخرى (بدون تكرار)
  for(let i=0, j=0; session.length < state.requestedCount && j < others.length; j++){
    if(!session.find(s => s.id === others[j].id)) session.push(others[j]);
  }

  // إذا ما زلنا أقل من المطلوب، نُسمح بالتكرار بطريقة متعمدة (دوران)
  let k = 0;
  const combined = session.length ? session.slice(0) : questions.slice(0);
  while(session.length < state.requestedCount && combined.length > 0){
    session.push(combined[k % combined.length]);
    k++;
  }

  // الآن نقطع ونخلط لضمان عدم ظهور تسلسل ممل
  shuffle(session);
  state.sessionQuestions = session.slice(0, state.requestedCount);

  // ضبط العد الفعلي ليتطابق مع عدد الأسئلة المُجهز
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

  // تحديث شريط التقدم البسيط (يمكن توسيعه لاحقاً)
  updateProgressBar();
}

function updateProgressBar(){
  // إذا أردت شريط مرئي أضفه هنا؛ حالياً نحدّث النص فقط
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
      // قبول التطابق النصي بعد التطبيع، أو قبول regex إذا مُعرّف
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
    review.push({q, ans: rawAns, ok});
  });
  el('score').textContent = `النقاط: ${earned} / ${total} — النسبة: ${total? Math.round(earned/total*100):0}%`;
  const rdiv = el('review');
  rdiv.innerHTML = '';
  review.forEach(item => {
    const d = document.createElement('div');
    d.className = 'review-item';
    d.innerHTML = `<h4>${escapeHtml(item.q.prompt)}</h4>
                   <p class=\"small\">إجابتك: ${escapeHtml(item.ans || '')}</p>
                   <p class=\"small\">الصحيحة: ${escapeHtml(item.q.answer || (item.q.answer_regex || ''))}</p>
                   <p class=\"small\">النتيجة: ${item.ok ? '<span style=\"color:var(--success)\">صحيح</span>' : '<span style=\"color:var(--danger)\">خاطئ</span>'}</p>
                   <p class=\"small\">شرح: ${escapeHtml(item.q.explanation || '')}</p>`;
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
