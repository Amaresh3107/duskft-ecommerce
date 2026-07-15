import json
import re
import uuid
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
from database import db
from models import ChatbotKB
from deps import require_roles, get_optional_session
from business import now_iso, get_settings_dict

router = APIRouter(prefix='/api/chatbot', tags=['chatbot'])

STOPWORDS = {'the', 'a', 'an', 'is', 'are', 'do', 'does', 'what', 'how', 'can', 'i', 'you', 'for', 'of', 'to',
             'in', 'on', 'and', 'or', 'my', 'me', 'your', 'it', 'this', 'that', 'with', 'have', 'has', 'be'}


def keywords(text: str) -> set:
    words = re.findall(r"[a-zA-Z0-9']+", (text or '').lower())
    return {w for w in words if len(w) >= 3 and w not in STOPWORDS}


@router.get('/kb')
async def list_kb(includeInactive: bool = False, session: dict = Depends(get_optional_session)):
    query = {}
    if not (includeInactive and session and session['role'] in ('admin', 'staff')):
        query['active'] = True
    docs = await db.chatbot_kb.find(query).to_list(1000)
    return [ChatbotKB.from_mongo(d) for d in docs]


@router.post('/kb')
async def create_kb(payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    kb = ChatbotKB(question=payload['question'], answer=payload['answer'],
                   category=payload.get('category', ''), active=payload.get('active', True))
    result = await db.chatbot_kb.insert_one(kb.to_mongo())
    doc = await db.chatbot_kb.find_one({'_id': result.inserted_id})
    return ChatbotKB.from_mongo(doc)


@router.put('/kb/{kb_id}')
async def update_kb(kb_id: str, payload: dict, session: dict = Depends(require_roles('admin', 'staff'))):
    updates = {k: v for k, v in payload.items() if k not in ('id', '_id')}
    result = await db.chatbot_kb.update_one({'_id': ObjectId(kb_id)}, {'$set': updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Knowledge base entry not found.')
    doc = await db.chatbot_kb.find_one({'_id': ObjectId(kb_id)})
    return ChatbotKB.from_mongo(doc)


@router.delete('/kb/{kb_id}')
async def delete_kb(kb_id: str, session: dict = Depends(require_roles('admin'))):
    result = await db.chatbot_kb.delete_one({'_id': ObjectId(kb_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Knowledge base entry not found.')
    return {'success': True}


@router.get('/logs')
async def list_logs(lowConfidence: bool | None = None, session: dict = Depends(require_roles('admin', 'staff'))):
    query = {}
    if lowConfidence is not None:
        query['lowConfidence'] = lowConfidence
    docs = await db.chatbot_logs.find(query).sort('createdAt', -1).to_list(500)
    for d in docs:
        d['id'] = str(d.pop('_id'))
    return docs


def fuzzy_score(kw1: set, kw2: set) -> int:
    score = 0
    for a in kw1:
        for b in kw2:
            if a == b or (len(a) >= 4 and len(b) >= 4 and (a in b or b in a)):
                score += 1
    return score


async def build_context(message: str):
    kw = keywords(message)

    kb_docs = await db.chatbot_kb.find({'active': True}).to_list(500)
    scored = []
    for kb in kb_docs:
        kb_kw = keywords(f"{kb['question']} {kb['answer']} {kb.get('category', '')}")
        score = fuzzy_score(kw, kb_kw)
        if score > 0:
            scored.append((score, kb))
    scored.sort(key=lambda x: -x[0])
    top_kb = [kb for _, kb in scored[:3]]

    products = await db.products.find({'status': 'active'}).to_list(500)
    matched_products = []
    for p in products:
        p_kw = keywords(f"{p['name']} {p.get('sku', '')} {p.get('description', '')}")
        if fuzzy_score(kw, p_kw) > 0:
            matched_products.append(p)
    matched_products = matched_products[:5]

    settings = await get_settings_dict()

    parts = []
    if top_kb:
        parts.append('Knowledge Base:\n' + '\n'.join(f"Q: {kb['question']}\nA: {kb['answer']}" for kb in top_kb))
    if matched_products:
        lines = []
        for p in matched_products:
            tiers = ', '.join(f"{t['minQty']}+ units @ \u20b9{t['price']}" for t in (p.get('tierPricing') or []))
            lines.append(
                f"{p['name']} (SKU {p.get('sku', '')}) — MOQ {p.get('moq')} units, base price \u20b9{p.get('basePrice')}, "
                f"tier pricing: {tiers or 'none'}, colors: {', '.join(p.get('colors') or [])}, sizes: {', '.join(p.get('sizes') or [])}"
            )
        parts.append('Matching Products:\n' + '\n'.join(lines))
    parts.append(
        'Store Policy (from Settings):\n'
        f"Store: {settings.get('storeName', '')}\n"
        f"Tax: {settings.get('taxPercent', '')}% GST (CGST/SGST intra-state, IGST inter-state)\n"
        f"Free shipping over \u20b9{settings.get('freeShippingThreshold', '')}\n"
        f"Shipping policy: {settings.get('shippingPolicyText', '')}\n"
        f"Return policy: {settings.get('returnPolicyText', '')}\n"
    )
    context = '\n\n'.join(parts)
    low_confidence = not top_kb and not matched_products
    return context, [str(kb['_id']) for kb in top_kb], low_confidence


@router.post('/ask')
async def ask(payload: dict):
    message = (payload.get('message') or '').strip()
    session_id = payload.get('sessionId') or str(uuid.uuid4())
    if not message:
        raise HTTPException(status_code=400, detail='Message is required.')

    context, matched_kb_ids, low_confidence = await build_context(message)
    settings = await get_settings_dict()
    api_key = settings.get('geminiApiKey')
    model = settings.get('geminiModel') or 'gemini-3.5-flash'
    if not api_key:
        raise HTTPException(status_code=503, detail='Chatbot is not configured yet — an admin must add a Gemini API key in Settings.')

    base_prompt = settings.get('aiSystemPrompt') or 'You are a helpful assistant for a wholesale clothing store.'
    system_message = (
        f"{base_prompt}\n\n"
        "Answer ONLY using the context below. Never invent product names, prices, MOQs, or policies that are not in the context. "
        "Keep answers short and practical for a B2B wholesale buyer. If the context does not contain a confident answer, say so "
        "plainly and suggest reaching out on WhatsApp for a quick human reply — do not guess.\n\n"
        f"CONTEXT:\n{context if context.strip() else 'No specific context matched this question.'}"
    )

    chat = LlmChat(api_key=api_key, session_id=session_id, system_message=system_message).with_model('gemini', model)

    async def event_generator():
        full_text = ''
        attempts = 0
        while attempts < 3:
            attempts += 1
            full_text = ''
            try:
                async for event in chat.stream_message(UserMessage(text=message)):
                    if isinstance(event, TextDelta):
                        full_text += event.content
                        yield f"data: {json.dumps({'delta': event.content})}\n\n"
                    elif isinstance(event, StreamDone):
                        break
                low_conf = low_confidence
                break
            except Exception:
                if attempts >= 3:
                    error_msg = "Sorry, I couldn't reach the AI service just now. Please try again or reach out on WhatsApp."
                    yield f"data: {json.dumps({'delta': error_msg})}\n\n"
                    full_text = error_msg
                    low_conf = True
                else:
                    await asyncio.sleep(2)

        await db.chatbot_logs.insert_one({
            'question': message, 'answer': full_text,
            'source': 'kb' if matched_kb_ids else ('none' if low_conf else 'catalog'),
            'handedOffToWhatsapp': low_conf, 'lowConfidence': low_conf,
            'sessionId': session_id, 'createdAt': now_iso(),
        })
        yield f"data: {json.dumps({'done': True, 'lowConfidence': low_conf, 'whatsappNumber': settings.get('whatsappNumber', ''), 'matchedKbIds': matched_kb_ids})}\n\n"

    return StreamingResponse(event_generator(), media_type='text/event-stream',
                              headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})
