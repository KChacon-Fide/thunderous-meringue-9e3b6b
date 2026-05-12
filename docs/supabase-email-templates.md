# Supabase email configuration - KODEX IA

La app ya no usa los correos default de Supabase para registro ni cambio de email. El flujo
corporativo propio esta en `POST /api/auth-code` y necesita estas variables de entorno:

```text
SUPABASE_SERVICE_ROLE_KEY=...
GMAIL_APP_PASSWORD=...
```

Tambien debes ejecutar el SQL de `docs/email-verification-codes.sql` en Supabase.

Para Gmail, `GMAIL_APP_PASSWORD` no es la contrasena normal de la cuenta. Debe ser una
App Password creada desde la cuenta `kodextech.cr@gmail.com` con verificacion en dos pasos activa.

Estas plantillas quedan como respaldo si decides seguir usando emails nativos de Supabase.
En ese caso se deben pegar en Supabase Dashboard, en Auth > Email Templates, y el remitente
real se configura en Auth > SMTP.

## Confirm signup

Subject:

```text
Codigo de verificacion - KODEX IA
```

Body:

```html
<div style="margin:0;padding:0;background:#080f20;font-family:Inter,Arial,sans-serif;color:#e8edf7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080f20;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#101a31;border:1px solid #23314f;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #23314f;">
              <div style="font-size:12px;letter-spacing:4px;font-weight:800;color:#00C9C8;">KODEX IA</div>
              <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;color:#ffffff;">Verifica tu correo</h1>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#a7b2c7;">Usa este codigo para activar tu cuenta en Kodex IA.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <div style="background:#071225;border:1px solid rgba(0,201,200,0.35);border-radius:14px;padding:22px;text-align:center;">
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#a7b2c7;">Codigo de verificacion</div>
                <div style="margin-top:10px;font-size:36px;letter-spacing:10px;font-weight:900;color:#00C9C8;">{{ .Token }}</div>
              </div>
              <a href="{{ .SiteURL }}/?auth=verify&type=signup&email={{ .Email }}" style="display:block;margin:24px 0 0;padding:14px 18px;background:#00C9C8;color:#04111f;text-decoration:none;border-radius:12px;text-align:center;font-weight:800;">
                Ingresar para verificar
              </a>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#748198;">Si no solicitaste esta cuenta, puedes ignorar este correo.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#071225;color:#748198;font-size:12px;">
              Kodex Tech Solutions - kodextech.cr@gmail.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Change email address

Subject:

```text
Confirma tu nuevo correo - KODEX IA
```

Body:

```html
<div style="margin:0;padding:0;background:#080f20;font-family:Inter,Arial,sans-serif;color:#e8edf7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080f20;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#101a31;border:1px solid #23314f;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #23314f;">
              <div style="font-size:12px;letter-spacing:4px;font-weight:800;color:#00C9C8;">KODEX IA</div>
              <h1 style="margin:14px 0 0;font-size:24px;line-height:1.25;color:#ffffff;">Confirma tu nuevo correo</h1>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#a7b2c7;">Ingresa este codigo para dejar tu nuevo email en vigencia.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <div style="background:#071225;border:1px solid rgba(0,201,200,0.35);border-radius:14px;padding:22px;text-align:center;">
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#a7b2c7;">Codigo de verificacion</div>
                <div style="margin-top:10px;font-size:36px;letter-spacing:10px;font-weight:900;color:#00C9C8;">{{ .Token }}</div>
              </div>
              <a href="{{ .SiteURL }}/profile?verify=email_change&email={{ .Email }}" style="display:block;margin:24px 0 0;padding:14px 18px;background:#00C9C8;color:#04111f;text-decoration:none;border-radius:12px;text-align:center;font-weight:800;">
                Ingresar para verificar
              </a>
              <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#748198;">Si no solicitaste este cambio, revisa la seguridad de tu cuenta.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#071225;color:#748198;font-size:12px;">
              Kodex Tech Solutions - kodextech.cr@gmail.com
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```
