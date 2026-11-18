"""Лапы Закона — тематический MVP 1.0. Ядро, Python 3.10+, без зависимостей.
Состояние передаёт сервер. Блокировки, авторизацию, хранение и HTTP добавляет интегратор.
"""
from fractions import Fraction
from pathlib import Path
import json
import sys

SCORE_KINDS = {"lesson_check", "recommend_case"}
STATUSES = {"draft_pending_expert_review", "pending_expert_review", "approved", "needs_recheck", "retired"}
DRAFT = {"draft_pending_expert_review", "pending_expert_review"}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def release_key(pack):
    return f"{pack['pack_id']}@{pack['pack_version']}"


def validate(pack):
    require(pack['schema_version'] == '1.0.0', 'UNKNOWN_SCHEMA')
    require(pack['algorithm']['version'] == 'theme-mvp-1', 'UNKNOWN_ALGORITHM')
    ts, ls, xs, refs = (pack[key] for key in ('topics', 'lessons', 'items', 'legal_authorities'))
    require(len(ts) == 6 and sorted(t['order'] for t in ts.values()) == list(range(1, 7)), 'TOPICS')
    require((pack['algorithm']['window_size'], pack['algorithm']['prior_errors'], pack['algorithm']['prior_answers'],
             pack['algorithm']['max_auto_topic_streak']) == (5, 2, 4, 2), 'ALGORITHM_PARAMETERS')
    for key, mapping in (('topic', ts), ('lesson', ls), ('item', xs), ('authority', refs)):
        require(all(k == v['id'] for k, v in mapping.items()), 'BAD_ID_' + key)
    for key, t in ts.items():
        require(sorted(l['order'] for l in ls.values() if l['primary_topic_id'] == key) == [1, 2, 3, 4, 5], 'LESSON_ORDER')
    for l in ls.values():
        require(l['primary_topic_id'] in ts, 'LESSON_TOPIC')
        g, c = xs[l['guide_id']], xs[l['control_id']]
        require(g['lesson_id'] == c['lesson_id'] == l['id'] and g['kind'] == 'guide' and c['kind'] == 'lesson_check', 'PAIR')
    by_family = {}
    for x in xs.values():
        l = ls[x['lesson_id']]
        require(x['kind'] in SCORE_KINDS | {'guide'}, 'ITEM_KIND')
        require(x['primary_topic_id'] == l['primary_topic_id'] and x['subtopic_id'] == l['subtopic_id'], 'SUBTOPIC')
        require(set(x['secondary_topic_ids']) <= (ts.keys() - {x['primary_topic_id']}), 'SECONDARY_TOPIC')
        opt = x['options']
        require({o['id'] for o in opt} == {'A', 'B', 'C'} and len(opt) == 3, 'OPTIONS')
        require(x['correct_option_id'] in {o['id'] for o in opt}, 'ANSWER_KEY')
        require(all(o['text'].strip() and o['explanation'].strip() for o in opt), 'OPTION_TEXT')
        require(x['kind'] == 'guide' or 'hint' not in x, 'CHECK_HINT_LEAK')
        require(x['kind'] == 'recommend_case' or x['id'] == l['guide_id' if x['kind']=='guide' else 'control_id'], 'UNLINKED_ITEM')
        f = x['evidence_family_id']
        # Когда добавлена эквивалентная форма, семья может повторяться внутри одного тега/темы.
        scope = (x['primary_topic_id'], x['subtopic_id'])
        require(by_family.setdefault(f, scope) == scope, 'FAMILY_SCOPE')
        require(f != xs[l['guide_id']]['evidence_family_id'] or x['kind'] == 'guide', 'GUIDE_FAMILY_LEAK')
    for row in list(ls.values()) + list(xs.values()):
        require(type(row['content_version']) is int and row['content_version'] >= 1, 'CONTENT_VERSION')
        require(row['legal_review_status'] in STATUSES, 'REVIEW_STATUS')
        require(row['legal_review_status'] != 'approved' or bool(row['expert_signoff_id'] and row['expert_approved_on']), 'MISSING_SIGNOFF')
        require(row['legal_basis_ids'] and set(row['legal_basis_ids']) <= refs.keys(), 'LEGAL_BASIS')
    require((pack['algorithm']['weight_min_pct'], pack['algorithm']['weight_max_pct'], pack['algorithm']['weight_step_pct']) == (80, 120, 5), 'WEIGHT_PARAMETERS')
    validate_weights(pack, None)


def valid_row(row, sandbox=False):
    if row['legal_review_status'] == 'approved':
        return bool(row['expert_signoff_id'] and row['expert_approved_on'])
    return sandbox and row['legal_review_status'] in DRAFT


