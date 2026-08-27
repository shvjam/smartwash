using System.Net;
using System.Net.Mail;
using SmartWash.Application.Abstractions.Messaging;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace SmartWash.Infrastructure.Messaging.Email;

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "SmartWash";
    public bool EnableSsl { get; set; } = true;
    public bool Enabled { get; set; } = true;
}

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly SmtpOptions _opt;
    private readonly ILogger<SmtpEmailSender> _log;

    public SmtpEmailSender(IOptions<SmtpOptions> opt, ILogger<SmtpEmailSender> log)
    {
        _opt = opt.Value;
        _log = log;
    }

    public async Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
    {
        if (!_opt.Enabled || string.IsNullOrWhiteSpace(_opt.Host) || string.IsNullOrWhiteSpace(_opt.FromAddress))
        {
            _log.LogInformation("SMTP disabled or unconfigured. Skipping email to {To}", to);
            return;
        }
        try
        {
            using var msg = new MailMessage
            {
                From = new MailAddress(_opt.FromAddress, _opt.FromName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true,
                BodyEncoding = System.Text.Encoding.UTF8,
                SubjectEncoding = System.Text.Encoding.UTF8
            };
            msg.To.Add(to);
            using var client = new SmtpClient(_opt.Host, _opt.Port)
            {
                EnableSsl = _opt.EnableSsl,
                Credentials = string.IsNullOrEmpty(_opt.User) ? null : new NetworkCredential(_opt.User, _opt.Password),
                DeliveryMethod = SmtpDeliveryMethod.Network
            };
            await client.SendMailAsync(msg, ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "SMTP send failed to {To}", to);
        }
    }
}
// resync-marker
