// send-onboarding-email/index.ts
// Envia emails transacionais do onboarding via Resend API
// Auth: service_role (chamada interna por onboard-create-isp)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL =
  "https://yqdqmudsnjhixtxldqwi.supabase.co/storage/v1/object/public/Uniforce/LOGO%201.png";

function buildIpLiberationEmail(adminName: string, erpType: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Liberacao de IPs - Uniforce</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <!-- Header with gradient -->
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#000E1D,#0A2A4A);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="Uniforce" width="160" style="display:block;margin:0 auto;max-width:160px;height:auto;" />
            </td>
          </tr>

          <!-- Body card -->
          <tr>
            <td style="background-color:#ffffff;padding:36px 40px;border-radius:0 0 12px 12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#000E1D;line-height:1.3;">
                Liberacao de IPs no Firewall
              </h1>

              <p style="margin:0 0 16px;font-size:15px;color:#5a6170;line-height:1.6;">
                Ola ${adminName},
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#5a6170;line-height:1.6;">
                Sua integracao com a Uniforce esta quase pronta! Identificamos que seu servidor
                <strong style="color:#000E1D;">${erpType}</strong> usa restricao de acesso por IP.
              </p>

              <p style="margin:0 0 16px;font-size:15px;color:#5a6170;line-height:1.6;">
                Para que possamos importar seus dados com sucesso, libere os IPs abaixo no firewall do seu ${erpType}:
              </p>

              <!-- Servidor de Automacao -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background-color:#f4f6f9;border-radius:8px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#000E1D;text-transform:uppercase;letter-spacing:0.5px;">
                      Servidor de Automacao
                    </p>
                    <p style="margin:0 0 4px;font-size:14px;color:#5a6170;font-family:monospace;">
                      IPv4: <strong style="color:#000E1D;">31.97.82.25</strong>
                    </p>
                    <p style="margin:0;font-size:14px;color:#5a6170;font-family:monospace;">
                      IPv6: <strong style="color:#000E1D;">2a02:4780:14:ecfb::1</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Servidor de Integracao -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#f4f6f9;border-radius:8px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#000E1D;text-transform:uppercase;letter-spacing:0.5px;">
                      Servidor de Integracao
                    </p>
                    <p style="margin:0 0 4px;font-size:14px;color:#5a6170;font-family:monospace;">
                      IPv4: <strong style="color:#000E1D;">72.61.51.21</strong>
                    </p>
                    <p style="margin:0;font-size:14px;color:#5a6170;font-family:monospace;">
                      IPv6: <strong style="color:#000E1D;">2a02:4780:66:6b48::1</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#000E1D;">Como fazer:</p>
              <ol style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#5a6170;line-height:1.8;">
                <li>Acesse seu ${erpType} &rarr; Configuracoes &rarr; Seguranca &rarr; IPs Permitidos</li>
                <li>Adicione os <strong>4 IPs</strong> acima</li>
                <li>Salve e aguarde nossa confirmacao por e-mail</li>
              </ol>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 0;">
                    <a href="mailto:suporte@uniforce.com.br?subject=Ajuda%20com%20libera%C3%A7%C3%A3o%20de%20IPs"
                       style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2A83E8,#5AF157);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;line-height:1;">
                      Precisa de ajuda? Fale com o suporte
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                &copy; ${new Date().getFullYear()} Uniforce &mdash; Inteligencia para provedores de internet.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">
                Este e-mail foi enviado automaticamente. Nao responda diretamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const { action, admin_name, admin_email, erp_type } = await req.json();

    if (action !== "ip_liberation") {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!admin_email) {
      return new Response(
        JSON.stringify({ error: "admin_email is required" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const html = buildIpLiberationEmail(admin_name || "Administrador", erp_type || "ERP");

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Uniforce <suporte@uniforce.com.br>",
        to: [admin_email],
        subject: `Liberacao de IPs — Uniforce`,
        html,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend API error:", resendData);
      return new Response(
        JSON.stringify({ error: "Failed to send email", detail: resendData }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData.id }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-onboarding-email error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error", detail: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