def available(pack, x, sandbox=False):
    return valid_row(x, sandbox) and valid_row(pack['lessons'][x['lesson_id']], sandbox)


def new_state():
    return dict(seq=0, open_attempt_id=None, attempts={}, seen_families=[], observations=[], auto_shows=[])


def next_seq(state):
    state['seq'] += 1
    return state['seq']


def validate_weights(pack, weights):
    w = {t: row['weight_pct'] for t, row in pack['topics'].items()} if weights is None else weights
    require(w.keys() == pack['topics'].keys(), 'WEIGHT_TOPICS')
    require(all(type(v) is int and 80 <= v <= 120 and v % 5 == 0 for v in w.values()), 'WEIGHT_RANGE')
    return w


def metrics(pack, state, weights=None):
    w = validate_weights(pack, weights)
    by = {t: [] for t in pack['topics']}
    for row in sorted(state['observations'], key=lambda a: a['seq']):
        if not row['voided'] and row['topic_id'] in by:
            by[row['topic_id']].append(row)
    out = {}
    for t, all_rows in by.items():
        rows = all_rows[-pack['algorithm']['window_size']:]
        n = len(rows)
        e = sum(not a['correct'] for a in rows)
        need = Fraction(2 + e, 4 + n)
        out[t] = dict(n=n, errors=e, need=need, priority=need * Fraction(w[t], 100), rows=rows,
                      label='NOT_ASSESSED' if n == 0 else 'LIMITED' if n <= 2 else 'RECENT_RESULTS')
    return out


def live(pack, a, sandbox=False):
    x = pack['items'].get(a['item_id'])
    return (a['release_key'] == release_key(pack) and x is not None and
            x['content_version'] == a['content_version'] and available(pack, x, sandbox))


def cancel_obsolete(pack, state, sandbox=False):
    oid = state['open_attempt_id']
    if oid is not None and not live(pack, state['attempts'][oid], sandbox):
        state['attempts'][oid].update(status='cancelled', terminal_seq=next_seq(state), counted=False, reason='CONTENT_UNAVAILABLE')
        state['open_attempt_id'] = None


def choose(pack, state, *, topic_id=None, lesson_id=None, weights=None, sandbox=False):
    ts, ls, xs = (pack[key] for key in ('topics', 'lessons', 'items'))
    require(topic_id is None or topic_id in ts, 'UNKNOWN_TOPIC')
    require(lesson_id is None or lesson_id in ls, 'UNKNOWN_LESSON')
    require(topic_id is None or lesson_id is None, 'AMBIGUOUS_CHOICE')
    cancel_obsolete(pack, state, sandbox)
    if state['open_attempt_id'] is not None:
        return dict(kind='resume', attempt_id=state['open_attempt_id'], reason='OPEN_ATTEMPT')
    if lesson_id is not None:
        lesson = ls[lesson_id]
        selected = available(pack, xs[lesson['guide_id']], sandbox)
        return dict(kind='lesson' if selected else 'none', lesson_id=lesson_id,
                    reason='USER_LESSON' if selected else 'NO_PUBLISHED_CONTENT')
    live_items = [x for x in xs.values() if (topic_id is None or x['primary_topic_id'] == topic_id)
                  and available(pack, x, sandbox)]
    seen = set(state['seen_families'])
    pool = {}
    for x in live_items:
        if x['kind'] == 'recommend_case' and x['evidence_family_id'] not in seen:
            pool.setdefault(x['primary_topic_id'], []).append(x)
    if pool:
        mm = metrics(pack, state, weights)
        reason = 'USER_TOPIC' if topic_id is not None else 'THEME_PRIORITY'
        keys = list(pool)
        hist = state['auto_shows']
        m = pack['algorithm']['max_auto_topic_streak']
        last_auto = {a['topic_id']: a['seq'] for a in hist}
        tail = hist[-m:]
        if topic_id is None and len(tail) == m and len({a['topic_id'] for a in tail}) == 1:
            others = [t for t in keys if t != tail[-1]['topic_id']]
            if others:
                keys = [t for t in others if mm[t]['n'] == 0] or others
                reason = 'ROTATE_TOPIC'
        topic = min(keys, key=lambda t: (-mm[t]['priority'], mm[t]['n'] != 0, last_auto.get(t, 0), ts[t]['order'], t))
        tags = {x['subtopic_id'] for x in pool[topic]}
        latest_by_tag = {a['subtopic_id']: a for a in mm[topic]['rows']}
        misses = [a for tag, a in latest_by_tag.items() if tag in tags and not a['correct']]
        preferred = max(misses, key=lambda a: a['seq'])['subtopic_id'] if misses else None
        x = min(pool[topic], key=lambda x: (x['subtopic_id'] != preferred, ls[x['lesson_id']]['order'], x['id']))
        return dict(kind='new_case', item_id=x['id'], topic_id=topic, reason=reason,
                    origin='auto' if topic_id is None else 'manual', matched_error_tag=preferred)
    # Повтор только после осознанного выбора, а не автоматическая попытка.
    known = [x for x in live_items if x['kind'] in SCORE_KINDS and x['evidence_family_id'] in seen]
    if known:
        misses = {a['evidence_family_id']: a['seq'] for a in sorted(state['observations'], key=lambda a:a['seq'])
                  if not a['voided'] and not a['correct']}
        last_seen = {a['evidence_family_id']: a['issued_seq'] for a in sorted(state['attempts'].values(), key=lambda a:a['issued_seq'])}
        x = min(known, key=lambda x: (-misses.get(x['evidence_family_id'], 0), -last_seen.get(x['evidence_family_id'], 0),
                                      ts[x['primary_topic_id']]['order'], ls[x['lesson_id']]['order'], x['id']))
        return dict(kind='review', item_id=x['id'], topic_id=x['primary_topic_id'], reason='FRESH_EXHAUSTED')
    return dict(kind='catalog' if live_items else 'none', topic_id=topic_id,
                reason='FRESH_EXHAUSTED' if live_items else 'NO_PUBLISHED_CONTENT')


