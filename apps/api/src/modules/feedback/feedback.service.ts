import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";

function surveyToken(): string {
  return randomBytes(16).toString("hex");
}

@Injectable()
export class FeedbackService {
  constructor(private prisma: PrismaService) {}

  list(orgId: string, params: { outletId?: string; from?: string; to?: string }) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (params.outletId) where.outletId = params.outletId;
    if (params.from || params.to) {
      const gte = params.from ? new Date(params.from) : undefined;
      const lte = params.to ? new Date(params.to) : undefined;
      if (lte) lte.setHours(23, 59, 59, 999);
      where.createdAt = { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
    }
    return this.prisma.feedbackResponse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        order: { select: { id: true, orderNumber: true } },
        outlet: { select: { id: true, name: true } },
      },
    });
  }

  async ensureSurveyToken(orgId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: orgId },
      include: {
        feedbackResponse: true,
        outlet: { select: { name: true } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.feedbackResponse) {
      return {
        surveyToken: order.feedbackResponse.surveyToken,
        alreadySubmitted: order.feedbackResponse.rating != null,
        orderNumber: order.orderNumber,
        outletName: order.outlet.name,
      };
    }
    const token = surveyToken();
    await this.prisma.feedbackResponse.create({
      data: {
        organizationId: orgId,
        outletId: order.outletId,
        orderId: order.id,
        surveyToken: token,
      },
    });
    return {
      surveyToken: token,
      alreadySubmitted: false,
      orderNumber: order.orderNumber,
      outletName: order.outlet.name,
    };
  }

  getSurveyLink(surveyToken: string, baseUrl?: string) {
    const apiRoot =
      baseUrl?.replace(/\/$/, "") ||
      process.env.API_PUBLIC_URL?.replace(/\/$/, "") ||
      process.env.PUBLIC_API_URL?.replace(/\/$/, "") ||
      "https://api.cullinos.com";
    return `${apiRoot}/api/v1/public/feedback/${encodeURIComponent(surveyToken)}/page`;
  }

  escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async renderSurveyPageHtml(token: string): Promise<string> {
    const survey = await this.getSurveyByToken(token);
    const outlet = this.escapeHtml(survey.outletName || "Restaurant");
    const orderNo = this.escapeHtml(survey.orderNumber || "");
    const thanksJs = JSON.stringify(
      `Thank you for dining at ${survey.outletName || "us"}!`,
    );
    const submitUrl = `/api/v1/public/feedback/${encodeURIComponent(token)}`;

    if (survey.alreadySubmitted) {
      return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Thanks — ${outlet}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0f0f1a;color:#f5f5f5;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:420px;width:100%;background:#1a1a2e;border-radius:16px;padding:28px;text-align:center}
  h1{font-size:1.35rem;margin:0 0 8px;color:#d4a017}
  p{opacity:.85;line-height:1.5}
</style></head><body>
<div class="card">
  <h1>${outlet}</h1>
  <p>Thanks — we already received your feedback${orderNo ? ` for order #${orderNo}` : ""}.</p>
</div></body></html>`;
    }

    return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Feedback — ${outlet}</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0f0f1a;color:#f5f5f5;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:420px;width:100%;background:#1a1a2e;border-radius:16px;padding:28px}
  h1{font-size:1.35rem;margin:0 0 4px;color:#d4a017;text-align:center}
  .sub{text-align:center;opacity:.75;margin:0 0 20px;font-size:.9rem}
  label{display:block;font-size:.85rem;margin:12px 0 6px;opacity:.9}
  select,textarea,button{width:100%;box-sizing:border-box;border-radius:10px;border:1px solid #333;background:#12121f;color:#fff;padding:12px;font:inherit}
  button{background:#d4a017;color:#0f0f1a;font-weight:700;border:none;cursor:pointer;margin-top:16px}
  button:disabled{opacity:.5}
  .msg{margin-top:14px;text-align:center;font-size:.9rem}
  .ok{color:#4ade80}.err{color:#f87171}
</style></head><body>
<div class="card">
  <h1>${outlet}</h1>
  <p class="sub">How was your visit${orderNo ? ` · order #${orderNo}` : ""}?</p>
  <form id="f">
    <label for="rating">Rating</label>
    <select id="rating" name="rating" required>
      <option value="5">5 — Excellent</option>
      <option value="4">4 — Good</option>
      <option value="3" selected>3 — OK</option>
      <option value="2">2 — Poor</option>
      <option value="1">1 — Bad</option>
    </select>
    <label for="comment">Comment (optional)</label>
    <textarea id="comment" name="comment" rows="3" placeholder="Tell us more…"></textarea>
    <button type="submit" id="btn">Submit feedback</button>
    <p class="msg" id="msg" hidden></p>
  </form>
</div>
<script>
(function(){
  var form=document.getElementById('f');
  var btn=document.getElementById('btn');
  var msg=document.getElementById('msg');
  var thanksMsg=${thanksJs};
  form.addEventListener('submit',function(e){
    e.preventDefault();
    btn.disabled=true;
    msg.hidden=true;
    fetch(${JSON.stringify(submitUrl)},{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        rating:Number(document.getElementById('rating').value),
        comment:document.getElementById('comment').value||undefined
      })
    }).then(function(r){
      if(!r.ok) return r.json().then(function(j){throw new Error((j&&j.message)||'Submit failed')});
      msg.className='msg ok';
      msg.textContent=thanksMsg;
      msg.hidden=false;
      form.querySelectorAll('select,textarea,button').forEach(function(el){el.disabled=true});
    }).catch(function(err){
      btn.disabled=false;
      msg.className='msg err';
      msg.textContent=err.message||'Could not submit';
      msg.hidden=false;
    });
  });
})();
</script>
</body></html>`;
  }

  async getSurveyByToken(token: string) {
    const row = await this.prisma.feedbackResponse.findUnique({
      where: { surveyToken: token },
      include: {
        order: { select: { orderNumber: true, status: true } },
        outlet: { select: { name: true } },
      },
    });
    if (!row) throw new NotFoundException("Survey not found");
    return {
      surveyToken: row.surveyToken,
      orderNumber: row.order.orderNumber,
      outletName: row.outlet.name,
      alreadySubmitted: row.rating != null,
      rating: row.rating,
      comment: row.comment,
    };
  }

  async submitSurvey(token: string, rating: number, comment?: string) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException("rating must be between 1 and 5");
    }
    const row = await this.prisma.feedbackResponse.findUnique({
      where: { surveyToken: token },
    });
    if (!row) throw new NotFoundException("Survey not found");
    const claimed = await this.prisma.feedbackResponse.updateMany({
      where: { id: row.id, rating: null },
      data: {
        rating,
        comment: comment?.trim().slice(0, 2000) || null,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException("Feedback already submitted for this order");
    }
    return this.prisma.feedbackResponse.findUniqueOrThrow({ where: { id: row.id } });
  }

  summary(orgId: string, params: { outletId?: string; from?: string; to?: string }) {
    return this.list(orgId, params).then(async (rows) => {
      const submitted = rows.filter((r) => r.rating != null);
      const avg =
        submitted.length > 0
          ? submitted.reduce((s, r) => s + (r.rating ?? 0), 0) / submitted.length
          : 0;
      const distribution = [1, 2, 3, 4, 5].map((star) => ({
        star,
        count: submitted.filter((r) => r.rating === star).length,
      }));
      return {
        totalResponses: submitted.length,
        averageRating: Math.round(avg * 10) / 10,
        distribution,
      };
    });
  }
}
