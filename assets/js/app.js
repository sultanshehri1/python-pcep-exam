// assets/js/app.js - نسخة MVP بسيطة لإدارة الاختبار
const QUESTIONS_URL = 'data/questions.json';

let questions = [];
let state = {
  level: 'PCEP',
  count: 10,
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
  state.count = parseInt(el('count').value,10) || 10;
  state.timed = el('timed').checked;
  let pool = questions.filter(q => q.level === state.level);
  if(pool.length === 0){ alert('لا توجد أسئلة لهذا المستوى حالياً'); return; }
  if(pool.length < state.count) state.count = pool.length;
  shuffle(pool);
  state.sessionQuestions = pool.slice(0, state.count);
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
  const p = document.createElement('div');
  p.className = 'prompt';
  p.textContent = q.prompt;
  area.appendChild(p);

  if(q.type === 'multiple_choice'){
    q.choices.forEach((c, i) => {
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
    // نوع غير مدعوم بعد
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

function showResults(){
  let total = 0, earned = 0;
  const review = [];
  state.sessionQuestions.forEach(q => {
    total += (q.points || 1);
    const ans = state.answers[q.id];
    let ok = false;
    if(q.type === 'multiple_choice' || q.type === 'true_false'){
      ok = String(ans).trim() === String(q.answer).trim();
    } else if(q.type === 'code_output' || q.type === 'fill_in_blank'){
      ok = String(ans).trim() === String(q.answer).trim();
    }
    if(ok) earned += (q.points || 1);
    review.push({q, ans, ok});
  });
  el('score').textContent = `النقاط: ${earned} / ${total} — النسبة: ${total? Math.round(earned/total*100):0}%`;
  const rdiv = el('review');
  rdiv.innerHTML = '';
  review.forEach(item => {
    const d = document.createElement('div');
    d.className = 'review-item';
    d.innerHTML = `<h4>${escapeHtml(item.q.prompt)}</h4>
                   <p>إجابتك: ${escapeHtml(item.ans || '')}</p>
                   <p>الصحيحة: ${escapeHtml(item.q.answer)}</p>
                   <p>النتيجة: ${item.ok ? 'صحيح' : 'خاطئ'}</p>
                   <p>شرح: ${escapeHtml(item.q.explanation || '')}</p>`;
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