def issue(pack, state, item_id, *, mode, origin, config_version='weights-1', sandbox=False):
    """Вызвать только по доверенному решению сервера, под блокировкой пользователя."""
    cancel_obsolete(pack, state, sandbox)
    require(state['open_attempt_id'] is None, 'OPEN_ATTEMPT')
    x = pack['items'][item_id]
    require(available(pack, x, sandbox), 'CONTENT_UNAVAILABLE')
    require(mode in {'guide','check','fresh_case','practice'}, 'BAD_MODE')
    allowed_modes = {'guide': {'guide','practice'}, 'lesson_check': {'check','practice'}, 'recommend_case': {'fresh_case','practice'}}
    require(mode in allowed_modes[x['kind']], 'WRONG_MODE')
    require(origin in {'auto','manual','lesson'} and (origin != 'auto' or mode == 'fresh_case'), 'BAD_ORIGIN')
    family = x['evidence_family_id']
    preexposed = family in state['seen_families']
    require(not (mode == 'fresh_case' and preexposed), 'FAMILY_SEEN')
    if not preexposed:
        state['seen_families'].append(family)
    if preexposed and mode == 'check':
        mode = 'practice'
    seq = next_seq(state)
    a = dict(id=f'a{seq}', release_key=release_key(pack), item_id=x['id'], content_version=x['content_version'],
             evidence_family_id=family, topic_id=x['primary_topic_id'], subtopic_id=x['subtopic_id'],
             mode=mode, origin=origin, issued_seq=seq, preexposed=preexposed, assisted=False, status='open',
             config_version=config_version, algorithm_version=pack['algorithm']['version'])
    state['attempts'][a['id']] = a
    state['open_attempt_id'] = a['id']
    if origin == 'auto':
        state['auto_shows'].append(dict(topic_id=a['topic_id'], seq=seq, attempt_id=a['id']))
    return a


def act(pack, state, attempt_id, action, option_id=None, *, sandbox=False):
    require(action in {'answer','help','skip','reveal'}, 'BAD_ACTION')
    cancel_obsolete(pack, state, sandbox)
    a = state['attempts'][attempt_id]
    if a['status'] != 'open':
        return dict(status=a['status'], reason=a.get('reason'), counted=a.get('counted', False), already_closed=True)
    require(state['open_attempt_id'] == attempt_id, 'NOT_OPEN')
    x = pack['items'][a['item_id']]
    if action == 'help':
        a['assisted'] = True
        return dict(status='open', assistance=x.get('hint') or pack['lessons'][x['lesson_id']]['theory'])
    if action == 'answer':
        require(option_id in {o['id'] for o in x['options']}, 'BAD_OPTION')
        a['selected_option_id'] = option_id
        a['correct'] = option_id == x['correct_option_id']
    exists = any(o['evidence_family_id'] == a['evidence_family_id'] for o in state['observations'])
    reason = ('SKIP' if action == 'skip' else 'REVEAL' if action == 'reveal'
              else 'NOT_ASSESSMENT' if a['mode'] == 'guide' else 'FAMILY_SEEN' if a['preexposed'] or exists
              else 'PRACTICE' if a['mode'] == 'practice' else 'ASSISTED' if a['assisted'] else 'COUNTED')
    a.update(status={'answer':'answered','skip':'skipped','reveal':'revealed'}[action],
             terminal_seq=next_seq(state), counted=(reason == 'COUNTED'), reason=reason)
    state['open_attempt_id'] = None
    if a['counted']:
        state['observations'].append({key:a[key] for key in ('topic_id','subtopic_id','item_id','content_version',
                 'release_key','config_version','algorithm_version','evidence_family_id','correct')} |
                 dict(seq=a['terminal_seq'], attempt_id=a['id'], voided=False))
    result = dict(status=a['status'], reason=reason, counted=a['counted'])
    if action in {'answer','reveal'}:
        result.update(correct_option_id=x['correct_option_id'], feedback=x['options'], legal_basis_ids=x['legal_basis_ids'])
    if action == 'answer':
        result['correct'] = a['correct']
    return result


