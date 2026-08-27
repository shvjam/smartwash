namespace SmartWash.Infrastructure.Messaging.Payments;

public sealed class PaymentGatewayOptions
{
    public const string SectionName = "Payments";
    public ZarinpalOptions Zarinpal { get; set; } = new();
    public IDPayOptions IDPay { get; set; } = new();
    public NextPayOptions NextPay { get; set; } = new();
}

public sealed class ZarinpalOptions
{
    public string MerchantId { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://payment.zarinpal.com/pg/v4/payment/";
    public string StartPayUrl { get; set; } = "https://payment.zarinpal.com/pg/StartPay/";
    public bool Sandbox { get; set; }
}

public sealed class IDPayOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://api.idpay.ir/v1.1/payment";
    public bool Sandbox { get; set; }
}

public sealed class NextPayOptions
{
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = "https://nextpay.org/nx/gateway/token";
    public string VerifyUrl { get; set; } = "https://nextpay.org/nx/gateway/verify";
    public string StartPayUrl { get; set; } = "https://nextpay.org/nx/gateway/payment/";
}
// resync-marker
