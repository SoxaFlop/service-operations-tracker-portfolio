/** Wraps notification content in a small, brand-neutral HTML email shell. */
export function wrapEmail(content: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Service Operations Tracker</title>
  </head>
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;overflow:hidden">
            <tr>
              <td style="padding:20px 28px;background:#18181b;color:#ffffff;font-size:18px;font-weight:700">
                Service Operations Tracker
              </td>
            </tr>
            <tr><td style="padding:28px">${content}</td></tr>
            <tr>
              <td style="padding:18px 28px;background:#fafafa;color:#71717a;font-size:12px">
                Automated message from the Service Operations Tracker demo.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