def self_test(pack):
    """Данные в тестах вымышленные. Режим sandbox не является юридическим одобрением."""
    from copy import deepcopy
    validate(pack)
    n = 0
    def expect(expr, message):
        nonlocal n
        require(expr, message)
        n += 1
    def answer(p, s, x, correct=True, *, mode='check', origin='lesson', action='answer'):
        a = issue(p, s, x, mode=mode, origin=origin, sandbox=True)
        key = p['items'][x]['correct_option_id']
        pick = key if correct else next(c for c in 'ABC' if c != key)
        return a, act(p, s, a['id'], action, pick if action=='answer' else None, sandbox=True)
    def auto(p, s):
        c = choose(p, s, sandbox=True)
        return c, issue(p, s, c['item_id'], mode='fresh_case', origin=c['origin'], sandbox=True)
    s = new_state()
    expect(choose(pack, s)['reason']=='NO_PUBLISHED_CONTENT', 'PUBLISH_GATE')
    p = deepcopy(pack)
    p['items']['CIV01_R1'].update(legal_review_status='approved', expert_signoff_id='test-only-stamp', expert_approved_on='2026-11-19')
    expect(choose(p, new_state())['reason']=='NO_PUBLISHED_CONTENT', 'PARENT_GATE')
    p['lessons']['CIV01'].update(legal_review_status='approved', expert_signoff_id='test-only-parent', expert_approved_on='2026-11-19')
    expect(choose(p, new_state())['item_id']=='CIV01_R1','APPROVAL_PAIR')
    w = {t:100 for t in pack['topics']}; w['CIV']=125
    try:
        metrics(pack, s, w)
    except ValueError as e:
        expect(str(e)=='WEIGHT_RANGE', 'BAD_WEIGHT_FAILS')
    else:
        raise ValueError('WEIGHT_VALIDATION_MISSED')
    expect(all(m['n']==0 and m['need']==Fraction(1,2) for m in metrics(pack,s).values()), 'COLD')
    expect(choose(pack, s, sandbox=True)['item_id']=='CIV01_R1', 'COLD_ROUTE')
    expect(choose(pack, s, topic_id='BUY', sandbox=True)['item_id']=='BUY01_R1', 'MANUAL_TOPIC')
    expect(choose(pack, s, lesson_id='POL03', sandbox=True)['kind']=='lesson', 'MANUAL_LESSON')
    _, b = answer(pack, s, 'POL03_G', mode='guide')
    expect(not b['counted'] and not s['observations'], 'GUIDE_NO_CREDIT')
    a, b = answer(pack, s, 'BUY03_C', False)
    expect(b['counted'] and not b['correct'] and metrics(pack,s)['BUY']['need']==Fraction(3,5), 'ONE_WRONG')
    expect(choose(pack, s, sandbox=True)['item_id']=='BUY03_R1', 'MATCH_SUBTOPIC')
    expect(act(pack, s, a['id'], 'answer', 'A', sandbox=True)['already_closed'] and len(s['observations'])==1, 'REPLAY')
    # POL04 имеет вторичный тег CIV; начисление только POL.
    _, b = answer(pack, s, 'POL04_C')
    expect(b['counted'] and metrics(pack,s)['CIV']['n']==0 and metrics(pack,s)['POL']['need']==Fraction(2,5), 'PRIMARY_ONLY')
    _, b = answer(pack, s, 'BUY03_C')
    expect(not b['counted'] and b['reason']=='FAMILY_SEEN', 'REPEAT')
    a = issue(pack, s, 'HOME03_C', mode='check', origin='lesson', sandbox=True)
    try:
        act(pack, s, a['id'], 'answer', 'Z', sandbox=True)
    except ValueError as e:
        expect(str(e)=='BAD_OPTION' and a['status']=='open' and metrics(pack,s)['HOME']['n']==0, 'INVALID_OPTION_NO_SCORE')
    else:
        raise ValueError('BAD_OPTION_ACCEPTED')
    act(pack, s, a['id'], 'help', sandbox=True)
    b = act(pack, s, a['id'], 'answer', 'A', sandbox=True)
    expect(b['reason']=='ASSISTED' and metrics(pack,s)['HOME']['n']==0, 'ASSISTANCE')
    _, b = answer(pack, s, 'WORK02_C', action='reveal')
    expect(not b['counted'] and b['reason']=='REVEAL', 'REVEAL')
    stale = issue(pack, s, 'HOME04_C', mode='check', origin='lesson', sandbox=True)
    p = deepcopy(pack); p['items']['HOME04_C']['legal_review_status']='needs_recheck'
    b = act(p, s, stale['id'], 'answer', 'C', sandbox=True)
    expect(b['reason']=='CONTENT_UNAVAILABLE' and b['status']=='cancelled' and not b['counted'], 'OBSOLETE')
    s = new_state()
    for i in range(2):
        c, a = auto(pack,s)
        expect(c['topic_id']=='CIV', f'STREAK_{i}')
        expect(choose(pack,s,sandbox=True)['kind']=='resume', f'OPEN_{i}')
        if i==0:
            expect(act(pack,s,a['id'],'answer','A',sandbox=True)['counted'], 'AUTO_COUNTS')  # CIV01_R1 = B
        else:
            expect(not act(pack,s,a['id'],'skip',sandbox=True)['counted'], 'SKIP')
    r = choose(pack,s,sandbox=True)
    expect(r['topic_id']=='POL' and r['reason']=='ROTATE_TOPIC', 'ROTATE')
    expect(choose(pack,s,topic_id='CIV',sandbox=True)['topic_id']=='CIV','USER_OVERRIDES_ROTATION')
    # Никаких свежих кейсов только в CIV: другая тема или повтор в пределах явного выбора.
    for k in range(3,6):
        s['seen_families'].append(pack['items'][f'CIV0{k}_R1']['evidence_family_id'])
    expect(choose(pack,s,topic_id='CIV',sandbox=True)['kind']=='review', 'MANUAL_EXHAUSTED')
    expect(choose(pack,s,sandbox=True)['topic_id']!='CIV', 'NO_FRESH_RESELECT')
    s = new_state()
    for i, good in enumerate((False, False, True),1): answer(pack,s,f'BUY0{i}_C',good)
    expect(metrics(pack,s)['BUY']['need']==Fraction(4,7), 'ONE_OF_THREE')
    for i in range(4,6): answer(pack,s,f'BUY0{i}_C',True)
    answer(pack,s,'BUY01_R1',True,mode='fresh_case',origin='manual')
    expect(metrics(pack,s)['BUY']['need']==Fraction(1,3) and metrics(pack,s)['BUY']['n']==5, 'ROLLING_WINDOW')
    w = {t:100 for t in pack['topics']}; w['BUY']=110
    expect(metrics(pack,s,w)['BUY']['priority']==Fraction(11,30) and metrics(pack,s,w)['BUY']['need']==Fraction(1,3), 'WEIGHT_ONLY_RANK')
    next(o for o in s['observations'] if o['item_id']=='BUY01_R1')['voided']=True
    expect(metrics(pack,s)['BUY']['need']==Fraction(4,9) and choose(pack,s,topic_id='BUY',sandbox=True)['item_id']!='BUY01_R1', 'VOID_NOT_FRESH')
    p = deepcopy(pack); p['items']['BUY01_R1']['content_version']=2
    expect(choose(p,s,topic_id='BUY',sandbox=True)['item_id']!='BUY01_R1', 'VERSION_NOT_FRESH')
    p['items']['BUY01_R2'] = dict(p['items']['BUY01_R1'], id='BUY01_R2')
    validate(p)
    expect(choose(p,s,topic_id='BUY',sandbox=True)['item_id'] not in {'BUY01_R1','BUY01_R2'}, 'EQUIVALENT_FAMILY_NOT_FRESH')
    # Общий исчерпанный банк: можно лишь предложить повтор.
    s['seen_families'] = list({x['evidence_family_id'] for x in pack['items'].values()})
    expect(choose(pack,s,sandbox=True)['kind']=='review', 'BANK_EXHAUSTED')
    return n


if __name__ == '__main__':
    pack = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    print(f'OK: {self_test(pack)} проверок')